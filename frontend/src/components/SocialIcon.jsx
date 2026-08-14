import React from 'react';
import { SOCIAL } from '../utils/api';

export function SocialIcon({ platform, size = 20 }) {
  const info = SOCIAL[platform];
  if (!info) return <span style={{ fontSize: size }}>•</span>;
  return <img src={info.icon} alt="" style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />;
}
