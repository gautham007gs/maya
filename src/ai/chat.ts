/**
 * @fileoverview Chat orchestrator — single entry point for all AI chat logic.
 *
 * Clean pipeline:
 *   User Message → Memory Context → System Prompt → buildConversationPayload()
 *   → generateFromMessages() → provider adapter → LLM → cleanLLMResponse()
 *
 * This file is the ONLY place allowed to construct the conversation payload.
 * No provider may add to or modify messages[] after this point.
 */

import { buildConversationPayload, generateFromMessages } from '@/ai/multi-provider';
import { cleanLLMResponse, splitResponseIntoBubbles } from '@/ai/response-cleanup';
import { shouldAIBeBusyServerSafe, resolveIgnoreGate } from '@/ai/ignore-utils';
import { isAIIgnoreGloballyEnabled } from '@/lib/ai-ignore-settings';
import { getMediaFileForType } from '@/lib/brain/media-server';
import { isAISafetyRefusal, shouldShareMedia, sanitizeAILeaks } from '@/lib/brain/evaluators';
import { buildSystemPrompt } from '@/ai/prompt';
import type { EmotionalStateInput, EmotionalStateOutput } from '@/lib/brain/types';

// ── Name helpers ──────────────────────────────────────────────────────────────

function isValidName(name: string): boolean {
  if (!name?.trim()) return false;
  const c = name.trim().toLowerCase();
  // Reject common false positives
  const stopwords = ['name', 'user', 'unknown', 'anonymous', 'null', 'undefined',
    'an', 'ok', 'hi', 'hey', 'from', 'the', 'not', 'just', 'good', 'fine', 'bad',
    'sure', 'yes', 'no', 'it', 'is', 'am', 'are'];
  return c.length >= 1 && !stopwords.includes(c);
}

