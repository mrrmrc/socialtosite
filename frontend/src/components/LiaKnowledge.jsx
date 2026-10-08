import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

export function useLiaKnowledge(site, token) {
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const signature = site ? JSON.stringify([
    site.site_understanding, site.site_understanding_corrections,
    site.profile_summary, site.role_mission, site.content_strategy,
    site.brand_voice_profile, site.rag_knowledge,
  ]) : '';
  const [reviewSignature, setReviewSignature] = useState('');
  useEffect(() => {
    if (!signature || !token) return;
    const controller = new AbortController();
    setBusy(true);
    setReview(null);
    setReviewSignature('');
    setError('');
    apiFetch('/api/index.php?action=lia-profile-review', { method: 'POST', signal: controller.signal, body: '{}' }, token)
      .then(result => { if (!controller.signal.aborted) { setReview(result.review); setReviewSignature(signature); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [signature, token, revision]);
  return { review: reviewSignature === signature ? review : null, busy, error, refresh: () => setRevision(value => value + 1), acceptReview: value => { setReview(value); setReviewSignature(signature); } };
}

export function LiaKnowledge({ knowledge, onSave, onProfile }) {
  const { review, busy, error, refresh } = knowledge;
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const question = review?.fields?.find(field => !['clear','present'].includes(field.status));
  useEffect(() => { setAnswer(''); setSaveError(''); }, [question?.key, question?.value]);
  async function submit(event) {
    event.preventDefault();
    if (!answer.trim() || saving || !question) return;
    setSaving(true); setSaveError('');
    try {
      const value = question.key === 'priority_services' ? answer.split('\n').map(line => line.trim()).filter(Boolean) : answer.trim();
      await onSave({ [question.key]: value });
      setAnswer('');
    } catch (err) { setSaveError(err.message); }
    finally { setSaving(false); }
  }
  const fields = review?.fields || [];
  const clear = fields.filter(field => field.status === 'clear');
  const pending = fields.filter(field => ['present', 'unclear'].includes(field.status));
  const missing = fields.filter(field => field.status === 'missing');
  const complete = review?.reviewed && clear.length === fields.length && fields.length > 0;
  const statusTitle = busy ? 'LIA sta verificando le informazioni disponibili' : complete ? 'Il brief è chiaro. La conoscenza di te resta da aggiornare.' : review?.reviewed ? 'LIA conosce il tuo profilo solo in parte' : 'LIA non ha ancora una conoscenza verificata del tuo profilo';
  const groups = [
    { id: 'clear', title: 'Chiari per LIA', fields: clear, empty: 'Nessun aspetto ancora valutato come chiaro.' },
    { id: 'pending', title: 'Da approfondire o verificare', fields: pending, empty: 'Nessun dato in attesa di chiarimento.' },
    { id: 'missing', title: 'Informazioni mancanti', fields: missing, empty: 'Nessun campo della checklist risulta vuoto.' },
  ];
  return <section className="lia-knowledge" aria-labelledby="lia-knowledge-title" aria-busy={busy}>
    <div className="lia-knowledge-heading">
      <div><span className="section-eyebrow">Conoscenza del tuo profilo</span><h3 id="lia-knowledge-title">Quanto sa davvero LIA di te?</h3>
        <p>LIA si basa su ciò che racconti nell’intervista e sui contenuti acquisiti. I social offrono indizi: non raccontano tutta la tua attività, le tue intenzioni o le tue priorità.</p></div>
      <div className="lia-knowledge-score"><strong>{review?.reviewed ? `${review.score}%` : 'Da verificare'}</strong><span>{review?.reviewed ? 'chiarezza del brief editoriale' : 'comprensione non valutata'}</span></div>
    </div>
    <div className="lia-knowledge-awareness" data-state={complete ? 'complete' : 'partial'} role="status"><span aria-hidden="true">{complete ? '◎' : '?'}</span><div><h4>{statusTitle}</h4><p>{busy ? 'La verifica riguarda la chiarezza del brief, non una conoscenza completa della persona.' : complete ? 'Anche un brief completo non significa che LIA sappia tutto di te. Conferma le proposte e aggiorna il profilo quando cambiano attività, pubblico o obiettivi.' : 'Le proposte possono essere generiche o basarsi su ipotesi che non ti rappresentano. Le tue risposte e correzioni aiutano LIA a capire cosa proporti e perché.'}</p></div></div>
    {review && <>
      <div className="lia-knowledge-meter"><strong>{review.reviewed ? 'Chiarezza dei 10 aspetti editoriali' : 'Dati compilati: non ancora verificati'}</strong><span>{review.reviewed ? `${review.score}%` : `${review.coverage}%`}</span></div>
      <div className="lia-knowledge-track" data-reviewed={review.reviewed ? 'true' : 'false'} role="progressbar" aria-label={review.reviewed ? 'Chiarezza del brief editoriale' : 'Presenza dei dati, comprensione non verificata'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={review.reviewed ? review.score : review.coverage}><span style={{ width: `${review.reviewed ? review.score : review.coverage}%` }} /></div>
      <p className="lia-knowledge-caption">{review.reviewed ? 'Questa percentuale è una stima di LIA sulla chiarezza del brief. Non misura quanto conosce la persona né garantisce la precisione dei contenuti.' : 'Un campo compilato indica soltanto che contiene una risposta. Non dimostra che LIA l’abbia compresa o che sia sufficiente a rappresentarti.'}</p>
      {!busy && <p className="lia-knowledge-review-note">{review.summary}</p>}
      <div className="lia-knowledge-map">{groups.map(group => <article key={group.id} data-status={group.id}><header><strong>{group.title}</strong><span>{group.fields.length}</span></header>{group.fields.length ? <ul>{group.fields.map(field => <li key={field.key}><strong>{field.label}</strong>{field.reason && <small>{field.reason}</small>}</li>)}</ul> : <p>{group.empty}</p>}</article>)}</div>
      {!busy && question && <form className="lia-knowledge-question" onSubmit={submit}><label htmlFor="lia-knowledge-answer"><strong>Aiuta LIA a conoscerti meglio: partiamo da qui</strong><span>{question.question}</span></label>
        {question.value && <p>Risposta attuale: {question.value}</p>}
        <textarea id="lia-knowledge-answer" rows={3} value={answer} maxLength={2000} onChange={event => setAnswer(event.target.value)} placeholder={question.key === 'priority_services' ? 'Una priorità per riga…' : 'Rispondi con un esempio concreto…'} disabled={saving} required />
        <button className="btn btn-primary" disabled={saving || !answer.trim()}>{saving ? 'Salvo la risposta…' : 'Salva e aggiorna il profilo'}</button>
        {saveError && <p role="alert">{saveError}</p>}
      </form>}
    </>}
    <div className="idea-actions"><button className="btn btn-outline" disabled={busy || saving} onClick={refresh}>Verifica il brief con LIA</button><button className="btn btn-ghost" onClick={onProfile}>Completa e correggi il profilo</button></div>
    {error && <p role="alert">{error}</p>}
  </section>;
}