import { t } from '@/lib/i18n'
import { blockMetadata } from '@/lib/block-metadata'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Code } from 'lucide-react'
import type { BlockConfig, BlockType } from '@/blocks/types'
import { useConfigStore } from '@/store/configStore'

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'array-strings' | 'array-items'
  options?: string[]
}

const blockFields: Partial<Record<BlockType, { sections: { title: string; fields: FieldDef[] }[] }>> = {
  navbar: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'logo', label: t('Logo Text'), type: 'text' },
          { key: 'logoImage', label: t('Logo Image URL'), type: 'text' },
          { key: 'ctaText', label: t('CTA Button'), type: 'text' },
          { key: 'links', label: t('Voci del menu'), type: 'array-strings' },
          { key: 'linkUrls', label: t('Destinazioni (stesso ordine)'), type: 'array-strings' },
          { key: 'ctaUrl', label: t('Destinazione pulsante'), type: 'text' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['default', 'centered'] },
        ],
      },
    ],
  },
  hero: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'badge', label: t('Badge'), type: 'text' },
          { key: 'headline', label: t('Headline'), type: 'text' },
          { key: 'subheadline', label: t('Subheadline'), type: 'textarea' },
          { key: 'primaryCta', label: t('Primary CTA'), type: 'text' },
          { key: 'primaryCtaUrl', label: t('Primary CTA URL'), type: 'text' },
          { key: 'secondaryCta', label: t('Secondary CTA'), type: 'text' },
          { key: 'secondaryCtaUrl', label: t('Secondary CTA URL'), type: 'text' },
          { key: 'heroImage', label: t('Hero Image URL'), type: 'text' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['centered', 'split', 'gradient', 'minimal'] },
        ],
      },
    ],
  },
  features: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'label', label: t('Section Label'), type: 'text' },
          { key: 'title', label: t('Title'), type: 'text' },
          { key: 'subtitle', label: t('Subtitle'), type: 'text' },
        ],
      },
      {
        title: t('Items'),
        fields: [
          { key: 'items', label: t('Feature Cards'), type: 'array-items' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['grid', 'list', 'alternating'] },
        ],
      },
    ],
  },
  pricing: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'title', label: t('Title'), type: 'text' },
          { key: 'subtitle', label: t('Subtitle'), type: 'text' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['simple', 'comparison'] },
        ],
      },
    ],
  },
  cta: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'headline', label: t('Headline'), type: 'text' },
          { key: 'subheadline', label: t('Subheadline'), type: 'text' },
          { key: 'buttonText', label: t('Button Text'), type: 'text' },
          { key: 'buttonUrl', label: t('Button URL'), type: 'text' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['simple', 'split'] },
        ],
      },
    ],
  },
  footer: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'logo', label: t('Logo Text'), type: 'text' },
          { key: 'logoImage', label: t('Logo Image URL'), type: 'text' },
          { key: 'copyright', label: t('Copyright'), type: 'text' },
          { key: 'links', label: t('Links'), type: 'array-strings' },
          { key: 'linkUrls', label: 'Destinazioni dei link (stesso ordine)', type: 'array-strings' },
          { key: 'columns', label: 'Colonne del piè di pagina', type: 'array-items' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['simple', 'multi-column', 'minimal'] },
        ],
      },
    ],
  },
  testimonials: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'title', label: t('Title'), type: 'text' },
          { key: 'subtitle', label: t('Subtitle'), type: 'text' },
          { key: 'items', label: t('Testimonials'), type: 'array-items' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['cards', 'carousel', 'spotlight'] },
        ],
      },
    ],
  },
  stats: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'title', label: t('Title'), type: 'text' },
          { key: 'items', label: t('Stats'), type: 'array-items' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['grid', 'bar', 'counter'] },
        ],
      },
    ],
  },
  faq: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'title', label: t('Title'), type: 'text' },
          { key: 'subtitle', label: t('Subtitle'), type: 'text' },
          { key: 'items', label: t('Questions'), type: 'array-items' },
        ],
      },
    ],
  },
  team: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'title', label: t('Title'), type: 'text' },
          { key: 'subtitle', label: t('Subtitle'), type: 'text' },
          { key: 'members', label: t('Members'), type: 'array-items' },
        ],
      },
    ],
  },
  contact: { sections: [{ title: t('Content'), fields: [
    { key: 'title', label: t('Title'), type: 'text' },
    { key: 'subtitle', label: t('Subtitle'), type: 'text' },
    { key: 'buttonText', label: t('Button Text'), type: 'text' },
  ] }, { title: 'Invio e privacy', fields: [
    { key: 'recipientEmail', label: 'Email destinatario (apre il programma email)', type: 'text' },
    { key: 'submitUrl', label: 'Servizio di invio POST (alternativo all’email)', type: 'text' },
    { key: 'privacyUrl', label: 'Link all’informativa privacy', type: 'text' },
    { key: 'privacyText', label: 'Testo della presa visione', type: 'textarea' },
  ] }] },
  newsletter: { sections: [{ title: t('Content'), fields: [
    { key: 'title', label: t('Title'), type: 'text' },
    { key: 'subtitle', label: t('Subtitle'), type: 'text' },
    { key: 'buttonText', label: t('Button Text'), type: 'text' },
    { key: 'socialProof', label: t('Social Proof'), type: 'text' },
  ] }, { title: 'Iscrizione e privacy', fields: [
    { key: 'submitUrl', label: 'Servizio newsletter (URL per invio POST)', type: 'text' },
    { key: 'privacyUrl', label: 'Link all’informativa privacy', type: 'text' },
    { key: 'privacyText', label: 'Testo del consenso alla newsletter', type: 'textarea' },
  ] }] },
  logocloud: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'title', label: t('Title'), type: 'text' },
          { key: 'logos', label: t('Logos'), type: 'array-strings' },
        ],
      },
    ],
  },
  content: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'body', label: t('Body'), type: 'textarea' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['prose', 'columns', 'highlight'] },
        ],
      },
    ],
  },
  image: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'src', label: t('Image URL'), type: 'text' },
          { key: 'alt', label: t('Alt Text'), type: 'text' },
          { key: 'title', label: t('Title'), type: 'text' },
          { key: 'subtitle', label: t('Subtitle'), type: 'text' },
          { key: 'imageSide', label: t('Image Side'), type: 'select', options: ['left', 'right'] },
        ],
      },
      {
        title: t('Grid Images'),
        fields: [
          { key: 'images', label: t('Images'), type: 'array-items' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['hero-image', 'side-by-side', 'grid'] },
        ],
      },
    ],
  },
  video: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'url', label: t('Video URL'), type: 'text' },
          { key: 'title', label: t('Title'), type: 'text' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Platform'), type: 'select', options: ['youtube', 'vimeo'] },
        ],
      },
    ],
  },
  gallery: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'title', label: t('Title'), type: 'text' },
          { key: 'images', label: t('Images'), type: 'array-items' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['grid', 'masonry'] },
        ],
      },
    ],
  },
  divider: {
    sections: [
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['line', 'space', 'dots'] },
          { key: 'width', label: t('Width'), type: 'select', options: ['full', 'centered', 'narrow'] },
          { key: 'height', label: t('Height (px)'), type: 'text' },
        ],
      },
    ],
  },
  banner: {
    sections: [
      {
        title: t('Content'),
        fields: [
          { key: 'text', label: t('Text'), type: 'text' },
          { key: 'linkText', label: t('Link Text'), type: 'text' },
          { key: 'linkUrl', label: t('Link URL'), type: 'text' },
        ],
      },
      {
        title: t('Style'),
        fields: [
          { key: 'variant', label: t('Variant'), type: 'select', options: ['ribbon', 'bar'] },
        ],
      },
    ],
  },
}

