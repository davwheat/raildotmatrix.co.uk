# Live WebSocket train data

Choose **Live WebSocket feed** in **Train data source**, on the board settings page or above any station board. **Original** remains the default.
The selection and service URL are saved on the device. Switching closes the previous connection or aborts the outstanding original API request.

The **Train data source** and **Service URL** controls are a development tool: they render only under `pnpm develop`, and a built site leaves
them out. To select the WebSocket source on a built site, use the query parameters below.

The Infotec landscape DMI and Daktronics (Data Display) DMI boards always use the WebSocket feed. They come from the WebAssembly build of
[`led-board`](../../led-board), which connects to the service itself: they read the service URL, but ignore the source selection, including
`dataSource=original`. The Go port follows the display rules that this page describes.

In development, the default service is `ws://localhost:8080`. Run Darwin Browser locally with its movement backfill complete, then run this site
with `pnpm develop`. The URL is a base URL: the client adds `/v1/cis/live?crs=...`.

A direct link can override saved settings:

```
http://localhost:3000/board/infotec-landscape-dmi?station=ECR&dataSource=websocket&liveServiceUrl=ws%3A%2F%2Flocalhost%3A8080
```

`dataSource=original` explicitly selects the original source. Changing a control rewrites the address bar with only the settings that differ from
the defaults, so a link copied from a default board carries neither parameter. The announcement site passes these parameters to its embedded
board; an embedded board hides the source controls so its parent owns the selection.

To point the development site at a remote service, change **Service URL**, or set `NEXT_PUBLIC_LIVE_SERVICE_URL` before building. The built
site's default comes from `NEXT_PUBLIC_LIVE_SERVICE_URL` in `.env.production`, which is committed because the value reaches the browser anyway.
HTTP(S) bases are converted to WS(S), and an optional URL path prefix is preserved. Use a WSS service when hosting the site over HTTPS. Local
development uses HTTP and WS.

In WebSocket mode the board makes no train-data HTTP requests. It reconnects only to the selected WebSocket service. A lost connection clears the
board until a fresh snapshot arrives.

The board asks the service for a heartbeat every 30 seconds, and resyncs only when it has a reason to: after a revision gap, or when a heartbeat
reports a state digest that doesn't match what the board holds. It never resyncs on a timer, because a snapshot is the largest message the stream
sends and the delta chain already detects a gap. An unanswered resync is retried once before the board gives up on the connection, because
replacing the socket blanks the board.

Any message resets a 75-second deadline. Browsers don't expose WebSocket pings to scripts, so heartbeats are what let the board tell a quiet
stream from a connection that has wedged without closing — the usual failure on mobile and station Wi-Fi, which otherwise leaves a display frozen
on stale trains indefinitely. The digest covers the epoch, revision, held movement IDs, their ordering, and active override IDs;
`src/live/digest.ts` mirrors the server's `live.StateDigest`, and a golden vector pins the two together in both test suites.

All three station display styles use server ordering, including Darwin TrainOrder. Movement IDs preserve separate visits by the same RID. These
departure displays select passenger departures from the full movement feed. Passing/non-public TD warnings are displayed using platform
overrides, independently of passenger rows. An override replaces its platform's train details until explicitly removed or expired; other
platforms retain their services. The server owns departure removal, including SMART/TD evidence and the Darwin actual-departure fallback.

The Data Display board announces a platform alteration before it redraws. When a train moves between a platform the board watches and one it does
not, the middle row flashes PLATFORM ALTERATION for six seconds, a second lit and a second dark, and the board then draws its new state with the
next train scrolling up from the bottom, as it does on first load. No board shows a platform number against a service, so an alteration reaches a
passenger as a train appearing or vanishing: a board watching the whole station has no platform to lose a train from, and a move between two
watched platforms leaves every row as it was. A platform published for the first time, or withdrawn, is an announcement rather than a move. A
stand clear warning outranks the announcement and replaces it, because the train that warning describes is passing the platform as someone reads
it.

The board recognises the move in the feed it already holds, so it announces one for as long as the service keeps sending the train. A service
that narrows its payload to the watched platforms can drop an altered train instead of republishing it, and a dropped train reaches the board as
a departure.

