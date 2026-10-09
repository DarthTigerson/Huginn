/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FeatureBlock, SettingRow, NumberInput } from '../FeatureBlock'

afterEach(cleanup)

describe('FeatureBlock', () => {
  it('renders title, description, controls and preview', () => {
    render(
      <FeatureBlock title="Blame" description="Who changed this line" preview={<div>picture</div>}>
        <button type="button">control</button>
      </FeatureBlock>
    )
    expect(screen.getByRole('heading', { name: 'Blame' })).toBeInTheDocument()
    expect(screen.getByText('Who changed this line')).toBeInTheDocument()
    expect(screen.getByText('picture')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'control' })).toBeEnabled()
  })

  it('flips its switch', () => {
    const onChange = vi.fn()
    render(<FeatureBlock title="Blame" toggle={{ checked: true, onChange }} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Blame' }))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('dims and disables its controls while off, but keeps its own switch usable', () => {
    const onChange = vi.fn()
    render(
      <FeatureBlock title="Blame" toggle={{ checked: false, onChange }}>
        <button type="button">control</button>
      </FeatureBlock>
    )
    expect(screen.getByRole('button', { name: 'control' })).toBeDisabled()
    const sw = screen.getByRole('switch', { name: 'Blame' })
    expect(sw).toBeEnabled()
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('keeps controls enabled while off when dimWhenOff is false', () => {
    render(
      <FeatureBlock title="Inline diff" toggle={{ checked: false, onChange: () => {} }} dimWhenOff={false}>
        <button type="button">control</button>
      </FeatureBlock>
    )
    expect(screen.getByRole('button', { name: 'control' })).toBeEnabled()
  })

  it('can name its switch separately from its title, and disable it', () => {
    render(<FeatureBlock title="Notes" toggle={{ checked: true, onChange: () => {}, label: 'Enable Notes', disabled: true }} />)
    expect(screen.getByRole('switch', { name: 'Enable Notes' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument()
  })

  it('has no preview column without a preview', () => {
    const { container } = render(<FeatureBlock title="Multi-repo"><span>x</span></FeatureBlock>)
    expect(container.querySelector('[data-preview]')).toBeNull()
  })
})

describe('SettingRow and NumberInput', () => {
  it('labels its control and clamps typed numbers', () => {
    const onChange = vi.fn()
    render(
      <SettingRow label="Fetch every" htmlFor="fetch-interval">
        <NumberInput id="fetch-interval" label="Fetch every" value={5} min={1} max={120} unit="minutes" onChange={onChange} />
      </SettingRow>
    )
    const input = screen.getByLabelText('Fetch every')
    fireEvent.change(input, { target: { value: '500' } })
    expect(onChange).toHaveBeenCalledWith(120)
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(1)
    expect(screen.getByText('minutes')).toBeInTheDocument()
  })
})