function PropertyField({ field, block }: { field: FieldDef; block: BlockConfig }) {
  const updateBlockProps = useConfigStore((s) => s.updateBlockProps)
  const updateBlock = useConfigStore((s) => s.updateBlock)

  // For variant field, it's on the block itself
  const value = field.key === 'variant'
    ? block.variant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (block.props as any)[field.key]

  const onChange = (newValue: unknown) => {
    if (field.key === 'variant') {
      updateBlock(block.id, { variant: newValue as string })
    } else {
      updateBlockProps(block.id, { [field.key]: newValue })
    }
  }

  switch (field.type) {
    case 'text':
    case 'number':
    case 'date':
      return (
        <div className="mb-2.5">
          <label htmlFor={`field-${block.id}-${field.key}`} className="block text-[15px] text-text-2 mb-1 font-medium">{t(field.label)}</label>
          <input
            id={`field-${block.id}-${field.key}`}
            type={field.type}
            min={field.type==='number'?0:undefined}
            max={field.type==='number'?(field.key==='maxArticles'?1000:36500):undefined}
            value={String(value || '')}
            onChange={(e) => onChange(field.type==='number'?Number(e.target.value):e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-[15px] outline-none focus:border-green"
          />
        </div>
      )

    case 'textarea':
      return (
        <div className="mb-2.5">
          <label className="block text-[15px] text-text-2 mb-1 font-medium">{t(field.label)}</label>
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-[15px] outline-none focus:border-green resize-y"
          />
        </div>
      )

    case 'select':
      return (
        <div className="mb-2.5">
          <label className="block text-[15px] text-text-2 mb-1 font-medium">{t(field.label)}</label>
          <select
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-[15px] outline-none focus:border-green cursor-pointer"
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{t(opt)}</option>
            ))}
          </select>
        </div>
      )

    case 'array-strings': {
      const items = (Array.isArray(value) ? value : []) as string[]
      return (
        <div className="mb-2.5">
          <label className="block text-[15px] text-text-2 mb-1 font-medium">{t(field.label)}</label>
          {items.map((item, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const updated = [...items]
                  updated[i] = e.target.value
                  onChange(updated)
                }}
                className="flex-1 px-2 py-1 rounded border border-border-default bg-bg-2 text-text-0 text-[15px] outline-none focus:border-green"
              />
              <button
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="px-1.5 text-text-3 hover:text-status-red text-[15px] transition-colors"
              >
                {"x"}
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange([...items, ''])}
            className="text-[15px] text-green hover:text-green-dim transition-colors mt-0.5"
          >
            {t("+ Add item")}
          </button>
        </div>
      )
    }

    case 'array-items': {
      const items = (Array.isArray(value) ? value : []) as Array<Record<string, unknown>>

      // Infer new item shape from existing items, or use sensible defaults per field key
      function createEmptyItem(): Record<string, unknown> {
        if (items.length > 0) {
          const template: Record<string, unknown> = {}
          for (const key of Object.keys(items[0])) template[key] = Array.isArray(items[0][key]) ? [] : ''
          return template
        }
        // Fallback templates by block type + field key
        const blockTemplates: Partial<Record<string, Record<string, Record<string, unknown>>>> = {
          testimonials: { items: { name: '', role: '', quote: '' } },
          stats: { items: { value: '', label: '' } },
          faq: { items: { question: '', answer: '' } },
          team: { members: { name: '', role: '' } },
          features: { items: { title: '', description: '' } },
          image: { images: { src: '', alt: '' } },
          gallery: { images: { src: '', alt: '', caption: '' } },
          footer: { columns: { title: '', links: [], linkUrls: [] } },
        }
        return blockTemplates[block.type]?.[field.key] || { title: '', description: '' }
      }

      return (
        <div className="mb-2.5">
          <label className="block text-[15px] text-text-2 mb-1 font-medium">{t(field.label)}</label>
          {items.map((item, i) => (
            <div key={i} className="bg-bg-2 border border-border-default rounded p-2 mb-1.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[15px] text-text-3 font-medium">{t("Item")} {i + 1}</span>
                <button
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                  className="text-[15px] text-text-3 hover:text-status-red transition-colors"
                >
                  {t("Remove")}
                </button>
              </div>
              {Object.entries(item).map(([key, val]) => (
                <div key={key} className="mb-1">
                  <label className="block text-[15px] text-text-3 mb-0.5">{t(key)}</label>
                  {Array.isArray(val) ? <textarea
                    value={val.map(String).join('\n')}
                    rows={3}
                    aria-label={t(key)}
                    onChange={e => { const updated = [...items]; updated[i] = { ...updated[i], [key]: e.target.value.split('\n') }; onChange(updated) }}
                    className="w-full px-1.5 py-1 rounded border border-border-subtle bg-bg-3 text-text-0 text-[15px]"
                  /> :                   <input
                    type="text"
                    value={String(val)}
                    onChange={(e) => {
                      const updated = [...items]
                      updated[i] = { ...updated[i], [key]: e.target.value }
                      onChange(updated)
                    }}
                    className="w-full px-1.5 py-1 rounded border border-border-subtle bg-bg-3 text-text-0 text-[15px] outline-none focus:border-green"
                  />}
                </div>
              ))}
            </div>
          ))}
          <button
            onClick={() => onChange([...items, createEmptyItem()])}
            className="text-[15px] text-green hover:text-green-dim transition-colors"
          >
            {t("+ Add item")}
          </button>
        </div>
      )
    }

    default:
      return null
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-border-subtle">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3.5 py-2.5 flex items-center gap-1 text-[15px] font-semibold uppercase tracking-wider text-text-3 hover:text-text-2 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {t(title)}
      </button>
      {open && <div className="px-3.5 pb-3">{children}</div>}
    </div>
  )
}

