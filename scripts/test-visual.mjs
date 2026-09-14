import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Wrangler already ships esbuild; use its compiler without adding a test framework.
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler'))('esbuild')
const directory = await mkdtemp(join(tmpdir(), 'visual-tests-'))
try {
  const output = join(directory, 'run.mjs')
  await build({
    entryPoints: ['tests/visual/run.ts'],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    // The runner reads its baselines relative to itself, so keep that path pointing at the checkout.
    define: { 'import.meta.dirname': JSON.stringify(join(process.cwd(), 'tests', 'visual')) },
  })
  const result = spawnSync(process.execPath, [output, ...process.argv.slice(2)], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
