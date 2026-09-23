import { CanvasDotPainter } from '../../src/components/displays/LedBoard/CanvasDotPainter'
import { createDotPainter } from '../../src/components/displays/LedBoard/DotPainter'
import { createCanvas } from '../../src/components/displays/LedBoard/dotMask'
import { WebGLDotPainter } from '../../src/components/displays/LedBoard/WebGLDotPainter'

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function read(canvas: HTMLCanvasElement) {
  const copy = createCanvas(canvas.width, canvas.height)
  const context = copy.getContext('2d', { willReadFrequently: true })!
  // Compare compositing as well as shape: the Daktronics face is grey behind transparent LEDs.
  context.fillStyle = '#242424'
  context.fillRect(0, 0, copy.width, copy.height)
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, copy.width, copy.height).data
}

function compare(a: HTMLCanvasElement, b: HTMLCanvasElement, label: string) {
  const expected = read(a)
  const actual = read(b)
  check(expected.length === actual.length, `${label}: dimensions differ`)
  let max = 0
  let differing = 0
  const examples = []
  for (let i = 0; i < actual.length; i++) {
    const delta = Math.abs(actual[i] - expected[i])
    max = Math.max(max, delta)
    if (delta > 1) {
      differing++
      if (examples.length < 8)
        examples.push({
          x: Math.floor(i / 4) % a.width,
          y: Math.floor(i / 4 / a.width),
          channel: i % 4,
          expected: expected[i],
          actual: actual[i],
        })
    }
  }
  check(differing === 0, `${label}: ${differing} channels differ, maximum delta ${max}: ${JSON.stringify(examples)}`)
}

function pattern(columns: number, rows: number, phase = 0) {
  const pixels = new Uint8Array(columns * rows * 3)
  const colours = [
    [0, 0, 0],
    [230, 150, 0],
    [239, 239, 239],
    [115, 75, 0],
    [0, 0, 255],
    [0, 255, 0],
  ]
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) pixels.set(colours[(x * 7 + y * 11 + phase) % colours.length], (y * columns + x) * 3)
  }
  return pixels
}

function verifyNearest(canvas: HTMLCanvasElement, pixels: Uint8Array, columns: number, rows: number) {
  const actual = read(canvas)
  // At an exact boundary either neighbouring source pixel is equally near. Canvas 2D and GL can break that tie
  // differently when the pitch is too small for a dot mask, so check nearest-neighbour sampling directly here.
  const candidates = (position: number, count: number) => {
    const rounded = Math.round(position)
    return Math.abs(position - rounded) < 0.0001 ? [Math.max(0, rounded - 1), Math.min(count - 1, rounded)] : [Math.floor(position)]
  }
  for (let y = 0; y < canvas.height; y++) {
    const ys = candidates(((y + 0.5) * rows) / canvas.height, rows)
    for (let x = 0; x < canvas.width; x++) {
      const xs = candidates(((x + 0.5) * columns) / canvas.width, columns)
      const to = (y * canvas.width + x) * 4
      check(
        ys.some(sy =>
          xs.some(sx => {
            const from = (sy * columns + sx) * 3
            const lit = pixels[from] || pixels[from + 1] || pixels[from + 2]
            return [0, 1, 2].every(channel => actual[to + channel] === (lit ? pixels[from + channel] : 36))
          }),
        ),
        `Small canvas sampled the wrong LED at ${x}, ${y}`,
      )
    }
  }
}

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

