package management

import (
	"context"
	"encoding/json"
	"errors"
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
