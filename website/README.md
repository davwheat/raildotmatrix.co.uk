# UK Railway Dot Matrix

Displays a dot matrix station display board for any UK railway station.

Uses the National Rail API via [my own personal instance of Huxley2](https://github.com/davwheat/Huxley2).

See it live at [raildotmatrix.davwheat.dev](https://raildotmatrix.davwheat.dev/)!

## Dot matrix boards

The Daktronics (Data Display) DMI and Infotec landscape DMI boards aren't React components. They're drawn by the Go program in
[`../led-board`](../led-board), which also drives a physical LED panel, compiled to WebAssembly. `src/components/displays/LedBoard` loads that
build and draws its frames. These two boards always read the live WebSocket feed, whatever the train data source is set to.

The browser uses WebGL when hardware acceleration is available: each changed frame uploads the small RGB board image, and one GPU draw scales it
and applies a cached dot mask. Canvas 2D remains the fallback. The renderer restores its textures and latest frame after a GPU context loss, and
releases GPU resources when a board closes.

`yarn test:renderer` compares both renderers in GPU-enabled headless Chrome and checks resizing, transparency, context recovery and fallback.
`yarn test:renderer --benchmark` also measures main-thread paint submission time at 1920- and 3840-pixel widths; it does not measure GPU time or
overall frame rate. These checks need hardware WebGL and do not require a site build.

`yarn build` and `yarn dev` build the WebAssembly bundle into `public/led-board` first, so they need Go 1.21 or later (Go fetches the version
`led-board/go.mod` asks for) and [Just](https://just.systems). `yarn board` rebuilds just the bundle. To change how either board looks or
behaves, change the Go code in `led-board`; git ignores `public/led-board`.

## Board settings

Board options live on `/board`, before opening the display. A running board links back to that page. Inside a RailAnnouncements iframe, the
Settings button opens a native `<dialog>` instead. Both use `src/components/BoardOptions`, and changes in the dialog apply immediately. Saved
preferences are read from the existing per-display storage keys; explicit URL options take precedence. Generated board links include their
display options so another browser's preferences do not change the shared display.

Settings changes sync live between open tabs of the same display type on the same site. Each tab keeps its station and platform filters.

`yarn test:settings` checks preference migration, URL handling and embed detection. After building the site, `yarn test:settings --browser` also
checks the setup flow, mobile layout, shared controls, cross-tab synchronization and dialog keyboard behaviour in headless Chrome.

## Running locally

You'll need:

- [Node.js](https://nodejs.org/en/download) 22 or later (not tested on earlier versions)
- [Yarn package manager](https://yarnpkg.com/getting-started/install)
- [Go](https://go.dev/dl/) 1.21 or later and [Just](https://just.systems), which build the dot matrix boards
- [Git](https://git-scm.com/downloads)

When you have cloned the repository with Git, you should install all required dependencies with Yarn:

```bash
yarn install
```

Then, you can run the Next.js development server with:

```bash
yarn run start
```

Finally, in a second terminal, start the backend worker to allow live data to be fetched from the Darwin API:

```bash
yarn run develop:workers
```

You can then access the site at [`http://localhost:3000`](http://localhost:3000). The dev server forwards `/api/*` to the worker on port 8787, so
both need to be running for live departures.

## Contributing

Please feel free to contribute to this project! You can do so by forking the repository and creating a pull request.

Please make sure you format your code before submitting a pull request. You can do this by running:

```bash
yarn run format
```
