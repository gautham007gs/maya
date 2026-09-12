"use client";



import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  X as XIcon,
  ArrowLeft,
  Search,
  EllipsisVertical,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  defaultAIProfile,
  defaultAdminStatusDisplay,
  defaultManagedContactStatuses,
} from "@/config/ai";
import BannerAdDisplay from "@/components/chat/BannerAdDisplay";
import SocialBarAdDisplay from "@/components/chat/SocialBarAdDisplay";
import DesktopRailAd from "@/components/ads/DesktopRailAd";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import { useAIProfile } from "@/contexts/AIProfileContext";
import { useGlobalStatus } from "@/contexts/GlobalStatusContext";
import { useAdSettings } from "@/contexts/AdSettingsContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScreenshotProtection } from "@/components/ScreenshotProtection";
import { CirclePlus } from "lucide-react";
import { StatusSkeleton } from "@/components/LoadingSkeleton";

const STATUS_VIEW_AD_DELAY_MS = 3000;

// ─── StatusItemDisplay is defined OUTSIDE StatusPage so its identity is stable
// across renders. Defining components inside another component causes React to
// recreate the component type on every parent render, which forces a full
// unmount + remount of every status row on any state change — a serious
// performance bug and a source of lost local state (open dialogs, timers, etc.)
interface StatusItemDisplayProps {
  statusKey: string;
  displayName: string;
  rawAvatarUrl: string;
  statusText: string;
  hasUpdateRing: boolean;
  storyImageUrl?: string;
  dataImageDescription?: string;
  isMyStatusStyle?: boolean;
  isKruthikaProfile?: boolean;
  onToast: (args: { title: string; description: string; variant?: "destructive" | "default"; duration?: number }) => void;
}

