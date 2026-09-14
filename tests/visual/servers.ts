import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { createRequire } from 'node:module'
import { FIXTURES } from './fixtures'

// The bundle runs from a temporary directory, so resolve ws from the checkout instead of from the bundle.
const { WebSocketServer } = createRequire(join(import.meta.dirname, 'servers.ts'))('ws')

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
}

async function resolveFile(root: string, pathname: string): Promise<string | null> {
  const candidate = join(root, normalize(pathname).replace(/^(\.\.[/\\])+/, ''))
  // Next's export writes /board/infotec-landscape-dmi as a sibling .html file, which is how Cloudflare Pages
  // resolves it too.
  for (const path of [candidate, `${candidate}.html`, join(candidate, 'index.html')]) {
    try {
      if ((await stat(path)).isFile()) return path
    } catch {
      continue
    }
  }
  return null
}

export function serveStatic(root: string): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    const path = await resolveFile(root, new URL(request.url || '/', 'http://localhost').pathname)
    if (!path) {
      response.writeHead(404).end('Not found')
      return
    }

    response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' })
    createReadStream(path).pipe(response)
  })

  return listen(server)
}

/** The fixture name is the URL path prefix, which streamUrl() preserves when it appends /v1/cis/live. */
export function serveFeed(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((_request, response) => response.writeHead(426).end('WebSocket only'))
  const sockets = new WebSocketServer({ server })

  sockets.on('connection', (socket: any, request: any) => {
    const name = new URL(request.url, 'http://localhost').pathname.split('/').filter(Boolean)[0]
    const fixture = FIXTURES[name ?? '']
    if (!fixture) {
      socket.close()
      return
    }

    const send = () => fixture.snapshot && socket.send(JSON.stringify(fixture.snapshot))
    send()
    socket.on('message', (data: Buffer) => {
      if (JSON.parse(String(data)).type === 'resync') send()
    })
  })

  return listen(server)
}

function listen(server: Server): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      resolve({
        port,
        close: () => new Promise<void>(done => server.close(() => done())),
      })
    })
  })
}
