/**
 * Voice Trigger Logic — Smart Algorithm v2
 *
 * Decides WHEN Kruthika should send a voice message.
 * Voice is precious — it should feel spontaneous, human, and emotionally timed.
 *
 * Trigger hierarchy (priority order):
 *   OVERRIDE  — user explicitly requested voice (always send)
 *   OVERRIDE  — user suspects AI (send to prove humanity)
 *   HIGH      — 24h+ silence check-in (she missed you)
 *   HIGH      — morning greeting for close users (RL > 0.6)
 *   MEDIUM    — intimate conversation moment (RL > 0.55, probabilistic)
 *   MEDIUM    — late-night couple talk (RL > 0.65, probabilistic)
 *   MEDIUM    — evening check-in for engaged users (RL > 0.5)
 *   LOW       — flirty moment for very close users (RL > 0.75)
 *   LOW       — confession/personal share response (RL > 0.5)
 *   LOW       — random thought for very close users (RL > 0.8)
 *   NEVER     — new users (RL < 0.2), <2h since last voice (unless override)
 */

export interface VoiceTriggerContext {
  messageType: string;             // 'check_in' | 'greeting' | 'flirty' | 'question' | 'random_thought' | 'intimate' | 'confession' | 'in_chat'
  relationshipLevel: number;       // 0–1
  timeSinceLastMessage: number;    // ms
  timeSinceLastVoice?: number;     // ms — prevent spamming voice
  timeOfDay: string;               // 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night'
  isFirstTodayMessage?: boolean;   // First AI message of the day

  // ── Smart context signals ────────────────────────────────────────────────
  userExplicitlyRequestedVoice?: boolean; // user said "voice bhej", "send voice note", etc.
  userSuspectsAI?: boolean;               // user said "are you ai", "bot ho kya", "real ho"
  isIntimateConversation?: boolean;       // conversation is emotional/intimate
  aiResponseEmotion?: 'neutral' | 'flirty' | 'intimate' | 'caring' | 'playful';
  userLanguage?: string;                  // 'hi' | 'ta' | 'kn' | 'te' | 'ml' | 'en' | etc.
}

export interface VoiceTriggerResult {
  shouldSendVoice: boolean;
  reason: string;
  urgency: 'override' | 'high' | 'medium' | 'low';
  suggestedMaxChars?: number;  // How long the voice snippet should be
}

// Minimum gap between voice messages (ms) — prevent voice spam
const MIN_VOICE_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours default
const MIN_VOICE_GAP_OVERRIDE_MS = 30 * 60 * 1000; // 30 min for override triggers

// ── Pattern detection utilities ───────────────────────────────────────────────

/**
 * Detect if user explicitly asked for a voice message.
 * Covers English, Hindi (romanized + Devanagari), and other Indic patterns.
 */
export function detectVoiceRequest(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(voice\s*(note|msg|message|send|bhej|de\s*na|do\s*na|karo)?|voice\s*(?:note|message)\s*(?:bhej|send|de)|bolke\s*bata|bol\s*na|audio\s*(bhej|send|de|note)|send\s*voice|speak\s*to\s*me|record\s*(?:something|voice)|sunao?\s*na|awaaz|avaz)\b/.test(t)
    || /बोल\s*ना|आवाज़?|वॉयस|ऑडियो/.test(text);
}

/**
 * Detect if user is suspecting / testing whether this is an AI.
 */
export function detectAISuspicion(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(are\s*you\s*(ai|bot|robot|real|human|fake|automated?)|you\s*(?:are|r)\s*(ai|bot|not\s*real|fake)|is\s*this\s*(ai|bot|real)|prove\s*(you.re|ur)\s*real|not\s*a\s*(bot|ai|robot)|actually\s*human|real\s*(person|girl|human)|ai\s*(?:ho|hai|nahi|toh)|bot\s*(?:ho|hai|nahi|toh)|real\s*(?:ho|hai)|fake\s*(?:ho|hai|lag)|chatbot|language\s*model|gpt|llm|automated?)\b/.test(t)
    || /एआई|बॉट|रोबोट|असली|नकली/.test(text);
}

