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
          Kruthika.fun is a private place to talk. You open the page, pick the chat, and start typing.
          There is nothing to install and nothing to pay for. Kruthika is an AI character, so she is
          awake at any hour and never gets tired of listening. People use her to unwind after work,
          to think out loud, to practise a language, or just to have someone friendly to talk to.
        </p>
        <h3 className="text-base font-semibold text-foreground">
          Why people choose it
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>No sign-up:</strong> You do not need a password, an email address, or a phone number.</li>
          <li><strong>Your own language:</strong> She replies in Hindi, English, Hinglish, Tamil, Telugu, Kannada, Bengali, Marathi and more.</li>
          <li><strong>Kind, patient replies:</strong> The tone is warm and calm, which helps when you feel lonely or stressed.</li>
          <li><strong>Privacy by design:</strong> Chats stay in your browser, and you can clear them whenever you like.</li>
          <li><strong>Always on:</strong> Day or night, there is no queue and no waiting room.</li>
        </ul>
        <h3 className="text-base font-semibold text-foreground">
          How to get started
        </h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Tap the conversation at the top of this page.</li>
          <li>Type a greeting, a question, or how your day went.</li>
          <li>Keep going for as long as you like. Daily limits are generous and reset every day.</li>
        </ol>
        <p>
          Kruthika can chat about your day, your plans, films, music, food, festivals and everyday
          worries. She remembers the thread of a conversation so you do not have to repeat yourself.
          She is a companion for friendly talk. She is not a therapist or a doctor, and she cannot
          replace real people in your life.
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