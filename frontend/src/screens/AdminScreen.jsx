import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

export function AdminScreen({ token, currentUser, adminPrompts, updatePrompt }) {
  const [adminTab, setAdminTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [selectedControlUserId, setSelectedControlUserId] = useState('');
  const [editorialRoom, setEditorialRoom] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (adminTab === 'users' || adminTab === 'agents' || adminTab === 'control-room') loadUsers();
    if (adminTab === 'logs') loadLogs();
    if (adminTab === 'processes') loadProcesses();
  }, [adminTab]);

  useEffect(() => {
    if (adminTab !== 'control-room') return;
    if (!users.length) return;
    if (!selectedControlUserId) {
      setSelectedControlUserId(String(users[0].id));
      return;
    }
    loadEditorialRoom(selectedControlUserId);
  }, [adminTab, users, selectedControlUserId]);

  async function loadLogs() {
    try {
      const data = await apiFetch('/api/index.php?action=logs', {}, token);
      setLogs(data.entries || []);
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

  async function loadProcesses() {
    try {
      const data = await apiFetch('/api/index.php?action=admin-processes', {}, token);
      setProcesses(data.processes || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function killProcess(id) {
    if (!confirm('Eliminare questo processo in coda?')) return;
    try {
      await apiFetch('/api/index.php?action=admin-kill-process', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }, token);
      await loadProcesses();
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadUsers() {
    try {
      const data = await apiFetch('/api/index.php?action=admin-users', {}, token);
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadEditorialRoom(userId) {
    if (!userId) return;
    try {
      const data = await apiFetch(`/api/index.php?action=admin-editorial-room&user_id=${userId}`, {}, token);
      setEditorialRoom(data || null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/index.php?action=admin-create-user', {
        method: 'POST',
        body: JSON.stringify(form),
      }, token);
      setForm({ name: '', email: '', password: '', role: 'user' });
      await loadUsers();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function updateUser(id, patch) {
    setError('');
    try {
      await apiFetch('/api/index.php?action=admin-update-user', {
        method: 'POST',
        body: JSON.stringify({ id, ...patch }),
      }, token);
      await loadUsers();
      if (adminTab === 'control-room' && String(id) === String(selectedControlUserId)) {
        await loadEditorialRoom(String(id));
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteUser(id) {
    if (!confirm('Eliminare questo utente e tutti i suoi contenuti?')) return;
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

  function parseJsonSafe(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function prettyJson(value) {
    const parsed = parseJsonSafe(value);
    if (parsed) return JSON.stringify(parsed, null, 2);
    return value || '';
  }

  function renderJsonPanel(title, value, emptyLabel = 'Nessun dato disponibile.') {
    const content = prettyJson(value);
    return (
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>{title}</div>
        <textarea
          readOnly
          value={content || emptyLabel}
          style={{ width: '100%', minHeight: '220px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', lineHeight: 1.55, resize: 'vertical' }}
        />
      </div>
    );
  }

  const roomUser = editorialRoom?.user || {};

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className={`btn ${adminTab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('users')}>Gestione Utenti</button>
        <button className={`btn ${adminTab === 'agents' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('agents')}>Agenti Editoriali</button>
        <button className={`btn ${adminTab === 'control-room' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('control-room')}>Control Room</button>
        <button className={`btn ${adminTab === 'prompts' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('prompts')}>Istruzioni AI</button>
        <button className={`btn ${adminTab === 'processes' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('processes')}>Processi Attivi</button>
        <button className={`btn ${adminTab === 'logs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('logs')}>Log di Sistema</button>
      </div>

      {error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px' }}>{error}</div>}

      {adminTab === 'users' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Crea nuovo utente</h3>
            <form onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Ruolo</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                  <option value="user">Utente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button className="btn btn-primary" disabled={loading} style={{ gridColumn: '1 / -1', justifyContent: 'center' }}>
                {loading ? 'Creazione...' : 'Crea utente'}
              </button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Lista Utenti</h3>
            {users.map(u => {
              const siteUrl = `${(window.API_BASE || '').replace('3001', '3000')}/s/${u.slug}`;
              return (
                <div key={u.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .7fr auto', gap: '12px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.name || u.email}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email}</div>
                      <a href={siteUrl} target="_blank" rel="noopener" style={{ fontSize: '12px', color: 'var(--purple)', textDecoration: 'none' }}>{siteUrl}</a>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      <div>{u.posts_count} contenuti</div>
                      <div>{u.connections_count} app connesse</div>
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <select value={u.role || 'user'} onChange={e => updateUser(u.id, { role: e.target.value })} style={{ padding: '7px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                        <option value="user">Utente</option>
                        <option value="admin">Admin</option>
                      </select>
                      <input type="text" defaultValue={u.plan || 'free'} onBlur={e => updateUser(u.id, { plan: e.target.value })} style={{ padding: '7px', fontSize: '12px' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button className="btn btn-outline" onClick={() => impersonateUser(u.id)} disabled={u.id === currentUser.id} style={{ color: 'var(--purple)', borderColor: 'var(--purple-light)', padding: '6px', fontSize: '12px' }}>
                        Accedi come
                      </button>
                      <button className="btn btn-outline" onClick={() => deleteUser(u.id)} disabled={u.id === currentUser.id} style={{ color: 'var(--red)', borderColor: 'var(--red-light)', padding: '6px', fontSize: '12px' }}>
                        Elimina
                      </button>
                    </div>
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

      {adminTab === 'agents' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Agenti Editoriali degli Utenti</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Visualizza e modifica le direttive dell'agente assegnato ad ogni utente. L'agente usa questi dati per filtrare e armonizzare i post importati.
          </p>
          {users.map(u => (
            <div key={u.id} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>{u.name || u.email} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>({u.email})</span></div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <label className="label">Ruolo e Missione</label>
                  <textarea defaultValue={u.role_mission || ''} onBlur={e => updateUser(u.id, { role_mission: e.target.value })} style={{ width: '100%', minHeight: '60px', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }} />
                </div>
                <div>
                  <label className="label">Strategia dei Contenuti</label>
                  <textarea defaultValue={u.content_strategy || ''} onBlur={e => updateUser(u.id, { content_strategy: e.target.value })} style={{ width: '100%', minHeight: '60px', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {adminTab === 'control-room' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ marginBottom: '0.35rem' }}>Control Room Editoriale</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Vista amministratore: qui leggi agenti, prompt, direttive operative e tutto quello che la control room ha generato per il singolo utente.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={selectedControlUserId} onChange={e => setSelectedControlUserId(e.target.value)} style={{ minWidth: '260px', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
              <button className="btn btn-outline" onClick={() => loadEditorialRoom(selectedControlUserId)}>Aggiorna</button>
            </div>
          </div>

          {!editorialRoom ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Seleziona un utente per vedere la sua control room.</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Utente</div>
                  <div style={{ fontWeight: 700 }}>{roomUser.name || roomUser.email}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{roomUser.email}</div>
                </div>
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Agente scrittura</div>
                  <div style={{ fontWeight: 700 }}>{roomUser.harmonize_agent || 'content_editor'}</div>
                </div>
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Tipo profilo</div>
                  <div style={{ fontWeight: 700 }}>{roomUser.account_type || 'business'}</div>
                </div>
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Ultima run</div>
                  <div style={{ fontWeight: 700 }}>{roomUser.editorial_last_run || 'Mai'}</div>
                </div>
              </div>

              <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Agenti e direttive operative</div>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {adminPrompts.map(prompt => (
                    <div key={prompt.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1rem', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{prompt.label || prompt.agent_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{prompt.description || 'Direttiva operativa dell’agente.'}</div>
                        </div>
                        <div style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '999px', background: prompt.agent_name === roomUser.harmonize_agent ? 'var(--purple-light)' : 'var(--gray-light)', color: prompt.agent_name === roomUser.harmonize_agent ? 'var(--purple-dark)' : 'var(--text-muted)', fontWeight: 700 }}>
                          {prompt.agent_name === roomUser.harmonize_agent ? 'Attivo su questo utente' : prompt.agent_name}
                        </div>
                      </div>
                      <textarea
                        readOnly
                        value={prompt.instructions || ''}
                        style={{ width: '100%', minHeight: '180px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', lineHeight: 1.55, resize: 'vertical' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                {renderJsonPanel('Comprensione editoriale', roomUser.site_understanding)}
                {renderJsonPanel('Editorial DNA', roomUser.editorial_dna)}
                {renderJsonPanel('Editorial Memory', roomUser.editorial_memory)}
                {renderJsonPanel('Editorial State', roomUser.editorial_engine_state)}
                {renderJsonPanel('Impostazioni motore', roomUser.editorial_settings)}
                {renderJsonPanel('Site AI Data', roomUser.site_ai_data)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Sorgenti attive</div>
                  <textarea
                    readOnly
                    value={(editorialRoom.sources || []).map(source => `[${source.platform}] ${source.label || source.url}${source.topic_summary ? ` - ${source.topic_summary}` : ''}`).join('\n') || 'Nessuna sorgente attiva.'}
                    style={{ width: '100%', minHeight: '180px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', lineHeight: 1.55, resize: 'vertical' }}
                  />
                </div>
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Ultimi contenuti pubblicati</div>
                  <textarea
                    readOnly
                    value={(editorialRoom.posts || []).map(post => `#${post.id} ${post.edited_title || post.generated_title || 'Senza titolo'}${post.published_at ? ` | ${post.published_at}` : ''}`).join('\n') || 'Nessun contenuto pubblicato.'}
                    style={{ width: '100%', minHeight: '180px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', lineHeight: 1.55, resize: 'vertical' }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {adminTab === 'prompts' && (
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Istruzioni Sistema Agenti AI</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Ogni agente ha il suo prompt di sistema. Modificalo per cambiare come l'AI genera i contenuti.
            Le variabili <code style={{ background: 'var(--gray-light)', padding: '1px 5px', borderRadius: '4px' }}>{'{profileSummary}'}</code>, <code style={{ background: 'var(--gray-light)', padding: '1px 5px', borderRadius: '4px' }}>{'{roleMission}'}</code> e simili vengono sostituite automaticamente con i dati del profilo.
          </p>
          {adminPrompts.map(p => (
            <div key={p.id} style={{ marginBottom: '1.75rem', paddingBottom: '1.75rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ background: 'var(--purple-light)', color: 'var(--purple-dark)', fontWeight: 700, fontSize: '13px', padding: '3px 12px', borderRadius: '20px' }}>
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
            </div>
          ))}
          {adminPrompts.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nessun agente trovato. Visita <code>/api/index.php?action=migrate</code> per inizializzare.</p>
          )}
        </div>
      )}

      {adminTab === 'processes' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Processi in Coda (AI Pendente)</h3>
          {processes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nessun post in attesa di elaborazione AI.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--gray-light)' }}>
                  <th style={{ padding: '8px' }}>ID</th>
                  <th style={{ padding: '8px' }}>Utente</th>
                  <th style={{ padding: '8px' }}>Platform</th>
                  <th style={{ padding: '8px' }}>Link</th>
                  <th style={{ padding: '8px' }}>Azione</th>
                </tr>
              </thead>
              <tbody>
                {processes.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>#{p.id}</td>
                    <td style={{ padding: '8px' }}>{p.name || p.email}</td>
                    <td style={{ padding: '8px' }}>{p.platform}</td>
                    <td style={{ padding: '8px' }}><a href={p.source_url} target="_blank" rel="noopener">Link</a></td>
                    <td style={{ padding: '8px' }}>
                      <button className="btn btn-outline" onClick={() => killProcess(p.id)} style={{ color: 'var(--red)', borderColor: 'var(--red-light)', padding: '4px 8px', fontSize: '12px' }}>Stoppa / Elimina</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {adminTab === 'logs' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Log di Sistema (Backend)</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline" onClick={loadLogs} style={{ padding: '6px 12px', fontSize: '13px' }}>Aggiorna</button>
              <button className="btn btn-outline" onClick={clearLogs} style={{ color: 'var(--red)', borderColor: 'var(--red-light)', padding: '6px 12px', fontSize: '13px' }}>Svuota Log</button>
            </div>
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
                </tr>
              </thead>
              <tbody>
                {logs.map((l, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: l.level === 'error' ? 'var(--red-light)' : (l.level === 'warn' ? 'var(--amber-light)' : 'transparent') }}>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{l.time}</td>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: l.level === 'error' ? 'var(--red)' : (l.level === 'warn' ? 'var(--amber)' : (l.level === 'debug' ? 'var(--text-faint)' : 'var(--teal)')) }}>{l.level?.toUpperCase()}</td>
                    <td style={{ padding: '8px' }}>{l.ctx}</td>
                    <td style={{ padding: '8px', fontWeight: 500 }}>{l.msg}</td>
                    <td style={{ padding: '8px', color: 'var(--text-muted)', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={JSON.stringify(l.data)}>
                      {l.data ? JSON.stringify(l.data).substring(0, 100) + (JSON.stringify(l.data).length > 100 ? '...' : '') : ''}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Nessun log trovato.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
