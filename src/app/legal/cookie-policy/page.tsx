import type { Metadata } from 'next';
import { Cookie } from 'lucide-react';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('Cookie Policy — How Kruthika Uses Cookies'),
  description: fitMetaDescription('Every cookie and storage key used by Kruthika.fun — purpose, duration and category. Consent-gated analytics and contextual advertising, fully transparent.'),
  alternates: {
    canonical: `${BASE_URL}/legal/cookie-policy`,
    languages: { 'x-default': `${BASE_URL}/legal/cookie-policy` },
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  openGraph: {
    title: 'Cookie Policy | Kruthika AI Girlfriend',
    description: 'Every storage key explained: purpose, category and duration.',
    url: `${BASE_URL}/legal/cookie-policy`,
    siteName: 'Kruthika AI Girlfriend',
    locale: 'en_US',
    type: 'website',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika Cookie Policy' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cookie Policy — Kruthika AI Girlfriend',
    description: 'Every storage key explained: purpose, category and duration.',
    images: [`${BASE_URL}/og-image.jpg`],
    creator: '@kruthikafun',
  },
};

const toc = [
  { id: 'what-are-cookies', label: '1. What Cookies & Local Storage Are' },
  { id: 'consent', label: '2. Consent Management' },
  { id: 'strictly-necessary', label: '3. Strictly Necessary' },
  { id: 'analytics', label: '4. Performance & Analytics' },
  { id: 'advertising', label: '5. Advertising' },
  { id: 'push', label: '6. Push Notifications' },
  { id: 'browser-controls', label: '7. Browser Controls & DNT' },
  { id: 'updates-contact', label: '8. Updates & Contact' },
];

const th = 'text-left py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100';
const td = 'py-2.5 px-3 align-top';

export default function CookiePolicyPage() {
  return (
    <LegalPageShell
      slug="cookie-policy"
      accent="amber"
      icon={<Cookie className="h-6 w-6" />}
      title="Cookie Policy — Kruthika AI Companion"
      metaLine="Last Updated: August 2026 • Transparent Privacy Standards"
      intro={'This Cookie Policy explains the cookies and browser-storage technologies Kruthika.fun uses, why we use them, and how you can manage or revoke consent at any time. It complements our Privacy Policy.'}
      toc={toc}
    >
      {/* 1 */}
      <section id="what-are-cookies" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">1. What Cookies &amp; Local Storage Are</h2>
        <p>
          Cookies are small text files a website stores on your device. <strong>Local storage</strong> is similar but
          lives inside your browser and can hold larger amounts of data. We use both for three jobs only: remembering
          your preferences, keeping the Service secure, and — with your consent — measuring performance and serving
          contextual advertising.
        </p>
      </section>

      {/* 2 */}
      <section id="consent" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">2. Consent Management</h2>
        <p>
          On your first visit we show a consent banner: <strong>Accept</strong> enables optional analytics and
          advertising; <strong>Decline</strong> keeps only strictly necessary storage. Your choice is recorded (a
          signed preference record, retained 12 months as proof of compliance) and you can change it at any time via
          the chat’s 3-dot menu → <strong>Privacy &amp; Cookie Settings</strong>. Withdrawing consent takes effect
          immediately and never degrades core features.
        </p>
      </section>

      {/* 3 */}
      <section id="strictly-necessary" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">3. Strictly Necessary Storage</h2>
        <p>These are required for the Service to function and cannot be disabled:</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th scope="col" className={th}>Key</th>
                <th scope="col" className={th}>Type</th>
                <th scope="col" className={th}>Purpose</th>
                <th scope="col" className={th}>Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr><td className={td}><code>kruthika_country</code></td><td className={td}>Cookie</td><td className={td}>Remembers your region so content and formats match your location</td><td className={td}>12 months</td></tr>
              <tr><td className={td}><code>kruthika_ui_lang</code></td><td className={td}>Cookie</td><td className={td}>Remembers your interface language choice</td><td className={td}>12 months</td></tr>
              <tr><td className={td}><code>kruthika_sid</code></td><td className={td}>Cookie (HttpOnly)</td><td className={td}>Signed session identifier that keeps chat continuity and abuse-prevention intact</td><td className={td}>Session / short persistence</td></tr>
              <tr><td className={td}><code>consent record</code></td><td className={td}>Cookie + server record</td><td className={td}>Stores your cookie choices as compliance proof</td><td className={td}>12 months</td></tr>
              <tr><td className={td}><code>__Host-admin_session</code></td><td className={td}>Cookie (HttpOnly, admins only)</td><td className={td}>Authenticates the site-operator dashboard</td><td className={td}>Session</td></tr>
              <tr><td className={td}><code>chat memory</code> (localStorage)</td><td className={td}>Local storage</td><td className={td}>Your on-device conversation memory — never uploaded by us; clear anytime via “Clear Chat”</td><td className={td}>Until you clear it</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4 */}
      <section id="analytics" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">4. Performance &amp; Analytics <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium align-middle ml-1">Optional</span></h2>
        <p>
          With consent, first-party analytics record anonymised page views, session counts and response latency so we
          can keep the Service fast and reliable. IP addresses are truncated at ingestion, raw rows are purged on a
          rolling 90-day schedule and only aggregate counts survive. We use no third-party cross-site trackers.
        </p>
      </section>

      {/* 5 */}
      <section id="advertising" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">5. Advertising{' '}
          <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium align-middle ml-1">Optional · Consent-gated</span></h2>
        <p>
          Kruthika is 100% free thanks to contextual advertising delivered through Adsterra when you accept cookies.
          Ads are matched to the page you are viewing — <strong>never to your chat content or identity</strong>. If
          you decline, ad slots stay empty and nothing loads from ad networks.
        </p>
      </section>

      {/* 6 */}
      <section id="push" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">6. Push Notifications (Opt-in)</h2>
        <p>
          If you enable browser notifications, OneSignal stores a subscription identifier on your device and our
          servers so proactive messages can reach you. Unsubscribing via browser settings removes the identifier.
        </p>
      </section>

      {/* 7 */}
      <section id="browser-controls" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">7. Browser Controls &amp; Do Not Track</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li>Change consent anytime: chat 3-dot menu → <strong>Privacy &amp; Cookie Settings</strong>.</li>
          <li>Clear all cookies/site data through your browser settings (this also erases local chat memory).</li>
          <li>Browsers offer per-site cookie blocking; blocking strictly necessary storage will break the chat.</li>
        </ul>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          “Do Not Track” signals: no industry standard exists, so we do not currently respond to DNT headers. If a
          binding standard emerges we will update this section.
        </p>
      </section>

      {/* 8 */}
      <section id="updates-contact" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">8. Updates &amp; Contact</h2>
        <p>
          Material changes to this Policy will be reflected in the “Last Updated” date above and highlighted on the
          website. Questions about cookie practices? Contact{' '}
          <a href="mailto:privacy@kruthika.fun" className="text-amber-600 dark:text-amber-400 underline font-medium">privacy@kruthika.fun</a>.
        </p>
      </section>
    </LegalPageShell>
  );
}