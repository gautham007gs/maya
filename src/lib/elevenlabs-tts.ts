/**
 * ElevenLabs TTS Client — Indian Girlfriend Voice Edition v2
 *
 * VOICE SELECTION RESEARCH:
 * ─────────────────────────────────────────────────────────────────────────────
 * Goal: teen-like, sweet, intimate, flirty, melting — "how couples talk"
 *
 * Best available voice on free tier for Indian girlfriend persona:
 *   • Jessica (cgSgspJ2msm6clMCkdW9) — "Playful, Bright, Warm" | female | young
 *     → Best match for Indian girlfriend feel in English/Hinglish/Hindi.
 *       Bright warmth + natural playfulness = how a young Indian girl sounds
 *       when she's being sweet and intimate. With eleven_multilingual_v2 it
 *       handles Hindi, Hinglish, Tamil, Telugu, Kannada natively.
 *
 *   • Laura (FGY2WhTYpPnrIDTdsKH5) — "Enthusiast, Quirky Attitude" | young
 *     → Backup: more energetic/quirky energy, good for playful/excited moments.
 *
 * MODEL: eleven_multilingual_v2
 *   — 29 languages including Hindi, Tamil, Telugu, Kannada, Bengali
 *   — No transliteration needed (unlike Sarvam) — feeds native script directly
 *   — Better emotional range than turbo/flash; worth the extra latency
 *
 * MOOD-BASED VOICE SETTINGS:
 * ─────────────────────────────────────────────────────────────────────────────
 * stability:        Lower = more emotionally expressive (voice varies pitch/pace).
 *                   Higher = robotic consistency. Teen girlfriend = low stability.
 * similarity_boost: How closely to stay to the original voice DNA. 0.80–0.88.
 * style:            Stylistic exaggeration. Higher = more dramatic inflections.
 *                   Too high (>0.80) sounds theatrical; aim for 0.60–0.75.
 * use_speaker_boost: Always true — adds vocal presence and clarity.
 *
 * ── Mood presets ────────────────────────────────────────────────────────────
 *
 *  FLIRTY    — stability 0.14, style 0.72: voice rises on excitement, playful
 *  INTIMATE  — stability 0.10, style 0.68: whisper-like, soft, close-talking
 *  SWEET     — stability 0.22, style 0.58: warm and caring, everyday tone
 *  PLAYFUL   — stability 0.18, style 0.75: energetic, laughing energy
 *  CARING    — stability 0.25, style 0.52: gentle, reassuring, mature warmth
 *  AI_PROOF  — stability 0.12, style 0.70: slightly defensive + real, "main AI nahi"
 *
 * PSYCHOLOGICAL VOICE NOTES:
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian teen girlfriend speech patterns that EL reads naturally:
 *   • "na" at end = soft request → voice softens ("aa jao na")
 *   • "..." = hesitation/pause → voice slows beautifully
 *   • "yaar" = friend-zone warm → adds casual warmth
 *   • Repeated words = emphasis ("bahut bahut miss kiya")
 *   • Questions with "kya" = rising inflection
 *   • Short sentences = punchy, text-message feel
 *   • "sach mein" = sincerity signal → voice gets earnest
 */

import { getActiveElevenLabsKey, exhaustElevenLabsKey } from './elevenlabs-key-manager';

const EL_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// ── Voice config ──────────────────────────────────────────────────────────────

const PRIMARY_VOICE_ID  = 'cgSgspJ2msm6clMCkdW9'; // Jessica — playful, bright, warm, young
const FALLBACK_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah   — young female, warm backup
const MODEL_ID          = 'eleven_multilingual_v2';  // best multilingual + emotional quality

// ── Mood-based voice settings ─────────────────────────────────────────────────

export type VoiceMood = 'flirty' | 'intimate' | 'sweet' | 'playful' | 'caring' | 'ai_proof' | 'default';

