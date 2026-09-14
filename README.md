# UK Railway Dot Matrix

Displays a dot matrix station display board for any UK railway station.

Uses the National Rail API via [my own personal instance of Huxley2](https://github.com/davwheat/Huxley2).

See it live at [raildotmatrix.davwheat.dev](https://raildotmatrix.davwheat.dev/)!

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
