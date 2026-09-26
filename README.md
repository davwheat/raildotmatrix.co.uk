# UK Railway Dot Matrix

Dot matrix departure boards for UK railway stations, on the web and on a real LED panel.

| Directory                | What's in it                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [`website`](website)     | The [raildotmatrix.davwheat.dev](https://raildotmatrix.davwheat.dev/) website: a Next.js site with every board, hosted on Cloudflare Pages.     |
| [`led-board`](led-board) | The Daktronics Data Display and Infotec boards in Go. They drive a HUB75 LED panel on a Raspberry Pi, and the website runs them as WebAssembly. |

## Getting started

To work on the website, you need Node 24, pnpm, Go 1.21 or later, and [Just](https://just.systems), because the
website's build compiles the LED boards:

```sh
cd website
pnpm install
pnpm dev
```

To build the LED board for a Raspberry Pi, you also need the vendored LED matrix library and Zig. See
[`led-board/README.md`](led-board/README.md):

```sh
git submodule update --init led-board/third_party/rpi-rgb-led-matrix
```
