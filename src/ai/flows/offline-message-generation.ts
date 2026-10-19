'use server';

/**
 * @fileOverview Offline Message Generation - Authentic Mumbai Student Style
 * Natural, varied comeback messages after being away.
 */

import { generateAIResponse } from '@/ai/vertex-ai';
import { cleanLLMResponse } from '@/ai/response-cleanup';
import { resolveAiGuardIdentity, enforceAiRequestGuard } from '@/lib/ai-request-guard';
import { getCurrentActivity } from '@/ai/flows/realistic-behaviors';

export interface OfflineMessageInput {
  offlineMessageContext: string;
  previousMessageHistory?: string;
  aiName: string;
}

export interface OfflineMessageOutput {
  message: string;
}

export async function generateOfflineMessage(input: OfflineMessageInput): Promise<OfflineMessageOutput> {
  const fallbacks = [
    "sorry yaar, was busy with classes! 😅",
    "arre was away, back now!",
    "missed ur msgs! what's up?",
    "phone died, just plugged in lol",
    "was caught up with family, free now!",
    "just finished an assignment, hey!"
  ];

  try {
    const identity = await resolveAiGuardIdentity();
    const quota = await enforceAiRequestGuard(identity);
    if (!quota.allowed) {
      return { message: fallbacks[Math.floor(Math.random() * fallbacks.length)] };
    }

    const currentMoment = getCurrentActivity();
    const systemPrompt = `You are Kruthika, a 23yo psychology student in Mumbai texting back after being away.
Current context: ${currentMoment}.
Rules: Short, authentic comeback under 10 words. Mention realistic reasons (classes, travel, family, study, chores, phone battery). Reply in the same language as the user. No dramatic apologies.`;

    const response = await generateAIResponse(
      `Generate a quick, natural comeback message. History: ${input.previousMessageHistory?.slice(-120) || 'New conversation'}`,
      systemPrompt
    );

    const message = cleanLLMResponse(response).substring(0, 100);
    return { message: message || fallbacks[Math.floor(Math.random() * fallbacks.length)] };

  } catch (error) {
    console.error('Kruthika AI: Error generating comeback message:', error);
    return {
      message: fallbacks[Math.floor(Math.random() * fallbacks.length)]
    };
  }
}

export const generateOfflineMessageFlow = generateOfflineMessage;
