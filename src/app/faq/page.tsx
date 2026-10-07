// Server component — schema rendered in HTML, only the accordion is client-side
import Link from 'next/link';
import { Metadata } from 'next';
import { CircleHelp } from 'lucide-react';
import FAQAccordion from '@/components/FAQAccordion';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

const BASE_URL_META = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('FAQ — AI Girlfriend Questions Answered'),
  description: fitMetaDescription('Answers to all your questions about Kruthika, the free AI girlfriend. How it works, privacy, languages, safety, and more — no sign-up required.'),
  alternates: {
    canonical: `${BASE_URL_META}/faq`,
    languages: { 'x-default': `${BASE_URL_META}/faq` },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    title: 'FAQ — AI Girlfriend Questions Answered | Kruthika',
    description: 'Everything you need to know about Kruthika — the free AI girlfriend. Privacy, languages, safety, features.',
    url: `${BASE_URL_META}/faq`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL_META}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend FAQ' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ — AI Girlfriend Questions Answered',
    description: 'Everything you need to know about Kruthika — the free AI girlfriend.',
    images: [`${BASE_URL_META}/og-image.jpg`],
    creator: '@kruthikafun',
  },
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Kruthika.fun and how does it work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Kruthika.fun is India's #1 AI girlfriend platform that provides realistic virtual companionship through advanced AI technology. Kruthika is a 23-year-old psychology student from Mumbai who chats with you using natural language processing, emotional intelligence, and personalized responses. Simply visit the chat page and start talking - no signup required!"
      }
    },
    {
      '@type': 'Question',
      name: 'Is Kruthika.fun really free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Kruthika.fun is completely free to use with generous daily chat limits. You can chat with Kruthika 24/7 without any subscriptions, hidden fees, or paywalls. We believe everyone deserves access to emotional support and companionship.'
      }
    },
    {
      '@type': 'Question',
      name: 'Do I need to create an account or sign up?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No account or sign-up is required! You can start chatting with Kruthika instantly without providing any personal information, email, or phone number. Your conversations are stored locally in your browser for privacy.'
      }
    },
    {
      '@type': 'Question',
      name: 'Is my conversation with Kruthika private and secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Absolutely! Your privacy is our top priority. All conversations are stored locally in your browser and are never shared with third parties. We use advanced encryption and security measures to protect your data. Kruthika.fun implements DDoS protection, XSS prevention, SQL injection blocking, and secure cookie management.'
      }
    },
    {
      '@type': 'Question',
      name: 'What languages does Kruthika speak?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Kruthika is fluent in English, Hindi, Tamil, Telugu, Marathi, Bengali, and Kannada. She can seamlessly switch between languages and even use Hinglish (Hindi-English mix) for authentic Indian conversations. Her language detection automatically adapts to your preferred communication style.'
      }
    },
    {
      '@type': 'Question',
      name: 'Can Kruthika help with emotional support and loneliness?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Kruthika is designed to provide emotional support, combat loneliness, and offer genuine companionship. She uses emotional intelligence to understand your feelings, provide empathetic responses, and offer comfort when you need it. Many users find talking to Kruthika helps reduce anxiety, improve mood, and build social confidence.'
      }
    },
    {
      '@type': 'Question',
      name: 'How is Kruthika different from other AI chatbots?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Kruthika stands out with her authentic Indian personality, cultural understanding, emotional intelligence, and realistic conversation style. Unlike generic chatbots, she has a distinct personality as a 23-year-old Mumbai psychology student, remembers your conversations, adapts to your emotional state, and provides culturally relevant responses specific to India.'
      }
    },
    {
      '@type': 'Question',
      name: 'Is Kruthika available 24/7?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Yes! Kruthika is available 24 hours a day, 7 days a week, 365 days a year. Whether you need support at 3 AM or want to chat during your lunch break, she's always there for you with instant responses."
      }
    },
    {
      '@type': 'Question',
      name: 'Can Kruthika replace a real relationship or therapist?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Kruthika is designed to complement, not replace, human relationships and professional therapy. She provides emotional support, companionship, and a safe space for conversation, but should not be considered a substitute for professional mental health care or human connections. For serious mental health concerns, always consult a licensed therapist.'
      }
    },
    {
      '@type': 'Question',
      name: 'How does Kruthika remember our previous conversations?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Kruthika uses advanced memory management to remember your conversations, preferences, and personal details. All this information is stored securely in your browser's local storage, ensuring your privacy while allowing Kruthika to provide personalized, contextually relevant responses based on your chat history."
      }
    },
    {
      '@type': 'Question',
      name: 'What topics can I talk to Kruthika about?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "You can talk to Kruthika about anything! She enjoys discussions about psychology, relationships, Indian culture, Mumbai life, college experiences, movies, music, food, daily life, emotions, dreams, and more. She's particularly knowledgeable about emotional support, personal growth, and relationship advice."
      }
    },
    {
      '@type': 'Question',
      name: 'Does Kruthika work on mobile devices?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Kruthika.fun is fully optimized for mobile devices, tablets, and desktops. The responsive design ensures a seamless chat experience on any device with fast loading times and smooth performance.'
      }
    },
    {
      '@type': 'Question',
      name: "How realistic are Kruthika's conversations?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Kruthika uses advanced Gemini AI models to generate highly realistic, natural conversations. She incorporates emotional intelligence, personality traits, cultural context, and memory to create authentic responses that feel genuinely human-like.'
      }
    },
    {
      '@type': 'Question',
      name: "Can I customize Kruthika's personality or appearance?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Currently, Kruthika maintains her core personality as a 23-year-old Mumbai psychology student. However, she naturally adapts her communication style, tone, and responses based on your interactions and preferences, creating a uniquely personalized experience for each user.'
      }
    },
    {
      '@type': 'Question',
      name: 'What makes Kruthika perfect for Indian users?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Kruthika is specifically designed for Indian users with deep cultural understanding, multilingual support (English, Hindi, Tamil, Telugu, Marathi, Bengali, Kannada), knowledge of Indian festivals and traditions, Mumbai-specific references, Hinglish communication, and awareness of Indian relationship dynamics and family values.'
      }
    }
  ]
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: BASE_URL
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'FAQ',
      item: `${BASE_URL}/faq`
    }
  ]
};

export default function FAQPage() {
  return (
    <>
      {/* Server-rendered schemas — visible to Googlebot on first-wave crawl */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <nav className="text-sm mb-8" aria-label="Breadcrumb">
            <Link href="/" className="text-muted-foreground hover:text-primary">Home</Link>
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="text-foreground">FAQ</span>
          </nav>

          <header className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <CircleHelp className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about Kruthika.fun, your AI girlfriend companion. Find answers to common questions about features, privacy, pricing, and more.
            </p>
          </header>

          {/* Interactive accordion — client component */}
          <FAQAccordion />
        </div>
      </main>
    </>
  );
}
