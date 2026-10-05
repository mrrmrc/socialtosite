import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from './layout/ErrorBoundary'
import { AppLayout } from './layout/AppLayout'
import { Dashboard } from './routes/Dashboard'
import { SiteWorkspace } from './routes/SiteWorkspace'
import { Themes } from './routes/Themes'
import { ProfileSync } from './routes/ProfileSync'
import { useEditorStore } from './store/editorStore'
import { Editor } from './routes/Editor'
import { Components } from './routes/Components'
import { Deploy } from './routes/Deploy'
import { Settings } from './routes/Settings'
import { NotFound } from './routes/NotFound'
import { useKeyboardShortcuts } from './lib/useKeyboardShortcuts'

function AppRoutes() {
  useKeyboardShortcuts()
  const activeProjectId = useEditorStore(s => s.activeProjectId)

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<SiteWorkspace />} />
        <Route path="create" element={<SiteWorkspace generate />} />
        <Route path="themes" element={activeProjectId ? <Themes /> : <SiteWorkspace destination="/themes" />} />
        <Route path="profile" element={activeProjectId?.startsWith('social-site-') ? <ProfileSync /> : <SiteWorkspace destination="/profile" />} />
        <Route path="projects" element={<Dashboard />} />
        <Route path="new" element={<Navigate to="/" replace />} />
        <Route path="editor" element={activeProjectId ? <Editor /> : <SiteWorkspace />} />
        <Route path="components" element={<Components />} />
        <Route path="deploy" element={activeProjectId ? <Deploy /> : <SiteWorkspace />} />
        <Route path="settings" element={activeProjectId ? <Settings /> : <SiteWorkspace destination="/settings" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename="/builder/">
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
