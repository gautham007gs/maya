'use client';

import { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, Clock } from 'lucide-react';
import { useNetworkState } from '@/hooks/useNetworkState';
import { useLanguage } from '@/contexts/LanguageContext';

const QUEUE_KEY = 'kruthika_offline_queue';

function getQueueCount(): number {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Global network-state banner — lives in the root layout so it shows on every page.
 *
 * Behaviours:
 *  • Offline  → red/orange slide-down banner with wifi-off icon + translated message
 *               + count of messages waiting to be sent
 *  • Reconnected → brief green banner ("Back online! Sending saved messages…")
 *                  auto-dismisses after 3.5 s
 *  • Online   → renders nothing
 */
export default function OfflineIndicator() {
  const { isOnline, justReconnected } = useNetworkState();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const dismissTimerId = useRef<number | null>(null);

  // Avoid SSR mismatch
  useEffect(() => { setIsMounted(true); }, []);

  // Slide in/out when online status changes
  useEffect(() => {
    if (!isMounted) return;
    if (dismissTimerId.current !== null) window.clearTimeout(dismissTimerId.current);

    if (!isOnline) {
      setQueueCount(getQueueCount());
      setVisible(true);
    } else if (justReconnected) {
      setQueueCount(getQueueCount());
      setVisible(true);
      // Auto-hide the "back online" confirmation after 3.5 s
      dismissTimerId.current = window.setTimeout(() => setVisible(false), 3500);
    } else {
      setVisible(false);
    }

    return () => {
      if (dismissTimerId.current !== null) window.clearTimeout(dismissTimerId.current);
    };
  }, [isOnline, justReconnected, isMounted]);

  // Keep queue count live while offline (a message may be added any time)
  useEffect(() => {
    if (!isOnline && isMounted) {
      const id = window.setInterval(() => setQueueCount(getQueueCount()), 1000);
      return () => window.clearInterval(id);
    }
    return undefined;
  }, [isOnline, isMounted]);

  if (!isMounted) return null;

  // Banner is fully hidden — render nothing so it takes no space
  if (!visible && isOnline && !justReconnected) return null;

  const isOffline = !isOnline;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed top-0 left-0 right-0 z-[9999]',
        'transform transition-transform duration-300 ease-out',
        visible ? 'translate-y-0' : '-translate-y-full',
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white',
          'shadow-md',
          isOffline
            ? 'bg-red-600'
            : 'bg-emerald-600',
        ].join(' ')}
      >
        {isOffline ? (
          <>
            <WifiOff size={15} className="shrink-0" />
            <span>{t.youAreOffline}</span>
            {queueCount > 0 && (
              <span className="inline-flex items-center gap-1 ml-1 bg-white/20 rounded-full px-2 py-0.5 text-xs">
                <Clock size={11} />
                {queueCount} {t.queuedMessages}
              </span>
            )}
          </>
        ) : (
          <>
            <Wifi size={15} className="shrink-0" />
            <span>
              {queueCount > 0 ? t.sendingQueued : t.backOnline}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
