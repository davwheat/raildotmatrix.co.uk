# Build and deploy

The board runs on a Raspberry Pi Zero 2 W, but you build it on macOS. Go
cross-compiles the Go code, and Zig acts as the C and C++ cross compiler for
the `rpi-rgb-led-matrix` library and for cgo.

## Requirements

- macOS with Homebrew.
- Go 1.27 or later and Zig 0.16 or later:

  ```sh
  brew install go zig
  ```

- The `rpi-rgb-led-matrix` submodule checked out:

  ```sh
  git submodule update --init
  ```

- For deployment, an SSH ControlMaster session to the Pi at the socket
  `/Users/david/.ssh/cm-pi`. The `make deploy` target reuses that session, so
  it never prompts for a password.

The Pi runs Debian 13 with glibc 2.41, so every cross-compiled object targets
`aarch64-linux-gnu.2.41`. To target a different glibc, set `ZIG_TARGET` when
you run `make`.

## Make targets

| Target | What it does |
|---|---|
| `make lib` | Compiles the LED matrix library into `build/lib/librgbmatrix.a`. Runs in parallel with `make -j`. |
| `make board` | Cross-compiles `cmd/board` into `build/board`. Builds the library first if needed. |
| `make panel-test` | Cross-compiles `cmd/panel-test` into `build/panel-test`. |
| `make deploy` | Builds the board and copies it to `/root/board` on the Pi. |
| `make deploy-panel-test` | Builds `panel-test` and copies it to `/root/panel-test` on the Pi. |
| `make run-panel-test` | Runs the deployed `panel-test` for five seconds and prints a CPU snapshot from `top` while it draws. |
| `make clean` | Deletes the `build` directory. |

A typical cycle is:

```sh
make -j8 lib
make deploy
```

The library only needs rebuilding when the submodule changes. The first Go
link takes a while and prints a large number of warnings: Zig compiles its own
libc++ for the target and caches it. Later links are quiet.

## How the library is compiled

The `Makefile` mirrors the object list and compiler flags from
`third_party/rpi-rgb-led-matrix/lib/Makefile`, with these differences:

- `-fPIC`, `-g`, and link-time optimization are omitted. The archive is
  linked statically into a stripped binary, so none of them help.
- `-march=native` is omitted because the host isn't the target.
- The `DEFAULT_HARDWARE` define is `"regular"`, matching the wiring of this
  board.

## Deploying

The Pi's image has neither `scp` nor `sftp-server`, so `make deploy` streams
the binary through a plain `ssh` session and then renames it into place. Set
`PI_HOST` to deploy somewhere else:

```sh
make deploy PI_HOST=root@other-pi
```

## Testing the panels

`panel-test` draws a moving pattern and prints the frame rate that `Swap`
sustains. To run it on the Pi for five seconds:

```sh
make deploy-panel-test
make run-panel-test
```

It accepts the same `-led-*` flags as the library's own examples, such as
`-led-brightness` and `-led-pwm-bits`, plus `-seconds`.

## Checking the code on macOS

The matrix driver only compiles for `linux/arm64` with cgo. On macOS, the
package falls back to a stub whose `Open` returns an error, so `go vet` and
`go test` work natively:

```sh
go vet ./...
go test ./...
```

To render frames without panels, use the `internal/matrix/pngdisplay`
package, which writes each swapped frame as a PNG.

## Running on a desktop

The `-display` flag of `cmd/board` selects where the board is shown:

| Value | What it does |
|---|---|
| `matrix` | Drives the LED panels. This is the default and only works on the Pi. |
| `window` | Opens a desktop window that draws each LED as a round dot. Press Esc or close the window to quit. |
| `png` | Writes every frame as a numbered PNG into the `-png-dir` directory (default `board-out`). |

The `-scale` flag sets the number of pixels per LED for `window` and `png`
(default 5). The board size comes from the `-led-*` flags, so the layout
matches the real panel. To watch live departures for Brighton in a window:

```sh
go run ./cmd/board -display window -crs BTN
```

The window is provided by [Ebitengine](https://ebitengine.org), which is only
compiled on non-Linux builds. The cross-compiled Pi binary uses a stub, so
`-display window` fails there with an error.
