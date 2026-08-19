import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ColumnResizeDivider } from '../ColumnResizeDivider'

describe('ColumnResizeDivider', () => {
  it('calls onResize with the live width while dragging, clamped to [min, max]', () => {
    const onResize = vi.fn()
    const onCommit = vi.fn()
    const { container } = render(
      <ColumnResizeDivider width={100} min={60} max={260} onResize={onResize} onCommit={onCommit} />
    )
    const handle = container.firstChild as Element

    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 140, pointerId: 1 })
    expect(onResize).toHaveBeenCalledWith(140)

    // Dragging far past max clamps to max.
    fireEvent.pointerMove(handle, { clientX: 1000, pointerId: 1 })
    expect(onResize).toHaveBeenLastCalledWith(260)

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('calls onCommit once with the final clamped width on pointer up', () => {
    const onResize = vi.fn()
    const onCommit = vi.fn()
    const { container } = render(
      <ColumnResizeDivider width={100} min={60} max={260} onResize={onResize} onCommit={onCommit} />
    )
    const handle = container.firstChild as Element

    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 50, pointerId: 1 })
    // Dragging below min clamps to min.
    fireEvent.pointerUp(handle, { clientX: 20, pointerId: 1 })

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(60)
  })

  it('ignores pointer move/up before a drag has started', () => {
    const onResize = vi.fn()
    const onCommit = vi.fn()
    const { container } = render(
      <ColumnResizeDivider width={100} min={60} max={260} onResize={onResize} onCommit={onCommit} />
    )
    const handle = container.firstChild as Element

    fireEvent.pointerMove(handle, { clientX: 140, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientX: 140, pointerId: 1 })

    expect(onResize).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
  })
})