const StatusItemDisplay: React.FC<StatusItemDisplayProps> = React.memo(({
    statusKey,
    displayName,
    rawAvatarUrl,
    statusText,
    hasUpdateRing,
    storyImageUrl,
    dataImageDescription,
    isMyStatusStyle,
    isKruthikaProfile,
    onToast,
  }) => {
    const [showStoryImageViewer, setShowStoryImageViewer] = useState(false);
    const storyViewTimerRef = useRef<NodeJS.Timeout | null>(null);
    const storyViewedLongEnoughRef = useRef(false);

    let avatarUrlToUse = rawAvatarUrl;
    if (
      !avatarUrlToUse ||
      typeof avatarUrlToUse !== "string" ||
      avatarUrlToUse.trim() === "" ||
      (!avatarUrlToUse.startsWith("http") &&
        !avatarUrlToUse.startsWith("data:"))
    ) {
      avatarUrlToUse = defaultAIProfile.avatarUrl;
    }

    let isValidStoryImageSrc = false;
    if (
      storyImageUrl &&
      typeof storyImageUrl === "string" &&
      storyImageUrl.trim() !== ""
    ) {
      try {
        if (storyImageUrl.startsWith("data:image")) {
          isValidStoryImageSrc = true;
        } else {
          new URL(storyImageUrl);
          isValidStoryImageSrc = true;
        }
      } catch (e) {
        isValidStoryImageSrc = false;
      }
    }

    const handleItemClick = React.useCallback(() => {
      if (isValidStoryImageSrc && storyImageUrl) {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            setShowStoryImageViewer(true);
            storyViewedLongEnoughRef.current = false;
            if (storyViewTimerRef.current) clearTimeout(storyViewTimerRef.current);
            storyViewTimerRef.current = setTimeout(() => {
              storyViewedLongEnoughRef.current = true;
            }, STATUS_VIEW_AD_DELAY_MS);
          }, { timeout: 100 });
        } else {
          requestAnimationFrame(() => {
            setShowStoryImageViewer(true);
            storyViewedLongEnoughRef.current = false;
            if (storyViewTimerRef.current) clearTimeout(storyViewTimerRef.current);
            storyViewTimerRef.current = setTimeout(() => {
              storyViewedLongEnoughRef.current = true;
            }, STATUS_VIEW_AD_DELAY_MS);
          });
        }
      }
    }, [isValidStoryImageSrc, storyImageUrl]);

    const handleCloseStoryViewer = () => {
      setShowStoryImageViewer(false);
      if (storyViewTimerRef.current) clearTimeout(storyViewTimerRef.current);
      storyViewedLongEnoughRef.current = false;
    };

    const handleAvatarError = (
      e: React.SyntheticEvent<HTMLImageElement, Event>,
      context: string,
    ) => {
      if (process.env.NODE_ENV === "development") {
        console.error(
          `StatusItemDisplay - ${context} AvatarImage load error for ${displayName}. URL: ${avatarUrlToUse}`,
          e,
        );
      }
    };

    const handleStoryImageError = (
      e: React.SyntheticEvent<HTMLImageElement, Event>,
    ) => {
      if (process.env.NODE_ENV === "development") {
        console.error(
          `StatusItemDisplay - Story Image load error for ${displayName}. URL: ${storyImageUrl}`,
          e,
        );
      }
      onToast({
        title: "Image Load Failed",
        description: `Could not load story image for ${displayName}. The image might be unavailable or the URL incorrect.`,
        variant: "destructive",
        duration: 4000,
      });
    };

    return (
      <React.Fragment
        key={`${statusKey}-${avatarUrlToUse || "no_avatar_frag"}`}
      >
        <div
          className="flex items-center px-5 py-4 hover:bg-secondary/60 cursor-pointer border-b border-border/50 transition-all duration-200 group active:bg-secondary/80"
          onClick={handleItemClick}
        >
          <div className="relative">
            <Avatar
              className={cn(
                "h-14 w-14 shadow-sm",
                hasUpdateRing
                  ? "ring-[3px] ring-[#25d366] ring-offset-2 ring-offset-background p-0.5"
                  : isMyStatusStyle && !hasUpdateRing
                    ? "ring-2 ring-muted/50 p-0.5"
                    : "",
              )}
              style={{ contain: 'layout style paint' }}
              key={`status-avatar-comp-${statusKey}-${avatarUrlToUse || "default_avatar_comp_key_sp"}`}
            >
              <AvatarImage
                src={avatarUrlToUse || undefined}
                alt={displayName}
                data-img-desc={dataImageDescription || "profile person"}
                className="object-cover"
                loading={isKruthikaProfile || isMyStatusStyle ? "eager" : "lazy"}
                fetchPriority={isKruthikaProfile || isMyStatusStyle ? "high" : "auto"}
                key={`${statusKey}-avatar-img-${avatarUrlToUse || "no_avatar_fallback_img_sp"}`}
                onError={(e) => handleAvatarError(e, "List")}
              />
              <AvatarFallback>
                {(displayName || "S").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isMyStatusStyle && !hasUpdateRing && !storyImageUrl && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-gradient-to-br from-[#25d366] to-green-600 text-white rounded-full p-1 border-[3px] border-background shadow-md">
                <CirclePlus size={18} />
              </div>
            )}
          </div>
          <div className="ml-4 flex-grow overflow-hidden">
            <h2 className="font-semibold text-base truncate text-foreground group-hover:text-primary transition-colors" style={{ contain: 'layout' }}>
              {displayName}
            </h2>
            <p className="text-sm text-muted-foreground truncate mt-0.5" style={{ contain: 'layout' }}>
              {statusText}
            </p>
          </div>
        </div>

        {isValidStoryImageSrc && storyImageUrl && (
          <Dialog
            open={showStoryImageViewer}
            onOpenChange={(open) => {
              if (!open) {
                handleCloseStoryViewer();
              } else {
                setShowStoryImageViewer(true);
                if (storyViewTimerRef.current)
                  clearTimeout(storyViewTimerRef.current);
                storyViewedLongEnoughRef.current = false;
                storyViewTimerRef.current = setTimeout(() => {
                  storyViewedLongEnoughRef.current = true;
                }, STATUS_VIEW_AD_DELAY_MS);
              }
            }}
          >
            <DialogContent className="!fixed !inset-0 !z-[60] flex !w-screen !h-screen flex-col !bg-black !p-0 !border-0 !shadow-2xl !outline-none !rounded-none !max-w-none !translate-x-0 !translate-y-0">
              <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center justify-between bg-gradient-to-b from-black/70 via-black/30 to-transparent">
                <div className="flex items-center gap-3">
                  <Avatar
                    className="h-9 w-9 border-2 border-white/50"
                    key={`status-dialog-avatar-comp-${statusKey}-${avatarUrlToUse || "default_avatar_dialog_comp_key_sp"}`}
                  >
                    <AvatarImage
                      src={avatarUrlToUse || undefined}
                      alt={displayName}
                      key={`${statusKey}-dialog-avatar-img-${avatarUrlToUse || "no_avatar_fallback_dialog_img_sp"}`}
                      onError={(e) => handleAvatarError(e, "Dialog")}
                    />
                    <AvatarFallback>
                      {(displayName || "S").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <DialogTitle className="text-white text-sm font-semibold">
                    {displayName}
                  </DialogTitle>
                  <DialogDescription>Viewing {displayName}&apos;s story update</DialogDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseStoryViewer}
                  className="text-white hover:bg-white/10"
                >
                  <XIcon size={24} />
                </Button>
              </div>

              <div className="relative flex-grow w-full flex items-center justify-center overflow-hidden">
                <Image
                  src={storyImageUrl}
                  alt={`${displayName}'s story`}
                  fill={true}
                  style={{ objectFit: "contain" }}
                  data-ai-hint="story image content large"
                  quality={100}
                  unoptimized={true}
                  sizes="100vw"
                  key={`${statusKey}-story-image-${storyImageUrl}`}
                  onError={handleStoryImageError}
                />
              </div>

              {statusText &&
                !statusText.toLowerCase().includes("tap to add") &&
                !statusText.toLowerCase().includes("no story update") && (
                  <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-8 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                    <p className="text-white text-center text-sm drop-shadow-md">
                      {statusText}
                    </p>
                  </div>
                )}
            </DialogContent>
          </Dialog>
        )}
      </React.Fragment>
    );
});

