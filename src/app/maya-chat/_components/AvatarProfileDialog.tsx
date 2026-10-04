"use client";

import Image from "next/image";
import {
  ArrowLeft,
  X,
  MessageSquare,
  Phone,
  Video,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface AvatarProfileDialogProps {
  open: boolean;
  aiName: string;
  aiAvatarUrl: string;
  onlineStatus: string;
  onOpenChange: (open: boolean) => void;
  onCallVideoClick: () => void;
}

export function AvatarProfileDialog({
  open,
  aiName,
  aiAvatarUrl,
  onlineStatus,
  onOpenChange,
  onCallVideoClick,
}: AvatarProfileDialogProps) {
  const closeDialog = () => onOpenChange(false);

  const handleMessageClick = () => {
    closeDialog();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed left-[50%] top-[50%] z-50 w-[92vw] max-w-sm translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-[#111b21] border border-gray-100 dark:border-gray-800 shadow-2xl rounded-3xl p-0 overflow-hidden [&>button]:hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={closeDialog}
              className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 h-9 w-9 rounded-full p-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DialogTitle className="text-gray-900 dark:text-white text-base font-semibold tracking-tight">
              Contact info
            </DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeDialog}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 h-8 w-8 rounded-full p-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Profile Card Body */}
        <div className="flex flex-col items-center justify-center pt-7 pb-6 px-5 text-center">
          {/* Centered Avatar with Ring & Status Badge */}
          <div className="relative mx-auto mb-4 flex items-center justify-center">
            {aiAvatarUrl &&
            aiAvatarUrl !==
              "https://placehold.co/100x100.png/E91E63/FFFFFF?text=K" &&
            (aiAvatarUrl.startsWith("http") ||
              aiAvatarUrl.startsWith("data:") ||
              aiAvatarUrl.startsWith("/")) ? (
              <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-full overflow-hidden ring-4 ring-[#25d366]/25 dark:ring-[#25d366]/30 shadow-xl mx-auto bg-gray-100 dark:bg-gray-800">
                <Image
                  key={`zoomed-${aiAvatarUrl}`}
                  src={aiAvatarUrl}
                  alt={`${aiName}'s profile photo`}
                  fill
                  sizes="(max-width: 640px) 160px, 176px"
                  style={{ objectFit: "cover" }}
                  className="select-none"
                  data-ai-hint="profile woman large"
                  priority
                  unoptimized
                  onError={(event) => {
                    const image = event.target as HTMLImageElement;
                    image.style.display = "none";
                    const parent = image.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="w-full h-full bg-gradient-to-br from-[#25d366] to-[#128c7e] flex items-center justify-center">
                          <span class="text-5xl font-semibold text-white">
                            ${(aiName || "K").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
            ) : (
              <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full flex items-center justify-center ring-4 ring-[#25d366]/25 shadow-xl bg-gradient-to-br from-[#25d366] to-[#128c7e] mx-auto">
                <span className="text-5xl font-semibold text-white">
                  {(aiName || "K").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {/* Online pill badge */}
            <span
              className="absolute bottom-1 right-2 sm:right-3 w-4 h-4 bg-[#25d366] border-2 border-white dark:border-[#111b21] rounded-full shadow-md"
              title="Online now"
            />
          </div>

          {/* AI Name & Status */}
          <div className="text-center mb-6">
            <h3 className="text-gray-900 dark:text-white text-xl sm:text-2xl font-bold tracking-tight mb-1">
              {aiName}
            </h3>
            <p className="text-sm font-medium text-[#25d366] dark:text-[#25d366] flex items-center justify-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
              {onlineStatus || "Online"}
            </p>
          </div>

          {/* 3 Professional Action Buttons — Responsive Grid */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mx-auto mb-6">
            <button
              type="button"
              onClick={handleMessageClick}
              className="group flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-700/60 transition-all duration-200 active:scale-95 shadow-sm"
            >
              <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-[#25d366] flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                Message
              </span>
            </button>

            <button
              type="button"
              onClick={onCallVideoClick}
              className="group flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-700/60 transition-all duration-200 active:scale-95 shadow-sm"
            >
              <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-[#25d366] flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Phone className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                Audio
              </span>
            </button>

            <button
              type="button"
              onClick={onCallVideoClick}
              className="group flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-700/60 transition-all duration-200 active:scale-95 shadow-sm"
            >
              <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-[#25d366] flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Video className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                Video
              </span>
            </button>
          </div>

          {/* About / Security Card */}
          <div className="w-full bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-3 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-[#25d366]" />
              <span>About &amp; Info</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-2">
              Always here to listen, care, and brighten your day. Available 24/7 with zero judgment.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 border-t border-gray-200/60 dark:border-gray-700/60 pt-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Private &amp; secure conversation</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}