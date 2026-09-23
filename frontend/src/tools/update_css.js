const fs = require('fs');
const cssPath = 'C:/Users/marcoemme/Desktop/ALLWORKS/socialtosite/frontend/src/index.css';
let css = fs.readFileSync(cssPath, 'utf8');

const newPublicCSS = `
/* =========================================================
   PUBLIC LANDING REDESIGN (Bento Grid & Glassmorphism)
   ========================================================= */
.public-site {
  --public-ink: #171917;
  --public-paper: #f3f0e8;
  --public-paper-2: #e8e4da;
  --public-coral: #ee6346;
  --public-lime: #c8ff72;
  --public-violet: #6d5ce7;
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--public-paper);
  color: var(--public-ink);
  font-family: Inter, "Helvetica Neue", Arial, sans-serif;
}
.public-site a { color: inherit; text-decoration: none; }

/* BRAND & LOGO */
.astw-mark-img { height: 38px; object-fit: contain; }
.astw-brand { display: inline-flex; align-items: center; gap: .72rem; line-height: .9; }
.astw-brand > span:last-child { display: grid; font-size: .86rem; letter-spacing: -.025em; }
.astw-brand strong { color: var(--public-ink); font-weight: 900; }
.astw-brand b { color: var(--public-coral); font-weight: 900; }
.astw-brand.is-compact .astw-mark-img { height: 26px; }

/* HEADER */
.glass-header {
  position: sticky; top: 0; z-index: 50; min-height: 76px;
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 2rem;
  padding: 0 clamp(1.2rem, 4vw, 4.5rem);
  background: rgba(243, 240, 232, 0.75);
  backdrop-filter: blur(24px); border-bottom: 1px solid rgba(23, 25, 23, 0.08);
}
.public-logo { justify-self: start; }
.glass-header > nav { display: flex; gap: clamp(1.2rem, 3vw, 2.5rem); font-size: .78rem; font-weight: 750; }
.glass-header > nav a { position: relative; transition: color 0.2s; }
.glass-header > nav a:hover { color: var(--public-coral); }
.public-header-actions { justify-self: end; display: flex; align-items: center; gap: 1.2rem; }
.public-login { font-size: .78rem; font-weight: 800; }

/* BUTTONS */
.public-button {
  display: inline-flex; align-items: center; gap: .6rem; min-height: 48px;
  padding: .75rem 1.2rem; border: 0; border-radius: 999px;
  font-family: inherit; font-size: .78rem; font-weight: 850; letter-spacing: .02em; text-transform: uppercase;
  cursor: pointer; transition: transform .25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow .2s ease;
}
.public-button:hover { transform: translateY(-2px); }
.public-button svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; }
.public-button-dark { color: #fff; background: var(--public-ink); box-shadow: 0 4px 12px rgba(23,25,23,.15); }
.public-button-dark:hover { box-shadow: 0 9px 24px rgba(23,25,23,.25); }
.public-button-coral { color: #fff; background: var(--public-coral); box-shadow: 0 8px 24px rgba(238,99,70,.25); }
.public-button-coral:hover { box-shadow: 0 12px 32px rgba(238,99,70,.35); }
.public-button-outline { background: transparent; border: 2px solid var(--border); color: var(--public-ink); }
.public-button-outline:hover { border-color: var(--public-ink); }
.public-button-light { color: var(--public-ink); background: #fff; }

/* MAIN CONTENT BENTO HERO */
.public-main-content { padding: clamp(1.5rem, 4vw, 3rem) clamp(1.2rem, 4vw, 3rem); display: grid; gap: clamp(1.5rem, 4vw, 3rem); }
.public-hero-bento { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); grid-template-rows: auto auto; gap: 1.5rem; }

.glass-panel-hero {
  position: relative; padding: clamp(2rem, 5vw, 4rem);
  background: linear-gradient(145deg, rgba(255,255,255,0.6), rgba(255,255,255,0.2));
  backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.5);
  border-radius: 32px; box-shadow: 0 24px 48px rgba(0,0,0,0.04);
  display: flex; flex-direction: column; justify-content: center;
}
.public-hero-visual {
  background: radial-gradient(circle at 100% 0%, rgba(200,255,114,0.4), transparent 50%),
              linear-gradient(145deg, rgba(255,255,255,0.7), rgba(255,255,255,0.1));
  display: flex; align-items: center; justify-content: center; min-height: 400px;
}
.public-kicker { display: inline-flex; align-items: center; gap: .55rem; color: #5b5d57; font-size: .68rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
.public-kicker i { width: 7px; height: 7px; border-radius: 50%; background: var(--public-coral); box-shadow: 0 0 0 5px rgba(238,99,70,.12); }
.public-hero-bento h1 { margin: 1.35rem 0 1.5rem; color: var(--public-ink); font-size: clamp(2.8rem, 5vw, 5rem); font-weight: 880; line-height: .9; letter-spacing: -.05em; text-wrap: balance; }
.public-hero-bento h1 em { display: block; color: var(--public-coral); font-family: Georgia, "Times New Roman", serif; font-weight: 500; font-style: italic; }
.public-hero-bento p { max-width: 580px; margin: 0 0 2rem; color: #5f625d; font-size: clamp(1rem, 1.5vw, 1.2rem); line-height: 1.6; }
.public-hero-actions { display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
.public-channel-row { display: flex; align-items: center; gap: .52rem; }
.public-channel-row > span { margin-right: .35rem; color: #7b7c77; font-size: .65rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.public-channel-row b { min-width: 31px; height: 31px; display: grid; place-items: center; padding: 0 .45rem; border-radius: 8px; color: #fff; font-size: .58rem; letter-spacing: -.02em; }
.channel-instagram { background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); }
.channel-tiktok { background: #000; }
.channel-youtube { background: #ff0000; }
.channel-facebook { background: #1877f2; }

/* VISUAL FLOW OVERRIDES */
.float-item { position: absolute; box-shadow: 0 14px 30px rgba(0,0,0,0.1); border-radius: 16px; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); padding: 12px 18px; display: flex; align-items: center; gap: 12px; }
.flow-source-one { top: 15%; left: 10%; animation: float 6s ease-in-out infinite; }
.flow-source-two { bottom: 25%; right: 5%; animation: float 8s ease-in-out infinite reverse; }
.flow-status { bottom: 10%; left: 15%; animation: float 7s ease-in-out infinite 1s; }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }

.flow-site-card {
  width: 80%; background: #fff; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); overflow: hidden; transform: rotate(2deg) scale(0.95); transition: transform 0.3s ease;
}
.flow-site-card:hover { transform: rotate(0deg) scale(1); }
.flow-browser { display: flex; gap: 6px; padding: 12px; background: #f1f1f1; align-items: center; }
.flow-browser i { width: 10px; height: 10px; border-radius: 50%; background: #ddd; }
.flow-browser i:first-child { background: #ff5f56; } .flow-browser i:nth-child(2) { background: #ffbd2e; } .flow-browser i:nth-child(3) { background: #27c93f; }
.flow-browser span { margin-left: auto; font-size: 10px; color: #888; font-weight: 600; }
.flow-site-hero { padding: 30px 20px; background: var(--public-paper-2); text-align: center; }
.flow-site-hero small { font-size: 8px; font-weight: 800; letter-spacing: 0.1em; color: var(--public-coral); display: block; margin-bottom: 6px; }
.flow-site-hero strong { font-size: 18px; line-height: 1.2; color: var(--public-ink); }
.flow-site-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 15px; }
.flow-site-grid span { height: 40px; background: #f3f0e8; border-radius: 6px; }

/* PROCESS BENTO */
.public-process-bento { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
.glass-panel-feature {
  padding: 2rem; background: rgba(255,255,255,0.7); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.5); border-radius: 24px; display: flex; flex-direction: column; gap: 1rem;
}
.process-icon { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 12px; background: var(--public-coral); color: #fff; font-size: 24px; box-shadow: 0 8px 20px rgba(238,99,70,.3); }
.process-text h3 { margin: 0 0 .5rem; font-size: 1.2rem; font-weight: 850; letter-spacing: -.02em; color: var(--public-ink); }
.process-text p { margin: 0; font-size: .95rem; line-height: 1.5; color: #5f625d; }

/* COMPACT SHOWCASE */
.public-showcase-compact { padding: clamp(3rem, 5vw, 5rem) clamp(2rem, 5vw, 4rem); background: var(--public-ink); border-radius: 32px; color: #fff; display: flex; flex-direction: column; gap: 3rem; }
.showcase-header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
.showcase-header h2 { margin: 0; font-size: clamp(2.5rem, 4vw, 4rem); letter-spacing: -.05em; line-height: 1; }
.showcase-tabs { display: inline-flex; gap: 0.5rem; padding: 0.5rem; background: rgba(255,255,255,0.1); border-radius: 999px; }
.showcase-tabs button { padding: 0.8rem 1.5rem; border: none; border-radius: 999px; background: transparent; color: rgba(255,255,255,0.6); font-weight: 700; cursor: pointer; transition: all 0.2s; }
.showcase-tabs button.active { background: #fff; color: var(--public-ink); }
.signature-preview { margin: 0 auto; width: 100%; max-width: 1000px; border-radius: 24px; overflow: hidden; background: #fff; color: var(--public-ink); }
.signature-topbar { display: flex; justify-content: space-between; padding: 1.5rem 2rem; border-bottom: 1px solid rgba(0,0,0,0.05); }
.signature-topbar strong { font-weight: 900; font-size: 1.2rem; }
.signature-topbar div { display: flex; gap: 1.5rem; font-size: 0.9rem; font-weight: 600; }
.signature-visual { position: relative; padding: 4rem 2rem; background: var(--public-paper-2); text-align: center; }
.signature-content { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.signature-content small { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; }
.signature-content h3 { font-size: 3rem; line-height: 1.1; margin: 0; font-family: Georgia, serif; }
.signature-content button { padding: 0.8rem 1.5rem; background: var(--public-ink); color: #fff; border: none; border-radius: 999px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.5rem; }
.signature-bottom { display: grid; grid-template-columns: 1fr 1fr; padding: 2rem; gap: 2rem; background: #fff; }
.signature-paths small, .signature-stories small { display: block; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 1rem; }
.signature-paths div { display: flex; flex-direction: column; gap: 0.8rem; }
.signature-paths span { display: flex; align-items: center; gap: 1rem; font-weight: 700; font-size: 1.1rem; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 0.8rem; }
.signature-paths i { font-style: normal; color: var(--text-muted); font-size: 0.9rem; }
.signature-stories { display: flex; gap: 1rem; }
.signature-stories article { flex: 1; }
.story-art { height: 140px; border-radius: 12px; background: var(--public-paper-2); margin-bottom: 0.8rem; }

/* PRICING & CTA GRID */
.public-bottom-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 1.5rem; }
.public-pricing-compact { padding: 3rem; background: rgba(255,255,255,0.7); backdrop-filter: blur(12px); border-radius: 32px; border: 1px solid rgba(255,255,255,0.5); }
.pricing-grid-compact { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 2rem; }
.pricing-card { padding: 1.5rem; border-radius: 20px; background: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.8); display: flex; flex-direction: column; gap: 1.5rem; justify-content: space-between; }
.pricing-card-featured { background: #fff; border: 2px solid var(--public-coral); position: relative; box-shadow: 0 12px 30px rgba(238,99,70,0.15); transform: translateY(-5px); }
.pricing-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--public-coral); color: #fff; padding: 4px 12px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
.pricing-head h3 { margin: 0 0 0.5rem; font-size: 1.5rem; color: var(--public-ink); }
.pricing-head p { margin: 0; font-size: 0.85rem; color: #5f625d; line-height: 1.4; }
.pricing-card .public-button { width: 100%; justify-content: center; }

.public-network-cta { padding: 3rem; background: var(--public-violet); border-radius: 32px; color: #fff; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; text-align: center; }
.network-rings { position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%); }
.cta-content { position: relative; z-index: 2; display: flex; flex-direction: column; gap: 2rem; align-items: center; }
.cta-content h2 { margin: 0; font-size: clamp(2rem, 3vw, 3rem); line-height: 1; letter-spacing: -.03em; }
.cta-actions { display: flex; flex-direction: column; gap: 1rem; align-items: center; }
.cta-actions a { color: rgba(255,255,255,0.8); font-size: 0.9rem; font-weight: 600; text-decoration: underline; }

/* FOOTER */
.public-footer { padding: 3rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.public-footer p { color: var(--text-muted); font-size: 0.9rem; margin: 0; }
.public-footer nav { display: flex; gap: 1.5rem; font-size: 0.85rem; font-weight: 600; margin: 1rem 0; }
.public-footer nav a { color: var(--public-ink); }
.public-footer small { color: #aaa; font-size: 0.8rem; }

/* MEDIA QUERIES */
@media (max-width: 1100px) {
  .public-hero-bento { grid-template-columns: 1fr; }
  .public-bottom-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .public-process-bento, .pricing-grid-compact { grid-template-columns: 1fr; }
  .signature-bottom { grid-template-columns: 1fr; }
  .glass-header > nav { display: none; }
  .public-hero-bento h1 { font-size: 2.5rem; }
}
`;

