package main

import (
	"flag"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/spf13/viper"

	"github.com/davwheat/led-departure-board/internal/matrix"
)

func parse(t *testing.T, args ...string) *flag.FlagSet {
	t.Helper()
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	addFlags(fs)
	if err := fs.Parse(args); err != nil {
		t.Fatal(err)
	}
	return fs
}

func writeConfig(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "departure-board.toml")
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestDefaults(t *testing.T) {
	t.Chdir(t.TempDir())
	v, err := configure(parse(t), "")
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := load(v)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Board != "daktronics" || cfg.Colour != "amber" || cfg.Display != "matrix" || cfg.FPS != 50 || cfg.URL != "wss://darwinbrowser.com" {
		t.Errorf("defaults = %+v", cfg)
	}
	if cfg.CRS != "" || len(cfg.Platforms) != 0 {
		t.Errorf("crs %q, platforms %v; want none", cfg.CRS, cfg.Platforms)
	}
	if cfg.LED.Options != *matrix.Default() {
		t.Errorf("led = %+v, want %+v", cfg.LED.Options, *matrix.Default())
	}
	for _, k := range []string{"led.limit_refresh", "led.pwm_bits"} {
		if v.IsSet(k) {
			t.Errorf("%s should be unset", k)
		}
	}
}

const testConfig = `
crs = "gtw"
board = "infotec"
platforms = ["1", "2"]
scroll_speed = 40

[led]
brightness = 40
limit_refresh = 100
no_drop_privs = true
no_hardware_pulse = true
pwm_lsb_nanoseconds = 130
`

func TestFile(t *testing.T) {
	v, err := configure(parse(t), writeConfig(t, testConfig))
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := load(v)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.CRS != "GTW" || cfg.Board != "infotec" || cfg.ScrollSpeed != 40 {
		t.Errorf("file values not applied: %+v", cfg)
	}
	if !slices.Equal(cfg.Platforms, []string{"1", "2"}) {
		t.Errorf("platforms = %v", cfg.Platforms)
	}
	led := cfg.LED.Options
	if led.Brightness != 40 || led.LimitRefreshRateHz != 100 || led.PWMLSBNanoseconds != 130 || !led.DisableHardwarePulse {
		t.Errorf("led = %+v", led)
	}
	if led.DropPrivileges {
		t.Error("no_drop_privs = true should clear DropPrivileges")
	}
	if led.Rows != 64 || led.RGBSequence != "RGB" {
		t.Errorf("defaults lost under the led table: %+v", led)
	}
	if !v.IsSet("led.limit_refresh") {
		t.Error("led.limit_refresh should be set by the file")
	}
}

func TestPrecedence(t *testing.T) {
	t.Setenv("BOARD_CRS", "vic")
	t.Setenv("BOARD_LED_BRIGHTNESS", "70")
	t.Setenv("BOARD_PLATFORMS", "3,4")
	t.Setenv("BOARD_WORLDLINE", "true")
	fs := parse(t, "-crs", "ecr", "-platform", "5", "-platform", "6b", "-led-no-drop-privs")
	v, err := configure(fs, writeConfig(t, testConfig))
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := load(v)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.CRS != "ECR" {
		t.Errorf("crs = %q; the flag should beat env and file", cfg.CRS)
	}
	if !slices.Equal(cfg.Platforms, []string{"5", "6B"}) {
		t.Errorf("platforms = %v; the flags should beat env and file", cfg.Platforms)
	}
	if cfg.LED.Brightness != 70 {
		t.Errorf("led.brightness = %d; env should beat the file", cfg.LED.Brightness)
	}
	if !cfg.Worldline {
		t.Error("worldline should come from env")
	}
	if cfg.Board != "infotec" || cfg.LED.LimitRefreshRateHz != 100 {
		t.Errorf("file values lost: %+v", cfg)
	}
	if cfg.LED.DropPrivileges {
		t.Error("-led-no-drop-privs should clear DropPrivileges")
	}
}

func TestEnvSetsLimitRefresh(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("BOARD_LED_LIMIT_REFRESH", "0")
	v, err := configure(parse(t), "")
	if err != nil {
		t.Fatal(err)
	}
	if !v.IsSet("led.limit_refresh") || v.GetInt("led.limit_refresh") != 0 {
		t.Error("an explicit 0 should count as set")
	}
}

func TestFlagSetsLimitRefresh(t *testing.T) {
	t.Chdir(t.TempDir())
	v, err := configure(parse(t, "-led-limit-refresh", "0"), "")
	if err != nil {
		t.Fatal(err)
	}
	if !v.IsSet("led.limit_refresh") {
		t.Error("an explicit -led-limit-refresh 0 should count as set")
	}
}

func TestBadFiles(t *testing.T) {
	for name, body := range map[string]string{
		"malformed":   "crs = \"BTN\"\n[led\n",
		"unknown key": "crs = \"BTN\"\n[led]\nbrightnes = 5\n",
		"wrong type":  "crs = \"BTN\"\nfps = \"fast\"\n",
	} {
		t.Run(name, func(t *testing.T) {
			v, err := configure(parse(t), writeConfig(t, body))
			if err == nil {
				_, err = load(v)
			}
			if err == nil {
				t.Fatal("want an error")
			}
		})
	}
	if _, err := configure(parse(t), filepath.Join(t.TempDir(), "missing.toml")); err == nil {
		t.Error("a -config file that doesn't exist should be an error")
	}
}

func TestKeys(t *testing.T) {
	fs := parse(t)
	var keys []string
	fs.VisitAll(func(f *flag.Flag) {
		if f.Name != "config" {
			keys = append(keys, key(f.Name))
		}
	})
	want := strings.Fields(`board colour crs display fps legacy_toc_names led.brightness led.chain led.cols
		led.gpio_mapping led.limit_refresh led.multiplexing led.no_drop_privs led.no_hardware_pulse led.parallel
		led.pwm_bits led.pwm_dither_bits led.pwm_lsb_nanoseconds led.rgb_sequence led.row_addr_type led.rows
		led.scan_mode led.show_refresh led.slowdown_gpio platforms png_dir scale scroll_speed
		show_unconfirmed_platforms url verbose worldline`)
	slices.Sort(keys)
	slices.Sort(want)
	if !slices.Equal(keys, want) {
		t.Errorf("keys = %v\nwant %v", keys, want)
	}
}

func TestSettingsCoverEveryKey(t *testing.T) {
	t.Chdir(t.TempDir())
	v, err := configure(parse(t), "")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := settings(v)["led.limit_refresh"]; !ok {
		t.Error("a key without a default must still be watched")
	}
	if got := len(v.AllKeys()); got != 32 {
		t.Errorf("%d keys, want 32", got)
	}
}

var _ viper.FlagValue = flagValue{}
