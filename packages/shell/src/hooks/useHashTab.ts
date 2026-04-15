/**
 * useHashTab — Hash-based tab routing hook
 *
 * Syncs the active tab with the URL hash:
 *   /settings#appearance → appearance tab
 *   /brand#colors → colors tab
 *
 * Usage:
 *   const [tab, setTab] = useHashTab('general', ['general', 'appearance', 'danger']);
 *   <Tabs value={tab} onValueChange={setTab}>
 */

import { useState, useEffect, useCallback } from 'react';

export function useHashTab(
  defaultTab: string,
  validTabs: readonly string[],
): [string, (tab: string) => void] {
  const getTab = useCallback(() => {
    const hash = window.location.hash.replace('#', '');
    return validTabs.includes(hash) ? hash : defaultTab;
  }, [defaultTab, validTabs]);

  const [tab, setTabState] = useState(getTab);

  // Listen for hash changes (browser back/forward)
  useEffect(() => {
    const onHashChange = () => setTabState(getTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [getTab]);

  // Update hash when tab changes
  const setTab = useCallback((value: string) => {
    setTabState(value);
    window.history.replaceState(null, '', `#${value}`);
  }, []);

  return [tab, setTab];
}
