'use client';

import React, { useState, useRef, useEffect, memo } from 'react';
import Image from 'next/image';
import { Check, CheckCheck, Reply, Heart, X } from 'lucide-react';
import type { Message, MessageStatus, MessageReaction } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { defaultAIProfile } from '@/config/ai';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { analyticsTracker } from '@/lib/analytics-tracker';
import { claimAdCode, releaseAdCode } from '@/lib/ad-code-registry';
import { stampCspNonce } from '@/lib/csp-nonce';
import { isOptimizableImageSrc } from '@/lib/image-src';

interface MessageBubbleProps {
  message: Message;
  aiAvatarUrl: string;
  aiName: string;
  onQuickReply?: (replyText: string, originalMessage: Message) => void;
  onLikeMessage?: (messageId: string) => void;
  onReactToMessage?: (messageId: string, reaction: MessageReaction) => void;
  isBlockedBySwipe?: boolean;
  onSwipeStart?: (messageId: string) => void;
  onSwipeEnd?: () => void;
  onAvatarClick?: () => void;
}

// ── NativeAdBubble — MUST live at module level, NOT inside MessageBubble ──────
// Defining a component inside another component gives it a new function-reference
// on every parent render. React treats a new reference as a completely different
// component type, which forces an unmount + remount, destroying the ad's DOM node
// (including all imperatively-loaded ad scripts). At module level the reference
// is stable, so React simply re-renders (updates props) without touching the node.
const NativeAdBubble: React.FC<{ adCode: string; fallbackAdCode?: string; adId: string; timestamp: Date }> = memo(({
  adCode,
  fallbackAdCode,
  adId,
  timestamp,
}) => {
  const adRef = useRef<HTMLDivElement>(null);
  // Stable wrapper that survives every remount — the IntersectionObserver
  // below is bound to THIS node once, not to `adRef` (which gets torn down
  // and recreated on every refresh/fallback cycle). Binding to a node that
  // gets replaced would silently detach the observer after the first
  // remount, breaking in-viewport gating for all subsequent refresh ticks.
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Bumped on every 45-second cycle AND on an empty-fill fallback swap.
  // Combined with the `key` below, this forces a FULL DOM remount (brand-new
  // element + id) instead of an in-place innerHTML swap. Adsterra's invoke.js
  // tags key their fill logic to the container element they were first
  // attached to and silently refuse to serve a second creative into the same
  // node — an in-place refresh just leaves it blank. A true remount makes
  // every refresh/fallback look like a brand-new slot to the network, which
  // is what actually yields a fresh impression.
  const [refreshCount, setRefreshCount] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const usedFallbackThisCycleRef = useRef(false);
  const emptyCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCode = (useFallback && fallbackAdCode) ? fallbackAdCode : adCode;
  // Unique per mount — new on every refresh tick and every fallback swap.
  const instanceId = `${adId}-${refreshCount}${useFallback ? '-fb' : ''}`;
  // Tracks what THIS bubble currently holds in the shared page-wide ad-code
  // registry (src/lib/ad-code-registry.ts), so the chat-input banner and any
  // other BannerAdDisplay slot can see it's taken and steer to a different
  // configured size/unit instead of showing the identical creative twice on
  // screen at once.
  const claimedCodeRef = useRef<string>('');

  // Claim/release only when the CODE itself changes (initial mount, or an
  // empty-fill fallback swap) — not on every 45-second refresh tick, since
  // most of those keep showing the same code and re-claiming it would just
  // be redundant churn.
  useEffect(() => {
    if (activeCode !== claimedCodeRef.current) {
      releaseAdCode(claimedCodeRef.current);
      claimAdCode(activeCode);
      claimedCodeRef.current = activeCode;
    }
  }, [activeCode]);

  // Release on true unmount — covers migration (old bubble removed), a
  // cleared conversation, or any other path a message can disappear by,
  // since this ties directly to React's own unmount guarantee rather than
  // requiring every caller to remember to release manually.
  useEffect(() => {
    return () => releaseAdCode(claimedCodeRef.current);
  }, []);

  // Inject fresh markup into the (newly-mounted) node, then watch for zero-fill.
  useEffect(() => {
    const el = adRef.current;
    if (!el) return;
    el.innerHTML = '';
    try {
      const fragment = document.createRange().createContextualFragment(activeCode);
      // createContextualFragment executes <script> elements when the fragment
      // is appended — stamp the page's CSP nonce on them so the Adsterra SDK
      // code (inline `atOptions` + external invoke.js) passes script-src.
      fragment.querySelectorAll('script').forEach((s) => {
        stampCspNonce(s as HTMLScriptElement);
      });
      el.appendChild(fragment);
      analyticsTracker.trackAdInteractionPublic(
        useFallback ? 'native-in-chat-fallback' : 'native-in-chat',
        'view',
        'adsterra',
      ).catch(() => {});
    } catch (_) {
      el.innerHTML = activeCode;
    }

    // ── Empty-fill watchdog ────────────────────────────────────────────────
    // Ad networks often return zero-fill without erroring — the slot just
    // stays visually empty. Check shortly after injection (enough time for a
    // creative's iframe/img to paint) and, if nothing rendered and we haven't
    // already tried the other network this cycle, swap to the fallback code
    // and force a fresh remount. Maximizes fill rate instead of showing a
    // dead "Sponsored" bubble.
    if (emptyCheckTimerRef.current) clearTimeout(emptyCheckTimerRef.current);
    if (fallbackAdCode && !usedFallbackThisCycleRef.current) {
      emptyCheckTimerRef.current = setTimeout(() => {
        const node = adRef.current;
        if (!node) return;
        // Can't rely on the container's own offsetHeight — it carries a
        // `minHeight: 60px` so it always reports a non-zero height even when
        // the network returned nothing. <script> tags also count as child
        // nodes but never render visually. Instead, check whether any
        // non-script CHILD element has its own non-zero rendered box
        // (an iframe/img/ins/div the ad script actually painted).
        const rendered = Array.from(node.children).some((child) => {
          if (child.tagName === 'SCRIPT') return false;
          const rect = child.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (!rendered) {
          usedFallbackThisCycleRef.current = true;
          setUseFallback(true);
          setRefreshCount((n) => n + 1); // force remount with fallback code
        }
      }, 2500);
    }

    return () => {
      if (emptyCheckTimerRef.current) clearTimeout(emptyCheckTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  // 45-second in-viewport refresh — only fires while the bubble is visible
  // and the page/tab is in the foreground, matching the BannerAdDisplay
  // behaviour. Threshold is 50%, matching Adsterra's own rule that an
  // impression only counts once at least half the creative has been seen —
  // refreshing at a lower threshold would trigger cycles that produce
  // non-billable impressions. Each tick bumps refreshCount → new instanceId
  // → full remount. Bound to `wrapperRef` (mounted exactly once, for the
  // component's whole lifetime) rather than `adRef` (torn down and recreated
  // every cycle) so viewability tracking doesn't silently detach after the
  // first remount.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    let isInView = false;
    const io = new IntersectionObserver(
      ([entry]) => { isInView = entry.isIntersecting && entry.intersectionRatio >= 0.5; },
      { threshold: [0, 0.5] }
    );
    io.observe(el);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && isInView) {
        usedFallbackThisCycleRef.current = false; // fresh cycle — try primary network again
        setUseFallback(false);
        setRefreshCount((n) => n + 1);
      }
    }, 45_000);

    return () => { io.disconnect(); clearInterval(timer); };
  }, []);

  return (
    <div ref={wrapperRef} className="native-ad-container w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded-full tracking-wide uppercase">
          Sponsored
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div
        key={instanceId}
        ref={adRef}
        className="native-ad-content w-full rounded-lg"
        style={{ minHeight: '120px', contain: 'layout', maxWidth: '100%', overflow: 'visible' }}
        id={instanceId}
      />
    </div>
  );
});
NativeAdBubble.displayName = 'NativeAdBubble';

const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message, aiAvatarUrl, aiName, onQuickReply, onLikeMessage, onReactToMessage, isBlockedBySwipe, onSwipeStart, onSwipeEnd, onAvatarClick }) => {
  useToast(); // hook kept for side-effects; destructure toast here if needed
  const isUser = message.sender === 'user';
  const isAd = message.isNativeAd;
  const timestamp = new Date(message.timestamp);

  // Swipe gesture state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const swipeThreshold = 80; // Minimum swipe distance to trigger
  const maxSwipeDistance = 120; // Maximum swipe distance

  // Double tap to like state
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const DOUBLE_TAP_DELAY = 300;

  // Reaction picker state
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionPickerPosition, setReactionPickerPosition] = useState({ x: 0, y: 0 });

  // Quick reply options based on message content and sender
  const getQuickReplies = () => {
    if (isUser) return []; // No quick replies for user's own messages

    const msgLower = message.text.toLowerCase();

    // Context-aware quick replies
    if (msgLower.includes('good morning') || msgLower.includes('good night')) {
      return ['❤️', '😘', 'Good night! 🌙'];
    }
    if (msgLower.includes('how are you') || msgLower.includes('kaise ho')) {
      return ['👍', 'Great!', 'Good yaar'];
    }
    if (msgLower.includes('?')) {
      return ['👍', '👎', 'Maybe'];
    }
    if (msgLower.includes('love') || msgLower.includes('miss')) {
      return ['❤️', 'Miss you too', '😘'];
    }

    // Default quick replies
    return ['👍', '😂', 'Ok', 'Really?', '❤️', 'Cool'];
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isUser || isAd) return; // Only allow swiping on AI messages (not user or ad messages)

    // Prevent starting swipe if another message is already being swiped
    if (isBlockedBySwipe) {
      return;
    }

    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isUser) return;

    // Prevent moving if another message is being swiped
    if (isBlockedBySwipe) {
      return;
    }

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchX - touchStartX.current;
    const deltaY = touchY - touchStartY.current;

    // More strict threshold for horizontal swipes (WhatsApp-like)
    if (Math.abs(deltaY) > 30 || Math.abs(deltaX) < 15) return;

    // Swipe right to reply with enhanced feedback
    if (deltaX > 15) {
      // Notify parent that this message is being swiped
      if (!isDragging && onSwipeStart) {
        onSwipeStart(message.id);
      }

      setIsDragging(true);
      // Smooth resistance curve like WhatsApp with better easing
      const progress = Math.min(deltaX / maxSwipeDistance, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 2); // Easing out quad
      const clampedOffset = easedProgress * maxSwipeDistance;
      setSwipeOffset(clampedOffset);

      // Haptic feedback at threshold points
      if (deltaX > swipeThreshold && !showQuickReplies) {
        if (navigator.vibrate) navigator.vibrate(10); // Subtle feedback
      }

      // Prevent scrolling while swiping
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (isUser) return;

    if (swipeOffset > swipeThreshold && !showQuickReplies) {
      setShowQuickReplies(true);
      // Stronger haptic feedback for action completion
      if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
    } else {
      // If swipe didn't trigger, notify parent to clear swiping state
      if (onSwipeEnd) {
        onSwipeEnd();
      }
    }

    // Smooth animation back to position
    setSwipeOffset(0);
    setIsDragging(false);
  };

  const handleQuickReplySelect = (replyText: string) => {
    if (onQuickReply) {
      onQuickReply(replyText, message);
    }
    setShowQuickReplies(false);

    // Notify parent that swiping is done
    if (onSwipeEnd) {
      onSwipeEnd();
    }
  };

  // Double-tap to like handler
  const handleDoubleTap = () => {
    if (!isUser && onLikeMessage) {
      onLikeMessage(message.id);
      setShowHeartAnimation(true);
      // Add haptic feedback
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);

      // Hide heart animation after 2 seconds
      setTimeout(() => setShowHeartAnimation(false), 2000);
    }
  };

  const handleTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      // This is a double tap
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      handleDoubleTap();
    } else {
      // This might be a single tap, wait to see if there's another
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        tapTimeoutRef.current = null;
        // Handle single tap if needed (currently no action)
      }, DOUBLE_TAP_DELAY);
    }
  };

  // Close quick replies when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target as Node)) {
        setShowQuickReplies(false);
      }
    };

    if (showQuickReplies) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showQuickReplies]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const renderTicks = (status: MessageStatus | undefined) => {
    if (!isUser) return null;

    const resolvedStatus = status || 'sent';

    if (resolvedStatus === 'read') {
      const readTime = message.readAt ? new Date(message.readAt as any) : timestamp;
      const now = new Date();
      const timeSinceRead = now.getTime() - readTime.getTime();

      // WhatsApp-style: very recent = slightly brighter blue, older = standard blue
      if (timeSinceRead < 60 * 1000) {
        return <CheckCheck className="h-4 w-4 ml-1" style={{ color: '#53bdeb' }} />;
      }
      return <CheckCheck className="h-4 w-4 ml-1" style={{ color: '#4fc3f7' }} />;
    }
    if (resolvedStatus === 'delivered') {
      return <CheckCheck className="h-4 w-4 text-muted-foreground ml-1" />;
    }
    return <Check className="h-4 w-4 text-muted-foreground ml-1" />;
  };

  const imageToShowUrl = isUser ? message.userImageUrl : message.aiImageUrl;
  const imageHint = isUser ? "user upload" : "chat image";

  let isValidImageSrc = false;
  if (imageToShowUrl && typeof imageToShowUrl === 'string' && imageToShowUrl.trim() !== '') {
    try {
      if (imageToShowUrl.startsWith('data:image')) {
        isValidImageSrc = true;
      } else {
        new URL(imageToShowUrl);
        isValidImageSrc = true;
      }
    } catch (e) {
      isValidImageSrc = false;
    }
  }

  let aiAvatarUrlToUse = aiAvatarUrl;
  if (!aiAvatarUrlToUse || typeof aiAvatarUrlToUse !== 'string' || aiAvatarUrlToUse.trim() === '' || (!aiAvatarUrlToUse.startsWith('http') && !aiAvatarUrlToUse.startsWith('data:') && !aiAvatarUrlToUse.startsWith('/'))) {
    aiAvatarUrlToUse = defaultAIProfile.avatarUrl;
  }

  const handleAIAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error(`MessageBubble - AvatarImage load error for ${aiName}. URL: ${aiAvatarUrlToUse}`, e);
  };

  const handleContentImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error(`MessageBubble - Content Image load error for message ${message.id}. URL: ${imageToShowUrl}`, e);
  };


  const renderNativeAdContent = () => {
    if (!message.isNativeAd || !message.nativeAdCode) return null;
    return (
      <NativeAdBubble
        adCode={message.nativeAdCode}
        fallbackAdCode={message.nativeAdFallbackCode}
        adId={message.nativeAdId || `ad-${message.id}`}
        timestamp={message.timestamp}
      />
    );
  };

  // ── Voice Note Component (WhatsApp-style) ─────────────────────────────────
  const VoiceNoteContent: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const animFrameRef = React.useRef<number | null>(null);
    const duration = message.voiceNoteDuration || 15;

    const getBarHeight = (index: number): number => {
      const seed = message.id.charCodeAt(index % Math.max(message.id.length, 1));
      return (((seed * (index + 3) * 17) % 20) + 3);
    };

    const handlePlay = () => {
      if (message.audioUrl) {
        if (!audioRef.current) {
          audioRef.current = new Audio(message.audioUrl);
          audioRef.current.onended = () => { setIsPlaying(false); setProgress(0); };
        }
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        } else {
          audioRef.current.play().catch(() => {});
          setIsPlaying(true);
          const startTime = Date.now() - (progress * duration * 10);
          const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const p = Math.min(elapsed / duration, 1);
            setProgress(p);
            if (p < 1) { animFrameRef.current = requestAnimationFrame(animate); }
            else { setIsPlaying(false); setProgress(0); }
          };
          animFrameRef.current = requestAnimationFrame(animate);
        }
      } else {
        // Visual-only fake playback
        if (isPlaying) {
          setIsPlaying(false);
          setProgress(0);
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        } else {
          setIsPlaying(true);
          const start = Date.now();
          const animate = () => {
            const p = Math.min((Date.now() - start) / (duration * 1000), 1);
            setProgress(p);
            if (p < 1) { animFrameRef.current = requestAnimationFrame(animate); }
            else { setIsPlaying(false); setProgress(0); }
          };
          animFrameRef.current = requestAnimationFrame(animate);
        }
      }
    };

    React.useEffect(() => {
      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      };
    }, []);

    const elapsed = Math.floor(progress * duration);
    const timeDisplay = isPlaying
      ? `0:${elapsed.toString().padStart(2, '0')}`
      : `0:${duration.toString().padStart(2, '0')}`;

    const BARS = 28;

    return (
      <div className="flex items-center gap-2 py-1 pr-1 min-w-[180px] max-w-full">
        <button
          onClick={handlePlay}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[#25D366] text-white shadow-sm active:scale-95 transition-transform"
          aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 translate-x-[1px]">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="flex items-center gap-[2px] flex-1">
          {Array.from({ length: BARS }, (_, i) => {
            const h = getBarHeight(i);
            const filled = progress > 0 && (i / BARS) <= progress;
            return (
              <div
                key={i}
                style={{ height: `${h}px` }}
                className={cn(
                  'w-[3px] rounded-full transition-colors duration-100',
                  filled
                    ? 'bg-[#25D366]'
                    : isPlaying
                    ? 'bg-gray-300 dark:bg-gray-500'
                    : 'bg-gray-400 dark:bg-gray-500',
                  isPlaying && !filled && 'animate-pulse'
                )}
              />
            );
          })}
        </div>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 flex-shrink-0 font-medium tabular-nums">
          {timeDisplay}
        </span>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-gray-400 flex-shrink-0">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
        </svg>
      </div>
    );
  };

  const renderMessageContent = () => {
    if (message.isNativeAd) {
      return renderNativeAdContent();
    }

    if (message.isVoiceNote) {
      return <VoiceNoteContent />;
    }

    if (message.sender === 'ai' && message.text.includes("[CLICKABLE_AD_LINK text='")) {
      const parts = [];
      let lastIndex = 0;
      const adLinkRegex = /\[CLICKABLE_AD_LINK text='(.*?)'\]/g;
      let match;

      while ((match = adLinkRegex.exec(message.text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(<span key={`text-${lastIndex}`}>{message.text.substring(lastIndex, match.index)}</span>);
        }
        const linkText = match[1];
        parts.push(
          <span
            key={`adlink-${match.index}`}
            className="text-sm text-accent-foreground/90 dark:text-accent-foreground"
          >
            {linkText}
          </span>
        );
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < message.text.length) {
        parts.push(<span key={`text-${lastIndex}-end`}>{message.text.substring(lastIndex)}</span>);
      }
      return <p className="text-sm whitespace-pre-wrap">{parts}</p>;
    }

    // Render view-once image if present (for both AI and user messages)
    if (message.isViewOnce) {
      const viewOnceImageUrl = message.aiImageUrl || message.userImageUrl;
      if (viewOnceImageUrl) {
        // Show caption text below the view-once thumbnail when present
        const caption = message.text && message.text.trim() !== '' ? message.text : null;
        return (
          <div className="flex flex-col gap-1">
            <ViewOnceImage imageUrl={viewOnceImageUrl} messageId={message.id} isUserSent={message.sender === 'user'} />
            {caption && <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap">{caption}</p>}
          </div>
        );
      }
    }

    return message.text && <span className="text-[14.2px] leading-[19px] whitespace-pre-wrap">{message.text}</span>;
  };

  // WhatsApp-style View Once Image Component with Dialog - Similar to DP zoom
  const ViewOnceImage: React.FC<{ imageUrl: string; messageId: string; isUserSent?: boolean }> = ({ imageUrl, messageId, isUserSent: _isUserSent = false }) => {
    const [isViewed, setIsViewed] = useState(false);
    const [showImageDialog, setShowImageDialog] = useState(false);
    const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      const viewedKey = `viewed_${messageId}`;
      const alreadyViewed = localStorage.getItem(viewedKey) === 'true';
      setIsViewed(alreadyViewed);
    }, [messageId]);

    useEffect(() => {
      // Cleanup timer on unmount
      return () => {
        if (autoCloseTimerRef.current) {
          clearTimeout(autoCloseTimerRef.current);
        }
      };
    }, []);

    const handleViewImage = () => {
      if (isViewed) return;

      setShowImageDialog(true);
      if (navigator.vibrate) navigator.vibrate(50);

      // Auto-close after 5 seconds and mark as viewed
      autoCloseTimerRef.current = setTimeout(() => {
        setShowImageDialog(false);
        setIsViewed(true);
        localStorage.setItem(`viewed_${messageId}`, 'true');
      }, 5000);
    };

    const handleCloseDialog = () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      setShowImageDialog(false);
      setIsViewed(true);
      localStorage.setItem(`viewed_${messageId}`, 'true');
    };

    // WhatsApp-style compact bubble
    return (
      <>
        <div
          className={cn(
            "inline-flex items-center gap-1 py-0.5 px-1 cursor-pointer select-none rounded-md max-w-[120px] max-w-full",
            !isViewed && "hover:opacity-90 transition-opacity"
          )}
          onClick={handleViewImage}
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        >
          {!isViewed ? (
            <>
              <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#25D366" strokeWidth="2" strokeDasharray="31.4 31.4" strokeDashoffset="15.7"/>
                  <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#25D366">1</text>
                </svg>
              </div>
              <div className="flex items-center gap-0.5 min-w-0">
                <svg className="w-3 h-3 text-[#25D366] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                <span className="text-[#25D366] text-[10px] font-medium truncate">Photo</span>
              </div>
            </>
          ) : (
            <>
              <div className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="2" />
                  <path fillRule="evenodd" d="M10 4C5.5 4 1.73 6.943.458 10 1.732 13.057 5.522 16 10 16s8.268-2.943 9.542-6C18.268 6.943 14.478 4 10 4zm0 10a4 4 0 110-8 4 4 0 010 8z" clipRule="evenodd" />
                  <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-[10px] truncate">Opened</span>
            </>
          )}
        </div>

        {/* Full-screen Dialog like DP zoom */}
        <Dialog open={showImageDialog} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogContent className="fixed left-[50%] top-[50%] z-[100] w-[95vw] max-w-2xl h-auto translate-x-[-50%] translate-y-[-50%] bg-black border-0 shadow-2xl rounded-2xl p-0 overflow-hidden [&>button]:hidden">
            {/* Header with view-once indicator */}
            <div className="relative">
              <div className="absolute inset-0 bg-black"></div>
              <div className="relative flex items-center justify-between p-4 text-white border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCloseDialog}
                    className="text-white hover:bg-white/10 h-10 w-10 rounded-full p-0"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#25D366" strokeWidth="2" strokeDasharray="31.4 31.4" strokeDashoffset="15.7"/>
                      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="white">1</text>
                    </svg>
                    <DialogTitle className="text-white text-lg font-medium">
                      View Once Photo
                    </DialogTitle>
                  </div>
                </div>
              </div>
            </div>

            {/* Image Section with screenshot protection */}
            <div className="flex flex-col items-center py-8 px-6 bg-black min-h-[400px] max-h-[70vh] justify-center">
              <div className="relative w-full h-full flex items-center justify-center">
                <Image
                  src={imageUrl}
                  alt="View once photo"
                  width={600}
                  height={600}
                  className="max-w-full max-h-[60vh] w-auto h-auto object-contain rounded-lg select-none"
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  draggable={false}
                  priority={true}
                  unoptimized
                />
              </div>
              <p className="text-white/70 text-sm mt-4 text-center">
                This photo will disappear after closing
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  };


  // Reaction picker component
  const ReactionPicker: React.FC<{ messageId: string }> = ({ messageId }) => {
    const reactions: MessageReaction[] = ['heart', 'thumbs_up', 'laugh', 'wow', 'sad', 'angry'];

    const handleReactionClick = (reaction: MessageReaction) => {
      if (onReactToMessage) {
        onReactToMessage(messageId, reaction);
      }
      setShowReactionPicker(false);
    };

    return (
      <div
        className="absolute z-50 flex items-center gap-2 p-2 bg-background/95 border border-border rounded-full shadow-lg backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in-0 duration-200"
        style={{ top: reactionPickerPosition.y, left: reactionPickerPosition.x }}
      >
        {reactions.map((reaction) => (
          <button
            key={reaction}
            className="text-2xl p-1 hover:scale-110 transition-transform duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded-full"
            onClick={() => handleReactionClick(reaction)}
            aria-label={`React with ${reaction}`}
          >
            {reaction}
          </button>
        ))}
      </div>
    );
  };

  const handleLongPress = (e: React.TouchEvent | React.MouseEvent, _messageId: string) => {
    e.preventDefault();
    const targetElement = e.target as HTMLElement;
    const rect = targetElement.getBoundingClientRect();

    // Adjust position to be above and centered, or adjust as needed
    let xPos = rect.left + (rect.width / 2);
    let yPos = rect.top - 60; // 60px above the element

    // Ensure it doesn't go off-screen left
    if (xPos < 100) xPos = 100;

    setReactionPickerPosition({ x: xPos, y: yPos });
    setShowReactionPicker(true);
    if (navigator.vibrate) navigator.vibrate(50);
  };


  const renderMessage = () => {
    // Render the reaction picker if active for this message
    if (showReactionPicker && message.id === 'currently_reacting_message_id') { // Placeholder for actual message ID logic
      return <ReactionPicker messageId={message.id} />;
    }

    return (
      <div
        className={cn(
          'px-[7px] py-[6px] break-words transition-transform duration-100 relative min-w-[60px]',
          isUser
            ? 'bg-[#DCF8C6] text-[#000000] rounded-tl-[7.5px] rounded-tr-[7.5px] rounded-bl-[7.5px] rounded-br-[0px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]'
            : isAd
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 text-foreground rounded-lg border border-blue-200 dark:border-blue-800'
            : 'bg-white dark:bg-gray-800 text-[#000000] dark:text-gray-100 rounded-tl-[0px] rounded-tr-[7.5px] rounded-bl-[7.5px] rounded-br-[7.5px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]'
        )}
        style={{
          transform: !isUser && !isAd ? `translateX(${swipeOffset}px)` : 'none',
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          contain: 'layout style paint',
          willChange: isDragging ? 'transform' : 'auto'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        // Use onClick for tap and onContextMenu/longpress for reactions
        onClick={!isAd ? handleTap : undefined}
        onContextMenu={(e) => {
            if (!isUser && !isAd) { // Only allow reactions on AI messages
                handleLongPress(e, message.id);
            }
        }}
        onTouchStartCapture={(e) => { // Use touchStartCapture for mobile long press
            if (!isUser && !isAd) {
                // Implement a simple long press detection
                const touch = e.touches[0];
                const messageElement = e.currentTarget as HTMLElement;
                const startX = touch.clientX;
                const startY = touch.clientY;

                const handleMove = (moveEvent: TouchEvent) => {
                    const deltaX = moveEvent.touches[0].clientX - startX;
                    const deltaY = moveEvent.touches[0].clientY - startY;
                    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                        messageElement.removeEventListener('touchmove', handleMove);
                        messageElement.removeEventListener('touchend', handleEnd);
                    }
                };

                const handleEnd = () => {
                    messageElement.removeEventListener('touchmove', handleMove);
                    messageElement.removeEventListener('touchend', handleEnd);
                };

                messageElement.addEventListener('touchmove', handleMove);
                messageElement.addEventListener('touchend', handleEnd);

                const longPressTimer = setTimeout(() => {
                    messageElement.removeEventListener('touchmove', handleMove);
                    messageElement.removeEventListener('touchend', handleEnd);
                    handleLongPress(e as any, message.id); // Pass the original event
                }, 700); // 700ms for long press

                messageElement.addEventListener('touchend', () => clearTimeout(longPressTimer));
            }
        }}
      >
        {/* Only show regular images if NOT view-once */}
        {isValidImageSrc && imageToShowUrl && !message.isViewOnce && (
          <Image
            src={imageToShowUrl}
            alt="Sent image"
            width={200}
            height={200}
            className="rounded-md mb-1 max-w-full h-auto"
            data-ai-hint={imageHint}
            key={`${message.id}-content-img-${imageToShowUrl}`}
            onError={handleContentImageError}
            priority={false}
            loading="lazy"
            // Chat image URLs come from admin-managed media assets / user uploads,
            // so the host is arbitrary. next/image throws on an unconfigured
            // hostname *during render*, which unmounts the whole chat thread —
            // skip the optimizer for anything outside remotePatterns.
            unoptimized={!isOptimizableImageSrc(imageToShowUrl)}
          />
        )}
        {message.audioUrl && (
          <audio controls src={message.audioUrl} className="w-full my-1">
            Your browser does not support the audio element.
          </audio>
        )}
        <div className="relative leading-[19px]">
          <div className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">
            {renderMessageContent()}
            {!isAd && (
              <span className="inline-flex items-center gap-[3px] float-right mt-1 ml-2.5 translate-y-[2px] select-none whitespace-nowrap">
                <span className={cn('text-[11px] leading-none',
                  isUser ? 'text-gray-600' : 'text-gray-500'
                )}>
                  {formatTime(timestamp)}
                </span>
                {renderTicks(message.status)}
                {message.isLiked && (
                  <Heart className="h-3 w-3 text-red-500 ml-0.5 fill-current" />
                )}
                {/* Display reaction if present */}
                {message.reaction && (
                  <span className="ml-0.5 text-base">{message.reaction}</span>
                )}
              </span>
            )}
          </div>
        </div>
        {isAd && (
          <div className="flex items-center justify-center mt-2">
            <span className="text-xs text-muted-foreground/60">
              Advertisement
            </span>
          </div>
        )}

        {/* Heart animation overlay for double-tap */}
        {showHeartAnimation && !isUser && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart
              className="h-8 w-8 text-red-500 fill-current animate-ping"
              style={{
                animationDuration: '0.5s',
                animationIterationCount: '4'
              }}
            />
          </div>
        )}
      </div>
    );
  };


  return (
    <div className={cn('flex w-full relative', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        "flex items-end relative",
        isAd ? "max-w-[85%] sm:max-w-[80%]" : "max-w-[75%] sm:max-w-[65%]"
      )}
           ref={bubbleRef}>
        {!isUser && !isAd && (
          <button
            onClick={onAvatarClick}
            className="h-8 w-8 mr-2 self-end shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded-full"
            aria-label={`View ${aiName}'s profile`}
          >
            <Avatar
              className="h-8 w-8"
              key={`ai-msg-avatar-comp-${message.id}-${aiAvatarUrlToUse || 'default_avatar_comp_key_mb'}`}
              style={{ width: '32px', height: '32px', flexShrink: 0 }}
            >
              <AvatarImage
                src={aiAvatarUrlToUse || undefined}
                alt={`${aiName} - AI girlfriend`}
                data-ai-hint="profile woman"
                key={`ai-msg-avatar-img-${message.id}-${aiAvatarUrlToUse || 'no_avatar_fallback_img_mb'}`}
                onError={handleAIAvatarError}
                width={32}
                height={32}
                style={{ width: '32px', height: '32px', aspectRatio: '1/1' }}
              />
              <AvatarFallback>{(aiName || "K").charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </button>
        )}
        {isAd && (
          <div className="h-8 w-8 mr-2 self-end shrink-0 flex items-center justify-center bg-blue-500/20 text-blue-600 rounded-full text-xs font-medium">
            Ad
          </div>
        )}
        {/* Enhanced WhatsApp-like reply icon that appears during swipe */}
        {!isUser && swipeOffset > 15 && (
          <div
            className="absolute right-full mr-3 top-1/2 transform -translate-y-1/2 z-10 transition-all duration-100"
            style={{
              opacity: Math.min(swipeOffset / swipeThreshold, 1),
              transform: `translateY(-50%) scale(${Math.min(0.8 + (swipeOffset / swipeThreshold) * 0.4, 1.2)})`,
            }}
          >
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200",
              swipeOffset > swipeThreshold ? "bg-blue-500/20 text-blue-600" : "bg-muted/30 text-muted-foreground"
            )}>
              <Reply className="h-4 w-4" />
            </div>
          </div>
        )}

        {renderMessage()}


        {/* Enhanced Quick Reply Options with WhatsApp-like styling */}
        {showQuickReplies && !isUser && !isAd && (
          <div className="absolute top-full left-0 mt-2 flex flex-wrap gap-2 bg-background/98 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-border/50 z-20 max-w-[300px] max-w-full animate-in slide-in-from-left-2 fade-in-0 duration-200">
            <div className="flex items-center gap-1 mb-2 w-full">
              <Reply className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Quick Reply</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs px-1 py-1 h-auto min-h-[20px] rounded-full text-muted-foreground hover:text-foreground ml-auto"
                onClick={() => setShowQuickReplies(false)}
              >
                ✕
              </Button>
            </div>
            {getQuickReplies().slice(0, 6).map((reply, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs px-3 py-2 h-auto min-h-[32px] rounded-full bg-card hover:bg-accent hover:scale-105 transition-all duration-200 border-border/30"
                onClick={() => handleQuickReplySelect(reply)}
              >
                {reply}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;