function formatName(raw: string): string {
  const trimmed = raw.trim();
  // Native script — return as-is
  if (/[^\x00-\x7F]/.test(trimmed)) return trimmed;
  // Latin — capitalize first letter
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Extract user's name from their message.
 * Handles English, Hinglish, Kannada, Tamil, Telugu, and generic patterns.
 * Falls back to null when uncertain — better to miss than to extract noise.
 */
function extractNameFromMessage(text: string): string | null {
  const t = text.trim();

  // ── Latin / English / Hinglish patterns ──
  const latinPatterns: RegExp[] = [
    // "My name is Rahul", "my name's Rahul"
    /(?:my\s+name\s+is|my\s+name'?s)\s+([A-Za-z][A-Za-z]{0,19})\b/i,
    // "I'm Rahul", "Im Rahul", "I am Rahul"
    /^(?:i'?m|iam|i\s+am)\s+([A-Za-z][A-Za-z]{0,19})(?:\s|$)/i,
    // "Call me Rahul", "They call me Rahul", "People call me Sam", "Friends call me Arjun", "My friends call me Arjun"
    /(?:(?:my\s+)?friends?\s+call\s+me|people\s+call\s+me|they\s+call\s+me|call\s+me|just\s+call\s+me)\s+([A-Za-z][A-Za-z]{0,19})\b/i,
    // "mera naam Rahul hai", "mera naam Rahul"
    /mera\s+naam\s+([A-Za-z][A-Za-z]{0,19})(?:\s+hai)?\b/i,
    // "mera name Rahul hai"
    /mera\s+name\s+([A-Za-z][A-Za-z]{0,19})(?:\s+hai)?\b/i,
    // "naam hai Rahul"
    /naam\s+hai\s+([A-Za-z][A-Za-z]{0,19})\b/i,
  ];

  for (const p of latinPatterns) {
    const m = t.match(p);
    if (m?.[1] && isValidName(m[1])) return formatName(m[1]);
  }

  // ── Romanized Kannada: "nan hesru Rohit" / "nanna hesru Rohit" / "nanna name Rohit" ──
  // "nan/nanna" = my/I, "hesru" = name → the word AFTER hesru is the actual name
  const romKannadaMatch = t.match(/(?:nan|nanna)\s+(?:hesru|name|peru)\s+([A-Za-z][A-Za-z]{0,24})\b/i);
  if (romKannadaMatch?.[1] && isValidName(romKannadaMatch[1])) return formatName(romKannadaMatch[1]);

  // ── Romanized Tamil/Telugu: "en peru X", "na peru X", "naa peru X" ──
  const romSouthMatch = t.match(/(?:en|na|naa|na[aā])\s+(?:peru|peyar)\s+([A-Za-z][A-Za-z]{0,24})\b/i);
  if (romSouthMatch?.[1] && isValidName(romSouthMatch[1])) return formatName(romSouthMatch[1]);

  // ── Native Kannada: "ನನ್ನ ಹೆಸರು Rahul" / "ನನ್ನ ಹೆಸರು ರಾಹುಲ್" ──
  const kannadaMatch = t.match(/ನನ್ನ\s+(?:ಹೆಸರು|name)\s+([A-Za-z\u0C80-\u0CFF]{1,25})/i);
  if (kannadaMatch?.[1] && isValidName(kannadaMatch[1])) return formatName(kannadaMatch[1]);

  // ── Tamil: "என் பெயர் Rahul" / "என் பெயர் ராகுல்" ──
  const tamilMatch = t.match(/என்\s+பெயர்\s+([A-Za-z\u0B80-\u0BFF]{1,25})/i);
  if (tamilMatch?.[1] && isValidName(tamilMatch[1])) return formatName(tamilMatch[1]);

  // ── Telugu: "నా పేరు Rahul" / "నా పేరు రాహుల్" ──
  const teluguMatch = t.match(/నా\s+పేరు\s+([A-Za-z\u0C00-\u0C7F]{1,25})/i);
  if (teluguMatch?.[1] && isValidName(teluguMatch[1])) return formatName(teluguMatch[1]);

  // ── Hindi Devanagari: "मेरा नाम Rahul है" ──
  const hindiDevMatch = t.match(/मेरा\s+नाम\s+([A-Za-z\u0900-\u097F]{1,25})/i);
  if (hindiDevMatch?.[1] && isValidName(hindiDevMatch[1])) return formatName(hindiDevMatch[1]);

  return null;
}

// ── Memory parsing ────────────────────────────────────────────────────────────

function parseMemoryContext(raw: string): {
  knownName: string; nickname: string; relStage: string; memKnowledge: string;
} {
  let knownName = '', nickname = '', relStage = 'new', memKnowledge = '';
  if (!raw) return { knownName, nickname, relStage, memKnowledge };

  for (const part of raw.split('|')) {
    const p = part.trim();
    if (p.startsWith('name:')) {
      const [full, nick] = p.slice(5).replace('(JUST_SHARED)', '').split('/');
      if (isValidName(full)) knownName = full.trim();
      if (isValidName(nick))  nickname  = nick.trim();
    } else if (p.startsWith('rel:')) {
      relStage = p.slice(4);
    } else if (p.startsWith('mood:')) {
      // intentionally ignored — LLM infers emotional state from the conversation
    } else if (p.includes(':')) {
      memKnowledge = memKnowledge ? `${memKnowledge}, ${p}` : p;
    }
  }
  return { knownName, nickname, relStage, memKnowledge };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateResponse(input: EmotionalStateInput): Promise<EmotionalStateOutput> {
  try {
    // 1. Busy / ignore gate — wrapped in the global admin toggle
    // (Admin → AI Replies). When disabled, resolveIgnoreGate bypasses the
    // gate entirely, including an already-running micro-pause.
    const ignoreEnabled = await isAIIgnoreGloballyEnabled();
    const busyResult = resolveIgnoreGate(
      ignoreEnabled,
      shouldAIBeBusyServerSafe(
        input.currentIgnoreUntil ?? null,
        input.userTypeData,
        input.recentInteractions?.slice(-3) || [],
      ),
    );
    if (busyResult.shouldIgnore) {
      return busyResult.shouldWarnFirst
        ? { response: busyResult.busyReason || 'wait 1 sec, brb!', newMood: 'about_to_be_busy', newIgnoreUntil: busyResult.newIgnoreUntil, busyReason: busyResult.busyReason }
        : { response: busyResult.busyReason || 'brb!',             newMood: 'busy',              newIgnoreUntil: busyResult.newIgnoreUntil, busyReason: busyResult.busyReason };
    }

    // 2. Parse DB memory context
    const mem = parseMemoryContext(input.memoryContext?.trim() || '');

    // 3. Name detection from current message — overwrites stale DB name if user re-introduces
    const freshName = extractNameFromMessage(input.userMessage);
    let justSharedName = false;
    if (freshName) { mem.knownName = freshName; justSharedName = true; }

    // 4. Comeback directive (user returned after offline gap)
    let comebackDirective = '';
    if (input.lastGoodbyeTime) {
      const hrs = Math.round((Date.now() - input.lastGoodbyeTime) / 3_600_000);
      comebackDirective = `User returned after ~${hrs} hour${hrs !== 1 ? 's' : ''} offline. Greet them naturally.`;
    }

    // 5. First-meeting hint for brand-new users
    const isNew = !input.sessionMsgCount && !input.recentInteractions?.length && !comebackDirective;
    const greetingDirective = isNew
      ? 'Very first message from this user. Pick a warm, varied opener. Ask one question to get to know them.'
      : '';

    // 6. Call request — user is asking for a phone/video call.
    //    Detect and inject a directive; let the LLM respond naturally (deflect + offer voice note).
    const _callPatterns = /\b(call|kall|phone|ring|video\s*call|facetime|vc|video\s+bana|call\s+kar|call\s+karo|mujhe\s+call|call\s+laga|call\s+lagao)\b/i;
    const callDirective = _callPatterns.test(input.userMessage)
      ? "User is asking you to make a phone or video call. You can't call anyone — you're shy about calls, or not in a private place, or your camera's acting up. Deflect warmly and naturally in 1–2 lines. Offer to send a voice note instead. Do NOT pretend to dial or say 'call lagaya'."
      : '';

    // 7. Voice requests — do NOT shortcut to catalog. Let the LLM reply naturally.
    //    The client-side InChatVoice trigger (page.tsx) will generate contextual TTS
    //    from the LLM's text response — dynamic and conversation-aware.

    // 8. Optional media sharing — throttled: max 1 image per 15 conversation turns
    let attachedMediaUrl: string | null = null;
    let attachedMediaType: string | null = null;
    let mediaCaption = '';
    const alreadySentCount = (input.alreadySentImages || []).length;
    const conversationTurns = Math.ceil((input.recentInteractions?.length || 0) / 2);
    // Server-side image throttle: 1 image per 25 conversation turns (was 15).
    // Client-side has its own 45-min cooldown; this is a separate server-level gate.
    const mediaAllowed = conversationTurns >= 6 && (alreadySentCount === 0 || conversationTurns >= alreadySentCount * 25);
    const mediaCheck = mediaAllowed ? shouldShareMedia(input.userMessage, input.recentInteractions, undefined) : { shouldSend: false };
    if (mediaCheck.shouldSend) {
      const media = await getMediaFileForType(mediaCheck.mediaType as any, input.sessionId, input.alreadySentImages || []);
      attachedMediaUrl = media.url;
      attachedMediaType = mediaCheck.mediaType || 'selfie';
      mediaCaption = `You're sharing a ${attachedMediaType} photo — write one short natural caption.`;
    }

    // 9. Build the single system prompt
    const systemPrompt = buildSystemPrompt({
      knownName: mem.knownName,
      nickname: mem.nickname,
      justSharedName,
      relStage: mem.relStage,
      callDirective,
      comebackDirective,
      greetingDirective,
      mediaCaption,
      memKnowledge: mem.memKnowledge,
      sessionId: input.sessionId,
    });

    // 10. Build canonical conversation payload — SINGLE construction point.
    //    Keep the most recent five conversation turns (up to 10 user/AI
    //    messages). This is the context the prompt tells the model to prioritize.
    const historyLimit = input.lite ? 4 : 10;
    const maxTokens = input.lite ? 90 : 160;
    const temperature = input.lite ? 0.75 : 0.88;
    const history = input.recentInteractions?.slice(-historyLimit) || [];
    const messages = buildConversationPayload(systemPrompt, history, input.userMessage);

    // 11. Source log — metadata only; never log message content in production.
    console.log(
      `[chat.ts][source] lite=${Boolean(input.lite)} msgs=${messages.length}` +
      ` [${messages.map(m => ({ system: 'S', user: 'U', assistant: 'A' })[m.role] ?? '?').join('')}]` +
      ` system=${messages.filter(m => m.role === 'system').length}` +
      ` user_turns=${messages.filter(m => m.role === 'user').length}` +
      ` last_len=${input.userMessage.length}`,
    );

    const raw = await generateFromMessages(messages, { maxTokens, temperature });

    // 13. Safety refusal gate
    if (isAISafetyRefusal(raw)) {
      return { response: 'ew no 😐', newMood: 'uncomfortable' };
    }

    // 14. Cleanup chain:
    //   a) strip formatting artifacts (quotes, markdown bold/italic)
    //   b) sanitize assistant-habit phrases that slipped through ("No worries", "Let me know", etc.)
    const cleaned = sanitizeAILeaks(cleanLLMResponse(raw));
    const bubbles = splitResponseIntoBubbles(cleaned);

    return {
      response: cleaned,
      multiPartResponse: bubbles.length > 1 ? bubbles : undefined,
      shouldSendMedia: !!attachedMediaUrl,
      mediaType: (attachedMediaType as any) || undefined,
      proactiveImageUrl: attachedMediaUrl || undefined,
      followUpMessage: attachedMediaUrl ? cleaned : undefined,
      newMood: attachedMediaUrl ? 'sharing_moment' : 'engaging',
    };

  } catch (error) {
    console.error('[chat] generateResponse error:', error);
    return { response: 'hey 😊', newMood: 'normal' };
  }
}
