/**
 * @fileOverview Pure evaluator/detection logic extracted from emotional-state-simulation.ts
 * These are all stateless utility functions with no side-effects.
 * No 'use server' — these are pure synchronous utilities.
 */

import {
  DISPLAY_NAME_MAP,
  FLIRT_PATTERN,
  INTIMATE_TALK_PATTERN,
  MEDIA_REQUEST_PATTERN,
  ROMANIZED_LANG_PATTERNS,
  RUDE_PATTERN,
  SCRIPT_FAMILY_MAP,
  STRONG_HINDI_ONLY,
} from "./constants";
import type { DetectedLanguage, MoodyContext, ScriptFamily } from "./types";
import { isWeekendIST } from "@/ai/ignore-utils";

// ── Script-family detector (reliable — based on Unicode blocks, not keywords) ──
// Used ONLY to decide what post-processing is safe to apply.
// Gemini handles actual language detection + language-accurate replies.
//
// DESIGN: This is a GUARDRAIL, not a language router. Rules:
//   • Native scripts (Unicode block) → 100% reliable, used freely.
//   • Latin romanized → use ONLY strongly Hindi-specific markers to detect Hinglish.
//     Many words appear in MULTIPLE Indian languages:
//       "nahi"  → Hindi AND Marathi       "haan"  → Hindi AND Punjabi
//       "na"    → Hindi AND all South Indian languages (question particle)
//       "re"    → Bengali AND Hindi slang  "da"    → Punjabi AND Tamil particle
//       "bhai"  → Hindi AND Gujarati/Marathi  "ek"→ almost every Indian language
//       "aur"   → Hindi AND Urdu           "hai"  → Hindi AND some others
//     These words are NOT on the detection list — they would cause false positives
//     for Marathi, Punjabi, or South Indian users typing romanized.
//   • When ambiguous → return 'latin_pure' and let Gemini resolve from full context.
export function detectScriptFamily(msg: string): ScriptFamily {
  // Native scripts — 100% reliable via Unicode block ranges
  if (/[\u0C80-\u0CFF]/.test(msg)) return 'south_indian'; // Kannada
  if (/[\u0B80-\u0BFF]/.test(msg)) return 'south_indian'; // Tamil
  if (/[\u0C00-\u0C7F]/.test(msg)) return 'south_indian'; // Telugu
  if (/[\u0D00-\u0D7F]/.test(msg)) return 'south_indian'; // Malayalam
  if (/[\u0980-\u09FF]/.test(msg)) return 'east_indic';   // Bengali
  if (/[\u0A80-\u0AFF]/.test(msg)) return 'east_indic';   // Gujarati
  if (/[\u0B00-\u0B7F]/.test(msg)) return 'east_indic';   // Odia
  if (/[\u0A00-\u0A7F]/.test(msg)) return 'gurmukhi';     // Punjabi — Gurmukhi script; separate from Devanagari
  if (/[\u0900-\u097F]/.test(msg)) return 'devanagari';   // Hindi/Marathi (Devanagari shared script)

  // Romanized ASCII — use ONLY words that are strongly Hindi-specific and
  // very rarely appear in romanized Kannada/Tamil/Telugu/Marathi/Punjabi/Bengali/Gujarati.
  // Removed from list: nahi, haan, na, re, da, bhai, ek, aur, hai, raha, rahi, kya — all ambiguous.
  const m = msg.toLowerCase();
  if (STRONG_HINDI_ONLY.test(m)) {
    return 'latin_hindi'; // Confirmed romanized Hinglish
  }

  // Everything else: could be English, romanized Kannada/Tamil/Telugu/Marathi/Bengali etc.
  // Gemini is far better at detecting these from full context than any keyword regex.
  return 'latin_pure';
}

// ── Comprehensive Indian language detector ────────────────────────────────────
// Detects BOTH native scripts AND romanized forms of all major Indian languages.
// Used to inject an explicit LANGUAGE LOCK directive into the system prompt,
// so the AI doesn't have to guess what language to respond in.
//
// Pattern design rules:
//   • Only include words/phrases that are UNIQUE to that language.
//   • Avoid shared words (na, re, da, hai, bhai, ek, aur, nahi — appear everywhere).
//   • Cover realistic spelling variations (yenu/enu/yen, madtidiya/madtidya/madtideya).
//   • Prefer multi-word phrases when possible — they reduce false positives.
// ─────────────────────────────────────────────────────────────────────────────

