package live

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/davwheat/pi-departure-board/internal/live/pb"
	"github.com/davwheat/pi-departure-board/internal/model"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const testEpoch = "test-epoch"

var testTimings = timings{
	connect:     2 * time.Second,
	idle:        400 * time.Millisecond,
	resync:      150 * time.Millisecond,
	write:       time.Second,
	baseBackoff: 20 * time.Millisecond,
	maxBackoff:  100 * time.Millisecond,
}

// fakeService is a CIS service the test drives by hand: it hands each accepted connection to the test and
// relays every command the client sends.
type fakeService struct {
	server   *httptest.Server
	conns    chan *websocket.Conn
	commands chan *pb.ClientMessage
}

func newFakeService(t *testing.T) *fakeService {
	t.Helper()
	s := &fakeService{conns: make(chan *websocket.Conn, 8), commands: make(chan *pb.ClientMessage, 8)}
	s.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/cis/live" || r.URL.Query().Get("crs") != "TST" || r.URL.Query().Get("heartbeat") != "30" {
			t.Errorf("unexpected request %s", r.URL)
		}
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		s.conns <- conn
		for {
			kind, frame, err := conn.Read(r.Context())
			if err != nil {
				return
			}
			var command pb.ClientMessage
			if kind == websocket.MessageBinary && proto.Unmarshal(frame, &command) == nil {
				s.commands <- &command
			}
		}
	}))
	t.Cleanup(s.server.Close)
	return s
}

func (s *fakeService) send(t *testing.T, conn *websocket.Conn, message *pb.ServerMessage) {
	t.Helper()
	frame, err := proto.Marshal(message)
	if err != nil {
		t.Fatal(err)
	}
	if err := conn.Write(context.Background(), websocket.MessageBinary, frame); err != nil {
		t.Fatal(err)
	}
}

func (s *fakeService) accept(t *testing.T) *websocket.Conn {
	t.Helper()
	select {
	case conn := <-s.conns:
		return conn
	case <-time.After(3 * time.Second):
		t.Fatal("client did not connect")
		return nil
	}
}

func (s *fakeService) expectResync(t *testing.T) {
	t.Helper()
	select {
	case command := <-s.commands:
		if command.GetResync() == nil {
			t.Fatalf("unexpected command %v", command)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("client did not ask for a resync")
	}
}

func (s *fakeService) expectNoResync(t *testing.T, within time.Duration) {
	t.Helper()
	select {
	case command := <-s.commands:
		t.Fatalf("unexpected command %v", command)
	case <-time.After(within):
	}
}

func movementFrame(id, platform string, departs time.Time) *pb.Movement {
	return &pb.Movement{
		Id:        id,
		Rid:       "R1",
		Station:   &pb.Location{Tpl: "TEST", Crs: ptr("TST")},
		Kind:      pb.MovementKind_MOVEMENT_KIND_STOP,
		Mode:      pb.TransportMode_TRANSPORT_MODE_TRAIN,
		Passenger: true,
		Departure: &pb.Times{Planned: timestamppb.New(departs)},
		Platform:  &pb.Platform{Number: ptr(platform)},
		Destinations: []*pb.Endpoint{{
			Location: &pb.Location{Tpl: "DEST", Crs: ptr("DST"), Name: ptr("Destination")},
		}},
	}
}

func snapshotFrame(revision uint64, movements []*pb.Movement, overrides []*pb.PlatformOverride) *pb.ServerMessage {
	ordering := make([]string, len(movements))
	for i, movement := range movements {
		ordering[i] = movement.GetId()
	}
	return &pb.ServerMessage{Version: 2, Payload: &pb.ServerMessage_Snapshot{Snapshot: &pb.CisSnapshot{
		Station:   &pb.Location{Tpl: "TEST", Crs: ptr("TST")},
		Window:    &pb.Window{From: timestamppb.Now(), To: timestamppb.Now()},
		Epoch:     testEpoch,
		Revision:  revision,
		Movements: movements,
		Ordering:  ordering,
		Overrides: overrides,
	}}}
}

func updateFrame(previous, revision uint64, ordering []string) *pb.ServerMessage {
	return &pb.ServerMessage{Version: 2, Payload: &pb.ServerMessage_Update{Update: &pb.CisUpdate{
		Epoch:            testEpoch,
		PreviousRevision: previous,
		Revision:         revision,
		Window:           &pb.Window{From: timestamppb.Now(), To: timestamppb.Now()},
		Ordering:         ordering,
	}}}
}

func heartbeatFrame(revision uint64, digest string) *pb.ServerMessage {
	return &pb.ServerMessage{Version: 2, Payload: &pb.ServerMessage_Heartbeat{Heartbeat: &pb.Heartbeat{
		Epoch: ptr(testEpoch), Revision: ptr(revision), Digest: ptr(digest), SentAt: timestamppb.Now(),
	}}}
}

func expectView(t *testing.T, views <-chan model.View, connected bool, services int) model.View {
	t.Helper()
	select {
	case view := <-views:
		if view.Connected != connected || len(view.Services) != services {
			t.Fatalf("view connected=%v services=%d, want connected=%v services=%d", view.Connected, len(view.Services), connected, services)
		}
		return view
	case <-time.After(3 * time.Second):
		t.Fatal("no view emitted")
		return model.View{}
	}
}

func expectNoView(t *testing.T, views <-chan model.View, within time.Duration) {
	t.Helper()
	select {
	case view := <-views:
		t.Fatalf("unexpected view %+v", view)
	case <-time.After(within):
	}
}

func startClient(t *testing.T, service *fakeService, platforms []string) <-chan model.View {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	views := make(chan model.View, 32)
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = run(ctx, Config{BaseURL: service.server.URL, CRS: "tst", Platforms: platforms}, testTimings, func(view model.View) { views <- view })
	}()
	t.Cleanup(func() {
		cancel()
		<-done
	})
	return views
}

