import type { Metadata } from 'next';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';
import type { ReactNode } from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('Kruthika Status Updates'),
  description: fitMetaDescription('View Kruthika\'s latest status updates and stories.'),
  alternates: { canonical: `${BASE_URL}/status` },
  // Status page is a UI feature, not an SEO target — keep noindex
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function StatusLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
