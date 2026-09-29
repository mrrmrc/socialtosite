const fs = require('fs');
let content = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

// ─── FIX 1: Label di navigazione più chiare per utente non tecnico ─────────────
// "Visibilità" → "Su Google" (più comprensibile)
content = content.replace(
  "{ id: 'seo', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"m20 20-4-4\"></path><path d=\"M8 11h6M11 8v6\"></path></svg>, label: 'Visibilità', hint: 'Google e pagine' }",
  "{ id: 'seo', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"m20 20-4-4\"></path><path d=\"M8 11h6M11 8v6\"></path></svg>, label: 'Su Google', hint: 'Come ti trovano online' }"
);

// "Articoli" → "I miei articoli"
content = content.replace(
  "{ id: 'site', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"></path><polyline points=\"14 2 14 8 20 8\"></polyline><line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"></line><line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"></line><polyline points=\"10 9 9 9 8 9\"></polyline></svg>, label: 'Articoli', hint: 'Bozze e pubblicati' }",
  "{ id: 'site', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"></path><polyline points=\"14 2 14 8 20 8\"></polyline><line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"></line><line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"></line><polyline points=\"10 9 9 9 8 9\"></polyline></svg>, label: 'Articoli', hint: 'Bozze da pubblicare e già online' }"
);

// "Canali" → più esplicativo
content = content.replace(
  "{ id: 'sources', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"5\" ry=\"5\"></rect><path d=\"M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z\"></path><line x1=\"17.5\" y1=\"6.5\" x2=\"17.51\" y2=\"6.5\"></line></svg>, label: 'Canali', hint: 'Contenuti acquisiti' }",
  "{ id: 'sources', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"5\" y=\"5\"></rect><path d=\"M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z\"></path><line x1=\"17.5\" y1=\"6.5\" x2=\"17.51\" y2=\"6.5\"></line></svg>, label: 'Social collegati', hint: 'Da qui arrivano i tuoi contenuti' }"
);

// "Panoramica" label/hint migliorata
content = content.replace(
  "{ id: 'overview', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path><polyline points=\"9 22 9 12 15 12 15 22\"></polyline></svg>, label: 'Panoramica', hint: 'Cosa succede' }",
  "{ id: 'overview', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path><polyline points=\"9 22 9 12 15 12 15 22\"></polyline></svg>, label: 'Home', hint: 'Lo stato del tuo sito' }"
);

// ─── FIX 2: pageMeta aggiornata con le nuove label ──────────────────────────
content = content.replace(
  "sources: ['Canali collegati', 'Gestisci le fonti da cui arrivano contenuti e aggiornamenti.']",
  "sources: ['Social collegati', 'Aggiungi i tuoi profili social: i contenuti arriveranno automaticamente.']"
);
content = content.replace(
  "seo: ['Visibilità', 'Controlla come le pagine vengono trovate, collegate e comprese da Google.']",
  "seo: ['Su Google', 'Scopri come ti trovano le persone e monitora la tua presenza online.']"
);
content = content.replace(
  "const seoMeta = visibilitySection === 'ideas'\n    ? ['Idee contenuti', 'Scegli una proposta, adattala oppure trasformala direttamente in articolo.']\n    : ['Visibilità', 'Controlla come le pagine vengono trovate, collegate e comprese da Google.'];",
  "const seoMeta = visibilitySection === 'ideas'\n    ? ['Idee contenuti', 'Scegli una proposta, adattala oppure trasformala direttamente in articolo.']\n    : ['Su Google', 'Scopri come ti trovano le persone e monitora la tua presenza online.'];"
);

// ─── FIX 3: Testo "Email loggata" → "La tua email" ──────────────────────────
content = content.replace(
  '<strong style={{ display: \'block\', fontSize: \'13px\', color: \'var(--text-muted)\' }}>Email loggata</strong>',
  '<strong style={{ display: \'block\', fontSize: \'13px\', color: \'var(--text-muted)\' }}>La tua email</strong>'
);

