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
  return <section className="lia-knowledge" aria-labelledby="lia-knowledge-title" aria-busy={busy}>
    <div className="lia-knowledge-heading">
      <div><span className="section-eyebrow">Supervisione editoriale</span><h3 id="lia-knowledge-title">LIA, quanto conosci il mio profilo?</h3>
        <p>{busy ? 'Sto verificando cosa so, cosa è ancora vago e quali informazioni servono per proporre contenuti utili.' : review?.summary || error || 'La revisione del profilo è da completare.'}</p></div>
      <div className="lia-knowledge-score"><strong>{review?.reviewed ? `${review.score}%` : '—'}</strong><span>{review?.reviewed ? 'conoscenza del profilo' : 'in attesa di verifica'}</span></div>
    </div>
    <p className="lia-knowledge-caption">La percentuale indica la chiarezza di 10 aspetti editoriali secondo LIA: è una stima operativa, aggiornata dopo le tue risposte.</p>
    {review && <><div className="lia-knowledge-track" role="progressbar" aria-label={review.reviewed ? 'Conoscenza del profilo valutata da LIA' : 'Dati presenti, revisione AI non disponibile'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={review.reviewed ? review.score : review.coverage}><span style={{ width: `${review.reviewed ? review.score : review.coverage}%` }} /></div>
      {!review.reviewed && <p>Dati presenti: {review.coverage}%. Revisione AI da completare.</p>}
      <div className="lia-knowledge-fields">{review.fields.map(field => <span key={field.key} title={field.reason || field.value || 'Informazione mancante'} data-status={field.status}>{field.status === 'clear' ? '✓' : field.status === 'present' ? '○' : '?'} {field.label}</span>)}</div>
      {!busy && question && <form className="lia-knowledge-question" onSubmit={submit}><label htmlFor="lia-knowledge-answer"><strong>Per proporti contenuti più precisi, ti chiedo:</strong><span>{question.question}</span></label>
        {question.value && <p>Risposta attuale: {question.value}</p>}
        <textarea id="lia-knowledge-answer" rows={3} value={answer} maxLength={2000} onChange={event => setAnswer(event.target.value)} placeholder={question.key === 'priority_services' ? 'Una priorità per riga…' : 'Rispondi con un esempio concreto…'} disabled={saving} required />
        <button className="btn btn-primary" disabled={saving || !answer.trim()}>{saving ? 'Salvo la risposta…' : 'Salva e aggiorna la conoscenza'}</button>
        {saveError && <p role="alert">{saveError}</p>}
      </form>}
      {review.reviewed && review.score === 100 && <p>Il brief è sufficientemente chiaro per orientare le proposte. Puoi aggiornarlo quando cambiano le tue priorità.</p>}
    </>}
    <div className="idea-actions"><button className="btn btn-outline" disabled={busy || saving} onClick={refresh}>Verifica di nuovo con LIA</button><button className="btn btn-ghost" onClick={onProfile}>Rivedi tutto il profilo</button></div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
