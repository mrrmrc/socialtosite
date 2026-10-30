import React from 'react';
import './PostMediaPreview.css';

const safeUrl = value => typeof value === 'string' && (/^https?:\/\//i.test(value) || /^\/public\/media\//.test(value)) ? value : '';
export function PostMediaPreview({ post }) {
  const primary = safeUrl(post.media_url);
  const video = String(post.media_type || '').toLowerCase() === 'video';
  const poster = safeUrl(post.poster_url);
  const images = [...new Set([...(video ? [] : [primary]), ...(Array.isArray(post.image_urls) ? post.image_urls : [])].map(safeUrl).filter(url => url && (!video || url !== poster)))];
  let player = null;
  if (video) {
    const youtube = primary.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    let socialPage = false;
    try { socialPage = /(^|\.)(facebook\.com|fb\.watch|youtube\.com|youtu\.be|tiktok\.com)$/i.test(new URL(primary).hostname); } catch { socialPage = true; }
    if (youtube) player = <iframe src={`https://www.youtube.com/embed/${youtube[1]}`} title="Video importato" loading="lazy" allowFullScreen />;
    else if (primary && !socialPage) player = <video src={primary} poster={poster || undefined} controls playsInline preload="metadata" aria-label="Video importato" />;
    else {
      const source = safeUrl(post.source_url) || primary;
      if (source) player = <a className="post-social-video" href={source} target="_blank" rel="noopener noreferrer">{poster && <img src={poster} alt="Anteprima del video" loading="lazy" />}<span>Guarda il video originale</span></a>;
    }
  }
  if (!player && !images.length) return null;
  return <div className="post-media-preview">{player}{images.length > 0 && <div className="post-media-gallery" aria-label={`${images.length} foto importate`}>{images.map((url, i) => <img key={url} src={url} alt={`Foto importata ${i + 1}`} loading="lazy" />)}</div>}{images.length > 1 && <small>{images.length} foto importate</small>}</div>;
}
