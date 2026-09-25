import { createCanvas, dotMask } from './dotMask'

const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

/** Draws a board's frames on a canvas as round LEDs, one per pixel, at the canvas's own resolution. */
export class CanvasDotPainter {
  private readonly context: CanvasRenderingContext2D
  private readonly frame: HTMLCanvasElement
  private readonly frameContext: CanvasRenderingContext2D
  private readonly image: ImageData
  private readonly packed: Uint32Array
  private mask: HTMLCanvasElement | null = null
  private pixels: Uint8Array | null = null
  private sized = false

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly columns: number,
    private readonly rows: number,
  ) {
    this.context = canvas.getContext('2d')!
    this.frame = createCanvas(columns, rows)
    this.frameContext = this.frame.getContext('2d')!
    this.image = this.frameContext.createImageData(columns, rows)
    this.packed = new Uint32Array(this.image.data.buffer, this.image.data.byteOffset, columns * rows)
  }

  dispose() {}

  /** Takes the canvas's size in device pixels, so that every dot lands on whole pixels and stays sharp. */
  resize(width: number, height: number) {
    if (width === 0 || height === 0 || (width === this.canvas.width && height === this.canvas.height && this.sized)) return
    this.canvas.width = width
    this.canvas.height = height
    this.mask = dotMask(width, height, this.columns, this.rows)
    this.sized = true
    // Resizing a canvas clears it, and the board only reports a frame when it changes.
    if (this.pixels) this.paint(this.pixels)
  }

  /** Draws a frame of packed RGB. An unlit dot is left transparent, so the board's face shows through it. */
  paint(pixels: Uint8Array) {
    this.pixels = pixels
    for (let from = 0, to = 0; from < pixels.length; from += 3, to++) {
      const r = pixels[from],
        g = pixels[from + 1],
        b = pixels[from + 2]
      const alpha = r || g || b ? 255 : 0
      this.packed[to] = littleEndian ? r | (g << 8) | (b << 16) | (alpha << 24) : (r << 24) | (g << 16) | (b << 8) | alpha
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
