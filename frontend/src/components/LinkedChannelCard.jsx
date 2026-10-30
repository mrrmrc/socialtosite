import React, { useEffect, useState } from 'react';
import { SOCIAL } from '../utils/api';
import './LinkedChannelCard.css';

export function LinkedChannelCard({ channel, isBasePlan, removeChannel, savePlatformSource, onSync, syncing }) {
  const platform = SOCIAL[channel.platform] || SOCIAL.website || {};
  const title = channel.label || platform.label || channel.platform;
  const automatic = Number(channel.auto_sync ?? 1) === 1;
  const [rules,setRules]=useState({since_date:channel.since_date||'',max_posts:channel.max_posts||'',auto_publish:Number(channel.auto_publish??1)===1,auto_sync:automatic});
  const [saving,setSaving]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{setRules({since_date:channel.since_date||'',max_posts:channel.max_posts||'',auto_publish:Number(channel.auto_publish??1)===1,auto_sync:automatic})},[channel.since_date,channel.max_posts,channel.auto_publish,channel.auto_sync]);
  const change=updates=>{setRules(current=>({...current,...updates}));setNotice('')};
  async function save(event){event.preventDefault();if(saving)return;setSaving(true);setNotice('');try{const ok=await savePlatformSource(channel.rawPlatform,channel.url,rules.since_date||null,rules.auto_publish?1:0,rules.max_posts?Number(rules.max_posts):null,channel.topic_summary,rules.auto_sync?1:0,channel.label);setNotice(ok===false?'Le regole non sono state salvate.':'Regole salvate.')}catch(error){setNotice(error.message)}finally{setSaving(false)}}
  const date = channel.last_content_at ? new Date(String(channel.last_content_at).replace(' ', 'T')) : null;
  const url = /^https?:\/\//i.test(channel.url || '') ? channel.url : '';

  return <article className="linked-channel" data-platform={channel.platform}>
    <header className="linked-channel-header">
      <div className="linked-channel-icon"><img src={platform.icon} alt="" /></div>
      <div className="linked-channel-identity">
        <h3>{title}</h3>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" title={url}>{url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} ↗</a>}
      </div>
      <button type="button" className="linked-channel-remove" onClick={() => removeChannel(channel)} aria-label={`Rimuovi ${title}`} title="Rimuovi canale">×</button>
    </header>
    <div className={`linked-channel-status ${automatic ? 'automatic' : ''}`}><i />{automatic ? 'Aggiornamento automatico' : 'Aggiornamento manuale'}</div>
    <small className="linked-channel-scope">Archivio della piattaforma {platform.label || channel.platform}</small>
    <div className="linked-channel-numbers" aria-label="Contenuti della piattaforma">
      <div className="linked-channel-total"><strong>{channel.content_count}</strong><span>acquisiti</span></div>
      <div><strong>{channel.published_count}</strong><span>pubblicati</span></div>
      <div><strong>{channel.draft_count}</strong><span>in bozza</span></div>
    </div>
    <div className="linked-channel-activity">
      <span>Ultimo contenuto <b>{date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('it-IT') : 'Nessuno'}</b></span>
      {channel.processing_count > 0 && <span className="linked-channel-working">{channel.processing_count} {isBasePlan ? "in lavorazione con LIA" : 'in elaborazione'}</span>}
      {channel.failed_count > 0 && <span className="linked-channel-error">{channel.failed_count} {isBasePlan ? 'da correggere' : 'da riprovare'}</span>}
    </div>
    <button type="button" className="btn btn-primary" disabled={syncing} onClick={() => onSync(channel.sourceId)} aria-label={`Sincronizza ${title}`}>{syncing ? 'Importazione in corso…' : 'Importa nuovi contenuti'}</button>
    {channel.last_scan_note && <details className={`linked-channel-log ${channel.content_count === 0 ? 'attention' : ''}`}>
      <summary><span>Dettaglio dell’ultimo aggiornamento</span></summary>
      <p>{channel.last_scan_note}</p>
      {channel.last_scan_at && <time>Ultima sincronizzazione: {new Date(String(channel.last_scan_at).replace(' ', 'T')).toLocaleString('it-IT')}</time>}
    </details>}
    <details className="linked-channel-settings">
      <summary>Regole di questo canale</summary>
      <form className="linked-channel-fields" onSubmit={save}>
        <label>Importa dalla data<input type="date" value={rules.since_date} onChange={e => change({ since_date: e.target.value })} /></label>
        <label>Massimo di post<input type="number" min="1" max="500" placeholder="Automatico" value={rules.max_posts} onChange={e => change({ max_posts: e.target.value })} /></label>
        <label className="linked-channel-check"><input type="checkbox" checked={rules.auto_publish} onChange={e => change({ auto_publish: e.target.checked })} />Pubblica gli articoli pronti sul sito AllSocialToWeb</label>
        <label className="linked-channel-check"><input type="checkbox" checked={rules.auto_sync} onChange={e => change({ auto_sync: e.target.checked })} />Importa automaticamente da questa fonte</label>
        <button type="submit" className="btn btn-outline" disabled={saving}>{saving?'Salvataggio…':'Salva regole'}</button>{notice&&<p role="status">{notice}</p>}
      </form>
    </details>
  </article>;
}
