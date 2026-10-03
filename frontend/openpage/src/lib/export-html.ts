import type { SiteConfig } from '@/blocks/types'
import { resolveTheme, themeToCSS } from '@/lib/theme-presets'
import { RenderBlock } from '@/blocks/registry'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import siteCss from '../index.css?inline'
import { getBrowserLanguage } from './i18n'

export interface ExportSiteSettings {
  siteName?: string
  siteDescription?: string
  faviconUrl?: string
  language?: string
  seoTitle?: string
  seoDescription?: string
  ogImageUrl?: string
  gaId?: string
  posthogKey?: string
}

export interface ExportSiteOptions {
  settings?: ExportSiteSettings
  dynamicArticles?: boolean
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function googleFontUrl(fonts: string[]): string {
  const unique = [...new Set(fonts.filter(Boolean))]
  const families = unique.map(
    (f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`
  )
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

function normalizeLanguage(value?: string): string {
  const normalized = (value || '').toLowerCase().trim()
  if (!normalized) return getBrowserLanguage()
  if (normalized === 'italian' || normalized === 'italiano' || normalized.startsWith('it')) return 'it'
  if (normalized === 'english' || normalized.startsWith('en')) return 'en'
  if (normalized === 'german' || normalized.startsWith('de')) return 'de'
  if (normalized === 'spanish' || normalized.startsWith('es')) return 'es'
  if (normalized === 'french' || normalized.startsWith('fr')) return 'fr'
  return 'en'
}

export function exportSiteToHTML(config: SiteConfig, options?: ExportSiteOptions): string {
  const theme = resolveTheme(config.theme)
  const fonts = [theme.fontSans, theme.fontDisplay, theme.fontMono]
  const fontUrl = googleFontUrl(fonts)
  const settings = options?.settings

  const themeCss = Object.entries(themeToCSS(theme)).map(([key, value]) => `${key}:${value}`).join(';')

  const homeBlocks = config.pages?.find(p => p.path === '/')?.blocks || config.blocks
  const blocksHtml = homeBlocks.map((block) => {
    const markup = renderToStaticMarkup(createElement(RenderBlock, { block, dynamicArticles: options?.dynamicArticles }))
    return `<div id="${escapeHtml(block.id)}" class="scroll-revealed">${markup}</div>`
  }).join('\n')

  const pageTitle = (settings?.seoTitle || settings?.siteName || config.name || 'Website').trim()
  const pageDescription = (settings?.seoDescription || settings?.siteDescription || '').trim()
  const ogTitle = (settings?.seoTitle || settings?.siteName || pageTitle).trim()
  const ogDescription = (settings?.seoDescription || settings?.siteDescription || pageDescription).trim()
  const ogImage = (settings?.ogImageUrl || '').trim()
  const faviconUrl = (settings?.faviconUrl || '').trim()
  const gaId = (settings?.gaId || '').trim()
  const posthogKey = (settings?.posthogKey || '').trim()
  const lang = normalizeLanguage(settings?.language)

  const descriptionMeta = pageDescription
    ? `  <meta name="description" content="${escapeHtml(pageDescription)}" />\n`
    : ''
  const ogDescriptionMeta = ogDescription
    ? `  <meta property="og:description" content="${escapeHtml(ogDescription)}" />\n`
    : ''
  const ogImageMeta = ogImage
    ? `  <meta property="og:image" content="${escapeHtml(ogImage)}" />\n`
    : ''
  const faviconLink = faviconUrl
    ? `  <link rel="icon" href="${escapeHtml(faviconUrl)}" />\n`
    : ''

  const gaScript = gaId
    ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', ${JSON.stringify(gaId)});
  </script>`
    : ''

  const posthogScript = posthogKey
    ? `
  <script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");
    2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}
    (p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",
    (r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",
    u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},
    u.people.toString=function(){return u.toString(1)+".people"},o="init capture register register_once alias unregister identify set_config reset opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing".split(" "),
    n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init(${JSON.stringify(posthogKey)}, { api_host: 'https://us.i.posthog.com' });
  </script>`
    : ''

  const interactionScript = `<script>
    document.querySelectorAll('[data-site-menu]').forEach(function(button) {
      button.addEventListener('click', function() {
        var open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        var links = button.closest('nav').querySelector('[data-site-menu-links]');
        if (links) { links.classList.toggle('hidden', !open); links.classList.toggle('flex', open); }
      });
    });
    document.querySelectorAll('[data-faq-toggle]').forEach(function(button) {
      button.addEventListener('click', function() {
        var open = button.getAttribute('aria-expanded') !== 'true';
        button.closest('section').querySelectorAll('[data-faq-toggle]').forEach(function(other) {
          var expanded = other === button && open;
          other.setAttribute('aria-expanded', String(expanded));
          other.nextElementSibling.style.maxHeight = expanded ? '500px' : '0';
          other.nextElementSibling.style.paddingBottom = expanded ? '1rem' : '0';
          var chevron = other.querySelector('svg');
          if (chevron) { chevron.classList.toggle('rotate-180', expanded); chevron.classList.toggle('text-green', expanded); }
        });
      });
    });
  </script>`

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageTitle)}</title>
${descriptionMeta}  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
${ogDescriptionMeta}${ogImageMeta}${faviconLink}

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="${fontUrl}" />

  <style>
${siteCss}
:root{${themeCss}}
html{font-size:16px}body{height:auto;width:auto;overflow:visible;margin:0;background:var(--color-bg-1);color:var(--color-text-0)}
h1,h2,h3,h4,h5,h6{font-family:var(--font-display)}
  </style>
${gaScript}
${posthogScript}
</head>
<body>

<main class="site-render @container">${blocksHtml}</main>
${interactionScript}
</body>
</html>`
}

export async function exportToHTML(
  config: SiteConfig,
  options?: ExportSiteOptions
): Promise<string> {
  return exportSiteToHTML(config, options)
}

export function downloadHTML(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function previewHTML(html: string): void {
  const previewWindow = window.open('', '_blank', 'noopener,noreferrer')
  if (!previewWindow) {
    throw new Error('Preview popup was blocked')
  }
  previewWindow.document.open()
  previewWindow.document.write(html)
  previewWindow.document.close()
}
