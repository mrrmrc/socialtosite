export function homeCounts(posts) {
  const published = posts.filter(post => Number(post.published) === 1).length;
  const drafts = posts.filter(post => Number(post.published) !== 1);
  const ready = drafts.filter(post => post.seo_score !== null && post.seo_score !== undefined && post.seo_score !== '' && Number(post.seo_score) >= 0 && String(post.edited_title || post.generated_title || '').trim()).length;
  const failed = drafts.filter(post => post.processing_status === 'failed' || String(post.agent_notes || '').startsWith('Errore:')).length;
  return { published, ready, failed, pending: drafts.length - ready };
}

export function homeSuggestion({ data, error, loading, knowledge, syncing, strategy = {}, skipped = false }) {
  if (loading) return { title: 'Un momento, ritrovo il tuo progetto.', message: 'Sto caricando le informazioni per indicarti da dove riprendere.', label: 'Caricamento…', disabled: true };
  if (error || !data) return { title: 'Non riesco a caricare il progetto.', message: 'Riprova tra poco per ritrovare i tuoi contenuti e il prossimo passo.', label: 'Riprova', target: 'retry', note: 'Il caricamento non è riuscito.' };
  const counts = homeCounts(data.posts || []);
  if (counts.ready) return { title: counts.ready === 1 ? 'C’è una bozza da rivedere.' : `Ci sono ${counts.ready} bozze da rivedere.`, message: 'Apri i contenuti, controlla il testo e scegli cosa pubblicare.', label: 'Rivedi le bozze', target: 'site' };
  if (syncing) return { title: 'Sto raccogliendo i tuoi contenuti.', message: 'Puoi restare qui: il riepilogo si aggiorna al termine dell’acquisizione.', label: 'Acquisizione in corso…', disabled: true, note: 'Puoi anche esplorare i contenuti e il sito qui sotto.' };
  if (counts.failed) return { title: 'Un contenuto richiede attenzione.', message: 'La preparazione non è riuscita. Apri i contenuti per controllare il problema e riprovare.', label: 'Controlla i contenuti', target: 'site' };
  if (counts.pending) return { title: 'Controlliamo i contenuti raccolti.', message: 'Ci sono contenuti ancora da preparare. Aprili per vedere a che punto sono e come proseguire.', label: 'Apri i contenuti', target: 'site' };
  const missing = knowledge?.review?.fields?.find(field => field.status === 'missing' || (knowledge.review.reviewed && field.status === 'unclear'));
  const basicProfileMissing = !String(strategy.activity_type || data.site?.profile_summary || data.site?.bio || '').trim();
  if (!skipped && (missing || basicProfileMissing)) return { title: 'Raccontami qualcosa della tua attività.', message: missing?.question || 'Bastano poche risposte per preparare proposte più vicine a ciò che fai. Iniziamo con una domanda.', label: 'Rispondi a LIA', target: 'profile', skippable: true, note: 'Le risposte restano salvate nel tuo profilo.' };
  if (!skipped && !data.sources?.length && !data.posts?.length) return { title: 'Partiamo da un tuo social.', message: 'Aggiungi il link di un profilo pubblico per raccogliere i contenuti da cui iniziare.', label: 'Collega un social', target: 'sources', skippable: true };
  if (data.sources?.length && !data.posts?.length) return { title: 'Raccogliamo i primi contenuti.', message: 'Il social è collegato. Ora possiamo cercare i contenuti da trasformare in bozze.', label: 'Cerca i contenuti', target: 'acquire' };
  return { title: 'Prepariamo qualcosa di nuovo?', message: 'Scegliamo un tema e prepariamo una proposta che potrai leggere e modificare.', label: 'Crea con LIA', target: 'idea' };
}
