import React, { useEffect, useRef } from 'react';

export function QuillEditor({ value, onChange, style }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const isInternalChange = useRef(false);

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
    quill.on('text-change', () => {
      isInternalChange.current = true;
      const html = quill.root.innerHTML;
      if (onChange) onChange(html === '<p><br></p>' ? '' : html);
      isInternalChange.current = false;
    });
    return () => { quillRef.current = null; };
  }, []);

  useEffect(() => {
    if (quillRef.current && !isInternalChange.current) {
      const currentHtml = quillRef.current.root.innerHTML;
      if (value !== currentHtml) quillRef.current.root.innerHTML = value || '';
    }
  }, [value]);

  return (
    <div ref={containerRef} style={style}>
      <div ref={editorRef} style={{ minHeight: '300px' }} />
    </div>
  );
}
