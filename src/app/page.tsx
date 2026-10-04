import type { Metadata } from 'next';
import { AppProductSchemas } from '@/components/StructuredData';
import HomepageShell from '@/components/homepage/HomepageShell';
import { HomepagePullToRefresh } from '@/components/homepage/HomepageAdSlots';
import { getHreflangAlternates } from '@/lib/hreflang';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

import { getEffectiveSiteImages, toAbsoluteSiteImageUrl } from '@/lib/site-image-server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export async function generateMetadata(): Promise<Metadata> {
  let ogImageUrl = `${BASE_URL}/opengraph-image`;
  try {
    const siteImages = await getEffectiveSiteImages();
    if (siteImages.defaultOgImageUrl && siteImages.defaultOgImageUrl.trim() !== '') {
      ogImageUrl = toAbsoluteSiteImageUrl(siteImages.defaultOgImageUrl, BASE_URL);
    }
  } catch (e) {
    console.warn('[PageMetadata] Using fallback og image:', e);
  }

  return {
    title: fitSeoTitle('Free AI Girlfriend Chat — No Sign Up'),
    description: fitMetaDescription(
      'Chat with Kruthika, a free AI girlfriend for friendly conversation, emotional support, and companionship. Start in your browser with no account or subscription.',
    ),
    alternates: getHreflangAlternates('/'),
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title: 'Free AI Girlfriend Chat — No Sign Up',
      description: 'Start a free, private conversation with Kruthika for friendly AI companionship and emotional support.',
      url: BASE_URL,
      siteName: 'Kruthika AI Girlfriend',
      type: 'website',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'Kruthika AI girlfriend chat' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Free AI Girlfriend Chat — No Sign Up',
      description: 'Chat with Kruthika for free AI companionship and emotional support, with no account required.',
      images: [ogImageUrl],
      site: '@kruthikafun',
    },
  };
}

export default function ChatListPage() {
  return (
    <>
      <AppProductSchemas />
      <HomepagePullToRefresh />
      <HomepageShell />
    </>
  );
}