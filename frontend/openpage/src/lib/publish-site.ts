import { getSiteToken } from './social-site'
import type { SiteConfig } from '@/blocks/types'
import { exportSiteToHTML } from '@/lib/export-html'
import type { ProjectSettings } from '@/store/projectsStore'

interface DeployApiResponse {
  url?: string
  projectUrl?: string
  deploymentId?: string
  error?: string
  details?: string
}

export interface PublishSiteInput {
  config: SiteConfig
  projectName?: string
  settings?: ProjectSettings
}

export interface PublishSiteResult {
  liveUrl: string
  deploymentId: string
}


async function readDeployError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as DeployApiResponse
    if (typeof payload.details === 'string' && payload.details.trim()) return payload.details
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error
  } catch {
    // Ignore JSON parse errors and fall back to status text.
  }
  return response.statusText || `Deploy failed (${response.status})`
}

export async function publishSite(input: PublishSiteInput): Promise<PublishSiteResult> {
  const { config, settings } = input

  const token = getSiteToken()
  
  const html = exportSiteToHTML(config, { settings, dynamicArticles: true })
  const configJson = JSON.stringify(config)

  const response = await fetch('/api/index.php?action=openpage-publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ html, config: configJson, settings }),
  })

  if (!response.ok) {
    throw new Error(await readDeployError(response))
  }

  const data = await response.json() as DeployApiResponse
  if (!data.url || !data.deploymentId) throw new Error(data.error || "Risposta di pubblicazione non valida")
  
  // The PHP backend just returns {ok: true}.
  // We can return a generic success indicator.
  return { liveUrl: new URL(data.url, window.location.origin).href, deploymentId: data.deploymentId }
}
