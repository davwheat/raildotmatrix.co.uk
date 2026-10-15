// Command manage serves the offline departure board UI and manages its Wi-Fi.
//
// Its subcommands change the system as root, outside the manager's sandbox:
//
//	manage apply                  install the staged update, or roll back an interrupted one
//	manage bootstrap -from DIR    give a board flashed with v0.0.0-alpha.1 an updater
//	manage verify-installed       check that the installed files match the installed manifest
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/management"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/update"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/version"
)

const (
	defaultConfig   = "/boot/firmware/departure-board.toml"
	defaultStateDir = "/var/lib/departure-board"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "apply", "bootstrap", "verify-installed":
			if err := system(os.Args[1], os.Args[2:]); err != nil {
				log.Fatal(err)
			}
			return
		}
	}
	var o management.Options
	flag.StringVar(&o.ConfigPath, "config", defaultConfig, "board config file")
	flag.StringVar(&o.BoardBinary, "board", update.BoardPath, "board executable")
	flag.StringVar(&o.StateDir, "state-dir", defaultStateDir, "private settings directory")
	flag.StringVar(&o.StatusPath, "status", "/run/departure-board/network.json", "matrix setup status")
	flag.StringVar(&o.Interface, "interface", "wlan0", "Wi-Fi adapter")
	flag.StringVar(&o.UpdateRepo, "update-repo", "davwheat/raildotmatrix.co.uk", "GitHub repository to update from")
	flag.BoolVar(&o.Demo, "demo", false, "simulate networking and service control, and store SSH keys locally")
	listen := flag.String("listen", ":80", "HTTP listen address")
	showVersion := flag.Bool("version", false, "print the version and exit")
	flag.Parse()
	if *showVersion {
		fmt.Println(version.String())
		return
	}
	s, err := management.New(o)
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	s.Start(ctx)
	httpServer := &http.Server{Addr: *listen, Handler: s.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 60 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16384}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		httpServer.Shutdown(shutdown)
	}()
	log.Printf("Departure Board management %s: http://%s", version.String(), *listen)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func system(command string, args []string) error {
	fs := flag.NewFlagSet(command, flag.ExitOnError)
	in := update.Installer{Key: update.PublicKey(), Run: management.Run, Settle: 20 * time.Second}
	fs.StringVar(&in.StateDir, "state-dir", defaultStateDir, "private settings directory")
	fs.StringVar(&in.ConfigPath, "config", defaultConfig, "board config file")
	from := fs.String("from", "", "bootstrap: directory holding board, manage and departure-board-update.service")
	fs.Parse(args)
	ctx := context.Background()
	switch command {
	case "apply":
		return in.Apply(ctx)
	case "bootstrap":
		if *from == "" {
			return fmt.Errorf("bootstrap needs -from")
		}
		return in.Bootstrap(ctx, *from)
	default:
		return in.VerifyInstalled()
	}
}
