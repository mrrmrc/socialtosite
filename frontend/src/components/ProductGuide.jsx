import React, { useMemo, useState } from 'react';
import { apiFetch } from '../utils/api';

export function ProductGuide({ posts = [], sources = [], siteUrl, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'guide', text: 'Ciao, sono LIA, l’assistente AI di LinkSeoWeb. Posso ragionare con te sui contenuti, sul sito e sui dati reali del tuo account. Da dove vuoi partire?' },
  ]);

  const facts = useMemo(() => {
    const acquired = posts.length;
    const ready = posts.filter(post => Number(post.seo_score) >= 0).length;
    const published = posts.filter(post => Number(post.published) === 1).length;
    const pending = posts.filter(post => Number(post.seo_score) < 0 && post.processing_status !== 'processing').length;
    const processing = posts.filter(post => post.processing_status === 'processing').length;
    return { acquired, ready, published, pending, processing, sources: sources.length };
  }, [posts, sources]);

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

  const quickQuestions = ['Cosa sta succedendo?', 'Come verifico che funziona?', 'Cosa posso migliorare?', 'Cosa devo fare adesso?'];

  return (
    <>
      <button className="product-guide-launcher" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="product-guide-panel">
        <span aria-hidden="true">L</span><span><strong>Chiedi a LIA</strong><small>Assistente AI sui tuoi dati</small></span>
      </button>
      {open && (
        <section className="product-guide-panel" id="product-guide-panel" role="dialog" aria-label="Chat con LIA">
          <header><span aria-hidden="true">L</span><div><strong>LIA · assistente AI</strong><small>Conosce lo stato reale del tuo account</small></div><button onClick={() => setOpen(false)} aria-label="Chiudi chat">×</button></header>
          <div className="product-guide-facts">
            <span><strong>{facts.acquired}</strong> acquisiti</span><span><strong>{facts.ready}</strong> pronti</span><span><strong>{facts.published}</strong> online</span>
          </div>
          <div className="product-guide-messages" aria-live="polite">
            {messages.map((message, index) => <div className={`is-${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}
            {waiting && <div className="is-guide is-thinking">LIA sta ragionando…</div>}
          </div>
          <div className="product-guide-questions">{quickQuestions.map(question => <button key={question} disabled={waiting} onClick={() => ask(question)}>{question}</button>)}</div>
          <form onSubmit={event => { event.preventDefault(); ask(input); }}>
            <input value={input} disabled={waiting} onChange={event => setInput(event.target.value)} placeholder="Scrivi una domanda…" aria-label="Domanda per LIA" />
            <button type="submit" disabled={waiting || !input.trim()}>{waiting ? 'Attendi…' : 'Invia'}</button>
          </form>
          <footer><button onClick={() => { setOpen(false); onNavigate?.('articles'); }}>Vai agli articoli</button><a href={siteUrl} target="_blank" rel="noopener">Apri il sito ↗</a></footer>
        </section>
      )}
    </>
  );
}
