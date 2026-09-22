# UK Railway Dot Matrix

Displays a dot matrix station display board for any UK railway station.

Uses the National Rail API via [my own personal instance of Huxley2](https://github.com/davwheat/Huxley2).

See it live at [raildotmatrix.davwheat.dev](https://raildotmatrix.davwheat.dev/)!

## Dot matrix boards

The Daktronics (Data Display) DMI and Infotec landscape DMI boards aren't React components. They're drawn by the Go program in
[`../led-board`](../led-board), which also drives a physical LED panel, compiled to WebAssembly. `src/components/displays/LedBoard` loads that
build and draws its frames. These two boards always read the live WebSocket feed, whatever the train data source is set to.

`yarn build` and `yarn dev` build the WebAssembly bundle into `public/led-board` first, so they need Go 1.21 or later (Go fetches the version
`led-board/go.mod` asks for) and [Just](https://just.systems). `yarn board` rebuilds just the bundle. To change how either board looks or
behaves, change the Go code in `led-board`; git ignores `public/led-board`.

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
