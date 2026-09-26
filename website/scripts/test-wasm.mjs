import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler'))('esbuild')
const directory = await mkdtemp(join(tmpdir(), 'wasm-tests-'))
try {
  const page = join(directory, 'page.js')
  const runner = join(directory, 'run.mjs')
  await Promise.all([
    build({ entryPoints: ['tests/wasm-browser/page.ts'], outfile: page, bundle: true, format: 'iife', globalName: 'wasmTests' }),
    build({
      entryPoints: ['tests/wasm-browser/run.ts'],
      outfile: runner,
      bundle: true,
      platform: 'node',
      format: 'esm',
      define: { 'import.meta.dirname': JSON.stringify(join(process.cwd(), 'tests', 'visual')) },
    }),
  ])
  const result = spawnSync(process.execPath, [runner, page, ...process.argv.slice(2)], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
