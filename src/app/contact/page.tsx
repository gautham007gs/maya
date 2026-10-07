// Item #36 — Contact Page
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Mail, Globe, Clock, MessageCircle, HelpCircle } from 'lucide-react';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('Contact Us — Kruthika AI Girlfriend Support'),
  description: fitMetaDescription('Get in touch with Kruthika.fun support team. We\'re here to help with questions about our free AI girlfriend platform, privacy concerns, or technical issues.'),
  alternates: {
    canonical: `${BASE_URL}/contact`,
    languages: { 'x-default': `${BASE_URL}/contact` },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    title: 'Contact Kruthika.fun — AI Girlfriend Support',
    description: 'Reach out to the Kruthika.fun support team for help, feedback, or partnership inquiries.',
    url: `${BASE_URL}/contact`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Contact Kruthika AI Girlfriend' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Kruthika.fun',
    description: 'Get support for your AI girlfriend experience on Kruthika.fun.',
    images: [`${BASE_URL}/og-image.jpg`],
    site: '@kruthikafun',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ContactPage',
      '@id': `${BASE_URL}/contact`,
      url: `${BASE_URL}/contact`,
      name: 'Contact Kruthika.fun',
      description: 'Contact information and support resources for Kruthika.fun — the free AI girlfriend platform.',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Contact', item: `${BASE_URL}/contact` },
        ],
      },
      mainEntity: {
        '@type': 'Organization',
        '@id': `${BASE_URL}#organization`,
        name: 'Kruthika.fun',
      },
    },
  ],
};

const faqs = [
  {
    q: 'How quickly do you respond to support emails?',
    a: 'We aim to respond to all support inquiries within 24–48 hours on business days.',
  },
  {
    q: 'Can I request deletion of my data?',
    a: 'Yes. Since conversations are stored locally in your browser, simply clearing your browser\'s local storage removes all chat data. For server-side memory deletion, email privacy@kruthika.fun.',
  },
  {
    q: 'I found a bug — how do I report it?',
    a: 'Email bugs@kruthika.fun with a description of the issue, your device/browser, and steps to reproduce it. Screenshots are very helpful.',
  },
  {
    q: 'How can I partner with or advertise on Kruthika.fun?',
    a: 'For partnership and advertising enquiries, email partnerships@kruthika.fun with details about your brand and goals.',
  },
];

export default function ContactPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="text-sm mb-8">
            <Link href="/" className="text-muted-foreground hover:text-primary">Home</Link>
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="text-foreground font-medium">Contact</span>
          </nav>

          <header className="mb-12">
            <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-6">
              <ArrowLeft size={18} />
              Back to Home
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Questions, feedback, privacy requests, or partnership inquiries — we&apos;d love to hear from you.
            </p>
          </header>

          <div className="grid md:grid-cols-2 gap-8 mb-12">

            {/* General Support */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-pink-600" />
                </div>
                <h2 className="text-xl font-semibold">General Support</h2>
              </div>
              <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                App issues, account questions, feature requests, or general feedback about your Kruthika experience.
              </p>
              <a
                href="mailto:support@kruthika.fun"
                className="inline-flex items-center gap-2 text-primary font-semibold hover:underline text-sm"
              >
                <Mail size={15} />
                support@kruthika.fun
              </a>
            </div>

            {/* Privacy & Data */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold">Privacy & Data</h2>
              </div>
              <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                GDPR/privacy requests, data deletion inquiries, or concerns about how we handle your information.
              </p>
              <a
                href="mailto:privacy@kruthika.fun"
                className="inline-flex items-center gap-2 text-primary font-semibold hover:underline text-sm"
              >
                <Mail size={15} />
                privacy@kruthika.fun
              </a>
            </div>

            {/* Partnerships */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold">Partnerships & Advertising</h2>
              </div>
              <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                Collaboration proposals, advertising opportunities, and business partnerships.
              </p>
              <a
                href="mailto:partnerships@kruthika.fun"
                className="inline-flex items-center gap-2 text-primary font-semibold hover:underline text-sm"
              >
                <Mail size={15} />
                partnerships@kruthika.fun
              </a>
            </div>

            {/* Response Times */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold">Response Times</h2>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex justify-between">
                  <span>General support</span>
                  <span className="font-medium text-foreground">24–48 hours</span>
                </li>
                <li className="flex justify-between">
                  <span>Privacy requests</span>
                  <span className="font-medium text-foreground">Within 30 days</span>
                </li>
                <li className="flex justify-between">
                  <span>Partnerships</span>
                  <span className="font-medium text-foreground">3–5 business days</span>
                </li>
                <li className="flex justify-between">
                  <span>Bug reports</span>
                  <span className="font-medium text-foreground">24–72 hours</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Company Info */}
          <div className="bg-muted/30 border border-border rounded-2xl p-6 mb-12">
            <h2 className="text-xl font-semibold mb-4">Company Information</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Company</p>
                <p className="font-medium">Kruthika.fun</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Website</p>
                <a href="https://kruthika.fun" className="font-medium text-primary hover:underline">kruthika.fun</a>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Founded</p>
                <p className="font-medium">2024</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Support Email</p>
                <a href="mailto:support@kruthika.fun" className="font-medium text-primary hover:underline">support@kruthika.fun</a>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-primary" />
              Common Questions
            </h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <details key={i} className="group border border-border rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer font-semibold text-sm text-foreground select-none hover:bg-muted/40 transition-colors list-none">
                    <span>{faq.q}</span>
                    <span className="text-muted-foreground text-xl group-open:rotate-45 transition-transform shrink-0">+</span>
                  </summary>
                  <div className="px-5 pb-4 pt-1 text-sm text-foreground/80 leading-relaxed border-t border-border/50">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="pt-8 border-t border-border">
            <h3 className="text-lg font-bold mb-4">Helpful Links</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <Link href="/faq" className="block p-4 bg-card border border-border rounded-xl hover:shadow-md transition-shadow text-center text-sm">
                <p className="font-semibold">FAQ</p>
                <p className="text-muted-foreground mt-1">Common questions answered</p>
              </Link>
              <Link href="/legal/privacy" className="block p-4 bg-card border border-border rounded-xl hover:shadow-md transition-shadow text-center text-sm">
                <p className="font-semibold">Privacy Policy</p>
                <p className="text-muted-foreground mt-1">How we protect your data</p>
              </Link>
              <Link href="/legal/terms" className="block p-4 bg-card border border-border rounded-xl hover:shadow-md transition-shadow text-center text-sm">
                <p className="font-semibold">Terms of Service</p>
                <p className="text-muted-foreground mt-1">Usage terms and conditions</p>
              </Link>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
