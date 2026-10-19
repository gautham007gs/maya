import Link from 'next/link';
import { COUNTRY_CONFIGS, INDEXABLE_COUNTRIES } from '@/lib/locales';

/**
 * Geo cross-links — SINGLE SOURCE OF TRUTH.
 *
 * Every geo landing page used to hardcode its own copy of the
 * "Available Worldwide" country list, so lists silently drifted (some pages
 * omitted newer countries, some even omitted themselves). This component
 * derives the list from COUNTRY_CONFIGS instead: adding a country to
 * locales.ts automatically adds it to every page's cross-links.
 */
export default function GeoCrossLinks({ currentPath }: { currentPath: string }) {
  const others = INDEXABLE_COUNTRIES
    .map(code => COUNTRY_CONFIGS[code])
    .filter(config => config.path !== currentPath);

  return (
    <div className="mb-10 bg-muted/40 border border-border rounded-xl p-6">
      <p className="text-sm font-semibold text-muted-foreground mb-3 text-center">Kruthika — Available Worldwide</p>
      <div className="flex flex-wrap justify-center gap-3">
        {others.map(({ flag, name, path }) => (
          <Link key={path} href={path}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full border border-border bg-background hover:border-primary hover:text-primary transition-colors">
            {flag} AI Girlfriend {name}
          </Link>
        ))}
        <Link href="/maya-chat"
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full bg-yellow-500 text-yellow-950 hover:bg-yellow-600 hover:text-yellow-50 transition-colors">
          💬 Chat Now — Free
        </Link>
      </div>
    </div>
  );
}
