import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from '../terminalStore'

describe('terminalStore', () => {
  beforeEach(() => useTerminalStore.setState({ visible: false }))

  it('starts hidden', () => {
    expect(useTerminalStore.getState().visible).toBe(false)
  })

  it('toggle flips visibility', () => {
    useTerminalStore.getState().toggle()
    expect(useTerminalStore.getState().visible).toBe(true)
    useTerminalStore.getState().toggle()
    expect(useTerminalStore.getState().visible).toBe(false)
  })

  it('show sets visible true', () => {
    useTerminalStore.getState().show()
    expect(useTerminalStore.getState().visible).toBe(true)
  })

  it('hide sets visible false', () => {
    useTerminalStore.setState({ visible: true })
    useTerminalStore.getState().hide()
    expect(useTerminalStore.getState().visible).toBe(false)
  })
})
