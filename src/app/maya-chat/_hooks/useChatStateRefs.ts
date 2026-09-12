"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/types";

/**
 * Keeps the mutable mirrors used by long-lived chat callbacks in one place.
 * These refs intentionally avoid forcing timers and async handlers to depend
 * on the full messages array or on rapidly changing typing state.
 */
export function useChatStateRefs(messages: Message[], isAiTyping: boolean) {
  const hasUserChattedRef = useRef(false);
  const messagesLengthRef = useRef(0);
  const isAiTypingRef = useRef(false);
  const isSendingRef = useRef(false);
  const lastMessageSenderRef = useRef<string | null>(null);
  const lastMessageTimestampRef = useRef(0);
  const offlineMsgScheduledRef = useRef(false);

  useEffect(() => {
    messagesLengthRef.current = messages.length;
    if (messages.some((message) => message.sender === "user")) {
      hasUserChattedRef.current = true;
    }
  }, [messages.length]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      lastMessageSenderRef.current = lastMessage.sender;
      lastMessageTimestampRef.current = new Date(
        lastMessage.timestamp,
      ).getTime();
    }
  }, [messages.length]);

  useEffect(() => {
    isAiTypingRef.current = isAiTyping;
  }, [isAiTyping]);

  return {
    hasUserChattedRef,
    messagesLengthRef,
    isAiTypingRef,
    isSendingRef,
    lastMessageSenderRef,
    lastMessageTimestampRef,
    offlineMsgScheduledRef,
  };
}