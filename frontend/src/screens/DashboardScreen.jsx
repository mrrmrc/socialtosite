import React, { useState, useEffect, useDeferredValue } from 'react';
import { apiFetch, SOCIAL, SITE_LAYOUTS, detectPlatformFromUrl, PLATFORM_DESCRIPTIONS } from '../utils/api';
import { SocialIcon } from '../components/SocialIcon';
import { QuillEditor } from '../components/QuillEditor';
import { AdminScreen } from './AdminScreen';
import { SpazioVivoLab } from '../components/SpazioVivoLab';
import { ProductGuide } from '../components/ProductGuide';

const STUDIO_DEFAULTS = {
  font_heading: 'Outfit',
  font_body: 'Inter',
  color_palette: {
    background: '#f8fafc',
    surface: '#ffffff',
    text: '#16202a',
    text_muted: '#64748b',
    primary: '#2563eb',
    secondary: '#dbe8ff',
    primary_gradient: 'linear-gradient(135deg, #4f8cff, #1d4ed8)',
  },
  ui_style: {
    radius: '16px',
    card_shadow: '0 10px 30px rgba(15,23,42,0.08)',
    glassmorphism: false,
  },
  layout_recipe: {
    hero: 'product',
    nav: 'solid',
    cards: 'product',
    density: 'balanced',
  },
  base_models: ['tech-clarity'],
  custom_css: '',
  design_archetype: 'tech-clarity',
};

function postProcessingStatus(post) {
  if (Number(post?.seo_score) >= 0) return 'done';
  if (post?.processing_status) return post.processing_status;
  return String(post?.agent_notes || '').startsWith('Errore:') ? 'failed' : 'pending';
}

function postProcessingLabel(post) {
  const status = postProcessingStatus(post);
  if (status === 'processing') return 'IN ELABORAZIONE';
  if (status === 'failed') return 'DA RIPROVARE';
  return 'DA ELABORARE';
}

const EDITORIAL_AGENT_META = {
  content_editor: { icon: '✍️', title: 'Content Editor', role: 'Riscrive i singoli contenuti social in articoli.' },
  topical_authority_architect: { icon: '🧠', title: 'Topical Authority', role: 'Produce articoli piu esperti, contrarian e orientati alla topical authority.' },
  chief_editor: { icon: '🗂️', title: 'Chief Editor', role: 'Orchestra categorie, menu, articolo featured e tagline.' },
  editorial_engine: { icon: '⚙️', title: 'Editorial Engine', role: 'Analizza il corpus e decide cluster, gap, priorita e prossime mosse.' },
  seo_specialist: { icon: '🔎', title: 'SEO Specialist', role: 'Costruisce title, bio, menu e struttura SEO del sito.' },
  site_ai: { icon: '🏗️', title: 'Site AI', role: 'Compone identita, design e configurazione complessiva del sito.' },
};

const STRATEGY_GOALS = [
  ['bookings', 'Ricevere prenotazioni'],
  ['contacts', 'Ottenere contatti'],
  ['store_visits', 'Portare persone in sede'],
  ['sales', 'Vendere prodotti o servizi'],
  ['awareness', 'Aumentare la notoriet\u00e0'],
  ['events', 'Promuovere eventi'],
];

const PLATFORM_PLANS = [
  {
    name: 'Base',
    price: '€50/anno',
    description: 'Vetrina automatizzata essenziale.',
    deliverables: [
      'Generazione automatica sito vetrina',
      'Acquisizione da 1 Canale Social',
      'Fino a 10 articoli elaborati al mese',
      'Ottimizzazione SEO Base automatica'
    ],
  },
  {
    name: 'Pro',
    price: '€150/anno',
    description: 'Il piano ideale per crescere senza sforzo.',
    deliverables: [
      'Acquisizione fino a 5 Canali Social',
      'Elaborazione fino a 50 articoli/mese',
      'Motore AI (Topical Authority e Idee)',
      'Design Avanzato personalizzabile'
    ],
    featured: true,
  },
  {
    name: 'Agency',
    price: '€500/anno',
    description: 'Gestione per agenzie e multi-cliente.',
    deliverables: [
      'Dashboard gestione clienti',
      'Assegnazione piani Base/Pro ai clienti',
      'Pacchetto licenze incluso'
    ],
  },
];

function normalizeStudioData(raw, selectedTheme = 'tech-clarity') {
  const preset = SITE_LAYOUTS.find(layout => layout.id === selectedTheme) || SITE_LAYOUTS[0];
  const source = raw && typeof raw === 'object' ? raw : {};
  const palette = source.color_palette || {};
  const uiStyle = source.ui_style || {};
  const recipe = source.layout_recipe || {};
  const baseModels = Array.isArray(source.base_models)
    ? source.base_models
    : source.base_models ? [source.base_models] : (preset?.base_models || STUDIO_DEFAULTS.base_models);

  return {
    design_archetype: source.design_archetype || preset?.id || selectedTheme || STUDIO_DEFAULTS.design_archetype,
    font_heading: source.font_heading || preset?.font_heading || STUDIO_DEFAULTS.font_heading,
    font_body: source.font_body || preset?.font_body || STUDIO_DEFAULTS.font_body,
    color_palette: {
      background: palette.background || palette.bg || preset?.color_palette?.background || STUDIO_DEFAULTS.color_palette.background,
      surface: palette.surface || preset?.color_palette?.surface || STUDIO_DEFAULTS.color_palette.surface,
      text: palette.text || preset?.color_palette?.text || STUDIO_DEFAULTS.color_palette.text,
      text_muted: palette.text_muted || preset?.color_palette?.text_muted || STUDIO_DEFAULTS.color_palette.text_muted,
      primary: palette.primary || source.accent_color || preset?.color_palette?.primary || STUDIO_DEFAULTS.color_palette.primary,
      secondary: palette.secondary || preset?.color_palette?.secondary || STUDIO_DEFAULTS.color_palette.secondary,
      primary_gradient: palette.primary_gradient || preset?.color_palette?.primary_gradient || STUDIO_DEFAULTS.color_palette.primary_gradient,
    },
    ui_style: {
      radius: uiStyle.radius || preset?.ui_style?.radius || STUDIO_DEFAULTS.ui_style.radius,
      card_shadow: uiStyle.card_shadow || preset?.ui_style?.card_shadow || STUDIO_DEFAULTS.ui_style.card_shadow,
      glassmorphism: typeof uiStyle.glassmorphism === 'boolean' ? uiStyle.glassmorphism : (preset?.ui_style?.glassmorphism ?? STUDIO_DEFAULTS.ui_style.glassmorphism),
    },
    layout_recipe: {
      hero: recipe.hero || preset?.layout_recipe?.hero || STUDIO_DEFAULTS.layout_recipe.hero,
      nav: recipe.nav || preset?.layout_recipe?.nav || STUDIO_DEFAULTS.layout_recipe.nav,
      cards: recipe.cards || preset?.layout_recipe?.cards || STUDIO_DEFAULTS.layout_recipe.cards,
      density: recipe.density || preset?.layout_recipe?.density || STUDIO_DEFAULTS.layout_recipe.density,
    },
    base_models: baseModels.slice(0, 2),
    custom_css: source.custom_css || '',
  };
}

function encodeStudioPreviewData(data) {
  try {
    const json = JSON.stringify(data || {});
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  } catch (error) {
    console.error('Errore serializzazione preview studio:', error);
    return '';
  }
}

function buildEditorialIdeas(posts, understanding, visibility = {}) {
  const published = posts.filter(post => Number(post.published) === 1);
  const searchableText = published.map(post => `${post.generated_title || ''} ${(post.tags || []).join(' ')}`.toLowerCase()).join(' ');
  const pillars = understanding?.editorial_direction?.content_pillars || [];
  const declared = understanding?.declared_strategy || {};
  const visualAssets = published.filter(post => post.media_url).length;
  const topQuery = [...(visibility.top_queries || [])]
    .filter(query => Number(query.impressions) >= 20)
    .sort((a, b) => {
      const scoreA = Number(a.impressions) * (1 - Math.min(Number(a.ctr || 0), 100) / 100);
      const scoreB = Number(b.impressions) * (1 - Math.min(Number(b.ctr || 0), 100) / 100);
      return scoreB - scoreA;
    })[0];
  const ideas = [];

  if (topQuery) {
    ideas.push({
      title: `Rispondi alla ricerca “${topQuery.query_text}”`,
      reason: `Google ha già mostrato questa ricerca ${Number(topQuery.impressions).toLocaleString('it-IT')} volte: sviluppala in un contenuto completo, con una risposta chiara e una call to action pertinente.`,
      type: 'Domanda reale su Google',
      priority: 'Da creare subito',
      source: 'Dati Google degli ultimi 30 giorni',
    });
  }

  if (declared.primary_audience) {
    const audienceLabel = String(declared.primary_audience).split(/[.,;]/)[0].slice(0, 80);
    ideas.push({
      title: `Una guida pensata per ${audienceLabel}`,
      reason: `Il pubblico prioritario dichiarato non emerge dai social in modo affidabile: questo contenuto lo intercetta esplicitamente.`,
      type: 'Pubblico prioritario',
      priority: 'Alta priorità',
      source: 'Profilo guidato',
    });
  }

  (declared.priority_services || []).slice(0, 2).forEach(service => {
    ideas.push({
      title: `${service}: guida completa, vantaggi e domande frequenti`,
      reason: 'Hai indicato questo servizio come prioritario: merita una pagina capace di essere trovata e di portare all\u2019azione.',
      type: 'Obiettivo commerciale',
      priority: 'Alta priorità',
      source: 'Servizi prioritari',
    });
  });

  if (declared.geographic_area) {
    ideas.push({
      title: `Come scegliere il servizio giusto a ${declared.geographic_area}`,
      reason: 'Un contenuto locale stabile collega offerta, territorio e domande concrete delle persone che si trovano nella tua area.',
      type: 'Visibilità locale',
      priority: 'Consigliata',
      source: 'Territorio dichiarato',
    });
  }

  if (visualAssets > 0) {
    ideas.push({
      title: 'Dietro le quinte: una storia costruita con le tue immagini migliori',
      reason: `Hai già ${visualAssets} foto o video pubblicati: trasformali in un racconto utile che resti consultabile e non scompaia nel flusso social.`,
      type: 'Idea visuale',
      priority: 'Pronta da sviluppare',
      source: 'Media già disponibili',
    });
  }

  pillars.forEach((pillar, index) => {
    const words = String(pillar).toLowerCase().split(/\s+/).filter(word => word.length > 4);
    const covered = words.some(word => searchableText.includes(word));
    if (!covered || index < 2) {
      ideas.push({
        title: `Una guida pratica su “${pillar}”`,
        reason: covered ? 'Tema importante da approfondire con un nuovo punto di vista.' : 'Tema riconosciuto dall’AI ma ancora poco coperto nel sito.',
        type: covered ? 'Approfondimento' : 'Tema mancante',
        priority: covered ? 'Da approfondire' : 'Alta priorità',
        source: 'Analisi dei contenuti',
      });
    }
  });

  (understanding?.editorial_direction?.critical_unknowns || []).slice(0, 2).forEach(item => {
    ideas.push({ title: `Rispondi chiaramente a: ${item}`, reason: 'Chiarire questo punto aiuta clienti e AI a capire meglio l’attività.', type: 'Domanda cliente', priority: 'Consigliata', source: 'Informazioni ancora mancanti' });
  });

  if (published.length < 8) ideas.push({ title: 'Racconta il servizio più richiesto con un caso concreto', reason: 'Il sito ha ancora pochi contenuti: un esempio reale aumenta completezza e fiducia.', type: 'Caso reale', priority: 'Alta priorità', source: 'Copertura del sito' });
  ideas.push({ title: 'Le 5 domande che i clienti fanno prima di scegliere', reason: 'Un contenuto utile intercetta dubbi reali e crea nuovi collegamenti interni.', type: 'Sempre utile', priority: 'Evergreen', source: 'Formato ad alta utilità' });

  const seenTitles = new Set();
  return ideas.filter(idea => {
    const key = idea.title.toLowerCase().trim();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  }).slice(0, 8);
}

function editorialIdeaKey(idea) {
  return [idea?.title, idea?.type, idea?.source]
    .map(value => String(value || '').trim().toLocaleLowerCase('it-IT').replace(/\s+/g, ' '))
    .join('|');
}

function strategyCompletion(understanding) {
  const strategy = understanding?.declared_strategy || {};
  const required = [
    strategy.activity_type,
    strategy.offer_summary,
    strategy.primary_goal,
    strategy.primary_audience,
    strategy.geographic_area,
    strategy.priority_services?.length,
    strategy.differentiators,
    strategy.desired_action,
  ];
  return Math.round((required.filter(Boolean).length / required.length) * 100);
}

function prefillStrategyFromAi(understanding) {
  if (!understanding || typeof understanding !== 'object') return understanding;
  const current = understanding.declared_strategy || {};
  const aiServices = (understanding.editorial_direction?.content_pillars || []).filter(Boolean).slice(0, 6);
  return {
    ...understanding,
    declared_strategy: {
      ...current,
      activity_type: current.activity_type || understanding.vertical_label || '',
      offer_summary: current.offer_summary || understanding.business_model || '',
      primary_audience: current.primary_audience || understanding.audience || '',
      geographic_area: current.geographic_area || understanding.geographic_area || understanding.local_area || '',
      priority_services: [...new Set([...(current.priority_services || []), ...aiServices])],
      differentiators: current.differentiators || understanding.differentiators || understanding.value_proposition || '',
      customer_needs: current.customer_needs || understanding.customer_needs || '',
    },
  };
}