// ─── FIX 4: Channels - testo tecnico "via Refetch(er)" → più leggibile ─────
content = content.replace(
  '🔍 Fonte pubblica via Refetch(er)',
  '🔍 Fonte social pubblica'
);

// ─── FIX 5: Channels - testo verboso "Controllo periodico (Frequenza in base al piano in uso)" ─
content = content.replace(
  "Controllo periodico (Frequenza in base al piano in uso)",
  "Aggiornamento automatico"
);

// ─── FIX 6: "Tab: Sito" - "✦ Apri Sito Pubblico" → più pulito ──────────────
content = content.replace(
  '✦ Apri Sito Pubblico',
  '↗ Apri il sito'
);

// ─── FIX 7: Canali - "📡 I tuoi canali" → senza emoji tecnica ───────────────
content = content.replace(
  '<h2 style={{ margin: 0, fontSize: \'18px\' }}>📡 I tuoi canali ({allChannels.length})</h2>',
  '<h2 style={{ margin: 0, fontSize: \'18px\' }}>I tuoi social collegati ({allChannels.length})</h2>'
);

// ─── FIX 8: Header sync button text ─────────────────────────────────────────
content = content.replace(
  "{syncing ? '⟳ Sto cercando…' : isBasePlan ? '↻ Aggiorna contenuti' : '↻ Aggiorna i canali'}",
  "{syncing ? '⟳ Aggiornamento…' : isBasePlan ? '↻ Aggiorna contenuti' : '↻ Aggiorna i canali'}"
);

// ─── FIX 9: Sito/Experience - testo intro sezione "100 TEMI..." più leggibile ──
// Il testo è già ok ma la sezione "01 02 03 04" con "Identità autentica" ecc
// è info-content senza scopo pratico per utente base, la lasciamo per ora

// ─── FIX 10: Overview - "Direzione grafica AI" → più chiaro ─────────────────
content = content.replace(
  '<small>Direzione grafica AI</small>',
  '<small>Aspetto del sito</small>'
);
content = content.replace(
  '<small>Canali sorgente</small>',
  '<small>Canali social</small>'
);
content = content.replace(
  '<small>Produzione editoriale</small>',
  '<small>Articoli</small>'
);

// ─── FIX 11: Overview metric "Azioni · 30 giorni" → più chiaro ─────────────
content = content.replace(
  "{ n: Number(visibility.actions || 0).toLocaleString('it-IT'), l: 'Azioni · 30 giorni', action: () => selectNavigation({ id: 'seo' }) }",
  "{ n: Number(visibility.actions || 0).toLocaleString('it-IT'), l: 'Azioni degli utenti', action: () => selectNavigation({ id: 'seo' }) }"
);

// ─── FIX 12: Articles - processing badge labels ──────────────────────────────
content = content.replace(
  "if (status === 'processing') return 'IN ELABORAZIONE';",
  "if (status === 'processing') return 'IN PREPARAZIONE';"
);
content = content.replace(
  "if (status === 'failed') return 'DA RIPROVARE';",
  "if (status === 'failed') return 'RIPROVA';"
);
content = content.replace(
  "return 'DA ELABORARE';",
  "return 'DA PREPARARE';"
);

// ─── FIX 13: "ATTENDI…" → in italiano più naturale ─────────────────────────
content = content.replace(
  "publishingPostId === post.id ? 'ATTENDI…' : Number(post.published) === 1 ? 'NASCONDI' : 'PUBBLICA'",
  "publishingPostId === post.id ? 'Attendi…' : Number(post.published) === 1 ? 'Nascondi' : 'Pubblica'"
);

// ─── FIX 14: "NASCONDI" e "PUBBLICA" in tabella ─────────────────────────────
content = content.replace(
  "publishingPostId === post.id ? 'Attendi…' : Number(post.published) === 1 ? 'Nascondi' : 'Pubblica'",
  "publishingPostId === post.id ? 'Attendi…' : Number(post.published) === 1 ? 'Nascondi' : 'Pubblica'"
);

