import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('Editorial Policy & Standards — Kruthika AI Girlfriend Blog'),
  description: fitMetaDescription('The Kruthika.fun Editorial Policy: human review standards, AI-assistance transparency, sourcing, corrections and independence for every article we publish.'),
  alternates: {
    canonical: `${BASE_URL}/legal/editorial-policy`,
    languages: { 'x-default': `${BASE_URL}/legal/editorial-policy` },
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: {
    title: 'Editorial Policy | Kruthika AI Girlfriend',
    description: 'Human-reviewed standards, AI transparency and corrections policy for our blog.',
    url: `${BASE_URL}/legal/editorial-policy`,
    siteName: 'Kruthika AI Girlfriend',
    type: 'website',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika Editorial Policy' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Editorial Policy — Kruthika AI Girlfriend',
    description: 'Human-reviewed standards, AI transparency and corrections policy for our blog.',
    images: [`${BASE_URL}/og-image.jpg`],
    creator: '@kruthikafun',
  },
};

const toc = [
  { id: 'principles', label: '1. Editorial Principles & Accuracy' },
  { id: 'ai-transparency', label: '2. Transparency in AI Assistance' },
  { id: 'sourcing', label: '3. Sourcing & Fact-Checking' },
  { id: 'independence', label: '4. Independence & Advertising Separation' },
  { id: 'guardrails', label: '5. Sensitive-Topic Guardrails' },
  { id: 'corrections', label: '6. Corrections & Feedback' },
];

export default function EditorialPolicyPage() {
  return (
    <LegalPageShell
      slug="editorial-policy"
      accent="blue"
      icon={<BookOpen className="h-6 w-6" />}
      title="Editorial Policy & Guidelines"
      metaLine="Last Updated: August 2026 • E-E-A-T Quality Commitment"
      intro={'This policy sets out how content is researched, reviewed, corrected and published on the Kruthika.fun blog — so readers (and search engines) can rely on what they find here.'}
      toc={toc}
    >
      {/* 1 */}
      <section id="principles" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">1. Editorial Principles &amp; Accuracy</h2>
        <p>
          Our guides, reviews and psychological insights are researched and reviewed by contributors with backgrounds
          in technology, psychology and digital communication. Every factual claim about mental wellness or AI
          capability is checked against reliable primary sources before publication. We write for people first —
          clarity over keyword volume — and we never publish content we would not want a close friend to read.
        </p>
      </section>

      {/* 2 */}
      <section id="ai-transparency" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">2. Transparency in AI Assistance</h2>
        <p>
          We may use AI tools to assist with research, outlining and drafting. However,{' '}
          <strong>every published article undergoes substantive human editorial review, fact-checking and original
          restructuring</strong>. AI never decides what we cover, which conclusions we draw, or how we characterise
          evidence — humans do. Where an article discusses AI behaviour, we verify claims against the systems
          themselves rather than repeating vendor marketing.
        </p>
      </section>

      {/* 3 */}
      <section id="sourcing" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">3. Sourcing &amp; Fact-Checking</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li>Statistics and studies are linked to their original source wherever one exists.</li>
          <li>Expert quotations are attributed by name and role; unverified “expert” claims are removed.</li>
          <li>Product comparisons are based on hands-on evaluation or clearly cited documentation.</li>
          <li>When evidence is mixed or preliminary, we say so explicitly instead of overstating certainty.</li>
        </ul>
      </section>

      {/* 4 */}
      <section id="independence" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">4. Independence &amp; Advertising Separation</h2>
        <p>
          Editorial decisions are made independently of advertising. Ad placements are visually distinct from
          articles, no advertiser can influence rankings or conclusions, and we do not publish paid posts disguised as
          reviews. If that ever changes, disclosure will appear at the top of the affected article.
        </p>
      </section>

      {/* 5 */}
      <section id="guardrails" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">5. Sensitive-Topic Guardrails</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li><strong>Mental-health safety:</strong> we clearly distinguish AI companionship from clinical treatment and include crisis-resource guidance where appropriate.</li>
          <li><strong>No harmful advice:</strong> we never publish content encouraging isolation, self-harm or abusive dynamics.</li>
          <li><strong>Honest reviews:</strong> comparisons evaluate genuine features; weaknesses are stated, not buried.</li>
        </ul>
      </section>

      {/* 6 */}
      <section id="corrections" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">6. Corrections &amp; Feedback</h2>
        <p>
          Spotted an error? Email{' '}
          <a href="mailto:editorial@kruthika.fun" className="text-blue-600 dark:text-blue-400 underline font-medium">editorial@kruthika.fun</a>.
          Verified inaccuracies are corrected promptly with the change noted on the article (updated date), and
          significant corrections are flagged visibly rather than silently edited. General feedback is always welcome.
        </p>
      </section>
    </LegalPageShell>
  );
}