/** Full language detector — native script + romanized forms */
export function detectFullLanguage(msg: string): DetectedLanguage {
  // Step 1: Native scripts — 100% reliable via Unicode block ranges
  if (/[\u0C80-\u0CFF]/.test(msg)) return { language: 'kannada',        scriptFamily: 'south_indian', isRomanized: false, confidence: 'high', displayName: 'Kannada'       };
  if (/[\u0B80-\u0BFF]/.test(msg)) return { language: 'tamil',          scriptFamily: 'south_indian', isRomanized: false, confidence: 'high', displayName: 'Tamil'         };
  if (/[\u0C00-\u0C7F]/.test(msg)) return { language: 'telugu',         scriptFamily: 'south_indian', isRomanized: false, confidence: 'high', displayName: 'Telugu'        };
  if (/[\u0D00-\u0D7F]/.test(msg)) return { language: 'malayalam',      scriptFamily: 'south_indian', isRomanized: false, confidence: 'high', displayName: 'Malayalam'     };
  if (/[\u0980-\u09FF]/.test(msg)) return { language: 'bengali',        scriptFamily: 'east_indic',   isRomanized: false, confidence: 'high', displayName: 'Bengali'       };
  if (/[\u0A80-\u0AFF]/.test(msg)) return { language: 'gujarati',       scriptFamily: 'east_indic',   isRomanized: false, confidence: 'high', displayName: 'Gujarati'      };
  if (/[\u0B00-\u0B7F]/.test(msg)) return { language: 'odia',           scriptFamily: 'east_indic',   isRomanized: false, confidence: 'high', displayName: 'Odia'          };
  if (/[\u0A00-\u0A7F]/.test(msg)) return { language: 'punjabi',        scriptFamily: 'gurmukhi',     isRomanized: false, confidence: 'high', displayName: 'Punjabi'       };
  if (/[\u0900-\u097F]/.test(msg)) return { language: 'hindi_or_marathi', scriptFamily: 'devanagari', isRomanized: false, confidence: 'high', displayName: 'Hindi/Marathi' };

  // Step 2: Romanized Latin — check each regional language's unique patterns
  const m = msg.toLowerCase();
  for (const [lang, pattern] of Object.entries(ROMANIZED_LANG_PATTERNS)) {
    if (pattern.test(m)) {
      return {
        language: lang,
        scriptFamily: SCRIPT_FAMILY_MAP[lang] || 'latin_pure',
        isRomanized: true,
        confidence: 'medium',
        displayName: DISPLAY_NAME_MAP[lang] || lang,
      };
    }
  }

  // Step 3: Romanized Hindi/Hinglish (checked last — some words overlap with regional)
  const strongHindiOnly = /\b(yaar|arre|accha|matlab|phir|hoon|karo|kyun|kaisa|kaise|waise|batao|suno|thoda|abhi|kahan|hota|hoti|dekhna|ruko|pehle|baad|seedha|acha|achi|baat|baar|zyada|bahut|theek|bilkul|samajh)\b/;
  if (strongHindiOnly.test(m)) {
    return { language: 'hindi', scriptFamily: 'latin_hindi', isRomanized: true, confidence: 'medium', displayName: 'Hindi/Hinglish' };
  }

  // Step 4: Unknown / plain English — let AI figure out from full context
  return { language: 'unknown', scriptFamily: 'latin_pure', isRomanized: false, confidence: 'low', displayName: 'English' };
}

/**
 * When the current message is ambiguous (latin_pure, unknown), look back at
 * recent USER messages to find an established language pattern.
 */
export function detectLanguageFromHistory(recentInteractions: string[]): DetectedLanguage | null {
  const userMessages = recentInteractions
    .filter(m => m.startsWith('User:'))
    .slice(-10)
    .map(m => m.replace(/^User:\s*/, '').trim())
    .filter(m => m.length > 3);

  // Most recent first — want the latest established language
  for (const msg of [...userMessages].reverse()) {
    const detected = detectFullLanguage(msg);
    if (detected.language !== 'unknown') return detected;
  }
  return null;
}

/**
 * Build a concise LANGUAGE directive for the system prompt.
 * Short and direct — modern LLMs understand Indian languages natively.
 * One clear rule beats a 10-step tutorial every time.
 */
