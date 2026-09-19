import React, { useEffect, useState } from 'react';

// Piccolo footer sempre presente con data/ora e versione dell'ultimo deploy,
// letto da deploy-info.json (generato dalla pipeline deployvps in
// .github/workflows/deploy.yml, pubblicato alla radice del sito).
// In sviluppo locale il file non esiste: il footer resta semplicemente
// invisibile, senza errori.
export function DeployFooter() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/deploy-info.json?ts=${Date.now()}`, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && data) setInfo(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!info) return null;

  const quando = formattaData(info.deployed_at);
  const versione = String(info.release || '').replace(/^deployvps-/, '');

  return (
    <>
      <style>{`
        .sts-deploy-footer {
          position: fixed; left: 50%; bottom: 10px; transform: translateX(-50%); z-index: 40;
          font-size: 12px; font-weight: 600;
          color: #e8eefc; background: rgba(15,23,42,.82);
          padding: 6px 14px; border-radius: 999px; pointer-events: none;
          backdrop-filter: blur(8px);
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          user-select: none; white-space: nowrap;
          box-shadow: 0 4px 14px rgba(8,10,28,.28);
        }
        .sts-deploy-footer b { font-weight: 700; }
        .sts-deploy-footer span { opacity: .62; font-weight: 500; }
        @media (max-width: 640px) { .sts-deploy-footer { display: none; } }
      `}</style>
      <footer className="sts-deploy-footer">
        Aggiornato il <b>{quando}</b> <span>&middot; versione {versione}</span>
      </footer>
    </>
  );
}

// "2026-09-18 20:11:17" -> "18/09/2026 alle 20:11".
// La stringa viene letta a pezzi invece che con new Date() perche' e' gia'
// espressa nel fuso di Roma: lasciarla interpretare al browser sposterebbe
// l'orario per chi non si trova in quel fuso.
function formattaData(raw) {
  const parti = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(raw || ''));
  if (!parti) return String(raw || '');
  const [, anno, mese, giorno, ore, minuti] = parti;
  return `${giorno}/${mese}/${anno} alle ${ore}:${minuti}`;
}
