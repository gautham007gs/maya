/**
 * Mood Detector — zero AI tokens, pure signal analysis
 * Detects user emotional state from: message length, emoji signals, word sentiment
 * Used by Kruthika to mirror the user's emotional energy (addiction mechanic)
 */

export type MoodEnergy = 'low' | 'medium' | 'high';

export interface DetectedMood {
  emotion: string;
  energy: MoodEnergy;
  intensity: 1 | 2 | 3;
}

// ─── Emoji → emotion mapping ────────────────────────────────────────────────

const EMOJI_EMOTIONS: Array<[string, string]> = [
  ['🎉', 'excited'], ['🥳', 'excited'], ['🔥', 'excited'], ['💯', 'excited'],
  ['🚀', 'excited'], ['😆', 'excited'], ['🤩', 'excited'], ['✨', 'happy'],
  ['🌟', 'happy'], ['😊', 'happy'], ['😁', 'happy'], ['😄', 'happy'],
  ['😃', 'happy'], ['☺️', 'happy'], ['🙂', 'happy'], ['😀', 'happy'],
  ['❤️', 'loving'], ['🥰', 'loving'], ['😍', 'loving'], ['💕', 'loving'],
  ['💗', 'loving'], ['💓', 'loving'], ['💞', 'loving'], ['💖', 'loving'],
  ['😘', 'loving'], ['🫶', 'loving'], ['💑', 'loving'], ['💏', 'loving'],
  ['😢', 'sad'], ['😭', 'sad'], ['🥺', 'sad'], ['💔', 'sad'],
  ['😞', 'sad'], ['😔', 'sad'], ['🫂', 'sad'], ['😿', 'sad'],
  ['😠', 'angry'], ['😡', 'angry'], ['🤬', 'angry'], ['😤', 'angry'], ['💢', 'angry'],
  ['😑', 'bored'], ['😒', 'bored'], ['🙄', 'bored'],
  ['😴', 'tired'], ['💤', 'tired'],
  ['😕', 'confused'], ['🤔', 'curious'], ['🧐', 'curious'], ['❓', 'curious'],
  ['😮', 'surprised'], ['😲', 'surprised'], ['🤯', 'surprised'], ['😱', 'surprised'],
  ['😜', 'playful'], ['😝', 'playful'], ['😏', 'flirty'], ['😉', 'flirty'], ['🫦', 'flirty'],
  ['😬', 'nervous'], ['🫣', 'nervous'], ['😰', 'anxious'], ['😟', 'anxious'],
  ['🙏', 'grateful'], ['😇', 'grateful'],
  ['💪', 'proud'], ['🏆', 'proud'], ['🥇', 'proud'],
  ['🤗', 'caring'], ['💙', 'caring'],
  ['🥀', 'lonely'], ['😶', 'lonely'],
];

// ─── Word/phrase → emotion mapping ─────────────────────────────────────────
// All multi-word keys are quoted. Duplicates removed. Array used for ordered matching.

