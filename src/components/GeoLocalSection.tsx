import { GEO_LOCAL_CONTENT } from '@/lib/geo-content';

export function GeoLocalSection({ countryCode }: { countryCode: string }) {
  const content = GEO_LOCAL_CONTENT[countryCode];
  if (!content) return null;

  return (
    <section className="mb-12 max-w-3xl mx-auto rounded-xl border border-border/60 bg-muted/20 p-6">
      <h2 className="text-xl font-bold mb-2">{content.headline}</h2>
      <p className="text-muted-foreground leading-relaxed mb-3">{content.body}</p>
      <p className="text-sm text-muted-foreground italic">{content.culture}</p>
    </section>
  );
}
