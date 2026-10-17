import { Browser } from '../visual/browser'
import { serveStatic } from '../visual/servers'
const site = await serveStatic('../led-board/internal/management/web')
const browser = await Browser.launch()
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
try {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
  const evaluate = async (expression: string) => {
    const result = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description)
    return result.result.value
  }
  await browser.send('Page.enable', {}, sessionId)
  await browser.send(
    'Page.addScriptToEvaluateOnNewDocument',
    {
      source: `
 window.hiddenForTest=false;
 Object.defineProperty(document,'hidden',{get:()=>window.hiddenForTest});
 window.statusCount=0;window.pendingStatus=[];
 window.fetch=async url=>{
  let data={};
  if(url==='/api/session')data={authenticated:true,passwordChangeRequired:false,setupStep:'done'};
  else if(url==='/api/config')data={values:{},fields:[],revision:'test'};
  else if(url==='/api/status'){
   window.statusCount++;
   await new Promise(resolve=>window.pendingStatus.push(resolve));
   data={network:{mode:'connected',ips:[]},board:'active',demo:true};
  }
  return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
 };
 `,
    },
    sessionId,
  )
  await browser.send('Page.navigate', { url: `http://127.0.0.1:${site.port}/` }, sessionId)
  for (let i = 0; i < 50 && !(await evaluate('window.statusCount===1')); i++) await wait(20)
  if (!(await evaluate('statusCount===1'))) throw Error('No initial status request')
  await evaluate('for(let i=0;i<20;i++)pollStatus()')
  if (!(await evaluate('statusCount===1'))) throw Error('Polling overlapped slow status')
  await evaluate('pendingStatus.shift()()')
  await wait(50)
  await evaluate('hiddenForTest=true;document.dispatchEvent(new Event("visibilitychange"));for(let i=0;i<20;i++)pollStatus()')
  if (!(await evaluate('statusCount===1'))) throw Error('Hidden settings tab polled')
  await evaluate('hiddenForTest=false;document.dispatchEvent(new Event("visibilitychange"))')
  if (!(await evaluate('statusCount===2'))) throw Error('Resume did not request fresh status')
  await evaluate('void status()')
  if (!(await evaluate('statusCount===3'))) throw Error('Explicit action did not request fresh status')
  await evaluate('pendingStatus.splice(0).forEach(resolve=>resolve())')
  await wait(50)
  await evaluate('signedOut();pollStatus()')
  if (!(await evaluate('statusCount===3'))) throw Error('Signed-out settings tab polled')
  console.log('Management polling: overlapping polls skipped; hidden and signed-out tabs skip polls; resume and explicit refresh work.')
  const notes = [
    'Built from [`6929e1a`](https://github.com/o/r/commit/6929e1a): feat(management): follow the *system* setting',
    '',
    '[Changes](https://github.com/o/r/compare/a...b)',
    '',
    "Boards install this build.\nIt hasn't been tried on a board.",
    '',
    "## What's Changed",
    '* **fix**: keep snake_case_names by @x in https://github.com/o/r/pull/1.',
    '',
    '* [Bad](javascript:void0) link',
    '```',
    '<b>raw</b>',
    '```',
  ].join('\n')
  const rendered = await evaluate(`markdown(${JSON.stringify(notes)}).innerHTML`)
  const expected =
    '<p>Built from <a href="https://github.com/o/r/commit/6929e1a" target="_blank" rel="noopener"><code>6929e1a</code></a>: feat(management): follow the <em>system</em> setting</p>' +
    '<p><a href="https://github.com/o/r/compare/a...b" target="_blank" rel="noopener">Changes</a></p>' +
    "<p>Boards install this build.<br>It hasn't been tried on a board.</p>" +
    "<h4>What's Changed</h4>" +
    '<ul><li><strong>fix</strong>: keep snake_case_names by @x in <a href="https://github.com/o/r/pull/1" target="_blank" rel="noopener">https://github.com/o/r/pull/1</a>.</li>' +
    '<li>Bad link</li></ul>' +
    '<pre><code>&lt;b&gt;raw&lt;/b&gt;\n</code></pre>'
  if (rendered !== expected) throw Error(`Release notes rendered as:\n${rendered}\nwant:\n${expected}`)
  console.log('Release notes: Markdown renders, and only web links are followed.')
} finally {
  await browser.close()
  await site.close()
}
