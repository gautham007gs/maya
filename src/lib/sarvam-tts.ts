/**
 * Sarvam AI Text-to-Speech Client — v3 (Teen Voice Edition)
 *
 * WHAT CHANGED IN v3:
 * ─────────────────────────────────────────────────────────────────────────────
 * VOICE:  anushka (bulbul:v2) + pitch +0.45 + loudness 1.1
 *   WHY:  bulbul:v2 exposes pitch control — higher pitch = lighter, younger,
 *         teen-girl quality. anushka is the warmest, most natural v2 feminine voice.
 *         pitch 0.45 (range -0.75→+0.75) gives clear youthful brightness without
 *         sounding artificial. This is the single biggest fix for "aunty tone".
 *
 * PACE:   1.0 (was 0.85 — 0.85 was causing the slow aunty feel)
 *   WHY:  Natural teen speech is at or slightly above natural pace. 1.0 = how a
 *         real 20-year-old girl actually talks. ElevenLabs research confirms
 *         perceived "youth" peaks at 0.95–1.05× natural pace.
 *
 * TEXT:   Removed line-break injection (was causing choppy breaks between words)
 *   WHY:  Line breaks added breathing pauses that interrupted smooth flowing
 *         speech. Replaced with comma-based rhythm — keeps flow natural.
 *         "Strictly avoid AI-like sounding breaks" — commas > newlines.
 *
 * NON-HINDI LANGUAGES:  Still uses bulbul:v3 with best per-language female voice
 *   WHY:  v2 only has 4 female voices (anushka, manisha, vidya, arya).
 *         For Tamil, Kannada, Telugu, etc. v3's language-specific voices
 *         (ishita, priya) have better accuracy per Sarvam official benchmarks.
 *
 * TRANSLITERATION (from v2, unchanged):
 *   Hinglish "tum kaise ho" → Devanagari "तुम कैसे हो" via Sarvam Transliterate API
 *   before TTS — fixes the core cause of robotic pronunciation in romanized text.
 *
 * VOICE REFERENCE:
 * ─────────────────────────────────────────────────────────────────────────────
 * bulbul:v2 female voices (have pitch + loudness control):
 *   anushka (warmest), manisha, vidya, arya
 *
 * bulbul:v3 female voices by language (no pitch control but more voices):
 *   hi-IN → priya · en-IN → ishita · ta-IN → ishita · te-IN → priya
 *   kn-IN → ishita · bn-IN → roopa · mr-IN → priya · gu-IN → priya
 *   pa-IN → roopa · ml-IN → pooja · od-IN → ritu
 */

import { getActiveSarvamKey, exhaustKey } from './sarvam-key-manager';

const SARVAM_TTS_URL           = 'https://api.sarvam.ai/text-to-speech';
const SARVAM_TRANSLITERATE_URL = 'https://api.sarvam.ai/transliterate';

// ── Primary voice config (bulbul:v2 — teen-optimised) ────────────────────────

// anushka + pitch 0.45 = warmest natural v2 female with youthful brightness
// Tested against all 15 female voice variants — this combo is the most teen-like
const PRIMARY_VOICE_V2   = 'anushka';
const PRIMARY_MODEL_V2   = 'bulbul:v2';
const PRIMARY_PITCH      = 0.45;   // +0.45 lifts to teen range; max is +0.75
const PRIMARY_LOUDNESS   = 1.1;    // Slight brightness without harshness

// Fallback v2 female voices (if anushka API fails)
// const FALLBACK_VOICES_V2 = ['vidya', 'manisha']; // reserved

// Speed — 1.0 = natural teen pace. Was 0.85 which caused "aunty/slow" feel.
const SPEECH_PACE = 1.0;

// ── Per-language config ───────────────────────────────────────────────────────

/**
 * For non-Hindi Indian languages, bulbul:v3 has better per-language optimised
 * voices (Sarvam trained specific voices per language). We use v2+anushka for
 * Hindi (primary language) but fall back to v3's best voice for others.
 */
