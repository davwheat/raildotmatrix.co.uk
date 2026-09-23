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

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/matrix"
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
	if !cfg.AlignPlatformRows {
		t.Error("platform row alignment must default to on")
	}
	if cfg.RowPrefix != "ordinals" {
		t.Errorf("row prefix = %q; want ordinals by default", cfg.RowPrefix)
	}
	if cfg.FormationCount != "none" {
		t.Errorf("formation count = %q; want none by default", cfg.FormationCount)
	}
	if cfg.SmallScrollingText {
		t.Error("scrolling text must use the normal font by default")
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
row_prefix = "platforms"
platform_box = true
align_platform_rows = false
formation_count = "coaches"
scroll_speed = 40
small_scrolling_text = true

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
	if cfg.AlignPlatformRows {
		t.Error("explicitly disabled platform row alignment was ignored")
	}
	if !cfg.PlatformBox {
		t.Error("platform_box option was not loaded")
	}
	if !cfg.SmallScrollingText {
		t.Error("small_scrolling_text option was not loaded")
	}
	if cfg.FormationCount != "coaches" {
		t.Errorf("formation count = %q; want coaches from file", cfg.FormationCount)
	}
	if cfg.RowPrefix != "platforms" {
		t.Errorf("row prefix = %q; want platforms from the file", cfg.RowPrefix)
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
	t.Setenv("BOARD_ROW_PREFIX", "platforms")
	t.Setenv("BOARD_SMALL_SCROLLING_TEXT", "false")
	fs := parse(t, "-crs", "ecr", "-platform", "5", "-platform", "6b", "-row-prefix", "ordinals", "-align-platform-rows=true", "-led-no-drop-privs", "-small-scrolling-text")
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
	if !cfg.SmallScrollingText {
		t.Error("small scrolling text flag should override the environment")
	}
	if !cfg.AlignPlatformRows {
		t.Error("platform row alignment must default to on")
	}
	if cfg.RowPrefix != "ordinals" {
		t.Errorf("row prefix = %q; the flag should beat env and file", cfg.RowPrefix)
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
	want := strings.Fields(`board colour coach_letter_tocs formation_icons crs display fixture fps legacy_toc_names led.brightness led.chain led.cols
		led.gpio_mapping led.limit_refresh led.multiplexing led.no_drop_privs led.no_hardware_pulse led.parallel
		led.pwm_bits led.pwm_dither_bits led.pwm_lsb_nanoseconds led.rgb_sequence led.row_addr_type led.rows
		led.scan_mode led.show_refresh led.slowdown_gpio align_platform_rows compact_lower_row loading_brightness formation_count clock_style ordinal_format service_count platform_box row_prefix platforms png_dir scale scroll_speed
		show_unconfirmed_platforms small_scrolling_text url verbose warning_platform worldline`)
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
	if got := len(v.AllKeys()); got != 46 {
		t.Errorf("%d keys, want 46", got)
	}
}

func TestCoachLetterTOCsConfig(t *testing.T) {
	for _, tc := range []struct {
		name, file, env string
		flags           []string
		want            []string
	}{
		{name: "defaults", want: []string{"VT", "GR", "GW", "LD", "LF", "GC", "HT", "SR", "AW", "EM"}},
		{name: "file replaces defaults", file: `coach_letter_tocs = ["sn", " se "]`, want: []string{"SN", "SE"}},
		{name: "empty file list", file: `coach_letter_tocs = []`, want: []string{}},
		{name: "env replaces file", file: `coach_letter_tocs = ["SN"]`, env: " gw,gr ", want: []string{"GW", "GR"}},
		{name: "flag replaces env", file: `coach_letter_tocs = ["SN"]`, env: "GW,GR", flags: []string{"-coach-letter-tocs", " vt,em "}, want: []string{"VT", "EM"}},
		{name: "empty flag", file: `coach_letter_tocs = ["SN"]`, env: "GW,GR", flags: []string{"-coach-letter-tocs="}, want: []string{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("BOARD_COACH_LETTER_TOCS", tc.env)
			v, err := configure(parse(t, tc.flags...), writeConfig(t, tc.file))
			if err != nil {
				t.Fatal(err)
			}
			cfg, err := load(v)
			if err != nil {
				t.Fatal(err)
			}
			if cfg.CoachLetterTOCs == nil || !slices.Equal(cfg.CoachLetterTOCs, tc.want) {
				t.Fatalf("coach letter TOCs = %#v, want %#v", cfg.CoachLetterTOCs, tc.want)
			}
		})
	}
	for _, field := range describeConfig(parse(t)) {
		if field.Key == "coach_letter_tocs" {
			if field.Type != "stringSlice" || !slices.Equal(field.Default.([]string), []string{"VT", "GR", "GW", "LD", "LF", "GC", "HT", "SR", "AW", "EM"}) {
				t.Fatalf("coach letter TOCs schema = %+v", field)
			}
			return
		}
	}
	t.Fatal("coach letter TOCs missing from management schema")
}

func TestFormationCountConfig(t *testing.T) {
	for _, style := range []string{"none", "number", "coaches", "coaches-no-brackets", "carriages", "carriages-no-brackets", "invalid", "number-no-brackets"} {
		t.Run(style, func(t *testing.T) {
			t.Setenv("BOARD_FORMATION_COUNT", "number")
			v, err := configure(parse(t, "-formation-count", style), writeConfig(t, testConfig))
			if err != nil {
				t.Fatal(err)
			}
			cfg, err := load(v)
			if err != nil {
				t.Fatal(err)
			}
			if cfg.FormationCount != style {
				t.Fatalf("formation count = %q, want flag %q", cfg.FormationCount, style)
			}
			if err := validateConfig(cfg); (err != nil) != (style == "invalid" || style == "number-no-brackets") {
				t.Fatalf("validation for %q: %v", style, err)
			}
		})
	}
	for _, field := range describeConfig(parse(t)) {
		if field.Key == "formation_count" {
			if !slices.Equal(field.Choices, []string{"none", "number", "coaches", "coaches-no-brackets", "carriages", "carriages-no-brackets"}) {
				t.Fatalf("formation count choices = %v", field.Choices)
			}
			return
		}
	}
	t.Fatal("formation count missing from management schema")
}

func TestFormationIconsConfig(t *testing.T) {
	defaults := []string{"accessibility", "cycles", "toilets", "food", "first-class"}
	for _, tc := range []struct {
		name, file, env string
		flags           []string
		want            []string
		invalid         bool
	}{
		{name: "defaults", want: defaults},
		{name: "file replaces defaults", file: `formation_icons = ["Accessibility", " cycles "]`, want: []string{"accessibility", "cycles"}},
		{name: "empty file list", file: `formation_icons = []`, want: []string{}},
		{name: "env replaces file", file: `formation_icons = ["toilets"]`, env: " food,first-class ", want: []string{"food", "first-class"}},
		{name: "flag replaces env", file: `formation_icons = ["toilets"]`, env: "food", flags: []string{"-formation-icons", " accessibility,cycles "}, want: []string{"accessibility", "cycles"}},
		{name: "empty flag", env: "toilets", flags: []string{"-formation-icons="}, want: []string{}},
		{name: "unknown icon", file: `formation_icons = ["toilet"]`, want: []string{"toilet"}, invalid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("BOARD_FORMATION_ICONS", tc.env)
			v, err := configure(parse(t, tc.flags...), writeConfig(t, tc.file))
			if err != nil {
				t.Fatal(err)
			}
			cfg, err := load(v)
			if err != nil {
				t.Fatal(err)
			}
			if cfg.FormationIcons == nil || !slices.Equal(cfg.FormationIcons, tc.want) {
				t.Fatalf("formation icons = %#v, want %#v", cfg.FormationIcons, tc.want)
			}
			if err := validateConfig(cfg); (err != nil) != tc.invalid {
				t.Fatalf("validation: %v, want invalid = %v", err, tc.invalid)
			}
		})
	}
	for _, field := range describeConfig(parse(t)) {
		if field.Key == "formation_icons" {
			if field.Type != "stringSlice" || !slices.Equal(field.Default.([]string), defaults) {
				t.Fatalf("formation icons schema = %+v", field)
			}
			return
		}
	}
	t.Fatal("formation icons missing from management schema")
}

var _ viper.FlagValue = flagValue{}
