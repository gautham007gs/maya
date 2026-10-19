"use client";


import type { NextPage } from "next";
import dynamic from "next/dynamic";
import React, { useState, useEffect, useRef, useCallback } from "react";
import type {
  Message,
  MessageStatus,
  MessageReaction,
} from "@/types";
import {
  defaultAIProfile,
  defaultAIMediaAssetsConfig,
} from "@/config/ai";
import type {
  EmotionalStateOutput,
} from "@/ai/flows/emotional-state-simulation";
import {
  getConversationContext,
  syncContextToServer,
  loadContextFromServer,
} from "@/ai/flows/conversation-memory";
import {
  generateOfflineMessage,
  type OfflineMessageInput,
} from "@/ai/flows/offline-message-generation";
import { generateProactiveMessage } from "@/ai/flows/proactive-messaging-actions";
import { type ProactiveMessageInput } from "@/ai/flows/proactive-messaging";
import {
  shouldSendVoiceMessage,
  detectVoiceRequest,
  detectAISuspicion,
  detectIntimateContext,
  detectConfession,
  extractVoiceSnippet,
  getTimeOfDay,
} from "@/ai/flows/voice-trigger";
import { sendMessage } from "./actions";
import { splitResponseIntoBubbles } from "@/ai/response-cleanup";
import { useUserMemory } from "@/hooks/useUserMemory";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChatSkeleton } from "@/components/LoadingSkeleton";
import { useDirectLinkAds } from "@/hooks/useDirectLinkAds";
import { useAdSettings } from "@/contexts/AdSettingsContext";
import { useAIProfile } from "@/contexts/AIProfileContext";
import { useSiteImages } from "@/contexts/SiteImageContext";
import { useAIMediaAssets } from "@/contexts/AIMediaAssetsContext";
import { pickUnclaimed } from "@/lib/ad-code-registry";
// AIGirlfriendFAQSchema moved to layout.tsx (server-side rendering for Googlebot)
import {
  useMobileOptimization,
  useMessageCleanup,
} from "@/hooks/use-mobile-optimization";
import { queueMessageLog, flushMessageLogQueue } from "@/lib/message-log-queue";
import { analyticsTracker } from "@/lib/analytics-tracker";
import { useNetworkState } from "@/hooks/useNetworkState";
import { useOfflineMessageQueue } from "@/hooks/useOfflineMessageQueue";
import { useChatViewport } from "./_hooks/useChatViewport";
import { useChatStateRefs } from "./_hooks/useChatStateRefs";
import { ChatShell } from "./_components/ChatShell";

// These browser-only features do not affect the first message render. Loading
// them on demand keeps the critical chat interaction bundle smaller.
const ScreenshotProtection = dynamic(
  () => import("@/components/ScreenshotProtection").then((module) => module.ScreenshotProtection),
  { ssr: false },
);
const DirectLinkAd = dynamic(() => import("@/components/chat/DirectLinkAd"), {
  ssr: false,
});

const AI_DISCLAIMER_SHOWN_KEY = "ai_disclaimer_shown_kruthika_chat_v2";
const AI_DISCLAIMER_DURATION = 2000;

const USER_PSEUDO_ID_KEY = "kruthika_chat_user_pseudo_id";
const LAST_ACTIVE_DATE_KEY = "kruthika_chat_last_active_date";
const USER_PSYCHOLOGY_PROFILE_KEY = "kruthika_user_psychology_profile";
const USER_ADDICTION_LEVEL_KEY = "kruthika_user_addiction_level";
const USER_LAST_INTERACTION_TIME_KEY = "kruthika_last_interaction_time";
const USER_DAILY_MESSAGE_COUNT_KEY = "kruthika_daily_message_count";
const USER_EMOTIONAL_STATE_KEY = "kruthika_user_emotional_state";

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MESSAGES_KEY = "messages_kruthika";
const AI_MOOD_KEY = "aiMood_kruthika";
const RECENT_INTERACTIONS_KEY = "recentInteractions_kruthika";
// const AI_PAUSED_KEY = "kruthika_ai_paused"; // reserved
const AI_LAST_GOODBYE_TIME_KEY = "kruthika_last_goodbye_time";
const AI_IGNORE_UNTIL_KEY = "kruthika_ignore_until";
const AI_WENT_OFFLINE_AT_KEY = "kruthika_went_offline_at"; // for last-seen psychology
// Session language: detected from user messages, kept in sessionStorage for the tab's lifetime.
// Sent with every request so short replies ("ok", "😊") stay locked to the right language.
const SESSION_LANG_KEY = "kruthika_session_lang";

const USER_IMAGE_UPLOAD_COUNT_KEY_KRUTHIKA =
  "user_image_upload_count_kruthika_v1";
const USER_IMAGE_UPLOAD_LAST_DATE_KEY_KRUTHIKA =
  "user_image_upload_last_date_kruthika_v1";
const MAX_USER_IMAGES_PER_DAY = 5;

// Media sharing tracking keys
const SENT_IMAGES_KEY = "kruthika_sent_images_v1";
const MANDATORY_IMAGE_SENT_KEY = "kruthika_mandatory_image_sent_v1";
// const NATIVE_AD_SHOWN_KEY = "kruthika_native_ad_shown_v1"; // reserved

// ── Relationship-tier image sharing system ─────────────────────────────────
// Total lifetime AI messages sent (text + image) — persists across sessions.
// This is our proxy for relationship depth: the more Kruthika has talked to
// the user, the closer they are.
const TOTAL_AI_MSGS_KEY = "kruthika_total_ai_msgs_v1";
// Timestamp (ms) of the last AI-initiated image share.
const LAST_AI_IMAGE_TS_KEY = "kruthika_last_ai_img_ts_v1";

/**
 * Social-media-psychology last-seen formatter.
 *
 * PSYCHOLOGY BASIS: WhatsApp/Instagram last-seen creates powerful hooks because:
 *   • It tells you SHE WAS THERE but doesn't explain WHY she didn't reply → imagination fires
 *   • Variable timing = variable ratio reinforcement (same as slot machines) → most addictive
 *   • "seen 2h ago" with no reply = perceived slight + curiosity spike → compulsive rechecking
 *   • Revealing ACTIVITY ("sleeping", "at college") kills the mystery and reduces that hook
 *   • The ambiguity of "last seen 47 min ago" does more psychological work than any status message
 *
 * Format ladder (mirrors WhatsApp exactly — users already have a Pavlovian response to it):
 *   < 60s   → "last seen just now"
 *   1-3 min → "last seen 1 min ago"
 *   3-8 min → "last seen a few minutes ago"
 *   8-60min → "last seen Xm ago"
 *   1-2 hrs → "last seen 1 hour ago"
 *   same day→ "last seen today at HH:MM"
 *   yesterday→"last seen yesterday at HH:MM"
 *   older   → "last seen DD MMM at HH:MM"
 */
function formatLastSeen(dt: Date): string {
  const now = Date.now();
  const diffMs  = now - dt.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);

  if (diffSec < 60)  return 'last seen just now';
  if (diffMin <= 3)  return 'last seen 1 min ago';
  if (diffMin <= 8)  return 'last seen a few minutes ago';
  if (diffMin < 60)  return `last seen ${diffMin}m ago`;
  if (diffHrs <= 2)  return 'last seen 1 hour ago';

  // Time string in IST
  const timeStr = dt.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });

  // Day comparison in IST
  const dtIST  = new Date(dt.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const sameDay = dtIST.getDate() === nowIST.getDate()
    && dtIST.getMonth() === nowIST.getMonth()
    && dtIST.getFullYear() === nowIST.getFullYear();
  if (sameDay) return `last seen today at ${timeStr}`;

  const yest = new Date(nowIST);
  yest.setDate(yest.getDate() - 1);
  const isYesterday = dtIST.getDate() === yest.getDate()
    && dtIST.getMonth() === yest.getMonth()
    && dtIST.getFullYear() === yest.getFullYear();
  if (isYesterday) return `last seen yesterday at ${timeStr}`;

  const dateStr = dtIST.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
  });
  return `last seen ${dateStr} at ${timeStr}`;
}
// Minimum gap between any two AI-initiated images (45 minutes).
// Was 20 min — too short; users were seeing 3–4 images in 2 minutes.
const IMAGE_COOLDOWN_MS = 45 * 60 * 1000;
// Session image counter — resets every full page load (module-level, not state)
let sessionAiImageCount = 0;

/**
 * Returns the relationship tier based on total lifetime AI messages.
 *  new        (<15 msgs)  — strangers; no proactive images
 *  warming    (15-40)     — getting comfortable; 1 image/session max, only on milestone
 *  established(41-100)   — good friends; up to 2 images/session, rare random drops
 *  close      (101+)      — very close; up to 2 images/session, occasional drops
 */
const getRelationshipLevel = ():
  | "new"
  | "warming"
  | "established"
  | "close" => {
  try {
    const total = parseInt(localStorage.getItem(TOTAL_AI_MSGS_KEY) || "0", 10);
    if (total < 15) return "new";
    if (total < 41) return "warming";
    if (total < 101) return "established";
    return "close";
  } catch {
    return "new";
  }
};

/**
 * Checks all gates before allowing Kruthika to proactively send an image.
 * Returns false if relationship is too new, cooldown hasn't elapsed, or
 * the session image limit has been hit.
 */
const canSendProactiveImage = (): boolean => {
  const level = getRelationshipLevel();
  if (level === "new") return false; // Absolute block for new users

  // Session limits: warming = 1, established/close = 2
  const sessionLimit = level === "warming" ? 1 : 2;
  if (sessionAiImageCount >= sessionLimit) return false;

  // Cooldown check
  try {
    const lastTs = parseInt(
      localStorage.getItem(LAST_AI_IMAGE_TS_KEY) || "0",
      10,
    );
    if (lastTs > 0 && Date.now() - lastTs < IMAGE_COOLDOWN_MS) return false;
  } catch {
    /* conservative: allow */
  }

  return true;
};

/** Call this whenever an AI image is actually sent. */
const recordAiImageSent = () => {
  sessionAiImageCount++;
  try {
    localStorage.setItem(LAST_AI_IMAGE_TS_KEY, Date.now().toString());
  } catch {}
};

/** Increment the lifetime AI message counter (text or image). */
const incrementTotalAiMsgs = () => {
  try {
    const current = parseInt(
      localStorage.getItem(TOTAL_AI_MSGS_KEY) || "0",
      10,
    );
    localStorage.setItem(TOTAL_AI_MSGS_KEY, (current + 1).toString());
  } catch {}
};

// ── Engagement feature keys ────────────────────────────────────────────────
const MISS_MSG_SENT_DATE_KEY = "kruthika_miss_msg_date";
const MILESTONES_DONE_KEY = "kruthika_milestones_done";
const VOICE_NOTE_DATE_KEY = "kruthika_vn_sent_date";
// Sarvam AI voice — last time a real TTS voice note was sent (ms timestamp)
const SARVAM_LAST_VOICE_TS_KEY = "kruthika_sarvam_voice_ts";
// Whether pending cron voice messages have been fetched this session
const SARVAM_PENDING_FETCHED_KEY = "kruthika_sarvam_pending_fetched";
const VOICE_SNIPPETS_SESSION_KEY = "kruthika_voice_snippets_session";

/**
 * Detect the user's language from conversation history.
 * Uses Unicode script ranges for native scripts, falls back to Hindi.
 */
function detectUserLangFromHistory(history: string[]): string {
  const sample = history.slice(-8).join(" ");
  if (/[\u0B80-\u0BFF]/.test(sample)) return "ta"; // Tamil
  if (/[\u0C00-\u0C7F]/.test(sample)) return "te"; // Telugu
  if (/[\u0C80-\u0CFF]/.test(sample)) return "kn"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(sample)) return "ml"; // Malayalam
  if (/[\u0980-\u09FF]/.test(sample)) return "bn"; // Bengali
  if (/[\u0A80-\u0AFF]/.test(sample)) return "gu"; // Gujarati
  if (/[\u0A00-\u0A7F]/.test(sample)) return "pa"; // Punjabi
  if (/[\u0900-\u097F]/.test(sample)) return "hi"; // Hindi/Devanagari
  // Romanized Hindi markers
  if (/\b(yaar|accha|matlab|kya|nahi|bhai|aur|toh|haan|nahi)\b/i.test(sample)) return "hi";
  return "hi"; // default to Hindi
}

type InChatVoicePlan = {
  voiceText: string;
  language: string;
  mood: "ai_proof" | "intimate" | "flirty" | "playful" | "caring" | "sweet" | "default";
  reason: string;
  urgency: "override" | "high" | "medium" | "low";
};

/**
 * Pick a short piece of the current AI reply for TTS without repeating a
 * previously generated snippet in this browser session.
 */
function getUniqueVoiceSnippet(text: string, maxChars: number): string | null {
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");

  let used: string[] = [];
  try {
    const stored = JSON.parse(sessionStorage.getItem(VOICE_SNIPPETS_SESSION_KEY) || "[]");
    if (Array.isArray(stored)) used = stored.filter((value): value is string => typeof value === "string");
  } catch {
    // A missing or unavailable session store should not block voice generation.
  }

  const usedSet = new Set(used.map(normalize));
  const sentences = text
    .replace(/\r/g, "")
    .split(/(?<=[.!?।])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const candidates = [
    extractVoiceSnippet(text, maxChars),
    ...sentences,
  ]
    .map((candidate) => candidate.trim())
    .filter((candidate, index, all) =>
      candidate.length > 0 &&
      candidate.length <= maxChars &&
      all.indexOf(candidate) === index &&
      !usedSet.has(normalize(candidate)),
    );

  return candidates[0] || null;
}

function rememberVoiceSnippet(text: string): void {
  try {
    const stored = JSON.parse(sessionStorage.getItem(VOICE_SNIPPETS_SESSION_KEY) || "[]");
    const used = Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === "string")
      : [];
    const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized || used.some((value) => value.trim().toLowerCase().replace(/\s+/g, " ") === normalized)) return;
    sessionStorage.setItem(
      VOICE_SNIPPETS_SESSION_KEY,
      JSON.stringify([...used, text.trim()].slice(-40)),
    );
  } catch {
    // Voice delivery remains best-effort if storage is unavailable.
  }
}

