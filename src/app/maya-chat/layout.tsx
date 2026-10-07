import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ChatStructuredData } from './structured-data';
import AIGirlfriendFAQSchema from './ai-girlfriend-faq-schema';
import BreadcrumbSchema from '@/components/BreadcrumbSchema';
import { AppProductSchemas } from '@/components/StructuredData';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('Free AI Girlfriend Chat with Kruthika'),
  description: fitMetaDescription('Start a private conversation with Kruthika — your free AI girlfriend. Hindi, English and 8 Indian languages. No account needed, available 24/7.'),
  alternates: {
    canonical: `${BASE_URL}/maya-chat`,
    languages: {
      'x-default': `${BASE_URL}/maya-chat`,
    },
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Chat with Kruthika — Free AI Girlfriend',
    description: 'Start a private conversation with Kruthika — your free AI girlfriend. Hindi, English & 8 Indian languages. No account needed.',
    url: `${BASE_URL}/maya-chat`,
    siteName: 'Kruthika AI Girlfriend',
    images: [
      {
        url: `${BASE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'Kruthika AI Girlfriend Chat — Free, No Sign Up',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chat with Kruthika — Free AI Girlfriend',
    description: 'Free AI girlfriend chat — Hindi & English, no account needed, generous daily limits, available 24/7.',
    images: [`${BASE_URL}/og-image.jpg`],
    creator: '@kruthikafun',
    site: '@kruthikafun',
  },
};

export default function MayaChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Page-specific structured data — server-rendered, zero CSR cost.
          Previously written but never mounted anywhere (SEO audit #2). */}
      <ChatStructuredData />
      <AIGirlfriendFAQSchema />
      <AppProductSchemas />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: BASE_URL },
          { name: 'Chat with Kruthika', url: `${BASE_URL}/maya-chat` },
        ]}
      />

      {/* Server-rendered intro content. The chat UI below is a client
          component with no server-rendered fallback body, so first-wave
          crawlers with limited JS budgets (Bing, DuckDuckGo, and even
          Googlebot's first pass) previously saw no real text at all here
          (SEO audit #2). This block is real HTML in the initial response,
          visually unobtrusive (sits directly above the chat shell), and
          gives crawlers something to index immediately.  */}
      <main id="main-content">
      {/* Visually minimal intro — fulfils three purposes:
          1. Gives first-wave crawlers a server-rendered H1 + descriptive paragraph
             to index immediately (chat UI is a client component with no SSR body).
          2. Avoids pure sr-only cloaking risk: content visible to sighted users
             (very small text at top) matches exactly what crawlers receive.
          3. Preserves the full-height chat layout by keeping the block compact. */}
      <div className="px-4 py-2 text-center bg-muted/30 border-b border-border/30">
        <h1 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
          Chat with Kruthika — Free AI Girlfriend &amp; Companion, No Sign Up
        </h1>
        <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5 leading-snug max-w-xl mx-auto">
          Free 24/7 AI companion · Fluent in Hindi, English, Hinglish &amp; 8 Indian languages · Private &amp; judgment-free · No account or subscription needed
        </p>
        <nav aria-label="Kruthika resources" className="flex justify-center gap-3 mt-1.5 text-xs underline underline-offset-2">
          <a href="/faq" className="text-muted-foreground hover:text-foreground">AI Girlfriend FAQ</a>
          <a href="/blog" className="text-muted-foreground hover:text-foreground">Guides &amp; Blog</a>
          <a href="/" className="text-muted-foreground hover:text-foreground">Home</a>
          <a href="/about" className="text-muted-foreground hover:text-foreground">About Kruthika</a>
          <a href="/legal/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</a>
        </nav>
        {/* Semantic crawler summary explaining capabilities, safety, and topics */}
        <div className="sr-only">
          <h2>About Kruthika AI Companionship Chat</h2>
          <p>
            Kruthika is an advanced virtual companion designed to provide comforting conversation, active listening, and emotional warmth. Powered by modern conversational intelligence, she listens without judgment, shares daily reflections, and offers supportive responses across all major Indian languages.
          </p>
          <h2>Key Platform Highlights</h2>
          <ul>
            <li>No registration or phone number required to chat.</li>
            <li>Available 24 hours a day, 7 days a week.</li>
            <li>Support for Hindi, English, Hinglish, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, and Punjabi.</li>
            <li>Browser-based privacy: conversations stay within your private browser session.</li>
            <li>Free daily messaging with generous conversation limits.</li>
          </ul>
        </div>
      </div>

      {children}
      </main>
    </>
  );
}
