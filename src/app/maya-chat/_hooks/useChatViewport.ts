"use client";

import { useCallback, useEffect, useRef } from "react";

type SendLockRef = {
  current: boolean;
};

/**
 * Keeps the chat shell aligned with the mobile visual viewport.
 *
 * The send lock prevents the transient resize events emitted while a mobile
 * keyboard closes and reopens from making the chat container jump.
 *
 * IMPORTANT: `lastHeight`/`lastTop` are refs shared between the resize
 * listener and the lock-release callback below. They used to be plain
 * closure variables scoped only to the listener's effect, so when the lock
 * released it wrote the CSS vars directly but never updated those closure
 * variables. The next legitimate resize/scroll event then compared against
 * a stale value, saw a "change", and applied a second (visible) adjustment —
 * i.e. the input box would resize once on unlock, then jump again shortly
 * after. Sharing the same refs keeps both paths in sync so it only ever
 * applies once.
 */
export function useChatViewport(sendLockRef: SendLockRef) {
  const sendLockTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastHeightRef = useRef<number>(0);
  const lastTopRef = useRef<number>(0);

  const applyViewport = useCallback((height: number, top: number) => {
    lastHeightRef.current = height;
    lastTopRef.current = top;
    document.documentElement.style.setProperty("--chat-h", `${height}px`);
    document.documentElement.style.setProperty("--chat-top", `${top}px`);
  }, []);

  const handleBeforeSend = useCallback(() => {
    clearTimeout(sendLockTimerRef.current);
    sendLockRef.current = true;
    sendLockTimerRef.current = setTimeout(() => {
      sendLockRef.current = false;

      const visualViewport = window.visualViewport;
      const height = visualViewport?.height ?? window.innerHeight;
      const top = Math.round(visualViewport?.offsetTop ?? 0);
      applyViewport(height, top);
    }, 1200);
  }, [sendLockRef, applyViewport]);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    const initialHeight = visualViewport?.height ?? window.innerHeight;
    const initialTop = Math.round(visualViewport?.offsetTop ?? 0);
    const initialRaf = requestAnimationFrame(() => {
      applyViewport(initialHeight, initialTop);
    });

    const updateChatPosition = () => {
      if (sendLockRef.current) return;

      const nextViewport = window.visualViewport;
      const height = nextViewport?.height ?? window.innerHeight;
      const top = Math.round(nextViewport?.offsetTop ?? 0);

      if (height !== lastHeightRef.current || top !== lastTopRef.current) {
        applyViewport(height, top);
      }
    };

    visualViewport?.addEventListener("resize", updateChatPosition);
    visualViewport?.addEventListener("scroll", updateChatPosition);
    window.addEventListener("resize", updateChatPosition);

    return () => {
      cancelAnimationFrame(initialRaf);
      clearTimeout(sendLockTimerRef.current);
      visualViewport?.removeEventListener("resize", updateChatPosition);
      visualViewport?.removeEventListener("scroll", updateChatPosition);
      window.removeEventListener("resize", updateChatPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendLockRef, applyViewport]);

  return { handleBeforeSend };
}
