package live

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"runtime"
	"slices"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/model"
)

// HeartbeatSeconds is the heartbeat cadence asked of the service. It sends one only after this much silence.
const HeartbeatSeconds = 30

// Config is what Run needs to watch one station.
type Config struct {
	// BaseURL is the service's base URL. HTTP(S) is converted to WS(S) and a path prefix is preserved.
	BaseURL string
	CRS     string
	// Platforms lists the platforms the board watches. Empty means the whole station.
	Platforms       []string
	ShowUnconfirmed bool
	LegacyTOCNames  bool
	// MaxServices limits the projected view, leaving the protocol state and platform alterations intact.
	MaxServices int
	// Logger is optional. Nil discards the log.
	Logger *slog.Logger
}

// timings are the deadlines the client keeps. Tests shorten them.
type timings struct {
	// connect bounds the handshake and the wait for the first message.
	connect time.Duration
	// idle is two missed heartbeats plus slack, matching the server's own pong deadline.
	idle time.Duration
	// resync is how long an unanswered resync request waits before it's repeated, then given up on.
	resync      time.Duration
	write       time.Duration
	baseBackoff time.Duration
	maxBackoff  time.Duration
}

var defaultTimings = timings{
	connect:     20 * time.Second,
	idle:        75 * time.Second,
	resync:      20 * time.Second,
	write:       10 * time.Second,
	baseBackoff: time.Second,
	maxBackoff:  30 * time.Second,
}

// A frame the service could send is far smaller than this; the cap bounds a misbehaving peer.
const maxFrameBytes = 5_000_000

// Run connects to the station's CIS stream and keeps reconnecting until ctx is done. It calls emit, always from
// the goroutine that called Run, whenever the displayed view changes: on a snapshot or update, when an override
// activates or expires or a reported arrival time passes, and when the connection is lost or a revision gap
// opens, both of which show as Connected false with no services. Alterations are set only on the view emitted
// for the update that caused them.
func Run(ctx context.Context, cfg Config, emit func(model.View)) error {
	return run(ctx, cfg, defaultTimings, emit)
}

func run(ctx context.Context, cfg Config, t timings, emit func(model.View)) error {
	target, err := StreamURL(cfg)
	if err != nil {
		return err
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.New(slog.DiscardHandler)
	}
	b := &board{
		log:      cfg.Logger.With("crs", cfg.CRS),
		emit:     emit,
		opts:     Options{Platforms: cfg.Platforms, ShowUnconfirmed: cfg.ShowUnconfirmed, LegacyTOCNames: cfg.LegacyTOCNames, MaxServices: cfg.MaxServices},
		timings:  t,
		boundary: time.NewTimer(time.Hour),
	}
	b.boundary.Stop()

	attempts := 0
	for {
		b.log.Info("connecting", "url", target.Redacted(), "attempt", attempts)
		received, err := b.connect(ctx, target.String())
		if err != nil {
			b.log.Warn("connection ended", "error", err)
		}
		b.reset()
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if received {
			attempts = 0
		}
		delay := t.maxBackoff
		if attempts < 16 {
			delay = min(t.maxBackoff, t.baseBackoff<<attempts)
		}
		attempts++
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}
}

func StreamURL(cfg Config) (*url.URL, error) {
	target, err := url.Parse(cfg.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("live: parsing service URL: %w", err)
	}
	switch target.Scheme {
	case "https", "wss":
		target.Scheme = "wss"
	case "http", "ws":
		target.Scheme = "ws"
	default:
		return nil, errors.New("live: use an HTTP or WebSocket service URL")
	}
	target.Path = strings.TrimSuffix(target.Path, "/") + "/v1/cis/live"
	target.RawPath = ""
	target.Fragment = ""
	query := url.Values{"crs": {strings.ToUpper(cfg.CRS)}, "heartbeat": {fmt.Sprint(HeartbeatSeconds)}}
	// The service filters by platform as well, so a board watching two of twenty platforms isn't sent the other
	// eighteen. Display still applies the same rules: this narrows the payload, it doesn't replace the policy.
	if len(cfg.Platforms) > 0 {
		platforms := make([]string, len(cfg.Platforms))
		for i, platform := range cfg.Platforms {
			platforms[i] = strings.ToUpper(platform)
		}
		slices.Sort(platforms)
		query.Set("platform", strings.Join(platforms, ","))
		if cfg.ShowUnconfirmed {
			query.Set("include_unconfirmed", "true")
		}
	}
	target.RawQuery = query.Encode()
	return target, nil
}

// board owns the state and the emitted view. Everything in it runs on Run's goroutine.
type board struct {
	log     *slog.Logger
	emit    func(model.View)
	opts    Options
	timings timings

	state *State
	// connected is whether the last emitted view was connected, so that a loss is announced once.
	connected bool
	// boundary fires when an override window or a reported arrival time changes the view without a message.
	boundary *time.Timer
}

type inbound struct {
	message Message
	err     error
}

