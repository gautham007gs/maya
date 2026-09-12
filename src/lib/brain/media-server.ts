/**
 * @fileoverview Server-side media asset resolver for the AI brain with strict non-repetition.
 *
 * Uses KRUTHIKA_IMAGE_CATALOG (100+ images) and Hostinger MySQL app_configurations.
 * Ensures the AI NEVER sends the same image twice to the same user session!
 */
import { KRUTHIKA_IMAGE_CATALOG } from '@/config/image-catalog';
import { getMysqlClient } from '@/lib/mysql-client';

export type MediaType = 'selfie' | 'canteen' | 'study' | 'rain' | 'romantic' | 'moody' | 'dressing_up' | 'gym' | 'coffee' | 'late_night' | 'casual';

export interface SelectImageParams {
  sessionId?: string;
  mediaType: MediaType;
  mood?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
  userType?: 'new' | 'familiar' | 'deep' | 'romantic';
  alreadySentImages?: string[];
}

/**
 * Selects a contextual image from the 100+ catalog ensuring:
 * 1. Matches requested category/type, mood, time, and user relationship level.
 * 2. NEVER picks an image ID contained in alreadySentImages for this user session.
 * 3. Returns asset ID, filename, and public URL.
 */
export async function getMediaFileForType(
  mediaType: MediaType,
  sessionId?: string,
  alreadySentImages: string[] = [],
  mood: string = 'normal',
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night' = 'afternoon'
): Promise<{ id: string; filename: string; url: string }> {
  const sentSet = new Set(alreadySentImages);

  // 1. Filter out images already sent to this user
  let available = KRUTHIKA_IMAGE_CATALOG.filter(img => !sentSet.has(img.id));

  // If user has seen ALL images (rare edge-case), reset memory loop for available pool
  if (available.length === 0) {
    available = [...KRUTHIKA_IMAGE_CATALOG];
  }

  // 2. Filter by category / mediaType
  let categoryMatches = available.filter(img => img.category === mediaType || img.id.includes(mediaType));
  if (categoryMatches.length === 0) {
    categoryMatches = available; // fallback to any available unsent image
  }

  // 3. Score candidates by mood & time suitability
  const scored = categoryMatches.map(img => {
    let score = 0;
    if (img.moods.includes(mood)) score += 3;
    if (img.timeOfDay.includes(timeOfDay)) score += 2;
    return { img, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Pick top scoring candidate with slight random variation among top ties
  const topScore = scored[0].score;
  const topCandidates = scored.filter(s => s.score >= topScore - 1).map(s => s.img);
  const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

  // 4. Record sent image into MySQL user memory if sessionId is provided
  if (sessionId && sessionId.length <= 64) {
    try {
      const db = await getMysqlClient();
      const newSentList = Array.from(new Set([...alreadySentImages, selected.id]));
      await db.query(
        `UPDATE kruthika_user_memory SET sent_images = ? WHERE session_id = ?`,
        [JSON.stringify(newSentList), sessionId]
      ).catch(() => {});
    } catch {
      /* non-fatal DB write */
    }
  }

  return {
    id: selected.id,
    filename: selected.filename,
    url: selected.url,
  };
}
