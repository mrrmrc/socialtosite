import { useEffect } from 'react'
import { googleFontUrl } from './site-fonts'

export function useGoogleFonts(fonts: string[]) {
  const url = googleFontUrl(fonts)
  useEffect(() => {
    // Load exactly the same families and weights as exported HTML, including defaults.
    if ([...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].some(link => link.href === url)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.dataset.siteFonts = 'true'
    document.head.appendChild(link)
    // Keep fonts available across routes; do not cache a load that might have failed.
  }, [url])
}
