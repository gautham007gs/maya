/**
 * Validation bounds for client-controlled memory persistence (/api/memory POST).
 */

export const MAX_MEMORY_BODY_BYTES = 48_000;
export const MAX_MEMORY_ARRAY_LENGTH = 50;
export const MAX_MEMORY_STRING_LENGTH = 500;
export const MAX_MEMORY_JSON_DEPTH = 6;

function depthOf(value: unknown, current = 0): number {
  if (current > MAX_MEMORY_JSON_DEPTH) return current;
  if (value === null || typeof value !== 'object') return current;
  if (Array.isArray(value)) {
    return Math.max(current, ...value.map(v => depthOf(v, current + 1)));
  }
  return Math.max(current, ...Object.values(value as Record<string, unknown>).map(v => depthOf(v, current + 1)));
}

function sanitizeStringArray(arr: unknown, maxLen = MAX_MEMORY_ARRAY_LENGTH): string[] | null {
  if (!Array.isArray(arr)) return null;
  if (arr.length > maxLen) return null;
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== 'string') return null;
    if (item.length > MAX_MEMORY_STRING_LENGTH) return null;
    out.push(item);
  }
  return out;
}

export interface ValidatedMemoryPayload {
  userName: string | null;
  facts: string[];
  topics: string[];
  relationshipLevel: number;
  messageCount: number;
  sharedMoments: unknown[];
  consecutiveDays: number;
  firstInteraction: number | null;
  emotionalPatterns: unknown[];
  attachmentLean: string | null;
  onesignalPlayerId: string | null;
  onesignalExternalId: string | null;
  sessionCount: number;
  sentImages: string[];
  sentVoices: string[];
  userLanguage: string | null;
  typingStyle: string | null;
  episodicEvents: unknown[];
}

export function validateMemoryPayload(body: unknown): { ok: true; data: ValidatedMemoryPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid body' };
  }
  const b = body as Record<string, unknown>;
  if (depthOf(b) > MAX_MEMORY_JSON_DEPTH) {
    return { ok: false, error: 'Payload too deeply nested' };
  }

  const facts = sanitizeStringArray(b.facts);
  if (b.facts !== undefined && facts === null) {
    return { ok: false, error: 'Invalid or oversized facts array' };
  }
  const topics = sanitizeStringArray(b.topics);
  if (b.topics !== undefined && topics === null) {
    return { ok: false, error: 'Invalid or oversized topics array' };
  }
  const sentImages = sanitizeStringArray(b.sentImages, 30);
  if (b.sentImages !== undefined && sentImages === null) {
    return { ok: false, error: 'Invalid or oversized sentImages array' };
  }
  const sentVoices = sanitizeStringArray(b.sentVoices, 30);
  if (b.sentVoices !== undefined && sentVoices === null) {
    return { ok: false, error: 'Invalid or oversized sentVoices array' };
  }

  const userName = typeof b.userName === 'string' ? b.userName.slice(0, 100) : null;
  const attachmentLean = typeof b.attachmentLean === 'string' ? b.attachmentLean.slice(0, 30) : null;
  const userLanguage = typeof b.userLanguage === 'string' ? b.userLanguage.slice(0, 40) : null;
  const typingStyle = typeof b.typingStyle === 'string' ? b.typingStyle.slice(0, 40) : null;
  const onesignalPlayerId = typeof b.onesignalPlayerId === 'string' ? b.onesignalPlayerId.slice(0, 64) : null;
  const onesignalExternalId = typeof b.onesignalExternalId === 'string' ? b.onesignalExternalId.slice(0, 64) : null;

  const sharedMoments = Array.isArray(b.sharedMoments) ? b.sharedMoments.slice(0, MAX_MEMORY_ARRAY_LENGTH) : [];
  const emotionalPatterns = Array.isArray(b.emotionalPatterns) ? b.emotionalPatterns.slice(0, MAX_MEMORY_ARRAY_LENGTH) : [];
  const episodicEvents = Array.isArray(b.episodicEvents) ? b.episodicEvents.slice(0, MAX_MEMORY_ARRAY_LENGTH) : [];

  const relationshipLevel = Math.max(0, Math.min(1, Number(b.relationshipLevel) || 0.1));
  const messageCount = Math.max(0, Math.min(1_000_000, Number(b.messageCount) || 0));
  const consecutiveDays = Math.max(0, Math.min(10_000, Number(b.consecutiveDays) || 0));
  const sessionCount = Math.max(1, Math.min(10_000, Number(b.sessionCount) || 1));
  const firstInteraction = b.firstInteraction != null ? Number(b.firstInteraction) : null;

  return {
    ok: true,
    data: {
      userName,
      facts: facts ?? [],
      topics: topics ?? [],
      relationshipLevel,
      messageCount,
      sharedMoments,
      consecutiveDays,
      firstInteraction: Number.isFinite(firstInteraction) ? firstInteraction : null,
      emotionalPatterns,
      attachmentLean,
      onesignalPlayerId,
      onesignalExternalId,
      sessionCount,
      sentImages: sentImages ?? [],
      sentVoices: sentVoices ?? [],
      userLanguage,
      typingStyle,
      episodicEvents,
    },
  };
}