export function PropertiesPanel({ block }: { block: BlockConfig }) {
  const [showJson, setShowJson] = useState(false)
  const baseSchema = blockFields[block.type]
  const meta = blockMetadata.find(item => item.type === block.type)
  const sections = baseSchema?.sections.map(section => ({ ...section, fields: section.fields.map(field => field.key === 'variant' && meta ? { ...field, options: meta.variants } : field) })) || []
  if (meta && !sections.some(section => section.fields.some(field => field.key === 'variant'))) {
    sections.push({ title: t('Style'), fields: [{ key: 'variant', label: t('Variant'), type: 'select', options: meta.variants }] })
  }
  const schema = { sections }

  return (
    <>
      {/* Header */}
      <div className="px-3.5 py-3 border-b border-border-default flex items-center justify-between">
        <span className="text-[15px] font-semibold uppercase tracking-wider text-text-2">
          {t("Properties")}
        </span>
        <span className="text-[15px] px-2 py-0.5 rounded-full bg-green-glow text-green font-semibold">
          {t(block.type)}
        </span>
      </div>

      {/* Property sections */}
      {(block.type==='contact' || block.type==='newsletter') && <p className="p-3.5 text-[13px] text-text-2">La privacy è obbligatoria e non preselezionata. Imposta il link all’informativa e un recapito valido per rendere il modulo utilizzabile. Nell’editor gli invii sono solo un’anteprima.</p>}
      {schema?.sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.fields.map((field) => (
            <PropertyField key={field.key} field={field} block={block} />
          ))}
        </Section>
      )) || (
        <div className="p-3.5 text-[15px] text-text-3">
          {t("No editable properties defined for this block type.")}
        </div>
      )}

      {/* View JSON toggle */}
      <div className="border-t border-border-subtle">
        <button
          onClick={() => setShowJson(!showJson)}
          className="w-full px-3.5 py-2 flex items-center gap-1.5 text-[15px] text-text-3 hover:text-text-2 transition-colors"
        >
          <Code size={11} />
          {showJson ? t('Hide') : t('View')} {t("Block JSON")}
        </button>
        {showJson && (
          <pre className="px-3.5 pb-3 text-[15px] font-mono text-text-2 leading-relaxed overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify({ id: block.id, type: block.type, variant: block.variant, props: block.props }, null, 2)}
          </pre>
        )}
      </div>
    </>
  )
}
