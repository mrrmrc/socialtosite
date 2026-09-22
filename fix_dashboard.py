import sys

path = r'frontend\src\screens\DashboardScreen.jsx'
with open(path, 'r', encoding='utf8') as f:
    c = f.read()

find1 = '''  useEffect(() => {
    if (!studioWorkspaceOpen) {
      setStudioPreviewUrl('');
      return;
    }

    const timer = window.setTimeout(() => {
      const previewData = encodeStudioPreviewData({
        ...deferredStudio,
        design_archetype: deferredStudio.design_archetype || selectedTheme,
        title: siteTitleDraft,
        bio: profileDraft,
        hero_tagline: heroTagline,
      });
      setStudioPreviewUrl(previewData);
      setTimeout(() => {
        const form = document.getElementById('admin-sts-preview-form');
        if (form) form.submit();
      }, 50);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [deferredStudio, selectedTheme, siteUrl, studioWorkspaceOpen, siteTitleDraft, profileDraft, heroTagline]);'''

repl1 = '''  const [adminPreviewHtml, setAdminPreviewHtml] = useState(null);

  useEffect(() => {
    if (!studioWorkspaceOpen) {
      setAdminPreviewHtml(null);
      setStudioPreviewUrl('');
      return;
    }

    const timer = window.setTimeout(async () => {
      const previewData = encodeStudioPreviewData({
        ...deferredStudio,
        design_archetype: deferredStudio.design_archetype || selectedTheme,
        title: siteTitleDraft,
        bio: profileDraft,
        hero_tagline: heroTagline,
      });
      setStudioPreviewUrl(previewData);
      try {
        const formData = new FormData();
        formData.append('preview_data', previewData);
        const res = await fetch(`${siteUrl}?studio_preview=1`, { method: 'POST', body: formData });
        let html = await res.text();
        html = html.replace('<head>', `<head><base href="${siteUrl}/">`);
        setAdminPreviewHtml(html);
      } catch (err) {
        console.error(err);
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [deferredStudio, selectedTheme, siteUrl, studioWorkspaceOpen, siteTitleDraft, profileDraft, heroTagline]);'''

find2 = '''  function openThemePreview(layout) {
    const previewData = encodeStudioPreviewData(siteLayoutToStudioData(layout));
    setPreviewingTheme(layout.id);
    setActivePreviewUrl(previewData);
    setTimeout(() => {
      const form = document.getElementById('theme-preview-form');
      if (form) form.submit();
    }, 50);
  }'''

repl2 = '''  const [themePreviewHtml, setThemePreviewHtml] = useState(null);

  async function openThemePreview(layout) {
    const previewData = encodeStudioPreviewData(siteLayoutToStudioData(layout));
    setPreviewingTheme(layout.id);
    setActivePreviewUrl(previewData);
    try {
      const formData = new FormData();
      formData.append('preview_data', previewData);
      const res = await fetch(`${siteUrl}?studio_preview=1`, { method: 'POST', body: formData });
      let html = await res.text();
      html = html.replace('<head>', `<head><base href="${siteUrl}/">`);
      setThemePreviewHtml(html);
    } catch (err) {
      console.error(err);
    }
  }'''

find3 = '''                  <>
                    <form id="theme-preview-form" target="theme_preview_frame" method="POST" action={`${siteUrl}?studio_preview=1`} style={{display: 'none'}}>
                      <input type="hidden" name="preview_data" value={activePreviewUrl} />
                    </form>
                    <iframe
                      name="theme_preview_frame"
                      src="about:blank"
                      title={`Anteprima ${previewingLayout?.name || 'tema'}`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#fff', border: 'none' }}
                    />
                  </>'''

repl3 = '''                  <iframe
                    title={`Anteprima ${previewingLayout?.name || 'tema'}`}
                    srcDoc={themePreviewHtml || ''}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#fff', border: 'none' }}
                  />'''

find4 = '''                    <form id="admin-sts-preview-form" target="admin_preview_frame" method="POST" action={`${siteUrl}?studio_preview=1`} style={{display: 'none'}}>
                      <input type="hidden" name="preview_data" value={studioPreviewUrl} />
                    </form>
                    {studioPreviewUrl ? (
                      <iframe
                        name="admin_preview_frame"
                        src="about:blank"
                        title="Anteprima live studio"
                        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                      />
                    ) : ('''

repl4 = '''                    {studioPreviewUrl ? (
                      <iframe
                        title="Anteprima live studio"
                        srcDoc={adminPreviewHtml || ''}
                        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                      />
                    ) : ('''


c = c.replace(find1, repl1)
c = c.replace(find2, repl2)
c = c.replace(find3, repl3)
c = c.replace(find4, repl4)

for i, (find, repl) in enumerate([(find1, repl1), (find2, repl2), (find3, repl3), (find4, repl4)]):
    if repl not in c:
        print(f"Warning: repl{i+1} not found!")

with open(path, 'w', encoding='utf8') as f:
    f.write(c)
print("DashboardScreen updated!")
