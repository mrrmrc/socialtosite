import { describe, expect, it } from 'vitest'
import { previewPage } from '../src/lib/preview-navigation'
const pages = [{ id: 'home', name: 'Home', path: '/', blocks: [] }, { id: 'about', name: 'LALSA', path: '/lalsa', blocks: [] }]
describe('Draft preview navigation', () => {
  it('keeps root and published site paths inside the draft', () => {
    expect(previewPage('/lalsa', pages, 'http://localhost')?.id).toBe('about')
    expect(previewPage('/marco/lalsa#details', pages, 'http://localhost', 'http://localhost/marco')?.id).toBe('about')
    expect(previewPage('/marco', pages, 'http://localhost', 'http://localhost/marco')?.id).toBe('home')
  })
  it('does not turn external links, articles or invalid URLs into draft pages', () => {
    expect(previewPage('https://other.example/lalsa', pages, 'http://localhost')).toBeUndefined()
    expect(previewPage('/marco?article=1', pages, 'http://localhost', 'http://localhost/marco')).toBeUndefined()
    expect(previewPage('http://[', pages, 'http://localhost')).toBeUndefined()
  })
})
