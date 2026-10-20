import React, { useEffect, useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { apiFetch } from '../utils/api';

const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const fieldStyle = { display: 'block', width: '100%', marginTop: 8, padding: 12, border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', font: 'inherit' };

export function ManualContentComposer({ token, initialTitle = '', onClose, onSaved }) {
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = title !== initialTitle || Boolean(text);
  useEffect(() => {
    const protect = event => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, saving]);
  function close() {
    if (saving) return;
    if (dirty && !window.confirm('Hai un contenuto non salvato. Vuoi scartarlo?')) return;
    onClose();
  }
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (!title.trim() || !text.trim()) { setError('Inserisci il titolo e il testo del contenuto.'); return; }
    setSaving(true); setError('');
    const body = text.trim().split(/\n\s*\n/).map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
    let result;
    try {
      result = await apiFetch('/api/index.php?action=post-create', { method: 'POST', body: JSON.stringify({ edited_title: title.trim(), edited_body: body }) }, token);
    } catch (err) { setError(err.message); setSaving(false); return; }
    // Creation has succeeded: never repeat it if refreshing the list fails.
    onSaved({ id: result.id, edited_title: title.trim(), edited_body: body, platform: 'manual', published: 0, tags: [] });
  }
  return <EditorDialog onClose={close}><form className="glass-modal article-editor-modal" onSubmit={save}>
    <header className="article-editor-header"><div><div className="article-editor-eyebrow">Scrivi tu · senza IA</div><h2 id="article-editor-title">Aggiungi un contenuto</h2></div><button type="button" className="btn btn-ghost" disabled={saving} onClick={close} aria-label="Chiudi nuovo contenuto">×</button></header>
    <div className="article-editor-scroll" style={{ display: 'grid', gap: 16 }}>
      <p>Scrivi o incolla il tuo testo. Lo salvi come bozza privata; poi puoi aggiungere immagini, formattarlo e scegliere se pubblicarlo.</p>
      {error && <p role="alert" className="editor-save-error">{error}</p>}
      <label>Titolo<input style={fieldStyle} value={title} maxLength={200} disabled={saving} onChange={event => setTitle(event.target.value)} /></label>
      <label>Il tuo testo<textarea style={{ ...fieldStyle, minHeight: 240, resize: 'vertical' }} rows={12} value={text} disabled={saving} onChange={event => setText(event.target.value)} placeholder="Una novità, un progetto, un approfondimento: raccontalo con le tue parole." /></label>
      <small>Non servono social collegati, intervista completata o credito IA.</small>
    </div>
    <footer className="article-editor-actions"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Salvo la bozza…' : 'Salva bozza e continua'}</button><button className="btn btn-ghost" type="button" disabled={saving} onClick={close}>Annulla</button></footer>
  </form></EditorDialog>;
}
