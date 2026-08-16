import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/api';
import { SITE_LAYOUTS } from '../utils/siteLayouts';

const PIPELINE_STEPS = [
  {
    id: 'sources',
    title: '1. Raccolta segnali',
    description: 'La control room legge sorgenti collegate, topic, frequenza e materiale pubblicato.',
  },
  {
    id: 'profile',
    title: '2. Costruzione profilo',
    description: 'L\'AI sintetizza posizionamento, missione, audience e tono partendo da input dichiarati e social reali.',
  },
  {
    id: 'assembly',
    title: '3. Regole di assemblaggio',
    description: 'Prompt, DNA editoriale, memoria e impostazioni decidono come trasformare i contenuti in articoli.',
  },
  {
    id: 'delivery',
    title: '4. Produzione finale',
    description: 'La pipeline pubblica contenuti coerenti con profilo, categorie, tag e priorita strategiche.',
  },
];

const PANEL_STYLE = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
  padding: '1rem',
};

const LAYOUT_LABELS = SITE_LAYOUTS.reduce((acc, layout) => {
  acc[layout.id] = {
    name: layout.name,
    emoji: layout.emoji,
    desc: layout.desc,
  };
  return acc;
}, {});

export function AdminScreen({ token, currentUser, adminPrompts, updatePrompt }) {
  const [adminTab, setAdminTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [selectedControlUserId, setSelectedControlUserId] = useState('');
  const [editorialRoom, setEditorialRoom] = useState(null);
  const [controlRoomFilter, setControlRoomFilter] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [contentMix, setContentMix] = useState(null);

  useEffect(() => {
    if (adminTab === 'users' || adminTab === 'control-room') loadUsers();
    if (adminTab === 'logs') loadLogs();
    if (adminTab === 'processes') loadProcesses();
    if (adminTab === 'content-mix') loadContentMix();
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

  async function loadContentMix() {
    try {
      setContentMix(await apiFetch('/api/index.php?action=admin-content-mix', {}, token));
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

  async function togglePostNoindex(post) {
    if (!editorialRoom?.user?.id) return;
    setError('');
    setNotice('');
    const noindex = Number(post.noindex) === 1 ? 0 : 1;
    try {
      await apiFetch('/api/index.php?action=admin-post-noindex', {
        method: 'POST',
        body: JSON.stringify({ id: post.id, user_id: editorialRoom.user.id, noindex }),
      }, token);
      setEditorialRoom(current => current ? {
        ...current,
        posts: (current.posts || []).map(item => item.id === post.id ? { ...item, noindex } : item),
      } : current);
      setNotice(noindex ? 'Noindex attivato sull’articolo.' : 'Articolo nuovamente indicizzabile.');
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
    setNotice('');
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
      setNotice('Password aggiornata. Comunica la nuova credenziale all\'utente in modo sicuro.');
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

  function compactValue(value, fallback = 'Non disponibile') {
    if (!value) return fallback;
    if (typeof value === 'string') return value.trim() || fallback;
    if (typeof value === 'number') return String(value);
    const parsed = parseJsonSafe(value);
    if (!parsed) return fallback;
    if (Array.isArray(parsed)) return parsed.join(', ') || fallback;
    return JSON.stringify(parsed, null, 2);
  }

  function extractHighlights(value, limit = 4) {
    if (!value) return [];
    const parsed = parseJsonSafe(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map(item => (typeof item === 'string' ? item : JSON.stringify(item)))
        .filter(Boolean)
        .slice(0, limit);
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed)
        .filter(([, entry]) => entry !== null && entry !== '')
        .slice(0, limit)
        .map(([key, entry]) => `${humanizeKey(key)}: ${typeof entry === 'string' ? entry : JSON.stringify(entry)}`);
    }
    return String(value)
      .split(/\n|\. /)
      .map(part => part.trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  function humanizeKey(value = '') {
    return value
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, char => char.toUpperCase());
  }

  function renderJsonPanel(title, value, emptyLabel = 'Nessun dato disponibile.') {
    const content = prettyJson(value);
    return (
      <div style={PANEL_STYLE}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>{title}</div>
        <textarea
          readOnly
          value={content || emptyLabel}
          style={{ width: '100%', minHeight: '220px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', lineHeight: 1.55, resize: 'vertical' }}
        />
      </div>
    );
  }

  function renderValueCard(title, value, tone = 'default') {
    const toneStyles = {
      default: { background: 'var(--gray-light)', color: 'var(--text)' },
      accent: { background: 'var(--primary-light)', color: 'var(--primary-dark)' },
      success: { background: 'var(--teal-light)', color: 'var(--teal)' },
      warn: { background: 'var(--amber-light)', color: 'var(--amber)' },
    };

    return (
      <div style={{ ...PANEL_STYLE, padding: '0.95rem' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{title}</div>
        <div style={{ fontSize: '15px', fontWeight: 700, whiteSpace: 'pre-wrap' }}>{value}</div>
        <div style={{ marginTop: '0.75rem', display: 'inline-flex', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, ...toneStyles[tone] }}>
          {title}
        </div>
      </div>
    );
  }

  const roomUser = editorialRoom?.user || {};
  const parsedUnderstanding = parseJsonSafe(roomUser.site_understanding) || {};
  const modelRouting = parsedUnderstanding.model_routing || {};
  const filteredUsers = useMemo(() => {
    const search = controlRoomFilter.trim().toLowerCase();
    if (!search) return users;
    return users.filter(user => {
      const haystack = [user.name, user.email, user.slug, user.plan]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [users, controlRoomFilter]);

  const activePrompt = useMemo(() => {
    if (!roomUser.harmonize_agent) return null;
    return adminPrompts.find(prompt => prompt.agent_name === roomUser.harmonize_agent) || null;
  }, [adminPrompts, roomUser.harmonize_agent]);

  const totalSources = users.reduce((sum, user) => sum + (user.sources?.length || 0), 0);
  const totalPosts = users.reduce((sum, user) => sum + Number(user.posts_count || 0), 0);
  const processByUser = useMemo(() => {
    const map = {};
    for (const process of processes) {
      const key = String(process.user_id || process.email || process.name || '');
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [processes]);

  const profileAssemblyRows = [
    {
      label: 'Profilo dichiarato / summary',
      value: compactValue(roomUser.profile_summary),
      helper: 'Base testuale con cui la control room inquadra il soggetto.',
    },
    {
      label: 'Ruolo e missione',
      value: compactValue(roomUser.role_mission),
      helper: 'Filtro strategico che decide angolo e posizionamento.',
    },
    {
      label: 'Strategia contenuti',
      value: compactValue(roomUser.content_strategy),
      helper: 'Guida la scelta dei temi e del formato dei contenuti.',
    },
    {
      label: 'Brand voice',
      value: compactValue(roomUser.brand_voice_profile),
      helper: 'Regole di tono, lessico, cluster e istruzioni stilistiche.',
    },
  ];

  const understandingHighlights = extractHighlights(roomUser.site_understanding, 5);
  const dnaHighlights = extractHighlights(roomUser.editorial_dna, 5);
  const memoryHighlights = extractHighlights(roomUser.editorial_memory, 5);
  const settingsHighlights = extractHighlights(roomUser.editorial_settings, 5);

  const promptVariables = [
    ['{profileSummary}', compactValue(roomUser.profile_summary)],
    ['{roleMission}', compactValue(roomUser.role_mission)],
    ['{contentStrategy}', compactValue(roomUser.content_strategy)],
    ['{brandVoiceProfile}', compactValue(roomUser.brand_voice_profile)],
  ];
  const recommendedModels = Array.isArray(modelRouting.recommended_base_models)
    ? modelRouting.recommended_base_models
    : (parsedUnderstanding.design_direction?.recommended_base_models || []);
  const modelReasonEntries = Object.entries(modelRouting.model_reasons || {}).filter(([, reasons]) => Array.isArray(reasons) && reasons.length);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className={`btn ${adminTab === 'control-room' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('control-room')}>Control Room</button>
        <button className={`btn ${adminTab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('users')}>Gestione Utenti</button>
        <button className={`btn ${adminTab === 'prompts' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('prompts')}>Istruzioni AI</button>
        <button className={`btn ${adminTab === 'processes' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('processes')}>Processi Attivi</button>
        <button className={`btn ${adminTab === 'content-mix' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('content-mix')}>Di cosa sono fatti i contenuti</button>
        <button className={`btn ${adminTab === 'logs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAdminTab('logs')}>Log di Sistema</button>
      </div>

      {error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px' }}>{error}</div>}
      {notice && <div style={{ background: 'var(--teal-light)', color: '#0F6E56', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px', fontWeight: 700 }}>{notice}</div>}

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
          </>)}
        </div>
      )}

      {adminTab === 'users' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Crea nuovo utente</h3>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) minmax(140px, .8fr) minmax(140px, .7fr) auto', gap: '12px', alignItems: 'center' }}>
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
                      <select value={u.plan || 'base'} onChange={e => updateUser(u.id, { plan: e.target.value })} style={{ padding: '7px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', fontSize: '12px' }}>
                        <option value="base">Base</option>
                        <option value="professional">Professional</option>
                        <option value="agency">Agency</option>
                      </select>
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

      {adminTab === 'control-room' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '999px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  AI Mail Control Room
                </div>
                <h3 style={{ marginBottom: '0.35rem', fontSize: '24px' }}>Vista chiara di come lavorano agenti, profili e contenuti</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6, maxWidth: '820px' }}>
                  Qui vedi prima la regia generale della macchina AI, poi per ogni utente la catena precisa con cui la control room
                  costruisce il profilo, sceglie le istruzioni attive e assembla i contenuti finali.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-outline" onClick={loadUsers}>Aggiorna utenti</button>
                <button className="btn btn-outline" onClick={loadProcesses}>Aggiorna processi</button>
                <button className="btn btn-primary" onClick={() => loadEditorialRoom(selectedControlUserId)} disabled={!selectedControlUserId}>Aggiorna utente selezionato</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.9rem', marginBottom: '1.25rem' }}>
              {renderValueCard('Utenti gestiti', `${users.length}`, 'accent')}
              {renderValueCard('Sorgenti attive', `${totalSources}`, 'success')}
              {renderValueCard('Prompt agenti', `${adminPrompts.length}`, 'warn')}
              {renderValueCard('Processi in coda', `${processes.length}`, processes.length ? 'warn' : 'success')}
              {renderValueCard('Contenuti totali', `${totalPosts}`, 'default')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
              {PIPELINE_STEPS.map(step => (
                <div key={step.id} style={{ ...PANEL_STYLE, minHeight: '132px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{step.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.55 }}>{step.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
            <div className="card" style={{ position: 'sticky', top: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>Utenti osservati</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>Seleziona un utente e la control room ti mostra come ragiona su di lui.</p>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{filteredUsers.length}/{users.length}</div>
              </div>

              <input
                type="text"
                placeholder="Cerca nome, email o slug"
                value={controlRoomFilter}
                onChange={e => setControlRoomFilter(e.target.value)}
                style={{ marginBottom: '1rem' }}
              />

              <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredUsers.map(user => {
                  const isActive = String(user.id) === String(selectedControlUserId);
                  const pending = processByUser[String(user.id)] || processByUser[user.email] || processByUser[user.name] || 0;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedControlUserId(String(user.id))}
                      style={{
                        textAlign: 'left',
                        padding: '1rem',
                        borderRadius: 'var(--radius)',
                        border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: isActive ? 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(255,255,255,0.02))' : 'var(--surface)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{user.name || user.email}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</div>
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: isActive ? 'var(--primary-dark)' : 'var(--text-muted)' }}>
                          {pending ? `${pending} run` : 'idle'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                        <span className="badge badge-purple">{user.sources?.length || 0} fonti</span>
                        <span className="badge badge-green">{user.posts_count || 0} contenuti</span>
                        <span className="badge badge-amber">{user.connections_count || 0} connessioni</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Piano: {user.plan || 'free'}<br />
                        Slug: {user.slug || 'n.d.'}
                      </div>
                    </button>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <div style={{ ...PANEL_STYLE, color: 'var(--text-muted)', fontSize: '13px' }}>
                    Nessun utente trovato con questo filtro.
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              {!editorialRoom ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Seleziona un utente per vedere la sua control room.</p>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        <span className="badge badge-purple">{roomUser.harmonize_agent || 'content_editor'}</span>
                        <span className="badge badge-green">{roomUser.account_type || 'business'}</span>
                        <span className="badge badge-amber">{roomUser.editorial_last_run || 'Mai eseguito'}</span>
                      </div>
                      <h3 style={{ marginBottom: '0.25rem', fontSize: '24px' }}>{roomUser.name || roomUser.email}</h3>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>{roomUser.email}</p>
                    </div>
                    <div style={{ display: 'grid', gap: '8px', minWidth: '240px' }}>
                      <select value={selectedControlUserId} onChange={e => setSelectedControlUserId(e.target.value)} style={{ minWidth: '240px' }}>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name || u.email}</option>
                        ))}
                      </select>
                      <button className="btn btn-outline" onClick={() => impersonateUser(roomUser.id)} disabled={roomUser.id === currentUser.id}>Accedi come questo utente</button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.9rem' }}>
                    {renderValueCard('Sito', roomUser.site_title || 'Titolo non ancora generato')}
                    {renderValueCard('Missione AI', compactValue(roomUser.role_mission), 'accent')}
                    {renderValueCard('Tono / voice', compactValue(roomUser.brand_voice_profile), 'success')}
                    {renderValueCard('Ultima memoria', memoryHighlights[0] || 'Nessuna memoria sintetica', 'warn')}
                  </div>

                  <div style={{ ...PANEL_STYLE, padding: '1.2rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '0.35rem' }}>Sintesi operativa</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, marginBottom: '1rem' }}>
                      Una vista veloce su cosa ha capito l&apos;AI, cosa sta usando per scrivere e quali contenuti ha già prodotto.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                      <div style={{ ...PANEL_STYLE }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Profilo usato</div>
                        <div style={{ fontSize: '13px', lineHeight: 1.6 }}>{compactValue(roomUser.profile_summary)}</div>
                      </div>
                      <div style={{ ...PANEL_STYLE }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Agente attivo</div>
                        <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                          <strong>{activePrompt?.label || roomUser.harmonize_agent || 'Non definito'}</strong>
                          <br />
                          <span style={{ color: 'var(--text-muted)' }}>{activePrompt?.description || 'Prompt che governa l’assemblaggio dei contenuti.'}</span>
                        </div>
                      </div>
                      <div style={{ ...PANEL_STYLE }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Segnali letti</div>
                        <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                          {(editorialRoom.sources || []).length} sorgenti attive
                          <br />
                          <span style={{ color: 'var(--text-muted)' }}>{understandingHighlights[0] || 'Comprensione strategica non ancora sintetizzata.'}</span>
                        </div>
                      </div>
                      <div style={{ ...PANEL_STYLE }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Output recente</div>
                        <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                          {(editorialRoom.posts || []).length} contenuti pubblicati
                          <br />
                          <span style={{ color: 'var(--text-muted)' }}>{editorialRoom.posts?.[0]?.edited_title || editorialRoom.posts?.[0]?.generated_title || 'Nessun contenuto recente'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...PANEL_STYLE, padding: '1.2rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '0.35rem' }}>Model Routing AI</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, marginBottom: '1rem' }}>
                      Il sistema sceglie i modelli in base al messaggio da comunicare, al tono, all&apos;obiettivo di conversione e alla presenza visiva richiesta.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                      {renderValueCard('Messaggio', modelRouting.message_type?.label || 'Da confermare', 'accent')}
                      {renderValueCard('Tono', modelRouting.tone_profile?.label || 'Da confermare', 'success')}
                      {renderValueCard('Obiettivo', modelRouting.conversion_goal?.label || 'Da confermare', 'warn')}
                      {renderValueCard('Intensità', modelRouting.visual_intensity?.label || 'Bilanciata', 'default')}
                      {renderValueCard('Densità', modelRouting.content_depth?.label || 'Bilanciata', 'default')}
                    </div>

                    <div style={{ ...PANEL_STYLE, marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Sintesi di routing</div>
                      <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                        {modelRouting.summary || 'Nessuna logica di routing salvata per questo utente.'}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                      <div style={{ ...PANEL_STYLE }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Modelli consigliati</div>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          {recommendedModels.map(modelId => {
                            const meta = LAYOUT_LABELS[modelId] || {};
                            return (
                              <div key={modelId} style={{ padding: '0.85rem', borderRadius: 'var(--radius-sm)', background: 'var(--gray-light)' }}>
                                <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                                  {meta.emoji ? `${meta.emoji} ` : ''}{meta.name || modelId}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                  {meta.desc || 'Modello locale della libreria design.'}
                                </div>
                              </div>
                            );
                          })}
                          {!recommendedModels.length && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nessun modello raccomandato ancora disponibile.</div>}
                        </div>
                      </div>

                      <div style={{ ...PANEL_STYLE }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Perché questi modelli</div>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          {modelReasonEntries.map(([modelId, reasons]) => {
                            const meta = LAYOUT_LABELS[modelId] || {};
                            return (
                              <div key={modelId} style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{meta.name || modelId}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                                  {reasons.join(' · ')}
                                </div>
                              </div>
                            );
                          })}
                          {!modelReasonEntries.length && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Le ragioni di scelta non sono ancora state sintetizzate.</div>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <details style={{ ...PANEL_STYLE, padding: '1.2rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: '17px' }}>Come la control room costruisce il profilo</summary>
                    <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.85rem' }}>
                        {profileAssemblyRows.map(row => (
                          <div key={row.label} style={{ ...PANEL_STYLE, padding: '0.95rem' }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '0.5rem' }}>{row.label}</div>
                            <div style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{row.value}</div>
                            <div style={{ marginTop: '0.65rem', color: 'var(--text-muted)', fontSize: '12px' }}>{row.helper}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                        <div style={{ ...PANEL_STYLE, padding: '1rem' }}>
                          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Input reali letti dai social</div>
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {(editorialRoom.sources || []).map(source => (
                              <div key={source.id} style={{ paddingBottom: '0.65rem', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                                  <strong style={{ textTransform: 'capitalize' }}>{source.platform}</strong>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{source.auto_publish ? 'autopublish' : 'review'}</span>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                  {source.label || source.url}
                                  {source.topic_summary ? <><br />Topic: {source.topic_summary}</> : null}
                                  {source.since_date ? <><br />Da: {source.since_date}</> : null}
                                </div>
                              </div>
                            ))}
                            {!editorialRoom.sources?.length && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nessuna sorgente attiva.</div>}
                          </div>
                        </div>

                        <div style={{ ...PANEL_STYLE, padding: '1rem' }}>
                          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Cosa ha capito l&apos;AI del business</div>
                          <div style={{ display: 'grid', gap: '0.55rem' }}>
                            {understandingHighlights.map((item, index) => (
                              <div key={`${item}-${index}`} style={{ fontSize: '13px', lineHeight: 1.55, padding: '0.7rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'var(--gray-light)' }}>
                                {item}
                              </div>
                            ))}
                            {understandingHighlights.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nessuna comprensione strategica ancora salvata.</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>

                  <details style={{ ...PANEL_STYLE, padding: '1.2rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: '17px' }}>Logica di assemblaggio dei contenuti</summary>
                    <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)', gap: '1rem' }}>
                        <div style={{ ...PANEL_STYLE }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{activePrompt?.label || roomUser.harmonize_agent || 'Agente attivo non definito'}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{activePrompt?.description || 'Questo e il prompt operativo che filtra e armonizza i contenuti di questo utente.'}</div>
                            </div>
                            <span className="badge badge-purple">Prompt attivo</span>
                          </div>
                          <textarea
                            readOnly
                            value={activePrompt?.instructions || 'Nessun prompt associato a questo agente.'}
                            style={{ width: '100%', minHeight: '220px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', lineHeight: 1.55, resize: 'vertical' }}
                          />
                        </div>

                        <div style={{ ...PANEL_STYLE }}>
                          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Variabili reali passate al prompt</div>
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {promptVariables.map(([key, value]) => (
                              <div key={key} style={{ padding: '0.8rem', borderRadius: 'var(--radius-sm)', background: 'var(--gray-light)' }}>
                                <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>{key}</div>
                                <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                        <div style={{ ...PANEL_STYLE }}>
                          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Editorial DNA</div>
                          <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {dnaHighlights.map((item, index) => (
                              <div key={`${item}-${index}`} style={{ fontSize: '13px', lineHeight: 1.55 }}>{item}</div>
                            ))}
                            {!dnaHighlights.length && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>DNA editoriale non ancora sintetizzato.</div>}
                          </div>
                        </div>
                        <div style={{ ...PANEL_STYLE }}>
                          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Editorial Memory</div>
                          <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {memoryHighlights.map((item, index) => (
                              <div key={`${item}-${index}`} style={{ fontSize: '13px', lineHeight: 1.55 }}>{item}</div>
                            ))}
                            {!memoryHighlights.length && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Memoria editoriale vuota.</div>}
                          </div>
                        </div>
                        <div style={{ ...PANEL_STYLE }}>
                          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Impostazioni motore</div>
                          <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {settingsHighlights.map((item, index) => (
                              <div key={`${item}-${index}`} style={{ fontSize: '13px', lineHeight: 1.55 }}>{item}</div>
                            ))}
                            {!settingsHighlights.length && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nessuna impostazione avanzata registrata.</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>

                  <details style={{ ...PANEL_STYLE, padding: '1.2rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: '17px' }}>Prompt e agenti della regia</summary>
                    <div style={{ marginTop: '1rem', display: 'grid', gap: '0.85rem' }}>
                      {adminPrompts.map(prompt => {
                        const isActive = prompt.agent_name === roomUser.harmonize_agent;
                        return (
                          <div key={prompt.id} style={{ ...PANEL_STYLE, borderColor: isActive ? 'var(--primary)' : 'var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontWeight: 700 }}>{prompt.label || prompt.agent_name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{prompt.description || 'Direttiva operativa dell\'agente.'}</div>
                              </div>
                              <div style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '999px', background: isActive ? 'var(--primary-light)' : 'var(--gray-light)', color: isActive ? 'var(--primary-dark)' : 'var(--text-muted)', fontWeight: 800 }}>
                                {isActive ? 'Attivo su questo utente' : prompt.agent_name}
                              </div>
                            </div>
                            <textarea
                              readOnly
                              value={prompt.instructions || ''}
                              style={{ width: '100%', minHeight: '150px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', lineHeight: 1.55, resize: 'vertical' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </details>

                  <details style={{ ...PANEL_STYLE, padding: '1.2rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: '17px' }}>Contenuti recenti e debug</summary>
                    <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      <div style={{ ...PANEL_STYLE }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Ultimi contenuti pubblicati</div>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          {(editorialRoom.posts || []).map(post => (
                            <div key={post.id} style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <div style={{ fontWeight: 700 }}>#{post.id} {post.edited_title || post.generated_title || 'Senza titolo'}</div>
                                <button type="button" className={`btn ${Number(post.noindex) === 1 ? 'btn-primary' : 'btn-outline'}`} onClick={() => togglePostNoindex(post)} style={{ flex: '0 0 auto', padding: '5px 9px', fontSize: '11px' }} title="Escludi o includi l’articolo nei motori di ricerca">
                                  {Number(post.noindex) === 1 ? 'NOINDEX attivo' : 'Indicizzabile'}
                                </button>
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                {post.generated_excerpt || 'Nessun excerpt disponibile'}
                                {post.published_at ? <><br />Pubblicato: {post.published_at}</> : null}
                                {post.seo_score ? <><br />SEO score: {post.seo_score}</> : null}
                              </div>
                            </div>
                          ))}
                          {!editorialRoom.posts?.length && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nessun contenuto pubblicato.</div>}
                        </div>
                      </div>

                      <div style={{ ...PANEL_STYLE }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Debug completo della control room</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                          Apri solo se devi leggere i payload tecnici salvati dal sistema.
                        </div>
                        <div style={{ display: 'grid', gap: '0.85rem' }}>
                          {renderJsonPanel('Comprensione editoriale', roomUser.site_understanding)}
                          {renderJsonPanel('Editorial State', roomUser.editorial_engine_state)}
                          {renderJsonPanel('Site AI Data', roomUser.site_ai_data)}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '10px', flexWrap: 'wrap' }}>
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
