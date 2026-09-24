# Build and deploy

The board runs on a 64-bit Raspberry Pi; it was developed on a Pi Zero 2 W. You
build it on another machine: Go cross-compiles the Go code, and Zig acts as the
C and C++ cross compiler for the `rpi-rgb-led-matrix` library and for cgo. The
build is tested on macOS, and uses nothing but Go, Zig, and Just.

## Requirements

- Go 1.27 or later, Zig 0.16 or later, and [Just](https://just.systems). On macOS:

  ```sh
  brew install go zig just
  ```

- The `rpi-rgb-led-matrix` submodule checked out:

  ```sh
  git submodule update --init third_party/rpi-rgb-led-matrix
  ```

- A 64-bit Raspberry Pi OS (or another arm64 Debian) on the Pi, which you can
  reach over SSH as a user with passwordless `sudo`. The first user that
  Raspberry Pi Imager creates has it.

Every cross-compiled object targets glibc 2.41, the version in Debian 13, which
Raspberry Pi OS is based on. For an older image, set `ZIG_TARGET` to match its
glibc, for example `aarch64-linux-gnu.2.36` for Debian 12:

```sh
just ZIG_TARGET=aarch64-linux-gnu.2.36 deploy
```

## DietPi SD card image

The [DietPi image workflow](https://github.com/davwheat/raildotmatrix.co.uk/actions/workflows/dietpi-image.yml)
builds a flashable 64-bit image when LED board files change on a push or pull request. It can also be run
manually with **Run workflow**. Download the `raildotmatrix-dietpi-rpi234-arm64` artifact from a successful
run and extract the ZIP. It contains an `.img.xz`, its SHA-256 checksum, the source commit and base-image
checksum in `build-info.txt`, and flashing instructions. Artifacts are retained for 14 days.

Publishing a GitHub Release (including a pre-release) also runs the workflow against that release's tag.
Once the image build succeeds, it attaches the `.img.xz`, SHA-256 checksum, `build-info.txt` and `README.txt`
to the release as downloadable assets. Draft releases start the build when published. The workflow must
be present in the tagged commit. If an upload fails, rerun the failed job; matching assets are replaced.

The image uses DietPi's Debian 13 (Trixie) **RPi234 ARMv8** base, for the Pi Zero 2 W, Pi 2 v1.2, Pi 3,
Pi 4 and Pi 400. The original Pi Zero/Zero W, Pi 2 v1.1 and Pi 5 need different images and are not supported
by this artifact.

1. Flash the `.img.xz` with Raspberry Pi Imager's **Use custom** option or balenaEtcher.
   Skip Raspberry Pi Imager's OS customisation.
2. On the card's FAT boot partition, change `AUTO_SETUP_GLOBAL_PASSWORD` in `dietpi.txt` for console/SSH
   access. Set `AUTO_SETUP_NET_WIFI_COUNTRY_CODE` for your country (default GB). The GUI also lets you
   choose the country when connecting to Wi-Fi.
3. Connect the LED panels and power on. The image starts an access point named **DepartureBoard**,
   with password **DotMatrix**. Wi-Fi setup works without internet access. The default panel layout is
   two chained 128×64 panels; change it in the GUI or in `departure-board.toml` at the root of the card.
4. Join the hotspot. Open **http://192.168.4.1** and sign in with board password **DotMatrix**.
   Under **Wi-Fi & connection**, select or enter your network and connect. The hotspot disconnects
   while the Pi joins that network. If connection fails, the hotspot returns automatically.
5. Join the same network on your phone/computer and open **http://departureboard.local**. Ethernet
   also uses DHCP. The board advertises its hostname and HTTP service with Avahi/mDNS; use the IP
   address shown on the panel or in your router if your network does not support mDNS.
6. In **Board settings**, enter a three-letter station code and save. All board and panel options,
   including the advanced settings, are editable through the GUI. Saving validates the settings,
   backs up the previous file and restarts the display. The **Device** tab changes the web password
   and restarts the display. The hotspot password remains `DotMatrix`.

Until a station is configured, the LED matrix shows these instructions:

| State | Display |
| --- | --- |
| Hotspot, no devices connected and no Ethernet connection | `Connect to DepartureBoard` / `Password: DotMatrix` |
| A device joins the hotspot | `Setup available` / `http://departureboard.local` / `http://192.168.4.1` |
| The last hotspot device disconnects, with no Ethernet connection | Returns to the network name and password |
| Connected to Wi-Fi or Ethernet | `Setup available` / `http://departureboard.local` / assigned IP address(es) |

The manager checks the wireless driver's associated stations every three seconds. The display reads
that status once per second, so joining/leaving normally updates the instructions within four seconds.
Long lines scroll and smaller panel layouts page through the instructions. Setting a station code
switches to live departures; clearing it restores the setup display.

The config remains **`departure-board.toml` at the root of the boot partition**, mounted on the Pi at
`/boot/firmware/departure-board.toml`. It can still be edited by hand. Brightness applies live; restart
`departure-board` or reboot after other manual changes. GUI saves restart it automatically. Shut down
before removing the card. Wi-Fi credentials and the hashed web password are stored in private files
on the Linux partition. To reset the web password over SSH, remove
`/var/lib/departure-board/password.json` and restart `departure-board-manager`.

In **Developer → Root SSH access**, paste one or more SSH public keys (the contents of `.pub` files),
one complete key per line, then choose **Save SSH keys**. Connect using
`ssh root@departureboard.local`, or substitute the Pi's IP address. Each key grants full root access;
keep its private key on your computer. The editor loads existing keys and preserves comments and key
options. Remove a line and save to revoke that key for new connections, or clear the field to remove
all keys. Existing SSH sessions and console/SSH password settings are unaffected.

Keys are stored in `/root/.ssh/authorized_keys` with mode `0600`, inside a `0700` directory. New images
include an enabled Dropbear SSH server. When upgrading an existing image manually, also install the
updated `departure-board-manager.service`, create `/root/.ssh` with mode `0700`, and run
`systemctl daemon-reload` before restarting the manager so its sandbox permits saving keys.

Useful commands on the Pi:

```sh
journalctl -u departure-board -u departure-board-manager -f
systemctl restart departure-board
```

CI cross-compiles the board with Zig for glibc 2.41 and the Go web manager for ARM64. It verifies the
DietPi download against its published checksum, adds the SD-card config, and installs NetworkManager,
Avahi, DNS/DHCP support and the binaries inside the image. All setup dependencies are present before
flashing. DietPi's interactive first-run networking is disabled for this appliance; its filesystem
expansion and hardware initialization remain. Onboard audio is disabled because it conflicts with the
panel's PWM hardware. Each device generates its own machine identity and SSH host keys on first boot.

To build locally, use Linux with Python 3.11+, `mtools`, `xz`, `e2fsprogs` and `util-linux`, plus the
build tools above. An x86 Linux host also needs `qemu-user-static` and enabled `qemu-aarch64` binfmt
support. Download and checksum-verify `DietPi_RPi234-ARMv8-Trixie.img.xz`, extract it, then run:

```sh
just ZIG_TARGET=aarch64-linux-gnu.2.41 board
just manager
python3 -B -m unittest discover -s deploy/dietpi -p 'test_*.py' -v
python3 deploy/dietpi/build_image.py \
  --base-image /path/to/DietPi_RPi234-ARMv8-Trixie.img \
  --board build/board \
  --manager build/manage \
  --output build/raildotmatrix-dietpi.img
sudo deploy/dietpi/prepare-image.sh build/raildotmatrix-dietpi.img
xz -T2 build/raildotmatrix-dietpi.img
```

The Python stage copies the base and refuses to overwrite an existing output. The preparation stage
requires root and network access, grows the image's root partition by 1 GiB and installs packages in a
chroot. It operates on an image file, not an SD card or physical disk. Python tests verify the FAT
payload, configuration and preservation of the base; Go tests cover config saves, authentication,
network failure recovery and hotspot-client display transitions. Physical boot, radio and GPIO
operation still need testing on a Pi with panels attached.

### Preview the management GUI locally

From `led-board`:

```sh
go build -o build/board-native ./cmd/board
go build -o build/manage-native ./cmd/manage
mkdir -p build/management-demo
cp deploy/departure-board.toml build/management-demo/board.toml
build/manage-native -demo -listen 127.0.0.1:8098 \
  -board "$PWD/build/board-native" \
  -config "$PWD/build/management-demo/board.toml" \
  -state-dir "$PWD/build/management-demo/state" \
  -status "$PWD/build/management-demo/network.json"
```

Open http://127.0.0.1:8098 and sign in with `DotMatrix`. Demo mode simulates networks and service
restarts, while config validation and persistence work against the separate demo file. Developer SSH
keys are saved to `state/ssh/authorized_keys` in the demo directory; they do not enable host SSH access.

## Local settings

The deploy recipes reach the Pi as `pi@raspberrypi.local` by default. To use a
different host or user, put the settings in a `local.env` file next to the
`justfile`. Git ignores it, and it takes precedence over the defaults:

```sh
PI_HOST=board@departure-board.local
```

| Variable | Default | What it sets |
|---|---|---|
| `PI_HOST` | `pi@raspberrypi.local` | The SSH destination. |
| `SUDO` | `sudo` | The command that runs the install steps as root. Set it empty when `PI_HOST` logs in as root. |
| `SSH_OPTS` | none | Extra `ssh` options, such as `-o ControlPath=~/.ssh/cm-pi` to reuse a ControlMaster connection when your key needs a touch for each login. |
| `BIN_DIR` | `/opt/departure-board` | Where the binaries are installed on the Pi. |
| `PANEL_TEST_FLAGS` | none | Extra flags for `just run-panel-test`, such as `-led-rgb-sequence=BGR`. |
| `WEB_DIR` | `../website/public/led-board` | Where `just web` writes the WebAssembly bundle. |
| `ZOPFLI_ITERATIONS` | `15` | How hard `just web` compresses the bundle. `1` takes half the time and makes a bundle about 0.2% larger. |
| `ZIG_TARGET` | `aarch64-linux-gnu.2.41` | The target triple and glibc version to build for. |

Environment variables of the same names override the file, and so does setting
them on the command line before the recipe, such as
`just PI_HOST=root@other-pi SUDO= deploy`.

## Recipes

Run `just --list` for a summary. `just` on its own builds the board.

| Recipe | What it does |
|---|---|
| `just lib` | Compiles the LED matrix library into `build/lib/librgbmatrix.a`, in parallel, recompiling only the sources that changed. |
| `just board` | Cross-compiles `cmd/board` into `build/board`. Builds the library first if needed. |
| `just panel-test` | Cross-compiles `cmd/panel-test` into `build/panel-test`. |
| `just deploy` | Builds the board, installs it as `BIN_DIR/board` on the Pi, and restarts the service if it's running. |
| `just install-service` | Installs the systemd unit and starts or restarts the service, and installs the example config as `/etc/departure-board.toml` if the Pi doesn't have one. |
| `just deploy-panel-test` | Builds `panel-test` and installs it as `BIN_DIR/panel-test` on the Pi. |
| `just run-panel-test` | Pauses the board service, runs the deployed `panel-test` for five seconds with a CPU snapshot from `top`, and then resumes the service. |
| `just web` | Builds the boards as WebAssembly and bundles them into `WEB_DIR`. |
| `just clean` | Deletes the `build` directory. |

A first install is:

```sh
just deploy
just install-service
```

Then set `crs` and your panel settings in `/etc/departure-board.toml` on the Pi,
and run `sudo systemctl restart departure-board`.

The library only needs rebuilding when the submodule changes. The first Go
link takes a while and prints a large number of warnings: Zig compiles its own
libc++ for the target and caches it. Later links are quiet.

## How the library is compiled

The `lib` recipe mirrors the object list and compiler flags from
`third_party/rpi-rgb-led-matrix/lib/Makefile`, with these differences:

- `-fPIC`, `-g`, and link-time optimization are omitted. The archive is
  linked statically into a stripped binary, so none of them help.
- `-march=native` is omitted because the host isn't the target.
- The `DEFAULT_HARDWARE` define is `"regular"`, the wiring of a bare adapter
  board. For a HAT or bonnet, set `led.gpio_mapping` in the config file, such
  as `adafruit-hat`.

## Deploying

Minimal images can lack `scp` and `sftp-server`, so `just deploy` streams the
binary through a plain `ssh` session and then renames it into place. The
rename is atomic, so the running board keeps its old binary until the service
restarts.

## Testing the panels

`panel-test` draws a moving pattern and prints the frame rate that `Swap`
sustains. To run it on the Pi for five seconds, pausing the board service
meanwhile:

```sh
just deploy-panel-test
just run-panel-test
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

## Building for the web

`just web` builds `cmd/wasm` with the standard Go compiler (`GOOS=js GOARCH=wasm`) and runs `cmd/webbundle`,
which writes three files into `WEB_DIR`:

- `board.HASH.wasm.gz`: the module, gzip-compressed with Zopfli. Zopfli takes about 25 seconds and
  produces a file about 2.5% smaller than `gzip -9` does, which every visitor downloads.
- `wasm_exec.HASH.js`: the JavaScript glue for the module, which must come from the same Go release.
- `manifest.json`: the names of the other two, which change whenever their content does.

The page fetches `manifest.json` without caching, so the other two can be cached indefinitely. It un-gzips
the module itself, so the host serves the file as it is, with no `Content-Encoding` header. The JavaScript API
is described at the top of `cmd/wasm/main.go`.

`WEB_DIR` defaults to the website's `public/led-board` directory, which git ignores. The website's `yarn build`
runs `just web`, and `yarn dev` runs it with `ZOPFLI_ITERATIONS=1`, so you don't need to run it yourself.

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

To watch a built-in example instead, without the live feed:

```sh
go run ./cmd/board -display window -fixture first-departs -board infotec
```

The window is provided by [Ebitengine](https://ebitengine.org), which is only
compiled on non-Linux builds. The cross-compiled Pi binary uses a stub, so
`-display window` fails there with an error.

The window uploads one small RGBA texture and draws the LEDs with one GPU shader call, using the same antialiased
dot texture at every LED. The resulting image is cached until the board changes. PNG output expands each source row
once and copies its repeats, and snapshot exports share a reusable compression workspace. Contact sheets copy whole
image regions without converting each pixel through `color.Color`.

To check and measure these paths:

```sh
go test ./...
go test ./internal/matrix/pngdisplay -run '^$' -bench . -benchmem
go test -tags renderertest ./internal/windowdisplay -bench BenchmarkRender -benchmem
```

The last command needs a macOS or Windows desktop session and briefly opens a test window. It compares GPU output
with the previous per-LED drawing algorithm at several board sizes and scales. Its benchmark includes a GPU readback
after each frame to wait for rendering to finish; that readback is test overhead and is not part of the live window.

See [performance measurements](performance.md) for Pi Zero 2 results, the changed-row panel upload strategy,
refresh sleep settings, configured service limits and reproducible benchmark commands.
