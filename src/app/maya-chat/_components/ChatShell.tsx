"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import type { Message, MessageReaction } from "@/types";

import ChatHeader from "@/components/chat/ChatHeader";
import ChatInput from "@/components/chat/ChatInput";
import ChatView from "@/components/chat/ChatView";
import ErrorBoundary from "@/components/ErrorBoundary";

// Advertising integrations inject third-party scripts and are not needed to
// make the conversation usable. Split them from the critical chat bundle.
const BannerAdDisplay = dynamic(() => import("@/components/chat/BannerAdDisplay"), {
  ssr: false,
});
const SocialBarAdDisplay = dynamic(() => import("@/components/chat/SocialBarAdDisplay"), {
  ssr: false,
});
const DesktopRailAd = dynamic(() => import("@/components/ads/DesktopRailAd"), {
  ssr: false,
});
const AvatarProfileDialog = dynamic(
  () => import("./AvatarProfileDialog").then((module) => module.AvatarProfileDialog),
  { ssr: false },
);

interface ChatShellProps {
  isMounted: boolean;
  aiName: string;
  aiAvatarUrl: string;
  onlineStatus: string;
  messages: Message[];
  isAiTyping: boolean;
  isOnline: boolean;
  showZoomedAvatarDialog: boolean;
  onAvatarClick: () => void;
  onCallVideoClick: () => void;
  onSendMessage: (text: string, imageUri?: string) => void;
  onBeforeSend: () => void;
  onQueueMessage: (text: string, imageUri?: string) => void;
  onQuickReply: (replyText: string, originalMessage: Message) => void;
  onLikeMessage: (messageId: string) => void;
  onReactToMessage: (messageId: string, reaction: MessageReaction) => void;
  onProfileDialogOpenChange: (open: boolean) => void;
  children?: ReactNode;
}

export function ChatShell({
  isMounted,
  aiName,
  aiAvatarUrl,
  onlineStatus,
  messages,
  isAiTyping,
  isOnline,
  showZoomedAvatarDialog,
  onAvatarClick,
  onCallVideoClick,
  onSendMessage,
  onBeforeSend,
  onQueueMessage,
  onQuickReply,
  onLikeMessage,
  onReactToMessage,
  onProfileDialogOpenChange,
}: ChatShellProps) {
  return (
    <div
      className="fixed left-0 right-0 flex flex-col max-w-3xl mx-auto bg-[#EFEAE2] dark:bg-[#0D1418] shadow-2xl overflow-hidden"
      style={{ top: "var(--chat-top, 0px)", height: "var(--chat-h, 100dvh)" }}
    >
      <div className="flex-shrink-0 z-10">
        <ChatHeader
          aiName={aiName}
          aiAvatarUrl={aiAvatarUrl}
          onlineStatus={onlineStatus}
          onAvatarClick={onAvatarClick}
          onCallClick={onCallVideoClick}
          onVideoClick={onCallVideoClick}
        />
        {isMounted && (
          <BannerAdDisplay
            placementKey="chat-top-banner"
            className="border-b border-border/20"
            refreshIntervalMs={45_000}
          />
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto bg-[#EFEAE2] dark:bg-[#0D1418]"
        style={{ minHeight: 0, WebkitOverflowScrolling: "touch" }}
      >
        <ErrorBoundary>
          <ChatView
            messages={messages}
            aiAvatarUrl={aiAvatarUrl}
            aiName={aiName}
            isAiTyping={isAiTyping}
            onQuickReply={onQuickReply}
            onLikeMessage={onLikeMessage}
            onReactToMessage={onReactToMessage}
            onAvatarClick={onAvatarClick}
          />
        </ErrorBoundary>
      </div>

      <div className="flex-shrink-0 z-10 bg-[#F0F0F0] dark:bg-gray-900">
        {isMounted && (
          <BannerAdDisplay
            placementKey="maya-chat-input"
            className="border-t border-border/20"
            refreshIntervalMs={45_000}
          />
        )}
        <ChatInput
          onSendMessage={onSendMessage}
          isAiTyping={isAiTyping}
          onBeforeSend={onBeforeSend}
          isOnline={isOnline}
          onQueueMessage={onQueueMessage}
        />
      </div>

      {isMounted && <SocialBarAdDisplay page="chat" />}
      {isMounted && <DesktopRailAd />}

      {showZoomedAvatarDialog && (
        <AvatarProfileDialog
          open={showZoomedAvatarDialog}
          aiName={aiName}
          aiAvatarUrl={aiAvatarUrl}
          onlineStatus={onlineStatus}
          onOpenChange={onProfileDialogOpenChange}
          onCallVideoClick={onCallVideoClick}
        />
      )}
    </div>
  );
}