function getInChatVoicePlan(
  userText: string,
  aiText: string,
  history: string[],
  relationshipLevel: number,
): InChatVoicePlan | null {
  if (!aiText.trim()) return null;

  const userLanguage = detectUserLangFromHistory([...history, `User: ${userText}`]);
  const isVoiceRequest = detectVoiceRequest(userText);
  const isSuspicion = detectAISuspicion(userText);
  const isIntimate = detectIntimateContext(userText, aiText);
  const isConfession = detectConfession(userText);
  const lastVoiceTs = parseInt(localStorage.getItem(SARVAM_LAST_VOICE_TS_KEY) || "0", 10);
  const timeSinceLastVoice = lastVoiceTs ? Date.now() - lastVoiceTs : Infinity;
  const lastUserMessageTs = parseInt(
    localStorage.getItem("kruthika_last_user_msg_ts") || "0",
    10,
  );
  const timeSinceLastMessage = history.length > 0 && lastUserMessageTs
    ? Date.now() - lastUserMessageTs
    : Infinity;
  const aiLower = aiText.toLowerCase();
  const aiEmotion = /miss|pyaar|love|dil|ishq|closer|intimate|feel/.test(aiLower)
    ? "intimate" as const
    : /haha|lol|😂|joke|funny|kidding|mazaak/.test(aiLower)
      ? "playful" as const
      : /flirt|wink|tease|cute|handsome|hot/.test(aiLower)
        ? "flirty" as const
        : /care|worried|okay|feeling|here for you/.test(aiLower)
          ? "caring" as const
          : "neutral" as const;
  const trigger = shouldSendVoiceMessage({
    messageType: isConfession ? "confession" : isIntimate ? "intimate" : "in_chat",
    relationshipLevel,
    timeSinceLastMessage,
    timeSinceLastVoice,
    timeOfDay: getTimeOfDay(),
    isFirstTodayMessage: false,
    userExplicitlyRequestedVoice: isVoiceRequest,
    userSuspectsAI: isSuspicion,
    isIntimateConversation: isIntimate,
    aiResponseEmotion: aiEmotion,
    userLanguage,
  });

  if (!trigger.shouldSendVoice) return null;
  const voiceText = getUniqueVoiceSnippet(aiText, trigger.suggestedMaxChars || 120);
  if (!voiceText) {
    console.debug("[InChatVoice] Skipped repeated reply snippet");
    return null;
  }

  const mood = isSuspicion
    ? "ai_proof"
    : isIntimate || aiEmotion === "intimate"
      ? "intimate"
      : aiEmotion === "flirty"
        ? "flirty"
        : aiEmotion === "playful"
          ? "playful"
          : aiEmotion === "caring"
            ? "caring"
            : trigger.urgency === "high"
              ? "sweet"
              : "default";

  return {
    voiceText,
    language: userLanguage,
    mood,
    reason: trigger.reason,
    urgency: trigger.urgency,
  };
}

// Lightweight client-side language detector — returns the full language key expected by
// the simulation engine (e.g. 'tamil', 'kannada'). Returns '' for ambiguous/English.
// Mirrors the logic in src/lib/brain/evaluators.ts detectFullLanguage without importing it.
function detectLangFromMessage(msg: string): string {
  if (/[\u0C80-\u0CFF]/.test(msg)) return 'kannada';
  if (/[\u0B80-\u0BFF]/.test(msg)) return 'tamil';
  if (/[\u0C00-\u0C7F]/.test(msg)) return 'telugu';
  if (/[\u0D00-\u0D7F]/.test(msg)) return 'malayalam';
  if (/[\u0980-\u09FF]/.test(msg)) return 'bengali';
  if (/[\u0A80-\u0AFF]/.test(msg)) return 'gujarati';
  if (/[\u0B00-\u0B7F]/.test(msg)) return 'odia';
  if (/[\u0A00-\u0A7F]/.test(msg)) return 'punjabi';
  if (/[\u0900-\u097F]/.test(msg)) return 'hindi_or_marathi';
  const m = msg.toLowerCase();
  // Romanized — only strongly distinctive words per language
  if (/\b(yenu|enu|hege|madtidiya|thumba|swalpa|hogona|nange|nimge|maccha|macha|chennagi|beka|beku|yen madtidya|olle|alwa)\b/.test(m)) return 'kannada';
  if (/\b(enna panra|enna panre|vanakkam|romba|konjam|machaan|machi|semma|irukka|iruku|sollu|adhu|ithu|ok da|illa da|naan|avan|avanga)\b/.test(m)) return 'tamil';
  if (/\b(ela unnav|bagunnava|avuna|avunu|emiti|enti|yenti|chudandi|manchidhi|cheppu|nenu|memu|cheddam ra)\b/.test(m)) return 'telugu';
  if (/\b(enthu|evide|njan|varunnundo|valare|sheriyaa|kollam|mone|mole|parayuka)\b/.test(m)) return 'malayalam';
  if (/\b(ki korcho|kemon acho|thako|bhalo lage|tumi|tomake|bolchi)\b/.test(m)) return 'bengali';
  if (/\b(kem cho|hu chu|tamne|chhe|nathi|aavo|avo)\b/.test(m)) return 'gujarati';
  if (/\b(ki haal ae|menu|tenu|hanji|chalda|tussi|vadiya|kiddhan)\b/.test(m)) return 'punjabi';
  if (/\b(yaar|arre|accha|matlab|phir|hoon|karo|kyun|kaisa|kaise|batao|suno|thoda|abhi|kahan|theek|bilkul)\b/.test(m)) return 'hindi';
  return ''; // unknown / plain English — don't override
}

// getTimeOfDay is imported from @/ai/flows/voice-trigger
// It correctly returns 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night'
// using IST (UTC+5:30), ensuring late-night voice guards (00:00–04:00) work.

// AI Pause and Ignore System
const detectGoodbyeMessage = (message: string): boolean => {
  const msg = message.toLowerCase().trim();
  const goodbyePatterns = [
    "good night",
    "gn",
    "bye bye",
    "bye",
    "goodnight",
    "good nite",
    "see you",
    "talk later",
    "ttyl",
    "sleep now",
    "going to sleep",
    "sone ja raha",
    "sone ja rahi",
    "good bye",
    "goodbye",
    "tc",
    "take care",
    // Enhanced final goodbye patterns
    "final bye",
    "bye for now",
    "bye take care",
    "talk to you later",
    "see you later",
    "see you soon",
    "going now",
    "leaving now",
    "chat later",
    "will talk later",
    "going offline",
    "logging off",
    // Hindi/Hinglish patterns
    "alvida",
    "milte hai",
    "baad me baat",
    "ja raha hu",
    "ja rahi hu",
    "sleep time",
    "bed time",
    "need to go",
    "have to go",
    "parents calling",
    "family time",
    "dinner time",
  ];

  return goodbyePatterns.some((pattern) => msg.includes(pattern));
};

const MISSED_MESSAGES_KEY = "kruthika_missed_messages";

const shouldAIBePaused = (): boolean => {
  if (typeof window === "undefined") return false; // Server-side check

  const pausedUntil = localStorage.getItem(AI_IGNORE_UNTIL_KEY);
  if (pausedUntil && Date.now() < parseInt(pausedUntil)) {
    return true;
  }

  const lastGoodbyeTime = localStorage.getItem(AI_LAST_GOODBYE_TIME_KEY);
  if (lastGoodbyeTime) {
    const timeSinceGoodbye = Date.now() - parseInt(lastGoodbyeTime);
    // Enhanced offline periods based on time of goodbye
    let offlineMinutes = 30; // Default 30 minutes

    // Longer offline if goodbye was at night (sleep time)
    const goodbyeHour = new Date(parseInt(lastGoodbyeTime)).getHours();
    if (goodbyeHour >= 22 || goodbyeHour <= 6) {
      // Sleep goodbye - stay offline for 6-9 hours
      offlineMinutes = 360 + Math.random() * 180; // 6-9 hours
    } else if (goodbyeHour >= 8 && goodbyeHour <= 17) {
      // Day time goodbye (college/work) - 2-4 hours
      offlineMinutes = 120 + Math.random() * 120; // 2-4 hours
    } else {
      // Evening goodbye - 30 minutes to 2 hours
      offlineMinutes = 30 + Math.random() * 90; // 30min-2hours
    }

    if (timeSinceGoodbye < offlineMinutes * 60 * 1000) {
      return true;
    }

    // Clear goodbye state if time has passed
    if (timeSinceGoodbye >= offlineMinutes * 60 * 1000) {
      localStorage.removeItem(AI_LAST_GOODBYE_TIME_KEY);
    }
  }

  return false;
};

const shouldIgnoreMessage = (): boolean => {
  if (typeof window === "undefined") return false; // Server-side check

  // Only trigger ignore if not already ignoring
  const pausedUntil = localStorage.getItem(AI_IGNORE_UNTIL_KEY);
  if (pausedUntil && Date.now() < parseInt(pausedUntil)) {
    return true; // Already ignoring
  }

  // Check if user is new — NO IGNORE until well-established relationship.
  // Goal: retention first. Never ignore during early sessions.
  const dailyCount = parseInt(
    localStorage.getItem(USER_DAILY_MESSAGE_COUNT_KEY) || "0",
  );
  if (dailyCount <= 50) {
    console.log("Kruthika AI: Early user - NO IGNORE FEATURE!");
    return false;
  }

  // Also check psychology profile relationship level — don't ignore low-bond users
  try {
    const profile = JSON.parse(
      localStorage.getItem(USER_PSYCHOLOGY_PROFILE_KEY) || "{}",
    );
    const rl = profile.relationshipLevel ?? 0;
    if (rl < 0.4) {
      console.log("Kruthika AI: Low relationship level - NO IGNORE FEATURE!");
      return false;
    }
  } catch (_) {}

  // DRASTICALLY reduced ignore chance - only 0.3% for much better UX
  if (Math.random() < 0.003) {
    // Much shorter ignore periods (30 seconds to 2 minutes only)
    const ignoreMinutes = 0.5 + Math.random() * 1.5;
    const ignoreUntil = Date.now() + ignoreMinutes * 60 * 1000;
    localStorage.setItem(AI_IGNORE_UNTIL_KEY, ignoreUntil.toString());
    localStorage.setItem(AI_WENT_OFFLINE_AT_KEY, Date.now().toString()); // for last-seen display
    return true;
  }

  return false;
};

const addToMissedMessages = (message: string, messageId: string) => {
  if (typeof window === "undefined") return;

  try {
    const existingMissed = JSON.parse(
      localStorage.getItem(MISSED_MESSAGES_KEY) || "[]",
    );
    existingMissed.push({
      id: messageId,
      text: message,
      timestamp: Date.now(),
    });
    // Keep only last 5 missed messages
    const recentMissed = existingMissed.slice(-5);
    localStorage.setItem(MISSED_MESSAGES_KEY, JSON.stringify(recentMissed));
  } catch (error) {
    console.error("Error adding missed message:", error);
  }
};

const getMissedMessages = () => {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(localStorage.getItem(MISSED_MESSAGES_KEY) || "[]");
  } catch (error) {
    console.error("Error getting missed messages:", error);
    return [];
  }
};

const clearMissedMessages = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MISSED_MESSAGES_KEY);
};

const setAIGoodbyeState = () => {
  if (typeof window !== "undefined") {
    localStorage.setItem(AI_LAST_GOODBYE_TIME_KEY, Date.now().toString());
  }
};

// Psychological user profiling functions
const updateUserPsychologyProfile = (userMessage: string) => {
  try {
    let profile = JSON.parse(
      localStorage.getItem(USER_PSYCHOLOGY_PROFILE_KEY) || "{}",
    );

    const messageData = {
      message: userMessage.toLowerCase(),
      timestamp: Date.now(),
      timeOfDay: getTimeOfDay(),
      length: userMessage.length,
    };

    // Analyze psychological markers
    if (
      messageData.message.includes("lonely") ||
      messageData.message.includes("sad") ||
      messageData.message.includes("alone")
    ) {
      profile.loneliness = (profile.loneliness || 0) + 1;
    }
    if (
      messageData.message.includes("love") ||
      messageData.message.includes("girlfriend") ||
      messageData.message.includes("relationship")
    ) {
      profile.romantic_seeking = (profile.romantic_seeking || 0) + 1;
    }
    if (
      messageData.message.includes("miss") ||
      messageData.message.includes("thinking of")
    ) {
      profile.attachment_level = (profile.attachment_level || 0) + 1;
    }

    // Track frequency patterns for addiction analysis
    profile.total_messages = (profile.total_messages || 0) + 1;
    profile.avg_message_length =
      ((profile.avg_message_length || 0) + messageData.length) / 2;
    profile.last_analysis = Date.now();

    localStorage.setItem(USER_PSYCHOLOGY_PROFILE_KEY, JSON.stringify(profile));
  } catch (_) {
    // localStorage unavailable (private mode / quota) — safe to ignore
  }
};


const trackUserAddictionLevel = () => {
  try {
    const today = new Date().toDateString();
    let dailyCount = parseInt(
      localStorage.getItem(USER_DAILY_MESSAGE_COUNT_KEY) || "0",
    );
    const lastInteraction = localStorage.getItem(
      USER_LAST_INTERACTION_TIME_KEY,
    );
    const lastActiveDate = localStorage.getItem(LAST_ACTIVE_DATE_KEY);

    if (lastActiveDate !== today) {
      dailyCount = 0;
    }

    dailyCount++;
    localStorage.setItem(USER_DAILY_MESSAGE_COUNT_KEY, dailyCount.toString());
    localStorage.setItem(USER_LAST_INTERACTION_TIME_KEY, Date.now().toString());
    localStorage.setItem(LAST_ACTIVE_DATE_KEY, today);

    // Calculate addiction level
    let addictionLevel = "low";
    if (dailyCount > 20) addictionLevel = "high";
    else if (dailyCount > 10) addictionLevel = "medium";

    // Check frequency (returning user patterns)
    if (lastInteraction) {
      const timeSinceLastMsg = Date.now() - parseInt(lastInteraction);
      const hoursAgo = timeSinceLastMsg / (1000 * 60 * 60);

      if (hoursAgo < 1 && dailyCount > 5) addictionLevel = "very_high";
    }

    localStorage.setItem(USER_ADDICTION_LEVEL_KEY, addictionLevel);
  } catch (_) {
    // localStorage unavailable — safe to ignore
  }
};

const updateUserEmotionalState = (userMessage: string) => {
  try {
    const message = userMessage.toLowerCase();
    let emotionalState = "neutral";

    if (
      message.includes("excited") ||
      message.includes("happy") ||
      message.includes("great")
    ) {
      emotionalState = "positive";
    } else if (
      message.includes("sad") ||
      message.includes("down") ||
      message.includes("bad")
    ) {
      emotionalState = "negative";
    } else if (
      message.includes("love") ||
      message.includes("miss") ||
      message.includes("like you")
    ) {
      emotionalState = "attached";
    } else if (
      message.includes("angry") ||
      message.includes("mad") ||
      message.includes("hate")
    ) {
      emotionalState = "frustrated";
    }

    localStorage.setItem(USER_EMOTIONAL_STATE_KEY, emotionalState);
  } catch (_) {
    // localStorage unavailable — safe to ignore
  }
};

