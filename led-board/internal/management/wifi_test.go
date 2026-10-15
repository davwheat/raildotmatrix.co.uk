package management

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/setupdisplay"
)

func TestHotspotClientDetection(t *testing.T) {
	dump := ""
	path := filepath.Join(t.TempDir(), "network.json")
	w := NewWiFi(Options{Interface: "wlan0", StatusPath: path, Run: func(_ context.Context, name string, args ...string) ([]byte, error) {
		if name != "iw" || !reflect.DeepEqual(args, []string{"dev", "wlan0", "station", "dump"}) {
			t.Fatalf("unexpected command: %s %v", name, args)
		}
		return []byte(dump), nil
	}})
	for _, count := range []int{0, 1, 2, 1, 0} {
		dump = strings.Repeat("Station 00:11:22:33:44:55 (on wlan0)\n\tinactive time: 10 ms\n\tauthorized: yes\n", count)
		w.set("hotspot", "DepartureBoard", "")
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		var state setupdisplay.Status
		if err = json.Unmarshal(data, &state); err != nil {
			t.Fatal(err)
		}
		if state.Clients != count || w.Status().Clients != count {
			t.Fatalf("got %d clients, want %d", state.Clients, count)
		}
		want := "Connect to DepartureBoard"
		state.IPs = []string{"192.168.4.1"}
		if count > 0 {
			want = "Setup available"
		}
		if setupdisplay.Lines(state)[0] != want {
			t.Fatalf("wrong instructions for %d devices", count)
		}
	}
}

func TestStatusWritesOnlyChangesAndRetries(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "network.json")
	w := NewWiFi(Options{Demo: true, StateDir: dir, StatusPath: path})
	w.set("hotspot", "DepartureBoard", "")
	first, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	for range 20 {
		w.set("hotspot", "DepartureBoard", "")
	}
	unchanged, err := os.Stat(path)
	if err != nil || !os.SameFile(first, unchanged) {
		t.Fatalf("stable status rewrote the file: %v", err)
	}
	w.set("connected", "Home", "")
	changed, err := os.Stat(path)
	if err != nil || os.SameFile(unchanged, changed) {
		t.Fatalf("changed status was not written: %v", err)
	}
	// Recreate a removed status, and do not cache an unsuccessful write as published.
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	w.set("connected", "Home", "")
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path, 0755); err != nil {
		t.Fatal(err)
	}
	w.set("connected", "New network", "") // rename over a directory fails
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	w.set("connected", "New network", "")
	data, err := os.ReadFile(path)
	if err != nil || !strings.Contains(string(data), "New network") {
		t.Fatalf("failed status was not retried: %s, %v", data, err)
	}
}

func TestFailedSavedNetworkRestoresHotspot(t *testing.T) {
	dir := t.TempDir()
	var commands []string
	w := NewWiFi(Options{Interface: "wlan0", StatusPath: filepath.Join(dir, "network.json"), Run: func(_ context.Context, name string, args ...string) ([]byte, error) {
		cmd := name + " " + strings.Join(args, " ")
		commands = append(commands, cmd)
		if strings.Contains(cmd, clientUUID) {
			return nil, errors.New("connection timed out")
		}
		return nil, nil
	}})
	w.profile = filepath.Join(dir, "client.nmconnection")
	if err := os.WriteFile(w.profile, []byte("saved profile"), 0600); err != nil {
		t.Fatal(err)
	}
	w.restore(context.Background())
	if s := w.Status(); s.Mode != "hotspot" || s.Message == "" {
		t.Fatalf("no recovery: %+v", s)
	}
	if !strings.Contains(strings.Join(commands, "\n"), "connection up uuid "+hotspotUUID) {
		t.Fatal("hotspot was not reactivated")
	}
}