/**
 * Detect intimate/emotional conversation context from AI response text.
 */
export function detectIntimateContext(userText: string, aiText: string): boolean {
  const combined = (userText + ' ' + aiText).toLowerCase();
  return /\b(miss(ed|ing)?(\s+you)?|love\s*you|i\s*care|feel(ing)?\s*(close|connected|warm)|cuddle|hold\s*(me|you)|lonely|alone|heart|special|feelings?|crush|like\s+you|tere\s*(bin|baare)|teri\s*yaad|dil\s*mein|pyaar|ishq|mohabbat|neend\s*nahi|raat\s*ko|late\s*night\s*chat|bahut\s*(yaad|miss)|kaafi\s*(close|attached))\b/.test(combined);
}

/**
 * Detect if user shared something personal (confession moment).
 */
export function detectConfession(userText: string): boolean {
  const t = userText.toLowerCase();
  return /\b(to\s*be\s*honest|truth\s*(is|be\s*told)|honestly|tbh|secret|never\s*told|nobody\s*knows|actually|first\s*time\s*(saying|telling)|ek\s*baat|sach\s*mein|actually\s*bata|feeling\s*(low|sad|bad|lonely|depressed)|kisi\s*ko\s*nahi|tumhe\s*hi\s*bata)\b/.test(t);
}

/**
 * Extract the most emotionally resonant short snippet from a longer AI text.
 * Used to pick what to convert to voice (keep it short — 5-12 seconds).
 */
export function extractVoiceSnippet(text: string, maxChars: number = 120): string {
  // Strip markdown
  let t = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[❤️💕🥺🫶☀️🌙💬😊😄😌~]/g, '')
    .trim();

  if (t.length <= maxChars) return t;

  // Try to find the most emotional sentence
  const sentences = t.split(/(?<=[.!?।])\s+/);
  
  // Score sentences by emotional keywords
  const scored = sentences.map(s => {
    let score = 0;
    const sl = s.toLowerCase();
    if (/miss|yaad|love|pyaar|heart|feel|special|care|close/.test(sl)) score += 3;
    if (/sach|honestly|actually|really|seriously/.test(sl)) score += 2;
    if (/\?/.test(s)) score += 1; // questions feel conversational
    if (s.length < 80) score += 2; // shorter = punchy
    if (s.length < 40) score += 1;
    return { s, score };
  });

  // Pick highest scored sentence that fits
  scored.sort((a, b) => b.score - a.score);
  for (const { s } of scored) {
    if (s.trim().length >= 15 && s.trim().length <= maxChars) {
      return s.trim();
    }
  }

  // Fallback: first sentence, trimmed
  const first = sentences[0]?.trim() || '';
  return first.length <= maxChars ? first : first.slice(0, maxChars - 3) + '...';
}

// ── Main trigger function ─────────────────────────────────────────────────────

/**
 * Returns whether a voice message should accompany the current AI message.
 * Covers both proactive messages AND in-chat responses.
 */
