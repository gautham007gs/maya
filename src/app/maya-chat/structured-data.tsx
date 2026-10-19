// Server component — zero CSR cost.
//
// Previously rendered two separate schemas (SoftwareApplication +
// WebApplication) on the same page, causing schema validation errors
// for duplicate/conflicting product types. Consolidated into a single
// SoftwareApplication node which is the correct Schema.org type for a
// web-based AI application (WebApplication is a sub-type and would need
// to be emitted as a graph node referencing the same @id, not a second
// independent root object).
//
// The sitewide WebApplication node (describing the general product) lives
// in StructuredData.tsx → AppProductSchemas, which is also mounted on this
// page via maya-chat/layout.tsx. No duplication needed here.
//
// URLs are env-driven (NEXT_PUBLIC_BASE_URL) so the schema stays correct on
// any deployment host (e.g. www.kruthika.fun) — never hardcode the domain.
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export function ChatStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Kruthika AI Girlfriend Chat",
    "applicationCategory": "SocialApplication",
    "applicationSubCategory": "AI Companion",
    "operatingSystem": "Web, Android, iOS",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "description": "Chat with Kruthika, your AI girlfriend. Experience authentic conversations with natural language understanding, emotional intelligence, and personalized responses in English, Hindi, and 8 other Indian languages.",
    "featureList": [
      "Real-time AI chat",
      "Image sharing",
      "Voice messages",
      "Multi-language support (English, Hindi, Tamil, Telugu, Kannada, and more)",
      "Emotional intelligence",
      "Personality adaptation",
      "24/7 availability",
      "No sign-up required"
    ],
    "author": {
      // Same stable @id as the sitewide Organization node — links this app node
      // into the site's entity graph instead of creating a second Organization.
      "@type": "Organization",
      "@id": `${BASE_URL}#organization`,
      "name": "Kruthika.fun"
    },
    // datePublished = first production release; dateModified is bumped when the
    // chat experience materially changes. Keep it truthful — stale or future
    // dates are an E-E-A-T freshness signal failure (Google uses dateModified
    // for freshness scoring of SoftwareApplication rich entries).
    "datePublished": "2024-09-01",
    "dateModified": "2026-08-21",
    "screenshot": `${BASE_URL}/og-image.jpg`,
    "url": `${BASE_URL}/maya-chat`
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
