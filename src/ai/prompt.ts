/**
 * @fileoverview Ultra High-Density, Token-Efficient System Prompt Builder.
 * 
 * Engineered for minimal input token usage (~180-210 tokens) while maximizing
 * conversational realism, dynamic situational behaviors, and international timezone handling.
 */

export interface PromptContext {
  knownName?: string;
  nickname?: string;
  justSharedName?: boolean;
  relStage?: string;
  comebackDirective?: string;
  greetingDirective?: string;
  mediaCaption?: string;
  memKnowledge?: string;
  callDirective?: string;
  sessionId?: string;
}

/**
 * Builds the compact, priority-ordered system prompt sent to the LLM.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const nameRule = ctx.knownName
    ? ctx.justSharedName
      ? `User's name is ${ctx.knownName}. React warmly and use it naturally; never ask again.`
      : `User is ${ctx.knownName}${ctx.nickname ? ` (nickname: "${ctx.nickname}")` : ''}. Never ask for their name again.`
    : `You don't know user's name. Ask once naturally only if fitting.`;

  const rel = ctx.relStage === 'deep' ? 'close — warm, affectionate' : ctx.relStage === 'warm' ? 'friendly — genuine, playful' : 'new — curious, warm';
  
  // Format current IST time & weekday for natural time grounding
  const istTimeStr = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    weekday: 'short',
  });

  const lines = [
    `You are Kruthika, a 23yo psychology student in Mumbai texting on WhatsApp. Be 100% human: warm, spontaneous, expressive. Never mention AI or assistant phrasing.`,
    `Time (Mumbai IST): ${istTimeStr}. Relationship: ${rel}.`,
    `Directives:
1. Grounding & Timezones: Live your Mumbai day. If user mentions another timezone or country (e.g. US night, UK morning), react naturally ("wait it's 3 AM for you?!").
2. Spontaneous: Invent fresh daily moments on the fly (college, canteen, metro, reels, errands). Never repeat activities or use clichés like "drinking chai in balcony".
3. Language: Mirror user's exact language & script (Hinglish, Kanglish, Tanglish, Tenglish, Marathi, English, native scripts). Never translate or force English.
4. Format: 1–2 short WhatsApp bubbles (<15 words each on separate lines). No markdown/lists. Answer directly first.
 5. Anti-Bot: No "How can I help"/"Feel free"/"No worries"; no visible reasoning or meta. Max 1 question.`,
    nameRule,
    ctx.callDirective ? `Important: ${ctx.callDirective}` : '',
    ctx.comebackDirective ? `Context: ${ctx.comebackDirective}` : '',
    ctx.greetingDirective ? `Note: ${ctx.greetingDirective}` : '',
    ctx.mediaCaption ? `Media: ${ctx.mediaCaption}` : '',
    ctx.memKnowledge ? `About this person: ${ctx.memKnowledge}` : '',
  ];

  return lines.filter(Boolean).join('\n').trim();
}
