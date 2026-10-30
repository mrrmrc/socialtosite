import { t } from '@/lib/i18n'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, UserRound, Link as LinkIcon, FileText, Globe, ChartNoAxesColumn, Pencil, Palette, History, Settings, FolderOpen, Sparkles, ExternalLink, LockKeyhole, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { siteRequest } from '@/lib/social-site'

const sections = [
  { tab: 'overview', label: 'Home', icon: Home },
  { tab: 'site', label: 'Contenuti', icon: FileText },
  { tab: 'publicsite', label: 'Il sito', icon: Globe },
  { tab: 'seo', label: 'Risultati', icon: ChartNoAxesColumn },
  { tab: 'sources', label: 'Canali', icon: LinkIcon },
]
const tools = [
  { to: '/public', label: 'Guarda il sito', icon: Globe },
  { to: '/editor', label: 'Modifica sito', icon: Pencil },
  { to: '/themes', label: 'Scegli la grafica', icon: Palette },
  { to: '/create', label: 'Nuova proposta con LIA', icon: Sparkles },
  { to: '/versions', label: 'Versioni salvate', icon: History },
  { to: '/settings', label: 'Impostazioni del sito', icon: Settings },
  { to: '/projects', label: 'Progetti', icon: FolderOpen },
]
const platformLogo = new URL('../../../public/logo-cropped.png', import.meta.url).href

export function TopNav() {
  const [accountOpen, setAccountOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [slug, setSlug] = useState('')
  const accountRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  useEffect(() => { setMenuOpen(false); setAccountOpen(false) }, [location.pathname])
  useEffect(() => {
    const controller = new AbortController()
    siteRequest('site', undefined, controller.signal).then(data => setSlug(data.user.slug || '')).catch(() => {})
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!accountOpen) return
    const close = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [accountOpen])
  return <>
    <header className="platform-header">
      <div className="platform-brandbar">
        <a href="/dashboard" className="platform-brand" aria-label="All Social To Web · Home">
          <img src={platformLogo} alt="" width={36} height={36}/><strong>All Social To Web</strong>
        </a>
        <div className="platform-account-actions">
          {slug && <a href={`/${encodeURIComponent(slug)}`} target="_blank" rel="noopener noreferrer" className="platform-header-action"><ExternalLink size={18} aria-hidden="true"/><span className="platform-open-site-label">{t('Open my website')}</span></a>}
          <div className="platform-account" ref={accountRef}>
            <button type="button" className="platform-account-trigger" aria-label="Apri menu utente" aria-expanded={accountOpen} aria-controls="builder-account-menu" onClick={() => setAccountOpen(!accountOpen)} onKeyDown={event => { if (event.key === 'Escape') setAccountOpen(false) }}><span><UserRound size={21} aria-hidden="true"/></span><ChevronDown size={16} aria-hidden="true"/></button>
            {accountOpen && <nav id="builder-account-menu" aria-label="Menu utente" className="platform-account-menu" onKeyDown={event => { if (event.key === 'Escape') setAccountOpen(false) }}>
              <a href="/dashboard?tab=account"><UserRound size={18} aria-hidden="true"/>Modifica i miei dati</a>
              <a href="/dashboard?tab=security"><LockKeyhole size={18} aria-hidden="true"/>Password e accessi</a>
            </nav>}
          </div>
        </div>
      </div>
    </header>
    <aside className="platform-sidebar" aria-label="Menu del tuo spazio">
      <button type="button" className="platform-menu-toggle" aria-expanded={menuOpen} aria-controls="builder-menu-items" onClick={() => setMenuOpen(!menuOpen)}>Menu e strumenti<ChevronDown size={20} aria-hidden="true"/></button>
      <div id="builder-menu-items" className={`platform-menu-items${menuOpen ? ' is-open' : ''}`}>
        <nav className="platform-main-nav" aria-label="Sezioni della piattaforma">
          {sections.map(({tab,label,icon:Icon}) => <a key={tab} href={`/dashboard?tab=${tab}`} className={`platform-nav-link${tab === 'publicsite' ? ' platform-nav-active' : ''}`}><Icon size={20} aria-hidden="true"/><span>{label}</span></a>)}
        </nav>
        <nav className="platform-site-nav" aria-label="Strumenti del sito"><h2>Il tuo sito</h2>
          {tools.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({isActive}) => `platform-tool-link${isActive ? ' platform-tool-active' : ''}`}><Icon size={20} aria-hidden="true"/><span>{label}</span></NavLink>)}
        </nav>
      </div>
    </aside>
  </>
}
