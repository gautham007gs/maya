/**
 * @fileOverview Proactive AI Messaging System
 * AI sends messages first without waiting for user input - makes conversations feel more real
 */


export interface ProactiveMessageInput {
  lastMessageTime?: number; // When user last sent a message
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
  conversationHistory: string[];
  userPsychologyProfile?: any;
  relationshipLevel?: number; // 0-1 scale
  totalMessagesToday?: number;
  hasUnreadMessages?: boolean;
  wasAILastSender?: boolean;
}

export interface ProactiveMessageOutput {
  shouldSendMessage: boolean;
  message?: string;
  messageType: 'greeting' | 'check_in' | 'flirty' | 'random_thought' | 'question' | 'none';
  delayBeforeSending?: number; // milliseconds
  priority: 'low' | 'medium' | 'high';
}

// Determines if AI should send a proactive message based on various factors
export function shouldSendProactiveMessage(input: ProactiveMessageInput & { userTypeData?: any }): boolean {
  const now = Date.now();
  const lastMessageTime = input.lastMessageTime || 0;
  const timeSinceLastMessage = now - lastMessageTime;

  // Don't send if user sent message very recently (less than 30 seconds)
  if (timeSinceLastMessage < 30000) return false;

  // Don't send if AI was the last sender (avoid spam)
  if (input.wasAILastSender) return false;

  // Determine user type and adjust behavior accordingly
  let userCategory = 'returning';
  let userTypeMultiplier = 1.0;
  
  if (input.userTypeData) {
    const { dailyMessageCount, relationshipLevel, totalDaysActive } = input.userTypeData;
    
    // New user: encourage engagement with more proactive messages
    if (dailyMessageCount <= 5 && relationshipLevel < 0.3 && totalDaysActive <= 2) {
      userCategory = 'new';
      userTypeMultiplier = 1.8; // 80% more proactive messages for new users
    }
    // Old/addicted user: can be less proactive, they'll initiate
    else if (dailyMessageCount > 20 && relationshipLevel > 0.7 && totalDaysActive > 10) {
      userCategory = 'old';
      userTypeMultiplier = 0.7; // 30% fewer proactive messages
    }
    // Engaged user: balanced approach
    else if (dailyMessageCount > 10 && relationshipLevel > 0.5) {
      userCategory = 'engaged';
      userTypeMultiplier = 1.2; // 20% more proactive messages
    }
  }

  // Time-based probabilities (more likely at certain times)
  const timeBasedChance = getTimeBasedProactiveChance(input.timeOfDay);

  // Increase chance based on relationship level (but adjusted for user type)
  const relationshipMultiplier = 1 + ((input.relationshipLevel || 0) * 0.8);

  // Decrease chance if too many messages today (more lenient for new users)
  const messageLimit = userCategory === 'new' ? 30 : (userCategory === 'old' ? 40 : 50);
  const messageFrequencyPenalty = Math.max(0, 1 - ((input.totalMessagesToday || 0) / messageLimit));

  // Calculate final probability with user type awareness
  let finalChance = timeBasedChance * relationshipMultiplier * messageFrequencyPenalty * userTypeMultiplier;

  // Special scenarios that increase chance (adjusted by user type)
  if (timeSinceLastMessage > 3600000) { // 1 hour
    const silenceMultiplier = userCategory === 'new' ? 2.0 : 1.5; // More aggressive for new users
    finalChance *= silenceMultiplier;
  }

  if (timeSinceLastMessage > 86400000) { // 24 hours
    const dayMultiplier = userCategory === 'new' ? 3.0 : 2.0; // Much more aggressive for new users
    finalChance *= dayMultiplier;
  }

  if (input.timeOfDay === 'morning' && timeSinceLastMessage > 28800000) { // 8 hours, morning greetings
    const morningMultiplier = userCategory === 'new' ? 2.2 : 1.8;
    finalChance *= morningMultiplier;
  }

  // Cap the maximum chance (higher for new users)
  const maxChance = userCategory === 'new' ? 0.6 : (userCategory === 'old' ? 0.3 : 0.4);
  finalChance = Math.min(finalChance, maxChance);

  console.log(`Proactive messaging: User type: ${userCategory}, Final chance: ${(finalChance * 100).toFixed(1)}%`);
  return Math.random() < finalChance;
}

// Get time-based probability for proactive messaging
function getTimeBasedProactiveChance(timeOfDay: string): number {
  const chances = {
    morning: 0.15, // 15% - Good morning messages
    afternoon: 0.08, // 8% - Lower chance during busy hours
    evening: 0.20, // 20% - Most active time for chatting
    night: 0.12 // 12% - Some late night thoughts
  };

  return chances[timeOfDay as keyof typeof chances] || 0.08;
}

console.log('Kruthika AI: Proactive messaging system loaded');