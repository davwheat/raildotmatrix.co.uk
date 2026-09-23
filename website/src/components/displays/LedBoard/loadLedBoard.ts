import type { FormationIcon } from '../../BoardOptions/settings'

const BUNDLE_DIRECTORY = '/led-board/'

export type OrdinalFormat = 'suffix' | 'dot'

export type RowPrefix = 'ordinals' | 'platforms'

/** The options of `ledDepartureBoard.create`, documented in the Go repository's `cmd/wasm/main.go`. */
export interface LedBoardOptions {
  board: 'infotec' | 'daktronics'
  crs: string
  url: string
  platforms?: string[]
  showUnconfirmedPlatforms?: boolean
  legacyTocNames?: boolean
  worldline?: boolean
  /** The single prefix before each train's time: an ordinal or its platform number. */
  rowPrefix?: RowPrefix
  ordinalFormat?: OrdinalFormat
  /** Infotec service limit, 1–6; defaults to 3. */
  serviceCount?: number
  loadingBrightness?: 50 | 100
  /** TOC codes whose Infotec coach letters are shown; an empty list hides all letters. */
  coachLetterTocs?: string[]
  /** Enabled Infotec facility icons; defaults to all, while an empty list hides all. */
  formationIcons?: FormationIcon[]
  /** Infotec formation count; wording falls back to a number when space is limited. */
  formationCount?: 'none' | 'number' | 'coaches' | 'coaches-no-brackets' | 'carriages' | 'carriages-no-brackets'
  clockStyle?: 'normal' | 'small-seconds' | 'small'
  /** Names the platform in a warning, in place of "this station", when the warning is for one platform. */
  warningPlatform?: boolean
  /** Infotec only: show a platform box beside the first train. */
  platformBox?: boolean
  /** Place a smaller lower service row beside the clock (Infotec only). */
  compactLowerRow?: boolean
  /** Align lower service rows with the Infotec platform box; defaults to true. */
  alignPlatformRows?: boolean
  colour?: 'amber' | 'white'
  scrollSpeed?: number
  /** Use the compact font for Infotec calling points and service information. */
  smallScrollingText?: boolean
  width?: number
  height?: number
  verbose?: boolean
}

export interface LedBoardHandle {
  readonly width: number
  readonly height: number
  /** Packed RGB, `width` × `height` × 3. */
  readonly pixels: Uint8Array
  /** Advances the board to `now`, in milliseconds since the epoch, and reports whether `pixels` changed. */
  tick(now: number): boolean
  close(): void
}

export interface LedBoardApi {
  create(options: LedBoardOptions): LedBoardHandle | Error
}

interface Manifest {
  wasm: string
  exec: string
}

interface GoRuntime {
  importObject: WebAssembly.Imports
  run(instance: WebAssembly.Instance): Promise<void>
}

type GoGlobals = typeof globalThis & {
  Go: new () => GoRuntime
  ledDepartureBoardReady?: (api: LedBoardApi) => void
}

let bundle: Promise<LedBoardApi> | undefined

/** Loads the WebAssembly boards once per page, however many boards the page shows. */
export function loadLedBoard(): Promise<LedBoardApi> {
  if (!bundle) {
    bundle = load()
    // A failure isn't kept, so that a board created later, such as after a network blip, tries again.
    bundle.catch(() => (bundle = undefined))
  }
  return bundle
}

async function load(): Promise<LedBoardApi> {
  // The file names change with their content, so only the manifest can ever be stale.
  const manifest: Manifest = await fetchOk(`${BUNDLE_DIRECTORY}manifest.json`, { cache: 'no-cache' }).then(response => response.json())
  const [, module] = await Promise.all([loadScript(`${BUNDLE_DIRECTORY}${manifest.exec}`), fetchOk(`${BUNDLE_DIRECTORY}${manifest.wasm}`)])

  const globals = globalThis as GoGlobals
  const go = new globals.Go()
  const { instance } = await WebAssembly.instantiateStreaming(
    new Response(await decompressed(module.body!), { headers: { 'Content-Type': 'application/wasm' } }),
    go.importObject,
  )

  return new Promise((resolve, reject) => {
    globals.ledDepartureBoardReady = resolve
    go.run(instance).then(() => reject(new Error('The board module exited before it was ready')), reject)
  })
}

async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`${src} failed to load`))
    document.head.appendChild(script)
  })
}

type Bytes = Uint8Array<ArrayBuffer>

/**
 * The module is stored gzipped so that it needs nothing special from the host, but a host that labels it
 * `Content-Encoding: gzip` has the browser inflate it first. Only the bytes themselves say which one arrived.
 */
async function decompressed(body: ReadableStream<Bytes>): Promise<ReadableStream<Bytes>> {
  const reader = body.getReader()
  let head: Bytes = new Uint8Array(0)
  let ended = false
  while (head.length < 2 && !ended) {
    const { done, value } = await reader.read()
    ended = done
    if (value) head = concatenate(head, value)
  }

  const stream = new ReadableStream<Bytes>({
    start(controller) {
      if (head.length > 0) controller.enqueue(head)
      if (ended) controller.close()
    },
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) controller.close()
      else controller.enqueue(value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })

  return head[0] === 0x1f && head[1] === 0x8b ? stream.pipeThrough(new DecompressionStream('gzip')) : stream
}

function concatenate(a: Bytes, b: Bytes): Bytes {
  const joined = new Uint8Array(a.length + b.length)
  joined.set(a)
  joined.set(b, a.length)
  return joined
}
