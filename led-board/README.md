# LED departure board

UK railway departure boards for a 256x64 HUB75 LED matrix (two chained 128x64 panels) driven by a Raspberry
Pi, fed by the Darwin Browser live WebSocket stream. They're the Daktronics Data Display and Infotec boards of
raildotmatrix.co.uk, whose website, in [`../website`](../website), runs this same code as WebAssembly.

It was developed on a Pi Zero 2 W, which has little CPU to spare, so the renderer redraws only when a dot changes, allocates nothing in the steady state, and
hands each frame to the panel in a single call.

## Layout

| Path | Purpose |
|---|---|
| `cmd/board` | The app: connects to the feed and drives the panel. |
| `cmd/preview` | Renders fixture boards to PNG contact sheets on a desktop. |
| `cmd/livedump` | Prints the live feed for a station as a table. |
| `cmd/fontgen` | Regenerates the dot fonts in `internal/font` from their WOFF files. |
| `cmd/panel-test` | Draws a moving test pattern to check the panel wiring. |
| `cmd/wasm` | The boards for a web page, as a WebAssembly module with a small JavaScript API. |
| `cmd/webbundle` | Compresses the WebAssembly module with Zopfli and writes the bundle a website serves. |
| `internal/board` | What every board format shares: the `Board` interface, colours, and dot-level text drawing. |
| `internal/formats` | Builds a board format by name, for the panel, the preview tool and the web page alike. |
| `internal/daktronics` | The Daktronics Data Display DMI board: state machine and renderer. |
| `internal/infotec` | The Infotec landscape DMI board (the GTR-style board with a service information row): state machine and renderer. |
| `internal/live` | WebSocket client, protobuf decoding, state reducer and departure selection. |
| `internal/font` | The Data Display and Infotec text and clock dot fonts. |
| `internal/frame` | The RGB framebuffer and the `Display` interface every output implements. |
| `internal/matrix` | `Display` for the LED matrix over `rpi-rgb-led-matrix`, plus a PNG display. |
| `deploy` | systemd unit and example config file for the Pi. |

The renderer never talks to hardware. Anything that implements `frame.Display` can show the board, so a
different panel or an on-screen viewer is one small package.

The website's build runs `just web` to compile the boards for it; see
[docs/build.md](docs/build.md#building-for-the-web).

## Build and deploy

See [docs/build.md](docs/build.md). In short:

```sh
brew install go zig just
git submodule update --init third_party/rpi-rgb-led-matrix
just PI_HOST=pi@raspberrypi.local deploy
just PI_HOST=pi@raspberrypi.local install-service
```

To avoid repeating `PI_HOST`, put `PI_HOST=pi@raspberrypi.local` in a `local.env` file, which git ignores.

## Running on the Pi

The board reads `/etc/departure-board.toml`, or `departure-board.toml` in the working directory, or the file
named by `-config`. `deploy/departure-board.toml` is a commented example. `BOARD_*` environment variables
override the file (`BOARD_CRS=VIC`, `BOARD_LED_BRIGHTNESS=40`), and flags of the same names override both,
which is handy for trying a change. Stop the service first, because two copies driving the panel at once
fight over the GPIO:

```sh
sudo systemctl stop departure-board
sudo /opt/departure-board/board -config /etc/departure-board.toml -crs ECR
sudo /opt/departure-board/board -crs BTN -board daktronics -worldline -colour white
```

A config file isn't required; without one the board runs on its defaults and flags, but `crs` must be set
somewhere. Unknown keys in the file are an error, so a typo doesn't go unnoticed.

To try a board without the live feed, set `fixture` to one of the built-in examples, such as `busy-board`,
`cancelled`, `dividing-service`, `stand-clear` or `first-departs`; run the board with `-h` for the full list. The
board then shows that example instead of connecting, and `crs` isn't needed. An example that changes, such as a
first train departing, plays again every 20 seconds:

```sh
sudo /opt/departure-board/board -fixture first-departs -board infotec
```

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

`platform_position` adds each train's platform number to its row: `before` shows it ahead of the ordinal
(`Pl 1 1st`), and `after` shows it between the ordinal and the time (`1st Pl 1`). The column is wide enough
for a three-character platform such as `10A`, so the destination column narrows to make room. A platform that
isn't published, or that Darwin suppresses, leaves the column blank. The default, `none`, leaves it out.

`warning_platform` names the platform in a stand clear or not-for-public-use warning: "to call at platform 2"
in place of "to call at this station" on the Daktronics board, and "MAY NOT STOP AT PLATFORM 2" in place of
"MAY NOT STOP HERE" on the Infotec board. A warning that covers trains at several platforms at once keeps the
general wording.

`scroll_speed` sets how fast text scrolls, in dots per second. The defaults are 48 for Daktronics (the web
board's 550 px/s) and 60 for Infotec (the web's 77 dots/s reads too fast on the panel).

Unless `led.limit_refresh` or `led.pwm_bits` is set, the panel timing follows the board. The refresh rate is
the lowest whole multiple of the scroll speed from 60 Hz up, so that every scroll step lasts the same number
of refreshes, and the PWM bit depth is the most the panel manages at that rate: 11 bits at 60 Hz for Infotec,
8 bits at 96 Hz for Daktronics. The depth sets how many shades the panel can show, which is what fades and
the half-brightness separator need.

The panel defaults suit two chained 128x64 panels on a bare adapter board (`--led-rows=64 --led-cols=128
--led-chain=2 --led-slowdown-gpio=2 --led-pwm-lsb-nanoseconds=100`). If red and blue come out swapped, set
`rgb_sequence = "BGR"` in the `[led]` table; for a HAT, set `gpio_mapping`. Every `rpi-rgb-led-matrix` flag
is available under its usual name, and as a key in the `[led]` table without the `led-` prefix. Run
`/opt/departure-board/board -h` for the full list.

To start it at boot, run `just install-service` from the Mac. It installs `deploy/departure-board.service`
and, if the Pi has no config file yet, `deploy/departure-board.toml` as `/etc/departure-board.toml`, then
enables and starts the service. Set `crs` in the config afterwards. From then on, `just deploy` restarts the
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

`go generate ./internal/live` regenerates the protobuf code. It needs `protoc` and the protobuf-go-lite plugin:

```sh
go install github.com/aperturerobotics/protobuf-go-lite/cmd/protoc-gen-go-lite@v0.19.0
`go test` compares every board format, drawn through every fixture at the panel and web sizes and with each display
option, against the round-dot images in `internal/formats/testdata/golden`. They're ordinary PNGs, so a change to how
a board looks shows up as a reviewable image in the diff. A frame that doesn't match is written to
`build/golden-failures`. To rewrite the images after an intended change, run:

```sh
go test ./internal/formats -update
```

On GitHub, the board screenshots workflow rewrites them and commits any change to the branch under test.

```

The dot fonts are generated into `internal/font/data_gen.go`, which is checked in, so you only need the source
fonts to change them. To regenerate them with `go generate ./internal/font`, put
`DataDisplayDaktronicsDMIfont.woff`, `DataDisplayDaktronicsDMIClockfont.woff`, `ModernNationalRailPISTall.woff`,
and `subset-Dot_Matrix_Bold_Tall.woff` in `assets/fonts`. The repository doesn't include them.
