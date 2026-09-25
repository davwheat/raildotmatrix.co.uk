import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Browser } from '../visual/browser'
import { Firefox } from '../visual/firefox'
import { serveFeed, serveStatic } from '../visual/servers'
import { FIXTURES } from '../visual/fixtures'
import type { Update } from '../../src/live/types'

// Keep this synthetic stream out of the visual fixture/golden matrix. All but
// its last delta change an off-screen service; the final delta cancels row one.
const original = FIXTURES['busy-board'].snapshot!
const movements = Array.from({ length: 50 }, (_, i) => ({ ...original.movements[0], id: `projection-${i}` }))
const snapshot = { ...original, movements, ordering: movements.map(movement => movement.id) }
const updates: Update[] = Array.from({ length: 7 }, (_, i) => ({
  version: 2,
  type: 'update',
  epoch: snapshot.epoch,
  previous_revision: i + 1,
  revision: i + 2,
  window: snapshot.window,
  upserts: [{ ...movements[i === 6 ? 0 : 49], cancelled: true, coach_count: i + 1 }],
  removals: [],
  ordering: snapshot.ordering,
  override_upserts: [],
  override_removals: [],
  nrcc_messages: [],
}))
FIXTURES['projection-updates'] = { description: 'hidden deltas followed by a visible change', snapshot, updates }
FIXTURES['projection-final'] = {
  description: 'reference state after the visible change',
  snapshot: { ...snapshot, movements: [updates[6].upserts[0], ...movements.slice(1)] },
}

const server = await serveStatic(resolve('out'))
const feed = await serveFeed()
const browser = process.argv.includes('--firefox') ? await Firefox.launch() : await Browser.launch()
try {
  let evaluate: (expression: string) => Promise<any>
  let inject: (source: string) => Promise<unknown>
  const url = `http://127.0.0.1:${server.port}/`
  if (browser instanceof Firefox) {
    const context = await browser.context(url)
    evaluate = expression => browser.evaluate(context, expression)
    inject = source => browser.inject(context, source)
  } else {
    const { targetId } = await browser.send('Target.createTarget', { url })
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
    evaluate = async expression => {
      const result = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      return result.result.value
    }
    inject = evaluate
  }
  for (let tries = 0; tries < 50 && !(await evaluate('!!document.body && location.protocol === "http:"')); tries++) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  await inject(await readFile(process.argv[2], 'utf8'))
  console.log(await evaluate(`wasmTests.verify('ws://127.0.0.1:${feed.port}')`))
  console.log(await evaluate(`wasmTests.verifyProjection('ws://127.0.0.1:${feed.port}')`))
} finally {
  await browser.close()
  await feed.close()
  await server.close()
}
