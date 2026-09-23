import { CanvasDotPainter } from './CanvasDotPainter'
import { createCanvas } from './dotMask'
import { WebGLDotPainter } from './WebGLDotPainter'

export interface DotPainter {
  readonly canvas: HTMLCanvasElement
  resize(width: number, height: number): void
  paint(pixels: Uint8Array): void
  dispose(): void
}

/** Prefer a GPU draw; keep the Canvas 2D renderer for browsers without hardware WebGL. */
export function createDotPainter(columns: number, rows: number): DotPainter {
  const canvas = createCanvas(columns, rows)
  const gl = canvas.getContext('webgl', {
    antialias: false,
    depth: false,
    stencil: false,
    // Boards only draw when their pixels change. Retain that frame, including for screenshots.
    preserveDrawingBuffer: true,
    failIfMajorPerformanceCaveat: true,
  })
  if (gl) {
    try {
      return new WebGLDotPainter(canvas, gl, columns, rows)
    } catch {
      // A failed shader/texture setup must not prevent the board from loading.
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }
  // A canvas that acquired a WebGL context cannot subsequently acquire a 2D context.
  return new CanvasDotPainter(createCanvas(columns, rows), columns, rows)
}
