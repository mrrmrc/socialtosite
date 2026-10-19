import { useCallback, useEffect, useState } from 'react';

const tabs = new Set(['overview', 'profile', 'site', 'sources', 'seo', 'idea', 'account', 'security', 'services', 'publicsite', 'admin', 'general', 'settings', 'experience']);

export function readDashboardTab(search = window.location.search) {
  const value = new URLSearchParams(search).get('tab');
  return tabs.has(value) ? value : 'overview';
}

export function useDashboardNavigation() {
  const [tab, updateTab] = useState(() => readDashboardTab());
  useEffect(() => {
    const restore = () => updateTab(readDashboardTab());
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const setTab = useCallback(next => {
    if (!tabs.has(next)) return;
    const url = new URL(window.location.href);
    if (readDashboardTab() !== next) {
      url.searchParams.set('tab', next);
      window.history.pushState(null, '', url);
    }
    updateTab(next);
  }, []);
  return [tab, setTab];
}
