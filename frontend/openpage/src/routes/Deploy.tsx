import { t, getBrowserLanguage } from '@/lib/i18n'
import { useState } from 'react'
import {
  Globe,
  FileJson,
  ExternalLink,
  Download,
  Eye,
  Copy,
  Check,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { exportToHTML, downloadHTML, previewHTML } from '@/lib/export-html'
import { publishSite } from '@/lib/publish-site'

const readyOptions = [
  { icon: Download, label: t('Static HTML'), description: t('Download a standalone HTML file'), action: 'html' },
  { icon: FileJson, label: t('JSON Config'), description: t('Download the raw JSON config file'), action: 'json' },
  { icon: Eye, label: t('Preview in Browser'), description: t('Open a standalone preview in a new tab'), action: 'preview' },
] as const


export function Deploy() {
  const config = useConfigStore((s) => s.config)
  const activeProjectId = useEditorStore((s) => s.activeProjectId)
  const projects = useProjectsStore((s) => s.projects)
  const setDeployInfo = useProjectsStore((s) => s.setDeployInfo)

  const project = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null
  const deployUrl = project?.deployUrl
  const lastDeployedAt = project?.lastDeployedAt

  const [exporting, setExporting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleExport(action: (typeof readyOptions)[number]['action']) {
    if (action === 'json') {
      const jsonStr = JSON.stringify(config, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'site-config.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast(t('JSON config downloaded'))
      return
    }

    setExporting(true)
    try {
      const html = await exportToHTML(config, { settings: project?.settings })

      if (action === 'html') {
        const filename = `${(project?.name || config.name || 'site').toLowerCase().replace(/\s+/g, '-')}.html`
        downloadHTML(html, filename)
        toast(t('HTML exported'))
      } else {
        previewHTML(html)
      }
    } catch {
      toast.error(action === 'preview' ? t('Preview failed') : t('Export failed'))
    } finally {
      setExporting(false)
    }
  }

  async function handlePublish() {
    if (!activeProjectId) {
      toast.error(t('Save your project first'))
      return
    }

    setPublishing(true)
    try {
      const { liveUrl, deploymentId } = await publishSite({
        config,
        projectName: project?.name || config.name,
        settings: project?.settings,
      })
      setDeployInfo(activeProjectId, liveUrl, deploymentId)
      toast.success(t('Sito pubblicato'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Deploy failed'))
    } finally {
      setPublishing(false)
    }
  }

  function handleCopy() {
    if (!deployUrl) return
    navigator.clipboard
      .writeText(deployUrl)
      .then(() => {
        setCopied(true)
        toast(t('URL copied'))
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error(t('Could not copy URL')))
  }

  const timeAgo = lastDeployedAt ? formatTimeAgo(lastDeployedAt) : null

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-12 pt-8">
        <h1 className="text-[22px] font-display font-semibold tracking-tight animate-fade-in-up stagger-1">{t("Pubblica il tuo sito")}</h1>
        <p className="text-text-2 text-[15px] mt-1 animate-fade-in-up stagger-2">{t("Controlla l’anteprima e pubblica quando sei pronto.")}</p>
      </div>

      <div className="px-4 md:px-12 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {readyOptions.map((opt, i) => (
            <div
              key={opt.label}
              onClick={() => !exporting && handleExport(opt.action)}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`flex items-start gap-3 p-4 rounded-xl border bg-bg-1 border-border-default card-lift hover:border-border-hover cursor-pointer hover:card-lift-hover animate-fade-in-up ${exporting ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <div className="w-9 h-9 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center text-green shrink-0">
                <opt.icon size={16} />
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold">{opt.label}</span>
                <p className="text-[15px] text-text-2 mt-0.5">{opt.description}</p>
              </div>
              <ExternalLink size={14} className="text-text-3 mt-1 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-12 pt-8 animate-fade-in-up stagger-3">
          <h2 className="text-[15px] font-semibold uppercase tracking-wider text-text-3 mb-3">{t("Pubblicazione")}</h2>
          <div className="p-5 rounded-xl border bg-bg-1 border-border-default">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center text-green shrink-0">
                <Globe size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">{t("Il tuo sito online")}</h3>
                <p className="text-[15px] text-text-2 mt-0.5">
                  {t("Il sito online cambia solo quando premi Pubblica.")}
                </p>

                {deployUrl && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-3 border border-border-subtle">
                      <div className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
                      <a
                        href={deployUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[15px] text-green hover:underline truncate"
                      >
                        {deployUrl.replace('https://', '')}
                      </a>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="w-8 h-8 rounded-lg border border-border-default hover:border-border-hover flex items-center justify-center text-text-3 hover:text-text-1 transition-all shrink-0"
                      title={t("Copy URL")}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <a
                      href={deployUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg border border-border-default hover:border-border-hover flex items-center justify-center text-text-3 hover:text-text-1 transition-all shrink-0"
                      title={t("Visit site")}
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="px-4 py-1.5 rounded-lg bg-green text-bg-0 text-[15px] font-semibold hover:bg-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {publishing ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        {t("Pubblicazione…")}
                      </>
                    ) : deployUrl ? (
                      <>
                        <RefreshCw size={13} />
                        {t("Update")}
                      </>
                    ) : (
                      'Pubblica'
                    )}
                  </button>
                  {timeAgo && (
                    <span className="text-[15px] text-text-3">{t("Last published")} {timeAgo}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      <div className="pb-12" />
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  const formatter = new Intl.RelativeTimeFormat(getBrowserLanguage(), { numeric: 'auto' })
  if (minutes < 1) return formatter.format(0, 'minute')
  if (minutes < 60) return formatter.format(-minutes, 'minute')
  if (minutes < 1440) return formatter.format(-Math.floor(minutes / 60), 'hour')
  return formatter.format(-Math.floor(minutes / 1440), 'day')
}