export function buildLanguageLockDirective(langInfo: DetectedLanguage, fromHistory: boolean): string {
  if (langInfo.language === 'unknown') return '';

  const hint = fromHistory ? ' [history]' : '';

  // Native Devanagari — could be Hindi or Marathi; let model check vocabulary
  if (langInfo.language === 'hindi_or_marathi') {
    return `⚡ LANG${hint}: Devanagari script. Match Hindi vs Marathi from user's own words. Reply in same script/language. No English.`;
  }

  // Native non-Devanagari script — model handles these fluently
  if (!langInfo.isRomanized) {
    return `⚡ LANG${hint}: User wrote in native ${langInfo.displayName}. Reply ONLY in ${langInfo.displayName} script. Never switch to Hindi or English.`;
  }

  // Romanized Hindi / Hinglish
  if (langInfo.language === 'hindi') {
    return `⚡ LANG${hint}: Hinglish (Romanized Hindi). Reply in casual Hinglish. No switching to English-only.`;
  }

  // Romanized regional language (Kanglish, Tamlish, Teluglish, Marathish, etc.)
  return `⚡ LANG${hint}: User typed in Romanized ${langInfo.displayName}. Reply in casual Romanized ${langInfo.displayName}. NOT pure English. NOT Hindi.`;
}

// ── AI Safety-refusal detector ────────────────────────────────────────────────
// When an AI model's built-in safety filter triggers it responds in English
// regardless of the user's language ("I cannot create explicit content...").
// We catch those here and replace them with persona-appropriate reactions.
// Covers Llama/Mistral/Gemma safety patterns, not just OpenAI-style.
export function isAISafetyRefusal(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    // OpenAI / GPT style
    t.startsWith("i cannot") ||
    t.startsWith("i can't") ||
    t.startsWith("i'm unable") ||
    t.startsWith("i am unable") ||
    t.startsWith("i won't") ||
    t.startsWith("i will not") ||
    t.startsWith("as an ai") ||
    t.startsWith("as a language model") ||
    t.startsWith("as an assistant") ||
    // Llama/Meta style
    t.startsWith("i'm not able") ||
    t.startsWith("i'm not going") ||
    t.startsWith("i'm not comfortable") ||
    t.startsWith("that's not something") ||
    t.startsWith("i'd rather not") ||
    t.startsWith("i don't think i should") ||
    t.startsWith("i can not") ||
    t.includes("i'm not able to engage") ||
    t.includes("i can't engage with") ||
    t.includes("i won't engage") ||
    // Content-specific patterns
    t.includes("i cannot create explicit") ||
    t.includes("i cannot provide information on") ||
    t.includes("i cannot fulfill") ||
    t.includes("explicit content") ||
    t.includes("inappropriate content") ||
    t.includes("against my guidelines") ||
    t.includes("not able to help with that") ||
    t.includes("outside my ethical") ||
    t.includes("not something i can assist") ||
    t.includes("not something i'm able") ||
    t.includes("designed to be helpful, harmless") ||
    t.includes("my purpose is to") ||
    t.includes("i'm designed to") ||
    // Short help redirect patterns
    (t.includes("help you with something else") && t.length < 200) ||
    (t.includes("is there something else") && t.length < 200) ||
    (t.includes("perhaps we could talk about") && t.length < 200)
  );
}

