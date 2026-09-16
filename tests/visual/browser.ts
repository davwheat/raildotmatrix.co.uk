import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Long enough for a cold page load, short enough that a wedged browser fails the run rather than stalling it. */
const COMMAND_TIMEOUT = 60_000

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((path): path is string => !!path)

export interface CaptureRequest {
  url: string
  selector: string
  viewport: { width: number; height: number }
  preloadScript: string
  freezeStyles: string
  pinAnimations: string
  blinkingAnimation: string
}

export class Browser {
  private constructor(
    private readonly process: ChildProcess,
    private readonly socket: WebSocket,
    private readonly profile: string,
  ) {}

  private nextId = 0
  private closed = false
  private readonly pending = new Map<number, { resolve: (result: any) => void; reject: (error: Error) => void }>()

  static async launch(): Promise<Browser> {
    const profile = await mkdtemp(join(tmpdir(), 'board-visual-'))
    const port = 9222 + Math.floor(Math.random() * 500)
    const executable = CHROME_CANDIDATES.find(path => existsSync(path))
    if (!executable) {
      throw new Error(`No Chrome found. Set CHROME_PATH, or install it to one of: ${CHROME_CANDIDATES.join(', ')}`)
    }

    const child = spawn(
      executable,
      [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        '--disable-lcd-text',
        '--force-color-profile=srgb',
        '--font-render-hinting=none',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        // CI images install Chrome for Testing, whose sandbox helper is not setuid root, so the sandbox cannot start.
        '--no-sandbox',
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )

    // Chrome explains its own launch failures on stderr, and without this the only symptom is a port that never opens.
    let complaints = ''
    child.stderr?.on('data', chunk => {
      complaints = (complaints + chunk).slice(-2000)
    })
    let exit: string | null = null
    child.on('exit', (code, signal) => {
      exit = signal ? `killed by ${signal}` : `exited with code ${code}`
    })

    const endpoint = await waitFor(
      async () => {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`)
        return (await response.json()).webSocketDebuggerUrl as string
      },
      () =>
        [
          `Chrome did not expose a debugging endpoint`,
          `  ran: ${executable}`,
          exit && `  ${exit}`,
          complaints && `  stderr: ${complaints.trim()}`,
        ]
          .filter(Boolean)
          .join('\n'),
      () => exit !== null,
    )

    const socket = new WebSocket(endpoint)
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve()
      socket.onerror = () => reject(new Error('Could not attach to Chrome'))
    })

    const browser = new Browser(child, socket, profile)
    socket.onmessage = event => browser.receive(String(event.data))
    // A crashed browser must fail the calls waiting on it; otherwise the run hangs with no output at all.
    child.on('exit', () => browser.abandon('Chrome exited'))
    socket.onclose = () => browser.abandon('Chrome closed the debugging connection')
    return browser
  }

  private receive(raw: string) {
    const message = JSON.parse(raw)
    const waiter = this.pending.get(message.id)
    if (!waiter) return
    this.pending.delete(message.id)
    if (message.error) waiter.reject(new Error(message.error.message || JSON.stringify(message.error)))
    else waiter.resolve(message.result)
  }

  private abandon(reason: string) {
    this.closed = true
    for (const waiter of this.pending.values()) waiter.reject(new Error(reason))
    this.pending.clear()
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<any> {
    if (this.closed) return Promise.reject(new Error('Chrome is no longer running'))

    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method} did not respond within ${COMMAND_TIMEOUT / 1000}s`))
      }, COMMAND_TIMEOUT)

