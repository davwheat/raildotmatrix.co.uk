package management

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/setupdisplay"
)

const hotspotUUID = "4c376e41-f15d-4dbf-9747-5932b6c9d078"
const clientUUID = "10e4bf67-d053-4e24-8f93-ed70b5161a5d"
const clientProfile = "/etc/NetworkManager/system-connections/departure-board-client.nmconnection"

type NetworkInput struct {
	SSID     string `json:"ssid"`
	Password string `json:"password"`
	Country  string `json:"country"`
	Open     bool   `json:"open"`
	Hidden   bool   `json:"hidden"`
}
type Network struct {
	SSID     string `json:"ssid"`
	Signal   int    `json:"signal"`
	Security string `json:"security"`
}
type WiFi struct {
	opts    Options
	mu      sync.Mutex
	status  setupdisplay.Status
	busy    bool
	profile string
	written []byte
}

func NewWiFi(o Options) *WiFi {
	profile := clientProfile
	if o.Demo {
		profile = filepath.Join(o.StateDir, "client.nmconnection")
	}
	return &WiFi{opts: o, profile: profile, status: setupdisplay.Status{Mode: "starting", IPs: []string{}}}
}
func (w *WiFi) Status() setupdisplay.Status {
	w.mu.Lock()
	defer w.mu.Unlock()
	s := w.status
	s.IPs = append([]string{}, s.IPs...)
	return s
}
func localIPs() []string {
	var ips []string
	interfaces, _ := net.Interfaces()
	for _, i := range interfaces {
		if i.Flags&net.FlagLoopback != 0 || i.Flags&net.FlagUp == 0 {
			continue
		}
		addresses, _ := i.Addrs()
		for _, a := range addresses {
			ip, _, err := net.ParseCIDR(a.String())
			if err == nil && ip.To4() != nil && !ip.IsLinkLocalUnicast() {
				ips = append(ips, ip.String())
			}
		}
	}
	sort.Strings(ips)
	return ips
}
func (w *WiFi) set(mode, ssid, message string) {
	clients := 0
	if mode == "hotspot" && !w.opts.Demo {
		data, err := w.opts.Run(context.Background(), "iw", "dev", w.opts.Interface, "station", "dump")
		if err == nil {
			for _, line := range strings.Split(string(data), "\n") {
				if strings.HasPrefix(line, "Station ") {
					clients++
				}
			}
		}
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	state := setupdisplay.Status{Mode: mode, SSID: ssid, Message: message, IPs: localIPs(), Clients: clients}
	country, _ := os.ReadFile(filepath.Join(w.opts.StateDir, "country"))
	state.Country = string(country)
	if !validCountry(state.Country) {
		state.Country = "GB"
	}
	if w.opts.Demo {
		if mode == "hotspot" {
			state.IPs = []string{"192.168.4.1"}
		} else {
			state.IPs = []string{"192.168.1.82"}
		}
	}
	w.status = state
	data, _ := json.Marshal(state)
	if bytes.Equal(data, w.written) {
		// Polling a stable connection must not rewrite and fsync the SD card every three seconds. Recreate
		// the status if it was removed; a failed write is retried on the next poll.
		if _, err := os.Stat(w.opts.StatusPath); err == nil {
			return
		}
	}
	if err := atomicWrite(w.opts.StatusPath, data, 0644); err != nil {
		log.Printf("write matrix setup status: %v", err)
	} else {
		w.written = data
	}
}
func (w *WiFi) nm(ctx context.Context, args ...string) ([]byte, error) {
	return w.opts.Run(ctx, "nmcli", args...)
}
func (w *WiFi) claim() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.busy {
		return false
	}
	w.busy = true
	return true
}
func (w *WiFi) done() { w.mu.Lock(); w.busy = false; w.mu.Unlock() }

