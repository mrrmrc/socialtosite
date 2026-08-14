import React, { useEffect, useMemo } from 'react';

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

function replacePublicSiteLabels(root) {
  const replacements = new Map([
    ['Vai al sito pubblico', "Vai all'Hub LinkSeoWeb"],
    ['Apri il sito pubblico ↗', "Vai all'Hub LinkSeoWeb ↗"],
    ['Controlla il sito ↗', "Vai all'Hub LinkSeoWeb ↗"],
    ['Vedi il sito pubblico', "Vai all'Hub LinkSeoWeb"],
  ]);

  root.querySelectorAll('a,button').forEach(node => {
    const current = (node.textContent || '').trim();
    if (replacements.has(current)) node.textContent = replacements.get(current);

    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      if ((href === '/scopri' || href.endsWith('/scopri')) && !/Hub LinkSeoWeb/i.test(node.textContent || '')) {
        node.textContent = "Vai all'Hub LinkSeoWeb";
      }
    }
  });
}

function applyBaseDesignGate(root, enabled) {
  const advancedLabels = [
    'Rigenera Proposte Layout',
    'Genera Proposte Layout',
    'Apri Studio',
    'Design avanzato',
    'Personalizza design',
  ];

  root.querySelectorAll('button').forEach(button => {
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

  useEffect(() => {
    const enhance = () => {
      replacePublicSiteLabels(document);
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
    <div
      title={`Piano ${meta.title}: ${meta.subtitle}`}
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 11px',
        borderRadius: 999,
        background: 'rgba(15,23,42,.92)',
        color: '#fff',
        boxShadow: '0 10px 30px rgba(15,23,42,.2)',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '.04em',
        backdropFilter: 'blur(10px)',
      }}
    >
      <span style={{ opacity: .65 }}>PIANO</span>
      <strong>{meta.title}</strong>
      {advancedDesign && <span style={{ opacity: .7 }}>· DESIGN PRO</span>}
    </div>
  );
}