// Remove the old .public-site block which starts at 1066.
// Also remove old pricing and other scattered public- elements.
// To do this safely, we will just filter out any block that looks like old public CSS 
// Or actually it's easier to just split at .public-site and drop everything until the end,
// EXCEPT we need to preserve .prompt-version-bar and .admin-engine-diagnosis if they are there.

// Let's just find the index of ".public-site {"
const startIdx = css.indexOf('.public-site {');

// Find the index of ".prompt-version-bar" which seems to be after the main public css
const promptIdx = css.indexOf('.prompt-version-bar');
let preservedEnd = '';
if (promptIdx !== -1 && promptIdx > startIdx) {
  preservedEnd = css.substring(promptIdx);
} else {
  // Try to find `.pro-site-builder` media query block which might be at the end
  const proSiteIdx = css.indexOf('.pro-site-builder__workspace > nav button');
  if (proSiteIdx !== -1 && proSiteIdx > startIdx) {
     // Backtrack to the media query if possible, or just keep it
     preservedEnd = css.substring(css.lastIndexOf('@media', proSiteIdx));
  }
}

// More precise: we know the public styles are generally grouped.
// To avoid dropping admin CSS, we'll use regex to remove only classes starting with .public- and .showcase-
const cssLines = css.split('\\n');
let filteredLines = [];
let skip = false;

for (let i = 0; i < cssLines.length; i++) {
  const line = cssLines[i];
  if (line.includes('.public-site {') || line.includes('/* ── Piani Tariffari')) {
    skip = true;
  }
  if (skip && line.startsWith('.') && !line.startsWith('.public') && !line.startsWith('.showcase') && !line.startsWith('.astw') && !line.startsWith('.channel-') && !line.startsWith('.pricing-') && !line.startsWith('.flow-') && !line.startsWith('.process-') && !line.startsWith('.signature-') && !line.startsWith('.network-')) {
    // we found a class that doesn't seem to belong to the public landing page!
    skip = false;
  }
  if (!skip) {
    filteredLines.push(line);
  }
}

// Actually, regex filtering might be brittle.
// Let's just append newPublicCSS to the END of the file!
// CSS specificity and the cascading nature means our new styles will override the old ones.
// We just need to make sure our new styles don't conflict. 
// BUT appending leaves dead code. Let's do the append for absolute safety.

const finalCSS = css + "\\n" + newPublicCSS;
fs.writeFileSync(cssPath, finalCSS);
console.log("CSS updated successfully.");