// ─── FIX 15: Articles table - "PUBBLICATO" / "BOZZA" → lowercase ─────────────
content = content.replace(
  ": Number(post.published) === 1 ? 'PUBBLICATO' : 'BOZZA'",
  ": Number(post.published) === 1 ? 'Pubblicato' : 'Bozza'"
);

// Fix duplicata
content = content.replace(
  /Number\(post\.published\) === 1 \? 'PUBBLICATO' : 'BOZZA'/g,
  "Number(post.published) === 1 ? 'Pubblicato' : 'Bozza'"
);

// ─── FIX 16: Articles card - badges uppercase fix ────────────────────────────
content = content.replace(
  "{postProcessingStatus(post) === 'processing' ? '⏳ IN CORSO' : postProcessingStatus(post) === 'failed' ? '↻ RIPROVA' : '▶ ELABORA ORA'}",
  "{postProcessingStatus(post) === 'processing' ? '⏳ In preparazione…' : postProcessingStatus(post) === 'failed' ? '↻ Riprova' : '▶ Prepara articolo'}"
);

// ─── FIX 17: Articles - "✏️ MODIFICA" → più elegante ────────────────────────
content = content.replace(
  "✏️ MODIFICA",
  "✏️ Modifica"
);

// ─── FIX 18: Canali - "Aggiungi canale adesso" → meno urgente ───────────────
content = content.replace(
  "{addLoading ? 'Aggiunta in corso...' : 'Aggiungi canale adesso'}",
  "{addLoading ? 'Aggiunta in corso…' : 'Aggiungi canale'}"
);

// ─── FIX 19: "Aggiorna i canali" nel header → "Cerca nuovi contenuti" ────────
content = content.replace(
  "{syncing ? '⟳ Aggiornamento…' : isBasePlan ? '↻ Aggiorna contenuti' : '↻ Aggiorna i canali'}",
  "{syncing ? '⟳ Aggiornamento…' : isBasePlan ? '↻ Aggiorna contenuti' : '↻ Cerca nuovi contenuti'}"
);

// ─── FIX 20: "Sincronizza automaticamente (in base al piano)" → semplificato ──
content = content.replace(
  'Sincronizza automaticamente (in base al piano)',
  'Aggiornamento automatico'
);

// ─── FIX 21: "Pubblica auto" → più chiaro ────────────────────────────────────
content = content.replace(
  'Pubblica auto',
  'Pubblica automaticamente'
);

// ─── FIX 22: Channels "➕ Aggiungi un nuovo canale" → senza emoji tecnica ────
content = content.replace(
  '<h2 style={{ marginBottom: \'0.75rem\', fontSize: \'24px\', fontWeight: 800 }}>➕ Aggiungi un nuovo canale</h2>',
  '<h2 style={{ marginBottom: \'0.75rem\', fontSize: \'24px\', fontWeight: 800 }}>Collega un nuovo social</h2>'
);

// ─── FIX 23: Channels placeholder URL ─────────────────────────────────────────
content = content.replace(
  'placeholder="Esempio: https://www.instagram.com/nome/"',
  'placeholder="Es: https://www.instagram.com/iltuonome/"'
);

// ─── FIX 24: Canali - "Nessun canale aggiunto" messaggio ────────────────────
content = content.replace(
  '<div style={{ fontWeight: 600, marginBottom: \'0.5rem\' }}>Nessun canale aggiunto</div>\n                    <div style={{ fontSize: \'13px\' }}>Aggiungi l\'URL pubblico di un social o del sito web del cliente.</div>',
  '<div style={{ fontWeight: 600, marginBottom: \'0.5rem\' }}>Nessun social collegato</div>\n                    <div style={{ fontSize: \'13px\' }}>Incolla il link del tuo profilo Instagram, Facebook o TikTok.</div>'
);