const MOOD_SETTINGS: Record<VoiceMood, object> = {
  /** Flirty — voice rises, playful lilt, teasing inflections */
  flirty: {
    stability:        0.14,   // very low = maximum natural variation, voice goes up on excitement
    similarity_boost: 0.82,
    style:            0.72,   // high style = dramatic inflection = "ooh are you really?" energy
    use_speaker_boost: true,
  },
  /** Intimate — soft, close, almost whispery — late night couple talk */
  intimate: {
    stability:        0.10,   // ultra-low = breathy variation, intimate closeness
    similarity_boost: 0.88,   // high = stays true to her voice
    style:            0.68,
    use_speaker_boost: true,
  },
  /** Sweet — warm, caring everyday girlfriend tone */
  sweet: {
    stability:        0.22,
    similarity_boost: 0.85,
    style:            0.58,
    use_speaker_boost: true,
  },
  /** Playful — excited, energetic, laughing energy — "oh my god finally!" */
  playful: {
    stability:        0.18,
    similarity_boost: 0.80,
    style:            0.75,   // highest style = most theatrical = most fun
    use_speaker_boost: true,
  },
  /** Caring — gentle, mature warmth — when she's being supportive */
  caring: {
    stability:        0.25,
    similarity_boost: 0.85,
    style:            0.52,
    use_speaker_boost: true,
  },
  /** AI Proof — slightly defensive + earnest, "main AI nahi hoon" authenticity */
  ai_proof: {
    stability:        0.12,
    similarity_boost: 0.84,
    style:            0.70,
    use_speaker_boost: true,
  },
  /** Default — balanced, natural girlfriend tone */
  default: {
    stability:        0.20,
    similarity_boost: 0.84,
    style:            0.62,
    use_speaker_boost: true,
  },
};

// ── Text preprocessing ────────────────────────────────────────────────────────

/**
 * Prepares text for ElevenLabs.
 * ElevenLabs multilingual_v2 handles native Hindi/Indic script directly.
 * Key: normalize punctuation to guide emotional delivery.
 *
 * Emotional punctuation guide for EL:
 *  "..."      → natural hesitation/pause (great for intimate tone)
 *  "!"        → excitement (use sparingly)
 *  ","        → breath pause
 *  Short sent → punchy, conversational
 *  Long sent  → flowing, narrative
 */