// connect runs one connection to its end and reports whether it delivered any readable frame.
func (b *board) connect(ctx context.Context, target string) (received bool, err error) {
	dialCtx, cancelDial := context.WithTimeout(ctx, b.timings.connect)
	defer cancelDial()
	conn, _, err := websocket.Dial(dialCtx, target, nil)
	if err != nil {
		return false, err
	}
	conn.SetReadLimit(maxFrameBytes)

	sessionCtx, endSession := context.WithCancel(ctx)
	defer endSession()
	frames := make(chan inbound)
	go b.read(sessionCtx, conn, frames)

	// Replacing the socket blanks the board, so an unanswered resync is asked again before giving up on a
	// connection that is otherwise healthy.
	waiting, retried := false, false
	response := time.NewTimer(time.Hour)
	response.Stop()
	defer response.Stop()
	request := func() error {
		writeCtx, cancelWrite := context.WithTimeout(sessionCtx, b.timings.write)
		defer cancelWrite()
		if err := conn.Write(writeCtx, websocket.MessageBinary, EncodeResync()); err != nil {
			return fmt.Errorf("live: requesting resync: %w", err)
		}
		response.Reset(b.timings.resync)
		return nil
	}
	resync := func() error {
		if waiting {
			return nil
		}
		waiting, retried = true, false
		b.log.Info("requesting resync")
		return request()
	}

	defer closeConn(conn)
	for {
		select {
		case <-ctx.Done():
			return received, nil
		case in := <-frames:
			if in.err != nil {
				return received, in.err
			}
			received = true
			switch m := in.message.(type) {
			case nil:
			case *Heartbeat:
				// Divergence leaves the board on stale data rather than blank: it keeps what it has until the
				// authoritative snapshot lands.
				if b.state != nil && !b.state.Attested(m) {
					if err := resync(); err != nil {
						return received, err
					}
				}
			case *Snapshot:
				waiting = false
				response.Stop()
				b.apply(m)
			case *Update:
				b.apply(m)
				if b.state == nil {
					if err := resync(); err != nil {
						return received, err
					}
				}
			default:
				return received, fmt.Errorf("live: unexpected %s message on the CIS stream", in.message.messageType())
			}
		case <-response.C:
			if retried {
				return received, errors.New("live: resync went unanswered")
			}
			retried = true
			b.log.Warn("resync unanswered, asking again")
			if err := request(); err != nil {
				return received, err
			}
		case <-b.boundary.C:
			if b.state != nil {
				b.publish(nil)
			}
		}
	}
}

// closeConn ends a connection without waiting on the peer. A browser only lets a page close a WebSocket with
// code 1000 or 3000-4999, so CloseNow's 1001 fails there and leaves the socket open. The browser port also waits
// for the closing handshake, so the normal closure it accepts is sent from its own goroutine.
func closeConn(conn *websocket.Conn) {
	if runtime.GOOS == "js" {
		go conn.Close(websocket.StatusNormalClosure, "")
		return
	}
	conn.CloseNow()
}

// read delivers decoded frames until the connection or the session ends. Each read is bounded by the idle
// deadline: a half-open connection reports no error and delivers nothing, and only the frames the server sends,
// heartbeats included, prove it's alive.
func (b *board) read(ctx context.Context, conn *websocket.Conn, frames chan<- inbound) {
	deliver := func(in inbound) bool {
		select {
		case frames <- in:
			return true
		case <-ctx.Done():
			return false
		}
	}
	deadline := b.timings.connect
	for {
		readCtx, cancel := context.WithTimeout(ctx, deadline)
		kind, frame, err := conn.Read(readCtx)
		cancel()
		if err != nil {
			if ctx.Err() == nil && errors.Is(err, context.DeadlineExceeded) {
				err = fmt.Errorf("live: no message within %s", deadline)
			}
			deliver(inbound{err: err})
			return
		}
		deadline = b.timings.idle
		if kind != websocket.MessageBinary {
			// Version 2 frames are protobuf. A text frame is a version 1 service, which this build can't read.
			deliver(inbound{err: errors.New("live: text frame from a version 1 service")})
			return
		}
		message, err := Decode(frame)
		if err != nil {
			deliver(inbound{err: err})
			return
		}
		if !deliver(inbound{message: message}) {
			return
		}
	}
}

func (b *board) apply(message Message) {
	previous := b.state
	b.state = Reduce(previous, message)
	if b.state == nil {
		b.log.Warn("revision gap, board cleared until the snapshot arrives")
		b.publish(nil)
		return
	}
	b.publish(PlatformAlterations(previous, b.state, b.opts.Platforms))
}

// reset discards the state when a connection ends. A lost connection clears the board until a fresh snapshot
// arrives.
func (b *board) reset() {
	b.state = nil
	b.publish(nil)
}

// publish emits the view of the current state, and arms the timer for the next moment the view changes on its
// own. A disconnected view is emitted once, when the connection is lost.
func (b *board) publish(alterations []string) {
	b.boundary.Stop()
	select {
	case <-b.boundary.C:
	default:
	}
	if b.state == nil {
		if b.connected {
			b.connected = false
			b.emit(model.View{})
		}
		return
	}
	now := time.Now()
	view := Display(b.state, b.opts, now)
	view.Alterations = alterations
	if next := NextBoundary(b.state, b.opts, now); !next.IsZero() {
		b.boundary.Reset(next.Sub(now))
	}
	b.connected = true
	b.log.Debug("view", "revision", b.state.Revision, "services", len(view.Services), "notice", view.Notice, "alterations", len(alterations))
	b.emit(view)
}
