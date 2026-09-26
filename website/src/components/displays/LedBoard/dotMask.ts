/**
 * Returns an alpha mask with a disc inside each pixel's cell of the scaled-up frame, or null when the cells are too
 * small to hold one. The cell edges are rounded exactly as nearest-neighbour scaling rounds them, so each disc takes
 * its whole colour from one pixel. Every disc is the same whole number of device pixels across, which keeps them
 * identical where the pitch isn't a whole number; the spacing absorbs the difference instead.
 */
export const MIN_DOT_PITCH = 3

export function dotMask(width: number, height: number, columns: number, rows: number): HTMLCanvasElement | null {
  const pitch = Math.min(width / columns, height / rows)
  if (pitch < MIN_DOT_PITCH) return null

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

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}
