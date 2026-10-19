import type { Metadata } from 'next';
import { AppProductSchemas } from '@/components/StructuredData';
import TrustLinks from '@/components/trust/TrustLinks';
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
    title: fitSeoTitle('Free AI Companion Chat — No Account'),
    description: fitMetaDescription(
      'Try Kruthika, a browser-based AI companion for casual conversation. Start without an account, review privacy details, and use clear boundaries for personal topics.',
    ),
    alternates: getHreflangAlternates('/'),
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title: 'Free AI Companion Chat — No Sign Up',
      description: 'Start a browser-based AI companion conversation with Kruthika. No account is required to begin; review privacy details before sharing sensitive information.',
      url: BASE_URL,
      siteName: 'Kruthika AI Companion',
      type: 'website',
      locale: 'en_US',
      alternateLocale: ['en_IN'],
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'Kruthika AI companion chat' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Free AI Companion Chat — No Sign Up',
      description: 'Start a browser-based AI companion conversation with Kruthika, with no account required to begin.',
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

      {/* Crawlable, server-rendered content section for search engines & accessibility.
          Written in short, plain sentences with varied wording: the earlier
          version was ~175 words with 68% link text and a handful of repeated
          keywords, which tripped the thin-content, link-density and
          keyword-density checks. */}
      <section
        aria-label="About Kruthika AI Companion"
        className="max-w-3xl mx-auto px-4 py-8 border-t border-border bg-card text-muted-foreground text-sm leading-relaxed space-y-4"
      >
        <h2 className="text-lg font-bold text-foreground">
          A Free AI Companion You Can Talk To Any Time
        </h2>
        <p>
          Kruthika.fun is a browser-based place to talk to an AI character. You open the page, pick
          the chat, and start typing. There is nothing to install and no account is required to begin.
          People use it to unwind after work, think out loud, practise a language, or have a casual
          conversation. Kruthika is software, not a person or professional support service.
        </p>
        <h3 className="text-base font-semibold text-foreground">
          Why people choose it
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>No sign-up:</strong> You do not need a password, an email address, or a phone number.</li>
          <li><strong>Your own language:</strong> She replies in Hindi, English, Hinglish, Tamil, Telugu, Kannada, Bengali, Marathi and more.</li>
          <li><strong>Conversation practice:</strong> Try a greeting, a language exercise, or a fictional scenario and assess the reply for yourself.</li>
          <li><strong>Privacy information:</strong> Read the <a href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</a> before sharing anything personal.</li>
          <li><strong>Clear boundaries:</strong> Do not use AI chat for emergencies or as a replacement for qualified human support.</li>
        </ul>
        <h3 className="text-base font-semibold text-foreground">
          How to get started
        </h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Tap the conversation at the top of this page.</li>
          <li>Type a greeting, a question, or how your day went.</li>
          <li>Keep the first chat low-stakes and use the current service information to understand any applicable limits.</li>
        </ol>
        <p>
          Kruthika can chat about your day, plans, films, music, food, festivals and everyday topics.
          It is a companion for friendly conversation, not a therapist or doctor, and it cannot replace
          real people in your life. Avoid sharing passwords, one-time codes, payment details, government
          IDs, confidential work material or private documents.
        </p>
        <h3 className="text-base font-semibold text-foreground">
          Learn more
        </h3>
        <p>
          New here? The <a href="/faq" className="underline hover:text-foreground">frequently asked questions</a>{' '}
          explain how privacy, languages and daily limits work. The{' '}
          <a href="/blog" className="underline hover:text-foreground">blog</a> has longer guides on talking to an
          AI companion, staying safe online, and what this technology can and cannot do. You can also read{' '}
          <a href="/about" className="underline hover:text-foreground">about the team behind the site</a> or go
          straight to the <a href="/maya-chat" className="underline hover:text-foreground">chat page</a>.
        </p>
      </section>
      <TrustLinks path="/" />
    </>
  );
}
