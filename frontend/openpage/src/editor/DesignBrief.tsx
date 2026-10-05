import { FilePenLine, Link2, Info } from 'lucide-react'
import { t } from '../lib/i18n'
import type { DesignBriefValue } from '../lib/design-brief'

export function DesignBrief({ value, onChange, disabled = false }: { value: DesignBriefValue; onChange: (value: DesignBriefValue) => void; disabled?: boolean }) {
  return <div className="grid gap-5 md:grid-cols-2">
    <label className="block font-semibold"><span className="flex items-center gap-2"><FilePenLine size={18} aria-hidden="true" />{t('Describe your ideal website')}</span>
      <textarea disabled={disabled} maxLength={3000} rows={5} value={value.description} onChange={e => onChange({ ...value, description: e.target.value })} placeholder={t('Example: a welcoming editorial site, large images, clear titles, warm colors and projects before articles.')} className="mt-2 w-full bg-bg-1 border border-border-default rounded-xl p-3 font-normal" />
    </label>
    <label className="block font-semibold"><span className="flex items-center gap-2"><Link2 size={18} aria-hidden="true" />{t('Inspiration links (optional)')}</span>
      <textarea disabled={disabled} rows={5} value={value.references} onChange={e => onChange({ ...value, references: e.target.value })} placeholder={'https://esempio.it\nhttps://altro-esempio.it'} className="mt-2 w-full bg-bg-1 border border-border-default rounded-xl p-3 font-normal" />
      <span className="mt-2 flex gap-2 text-sm font-normal text-text-2"><Info size={16} className="shrink-0" aria-hidden="true" />{t('Up to 3 public links, one per line. Describe what you like: colors, spacing, typography or navigation. References inspire the design; their content is not copied.')}</span>
    </label>
  </div>
}
