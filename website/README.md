# UK Railway Dot Matrix

Displays a dot matrix station display board for any UK railway station.

Uses the National Rail API via [my own personal instance of Huxley2](https://github.com/davwheat/Huxley2).

See it live at [raildotmatrix.davwheat.dev](https://raildotmatrix.davwheat.dev/)!

## Dot matrix boards

The Daktronics (Data Display) DMI and Infotec landscape DMI boards aren't React components. They're drawn by
[LED departure board](https://github.com/davwheat/led-departure-board), the Go program that also drives a physical LED panel, compiled to
WebAssembly. `public/led-board` holds that build, and `src/components/displays/LedBoard` loads it and draws its frames. These two boards always
read the live WebSocket feed, whatever the train data source is set to.

To change how either board looks or behaves, change it in that repository, then run `make web` there with `WEB_DIR` set to this repository's
`public/led-board` directory, and commit the files it writes. Don't edit the files in `public/led-board` by hand.

## Running locally

You'll need:

- [Node.js](https://nodejs.org/en/download) 22 or later (not tested on earlier versions)
- [Yarn package manager](https://yarnpkg.com/getting-started/install)
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
