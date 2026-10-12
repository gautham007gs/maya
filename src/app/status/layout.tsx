import type { Metadata } from 'next';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';
import type { ReactNode } from 'react';
import TrustLinks from '@/components/trust/TrustLinks';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('Kruthika Status Updates'),
  description: fitMetaDescription("See Kruthika's latest status updates and stories, shared in a familiar messaging-app style. Open the page to browse recent updates."),
  alternates: {
    canonical: `${BASE_URL}/status`,
    languages: {},
  },
  // Status page is a UI feature, not an SEO target — keep noindex
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  // og:url must match the canonical (the root layout's og:url is the homepage),
  // and og:image should be a real image file with an extension.
  openGraph: {
    title: 'Kruthika Status Updates',
    description: "Kruthika's latest status updates and stories.",
    url: `${BASE_URL}/status`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika status updates' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kruthika Status Updates',
    description: "Kruthika's latest status updates and stories.",
    images: [`${BASE_URL}/og-image.jpg`],
  },
};

export default function StatusLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Server-rendered heading + text + links. The status feed itself is a
          client component that only shows a skeleton in the first HTML, so the
          page used to have no <h1>, ~8 words, and no internal links. The
          client-side title in page.tsx is no longer an <h1>, so there is
          exactly one. The heading and text are visually hidden but describe exactly what the page is. */}
      <div className="sr-only">
        <h1>Kruthika Platform Status</h1>
        <p>
          This page shows Kruthika&apos;s recent status updates and stories, laid out like the
          status tab of a messaging app. Open a story to view it. Links to the home page, the chat,
          the FAQ and the site&apos;s policies are listed at the bottom of the page.
        </p>
      </div>
      <main id="main-content">{children}</main>
      <TrustLinks path="/status" showShare={false} />
    </>
  );
}
