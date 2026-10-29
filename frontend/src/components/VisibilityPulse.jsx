import React from 'react';
import { InterfaceIcon as Icon } from './InterfaceIcon';

const metric = (value, known) => known && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value).toLocaleString('it-IT') : '—';
export function VisibilityPulse({ user, data, loading, error, onNavigate, onLia }) {
  const visibility = data?.visibility || {};
  const site = data?.site || {};
  const sources = data?.sources || [];
  const posts = data?.posts || [];
  const hasGoogle = Boolean(visibility.latest_search_date);
  const known = Boolean(data) && !loading;
  const published = posts.filter(post => Number(post.published) === 1).length;
  const profile = data?.reachability?.profile || {};
  const foundations = [
    { label: 'Identità descritta', done: Boolean(site.title && (site.bio || site.profile_summary)), target: 'profile' },
    { label: 'Fonti collegate', done: sources.length > 0, target: 'sources' },
    { label: 'Contenuti pubblicati', done: published > 0, target: 'site' },
    { label: 'Contatti disponibili', done: Boolean(profile.phone || profile.email || profile.whatsapp), target: 'profile' },
  ];
  return <section className="visibility-pulse" aria-labelledby="visibility-pulse-title">
    <div className="pulse-welcome"><div><span className="pulse-eyebrow"><Icon name="spark" size={16} /> IL TUO OSSERVATORIO DIGITALE</span><h1 id="visibility-pulse-title">Le tue idee.<br /><em>Più visibili.</em></h1><p>Ciao {user.name || 'e bentornato'}. Ecco da dove partiamo oggi.</p></div><div className="pulse-welcome-action"><span className="pulse-live-label"><span />{loading ? 'Aggiornamento in corso' : error ? 'Aggiornamento non riuscito' : 'Il punto sul tuo progetto'}</span><button type="button" onClick={() => onLia('Aiutami a scegliere la prossima azione per migliorare la mia visibilità, partendo dai dati disponibili e senza supporre risultati non misurati.')}><Icon name="spark" size={18} />Trova il prossimo passo<Icon name="arrow" size={17} /></button></div></div>
    <div className="pulse-grid">
      <section className="pulse-card pulse-seo" aria-label="SEO su Google"><header><span className="pulse-card-icon"><Icon name="search" size={21} /></span><div><h2>SEO su Google</h2><span>{hasGoogle ? `Ultimo dato: ${visibility.latest_search_date}` : 'In attesa di dati Google'}</span></div><button type="button" aria-label="Apri risultati SEO" onClick={() => onNavigate('seo')}><Icon name="arrow" size={19} /></button></header><div className="pulse-metrics"><div><strong>{metric(visibility.impressions, known && hasGoogle)}</strong><span>Impression · 30 giorni</span></div><div><strong>{metric(visibility.clicks, known && hasGoogle)}</strong><span>Clic da Google · 30 giorni</span></div></div><p>{hasGoogle ? 'Le impression mostrano le apparizioni nelle ricerche. I clic mostrano gli ingressi da Google.' : 'Quando saranno disponibili rilevazioni Google, vedrai qui impression e clic. L’assenza di dati non significa zero visite.'}</p></section>
      <section className="pulse-card pulse-geo" aria-label="Preparazione GEO"><header><span className="pulse-card-icon"><Icon name="orbit" size={22} /></span><div><h2>GEO · Ricerca con IA</h2><span>Basi informative del tuo progetto</span></div><button type="button" aria-label="Migliora le basi informative GEO" onClick={() => onNavigate('profile')}><Icon name="arrow" size={19} /></button></header><div className="pulse-foundations">{foundations.map(item => <button type="button" key={item.label} onClick={() => onNavigate(item.target)} className={known && item.done ? 'is-complete' : ''}><Icon name={known && item.done ? 'check' : 'arrow'} size={14} />{item.label}</button>)}</div><p>Queste informazioni aiutano a descrivere la tua attività. Le citazioni e la presenza nelle risposte IA non sono ancora misurate.</p></section>
      <section className="pulse-card pulse-content" aria-label="Contenuti del progetto"><header><span className="pulse-card-icon"><Icon name="layers" size={21} /></span><div><h2>Il tuo patrimonio</h2><span>Dal progetto alla pubblicazione</span></div></header><div className="pulse-content-total"><strong>{metric(published, known)}</strong><span>contenuti pubblicati</span></div><button className="pulse-content-link" type="button" onClick={() => onNavigate('site')}>{metric(posts.length - published, known)} bozze e lavorazioni<Icon name="arrow" size={17} /></button></section>
    </div>
    <nav className="pulse-shortcuts" aria-label="Strumenti del progetto">{[['profile', 'user', 'La tua attività', 'Identità e contatti'], ['sources', 'link', 'Canali collegati', 'Le fonti dei tuoi contenuti'], ['seo', 'chart', 'SEO e statistiche', 'Leggi i dati disponibili'], ['services', 'wallet', 'Piano e servizi', 'Le possibilità del tuo account']].map(([id, icon, title, detail]) => <button key={id} type="button" onClick={() => onNavigate(id)}><span><Icon name={icon} size={20} /></span><div><strong>{title}</strong><small>{detail}</small></div><Icon name="arrow" size={15} /></button>)}</nav>
  </section>;
}
