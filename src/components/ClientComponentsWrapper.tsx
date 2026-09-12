
'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';

const CookieConsent = dynamic(() => import('./CookieConsent'), {
  ssr: false,
  loading: () => null
});

const ServiceWorkerRegistration = dynamic(() => import('./ServiceWorkerRegistration'), {
  ssr: false,
  loading: () => null
});

const GlobalAdScripts = dynamic(() => import('./GlobalAdScripts').then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => null
});

const DevDiagnostics = dynamic(() => import('./DevDiagnostics'), {
  ssr: false,
  loading: () => null
});

const GoogleAnalytics = dynamic(() => import('./GoogleAnalytics'), {
  ssr: false,
  loading: () => null
});

const OneSignalInit = dynamic(() => import('./OneSignalInit'), {
  ssr: false,
  loading: () => null
});

export default function ClientComponentsWrapper() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Defer non-critical background components (OneSignal, ServiceWorker,
    // GoogleAnalytics, CookieConsent) past initial page hydration and LCP.
    // This removes heavy secondary chunks from the critical rendering path,
    // cutting Total Blocking Time (TBT) significantly on mobile devices.
    if (typeof window === 'undefined') return;

    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(() => setReady(true), { timeout: 1500 });
      return () => (window as any).cancelIdleCallback(id);
    } else {
      const timer = setTimeout(() => setReady(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!ready) return null;

  return (
    <>
      <CookieConsent />
      <ServiceWorkerRegistration />
      <Suspense fallback={null}>
        <GlobalAdScripts />
      </Suspense>
      <DevDiagnostics />
      <GoogleAnalytics />
      <OneSignalInit />
    </>
  );
}
