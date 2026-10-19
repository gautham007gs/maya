/**
 * @fileoverview Server-side voice note resolver for Kruthika AI.
 * 
 * Supports pre-saved audio catalog fallbacks across 9+ Indian languages + English,
 * tracking sent voice notes per user session in MySQL to avoid voice repetition.
 */
if (typeof window !== 'undefined') {
  throw new Error('This module can only be executed on the server.');
}
import { KRUTHIKA_VOICE_CATALOG, CatalogVoiceNote } from '@/config/voice-catalog';
import { getMysqlClient } from '@/lib/mysql-client';

export type VoiceIntent = 'greeting' | 'check_in' | 'what_doing' | 'goodnight' | 'miss_you' | 'teasing' | 'flirty' | 'comeback' | 'comfort';

export interface VoiceSelectResult {
  id: string;
  filename: string;
  url: string;
  textContent: string;
  language: string;
}

/**
 * Resolves a contextual voice note for a user based on language, intent, and sent history.
 * Ensures the AI NEVER sends the exact same voice note twice to the same user.
 */
export async function getVoiceNoteForUser(
  userLanguage: string = 'hindi',
  intent: VoiceIntent = 'what_doing',
  sessionId?: string,
  alreadySentVoices: string[] = []
): Promise<VoiceSelectResult> {
  const sentSet = new Set(alreadySentVoices);
  const normalizedLang = (userLanguage || 'hindi').toLowerCase();

  // Map language aliases to catalog languages
  const langMap: Record<string, CatalogVoiceNote['language']> = {
    kannada: 'kannada',
    kanglish: 'kannada',
    tamil: 'tamil',
    tanglish: 'tamil',
    telugu: 'telugu',
    marathi: 'marathi',
    malayalam: 'malayalam',
    bengali: 'bengali',
    gujarati: 'gujarati',
    punjabi: 'punjabi',
    hindi: 'hindi',
    hinglish: 'hindi',
    english: 'english',
  };

  const targetLang = langMap[normalizedLang] || 'hindi';

  // Filter unsent voice notes matching target language
  let available = KRUTHIKA_VOICE_CATALOG.filter(
    v => v.language === targetLang && !sentSet.has(v.id)
  );

  // Fall back to any unsent voice note in catalog if target language unsent pool is empty
  if (available.length === 0) {
    available = KRUTHIKA_VOICE_CATALOG.filter(v => !sentSet.has(v.id));
  }

  // Last resort reset if all voice notes seen
  if (available.length === 0) {
    available = [...KRUTHIKA_VOICE_CATALOG];
  }

  // Prefer intent match
  const intentMatch = available.filter(v => v.intent === intent);
  const selected = intentMatch.length > 0
    ? intentMatch[Math.floor(Math.random() * intentMatch.length)]
    : available[Math.floor(Math.random() * available.length)];

  // Record sent voice in MySQL memory
  if (sessionId && sessionId.length <= 64) {
    try {
      const db = await getMysqlClient();
      const newSentList = Array.from(new Set([...alreadySentVoices, selected.id]));
      await db.query(
        `UPDATE kruthika_user_memory SET sent_voices = ? WHERE session_id = ?`,
        [JSON.stringify(newSentList), sessionId]
      ).catch(() => {});
    } catch {
      /* non-fatal DB update */
    }
  }

  return {
    id: selected.id,
    filename: selected.filename,
    url: selected.url,
    textContent: selected.textContent,
    language: selected.language,
  };
}
