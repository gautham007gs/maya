// Server component — visible disclaimer for emotional-support / companion
// content (SEO audit E-E-A-T: "YMYL content detected without visible disclaimers").

export default function AiDisclaimer({ className = '' }: { className?: string }) {
  return (
    <aside
      aria-label="Important notice"
      className={`rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground ${className}`}
    >
      <strong className="text-foreground">Please note:</strong> Kruthika is an AI companion, not a
      real person, and is not a licensed therapist, doctor, or counsellor. Nothing here is medical,
      psychological, or legal advice. If you are in distress or in crisis, please contact a qualified
      professional or your local emergency services. Read our{' '}
      <a href="/legal/editorial-policy" className="underline hover:text-foreground">editorial policy</a>
      {' '}and{' '}
      <a href="/legal/terms" className="underline hover:text-foreground">terms of service</a>.
    </aside>
  );
}
