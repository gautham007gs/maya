import { Metadata } from 'next';
import { getAllAuthorsAsync } from '@/lib/authors-db';
import { MapPin, Pen, ExternalLink } from 'lucide-react';
import { serializeJsonLd } from '@/lib/blog-jsonld';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('Meet Our Blog Authors — AI & Psychology Experts'),
  description: fitMetaDescription('Meet the expert writers and researchers behind the Kruthika AI Girlfriend blog — covering AI companionship, psychology, technology, and virtual relationships.'),
  alternates: {
    canonical: `${BASE_URL}/blog/author`,
    // English-only page → x-default self (global default), matching the
    // rest of the blog cluster. See blog/page.tsx for the rationale.
    languages: { 'x-default': `${BASE_URL}/blog/author` },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    title: 'Meet Our Blog Authors — AI & Psychology Experts',
    description: 'Meet the expert writers and researchers behind the Kruthika.fun blog.',
    url: `${BASE_URL}/blog/author`,
    siteName: 'Kruthika AI Girlfriend',
    locale: 'en_US',
    type: 'website',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend Blog Authors' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog Authors',
    description: 'Expert writers covering AI companionship, psychology, and virtual relationships.',
    images: [`${BASE_URL}/og-image.jpg`],
  },
};

const authorsSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Kruthika.fun Blog Authors',
  description: 'Expert writers and researchers contributing to the Kruthika AI Girlfriend blog.',
  url: `${BASE_URL}/blog/author`,
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',  item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog',  item: `${BASE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: 'Authors', item: `${BASE_URL}/blog/author` },
    ],
  },
};

export default async function AuthorsIndexPage() {
  const authors = await getAllAuthorsAsync();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(authorsSchema) }} />

      <main id="main-content" className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Breadcrumb */}
          <nav className="text-xs text-muted-foreground flex items-center gap-1.5 mb-8 flex-wrap">
            <a href="/" className="hover:text-primary transition-colors">Home</a>
            <span>/</span>
            <a href="/blog" className="hover:text-primary transition-colors">Blog</a>
            <span>/</span>
            <span className="text-foreground font-medium">Authors</span>
          </nav>

          {/* Header */}
          <header className="mb-10 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
              Meet Our Authors — AI &amp; Psychology Experts
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Expert writers and researchers covering AI companionship, psychology, virtual relationships,
              and the technology behind modern AI girlfriends.
            </p>
          </header>

          {/* Authors grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {authors.map((author) => (
              <a
                key={author.slug}
                href={`/blog/author/${author.slug}`}
                className="group block bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-purple-300 transition-all"
              >
                {/* Avatar + gradient banner */}
                <div className="bg-gradient-to-br from-purple-600/10 via-pink-600/10 to-blue-600/10 px-6 pt-6 pb-4 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-gradient-to-br from-purple-500 to-pink-500 mb-3 flex items-center justify-center">
                    {author.avatar?.trim() ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={author.avatar}
                        alt={author.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      /* An empty src makes the browser re-request the current
                         document as an image — show initials instead. */
                      <span className="text-white text-sm font-bold" aria-hidden="true">
                        {author.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-foreground group-hover:text-purple-600 transition-colors">
                    {author.name}
                  </h2>
                  <p className="text-xs text-purple-700 font-semibold mt-0.5">{author.title}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    {author.location}
                  </div>
                </div>

                {/* Bio */}
                <div className="px-5 py-4 border-t border-border">
                  <p className="text-sm text-foreground/75 leading-relaxed line-clamp-3">{author.bio}</p>
                </div>

                {/* Expertise tags */}
                {author.expertise.length > 0 && (
                  <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                    {author.expertise.slice(0, 3).map((e) => (
                      <span key={e} className="text-xs font-medium px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                        {e}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer row */}
                <div className="px-5 pb-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
                  <span className="flex items-center gap-1"><Pen className="h-3 w-3" /> View articles</span>
                  {author.twitter && (
                    <span className="flex items-center gap-1 text-blue-500">
                      <ExternalLink className="h-3 w-3" /> @{author.twitter}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 text-center bg-gradient-to-r from-purple-600/10 to-pink-600/10 border border-purple-200/50 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-foreground mb-2">Explore the Kruthika Blog</h2>
            <p className="text-muted-foreground text-sm mb-5">
              Expert insights on AI companionship, virtual relationships, and emotional wellbeing.
            </p>
            <a href="/blog"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-7 py-3 rounded-full font-semibold hover:shadow-lg hover:scale-105 transition-all text-sm">
              Browse All Articles →
            </a>
          </div>

        </div>
      </main>
    </>
  );
}
