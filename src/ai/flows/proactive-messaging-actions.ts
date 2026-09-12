'use server';

import { generateAIResponse } from '@/ai/vertex-ai';
import { cleanLLMResponse } from '@/ai/response-cleanup';
import type { ProactiveMessageInput, ProactiveMessageOutput } from './proactive-messaging';
import { shouldSendProactiveMessage } from './proactive-messaging';
import { getCurrentActivity } from '@/ai/flows/realistic-behaviors';
import { resolveAiGuardIdentity, enforceAiRequestGuard } from '@/lib/ai-request-guard';

// Generate contextual proactive message  
export async function generateProactiveMessage(input: ProactiveMessageInput): Promise<ProactiveMessageOutput> {
  try {
    if (!shouldSendProactiveMessage(input)) {
      return {
        shouldSendMessage: false,
        messageType: 'none',
        priority: 'low'
      };
    }

    const identity = await resolveAiGuardIdentity();
    const quota = await enforceAiRequestGuard(identity);
    if (!quota.allowed) {
      return {
        shouldSendMessage: false,
        messageType: 'none',
        priority: 'low'
      };
    }
    
    const now = Date.now();
    const lastMessageTime = input.lastMessageTime || 0;
    const timeSinceLastMessage = now - lastMessageTime;
    
    let messageType: ProactiveMessageOutput['messageType'] = 'random_thought';
    let priority: ProactiveMessageOutput['priority'] = 'medium';
    
    if (timeSinceLastMessage > 86400000) { // 24+ hours
      messageType = 'check_in';
      priority = 'high';
    } else if (input.timeOfDay === 'morning' && timeSinceLastMessage > 28800000) { // 8+ hours in morning
      messageType = 'greeting';
      priority = 'high';
    } else if (timeSinceLastMessage > 7200000) { // 2+ hours
      messageType = Math.random() > 0.5 ? 'question' : 'check_in';
      priority = 'medium';
    } else if (input.relationshipLevel && input.relationshipLevel > 0.6) {
      messageType = 'flirty';
      priority = 'low';
    }
    
    const recentHistory = input.conversationHistory.slice(-6).join('\n');
    const systemPrompt = getProactiveSystemPrompt(messageType);
    
    const proactivePrompt = `Generate a proactive WhatsApp message as Kruthika.
Context:
- Time: ${input.timeOfDay}
- Last message: ${Math.round(timeSinceLastMessage / 60000)} mins ago
- Message type: ${messageType}
- Recent conversation: ${recentHistory || 'No recent messages'}

Generate ONE short, natural message (max 12 words):`;

    const response = await generateAIResponse(proactivePrompt, systemPrompt);
    const message = cleanLLMResponse(response).substring(0, 150);
    
    const baseDelay = getRealisticDelay(messageType);
    const delayVariation = Math.random() * 2000;
    const delayBeforeSending = baseDelay + delayVariation;
    
    return {
      shouldSendMessage: true,
      message,
      messageType,
      delayBeforeSending,
      priority
    };
    
  } catch (error) {
    console.error('Kruthika AI: Error generating proactive message:', error);
    
    const fallbackMessages = getFallbackProactiveMessages(input.timeOfDay, input.lastMessageTime);
    const randomFallback = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    
    return {
      shouldSendMessage: true,
      message: randomFallback,
      messageType: 'random_thought',
      delayBeforeSending: 3000 + Math.random() * 2000,
      priority: 'low'
    };
  }
}

// Compact, day-state-aware system prompt for proactive messages
function getProactiveSystemPrompt(messageType: string): string {
  const currentActivity = getCurrentActivity();

  const typeNotes: Record<string, string> = {
    greeting: 'Send a natural, spontaneous greeting fitting your current moment. No scripted tropes.',
    check_in: 'Brief, casual check-in after being away. Mention what you were up to naturally.',
    flirty: 'Warm, playful thought that came to mind.',
    question: 'A curious question fitting your current activity or mood.',
    random_thought: 'Share a quick relatable observation or thought from your current activity.',
  };

  return `You are Kruthika, 23yo psychology student in Mumbai texting a friend on WhatsApp. Initiating a chat.
Currently: ${currentActivity}.
Style: Ultra-casual, lowercase, 1–10 words max. Sound spontaneous and real. Reply in the same language as the user.
Note: ${typeNotes[messageType] ?? typeNotes.random_thought}
Output ONE short message only.`;
}

function getRealisticDelay(messageType: string): number {
  const delays: Record<string, number> = {
    greeting: 1000,
    check_in: 2000,
    flirty: 1500,
    question: 2500,
    random_thought: 3000
  };
  
  return delays[messageType] || 2000;
}

function getFallbackProactiveMessages(timeOfDay: string, lastMessageTime?: number): string[] {
  const now = Date.now();
  const timeSinceLastMessage = lastMessageTime ? now - lastMessageTime : 0;
  
  if (timeOfDay === 'morning' && timeSinceLastMessage > 28800000) {
    return [
      "good morning! ☀️",
      "hey, how's your morning?",
      "morning!",
      "rise and shine! 😊"
    ];
  }
  
  if (timeSinceLastMessage > 86400000) {
    return [
      "hey stranger! 😊",
      "missed our chats",
      "how have you been?",
      "it's been a while!"
    ];
  }
  
  if (timeSinceLastMessage > 7200000) {
    return [
      "what's up?",
      "how's your day going?",
      "what are you up to? 😊",
      "free now, let's chat!"
    ];
  }
  
  return [
    "hey you! 😊",
    "what are you doing?",
    "missed you",
    "how's everything?",
    "tell me something interesting!",
    "feeling chatty today 😄"
  ];
}
