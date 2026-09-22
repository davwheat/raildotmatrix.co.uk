// Package live is the client for Darwin Browser's station CIS stream, protocol version 2. It keeps a WebSocket
// connection to the service, folds the snapshot and update deltas into a local state, and reduces that state to
// the model.View a departure board draws. It's a port of the "Live WebSocket feed" client in raildotmatrix.co.uk's
// src/live, and the .pb fixtures it's tested against are frames the service's own encoder wrote.
package live

// The schema is copied from darwin-browser's proto/darwin/live/v2/live.proto. Its go_package option names the
// server's package, so the import path is supplied on the command line instead of edited into the proto.
//
//go:generate protoc -I ../../proto --go_out=../.. --go_opt=module=github.com/davwheat/pi-departure-board --go_opt=Mdarwin/live/v2/live.proto=github.com/davwheat/pi-departure-board/internal/live/pb;pb ../../proto/darwin/live/v2/live.proto
