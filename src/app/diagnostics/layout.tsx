import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Diagnostics | Kruthika AI',
  description: 'Internal diagnostics panel.',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function DiagnosticsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
