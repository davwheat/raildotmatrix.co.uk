import { dotMask } from './dotMask'

const VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D frame;
  uniform sampler2D mask;
  uniform vec2 resolution;
  void main() {
    // Frame and mask uploads both start at the top left; GL's framebuffer starts at the bottom left.
    vec2 uv = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y) / resolution;
    vec3 rgb = texture2D(frame, uv).rgb;
    float alpha = any(greaterThan(rgb, vec3(0.0))) ? texture2D(mask, uv).a : 0.0;
    // The canvas is composited with premultiplied alpha, so unlit LEDs leave its CSS background visible.
    gl_FragColor = vec4(rgb * alpha, alpha);
  }
`

/** Uploads only the board's packed RGB each frame; scaling and the cached dot mask are combined on the GPU. */
export class WebGLDotPainter {
  private program: WebGLProgram | null = null
  private vertices: WebGLBuffer | null = null
  private frame: WebGLTexture | null = null
  private mask: WebGLTexture | null = null
  private resolution: WebGLUniformLocation | null = null
  private pixels: Uint8Array | null = null
  private sized = false
  private previous: Uint8Array | null = null
  private previousWords: Uint32Array | null = null
  private words: Uint32Array | null = null
  private wordPixels: Uint8Array | null = null
  private bands: number[] = []

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGLRenderingContext,
    private readonly columns: number,
    private readonly rows: number,
  ) {
    try {
      this.initialise()
    } catch (error) {
      this.deleteResources()
      throw error
    }
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
  }

  private readonly onLost = (event: Event) => {
    // Opt into restoration. The animation loop may keep receiving frames while the GPU is unavailable.
    event.preventDefault()
  }

  private readonly onRestored = () => {
    this.initialise()
    this.sized = false
    this.resize(this.canvas.width, this.canvas.height)
  }

  private initialise() {
    this.previous = null
    const gl = this.gl
    this.program = gl.createProgram()
    if (!this.program) throw new Error('Could not create the LED shader program')
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) throw new Error('Could not create an LED shader')
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      // Linking below validates both shaders. Mark them for deletion once the program releases them.
      gl.attachShader(this.program!, shader)
      gl.deleteShader(shader)
    }
    compile(gl.VERTEX_SHADER, VERTEX_SHADER)
    compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    gl.linkProgram(this.program)
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Could not link the LED shaders')
    gl.useProgram(this.program)

    this.vertices = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(this.program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    this.resolution = gl.getUniformLocation(this.program, 'resolution')
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.uniform2f(this.resolution, this.canvas.width, this.canvas.height)
    gl.uniform1i(gl.getUniformLocation(this.program, 'frame'), 0)
    gl.uniform1i(gl.getUniformLocation(this.program, 'mask'), 1)
    gl.disable(gl.DITHER)
    // Daktronics rows are 193 * 3 bytes, which are not aligned to WebGL's default four-byte boundary.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)

    this.frame = this.texture(0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, this.columns, this.rows, 0, gl.RGB, gl.UNSIGNED_BYTE, null)
    this.mask = this.texture(1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    if (gl.getError() !== gl.NO_ERROR) throw new Error('Could not initialise the LED textures')
  }

  private texture(unit: number) {
    const gl = this.gl
    const texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  resize(width: number, height: number) {
    if (width === 0 || height === 0 || (width === this.canvas.width && height === this.canvas.height && this.sized)) return
    this.canvas.width = width
    this.canvas.height = height
    if (this.gl.isContextLost()) return
    const gl = this.gl
    gl.viewport(0, 0, width, height)
    gl.uniform2f(this.resolution, width, height)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.mask)
    const mask = dotMask(width, height, this.columns, this.rows)
    if (mask) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    // A resized drawing buffer needs a complete repaint, including when it
    // becomes too small for comparing/cropping rows to be worthwhile.
    this.previous = null
    this.previousWords = null
    gl.disable(gl.SCISSOR_TEST)
    this.sized = true
    if (this.pixels) this.paint(this.pixels)
  }

  // Split separated damage so unchanged rows between bands need no GPU draw.
  private paintChangedBands(pixels: Uint8Array, top: number, bottom: number): boolean {
    const previous = this.previous!
    const stride = this.columns * 3
    let changed = 0
    // Dense changes use the existing single draw without scanning every row.
    for (let sy = 0; sy < 4; sy++)
      for (let sx = 0; sx < 4; sx++) {
        const at = (top + Math.floor((sy * (bottom - top - 1)) / 3)) * stride + Math.floor((sx * (this.columns - 1)) / 3) * 3
        if (pixels[at] !== previous[at] || pixels[at + 1] !== previous[at + 1] || pixels[at + 2] !== previous[at + 2]) changed++
      }
    if (changed >= 12) return false
    const bands = this.bands
    bands.length = 0
    let start = -1,
      left = this.columns,
      right = 0
    for (let row = top; row < bottom; row++) {
      const offset = row * stride
      let x = 0
      for (; x < this.columns; x++) {
        const p = offset + x * 3
        if (pixels[p] !== previous[p] || pixels[p + 1] !== previous[p + 1] || pixels[p + 2] !== previous[p + 2]) break
      }
      if (x === this.columns) {
        if (start >= 0) {
          bands.push(left, start, right, row)
          if (bands.length > 32) return false
          start = -1
          left = this.columns
          right = 0
        }
        continue
      }
      if (start < 0) start = row
      left = Math.min(left, x)
      x = this.columns
      for (; x > right; x--) {
        const p = offset + (x - 1) * 3
        if (pixels[p] !== previous[p] || pixels[p + 1] !== previous[p + 1] || pixels[p + 2] !== previous[p + 2]) break
      }
      right = Math.max(right, x)
    }
    if (start >= 0) bands.push(left, start, right, bottom)
    if (bands.length > 32) return false
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.frame)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.columns, this.rows, gl.RGB, gl.UNSIGNED_BYTE, pixels)
    for (let i = 0; i < bands.length; i += 4) {
      const x0 = Math.floor((bands[i] * this.canvas.width) / this.columns)
      const y0 = Math.floor((bands[i + 1] * this.canvas.height) / this.rows)
      const x1 = Math.ceil((bands[i + 2] * this.canvas.width) / this.columns)
      const y1 = Math.ceil((bands[i + 3] * this.canvas.height) / this.rows)
      gl.scissor(x0, this.canvas.height - y1, x1 - x0, y1 - y0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    previous.set(pixels)
    return true
  }

  paint(pixels: Uint8Array) {
    // On smaller canvases the complete GPU draw costs less than scanning RGB.
    if (this.canvas.width * this.canvas.height < 1_000_000) return this.paintWhole(pixels)
    if (this.wordPixels !== pixels) {
      this.wordPixels = pixels
      this.words = (pixels.byteOffset & 3) === 0 ? new Uint32Array(pixels.buffer, pixels.byteOffset, Math.floor(pixels.length / 4)) : null
    }
    this.pixels = pixels
    if (this.gl.isContextLost()) return
    const gl = this.gl
    let first = 0,
      end = pixels.length
    if (this.previous) {
      if (this.words) {
        const words = this.words
        const previous = this.previousWords!
        let word = 0,
          last = words.length
        while (word < last && words[word] === previous[word]) word++
        first = word * 4
        while (end > words.length * 4 && pixels[end - 1] === this.previous[end - 1]) end--
        if (end === words.length * 4) {
          while (last > word && words[last - 1] === previous[last - 1]) last--
          end = last * 4
        }
      } else {
        while (first < end && pixels[first] === this.previous[first]) first++
        while (end > first && pixels[end - 1] === this.previous[end - 1]) end--
      }
      if (first >= end) return
    }
    // Expand to whole source rows and conservative device-pixel boundaries.
    // Adjacent unchanged pixels are safe to redraw; changed pixels cannot be omitted.
    const top = Math.floor(first / (this.columns * 3))
    const bottom = Math.ceil(end / (this.columns * 3))
    const topPixel = Math.floor((top * this.canvas.height) / this.rows)
    const bottomPixel = Math.ceil((bottom * this.canvas.height) / this.rows)
    gl.enable(gl.SCISSOR_TEST)
    if (this.previous && this.paintChangedBands(pixels, top, bottom)) return
    let left = 0,
      right = this.columns
    if (this.previous) {
      left = this.columns
      right = 0
      const previous = this.previous
      for (let row = top; row < bottom; row++) {
        const offset = row * this.columns * 3
        let x = 0
        while (x < left) {
          const p = offset + x * 3
          if (pixels[p] !== previous[p] || pixels[p + 1] !== previous[p + 1] || pixels[p + 2] !== previous[p + 2]) break
          x++
        }
        left = x
        x = this.columns
        while (x > right) {
          const p = offset + (x - 1) * 3
          if (pixels[p] !== previous[p] || pixels[p + 1] !== previous[p + 1] || pixels[p + 2] !== previous[p + 2]) break
          x--
        }
        right = x
        if (left === 0 && right === this.columns) break
      }
    }
    const leftPixel = Math.floor((left * this.canvas.width) / this.columns)
    const rightPixel = Math.ceil((right * this.canvas.width) / this.columns)
    gl.scissor(leftPixel, this.canvas.height - bottomPixel, rightPixel - leftPixel, bottomPixel - topPixel)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.frame)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.columns, this.rows, gl.RGB, gl.UNSIGNED_BYTE, pixels)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    if (this.previous) this.previous.set(pixels)
    else {
      this.previous = new Uint8Array(pixels)
      this.previousWords = new Uint32Array(this.previous.buffer, 0, Math.floor(pixels.length / 4))
    }
  }

  private paintWhole(pixels: Uint8Array) {
    this.pixels = pixels
    if (this.gl.isContextLost()) return
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.frame)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.columns, this.rows, gl.RGB, gl.UNSIGNED_BYTE, pixels)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private deleteResources() {
    this.gl.deleteTexture(this.frame)
    this.gl.deleteTexture(this.mask)
    this.gl.deleteBuffer(this.vertices)
    this.gl.deleteProgram(this.program)
  }

  dispose() {
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    this.deleteResources()
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