func (w *WiFi) Monitor(ctx context.Context) {
	if w.opts.Demo {
		w.set("hotspot", "DepartureBoard", "")
		return
	}
	// Radio state can survive reboots; ensure a previous soft block does not
	// strand a freshly booted board. Missing adapters remain manageable on LAN.
	w.opts.Run(ctx, "rfkill", "unblock", "wifi")
	w.nm(ctx, "radio", "wifi", "on")
	country, _ := os.ReadFile(filepath.Join(w.opts.StateDir, "country"))
	if validCountry(string(country)) {
		w.opts.Run(ctx, "iw", "reg", "set", string(country))
	}
	if w.claim() {
		w.restore(ctx)
		w.done()
	}
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if !w.claim() {
				continue
			}
			current, err := w.nm(ctx, "-g", "GENERAL.CON-UUID", "device", "show", w.opts.Interface)
			state := w.Status()
			if err == nil && strings.TrimSpace(string(current)) == clientUUID {
				w.set("connected", state.SSID, "")
			} else if err == nil && strings.TrimSpace(string(current)) == hotspotUUID {
				w.set("hotspot", "DepartureBoard", state.Message)
			} else {
				w.restore(ctx)
			}
			w.done()
		}
	}
}
func (w *WiFi) restore(ctx context.Context) {
	if _, err := os.Stat(w.profile); err == nil {
		w.set("connecting", "saved network", "")
		if _, err = w.nm(ctx, "--wait", "30", "connection", "up", "uuid", clientUUID, "ifname", w.opts.Interface); err == nil {
			ssid, _ := w.nm(ctx, "--escape", "no", "-g", "802-11-wireless.ssid", "connection", "show", "uuid", clientUUID)
			w.set("connected", strings.TrimSpace(string(ssid)), "")
			return
		}
		w.hotspot(ctx, "Could not connect to the saved network. Check its name and password.")
		return
	}
	w.hotspot(ctx, "")
}
func (w *WiFi) hotspot(ctx context.Context, message string) {
	if !w.opts.Demo {
		if _, err := w.nm(ctx, "--wait", "15", "connection", "up", "uuid", hotspotUUID, "ifname", w.opts.Interface); err != nil {
			w.set("unavailable", "", "Wi-Fi is unavailable. Connect Ethernet or check the wireless adapter.")
			return
		}
	}
	w.set("hotspot", "DepartureBoard", message)
}
func validCountry(s string) bool {
	return len(s) == 2 && strings.Trim(s, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") == ""
}
func keyfileString(s string) string {
	return strings.NewReplacer("\\", "\\\\", "\n", "\\n", "\r", "\\r", "\t", "\\t", " ", "\\s").Replace(s)
}
func profile(in NetworkInput, iface string) ([]byte, error) {
	if !utf8.ValidString(in.SSID) || len(in.SSID) == 0 || len(in.SSID) > 32 || strings.ContainsRune(in.SSID, 0) {
		return nil, errors.New("network name must be 1–32 bytes")
	}
	if !validCountry(in.Country) {
		return nil, errors.New("choose a two-letter Wi-Fi country code")
	}
	if !in.Open && (len(in.Password) < 8 || len(in.Password) > 63 || strings.ContainsAny(in.Password, "\x00\r\n")) {
		return nil, errors.New("Wi-Fi password must be 8–63 characters")
	}
	if in.Open && in.Password != "" {
		return nil, errors.New("an open network does not use a password")
	}
	body := fmt.Sprintf("[connection]\nid=departure-board-client\nuuid=%s\ntype=wifi\ninterface-name=%s\nautoconnect=true\nautoconnect-priority=100\n\n[wifi]\nmode=infrastructure\nssid=%s\nhidden=%t\npowersave=2\n", clientUUID, iface, keyfileString(in.SSID), in.Hidden)
	if !in.Open {
		body += "\n[wifi-security]\nkey-mgmt=wpa-psk\npsk=" + keyfileString(in.Password) + "\n"
	}
	body += "\n[ipv4]\nmethod=auto\n\n[ipv6]\nmethod=auto\n"
	return []byte(body), nil
}
func (w *WiFi) Connect(in NetworkInput) error {
	data, err := profile(in, w.opts.Interface)
	if err != nil {
		return err
	}
	if !w.claim() {
		return errors.New("a connection change is already in progress")
	}
	if err = atomicWrite(w.profile, data, 0600); err != nil {
		w.done()
		return err
	}
	if err = atomicWrite(filepath.Join(w.opts.StateDir, "country"), []byte(in.Country), 0600); err != nil {
		w.done()
		return err
	}
	w.set("connecting", in.SSID, "")
	// Finish the response before switching the same Wi-Fi adapter from AP to client.
	go func() {
		defer w.done()
		time.Sleep(2 * time.Second)
		ctx := context.Background()
		if w.opts.Demo {
			w.set("connected", in.SSID, "")
			return
		}
		w.opts.Run(ctx, "iw", "reg", "set", in.Country)
		if _, err := w.nm(ctx, "connection", "load", w.profile); err != nil {
			w.hotspot(ctx, "Could not save this Wi-Fi network.")
			return
		}
		if _, err := w.nm(ctx, "--wait", "30", "connection", "up", "uuid", clientUUID, "ifname", w.opts.Interface); err != nil {
			w.hotspot(ctx, "Connection failed. Check the network password and try again.")
			return
		}
		w.set("connected", in.SSID, "")
	}()
	return nil
}
func (w *WiFi) Forget() error {
	if !w.claim() {
		return errors.New("a connection change is already in progress")
	}
	if err := os.Remove(w.profile); err != nil && !errors.Is(err, os.ErrNotExist) {
		w.done()
		return err
	}
	w.set("connecting", "DepartureBoard", "Starting the setup hotspot.")
	go func() {
		defer w.done()
		time.Sleep(2 * time.Second)
		if !w.opts.Demo {
			w.nm(context.Background(), "connection", "delete", "uuid", clientUUID)
		}
		w.hotspot(context.Background(), "")
	}()
	return nil
}

// nmcli escapes colons and backslashes in terse output, including in SSIDs.
func splitNM(line string) []string {
	parts := []string{}
	var b strings.Builder
	escaped := false
	for _, r := range line {
		if escaped {
			b.WriteRune(r)
			escaped = false
		} else if r == '\\' {
			escaped = true
		} else if r == ':' {
			parts = append(parts, b.String())
			b.Reset()
		} else {
			b.WriteRune(r)
		}
	}
	parts = append(parts, b.String())
	return parts
}
func (w *WiFi) Scan(ctx context.Context) ([]Network, error) {
	if w.opts.Demo {
		return []Network{{"Home Wi-Fi", 92, "WPA2"}, {"Garden office", 58, "WPA2"}, {"Guest", 34, ""}}, nil
	}
	data, err := w.nm(ctx, "--wait", "10", "--terse", "--escape", "yes", "--fields", "SSID,SIGNAL,SECURITY", "device", "wifi", "list", "ifname", w.opts.Interface, "--rescan", "auto")
	if err != nil {
		return nil, errors.New("scanning is unavailable right now; enter the network name manually")
	}
	bySSID := map[string]Network{}
	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		p := splitNM(line)
		if len(p) != 3 || p[0] == "" || p[0] == "DepartureBoard" {
			continue
		}
		signal, _ := strconv.Atoi(p[1])
		n := Network{p[0], signal, p[2]}
		if old, ok := bySSID[n.SSID]; !ok || n.Signal > old.Signal {
			bySSID[n.SSID] = n
		}
	}
	networks := []Network{}
	for _, n := range bySSID {
		networks = append(networks, n)
	}
	sort.Slice(networks, func(i, j int) bool { return networks[i].Signal > networks[j].Signal })
	return networks, nil
}
