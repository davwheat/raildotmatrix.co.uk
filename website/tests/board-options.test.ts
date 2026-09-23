import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyOptions, defaults, isRailAnnouncementsEmbed, readOptions } from '../src/components/BoardOptions/settings'

const infotec = 'infotec-landscape-dmi'
test('old preferences merge with new defaults and migrate platform labels', () => {
  const result = readOptions(infotec, { color: 'white', platformPosition: 'after' }, new URLSearchParams())
  assert.equal(result.color, 'white')
  assert.equal(result.rowPrefix, 'platforms')
  assert.equal(result.compactLowerRow, true)
  assert.equal(result.serviceCount, 3)
})
test('URL values override storage, including explicitly disabled booleans', () => {
  const result = readOptions(
    infotec,
    { color: 'orange', platformBox: true, compactLowerRow: true },
    new URLSearchParams('color=white&platformBox=0&compactLowerRow=false&serviceCount=6'),
  )
  assert.equal(result.color, 'white')
  assert.equal(result.platformBox, false)
  assert.equal(result.compactLowerRow, false)
  assert.equal(result.serviceCount, 6)
})
test('invalid preferences and unknown URL values fall back safely', () => {
  const result = readOptions(
    infotec,
    { color: 'pink', serviceCount: -5, platformBox: 'yes' },
    new URLSearchParams('color=purple&serviceCount=100'),
  )
  assert.deepEqual(result, defaults)
  assert.deepEqual(readOptions(infotec, null, new URLSearchParams()), defaults)
})
test('shared URLs round-trip independently of recipient preferences', () => {
  const params = new URLSearchParams(
    'station=ECR&platform=2&platform=4&dataSource=websocket&liveServiceUrl=ws://localhost:8080&hideSettings=1&boardStyle=Blue',
  )
  const wanted = { ...defaults, color: 'white' as const, serviceCount: 5, platformBox: true }
  applyOptions(params, infotec, wanted)
  assert.equal(params.get('station'), 'ECR')
  assert.deepEqual(params.getAll('platform'), ['2', '4'])
  assert.equal(params.get('dataSource'), 'websocket')
  assert.equal(params.get('liveServiceUrl'), 'ws://localhost:8080')
  assert.equal(params.has('boardStyle'), false)
  assert.equal(params.has('hideSettings'), false)
  assert.deepEqual(readOptions(infotec, { color: 'orange', warningPlatform: true, compactLowerRow: false }, params), wanted)
})
test('display-specific options do not leak between formats', () => {
  const params = new URLSearchParams('platformBox=1&serviceCount=6&color=white')
  applyOptions(params, 'blackbox-landscape-lcd', defaults)
  assert.deepEqual([...params.keys()].sort(), ['showUnconfirmedPlatforms', 'useLegacyTocNames'])
})
test('RailAnnouncements modal requires an iframe and a matching marker or referrer', () => {
  const marker = new URLSearchParams('from-railannouncements.co.uk=1')
  assert.equal(isRailAnnouncementsEmbed(false, marker, ''), false)
  assert.equal(isRailAnnouncementsEmbed(true, marker, ''), true)
  assert.equal(isRailAnnouncementsEmbed(true, new URLSearchParams(), 'https://railannouncements.co.uk/'), true)
  assert.equal(isRailAnnouncementsEmbed(true, new URLSearchParams(), 'https://www.railannouncements.co.uk/'), true)
  assert.equal(isRailAnnouncementsEmbed(true, new URLSearchParams(), 'https://railannouncements.co.uk.example.org/'), false)
  assert.equal(isRailAnnouncementsEmbed(true, new URLSearchParams(), ''), false)
})

test('loading brightness accepts only 50 or 100 and round-trips in shared links', () => {
  assert.equal(readOptions(infotec, {}, new URLSearchParams()).loadingBrightness, 50)
  assert.equal(readOptions(infotec, { loadingBrightness: 100 }, new URLSearchParams()).loadingBrightness, 100)
  assert.equal(readOptions(infotec, {}, new URLSearchParams('loadingBrightness=100')).loadingBrightness, 100)
  assert.equal(readOptions(infotec, {}, new URLSearchParams('loadingBrightness=75')).loadingBrightness, 50)
  const query = new URLSearchParams()
  applyOptions(query, infotec, { ...defaults, loadingBrightness: 100 })
  assert.equal(readOptions(infotec, {}, query).loadingBrightness, 100)
})

test('formation count validates all six choices and round-trips in shared links', () => {
  assert.equal(readOptions(infotec, {}, new URLSearchParams()).formationCount, 'none')
  for (const formationCount of ['none', 'number', 'coaches', 'coaches-no-brackets', 'carriages', 'carriages-no-brackets'] as const) {
    assert.equal(readOptions(infotec, { formationCount }, new URLSearchParams()).formationCount, formationCount)
    const query = new URLSearchParams()
    applyOptions(query, infotec, { ...defaults, formationCount })
    assert.equal(query.get('formationCount'), formationCount)
    assert.equal(readOptions(infotec, { formationCount: 'coaches' }, query).formationCount, formationCount)
  }
  assert.equal(readOptions(infotec, { formationCount: 'invalid' }, new URLSearchParams()).formationCount, 'none')
  assert.equal(readOptions(infotec, {}, new URLSearchParams('formationCount=invalid')).formationCount, 'none')
  assert.equal(readOptions(infotec, {}, new URLSearchParams('formationCount=number-no-brackets')).formationCount, 'none')
  assert.equal(readOptions(infotec, { formationCount: 'coaches' }, new URLSearchParams('formationCount=invalid')).formationCount, 'coaches')
})
