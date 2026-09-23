import { readFile } from 'node:fs/promises'
import { Browser } from '../visual/browser'

const browser = await Browser.launch({ gpu: true })
try {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
  const evaluate = async (expression: string) => {
    const result = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  await evaluate(await readFile(process.argv[2], 'utf8'))
  console.log(await evaluate('rendererTests.verify()'))
  if (process.argv.includes('--benchmark')) console.log(await evaluate('rendererTests.benchmark()'))
} finally {
  await browser.close()
}
