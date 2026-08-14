import React, { useEffect, useMemo, useState } from 'react';
import { ProSiteBuilder } from './ProSiteBuilder';

const PLAN_ORDER = { base: 0, pro: 1, agency: 2 };

export function normalizePlan(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'agency') return 'agency';
  if (raw === 'pro') return 'pro';
  return 'base';
}

export function hasPlan(user, minimum = 'base') {
  const current = normalizePlan(user?.plan);
  return (PLAN_ORDER[current] ?? 0) >= (PLAN_ORDER[minimum] ?? 0);
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
    .pro-builder-nav-entry .nav-icon { font-size: 18px; }
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

function addProBuilderMenu(root, enabled, openBuilder) {
  const existing = root.querySelector('.pro-builder-nav-entry');
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
  button.className = 'nav-item pro-builder-nav-entry';
  button.innerHTML = '<span class="nav-icon">🎨</span><span class="nav-copy"><strong>Builder grafico</strong><small>Temi, layout, colori e CSS</small></span>';
  button.addEventListener('click', openBuilder);
  settingsButton.insertAdjacentElement('afterend', button);
}

function applyBaseDesignGate(root, enabled) {
  const advancedLabels = ['Rigenera Proposte Layout','Genera Proposte Layout','Apri Studio','Design avanzato','Personalizza design','Builder grafico'];
  root.querySelectorAll('button').forEach(button => {
    if (button.classList.contains('pro-builder-nav-entry')) return;
    const label = (button.textContent || '').trim();
    const matches = advancedLabels.some(item => label.toLowerCase().includes(item.toLowerCase()));
    if (!matches) return;
    if (enabled) {
      if (button.dataset.planGate === 'pro') {
        button.disabled = false;
        button.removeAttribute('title');
        delete button.dataset.planGate;
      }
      return;
    }
    button.disabled = true;
    button.dataset.planGate = 'pro';
    button.title = 'Disponibile con il piano Pro';
    if (!/\bPRO\b/.test(label)) button.textContent = `${label} · PRO`;
  });
}

export function PlanExperience({ user }) {
  const plan = useMemo(() => normalizePlan(user?.plan), [user?.plan]);
  const advancedDesign = hasPlan(user, 'pro');
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    installCompactMenuStyle();
    const openBuilder = () => setBuilderOpen(true);
    const enhance = () => {
      replacePublicSiteLabels(document);
      addProBuilderMenu(document, advancedDesign, openBuilder);
      applyBaseDesignGate(document, advancedDesign);
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [advancedDesign]);

  if (!user) return null;

  const labels = {
    base: { title: 'BASE', subtitle: 'Sito standard' },
    pro: { title: 'PRO', subtitle: 'Design avanzato attivo' },
    agency: { title: 'AGENCY', subtitle: 'Gestione avanzata' },
  };
  const meta = labels[plan];

  return (
    <>
      <ProSiteBuilder user={user} open={builderOpen && advancedDesign} onClose={() => setBuilderOpen(false)} />
      <div
        title={`Piano ${meta.title}: ${meta.subtitle}`}
        style={{position:'fixed',right:18,bottom:18,zIndex:1000,display:'flex',alignItems:'center',gap:8,padding:'8px 11px',borderRadius:999,background:'rgba(15,23,42,.92)',color:'#fff',boxShadow:'0 10px 30px rgba(15,23,42,.2)',fontSize:11,fontWeight:800,letterSpacing:'.04em',backdropFilter:'blur(10px)'}}
      >
        <span style={{ opacity: .65 }}>PIANO</span>
        <strong>{meta.title}</strong>
        {advancedDesign && <span style={{ opacity: .7 }}>· DESIGN PRO</span>}
      </div>
    </>
  );
}
