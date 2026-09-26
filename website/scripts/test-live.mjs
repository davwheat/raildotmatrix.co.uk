import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Wrangler already ships esbuild; use its compiler without adding a test framework.
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler'))('esbuild')
const directory = await mkdtemp(join(tmpdir(), 'live-feed-tests-'))
try {
  if (process.argv.includes('--browser')) {
    const page = join(directory, 'page.js')
    const runner = join(directory, 'run.mjs')
    await build({
      entryPoints: ['tests/live-browser/page.tsx'],
      outfile: page,
      bundle: true,
      format: 'iife',
      globalName: 'liveHookTests',
      define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_LIVE_SERVICE_URL': '"ws://localhost:8080"' },
    })
    await build({
      entryPoints: ['tests/live-browser/run.ts'],
      outfile: runner,
      bundle: true,
      platform: 'node',
      format: 'esm',
      define: { 'import.meta.dirname': JSON.stringify(join(process.cwd(), 'tests', 'visual')) },
    })
    const result = spawnSync(process.execPath, [runner, page], { stdio: 'inherit' })
    process.exitCode = result.status ?? 1
  } else {
    const output = join(directory, 'tests.cjs')
    await build({
      entryPoints: ['tests/live.test.ts'],
      outfile: output,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      loader: { '.pb': 'binary' },
      target: 'node20',
    })
    const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' })
    process.exitCode = result.status ?? 1
  }
} finally {
  await rm(directory, { recursive: true, force: true })
}
