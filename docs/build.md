# Build and deploy

The board runs on a 64-bit Raspberry Pi; it was developed on a Pi Zero 2 W. You
build it on another machine: Go cross-compiles the Go code, and Zig acts as the
C and C++ cross compiler for the `rpi-rgb-led-matrix` library and for cgo. The
build is tested on macOS, and uses nothing but Go, Zig, and Make.

## Requirements

- Go 1.27 or later and Zig 0.16 or later. On macOS:

  ```sh
  brew install go zig
  ```

- The `rpi-rgb-led-matrix` submodule checked out:

  ```sh
  git submodule update --init
  ```

- A 64-bit Raspberry Pi OS (or another arm64 Debian) on the Pi, which you can
  reach over SSH as a user with passwordless `sudo`. The first user that
  Raspberry Pi Imager creates has it.

Every cross-compiled object targets glibc 2.41, the version in Debian 13, which
Raspberry Pi OS is based on. For an older image, set `ZIG_TARGET` to match its
glibc, for example `aarch64-linux-gnu.2.36` for Debian 12:

```sh
make deploy ZIG_TARGET=aarch64-linux-gnu.2.36
```

## Settings for your Pi

The deploy targets reach the Pi as `pi@raspberrypi.local` by default. To use a
different host or user, put the settings in a `local.mk` file next to the
`Makefile`. Git ignores it, and it takes precedence over the defaults:

```make
PI_HOST = board@departure-board.local
```

| Variable | Default | What it sets |
|---|---|---|
| `PI_HOST` | `pi@raspberrypi.local` | The SSH destination. |
| `SUDO` | `sudo` | The command that runs the install steps as root. Set it empty when `PI_HOST` logs in as root. |
| `SSH_OPTS` | none | Extra `ssh` options, such as `-o ControlPath=$(HOME)/.ssh/cm-pi` to reuse a ControlMaster connection when your key needs a touch for each login. |
| `BIN_DIR` | `/opt/departure-board` | Where the binaries are installed on the Pi. |
| `PANEL_TEST_FLAGS` | none | Extra flags for `make run-panel-test`, such as `-led-rgb-sequence=BGR`. |
| `ZIG_TARGET` | `aarch64-linux-gnu.2.41` | The target triple and glibc version to build for. |

You can also set any of them on the command line, such as
`make deploy PI_HOST=root@other-pi SUDO=`.

## Make targets

| Target | What it does |
|---|---|
| `make lib` | Compiles the LED matrix library into `build/lib/librgbmatrix.a`. Runs in parallel with `make -j`. |
| `make board` | Cross-compiles `cmd/board` into `build/board`. Builds the library first if needed. |
| `make panel-test` | Cross-compiles `cmd/panel-test` into `build/panel-test`. |
| `make deploy` | Builds the board, installs it as `BIN_DIR/board` on the Pi, and restarts the service if it's running. |
| `make install-service` | Installs the systemd unit and starts or restarts the service, and installs the example config as `/etc/departure-board.toml` if the Pi doesn't have one. |
| `make deploy-panel-test` | Builds `panel-test` and installs it as `BIN_DIR/panel-test` on the Pi. |
| `make run-panel-test` | Pauses the board service, runs the deployed `panel-test` for five seconds with a CPU snapshot from `top`, and then resumes the service. |
| `make clean` | Deletes the `build` directory. |

A first install is:

```sh
make -j8 lib
make deploy
make install-service
```

Then set `crs` and your panel settings in `/etc/departure-board.toml` on the Pi,
and run `sudo systemctl restart departure-board`.

The library only needs rebuilding when the submodule changes. The first Go
link takes a while and prints a large number of warnings: Zig compiles its own
libc++ for the target and caches it. Later links are quiet.

## How the library is compiled

The `Makefile` mirrors the object list and compiler flags from
`third_party/rpi-rgb-led-matrix/lib/Makefile`, with these differences:

- `-fPIC`, `-g`, and link-time optimization are omitted. The archive is
  linked statically into a stripped binary, so none of them help.
- `-march=native` is omitted because the host isn't the target.
- The `DEFAULT_HARDWARE` define is `"regular"`, the wiring of a bare adapter
  board. For a HAT or bonnet, set `led.gpio_mapping` in the config file, such
  as `adafruit-hat`.

## Deploying

Minimal images can lack `scp` and `sftp-server`, so `make deploy` streams the
binary through a plain `ssh` session and then renames it into place. The
rename is atomic, so the running board keeps its old binary until the service
restarts.

## Testing the panels

`panel-test` draws a moving pattern and prints the frame rate that `Swap`
sustains. To run it on the Pi for five seconds, pausing the board service
meanwhile:

```sh
make deploy-panel-test
make run-panel-test
```

It accepts the same `-led-*` flags as the library's own examples, such as
`-led-brightness` and `-led-pwm-bits`, plus `-seconds`. Pass them in
`PANEL_TEST_FLAGS`.

## Checking the code off the Pi

The matrix driver only compiles for `linux/arm64` with cgo. Elsewhere, the
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
