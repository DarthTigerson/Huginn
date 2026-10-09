import { describe, it, expect } from 'vitest'
import { gitChangeCssVars, DEFAULT_CUSTOM_CHANGE_COLORS } from '../gitChangeColors'

describe('gitChangeCssVars', () => {
  it('leaves the colours to the stylesheet in Default mode, so light themes get their own', () => {
    const vars = gitChangeCssVars('default', DEFAULT_CUSTOM_CHANGE_COLORS, 'medium')
    expect(vars['--git-added']).toBeNull()
    expect(vars['--git-modified']).toBeNull()
    expect(vars['--git-deleted']).toBeNull()
  })

  it('sets every colour in Custom mode', () => {
    const vars = gitChangeCssVars('custom', { added: '#00ff00', modified: '#0000ff', deleted: '#ff0000' }, 'medium')
    expect(vars['--git-added']).toBe('#00ff00')
    expect(vars['--git-modified']).toBe('#0000ff')
    expect(vars['--git-deleted']).toBe('#ff0000')
  })

  it('maps strength to the line tint and word highlight amounts', () => {
    expect(gitChangeCssVars('default', DEFAULT_CUSTOM_CHANGE_COLORS, 'subtle')).toMatchObject({ '--git-wash': '6%', '--git-word': '15%' })
    expect(gitChangeCssVars('default', DEFAULT_CUSTOM_CHANGE_COLORS, 'medium')).toMatchObject({ '--git-wash': '10%', '--git-word': '22%' })
    expect(gitChangeCssVars('default', DEFAULT_CUSTOM_CHANGE_COLORS, 'strong')).toMatchObject({ '--git-wash': '18%', '--git-word': '40%' })
  })
})
