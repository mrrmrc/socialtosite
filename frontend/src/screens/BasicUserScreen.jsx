import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const LOADING_MESSAGES = [
  'Controllo i canali collegati…',
  'Raccolgo testi e immagini…',
  'Preparo il tuo spazio di lavoro…',
];

export function BasicUserScreen({ user, token, onLogout, onEnterDashboard }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const site = data?.site;
  const sources = data?.sources || [];
  const posts = data?.posts || [];

  const isConnected = sources.length > 0;
  const hasPosts = posts.length > 0;

  useEffect(() => {
    loadData();
    // Poll for updates if connected but no posts yet
    const interval = setInterval(() => {
      loadData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!loading && step !== 2) return undefined;
    const interval = setInterval(() => {
      setLoadingMessageIndex(current => (current + 1) % LOADING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading, step]);

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const d = await apiFetch('/api/index.php?action=site', {}, token);
      setData(d);
    } catch (e) {
      console.error(e);
      if (!silent) setError('Non riesco a caricare il tuo sito. Controlla la connessione e riprova.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!isConnected) {
      setStep(1); // Needs connection
    } else if (!hasPosts) {
      setStep(2); // Needs sync/generation
    } else {
      setStep(3); // Ready
    }
  }, [isConnected, hasPosts, loading]);

  const renderLiaAvatar = () => (
    <div className="lia-avatar">
      <div className="lia-core"></div>
      <div className="lia-ring-1"></div>
      <div className="lia-ring-2"></div>
      <div className="lia-sparkles">✨</div>
    </div>
  );

  return (
    <div className="lia-container">
      <style>{`
        .lia-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f2f5f9;
          color: #172033;
          font-family: 'Outfit', 'Inter', sans-serif;
          padding: 32px 20px;
          position: relative;
          overflow: hidden;
        }
        .lia-background-glow {
          display: none;
        }
        .lia-card {
          position: relative;
          z-index: 10;
          background: #fff;
          border: 2px solid #dce3ec;
          border-radius: 24px;
          padding: 48px;
          max-width: 720px;
          width: 100%;
          box-shadow: 0 18px 50px rgba(23, 32, 51, 0.12);
          text-align: center;
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .lia-avatar {
          width: 104px;
          height: 104px;
          margin: 0 auto 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 24px;
          background: #f4f1ff;
          border: 2px solid #ded7ff;
          animation: lia-breathe 1.8s ease-in-out infinite;
        }
        .lia-core {
          width: 76px;
          height: 76px;
          background: #fff url('/logo-cropped.png?v=2') center/contain no-repeat;
          border-radius: 18px;
          z-index: 2;
        }
        .lia-ring-1, .lia-ring-2 {
          display: none;
        }
        .lia-sparkles {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
        }
        .lia-title {
          font-size: clamp(30px, 5vw, 40px);
          line-height: 1.15;
          font-weight: 800;
          margin: 0 0 20px;
          color: #172033;
        }
        .lia-text {
          font-size: clamp(19px, 2.5vw, 22px);
          line-height: 1.6;
          color: #46536a;
          margin: 0 auto 32px;
          max-width: 590px;
        }
        .lia-button {
          min-height: 64px;
          background: #5638c7;
          color: white;
          border: 2px solid #5638c7;
          padding: 16px 28px;
          font-size: 20px;
          font-weight: 800;
          border-radius: 14px;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: min(100%, 420px);
        }
        .lia-button:hover {
          background: #4125a8;
          border-color: #4125a8;
        }
        .lia-button:focus-visible { outline: 4px solid #f3b900; outline-offset: 4px; }
        .lia-button-secondary {
          min-height: 52px;
          background: #fff;
          color: #344158;
          border-color: #aeb8c7;
          font-size: 17px;
          margin-top: 8px;
        }
        .lia-button-secondary:hover {
          background: #eef2f7;
          border-color: #778399;
        }
        .lia-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .lia-progress {
          width: min(100%, 470px);
          height: 12px;
          margin: 0 auto 16px;
          border-radius: 999px;
          background: #e4e9f1;
          overflow: hidden;
        }
        .lia-progress span {
          display: block;
          width: 42%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #5638c7, #19a8bd);
          animation: lia-progress 1.8s ease-in-out infinite;
        }
        .lia-status {
          min-height: 28px;
          margin: 0 0 28px;
          color: #344158;
          font-size: 18px;
          font-weight: 700;
        }
        .lia-exit {
          margin-top: 6px;
          border: 0;
          background: transparent;
          color: #5b6575;
          text-decoration: underline;
          font: inherit;
          cursor: pointer;
          padding: 10px 18px;
        }
        @keyframes lia-breathe { 50% { transform: scale(1.04); box-shadow: 0 8px 24px rgba(86,56,199,.16); } }
        @keyframes lia-progress { 0% { transform: translateX(-110%); } 100% { transform: translateX(240%); } }
        .lia-error { color: #9c1c1c; background: #fff1f1; border: 2px solid #efb0b0; border-radius: 14px; padding: 16px; font-size: 19px; line-height: 1.5; margin: 0 0 24px; }
        @media (max-width: 600px) { .lia-container { padding: 16px; } .lia-card { padding: 32px 20px; border-radius: 18px; } }
        @media (prefers-reduced-motion: reduce) { .lia-card, .lia-button { transition: none; } .lia-avatar, .lia-progress span { animation: none; } .lia-progress span { width: 70%; } }
      `}</style>

      <div className="lia-background-glow"></div>

      <div className="lia-card">
        {renderLiaAvatar()}

        {loading && step === 0 && !error && (
          <>
            <h1 className="lia-title">Sto preparando il tuo spazio</h1>
            <p className="lia-text">Puoi iniziare a orientarti mentre All Social To Web controlla i tuoi contenuti.</p>
            <div className="lia-progress" aria-hidden="true"><span /></div>
            <p className="lia-status" role="status">{LOADING_MESSAGES[loadingMessageIndex]}</p>
            <button className="lia-button" onClick={onEnterDashboard}>Entra subito nel pannello</button>
          </>
        )}

        {!loading && error && (
          <>
            <h1 className="lia-title">Serve un nuovo tentativo</h1>
            <p className="lia-error" role="alert">{error}</p>
            <div className="lia-actions">
              <button className="lia-button" onClick={() => loadData()}>Riprova</button>
              <button className="lia-button lia-button-secondary" onClick={onLogout}>Esci</button>
            </div>
          </>
        )}

        {!loading && !error && step === 1 && (
          <>
            <h1 className="lia-title">Benvenuto {user?.name || ''}! Sono LIA.</h1>
            <p className="lia-text">
              Sono la tua tutor personale. Costruirò il tuo sito web partendo dai tuoi social e me ne prenderò cura ogni giorno. Per iniziare, devi solo darmi accesso al tuo primo canale.
            </p>
            <div className="lia-actions">
              <button className="lia-button" onClick={() => window.location.href = '/connect'}>
                Collega il tuo canale 🔗
              </button>
              <button className="lia-button lia-button-secondary" onClick={onEnterDashboard}>
                Entra nel pannello
              </button>
              <button className="lia-exit" onClick={onLogout}>Esci</button>
            </div>
          </>
        )}

        {!loading && !error && step === 2 && (
          <>
            <h1 className="lia-title">Sto analizzando i tuoi contenuti</h1>
            <p className="lia-text">
              Ho visto i tuoi canali. L’analisi continua in automatico, ma il pannello è già disponibile: puoi entrare senza aspettare.
            </p>
            <div className="lia-progress" aria-hidden="true"><span /></div>
            <p className="lia-status" role="status">{LOADING_MESSAGES[loadingMessageIndex]}</p>
            <div className="lia-actions">
              <button className="lia-button" onClick={onEnterDashboard}>Entra nel pannello</button>
              <button className="lia-exit" onClick={onLogout}>Esci e torna più tardi</button>
            </div>
          </>
        )}

        {!loading && !error && step === 3 && (
          <>
            <h1 className="lia-title">Il tuo sito è pronto!</h1>
            <p className="lia-text">
              Ho creato e ottimizzato il tuo sito web in base ai tuoi contenuti social. Da questo momento in poi, ogni volta che pubblicherai sui social, io aggiornerò automaticamente il sito.
            </p>
            <div className="lia-actions">
              <button className="lia-button" onClick={onEnterDashboard}>
                Entra nel pannello
              </button>
              <button className="lia-button lia-button-secondary" onClick={() => window.open(`/${user?.slug}`, '_blank')}>
                Apri il mio sito
              </button>
              <button className="lia-exit" onClick={onLogout}>Esci</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
