const fs = require('fs');
const file = 'frontend/src/screens/DashboardScreen.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Remove "Cerca nuovi contenuti" button
const searchBtnStart = code.indexOf('<div className="page-actions">');
if (searchBtnStart > -1) {
    const searchBtnEnd = code.indexOf('</div>', searchBtnStart) + 6;
    code = code.substring(0, searchBtnStart) + '<div className="page-actions"></div>' + code.substring(searchBtnEnd);
}

// 2. Replace rebuildSeoFoundation
const rebuildStart = code.indexOf('async function rebuildSeoFoundation');
if (rebuildStart > -1) {
    const rebuildEnd = code.indexOf('  }', rebuildStart) + 3;
    const newRebuildLogic = `  const [seoPreview, setSeoPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  async function generateSeoPreview() {
    setLoadingPreview(true);
    setSyncMsg(null);
    try {
      const res = await apiFetch('/api/index.php?action=preview-seo-foundation', { method: 'POST', body: JSON.stringify({}) }, token);
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
      await apiFetch('/api/index.php?action=save-seo-foundation', { method: 'POST', body: JSON.stringify({ seo_foundation: seoPreview }) }, token);
      await loadData();
      setSeoPreview(null);
      setSyncMsg({ ok: true, text: 'Pagine SEO fondamentali salvate con successo.' });
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message });
    }
    setSavingProfile(false);
  }`;
    code = code.substring(0, rebuildStart) + newRebuildLogic + code.substring(rebuildEnd);
}

// 3. Update the button to use generateSeoPreview
// Wait, the button was modified with add_confirm.js: 
// onClick={() => { if (window.confirm('...')) rebuildSeoFoundation(); }} disabled={savingProfile}>{savingProfile ? 'Aggiorno...' : 'Rigenera pagine fondamentali'}
const oldBtnRegex = /onClick=\{\(\) => \{ if \(window\.confirm\('[^']+'\)\) rebuildSeoFoundation\(\); \}\} disabled=\{savingProfile\}>\{savingProfile \? 'Aggiorno\.\.\.' : 'Rigenera pagine fondamentali'\}/g;
const newBtn = `onClick={() => generateSeoPreview()} disabled={loadingPreview}>{loadingPreview ? 'Generazione anteprima...' : 'Rigenera pagine fondamentali'}`;
code = code.replace(oldBtnRegex, newBtn);

// What if the button still uses the original onClick?
const oldBtnRegex2 = /onClick=\{rebuildSeoFoundation\} disabled=\{savingProfile\}>\{savingProfile \? 'Aggiorno\.\.\.' : 'Rigenera pagine fondamentali'\}/g;
code = code.replace(oldBtnRegex2, newBtn);

// 4. Add the modal at the end of the DashboardScreen div
const modalJSX = `
      {seoPreview && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content glass-modal" style={{ background: 'var(--bg)', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
            <h2 style={{ marginTop: 0, color: 'var(--text)' }}>Anteprima Pagine Fondamentali</h2>
            <p style={{ color: 'var(--text-muted)' }}>Controlla i testi generati prima di confermare il salvataggio. Le pagine esistenti verranno sovrascritte.</p>
            
            <div style={{ display: 'grid', gap: '1.5rem', margin: '1.5rem 0' }}>
              {(seoPreview.pages || []).map(page => (
                <div key={page.slug} style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: '0.75rem', background: 'var(--surface)' }}>
                  <h3 style={{ margin: '0 0 0.5rem', color: 'var(--primary)' }}>{page.title}</h3>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', padding: '0.4rem 0.6rem', background: 'var(--bg)', borderRadius: '6px', display: 'inline-block' }}>Percorso: /{page.slug}</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.6 }}>{page.content}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-outline" onClick={() => setSeoPreview(null)} disabled={savingProfile}>Annulla</button>
              <button className="btn btn-primary" onClick={saveSeoFoundation} disabled={savingProfile}>{savingProfile ? 'Salvataggio...' : 'Conferma e Salva'}</button>
            </div>
          </div>
        </div>
      )}
`;

const closingDivIndex = code.lastIndexOf('</div>\n    </div>\n  );');
if (closingDivIndex > -1) {
    code = code.substring(0, closingDivIndex) + modalJSX + code.substring(closingDivIndex);
}

fs.writeFileSync(file, code, 'utf8');
console.log('Script completed.');
