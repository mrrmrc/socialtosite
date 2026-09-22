with open("frontend/src/screens/AdminScreen.jsx", "r", encoding="utf-8") as f:
    content = f.read()

target = """                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{user.name || user.email}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</div>
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: isActive ? 'var(--primary-dark)' : 'var(--text-muted)' }}>
                          {pending ? `${pending} run` : 'idle'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                        <span className="badge badge-purple">{user.sources?.length || 0} fonti</span>
                        <span className="badge badge-green">{user.posts_count || 0} contenuti</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Piano: {user.plan || 'free'}<br />
                        Slug: {user.slug || 'n.d.'}
                      </div>"""

replacement = """                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || user.email}</div>
                          {user.name && <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>}
                        </div>
                        <div style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', background: isActive ? 'var(--primary)' : 'var(--bg)', color: isActive ? '#fff' : 'var(--text-muted)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {pending ? `${pending} run` : 'IDLE'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                        <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', background: 'var(--purple-light)', color: 'var(--purple)', fontWeight: 700 }}>{user.sources?.length || 0} fonti</span>
                        <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', background: 'var(--teal-light)', color: '#0F6E56', fontWeight: 700 }}>{user.posts_count || 0} post</span>
                        <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', background: 'var(--gray-light)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'capitalize' }}>{user.plan || 'free'}</span>
                      </div>"""

if target in content:
    content = content.replace(target, replacement)
    with open("frontend/src/screens/AdminScreen.jsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced!")
else:
    # try normalize newlines
    target = target.replace('\r\n', '\n')
    if target in content.replace('\r\n', '\n'):
        content = content.replace('\r\n', '\n').replace(target, replacement)
        with open("frontend/src/screens/AdminScreen.jsx", "w", encoding="utf-8") as f:
            f.write(content)
        print("Replaced with LF!")
    else:
        print("Not found!")
