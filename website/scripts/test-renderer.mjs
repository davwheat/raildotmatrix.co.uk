import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler'))('esbuild')
const directory = await mkdtemp(join(tmpdir(), 'renderer-tests-'))
try {
  const page = join(directory, 'page.js')
  const runner = join(directory, 'run.mjs')
  await Promise.all([
    build({ entryPoints: ['tests/renderer/page.ts'], outfile: page, bundle: true, format: 'iife', globalName: 'rendererTests' }),
    build({ entryPoints: ['tests/renderer/run.ts'], outfile: runner, bundle: true, platform: 'node', format: 'esm' }),
  ])
  const result = spawnSync(process.execPath, [runner, page, ...process.argv.slice(2)], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
