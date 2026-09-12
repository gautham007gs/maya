"use client";

import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openAdUrl } from '@/lib/instagram-browser';

interface DirectLinkAdProps {
  isVisible: boolean;
  directLinkUrl: string | null;
  onClose: () => void;
}

const DirectLinkAd: React.FC<DirectLinkAdProps> = ({ isVisible, directLinkUrl, onClose }) => {
  if (!isVisible || !directLinkUrl) {
    return null;
  }

  const handleAdClick = () => {
    openAdUrl(directLinkUrl);
    onClose();
  };

  return (
    <aside
      className={cn(
        "mx-3 mb-2 rounded-xl border border-amber-200/80 bg-amber-50/95 shadow-md",
        "px-4 py-3 flex items-start gap-3",
        "animate-in fade-in slide-in-from-bottom-2 duration-300"
      )}
      role="complementary"
      aria-label="Advertisement"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
          Sponsored · Advertisement
        </p>
        <a
          href={directLinkUrl}
          target="_blank" rel="noopener noreferrer sponsored"
          onClick={(e) => {
            e.preventDefault();
            handleAdClick();
          }}
          className="text-sm font-medium text-foreground hover:text-primary transition-colors no-underline leading-snug block"
        >
          View sponsored offer
          <ExternalLink className="inline-block ml-1 h-3 w-3 opacity-50" aria-hidden="true" />
        </a>
        <p className="text-xs text-muted-foreground mt-1">
          This link opens an external sponsored page.
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 flex-shrink-0"
        aria-label="Close advertisement"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </aside>
  );
};

export default DirectLinkAd;
