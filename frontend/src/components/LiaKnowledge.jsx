import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import { LiaAvatar } from './LiaAvatar';

export function useLiaKnowledge(site, token) {
  const [review, setReview] = useState(null);
  const [exchanges, setExchanges] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const signature = site ? JSON.stringify([
    site.site_understanding, site.site_understanding_corrections,
    site.profile_summary, site.role_mission, site.content_strategy,
    site.brand_voice_profile, site.rag_knowledge,
  ]) : '';
  const [reviewSignature, setReviewSignature] = useState('');
  useEffect(() => { setExchanges([]); setReview(null); setReviewSignature(''); }, [token]);
  useEffect(() => {
    if (!signature || !token) return;
    const controller = new AbortController();
    setBusy(true);
    setReviewSignature('');
    setError('');
    apiFetch('/api/index.php?action=lia-profile-review', { method: 'POST', signal: controller.signal, body: '{}' }, token)
      .then(result => { if (!controller.signal.aborted) { setReview(result.review); setReviewSignature(signature); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [signature, token, revision]);
  return { review: reviewSignature === signature ? review : null, lastReview: review, exchanges, recordExchange: exchange => setExchanges(items => [...items, exchange]), busy, error, refresh: () => setRevision(value => value + 1), acceptReview: value => { setReview(value); setReviewSignature(signature); } };
}

export function LiaKnowledgeBadge({ knowledge, onClick }) {
  const review = knowledge.review;
  const score = !knowledge.busy && review?.reviewed ? review.score : null;
  const ready = !knowledge.busy && knowledge.review?.reviewed && knowledge.review.score === 100;
  const label = knowledge.busy ? 'Sto verificando…' : knowledge.review?.error ? 'Servizio IA non disponibile' : ready ? 'Brief chiaro' : knowledge.review?.reviewed ? 'Qualcosa da chiarire' : 'Dati da verificare';
  return <button type="button" className="lia-dialogue-badge" data-ready={ready} onClick={onClick} title="Apri l’intervista nel tuo profilo" aria-label={`LIA: ${label}. ${score === null ? 'Comprensione non verificata' : `${score}% chiarezza del profilo`}. Apri l’intervista`}><LiaAvatar size={36} knowledge={knowledge} /><span><strong>LIA{score === null ? '' : ` · ${score}%`}</strong><small>{label}</small></span></button>;
}

export function LiaKnowledge({ knowledge, onSave, onProfile }) {
  const { review, busy, error, refresh, exchanges = [], recordExchange } = knowledge;
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fields = review?.fields || [];
  const pending = fields.filter(field => field.status === 'missing' || (review?.reviewed && field.status === 'unclear'));
  const question = pending[0];
  const conversationRef = useRef(null);
  useEffect(() => { if (conversationRef.current) conversationRef.current.scrollTop = conversationRef.current.scrollHeight; }, [exchanges.length, busy, question?.key, review]);
  const score = !busy && review?.reviewed ? review.score : null;
  const complete = review?.reviewed && review.score === 100 && pending.length === 0;
  useEffect(() => { setAnswer(''); setSaveError(''); }, [question?.key, question?.value]);
  async function submit(event) {
    event.preventDefault();
    if (!answer.trim() || saving || busy || !question) return;
    const reply = answer.trim();
    const currentQuestion = question;
    setSaving(true); setSaveError('');
    try {
      const value = currentQuestion.key === 'priority_services' ? reply.split('\n').map(line => line.trim()).filter(Boolean) : reply;
      await onSave({ [currentQuestion.key]: value });
      recordExchange({ question: currentQuestion.question, answer: reply });
      setAnswer('');
      if (reply === currentQuestion.value) refresh();
    } catch (err) { setSaveError(err.message); }
    finally { setSaving(false); }
  }
  const message = busy || saving ? 'Sto rileggendo il profilo. Ti mostrerò la prossima domanda appena la verifica sarà completa.' : complete ? 'Il profilo è chiaro: non ci sono domande da completare. Puoi aggiornare le risposte quando cambia la tua attività.' : !review?.reviewed ? (review?.error?.message || 'La verifica di LIA non è disponibile: le informazioni presenti sono salvate, ma la loro chiarezza non è ancora confermata.') : 'Completiamo il tuo profilo, una domanda alla volta. Le risposte guideranno il sito e i contenuti.';
  return <section className="lia-knowledge lia-dialogue" aria-labelledby="lia-knowledge-title" aria-busy={busy || saving}>
    <header className="lia-dialogue-heading">
      <div><span className="section-eyebrow">Il mio profilo · Intervista</span><h3 id="lia-knowledge-title">LIA ti conosce, una risposta alla volta.</h3><p>Qui definiamo chi sei, cosa offri e a chi ti rivolgi.</p></div>
      <div className="lia-dialogue-progress"><strong>{busy ? 'Verifica in corso' : score === null ? 'Da verificare' : score + '%'}</strong><span>{score === null ? 'comprensione del profilo non confermata' : 'chiarezza del profilo verificata da LIA'}</span>{score !== null && <div className="lia-knowledge-track" data-reviewed="true" role="progressbar" aria-label="Chiarezza del profilo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}><span style={{ width: score + '%' }} /></div>}</div>
    </header>
    <div ref={conversationRef} className="lia-dialogue-messages" role="log" aria-label="Conversazione con LIA" aria-live="polite" aria-relevant="additions text">
      {exchanges.map((exchange, index) => <React.Fragment key={index}><div className="lia-dialogue-message is-lia"><LiaAvatar size={38} knowledge={knowledge} /><div><strong>LIA</strong><p>{exchange.question}</p></div></div><div className="lia-dialogue-message is-user"><div><strong>Tu</strong><p>{exchange.answer}</p></div></div></React.Fragment>)}
      <div className="lia-dialogue-message is-lia"><LiaAvatar size={38} knowledge={knowledge} thinking={busy || saving} /><div><strong>LIA {busy || saving ? <span className="lia-dialogue-thinking">sta pensando…</span> : null}</strong><p>{message}</p>{!busy && !saving && question && <><p className="lia-dialogue-current-question">{question.question}</p>{question.value && <p className="lia-dialogue-context">Mi hai già detto: {question.value}</p>}</>}</div></div>
    </div>
    {question && <form className="lia-dialogue-composer" onSubmit={submit}><label htmlFor="lia-knowledge-answer">La tua risposta a LIA</label><textarea id="lia-knowledge-answer" rows={3} value={answer} maxLength={2000} onChange={event => setAnswer(event.target.value)} placeholder="Raccontamelo con le tue parole…" disabled={saving || busy} required /><div><small>La risposta viene salvata nel tuo profilo.</small><button className="btn btn-primary" disabled={saving || busy || !answer.trim()}>{saving ? 'Invio…' : busy ? 'LIA sta pensando…' : 'Invia a LIA →'}</button></div>{saveError && <p role="alert">{saveError}</p>}</form>}
    <div className="lia-dialogue-details">
      {!busy && !saving && pending.length > 0 && <details><summary>{review?.reviewed ? 'Punti da chiarire' : 'Informazioni mancanti'} ({pending.length})</summary><ul>{pending.map(field => <li key={field.key}><strong>{field.label}</strong><span>{field.status === 'missing' ? 'Da completare' : 'Da precisare'}</span><p>{field.reason || field.question}</p></li>)}</ul></details>}
      {!busy && complete && <p className="lia-profile-complete" role="status">✓ Profilo verificato. Nessun punto da chiarire.</p>}
      {!busy && review && !review.reviewed && <p>{fields.filter(field => field.value).length} informazioni presenti su {fields.length}. La verifica di LIA è ancora da completare.</p>}
      {fields.some(field => field.value) && <details className="lia-profile-answers"><summary>Informazioni già raccolte</summary><ul>{fields.filter(field => field.value).map(field => <li key={field.key}><strong>{field.label}</strong><span>{field.status === 'clear' ? 'Confermato da LIA' : field.status === 'unclear' ? 'Da precisare' : 'Presente · non ancora verificato'}</span><p>{field.value}</p></li>)}</ul></details>}
      {error && <p role="alert">Verifica non riuscita: {error}</p>}
      {review?.error && <details><summary>Informazioni per l’assistenza</summary><p>Codice: {review.error.code}</p>{review.error.reference && <p>Riferimento: {review.error.reference}</p>}{review.runtime?.missing_extensions?.length > 0 && <p>Componenti del server mancanti: {review.runtime.missing_extensions.join(', ')}.</p>}</details>}
      <div className="idea-actions"><button type="button" className="btn btn-outline" disabled={busy || saving} onClick={refresh}>Verifica di nuovo con LIA</button><button type="button" className="btn btn-ghost" onClick={onProfile}>Modifica le risposte del profilo</button></div>
    </div>
  </section>;
}
