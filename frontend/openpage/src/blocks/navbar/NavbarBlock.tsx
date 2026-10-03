import { useState } from 'react'
import type { BlockConfig } from '../types'
import { safeSiteUrl } from '../../lib/social-site'
export function NavbarBlock({ block }: { block: BlockConfig }) {
  const [open, setOpen] = useState(false)
  const p = block.props
  const links = (p.links || []) as string[]
  const urls = (p.linkUrls || []) as string[]
  return <nav className="px-6 py-4 flex items-center justify-between flex-wrap gap-4">
    <div className="flex items-center gap-3">{p.logoImage ? <img src={safeSiteUrl(p.logoImage)} alt="" className="h-8 w-auto" /> : null}<strong>{String(p.logo || '')}</strong></div>
    <button data-site-menu aria-label="Apri menu" aria-expanded={open} onClick={() => setOpen(!open)} className="@2xl:hidden">☰</button>
    <div data-site-menu-links className={(open ? 'flex' : 'hidden') + ' @2xl:flex flex-wrap gap-6'}>{links.map((label, i) => <a key={i} href={safeSiteUrl(urls[i]) || '#sts-dynamic-articles'} className="text-text-2">{label}</a>)}</div>
    {p.ctaText ? <a href={safeSiteUrl(p.ctaUrl) || '#sts-contact'} className="bg-green text-black px-4 py-2 rounded">{String(p.ctaText)}</a> : null}
  </nav>
}
