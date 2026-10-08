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
  useEffect(() => { setExchanges([]); setReview(null); }, [token]);
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
  const review = knowledge.review || knowledge.lastReview;
  const score = review ? review.reviewed ? review.score : review.coverage : null;
  const ready = !knowledge.busy && knowledge.review?.reviewed && knowledge.review.score === 100;
  const label = knowledge.busy ? 'Sto verificando…' : ready ? 'Brief chiaro' : knowledge.review?.reviewed ? 'Qualcosa da chiarire' : 'Dati da verificare';
  return <button type="button" className="lia-dialogue-badge" data-ready={ready} onClick={onClick} title="Parla con LIA per chiarire il tuo profilo" aria-label={`LIA: ${label}. ${score === null ? 'Valutazione in corso' : `${score}% ${review?.reviewed ? 'chiarezza del brief' : 'dati presenti, comprensione non verificata'}`}. Apri il dialogo`}><LiaAvatar size={36} knowledge={knowledge} /><span><strong>LIA · {score === null ? '…' : `${score}%`}</strong><small>{label}</small></span></button>;
}

export function LiaKnowledge({ knowledge, onSave, onProfile }) {
  const { review, lastReview, busy, error, refresh, exchanges = [], recordExchange } = knowledge;
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const question = review?.fields?.find(field => !['clear', 'present'].includes(field.status));
  const conversationRef = useRef(null);
  useEffect(() => { if (conversationRef.current) conversationRef.current.scrollTop = conversationRef.current.scrollHeight; }, [exchanges.length, busy, question?.key, review]);
  const visibleReview = review || lastReview;
  const score = visibleReview ? visibleReview.reviewed ? visibleReview.score : visibleReview.coverage : null;
  const complete = review?.reviewed && review.score === 100;
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
  const message = busy || saving ? 'Grazie, sto rileggendo il profilo per capire se la risposta chiarisce questo punto. Poi ti dirò come proseguire.' : complete ? 'Il brief è chiaro per orientare le proposte. Aggiornami quando cambiano le tue priorità: avere un brief completo non significa sapere tutto di te.' : !review?.reviewed ? 'Non ho ancora verificato se le informazioni mi bastano per capirti bene. Possiamo intanto completare ciò che manca, una risposta alla volta.' : exchanges.length ? 'Ho riletto il profilo con la tua risposta. Approfondiamo il prossimo punto per rendere le proposte più precise.' : 'Ho letto il tuo profilo, ma alcuni punti non mi sono ancora chiari. Parliamone: ti chiedo una cosa alla volta.';
  return <section className="lia-knowledge lia-dialogue" aria-labelledby="lia-knowledge-title" aria-busy={busy}>
    <header className="lia-dialogue-heading"><div><span className="section-eyebrow">Un dialogo per conoscerti meglio</span><h3 id="lia-knowledge-title">Facciamo chiarezza, insieme.</h3><p>Rispondi a LIA: rilegge il profilo e aggiorna la valutazione dopo ogni risposta.</p></div><div className="lia-dialogue-progress"><strong>{score === null ? '…' : `${score}%`}</strong><span>{visibleReview?.reviewed ? 'chiarezza del brief' : 'dati presenti · da verificare'}</span><div className="lia-knowledge-track" data-reviewed={visibleReview?.reviewed ? 'true' : 'false'} role="progressbar" aria-label={visibleReview?.reviewed ? 'Chiarezza del brief' : 'Dati presenti, comprensione non verificata'} aria-valuemin={0} aria-valuemax={100} {...(score === null ? {} : { 'aria-valuenow': score })}><span style={{ width: `${score || 0}%` }} /></div></div></header>
    <div ref={conversationRef} className="lia-dialogue-messages" role="log" aria-label="Conversazione con LIA" aria-live="polite" aria-relevant="additions text">
      {exchanges.map((exchange, index) => <React.Fragment key={index}><div className="lia-dialogue-message is-lia"><LiaAvatar size={38} knowledge={knowledge} thinking={busy || saving} /><div><strong>LIA</strong><p>{exchange.question}</p></div></div><div className="lia-dialogue-message is-user"><div><strong>Tu</strong><p>{exchange.answer}</p></div></div></React.Fragment>)}
      <div className="lia-dialogue-message is-lia"><LiaAvatar size={38} knowledge={knowledge} thinking={busy || saving} /><div><strong>LIA {busy || saving ? <span className="lia-dialogue-thinking">sta pensando…</span> : null}</strong><p>{message}</p>{!busy && !saving && question && <><p className="lia-dialogue-current-question">{question.question}</p>{question.value && <p className="lia-dialogue-context">Mi hai già detto: {question.value}</p>}</>}{!busy && !saving && !question && !complete && review && <p>Le risposte sono presenti. Per valutare la chiarezza devo completare la verifica: puoi riprovare oppure rivedere il profilo.</p>}</div></div>
    </div>
    <form className="lia-dialogue-composer" onSubmit={submit}><label htmlFor="lia-knowledge-answer">La tua risposta a LIA</label><textarea id="lia-knowledge-answer" rows={3} value={answer} maxLength={2000} onChange={event => setAnswer(event.target.value)} placeholder={busy || saving ? 'LIA sta verificando la risposta…' : complete ? 'Il brief è chiaro: puoi aggiornare le informazioni dal profilo.' : !question ? 'Attendi la verifica di LIA oppure riprova.' : 'Raccontamelo con le tue parole…'} disabled={saving || busy || !question} required /><div><small>La risposta viene salvata nel tuo profilo.</small><button className="btn btn-primary" disabled={saving || busy || !question || !answer.trim()}>{saving ? 'Invio…' : busy ? 'LIA sta pensando…' : 'Invia a LIA →'}</button></div>{saveError && <p role="alert">{saveError}</p>}</form>
    <details className="lia-dialogue-details"><summary>Cosa deve ancora chiarire LIA?</summary><p>La percentuale misura la chiarezza del brief secondo LIA. Se la verifica non è disponibile, indica soltanto i dati presenti.</p>{review && <ul>{review.fields.map(field => <li key={field.key}><strong>{field.label}</strong><span>{field.status === 'clear' ? 'Chiaro per LIA' : field.status === 'missing' ? 'Da raccontare' : 'Da verificare o approfondire'}</span>{field.reason && <p>{field.reason}</p>}</li>)}</ul>}{error && <p role="alert">{error}</p>}<div className="idea-actions"><button type="button" className="btn btn-outline" disabled={busy || saving} onClick={refresh}>Riprova la verifica con LIA</button><button type="button" className="btn btn-ghost" onClick={onProfile}>Rivedi il profilo</button></div></details>
  </section>;
}