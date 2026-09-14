import { SITE_LAYOUTS, SITE_LAYOUT_CATEGORIES } from './siteLayouts';

export const API_BASE = window.API_BASE || '';

export async function apiFetch(path, opts = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const raw = await r.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  if (r.status === 401 && !path.includes('action=login')) { localStorage.removeItem('sts_token'); window.location.reload(); return; }
  if (!r.ok) {
    const htmlTitle = raw.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
    const fallback = htmlTitle || raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
    throw new Error(data?.error || fallback || `Errore server (${r.status})`);
  }
  if (!data) {
    throw new Error('Risposta API non valida: il server non ha restituito JSON.');
  }
  return data;
}

export const SOCIAL = {
  instagram: { icon: 'https://cdn.simpleicons.org/instagram/E4405F', label: 'Instagram', color: '#E1306C' },
  tiktok: { icon: 'https://cdn.simpleicons.org/tiktok/000000', label: 'TikTok', color: '#010101' },
  facebook: { icon: 'https://cdn.simpleicons.org/facebook/1877F2', label: 'Facebook', color: '#1877F2' },
  youtube: { icon: 'https://cdn.simpleicons.org/youtube/FF0000', label: 'YouTube', color: '#FF0000' },
  x: { icon: 'https://cdn.simpleicons.org/x/000000', label: 'X', color: '#000000' },
  website: { icon: 'https://cdn.simpleicons.org/googleearth/4285F4', label: 'Sito Web', color: '#4285F4' },
};

export { SITE_LAYOUTS, SITE_LAYOUT_CATEGORIES };

export function detectPlatformFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const isHost = domain => host === domain || host.endsWith(`.${domain}`);
    if (isHost('youtube.com') || host === 'youtu.be') return 'youtube';
    if (isHost('tiktok.com')) return 'tiktok';
    if (isHost('instagram.com')) return 'instagram';
    if (isHost('facebook.com') || host === 'fb.watch') return 'facebook';
    if (isHost('twitter.com') || isHost('x.com')) return 'x';
    return 'website';
  } catch {
    return null;
  }
}
