import React from 'react'
import { createRoot } from 'react-dom/client'
import NextTrain from '../../src/components/displays/WestMidsLCD/NextTrainData'
import { displayServices } from '../../src/live/displayServices'
import { reduceCIS } from '../../src/live/cis'
import { FIXTURES, FROZEN_CLOCK } from '../visual/fixtures'

export async function verifyLCDUpdates() {
  const element = document.body.appendChild(document.createElement('div'))
  const root = createRoot(element)
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const check = (value: unknown, message: string) => {
    if (!value) throw new Error(message)
  }
  const snapshot = structuredClone(FIXTURES['single-departure'].snapshot!)
  const render = () => {
    const state = reduceCIS(null, snapshot)!
    const view = displayServices(state, null, false, false, FROZEN_CLOCK)
    root.render(<NextTrain nextTrain={view.services[0]} />)
  }
  try {
    render()
    await settle()
    const call = snapshot.movements[0].calling_points[0]
    call.name = 'A changed calling point'
    render()
    await settle()
    check(element.textContent?.includes('A changed calling point'), 'LCD memo hid changed calling points')
    snapshot.movements[0].departure = { planned: null, estimated: null, actual: null, unknown_delay: false }
    snapshot.movements[0].origins[0].name = 'A changed origin'
    render()
    await settle()
    check(element.textContent?.includes('This is the service from A changed origin'), 'LCD memo hid a terminating origin change')
  } finally {
    root.unmount()
    element.remove()
  }
}
