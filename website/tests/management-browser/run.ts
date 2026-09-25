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
  if(url==='/api/session')data={authenticated:true};
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
} finally {
  await browser.close()
  await site.close()
}
