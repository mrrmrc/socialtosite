import { t } from '@/lib/i18n'
import { NavLink } from 'react-router-dom'
import { Home, UserRound, Instagram, FileText, PanelsTopLeft, Search, Diamond, Pencil, Palette, History, Settings, FolderOpen, Sparkles, Lightbulb, ExternalLink, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { siteRequest } from '@/lib/social-site'

const sections = [
  { tab: 'overview', label: 'Home', icon: Home },
  { tab: 'profile', label: 'My profile', icon: UserRound },
  { tab: 'sources', label: 'Connected social accounts', icon: Instagram },
  { tab: 'site', label: 'Contents', icon: FileText },
  { tab: 'publicsite', label: 'Public website', icon: PanelsTopLeft },
  { tab: 'seo', label: 'Monitoring and SEO', icon: Search },
  { tab: 'services', label: 'Plan and services', icon: Diamond },
]
const tools = [
  { to: '/public', label: 'Overview', icon: PanelsTopLeft },
  { to: '/editor', label: 'Modifica sito', icon: Pencil },
  { to: '/themes', label: 'Themes and layouts', icon: Palette },
  { to: '/create', label: 'New website proposal', icon: Sparkles },
  { to: '/versions', label: 'Saved versions', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
]

export function TopNav() {
  const [accountOpen, setAccountOpen] = useState(false)
  const [slug, setSlug] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    siteRequest('site', undefined, controller.signal).then(data => setSlug(data.user.slug || '')).catch(() => {})
    return () => controller.abort()
  }, [])
  return <header className="platform-header bg-bg-1 border-b border-border-default fixed top-0 inset-x-0 z-50">
    <div className="platform-brandbar flex items-center justify-between gap-3 px-4 md:px-8">
      <a href="/dashboard" className="flex items-center gap-3 shrink-0" aria-label="All Social To Web · Home">
        <img src="/logo-cropped.png" alt="" width={36} height={36} className="object-contain" />
        <strong className="text-base text-text-0">All Social To Web</strong>
      </a>
      <div className="flex items-center gap-2">
        <a href="/dashboard?tab=idea" className="platform-header-action"><Lightbulb size={18} aria-hidden="true" /><span>IDEA</span></a>
        {slug && <a href={`/${encodeURIComponent(slug)}`} target="_blank" rel="noopener noreferrer" className="platform-header-action"><ExternalLink size={18} aria-hidden="true" /><span className="hidden sm:inline">{t('Open my website')}</span></a>}
        <div className="relative">
          <button className="platform-header-action" aria-label={t('Account menu')} aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)} onKeyDown={e => { if(e.key==='Escape')setAccountOpen(false) }}><UserRound size={20} aria-hidden="true" /></button>
          {accountOpen && <nav aria-label={t('Account menu')} className="absolute right-0 top-full mt-2 w-60 bg-bg-1 border border-border-default rounded-xl shadow-lg p-2">
            <a href="/dashboard?tab=account" className="flex gap-2 items-center p-3"><UserRound size={18} aria-hidden="true" />{t('My account')}</a>
            <a href="/dashboard?tab=security" className="flex gap-2 items-center p-3"><LockKeyhole size={18} aria-hidden="true" />{t('Password and security')}</a>
          </nav>}
        </div>
      </div>
    </div>
    <nav className="platform-main-nav flex items-center gap-1 overflow-x-auto px-4 md:px-8 border-t border-border-subtle" aria-label={t('Main navigation')}>
      {sections.map(({tab,label,icon:Icon}) => <a key={tab} href={`/dashboard?tab=${tab}`} aria-current={tab==='publicsite' ? 'page' : undefined} className={`platform-nav-link ${tab==='publicsite' ? 'platform-nav-active' : ''}`}><Icon size={18} aria-hidden="true" />{t(label)}</a>)}
    </nav>
    <nav className="platform-site-nav flex items-center gap-1 overflow-x-auto px-4 md:px-8 border-t border-border-subtle" aria-label={t('Website tools')}>
      {tools.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} className={({isActive})=>`platform-tool-link ${isActive ? 'platform-tool-active' : ''}`}><Icon size={16} aria-hidden="true" />{t(label)}</NavLink>)}
    </nav>
  </header>
}
