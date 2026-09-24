# Performance measurements

Measured on 24 September 2026. [Raw Pi results](benchmarks/pi-zero-2-2026-09-24.txt) include every sample,
frame interval percentiles, temperatures and firmware status. These are workload measurements, not a claim
that the hardware or application has reached its maximum possible performance.

## Raspberry Pi Zero 2 W

The repository's Pi is a Zero 2 W Rev 1.0, with 462 MiB available RAM, a 1 GHz CPU and the `performance`
governor. It drives two chained 128×64 panels. The deployed Infotec configuration uses 60 Hz, 11 PWM bits,
100 ns LSB timing and GPIO slowdown 2. Those timing, colour-depth and wiring settings were preserved.

CPU percentages below use **100% for one core**; the four-core machine has 400% total capacity.

| Full application, same built-in fixture | Before | After |
| --- | ---: | ---: |
| Scrolling `busy-board`, 60 Hz | 113.0% CPU | 65.8% CPU |
| Process resident memory | 12,496 KiB | 12,692 KiB |
| GPIO refresh thread alone | 93.1% CPU | 57.4% CPU |

Each process warmed up for five seconds, then `/proc/PID/stat` was sampled over 20.02 seconds. The
unchanged configuration was read by both binaries. The before binary is the first software update deployed
for this work, SHA-256 `ded46439a92895765fd247c62cbd5563c440a2a27f4b5bdaba08e8c55a75a23e`;
the measured after binary is `06e1d6a242dff2007757ec6e42959bd907ffd26478c19895ce1e60a020653592`.

The combined reduction was **42% of process CPU use**. An idle `no-departures` screen still consumed 61.9%,
including 56.9% in the refresh thread. Thus most remaining CPU cost in these tests is GPIO refresh, with
about four percentage points added by the scrolling workload. This identifies the next area to investigate;
it does not prove an absolute lower bound.

### Panel upload and refresh

| Moving panel-test pattern | Full upload, busy wait | Full upload, sleep | Changed rows, sleep |
| --- | ---: | ---: | ---: |
| 60 Hz, 11 PWM bits | 132.9% CPU | 96.3–96.4% CPU | 64.4% CPU |
| 96 Hz, 8 PWM bits | 144.5% CPU | 134.6–135.0% CPU | 81.3% CPU |

All variants delivered approximately their requested frame rate. At 60 Hz, p99 frame intervals remained
about 16.8 ms; at 96 Hz they were about 10.5–10.6 ms. These ten-second tests include startup in their frame
timings; CPU samples cover seconds 1–8. The moving horizontal bar particularly benefits from partial uploads.

The refresh thread now uses the library's sleep option between capped refreshes. Its short final wait and
GPIO pulse timing remain in the native library. Set `led.no_busy_waiting = false` or pass
`-led-no-busy-waiting=false` to restore busy waiting if a different system shows scheduling jitter.
An uncapped refresh has no spare interval to sleep through.

Each native canvas has its own RGB cache. Only changed adjacent rows are converted into PWM bitplanes;
unchanged rows retain their native contents. Both caches are invalidated after a brightness change. The
two caches cost 96 KiB for a 256×64 board, and do not allocate on ordinary swaps. Tests simulate both
canvases, blank frames, unchanged frames and brightness invalidation to check for stale pixels.

