import { loadLedBoard } from '../../src/components/displays/LedBoard/loadLedBoard'

export async function verifyHideTerminating(feed: string) {
  const api = await loadLedBoard()
  for (const board of ['infotec', 'daktronics'] as const) {
    for (const serviceCount of [1, 3]) {
      const options = { board, serviceCount, crs: 'ECR', width: 256, height: 64 }
      const filtered = api.create({ ...options, url: `${feed}/terminating`, hideTerminating: true })
      const reference = api.create({ ...options, url: `${feed}/terminating-departures-only` })
      if (filtered instanceof Error || reference instanceof Error) throw new Error('Could not create terminating filter boards')
      try {
        let updates = 0
        filtered.onUpdate = reference.onUpdate = () => updates++
        for (let tries = 0; updates < 2 && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 20))
        if (updates < 2) throw new Error('Terminating test boards did not receive their feeds')
        const start = Date.parse('2026-09-13T18:40:00Z')
        for (let elapsed = 0; elapsed < 5000; elapsed += 20) {
          filtered.tick(start + elapsed)
          reference.tick(start + elapsed)
          if (filtered.pixels.some((value, i) => value !== reference.pixels[i])) {
            throw new Error(`${board}/${serviceCount}: hiding terminating trains differs from departures-only feed at ${elapsed} ms`)
          }
        }
      } finally {
        filtered.close()
        reference.close()
      }
    }
  }
  return 'Terminating train filtering matches departures-only frames for both WASM boards.'
}

export async function verifyProjection(feed: string) {
  const api = await loadLedBoard()
  const results = []
  for (const board of ['infotec', 'daktronics'] as const) {
    for (const serviceCount of [1, 3, 6]) {
      const options = { board, serviceCount, crs: 'ECR', width: 256, height: 64 }
      const stream = api.create({ ...options, url: `${feed}/projection-updates` })
      const reference = api.create({ ...options, url: `${feed}/projection-final` })
      if (stream instanceof Error || reference instanceof Error) throw new Error('Could not create projection boards')
      let notifications = 0
      stream.onUpdate = () => notifications++
      try {
        await new Promise(resolve => setTimeout(resolve, 1000))
        if (notifications !== 2)
          throw new Error(`${board}/${serviceCount}: expected snapshot + visible delta, got ${notifications} notifications`)
        const start = Date.parse('2026-09-13T18:40:00Z')
        for (let elapsed = 0; elapsed < 5000; elapsed += 20) {
          stream.tick(start + elapsed)
          reference.tick(start + elapsed)
          if (stream.pixels.some((value, i) => value !== reference.pixels[i])) {
            throw new Error(`${board}/${serviceCount}: visible delta differs from snapshot at ${elapsed} ms`)
          }
        }
        results.push({ board, serviceCount, messages: 8, notifications, finalFramesMatch: true })
      } finally {
        stream.close()
        reference.close()
      }
    }
  }
  return results
}

export async function verify(feed: string) {
  const api = await loadLedBoard()
  const results = []
  for (const board of ['infotec', 'daktronics'] as const) {
    for (const fixture of ['no-departures', 'busy-board']) {
      for (const hz of [60, 90, 120, 144]) {
        const options = { board, crs: 'ECR', url: `${feed}/${fixture}`, width: 256, height: 64 }
        const regular = api.create(options)
        const scheduled = api.create(options)
        if (regular instanceof Error || scheduled instanceof Error) throw new Error('Could not create WASM boards')
        if (!('onUpdate' in scheduled)) throw new Error('WASM bundle does not expose feed notifications')
        let notifications = 0
        scheduled.onUpdate = () => notifications++
        try {
          await new Promise(resolve => setTimeout(resolve, 150))
          if (!notifications) throw new Error('Live feed did not notify its renderer')
          let calls = 0
          let previousTime = 0
          const start = Date.parse('2026-09-13T18:40:00Z')
          const compareAt = (now: number) => {
            const changed = regular.tick(now)
            const due = scheduled.nextTick
            let drawn = false
            if (!due || now >= due || now < previousTime) {
              drawn = scheduled.tick(now)
              calls++
            }
            previousTime = now
            if (changed || drawn) {
              if (regular.pixels.some((value, i) => value !== scheduled.pixels[i])) {
                throw new Error(`${board}/${fixture}/${hz} Hz differs at ${now - start} ms`)
              }
            }
          }
          for (let i = 0; i < hz * 30; i++) compareAt(start + Math.floor((i * 1000) / hz))
          const steadyCalls = calls
          compareAt(start + 600_000) // Resume after a background interval.
          if (fixture === 'no-departures') {
            compareAt(start - 1000) // A corrected wall clock must bypass the old deadline.
            if (steadyCalls >= hz * 10) throw new Error(`${board}: idle WASM calls were not reduced`)
          }
          results.push({ board, fixture, hz, ticksBefore: hz * 30, ticksAfter: steadyCalls })
        } finally {
          regular.close()
          scheduled.close()
        }
      }
    }
  }
  return results
}