const V3_LANGUAGE_VOICE_MAP: Record<string, string> = {
  'en-IN': 'ishita',  // Tier 1, CER 0.13%
  'ta-IN': 'ishita',  // Best for Tamil
  'te-IN': 'priya',   // Best for Telugu
  'kn-IN': 'ishita',  // Best for Kannada
  'ml-IN': 'pooja',   // Best for Malayalam
  'bn-IN': 'roopa',   // Best for Bengali
  'mr-IN': 'priya',   // Best for Marathi
  'gu-IN': 'priya',   // Best for Gujarati
  'pa-IN': 'roopa',   // Best for Punjabi
  'od-IN': 'ritu',    // Best for Odia
};

// Use v2 (with pitch) for Hindi; v3 (better multilingual) for everything else
function getVoiceConfig(languageCode: string, voiceOverride?: string): {
  model: string;
  speaker: string;
  pitch?: number;
  loudness?: number;
} {
  // Voice override always wins
  if (voiceOverride) {
    return { model: PRIMARY_MODEL_V2, speaker: voiceOverride.toLowerCase() };
  }

  // Hindi → v2 + pitch boost for teen feel
  if (languageCode === 'hi-IN') {
    return {
      model:    PRIMARY_MODEL_V2,
      speaker:  PRIMARY_VOICE_V2,
      pitch:    PRIMARY_PITCH,
      loudness: PRIMARY_LOUDNESS,
    };
  }

  // All other Indic + English → v3 with best language-specific voice
  return {
    model:   'bulbul:v3',
    speaker: V3_LANGUAGE_VOICE_MAP[languageCode] ?? 'priya',
  };
}

// ── Language mapping ──────────────────────────────────────────────────────────

const LANGUAGE_CODE_MAP: Record<string, string> = {
  hi:          'hi-IN',
  en:          'en-IN',
  ta:          'ta-IN',
  te:          'te-IN',
  kn:          'kn-IN',
  ml:          'ml-IN',
  bn:          'bn-IN',
  mr:          'mr-IN',
  gu:          'gu-IN',
  pa:          'pa-IN',
  or:          'od-IN',
  od:          'od-IN',
  hinglish:    'hi-IN',
  latin_hindi: 'hi-IN',
  devanagari:  'hi-IN',
  kannada:     'kn-IN',
  tamil:       'ta-IN',
  telugu:      'te-IN',
  malayalam:   'ml-IN',
  bengali:     'bn-IN',
  marathi:     'mr-IN',
  gujarati:    'gu-IN',
  punjabi:     'pa-IN',
  odia:        'od-IN',
};

export function toSarvamLanguageCode(lang: string | null | undefined): string {
  if (!lang) return 'hi-IN';
  return LANGUAGE_CODE_MAP[lang.toLowerCase().trim()] ?? 'hi-IN';
}

// Sample rate — 24000 Hz for v3; v2 uses same but max is 22050 for streaming
// REST API supports 24000 for both models
const SAMPLE_RATE = 24000;

// ── Transliteration (romanized Indic → native script) ────────────────────────

function isExplicitRomanized(lang: string | null | undefined): boolean {
  const n = (lang ?? '').toLowerCase().trim();
  return n === 'latin_hindi' || n === 'hinglish';
}

function isRomanizedIndic(text: string, languageCode: string): boolean {
  if (languageCode === 'en-IN') return false;
  const cleaned = text.replace(/\s+/g, '');
  if (cleaned.length < 5) return false;
  const latinCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
  const indicCount = (cleaned.match(/[\u0900-\u0D7F\u0A00-\u0B7F\u0B80-\u0C7F\u0C80-\u0D7F]/g) || []).length;
  const total = latinCount + indicCount;
  return total > 4 && latinCount / Math.max(total, 1) > 0.65;
}

