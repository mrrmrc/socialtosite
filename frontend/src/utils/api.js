export const API_BASE = window.API_BASE || '';

export async function apiFetch(path, opts = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const data = await r.json();
  if (r.status === 401) { localStorage.removeItem('sts_token'); window.location.reload(); return; }
  if (!r.ok) throw new Error(data.error || `Errore server (${r.status})`);
  return data;
}

export const SOCIAL = {
  instagram: { icon: 'https://cdn.simpleicons.org/instagram/E4405F', label: 'Instagram', color: '#E1306C' },
  tiktok:    { icon: 'https://cdn.simpleicons.org/tiktok/000000', label: 'TikTok',    color: '#010101' },
  facebook:  { icon: 'https://cdn.simpleicons.org/facebook/1877F2', label: 'Facebook',  color: '#1877F2' },
  youtube:   { icon: 'https://cdn.simpleicons.org/youtube/FF0000', label: 'YouTube',   color: '#FF0000' },
  website:   { icon: 'https://cdn.simpleicons.org/googleearth/4285F4', label: 'Sito Web', color: '#4285F4' },
};

export const SITE_LAYOUTS = [
  { id: 'classic', name: 'Corporate Apple', desc: 'Design minimalista premium, sfondi bianchi, box soft e tipografia pulita.', emoji: '🍏', colors: ['#FBFBFD','#1D1D1F','#FFFFFF'], bars: ['80%','60%','40%'] },
  { id: 'authority', name: 'Tech / Neon', desc: 'Scurissimo con Glassmorphism, accenti neon e look super-moderno.', emoji: '🔮', colors: ['#09090B','#FAFAFA','#1a1a24'], bars: ['90%','70%','50%'] },
  { id: 'portfolio', name: 'Portfolio Masonry', desc: 'Layout a griglia asimmetrica stile Pinterest, ideale per creativi.', emoji: '🎨', colors: ['#FAF9F6','#1C1C1E','#FFFFFF'], bars: ['40%','40%','40%'] },
  { id: 'magazine', name: 'Magazine Premium', desc: 'Griglia complessa per news editoriali con hero section dinamica.', emoji: '📰', colors: ['#FFFFFF','#000000','#EAEAEA'], bars: ['30%','30%','30%'] },
  { id: 'brutalist', name: 'Bold & Brutalist', desc: 'Testi giganteschi, bordi netti, giallo/nero per impatto.', emoji: '🚧', colors: ['#FFF300','#000000','#FFFFFF'], bars: ['100%','80%','60%'] },
  { id: 'ecommerce', name: 'E-commerce Vibe', desc: 'Card prodotto pulite, adatte a vendere.', emoji: '🛍️', colors: ['#F4F5F7','#172B4D','#FFFFFF'], bars: ['70%','50%','30%'] },
  { id: 'wedding', name: 'Wedding / Elegant', desc: 'Font serif romantici, colori pastello, eleganza.', emoji: '💍', colors: ['#FDFBFA','#4A403A','#FFFFFF'], bars: ['60%','40%','20%'] },
  { id: 'fitness', name: 'Fitness / Aggressive', desc: 'Rosso scuro e nero, obliquo e potente.', emoji: '💪', colors: ['#111111','#FFFFFF','#1A1A1A'], bars: ['90%','70%','50%'] },
  { id: 'restaurant', name: 'Restaurant / Food', desc: 'Colori caldi, tondeggiante, stile menù.', emoji: '🍽️', colors: ['#FBF8F1','#2D312E','#FFFFFF'], bars: ['80%','60%','40%'] },
  { id: 'agency', name: 'Agency / Studio', desc: 'Scurissimo, header diviso a metà, molto testo.', emoji: '💼', colors: ['#000000','#FFFFFF','#111111'], bars: ['100%','50%','25%'] },
  { id: 'zen', name: 'Minimal Zen', desc: 'Spazi vuoti, pulizia estrema, stile giapponese.', emoji: '🧘', colors: ['#EBEBEB','#222222','#FFFFFF'], bars: ['50%','30%','10%'] },
  { id: 'vaporwave', name: 'Retro 90s Vaporwave', desc: 'Colori fluo, griglie visibili, stile hacker.', emoji: '🕹️', colors: ['#01CDFE','#05FFA1','#B967FF'], bars: ['90%','80%','70%'] },
  { id: 'realestate', name: 'Modern Real Estate', desc: 'Foto grandi, box info puliti e squadrati.', emoji: '🏠', colors: ['#F4F4F4','#2B2B2B','#FFFFFF'], bars: ['80%','60%','40%'] },
  { id: 'blogger', name: 'Blogger Chic', desc: 'Stile femminile, testi centrali e font curati.', emoji: '💄', colors: ['#FEFBFB','#333333','#FFFFFF'], bars: ['60%','50%','40%'] },
  { id: 'darkphoto', name: 'Dark Photography', desc: 'Nero profondo, risalto assoluto alle foto.', emoji: '📸', colors: ['#050505','#E0E0E0','#1A1A1A'], bars: ['90%','60%','30%'] },
  { id: 'medical', name: 'Medical / Clean', desc: 'Azzurro/bianco, asettico e affidabile.', emoji: '⚕️', colors: ['#F0F8FA','#2C3E50','#FFFFFF'], bars: ['70%','50%','30%'] },
  { id: 'education', name: 'Education', desc: 'Blu navy, rigoroso, accademico.', emoji: '🎓', colors: ['#FFFFFF','#333333','#F9F9F9'], bars: ['80%','60%','40%'] },
  { id: 'gamer', name: 'Gamer / Streamer', desc: 'Viola/scuro, font squadrati, luce al neon.', emoji: '🎮', colors: ['#0F0F1A','#E2E8F0','#8B5CF6'], bars: ['100%','80%','60%'] },
  { id: 'startup', name: 'Start-Up SaaS', desc: 'Illustrazioni friendly, toni pastello blu.', emoji: '🚀', colors: ['#F8FAFC','#334155','#FFFFFF'], bars: ['80%','60%','40%'] },
  { id: 'lawyer', name: 'Lawyer / Trust', desc: 'Oro e blu scuro, istituzionale.', emoji: '⚖️', colors: ['#FFFFFF','#2C3135','#F9F9F9'], bars: ['90%','70%','50%'] },
];

export function detectPlatformFromUrl(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('facebook.com') || u.includes('fb.com') || u.includes('fb.watch')) return 'facebook';
  if (u.match(/^https?:\/\//) && !u.includes('twitter') && !u.includes('x.com')) return 'website';
  return null;
}

export const PLATFORM_DESCRIPTIONS = {
  instagram: 'Es: https://www.instagram.com/nomeutente/',
  tiktok: 'Es: https://www.tiktok.com/@nomeutente',
  youtube: 'Es: https://www.youtube.com/@nomeutente',
  facebook: 'Es: https://www.facebook.com/nomepagina',
  website: 'Il tuo sito web personale o blog',
};