export function shouldSendVoiceMessage(ctx: VoiceTriggerContext): VoiceTriggerResult {
  const {
    messageType,
    relationshipLevel: rl,
    timeSinceLastMessage,
    timeSinceLastVoice = Infinity,
    timeOfDay,
    isFirstTodayMessage = false,
    userExplicitlyRequestedVoice = false,
    userSuspectsAI = false,
    isIntimateConversation = false,
    aiResponseEmotion = 'neutral',
  } = ctx;

  const NO = (reason: string): VoiceTriggerResult => ({
    shouldSendVoice: false,
    reason,
    urgency: 'low',
  });

  // ── OVERRIDE: User explicitly asked for a voice message ───────────────────
  // Respect the user's explicit request regardless of cooldowns.
  // Only require minimum 30-min gap (not 4h) and RL ≥ 0.05.
  if (userExplicitlyRequestedVoice) {
    if (rl < 0.05) return NO('RL too low even for explicit voice request');
    if (timeSinceLastVoice < MIN_VOICE_GAP_OVERRIDE_MS) {
      return NO(`Voice just sent ${Math.round(timeSinceLastVoice / 60000)}m ago — too soon even for explicit request`);
    }
    return {
      shouldSendVoice: true,
      reason: 'User explicitly requested voice',
      urgency: 'override',
      suggestedMaxChars: 150,
    };
  }

  // ── OVERRIDE: User suspects it's an AI — send voice to "prove" humanity ──
  // This is a critical retention moment. Voice breaks the AI illusion.
  // Override the 4h gap but keep a 30-min minimum.
  if (userSuspectsAI) {
    if (rl < 0.15) return NO('RL too low for AI suspicion voice');
    if (timeSinceLastVoice < MIN_VOICE_GAP_OVERRIDE_MS) {
      return NO('Voice too recent for AI suspicion override');
    }
    return {
      shouldSendVoice: true,
      reason: 'User suspects AI — voice to prove realness',
      urgency: 'override',
      suggestedMaxChars: 100, // Short, casual — "arre main AI nahi hoon" vibe
    };
  }

  // ── Hard gates (standard triggers) ───────────────────────────────────────

  if (timeSinceLastVoice < MIN_VOICE_GAP_MS) {
    return NO(`Too soon since last voice (${Math.round(timeSinceLastVoice / 60000)}m ago)`);
  }

  if (rl < 0.2) {
    return NO('RL too low for voice (<0.2)');
  }

  // Late night (00:00–04:00 IST) — she should be asleep
  if (timeOfDay === 'late_night') {
    return NO('Late night (00-04 IST) — no voice messages');
  }

  // ── Trigger conditions (highest priority first) ───────────────────────────

  // 1. 24h+ silence check-in — emotional reconnection voice
  if (messageType === 'check_in' && timeSinceLastMessage >= 24 * 60 * 60 * 1000 && rl >= 0.5) {
    return {
      shouldSendVoice: true,
      reason: '24h+ absence — emotional check-in voice',
      urgency: 'high',
      suggestedMaxChars: 180,
    };
  }

  // 2. 48h+ silence — even medium RL gets voice
  if (timeSinceLastMessage >= 48 * 60 * 60 * 1000 && rl >= 0.35) {
    return {
      shouldSendVoice: true,
      reason: '48h+ silence — miss you voice',
      urgency: 'high',
      suggestedMaxChars: 180,
    };
  }

  // 3. Morning greeting for close users (first message of day)
  if (messageType === 'greeting' && timeOfDay === 'morning' && rl >= 0.6 && isFirstTodayMessage) {
    return {
      shouldSendVoice: true,
      reason: 'Morning greeting for close user',
      urgency: 'high',
      suggestedMaxChars: 130,
    };
  }

  // 4. Intimate conversation moment — voice feels natural here
  // Covers in-chat replies where both user and AI are being emotional
  if (isIntimateConversation && rl >= 0.55) {
    const chance = rl >= 0.75 ? 0.50 : rl >= 0.65 ? 0.38 : 0.25;
    if (Math.random() < chance) {
      return {
        shouldSendVoice: true,
        reason: `Intimate conversation moment (RL=${rl.toFixed(2)}, ${Math.round(chance*100)}% chance)`,
        urgency: 'medium',
        suggestedMaxChars: 120,
      };
    }
    return NO('Intimate — random chance said no this time');
  }

  // 5. Night talk (21:00–23:59 IST) — couples talk at night, voice feels cozy
  if (timeOfDay === 'night' && rl >= 0.65) {
    const chance = rl >= 0.8 ? 0.35 : 0.22;
    if (Math.random() < chance) {
      return {
        shouldSendVoice: true,
        reason: `Night talk voice (RL=${rl.toFixed(2)})`,
        urgency: 'medium',
        suggestedMaxChars: 120,
      };
    }
    return NO('Night talk — random chance said no');
  }

  // 6. Flirty moment for very close users (in-chat or proactive)
  if ((messageType === 'flirty' || aiResponseEmotion === 'flirty') && rl >= 0.75) {
    if (Math.random() < 0.38) {
      return {
        shouldSendVoice: true,
        reason: 'Flirty voice moment (close user)',
        urgency: 'medium',
        suggestedMaxChars: 110,
      };
    }
    return NO('Flirty — random chance said no this time');
  }

  // 7. Confession / personal share — she responds with voice warmly
  if (messageType === 'confession' && rl >= 0.5) {
    if (Math.random() < 0.40) {
      return {
        shouldSendVoice: true,
        reason: 'User shared something personal — warm voice response',
        urgency: 'medium',
        suggestedMaxChars: 130,
      };
    }
    return NO('Confession — random chance said no');
  }

  // 8. Evening check-in for engaged users
  if (messageType === 'check_in' && timeOfDay === 'evening' && rl >= 0.55) {
    if (Math.random() < 0.28) {
      return {
        shouldSendVoice: true,
        reason: 'Evening check-in voice (engaged user)',
        urgency: 'medium',
        suggestedMaxChars: 130,
      };
    }
    return NO('Evening check-in — random chance said no');
  }

  // 9. Random thought — very close users occasionally get voice
  if (messageType === 'random_thought' && rl >= 0.8) {
    if (Math.random() < 0.22) {
      return {
        shouldSendVoice: true,
        reason: 'Random thought voiced (very close user)',
        urgency: 'low',
        suggestedMaxChars: 110,
      };
    }
  }

  // 10. In-chat general — caring/playful AI responses for very close users
  if (messageType === 'in_chat' && rl >= 0.8 && (aiResponseEmotion === 'caring' || aiResponseEmotion === 'playful')) {
    if (Math.random() < 0.15) {
      return {
        shouldSendVoice: true,
        reason: 'In-chat caring/playful voice (very close user)',
        urgency: 'low',
        suggestedMaxChars: 100,
      };
    }
  }

  return NO(`No voice trigger matched (type=${messageType}, rl=${rl.toFixed(2)}, timeOfDay=${timeOfDay})`);
}