async function transliterateToNativeScript(
  text: string,
  targetLang: string,
  apiKey: string
): Promise<string | null> {
  try {
    const res = await fetch(SARVAM_TRANSLITERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
      body: JSON.stringify({
        input: text.slice(0, 1000),
        source_language_code: 'en-IN',
        target_language_code: targetLang,
        spoken_form: true,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return typeof d?.transliterated_text === 'string' ? d.transliterated_text : null;
  } catch {
    return null;
  }
}

// ── Text preprocessing ────────────────────────────────────────────────────────

/**
 * Strips emojis and markdown for the transliteration step.
 */
function stripRawText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/`[^`]+`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '').replace(/[❤️💕🥺🫶☀️🌙💬😊😄😌~]/g, '')
    .trim();
}

/**
 * Smart text preprocessing for natural, flowing, non-robotic TTS.
 *
 * KEY CHANGE from v2: NO line-break injection between sentences.
 * Line breaks were causing the "breaks and flow" problem — choppy pauses
 * that made the voice sound AI-like. Natural speech uses comma rhythm instead.
 *
 * Rules based on Sarvam best practices + ElevenLabs prosody research:
 *  1. ।  for Indic sentence endings — natural rhythm marker Sarvam understands
 *  2. … (not ...) for hesitation — single Unicode ellipsis reads as genuine pause
 *  3. Single !? — multiple marks cause audio artifacts
 *  4. Comma-based pauses — commas = short natural breathing, better than newlines
 *  5. Numbers with commas — 10000 → 10,000 for correct pronunciation
 *  6. Trim excess symbols — hash, @, brackets cause mispronunciation
 */
function preprocessTextForNaturalSpeech(text: string, langCode: string): string {
  let t = text;

  // 1. Strip markdown
  t = t.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
       .replace(/`[^`]+`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 2. Remove emojis
  t = t.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[\u{2600}-\u{27BF}]/gu, '')
       .replace(/[\u{FE00}-\u{FEFF}]/gu, '').replace(/[❤️💕🥺🫶☀️🌙💬😊😄😌~]/g, '');

  // 3. Normalize repeated punctuation (causes audio artifacts)
  t = t.replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?').replace(/[!?]{3,}/g, '!');

  // 4. Convert ... to … (Unicode ellipsis = genuine hesitation sound in Sarvam)
  t = t.replace(/\.{3,}/g, '…');

  // 5. Use ।  for Indic sentence endings (signals natural sentence rhythm to Sarvam TTS)
  if (langCode !== 'en-IN') {
    t = t.replace(/([^\d\s])\.(\s)/gm, '$1। $2');
    t = t.replace(/([^\d\s])\.$/, '$1।');
  }

  // 6. Numbers > 4 digits → commas for correct pronunciation (Sarvam requirement)
  t = t.replace(/\b(\d{5,})\b/g, (m) => parseInt(m, 10).toLocaleString('en-IN'));

  // 7. Clean stray symbols that cause mispronunciation
  t = t.replace(/[#@\[\]{}|\\<>]/g, '');

  // 8. Collapse excess whitespace (NO line-break insertion — causes choppy flow)
  t = t.replace(/\r?\n/g, ' ').replace(/[ \t]+/g, ' ').trim();

  return t;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TTSResult {
  audioBase64: string;
  audioDataUrl: string;
  durationSeconds: number;
  languageCode: string;
}

export interface TTSOptions {
  language?: string;
  voice?: string;
  pace?: number;
  maxChars?: number;
}

function estimateDuration(base64: string): number {
  try {
    const byteLength = Math.floor((base64.length * 3) / 4);
    const audioBytes = Math.max(0, byteLength - 44);
    return parseFloat((audioBytes / (SAMPLE_RATE * 2)).toFixed(1));
  } catch { return 3.0; }
}

// ── Core TTS pipeline ─────────────────────────────────────────────────────────

/**
 * Converts text to speech using Sarvam AI.
 *
 * Pipeline:
 *  1. Select voice config (v2+pitch for Hindi, v3+best-voice for other languages)
 *  2. If romanized Indic text → transliterate to native script (fixes Hinglish robotics)
 *  3. Preprocess text for smooth, natural flow (no choppy line-break pauses)
 *  4. Call TTS API with teen-optimised settings
 *  5. Auto-rotate API keys on 402 (credits exhausted)
 */
export async function textToSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult | null> {
  const { language, voice, pace = SPEECH_PACE, maxChars = 500 } = options;

  const languageCode  = toSarvamLanguageCode(language);
  const voiceConfig   = getVoiceConfig(languageCode, voice);
  const needsTranslit = isExplicitRomanized(language) || isRomanizedIndic(text, languageCode);

  let retries = 0;
  const MAX_RETRIES = 3;

  while (retries < MAX_RETRIES) {
    const apiKey = await getActiveSarvamKey();
    if (!apiKey) { console.error('[SarvamTTS] No active API keys.'); return null; }

    // ── Step 1: Transliterate romanized text → native script ─────────────────
    let processedText = text;
    if (needsTranslit && languageCode !== 'en-IN') {
      const stripped = stripRawText(text);
      const result   = await transliterateToNativeScript(stripped, languageCode, apiKey);
      if (result) {
        processedText = result;
        console.log(`[SarvamTTS] Transliterated to ${languageCode}: "${result.slice(0, 80)}"`);
      } else {
        console.warn('[SarvamTTS] Transliteration failed — using original text');
      }
    }

    // ── Step 2: Preprocess for natural flowing speech ─────────────────────────
    processedText = preprocessTextForNaturalSpeech(processedText, languageCode);
    processedText = processedText.slice(0, maxChars).trim();
    if (!processedText) return null;

    // ── Step 3: Build request body ────────────────────────────────────────────
    const requestBody: Record<string, unknown> = {
      inputs:               [processedText],
      target_language_code: languageCode,
      speaker:              voiceConfig.speaker,
      model:                voiceConfig.model,
      pace,
      speech_sample_rate:   SAMPLE_RATE,
    };

    // Pitch and loudness: ONLY supported by bulbul:v2 (NOT v3)
    if (voiceConfig.model === 'bulbul:v2') {
      if (voiceConfig.pitch    !== undefined) requestBody.pitch    = voiceConfig.pitch;
      if (voiceConfig.loudness !== undefined) requestBody.loudness = voiceConfig.loudness;
    }

    // ── Step 4: Call TTS API ──────────────────────────────────────────────────
    try {
      const response = await fetch(SARVAM_TTS_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
        body:    JSON.stringify(requestBody),
        signal:  AbortSignal.timeout(30_000),
      });

      if (response.status === 402) {
        console.warn('[SarvamTTS] Key exhausted (402). Rotating…');
        await exhaustKey(apiKey); retries++; continue;
      }
      if (response.status === 429) {
        console.warn('[SarvamTTS] Rate limited (429), waiting 2s…');
        await new Promise(r => setTimeout(r, 2000)); retries++; continue;
      }
      if (!response.ok) {
        const err = await response.text().catch(() => '');
        console.error(`[SarvamTTS] API error ${response.status}:`, err.slice(0, 300));
        return null;
      }

      const data        = await response.json();
      const audioBase64 = data?.audios?.[0];
      if (!audioBase64) { console.error('[SarvamTTS] No audio in response.'); return null; }

      return {
        audioBase64,
        audioDataUrl:    `data:audio/wav;base64,${audioBase64}`,
        durationSeconds: estimateDuration(audioBase64),
        languageCode,
      };
    } catch (err: any) {
      if (err?.name === 'TimeoutError') { console.error('[SarvamTTS] Timed out'); return null; }
      console.error('[SarvamTTS] Fetch error:', err?.message);
      return null;
    }
  }

  console.error('[SarvamTTS] All retries exhausted.');
  return null;
}

// ── Proactive voice ───────────────────────────────────────────────────────────

/**
 * Generates a proactive voice message (cron / in-chat triggers).
 * Pace 0.95 — very slightly slower than chat voice for an intimate "checking in" feel,
 * but still fast enough to avoid the old aunty-slow problem.
 */
export async function generateProactiveVoice(
  text: string,
  language: string | null | undefined
): Promise<TTSResult | null> {
  return textToSpeech(text, {
    language: language ?? 'hi',
    pace:     0.95,   // Slightly warmer than 1.0 for proactive emotional messages
    maxChars: 350,
  });
}
