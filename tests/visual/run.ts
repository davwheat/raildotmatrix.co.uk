import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BLINKING_ANIMATION, BOARDS, FREEZE_STYLES, PIN_ANIMATIONS, VIEWPORT, freezeScript } from './boards'
import { Browser } from './browser'
import { FIXTURES, FROZEN_CLOCK } from './fixtures'
import { serveFeed, serveStatic } from './servers'

const BASELINES = join(import.meta.dirname, 'baselines')
const FAILURES = join(import.meta.dirname, 'failures')

/** Antialiasing shades glyph edges by a point or two; anything a reader would notice moves far further than that. */
const CHANNEL_TOLERANCE = 4

/** Node's own Buffer type does not satisfy writeFile's parameter type, so screenshots are written as a plain view. */
const png = (base64: string) => Uint8Array.from(Buffer.from(base64, 'base64'))

interface Options {
  update: boolean
  filter: string | null
  repeat: number
  siteDir: string
}

function parseOptions(argv: string[]): Options {
  const value = (flag: string) => {
    const index = argv.indexOf(flag)
    return index === -1 ? null : argv[index + 1]
  }

  return {
    update: argv.includes('--update'),
    filter: value('--filter'),
    repeat: Math.max(1, Number(value('--repeat')) || 1),
    siteDir: value('--site') ?? join(process.cwd(), 'out'),
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const cases = BOARDS.flatMap(board =>
    Object.entries(FIXTURES).map(([state, fixture]) => ({ board, state, description: fixture.description, platforms: fixture.platforms })),
  ).filter(entry => !options.filter || `${entry.board.name} ${entry.state}`.includes(options.filter))

  if (cases.length === 0) throw new Error('No cases matched the filter')

  await mkdir(BASELINES, { recursive: true })
  await rm(FAILURES, { recursive: true, force: true })

  const site = await serveStatic(options.siteDir)
  const feed = await serveFeed()
  let browser = await Browser.launch()
  const failures = new Set<string>()

  /**
   * A renderer that runs out of memory takes its tab with it and can leave the browser unable to open another, while
   * the process itself stays alive. Any capture failure therefore earns a fresh browser and one retry, which costs a
   * second and saves every case after the one that crashed.
   */
  async function captureWith(request: Parameters<Browser['capture']>[0]): Promise<string> {
    try {
      return await browser.capture(request)
    } catch {
      await browser.close().catch(() => {})
      browser = await Browser.launch()
      return await browser.capture(request)
    }
  }

  try {
    for (const { board, state, description, platforms } of cases) {
      const name = `${board.name}--${state}`
      // Only failures carry the description: it is the reminder of what the case was meant to prove.
      const explain = (line: string) => console.log(`${line}\n            ${description}`)
      const query = new URLSearchParams({
        station: 'ECR',
        dataSource: 'websocket',
        liveServiceUrl: `ws://127.0.0.1:${feed.port}/${state}`,
        hideSettings: '1',
        'from-railannouncements.co.uk': '1',
      })
      for (const watched of platforms ?? []) query.append('platform', watched)

      const shots: string[] = []
      try {
        for (let run = 0; run < options.repeat; run++) {
          shots.push(
            await captureWith({
              url: `http://127.0.0.1:${site.port}${board.path}?${query}`,
              selector: board.selector,
              viewport: VIEWPORT,
              preloadScript: freezeScript(FROZEN_CLOCK),
              runClock: board.runClock ? (board.runClock.states?.[state] ?? board.runClock.ms) : 0,
              freezeStyles: FREEZE_STYLES,
              pinAnimations: PIN_ANIMATIONS,
              blinkingAnimation: BLINKING_ANIMATION,
            }),
          )
        }
      } catch (error) {
        failures.add(name)
        explain(`  ERRORED   ${name} — ${(error as Error).message}`)
        continue
      }

      // Repeated captures of one case must agree before any of them can be trusted as a baseline.
      for (let run = 1; run < shots.length; run++) {
        const { differing, diff } = await browser.compare(shots[0], shots[run], CHANNEL_TOLERANCE)
        if (differing === 0) continue

        failures.add(name)
        await mkdir(FAILURES, { recursive: true })
        await writeFile(join(FAILURES, `${name}.run1.png`), png(shots[0]))
        await writeFile(join(FAILURES, `${name}.run${run + 1}.png`), png(shots[run]))
        if (diff) await writeFile(join(FAILURES, `${name}.run${run + 1}.diff.png`), png(diff))
        explain(`  unstable  ${name} — run ${run + 1} differs from run 1 by ${differing} pixels`)
      }
      if (failures.has(name)) continue

      const baselinePath = join(BASELINES, `${name}.png`)
      const existing = await readFile(baselinePath, 'base64').catch(() => null)

      if (!existing || options.update) {
        await writeFile(baselinePath, png(shots[0]))
        console.log(`  ${existing ? 'updated' : 'recorded'}   ${name}`)
        continue
      }

      const { differing, total, diff } = await browser.compare(existing, shots[0], CHANNEL_TOLERANCE)
      if (differing === 0) {
        console.log(`  ok        ${name}`)
        continue
      }

      failures.add(name)
      await mkdir(FAILURES, { recursive: true })
      await writeFile(join(FAILURES, `${name}.actual.png`), png(shots[0]))
      if (diff) await writeFile(join(FAILURES, `${name}.diff.png`), png(diff))
      explain(differing === -1 ? `  FAILED    ${name} — the board changed size` : `  FAILED    ${name} — ${differing} of ${total} pixels differ`)
    }

    for (const orphan of await reportOrphans(
      cases.map(entry => `${entry.board.name}--${entry.state}`),
      options,
    )) {
      failures.add(orphan)
    }
  } finally {
    await browser.close().catch(() => {})
    await feed.close()
    await site.close()
  }

  console.log(`\n${Math.max(0, cases.length - failures.size)}/${cases.length} passed`)
  if (failures.size > 0) {
    console.log(`Diffs written to ${FAILURES}`)
    process.exitCode = 1
  }
}

/**
 * A renamed or deleted case leaves a baseline nothing compares against. Reporting it as a failure is what stops the
 * suite quietly rotting into a folder of images no test looks at. Returns the orphans still on disk afterwards.
 */
async function reportOrphans(expected: string[], options: Options): Promise<string[]> {
  if (options.filter) return []

  const orphans = (await readdir(BASELINES))
    .filter(file => file.endsWith('.png'))
    .map(file => file.replace(/\.png$/, ''))
    .filter(name => !expected.includes(name))

  if (!options.update) {
    for (const orphan of orphans) console.log(`  orphaned  ${orphan} — no case produces it; rerun with --update to remove it`)
    return orphans
  }

  for (const orphan of orphans) {
    await rm(join(BASELINES, `${orphan}.png`))
    console.log(`  removed   ${orphan}`)
  }
  return []
}

await main()
