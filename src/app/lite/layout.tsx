import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Lite mode is a utility path — noindex to avoid splitting crawl budget.
export const metadata: Metadata = {
  title: 'Kruthika Lite | AI Girlfriend Chat',
  description: 'Lightweight AI girlfriend chat for low-end devices.',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function LiteLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
