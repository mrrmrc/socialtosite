import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';

import { LiaAvatar } from './LiaAvatar';

// Spunti per iniziare, non un menu permanente: spariscono al primo messaggio
// perche' una chat non deve portarsi dietro pulsanti che non servono piu'.
// Due generici e due "come faccio a", cosi' resta chiaro che risponde a entrambe.
const SPUNTI = [
  'Cosa devo fare adesso?',
  'Come aggiungo un canale?',
  'Cosa posso migliorare?',
  'Come pubblico un articolo?',
];

export function ProductGuide({ knowledge }) {
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
        <LiaAvatar size={54} thinking={waiting} knowledge={knowledge} />
        <span className="product-guide-tip" aria-hidden="true">Chiedi a LIA</span>
      </button>

      {open && (
        <section className="product-guide-panel" id="product-guide-panel" role="dialog" aria-label="Chat con LIA">
          <header>
            <LiaAvatar size={38} thinking={waiting} knowledge={knowledge} />
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
