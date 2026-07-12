import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { ProgressBar } from '../components/ProgressBar';

export function GeneratingScreen({ token, user, onDone }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([
    { id: 1, text: 'Avvio inizializzazione...', time: new Date().toLocaleTimeString() }
  ]);

  const addLog = (text) => setLogs(l => [...l, { id: Date.now() + Math.random(), text, time: new Date().toLocaleTimeString() }]);

  useEffect(() => {
    let canceled = false;
    async function runSetup() {
      try {
        // Step 1: Init db
        setStep(1);
        addLog('Inizializzazione database in corso...');
        await apiFetch('/api/index.php?action=migrate', {}, token);
        if (canceled) return;
        addLog('Database configurato con successo.');

        // Step 2: Sync channels
        setStep(2);
        addLog('Connessione ai canali social (download post)...');
        const syncRes = await apiFetch('/api/index.php?action=social-sync', { method: 'POST' }, token);
        if (canceled) return;
        addLog(`Sincronizzati ${syncRes.new_posts || 0} nuovi post dai social.`);

        // Step 3: Trigger AI (Async process)
        setStep(3);
        addLog('Lancio processi AI in background per analizzare i contenuti...');
        await apiFetch('/api/index.php?action=ai-process-pending', { method: 'POST' }, token);
        if (canceled) return;
        addLog('Lavori in coda. Il tuo sito è pronto!');

        setTimeout(() => { if (!canceled) onDone(); }, 2000);

      } catch (err) {
        if (!canceled) {
          setError(err.message);
          addLog(`ERRORE: ${err.message}`);
        }
      }
    }
    runSetup();
    return () => { canceled = true; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg)' }}>
      <div className="glass-modal" style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>
        
        <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 2rem' }}>
          <div style={{ position: 'absolute', inset: 0, border: '4px solid var(--border)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', inset: 0, border: '4px solid var(--primary)', borderRadius: '50%', borderTopColor: 'transparent', animation: 'spin 1.5s linear infinite' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>✨</div>
        </div>

        <h2 style={{ marginBottom: '1rem', color: 'var(--primary)', fontWeight: 800 }}>Stiamo creando la tua magia</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.6 }}>
          La nostra AI sta leggendo i tuoi post, capendo il tuo tono di voce e costruendo il tuo sito web personalizzato.
        </p>

        <ProgressBar step={step} />

        <div style={{ background: '#1e1e1e', color: '#00ffcc', padding: '16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'monospace', textAlign: 'left', maxHeight: '180px', overflowY: 'auto', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' }}>
          {logs.map(l => (
            <div key={l.id} style={{ marginBottom: '4px', opacity: 0.8 }}>
              <span style={{ color: '#888', marginRight: '8px' }}>[{l.time}]</span> {l.text}
            </div>
          ))}
          {error && <div style={{ color: '#ff4444', marginTop: '8px', fontWeight: 'bold' }}>[ERRORE FATALE] {error}</div>}
        </div>

        {error && (
          <button className="btn btn-outline" onClick={() => window.location.reload()} style={{ marginTop: '20px' }}>
            Riprova Setup
          </button>
        )}

      </div>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
