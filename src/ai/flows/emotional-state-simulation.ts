/**
 * @fileOverview Compatibility barrel — re-exports from src/ai/chat.ts.
 *
 * Existing imports in:
 *   - src/app/maya-chat/actions.ts
 *   - src/app/api/chat/route.ts
 *   - src/app/maya-chat/page.tsx
 * continue to work without modification.
 *
 * NOTE: No 'use server' here — this module is imported by actions.ts (which
 * carries 'use server' itself). Adding 'use server' here would force every
 * export to become an async Server Action, breaking synchronous utilities.
 */

export { generateResponse } from '@/ai/chat';
export type { EmotionalStateInput, EmotionalStateOutput } from '@/lib/brain/types';
