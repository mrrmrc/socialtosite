import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import { AdminControlRoom } from '../components/AdminControlRoom';
import { AdminProviderCard } from '../components/AdminProviderCard';
import { AdminOperations } from '../components/AdminOperations';
import { AdminPlatformOverview } from '../components/AdminPlatformOverview';
import { LiaAdminGuide } from '../components/LiaTaskPanel';

const PANEL_STYLE = { padding: '14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' };

function ProviderRateCard({ provider, busy, onSave }) {
  const [unitCost, setUnitCost] = useState(provider.unit_cost || '');
  const [monthlyCredit, setMonthlyCredit] = useState(provider.monthly_credit || '');
  useEffect(() => { setUnitCost(provider.unit_cost || ''); setMonthlyCredit(provider.monthly_credit || ''); }, [provider.unit_cost, provider.monthly_credit]);
  return <article><div><strong>{provider.label || provider.provider}</strong><span>{provider.provider === 'gemini' ? 'Costo per milione di token' : 'Costo medio per esecuzione'}</span></div><label><span>Tariffa €</span><input type="number" min="0" step="0.000001" value={unitCost} onChange={e=>setUnitCost(e.target.value)} /></label><label><span>Budget mensile €</span><input type="number" min="0" step="0.01" value={monthlyCredit} onChange={e=>setMonthlyCredit(e.target.value)} /></label><button className="btn btn-outline" disabled={busy} onClick={()=>onSave(provider.provider,unitCost,monthlyCredit)}>{busy?'Salvo…':'Salva tariffa'}</button></article>;
}

function UserEconomicsRow({ user, busy, onSave, formatCost }) {
  const [revenue,setRevenue]=useState(user.monthly_revenue||''); const [hosting,setHosting]=useState(user.hosting_cost||''); const [other,setOther]=useState(user.other_cost||'');
  const ai=Number(user.estimated_cost||0), margin=Number(revenue||0)-Number(hosting||0)-Number(other||0)-ai;
  return <tr><td><strong>{user.name||user.email}</strong><small>{user.email} · {user.plan||'—'}</small></td><td>{user.total_requests}<small>{Number(user.total_tokens||0).toLocaleString('it-IT')} token</small></td><td>{user.published_posts}</td><td>{formatCost(ai)}</td><td><input type="number" min="0" step="0.01" value={revenue} onChange={e=>setRevenue(e.target.value)}/></td><td><input type="number" min="0" step="0.01" value={hosting} onChange={e=>setHosting(e.target.value)}/></td><td><input type="number" min="0" step="0.01" value={other} onChange={e=>setOther(e.target.value)}/></td><td><strong style={{color:margin>=0?'var(--teal)':'var(--red)'}}>{formatCost(margin)}</strong></td><td><button className="btn btn-outline" disabled={busy} onClick={()=>onSave(user.user_id,revenue,hosting,other)}>{busy?'…':'Salva'}</button></td></tr>;
}

