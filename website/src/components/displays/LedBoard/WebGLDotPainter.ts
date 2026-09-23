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
    this.sized = true
    if (this.pixels) this.paint(this.pixels)
  }

  paint(pixels: Uint8Array) {
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
