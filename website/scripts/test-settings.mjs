import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Wrangler already ships esbuild; use its compiler without adding a test framework.
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler'))('esbuild')
const directory = await mkdtemp(join(tmpdir(), 'board-options-tests-'))
try {
  const output = join(directory, 'tests.cjs')
  await build({
    entryPoints: [process.argv.includes('--browser') ? 'tests/board-options-browser.test.ts' : 'tests/board-options.test.ts'],
    define: { 'import.meta.dirname': JSON.stringify(join(process.cwd(), 'tests', 'visual')) },
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    loader: { '.pb': 'binary' },
    target: 'node20',
  })
  const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