func TestClientResyncsOnGapAndDigestThenReplacesAnUnansweredConnection(t *testing.T) {
	service := newFakeService(t)
	views := startClient(t, service, nil)
	departs := time.Now().Add(time.Hour)
	conn := service.accept(t)

	service.send(t, conn, snapshotFrame(1, []*pb.Movement{movementFrame("R1/a", "2", departs)}, nil))
	expectView(t, views, true, 1)

	service.send(t, conn, updateFrame(99, 100, []string{"R1/a"}))
	expectView(t, views, false, 0)
	service.expectResync(t)
	service.send(t, conn, updateFrame(99, 100, []string{"R1/a"}))
	service.expectNoResync(t, 50*time.Millisecond)
	expectNoView(t, views, 10*time.Millisecond)

	service.send(t, conn, snapshotFrame(5, []*pb.Movement{movementFrame("R1/a", "2", departs)}, nil))
	expectView(t, views, true, 1)
	state := Reduce(nil, &Snapshot{Epoch: testEpoch, Revision: 5, Movements: []Movement{{ID: "R1/a"}}, Ordering: []string{"R1/a"}})
	service.send(t, conn, heartbeatFrame(5, state.Digest()))
	service.expectNoResync(t, 50*time.Millisecond)
	expectNoView(t, views, 10*time.Millisecond)

	service.send(t, conn, heartbeatFrame(5, "ffffffffffffffff"))
	service.expectResync(t)
	expectNoView(t, views, 10*time.Millisecond)
	service.expectResync(t)
	expectView(t, views, false, 0)

	next := service.accept(t)
	service.send(t, next, snapshotFrame(1, nil, nil))
	expectView(t, views, true, 0)
	expectNoView(t, views, 10*time.Millisecond)
}

func TestClientReplacesASilentConnectionAndOneSpeakingVersionOne(t *testing.T) {
	service := newFakeService(t)
	views := startClient(t, service, nil)

	conn := service.accept(t)
	service.send(t, conn, snapshotFrame(1, nil, nil))
	expectView(t, views, true, 0)
	expectView(t, views, false, 0)

	next := service.accept(t)
	if err := next.Write(context.Background(), websocket.MessageText, []byte(`{"version":1}`)); err != nil {
		t.Fatal(err)
	}
	expectNoView(t, views, 50*time.Millisecond)
	service.accept(t)
}

func TestClientReevaluatesOverrideWindowsAndReportsAlterations(t *testing.T) {
	service := newFakeService(t)
	views := startClient(t, service, []string{"2"})
	departs := time.Now().Add(time.Hour)
	conn := service.accept(t)

	warning := &pb.PlatformOverride{
		Id: "warn", Kind: pb.OverrideKind_OVERRIDE_KIND_STAND_CLEAR, Platform: "2",
		ActivatesAt: timestamppb.New(time.Now().Add(150 * time.Millisecond)),
		ExpiresAt:   timestamppb.New(time.Now().Add(300 * time.Millisecond)),
	}
	movement := movementFrame("R1/a", "2", departs)
	service.send(t, conn, snapshotFrame(1, []*pb.Movement{movement}, []*pb.PlatformOverride{warning}))
	if view := expectView(t, views, true, 1); view.Notice != model.NoNotice {
		t.Errorf("notice before activation = %v", view.Notice)
	}
	if view := expectView(t, views, true, 0); view.Notice != model.StandClear {
		t.Errorf("notice while active = %v", view.Notice)
	}
	if view := expectView(t, views, true, 1); view.Notice != model.NoNotice {
		t.Errorf("notice after expiry = %v", view.Notice)
	}
	expectNoView(t, views, 50*time.Millisecond)

	moved := movementFrame("R1/a", "5", departs)
	service.send(t, conn, &pb.ServerMessage{Version: 2, Payload: &pb.ServerMessage_Update{Update: &pb.CisUpdate{
		Epoch: testEpoch, PreviousRevision: 1, Revision: 2, Window: &pb.Window{From: timestamppb.Now(), To: timestamppb.Now()},
		Upserts: []*pb.Movement{moved}, Ordering: []string{"R1/a"},
	}}})
	if view := expectView(t, views, true, 0); len(view.Alterations) != 1 || view.Alterations[0] != "R1/a" {
		t.Errorf("alterations = %v", view.Alterations)
	}
	service.send(t, conn, updateFrame(2, 3, []string{"R1/a"}))
	if view := expectView(t, views, true, 0); len(view.Alterations) != 0 {
		t.Errorf("alterations must not persist: %v", view.Alterations)
	}
}
