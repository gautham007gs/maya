"use client";

import { useEffect } from "react";

/**
 * DirectLinkGuard
 *
 * Problem: Adsterra's "Direct Link" (onclick/popunder) script intercepts click
 * events and pushes an ad URL entry into the browser history stack before
 * navigating to the real destination. When the user then presses the browser
 * back button (or our in-app back buttons), they land on the ad page instead
 * of the previous app page.
 *
 * Fix: listen for the `popstate` event (fired on back/forward navigation).
 * If the URL we would land on is external (different hostname), immediately
 * navigate forward past it — effectively skipping the ad entry. We wait one
 * tick before checking so the browser has committed the URL change.
 *
 * Edge-cases handled:
 * - Same-origin anchor fragments (#section) are allowed through normally.
 * - The guard is removed on unmount (though layout never unmounts in practice).
 */
export default function DirectLinkGuard() {
  useEffect(() => {
    const handlePopState = () => {
      // Give the browser one tick to commit the URL change before we inspect it
      setTimeout(() => {
        try {
          const current = window.location.href;
          // If the URL is on our own origin, let it through
          if (current.startsWith(window.location.origin)) return;
          // External URL appeared in our history — skip forward past it
          window.history.forward();
        } catch {}
      }, 0);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return null;
}
