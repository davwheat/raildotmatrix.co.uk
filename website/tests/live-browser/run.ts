import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Browser } from '../visual/browser'
import { serveStatic } from '../visual/servers'

const page = process.argv[2]
await writeFile(join(dirname(page), 'index.html'), '<!doctype html><html><body></body></html>')
const server = await serveStatic(dirname(page))
const browser = await Browser.launch()
try {
  const { targetId } = await browser.send('Target.createTarget', { url: `http://127.0.0.1:${server.port}/` })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
  const evaluate = async (expression: string) => {
    const result = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  for (let tries = 0; tries < 50 && !(await evaluate('!!document.body && location.protocol === "http:"')); tries++) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  await evaluate(await readFile(page, 'utf8'))
  console.log(await evaluate('liveHookTests.verify()'))
} finally {
  await browser.close()
  await server.close()
}
