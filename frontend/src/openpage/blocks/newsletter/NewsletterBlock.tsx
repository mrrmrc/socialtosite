import type { BlockConfig } from '../types'
import { Mail } from 'lucide-react'
import { FormPrivacy } from '../FormPrivacy'
import { formDestination } from '../../lib/site-forms'

export function NewsletterBlock({ block }: { block: BlockConfig }) {
  const props = block.props
  const { privacyUrl, endpoint, ready } = formDestination(props, 'newsletter')
  return <section className="px-6 @md:px-10 py-12 @md:py-16">
    <div className="max-w-xl mx-auto text-center">
      <div className="reveal-scale reveal-d1 w-12 h-12 rounded-xl bg-green/10 border border-green/20 flex items-center justify-center text-green mx-auto mb-4"><Mail size={22} /></div>
      <h2 className="reveal-fade-up reveal-d2 text-xl @md:text-2xl font-bold tracking-tight mb-2">{String(props.title || 'Resta aggiornato')}</h2>
      <p className="reveal-fade-up reveal-d3 text-text-2 text-sm mb-6">{String(props.subtitle || 'Ricevi le prossime novità via email.')}</p>
      <form action={endpoint || undefined} method="post" data-site-form="newsletter" data-form-ready={String(ready)} className="reveal-fade-up reveal-d4 max-w-sm mx-auto space-y-3" onSubmit={event => {
        event.preventDefault()
        const status = event.currentTarget.querySelector('[data-form-status]')
        if (status) status.textContent = 'Anteprima del modulo: nessuna iscrizione è stata inviata.'
      }}>
        <label htmlFor={`${block.id}-email`} className="block text-left text-[13px]">Email</label>
        <input id={`${block.id}-email`} name="email" type="email" required maxLength={254} autoComplete="email" placeholder="nome@esempio.it" className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green" />
        <FormPrivacy id={block.id} text={typeof props.privacyText === 'string' ? props.privacyText : 'Desidero iscrivermi alla newsletter e ho letto l’informativa privacy.'} url={privacyUrl} />
        <p data-form-status role="status" className="text-[12px] text-text-2">{ready ? 'La richiesta sarà inviata al servizio newsletter configurato.' : 'Iscrizione non ancora disponibile: configura il servizio newsletter e il link all’informativa privacy.'}</p>
        <button type="submit" disabled={!ready} className="w-full px-5 py-2.5 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all disabled:opacity-50 disabled:cursor-not-allowed">{String(props.buttonText || 'Iscriviti')}</button>
      </form>
      {props.socialProof ? <p className="text-[11px] text-text-3 mt-3">{String(props.socialProof)}</p> : null}
    </div>
  </section>
}
