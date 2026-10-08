import React from 'react';
import { SOCIAL } from '../utils/api';
import './LinkedChannelCard.css';

export function LinkedChannelCard({ channel, isBasePlan, removeChannel, savePlatformSource }) {
  const platform = SOCIAL[channel.platform] || SOCIAL.website || {};
  const title = channel.label || platform.label || channel.platform;
  const automatic = Number(channel.auto_sync ?? 1) === 1;
  const save = (changes) => savePlatformSource(channel.rawPlatform, channel.url,
    changes.since_date ?? channel.since_date, changes.auto_publish ?? channel.auto_publish ?? 1,
    changes.max_posts !== undefined ? changes.max_posts : channel.max_posts,
    channel.topic_summary, changes.auto_sync ?? channel.auto_sync ?? 1);
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
    <small className="linked-channel-scope">Conteggi complessivi di {platform.label || channel.platform}.</small>
    {channel.last_scan_note && <details className={`linked-channel-log ${channel.content_count === 0 ? 'attention' : ''}`}>
      <summary><span>{channel.last_scan_note}</span></summary>
      <p>{channel.last_scan_note}</p>
      {channel.last_scan_at && <time>Ultima sincronizzazione: {new Date(String(channel.last_scan_at).replace(' ', 'T')).toLocaleString('it-IT')}</time>}
    </details>}
    <details className="linked-channel-settings">
      <summary>Impostazioni di acquisizione</summary>
      <div className="linked-channel-fields">
        <label>Importa dalla data<input type="date" defaultValue={channel.since_date || ''} onBlur={e => save({ since_date: e.target.value })} /></label>
        <label>Massimo di post<input type="number" min="1" max="500" placeholder="Automatico" defaultValue={channel.max_posts || ''} onBlur={e => save({ max_posts: e.target.value || null })} /></label>
        <label className="linked-channel-check"><input type="checkbox" defaultChecked={Number(channel.auto_publish ?? 1) === 1} onChange={e => save({ auto_publish: e.target.checked ? 1 : 0 })} />Pubblica automaticamente</label>
        <label className="linked-channel-check"><input type="checkbox" defaultChecked={automatic} onChange={e => save({ auto_sync: e.target.checked ? 1 : 0 })} />Aggiornamento automatico</label>
      </div>
    </details>
  </article>;
}
