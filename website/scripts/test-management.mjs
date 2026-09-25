import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler'))('esbuild')
const directory = await mkdtemp(join(tmpdir(), 'management-tests-'))
try {
  const runner = join(directory, 'run.mjs')
  await build({
    entryPoints: ['tests/management-browser/run.ts'],
    outfile: runner,
    bundle: true,
    platform: 'node',
    format: 'esm',
    define: { 'import.meta.dirname': JSON.stringify(join(process.cwd(), 'tests', 'visual')) },
  })
  const result = spawnSync(process.execPath, [runner], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
