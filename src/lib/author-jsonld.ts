import type { Author } from '@/lib/authors';

export interface AuthorJsonLdOptions {
  baseUrl: string;
  slug: string;
  name: string;
  title?: string | null;
  bio?: string | null;
  avatar?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  expertise?: string[] | null;
  location?: string | null;
  /**
   * Whether /blog/author/<slug> actually resolves. Legacy posts carry a
   * free-text byline with no `blog_authors` row, so the name-derived slug
   * notFound()s — advertising it as the Person's `url` points Google at a 404.
   * Defaults to true (author profile pages always pass their own real slug).
   */
  hasProfilePage?: boolean;
}

/**
 * Build the canonical Person node used by both author profile pages and
 * BlogPosting graphs. Keeping this in one place prevents the two public
 * representations of an author from drifting apart.
 */
export function buildAuthorPersonJsonLd(options: AuthorJsonLdOptions | {
  baseUrl: string;
  slug: string;
  author: Author;
}): Record<string, unknown> {
  const author = 'author' in options ? options.author : null;
  const profile = 'author' in options ? null : options;
  const baseUrl = options.baseUrl;
  const slug = options.slug;
  const name = author?.name ?? profile?.name ?? '';
  const title = author?.title ?? profile?.title;
  const bio = author?.bio ?? profile?.bio;
  const avatar = author?.avatar ?? profile?.avatar;
  const twitter = author?.twitter ?? profile?.twitter;
  const linkedin = author?.linkedin ?? profile?.linkedin;
  const expertise = author?.expertise ?? profile?.expertise;
  const location = author?.location ?? profile?.location;
  const hasProfilePage = profile?.hasProfilePage ?? true;

  const sameAs = [
    twitter && `https://twitter.com/${twitter.replace(/^@/, '')}`,
    linkedin,
  ].filter((value): value is string => Boolean(value));

  const image = avatar
    ? avatar.startsWith('/') ? `${baseUrl}${avatar}` : avatar
    : undefined;

  return {
    '@type': 'Person',
    '@id': `${baseUrl}/blog/author/${slug}#person`,
    name,
    ...(bio && { description: bio }),
    ...(title && { jobTitle: title }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(image && { image }),
    worksFor: {
      '@type': 'Organization',
      name: 'Kruthika.fun',
      url: baseUrl,
    },
    ...(expertise && expertise.length > 0 && { knowsAbout: expertise }),
    ...(location && { homeLocation: { '@type': 'Place', name: location } }),
    ...(hasProfilePage && { url: `${baseUrl}/blog/author/${slug}` }),
  };
}