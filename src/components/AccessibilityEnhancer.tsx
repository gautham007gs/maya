'use client';

import { useEffect } from 'react';

export default function AccessibilityEnhancer() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Add main landmark if missing
    if (!document.querySelector('main')) {
      const mainContent = document.querySelector('[role="main"]') || document.body;
      mainContent.setAttribute('role', 'main');
      mainContent.id = 'main-content';
    }

    // Enhance focus visibility
    document.documentElement.classList.add('focus-visible');

    // Add accessibility metadata only where the browser cannot derive an
    // accessible name from the element itself. Visible button/link text is
    // already an accessible name; adding redundant aria-label attributes
    // after hydration mutates server-rendered markup and can trigger React
    // hydration warnings on content-heavy pages such as the blog.
    const addAriaLabels = () => {
      // Vendor ad-network iframes are injected without a title attribute
      // (Lighthouse/axe: frame-title). Title them without hiding them —
      // aria-hidden would trip the focused-content-hidden rule instead.
      document.querySelectorAll('iframe:not([title])').forEach((iframe) => {
        iframe.setAttribute('title', 'Advertisement');
      });

      // Ad-network banner creatives sometimes render anchor tags with no text,
      // no image and no label (axe: link-name). Name any anchor that would
      // otherwise be announced as nothing.
      document.querySelectorAll('a:not([aria-label])').forEach((link) => {
        const hasText = (link.textContent || '').trim().length > 0;
        const hasNamedImage = !!link.querySelector('img[alt]:not([alt=""])');
        const hasSvgTitle = !!link.querySelector('svg title, title');
        if (!hasText && !hasNamedImage && !hasSvgTitle) {
          link.setAttribute('aria-label', 'Advertisement');
        }
      });

      // Images without alt text
      document.querySelectorAll('img:not([alt])').forEach((img) => {
        const src = img.getAttribute('src');
        if (src) {
          const filename = src.split('/').pop()?.split('.')[0] || 'image';
          img.setAttribute('alt', filename.replace(/[-_]/g, ' '));
        }
      });
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const debouncedAddAriaLabels = () => {
      if (timeoutId != null) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        addAriaLabels();
      }, 200);
    };

    // Run on idle and on DOM changes (debounced to avoid blocking main thread)
    let initialTimer: ReturnType<typeof setTimeout> | null = setTimeout(addAriaLabels, 300);
    const observer = new MutationObserver(debouncedAddAriaLabels);
    observer.observe(document.body, { childList: true, subtree: true });

    // Cleanup
    return () => {
      if (initialTimer != null) clearTimeout(initialTimer);
      if (timeoutId != null) clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);

  return null;
}