function GuidedStrategy({
  understanding, declared, progress, step, setStep, updateField, updateList,
  save, saving, refresh, refreshing, logoUrl, uploadLogo, uploadingLogo, sourcesCount,
}) {
  const steps = [
    { title: 'Identità', hint: 'Conferma chi sei e cosa offri' },
    { title: 'Obiettivo', hint: 'Scegli il risultato più importante' },
    { title: 'Pubblico', hint: 'Indica chi e dove vuoi raggiungere' },
    { title: 'Differenza', hint: 'Spiega perché scegliere te' },
  ];
  const inferredActivity = understanding?.vertical_label || '';
  const inferredOffer = understanding?.business_model || '';
  const inferredAudience = understanding?.audience || '';
  const socialSummary = [inferredActivity, inferredOffer].filter(Boolean).join(' · ');
  const logoIsFallback = String(logoUrl || '').includes('profile_logo_fallback');
  const hasConfirmedLogo = !!logoUrl && !logoIsFallback;
  const [servicesText, setServicesText] = useState(() => (declared.priority_services || []).join('\n'));
  const next = () => setStep(current => Math.min(steps.length - 1, current + 1));
  const previous = () => setStep(current => Math.max(0, current - 1));
  const useSuggestion = (key, value) => value && updateField(key, value);

  return <section className="guided-strategy" id="strategy" aria-labelledby="guided-strategy-title">
    <div className="guided-strategy__intro">
      <div>
        <span className="guided-eyebrow">Configurazione assistita</span>
        <h2 id="guided-strategy-title">Noi analizziamo. Tu confermi.</h2>
        <p>Non devi inventare una strategia da zero. Abbiamo già letto i tuoi canali: ti mostriamo ciò che abbiamo capito e ti chiediamo solo le informazioni che i social non possono conoscere.</p>
      </div>
      <div className="guided-score" style={{ '--score': `${progress}%` }} aria-label={`Profilo completo al ${progress}%`}>
        <strong>{progress}%</strong><span>profilo pronto</span>
      </div>
    </div>

    <div className="guided-auto-panel">
      <div className="guided-logo-box">
        <div className="guided-logo-preview">
          {logoUrl ? <img src={logoUrl} alt="Logo dell’attività" /> : <span>{(inferredActivity || 'A').slice(0, 1).toUpperCase()}</span>}
        </div>
        <div>
          <span className={`guided-status ${hasConfirmedLogo ? 'is-ready' : 'is-needed'}`}>{hasConfirmedLogo ? '✓ Recuperato dai social' : logoIsFallback ? '! Immagine da confermare' : '! Non trovato sui social'}</span>
          <strong>Logo identificativo</strong>
          <small>{hasConfirmedLogo ? 'È già usato nello Spazio Vivo. Puoi sostituirlo quando vuoi.' : logoIsFallback ? 'Abbiamo trovato una copertina, non un logo certo. Sostituiscila con il marchio corretto.' : 'Facebook non ha restituito un’immagine utilizzabile. Caricane una tu.'}</small>
          <label className="guided-upload">
            {uploadingLogo ? 'Caricamento…' : logoUrl ? 'Sostituisci logo' : 'Carica logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} disabled={uploadingLogo} />
          </label>
        </div>
      </div>
      <div className="guided-ai-summary">
        <span className="guided-status is-ready">✓ Fatto automaticamente</span>
        <strong>Abbiamo analizzato {sourcesCount || 'i'} canal{sourcesCount === 1 ? 'e' : 'i'}</strong>
        <p>{socialSummary || 'Stiamo costruendo la prima lettura della tua attività dai contenuti importati.'}</p>
        <button type="button" className="guided-text-button" onClick={refresh} disabled={refreshing}>{refreshing ? 'Analisi in corso…' : 'Rileggi i social'}</button>
      </div>
    </div>

    <nav className="guided-steps" aria-label="Passaggi del profilo">
      {steps.map((item, index) => <button key={item.title} type="button" onClick={() => setStep(index)} className={index === step ? 'is-active' : index < step ? 'is-done' : ''} aria-current={index === step ? 'step' : undefined}>
        <span>{index < step ? '✓' : index + 1}</span><b>{item.title}</b><small>{item.hint}</small>
      </button>)}
    </nav>

    <div className="guided-step-card">
      <div className="guided-step-heading"><span>PASSAGGIO {step + 1} DI {steps.length}</span><h3>{steps[step].hint}</h3><p>I campi con “nostra proposta” sono già stati dedotti: confermali oppure correggili.</p></div>

      {step === 0 && <div className="guided-fields two-columns">
        <label><span>Che tipo di attività sei? <em>Nostra proposta</em></span><input value={declared.activity_type || ''} onChange={e => updateField('activity_type', e.target.value)} placeholder={inferredActivity || 'Es. Agriturismo con ristorante'} />{!declared.activity_type && inferredActivity && <button type="button" onClick={() => useSuggestion('activity_type', inferredActivity)}>Usa “{inferredActivity}”</button>}</label>
        <label><span>Cosa offri concretamente? <em>Nostra proposta</em></span><input value={declared.offer_summary || ''} onChange={e => updateField('offer_summary', e.target.value)} placeholder={inferredOffer || 'Es. Soggiorni, cucina locale ed eventi'} />{!declared.offer_summary && inferredOffer && <button type="button" onClick={() => useSuggestion('offer_summary', inferredOffer)}>Usa la proposta</button>}</label>
      </div>}

      {step === 1 && <div className="guided-fields">
        <div><span className="guided-field-label">Qual è il risultato più importante? <em>Serve la tua scelta</em></span><div className="guided-choice-grid">{STRATEGY_GOALS.map(([value, label]) => <button key={value} type="button" onClick={() => updateField('primary_goal', value)} className={declared.primary_goal === value ? 'is-selected' : ''}>{declared.primary_goal === value ? '✓ ' : ''}{label}</button>)}</div></div>
        <label><span>Quale azione deve compiere una persona? <em>Serve la tua risposta</em></span><input value={declared.desired_action || ''} onChange={e => updateField('desired_action', e.target.value)} placeholder="Es. Chiedere disponibilità su WhatsApp" /></label>
      </div>}

      {step === 2 && <div className="guided-fields two-columns">
        <label><span>Chi vuoi raggiungere prima di tutti? <em>Serve la tua conferma</em></span><textarea value={declared.primary_audience || ''} onChange={e => updateField('primary_audience', e.target.value)} placeholder={inferredAudience || 'Es. Coppie e famiglie di Roma interessate a weekend nella natura'} />{!declared.primary_audience && inferredAudience && <button type="button" onClick={() => useSuggestion('primary_audience', inferredAudience)}>Usa la proposta</button>}</label>
        <label><span>In quale territorio? <em>Serve la tua risposta</em></span><input value={declared.geographic_area || ''} onChange={e => updateField('geographic_area', e.target.value)} placeholder="Es. Roma, Lazio e Centro Italia" /></label>
        <label className="full"><span>C’è anche un secondo pubblico? <i>Facoltativo</i></span><input value={declared.secondary_audience || ''} onChange={e => updateField('secondary_audience', e.target.value)} placeholder="Es. Aziende che cercano una location per eventi" /></label>
      </div>}

      {step === 3 && <div className="guided-fields two-columns">
        <label><span>Quali offerte vuoi rendere più visibili? <em>Una per riga · precompilato dall’AI</em></span><textarea value={servicesText} onChange={e => { setServicesText(e.target.value); updateList('priority_services', e.target.value); }} placeholder={'Soggiorni weekend\nRistorante\nEventi privati'} /><small className="guided-field-help">Premi Invio dopo ogni voce. Puoi correggere, aggiungere o cancellare liberamente.</small></label>
        <label><span>Perché dovrebbero scegliere te? <em>Serve la tua voce</em></span><textarea value={declared.differentiators || ''} onChange={e => updateField('differentiators', e.target.value)} placeholder="Es. A 30 minuti da Roma, cucina autentica, contatto diretto con i proprietari" /></label>
        <label className="full"><span>Quali dubbi fanno esitare i clienti? <i>Facoltativo</i></span><textarea value={declared.customer_needs || ''} onChange={e => updateField('customer_needs', e.target.value)} placeholder="Es. Se è adatto ai bambini, cosa comprende il prezzo, quanto dista da Roma" /></label>
      </div>}

      <div className="guided-actions">
        <button type="button" className="btn btn-outline" onClick={previous} disabled={step === 0}>Indietro</button>
        <span>Le modifiche vengono salvate soltanto alla fine.</span>
        {step < steps.length - 1
          ? <button type="button" className="btn btn-primary" onClick={next}>Continua →</button>
          : <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvataggio…' : 'Conferma e attiva il profilo'}</button>}
      </div>
    </div>
  </section>;
}

function SiteMapGraph({ posts, siteUrl, siteTitle, foundationPages = [] }) {
  const visiblePosts = posts.filter(post => Number(post.published) === 1).slice(0, 6);
  const positions = [[105,365],[235,365],[365,365],[495,365],[625,365],[755,365]];
  const topicCounts = {};
  visiblePosts.forEach(post => (post.tags || []).forEach(tag => { topicCounts[tag] = (topicCounts[tag] || 0) + 1; }));
  const topTopics = Object.entries(topicCounts).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([label]) => label);
  const graphLabels = foundationPages.length ? foundationPages.slice(0, 4).map(page => page.title) : topTopics;
  const topicPositions = graphLabels.map((label, index) => ({ label, x: 235 + (index * 130) }));
  const short = value => String(value || 'Articolo').replace(/\s+/g, ' ').slice(0, 24);
  return (
    <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
      <svg viewBox="0 0 860 445" role="img" aria-label="Grafo dei collegamenti dal dominio LinkSeoWeb allo Spazio Vivo, ai temi e ai suoi contenuti" style={{ width: '100%', minWidth: '690px', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="graphRoot" x1="0" x2="1"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#06b6d4"/></linearGradient>
          <filter id="graphShadow"><feDropShadow dx="0" dy="5" stdDeviation="7" floodOpacity="0.13"/></filter>
        </defs>
        <path d="M430 82 L430 142" stroke="var(--border-strong)" strokeWidth="3" />
        {graphLabels.length === 0 && visiblePosts.length > 0 && <path d="M430 224 L430 312" stroke="var(--border-strong)" strokeWidth="2" />}
        {topicPositions.map(topic => <path key={topic.label} d={`M430 224 C430 250 ${topic.x} 242 ${topic.x} 276`} fill="none" stroke="var(--primary)" strokeOpacity=".55" strokeWidth="2" />)}
        {positions.slice(0, visiblePosts.length).map(([x], index) => { const postTags=visiblePosts[index]?.tags || []; const parent=foundationPages.length ? topicPositions[index % Math.max(topicPositions.length, 1)] : topicPositions.find(topic => postTags.includes(topic.label)); const fromX=parent?.x || 430; return <path key={index} d={`M${fromX} 312 C${fromX} 334 ${x} 326 ${x} 350`} fill="none" stroke="var(--border-strong)" strokeWidth="2" />; })}
        <g filter="url(#graphShadow)"><rect x="310" y="22" width="240" height="60" rx="18" fill="url(#graphRoot)"/><text x="430" y="48" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800">LINKSEOWEB</text><text x="430" y="67" textAnchor="middle" fill="rgba(255,255,255,.82)" fontSize="11">Hub pubblico /scopri</text></g>
        <g filter="url(#graphShadow)"><rect x="285" y="142" width="290" height="82" rx="20" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2"/><text x="430" y="174" textAnchor="middle" fill="var(--text)" fontSize="17" fontWeight="800">{short(siteTitle || 'Spazio Vivo')}</text><text x="430" y="198" textAnchor="middle" fill="var(--text-muted)" fontSize="12">{siteUrl.replace(window.location.origin, '')}</text></g>
        {topicPositions.map(topic => <g key={topic.label}><rect x={topic.x-58} y="276" width="116" height="36" rx="18" fill="var(--primary-light)" stroke="var(--primary)"/><text x={topic.x} y="299" textAnchor="middle" fill="var(--primary)" fontSize="10" fontWeight="800">{short(topic.label).slice(0,19)}</text></g>)}
        {visiblePosts.map((post, index) => { const [x,y]=positions[index]; return <g key={post.id}><rect x={x-56} y={y-15} width="112" height="58" rx="14" fill="var(--bg)" stroke="var(--border-strong)"/><text x={x} y={y+7} textAnchor="middle" fill="var(--text)" fontSize="10" fontWeight="700"><tspan x={x}>{short(post.generated_title).slice(0,16)}</tspan><tspan x={x} dy="14">{short(post.generated_title).slice(16,32)}</tspan></text></g> })}
        {visiblePosts.length === 0 && <text x="430" y="350" textAnchor="middle" fill="var(--text-muted)" fontSize="14">I prossimi articoli compariranno qui</text>}
      </svg>
      <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>Le linee rappresentano collegamenti HTML percorribili da persone e motori di ricerca.</p>
    </div>
  );
}

export function DashboardScreen({ token, user, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [visibilitySection, setVisibilitySection] = useState('network');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardFilter, setDashboardFilter] = useState('all');
  const [data, setData] = useState(null);
  const [adminSeoStats, setAdminSeoStats] = useState([]);
  const isAdmin = user?.role === 'admin';

  const [viewMode, setViewMode] = useState('grid');
  const [selectedPosts, setSelectedPosts] = useState([]);
  const [publishingPostId, setPublishingPostId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [importing, setImporting] = useState(false);
const [importMsg, setImportMsg] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [harmonizingId, setHarmonizingId] = useState(0);
  const [sourceForm, setSourceForm] = useState({ label: '', url: '', platform: '' });
  const [sourceMsg, setSourceMsg] = useState(null);
  const [addUrl, setAddUrl] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [addMsg, setAddMsg] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [repairingMedia, setRepairingMedia] = useState(false);
  const [scanMsg, setScanMsg] = useState(null);
  const [scanProgress, setScanProgress] = useState([]);
  const [processingQueue, setProcessingQueue] = useState([]);
  const [syncMsg, setSyncMsg] = useState(null);
  const [acquisitionModal, setAcquisitionModal] = useState(null);
  const [profileDraft, setProfileDraft] = useState('');
  const [roleMissionDraft, setRoleMissionDraft] = useState('');
  const [strategyDraft, setStrategyDraft] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('classic');
    const [previewingTheme, setPreviewingTheme] = useState(null);
    const [regeneratingMenu, setRegeneratingMenu] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [syncLimit, setSyncLimit] = useState(20);
  
  const [headerLayout, setHeaderLayout] = useState('standard');
  const [accentColor, setAccentColor] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [brandVisualMode, setBrandVisualMode] = useState('logo');
  const [siteTitleDraft, setSiteTitleDraft] = useState('');
  const [savingSiteTitle, setSavingSiteTitle] = useState(false);
  const [sidebarTitleEditing, setSidebarTitleEditing] = useState(false);
  const [heroTagline, setHeroTagline] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [menuLinksStr, setMenuLinksStr] = useState('');
  const [footerText, setFooterText] = useState('');
  const [harmonizeAgent, setHarmonizeAgent] = useState('content_editor');
  const [accountType, setAccountType] = useState('business');
  const [templateStudio, setTemplateStudio] = useState(() => normalizeStudioData(null));
  const [savingTemplateStudio, setSavingTemplateStudio] = useState(false);
  const [studioWorkspaceOpen, setStudioWorkspaceOpen] = useState(false);
  const [studioSourceLabel, setStudioSourceLabel] = useState('Workspace corrente');
  const [studioControlsOpen, setStudioControlsOpen] = useState(true);
  const [studioPreviewUrl, setStudioPreviewUrl] = useState('');
  const [editorialEngine, setEditorialEngine] = useState({ settings: { enabled: true, auto_run: true, min_posts: 8, strict_indexing_mode: true }, dna: {}, memory: {}, state: {}, last_run: null });
  const [editorialEngineBusy, setEditorialEngineBusy] = useState(false);
  const [editorialEngineMsg, setEditorialEngineMsg] = useState(null);
  const [understandingReport, setUnderstandingReport] = useState(null);
  const [understandingDraft, setUnderstandingDraft] = useState(null);
  const [savingUnderstanding, setSavingUnderstanding] = useState(false);
  const [strategyStep, setStrategyStep] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingVisualMode, setSavingVisualMode] = useState(false);
  const [reachabilityDraft, setReachabilityDraft] = useState({ presence_mode: 'undecided', official_site_url: '', business_profile_url: '', primary_topic: '', service_areas: [], reciprocal_link_confirmed: false, phone: '', whatsapp: '', email: '' });
  const [savingReachability, setSavingReachability] = useState(false);
  const [savingSearchVisible, setSavingSearchVisible] = useState(false);
  const [aiContentIdeas, setAiContentIdeas] = useState([]);
  const [ideasGeneratedAt, setIdeasGeneratedAt] = useState('');
  const [ideasNewsSignals, setIdeasNewsSignals] = useState(0);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [articleLength, setArticleLength] = useState('compact');
  const [preparingIdea, setPreparingIdea] = useState(-1);
  const [editingIdea, setEditingIdea] = useState(null);      // {index, title, reason}
  const [customIdeaOpen, setCustomIdeaOpen] = useState(false);
  const [customIdea, setCustomIdea] = useState({ title: '', reason: '' });
  const [dismissedIdeaKeys, setDismissedIdeaKeys] = useState([]);
  const [dismissingIdeaKey, setDismissingIdeaKey] = useState('');
  const [socialComposer, setSocialComposer] = useState(null);
  const [socialPlatform, setSocialPlatform] = useState('instagram');
  const [generatingSocial, setGeneratingSocial] = useState(false);
  const [promptDrafts, setPromptDrafts] = useState({});
  const [savingPromptName, setSavingPromptName] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const deferredStudio = useDeferredValue(templateStudio);
  const siteUrl = `${window.location.origin}/${user?.slug}`;

  async function changeOwnPassword(e) {
    e.preventDefault();
    setPasswordMsg(null);
    if (passwordForm.next.length < 8) {
      setPasswordMsg({ ok: false, text: 'La nuova password deve contenere almeno 8 caratteri.' });
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMsg({ ok: false, text: 'Le due nuove password non coincidono.' });
      return;
    }

    setChangingPassword(true);
    try {
      const result = await apiFetch('/api/index.php?action=password-change', {
        method: 'POST',
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.next,
        }),
      }, token);
      setPasswordForm({ current: '', next: '', confirm: '' });
      setPasswordMsg({ ok: true, text: result.message || 'Password aggiornata con successo.' });
    } catch (e) {
      setPasswordMsg({ ok: false, text: e.message });
    } finally {
      setChangingPassword(false);
    }
  }

  // ── Tema chiaro/scuro ──────────────────────────────────────────────────
  const [theme, setThemeState] = useState(() =>
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'dark'
  );
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sts_theme', next);
    setThemeState(next);
  }

  useEffect(() => { loadData(); loadDrafts(); }, []);

  useEffect(() => {
    let intervalId;
    if (syncing || scanning || importing || harmonizingId > 0) {
      intervalId = setInterval(async () => {
        try {
          const res = await apiFetch('/api/index.php?action=sync-status', {}, token);
          if (res && res.ok && res.msg) {
            setSyncMsg(prev => ({ ok: prev?.ok ?? true, text: res.msg, loading: prev?.loading ?? true }));
          }
        } catch (err) {}
      }, 1500);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [syncing, scanning, importing, harmonizingId, token]);

  async function loadData() {
    try {
      const d = await apiFetch('/api/index.php?action=site', {}, token);
      setData(d);
      setProfileDraft(d.site?.profile_summary || d.site?.bio || '');
      setRoleMissionDraft(d.site?.role_mission || '');
      setStrategyDraft(d.site?.content_strategy || '');
      setSelectedTheme(d.site?.theme || 'classic');
      
      setHeaderLayout(d.site?.header_layout || 'standard');
      setAccentColor(d.site?.accent_color || '');
      setLogoUrl(d.site?.logo_url || '');
      setCoverUrl(d.site?.cover_url || '');
      setBrandVisualMode(d.site?.brand_visual_mode === 'cover' ? 'cover' : 'logo');
      setSiteTitleDraft(d.site?.title || '');
      setHeroTagline(d.site?.hero_tagline || '');
      setCustomCss(d.site?.custom_css || '');
      setFooterText(d.site?.footer_text || '');
      setHarmonizeAgent(d.site?.harmonize_agent || 'content_editor');
      setAccountType(d.site?.account_type || 'business');
      try {
        const dismissed = typeof d.site?.dismissed_content_ideas === 'string'
          ? JSON.parse(d.site.dismissed_content_ideas || '[]')
          : (d.site?.dismissed_content_ideas || []);
        setDismissedIdeaKeys(Array.isArray(dismissed) ? dismissed : []);
      } catch (_) {
        setDismissedIdeaKeys([]);
      }
      setReachabilityDraft(d.reachability?.profile || { presence_mode: 'undecided', official_site_url: '', business_profile_url: '', primary_topic: '', service_areas: [], reciprocal_link_confirmed: false, phone: '', whatsapp: '', email: '' });
      let parsedEditorialSettings = { enabled: true, auto_run: true, min_posts: 8, strict_indexing_mode: true };
      let parsedEditorialDna = {};
      let parsedEditorialMemory = {};
      let parsedEditorialState = {};
      try {
        if (d.site?.editorial_settings) {
          parsedEditorialSettings = {
            ...parsedEditorialSettings,
            ...(typeof d.site.editorial_settings === 'string' ? JSON.parse(d.site.editorial_settings) : d.site.editorial_settings),
          };
        }
      } catch (e) {
        console.error('Errore parse editorial_settings:', e);
      }
      try {
        if (d.site?.editorial_dna) {
          parsedEditorialDna = typeof d.site.editorial_dna === 'string' ? JSON.parse(d.site.editorial_dna) : d.site.editorial_dna;
        }
      } catch (e) {
        console.error('Errore parse editorial_dna:', e);
      }
      try {
        if (d.site?.editorial_memory) {
          parsedEditorialMemory = typeof d.site.editorial_memory === 'string' ? JSON.parse(d.site.editorial_memory) : d.site.editorial_memory;
        }
      } catch (e) {
        console.error('Errore parse editorial_memory:', e);
      }
      try {
        if (d.site?.editorial_engine_state) {
          parsedEditorialState = typeof d.site.editorial_engine_state === 'string' ? JSON.parse(d.site.editorial_engine_state) : d.site.editorial_engine_state;
        }
      } catch (e) {
        console.error('Errore parse editorial_engine_state:', e);
      }
      setEditorialEngine({
        settings: parsedEditorialSettings || {},
        dna: parsedEditorialDna || {},
        memory: parsedEditorialMemory || {},
        state: parsedEditorialState || {},
        last_run: d.site?.editorial_last_run || null,
      });
      let parsedSiteAiData = null;
      if (d.site?.site_ai_data) {
        try {
          parsedSiteAiData = typeof d.site.site_ai_data === 'string' ? JSON.parse(d.site.site_ai_data) : d.site.site_ai_data;
        } catch (e) {
          console.error('Errore parse site_ai_data:', e);
        }
      }
      setTemplateStudio(normalizeStudioData(parsedSiteAiData, d.site?.theme || 'tech-clarity'));
      try {
        const rawUnderstanding = d.site?.site_understanding ? (typeof d.site.site_understanding === 'string' ? JSON.parse(d.site.site_understanding) : d.site.site_understanding) : null;
        const parsedUnderstanding = rawUnderstanding && typeof rawUnderstanding === 'object' && Object.keys(rawUnderstanding).length ? prefillStrategyFromAi(rawUnderstanding) : null;
        setUnderstandingReport(parsedUnderstanding);
        setUnderstandingDraft(parsedUnderstanding);
      } catch (e) {
        console.error('Errore parse site_understanding:', e);
        setUnderstandingReport(null);
        setUnderstandingDraft(null);
      }
      if (d.site?.menu_links) {
        try {
           const arr = JSON.parse(d.site.menu_links);
           setMenuLinksStr(arr.map(x => `${x.label}|${x.url}`).join('\n'));
        } catch { setMenuLinksStr(d.site.menu_links); }
      }
      
      if (user?.role === 'admin') {
        apiFetch('/api/index.php?action=admin-seo', {}, token)
          .then(res => setAdminSeoStats(res.stats || []))
          .catch(e => console.error(e));
      }
      return d;
    } catch (err) {
      alert("ERRORE CARICAMENTO DASHBOARD: " + err.message);
      return null;
    }
  }

  async function loadDrafts() {
    try {
      const d = await apiFetch('/api/index.php?action=drafts', {}, token);
      setDrafts(d || []);
    } catch {}
  }

  // AGENTE 1 — Ingestione: importa e trascrive da link
  async function doImport(e) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setImporting(true); setImportMsg(null);
    setAcquisitionModal({ status: 'working', title: 'Sto acquisendo il contenuto', text: 'Apro il link e recupero testo, immagini o video. Puoi seguire qui tutte le fasi.' });
    try {
      const r = await apiFetch('/api/index.php?action=ingest-url',
        { method: 'POST', body: JSON.stringify({ url: linkUrl.trim() }) }, token);
      if (r.duplicate) {
        setAcquisitionModal({ status: 'success', title: 'Contenuto già presente', text: 'Il link era stato acquisito in precedenza: lo trovi nella sezione Articoli.' });
        setImportMsg({ ok: true, text: 'Questo contenuto era già stato importato.' });
      } else {
        setImportMsg({ ok: true, text: 'Acquisizione completata! Elaborazione AI in corso...' });
        // Mantiene aperto il flusso guidato fino al completamento dell'articolo.
        await processPendingLoop(true, [r.id]);
      }
      setLinkUrl('');
      await loadDrafts();
      await loadData();
    } catch (err) {
      setImportMsg({ ok: false, text: err.message });
      setAcquisitionModal({ status: 'error', title: 'Importazione non completata', text: err.message });
    }
    setImporting(false);
  }

  // AGENTE 2 — Armonizzatore: bozza → articolo pubblicato
  async function doHarmonize(id) {
    setHarmonizingId(id);
    try {
      await apiFetch('/api/index.php?action=harmonize',
        { method: 'POST', body: JSON.stringify({ id }) }, token);
      await loadDrafts();
      await loadData();
    } catch (err) {
      setImportMsg({ ok: false, text: err.message });
    }
    setHarmonizingId(0);
  }

  async function retryPendingPost(id) {
    setAcquisitionModal({ status: 'working', title: 'Riprovo l\'elaborazione', text: 'Recupero nuovamente il contenuto e preparo una bozza pubblicabile.', completed: 0, total: 1 });
    try {
      const result = await apiFetch('/api/index.php?action=process-pending', {
        method: 'POST',
        body: JSON.stringify({ id })
      }, token);
      if (result?.ok === false) throw new Error(result.message || 'Il contenuto non è più disponibile nella coda.');
      await loadDrafts();
      await loadData();
      setAcquisitionModal({ status: 'success', title: 'Articolo elaborato', text: result?.status === 'published' ? 'Il contenuto è stato elaborato e pubblicato.' : 'Il contenuto è stato elaborato ed è disponibile negli Articoli.', completed: 1, total: 1 });
    } catch (error) {
      await loadData();
      setAcquisitionModal({ status: 'error', title: 'Elaborazione non riuscita', text: error.message || 'Non è stato possibile elaborare il contenuto.' });
    }
  }

  // Funzione helper per elaborare la coda (ora in parallelo)
  async function processPendingLoop(isScan = false, onlyIds = null) {
    try {
      const allPending = await apiFetch('/api/index.php?action=pending-posts', {}, token);
      const requestedIds = Array.isArray(onlyIds) ? new Set(onlyIds.map(Number)) : null;
      const pending = requestedIds
        ? (allPending || []).filter(post => requestedIds.has(Number(post.id)))
        : (allPending || []);
      if (!pending || pending.length === 0) {
        setAcquisitionModal({ status: 'success', title: 'Nessun contenuto da elaborare', text: requestedIds ? 'Il contenuto è già stato elaborato oppure è già in lavorazione.' : 'Non ci sono nuovi contenuti in attesa. Gli articoli già acquisiti non vengono rigenerati.' });
        return;
      }
      
      setProcessingQueue(pending.map(p => ({ ...p, status: 'pending' })));

      const total = pending.length;
      let completed = 0;
      let publishedCount = 0;
      let draftCount = 0;
      let skippedCount = 0;
      let deletedCount = 0;
      let errorCount = 0;
      const concurrency = 3; // Tre armonizzazioni leggere in parallelo, senza trascrizioni inutili.

      const updateProgress = () => {
        const msg = `Elaborazione AI: completati ${completed} su ${total} post...`;
        setAcquisitionModal({ status: 'working', title: 'Creo i tuoi articoli', text: msg, completed, total });
        if (isScan) setScanMsg({ ok: true, text: msg, loading: true });
        else setSyncMsg({ ok: true, text: msg, loading: true });
      };

      updateProgress();

      const processPost = async (post) => {
        setProcessingQueue(prev => prev.map(p => p.id === post.id ? { ...p, status: 'processing' } : p));
        const postLabel = post.generated_title || post.source_url || `${post.platform} #${post.id}`;
        const processingMsg = `Elaborazione AI in corso: ${completed + 1}/${total} - ${post.platform.toUpperCase()} - ${postLabel}`;
        setAcquisitionModal({ status: 'working', title: 'Creo i tuoi articoli', text: processingMsg, completed, total });
        if (isScan) setScanMsg({ ok: true, text: processingMsg, loading: true });
        else setSyncMsg({ ok: true, text: processingMsg, loading: true });
        let errorMsg = null;
        try {
          const res = await apiFetch('/api/index.php?action=process-pending', {
            method: 'POST',
            body: JSON.stringify({ id: post.id })
          }, token);
          if (res?.status === 'published') publishedCount++;
          else if (res?.status === 'draft') draftCount++;
          else if (res?.status === 'skipped') skippedCount++;
          else if (res?.status === 'deleted') deletedCount++;
          else if (res?.busy) skippedCount++;
        } catch (e) {
          console.error("Errore post", post.id, e);
          errorMsg = e.message;
          errorCount++;
        }
        
        setProcessingQueue(prev => prev.map(p => p.id === post.id ? { ...p, status: errorMsg ? 'error' : 'done' } : p));
        completed++;
        updateProgress();
      };

      for (let i = 0; i < pending.length; i += concurrency) {
        const chunk = pending.slice(i, i + concurrency);
        await Promise.all(chunk.map(post => processPost(post)));
      }

      const doneMsg = `Elaborazione completata. Contenuti: ${total}. Pubblicati: ${publishedCount}. In bozza: ${draftCount}. Già in lavorazione: ${skippedCount}. Saltati: ${deletedCount}. Errori: ${errorCount}.`;
      setAcquisitionModal({ status: errorCount === total ? 'error' : 'success', title: errorCount === total ? 'Elaborazione non riuscita' : errorCount > 0 ? 'Completato con alcuni errori' : 'I contenuti sono pronti', text: doneMsg, completed: total, total });
      if (isScan) setScanMsg({ ok: true, text: doneMsg });
      else setSyncMsg({ ok: true, text: doneMsg });
      
      // Ritardiamo la pulizia della coda per far vedere all'utente il completamento
      setTimeout(() => setProcessingQueue([]), 5000);
      
      await loadDrafts();
      await loadData();
    } catch (e) {
      console.error(e);
      setProcessingQueue([]);
      setAcquisitionModal({ status: 'error', title: 'Elaborazione interrotta', text: e.message || 'Si è verificato un errore durante la creazione degli articoli.' });
    }
  }

  async function syncNow() {
    setSyncing(true); setSyncMsg({ ok: true, text: 'Acquisizione post in corso...', loading: true });
    setAcquisitionModal({ status: 'working', title: 'Aggiorno i tuoi canali', text: "Cerco nuovi contenuti sui canali collegati. L'operazione può richiedere qualche minuto." });
    try {
      await apiFetch('/api/index.php?action=sync', { 
        method: 'POST', 
        body: JSON.stringify({ limit: parseInt(syncLimit) || 20 }) 
      }, token);
      await processPendingLoop(false);
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message });
      setAcquisitionModal({ status: 'error', title: 'Aggiornamento non completato', text: e.message });
    }
    setSyncing(false);
  }

  async function togglePublishPost(id, currentStatus) {
    const newStatus = Number(currentStatus) === 1 ? 0 : 1;
    setPublishingPostId(id);
    try {
      await apiFetch('/api/index.php?action=toggle-publish-post', { method: 'POST', body: JSON.stringify({ id, published: newStatus }) }, token);
      setData(prev => ({
        ...prev,
        posts: prev.posts.map(p => p.id === id ? { ...p, published: newStatus } : p)
      }));
      setSyncMsg({ ok: true, text: newStatus === 1 ? 'Articolo pubblicato sul sito.' : 'Articolo rimosso dal sito e riportato in bozza.' });
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    } finally {
      setPublishingPostId(null);
    }
  }

  async function deletePost(id) {
    if (!window.confirm("Sei sicuro di voler eliminare definitivamente questo post? Verrà rimosso anche dal sito pubblico.")) return;
    await apiFetch('/api/index.php?action=delete-post', { method: 'POST', body: JSON.stringify({ id }) }, token);
    setData(prev => ({ ...prev, posts: prev.posts.filter(p => p.id !== id) }));
    setSelectedPosts(prev => prev.filter(pId => pId !== id));
  }

  function togglePostSelection(id) {
    setSelectedPosts(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  function selectAllPosts(filteredPostsList) {
    if (selectedPosts.length === filteredPostsList.length && filteredPostsList.length > 0) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(filteredPostsList.map(p => p.id));
    }
  }

  async function bulkDeletePosts() {
    if (selectedPosts.length === 0) return;
    if (!window.confirm(`Sei sicuro di voler eliminare definitivamente ${selectedPosts.length} contenuti selezionati?`)) return;
    
    await apiFetch('/api/index.php?action=bulk-delete-posts', { method: 'POST', body: JSON.stringify({ ids: selectedPosts }) }, token);
    setData(prev => ({ ...prev, posts: prev.posts.filter(p => !selectedPosts.includes(p.id)) }));
    setSelectedPosts([]);
  }

  async function addSource(e) {
    e.preventDefault();
    setSourceMsg(null);
    try {
      await apiFetch('/api/index.php?action=social-source-create', {
        method: 'POST',
        body: JSON.stringify(sourceForm)
      }, token);
      setSourceForm({ label: '', url: '', platform: '' });
      setSourceMsg({ ok: true, text: 'Social aggiunto allo spazio utente.' });
      await loadData();
    } catch (err) {
      setSourceMsg({ ok: false, text: err.message });
    }
  }

  const [checkingPlatform, setCheckingPlatform] = useState({});
  const [checkResult, setCheckResult] = useState({});

  async function checkSocialUrl(platform) {
    const urlInput = document.getElementById(`url_${platform}`);
    const dateInput = document.getElementById(`date_${platform}`);
    const maxInput = document.getElementById(`max_${platform}`);
    if (!urlInput || !urlInput.value) return;

    setCheckingPlatform(prev => ({...prev, [platform]: true}));
    setCheckResult(prev => ({...prev, [platform]: null}));
    try {
      const res = await apiFetch('/api/index.php?action=check-social-url', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          url: urlInput.value.trim(),
          since_date: dateInput ? dateInput.value : '',
          max_posts: maxInput ? maxInput.value : ''
        })
      }, token);
      setCheckResult(prev => ({...prev, [platform]: { ok: true, msg: res.message }}));
    } catch (err) {
      setCheckResult(prev => ({...prev, [platform]: { ok: false, msg: err.message }}));
    }
    setCheckingPlatform(prev => ({...prev, [platform]: false}));
  }

  async function savePlatformSource(platform, url, since_date = null, auto_publish = 1, max_posts = null, topic_summary = null, auto_sync = 1) {
    setSourceMsg(null);
    try {
      await apiFetch('/api/index.php?action=social-source-upsert', {
        method: 'POST',
        body: JSON.stringify({ platform, label: SOCIAL[platform]?.label || platform, url, since_date, auto_publish, max_posts, topic_summary, auto_sync, scan_now: false })
      }, token);
      await loadData();
    } catch (err) {
      setSourceMsg({ ok: false, text: err.message });
    }
  }

  async function saveConnectionSettings(platform, since_date, auto_publish, max_posts = null, auto_sync = 1) {
    try {
      await apiFetch('/api/index.php?action=social-connection-update', {
        method: 'POST',
        body: JSON.stringify({ platform, since_date, auto_publish, max_posts, auto_sync })
      }, token);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function syncAllChannels() {
    setScanning(true);
    setScanProgress([]);
    setScanMsg({ ok: true, text: 'Sincronizzazione manuale di tutti i canali attivi...', loading: true });
    setAcquisitionModal({ status: 'working', title: 'Sincronizzo tutti i canali', text: "Controllo ogni fonte collegata e acquisisco i nuovi contenuti. Puoi seguire qui l'avanzamento." });
    try {
      await apiFetch('/api/index.php?action=sync', {
        method: 'POST',
        body: JSON.stringify({ limit: parseInt(syncLimit) || 20 })
      }, token);
      await processPendingLoop(true);
      await loadData();
    } catch (err) {
      setScanMsg({ ok: false, text: err.message });
      setAcquisitionModal({ status: 'error', title: 'Sincronizzazione non completata', text: err.message });
    } finally {
      setScanning(false);
    }
  }

  async function scanSources() {
    if (!sources || sources.length === 0) {
      alert("Nessuna fonte social attiva. Aggiungine una prima di scansionare.");
      return;
    }
    setScanning(true); 
    setScanMsg({ ok: true, text: 'Preparazione sincronizzazione dei canali attivi...', loading: true });
    setScanProgress(sources.map((s, index) => ({ id: s.id, platform: s.platform, label: s.label, status: 'pending', details: `In attesa di avvio (${index + 1}/${sources.length})` })));
    
    let totalImported = 0;
    let totalFound = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;
    const importedIds = [];

    const scanSource = async (source, i) => {
      const sourceName = source.label || source.platform;
      const sourceOrdinal = `sorgente ${i + 1} di ${sources.length}`;
      setScanProgress(prev => prev.map(s => s.id === source.id ? {
        ...s,
        status: 'scanning',
        details: `Apro ${sourceName} e cerco post pubblici recenti (${sourceOrdinal})`
      } : s));
      setScanMsg({
        ok: true,
        text: `Sto analizzando ${sourceName}: recupero i post pubblici recenti dalla ${source.platform} (${sourceOrdinal}).`,
        loading: true
      });
      try {
        const res = await apiFetch('/api/index.php?action=scan-sources', {
          method: 'POST',
          body: JSON.stringify({
            source_id: source.id,
            limit: parseInt(syncLimit) || 20,
            profile_summary: profileDraft,
            role_mission: roleMissionDraft,
            content_strategy: strategyDraft
          })
        }, token);
        const r = res.report;
        totalImported += (r.imported || 0);
        totalFound += (r.found || 0);
        totalDuplicates += (r.duplicates || 0);
        if (Array.isArray(r.imported_ids)) importedIds.push(...r.imported_ids.map(Number));
        const errorsForSource = Array.isArray(r.errors) ? r.errors.length : 0;
        totalErrors += errorsForSource;
        const resultText = [
          `Trovati: ${r.found || 0}`,
          `Importati: ${r.imported || 0}`,
          `Duplicati: ${r.duplicates || 0}`,
          `Errori: ${errorsForSource}`
        ].join(' • ');
        setScanProgress(prev => prev.map(s => s.id === source.id ? {
          ...s,
          status: errorsForSource > 0 ? 'error' : 'done',
          details: resultText
        } : s));
        setScanMsg({
          ok: errorsForSource === 0,
          text: `Sorgente completata: ${sourceName}. ${resultText}.`,
          loading: false
        });
      } catch (err) {
        console.error("Errore scansione " + source.platform, err);
        totalErrors++;
        setScanProgress(prev => prev.map(s => s.id === source.id ? {
          ...s,
          status: 'error',
          details: `Errore durante l'acquisizione: ${err.message}`
        } : s));
        setScanMsg({
          ok: false,
          text: `Errore durante la scansione di ${sourceName}: ${err.message}`,
          loading: false
        });
      }
    };

    // Le sorgenti esterne sono indipendenti: ne interroghiamo fino a tre
    // insieme, così tre canali non richiedono tre attese consecutive.
    const sourceConcurrency = 3;
    for (let i = 0; i < sources.length; i += sourceConcurrency) {
      const chunk = sources.slice(i, i + sourceConcurrency);
      await Promise.all(chunk.map((source, offset) => scanSource(source, i + offset)));
    }

    setScanMsg({
      ok: totalErrors === 0,
      text: importedIds.length > 0
        ? `Acquisizione completata. Totale trovati: ${totalFound}. Nuovi importati: ${totalImported}. Duplicati: ${totalDuplicates}. Errori: ${totalErrors}. Elaboro soltanto i nuovi contenuti.`
        : `Acquisizione completata. Nessun nuovo contenuto da elaborare. Duplicati: ${totalDuplicates}. Errori: ${totalErrors}.`,
      loading: importedIds.length > 0
    });
    setTimeout(() => setScanProgress([]), 3000);
    if (importedIds.length > 0) {
      await processPendingLoop(true, importedIds);
    } else {
      setAcquisitionModal({ status: 'success', title: 'Canali aggiornati', text: 'Non sono stati trovati nuovi contenuti. Nessun articolo esistente è stato rigenerato.' });
    }
    setScanning(false);
  }

  async function repairMedia() {
    if (!data?.posts?.some(post => post.media_url)) {
      alert('Non ci sono media da riparare.');
      return;
    }
    setRepairingMedia(true);
    setScanMsg({ ok: true, text: 'Controllo e riparazione media in corso...', loading: true });
    try {
      const res = await apiFetch('/api/index.php?action=repair-media', {
        method: 'POST',
        body: JSON.stringify({ limit: Math.max(parseInt(syncLimit, 10) || 20, 50) })
      }, token);
      const report = res.report || {};
      await loadData();
      setScanMsg({
        ok: true,
        text: `Media controllati: ${report.checked || 0}. Scaricati: ${report.downloaded || 0}. Normalizzati: ${report.normalized || 0}.`
      });
    } catch (err) {
      setScanMsg({ ok: false, text: err.message });
    }
    setRepairingMedia(false);
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await apiFetch('/api/index.php?action=site-update', {
        method: 'POST',
        body: JSON.stringify({
          profile_summary: profileDraft,
          bio: profileDraft,
          role_mission: roleMissionDraft,
          content_strategy: strategyDraft,
          theme: selectedTheme,
          header_layout: headerLayout,
          accent_color: accentColor,
          logo_url: logoUrl,
          cover_url: coverUrl,
          brand_visual_mode: brandVisualMode,
          hero_tagline: heroTagline,
          custom_css: customCss,
          footer_text: footerText,
          harmonize_agent: harmonizeAgent,
          account_type: accountType,
          site_understanding: understandingDraft,
          menu_links: menuLinksStr.split('\n').filter(x => x.trim()).map(x => {
             const parts = x.split('|');
             return { label: parts[0].trim(), url: parts[1] ? parts[1].trim() : '' };
          }),
        })
      }, token);
      await loadData();
    } catch (err) {
      setScanMsg({ ok: false, text: err.message });
    }
    setSavingProfile(false);
  }

  function updateUnderstandingField(key, value) {
    setUnderstandingDraft(prev => ({ ...(prev || {}), [key]: value }));
  }

  function updateUnderstandingList(key, value) {
    updateUnderstandingField(key, value.split('\n').map(item => item.trim()).filter(Boolean));
  }

  function updateUnderstandingNested(section, key, value) {
    setUnderstandingDraft(prev => ({
      ...(prev || {}),
      [section]: {
        ...((prev && prev[section]) || {}),
        [key]: value,
      }
    }));
  }

  function updateUnderstandingNestedList(section, key, value) {
    updateUnderstandingNested(section, key, value.split('\n').map(item => item.trim()).filter(Boolean));
  }

  function updateDeclaredStrategy(key, value) {
    updateUnderstandingNested('declared_strategy', key, value);
  }

  function updateDeclaredStrategyList(key, value) {
    updateDeclaredStrategy(key, value.split('\n').map(item => item.trim()).filter(Boolean));
  }

  function openDashboardSection(target) {
    if (target === 'strategy') setTab('strategy');
    else if (target === 'modules') setTab('services');
    else {
      setTab('seo');
      setVisibilitySection(target === 'overview' ? 'overview' : 'ideas');
    }
    window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  async function saveUnderstanding() {
    setSavingUnderstanding(true);
    try {
      await apiFetch('/api/index.php?action=site-update', {
        method: 'POST',
        body: JSON.stringify({
          site_understanding_corrections: {
            declared_strategy: understandingDraft?.declared_strategy || {},
          },
        }),
      }, token);
      setUnderstandingReport(understandingDraft);
      setSyncMsg({ ok: true, text: 'Strategia salvata. Da ora guiderà pagine SEO, analisi e prossimi contenuti.' });
      await loadData();
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    }
    setSavingUnderstanding(false);
  }

  async function uploadSiteVisual(event, kind = 'logo') {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSyncMsg({ ok: false, text: 'Usa un’immagine JPG, PNG o WebP.' });
      return;
    }
    const maxBytes = kind === 'cover' ? 8 * 1024 * 1024 : 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      setSyncMsg({ ok: false, text: kind === 'cover' ? 'L’immagine deve pesare meno di 8 MB.' : 'Il logo deve pesare meno di 3 MB.' });
      return;
    }
    setUploadingLogo(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await apiFetch('/api/index.php?action=site-visual-upload', {
        method: 'POST',
        body: JSON.stringify({ data_url: dataUrl, kind }),
      }, token);
      if (kind === 'cover') setCoverUrl(response.cover_url || response.url || '');
      else setLogoUrl(response.logo_url || response.url || '');
      setBrandVisualMode(kind);
      setSyncMsg({ ok: true, text: kind === 'cover' ? 'Immagine del sito salvata e attivata.' : 'Logo salvato e attivato sul sito.' });
      await loadData();
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    }
    setUploadingLogo(false);
  }

  async function uploadBrandLogo(event) {
    return uploadSiteVisual(event, 'logo');
  }

  async function selectBrandVisualMode(mode) {
    const nextMode = mode === 'cover' ? 'cover' : 'logo';
    setBrandVisualMode(nextMode);
    setSavingVisualMode(true);
    try {
      await apiFetch('/api/index.php?action=site-update', {
        method: 'POST',
        body: JSON.stringify({ brand_visual_mode: nextMode }),
      }, token);
      setSyncMsg({ ok: true, text: nextMode === 'cover' ? 'Il sito userà l’immagine rappresentativa.' : 'Il sito userà il logo.' });
      await loadData();
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    } finally {
      setSavingVisualMode(false);
    }
  }

  async function saveSiteTitle(event) {
    event?.preventDefault();
    const title = siteTitleDraft.trim();
    if (!title) {
      setSyncMsg({ ok: false, text: 'Inserisci il nome del sito.' });
      return;
    }
    setSavingSiteTitle(true);
    try {
      await apiFetch('/api/index.php?action=site-update', {
        method: 'POST',
        body: JSON.stringify({ title }),
      }, token);
      setSiteTitleDraft(title);
      setData(prev => ({ ...prev, site: { ...(prev.site || {}), title } }));
      setSyncMsg({ ok: true, text: 'Nome del sito salvato. È già attivo sul sito pubblico.' });
      setSidebarTitleEditing(false);
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    } finally {
      setSavingSiteTitle(false);
    }
  }

  async function saveReachabilityNetwork() {
    setSavingReachability(true);
    try {
      await apiFetch('/api/index.php?action=reachability-update', {
        method: 'POST',
        body: JSON.stringify(reachabilityDraft),
      }, token);
      setSyncMsg({ ok: true, text: 'Network della Reperibilità aggiornato. I collegamenti vengono ora usati nei segnali pubblici e nelle analisi.' });
      await loadData();
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    }
    setSavingReachability(false);
  }

  async function generateAiContentIdeas() {
    setGeneratingIdeas(true);
    setSyncMsg({ ok: true, loading: true, text: 'L\'AI sta leggendo profilo, contenuti, ricerche e temi attuali…' });
    try {
      const result = await apiFetch('/api/index.php?action=generate-content-ideas', {
        method: 'POST',
        body: JSON.stringify({ count: 3 }),
      }, token);
      setAiContentIdeas(Array.isArray(result.ideas) ? result.ideas : []);
      setIdeasGeneratedAt(result.generated_at || new Date().toISOString());
      setIdeasNewsSignals(Number(result.news_signals || 0));
      const generationMessage = result.generation_source === 'profile_fallback'
        ? '3 proposte pronte dal tuo profilo editoriale. Il servizio AI non era disponibile, ma il lavoro non si è bloccato.'
        : result.generation_source === 'ai_completed'
          ? '3 proposte pronte. La risposta AI era parziale ed è stata completata automaticamente dal tuo profilo.'
          : '3 nuove proposte create dall\'AI. Scegline una per l\'articolo o per un social.';
      setSyncMsg({ ok: true, text: generationMessage });
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    } finally {
      setGeneratingIdeas(false);
    }
  }

  async function generateSocialContent(idea, platform = socialPlatform) {
    setGeneratingSocial(true);
    setSocialPlatform(platform);
    setSyncMsg({ ok: true, loading: true, text: `Preparo una versione specifica per ${SOCIAL[platform]?.label || platform}…` });
    try {
      const result = await apiFetch('/api/index.php?action=generate-social-content', {
        method: 'POST',
        body: JSON.stringify({ idea, platform }),
      }, token);
      setSocialComposer({ idea, ...(result.content || {}), publishNote: result.publish_note || '' });
      setSyncMsg({ ok: true, text: 'Post social generato. Controllalo e poi scegli Condividi.' });
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    } finally {
      setGeneratingSocial(false);
    }
  }

  function socialShareText() {
    if (!socialComposer) return '';
    const hashtags = (socialComposer.hashtags || []).map(tag => `#${String(tag).replace(/^#/, '').replace(/\s+/g, '')}`).join(' ');
    return [socialComposer.caption || '', hashtags].filter(Boolean).join('\n\n');
  }

  async function shareSocialContent() {
    const text = socialShareText();
    if (!text) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: socialComposer.headline || socialComposer.idea?.title || 'Nuovo contenuto', text });
        setSyncMsg({ ok: true, text: 'Contenuto inviato al menu di condivisione. Conferma nell\'app social.' });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await navigator.clipboard.writeText(text);
    const destinations = { instagram: 'https://www.instagram.com/', facebook: 'https://www.facebook.com/', tiktok: 'https://www.tiktok.com/upload', linkedin: 'https://www.linkedin.com/feed/' };
    window.open(destinations[socialPlatform] || destinations.instagram, '_blank', 'noopener');
    setSyncMsg({ ok: true, text: 'Testo copiato. Incollalo nel social appena aperto e conferma la pubblicazione.' });
  }

  async function createIdeaDraft(idea, index, mode = 'ai') {
    if (!String(idea?.title || '').trim()) {
      setSyncMsg({ ok: false, text: 'Serve un titolo per creare la bozza.' });
      return;
    }
    setPreparingIdea(index);
    setSyncMsg({
      ok: true, loading: true,
      text: mode === 'manual'
        ? 'Preparo la traccia da compilare…'
        : 'Creo la bozza e avvio la scrittura AI…',
    });
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), mode === 'ai' ? 120000 : 25000);
    try {
      const result = await apiFetch('/api/index.php?action=create-idea-draft', {
        method: 'POST',
        body: JSON.stringify({ ...idea, mode, length: articleLength }),
        signal: controller.signal,
      }, token);
      const [freshData] = await Promise.all([loadData(), loadDrafts()]);
      if (result?.draft && !(freshData?.posts || []).some(post => Number(post.id) === Number(result.draft.id))) {
        setData(previous => ({
          ...(previous || {}),
          posts: [
            {
              ...result.draft,
              platform: result.draft.platform || 'editorial_idea',
              published: 0,
              tags: Array.isArray(result.draft.tags) ? result.draft.tags : [],
            },
            ...((previous?.posts || []).filter(post => Number(post.id) !== Number(result.draft.id))),
          ],
        }));
      }
      setDashboardFilter('published-0');
      setTab('site');
      if (result?.draft) {
        setEditingPost({
          ...result.draft,
          tags: Array.isArray(result.draft.tags) ? result.draft.tags.join(', ') : String(result.draft.tags || ''),
          mediaUrl: '',
          mediaType: '',
          mediaWidth: 100,
          mediaAlignment: 'center',
          noindex: 0,
          imagePixelWidth: 1200,
        });
      }
      setEditingIdea(null);
      setCustomIdeaOpen(false);
      setCustomIdea({ title: '', reason: '' });
      setSyncMsg(result?.ai_status === 'failed'
        ? { ok: false, text: result.ai_error || 'La scrittura AI non è riuscita. La traccia resta salvata tra le bozze.' }
        : {
            ok: true,
            text: mode === 'manual'
              ? 'Traccia creata e aperta nell’editor. Scrivi pure: nessun testo è stato generato.'
              : 'Articolo scritto dall’AI e aperto nell’editor. Rivedilo prima di pubblicare.',
          });
    } catch (error) {
      setSyncMsg({ ok: false, text: error.name === 'AbortError' ? 'La richiesta ha impiegato troppo tempo. Riprova: il pulsante è stato sbloccato.' : error.message });
    } finally {
      window.clearTimeout(timeoutId);
      setPreparingIdea(-1);
    }
  }

  async function dismissContentIdea(idea) {
    const key = editorialIdeaKey(idea);
    if (!key || dismissingIdeaKey) return;
    const previous = dismissedIdeaKeys;
    setDismissingIdeaKey(key);
    setDismissedIdeaKeys(current => [...new Set([...current, key])]);
    setEditingIdea(null);
    try {
      const result = await apiFetch('/api/index.php?action=dismiss-content-idea', {
        method: 'POST',
        body: JSON.stringify({ key }),
      }, token);
      if (Array.isArray(result?.dismissed_content_ideas)) setDismissedIdeaKeys(result.dismissed_content_ideas);
      setSyncMsg({ ok: true, text: 'Proposta eliminata.' });
    } catch (error) {
      setDismissedIdeaKeys(previous);
      setSyncMsg({ ok: false, text: error.message });
    } finally {
      setDismissingIdeaKey('');
    }
  }

  async function refreshUnderstanding() {
    setSavingProfile(true);
    try {
      const res = await apiFetch('/api/index.php?action=refresh-understanding', {
        method: 'POST',
        body: JSON.stringify({})
      }, token);
      setUnderstandingReport(res.understanding || null);
      setUnderstandingDraft(res.understanding || null);
      await loadData();
      setSyncMsg({ ok: true, text: 'Proposta AI aggiornata senza modificare la strategia dichiarata da te.' });
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message });
    }
    setSavingProfile(false);
  }

  async function rebuildSeoFoundation() {
    setSavingProfile(true);
    try {
      await apiFetch('/api/index.php?action=rebuild-seo-foundation', { method: 'POST', body: JSON.stringify({}) }, token);
      await loadData();
      setSyncMsg({ ok: true, text: 'Pagine SEO fondamentali ricostruite usando le informazioni verificate.' });
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message });
    }
    setSavingProfile(false);
  }

  // Interruttore "Fatti trovare da Google" per l'intero sito.
  async function toggleSearchVisible(nextValue) {
    setSavingSearchVisible(true);
    // Aggiornamento ottimistico: l'interruttore deve rispondere subito.
    setData(prev => prev ? { ...prev, site: { ...prev.site, search_visible: nextValue ? 1 : 0 } } : prev);
    try {
      await apiFetch('/api/index.php?action=site-update', {
        method: 'POST',
        body: JSON.stringify({ search_visible: nextValue ? 1 : 0 })
      }, token);
      setSyncMsg({
        ok: true,
        text: nextValue
          ? 'Il sito è ora aperto ai motori di ricerca. Google può impiegare qualche giorno a rilevarlo.'
          : 'Il sito è nascosto ai motori di ricerca. Resta raggiungibile da chi ha il link.'
      });
    } catch (err) {
      // Ripristina lo stato precedente: l'interruttore non deve mentire.
      setData(prev => prev ? { ...prev, site: { ...prev.site, search_visible: nextValue ? 0 : 1 } } : prev);
      setSyncMsg({ ok: false, text: err.message || 'Non è stato possibile aggiornare la visibilità.' });
    }
    setSavingSearchVisible(false);
  }

  async function chooseTheme(theme) {
    setSelectedTheme(theme);
    try {
      await apiFetch('/api/index.php?action=site-update', {
        method: 'POST',
        body: JSON.stringify({ theme })
      }, token);
      setTemplateStudio(prev => normalizeStudioData(prev, theme));
      await loadData();
    } catch (err) {
      setScanMsg({ ok: false, text: err.message });
    }
  }

  async function removeSource(id) {
    await apiFetch('/api/index.php?action=social-source-delete', {
      method: 'POST',
      body: JSON.stringify({ id })
    }, token);
    await loadData();
  }

  // --- Funzioni Layout Proposti ---
  const [designingSite, setDesigningSite] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState(null);
  const [previewThemeId, setPreviewThemeId] = useState('classic');

  async function forceDesignSite() {
    setDesigningSite(true);
    try {
      await apiFetch('/api/index.php?action=design-site', { method: 'POST' }, token);
      await loadData();
      alert("Nuovi layout generati con successo!");
    } catch (err) {
      alert("Errore generazione: " + err.message);
    }
    setDesigningSite(false);
  }

  async function applyLayout(index) {
    if (!data?.site?.generated_layouts) return;
    try {
      const layouts = JSON.parse(data.site.generated_layouts);
      const layout = layouts[index];
      if (!layout) return;
      await apiFetch('/api/index.php?action=site-update', {
        method: 'POST',
        body: JSON.stringify({
          theme: layout.design_archetype || layout.theme || 'classic',
          design_archetype: layout.design_archetype || layout.theme || 'classic',
          accent_color: layout.color_palette?.primary || layout.accent_color || '',
          header_layout: layout.header_layout,
          custom_css: layout.custom_css,
          site_ai_data: layout
        })
      }, token);
      setTemplateStudio(normalizeStudioData(layout, layout.design_archetype || layout.theme || selectedTheme));
      await loadData();
      setActivePreviewUrl(null);
      alert("Layout applicato con successo!");
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeGeneratedLayout(index) {
    if (!confirm('Vuoi davvero eliminare questa proposta di layout?')) return;
    try {
      await apiFetch('/api/index.php?action=delete-layout', {
        method: 'POST',
        body: JSON.stringify({ index })
      }, token);
      await loadData();
    } catch (err) {
      alert("Errore eliminazione: " + err.message);
    }
  }

  function openStudioWorkspace(layout, sourceLabel = 'Workspace corrente') {
    const normalized = normalizeStudioData(layout, layout?.design_archetype || layout?.theme || selectedTheme);
    setTemplateStudio(normalized);
    setSelectedTheme(normalized.design_archetype || selectedTheme);
    setStudioSourceLabel(sourceLabel);
    setStudioControlsOpen(true);
    setActivePreviewUrl(null);
    setPreviewingTheme(null);
    setStudioWorkspaceOpen(true);
  }

  function loadTemplateIntoStudio(layout) {
    openStudioWorkspace(layout, `Proposta AI: ${layout?.design_archetype || layout?.theme || 'custom'}`);
  }

  function loadPresetIntoStudio(layout) {
    const presetData = {
      design_archetype: layout.id,
      font_heading: layout.font_heading,
      font_body: layout.font_body,
      color_palette: layout.color_palette,
      ui_style: layout.ui_style,
      layout_recipe: layout.layout_recipe,
      base_models: layout.base_models,
      custom_css: '',
    };
    openStudioWorkspace(presetData, `Template base: ${layout.name}`);
  }

  function updateStudio(path, value) {
    setTemplateStudio(prev => {
      if (path.startsWith('color_palette.')) {
        const key = path.split('.')[1];
        return { ...prev, color_palette: { ...prev.color_palette, [key]: value } };
      }
      if (path.startsWith('ui_style.')) {
        const key = path.split('.')[1];
        return { ...prev, ui_style: { ...prev.ui_style, [key]: value } };
      }
      if (path.startsWith('layout_recipe.')) {
        const key = path.split('.')[1];
        return { ...prev, layout_recipe: { ...prev.layout_recipe, [key]: value } };
      }
      if (path === 'base_models.0' || path === 'base_models.1') {
        const next = [...(prev.base_models || [])];
        next[path === 'base_models.0' ? 0 : 1] = value;
        return { ...prev, base_models: next.filter(Boolean).slice(0, 2) };
      }
      return { ...prev, [path]: value };
    });
  }

  useEffect(() => {
    if (!studioWorkspaceOpen) {
      setStudioPreviewUrl('');
      return;
    }

    const timer = window.setTimeout(() => {
      const previewData = encodeStudioPreviewData({
        ...deferredStudio,
        design_archetype: deferredStudio.design_archetype || selectedTheme,
      });
      setStudioPreviewUrl(`${siteUrl}?studio_preview=1&preview_data=${previewData}`);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [deferredStudio, selectedTheme, siteUrl, studioWorkspaceOpen]);

  async function saveTemplateStudio() {
    setSavingTemplateStudio(true);
    try {
      const payload = {
        theme: templateStudio.design_archetype || selectedTheme,
        design_archetype: templateStudio.design_archetype || selectedTheme,
        accent_color: templateStudio.color_palette?.primary || accentColor,
        custom_css: templateStudio.custom_css || '',
        site_ai_data: templateStudio,
      };
      await apiFetch('/api/index.php?action=site-update', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, token);
      await loadData();
      alert('Template Studio applicato con successo!');
    } catch (err) {
      alert(err.message);
    }
    setSavingTemplateStudio(false);
  }

  async function saveEditorialEngineSettings() {
    setEditorialEngineBusy(true);
    setEditorialEngineMsg(null);
    try {
      const res = await apiFetch('/api/index.php?action=admin-editorial-engine-save', {
        method: 'POST',
        body: JSON.stringify(editorialEngine.settings),
      }, token);
      setEditorialEngine(prev => ({ ...prev, settings: res.settings || prev.settings }));
      setEditorialEngineMsg({ ok: true, text: 'Impostazioni motore editoriale salvate.' });
      await loadData();
    } catch (err) {
      setEditorialEngineMsg({ ok: false, text: err.message });
    }
    setEditorialEngineBusy(false);
  }

  async function runEditorialEngine() {
    setEditorialEngineBusy(true);
    setEditorialEngineMsg({ ok: true, text: 'Analisi editoriale in corso...', loading: true });
    try {
      const res = await apiFetch('/api/index.php?action=admin-editorial-engine-run', {
        method: 'POST',
      }, token);
      if (res?.result) {
        setEditorialEngine(prev => ({
          ...prev,
          dna: res.result.editorial_dna || prev.dna,
          memory: res.result.editorial_memory || prev.memory,
          state: res.result.editorial_state || prev.state,
          settings: res.result.settings || prev.settings,
          last_run: new Date().toISOString(),
        }));
      }
      setEditorialEngineMsg({ ok: true, text: 'Motore editoriale aggiornato con successo.' });
      await loadData();
    } catch (err) {
      setEditorialEngineMsg({ ok: false, text: err.message });
    }
    setEditorialEngineBusy(false);
  }

  // --- Funzioni Admin Prompts ---
  const [adminPrompts, setAdminPrompts] = useState([]);
  
  async function loadAdminPrompts() {
    try {
      const res = await apiFetch('/api/index.php?action=admin-prompts', {}, token);
      setAdminPrompts(res.prompts || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function updatePrompt(agentName, instructions) {
    try {
      await apiFetch('/api/index.php?action=admin-update-prompt', {
        method: 'POST',
        body: JSON.stringify({ agent_name: agentName, instructions })
      }, token);
      setAdminPrompts(prev => prev.map(p => p.agent_name === agentName ? { ...p, instructions } : p));
      alert("Istruzioni aggiornate con successo!");
    } catch (err) {
      alert("Errore: " + err.message);
    }
  }

  async function savePromptDraft(agentName) {
    const nextInstructions = promptDrafts[agentName];
    if (!nextInstructions?.trim()) return;
    setSavingPromptName(agentName);
    await updatePrompt(agentName, nextInstructions);
    setSavingPromptName('');
  }

  function renderPromptEditor(agentName) {
    const prompt = adminPrompts.find(item => item.agent_name === agentName);
    if (!prompt) return null;
    const meta = EDITORIAL_AGENT_META[agentName] || {};
    const currentDraft = promptDrafts[agentName] ?? prompt.instructions ?? '';

    return (
      <div key={agentName} className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '18px' }}>{meta.icon || '🤖'}</span>
            <strong style={{ color: 'var(--text)' }}>{prompt.label || meta.title || agentName}</strong>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {prompt.description || meta.role || 'Prompt operativo dell’agente.'}
          </div>
        </div>
        <textarea
          value={currentDraft}
          onChange={e => setPromptDrafts(prev => ({ ...prev, [agentName]: e.target.value }))}
          style={{ width: '100%', minHeight: '220px', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.55, resize: 'vertical' }}
        />
        <button
          className="btn btn-outline"
          onClick={() => savePromptDraft(agentName)}
          disabled={savingPromptName === agentName}
          style={{ justifySelf: 'start', padding: '10px 16px', fontWeight: 700 }}
        >
          {savingPromptName === agentName ? 'Salvataggio...' : 'Salva prompt'}
        </button>
      </div>
    );
  }

  useEffect(() => {
    if (!user?.role || user.role !== 'admin') return;
    if ((tab === 'admin' || tab === 'general') && adminPrompts.length === 0) loadAdminPrompts();
  }, [tab, user, adminPrompts.length]);

  useEffect(() => {
    if (!adminPrompts.length) return;
    setPromptDrafts(prev => {
      const next = { ...prev };
      for (const prompt of adminPrompts) {
        if (!(prompt.agent_name in next)) next[prompt.agent_name] = prompt.instructions || '';
      }
      return next;
    });
  }, [adminPrompts]);

  useEffect(() => {
    if (tab !== 'settings') {
      setStudioWorkspaceOpen(false);
      return;
    }
    setStudioSourceLabel('Layout attuale');
    setStudioWorkspaceOpen(true);
  }, [tab]);

    async function regenerateMenuAi() {
    setRegeneratingMenu(true);
    try {
      await apiFetch('/api/index.php?action=chief-editor', { method: 'POST' }, token);
      await loadData();
      alert("Menu e categorie rigenerate con successo in base ai contenuti!");
    } catch (err) {
      alert("Errore rigenerazione menu: " + err.message);
    }
    setRegeneratingMenu(false);
  }




  // ── CMS Editoriale ───────────────────────────────────────────────────────
  const [editingPost, setEditingPost] = useState(null); // {id, title, body, excerpt, tags}
  const [cmsSaving, setCmsSaving] = useState(false);
  const [postImageUploading, setPostImageUploading] = useState(false);
  const [cmsFilter, setCmsFilter] = useState('all');

  function openPostEditor(post) {
    setEditingPost({
      id: post.id,
      title: post.edited_title || post.generated_title || '',
      body: post.edited_body || post.generated_body || '',
      excerpt: post.edited_excerpt || post.generated_excerpt || '',
      tags: (post.tags || []).join(', '),
      mediaUrl: post.media_url || '',
      mediaType: post.media_type || '',
      mediaWidth: Number(post.media_display_width || 100),
      mediaAlignment: post.media_alignment || 'center',
      noindex: Number(post.noindex || 0),
      imagePixelWidth: 1200,
    });
  }

  async function uploadPostImage(file) {
    if (!editingPost || !file) return;
    if (!file.type.startsWith('image/')) { alert('Seleziona un file immagine JPG, PNG o WebP.'); return; }
    if (file.size > 12 * 1024 * 1024) { alert('L’immagine originale deve pesare meno di 12 MB.'); return; }
    setPostImageUploading(true);
    try {
      const originalData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const image = await new Promise((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = originalData; });
      const target = Number(editingPost.imagePixelWidth || 1200);
      const scale = target > 0 ? Math.min(1, target / image.width) : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(outputType, 0.88);
      const result = await apiFetch('/api/index.php?action=post-media-upload', { method: 'POST', body: JSON.stringify({ post_id: editingPost.id, data_url: dataUrl }) }, token);
      setEditingPost(current => current ? { ...current, mediaUrl: result.media_url, mediaType: result.media_type } : current);
    } catch (err) { alert(err.message || 'Impossibile caricare l’immagine.'); }
    finally { setPostImageUploading(false); }
  }

  async function savePostEdit() {
    if (!editingPost) return;
    setCmsSaving(true);
    try {
      await apiFetch('/api/index.php?action=post-update', {
        method: 'POST',
        body: JSON.stringify({
          id: editingPost.id,
          edited_title: editingPost.title,
          edited_body: editingPost.body,
          edited_excerpt: editingPost.excerpt,
          tags: editingPost.tags.split(',').map(t => t.trim()).filter(Boolean),
          media_url: editingPost.mediaUrl,
          media_type: editingPost.mediaType,
          media_display_width: editingPost.mediaWidth,
          media_alignment: editingPost.mediaAlignment,
          noindex: editingPost.noindex,
        })
      }, token);
      setEditingPost(null);
      await loadData();
    } catch (err) { alert(err.message); }
    setCmsSaving(false);
  }

  async function toggleFeatured(postId, currentFeatured) {
    await apiFetch('/api/index.php?action=post-feature', {
      method: 'POST',
      body: JSON.stringify({ id: postId, featured: currentFeatured ? 0 : 1 })
    }, token);
    await loadData();
  }

  // ── Funzioni gestione canali (tab "I miei canali") ─────────────────────
  async function handleAddChannel(e) {
    e.preventDefault();
    setAddMsg(null);
    const url = addUrl.trim();
    if (!url) return;
    const platform = detectPlatformFromUrl(url);
    if (!platform) {
      setAddMsg({ ok: false, text: 'URL non riconosciuto. Inserisci il link al tuo profilo su Instagram, TikTok, YouTube, Facebook o il tuo sito web.' });
      return;
    }
    setAddLoading(true);
    try {
      await apiFetch('/api/index.php?action=social-source-upsert', {
        method: 'POST',
        body: JSON.stringify({ platform, label: addLabel || (SOCIAL[platform]?.label || platform), url })
      }, token);
      setAddMsg({ ok: true, text: `✅ Profilo ${SOCIAL[platform]?.label || platform} aggiunto! Clicca "Sincronizza tutti" per importare i contenuti.` });
      setAddUrl('');
      setAddLabel('');
      await loadData();
    } catch (err) {
      setAddMsg({ ok: false, text: err.message });
    }
    setAddLoading(false);
  }

  async function connectOAuth(platform) {
    window.location.href = `/api/auth/oauth_redirect.php?platform=${platform}&token=${localStorage.getItem('sts_token') || ''}`;
  }

  async function removeChannel(channel) {
    if (!window.confirm(`Rimuovere il canale "${channel.label || channel.platform}"?`)) return;
    if (channel.type === 'scraping') {
      await apiFetch('/api/index.php?action=social-source-delete', { method: 'POST', body: JSON.stringify({ id: channel.sourceId }) }, token);
    } else {
      await apiFetch('/api/index.php?action=social-disconnect', { method: 'POST', body: JSON.stringify({ platform: channel.rawPlatform }) }, token);
    }
    await loadData();
  }


  const site = data?.site;
  const posts = data?.posts || [];
  const connections = data?.connections || [];
  const sources = data?.sources || [];
  const visibility = data?.visibility || {};
  const reachability = data?.reachability || { score: 0, stage: 'configurazione', checks: [] };
  let seoFoundation = {};
  try { seoFoundation = typeof site?.seo_foundation === 'string' ? JSON.parse(site.seo_foundation) : (site?.seo_foundation || {}); } catch (_) { seoFoundation = {}; }
  const dismissedIdeaKeySet = new Set(dismissedIdeaKeys);
  const contentIdeas = (aiContentIdeas.length ? aiContentIdeas : buildEditorialIdeas(posts, understandingDraft || understandingReport, visibility))
    .filter(idea => !dismissedIdeaKeySet.has(editorialIdeaKey(idea)));
  const activeUnderstanding = understandingDraft || understandingReport || {};
  const declaredStrategy = activeUnderstanding.declared_strategy || {};
  const strategyProgress = strategyCompletion(activeUnderstanding);
  const publishedPosts = posts.filter(post => Number(post.published) === 1);
  const networkPublishedPages = (visibility.published_pages ?? (publishedPosts.length + 1)) + (seoFoundation.pages || []).length + (publishedPosts.length ? 1 : 0) + (sources.length ? 1 : 0);
  const sourceByPlatform = sources.reduce((acc, source) => ({ ...acc, [source.platform]: source }), {});
  const connByPlatform = connections.reduce((acc, c) => ({ ...acc, [c.platform]: c }), {});
  const navigationGroups = [
    {
      label: 'Menu',
      items: [
        { id: 'overview', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>, label: 'Panoramica', hint: 'Cosa succede oggi' },
        ...(user?.plan === 'base' ? [] : [{ id: 'seo', section: 'ideas', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>, label: 'Crea', hint: 'Idee, AI e social' }]),
        { id: 'site', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>, label: 'Articoli', hint: 'Bozze e pubblicati' },
        { id: 'sources', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>, label: 'Canali', hint: 'Contenuti acquisiti' },
        ...(user?.plan === 'base' ? [] : [{ id: 'seo', section: 'network', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>, label: 'Visibilità', hint: 'Presenza e Google' }]),
        { id: 'account', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>, label: 'Impostazioni', hint: 'Profilo, aspetto e account' },
        { id: 'services', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>, label: 'Piani e Upgrade', hint: 'Gestisci automazioni' },
      ],
    },
    ...(user?.role === 'admin' ? [{
      label: 'Amministrazione',
      items: [
        { id: 'admin', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>, label: 'Utenti', hint: 'Account e accessi' },
        { id: 'general', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>, label: 'Sistema', hint: 'Agenti e impostazioni' },
        { id: 'settings', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>, label: 'Design avanzato', hint: 'Strumenti legacy' },
      ],
    }] : []),
  ];
  const flatNavigation = navigationGroups.flatMap(group => group.items.map(item => ({ ...item, group: group.label })));
  const isNavigationActive = item => tab === item.id && (!item.section || visibilitySection === item.section);
  const activeNavigation = flatNavigation.find(isNavigationActive);
  const pageMeta = {
    overview: ['Panoramica', 'Controlla cosa sta funzionando e scegli la prossima azione.'],
    strategy: ['Profilo attività', 'Definisci pubblico, obiettivi e priorità che guidano tutto il sistema.'],
    site: ['Articoli', 'Rivedi le bozze, modifica i testi e decidi cosa pubblicare.'],
    experience: ['Identità del sito', 'Logo e contenuti personali dentro una struttura accessibile e coerente.'],
    sources: ['Canali collegati', 'Gestisci le fonti da cui arrivano contenuti e aggiornamenti.'],
    settings: ['Design avanzato', 'Controlli di compatibilità e personalizzazione avanzata.'],
    general: ['Impostazioni di sistema', 'Configura agenti, automazioni e comportamento della piattaforma.'],
    security: ['Password e sicurezza', 'Proteggi il tuo account e gestisci le sessioni attive.'],
    account: ['Impostazioni', 'Tutto ciò che configuri meno spesso, raccolto in un unico posto.'],
    services: ['Piani e Upgrade', 'Gestisci il tuo piano e le funzionalità automatiche.'],
    admin: ['Utenti', 'Gestisci account, accessi e configurazioni dei clienti.'],
  };
  const seoMeta = visibilitySection === 'ideas'
    ? ['Idee contenuti', 'Scegli una proposta, adattala oppure trasformala direttamente in articolo.']
    : ['Visibilità', 'Controlla come le pagine vengono trovate, collegate e comprese da Google.'];
  const [pageTitle, pageSubtitle] = tab === 'seo' ? seoMeta : (pageMeta[tab] || ['Dashboard', 'Gestisci il tuo spazio digitale.']);
  const selectNavigation = item => {
    setTab(item.id);
    if (item.section) setVisibilitySection(item.section);
    setMobileMenuOpen(false);
  };
  const openSiteIdentity = () => {
    setTab('experience');
    setMobileMenuOpen(false);
    window.setTimeout(() => document.getElementById('visual-identity')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const renderSiteCommandPanel = compact => (
    <section className={`site-command-panel ${compact ? 'is-mobile' : ''}`} aria-label="Comandi del sito">
      <span className="site-command-kicker">Il tuo sito</span>
      {sidebarTitleEditing ? (
        <form onSubmit={saveSiteTitle}><input autoFocus value={siteTitleDraft} maxLength={120} required onChange={event => setSiteTitleDraft(event.target.value)} aria-label="Nome del sito" /><div><button type="button" onClick={() => { setSiteTitleDraft(site?.title || ''); setSidebarTitleEditing(false); }}>Annulla</button><button type="submit" disabled={savingSiteTitle}>{savingSiteTitle ? 'Salvo…' : 'Salva'}</button></div></form>
      ) : (
        <><strong title={site?.title || siteTitleDraft}>{site?.title || siteTitleDraft || 'Sito senza nome'}</strong><div className="site-command-actions"><a href={siteUrl} target="_blank" rel="noopener">Apri sito ↗</a><button onClick={() => setSidebarTitleEditing(true)}>Modifica nome</button></div></>
      )}
      <button className="site-command-identity" onClick={openSiteIdentity}>Logo, immagine e identità →</button>
    </section>
  );
  const renderVisibilityServices = () => (
    <div className="services-page">
      <section className="services-intro">
        <div><span>Piani e Upgrade</span><h2>Gestisci le automazioni del tuo spazio digitale</h2><p>Le funzionalità di acquisizione social, ottimizzazione AI e gestione clienti sono regolate dal tuo piano annuale.</p></div>
        <div className="services-badge">Zero intervento umano</div>
      </section>
      <div className="services-grid">
        {typeof PLATFORM_PLANS !== 'undefined' && PLATFORM_PLANS.map(module => (
          <article key={module.name} className={`service-card ${module.featured ? 'is-featured' : ''}`}>
            {module.featured && <span className="service-featured">Consigliato</span>}
            <h3>{module.name}</h3><strong>{module.price}</strong><p>{module.description}</p>
            <div>{module.deliverables.map(item => <span key={item}>✓ {item}</span>)}</div>
            <a href={`mailto:support@ideesitiweb.it?subject=${encodeURIComponent(`Richiesta passaggio al piano ${module.name} - ${user?.slug || ''}`)}`} className={`btn ${module.featured ? 'btn-primary' : 'btn-outline'}`}>Richiedi Upgrade</a>
          </article>
        ))}
      </div>
      <p className="services-note">Tutti i piani si intendono con fatturazione annuale. Non sono previsti costi nascosti o orari per gli interventi manuali: l'intero processo è automatizzato.</p>
    </div>
  );
  const renderAccountHub = () => (
    <div className="settings-hub">
      <section className="settings-hub-intro"><span>Configurazione</span><h2>Le impostazioni, in un unico posto</h2><p>Qui trovi profilo dell'attività, identità del sito e sicurezza dell'account.</p></section>
      <div className="settings-hub-grid">
        {[
          ['Profilo attività','Obiettivi, pubblico, servizi e territorio','strategy','✓'],
          ['Identità del sito','Logo, contenuti e anteprima del sito pubblico','experience','◇'],
          ['Sicurezza','Password e sessioni del tuo account','security','⌾'],
        ].map(([title,description,target,icon]) => <button key={target} onClick={() => setTab(target)}><span>{icon}</span><div><strong>{title}</strong><small>{description}</small></div><i>→</i></button>)}
      </div>
    </div>
  );
  return (
    <div className="dashboard-shell" style={{ overflow: studioWorkspaceOpen ? 'hidden' : 'visible' }}>
      {acquisitionModal && (
        <div className="acquisition-overlay" role="dialog" aria-modal="true" aria-live="polite" aria-labelledby="acquisition-title">
          <div className={`acquisition-modal is-${acquisitionModal.status}`}>
            <div className="acquisition-visual" aria-hidden="true">
              {acquisitionModal.status === 'working' ? <span className="acquisition-spinner" /> : acquisitionModal.status === 'success' ? '✓' : '!'}
            </div>
            <span className="acquisition-kicker">
              {acquisitionModal.status === 'working' ? 'Importazione in corso' : acquisitionModal.status === 'success' ? 'Operazione completata' : 'Serve attenzione'}
            </span>
            <h2 id="acquisition-title">{acquisitionModal.title}</h2>
            <p>{acquisitionModal.text}</p>
            {acquisitionModal.total > 0 && (
              <div className="acquisition-progress">
                <div><span style={{ width: `${Math.round((acquisitionModal.completed || 0) / acquisitionModal.total * 100)}%` }} /></div>
                <small>{acquisitionModal.completed || 0} di {acquisitionModal.total} contenuti elaborati</small>
              </div>
            )}
            {acquisitionModal.status === 'working' ? (
              <div className="acquisition-wait">Non chiudere questa pagina: continuiamo a lavorare sui tuoi contenuti.</div>
            ) : (
              <div className="acquisition-actions">
                <button className="btn btn-outline" onClick={() => setAcquisitionModal(null)}>Chiudi</button>
                {acquisitionModal.status === 'success' && <button className="btn btn-primary" onClick={() => { setAcquisitionModal(null); setTab('site'); }}>Vai agli articoli</button>}
              </div>
            )}
          </div>
        </div>
      )}
      <aside className="desktop-sidebar" style={{ visibility: studioWorkspaceOpen ? 'hidden' : 'visible', pointerEvents: studioWorkspaceOpen ? 'none' : 'auto' }}>
        <div className="sidebar-brand">
          <img src="/logo-cropped.png?v=2" alt="LinkSeoWeb" />
          <div><strong>LinkSeoWeb</strong><span>Area di lavoro</span></div>
        </div>
        <button className="sidebar-create" onClick={() => selectNavigation({ id: 'seo', section: 'ideas' })}>
          <span>＋</span><div><strong>Nuovo contenuto</strong><small>Parti da un’idea</small></div>
        </button>
        {renderSiteCommandPanel(false)}
        <nav className="sidebar-navigation" aria-label="Navigazione principale">
          {navigationGroups.map(group => (
            <div className="nav-section" key={group.label}>
              <div className="nav-group">{group.label}</div>
              {group.items.map(item => (
                <button key={`${item.id}-${item.section || ''}`} className={`nav-item ${isNavigationActive(item) ? 'is-active' : ''}`} onClick={() => selectNavigation(item)}>
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
                </button>
              ))}
            </div>
          ))}
          <div style={{ marginTop: 'auto', padding: '16px 12px' }}>
             <a href="/" target="_blank" rel="noopener noreferrer" className="nav-item" style={{ background: 'var(--primary)', color: 'white', fontWeight: 'bold', textDecoration: 'none' }}>
                <span className="nav-icon"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></span>
                <span className="nav-copy"><strong>Vai al Sito Pubblico</strong></span>
             </a>
          </div>
        </nav>
        <div className="sidebar-account">
          <div className="account-summary">
            <span>{user?.name?.[0]?.toUpperCase() || 'U'}</span>
            <div><strong>{user?.name || 'Utente'}</strong><small>{user?.email || ''}</small></div>
          </div>
          <div className="account-actions">
            <button onClick={() => selectNavigation({ id: 'settings', section: 'profile' })}>Profilo</button>
            <button onClick={onLogout}>Esci</button>
          </div>
        </div>
      </aside>

      <div className="dashboard-main" style={studioWorkspaceOpen ? { marginLeft: 0 } : undefined}>
        <div className="mobile-top-header">
          <div className="mobile-brand"><img src="/logo-cropped.png?v=2" alt="" /><strong>LinkSeoWeb</strong></div>
          <button className="mobile-menu-trigger" onClick={() => setMobileMenuOpen(true)} aria-label="Apri menu">☰</button>
        </div>

        <div className="dashboard-content">
          <header className="dashboard-page-header">
            <div className="page-heading">
              <div className="page-kicker">{activeNavigation?.group || 'Area di lavoro'}</div>
              <h1>{pageTitle}</h1>
              <p>{pageSubtitle}</p>
            </div>
            <div className="page-actions">
              <button className="btn btn-primary" onClick={syncNow} disabled={syncing}>{syncing ? '⟳ Aggiornamento…' : '↻ Aggiorna i canali'}</button>
            </div>
          </header>
        {syncMsg && (
          <div style={{ marginBottom: '1rem', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '14px',
            background: syncMsg.ok ? (syncMsg.loading ? 'var(--blue-light)' : 'var(--teal-light)') : 'var(--red-light)',
            color: syncMsg.ok ? (syncMsg.loading ? '#1E40AF' : '#0F6E56') : 'var(--red)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>{syncMsg.loading && <span style={{display:'inline-block', marginRight:'8px'}}>⟳</span>}{syncMsg.text}</div>
            {!syncMsg.loading && <button onClick={() => setSyncMsg(null)} style={{background:'none', border:'none', cursor:'pointer', fontSize:'16px'}}>✕</button>}
          </div>
        )}
        {(tab === 'overview' || tab === 'strategy') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {tab === 'overview' && <>
            <section className="trust-simulator-card">
              <div className="trust-simulator-copy"><span className="section-eyebrow">Prova verificabile</span><h2>Guarda cosa può accadere, usando i tuoi dati</h2><p>Nessuna promessa di traffico o vendite: questa simulazione mostra soltanto ciò che il sistema ha già acquisito, preparato e pubblicato.</p><div><button className="btn btn-primary" onClick={() => selectNavigation({ id: 'site' })}>Controlla gli articoli</button><a className="btn btn-outline" href={siteUrl} target="_blank" rel="noopener">Controlla il sito ↗</a></div></div>
              <div className="trust-simulator-steps">
                <article><span>1</span><div><strong>{sources.length} fonti reali</strong><small>Canali da cui arrivano i contenuti</small></div></article>
                <article><span>2</span><div><strong>{posts.length} contenuti acquisiti</strong><small>{posts.filter(post => Number(post.seo_score) >= 0).length} già trasformati in articoli</small></div></article>
                <article><span>3</span><div><strong>{publishedPosts.length} articoli online</strong><small>Apribili e controllabili sul sito pubblico</small></div></article>
              </div>
            </section>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              {[
                { n: networkPublishedPages, l: 'Pagine pubblicate', c: 'var(--primary)' },
                { n: networkPublishedPages, l: 'Pagine collegate alla rete', c: 'var(--amber)' },
                { n: Number(visibility.unique_visitors || 0).toLocaleString('it-IT'), l: 'Visite uniche giornaliere · 30 gg', c: 'var(--teal)' },
                { n: Number(visibility.actions || 0).toLocaleString('it-IT'), l: 'Azioni verso l’attività · 30 gg', c: 'var(--primary)' },
              ].map((s, i) => (
                <div key={i} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: '42px', fontWeight: 800, color: s.c, lineHeight: 1, textShadow: `0 0 15px ${s.c}33` }}>{s.n}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ marginBottom: '0.4rem', color: 'var(--text)' }}>Le persone stanno interagendo con il tuo spazio</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', maxWidth: '720px', lineHeight: 1.6 }}>
                    Qui contiamo visite e clic utili generati dalle tue pagine. Un’azione indica che qualcuno ha premuto su telefono, indicazioni, WhatsApp, prenotazione o social; non significa necessariamente che il contatto sia stato completato.
                  </p>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: '999px', background: 'var(--teal-light)', color: 'var(--teal)', fontSize: '12px', fontWeight: 800 }}>
                  Collegamento alla rete attivo
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginTop: '1.25rem' }}>
                {[
                  ['Percorsi scelti', visibility.event_counts?.path_select || 0],
                  ['Contenuti aperti', visibility.event_counts?.path_content_click || 0],
                  ['Clic sul numero', visibility.event_counts?.call_click || 0],
                  ['Indicazioni', visibility.event_counts?.directions_click || 0],
                  ['WhatsApp', visibility.event_counts?.whatsapp_click || 0],
                  ['Prenotazione', visibility.event_counts?.booking_click || 0],
                  ['Social', visibility.event_counts?.social_click || 0],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '1rem', borderRadius: '12px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>{value}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            </>}

            {tab === 'strategy' && <GuidedStrategy
              understanding={activeUnderstanding}
              declared={declaredStrategy}
              progress={strategyProgress}
              step={strategyStep}
              setStep={setStrategyStep}
              updateField={updateDeclaredStrategy}
              updateList={updateDeclaredStrategyList}
              save={saveUnderstanding}
              saving={savingUnderstanding}
              refresh={refreshUnderstanding}
              refreshing={savingProfile}
              logoUrl={logoUrl}
              uploadLogo={uploadBrandLogo}
              uploadingLogo={uploadingLogo}
              sourcesCount={sources.length}
            />}

            {false && <div id="strategy-legacy" className="card" style={{ padding: '1.5rem', background: 'var(--surface)', border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ maxWidth: '680px' }}>
                  <div style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.08em' }}>Strategia dichiarata da te</div>
                  <h3 style={{ margin: '0.4rem 0', color: 'var(--text)', fontSize: '22px' }}>Aiutaci a raggiungere le persone giuste</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.65 }}>Dai social possiamo capire cosa pubblichi. Solo tu puoi dirci quali clienti vuoi raggiungere, dove si trovano e quale azione vuoi ottenere. Le tue risposte hanno sempre priorità sulle ipotesi dell’AI.</p>
                </div>
                <div style={{ minWidth: '180px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, color: 'var(--text)', marginBottom: '7px' }}><span>Profilo strategico</span><span>{strategyProgress}%</span></div>
                  <div style={{ height: '9px', background: 'var(--bg)', borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--border)' }}><div style={{ width: `${strategyProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--teal))', transition: 'width .25s ease' }} /></div>
                </div>
              </div>

              <div style={{ marginTop: '1.4rem', padding: '1rem', background: 'var(--primary-light)', borderRadius: '14px', color: 'var(--text)', fontSize: '13px', lineHeight: 1.6 }}>
                <strong>La base proposta dall’AI:</strong> {activeUnderstanding.vertical_label || 'attività da definire'}{activeUnderstanding.business_model ? ` · ${activeUnderstanding.business_model}` : ''}. Confermala attraverso le risposte qui sotto: non useremo più le supposizioni come se fossero dati certi.
              </div>

              <div style={{ display: 'grid', gap: '1.15rem', marginTop: '1.35rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <label className="form-group"><span className="label">Che tipo di attività sei?</span><input value={declaredStrategy.activity_type || ''} onChange={e => updateDeclaredStrategy('activity_type', e.target.value)} placeholder="Es. agriturismo con ristorante e ospitalità" /></label>
                  <label className="form-group"><span className="label">Cosa offri concretamente?</span><input value={declaredStrategy.offer_summary || ''} onChange={e => updateDeclaredStrategy('offer_summary', e.target.value)} placeholder="Es. soggiorni, cucina locale, piscina ed eventi" /></label>
                </div>

                <div>
                  <div className="label" style={{ marginBottom: '0.65rem' }}>Qual è il risultato più importante?</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {STRATEGY_GOALS.map(([value, label]) => <button key={value} type="button" onClick={() => updateDeclaredStrategy('primary_goal', value)} style={{ padding: '9px 12px', borderRadius: '999px', cursor: 'pointer', border: declaredStrategy.primary_goal === value ? '1px solid var(--primary)' : '1px solid var(--border-strong)', background: declaredStrategy.primary_goal === value ? 'var(--primary)' : 'var(--bg)', color: declaredStrategy.primary_goal === value ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: '13px' }}>{label}</button>)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '1rem' }}>
                  <label className="form-group"><span className="label">Pubblico principale che vuoi raggiungere</span><textarea value={declaredStrategy.primary_audience || ''} onChange={e => updateDeclaredStrategy('primary_audience', e.target.value)} placeholder="Es. coppie e famiglie di Roma, 30–60 anni, interessate a weekend nella natura" style={{ minHeight: '92px', resize: 'vertical' }} /></label>
                  <label className="form-group"><span className="label">Pubblico secondario · facoltativo</span><textarea value={declaredStrategy.secondary_audience || ''} onChange={e => updateDeclaredStrategy('secondary_audience', e.target.value)} placeholder="Es. aziende che cercano una location per eventi e ritiri" style={{ minHeight: '92px', resize: 'vertical' }} /></label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <label className="form-group"><span className="label">Territorio da raggiungere</span><input value={declaredStrategy.geographic_area || ''} onChange={e => updateDeclaredStrategy('geographic_area', e.target.value)} placeholder="Es. Roma, Lazio e Centro Italia" /></label>
                  <label className="form-group"><span className="label">Azione che desideri ottenere</span><input value={declaredStrategy.desired_action || ''} onChange={e => updateDeclaredStrategy('desired_action', e.target.value)} placeholder="Es. richiesta disponibilità su WhatsApp" /></label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '1rem' }}>
                  <label className="form-group"><span className="label">Servizi o prodotti prioritari · uno per riga</span><textarea value={(declaredStrategy.priority_services || []).join('\n')} onChange={e => updateDeclaredStrategyList('priority_services', e.target.value)} placeholder={'Soggiorni weekend\nRistorante\nEventi privati'} style={{ minHeight: '112px', resize: 'vertical' }} /></label>
                  <label className="form-group"><span className="label">Perché dovrebbero scegliere te?</span><textarea value={declaredStrategy.differentiators || ''} onChange={e => updateDeclaredStrategy('differentiators', e.target.value)} placeholder="Elementi distintivi, esperienza, metodo, posizione, qualità o vantaggi concreti" style={{ minHeight: '112px', resize: 'vertical' }} /></label>
                </div>

                <label className="form-group"><span className="label">Quali esigenze o dubbi ha questo pubblico? · facoltativo</span><textarea value={declaredStrategy.customer_needs || ''} onChange={e => updateDeclaredStrategy('customer_needs', e.target.value)} placeholder="Es. vuole sapere se la struttura è adatta ai bambini, quanto dista da Roma e cosa è incluso" style={{ minHeight: '82px', resize: 'vertical' }} /></label>

                {!!(activeUnderstanding.editorial_direction?.critical_unknowns || []).length && <div style={{ padding: '1rem', borderRadius: '14px', background: 'var(--amber-light)', color: 'var(--text)' }}><div style={{ fontWeight: 800, marginBottom: '0.45rem' }}>Cose che i social non ci hanno permesso di capire</div><div style={{ fontSize: '13px', lineHeight: 1.65 }}>{activeUnderstanding.editorial_direction.critical_unknowns.join(' · ')}</div></div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="btn btn-outline" onClick={refreshUnderstanding} disabled={savingProfile}>{savingProfile ? 'Analisi…' : 'Aggiorna la proposta AI'}</button>
                  <button className="btn btn-primary" onClick={saveUnderstanding} disabled={savingUnderstanding} style={{ padding: '10px 18px' }}>{savingUnderstanding ? 'Salvataggio…' : 'Salva la mia strategia'}</button>
                </div>
              </div>
            </div>}

            {tab === 'overview' && <>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Sincronizzazione dei canali</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Un controllo periodico aggiorna i canali abilitati e ignora quelli impostati come manuali. Puoi decidere per ogni profilo nella sezione Canali.
                </p>
                <div style={{ padding: '12px', background: 'var(--gray-light)', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>Ultimo sync:</span>
                  <span>{site?.last_sync ? new Date(site.last_sync).toLocaleString('it-IT') : 'Mai effettuato'}</span>
                </div>
              </div>
              
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Scorciatoie veloci</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => setTab('seo')} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>🕸️ Controlla pagine e visibilità</button>
                  <button onClick={() => setTab('sources')} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>➕ Aggiungi un nuovo canale social</button>
                  <button onClick={() => setTab('site')} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>✏️ Rivedi un articolo pubblicato</button>
                </div>
              </div>
            </div>
            </>}
          </div>
        )}

        {/* Tab: I miei canali (UNIFICATO) */}
        {tab === 'sources' && (() => {
          // Costruisci lista unificata: prima le connessioni OAuth, poi le sorgenti URL
          const allChannels = [];

          // Canali OAuth
          connections.filter(c => c.active).forEach(c => {
            allChannels.push({
              key: 'oauth_' + c.platform,
              type: 'oauth',
              platform: c.platform === 'instagram_login' ? 'instagram' : c.platform,
              rawPlatform: c.platform,
              handle: c.handle,
              since_date: c.since_date,
              auto_publish: c.auto_publish,
              auto_sync: c.auto_sync,
              max_posts: c.max_posts,
              content_count: Number(c.content_count || 0),
              published_count: Number(c.published_count || 0),
              draft_count: Number(c.draft_count || 0),
              processing_count: Number(c.processing_count || 0),
              failed_count: Number(c.failed_count || 0),
              last_content_at: c.last_content_at || null,
              label: c.handle ? `@${c.handle}` : '',
            });
          });

          // Sorgenti URL scraping
          sources.forEach(s => {
            // Evita duplicati se c'è già un OAuth per la stessa piattaforma
            const hasOAuth = connections.some(c => c.active && (c.platform === s.platform || (c.platform === 'instagram_login' && s.platform === 'instagram')));
            allChannels.push({
              key: 'src_' + s.id,
              type: 'scraping',
              platform: s.platform,
              rawPlatform: s.platform,
              sourceId: s.id,
              url: s.url,
              label: s.label,
              since_date: s.since_date,
              auto_publish: s.auto_publish,
              auto_sync: s.auto_sync,
              max_posts: s.max_posts,
              content_count: Number(s.content_count || 0),
              published_count: Number(s.published_count || 0),
              draft_count: Number(s.draft_count || 0),
              processing_count: Number(s.processing_count || 0),
              failed_count: Number(s.failed_count || 0),
              last_content_at: s.last_content_at || null,
              topic_summary: s.topic_summary,
              hasDuplicateOAuth: hasOAuth,
            });
          });


          const detectedPlatform = detectPlatformFromUrl(addUrl);
          const trackedPlatforms = new Set(allChannels.map(channel => channel.platform));
          const acquiredPosts = posts.filter(post => trackedPlatforms.has(post.platform === 'instagram_login' ? 'instagram' : post.platform));
          const newestChannelDate = allChannels.map(channel => channel.last_content_at).filter(Boolean).sort().reverse()[0] || null;

          return (
            <div className="channels-workspace">

              <section className="channels-hero">
                <div><span>Acquisizione contenuti</span><h2>{allChannels.length ? `${allChannels.length} canali sotto controllo` : 'Collega il primo canale'}</h2><p>Qui vedi subito quanto materiale è stato acquisito e quando è arrivato l'ultimo contenuto.</p></div>
                <div className="channels-hero-metrics"><div><strong>{acquiredPosts.length}</strong><span>contenuti acquisiti</span></div><div><strong>{newestChannelDate ? new Date(newestChannelDate).toLocaleDateString('it-IT') : '—'}</strong><span>ultimo contenuto</span></div></div>
              </section>

              {/* Form Aggiungi Canale */}
              <details className="card channel-add-panel" open={allChannels.length === 0}>
                <summary>+ Aggiungi un nuovo canale</summary>
                <div className="channel-add-body">
                <h2 style={{ marginBottom: '0.5rem', fontSize: '18px' }}>➕ Aggiungi un canale</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Incolla il link del tuo profilo social o del tuo sito web. Il sistema riconosce automaticamente la piattaforma e importa i tuoi contenuti.
                </p>
                <form onSubmit={handleAddChannel} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="channel-url-input"
                      type="url"
                      placeholder="https://www.instagram.com/nomeutente/ oppure https://tuosito.it"
                      value={addUrl}
                      onChange={e => { setAddUrl(e.target.value); setAddMsg(null); }}
                      style={{ paddingLeft: detectedPlatform ? '40px' : '16px', transition: 'padding 0.2s' }}
                    />
                    {detectedPlatform && (
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <img src={SOCIAL[detectedPlatform]?.icon || ''} alt="" style={{ width: 18, height: 18 }} />
                      </span>
                    )}
                  </div>
                  {detectedPlatform && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--purple-light)', borderRadius: 'var(--radius-sm)' }}>
                      ✓ Rilevato: <strong>{SOCIAL[detectedPlatform]?.label || detectedPlatform}</strong> — {PLATFORM_DESCRIPTIONS[detectedPlatform] || ''}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Etichetta (opzionale) — Es: Il mio account principale"
                    value={addLabel}
                    onChange={e => setAddLabel(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" disabled={addLoading || !addUrl.trim()} style={{ alignSelf: 'flex-start', padding: '10px 24px' }}>
                    {addLoading ? '⟳ Aggiunta in corso...' : '+ Aggiungi canale'}
                  </button>
                </form>
                {addMsg && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px',
                    background: addMsg.ok ? 'var(--teal-light)' : 'var(--red-light)',
                    color: addMsg.ok ? '#0F6E56' : 'var(--red)' }}>
                    {addMsg.text}
                  </div>
                )}

                {/* Connessioni OAuth avanzate (YouTube, Facebook) */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Oppure collega tramite accesso ufficiale (più affidabile per YouTube e Facebook)
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {['youtube', 'facebook'].map(platform => {
                      const conn = connByPlatform[platform];
                      const isConnected = !!conn && conn.active;
                      return (
                        <button key={platform}
                          onClick={() => !isConnected && connectOAuth(platform)}
                          disabled={isConnected}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 500,
                            background: isConnected ? 'var(--teal-light)' : 'var(--surface)',
                            border: `1px solid ${isConnected ? 'var(--teal)' : 'var(--border-strong)'}`,
                            color: isConnected ? '#0F6E56' : 'var(--text)',
                            cursor: isConnected ? 'default' : 'pointer',
                          }}>
                          <img src={SOCIAL[platform]?.icon} alt="" style={{ width: 16, height: 16 }} />
                          {isConnected ? `✓ ${SOCIAL[platform]?.label} connesso come @${conn.handle}` : `Connetti ${SOCIAL[platform]?.label}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              </details>

              {/* Lista canali attivi */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>📡 I tuoi canali ({allChannels.length})</h2>
                  {allChannels.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={repairMedia}
                        disabled={repairingMedia || scanning}
                        className="btn btn-outline"
                        style={{ fontSize: '13px', padding: '8px 18px' }}
                      >
                        {repairingMedia ? 'Riparazione media...' : 'Ripara immagini'}
                      </button>
                      <button onClick={syncAllChannels} disabled={scanning || repairingMedia}
                        className="btn btn-primary" style={{ fontSize: '13px', padding: '8px 18px' }}>
                        {scanning ? '⟳ Sincronizzazione...' : '🔄 Sincronizza tutti'}
                      </button>
                    </div>
                  )}
                </div>

                {allChannels.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '1rem', opacity: 0.4 }}>📭</div>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Nessun canale aggiunto</div>
                    <div style={{ fontSize: '13px' }}>Incolla il link del tuo profilo nel campo qui sopra per iniziare.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {allChannels.map(channel => (
                      <div key={channel.key} style={{
                        padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-strong)', background: 'var(--bg)',
                        display: 'flex', flexDirection: 'column', gap: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={SOCIAL[channel.platform]?.icon || SOCIAL['website']?.icon} alt="" style={{ width: 22, height: 22 }} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                {channel.label || (SOCIAL[channel.platform]?.label || channel.platform)}
                                {channel.url && <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                  <a href={channel.url} target="_blank" rel="noopener" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                                    {channel.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                                  </a>
                                </span>}
                              </div>
                              <div style={{ fontSize: '11px', display: 'flex', gap: '6px', marginTop: '2px' }}>
                                <span style={{
                                  background: channel.type === 'oauth' ? 'var(--teal-light)' : 'var(--purple-light)',
                                  color: channel.type === 'oauth' ? '#0F6E56' : 'var(--purple-dark)',
                                  padding: '1px 7px', borderRadius: '10px', fontWeight: 500
                                }}>
                                  {channel.type === 'oauth' ? '🔗 Connesso con account' : '🔍 Fonte tramite indirizzo'}
                                </span>
                                <span style={{ background: (channel.auto_sync ?? 1) === 1 ? 'var(--teal-light)' : 'var(--gray-light)', color: (channel.auto_sync ?? 1) === 1 ? '#0F6E56' : 'var(--text-muted)', padding: '1px 7px', borderRadius: '10px', fontWeight: 600 }}>
                                  {(channel.auto_sync ?? 1) === 1 ? 'Controllo periodico attivo' : 'Solo manuale'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => removeChannel(channel)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '4px 8px', borderRadius: '4px' }}
                            title="Rimuovi canale">✕</button>
                        </div>

                        <div className="channel-content-stats">
                          <div><strong>{channel.content_count}</strong><span>acquisiti</span></div>
                          <div><strong>{channel.published_count}</strong><span>pubblicati</span></div>
                          <div><strong>{channel.draft_count}</strong><span>in bozza</span></div>
                          <div><strong>{channel.processing_count}</strong><span>in elaborazione</span></div>
                          <div className={channel.failed_count > 0 ? 'has-errors' : ''}><strong>{channel.failed_count}</strong><span>da riprovare</span></div>
                          <div className="last"><strong>{channel.last_content_at ? new Date(channel.last_content_at).toLocaleDateString('it-IT') : 'Mai'}</strong><span>ultimo contenuto</span></div>
                        </div>

                        <details className="channel-settings-details">
                          <summary>Impostazioni di acquisizione</summary>
                          <div className="channel-sync-settings">
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Dal:</span>
                          <input type="date" defaultValue={channel.since_date || ''}
                            title="Importa contenuti da questa data in poi"
                            onBlur={e => {
                              if (channel.type === 'oauth') saveConnectionSettings(channel.rawPlatform, e.target.value, channel.auto_publish ?? 1, channel.max_posts, channel.auto_sync ?? 1);
                              else savePlatformSource(channel.rawPlatform, channel.url, e.target.value, channel.auto_publish ?? 1, channel.max_posts, channel.topic_summary, channel.auto_sync ?? 1);
                            }}
                            style={{ padding: '5px 8px', fontSize: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', width: '100%' }} />
                          <input type="number" min="1" max="500" placeholder="Max" defaultValue={channel.max_posts || ''}
                            title="Numero massimo di post da importare"
                            onBlur={e => {
                              const val = e.target.value || null;
                              if (channel.type === 'oauth') saveConnectionSettings(channel.rawPlatform, channel.since_date, channel.auto_publish ?? 1, val, channel.auto_sync ?? 1);
                              else savePlatformSource(channel.rawPlatform, channel.url, channel.since_date, channel.auto_publish ?? 1, val, channel.topic_summary, channel.auto_sync ?? 1);
                            }}
                            style={{ padding: '5px 8px', fontSize: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', width: '70px' }} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" defaultChecked={(channel.auto_publish ?? 1) === 1}
                              onChange={e => {
                                const ap = e.target.checked ? 1 : 0;
                                if (channel.type === 'oauth') saveConnectionSettings(channel.rawPlatform, channel.since_date, ap, channel.max_posts, channel.auto_sync ?? 1);
                                else savePlatformSource(channel.rawPlatform, channel.url, channel.since_date, ap, channel.max_posts, channel.topic_summary, channel.auto_sync ?? 1);
                              }} />
                            Pubblica auto
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Se disattivato, il canale viene aggiornato solo con Sincronizza tutti">
                            <input type="checkbox" defaultChecked={(channel.auto_sync ?? 1) === 1}
                              onChange={e => {
                                const automatic = e.target.checked ? 1 : 0;
                                if (channel.type === 'oauth') saveConnectionSettings(channel.rawPlatform, channel.since_date, channel.auto_publish ?? 1, channel.max_posts, automatic);
                                else savePlatformSource(channel.rawPlatform, channel.url, channel.since_date, channel.auto_publish ?? 1, channel.max_posts, channel.topic_summary, automatic);
                              }} />
                            Sincronizza automaticamente
                          </label>
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                )}

                {scanMsg && (
                  <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px',
                    background: scanMsg.ok ? 'var(--teal-light)' : 'var(--red-light)',
                    color: scanMsg.ok ? '#0F6E56' : 'var(--red)' }}>
                    {scanMsg.loading && <span style={{ marginRight: '8px' }}>⟳</span>}{scanMsg.text}
                  </div>
                )}
                {scanProgress.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {scanProgress.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 10px', background: 'var(--surface)', borderRadius: '4px' }}>
                        <span style={{ fontWeight: 600 }}>{s.label || s.platform}</span>
                        <span style={{ color: s.status === 'done' ? 'var(--teal)' : s.status === 'error' ? 'var(--red)' : 'var(--text-muted)' }}>
                          {s.status === 'pending' && '⏳ In coda'}
                          {s.status === 'scanning' && '🔍 Lettura in corso...'}
                          {s.status === 'done' && `✅ ${s.details}`}
                          {s.status === 'error' && `❌ Errore`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Profilazione AI */}
              {false && <div className="card">
                <h2 style={{ marginBottom: '0.5rem', fontSize: '18px' }}>🧠 Profilo editoriale</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Spiega all'AI chi sei e come deve comportarsi. Più dettagli dai, migliori saranno gli articoli generati.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className="label">Chi sei e cosa fai?</label>
                    <textarea value={profileDraft} onChange={e => setProfileDraft(e.target.value)}
                      placeholder="Es: Sono Marco, un artigiano che crea ceramiche e vende online..."
                      style={{ width: '100%', minHeight: '60px', resize: 'vertical', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: '14px' }} />
                  </div>
                  <div>
                    <label className="label">Pubblico target e obiettivo</label>
                    <textarea value={roleMissionDraft} onChange={e => setRoleMissionDraft(e.target.value)}
                      placeholder="Es: Mi rivolgo ad appassionati di design d'interni e voglio vendere i miei vasi..."
                      style={{ width: '100%', minHeight: '60px', resize: 'vertical', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: '14px' }} />
                  </div>
                  <div>
                    <label className="label">Tono di voce e regole editoriali</label>
                    <textarea value={strategyDraft} onChange={e => setStrategyDraft(e.target.value)}
                      placeholder="Es: Usa un tono ironico. NON parlare mai di argomenti sensibili..."
                      style={{ width: '100%', minHeight: '60px', resize: 'vertical', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: '14px' }} />
                  </div>
                  <button className="btn btn-outline" onClick={saveProfile} disabled={savingProfile} style={{ alignSelf: 'flex-start' }}>
                    {savingProfile ? 'Salvataggio...' : '💾 Salva profilo editoriale'}
                  </button>
                </div>
              </div>}

              {/* Importa da link diretto */}
              <details className="card channel-add-panel">
                <summary>Importa un singolo contenuto da un link</summary>
                <div className="channel-add-body">
                <h2 style={{ marginBottom: '0.5rem', fontSize: '18px' }}>🔗 Importa un contenuto specifico</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Incolla il link di un singolo video o post per importarlo e convertirlo subito in articolo.
                </p>
                <form onSubmit={doImport} style={{ display: 'flex', gap: '8px' }}>
                  <input className="channel-url-input" type="text" placeholder="https://www.youtube.com/watch?v=... oppure link Instagram/TikTok"
                    value={linkUrl} onChange={e => setLinkUrl(e.target.value)} style={{ flex: 1 }} />
                  <button type="submit" className="btn btn-primary" disabled={importing}>
                    {importing ? '⟳ Elaborazione...' : 'Importa'}
                  </button>
                </form>
                {importMsg && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px',
                    background: importMsg.ok ? 'var(--teal-light)' : 'var(--red-light)',
                    color: importMsg.ok ? '#0F6E56' : 'var(--red)' }}>
                    {importMsg.text}
                  </div>
                )}
                </div>
              </details>

            </div>
          );
        })()}

        {tab === 'experience' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <section className="card" style={{ padding: 'clamp(1.25rem, 3vw, 2rem)', background: 'linear-gradient(135deg, var(--surface), var(--primary-light))', border: '1px solid var(--border)' }}>
              <span style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: '999px', background: 'var(--teal-light)', color: 'var(--teal)', fontSize: '12px', fontWeight: 850 }}>STRUTTURA OTTIMIZZATA ATTIVA</span>
              <h2 style={{ margin: '0.8rem 0 0.55rem', color: 'var(--text)', fontSize: 'clamp(24px, 4vw, 36px)', lineHeight: 1.08 }}>Un sito semplice da capire, su ogni dispositivo</h2>
              <p style={{ maxWidth: '760px', margin: 0, color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.7 }}>La grafica non viene più reinventata dall’AI. Tutti i siti usano la stessa architettura editoriale, progettata per leggibilità, navigazione da tastiera, contrasto, mobile e accesso rapido agli articoli. Restano personali il tuo logo, i testi, le immagini e i contenuti.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '1.25rem' }}>
                <a className="btn btn-primary" href={siteUrl} target="_blank" rel="noopener">Apri il sito pubblico ↗</a>
                <button className="btn btn-outline" type="button" onClick={() => document.getElementById('visual-identity')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Scegli logo o immagine</button>
              </div>
            </section>
            <section className="card visual-identity-panel" id="visual-identity">
              <header><div><span className="section-eyebrow">Identità del sito</span><h2>Scegli nome e immagine</h2><p>Il cliente decide come presentarsi: il nome scritto qui resta prioritario e non viene sostituito dalle successive importazioni social.</p></div><a className="btn btn-outline" href={siteUrl} target="_blank" rel="noopener">Vedi anteprima ↗</a></header>
              <form className="site-name-editor" onSubmit={saveSiteTitle}>
                <label htmlFor="site-title"><strong>Nome del sito</strong><span>Comparirà nell’intestazione, nelle pagine e nei risultati condivisi.</span></label>
                <div><input id="site-title" type="text" maxLength={120} required value={siteTitleDraft} onChange={event => setSiteTitleDraft(event.target.value)} placeholder="Es. Studio Rossi, Casa Verde, Marco Bianchi" /><button className="btn btn-primary" type="submit" disabled={savingSiteTitle}>{savingSiteTitle ? 'Salvataggio…' : 'Salva nome'}</button></div>
              </form>
              <div className="visual-choice-intro"><strong>Immagine del sito</strong><span>Usa un logo se hai un marchio riconoscibile; scegli una foto per raccontare subito attività, luogo o persona.</span></div>
              <div className="visual-choice-grid" role="radiogroup" aria-label="Tipo di immagine del sito">
                {[
                  ['logo', 'Logo', 'Ideale per marchi e professionisti', logoUrl],
                  ['cover', 'Immagine rappresentativa', 'Ideale per luoghi, persone e attività', coverUrl],
                ].map(([mode, label, description, image]) => (
                  <button type="button" role="radio" aria-checked={brandVisualMode === mode} className={brandVisualMode === mode ? 'is-selected' : ''} onClick={() => selectBrandVisualMode(mode)} disabled={savingVisualMode} key={mode}>
                    <span className={`visual-choice-preview is-${mode}`}>{image ? <img src={image} alt="" /> : <b>{mode === 'logo' ? 'LOGO' : 'IMMAGINE'}</b>}</span>
                    <span><strong>{label}</strong><small>{description}</small></span><i>{brandVisualMode === mode ? '✓' : ''}</i>
                  </button>
                ))}
              </div>
              <div className="visual-upload-row">
                <div><strong>{brandVisualMode === 'cover' ? 'Immagine orizzontale consigliata' : 'Logo quadrato o orizzontale'}</strong><span>{brandVisualMode === 'cover' ? 'JPG, PNG o WebP · massimo 8 MB · rapporto consigliato 16:9' : 'JPG, PNG o WebP · massimo 3 MB · sfondo trasparente consigliato'}</span></div>
                <label className="btn btn-primary">{uploadingLogo ? 'Caricamento…' : `${brandVisualMode === 'cover' ? 'Carica immagine' : 'Carica logo'}`}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => uploadSiteVisual(event, brandVisualMode)} disabled={uploadingLogo} /></label>
              </div>
            </section>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
              {[
                ['01', 'Orientamento immediato', 'Home, articoli, argomenti e informazioni mantengono sempre una posizione riconoscibile.'],
                ['02', 'Lettura accessibile', 'Testi, contrasti, focus visibile e spaziature seguono regole comuni e verificabili.'],
                ['03', 'Mobile prima di tutto', 'Menu, schede e azioni si adattano senza nascondere i contenuti importanti.'],
                ['04', 'Identità autentica', 'Il sito usa il tuo marchio e il tuo patrimonio social, senza layout casuali generati.'],
              ].map(([number, title, description]) => <article className="card" key={number} style={{ padding: '1.25rem', border: '1px solid var(--border)' }}><span style={{ color: 'var(--primary)', fontWeight: 900, fontSize: '12px' }}>{number}</span><h3 style={{ margin: '0.55rem 0', color: 'var(--text)', fontSize: '17px' }}>{title}</h3><p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.65 }}>{description}</p></article>)}
            </div>
          </div>
        )}

        {/* Tab: Sito */}
        {tab === 'site' && (() => {
          const allPlatforms = [...new Set(posts.map(p => p.platform))].sort();
          const allTags = [...new Set(posts.flatMap(p => p.tags || []).map(t => t.toLowerCase()))].sort();
          const pendingPosts = posts.filter(p => Number(p.seo_score) < 0 && postProcessingStatus(p) !== 'processing');
          const filteredPosts = posts.filter(p => {
            if (dashboardFilter === 'all') return true;
            if (dashboardFilter.startsWith('published-')) return Number(p.published) === Number(dashboardFilter.replace('published-', ''));
            if (dashboardFilter.startsWith('platform-')) return p.platform === dashboardFilter.replace('platform-', '');
            if (dashboardFilter.startsWith('tag-')) return (p.tags || []).map(t => t.toLowerCase()).includes(dashboardFilter.replace('tag-', ''));
            if (dashboardFilter.startsWith('search-')) {
              const term = dashboardFilter.replace('search-', '');
              return `${p.edited_title || p.generated_title || ''} ${p.raw_content || ''} ${p.generated_excerpt || ''}`.toLowerCase().includes(term);
            }
            return true;
          });
          return (
          <div>
            <div style={{ marginBottom: '1.5rem', background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <input type="text" placeholder="🔍 Cerca contenuti per titolo o testo..." style={{ flex: '1 1 250px', border: '1px solid var(--border-strong)', padding: '10px 16px', borderRadius: '20px', background: 'var(--bg)' }} onChange={(e) => {
                const term = e.target.value.toLowerCase();
                if (term) setDashboardFilter('search-' + term);
                else setDashboardFilter('all');
              }} />
              <select onChange={(e) => setDashboardFilter(e.target.value)} value={dashboardFilter.startsWith('search-') ? 'all' : dashboardFilter} style={{ flex: '0 1 200px', padding: '10px 16px', fontSize: '13px', borderRadius: '20px', border: '1px solid var(--border-strong)', background: 'var(--bg)' }}>
                <option value="all">Tutti i contenuti</option>
                <optgroup label="Stato">
                  <option value="published-1">Pubblicati</option>
                  <option value="published-0">Bozze</option>
                </optgroup>
                <optgroup label="Social">
                  {allPlatforms.map(p => <option key={p} value={`platform-${p}`}>{SOCIAL[p]?.label || p}</option>)}
                </optgroup>
                <optgroup label="Tag">
                  {allTags.map(t => <option key={t} value={`tag-${t}`}>Tag: {t}</option>)}
                </optgroup>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a href={siteUrl} target="_blank" rel="noopener"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--purple)', color: '#fff', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
                  ✦ Apri lo Spazio Vivo
                </a>
                <a href={`${siteUrl}/sitemap.xml`} target="_blank" rel="noopener"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: '13px' }}>
                  🗺 Sitemap XML
                </a>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {pendingPosts.length > 0 && (
                  <button className="btn btn-primary" onClick={() => processPendingLoop(false)}>
                    ↻ Elabora {pendingPosts.length} contenuti
                  </button>
                )}
                {selectedPosts.length > 0 && (
                  <button onClick={bulkDeletePosts} style={{ background: 'var(--red)', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                    🗑 Elimina {selectedPosts.length} selezionati
                  </button>
                )}
                <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', overflow: 'hidden' }}>
                  <button onClick={() => setViewMode('grid')} style={{ background: viewMode === 'grid' ? 'var(--gray-light)' : 'transparent', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>🔲</button>
                  <button onClick={() => setViewMode('table')} style={{ background: viewMode === 'table' ? 'var(--gray-light)' : 'transparent', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>📄</button>
                </div>
              </div>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 2rem' }}>
                <div style={{ fontSize: '48px', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
                <h3 style={{ fontSize: '18px' }}>Nessun contenuto trovato</h3>
                <p style={{ fontSize: '14px', marginTop: '0.5rem' }}>Prova a cambiare i filtri di ricerca o clicca "Aggiorna ora".</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '2rem', width: '100%' }}>
                {filteredPosts.map(post => (
                  <div key={post.id} className="article-card">
                    
                    {/* Header: Sorgente Social */}
                    <div className="article-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Checkbox di selezione multipla */}
                        <input type="checkbox" checked={selectedPosts.includes(post.id)} onChange={() => togglePostSelection(post.id)} style={{ transform: 'scale(1.3)', cursor: 'pointer', margin: 0 }} />
                        <div style={{ background: 'var(--surface)', padding: '6px', borderRadius: '50%', boxShadow: 'var(--shadow-sm)', flexShrink: 0, display: 'flex' }}>
                          <SocialIcon platform={post.platform} size={20} />
                        </div>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)', textTransform: 'capitalize' }}>{SOCIAL[post.platform]?.label || post.platform}</span>
                        {/* Badge Stato (Nascoso/Bozza) */}
                        {Number(post.seo_score) < 0 ? (
                          <span className={`article-processing-badge ${postProcessingStatus(post) === 'failed' ? 'is-error' : ''}`}>
                            {postProcessingLabel(post)}
                          </span>
                        ) : (
                          <span className={`article-publication-status ${Number(post.published) === 1 ? 'is-published' : 'is-draft'}`}>
                            {Number(post.published) === 1 ? 'PUBBLICATO' : 'BOZZA'}
                          </span>
                        )}
                        {Number(post.noindex) === 1 && <span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap' }}>NOINDEX</span>}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {post.media_type === 'VIDEO' && <span style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>🎥 VIDEO</span>}
                        {Number(post.seo_score) < 0 ? (postProcessingStatus(post) === 'processing' ? <span className="article-processing-pulse" title="Elaborazione realmente in corso" /> : null) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: post.seo_score >= 80 ? 'var(--teal-light)' : (post.seo_score >= 50 ? 'var(--amber-light)' : 'var(--red-light)'), color: post.seo_score >= 80 ? 'var(--teal)' : (post.seo_score >= 50 ? 'var(--amber)' : 'var(--red)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', border: `2px solid ${post.seo_score >= 80 ? 'var(--teal)' : (post.seo_score >= 50 ? 'var(--amber)' : 'var(--red)')}`, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} title={`Score SEO: ${post.seo_score}`}>
                            {post.seo_score}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Contenuto Testuale */}
                    <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h4 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px', lineHeight: 1.4, color: 'var(--text)' }}>
                        {post.generated_title || (post.raw_content ? post.raw_content.substring(0, 80) : 'Nuovo contenuto')}
                      </h4>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.6, fontWeight: 500 }}>
                        {post.generated_excerpt || (post.generated_body ? post.generated_body.substring(0, 200) : Number(post.seo_score) < 0 ? postProcessingStatus(post) === 'failed' ? (post.processing_error || String(post.agent_notes || '').replace(/^Errore:\s*/, '')) : postProcessingStatus(post) === 'processing' ? 'Creazione articolo in corso.' : "Contenuto acquisito, pronto per essere elaborato." : '')}
                      </div>

                      {post.tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '20px' }}>
                          {post.tags.slice(0, 4).map(t => <span key={t} style={{ color: 'var(--primary-dark)', background: 'var(--primary-light)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>#{t}</span>)}
                        </div>
                      )}
                    </div>

                    {/* Azioni Fondo Card */}
                    {Number(post.seo_score) < 0 && <div className={`article-processing-note ${postProcessingStatus(post) === 'failed' ? 'is-error' : ''}`}>{postProcessingStatus(post) === 'failed' ? 'Il tentativo precedente non è riuscito. Usa Riprova per riavviare la lavorazione.' : postProcessingStatus(post) === 'processing' ? 'La creazione è già in corso: aprire questa pagina non la riavvia.' : 'Non è in lavorazione. Premi Elabora ora per avviarla.'}</div>}
                    <div className="article-card-footer">
                      {Number(post.seo_score) < 0 && <button className="article-retry-button" disabled={postProcessingStatus(post) === 'processing'} onClick={() => retryPendingPost(post.id)}>{postProcessingStatus(post) === 'processing' ? '⏳ IN CORSO' : postProcessingStatus(post) === 'failed' ? '↻ RIPROVA' : '▶ ELABORA ORA'}</button>}
                      <button disabled={Number(post.seo_score) < 0} onClick={() => openPostEditor(post)} style={{ flex: '1', padding: '10px', fontSize: '13px', fontWeight: 800, borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                        ✏️ MODIFICA
                      </button>
                      <button className={`article-publish-button ${Number(post.published) === 1 ? 'is-published' : 'is-draft'}`} disabled={Number(post.seo_score) < 0 || publishingPostId === post.id} onClick={() => togglePublishPost(post.id, post.published)}>
                        {publishingPostId === post.id ? 'AGGIORNAMENTO…' : Number(post.published) === 1 ? 'RIMUOVI DAL SITO' : 'PUBBLICA SUL SITO'}
                      </button>
                      <button onClick={() => deletePost(post.id)} title="Elimina" style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: '16px', cursor: 'pointer', background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        ❌
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-modal" style={{ padding: '0', overflowX: 'auto', background: 'rgba(0,0,0,0.2)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text)' }}>
                  <thead style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '16px', width: '40px' }}>
                        <input type="checkbox" checked={selectedPosts.length === filteredPosts.length && filteredPosts.length > 0} onChange={() => selectAllPosts(filteredPosts)} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                      </th>
                      <th style={{ padding: '16px', fontSize: '14px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '16px', fontSize: '14px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Titolo</th>
                      <th style={{ padding: '16px', fontSize: '14px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Social</th>
                      <th style={{ padding: '16px', fontSize: '14px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>SEO</th>
                      <th style={{ padding: '16px', fontSize: '14px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPosts.map(post => (
                      <tr key={post.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s ease' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '16px' }}>
                          <input type="checkbox" checked={selectedPosts.includes(post.id)} onChange={() => togglePostSelection(post.id)} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                        </td>
                        <td style={{ padding: '16px' }}>
                           {Number(post.seo_score) < 0 ? <span className={`article-processing-badge ${postProcessingStatus(post) === 'failed' ? 'is-error' : ''}`}>{postProcessingLabel(post)}</span> : <span className={`article-publication-status ${Number(post.published) === 1 ? 'is-published' : 'is-draft'}`}>{Number(post.published) === 1 ? 'PUBBLICATO' : 'BOZZA'}</span>}
                        </td>
                        <td style={{ padding: '16px', fontWeight: 600, fontSize: '15px' }}>
                          {post.generated_title || (post.raw_content ? `${post.raw_content.substring(0, 40)}...` : 'Contenuto acquisito')}
                          {Number(post.noindex) === 1 && <span style={{ display: 'inline-block', marginLeft: '8px', padding: '3px 7px', borderRadius: '999px', background: 'var(--red-light)', color: 'var(--red)', fontSize: '10px', fontWeight: 800 }}>NOINDEX</span>}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                            <SocialIcon platform={post.platform} size={20} /> {SOCIAL[post.platform]?.label}
                          </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ background: post.seo_score >= 80 ? 'rgba(0,255,150,0.1)' : (post.seo_score >= 50 ? 'rgba(255,149,0,0.1)' : 'rgba(255,0,50,0.1)'), color: post.seo_score >= 80 ? 'var(--teal)' : (post.seo_score >= 50 ? 'var(--amber)' : 'var(--red)'), padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 800, border: `1px solid ${post.seo_score >= 80 ? 'rgba(0,255,150,0.2)' : (post.seo_score >= 50 ? 'rgba(255,149,0,0.2)' : 'rgba(255,0,50,0.2)')}` }}>
                            {Number(post.seo_score) < 0 ? '—' : post.seo_score}
                          </span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            {Number(post.seo_score) < 0 && <button disabled={postProcessingStatus(post) === 'processing'} onClick={() => retryPendingPost(post.id)} className="article-retry-button">{postProcessingStatus(post) === 'processing' ? '⏳ In corso' : postProcessingStatus(post) === 'failed' ? '↻ Riprova' : '▶ Elabora'}</button>}
                            {Number(post.seo_score) >= 0 && <button onClick={() => openPostEditor(post)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>✏️ Modifica</button>}
                            {Number(post.seo_score) >= 0 && <button className={`article-publish-button is-compact ${Number(post.published) === 1 ? 'is-published' : 'is-draft'}`} disabled={publishingPostId === post.id} onClick={() => togglePublishPost(post.id, post.published)}>{publishingPostId === post.id ? 'Aggiornamento…' : Number(post.published) === 1 ? 'Rimuovi dal sito' : 'Pubblica sul sito'}</button>}
                            <button onClick={() => deletePost(post.id)} style={{ background: 'rgba(255,0,50,0.1)', border: '1px solid rgba(255,0,50,0.3)', color: 'var(--red)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>❌ Elimina</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
        })()}

        {/* Tab: SEO */}
        {tab === 'seo' && (
          <div>
            {/* Interruttore principale: se è spento, tutto il resto di questa
                scheda non produce risultati su Google. Va quindi in cima. */}
            <div className={`search-visibility-card ${Number(site?.search_visible) === 0 ? 'is-off' : 'is-on'}`}>
              <div className="search-visibility-copy">
                <h3>Fatti trovare da Google</h3>
                <p>
                  {Number(site?.search_visible) === 0
                    ? 'Il sito è online e raggiungibile da chi ha il link, ma chiede ai motori di ricerca di non indicizzarlo. Attivalo quando i contenuti sono pronti.'
                    : 'Il sito è aperto ai motori di ricerca: pagine e articoli possono comparire nei risultati e sono elencati nella sitemap.'}
                </p>
              </div>
              <label className="search-visibility-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={Number(site?.search_visible) !== 0}
                  disabled={savingSearchVisible}
                  onChange={e => toggleSearchVisible(e.target.checked)}
                />
                <span className="search-visibility-track" aria-hidden="true"><span className="search-visibility-thumb" /></span>
                <span className="search-visibility-state">
                  {savingSearchVisible ? 'Salvataggio…' : (Number(site?.search_visible) === 0 ? 'Nascosto' : 'Visibile')}
                </span>
              </label>
            </div>

            {visibilitySection !== 'ideas' && <div className="visibility-subnav">
              {[
                ['network', 'Configura la presenza'],
                ['overview', 'Pagine, dati e fonti'],
                ...(isAdmin ? [['lab', 'Laboratorio']] : []),
              ].map(([section, label]) => <button key={section} className={visibilitySection === section ? 'is-active' : ''} onClick={() => setVisibilitySection(section)}>{label}</button>)}
            </div>}

            {isAdmin && visibilitySection === 'lab' && <SpazioVivoLab token={token} adminPreview />}

            {visibilitySection === 'network' && <div className="presence-workspace">
              <section className="presence-hero">
                <div className="presence-hero-copy"><span>La tua presenza digitale</span><h2>{reachability.score || 0}% configurata</h2><p>Questa percentuale misura ciò che hai realmente predisposto. I dati Google sono separati perché dipendono dalla scansione e non possono essere promessi.</p></div>
                <div className="presence-score" style={{ '--score': `${reachability.score || 0}%` }}><strong>{reachability.score || 0}%</strong><span>configurazione</span></div>
              </section>

              <section className="google-progress-panel">
                <div className="google-progress-heading"><div><span>Monitoraggio automatico incluso</span><h3>Google: copertura delle pagine</h3></div><small>{reachability.google?.has_evidence ? 'Dati Google aggiornati automaticamente' : 'Raccolta dati in corso'}</small></div>
                <div className="google-progress-grid">
                  {[
                    ['Monitoraggio', 100, 'Gestito centralmente da LinkSeoWeb: non devi configurare nulla'],
                    ['Pagine rilevate', reachability.google?.presence_percent || 0, `${reachability.google?.visible_pages || 0} su ${reachability.google?.published_pages || 0} pagine con segnali Google`],
                  ].map(([label, value, detail]) => <div className="google-progress-card" key={label}><div><strong>{value}%</strong><span>{label}</span></div><div className="progress-track"><span style={{ width: `${value}%` }} /></div><p>{detail}</p></div>)}
                </div>
                <div className="google-progress-note">La percentuale “Pagine rilevate” misura la copertura osservata, non la posizione. I dati possono comparire dopo alcuni giorni dalla pubblicazione.</div>
              </section>

              <section className="presence-setup">
                <header><div><span>Rispondi una volta, il sistema usa tutto</span><h3>Completa la tua presenza</h3><p>Ogni blocco corrisponde a una decisione comprensibile. Non devi interpretare indicatori tecnici.</p></div><strong>{(reachability.checks || []).filter(check => check.done).length}/{(reachability.checks || []).length} pronti</strong></header>

                <div className="presence-step">
                  <div className="presence-step-number">1</div><div className="presence-step-body"><h4>Qual è la tua presenza ufficiale?</h4><p>Puoi usare soltanto lo Spazio Vivo oppure collegarlo a un sito che possiedi già.</p>
                    <div className="presence-choice-grid">
                      <button className={reachabilityDraft.presence_mode === 'space_only' ? 'is-selected' : ''} onClick={() => setReachabilityDraft(prev => ({ ...prev, presence_mode: 'space_only', official_site_url: '', reciprocal_link_confirmed: false }))}><strong>Non ho un sito</strong><span>Spazio Vivo è la mia presenza ufficiale</span></button>
                      <button className={reachabilityDraft.presence_mode === 'existing_site' ? 'is-selected' : ''} onClick={() => setReachabilityDraft(prev => ({ ...prev, presence_mode: 'existing_site' }))}><strong>Ho già un sito</strong><span>Voglio collegarlo allo Spazio Vivo</span></button>
                    </div>
                    {reachabilityDraft.presence_mode === 'existing_site' && <div className="presence-conditional"><label><span>Indirizzo del sito</span><input value={reachabilityDraft.official_site_url || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, official_site_url: e.target.value }))} placeholder="https://www.tuodominio.it" /></label><label className="presence-checkbox"><input type="checkbox" checked={!!reachabilityDraft.reciprocal_link_confirmed} onChange={e => setReachabilityDraft(prev => ({ ...prev, reciprocal_link_confirmed: e.target.checked }))} /><span>Ho inserito nel mio sito un link verso lo Spazio Vivo</span></label></div>}
                  </div>
                </div>

                <div className="presence-step">
                  <div className="presence-step-number">2</div><div className="presence-step-body"><h4>Per cosa e dove vuoi essere trovato?</h4><p>Queste informazioni guidano pagine, titoli, collegamenti e contenuti futuri.</p><div className="presence-fields two"><label><span>Attività o ricerca principale</span><input value={reachabilityDraft.primary_topic || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, primary_topic: e.target.value }))} placeholder="Es. agriturismo con ristorante vicino Roma" /></label><label><span>Profilo Google dell’attività</span><input value={reachabilityDraft.business_profile_url || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, business_profile_url: e.target.value }))} placeholder="Link Google Maps o Business Profile" /></label><label className="full"><span>Territori serviti · uno per riga</span><textarea rows={3} value={(reachabilityDraft.service_areas || []).join('\n')} onChange={e => setReachabilityDraft(prev => ({ ...prev, service_areas: e.target.value.split('\n') }))} placeholder={'Roma\nCastelli Romani\nLazio'} /></label></div></div>
                </div>

                <div className="presence-step">
                  <div className="presence-step-number">3</div><div className="presence-step-body"><h4>Come possono contattarti?</h4><p>I pulsanti vengono mostrati automaticamente negli articoli. I campi vuoti non compaiono.</p><div className="presence-fields three"><label><span>Telefono</span><input value={reachabilityDraft.phone || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, phone: e.target.value }))} placeholder="+39 06 1234567" /></label><label><span>WhatsApp</span><input value={reachabilityDraft.whatsapp || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, whatsapp: e.target.value }))} placeholder="340 1234567" /></label><label><span>Email</span><input type="email" value={reachabilityDraft.email || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, email: e.target.value }))} placeholder="info@attivita.it" /></label></div></div>
                </div>

                <div className="presence-save"><div><strong>Le tue risposte alimentano tutto il sistema</strong><span>Pagine, dati strutturati, contatti e analisi useranno queste informazioni.</span></div><button className="btn btn-primary" onClick={saveReachabilityNetwork} disabled={savingReachability}>{savingReachability ? 'Salvataggio…' : 'Salva e aggiorna la presenza'}</button></div>
              </section>

              <section className="presence-status-summary"><header><div><span>Verifiche tecniche</span><h3>Cosa è già pronto</h3></div><p>Questi controlli si aggiornano dalle risposte e dal lavoro reale della piattaforma.</p></header><div>{(reachability.checks || []).map(check => <article key={check.id} className={check.done ? 'is-done' : ''}><span>{check.done ? '✓' : '→'}</span><div><strong>{check.label}</strong><small>{check.detail}</small></div></article>)}</div></section>
            </div>}

            {false && visibilitySection === 'network' && <>
              <section className="glass-modal" style={{ marginBottom: '1.25rem', padding: 'clamp(1.25rem, 3vw, 2rem)', color: '#fff', background: 'radial-gradient(circle at 88% 8%, rgba(243,92,118,.34), transparent 27%), linear-gradient(135deg,#151A2D,#292359 68%,#48257A)', border: 'none', overflow: 'hidden' }}>
                <div className="reachability-hero-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: '1.5rem' }}>
                  <div>
                    <div style={{ color: '#D9CEFF', fontSize: '12px', fontWeight: 850, letterSpacing: '.1em', textTransform: 'uppercase' }}>LinkSeoWeb · controllo continuo</div>
                    <h2 style={{ margin: '.45rem 0 .65rem', color: '#fff', fontSize: 'clamp(25px,4vw,40px)', letterSpacing: '-.04em' }}>Network della Reperibilità</h2>
                    <p style={{ maxWidth: '720px', margin: 0, color: 'rgba(255,255,255,.76)', lineHeight: 1.65 }}>Unisce Spazio Vivo, sito ufficiale, social e motori di ricerca. Verifica ciò che è pubblicato, collegato, rilevato e capace di generare un’azione.</p>
                    <span style={{ display: 'inline-flex', marginTop: '.85rem', padding: '.4rem .7rem', borderRadius: '999px', background: 'rgba(255,255,255,.11)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fase attuale · {reachability.stage || 'configurazione'}</span>
                  </div>
                  <div style={{ width: '132px', height: '132px', borderRadius: '50%', display: 'grid', placeItems: 'center', textAlign: 'center', background: `conic-gradient(#8E7CFF ${Number(reachability.score || 0) * 3.6}deg, rgba(255,255,255,.12) 0)`, boxShadow: 'inset 0 0 0 12px rgba(17,20,39,.72)' }}>
                    <div><strong style={{ display: 'block', fontSize: '34px', lineHeight: 1 }}>{reachability.score || 0}</strong><span style={{ fontSize: '11px', color: 'rgba(255,255,255,.7)' }}>/ 100 verificato</span></div>
                  </div>
                </div>
                <div className="reachability-funnel" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(120px,1fr))', gap: '8px', marginTop: '1.5rem' }}>
                  {[
                    ['Pubblicato', reachability.published_pages || 0, (reachability.published_pages || 0) > 0],
                    ['Rilevato da Google', reachability.google_visible_pages || 0, (reachability.google_visible_pages || 0) > 0],
                    ['Clic ottenuti', reachability.clicks || 0, (reachability.clicks || 0) > 0],
                    ['Azioni generate', reachability.actions || 0, (reachability.actions || 0) > 0],
                  ].map(([label, value, active]) => <div key={label} style={{ padding: '1rem', borderRadius: '14px', background: active ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.07)', border: `1px solid ${active ? 'rgba(217,206,255,.5)' : 'rgba(255,255,255,.1)'}` }}><strong style={{ display: 'block', fontSize: '24px' }}>{value}</strong><span style={{ color: 'rgba(255,255,255,.7)', fontSize: '11px' }}>{label}</span></div>)}
                </div>
              </section>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: '1.25rem', alignItems: 'start' }}>
                <section className="glass-modal" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.08em' }}>Stato verificabile</div>
                  <h3 style={{ margin: '.4rem 0 .35rem', color: 'var(--text)' }}>Cosa rende trovabile la tua presenza</h3>
                  <p style={{ margin: '0 0 1.15rem', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.55 }}>Ogni voce completata corrisponde a un segnale reale, non a una promessa di posizione.</p>
                  <div style={{ display: 'grid', gap: '.65rem' }}>
                    {(reachability.checks || []).map(check => <div key={check.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '.75rem', alignItems: 'center', padding: '.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: check.done ? 'var(--teal-light)' : 'var(--bg)' }}>
                      <div style={{ width: '32px', height: '32px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: check.done ? 'var(--teal)' : 'var(--border)', color: check.done ? '#fff' : 'var(--text-muted)', fontWeight: 900 }}>{check.done ? '✓' : '·'}</div>
                      <div><strong style={{ display: 'block', color: 'var(--text)', fontSize: '13px' }}>{check.label}</strong><span style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.35 }}>{check.detail}</span></div>
                    </div>)}
                  </div>
                </section>

                <section className="glass-modal" style={{ padding: '1.5rem', border: '1px solid var(--primary)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.08em' }}>Punto centrale</div>
                  <h3 style={{ margin: '.4rem 0 .35rem', color: 'var(--text)' }}>Collega la tua presenza ufficiale</h3>
                  <p style={{ margin: '0 0 1.2rem', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.55 }}>Questi riferimenti permettono di costruire un’identità coerente tra sito, Spazio Vivo, social e presenza locale.</p>
                  <label style={{ display: 'block', marginBottom: '.9rem' }}><span style={{ display: 'block', marginBottom: '.35rem', fontSize: '12px', fontWeight: 750 }}>Sito ufficiale</span><input value={reachabilityDraft.official_site_url || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, official_site_url: e.target.value }))} placeholder="https://www.tuodominio.it" style={{ width: '100%', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} /></label>
                  <label style={{ display: 'block', marginBottom: '.9rem' }}><span style={{ display: 'block', marginBottom: '.35rem', fontSize: '12px', fontWeight: 750 }}>Profilo Google dell’attività</span><input value={reachabilityDraft.business_profile_url || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, business_profile_url: e.target.value }))} placeholder="Link Google Maps o Business Profile" style={{ width: '100%', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} /></label>
                  <label style={{ display: 'block', marginBottom: '.9rem' }}><span style={{ display: 'block', marginBottom: '.35rem', fontSize: '12px', fontWeight: 750 }}>Per cosa vuoi essere trovato principalmente?</span><input value={reachabilityDraft.primary_topic || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, primary_topic: e.target.value }))} placeholder="Es. agriturismo con ristorante vicino Roma" style={{ width: '100%', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} /></label>
                  <div style={{ margin: '1.25rem 0 .9rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Come farsi contattare</div>
                    <p style={{ margin: '.35rem 0 0', fontSize: '12.5px', lineHeight: 1.55, color: 'var(--text-muted)' }}>
                      Compaiono in fondo a ogni articolo, dove atterra chi arriva da una ricerca su Google.
                      Vengono mostrati solo i campi compilati: quelli vuoti non generano pulsanti.
                    </p>
                  </div>
                  <label style={{ display: 'block', marginBottom: '.9rem' }}><span style={{ display: 'block', marginBottom: '.35rem', fontSize: '12px', fontWeight: 750 }}>Telefono</span><input value={reachabilityDraft.phone || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, phone: e.target.value }))} placeholder="+39 06 1234567" style={{ width: '100%', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} /></label>
                  <label style={{ display: 'block', marginBottom: '.9rem' }}><span style={{ display: 'block', marginBottom: '.35rem', fontSize: '12px', fontWeight: 750 }}>WhatsApp</span><input value={reachabilityDraft.whatsapp || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, whatsapp: e.target.value }))} placeholder="340 1234567" style={{ width: '100%', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} /></label>
                  <label style={{ display: 'block', marginBottom: '.9rem' }}><span style={{ display: 'block', marginBottom: '.35rem', fontSize: '12px', fontWeight: 750 }}>Email</span><input type="email" value={reachabilityDraft.email || ''} onChange={e => setReachabilityDraft(prev => ({ ...prev, email: e.target.value }))} placeholder="info@tuodominio.it" style={{ width: '100%', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} /></label>
                  <label style={{ display: 'block', marginBottom: '.9rem' }}><span style={{ display: 'block', marginBottom: '.35rem', fontSize: '12px', fontWeight: 750 }}>Territori serviti · uno per riga</span><textarea value={(reachabilityDraft.service_areas || []).join('\n')} onChange={e => setReachabilityDraft(prev => ({ ...prev, service_areas: e.target.value.split('\n') }))} placeholder={'Roma\nCastelli Romani\nLazio'} rows={3} style={{ width: '100%', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }} /></label>
                  <label style={{ display: 'flex', gap: '.65rem', alignItems: 'flex-start', padding: '.85rem', borderRadius: '11px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '12px', lineHeight: 1.45, marginBottom: '1rem' }}><input type="checkbox" checked={!!reachabilityDraft.reciprocal_link_confirmed} onChange={e => setReachabilityDraft(prev => ({ ...prev, reciprocal_link_confirmed: e.target.checked }))} style={{ marginTop: '2px' }} /><span>Ho inserito nel sito ufficiale un collegamento allo Spazio Vivo. Questo crea un ponte percorribile in entrambe le direzioni.</span></label>
                  <button className="btn btn-primary" onClick={saveReachabilityNetwork} disabled={savingReachability} style={{ width: '100%', justifyContent: 'center' }}>{savingReachability ? 'Aggiornamento…' : 'Aggiorna il Network'}</button>
                </section>
              </div>
              <div style={{ marginTop: '1rem', padding: '1rem 1.15rem', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.55 }}><strong style={{ color: 'var(--text)' }}>Garanzia operativa:</strong> LinkSeoWeb può garantire pubblicazione, accessibilità, collegamenti, segnali tecnici e monitoraggio. L’indicizzazione e la posizione finale restano decisioni dei motori di ricerca.</div>
            </>}

            {visibilitySection === 'overview' && <div className="data-workspace">
              <section className="data-hero">
                <div>
                  <span className="section-eyebrow">Pagine, dati e fonti</span>
                  <h2>Capisci subito cosa esiste e cosa sta vedendo Google</h2>
                  <p>I numeri non vengono mescolati: ogni indicatore mostra la propria fonte e la data dell'ultimo aggiornamento.</p>
                </div>
                <div className="coverage-dial" style={{ '--coverage': `${reachability.google?.presence_percent || 0}%` }}>
                  <strong>{reachability.google?.presence_percent || 0}%</strong>
                  <span>pagine rilevate</span>
                </div>
              </section>

              <section className="metric-grid">
                {[
                  { value: networkPublishedPages, label: 'Pagine pubbliche nella rete', source: 'Database LinkSeoWeb', tone: 'violet' },
                  { value: reachability.google?.has_evidence ? (reachability.google?.visible_pages || visibility.visible_pages || 0) : '—', label: 'Pagine rilevate da Google', source: reachability.google?.has_evidence ? 'Monitoraggio automatico' : 'Raccolta dati in corso', tone: 'blue' },
                  { value: reachability.google?.has_evidence ? Number(visibility.impressions || 0).toLocaleString('it-IT') : '—', label: 'Visualizzazioni su Google · 30 gg', source: reachability.google?.has_evidence ? 'Monitoraggio automatico' : 'Dato non ancora disponibile', tone: 'amber' },
                  { value: Number(visibility.unique_visitors || 0).toLocaleString('it-IT'), label: 'Visitatori dello Spazio · 30 gg', source: 'Analytics interno', tone: 'teal' },
                  { value: Number(visibility.actions || 0).toLocaleString('it-IT'), label: 'Contatti e azioni · 30 gg', source: 'Analytics interno', tone: 'green' },
                ].map(metric => <article key={metric.label} className={`metric-card tone-${metric.tone}`}>
                  <span className="metric-source">{metric.source}</span>
                  <strong>{metric.value}</strong>
                  <p>{metric.label}</p>
                </article>)}
              </section>

              <div className="data-columns">
                <section className="data-panel source-panel">
                  <header><div><span className="section-eyebrow">Trasparenza</span><h3>Da dove arrivano i dati</h3></div><span className="live-badge">Fonti separate</span></header>
                  <div className="source-list">
                    {(reachability.data_sources || []).map(source => <div key={source.key} className={`source-row ${source.connected ? 'is-connected' : ''}`}>
                      <span className="source-status">{source.connected ? '✓' : '!'}</span>
                      <div><strong>{source.source || source.label}</strong><small>{source.label} · {source.connected ? 'fonte attiva' : 'da collegare per ottenere dati reali'}</small></div>
                      <time>{source.updated_at ? new Date(source.updated_at).toLocaleDateString('it-IT') : 'Nessun dato'}</time>
                    </div>)}
                  </div>
                </section>

                <section className="data-panel foundation-panel">
                  <header><div><span className="section-eyebrow">Struttura</span><h3>Pagine fondamentali</h3></div><button className="btn btn-outline" onClick={rebuildSeoFoundation} disabled={savingProfile}>{savingProfile ? 'Aggiorno…' : 'Aggiorna'}</button></header>
                  <p>Il sistema le costruisce con informazioni reali del profilo e le collega agli articoli pertinenti.</p>
                  <div className="foundation-list">
                    {(seoFoundation.pages || []).map(page => <a key={page.slug} href={`${siteUrl}/${page.slug}`} target="_blank" rel="noopener"><span>↗</span><strong>{page.title}</strong><small>Pagina pubblica</small></a>)}
                    {!(seoFoundation.pages || []).length && <div className="data-empty">Completa il Profilo attività: da lì nasceranno le prime pagine.</div>}
                  </div>
                </section>
                </div>

              <section className="data-panel map-panel">
                <header className="map-heading">
                  <div><span className="section-eyebrow">Mappa della presenza</span><h3>Come persone e motori raggiungono i contenuti</h3><p>La mappa è costruita dalle pagine pubblicate, dai collegamenti HTML e dalla sitemap.</p></div>
                  <div className="map-stats">
                    <span><strong>{networkPublishedPages}</strong> pagine</span>
                    <span><strong>{sources.length}</strong> fonti</span>
                    <span><strong>{publishedPosts.length}</strong> articoli</span>
                  </div>
                </header>
                <div className="map-legend"><span><i className="legend-hub" />Hub pubblico</span><span><i className="legend-space" />Spazio Vivo</span><span><i className="legend-page" />Pagine e articoli</span></div>
                <SiteMapGraph posts={posts} siteUrl={siteUrl} siteTitle={data?.site?.title || user?.name || user?.slug} foundationPages={seoFoundation.pages || []} />
                <div className="map-actions"><a href="/scopri" target="_blank" rel="noopener" className="btn btn-outline">Apri la rete pubblica</a><a href={`${siteUrl}/sitemap.xml`} target="_blank" rel="noopener" className="btn btn-outline">Apri la sitemap</a></div>
              </section>
            </div>}

            {false && visibilitySection === 'overview' && <>
            <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.45rem', color: 'var(--primary)' }}>🌐 La rete sta distribuendo i tuoi contenuti</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: '700px' }}>Il tuo Spazio Vivo e i suoi contenuti sono collegati dall’hub pubblico di LinkSeoWeb. Ogni nuovo contenuto entra automaticamente nella rete, senza configurazioni da parte tua.</p>
                </div>
                <span style={{ padding: '9px 13px', borderRadius: '999px', background: 'var(--teal-light)', color: 'var(--teal)', fontSize: '12px', fontWeight: 800 }}>Attivo</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1.25rem' }}>
                {[
                  ['Pagine nella rete', networkPublishedPages],
                  ['Viste su Google · 30 giorni', Number(visibility.impressions || 0).toLocaleString('it-IT')],
                  ['Clic da Google · 30 giorni', Number(visibility.clicks || 0).toLocaleString('it-IT')],
                  ['Visite allo Spazio Vivo · 30 giorni', Number(visibility.unique_visitors || 0).toLocaleString('it-IT')],
                  ['Azioni verso l’attività', Number(visibility.actions || 0).toLocaleString('it-IT')],
                ].map(([label,value]) => <div key={label} style={{ padding: '1rem', borderRadius: '12px', background: 'var(--bg)', border: '1px solid var(--border)' }}><div style={{ fontSize: '26px', fontWeight: 850, color: 'var(--text)' }}>{value}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div></div>)}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '1.2rem', flexWrap: 'wrap' }}>
                <a href="/scopri" target="_blank" rel="noopener" className="btn btn-outline" style={{ textDecoration: 'none' }}>Apri la rete pubblica</a>
                <a href={`${siteUrl}/sitemap.xml`} target="_blank" rel="noopener" className="btn btn-outline" style={{ textDecoration: 'none' }}>Vedi elenco pagine</a>
              </div>
            </div>

            <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.4rem', color: 'var(--text)' }}>Pagine fondamentali gestite dal sistema</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, maxWidth: '680px' }}>Il sistema crea pagine sostenute da informazioni reali nei contenuti. Le conferme raccolte nel Profilo guidato le rendono ancora più mirate.</p>
                </div>
                <button className="btn btn-primary" onClick={rebuildSeoFoundation} disabled={savingProfile}>{savingProfile ? 'Aggiornamento…' : 'Aggiorna pagine SEO'}</button>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '1.2rem' }}>
                {(seoFoundation.pages || []).map(page => <a key={page.slug} href={`${siteUrl}/${page.slug}`} target="_blank" rel="noopener" style={{ padding: '9px 12px', borderRadius: '999px', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 750, fontSize: '13px', textDecoration: 'none' }}>{page.title}</a>)}
                {!(seoFoundation.pages || []).length && <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Le prime pagine saranno create dopo l’analisi dei contenuti.</span>}
              </div>
              {!!site?.seo_foundation_updated_at && <div style={{ marginTop: '0.9rem', color: 'var(--text-muted)', fontSize: '12px' }}>Ultimo aggiornamento: {new Date(site.seo_foundation_updated_at).toLocaleString('it-IT')}</div>}
            </div>

            <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.4rem', color: 'var(--text)' }}>🕸️ Mappa del tuo spazio nella rete</h3>
              <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '14px' }}>Questa è la struttura che rende i contenuti raggiungibili dal dominio principale fino ai singoli articoli.</p>
              <SiteMapGraph posts={posts} siteUrl={siteUrl} siteTitle={data?.site?.title || user?.name || user?.slug} foundationPages={seoFoundation.pages || []} />
            </div>
            </>}

            {visibilitySection === 'ideas' && <div id="ideas" className="glass-modal ideas-panel">
              <section className="ideas-quick-start">
                <div>
                  <span className="section-eyebrow">Parti da qui</span>
                  <h2>Chiedi 3 idee all'AI, poi scegli articolo o social.</h2>
                  <p>L'AI incrocia attività, pubblico, contenuti esistenti, ricerche Google e segnali di attualità pertinenti. Nulla viene pubblicato senza conferma.</p>
                </div>
                <div className="ideas-quick-actions">
                  <button className="btn btn-primary" onClick={generateAiContentIdeas} disabled={generatingIdeas}>{generatingIdeas ? 'Cerco e genero…' : '✦ Suggeriscimi 3 contenuti'}</button>
                  <button className="btn btn-primary" onClick={() => setCustomIdeaOpen(true)}>+ Crea da una mia idea</button>
                  <button className="btn btn-outline" onClick={() => { setDashboardFilter('published-0'); setTab('site'); }}>Vedi {posts.filter(post => Number(post.published) === 0).length} bozze</button>
                </div>
              </section>
              <div className="article-length-picker">
                <div><strong>Lunghezza degli articoli AI</strong><span>Compatto è il formato consigliato: più diretto e più facile da leggere.</span></div>
                <div>{[
                  ['brief','Flash','90–140 parole'],
                  ['compact','Compatto','180–280 parole'],
                  ['standard','Standard','320–450 parole'],
                  ['deep','Approfondito','550–750 parole'],
                  ['pillar','Guida completa','900–1.200 parole'],
                ].map(([value,label,detail]) => <button key={value} className={articleLength === value ? 'is-active' : ''} onClick={() => setArticleLength(value)}><strong>{label}</strong><small>{detail}</small></button>)}</div>
              </div>
              <header className="ideas-head">
                <div>
                  <h3>Idee per il prossimo contenuto</h3>
                  <p>Proposte costruite dai tuoi canali, dalle ricerche reali su Google e dalle priorità che hai dichiarato. Per ognuna puoi far scrivere l’AI, scrivere tu, o adattare l’idea prima di partire. Niente viene pubblicato da solo.</p>
                </div>
                <button className="btn btn-outline" onClick={generateAiContentIdeas} disabled={generatingIdeas}>
                  {generatingIdeas ? 'Generazione…' : 'Genera altre 3 idee'}
                </button>
              </header>

              {ideasGeneratedAt && <div className="ideas-research-status"><strong>AI aggiornata {new Date(ideasGeneratedAt).toLocaleString('it-IT')}</strong><span>{ideasNewsSignals > 0 ? `${ideasNewsSignals} segnali recenti analizzati` : 'Profilo e dati interni analizzati · nessuna notizia pertinente forzata'}</span></div>}

              <ol className="ideas-list">
                {contentIdeas.map((idea, index) => {
                  const inModifica = editingIdea?.index === index;
                  const occupato = preparingIdea !== -1;
                  const ideaKey = editorialIdeaKey(idea);
                  return (
                    <li key={`${idea.title}-${index}`} className={`idea-row ${inModifica ? 'is-editing' : ''}`}>
                      <div className="idea-rank">{index + 1}</div>
                      <div className="idea-main">
                        {inModifica ? (
                          <div className="idea-edit">
                            <label>
                              <span>Titolo del contenuto</span>
                              <input
                                type="text" value={editingIdea.title} autoFocus
                                onChange={e => setEditingIdea({ ...editingIdea, title: e.target.value })}
                                placeholder="Di cosa parla il contenuto"
                              />
                            </label>
                            <label>
                              <span>Cosa deve dire, in breve</span>
                              <textarea
                                rows={2} value={editingIdea.reason}
                                onChange={e => setEditingIdea({ ...editingIdea, reason: e.target.value })}
                                placeholder="Il punto che vuoi far arrivare al lettore"
                              />
                            </label>
                            <div className="idea-actions">
                              <button className="btn btn-primary" disabled={occupato}
                                onClick={() => createIdeaDraft({ ...idea, title: editingIdea.title, reason: editingIdea.reason }, index, 'ai')}>
                                ✨ Genera con l’AI
                              </button>
                              <button className="btn btn-outline" disabled={occupato}
                                onClick={() => createIdeaDraft({ ...idea, title: editingIdea.title, reason: editingIdea.reason }, index, 'manual')}>
                                ✎ Scrivo io
                              </button>
                              <button className="btn btn-outline" disabled={occupato || generatingSocial}
                                onClick={() => generateSocialContent({ ...idea, title: editingIdea.title, reason: editingIdea.reason })}>Genera post social</button>
                              <button className="btn btn-ghost" onClick={() => setEditingIdea(null)}>Annulla</button>
                              <button className="btn btn-ghost idea-delete" disabled={occupato || dismissingIdeaKey === ideaKey}
                                onClick={() => dismissContentIdea(idea)}>
                                {dismissingIdeaKey === ideaKey ? 'Elimino…' : 'Elimina proposta'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="idea-title-row">
                              <h4>{idea.title}</h4>
                              <span className="idea-tag">{idea.type}</span>
                            </div>
                            <p className="idea-reason">{idea.reason}</p>
                            <div className="idea-origin">Da: {idea.source}{idea.freshness ? ` · ${idea.freshness}` : ''}{idea.source_url ? <> · <a href={idea.source_url} target="_blank" rel="noopener">vedi fonte</a></> : null}</div>
                            <div className="idea-actions">
                              <button className="btn btn-primary" disabled={occupato}
                                onClick={() => createIdeaDraft(idea, index, 'ai')}>
                                {preparingIdea === index ? 'Creo la bozza…' : '✨ Genera con l’AI'}
                              </button>
                              <button className="btn btn-outline" disabled={occupato}
                                onClick={() => createIdeaDraft(idea, index, 'manual')}>
                                ✎ Scrivo io
                              </button>
                              <button className="btn btn-outline" disabled={occupato || generatingSocial}
                                onClick={() => generateSocialContent(idea)}>{generatingSocial ? 'Preparo il social…' : 'Genera post social'}</button>
                              <button className="btn btn-ghost" disabled={occupato}
                                onClick={() => setEditingIdea({ index, title: idea.title, reason: idea.reason })}>
                                Adatta l’idea
                              </button>
                              <button className="btn btn-ghost idea-delete" disabled={occupato || dismissingIdeaKey === ideaKey}
                                onClick={() => dismissContentIdea(idea)}>
                                {dismissingIdeaKey === ideaKey ? 'Elimino…' : 'Elimina'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}

                {!contentIdeas.length && (
                  <li className="idea-empty">
                    Ancora nessuna proposta: servono contenuti pubblicati o il Profilo guidato compilato.
                    Puoi comunque partire da un’idea tua, qui sotto.
                  </li>
                )}
              </ol>

              <div className={`idea-custom ${customIdeaOpen ? 'is-open' : ''}`}>
                {!customIdeaOpen ? (
                  <button className="btn btn-outline idea-custom-toggle" onClick={() => setCustomIdeaOpen(true)}>
                    + Ho un’idea mia
                  </button>
                ) : (
                  <div className="idea-edit">
                    <div className="idea-custom-title">La tua idea</div>
                    <label>
                      <span>Titolo del contenuto</span>
                      <input
                        type="text" value={customIdea.title} autoFocus
                        onChange={e => setCustomIdea({ ...customIdea, title: e.target.value })}
                        placeholder="Es. Come scegliere il materasso giusto per la lombalgia"
                      />
                    </label>
                    <label>
                      <span>Cosa deve dire, in breve</span>
                      <textarea
                        rows={2} value={customIdea.reason}
                        onChange={e => setCustomIdea({ ...customIdea, reason: e.target.value })}
                        placeholder="Il punto che vuoi far arrivare al lettore"
                      />
                    </label>
                    <div className="idea-actions">
                      <button className="btn btn-primary" disabled={preparingIdea !== -1 || !customIdea.title.trim()}
                        onClick={() => createIdeaDraft({ ...customIdea, type: 'Idea tua', source: 'Proposta manuale', priority: 'Scelta da te' }, -2, 'ai')}>
                        ✨ Genera con l’AI
                      </button>
                      <button className="btn btn-outline" disabled={preparingIdea !== -1 || !customIdea.title.trim()}
                        onClick={() => createIdeaDraft({ ...customIdea, type: 'Idea tua', source: 'Proposta manuale', priority: 'Scelta da te' }, -2, 'manual')}>
                        ✎ Scrivo io
                      </button>
                      <button className="btn btn-outline" disabled={generatingSocial || !customIdea.title.trim()}
                        onClick={() => generateSocialContent({ ...customIdea, type: 'Idea tua', source: 'Proposta manuale' })}>Genera post social</button>
                      <button className="btn btn-ghost" onClick={() => { setCustomIdeaOpen(false); setCustomIdea({ title: '', reason: '' }); }}>Annulla</button>
                    </div>
                  </div>
                )}
              </div>

              <p className="ideas-foot">
                In ogni caso finisci nell’editor con una bozza <strong>non pubblicata</strong>:
                «Genera con l’AI» te la consegna già scritta da rivedere, «Scrivo io» ti lascia una traccia vuota da riempire.
              </p>
            </div>}

            {false && visibilitySection === 'solutions' && <div id="modules" className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'linear-gradient(145deg, var(--surface), var(--primary-light))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ maxWidth: '720px' }}>
                  <div style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.08em' }}>Soluzioni modulari</div>
                  <h3 style={{ margin: '0.4rem 0', color: 'var(--text)', fontSize: '22px' }}>Vuoi accelerare la visibilità?</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.65 }}>L’analisi di base resta inclusa. Puoi attivare solo gli interventi che ti servono, con costo e attività dichiarati prima dell’acquisto.</p>
                </div>
                <span style={{ padding: '9px 13px', borderRadius: '999px', background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--primary)', fontSize: '12px', fontWeight: 800 }}>Nessun vincolo</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '1rem', marginTop: '1.3rem' }}>
                {VISIBILITY_MODULES.map(module => (
                  <div key={module.name} style={{ padding: '1.15rem', borderRadius: '16px', background: 'var(--surface)', border: module.featured ? '2px solid var(--primary)' : '1px solid var(--border)', boxShadow: module.featured ? '0 10px 24px rgba(79,70,229,.12)' : 'none', display: 'flex', flexDirection: 'column' }}>
                    {module.featured && <div style={{ alignSelf: 'flex-start', padding: '4px 8px', borderRadius: '999px', background: 'var(--primary)', color: '#fff', fontSize: '10px', fontWeight: 850, textTransform: 'uppercase', marginBottom: '0.7rem' }}>Consigliato</div>}
                    <div style={{ fontSize: '17px', fontWeight: 850, color: 'var(--text)' }}>{module.name}</div>
                    <div style={{ fontSize: '23px', fontWeight: 900, color: 'var(--primary)', marginTop: '0.35rem' }}>{module.price}</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.55, minHeight: '60px' }}>{module.description}</p>
                    <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '1rem' }}>{module.deliverables.map(item => <div key={item} style={{ color: 'var(--text)', fontSize: '12px' }}>✓ {item}</div>)}</div>
                    <a href={`mailto:support@ideesitiweb.it?subject=${encodeURIComponent(`Richiesta modulo ${module.name} - ${user?.slug || ''}`)}`} className={`btn ${module.featured ? 'btn-primary' : 'btn-outline'}`} style={{ marginTop: 'auto', textDecoration: 'none', justifyContent: 'center' }}>Richiedi attivazione</a>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.55 }}>I prezzi mostrati sono proposte commerciali e non includono eventuali budget pubblicitari. Nessun risultato di posizionamento o vendita viene garantito.</div>
            </div>}

            {isAdmin && visibilitySection === 'overview' && (
              <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.35rem', color: 'var(--primary)' }}>Visibilità globale (Admin)</h3>
                <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '13px' }}>Dettaglio operativo degli ultimi 30 giorni, separato per profilo.</p>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Utente</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Sito</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Pubblicate</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Viste Google</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Impression</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Clic</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>CTR</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Pos.</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Visitatori</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Azioni</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Ultimo dato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminSeoStats.length === 0 ? (
                        <tr><td colSpan="11" style={{ padding: '12px', textAlign: 'center' }}>Nessuna statistica disponibile</td></tr>
                      ) : adminSeoStats.map((st, i) => (
                        <tr key={i}>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.email}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.title}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.published_pages}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.google_visible_pages}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.impressions}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.clicks}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.ctr ? Number(st.ctr).toFixed(2) + '%' : '-'}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.position ? parseFloat(st.position).toFixed(1) : '-'}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.unique_visitors}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }} title={`Telefono ${st.event_counts?.call_click || 0} · Indicazioni ${st.event_counts?.directions_click || 0} · WhatsApp ${st.event_counts?.whatsapp_click || 0} · Prenotazioni ${st.event_counts?.booking_click || 0}`}>{st.actions}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{st.latest_search_date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                  {adminSeoStats.map(st => (
                    <details key={st.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '0.85rem 1rem', background: 'var(--bg)' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--text)' }}>
                        {st.title || st.email} · dettaglio acquisizione e qualità
                      </summary>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Stato operativo</div>
                          <div style={{ fontSize: '13px', lineHeight: 1.8, color: 'var(--text)' }}>
                            Slug: <strong>{st.slug}</strong><br />
                            Copertura osservata: <strong>{st.published_pages ? Math.round((st.google_visible_pages / st.published_pages) * 100) : 0}%</strong><br />
                            Tracking dal: <strong>{st.tracking_started || 'non ancora attivo'}</strong><br />
                            Ultimo sync social: <strong>{st.last_sync || 'mai'}</strong>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Top query</div>
                          {(st.top_queries || []).length === 0 ? <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nessun dato query</div> : (st.top_queries || []).map(q => (
                            <div key={q.query_text} style={{ fontSize: '13px', marginBottom: '0.4rem', color: 'var(--text)' }}>{q.query_text} <span style={{ color: 'var(--text-muted)' }}>· {q.impressions} impr</span></div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Azioni registrate</div>
                          <div style={{ fontSize: '13px', lineHeight: 1.8, color: 'var(--text)' }}>
                            Percorsi scelti: <strong>{st.event_counts?.path_select || 0}</strong><br />
                            Contenuti aperti: <strong>{st.event_counts?.path_content_click || 0}</strong><br />
                            Telefono: <strong>{st.event_counts?.call_click || 0}</strong><br />
                            Indicazioni: <strong>{st.event_counts?.directions_click || 0}</strong><br />
                            WhatsApp: <strong>{st.event_counts?.whatsapp_click || 0}</strong><br />
                            Prenotazione: <strong>{st.event_counts?.booking_click || 0}</strong><br />
                            Social: <strong>{st.event_counts?.social_click || 0}</strong>
                          </div>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'services' && renderVisibilityServices()}
        {tab === 'account' && renderAccountHub()}

        {/* Tab: Impostazioni */}
        {tab === 'settings' && (
          <div>
            <div className="glass-modal" style={{ marginBottom: '1rem', border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.25rem', color: 'var(--primary)', fontSize: '20px' }}>✨ Layout generati dall'AI</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0, fontWeight: 500 }}>
                    Lascia che il Graphic Designer crei proposte su misura in base al tuo profilo.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={forceDesignSite} disabled={designingSite} style={{ padding: '12px 20px', fontSize: '14px' }}>
                  {designingSite ? '⟳ Generazione in corso...' : 'Rigenera Proposte Layout'}
                </button>
              </div>

              {(() => {
                let layouts = null;
                try {
                  if (data?.site?.generated_layouts) {
                    let raw = data.site.generated_layouts.trim();
                    if (raw.startsWith('```json')) raw = raw.replace(/```json/g, '').replace(/```/g, '');
                    else if (raw.startsWith('```')) raw = raw.replace(/```/g, '');
                    layouts = JSON.parse(raw);
                  }
                } catch(e) { console.error('Errore parse generated_layouts:', e); }
                
                if (!Array.isArray(layouts) || layouts.length === 0) return null;
                
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {layouts.map((layout, i) => (
                      <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '5px' }}>Proposta {i + 1}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          Archetipo: <b>{layout.design_archetype || layout.theme}</b><br/>
                          Layout: <b>{layout.header_layout}</b><br/>
                          Font: <b>{layout.font_heading || 'Inter'}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '12px' }}>
                          {layout.color_palette ? (
                            <>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: layout.color_palette.primary, border: '1px solid rgba(0,0,0,0.1)' }} title={layout.color_palette.primary} />
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: layout.color_palette.secondary, border: '1px solid rgba(0,0,0,0.1)' }} title={layout.color_palette.secondary} />
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: layout.color_palette.background, border: '1px solid rgba(0,0,0,0.1)' }} title={layout.color_palette.background} />
                            </>
                          ) : (
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: layout.accent_color, border: '1px solid rgba(0,0,0,0.1)' }} title={layout.accent_color} />
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button className="btn btn-outline btn-full" onClick={() => { setPreviewingTheme(null); setActivePreviewUrl(`${siteUrl}?preview_index=${i}`); }} style={{ fontSize: '12px', padding: '6px' }}>
                            👁️ Anteprima
                          </button>
                          <button className="btn btn-outline btn-full" onClick={() => loadTemplateIntoStudio(layout)} style={{ fontSize: '12px', padding: '6px' }}>
                            Apri nello Studio
                          </button>
                          <button className="btn btn-primary btn-full" onClick={() => applyLayout(i)} style={{ fontSize: '12px', padding: '6px' }}>
                            ✓ Applica
                          </button>
                          <button className="btn btn-outline btn-full" onClick={() => removeGeneratedLayout(i)} style={{ fontSize: '12px', padding: '6px', color: 'var(--red)', borderColor: 'var(--red-light)' }}>
                            ❌ Elimina
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>


            <div className="glass-modal" style={{ marginTop: '2rem', border: '1px solid var(--border-strong)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ marginBottom: '0.35rem', fontSize: '20px' }}>Template Studio</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0, fontWeight: 500 }}>
                    Lo studio ora si apre in una workspace dedicata del frontend: dentro trovi solo gli strumenti per modellare il sito.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => openStudioWorkspace(templateStudio, 'Workspace corrente')}
                  style={{ padding: '12px 20px', fontWeight: 700 }}
                >
                  Apri Studio
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Sorgente attiva</div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>{studioSourceLabel}</div>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Archetipo</div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>{templateStudio.design_archetype || 'custom'}</div>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Palette primaria</div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '999px', background: templateStudio.color_palette?.primary || '#2563eb', border: '1px solid var(--border-strong)' }} />
                    <strong>{templateStudio.color_palette?.primary || '#2563eb'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-modal" style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.5rem', fontSize: '20px' }}>Libreria Modelli (Manual Selection)</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0, fontWeight: 500 }}>
                    Scegli uno dei 20 temi premium e clicca "Applica". Il tuo sito verrà aggiornato immediatamente.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {SITE_LAYOUTS.map(layout => (
                  <div key={layout.id} 
                    style={{ 
                      border: selectedTheme === layout.id ? '2px solid var(--primary)' : '1px solid var(--border-strong)', 
                      borderRadius: 'var(--radius)', 
                      padding: '1.5rem', 
                      background: selectedTheme === layout.id ? 'rgba(0,240,255,0.05)' : 'rgba(255,255,255,0.02)', 
                      position: 'relative', 
                      cursor: 'pointer', 
                      transition: 'all 0.3s ease', 
                      boxShadow: selectedTheme === layout.id ? '0 0 20px rgba(0, 240, 255, 0.2)' : 'none' 
                    }} 
                    onClick={() => { setPreviewingTheme(layout.id); setActivePreviewUrl(`${siteUrl}?preview_theme=${layout.id}`); }}>
                    
                    {selectedTheme === layout.id && <div style={{ position: 'absolute', top: 16, right: 16, background: 'var(--primary)', color: '#000', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, boxShadow: '0 0 10px rgba(0,240,255,0.5)' }}>✓</div>}
                    
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{layout.emoji}</div>
                    <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: 'var(--text)' }}>{layout.name}</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '1.5rem', minHeight: '40px', lineHeight: 1.5, fontWeight: 500 }}>{layout.desc}</div>
                    
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
                      {layout.colors.map((c, idx) => <div key={idx} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: '1px solid rgba(255,255,255,0.1)' }} title={c} />)}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button className={selectedTheme === layout.id ? "btn btn-primary btn-full" : "btn btn-outline btn-full"} style={{ fontSize: '14px', padding: '12px', fontWeight: 700 }}>
                        {selectedTheme === layout.id ? 'Modello Attivo' : 'Anteprima'}
                      </button>
                      <button className="btn btn-outline btn-full" onClick={(e) => { e.stopPropagation(); loadPresetIntoStudio(layout); }} style={{ fontSize: '13px', padding: '10px', fontWeight: 700 }}>
                        Apri nello Studio
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Iframe Anteprima Modale */}
            {activePreviewUrl && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 11000, display: 'flex', flexDirection: 'column', padding: '20px', backdropFilter: 'blur(10px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', color: '#fff', padding: '16px 24px', borderRadius: '16px 16px 0 0', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontWeight: 800, fontSize: '18px' }}>Anteprima Reale</span>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {previewingTheme && (
                      <button onClick={() => { chooseTheme(previewingTheme); setActivePreviewUrl(null); setPreviewingTheme(null); }} style={{ background: 'var(--primary)', color: '#000', fontSize: '15px', border: 'none', cursor: 'pointer', padding: '8px 20px', borderRadius: '20px', fontWeight: 800 }}>✓ APPLICA QUESTO TEMA</button>
                    )}
                    <button onClick={() => { setActivePreviewUrl(null); setPreviewingTheme(null); }} style={{ background: 'transparent', color: '#fff', fontSize: '20px', border: 'none', cursor: 'pointer', opacity: 0.7 }}>✖ Chiudi</button>
                  </div>
                </div>
                <iframe src={activePreviewUrl} style={{ width: '100%', flex: 1, background: '#fff', border: 'none', borderRadius: '0 0 16px 16px' }} />
              </div>
            )}

            {studioWorkspaceOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,10,22,0.92)', zIndex: 10000, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(18px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,16,30,0.92)' }}>
                  <div>
                    <div style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: '4px' }}>Frontend Studio</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>Template Studio</div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', marginTop: '4px' }}>{studioSourceLabel}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-outline"
                      onClick={() => setStudioControlsOpen(prev => !prev)}
                      style={{ padding: '10px 16px', fontWeight: 700, color: '#fff', borderColor: 'rgba(255,255,255,0.18)' }}
                    >
                      {studioControlsOpen ? 'Nascondi controlli' : 'Mostra controlli'}
                    </button>
                    <a
                      href={studioPreviewUrl || `${siteUrl}?preview_theme=${templateStudio.design_archetype || selectedTheme}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                      style={{ padding: '10px 16px', fontWeight: 700, color: '#fff', borderColor: 'rgba(255,255,255,0.18)', textDecoration: 'none' }}
                    >
                      Apri pagina
                    </a>
                    <button
                      className="btn btn-primary"
                      onClick={saveTemplateStudio}
                      disabled={savingTemplateStudio}
                      style={{ padding: '10px 18px', fontWeight: 800 }}
                    >
                      {savingTemplateStudio ? 'Applico...' : 'Applica modifiche'}
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => setStudioWorkspaceOpen(false)}
                      style={{ padding: '10px 16px', fontWeight: 700, color: '#fff', borderColor: 'rgba(255,255,255,0.18)' }}
                    >
                      Chiudi Studio
                    </button>
                  </div>
                </div>

                <div style={{ position: 'relative', minHeight: 0, flex: 1, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(8,14,28,0.96), rgba(16,24,42,0.96))' }}>
                  <div style={{ position: 'absolute', inset: '20px', borderRadius: '28px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 80px rgba(0,0,0,0.35)', background: '#0b1220' }}>
                    {studioPreviewUrl ? (
                      <iframe
                        title="Anteprima live studio"
                        src={studioPreviewUrl}
                        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
                        Carico anteprima...
                      </div>
                    )}
                  </div>

                  <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 2, display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 'calc(100% - 40px)' }}>
                    <div style={{ padding: '10px 14px', borderRadius: '999px', background: 'rgba(7,12,23,0.72)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', backdropFilter: 'blur(16px)' }}>
                      <strong style={{ display: 'block', fontSize: '13px' }}>{templateStudio.design_archetype || 'custom'}</strong>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>Preview live del sito</span>
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: '999px', background: 'rgba(7,12,23,0.72)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', backdropFilter: 'blur(16px)' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', display: 'block' }}>Palette</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                        {['background', 'surface', 'primary'].map(key => (
                          <span key={key} style={{ width: '18px', height: '18px', borderRadius: '999px', background: templateStudio.color_palette?.[key] || '#000', border: '1px solid rgba(255,255,255,0.18)' }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {studioControlsOpen && (
                    <div style={{ position: 'absolute', top: '20px', left: '20px', bottom: '20px', width: 'min(420px, calc(100vw - 40px))', zIndex: 3, borderRadius: '28px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(6,12,24,0.82)', backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
                      <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,16,30,0.72)' }}>
                        <div style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: '4px' }}>Controlli studio</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Modifica il sito da qui</div>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.68)', lineHeight: 1.5 }}>
                          Il sito resta sempre visibile sotto. Ogni modifica aggiorna subito la preview che stai guardando.
                        </div>
                      </div>

                      <div style={{ height: 'calc(100% - 104px)', overflowY: 'auto', padding: '20px', display: 'grid', gap: '1rem' }}>
                        <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <h4 style={{ marginBottom: '1rem', color: '#fff' }}>Template di partenza</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                            {SITE_LAYOUTS.map(layout => (
                              <button
                                key={layout.id}
                                className="btn btn-outline"
                                onClick={() => loadPresetIntoStudio(layout)}
                                style={{
                                  justifyContent: 'flex-start',
                                  padding: '0.9rem 1rem',
                                  borderRadius: 'var(--radius)',
                                  borderColor: templateStudio.base_models?.[0] === layout.id ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                                  background: templateStudio.base_models?.[0] === layout.id ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.02)',
                                  textAlign: 'left',
                                  color: '#fff',
                                }}>
                                <span style={{ fontSize: '1.2rem' }}>{layout.emoji}</span>
                                <span>
                                  <strong style={{ display: 'block', color: '#fff' }}>{layout.name}</strong>
                                  <span style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{layout.desc}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <h4 style={{ marginBottom: '1rem', color: '#fff' }}>Composizione</h4>
                          <div className="form-group">
                            <label className="label">Hero</label>
                            <select value={templateStudio.layout_recipe?.hero || 'product'} onChange={e => updateStudio('layout_recipe.hero', e.target.value)}>
                              <option value="editorial">Editorial</option>
                              <option value="split">Split</option>
                              <option value="immersive">Immersive</option>
                              <option value="human">Human</option>
                              <option value="product">Product</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="label">Navbar</label>
                            <select value={templateStudio.layout_recipe?.nav || 'solid'} onChange={e => updateStudio('layout_recipe.nav', e.target.value)}>
                              <option value="transparent">Transparent</option>
                              <option value="solid">Solid</option>
                              <option value="floating">Floating</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="label">Card</label>
                            <select value={templateStudio.layout_recipe?.cards || 'product'} onChange={e => updateStudio('layout_recipe.cards', e.target.value)}>
                              <option value="editorial">Editorial</option>
                              <option value="bold">Bold</option>
                              <option value="soft">Soft</option>
                              <option value="product">Product</option>
                              <option value="cinematic">Cinematic</option>
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="label">Densita</label>
                            <select value={templateStudio.layout_recipe?.density || 'balanced'} onChange={e => updateStudio('layout_recipe.density', e.target.value)}>
                              <option value="airy">Airy</option>
                              <option value="balanced">Balanced</option>
                              <option value="compact">Compact</option>
                            </select>
                          </div>
                        </div>

                        <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <h4 style={{ marginBottom: '1rem', color: '#fff' }}>Tipografia e UI</h4>
                          <div className="form-group">
                            <label className="label">Font titoli</label>
                            <input type="text" value={templateStudio.font_heading || ''} onChange={e => updateStudio('font_heading', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="label">Font testi</label>
                            <input type="text" value={templateStudio.font_body || ''} onChange={e => updateStudio('font_body', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="label">Radius</label>
                            <input type="text" value={templateStudio.ui_style?.radius || ''} onChange={e => updateStudio('ui_style.radius', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="label">Ombra card</label>
                            <input type="text" value={templateStudio.ui_style?.card_shadow || ''} onChange={e => updateStudio('ui_style.card_shadow', e.target.value)} />
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                            <input type="checkbox" checked={!!templateStudio.ui_style?.glassmorphism} onChange={e => updateStudio('ui_style.glassmorphism', e.target.checked)} />
                            Attiva glassmorphism
                          </label>
                        </div>

                        <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <h4 style={{ marginBottom: '1rem', color: '#fff' }}>Palette</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                            {[
                              ['background', 'Background'],
                              ['surface', 'Surface'],
                              ['text', 'Text'],
                              ['text_muted', 'Text muted'],
                              ['primary', 'Primary'],
                              ['secondary', 'Secondary'],
                            ].map(([key, label]) => (
                              <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                                <label className="label">{label}</label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <input type="color" value={templateStudio.color_palette?.[key] || '#000000'} onChange={e => updateStudio(`color_palette.${key}`, e.target.value)} style={{ width: '50px', minWidth: '50px', padding: '4px', height: '44px' }} />
                                  <input type="text" value={templateStudio.color_palette?.[key] || ''} onChange={e => updateStudio(`color_palette.${key}`, e.target.value)} />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                            <label className="label">Primary gradient</label>
                            <input type="text" value={templateStudio.color_palette?.primary_gradient || ''} onChange={e => updateStudio('color_palette.primary_gradient', e.target.value)} />
                          </div>
                        </div>

                        <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <h4 style={{ marginBottom: '1rem', color: '#fff' }}>Archetipo e modelli</h4>
                          <div className="form-group">
                            <label className="label">Modello principale</label>
                            <select value={templateStudio.base_models?.[0] || ''} onChange={e => updateStudio('base_models.0', e.target.value)}>
                              {SITE_LAYOUTS.map(layout => <option key={layout.id} value={layout.id}>{layout.name}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="label">Secondo modello</label>
                            <select value={templateStudio.base_models?.[1] || ''} onChange={e => updateStudio('base_models.1', e.target.value)}>
                              <option value="">Nessuno</option>
                              {SITE_LAYOUTS.map(layout => <option key={layout.id} value={layout.id}>{layout.name}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="label">Archetipo</label>
                            <input type="text" value={templateStudio.design_archetype || ''} onChange={e => updateStudio('design_archetype', e.target.value)} />
                          </div>
                        </div>

                        <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <h4 style={{ marginBottom: '1rem', color: '#fff' }}>Custom CSS</h4>
                          <textarea
                            value={templateStudio.custom_css || ''}
                            onChange={e => updateStudio('custom_css', e.target.value)}
                            placeholder="Micro-animazioni, hover, dettagli extra..."
                            style={{ width: '100%', minHeight: '180px', resize: 'vertical', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setStudioControlsOpen(prev => !prev)}
                    style={{
                      position: 'absolute',
                      left: studioControlsOpen ? 'min(420px, calc(100vw - 40px))' : '20px',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 4,
                      width: '44px',
                      height: '44px',
                      borderRadius: '999px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(7,12,23,0.82)',
                      color: '#fff',
                      cursor: 'pointer',
                      backdropFilter: 'blur(14px)',
                      boxShadow: '0 14px 30px rgba(0,0,0,0.3)',
                    }}
                    aria-label={studioControlsOpen ? 'Nascondi pannello controlli' : 'Mostra pannello controlli'}
                  >
                    {studioControlsOpen ? '‹' : '›'}
                  </button>
                </div>
              </div>
            )}

            
          </div>
        )}

        {/* Tab: Impostazioni Generali (General) */}
        {tab === 'general' && (
          <div>
            {isAdmin && (
              <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Rapporto di comprensione</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: 0, fontWeight: 500 }}>
                  Qui dobbiamo poter verificare se il sistema ha capito davvero il business e se il design proposto è coerente con quella lettura.
                </p>

                {understandingReport ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Verticale rilevata</div>
                        <div style={{ fontWeight: 800, color: 'var(--text)' }}>{understandingReport.vertical_label || understandingReport.vertical_slug || 'Non definita'}</div>
                      </div>
                      <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Confidenza</div>
                        <div style={{ fontWeight: 800, color: 'var(--text)' }}>{typeof understandingReport.confidence === 'number' ? `${Math.round(understandingReport.confidence * 100)}%` : 'n/d'}</div>
                      </div>
                      <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Business model</div>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{understandingReport.business_model || 'Da confermare'}</div>
                      </div>
                      <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Audience</div>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{understandingReport.audience || 'Da confermare'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)' }}>Prove usate</div>
                        <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted)' }}>
                          {(understandingReport.evidence || []).map((item, idx) => <li key={idx}>{item}</li>)}
                        </ul>
                      </div>
                      <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)' }}>Assunzioni da validare</div>
                        <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted)' }}>
                          {(understandingReport.assumptions || []).map((item, idx) => <li key={idx}>{item}</li>)}
                        </ul>
                      </div>
                      <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)' }}>Direzione design</div>
                        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>{understandingReport.design_direction?.summary || 'Non ancora disponibile.'}</p>
                        <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.5rem' }}>
                          Modelli consigliati: {(understandingReport.design_direction?.recommended_base_models || []).join(', ') || 'n/d'}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(understandingReport.design_direction?.keywords || []).map((item, idx) => (
                            <span key={idx} style={{ padding: '6px 10px', borderRadius: '999px', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '12px', fontWeight: 700 }}>{item}</span>
                          ))}
                        </div>
                      </div>
                      <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)' }}>Pilastri editoriali</div>
                        <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted)' }}>
                          {(understandingReport.editorial_direction?.content_pillars || []).map((item, idx) => <li key={idx}>{item}</li>)}
                        </ul>
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nessun rapporto disponibile ancora. Dopo una finalizzazione completa vedrai qui verticale, confidenza, prove e direzione design.</p>
                )}
              </div>
            )}

            {isAdmin && (
              <>
                <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Agente editoriale</h3>
                  <div className="form-group">
                    <label className="label">Ruolo e missione</label>
                    <textarea value={roleMissionDraft} onChange={e => setRoleMissionDraft(e.target.value)}
                      placeholder="Es: consulente che aiuta PMI locali a trasformare contenuti social in pagine utili per clienti e Google."
                      style={{ width: '100%', minHeight: '82px', resize: 'vertical', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: '15px', color: 'var(--text)' }} />
                  </div>
                  <div className="form-group">
                    <label className="label">Strategia di aggregazione</label>
                    <textarea value={strategyDraft} onChange={e => setStrategyDraft(e.target.value)}
                      placeholder="Cosa pubblicare, cosa evitare, tono, temi ricorrenti, pubblico ideale."
                      style={{ width: '100%', minHeight: '96px', resize: 'vertical', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: '15px', color: 'var(--text)' }} />
                  </div>
                  <button className="btn btn-primary" onClick={saveProfile} disabled={savingProfile} style={{ padding: '12px 20px', fontWeight: 700 }}>
                    {savingProfile ? '⟳ Salvo...' : '✓ Salva agente editoriale'}
                  </button>
                </div>

                <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Configurazione Scrittura Articoli</h3>
                  <div className="form-group">
                    <label className="label">Modello di Scrittura AI (Agente)</label>
                    <select value={harmonizeAgent} onChange={e => setHarmonizeAgent(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontSize: '15px', color: 'var(--text)' }}>
                      <option value="content_editor">Scrittore Standard (Copywriter)</option>
                      <option value="topical_authority_architect">Scrittore Ottimizzato (Topical Authority Architect)</option>
                    </select>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.5', fontWeight: 500 }}>
                      Seleziona "Topical Authority Architect" per generare articoli che mostrano maggiore competenza ed esperienza e rompono i pattern tradizionali delle AI (Quality Rater friendly).
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="label">Tipologia Profilo</label>
                    <div style={{ display: 'flex', gap: '16px', background: 'var(--gray-light)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                      <button onClick={() => setAccountType('business')} style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', background: accountType === 'business' ? 'var(--primary)' : 'transparent', color: accountType === 'business' ? '#fff' : 'var(--text)', border: 'none', fontWeight: 700, transition: 'all 0.3s ease' }}>
                        🏢 Account Business
                      </button>
                      <button onClick={() => setAccountType('personal')} style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', background: accountType === 'personal' ? 'var(--primary)' : 'transparent', color: accountType === 'personal' ? '#fff' : 'var(--text)', border: 'none', fontWeight: 700, transition: 'all 0.3s ease' }}>
                        🧑 Account Personale
                      </button>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.5', fontWeight: 500 }}>
                      Questo aiuterà l'AI a generare articoli più adatti: orientati alla conversione e alla vendita per i Business, orientati all'empatia e allo storytelling per i Profili Personali.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={saveProfile} disabled={savingProfile} style={{ padding: '12px 20px', fontWeight: 700 }}>
                    {savingProfile ? '⟳ Salvataggio...' : '✓ Salva configurazione scrittura'}
                  </button>
                </div>
              </>
            )}

            {isAdmin && (
              <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.35rem', color: 'var(--primary)' }}>Scheda di comprensione editoriale</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                      Qui vedi come il sistema ha capito il business dietro i social. Questa scheda governa verticale, direzione editoriale e design.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" onClick={refreshUnderstanding} disabled={savingProfile} style={{ padding: '12px 18px', fontWeight: 700 }}>
                      {savingProfile ? 'Aggiornamento...' : 'Rigenera comprensione'}
                    </button>
                    <button className="btn btn-primary" onClick={saveProfile} disabled={savingProfile} style={{ padding: '12px 18px', fontWeight: 700 }}>
                      {savingProfile ? 'Salvataggio...' : 'Salva scheda'}
                    </button>
                  </div>
                </div>

                {!understandingDraft ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500, margin: 0 }}>
                    Nessuna scheda ancora disponibile. Esegui "Rigenera comprensione" per creare il primo briefing leggibile.
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <label className="card" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Verticale</span>
                        <input value={understandingDraft.vertical_label || ''} onChange={e => updateUnderstandingField('vertical_label', e.target.value)} />
                      </label>
                      <label className="card" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Vertical slug</span>
                        <input value={understandingDraft.vertical_slug || ''} onChange={e => updateUnderstandingField('vertical_slug', e.target.value)} />
                      </label>
                      <label className="card" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Business model</span>
                        <input value={understandingDraft.business_model || ''} onChange={e => updateUnderstandingField('business_model', e.target.value)} />
                      </label>
                      <label className="card" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Confidence</span>
                        <input type="number" min="0" max="1" step="0.05" value={understandingDraft.confidence ?? ''} onChange={e => updateUnderstandingField('confidence', e.target.value === '' ? '' : parseFloat(e.target.value))} />
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="label">Audience</label>
                      <textarea value={understandingDraft.audience || ''} onChange={e => updateUnderstandingField('audience', e.target.value)} style={{ width: '100%', minHeight: '82px', resize: 'vertical', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: '15px', color: 'var(--text)' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)' }}>Prove raccolte</div>
                        <textarea value={(understandingDraft.evidence || []).join('\n')} onChange={e => updateUnderstandingList('evidence', e.target.value)} placeholder="Una prova per riga" style={{ width: '100%', minHeight: '140px', resize: 'vertical', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)' }} />
                      </div>
                      <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)' }}>Assunzioni da verificare</div>
                        <textarea value={(understandingDraft.assumptions || []).join('\n')} onChange={e => updateUnderstandingList('assumptions', e.target.value)} placeholder="Una assunzione per riga" style={{ width: '100%', minHeight: '140px', resize: 'vertical', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)' }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text)' }}>Direzione Design</div>
                        <input value={understandingDraft.design_direction?.summary || ''} onChange={e => updateUnderstandingNested('design_direction', 'summary', e.target.value)} placeholder="Sintesi della direzione visiva" />
                        <textarea value={(understandingDraft.design_direction?.recommended_base_models || []).join('\n')} onChange={e => updateUnderstandingNestedList('design_direction', 'recommended_base_models', e.target.value)} placeholder="Modelli base, uno per riga" style={{ width: '100%', minHeight: '96px', resize: 'vertical', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)' }} />
                        <textarea value={(understandingDraft.design_direction?.avoid || []).join('\n')} onChange={e => updateUnderstandingNestedList('design_direction', 'avoid', e.target.value)} placeholder="Cose da evitare, una per riga" style={{ width: '100%', minHeight: '96px', resize: 'vertical', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)' }} />
                      </div>

                      <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text)' }}>Direzione Editoriale</div>
                        <input value={understandingDraft.editorial_direction?.summary || ''} onChange={e => updateUnderstandingNested('editorial_direction', 'summary', e.target.value)} placeholder="Sintesi del taglio editoriale" />
                        <textarea value={(understandingDraft.editorial_direction?.content_pillars || []).join('\n')} onChange={e => updateUnderstandingNestedList('editorial_direction', 'content_pillars', e.target.value)} placeholder="Pillar, uno per riga" style={{ width: '100%', minHeight: '96px', resize: 'vertical', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)' }} />
                        <textarea value={(understandingDraft.editorial_direction?.critical_unknowns || []).join('\n')} onChange={e => updateUnderstandingNestedList('editorial_direction', 'critical_unknowns', e.target.value)} placeholder="Cose da chiarire, una per riga" style={{ width: '100%', minHeight: '96px', resize: 'vertical', padding: '12px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)' }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {isAdmin && (
              <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.35rem', color: 'var(--primary)' }}>Control Room Editoriale</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                      Qui puoi vedere gli agenti che governano il flusso editoriale e modificarne i prompt operativi, in stile Rapid Scribant.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" onClick={regenerateMenuAi} disabled={regeneratingMenu} style={{ padding: '12px 18px', fontWeight: 700 }}>
                      {regeneratingMenu ? 'Orchestrazione...' : 'Esegui Chief Editor'}
                    </button>
                    <button className="btn btn-primary" onClick={runEditorialEngine} disabled={editorialEngineBusy} style={{ padding: '12px 18px', fontWeight: 700 }}>
                      {editorialEngineBusy ? 'Analisi...' : 'Esegui Editorial Engine'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  {[
                    { key: harmonizeAgent, note: 'Agente attivo per la scrittura dei singoli post.' },
                    { key: 'chief_editor', note: 'Agente di orchestrazione tassonomica e menu.' },
                    { key: 'editorial_engine', note: 'Agente strategico per cluster, gap e roadmap.' },
                    { key: 'site_ai', note: 'Agente trasversale per identita, struttura e design.' },
                  ].map(({ key, note }) => {
                    const meta = EDITORIAL_AGENT_META[key] || {};
                    return (
                      <div key={`${key}-${note}`} className="card" style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '18px' }}>{meta.icon || '🤖'}</span>
                          <strong style={{ color: 'var(--text)' }}>{meta.title || key}</strong>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                          {meta.role || note}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>{note}</div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {[
                    harmonizeAgent,
                    harmonizeAgent === 'content_editor' ? 'topical_authority_architect' : 'content_editor',
                    'chief_editor',
                    'editorial_engine',
                    'seo_specialist',
                    'site_ai',
                  ].filter((agentName, index, arr) => arr.indexOf(agentName) === index).map(renderPromptEditor)}
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Motore Editoriale SEO</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                      Questo layer trasforma i contenuti social in una continuità editoriale indicizzabile: cluster, gap, pagine pilastro, linking interno e priorità SEO.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={runEditorialEngine} disabled={editorialEngineBusy} style={{ padding: '12px 20px', fontWeight: 700 }}>
                    {editorialEngineBusy ? '⟳ Analisi...' : 'Analizza ora'}
                  </button>
                </div>

                {editorialEngineMsg && (
                  <div style={{
                    marginBottom: '1rem',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '14px',
                    background: editorialEngineMsg.ok ? 'var(--teal-light)' : 'var(--red-light)',
                    color: editorialEngineMsg.ok ? '#0F6E56' : 'var(--red)',
                  }}>
                    {editorialEngineMsg.text}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Stato</div>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text)' }}>{editorialEngine.state?.status || 'non inizializzato'}</div>
                  </div>
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Ultima analisi</div>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text)' }}>
                      {editorialEngine.last_run ? new Date(editorialEngine.last_run).toLocaleString('it-IT') : 'Mai'}
                    </div>
                  </div>
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Featured suggerito</div>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text)' }}>#{editorialEngine.state?.featured_post_id || '-'}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <label className="card" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>Motore attivo</span>
                    <input type="checkbox" checked={!!editorialEngine.settings?.enabled} onChange={e => setEditorialEngine(prev => ({ ...prev, settings: { ...prev.settings, enabled: e.target.checked } }))} />
                  </label>
                  <label className="card" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>Auto-run a fine sync</span>
                    <input type="checkbox" checked={!!editorialEngine.settings?.auto_run} onChange={e => setEditorialEngine(prev => ({ ...prev, settings: { ...prev.settings, auto_run: e.target.checked } }))} />
                  </label>
                  <label className="card" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>Strict indexing mode</span>
                    <input type="checkbox" checked={!!editorialEngine.settings?.strict_indexing_mode} onChange={e => setEditorialEngine(prev => ({ ...prev, settings: { ...prev.settings, strict_indexing_mode: e.target.checked } }))} />
                  </label>
                  <label className="card" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>Minimo post pubblicati</span>
                    <input type="number" min="3" max="50" value={editorialEngine.settings?.min_posts || 8} onChange={e => setEditorialEngine(prev => ({ ...prev, settings: { ...prev.settings, min_posts: Math.max(3, parseInt(e.target.value || '8', 10)) } }))} />
                  </label>
                </div>

                <button className="btn btn-outline" onClick={saveEditorialEngineSettings} disabled={editorialEngineBusy} style={{ padding: '12px 20px', fontWeight: 700, marginBottom: '1rem' }}>
                  Salva impostazioni motore
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)' }}>Topic Clusters</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(editorialEngine.dna?.topic_clusters || []).map((item, idx) => (
                        <span key={idx} style={{ padding: '6px 10px', borderRadius: '999px', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '12px', fontWeight: 700 }}>{item}</span>
                      ))}
                    </div>
                  </div>
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)' }}>Gap editoriali</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted)' }}>
                      {(editorialEngine.memory?.content_gaps || []).map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)' }}>Prossime azioni</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted)' }}>
                      {(editorialEngine.state?.next_actions || []).map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)' }}>Pagine pilastro</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted)' }}>
                      {(editorialEngine.memory?.cornerstone_pages || []).map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Link social inseriti</h3>
              {sources.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>Nessun link social inserito.</p>
              ) : sources.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 'var(--radius)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}><SocialIcon platform={s.platform} size={20} /> {s.label || SOCIAL[s.platform]?.label || s.platform}</div>
                    <a href={s.url} target="_blank" rel="noopener" style={{ display: 'block', fontSize: '13px', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px' }}>{s.url}</a>
                  </div>
                  <span style={{ background: 'var(--teal-light)', color: 'var(--teal)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>ATTIVO</span>
                </div>
              ))}
            </div>

            <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Social connessi</h3>
              {connections.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>Nessun social connesso.</p>
              ) : connections.map(c => (
                <div key={c.platform} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <SocialIcon platform={c.platform} size={24} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{SOCIAL[c.platform]?.label}</div>
                      {c.handle && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{c.handle}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="date" title="Retroattività" 
                      defaultValue={c.since_date || ''}
                      onBlur={e => saveConnectionSettings(c.platform, e.target.value, c.auto_publish ?? 1, c.max_posts, c.auto_sync ?? 1)}
                      style={{ padding: '8px', fontSize: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: '#111', color: 'var(--text)' }} />
                    <span style={{ background: c.active ? 'var(--teal-light)' : 'var(--red-light)', color: c.active ? 'var(--teal)' : 'var(--red)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                      {c.active ? 'ATTIVO' : 'INATTIVO'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Sincronizzazione configurabile</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 500 }}>
                Il timer controlla periodicamente solo i canali abilitati; quelli disabilitati restano disponibili per la sincronizzazione manuale.
              </p>
              {site?.last_sync && (
                <p style={{ fontSize: '14px', color: 'var(--primary-dark)', fontWeight: 700 }}>
                  Ultima sincronizzazione: {new Date(site.last_sync).toLocaleString('it-IT')}
                </p>
              )}
            </div>

            <div className="glass-modal" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>✦ Il tuo Spazio Vivo</h3>
              <div style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.2)', padding: '14px 18px', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: '15px', marginBottom: '16px', wordBreak: 'break-all', color: 'var(--text)' }}>{siteUrl}</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <a href={siteUrl} target="_blank" rel="noopener" className="btn btn-primary" style={{ textDecoration: 'none', padding: '12px 20px', fontWeight: 700 }}>✦ APRI LO SPAZIO VIVO</a>
                <a href={`${siteUrl}/sitemap.xml`} target="_blank" className="btn btn-outline" style={{ textDecoration: 'none', fontSize: '14px', padding: '12px 20px', fontWeight: 700 }}>Sitemap XML</a>
              </div>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="card" style={{ maxWidth: '680px', margin: '0 auto', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', display: 'grid', placeItems: 'center', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '24px', marginBottom: '1rem' }}>🔐</div>
            <h2 style={{ margin: '0 0 0.5rem', color: 'var(--text)' }}>Cambia la tua password</h2>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Per proteggere il tuo account, conferma la password attuale e scegline una nuova di almeno 8 caratteri.
            </p>

            {passwordMsg && (
              <div style={{ marginBottom: '1rem', padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: passwordMsg.ok ? 'var(--teal-light)' : 'var(--red-light)', color: passwordMsg.ok ? '#0F6E56' : 'var(--red)', fontWeight: 700, fontSize: '14px' }}>
                {passwordMsg.text}
              </div>
            )}

            <form onSubmit={changeOwnPassword} style={{ display: 'grid', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor="current-password">Password attuale</label>
                <input id="current-password" type="password" autoComplete="current-password" required value={passwordForm.current} onChange={e => setPasswordForm(current => ({ ...current, current: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor="new-password">Nuova password</label>
                <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={passwordForm.next} onChange={e => setPasswordForm(current => ({ ...current, next: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor="confirm-password">Ripeti la nuova password</label>
                <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={passwordForm.confirm} onChange={e => setPasswordForm(current => ({ ...current, confirm: e.target.value }))} />
              </div>
              <button className="btn btn-primary" disabled={changingPassword} style={{ justifyContent: 'center', marginTop: '0.5rem', padding: '13px 18px' }}>
                {changingPassword ? 'Aggiornamento...' : 'Aggiorna password'}
              </button>
            </form>
          </div>
        )}

        {tab === 'admin' && user?.role === 'admin' && (
          <AdminScreen token={token} currentUser={user} adminPrompts={adminPrompts} updatePrompt={updatePrompt} />
        )}

        {/* Modal Modifica Post */}
        {editingPost && (
          <div className="mobile-bottom-sheet article-editor-overlay">
            <div className="glass-modal article-editor-modal">
              <div className="article-editor-header">
                <div><div className="article-editor-eyebrow">Editor articolo</div><h2>Modifica il contenuto</h2></div>
                <button onClick={() => setEditingPost(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', transition: 'background 0.2s' }}>✕</button>
              </div>
              
              <div className="article-editor-scroll">
                <div>
                  <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>Titolo Principale</label>
                  <input type="text" value={editingPost.title} onChange={e => setEditingPost({...editingPost, title: e.target.value})} style={{ width: '100%', fontSize: '18px', fontWeight: 600, padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} />
                </div>

                <section className="article-image-editor">
                  <div className="article-image-editor__head"><div><strong>Foto principale</strong><span>Puoi aggiungerla, sostituirla, rimuoverla e scegliere quanto spazio occupa nell’articolo.</span></div>{editingPost.mediaUrl && <button type="button" onClick={() => setEditingPost({...editingPost, mediaUrl: '', mediaType: ''})}>Rimuovi foto</button>}</div>
                  <div className="article-image-editor__body">
                    <div className={`article-image-preview align-${editingPost.mediaAlignment}`}>
                      {editingPost.mediaUrl && String(editingPost.mediaType).toUpperCase() !== 'VIDEO' ? <img src={editingPost.mediaUrl} alt="Anteprima foto articolo" style={{ width: `${editingPost.mediaWidth}%` }} /> : <div><span>▧</span><strong>{editingPost.mediaType === 'VIDEO' ? 'Questo articolo contiene un video' : 'Nessuna foto'}</strong><small>Carica un’immagine oppure incolla un indirizzo per impostare la foto principale.</small></div>}
                    </div>
                    <div className="article-image-controls">
                      <label><span>Immagine dal computer</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={postImageUploading} onChange={e => { const file = e.target.files?.[0]; if (file) uploadPostImage(file); e.target.value = ''; }} /></label>
                      <label><span>Ridimensiona il file prima del caricamento</span><select value={editingPost.imagePixelWidth} onChange={e => setEditingPost({...editingPost, imagePixelWidth: Number(e.target.value)})}><option value="600">600 px · leggera</option><option value="900">900 px</option><option value="1200">1200 px · consigliata</option><option value="1600">1600 px · grande</option><option value="0">Dimensione originale</option></select></label>
                      <label><span>Oppure indirizzo dell’immagine</span><input type="url" value={editingPost.mediaUrl} onChange={e => setEditingPost({...editingPost, mediaUrl: e.target.value, mediaType: e.target.value ? 'IMAGE' : ''})} placeholder="https://… oppure carica un file" /></label>
                      <label><span>Larghezza nella pagina · {editingPost.mediaWidth}%</span><input type="range" min="30" max="100" step="5" value={editingPost.mediaWidth} onChange={e => setEditingPost({...editingPost, mediaWidth: Number(e.target.value)})} /></label>
                      <div><span>Allineamento</span><div className="article-image-align">{[['left','Sinistra'],['center','Centro'],['right','Destra']].map(([value,label]) => <button type="button" className={editingPost.mediaAlignment === value ? 'active' : ''} onClick={() => setEditingPost({...editingPost, mediaAlignment: value})} key={value}>{label}</button>)}</div></div>
                      {postImageUploading && <div className="article-image-uploading">Ridimensionamento e caricamento…</div>}
                    </div>
                  </div>
                </section>
                
                <div>
                  <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>Testo dell'Articolo</label>
                  <QuillEditor value={editingPost.body} onChange={val => setEditingPost({...editingPost, body: val})} className="article-rich-editor" style={{ background: '#fff', color: '#000', border: '2px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }} />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                  <div style={{ flex: '1 1 300px' }}>
                    <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>Breve Riassunto (Opzionale)</label>
                    <textarea value={editingPost.excerpt} onChange={e => setEditingPost({...editingPost, excerpt: e.target.value})} style={{ width: '100%', minHeight: '100px', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }} />
                  </div>
                  <div style={{ flex: '1 1 300px' }}>
                    <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>Parole Chiave (separate da virgola)</label>
                    <textarea value={editingPost.tags} onChange={e => setEditingPost({...editingPost, tags: e.target.value})} placeholder="Es: cucina, ricette, estate" style={{ width: '100%', minHeight: '100px', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }} />
                  </div>
                </div>

                <label className={`article-indexing-control ${editingPost.noindex ? 'is-noindex' : ''}`}>
                  <input type="checkbox" checked={Boolean(editingPost.noindex)} onChange={e => setEditingPost({...editingPost, noindex: e.target.checked ? 1 : 0})} />
                  <span><strong>Escludi questo articolo dai motori di ricerca</strong><small>Attiva il meta tag noindex. L’articolo resta pubblicato e raggiungibile tramite link, ma non viene inserito nella sitemap.</small></span>
                </label>
              </div>

              <div className="article-editor-actions">
                <button onClick={savePostEdit} disabled={cmsSaving} style={{ flex: '2 1 200px', background: 'var(--primary)', color: '#000', border: 'none', padding: '16px', fontSize: '16px', fontWeight: 800, borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(0,240,255,0.2)' }}>
                  {cmsSaving ? '⏳ Salvataggio in corso...' : '✅ SALVA MODIFICHE'}
                </button>
                <button onClick={() => setEditingPost(null)} style={{ flex: '1 1 100px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-strong)', padding: '16px', fontSize: '16px', fontWeight: 600, borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background 0.2s' }}>
                  ❌ ANNULLA
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {socialComposer && (
        <div className="social-composer-overlay" role="dialog" aria-modal="true" aria-label="Contenuto social">
          <section className="social-composer">
            <header><div><span className="section-eyebrow">Creato dall'AI · da rivedere</span><h2>Post per {SOCIAL[socialPlatform]?.label || socialPlatform}</h2><p>L'AI adatta il messaggio alla piattaforma. La pubblicazione parte solo quando premi Condividi e la confermi nell'app scelta.</p></div><button className="social-composer-close" onClick={() => setSocialComposer(null)} aria-label="Chiudi">×</button></header>
            <div className="social-platforms">
              {['instagram','facebook','tiktok','linkedin'].map(platform => <button key={platform} className={socialPlatform === platform ? 'is-active' : ''} disabled={generatingSocial} onClick={() => generateSocialContent(socialComposer.idea, platform)}>{SOCIAL[platform]?.label || platform[0].toUpperCase() + platform.slice(1)}</button>)}
            </div>
            <label className="social-caption"><span>Testo del post</span><textarea rows={10} value={socialComposer.caption || ''} onChange={event => setSocialComposer(previous => ({ ...previous, caption: event.target.value }))} /></label>
            <div className="social-hashtags">{(socialComposer.hashtags || []).map(tag => <span key={tag}>#{String(tag).replace(/^#/, '')}</span>)}</div>
            <div className="social-visual-brief"><strong>Visuale consigliato</strong><p>{socialComposer.visual_brief || 'Usa una foto o un video autentico e coerente con il contenuto.'}</p></div>
            <footer><button className="btn btn-outline" onClick={async () => { await navigator.clipboard.writeText(socialShareText()); setSyncMsg({ ok: true, text: 'Testo social copiato.' }); }}>Copia testo</button><button className="btn btn-primary" onClick={shareSocialContent}>Condividi e conferma nel social</button></footer>
          </section>
        </div>
      )}

      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <aside className="mobile-menu-panel" onClick={event => event.stopPropagation()}>
            <div className="mobile-menu-heading"><div><span>Menu</span><strong>{user?.name || user?.email}</strong></div><button onClick={() => setMobileMenuOpen(false)} aria-label="Chiudi menu">×</button></div>
            <nav aria-label="Menu mobile">
              {renderSiteCommandPanel(true)}
              {navigationGroups.map(group => (
                <div className="nav-section" key={group.label}>
                  <div className="nav-group">{group.label}</div>
                  {group.items.map(item => (
                    <button key={`${item.id}-${item.section || ''}`} className={`nav-item ${isNavigationActive(item) ? 'is-active' : ''}`} onClick={() => selectNavigation(item)}>
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>
            <div className="mobile-menu-account">
              <button onClick={() => selectNavigation({ id: 'security' })}>Password e sicurezza</button>
              <button onClick={toggleTheme}>{theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}</button>
              <button onClick={onLogout}>Esci dall’account</button>
            </div>
          </aside>
        </div>
      )}

      <div className="mobile-nav">
        <button className={`mobile-nav-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => selectNavigation({ id: 'overview' })}>
          <span className="nav-icon-wrap">⌂</span><span>Home</span>
        </button>
        <button className={`mobile-nav-item ${tab === 'seo' && visibilitySection === 'ideas' ? 'active' : ''}`} onClick={() => selectNavigation({ id: 'seo', section: 'ideas' })}>
          <span className="nav-icon-wrap">✦</span><span>Idee</span>
        </button>
        <button className={`mobile-nav-item ${tab === 'site' ? 'active' : ''}`} onClick={() => selectNavigation({ id: 'site' })}>
          <span className="nav-icon-wrap">▤</span><span>Articoli</span>
        </button>
        <button className={`mobile-nav-item ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(true)}>
          <span className="nav-icon-wrap">☰</span><span>Menu</span>
        </button>
      </div>
      <ProductGuide posts={posts} sources={sources} siteUrl={siteUrl} onNavigate={target => { if (target === 'articles') selectNavigation({ id: 'site' }); }} />
      
    </div>
  );
}
