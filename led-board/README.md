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

For a ready-to-flash SD card, download the artifact from the **DietPi image** GitHub Actions workflow.
It starts the board and a **DepartureBoard** Wi-Fi hotspot (password **DotMatrix**). Join it and open
**http://192.168.4.1** to set up Wi-Fi and edit every board setting. Once connected to your network, use
**http://departureboard.local**. The config also remains at the root of the card as `departure-board.toml`.
See [the DietPi image instructions](docs/build.md#dietpi-sd-card-image).

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

`row_prefix` selects the single prefix before each train's scheduled time: `ordinals` (the default) shows
`1st`, `2nd` or `3rd`, and `platforms` shows the platform number, such as `Pl 1`. The platform column is wide
enough for a three-character platform such as `10A`. A platform that isn't published, or that Darwin
suppresses, leaves the prefix blank. Platform numbers and ordinals are never shown together in a row.

`warning_platform` names the platform in a stand clear or not-for-public-use warning: "to call at platform 2"
in place of "to call at this station" on the Daktronics board, and "MAY NOT STOP AT PLATFORM 2" in place of
"MAY NOT STOP HERE" on the Infotec board. A warning that covers trains at several platforms at once keeps the
general wording.

`platform_box` replaces the first Infotec train's row prefix with a box showing "Plat" and a larger platform
number. With exactly one requested platform the box stays fixed to that platform. With multiple platforms
or no filter, it follows the first service, retaining the outgoing service's platform during its slide-out.
The box stays fully lit when consecutive services use the same platform. An unknown or suppressed platform leaves the number blank. The website offers the same option in Infotec
settings. The lower train row uses the selected `row_prefix`.

The platform number uses the "Large Platform Number" face from `../tools/font.json`. Regenerate its native
dot patterns with `python3 scripts/import-platform-font.py ../tools/font.json internal/font/infotec_platform_gen.go`.
The import removes the one shared blank row above the glyphs so the six-dot label gap stays exact.
The label and number are vertically centred together inside the platform box at every box height.
Three-character platforms use one-dot character spacing and three blank dots of horizontal padding on
each side; other platforms use two-dot character spacing and four blank dots of padding.

`align_platform_rows` (default `true`) aligns the lower row's time with the first service and centres its
prefix beneath the platform box. The compact row uses its normal spacing before the destination;
the full-size row also aligns destinations. Turn it off to keep the lower row's original columns and
left-aligned prefix. It only affects Infotec displays with an active platform box. The website settings
and Pi management UI expose the same toggle; the CLI flag is `-align-platform-rows=false`.

`compact_lower_row` (default `true`) places the lower service row beside a small clock when the platform
box is enabled, with the row and clock vertically centred between the separator and the bottom edge.
Disable it to put the main clock beneath the row. Both clocks use the corresponding
"Clock" and "Small Clock" faces in `tools/font.json`; the compact service text uses "Small main row".
Run `python3 scripts/import-clock-fonts.py ../tools/font.json internal/font/infotec_clocks_gen.go` to regenerate the clocks.

`clock_style` selects `normal`, `small-seconds`, or `small` (small everything). The small-seconds
layout displays HH:MM followed by small seconds with a gap and no second colon. The compact service row
reserves four dots between its expected-time text and the clock.

`ordinal_format` selects `suffix` (`1st`, `2nd`, `3rd`) or `dot` (`1.`, `2.`, `3.`), defaulting to `suffix`.
`service_count` selects how many Infotec services to show, from 1 to 6 (default 3). The first stays on the main
row while the bottom row rotates through services 2 to the selected limit. These settings are also available
in the website settings and Pi management UI.

Infotec boards also draw a train formation below the service information whenever the websocket supplies a
positive coach count or detailed formation. Each outlined carriage represents one coach; an unknown count leaves the diagram out.
`formation_count` selects `none` (the default), `number` (`(n)`), `coaches` (`(n coaches)`),
`coaches-no-brackets` (`n coaches`), `carriages` (`(n carriages)`), or `carriages-no-brackets` (`n carriages`).
The label sits four dots after the last coach, with its bottom aligned
to the graphic. Wording falls back to `(n)` when it cannot fit. Long formations narrow their coaches
to leave room for the number. The website and Pi management UI offer the same Formation count setting.
When details are available, all coaches share five-second pages: identifiers, loading, then facilities.
`coach_letter_tocs` limits the identifier page to the listed TOC codes, defaulting to
`["VT", "GR", "GW", "LD", "LF", "GC", "HT", "SR", "AW", "EM"]`. Other operators (including unknown ones)
skip that page, while loading and facilities remain visible. Set `coach_letter_tocs = []` to hide all coach letters.
The Pi management UI exposes this list; `-coach-letter-tocs VT,GR` and `BOARD_COACH_LETTER_TOCS=VT,GR`
override it. The browser uses the same defaults and accepts a `coachLetterTocs` array.
Loading fills the interior from the floor upwards in proportion to the percentage at `loading_brightness` (50 or 100 percent, default 50). The website offers the same Loading fill brightness setting.
Unknown loads remain hollow. Facility pages use the "Small formation contents" font: `§` for accessibility,
`#` for cycles, `±` for toilets, `€` for food and `1st` for first class (including mixed-class coaches). Standard class is implicit.
Coaches with fewer facilities hold their highest-priority facility for the spare slots (accessibility,
then cycles, toilets, food and first class), so the whole formation stays synchronised.
The optional coach `food` flag is supported by the protocol and renderer; Darwin Browser does not yet populate it.

The structured websocket exposes coach identifiers, class, loading and toilets, plus wheelchair-space
and cycle-space flags enriched by Darwin Browser's Gemini allocation rules. The formation shows accessibility
when either wheelchair spaces or an accessible toilet are reported, and cycles when cycle spaces are reported.
Unset facility flags remain unknown. Coach order is retained as supplied.
The accessibility icon takes precedence over the toilet icon in the same coach.
Toilet icons identify their locations, not whether the toilets are currently in service.

`formation_icons` selects the enabled facility icons, defaulting to
`["accessibility", "cycles", "toilets", "food", "first-class"]`. Remove `"toilets"` to hide standard toilet
icons while keeping accessibility, or use `[]` to hide all facility icons. Coach letters and loading are
unaffected, and disabled icons do not add rotation pages. If accessibility is disabled, a coach with a toilet
can show the toilet icon instead. Icon order remains accessibility, cycles, toilets, food, then first class.
The website offers individual Formation icons checkboxes, and the Pi management UI accepts the list.
`-formation-icons accessibility,cycles,food,first-class` and `BOARD_FORMATION_ICONS=accessibility,cycles,food,first-class`
override the file setting. The browser API and shared URLs use `formationIcons` (an array in the API,
a comma-separated list in URLs; an empty value disables all facility icons).

The protocol adapter also retains the complete NRCC station-notice list, replacing it on every snapshot
and update (an empty list clears it). Notices are not currently rendered by the boards.

`scroll_speed` sets how fast text scrolls, in dots per second. The defaults are 48 for Daktronics (the web
board's 550 px/s) and 60 for Infotec (the web's 77 dots/s reads too fast on the panel).

`small_scrolling_text = true` uses the Infotec "Small main row" font for calling points and service
information, including their prefixes and pages that fit without scrolling. It defaults to `false`.
The website and Pi management UI offer a Use smaller scrolling text toggle. The command-line flag is
`-small-scrolling-text`, the environment variable is `BOARD_SMALL_SCROLLING_TEXT=true`, and the browser
API and shared URLs use `smallScrollingText`. The smaller font redistributes space around the information
row, formation and separator; widths, clipping and scroll duration follow the selected font.

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

### Run the board in a desktop window

To watch the board without a Pi or LED panel, run `cmd/board` with `-display window`. It opens a window that
draws each LED as a round dot, and it accepts the same config file, environment variables and flags as on the
Pi. Press Esc or close the window to quit.

```sh
go run ./cmd/board -display window -crs BTN
go run ./cmd/board -display window -board infotec -platform-box -crs BTN
go run ./cmd/board -display window -fixture first-departs -board infotec
```

The `-scale` flag sets the number of pixels per LED (default 5), and the `-led-*` flags set the board size, so
the layout matches the real panel. To write every frame to numbered PNG files instead, use `-display png`
and name the directory with `-png-dir` (default `board-out`).

The window uses [Ebitengine](https://ebitengine.org), which is only compiled on non-Linux builds, so
`-display window` works on macOS and Windows but fails on the Pi. For more information, see
[Running on a desktop](docs/build.md#running-on-a-desktop).

`go test` compares every board format, drawn through every fixture at the panel and web sizes and with each display
option, against the round-dot images in `internal/formats/testdata/golden`. They're ordinary PNGs, so a change to how
a board looks shows up as a reviewable image in the diff. A frame that doesn't match is written to
`build/golden-failures`. To rewrite the images after an intended change, run:

```sh
go test ./internal/formats -update
```

On GitHub, the board screenshots workflow rewrites them and commits any change to the branch under test.

`go generate ./internal/live` regenerates the protobuf code. It needs `protoc` and the protobuf-go-lite plugin:

```sh
go install github.com/aperturerobotics/protobuf-go-lite/cmd/protoc-gen-go-lite@v0.19.0
```

The dot fonts are embedded in `internal/font`. Run `go generate ./internal/font` to regenerate the
platform, compact service, formation and clock faces from `../tools/font.json` (requires Python 3 and Go).
The remaining glyph bitmaps are maintained directly in `internal/font/data_gen.go`.