StatusItemDisplay.displayName = "StatusItemDisplay";

// ─── StatusPage ──────────────────────────────────────────────────────────────
const StatusPage: React.FC = () => {
  const { aiProfile: globalAIProfile, isLoadingAIProfile } = useAIProfile();
  const {
    adminOwnStatus: globalAdminOwnStatus,
    managedDemoContacts: globalManagedDemoContacts,
    isLoadingGlobalStatuses,
  } = useGlobalStatus();
  const { adSettings: _adSettings, isLoadingAdSettings } = useAdSettings();
  const { toast } = useToast();

  const effectiveAIProfile = globalAIProfile || defaultAIProfile;
  const displayAdminOwnStatus =
    globalAdminOwnStatus || defaultAdminStatusDisplay;
  const displayManagedDemoContacts =
    globalManagedDemoContacts || defaultManagedContactStatuses;

  // Preload critical avatar images for LCP optimization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const preloadImages = [
      displayAdminOwnStatus.avatarUrl,
      effectiveAIProfile.avatarUrl
    ].filter(url => url && typeof url === 'string' && url.trim() !== '');

    preloadImages.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.fetchPriority = 'high';
      document.head.appendChild(link);
    });
  }, [displayAdminOwnStatus.avatarUrl, effectiveAIProfile.avatarUrl]);

  if (isLoadingAIProfile || isLoadingGlobalStatuses || isLoadingAdSettings) {
    return <StatusSkeleton />;
  }

  // Filter managed contacts that have visible content
  const visibleContacts = displayManagedDemoContacts.filter(
    (contact) =>
      contact.hasUpdate ||
      contact.statusImageUrl ||
      (contact.statusText && contact.statusText !== "Tap to add status"),
  );

  // Insert native ad after every 3rd contact (index 2, 5, 8…)
  const AD_EVERY_N = 3;
  // Cap total in-feed ad slots on one page load — beyond this, a long contact
  // list would otherwise repeat the same one or two ad codes many times over
  // in a single scroll, which reads as repetitive rather than as more revenue.
  // Cap in-feed ad slots at 2 — a 3rd slot in a short list loads too quickly
  // in sequence and reads as "rapid refresh" to users.
  const MAX_STATUS_AD_SLOTS = 2;

  return (
    <>
      <ScreenshotProtection />
      <BreadcrumbSchema items={[
        { name: 'Home', url: 'https://kruthika.fun/' },
        { name: 'Status Updates', url: 'https://kruthika.fun/status' }
      ]} />
      <div className="flex flex-col h-screen max-w-3xl mx-auto bg-background shadow-2xl">
        {/* WhatsApp-style Header with Back Navigation */}
        <div className="bg-[#25d366] shadow-md flex-shrink-0">
          <div className="px-6 py-4 flex items-center">
            <button
              onClick={() => {
              // Never use history.back() — Adsterra's direct-link script inserts
              // an ad URL into the history stack on navigation, so going "back"
              // would land the user on an ad page instead of the homepage.
              // Always navigate home explicitly.
              window.location.href = '/';
            }}
              className="mr-5 hover:bg-white/20 rounded-full p-2 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              aria-label="Go back"
            >
              <ArrowLeft size={22} className="text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">Status</h1>
            <div className="flex items-center space-x-2 ml-auto">
              <button
                className="hover:bg-white/20 rounded-full p-2 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                aria-label="Search status"
              >
                <Search size={20} className="text-white" />
              </button>
              <button
                className="hover:bg-white/20 rounded-full p-2 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                aria-label="More options"
              >
                <EllipsisVertical size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable contact list — leave room for sticky bottom banner */}
        <div className="flex-grow overflow-y-auto custom-scrollbar pb-16">
          {/* My status (admin-owned) */}
          <StatusItemDisplay
            statusKey="admin-own-status-item"
            displayName={displayAdminOwnStatus.name}
            rawAvatarUrl={displayAdminOwnStatus.avatarUrl}
            statusText={displayAdminOwnStatus.statusText}
            hasUpdateRing={displayAdminOwnStatus.hasUpdate}
            storyImageUrl={displayAdminOwnStatus.statusImageUrl}
            dataImageDescription="profile self admin"
            isMyStatusStyle={true}
            isKruthikaProfile={false}
            onToast={toast}
          />

          <div className="px-6 py-3 text-xs font-bold text-muted-foreground/80 bg-secondary/20 border-y border-border/30 tracking-wider uppercase">
            Recent Updates
          </div>

          {/* Kruthika's status */}
          {(effectiveAIProfile.statusStoryHasUpdate ||
            (effectiveAIProfile.statusStoryText &&
              effectiveAIProfile.statusStoryText !==
                defaultAIProfile.statusStoryText) ||
            effectiveAIProfile.statusStoryImageUrl) && (
            <StatusItemDisplay
              statusKey="kruthika-status-story-item"
              displayName={effectiveAIProfile.name}
              rawAvatarUrl={effectiveAIProfile.avatarUrl}
              statusText={
                effectiveAIProfile.statusStoryText || "No story update."
              }
              hasUpdateRing={effectiveAIProfile.statusStoryHasUpdate || false}
              storyImageUrl={effectiveAIProfile.statusStoryImageUrl}
              dataImageDescription="profile woman"
              isKruthikaProfile={true}
              onToast={toast}
            />
          )}

          {/* Native ad slot — shown between contacts */}
          {visibleContacts.length > 0 && (
            <div className="w-full bg-background border-b border-border/30">
              <BannerAdDisplay placementKey="status-native" className="py-1" refreshIntervalMs={90_000} />
            </div>
          )}

          {/* Managed demo contacts — with a native ad injected every AD_EVERY_N items */}
          {visibleContacts.map((contact, idx) => (
            <React.Fragment key={contact.id}>
              <StatusItemDisplay
                statusKey={contact.id}
                displayName={contact.name}
                rawAvatarUrl={contact.avatarUrl}
                statusText={contact.statusText}
                hasUpdateRing={contact.hasUpdate}
                storyImageUrl={contact.statusImageUrl}
                dataImageDescription={contact.dataImageDescription}
                isKruthikaProfile={false}
                onToast={toast}
              />
              {/* Insert an ad after every AD_EVERY_N contacts, capped at
                  MAX_STATUS_AD_SLOTS and alternating between the Native
                  Banner zone and the 300×250 zone so consecutive slots in
                  the same scroll don't repeat the identical creative. */}
              {(() => {
                if ((idx + 1) % AD_EVERY_N !== 0 || idx >= visibleContacts.length - 1) return null;
                // +1 because the top "status-native" slot already used slot 0
                const slotIndex = Math.floor(idx / AD_EVERY_N) + 1;
                if (slotIndex >= MAX_STATUS_AD_SLOTS) return null;
                const placementKey = slotIndex % 2 === 0
                  ? `status-native-${slotIndex}`
                  : `box-status-${slotIndex}`;
                return (
                  <div className="w-full bg-background border-b border-border/30">
                    <BannerAdDisplay placementKey={placementKey} className="py-1" />
                  </div>
                );
              })()}
            </React.Fragment>
          ))}
        </div>

        {/* Sticky banner at the very bottom — no camera button */}
        <div className="flex-shrink-0 border-t border-border/30 bg-background shadow-[0_-2px_8px_rgba(0,0,0,0.06)] z-10">
          <BannerAdDisplay placementKey="status-footer" className="py-1" refreshIntervalMs={75_000} />
        </div>
      </div>
      <SocialBarAdDisplay page="status" />
      <DesktopRailAd />
    </>
  );
};

export default StatusPage;