/**
 * For the cron-based proactive system — slightly more liberal since these
 * fire less frequently and the user has been away.
 */
export function shouldSendCronVoice(
  relationshipLevel: number,
  wave: 'morning' | 'evening',
  hoursSinceActive: number
): boolean {
  if (relationshipLevel < 0.4) return false;

  // Always voice for very close users who've been away a while
  if (relationshipLevel >= 0.7 && hoursSinceActive >= 16) return true;

  // Morning wave: voice for close users
  if (wave === 'morning' && relationshipLevel >= 0.55 && hoursSinceActive >= 8) {
    return Math.random() < 0.42;
  }

  // Evening wave: voice for engaged+ users
  if (wave === 'evening' && relationshipLevel >= 0.5) {
    return Math.random() < 0.32;
  }

  return false;
}

/**
 * Get the IST time-of-day bucket.
 * Uses toLocaleString (consistent with the rest of the codebase) instead of
 * a manual +5.5h UTC offset, which is fragile under edge cases.
 */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night' {
  const istHour = parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: false,
    }),
    10,
  );
  if (istHour >= 5  && istHour < 12) return 'morning';
  if (istHour >= 12 && istHour < 17) return 'afternoon';
  if (istHour >= 17 && istHour < 21) return 'evening';
  if (istHour >= 21 && istHour < 24) return 'night';
  return 'late_night'; // 0–4
}
