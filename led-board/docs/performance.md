# Rendering performance

The retained optimisations target the physical LED matrix on a Raspberry Pi and
browser rendering on a desktop or laptop. They preserve configured service counts,
frame contents and panel timing. PNG and window output share the drawing improvements.

## Raspberry Pi

- Each native canvas retains its own RGB history. Uploads crop unchanged rows and
  columns, skip unchanged pixel runs, and invalidate both histories when brightness changes.
- Text layout, visible text tiles, formation pages and geometry are cached with
  bounded storage. Static regions avoid repeated drawing.
- Boards provide their next time-driven change, allowing the Go render loop to
  sleep between changes. Feed updates and brightness changes wake it promptly;
  native GPIO refresh continues throughout.
- Live projection reuses unchanged immutable views and converts only the configured
  services. The live connection reuses privately owned maps while public states
  and emitted views retain their ownership guarantees.
- The systemd service uses `GOGC=150`, measured to reduce collections during large
  updates at a small memory cost. Automatic Go concurrency remains unchanged.

The refresh loop uses the native library's sleep option between capped refreshes.
Set `led.no_busy_waiting = false` or pass `-led-no-busy-waiting=false` to restore
busy waiting on hardware that shows scheduling jitter. GPIO pulse timing, colour
depth and refresh profiles remain unchanged.

## Browser

The WebGL renderer uploads the small board texture and draws its dot pattern on the
GPU. Large canvases redraw bounded bands of changed pixels. Canvas 2D remains the
fallback when hardware WebGL is unavailable or initialisation fails; context
recovery restores the latest frame.

The scheduler uses pixel-change deadlines and live-update notifications, suspends
work outside the viewport, and repaints on resume. The WASM bundle embeds only the
London time zone and defaults to `GOGC=200`, with an explicit runtime override.
LCD scrollers cache layout measurements and clean up timers; minute-only clocks
avoid per-second updates.

## Other outputs

PNG output uses exact indexed palettes when possible, with an RGBA fallback.
Continuous output uses faster lossless compression; one-off exports retain compact
compression. The desktop renderer preserves unchanged window contents and releases
GPU resources with `Deallocate`.

## Measurement limits and validation

On the tested Pi Zero 2 W, warm scrolling-text drawing improved by 57–59% and
complete busy/long-route drawing ticks by 14–32%. A 500-train, 25 Hz delta feed
reduced allocation by about 32% and process CPU from 70.0% to 69.1% of one core.
Ordinary-feed CPU was effectively unchanged; continuous GPIO refresh dominates.
These are separate workload results, not gains to add together or a performance ceiling.

Regression tests cover retained frames and views, configured service counts,
malformed feed input, native upload contents, animation deadlines, resize,
WebGL context recovery and Canvas fallback. Browser renderer checks include 360
rendering cases and 48 scheduling cases. Existing image-baseline discrepancies
were left unchanged.

Experimental protobuf parsing and native pulse-timing changes are excluded.
A user-observed normal-traffic comparison showed no shimmer in either parser
build. Earlier shimmer under synthetic heavy load remains unresolved; software
frame counters cannot establish physical LED brightness stability. The stable Pi
service was restored after testing.
