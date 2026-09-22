import sys

path = r'frontend\src\screens\DashboardScreen.jsx'
with open(path, 'r', encoding='utf8') as f:
    c = f.read()

find1 = '''  function openThemePreview(layout) {
    const previewData = encodeStudioPreviewData(siteLayoutToStudioData(layout));
    setPreviewingTheme(layout.id);
    setActivePreviewUrl(`${siteUrl}?preview_data=${previewData}`);
  }'''

repl1 = '''  function openThemePreview(layout) {
    const previewData = encodeStudioPreviewData(siteLayoutToStudioData(layout));
    setPreviewingTheme(layout.id);
    setActivePreviewUrl(previewData);
    setTimeout(() => {
      const form = document.getElementById('theme-preview-form');
      if (form) form.submit();
    }, 50);
  }'''

find2 = '''            {activePreviewUrl && (
              <div role=\"dialog\" aria-modal=\"true\" aria-label=\"Anteprima tema\" style={{ position: 'fixed', inset: 0, background: '#080a0f', zIndex: 11000 }}>
                <iframe
                  title={`Anteprima ${previewingLayout?.name || 'tema'}`}
                  src={activePreviewUrl}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#fff', border: 'none' }}
                />'''

repl2 = '''            {activePreviewUrl && (
              <div role=\"dialog\" aria-modal=\"true\" aria-label=\"Anteprima tema\" style={{ position: 'fixed', inset: 0, background: '#080a0f', zIndex: 11000 }}>
                {activePreviewUrl.startsWith('http') ? (
                  <iframe
                    title={`Anteprima ${previewingLayout?.name || 'tema'}`}
                    src={activePreviewUrl}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#fff', border: 'none' }}
                  />
                ) : (
                  <>
                    <form id=\"theme-preview-form\" target=\"theme_preview_frame\" method=\"POST\" action={`${siteUrl}?studio_preview=1`} style={{display: 'none'}}>
                      <input type=\"hidden\" name=\"preview_data\" value={activePreviewUrl} />
                    </form>
                    <iframe
                      name=\"theme_preview_frame\"
                      title={`Anteprima ${previewingLayout?.name || 'tema'}`}
                      src={`${siteUrl}?studio_preview=1`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#fff', border: 'none' }}
                    />
                  </>
                )}'''

c = c.replace(find1, repl1)
c = c.replace(find2, repl2)
with open(path, 'w', encoding='utf8') as f:
    f.write(c)
print('Done!')
