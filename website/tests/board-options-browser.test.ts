import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Browser } from './visual/browser'
import { serveStatic, serveFeed } from './visual/servers'

test('setup options, shared links, and the RailAnnouncements dialog', { timeout: 90_000 }, async () => {
  const site = await serveStatic(join(process.cwd(), 'out'))
  const feed = await serveFeed()
  const browser = await Browser.launch()
  const origin = `http://127.0.0.1:${site.port}`
  const hostFile = join(process.cwd(), 'out', 'settings-embed-test.html')
  const screenshots = join(tmpdir(), 'raildotmatrix-settings')
  await mkdir(screenshots, { recursive: true })
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
  const send = (method: string, params = {}) => browser.send(method, params, sessionId)
  const evaluate = async (expression: string) => {
    const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails))
    return value.result.value
  }
  const wait = async (expression: string) => {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(expression).catch(() => false)) return
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`Timed out: ${expression}`)
  }
  const select = async (label: string, value: string) => {
    await evaluate(`(() => {
      const input = [...document.querySelectorAll('label')].find(label => label.textContent.includes(${JSON.stringify(label)})).querySelector('select');
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`)
    await wait(`JSON.parse(localStorage.getItem('newGtrBoardSettings') || '{}').color === 'white'`)
  }
  const screenshot = async (name: string) => {
    await evaluate('document.fonts.ready')
    const { cssContentSize } = await send('Page.getLayoutMetrics')
    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
    })
    await writeFile(join(screenshots, name + '.png'), Buffer.from(data, 'base64'))
  }
  try {
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 960, deviceScaleFactor: 1, mobile: false })
    const params = new URLSearchParams({
      station: 'ECR',
      type: 'infotec-landscape-dmi',
      dataSource: 'websocket',
      liveServiceUrl: `ws://127.0.0.1:${feed.port}/busy-board`,
      color: 'orange',
    })
    params.append('platform', '2')
    params.append('platform', '4')
    await send('Page.navigate', { url: `${origin}/board?${params}` })
    await wait(`document.querySelector('button[type="submit"]') && document.body.textContent.includes('LED colour')`)
    await wait(`document.querySelectorAll('.platform-picker label').length === 6`)
    const warningInput = `[...document.querySelectorAll('label')].find(x => x.textContent.includes('Name the platform in warnings')).querySelector('input')`
    const togglePlatform = async (platform: string) => {
      await evaluate(
        `[...document.querySelectorAll('.platform-picker label')].find(x => x.textContent.trim() === ${JSON.stringify(platform)}).querySelector('input').click()`,
      )
    }
    // The default follows the platform selection, even after another option has been saved.
    await wait(`${warningInput}.checked`)
    await togglePlatform('4')
    await wait(`!${warningInput}.checked`)
    await select('LED colour', 'white')
    assert.equal(await evaluate(`'warningPlatform' in JSON.parse(localStorage.getItem('newGtrBoardSettings'))`), false)
    await select('Display type', 'daktronics-data-display-dmi')
    await wait(`document.body.textContent.includes('Casing colour') && !${warningInput}.checked`)
    await select('Services to show', '6')
    await wait(`JSON.parse(localStorage.getItem('dataDisplayBoardSettings')).serviceCount === 6`)
    await select('Display type', 'infotec-landscape-dmi')
    await wait(`document.body.textContent.includes('LED colour') && !${warningInput}.checked`)
    assert.equal(
      await evaluate(
        `[...document.querySelectorAll('label')].find(x => x.textContent.includes('Services to show')).querySelector('select').value`,
      ),
      '3',
    )
    await togglePlatform('2')
    await wait(`${warningInput}.checked`)
    await togglePlatform('2')
    await wait(`!${warningInput}.checked`)
    await togglePlatform('4')
    await wait(`${warningInput}.checked`)
    // An explicit opt-out survives later platform changes.
    await evaluate(`${warningInput}.click()`)
    await wait(`JSON.parse(localStorage.getItem('newGtrBoardSettings')).warningPlatform === false`)
    await togglePlatform('4')
    await togglePlatform('4')
    assert.equal(await evaluate(`${warningInput}.checked`), false)
    await select('Services to show', '5')
    await wait(`JSON.parse(localStorage.getItem('newGtrBoardSettings')).serviceCount === 5`)
    await evaluate(
      `[...document.querySelectorAll('label')].find(x => x.textContent.trim() === 'Standard toilets').querySelector('input').click()`,
    )
    await wait(`JSON.parse(localStorage.getItem('newGtrBoardSettings')).formationIcons.join(',') === 'accessibility,cycles,food,first-class'`)
    await evaluate(
      `[...document.querySelectorAll('label')].find(x => x.textContent.includes('Use smaller scrolling text')).querySelector('input').click()`,
    )
    await wait(`JSON.parse(localStorage.getItem('newGtrBoardSettings')).smallScrollingText === true`)
    const terminatingInput = `[...document.querySelectorAll('label')].find(x => x.textContent.includes('Hide terminating trains')).querySelector('input')`
    assert.equal(await evaluate(`${terminatingInput}.checked`), false)
    await evaluate(`${terminatingInput}.click()`)
    await wait(`JSON.parse(localStorage.getItem('newGtrBoardSettings')).hideTerminating === true`)
    const labels = await evaluate(`[...document.querySelectorAll('fieldset:not(.platform-picker) label')].map(x => x.textContent.trim())`)
    await select('Display type', 'daktronics-data-display-dmi')
    await wait(`document.body.textContent.includes('Casing colour')`)
    assert.equal(
      await evaluate(
        `[...document.querySelectorAll('label')].find(x => x.textContent.includes('Services to show')).querySelector('select').value`,
      ),
      '6',
    )
    await select('Display type', 'infotec-landscape-dmi')
    await wait(`document.body.textContent.includes('LED colour')`)
    assert.equal(
      await evaluate(`[...document.querySelectorAll('label')].find(x => x.textContent.includes('LED colour')).querySelector('select').value`),
      'white',
    )
    await screenshot('setup-desktop')
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1100, deviceScaleFactor: 1, mobile: true })
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
    assert.equal(
      await evaluate(
        "getComputedStyle(document.documentElement).overflowY !== 'hidden' && document.querySelector('h1').getBoundingClientRect().top >= 0",
      ),
      true,
    )
    await screenshot('setup-mobile')
    await evaluate(`document.querySelector('button[type="submit"]').click()`)
    await wait(`location.pathname === '/board/infotec-landscape-dmi' && !!document.querySelector('canvas')`)
    await wait(`!!document.querySelector('[aria-busy="false"]')`)
    assert.equal(await evaluate(`!!document.querySelector('.ZoomDivContainer [role="alert"]')`), false)
    const boardUrl = await evaluate('location.href')
    const boardQuery = new URL(boardUrl).searchParams
    assert.equal(boardQuery.get('color'), 'white')
    assert.equal(boardQuery.get('serviceCount'), '5')
    assert.equal(boardQuery.get('smallScrollingText'), '1')
    assert.equal(boardQuery.get('hideTerminating'), '1')
    assert.equal(boardQuery.get('formationIcons'), 'accessibility,cycles,food,first-class')
    assert.equal(boardQuery.get('warningPlatform'), '0')
    assert.deepEqual(boardQuery.getAll('platform'), ['2', '4'])
    assert.equal(await evaluate(`!!document.querySelector('.board-settings, dialog')`), false)
    assert.equal(await evaluate(`[...document.querySelectorAll('a')].some(x => x.textContent === 'Edit board')`), true)
    // A real second tab broadcasts preferences only to displays of its own type.
    const peer = await browser.send('Target.createTarget', { url: 'about:blank' })
    const attached = await browser.send('Target.attachToTarget', { targetId: peer.targetId, flatten: true })
    const peerSend = (method: string, params = {}) => browser.send(method, params, attached.sessionId)
    try {
      await peerSend('Page.enable')
      await peerSend('Page.navigate', { url: `${origin}/board?${params}` })
      for (let i = 0; i < 200; i++) {
        const result = await peerSend('Runtime.evaluate', { expression: `!!document.querySelector('select')`, returnByValue: true })
        if (result.result.value) break
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      await peerSend('Runtime.evaluate', {
        expression: `(() => {
        const input = [...document.querySelectorAll('label')].find(x => x.textContent.includes('LED colour')).querySelector('select');
        input.value = 'orange'; input.dispatchEvent(new Event('change', { bubbles: true }));
      })()`,
      })
      await wait(`new URLSearchParams(location.search).get('color') === 'orange'`)
      assert.deepEqual(await evaluate(`new URLSearchParams(location.search).getAll('platform')`), ['2', '4'])
      await peerSend('Runtime.evaluate', {
        expression: `localStorage.setItem('dataDisplayBoardSettings', JSON.stringify({color:'white'})); localStorage.setItem('newGtrBoardSettings', '{invalid');`,
      })
      // The storage notification follows writes on the same connection.
      await new Promise(resolve => setTimeout(resolve, 100))
      assert.equal(await evaluate(`new URLSearchParams(location.search).get('color')`), 'orange')
    } finally {
      await browser.send('Target.closeTarget', { targetId: peer.targetId })
    }
    // A marker alone must not turn a normal browser tab into the embedded settings experience.
    await send('Page.navigate', { url: boardUrl + '&from-railannouncements.co.uk=1' })
    await wait(`!!document.querySelector('canvas')`)
    assert.equal(await evaluate(`!!document.querySelector('dialog')`), false)
    await writeFile(
      hostFile,
      `<html><body style="margin:0"><iframe title="Departure board" style="width:100%;height:100vh;border:0" src="${boardUrl}&from-railannouncements.co.uk=1"></iframe></body></html>`,
    )
    await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 850, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${origin}/settings-embed-test.html` })
    const frame = `document.querySelector('iframe').contentDocument`
    await wait(`!!${frame}?.querySelector('dialog')`)
    await evaluate(`${frame}.querySelector('button').focus(); ${frame}.querySelector('button').click()`)
    await wait(`${frame}.querySelector('dialog').open`)
    assert.equal(await evaluate(`${frame}.querySelector('dialog').matches(':modal')`), true)
    assert.deepEqual(await evaluate(`[...${frame}.querySelectorAll('fieldset label')].map(x => x.textContent.trim())`), labels)
    assert.equal(
      await evaluate(
        `[...${frame}.querySelectorAll('label')].find(x => x.textContent.includes('Use smaller scrolling text')).querySelector('input').checked`,
      ),
      true,
    )
    assert.equal(
      await evaluate(
        `[...${frame}.querySelectorAll('label')].find(x => x.textContent.trim() === 'Standard toilets').querySelector('input').checked`,
      ),
      false,
    )
    await screenshot('embed-dialog')
    // Modal changes reach the live options and URL immediately.
    await evaluate(`(() => {
      const input = [...${frame}.querySelectorAll('label')].find(x => x.textContent.includes('LED colour')).querySelector('select');
      input.value = 'orange'; input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`)
    await wait(`document.querySelector('iframe').contentWindow.location.search.includes('color=orange')`)
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await wait(`!${frame}.querySelector('dialog').open`)
    assert.equal(await evaluate(`${frame}.activeElement.textContent`), 'Settings')
    await evaluate(`${frame}.querySelector('button').click()`)
    await wait(`${frame}.querySelector('dialog').open`)
    await evaluate(`[...${frame}.querySelectorAll('button')].find(x => x.textContent === 'Done').click()`)
    await wait(`!${frame}.querySelector('dialog').open`)
    console.log(`Settings screenshots: ${screenshots}`)
  } catch (error) {
    console.log(
      await evaluate(
        `JSON.stringify({url: location.href, text: document.body.innerText, frame: document.querySelector('iframe')?.src, frameText: document.querySelector('iframe')?.contentDocument?.body?.innerText})`,
      ).catch(String),
    )
    await screenshot('failure').catch(() => {})
    throw error
  } finally {
    await browser.send('Target.closeTarget', { targetId }).catch(() => {})
    await browser.close()
    await site.close()
    await feed.close()
    await rm(hostFile, { force: true })
  }
})
