import { useCallback, useEffect, useState } from 'react';

const tabs = new Set(['overview', 'profile', 'site', 'sources', 'seo', 'idea', 'account', 'security', 'services', 'publicsite', 'admin', 'general', 'settings', 'experience']);

export function readDashboardTab(search = window.location.search, fallback = 'overview') {
  const value = new URLSearchParams(search).get('tab');
  return tabs.has(value) ? value : fallback;
}

export function useDashboardNavigation(fallback = 'overview') {
  const [tab, updateTab] = useState(() => readDashboardTab(window.location.search, fallback));
  useEffect(() => {
    const restore = () => updateTab(readDashboardTab(window.location.search, fallback));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [fallback]);
  const setTab = useCallback(next => {
    if (!tabs.has(next)) return;
    const url = new URL(window.location.href);
    if (readDashboardTab(window.location.search, fallback) !== next) {
      url.searchParams.set('tab', next);
      window.history.pushState(null, '', url);
    }
    updateTab(next);
  }, [fallback]);
  return [tab, setTab];
}
