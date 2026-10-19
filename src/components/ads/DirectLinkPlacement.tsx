"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useAdSettings } from "@/contexts/AdSettingsContext";
import { analyticsTracker } from "@/lib/analytics-tracker";
import { isAdvertisingAllowed } from "@/lib/consent";

type DirectLinkPlacementKey = "homepage" | "status" | "blog";

interface DirectLinkPlacementProps {
  placement: DirectLinkPlacementKey;
}

const PLACEMENT_COPY: Record<DirectLinkPlacementKey, { title: string; detail: string }> = {
  homepage: {
    title: "Explore a sponsored offer",
    detail: "A clearly labeled offer from an external advertiser.",
  },
  status: {
    title: "Discover a sponsored offer",
    detail: "This optional link opens an external advertiser page.",
  },
  blog: {
    title: "Explore a sponsored offer",
    detail: "A clearly labeled external offer, separate from the article.",
  },
};

const DirectLinkPlacement: React.FC<DirectLinkPlacementProps> = ({ placement }) => {
  const { adSettings, isLoadingAdSettings } = useAdSettings();
  const [consentAllowed, setConsentAllowed] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [clicked, setClicked] = useState(false);
  const hasTrackedView = useRef(false);

  const directLinkUrl = useMemo(() => {
    const rawUrl = adSettings?.adsterraDirectLink?.trim();
    if (!rawUrl) return null;

    try {
      const parsed = new URL(rawUrl);
      return parsed.protocol === "https:" ? parsed.href : null;
    } catch {
      return null;
    }
  }, [adSettings?.adsterraDirectLink]);

  useEffect(() => {
    const updateConsent = () => setConsentAllowed(isAdvertisingAllowed());
    updateConsent();
    window.addEventListener("consentchange", updateConsent);
    return () => window.removeEventListener("consentchange", updateConsent);
  }, []);

  useEffect(() => {
    setEligible(false);
    hasTrackedView.current = false;

    if (
      isLoadingAdSettings ||
      !adSettings ||
      !consentAllowed ||
      !adSettings.adsEnabledGlobally ||
      adSettings.adsKillSwitch ||
      !adSettings.adsterraDirectLinkEnabled ||
      !directLinkUrl
    ) {
      return;
    }

    const controller = new AbortController();
    const maxDaily = adSettings.maxDirectLinkAdsPerDay || 3;
    const maxSession = adSettings.maxDirectLinkAdsPerSession || 2;

    fetch("/api/ads/direct-link", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check", maxDaily, maxSession }),
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) return null;
        return response.json();
      })
      .then(result => {
        if (!controller.signal.aborted) setEligible(Boolean(result?.allowed));
      })
      .catch(() => {
        if (!controller.signal.aborted) setEligible(false);
      });

    return () => controller.abort();
  }, [adSettings, consentAllowed, directLinkUrl, isLoadingAdSettings]);

  useEffect(() => {
    if (!eligible || hasTrackedView.current) return;
    hasTrackedView.current = true;
    analyticsTracker.trackAdInteractionPublic(`direct-link-${placement}`, "view", "adsterra").catch(() => {});
  }, [eligible, placement]);

  if (!eligible || !directLinkUrl || clicked) return null;

  const copy = PLACEMENT_COPY[placement];
  const maxDaily = adSettings?.maxDirectLinkAdsPerDay || 3;
  const maxSession = adSettings?.maxDirectLinkAdsPerSession || 2;

  const recordClick = () => {
    if (clicked) return;
    setClicked(true);
    analyticsTracker.trackAdInteractionPublic(`direct-link-${placement}`, "click", "adsterra").catch(() => {});

    // The actual link is a normal user-initiated anchor so browsers and
    // in-app browsers can open it without a delayed popup. Record the cap in
    // parallel; a failed cap request never blocks the reader's chosen link.
    fetch("/api/ads/direct-link", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "record", maxDaily, maxSession }),
      keepalive: true,
    }).catch(() => {});
  };

  return (
    <aside
      className="mx-auto my-5 w-full max-w-3xl rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm"
      aria-label="Sponsored link"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Sponsored · Advertisement
          </p>
          <p className="text-sm font-semibold text-slate-900">{copy.title}</p>
          <p className="mt-0.5 text-xs text-slate-600">{copy.detail}</p>
        </div>
        <a
          href={directLinkUrl}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          onClick={recordClick}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          View offer
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
};

export default DirectLinkPlacement;
