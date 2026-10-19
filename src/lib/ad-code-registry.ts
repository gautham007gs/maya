/**
 * Page-scoped registry of which literal Adsterra ad codes are currently
 * rendering somewhere on the page right now.
 *
 * Why this exists: this app has TWO independent ad-selection systems —
 * `BannerAdDisplay`'s priority `pick()` chains, and maya-chat's in-chat
 * native-ad-bubble system (`pickNativeAdPair` / `injectBannerAdMessage`).
 * Both draw from the same small pool of configured Adsterra codes (Native
 * Banner, 300×250, 320×50, 728×90…). Re-ordering each slot's own priority
 * list only avoids collisions when every network/size involved happens to
 * differ; it does nothing to stop two DIFFERENT slots — say the chat-input
 * banner and an in-chat native ad bubble scrolled into view at the same
 * time — from both landing on the identical code, which reads as a
 * duplicated ad and undermines viewability-based billing (the network sees
 * two placements pointed at the same unit, not two genuine impressions
 * opportunities).
 *
 * This module is the single shared source of truth both systems check
 * against. It is intentionally plain module state (not React state/context)
 * so it stays valid across component trees that don't share an ancestor.
 * It resets naturally on every full navigation, since this app navigates
 * with classic <a href> reloads rather than client-side routing — a fresh
 * page load means a fresh JS module scope, so there is no cross-page
 * leakage to worry about.
 */

const claimedCodes = new Map<string, number>();

/** Register that `code` is now actively rendering somewhere on the page. */
export function claimAdCode(code: string | null | undefined): void {
  if (!code) return;
  claimedCodes.set(code, (claimedCodes.get(code) ?? 0) + 1);
}

/** Release a previously-claimed code (call on unmount / migration / change). */
export function releaseAdCode(code: string | null | undefined): void {
  if (!code) return;
  const next = (claimedCodes.get(code) ?? 0) - 1;
  if (next <= 0) claimedCodes.delete(code);
  else claimedCodes.set(code, next);
}

export function isAdCodeClaimed(code: string | null | undefined): boolean {
  if (!code) return false;
  return claimedCodes.has(code);
}

/**
 * Given an ordered list of candidate codes (best format/network first),
 * returns the first one nobody else on the page is currently showing. Falls
 * back to the single best candidate if every option is already claimed —
 * showing a repeated creative beats showing nothing, and this only happens
 * when configured inventory genuinely runs out.
 */
export function pickUnclaimed(candidates: Array<string | null | undefined>): string {
  const valid = candidates.filter(
    (c): c is string => !!c && !!c.trim() && !c.includes('Placeholder'),
  );
  if (valid.length === 0) return '';
  const free = valid.find(c => !claimedCodes.has(c));
  return free ?? valid[0];
}
