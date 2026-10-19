import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function EditorDialog({ children, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    const app = document.getElementById('root');
    const wasInert = app?.inert;
    if (app) app.inert = true;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [contenteditable="true"], [tabindex="0"]')].filter(el => el.getClientRects().length);
    dialog.querySelector('input')?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      if (app) app.inert = wasInert;
      document.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<div ref={dialogRef} className="mobile-bottom-sheet article-editor-overlay" role="dialog" aria-modal="true" aria-labelledby="article-editor-title" tabIndex={-1}>{children}</div>, document.body);
}
