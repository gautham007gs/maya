import type { Metadata } from 'next';
import { Eye } from 'lucide-react';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('Accessibility Statement — WCAG 2.1 AA | Kruthika AI Girlfriend'),
  description: fitMetaDescription('Review Kruthika.fun accessibility measures, known limitations, keyboard and screen-reader support, WCAG 2.1 AA goals, and how to report a barrier.'),
  alternates: {
    canonical: `${BASE_URL}/legal/accessibility`,
    languages: { 'x-default': `${BASE_URL}/legal/accessibility` },
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  openGraph: {
    title: 'Accessibility Statement | Kruthika AI Girlfriend',
    description: 'WCAG 2.1 AA conformance status, implemented measures and feedback channels.',
    url: `${BASE_URL}/legal/accessibility`,
    siteName: 'Kruthika AI Girlfriend',
    locale: 'en_US',
    type: 'website',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika Accessibility Statement' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Accessibility Statement — Kruthika AI Girlfriend',
    description: 'WCAG 2.1 AA conformance status and how to report accessibility barriers.',
    images: [`${BASE_URL}/og-image.jpg`],
    creator: '@kruthikafun',
  },
};

const toc = [
  { id: 'commitment', label: '1. Our Commitment' },
  { id: 'conformance', label: '2. Conformance Status' },
  { id: 'measures', label: '3. Implemented Measures' },
  { id: 'limitations', label: '4. Known Limitations' },
  { id: 'frameworks', label: '5. Legal & Standards Alignment' },
  { id: 'feedback', label: '6. Feedback & Enforcement' },
];

export default function AccessibilityPage() {
  return (
    <LegalPageShell
      slug="accessibility"
      accent="teal"
      icon={<Eye className="h-6 w-6" />}
      title="Accessibility Statement"
      metaLine="Last Updated: August 2026 • Conformance target: WCAG 2.1 Level AA"
      intro={'Kruthika.fun is committed to ensuring digital accessibility for people of all abilities. We continually improve the user experience by applying relevant accessibility standards — and this statement is an honest account of where we stand.'}
      toc={toc}
    >
      {/* 1 */}
      <section id="commitment" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">1. Our Commitment</h2>
        <p>
          We want everyone — including people with visual, motor, cognitive and hearing disabilities — to be able to
          use Kruthika comfortably. Accessibility is treated as an engineering requirement, not an afterthought: it is
          part of code review, and this statement is reviewed alongside each major release.
        </p>
      </section>

      {/* 2 */}
      <section id="conformance" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">2. Conformance Status</h2>
        <p>
          The Service is designed to conform to the <strong>Web Content Accessibility Guidelines (WCAG) 2.1, Level
          AA</strong>. We assess conformance as <strong>largely conformant</strong>: the majority of the Service meets
          the criteria, with a small number of known exceptions listed in §4. Conformance was assessed by a combination
          of self-evaluation and automated tooling (Lighthouse, axe-class checks) as of the date above.
        </p>
      </section>

      {/* 3 */}
      <section id="measures" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">3. Implemented Measures</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: '⌨️', title: 'Keyboard navigation', text: 'Skip-to-content link as the first tab stop, visible focus rings on every interactive element (WCAG 2.4.7), and logical tab order throughout.' },
            { icon: '🎨', title: 'Contrast & scalability', text: 'Body text exceeds the 4.5:1 contrast requirement in both themes, layouts reflow to 320px width, and text scales with user font-size settings.' },
            { icon: '📢', title: 'Screen-reader support', text: 'Semantic landmarks (main/nav/header/footer), one H1 per page, descriptive alt text, labelled form controls, and aria-live announcements for chat updates.' },
            { icon: '🎬', title: 'Reduced motion', text: 'prefers-reduced-motion disables animations, transitions and smooth scrolling for users who are sensitive to motion.' },
            { icon: '📱', title: 'Touch targets', text: 'Interactive elements meet minimum target-size guidance, with hit-area expansion on compact icon controls.' },
            { icon: '🌐', title: 'Internationalisation', text: 'Correct lang/dir per locale (including full RTL for Arabic), translated UI strings, and hreflang-signposted regional pages.' },
          ].map(({ icon, title, text }) => (
            <div key={title} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">
                <span aria-hidden="true">{icon}</span> {title}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 */}
      <section id="limitations" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">4. Known Limitations</h2>
        <p>Honesty beats perfection. Despite our best efforts, some areas remain partially conformant:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li><strong>Third-party ad iframes</strong> — advertising creatives render inside provider-controlled frames whose internal accessibility we cannot fully guarantee.</li>
          <li><strong>Legacy admin dashboards</strong> — the operator-side analytics views use compact data-dense layouts that are functional but not yet fully optimised for screen readers.</li>
          <li><strong>Voice playback</strong> — audio messages currently include a visual transcript only where the original text is available locally.</li>
        </ul>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Each limitation has an owner and is scheduled for improvement in upcoming releases.
        </p>
      </section>

      {/* 5 */}
      <section id="frameworks" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">5. Legal &amp; Standards Alignment</h2>
        <p>
          This statement supports our obligations under: the <strong>European Accessibility Act</strong> (applicable to
          consumer digital services from 28 June 2025), the <strong>Americans with Disabilities Act (ADA)</strong>,
          <strong> Section 508</strong>-style procurement expectations, <strong>EN 301 549</strong>, and equivalent
          national accessibility legislation in the markets listed on our{' '}
          <a href="/legal/privacy#your-rights" className="underline text-violet-700 dark:text-violet-300">Privacy page, §10</a>.
        </p>
      </section>

      {/* 6 */}
      <section id="feedback" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">6. Feedback &amp; Enforcement</h2>
        <p>We welcome your feedback on the accessibility of Kruthika.fun. If you encounter a barrier:</p>
        <div className="p-4 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl text-sm">
          <p className="font-semibold text-teal-900 dark:text-teal-300 mb-1">Accessibility Coordinator</p>
          <p className="text-teal-800 dark:text-teal-400">
            Email:{' '}
            <a href="mailto:accessibility@kruthika.fun" className="underline font-medium">accessibility@kruthika.fun</a>
          </p>
          <p className="text-xs text-teal-700 dark:text-teal-500 mt-1">
            Typical response: within 2 business days. Unresolved concerns can be escalated through national
            enforcement bodies under applicable accessibility legislation.
          </p>
        </div>
      </section>
    </LegalPageShell>
  );
}
