import React from 'react';
const paths = {
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  search: 'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  orbit: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM4 6l16 12M4 18 20 6M12 3v18',
  link: 'm10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  logout: 'M9 4H4v16h5m5-12 4 4-4 4M8 12h12',
  chevron: 'm7 10 5 5 5-5',
  wallet: 'M3 5h17v15H3V5Zm0 0 14-3v3m-1 6h5v5h-5v-5Z',
  target: 'M21 12a9 9 0 1 1-9-9m0 4a5 5 0 1 0 5 5m-5 0L22 2m-6 0v6h6',
  spark: 'm12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  pen: 'm15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z',
  layers: 'm12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
  check: 'm5 12 4 4L19 6',
  chart: 'M4 3v17h17M8 15v-4m5 4V7m5 8V5',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
};
export function InterfaceIcon({ name = 'spark', size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.spark} /></svg>;
}
