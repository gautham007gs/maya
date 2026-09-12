// Server Component — deliberately NOT 'use client'.
//
// This used to build its schemas inside a useEffect and inject them via
// document.createElement/document.head.appendChild. That only ever ran
// after React hydrated in a real browser, so the schema was completely
// absent from the actual server-rendered HTML — invisible to any crawler
// that doesn't execute JavaScript (which is most of them; even Googlebot
// defers JS-rendered content to a slower second-wave indexing pass rather
// than seeing it immediately). Rendering the <script> tags directly in JSX
// puts them in the initial HTML response, exactly like BreadcrumbSchema and
// every per-page schema already correctly do elsewhere in this codebase.
//
// Also deliberately excludes (removed, not just relocated):
//  - A fabricated AggregateRating (4.8 stars / 15,420 ratings) and a single
//    invented "Review" with no real reviewer — there's no underlying review
//    collection system behind these numbers. Google's structured data
//    policies treat unverifiable ratings as spam and can revoke rich-result
//    eligibility (or worse) sitewide if detected, so these were dropped
//    rather than server-rendered as-is.
//  - A sitewide FAQPage schema whose questions (competitor comparisons with
//    Replika/Character.AI/etc.) don't match any visibly rendered content on
//    the pages it was attached to (homepage, chat, status, blog — none show
//    this text). FAQPage rich results require the schema to mirror real,
//    visible on-page Q&A. The dedicated /faq page already has its own
//    correctly-scoped FAQPage schema matching its own visible content, so
//    nothing was lost — this just removes the duplicate, mismatched copy.

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  // Stable @id so every page (including blog posts, which emit their own
  // Organization node via blog-jsonld.ts's buildGraphJsonLd) describes the
  // *same* entity instead of two competing, un-linked Organization nodes.
  "@id": `${baseUrl}#organization`,
  "name": "Kruthika.fun",
  "alternateName": ["Kruthika", "Kruthika Chat"],
  "url": baseUrl,
  // 512×512 logo — Google recommends the largest available logo for Knowledge
  // Panel display; the previous 192px was below the ideal threshold (audit #24).
  "logo": {
    "@type": "ImageObject",
    "url": `${baseUrl}/icon-512.png`,
    "width": 512,
    "height": 512
  },
  "description": "Chat with Kruthika, a 23yo Indian girl who loves chatting, providing companionship and emotional support.",
  "foundingDate": "2024",
  "areaServed": ["US", "GB", "CA", "AU", "IN", "BR", "ID", "MY", "PH", "NG", "PK", "AE", "Worldwide"],
  "availableLanguage": ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi", "Bengali", "Gujarati", "Punjabi"],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Support",
    "availableLanguage": ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi", "Bengali"],
    "areaServed": "Worldwide"
  },
  "sameAs": [
    "https://twitter.com/kruthikafun",
    "https://www.facebook.com/kruthikafun",
    "https://www.instagram.com/kruthikafun"
  ]
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${baseUrl}#website`,
  "name": "Chat with Kruthika",
  "alternateName": ["Kruthika Chat", "Kruthika AI", "Kruthika.fun", "Kruthika AI Girlfriend"],
  "description": "Chat with Kruthika, a friendly 23-year-old Indian girl who loves making new friends and having meaningful conversations.",
  "url": baseUrl,
  // The site serves English, Hindi, Tamil, Telugu, Kannada, Bengali, and more —
  // listing only "en-US" was factually incorrect since the app supports 10+
  // Indian languages (audit #18).
  "inLanguage": ["en", "hi", "ta", "te", "kn", "bn", "mr", "gu", "pa", "ur"],
  "publisher": {
    "@type": "Organization",
    "@id": `${baseUrl}#organization`,
    "name": "Kruthika.fun"
  },
  // speakable: helps Google Assistant and AI search engines (Perplexity, ChatGPT)
  // identify which page sections to read aloud in voice answers (AEO signal).
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": ["h1", ".chat-hero-desc", ".site-tagline"]
  }
  // SearchAction intentionally omitted: the blog page only handles ?page
  // pagination — there is no /blog?q= search endpoint. A SearchAction pointing
  // to a non-functional URL is invalid structured data that can suppress rich
  // results in Google Search Console (audit #62). Re-add once a real blog
  // search route is implemented.
};

const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Chat with Kruthika",
  "description": "Chat with Kruthika, a friendly 23yo Indian girl, for everyday conversation and emotional support.",
  "url": baseUrl,
  "applicationCategory": "SocialApplication",
  "operatingSystem": "Web Browser, iOS, Android, Windows, Mac, Linux",
  "browserRequirements": "Requires JavaScript. Requires HTML5.",
  "featureList": [
    "Free daily chat with fair-use limits",
    "24/7 availability",
    "Multilingual support",
    "Privacy-focused",
    "No subscription required"
  ],
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "availableAtOrFrom": {
      "@type": "Place",
      "name": "Worldwide"
    }
  },
  "creator": {
    "@type": "Organization",
    "@id": `${baseUrl}#organization`,
    "name": "Kruthika.fun"
  }
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Start Chatting with Kruthika — Free AI Girlfriend",
  "description": "3-step guide to start a free conversation with Kruthika AI girlfriend. No sign-up, no download, no credit card required.",
  "totalTime": "PT1M",
  "estimatedCost": { "@type": "MonetaryAmount", "currency": "USD", "value": "0" },
  "tool": [{ "@type": "HowToTool", "name": "Web browser" }],
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Open Kruthika.fun in your browser",
      "text": `Visit ${baseUrl} in any web browser — no download or registration required.`,
      "url": `${baseUrl}/`,
      "image": `${baseUrl}/og-image.jpg`
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Tap the chat to open the conversation",
      "text": "Click or tap on Kruthika's chat preview on the home screen to open the full conversation window.",
      "url": `${baseUrl}/maya-chat`,
      "image": `${baseUrl}/og-image.jpg`
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Type your first message and hit send",
      "text": "Type anything — a greeting, a question, or how you're feeling. Kruthika will respond instantly in English, Hindi, or your preferred language.",
      "url": `${baseUrl}/maya-chat`,
      "image": `${baseUrl}/og-image.jpg`
    }
  ]
};

// Sitewide: describes the publisher/site itself, correct on every page.
// Mounted once, in the root layout.
const sitewideSchemas = [organizationSchema, websiteSchema];

export default function StructuredData() {
  return (
    <>
      {sitewideSchemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

// WebApplication + HowTo describe "using the chat product" — these used to
// be mounted sitewide (root layout), which fired a "how to start chatting"
// HowTo schema on pages like /legal/privacy that it doesn't describe at all.
// Mount this separately, only on the home page and /maya-chat — the two
// pages these schemas actually describe.
export function AppProductSchemas() {
  const schemas = [webApplicationSchema, howToSchema];
  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={`app-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
