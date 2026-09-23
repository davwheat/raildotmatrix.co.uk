package main

import (
	"flag"
	"fmt"
	"net/url"
	"slices"
	"strings"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/configschema"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/fixtures"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/formats"
)

func describeConfig(fs *flag.FlagSet) []configschema.Field {
	choices := map[string][]string{
		"board": formats.Names, "colour": {"amber", "white"},
		"ordinal_format":   {"suffix", "dot"},
		"row_prefix":       {"ordinals", "platforms"},
		"display":          {"matrix", "window", "png"},
		"fixture":          append([]string{""}, fixtures.Names...),
		"led.rgb_sequence": {"RGB", "RBG", "GRB", "GBR", "BRG", "BGR"},
	}
	var fields []configschema.Field
	fs.VisitAll(func(f *flag.Flag) {
		if controlFlag(f.Name) {
			return
		}
		value := flagValue{flag: f}
		fields = append(fields, configschema.Field{
			Key: key(f.Name), Type: value.ValueType(), Help: f.Usage,
			Default: value.value(), Choices: choices[key(f.Name)], Automatic: boardChosen[f.Name],
		})
	})
	return fields
}

func controlFlag(name string) bool {
	return name == "config" || name == "config-schema" || name == "check-config" || name == "setup-status"
}

// Check before opening hardware, both for normal starts and GUI edits.
func validateConfig(c config) error {
	if c.ServiceCount < 1 || c.ServiceCount > 6 {
		return fmt.Errorf("service count must be between 1 and 6")
	}
	if c.OrdinalFormat != "suffix" && c.OrdinalFormat != "dot" {
		return fmt.Errorf("ordinal format must be suffix or dot")
	}
	if c.CRS != "" && (len(c.CRS) != 3 || strings.Trim(c.CRS, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") != "") {
		return fmt.Errorf("station must be a three-letter CRS code, or empty for setup")
	}
	if !slices.Contains(formats.Names, c.Board) {
		return fmt.Errorf("unknown board %q", c.Board)
	}
	if c.Fixture != "" && !slices.Contains(fixtures.Names, c.Fixture) {
		return fmt.Errorf("unknown fixture %q", c.Fixture)
	}
	if c.FPS < 1 || c.FPS > 240 || c.Scale < 1 || c.Scale > 50 || c.ScrollSpeed < 0 || c.ScrollSpeed > 1000 {
		return fmt.Errorf("FPS must be 1–240, scale 1–50, and scroll speed 0–1000")
	}
	u, err := url.Parse(c.URL)
	if err != nil || u.Host == "" || (u.Scheme != "ws" && u.Scheme != "wss") {
		return fmt.Errorf("feed URL must start with ws:// or wss:// and include a host")
	}
	o := c.LED
	if o.Rows < 8 || o.Rows > 64 || o.Rows%2 != 0 || o.Cols < 16 || o.Cols > 1024 || o.Chain < 1 || o.Chain > 64 || o.Parallel < 1 || o.Parallel > 3 || o.Cols*o.Chain > 4096 {
		return fmt.Errorf("invalid panel geometry: even rows 8–64, columns 16–1024, chains 1–64, parallel 1–3, total width at most 4096")
	}
	if o.Brightness < 1 || o.Brightness > 100 || o.PWMBits < 0 || o.PWMBits > 11 || o.LimitRefreshRateHz < 0 || o.LimitRefreshRateHz > 1000 {
		return fmt.Errorf("brightness must be 1–100, PWM bits 0–11, and refresh limit 0–1000")
	}
	if (o.PWMLSBNanoseconds != 0 && (o.PWMLSBNanoseconds < 50 || o.PWMLSBNanoseconds > 3000)) || o.PWMDitherBits < 0 || o.PWMDitherBits > 2 || o.RowAddrType < 0 || o.RowAddrType > 5 || o.ScanMode < 0 || o.ScanMode > 1 || o.GPIOSlowdown < 0 || o.GPIOSlowdown > 4 || o.Multiplexing < 0 {
		return fmt.Errorf("invalid advanced panel timing or addressing settings")
	}
	if !slices.Contains([]string{"RGB", "RBG", "GRB", "GBR", "BRG", "BGR"}, o.RGBSequence) {
		return fmt.Errorf("RGB sequence must be a permutation of RGB")
	}
	return nil
}
