"use client";

import Image from "next/image";
import {
  ArrowLeft,
  EllipsisVertical,
  Info,
  MessageSquare,
  Phone,
  Video,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed left-[50%] top-[50%] z-50 w-[85vw] max-w-xs h-auto translate-x-[-50%] translate-y-[-50%] bg-white border-0 shadow-2xl rounded-2xl p-0 overflow-hidden sm:max-w-sm [&>button]:hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-white" />
          <div className="relative flex items-center justify-between p-4 text-gray-900 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={closeDialog}
                className="text-gray-600 hover:bg-gray-100 h-10 w-10 rounded-full p-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <DialogTitle className="text-gray-900 text-lg font-medium">
                  {aiName}
                </DialogTitle>
                <p className="text-gray-500 text-sm">{onlineStatus}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeDialog}
              className="text-gray-600 hover:bg-gray-100 h-10 w-10 rounded-full p-0"
            >
              <EllipsisVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center py-8 px-6 bg-white">
          <div className="mb-6">
            {aiAvatarUrl &&
            aiAvatarUrl !==
              "https://placehold.co/100x100.png/E91E63/FFFFFF?text=K" &&
            (aiAvatarUrl.startsWith("http") ||
              aiAvatarUrl.startsWith("data:") ||
              aiAvatarUrl.startsWith("/")) ? (
              <div className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-gray-200 shadow-2xl">
                <Image
                  key={`zoomed-${aiAvatarUrl}`}
                  src={aiAvatarUrl}
                  alt={`${aiName}'s profile photo`}
                  fill
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
                        <div class="w-full h-full bg-gray-400 flex items-center justify-center">
                          <span class="text-6xl font-light text-white">
                            ${(aiName || "K").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
            ) : (
              <div className="w-44 h-44 bg-gray-400 rounded-full flex items-center justify-center border-4 border-gray-200 shadow-2xl">
                <span className="text-6xl font-light text-white">
                  {(aiName || "K").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="text-center mb-8">
            <h3 className="text-gray-900 text-2xl font-medium mb-2">
              {aiName}
            </h3>
            <p className="text-gray-600 text-sm">{onlineStatus}</p>
          </div>

          <div className="flex items-center justify-center gap-8 w-full">
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center h-auto py-4 px-3 gap-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200 min-w-[60px] min-h-[60px]"
              onClick={closeDialog}
            >
              <MessageSquare className="h-6 w-6 text-gray-700" />
              <span className="text-xs text-gray-700 font-medium">Message</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center h-auto py-4 px-3 gap-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200 min-w-[60px] min-h-[60px]"
              onClick={onCallVideoClick}
            >
              <Phone className="h-6 w-6 text-gray-700" />
              <span className="text-xs text-gray-700 font-medium">Call</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center h-auto py-4 px-3 gap-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200 min-w-[60px] min-h-[60px]"
              onClick={onCallVideoClick}
            >
              <Video className="h-6 w-6 text-gray-700" />
              <span className="text-xs text-gray-700 font-medium">Video</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center h-auto py-4 px-3 gap-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200 min-w-[60px] min-h-[60px]"
              onClick={closeDialog}
            >
              <Info className="h-6 w-6 text-gray-700" />
              <span className="text-xs text-gray-700 font-medium">Info</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}