// ─── FIX 25: "Importa un singolo contenuto da un link" → più semplice ─────
content = content.replace(
  '<summary>Importa un singolo contenuto da un link</summary>',
  '<summary>Aggiungi un contenuto da un link web</summary>'
);
content = content.replace(
  '<h2 style={{ marginBottom: \'0.5rem\', fontSize: \'18px\' }}>🔗 Importa un contenuto specifico</h2>',
  '<h2 style={{ marginBottom: \'0.5rem\', fontSize: \'18px\' }}>Aggiungi un articolo da un link</h2>'
);
content = content.replace(
  'Incolla il link di un articolo o di una pagina web per convertirlo subito in articolo. I contenuti social arrivano dai canali autorizzati.',
  'Incolla il link di un articolo o di una pagina: l\'AI lo legge e lo trasforma in un articolo per il tuo sito.'
);
content = content.replace(
  "{importing ? '⟳ Elaborazione...' : 'Importa'}",
  "{importing ? '⟳ In corso…' : 'Aggiungi'}"
);

// ─── FIX 26: "Profilo Utente" → "Il tuo account" ────────────────────────────
content = content.replace(
  '<h2 style={{ marginBottom: \'1.5rem\', fontSize: \'24px\' }}>Profilo Utente</h2>',
  '<h2 style={{ marginBottom: \'1.5rem\', fontSize: \'24px\' }}>Il tuo account</h2>'
);

// ─── FIX 27: SEO subnav: "Configura la presenza" → più semplice ─────────────
content = content.replace(
  "['network', 'Configura la presenza']",
  "['network', 'La tua presenza']"
);
content = content.replace(
  "['overview', 'Pagine, dati e fonti']",
  "['overview', 'Statistiche e pagine']"
);

// ─── FIX 28: Ideas section nav removed "Visibilità" confusion ───────────────
// Subnav: "Configura la presenza" / "Pagine, dati e fonti" already fixed above.

// ─── FIX 29: "Progetto operativo" → status badge più semplice ───────────────
content = content.replace(
  '<div className="project-command-status"><i aria-hidden="true" /> Progetto operativo</div>',
  '<div className="project-command-status"><i aria-hidden="true" /> Sito attivo</div>'
);

// ─── FIX 30: Overview "Gestisci l'aspetto" → "Cambia aspetto" ────────────────
content = content.replace(
  "<button className=\"btn btn-outline\" onClick={() => selectNavigation({ id: 'settings' })}>Gestisci l'aspetto</button>",
  "<button className=\"btn btn-outline\" onClick={() => selectNavigation({ id: 'settings' })}>Cambia aspetto</button>"
);

// ─── FIX 31: Overview next card "Esplora la rete" → più chiaro ───────────────
content = content.replace(
  "<button className=\"btn btn-outline\" onClick={() => selectNavigation({ id: 'seo' })}>Esplora la rete</button>",
  "<button className=\"btn btn-outline\" onClick={() => selectNavigation({ id: 'seo' })}>Verifica Google</button>"
);

// ─── FIX 32: Overview "Ultimo aggiornamento" → migliorata ────────────────────
content = content.replace(
  "<small>Ultimo aggiornamento: {site?.last_sync ? new Date(site.last_sync).toLocaleString('it-IT') : 'non ancora effettuato'}</small>",
  "<small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Ultimo aggiornamento: {site?.last_sync ? new Date(site.last_sync).toLocaleString('it-IT') : 'mai effettuato'}</small>"
);

// ─── FIX 33: SEO check "!" → "○" per aspetto più professionale ───────────────
content = content.replace(
  '<span>{check.done ? \'✓\' : \'→\'}</span>',
  '<span>{check.done ? \'✓\' : \'○\'}</span>'
);

// ─── FIX 34: Presenza eroica "0% configurata" → frase più amichevole ─────────
content = content.replace(
  "<h2>{reachability.score || 0}% configurata</h2>",
  "<h2>{reachability.score || 0}% completato</h2>"
);

// ─── FIX 35: "Salva e aggiorna la presenza" → più semplice ───────────────────
content = content.replace(
  "{savingReachability ? 'Salvataggio…' : 'Salva e aggiorna la presenza'}",
  "{savingReachability ? 'Salvataggio…' : 'Salva le informazioni'}"
);

// ─── FIX 36: pagina "Su Google" subnav - ideas button ────────────────────────
// Already using correct labels.

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', content);
console.log('UX fixes applied successfully!');