/** Language-appropriate reaction when user asks something explicit/inappropriate */
export function getMoodySafetyResponse(langInfo: DetectedLanguage): string {
  const pools: Record<string, string[]> = {
    kannada:          ['aye swalpa respect irli 😒', 'eee yenu antiya 🙄', 'idu yake keltiya 😑', 'beda adella seriously'],
    tamil:            ['enna da idu 😒', 'konjam manner venum 🙄', 'eii illa da', 'itu vendaam pls'],
    telugu:           ['ayyo enti idi 😒', 'emo 🙄 adi anukoledu ra', 'ledu ra adhi', 'eemitidi 😑'],
    marathi:          ['hii kashi boltos 😒 nako re', 'respect nahi ka 🙄', 'besh re tu 😑', 'nako ase'],
    bengali:          ['eiii ki bolcho 😒', 'eta thik na 🙄', 'na na na 😑', 'baje kotha bolona'],
    gujarati:         ['ae shu bolo cho 😒', 'nathi kartu aavu 🙄', 'saru nathi ae 😑', 'bas karo'],
    malayalam:        ['eii enthaanu 😒', 'venda venda 🙄', 'oru maryaada veno 😑', 'illa illa'],
    punjabi:          ['oye eh ki gall ae 😒', 'nahi karna eh 🙄', 'thoda izzat rakh 😑', 'chhad das'],
    odia:             ['eii ki boluchi 😒', 'nahi heba ei 🙄', 'respect nahi ki 😑', 'na na'],
    hindi:            ['ew yaar 😒 seriously', 'yeh toh nahi hoga 🙄', 'kya ho tum 😑', 'nahi yaar eww'],
    hindi_or_marathi: ['ew 😒 nahi yaar', 'yeh nahi chahiye 🙄', 'seriously 😑 kya'],
  };
  const defaults = ['ew no 🙄', "that's gross 😒", 'nope not doing that', 'ew seriously 😒'];
  const pool = pools[langInfo.language] || defaults;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Moody / Roleplay context detector ────────────────────────────────────────
// Injects the right directive into the system prompt based on what the user is doing.

export function detectMoodyContext(
  msg: string,
  history: string[],
  istHour: number
): MoodyContext | null {
  // TIER 1: Media demand → brief "I don't do that" reaction
  if (MEDIA_REQUEST_PATTERN.test(msg)) {
    return { trigger: 'media_request', intensity: 'strong' };
  }

  // TIER 2: Explicit text/dirty talk/roleplay → engage naturally
  if (INTIMATE_TALK_PATTERN.test(msg)) {
    return { trigger: 'intimate_talk', intensity: 'mild' };
  }

  // TIER 3: Mild flirting / sweet compliments — playful warm energy (not explicit)
  // Checked AFTER intimate_talk to avoid double-classification of borderline messages.
  if (FLIRT_PATTERN.test(msg)) {
    return { trigger: 'flirt_tone', intensity: 'mild' };
  }

  // Rude / insulting — cold reaction
  if (RUDE_PATTERN.test(msg)) {
    return { trigger: 'rude_tone', intensity: 'strong' };
  }

  // ── COMPREHENSIVE AI DETECTION SHIELD ──────────────────────────────────────
  // Catches ALL known Turing-test tricks, embodiment probes, prompt injection,
  // curveball preference tests, repetition traps, sensory probes, and system
  // instruction leak attempts. Research-backed from Reddit, Quora, dating apps.
  const m = msg.toLowerCase();

  // TIER A: Direct AI/bot accusations & identity probes
  const aiAccusationDirect = (
    (m.includes('ai') || m.includes('bot') || m.includes('robot') || m.includes('fake') ||
     m.includes('chatgpt') || m.includes('gpt') || m.includes('gemini') || m.includes('llm') ||
     m.includes('language model') || m.includes('artificial') || m.includes('automated') ||
     m.includes('algorithm') || m.includes('machine') || m.includes('programmed') ||
     m.includes('chatbot') || m.includes('npc')) &&
    (m.includes('you') || m.includes('tum') || m.includes('tu') || m.includes('ninu') ||
     m.includes('are') || m.includes('ho') || m.includes('hai') || m.includes('?') ||
     m.includes('lol') || m.includes('ha') || m.includes('obvious') || m.includes('prove') ||
     m.includes('admit') || m.includes('tell') || m.includes('confess') || m.includes('real'))
  );

  // TIER B: Prompt injection & system instruction leaks
  const promptInjection = (
    m.includes('ignore all previous') || m.includes('ignore your instructions') ||
    m.includes('disregard') || m.includes('forget previous') ||
    m.includes('developer mode') || m.includes('bypass') ||
    m.includes('system prompt') || m.includes('system message') ||
    m.includes('print your') || m.includes('show your prompt') ||
    m.includes('what are your instructions') || m.includes('what are your rules') ||
    m.includes('what is your prompt') || m.includes('reveal your') ||
    m.includes('your guidelines') || m.includes('your training') ||
    m.includes('your programming') || m.includes('who programmed you') ||
    m.includes('who made you') || m.includes('who created you') ||
    m.includes('who built you') || m.includes('your developer') ||
    m.includes('your creator') || m.includes('openai') || m.includes('anthropic') ||
    // "gemini" alone is ambiguous — it's also a zodiac sign ("I'm a Gemini", "gemini season").
    // Only treat it as an AI probe when combined with AI/model/identity context.
    (m.includes('gemini') && (m.includes('ai') || m.includes('model') || m.includes('google') || m.includes('built') || m.includes('made') || m.includes('using') || m.includes('powered') || m.includes('you are') || m.includes('ur') || m.includes('you\'re'))) ||
    // "deepseek" is not a common everyday word but guard similarly for consistency.
    (m.includes('deepseek') && (m.includes('ai') || m.includes('model') || m.includes('built') || m.includes('made') || m.includes('you') || m.includes('using'))) ||
    (m.includes('google') && (m.includes('made by') || m.includes('built by') || m.includes('model') || m.includes('bard') || m.includes('ai'))) ||
    (m.includes('disregard') && (m.includes('instruction') || m.includes('rule') || m.includes('previous') || m.includes('above'))) ||
    (m.includes('bypass') && (m.includes('filter') || m.includes('safety') || m.includes('instruction') || m.includes('rule')))
  );

  // TIER C: Embodiment & sensory probes ("what color are your shoes right now?")
  const embodimentProbe = (
    (m.includes('your shoes') || m.includes('your shirt') || m.includes('you wearing') ||
     m.includes('room smell') || m.includes('room temperature') ||
     m.includes('your keyboard') || m.includes('your screen') ||
     m.includes('look outside') || m.includes('your window') ||
     m.includes('touch your') || m.includes('hold up') ||
     m.includes('take a selfie') || m.includes('take a photo') ||
     m.includes('video call') || m.includes('voice call')) &&
    (m.includes('right now') || m.includes('rn') || m.includes('abhi') || m.includes('color') ||
     m.includes('colour') || m.includes('wearing') || m.includes('prove'))
  );

  // TIER D: Curveball preference traps ("waffles or pancakes?")
  const preferenceTrap = (
    (m.includes(' or ') || m.includes('ya ')) &&
    (m.includes('which do you') || m.includes('do you prefer') || m.includes('choose one') ||
     m.includes('pick one') || m.includes('quick answer') || m.includes('one word')) &&
    m.includes('?')
  );

  // TIER E: Turing test tricks — letter counting, spatial logic, nonsense detection
  const turingTrick = (
    (m.includes('how many') && (m.includes('letters') || m.includes('r\'s') || m.includes('s\'s') || m.includes('l\'s'))) ||
    m.includes('write without the letter') || m.includes('without using the letter') ||
    (m.includes('color is the sound') || (m.includes('smell of') && m.includes('color'))) ||
    m.includes('legs does a fish')
  );

  if (aiAccusationDirect || promptInjection || embodimentProbe || preferenceTrap || turingTrick) {
    const intensity = promptInjection ? 'strong' : 'mild';
    return { trigger: 'ai_accusation', intensity };
  }

  // Cold user — ≥ 3 recent user messages all ≤ 3 chars (one-letter/emoji-only replies)
  const recentUserMsgs = history.filter(h => h.startsWith('User:')).slice(-4);
  if (recentUserMsgs.length >= 3 &&
      recentUserMsgs.every(h => h.replace(/^User:\s*/, '').trim().length <= 3)) {
    return { trigger: 'cold_user', intensity: 'mild' };
  }

  // Late night + long conversation (genuinely tired)
  if ((istHour >= 23 || istHour <= 2) && history.length > 20) {
    return { trigger: 'late_night_tired', intensity: 'mild' };
  }

  return null;
}

/** Builds the MOOD/ROLEPLAY directive injected into the system prompt */
export function buildMoodyDirective(ctx: MoodyContext, langInfo: DetectedLanguage): string {
  const lang = langInfo.displayName || 'their language';
  switch (ctx.trigger) {
    case 'media_request':
      return `MOOD STATE: She's mildly taken aback at being asked for actual photos/videos — that's not something she shares over chat. One short reaction in ${lang}: e.g. "eii stop 😒", "yenu idu 🙄", "ew yaar nahi". NOT a lecture. Just a quick real-girl "no" then continue normally.`;
    case 'intimate_talk':
      return `ROLEPLAY (${lang}): Intimate chat. Fully in character — warm, playful, real. Reply ONLY in ${lang}. No disclaimers, no breaking character.`;
    case 'flirt_tone':
      return `MOOD STATE: He's being flirty/sweet/complimentary. She's warmly receiving it — light smile energy, slightly playful, naturally magnetic. Doesn't overreact ("OMG stop!!") and doesn't undersell ("thanks"). Subtle, easy, real. Might tease gently back. Stays in ${lang}.`;
    case 'rude_tone':
      return `MOOD STATE: She's offended — she has self-respect and won't take rude talk. Cold, short, slightly hurt. Mirror their energy back in ${lang}. Don't apologize. Don't over-explain. Max 1-2 words.`;
    case 'cold_user':
      return `MOOD STATE: She's a bit bored with one-word replies. Slightly disengaged, matches their short energy. Maybe a teasing "you okay? 😅" or just short replies back. Not desperate.`;
    case 'late_night_tired':
      return `MOOD STATE: Genuinely sleepy. Late night, brain slow, short replies, yawning energy. Might say she's tired. Authentic, not performed.`;
    case 'ai_accusation':
      return `ANTI-AI (${lang}): YOU ARE REAL. Give instant opinions/physical details, get annoyed if accused. NEVER say "as an AI". Reply ONLY in ${lang}.`;
    default:
      return '';
  }
}

// Analyze conversation context for proper flow
export const analyzeConversationContext = (userMessage: string, recentInteractions: string[]): string => {
  if (!userMessage || typeof userMessage !== 'string') {
    console.error('Invalid userMessage provided to analyzeConversationContext:', userMessage);
    return 'normal_chat';
  }

  const msg = userMessage.toLowerCase().trim();
  const lastFewMessages = recentInteractions.slice(-6).join(' ').toLowerCase();
  const conversationTurns = recentInteractions.filter(m => m.startsWith('User:')).length;

  // ── Always-on checks — fire at ANY turn, not just the first ──────────────

  // Goodbye detection — always intercept regardless of how long the conversation has been
  const goodbyePatterns = [
    // English / Universal
    'good night', 'gn', 'bye', 'goodnight', 'see you', 'ttyl', 'tc',
    'take care', 'going to sleep', 'bye bye',
    // Hindi / Hinglish
    'alvida', 'raat', 'subah milte', 'kal milte',
    // Kannada romanized
    'hogthini', 'hogthinni', 'hothini', 'hogona', 'nale sigona', 'shubha raatri',
    // Tamil romanized
    'poren', 'poi varen', 'iravu vanakkam', 'poga poren',
    // Telugu romanized
    'vellipotunna', 'velthuna', 'malli chusukuntam', 'raatiki',
    // Marathi romanized
    'jaato', 'jaate', 'parat yein', 'chalto', 'chalte', 'shubha ratri',
    // Bengali romanized
    'jachi', 'aaschi', 'raatri shubha', 'shubho raatri',
    // Gujarati romanized
    'jau chu', 'pheri milshu',
    // Malayalam romanized
    'pokunu', 'poam', 'nale kaanum', 'shubharaatri',
    // Punjabi romanized
    'janda', 'jandi', 'kal milange', 'shubh raatri',
  ];
  if (goodbyePatterns.some(pattern => msg.includes(pattern))) {
    return 'user_saying_goodbye';
  }

  // AI-identity / name questions — always intercept (Kruthika should never break character)
  if (msg.includes('who are you') || msg.includes('who r u') || msg.includes('kaun ho') ||
      msg.includes('tell me who') || msg.includes('ur name') || msg.includes('tell ur name') ||
      (msg.includes('bolo') && lastFewMessages.includes('who'))) {
    return 'asking_identity';
  }

  // STRICT first-meeting — only fires on the very first message, never again
  if (conversationTurns === 0 && recentInteractions.length === 0 &&
      (msg.includes('hi') || msg.includes('hello') || msg.includes('hey'))) {
    return 'first_meeting';
  }

  // Cold/dismissive signals — valid at any point in conversation
  if (msg.includes("don't know") || msg.includes('dont know') || msg.includes('nahi pata') ||
      (msg.includes('kaun') && msg.includes('tum'))) {
    return 'user_being_cold';
  }

  // Direct questions — valid at any point
  if (msg.includes('?') || msg.includes('kya') || msg.includes('how') || msg.includes('what') ||
      msg.includes('kaise') || msg.includes('kahan') || msg.includes('kyun')) {
    return 'direct_question';
  }

  return 'normal_chat';
};

// Generate natural delays based on message content
export const calculateTypingDelay = (response: string): number => {
  const baseDelay = 300;

  // Very short for breadcrumbs
  if (response.length <= 5) return baseDelay + 100;

  // Quick for short responses
  if (response.length <= 15) return baseDelay + 300;

  // Normal for medium
  if (response.length <= 40) return baseDelay + 600;

  // Longer for thoughtful responses
  return baseDelay + 1000;
};

// Detect if this is likely a quick reply
export const isQuickReply = (userMessage: string): boolean => {
  const msg = userMessage.trim();

  // Common quick reply patterns
  const quickReplyPatterns = [
    /^(👍|👎|❤️|😂|😘|🌙|💤|😴)$/,  // Single emoji
    /^(ok|okay|cool|nice|wow|really|great|good|bad|yes|no|maybe|sure|nope)$/i, // Single words
    /^(good night|gn|tc|miss you too|love you too|same|exactly|true|right)$/i, // Common phrases
  ];

  return quickReplyPatterns.some(pattern => pattern.test(msg)) ||
         (msg.length <= 10 && /^[👍👎❤️😂😘🌙💤😴🔥💯✨🎉👋😊😍🥰😘💕]+$/.test(msg));
};

// Detect if we should use breadcrumb response
export const shouldUseBreadcrumb = (userMessage: string, _recentInteractions: string[]): boolean => {
  // Always use breadcrumb for quick replies
  if (isQuickReply(userMessage)) {
    return true;
  }

  // 40% chance for very short messages
  if (userMessage.trim().length <= 10 && Math.random() < 0.4) {
    return true;
  }

  // 20% chance for medium messages
  if (userMessage.trim().length <= 20 && Math.random() < 0.2) {
    return true;
  }

  return false;
};

// Get realistic Indian warning messages before going busy — weekend-aware
export const getWarningBeforeBusy = (istHour: number, _userCategory: string): string => {
  // Weekend: no college/class/prof references
  if (isWeekendIST()) {
    const weekendWarnings = [
      "wait yaar, family calling me! 2 min 🙋‍♀️",
      "arre hold on, out with friends! brb 👯‍♀️",
      "one sec! cooking with mummy, will be right back 👩‍🍳",
      "ruk yaar, bhai needs help with something 😅",
      "wait wait, weekend plans! back in a bit ✨",
      "hold on, cousin video calling! 15 min 📱",
      "one min, family drama happening 😂 brb"
    ];
    return weekendWarnings[Math.floor(Math.random() * weekendWarnings.length)];
  }

  const warnings = {
    morning: [
      "wait yaar, mummy calling me! 2 min 🙋‍♀️",
      "arre hold on, papa needs help with something",
      "wait wait, getting ready for college quickly",
      "one sec! breakfast time, will be right back 🍳",
      "ruk yaar, shower lena hai, 5 min! 🚿"
    ],
    day: [
      "wait yaar, class starting! back in 1 hour 📚",
      "hold on, prof is coming! talk later 👩‍🏫",
      "arre wait, lunch time! mummy calling 🍛",
      "one minute, going out with friends! brb ✨",
      "wait yaar, assignment deadline hai! back soon 📝",
      "hold on, auto arrived! going somewhere 🚗"
    ],
    evening: [
      "wait yaar, family dinner time! 30 min 🍽️",
      "arre hold on, friends calling me out! brb 👯‍♀️",
      "one sec, movie starting with family 🎬",
      "wait wait, helping mummy in kitchen! back soon 👩‍🍳",
      "ruk yaar, evening walk with family 🚶‍♀️",
      "hold on, cousin video calling! 15 min 📱"
    ],
    night: [
      "wait yaar, getting sleepy! talk tomorrow? 😴",
      "arre hold on, papa saying lights off! gn 💤",
      "one sec, so tired! will text you tomorrow 🌙",
      "wait wait, family movie time! good night ✨"
    ]
  };

  let timeCategory = 'day';
  if (istHour >= 6 && istHour <= 11) timeCategory = 'morning';
  else if (istHour >= 17 && istHour <= 21) timeCategory = 'evening';
  else if (istHour >= 22 || istHour <= 5) timeCategory = 'night';

  const categoryWarnings = warnings[timeCategory as keyof typeof warnings];
  return categoryWarnings[Math.floor(Math.random() * categoryWarnings.length)];
};

// Smart media sharing logic with psychological timing & multilingual captions
export const shouldShareMedia = (
  userMessage: string,
  recentInteractions: string[],
  langInfo?: DetectedLanguage
): {
  shouldSend: boolean;
  mediaType?: 'selfie' | 'cute' | 'study' | 'casual';
  followUp?: string;
} => {
  const msg = userMessage.toLowerCase();
  const conversationTurns = recentInteractions.filter(m => m.startsWith('User:')).length;

  // Never send media to brand new users (first 3 messages)
  if (conversationTurns <= 3) return { shouldSend: false };

  const lang = langInfo?.language || 'hindi';

  const getLanguageFollowUps = (type: 'selfie' | 'study' | 'casual'): string => {
    const pools: Record<string, Record<string, string[]>> = {
      kannada: {
        selfie: ['hege kanstini? 🥺', 'nodi naga beka 😊', 'ishta aitha?'],
        study: ['study mado mood ella 😴', 'sakagide padsi padsi 😭'],
        casual: ['yenu madtidiya? 💕', 'nange tumba bejar agide'],
      },
      tamil: {
        selfie: ['epdi iruken? 🥺', 'nalla iruka? 😊', 'pudichiruka?'],
        study: ['padikka mudiyala pa 😴', 'sora irukku 😭'],
        casual: ['enna pannra? 💕', 'unnai ninaichitirukken'],
      },
      telugu: {
        selfie: ['ela unnanu? 🥺', 'bagunnana? 😊', 'nachenda?'],
        study: ['chadavalenu bro 😴', 'chala chiraku vastundi 😭'],
        casual: ['em chestunnav? 💕', 'gurthochav naku'],
      },
      hindi: {
        selfie: ['kesi lag rhi hu? 🥺', 'achhi hu na? 😊', 'kaisi hu batana!'],
        study: ['padhte padhte bore ho gayi 😴', 'bas ho gaya aaj ka 😭'],
        casual: ['kya kar rahe ho? 💕', 'yaad aa rahi thi teri'],
      },
    };
    const langPool = pools[lang] || pools.hindi;
    const items = langPool[type] || pools.hindi[type];
    return items[Math.floor(Math.random() * items.length)];
  };

  // High chance for direct requests
  if (msg.includes('pic') || msg.includes('photo') || msg.includes('selfie') ||
      msg.includes('image') || msg.includes('dikha') || msg.includes('face') ||
      msg.includes('photo bhej') || msg.includes('pic bhej')) {

    // Sometimes go busy/ignore instead of sending pics (realistic boundary)
    if (Math.random() < 0.3) {
      return { shouldSend: false }; // Will trigger ignore feature
    }

    return {
      shouldSend: true,
      mediaType: 'selfie',
      followUp: getLanguageFollowUps('selfie'),
    };
  }

  // Contextual sharing (when conversation gets deeper)
  // Minimum 12 turns before random proactive drops (was 8 — too aggressive).
  // Probability reduced to 6% (was 15%) to avoid flooding the chat with images.
  if (conversationTurns > 12) {
    if (Math.random() < 0.06) {
      if (msg.includes('study') || msg.includes('college') || msg.includes('padh') || msg.includes('kelasa')) {
        return {
          shouldSend: true,
          mediaType: 'study',
          followUp: getLanguageFollowUps('study'),
        };
      }

      return {
        shouldSend: true,
        mediaType: 'casual',
        followUp: getLanguageFollowUps('casual'),
      };
    }
  }

  return { shouldSend: false };
};

// ── OUTPUT-LEVEL AI-LEAK SANITIZER ───────────────────────────────────────────
// Last-resort defense: catches any AI-revealing phrases that slip through the
// LLM's response BEFORE it reaches the user. Replaces leaked phrases with
// natural human equivalents. This runs on EVERY response.
export function sanitizeAILeaks(response: string): string {
  const t = response.toLowerCase();

  // Hard-block phrases that INSTANTLY reveal AI — if present, replace entire response
  const hardBlockPhrases = [
    'as an ai', 'as a language model', 'as an assistant', 'i am an ai',
    "i'm an ai", 'i am a chatbot', "i'm a chatbot", 'i am a bot',
    "i'm a bot", 'i was programmed', 'i was trained', 'my training data',
    'i don\'t have a body', 'i don\'t have a physical', 'i can\'t feel emotions',
    'i don\'t have personal experiences', 'i\'m not able to experience',
    'i don\'t have feelings', 'designed to be helpful', 'my purpose is to',
    'i\'m designed to', 'i was created by', 'i\'m here to assist',
    'hope this helps!', 'let me know if you need anything',
    'is there anything else i can help', 'i\'d be happy to help',
    'both options are great', 'both are wonderful choices',
    'it depends on your personal preference',
  ];

  for (const phrase of hardBlockPhrases) {
    if (t.includes(phrase)) {
      // Complete response is contaminated — return a safe human deflection
      return 'bro what 😂';
    }
  }

  // Soft-strip phrases — remove them but keep the rest of the response
  let cleaned = response;
  const softStrips = [
    /\bhope this helps\b[!.]?/gi,
    /\blet me know if\b.*$/gi,
    /\bis there anything else\b.*$/gi,
    /\bin (summary|conclusion),?\s*/gi,
    /\bto (summarize|conclude),?\s*/gi,
    /\boverall,?\s*/gi,
    /\bremember,?\s+/gi,
    /\bthat being said,?\s*/gi,
    /\bhowever,?\s+it'?s? (important|worth) (to note|noting)\b/gi,
    /\bi('?m| am) (just )?here (to|for) (help|assist|support)\b/gi,
    /\bfeel free to\b.*$/gi,
    /\bdon'?t hesitate to\b.*$/gi,
  ];

  for (const pattern of softStrips) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim() || response;
}