function preprocessForElevenLabs(text: string): string {
  let t = text;

  // Strip markdown
  t = t.replace(/\*\*(.*?)\*\*/g, '$1')
       .replace(/\*(.*?)\*/g, '$1')
       .replace(/`[^`]+`/g, '')
       .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove emojis (EL reads them as "emoji" or "heart emoji" — bad for voice)
  t = t.replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
       .replace(/[\u{2600}-\u{27BF}]/gu, '')
       .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
       .replace(/[❤️💕🥺🫶☀️🌙💬😊😄😌~💔🫂🤍]/g, '');

  // Collapse multiple punctuation (causes audio artifacts)
  t = t.replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?').replace(/[!?]{3,}/g, '!');

  // Convert Indic danda (।) to period — EL doesn't understand danda
  t = t.replace(/।/g, '.');

  // Convert hyphens used as pauses to commas (EL pauses on commas)
  t = t.replace(/\s+[-–—]\s+/g, ', ');

  // Collapse excess whitespace / newlines
  t = t.replace(/\r?\n/g, ' ').replace(/[ \t]+/g, ' ').trim();

  return t;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ELTTSResult {
  audioBase64: string;
  audioDataUrl: string;   // data:audio/mpeg;base64,...
  durationSeconds: number;
  provider: 'elevenlabs';
  mood: VoiceMood;
}

function estimateELDuration(base64: string): number {
  try {
    // MP3 at ~128kbps ≈ 16000 bytes/second
    const bytes = Math.floor((base64.length * 3) / 4);
    return parseFloat((bytes / 16000).toFixed(1));
  } catch { return 3.0; }
}

// ── Core TTS ──────────────────────────────────────────────────────────────────

/**
 * Converts text to speech using ElevenLabs API.
 *
 * Pipeline:
 *  1. Preprocess text (strip markdown/emojis, normalize punctuation)
 *  2. Select mood-appropriate voice settings
 *  3. Call ElevenLabs TTS API
 *  4. On 402/401 (exhausted/banned) → rotate key and retry
 *  5. On 429 (rate-limited) → wait 2s and retry
 *  6. Returns MP3 as base64 data URL
 *
 * @param text     Text to speak (will be preprocessed)
 * @param options.maxChars  Max characters (default 500)
 * @param options.voiceId   Override voice ID
 * @param options.mood      Voice mood preset (affects emotional delivery)
 */
export async function elevenLabsTextToSpeech(
  text: string,
  options: { maxChars?: number; voiceId?: string; mood?: VoiceMood } = {}
): Promise<ELTTSResult | null> {
  const { maxChars = 500, voiceId, mood = 'default' } = options;

  let processedText = preprocessForElevenLabs(text).slice(0, maxChars).trim();
  if (!processedText) return null;

  const voices = voiceId
    ? [voiceId]
    : [PRIMARY_VOICE_ID, FALLBACK_VOICE_ID];

  const voiceSettings = MOOD_SETTINGS[mood] ?? MOOD_SETTINGS.default;

  let retries = 0;
  const MAX_RETRIES = 4;

  while (retries < MAX_RETRIES) {
    const apiKey = await getActiveElevenLabsKey();
    if (!apiKey) {
      console.error('[ElevenLabsTTS] No active API keys.');
      return null;
    }

    const currentVoice = voices[Math.min(retries, voices.length - 1)];
    const voiceName = currentVoice === PRIMARY_VOICE_ID ? 'Jessica' : 'Sarah';

    try {
      const response = await fetch(`${EL_TTS_URL}/${currentVoice}`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'xi-api-key':    apiKey,
          'Accept':        'audio/mpeg',
        },
        body: JSON.stringify({
          text:           processedText,
          model_id:       MODEL_ID,
          voice_settings: voiceSettings,
        }),
        signal: AbortSignal.timeout(35_000), // EL multilingual can be slow
      });

      // Key exhausted or banned
      if (response.status === 402 || response.status === 401) {
        const errText = await response.text().catch(() => '');
        console.warn(`[ElevenLabsTTS] Key exhausted/invalid (${response.status}): ${errText.slice(0, 120)}`);
        await exhaustElevenLabsKey(apiKey);
        retries++;
        continue;
      }

      // Rate limited
      if (response.status === 429) {
        console.warn('[ElevenLabsTTS] Rate limited (429), waiting 2s…');
        await new Promise(r => setTimeout(r, 2000));
        retries++;
        continue;
      }

      // Other error
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[ElevenLabsTTS] API error ${response.status}: ${errText.slice(0, 300)}`);
        return null;
      }

      // Success — response is raw MP3 bytes
      const audioBuffer = await response.arrayBuffer();
      if (!audioBuffer || audioBuffer.byteLength < 100) {
        console.error('[ElevenLabsTTS] Empty audio response.');
        return null;
      }

      const audioBase64 = Buffer.from(audioBuffer).toString('base64');

      console.log(`[ElevenLabsTTS] ✅ Generated ${(audioBuffer.byteLength / 1024).toFixed(0)}KB audio | voice=${voiceName} | mood=${mood}`);

      return {
        audioBase64,
        audioDataUrl:    `data:audio/mpeg;base64,${audioBase64}`,
        durationSeconds: estimateELDuration(audioBase64),
        provider:        'elevenlabs',
        mood,
      };

    } catch (err: any) {
      if (err?.name === 'TimeoutError') {
        console.error('[ElevenLabsTTS] Request timed out (35s)');
        return null;
      }
      console.error('[ElevenLabsTTS] Fetch error:', err?.message);
      return null;
    }
  }

  console.error('[ElevenLabsTTS] All retries exhausted.');
  return null;
}
