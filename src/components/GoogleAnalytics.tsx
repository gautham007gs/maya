
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { stampCspNonce } from '@/lib/csp-nonce';

// Google Analytics is only active when NEXT_PUBLIC_GA_ID is set to a real
// measurement ID (e.g. G-XXXXXXXXXX). If the variable is empty or absent,
// this component is a no-op — no placeholder scripts are ever injected.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  useEffect(() => {
    // Skip if no real GA ID is configured, or on admin routes.
    if (!GA_ID || isAdminRoute) return;

    const script1 = document.createElement('script');
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    script1.async = true;
    stampCspNonce(script1);
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_ID}', { page_path: window.location.pathname });
    `;
    stampCspNonce(script2);
    document.head.appendChild(script2);

    return () => {
      if (document.head.contains(script1)) document.head.removeChild(script1);
      if (document.head.contains(script2)) document.head.removeChild(script2);
    };
  }, [isAdminRoute]);

  return null;
}
