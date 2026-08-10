import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';
import { ProgressBar } from '../components/ProgressBar';

/**
 * Schermata mostrata subito dopo il collegamento dei canali.
 *
 * Mostra il lavoro mentre accade, un contenuto alla volta: e il primo momento
 * in cui il cliente puo verificare che il prodotto funziona davvero, quindi
 * deve dire cosa sta succedendo e cosa e gia pronto, non far girare una rotella.
 *
 * Se il cliente esce prima della fine non perde niente: i contenuti rimasti in
 * coda vengono completati dalla sincronizzazione automatica.
 */
export function GeneratingScreen({ token, user, onDone }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [totale, setTotale] = useState(0);
  const [fatti, setFatti] = useState(0);
  const [pronti, setPronti] = useState(0);
  const [finito, setFinito] = useState(false);
  const [logs, setLogs] = useState([
    { id: 1, text: 'Avvio…', time: new Date().toLocaleTimeString('it-IT') }
  ]);
  const annullato = useRef(false);

  const addLog = (text) => setLogs(l => [...l, { id: Date.now() + Math.random(), text, time: new Date().toLocaleTimeString('it-IT') }]);

  useEffect(() => {
    annullato.current = false;

    async function avvia() {
      try {
        // 1. Scarica i contenuti dai canali collegati.
        setStep(1);
        addLog('Leggo i canali che hai collegato…');
        const sync = await apiFetch('/api/index.php?action=sync', {
          method: 'POST',
          body: JSON.stringify({ limit: 20 }),
        }, token);
        if (annullato.current) return;

        const nuovi = (sync?.results || []).reduce((somma, r) => somma + Number(r?.new || 0), 0);
        addLog(nuovi > 0
          ? `Trovati ${nuovi} contenuti da trasformare in articoli.`
          : 'Nessun contenuto nuovo da scaricare.');

        // 2. Chiedi quali sono in coda: e la lista di lavoro reale.
        setStep(2);
        const coda = await apiFetch('/api/index.php?action=pending-posts', {}, token);
        if (annullato.current) return;
        const lista = Array.isArray(coda) ? coda : [];
        setTotale(lista.length);

        if (!lista.length) {
          addLog('Non c’è nulla in coda: puoi entrare nella dashboard.');
          setFinito(true);
          return;
        }

        // 3. Elabora un contenuto alla volta, mostrando l'avanzamento.
        setStep(3);
        addLog(`Scrivo gli articoli: ${lista.length} da elaborare.`);
        let ok = 0;
        for (let i = 0; i < lista.length; i++) {
          if (annullato.current) return;
          try {
            const esito = await apiFetch('/api/index.php?action=process-pending', {
              method: 'POST',
              body: JSON.stringify({ id: lista[i].id }),
            }, token);
            if (annullato.current) return;
            if (esito?.status === 'deleted') {
              addLog(`${i + 1}/${lista.length} · saltato: nessun testo da cui partire.`);
            } else if (esito?.ok) {
              ok += 1;
              setPronti(ok);
              addLog(`${i + 1}/${lista.length} · pronto: “${esito?.seo?.title || 'articolo'}”`);
            } else {
              addLog(`${i + 1}/${lista.length} · ${esito?.message || 'saltato'}`);
            }
          } catch (e) {
            // Un contenuto che non riesce non deve fermare tutti gli altri:
            // resta in coda e verra ripreso dalla sincronizzazione automatica.
            addLog(`${i + 1}/${lista.length} · rinviato (${e.message}). Riproveremo da soli.`);
          }
          setFatti(i + 1);
        }

        if (annullato.current) return;
        addLog(ok > 0 ? `Fatto: ${ok} articoli pubblicati.` : 'Nessun articolo completato in questo giro.');
        setFinito(true);
      } catch (err) {
        if (!annullato.current) {
          setError(err.message);
          addLog(`Non sono riuscito a procedere: ${err.message}`);
        }
      }
    }

    avvia();
    return () => { annullato.current = true; };
  }, []);

  const percentuale = totale > 0 ? Math.round((fatti / totale) * 100) : (finito ? 100 : 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg)' }}>
      <div className="glass-modal" style={{ width: '100%', maxWidth: '560px', textAlign: 'center' }}>

        <h2 style={{ marginBottom: '.6rem', color: 'var(--primary)', fontWeight: 800 }}>
          {finito ? 'Il tuo spazio è pronto' : 'Sto costruendo il tuo spazio'}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          {finito
            ? 'Puoi entrare e vedere il risultato. Ogni articolo resta modificabile.'
            : 'Leggo i tuoi contenuti, ne ricavo il testo e li riscrivo come articoli che Google può trovare.'}
        </p>

        <ProgressBar step={step} />

        {totale > 0 && (
          <div style={{ margin: '1.25rem 0' }}>
            <div style={{ height: '8px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ width: `${percentuale}%`, height: '100%', background: 'var(--primary)', transition: 'width .3s ease' }} />
            </div>
            <div style={{ marginTop: '.6rem', fontSize: '13px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {fatti} di {totale} elaborati · <strong style={{ color: 'var(--primary)' }}>{pronti} articoli pronti</strong>
            </div>
          </div>
        )}

        <div style={{ background: '#1e1e1e', color: '#00ffcc', padding: '16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'monospace', textAlign: 'left', maxHeight: '190px', overflowY: 'auto', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' }}>
          {logs.map(l => (
            <div key={l.id} style={{ marginBottom: '4px', opacity: .85 }}>
              <span style={{ color: '#888', marginRight: '8px' }}>[{l.time}]</span>{l.text}
            </div>
          ))}
          {error && <div style={{ color: '#ff6b6b', marginTop: '8px', fontWeight: 'bold' }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
          {/* Sempre disponibile: nessuno deve restare bloccato a guardare una barra.
              Chi esce non perde il lavoro, la coda viene ripresa in automatico. */}
          <button className={`btn ${finito ? 'btn-primary' : 'btn-outline'}`} onClick={onDone} style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>
            {finito ? 'Entra nella dashboard' : 'Vai avanti senza aspettare'}
          </button>
          {error && (
            <button className="btn btn-outline" onClick={() => window.location.reload()} style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>
              Riprova
            </button>
          )}
        </div>

        {!finito && totale > 0 && (
          <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Puoi uscire quando vuoi: i contenuti rimasti vengono completati automaticamente.
          </p>
        )}
      </div>
    </div>
  );
}
