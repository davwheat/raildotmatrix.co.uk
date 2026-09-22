// Command livedump connects to a station's live CIS stream and prints every view the board would draw, as a
// compact table. It's a smoke test for the internal/live package against a real service.
//
// Usage:
//
//	livedump -crs BTN [-platform 1 -platform 2] [-url wss://darwinbrowser.com] [-unconfirmed] [-legacy-toc]
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/davwheat/pi-departure-board/internal/live"
	"github.com/davwheat/pi-departure-board/internal/model"
)

// defaultURL is NEXT_PUBLIC_LIVE_SERVICE_URL in raildotmatrix.co.uk's .env.production.
const defaultURL = "wss://darwinbrowser.com"

type platformList []string

func (p *platformList) String() string     { return strings.Join(*p, ",") }
func (p *platformList) Set(v string) error { *p = append(*p, v); return nil }

func main() {
	var platforms platformList
	baseURL := flag.String("url", defaultURL, "service base URL; the client appends /v1/cis/live")
	crs := flag.String("crs", "", "station CRS code (required)")
	flag.Var(&platforms, "platform", "platform to watch; repeat for several. Omit for the whole station")
	unconfirmed := flag.Bool("unconfirmed", false, "show trains whose platform is unpublished or suppressed")
	legacy := flag.Bool("legacy-toc", false, "use the operator names of the boards' era")
	verbose := flag.Bool("v", false, "log connection events to stderr")
	flag.Parse()
	if *crs == "" {
		fmt.Fprintln(os.Stderr, "livedump: -crs is required")
		flag.Usage()
		os.Exit(2)
	}

	level := slog.LevelWarn
	if *verbose {
		level = slog.LevelDebug
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level}))
	zone, err := time.LoadLocation("Europe/London")
	if err != nil {
		zone = time.UTC
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	err = live.Run(ctx, live.Config{
		BaseURL:         *baseURL,
		CRS:             *crs,
		Platforms:       platforms,
		ShowUnconfirmed: *unconfirmed,
		LegacyTOCNames:  *legacy,
		Logger:          logger,
	}, func(view model.View) { printView(view, zone) })
	if err != nil && ctx.Err() == nil {
		fmt.Fprintln(os.Stderr, "livedump:", err)
		os.Exit(1)
	}
}

func printView(view model.View, zone *time.Location) {
	fmt.Printf("--- %s connected=%v notice=%s", time.Now().In(zone).Format("15:04:05"), view.Connected, noticeName(view.Notice))
	if len(view.Alterations) > 0 {
		fmt.Printf(" alterations=%s", strings.Join(view.Alterations, ","))
	}
	fmt.Println()
	for i, service := range view.Services {
		fmt.Printf("%2d  %s  %-40s  %-9s  %s\n", i+1, service.STD(zone), destination(service), service.ETD(zone), details(service))
	}
}

func destination(service model.Service) string {
	names := make([]string, len(service.Destinations))
	for i, destination := range service.Destinations {
		names[i] = destination.Name
		if destination.Via != "" {
			names[i] += " " + destination.Via
		}
	}
	return strings.Join(names, " & ")
}

func details(service model.Service) string {
	var parts []string
	if service.TOC != "" {
		parts = append(parts, service.TOC)
	}
	if service.Length > 0 {
		parts = append(parts, fmt.Sprintf("%d coaches", service.Length))
	}
	if service.TerminatesHere {
		parts = append(parts, "terminates")
	}
	if service.StartsHere {
		parts = append(parts, "starts here")
	}
	if len(service.CallPoints) > 0 {
		parts = append(parts, fmt.Sprintf("calls %d", len(service.CallPoints)))
	}
	for _, point := range service.CallPoints {
		for _, portion := range point.Divides {
			parts = append(parts, fmt.Sprintf("divides at %s (%d calls)", point.Name, len(portion.CallPoints)))
		}
	}
	if service.CancelReason != "" {
		parts = append(parts, service.CancelReason)
	} else if service.DelayReason != "" {
		parts = append(parts, service.DelayReason)
	}
	return strings.Join(parts, "; ")
}

func noticeName(notice model.Notice) string {
	switch notice {
	case model.StandClear:
		return "stand-clear"
	case model.NotForPublicUse:
		return "not-for-public-use"
	default:
		return "none"
	}
}
