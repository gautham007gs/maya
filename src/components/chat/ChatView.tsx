'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { Message, MessageReaction } from '@/types';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import { analyticsTracker } from '@/lib/analytics-tracker';
// NOTE: BannerAdDisplay is intentionally NOT used here.
// All in-chat ad injection (native bubbles + banner fallback) is managed
// exclusively by page.tsx via injectNativeAdMessage / injectBannerAdMessage.
// A second inline system here caused duplicate / empty ad bubbles at the same
// message-count threshold as the native bubble injection.

const PAGE_SIZE = 30; // messages per "load more" batch

interface ChatViewProps {
  messages: Message[];
  aiAvatarUrl: string;
  aiName: string;
  isAiTyping: boolean;
  onQuickReply?: (replyText: string, originalMessage: Message) => void;
  onLikeMessage?: (messageId: string) => void;
  onReactToMessage?: (messageId: string, reaction: MessageReaction) => void;
  onAvatarClick?: () => void;
}

const ChatView: React.FC<ChatViewProps> = React.memo(({ messages, aiAvatarUrl, aiName, isAiTyping, onQuickReply, onLikeMessage, onReactToMessage, onAvatarClick }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentlySwipingMessageId, setCurrentlySwipingMessageId] = useState<string | null>(null);
  const [showTyping, setShowTyping] = useState(false);
  const trackedMsgIds = useRef<Set<string>>(new Set());
  const prevMessagesLength = useRef(0);
  const isLoadingOlder = useRef(false);

  // How many messages to show (from the end of the array).
  // Start at PAGE_SIZE; user can load more from the top.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset visibleCount only when a brand-new conversation starts (messages cleared)
  useEffect(() => {
    if (messages.length < prevMessagesLength.current) {
      setVisibleCount(PAGE_SIZE);
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  // Auto-scroll to bottom when NEW messages arrive, but NOT when loading older ones
  const autoScroll = useRef(true);

  // Show typing indicator quickly (400ms), and keep it visible for ≥700ms once shown.
  // This prevents the "flicker" where the indicator appears and disappears instantly
  // when the AI responds faster than the show-delay.
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAtRef = useRef<number>(0);
  const MIN_VISIBLE_MS = 700;

  useEffect(() => {
    if (isAiTyping) {
      // Clear any pending hide
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      // Show after a short natural delay
      showTimerRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        setShowTyping(true);
      }, 400);
    } else {
      // Cancel show if it hasn't fired yet
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      // If already visible, honour minimum display time before hiding
      if (shownAtRef.current > 0) {
        const elapsed = Date.now() - shownAtRef.current;
        const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
        hideTimerRef.current = setTimeout(() => {
          setShowTyping(false);
          shownAtRef.current = 0;
        }, remaining);
      } else {
        setShowTyping(false);
      }
    }
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isAiTyping]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Scroll to bottom on new messages (wrapped in rAF to prevent forced reflow)
  useEffect(() => {
    let rafId: number | null = null;
    if (!isLoadingOlder.current && autoScroll.current && messages.length > 0) {
      rafId = requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [messages, showTyping, scrollToBottom]);

  // Track message interactions for analytics (only once per message)
  useEffect(() => {
    messages.forEach(message => {
      if (trackedMsgIds.current.has(message.id)) return;
      const senderType = message.sender === 'ai' || (message.sender as any) === 'ad' ? 'ai' : 'user';
      analyticsTracker.trackMessage(
        message.id,
        senderType,
        message.text || '',
        !!(message.aiImageUrl || message.userImageUrl)
      );
      trackedMsgIds.current.add(message.id);
    });
  }, [messages]);

  const handleSwipeStart = useCallback((messageId: string) => {
    setCurrentlySwipingMessageId(messageId);
  }, []);

  const handleSwipeEnd = useCallback(() => {
    setCurrentlySwipingMessageId(null);
  }, []);

  // Determine which messages to actually render
  const visibleMessages = useMemo(
    () => messages.slice(Math.max(0, messages.length - visibleCount)),
    [messages, visibleCount]
  );

  const hasOlderMessages = messages.length > visibleCount;

  const handleLoadOlder = useCallback(() => {
    isLoadingOlder.current = true;
    autoScroll.current = false;

    // Remember the first currently-visible message so we can restore scroll position
    const firstVisible = topSentinelRef.current;
    const prevTop = firstVisible?.getBoundingClientRect().top ?? 0;

    setVisibleCount(prev => prev + PAGE_SIZE);

    // After the DOM updates, push scroll so the user stays at the same visual message
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (firstVisible) {
          const newTop = firstVisible.getBoundingClientRect().top;
          const container = containerRef.current?.closest('.overflow-y-auto') as HTMLElement | null;
          if (container) {
            container.scrollTop += newTop - prevTop;
          }
        }
        isLoadingOlder.current = false;
        autoScroll.current = true;
      });
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="p-3 sm:p-4 space-y-3 sm:space-y-4 bg-chat-bg-default custom-scrollbar"
      data-chat-container="true"
      style={{ minHeight: '100%', paddingBottom: '1rem' }}
    >
      {/* Load older messages button */}
      {hasOlderMessages && (
        <div className="flex justify-center pt-1 pb-2">
          <button
            onClick={handleLoadOlder}
            className="text-xs text-[#667781] dark:text-[#8696a0] bg-white dark:bg-[#202c33] border border-[#d1d7db] dark:border-[#374045] rounded-full px-4 py-1.5 shadow-sm hover:bg-gray-50 dark:hover:bg-[#2a3942] active:opacity-70 transition-colors"
          >
            Load older messages
          </button>
        </div>
      )}

      {/* Sentinel div — its position is used to preserve scroll on load-more */}
      <div ref={topSentinelRef} />

      {visibleMessages.map((msg) => (
        // Native ad bubbles (isNativeAd=true) are rendered via MessageBubble →
        // NativeAdBubble, which handles script injection and 45-s refresh internally.
        // No separate inline BannerAdDisplay is rendered here — page.tsx owns
        // all ad injection decisions.
        <MessageBubble
          key={msg.id}
          message={msg}
          aiAvatarUrl={aiAvatarUrl}
          aiName={aiName}
          onQuickReply={onQuickReply}
          onLikeMessage={onLikeMessage}
          onReactToMessage={onReactToMessage}
          isBlockedBySwipe={currentlySwipingMessageId != null && currentlySwipingMessageId !== msg.id}
          onSwipeStart={handleSwipeStart}
          onSwipeEnd={handleSwipeEnd}
          onAvatarClick={onAvatarClick}
        />
      ))}
      {showTyping && <TypingIndicator avatarUrl={aiAvatarUrl} />}
      <div ref={messagesEndRef} />
    </div>
  );
});

ChatView.displayName = 'ChatView';

export default ChatView;
