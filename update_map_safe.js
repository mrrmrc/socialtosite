const fs = require('fs');
let code = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

// 1. Replace SiteMapGraph
const start = code.indexOf('function SiteMapGraph(');
let end = code.indexOf('import StrategyInterview', start);
if (end === -1) {
    end = code.indexOf('export function DashboardScreen', start);
}

if (start > -1 && end > -1) {
    const newSiteMapGraph = `function SiteMapGraph({ posts, siteUrl, siteTitle, foundationPages = [] }) {
  const visiblePosts = posts.filter(post => Number(post.published) === 1);
  const graphLabels = foundationPages.length > 0 ? foundationPages : [{ title: 'I tuoi articoli', slug: '' }];

  return (
    <div className="sitemap-tree" style={{ padding: '1.5rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </div>
        <div>
          <a href={siteUrl} target="_blank" rel="noopener" style={{ fontWeight: '800', fontSize: '1.15rem', color: 'var(--text)', textDecoration: 'none' }}>{siteTitle || 'Spazio Vivo'}</a>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dominio principale ({siteUrl.replace(/^https?:\\/\\//, '')})</div>
        </div>
      </div>
      
      <div style={{ paddingLeft: '1.25rem', borderLeft: '2px solid var(--border-strong)', marginLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {graphLabels.map((page, pIndex) => {
          const assignedPosts = foundationPages.length > 0 
            ? visiblePosts.filter((_, i) => i % Math.max(foundationPages.length, 1) === pIndex)
            : visiblePosts;
            
          return (
            <div key={page.slug || pIndex} className="sitemap-node">
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ position: 'absolute', left: '-1.25rem', top: '50%', width: '1rem', height: '2px', background: 'var(--border-strong)' }} />
                <a href={page.slug ? \`\${siteUrl}/\${page.slug}\` : siteUrl} target="_blank" rel="noopener" style={{ padding: '0.4rem 0.8rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: '700', color: 'var(--primary)', textDecoration: 'none', fontSize: '0.95rem' }}>
                  {page.title}
                </a>
              </div>
              
              {assignedPosts.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', borderLeft: '1px dashed var(--border)', marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {assignedPosts.map((post, postIdx) => (
                    <div key={post.slug || post.id || postIdx} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <div style={{ position: 'absolute', left: '-1.5rem', top: '50%', width: '1.25rem', height: '1px', background: 'var(--border)' }} />
                      <a href={\`\${siteUrl}/post/\${post.slug}\`} target="_blank" rel="noopener" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
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

`;
    code = code.substring(0, start) + newSiteMapGraph + code.substring(end);
} else {
    console.log("Could not find SiteMapGraph bounds", start, end);
}

// 2. Hide "Struttura e Pagine fondamentali" for base plan
const structStart = code.indexOf('<section className="card" style={{ background: \'var(--surface)\', border: \'1px solid var(--border)\' }}>\n                  <header style={{ marginBottom: \'1.5rem\' }}>\n                    <h3 style={{ margin: 0, fontSize: \'1.25rem\', color: \'var(--text)\' }}>Struttura e Pagine fondamentali</h3>');

if (structStart > -1) {
    const structEnd = code.indexOf('</section>', structStart) + 10;
    const oldStruct = code.substring(structStart, structEnd);
    code = code.substring(0, structStart) + '{!isBasePlan && (\n              ' + oldStruct.replace(/\\n/g, '\n  ') + '\n              )}' + code.substring(structEnd);
} else {
    console.log("Struttura card not found!");
}

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', code, 'utf8');
console.log('Done!');
