import React, { useMemo, useState } from 'react';

export function ProductGuide({ posts = [], sources = [], siteUrl, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'guide', text: 'Ciao, sono Lia. Non ti chiedo fiducia al buio: ti aiuto a verificare cosa è stato creato, cosa è online e quale passo conviene fare adesso.' },
  ]);

  const facts = useMemo(() => {
    const acquired = posts.length;
    const ready = posts.filter(post => Number(post.seo_score) >= 0).length;
    const published = posts.filter(post => Number(post.published) === 1).length;
    const pending = posts.filter(post => Number(post.seo_score) < 0 && post.processing_status !== 'processing').length;
    const processing = posts.filter(post => post.processing_status === 'processing').length;
    return { acquired, ready, published, pending, processing, sources: sources.length };
  }, [posts, sources]);

  function answer(question) {
    const normalized = question.toLowerCase();
    if (/fregatura|fiducia|verific|prova|soldi|pago|costo/.test(normalized)) {
      return `Puoi controllare tutto: ${facts.sources} canali collegati, ${facts.acquired} contenuti acquisiti, ${facts.ready} articoli preparati e ${facts.published} pubblicati. Apri il sito pubblico e confrontalo con l’elenco Articoli. Non promettiamo visite o vendite: rendiamo verificabili contenuti, pagine e stato di pubblicazione.`;
    }
    if (/succed|stato|facendo|lavorando|ora/.test(normalized)) {
      return `In questo momento: ${facts.processing} articoli realmente in elaborazione, ${facts.pending} da elaborare, ${facts.ready} già pronti e ${facts.published} visibili sul sito. Se il numero “in elaborazione” è zero, il sistema non sta lavorando in sottofondo.`;
    }
    if (/ottengo|risultato|potrebbe|simul|futuro/.test(normalized)) {
      return `La simulazione realistica parte dai tuoi dati: ${facts.acquired} contenuti possono diventare pagine editoriali; oggi ${facts.ready} sono già articoli e ${facts.published} sono online. Il valore verificabile è un archivio proprietario, leggibile e pubblicabile; traffico e risultati commerciali non possono essere garantiti.`;
    }
    if (/fare|prossimo|consigli|inizio|passo/.test(normalized)) {
      if (facts.sources === 0) return 'Il primo passo è collegare almeno un canale: senza una fonte non esistono dati reali da trasformare.';
      if (facts.pending > 0) return `Hai ${facts.pending} contenuti pronti ma non ancora elaborati. Vai in Articoli e scegli “Elabora ora”, oppure avviali insieme.`;
      if (facts.ready > facts.published) return `Hai ${facts.ready - facts.published} articoli pronti ma non pubblicati. Rileggili e usa “Pubblica sul sito” su quelli che vuoi rendere visibili.`;
      return 'La base è attiva. Ora controlla il sito pubblico e usa Visibilità per capire quali pagine e collegamenti sono effettivamente disponibili.';
    }
    return 'Posso spiegarti lo stato reale del lavoro, mostrarti come verificarlo, simulare ciò che può essere costruito con i tuoi contenuti o indicarti il prossimo passo. Scegli una delle domande qui sotto.';
  }

  function ask(question) {
    const clean = question.trim();
    if (!clean) return;
    setMessages(previous => [...previous, { role: 'user', text: clean }, { role: 'guide', text: answer(clean) }]);
    setInput('');
  }

  const quickQuestions = ['Cosa sta succedendo?', 'Come verifico che funziona?', 'Cosa posso ottenere?', 'Cosa devo fare adesso?'];

  return (
    <>
      <button className="product-guide-launcher" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="product-guide-panel">
        <span aria-hidden="true">L</span><span><strong>Chiedi a Lia</strong><small>Risposte sui tuoi dati reali</small></span>
      </button>
      {open && (
        <section className="product-guide-panel" id="product-guide-panel" role="dialog" aria-label="Guida al prodotto">
          <header><span aria-hidden="true">L</span><div><strong>Lia · guida trasparente</strong><small>Ti risponde usando lo stato reale del tuo account</small></div><button onClick={() => setOpen(false)} aria-label="Chiudi guida">×</button></header>
          <div className="product-guide-facts">
            <span><strong>{facts.acquired}</strong> acquisiti</span><span><strong>{facts.ready}</strong> pronti</span><span><strong>{facts.published}</strong> online</span>
          </div>
          <div className="product-guide-messages" aria-live="polite">
            {messages.map((message, index) => <div className={`is-${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}
          </div>
          <div className="product-guide-questions">{quickQuestions.map(question => <button key={question} onClick={() => ask(question)}>{question}</button>)}</div>
          <form onSubmit={event => { event.preventDefault(); ask(input); }}><input value={input} onChange={event => setInput(event.target.value)} placeholder="Scrivi una domanda…" aria-label="Domanda per Lia" /><button type="submit">Invia</button></form>
          <footer><button onClick={() => { setOpen(false); onNavigate?.('articles'); }}>Vai agli articoli</button><a href={siteUrl} target="_blank" rel="noopener">Apri il sito ↗</a></footer>
        </section>
      )}
    </>
  );
}
