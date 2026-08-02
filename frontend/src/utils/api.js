import { SITE_LAYOUTS } from './siteLayouts';

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
  if (r.status === 401) { localStorage.removeItem('sts_token'); window.location.reload(); return; }
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
  website: { icon: 'https://cdn.simpleicons.org/googleearth/4285F4', label: 'Sito Web', color: '#4285F4' },
};

export { SITE_LAYOUTS };

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