const WORD_EMOTIONS: Array<[string, string]> = [
  // Excited / ecstatic
  ['excited', 'excited'], ['ecstatic', 'excited'], ['hyped', 'excited'],
  ["can't wait", 'excited'], ['cant wait', 'excited'],
  ['amazing', 'excited'], ['unbelievable', 'excited'], ['insane', 'excited'],
  ['omg', 'surprised'], ['wtf', 'surprised'], ['woww', 'surprised'], ['yayyy', 'excited'],
  ['yayy', 'excited'], ['yay', 'excited'],
  // Happy
  ['happy', 'happy'], ['great', 'happy'], ['awesome', 'happy'], ['fantastic', 'happy'],
  ['lovely', 'happy'], ['wonderful', 'happy'], ['nice', 'happy'], ['fun', 'happy'],
  // Loving / romantic
  ['love you', 'loving'], ['miss you', 'loving'], ['missing', 'loving'],
  ['love', 'loving'], ['beautiful', 'loving'], ['gorgeous', 'loving'],
  ['romantic', 'loving'], ['darling', 'loving'], ['sweetheart', 'loving'],
  ['crush', 'loving'], ['adore', 'loving'], ['pyar', 'loving'],
  ['ishq', 'loving'], ['mohabbat', 'loving'],
  // Sad / low
  ['heartbroken', 'sad'], ['depressed', 'sad'], ['hopeless', 'sad'],
  ['sad', 'sad'], ['unhappy', 'sad'], ['crying', 'sad'],
  // Lonely
  ['no one', 'lonely'], ['nobody', 'lonely'], ['alone', 'lonely'], ['lonely', 'lonely'],
  // Hurt
  ['hurt', 'hurt'], ['pain', 'hurt'], ['unfair', 'hurt'],
  ['betrayed', 'hurt'], ['let down', 'hurt'], ['disappointed', 'hurt'],
  ['upset', 'hurt'], ['ignored', 'hurt'],
  // Angry / frustrated
  ['furious', 'angry'], ['frustrated', 'angry'], ['annoyed', 'angry'],
  ['angry', 'angry'], ['hate', 'angry'], ['worst', 'angry'], ['horrible', 'angry'],
  // Stressed / anxious
  ['overwhelmed', 'anxious'], ['stressed', 'anxious'], ['stress', 'anxious'],
  ['worried', 'anxious'], ['worry', 'anxious'], ['fear', 'anxious'], ['panic', 'anxious'],
  ['tense', 'anxious'], ['exam', 'anxious'],
  // Nervous
  ['nervous', 'nervous'], ['scared', 'nervous'],
  // Bored
  ['kuch nahi', 'bored'], ['boring', 'bored'], ['bored', 'bored'],
  ['whatever', 'bored'], ['nothing', 'bored'], ['idk', 'bored'], ['meh', 'bored'],
  // Tired
  ['exhausted', 'tired'], ['sleepy', 'tired'], ['tired', 'tired'],
  ['drained', 'tired'], ['fatigue', 'tired'],
  // Playful
  ['lmao', 'playful'], ['lol', 'playful'], ['haha', 'playful'], ['hehe', 'playful'],
  ['funny', 'playful'], ['prank', 'playful'], ['banter', 'playful'],
  // Flirty
  ['flirt', 'flirty'], ['sexy', 'flirty'], ['charming', 'flirty'],
  // Curious
  ['tell me', 'curious'], ['explain', 'curious'], ['interesting', 'curious'],
  ['how', 'curious'], ['kyun', 'curious'], ['kyu', 'curious'],
  // Nostalgic
  ['miss those', 'nostalgic'], ['old times', 'nostalgic'], ['back then', 'nostalgic'],
  ['memories', 'nostalgic'], ['remember', 'nostalgic'], ['yaad', 'nostalgic'],
  // Grateful
  ['thank you', 'grateful'], ['shukriya', 'grateful'],
  ['thanks', 'grateful'], ['grateful', 'grateful'], ['appreciate', 'grateful'],
  // Proud
  ['achieved', 'proud'], ['success', 'proud'], ['nailed', 'proud'],
  ['did it', 'proud'], ['won', 'proud'], ['passed', 'proud'], ['proud', 'proud'],
  // Caring
  ['are you ok', 'caring'], ['you okay', 'caring'],
  ['take care', 'caring'], ['stay safe', 'caring'],
  // Hopeful
  ['wish', 'hopeful'], ['hopeful', 'hopeful'],
  // Surprised
  ['no way', 'surprised'], ['seriously', 'surprised'],
  ['shocked', 'surprised'], ['unexpected', 'surprised'], ['surprised', 'surprised'],
  // Confused
  ['what do you mean', 'confused'], ['confused', 'confused'],
  ['confusing', 'confused'], ['huh', 'confused'],
  // Embarrassed
  ['embarrassed', 'embarrassed'], ['awkward', 'embarrassed'], ['shy', 'embarrassed'],
  // Jealous
  ['jealous', 'jealous'], ['envy', 'jealous'],
  // Lonely (extra signals)
  ['no one cares', 'lonely'],
];

// ─── Mood → Kruthika behavior directives ───────────────────────────────────

export const MOOD_MIRROR_DIRECTIVES: Record<string, string> = {
  excited:     'User is VERY excited/hyped. Match energy: short excited bursts, be equally enthusiastic',
  happy:       'User is happy/upbeat. Match positive vibe: warm, fun, light replies',
  loving:      'User is in loving/romantic mood. Respond with warmth, slight flirtiness, make them feel special',
  sad:         'User seems sad/low. Be softer, more tender, gentle caring words, make them feel heard and not alone',
  angry:       'User is frustrated/angry. Acknowledge feelings first, be calm and understanding',
  anxious:     'User is stressed/anxious. Be reassuring, calm, make them feel safe and less alone',
  nervous:     'User seems nervous. Be gentle, encouraging, supportive',
  bored:       'User is bored. Create intrigue, ask something unexpected, be playful to pull them in',
  tired:       'User is tired/sleepy. Be soft and cozy in tone, show you care about their rest',
  playful:     'User is being playful. Match playful energy, banter back, be cheeky and fun',
  flirty:      'User is being slightly flirty. Playfully match it — light and natural, not forced',
  curious:     'User is curious. Feed their curiosity, be interesting and engaging',
  nostalgic:   'User is feeling nostalgic. Be warm, reflective, create emotional connection',
  grateful:    'User expressing gratitude. Accept warmly, make them feel their appreciation matters',
  proud:       'User is proud of something. Celebrate with them genuinely, be their hype person',
  caring:      'User is being caring/checking in. Warmly reciprocate, show you notice their kindness',
  surprised:   'User is surprised. Share in their surprise, react authentically',
  confused:    'User is confused. Be patient, helpful, gently clarify',
  hurt:        'User is hurt/disappointed. Be empathetic, validate feelings, make them feel understood',
  lonely:      'User feels lonely. Make them feel seen and wanted — your presence matters most now',
  embarrassed: 'User seems embarrassed. Be light and reassuring, help them feel comfortable',
  jealous:     'User seems a bit jealous. Acknowledge playfully, make them feel secure',
  hopeful:     'User is hopeful. Be encouraging, nurture that hope',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function countEmojis(text: string): number {
  const m = text.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu);
  return m ? m.length : 0;
}

function hasMajorityCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 4) return false;
  const caps = (text.match(/[A-Z]/g) || []).length;
  return caps / letters.length > 0.5;
}

function detectEmojiEmotion(text: string): { emotion: string; count: number } | null {
  const scores: Record<string, number> = {};
  for (const [emoji, emotion] of EMOJI_EMOTIONS) {
    const escaped = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = (text.match(new RegExp(escaped, 'g')) || []).length;
    if (count > 0) scores[emotion] = (scores[emotion] || 0) + count;
  }
  const entries = Object.entries(scores);
  if (!entries.length) return null;
  const best = entries.sort((a, b) => b[1] - a[1])[0];
  return { emotion: best[0], count: best[1] };
}

function detectWordEmotion(text: string): { emotion: string; score: number } | null {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};
  for (const [phrase, emotion] of WORD_EMOTIONS) {
    if (lower.includes(phrase)) {
      scores[emotion] = (scores[emotion] || 0) + 1;
    }
  }
  const entries = Object.entries(scores);
  if (!entries.length) return null;
  const best = entries.sort((a, b) => b[1] - a[1])[0];
  return { emotion: best[0], score: best[1] };
}

function calcEnergy(text: string, emojiCount: number): MoodEnergy {
  const exclCount = (text.match(/!/g) || []).length;
  const len = text.trim().length;
  const score =
    (emojiCount >= 3 ? 2 : emojiCount >= 1 ? 1 : 0) +
    (exclCount >= 3 ? 2 : exclCount >= 1 ? 1 : 0) +
    (hasMajorityCaps(text) ? 2 : 0) +
    (len > 120 ? 1 : 0) +
    (len < 10 ? -1 : 0);
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function calcIntensity(wordScore: number, emojiCount: number, energy: MoodEnergy): 1 | 2 | 3 {
  const total = wordScore + emojiCount;
  if (total >= 3 || energy === 'high') return 3;
  if (total >= 2 || energy === 'medium') return 2;
  return 1;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect user mood from a single message.
 * Pure JS — zero API calls, zero tokens used.
 */
export function detectMood(message: string): DetectedMood {
  const emojiResult = detectEmojiEmotion(message);
  const wordResult = detectWordEmotion(message);
  const emojiCount = countEmojis(message);
  const energy = calcEnergy(message, emojiCount);

  let emotion = 'neutral';

  if (emojiResult && wordResult) {
    emotion = wordResult.score >= 2 ? wordResult.emotion : emojiResult.emotion;
  } else if (emojiResult) {
    emotion = emojiResult.emotion;
  } else if (wordResult) {
    emotion = wordResult.emotion;
  } else {
    if (energy === 'high') emotion = 'excited';
    else if (energy === 'low') emotion = 'bored';
  }

  const intensity = calcIntensity(
    wordResult?.score ?? 0,
    emojiResult?.count ?? 0,
    energy,
  );

  return { emotion, energy, intensity };
}

/**
 * Build compact mood tag for memoryContext (15 chars max).
 * e.g. "mood:sad/low/2"
 */
export function buildMoodTag(mood: DetectedMood): string {
  return `mood:${mood.emotion}/${mood.energy}/${mood.intensity}`;
}

/**
 * Get mood mirroring directive for the AI system prompt.
 * Returns '' for neutral/unknown moods or low-intensity signals (intensity < 2).
 */
export function getMoodMirrorDirective(moodTag: string): string {
  if (!moodTag || !moodTag.startsWith('mood:')) return '';
  const parts = moodTag.slice(5).split('/');
  const emotion = parts[0];
  const intensity = parseInt(parts[2] ?? '1', 10);
  if (intensity < 2) return '';
  return MOOD_MIRROR_DIRECTIVES[emotion] ?? '';
}
