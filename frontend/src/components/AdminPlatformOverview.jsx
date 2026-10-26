import React from 'react';
import './AdminWorkspace.css';

const dateLabel = value => {
  if (value === undefined) return 'Non disponibile';
  if (!value) return 'Mai sincronizzato';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
};

export function AdminPlatformOverview({ monitoring, loading, users, usersLoaded, usersLoading, usersError, usersDiagnostics = [], usersCountsAvailable = true, onRefresh, onNavigate, onClient, onClientContent }) {
  const clients = users.filter(user => user.role !== 'admin');
  const noSources = usersCountsAvailable ? clients.filter(user => user.sources_count != null && Number(user.sources_count) === 0) : [];
  const noPublications = usersCountsAvailable ? clients.filter(user => user.posts_count != null && Number(user.posts_count) === 0) : [];
  const providers = monitoring?.provider_settings || [];
  const providerIssues = providers.filter(provider => !Number(provider.enabled) || !provider.credential_configured);
  const latestJobs = Object.values((monitoring?.cron_logs || []).reduce((result, job) => { if (!result[job.job_name]) result[job.job_name] = job; return result; }, {}));
  const failedJobs = latestJobs.filter(job => ['error', 'failed'].includes(job.status));
  const usage = monitoring?.usage_this_month || {};
  const attentionClients = [...clients].sort((a, b) => Number(a.sources_count || 0) - Number(b.sources_count || 0) || Number(a.posts_count || 0) - Number(b.posts_count || 0)).slice(0, 8);
  const cost = Number(usage.estimated_cost || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  const issuesCount = providerIssues.length + failedJobs.length;
  const partialMonitoring = Boolean(monitoring?.diagnostics?.length);

  return <div className="admin-overview admin-platform-overview">
    <section className="admin-hero"><div><span>Amministrazione della piattaforma</span><h2>Controlla clienti, produzione e servizi.</h2><p>Ogni dato e comando in questa area riguarda la piattaforma o un cliente selezionato.</p></div><div className="ap-hero-actions"><button className="btn btn-outline" disabled={loading || usersLoading} onClick={onRefresh}>Aggiorna panoramica</button><button className="btn btn-primary" onClick={() => onNavigate('users')}>Gestisci account e accessi</button></div></section>
    {monitoring?.diagnostics?.length > 0 && <p role="alert" className="admin-warning">Dati parziali: {monitoring.diagnostics.join('; ')}. I valori mancanti non vengono considerati pari a zero.</p>}
    <section className="admin-kpi-grid" aria-label="Indicatori della piattaforma">
      {[[monitoring?.totals?.users ?? '—', 'Account registrati', 'users'], [monitoring?.totals?.published_posts ?? '—', 'Articoli pubblicati', 'content-manager'], [monitoring?.totals?.queued_posts ?? '—', 'Contenuti da elaborare', 'processes'], [monitoring ? providers.filter(provider => Number(provider.enabled) && provider.credential_configured).length : '—', 'Provider operativi', 'monitoring']].map(([value, label, tab]) => <button className="ap-kpi" key={tab} onClick={() => onNavigate(tab)}><strong>{value}</strong><span>{label}</span><small>Apri gestione →</small></button>)}
    </section>
    <section className="ap-system-status" aria-label="Stato dei servizi"><div><span className={`ap-status-dot ${!monitoring || partialMonitoring ? 'is-unknown' : issuesCount ? 'is-warning' : 'is-ready'}`} /><strong>{!monitoring ? 'Stato dei servizi in caricamento' : partialMonitoring ? 'Monitoraggio parziale: verifica i servizi' : issuesCount ? `${issuesCount} servizi richiedono attenzione` : providers.length ? 'Nessuna anomalia nei servizi monitorati' : 'Provider da verificare'}</strong></div><button className="btn btn-outline" onClick={() => onNavigate('monitoring')}>Configura servizi e automazioni</button></section>
    <section className="ap-priority-section"><div className="admin-section-heading"><div><span>Da risolvere</span><h3>Priorità operative</h3></div><button onClick={() => onNavigate('logs')}>Apri log di sistema →</button></div><div className="admin-priorities">
      {providerIssues.map(provider => <button className="admin-priority ap-priority-warning" key={provider.provider} onClick={() => onNavigate('monitoring')}><span>Servizio globale</span><strong>{provider.label}: {!Number(provider.enabled) ? 'disattivato' : 'credenziale mancante'}</strong><small>Verifica il collegamento che alimenta le elaborazioni dei clienti.</small><b>Apri provider →</b></button>)}
      {failedJobs.map(job => <button className="admin-priority ap-priority-warning" key={job.job_name} onClick={() => onNavigate('monitoring')}><span>Automazione globale</span><strong>{job.job_name}: ultima esecuzione fallita</strong><small>{dateLabel(job.run_at)}</small><b>Controlla esecuzione →</b></button>)}
      <button className="admin-priority" onClick={() => onNavigate('processes')}><span>Produzione</span><strong>Coda di tutti i clienti</strong><small>{monitoring?.totals?.queued_posts ?? '—'} contenuti da elaborare. Filtra errori e recupera le lavorazioni bloccate.</small><b>Gestisci coda →</b></button>
      <button className="admin-priority" onClick={() => onNavigate('users')}><span>Attivazione clienti</span><strong>{usersLoaded && usersCountsAvailable ? noSources.length : '—'} senza fonti · {usersLoaded && usersCountsAvailable ? noPublications.length : '—'} senza pubblicazioni</strong><small>{usersCountsAvailable ? 'Individua gli account che devono completare la configurazione.' : 'Conteggi parziali: consulta il cliente prima di intervenire.'}</small><b>Apri anagrafica →</b></button>
    </div></section>
    <section className="card ap-client-section"><div className="admin-section-heading"><div><span>Controllo per cliente</span><h3>Clienti da seguire</h3><p>{usersCountsAvailable ? 'Prima gli account con meno fonti e pubblicazioni.' : 'I conteggi non disponibili sono indicati con un trattino.'} Gli account amministratore sono esclusi.</p></div><button onClick={() => onNavigate('users')}>Tutti gli account →</button></div>
      {usersDiagnostics.length > 0 && <p role="alert" className="admin-warning">Anagrafica parziale: {usersDiagnostics.join('; ')}. I clienti restano selezionabili.</p>}
      {usersError ? <p role="alert" className="admin-warning">{usersError}</p> : !usersLoaded ? <p role="status">Caricamento clienti…</p> : !clients.length ? <div className="ap-empty"><strong>Nessun cliente registrato</strong><p>Crea un account cliente per avviare la configurazione del servizio.</p><button className="btn btn-primary" onClick={() => onNavigate('users')}>Gestisci account</button></div> : <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>Cliente</th><th>Piano</th><th>Fonti attive</th><th>Pubblicati</th><th>Ultima sincronizzazione</th><th>Intervento</th></tr></thead><tbody>{attentionClients.map(user => <tr key={user.id}><td><strong>{user.name || user.email}</strong><small>{user.email}</small></td><td>{user.plan || 'Base'}</td><td>{user.sources_count ?? '—'}</td><td>{user.posts_count ?? '—'}</td><td>{dateLabel(user.last_sync)}</td><td><div className="ap-row-actions"><button className="btn btn-outline" onClick={() => onClient(String(user.id))}>Controllo cliente</button><button className="btn btn-outline" onClick={() => onClientContent(String(user.id))}>Contenuti</button></div></td></tr>)}</tbody></table></div>}
    </section>
    <section className="ap-domain-grid" aria-label="Configurazioni globali"><button onClick={() => onNavigate('agents')}><span>Intelligenza artificiale</span><strong>Agenti e istruzioni condivise</strong><small>Modifica prompt, consulta lo storico e ripristina versioni.</small></button><button onClick={() => onNavigate('economics')}><span>Economia del servizio</span><strong>{monitoring ? cost : '—'} di costi AI nel mese</strong><small>Tariffe provider, ricavi, costi e margini per cliente.</small></button><button onClick={() => onNavigate('monitor-live')}><span>Infrastruttura</span><strong>Monitor tecnico della piattaforma</strong><small>Controlla salute del server e diagnostica operativa.</small></button></section>
  </div>;
}
