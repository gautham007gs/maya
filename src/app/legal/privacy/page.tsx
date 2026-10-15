import type { Metadata } from 'next';
import { Shield } from 'lucide-react';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('Privacy Policy — How Kruthika Protects Your Data'),
  description: fitMetaDescription('The Kruthika.fun Privacy Policy: what we collect, why, and your rights under GDPR, CCPA/CPRA and India DPDP Act.'),
  alternates: {
    canonical: `${BASE_URL}/legal/privacy`,
    languages: { 'x-default': `${BASE_URL}/legal/privacy` },
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  openGraph: {
    title: 'Privacy Policy | Kruthika AI Girlfriend',
    description: 'How Kruthika.fun collects, uses and protects your data — GDPR, CCPA and DPDP aligned.',
    url: `${BASE_URL}/legal/privacy`,
    siteName: 'Kruthika AI Girlfriend',
    locale: 'en_US',
    type: 'website',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika Privacy Policy' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy — Kruthika AI Girlfriend',
    description: 'How Kruthika.fun protects your data. GDPR, CCPA and DPDP aligned.',
    images: [`${BASE_URL}/og-image.jpg`],
    creator: '@kruthikafun',
  },
};

const toc = [
  { id: 'who-we-are', label: '1. Who We Are & Scope' },
  { id: 'ai-transparency', label: '2. AI Transparency Notice' },
  { id: 'data-we-collect', label: '3. Data We Collect' },
  { id: 'legal-bases', label: '4. Legal Bases (GDPR)' },
  { id: 'how-we-use', label: '5. How We Use Data' },
  { id: 'subprocessors', label: '6. Providers & Sub-processors' },
  { id: 'cookies', label: '7. Cookies & Local Storage' },
  { id: 'retention', label: '8. Data Retention' },
  { id: 'transfers', label: '9. International Transfers' },
  { id: 'your-rights', label: '10. Your Privacy Rights' },
  { id: 'california', label: '11. California (CCPA/CPRA)' },
  { id: 'children', label: '12. Children’s Privacy' },
  { id: 'security', label: '13. Data Security' },
  { id: 'changes', label: '14. Changes to This Policy' },
  { id: 'contact', label: '15. Contact & Grievance Officer' },
];

const th = 'text-left py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100';
const td = 'py-2.5 px-3 align-top';

