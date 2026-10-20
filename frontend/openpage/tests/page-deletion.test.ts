import { expect, it } from 'vitest'
import { useConfigStore } from '../src/store/configStore'

it('deletes an editing page and restores its contents with undo', () => {
  const home = { id: 'home', name: 'Home', path: '/', blocks: [] }
  const lalsa = { id: 'lalsa', name: 'LALSA', path: '/lalsa', blocks: [{ id: 'text', type: 'content' as const, variant: 'prose', props: { body: 'Contenuto da preservare' } }] }
  useConfigStore.getState().setConfig({ name: 'Check', pages: [home, lalsa], blocks: [] })
  useConfigStore.getState().setActivePage('lalsa')
  useConfigStore.getState().removePage('lalsa')
  expect(useConfigStore.getState().config.pages?.map(page => page.id)).toEqual(['home'])
  expect(useConfigStore.getState().activePageId).toBe('home')
  useConfigStore.getState().undo()
  expect(useConfigStore.getState().config.pages?.[1]).toEqual(lalsa)
})

it('protects the last page and does not change history for a missing page', () => {
  useConfigStore.getState().setConfig({ name: 'Check', pages: [{ id: 'home', name: 'Home', path: '/', blocks: [] }], blocks: [] })
  useConfigStore.getState().removePage('home')
  useConfigStore.getState().removePage('missing')
  expect(useConfigStore.getState().config.pages).toHaveLength(1)
  expect(useConfigStore.getState().undoStack).toHaveLength(0)
})
