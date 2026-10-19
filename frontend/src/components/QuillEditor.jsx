import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

export function QuillEditor({ value, onChange, style, className = '' }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const isInternalChange = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!editorRef.current || quillRef.current) return;
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'link', 'image'],
          ['clean']
        ]
      },
      placeholder: "Scrivi il testo dell'articolo..."
    });
    quillRef.current = quill;
    if (value) quill.root.innerHTML = value;
    const handleChange = () => {
      isInternalChange.current = true;
      const html = quill.root.innerHTML;
      onChangeRef.current?.(html === '<p><br></p>' ? '' : html);
      isInternalChange.current = false;
    };
    quill.on('text-change', handleChange);
    quill.root.setAttribute('role', 'textbox');
    quill.root.setAttribute('aria-label', 'Testo dell’articolo');
    quill.root.setAttribute('aria-multiline', 'true');
    return () => {
      quill.off('text-change', handleChange);
      const toolbar = quill.container.previousElementSibling;
      if (toolbar?.classList.contains('ql-toolbar')) toolbar.remove();
      quill.container.innerHTML = '';
      quill.container.classList.remove('ql-container', 'ql-snow');
      quillRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (quillRef.current && !isInternalChange.current) {
      const currentHtml = quillRef.current.root.innerHTML;
      if (value !== currentHtml) quillRef.current.root.innerHTML = value || '';
    }
  }, [value]);

  return (
    <div ref={containerRef} className={className} style={style}>
      <div ref={editorRef} />
    </div>
  );
}
