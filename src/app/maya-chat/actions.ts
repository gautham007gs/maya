'use server';

import { generateResponse, type EmotionalStateInput } from '@/ai/flows/emotional-state-simulation';
import { shouldAIBeBusyServerSafe, getNeutralBusyWarning, getISTHour, resolveIgnoreGate } from '@/ai/ignore-utils';
import { isAIIgnoreGloballyEnabled } from '@/lib/ai-ignore-settings';
import SecurityValidator from '@/lib/security-utils';
import { resolveAiGuardIdentity, enforceAiRequestGuard, validateAiMessage } from '@/lib/ai-request-guard';

// NOTE: DB-backed persistent memory already exists — the `useUserMemory` client hook
// syncs a structured memory record (name/facts/topics/relationship) to the
// `kruthika_user_memory` table via /api/memory every 10 messages and loads it on mount.
// `memoryContext` below is that hook's compact string; no separate server-side
// memory store is needed here.

export async function sendMessage(
  message: string,
  currentMood?: string,
  chatHistory?: string[],
  userTypeData?: { dailyMessageCount: number; relationshipLevel: number; totalDaysActive: number },
  currentIgnoreUntil?: number | null,
  memoryContext?: string,
  relationshipLevel?: number,
  userMemorySnapshot?: import('@/ai/user-classifier').UserMemorySnapshot,
  sessionMsgCount?: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userPsychologyProfile?: any,
  // Session language detected client-side — fallback for ambiguous short messages ('ok', '😊')
  sessionLanguage?: string,
) {
  try {
    // ── Central AI guard: identity → quota → input caps (fail closed) ────────
    const identity = await resolveAiGuardIdentity();
    const quota = await enforceAiRequestGuard(identity);
    if (!quota.allowed) {
      return {
        success: false,
        response: quota.status === 429
          ? quota.reason
          : 'Kruthika is a bit overwhelmed right now — try again in a minute!',
        newMood: currentMood || 'neutral',
        usedMood: currentMood || 'neutral',
        quotaBlocked: true,
        retryAfterMs: quota.retryAfterMs,
      };
    }

    const messageCheck = validateAiMessage(message);
    if (!messageCheck.isValid) {
      return {
        success: false,
        response: 'hey! 😅',
        newMood: currentMood || 'neutral',
        usedMood: currentMood || 'neutral',
      };
    }

    // Client-supplied history must be bounded BEFORE any processing — reject
    // oversized/non-array history outright instead of iterating a huge array.
    const historyResult = SecurityValidator.sanitizeHistory(chatHistory);
    if (!historyResult.valid) {
      return {
        success: false,
        response: 'hey! 😅',
        newMood: currentMood || 'neutral',
        usedMood: currentMood || 'neutral',
      };
    }
    const boundedHistory = historyResult.sanitized ?? [];

    const istHour = parseInt(new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false
    }));
    const timeOfDay = istHour >= 5 && istHour < 12 ? 'morning' :
                      istHour >= 12 && istHour < 17 ? 'afternoon' :
                      istHour >= 17 && istHour < 21 ? 'evening' : 'night';

    // Mood is driven by day state (neural seed) — not a random array pick.
    // The full mood context is injected into the system prompt by generateResponse via
    // getDayStatePromptInjection(). We keep currentMood for backward compat with the
    // mood newMood cycle, but don't randomly override it every request.
    const dynamicMood = currentMood || 'present';

    // ── Ignore / busy check ──
    // Global admin toggle: when the ignore feature is disabled from the admin
    // panel, resolveIgnoreGate bypasses everything — including an already-
    // running micro-pause — so Kruthika replies to every message instantly.
    const ignoreEnabled = await isAIIgnoreGloballyEnabled();
    const ignoreLogic = resolveIgnoreGate(
      ignoreEnabled,
      shouldAIBeBusyServerSafe(currentIgnoreUntil ?? null, userTypeData, boundedHistory.slice(-3)),
    );

    if (ignoreLogic.shouldIgnore) {
      // Detect if the user is writing in Hindi/Hinglish so we can pick the right warning text.
      // We use a fast inline check (no import of the full detector) — same core logic:
      // non-ASCII → definitely not Hinglish; no strong Hindi markers → probably regional/English.
      const hasNonAscii = /[^\x00-\x7F]/.test(message);
      const hasHindiMarker = /\b(yaar|arre|accha|matlab|phir|hoon|karo|kyun|kaisa|kaise|waise|batao|suno|thoda|abhi|kahan)\b/i.test(message);
      const isHindiUser = !hasNonAscii && hasHindiMarker;

      if (ignoreLogic.shouldWarnFirst) {
        // Hindi users see Hinglish warning (busyReason); all others get neutral English.
        const warnText = isHindiUser
          ? (ignoreLogic.busyReason || getNeutralBusyWarning(getISTHour()))
          : getNeutralBusyWarning(getISTHour());
        return {
          success: true,
          response: warnText,
          newMood: 'naturally_busy',
          usedMood: dynamicMood,
          wasIgnored: true,
          newIgnoreUntil: ignoreLogic.newIgnoreUntil,
          delayedResponse: true,
        };
      } else {
        return {
          success: true,
          response: null,
          newMood: 'naturally_busy',
          usedMood: dynamicMood,
          wasIgnored: true,
          newIgnoreUntil: ignoreLogic.newIgnoreUntil,
          shouldIgnore: true,
        };
      }
    }

    // ── Build AI input ──
    // Pass the user message untouched — no truncation, no rewriting.
    const trimmedMessage = message;

    // Pass up to 20 recent turns for coherent conversational context
    const recentHistory = boundedHistory.slice(-20) || [];

    const input: EmotionalStateInput = {
      userMessage: trimmedMessage,
      timeOfDay,
      mood: dynamicMood,
      recentInteractions: recentHistory,
      memoryContext: memoryContext || '',
      relationshipLevel: relationshipLevel ?? 0.1,
      // Pass typed fields so generateResponse can use them without (input as any)
      userTypeData: userTypeData ?? undefined,
      dailyMessageCount: userTypeData?.dailyMessageCount,
      currentIgnoreUntil: currentIgnoreUntil ?? null,
      // User classifier inputs for behavioral adaptation
      userMemorySnapshot: userMemorySnapshot ?? undefined,
      sessionMsgCount: sessionMsgCount ?? undefined,
      // Psychology profile built client-side from localStorage — enriches system prompt
      userPsychologyProfile: userPsychologyProfile ?? undefined,
      // Session language from client: locked to detected language, outlasts short ambiguous msgs
      userLanguage: sessionLanguage || undefined,
    };

    const aiResponse = await generateResponse(input);

    let response: string;
    const mediaCaption = aiResponse.followUpMessage || aiResponse.mediaCaption;
    if (aiResponse.proactiveImageUrl) {
      response = mediaCaption || "Check this out! 📸";
    } else if (typeof aiResponse.response === 'string') {
      response = aiResponse.response;
    } else if (Array.isArray(aiResponse.response)) {
      response = aiResponse.response.join(' ');
    } else {
      response = "hey! 😊";
    }

    return {
      success: true,
      response,
      newMood: aiResponse.newMood || dynamicMood,
      usedMood: dynamicMood,
      multiPartResponse: aiResponse.multiPartResponse,
      proactiveImageUrl: aiResponse.proactiveImageUrl,
      proactiveAudioUrl: aiResponse.proactiveAudioUrl,
      mediaCaption: mediaCaption || undefined,
      followUpMessage: aiResponse.followUpMessage,
      shouldSendMedia: aiResponse.shouldSendMedia,
      mediaType: aiResponse.mediaType,
      shouldSendVoice: aiResponse.shouldSendVoice,
      voiceUrl: aiResponse.voiceUrl,
      voiceText: aiResponse.voiceText,
      newIgnoreUntil: aiResponse.newIgnoreUntil,
      busyReason: aiResponse.busyReason,
    };

  } catch (error) {
    console.error('[sendMessage] Error:', error);
    return {
      success: false,
      response: "phone acting weird! 😅",
      newMood: currentMood || 'neutral',
      usedMood: currentMood || 'neutral',
    };
  }
}
