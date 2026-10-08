import React, { useState, useEffect, useRef } from "react";
import {
  apiFetch,
  SOCIAL,
  SITE_LAYOUTS,
  SITE_LAYOUT_CATEGORIES,
  detectPlatformFromUrl,
} from "../utils/api";
import { SocialIcon } from "../components/SocialIcon";
import { QuillEditor } from "../components/QuillEditor";
import { AdminScreen } from "./AdminScreen";
import { SpazioVivoLab } from "../components/SpazioVivoLab";
import { ProductGuide } from "../components/ProductGuide";
import { PublicationConnections } from "../components/PublicationConnections";
import { BrandMark } from "./LandingScreen";
import { ProfileReviewPanel } from "../components/ProfileReviewPanel";
import { LiaKnowledge, LiaKnowledgeBadge, useLiaKnowledge } from "../components/LiaKnowledge";
const STUDIO_DEFAULTS = {
  font_heading: "Outfit",
  font_body: "Inter",
  color_palette: {
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#16202a",
    text_muted: "#64748b",
    primary: "#2563eb",
    secondary: "#dbe8ff",
    primary_gradient: "linear-gradient(135deg, #4f8cff, #1d4ed8)",
  },
  ui_style: {
    radius: "16px",
    card_shadow: "0 10px 30px rgba(15,23,42,0.08)",
    glassmorphism: false,
  },
  layout_recipe: {
    hero: "product",
    nav: "solid",
    cards: "product",
    density: "balanced",
  },
  base_models: ["tech-clarity"],
  custom_css: "",
  design_archetype: "tech-clarity",
};

function postProcessingStatus(post) {
  if (Number(post?.seo_score) >= 0) return "done";
  if (post?.processing_status) return post.processing_status;
  return String(post?.agent_notes || "").startsWith("Errore:")
    ? "failed"
    : "pending";
}

function postProcessingLabel(post) {
  const status = postProcessingStatus(post);
  if (status === "processing") return "IN PREPARAZIONE";
  if (status === "failed") return "RIPROVA";
  return "DA PREPARARE";
}

function compactDebugValue(value, fallback = "n/d") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

function providerDebugLines(entries = []) {
  return (Array.isArray(entries) ? entries : []).flatMap((entry) => {
    const provider = entry?.provider || {};
    const platform = String(entry?.platform || "social").toUpperCase();
    const lines = [
      `${platform} · limite scelto ${compactDebugValue(entry?.scan_requested_limit ?? entry?.requested_limit ?? provider.requested_limit)} · limite del canale ${compactDebugValue(entry?.configured_max_posts, "non impostato")} · richiesta effettiva ${compactDebugValue(entry?.requested_limit ?? provider.requested_limit)} · risultati estratti ${compactDebugValue(provider.raw_results ?? provider.provider_links, "0")} · contenuti utilizzabili ${compactDebugValue(provider.normalized_items, "0")}`,
    ];
    if (entry?.since_date)
      lines.push(
        `${platform} · filtro data dal ${entry.since_date} · esclusi ${compactDebugValue(provider.filtered_by_date, "0")}`,
      );
    if (provider.actor_id)
      lines.push(`${platform} · scraper utilizzato: ${provider.actor_id}`);
    (Array.isArray(provider.provider_pages)
      ? provider.provider_pages
      : []
    ).forEach((page, index) => {
      const strategy =
        page.strategy && page.strategy !== "profile_url"
          ? `, recupero ${page.strategy}`
          : "";
      lines.push(
        `${platform} · risposta ${index + 1}: pagine richieste ${compactDebugValue(page.pages_requested)}, pagine lette ${compactDebugValue(page.pages_fetched)}, link restituiti ${compactDebugValue(page.returned_count)}, incompleta ${page.incomplete ? "sì" : "no"}, altra pagina ${page.has_next_page ? "sì" : "no"}, cursore ${page.end_cursor ? "presente" : "assente"}${strategy}`,
      );
      if (page.incomplete && !page.end_cursor) {
        lines.push(
          `${platform} · il provider ha interrotto la timeline senza fornire un cursore: in questa scansione non è possibile richiedere altri post oltre a quelli restituiti.`,
        );
      }
      (Array.isArray(page.limitations) ? page.limitations : []).forEach(
        (limit) => lines.push(`${platform} · limite provider: ${limit}`),
      );
    });
    return lines;
  });
}

function errorDiagnosis(message = "") {
  const normalized = String(message).toLowerCase();
  if (
    normalized.includes("api key not valid") ||
    normalized.includes("api_key_invalid")
  ) {
    return "DIAGNOSI AI · la cattura è riuscita, ma Gemini rifiuta la chiave API configurata sul server. Va sostituita la chiave prima di poter creare gli articoli.";
  }
  if (
    normalized.includes("quota") ||
    normalized.includes("resource_exhausted")
  ) {
    return "DIAGNOSI AI · quota Gemini esaurita o limite di richieste raggiunto.";
  }
  return "";
}

const EDITORIAL_AGENT_META = {
  content_editor: {
    icon: "✍️",
    title: "Content Editor",
    role: "Riscrive i singoli contenuti social in articoli.",
  },
  topical_authority_architect: {
    icon: "🧠",
    title: "Topical Authority",
    role: "Produce articoli piu esperti, contrarian e orientati alla topical authority.",
  },
  chief_editor: {
    icon: "🗂️",
    title: "Chief Editor",
    role: "Orchestra categorie, menu, articolo featured e tagline.",
  },
  editorial_engine: {
    icon: "⚙️",
    title: "Editorial Engine",
    role: "Analizza il corpus e decide cluster, gap, priorita e prossime mosse.",
  },
  seo_specialist: {
    icon: "🔎",
    title: "SEO Specialist",
    role: "Costruisce title, bio, menu e struttura SEO del sito.",
  },
  site_ai: {
    icon: "🏗️",
    title: "Site AI",
    role: "Compone identita, design e configurazione complessiva del sito.",
  },
};

const STRATEGY_GOALS = [
  ["bookings", "Ricevere prenotazioni"],
  ["contacts", "Ottenere contatti"],
  ["store_visits", "Portare persone in sede"],
  ["sales", "Vendere prodotti o servizi"],
  ["awareness", "Aumentare la notoriet\u00e0"],
  ["events", "Promuovere eventi"],
];

const PLATFORM_PLANS = [
  {
    name: "Base",
    price: "€50/anno",
    description: "Vetrina automatizzata essenziale.",
    deliverables: [
      "Generazione automatica sito vetrina",
      "Acquisizione da 1 Canale Social",
      "Fino a 10 articoli elaborati al mese",
      "Ottimizzazione SEO Base automatica",
    ],
  },
  {
    name: "Pro",
    price: "€150/anno",
    description: "Il piano ideale per crescere senza sforzo.",
    deliverables: [
      "Acquisizione fino a 5 Canali Social",
      "Elaborazione fino a 50 articoli/mese",
      "Motore AI (Topical Authority e Idee)",
      "Design Avanzato personalizzabile",
    ],
    featured: true,
  },
  {
    name: "Agency",
    price: "€500/anno",
    description: "Gestione per agenzie e multi-cliente.",
    deliverables: [
      "Dashboard gestione clienti",
      "Assegnazione piani Base/Pro ai clienti",
      "Pacchetto licenze incluso",
    ],
  },
];

function normalizeStudioData(raw, selectedTheme = "tech-clarity") {
  const preset =
    SITE_LAYOUTS.find((layout) => layout.id === selectedTheme) ||
    SITE_LAYOUTS[0];
  const source = raw && typeof raw === "object" ? raw : {};
  const palette = source.color_palette || {};
  const uiStyle = source.ui_style || {};
  const recipe = source.layout_recipe || {};
  const defaultSections = ["hero", "latest", "topics", "info"];
  const requestedSections = Array.isArray(recipe.section_order)
    ? recipe.section_order
    : [];
  const sectionOrder = [
    ...requestedSections.filter((key) => defaultSections.includes(key)),
    ...defaultSections.filter((key) => !requestedSections.includes(key)),
  ];
  const baseModels = Array.isArray(source.base_models)
    ? source.base_models
    : source.base_models
      ? [source.base_models]
      : preset?.base_models || STUDIO_DEFAULTS.base_models;

  return {
    design_archetype:
      source.design_archetype ||
      preset?.id ||
      selectedTheme ||
      STUDIO_DEFAULTS.design_archetype,
    font_heading:
      source.font_heading ||
      preset?.font_heading ||
      STUDIO_DEFAULTS.font_heading,
    font_body:
      source.font_body || preset?.font_body || STUDIO_DEFAULTS.font_body,
    color_palette: {
      background:
        palette.background ||
        palette.bg ||
        preset?.color_palette?.background ||
        STUDIO_DEFAULTS.color_palette.background,
      surface:
        palette.surface ||
        preset?.color_palette?.surface ||
        STUDIO_DEFAULTS.color_palette.surface,
      text:
        palette.text ||
        preset?.color_palette?.text ||
        STUDIO_DEFAULTS.color_palette.text,
      text_muted:
        palette.text_muted ||
        preset?.color_palette?.text_muted ||
        STUDIO_DEFAULTS.color_palette.text_muted,
      primary:
        palette.primary ||
        source.accent_color ||
        preset?.color_palette?.primary ||
        STUDIO_DEFAULTS.color_palette.primary,
      secondary:
        palette.secondary ||
        preset?.color_palette?.secondary ||
        STUDIO_DEFAULTS.color_palette.secondary,
      primary_gradient:
        palette.primary_gradient ||
        preset?.color_palette?.primary_gradient ||
        STUDIO_DEFAULTS.color_palette.primary_gradient,
    },
    ui_style: {
      radius:
        uiStyle.radius ||
        preset?.ui_style?.radius ||
        STUDIO_DEFAULTS.ui_style.radius,
      card_shadow:
        uiStyle.card_shadow ||
        preset?.ui_style?.card_shadow ||
        STUDIO_DEFAULTS.ui_style.card_shadow,
      glassmorphism:
        typeof uiStyle.glassmorphism === "boolean"
          ? uiStyle.glassmorphism
          : (preset?.ui_style?.glassmorphism ??
            STUDIO_DEFAULTS.ui_style.glassmorphism),
    },
    layout_recipe: {
      hero:
        recipe.hero ||
        preset?.layout_recipe?.hero ||
        STUDIO_DEFAULTS.layout_recipe.hero,
      nav:
        recipe.nav ||
        preset?.layout_recipe?.nav ||
        STUDIO_DEFAULTS.layout_recipe.nav,
      cards:
        recipe.cards ||
        preset?.layout_recipe?.cards ||
        STUDIO_DEFAULTS.layout_recipe.cards,
      density:
        recipe.density ||
        preset?.layout_recipe?.density ||
        STUDIO_DEFAULTS.layout_recipe.density,
      section_order: sectionOrder,
      hidden_sections: Array.isArray(recipe.hidden_sections)
        ? recipe.hidden_sections.filter((key) => defaultSections.includes(key))
        : [],
    },
    base_models: baseModels.slice(0, 2),
    custom_css: source.custom_css || "",
  };
}

function encodeStudioPreviewData(data) {
  try {
    const json = JSON.stringify(data || {});
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  } catch (error) {
    console.error("Errore serializzazione preview studio:", error);
    return "";
  }
}

function siteLayoutToStudioData(layout) {
  return {
    design_archetype: layout.id,
    font_heading: layout.font_heading,
    font_body: layout.font_body,
    color_palette: layout.color_palette,
    ui_style: layout.ui_style,
    layout_recipe: layout.layout_recipe,
    base_models: layout.base_models,
    custom_css: "",
  };
}

function buildEditorialIdeas(posts, understanding, visibility = {}) {
  const published = posts.filter((post) => Number(post.published) === 1);
  const searchableText = published
    .map((post) =>
      `${post.generated_title || ""} ${(post.tags || []).join(" ")}`.toLowerCase(),
    )
    .join(" ");
  const pillars = understanding?.editorial_direction?.content_pillars || [];
  const declared = understanding?.declared_strategy || {};
  const visualAssets = published.filter((post) => post.media_url).length;
  const topQuery = [...(visibility.top_queries || [])]
    .filter((query) => Number(query.impressions) >= 20)
    .sort((a, b) => {
      const scoreA =
        Number(a.impressions) * (1 - Math.min(Number(a.ctr || 0), 100) / 100);
      const scoreB =
        Number(b.impressions) * (1 - Math.min(Number(b.ctr || 0), 100) / 100);
      return scoreB - scoreA;
    })[0];
  const ideas = [];

  if (topQuery) {
    ideas.push({
      title: `Rispondi alla ricerca “${topQuery.query_text}”`,
      reason: `Google ha già mostrato questa ricerca ${Number(topQuery.impressions).toLocaleString("it-IT")} volte: sviluppala in un contenuto completo, con una risposta chiara e una call to action pertinente.`,
      type: "Domanda reale su Google",
      priority: "Da creare subito",
      source: "Dati Google degli ultimi 30 giorni",
    });
  }

  if (declared.primary_audience) {
    const audienceLabel = String(declared.primary_audience)
      .split(/[.,;]/)[0]
      .slice(0, 80);
    ideas.push({
      title: `Una guida pensata per ${audienceLabel}`,
      reason: `Il pubblico prioritario dichiarato non emerge dai social in modo affidabile: questo contenuto lo intercetta esplicitamente.`,
      type: "Pubblico prioritario",
      priority: "Alta priorità",
      source: "Profilo guidato",
    });
  }

  (declared.priority_services || []).slice(0, 2).forEach((service) => {
    ideas.push({
      title: `${service}: guida completa, vantaggi e domande frequenti`,
      reason:
        "Hai indicato questo servizio come prioritario: merita una pagina capace di essere trovata e di portare all\u2019azione.",
      type: "Obiettivo commerciale",
      priority: "Alta priorità",
      source: "Servizi prioritari",
    });
  });

  if (declared.geographic_area) {
    ideas.push({
      title: `Come scegliere il servizio giusto a ${declared.geographic_area}`,
      reason:
        "Un contenuto locale stabile collega offerta, territorio e domande concrete delle persone che si trovano nella tua area.",
      type: "Visibilità locale",
      priority: "Consigliata",
      source: "Territorio dichiarato",
    });
  }

  if (visualAssets > 0) {
    ideas.push({
      title:
        "Dietro le quinte: una storia costruita con le tue immagini migliori",
      reason: `Hai già ${visualAssets} foto o video pubblicati: trasformali in un racconto utile che resti consultabile e non scompaia nel flusso social.`,
      type: "Idea visuale",
      priority: "Pronta da sviluppare",
      source: "Media già disponibili",
    });
  }

  pillars.forEach((pillar, index) => {
    const words = String(pillar)
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 4);
    const covered = words.some((word) => searchableText.includes(word));
    if (!covered || index < 2) {
      ideas.push({
        title: `Una guida pratica su “${pillar}”`,
        reason: covered
          ? "Tema importante da approfondire con un nuovo punto di vista."
          : "Tema riconosciuto dall’AI ma ancora poco coperto nel sito.",
        type: covered ? "Approfondimento" : "Tema mancante",
        priority: covered ? "Da approfondire" : "Alta priorità",
        source: "Analisi dei contenuti",
      });
    }
  });

  (understanding?.editorial_direction?.critical_unknowns || [])
    .slice(0, 2)
    .forEach((item) => {
      ideas.push({
        title: `Rispondi chiaramente a: ${item}`,
        reason:
          "Chiarire questo punto aiuta clienti e AI a capire meglio l’attività.",
        type: "Domanda cliente",
        priority: "Consigliata",
        source: "Informazioni ancora mancanti",
      });
    });

  if (published.length < 8)
    ideas.push({
      title: "Racconta il servizio più richiesto con un caso concreto",
      reason:
        "Il sito ha ancora pochi contenuti: un esempio reale aumenta completezza e fiducia.",
      type: "Caso reale",
      priority: "Alta priorità",
      source: "Copertura del sito",
    });
  ideas.push({
    title: "Le 5 domande che i clienti fanno prima di scegliere",
    reason:
      "Un contenuto utile intercetta dubbi reali e crea nuovi collegamenti interni.",
    type: "Sempre utile",
    priority: "Evergreen",
    source: "Formato ad alta utilità",
  });

  const seenTitles = new Set();
  return ideas
    .filter((idea) => {
      const key = idea.title.toLowerCase().trim();
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    })
    .slice(0, 8);
}

function editorialIdeaKey(idea) {
  return [idea?.title, idea?.type, idea?.source]
    .map((value) =>
      String(value || "")
        .trim()
        .toLocaleLowerCase("it-IT")
        .replace(/\s+/g, " "),
    )
    .join("|");
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
  if (!understanding || typeof understanding !== "object") return understanding;
  const current = understanding.declared_strategy || {};
  const aiServices = (understanding.editorial_direction?.content_pillars || [])
    .filter(Boolean)
    .slice(0, 6);
  return {
    ...understanding,
    declared_strategy: {
      ...current,
      activity_type:
        current.activity_type || understanding.vertical_label || "",
      offer_summary:
        current.offer_summary || understanding.business_model || "",
      primary_audience:
        current.primary_audience || understanding.audience || "",
      geographic_area:
        current.geographic_area ||
        understanding.geographic_area ||
        understanding.local_area ||
        "",
      priority_services: [
        ...new Set([...(current.priority_services || []), ...aiServices]),
      ],
      differentiators:
        current.differentiators ||
        understanding.differentiators ||
        understanding.value_proposition ||
        "",
      customer_needs:
        current.customer_needs || understanding.customer_needs || "",
    },
  };
}

