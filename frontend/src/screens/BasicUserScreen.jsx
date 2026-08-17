import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export function BasicUserScreen({ user, token, onLogout }) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    try {
      const d = await apiFetch('/api/index.php?action=site', {}, token);
      setData(d);
    } catch (e) {
      console.error(e);
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

  const handleNextStep = (nextStep) => {
    setAnimating(true);
    setTimeout(() => {
      setStep(nextStep);
      setAnimating(false);
    }, 400);
  };

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
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
          color: #fff;
          font-family: 'Outfit', 'Inter', sans-serif;
          padding: 2rem;
          position: relative;
          overflow: hidden;
        }
        .lia-background-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 800px;
          height: 800px;
          background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%);
          pointer-events: none;
          z-index: 0;
        }
        .lia-card {
          position: relative;
          z-index: 10;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 32px;
          padding: 3rem;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          text-align: center;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: ${animating ? 0 : 1};
          transform: translateY(${animating ? '20px' : '0'});
        }
        .lia-avatar {
          position: relative;
          width: 120px;
          height: 120px;
          margin: 0 auto 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lia-core {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 50%;
          box-shadow: 0 0 30px rgba(99, 102, 241, 0.8);
          z-index: 3;
          animation: pulse-core 3s infinite alternate ease-in-out;
        }
        .lia-ring-1, .lia-ring-2 {
          position: absolute;
          border-radius: 50%;
          border: 2px solid rgba(168, 85, 247, 0.4);
          z-index: 2;
        }
        .lia-ring-1 {
          width: 90px;
          height: 90px;
          animation: spin-slow 8s linear infinite;
          border-top-color: transparent;
          border-bottom-color: transparent;
        }
        .lia-ring-2 {
          width: 120px;
          height: 120px;
          border: 1px solid rgba(99, 102, 241, 0.3);
          animation: spin-slow-reverse 12s linear infinite;
          border-left-color: transparent;
          border-right-color: transparent;
        }
        .lia-sparkles {
          position: absolute;
          top: -10px;
          right: -10px;
          font-size: 24px;
          z-index: 4;
          animation: float 3s ease-in-out infinite;
        }
        @keyframes pulse-core {
          0% { transform: scale(0.95); box-shadow: 0 0 20px rgba(99, 102, 241, 0.6); }
          100% { transform: scale(1.05); box-shadow: 0 0 40px rgba(168, 85, 247, 0.9); }
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spin-slow-reverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .lia-title {
          font-size: 2rem;
          font-weight: 800;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #fff, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .lia-text {
          font-size: 1.1rem;
          line-height: 1.6;
          color: #94a3b8;
          margin-bottom: 2rem;
        }
        .lia-button {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          border: none;
          padding: 1rem 2rem;
          font-size: 1.1rem;
          font-weight: 700;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 20px -10px rgba(99, 102, 241, 0.6);
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .lia-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 25px -10px rgba(99, 102, 241, 0.8);
        }
        .lia-button-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: #e2e8f0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-top: 1rem;
        }
        .lia-button-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          box-shadow: none;
        }
        .lia-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
      `}</style>

      <div className="lia-background-glow"></div>

      <div className="lia-card">
        {renderLiaAvatar()}

        {loading && step === 0 && (
          <h1 className="lia-title">Un momento...</h1>
        )}

        {!loading && step === 1 && (
          <>
            <h1 className="lia-title">Benvenuto {user?.name || ''}! Sono LIA.</h1>
            <p className="lia-text">
              Sono la tua tutor personale. Costruirò il tuo sito web partendo dai tuoi social e me ne prenderò cura ogni giorno. Per iniziare, devi solo darmi accesso al tuo primo canale.
            </p>
            <div className="lia-actions">
              <button className="lia-button" onClick={() => window.location.href = '/connect'}>
                Collega il tuo canale 🔗
              </button>
              <button className="lia-button lia-button-secondary" onClick={onLogout}>
                Esci
              </button>
            </div>
          </>
        )}

        {!loading && step === 2 && (
          <>
            <h1 className="lia-title">Sto analizzando i tuoi contenuti</h1>
            <p className="lia-text">
              Ho visto i tuoi canali! Sto analizzando il tuo tono di voce, gli argomenti e le foto. L'operazione può richiedere qualche minuto, ma puoi anche chiudere questa pagina: il sito sarà pronto al tuo ritorno.
            </p>
            <div className="lia-actions">
              <button className="lia-button lia-button-secondary" onClick={onLogout}>
                Esci e torna più tardi
              </button>
            </div>
          </>
        )}

        {!loading && step === 3 && (
          <>
            <h1 className="lia-title">Il tuo sito è pronto!</h1>
            <p className="lia-text">
              Ho creato e ottimizzato il tuo sito web in base ai tuoi contenuti social. Da questo momento in poi, ogni volta che pubblicherai sui social, io aggiornerò automaticamente il sito.
            </p>
            <div className="lia-actions">
              <button className="lia-button" onClick={() => window.open(`/${user?.slug}`, '_blank')}>
                Vedi il tuo Sito 🌐
              </button>
              <button className="lia-button lia-button-secondary" onClick={onLogout}>
                Esci
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
