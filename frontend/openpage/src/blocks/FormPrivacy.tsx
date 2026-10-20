import { safeFormUrl } from '../lib/site-forms'

export function FormPrivacy({ id, text, url }: { id: string; text?: string; url?: string }) {
  const link = safeFormUrl(url)
  return <div className="text-left text-[13px] text-text-2 leading-relaxed">
    <label htmlFor={`${id}-privacy`} className="flex items-start gap-2">
      <input id={`${id}-privacy`} name="privacy_acknowledged" type="checkbox" value="yes" required className="mt-1 shrink-0" style={{ accentColor: 'var(--color-green)' }} />
      <span>{text || 'Ho letto l’informativa sulla privacy.'} {link && <a href={link} target="_blank" rel="noopener noreferrer" className="text-green underline">Leggi l’informativa privacy</a>}</span>
    </label>
  </div>
}