export async function verify() {
  let cases = 0
  for (const [columns, rows] of [
    [193, 36],
    [272, 70],
  ]) {
    const gpu = createDotPainter(columns, rows)
    check(gpu instanceof WebGLDotPainter, 'Hardware WebGL is required to verify the GPU renderer')
    const cpu = new CanvasDotPainter(createCanvas(columns, rows), columns, rows)
    const pixels = pattern(columns, rows)
    try {
      cpu.paint(pixels)
      gpu.paint(pixels)
      compare(cpu.canvas, gpu.canvas, 'frame received before the initial resize notification')
      cases++
      // Includes no mask, square dots, round dots, fractional scale, and large screens.
      for (const scale of [1, 2, 3, 4, 5.37, 8]) {
        const width = Math.round(columns * scale)
        const height = Math.round(rows * scale)
        cpu.resize(width, height)
        gpu.resize(width, height)
        cpu.paint(pixels)
        gpu.paint(pixels)
        compare(cpu.canvas, gpu.canvas, `${columns}×${rows} at ${scale}×`)
        cases++
      }
      for (const scale of [0.75, 2.5]) {
        gpu.resize(Math.round(columns * scale), Math.round(rows * scale))
        verifyNearest(gpu.canvas, pixels, columns, rows)
        cases++
      }
      gpu.resize(cpu.canvas.width, cpu.canvas.height)
      // The WASM runtime mutates one persistent buffer, including LEDs that become unlit.
      pixels.set(pattern(columns, rows, 1))
      cpu.paint(pixels)
      gpu.paint(pixels)
      await nextFrame()
      await nextFrame()
      compare(cpu.canvas, gpu.canvas, 'changed frame retained between animation frames')
      cpu.resize(1001, 259)
      gpu.resize(1001, 259)
      compare(cpu.canvas, gpu.canvas, 'resize repaints without a new frame')

      const gl = gpu.canvas.getContext('webgl')!
      const extension = gl.getExtension('WEBGL_lose_context')!
      check(extension, 'Context loss extension unavailable')
      const lost = new Promise(resolve => gpu.canvas.addEventListener('webglcontextlost', resolve, { once: true }))
      extension.loseContext()
      await lost
      await nextFrame()
      pixels.fill(0)
      pixels.set([230, 150, 0], (columns + 1) * 3)
      cpu.paint(pixels)
      gpu.paint(pixels)
      cpu.resize(997, 251)
      gpu.resize(997, 251)
      const restored = new Promise(resolve => gpu.canvas.addEventListener('webglcontextrestored', resolve, { once: true }))
      extension.restoreContext()
      await restored
      compare(cpu.canvas, gpu.canvas, 'context restoration uses the latest frame and size')
      check(gl.getError() === gl.NO_ERROR, 'WebGL reported an error')
      cases += 3
    } finally {
      cpu.dispose()
      gpu.dispose()
    }
  }

  const original = HTMLCanvasElement.prototype.getContext
  for (const failure of ['unavailable', 'shader'] as const) {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl') {
        if (failure === 'unavailable') return null
        const gl = original.call(this, type, ...args) as WebGLRenderingContext
        gl.getProgramParameter = () => false
        return gl
      }
      return original.call(this, type, ...args)
    } as typeof original
    try {
      const painter = createDotPainter(193, 36)
      check(painter instanceof CanvasDotPainter, `${failure}: should use Canvas 2D`)
      painter.resize(386, 72)
      painter.paint(pattern(193, 36))
      const before = painter.canvas.toDataURL()
      painter.resize(386, 72)
      check(painter.canvas.toDataURL() === before, 'unchanged size must preserve the frame without a dot mask')
      painter.dispose()
      cases++
    } finally {
      HTMLCanvasElement.prototype.getContext = original
    }
  }
  return `${cases} renderer checks passed: visual parity, retained frames, resize, context recovery, and Canvas 2D fallback.`
}

export async function benchmark() {
  const columns = 272
  const rows = 70
  const results = []
  for (const width of [1920, 3840]) {
    const gpu = createDotPainter(columns, rows)
    check(gpu instanceof WebGLDotPainter, 'Benchmark requires hardware WebGL')
    const cpu = new CanvasDotPainter(createCanvas(columns, rows), columns, rows)
    const pixels = pattern(columns, rows)
    const timings: Record<string, number> = {}
    try {
      for (const [name, painter] of [
        ['Canvas 2D', cpu],
        ['WebGL', gpu],
      ] as const) {
        painter.resize(width, Math.round((width * rows) / columns))
        document.body.appendChild(painter.canvas)
        const samples = []
        // One draw per browser frame, without readback in the timed path; measure main-thread submission time.
        for (let i = 0; i < 150; i++) {
          await nextFrame()
          pixels[0] = i % 2 ? 230 : 0
          const start = performance.now()
          painter.paint(pixels)
          if (i >= 30) samples.push(performance.now() - start)
        }
        timings[name] = Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(3))
        painter.canvas.remove()
      }
      results.push({ width, 'mean paint time (ms)': timings })
    } finally {
      gpu.dispose()
      cpu.dispose()
    }
  }
  return results
}
