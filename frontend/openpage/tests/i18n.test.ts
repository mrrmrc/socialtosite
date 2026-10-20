import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBrowserLanguage, t } from '../src/lib/i18n'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PropertiesPanel } from '../src/editor/PropertiesPanel'

afterEach(() => vi.unstubAllGlobals())
describe('browser language for builder controls', () => {
  it('uses the preferred browser language and handles regional variants', () => {
    expect(getBrowserLanguage(['it-IT', 'en-US'])).toBe('it')
    expect(getBrowserLanguage(['en-GB', 'it-IT'])).toBe('en')
    expect(getBrowserLanguage(['fr-FR'])).toBe('en')
  })
  it('translates labels and option text without changing stored variants or customer content', () => {
    vi.stubGlobal('navigator', { languages: ['it-IT'] })
    expect(t('Properties')).toBe('Proprietà')
    const html = renderToStaticMarkup(createElement(PropertiesPanel, { block: {
      id: 'hero', type: 'hero', variant: 'split', props: { headline: 'Customer text in English' },
    } }))
    expect(html).toContain('Proprietà')
    expect(html).toContain('value="split"')
    expect(html).toContain('Affiancata')
    expect(html).toContain('Customer text in English')
  })
  it('shows English controls for an English browser, including existing Italian labels', () => {
    vi.stubGlobal('navigator', { languages: ['en-US'] })
    expect(t('Proprietà')).toBe('Properties')
    expect(t('Pubblica')).toBe('Publish')
    expect(t('Modifica grafica')).toBe('Edit design')
  })
})
