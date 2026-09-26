import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function stop(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'exit')
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
  child.kill('SIGTERM')
  try {
    await exited
  } finally {
    clearTimeout(timer)
  }
}

/** Isolated Firefox profile controlled through its loopback WebDriver BiDi endpoint. */
export class Firefox {
  private nextId = 0
  private readonly pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>()

  get processId() {
    return this.child.pid!
  }

  private constructor(
    private readonly child: ChildProcess,
    private readonly socket: WebSocket,
    private readonly profile: string,
  ) {
    socket.onmessage = event => {
      const message = JSON.parse(String(event.data))
      const waiter = this.pending.get(message.id)
      if (!waiter) return
      this.pending.delete(message.id)
      if (message.type === 'error') waiter.reject(new Error(`${message.error}: ${message.message}`))
      else waiter.resolve(message.result)
    }
    socket.onclose = () => {
      for (const waiter of this.pending.values()) waiter.reject(new Error('Firefox closed its debugging connection'))
      this.pending.clear()
    }
  }

  static async launch() {
    const profile = await mkdtemp(join(tmpdir(), 'board-firefox-'))
    const appData = join(profile, 'app-data'),
      localData = join(profile, 'local-data')
    await Promise.all([mkdir(appData), mkdir(localData)])
    await writeFile(
      join(profile, 'user.js'),
      [
        'user_pref("browser.shell.checkDefaultBrowser", false);',
        'user_pref("browser.startup.homepage_override.mstone", "ignore");',
        'user_pref("startup.homepage_welcome_url", "about:blank");',
        'user_pref("browser.startup.page", 0);',
      ].join('\n'),
    )
    const child = spawn(
      process.env.FIREFOX_PATH || '/Applications/Firefox.app/Contents/MacOS/firefox',
      ['--headless', '--new-instance', '--profile', profile, '--remote-debugging-port', '0', 'about:blank'],
      { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, MOZ_APP_DATA: appData, MOZ_LOCAL_APP_DATA: localData } },
    )
    let complaints = ''
    let socket: WebSocket | undefined
    try {
      const endpoint = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Firefox did not start: ' + complaints)), 20_000)
        child.once('error', error => {
          clearTimeout(timer)
          reject(error)
        })
        child.once('exit', code => {
          clearTimeout(timer)
          reject(new Error('Firefox exited: ' + code + '\n' + complaints))
        })
        child.stderr!.on('data', chunk => {
          complaints = (complaints + chunk).slice(-4000)
          const match = /WebDriver BiDi listening on (ws:\/\/127\.0\.0\.1:\d+)/.exec(complaints)
          if (match) {
            clearTimeout(timer)
            resolve(match[1] + '/session')
          }
        })
      })
      socket = new WebSocket(endpoint)
      const connection = socket
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Firefox debugging connection timed out')), 20_000)
        connection.onopen = () => {
          clearTimeout(timer)
          resolve()
        }
        connection.onerror = () => {
          clearTimeout(timer)
          reject(new Error('Could not attach to Firefox'))
        }
      })
      const browser = new Firefox(child, socket, profile)
      const session = await browser.command('session.new', { capabilities: {} })
      console.log('FIREFOX', JSON.stringify(session.capabilities))
      return browser
    } catch (error) {
      socket?.close()
      await stop(child)
      await rm(profile, { recursive: true, force: true })
      throw error
    }
  }

  command(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(method + ' timed out'))
      }, 180_000)
      this.pending.set(id, {
        resolve: value => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: error => {
          clearTimeout(timer)
          reject(error)
        },
      })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async context(url = 'about:blank') {
    const { context } = await this.command('browsingContext.create', { type: 'tab' })
    await this.command('browsingContext.navigate', { context, url, wait: 'complete' })
    return context as string
  }

  async inject(context: string, expression: string) {
    const result = await this.command('script.evaluate', { expression, target: { context }, awaitPromise: true })
    if (result.type === 'exception') throw new Error(result.exceptionDetails.text)
    return result.result
  }

  async evaluate(context: string, expression: string) {
    const value = await this.inject(context, `(async () => JSON.stringify(await (${expression})))()`)
    return value.type === 'undefined' ? undefined : JSON.parse(value.value)
  }

  async close() {
    this.socket.close()
    await stop(this.child)
    await rm(this.profile, { recursive: true, force: true })
  }
}
