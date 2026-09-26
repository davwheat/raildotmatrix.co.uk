// Command manage serves the offline departure board UI and manages its Wi-Fi.
package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/management"
)

func main() {
	var o management.Options
	flag.StringVar(&o.ConfigPath, "config", "/boot/firmware/departure-board.toml", "board config file")
	flag.StringVar(&o.BoardBinary, "board", "/opt/departure-board/board", "board executable")
	flag.StringVar(&o.StateDir, "state-dir", "/var/lib/departure-board", "private settings directory")
	flag.StringVar(&o.StatusPath, "status", "/run/departure-board/network.json", "matrix setup status")
	flag.StringVar(&o.Interface, "interface", "wlan0", "Wi-Fi adapter")
	flag.BoolVar(&o.Demo, "demo", false, "simulate networking and service control, and store SSH keys locally")
	listen := flag.String("listen", ":80", "HTTP listen address")
	flag.Parse()
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
	log.Printf("Departure Board management: http://%s", *listen)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
