import type { BlockConfig } from '../types'
import { Send } from 'lucide-react'
import { FormPrivacy } from '../FormPrivacy'
import { formDestination } from '../../lib/site-forms'

export function ContactBlock({ block }: { block: BlockConfig }) {
  const props = block.props
  const { privacyUrl, endpoint, recipient, ready } = formDestination(props, 'contact')
  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green placeholder:text-text-3 transition-colors'
  return <section className="px-6 @md:px-10 py-16 @md:py-20">
    <div className="max-w-lg mx-auto">
      <div className="reveal-fade-up reveal-d1 text-center mb-8">
        <h2 className="text-2xl @md:text-3xl font-bold tracking-tight mb-2">{String(props.title || 'Contattami')}</h2>
        {props.subtitle ? <p className="text-text-2 text-sm">{String(props.subtitle)}</p> : null}
      </div>
      <form action={endpoint || undefined} method="post" data-site-form="contact" data-recipient={recipient} data-form-ready={String(ready)} className="reveal-fade-up reveal-d2 space-y-4" onSubmit={event => {
        // The editor preview must never transmit data or claim delivery.
        event.preventDefault()
        const status = event.currentTarget.querySelector('[data-form-status]')
        if (status) status.textContent = 'Anteprima del modulo: nessun messaggio è stato inviato.'
      }}>
        <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
          <div><label htmlFor={`${block.id}-name`} className="block text-[11.5px] text-text-2 mb-1.5 font-medium">Nome</label><input id={`${block.id}-name`} name="name" type="text" required maxLength={120} autoComplete="name" placeholder="Il tuo nome" className={inputClass} /></div>
          <div><label htmlFor={`${block.id}-email`} className="block text-[11.5px] text-text-2 mb-1.5 font-medium">Email</label><input id={`${block.id}-email`} name="email" type="email" required maxLength={254} autoComplete="email" placeholder="nome@esempio.it" className={inputClass} /></div>
        </div>
        <div><label htmlFor={`${block.id}-message`} className="block text-[11.5px] text-text-2 mb-1.5 font-medium">Messaggio</label><textarea id={`${block.id}-message`} name="message" required maxLength={5000} rows={4} placeholder="Come posso aiutarti?" className={`${inputClass} resize-y`} /></div>
        <FormPrivacy id={block.id} text={typeof props.privacyText === 'string' ? props.privacyText : undefined} url={privacyUrl} />
        <p data-form-status role="status" className="text-[12px] text-text-2">{ready ? endpoint ? 'Il messaggio sarà inviato al servizio configurato.' : 'Si aprirà il tuo programma email: conferma lì l’invio del messaggio.' : 'Modulo non ancora disponibile: configura il recapito e il link all’informativa privacy.'}</p>
        <button type="submit" disabled={!ready} className="w-full py-3 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Send size={14} />{String(props.buttonText || 'Invia messaggio')}</button>
      </form>
    </div>
  </section>
}