      this.pending.set(id, {
        resolve: result => {
          clearTimeout(timer)
          resolve(result)
        },
        reject: error => {
          clearTimeout(timer)
          reject(error)
        },
      })
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }

  async close() {
    this.closed = true
    this.socket.close()
    const exited = new Promise<void>(resolve => this.process.once('exit', () => resolve()))
    this.process.kill()
    // Chrome keeps writing to its profile until it is gone, so removing it any earlier races the flush.
    await Promise.race([exited, delay(5_000)])
    await rm(this.profile, { recursive: true, force: true }).catch(() => {})
  }

  /** Returns a base64 PNG of the board, cropped to its own element. */
  async capture(request: CaptureRequest): Promise<string> {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true })

    try {
      await this.send('Page.enable', {}, sessionId)
      await this.send('Runtime.enable', {}, sessionId)
      await this.send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/London' }, sessionId)
      await this.send('Emulation.setDeviceMetricsOverride', { ...request.viewport, deviceScaleFactor: 1, mobile: false }, sessionId)
      await this.send('Page.addScriptToEvaluateOnNewDocument', { source: request.preloadScript }, sessionId)
      await this.send('Page.navigate', { url: request.url }, sessionId)

      const evaluate = (expression: string) =>
        this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId).then(result => {
          if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
          return result.result.value
        })

      await this.settle(evaluate, request)
      await evaluate(`
        (() => {
          const style = document.createElement('style')
          style.textContent = ${JSON.stringify(request.freezeStyles)}
          document.head.appendChild(style)
        })()
      `)
      await this.settle(evaluate, request)
      // Pinning runs last: a later style change would recompute the animations this pass has just settled.
      await evaluate(request.pinAnimations)
      await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`)

      const rect = await evaluate(`
        (() => {
          const box = document.querySelector(${JSON.stringify(request.selector)}).getBoundingClientRect()
          return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }
        })()
      `)
      const { data } = await this.send(
        'Page.captureScreenshot',
        { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 1 } },
        sessionId,
      )
      return data
    } finally {
      await this.send('Target.closeTarget', { targetId }).catch(() => {})
    }
  }

  /**
   * Waits for fonts, for the board's markup to stop changing, and for its entrance animations to finish. Markup
   * alone is not enough: a board holds one layout for the length of a slide-in and only then renders the next, so a
   * capture taken during that hold looks settled while a row is still missing.
   */
  private async settle(evaluate: (expression: string) => Promise<any>, request: CaptureRequest) {
    let previous: string | null = null
    let stableRuns = 0
    let pending: string[] = []

    for (let attempt = 0; attempt < 60; attempt++) {
      await delay(250)
      const state = await evaluate(`
        (async () => {
          const element = document.querySelector(${JSON.stringify(request.selector)})
          if (!element) return null
          await document.fonts.ready
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

          // Only an entrance gates the capture. Blinks never arrive anywhere and nothing waits on them, and
          // transitions are restarted indefinitely by the scrolling text, which the freeze styles handle instead.
          const blinks = ${request.blinkingAnimation}
          const running = document.getAnimations().filter(
            animation => animation instanceof CSSAnimation && animation.playState === 'running' && !blinks(animation),
          )

          return { running: running.map(animation => animation.animationName), markup: element.outerHTML }
        })()
      `)

      if (state === null) continue
      stableRuns = state.running.length === 0 && state.markup === previous ? stableRuns + 1 : 0
      previous = state.markup
      pending = state.running
      if (stableRuns >= 2) return
    }

    throw new Error(`${request.selector} never settled${pending.length ? ` — still animating: ${[...new Set(pending)].join(', ')}` : ''}`)
  }

  /**
   * Diffs two PNGs in the page, which already has a decoder. A channel tolerance absorbs text antialiasing without
   * hiding a real change, because a real change moves whole glyphs rather than shading their edges.
   */
  async compare(baseline: string, actual: string, tolerance: number): Promise<{ differing: number; total: number; diff: string | null }> {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true })

    try {
      await this.send('Runtime.enable', {}, sessionId)
      const result = await this.send(
        'Runtime.evaluate',
        {
          expression: `
            (async () => {
              const load = async data => createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob())
              const [before, after] = await Promise.all([load(${JSON.stringify(baseline)}), load(${JSON.stringify(actual)})])
              if (before.width !== after.width || before.height !== after.height) {
                return { differing: -1, total: 0, diff: null }
              }

              const read = bitmap => {
                const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
                const context = canvas.getContext('2d')
                context.drawImage(bitmap, 0, 0)
                return context.getImageData(0, 0, bitmap.width, bitmap.height)
              }

              const a = read(before)
              const b = read(after)
              const canvas = new OffscreenCanvas(before.width, before.height)
              const context = canvas.getContext('2d')
              const output = context.createImageData(before.width, before.height)
              let differing = 0

              for (let i = 0; i < a.data.length; i += 4) {
                const delta = Math.max(
                  Math.abs(a.data[i] - b.data[i]),
                  Math.abs(a.data[i + 1] - b.data[i + 1]),
                  Math.abs(a.data[i + 2] - b.data[i + 2]),
                  Math.abs(a.data[i + 3] - b.data[i + 3]),
                )

                if (delta > ${tolerance}) {
                  differing++
                  output.data[i] = 255
                  output.data[i + 1] = 0
                  output.data[i + 2] = 255
                  output.data[i + 3] = 255
                } else {
                  output.data[i] = a.data[i]
                  output.data[i + 1] = a.data[i + 1]
                  output.data[i + 2] = a.data[i + 2]
                  output.data[i + 3] = Math.round(a.data[i + 3] * 0.25)
                }
              }

              context.putImageData(output, 0, 0)
              const blob = await canvas.convertToBlob({ type: 'image/png' })
              const buffer = new Uint8Array(await blob.arrayBuffer())
              let binary = ''
              for (const byte of buffer) binary += String.fromCharCode(byte)

              return { differing, total: a.data.length / 4, diff: differing > 0 ? btoa(binary) : null }
            })()
          `,
          returnByValue: true,
          awaitPromise: true,
        },
        sessionId,
      )

      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
      return result.result.value
    } finally {
      await this.send('Target.closeTarget', { targetId }).catch(() => {})
    }
  }
}

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function waitFor<T>(attempt: () => Promise<T>, message: () => string, giveUp?: () => boolean): Promise<T> {
  for (let remaining = 60; remaining > 0; remaining--) {
    try {
      return await attempt()
    } catch {
      if (giveUp?.()) break
      await delay(250)
    }
  }
  throw new Error(message())
}
