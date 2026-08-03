import React, { useState, useEffect, useDeferredValue } from 'react';
import { apiFetch, SOCIAL, SITE_LAYOUTS, detectPlatformFromUrl, PLATFORM_DESCRIPTIONS } from '../utils/api';
import { SocialIcon } from '../components/SocialIcon';
import { QuillEditor } from '../components/QuillEditor';
import { AdminScreen } from './AdminScreen';

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

export 
function DashboardScreen({ token, user, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [dashboardFilter, setDashboardFilter] = useState('all');
  const [data, setData] = useState(null);
  const [seoAnalytics, setSeoAnalytics] = useState([]);
  const [adminSeoStats, setAdminSeoStats] = useState([]);
  const isAdmin = user?.role === 'admin';

  const [brandVoiceProfile, setBrandVoiceProfile] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedPosts, setSelectedPosts] = useState([]);
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
  const [heroTagline, setHeroTagline] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [menuLinksStr, setMenuLinksStr] = useState('');
  const [footerText, setFooterText] = useState('');
  const [gscVerification, setGscVerification] = useState('');
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
  const deferredStudio = useDeferredValue(templateStudio);
  const siteUrl = `${window.location.origin}/${user?.slug}`;

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

  async function loadData() {
    try {
      const d = await apiFetch('/api/index.php?action=site', {}, token);
      setData(d);
      setProfileDraft(d.site?.profile_summary || d.site?.bio || '');
      setBrandVoiceProfile(d.site?.brand_voice_profile || '');
      setSeoAnalytics(d.seo_analytics || []);
      setRoleMissionDraft(d.site?.role_mission || '');
      setStrategyDraft(d.site?.content_strategy || '');
      setSelectedTheme(d.site?.theme || 'classic');
      
      setHeaderLayout(d.site?.header_layout || 'standard');
      setAccentColor(d.site?.accent_color || '');
      setLogoUrl(d.site?.logo_url || '');
      setCoverUrl(d.site?.cover_url || '');
      setHeroTagline(d.site?.hero_tagline || '');
      setCustomCss(d.site?.custom_css || '');
      setFooterText(d.site?.footer_text || '');
      setGscVerification(d.site?.gsc_verification || '');
      setHarmonizeAgent(d.site?.harmonize_agent || 'content_editor');
      setAccountType(d.site?.account_type || 'business');
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
    } catch (err) {
      alert("ERRORE CARICAMENTO DASHBOARD: " + err.message);
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
    try {
      const r = await apiFetch('/api/index.php?action=ingest-url',
        { method: 'POST', body: JSON.stringify({ url: linkUrl.trim() }) }, token);
      if (r.duplicate) {
        setImportMsg({ ok: true, text: 'Questo contenuto era già stato importato.' });
      } else {
        setImportMsg({ ok: true, text: 'Acquisizione completata! Elaborazione AI in corso...' });
        // Avvia elaborazione in background automaticamente
        processPendingLoop(true);
      }
      setLinkUrl('');
      await loadDrafts();
      await loadData();
    } catch (err) {
      setImportMsg({ ok: false, text: err.message });
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

  // Funzione helper per elaborare la coda (ora in parallelo)
  async function processPendingLoop(isScan = false) {
    try {
      const pending = await apiFetch('/api/index.php?action=pending-posts', {}, token);
      if (!pending || pending.length === 0) return;
      
      setProcessingQueue(pending.map(p => ({ ...p, status: 'pending' })));

      const total = pending.length;
      let completed = 0;
      let publishedCount = 0;
      let draftCount = 0;
      let skippedCount = 0;
      let deletedCount = 0;
      let errorCount = 0;
      const concurrency = 4; // Elabora fino a 4 post in parallelo

      const updateProgress = () => {
        const msg = `Elaborazione AI: completati ${completed} su ${total} post...`;
        if (isScan) setScanMsg({ ok: true, text: msg, loading: true });
        else setSyncMsg({ ok: true, text: msg, loading: true });
      };

      updateProgress();

      const processPost = async (post) => {
        setProcessingQueue(prev => prev.map(p => p.id === post.id ? { ...p, status: 'processing' } : p));
        const postLabel = post.generated_title || post.source_url || `${post.platform} #${post.id}`;
        const processingMsg = `Elaborazione AI in corso: ${completed + 1}/${total} - ${post.platform.toUpperCase()} - ${postLabel}`;
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

      const finalMsg = `Orchestrazione finale del sito in corso...`;
      if (isScan) setScanMsg({ ok: true, text: finalMsg, loading: true });
      else setSyncMsg({ ok: true, text: finalMsg, loading: true });

      try {
        await apiFetch('/api/index.php?action=finalize-sync', {
          method: 'POST',
          body: JSON.stringify({
             profile_summary: typeof profileDraft !== 'undefined' ? profileDraft : '',
             role_mission: typeof roleMissionDraft !== 'undefined' ? roleMissionDraft : '',
             content_strategy: typeof strategyDraft !== 'undefined' ? strategyDraft : ''
          })
        }, token);
      } catch (e) {
        console.error("Errore orchestrazione", e);
      }
      
      const doneMsg = `Pipeline completata. Trovati in coda: ${total}. Pubblicati: ${publishedCount}. In bozza: ${draftCount}. Scartati: ${skippedCount}. Saltati: ${deletedCount}. Errori: ${errorCount}.`;
      if (isScan) setScanMsg({ ok: true, text: doneMsg });
      else setSyncMsg({ ok: true, text: doneMsg });
      
      // Ritardiamo la pulizia della coda per far vedere all'utente il completamento
      setTimeout(() => setProcessingQueue([]), 5000);
      
      await loadDrafts();
      await loadData();
    } catch (e) {
      console.error(e);
      setProcessingQueue([]);
    }
  }

  async function syncNow() {
    setSyncing(true); setSyncMsg({ ok: true, text: 'Acquisizione post in corso...', loading: true });
    try {
      await apiFetch('/api/index.php?action=sync', { 
        method: 'POST', 
        body: JSON.stringify({ limit: parseInt(syncLimit) || 20 }) 
      }, token);
      await processPendingLoop(false);
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message });
    }
    setSyncing(false);
  }

  async function togglePublishPost(id, currentStatus) {
    const newStatus = currentStatus ? 0 : 1;
    await apiFetch('/api/index.php?action=toggle-publish-post', { method: 'POST', body: JSON.stringify({ id, published: newStatus }) }, token);
    setData(prev => ({
      ...prev,
      posts: prev.posts.map(p => p.id === id ? { ...p, published: newStatus } : p)
    }));
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

  async function savePlatformSource(platform, url, since_date = null, auto_publish = 1, max_posts = null, topic_summary = null) {
    setSourceMsg(null);
    try {
      await apiFetch('/api/index.php?action=social-source-upsert', {
        method: 'POST',
        body: JSON.stringify({ platform, label: SOCIAL[platform]?.label || platform, url, since_date, auto_publish, max_posts, topic_summary })
      }, token);
      await loadData();
    } catch (err) {
      setSourceMsg({ ok: false, text: err.message });
    }
  }

  async function saveConnectionSettings(platform, since_date, auto_publish, max_posts = null) {
    try {
      await apiFetch('/api/index.php?action=social-connection-update', {
        method: 'POST',
        body: JSON.stringify({ platform, since_date, auto_publish, max_posts })
      }, token);
      await loadData();
    } catch (err) {
      alert(err.message);
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

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
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
    }
    
    setScanMsg({
      ok: totalErrors === 0,
      text: `Acquisizione completata. Totale trovati: ${totalFound}. Nuovi importati: ${totalImported}. Duplicati: ${totalDuplicates}. Errori: ${totalErrors}. Avvio ora l'elaborazione AI dei nuovi contenuti.`,
      loading: true
    });
    setTimeout(() => setScanProgress([]), 3000);
    await processPendingLoop(true);
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
          hero_tagline: heroTagline,
          custom_css: customCss,
          footer_text: footerText,
          gsc_verification: gscVerification,
          harmonize_agent: harmonizeAgent,
          account_type: accountType,
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
      alert("Istruzioni aggiornate con successo!");
    } catch (err) {
      alert("Errore: " + err.message);
    }
  }

  useEffect(() => {
    if (tab === 'admin' && user?.role === 'admin') loadAdminPrompts();
  }, [tab]);

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
  const [cmsFilter, setCmsFilter] = useState('all');

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
  const sourceByPlatform = sources.reduce((acc, source) => ({ ...acc, [source.platform]: source }), {});
  const connByPlatform = connections.reduce((acc, c) => ({ ...acc, [c.platform]: c }), {});
  return (
    <div style={{ minHeight: '100vh', display: 'flex', overflow: studioWorkspaceOpen ? 'hidden' : 'visible' }}>
      {/* Sidebar Laterale (solo Desktop) */}
      <div
        className="desktop-sidebar"
        style={{
          width: '280px',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          top: 0,
          left: 0,
          zIndex: 50,
          boxShadow: 'var(--shadow)',
          visibility: studioWorkspaceOpen ? 'hidden' : 'visible',
          pointerEvents: studioWorkspaceOpen ? 'none' : 'auto',
        }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800, fontSize: '20px', color: 'var(--primary)' }}><img src="/logo.png" alt="allsocialtoweb.com" style={{ height: '32px' }} /></div>
        </div>
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
          {[
            { id: 'overview', icon: '🏠', label: 'Home' },
            { id: 'site', icon: '📝', label: 'Articoli' },
            { id: 'sources', icon: '📡', label: 'Canali' },
            { id: 'settings', icon: '🎨', label: 'Design' },
            ...(user?.role === 'admin' ? [
              { id: 'general', icon: '⚙️', label: 'Impostazioni' }
            ] : []),
            { id: 'seo', icon: '📈', label: 'SEO' },
            ...(user?.role === 'admin' ? [{ id: 'admin', icon: '🛠', label: 'Admin' }] : [])
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{
                padding: '14px 16px', borderRadius: '12px', textAlign: 'left',
                background: tab === item.id ? 'var(--primary-light)' : 'transparent',
                color: tab === item.id ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: tab === item.id ? 700 : 600,
                display: 'flex', alignItems: 'center', gap: '14px',
                border: tab === item.id ? '1px solid var(--primary-light)' : '1px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}>
              <span style={{ fontSize: '20px' }}>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
        <div style={{ padding: '24px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
          <button className="btn btn-outline btn-full" onClick={toggleTheme} style={{ padding: '12px', borderRadius: '12px', fontWeight: 700, border: '1px solid var(--border-strong)', marginBottom: '10px' }}>
            {theme === 'dark' ? '☀️ Tema chiaro' : '🌙 Tema scuro'}
          </button>
          <button className="btn btn-outline btn-full" onClick={onLogout} style={{ padding: '12px', borderRadius: '12px', fontWeight: 700, border: '1px solid var(--border-strong)' }}>Esci</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="dashboard-main" style={studioWorkspaceOpen ? { marginLeft: 0 } : undefined}>
        {/* Mobile Header (Only visible on mobile) */}
        <div className="mobile-top-header">
          <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--primary)' }}><img src="/logo.png" alt="allsocialtoweb.com" style={{ height: '24px' }} /></div>
          <button className="btn btn-outline" onClick={syncNow} disabled={syncing} style={{ padding: '8px 16px', fontSize: '12px' }}>
            {syncing ? '?' : '? Social'}
          </button>
        </div>

        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Header Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
              {tab === 'overview' && 'Panoramica'}
              {tab === 'site' && 'Gestione Contenuti'}
              {tab === 'sources' && 'I miei canali'}
              {tab === 'settings' && 'Design & Aspetto'}
                {tab === 'general' && 'Impostazioni Generali'}
              {tab === 'seo' && 'SEO & Analisi'}
              {tab === 'admin' && 'Pannello Admin'}
            </h1>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-outline" onClick={syncNow} disabled={syncing} style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', padding: '10px 20px', borderRadius: '10px' }}>
                {syncing ? '⟳ Sync...' : '↻ Aggiorna Social'}
              </button>
            </div>
          </div>
        {syncMsg && (
          <div style={{ marginBottom: '1rem', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '14px',
            background: syncMsg.ok ? (syncMsg.loading ? 'var(--blue-light)' : 'var(--teal-light)') : 'var(--red-light)',
            color: syncMsg.ok ? (syncMsg.loading ? '#1E40AF' : '#0F6E56') : 'var(--red)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>{syncMsg.loading && <span style={{display:'inline-block', marginRight:'8px'}}>⟳</span>}{syncMsg.text}</div>
            {!syncMsg.loading && <button onClick={() => setSyncMsg(null)} style={{background:'none', border:'none', cursor:'pointer', fontSize:'16px'}}>✕</button>}
          </div>
        )}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              {[
                { n: posts.length, l: 'Contenuti elaborati', c: 'var(--primary)' },
                { n: sources.length, l: 'Canali collegati', c: 'var(--teal)' },
                { n: site?.seo_score || 0, l: 'Score SEO', c: (site?.seo_score >= 80) ? 'var(--teal)' : 'var(--amber)' },
                { n: posts.filter(p => p.media_type === 'VIDEO').length, l: 'Video trascritti', c: 'var(--primary-dark)' },
              ].map((s, i) => (
                <div key={i} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: '42px', fontWeight: 800, color: s.c, lineHeight: 1, textShadow: `0 0 15px ${s.c}33` }}>{s.n}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.l}</div>
                </div>
              ))}
            </div>

            {brandVoiceProfile && (
              <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>🧠 Profilo Brand Voice (AI)</h3>
                <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: 'var(--radius)', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', border: '1px solid var(--border)' }}>
                  {brandVoiceProfile}
                </div>
              </div>
            )}

            {seoAnalytics.length > 0 && (
              <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--teal)' }}>📈 Andamento Traffico (Google Search Console)</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '200px', gap: '4px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  {seoAnalytics.map((day, i) => {
                     const maxClicks = Math.max(...seoAnalytics.map(a => a.clicks), 1);
                     const h = (day.clicks / maxClicks) * 100;
                     return (
                       <div key={i} title={`${day.record_date}: ${day.clicks} clic, ${day.impressions} impr`} style={{ flex: 1, background: 'var(--teal)', height: `${Math.max(h, 2)}%`, minHeight: '4px', borderRadius: '4px 4px 0 0', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='var(--primary)'} onMouseOut={e => e.currentTarget.style.background='var(--teal)'}></div>
                     )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  <span>{seoAnalytics[0]?.record_date}</span>
                  <span>{seoAnalytics[seoAnalytics.length-1]?.record_date}</span>
                </div>
              </div>
            )}
            
            <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary-dark), var(--primary))', color: '#fff', border: 'none', boxShadow: '0 10px 30px -10px rgba(0, 240, 255, 0.4)' }}>
              <h2 style={{ marginBottom: '1rem', color: '#fff', fontSize: '24px', letterSpacing: '-0.5px' }}>🌍 Il tuo sito è online</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px 20px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '16px', flex: 1, minWidth: '250px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {siteUrl}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <a href={siteUrl} target="_blank" rel="noopener" className="btn" style={{ background: '#000', color: '#fff', textDecoration: 'none', borderRadius: '12px' }}>Apri sito</a>
                  <button className="btn" onClick={() => navigator.clipboard.writeText(siteUrl).then(() => alert('Copiato!'))} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: '12px' }}>Copia link</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Sincronizzazione automatica</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Il tuo sito si aggiorna automaticamente ogni 6 ore prelevando i contenuti dalle fonti social attive.
                </p>
                <div style={{ padding: '12px', background: 'var(--gray-light)', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>Ultimo sync:</span>
                  <span>{site?.last_sync ? new Date(site.last_sync).toLocaleString('it-IT') : 'Mai effettuato'}</span>
                </div>
              </div>
              
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Scorciatoie veloci</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => setTab('settings')} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>🎨 Modifica i colori e il font</button>
                  <button onClick={() => setTab('sources')} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>➕ Aggiungi un nuovo canale social</button>
                  <button onClick={() => setTab('site')} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>✏️ Rivedi un articolo pubblicato</button>
                </div>
              </div>
            </div>
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
              max_posts: c.max_posts,
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
              max_posts: s.max_posts,
              hasDuplicateOAuth: hasOAuth,
            });
          });


          const detectedPlatform = detectPlatformFromUrl(addUrl);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Form Aggiungi Canale */}
              <div className="card">
                <h2 style={{ marginBottom: '0.5rem', fontSize: '18px' }}>➕ Aggiungi un canale</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Incolla il link del tuo profilo social o del tuo sito web. Il sistema riconosce automaticamente la piattaforma e importa i tuoi contenuti.
                </p>
                <form onSubmit={handleAddChannel} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <input
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
                      <button onClick={scanSources} disabled={scanning || repairingMedia}
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
                                  {channel.type === 'oauth' ? '🔗 Connesso con account' : '🔍 Acquisizione automatica'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => removeChannel(channel)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '4px 8px', borderRadius: '4px' }}
                            title="Rimuovi canale">✕</button>
                        </div>

                        {/* Impostazioni sync inline */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '10px', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Dal:</span>
                          <input type="date" defaultValue={channel.since_date || ''}
                            title="Importa contenuti da questa data in poi"
                            onBlur={e => {
                              if (channel.type === 'oauth') saveConnectionSettings(channel.rawPlatform, e.target.value, channel.auto_publish ?? 1, channel.max_posts);
                              else savePlatformSource(channel.rawPlatform, channel.url, e.target.value, channel.auto_publish ?? 1, channel.max_posts);
                            }}
                            style={{ padding: '5px 8px', fontSize: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', width: '100%' }} />
                          <input type="number" min="1" max="500" placeholder="Max" defaultValue={channel.max_posts || ''}
                            title="Numero massimo di post da importare"
                            onBlur={e => {
                              const val = e.target.value || null;
                              if (channel.type === 'oauth') saveConnectionSettings(channel.rawPlatform, channel.since_date, channel.auto_publish ?? 1, val);
                              else savePlatformSource(channel.rawPlatform, channel.url, channel.since_date, channel.auto_publish ?? 1, val);
                            }}
                            style={{ padding: '5px 8px', fontSize: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', width: '70px' }} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" defaultChecked={(channel.auto_publish ?? 1) === 1}
                              onChange={e => {
                                const ap = e.target.checked ? 1 : 0;
                                if (channel.type === 'oauth') saveConnectionSettings(channel.rawPlatform, channel.since_date, ap, channel.max_posts);
                                else savePlatformSource(channel.rawPlatform, channel.url, channel.since_date, ap, channel.max_posts);
                              }} />
                            Pubblica auto
                          </label>
                        </div>
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
              <div className="card">
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
              </div>

              {/* Importa da link diretto */}
              <div className="card">
                <h2 style={{ marginBottom: '0.5rem', fontSize: '18px' }}>🔗 Importa un contenuto specifico</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Incolla il link di un singolo video o post per importarlo e convertirlo subito in articolo.
                </p>
                <form onSubmit={doImport} style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" placeholder="https://www.youtube.com/watch?v=... oppure link Instagram/TikTok"
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

            </div>
          );
        })()}

        {/* Tab: Sito */}
        {tab === 'site' && (() => {
          const allPlatforms = [...new Set(posts.map(p => p.platform))].sort();
          const allTags = [...new Set(posts.flatMap(p => p.tags || []).map(t => t.toLowerCase()))].sort();
          const filteredPosts = posts.filter(p => {
            if (dashboardFilter === 'all') return true;
            if (dashboardFilter.startsWith('platform-')) return p.platform === dashboardFilter.replace('platform-', '');
            if (dashboardFilter.startsWith('tag-')) return (p.tags || []).map(t => t.toLowerCase()).includes(dashboardFilter.replace('tag-', ''));
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
                  🌍 Apri sito pubblico
                </a>
                <a href={`${siteUrl}/sitemap.xml`} target="_blank" rel="noopener"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: '13px' }}>
                  🗺 Sitemap XML
                </a>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                        {post.published != 1 && (
                          <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                            BOZZA
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {post.media_type === 'VIDEO' && <span style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>🎥 VIDEO</span>}
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: post.seo_score >= 80 ? 'var(--teal-light)' : (post.seo_score >= 50 ? 'var(--amber-light)' : 'var(--red-light)'), color: post.seo_score >= 80 ? 'var(--teal)' : (post.seo_score >= 50 ? 'var(--amber)' : 'var(--red)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', border: `2px solid ${post.seo_score >= 80 ? 'var(--teal)' : (post.seo_score >= 50 ? 'var(--amber)' : 'var(--red)')}`, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} title={`Score SEO: ${post.seo_score}`}>
                          {post.seo_score}
                        </div>
                      </div>
                    </div>
                    
                    {/* Contenuto Testuale */}
                    <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h4 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px', lineHeight: 1.4, color: 'var(--text)' }}>
                        {post.generated_title || (post.raw_content ? post.raw_content.substring(0, 80) : 'Nuovo contenuto')}
                      </h4>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.6, fontWeight: 500 }}>
                        {post.generated_excerpt || (post.generated_body ? post.generated_body.substring(0, 200) : '')}
                      </div>

                      {post.tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '20px' }}>
                          {post.tags.slice(0, 4).map(t => <span key={t} style={{ color: 'var(--primary-dark)', background: 'var(--primary-light)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>#{t}</span>)}
                        </div>
                      )}
                    </div>

                    {/* Azioni Fondo Card */}
                    <div className="article-card-footer">
                      <button onClick={() => setEditingPost({id: post.id, title: post.generated_title || '', body: post.edited_body || post.generated_body || '', excerpt: post.generated_excerpt || '', tags: (post.tags || []).join(', ')})} style={{ flex: '1', padding: '10px', fontSize: '13px', fontWeight: 800, borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                        ✏️ MODIFICA
                      </button>
                      <button onClick={() => togglePublishPost(post.id, post.published)} title={post.published == 1 ? "Nascondi dal sito" : "Pubblica sul sito"} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: '16px', cursor: 'pointer', background: post.published == 1 ? 'var(--teal-light)' : 'var(--surface)', color: post.published == 1 ? 'var(--teal)' : 'var(--text-muted)', border: post.published == 1 ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-strong)', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {post.published == 1 ? '👁️' : '🚫'}
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
                           <input type="checkbox" checked={post.published == 1} onChange={() => togglePublishPost(post.id, post.published)} title={post.published == 1 ? "Nascondi" : "Pubblica"} style={{ transform: 'scale(1.4)', cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '16px', fontWeight: 600, fontSize: '15px' }}>
                          {post.generated_title || post.raw_content?.substring(0, 40) + '...'}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                            <SocialIcon platform={post.platform} size={20} /> {SOCIAL[post.platform]?.label}
                          </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ background: post.seo_score >= 80 ? 'rgba(0,255,150,0.1)' : (post.seo_score >= 50 ? 'rgba(255,149,0,0.1)' : 'rgba(255,0,50,0.1)'), color: post.seo_score >= 80 ? 'var(--teal)' : (post.seo_score >= 50 ? 'var(--amber)' : 'var(--red)'), padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 800, border: `1px solid ${post.seo_score >= 80 ? 'rgba(0,255,150,0.2)' : (post.seo_score >= 50 ? 'rgba(255,149,0,0.2)' : 'rgba(255,0,50,0.2)')}` }}>
                            {post.seo_score}
                          </span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setEditingPost({id: post.id, title: post.generated_title || '', body: post.edited_body || post.generated_body || '', excerpt: post.generated_excerpt || '', tags: (post.tags || []).join(', ')})} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>✏️ Modifica</button>
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
            <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Configurazione SEO</h3>
              <div className="form-group">
                <label className="label">Codice verifica Google Search Console</label>
                <input type="text" value={gscVerification} onChange={e => setGscVerification(e.target.value)}
                  placeholder="Es: BVF6O77EIb-WwlRh7ctbZBSP8YCnJ67zIEH7icKJMYw" style={{ background: 'var(--bg)', color: 'var(--text)' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 500 }}>
                  Incolla il codice di verifica HTML che ti fornisce Google Search Console per indicizzare il tuo sito.
                  Una volta salvato, torna su Google Search Console e clicca su "Verifica".
                </p>
              </div>
              <button className="btn btn-primary" onClick={saveProfile} disabled={savingProfile} style={{ padding: '12px 20px', fontWeight: 700 }}>
                {savingProfile ? '⟳ Salvataggio...' : '✓ Salva configurazione SEO'}
              </button>
            </div>

            {isAdmin && (
              <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Statistiche SEO Globali (Admin)</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Utente</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Sito</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Data</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Impression</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Clic</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>CTR</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Pos.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminSeoStats.length === 0 ? (
                        <tr><td colSpan="7" style={{ padding: '12px', textAlign: 'center' }}>Nessuna statistica disponibile</td></tr>
                      ) : adminSeoStats.map((st, i) => (
                        <tr key={i}>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.email}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.title}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.record_date}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.impressions}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.clicks}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.ctr ? (st.ctr * 100).toFixed(2) + '%' : '-'}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{st.position ? parseFloat(st.position).toFixed(1) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

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
                      onBlur={e => saveConnectionSettings(c.platform, e.target.value, c.auto_publish ?? 1, c.max_posts)}
                      style={{ padding: '8px', fontSize: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: '#111', color: 'var(--text)' }} />
                    <span style={{ background: c.active ? 'var(--teal-light)' : 'var(--red-light)', color: c.active ? 'var(--teal)' : 'var(--red)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                      {c.active ? 'ATTIVO' : 'INATTIVO'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-modal" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Sincronizzazione automatica</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 500 }}>
                Il tuo sito si aggiorna automaticamente ogni 6 ore quando pubblichi nuovi contenuti sui social.
              </p>
              {site?.last_sync && (
                <p style={{ fontSize: '14px', color: 'var(--primary-dark)', fontWeight: 700 }}>
                  Ultima sincronizzazione: {new Date(site.last_sync).toLocaleString('it-IT')}
                </p>
              )}
            </div>

            <div className="glass-modal" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>🌍 Il tuo sito pubblico</h3>
              <div style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.2)', padding: '14px 18px', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: '15px', marginBottom: '16px', wordBreak: 'break-all', color: 'var(--text)' }}>{siteUrl}</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <a href={siteUrl} target="_blank" rel="noopener" className="btn btn-primary" style={{ textDecoration: 'none', padding: '12px 20px', fontWeight: 700 }}>🌍 APRI SITO</a>
                <a href={`${siteUrl}/sitemap.xml`} target="_blank" className="btn btn-outline" style={{ textDecoration: 'none', fontSize: '14px', padding: '12px 20px', fontWeight: 700 }}>Sitemap XML</a>
              </div>
            </div>
          </div>
        )}

        {tab === 'admin' && user?.role === 'admin' && (
          <AdminScreen token={token} currentUser={user} adminPrompts={adminPrompts} updatePrompt={updatePrompt} />
        )}

        {/* Modal Modifica Post */}
        {editingPost && (
          <div className="mobile-bottom-sheet" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem 1rem', overflowY: 'auto' }}>
            <div className="glass-modal" style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>✏️ Modifica</h2>
                <button onClick={() => setEditingPost(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', transition: 'background 0.2s' }}>✕</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>Titolo Principale</label>
                  <input type="text" value={editingPost.title} onChange={e => setEditingPost({...editingPost, title: e.target.value})} style={{ width: '100%', fontSize: '18px', fontWeight: 600, padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>Testo dell'Articolo</label>
                  <QuillEditor value={editingPost.body} onChange={val => setEditingPost({...editingPost, body: val})} style={{ background: '#fff', color: '#000', border: '2px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }} />
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
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
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

      {/* Mobile Bottom Navigation */}
      <div className="mobile-nav">
        <button className={`mobile-nav-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          <span style={{fontSize: '20px'}}>🏠</span> Home
        </button>
        <button className={`mobile-nav-item ${tab === 'site' ? 'active' : ''}`} onClick={() => setTab('site')}>
          <span style={{fontSize: '20px'}}>📝</span> Articoli
        </button>
        
        <button className="mobile-fab" onClick={syncNow} disabled={syncing}>
          {syncing ? '⟳' : '↻'}
        </button>
        
        <button className={`mobile-nav-item ${tab === 'sources' ? 'active' : ''}`} onClick={() => setTab('sources')}>
          <span style={{fontSize: '20px'}}>📡</span> Canali
        </button>
        <button className={`mobile-nav-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
          <span style={{fontSize: '20px'}}>🎨</span> Design
        </button>
      </div>
      
    </div>
  );
}