func fakeNM(t *testing.T, device *string, up error) (*WiFi, *[]string) {
	t.Helper()
	var commands []string
	w := NewWiFi(Options{Interface: "wlan0", StatusPath: filepath.Join(t.TempDir(), "network.json"), Run: func(_ context.Context, name string, args ...string) ([]byte, error) {
		cmd := name + " " + strings.Join(args, " ")
		switch {
		case strings.Contains(cmd, "GENERAL.STATE,GENERAL.CON-UUID"):
			return []byte(*device), nil
		case strings.Contains(cmd, "connection up"):
			commands = append(commands, cmd)
			if up != nil {
				return []byte("Error: Timeout expired (15 seconds)"), up
			}
		}
		return nil, nil
	}})
	w.profile = filepath.Join(t.TempDir(), "missing.nmconnection")
	return w, &commands
}

func TestPollLeavesActivatingHotspotAlone(t *testing.T) {
	for _, tc := range []struct {
		name, device, mode string
		reactivated        bool
	}{
		{"activating", "70 (connecting (getting IP configuration))\n" + hotspotUUID + "\n", "starting", false},
		{"activating on one line", "50 (connecting (configuring)):" + hotspotUUID + "\n", "starting", false},
		{"activated", "100 (connected)\n" + hotspotUUID + "\n", "hotspot", false},
		{"dropped", "30 (disconnected)\n\n", "hotspot", true},
		{"failed", "120 (connection failed)\n" + hotspotUUID + "\n", "hotspot", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w, commands := fakeNM(t, &tc.device, nil)
			w.poll(context.Background())
			if s := w.Status(); s.Mode != tc.mode {
				t.Fatalf("got mode %q, want %q", s.Mode, tc.mode)
			}
			if reactivated := len(*commands) > 0; reactivated != tc.reactivated {
				t.Fatalf("reactivated = %t, want %t: %q", reactivated, tc.reactivated, *commands)
			}
		})
	}
}

func TestSlowHotspotIsStartingNotUnavailable(t *testing.T) {
	var logged bytes.Buffer
	log.SetOutput(&logged)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })
	device := "70 (connecting (getting IP configuration))\n" + hotspotUUID + "\n"
	w, _ := fakeNM(t, &device, errors.New("exit status 3"))
	w.hotspot(context.Background(), "")
	if s := w.Status(); s.Mode != "starting" {
		t.Fatalf("got mode %q, want starting", s.Mode)
	}
	device = "30 (disconnected)\n\n"
	w.hotspot(context.Background(), "")
	w.hotspot(context.Background(), "")
	if s := w.Status(); s.Mode != "unavailable" {
		t.Fatalf("got mode %q, want unavailable", s.Mode)
	}
	if got := strings.Count(logged.String(), "start the setup hotspot: exit status 3: Error: Timeout expired (15 seconds)"); got != 1 {
		t.Fatalf("logged the repeated failure %d times, want once:\n%s", got, logged.String())
	}
}

func TestSlowSavedNetworkKeepsConnecting(t *testing.T) {
	var commands []string
	device := "70 (connecting (getting IP configuration))\n" + clientUUID + "\n"
	w := NewWiFi(Options{Interface: "wlan0", StatusPath: filepath.Join(t.TempDir(), "network.json"), Run: func(_ context.Context, name string, args ...string) ([]byte, error) {
		cmd := name + " " + strings.Join(args, " ")
		switch {
		case strings.Contains(cmd, "GENERAL.STATE,GENERAL.CON-UUID"):
			return []byte(device), nil
		case strings.Contains(cmd, "802-11-wireless.ssid"):
			return []byte("Home\n"), nil
		case strings.Contains(cmd, "connection up uuid "+clientUUID):
			commands = append(commands, cmd)
			return []byte("Error: Timeout expired (30 seconds)"), errors.New("exit status 3")
		case strings.Contains(cmd, "connection up"):
			commands = append(commands, cmd)
		}
		return nil, nil
	}})
	w.profile = filepath.Join(t.TempDir(), "client.nmconnection")
	if err := os.WriteFile(w.profile, []byte("saved profile"), 0600); err != nil {
		t.Fatal(err)
	}
	w.restore(context.Background())
	w.poll(context.Background())
	if s := w.Status(); s.Mode != "connecting" || len(commands) != 1 {
		t.Fatalf("interrupted a slow join: %+v, %q", s, commands)
	}

	device = "100 (connected)\n" + clientUUID + "\n"
	w.poll(context.Background())
	if s := w.Status(); s.Mode != "connected" || s.SSID != "Home" || len(commands) != 1 {
		t.Fatalf("slow join did not finish: %+v, %q", s, commands)
	}

	device = "70 (connecting (getting IP configuration))\n" + clientUUID + "\n"
	w.restore(context.Background())
	device = "120 (connection failed)\n\n"
	w.poll(context.Background())
	if s := w.Status(); s.Mode != "hotspot" || s.Message == "" {
		t.Fatalf("failed join did not return to the hotspot: %+v", s)
	}
	if last := commands[len(commands)-1]; !strings.Contains(last, hotspotUUID) {
		t.Fatalf("retried the failed network instead of the hotspot: %q", commands)
	}
}

