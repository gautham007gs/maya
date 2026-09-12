'use client';

import dynamic from 'next/dynamic';

const PerformanceDiagnostics = dynamic(
  () => import('@/lib/performance').then(mod => {
    if (typeof window !== 'undefined') {
      try { mod.PerformanceMonitor.getInstance().initializeWebVitals(); } catch {}
    }
    return { default: () => null };
  }),
  { ssr: false }
);

const SEOOptimizerDiag = dynamic(
  () => import('@/lib/seo').then(mod => {
    if (typeof window !== 'undefined') {
      try { mod.SEOOptimizer.initialize(); } catch {}
    }
    return { default: () => null };
  }),
  { ssr: false }
);

const PWAValidatorDiag = dynamic(
  () => import('@/lib/pwa-validator').then(mod => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      try { setTimeout(() => mod.PWAValidator.validatePWA(), 3000); } catch {}
    }
    return { default: () => null };
  }),
  { ssr: false }
);

export default function DevDiagnostics() {
  if (process.env.NODE_ENV !== 'development') return null;
  return (
    <>
      <PerformanceDiagnostics />
      <SEOOptimizerDiag />
      <PWAValidatorDiag />
    </>
  );
}
