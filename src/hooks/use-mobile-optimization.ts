'use client';

import { useEffect, useRef } from 'react';

export function useMobileOptimization() {
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    const isLowEnd = (performance as any).memory?.jsHeapSizeLimit < 1073741824;

    // Use passive listeners for better scroll
    const options: AddEventListenerOptions = { passive: true };

    const touchHandler = () => {};
    document.addEventListener('touchstart', touchHandler, options);
    document.addEventListener('touchmove', touchHandler, options);
    document.addEventListener('touchend', touchHandler, options);

    cleanupRef.current.push(() => {
      document.removeEventListener('touchstart', touchHandler);
      document.removeEventListener('touchmove', touchHandler);
      document.removeEventListener('touchend', touchHandler);
    });

    // Aggressive optimizations for low-end
    if (isLowEnd) {
      document.documentElement.style.setProperty('--animation-duration', '0s');
      document.documentElement.classList.add('reduce-motion');
      
      // Disable expensive CSS features on low-end devices
      document.documentElement.style.setProperty('backdrop-filter', 'none');
      document.documentElement.style.setProperty('box-shadow', 'none');
    } else {
      document.documentElement.style.setProperty('--animation-duration', '0.15s');
    }

    document.documentElement.style.setProperty('touch-action', 'manipulation');
    document.documentElement.style.setProperty('-webkit-tap-highlight-color', 'rgba(0,0,0,0)');
    document.documentElement.style.setProperty('overflow-scrolling', 'touch');
    document.documentElement.style.setProperty('-webkit-overflow-scrolling', 'touch');

    // GPU acceleration
    const chatContainer = document.querySelector('[data-chat-container]');
    if (chatContainer instanceof HTMLElement) {
      chatContainer.style.transform = 'translateZ(0)';
      chatContainer.style.willChange = 'transform';
    }

    // Memory cleanup for low-end devices
    const memoryInterval = isLowEnd ? 30000 : 60000;
    const memoryCleanup = setInterval(() => {
      if ('memory' in performance && (performance as any).memory) {
        const memory = (performance as any).memory;
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * (isLowEnd ? 0.7 : 0.9)) {
          // Clear old data
          const keys = ['messages_kruthika', 'chat_history'];
          keys.forEach(key => {
            try {
              const data = localStorage.getItem(key);
              if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed) && parsed.length > (isLowEnd ? 20 : 50)) {
                  localStorage.setItem(key, JSON.stringify(parsed.slice(-(isLowEnd ? 20 : 50))));
                }
              }
            } catch (e) {
              console.warn('Memory cleanup error:', e);
            }
          });
        }
      }
    }, memoryInterval);

    cleanupRef.current.push(() => clearInterval(memoryCleanup));

    // Optimize viewport — MUST keep interactive-widget=resizes-content so Chrome 108+
    // shrinks the layout viewport when the keyboard opens (required for the
    // --chat-h / visualViewport height tracking in the chat page to work correctly).
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover, interactive-widget=resizes-content');
    }

    return () => {
      cleanupRef.current.forEach(cleanup => cleanup());
      cleanupRef.current = [];
    };
  }, []);
}

export function useMessageCleanup(messages: any[], maxMessages: number = 50) {
  useEffect(() => {
    const isLowEnd = (performance as any).memory?.jsHeapSizeLimit < 1073741824;
    const limit = isLowEnd ? 30 : maxMessages;

    if (messages.length > limit) {
      console.log(`Message count (${messages.length}) exceeds ${limit}, cleanup recommended`);
    }
  }, [messages.length, maxMessages]);
}