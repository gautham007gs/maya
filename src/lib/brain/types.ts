export type ScriptFamily =
  | "devanagari"
  | "gurmukhi"
  | "south_indian"
  | "east_indic"
  | "latin_hindi"
  | "latin_pure";

export interface DetectedLanguage {
  language: string;
  scriptFamily: ScriptFamily;
  isRomanized: boolean;
  confidence: "high" | "medium" | "low";
  displayName: string;
}

export type MoodyTrigger =
  | "media_request"
  | "intimate_talk"
  | "flirt_tone"
  | "rude_tone"
  | "cold_user"
  | "late_night_tired"
  | "ai_accusation";

export interface MoodyContext {
  trigger: MoodyTrigger;
  intensity: "mild" | "strong";
}

export interface EmotionalStateInput {
  userMessage: string;
  userImageUri?: string;
  timeOfDay: "morning" | "afternoon" | "evening" | "night" | "late_night";
  mood?: string;
  recentInteractions: string[];
  userLevel?: number;
  intimacyScore?: number;
  specialEvents?: string[];
  userPsychologyProfile?: any;
  userAddictionLevel?: string;
  userEmotionalState?: string;
  dailyMessageCount?: number;
  missedMessages?: Array<{ id: string; text: string; timestamp: number }>;
  hasBeenOffline?: boolean;
  isQuickReply?: boolean;
  currentIgnoreUntil?: number | null;
  relationshipLevel?: number;
  memoryContext?: string;
  lastGoodbyeTime?: number;
  userTypeData?: {
    dailyMessageCount: number;
    relationshipLevel: number;
    totalDaysActive: number;
  };
  userMemorySnapshot?: import("@/ai/user-classifier").UserMemorySnapshot;
  sessionMsgCount?: number;
  sessionId?: string;
  alreadySentImages?: string[];
  alreadySentVoices?: string[];
  userLanguage?: string;
  /** Lite chat surface — cheaper/shorter AI pipeline */
  lite?: boolean;
}

export interface EmotionalStateOutput {
  response?: string | string[];
  multiPartResponse?: string[];
  mediaCaption?: string;
  proactiveImageUrl?: string;
  proactiveAudioUrl?: string;
  newMood?: string;
  newIgnoreUntil?: number;
  busyReason?: string;
  shouldSendMedia?: boolean;
  mediaType?: "selfie" | "cute" | "study" | "casual" | "canteen" | "rain" | "romantic" | "moody" | "dressing_up" | "gym" | "coffee" | "late_night";
  followUpMessage?: string;
  shouldSendVoice?: boolean;
  voiceUrl?: string;
  voiceText?: string;
}