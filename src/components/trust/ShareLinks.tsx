// Server component — plain crawlable share links (no third-party JS).
// Added for the SEO audit "Social Share Buttons" finding.

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

interface ShareLinksProps {
  /** Path of the page being shared, e.g. "/blog". Defaults to the homepage. */
  path?: string;
  /** Text pre-filled in the share composer. */
  text?: string;
  className?: string;
}

export default function ShareLinks({
  path = '/',
  text = 'Chat with Kruthika, a free AI companion',
  className = '',
}: ShareLinksProps) {
  const url = encodeURIComponent(`${BASE_URL}${path === '/' ? '' : path}`);
  const msg = encodeURIComponent(text);
  const links = [
    { name: 'X', href: `https://twitter.com/intent/tweet?url=${url}&text=${msg}` },
    { name: 'WhatsApp', href: `https://api.whatsapp.com/send?text=${msg}%20${url}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { name: 'Telegram', href: `https://t.me/share/url?url=${url}&text=${msg}` },
  ];
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className="font-medium text-foreground">Share this page:</span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={`Share on ${l.name}`}
          className="inline-flex items-center min-h-[32px] rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        >
          {l.name}
        </a>
      ))}
    </div>
  );
}
