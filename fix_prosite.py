import sys

path = r'frontend\src\components\ProSiteBuilder.jsx'
with open(path, 'r', encoding='utf8') as f:
    c = f.read()

find1 = '''  useEffect(() => {
    if (!open) return;
    setPreviewLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const form = document.getElementById('sts-preview-form');
      if (form) form.submit();
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [style, content, open]);'''

repl1 = '''  const [previewHtml, setPreviewHtml] = useState(null);

  useEffect(() => {
    if (!open) return;
    setPreviewLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const formData = new FormData();
        formData.append('preview_data', previewDataString);
        
        const response = await fetch(`${siteUrl}?studio_preview=1`, {
          method: 'POST',
          body: formData
        });
        let html = await response.text();
        html = html.replace('<head>', `<head><base href="${siteUrl}/">`);
        setPreviewHtml(html);
      } catch (err) {
        console.error(err);
      } finally {
        setPreviewLoading(false);
      }
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [style, content, open, siteUrl, previewDataString]);'''

find2 = '''              {/* iframe */}
              <form id="sts-preview-form" target="preview_frame" method="POST" action={`${siteUrl}?studio_preview=1`} style={{display: 'none'}}>
                <input type="hidden" name="preview_data" value={previewDataString} />
              </form>
              <iframe
                name="preview_frame"
                ref={previewRef}
                src="about:blank"
                onLoad={() => setPreviewLoading(false)}
                title="Anteprima live del sito"'''

repl2 = '''              {/* iframe */}
              <iframe
                ref={previewRef}
                srcDoc={previewHtml || ''}
                title="Anteprima live del sito"'''

c = c.replace(find1, repl1)
c = c.replace(find2, repl2)

# Verify replacement
if repl1 not in c:
    print("Warning: repl1 not found!")
if repl2 not in c:
    print("Warning: repl2 not found!")

with open(path, 'w', encoding='utf8') as f:
    f.write(c)
print("ProSiteBuilder updated!")
