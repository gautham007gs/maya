/**
 * FAQ layout — intentionally has no metadata export.
 *
 * Previously both faq/layout.tsx and faq/page.tsx defined metadata for /faq,
 * causing Next.js metadata merging to produce a duplicated/truncated title.
 * All metadata (title, description, canonical, OG, Twitter) now lives
 * exclusively in faq/page.tsx which is the correct place for a leaf page.
 */
import type { ReactNode } from 'react';

export default function FAQLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
