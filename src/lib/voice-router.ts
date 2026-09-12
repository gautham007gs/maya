/**
 * Voice Router — Unified TTS Orchestrator
 *
 * Priority:
 *   1. ElevenLabs (if enabled + keys available) — better emotional quality
 *   2. Sarvam AI  (if enabled + keys available) — best native Indian pronunciation
 *   3. null       (both disabled or all keys exhausted)
 *
 * Feature flags are stored in app_configurations under id = 'voice_provider_settings'
 * and cached in-process for 60 seconds to avoid DB hits on every voice request.
 *
 * Shape of voice_provider_settings JSON:
 *   { elevenlabs_enabled: boolean, sarvam_enabled: boolean }
 */

import { elevenLabsTextToSpeech, type ELTTSResult, type VoiceMood } from './elevenlabs-tts';
import { textToSpeech,            type TTSResult    } from './sarvam-tts';
import { getMysqlClient }                             from './mysql-client';

// ── Feature-flag cache ────────────────────────────────────────────────────────

const CONFIG_ID    = 'voice_provider_settings';
const CACHE_TTL_MS = 60_000; // 60 s

interface VoiceProviderSettings {
  elevenlabs_enabled: boolean;
  sarvam_enabled:     boolean;
}

let _settingsCache: VoiceProviderSettings | null = null;
let _settingsCachedAt = 0;

export async function getVoiceProviderSettings(): Promise<VoiceProviderSettings> {
  const now = Date.now();
  if (_settingsCache && now - _settingsCachedAt < CACHE_TTL_MS) {
    return _settingsCache;
  }

  try {
    const db = await getMysqlClient();
    const [rows]: any = await db.query(
      `SELECT settings FROM app_configurations WHERE id = ? LIMIT 1`,
      [CONFIG_ID]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const parsed = typeof rows[0].settings === 'string'
        ? JSON.parse(rows[0].settings)
        : rows[0].settings;
      _settingsCache    = { elevenlabs_enabled: true, sarvam_enabled: true, ...parsed };
      _settingsCachedAt = now;
      return _settingsCache!;
    }
  } catch (err) {
    console.error('[VoiceRouter] Failed to load voice provider settings:', err);
  }

  // Default: both enabled
  return { elevenlabs_enabled: true, sarvam_enabled: true };
}

export async function saveVoiceProviderSettings(
  settings: Partial<VoiceProviderSettings>
): Promise<void> {
  // Merge with existing
  const current = await getVoiceProviderSettings();
  const merged  = { ...current, ...settings };

  const db = await getMysqlClient();
  // No CAST(... AS JSON) — MySQL-only syntax, breaks on MariaDB (Hostinger).
  await db.query(
    `INSERT INTO app_configurations (id, settings)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE settings = ?`,
    [CONFIG_ID, JSON.stringify(merged), JSON.stringify(merged)]
  );

  // Bust cache
  _settingsCache    = merged;
  _settingsCachedAt = Date.now();
  console.log('[VoiceRouter] Voice provider settings saved:', merged);
}

// ── Unified result type ───────────────────────────────────────────────────────

export interface VoiceResult {
  audioDataUrl:    string;
  durationSeconds: number;
  languageCode?:   string;
  provider:        'elevenlabs' | 'sarvam';
}

// ── Main router ───────────────────────────────────────────────────────────────

/**
 * Generate TTS audio using the configured provider priority.
 *
 * @param text      - The text to speak
 * @param language  - Language hint ('hi', 'ta', 'kn', 'hinglish', etc.)
 * @param maxChars  - Max characters to pass to TTS (default 250)
 * @param mood      - ElevenLabs voice mood preset (flirty/intimate/sweet/playful/caring/default)
 */
export async function generateVoice(
  text: string,
  language: string = 'hi',
  maxChars: number = 250,
  mood: VoiceMood = 'default'
): Promise<VoiceResult | null> {
  const settings = await getVoiceProviderSettings();

  // 1. ElevenLabs first
  if (settings.elevenlabs_enabled) {
    try {
      const result: ELTTSResult | null = await elevenLabsTextToSpeech(text, { maxChars, mood });
      if (result) {
        console.log(`[VoiceRouter] ✅ ElevenLabs TTS success (mood=${mood})`);
        return {
          audioDataUrl:    result.audioDataUrl,
          durationSeconds: result.durationSeconds,
          provider:        'elevenlabs',
        };
      }
      console.warn('[VoiceRouter] ElevenLabs returned null — falling through to Sarvam');
    } catch (err) {
      console.error('[VoiceRouter] ElevenLabs error:', err);
    }
  }

  // 2. Sarvam fallback
  if (settings.sarvam_enabled) {
    try {
      const result: TTSResult | null = await textToSpeech(text, { language, maxChars });
      if (result) {
        console.log('[VoiceRouter] ✅ Sarvam TTS fallback success');
        return {
          audioDataUrl:    result.audioDataUrl,
          durationSeconds: result.durationSeconds,
          languageCode:    result.languageCode,
          provider:        'sarvam',
        };
      }
      console.warn('[VoiceRouter] Sarvam also returned null');
    } catch (err) {
      console.error('[VoiceRouter] Sarvam error:', err);
    }
  }

  if (!settings.elevenlabs_enabled && !settings.sarvam_enabled) {
    console.error('[VoiceRouter] Both providers disabled — no voice generated');
  } else {
    console.error('[VoiceRouter] All providers exhausted/failed');
  }

  return null;
}

/**
 * Proactive voice (cron/trigger) — slightly more intimate pace via Sarvam,
 * ElevenLabs has no pace control so same call.
 */
export async function generateProactiveVoiceRouted(
  text: string,
  language: string | null | undefined
): Promise<VoiceResult | null> {
  const settings = await getVoiceProviderSettings();

  if (settings.elevenlabs_enabled) {
    try {
      const result = await elevenLabsTextToSpeech(text, { maxChars: 350 });
      if (result) {
        return { audioDataUrl: result.audioDataUrl, durationSeconds: result.durationSeconds, provider: 'elevenlabs' };
      }
    } catch {}
  }

  if (settings.sarvam_enabled) {
    const { generateProactiveVoice } = await import('./sarvam-tts');
    const result = await generateProactiveVoice(text, language);
    if (result) {
      return { audioDataUrl: result.audioDataUrl, durationSeconds: result.durationSeconds, languageCode: result.languageCode, provider: 'sarvam' };
    }
  }

  return null;
}
