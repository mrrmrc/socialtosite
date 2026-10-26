import React, { useState } from 'react';

export function AdminClientSettings({ user, settings, busy, onProfileSave, onEngineSave }) {
  const [mission, setMission] = useState(user.role_mission || '');
  const [strategy, setStrategy] = useState(user.content_strategy || '');
  const [engine, setEngine] = useState({ enabled: settings.enabled !== false && settings.enabled !== 0, auto_run: settings.auto_run !== false && settings.auto_run !== 0, min_posts: settings.min_posts || 8, strict_indexing_mode: settings.strict_indexing_mode !== false && settings.strict_indexing_mode !== 0 });
  return <section className="cr-block"><div className="cr-block-heading"><div><h4>Controlli del cliente</h4><p>Le modifiche si applicano soltanto a questo cliente.</p></div></div>
    <form className="admin-client-settings" onSubmit={e => { e.preventDefault(); onProfileSave(user.id, { role_mission: mission, content_strategy: strategy }); }}>
      <label>Obiettivo editoriale<textarea aria-label="Obiettivo editoriale" maxLength={10000} rows={3} value={mission} onChange={e => setMission(e.target.value)} /></label>
      <label>Strategia dei contenuti<textarea aria-label="Strategia dei contenuti" maxLength={10000} rows={4} value={strategy} onChange={e => setStrategy(e.target.value)} /></label>
      <button className="btn btn-primary" disabled={Boolean(busy)}>Salva obiettivo e strategia</button>
    </form>
    <form className="admin-client-settings" onSubmit={e => { e.preventDefault(); onEngineSave(user.id, { ...engine, min_posts: Number(engine.min_posts) }); }}>
      <h4>Motore editoriale</h4>
      <label><input type="checkbox" checked={engine.enabled} onChange={e => setEngine(current => ({ ...current, enabled: e.target.checked }))} /> Analisi editoriale attiva</label>
      <label><input type="checkbox" checked={engine.auto_run} onChange={e => setEngine(current => ({ ...current, auto_run: e.target.checked }))} /> Esecuzione automatica dell’analisi</label>
      <label><input type="checkbox" checked={engine.strict_indexing_mode} onChange={e => setEngine(current => ({ ...current, strict_indexing_mode: e.target.checked }))} /> Controlli rigorosi di indicizzazione</label>
      <label>Articoli minimi per l’analisi<input type="number" min={3} max={60} required value={engine.min_posts} onChange={e => setEngine(current => ({ ...current, min_posts: e.target.value }))} /></label>
      <button className="btn btn-primary" disabled={Boolean(busy)}>Salva motore editoriale</button>
    </form>
  </section>;
}