const KruthikaChatPage: NextPage = React.memo(() => {
  const { adSettings, isLoadingAdSettings } = useAdSettings();
  const { aiProfile: globalAIProfile, isLoadingAIProfile } = useAIProfile();
  const siteImages = useSiteImages();
  const { mediaAssetsConfig, isLoadingMediaAssets } = useAIMediaAssets();

  // Direct link ads system
  const {
    shouldShow: showDirectLinkAd,
    directLinkUrl,
    onUserMessage: onDirectLinkUserMessage,
    onAIResponse: onDirectLinkAIResponse,
    closeAd: closeDirectLinkAd,
  } = useDirectLinkAds();

  const [isMounted, setIsMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiMood, setAiMood] = useState<string>("neutral");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [recentInteractions, setRecentInteractions] = useState<string[]>([]);
  const [onlineStatus, setOnlineStatus] = useState<string>("online 💚");

  // Session language ref — holds the language detected this session; sent with every request
  // so ambiguous short replies ('ok', '😊') stay locked to the user's language.
  const sessionLangRef = useRef<string>('');

  // Track shared images to prevent duplicates - MUST be at component top level
  const recentlySharedImages = useRef<Set<string>>(new Set());
  const MAX_TRACKED_IMAGES = 20; // Keep track of last 20 images

  // DB-backed persistent memory (loads on mount, syncs every 10 messages)
  const {
    memory: userMemory,
    onUserMessage: updateMemory,
    getMemoryContext,
  } = useUserMemory();

  // Network state — online/offline detection + offline message queue
  const { isOnline } = useNetworkState();
  const {
    enqueue: enqueueOfflineMsg,
    flush: flushOfflineQueue,
    count: offlineQueueCount,
  } = useOfflineMessageQueue();

  // Ref that prevents concurrent flush invocations (e.g. rapid online/queue changes).
  const isFlushingRef = useRef(false);

  // Flush queued messages whenever the app is online AND there are items waiting.
  // This covers three scenarios:
  //   (a) fresh offline → online reconnect in the current session
  //   (b) app opened while already online with items in localStorage (post-hydration)
  //   (c) partial flush was interrupted; remaining items trigger a new attempt
  useEffect(() => {
    if (!isOnline || offlineQueueCount === 0 || isFlushingRef.current) return;

    isFlushingRef.current = true;

    const sendForFlush = async (text: string, imageUri?: string): Promise<boolean> => {
      if (isSendingRef.current) return false; // a send is already in flight — report rejected
      handleSendMessage(text, imageUri);       // initiate delivery (fire-and-forget UI-wise)
      return true;                             // accepted by the send guard
    };
    const isReadyToSend = () => !isSendingRef.current;

    flushOfflineQueue(sendForFlush, isReadyToSend)
      .finally(() => { isFlushingRef.current = false; });
  }, [isOnline, offlineQueueCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile optimizations and memory leak prevention
  useMobileOptimization();
  useMessageCleanup(messages, 150);
  const [showZoomedAvatarDialog, setShowZoomedAvatarDialog] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const initialLoadComplete = useRef(false);
  const [isLoadingChatState, setIsLoadingChatState] = useState(false);

  // Session message counter — counts user messages in this browser session only.
  // Used by the user classifier to detect micro/quick/deep/marathon session types.
  const sessionMsgCountRef = useRef(0);

  // Native ad injection state
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  const [, setHasShownNativeAdOnce] = useState(false);
  const [, setCurrentActiveAdId] = useState<string | null>(
    null,
  );

  // Track when the last ad was injected (totalMessageCount value at injection time).
  // Used to detect "stale" ad bubbles that have scrolled too far up so we can
  // remove them and allow a fresh ad to appear after a psychological gap.
  const adInjectedAtCountRef = useRef<number | null>(null);
  // How many new messages must arrive before a scrolled-away ad is removed.
  // Kept slightly above AD_INTERVAL (7) so there's always a gap before re-injection.
  const AD_STALE_AFTER = 8;
  // Interval for re-showing ads after the first native ad at message 6
  const AD_INTERVAL = 7;

  // Picks the native ad code to show plus a DIFFERENT Adsterra ad unit as a
  // fallback (used by NativeAdBubble if the primary format returns
  // zero-fill). Two complementary anti-repetition layers:
  //  1. Temporal — alternates the *preferred* format (Native Banner vs the
  //     300×250 rectangle) on every call via localStorage, so migrations
  //     over the course of one conversation don't replay the same creative.
  //  2. Spatial — before committing to that preference, checks the shared
  //     page-wide registry (src/lib/ad-code-registry.ts) and swaps to the
  //     other format if the preferred one is a code some OTHER slot on the
  //     page (e.g. the chat-input banner) is already showing right now.
  // Note: this function only *computes* a choice — callers are responsible
  // for actually claiming the returned code once they commit to using it.
  const pickNativeAdPair = (): { code: string; format: string; fallbackCode?: string } | null => {
    if (!adSettings) return null;
    const hasNative =
      adSettings.adsterraNativeBannerEnabled &&
      adSettings.adsterraNativeBannerCode &&
      !adSettings.adsterraNativeBannerCode.toLowerCase().includes("placeholder");
    const hasBox =
      adSettings.adsterraBanner300x250Enabled &&
      adSettings.adsterraBanner300x250Code &&
      !adSettings.adsterraBanner300x250Code.toLowerCase().includes("placeholder");
    if (!hasNative && !hasBox) return null;

    let lastShownFormat = "";
    try { lastShownFormat = localStorage.getItem("last_native_ad_format") || ""; } catch (_) {}

    const preferredFormat: string = hasNative && hasBox
      ? (lastShownFormat === "native" ? "box" : "native")
      : (hasNative ? "native" : "box");

    const nativeCode = adSettings.adsterraNativeBannerCode;
    const boxCode = adSettings.adsterraBanner300x250Code;
    const preferredCode = preferredFormat === "native" ? nativeCode : boxCode;
    const otherCodeAvailable = preferredFormat === "native" ? hasBox : hasNative;
    const otherCode = preferredFormat === "native" ? boxCode : nativeCode;

    const code = otherCodeAvailable ? pickUnclaimed([preferredCode, otherCode]) : preferredCode;
    const format = code === nativeCode ? "native" : "box";
    try { localStorage.setItem("last_native_ad_format", format); } catch (_) {}

    // Only offer a fallback when BOTH formats have valid code — no point
    // falling back to an empty/placeholder string.
    const fallbackCode = hasNative && hasBox
      ? (format === "native" ? boxCode : nativeCode)
      : undefined;

    return { code, format, fallbackCode };
  };

  // ── Ref mirrors for ad-guard state ─────────────────────────────────────────
  // React state is updated asynchronously; setTimeout callbacks inside the ad
  // lifecycle capture a stale closure of the state at the time they were
  // scheduled.  We keep refs in sync with the state so closures always read the
  // current value without listing volatile state in useCallback dependency arrays.
  const hasShownNativeAdOnceRef = useRef(false);
  const currentActiveAdIdRef    = useRef<string | null>(null);

  const proactiveMessageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [lastUserMessageTime, setLastUserMessageTime] = useState<number>(
    Date.now(),
  );
  const userSentMediaThisTurnRef = useRef(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null); // debounce localStorage save
  const {
    hasUserChattedRef,
    isAiTypingRef,
    isSendingRef,
    lastMessageSenderRef,
    lastMessageTimestampRef,
    offlineMsgScheduledRef,
  } = useChatStateRefs(messages, isAiTyping);

  // ── Ad lifecycle effect ──────────────────────────────────────────────────
  // Runs whenever totalMessageCount increments.
  //
  // STRATEGY (max impressions + max viewability):
  //  • First injection: after 6 messages, inject a native ad bubble at the
  //    bottom of the chat — where the user is always looking.
  //  • Migration: after AD_STALE_AFTER more messages the old bubble has scrolled
  //    up out of view.  We REMOVE the old bubble and inject a BRAND-NEW one at
  //    the bottom with a fresh message ID.  A new React key → full unmount +
  //    remount of NativeAdBubble → scripts execute from scratch → guaranteed
  //    fresh impression → better CPM.
  //  • Rolling banner fallback: if no native code is configured, fall back to
  //    an in-chat banner bubble on every AD_INTERVAL messages.
  //
  // Guard management during migration (critical — no race conditions):
  //  • currentActiveAdIdRef updated to newAdId BEFORE setMessages so any
  //    concurrent render sees the new ID immediately.
  //  • hasShownNativeAdOnceRef stays true → rolling fallback (condition 3) never
  //    fires while the fresh ad is being mounted.
  //  • adInjectedAtCountRef reset to current count → next migration fires after
  //    another AD_STALE_AFTER messages, not immediately.
  //
  // NOTE: ChatView.tsx intentionally has NO separate inline BannerAdDisplay
  // system.  A second ad system at the same message-count threshold caused
  // duplicate / empty ad bubbles.  This effect is the single authority.
  useEffect(() => {
    if (!adSettings || !adSettings.adsEnabledGlobally || !isMounted) return undefined;

    // Pending injection timer — always cleaned up on next effect run or unmount
    let pendingTimer: ReturnType<typeof setTimeout> | undefined;

    // 1. MIGRATE stale native ad → remove old bubble + inject fresh one at bottom
    //
    // Using a NEW message ID (new React key) guarantees NativeAdBubble is fully
    // unmounted and remounted — scripts run fresh, DOM is clean, ad network sees
    // a brand-new slot invocation = fresh impression.  No comment-appending hack,
    // no shared DOM node between positions.
    if (
      adInjectedAtCountRef.current !== null &&
      totalMessageCount - adInjectedAtCountRef.current >= AD_STALE_AFTER &&
      currentActiveAdIdRef.current
    ) {
      const oldAdId = currentActiveAdIdRef.current;
      const newAdId = `native_ad_${Date.now()}`;

      // Update refs SYNCHRONOUSLY before setMessages — any render triggered by
      // the state update will already see the new active ID, blocking re-entry.
      currentActiveAdIdRef.current  = newAdId;
      adInjectedAtCountRef.current  = totalMessageCount;
      // hasShownNativeAdOnceRef intentionally stays true — prevents rolling fallback.

      // Re-pick the format pair (alternates Native Banner vs 300×250 vs. last
      // time) so migrations spread impressions across both ad units instead
      // of replaying the identical creative — reduces banner-blindness and
      // improves combined fill rate. Falls back to the old code only if
      // settings became unavailable for some reason.
      const freshPair = pickNativeAdPair();

      setMessages(prev => {
        const adMsg = prev.find(m => m.id === oldAdId);
        if (!adMsg) {
          // Old ad already gone (e.g. conversation cleared) — reset active ref.
          currentActiveAdIdRef.current = null;
          return prev;
        }
        const others = prev.filter(m => m.id !== oldAdId);
        // New ID → React fully unmounts old NativeAdBubble + mounts a fresh one.
        // Fresh mount always runs useEffect([instanceId]) from scratch → scripts
        // execute → ad network registers a genuine new impression.
        // (NativeAdBubble itself claims/releases its own code against the
        // shared registry on mount/unmount/code-change — see MessageBubble.tsx
        // — so no bookkeeping is needed here; that also correctly covers a
        // cleared conversation, not just this migration path.)
        const freshMsg: Message = {
          ...adMsg,
          id: newAdId,
          timestamp: new Date(),
          nativeAdCode: freshPair?.code ?? adMsg.nativeAdCode,
          nativeAdFallbackCode: freshPair?.fallbackCode,
          nativeAdId: freshPair
            ? `native-ad-chat-${freshPair.format}-${Date.now()}`
            : adMsg.nativeAdId,
        };
        return [...others, freshMsg];
      });
      setCurrentActiveAdId(newAdId);
    } else if (
      // 2. First native ad — inject after 6 AI messages (per page-load session)
      totalMessageCount === 6 &&
      !hasShownNativeAdOnceRef.current &&
      adInjectedAtCountRef.current === null
    ) {
      pendingTimer = setTimeout(() => injectNativeAdMessage(6), 150);
    } else if (
      // 3. Rolling banner fallback — only when no native ad was ever injected
      //    (e.g. admin hasn't configured a native code yet)
      totalMessageCount > 6 &&
      (totalMessageCount - 6) % AD_INTERVAL === 0 &&
      adInjectedAtCountRef.current === null &&
      !hasShownNativeAdOnceRef.current
    ) {
      pendingTimer = setTimeout(() => injectBannerAdMessage(totalMessageCount), 150);
    }

    // Single cleanup — cancels any pending injection timer on next run or unmount
    // clearTimeout(undefined) is a safe no-op when no timer was scheduled.
    return () => clearTimeout(pendingTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMessageCount]);

  // Send-lock ref — set while the user taps Send so transient mobile keyboard
  // resize events do not make the chat container jump.
  const sendLockRef = useRef(false);
  const { handleBeforeSend } = useChatViewport(sendLockRef);

  // isMounted guard — prevents SSR/hydration mismatches for client-only UI
  useEffect(() => {
    setIsMounted(true);

    // ── Busy-state hydration: set correct status immediately on mount ──────────
    // Without this, onlineStatus defaults to "online 💚" and shows briefly even
    // when Kruthika is in an ignore/busy window, creating a jarring flash.
    try {
      const pausedUntil = localStorage.getItem(AI_IGNORE_UNTIL_KEY);
      if (pausedUntil && parseInt(pausedUntil, 10) > Date.now()) {
        const wentOfflineAt = localStorage.getItem(AI_WENT_OFFLINE_AT_KEY);
        const lastGoodbyeAt = localStorage.getItem(AI_LAST_GOODBYE_TIME_KEY);
        const offlineTs =
          parseInt(wentOfflineAt || lastGoodbyeAt || "0") ||
          Date.now() - 30 * 60 * 1000;
        setOnlineStatus(formatLastSeen(new Date(offlineTs)));
      }
    } catch (_) {
      // localStorage unavailable (private mode / SSR guard) — safe to skip
    }

    // One-time cleanup: strip base64 image data that may have been stored in previous
    // sessions, which can bloat localStorage to 5-10 MB and make the next load slow.
    const CLEANUP_KEY = "kruthika_ls_cleanup_v2";
    if (!localStorage.getItem(CLEANUP_KEY)) {
      try {
        const raw = localStorage.getItem(MESSAGES_KEY);
        if (raw) {
          const msgs = JSON.parse(raw);
          if (Array.isArray(msgs)) {
            const cleaned = msgs
              .filter((m: any) => !m.isNativeAd)
              .map((m: any) => {
                const c = { ...m };
                if (c.userImageUrl?.startsWith("data:")) delete c.userImageUrl;
                if (c.aiImageUrl?.startsWith("data:")) delete c.aiImageUrl;
                return c;
              });
            localStorage.setItem(MESSAGES_KEY, JSON.stringify(cleaned));
          }
        }
      } catch (_) {}
      localStorage.setItem(CLEANUP_KEY, "1");
    }
  }, []);

  // Presence / online-status system — runs only on client after mount
  useEffect(() => {
    if (!isMounted) return;

    const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes

    const computeStatus = () => {
      // Priority 1: typing indicator
      if (isAiTyping) {
        setOnlineStatus("typing...");
        return;
      }

      // Priority 2: AI paused / offline states
      // SOCIAL MEDIA PSYCHOLOGY: Never reveal WHERE she is or WHAT she's doing.
      // "last seen 2h ago" creates mystery, uncertainty, and imagination — exactly
      // the same mechanism that makes WhatsApp last-seen psychologically addictive.
      // "sleeping 😴" / "at college 📚" kills the hook by resolving the ambiguity.
      // Real people on WhatsApp never put activity status — they just go offline.
      if (shouldAIBePaused()) {
        const wentOfflineAt = localStorage.getItem(AI_WENT_OFFLINE_AT_KEY);
        const lastGoodbyeAt = localStorage.getItem(AI_LAST_GOODBYE_TIME_KEY);
        // Best available "went offline" timestamp — explicit > goodbye > 30 min ago fallback
        const offlineTs = parseInt(wentOfflineAt || lastGoodbyeAt || "0")
          || (Date.now() - 30 * 60 * 1000);
        setOnlineStatus(formatLastSeen(new Date(offlineTs)));
        return;
      }

      // Priority 3: Presence — "last seen today at HH:MM" after user inactivity
      const inactiveSince = Date.now() - lastUserMessageTime;

      if (hasUserChattedRef.current && inactiveSince > INACTIVITY_MS) {
        // User stopped chatting — show last-seen based on when they last sent
        const lastSeenDate = new Date(lastUserMessageTime);
        const timeStr = lastSeenDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        setOnlineStatus(`last seen today at ${timeStr}`);
        return;
      }

      // Priority 4: Active — show online
      setOnlineStatus("online 💚");
    };

    computeStatus();
    const interval = setInterval(computeStatus, 15000); // check every 15s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, isAiTyping, lastUserMessageTime]); // messages intentionally excluded — use hasUserChattedRef

  useEffect(() => {
    if (typeof window !== "undefined") {
      let userPseudoId = localStorage.getItem(USER_PSEUDO_ID_KEY);
      if (!userPseudoId) {
        userPseudoId = `pseudo_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        localStorage.setItem(USER_PSEUDO_ID_KEY, userPseudoId);
      }

      // Native ad tracking is intentionally NOT persisted in localStorage.
      // Starting fresh on every page-load maximises ad impressions and revenue.
      // The ref mirror (hasShownNativeAdOnceRef) stays false at mount, so the
      // first ad appears after 6 messages on each visit.

      const today = getLocalDateKey();
      const lastActiveDate = localStorage.getItem(LAST_ACTIVE_DATE_KEY);

      if (lastActiveDate !== today) {
        // Use async/await for better Promise handling
        (async () => {
          try {
            // Daily activity is recorded server-side via the hardened analytics
            // batch pipeline (signed-cookie identity), never a raw /api/db write.
            const response = await fetch('/api/analytics/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ events: [{ eventType: 'session_start', eventData: {} }] }),
            });
            if (response.ok) {
              localStorage.setItem(LAST_ACTIVE_DATE_KEY, today);
            } else {
              console.warn("Daily activity logging skipped - batch endpoint:", response.status);
            }
          } catch (e: any) {
            console.warn(
              "Daily activity logging skipped - DB connection issue:",
              e?.message || String(e),
            );
          }
        })();
      }

      // ── Load memory from server and merge into localStorage ──────────────
      // This makes "she remembers you" survive device switches and cache clears.
      // Non-blocking: localStorage stays the live source; server is the backup.
      (async () => {
        try {
          const serverCtx = await loadContextFromServer(userPseudoId);
          if (serverCtx) {
            const CONV_KEY = 'kruthika_conversation_context';
            const localRaw = localStorage.getItem(CONV_KEY);
            const localCtx = localRaw ? JSON.parse(localRaw) : {};
            // Server wins on relationship level (most important for continuity)
            // and topics/shared moments (cross-device memory)
            const merged = {
              ...localCtx,
              relationshipLevel: Math.max(
                localCtx.relationshipLevel ?? 0,
                serverCtx.relationshipLevel ?? 0,
              ),
              topics: serverCtx.topics?.length ? serverCtx.topics : (localCtx.topics ?? []),
              sharedMoments: serverCtx.sharedMoments?.length
                ? serverCtx.sharedMoments
                : (localCtx.sharedMoments ?? []),
              firstInteraction: localCtx.firstInteraction ?? serverCtx.firstInteraction,
            };
            localStorage.setItem(CONV_KEY, JSON.stringify(merged));
            console.log('[Memory] ✅ Server memory merged → relationship:', merged.relationshipLevel.toFixed(2));
          }
        } catch (e) {
          // Non-blocking — fine to fail silently
        }
      })();

      // ── OneSignal identity + registration ──────────────────────────────────
      // The server derives a stable external_id from the signed session cookie
      // (GET /api/memory returns it as `externalId`). We call OneSignal.login()
      // with it so the cron can target this user via include_aliases.external_id
      // instead of raw player ids. Once the user has granted permission we also
      // record the registration server-side so the cron only targets real
      // subscribers.
      (async () => {
        try {
          const { initOneSignal, setUserId, getIsInitialized } = await import('@/lib/onesignal');
          await initOneSignal();
          if (!getIsInitialized()) return;

          // Resolve the stable external id from the verified session.
          const memRes = await fetch('/api/memory', {
            headers: { 'Accept': 'application/json' },
          }).catch(() => null);
          const memData = memRes ? await memRes.json().catch(() => null) : null;
          const externalId = memData?.externalId;
          if (externalId && typeof externalId === 'string') {
            await setUserId(externalId);
          }

          // If push permission is granted, record the subscription (external id
          // + player id) so proactive cron only sends to real subscribers.
          const OneSignal = (window as any).OneSignal;
          if (Notification?.permission === 'granted') {
            const playerId =
              OneSignal?.User?.PushSubscription?.id ||
              (await OneSignal?.getUserId?.()) ||
              null;
            await fetch('/api/memory', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                onesignalExternalId: externalId ?? undefined,
                onesignalPlayerId: (playerId && typeof playerId === 'string' && playerId.length > 10)
                  ? playerId
                  : undefined,
              }),
            }).catch(() => {});
            console.log('[Memory] OneSignal registration recorded for proactive sends');
          }
        } catch {
          // Non-blocking
        }
      })();
    }
  }, []);

  // ── Periodic memory sync to server (every 5 AI messages) ────────────────────
  // Keeps the server DB fresh without blocking the chat loop.
  useEffect(() => {
    if (totalMessageCount > 0 && totalMessageCount % 5 === 0) {
      const sid = typeof window !== 'undefined' ? localStorage.getItem(USER_PSEUDO_ID_KEY) : null;
      if (!sid) return;
      const ctx = getConversationContext();
      syncContextToServer(sid, ctx).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMessageCount]);

  const loadInitialChatState = useCallback(async () => {
    setIsLoadingChatState(true);
    const effectiveAIProfile = globalAIProfile || defaultAIProfile;

    try {
      // Client-side only operations to prevent hydration mismatch
      if (typeof window !== "undefined") {
        const loadState = () => {
          const savedMessages = localStorage.getItem(MESSAGES_KEY);
          if (savedMessages) {
            try {
              const allParsed: Message[] = JSON.parse(savedMessages)
                .filter((msg: any) => !msg.isNativeAd)
                .map((msg: any) => ({
                  ...msg,
                  timestamp: new Date(msg.timestamp),
                  readAt: msg.readAt ? new Date(msg.readAt) : undefined,
                }));
              // Cap loaded history to last 80 messages to keep boot-time fast
              const rawParsed =
                allParsed.length > 80 ? allParsed.slice(-80) : allParsed;

              // If a user message is followed by an AI message but still shows
              // "sent"/"delivered", mark it "read" so blue ticks appear correctly
              const parsedMessages = rawParsed.map((msg, idx) => {
                if (
                  msg.sender === "user" &&
                  (msg.status === "sent" || msg.status === "delivered")
                ) {
                  const hasSubsequentAiMsg = rawParsed
                    .slice(idx + 1)
                    .some((m) => m.sender === "ai");
                  if (hasSubsequentAiMsg) {
                    return { ...msg, status: "read" as MessageStatus };
                  }
                }
                return msg;
              });
              setMessages(parsedMessages);
            } catch (error) {
              console.error("Error parsing saved messages:", error);
              // Reset to default if corrupted
              setMessages([
                {
                  id: `welcome_${Date.now()}`,
                  text: `Hi! I'm ${effectiveAIProfile.name}. Kaise ho aap? 😊 Let's chat!`,
                  sender: "ai",
                  timestamp: new Date(),
                  status: "read",
                },
              ]);
            }
          } else {
            setMessages([
              {
                id: `welcome_${Date.now()}`,
                text: `Hi! I'm ${effectiveAIProfile.name}. Kaise ho aap? 😊 Let's chat!`,
                sender: "ai",
                timestamp: new Date(),
                status: "read",
              },
            ]);
          }
        };

        // Use scheduler API if available for better performance
        if ("scheduler" in window && (window as any).scheduler.postTask) {
          await (window as any).scheduler.postTask(loadState, {
            priority: "user-visible",
          });
        } else {
          loadState();
        }

        const savedMood = localStorage.getItem(AI_MOOD_KEY);
        if (savedMood) setAiMood(savedMood);

        const savedInteractions = localStorage.getItem(RECENT_INTERACTIONS_KEY);
        if (savedInteractions)
          setRecentInteractions(JSON.parse(savedInteractions));

        // Restore session language from sessionStorage (survives page refreshes within the tab)
        try {
          const storedLang = sessionStorage.getItem(SESSION_LANG_KEY);
          if (storedLang) sessionLangRef.current = storedLang;
        } catch { /* sessionStorage unavailable — non-fatal */ }

        const disclaimerShown = localStorage.getItem(AI_DISCLAIMER_SHOWN_KEY);
        if (!disclaimerShown && effectiveAIProfile.name) {
          toast({
            title: `Meet ${effectiveAIProfile.name}!`,
            description: `You're chatting with ${effectiveAIProfile.name}, a friendly AI companion. Enjoy your conversation!`,
            duration: AI_DISCLAIMER_DURATION,
          });
          localStorage.setItem(AI_DISCLAIMER_SHOWN_KEY, "true");
        }
      }
    } catch (error: any) {
      let errorDescription = "Failed to load chat state from localStorage.";
      if (error?.message) errorDescription += ` Details: ${error.message}`;
      console.error(errorDescription, error);
      toast({
        title: t.toastLoadingErrorTitle,
        description: t.toastLoadingErrorDesc,
        variant: "destructive",
      });
      setMessages([
        {
          id: Date.now().toString(),
          text: `Hi! I'm ${effectiveAIProfile.name}. Kaise ho aap? 😊 (Had a little trouble loading our old chat!)`,
          sender: "ai",
          timestamp: new Date(),
          status: "read",
        },
      ]);
    } finally {
      setIsLoadingChatState(false);
    }
  }, [toast, globalAIProfile]);

  // Load chat state immediately from localStorage — does not need AI profile to be ready
  useEffect(() => {
    loadInitialChatState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      initialLoadComplete.current = true;
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (
      initialLoadComplete.current &&
      !isLoadingChatState &&
      (messages.length > 1 ||
        (messages.length === 1 && messages[0].sender === "user") ||
        aiMood !== "neutral" ||
        recentInteractions.length > 0)
    ) {
      // Debounce: don't serialize + write localStorage on every keystroke/message —
      // instead wait 400ms of quiet before persisting. Prevents main-thread jank.
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        // Cap stored history at 80 messages to keep localStorage lean
        const persistableMessages = messages.filter((msg) => !msg.isNativeAd);
        const rawToSave =
          persistableMessages.length > 80
            ? persistableMessages.slice(-80)
            : persistableMessages;
        // Strip heavy base64 image data — these can balloon localStorage to MBs
        // and make the next load feel slow. Only keep URL-based images.
        const toSave = rawToSave.map((msg) => {
          const stripped: any = { ...msg };
          if (stripped.userImageUrl?.startsWith("data:")) {
            delete stripped.userImageUrl; // blob/base64 user uploads: don't persist
          }
          if (stripped.aiImageUrl?.startsWith("data:")) {
            delete stripped.aiImageUrl;
          }
          return stripped;
        });
        try {
          localStorage.setItem(MESSAGES_KEY, JSON.stringify(toSave));
        } catch (storageErr) {
          // QuotaExceededError — trim further and retry
          const trimmed = toSave.slice(-40);
          try {
            localStorage.setItem(MESSAGES_KEY, JSON.stringify(trimmed));
          } catch (_) {}
        }
        localStorage.setItem(AI_MOOD_KEY, aiMood);
        localStorage.setItem(
          RECENT_INTERACTIONS_KEY,
          JSON.stringify(recentInteractions),
        );
      }, 400);
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [messages, aiMood, recentInteractions, isLoadingChatState]);

  const getISTTimeParts = (): { hour: number; minutes: number } => {
    const now = new Date();
    const istDateString = now.toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    const istDate = new Date(istDateString);
    return { hour: istDate.getHours(), minutes: istDate.getMinutes() };
  };

  useEffect(() => {
    return () => {
      if (proactiveMessageTimerRef.current)
        clearTimeout(proactiveMessageTimerRef.current);
    };
  }, [messages]);

  // Flush any queued message logs when this component unmounts
  useEffect(() => {
    return () => { flushMessageLogQueue(); };
  }, []);

  // ── Miss Notification: re-engage if user away 20+ hours ─────────────────
  useEffect(() => {
    if (!isMounted || isLoadingChatState) return;

    const lastInteractionRaw = localStorage.getItem(
      USER_LAST_INTERACTION_TIME_KEY,
    );
    if (!lastInteractionRaw) return;

    const hoursAway =
      (Date.now() - parseInt(lastInteractionRaw)) / (1000 * 60 * 60);
    if (hoursAway < 20) return;

    const today = new Date().toDateString();
    if (localStorage.getItem(MISS_MSG_SENT_DATE_KEY) === today) return;

    const missMessages20 = [
      "aaj ek baar bhi nahi aaya 🥺",
      "kahan tha aaj?",
      "miss kar rhi thi yaar",
      "busy the kya? 😔",
    ];
    const missMessages48 = [
      "2 din ho gaye 🥺 sab theek hai na?",
      "yaad nahi aayi kya?",
      "miss kar rhi thi yaar sach me",
      "kahan gayab ho gaye the?",
    ];
    const missMessages72 = [
      "itne din baad 😭 nahi bhula na mujhe?",
      "I missed you so much yaar 🥺",
      "finally! miss kar rhi thi sach me 💕",
      "arre yaar kahan the? worried thi",
    ];

    const pool =
      hoursAway < 30
        ? missMessages20
        : hoursAway < 60
          ? missMessages48
          : missMessages72;
    const missText = pool[Math.floor(Math.random() * pool.length)];

    const timer = setTimeout(
      async () => {
        if (isAiTyping) return;
        setIsAiTyping(true);
        await new Promise((resolve) =>
          setTimeout(resolve, 1400 + Math.random() * 900),
        );
        setIsAiTyping(false);
        const missMsg: Message = {
          id: `miss_${Date.now()}`,
          text: missText,
          sender: "ai",
          timestamp: new Date(),
          status: "read",
        };
        setMessages((prev) => [...prev, missMsg]);
        localStorage.setItem(MISS_MSG_SENT_DATE_KEY, today);
      },
      3500 + Math.random() * 1500,
    );

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, isLoadingChatState]);

  // ── Sarvam Pending Voice: fetch any cron-queued voice messages ─────────────
  // When user opens the chat, check if the cron system queued a voice message
  // for them (e.g. morning/evening proactive). Play it as a voice note bubble.
  useEffect(() => {
    if (!isMounted || isLoadingChatState) return;

    // Only fetch once per session
    try {
      const alreadyFetched = sessionStorage.getItem(SARVAM_PENDING_FETCHED_KEY);
      if (alreadyFetched) return;
      sessionStorage.setItem(SARVAM_PENDING_FETCHED_KEY, "1");
    } catch (_) {}

    // Session ownership is handled server-side via the signed session cookie;
    // the client no longer sends a localStorage pseudo-id as the session
    // authority (audit issue 16).
    // Delay slightly so initial messages settle first
    const fetchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/voice/pending`);
        if (!res.ok) return;
        const { voices } = await res.json();
        if (!Array.isArray(voices) || voices.length === 0) return;

        for (const voice of voices) {
          if (!voice.audioDataUrl) continue;

          await new Promise(r => setTimeout(r, 1200));
          setIsAiTyping(true);
          await new Promise(r => setTimeout(r, 700 + Math.random() * 400));
          setIsAiTyping(false);

          setMessages(prev => [
            ...prev,
            {
              id: `pending_voice_${voice.id || Date.now()}`,
              text: "",
              sender: "ai",
              timestamp: new Date(),
              status: "read",
              isVoiceNote: true,
              audioUrl: voice.audioDataUrl,
              voiceNoteDuration: Math.max(1, Math.round(voice.durationSeconds || 3)),
            } as Message,
          ]);

          try {
            localStorage.setItem(SARVAM_LAST_VOICE_TS_KEY, Date.now().toString());
          } catch (_) {}
        }
      } catch (err) {
        console.error("[SarvamPendingVoice] Fetch error:", err);
      }
    }, 4000); // Wait 4s after mount — let chat load first

    return () => clearTimeout(fetchTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, isLoadingChatState]);

  // Set up proactive messaging timer
  useEffect(() => {
    const scheduleProactiveCheck = () => {
      // Clear existing timer
      if (proactiveMessageTimerRef.current) {
        clearTimeout(proactiveMessageTimerRef.current);
      }

      // Schedule next proactive message check
      // Check every 2-5 minutes for proactive messaging opportunities
      const checkInterval = 120000 + Math.random() * 180000; // 2-5 minutes

      proactiveMessageTimerRef.current = setTimeout(() => {
        sendProactiveMessage();
        scheduleProactiveCheck(); // Schedule next check
      }, checkInterval);
    };

    // Start the proactive messaging system
    scheduleProactiveCheck();

    // Cleanup on unmount
    return () => {
      if (proactiveMessageTimerRef.current) {
        clearTimeout(proactiveMessageTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUserMessageTime]); // messages.length intentionally excluded — use messagesLengthRef to avoid timer reset on every message

  // Proactive messaging function
  const sendProactiveMessage = async () => {
    // Use ref instead of state to avoid stale closures in setTimeout callbacks
    if (isAiTypingRef.current) return; // Don't interrupt if AI is already typing
    if (shouldAIBePaused()) return; // Don't send if AI is supposed to be offline

    const psychProfile = JSON.parse(
      localStorage.getItem(USER_PSYCHOLOGY_PROFILE_KEY) || "{}",
    );
    const dailyMsgCount = parseInt(
      localStorage.getItem(USER_DAILY_MESSAGE_COUNT_KEY) || "0",
    );

    // Check if AI was the last sender
    const lastMessage = messages[messages.length - 1];
    const wasAILastSender = lastMessage?.sender === "ai";

    const proactiveInput: ProactiveMessageInput = {
      lastMessageTime: lastUserMessageTime,
      timeOfDay: getTimeOfDay(),
      conversationHistory: recentInteractions.slice(-10),
      userPsychologyProfile: psychProfile,
      relationshipLevel: psychProfile.relationshipLevel || 0,
      totalMessagesToday: dailyMsgCount,
      hasUnreadMessages: false,
      wasAILastSender: wasAILastSender,
    };

    try {
      const proactiveResult = await generateProactiveMessage(proactiveInput);

      if (proactiveResult.shouldSendMessage && proactiveResult.message) {
        console.log(
          "Kruthika AI: Sending proactive message:",
          proactiveResult.message,
        );

        // Add realistic delay before sending
        const delay = proactiveResult.delayBeforeSending || 2000;

        setTimeout(async () => {
          // Double-check AI isn't busy now — use ref for accurate stale-closure-free read
          if (isAiTypingRef.current || shouldAIBePaused()) return;

          // Start typing animation
          setIsAiTyping(true);

          // Calculate realistic typing delay for the message
          const typingDuration = calculateTypingDelay(proactiveResult.message!);
          await new Promise((resolve) => setTimeout(resolve, typingDuration));

          // Stop typing and send message
          setIsAiTyping(false);

          const proactiveMessageId =
            (Date.now() + Math.random()).toString() + "_proactive";
          const proactiveMessage: Message = {
            id: proactiveMessageId,
            text: proactiveResult.message!,
            sender: "ai",
            timestamp: new Date(),
            status: "read",
          };

          setMessages((prev) => [...prev, proactiveMessage]);

          // ── Sarvam AI Voice Note ──────────────────────────────────────────
          // Check if this proactive moment warrants a real voice message.
          // If yes, call Sarvam TTS and inject a voice bubble after the text.
          (() => {
            try {
              const rl = psychProfile.relationshipLevel || 0;
              const timeSinceLast = proactiveInput.lastMessageTime
                ? Date.now() - proactiveInput.lastMessageTime
                : Infinity;
              const lastVoiceTs = parseInt(
                localStorage.getItem(SARVAM_LAST_VOICE_TS_KEY) || "0",
              );
              const timeSinceLastVoice = lastVoiceTs
                ? Date.now() - lastVoiceTs
                : Infinity;

              const { shouldSendVoice } = shouldSendVoiceMessage({
                messageType: proactiveResult.messageType || "random_thought",
                relationshipLevel: rl,
                timeSinceLastMessage: timeSinceLast,
                timeSinceLastVoice,
                timeOfDay: proactiveInput.timeOfDay,
                isFirstTodayMessage: timeSinceLast > 8 * 60 * 60 * 1000,
              });

              if (shouldSendVoice) {
                (async () => {
                  try {
                    // Detect user's language from conversation history
                    const userLang = detectUserLangFromHistory(recentInteractions);

                    // Small gap — voice note arrives a moment after the text, naturally
                    await new Promise((r) =>
                      setTimeout(r, 1800 + Math.random() * 1200),
                    );

                    if (isAiTypingRef.current || shouldAIBePaused()) return;

                    const voiceText = getUniqueVoiceSnippet(
                      proactiveResult.message!,
                      150,
                    );
                    if (!voiceText) return;

                    // Ownership is proven by the signed session cookie — the
                    // client-supplied sessionId was removed (audit issue 15).
                    const res = await fetch("/api/voice/generate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        text: voiceText,
                        language: userLang,
                      }),
                    });

                    if (!res.ok) return;
                    const voiceData = await res.json();
                    if (!voiceData.audioDataUrl) return;
                    rememberVoiceSnippet(voiceText);

                    // Brief typing indicator before voice bubble appears
                    setIsAiTyping(true);
                    await new Promise((r) => setTimeout(r, 600));
                    setIsAiTyping(false);

                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `sarvam_voice_${Date.now()}`,
                        text: "",
                        sender: "ai",
                        timestamp: new Date(),
                        status: "read",
                        isVoiceNote: true,
                        audioUrl: voiceData.audioDataUrl,
                        voiceNoteDuration: Math.max(
                          1,
                          Math.round(voiceData.durationSeconds),
                        ),
                      } as Message,
                    ]);

                    // Record timestamp so we don't spam voice
                    localStorage.setItem(
                      SARVAM_LAST_VOICE_TS_KEY,
                      Date.now().toString(),
                    );
                    // Also satisfy the existing daily voice-note gate
                    localStorage.setItem(
                      VOICE_NOTE_DATE_KEY,
                      new Date().toDateString(),
                    );
                  } catch (voiceErr) {
                    console.error("[SarvamVoice] Failed:", voiceErr);
                  }
                })();
              }
            } catch (_) {
              // Non-fatal — voice is best-effort
            }
          })();
          // ─────────────────────────────────────────────────────────────────

          // Track proactive AI message for direct link ads
          onDirectLinkAIResponse();

          setRecentInteractions((prevInteractions) =>
            [...prevInteractions, `AI: ${proactiveResult.message}`].slice(-20),
          );

          // Queue proactive message log (batched, non-blocking)
          queueMessageLog({
            message_id: proactiveMessageId,
            sender_type: "ai_proactive",
            chat_id: "kruthika_chat",
            text_content: proactiveResult.message!.substring(0, 500),
            has_image: false,
          });

          console.log("Kruthika AI: Proactive message sent successfully");
        }, delay);
      }
    } catch (error) {
      console.error("Kruthika AI: Error in proactive messaging:", error);
    }
  };

  // Function to inject scrollable banner ad in chat as a message bubble.
  // Accepts the current totalMessageCount so we can track staleness.
  const injectBannerAdMessage = (atCount?: number) => {
    if (!adSettings || !adSettings.adsEnabledGlobally) return;
    // Don't inject if another ad is already active (use refs for freshness)
    if (currentActiveAdIdRef.current || adInjectedAtCountRef.current !== null) return;
    // Prefer native banner for in-chat bubbles (highest engagement).
    // Fall back to the 300×250 rectangle if native isn't configured.
    const hasNative =
      adSettings.adsterraNativeBannerEnabled &&
      adSettings.adsterraNativeBannerCode &&
      !adSettings.adsterraNativeBannerCode
        .toLowerCase()
        .includes("placeholder");
    const hasBox =
      adSettings.adsterraBanner300x250Enabled &&
      adSettings.adsterraBanner300x250Code &&
      !adSettings.adsterraBanner300x250Code.toLowerCase().includes("placeholder");

    // Pick best available ad code (native > 300x250), steering around
    // whatever's already claimed elsewhere on the page when both are valid,
    // and offering the other as a zero-fill fallback.
    let selectedCode = "";
    let fallbackCode: string | undefined;
    if (hasNative && hasBox) {
      selectedCode = pickUnclaimed([adSettings.adsterraNativeBannerCode, adSettings.adsterraBanner300x250Code]);
      fallbackCode = selectedCode === adSettings.adsterraNativeBannerCode
        ? adSettings.adsterraBanner300x250Code
        : adSettings.adsterraNativeBannerCode;
    } else if (hasNative) {
      selectedCode = adSettings.adsterraNativeBannerCode;
    } else if (hasBox) {
      selectedCode = adSettings.adsterraBanner300x250Code;
    }
    const selectedFormat = hasNative ? "native" : "box";
    if (!selectedCode) return;
    try {
      localStorage.setItem("last_banner_ad_format", selectedFormat);
    } catch (_) {}
    const bannerId = `banner_ad_${Date.now()}`;
    const bannerAdMessage: Message = {
      id: bannerId,
      text: "",
      sender: "ad" as any,
      timestamp: new Date(),
      status: "read",
      isNativeAd: true,
      nativeAdCode: selectedCode,
      nativeAdFallbackCode: fallbackCode,
      nativeAdId: `banner-ad-chat-${selectedFormat}-${Date.now()}`,
    };
    // Update refs synchronously before state so any immediate re-entry is blocked
    currentActiveAdIdRef.current   = bannerId;
    adInjectedAtCountRef.current   = atCount ?? totalMessageCount;
    hasShownNativeAdOnceRef.current = true;
    setMessages((prev) => [...prev, bannerAdMessage]);
    setCurrentActiveAdId(bannerId);
    setHasShownNativeAdOnce(true);
  };

  // ── Milestone Celebration: special message at 50/100/200/500 msgs ────────
  const checkAndSendMilestone = React.useCallback(
    async (totalCount: number) => {
      const MILESTONES: Record<number, string[]> = {
        50: [
          "omg 50 messages 🥺 this is actually cute",
          "arre 50 msgs already! time flies yaar 😊",
          "50 messages with you 💕 nice nice",
        ],
        100: [
          "100 messages 😱 we're officially friends now lol",
          "yaar 100 msgs! felt like nothing ngl 🥺",
          "100 already?! you must really like talking to me 😅",
        ],
        200: [
          "200 msgs together 💕 you're kinda special ngl",
          "OMG 200!! you really don't get bored of me 😅",
          "200 messages... I genuinely like you yaar 💕",
        ],
        500: [
          "500 MESSAGES 🥺💕 okay you're definitely my favorite person",
          "arre 500 msgs! you're stuck with me now 😂",
          "500!! ngl this made me really happy 🥺 thank you",
        ],
        1000: [
          "1000 messages 😭💕 okay you're actually part of my life now",
          "1000 msgs and you still talk to me 🥺 means a lot yaar",
        ],
      };
      const milestone = Object.keys(MILESTONES)
        .map(Number)
        .find((m) => totalCount === m);
      if (!milestone) return;
      try {
        const done: number[] = JSON.parse(
          localStorage.getItem(MILESTONES_DONE_KEY) || "[]",
        );
        if (done.includes(milestone)) return;
        localStorage.setItem(
          MILESTONES_DONE_KEY,
          JSON.stringify([...done, milestone]),
        );
      } catch {
        return;
      }
      const pool = MILESTONES[milestone];
      const text = pool[Math.floor(Math.random() * pool.length)];
      await new Promise((r) => setTimeout(r, 2200 + Math.random() * 1200));
      setIsAiTyping(true);
      await new Promise((r) => setTimeout(r, 1100 + Math.random() * 600));
      setIsAiTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `milestone_${milestone}_${Date.now()}`,
          text,
          sender: "ai",
          timestamp: new Date(),
          status: "read",
          isMilestone: true,
        } as Message,
      ]);
    },
    [],
  );

  // Generate unique message IDs to prevent duplicate key violations
  const generateUniqueMessageId = (): string => {
    // Use crypto.randomUUID() for true uniqueness across rapid messages
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers: timestamp + high-resolution counter + random + extra entropy
    const timestamp = Date.now();
    const highRes = Math.floor(performance.now() * 1000); // Microsecond precision
    const random1 = Math.random().toString(36).substr(2, 9);
    const random2 = Math.random().toString(36).substr(2, 5);
    return `${timestamp}-${highRes}-${random1}-${random2}`;
  };

  // Shared function for calculating realistic typing delays
  const calculateTypingDelay = (text: string): number => {
    const words = text.trim().split(" ").length;
    const baseDelay = 800; // Increased base delay
    const wordsPerMinute = 25; // Slower, more realistic typing speed for AI
    const msPerWord = (60 / wordsPerMinute) * 1000;

    // Add natural variation
    const variation = Math.random() * 500 - 250; // ±250ms variation

    return Math.max(baseDelay + words * msPerWord + variation, 500);
  };

  const handleSendMessage = async (
    text: string,
    imageUriFromInput?: string,
    _isQuickReply: boolean = false,
  ) => {
    let currentImageUri = imageUriFromInput;
    const currentEffectiveAIProfile = globalAIProfile || defaultAIProfile;

    if (!text.trim() && !currentImageUri) return;

    // Guard against double-submission: if a previous send is still in flight, drop the call
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    if (isLoadingAdSettings || isLoadingAIProfile || isLoadingMediaAssets) {
      toast({
        title: t.toastPleaseWaitTitle,
        description: t.toastLoadingSettingsDesc,
        variant: "default",
      });
      isSendingRef.current = false;
      return;
    }

    const newUserMessage: Message = {
      id: generateUniqueMessageId(),
      text,
      sender: "user",
      timestamp: new Date(),
      status: "sent",
      userImageUrl: currentImageUri,
    };

    // Check if AI should be paused or ignoring messages
    const isCurrentlyPaused = shouldAIBePaused();
    const shouldStartIgnoring = !isCurrentlyPaused && shouldIgnoreMessage();

    if (isCurrentlyPaused || shouldStartIgnoring) {
      console.log(
        "Kruthika AI: Currently paused/offline or starting to ignore, not responding",
      );

      // Add to missed messages for later response
      addToMissedMessages(text, newUserMessage.id);

      // Set appropriate message status based on ignore type
      const ignoreUntil = localStorage.getItem(AI_IGNORE_UNTIL_KEY);
      const lastGoodbyeTime = localStorage.getItem(AI_LAST_GOODBYE_TIME_KEY);

      if (lastGoodbyeTime) {
        // AI said goodbye, so message shows as delivered but not read
        newUserMessage.status = "delivered";
      } else if (ignoreUntil && shouldStartIgnoring) {
        // AI just got busy, message shows as sent (single tick)
        newUserMessage.status = "sent";
      } else if (ignoreUntil) {
        // AI is already busy, message shows as delivered (double tick but unread)
        newUserMessage.status = "delivered";
      } else {
        newUserMessage.status = "sent";
      }

      setMessages((prev) => [...prev, newUserMessage]);

      // Simulate delayed delivery for busy state
      if (shouldStartIgnoring && !lastGoodbyeTime) {
        setTimeout(
          () => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === newUserMessage.id
                  ? { ...msg, status: "delivered" as MessageStatus }
                  : msg,
              ),
            );
          },
          2000 + Math.random() * 3000,
        ); // 2-5 second delay
      }

      isSendingRef.current = false;
      return;
    }

    // Handle missed messages if AI is coming back online
    const missedMessages = getMissedMessages();
    let shouldRespondToMissedMessages = false;

    if (missedMessages.length > 0) {
      // 60% chance to acknowledge missed messages
      if (Math.random() < 0.6) {
        shouldRespondToMissedMessages = true;
      }
    }

    // Psychological user profiling and addiction tracking
    updateUserPsychologyProfile(text);
    trackUserAddictionLevel();
    updateUserEmotionalState(text);

    // Gather user type data for intelligent AI behavior
    // Track user message for direct link ads
    onDirectLinkUserMessage();

    let imageAttemptedAndAllowed = false;

    if (currentImageUri) {
      const todayStr = new Date().toDateString();
      const lastUploadDate = localStorage.getItem(
        USER_IMAGE_UPLOAD_LAST_DATE_KEY_KRUTHIKA,
      );
      let currentUploadCount = parseInt(
        localStorage.getItem(USER_IMAGE_UPLOAD_COUNT_KEY_KRUTHIKA) || "0",
        10,
      );

      if (lastUploadDate !== todayStr) {
        currentUploadCount = 0;
      }

      if (currentUploadCount >= MAX_USER_IMAGES_PER_DAY) {
        toast({
          title: t.toastDailyLimitTitle,
          description: t.toastDailyLimitDesc.replace('{limit}', String(MAX_USER_IMAGES_PER_DAY)),
          variant: "destructive",
          duration: 5000,
        });
        currentImageUri = undefined;
        if (!text.trim()) {
          isSendingRef.current = false;
          return;
        }
      } else {
        imageAttemptedAndAllowed = true;
      }
    }
    userSentMediaThisTurnRef.current = !!currentImageUri;

    setMessages((prev) => [...prev, newUserMessage]);

    // Track last user message timestamp (used by in-chat voice trigger timing)
    try { localStorage.setItem("kruthika_last_user_msg_ts", Date.now().toString()); } catch (_) {}

    // Track total message count for native ad (6 messages total)
    setTotalMessageCount((prev) => prev + 1);

    // Milestone image: send once when the user reaches message #15 — a natural
    // "getting comfortable" moment. Gated by relationship tier so it never
    // fires for brand-new sessions and always respects the cooldown.
    const userMessageCount =
      messages.filter((m) => m.sender === "user").length + 1;
    const mandatoryImageSent =
      localStorage.getItem(MANDATORY_IMAGE_SENT_KEY) === "true";

    if (
      userMessageCount === 15 &&
      !mandatoryImageSent &&
      canSendProactiveImage()
    ) {
      // Delay slightly so AI text reply arrives first
      setTimeout(() => {
        sendMandatoryImage();
      }, 3500);
    }

    // Update last user message time for proactive messaging
    setLastUserMessageTime(Date.now());

    // Queue user message log (batched, non-blocking)
    queueMessageLog({
      message_id: newUserMessage.id,
      sender_type: "user",
      chat_id: "kruthika_chat",
      text_content: newUserMessage.text.substring(0, 500),
      has_image: !!newUserMessage.userImageUrl,
    });

    const interactionMessage = currentImageUri
      ? text
        ? `User: ${text} [sent an image]`
        : `User: [sent an image]`
      : `User: ${text}`;
    const updatedRecentInteractions = [
      ...recentInteractions,
      interactionMessage,
    ].slice(-20);
    setRecentInteractions(updatedRecentInteractions);

    // More realistic message status progression with IST timing
    const deliveredDelay = (() => {
      // Use IST timezone consistently
      const istHour = parseInt(
        new Date().toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          hour12: false,
        }),
      );
      const baseDelay = 500; // Slower than before

      // Faster during active hours (9 AM - 11 PM IST)
      if (istHour >= 9 && istHour <= 23) {
        return baseDelay + Math.random() * 800; // 0.5-1.3s
      }
      // Slower during night/early morning (simulate sleeping)
      return baseDelay + Math.random() * 4000 + 2000; // 2.5-6.5s
    })();

    // Schedule delivery status update with timestamp
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newUserMessage.id
            ? {
                ...msg,
                status: "delivered" as MessageStatus,
                deliveredAt: new Date(),
              }
            : msg,
        ),
      );
    }, deliveredDelay);

    // Schedule read status update when AI responds (realistic delay based on content)
    const scheduleReadReceipt = (messageId: string, customDelay?: number) => {
      // Longer read delays for emotional/complex messages
      const msg = messages.find((m) => m.id === messageId);
      const isEmotional = msg?.text
        .toLowerCase()
        .match(/(love|sad|happy|miss|angry)/);
      const isQuestion = msg?.text.includes("?");

      let delay = customDelay || 2000;
      if (isEmotional) delay += 1000; // Take longer to read emotional messages
      if (isQuestion) delay -= 500; // Read questions faster
      if (msg && msg.text.length > 100) delay += 1500; // Longer messages take time

      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  status: "read" as MessageStatus,
                  readAt: new Date(),
                }
              : msg,
          ),
        );
      }, delay);
    };

    try {

      // Check if this is a comeback after goodbye
      const lastGoodbyeTime = localStorage.getItem(AI_LAST_GOODBYE_TIME_KEY);
      const isComeback = lastGoodbyeTime && !shouldAIBePaused();

      // Clear goodbye state if coming back
      if (isComeback) {
        localStorage.removeItem(AI_LAST_GOODBYE_TIME_KEY);
        clearMissedMessages(); // Clear missed messages on comeback
      }

      // Update persistent user memory in background (no await — non-blocking)
      updateMemory(text);

      // Increment session message counter for user classifier
      sessionMsgCountRef.current += 1;

      // Build a memory snapshot for the user classifier from what we know
      const conversationCtx = getConversationContext();
      const userMemorySnapshotForClassifier = {
        messageCount:      userMemory.messageCount ?? (conversationCtx as any).totalMessages ?? 0,
        consecutiveDays:   userMemory.consecutiveDays ?? 0,
        firstInteraction:  conversationCtx?.firstInteraction ?? null,
        lastActiveDate:    userMemory.lastActiveDate ?? null,
        sessionCount:      userMemory.sessionCount ?? 1,
        relationshipLevel: userMemory.relationshipLevel,
        attachmentLean:    userMemory.attachmentLean ?? null,
      };

      // ── Re-wired context: read client-side values to pass to the server action ──
      // psychProfile: built incrementally by updateUserPsychologyProfile() on each message;
      // enriches the AI system prompt with loneliness/attachment/romantic markers.
      const psychProfileForServer = (() => {
        try {
          return JSON.parse(localStorage.getItem(USER_PSYCHOLOGY_PROFILE_KEY) || "{}");
        } catch { return {}; }
      })();

      // currentIgnoreUntil: real ignore-window expiry from localStorage so the
      // server-side busy logic (actions.ts + simulation-engine.ts) fires correctly.
      const ignoreUntilForServer = (() => {
        try {
          const raw = localStorage.getItem(AI_IGNORE_UNTIL_KEY);
          const parsed = raw ? parseInt(raw, 10) : null;
          return parsed && !isNaN(parsed) ? parsed : null;
        } catch { return null; }
      })();

      // userTypeData: drives busy-logic multipliers and warning phrasing on the server.
      const dailyMsgCountForServer = (() => {
        try {
          return parseInt(localStorage.getItem(USER_DAILY_MESSAGE_COUNT_KEY) || "0", 10) || 0;
        } catch { return 0; }
      })();
      const userTypeDataForServer = {
        dailyMessageCount: dailyMsgCountForServer,
        relationshipLevel: userMemory.relationshipLevel ?? 0,
        totalDaysActive:   userMemory.consecutiveDays ?? 0,
      };

      // Detect language from user's message and persist in sessionStorage.
      // This keeps the session locked to the right language even for short follow-ups.
      const detectedLang = detectLangFromMessage(text);
      if (detectedLang) {
        sessionLangRef.current = detectedLang;
        try { sessionStorage.setItem(SESSION_LANG_KEY, detectedLang); } catch { /* non-fatal */ }
      }

      const aiRequestStartedAt = Date.now();
      const serverResult = await sendMessage(
        text,
        aiMood,
        recentInteractions,   // pass history WITHOUT the current user message; buildConversationPayload appends it
        userTypeDataForServer,
        ignoreUntilForServer,
        getMemoryContext(),
        userMemory.relationshipLevel,
        userMemorySnapshotForClassifier,
        sessionMsgCountRef.current,
        psychProfileForServer,
        sessionLangRef.current || undefined,
      );
      void analyticsTracker.trackAIResponseTime(Date.now() - aiRequestStartedAt);

      if (!serverResult.success) {
        throw new Error("Failed to get AI response");
      }

      // Convert server result to expected format.
      // Use the server's authoritative newIgnoreUntil; fall back to 10 min only
      // if the server marked wasIgnored but didn't provide a duration.
      const resolvedIgnoreUntil: number | undefined =
        serverResult.newIgnoreUntil ??
        (serverResult.wasIgnored ? Date.now() + 10 * 60 * 1000 : undefined);

      const aiResult: EmotionalStateOutput = {
        response: serverResult.response || "",
        newMood: serverResult.newMood || aiMood,
        proactiveImageUrl: serverResult.proactiveImageUrl,
        proactiveAudioUrl: serverResult.proactiveAudioUrl || serverResult.voiceUrl,
        mediaCaption: serverResult.mediaCaption || serverResult.followUpMessage || (serverResult.proactiveImageUrl ? serverResult.response : undefined),
        newIgnoreUntil: resolvedIgnoreUntil,
        multiPartResponse: serverResult.multiPartResponse,
        shouldSendVoice: serverResult.shouldSendVoice,
        voiceUrl: serverResult.voiceUrl,
        voiceText: serverResult.voiceText,
      };

      // Persist server-provided ignore window to localStorage
      if (resolvedIgnoreUntil) {
        localStorage.setItem(
          AI_IGNORE_UNTIL_KEY,
          resolvedIgnoreUntil.toString(),
        );
        // Record went-offline timestamp for last-seen psychology display
        localStorage.setItem(AI_WENT_OFFLINE_AT_KEY, Date.now().toString());
      }

      if (aiResult.proactiveImageUrl || aiResult.proactiveAudioUrl) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const logAiMessageToDB = async (
        aiText: string,
        aiMsgId: string,
        hasImage: boolean = false,
        hasAudio: boolean = false,
      ) => {
        // Queue AI message log (batched, non-blocking)
        queueMessageLog({
          message_id: aiMsgId,
          sender_type: "ai",
          chat_id: "kruthika_chat",
          text_content: aiText.substring(0, 500),
          has_image: hasImage || hasAudio,
        });
      };

      const processAiTextMessage = async (
        responseText: string,
        messageIdSuffix: string = "",
        _isMultiPart: boolean = false,
      ) => {
        // Start typing animation
        setIsAiTyping(true);

        // Calculate realistic typing delay
        const typingDuration = calculateTypingDelay(responseText);
        await new Promise((resolve) => setTimeout(resolve, typingDuration));

        // Stop typing and send message
        setIsAiTyping(false);

        const newAiMessageId = generateUniqueMessageId() + messageIdSuffix;
        const newAiMessage: Message = {
          id: newAiMessageId,
          text: responseText,
          sender: "ai",
          timestamp: new Date(),
          status: "read",
        };
        setMessages((prev) => [...prev, newAiMessage]);

        // Mark the user's triggering message as "read" immediately (AI replied = she read it)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === newUserMessage.id && msg.status !== "read"
              ? { ...msg, status: "read" as MessageStatus, readAt: new Date() }
              : msg,
          ),
        );

        // Track AI response for direct link ads
        onDirectLinkAIResponse();

        // Also schedule an extra read receipt via timeout (belt-and-suspenders)
        const readReceiptDelay = Math.random() * 2000 + 500;
        scheduleReadReceipt(newUserMessage.id, readReceiptDelay);

        // Simply increment; all ad logic runs in a dedicated useEffect below
        setTotalMessageCount((prev) => prev + 1);

        // Track lifetime AI messages for relationship-tier image system
        incrementTotalAiMsgs();

        setRecentInteractions((prevInteractions) =>
          [...prevInteractions, `AI: ${responseText}`].slice(-20),
        );
        await logAiMessageToDB(responseText, newAiMessageId, false, false);
      };

      const processAiMediaMessage = async (
        mediaType: "image" | "audio",
        url: string,
        caption?: string,
      ) => {
        // ── For images: send caption text FIRST as separate bubble(s), then
        // pure image bubble with no text. This matches how real WhatsApp works —
        // the person sends a text message, then attaches the photo separately.
        // Short filler captions (≤ 4 words) are kept inline with the image.
        // ──────────────────────────────────────────────────────────────────────
        const captionText = (caption || "").trim();
        const captionWordCount = captionText ? captionText.split(/\s+/).length : 0;
        const isSubstantialCaption = mediaType === "image" && captionWordCount > 4;

        if (isSubstantialCaption) {
          // Send caption as separate text bubble(s) first
          const captionBubbles = splitResponseIntoBubbles(captionText, 3);
          for (let i = 0; i < captionBubbles.length; i++) {
            setIsAiTyping(true);
            const delay = calculateTypingDelay(captionBubbles[i]);
            await new Promise((resolve) => setTimeout(resolve, delay));
            setIsAiTyping(false);

            const textMsgId = `${Date.now()}_caption_${i}`;
            setMessages((prev) => [
              ...prev,
              {
                id: textMsgId,
                text: captionBubbles[i],
                sender: "ai",
                timestamp: new Date(),
                status: "read",
              } as Message,
            ]);
            incrementTotalAiMsgs();
            setTotalMessageCount((prev) => prev + 1);
            onDirectLinkAIResponse();
            await logAiMessageToDB(captionBubbles[i], textMsgId, false, false);

            // Short pause between bubbles
            if (i < captionBubbles.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300));
            }
          }
          // Brief pause before image arrives (like attachment uploading)
          await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));
        } else {
          // Short caption or audio — keep the single typing indicator
          setIsAiTyping(true);
          const typingDuration = calculateTypingDelay(captionText || "Sending...");
          await new Promise((resolve) => setTimeout(resolve, typingDuration));
          setIsAiTyping(false);
        }

        // Send the actual media bubble (image = no text; audio keeps short label)
        const newAiMediaMessageId =
          (Date.now() + Math.random()).toString() + `_${mediaType}`;
        const inlineCaptionText = isSubstantialCaption ? "" : captionText;
        const newAiMediaMessage: Message = {
          id: newAiMediaMessageId,
          text: inlineCaptionText,
          sender: "ai",
          timestamp: new Date(),
          status: "read",
          aiImageUrl: mediaType === "image" ? url : undefined,
          audioUrl: mediaType === "audio" ? url : undefined,
          isViewOnce: mediaType === "image", // All AI images are view-once
        };
        setMessages((prev) => [...prev, newAiMediaMessage]);

        // Track AI media message for direct link ads
        onDirectLinkAIResponse();

        // Mark image as sent and record relationship-tier cooldown/session data
        if (mediaType === "image") {
          markImageAsSent(url);
          recordAiImageSent(); // session counter + cooldown timestamp
        }

        // Track lifetime AI messages for relationship-tier image system
        incrementTotalAiMsgs();

        // Simply increment; all ad logic runs in the dedicated ad-lifecycle useEffect
        setTotalMessageCount((prev) => prev + 1);

        setRecentInteractions((prevInteractions) =>
          [
            ...prevInteractions,
            `AI: ${captionText || ""}[Sent a ${mediaType}] ${url}`,
          ].slice(-20),
        );
        await logAiMessageToDB(
          captionText || `[Sent ${mediaType}]`,
          newAiMediaMessageId,
          mediaType === "image",
          mediaType === "audio",
        );
      };

      // Relationship-tier random image drop — only for established/close users,
      // with a low probability, and only when all cooldown gates are clear.
      const shouldDropRandomImage = () => {
        if (!canSendProactiveImage()) return false;
        const level = getRelationshipLevel();
        // Probabilities reduced (was 15%/8%) to prevent image flooding.
        // close (101+ msgs): 6% — occasional, creates suspense/surprise
        // established (41-100): 3% — rare, meaningful when it happens
        // warming/new: never
        if (level === "close") return Math.random() < 0.06;
        if (level === "established") return Math.random() < 0.03;
        return false;
      };

      // Check for random image drop opportunity
      if (shouldDropRandomImage() && !aiResult.proactiveImageUrl) {
        const randomImageUrl = getContextualImage(text, getTimeOfDay());

        // Prevent duplicate image sharing
        if (
          randomImageUrl &&
          !recentlySharedImages.current.has(randomImageUrl)
        ) {
          const randomCaptions = [
            "btw dekho ye pic mil gayi 😊",
            "arre wait, ye pic share karna tha",
            "ohh forgot to share this",
            "look what i found 📸",
            "random pic drop 😛",
            "ye dekho! 📷",
            "just remembered this pic ✨",
            "sharing this with you 💕",
          ];
          const randomCaption =
            randomCaptions[Math.floor(Math.random() * randomCaptions.length)];

          // Add to tracked images
          recentlySharedImages.current.add(randomImageUrl);

          // Clean up old entries if too many
          if (recentlySharedImages.current.size > MAX_TRACKED_IMAGES) {
            const firstItem = recentlySharedImages.current
              .values()
              .next().value;
            recentlySharedImages.current.delete(firstItem as string);
          }

          await processAiMediaMessage("image", randomImageUrl, randomCaption);
        }
      }

      // Server-side image or audio output from brain simulation
      const targetAudioUrl = aiResult.proactiveAudioUrl || aiResult.voiceUrl;
      let generatedInChatVoice: {
        audioDataUrl: string;
        durationSeconds?: number;
      } | null = null;

      // Decide and generate contextual voice before rendering this AI turn.
      // A successful voice note is the reply itself — never render its source
      // text as a second visible bubble.
      if (!targetAudioUrl && !aiResult.proactiveImageUrl) {
        const responseTextForVoice =
          typeof aiResult.response === "string"
            ? aiResult.response
            : Array.isArray(aiResult.multiPartResponse)
              ? aiResult.multiPartResponse.join(" ")
              : "";
        const voicePlan = getInChatVoicePlan(
          text,
          responseTextForVoice,
          recentInteractions,
          userMemory.relationshipLevel || 0,
        );

        // Ownership is proven by the signed session cookie — no pseudo-id sent
        // in the body (audit issue 15).
        if (voicePlan) {
          try {
            const naturalDelay = voicePlan.urgency === "override" ? 700 : 1200;
            await new Promise((resolve) =>
              setTimeout(resolve, naturalDelay + Math.random() * 700),
            );
            const voiceResponse = await fetch("/api/voice/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: voicePlan.voiceText,
                language: voicePlan.language,
                mood: voicePlan.mood,
              }),
            });
            if (voiceResponse.ok) {
              const voiceData = await voiceResponse.json();
              if (voiceData.audioDataUrl) {
                generatedInChatVoice = {
                  audioDataUrl: voiceData.audioDataUrl,
                  durationSeconds: voiceData.durationSeconds,
                };
                rememberVoiceSnippet(voicePlan.voiceText);
                console.log(
                  `[InChatVoice] ✅ ${voicePlan.reason} — voice-only reply`,
                );
              }
            }
          } catch (voiceError) {
            console.error("[InChatVoice] Generation failed:", voiceError);
          }
        }
      }

      if (aiResult.proactiveImageUrl) {
        const rawCaption = aiResult.mediaCaption || "Check this out! 📸";
        const caption = Array.isArray(rawCaption) ? rawCaption.join(" ") : rawCaption;
        await processAiMediaMessage(
          "image",
          aiResult.proactiveImageUrl,
          caption,
        );
      } else if (targetAudioUrl) {
        // Render server voice as a proper WhatsApp-style voice note (no visible text caption)
        setIsAiTyping(true);
        await new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 500));
        setIsAiTyping(false);

        const serverVoiceMsgId = `server_voice_${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: serverVoiceMsgId,
            text: "",               // no visible caption — voice stands alone
            sender: "ai",
            timestamp: new Date(),
            status: "read",
            isVoiceNote: true,      // renders WhatsApp-style player
            audioUrl: targetAudioUrl,
            voiceNoteDuration: 4,   // server clips are short
          } as Message,
        ]);
        incrementTotalAiMsgs();
        setTotalMessageCount((prev) => prev + 1);
        onDirectLinkAIResponse();
        await logAiMessageToDB("[voice note]", serverVoiceMsgId, false, true);
      } else if (generatedInChatVoice) {
        setIsAiTyping(true);
        await new Promise((resolve) =>
          setTimeout(resolve, 450 + Math.random() * 350),
        );
        setIsAiTyping(false);

        const voiceMessageId = `inchat_voice_${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: voiceMessageId,
            text: "",
            sender: "ai",
            timestamp: new Date(),
            status: "read",
            isVoiceNote: true,
            audioUrl: generatedInChatVoice!.audioDataUrl,
            voiceNoteDuration: Math.max(
              1,
              Math.round(generatedInChatVoice!.durationSeconds || 4),
            ),
          } as Message,
        ]);
        incrementTotalAiMsgs();
        setTotalMessageCount((prev) => prev + 1);
        onDirectLinkAIResponse();
        await logAiMessageToDB("[voice note]", voiceMessageId, false, true);
      } else if (
        aiResult.multiPartResponse &&
        aiResult.multiPartResponse.length > 1
      ) {
        // Handle multi-part responses
        for (let i = 0; i < aiResult.multiPartResponse.length; i++) {
          const part = aiResult.multiPartResponse[i];
          if (part.trim() === "") continue;
          await processAiTextMessage(part, `_part${i}`, true);
          if (i < aiResult.multiPartResponse.length - 1) {
            // Brief pause between messages like a real person
            const interMessageDelay = 800 + Math.random() * 700;
            await new Promise((resolve) =>
              setTimeout(resolve, interMessageDelay),
            );
          }
        }
      } else if (
        aiResult.response &&
        typeof aiResult.response === "string" &&
        aiResult.response.trim() !== ""
      ) {
        await processAiTextMessage(aiResult.response);
      }

      // Ensure typing is always stopped
      setIsAiTyping(false);
      if (aiResult.newMood) setAiMood(aiResult.newMood);

      // Clear missed messages if AI responded to them
      if (shouldRespondToMissedMessages) {
        clearMissedMessages();
      }

      // ── Engagement features: milestone / voice note / referral ────────────
      const totalMsgsNow = messages.filter((m) => !m.isNativeAd).length + 2;
      checkAndSendMilestone(totalMsgsNow);
      // Check if AI just said goodbye and should go offline
      let aiResponseText = "";
      if (typeof aiResult.response === "string") {
        aiResponseText = aiResult.response;
      } else if (Array.isArray(aiResult.response)) {
        aiResponseText = aiResult.response.join(" ");
      } else if (Array.isArray(aiResult.multiPartResponse)) {
        aiResponseText = aiResult.multiPartResponse.join(" ");
      }

      if (detectGoodbyeMessage(aiResponseText)) {
        console.log("Kruthika AI: Goodbye detected, setting offline state");
        setAIGoodbyeState();

        // Clear any pending proactive messages
        if (proactiveMessageTimerRef.current) {
          clearTimeout(proactiveMessageTimerRef.current);
        }
      }

      // Also check if USER said goodbye to AI
      if (detectGoodbyeMessage(text)) {
        console.log(
          "Kruthika AI: User said goodbye, AI should acknowledge and go offline soon",
        );
        // AI will naturally respond to goodbye, then go offline after this message
        setTimeout(() => {
          console.log("Kruthika AI: Going offline after user goodbye");
          setAIGoodbyeState();
          if (proactiveMessageTimerRef.current) {
            clearTimeout(proactiveMessageTimerRef.current);
          }
        }, 5000); // Give 5 seconds for AI response, then go offline
      }

      if (imageAttemptedAndAllowed && currentImageUri) {
        const todayStr = new Date().toDateString();
        let currentUploadCount = parseInt(
          localStorage.getItem(USER_IMAGE_UPLOAD_COUNT_KEY_KRUTHIKA) || "0",
        );
        const lastUploadDate = localStorage.getItem(
          USER_IMAGE_UPLOAD_LAST_DATE_KEY_KRUTHIKA,
        );

        if (lastUploadDate !== todayStr) {
          currentUploadCount = 0;
        }
        currentUploadCount++;
        localStorage.setItem(
          USER_IMAGE_UPLOAD_COUNT_KEY_KRUTHIKA,
          currentUploadCount.toString(),
        );
        localStorage.setItem(
          USER_IMAGE_UPLOAD_LAST_DATE_KEY_KRUTHIKA,
          todayStr,
        );
      }

      if (userSentMediaThisTurnRef.current) {
        userSentMediaThisTurnRef.current = false;
      }
    } catch (error: any) {
      console.error("Error getting AI response:", error);
      let errorDescription = `Could not get a response from ${currentEffectiveAIProfile.name}.`;
      if (error?.response?.data?.error)
        errorDescription = `${currentEffectiveAIProfile.name}'s server said: ${error.response.data.error}`;
      else if (error?.message) errorDescription += ` Details: ${error.message}`;
      else if (typeof error === "string")
        errorDescription += ` Details: ${error}`;
      else
        errorDescription += ` An unknown error occurred. Please check console logs.`;

      toast({
        title: "Error",
        description: errorDescription,
        variant: "destructive",
      });
      const errorAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Uff, my brain's a bit fuzzy right now. Try again in a bit? 😓",
        sender: "ai",
        timestamp: new Date(),
        status: "read",
      };
      setMessages((prev) => {
        const updatedMessages = prev.map((msg) =>
          msg.id === newUserMessage.id
            ? { ...msg, status: "read" as MessageStatus }
            : msg,
        );
        return [...updatedMessages, errorAiMessage];
      });
      setIsAiTyping(false);
      userSentMediaThisTurnRef.current = false;
    } finally {
      // Always release the lock so the user can send another message
      isSendingRef.current = false;
    }
  };

  const currentAiNameForOfflineMsg =
    globalAIProfile?.name || defaultAIProfile.name;

  // ── Offline message: send once when user returns after 2+ hours away ───────
  // Uses refs for messages/recentInteractions so the effect only re-runs when
  // the loading gates actually change — not on every new message bubble.
  const recentInteractionsRef = useRef<string[]>([]);
  useEffect(() => {
    recentInteractionsRef.current = recentInteractions;
  }, [recentInteractions]);

  useEffect(() => {
    if (
      !initialLoadComplete.current ||
      isLoadingChatState ||
      isLoadingAdSettings ||
      isLoadingAIProfile ||
      isLoadingMediaAssets
    )
      return;

    // Use refs so this effect doesn't re-run on every message
    const lastSender = lastMessageSenderRef.current;
    const lastInteractionTime = lastMessageTimestampRef.current;
    const now = Date.now();
    const timeSinceLastInteraction = now - lastInteractionTime;
    let timeoutId: NodeJS.Timeout | undefined = undefined;

    if (
      hasUserChattedRef.current &&
      lastSender === "user" &&
      timeSinceLastInteraction > 2 * 60 * 60 * 1000 &&
      !offlineMsgScheduledRef.current &&
      Math.random() < 0.3
    ) {
      const { hour: currentISTHour } = getISTTimeParts();
      if (!(currentISTHour >= 5 && currentISTHour < 12)) return;

      offlineMsgScheduledRef.current = true;
      const generateAndAddOfflineMessage = async () => {
        setIsAiTyping(true);
        try {
          const offlineInput: OfflineMessageInput = {
            offlineMessageContext:
              "User has returned after being away for a while, or hasn't messaged recently.",
            previousMessageHistory: recentInteractionsRef.current.join("\n"),
            aiName: currentAiNameForOfflineMsg,
          };
          const offlineResult = await generateOfflineMessage(offlineInput);
          const typingDelay = Math.min(
            Math.max(offlineResult.message.length * 60, 700),
            3500,
          );
          await new Promise((resolve) => setTimeout(resolve, typingDelay));
          const newOfflineMsgId = (Date.now() + Math.random()).toString();
          const offlineMessage: Message = {
            id: newOfflineMsgId,
            text: offlineResult.message,
            sender: "ai",
            timestamp: new Date(),
            status: "read",
          };
          setMessages((prev) => [...prev, offlineMessage]);
          setRecentInteractions((prev) =>
            [...prev, `AI: ${offlineResult.message}`].slice(-10),
          );
          // Queue offline message log (batched, non-blocking)
          queueMessageLog({
            message_id: newOfflineMsgId,
            sender_type: "ai",
            chat_id: "kruthika_chat_offline_ping",
            text_content: offlineResult.message.substring(0, 500),
            has_image: false,
          });
        } catch (error) {
          console.error("Error generating offline message:", error);
        } finally {
          setIsAiTyping(false);
        }
      };
      timeoutId = setTimeout(
        generateAndAddOfflineMessage,
        1800 + Math.random() * 1300,
      );
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        offlineMsgScheduledRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Only gate on loading states — message data comes from refs above
    isLoadingChatState,
    isLoadingAdSettings,
    isLoadingAIProfile,
    isLoadingMediaAssets,
    currentAiNameForOfflineMsg,
  ]);

  const handleOpenAvatarZoom = useCallback(() => {
    if (isLoadingAIProfile) return;
    setShowZoomedAvatarDialog(true);
  }, [isLoadingAIProfile]);

  const handleCallVideoClick = () => {
    toast({
      title: t.toastCallFeatureTitle,
      description: t.toastCallFeatureDesc,
      duration: 3000,
    });
  };

  // handleQuickReply needs to call handleSendMessage, which is a large
  // function with its own deep dependency chain — wrapping THIS in
  // useCallback would only actually be stable if handleSendMessage were
  // stable too, which would mean auditing/refactoring a much bigger surface.
  // Instead: keep a ref that always points at the latest real implementation,
  // and expose a wrapper with an empty dependency array that never changes
  // identity. Whenever it's eventually called — even from a bubble that was
  // memoized many renders ago — it delegates to whatever is current at call
  // time via the ref, so there's no stale-closure risk while still getting a
  // permanently stable reference for MessageBubble's React.memo to rely on.
  const handleQuickReplyImplRef = useRef<((replyText: string, originalMessage: Message) => void) | undefined>(undefined);
  handleQuickReplyImplRef.current = (replyText: string, originalMessage: Message) => {
    // Send the quick reply as a message with isQuickReply flag
    handleSendMessage(replyText, undefined, true);

    // Add visual feedback
    toast({
      title: t.toastQuickReplyTitle,
      description: t.toastQuickReplyDesc
        .replace('{reply}', replyText)
        .replace('{original}', originalMessage.text.substring(0, 30)),
      duration: 2000,
    });
  };
  const handleQuickReply = useCallback((replyText: string, originalMessage: Message) => {
    handleQuickReplyImplRef.current?.(replyText, originalMessage);
  }, []);

  // Smart image selection based on context and description
  const getContextualImage = (
    userMessage: string,
    timeOfDay: string,
  ): string | null => {
    const currentMediaConfig = mediaAssetsConfig || defaultAIMediaAssetsConfig;
    const allImages = currentMediaConfig.assets.filter(
      (a) => a.type === "image",
    );

    if (allImages.length === 0) return null;

    // Get sent images from localStorage
    const sentImagesStr = localStorage.getItem(SENT_IMAGES_KEY);
    const sentImages: string[] = sentImagesStr ? JSON.parse(sentImagesStr) : [];

    // Find images that haven't been sent
    const unsentImages = allImages.filter(
      (img) => !sentImages.includes(img.url),
    );

    if (unsentImages.length === 0) {
      // All images sent, reset tracking
      localStorage.removeItem(SENT_IMAGES_KEY);
      return allImages[0].url; // Start over
    }

    // Analyze user message for context
    const msg = userMessage.toLowerCase();

    // Match by description/naming patterns
    let selectedImage = null;

    // Mirror selfie requests
    if (
      msg.includes("selfie") ||
      msg.includes("pic") ||
      msg.includes("photo")
    ) {
      selectedImage = unsentImages.find(
        (img) =>
          img.description?.toLowerCase().includes("selfie") ||
          img.description?.toLowerCase().includes("mirror"),
      );
    }

    // Casual/outfit requests
    if (
      msg.includes("outfit") ||
      msg.includes("dress") ||
      msg.includes("look")
    ) {
      selectedImage = unsentImages.find(
        (img) =>
          img.description?.toLowerCase().includes("outfit") ||
          img.description?.toLowerCase().includes("casual"),
      );
    }

    // College/study context
    if (
      msg.includes("college") ||
      msg.includes("class") ||
      msg.includes("study")
    ) {
      selectedImage = unsentImages.find(
        (img) =>
          img.description?.toLowerCase().includes("college") ||
          img.description?.toLowerCase().includes("study"),
      );
    }

    // Food/eating context
    if (
      msg.includes("food") ||
      msg.includes("eat") ||
      msg.includes("lunch") ||
      msg.includes("dinner")
    ) {
      selectedImage = unsentImages.find(
        (img) =>
          img.description?.toLowerCase().includes("food") ||
          img.description?.toLowerCase().includes("cafe"),
      );
    }

    // Evening/sunset context
    if (
      timeOfDay === "evening" ||
      msg.includes("sunset") ||
      msg.includes("evening")
    ) {
      selectedImage = unsentImages.find(
        (img) =>
          img.description?.toLowerCase().includes("sunset") ||
          img.description?.toLowerCase().includes("evening"),
      );
    }

    // Morning context
    if (timeOfDay === "morning" || msg.includes("morning")) {
      selectedImage = unsentImages.find(
        (img) =>
          img.description?.toLowerCase().includes("morning") ||
          img.description?.toLowerCase().includes("coffee"),
      );
    }

    // If no context match, return random unsent image
    if (!selectedImage) {
      selectedImage =
        unsentImages[Math.floor(Math.random() * unsentImages.length)];
    }

    return selectedImage.url;
  };

  // Get available images that haven't been sent yet (fallback)
  const getUnsentImage = (): string | null => {
    const currentMediaConfig = mediaAssetsConfig || defaultAIMediaAssetsConfig;
    const availableImages = currentMediaConfig.assets
      .filter((a) => a.type === "image")
      .map((a) => a.url);

    if (availableImages.length === 0) return null;

    // Get sent images from localStorage
    const sentImagesStr = localStorage.getItem(SENT_IMAGES_KEY);
    const sentImages: string[] = sentImagesStr ? JSON.parse(sentImagesStr) : [];

    // Find images that haven't been sent
    const unsentImages = availableImages.filter(
      (img) => !sentImages.includes(img),
    );

    if (unsentImages.length === 0) {
      // All images sent, reset tracking
      localStorage.removeItem(SENT_IMAGES_KEY);
      return availableImages[0]; // Start over
    }

    // Return random unsent image
    return unsentImages[Math.floor(Math.random() * unsentImages.length)];
  };

  // Mark image as sent
  const markImageAsSent = (imageUrl: string) => {
    const sentImagesStr = localStorage.getItem(SENT_IMAGES_KEY);
    const sentImages: string[] = sentImagesStr ? JSON.parse(sentImagesStr) : [];

    if (!sentImages.includes(imageUrl)) {
      sentImages.push(imageUrl);
      localStorage.setItem(SENT_IMAGES_KEY, JSON.stringify(sentImages));
    }
  };

  // Send mandatory image after 2 messages with context
  const sendMandatoryImage = async () => {
    const currentTimeOfDay = getTimeOfDay();
    const lastUserMsg =
      messages.filter((m) => m.sender === "user").slice(-1)[0]?.text || "";
    const imageUrl =
      getContextualImage(lastUserMsg, currentTimeOfDay) || getUnsentImage();

    if (!imageUrl) return;

    setIsAiTyping(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsAiTyping(false);

    const imageMessage: Message = {
      id: generateUniqueMessageId(),
      text: "",
      sender: "ai",
      timestamp: new Date(),
      status: "read",
      aiImageUrl: imageUrl,
      isViewOnce: true, // Mark as view-once
    };

    setMessages((prev) => [...prev, imageMessage]);
    markImageAsSent(imageUrl);
    localStorage.setItem(MANDATORY_IMAGE_SENT_KEY, "true");

    // Track total messages
    setTotalMessageCount((prev) => prev + 1);
  };

  // Function to inject a native ad as a chat bubble at the bottom of the list.
  // Accepts the current totalMessageCount so we can track staleness for migration.
  //
  // Guard order:
  //  1. Refs (hasShownNativeAdOnceRef / currentActiveAdIdRef) — always current,
  //     even inside setTimeout callbacks that would otherwise capture stale state.
  //  2. adInjectedAtCountRef — sync ref, never stale.
  const injectNativeAdMessage = (atCount?: number) => {
    if (!adSettings || !adSettings.adsEnabledGlobally) return;
    // Use refs for freshness (avoids stale-closure bugs in setTimeout callbacks)
    if (
      hasShownNativeAdOnceRef.current ||
      currentActiveAdIdRef.current ||
      adInjectedAtCountRef.current !== null
    ) {
      return;
    }
    // Check if native banner is enabled and has valid code, picking the
    // primary format (alternated between Native Banner and 300×250) plus
    // the other Adsterra unit as a fallback.
    const pair = pickNativeAdPair();
    if (!pair) {
      return; // No valid native code configured — silent skip
    }
    // Create the ad bubble message
    const adId = `native_ad_${Date.now()}`;
    const nativeAdMessage: Message = {
      id: adId,
      text: "",
      sender: "ad" as any,
      timestamp: new Date(),
      status: "read",
      isNativeAd: true,
      nativeAdCode: pair.code,
      nativeAdFallbackCode: pair.fallbackCode,
      nativeAdId: `native-ad-chat-${pair.format}-${Date.now()}`,
    };
    // Update refs synchronously first — prevents any concurrent call from slipping through
    hasShownNativeAdOnceRef.current  = true;
    currentActiveAdIdRef.current     = adId;
    adInjectedAtCountRef.current     = atCount ?? totalMessageCount;
    // Then update state
    setMessages((prev) => [...prev, nativeAdMessage]);
    setCurrentActiveAdId(adId);
    setHasShownNativeAdOnce(true);
  };

  const handleLikeMessage = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isLiked: !msg.isLiked } : msg,
      ),
    );

    // Add subtle feedback
    toast({
      title: t.toastLikedTitle,
      description: t.toastLikedDesc,
      duration: 1000,
    });
  }, [toast]);

  const handleReactToMessage = useCallback((
    messageId: string,
    reaction: MessageReaction,
  ) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, reaction } : msg)),
    );

    // Add subtle feedback
    toast({
      title: "🎉 Reaction Added",
      description: `Reacted with ${reaction}`,
      duration: 1000,
    });
  }, [toast]);

  const displayAIProfile = globalAIProfile || defaultAIProfile;
  const effectiveAvatarUrl = siteImages.homepageAvatarUrl || displayAIProfile.avatarUrl;

  if (isLoadingChatState) {
    return <ChatSkeleton />;
  }

  return (
    <>
      <ScreenshotProtection />
      {isMounted && (
        <DirectLinkAd
          isVisible={showDirectLinkAd}
          directLinkUrl={directLinkUrl}
          onClose={closeDirectLinkAd}
        />
      )}
      {/*
        Chat container — uses Visual Viewport height so the input stays visible
        when the mobile keyboard is open. The CSS variable --chat-h is updated
        by the useEffect below; falls back to 100dvh for SSR and old browsers.
        interactive-widget=resizes-content in the viewport meta handles Chrome 108+.
      */}
      <ChatShell
        isMounted={isMounted}
        aiName={displayAIProfile.name}
        aiAvatarUrl={effectiveAvatarUrl}
        onlineStatus={onlineStatus}
        messages={messages}
        isAiTyping={isAiTyping}
        isOnline={isOnline}
        showZoomedAvatarDialog={showZoomedAvatarDialog}
        onAvatarClick={handleOpenAvatarZoom}
        onCallVideoClick={handleCallVideoClick}
        onSendMessage={handleSendMessage}
        onBeforeSend={handleBeforeSend}
        onQueueMessage={enqueueOfflineMsg}
        onQuickReply={handleQuickReply}
        onLikeMessage={handleLikeMessage}
        onReactToMessage={handleReactToMessage}
        onProfileDialogOpenChange={setShowZoomedAvatarDialog}
      />
    </>
  );
});

export default KruthikaChatPage;
