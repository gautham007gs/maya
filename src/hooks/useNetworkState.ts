'use client';

import { useState, useEffect } from 'react';

export interface NetworkState {
  isOnline: boolean;
  /** True for ~4 s after the connection is restored */
  justReconnected: boolean;
}

/**
 * Tracks the browser's real-time online / offline status using the native
 * Navigator API — no third-party libraries required.
 *
 * - `isOnline`        → false while the device has no network
 * - `justReconnected` → briefly true after coming back online (useful for
 *                       showing a "Back online!" toast / banner)
 */
export function useNetworkState(): NetworkState {
  const [isOnline, setIsOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    // Sync with the actual browser state on mount (avoids SSR/hydration mismatch)
    setIsOnline(navigator.onLine);

    let reconnectTimer: ReturnType<typeof setTimeout>;

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      // Auto-clear the "just reconnected" flag after 4 s
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => setJustReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
      clearTimeout(reconnectTimer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(reconnectTimer);
    };
  }, []);

  return { isOnline, justReconnected };
}
