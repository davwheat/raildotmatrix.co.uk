/** Draws a board's frames on a canvas as round LEDs, one per pixel, at the canvas's own resolution. */
export class DotPainter {
  private readonly context: CanvasRenderingContext2D
  private readonly frame: HTMLCanvasElement
  private readonly frameContext: CanvasRenderingContext2D
  private readonly image: ImageData
  private mask: HTMLCanvasElement | null = null
  private pixels: Uint8Array | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly columns: number,
    private readonly rows: number,
  ) {
    this.context = canvas.getContext('2d')!
    this.frame = createCanvas(columns, rows)
    this.frameContext = this.frame.getContext('2d')!
    this.image = this.frameContext.createImageData(columns, rows)
  }

  /** Takes the canvas's size in device pixels, so that every dot lands on whole pixels and stays sharp. */
  resize(width: number, height: number) {
    if (width === 0 || height === 0 || (width === this.canvas.width && height === this.canvas.height && this.mask)) return
    this.canvas.width = width
    this.canvas.height = height
    this.mask = dotMask(width, height, this.columns, this.rows)
    // Resizing a canvas clears it, and the board only reports a frame when it changes.
    if (this.pixels) this.paint(this.pixels)
  }

  /** Draws a frame of packed RGB. An unlit dot is left transparent, so the board's face shows through it. */
  paint(pixels: Uint8Array) {
    this.pixels = pixels
    const rgba = this.image.data
    for (let from = 0, to = 0; from < pixels.length; from += 3, to += 4) {
      rgba[to] = pixels[from]
      rgba[to + 1] = pixels[from + 1]
      rgba[to + 2] = pixels[from + 2]
      rgba[to + 3] = rgba[to] || rgba[to + 1] || rgba[to + 2] ? 255 : 0
    }
    this.frameContext.putImageData(this.image, 0, 0)

    const { context, canvas } = this
    context.imageSmoothingEnabled = false
    context.globalCompositeOperation = 'copy'
    context.drawImage(this.frame, 0, 0, canvas.width, canvas.height)
    if (this.mask) {
      context.globalCompositeOperation = 'destination-in'
      context.drawImage(this.mask, 0, 0)
    }
  }
}

/**
 * Returns an alpha mask with a disc inside each pixel's cell of the scaled-up frame, or null when the cells are too
 * small to hold one. The cell edges are rounded exactly as nearest-neighbour scaling rounds them, so each disc takes
 * its whole colour from one pixel. Every disc is the same whole number of device pixels across, which keeps them
 * identical where the pitch isn't a whole number; the spacing absorbs the difference instead.
 */
function dotMask(width: number, height: number, columns: number, rows: number): HTMLCanvasElement | null {
  const pitch = Math.min(width / columns, height / rows)
  if (pitch < 3) return null

  // The gap matches the desktop preview window's dots in the Go repository.
  const size = Math.floor(pitch - Math.max(1, pitch / 5))
  const dot = createCanvas(size, size)
  const dotContext = dot.getContext('2d')!
  // A disc two pixels across is all antialiased edge, which dims it; a square that size still reads as a dot.
  if (size > 2) {
    dotContext.beginPath()
    dotContext.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI)
    dotContext.fill()
  } else {
    dotContext.fillRect(0, 0, size, size)
  }

  const edges = (count: number, length: number) => Array.from({ length: count + 1 }, (_, i) => Math.round((i * length) / count))
  const inset = (edges: number[], i: number) => edges[i] + Math.floor((edges[i + 1] - edges[i] - size) / 2)

  const xs = edges(columns, width)
  const row = createCanvas(width, size)
  const rowContext = row.getContext('2d')!
  for (let x = 0; x < columns; x++) rowContext.drawImage(dot, inset(xs, x), 0)

  const ys = edges(rows, height)
  const mask = createCanvas(width, height)
  const maskContext = mask.getContext('2d')!
  for (let y = 0; y < rows; y++) maskContext.drawImage(row, 0, inset(ys, y))
  return mask
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}
