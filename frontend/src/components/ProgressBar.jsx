import React from 'react';

export function ProgressBar({ step }) {
  const pct = { 1: 33, 2: 66, 3: 100 }[step] || 0;
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '6px' }}>Passo {step} di 3</div>
      <div style={{ height: '4px', background: 'var(--gray-light)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gradient)', borderRadius: '2px', transition: 'width .4s' }} />
      </div>
    </div>
  );
}
