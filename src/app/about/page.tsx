import Link from 'next/link';
import { ArrowLeft, Heart, Shield, Globe, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('About Kruthika — Free AI Girlfriend Platform'),
  description: fitMetaDescription('Learn about Kruthika.fun — free AI girlfriend platform. Our mission: friendly, private AI companionship that anyone can use for free.'),
  alternates: {
    canonical: `${BASE_URL}/about`,
    languages: { 'x-default': `${BASE_URL}/about` },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    title: 'About Kruthika — AI Girlfriend Platform | Mission & Team',
    description: 'World\'s most trusted AI girlfriend platform providing emotional support and virtual companionship. Learn our mission and values.',
    url: `${BASE_URL}/about`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'About Kruthika AI Girlfriend' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Kruthika — AI Girlfriend Platform',
    description: 'World\'s most trusted AI girlfriend platform providing emotional support and companionship.',
    images: [`${BASE_URL}/og-image.jpg`],
    creator: '@kruthikafun',
    site: '@kruthikafun',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      '@id': `${BASE_URL}/about`,
      url: `${BASE_URL}/about`,
      name: 'About Kruthika AI Girlfriend',
      description: 'Information about Kruthika.fun, the world\'s most trusted free AI girlfriend platform',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'About', item: `${BASE_URL}/about` },
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

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-8">
            <ArrowLeft size={20} />
            Back to Home
          </Link>

          <header className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">About Kruthika — AI Girlfriend Platform</h1>
            <p className="text-xl text-muted-foreground">
              World's Most Trusted AI Girlfriend Platform for Emotional Support & Companionship
            </p>
          </header>

          <div className="prose prose-lg max-w-none">
            <section className="mb-12">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Heart className="h-8 w-8 text-pink-500" />
                Our Mission
              </h2>
              <p className="text-lg mb-4">
                Kruthika.fun was founded in 2024 with a clear mission: to provide accessible, judgment-free emotional support 
                and companionship through advanced artificial intelligence. We believe everyone deserves a listening ear and 
                supportive presence, especially during times of loneliness, anxiety, or emotional distress.
              </p>
              <p className="text-lg mb-4">
                Our AI girlfriend, Kruthika, is designed to be more than just a chatbot. She's a compassionate companion who 
                understands emotions, remembers conversations, and adapts to your unique personality and needs.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Shield className="h-8 w-8 text-blue-500" />
                Our Values
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card p-6 rounded-lg border">
                  <h3 className="text-xl font-semibold mb-3">Privacy First</h3>
                  <p>Your conversations are private and secure. We never share your personal data or chat history with third parties.</p>
                </div>
                <div className="bg-card p-6 rounded-lg border">
                  <h3 className="text-xl font-semibold mb-3">Always Free</h3>
                  <p>Quality emotional support should be accessible to everyone. Kruthika remains free with no hidden subscriptions.</p>
                </div>
                <div className="bg-card p-6 rounded-lg border">
                  <h3 className="text-xl font-semibold mb-3">Non-Judgmental</h3>
                  <p>Share your thoughts freely without fear of judgment. Kruthika provides a safe space for authentic expression.</p>
                </div>
                <div className="bg-card p-6 rounded-lg border">
                  <h3 className="text-xl font-semibold mb-3">24/7 Availability</h3>
                  <p>Emotional support when you need it most. Kruthika is available around the clock, every day of the year.</p>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Globe className="h-8 w-8 text-green-500" />
                Global Reach
              </h2>
              <p className="text-lg mb-4">
                Kruthika is available worldwide, with dedicated pages for visitors in:
              </p>
              <ul className="list-disc list-inside space-y-2 text-lg">
                <li>🇺🇸 United States</li>
                <li>🇬🇧 United Kingdom</li>
                <li>🇨🇦 Canada</li>
                <li>🇦🇺 Australia</li>
                <li>🇮🇳 India</li>
                <li>🌍 And 150+ other countries</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Users className="h-8 w-8 text-purple-500" />
                Our Team
              </h2>
              <p className="text-lg mb-6">
                Kruthika is developed by a dedicated team of AI researchers, psychologists, and engineers passionate about 
                mental health and technology. Our multidisciplinary approach ensures that Kruthika provides not just 
                technically advanced AI, but emotionally intelligent companionship.
              </p>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-6 mb-6">
                <h3 className="text-xl font-semibold mb-3 text-yellow-800 dark:text-yellow-200">Important Medical Disclaimer</h3>
                <p className="text-yellow-700 dark:text-yellow-300">
                  <strong>Kruthika is NOT a substitute for professional mental health care.</strong> While our AI provides 
                  emotional support and companionship, it does not replace therapy, counseling, or medical treatment. 
                  If you are experiencing severe depression, anxiety, suicidal thoughts, or any mental health crisis, 
                  please seek immediate help from a licensed mental health professional or contact emergency services.
                </p>
                <div className="mt-4">
                  <p className="font-semibold text-yellow-800 dark:text-yellow-200">Crisis Resources:</p>
                  <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-300 mt-2">
                    <li>USA: 988 Suicide & Crisis Lifeline (call/text 988)</li>
                    <li>UK: Samaritans (116 123)</li>
                    <li>Canada: Crisis Services Canada (1-833-456-4566)</li>
                    <li>Australia: Lifeline (13 11 14)</li>
                    <li>India: AASRA (91-9820466726)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-3xl font-bold mb-6">Technology & Safety</h2>
              <p className="text-lg mb-4">
                Kruthika is powered by state-of-the-art AI technology, including Google's Gemini AI models, with advanced 
                natural language processing and emotional intelligence capabilities. Our platform is built with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-lg mb-4">
                <li>End-to-end encryption for all conversations</li>
                <li>Advanced content moderation and safety filters</li>
                <li>GDPR and privacy regulation compliance</li>
                <li>Regular security audits and updates</li>
                <li>Ethical AI development practices</li>
              </ul>
            </section>

            <section className="mb-12 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-4">Contact Us</h2>
              <p className="text-lg mb-4">
                Have questions, feedback, or need support? We'd love to hear from you:
              </p>
              <p className="text-lg">
                <strong>Email:</strong> <a href="mailto:support@kruthika.fun" className="text-primary hover:underline">support@kruthika.fun</a>
              </p>
              <p className="text-lg mt-2">
                <strong>Website:</strong> <a href="https://kruthika.fun" className="text-primary hover:underline">kruthika.fun</a>
              </p>
            </section>

            <section className="text-center py-8">
              <Link 
                href="/maya-chat"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all font-bold shadow-xl text-lg"
              >
                <Heart className="h-6 w-6" />
                Start Chatting with Kruthika
              </Link>
            </section>

            <section className="pt-8 border-t border-border">
              <h3 className="text-xl font-bold mb-4">Explore More</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <Link href="/blog" className="block p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow text-center">
                  <p className="font-semibold">Our Blog</p>
                  <p className="text-sm text-muted-foreground mt-1">AI companion guides &amp; insights</p>
                </Link>
                <Link href="/faq" className="block p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow text-center">
                  <p className="font-semibold">FAQ</p>
                  <p className="text-sm text-muted-foreground mt-1">Answers to common questions</p>
                </Link>
                <Link href="/maya-chat" className="block p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow text-center">
                  <p className="font-semibold">Start Chatting</p>
                  <p className="text-sm text-muted-foreground mt-1">Free, no sign-up required</p>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