Station/operator names, times, reasons, calling points and available split-service information come from the feed. Existing optional legacy
operator names remain a static client preference. Unavailable associated services never trigger a lookup. A portion that ends its journey here
only to join another service is left off the board: the train it becomes has its own row, carrying both portions' origins, so listing the portion
as well shows one train twice — once as a service that terminates and strands its passengers.

A movement's `false_destination` is shown in place of the service's own destination, as on a circular route. It has no via caption, because the
feed's caption describes the route to the real destination, and the calling points end at the first call there. Portions keep their own
destinations.

A service that links to another where it ends is shown as one through service. Darwin links (`LK`) two services to make one journey of them, most
often a train and the rail replacement bus that finishes its route. The board lists the linked service's calling points after the service's own
and shows the linked service's destination, without a via caption. It follows the links of each linked service in turn, so a train that links to
a bus that links to a train is one row to the last train's destination. Each linked service keeps its own row at the stations where it calls.

The board follows a link only at the last call that the service makes, so a link elsewhere on the route changes nothing, and calls that the
service has cancelled beyond the link give way to the linked service's. It stops at a link that is cancelled, whose service the feed doesn't
have, or whose service makes no further calls. It doesn't follow a link from a service with a false destination, because that destination is what
Darwin tells a board to show. A portion with `main` set to `false` is the service the passengers came from, and a bus recorded as a train's next
working (`NP`) is read as a link.

A portion that joins another train (`JJ`, with `main` set to `false`) is followed in the same way before it reaches the join: it's one row to the
destination of the train it joins, with that train's calling points after its own. The join can be a call that passengers can't use.

A train that divides lists each portion's calling points and destination while passengers can still travel in it. A portion that is cancelled,
that the feed doesn't have, or that has no calls left to make isn't listed, and neither is its destination. A train can divide at a station where
it sets nobody down, as a sleeper does: the board lists that station as a calling point, because the division has to be shown against one. A
calling point that the train no longer makes is left out, unless the train is cancelled at this station as well. A train that a portion joins can
go on to divide, or to link to another service: the board follows both, and lists those divisions and destinations too.

Each part of a dividing train is labelled with the end of the train it's at. The feed gives a portion's `position` as the train arrives at the
division, or else Darwin's `detach_front` does, and the board swaps the ends for each reversal (activity `RM`) that the train makes on the way
there. The train's own part is the front unless a portion is known to be there. Where nothing says, the board assumes that each portion is behind
the ones before it, as the real boards do.

A train can also leave coaches behind while it runs on as the same service. The feed reports those on the call's `formation_change`, and the
board lists them as a part of the train that calls no further than that station.

A train that is cut short is shown to the last station that it still calls at. At that station it's an arrival that terminates there.

## Wire format

The streams are Darwin Browser's protocol version 2: every frame is a protobuf message, defined in that repository's
`proto/darwin/live/v2/live.proto` and described in its `docs/live/protocol.md`. `src/live/wire.ts` decodes each frame into the types in
`src/live/types.ts`, which the rest of the page reads, so `null` still means unknown there. A text frame means a version 1 service, and the
connection is closed and retried rather than read. A message this build doesn't know is ignored, and still counts as proof that the connection is
alive.

`src/live/gen` is generated and `src/live/wire.ts` is shared with the other website, so don't edit either here. To pick up a schema change, run
`buf generate ../../darwin-browser/proto` from `website/`, with Darwin Browser checked out beside this repository, then copy
`docs/live/examples/wire.ts`, with its type import pointed at `./types`, and the fixtures in `docs/live/fixtures` that `tests/fixtures` holds.
Keep the plugin version in `buf.gen.yaml` no newer than the `@bufbuild/protobuf` version in `package.json`. The `.pb` fixtures are frames written
by the service's own encoder, and the tests check that this decoder reads each one as the JSON beside it.

Run `pnpm test:live` for reducer, digest, heartbeat, resync/reconnect, ordering, split, link, platform warning and platform alteration
regressions. The runner uses Node's test runner and Wrangler's existing esbuild compiler. Build with `pnpm build`.

Run `pnpm test:visual` to screenshot every board in every state, including both platform warnings and a platform alteration, and compare the
results against committed baselines. See [Board screenshot tests](./board-visual-tests.md).
