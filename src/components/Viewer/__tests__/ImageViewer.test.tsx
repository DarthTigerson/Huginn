import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { ImageViewer } from '../ImageViewer'

beforeEach(() => {
  ;(global as any).window.api = {
    readImageDataUrl: vi.fn(async (path: string) => `data:image/png;base64,${path.length}`),
  }
})

afterEach(() => {
  cleanup()
})

describe('ImageViewer', () => {
  it('loads and renders the image from a data url', async () => {
    render(<ImageViewer path="/proj/assets/logo.png" />)
    const img = await waitFor(() => screen.getByAltText('logo.png') as HTMLImageElement)
    expect(img.src).toContain('data:image/png;base64,')
    expect(screen.getByText('logo.png')).toBeTruthy()
  })

  it('shows an error message when the image fails to load', async () => {
    ;(window as any).api.readImageDataUrl = vi.fn(async () => {
      throw new Error('nope')
    })
    render(<ImageViewer path="/proj/assets/missing.png" />)
    await waitFor(() => expect(screen.getByText(/Couldn't load missing.png/)).toBeTruthy())
  })
})