Three competing CPU workers on cores 0–2 increased p99 intervals to 20.5–20.6 ms in both sleep and busy
wait modes, while average output remained 59.9 fps. During this stress test, firmware reported `0x20002`,
meaning an active Arm frequency cap as well as a previous cap; ordinary runs reported `0x20000`, the
historical flag only. See the [official flag definitions](https://www.raspberrypi.com/documentation/computers/os.html#get_throttled).
The Pi has `temp_limit=65`; temperatures reached 60–61°C under stress and returned to about 56°C afterwards.
The cap cleared and the clock returned to 1 GHz. This is evidence to investigate thermal headroom under
sustained load, not proof of the cap's cause. No clock, thermal, voltage or networking settings were changed.

### Go drawing and data conversion

Medians of three 500 ms benchmark samples, pinned to core 0 with `-test.cpu=1`; the normal board service
remained running. PNG and setup baselines use their source at `f6866b3` with the same benchmark workloads.

| Operation | Before | After | Speedup |
| --- | ---: | ---: | ---: |
| PNG expansion, scale 1 | 1.449 ms | 0.568 ms | 2.6× |
| PNG expansion, scale 3 | 9.744 ms | 1.605 ms | 6.1× |
| PNG expansion, scale 6 | 35.443 ms | 4.121 ms | 8.6× |
| Round-dot image, scale 6 | 15.824 ms | 10.724 ms | 1.5× |
| PNG writer, scale 3, including file output | 52.881 ms | 41.261 ms | 1.3× |
| Setup tick, scrolling 128-dot board | 36.439 µs | 15.031 µs | 2.4× |
| Setup tick, static 512-dot board | 19.930 µs | 1.468 µs | 13.6× |

The PNG compression pool cuts repeated workspace allocation: the old writer allocated about 1.1 MB per
frame; warm samples of the new writer allocated about 260 bytes. Its first sample averaged 87 KB because it
included pool creation. The pool may be reclaimed by Go's garbage collector. Compression and output pixels
are unchanged. Setup text widths and positions are reused between changes; its benchmark still includes
one-second file polling and JSON parsing, averaging 18 bytes per tick instead of 368.

For a synthetic 50-train station made from the existing live fixture, projection of every service cost
306.5 µs, 25,968 bytes and 201 allocations. Projecting the first **three matching services** cost 19.8 µs,
1,640 bytes and 13 allocations; six cost 38.4 µs, 3,280 bytes and 25 allocations. The configured count
controls this limit for both Infotec and Daktronics, after passenger, platform and override filtering.
The full protocol state and platform alteration detection are retained. Later selected services rotate
through the lower service row; Daktronics supports counts 1–6 with its existing geometry.

The management service also skips atomic status-file writes and fsync when the network status is unchanged.
At its three-second poll interval, a completely stable connection avoids up to 28,800 such writes per day.
Tests verify changes are written and missing files or failed writes are retried. This service was not installed
on the measured Pi, so this is a verified reduction in operations, not a measured Pi CPU saving.

Run the portable benchmarks on a host:

```sh
go test ./internal/matrix/pngdisplay ./internal/setupdisplay ./internal/live -run '^$' -bench . -benchmem
```

For the Pi, cross-compile each package with `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go test -c`, copy its
test executable and any `testdata` directory, then run it with
`taskset -c 0 ./package.test -test.run='^$' -test.bench=. -test.benchtime=500ms -test.count=3 -test.cpu=1`.
Use `just panel-test` for the real cgo driver. Stop the board service before running a panel test, and restore
it afterwards: two processes must not drive GPIO simultaneously. `panel-test` now prints frame interval
percentiles as well as average FPS.

## Browser and desktop paths

The LED browser renderer uses hardware WebGL when available, and retains Canvas 2D when WebGL is missing,
software-only or fails initialisation. One tiny RGB texture and one shader draw replace thousands of Canvas
operations. On the M4 Pro development host, 1920-pixel-wide frame submission fell from about 0.202 ms to
0.032 ms; at 3840 pixels it fell from 0.190 ms to 0.056 ms. These are CPU submission times, not complete
GPU frame times or Pi browser measurements. The Pi used here has no browser measurement setup.

The desktop Ebitengine renderer similarly uploads a small RGBA texture and draws the cached LED mask in
one shader pass. Its host benchmark fell from about 1.51 ms to 0.79 ms, including test-only GPU readback to
wait for completion. GPU resources use `Deallocate`, replacing the deprecated `Dispose` API. Linux uses
the real matrix backend rather than this desktop renderer.

For LCD browser boards, live services are memoized and a timer is scheduled for the next warning or arrival
boundary. A quiet feed no longer causes a full projection and React update every second. Browser tests check
zero periodic renders, stable service identity across parent renders, deadline updates, resume after a wall
clock change, and connection cleanup. Board fitting uses a ResizeObserver instead of reading layout after
each parent render. The management and browser changes do not require WebGL.

Validation includes the Go suite, relevant race checks, desktop shader pixel parity, browser hook tests,
settings tests, a fresh WASM/production website build and both LED visual baselines. The 12 checked-in LCD
baselines currently differ in height by three pixels on this Chrome environment; unchanged HEAD reproduces
that failure. Direct current-versus-HEAD comparisons match all 12 fixtures at the existing four-channel-value
tolerance. Baselines were not rewritten.
