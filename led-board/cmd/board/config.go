package main

import (
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/fsnotify/fsnotify"
	"github.com/go-viper/mapstructure/v2"
	"github.com/spf13/viper"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/matrix"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/windowdisplay"
)

// configName is the config file looked for, without its extension, in the
// working directory and then /etc when -config isn't given.
const configName = "departure-board"

// config is every setting the board takes, in the shape of the config file.
type config struct {
	CRS                      string
	Fixture                  string
	Board                    string
	Colour                   string
	Worldline                bool
	RowPrefix                string `mapstructure:"row_prefix"`
	WarningPlatform          bool   `mapstructure:"warning_platform"`
	ScrollSpeed              int    `mapstructure:"scroll_speed"`
	URL                      string
	Platforms                []string
	ShowUnconfirmedPlatforms bool `mapstructure:"show_unconfirmed_platforms"`
	LegacyTOCNames           bool `mapstructure:"legacy_toc_names"`
	Display                  string
	PNGDir                   string `mapstructure:"png_dir"`
	Scale                    int
	FPS                      int
	Verbose                  bool
	LED                      ledConfig
}

// ledConfig is the [led] table. It spells the privilege drop the way the
// library's flag does, as its negation, and load folds it into Options.
type ledConfig struct {
	matrix.Options `mapstructure:",squash"`
	NoDropPrivs    bool `mapstructure:"no_drop_privs"`
}

// addFlags registers every setting as a flag on fs and returns the -config
// flag, which isn't a setting itself.
func addFlags(fs *flag.FlagSet) (configPath *string) {
	configPath = fs.String("config", "", "config file (default: "+configName+".toml in the working directory or /etc)")
	fs.String("crs", "", "station CRS code to show, such as BTN (required unless -fixture is set)")
	fs.String("fixture", "", "play a built-in example instead of the live feed: "+strings.Join(fixtures.Names, ", "))
	fs.String("url", "wss://darwinbrowser.com", "Darwin Browser base URL; /v1/cis/live is appended")
	fs.Var(&platformList{}, "platform", "platform to show; repeat for several (default: all)")
	fs.Bool("show-unconfirmed-platforms", false, "show trains whose platform isn't published yet")
	fs.Bool("legacy-toc-names", false, "use historic operator names")
	fs.String("board", "daktronics", "board format: daktronics or infotec")
	fs.String("colour", "amber", "text colour: amber or white")
	fs.String("row-prefix", "ordinals", "prefix before each train time: ordinals (\"1st\") or platforms (\"Pl 1\")")
	fs.Bool("warning-platform", false, "name the platform in a stand clear or not-for-public-use warning, in place of \"this station\"")
	fs.Bool("worldline", false, "Worldline-driven Daktronics board: single scrolling info line, capitalised locations")
	fs.Int("scroll-speed", 0, "scroll speed in dots per second; 0 uses the board's default (48 daktronics, 60 infotec). The panel refresh and PWM depth follow it")
	fs.Int("fps", 50, "animation tick rate")
	fs.Bool("v", false, "debug logging")
	fs.String("display", "matrix", "where to show the board: matrix, window, or png")
	fs.String("png-dir", "board-out", "directory that -display png writes frames to")
	fs.Int("scale", windowdisplay.DefaultScale, "pixels per LED for -display window and png")
	matrix.AddFlags(fs)
	limitRefresh := fs.Lookup("led-limit-refresh")
	limitRefresh.Usage = "cap the panel refresh rate in Hz; 0 for no cap (default: the board's own rate)"
	limitRefresh.DefValue = "0"
	pwmBits := fs.Lookup("led-pwm-bits")
	pwmBits.Usage = "PWM bits per colour (1-11) (default: the most the refresh rate allows)"
	pwmBits.DefValue = "0"
	return configPath
}

// configure returns the settings layered from weakest to strongest: the flag
// defaults, the config file, BOARD_* environment variables, and the flags
// given on the command line, which must already be parsed. path names the
// config file; when empty, the default locations are searched and a missing
// file is not an error.
func configure(fs *flag.FlagSet, path string) (*viper.Viper, error) {
	v := viper.NewWithOptions(viper.WithLogger(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))))
	v.SetConfigType("toml")
	if path != "" {
		v.SetConfigFile(path)
	} else {
		v.SetConfigName(configName)
		v.AddConfigPath(".")
		v.AddConfigPath("/etc")
	}
	v.SetEnvPrefix("board")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()
	bindFlags(v, fs)

	err := v.ReadInConfig()
	var notFound viper.ConfigFileNotFoundError
	if errors.As(err, &notFound) && path == "" {
		return v, nil
	}
	if err != nil {
		return nil, fmt.Errorf("config file: %w", err)
	}
	return v, nil
}

