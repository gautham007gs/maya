// Server component — compact trust/E-E-A-T block for the app-like pages
// (home, /maya-chat, /status) that deliberately hide the global SiteFooter.
// It puts the contact, terms, editorial-policy and social-profile links in the
// server-rendered HTML so crawlers (and users) can still find them.
//
// A physical address is shown only when NEXT_PUBLIC_BUSINESS_ADDRESS is set —
// never invent one. Set it in your environment to clear the audit's
// "Physical Address" warning.

import ShareLinks from './ShareLinks';
import AiDisclaimer from './AiDisclaimer';
import { SITE_CONTENT_UPDATED, SITE_CONTENT_UPDATED_LABEL } from '@/lib/site-content-meta';

const ADDRESS = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS;

interface TrustLinksProps {
  /** Path used for the share links. */
  path?: string;
  className?: string;
  showShare?: boolean;
}

const linkCls = 'underline underline-offset-2 hover:text-foreground';

export default function TrustLinks({ path = '/', className = '', showShare = true }: TrustLinksProps) {
  return (
    <section
      aria-label="About this site and contact information"
      className={`max-w-3xl mx-auto px-4 py-6 space-y-4 text-xs leading-relaxed text-muted-foreground ${className}`}
    >
      <nav aria-label="Company and legal links" className="flex flex-wrap gap-x-4 gap-y-2">
        <a href="/about" className={linkCls}>About Kruthika.fun</a>
        <a href="/contact" className={linkCls}>Contact us</a>
        <a href="/legal/terms" className={linkCls}>Terms of Service</a>
        <a href="/legal/privacy" className={linkCls}>Privacy Policy</a>
        <a href="/legal/editorial-policy" className={linkCls}>Editorial Policy</a>
        <a href="/legal/cookie-policy" className={linkCls}>Cookie Policy</a>
      </nav>
      <nav aria-label="Kruthika on social media" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-medium text-foreground">Follow Kruthika:</span>
        <a href="https://x.com/kruthikafun" target="_blank" rel="noopener noreferrer me" className={linkCls}>X (Twitter)</a>
        <a href="https://www.instagram.com/kruthikafun" target="_blank" rel="noopener noreferrer me" className={linkCls}>Instagram</a>
        <a href="https://www.facebook.com/kruthikafun" target="_blank" rel="noopener noreferrer me" className={linkCls}>Facebook</a>
      </nav>
      {showShare && <ShareLinks path={path} />}
      <p>
        Contact:{' '}
        <a href="mailto:support@kruthika.fun" className={linkCls}>support@kruthika.fun</a>
        {ADDRESS ? <> · <address className="inline not-italic">{ADDRESS}</address></> : null}
        {' · '}Last updated: <time dateTime={SITE_CONTENT_UPDATED}>{SITE_CONTENT_UPDATED_LABEL}</time>
      </p>
      <AiDisclaimer />
    </section>
  );
}
