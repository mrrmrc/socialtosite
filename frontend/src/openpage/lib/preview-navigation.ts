import type { PageConfig } from '../blocks/types'

export function previewPage(href: string, pages: PageConfig[], origin: string, liveUrl?: string): PageConfig | undefined {
  try {
  const url = new URL(href, origin)
  const live = liveUrl ? new URL(liveUrl, origin) : undefined
  if (url.origin !== new URL(origin).origin && url.origin !== live?.origin) return undefined
  if (url.search) return undefined
  const base = live?.pathname.replace(/\/$/, '') || ''
  const path = url.pathname.replace(/\/$/, '') || '/'
  const relative = base && (path === base || path.startsWith(base + '/')) ? path.slice(base.length) || '/' : path
  return pages.find(page => (page.path.replace(/\/$/, '') || '/') === relative)
  } catch { return undefined }
}
