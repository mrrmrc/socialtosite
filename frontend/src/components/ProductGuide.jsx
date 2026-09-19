import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';

// Volto di LIA disegnato a mano: un SVG resta nitido a ogni dimensione, segue
// i colori del tema e non aggiunge un file da scaricare. Gli occhi sbattono da
// soli via CSS; "pensa" mentre aspettiamo la risposta.
function LiaFace({ size = 40, thinking = false, title }) {
  return (
    <svg
      className={`lia-face${thinking ? ' is-thinking' : ''}`}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
    >
      <defs>
        <linearGradient id="lia-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d5ce7" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="lia-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffdec7" />
          <stop offset="1" stopColor="#f6bd96" />
        </linearGradient>
      </defs>

      {/* capelli dietro, con le punte arrotondate */}
      <path d="M12 35c0-13 9-22 20-22s20 9 20 22c0 7-1 12-2 15-1 2-4 2-4-1.5 0-7-1-11-3-13-4 2-7 3-11 3s-7-1-11-3c-2 2-3 6-3 13 0 3.5-3 3.5-4 1.5-1-3-2-8-2-15z" fill="url(#lia-hair)" />
      {/* viso */}
      <ellipse cx="32" cy="33" rx="15" ry="16.5" fill="url(#lia-skin)" />
      {/* frangia */}
      <path d="M17 29c1-10 7-16 15-16s14 6 15 16c-3-5-8-8-15-8s-12 3-15 8z" fill="url(#lia-hair)" />
      {/* auricolare: segnale discreto che e' una AI */}
      <circle cx="18" cy="35.5" r="3.3" fill="url(#lia-hair)" />
      <circle className="lia-spark" cx="18" cy="35.5" r="1.25" fill="#fff" />
      {/* occhi */}
      <g fill="#2b2350">
        <ellipse className="lia-eye" cx="26" cy="33" rx="2.5" ry="3.1" />
        <ellipse className="lia-eye" cx="38" cy="33" rx="2.5" ry="3.1" />
      </g>
      <g fill="#fff" opacity=".9">
        <circle cx="26.9" cy="31.9" r=".85" />
        <circle cx="38.9" cy="31.9" r=".85" />
      </g>
      {/* guance e sorriso */}
      <g fill="#f79a9a" opacity=".45">
        <ellipse cx="22.5" cy="38" rx="2.6" ry="1.7" />
        <ellipse cx="41.5" cy="38" rx="2.6" ry="1.7" />
      </g>
      <path d="M27.5 40.5c1.6 2 7.4 2 9 0" stroke="#b5476b" strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Spunti per iniziare, non un menu permanente: spariscono al primo messaggio
// perche' una chat non deve portarsi dietro pulsanti che non servono piu'.
// Due generici e due "come faccio a", cosi' resta chiaro che risponde a entrambe.
const SPUNTI = [
  'Cosa devo fare adesso?',
  'Come aggiungo un canale?',
  'Cosa posso migliorare?',
  'Come pubblico un articolo?',
];

export function ProductGuide() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'guide', text: 'Ciao, sono LIA. Chiedimi pure, anche a parole tue.' },
  ]);

  const fineChat = useRef(null);
  const campoTesto = useRef(null);

  useEffect(() => {
    if (open) campoTesto.current?.focus();
  }, [open]);

  useEffect(() => {
    fineChat.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, waiting]);

  async function ask(question) {
    const clean = question.trim();
    if (!clean || waiting) return;

    const nextMessages = [...messages, { role: 'user', text: clean }];
    setMessages(nextMessages);
    setInput('');
    setWaiting(true);

    try {
      const result = await apiFetch('/api/index.php?action=lia-chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: nextMessages.map(message => ({
            role: message.role === 'guide' ? 'assistant' : 'user',
            text: message.text,
          })),
        }),
      }, localStorage.getItem('sts_token'));
      setMessages(previous => [...previous, { role: 'guide', text: result.reply }]);
    } catch (error) {
      setMessages(previous => [...previous, {
        role: 'error',
        text: error.message || 'Non riesco a rispondere adesso. Riprova tra poco.',
      }]);
    } finally {
      setWaiting(false);
    }
  }

  return (
    <>
      <button
        className={`product-guide-launcher${open ? ' is-open' : ''}${waiting ? ' is-busy' : ''}`}
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls="product-guide-panel"
        aria-label={open ? 'Chiudi la chat con LIA' : 'Apri la chat con LIA, l’assistente AI'}
      >
        <LiaFace size={44} thinking={waiting} />
        <span className="product-guide-tip" aria-hidden="true">Chiedi a LIA</span>
      </button>

      {open && (
        <section className="product-guide-panel" id="product-guide-panel" role="dialog" aria-label="Chat con LIA">
          <header>
            <LiaFace size={44} thinking={waiting} />
            <div>
              <strong>LIA</strong>
              <small>{waiting ? 'Sto pensando…' : 'Assistente AI · chiedimi come si fa'}</small>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Chiudi chat">&times;</button>
          </header>

          <div className="product-guide-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`is-${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>
            ))}
            {waiting && (
              <div className="is-guide is-thinking">
                <i /><i /><i />
              </div>
            )}
            <div ref={fineChat} />
          </div>

          {messages.length === 1 && !waiting && (
            <div className="product-guide-questions">
              {SPUNTI.map(question => (
                <button key={question} onClick={() => ask(question)}>{question}</button>
              ))}
            </div>
          )}

          <form onSubmit={event => { event.preventDefault(); ask(input); }}>
            <input
              ref={campoTesto}
              value={input}
              disabled={waiting}
              onChange={event => setInput(event.target.value)}
              placeholder={'Scrivi una domanda…'}
              aria-label="Domanda per LIA"
            />
            <button type="submit" disabled={waiting || !input.trim()}>{waiting ? 'Attendi…' : 'Invia'}</button>
          </form>
        </section>
      )}
    </>
  );
}
