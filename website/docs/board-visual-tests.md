# Board screenshot tests

`yarn test:visual` renders every departure board in every state it can reach and compares each one against a committed baseline image. It catches
changes no unit test sees: a row that stops appearing, text that overflows its board, a warning that loses its styling.

## Running the tests

Build the site first, because the tests screenshot the built output rather than the dev server:

```
yarn build
yarn test:visual
```

The run reports one line per case and exits non-zero if any case differs from its baseline:

```
  ok        infotec-landscape-dmi--passing-train
  FAILED    blackbox-landscape-lcd--cancelled — 4,812 of 612,000 pixels differ
```

A failure writes the new screenshot and a highlighted diff to `tests/visual/failures/`. Open the diff: changed pixels are magenta over a faded
copy of the baseline. Decide whether the change is a regression or an improvement, then either fix the board or accept the new rendering with
`yarn test:visual --update`.

| Flag              | Effect                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `--update`        | Rewrite the baselines from this run, and delete baselines no case produces any more.           |
| `--filter <text>` | Run only cases whose `<board> <state>` contains the text, such as `--filter passing-train`.    |
| `--repeat <n>`    | Capture each case `n` times and fail if the captures disagree. Use it when a case looks flaky. |
| `--site <dir>`    | Serve a build from somewhere other than `out/`.                                                |

Set `CHROME_PATH` if Chrome is not in one of the usual locations. The runner needs Node 22 or newer.

### Baselines come from CI

Text renders differently on different operating systems, so a baseline recorded on one will not match another. The committed baselines are the
ones the `Board screenshots` workflow produces on Linux, and it commits any change back to the branch. Treat CI as the source of truth: run the
tests locally to see a change, but expect a local `--update` on macOS or Windows to rewrite every baseline rather than only the ones you meant to
change.

## What is covered

Each state in `tests/visual/fixtures.ts` is captured on each board in `tests/visual/boards.ts`, so adding either one extends the matrix. A state
can also name the platforms the board watches and send updates after its snapshot, which is how a state that exists only as a change reaches a
board at all.

| State                 | What it shows                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `connecting`          | The socket is open but no snapshot has arrived. A board never says so, so this must match `no-departures`. |
| `no-departures`       | A healthy feed with nothing to show.                                                                       |
| `terminating`         | A service ending its journey here, shown as "Terminates here".                                             |
| `single-departure`    | One straightforward service.                                                                               |
| `busy-board`          | Five services competing for the board.                                                                     |
| `delayed`             | A late running service, with its reason.                                                                   |
| `unknown-delay`       | A service the feed cannot estimate.                                                                        |
| `cancelled`           | A cancelled service, with its reason.                                                                      |
| `dividing-service`    | A service that splits, listing front and rear portions.                                                    |
| `passing-train`       | A stand clear warning replacing a platform.                                                                |
| `non-public-train`    | A not for public use warning replacing a platform.                                                         |
| `platform-alteration` | A train moving off the platform the board watches.                                                         |

Fixtures are served over the same WebSocket protocol the boards use in production, so the tests exercise the real feed path. The fixture name is
the URL path prefix of the service URL, which is how each case selects its data.

## What the baselines cannot show

Boards rotate through extra detail: the two dot matrix boards page between a service summary and its calling points, scroll text that doesn't
fit, and show a split service's destinations as pages. Each dot matrix baseline is one moment of that: the frame the board draws a fixed time
after its data arrives, which is 4.6 seconds for the Infotec board and 8.6 seconds for the Data Display board. By then the Infotec board shows
its service summary, and the Data Display board has scrolled its summary onto the board. The Data Display board's `platform-alteration` case is
captured at 4.6 seconds instead, because the announcement is over by 8.6. `runClock` in `tests/visual/boards.ts` sets these times.

That mainly affects `dividing-service`. The split is still covered, because the Blackbox board renders it without rotating: its baseline shows
both destinations and the "Join the front N coaches" text. On the other two boards the baseline proves the service renders, not that its portions
read correctly.

The two dot matrix boards are drawn by the Go program in [`led-board`](../../led-board), so these tests check that the site loads and draws that
program's build. Its own tests cover how each board behaves over time.

Joins have no state of their own. The feed only ever describes a divide, and every board filters associations down to divides before rendering,
so a joining service reaches a board as an ordinary one.

## How a screenshot is made deterministic

Boards animate continuously and render the current time, so a naive screenshot never matches twice. Each capture therefore:

- Freezes the clock and the timezone before any page script runs, which fixes every rendered time.
- Drops `setInterval`, which stops row carousels advancing mid-capture.
- Waits for fonts, for the markup and any canvas to stop changing, and for entrance animations to finish. Markup alone is not enough, because a
  board holds one layout for the length of a slide-in and only then renders the next. A board that marks itself `aria-busy`, as the dot matrix
  boards do while their WebAssembly loads, hasn't settled.
- For the dot matrix boards, which animate by the time the page gives them rather than with CSS, runs the frozen clock forward once the feed has
  arrived. The clock moves in 50 ms steps, one per animation frame, because a board times some animations, such as the clock's flipping digits,
  from the frame in which it notices a change.
- Removes transitions, returns scrolling text to its resting position, and cancels zoom-to-fit so baselines sit at the board's own resolution.
- Holds each animation that plays once on its final frame, and drops the ones that repeat, so a flashing cancellation or platform alteration is
  captured at full opacity rather than mid-blink. Dropping a blink also holds the board on the screen the blink belongs to: boards advance on
  `animationend`, and a cancelled animation never sends one. Without that, a platform alteration would have to be caught inside the six seconds
  it lasts.

If a case starts failing intermittently rather than consistently, that list is where to look. `--repeat` reproduces it, and the run prints which
animations were still going when a board failed to settle.
