'use client';

interface ConversationContext {
  topics: Array<{
    topic: string;
    lastMentioned: number;
    userInterest: number; // 0-1 scale
    kruthikaInterest: number; // 0-1 scale
  }>;
  relationshipLevel: number; // 0-1 scale
  userPersonality: {
    communicationStyle: 'short' | 'long' | 'emoji-heavy' | 'formal';
    humor: 'sarcastic' | 'playful' | 'dry' | 'wholesome';
    topics: string[];
    preferredTime: string[];
  };
  pastEmotions: Array<{
    emotion: string;
    timestamp: number;
    trigger: string;
  }>;
  conversationPatterns: {
    avgResponseTime: number;
    msgFrequency: number;
    lastActiveTime: number;
    engagementLevel: number;
  };
  sharedMoments: Array<{
    moment: string;
    timestamp: number;
    importance: number;
  }>;
  firstInteraction?: number; // Added for tracking first interaction
  totalDays?: number; // Added for tracking total days of interaction
}

const CONVERSATION_CONTEXT_KEY = 'kruthika_conversation_context';

export function getConversationContext(): ConversationContext {
  if (typeof window === 'undefined') return getDefaultContext();

  try {
    const stored = localStorage.getItem(CONVERSATION_CONTEXT_KEY);
    return stored ? JSON.parse(stored) : getDefaultContext();
  } catch {
    return getDefaultContext();
  }
}

function getDefaultContext(): ConversationContext {
  return {
    topics: [],
    relationshipLevel: 0,
    userPersonality: {
      communicationStyle: 'short',
      humor: 'playful',
      topics: [],
      preferredTime: []
    },
    pastEmotions: [],
    conversationPatterns: {
      avgResponseTime: 0,
      msgFrequency: 0,
      lastActiveTime: Date.now(),
      engagementLevel: 0.5
    },
    sharedMoments: [],
    firstInteraction: Date.now(), // Set default first interaction
    totalDays: 1
  };
}

export function updateConversationContext(
  userMessage: string,
  userEmotion: string,
  context: ConversationContext
): ConversationContext {
  const updated = { ...context };

  // Increase relationship level more dynamically
  const msgLength = userMessage.length;
  const timeSpent = Date.now() - updated.conversationPatterns.lastActiveTime;

  if (msgLength > 50) updated.relationshipLevel += 0.05; // Longer messages = more engagement
  if (timeSpent < 60000) updated.relationshipLevel += 0.02; // Quick responses = engagement
  updated.relationshipLevel = Math.min(1, updated.relationshipLevel);

  // Track topics with better weighting and sentiment
  const topics = extractTopics(userMessage);
  const messageSentiment = userEmotion === 'positive' || userEmotion === 'excited' ? 'positive' : 
                          userEmotion === 'negative' || userEmotion === 'sad' ? 'negative' : 'neutral';
  
  topics.forEach(topic => {
    const existing = updated.topics.find(t => t.topic === topic);
    if (existing) {
      existing.lastMentioned = Date.now();
      existing.userInterest = Math.min(1, existing.userInterest + 0.15);
      // Track sentiment per topic for context-aware responses
      (existing as any).lastSentiment = messageSentiment;
    } else {
      updated.topics.push({
        topic,
        lastMentioned: Date.now(),
        userInterest: 0.6,
        kruthikaInterest: getKruthikaInterestInTopic(topic),
        ...(messageSentiment !== 'neutral' && { lastSentiment: messageSentiment })
      } as any);
    }
  });

  // Enhanced emotional tracking
  if (userEmotion !== 'neutral') {
    updated.pastEmotions.push({
      emotion: userEmotion,
      timestamp: Date.now(),
      trigger: userMessage.substring(0, 50)
    });

    updated.pastEmotions = updated.pastEmotions.slice(-15);
  }

  // Better communication style detection
  const emojiCount = (userMessage.match(/[😊😅😂🤣😍🥰😘😉😎🤔😴😢😭🙄]/g) || []).length;
  if (emojiCount > 2) updated.userPersonality.communicationStyle = 'emoji-heavy';
  else if (userMessage.length < 25) updated.userPersonality.communicationStyle = 'short';
  else if (userMessage.length > 80) updated.userPersonality.communicationStyle = 'long';

  // Track engagement patterns
  updated.conversationPatterns.lastActiveTime = Date.now();
  updated.conversationPatterns.msgFrequency += 1;

  // Calculate engagement based on message quality
  if (userMessage.includes('?') || msgLength > 30 || emojiCount > 0) {
    updated.conversationPatterns.engagementLevel = Math.min(1,
      updated.conversationPatterns.engagementLevel + 0.1);
  }

  // Track shared moments
  if (msgLength > 40 && (userMessage.includes('feel') || userMessage.includes('think'))) {
    updated.sharedMoments.push({
      moment: userMessage.substring(0, 60),
      timestamp: Date.now(),
      importance: msgLength > 80 ? 0.8 : 0.5
    });
    updated.sharedMoments = updated.sharedMoments.slice(-10);
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CONVERSATION_CONTEXT_KEY, JSON.stringify(updated));
    } catch (error) {
      console.warn('Error saving conversation context:', error);
    }
  }

  return updated;
}