function GuidedStrategy({
  understanding,
  declared,
  progress,
  step,
  setStep,
  updateField,
  updateList,
  save,
  saving,
  refresh,
  refreshing,
  logoUrl,
  uploadLogo,
  uploadingLogo,
  sourcesCount,
}) {
  const steps = [
    { title: "Identità", hint: "Conferma chi sei e cosa offri" },
    { title: "Obiettivo", hint: "Scegli il risultato più importante" },
    { title: "Pubblico", hint: "Indica chi e dove vuoi raggiungere" },
    { title: "Differenza", hint: "Spiega perché scegliere te" },
  ];
  const inferredActivity = understanding?.vertical_label || "";
  const inferredOffer = understanding?.business_model || "";
  const inferredAudience = understanding?.audience || "";
  const socialSummary = [inferredActivity, inferredOffer]
    .filter(Boolean)
    .join(" · ");
  const logoIsFallback = String(logoUrl || "").includes(
    "profile_logo_fallback",
  );
  const hasConfirmedLogo = !!logoUrl && !logoIsFallback;
  const [servicesText, setServicesText] = useState(() =>
    (declared.priority_services || []).join("\n"),
  );
  const next = () =>
    setStep((current) => Math.min(steps.length - 1, current + 1));
  const previous = () => setStep((current) => Math.max(0, current - 1));
  const useSuggestion = (key, value) => value && updateField(key, value);

  return (
    <section
      className="guided-strategy"
      id="strategy"
      aria-labelledby="guided-strategy-title"
    >
      <div className="guided-strategy__intro">
        <div>
          <span className="guided-eyebrow">Configurazione assistita</span>
          <h2 id="guided-strategy-title">Noi analizziamo. Tu confermi.</h2>
          <p>
            Non devi inventare una strategia da zero. Abbiamo già letto i tuoi
            canali: ti mostriamo ciò che abbiamo capito e ti chiediamo solo le
            informazioni che i social non possono conoscere.
          </p>
        </div>
        <div
          className="guided-score"
          style={{ "--score": `${progress}%` }}
          aria-label={`Profilo completo al ${progress}%`}
        >
          <strong>{progress}%</strong>
          <span>profilo pronto</span>
        </div>
      </div>

      <div className="guided-auto-panel">
        <div className="guided-logo-box">
          <div className="guided-logo-preview">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo dell’attività" />
            ) : (
              <span>{(inferredActivity || "A").slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <span
              className={`guided-status ${hasConfirmedLogo ? "is-ready" : "is-needed"}`}
            >
              {hasConfirmedLogo
                ? "✓ Recuperato dai social"
                : logoIsFallback
                  ? "! Immagine da confermare"
                  : "! Non trovato sui social"}
            </span>
            <strong>Logo identificativo</strong>
            <small>
              {hasConfirmedLogo
                ? "È già usato nello Spazio Vivo. Puoi sostituirlo quando vuoi."
                : logoIsFallback
                  ? "Abbiamo trovato una copertina, non un logo certo. Sostituiscila con il marchio corretto."
                  : "Facebook non ha restituito un’immagine utilizzabile. Caricane una tu."}
            </small>
            <label className="guided-upload">
              {uploadingLogo
                ? "Caricamento…"
                : logoUrl
                  ? "Sostituisci logo"
                  : "Carica logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={uploadLogo}
                disabled={uploadingLogo}
              />
            </label>
          </div>
        </div>
        <div className="guided-ai-summary">
          <span className="guided-status is-ready">
            ✓ Fatto automaticamente
          </span>
          <strong>
            Abbiamo analizzato {sourcesCount || "i"} canal
            {sourcesCount === 1 ? "e" : "i"}
          </strong>
          <p>
            {socialSummary ||
              "Stiamo costruendo la prima lettura della tua attività dai contenuti importati."}
          </p>
          <button
            type="button"
            className="guided-text-button"
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing ? "Analisi in corso…" : "Rileggi i social"}
          </button>
        </div>
      </div>

      <nav className="guided-steps" aria-label="Passaggi del profilo">
        {steps.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setStep(index)}
            className={
              index === step ? "is-active" : index < step ? "is-done" : ""
            }
            aria-current={index === step ? "step" : undefined}
          >
            <span>{index < step ? "✓" : index + 1}</span>
            <b>{item.title}</b>
            <small>{item.hint}</small>
          </button>
        ))}
      </nav>

      <div className="guided-step-card">
        <div className="guided-step-heading">
          <span>
            PASSAGGIO {step + 1} DI {steps.length}
          </span>
          <h3>{steps[step].hint}</h3>
          <p>
            I campi con “nostra proposta” sono già stati dedotti: confermali
            oppure correggili.
          </p>
        </div>

        {step === 0 && (
          <div className="guided-fields two-columns">
            <label>
              <span>
                Che tipo di attività sei? <em>Nostra proposta</em>
              </span>
              <input
                value={declared.activity_type || ""}
                onChange={(e) => updateField("activity_type", e.target.value)}
                placeholder={
                  inferredActivity || "Es. Agriturismo con ristorante"
                }
              />
              {!declared.activity_type && inferredActivity && (
                <button
                  type="button"
                  onClick={() =>
                    useSuggestion("activity_type", inferredActivity)
                  }
                >
                  Usa “{inferredActivity}”
                </button>
              )}
            </label>
            <label>
              <span>
                Cosa offri concretamente? <em>Nostra proposta</em>
              </span>
              <input
                value={declared.offer_summary || ""}
                onChange={(e) => updateField("offer_summary", e.target.value)}
                placeholder={
                  inferredOffer || "Es. Soggiorni, cucina locale ed eventi"
                }
              />
              {!declared.offer_summary && inferredOffer && (
                <button
                  type="button"
                  onClick={() => useSuggestion("offer_summary", inferredOffer)}
                >
                  Usa la proposta
                </button>
              )}
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="guided-fields">
            <div>
              <span className="guided-field-label">
                Qual è il risultato più importante? <em>Serve la tua scelta</em>
              </span>
              <div className="guided-choice-grid">
                {STRATEGY_GOALS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateField("primary_goal", value)}
                    className={
                      declared.primary_goal === value ? "is-selected" : ""
                    }
                  >
                    {declared.primary_goal === value ? "✓ " : ""}
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              <span>
                Quale azione deve compiere una persona?{" "}
                <em>Serve la tua risposta</em>
              </span>
              <input
                value={declared.desired_action || ""}
                onChange={(e) => updateField("desired_action", e.target.value)}
                placeholder="Es. Chiedere disponibilità su WhatsApp"
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="guided-fields two-columns">
            <label>
              <span>
                Chi vuoi raggiungere prima di tutti?{" "}
                <em>Serve la tua conferma</em>
              </span>
              <textarea
                value={declared.primary_audience || ""}
                onChange={(e) =>
                  updateField("primary_audience", e.target.value)
                }
                placeholder={
                  inferredAudience ||
                  "Es. Coppie e famiglie di Roma interessate a weekend nella natura"
                }
              />
              {!declared.primary_audience && inferredAudience && (
                <button
                  type="button"
                  onClick={() =>
                    useSuggestion("primary_audience", inferredAudience)
                  }
                >
                  Usa la proposta
                </button>
              )}
            </label>
            <label>
              <span>
                In quale territorio? <em>Serve la tua risposta</em>
              </span>
              <input
                value={declared.geographic_area || ""}
                onChange={(e) => updateField("geographic_area", e.target.value)}
                placeholder="Es. Roma, Lazio e Centro Italia"
              />
            </label>
            <label className="full">
              <span>
                C’è anche un secondo pubblico? <i>Facoltativo</i>
              </span>
              <input
                value={declared.secondary_audience || ""}
                onChange={(e) =>
                  updateField("secondary_audience", e.target.value)
                }
                placeholder="Es. Aziende che cercano una location per eventi"
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="guided-fields two-columns">
            <label>
              <span>
                Quali offerte vuoi rendere più visibili?{" "}
                <em>Una per riga · precompilato dall’AI</em>
              </span>
              <textarea
                value={servicesText}
                onChange={(e) => {
                  setServicesText(e.target.value);
                  updateList("priority_services", e.target.value);
                }}
                placeholder={"Soggiorni weekend\nRistorante\nEventi privati"}
              />
              <small className="guided-field-help">
                Premi Invio dopo ogni voce. Puoi correggere, aggiungere o
                cancellare liberamente.
              </small>
            </label>
            <label>
              <span>
                Perché dovrebbero scegliere te? <em>Serve la tua voce</em>
              </span>
              <textarea
                value={declared.differentiators || ""}
                onChange={(e) => updateField("differentiators", e.target.value)}
                placeholder="Es. A 30 minuti da Roma, cucina autentica, contatto diretto con i proprietari"
              />
            </label>
            <label className="full">
              <span>
                Quali dubbi fanno esitare i clienti? <i>Facoltativo</i>
              </span>
              <textarea
                value={declared.customer_needs || ""}
                onChange={(e) => updateField("customer_needs", e.target.value)}
                placeholder="Es. Se è adatto ai bambini, cosa comprende il prezzo, quanto dista da Roma"
              />
            </label>
          </div>
        )}

        <div className="guided-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={previous}
            disabled={step === 0}
          >
            Indietro
          </button>
          <span>Le modifiche vengono salvate soltanto alla fine.</span>
          {step < steps.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={next}>
              Continua →
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Salvataggio…" : "Conferma e attiva il profilo"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function SiteMapGraph({ posts, siteUrl, siteTitle, foundationPages = [] }) {
  const visiblePosts = posts.filter((post) => Number(post.published) === 1);
  const graphLabels =
    foundationPages.length > 0
      ? foundationPages
      : [{ title: "I tuoi articoli", slug: "" }];

  return (
    <div
      className="sitemap-tree"
      style={{
        padding: "1.5rem",
        background: "var(--bg)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        overflowX: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            background: "var(--primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
        <div>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener"
            style={{
              fontWeight: "800",
              fontSize: "1.15rem",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            {siteTitle || "Spazio Vivo"}
          </a>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Dominio principale ({siteUrl.replace(/^https?:\/\//, "")})
          </div>
        </div>
      </div>

      <div
        style={{
          paddingLeft: "1.25rem",
          borderLeft: "2px solid var(--border-strong)",
          marginLeft: "1.1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {graphLabels.map((page, pIndex) => {
          const assignedPosts =
            foundationPages.length > 0
              ? visiblePosts.filter(
                  (_, i) => i % Math.max(foundationPages.length, 1) === pIndex,
                )
              : visiblePosts;

          return (
            <div key={page.slug || pIndex} className="sitemap-node">
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.75rem",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "-1.25rem",
                    top: "50%",
                    width: "1rem",
                    height: "2px",
                    background: "var(--border-strong)",
                  }}
                />
                <a
                  href={page.slug ? `${siteUrl}/${page.slug}` : siteUrl}
                  target="_blank"
                  rel="noopener"
                  style={{
                    padding: "0.4rem 0.8rem",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontWeight: "700",
                    color: "var(--primary)",
                    textDecoration: "none",
                    fontSize: "0.95rem",
                  }}
                >
                  {page.title}
                </a>
              </div>

              {assignedPosts.length > 0 && (
                <div
                  style={{
                    paddingLeft: "1.5rem",
                    borderLeft: "1px dashed var(--border)",
                    marginLeft: "0.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  {assignedPosts.map((post, postIdx) => (
                    <div
                      key={post.slug || post.id || postIdx}
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: "-1.5rem",
                          top: "50%",
                          width: "1.25rem",
                          height: "1px",
                          background: "var(--border)",
                        }}
                      />
                      <a
                        href={`${siteUrl}/post/${post.slug}`}
                        target="_blank"
                        rel="noopener"
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.9rem",
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "400px",
                        }}
                      >
                        {post.edited_title || post.generated_title}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import StrategyInterview from "./StrategyInterview";
export function DashboardScreen({ token, user, onLogout }) {
  const [tab, setTab] = useState((() => { const requested = new URLSearchParams(window.location.search).get("tab"); return ["overview", "profile", "site", "sources", "seo", "idea", "account", "security", "services", "publicsite"].includes(requested) ? requested : "overview"; })());
  const [visibilitySection, setVisibilitySection] = useState("overview");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardFilter, setDashboardFilter] = useState("all");
  const [data, setData] = useState(null);
  const [adminSeoStats, setAdminSeoStats] = useState([]);
  const isAdmin = user?.role === "admin";
  const normalizedUserPlan = String(user?.plan || "")
    .trim()
    .toLowerCase();
  const isBasePlan = !["professional", "pro", "agency"].includes(
    normalizedUserPlan,
  );
  const baseAutoSyncStarted = useRef(false);
  const [baseAcquisition, setBaseAcquisition] = useState({
    status: "idle",
    message: "",
  });

  const [ideaGenState, setIdeaGenState] = useState({
    argomento: "",
    usa_profilo: false,
    links: "",
    loading: false,
    variants: null,
    error: null,
    savingVariantIndex: -1,
  });

  async function generateIdeaTexts() {
    setIdeaGenState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      variants: null,
    }));
    try {
      const res = await apiFetch(
        "/api/index.php?action=generate-ai-texts",
        {
          method: "POST",
          body: JSON.stringify({
            argomento: ideaGenState.argomento,
            usa_profilo: ideaGenState.usa_profilo,
            links: ideaGenState.links,
          }),
        },
        token,
      );
      if (res.variants && res.variants.length >= 2) {
        setIdeaGenState((prev) => ({
          ...prev,
          loading: false,
          variants: res.variants,
        }));
      } else {
        throw new Error("Formato risposta non valido.");
      }
    } catch (err) {
      setIdeaGenState((prev) => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  }

  async function saveIdeaVariant(variant, index) {
    setIdeaGenState((prev) => ({ ...prev, savingVariantIndex: index }));
    try {
      const resp = await apiFetch(
        "/api/index.php?action=post-create",
        {
          method: "POST",
          body: JSON.stringify({
            edited_title: variant.title,
            edited_body: variant.content,
          }),
        },
        token,
      );

      // Apri subito l'editor per questa nuova bozza
      setEditingPost({
        id: resp.id,
        title: variant.title,
        body: variant.content,
        rawContent: "",
        excerpt: "",
        tags: "",
        published: 0,
        noindex: 0,
        mediaUrl: "",
        mediaType: "",
        mediaWidth: 100,
        mediaAlignment: "center",
        imagePixelWidth: 1200,
      });

      // Carica i dati per aggiornare la lista delle bozze in background
      loadData();

      setTab("site");
      setIdeaGenState({
        argomento: "",
        usa_profilo: false,
        links: "",
        loading: false,
        variants: null,
        error: null,
        savingVariantIndex: -1,
      });
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message });
      setIdeaGenState((prev) => ({ ...prev, savingVariantIndex: -1 }));
    }
  }

  const [viewMode, setViewMode] = useState("grid");
  const [postSearch, setPostSearch] = useState("");
  const [postPlatformFilter, setPostPlatformFilter] = useState("all");
  const [postTagFilter, setPostTagFilter] = useState("all");
  const [selectedPosts, setSelectedPosts] = useState([]);
  const [publishingPostId, setPublishingPostId] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const [linkUrl, setLinkUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [harmonizingId, setHarmonizingId] = useState(0);
  const [addUrl, setAddUrl] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addMsg, setAddMsg] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState(null);
  const [scanProgress, setScanProgress] = useState([]);
  const [processingQueue, setProcessingQueue] = useState([]);
  const [syncMsg, setSyncMsg] = useState(null);
  const [acquisitionModal, setAcquisitionModal] = useState(null);
  const [profileDraft, setProfileDraft] = useState("");
  const [roleMissionDraft, setRoleMissionDraft] = useState("");
  const [strategyDraft, setStrategyDraft] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("classic");
  const [regeneratingMenu, setRegeneratingMenu] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [syncLimit, setSyncLimit] = useState(20);

  const [headerLayout, setHeaderLayout] = useState("standard");
  const [accentColor, setAccentColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [brandVisualMode, setBrandVisualMode] = useState("logo");
  const [siteTitleDraft, setSiteTitleDraft] = useState("");
  const [savingSiteTitle, setSavingSiteTitle] = useState(false);
  const [sidebarTitleEditing, setSidebarTitleEditing] = useState(false);
  const [heroTagline, setHeroTagline] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [menuLinksStr, setMenuLinksStr] = useState("");
  const [footerText, setFooterText] = useState("");
  const [harmonizeAgent, setHarmonizeAgent] = useState("content_editor");
  const [accountType, setAccountType] = useState("business");
  const [userAgentPromptDraft, setUserAgentPromptDraft] = useState("");
  const [savingUserAgentPrompt, setSavingUserAgentPrompt] = useState(false);
  const [templateStudio, setTemplateStudio] = useState(() =>
    normalizeStudioData(null),
  );
  const [profileSubTab, setProfileSubTab] = useState("who");
  const [socialProfileDraft, setSocialProfileDraft] = useState({});
  const [profileReviewBusy, setProfileReviewBusy] = useState(false);
  const [profileReviewMessage, setProfileReviewMessage] = useState(null);
  const [editorialEngine, setEditorialEngine] = useState({
    settings: {
      enabled: true,
      auto_run: true,
      min_posts: 8,
      strict_indexing_mode: true,
    },
    dna: {},
    memory: {},
    state: {},
    last_run: null,
  });
  const [editorialEngineBusy, setEditorialEngineBusy] = useState(false);
  const [editorialEngineMsg, setEditorialEngineMsg] = useState(null);
  const [understandingReport, setUnderstandingReport] = useState(null);
  const [understandingDraft, setUnderstandingDraft] = useState(null);
  const [savingUnderstanding, setSavingUnderstanding] = useState(false);
  const [strategyStep, setStrategyStep] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingVisualMode, setSavingVisualMode] = useState(false);
  const [reachabilityDraft, setReachabilityDraft] = useState({
    presence_mode: "undecided",
    official_site_url: "",
    business_profile_url: "",
    primary_topic: "",
    service_areas: [],
    reciprocal_link_confirmed: false,
    phone: "",
    whatsapp: "",
    email: "",
  });
  const [savingReachability, setSavingReachability] = useState(false);
  const [savingSearchVisible, setSavingSearchVisible] = useState(false);
  const [aiContentIdeas, setAiContentIdeas] = useState([]);
  const [ideasGeneratedAt, setIdeasGeneratedAt] = useState("");
  const [ideasNewsSignals, setIdeasNewsSignals] = useState(0);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [editorialBrief, setEditorialBrief] = useState({ objective: '', platform: '', focus: '' });
  const knowledge = useLiaKnowledge(data?.site, token);
  const [articleLength, setArticleLength] = useState("compact");
  const [preparingIdea, setPreparingIdea] = useState(-1);
  const [editingIdea, setEditingIdea] = useState(null); // {index, title, reason}
  const [customIdeaOpen, setCustomIdeaOpen] = useState(false);
  const [customIdea, setCustomIdea] = useState({ title: "", reason: "" });
  const [dismissedIdeaKeys, setDismissedIdeaKeys] = useState([]);
  const [dismissingIdeaKey, setDismissingIdeaKey] = useState("");
  const [socialComposer, setSocialComposer] = useState(null);
  const [socialPlatform, setSocialPlatform] = useState("instagram");
  const [generatingSocial, setGeneratingSocial] = useState(false);
  const [promptDrafts, setPromptDrafts] = useState({});
  const [savingPromptName, setSavingPromptName] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const siteUrl = `${window.location.origin}/${user?.slug}`;

  const [showInterview, setShowInterview] = useState(false);
  const activeUnderstanding = understandingDraft || understandingReport || {};
  const declaredStrategy = activeUnderstanding.declared_strategy || {};
  const isStrategyComplete = [
    "activity_type",
    "primary_goal",
    "primary_audience",
    "tone_of_voice",
    "differentiators",
  ].every((f) => declaredStrategy?.[f]);

  useEffect(() => {
    if (
      isStrategyComplete &&
      !userAgentPromptDraft &&
      !data?.site?.user_agent_prompt &&
      !hasGeneratedPrompt.current
    ) {
      hasGeneratedPrompt.current = true;
      const draft = `Attività: ${declaredStrategy.activity_type || ""}
Obiettivo: ${declaredStrategy.primary_goal || ""}
Pubblico: ${declaredStrategy.primary_audience || ""}
Tono di voce: ${declaredStrategy.tone_of_voice || ""}
Punti distintivi: ${declaredStrategy.differentiators || ""}

Linee guida per l'Agente Editoriale:
Scrivi tutti i contenuti per questa attività rispettando rigorosamente il tono di voce indicato. Mantieni il focus sull'obiettivo principale e rivolgiti direttamente al pubblico target, mettendo in risalto gli elementi distintivi.`;
      setUserAgentPromptDraft(draft);
      // Auto-save the generated draft
      apiFetch(
        "/api/index.php?action=site-update",
        { method: "POST", body: JSON.stringify({ user_agent_prompt: draft }) },
        token,
      ).catch((e) => console.error(e));
    }
  }, [isStrategyComplete, declaredStrategy, userAgentPromptDraft, data, token]);

  async function changeOwnPassword(e) {
    e.preventDefault();
    setPasswordMsg(null);
    if (passwordForm.next.length < 8) {
      setPasswordMsg({
        ok: false,
        text: "La nuova password deve contenere almeno 8 caratteri.",
      });
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMsg({
        ok: false,
        text: "Le due nuove password non coincidono.",
      });
      return;
    }

    setChangingPassword(true);
    try {
      const result = await apiFetch(
        "/api/index.php?action=password-change",
        {
          method: "POST",
          body: JSON.stringify({
            current_password: passwordForm.current,
            new_password: passwordForm.next,
          }),
        },
        token,
      );
      setPasswordForm({ current: "", next: "", confirm: "" });
      setPasswordMsg({
        ok: true,
        text: result.message || "Password aggiornata con successo.",
      });
    } catch (e) {
      setPasswordMsg({ ok: false, text: e.message });
    } finally {
      setChangingPassword(false);
    }
  }

  // ── Tema forzato su "light" per leggibilità anziani ──────────────
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  useEffect(() => {
    loadData();
    loadDrafts();
  }, []);

  useEffect(() => {
    let intervalId;
    if (syncing || scanning || importing || harmonizingId > 0) {
      intervalId = setInterval(async () => {
        try {
          const res = await apiFetch(
            "/api/index.php?action=sync-status",
            {},
            token,
          );
          if (res && res.ok && res.msg) {
            setSyncMsg((prev) => ({
              ok: prev?.ok ?? true,
              text: res.msg,
              loading: prev?.loading ?? true,
            }));
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
      const d = await apiFetch("/api/index.php?action=site", {}, token);
      setData(d);
      setProfileDraft(d.site?.profile_summary || d.site?.bio || "");
      setRoleMissionDraft(d.site?.role_mission || "");
      setStrategyDraft(d.site?.content_strategy || "");
      setSelectedTheme(d.site?.theme || "classic");

      setHeaderLayout(d.site?.header_layout || "standard");
      setAccentColor(d.site?.accent_color || "");
      setLogoUrl(d.site?.logo_url || "");
      setCoverUrl(d.site?.cover_url || "");
      setBrandVisualMode(
        d.site?.brand_visual_mode === "cover" ? "cover" : "logo",
      );
      setSiteTitleDraft(d.site?.title || "");
      setHeroTagline(d.site?.hero_tagline || "");
      setCustomCss(d.site?.custom_css || "");
      setFooterText(d.site?.footer_text || "");
      setHarmonizeAgent(d.site?.harmonize_agent || "content_editor");
      setAccountType(d.site?.account_type || "business");
      setUserAgentPromptDraft(d.site?.user_agent_prompt || "");
      try {
        const dismissed =
          typeof d.site?.dismissed_content_ideas === "string"
            ? JSON.parse(d.site.dismissed_content_ideas || "[]")
            : d.site?.dismissed_content_ideas || [];
        setDismissedIdeaKeys(Array.isArray(dismissed) ? dismissed : []);
      } catch (_) {
        setDismissedIdeaKeys([]);
      }
      setReachabilityDraft(
        d.reachability?.profile || {
          presence_mode: "undecided",
          official_site_url: "",
          business_profile_url: "",
          primary_topic: "",
          service_areas: [],
          reciprocal_link_confirmed: false,
          phone: "",
          whatsapp: "",
          email: "",
        },
      );
      let parsedEditorialSettings = {
        enabled: true,
        auto_run: true,
        min_posts: 8,
        strict_indexing_mode: true,
      };
      let parsedEditorialDna = {};
      let parsedEditorialMemory = {};
      let parsedEditorialState = {};
      try {
        if (d.site?.editorial_settings) {
          parsedEditorialSettings = {
            ...parsedEditorialSettings,
            ...(typeof d.site.editorial_settings === "string"
              ? JSON.parse(d.site.editorial_settings)
              : d.site.editorial_settings),
          };
        }
      } catch (e) {
        console.error("Errore parse editorial_settings:", e);
      }
      try {
        if (d.site?.editorial_dna) {
          parsedEditorialDna =
            typeof d.site.editorial_dna === "string"
              ? JSON.parse(d.site.editorial_dna)
              : d.site.editorial_dna;
        }
      } catch (e) {
        console.error("Errore parse editorial_dna:", e);
      }
      try {
        if (d.site?.editorial_memory) {
          parsedEditorialMemory =
            typeof d.site.editorial_memory === "string"
              ? JSON.parse(d.site.editorial_memory)
              : d.site.editorial_memory;
        }
      } catch (e) {
        console.error("Errore parse editorial_memory:", e);
      }
      try {
        if (d.site?.editorial_engine_state) {
          parsedEditorialState =
            typeof d.site.editorial_engine_state === "string"
              ? JSON.parse(d.site.editorial_engine_state)
              : d.site.editorial_engine_state;
        }
      } catch (e) {
        console.error("Errore parse editorial_engine_state:", e);
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
          parsedSiteAiData =
            typeof d.site.site_ai_data === "string"
              ? JSON.parse(d.site.site_ai_data)
              : d.site.site_ai_data;
        } catch (e) {
          console.error("Errore parse site_ai_data:", e);
        }
      }
      setTemplateStudio(
        normalizeStudioData(parsedSiteAiData, d.site?.theme || "tech-clarity"),
      );
      try {
        const rawUnderstanding = d.site?.site_understanding
          ? typeof d.site.site_understanding === "string"
            ? JSON.parse(d.site.site_understanding)
            : d.site.site_understanding
          : null;
        const parsedUnderstanding =
          rawUnderstanding &&
          typeof rawUnderstanding === "object" &&
          Object.keys(rawUnderstanding).length
            ? rawUnderstanding
            : null;
        setUnderstandingReport(parsedUnderstanding);
        setUnderstandingDraft(parsedUnderstanding);
        const corrections = typeof d.site?.site_understanding_corrections === 'string' ? JSON.parse(d.site.site_understanding_corrections || '{}') : d.site?.site_understanding_corrections || {};
        setSocialProfileDraft(corrections.social_profile || {});
      } catch (e) {
        console.error("Errore parse site_understanding:", e);
        setUnderstandingReport(null);
        setUnderstandingDraft(null);
      }
      if (d.site?.menu_links) {
        try {
          const arr = JSON.parse(d.site.menu_links);
          setMenuLinksStr(arr.map((x) => `${x.label}|${x.url}`).join("\n"));
        } catch {
          setMenuLinksStr(d.site.menu_links);
        }
      }

      if (user?.role === "admin") {
        apiFetch("/api/index.php?action=admin-seo", {}, token)
          .then((res) => setAdminSeoStats(res.stats || []))
          .catch((e) => console.error(e));
      }
      return d;
    } catch (err) {
      alert("ERRORE CARICAMENTO DASHBOARD: " + err.message);
      return null;
    }
  }

  async function loadDrafts() {
    try {
      const d = await apiFetch("/api/index.php?action=drafts", {}, token);
      setDrafts(d || []);
    } catch {}
  }

  // Importa una pagina web esplicita.
  async function doImport(e) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setImporting(true);
    setImportMsg(null);
    setAcquisitionModal({
      status: "working",
      title: "Sto acquisendo il contenuto",
      text: "Apro il link e recupero testo, immagini o video. Puoi seguire qui tutte le fasi.",
    });
    try {
      const r = await apiFetch(
        "/api/index.php?action=ingest-url",
        { method: "POST", body: JSON.stringify({ url: linkUrl.trim() }) },
        token,
      );
      if (r.duplicate) {
        setAcquisitionModal({
          status: "success",
          title: "Contenuto già presente",
          text: "Il link era stato acquisito in precedenza: lo trovi nella sezione Articoli.",
        });
        setImportMsg({
          ok: true,
          text: "Questo contenuto era già stato importato.",
        });
      } else {
        setImportMsg({
          ok: true,
          text: "Acquisizione completata! Elaborazione AI in corso...",
        });
        // Mantiene aperto il flusso guidato fino al completamento dell'articolo.
        await processPendingLoop(true, [r.id]);
      }
      setLinkUrl("");
      await loadDrafts();
      await loadData();
    } catch (err) {
      setImportMsg({ ok: false, text: err.message });
      setAcquisitionModal({
        status: "error",
        title: "Importazione non completata",
        text: err.message,
      });
    }
    setImporting(false);
  }

  // AGENTE 2 — Armonizzatore: bozza → articolo pubblicato
  async function doHarmonize(id) {
    setHarmonizingId(id);
    try {
      await apiFetch(
        "/api/index.php?action=harmonize",
        { method: "POST", body: JSON.stringify({ id }) },
        token,
      );
      await loadDrafts();
      await loadData();
    } catch (err) {
      setImportMsg({ ok: false, text: err.message });
    }
    setHarmonizingId(0);
  }

  async function retryPendingPost(id) {
    setAcquisitionModal({
      status: "working",
      title: "Riprovo l'elaborazione",
      text: "Recupero nuovamente il contenuto e preparo una bozza pubblicabile.",
      completed: 0,
      total: 1,
    });
    try {
      const result = await apiFetch(
        "/api/index.php?action=process-pending",
        {
          method: "POST",
          body: JSON.stringify({ id }),
        },
        token,
      );
      if (result?.ok === false)
        throw new Error(
          result.message || "Il contenuto non è più disponibile nella coda.",
        );
      await loadDrafts();
      await loadData();
      setAcquisitionModal({
        status: "success",
        title: "Articolo elaborato",
        text:
          result?.status === "published"
            ? "Il contenuto è stato elaborato e pubblicato."
            : "Il contenuto è stato elaborato ed è disponibile negli Articoli.",
        completed: 1,
        total: 1,
      });
    } catch (error) {
      await loadData();
      const message =
        error.message || "Non è stato possibile elaborare il contenuto.";
      setAcquisitionModal({
        status: "error",
        title: "Elaborazione non riuscita",
        text: message,
        debug: [
          errorDiagnosis(message),
          `POST #${id} · ERRORE · ${message}`,
        ].filter(Boolean),
      });
    }
  }

  // Funzione helper per elaborare la coda (ora in parallelo)
  async function processPendingLoop(
    isScan = false,
    onlyIds = null,
    initialDebug = [],
  ) {
    try {
      const allPending = await apiFetch(
        "/api/index.php?action=pending-posts",
        {},
        token,
      );
      const requestedIds = Array.isArray(onlyIds)
        ? new Set(onlyIds.map(Number))
        : null;
      const pending = requestedIds
        ? (allPending || []).filter((post) => requestedIds.has(Number(post.id)))
        : allPending || [];
      if (!pending || pending.length === 0) {
        setAcquisitionModal({
          status: "success",
          title: "Nessun contenuto da elaborare",
          text: requestedIds
            ? "Il contenuto è già stato elaborato oppure è già in lavorazione."
            : "Non ci sono nuovi contenuti in attesa. Gli articoli già acquisiti non vengono rigenerati.",
          debug: initialDebug,
        });
        return;
      }

      setProcessingQueue(pending.map((p) => ({ ...p, status: "pending" })));

      const total = pending.length;
      let completed = 0;
      let publishedCount = 0;
      let draftCount = 0;
      let skippedCount = 0;
      let deletedCount = 0;
      let errorCount = 0;
      const debugLines = [...(Array.isArray(initialDebug) ? initialDebug : [])];
      const errorMessages = [];
      const concurrency = 3; // Tre armonizzazioni leggere in parallelo, senza trascrizioni inutili.

      const updateProgress = () => {
        const msg = `Elaborazione AI: completati ${completed} su ${total} post...`;
        setAcquisitionModal({
          status: "working",
          title: "Creo i tuoi articoli",
          text: msg,
          completed,
          total,
          debug: [...debugLines],
        });
        if (isScan) setScanMsg({ ok: true, text: msg, loading: true });
        else setSyncMsg({ ok: true, text: msg, loading: true });
      };

      updateProgress();

      const processPost = async (post) => {
        setProcessingQueue((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, status: "processing" } : p,
          ),
        );
        const postLabel =
          post.generated_title ||
          post.source_url ||
          `${post.platform} #${post.id}`;
        const processingMsg = `Elaborazione AI in corso: ${completed + 1}/${total} - ${post.platform.toUpperCase()} - ${postLabel}`;
        setAcquisitionModal({
          status: "working",
          title: "Creo i tuoi articoli",
          text: processingMsg,
          completed,
          total,
          debug: [...debugLines],
        });
        if (isScan)
          setScanMsg({ ok: true, text: processingMsg, loading: true });
        else setSyncMsg({ ok: true, text: processingMsg, loading: true });
        let errorMsg = null;
        try {
          const res = await apiFetch(
            "/api/index.php?action=process-pending",
            {
              method: "POST",
              body: JSON.stringify({ id: post.id }),
            },
            token,
          );
          if (res?.status === "published") publishedCount++;
          else if (res?.status === "draft") draftCount++;
          else if (res?.status === "skipped") skippedCount++;
          else if (res?.status === "deleted") deletedCount++;
          else if (res?.busy) skippedCount++;
          debugLines.push(
            `${post.platform.toUpperCase()} #${post.id} · elaborazione ${res?.status || (res?.busy ? "già in corso" : "completata")}`,
          );
        } catch (e) {
          console.error("Errore post", post.id, e);
          errorMsg = e.message;
          errorMessages.push(errorMsg);
          debugLines.push(
            `${post.platform.toUpperCase()} #${post.id} · ERRORE · ${errorMsg}`,
          );
          errorCount++;
        }

        setProcessingQueue((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, status: errorMsg ? "error" : "done" }
              : p,
          ),
        );
        completed++;
        updateProgress();
      };

      for (let i = 0; i < pending.length; i += concurrency) {
        const chunk = pending.slice(i, i + concurrency);
        await Promise.all(chunk.map((post) => processPost(post)));
      }

      const doneMsg = `Elaborazione completata. Contenuti: ${total}. Pubblicati: ${publishedCount}. In bozza: ${draftCount}. Già in lavorazione: ${skippedCount}. Saltati: ${deletedCount}. Errori: ${errorCount}.`;
      const diagnoses = [
        ...new Set(errorMessages.map(errorDiagnosis).filter(Boolean)),
      ];
      setAcquisitionModal({
        status: errorCount === total ? "error" : "success",
        title:
          errorCount === total
            ? "Elaborazione non riuscita"
            : errorCount > 0
              ? "Completato con alcuni errori"
              : "I contenuti sono pronti",
        text: doneMsg,
        completed: total,
        total,
        debug: [...diagnoses, ...debugLines],
      });
      if (isScan) setScanMsg({ ok: true, text: doneMsg });
      else setSyncMsg({ ok: true, text: doneMsg });

      // Ritardiamo la pulizia della coda per far vedere all'utente il completamento
      setTimeout(() => setProcessingQueue([]), 5000);

      await loadDrafts();
      await loadData();
    } catch (e) {
      console.error(e);
      setProcessingQueue([]);
      const message =
        e.message ||
        "Si è verificato un errore durante la creazione degli articoli.";
      setAcquisitionModal({
        status: "error",
        title: "Elaborazione interrotta",
        text: message,
        debug: [
          errorDiagnosis(message),
          ...(Array.isArray(initialDebug) ? initialDebug : []),
          `ERRORE · ${message}`,
        ].filter(Boolean),
      });
    }
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMsg({
      ok: true,
      text: "Acquisizione post in corso...",
      loading: true,
    });
    setAcquisitionModal({
      status: "working",
      title: "Aggiorno i tuoi canali",
      text: "Cerco nuovi contenuti sui canali collegati. L'operazione può richiedere qualche minuto.",
    });
    try {
      const sync = await apiFetch(
        "/api/index.php?action=sync",
        {
          method: "POST",
          body: JSON.stringify({ limit: parseInt(syncLimit) || 20 }),
        },
        token,
      );
      const results = Array.isArray(sync?.results) ? sync.results : [];
      const debugLines = results.flatMap((result) =>
        providerDebugLines(result?.debug),
      );
      const errors = results
        .filter((result) => result?.error)
        .map((result) => String(result.error));
      const imported = results.reduce(
        (sum, result) => sum + Number(result?.new || 0),
        0,
      );
      if (errors.length > 0 && imported === 0) {
        const message = `La scansione non ha funzionato: ${errors[0]}`;
        setSyncMsg({ ok: false, text: message });
        setAcquisitionModal({
          status: "error",
          title: "Aggiornamento non riuscito",
          text: message,
          debug: debugLines,
        });
      } else {
        await processPendingLoop(false, null, debugLines);
      }
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message });
      setAcquisitionModal({
        status: "error",
        title: "Aggiornamento non completato",
        text: e.message,
      });
    } finally {
      setSyncing(false);
    }
  }

  // Il piano Base deve mostrare un risultato reale il prima possibile. Al
  // primo ingresso scarichiamo pochi contenuti, li rendiamo subito visibili e
  // completiamo in parallelo soltanto il primo piccolo gruppo.
  async function acquireBaseContent(automatic = false) {
    if (syncing) return;
    setSyncing(true);
    setBaseAcquisition({
      status: "working",
      message: "Cerco gli ultimi contenuti del tuo social…",
    });
    try {
      const sync = await apiFetch(
        "/api/index.php?action=sync",
        {
          method: "POST",
          body: JSON.stringify({ limit: 6 }),
        },
        token,
      );
      const results = Array.isArray(sync?.results) ? sync.results : [];
      const errors = results
        .filter((result) => result?.error)
        .map((result) => result.error);
      const found = results.reduce(
        (total, result) => total + Number(result?.found || 0),
        0,
      );
      const imported = results.reduce(
        (total, result) => total + Number(result?.new || 0),
        0,
      );

      if (errors.length > 0 && imported === 0) {
        setBaseAcquisition({
          status: "error",
          message: `Il canale non ha potuto essere letto: ${errors[0]}`,
        });
        if (!automatic)
          setAcquisitionModal({
            status: "error",
            title: "Acquisizione non riuscita",
            text: errors[0],
          });
        return;
      }

      // Questa lettura fa comparire subito i post grezzi: l'utente non deve
      // aspettare la riscrittura AI per avere la prova dell'acquisizione.
      await loadData();
      const queue = await apiFetch(
        "/api/index.php?action=pending-posts",
        {},
        token,
      );
      const firstBatch = (Array.isArray(queue) ? queue : []).slice(0, 6);

      if (firstBatch.length) {
        setBaseAcquisition({
          status: "working",
          message: `Trovati ${Math.max(found, imported, firstBatch.length)} contenuti. Preparo i primi articoli…`,
        });
        for (let index = 0; index < firstBatch.length; index += 2) {
          const batch = firstBatch.slice(index, index + 2);
          await Promise.all(
            batch.map((post) =>
              apiFetch(
                "/api/index.php?action=process-pending",
                {
                  method: "POST",
                  body: JSON.stringify({ id: post.id }),
                },
                token,
              ).catch(() => null),
            ),
          );
          await loadData();
        }
      }

      const fresh = await loadData();
      const total = fresh?.posts?.length || 0;
      if (total > 0) {
        setBaseAcquisition({
          status: "success",
          message: `${total} contenuti acquisiti. Il tuo spazio è pronto da esplorare.`,
        });
      } else {
        setBaseAcquisition({
          status: "empty",
          message:
            "Il canale non ha restituito contenuti pubblici. Controlla il collegamento o prova ad aggiornarlo.",
        });
      }
    } catch (error) {
      setBaseAcquisition({
        status: "error",
        message: error.message || "Non sono riuscito a leggere il canale.",
      });
      if (!automatic) setSyncMsg({ ok: false, text: error.message });
    } finally {
      setSyncing(false);
    }
  }

  async function togglePublishPost(id, currentStatus) {
    const newStatus = Number(currentStatus) === 1 ? 0 : 1;
    setPublishingPostId(id);
    try {
      await apiFetch(
        "/api/index.php?action=toggle-publish-post",
        { method: "POST", body: JSON.stringify({ id, published: newStatus }) },
        token,
      );
      setData((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p.id === id ? { ...p, published: newStatus } : p,
        ),
      }));
      setSyncMsg({
        ok: true,
        text:
          newStatus === 1
            ? "Articolo pubblicato sul sito."
            : "Articolo rimosso dal sito e riportato in bozza.",
      });
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    } finally {
      setPublishingPostId(null);
    }
  }

  async function deletePost(id) {
    if (
      !window.confirm(
        "Sei sicuro di voler eliminare definitivamente questo post? Verrà rimosso anche dal sito pubblico.",
      )
    )
      return;
    await apiFetch(
      "/api/index.php?action=delete-post",
      { method: "POST", body: JSON.stringify({ id }) },
      token,
    );
    setData((prev) => ({
      ...prev,
      posts: prev.posts.filter((p) => p.id !== id),
    }));
    setSelectedPosts((prev) => prev.filter((pId) => pId !== id));
  }

  function togglePostSelection(id) {
    setSelectedPosts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function selectAllPosts(filteredPostsList) {
    if (
      selectedPosts.length === filteredPostsList.length &&
      filteredPostsList.length > 0
    ) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(filteredPostsList.map((p) => p.id));
    }
  }

  async function bulkDeletePosts() {
    if (selectedPosts.length === 0) return;
    if (
      !window.confirm(
        `Sei sicuro di voler eliminare definitivamente ${selectedPosts.length} contenuti selezionati?`,
      )
    )
      return;

    await apiFetch(
      "/api/index.php?action=bulk-delete-posts",
      { method: "POST", body: JSON.stringify({ ids: selectedPosts }) },
      token,
    );
    setData((prev) => ({
      ...prev,
      posts: prev.posts.filter((p) => !selectedPosts.includes(p.id)),
    }));
    setSelectedPosts([]);
  }

  async function savePlatformSource(
    platform,
    url,
    since_date = null,
    auto_publish = 1,
    max_posts = null,
    topic_summary = null,
    auto_sync = 1,
  ) {
    try {
      await apiFetch(
        "/api/index.php?action=social-source-upsert",
        {
          method: "POST",
          body: JSON.stringify({
            platform,
            label: SOCIAL[platform]?.label || platform,
            url,
            since_date,
            auto_publish,
            max_posts,
            topic_summary,
            auto_sync,
            scan_now: false,
          }),
        },
        token,
      );
      await loadData();
    } catch (err) {
      setScanMsg({ ok: false, text: err.message });
    }
  }

  async function syncAllChannels() {
    setScanning(true);
    setScanProgress([]);
    setScanMsg({
      ok: true,
      text: "Sincronizzazione manuale di tutti i canali attivi...",
      loading: true,
    });
    setAcquisitionModal({
      status: "working",
      title: "Sincronizzo tutti i canali",
      text: "Controllo ogni fonte collegata e acquisisco i nuovi contenuti. Puoi seguire qui l'avanzamento.",
    });
    try {
      const sync = await apiFetch(
        "/api/index.php?action=sync",
        {
          method: "POST",
          body: JSON.stringify({ limit: parseInt(syncLimit) || 20 }),
        },
        token,
      );
      const results = Array.isArray(sync?.results) ? sync.results : [];
      const debugLines = results.flatMap((result) =>
        providerDebugLines(result?.debug),
      );
      const errors = results
        .filter((result) => result?.error)
        .map((result) => String(result.error));
      const imported = results.reduce(
        (sum, result) => sum + Number(result?.new || 0),
        0,
      );
      if (errors.length > 0 && imported === 0) {
        const message = `La scansione non ha funzionato: ${errors[0]}`;
        setScanMsg({ ok: false, text: message, loading: false });
        setAcquisitionModal({
          status: "error",
          title: "Acquisizione non riuscita",
          text: message,
          debug: debugLines,
        });
        return;
      }
      await processPendingLoop(true, null, debugLines);
      await loadData();
    } catch (err) {
      setScanMsg({ ok: false, text: err.message });
      setAcquisitionModal({
        status: "error",
        title: "Sincronizzazione non completata",
        text: err.message,
      });
    } finally {
      setScanning(false);
    }
  }

  async function scanSources() {
    if (!sources || sources.length === 0) {
      alert(
        "Nessuna fonte social attiva. Aggiungine una prima di scansionare.",
      );
      return;
    }
    setScanning(true);
    setScanMsg({
      ok: true,
      text: "Preparazione sincronizzazione dei canali attivi...",
      loading: true,
    });
    setScanProgress(
      sources.map((s, index) => ({
        id: s.id,
        platform: s.platform,
        label: s.label,
        status: "pending",
        details: `In attesa di avvio (${index + 1}/${sources.length})`,
      })),
    );

    let totalImported = 0;
    let totalFound = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;
    const importedIds = [];
    const retryableIds = [];
    const sourceErrorMessages = [];
    const scanDebugLines = [];

    const scanSource = async (source, i) => {
      const sourceName = source.label || source.platform;
      const sourceOrdinal = `sorgente ${i + 1} di ${sources.length}`;
      setScanProgress((prev) =>
        prev.map((s) =>
          s.id === source.id
            ? {
                ...s,
                status: "scanning",
                details: `Apro ${sourceName} e cerco post pubblici recenti (${sourceOrdinal})`,
              }
            : s,
        ),
      );
      setScanMsg({
        ok: true,
        text: `Sto analizzando ${sourceName}: recupero i post pubblici recenti dalla ${source.platform} (${sourceOrdinal}).`,
        loading: true,
      });
      try {
        const res = await apiFetch(
          "/api/index.php?action=scan-sources",
          {
            method: "POST",
            body: JSON.stringify({
              source_id: source.id,
              limit: parseInt(syncLimit) || 20,
              profile_summary: profileDraft,
              role_mission: roleMissionDraft,
              content_strategy: strategyDraft,
            }),
          },
          token,
        );
        const r = res.report;
        scanDebugLines.push(...providerDebugLines(r?.debug));
        totalImported += r.imported || 0;
        totalFound += r.found || 0;
        totalDuplicates += r.duplicates || 0;
        if (Array.isArray(r.imported_ids))
          importedIds.push(...r.imported_ids.map(Number));
        if (Array.isArray(r.retryable_ids))
          retryableIds.push(...r.retryable_ids.map(Number));
        const errorsForSource = Array.isArray(r.errors) ? r.errors.length : 0;
        if (errorsForSource > 0)
          sourceErrorMessages.push(...r.errors.map((error) => String(error)));
        totalErrors += errorsForSource;
        const resultText = [
          `Trovati: ${r.found || 0}`,
          `Importati: ${r.imported || 0}`,
          `Duplicati: ${r.duplicates || 0}`,
          `Errori: ${errorsForSource}`,
        ].join(" • ");
        setScanProgress((prev) =>
          prev.map((s) =>
            s.id === source.id
              ? {
                  ...s,
                  status: errorsForSource > 0 ? "error" : "done",
                  details: resultText,
                }
              : s,
          ),
        );
        setScanMsg({
          ok: errorsForSource === 0,
          text: `Sorgente completata: ${sourceName}. ${resultText}.`,
          loading: false,
        });
      } catch (err) {
        console.error("Errore scansione " + source.platform, err);
        totalErrors++;
        sourceErrorMessages.push(err.message);
        setScanProgress((prev) =>
          prev.map((s) =>
            s.id === source.id
              ? {
                  ...s,
                  status: "error",
                  details: `Errore durante l'acquisizione: ${err.message}`,
                }
              : s,
          ),
        );
        setScanMsg({
          ok: false,
          text: `Errore durante la scansione di ${sourceName}: ${err.message}`,
          loading: false,
        });
      }
    };

    // Le sorgenti esterne sono indipendenti: ne interroghiamo fino a tre
    // insieme, così tre canali non richiedono tre attese consecutive.
    const sourceConcurrency = 3;
    for (let i = 0; i < sources.length; i += sourceConcurrency) {
      const chunk = sources.slice(i, i + sourceConcurrency);
      await Promise.all(
        chunk.map((source, offset) => scanSource(source, i + offset)),
      );
    }

    const processingIds = [...new Set([...importedIds, ...retryableIds])];
    setScanMsg({
      ok: totalErrors === 0,
      text:
        processingIds.length > 0
          ? `Acquisizione completata. Totale trovati: ${totalFound}. Nuovi importati: ${totalImported}. Da elaborare o riprovare: ${processingIds.length}. Duplicati: ${totalDuplicates}. Errori: ${totalErrors}.`
          : `Acquisizione completata. Nessun nuovo contenuto da elaborare. Duplicati: ${totalDuplicates}. Errori: ${totalErrors}.`,
      loading: processingIds.length > 0,
    });
    if (totalErrors === 0) setTimeout(() => setScanProgress([]), 3000);
    if (processingIds.length > 0) {
      await processPendingLoop(true, processingIds, scanDebugLines);
    } else if (totalErrors > 0) {
      setAcquisitionModal({
        status: "error",
        title: "Acquisizione non riuscita",
        text:
          sourceErrorMessages[0] ||
          "I provider social non hanno restituito contenuti. Controlla la configurazione e riprova.",
        debug: scanDebugLines,
      });
    } else {
      setAcquisitionModal({
        status: "success",
        title: "Canali aggiornati",
        text: "Non sono stati trovati nuovi contenuti. Nessun articolo esistente è stato rigenerato.",
        debug: scanDebugLines,
      });
    }
    setScanning(false);
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await apiFetch(
        "/api/index.php?action=site-update",
        {
          method: "POST",
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
            menu_links: menuLinksStr
              .split("\n")
              .filter((x) => x.trim())
              .map((x) => {
                const parts = x.split("|");
                return {
                  label: parts[0].trim(),
                  url: parts[1] ? parts[1].trim() : "",
                };
              }),
          }),
        },
        token,
      );
      await loadData();
    } catch (err) {
      setScanMsg({ ok: false, text: err.message });
    }
    setSavingProfile(false);
  }

  function updateUnderstandingField(key, value) {
    setUnderstandingDraft((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function updateUnderstandingList(key, value) {
    updateUnderstandingField(
      key,
      value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  function updateUnderstandingNested(section, key, value) {
    setUnderstandingDraft((prev) => ({
      ...(prev || {}),
      [section]: {
        ...((prev && prev[section]) || {}),
        [key]: value,
      },
    }));
  }

  function updateUnderstandingNestedList(section, key, value) {
    updateUnderstandingNested(
      section,
      key,
      value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  function updateDeclaredStrategy(key, value) {
    updateUnderstandingNested("declared_strategy", key, value);
  }

  function updateDeclaredStrategyList(key, value) {
    updateDeclaredStrategy(
      key,
      value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  function openDashboardSection(target) {
    if (target === "strategy") {
      setTab("profile");
      setProfileSubTab("who");
    } else if (target === "modules") setTab("services");
    else {
      setTab("seo");
      setVisibilitySection(target === "overview" ? "overview" : "ideas");
    }
    window.setTimeout(
      () =>
        document
          .getElementById(target)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }

  async function saveUnderstanding() {
    setSavingUnderstanding(true);
    try {
      await apiFetch(
        "/api/index.php?action=site-update",
        {
          method: "POST",
          body: JSON.stringify({
            site_understanding_corrections: {
              declared_strategy: understandingDraft?.declared_strategy || {},
            },
          }),
        },
        token,
      );
      setUnderstandingReport(understandingDraft);
      setSyncMsg({
        ok: true,
        text: "Strategia salvata. Da ora guiderà pagine SEO, analisi e prossimi contenuti.",
      });
      await loadData();
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    }
    setSavingUnderstanding(false);
  }

  async function saveProfileReview(mode) {
    setProfileReviewBusy(true); setProfileReviewMessage(null);
    try {
      const social = { ...(profileUnderstanding || {}), ...socialProfileDraft };
      const body = mode === 'public' ? { profile_summary: profileDraft, bio: profileDraft, hero_tagline: heroTagline, role_mission: roleMissionDraft, content_strategy: strategyDraft } : { site_understanding_corrections: mode === 'social' ? { social_profile: Object.fromEntries(['summary','activity_type','tone','audiences','topics','goals','locations','offers'].map(key => [key, social[key] || (['audiences','topics','goals','locations','offers'].includes(key) ? [] : '')])) } : { declared_strategy: declaredStrategy } };
      await apiFetch('/api/index.php?action=site-update', {method:'POST',body:JSON.stringify(body)}, token);
      await loadData();
      setProfileReviewMessage({ok:true,text:'Salvato. Il profilo guida l’AI. Per aggiornare il sito esistente, trasferisci i dati alla bozza e pubblica dall’editor.'});
    } catch(error) {setProfileReviewMessage({ok:false,text:error.message});}
    setProfileReviewBusy(false);
  }

  async function uploadSiteVisual(event, kind = "logo") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setSyncMsg({ ok: false, text: "Usa un’immagine JPG, PNG o WebP." });
      return;
    }
    const maxBytes = kind === "cover" ? 8 * 1024 * 1024 : 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      setSyncMsg({
        ok: false,
        text:
          kind === "cover"
            ? "L’immagine deve pesare meno di 8 MB."
            : "Il logo deve pesare meno di 3 MB.",
      });
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
      const response = await apiFetch(
        "/api/index.php?action=site-visual-upload",
        {
          method: "POST",
          body: JSON.stringify({ data_url: dataUrl, kind }),
        },
        token,
      );
      if (kind === "cover")
        setCoverUrl(response.cover_url || response.url || "");
      else setLogoUrl(response.logo_url || response.url || "");
      setBrandVisualMode(kind);
      setSyncMsg({
        ok: true,
        text:
          kind === "cover"
            ? "Immagine del sito salvata e attivata."
            : "Logo salvato e attivato sul sito.",
      });
      await loadData();
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    }
    setUploadingLogo(false);
  }

  async function uploadBrandLogo(event) {
    return uploadSiteVisual(event, "logo");
  }

  async function selectBrandVisualMode(mode) {
    const nextMode = mode === "cover" ? "cover" : "logo";
    setBrandVisualMode(nextMode);
    setSavingVisualMode(true);
    try {
      await apiFetch(
        "/api/index.php?action=site-update",
        {
          method: "POST",
          body: JSON.stringify({ brand_visual_mode: nextMode }),
        },
        token,
      );
      setSyncMsg({
        ok: true,
        text:
          nextMode === "cover"
            ? "Il sito userà l’immagine rappresentativa."
            : "Il sito userà il logo.",
      });
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
      setSyncMsg({ ok: false, text: "Inserisci il nome del sito." });
      return;
    }
    setSavingSiteTitle(true);
    try {
      await apiFetch(
        "/api/index.php?action=site-update",
        {
          method: "POST",
          body: JSON.stringify({ title }),
        },
        token,
      );
      setSiteTitleDraft(title);
      setData((prev) => ({ ...prev, site: { ...(prev.site || {}), title } }));
      setSyncMsg({
        ok: true,
        text: "Nome del sito salvato. È già attivo sul sito pubblico.",
      });
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
      await apiFetch(
        "/api/index.php?action=reachability-update",
        {
          method: "POST",
          body: JSON.stringify(reachabilityDraft),
        },
        token,
      );
      setSyncMsg({
        ok: true,
        text: "Network della Reperibilità aggiornato. I collegamenti vengono ora usati nei segnali pubblici e nelle analisi.",
      });
      await loadData();
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    }
    setSavingReachability(false);
  }

  async function generateAiContentIdeas() {
    setGeneratingIdeas(true);
    setSyncMsg({
      ok: true,
      loading: true,
      text: "L'AI sta leggendo profilo, contenuti, ricerche e temi attuali…",
    });
    try {
      const result = await apiFetch(
        "/api/index.php?action=generate-content-ideas",
        {
          method: "POST",
          body: JSON.stringify({ count: 3, brief: editorialBrief }),
        },
        token,
      );
      setAiContentIdeas(Array.isArray(result.ideas) ? result.ideas : []);
      setIdeasGeneratedAt(result.generated_at || new Date().toISOString());
      setIdeasNewsSignals(Number(result.news_signals || 0));
      if (result.profile_review) knowledge.acceptReview(result.profile_review);
      const generationMessage =
        result.generation_source === "profile_fallback"
          ? "3 proposte pronte dal tuo profilo editoriale. Il servizio AI non era disponibile, ma il lavoro non si è bloccato."
          : result.generation_source === "ai_completed"
            ? "3 proposte pronte. La risposta AI era parziale ed è stata completata automaticamente dal tuo profilo."
            : "3 nuove proposte create dall'AI. Scegline una per l'articolo o per un social.";
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
    setSyncMsg({
      ok: true,
      loading: true,
      text: `Preparo una versione specifica per ${SOCIAL[platform]?.label || platform}…`,
    });
    try {
      const result = await apiFetch(
        "/api/index.php?action=generate-social-content",
        {
          method: "POST",
          body: JSON.stringify({ idea, platform }),
        },
        token,
      );
      setSocialComposer({
        idea,
        ...(result.content || {}),
        publishNote: result.publish_note || "",
      });
      setSyncMsg({
        ok: true,
        text: "Post social generato. Controllalo e poi scegli Condividi.",
      });
    } catch (error) {
      setSyncMsg({ ok: false, text: error.message });
    } finally {
      setGeneratingSocial(false);
    }
  }

  function socialShareText() {
    if (!socialComposer) return "";
    const hashtags = (socialComposer.hashtags || [])
      .map((tag) => `#${String(tag).replace(/^#/, "").replace(/\s+/g, "")}`)
      .join(" ");
    return [socialComposer.caption || "", hashtags]
      .filter(Boolean)
      .join("\n\n");
  }

  async function shareSocialContent() {
    const text = socialShareText();
    if (!text) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title:
            socialComposer.headline ||
            socialComposer.idea?.title ||
            "Nuovo contenuto",
          text,
        });
        setSyncMsg({
          ok: true,
          text: "Contenuto inviato al menu di condivisione. Conferma nell'app social.",
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(text);
    const destinations = {
      instagram: "https://www.instagram.com/",
      facebook: "https://www.facebook.com/",
      tiktok: "https://www.tiktok.com/upload",
      linkedin: "https://www.linkedin.com/feed/",
    };
    window.open(
      destinations[socialPlatform] || destinations.instagram,
      "_blank",
      "noopener",
    );
    setSyncMsg({
      ok: true,
      text: "Testo copiato. Incollalo nel social appena aperto e conferma la pubblicazione.",
    });
  }

  async function createIdeaDraft(idea, index, mode = "ai") {
    if (!String(idea?.title || "").trim()) {
      setSyncMsg({ ok: false, text: "Serve un titolo per creare la bozza." });
      return;
    }
    setPreparingIdea(index);
    setSyncMsg({
      ok: true,
      loading: true,
      text:
        mode === "manual"
          ? "Preparo la traccia da compilare…"
          : "Creo la bozza e avvio la scrittura AI…",
    });
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      mode === "ai" ? 120000 : 25000,
    );
    try {
      const result = await apiFetch(
        "/api/index.php?action=create-idea-draft",
        {
          method: "POST",
          body: JSON.stringify({ ...idea, mode, length: articleLength }),
          signal: controller.signal,
        },
        token,
      );
      const [freshData] = await Promise.all([loadData(), loadDrafts()]);
      if (
        result?.draft &&
        !(freshData?.posts || []).some(
          (post) => Number(post.id) === Number(result.draft.id),
        )
      ) {
        setData((previous) => ({
          ...(previous || {}),
          posts: [
            {
              ...result.draft,
              platform: result.draft.platform || "editorial_idea",
              published: 0,
              tags: Array.isArray(result.draft.tags) ? result.draft.tags : [],
            },
            ...(previous?.posts || []).filter(
              (post) => Number(post.id) !== Number(result.draft.id),
            ),
          ],
        }));
      }
      setDashboardFilter("published-0");
      setTab("site");
      if (result?.draft) {
        setEditingPost({
          ...result.draft,
          tags: Array.isArray(result.draft.tags)
            ? result.draft.tags.join(", ")
            : String(result.draft.tags || ""),
          mediaUrl: "",
          mediaType: "",
          mediaWidth: 100,
          mediaAlignment: "center",
          noindex: 0,
          imagePixelWidth: 1200,
        });
      }
      setEditingIdea(null);
      setCustomIdeaOpen(false);
      setCustomIdea({ title: "", reason: "" });
      setSyncMsg(
        result?.ai_status === "failed"
          ? {
              ok: false,
              text:
                result.ai_error ||
                "La scrittura AI non è riuscita. La traccia resta salvata tra le bozze.",
            }
          : {
              ok: true,
              text:
                mode === "manual"
                  ? "Traccia creata e aperta nell’editor. Scrivi pure: nessun testo è stato generato."
                  : "Articolo scritto dall’AI e aperto nell’editor. Rivedilo prima di pubblicare.",
            },
      );
    } catch (error) {
      const isMonthlyLimit = /articoli.*piano Base/i.test(error.message || "");
      setSyncMsg({
        ok: isMonthlyLimit,
        text:
          error.name === "AbortError"
            ? "La richiesta ha impiegato troppo tempo. Riprova: il pulsante è stato sbloccato."
            : error.message,
      });
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
    setDismissedIdeaKeys((current) => [...new Set([...current, key])]);
    setEditingIdea(null);
    try {
      const result = await apiFetch(
        "/api/index.php?action=dismiss-content-idea",
        {
          method: "POST",
          body: JSON.stringify({ key }),
        },
        token,
      );
      if (Array.isArray(result?.dismissed_content_ideas))
        setDismissedIdeaKeys(result.dismissed_content_ideas);
      setSyncMsg({ ok: true, text: "Proposta eliminata." });
    } catch (error) {
      setDismissedIdeaKeys(previous);
      setSyncMsg({ ok: false, text: error.message });
    } finally {
      setDismissingIdeaKey("");
    }
  }

  async function refreshUnderstanding() {
    setSavingProfile(true);
    try {
      const res = await apiFetch(
        "/api/index.php?action=refresh-understanding",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
        token,
      );
      setUnderstandingReport(res.understanding || null);
      setUnderstandingDraft(res.understanding || null);
      await loadData();
      setSyncMsg({
        ok: true,
        text: "Proposta AI aggiornata senza modificare la strategia dichiarata da te.",
      });
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message });
    }
    setSavingProfile(false);
  }

  const [seoPreview, setSeoPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  async function generateSeoPreview() {
    setLoadingPreview(true);
    setSyncMsg(null);
    try {
      const res = await apiFetch(
        "/api/index.php?action=preview-seo-foundation",
        { method: "POST", body: JSON.stringify({}) },
        token,
      );
      setSeoPreview(res.seo_foundation);
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message });
    }
    setLoadingPreview(false);
  }

  async function saveSeoFoundation() {
    setSavingProfile(true);
    setSyncMsg(null);
    try {
      await apiFetch(
        "/api/index.php?action=save-seo-foundation",
        {
          method: "POST",
          body: JSON.stringify({ seo_foundation: seoPreview }),
        },
        token,
      );
      await loadData();
      setSeoPreview(null);
      setSyncMsg({
        ok: true,
        text: "Pagine SEO fondamentali salvate con successo.",
      });
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message });
    }
    setSavingProfile(false);
  }

  // Interruttore "Fatti trovare da Google" per l'intero sito.
  async function saveUserAgentPrompt() {
    setSavingUserAgentPrompt(true);
    try {
      await apiFetch(
        "/api/index.php?action=site-update",
        {
          method: "POST",
          body: JSON.stringify({ user_agent_prompt: userAgentPromptDraft }),
        },
        token,
      );
      await loadData();
      setSyncMsg({ ok: true, text: "Istruzioni Agente Editoriale salvate." });
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message });
    }
    setSavingUserAgentPrompt(false);
  }

  async function toggleSearchVisible(nextValue) {
    setSavingSearchVisible(true);
    // Aggiornamento ottimistico: l'interruttore deve rispondere subito.
    setData((prev) =>
      prev
        ? { ...prev, site: { ...prev.site, search_visible: nextValue ? 1 : 0 } }
        : prev,
    );
    try {
      await apiFetch(
        "/api/index.php?action=site-update",
        {
          method: "POST",
          body: JSON.stringify({ search_visible: nextValue ? 1 : 0 }),
        },
        token,
      );
      setSyncMsg({
        ok: true,
        text: nextValue
          ? "Il sito è ora aperto ai motori di ricerca. Google può impiegare qualche giorno a rilevarlo."
          : "Il sito è nascosto ai motori di ricerca. Resta raggiungibile da chi ha il link.",
      });
    } catch (err) {
      // Ripristina lo stato precedente: l'interruttore non deve mentire.
      setData((prev) =>
        prev
          ? {
              ...prev,
              site: { ...prev.site, search_visible: nextValue ? 0 : 1 },
            }
          : prev,
      );
      setSyncMsg({
        ok: false,
        text: err.message || "Non è stato possibile aggiornare la visibilità.",
      });
    }
    setSavingSearchVisible(false);
  }

  async function removeSource(id) {
    await apiFetch(
      "/api/index.php?action=social-source-delete",
      {
        method: "POST",
        body: JSON.stringify({ id }),
      },
      token,
    );
    await loadData();
  }

  // --- Funzioni Layout Proposti ---
  const [designingSite, setDesigningSite] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState(null);
  const [previewThemeId, setPreviewThemeId] = useState("classic");
  const [generatingSite, setGeneratingSite] = useState(false);
  const [referenceUrlDraft, setReferenceUrlDraft] = useState("");
  const [generationStep, setGenerationStep] = useState(0);
  const GENERATION_STEPS = [
    "Sto leggendo i tuoi contenuti social...",
    "Sto capendo il tuo stile...",
    "Sto scegliendo colori e font leggibili...",
    "Sto scrivendo titolo e presentazione...",
    "Sto sistemando gli ultimi dettagli...",
  ];

  async function generateSiteWithAi() {
    setGeneratingSite(true);
    setGenerationStep(0);
    const stepTimer = setInterval(() => {
      setGenerationStep((prev) => (prev + 1) % GENERATION_STEPS.length);
    }, 2200);
    try {
      await apiFetch(
        "/api/index.php?action=site-ai",
        {
          method: "POST",
          body: JSON.stringify({ reference_url: referenceUrlDraft.trim() }),
        },
        token,
      );
      await loadData();
      setSyncMsg({
        ok: true,
        text: "Il tuo sito è stato generato dall'AI. Guardalo qui sotto o aprilo dal link in alto.",
      });
    } catch (err) {
      setSyncMsg({
        ok: false,
        text: err.message || "Non sono riuscita a generare il sito.",
      });
    }
    clearInterval(stepTimer);
    setGeneratingSite(false);
  }

  // --- Agente di comprensione profilo (ProfileAnalyzer) ---
  // Capisce se le informazioni raccolte dai social rappresentano davvero
  // l'utente, con una confidenza esplicita, e fa domande concrete quando
  // qualcosa è ambiguo o manca — invece di indovinare in silenzio.
  const [profileUnderstanding, setProfileUnderstanding] = useState(null);
  const [profileQuestions, setProfileQuestions] = useState([]);
  const [profileAnalyzing, setProfileAnalyzing] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [answeringId, setAnsweringId] = useState(null);

  async function loadProfileUnderstanding() {
    try {
      const res = await apiFetch(
        "/api/index.php?action=profile-understanding",
        {},
        token,
      );
      setProfileUnderstanding(res.profile || null);
      setProfileQuestions(res.questions || []);
    } catch (err) {
      /* silenzioso: pannello facoltativo */
    }
    setProfileLoaded(true);
  }

  async function analyzeProfile() {
    setProfileAnalyzing(true);
    try {
      const res = await apiFetch(
        "/api/index.php?action=profile-analyze",
        { method: "POST" },
        token,
      );
      setProfileUnderstanding(res.profile || null);
      setProfileQuestions(res.questions || []);
    } catch (err) {
      setSyncMsg({
        ok: false,
        text: err.message || "Analisi profilo non riuscita.",
      });
    }
    setProfileAnalyzing(false);
  }

  async function submitProfileAnswer(questionId) {
    const answer = (answerDrafts[questionId] || "").trim();
    if (!answer) return;
    setAnsweringId(questionId);
    try {
      const res = await apiFetch(
        "/api/index.php?action=profile-answer",
        {
          method: "POST",
          body: JSON.stringify({ question_id: questionId, answer }),
        },
        token,
      );
      setProfileUnderstanding(res.profile || null);
      setProfileQuestions(res.questions || []);
      setAnswerDrafts((prev) => { const next = { ...prev }; delete next[questionId]; return next; });
    } catch (err) {
      setSyncMsg({
        ok: false,
        text: err.message || "Non sono riuscita a salvare la risposta.",
      });
    }
    setAnsweringId(null);
  }

  function renderEditorialAgentPanel() {
    return (
      <section
        className="card"
        style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <span className="section-eyebrow">Il tuo Agente Editoriale</span>
            <h2 style={{ margin: "0.35rem 0 0.5rem" }}>
              🤖 Istruzioni per l'AI
            </h2>
            <p
              style={{
                margin: 0,
                color: "var(--text-muted)",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Questa è la sintesi strategica che guida l'agente editoriale. Può
              essere generata in base al tuo profilo o modificata a mano per
              perfezionarla.
            </p>
          </div>
          <button
            className="btn btn-outline"
            onClick={() => setShowInterview(true)}
          >
            Rivedi l'intervista
          </button>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <textarea
            className="form-control"
            rows={12}
            value={userAgentPromptDraft || ""}
            onChange={(e) => setUserAgentPromptDraft(e.target.value)}
            placeholder="Es. Scrivi con un tono professionale, chiaro e accogliente..."
            style={{ width: "100%", resize: "vertical" }}
          />
          <button
            className="btn btn-primary"
            style={{ justifySelf: "start" }}
            onClick={saveUserAgentPrompt}
            disabled={
              savingUserAgentPrompt ||
              userAgentPromptDraft === data?.site?.user_agent_prompt
            }
          >
            {savingUserAgentPrompt ? "⟳ Salvataggio..." : "Salva Istruzioni"}
          </button>
        </div>
      </section>
    );
  }

  function renderAiGenerateCard() {
    // Basta avere il profilo compilato O dei social collegati per poter generare
    const hasContent = posts.length > 0 || (site?.profile_summary?.trim().length > 0) || (sources?.length > 0);
    return (
      <section className="card ai-site-card">
        <div>
          <span className="section-eyebrow">Fatto per te dall'AI</span>
          <h2>✨ Genera il mio sito con l'AI</h2>
          <p
            style={{
              margin: 0,
              color: "var(--text-muted)",
              fontSize: "14px",
              lineHeight: 1.6,
            }}
          >
            {hasContent
              ? "Crea una proposta grafica dal profilo, dalle istruzioni editoriali, dalla presenza e dai tuoi articoli. Modificala nel builder prima di pubblicare."
              : "Appena avrai collegato un social e ci saranno dei contenuti, l'AI potrà scrivere titolo, presentazione e stile del tuo sito da sola."}
          </p>
          <button
            type="button"
            className="ai-site-profile-link"
            onClick={() => {
              setTab("profile");
              setProfileSubTab("who");
            }}
          >
            Vedi e modifica il profilo che l'AI usa per generare il sito →
          </button>
        </div>
        <div>
          <button
            className="btn btn-primary"
            onClick={() => window.location.assign("/builder/create")}
            disabled={!hasContent || generatingSite}
          >
            {generatingSite
              ? `⟳ ${GENERATION_STEPS[generationStep]}`
              : hasContent
                ? "✨ Genera il mio sito"
                : "✨ Genera il mio sito (collega prima un social)"}
          </button>
          {generatingSite && (
            <>
              <style>{`
                @keyframes stsGenPulse { 0% { transform: translateX(-40%); } 100% { transform: translateX(140%); } }
                .sts-gen-progress { position: relative; overflow: hidden; height: 4px; border-radius: 999px; background: var(--gray-light); margin-top: 10px; }
                .sts-gen-progress-bar { position: absolute; top: 0; left: 0; width: 40%; height: 100%; border-radius: 999px; background: var(--primary); animation: stsGenPulse 1.1s ease-in-out infinite; }
              `}</style>
              <div className="sts-gen-progress">
                <div className="sts-gen-progress-bar" />
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  async function saveEditorialEngineSettings() {
    setEditorialEngineBusy(true);
    setEditorialEngineMsg(null);
    try {
      const res = await apiFetch(
        "/api/index.php?action=admin-editorial-engine-save",
        {
          method: "POST",
          body: JSON.stringify(editorialEngine.settings),
        },
        token,
      );
      setEditorialEngine((prev) => ({
        ...prev,
        settings: res.settings || prev.settings,
      }));
      setEditorialEngineMsg({
        ok: true,
        text: "Impostazioni motore editoriale salvate.",
      });
      await loadData();
    } catch (err) {
      setEditorialEngineMsg({ ok: false, text: err.message });
    }
    setEditorialEngineBusy(false);
  }

  async function runEditorialEngine() {
    setEditorialEngineBusy(true);
    setEditorialEngineMsg({
      ok: true,
      text: "Analisi editoriale in corso...",
      loading: true,
    });
    try {
      const res = await apiFetch(
        "/api/index.php?action=admin-editorial-engine-run",
        {
          method: "POST",
        },
        token,
      );
      if (res?.result) {
        setEditorialEngine((prev) => ({
          ...prev,
          dna: res.result.editorial_dna || prev.dna,
          memory: res.result.editorial_memory || prev.memory,
          state: res.result.editorial_state || prev.state,
          settings: res.result.settings || prev.settings,
          last_run: new Date().toISOString(),
        }));
      }
      setEditorialEngineMsg({
        ok: true,
        text: "Motore editoriale aggiornato con successo.",
      });
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
      const res = await apiFetch(
        "/api/index.php?action=admin-prompts",
        {},
        token,
      );
      setAdminPrompts(res.prompts || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function updatePrompt(agentName, instructions) {
    try {
      const result = await apiFetch(
        "/api/index.php?action=admin-update-prompt",
        {
          method: "POST",
          body: JSON.stringify({ agent_name: agentName, instructions }),
        },
        token,
      );
      setAdminPrompts((prev) => {
        const current = prev.find((p) => p.agent_name === agentName);
        if (current)
          return prev.map((p) =>
            p.agent_name === agentName ? { ...p, instructions } : p,
          );
        return [
          ...prev,
          {
            id: result?.id || 0,
            agent_name: agentName,
            instructions,
            version_count: 0,
          },
        ];
      });
      return result;
    } catch (err) {
      throw err;
    }
  }

  async function savePromptDraft(agentName) {
    const nextInstructions = promptDrafts[agentName];
    if (!nextInstructions?.trim()) return;
    setSavingPromptName(agentName);
    try {
      await updatePrompt(agentName, nextInstructions);
      alert("Istruzioni aggiornate con successo!");
    } catch (err) {
      alert("Errore: " + err.message);
    } finally {
      setSavingPromptName("");
    }
  }

  function renderPromptEditor(agentName) {
    const prompt = adminPrompts.find((item) => item.agent_name === agentName);
    if (!prompt) return null;
    const meta = EDITORIAL_AGENT_META[agentName] || {};
    const currentDraft = promptDrafts[agentName] ?? prompt.instructions ?? "";

    return (
      <div
        key={agentName}
        className="card"
        style={{ padding: "1rem", display: "grid", gap: "0.75rem" }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "0.35rem",
            }}
          >
            <span style={{ fontSize: "18px" }}>{meta.icon || "🤖"}</span>
            <strong style={{ color: "var(--text)" }}>
              {prompt.label || meta.title || agentName}
            </strong>
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            {prompt.description || meta.role || "Prompt operativo dell’agente."}
          </div>
        </div>
        <textarea
          value={currentDraft}
          onChange={(e) =>
            setPromptDrafts((prev) => ({
              ...prev,
              [agentName]: e.target.value,
            }))
          }
          style={{
            width: "100%",
            minHeight: "220px",
            padding: "12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-strong)",
            background: "var(--bg)",
            color: "var(--text)",
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: 1.55,
            resize: "vertical",
          }}
        />
        <button
          className="btn btn-outline"
          onClick={() => savePromptDraft(agentName)}
          disabled={savingPromptName === agentName}
          style={{
            justifySelf: "start",
            padding: "10px 16px",
            fontWeight: 700,
          }}
        >
          {savingPromptName === agentName ? "Salvataggio..." : "Salva prompt"}
        </button>
      </div>
    );
  }

  useEffect(() => {
    if (!user?.role || user.role !== "admin") return;
    if ((tab === "admin" || tab === "general") && adminPrompts.length === 0)
      loadAdminPrompts();
  }, [tab, user, adminPrompts.length]);

  useEffect(() => {
    if ((tab === "strategy" || tab === "profile") && !profileLoaded)
      loadProfileUnderstanding();
  }, [tab, profileLoaded]);

  useEffect(() => {
    if (!adminPrompts.length) return;
    setPromptDrafts((prev) => {
      const next = { ...prev };
      for (const prompt of adminPrompts) {
        if (!(prompt.agent_name in next))
          next[prompt.agent_name] = prompt.instructions || "";
      }
      return next;
    });
  }, [adminPrompts]);

  async function regenerateMenuAi() {
    setRegeneratingMenu(true);
    try {
      await apiFetch(
        "/api/index.php?action=chief-editor",
        { method: "POST" },
        token,
      );
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
  const [cmsFilter, setCmsFilter] = useState("all");

  function openPostEditor(post) {
    setEditingPost({
      id: post.id,
      title: post.edited_title || post.generated_title || "",
      body: post.edited_body || post.generated_body || "",
      rawContent: post.raw_content || "",
      excerpt: post.edited_excerpt || post.generated_excerpt || "",
      tags: (post.tags || []).join(", "),
      mediaUrl: post.media_url || "",
      mediaType: post.media_type || "",
      mediaWidth: Number(post.media_display_width || 100),
      mediaAlignment: post.media_alignment || "center",
      noindex: Number(post.noindex || 0),
      imagePixelWidth: 1200,
    });
  }

  async function uploadPostImage(file) {
    if (!editingPost || !file) return;
    if (!file.type.startsWith("image/")) {
      alert("Seleziona un file immagine JPG, PNG o WebP.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      alert("L’immagine originale deve pesare meno di 12 MB.");
      return;
    }
    setPostImageUploading(true);
    try {
      const originalData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = originalData;
      });
      const target = Number(editingPost.imagePixelWidth || 1200);
      const scale = target > 0 ? Math.min(1, target / image.width) : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(outputType, 0.88);
      const result = await apiFetch(
        "/api/index.php?action=post-media-upload",
        {
          method: "POST",
          body: JSON.stringify({ post_id: editingPost.id, data_url: dataUrl }),
        },
        token,
      );
      setEditingPost((current) =>
        current
          ? {
              ...current,
              mediaUrl: result.media_url,
              mediaType: result.media_type,
            }
          : current,
      );
    } catch (err) {
      alert(err.message || "Impossibile caricare l’immagine.");
    } finally {
      setPostImageUploading(false);
    }
  }

  async function savePostEdit() {
    if (!editingPost) return;
    setCmsSaving(true);
    try {
      await apiFetch(
        "/api/index.php?action=post-update",
        {
          method: "POST",
          body: JSON.stringify({
            id: editingPost.id,
            edited_title: editingPost.title,
            edited_body: editingPost.body,
            raw_content: editingPost.rawContent,
            edited_excerpt: editingPost.excerpt,
            tags: editingPost.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            media_url: editingPost.mediaUrl,
            media_type: editingPost.mediaType,
            media_display_width: editingPost.mediaWidth,
            media_alignment: editingPost.mediaAlignment,
            noindex: editingPost.noindex,
          }),
        },
        token,
      );
      setEditingPost(null);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
    setCmsSaving(false);
  }

  async function regenerateEditedPost() {
    if (!editingPost) return;
    if (
      !window.confirm(
        "Rigenerare titolo, testo e riassunto con l’orchestratore AI? Le modifiche manuali attuali verranno sostituite.",
      )
    )
      return;
    const postId = editingPost.id;
    setCmsSaving(true);
    setAcquisitionModal({
      status: "working",
      title: "Orchestrazione editoriale in corso",
      text: "Recupero il contenuto del post, l’eventuale pagina collegata e il profilo editoriale prima di riscrivere l’articolo.",
    });
    try {
      await apiFetch(
        "/api/index.php?action=harmonize",
        {
          method: "POST",
          body: JSON.stringify({
            id: postId,
            replace_edits: true,
            length: "standard",
          }),
        },
        token,
      );
      setEditingPost(null);
      await loadDrafts();
      await loadData();
      setAcquisitionModal({
        status: "success",
        title: "Articolo rigenerato",
        text: "L’orchestratore ha unito contenuto social, pagina collegata e profilazione editoriale mantenendo invariato lo stato di pubblicazione.",
      });
    } catch (err) {
      setAcquisitionModal({
        status: "error",
        title: "Rigenerazione non riuscita",
        text: err.message,
      });
    } finally {
      setCmsSaving(false);
    }
  }

  async function toggleFeatured(postId, currentFeatured) {
    await apiFetch(
      "/api/index.php?action=post-feature",
      {
        method: "POST",
        body: JSON.stringify({ id: postId, featured: currentFeatured ? 0 : 1 }),
      },
      token,
    );
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
      setAddMsg({ ok: false, text: "Inserisci un URL pubblico supportato." });
      return;
    }
    setAddLoading(true);
    try {
      await apiFetch(
        "/api/index.php?action=social-source-upsert",
        {
          method: "POST",
          body: JSON.stringify({
            platform,
            label: addLabel || SOCIAL[platform]?.label || "Fonte",
            url,
          }),
        },
        token,
      );
      setAddMsg({
        ok: true,
        text: "Fonte aggiunta. Clicca “Sincronizza tutti” per importare i contenuti.",
      });
      setAddUrl("");
      setAddLabel("");
      await loadData();
    } catch (err) {
      setAddMsg({ ok: false, text: err.message });
    }
    setAddLoading(false);
  }

  async function removeChannel(channel) {
    if (
      !window.confirm(
        `Rimuovere il canale "${channel.label || channel.platform}"?`,
      )
    )
      return;
    await apiFetch(
      "/api/index.php?action=social-source-delete",
      { method: "POST", body: JSON.stringify({ id: channel.sourceId }) },
      token,
    );
    await loadData();
  }

  const site = data?.site;
  const posts = data?.posts || [];
  const sources = data?.sources || [];
  const visibility = data?.visibility || {};
  const reachability = data?.reachability || {
    score: 0,
    stage: "configurazione",
    checks: [],
  };
  const activeChannelCount = sources.length;
  const visualAgentConfigured = Boolean(
    site?.site_ai_data || site?.generated_layouts || site?.design_archetype,
  );
  const visualDirection =
    templateStudio?.design_archetype ||
    site?.design_archetype ||
    site?.theme ||
    "Da definire";
  const readyPostCount = posts.filter(
    (post) => Number(post.seo_score) >= 0,
  ).length;

  useEffect(() => {
    if (!isBasePlan || !data || baseAutoSyncStarted.current) return;
    if (activeChannelCount > 0 && posts.length === 0) {
      baseAutoSyncStarted.current = true;
      acquireBaseContent(true);
    }
  }, [isBasePlan, data, activeChannelCount, posts.length]);
  let seoFoundation = {};
  try {
    seoFoundation =
      typeof site?.seo_foundation === "string"
        ? JSON.parse(site.seo_foundation)
        : site?.seo_foundation || {};
  } catch (_) {
    seoFoundation = {};
  }
  const dismissedIdeaKeySet = new Set(dismissedIdeaKeys);
  const contentIdeas = (
    aiContentIdeas.length
      ? aiContentIdeas
      : buildEditorialIdeas(
          posts,
          understandingDraft || understandingReport,
          visibility,
        )
  ).filter((idea) => !dismissedIdeaKeySet.has(editorialIdeaKey(idea)));
  const strategyProgress = strategyCompletion(activeUnderstanding);
  const publishedPosts = posts.filter((post) => Number(post.published) === 1);
  const networkPublishedPages =
    (visibility.published_pages ?? publishedPosts.length + 1) +
    (seoFoundation.pages || []).length +
    (publishedPosts.length ? 1 : 0) +
    (sources.length ? 1 : 0);
  const navigationGroups =
    user?.role === "admin"
      ? [
          {
            label: "Amministrazione",
            items: [
              {
                id: "admin",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                ),
                label: "Utenti",
                hint: "Account e accessi",
              },
              ,
              {
                id: "idea",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.67 3.03 6.17a1 1 0 0 1 .37.78V17h7v-1.05a1 1 0 0 1 .37-.78C17.81 13.67 19 11.38 19 9a7 7 0 0 0-7-7z" />
                  </svg>
                ),
                label: "IDEA 💡",
                hint: "Genera contenuti con l'AI",
              },
            ],
          },
        ]
      : [
          {
            label: "Menu Principale",
            items: [
              {
                id: "profile",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                ),
                label: "Il mio profilo",
                hint: "Stile editoriale, presenza e contatti",
              },
              {
                id: "overview",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                ),
                label: "Home",
                hint: "Lo stato del tuo sito",
              },
              {
                id: "site",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                ),
                label: "Articoli",
                hint: "Bozze da pubblicare e già online",
              },
              {
                id: "sources",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect
                      x="2"
                      y="2"
                      width="20"
                      height="20"
                      rx="5"
                      y="5"
                    ></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                ),
                label: "Social collegati",
                hint: "Da qui arrivano i tuoi contenuti",
              },
              {
                id: "seo",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7"></circle>
                    <path d="m20 20-4-4"></path>
                    <path d="M8 11h6M11 8v6"></path>
                  </svg>
                ),
                label: "Monitoraggio e SEO",
                hint: "Come ti trovano online",
              },
              ,
              {
                id: "idea",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.67 3.03 6.17a1 1 0 0 1 .37.78V17h7v-1.05a1 1 0 0 1 .37-.78C17.81 13.67 19 11.38 19 9a7 7 0 0 0-7-7z" />
                  </svg>
                ),
                label: "IDEA 💡",
                hint: "Genera contenuti con l'AI",
              },
            ],
          },
        ];
  const existingNavigation = navigationGroups.flatMap(group => group.items).filter(Boolean);
  const navItem = id => existingNavigation.find(item => item.id === id);
  const visibleNavigationGroups = [
    { label: "Inizio", items: [{ id: "overview", icon: <span>⌂</span>, label: "Home", hint: "Stato del progetto e prossime azioni" }] },
    { label: "Profilo e contenuti", items: [navItem("profile") || { id: "profile", icon: <span>◎</span>, label: "Il mio profilo", hint: "Identità, stile editoriale e contatti" }, navItem("sources"), { ...navItem("site"), label: "Contenuti" }].filter(Boolean) },
    { label: "Sito pubblico", items: [{ id: "publicsite", icon: <span>▣</span>, label: "Sito pubblico", hint: "Editor, temi, assistenza LIA e versioni" },navItem("seo")].filter(Boolean) },
    { label: "Account", items: [
      { id: "services", icon: <span>◇</span>, label: "Piano e servizi", hint: "Funzionalità e abbonamento" },
    ] },
    ...(user?.role === "admin" ? [{ label: "Amministrazione", items: [navItem("admin"), { id: "general", icon: <span>⚙</span>, label: "Impostazioni di sistema", hint: "Agenti e automazioni" }].filter(Boolean) }] : []),
  ];
  const flatNavigation = visibleNavigationGroups.flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.label })),
  );
  const isNavigationActive = (item) =>
    tab === item.id && (!item.section || visibilitySection === item.section);
  const activeNavigation = flatNavigation.find(isNavigationActive) || ({ account: { group: "Account", label: "Il mio account" }, security: { group: "Account", label: "Password e sicurezza" } })[tab];
  const pageMeta = {
    publicsite: ["Sito pubblico", "Modifica, scegli il layout con LIA e conserva le versioni del tuo sito."],
    profile: ["Il mio profilo", "Identità, obiettivi e contatti guidano i contenuti e la creazione del sito."],
    idea: ["Idee e nuovi contenuti", "Crea contenuti coerenti con il tuo profilo e rivedili prima di pubblicare."],
    overview: [
      "Home",
      "Controlla cosa sta funzionando e scegli la prossima azione.",
    ],
    strategy: [
      "Profilo attività",
      "Definisci pubblico, obiettivi e priorità che guidano tutto il sistema.",
    ],
    site: [
      "Contenuti",
      "Rivedi le bozze, modifica i testi e decidi cosa pubblicare.",
    ],
    experience: [
      "Identità del sito",
      "Logo e contenuti personali dentro una struttura accessibile e coerente.",
    ],
    sources: [
      "Social collegati",
      "Aggiungi i tuoi profili social: i contenuti arriveranno automaticamente.",
    ],
    settings: [
      "Temi del sito",
      "Scegli un layout e guardalo in anteprima con i tuoi contenuti.",
    ],
    general: [
      "Impostazioni di sistema",
      "Configura agenti, automazioni e comportamento della piattaforma.",
    ],
    security: [
      "Password e sicurezza",
      "Proteggi il tuo account e gestisci le sessioni attive.",
    ],
    account: [
      "Il mio account",
      "Tutto ciò che configuri meno spesso, raccolto in un unico posto.",
    ],
    services: [
      "Piani e Upgrade",
      "Gestisci il tuo piano e le funzionalità automatiche.",
    ],
    admin: [
      "Utenti",
      "Gestisci account, accessi e configurazioni dei clienti.",
    ],
  };
  const seoMeta =
    visibilitySection === "ideas"
      ? [
          "Idee contenuti",
          "Scegli una proposta, adattala oppure trasformala direttamente in articolo.",
        ]
      : [
          "Visibilità",
          "Controlla come le pagine vengono trovate, collegate e comprese da Google.",
        ];
  const [pageTitle, pageSubtitle] =
    tab === "seo"
      ? seoMeta
      : pageMeta[tab] || ["Dashboard", "Gestisci il tuo spazio digitale."];
  const selectNavigation = (item) => {
    const destinations = { builder: "/builder/", themes: "/builder/themes", generate: "/builder/create" };
    if (destinations[item.id]) { window.location.assign(destinations[item.id]); return; }
    if (item.id === "identity") { openSiteIdentity(); return; }
    setTab(item.id);
    if (item.section) setVisibilitySection(item.section);
    setMobileMenuOpen(false);
  };
  const openSiteIdentity = () => {
    setTab("profile");
    setProfileSubTab("identity");
    setMobileMenuOpen(false);
    window.setTimeout(
      () =>
        document
          .getElementById("visual-identity")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  };
  const renderSiteCommandPanel = (compact) => {
    if (user?.role === "admin") return null;
    return (
      <section
        className={`site-command-panel ${compact ? "is-mobile" : ""}`}
        aria-label="Comandi del sito"
      >
        <span className="site-command-kicker">Il tuo sito</span>
        {sidebarTitleEditing ? (
          <form onSubmit={saveSiteTitle}>
            <input
              autoFocus
              value={siteTitleDraft}
              maxLength={120}
              required
              onChange={(event) => setSiteTitleDraft(event.target.value)}
              aria-label="Nome del sito"
            />
            <div>
              <button
                type="button"
                onClick={() => {
                  setSiteTitleDraft(site?.title || "");
                  setSidebarTitleEditing(false);
                }}
              >
                Annulla
              </button>
              <button type="submit" disabled={savingSiteTitle}>
                {savingSiteTitle ? "Salvo…" : "Salva"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <strong title={site?.title || siteTitleDraft}>
              {site?.title || siteTitleDraft || "Sito senza nome"}
            </strong>
            <div className="site-command-actions">
              <a href={siteUrl} target="_blank" rel="noopener">
                Apri sito ↗
              </a>
              <button onClick={() => setSidebarTitleEditing(true)}>
                Modifica nome
              </button>
            </div>
          </>
        )}
        <button className="site-command-identity" onClick={openSiteIdentity}>
          Immagine e aspetto del sito →
        </button>
      </section>
    );
  };
  const renderAccountProfile = () => (
    <div className="card" style={{ maxWidth: "600px", margin: "2rem auto" }}>
      <h2 style={{ marginBottom: "1.5rem", fontSize: "24px" }}>
        Il tuo account
      </h2>
      <div style={{ display: "grid", gap: "1rem" }}>
        <div
          style={{
            background: "var(--surface)",
            padding: "1rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <strong
            style={{
              display: "block",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            La tua email
          </strong>
          <span style={{ fontSize: "16px" }}>{user?.email}</span>
        </div>
        <div
          style={{
            background: "var(--surface)",
            padding: "1rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <strong
            style={{
              display: "block",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            Ruolo
          </strong>
          <span style={{ fontSize: "16px" }}>
            {user?.role === "admin" ? "Amministratore" : "Utente standard"}
          </span>
        </div>
        <div
          style={{
            background: "var(--surface)",
            padding: "1rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <strong
            style={{
              display: "block",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            Piano abbonamento
          </strong>
          <span style={{ fontSize: "16px", textTransform: "capitalize" }}>
            {user?.plan || "Base"}
          </span>
        </div>
      </div>
    </div>
  );
  const renderVisibilityServices = () => (
    <div className="services-page">
      <section className="services-intro">
        <div>
          <span>Piani e Upgrade</span>
          <h2>Gestisci le automazioni del tuo spazio digitale</h2>
          <p>
            Le funzionalità di acquisizione social, ottimizzazione AI e gestione
            clienti sono regolate dal tuo piano annuale.
          </p>
        </div>
        <div className="services-badge">Zero intervento umano</div>
      </section>
      <div className="services-grid">
        {typeof PLATFORM_PLANS !== "undefined" &&
          PLATFORM_PLANS.map((module) => (
            <article
              key={module.name}
              className={`service-card ${module.featured ? "is-featured" : ""}`}
            >
              {module.featured && (
                <span className="service-featured">Consigliato</span>
              )}
              <h3>{module.name}</h3>
              <strong>{module.price}</strong>
              <p>{module.description}</p>
              <div>
                {module.deliverables.map((item) => (
                  <span key={item}>✓ {item}</span>
                ))}
              </div>
              <a
                href={`mailto:support@ideesitiweb.it?subject=${encodeURIComponent(`Richiesta passaggio al piano ${module.name} - ${user?.slug || ""}`)}`}
                className={`btn ${module.featured ? "btn-primary" : "btn-outline"}`}
              >
                Richiedi Upgrade
              </a>
            </article>
          ))}
      </div>
      <p className="services-note">
        Tutti i piani si intendono con fatturazione annuale. Non sono previsti
        costi nascosti o orari per gli interventi manuali: l'intero processo è
        automatizzato.
      </p>
    </div>
  );

  return (
    <div
      className="dashboard-shell"
    >
      {acquisitionModal && (
        <div
          className="acquisition-overlay"
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          aria-labelledby="acquisition-title"
        >
          <div className={`acquisition-modal is-${acquisitionModal.status}`}>
            <div className="acquisition-visual" aria-hidden="true">
              {acquisitionModal.status === "working" ? (
                <span className="acquisition-spinner" />
              ) : acquisitionModal.status === "success" ? (
                "✓"
              ) : (
                "!"
              )}
            </div>
            <span className="acquisition-kicker">
              {acquisitionModal.status === "working"
                ? "Importazione in corso"
                : acquisitionModal.status === "success"
                  ? "Operazione completata"
                  : "Serve attenzione"}
            </span>
            <h2 id="acquisition-title">{acquisitionModal.title}</h2>
            <p>{acquisitionModal.text}</p>
            {acquisitionModal.total > 0 && (
              <div className="acquisition-progress">
                <div>
                  <span
                    style={{
                      width: `${Math.round(((acquisitionModal.completed || 0) / acquisitionModal.total) * 100)}%`,
                    }}
                  />
                </div>
                <small>
                  {acquisitionModal.completed || 0} di {acquisitionModal.total}{" "}
                  contenuti elaborati
                </small>
              </div>
            )}
            {Array.isArray(acquisitionModal.debug) &&
              acquisitionModal.debug.length > 0 && (
                <details
                  className="acquisition-debug"
                  open={acquisitionModal.status === "error"}
                >
                  <summary>
                    Dettagli debug ({acquisitionModal.debug.length})
                  </summary>
                  <div>
                    {acquisitionModal.debug.map((line, index) => (
                      <code key={`${index}-${line}`}>{line}</code>
                    ))}
                  </div>
                </details>
              )}
            {acquisitionModal.status === "working" ? (
              <div className="acquisition-wait">
                Non chiudere questa pagina: continuiamo a lavorare sui tuoi
                contenuti.
              </div>
            ) : (
              <div className="acquisition-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => setAcquisitionModal(null)}
                >
                  Chiudi
                </button>
                {acquisitionModal.status === "success" && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setAcquisitionModal(null);
                      setTab("site");
                    }}
                  >
                    Vai agli articoli
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <header
        className="backend-header"
        style={{
        }}
      >
        <div className="backend-header-brand">
          <BrandMark iconOnly />
          <strong>All Social To Web</strong>
          <LiaKnowledgeBadge knowledge={knowledge} onClick={() => { setTab('idea'); setVisibilitySection('ideas'); }} />
        </div>
        <div
          className="backend-header-actions"
          style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
        >
          <button className={`btn ${tab === "idea" ? "btn-primary" : "btn-outline"}`} aria-pressed={tab === "idea"} onClick={() => setTab("idea")} title="Crea idee e nuovi contenuti"><span aria-hidden="true">{navItem("idea")?.icon || "✧"}</span> IDEA</button>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
            aria-label="Apri il mio sito pubblico"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="header-site-label">Apri il mio sito</span>
          </a>

          <div style={{ position: "relative" }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountMenuOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { setAccountMenuOpen(false); event.currentTarget.querySelector("button")?.focus(); } }}>
            <button
              className="btn btn-outline btn-icon"
              aria-label="Menu account"
              aria-expanded={accountMenuOpen}
              aria-controls="account-menu"
              onClick={() => setAccountMenuOpen(open => !open)}
              style={{
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
            <div
              id="account-menu"
              style={{
                display: accountMenuOpen ? "block" : "none",
                position: "absolute",
                top: "100%",
                right: "0",
                marginTop: "0.5rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.5rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                minWidth: "230px",
                zIndex: 100,
              }}
            >
              <button
                className="btn btn-ghost"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 1rem",
                }}
                onClick={() => { selectNavigation({ id: "account" }); setAccountMenuOpen(false); }}
              >
                Il mio account
              </button>
              <button
                className="btn btn-ghost"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 1rem",
                }}
                onClick={() => { selectNavigation({ id: "security" }); setAccountMenuOpen(false); }}
              >
                Password e sicurezza
              </button>
              <div
                style={{
                  height: "1px",
                  background: "var(--border)",
                  margin: "0.5rem 0",
                }}
              ></div>
              <button
                className="btn btn-ghost"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 1rem",
                  color: "var(--red)",
                }}
                onClick={onLogout}
              >
                Esci
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav
        className="backend-tabs"
        style={{
        }}
      >
        {visibleNavigationGroups
          .flatMap((group) => group.items)
          .map((item) => (
            <button
              key={`${item.id}-${item.section || ""}`}
              className={`backend-tab ${isNavigationActive(item) ? "is-active" : ""}`}
              onClick={() => selectNavigation(item)}
            >
              <span className="tab-icon">{item.icon}</span>
              <span className="tab-label">{item.label}</span>
            </button>
          ))}
      </nav>

      <div
        className="dashboard-main"
      >
        <div
          className={`dashboard-content ${user?.role === "admin" ? "is-admin-wide" : ""}`}
        >
          <header className="dashboard-page-header">
            <div className="page-heading">
              <div className="page-kicker">
                {activeNavigation?.group || "Area di lavoro"}
              </div>
              <h1>{pageTitle}</h1>
              <p>{pageSubtitle}</p>
            </div>
            <div className="page-actions"></div>
          </header>
          {syncMsg && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "12px 16px",
                borderRadius: "var(--radius-sm)",
                fontSize: "14px",
                background: syncMsg.ok
                  ? syncMsg.loading
                    ? "var(--blue-light)"
                    : "var(--teal-light)"
                  : "var(--red-light)",
                color: syncMsg.ok
                  ? syncMsg.loading
                    ? "#1E40AF"
                    : "#0F6E56"
                  : "var(--red)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                {syncMsg.loading && (
                  <span style={{ display: "inline-block", marginRight: "8px" }}>
                    ⟳
                  </span>
                )}
                {syncMsg.text}
              </div>
              {!syncMsg.loading && (
                <button
                  onClick={() => setSyncMsg(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {tab === 'publicsite' && <section className="card profile-review-panel"><h2>Il tuo sito, le tue scelte</h2><p>LIA prepara proposte. Le modifiche grafiche si applicano dopo la tua autorizzazione; il sito online cambia quando pubblichi. Le versioni salvate permettono di tornare indietro.</p><div className="profile-review-fields">{[{href:'/builder/editor',icon:'✎',title:'Modifica sito',description:'Testi, immagini, sezioni e menu.'},{href:'/builder/themes',icon:'▦',title:'Temi e layout',description:'Guarda le anteprime o fatti aiutare da LIA a scegliere.'},{href:'/builder/create',icon:'✧',title:'Nuova proposta del sito',description:'Descrivi la tua idea e valuta una proposta prima di autorizzarla.'},{href:'/builder/versions',icon:'◷',title:'Versioni salvate',description:'Salva una versione, confrontala e ripristinala.'},{href:'/builder/profile',icon:'◎',title:'Aggiorna dal profilo',description:'Scegli quali dati pubblici trasferire alla bozza.'}].map(item=><a key={item.href} className="card" href={item.href} style={{textDecoration:'none',color:'inherit'}}><h3>{item.icon} {item.title}</h3><p>{item.description}</p></a>)}</div></section>}

          {/* Profile Sub-Navigation */}
          {tab === "profile" && (
            <div style={{ marginBottom: "2rem" }}>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  padding: "6px",
                  background: "var(--surface)",
                  borderRadius: "16px",
                  border: "1px solid var(--border)",
                  width: "fit-content",
                  flexWrap: "wrap",
                }}
              >
                {[
                  {
                    id: "who",
                    label: "✍️ Intervista con LIA",
                    desc: "Istruisci l'AI su come scrivere",
                  },
                  {id:"social", label:"◎ Analisi dei social", desc:"Ipotesi dell’AI e tue correzioni"},
                  {
                    id: "presence",
                    label: "🌐 Presenza e Contatti",
                    desc: "Sito ufficiale, territori e recapiti",
                  },
                  {id:"identity", label:"◈ Dati pubblici del sito", desc:"Nome, presentazione e immagini"},
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setProfileSubTab(opt.id);
                    }}
                    style={{
                      padding: "12px 20px",
                      border: "none",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontWeight: 800,
                      fontSize: "14px",
                      transition: "all .2s ease",
                      background:
                        profileSubTab === opt.id
                          ? "var(--primary)"
                          : "transparent",
                      color:
                        profileSubTab === opt.id ? "#fff" : "var(--text-muted)",
                      boxShadow:
                        profileSubTab === opt.id
                          ? "0 4px 12px rgba(37,99,235,.2)"
                          : "none",
                    }}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div
                style={{
                  marginTop: "1.5rem",
                  paddingBottom: "1.5rem",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "var(--text)",
                  }}
                >
                  {profileSubTab === "who"
                    ? "Intervista e risposte confermate"
                    : profileSubTab === "social" ? "Analisi dei contenuti social"
                    : profileSubTab === "identity"
                      ? "Come ti presenti sul sito"
                      : "Presenza e contatti"}
                </h2>
                <p
                  style={{
                    margin: "0.4rem 0 0",
                    color: "var(--text-muted)",
                    fontSize: "15px",
                  }}
                >
                  {profileSubTab === "who"
                    ? "Le tue risposte hanno priorità sulle ipotesi dell’AI. Sono modificabili e guidano contenuti e sito."
                    : profileSubTab === "social" ? "Distingui ciò che l’AI ha osservato da ciò che confermi o correggi."
                    : profileSubTab === "identity"
                      ? "Scrivi i testi pubblici, scegli nome e immagini. Poi rivedi la bozza nell’editor prima di pubblicare."
                      : "Definisci presenza ufficiale, attività, territori e recapiti. Queste informazioni alimentano anche la creazione del sito."}
                </p>
              </div>
            </div>
          )}
          {tab === 'profile' && <section className="profile-flow"><p><strong>Un profilo, un percorso:</strong> intervista → analisi dei social → dati pubblici → bozza → pubblicazione.</p><a className="btn btn-outline" href="/dashboard?tab=publicsite">Vai al Sito pubblico →</a></section>}
          {tab === 'profile' && profileReviewMessage && <p role={profileReviewMessage.ok?'status':'alert'}>{profileReviewMessage.text}</p>}
          {tab === 'profile' && profileSubTab === 'social' && <div className="profile-review-stack"><ProfileReviewPanel social value={{...(profileUnderstanding || {}),...socialProfileDraft}} onChange={(key,value)=>setSocialProfileDraft(prev=>({...prev,[key]:value}))} onSave={()=>saveProfileReview('social')} busy={profileReviewBusy} /><section className="card"><h3>Origine delle informazioni</h3><p>{sources.length} canali collegati · {posts.length} contenuti acquisiti. {profileUnderstanding?.generated_at ? `Ultima analisi: ${profileUnderstanding.generated_at}` : 'Nessuna analisi disponibile: collega i social e avvia l’analisi.'}</p><button className="btn btn-outline" onClick={analyzeProfile} disabled={profileAnalyzing}>{profileAnalyzing?'Analisi in corso…':'Aggiorna l’analisi dai contenuti'}</button> <button className="btn btn-outline" onClick={()=>setTab('sources')}>Gestisci i social collegati</button></section>{profileQuestions.length>0 && <details className="card"><summary>Domande e chiarimenti dell’AI</summary>{profileQuestions.map(question=><div key={question.id}><label><strong>{question.question}</strong><textarea rows={3} value={answerDrafts[question.id] ?? question.answer ?? ''} onChange={event=>setAnswerDrafts(prev=>({...prev,[question.id]:event.target.value}))} /></label><button className="btn btn-outline" disabled={answeringId===question.id} onClick={()=>submitProfileAnswer(question.id)}>Salva risposta</button></div>)}</details>}</div>}

          {tab === "overview" && (<section className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}><h2>Il tuo progetto, dall’identità al sito</h2><p style={{ margin: "0.75rem 0", lineHeight: 1.6 }}>Completa il profilo, collega i social e rivedi gli articoli. Poi scegli il layout, personalizza il sito e pubblica dall’editor.</p><div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}><button className="btn btn-outline" onClick={() => setTab("profile")}>Completa il profilo</button><a className="btn btn-primary" href="/builder/editor">Modifica sito</a><a className="btn btn-outline" href="/builder/themes">Scegli tema e layout</a><a className="btn btn-outline" href={siteUrl} target="_blank" rel="noopener">Vedi sito pubblico ↗</a></div></section>)}
          {tab === "idea" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
            >
              <div id="ideas" className="glass-modal ideas-panel">
                  <section className="ideas-quick-start">
                    <div>
                      <span className="section-eyebrow">Il tuo studio editoriale</span>
                      <h2>
                        Il prossimo contenuto parte da ciò che ti rende unico.
                      </h2>
                      <p>
                        L'AI incrocia attività, pubblico, contenuti esistenti,
                        ricerche Google e segnali di attualità pertinenti. Nulla
                        viene pubblicato senza conferma.
                      </p>
                    </div>
                    <div className="ideas-quick-actions">
                      <button
                        className="btn btn-primary"
                        onClick={generateAiContentIdeas}
                        disabled={generatingIdeas}
                      >
                        {generatingIdeas
                          ? "Cerco e genero…"
                          : "✦ Suggeriscimi 3 contenuti"}
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => setCustomIdeaOpen(true)}
                      >
                        + Crea da una mia idea
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          setDashboardFilter("published-0");
                          setTab("site");
                        }}
                      >
                        Vedi{" "}
                        {
                          posts.filter((post) => Number(post.published) === 0)
                            .length
                        }{" "}
                        bozze
                      </button>
                    </div>
                  </section>
                  <LiaKnowledge knowledge={knowledge} onProfile={() => { setTab('profile'); setProfileSubTab('who'); }} onSave={async updates => {
                    await apiFetch('/api/index.php?action=site-update', { method: 'POST', body: JSON.stringify({ site_understanding_corrections: { declared_strategy: updates } }) }, token);
                    setAiContentIdeas([]);
                    setIdeasGeneratedAt('');
                    await loadData();
                  }} />
                  <section className="editorial-brief" aria-labelledby="editorial-brief-title">
                    <h3 id="editorial-brief-title">Cosa prepariamo oggi?</h3>
                    <p>Il tema parte dalla profilazione. Aggiungi una priorità per questa sessione e LIA la userà per le prossime 3 proposte.</p>
                    <div className="editorial-brief-fields">
                      <label>Obiettivo<select value={editorialBrief.objective} onChange={event => setEditorialBrief({ ...editorialBrief, objective: event.target.value })}><option value="">Dal mio profilo</option><option>Far conoscere l’attività</option><option>Aiutare e informare il pubblico</option><option>Stimolare conversazioni</option><option>Generare contatti</option><option>Promuovere un prodotto o servizio</option></select></label>
                      <label>Canale<select value={editorialBrief.platform} onChange={event => setEditorialBrief({ ...editorialBrief, platform: event.target.value })}><option value="">Social e sito</option><option>Instagram</option><option>Facebook</option><option>LinkedIn</option><option>TikTok</option></select></label>
                      <label>Focus del momento<input value={editorialBrief.focus} maxLength={600} onChange={event => setEditorialBrief({ ...editorialBrief, focus: event.target.value })} placeholder="Un servizio, una domanda cliente, una novità…" /></label>
                    </div>
                    <p className="editorial-profile-context">Profilo di partenza: {declaredStrategy.activity_type || 'attività da chiarire'} · Pubblico: {declaredStrategy.primary_audience || 'da definire'} · Obiettivo: {declaredStrategy.primary_goal || 'da definire'}</p>
                    <button className="btn btn-primary" disabled={generatingIdeas} onClick={generateAiContentIdeas}>{generatingIdeas ? 'Preparo le proposte…' : 'Proponimi 3 contenuti per questo brief'}</button>
                  </section>
                  <div className="article-length-picker">
                    <div>
                      <strong>Lunghezza degli articoli AI</strong>
                      <span>
                        Compatto è il formato consigliato: più diretto e più
                        facile da leggere.
                      </span>
                    </div>
                    <div>
                      {[
                        ["brief", "Flash", "90–140 parole"],
                        ["compact", "Compatto", "180–280 parole"],
                        ["standard", "Standard", "320–450 parole"],
                        ["deep", "Approfondito", "550–750 parole"],
                        ["pillar", "Guida completa", "900–1.200 parole"],
                      ].map(([value, label, detail]) => (
                        <button
                          key={value}
                          className={articleLength === value ? "is-active" : ""}
                          onClick={() => setArticleLength(value)}
                        >
                          <strong>{label}</strong>
                          <small>{detail}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <header className="ideas-head">
                    <div>
                      <h3>Idee per il prossimo contenuto</h3>
                      <p>
                        Proposte costruite dai tuoi canali, dalle ricerche reali
                        su Google e dalle priorità che hai dichiarato. Per
                        ognuna puoi far scrivere l’AI, scrivere tu, o adattare
                        l’idea prima di partire. Niente viene pubblicato da
                        solo.
                      </p>
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={generateAiContentIdeas}
                      disabled={generatingIdeas}
                    >
                      {generatingIdeas ? "Generazione…" : "Genera altre 3 idee"}
                    </button>
                  </header>

                  {ideasGeneratedAt && (
                    <div className="ideas-research-status">
                      <strong>
                        AI aggiornata{" "}
                        {new Date(ideasGeneratedAt).toLocaleString("it-IT")}
                      </strong>
                      <span>
                        {ideasNewsSignals > 0
                          ? `${ideasNewsSignals} segnali recenti analizzati`
                          : "Profilo e dati interni analizzati · nessuna notizia pertinente forzata"}
                      </span>
                    </div>
                  )}

                  <ol className="ideas-list">
                    {contentIdeas.map((idea, index) => {
                      const inModifica = editingIdea?.index === index;
                      const occupato = preparingIdea !== -1;
                      const ideaKey = editorialIdeaKey(idea);
                      return (
                        <li
                          key={`${idea.title}-${index}`}
                          className={`idea-row ${inModifica ? "is-editing" : ""}`}
                        >
                          <div className="idea-rank">{index + 1}</div>
                          <div className="idea-main">
                            {inModifica ? (
                              <div className="idea-edit">
                                <label>
                                  <span>Titolo del contenuto</span>
                                  <input
                                    type="text"
                                    value={editingIdea.title}
                                    autoFocus
                                    onChange={(e) =>
                                      setEditingIdea({
                                        ...editingIdea,
                                        title: e.target.value,
                                      })
                                    }
                                    placeholder="Di cosa parla il contenuto"
                                  />
                                </label>
                                <label>
                                  <span>Cosa deve dire, in breve</span>
                                  <textarea
                                    rows={2}
                                    value={editingIdea.reason}
                                    onChange={(e) =>
                                      setEditingIdea({
                                        ...editingIdea,
                                        reason: e.target.value,
                                      })
                                    }
                                    placeholder="Il punto che vuoi far arrivare al lettore"
                                  />
                                </label>
                                <div className="idea-actions">
                                  <button
                                    className="btn btn-primary"
                                    disabled={occupato}
                                    onClick={() =>
                                      createIdeaDraft(
                                        {
                                          ...idea,
                                          title: editingIdea.title,
                                          reason: editingIdea.reason,
                                        },
                                        index,
                                        "ai",
                                      )
                                    }
                                  >
                                    ✨ Genera con l’AI
                                  </button>
                                  <button
                                    className="btn btn-outline"
                                    disabled={occupato}
                                    onClick={() =>
                                      createIdeaDraft(
                                        {
                                          ...idea,
                                          title: editingIdea.title,
                                          reason: editingIdea.reason,
                                        },
                                        index,
                                        "manual",
                                      )
                                    }
                                  >
                                    ✎ Scrivo io
                                  </button>
                                  <button
                                    className="btn btn-outline"
                                    disabled={occupato || generatingSocial}
                                    onClick={() =>
                                      generateSocialContent({
                                        ...idea,
                                        title: editingIdea.title,
                                        reason: editingIdea.reason,
                                      })
                                    }
                                  >
                                    Genera post social
                                  </button>
                                  <button
                                    className="btn btn-ghost"
                                    onClick={() => setEditingIdea(null)}
                                  >
                                    Annulla
                                  </button>
                                  <button
                                    className="btn btn-ghost idea-delete"
                                    disabled={
                                      occupato || dismissingIdeaKey === ideaKey
                                    }
                                    onClick={() => dismissContentIdea(idea)}
                                  >
                                    {dismissingIdeaKey === ideaKey
                                      ? "Elimino…"
                                      : "Elimina proposta"}
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
                                {(idea.hook || idea.format || idea.objective || idea.cta || idea.social_angle) && <dl className="idea-editorial-plan">{[['Obiettivo', idea.objective], ['Formato', idea.format], ['Apertura', idea.hook], ['Taglio social', idea.social_angle], ['Invito all’azione', idea.cta]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
                                <div className="idea-origin">
                                  Da: {idea.source}
                                  {idea.freshness ? ` · ${idea.freshness}` : ""}
                                  {idea.source_url ? (
                                    <>
                                      {" "}
                                      ·{" "}
                                      <a
                                        href={idea.source_url}
                                        target="_blank"
                                        rel="noopener"
                                      >
                                        vedi fonte
                                      </a>
                                    </>
                                  ) : null}
                                </div>
                                <div className="idea-actions">
                                  <button
                                    className="btn btn-primary"
                                    disabled={occupato}
                                    onClick={() =>
                                      createIdeaDraft(idea, index, "ai")
                                    }
                                  >
                                    {preparingIdea === index
                                      ? "Creo la bozza…"
                                      : "✨ Genera con l’AI"}
                                  </button>
                                  <button
                                    className="btn btn-outline"
                                    disabled={occupato}
                                    onClick={() =>
                                      createIdeaDraft(idea, index, "manual")
                                    }
                                  >
                                    ✎ Scrivo io
                                  </button>
                                  <button
                                    className="btn btn-outline"
                                    disabled={occupato || generatingSocial}
                                    onClick={() => generateSocialContent(idea)}
                                  >
                                    {generatingSocial
                                      ? "Preparo il social…"
                                      : "Genera post social"}
                                  </button>
                                  <button
                                    className="btn btn-ghost"
                                    disabled={occupato}
                                    onClick={() =>
                                      setEditingIdea({
                                        index,
                                        title: idea.title,
                                        reason: idea.reason,
                                      })
                                    }
                                  >
                                    Adatta l’idea
                                  </button>
                                  <button
                                    className="btn btn-ghost idea-delete"
                                    disabled={
                                      occupato || dismissingIdeaKey === ideaKey
                                    }
                                    onClick={() => dismissContentIdea(idea)}
                                  >
                                    {dismissingIdeaKey === ideaKey
                                      ? "Elimino…"
                                      : "Elimina"}
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
                        Ancora nessuna proposta: servono contenuti pubblicati o
                        il Profilo guidato compilato. Puoi comunque partire da
                        un’idea tua, qui sotto.
                      </li>
                    )}
                  </ol>

                  <div
                    className={`idea-custom ${customIdeaOpen ? "is-open" : ""}`}
                  >
                    {!customIdeaOpen ? (
                      <button
                        className="btn btn-outline idea-custom-toggle"
                        onClick={() => setCustomIdeaOpen(true)}
                      >
                        + Ho un’idea mia
                      </button>
                    ) : (
                      <div className="idea-edit">
                        <div className="idea-custom-title">La tua idea</div>
                        <label>
                          <span>Titolo del contenuto</span>
                          <input
                            type="text"
                            value={customIdea.title}
                            autoFocus
                            onChange={(e) =>
                              setCustomIdea({
                                ...customIdea,
                                title: e.target.value,
                              })
                            }
                            placeholder="Es. Come scegliere il materasso giusto per la lombalgia"
                          />
                        </label>
                        <label>
                          <span>Cosa deve dire, in breve</span>
                          <textarea
                            rows={2}
                            value={customIdea.reason}
                            onChange={(e) =>
                              setCustomIdea({
                                ...customIdea,
                                reason: e.target.value,
                              })
                            }
                            placeholder="Il punto che vuoi far arrivare al lettore"
                          />
                        </label>
                        <div className="idea-actions">
                          <button
                            className="btn btn-primary"
                            disabled={
                              preparingIdea !== -1 || !customIdea.title.trim()
                            }
                            onClick={() =>
                              createIdeaDraft(
                                {
                                  ...customIdea,
                                  type: "Idea tua",
                                  source: "Proposta manuale",
                                  priority: "Scelta da te",
                                },
                                -2,
                                "ai",
                              )
                            }
                          >
                            ✨ Genera con l’AI
                          </button>
                          <button
                            className="btn btn-outline"
                            disabled={
                              preparingIdea !== -1 || !customIdea.title.trim()
                            }
                            onClick={() =>
                              createIdeaDraft(
                                {
                                  ...customIdea,
                                  type: "Idea tua",
                                  source: "Proposta manuale",
                                  priority: "Scelta da te",
                                },
                                -2,
                                "manual",
                              )
                            }
                          >
                            ✎ Scrivo io
                          </button>
                          <button
                            className="btn btn-outline"
                            disabled={
                              generatingSocial || !customIdea.title.trim()
                            }
                            onClick={() =>
                              generateSocialContent({
                                ...customIdea,
                                type: "Idea tua",
                                source: "Proposta manuale",
                              })
                            }
                          >
                            Genera post social
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => {
                              setCustomIdeaOpen(false);
                              setCustomIdea({ title: "", reason: "" });
                            }}
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="ideas-foot">
                    In ogni caso finisci nell’editor con una bozza{" "}
                    <strong>non pubblicata</strong>: «Genera con l’AI» te la
                    consegna già scritta da rivedere, «Scrivo io» ti lascia una
                    traccia vuota da riempire.
                  </p>
                </div>

              <section
                className="card"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <header style={{ marginBottom: "1.5rem" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "1.5rem",
                      color: "var(--text)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18h6" />
                      <path d="M10 22h4" />
                      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.67 3.03 6.17a1 1 0 0 1 .37.78V17h7v-1.05a1 1 0 0 1 .37-.78C17.81 13.67 19 11.38 19 9a7 7 0 0 0-7-7z" />
                    </svg>
                    Generazione manuale di 2 articoli
                  </h2>
                  <p
                    style={{ margin: "0.5rem 0 0", color: "var(--text-muted)" }}
                  >
                    Indica a LIA fornendo o il titolo o una breve sintesi di
                    quello che vuoi trattare 2 articoli che lei genererà.
                    (italiano, formattazione, a tutto il resto pensa lei!)
                  </p>
                </header>

                {!ideaGenState.variants ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.5rem",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontWeight: "600" }}>
                        Di cosa vuoi scrivere? (Argomento)
                      </span>
                      <textarea
                        className="form-input"
                        rows={2}
                        value={ideaGenState.argomento}
                        onChange={(e) =>
                          setIdeaGenState((p) => ({
                            ...p,
                            argomento: e.target.value,
                          }))
                        }
                        placeholder="Es. I 3 errori più comuni nel mio settore..."
                      />
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        cursor: "pointer",
                        padding: "1rem",
                        background: "var(--bg)",
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={ideaGenState.usa_profilo}
                        onChange={(e) =>
                          setIdeaGenState((p) => ({
                            ...p,
                            usa_profilo: e.target.checked,
                          }))
                        }
                        style={{ width: "20px", height: "20px" }}
                      />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: "600" }}>
                          Usa il mio profilo e Internet
                        </span>
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          LIA baserà il testo sulla tua identità e cercherà
                          aggiornamenti in tempo reale su Google per
                          arricchirlo.
                        </span>
                      </div>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontWeight: "600" }}>
                        Hai qualche sito di riferimento? (Link di spunto
                        opzionali)
                      </span>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={ideaGenState.links}
                        onChange={(e) =>
                          setIdeaGenState((p) => ({
                            ...p,
                            links: e.target.value,
                          }))
                        }
                        placeholder="Incolla qui gli URL (uno per riga) da cui prendere ispirazione o informazioni."
                      />
                    </label>

                    {ideaGenState.error && (
                      <div
                        style={{
                          padding: "1rem",
                          background: "rgba(239,68,68,0.1)",
                          color: "#ef4444",
                          borderRadius: "var(--radius)",
                          border: "1px solid rgba(239,68,68,0.3)",
                        }}
                      >
                        {ideaGenState.error}
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      onClick={generateIdeaTexts}
                      disabled={
                        ideaGenState.loading ||
                        (!ideaGenState.argomento.trim() &&
                          !ideaGenState.links.trim())
                      }
                      style={{ padding: "0.75rem 1.5rem", fontSize: "1.1rem" }}
                    >
                      {ideaGenState.loading
                        ? "Generazione in corso (può richiedere fino a 1 minuto)..."
                        : "✨ Genera 2 Varianti"}
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      className="btn btn-outline"
                      onClick={() =>
                        setIdeaGenState((p) => ({ ...p, variants: null }))
                      }
                      style={{ marginBottom: "1.5rem" }}
                    >
                      ← Cambia richiesta
                    </button>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(300px, 1fr))",
                        gap: "1.5rem",
                      }}
                    >
                      {ideaGenState.variants.map((variant, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "1.5rem",
                            background: "var(--bg)",
                            borderRadius: "var(--radius)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <h3
                            style={{
                              margin: "0 0 1rem",
                              color: "var(--primary)",
                            }}
                          >
                            Variante {i + 1}: {variant.title}
                          </h3>
                          <div
                            style={{
                              color: "var(--text)",
                              fontSize: "0.95rem",
                              lineHeight: "1.6",
                              maxHeight: "400px",
                              overflowY: "auto",
                              marginBottom: "1.5rem",
                              paddingRight: "0.5rem",
                            }}
                            dangerouslySetInnerHTML={{
                              __html: variant.content,
                            }}
                          />
                          <button
                            className="btn btn-primary"
                            style={{ width: "100%" }}
                            disabled={ideaGenState.savingVariantIndex !== -1}
                            onClick={() => saveIdeaVariant(variant, i)}
                          >
                            {ideaGenState.savingVariantIndex === i
                              ? "Salvataggio..."
                              : "✓ Scegli e vai agli Articoli"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {(tab === "overview" ||
            (tab === "profile" && profileSubTab === "who")) && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
            >
              {tab === "overview" && (
                <section
                  className="project-command-center"
                  aria-labelledby="project-command-title"
                >
                  <div className="project-command-main">
                    <div className="project-command-status">
                      <i aria-hidden="true" /> Sito attivo
                    </div>
                    <span className="section-eyebrow">
                      Il tuo progetto digitale
                    </span>
                    <h2 id="project-command-title">
                      {site?.title ||
                        siteTitleDraft ||
                        user?.name ||
                        "Il tuo sito"}
                    </h2>
                    <p>
                      Contenuti, pubblicazione e identità visiva riuniti in un
                      unico spazio di lavoro.
                    </p>
                    <div className="project-command-actions">
                      <a
                        className="btn btn-primary"
                        href={siteUrl}
                        target="_blank"
                        rel="noopener"
                      >
                        Apri il sito ↗
                      </a>
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          setTab("profile");
                          setProfileSubTab("themes");
                          setMobileMenuOpen(false);
                        }}
                      >
                        Gestisci l’aspetto
                      </button>
                    </div>
                  </div>
                  <div
                    className="project-command-grid"
                    aria-label="Stato del progetto"
                  >
                    <article onClick={() => window.location.assign('/builder/')} style={{cursor: 'pointer'}}>
                      <span
                        className="project-command-icon is-ai"
                        aria-hidden="true"
                      >
                        🎨
                      </span>
                      <div>
                        <small>Editor del sito</small>
                        <strong>OpenPage Builder</strong>
                        <p>Disegna e crea le pagine del tuo sito</p>
                      </div>
                      <b className="is-ready">Apri</b>
                    </article>
                    <article>
                      <span className="project-command-icon" aria-hidden="true">
                        ◎
                      </span>
                      <div>
                        <small>Canali social</small>
                        <strong>
                          {activeChannelCount} collegat
                          {activeChannelCount === 1 ? "o" : "i"}
                        </strong>
                        <p>{posts.length} contenuti acquisiti</p>
                      </div>
                      <button
                        onClick={() => selectNavigation({ id: "sources" })}
                        aria-label="Gestisci i canali"
                      >
                        →
                      </button>
                    </article>
                    <article>
                      <span className="project-command-icon" aria-hidden="true">
                        ✓
                      </span>
                      <div>
                        <small>Articoli</small>
                        <strong>{readyPostCount} pronti</strong>
                        <p>{publishedPosts.length} già online</p>
                      </div>
                      <button
                        onClick={() => selectNavigation({ id: "site" })}
                        aria-label="Gestisci gli articoli"
                      >
                        →
                      </button>
                    </article>
                  </div>
                </section>
              )}
              {tab === "overview" &&
                (isBasePlan ? (
                  <div className="base-home">
                    <section
                      className={`base-start-card is-${baseAcquisition.status}`}
                    >
                      <div className="base-start-icon" aria-hidden="true">
                        {syncing ? (
                          <span className="acquisition-spinner" />
                        ) : posts.length > 0 ? (
                          "✓"
                        ) : activeChannelCount > 0 ? (
                          "↻"
                        ) : (
                          "1"
                        )}
                      </div>
                      <div className="base-start-copy">
                        <span className="section-eyebrow">
                          Il tuo prossimo passo
                        </span>
                        <h2>
                          {posts.length > 0
                            ? `Ho acquisito ${posts.length} contenuti`
                            : activeChannelCount > 0
                              ? "Sto leggendo il tuo social"
                              : "Collega il tuo primo social"}
                        </h2>
                        <p>
                          {baseAcquisition.message ||
                            (posts.length > 0
                              ? "I contenuti trovati sono qui sotto. Puoi controllarli oppure aprire subito il tuo sito."
                              : activeChannelCount > 0
                                ? "L’acquisizione parte automaticamente. I primi contenuti compariranno qui appena trovati."
                                : "Incolla il link del tuo profilo: al resto pensiamo noi.")}
                        </p>
                        <div className="base-start-actions">
                          {activeChannelCount === 0 ? (
                            <button
                              className="btn btn-primary"
                              onClick={() => {
                                window.location.href = "/connect";
                              }}
                            >
                              Collega il social
                            </button>
                          ) : posts.length > 0 ? (
                            <button
                              className="btn btn-primary"
                              onClick={() => selectNavigation({ id: "site" })}
                            >
                              Guarda i contenuti
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary"
                              onClick={() => acquireBaseContent(false)}
                              disabled={syncing}
                            >
                              {syncing ? "Sto acquisendo…" : "Riprova ora"}
                            </button>
                          )}
                          <a
                            className="btn btn-outline"
                            href={siteUrl}
                            target="_blank"
                            rel="noopener"
                          >
                            Apri il sito ↗
                          </a>
                        </div>
                      </div>
                    </section>

                    {<section className="card"><h2>Sito pubblico</h2><p>Modifica il sito, scegli temi e layout con LIA e gestisci le versioni salvate.</p><button className="btn btn-outline" onClick={()=>setTab("publicsite")}>Apri Sito pubblico →</button></section>}

                    {/* Pubblica tutti i contenuti pronti */}
                    {posts.length > publishedPosts.length && (
                      <section className="glass-modal" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', border: '1px solid var(--teal)' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--teal)' }}>Articoli pronti</div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginTop: 4 }}>
                            {posts.length - publishedPosts.length} contenuti in bozza non ancora sul sito
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            Solo i contenuti con titolo e score SEO vengono pubblicati
                          </div>
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{ background: 'var(--teal)', whiteSpace: 'nowrap', flexShrink: 0 }}
                          onClick={async () => {
                            try {
                              const res = await apiFetch('/api/index.php?action=publish-all', { method: 'POST' }, token);
                              await loadData();
                              setSyncMsg({ ok: true, text: `${res.published} articoli pubblicati sul sito!` });
                            } catch (e) {
                              setSyncMsg({ ok: false, text: e.message });
                            }
                          }}
                        >
                          📤 Pubblica tutti sul sito
                        </button>
                      </section>
                    )}

                    <section
                      className="base-summary"
                      aria-label="Stato del sito"
                    >
                      <button
                        onClick={() => selectNavigation({ id: "sources" })}
                      >
                        <strong>{activeChannelCount}</strong>
                        <span>Social collegato</span>
                      </button>
                      <button onClick={() => selectNavigation({ id: "site" })}>
                        <strong>{posts.length}</strong>
                        <span>Contenuti acquisiti</span>
                      </button>
                      <a href={siteUrl} target="_blank" rel="noopener">
                        <strong>{publishedPosts.length}</strong>
                        <span>Online sul sito</span>
                      </a>
                    </section>

                    <section className="base-content-list">
                      <div className="base-section-heading">
                        <div>
                          <span className="section-eyebrow">
                            Dai tuoi social
                          </span>
                          <h3>Contenuti trovati</h3>
                        </div>
                        {posts.length > 0 && (
                          <button
                            onClick={() => selectNavigation({ id: "site" })}
                          >
                            Vedi tutti →
                          </button>
                        )}
                      </div>
                      {posts.length === 0 ? (
                        <div className="base-empty-content">
                          {syncing ? (
                            <>
                              <span className="base-pulse" />
                              <strong>Acquisizione in corso</strong>
                              <p>
                                Non devi fare nulla. Questa schermata si
                                aggiorna da sola.
                              </p>
                            </>
                          ) : (
                            <>
                              <strong>Non vedo ancora contenuti</strong>
                              <p>
                                {activeChannelCount
                                  ? "Premi “Riprova ora” oppure controlla il canale collegato."
                                  : "Collega un social per iniziare."}
                              </p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="base-content-grid">
                          {posts.slice(0, 6).map((post) => (
                            <button
                              key={post.id}
                              className="base-content-card"
                              onClick={() => selectNavigation({ id: "site" })}
                            >
                              {post.media_url && (
                                <img src={post.media_url} alt="" />
                              )}
                              <div>
                                <span>
                                  {post.platform || "social"} ·{" "}
                                  {Number(post.seo_score) < 0
                                    ? "in preparazione"
                                    : Number(post.published) === 1
                                      ? "online"
                                      : "bozza"}
                                </span>
                                <strong>
                                  {post.edited_title ||
                                    post.generated_title ||
                                    String(post.raw_content || "").slice(
                                      0,
                                      90,
                                    ) ||
                                    "Contenuto acquisito"}
                                </strong>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                ) : (
                  <div className="overview-workspace">
                    <section
                      className="overview-metrics"
                      aria-label="Riepilogo del progetto"
                    >
                      {[
                        {
                          n: sources.length,
                          l: "Canali collegati",
                          action: () => selectNavigation({ id: "sources" }),
                        },
                        {
                          n: posts.length,
                          l: "Contenuti acquisiti",
                          action: () => selectNavigation({ id: "site" }),
                        },
                        {
                          n: publishedPosts.length,
                          l: "Articoli online",
                          action: () => selectNavigation({ id: "site" }),
                        },
                        {
                          n: Number(visibility.actions || 0).toLocaleString(
                            "it-IT",
                          ),
                          l: "Azioni degli utenti",
                          action: () => selectNavigation({ id: "seo" }),
                        },
                      ].map((s, i) => (
                        <button key={i} type="button" onClick={s.action}>
                          <strong>{s.n}</strong>
                          <span>{s.l}</span>
                          <i aria-hidden="true">→</i>
                        </button>
                      ))}
                    </section>

                    <section className="overview-primary-grid">
                      {<section className="card"><h2>Sito pubblico</h2><p>Modifica il sito, scegli temi e layout con LIA e gestisci le versioni salvate.</p><button className="btn btn-outline" onClick={()=>setTab("publicsite")}>Apri Sito pubblico →</button></section>}
                      <div className="card overview-next-card">
                        <span className="section-eyebrow">Prossima azione</span>
                        <h2>
                          {readyPostCount
                            ? `${readyPostCount} contenuti pronti da controllare`
                            : "Il progetto è sotto controllo"}
                        </h2>
                        <p>
                          {readyPostCount
                            ? "Rivedi titoli e testi, poi scegli cosa pubblicare."
                            : "Puoi aggiornare i canali oppure verificare come il sito appare in rete."}
                        </p>
                        <div>
                          <button
                            className="btn btn-primary"
                            onClick={() =>
                              selectNavigation({
                                id: readyPostCount ? "site" : "sources",
                              })
                            }
                          >
                            {readyPostCount
                              ? "Controlla i contenuti"
                              : "Gestisci i canali"}
                          </button>
                          <button
                            className="btn btn-outline"
                            onClick={() => selectNavigation({ id: "seo" })}
                          >
                            Verifica Google
                          </button>
                        </div>
                        <small
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "12px",
                          }}
                        >
                          Ultimo aggiornamento:{" "}
                          {site?.last_sync
                            ? new Date(site.last_sync).toLocaleString("it-IT")
                            : "mai effettuato"}
                        </small>
                      </div>
                    </section>

                    <details className="card overview-details">
                      <summary>
                        <span>
                          <strong>Dettaglio delle interazioni</strong>
                          <small>
                            Visite, clic e azioni degli ultimi 30 giorni
                          </small>
                        </span>
                        <b>
                          {Number(
                            visibility.unique_visitors || 0,
                          ).toLocaleString("it-IT")}{" "}
                          visite
                        </b>
                      </summary>
                      <div>
                        {[
                          [
                            "Percorsi scelti",
                            visibility.event_counts?.path_select || 0,
                          ],
                          [
                            "Contenuti aperti",
                            visibility.event_counts?.path_content_click || 0,
                          ],
                          [
                            "Clic sul numero",
                            visibility.event_counts?.call_click || 0,
                          ],
                          [
                            "Indicazioni",
                            visibility.event_counts?.directions_click || 0,
                          ],
                          [
                            "WhatsApp",
                            visibility.event_counts?.whatsapp_click || 0,
                          ],
                          [
                            "Prenotazione",
                            visibility.event_counts?.booking_click || 0,
                          ],
                          [
                            "Social",
                            visibility.event_counts?.social_click || 0,
                          ],
                        ].map(([label, value]) => (
                          <article key={label}>
                            <strong>{value}</strong>
                            <span>{label}</span>
                          </article>
                        ))}
                      </div>
                    </details>
                  </div>
                ))}

              {tab === "profile" && profileSubTab === "who" && (
                <div style={{ display: "grid", gap: "24px" }}>
                  <ProfileReviewPanel value={declaredStrategy} onChange={updateDeclaredStrategy} onSave={()=>saveProfileReview('interview')} busy={profileReviewBusy} />
                  <button className="btn btn-outline" style={{justifySelf:'start'}} onClick={()=>setShowInterview(value=>!value)}>{showInterview?'Chiudi conversazione':'Parla con LIA per completare le risposte'}</button>
                  {showInterview && (
                    <>
                      {isStrategyComplete && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            marginBottom: "-12px",
                          }}
                        >
                          <button
                            className="btn btn-outline"
                            onClick={() => setShowInterview(false)}
                          >
                            Chiudi intervista
                          </button>
                        </div>
                      )}
                      <StrategyInterview
                        declaredStrategy={declaredStrategy}
                        onUpdateStrategy={async (updates) => {
                          const newStrategy = {
                            ...declaredStrategy,
                            ...updates,
                          };
                          try {
                            await apiFetch(
                              "/api/index.php?action=site-update",
                              {
                                method: "POST",
                                body: JSON.stringify({
                                  site_understanding_corrections: {
                                    declared_strategy: newStrategy,
                                  },
                                }),
                              },
                              token,
                            );
                          } catch (e) {
                            throw e;
                          }
                          Object.entries(updates).forEach(([k, v]) => updateDeclaredStrategy(k, v));
                          await loadData();
                        }}
                        apiFetch={apiFetch}
                        token={token}
                      />
                    </>
                  )}
                  {isStrategyComplete &&
                    !showInterview &&
                    <details className="card"><summary>Istruzioni aggiuntive per l’AI</summary>{renderEditorialAgentPanel()}</details>}
                </div>
              )}

              {false && (
                <div
                  id="strategy-legacy"
                  className="card"
                  style={{
                    padding: "1.5rem",
                    background: "var(--surface)",
                    border: "1px solid var(--primary)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1.25rem",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ maxWidth: "680px" }}>
                      <div
                        style={{
                          color: "var(--primary)",
                          fontSize: "12px",
                          fontWeight: 850,
                          textTransform: "uppercase",
                          letterSpacing: ".08em",
                        }}
                      >
                        Strategia dichiarata da te
                      </div>
                      <h3
                        style={{
                          margin: "0.4rem 0",
                          color: "var(--text)",
                          fontSize: "22px",
                        }}
                      >
                        Aiutaci a raggiungere le persone giuste
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--text-muted)",
                          fontSize: "14px",
                          lineHeight: 1.65,
                        }}
                      >
                        Dai social possiamo capire cosa pubblichi. Solo tu puoi
                        dirci quali clienti vuoi raggiungere, dove si trovano e
                        quale azione vuoi ottenere. Le tue risposte hanno sempre
                        priorità sulle ipotesi dell’AI.
                      </p>
                    </div>
                    <div style={{ minWidth: "180px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          fontWeight: 800,
                          color: "var(--text)",
                          marginBottom: "7px",
                        }}
                      >
                        <span>Profilo strategico</span>
                        <span>{strategyProgress}%</span>
                      </div>
                      <div
                        style={{
                          height: "9px",
                          background: "var(--bg)",
                          borderRadius: "999px",
                          overflow: "hidden",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div
                          style={{
                            width: `${strategyProgress}%`,
                            height: "100%",
                            background:
                              "linear-gradient(90deg, var(--primary), var(--teal))",
                            transition: "width .25s ease",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "1.4rem",
                      padding: "1rem",
                      background: "var(--primary-light)",
                      borderRadius: "14px",
                      color: "var(--text)",
                      fontSize: "13px",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong>La base proposta dall’AI:</strong>{" "}
                    {activeUnderstanding.vertical_label ||
                      "attività da definire"}
                    {activeUnderstanding.business_model
                      ? ` · ${activeUnderstanding.business_model}`
                      : ""}
                    . Confermala attraverso le risposte qui sotto: non useremo
                    più le supposizioni come se fossero dati certi.
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "1.15rem",
                      marginTop: "1.35rem",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: "1rem",
                      }}
                    >
                      <label className="form-group">
                        <span className="label">Che tipo di attività sei?</span>
                        <input
                          value={declaredStrategy.activity_type || ""}
                          onChange={(e) =>
                            updateDeclaredStrategy(
                              "activity_type",
                              e.target.value,
                            )
                          }
                          placeholder="Es. agriturismo con ristorante e ospitalità"
                        />
                      </label>
                      <label className="form-group">
                        <span className="label">Cosa offri concretamente?</span>
                        <input
                          value={declaredStrategy.offer_summary || ""}
                          onChange={(e) =>
                            updateDeclaredStrategy(
                              "offer_summary",
                              e.target.value,
                            )
                          }
                          placeholder="Es. soggiorni, cucina locale, piscina ed eventi"
                        />
                      </label>
                    </div>

                    <div>
                      <div
                        className="label"
                        style={{ marginBottom: "0.65rem" }}
                      >
                        Qual è il risultato più importante?
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        {STRATEGY_GOALS.map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              updateDeclaredStrategy("primary_goal", value)
                            }
                            style={{
                              padding: "9px 12px",
                              borderRadius: "999px",
                              cursor: "pointer",
                              border:
                                declaredStrategy.primary_goal === value
                                  ? "1px solid var(--primary)"
                                  : "1px solid var(--border-strong)",
                              background:
                                declaredStrategy.primary_goal === value
                                  ? "var(--primary)"
                                  : "var(--bg)",
                              color:
                                declaredStrategy.primary_goal === value
                                  ? "#fff"
                                  : "var(--text)",
                              fontWeight: 700,
                              fontSize: "13px",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(270px, 1fr))",
                        gap: "1rem",
                      }}
                    >
                      <label className="form-group">
                        <span className="label">
                          Pubblico principale che vuoi raggiungere
                        </span>
                        <textarea
                          value={declaredStrategy.primary_audience || ""}
                          onChange={(e) =>
                            updateDeclaredStrategy(
                              "primary_audience",
                              e.target.value,
                            )
                          }
                          placeholder="Es. coppie e famiglie di Roma, 30–60 anni, interessate a weekend nella natura"
                          style={{ minHeight: "92px", resize: "vertical" }}
                        />
                      </label>
                      <label className="form-group">
                        <span className="label">
                          Pubblico secondario · facoltativo
                        </span>
                        <textarea
                          value={declaredStrategy.secondary_audience || ""}
                          onChange={(e) =>
                            updateDeclaredStrategy(
                              "secondary_audience",
                              e.target.value,
                            )
                          }
                          placeholder="Es. aziende che cercano una location per eventi e ritiri"
                          style={{ minHeight: "92px", resize: "vertical" }}
                        />
                      </label>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "1rem",
                      }}
                    >
                      <label className="form-group">
                        <span className="label">Territorio da raggiungere</span>
                        <input
                          value={declaredStrategy.geographic_area || ""}
                          onChange={(e) =>
                            updateDeclaredStrategy(
                              "geographic_area",
                              e.target.value,
                            )
                          }
                          placeholder="Es. Roma, Lazio e Centro Italia"
                        />
                      </label>
                      <label className="form-group">
                        <span className="label">
                          Azione che desideri ottenere
                        </span>
                        <input
                          value={declaredStrategy.desired_action || ""}
                          onChange={(e) =>
                            updateDeclaredStrategy(
                              "desired_action",
                              e.target.value,
                            )
                          }
                          placeholder="Es. richiesta disponibilità su WhatsApp"
                        />
                      </label>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(270px, 1fr))",
                        gap: "1rem",
                      }}
                    >
                      <label className="form-group">
                        <span className="label">
                          Servizi o prodotti prioritari · uno per riga
                        </span>
                        <textarea
                          value={(
                            declaredStrategy.priority_services || []
                          ).join("\n")}
                          onChange={(e) =>
                            updateDeclaredStrategyList(
                              "priority_services",
                              e.target.value,
                            )
                          }
                          placeholder={
                            "Soggiorni weekend\nRistorante\nEventi privati"
                          }
                          style={{ minHeight: "112px", resize: "vertical" }}
                        />
                      </label>
                      <label className="form-group">
                        <span className="label">
                          Perché dovrebbero scegliere te?
                        </span>
                        <textarea
                          value={declaredStrategy.differentiators || ""}
                          onChange={(e) =>
                            updateDeclaredStrategy(
                              "differentiators",
                              e.target.value,
                            )
                          }
                          placeholder="Elementi distintivi, esperienza, metodo, posizione, qualità o vantaggi concreti"
                          style={{ minHeight: "112px", resize: "vertical" }}
                        />
                      </label>
                    </div>

                    <label className="form-group">
                      <span className="label">
                        Quali esigenze o dubbi ha questo pubblico? · facoltativo
                      </span>
                      <textarea
                        value={declaredStrategy.customer_needs || ""}
                        onChange={(e) =>
                          updateDeclaredStrategy(
                            "customer_needs",
                            e.target.value,
                          )
                        }
                        placeholder="Es. vuole sapere se la struttura è adatta ai bambini, quanto dista da Roma e cosa è incluso"
                        style={{ minHeight: "82px", resize: "vertical" }}
                      />
                    </label>

                    {!!(
                      activeUnderstanding.editorial_direction
                        ?.critical_unknowns || []
                    ).length && (
                      <div
                        style={{
                          padding: "1rem",
                          borderRadius: "14px",
                          background: "var(--amber-light)",
                          color: "var(--text)",
                        }}
                      >
                        <div
                          style={{ fontWeight: 800, marginBottom: "0.45rem" }}
                        >
                          Cose che i social non ci hanno permesso di capire
                        </div>
                        <div style={{ fontSize: "13px", lineHeight: 1.65 }}>
                          {activeUnderstanding.editorial_direction.critical_unknowns.join(
                            " · ",
                          )}
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="btn btn-outline"
                        onClick={refreshUnderstanding}
                        disabled={savingProfile}
                      >
                        {savingProfile ? "Analisi…" : "Aggiorna la proposta AI"}
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={saveUnderstanding}
                        disabled={savingUnderstanding}
                        style={{ padding: "10px 18px" }}
                      >
                        {savingUnderstanding
                          ? "Salvataggio…"
                          : "Salva la mia strategia"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "profile" && profileSubTab === "presence" && (
            <div className="presence-workspace">
              <section className="presence-setup">
                <header>
                  <div>
                    <span>Rispondi una volta, il sistema usa tutto</span>
                    <h3>Completa la tua presenza</h3>
                    <p>
                      Ogni blocco corrisponde a una decisione comprensibile. Non
                      devi interpretare indicatori tecnici.
                    </p>
                  </div>
                  <strong>
                    {
                      (reachability.checks || []).filter((check) => check.done)
                        .length
                    }
                    /{(reachability.checks || []).length} pronti
                  </strong>
                </header>

                <div className="presence-step">
                  <div className="presence-step-number">1</div>
                  <div className="presence-step-body">
                    <h4>Qual è la tua presenza ufficiale?</h4>
                    <p>
                      Puoi usare soltanto lo Spazio Vivo oppure collegarlo a un
                      sito che possiedi già.
                    </p>
                    <div className="presence-choice-grid">
                      <button
                        className={
                          reachabilityDraft.presence_mode === "space_only"
                            ? "is-selected"
                            : ""
                        }
                        onClick={() =>
                          setReachabilityDraft((prev) => ({
                            ...prev,
                            presence_mode: "space_only",
                            official_site_url: "",
                            reciprocal_link_confirmed: false,
                          }))
                        }
                      >
                        <strong>Non ho un sito</strong>
                        <span>Spazio Vivo è la mia presenza ufficiale</span>
                      </button>
                      <button
                        className={
                          reachabilityDraft.presence_mode === "existing_site"
                            ? "is-selected"
                            : ""
                        }
                        onClick={() =>
                          setReachabilityDraft((prev) => ({
                            ...prev,
                            presence_mode: "existing_site",
                          }))
                        }
                      >
                        <strong>Ho già un sito</strong>
                        <span>Voglio collegarlo allo Spazio Vivo</span>
                      </button>
                    </div>
                    {reachabilityDraft.presence_mode === "existing_site" && (
                      <div className="presence-conditional">
                        <label>
                          <span>Indirizzo del sito</span>
                          <input
                            value={reachabilityDraft.official_site_url || ""}
                            onChange={(e) =>
                              setReachabilityDraft((prev) => ({
                                ...prev,
                                official_site_url: e.target.value,
                              }))
                            }
                            placeholder="https://www.tuodominio.it"
                          />
                        </label>
                        <label className="presence-checkbox">
                          <input
                            type="checkbox"
                            checked={
                              !!reachabilityDraft.reciprocal_link_confirmed
                            }
                            onChange={(e) =>
                              setReachabilityDraft((prev) => ({
                                ...prev,
                                reciprocal_link_confirmed: e.target.checked,
                              }))
                            }
                          />
                          <span>
                            Ho inserito nel mio sito un link verso lo Spazio
                            Vivo
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="presence-step">
                  <div className="presence-step-number">2</div>
                  <div className="presence-step-body">
                    <h4>Per cosa e dove vuoi essere trovato?</h4>
                    <p>
                      Queste informazioni guidano pagine, titoli, collegamenti e
                      contenuti futuri.
                    </p>
                    <div className="presence-fields two">
                      <label>
                        <span>Attività o ricerca principale</span>
                        <input
                          value={reachabilityDraft.primary_topic || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              primary_topic: e.target.value,
                            }))
                          }
                          placeholder="Es. agriturismo con ristorante vicino Roma"
                        />
                      </label>
                      <label>
                        <span>Profilo Google dell’attività</span>
                        <input
                          value={reachabilityDraft.business_profile_url || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              business_profile_url: e.target.value,
                            }))
                          }
                          placeholder="Link Google Maps o Business Profile"
                        />
                      </label>
                      <label className="full">
                        <span>Territori serviti · uno per riga</span>
                        <textarea
                          rows={3}
                          value={(reachabilityDraft.service_areas || []).join(
                            "\n",
                          )}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              service_areas: e.target.value.split("\n"),
                            }))
                          }
                          placeholder={"Roma\nCastelli Romani\nLazio"}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="presence-step">
                  <div className="presence-step-number">3</div>
                  <div className="presence-step-body">
                    <h4>Come possono contattarti?</h4>
                    <p>
                      I pulsanti vengono mostrati automaticamente negli
                      articoli. I campi vuoti non compaiono.
                    </p>
                    <div className="presence-fields three">
                      <label>
                        <span>Telefono</span>
                        <input
                          value={reachabilityDraft.phone || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="+39 06 1234567"
                        />
                      </label>
                      <label>
                        <span>WhatsApp</span>
                        <input
                          value={reachabilityDraft.whatsapp || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              whatsapp: e.target.value,
                            }))
                          }
                          placeholder="340 1234567"
                        />
                      </label>
                      <label>
                        <span>Email</span>
                        <input
                          type="email"
                          value={reachabilityDraft.email || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="info@attivita.it"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="presence-save">
                  <div>
                    <strong>Le tue risposte alimentano tutto il sistema</strong>
                    <span>
                      Pagine, dati strutturati, contatti e analisi useranno
                      queste informazioni.
                    </span>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={saveReachabilityNetwork}
                    disabled={savingReachability}
                  >
                    {savingReachability
                      ? "Salvataggio…"
                      : "Salva le informazioni"}
                  </button>
                </div>
              </section>
            </div>
          )}

          {tab === "seo" && visibilitySection === "network" && (
            <div className="presence-workspace">
              <section className="presence-hero">
                <div className="presence-hero-copy">
                  <span>La tua presenza digitale</span>
                  <h2>{reachability.score || 0}% completato</h2>
                  <p>
                    Questa percentuale misura ciò che hai realmente predisposto.
                    I dati Google sono separati perché dipendono dalla scansione
                    e non possono essere promessi.
                  </p>
                </div>
                <div
                  className="presence-score"
                  style={{ "--score": `${reachability.score || 0}%` }}
                >
                  <strong>{reachability.score || 0}%</strong>
                  <span>configurazione</span>
                </div>
              </section>

              <section className="google-progress-panel">
                <div className="google-progress-heading">
                  <div>
                    <span>Monitoraggio automatico incluso</span>
                    <h3>Google: copertura delle pagine</h3>
                  </div>
                  <small>
                    {reachability.google?.has_evidence
                      ? "Dati Google aggiornati automaticamente"
                      : "Raccolta dati in corso"}
                  </small>
                </div>
                <div className="google-progress-grid">
                  {[
                    [
                      "Monitoraggio",
                      100,
                      "Gestito centralmente da All Social To Web: non devi configurare nulla",
                    ],
                    [
                      "Pagine rilevate",
                      reachability.google?.presence_percent || 0,
                      `${reachability.google?.visible_pages || 0} su ${reachability.google?.published_pages || 0} pagine con segnali Google`,
                    ],
                  ].map(([label, value, detail]) => (
                    <div className="google-progress-card" key={label}>
                      <div>
                        <strong>{value}%</strong>
                        <span>{label}</span>
                      </div>
                      <div className="progress-track">
                        <span style={{ width: `${value}%` }} />
                      </div>
                      <p>{detail}</p>
                    </div>
                  ))}
                </div>
                <div className="google-progress-note">
                  La percentuale “Pagine rilevate” misura la copertura
                  osservata, non la posizione. I dati possono comparire dopo
                  alcuni giorni dalla pubblicazione.
                </div>
              </section>

              <section className="presence-status-summary">
                <header>
                  <div>
                    <span>Verifiche tecniche</span>
                    <h3>Cosa è già pronto</h3>
                  </div>
                  <p>
                    Questi controlli si aggiornano dalle risposte e dal lavoro
                    reale della piattaforma.
                  </p>
                </header>
                <div>
                  {(reachability.checks || []).map((check) => (
                    <article
                      key={check.id}
                      className={check.done ? "is-done" : ""}
                    >
                      <span>{check.done ? "✓" : "○"}</span>
                      <div>
                        <strong>{check.label}</strong>
                        <small>{check.detail}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Tab: I miei canali (UNIFICATO) */}
          {tab === "sources" &&
            (() => {
              const allChannels = [];
              sources.forEach((s) => {
                allChannels.push({
                  key: "src_" + s.id,
                  type: "url",
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
                  last_scan_note: s.last_scan_note || "",
                  last_scan_at: s.last_scan_at || null,
                });
              });

              const detectedPlatform = detectPlatformFromUrl(addUrl);
              const trackedPlatforms = new Set(
                allChannels.map((channel) => channel.platform),
              );
              const acquiredPosts = posts.filter((post) =>
                trackedPlatforms.has(post.platform),
              );
              const newestChannelDate =
                allChannels
                  .map((channel) => channel.last_content_at)
                  .filter(Boolean)
                  .sort()
                  .reverse()[0] || null;

              return (
                <div className="channels-workspace">
                  <section className="channels-hero">
                    <div>
                      <span>Acquisizione contenuti</span>
                      <h2>
                        {allChannels.length
                          ? `${allChannels.length} canali sotto controllo`
                          : "Collega il primo canale"}
                      </h2>
                      <p>
                        Qui vedi subito quanto materiale è stato acquisito e
                        quando è arrivato l'ultimo contenuto.
                      </p>
                    </div>
                    <div className="channels-hero-metrics">
                      <div>
                        <strong>{acquiredPosts.length}</strong>
                        <span>contenuti acquisiti</span>
                      </div>
                      <div>
                        <strong>
                          {newestChannelDate
                            ? new Date(newestChannelDate).toLocaleDateString(
                                "it-IT",
                              )
                            : "—"}
                        </strong>
                        <span>ultimo contenuto</span>
                      </div>
                    </div>
                  </section>

                  {/* Form Aggiungi Canale */}
                  <div
                    className="card channels-connect"
                    style={{
                      padding: "24px",
                      border: "2px solid var(--border)",
                      background: "var(--surface)",
                      borderRadius: "var(--radius-lg)",
                    }}
                  >
                    <h2
                      style={{
                        marginBottom: "0.75rem",
                        fontSize: "24px",
                        fontWeight: 800,
                      }}
                    >
                      Collega un nuovo social
                    </h2>
                    <p
                      style={{
                        fontSize: "16px",
                        color: "var(--text-muted)",
                        marginBottom: "1.5rem",
                        lineHeight: 1.5,
                      }}
                    >
                      Incolla l'URL pubblico di un sito, profilo, canale o
                      singolo post. I contenuti verranno acquisiti
                      automaticamente.
                    </p>
                    <form
                      onSubmit={handleAddChannel}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      <div style={{ position: "relative" }}>
                        <input
                          className="channel-url-input"
                          type="url"
                          placeholder="Es: https://www.instagram.com/iltuonome/"
                          value={addUrl}
                          onChange={(e) => {
                            setAddUrl(e.target.value);
                            setAddMsg(null);
                          }}
                          style={{
                            paddingLeft: detectedPlatform ? "52px" : "24px",
                            transition: "padding 0.2s",
                            paddingRight: "24px",
                            paddingTop: "16px",
                            paddingBottom: "16px",
                            fontSize: "18px",
                            width: "100%",
                            borderRadius: "12px",
                            border: "2px solid var(--border-strong)",
                          }}
                        />
                        {detectedPlatform && (
                          <span
                            style={{
                              position: "absolute",
                              left: "16px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              pointerEvents: "none",
                            }}
                          >
                            <img
                              src={SOCIAL[detectedPlatform]?.icon || ""}
                              alt=""
                              style={{ width: 24, height: 24 }}
                            />
                          </span>
                        )}
                      </div>
                      {detectedPlatform && (
                        <div
                          style={{
                            fontSize: "14px",
                            color: "var(--text-muted)",
                            padding: "10px 14px",
                            background: "var(--purple-light)",
                            borderRadius: "var(--radius-sm)",
                            fontWeight: 600,
                          }}
                        >
                          ✓ {SOCIAL[detectedPlatform]?.label || "Fonte"}{" "}
                          riconosciuto
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder="Etichetta opzionale (es. Profilo Personale)"
                        value={addLabel}
                        onChange={(e) => setAddLabel(e.target.value)}
                        style={{
                          padding: "16px 24px",
                          fontSize: "16px",
                          width: "100%",
                          borderRadius: "12px",
                          border: "1px solid var(--border-strong)",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="submit"
                          disabled={addLoading || !addUrl.trim()}
                          className="btn btn-primary"
                          style={{
                            padding: "12px 24px",
                            fontSize: "16px",
                            fontWeight: 800,
                          }}
                        >
                          {addLoading
                            ? "Aggiunta in corso…"
                            : "Aggiungi canale"}
                        </button>
                        {addMsg && (
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: 600,
                              color: addMsg.ok ? "var(--teal)" : "var(--red)",
                              background: addMsg.ok
                                ? "var(--teal-light)"
                                : "var(--red-light)",
                              padding: "10px 16px",
                              borderRadius: "var(--radius)",
                            }}
                          >
                            {addMsg.text}
                          </span>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Lista canali attivi */}
                  <div className="card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      <h2 style={{ margin: 0, fontSize: "18px" }}>
                        I tuoi social collegati ({allChannels.length})
                      </h2>
                      {allChannels.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={syncAllChannels}
                            disabled={scanning}
                            className="btn btn-primary"
                            style={{ fontSize: "13px", padding: "8px 18px" }}
                          >
                            {scanning
                              ? "⟳ Sincronizzazione..."
                              : "🔄 Sincronizza tutti"}
                          </button>
                        </div>
                      )}
                    </div>

                    {allChannels.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "3rem 1rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "48px",
                            marginBottom: "1rem",
                            opacity: 0.4,
                          }}
                        >
                          📭
                        </div>
                        <div
                          style={{ fontWeight: 600, marginBottom: "0.5rem" }}
                        >
                          Nessun canale aggiunto
                        </div>
                        <div style={{ fontSize: "13px" }}>
                          Aggiungi l'URL pubblico di un social o del sito web
                          del cliente.
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        {allChannels.map((channel) => (
                          <div
                            key={channel.key}
                            style={{
                              padding: "14px 16px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border-strong)",
                              background: "var(--bg)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                }}
                              >
                                <img
                                  src={
                                    SOCIAL[channel.platform]?.icon ||
                                    SOCIAL["website"]?.icon
                                  }
                                  alt=""
                                  style={{ width: 22, height: 22 }}
                                />
                                <div>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      fontSize: "14px",
                                    }}
                                  >
                                    {channel.label ||
                                      SOCIAL[channel.platform]?.label ||
                                      channel.platform}
                                    {channel.url && (
                                      <span
                                        style={{
                                          fontWeight: 400,
                                          fontSize: "12px",
                                          color: "var(--text-muted)",
                                          marginLeft: "8px",
                                        }}
                                      >
                                        <a
                                          href={channel.url}
                                          target="_blank"
                                          rel="noopener"
                                          style={{
                                            color: "var(--text-muted)",
                                            textDecoration: "none",
                                          }}
                                        >
                                          {channel.url
                                            .replace(/^https?:\/\/(www\.)?/, "")
                                            .replace(/\/$/, "")}
                                        </a>
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      display: "flex",
                                      gap: "6px",
                                      marginTop: "2px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        background: "var(--purple-light)",
                                        color: "var(--purple-dark)",
                                        padding: "1px 7px",
                                        borderRadius: "10px",
                                        fontWeight: 500,
                                      }}
                                    >
                                      🔍 Fonte social pubblica
                                    </span>
                                    <span
                                      style={{
                                        background:
                                          (channel.auto_sync ?? 1) === 1
                                            ? "var(--teal-light)"
                                            : "var(--gray-light)",
                                        color:
                                          (channel.auto_sync ?? 1) === 1
                                            ? "#0F6E56"
                                            : "var(--text-muted)",
                                        padding: "1px 7px",
                                        borderRadius: "10px",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {(channel.auto_sync ?? 1) === 1
                                        ? "Aggiornamento automatico"
                                        : "Solo manuale"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => removeChannel(channel)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--text-muted)",
                                  fontSize: "18px",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                }}
                                title="Rimuovi canale"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="channel-content-stats">
                              <div>
                                <strong>{channel.content_count}</strong>
                                <span>acquisiti</span>
                              </div>
                              <div>
                                <strong>{channel.published_count}</strong>
                                <span>pubblicati</span>
                              </div>
                              <div>
                                <strong>{channel.draft_count}</strong>
                                <span>in bozza</span>
                              </div>
                              <div>
                                <strong>{channel.processing_count}</strong>
                                <span>
                                  {isBasePlan
                                    ? "l'AI ci sta lavorando"
                                    : "in elaborazione"}
                                </span>
                              </div>
                              {(!isBasePlan || channel.failed_count > 0) && (
                                <div
                                  className={
                                    channel.failed_count > 0 ? "has-errors" : ""
                                  }
                                >
                                  <strong>{channel.failed_count}</strong>
                                  <span>
                                    {isBasePlan
                                      ? "da correggere"
                                      : "da riprovare"}
                                  </span>
                                </div>
                              )}
                              <div className="last">
                                <strong>
                                  {channel.last_content_at
                                    ? new Date(
                                        channel.last_content_at,
                                      ).toLocaleDateString("it-IT")
                                    : "Mai"}
                                </strong>
                                <span>ultimo contenuto</span>
                              </div>
                            </div>

                            {channel.last_scan_note && (
                              <div
                                style={{
                                  fontSize: "13px",
                                  lineHeight: 1.45,
                                  padding: "9px 12px",
                                  borderRadius: "var(--radius-sm)",
                                  color:
                                    channel.content_count === 0
                                      ? "#8a5a00"
                                      : "var(--text-muted)",
                                  background:
                                    channel.content_count === 0
                                      ? "#fff7e6"
                                      : "var(--bg)",
                                  border: `1px solid ${channel.content_count === 0 ? "#f0d089" : "var(--border)"}`,
                                }}
                              >
                                {channel.last_scan_note}
                                {channel.last_scan_at && (
                                  <span style={{ opacity: 0.65 }}>
                                    {" "}
                                    ·{" "}
                                    {new Date(
                                      String(channel.last_scan_at).replace(
                                        " ",
                                        "T",
                                      ),
                                    ).toLocaleString("it-IT", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                              </div>
                            )}

                            <details className="channel-settings-details">
                              <summary>Impostazioni di acquisizione</summary>
                              <div className="channel-sync-settings">
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--text-muted)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Dal:
                                </span>
                                <input
                                  type="date"
                                  defaultValue={channel.since_date || ""}
                                  title="Importa contenuti da questa data in poi"
                                  onBlur={(e) => {
                                    savePlatformSource(
                                      channel.rawPlatform,
                                      channel.url,
                                      e.target.value,
                                      channel.auto_publish ?? 1,
                                      channel.max_posts,
                                      channel.topic_summary,
                                      channel.auto_sync ?? 1,
                                    );
                                  }}
                                  style={{
                                    padding: "5px 8px",
                                    fontSize: "12px",
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--border)",
                                    width: "100%",
                                  }}
                                />
                                <input
                                  type="number"
                                  min="1"
                                  max="500"
                                  placeholder="Max"
                                  defaultValue={channel.max_posts || ""}
                                  title="Numero massimo di post da importare"
                                  onBlur={(e) => {
                                    const val = e.target.value || null;
                                    savePlatformSource(
                                      channel.rawPlatform,
                                      channel.url,
                                      channel.since_date,
                                      channel.auto_publish ?? 1,
                                      val,
                                      channel.topic_summary,
                                      channel.auto_sync ?? 1,
                                    );
                                  }}
                                  style={{
                                    padding: "5px 8px",
                                    fontSize: "12px",
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--border)",
                                    width: "70px",
                                  }}
                                />
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    defaultChecked={
                                      (channel.auto_publish ?? 1) === 1
                                    }
                                    onChange={(e) => {
                                      const ap = e.target.checked ? 1 : 0;
                                      savePlatformSource(
                                        channel.rawPlatform,
                                        channel.url,
                                        channel.since_date,
                                        ap,
                                        channel.max_posts,
                                        channel.topic_summary,
                                        channel.auto_sync ?? 1,
                                      );
                                    }}
                                  />
                                  Pubblica automaticamente
                                </label>
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                  title="Se disattivato, il canale viene aggiornato solo con Sincronizza tutti"
                                >
                                  <input
                                    type="checkbox"
                                    defaultChecked={
                                      (channel.auto_sync ?? 1) === 1
                                    }
                                    onChange={(e) => {
                                      const automatic = e.target.checked
                                        ? 1
                                        : 0;
                                      savePlatformSource(
                                        channel.rawPlatform,
                                        channel.url,
                                        channel.since_date,
                                        channel.auto_publish ?? 1,
                                        channel.max_posts,
                                        channel.topic_summary,
                                        automatic,
                                      );
                                    }}
                                  />
                                  Aggiornamento automatico
                                </label>
                              </div>
                            </details>
                          </div>
                        ))}
                      </div>
                    )}

                    {scanMsg && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "10px 14px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "13px",
                          background: scanMsg.ok
                            ? "var(--teal-light)"
                            : "var(--red-light)",
                          color: scanMsg.ok ? "#0F6E56" : "var(--red)",
                        }}
                      >
                        {scanMsg.loading && (
                          <span style={{ marginRight: "8px" }}>⟳</span>
                        )}
                        {scanMsg.text}
                      </div>
                    )}
                    {scanProgress.length > 0 && (
                      <div
                        style={{
                          marginTop: "10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        {scanProgress.map((s) => (
                          <div
                            key={s.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "12px",
                              padding: "6px 10px",
                              background: "var(--surface)",
                              borderRadius: "4px",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              {s.label || s.platform}
                            </span>
                            <span
                              style={{
                                color:
                                  s.status === "done"
                                    ? "var(--teal)"
                                    : s.status === "error"
                                      ? "var(--red)"
                                      : "var(--text-muted)",
                              }}
                            >
                              {s.status === "pending" && "⏳ In coda"}
                              {s.status === "scanning" &&
                                "🔍 Lettura in corso..."}
                              {s.status === "done" && `✅ ${s.details}`}
                              {s.status === "error" && `❌ Errore`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Profilazione AI */}
                  {false && (
                    <div className="card">
                      <h2 style={{ marginBottom: "0.5rem", fontSize: "18px" }}>
                        🧠 Profilo editoriale
                      </h2>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--text-muted)",
                          marginBottom: "1rem",
                        }}
                      >
                        Spiega all'AI chi sei e come deve comportarsi. Più
                        dettagli dai, migliori saranno gli articoli generati.
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <label className="label">Chi sei e cosa fai?</label>
                          <textarea
                            value={profileDraft}
                            onChange={(e) => setProfileDraft(e.target.value)}
                            placeholder="Es: Sono Marco, un artigiano che crea ceramiche e vende online..."
                            style={{
                              width: "100%",
                              minHeight: "60px",
                              resize: "vertical",
                              padding: "10px 14px",
                              border: "1px solid var(--border-strong)",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--surface)",
                              fontFamily: "inherit",
                              fontSize: "14px",
                            }}
                          />
                        </div>
                        <div>
                          <label className="label">
                            Pubblico target e obiettivo
                          </label>
                          <textarea
                            value={roleMissionDraft}
                            onChange={(e) =>
                              setRoleMissionDraft(e.target.value)
                            }
                            placeholder="Es: Mi rivolgo ad appassionati di design d'interni e voglio vendere i miei vasi..."
                            style={{
                              width: "100%",
                              minHeight: "60px",
                              resize: "vertical",
                              padding: "10px 14px",
                              border: "1px solid var(--border-strong)",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--surface)",
                              fontFamily: "inherit",
                              fontSize: "14px",
                            }}
                          />
                        </div>
                        <div>
                          <label className="label">
                            Tono di voce e regole editoriali
                          </label>
                          <textarea
                            value={strategyDraft}
                            onChange={(e) => setStrategyDraft(e.target.value)}
                            placeholder="Es: Usa un tono ironico. NON parlare mai di argomenti sensibili..."
                            style={{
                              width: "100%",
                              minHeight: "60px",
                              resize: "vertical",
                              padding: "10px 14px",
                              border: "1px solid var(--border-strong)",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--surface)",
                              fontFamily: "inherit",
                              fontSize: "14px",
                            }}
                          />
                        </div>
                        <button
                          className="btn btn-outline"
                          onClick={saveProfile}
                          disabled={savingProfile}
                          style={{ alignSelf: "flex-start" }}
                        >
                          {savingProfile
                            ? "Salvataggio..."
                            : "💾 Salva profilo editoriale"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Importa da link diretto */}
                  <details className="card">
                    <summary>Aggiungi un contenuto da un link web</summary>
                    <div className="channel-add-body">
                      <h2 style={{ marginBottom: "0.5rem", fontSize: "18px" }}>
                        Aggiungi un articolo da un link
                      </h2>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--text-muted)",
                          marginBottom: "12px",
                        }}
                      >
                        Incolla il link di un articolo o di una pagina: l'AI lo
                        legge e lo trasforma in un articolo per il tuo sito.
                      </p>
                      <form
                        onSubmit={doImport}
                        style={{ display: "flex", gap: "8px" }}
                      >
                        <input
                          className="channel-url-input"
                          type="url"
                          placeholder="https://www.esempio.it/articolo"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={importing}
                        >
                          {importing ? "⟳ In corso…" : "Aggiungi"}
                        </button>
                      </form>
                      {importMsg && (
                        <div
                          style={{
                            marginTop: "10px",
                            padding: "8px 12px",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "13px",
                            background: importMsg.ok
                              ? "var(--teal-light)"
                              : "var(--red-light)",
                            color: importMsg.ok ? "#0F6E56" : "var(--red)",
                          }}
                        >
                          {importMsg.text}
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              );
            })()}

          {tab === "profile" && profileSubTab === "identity" && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <section className="card profile-review-panel"><h2>Presentazione pubblica</h2><p>Questi testi sono destinati ai visitatori. L’intervista e le deduzioni dei social restano nel profilo di lavoro; scegli tu cosa rendere pubblico.</p><div className="profile-review-fields"><label><span>Presentazione breve</span><textarea rows={2} value={heroTagline} onChange={event=>setHeroTagline(event.target.value)} /></label><label><span>Chi sono / Chi siamo</span><textarea rows={6} value={profileDraft} onChange={event=>setProfileDraft(event.target.value)} /></label><label><span>Pubblico e obiettivo · guida per l’AI</span><textarea rows={3} value={roleMissionDraft} onChange={event=>setRoleMissionDraft(event.target.value)} /></label><label><span>Indicazioni sui contenuti · guida per l’AI</span><textarea rows={3} value={strategyDraft} onChange={event=>setStrategyDraft(event.target.value)} /></label></div><button className="btn btn-primary" disabled={profileReviewBusy} onClick={()=>saveProfileReview('public')}>Salva la presentazione</button> <button className="btn btn-outline" onClick={()=>setProfileDraft(socialProfileDraft.summary || profileUnderstanding?.summary || declaredStrategy.activity_type || '')}>Usa la sintesi come base da modificare</button></section>
              <section
                className="card visual-identity-panel"
                id="visual-identity"
              >
                <header>
                  <div>
                    <span className="section-eyebrow">Identità del sito</span>
                    <h2>Scegli nome e immagine</h2>
                    <p>
                      Il cliente decide come presentarsi: il nome scritto qui
                      resta prioritario e non viene sostituito dalle successive
                      importazioni social.
                    </p>
                  </div>
                  <a
                    className="btn btn-outline"
                    href={siteUrl}
                    target="_blank"
                    rel="noopener"
                  >
                    Vedi anteprima ↗
                  </a>
                </header>
                <form className="site-name-editor" onSubmit={saveSiteTitle}>
                  <label htmlFor="site-title">
                    <strong>Nome del sito</strong>
                    <span>
                      Comparirà nell’intestazione, nelle pagine e nei risultati
                      condivisi.
                    </span>
                  </label>
                  <div>
                    <input
                      id="site-title"
                      type="text"
                      maxLength={120}
                      required
                      value={siteTitleDraft}
                      onChange={(event) =>
                        setSiteTitleDraft(event.target.value)
                      }
                      placeholder="Es. Studio Rossi, Casa Verde, Marco Bianchi"
                    />
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={savingSiteTitle}
                    >
                      {savingSiteTitle ? "Salvataggio…" : "Salva nome"}
                    </button>
                  </div>
                </form>
                <div className="visual-choice-intro">
                  <strong>Immagine del sito</strong>
                  <span>
                    Usa un logo se hai un marchio riconoscibile; scegli una foto
                    per raccontare subito attività, luogo o persona.
                  </span>
                </div>
                <div
                  className="visual-choice-grid"
                  role="radiogroup"
                  aria-label="Tipo di immagine del sito"
                >
                  {[
                    [
                      "logo",
                      "Logo",
                      "Ideale per marchi e professionisti",
                      logoUrl,
                    ],
                    [
                      "cover",
                      "Immagine rappresentativa",
                      "Ideale per luoghi, persone e attività",
                      coverUrl,
                    ],
                  ].map(([mode, label, description, image]) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={brandVisualMode === mode}
                      className={brandVisualMode === mode ? "is-selected" : ""}
                      onClick={() => selectBrandVisualMode(mode)}
                      disabled={savingVisualMode}
                      key={mode}
                    >
                      <span className={`visual-choice-preview is-${mode}`}>
                        {image ? (
                          <img src={image} alt="" />
                        ) : (
                          <b>{mode === "logo" ? "LOGO" : "IMMAGINE"}</b>
                        )}
                      </span>
                      <span>
                        <strong>{label}</strong>
                        <small>{description}</small>
                      </span>
                      <i>{brandVisualMode === mode ? "✓" : ""}</i>
                    </button>
                  ))}
                </div>
                <div className="visual-upload-row">
                  <div>
                    <strong>
                      {brandVisualMode === "cover"
                        ? "Immagine orizzontale consigliata"
                        : "Logo quadrato o orizzontale"}
                    </strong>
                    <span>
                      {brandVisualMode === "cover"
                        ? "JPG, PNG o WebP · massimo 8 MB · rapporto consigliato 16:9"
                        : "JPG, PNG o WebP · massimo 3 MB · sfondo trasparente consigliato"}
                    </span>
                  </div>
                  <label className="btn btn-primary">
                    {uploadingLogo
                      ? "Caricamento…"
                      : `${brandVisualMode === "cover" ? "Carica immagine" : "Carica logo"}`}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) =>
                        uploadSiteVisual(event, brandVisualMode)
                      }
                      disabled={uploadingLogo}
                    />
                  </label>
                </div>
              </section>

            </div>
          )}

          {/* Tab: Sito */}
          {tab === "site" &&
            (() => {
              const allPlatforms = [
                ...new Set(posts.map((p) => p.platform)),
              ].sort();
              const allTags = [
                ...new Set(
                  posts
                    .flatMap((p) => p.tags || [])
                    .map((t) => t.toLowerCase()),
                ),
              ].sort();
              const pendingPosts = posts.filter(
                (p) =>
                  Number(p.seo_score) < 0 &&
                  postProcessingStatus(p) !== "processing",
              );
              const filteredPosts = posts.filter((p) => {
                const matchesStatus =
                  dashboardFilter === "all" ||
                  (dashboardFilter.startsWith("published-") &&
                    Number(p.published) ===
                      Number(dashboardFilter.replace("published-", "")));
                const matchesPlatform =
                  postPlatformFilter === "all" ||
                  p.platform === postPlatformFilter;
                const matchesTag =
                  postTagFilter === "all" ||
                  (p.tags || [])
                    .map((t) => t.toLowerCase())
                    .includes(postTagFilter);
                const searchable =
                  `${p.edited_title || p.generated_title || ""} ${p.raw_content || ""} ${p.generated_excerpt || ""} ${(p.tags || []).join(" ")}`.toLowerCase();
                const matchesSearch =
                  postSearch.trim() === "" ||
                  searchable.includes(postSearch.trim().toLowerCase());
                return (
                  matchesStatus &&
                  matchesPlatform &&
                  matchesTag &&
                  matchesSearch
                );
              });
              return (
                <div>
                  {/* Header Ricerca e Filtri */}
                  <div
                    style={{
                      marginBottom: "2rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <input
                      type="search"
                      value={postSearch}
                      placeholder="🔍 Cerca per titolo, testo o tag..."
                      aria-label="Cerca nei contenuti"
                      style={{
                        width: "100%",
                        border: "2px solid var(--border-strong)",
                        padding: "13px 18px",
                        borderRadius: "var(--radius-lg)",
                        background: "var(--surface)",
                        fontSize: "16px",
                      }}
                      onChange={(e) => setPostSearch(e.target.value)}
                    />

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={() => setDashboardFilter("all")}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "30px",
                          fontSize: "15px",
                          fontWeight: 600,
                          border: "none",
                          background:
                            dashboardFilter === "all"
                              ? "var(--primary)"
                              : "var(--surface)",
                          color:
                            dashboardFilter === "all" ? "white" : "var(--text)",
                          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                          cursor: "pointer",
                        }}
                      >
                        Tutti i contenuti
                      </button>
                      <button
                        onClick={() => setDashboardFilter("published-1")}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "30px",
                          fontSize: "15px",
                          fontWeight: 600,
                          border: "none",
                          background:
                            dashboardFilter === "published-1"
                              ? "var(--teal)"
                              : "var(--surface)",
                          color:
                            dashboardFilter === "published-1"
                              ? "white"
                              : "var(--text)",
                          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                          cursor: "pointer",
                        }}
                      >
                        Pubblicati
                      </button>
                      <button
                        onClick={() => setDashboardFilter("published-0")}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "30px",
                          fontSize: "15px",
                          fontWeight: 600,
                          border: "none",
                          background:
                            dashboardFilter === "published-0"
                              ? "var(--amber)"
                              : "var(--surface)",
                          color:
                            dashboardFilter === "published-0"
                              ? "white"
                              : "var(--text)",
                          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                          cursor: "pointer",
                        }}
                      >
                        Bozze / In elaborazione
                      </button>
                      <select
                        value={postPlatformFilter}
                        onChange={(e) => setPostPlatformFilter(e.target.value)}
                        aria-label="Filtra per canale"
                        style={{
                          minHeight: 40,
                          padding: "0 12px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: 10,
                          color: "var(--text)",
                          background: "var(--surface)",
                          fontWeight: 650,
                        }}
                      >
                        <option value="all">Tutti i canali</option>
                        {allPlatforms.map((platform) => (
                          <option key={platform} value={platform}>
                            {SOCIAL[platform]?.label || platform}
                          </option>
                        ))}
                      </select>
                      <select
                        value={postTagFilter}
                        onChange={(e) => setPostTagFilter(e.target.value)}
                        aria-label="Filtra per argomento"
                        style={{
                          minHeight: 40,
                          padding: "0 12px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: 10,
                          color: "var(--text)",
                          background: "var(--surface)",
                          fontWeight: 650,
                        }}
                      >
                        <option value="all">Tutti gli argomenti</option>
                        {allTags.map((tag) => (
                          <option key={tag} value={tag}>
                            {tag}
                          </option>
                        ))}
                      </select>
                      <div
                        role="group"
                        aria-label="Tipo di visualizzazione"
                        style={{
                          display: "flex",
                          padding: 3,
                          marginLeft: "auto",
                          border: "1px solid var(--border-strong)",
                          borderRadius: 10,
                          background: "var(--surface)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setViewMode("grid")}
                          aria-pressed={viewMode === "grid"}
                          style={{
                            padding: "7px 11px",
                            border: 0,
                            borderRadius: 7,
                            background:
                              viewMode === "grid"
                                ? "var(--primary)"
                                : "transparent",
                            color:
                              viewMode === "grid"
                                ? "#fff"
                                : "var(--text-muted)",
                            cursor: "pointer",
                            fontWeight: 750,
                          }}
                        >
                          ▦ Schede
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode("table")}
                          aria-pressed={viewMode === "table"}
                          style={{
                            padding: "7px 11px",
                            border: 0,
                            borderRadius: 7,
                            background:
                              viewMode === "table"
                                ? "var(--primary)"
                                : "transparent",
                            color:
                              viewMode === "table"
                                ? "#fff"
                                : "var(--text-muted)",
                            cursor: "pointer",
                            fontWeight: 750,
                          }}
                        >
                          ☷ Tabella
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        color: "var(--text-muted)",
                        fontSize: 12,
                        fontWeight: 650,
                      }}
                    >
                      {filteredPosts.length} di {posts.length} contenuti
                    </div>
                  </div>

                  {/* Azioni Veloci */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginBottom: "2rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <a
                      href={siteUrl}
                      target="_blank"
                      rel="noopener"
                      className="btn btn-primary"
                      style={{
                        padding: "14px 24px",
                        fontSize: "16px",
                        fontWeight: 800,
                      }}
                    >
                      ↗ Apri il sito
                    </a>
                    {pendingPosts.length > 0 && (
                      <button
                        className="btn btn-outline"
                        onClick={() => processPendingLoop(false)}
                        style={{
                          padding: "14px 24px",
                          fontSize: "16px",
                          fontWeight: 800,
                        }}
                      >
                        ↻ Elabora {pendingPosts.length} nuovi arrivi
                      </button>
                    )}
                    {selectedPosts.length > 0 && (
                      <button
                        onClick={bulkDeletePosts}
                        style={{
                          background: "var(--red)",
                          color: "white",
                          border: "none",
                          padding: "14px 24px",
                          borderRadius: "var(--radius)",
                          fontSize: "16px",
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                      >
                        🗑 Elimina {selectedPosts.length} selezionati
                      </button>
                    )}
                  </div>

                  {/* Lista contenuti */}
                  {filteredPosts.length === 0 ? (
                    <div
                      className="card"
                      style={{
                        textAlign: "center",
                        color: "var(--text-muted)",
                        padding: "4rem 2rem",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "64px",
                          marginBottom: "1rem",
                          opacity: 0.5,
                        }}
                      >
                        📭
                      </div>
                      <h3
                        style={{
                          fontSize: "24px",
                          fontWeight: 800,
                          color: "var(--text)",
                        }}
                      >
                        Nessun contenuto trovato
                      </h3>
                      <p style={{ fontSize: "18px", marginTop: "0.5rem" }}>
                        Non ci sono articoli per i filtri selezionati.
                      </p>
                    </div>
                  ) : viewMode === "table" ? (
                    <div
                      className="card"
                      style={{
                        overflowX: "auto",
                        border: "1px solid var(--border-strong)",
                        padding: 0,
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          minWidth: 880,
                          borderCollapse: "collapse",
                          color: "var(--text)",
                          background: "var(--surface)",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: "var(--bg)",
                              borderBottom: "1px solid var(--border-strong)",
                            }}
                          >
                            <th
                              style={{
                                width: 46,
                                padding: "13px 14px",
                                textAlign: "center",
                              }}
                            >
                              <input
                                type="checkbox"
                                aria-label="Seleziona tutti i contenuti filtrati"
                                checked={
                                  filteredPosts.length > 0 &&
                                  filteredPosts.every((post) =>
                                    selectedPosts.includes(post.id),
                                  )
                                }
                                onChange={(event) =>
                                  setSelectedPosts((previous) =>
                                    event.target.checked
                                      ? [
                                          ...new Set([
                                            ...previous,
                                            ...filteredPosts.map(
                                              (post) => post.id,
                                            ),
                                          ]),
                                        ]
                                      : previous.filter(
                                          (id) =>
                                            !filteredPosts.some(
                                              (post) => post.id === id,
                                            ),
                                        ),
                                  )
                                }
                              />
                            </th>
                            {[
                              "Canale",
                              "Titolo",
                              "Data",
                              "Stato",
                              "Azioni",
                            ].map((label) => (
                              <th
                                key={label}
                                style={{
                                  padding: "13px 14px",
                                  textAlign: "left",
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                  letterSpacing: ".05em",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPosts.map((post) => {
                            const title =
                              post.edited_title ||
                              post.generated_title ||
                              (post.raw_content
                                ? post.raw_content.substring(0, 80)
                                : "Nuovo contenuto");
                            const processing = Number(post.seo_score) < 0;
                            return (
                              <tr
                                key={post.id}
                                style={{
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "14px",
                                    textAlign: "center",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    aria-label={`Seleziona ${title}`}
                                    checked={selectedPosts.includes(post.id)}
                                    onChange={() =>
                                      togglePostSelection(post.id)
                                    }
                                  />
                                </td>
                                <td style={{ padding: "14px" }}>
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 8,
                                      fontWeight: 750,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    <SocialIcon
                                      platform={post.platform}
                                      size={20}
                                    />
                                    {SOCIAL[post.platform]?.label ||
                                      post.platform}
                                  </span>
                                </td>
                                <td style={{ padding: "14px", maxWidth: 360 }}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      !processing && openPostEditor(post)
                                    }
                                    disabled={processing}
                                    style={{
                                      border: 0,
                                      padding: 0,
                                      color: "var(--text)",
                                      background: "transparent",
                                      textAlign: "left",
                                      font: "inherit",
                                      fontWeight: 750,
                                      cursor: processing
                                        ? "default"
                                        : "pointer",
                                    }}
                                  >
                                    {title}
                                  </button>
                                </td>
                                <td
                                  style={{
                                    padding: "14px",
                                    color: "var(--text-muted)",
                                    whiteSpace: "nowrap",
                                    fontSize: 13,
                                  }}
                                >
                                  {post.published_at
                                    ? new Date(
                                        post.published_at,
                                      ).toLocaleDateString("it-IT")
                                    : "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "14px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {processing ? (
                                    <span
                                      className={`article-processing-badge ${postProcessingStatus(post) === "failed" ? "is-error" : ""}`}
                                    >
                                      {postProcessingLabel(post)}
                                    </span>
                                  ) : (
                                    <span
                                      className={`article-publication-status ${Number(post.published) === 1 ? "is-published" : "is-draft"}`}
                                    >
                                      {Number(post.published) === 1
                                        ? "Pubblicato"
                                        : "Bozza"}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  {processing ? (
                                    <button
                                      className="btn btn-outline"
                                      style={{
                                        padding: "8px 11px",
                                        fontSize: 12,
                                        whiteSpace: "nowrap",
                                      }}
                                      disabled={
                                        postProcessingStatus(post) ===
                                        "processing"
                                      }
                                      onClick={() => retryPendingPost(post.id)}
                                    >
                                      {postProcessingStatus(post) ===
                                      "processing"
                                        ? "In corso"
                                        : postProcessingStatus(post) ===
                                            "failed"
                                          ? "Riprova"
                                          : "Elabora"}
                                    </button>
                                  ) : (
                                    <div style={{ display: "flex", gap: 7 }}>
                                      <button
                                        onClick={() => openPostEditor(post)}
                                        className="btn btn-outline"
                                        style={{
                                          padding: "8px 11px",
                                          fontSize: 12,
                                        }}
                                      >
                                        Modifica
                                      </button>
                                      <button
                                        className={`article-publish-button ${Number(post.published) === 1 ? "is-published" : "is-draft"}`}
                                        style={{
                                          padding: "8px 11px",
                                          fontSize: 12,
                                        }}
                                        disabled={publishingPostId === post.id}
                                        onClick={() =>
                                          togglePublishPost(
                                            post.id,
                                            post.published,
                                          )
                                        }
                                      >
                                        {publishingPostId === post.id
                                          ? "Attendi…"
                                          : Number(post.published) === 1
                                            ? "Nascondi"
                                            : "Pubblica"}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(360px, 1fr))",
                        gap: "2rem",
                        width: "100%",
                      }}
                    >
                      {filteredPosts.map((post) => (
                        <div
                          key={post.id}
                          className="article-card"
                          style={{
                            border: "2px solid var(--border-strong)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
                          }}
                        >
                          {/* Header: Sorgente Social */}
                          <div
                            className="article-card-header"
                            style={{
                              padding: "16px 24px",
                              borderBottom: "1px solid var(--border-strong)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedPosts.includes(post.id)}
                                onChange={() => togglePostSelection(post.id)}
                                style={{
                                  transform: "scale(1.5)",
                                  cursor: "pointer",
                                  margin: 0,
                                }}
                              />
                              <div
                                style={{
                                  background: "var(--surface)",
                                  padding: "8px",
                                  borderRadius: "50%",
                                  boxShadow: "var(--shadow-sm)",
                                  flexShrink: 0,
                                  display: "flex",
                                }}
                              >
                                <SocialIcon
                                  platform={post.platform}
                                  size={24}
                                />
                              </div>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: "16px",
                                  color: "var(--text)",
                                  textTransform: "capitalize",
                                }}
                              >
                                {SOCIAL[post.platform]?.label || post.platform}
                              </span>
                            </div>

                            {/* Badge Stato (Nascoso/Bozza) */}
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                              }}
                            >
                              {Number(post.seo_score) < 0 ? (
                                <span
                                  className={`article-processing-badge ${postProcessingStatus(post) === "failed" ? "is-error" : ""}`}
                                  style={{
                                    fontSize: "12px",
                                    padding: "6px 12px",
                                  }}
                                >
                                  {postProcessingLabel(post)}
                                </span>
                              ) : (
                                <span
                                  className={`article-publication-status ${Number(post.published) === 1 ? "is-published" : "is-draft"}`}
                                  style={{
                                    fontSize: "12px",
                                    padding: "6px 12px",
                                  }}
                                >
                                  {Number(post.published) === 1
                                    ? "Pubblicato"
                                    : "Bozza"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Contenuto Testuale */}
                          <div
                            style={{
                              padding: "24px",
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            <h4
                              style={{
                                fontSize: "20px",
                                fontWeight: 800,
                                marginBottom: "16px",
                                lineHeight: 1.4,
                                color: "var(--text)",
                              }}
                            >
                              {post.edited_title ||
                                post.generated_title ||
                                (post.raw_content
                                  ? post.raw_content.substring(0, 80)
                                  : "Nuovo contenuto")}
                            </h4>
                            <div
                              style={{
                                fontSize: "16px",
                                color: "var(--text-muted)",
                                display: "-webkit-box",
                                WebkitLineClamp: 4,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                lineHeight: 1.6,
                                fontWeight: 500,
                              }}
                            >
                              {post.edited_excerpt ||
                                post.generated_excerpt ||
                                (post.edited_body
                                  ? post.edited_body
                                      .replace(/<[^>]*>?/gm, "")
                                      .substring(0, 200)
                                  : post.generated_body
                                    ? post.generated_body
                                        .replace(/<[^>]*>?/gm, "")
                                        .substring(0, 200)
                                    : Number(post.seo_score) < 0
                                      ? postProcessingStatus(post) === "failed"
                                        ? post.processing_error ||
                                          String(
                                            post.agent_notes || "",
                                          ).replace(/^Errore:\s*/, "")
                                        : postProcessingStatus(post) ===
                                            "processing"
                                          ? "Creazione articolo in corso."
                                          : "Contenuto acquisito, pronto per essere elaborato."
                                      : "")}
                            </div>
                          </div>

                          {/* Azioni Fondo Card */}
                          <div
                            className="article-card-footer"
                            style={{
                              padding: "20px 24px",
                              background: "var(--surface)",
                              borderTop: "1px solid var(--border)",
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "12px",
                            }}
                          >
                            {Number(post.seo_score) < 0 ? (
                              <button
                                className="btn btn-outline"
                                style={{
                                  gridColumn: "1 / -1",
                                  padding: "14px",
                                  fontSize: "15px",
                                }}
                                disabled={
                                  postProcessingStatus(post) === "processing"
                                }
                                onClick={() => retryPendingPost(post.id)}
                              >
                                {postProcessingStatus(post) === "processing"
                                  ? "⏳ In preparazione…"
                                  : postProcessingStatus(post) === "failed"
                                    ? "↻ Riprova"
                                    : "▶ Prepara articolo"}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => openPostEditor(post)}
                                  className="btn btn-outline"
                                  style={{ padding: "12px", fontSize: "15px" }}
                                >
                                  ✏️ Modifica
                                </button>
                                <button
                                  className={`article-publish-button ${Number(post.published) === 1 ? "is-published" : "is-draft"}`}
                                  style={{
                                    padding: "12px",
                                    fontSize: "15px",
                                    gridColumn: "span 1",
                                  }}
                                  disabled={publishingPostId === post.id}
                                  onClick={() =>
                                    togglePublishPost(post.id, post.published)
                                  }
                                >
                                  {publishingPostId === post.id
                                    ? "Attendi…"
                                    : Number(post.published) === 1
                                      ? "Nascondi"
                                      : "Pubblica"}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Tab: SEO */}
          {tab === "seo" && (
            <div>
              {/* Interruttore principale: se è spento, tutto il resto di questa
                scheda non produce risultati su Google. Va quindi in cima. */}
              <div
                className={`search-visibility-card ${Number(site?.search_visible) === 0 ? "is-off" : "is-on"}`}
              >
                <div className="search-visibility-copy">
                  <h3>Fatti trovare da Google</h3>
                  <p>
                    {Number(site?.search_visible) === 0
                      ? "Il sito è online e raggiungibile da chi ha il link, ma chiede ai motori di ricerca di non indicizzarlo. Attivalo quando i contenuti sono pronti."
                      : "Il sito è aperto ai motori di ricerca: pagine e articoli possono comparire nei risultati e sono elencati nella sitemap."}
                  </p>
                </div>
                <label className="search-visibility-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={Number(site?.search_visible) !== 0}
                    disabled={savingSearchVisible}
                    onChange={(e) => toggleSearchVisible(e.target.checked)}
                  />
                  <span className="search-visibility-track" aria-hidden="true">
                    <span className="search-visibility-thumb" />
                  </span>
                  <span className="search-visibility-state">
                    {savingSearchVisible
                      ? "Salvataggio…"
                      : Number(site?.search_visible) === 0
                        ? "Nascosto"
                        : "Visibile"}
                  </span>
                </label>
              </div>

              {visibilitySection !== "ideas" && isAdmin && (
                <div className="visibility-subnav">
                  {[
                    ["overview", "Panoramica Prestazioni"],
                    ["network", "Rete e Presenza"],
                    ["lab", "Laboratorio"],
                  ].map(([section, label]) => (
                    <button
                      key={section}
                      className={
                        visibilitySection === section ? "is-active" : ""
                      }
                      onClick={() => setVisibilitySection(section)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {isAdmin && visibilitySection === "lab" && (
                <SpazioVivoLab token={token} adminPreview />
              )}

              {false && tab === "seo" && visibilitySection === "network" && (
                <>
                  <section
                    className="glass-modal"
                    style={{
                      marginBottom: "1.25rem",
                      padding: "clamp(1.25rem, 3vw, 2rem)",
                      color: "#fff",
                      background:
                        "radial-gradient(circle at 88% 8%, rgba(243,92,118,.34), transparent 27%), linear-gradient(135deg,#151A2D,#292359 68%,#48257A)",
                      border: "none",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="reachability-hero-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0,1fr) auto",
                        alignItems: "center",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#D9CEFF",
                            fontSize: "12px",
                            fontWeight: 850,
                            letterSpacing: ".1em",
                            textTransform: "uppercase",
                          }}
                        >
                          All Social To Web · controllo continuo
                        </div>
                        <h2
                          style={{
                            margin: ".45rem 0 .65rem",
                            color: "#fff",
                            fontSize: "clamp(25px,4vw,40px)",
                            letterSpacing: "-.04em",
                          }}
                        >
                          Network della Reperibilità
                        </h2>
                        <p
                          style={{
                            maxWidth: "720px",
                            margin: 0,
                            color: "rgba(255,255,255,.76)",
                            lineHeight: 1.65,
                          }}
                        >
                          Unisce Spazio Vivo, sito ufficiale, social e motori di
                          ricerca. Verifica ciò che è pubblicato, collegato,
                          rilevato e capace di generare un’azione.
                        </p>
                        <span
                          style={{
                            display: "inline-flex",
                            marginTop: ".85rem",
                            padding: ".4rem .7rem",
                            borderRadius: "999px",
                            background: "rgba(255,255,255,.11)",
                            border: "1px solid rgba(255,255,255,.2)",
                            color: "#fff",
                            fontSize: "11px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: ".06em",
                          }}
                        >
                          Fase attuale ·{" "}
                          {reachability.stage || "configurazione"}
                        </span>
                      </div>
                      <div
                        style={{
                          width: "132px",
                          height: "132px",
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          textAlign: "center",
                          background: `conic-gradient(#8E7CFF ${Number(reachability.score || 0) * 3.6}deg, rgba(255,255,255,.12) 0)`,
                          boxShadow: "inset 0 0 0 12px rgba(17,20,39,.72)",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              display: "block",
                              fontSize: "34px",
                              lineHeight: 1,
                            }}
                          >
                            {reachability.score || 0}
                          </strong>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "rgba(255,255,255,.7)",
                            }}
                          >
                            / 100 verificato
                          </span>
                        </div>
                      </div>
                    </div>
                    <div
                      className="reachability-funnel"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4,minmax(120px,1fr))",
                        gap: "8px",
                        marginTop: "1.5rem",
                      }}
                    >
                      {[
                        [
                          "Pubblicato",
                          reachability.published_pages || 0,
                          (reachability.published_pages || 0) > 0,
                        ],
                        [
                          "Rilevato da Google",
                          reachability.google_visible_pages || 0,
                          (reachability.google_visible_pages || 0) > 0,
                        ],
                        [
                          "Clic ottenuti",
                          reachability.clicks || 0,
                          (reachability.clicks || 0) > 0,
                        ],
                        [
                          "Azioni generate",
                          reachability.actions || 0,
                          (reachability.actions || 0) > 0,
                        ],
                      ].map(([label, value, active]) => (
                        <div
                          key={label}
                          style={{
                            padding: "1rem",
                            borderRadius: "14px",
                            background: active
                              ? "rgba(255,255,255,.15)"
                              : "rgba(255,255,255,.07)",
                            border: `1px solid ${active ? "rgba(217,206,255,.5)" : "rgba(255,255,255,.1)"}`,
                          }}
                        >
                          <strong
                            style={{ display: "block", fontSize: "24px" }}
                          >
                            {value}
                          </strong>
                          <span
                            style={{
                              color: "rgba(255,255,255,.7)",
                              fontSize: "11px",
                            }}
                          >
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))",
                      gap: "1.25rem",
                      alignItems: "start",
                    }}
                  >
                    <section
                      className="glass-modal"
                      style={{ padding: "1.5rem" }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--primary)",
                          fontWeight: 850,
                          textTransform: "uppercase",
                          letterSpacing: ".08em",
                        }}
                      >
                        Stato verificabile
                      </div>
                      <h3
                        style={{
                          margin: ".4rem 0 .35rem",
                          color: "var(--text)",
                        }}
                      >
                        Cosa rende trovabile la tua presenza
                      </h3>
                      <p
                        style={{
                          margin: "0 0 1.15rem",
                          color: "var(--text-muted)",
                          fontSize: "13px",
                          lineHeight: 1.55,
                        }}
                      >
                        Ogni voce completata corrisponde a un segnale reale, non
                        a una promessa di posizione.
                      </p>
                      <div style={{ display: "grid", gap: ".65rem" }}>
                        {(reachability.checks || []).map((check) => (
                          <div
                            key={check.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "32px 1fr",
                              gap: ".75rem",
                              alignItems: "center",
                              padding: ".8rem",
                              borderRadius: "12px",
                              border: "1px solid var(--border)",
                              background: check.done
                                ? "var(--teal-light)"
                                : "var(--bg)",
                            }}
                          >
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                display: "grid",
                                placeItems: "center",
                                borderRadius: "50%",
                                background: check.done
                                  ? "var(--teal)"
                                  : "var(--border)",
                                color: check.done
                                  ? "#fff"
                                  : "var(--text-muted)",
                                fontWeight: 900,
                              }}
                            >
                              {check.done ? "✓" : "·"}
                            </div>
                            <div>
                              <strong
                                style={{
                                  display: "block",
                                  color: "var(--text)",
                                  fontSize: "13px",
                                }}
                              >
                                {check.label}
                              </strong>
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: "11px",
                                  lineHeight: 1.35,
                                }}
                              >
                                {check.detail}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section
                      className="glass-modal"
                      style={{
                        padding: "1.5rem",
                        border: "1px solid var(--primary)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--primary)",
                          fontWeight: 850,
                          textTransform: "uppercase",
                          letterSpacing: ".08em",
                        }}
                      >
                        Punto centrale
                      </div>
                      <h3
                        style={{
                          margin: ".4rem 0 .35rem",
                          color: "var(--text)",
                        }}
                      >
                        Collega la tua presenza ufficiale
                      </h3>
                      <p
                        style={{
                          margin: "0 0 1.2rem",
                          color: "var(--text-muted)",
                          fontSize: "13px",
                          lineHeight: 1.55,
                        }}
                      >
                        Questi riferimenti permettono di costruire un’identità
                        coerente tra sito, Spazio Vivo, social e presenza
                        locale.
                      </p>
                      <label
                        style={{ display: "block", marginBottom: ".9rem" }}
                      >
                        <span
                          style={{
                            display: "block",
                            marginBottom: ".35rem",
                            fontSize: "12px",
                            fontWeight: 750,
                          }}
                        >
                          Sito ufficiale
                        </span>
                        <input
                          value={reachabilityDraft.official_site_url || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              official_site_url: e.target.value,
                            }))
                          }
                          placeholder="https://www.tuodominio.it"
                          style={{
                            width: "100%",
                            padding: "11px 13px",
                            borderRadius: "10px",
                            border: "1px solid var(--border-strong)",
                            background: "var(--bg)",
                            color: "var(--text)",
                          }}
                        />
                      </label>
                      <label
                        style={{ display: "block", marginBottom: ".9rem" }}
                      >
                        <span
                          style={{
                            display: "block",
                            marginBottom: ".35rem",
                            fontSize: "12px",
                            fontWeight: 750,
                          }}
                        >
                          Profilo Google dell’attività
                        </span>
                        <input
                          value={reachabilityDraft.business_profile_url || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              business_profile_url: e.target.value,
                            }))
                          }
                          placeholder="Link Google Maps o Business Profile"
                          style={{
                            width: "100%",
                            padding: "11px 13px",
                            borderRadius: "10px",
                            border: "1px solid var(--border-strong)",
                            background: "var(--bg)",
                            color: "var(--text)",
                          }}
                        />
                      </label>
                      <label
                        style={{ display: "block", marginBottom: ".9rem" }}
                      >
                        <span
                          style={{
                            display: "block",
                            marginBottom: ".35rem",
                            fontSize: "12px",
                            fontWeight: 750,
                          }}
                        >
                          Per cosa vuoi essere trovato principalmente?
                        </span>
                        <input
                          value={reachabilityDraft.primary_topic || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              primary_topic: e.target.value,
                            }))
                          }
                          placeholder="Es. agriturismo con ristorante vicino Roma"
                          style={{
                            width: "100%",
                            padding: "11px 13px",
                            borderRadius: "10px",
                            border: "1px solid var(--border-strong)",
                            background: "var(--bg)",
                            color: "var(--text)",
                          }}
                        />
                      </label>
                      <div
                        style={{
                          margin: "1.25rem 0 .9rem",
                          paddingTop: "1rem",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 800,
                            color: "var(--primary)",
                            textTransform: "uppercase",
                            letterSpacing: ".05em",
                          }}
                        >
                          Come farsi contattare
                        </div>
                        <p
                          style={{
                            margin: ".35rem 0 0",
                            fontSize: "12.5px",
                            lineHeight: 1.55,
                            color: "var(--text-muted)",
                          }}
                        >
                          Compaiono in fondo a ogni articolo, dove atterra chi
                          arriva da una ricerca su Google. Vengono mostrati solo
                          i campi compilati: quelli vuoti non generano pulsanti.
                        </p>
                      </div>
                      <label
                        style={{ display: "block", marginBottom: ".9rem" }}
                      >
                        <span
                          style={{
                            display: "block",
                            marginBottom: ".35rem",
                            fontSize: "12px",
                            fontWeight: 750,
                          }}
                        >
                          Telefono
                        </span>
                        <input
                          value={reachabilityDraft.phone || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="+39 06 1234567"
                          style={{
                            width: "100%",
                            padding: "11px 13px",
                            borderRadius: "10px",
                            border: "1px solid var(--border-strong)",
                            background: "var(--bg)",
                            color: "var(--text)",
                          }}
                        />
                      </label>
                      <label
                        style={{ display: "block", marginBottom: ".9rem" }}
                      >
                        <span
                          style={{
                            display: "block",
                            marginBottom: ".35rem",
                            fontSize: "12px",
                            fontWeight: 750,
                          }}
                        >
                          WhatsApp
                        </span>
                        <input
                          value={reachabilityDraft.whatsapp || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              whatsapp: e.target.value,
                            }))
                          }
                          placeholder="340 1234567"
                          style={{
                            width: "100%",
                            padding: "11px 13px",
                            borderRadius: "10px",
                            border: "1px solid var(--border-strong)",
                            background: "var(--bg)",
                            color: "var(--text)",
                          }}
                        />
                      </label>
                      <label
                        style={{ display: "block", marginBottom: ".9rem" }}
                      >
                        <span
                          style={{
                            display: "block",
                            marginBottom: ".35rem",
                            fontSize: "12px",
                            fontWeight: 750,
                          }}
                        >
                          Email
                        </span>
                        <input
                          type="email"
                          value={reachabilityDraft.email || ""}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="info@tuodominio.it"
                          style={{
                            width: "100%",
                            padding: "11px 13px",
                            borderRadius: "10px",
                            border: "1px solid var(--border-strong)",
                            background: "var(--bg)",
                            color: "var(--text)",
                          }}
                        />
                      </label>
                      <label
                        style={{ display: "block", marginBottom: ".9rem" }}
                      >
                        <span
                          style={{
                            display: "block",
                            marginBottom: ".35rem",
                            fontSize: "12px",
                            fontWeight: 750,
                          }}
                        >
                          Territori serviti · uno per riga
                        </span>
                        <textarea
                          value={(reachabilityDraft.service_areas || []).join(
                            "\n",
                          )}
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              service_areas: e.target.value.split("\n"),
                            }))
                          }
                          placeholder={"Roma\nCastelli Romani\nLazio"}
                          rows={3}
                          style={{
                            width: "100%",
                            padding: "11px 13px",
                            borderRadius: "10px",
                            border: "1px solid var(--border-strong)",
                            background: "var(--bg)",
                            color: "var(--text)",
                            resize: "vertical",
                          }}
                        />
                      </label>
                      <label
                        style={{
                          display: "flex",
                          gap: ".65rem",
                          alignItems: "flex-start",
                          padding: ".85rem",
                          borderRadius: "11px",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          fontSize: "12px",
                          lineHeight: 1.45,
                          marginBottom: "1rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            !!reachabilityDraft.reciprocal_link_confirmed
                          }
                          onChange={(e) =>
                            setReachabilityDraft((prev) => ({
                              ...prev,
                              reciprocal_link_confirmed: e.target.checked,
                            }))
                          }
                          style={{ marginTop: "2px" }}
                        />
                        <span>
                          Ho inserito nel sito ufficiale un collegamento allo
                          Spazio Vivo. Questo crea un ponte percorribile in
                          entrambe le direzioni.
                        </span>
                      </label>
                      <button
                        className="btn btn-primary"
                        onClick={saveReachabilityNetwork}
                        disabled={savingReachability}
                        style={{ width: "100%", justifyContent: "center" }}
                      >
                        {savingReachability
                          ? "Aggiornamento…"
                          : "Aggiorna il Network"}
                      </button>
                    </section>
                  </div>
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "1rem 1.15rem",
                      borderRadius: "14px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-muted)",
                      fontSize: "12px",
                      lineHeight: 1.55,
                    }}
                  >
                    <strong style={{ color: "var(--text)" }}>
                      Garanzia operativa:
                    </strong>{" "}
                    All Social To Web può garantire pubblicazione,
                    accessibilità, collegamenti, segnali tecnici e monitoraggio.
                    L’indicizzazione e la posizione finale restano decisioni dei
                    motori di ricerca.
                  </div>
                </>
              )}

              {visibilitySection === "overview" && (
                <div
                  className="data-workspace"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "2rem",
                  }}
                >
                  <section
                    className="data-hero"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--primary), #6366f1)",
                      color: "white",
                      padding: "2.5rem",
                      borderRadius: "var(--radius-lg)",
                      boxShadow: "0 8px 32px rgba(79,140,255,0.28)",
                    }}
                  >
                    <div>
                      <span
                        className="section-eyebrow"
                        style={{ color: "rgba(255,255,255,0.8)" }}
                      >
                        Monitoraggio Semplificato
                      </span>
                      <h2
                        style={{
                          color: "white",
                          margin: "0.5rem 0",
                          fontSize: "clamp(24px, 4vw, 36px)",
                        }}
                      >
                        Come stanno andando i tuoi contenuti
                      </h2>
                      <p
                        style={{
                          color: "rgba(255,255,255,0.9)",
                          fontSize: "16px",
                        }}
                      >
                        Ecco una panoramica chiara dei risultati che stai
                        ottenendo negli ultimi 30 giorni.
                      </p>
                    </div>
                  </section>

                  <section
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "1.5rem",
                    }}
                  >
                    {[
                      {
                        value: Number(
                          visibility.impressions || 0,
                        ).toLocaleString("it-IT"),
                        label: "Visualizzazioni su Google",
                        icon: (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        ),
                        desc: "Quante volte i tuoi contenuti sono apparsi nelle ricerche",
                      },
                      {
                        value: Number(visibility.clicks || 0).toLocaleString(
                          "it-IT",
                        ),
                        label: "Clic da Google",
                        icon: (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
                            <path d="M13 13l6 6"></path>
                          </svg>
                        ),
                        desc: "Quante persone hanno cliccato per leggere di piu",
                      },
                      {
                        value: Number(
                          visibility.unique_visitors || 0,
                        ).toLocaleString("it-IT"),
                        label: "Visitatori del Sito",
                        icon: (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                          </svg>
                        ),
                        desc: "Persone che hanno navigato nel tuo sito web",
                      },
                      {
                        value: Number(visibility.actions || 0).toLocaleString(
                          "it-IT",
                        ),
                        label: "Azioni e Contatti",
                        icon: (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="6"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                          </svg>
                        ),
                        desc: "Telefonate, messaggi e clic sui bottoni di contatto",
                      },
                    ].map((metric) => (
                      <article
                        key={metric.label}
                        className="card"
                        style={{
                          padding: "1.5rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "2rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "48px",
                            height: "48px",
                            background: "var(--bg)",
                            borderRadius: "12px",
                            color: "var(--primary)",
                          }}
                        >
                          {metric.icon}
                        </div>
                        <strong
                          style={{
                            fontSize: "2.5rem",
                            lineHeight: "1.2",
                            color: "var(--text)",
                          }}
                        >
                          {metric.value}
                        </strong>
                        <h3
                          style={{
                            fontSize: "1.1rem",
                            margin: 0,
                            color: "var(--text)",
                          }}
                        >
                          {metric.label}
                        </h3>
                        <p
                          style={{
                            fontSize: "0.9rem",
                            color: "var(--text-muted)",
                            margin: 0,
                          }}
                        >
                          {metric.desc}
                        </p>
                      </article>
                    ))}
                  </section>

                  {visibility.event_counts &&
                    Object.keys(visibility.event_counts).length > 0 && (
                      <section
                        className="card"
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <header style={{ marginBottom: "1.5rem" }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: "1.25rem",
                              color: "var(--text)",
                            }}
                          >
                            Cosa interessa di piu ai tuoi visitatori
                          </h3>
                          <p
                            style={{
                              color: "var(--text-muted)",
                              margin: "0.5rem 0 0",
                              fontSize: "14px",
                            }}
                          >
                            Scopri esattamente quali azioni compiono le persone
                            quando arrivano sui tuoi contenuti.
                          </p>
                        </header>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: "1rem",
                          }}
                        >
                          {[
                            [
                              "Letture di contenuti",
                              visibility.event_counts?.path_content_click || 0,
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                              </svg>,
                            ],
                            [
                              "Clic sul Telefono",
                              visibility.event_counts?.call_click || 0,
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                              </svg>,
                            ],
                            [
                              "Clic su WhatsApp",
                              visibility.event_counts?.whatsapp_click || 0,
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                              </svg>,
                            ],
                            [
                              "Clic su Indicazioni stradali",
                              visibility.event_counts?.directions_click || 0,
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                              </svg>,
                            ],
                            [
                              "Clic su Prenota",
                              visibility.event_counts?.booking_click || 0,
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect
                                  x="3"
                                  y="4"
                                  width="18"
                                  height="18"
                                  rx="2"
                                  ry="2"
                                ></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                              </svg>,
                            ],
                            [
                              "Visite ai Social",
                              visibility.event_counts?.social_click || 0,
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                              </svg>,
                            ],
                          ]
                            .filter((item) => item[1] > 0)
                            .map(([label, count, icon]) => (
                              <div
                                key={label}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "1rem",
                                  padding: "1rem",
                                  background: "var(--bg)",
                                  borderRadius: "var(--radius)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "1.5rem",
                                    display: "flex",
                                    color: "var(--primary)",
                                  }}
                                >
                                  {icon}
                                </div>
                                <div>
                                  <strong
                                    style={{
                                      display: "block",
                                      fontSize: "1.25rem",
                                      color: "var(--text)",
                                    }}
                                  >
                                    {count}
                                  </strong>
                                  <span
                                    style={{
                                      fontSize: "13px",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {label}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </section>
                    )}

                  {visibility.top_queries &&
                    visibility.top_queries.length > 0 && (
                      <section className="card">
                        <header style={{ marginBottom: "1.5rem" }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: "1.25rem",
                              color: "var(--text)",
                            }}
                          >
                            Cosa cercano le persone su Google
                          </h3>
                          <p
                            style={{
                              color: "var(--text-muted)",
                              margin: "0.5rem 0 0",
                              fontSize: "14px",
                            }}
                          >
                            Le parole esatte che hanno portato visitatori sul
                            tuo sito negli ultimi 30 giorni.
                          </p>
                        </header>
                        <div style={{ display: "grid", gap: "0.5rem" }}>
                          {visibility.top_queries.slice(0, 5).map((q) => (
                            <div
                              key={q.query}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "1rem",
                                background: "var(--bg)",
                                borderRadius: "var(--radius)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: "var(--text)",
                                }}
                              >
                                {q.query}
                              </span>
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: "14px",
                                }}
                              >
                                {q.clicks} clic
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                  <section
                    className="data-panel map-panel card"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <header
                      className="map-heading"
                      style={{ marginBottom: "1.5rem" }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "1.25rem",
                            color: "var(--text)",
                          }}
                        >
                          Mappa della presenza online
                        </h3>
                        <p
                          style={{
                            color: "var(--text-muted)",
                            margin: "0.5rem 0 0",
                            fontSize: "14px",
                          }}
                        >
                          Come i vari contenuti sono collegati tra loro per
                          farti trovare dai motori di ricerca.
                        </p>
                      </div>
                    </header>
                    <div
                      className="map-legend"
                      style={{ marginBottom: "1rem" }}
                    >
                      <span>
                        <i className="legend-hub" />
                        Hub pubblico
                      </span>
                      <span>
                        <i className="legend-space" />
                        Spazio Vivo
                      </span>
                      <span>
                        <i className="legend-page" />
                        Pagine e articoli
                      </span>
                    </div>
                    <SiteMapGraph
                      posts={posts}
                      siteUrl={siteUrl}
                      siteTitle={data?.site?.title || user?.name || user?.slug}
                      foundationPages={seoFoundation.pages || []}
                    />
                  </section>

                  {!isBasePlan && (
                    <section
                      className="card"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <header style={{ marginBottom: "1.5rem" }}>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "1.25rem",
                            color: "var(--text)",
                          }}
                        >
                          Struttura e Pagine fondamentali
                        </h3>
                        <p
                          style={{
                            color: "var(--text-muted)",
                            margin: "0.5rem 0 0",
                            fontSize: "14px",
                          }}
                        >
                          Il tuo sito ha{" "}
                          <strong>{networkPublishedPages}</strong> pagine
                          pubbliche.{" "}
                          {reachability.google?.has_evidence
                            ? `Di queste, Google ne ha gia rilevate ${reachability.google?.visible_pages || visibility.visible_pages || 0}.`
                            : "Stiamo raccogliendo i dati sulla copertura Google."}
                        </p>
                      </header>
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <a
                          href={`${siteUrl}/sitemap.xml`}
                          target="_blank"
                          rel="noopener"
                          className="btn btn-outline"
                        >
                          Apri la sitemap XML
                        </a>
                        <button
                          className="btn btn-outline"
                          onClick={() => generateSeoPreview()}
                          disabled={loadingPreview}
                        >
                          {loadingPreview
                            ? "Generazione anteprima..."
                            : "Rigenera pagine fondamentali"}
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              )}

              {false && visibilitySection === "overview" && (
                <>
                  <div
                    className="glass-modal"
                    style={{ marginBottom: "1.5rem", padding: "1.5rem" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: "0 0 0.45rem",
                            color: "var(--primary)",
                          }}
                        >
                          🌐 La rete sta distribuendo i tuoi contenuti
                        </h3>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            color: "var(--text-muted)",
                            lineHeight: 1.65,
                            maxWidth: "700px",
                          }}
                        >
                          Il tuo Spazio Vivo e i suoi contenuti sono collegati
                          alla rete pubblica All Social To Web. Ogni nuovo
                          contenuto entra automaticamente nella rete, senza
                          configurazioni da parte tua.
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "9px 13px",
                          borderRadius: "999px",
                          background: "var(--teal-light)",
                          color: "var(--teal)",
                          fontSize: "12px",
                          fontWeight: 800,
                        }}
                      >
                        Attivo
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "0.75rem",
                        marginTop: "1.25rem",
                      }}
                    >
                      {[
                        ["Pagine nella rete", networkPublishedPages],
                        [
                          "Viste su Google · 30 giorni",
                          Number(visibility.impressions || 0).toLocaleString(
                            "it-IT",
                          ),
                        ],
                        [
                          "Clic da Google · 30 giorni",
                          Number(visibility.clicks || 0).toLocaleString(
                            "it-IT",
                          ),
                        ],
                        [
                          "Visite allo Spazio Vivo · 30 giorni",
                          Number(
                            visibility.unique_visitors || 0,
                          ).toLocaleString("it-IT"),
                        ],
                        [
                          "Azioni verso l’attività",
                          Number(visibility.actions || 0).toLocaleString(
                            "it-IT",
                          ),
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          style={{
                            padding: "1rem",
                            borderRadius: "12px",
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "26px",
                              fontWeight: 850,
                              color: "var(--text)",
                            }}
                          >
                            {value}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--text-muted)",
                              marginTop: "4px",
                            }}
                          >
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginTop: "1.2rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <a
                        href="/scopri"
                        target="_blank"
                        rel="noopener"
                        className="btn btn-outline"
                        style={{ textDecoration: "none" }}
                      >
                        Apri la rete pubblica
                      </a>
                      <a
                        href={`${siteUrl}/sitemap.xml`}
                        target="_blank"
                        rel="noopener"
                        className="btn btn-outline"
                        style={{ textDecoration: "none" }}
                      >
                        Vedi elenco pagine
                      </a>
                    </div>
                  </div>

                  <div
                    className="glass-modal"
                    style={{ marginBottom: "1.5rem", padding: "1.5rem" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <h3
                          style={{ margin: "0 0 0.4rem", color: "var(--text)" }}
                        >
                          Pagine fondamentali gestite dal sistema
                        </h3>
                        <p
                          style={{
                            margin: 0,
                            color: "var(--text-muted)",
                            fontSize: "14px",
                            lineHeight: 1.6,
                            maxWidth: "680px",
                          }}
                        >
                          Il sistema crea pagine sostenute da informazioni reali
                          nei contenuti. Le conferme raccolte nel Profilo
                          guidato le rendono ancora più mirate.
                        </p>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={rebuildSeoFoundation}
                        disabled={savingProfile}
                      >
                        {savingProfile
                          ? "Aggiornamento…"
                          : "Aggiorna pagine SEO"}
                      </button>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "1.2rem",
                      }}
                    >
                      {(seoFoundation.pages || []).map((page) => (
                        <a
                          key={page.slug}
                          href={`${siteUrl}/${page.slug}`}
                          target="_blank"
                          rel="noopener"
                          style={{
                            padding: "9px 12px",
                            borderRadius: "999px",
                            background: "var(--primary-light)",
                            color: "var(--primary)",
                            fontWeight: 750,
                            fontSize: "13px",
                            textDecoration: "none",
                          }}
                        >
                          {page.title}
                        </a>
                      ))}
                      {!(seoFoundation.pages || []).length && (
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "14px",
                          }}
                        >
                          Le prime pagine saranno create dopo l’analisi dei
                          contenuti.
                        </span>
                      )}
                    </div>
                    {!!site?.seo_foundation_updated_at && (
                      <div
                        style={{
                          marginTop: "0.9rem",
                          color: "var(--text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        Ultimo aggiornamento:{" "}
                        {new Date(
                          site.seo_foundation_updated_at,
                        ).toLocaleString("it-IT")}
                      </div>
                    )}
                  </div>

                  <div
                    className="glass-modal"
                    style={{ marginBottom: "1.5rem", padding: "1.5rem" }}
                  >
                    <h3 style={{ margin: "0 0 0.4rem", color: "var(--text)" }}>
                      🕸️ Mappa del tuo spazio nella rete
                    </h3>
                    <p
                      style={{
                        margin: "0 0 1rem",
                        color: "var(--text-muted)",
                        fontSize: "14px",
                      }}
                    >
                      Questa è la struttura che rende i contenuti raggiungibili
                      dal dominio principale fino ai singoli articoli.
                    </p>
                    <SiteMapGraph
                      posts={posts}
                      siteUrl={siteUrl}
                      siteTitle={data?.site?.title || user?.name || user?.slug}
                      foundationPages={seoFoundation.pages || []}
                    />
                  </div>
                </>
              )}

              {visibilitySection === "ideas" && (
                <div id="ideas" className="glass-modal ideas-panel">
                  <section className="ideas-quick-start">
                    <div>
                      <span className="section-eyebrow">Il tuo studio editoriale</span>
                      <h2>
                        Il prossimo contenuto parte da ciò che ti rende unico.
                      </h2>
                      <p>
                        L'AI incrocia attività, pubblico, contenuti esistenti,
                        ricerche Google e segnali di attualità pertinenti. Nulla
                        viene pubblicato senza conferma.
                      </p>
                    </div>
                    <div className="ideas-quick-actions">
                      <button
                        className="btn btn-primary"
                        onClick={generateAiContentIdeas}
                        disabled={generatingIdeas}
                      >
                        {generatingIdeas
                          ? "Cerco e genero…"
                          : "✦ Suggeriscimi 3 contenuti"}
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => setCustomIdeaOpen(true)}
                      >
                        + Crea da una mia idea
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          setDashboardFilter("published-0");
                          setTab("site");
                        }}
                      >
                        Vedi{" "}
                        {
                          posts.filter((post) => Number(post.published) === 0)
                            .length
                        }{" "}
                        bozze
                      </button>
                    </div>
                  </section>
                  <LiaKnowledge knowledge={knowledge} onProfile={() => { setTab('profile'); setProfileSubTab('who'); }} onSave={async updates => {
                    await apiFetch('/api/index.php?action=site-update', { method: 'POST', body: JSON.stringify({ site_understanding_corrections: { declared_strategy: updates } }) }, token);
                    setAiContentIdeas([]);
                    setIdeasGeneratedAt('');
                    await loadData();
                  }} />
                  <section className="editorial-brief" aria-labelledby="editorial-brief-title">
                    <h3 id="editorial-brief-title">Cosa prepariamo oggi?</h3>
                    <p>Il tema parte dalla profilazione. Aggiungi una priorità per questa sessione e LIA la userà per le prossime 3 proposte.</p>
                    <div className="editorial-brief-fields">
                      <label>Obiettivo<select value={editorialBrief.objective} onChange={event => setEditorialBrief({ ...editorialBrief, objective: event.target.value })}><option value="">Dal mio profilo</option><option>Far conoscere l’attività</option><option>Aiutare e informare il pubblico</option><option>Stimolare conversazioni</option><option>Generare contatti</option><option>Promuovere un prodotto o servizio</option></select></label>
                      <label>Canale<select value={editorialBrief.platform} onChange={event => setEditorialBrief({ ...editorialBrief, platform: event.target.value })}><option value="">Social e sito</option><option>Instagram</option><option>Facebook</option><option>LinkedIn</option><option>TikTok</option></select></label>
                      <label>Focus del momento<input value={editorialBrief.focus} maxLength={600} onChange={event => setEditorialBrief({ ...editorialBrief, focus: event.target.value })} placeholder="Un servizio, una domanda cliente, una novità…" /></label>
                    </div>
                    <p className="editorial-profile-context">Profilo di partenza: {declaredStrategy.activity_type || 'attività da chiarire'} · Pubblico: {declaredStrategy.primary_audience || 'da definire'} · Obiettivo: {declaredStrategy.primary_goal || 'da definire'}</p>
                    <button className="btn btn-primary" disabled={generatingIdeas} onClick={generateAiContentIdeas}>{generatingIdeas ? 'Preparo le proposte…' : 'Proponimi 3 contenuti per questo brief'}</button>
                  </section>
                  <div className="article-length-picker">
                    <div>
                      <strong>Lunghezza degli articoli AI</strong>
                      <span>
                        Compatto è il formato consigliato: più diretto e più
                        facile da leggere.
                      </span>
                    </div>
                    <div>
                      {[
                        ["brief", "Flash", "90–140 parole"],
                        ["compact", "Compatto", "180–280 parole"],
                        ["standard", "Standard", "320–450 parole"],
                        ["deep", "Approfondito", "550–750 parole"],
                        ["pillar", "Guida completa", "900–1.200 parole"],
                      ].map(([value, label, detail]) => (
                        <button
                          key={value}
                          className={articleLength === value ? "is-active" : ""}
                          onClick={() => setArticleLength(value)}
                        >
                          <strong>{label}</strong>
                          <small>{detail}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <header className="ideas-head">
                    <div>
                      <h3>Idee per il prossimo contenuto</h3>
                      <p>
                        Proposte costruite dai tuoi canali, dalle ricerche reali
                        su Google e dalle priorità che hai dichiarato. Per
                        ognuna puoi far scrivere l’AI, scrivere tu, o adattare
                        l’idea prima di partire. Niente viene pubblicato da
                        solo.
                      </p>
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={generateAiContentIdeas}
                      disabled={generatingIdeas}
                    >
                      {generatingIdeas ? "Generazione…" : "Genera altre 3 idee"}
                    </button>
                  </header>

                  {ideasGeneratedAt && (
                    <div className="ideas-research-status">
                      <strong>
                        AI aggiornata{" "}
                        {new Date(ideasGeneratedAt).toLocaleString("it-IT")}
                      </strong>
                      <span>
                        {ideasNewsSignals > 0
                          ? `${ideasNewsSignals} segnali recenti analizzati`
                          : "Profilo e dati interni analizzati · nessuna notizia pertinente forzata"}
                      </span>
                    </div>
                  )}

                  <ol className="ideas-list">
                    {contentIdeas.map((idea, index) => {
                      const inModifica = editingIdea?.index === index;
                      const occupato = preparingIdea !== -1;
                      const ideaKey = editorialIdeaKey(idea);
                      return (
                        <li
                          key={`${idea.title}-${index}`}
                          className={`idea-row ${inModifica ? "is-editing" : ""}`}
                        >
                          <div className="idea-rank">{index + 1}</div>
                          <div className="idea-main">
                            {inModifica ? (
                              <div className="idea-edit">
                                <label>
                                  <span>Titolo del contenuto</span>
                                  <input
                                    type="text"
                                    value={editingIdea.title}
                                    autoFocus
                                    onChange={(e) =>
                                      setEditingIdea({
                                        ...editingIdea,
                                        title: e.target.value,
                                      })
                                    }
                                    placeholder="Di cosa parla il contenuto"
                                  />
                                </label>
                                <label>
                                  <span>Cosa deve dire, in breve</span>
                                  <textarea
                                    rows={2}
                                    value={editingIdea.reason}
                                    onChange={(e) =>
                                      setEditingIdea({
                                        ...editingIdea,
                                        reason: e.target.value,
                                      })
                                    }
                                    placeholder="Il punto che vuoi far arrivare al lettore"
                                  />
                                </label>
                                <div className="idea-actions">
                                  <button
                                    className="btn btn-primary"
                                    disabled={occupato}
                                    onClick={() =>
                                      createIdeaDraft(
                                        {
                                          ...idea,
                                          title: editingIdea.title,
                                          reason: editingIdea.reason,
                                        },
                                        index,
                                        "ai",
                                      )
                                    }
                                  >
                                    ✨ Genera con l’AI
                                  </button>
                                  <button
                                    className="btn btn-outline"
                                    disabled={occupato}
                                    onClick={() =>
                                      createIdeaDraft(
                                        {
                                          ...idea,
                                          title: editingIdea.title,
                                          reason: editingIdea.reason,
                                        },
                                        index,
                                        "manual",
                                      )
                                    }
                                  >
                                    ✎ Scrivo io
                                  </button>
                                  <button
                                    className="btn btn-outline"
                                    disabled={occupato || generatingSocial}
                                    onClick={() =>
                                      generateSocialContent({
                                        ...idea,
                                        title: editingIdea.title,
                                        reason: editingIdea.reason,
                                      })
                                    }
                                  >
                                    Genera post social
                                  </button>
                                  <button
                                    className="btn btn-ghost"
                                    onClick={() => setEditingIdea(null)}
                                  >
                                    Annulla
                                  </button>
                                  <button
                                    className="btn btn-ghost idea-delete"
                                    disabled={
                                      occupato || dismissingIdeaKey === ideaKey
                                    }
                                    onClick={() => dismissContentIdea(idea)}
                                  >
                                    {dismissingIdeaKey === ideaKey
                                      ? "Elimino…"
                                      : "Elimina proposta"}
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
                                {(idea.hook || idea.format || idea.objective || idea.cta || idea.social_angle) && <dl className="idea-editorial-plan">{[['Obiettivo', idea.objective], ['Formato', idea.format], ['Apertura', idea.hook], ['Taglio social', idea.social_angle], ['Invito all’azione', idea.cta]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
                                <div className="idea-origin">
                                  Da: {idea.source}
                                  {idea.freshness ? ` · ${idea.freshness}` : ""}
                                  {idea.source_url ? (
                                    <>
                                      {" "}
                                      ·{" "}
                                      <a
                                        href={idea.source_url}
                                        target="_blank"
                                        rel="noopener"
                                      >
                                        vedi fonte
                                      </a>
                                    </>
                                  ) : null}
                                </div>
                                <div className="idea-actions">
                                  <button
                                    className="btn btn-primary"
                                    disabled={occupato}
                                    onClick={() =>
                                      createIdeaDraft(idea, index, "ai")
                                    }
                                  >
                                    {preparingIdea === index
                                      ? "Creo la bozza…"
                                      : "✨ Genera con l’AI"}
                                  </button>
                                  <button
                                    className="btn btn-outline"
                                    disabled={occupato}
                                    onClick={() =>
                                      createIdeaDraft(idea, index, "manual")
                                    }
                                  >
                                    ✎ Scrivo io
                                  </button>
                                  <button
                                    className="btn btn-outline"
                                    disabled={occupato || generatingSocial}
                                    onClick={() => generateSocialContent(idea)}
                                  >
                                    {generatingSocial
                                      ? "Preparo il social…"
                                      : "Genera post social"}
                                  </button>
                                  <button
                                    className="btn btn-ghost"
                                    disabled={occupato}
                                    onClick={() =>
                                      setEditingIdea({
                                        index,
                                        title: idea.title,
                                        reason: idea.reason,
                                      })
                                    }
                                  >
                                    Adatta l’idea
                                  </button>
                                  <button
                                    className="btn btn-ghost idea-delete"
                                    disabled={
                                      occupato || dismissingIdeaKey === ideaKey
                                    }
                                    onClick={() => dismissContentIdea(idea)}
                                  >
                                    {dismissingIdeaKey === ideaKey
                                      ? "Elimino…"
                                      : "Elimina"}
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
                        Ancora nessuna proposta: servono contenuti pubblicati o
                        il Profilo guidato compilato. Puoi comunque partire da
                        un’idea tua, qui sotto.
                      </li>
                    )}
                  </ol>

                  <div
                    className={`idea-custom ${customIdeaOpen ? "is-open" : ""}`}
                  >
                    {!customIdeaOpen ? (
                      <button
                        className="btn btn-outline idea-custom-toggle"
                        onClick={() => setCustomIdeaOpen(true)}
                      >
                        + Ho un’idea mia
                      </button>
                    ) : (
                      <div className="idea-edit">
                        <div className="idea-custom-title">La tua idea</div>
                        <label>
                          <span>Titolo del contenuto</span>
                          <input
                            type="text"
                            value={customIdea.title}
                            autoFocus
                            onChange={(e) =>
                              setCustomIdea({
                                ...customIdea,
                                title: e.target.value,
                              })
                            }
                            placeholder="Es. Come scegliere il materasso giusto per la lombalgia"
                          />
                        </label>
                        <label>
                          <span>Cosa deve dire, in breve</span>
                          <textarea
                            rows={2}
                            value={customIdea.reason}
                            onChange={(e) =>
                              setCustomIdea({
                                ...customIdea,
                                reason: e.target.value,
                              })
                            }
                            placeholder="Il punto che vuoi far arrivare al lettore"
                          />
                        </label>
                        <div className="idea-actions">
                          <button
                            className="btn btn-primary"
                            disabled={
                              preparingIdea !== -1 || !customIdea.title.trim()
                            }
                            onClick={() =>
                              createIdeaDraft(
                                {
                                  ...customIdea,
                                  type: "Idea tua",
                                  source: "Proposta manuale",
                                  priority: "Scelta da te",
                                },
                                -2,
                                "ai",
                              )
                            }
                          >
                            ✨ Genera con l’AI
                          </button>
                          <button
                            className="btn btn-outline"
                            disabled={
                              preparingIdea !== -1 || !customIdea.title.trim()
                            }
                            onClick={() =>
                              createIdeaDraft(
                                {
                                  ...customIdea,
                                  type: "Idea tua",
                                  source: "Proposta manuale",
                                  priority: "Scelta da te",
                                },
                                -2,
                                "manual",
                              )
                            }
                          >
                            ✎ Scrivo io
                          </button>
                          <button
                            className="btn btn-outline"
                            disabled={
                              generatingSocial || !customIdea.title.trim()
                            }
                            onClick={() =>
                              generateSocialContent({
                                ...customIdea,
                                type: "Idea tua",
                                source: "Proposta manuale",
                              })
                            }
                          >
                            Genera post social
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => {
                              setCustomIdeaOpen(false);
                              setCustomIdea({ title: "", reason: "" });
                            }}
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="ideas-foot">
                    In ogni caso finisci nell’editor con una bozza{" "}
                    <strong>non pubblicata</strong>: «Genera con l’AI» te la
                    consegna già scritta da rivedere, «Scrivo io» ti lascia una
                    traccia vuota da riempire.
                  </p>
                </div>
              )}

              {false && visibilitySection === "solutions" && (
                <div
                  id="modules"
                  className="glass-modal"
                  style={{
                    marginBottom: "1.5rem",
                    padding: "1.5rem",
                    background:
                      "linear-gradient(145deg, var(--surface), var(--primary-light))",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ maxWidth: "720px" }}>
                      <div
                        style={{
                          color: "var(--primary)",
                          fontSize: "12px",
                          fontWeight: 850,
                          textTransform: "uppercase",
                          letterSpacing: ".08em",
                        }}
                      >
                        Soluzioni modulari
                      </div>
                      <h3
                        style={{
                          margin: "0.4rem 0",
                          color: "var(--text)",
                          fontSize: "22px",
                        }}
                      >
                        Vuoi accelerare la visibilità?
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--text-muted)",
                          fontSize: "14px",
                          lineHeight: 1.65,
                        }}
                      >
                        L’analisi di base resta inclusa. Puoi attivare solo gli
                        interventi che ti servono, con costo e attività
                        dichiarati prima dell’acquisto.
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "9px 13px",
                        borderRadius: "999px",
                        background: "var(--surface)",
                        color: "var(--primary)",
                        border: "1px solid var(--primary)",
                        fontSize: "12px",
                        fontWeight: 800,
                      }}
                    >
                      Nessun vincolo
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(215px, 1fr))",
                      gap: "1rem",
                      marginTop: "1.3rem",
                    }}
                  >
                    {VISIBILITY_MODULES.map((module) => (
                      <div
                        key={module.name}
                        style={{
                          padding: "1.15rem",
                          borderRadius: "16px",
                          background: "var(--surface)",
                          border: module.featured
                            ? "2px solid var(--primary)"
                            : "1px solid var(--border)",
                          boxShadow: module.featured
                            ? "0 10px 24px rgba(79,70,229,.12)"
                            : "none",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {module.featured && (
                          <div
                            style={{
                              alignSelf: "flex-start",
                              padding: "4px 8px",
                              borderRadius: "999px",
                              background: "var(--primary)",
                              color: "#fff",
                              fontSize: "10px",
                              fontWeight: 850,
                              textTransform: "uppercase",
                              marginBottom: "0.7rem",
                            }}
                          >
                            Consigliato
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: "17px",
                            fontWeight: 850,
                            color: "var(--text)",
                          }}
                        >
                          {module.name}
                        </div>
                        <div
                          style={{
                            fontSize: "23px",
                            fontWeight: 900,
                            color: "var(--primary)",
                            marginTop: "0.35rem",
                          }}
                        >
                          {module.price}
                        </div>
                        <p
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "13px",
                            lineHeight: 1.55,
                            minHeight: "60px",
                          }}
                        >
                          {module.description}
                        </p>
                        <div
                          style={{
                            display: "grid",
                            gap: "0.45rem",
                            marginBottom: "1rem",
                          }}
                        >
                          {module.deliverables.map((item) => (
                            <div
                              key={item}
                              style={{ color: "var(--text)", fontSize: "12px" }}
                            >
                              ✓ {item}
                            </div>
                          ))}
                        </div>
                        <a
                          href={`mailto:support@ideesitiweb.it?subject=${encodeURIComponent(`Richiesta modulo ${module.name} - ${user?.slug || ""}`)}`}
                          className={`btn ${module.featured ? "btn-primary" : "btn-outline"}`}
                          style={{
                            marginTop: "auto",
                            textDecoration: "none",
                            justifyContent: "center",
                          }}
                        >
                          Richiedi attivazione
                        </a>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: "1rem",
                      color: "var(--text-muted)",
                      fontSize: "12px",
                      lineHeight: 1.55,
                    }}
                  >
                    I prezzi mostrati sono proposte commerciali e non includono
                    eventuali budget pubblicitari. Nessun risultato di
                    posizionamento o vendita viene garantito.
                  </div>
                </div>
              )}

              {isAdmin && visibilitySection === "overview" && (
                <div
                  className="glass-modal"
                  style={{ marginBottom: "1.5rem", padding: "1.5rem" }}
                >
                  <h3
                    style={{ marginBottom: "0.35rem", color: "var(--primary)" }}
                  >
                    Visibilità globale (Admin)
                  </h3>
                  <p
                    style={{
                      margin: "0 0 1rem",
                      color: "var(--text-muted)",
                      fontSize: "13px",
                    }}
                  >
                    Dettaglio operativo degli ultimi 30 giorni, separato per
                    profilo.
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table
                      className="table"
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        textAlign: "left",
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Utente
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Sito
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Pubblicate
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Viste Google
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Impression
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Clic
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            CTR
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Pos.
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Visitatori
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Azioni
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            Ultimo dato
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminSeoStats.length === 0 ? (
                          <tr>
                            <td
                              colSpan="11"
                              style={{ padding: "12px", textAlign: "center" }}
                            >
                              Nessuna statistica disponibile
                            </td>
                          </tr>
                        ) : (
                          adminSeoStats.map((st, i) => (
                            <tr key={i}>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {st.email}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {st.title}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {st.published_pages}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {st.google_visible_pages}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {st.impressions}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {st.clicks}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {st.ctr ? Number(st.ctr).toFixed(2) + "%" : "-"}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {st.position
                                  ? parseFloat(st.position).toFixed(1)
                                  : "-"}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {st.unique_visitors}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                }}
                                title={`Telefono ${st.event_counts?.call_click || 0} · Indicazioni ${st.event_counts?.directions_click || 0} · WhatsApp ${st.event_counts?.whatsapp_click || 0} · Prenotazioni ${st.event_counts?.booking_click || 0}`}
                              >
                                {st.actions}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {st.latest_search_date || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: "0.75rem",
                      marginTop: "1rem",
                    }}
                  >
                    {adminSeoStats.map((st) => (
                      <details
                        key={st.id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          padding: "0.85rem 1rem",
                          background: "var(--bg)",
                        }}
                      >
                        <summary
                          style={{
                            cursor: "pointer",
                            fontWeight: 700,
                            color: "var(--text)",
                          }}
                        >
                          {st.title || st.email} · dettaglio acquisizione e
                          qualità
                        </summary>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "1rem",
                            marginTop: "1rem",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 800,
                                color: "var(--text-muted)",
                                textTransform: "uppercase",
                                marginBottom: "0.5rem",
                              }}
                            >
                              Stato operativo
                            </div>
                            <div
                              style={{
                                fontSize: "13px",
                                lineHeight: 1.8,
                                color: "var(--text)",
                              }}
                            >
                              Slug: <strong>{st.slug}</strong>
                              <br />
                              Copertura osservata:{" "}
                              <strong>
                                {st.published_pages
                                  ? Math.round(
                                      (st.google_visible_pages /
                                        st.published_pages) *
                                        100,
                                    )
                                  : 0}
                                %
                              </strong>
                              <br />
                              Tracking dal:{" "}
                              <strong>
                                {st.tracking_started || "non ancora attivo"}
                              </strong>
                              <br />
                              Ultimo sync social:{" "}
                              <strong>{st.last_sync || "mai"}</strong>
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 800,
                                color: "var(--text-muted)",
                                textTransform: "uppercase",
                                marginBottom: "0.5rem",
                              }}
                            >
                              Top query
                            </div>
                            {(st.top_queries || []).length === 0 ? (
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "var(--text-muted)",
                                }}
                              >
                                Nessun dato query
                              </div>
                            ) : (
                              (st.top_queries || []).map((q) => (
                                <div
                                  key={q.query_text}
                                  style={{
                                    fontSize: "13px",
                                    marginBottom: "0.4rem",
                                    color: "var(--text)",
                                  }}
                                >
                                  {q.query_text}{" "}
                                  <span style={{ color: "var(--text-muted)" }}>
                                    · {q.impressions} impr
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 800,
                                color: "var(--text-muted)",
                                textTransform: "uppercase",
                                marginBottom: "0.5rem",
                              }}
                            >
                              Azioni registrate
                            </div>
                            <div
                              style={{
                                fontSize: "13px",
                                lineHeight: 1.8,
                                color: "var(--text)",
                              }}
                            >
                              Percorsi scelti:{" "}
                              <strong>
                                {st.event_counts?.path_select || 0}
                              </strong>
                              <br />
                              Contenuti aperti:{" "}
                              <strong>
                                {st.event_counts?.path_content_click || 0}
                              </strong>
                              <br />
                              Telefono:{" "}
                              <strong>
                                {st.event_counts?.call_click || 0}
                              </strong>
                              <br />
                              Indicazioni:{" "}
                              <strong>
                                {st.event_counts?.directions_click || 0}
                              </strong>
                              <br />
                              WhatsApp:{" "}
                              <strong>
                                {st.event_counts?.whatsapp_click || 0}
                              </strong>
                              <br />
                              Prenotazione:{" "}
                              <strong>
                                {st.event_counts?.booking_click || 0}
                              </strong>
                              <br />
                              Social:{" "}
                              <strong>
                                {st.event_counts?.social_click || 0}
                              </strong>
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

          {tab === "services" && renderVisibilityServices()}

          {tab === "account" && renderAccountProfile()}

          {tab === "security" && (
            <div
              className="card"
              style={{
                maxWidth: "680px",
                margin: "0 auto",
                padding: "clamp(1.25rem, 4vw, 2rem)",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "16px",
                  display: "grid",
                  placeItems: "center",
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  fontSize: "24px",
                  marginBottom: "1rem",
                }}
              >
                🔐
              </div>
              <h2 style={{ margin: "0 0 0.5rem", color: "var(--text)" }}>
                Cambia la tua password
              </h2>
              <p
                style={{
                  margin: "0 0 1.5rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                Per proteggere il tuo account, conferma la password attuale e
                scegline una nuova di almeno 8 caratteri.
              </p>

              {passwordMsg && (
                <div
                  style={{
                    marginBottom: "1rem",
                    padding: "12px 14px",
                    borderRadius: "var(--radius-sm)",
                    background: passwordMsg.ok
                      ? "var(--teal-light)"
                      : "var(--red-light)",
                    color: passwordMsg.ok ? "#0F6E56" : "var(--red)",
                    fontWeight: 700,
                    fontSize: "14px",
                  }}
                >
                  {passwordMsg.text}
                </div>
              )}

              <form
                onSubmit={changeOwnPassword}
                style={{ display: "grid", gap: "1rem" }}
              >
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label" htmlFor="current-password">
                    Password attuale
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={passwordForm.current}
                    onChange={(e) =>
                      setPasswordForm((current) => ({
                        ...current,
                        current: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label" htmlFor="new-password">
                    Nuova password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                    value={passwordForm.next}
                    onChange={(e) =>
                      setPasswordForm((current) => ({
                        ...current,
                        next: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label" htmlFor="confirm-password">
                    Ripeti la nuova password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                    value={passwordForm.confirm}
                    onChange={(e) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirm: e.target.value,
                      }))
                    }
                  />
                </div>
                <button
                  className="btn btn-primary"
                  disabled={changingPassword}
                  style={{
                    justifyContent: "center",
                    marginTop: "0.5rem",
                    padding: "13px 18px",
                  }}
                >
                  {changingPassword ? "Aggiornamento..." : "Aggiorna password"}
                </button>
              </form>
            </div>
          )}

          {tab === "admin" && user?.role === "admin" && (
            <AdminScreen
              token={token}
              currentUser={user}
              adminPrompts={adminPrompts}
              updatePrompt={updatePrompt}
            />
          )}

          {/* Modal Modifica Post */}
          {editingPost && (
            <div className="mobile-bottom-sheet article-editor-overlay">
              <div className="glass-modal article-editor-modal">
                <div className="article-editor-header">
                  <div>
                    <div className="article-editor-eyebrow">
                      Editor articolo
                    </div>
                    <h2>Modifica il contenuto</h2>
                  </div>
                  <button
                    onClick={() => setEditingPost(null)}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      border: "none",
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      fontSize: "16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text)",
                      transition: "background 0.2s",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div className="article-editor-scroll">
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "15px",
                        fontWeight: 700,
                        marginBottom: "8px",
                        color: "var(--text)",
                      }}
                    >
                      Titolo Principale
                    </label>
                    <input
                      type="text"
                      value={editingPost.title}
                      onChange={(e) =>
                        setEditingPost({
                          ...editingPost,
                          title: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        fontSize: "18px",
                        fontWeight: 600,
                        padding: "14px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-strong)",
                        background: "var(--bg)",
                        color: "var(--text)",
                      }}
                    />
                  </div>

                  <section className="article-image-editor">
                    <div className="article-image-editor__head">
                      <div>
                        <strong>Foto principale</strong>
                        <span>
                          Puoi aggiungerla, sostituirla, rimuoverla e scegliere
                          quanto spazio occupa nell’articolo.
                        </span>
                      </div>
                      {editingPost.mediaUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingPost({
                              ...editingPost,
                              mediaUrl: "",
                              mediaType: "",
                            })
                          }
                        >
                          Rimuovi foto
                        </button>
                      )}
                    </div>
                    <div className="article-image-editor__body">
                      <div
                        className={`article-image-preview align-${editingPost.mediaAlignment}`}
                      >
                        {editingPost.mediaUrl &&
                        String(editingPost.mediaType).toUpperCase() !==
                          "VIDEO" ? (
                          <img
                            src={editingPost.mediaUrl}
                            alt="Anteprima foto articolo"
                            style={{ width: `${editingPost.mediaWidth}%` }}
                          />
                        ) : (
                          <div>
                            <span>▧</span>
                            <strong>
                              {editingPost.mediaType === "VIDEO"
                                ? "Questo articolo contiene un video"
                                : "Nessuna foto"}
                            </strong>
                            <small>
                              Carica un’immagine oppure incolla un indirizzo per
                              impostare la foto principale.
                            </small>
                          </div>
                        )}
                      </div>
                      <div className="article-image-controls">
                        <label>
                          <span>Immagine dal computer</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={postImageUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadPostImage(file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <label>
                          <span>
                            Ridimensiona il file prima del caricamento
                          </span>
                          <select
                            value={editingPost.imagePixelWidth}
                            onChange={(e) =>
                              setEditingPost({
                                ...editingPost,
                                imagePixelWidth: Number(e.target.value),
                              })
                            }
                          >
                            <option value="600">600 px · leggera</option>
                            <option value="900">900 px</option>
                            <option value="1200">1200 px · consigliata</option>
                            <option value="1600">1600 px · grande</option>
                            <option value="0">Dimensione originale</option>
                          </select>
                        </label>
                        <label>
                          <span>Oppure indirizzo dell’immagine</span>
                          <input
                            type="url"
                            value={editingPost.mediaUrl}
                            onChange={(e) =>
                              setEditingPost({
                                ...editingPost,
                                mediaUrl: e.target.value,
                                mediaType: e.target.value ? "IMAGE" : "",
                              })
                            }
                            placeholder="https://… oppure carica un file"
                          />
                        </label>
                        <label>
                          <span>
                            Larghezza nella pagina · {editingPost.mediaWidth}%
                          </span>
                          <input
                            type="range"
                            min="30"
                            max="100"
                            step="5"
                            value={editingPost.mediaWidth}
                            onChange={(e) =>
                              setEditingPost({
                                ...editingPost,
                                mediaWidth: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <div>
                          <span>Allineamento</span>
                          <div className="article-image-align">
                            {[
                              ["left", "Sinistra"],
                              ["center", "Centro"],
                              ["right", "Destra"],
                            ].map(([value, label]) => (
                              <button
                                type="button"
                                className={
                                  editingPost.mediaAlignment === value
                                    ? "active"
                                    : ""
                                }
                                onClick={() =>
                                  setEditingPost({
                                    ...editingPost,
                                    mediaAlignment: value,
                                  })
                                }
                                key={value}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {postImageUploading && (
                          <div className="article-image-uploading">
                            Ridimensionamento e caricamento…
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "15px",
                        fontWeight: 700,
                        marginBottom: "8px",
                        color: "var(--text)",
                      }}
                    >
                      Testo Grezzo Originale (importato dal social)
                    </label>
                    <textarea
                      value={editingPost.rawContent}
                      onChange={(e) =>
                        setEditingPost({
                          ...editingPost,
                          rawContent: e.target.value,
                        })
                      }
                      placeholder="Testo originale prelevato dal social..."
                      style={{
                        width: "100%",
                        minHeight: "120px",
                        padding: "12px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-strong)",
                        fontSize: "14px",
                        background: "var(--bg-subtle, #f5f5f5)",
                        color: "var(--text)",
                        resize: "vertical",
                      }}
                    />
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        marginTop: "4px",
                      }}
                    >
                      Modifica questo testo prima di rigenerare con l'AI se
                      l'importazione era incompleta.
                    </p>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "15px",
                        fontWeight: 700,
                        marginBottom: "8px",
                        color: "var(--text)",
                      }}
                    >
                      Testo dell'Articolo
                    </label>
                    <QuillEditor
                      value={editingPost.body}
                      onChange={(val) =>
                        setEditingPost({ ...editingPost, body: val })
                      }
                      className="article-rich-editor"
                      style={{
                        background: "#fff",
                        color: "#000",
                        border: "2px solid var(--border-strong)",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: "8px",
                      }}
                    />
                  </div>

                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}
                  >
                    <div style={{ flex: "1 1 300px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "15px",
                          fontWeight: 700,
                          marginBottom: "8px",
                          color: "var(--text)",
                        }}
                      >
                        Breve Riassunto (Opzionale)
                      </label>
                      <textarea
                        value={editingPost.excerpt}
                        onChange={(e) =>
                          setEditingPost({
                            ...editingPost,
                            excerpt: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          minHeight: "100px",
                          padding: "12px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-strong)",
                          fontSize: "14px",
                          background: "var(--bg)",
                          color: "var(--text)",
                          resize: "vertical",
                        }}
                      />
                    </div>
                    <div style={{ flex: "1 1 300px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "15px",
                          fontWeight: 700,
                          marginBottom: "8px",
                          color: "var(--text)",
                        }}
                      >
                        Parole Chiave (separate da virgola)
                      </label>
                      <textarea
                        value={editingPost.tags}
                        onChange={(e) =>
                          setEditingPost({
                            ...editingPost,
                            tags: e.target.value,
                          })
                        }
                        placeholder="Es: cucina, ricette, estate"
                        style={{
                          width: "100%",
                          minHeight: "100px",
                          padding: "12px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-strong)",
                          fontSize: "14px",
                          background: "var(--bg)",
                          color: "var(--text)",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  </div>

                  <label
                    className={`article-indexing-control ${editingPost.noindex ? "is-noindex" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(editingPost.noindex)}
                      onChange={(e) =>
                        setEditingPost({
                          ...editingPost,
                          noindex: e.target.checked ? 1 : 0,
                        })
                      }
                    />
                    <span>
                      <strong>
                        Escludi questo articolo dai motori di ricerca
                      </strong>
                      <small>
                        Attiva il meta tag noindex. L’articolo resta pubblicato
                        e raggiungibile tramite link, ma non viene inserito
                        nella sitemap.
                      </small>
                    </span>
                  </label>
                </div>

                <div className="article-editor-actions">
                  <button
                    onClick={regenerateEditedPost}
                    disabled={cmsSaving}
                    style={{
                      flex: "1 1 210px",
                      background: "var(--primary-light)",
                      color: "var(--primary-dark)",
                      border: "1px solid var(--primary)",
                      padding: "16px",
                      fontSize: "15px",
                      fontWeight: 800,
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                    }}
                  >
                    {cmsSaving ? "⏳ ORCHESTRAZIONE…" : "✨ RIGENERA CON L’AI"}
                  </button>
                  <button
                    onClick={savePostEdit}
                    disabled={cmsSaving}
                    style={{
                      flex: "2 1 200px",
                      background: "var(--primary)",
                      color: "#000",
                      border: "none",
                      padding: "16px",
                      fontSize: "16px",
                      fontWeight: 800,
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      transition: "background 0.2s",
                      boxShadow: "0 4px 12px rgba(0,240,255,0.2)",
                    }}
                  >
                    {cmsSaving
                      ? "⏳ Salvataggio in corso..."
                      : "✅ SALVA MODIFICHE"}
                  </button>
                  <button
                    onClick={() => setEditingPost(null)}
                    style={{
                      flex: "1 1 100px",
                      background: "transparent",
                      color: "var(--text)",
                      border: "1px solid var(--border-strong)",
                      padding: "16px",
                      fontSize: "16px",
                      fontWeight: 600,
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                  >
                    ❌ ANNULLA
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {socialComposer && (
        <div
          className="social-composer-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Contenuto social"
        >
          <section className="social-composer">
            <header>
              <div>
                <span className="section-eyebrow">
                  Creato dall'AI · da rivedere
                </span>
                <h2>
                  Post per {SOCIAL[socialPlatform]?.label || socialPlatform}
                </h2>
                <p>
                  L'AI adatta il messaggio alla piattaforma. La pubblicazione
                  parte solo quando premi Condividi e la confermi nell'app
                  scelta.
                </p>
              </div>
              <button
                className="social-composer-close"
                onClick={() => setSocialComposer(null)}
                aria-label="Chiudi"
              >
                ×
              </button>
            </header>
            <div className="social-platforms">
              {["instagram", "facebook", "tiktok", "linkedin"].map(
                (platform) => (
                  <button
                    key={platform}
                    className={socialPlatform === platform ? "is-active" : ""}
                    disabled={generatingSocial}
                    onClick={() =>
                      generateSocialContent(socialComposer.idea, platform)
                    }
                  >
                    {SOCIAL[platform]?.label ||
                      platform[0].toUpperCase() + platform.slice(1)}
                  </button>
                ),
              )}
            </div>
            <label className="social-caption">
              <span>Testo del post</span>
              <textarea
                rows={10}
                value={socialComposer.caption || ""}
                onChange={(event) =>
                  setSocialComposer((previous) => ({
                    ...previous,
                    caption: event.target.value,
                  }))
                }
              />
            </label>
            <div className="social-hashtags">
              {(socialComposer.hashtags || []).map((tag) => (
                <span key={tag}>#{String(tag).replace(/^#/, "")}</span>
              ))}
            </div>
            <div className="social-visual-brief">
              <strong>Visuale consigliato</strong>
              <p>
                {socialComposer.visual_brief ||
                  "Usa una foto o un video autentico e coerente con il contenuto."}
              </p>
            </div>
            <footer>
              <button
                className="btn btn-outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(socialShareText());
                  setSyncMsg({ ok: true, text: "Testo social copiato." });
                }}
              >
                Copia testo
              </button>
              <button className="btn btn-primary" onClick={shareSocialContent}>
                Condividi e conferma nel social
              </button>
            </footer>
          </section>
        </div>
      )}

      {seoPreview && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="modal-content glass-modal"
            style={{
              background: "var(--bg)",
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "2rem",
              borderRadius: "1rem",
              border: "1px solid var(--border)",
            }}
          >
            <h2 style={{ marginTop: 0, color: "var(--text)" }}>
              Anteprima Pagine Fondamentali
            </h2>
            <p style={{ color: "var(--text-muted)" }}>
              Controlla i testi generati prima di confermare il salvataggio. Le
              pagine esistenti verranno sovrascritte.
            </p>

            <div style={{ display: "grid", gap: "1.5rem", margin: "1.5rem 0" }}>
              {(seoPreview.pages || []).map((page) => (
                <div
                  key={page.slug}
                  style={{
                    padding: "1.25rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    background: "var(--surface)",
                  }}
                >
                  <h3 style={{ margin: "0 0 0.5rem", color: "var(--primary)" }}>
                    {page.title}
                  </h3>
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "0.85rem",
                      marginBottom: "1.25rem",
                      padding: "0.4rem 0.6rem",
                      background: "var(--bg)",
                      borderRadius: "6px",
                      display: "inline-block",
                    }}
                  >
                    Percorso: /{page.slug}
                  </div>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: "0.95rem",
                      color: "var(--text)",
                      lineHeight: 1.6,
                    }}
                  >
                    {page.content}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "flex-end",
                marginTop: "2rem",
                paddingTop: "1.5rem",
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                className="btn btn-outline"
                onClick={() => setSeoPreview(null)}
                disabled={savingProfile}
              >
                Annulla
              </button>
              <button
                className="btn btn-primary"
                onClick={saveSeoFoundation}
                disabled={savingProfile}
              >
                {savingProfile ? "Salvataggio..." : "Conferma e Salva"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProductGuide knowledge={knowledge} />
      <PublicationConnections token={token} />
    </div>
  );
}
