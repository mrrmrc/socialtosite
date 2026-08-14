import React, { useEffect, useMemo, useState } from 'react';
import { ProSiteBuilder } from './ProSiteBuilder';

const PLAN_ORDER = { base: 0, professional: 1, agency: 2 };

export function normalizePlan(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'agency') return 'agency';
  if (raw === 'professional' || raw === 'pro') return 'professional';
  return 'base';
}

export function hasPlan(user, minimum = 'base') {
  const current = normalizePlan(user?.plan);
  const required = normalizePlan(minimum);
  return (PLAN_ORDER[current] ?? 0) >= (PLAN_ORDER[required] ?? 0);
}

function installCompactMenuStyle() {
  if (document.getElementById('linkseoweb-plan-ui-style')) return;
  const style = document.createElement('style');
  style.id = 'linkseoweb-plan-ui-style';
  style.textContent = `
    .desktop-sidebar { overflow: hidden !important; }
    .sidebar-navigation { overflow-y: visible !important; scrollbar-width: none !important; min-height: 0 !important; }
    .sidebar-navigation::-webkit-scrollbar { display: none !important; }
    .sidebar-navigation .nav-section { margin-bottom: 4px !important; }
    .sidebar-navigation .nav-group { margin: 4px 10px 3px !important; font-size: 10px !important; }
    .sidebar-navigation .nav-item { min-height: 40px !important; padding-top: 6px !important; padding-bottom: 6px !important; }
    .sidebar-navigation .nav-copy small { font-size: 10px !important; line-height: 1.15 !important; }
    .sidebar-navigation .nav-copy strong { font-size: 12px !important; }
    .sidebar-navigation > div[style*="margin-top: auto"] { margin-top: 4px !important; padding: 4px 12px !important; }
    .professional-builder-nav-entry .nav-icon { font-size: 18px; }
    .professional-plan-select { width: 100%; padding: 7px; font-size: 12px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); }
  `;
  document.head.appendChild(style);
}