// Enhanced relationship and preference tracking
export const updateRelationshipLevel = (userMessage: string): number => {
  try {
    const currentLevel = getConversationContext()?.relationshipLevel || 0.1;
    let increment = 0;

    // Analyze message for relationship indicators with better detection
    const message = userMessage.toLowerCase();

    // Strong emotional indicators
    if (message.includes('love you') || message.includes('i love')) {
      increment = 0.15;
    } else if (message.includes('miss you') || message.includes('thinking of you')) {
      increment = 0.12;
    } else if (message.includes('like you') || message.includes('care about')) {
      increment = 0.08;
    } else if (message.includes('beautiful') || message.includes('amazing') || message.includes('perfect')) {
      increment = 0.06;
    } else if (message.length > 100) {
      increment = 0.03; // Very long messages show deep engagement
    } else if (message.length > 50) {
      increment = 0.01;
    }

    // Time-based relationship building
    const context = getConversationContext();
    const daysSinceFirst = context?.firstInteraction
      ? Math.floor((Date.now() - context.firstInteraction) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysSinceFirst > 7) increment *= 1.2; // Bonus for long-term users

    const newLevel = Math.min(1.0, currentLevel + increment);

    // Store updated relationship level with user preferences
    if (typeof window !== 'undefined') {
      localStorage.setItem(CONVERSATION_CONTEXT_KEY, JSON.stringify({
        ...context,
        relationshipLevel: newLevel,
        lastUpdated: Date.now(),
        firstInteraction: context?.firstInteraction || Date.now(),
        totalDays: daysSinceFirst + 1
      }));
    }

    return newLevel;
  } catch (error) {
    console.error('Error updating relationship level:', error);
    return 0.1;
  }
};

function getKruthikaInterestInTopic(topic: string): number {
  const interests = {
    'psychology': 0.9,
    'college': 0.8,
    'movies': 0.8,
    'friends': 0.9,
    'family': 0.7,
    'music': 0.8,
    'food': 0.7,
    'mumbai': 0.9,
    'bollywood': 0.8,
    'coffee': 0.9,
    'study': 0.6,
    'exam': 0.4,
    'work': 0.5,
    'love': 0.8,
    'relationship': 0.7,
    'travel': 0.8,
    'fashion': 0.7,
    'books': 0.6
  };

  return interests[topic as keyof typeof interests] || (0.3 + Math.random() * 0.4);
}

function extractTopics(message: string): string[] {
  const commonTopics = [
    'college', 'study', 'exam', 'friends', 'family', 'movies', 'music',
    'food', 'travel', 'work', 'love', 'relationship', 'games', 'sports',
    'books', 'art', 'cooking', 'shopping', 'fashion', 'technology',
    'mumbai', 'bollywood', 'psychology', 'coffee', 'cafe', 'weekend',
    'party', 'festival', 'rain', 'weather', 'phone', 'instagram'
  ];

  const lowerMessage = message.toLowerCase();
  return commonTopics.filter(topic => lowerMessage.includes(topic));
}

