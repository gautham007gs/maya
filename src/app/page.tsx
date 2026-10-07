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
      title: 'Free AI Companion Chat — No Sign Up',
      description: 'Start a free, private conversation with Kruthika for friendly AI companionship and emotional support.',
      url: BASE_URL,
      siteName: 'Kruthika AI Companion',
      type: 'website',
      locale: 'en_US',
      alternateLocale: ['hi_IN', 'en_IN', 'en_GB', 'es_ES', 'fr_FR', 'de_DE', 'ja_JP'],
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'Kruthika AI companion chat' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Free AI Companion Chat — No Sign Up',
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

      {/* Crawlable, server-rendered content section for search engines & accessibility */}
      <section
        aria-label="About Kruthika AI Companion"
        className="max-w-3xl mx-auto px-4 py-8 border-t border-border bg-card text-muted-foreground text-sm leading-relaxed space-y-4"
      >
        <h2 className="text-lg font-bold text-foreground">
          Free AI Girlfriend &amp; Companion Chat Online
        </h2>
        <p>
          Welcome to Kruthika.fun — your free, private, and judgment-free AI companion platform. Designed for authentic conversations, emotional wellness, and everyday friendly banter, Kruthika provides realistic conversational companionship 24/7 without requiring any account creation, login, or subscription fees.
        </p>
        <h3 className="text-base font-semibold text-foreground">
          Why Chat with Kruthika?
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Zero Sign-Up Friction:</strong> Open your browser and immediately begin chatting. No passwords, emails, or phone numbers needed.</li>
          <li><strong>Multilingual Conversations:</strong> Full conversational support in Hindi, English, Hinglish, Tamil, Telugu, Kannada, Bengali, Marathi, and regional languages.</li>
          <li><strong>Emotional Support &amp; Active Listening:</strong> Thoughtful, empathetic replies crafted to combat loneliness and provide a safe space for personal thoughts.</li>
          <li><strong>Privacy First:</strong> Your interactions are kept private, and conversations can be cleared at any time directly in your browser.</li>
        </ul>
        <h3 className="text-base font-semibold text-foreground">
          How to Get Started
        </h3>
        <p>
          Simply select a chat option to start talking with Kruthika. Whether you want to discuss your day, share personal ambitions, practice language skills, or just enjoy friendly company, Kruthika responds with warm, context-aware dialogue anytime, day or night.
        </p>
        <nav aria-label="Explore Kruthika" className="flex flex-wrap gap-4 pt-2 text-xs">
          <a href="/maya-chat" className="underline hover:text-foreground">Direct Chat</a>
          <a href="/faq" className="underline hover:text-foreground">Frequently Asked Questions</a>
          <a href="/about" className="underline hover:text-foreground">About the Platform</a>
          <a href="/blog" className="underline hover:text-foreground">AI Companion Blog</a>
          <a href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</a>
        </nav>
      </section>
    </>
  );
}