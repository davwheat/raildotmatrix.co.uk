# Live WebSocket train data

Choose **Live WebSocket feed** in **Train data source**, on the board settings page or above any station board. **Original** remains the default.
The selection and service URL are saved on the device. Switching closes the previous connection or aborts the outstanding original API request.

The **Train data source** and **Service URL** controls are a development tool: they render only under `yarn develop`, and a built site leaves
them out. To select the WebSocket source on a built site, use the query parameters below.

In development, the default service is `ws://localhost:8080`. Run Darwin Browser locally with its movement backfill complete, then run this site
with `yarn develop`. The URL is a base URL: the client adds `/v1/cis/live?crs=...`.

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

In WebSocket mode the board makes no train-data HTTP requests and ignores legacy iframe train-data messages. It reconnects only to the selected
WebSocket service. A lost connection clears the board until a fresh snapshot arrives.

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

Run `yarn test:live` for reducer, digest, heartbeat, resync/reconnect, ordering, split, platform warning and platform alteration regressions. The
runner uses Node's test runner and Wrangler's existing esbuild compiler. Build with `yarn build`.

Run `yarn test:visual` to screenshot every board in every state, including both platform warnings and a platform alteration, and compare the
results against committed baselines. See [Board screenshot tests](./board-visual-tests.md).
