"use client";

import { useEffect } from 'react';

/**
 * Optional Screenshot Protection Component
 * Now configurable via environment variable
 * Set NEXT_PUBLIC_ENABLE_SCREENSHOT_PROTECTION=true to enable
 * Default: disabled for better UX
 */
export function ScreenshotProtection() {
  useEffect(() => {
    // Only enable if explicitly configured
    const isEnabled = process.env.NEXT_PUBLIC_ENABLE_SCREENSHOT_PROTECTION === 'true';
    
    if (!isEnabled) {
      console.log('📸 Screenshot protection is disabled (better UX). Set NEXT_PUBLIC_ENABLE_SCREENSHOT_PROTECTION=true to enable.');
      return;
    }

    console.log('🛡️ Screenshot protection enabled');

    // Simplified protection - only essential measures
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const handleKeydown = (e: KeyboardEvent): void => {
      // Only block PrintScreen key
      if (e.key === 'PrintScreen' || e.key === 'Print') {
        e.preventDefault();
      }
    };

    // Apply basic protections
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeydown);

    // Basic CSS protection (non-invasive)
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  return null;
}
