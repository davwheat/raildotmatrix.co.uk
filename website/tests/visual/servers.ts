import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { createRequire } from 'node:module'
import { fromBinary } from '@bufbuild/protobuf'
import { ClientMessageSchema } from '../../src/live/gen/darwin/live/v2/live_pb'
import { encodeServerMessage } from '../encode'
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

/** Long enough to reach the board as its own render, short enough that the capture is nowhere near settling. */
const UPDATE_DELAY = 100

/** The fixture name is the URL path prefix, which streamUrl() preserves when it appends /v1/cis/live. */
export function serveFeed(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    if (new URL(request.url || '/', 'http://localhost').pathname.endsWith('/v1/platforms')) {
      response
        .writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
        .end(JSON.stringify({ platforms: ['1', '2', '3', '4', '5', '6'] }))
      return
    }
    response.writeHead(426).end('WebSocket only')
  })
  const sockets = new WebSocketServer({ server })

  sockets.on('connection', (socket: any, request: any) => {
    const name = new URL(request.url, 'http://localhost').pathname.split('/').filter(Boolean)[0]
    const fixture = FIXTURES[name ?? '']
    if (!fixture) {
      socket.close()
      return
    }

    // A board announces a change rather than a state, so an update has to arrive as its own message: sending it in
    // the same tick as the snapshot would let the client collapse the two into one render and see nothing change.
    const send = () => {
      if (!fixture.snapshot) return
      socket.send(encodeServerMessage(fixture.snapshot))
      fixture.updates?.forEach((change, index) => {
        setTimeout(() => socket.send(encodeServerMessage(change)), (index + 1) * UPDATE_DELAY)
      })
    }
    send()
    socket.on('message', (data: Buffer) => {
      if (fromBinary(ClientMessageSchema, data).command.case === 'resync') send()
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
