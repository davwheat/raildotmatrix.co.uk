"use strict";
// The settings page draws its previews with the board's own renderer, compiled to WebAssembly, so that a preview
// shows what the panel shows. The manager embeds the module; see cmd/wasm for its API.
const boardPreview = (() => {
  let bundle;
  function load() {
    if (!bundle) {
      bundle = start();
      // A failure isn't kept, so that a later preview, such as after a network blip, tries again.
      bundle.catch(() => (bundle = undefined));
    }
    return bundle;
  }
  async function start() {
    const response = await fetch("/boards/manifest.json");
    if (!response.ok)
      throw new Error("This build of the board software has no previews.");
    const manifest = await response.json();
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/boards/" + manifest.exec;
      script.onload = resolve;
      script.onerror = () => reject(new Error("The previews couldn't load."));
      document.head.append(script);
    });
    const go = new Go();
    const { instance } = await WebAssembly.instantiateStreaming(
      fetch("/boards/" + manifest.wasm),
      go.importObject,
    );
    return new Promise((resolve, reject) => {
      globalThis.ledDepartureBoardReady = resolve;
      go.run(instance).then(
        () => reject(new Error("The previews stopped.")),
        reject,
      );
    });
  }

  // Gaps between dots are the canvas's own background. An unlit dot is drawn dimly, as on a panel that's switched on,
  // unless the dots are too small to have gaps, when it would tint the whole board.
  const unlit = [34, 30, 26];
  const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  const masks = new Map();

  function canvas(width, height) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
  }
  // Mirrors the website's dotMask: a disc in each dot's cell, with cell edges rounded as nearest-neighbour scaling
  // rounds them, so that each disc takes its whole colour from one dot.
  function mask(width, height, columns, rows) {
    const key = [width, height, columns, rows].join();
    if (masks.has(key)) return masks.get(key);
    const pitch = Math.min(width / columns, height / rows);
    let result = null;
    if (pitch >= 3) {
      const uneven =
        !Number.isInteger(width / columns) || !Number.isInteger(height / rows);
      const minGap = uneven && pitch >= 5 ? 2 : 1;
      const size = Math.min(
        Math.floor(pitch - Math.max(1, pitch / 5)),
        Math.floor(pitch) - minGap,
      );
      const dot = canvas(size, size);
      const dotContext = dot.getContext("2d");
      if (size > 2) {
        dotContext.beginPath();
        dotContext.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
        dotContext.fill();
      } else dotContext.fillRect(0, 0, size, size);
      const edges = (count, length) =>
        Array.from({ length: count + 1 }, (_, i) =>
          Math.round((i * length) / count),
        );
      const inset = (edges, i) =>
        edges[i] + Math.floor((edges[i + 1] - edges[i] - size) / 2);
      const xs = edges(columns, width);
      const row = canvas(width, size);
      for (let x = 0; x < columns; x++)
        row.getContext("2d").drawImage(dot, inset(xs, x), 0);
      const ys = edges(rows, height);
      result = canvas(width, height);
      for (let y = 0; y < rows; y++)
        result.getContext("2d").drawImage(row, 0, inset(ys, y));
    }
    masks.set(key, result);
    return result;
  }

  // Dots paints frames on a canvas as round LEDs, sized to the canvas's own pixels so that every dot stays sharp.
  // A crop, in dots, shows part of the frame. With maxPitch, a dot is at most that many CSS pixels across, so that a
  // small crop isn't blown up to fill a wide card.
  class Dots {
    constructor(target, maxPitch) {
      this.canvas = target;
      this.context = target.getContext("2d");
      this.maxPitch = maxPitch;
      new ResizeObserver(() => this.resize()).observe(target);
    }
    resize() {
      const ratio = devicePixelRatio || 1;
      const width = Math.round(this.canvas.clientWidth * ratio),
        height = Math.round(this.canvas.clientHeight * ratio);
      if (!width || !height) return;
      if (width === this.canvas.width && height === this.canvas.height) return;
      this.canvas.width = width;
      this.canvas.height = height;
      if (this.still) this.paint(this.still, this.crop);
    }
    paint(still, crop = { x: 0, y: 0, w: still.width, h: still.height }) {
      this.still = still;
      this.crop = crop;
      // A margin one dot wide, with no dots in it, keeps the dots at the board's edge off the edge of the picture.
      const w = crop.w + 2,
        h = crop.h + 2;
      this.canvas.style.aspectRatio = w + " / " + h;
      if (this.maxPitch) this.canvas.style.maxWidth = w * this.maxPitch + "px";
      if (!this.frame || this.frame.width !== w || this.frame.height !== h) {
        this.frame = canvas(w, h);
        this.image = this.frame.getContext("2d").createImageData(w, h);
        this.packed = new Uint32Array(this.image.data.buffer);
      }
      const { context, canvas: target } = this;
      const dots = mask(target.width, target.height, w, h);
      const [ur, ug, ub] = dots ? unlit : [0, 0, 0];
      const { pixels, width } = still;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (x === 0 || y === 0 || x > crop.w || y > crop.h) {
            this.packed[y * w + x] = 0;
            continue;
          }
          const from = ((crop.y + y - 1) * width + crop.x + x - 1) * 3;
          let r = pixels[from],
            g = pixels[from + 1],
            b = pixels[from + 2];
          if (!(r || g || b)) [r, g, b] = [ur, ug, ub];
          this.packed[y * w + x] = littleEndian
            ? r | (g << 8) | (b << 16) | (255 << 24)
            : (r << 24) | (g << 16) | (b << 8) | 255;
        }
      }
      this.frame.getContext("2d").putImageData(this.image, 0, 0);
      context.imageSmoothingEnabled = false;
      context.globalCompositeOperation = "copy";
      context.drawImage(this.frame, 0, 0, target.width, target.height);
      if (dots) {
        context.globalCompositeOperation = "destination-in";
        context.drawImage(dots, 0, 0);
      }
    }
  }

  // difference returns the box, in dots, that holds every dot where the frames differ, or null if they're the same.
  function difference(stills) {
    const [first, ...rest] = stills;
    if (rest.some((s) => s.width !== first.width || s.height !== first.height))
      return { x: 0, y: 0, w: first.width, h: first.height };
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -1,
      y1 = -1;
    for (const still of rest) {
      for (let i = 0; i < first.pixels.length; i += 3) {
        if (
          first.pixels[i] !== still.pixels[i] ||
          first.pixels[i + 1] !== still.pixels[i + 1] ||
          first.pixels[i + 2] !== still.pixels[i + 2]
        ) {
          const x = (i / 3) % first.width,
            y = Math.floor(i / 3 / first.width);
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // around grows a box of changed dots into a crop that shows them with some of the board around them. A crop that
  // would take most of the board's width or height takes all of it, so that small thumbnails stay readable.
  function around(box, width, height) {
    const pad = 4;
    let w = Math.max(box.w + 4 * pad, 96),
      h = Math.max(box.h + 2 * pad, 16);
    w = Math.max(w, Math.round(h * 1.6));
    let x, y;
    [x, w] = fit(box.x + box.w / 2, w, width);
    // A strip much wider than this would make the dots too small to read in a card.
    h = Math.max(h, Math.round(w / 5));
    [y, h] = fit(box.y + box.h / 2, h, height);
    return { x, y, w, h };
    function fit(centre, length, total) {
      if (length > total * 0.6) return [0, total];
      const start = Math.round(centre - length / 2);
      return [Math.min(Math.max(start, 0), total - length), length];
    }
  }

  return { load, Dots, difference, around };
})();