func TestMissingAdapterLogsEachFailureOnce(t *testing.T) {
	var logged bytes.Buffer
	log.SetOutput(&logged)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })
	w := NewWiFi(Options{Interface: "wlan0", StatusPath: filepath.Join(t.TempDir(), "network.json"), Run: func(context.Context, string, ...string) ([]byte, error) {
		return []byte("Error: Device 'wlan0' not found."), errors.New("exit status 10")
	}})
	w.profile = filepath.Join(t.TempDir(), "missing.nmconnection")
	for range 3 {
		w.poll(context.Background())
	}
	for _, action := range []string{"read Wi-Fi state", "start the setup hotspot"} {
		if got := strings.Count(logged.String(), action+":"); got != 1 {
			t.Fatalf("logged %q %d times, want once:\n%s", action, got, logged.String())
		}
	}
}

func TestScanEscapingAndDeduplication(t *testing.T) {
	w := NewWiFi(Options{Run: func(context.Context, string, ...string) ([]byte, error) {
		return []byte("Home\\: office:42:WPA2\nHome\\: office:92:WPA2\nBack\\\\room:60:WPA2\nGuest:30:\nDepartureBoard:100:WPA2\n:10:WPA2\n"), nil
	}})
	got, err := w.Scan(context.Background())
	want := []Network{{"Home: office", 92, "WPA2"}, {"Back\\room", 60, "WPA2"}, {"Guest", 30, ""}}
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v, %v; want %+v", got, err, want)
	}
}

func TestNetworkProfileValidation(t *testing.T) {
	for _, input := range []NetworkInput{
		{SSID: "", Password: "12345678", Country: "GB"},
		{SSID: strings.Repeat("x", 33), Password: "12345678", Country: "GB"},
		{SSID: "Home", Password: "short", Country: "GB"},
		{SSID: "Home", Password: "12345678", Country: "G1"},
		{SSID: "Home", Password: "12345678", Country: "GB", Open: true},
	} {
		if _, err := profile(input, "wlan0"); err == nil {
			t.Fatalf("accepted invalid input %+v", input)
		}
	}
	data, err := profile(NetworkInput{SSID: " Home\\office\n[wifi]", Password: "eight+ chars", Country: "GB", Hidden: true}, "wlan0")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(string(data), "\n[wifi]\n") != 1 || !strings.Contains(string(data), "ssid=\\sHome\\\\office\\n[wifi]\n") || !strings.Contains(string(data), "hidden=true") {
		t.Fatalf("unsafe profile: %s", data)
	}
	data, err = profile(NetworkInput{SSID: "Guest", Country: "GB", Open: true}, "wlan0")
	if err != nil || strings.Contains(string(data), "wifi-security") {
		t.Fatalf("invalid open network profile: %s, %v", data, err)
	}
}
