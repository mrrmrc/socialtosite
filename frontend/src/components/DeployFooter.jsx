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

  return (
    <>
      <style>{`
        .sts-deploy-footer {
          position: fixed; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 40;
          font-size: 10px; font-weight: 600; letter-spacing: .02em;
          color: rgba(148,163,184,.7); background: rgba(15,23,42,.55);
          padding: 4px 9px; border-radius: 999px; pointer-events: none;
          backdrop-filter: blur(6px); font-family: 'SFMono-Regular', Menlo, monospace;
          user-select: none; white-space: nowrap;
        }
        @media (max-width: 640px) { .sts-deploy-footer { display: none; } }
      `}</style>
      <footer className="sts-deploy-footer" aria-hidden="true">
        {info.release || 'dev'} · {info.deployed_at}{info.timezone ? ` ${info.timezone}` : ''}
      </footer>
    </>
  );
}