function replacePublicSiteLabels(root) {
  root.querySelectorAll('a,button').forEach(node => {
    const label = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (/vai al sito pubblico|apri il sito pubblico|controlla il sito|vedi il sito pubblico/i.test(label)) {
      node.textContent = "Vai all'HUB LinkSeoWeb";
      if (node.tagName === 'A') {
        node.setAttribute('href', '/scopri');
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });
}

function addProfessionalBuilderMenu(root, enabled, openBuilder) {
  const existing = root.querySelector('.professional-builder-nav-entry');
  if (!enabled) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const settingsButton = [...root.querySelectorAll('.sidebar-navigation .nav-item')]
    .find(node => /Impostazioni/i.test(node.textContent || ''));
  if (!settingsButton) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'nav-item professional-builder-nav-entry';
  button.innerHTML = '<span class="nav-icon">🎨</span><span class="nav-copy"><strong>Builder grafico</strong><small>Personalizza il tuo sito</small></span>';
  button.addEventListener('click', openBuilder);
  settingsButton.insertAdjacentElement('afterend', button);
}

function addProfessionalSettingsCard(root, enabled, openBuilder, slug) {
  const grid = root.querySelector('.settings-hub-grid');
  const existing = root.querySelector('.professional-settings-builder');
  if (!grid || !enabled) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'professional-settings-builder';
  button.innerHTML = `<span>🎨</span><div><strong>Modifica grafica del sito</strong><small>Temi, colori, font e layout${slug ? ` · /${slug}` : ''}</small></div><i>→</i>`;
  button.addEventListener('click', openBuilder);
  grid.appendChild(button);
}

function normalizeAdminPlanControls(root) {
  root.querySelectorAll('input[type="text"]').forEach(input => {
    if (input.dataset.professionalPlanSource === '1') return;
    const container = input.parentElement;
    if (!container) return;
    const roleSelect = container.querySelector('select');
    if (!roleSelect) return;
    const roleOptions = [...roleSelect.options].map(option => option.value);
    if (!roleOptions.includes('user') || !roleOptions.includes('admin')) return;

    const currentRaw = String(input.value || '').trim().toLowerCase();
    const normalized = normalizePlan(currentRaw);
    input.dataset.professionalPlanSource = '1';
    input.style.display = 'none';

    const select = document.createElement('select');
    select.className = 'professional-plan-select';
    select.setAttribute('aria-label', 'Piano utente');
    [['base','Base'],['professional','Professional'],['agency','Agency']].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = normalized;

    const persist = value => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    };

    select.addEventListener('change', event => persist(event.target.value));
    input.insertAdjacentElement('afterend', select);

    if (currentRaw !== normalized) {
      window.setTimeout(() => persist(normalized), 0);
    }
  });
}

function applyBaseDesignGate(root, enabled) {
  const advancedLabels = ['Rigenera Proposte Layout','Genera Proposte Layout','Apri Studio','Design avanzato','Personalizza design','Builder grafico'];
  root.querySelectorAll('button').forEach(button => {
    if (button.classList.contains('professional-builder-nav-entry') || button.classList.contains('professional-settings-builder')) return;
    const label = (button.textContent || '').trim();
    const matches = advancedLabels.some(item => label.toLowerCase().includes(item.toLowerCase()));
    if (!matches) return;
    if (enabled) {
      if (button.dataset.planGate === 'professional') {
        button.disabled = false;
        button.removeAttribute('title');
        delete button.dataset.planGate;
      }
      return;
    }
    button.disabled = true;
    button.dataset.planGate = 'professional';
    button.title = 'Disponibile con il piano Professional';
    if (!/PROFESSIONAL/i.test(label)) button.textContent = `${label} · PROFESSIONAL`;
  });
}

export function PlanExperience({ user }) {
  const [resolvedUser, setResolvedUser] = useState(user || null);
  const plan = useMemo(() => normalizePlan(resolvedUser?.plan), [resolvedUser?.plan]);
  const advancedDesign = hasPlan(resolvedUser, 'professional');
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    setResolvedUser(user || null);
    const token = localStorage.getItem('sts_token');
    if (!token) return;
    fetch('/api/current_plan.php', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('plan-sync-failed')))
      .then(data => {
        if (!data?.user) return;
        setResolvedUser(data.user);
        localStorage.setItem('sts_user', JSON.stringify(data.user));
      })
      .catch(() => {});
  }, [user?.id, user?.plan]);

  useEffect(() => {
    installCompactMenuStyle();
    const openBuilder = () => setBuilderOpen(true);
    const enhance = () => {
      replacePublicSiteLabels(document);
      normalizeAdminPlanControls(document);
      addProfessionalBuilderMenu(document, advancedDesign, openBuilder);
      addProfessionalSettingsCard(document, advancedDesign, openBuilder, resolvedUser?.slug || '');
      applyBaseDesignGate(document, advancedDesign);
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [advancedDesign, resolvedUser?.slug]);

  if (!resolvedUser) return null;

  const labels = {
    base: { title: 'BASE', subtitle: 'Sito standard' },
    professional: { title: 'PROFESSIONAL', subtitle: 'Builder grafico attivo' },
    agency: { title: 'AGENCY', subtitle: 'Gestione avanzata' },
  };
  const meta = labels[plan];

  return (
    <>
      <ProSiteBuilder user={resolvedUser} open={builderOpen && advancedDesign} onClose={() => setBuilderOpen(false)} />
      <div
        title={`Piano ${meta.title}: ${meta.subtitle}`}
        style={{position:'fixed',right:18,bottom:18,zIndex:1000,display:'flex',alignItems:'center',gap:8,padding:'8px 11px',borderRadius:999,background:'rgba(15,23,42,.92)',color:'#fff',boxShadow:'0 10px 30px rgba(15,23,42,.2)',fontSize:11,fontWeight:800,letterSpacing:'.04em',backdropFilter:'blur(10px)'}}
      >
        <span style={{ opacity: .65 }}>PIANO</span>
        <strong>{meta.title}</strong>
        {advancedDesign && <span style={{ opacity: .7 }}>· DESIGN</span>}
      </div>
    </>
  );
}