// ── Server-side memory sync ──────────────────────────────────────────────────
// These functions bridge localStorage context to the MySQL DB so memory
// survives device switches and browser clears.

/** Push the current context to the server (fire-and-forget, never throws).
 *  The server derives identity from the verified session cookie — `sid` is only
 *  used as a client-side readiness gate and is never sent as the identity. */
export async function syncContextToServer(sid: string, ctx: ConversationContext): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!sid || sid.length > 64) return;
  try {
    await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facts:             ctx.sharedMoments.map(m => m.moment).slice(0, 30),
        topics:            ctx.topics.map(t => t.topic).slice(0, 20),
        relationshipLevel: ctx.relationshipLevel,
        messageCount:      ctx.conversationPatterns.msgFrequency,
        sharedMoments:     ctx.sharedMoments.slice(0, 15),
        firstInteraction:  ctx.firstInteraction ?? null,
        emotionalPatterns: ctx.pastEmotions.slice(-10),
      }),
    });
  } catch {
    // Non-blocking — localStorage is still the live source
  }
}

/** Load memory from server and return a partial context to merge in. Returns null on failure.
 *  Identity is the verified session cookie set by the server — no client sid is sent. */
export async function loadContextFromServer(_sid: string): Promise<Partial<ConversationContext> | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/memory');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok || !data.memory) return null;
    const m = data.memory;
    return {
      relationshipLevel: m.relationshipLevel ?? 0.1,
      topics:            (m.topics ?? []).map((t: string) => ({
        topic:            t,
        lastMentioned:    Date.now(),
        userInterest:     0.5,
        kruthikaInterest: 0.5,
      })),
      sharedMoments:     (m.sharedMoments ?? []).slice(0, 10),
      firstInteraction:  m.firstInteraction ?? undefined,
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────

export function getContextualPromptAddition(context: ConversationContext): string {
  let addition = "";

  // Relationship-based prompting
  if (context.relationshipLevel > 0.8) {
    addition += "You're very close with this user. Be more intimate, use inside jokes, remember past conversations. ";
  } else if (context.relationshipLevel > 0.5) {
    addition += "You know this user well. Be warm and reference things you've talked about. ";
  } else if (context.relationshipLevel < 0.2) {
    addition += "This is a newer user. Be friendly but not too personal yet. ";
  }

  // Emotional pattern awareness
  const recentEmotions = context.pastEmotions.slice(-5);
  const sadCount = recentEmotions.filter(e => e.emotion === 'sad').length;
  const excitedCount = recentEmotions.filter(e => e.emotion === 'excited').length;

  if (sadCount > 2) addition += "User has been sad recently, be extra supportive and caring. ";
  if (excitedCount > 2) addition += "User gets excited easily, match their high energy! ";

  // Communication style adaptation
  const style = context.userPersonality.communicationStyle;
  if (style === 'emoji-heavy') addition += "User loves emojis, use them naturally. ";
  if (style === 'short') addition += "User prefers brief messages, keep responses concise. ";
  if (style === 'long') addition += "User writes longer messages, you can be more detailed. ";

  // Topic preferences
  const favoriteTopics = context.topics
    .filter(t => t.userInterest > 0.7)
    .map(t => t.topic)
    .slice(0, 3);

  if (favoriteTopics.length > 0) {
    addition += `User loves talking about: ${favoriteTopics.join(', ')}. Bring these up occasionally. `;
  }

  // Engagement level
  if (context.conversationPatterns.engagementLevel > 0.8) {
    addition += "User is highly engaged, be more playful and ask questions. ";
  } else if (context.conversationPatterns.engagementLevel < 0.3) {
    addition += "User seems less engaged, try to spark their interest with interesting topics. ";
  }

  // Shared moments
  if (context.sharedMoments.length > 3) {
    const recentMoment = context.sharedMoments[context.sharedMoments.length - 1];
    addition += `Remember you recently talked about: "${recentMoment.moment}". `;
  }

  return addition;
}