export function AdminScreen({ token, currentUser, adminPrompts, updatePrompt }) {
  const [adminTab, setAdminTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [usersDiagnostics, setUsersDiagnostics] = useState([]);
  const [usersCountsAvailable, setUsersCountsAvailable] = useState(true);
  const [contentScopeId, setContentScopeId] = useState('');
  const usersRequest = useRef(0);
  const [logs, setLogs] = useState([]);
  const [selectedControlUserId, setSelectedControlUserId] = useState('');
  const [editorialRoom, setEditorialRoom] = useState(null);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState('');
  const roomRequest = useRef(0);
  const selectedRoomId = useRef(selectedControlUserId);
  selectedRoomId.current = selectedControlUserId;
  const [form, setForm] = useState({ name: '', email: '', password: '', profile: 'base' });
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [contentMix, setContentMix] = useState(null);
  const [contentSearch, setContentSearch] = useState('');
  const [monitoringData, setMonitoringData] = useState(null);
  const [adminActionBusy, setAdminActionBusy] = useState('');
  const [promptHistory, setPromptHistory] = useState({});
  const [agentDrafts, setAgentDrafts] = useState({});
  const [restoredPrompts, setRestoredPrompts] = useState({});
  const [settings, setSettings] = useState({ cron_interval_sync: '6', cron_interval_seo: '24' });
  const [logFilterLevel, setLogFilterLevel] = useState('');
  const [logFilterCtx, setLogFilterCtx] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userProfile, setUserProfile] = useState('');
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringUpdated, setMonitoringUpdated] = useState(null);
  const monitoringRequest = useRef(0);
  const controlUsers = users.filter(user => user.role !== 'admin');

  useEffect(() => {
    setError('');
    setNotice('');
    if (['overview', 'users', 'control-room', 'content-manager', 'processes'].includes(adminTab)) loadUsers();
    if (adminTab === 'logs') loadLogs();
    if (adminTab === 'content-mix') loadContentMix();
    if (['overview', 'agents', 'economics', 'monitoring', 'monitor-live'].includes(adminTab)) {
      loadMonitoring();
      loadSettings();
    }
  }, [adminTab]);

  async function loadMonitoring() {
    const requestId = ++monitoringRequest.current;
    setMonitoringLoading(true);
    try {
      const data = await apiFetch('/api/index.php?action=admin-monitoring', {}, token);
      if (requestId !== monitoringRequest.current) return;
      setMonitoringData(data);
      setMonitoringUpdated(new Date());
      setError('');
    } catch (e) {
      if (requestId === monitoringRequest.current) setError(e.message);
    } finally {
      if (requestId === monitoringRequest.current) setMonitoringLoading(false);
    }
  }

  useEffect(() => {
    if (adminTab !== 'control-room') return;
    if (!controlUsers.length) {
      setSelectedControlUserId('');
      setEditorialRoom(null);
      return;
    }
    if (!controlUsers.some(user => String(user.id) === String(selectedControlUserId))) {
      setSelectedControlUserId(String(controlUsers[0].id));
      setEditorialRoom(null);
      return;
    }
    loadEditorialRoom(selectedControlUserId);
  }, [adminTab, users, selectedControlUserId]);

  async function loadLogs() {
    try {
      const data = await apiFetch('/api/index.php?action=logs', {}, token);
      setLogs(data.entries || []);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadSettings() {
    try {
      const data = await apiFetch('/api/index.php?action=admin-settings', {}, token);
      if (data.settings) setSettings({ cron_interval_sync: data.settings.cron_interval_sync ?? '6', cron_interval_seo: data.settings.cron_interval_seo ?? '24' });
    } catch (e) { setError(e.message); }
  }

  async function saveSettings() {
    setAdminActionBusy('settings'); setError(''); setNotice('');
    try {
      await apiFetch('/api/index.php?action=admin-settings', { method: 'POST', body: JSON.stringify({ settings }) }, token);
      setNotice('Impostazioni salvate con successo.');
    } catch (e) {
      setError(e.message);
    } finally { setAdminActionBusy(''); }
  }

  async function deleteLog(ts, msg) {
    if (!confirm('Eliminare questa riga di log?')) return;
    try {
      await apiFetch('/api/index.php?action=logs-delete-line', { method: 'POST', body: JSON.stringify({ ts, msg }) }, token);
      await loadLogs();
    } catch (e) {
      setError(e.message);
    }
  }

  async function clearLogs() {
    if (!confirm('Sei sicuro di voler svuotare i log di sistema?')) return;
    try {
      await apiFetch('/api/index.php?action=logs-clear', { method: 'POST' }, token);
      await loadLogs();
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadContentMix() {
    try {
      setContentMix(await apiFetch('/api/index.php?action=admin-content-mix', {}, token));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadUsers() {
    const requestId = ++usersRequest.current;
    setUsersLoading(true);
    setUsersError('');
    try {
      const data = await apiFetch('/api/index.php?action=admin-users', {}, token);
      if (requestId !== usersRequest.current) return;
      setUsers(data.users || []);
      setUsersDiagnostics(data.diagnostics || []);
      setUsersCountsAvailable(data.counts_available !== false);
      setUsersLoaded(true);
      setError('');
    } catch (e) {
      if (requestId === usersRequest.current) { setUsersError(e.message); setError(e.message); }
    } finally {
      if (requestId === usersRequest.current) setUsersLoading(false);
    }
  }

  async function loadEditorialRoom(userId) {
    if (!userId) return;
    if (String(userId) !== String(selectedRoomId.current)) return;
    const requestId = ++roomRequest.current;
    setRoomLoading(true);
    setRoomError('');
    setEditorialRoom(null);
    try {
      const data = await apiFetch(`/api/index.php?action=admin-editorial-room&user_id=${userId}`, {}, token);
      if (requestId !== roomRequest.current || String(userId) !== String(selectedRoomId.current)) return;
      setEditorialRoom(data || null);
    } catch (e) {
      if (requestId === roomRequest.current && String(userId) === String(selectedRoomId.current)) setRoomError(e.message);
    } finally {
      if (requestId === roomRequest.current && String(userId) === String(selectedRoomId.current)) setRoomLoading(false);
    }
  }

  useEffect(() => {
    setAgentDrafts(current => {
      const next = { ...current };
      for (const prompt of adminPrompts) {
        if (next[prompt.agent_name] === undefined) next[prompt.agent_name] = prompt.instructions || '';
      }
      return next;
    });
  }, [adminPrompts]);

  async function saveAgentPrompt(agent) {
    const instructions = String(agentDrafts[agent.agent_name] || '').trim();
    if (!instructions) {
      setError('Inserisci le istruzioni prima di salvare.');
      return;
    }
    setAdminActionBusy(`prompt-${agent.agent_name}`);
    setError('');
    setNotice('');
    try {
      await updatePrompt(agent.agent_name, instructions);
      setRestoredPrompts(current => ({ ...current, [agent.agent_name]: instructions }));
      setNotice(`Istruzioni di ${agent.label} salvate.`);
      if (promptHistory[agent.agent_name]) await loadPromptHistory(agent.agent_name);
      await loadMonitoring();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdminActionBusy('');
    }
  }

  async function runEditorialForSelectedUser() {
    if (!selectedControlUserId) return;
    const targetId = selectedControlUserId;
    setAdminActionBusy('editorial-run'); setError(''); setNotice('');
    try {
      const data = await apiFetch('/api/index.php?action=admin-editorial-engine-run', { method:'POST', body:JSON.stringify({ user_id:Number(selectedControlUserId) }) }, token);
      if (String(targetId) === String(selectedRoomId.current)) {
        setNotice(data?.result?.reason || 'Analisi editoriale completata per il cliente selezionato.');
        await loadEditorialRoom(targetId);
      }
    } catch (e) { setError(e.message); } finally { setAdminActionBusy(''); }
  }

  async function saveProviderRate(provider, unitCost, monthlyCredit) {
    setAdminActionBusy(`provider-${provider}`); setError('');
    try {
      await apiFetch('/api/index.php?action=admin-provider-rates', { method:'POST', body:JSON.stringify({ provider, unit_cost:Number(unitCost||0), monthly_credit:monthlyCredit }) }, token);
      setNotice(`Tariffario ${provider} aggiornato.`); await loadMonitoring();
    } catch (e) { setError(e.message); } finally { setAdminActionBusy(''); }
  }
  async function saveUserEconomics(userId, monthlyRevenue, hostingCost, otherCost) {
    setAdminActionBusy(`economics-${userId}`); setError('');
    try { await apiFetch('/api/index.php?action=admin-user-economics',{method:'POST',body:JSON.stringify({user_id:userId,monthly_revenue:Number(monthlyRevenue||0),hosting_cost:Number(hostingCost||0),other_cost:Number(otherCost||0)})},token); setNotice('Economia cliente aggiornata.'); await loadMonitoring(); } catch(e){setError(e.message);} finally{setAdminActionBusy('');}
  }

  async function loadPromptHistory(agentName) {
    try { const data=await apiFetch(`/api/index.php?action=admin-prompt-history&agent_name=${encodeURIComponent(agentName)}`,{},token); setPromptHistory(current=>({...current,[agentName]:data.versions||[]})); } catch(e){setError(e.message);}
  }
  async function saveProviderConnection(payload) {
    setAdminActionBusy(`connection-${payload.provider}`); setError(''); setNotice('');
    try {
      await apiFetch('/api/index.php?action=admin-provider-save', { method: 'POST', body: JSON.stringify(payload) }, token);
      setNotice('Collegamento al provider aggiornato.');
      await loadMonitoring();
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setAdminActionBusy(''); }
  }
  async function restorePromptVersion(agentName, versionId) {
    if(!confirm('Ripristinare questa versione del prompt? La versione corrente resterà nello storico.')) return;
    setAdminActionBusy(`prompt-${agentName}`); setError(''); setNotice('');
    try {
      const data = await apiFetch('/api/index.php?action=admin-prompt-restore',{method:'POST',body:JSON.stringify({version_id:versionId})},token);
      setAgentDrafts(current => ({ ...current, [agentName]: data.instructions }));
      setRestoredPrompts(current => ({ ...current, [agentName]: data.instructions }));
      setNotice('Versione ripristinata. Il testo attivo è aggiornato.');
      await loadPromptHistory(agentName); await loadMonitoring();
    } catch(e){setError(e.message);} finally { setAdminActionBusy(''); }
  }

  async function triggerCron(job) {
    setAdminActionBusy(`trigger-cron-${job}`);
    setError('');
    setNotice('');
    try {
      const res = await apiFetch('/api/index.php?action=admin-trigger-cron', {
        method: 'POST',
        body: JSON.stringify({ job })
      }, token);
      setNotice(res.message || 'Esecuzione avviata in background.');
      setTimeout(loadMonitoring, 2000); // refresh shortly to see 'started' log
    } catch (e) {
      setError(e.message);
    } finally {
      setAdminActionBusy('');
    }
  }

  async function togglePostNoindex(post) {
    if (!editorialRoom?.user?.id) return;
    const targetId = editorialRoom.user.id;
    setAdminActionBusy(`noindex-${post.id}`);
    setError('');
    setNotice('');
    const noindex = Number(post.noindex) === 1 ? 0 : 1;
    try {
      await apiFetch('/api/index.php?action=admin-post-noindex', {
        method: 'POST',
        body: JSON.stringify({ id: post.id, user_id: editorialRoom.user.id, noindex }),
      }, token);
      setEditorialRoom(current => current && Number(current.user?.id) === Number(targetId) ? {
        ...current,
        posts: (current.posts || []).map(item => item.id === post.id ? { ...item, noindex } : item),
      } : current);
      if (String(targetId) === String(selectedRoomId.current)) setNotice(noindex ? 'Noindex attivato sull’articolo.' : 'Articolo nuovamente indicizzabile.');
    } catch (e) {
      setError(e.message);
    } finally {
      setAdminActionBusy('');
    }
  }

  const createUser = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.profile === 'admin' ? 'admin' : 'user',
        plan: form.profile === 'admin' ? 'agency' : form.profile,
      };
      await apiFetch('/api/index.php?action=admin-create-user', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, token);
      setForm({ name: '', email: '', password: '', profile: 'base' });
      await loadUsers();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const updateUser = async (id, patch) => {
    setError('');
    setNotice('');
    try {
      await apiFetch('/api/index.php?action=admin-update-user', {
        method: 'POST',
        body: JSON.stringify({ id, ...patch }),
      }, token);
      await loadUsers();
      setNotice('Utente aggiornato.');
      if (adminTab === 'control-room' && String(id) === String(selectedControlUserId)) {
        await loadEditorialRoom(String(id));
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const updateProfile = (id, profile) => {
    if (profile === 'admin' && !confirm('Assegnare il ruolo amministratore? Questo account avrà accesso a tutti i clienti e alle configurazioni.')) return;
    const data = {
      role: profile === 'admin' ? 'admin' : 'user',
      plan: profile === 'admin' ? 'agency' : profile
    };
    updateUser(id, data);
  };

  async function resetUserPassword(id) {
    const newPassword = passwordDrafts[id] || '';
    setError('');
    setNotice('');
    if (newPassword.length < 8) {
      setError('La nuova password deve contenere almeno 8 caratteri.');
      return;
    }
    if (!confirm('Impostare questa nuova password per l\'utente selezionato?')) return;

    try {
      await apiFetch('/api/index.php?action=admin-password-reset', {
        method: 'POST',
        body: JSON.stringify({ id, new_password: newPassword }),
      }, token);
      setPasswordDrafts(current => ({ ...current, [id]: '' }));
      if (Number(id) === Number(currentUser.id)) { localStorage.removeItem('sts_token'); localStorage.removeItem('sts_user'); window.location.reload(); return; }
      setNotice('Password aggiornata. Le sessioni precedenti sono state revocate.');
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteUser(id) {
    const target = users.find(user => Number(user.id) === Number(id));
    if (!target || window.prompt(`Eliminazione definitiva di ${target.email} e di tutti i suoi contenuti. Scrivi l’email del cliente per confermare.`) !== target.email) return;
    setError('');
    try {
      await apiFetch('/api/index.php?action=admin-delete-user', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }, token);
      await loadUsers();
      if (String(selectedControlUserId) === String(id)) {
        setSelectedControlUserId('');
        setEditorialRoom(null);
      }
      if (String(contentScopeId) === String(id)) setContentScopeId('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function impersonateUser(id) {
    if (!confirm('Vuoi accedere come questo utente? Dovrai rieffettuare il login per tornare amministratore.')) return;
    setError('');
    try {
      const data = await apiFetch('/api/index.php?action=admin-impersonate', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }, token);

      localStorage.setItem('sts_token', data.token);
      localStorage.setItem('sts_user', JSON.stringify(data.user));
      window.location.reload();
    } catch (e) {
      setError(e.message);
    }
  }

  function openClient(id) {
    const target = users.find(user => String(user.id) === String(id));
    if (target?.role === 'admin') {
      setUserProfile('');
      setUserSearch(target.email || target.name || '');
      setAdminTab('users');
      return;
    }
    setSelectedControlUserId(id);
    setAdminTab('control-room');
  }

  function openClientContents(id, queue = false) {
    setContentScopeId(String(id));
    setAdminTab(queue ? 'processes' : 'content-manager');
  }

  function navigateAdminTab(id) {
    if (['content-manager', 'processes'].includes(id)) setContentScopeId('');
    setAdminTab(id);
  }

  async function revokeUserSessions(id) {
    if (!confirm('Revocare tutte le sessioni di questo account? Sarà necessario accedere nuovamente.')) return;
    setAdminActionBusy(`sessions-${id}`); setError(''); setNotice('');
    try {
      await apiFetch('/api/index.php?action=admin-revoke-sessions', { method: 'POST', body: JSON.stringify({ id }) }, token);
      setNotice('Sessioni revocate. L’utente dovrà accedere nuovamente.');
      if (Number(id) === Number(currentUser.id)) {
        localStorage.removeItem('sts_token'); localStorage.removeItem('sts_user'); window.location.reload();
      }
    } catch (e) { setError(e.message); }
    finally { setAdminActionBusy(''); }
  }

  async function saveClientConfiguration(id, patch, engine = false) {
    setAdminActionBusy(`client-settings-${id}`); setError(''); setNotice('');
    try {
      await apiFetch(`/api/index.php?action=${engine ? 'admin-editorial-engine-save' : 'admin-update-user'}`, { method: 'POST', body: JSON.stringify(engine ? { user_id: id, ...patch } : { id, ...patch }) }, token);
      setNotice('Configurazione del cliente salvata.');
      if (String(id) === String(selectedRoomId.current)) await loadEditorialRoom(String(id));
    } catch (e) { setError(e.message); }
    finally { setAdminActionBusy(''); }
  }

  const activePrompts = adminPrompts.map(prompt => restoredPrompts[prompt.agent_name] === undefined ? prompt : { ...prompt, instructions: restoredPrompts[prompt.agent_name] });
  const adminNavigation = [
    { group: 'Piattaforma', items: [['overview','Panoramica','▦'],['users','Clienti','◎'],['control-room','Control Room','⌘']] },
    { group: 'Produzione di tutti i clienti', items: [['content-manager','Gestione contenuti','▤'],['processes','Code e recupero','↻'],['content-mix','Analisi contenuti','◷']] },
    { group: 'Configurazione globale', items: [['agents','Agenti AI','✦'],['economics','Costi e consumi','€']] },
    { group: 'Sistema', items: [['monitoring','Cron e provider','◉'],['monitor-live','Monitor Live','⚡'],['logs','Log','≡']] },
  ];
  const activeSection = adminNavigation.flatMap(group => group.items).find(([id]) => id === adminTab);
  const selectedAccount = controlUsers.find(user => String(user.id) === String(selectedControlUserId));
  const monthUsage = monitoringData?.usage_this_month || {};
  const formatCost = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 4 });

  return (
    <div className={`admin-workspace${adminTab === 'control-room' ? ' admin-workspace-control' : ''}`}>
      <aside className="admin-navigation" aria-label="Navigazione amministrazione">
        <header><span>Amministrazione</span><strong>Controllo piattaforma</strong></header><p className="admin-nav-description">Clienti, produzione, accessi e configurazioni globali.</p>
        {adminNavigation.map(section => <section key={section.group}><small>{section.group}</small>{section.items.map(([id,label,icon]) => <button key={id} className={adminTab === id ? 'is-active' : ''} aria-current={adminTab === id ? 'page' : undefined} onClick={() => navigateAdminTab(id)}><i aria-hidden="true">{icon}</i><span>{label}</span></button>)}</section>)}
      </aside>
      <main className="admin-main">
      <header className="admin-commandbar"><div><div className="admin-scope"><span className="admin-scope-badge">AMMINISTRATORE</span><small>{adminTab === 'control-room' && selectedAccount ? 'Cliente: ' + (selectedAccount.name || selectedAccount.email) : 'Ambito piattaforma'}</small></div><h2>{activeSection?.[1] || 'Amministrazione'}</h2><small>{monitoringLoading ? 'Aggiornamento in corso…' : monitoringUpdated ? 'Dati piattaforma aggiornati alle ' + monitoringUpdated.toLocaleTimeString('it-IT') : 'Dati piattaforma non ancora aggiornati'}</small></div><select className="admin-global-search" aria-label="Vai al controllo cliente" value="" onChange={e => { if(e.target.value) openClient(e.target.value); }}><option value="">Vai al controllo cliente…</option>{controlUsers.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select></header>
      <LiaAdminGuide section={adminTab} onNavigate={navigateAdminTab} />
      {adminTab === 'content-manager' && <AdminOperations token={token} onClient={openClient} users={users} selectedUserId={contentScopeId} onUserSelect={setContentScopeId} />}
      {adminTab === 'processes' && <AdminOperations key="queue" token={token} queue onClient={openClient} users={users} selectedUserId={contentScopeId} onUserSelect={setContentScopeId} />}

      {error && <div role="alert" style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px' }}>{error}</div>}
      {notice && <div role="status" style={{ background: 'var(--teal-light)', color: '#0F6E56', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px', fontWeight: 700 }}>{notice}</div>}

      {adminTab === 'overview' && <AdminPlatformOverview monitoring={monitoringData} loading={monitoringLoading} users={users} usersLoaded={usersLoaded} usersLoading={usersLoading} usersError={usersError} usersDiagnostics={usersDiagnostics} usersCountsAvailable={usersCountsAvailable} onRefresh={() => { loadMonitoring(); loadUsers(); }} onNavigate={navigateAdminTab} onClient={openClient} onClientContent={openClientContents} />}

      {adminTab === 'monitor-live' && (
        <>
          <section className="admin-dashboard-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="admin-section-heading">
              <div>
                <span>Monitoraggio Sistema</span>
                <h3>Cron Job e Sincronizzazione</h3>
                <p>Verifica l'esecuzione dei processi in background o avviali manualmente.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline" onClick={() => triggerCron('seo')} disabled={adminActionBusy === 'trigger-cron-seo'}>{adminActionBusy === 'trigger-cron-seo' ? 'Avvio...' : 'Avvia Cron SEO'}</button>
                <button className="btn btn-primary" onClick={() => triggerCron('sync')} disabled={adminActionBusy === 'trigger-cron-sync'}>{adminActionBusy === 'trigger-cron-sync' ? 'Avvio...' : 'Avvia Cron Sync'}</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Ultimo avvio registrato</div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>
                  {monitoringData?.cron_logs?.[0] ? monitoringData.cron_logs[0].run_at : 'Nessun log recente'}
                </div>
              </div>
              <div style={{ flex: '1 1 200px', padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Stato ultima esecuzione</div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>
                  {monitoringData?.cron_logs?.[0] ? (
                    <span className={`badge ${monitoringData.cron_logs[0].status === 'success' ? 'badge-green' : monitoringData.cron_logs[0].status === 'started' ? 'badge-amber' : 'badge-red'}`}>
                      {monitoringData.cron_logs[0].status} ({monitoringData.cron_logs[0].job_name})
                    </span>
                  ) : 'Sconosciuto'}
                </div>
              </div>
            </div>
          </div>
        </section>
          <div className="card" style={{ padding: 0, overflow: 'visible' }}>
            <iframe scrolling="no" src={`${window.API_BASE || ''}/monitor.php`} style={{ width: '100%', height: '2200px', border: 'none' }} title="Monitor Live" />
          </div>
        </>
      )}

      {adminTab === 'agents' && <div className="card"><div className="admin-section-heading"><div><span>Registro unico modificabile</span><h3>Agenti AI editoriali e grafici</h3><p>Seleziona un agente, modifica le istruzioni e salvale esplicitamente.</p></div></div><div className="admin-agent-grid">{(monitoringData?.agents || []).map(agent=>{const prompt=adminPrompts.find(item=>item.agent_name===agent.agent_name);const draft=agentDrafts[agent.agent_name] ?? prompt?.instructions ?? '';return <article key={agent.agent_name} className={agent.agent_name==='site_ai'?'is-visual-agent':''}><header><span>{agent.agent_name==='site_ai'?'◈':'✦'}</span><b className={agent.prompt_configured?'is-ready':''}>{agent.prompt_configured?'Configurato':'Da personalizzare'}</b></header><h4>{agent.label}</h4><p>{agent.purpose}</p><dl><div><dt>Quando interviene</dt><dd>{agent.trigger}</dd></div><div><dt>Identificativo</dt><dd><code>{agent.agent_name}</code></dd></div></dl><details className="admin-agent-editor"><summary>Apri editor istruzioni</summary><textarea value={draft} placeholder="Inserisci il prompt di sistema per questo agente…" onChange={e=>setAgentDrafts(current=>({...current,[agent.agent_name]:e.target.value}))}/><div className="admin-agent-editor-actions"><button className="btn btn-primary" disabled={adminActionBusy===`prompt-${agent.agent_name}`} onClick={()=>saveAgentPrompt(agent)}>{adminActionBusy===`prompt-${agent.agent_name}`?'Salvataggio…':'Salva istruzioni'}</button><button className="btn btn-outline" disabled={Boolean(adminActionBusy)} onClick={()=>loadPromptHistory(agent.agent_name)}>Cronologia</button></div>{promptHistory[agent.agent_name] && <div className="admin-history" aria-label={`Cronologia ${agent.label}`}>{promptHistory[agent.agent_name].length === 0 ? <p>Nessuna versione archiviata.</p> : promptHistory[agent.agent_name].map(version => <article key={version.id}><strong>{version.created_at}</strong><pre>{version.instructions}</pre><button className="btn btn-outline" disabled={Boolean(adminActionBusy)} onClick={() => restorePromptVersion(agent.agent_name, version.id)}>Ripristina versione</button></article>)}</div>}</details></article>})}</div></div>}

      {adminTab === 'economics' && <div className="card">
        <div className="admin-section-heading"><div><span>Economia della piattaforma</span><h3>Costi, ricavi e margine per cliente</h3><p>Consumi AI del mese corrente, ricavi e costi mensili per cliente. I costi AI sono stime basate sui tariffari configurati.</p></div><button className="btn btn-outline" onClick={loadMonitoring}>Aggiorna</button></div>
        <div className="admin-kpi-grid"><article><strong>{Number(monthUsage.total_tokens||0).toLocaleString('it-IT')}</strong><span>Token questo mese</span></article><article><strong>{monthUsage.requests||0}</strong><span>Richieste questo mese</span></article><article><strong>{formatCost(monthUsage.estimated_cost)}</strong><span>Costo AI registrato</span></article><article><strong>{monitoringData?.usage_by_provider?.length||0}</strong><span>Provider utilizzati</span></article></div>
        <div className="admin-provider-rates">{(monitoringData?.provider_settings||[]).map(provider=><ProviderRateCard key={provider.provider} provider={provider} busy={adminActionBusy===`provider-${provider.provider}`} onSave={saveProviderRate}/>)}</div>
        <div className="admin-table-wrap"><table className="admin-data-table admin-economics-table"><thead><tr><th>Cliente</th><th>Consumi</th><th>Articoli</th><th>Costo AI</th><th>Ricavo/mese</th><th>Hosting</th><th>Altri costi</th><th>Margine</th><th></th></tr></thead><tbody>{(monitoringData?.api_usage_per_user||[]).map(u=><UserEconomicsRow key={u.user_id} user={u} busy={adminActionBusy===`economics-${u.user_id}`} onSave={saveUserEconomics} formatCost={formatCost}/>)}</tbody></table></div>
        {!monitoringData?.cost_tracking_ready&&<div className="admin-warning">Lo storico precedente non contiene costi AI. Dopo aver impostato il tariffario, ogni nuova chiamata valorizzerà automaticamente <code>estimated_cost</code>.</div>}
      </div>}

      {adminTab === 'monitoring' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Monitoraggio Sistema (API & Cron)</h3>
            <button className="btn btn-outline" onClick={loadMonitoring}>Aggiorna Dati</button>
          </div>

          {!monitoringData ? (
            <div style={{ color: 'var(--text-muted)' }}>Caricamento...</div>
          ) : (
            <div style={{ display: 'grid', gap: '2rem' }}>
              <div>
                <h4 style={{ marginBottom: '1rem' }}>Collegamenti ai provider</h4>
                <div className="admin-provider-connections">{(monitoringData.provider_settings || []).map(provider => <AdminProviderCard key={provider.provider} provider={provider} busy={Boolean(adminActionBusy)} onSave={saveProviderConnection} />)}</div>
              </div><div>
                <h4 style={{ marginBottom: '1rem' }}>Utilizzo Token AI nel mese corrente</h4>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <tr>
                        <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-strong)' }}>Utente</th>
                        <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-strong)' }}>Token Consumati</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(monitoringData.api_usage_per_user || []).length === 0 ? (
                        <tr><td colSpan="2" style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Nessun dato di utilizzo</td></tr>
                      ) : (
                        monitoringData.api_usage_per_user.map((u, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 14px' }}>{u.name || u.email || 'Sistema (Background)'}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>{u.total_tokens}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: '1rem' }}>Esecuzioni Cron Recenti</h4>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {(monitoringData.cron_logs || []).length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nessun cron eseguito di recente.</div>
                  ) : (
                    monitoringData.cron_logs.map(log => (
                      <div key={log.id} style={{ ...PANEL_STYLE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{log.job_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{log.details || 'Nessun dettaglio'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className={`badge ${log.status === 'success' ? 'badge-green' : 'badge-red'}`}>{log.status}</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{log.run_at}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: '1rem' }}>Impostazioni Intervalli Cron</h4>
                <div style={{ ...PANEL_STYLE, display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label className="label">Intervallo Sync (ore)</label>
                    <input type="number" min="1" max="168" step="1" value={settings.cron_interval_sync || ''} onChange={e => setSettings({...settings, cron_interval_sync: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label className="label">Intervallo SEO (ore)</label>
                    <input type="number" min="1" max="168" step="1" value={settings.cron_interval_seo || ''} onChange={e => setSettings({...settings, cron_interval_seo: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }} />
                  </div>
                  <button className="btn btn-primary" disabled={Boolean(adminActionBusy)} onClick={saveSettings}>Salva Impostazioni</button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {adminTab === 'content-mix' && (
        <div className="card">
          <h3 style={{ marginBottom: '.4rem' }}>Di cosa sono fatti i contenuti dei clienti</h3>
          <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, maxWidth: '68ch' }}>
            Il sistema tratta i video (trascrizione dell’audio), le immagini (descrizione e OCR del testo
            scritto sopra) e il solo testo in tre modi diversi. Sapere quale prevale dice su quale strada
            conviene investire.
          </p>

          {!contentMix && <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Caricamento…</div>}

          {contentMix && contentMix.totale_contenuti === 0 && (
            <div style={{ padding: '1.25rem', border: '1px dashed var(--border-strong)', borderRadius: '12px', color: 'var(--text-muted)' }}>
              Nessun contenuto importato finora: il dato comparirà dopo la prima sincronizzazione.
            </div>
          )}

          {contentMix && contentMix.totale_contenuti > 0 && (<>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <div><div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--primary)' }}>{contentMix.totale_contenuti}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>contenuti totali</div></div>
              <div><div style={{ fontSize: '30px', fontWeight: 800 }}>{contentMix.utenti_con_contenuti}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>clienti con contenuti</div></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem', marginBottom: '1.75rem' }}>
              {contentMix.per_tipo.map(riga => (
                <div key={riga.tipo}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.35rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '14px' }}>{riga.tipo}</strong>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {riga.totale} · {riga.percentuale}% · {riga.con_testo_estratto} con testo estratto
                    </span>
                  </div>
                  <div style={{ height: '10px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: `${riga.percentuale}%`, height: '100%', background: 'var(--primary)' }} />
                  </div>
                </div>
              ))}
            </div>

            <h4 style={{ margin: '0 0 .75rem', fontSize: '14px' }}>Per piattaforma</h4>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {contentMix.per_piattaforma.map(riga => (
                <span key={riga.piattaforma} style={{ padding: '6px 12px', borderRadius: '999px', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '12.5px', fontWeight: 700 }}>
                  {riga.piattaforma}: {riga.totale}
                </span>
              ))}
            </div>
            <div className="admin-section-heading" style={{marginTop:'1.75rem'}}><div><span>Archivio operativo</span><h3>Ultimi contenuti acquisiti</h3><p>Comprende pubblicati, bozze, lavorazioni ed errori.</p></div><input type="search" value={contentSearch} onChange={e=>setContentSearch(e.target.value)} placeholder="Cerca cliente, titolo, social…" style={{minWidth:'250px'}} /></div>
            <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>Contenuto</th><th>Cliente</th><th>Origine</th><th>Stato</th><th>SEO</th><th>Nota agente</th><th>Data</th></tr></thead><tbody>{(contentMix.contenuti_recenti||[]).filter(item=>{const q=contentSearch.trim().toLowerCase();return !q||[item.edited_title,item.generated_title,item.name,item.email,item.platform,item.processing_status].filter(Boolean).join(' ').toLowerCase().includes(q)}).map(item=>{const status=Number(item.published)===1?'Pubblicato':item.processing_status||'Bozza';return <tr key={item.id}><td><strong>#{item.id} {item.edited_title||item.generated_title||'Senza titolo'}</strong><small>{item.media_type||'senza media'}</small></td><td><strong>{item.name||item.email||'—'}</strong><small>{item.email}</small></td><td>{item.platform||'—'}</td><td><span className={`badge ${status==='Pubblicato'?'badge-green':status==='failed'?'badge-red':'badge-amber'}`}>{status}</span></td><td>{item.seo_score??'—'}</td><td title={item.agent_notes||''}>{String(item.agent_notes||'—').slice(0,90)}</td><td>{item.published_at||item.created_at||'—'}</td></tr>})}</tbody></table></div>
          </>)}
        </div>
      )}

      {adminTab === 'users' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Crea account cliente o amministratore</h3>
            <form onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Nome</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Password temporanea</label>
                <input type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Profilo</label>
                <select value={form.profile} onChange={e => setForm({ ...form, profile: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                  <option value="base">Base</option>
                  <option value="professional">Professional</option>
                  <option value="agency">Agency</option>
                  <option value="admin">Amministratore</option>
                </select>
              </div>
              <button className="btn btn-primary" disabled={loading} style={{ gridColumn: '1 / -1', justifyContent: 'center' }}>
                {loading ? 'Creazione...' : 'Crea utente'}
              </button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Account, piani e accessi</h3><p className="admin-nav-description">Gli account cliente producono contenuti; gli amministratori gestiscono tutta la piattaforma.</p>
            <div className="admin-client-filters"><input aria-label="Cerca clienti" type="search" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Nome, email o indirizzo del sito"/><select aria-label="Filtra profilo clienti" value={userProfile} onChange={e => setUserProfile(e.target.value)}><option value="">Tutti i profili</option><option value="base">Base</option><option value="professional">Professional</option><option value="agency">Agency</option><option value="admin">Amministratori</option></select></div>
            {usersLoading && <p role="status">Aggiornamento account…</p>}
            {!usersLoading && !users.length && <p>Nessun account disponibile.</p>}
            {users.filter(u => (!userProfile || (userProfile === 'admin' ? u.role === 'admin' : u.role !== 'admin' && u.plan === userProfile)) && [u.name,u.email,u.slug].some(value => String(value || '').toLowerCase().includes(userSearch.trim().toLowerCase()))).map(u => {
              const siteUrl = `${(window.API_BASE || '').replace(/\/$/, '')}/${encodeURIComponent(u.slug)}`;
              return (
                <div key={u.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="admin-user-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) minmax(140px, .8fr) minmax(140px, .7fr) auto', gap: '12px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.name || u.email}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email}</div>
                      {u.role !== 'admin' && <a href={siteUrl} target="_blank" rel="noopener" style={{ fontSize: '12px', color: 'var(--purple)', textDecoration: 'none' }}>{siteUrl}</a>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {u.role === 'admin' ? <strong>Accesso globale alla piattaforma</strong> : <><div>{u.posts_count ?? '—'} contenuti</div><div>{u.sources_count ?? '—'} fonti attive</div></>}
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <select aria-label={`Profilo di ${u.name || u.email}`} value={u.role === 'admin' ? 'admin' : (u.plan || 'base')} onChange={e => updateProfile(u.id, e.target.value)} style={{ padding: '7px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                        <option disabled={Number(u.id) === Number(currentUser.id)} value="base">Base</option>
                        <option disabled={Number(u.id) === Number(currentUser.id)} value="professional">Professional</option>
                        <option disabled={Number(u.id) === Number(currentUser.id)} value="agency">Agency</option>
                        <option value="admin">Amministratore</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {u.role !== 'admin' && <button className="btn btn-outline" onClick={() => openClient(String(u.id))}>Apri controllo cliente</button>}
                      <button className="btn btn-outline" disabled={Boolean(adminActionBusy)} onClick={() => revokeUserSessions(u.id)}>Revoca sessioni</button>
                      <button className="btn btn-outline" onClick={() => impersonateUser(u.id)} disabled={u.id === currentUser.id} style={{ color: 'var(--purple)', borderColor: 'var(--purple-light)', padding: '6px', fontSize: '12px' }}>
                        Accedi come
                      </button>
                      <button className="btn btn-outline" onClick={() => deleteUser(u.id)} disabled={u.id === currentUser.id} style={{ color: 'var(--red)', borderColor: 'var(--red-light)', padding: '6px', fontSize: '12px' }}>
                        Elimina
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 240px' }}>
                      <label className="label" htmlFor={`admin-password-${u.id}`}>Nuova password per {u.name || u.email}</label>
                      <input
                        id={`admin-password-${u.id}`}
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={72}
                        placeholder="Minimo 8 caratteri"
                        value={passwordDrafts[u.id] || ''}
                        onChange={e => setPasswordDrafts(current => ({ ...current, [u.id]: e.target.value }))}
                        style={{ width: '100%', padding: '9px 11px' }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => resetUserPassword(u.id)}
                      disabled={(passwordDrafts[u.id] || '').length < 8}
                      style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}
                    >
                      Imposta password
                    </button>
                  </div>

                  {u.sources && u.sources.length > 0 && (
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-strong)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>Fonti Social Collegate</div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {u.sources.map(s => (
                          <div key={s.url} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-muted)', width: '70px' }}>{s.platform}</span>
                            <a href={s.url} target="_blank" rel="noopener" style={{ color: 'var(--purple)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.url}</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {adminTab === 'control-room' && <AdminControlRoom
        users={controlUsers} selectedId={selectedControlUserId} onSelect={setSelectedControlUserId}
        room={editorialRoom} loading={roomLoading} loadError={roomError} prompts={activePrompts}
        currentUserId={currentUser.id} busy={adminActionBusy}
        onRefresh={() => loadEditorialRoom(selectedControlUserId)} onRun={runEditorialForSelectedUser}
        onImpersonate={impersonateUser} onNoindex={togglePostNoindex}
        onOpenAgents={() => setAdminTab('agents')} onOpenQueue={() => openClientContents(selectedControlUserId, true)} onOpenContents={() => openClientContents(selectedControlUserId)}
        onProfileSave={(id, patch) => saveClientConfiguration(id, patch)} onEngineSave={(id, patch) => saveClientConfiguration(id, patch, true)}
      />}
      {adminTab === 'prompts' && (
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Istruzioni Sistema Agenti AI</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Ogni agente ha il suo prompt di sistema. Modificalo per cambiare come l'AI genera i contenuti.
            Le variabili <code style={{ background: 'var(--gray-light)', padding: '1px 5px', borderRadius: '4px' }}>{'{profileSummary}'}</code>, <code style={{ background: 'var(--gray-light)', padding: '1px 5px', borderRadius: '4px' }}>{'{roleMission}'}</code> e simili vengono sostituite automaticamente con i dati del profilo.
          </p>
          {adminPrompts.map(p => (
            <div key={p.id} style={{ marginBottom: '1.75rem', paddingBottom: '1.75rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 700, fontSize: '13px', padding: '3px 12px', borderRadius: '20px' }}>
                  {p.label || p.agent_name}
                </span>
                {p.description && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.description}</span>}
              </div>
              <textarea
                key={`${p.id}-${p.instructions}`}
                defaultValue={p.instructions}
                onBlur={e => updatePrompt(p.agent_name, e.target.value)}
                style={{ width: '100%', minHeight: '180px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', lineHeight: 1.6 }}
              />
              <div className="prompt-version-bar"><span>{Number(p.version_count||0)} versioni archiviate</span><button className="btn btn-outline" onClick={()=>loadPromptHistory(p.agent_name)}>Cronologia</button></div>
              {!!promptHistory[p.agent_name]?.length&&<div className="prompt-history-list">{promptHistory[p.agent_name].map(version=><article key={version.id}><div><strong>{version.created_at}</strong><span>{String(version.instructions).slice(0,140)}…</span></div><button className="btn btn-outline" onClick={()=>restorePromptVersion(p.agent_name,version.id)}>Ripristina</button></article>)}</div>}
            </div>
          ))}
          {adminPrompts.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nessun agente trovato. Visita <code>/api/index.php?action=migrate</code> per inizializzare.</p>
          )}
        </div>
      )}

      {adminTab === 'logs' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Log di Sistema (Backend)</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline" onClick={loadLogs} style={{ padding: '6px 12px', fontSize: '13px' }}>Aggiorna</button>
              <button className="btn btn-outline" onClick={clearLogs} style={{ color: 'var(--red)', borderColor: 'var(--red-light)', padding: '6px 12px', fontSize: '13px' }}>Svuota Log</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select value={logFilterLevel} onChange={e => setLogFilterLevel(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <option value="">Tutti i livelli</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
            </select>
            <input type="text" placeholder="Filtra per contesto (es. sync, seo...)" value={logFilterCtx} onChange={e => setLogFilterCtx(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface)' }} />
            <input type="text" placeholder="Cerca nel messaggio..." value={logSearch} onChange={e => setLogSearch(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', flex: 1, minWidth: '200px', background: 'var(--surface)' }} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--gray-light)' }}>
                  <th style={{ padding: '8px' }}>Time</th>
                  <th style={{ padding: '8px' }}>Level</th>
                  <th style={{ padding: '8px' }}>Contesto</th>
                  <th style={{ padding: '8px' }}>Messaggio</th>
                  <th style={{ padding: '8px' }}>Dettagli</th>
                  <th style={{ padding: '8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {logs.filter(l => {
                  if (logFilterLevel && l.level !== logFilterLevel) return false;
                  if (logFilterCtx && (!l.ctx || !l.ctx.includes(logFilterCtx))) return false;
                  if (logSearch && (!l.msg || !l.msg.toLowerCase().includes(logSearch.toLowerCase()))) return false;
                  return true;
                }).map((l, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: l.level === 'error' ? 'var(--red-light)' : (l.level === 'warn' ? 'var(--amber-light)' : 'transparent') }}>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{l.time || l.ts}</td>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: l.level === 'error' ? 'var(--red)' : (l.level === 'warn' ? 'var(--amber)' : (l.level === 'debug' ? 'var(--text-faint)' : 'var(--teal)')) }}>{l.level?.toUpperCase()}</td>
                    <td style={{ padding: '8px' }}>{l.ctx}</td>
                    <td style={{ padding: '8px', fontWeight: 500 }}>{l.msg}</td>
                    <td style={{ padding: '8px', color: 'var(--text-muted)', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={JSON.stringify(l.data)}>
                      {l.data ? JSON.stringify(l.data).substring(0, 100) + (JSON.stringify(l.data).length > 100 ? '...' : '') : ''}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', background: 'transparent', color: 'var(--red)', border: '1px solid var(--red-light)' }} onClick={() => deleteLog(l.ts || l.time, l.msg)}>Elimina</button>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Nessun log trovato.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
