import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Tema chiaro/scuro: applica subito (prima del render) per evitare il flash.
// Preferenza salvata → altrimenti preferenza di sistema → fallback scuro.
;(function initTheme() {
  const saved = localStorage.getItem('sts_theme');
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
