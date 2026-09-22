// Package live is the client for Darwin Browser's station CIS stream, protocol version 2. It keeps a WebSocket
// connection to the service, folds the snapshot and update deltas into a local state, and reduces that state to
// the model.View a departure board draws. It's a port of the "Live WebSocket feed" client in raildotmatrix.co.uk's
// src/live.
package live

// The schema is copied from darwin-browser's proto/darwin/live/v2/live.proto. Its go_package option names the
// server's package, so the import path is supplied on the command line instead of edited into the proto.
//
// protoc-gen-go-lite generates marshalling code that needs no runtime reflection, which keeps the WebAssembly
// build of the boards about a fifth smaller than google.golang.org/protobuf does. Only the features the client
// uses are generated.
//
//go:generate protoc -I ../../proto --go-lite_out=../.. --go-lite_opt=features=marshal+unmarshal+size --go-lite_opt=module=github.com/davwheat/raildotmatrix.co.uk/led-board --go-lite_opt=Mdarwin/live/v2/live.proto=github.com/davwheat/raildotmatrix.co.uk/led-board/internal/live/pb;pb --go-lite_opt=Mgoogle/protobuf/timestamp.proto=github.com/aperturerobotics/protobuf-go-lite/types/known/timestamppb --go-lite_opt=Mgoogle/protobuf/duration.proto=github.com/aperturerobotics/protobuf-go-lite/types/known/durationpb ../../proto/darwin/live/v2/live.proto