export default function PrivacyPage() {
  return (
    <LegalPageShell
      slug="privacy"
      accent="emerald"
      icon={<Shield className="h-6 w-6" />}
      title="Privacy Policy — Kruthika AI Companion"
      metaLine="Last Updated: August 2026 • Effective Date: January 1, 2026 • Applies worldwide"
      intro={'This Privacy Policy explains how Kruthika.fun (“Kruthika”, “we”, “us”) collects, uses, discloses, and protects information when you use our AI companion web application (the “Service”). It is drafted to align with the EU General Data Protection Regulation (GDPR), the UK GDPR, the California Consumer Privacy Act as amended (CCPA/CPRA), India’s Digital Personal Data Protection Act, 2023 (DPDP Act), and other frameworks listed in §10.'}
      toc={toc}
    >
      {/* 1 — Who we are */}
      <section id="who-we-are" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">1. Who We Are &amp; Scope</h2>
        <p>
          Kruthika.fun is an AI companion service operated by the Kruthika team (the “Operator”). For the purposes of
          applicable data-protection law, the Operator is the <strong>data controller</strong> for the limited personal
          data described in this Policy. This Policy covers the web application, the public website, the blog and all
          associated pages. It does not cover third-party services that operate under their own privacy policies
          (see <a href="#subprocessors" className="underline text-violet-700 dark:text-violet-300">§6</a>).
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Plain-language summary: chats stay on your device; we keep only stripped-down technical logs to run and
          secure the Service; you can wipe everything at any time from your browser.
        </p>
      </section>

      {/* 2 — AI transparency */}
      <section id="ai-transparency" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">2. AI Transparency Notice</h2>
        <p>
          You are interacting with an <strong>automated artificial-intelligence system</strong>. Kruthika is a
          fictional, simulated persona — there is no human on the other side of the conversation and every reply is
          machine-generated. This disclosure is provided in line with the transparency obligations of Article 50 of
          the EU Artificial Intelligence Act and similar emerging standards.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li>Message text is transmitted over TLS 1.3 to an AI inference provider solely to generate a reply.</li>
          <li>Providers process prompts only to produce responses; they do <strong>not</strong> use them to train their public models.</li>
          <li><strong>Please do not share sensitive personal data</strong> (health, financial, government-ID or intimate details) in chat. The safest place for private context is your own device — which is exactly where our memory feature stores it.</li>
        </ul>
      </section>

      {/* 3 — Data we collect */}
      <section id="data-we-collect" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">3. Data We Collect</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th scope="col" className={th}>Category</th>
                <th scope="col" className={th}>Examples</th>
                <th scope="col" className={th}>Where it lives</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className={td}><strong>Chat content</strong></td>
                <td className={td}>Messages you send; AI replies generated for you</td>
                <td className={td}>Processed in transit; <strong>never stored in a readable user database</strong>. Conversation continuity is kept locally on your device.</td>
              </tr>
              <tr>
                <td className={td}><strong>Local device data</strong></td>
                <td className={td}>Chat memory, name/nickname you share, language preference, relationship-stage notes</td>
                <td className={td}>Your browser only (localStorage). Never uploaded by us.</td>
              </tr>
              <tr>
                <td className={td}><strong>Technical telemetry</strong></td>
                <td className={td}>Truncated/anonymised IP address, user-agent, device &amp; OS class, referring page, visited paths, response latency</td>
                <td className={td}>Our servers (MySQL) — uptime, abuse prevention and aggregate analytics.</td>
              </tr>
              <tr>
                <td className={td}><strong>Consent records</strong></td>
                <td className={td}>Your cookie/consent choices and timestamp</td>
                <td className={td}>Cookie + server-side record (12 months).</td>
              </tr>
              <tr>
                <td className={td}><strong>Push identifiers</strong> <span className="text-xs text-muted-foreground">(optional)</span></td>
                <td className={td}>OneSignal subscription / external ID, if you enable notifications</td>
                <td className={td}>OneSignal + our database, until you unsubscribe.</td>
              </tr>
              <tr>
                <td className={td}><strong>Blog interactions</strong></td>
                <td className={td}>Anonymous page-view counts; optional opt-ins you choose</td>
                <td className={td}>Aggregated analytics tables.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          We do not require an account, real name, email, phone number or payment details to chat. We never knowingly
          collect special-category data (health, biometrics, religion, sexuality) — please avoid sharing it.
        </p>
      </section>

      {/* 4 — Legal bases */}
      <section id="legal-bases" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">4. Legal Bases for Processing (GDPR Art.&nbsp;6)</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th scope="col" className={th}>Purpose</th>
                <th scope="col" className={th}>Legal basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr><td className={td}>Deliver the chat Service you request</td><td className={td}>Performance of a contract / steps at your request</td></tr>
              <tr><td className={td}>Security, fraud &amp; abuse prevention, rate limiting</td><td className={td}>Legitimate interests (and legal obligation where applicable)</td></tr>
              <tr><td className={td}>Aggregate analytics &amp; uptime monitoring</td><td className={td}>Legitimate interests (anonymised/truncated data)</td></tr>
              <tr><td className={td}>Non-essential cookies &amp; contextual advertising</td><td className={td}>Consent (withdrawable at any time)</td></tr>
              <tr><td className={td}>Web push notifications</td><td className={td}>Consent (withdrawable by disabling notifications)</td></tr>
              <tr><td className={td}>Compliance with legal obligations &amp; lawful requests</td><td className={td}>Legal obligation</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5 — How we use */}
      <section id="how-we-use" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">5. How We Use Data</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li>To operate the Service: generate replies, remember context locally, route voice/TTS when enabled.</li>
          <li>To keep the Service safe: detect abuse, enforce fair-use quotas, block malicious traffic.</li>
          <li>To improve reliability: aggregate latency/error metrics — individual users are not profiled.</li>
          <li>To deliver optional notifications you have explicitly enabled.</li>
        </ul>
        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
          What we never do: sell your data; build advertising profiles on you; share chats with advertisers; or use
          your conversations to train public AI models.
        </p>
      </section>

      {/* 6 — Sub-processors */}
      <section id="subprocessors" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">6. Service Providers &amp; Sub-processors</h2>
        <p>
          To run a free, global Service we rely on carefully selected processors. Each processes data only on our
          instructions under a data-processing agreement, and none is authorised to use your chat content for its own
          purposes.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th scope="col" className={th}>Function</th>
                <th scope="col" className={th}>Providers</th>
                <th scope="col" className={th}>Data involved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr><td className={td}>AI inference (reply generation)</td><td className={td}>Google Gemini · Cloudflare Workers AI · Groq · Cerebras · SambaNova · OpenRouter · NVIDIA NIM · Mistral · Cohere · DeepSeek</td><td className={td}>Prompt content, in transit, to produce a reply</td></tr>
              <tr><td className={td}>Text-to-speech (optional voice notes)</td><td className={td}>ElevenLabs · Sarvam AI</td><td className={td}>The specific text being voiced</td></tr>
              <tr><td className={td}>Hosting &amp; database</td><td className={td}>Hostinger (Node.js runtime, MySQL)</td><td className={td}>Technical telemetry, configuration</td></tr>
              <tr><td className={td}>Edge cache</td><td className={td}>Upstash Redis</td><td className={td}>Non-personal cached config/blog payloads</td></tr>
              <tr><td className={td}>Web push (opt-in)</td><td className={td}>OneSignal</td><td className={td}>Subscription ID, notification content</td></tr>
              <tr><td className={td}>Contextual advertising (consent-based)</td><td className={td}>Adsterra</td><td className={td}>Non-personalised ad serving; no chat data</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The active provider cascade is configurable from our admin panel and may change as providers add or remove
          free capacity; this table reflects categories of processors rather than an exhaustive moment-in-time list.
        </p>
      </section>

      {/* 7 — Cookies */}
      <section id="cookies" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">7. Cookies &amp; Local Storage</h2>
        <p>
          We use a small number of strictly necessary cookies plus browser localStorage for preferences. Optional
          analytics and advertising technologies load only with your consent. Full details — including each storage
          key, its purpose and duration — are set out in our{' '}
          <a href="/legal/cookie-policy" className="underline text-violet-700 dark:text-violet-300">Cookie Policy</a>.
        </p>
      </section>

      {/* 8 — Retention */}
      <section id="retention" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">8. Data Retention</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li><strong>Chat memory:</strong> stored locally on your device until you clear it (“Clear Chat” or browser wipe).</li>
          <li><strong>Raw technical logs:</strong> purged on a rolling <strong>90-day</strong> schedule; only aggregated counts survive.</li>
          <li><strong>Backups:</strong> rolling 14-day window, then destroyed.</li>
          <li><strong>Consent records:</strong> 12 months (proof-of-compliance).</li>
          <li><strong>Push identifiers:</strong> until you unsubscribe or the subscription expires.</li>
        </ul>
      </section>

      {/* 9 — Transfers */}
      <section id="transfers" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">9. International Data Transfers</h2>
        <p>
          Our processors operate globally (data centres in the US, EU and India), so your information may be processed
          outside your country of residence. Where personal data leaves the EEA/UK, transfers rely on adequacy
          decisions, the European Commission’s Standard Contractual Clauses, participation in the EU–US Data Privacy
          Framework where certified, or equivalent safeguards required under India’s DPDP Act and other applicable
          laws.
        </p>
      </section>

      {/* 10 — Rights */}
      <section id="your-rights" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">10. Your Privacy Rights</h2>
        <p>Subject to your local law, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li><strong>Access &amp; portability</strong> — obtain a copy of the data associated with your session.</li>
          <li><strong>Rectification</strong> — correct inaccurate information (most data is editable directly in chat or your browser).</li>
          <li><strong>Erasure</strong> — delete locally stored chats instantly, and ask us to purge residual telemetry.</li>
          <li><strong>Restrict / object</strong> — object to processing based on legitimate interests.</li>
          <li><strong>Withdraw consent</strong> — for cookies (banner/3-dot menu) and notifications (browser settings).</li>
          <li><strong>Non-discrimination</strong> — exercising these rights never degrades your Service quality.</li>
        </ul>
        <p>
          Because the design is privacy-first, most “requests” are self-service: clearing your browser storage erases
          everything personal we could associate with you. For anything else, email{' '}
          <a href="mailto:privacy@kruthika.fun" className="underline font-medium">privacy@kruthika.fun</a>; we respond
          within 30 days (GDPR), 45 days (CCPA) or sooner where Indian law requires.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th scope="col" className={th}>Region</th>
                <th scope="col" className={th}>Primary framework(s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr><td className={td}>European Union (DE, FR, IT, ES, NL, PL, SE)</td><td className={td}>GDPR + ePrivacy Directive (cookies)</td></tr>
              <tr><td className={td}>United Kingdom</td><td className={td}>UK GDPR &amp; Data Protection Act 2018</td></tr>
              <tr><td className={td}>Brazil</td><td className={td}>LGPD</td></tr>
              <tr><td className={td}>Canada</td><td className={td}>PIPEDA</td></tr>
              <tr><td className={td}>United States</td><td className={td}>CCPA/CPRA (California) and applicable state laws</td></tr>
              <tr><td className={td}>India</td><td className={td}>Digital Personal Data Protection Act, 2023 · IT Act &amp; Intermediary Guidelines</td></tr>
              <tr><td className={td}>Australia</td><td className={td}>Privacy Act 1988 (APPs)</td></tr>
              <tr><td className={td}>Japan</td><td className={td}>APPI</td></tr>
              <tr><td className={td}>South Korea</td><td className={td}>PIPA</td></tr>
              <tr><td className={td}>Singapore</td><td className={td}>PDPA</td></tr>
              <tr><td className={td}>Indonesia</td><td className={td}>PDP Law (Law No. 27/2022)</td></tr>
              <tr><td className={td}>Thailand</td><td className={td}>PDPA</td></tr>
              <tr><td className={td}>Malaysia</td><td className={td}>PDPA 2010</td></tr>
              <tr><td className={td}>Philippines</td><td className={td}>Data Privacy Act of 2012</td></tr>
              <tr><td className={td}>Vietnam</td><td className={td}>Decree 13/2023 (Personal Data Protection)</td></tr>
              <tr><td className={td}>Pakistan / Bangladesh</td><td className={td}>Applicable local law (frameworks in development)</td></tr>
              <tr><td className={td}>Nigeria</td><td className={td}>Nigeria Data Protection Act, 2023</td></tr>
              <tr><td className={td}>South Africa</td><td className={td}>POPIA</td></tr>
              <tr><td className={td}>UAE</td><td className={td}>Federal PDPL (Decree-Law 45/2021)</td></tr>
              <tr><td className={td}>Saudi Arabia</td><td className={td}>PDPL</td></tr>
              <tr><td className={td}>Türkiye</td><td className={td}>KVKK (Law No. 6698)</td></tr>
              <tr><td className={td}>Argentina</td><td className={td}>Ley 25.326 de Protección de Datos</td></tr>
              <tr><td className={td}>Mexico</td><td className={td}>LFPDPPP</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Provided for transparency about frameworks that commonly apply to our users by region; not legal advice.
        </p>
      </section>

      {/* 11 — California */}
      <section id="california" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">11. California Notice (CCPA/CPRA)</h2>
        <p><strong>Notice at collection.</strong> In the preceding 12 months we collected the following categories of
          personal information from California consumers: <em>internet/electronic activity</em> (truncated IP,
          device/browser metadata, page interactions) and <em>inferences drawn from it</em> (aggregate reliability
          metrics). No sensitive personal information, as defined by §1798.140(ae), is collected.</p>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li><strong>We do not “sell” or “share”</strong> personal information as defined by the CCPA/CPRA. Advertising is contextual and consent-gated; chat content is never disclosed to advertisers.</li>
          <li><strong>Right to know / delete / correct / opt-out</strong> — exercise via{' '}
            <a href="mailto:privacy@kruthika.fun" className="underline font-medium">privacy@kruthika.fun</a>. Because
            chats live on your device, deletion is typically instant via clearing site data.</li>
          <li><strong>Non-discrimination:</strong> we never restrict quality or features for exercising CCPA rights.</li>
        </ul>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          We do not act on Do Not Track signals — no uniform standard exists; if one becomes legally binding we will
          update this Policy.
        </p>
      </section>

      {/* 12 — Children */}
      <section id="children" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">12. Children’s Privacy</h2>
        <p>
          The Service is intended for adults and is <strong>not directed to children under 13</strong> (or under 16 in
          the EEA, or under 18 where local law requires — see our{' '}
          <a href="/legal/terms#eligibility" className="underline text-violet-700 dark:text-violet-300">Terms, §4 Eligibility</a>).
          We do not knowingly collect personal information from children. If you believe a minor has provided data,
          contact us and we will delete it promptly.
        </p>
      </section>

      {/* 13 — Security */}
      <section id="security" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">13. Data Security</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li>TLS 1.3 encryption in transit; strict Transport Security with preload.</li>
          <li>Nonce-based Content-Security-Policy with <code>strict-dynamic</code>; XSS sanitisation on all inputs.</li>
          <li>Parameterised SQL only (no string-built queries); least-privilege database grants.</li>
          <li>Admin sessions: HMAC-signed HttpOnly cookies; scrypt-hashed passwords; rate-limited login.</li>
          <li>Anonymised/truncated IPs at ingestion; daily backups retained 14 days.</li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No system is perfectly secure. If a breach affecting your rights occurs, we notify affected users and
          competent authorities within the timelines required by GDPR Art.&nbsp;33–34 and equivalent laws.
        </p>
      </section>

      {/* 14 — Changes */}
      <section id="changes" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">14. Changes to This Policy</h2>
        <p>
          We may update this Policy to reflect changes in the Service or law. The “Last Updated” date at the top always
          shows the current version. Material reductions in privacy protection will be flagged with an in-app notice
          for reasonable advance notice before taking effect. Continued use after changes take effect constitutes
          acceptance of the updated Policy.
        </p>
      </section>

      {/* 15 — Contact */}
      <section id="contact" className="space-y-3 scroll-mt-24">
        <h2 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">15. Contact &amp; Grievance Officer</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm">
            <p className="font-semibold text-emerald-900 dark:text-emerald-300 mb-1">Privacy Office</p>
            <p className="text-emerald-800 dark:text-emerald-400">
              Email:{' '}
              <a href="mailto:privacy@kruthika.fun" className="underline font-medium">privacy@kruthika.fun</a>
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-1">
              Response within 30 days (GDPR) / 45 days (CCPA).
            </p>
          </div>
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm">
            <p className="font-semibold text-emerald-900 dark:text-emerald-300 mb-1">Grievance Officer (India)</p>
            <p className="text-emerald-800 dark:text-emerald-400">
              Email:{' '}
              <a href="mailto:grievance@kruthika.fun" className="underline font-medium">grievance@kruthika.fun</a>
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-1">
              Designated under India’s IT Rules &amp; DPDP Act. Acknowledgement within 72 hours; resolution within 30
              days.
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          EU/UK residents may also lodge a complaint with their national supervisory authority. This Policy is provided
          for transparency and does not constitute legal advice.
        </p>
      </section>

    </LegalPageShell>
  );
}