# Pi departure board

A Daktronics Data Display style railway departure board for a 256x64 HUB75 LED matrix (two chained 128x64
panels) driven by a Raspberry Pi Zero 2 W. It is a port of the Data Display board from
[raildotmatrix.co.uk](https://github.com/davwheat/raildotmatrix.co.uk), fed by the Darwin Browser live
WebSocket stream.

The Pi is slow, so the renderer redraws only when a dot changes, allocates nothing in the steady state, and
hands each frame to the panel in a single call.

## Layout

| Path | Purpose |
|---|---|
| `cmd/board` | The app: connects to the feed and drives the panel. |
| `cmd/preview` | Renders fixture boards to PNG contact sheets on a desktop. |
| `cmd/livedump` | Prints the live feed for a station as a table. |
| `cmd/fontgen` | Regenerates the dot fonts from the FontStruct WOFF files. |
| `cmd/panel-test` | Draws a moving test pattern to check the panel wiring. |
| `internal/board` | What every board format shares: the `Board` interface, colours, and dot-level text drawing. |
| `internal/daktronics` | The Daktronics Data Display DMI board: state machine and renderer. |
| `internal/infotec` | The Infotec landscape DMI board (the GTR-style board with a service information row): state machine and renderer. |
| `internal/live` | WebSocket client, protobuf decoding, state reducer and departure selection. |
| `internal/font` | The Data Display and Infotec text and clock dot fonts. |
| `internal/frame` | The RGB framebuffer and the `Display` interface every output implements. |
| `internal/matrix` | `Display` for the LED matrix over `rpi-rgb-led-matrix`, plus a PNG display. |
| `deploy` | systemd unit and example config file for the Pi. |

The renderer never talks to hardware. Anything that implements `frame.Display` can show the board, so a
different panel or an on-screen viewer is one small package.

## Build and deploy

See [docs/build.md](docs/build.md). In short:

```sh
brew install go zig
git submodule update --init
make -j8 lib
make deploy
```

## Running on the Pi

The board reads `/etc/departure-board.toml`, or `departure-board.toml` in the working directory, or the file
named by `-config`. `deploy/departure-board.toml` is a commented example. `BOARD_*` environment variables
override the file (`BOARD_CRS=VIC`, `BOARD_LED_BRIGHTNESS=40`), and flags of the same names override both,
which is handy for a quick change of station:

```sh
/root/board -config /etc/departure-board.toml -crs ECR
/root/board -crs BTN -board daktronics -worldline -colour white
```

A config file isn't required; without one the board runs on its defaults and flags, but `crs` must be set
somewhere. Unknown keys in the file are an error, so a typo doesn't go unnoticed.

The board watches its config file. A change to `led.brightness` takes effect straight away; any other change
is logged and needs a restart. The board drops to user `daemon` once the panel is running, so the file must
be readable by everyone.

`board` selects the format and `colour` the text colour (`amber` or `white`):

- `daktronics` (the default) is the Daktronics Data Display board: four rows of trains with a calling-point
  line that scrolls behind a prefix.
- `infotec` is the Infotec landscape DMI, the board GTR stations use: the next train with a service
  information row beneath it, a separator, the 2nd and 3rd trains taking turns on one row, and a large
  HH:MM:SS clock.

`worldline` applies to the Daktronics board only.

`scroll_speed` sets how fast text scrolls, in dots per second. The defaults are 48 for Daktronics (the web
board's 550 px/s) and 60 for Infotec (the web's 77 dots/s reads too fast on the panel).

Unless `led.limit_refresh` or `led.pwm_bits` is set, the panel timing follows the board. The refresh rate is
the lowest whole multiple of the scroll speed from 60 Hz up, so that every scroll step lasts the same number
of refreshes, and the PWM bit depth is the most the panel manages at that rate: 11 bits at 60 Hz for Infotec,
8 bits at 96 Hz for Daktronics. The depth sets how many shades the panel can show, which is what fades and
the half-brightness separator need.

The panel defaults match this hardware (`--led-rows=64 --led-cols=128 --led-chain=2 --led-slowdown-gpio=2
--led-rgb-sequence=BGR --led-pwm-lsb-nanoseconds=100`); every `rpi-rgb-led-matrix` flag is available under
its usual name, and as a key in the `[led]` table without the `led-` prefix. Run `/root/board -h` for the
full list.

To start it at boot, run `make install-service` from the Mac. It installs `deploy/departure-board.service`
and, if the Pi has no config file yet, `deploy/departure-board.toml` as `/etc/departure-board.toml`, then
enables and starts the service. Set `crs` in the config afterwards. From then on, `make deploy` restarts the
service with the new binary, and the board's log is in the journal:

```sh
journalctl -u departure-board -f
systemctl restart departure-board
```

## Development

```sh
go test ./...
go run ./cmd/preview -fixture busy-board -seconds 20 -out /tmp/preview
go run ./cmd/preview -board daktronics -worldline -fixture dividing-service -out /tmp/preview
go run ./cmd/preview -board infotec -fixture first-departs -seconds 6 -every 0.1 -out /tmp/preview
go run ./cmd/livedump -crs BTN
```

`go generate ./...` regenerates the fonts and the protobuf code. It needs `protoc` and `protoc-gen-go`.
