import {useState} from 'react'
import {exportSiteToHTML} from '../lib/export-html'
import type {SiteConfig} from '../blocks/types'
import {useConfigStore} from '../store/configStore'
import {authorizePresentation} from '../lib/site-versions'
import {t} from '../lib/i18n'
export function PresentationApproval({proposal,label,onApprove,onClose}:{proposal:SiteConfig;label:string;onApprove:()=>void;onClose:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  async function approve(){setBusy(true);setError('');try{await authorizePresentation(useConfigStore.getState().config,t('Before change')+' · '+label,onApprove)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  return <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="approval-title" className="bg-bg-1 border border-border-default rounded-xl p-5 w-full max-w-5xl max-h-[95vh] overflow-auto space-y-4"><h2 id="approval-title" className="text-2xl font-semibold">{t('Authorize this change')}</h2><p>{label}. {t('The previous version will be saved in your account. This changes the draft; publishing is a separate action.')}</p><iframe title={t('Layout preview')} srcDoc={exportSiteToHTML(proposal)} sandbox="allow-scripts" className="w-full h-[50vh] bg-white border rounded-xl"/>{error&&<p role="alert">{error}</p>}<div className="flex gap-3"><button disabled={busy} onClick={approve} className="bg-green rounded-lg px-4 py-3 font-semibold">{busy?t('Saving…'):t('Authorize and apply')}</button><button disabled={busy} onClick={onClose} className="border rounded-lg px-4 py-3">{t('Cancel')}</button></div></section></div>
}