// boardChosen are the panel settings that follow the selected board unless
// the user sets them: the refresh rate and the PWM depth it allows.
var boardChosen = map[string]bool{"led-limit-refresh": true, "led-pwm-bits": true}

// bindFlags makes each flag on fs a layer of v under its config key, and its
// default the weakest layer. The flags in boardChosen have no default so that
// v.IsSet can tell whether the user chose a value.
func bindFlags(v *viper.Viper, fs *flag.FlagSet) {
	changed := map[string]bool{}
	fs.Visit(func(f *flag.Flag) { changed[f.Name] = true })
	fs.VisitAll(func(f *flag.Flag) {
		if controlFlag(f.Name) {
			return
		}
		fv := flagValue{f, changed[f.Name]}
		v.BindFlagValue(key(f.Name), fv)
		if !boardChosen[f.Name] {
			v.SetDefault(key(f.Name), fv.value())
		}
	})
}

// key returns the config key a flag maps to: the led-* flags form the led
// table, and the rest keep their names with underscores.
func key(flagName string) string {
	switch flagName {
	case "v":
		return "verbose"
	case "platform":
		return "platforms"
	}
	k := strings.ReplaceAll(flagName, "-", "_")
	if rest, ok := strings.CutPrefix(k, "led_"); ok {
		return "led." + rest
	}
	return k
}

// flagValue adapts a standard library flag to Viper, which otherwise only
// binds pflag flags. pflag reads -crs as the shorthands -c -r -s, so the
// board keeps the standard package and its single-dash flags.
type flagValue struct {
	flag    *flag.Flag
	changed bool
}

func (f flagValue) HasChanged() bool    { return f.changed }
func (f flagValue) Name() string        { return f.flag.Name }
func (f flagValue) ValueString() string { return f.flag.Value.String() }
func (f flagValue) value() any          { return f.flag.Value.(flag.Getter).Get() }

func (f flagValue) ValueType() string {
	switch f.value().(type) {
	case int:
		return "int"
	case bool:
		return "bool"
	case []string:
		return "stringSlice"
	default:
		return "string"
	}
}

// platformList collects repeated -platform flags.
type platformList []string

func (p *platformList) String() string     { return strings.Join(*p, ",") }
func (p *platformList) Set(v string) error { *p = append(*p, v); return nil }
func (p *platformList) Get() any           { return []string(*p) }

// load decodes the settings in v. Unknown keys are an error so that a typo in
// the config file is noticed rather than silently ignored.
func load(v *viper.Viper) (config, error) {
	var cfg config
	strict := func(c *mapstructure.DecoderConfig) { c.ErrorUnused = true }
	if err := v.Unmarshal(&cfg, strict); err != nil {
		return config{}, fmt.Errorf("config: %w", err)
	}
	cfg.CRS = strings.ToUpper(cfg.CRS)
	for i, p := range cfg.Platforms {
		cfg.Platforms[i] = strings.ToUpper(p)
	}
	cfg.LED.DropPrivileges = !cfg.LED.NoDropPrivs
	return cfg, nil
}

// watch reloads the config file whenever it changes and hands a new
// led.brightness to apply. Every other change needs a restart, which is
// logged. The watch is set up before the matrix opens: the privilege drop
// that follows leaves the inotify descriptor valid, and only the file itself
// must then be readable by user daemon.
func watch(v *viper.Viper, logger *slog.Logger, apply func(percent int)) {
	prev := settings(v)
	v.OnConfigChange(func(fsnotify.Event) {
		next := settings(v)
		for k, val := range next {
			if val == prev[k] {
				continue
			}
			if k == "led.brightness" {
				apply(v.GetInt(k))
			} else {
				logger.Warn("config changed; restart to apply", "key", k, "value", val)
			}
		}
		prev = next
	})
	v.WatchConfig()
}

// settings flattens the effective configuration, after every layer, so two
// snapshots can be compared key by key.
func settings(v *viper.Viper) map[string]string {
	m := make(map[string]string)
	for _, k := range v.AllKeys() {
		m[k] = fmt.Sprint(v.Get(k))
	}
	return m
}
