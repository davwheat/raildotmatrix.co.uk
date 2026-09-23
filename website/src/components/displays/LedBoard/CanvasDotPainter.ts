import { createCanvas, dotMask } from './dotMask'

/** Draws a board's frames on a canvas as round LEDs, one per pixel, at the canvas's own resolution. */
export class CanvasDotPainter {
  private readonly context: CanvasRenderingContext2D
  private readonly frame: HTMLCanvasElement
  private readonly frameContext: CanvasRenderingContext2D
  private readonly image: ImageData
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
