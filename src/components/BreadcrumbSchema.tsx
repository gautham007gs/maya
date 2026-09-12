// Server component — no 'use client'. Renders JSON-LD in initial HTML for Googlebot.
// Previously marked 'use client', which shipped unnecessary hydration JS to every
// page that uses breadcrumbs. BreadcrumbSchema has no hooks, state, or event handlers;
// removing 'use client' makes it a zero-JS server component. JSON-LD still appears
// in the initial HTML response — no SEO impact, only a bundle-size win.

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

export default function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
    />
  );
}
