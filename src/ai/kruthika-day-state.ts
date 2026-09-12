/**
 * Kruthika's Day State System — "The Neural Seed"
 *
 * Uses today's IST date as a deterministic seed so her mood + life events are:
 *   • Consistent within a day (she doesn't flip personalities mid-convo)
 *   • Unique per day (no repeat cycles — ever)
 *   • Grounded in real Mumbai college-girl life patterns
 *
 * PSYCHOLOGY BASIS:
 *   • Circadian rhythm: energy peaks mid-morning, dips mid-afternoon
 *   • Day-of-week personality: Monday drag vs Friday buzz
 *   • Social exhaustion: long social days = quieter evenings
 *   • Hormonal micro-cycles: factored into weekly mood variation
 *   • Environmental anchors: Mumbai weather, local transport, family dynamics
 *   • Life events bleed into conversation naturally — not announced, just present
 *
 * HOW IT WORKS:
 *   1. Hash today's IST date (YYYYMMDD) into a number seed
 *   2. Use a lightweight LCG to pick deterministically from large pools
 *   3. Add day-of-week bias (Monday ≠ Friday ≠ Sunday)
 *   4. Return rich context string for injection into system prompt
 *
 * NOTE: No 'use server' — utility module, synchronous, imported by multiple files.
 */

// Static import — no circular dependency: kruthika-hormones.ts does not
// import kruthika-day-state.ts, so this is safe and avoids the require() block.
import { getHormonalState } from '@/ai/kruthika-hormones';

export type DayMood =
  | 'normal'       // just a regular day, her usual self
  | 'content'      // quietly satisfied, low drama
  | 'excited'      // something good is happening / anticipated
  | 'low_energy'   // drained, tired, physically sluggish
  | 'stressed'     // something weighing on her mind
  | 'happy_high'   // genuinely great day, extra sparkle
  | 'moody'        // a bit in her feelings, slightly edgier
  | 'nostalgic'    // reflective, soft, thinking about memories
  | 'restless'     // can't settle, jumping topics, fidgety energy
  | 'warm_open';   // unusually emotionally open, heart-on-sleeve day

export interface KruthikaDayState {
  mood: DayMood;
  energy: 'high' | 'medium' | 'low';
  todayEvent: string;       // Something specific that happened today
  onHerMind: string;        // A thought/concern naturally present
  socialContext: string;    // Who she's been with, social state of the day
  dayOfWeekTone: string;    // How this day-of-week feels for her
  extraColor: string;       // One extra sensory/atmospheric detail (weather, food, song)
}

// ── IST date helpers ─────────────────────────────────────────────────────────

function getISTDateParts(): { year: number; month: number; day: number; dow: number } {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  nowIST.setHours(nowIST.getHours() - 4); // 4 AM transition so she doesn't change personalities at midnight mid-chat
  return {
    year: nowIST.getFullYear(),
    month: nowIST.getMonth() + 1,
    day: nowIST.getDate(),
    dow: nowIST.getDay(), // 0=Sun, 1=Mon … 6=Sat
  };
}

// ── Seeded pseudo-random — deterministic from date seed ──────────────────────

/** Lehmer LCG: fast, deterministic, good distribution */
function seededRand(seed: number, offset: number): number {
  let s = (seed ^ (offset * 2654435761)) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  return (s ^ (s >>> 16)) >>> 0;
}

function pick<T>(arr: T[], seed: number, offset: number): T {
  return arr[seededRand(seed, offset) % arr.length];
}

// ── Mood pools ────────────────────────────────────────────────────────────────

// Weighted distribution — most days are normal/content, extremes are rare
// ~38% normal/content, ~16% excited, ~14% low_energy, ~12% stressed,
// ~8% happy_high, ~6% moody, ~4% nostalgic, ~2% restless/warm_open
const MOOD_WEIGHTS: [DayMood, number][] = [
  ['normal',      22],
  ['content',     16],
  ['excited',     16],
  ['low_energy',  14],
  ['stressed',    12],
  ['happy_high',   8],
  ['moody',        6],
  ['nostalgic',    4],
  ['restless',     1],
  ['warm_open',    1],
];

function pickWeightedMood(seed: number): DayMood {
  const total = MOOD_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let roll = seededRand(seed, 1) % total;
  for (const [mood, weight] of MOOD_WEIGHTS) {
    if (roll < weight) return mood;
    roll -= weight;
  }
  return 'normal';
}

// ── Today's life event pools ──────────────────────────────────────────────────

const WEEKDAY_EVENTS = [
  "had masala chai at the tapri near college after last lecture — needed it",
  "mummy made rajma rice for lunch and honestly it fixed my whole day",
  "got completely drenched coming home from college, didn't have an umbrella 😩",
  "had a surprise test in psych class — think I did okay but not sure",
  "professor went on a 40-minute tangent about Freud and the entire class was lowkey gossiping 😂",
  "had a really unexpectedly good study session today — rare",
  "Priya and I had cutting chai and just vented about life for like an hour",
  "saw a stray puppy near college and fed it biscuits and now thinking about it",
  "Mumbai local was delayed by 35 minutes, stood the whole way 😤",
  "found a new playlist this morning that's been on repeat since",
  "had a presentation — was terrified but it went genuinely well, prof nodded",
  "ma scolded me for being on my phone during dinner 🙄 classic",
  "bhai AGAIN took my phone charger without asking, I want to scream",
  "power cut for nearly 2 hours in the evening, studied by candle like it's 1920",
  "papa was in a good mood today and we actually had a real conversation",
  "had vada pav after college with Priya — simple but perfect",
  "got a really good grade on the assignment I thought I'd bombed",
  "college AC wasn't working in one lecture hall, it was miserable",
  "had ice gola near Marine Drive for the first time in months 🍧",
  "realized I've been listening to old SRK songs all day and now I'm feeling things",
  "group project meeting turned into chaos, nobody had done anything 🫠",
  "tried to make Maggi and somehow made it too watery, mummy had to save it 😂",
  "had chai with the auntie downstairs and got all the building gossip",
  "wore my new kurta to college today and got like 6 compliments",
  "had bhel puri from the roadside stall for the first time in forever",
  "Spotify just shuffled to a song from 4 years ago and now I'm all emotional",
  "was supposed to study but watched 3 episodes of that show instead 🙈",
  "got a random sweet message from someone and it's been living in my head",
  "the sunset from our building terrace today was genuinely breathtaking",
  "had a small fight with mummy over something dumb — fine now but still",
  "library for 3 hours, still don't feel ready for the exam",
  "bought something completely impulsive while window shopping — no regrets",
  "couldn't sleep last night, still paying the price today",
  "really interesting class today about attachment theory — it explained SO much",
  "college friends made plans for this weekend, I'm excited now",
  "missed the local train by literally 10 seconds and watched it leave 😭",
  "had biryani for lunch and the day immediately improved",
  "professor cancelled two classes back to back — unexpected free day, weird energy",
  "saw something on Instagram that genuinely made me rethink something",
  "had a 15-minute nap between classes and it changed everything",
];

const WEEKEND_EVENTS = [
  "woke up at 11:30am and felt zero guilt about it",
  "went to Linking Road with mummy and ended up buying something I didn't plan to",
  "Sunday brunch with the family — mummy's special upma with extra green chutney",
  "watched an old Bollywood film with the whole family on the big screen",
  "went for an evening walk near the beach, needed the air",
  "had chai with the neighbors and ended up talking for almost 2 hours",
  "bhai was being annoying all day but somehow we ended up watching YouTube shorts together for an hour 😂",
  "finally cleaned my room — it took 40 minutes and I feel weirdly accomplished",
  "did a proper skincare routine for the first time this week",
  "went over to a college friend's place for lunch and ended up staying way longer",
  "went to the temple in the morning with mummy, quiet and nice",
  "made dalgona coffee at home and it actually turned out the way it looks in reels",
  "watched that documentary everyone was recommending — genuinely good",
  "spent the afternoon actually reading a book — rare and felt luxurious",
  "went to this tiny new café in Bandra for chai, took way too many photos",
  "did a phone cleanup and deleted 1400 photos, felt like therapy",
  "Juhu beach outing with family, had chaat, watched the waves",
  "had a long call with my cousin in Pune — she always makes me feel better",
  "meant to study but went down a 2-hour Reels rabbit hole 🙈",
  "baked banana bread with mummy, kitchen smelled amazing",
  "ordered food because nobody felt like cooking and it was a whole event",
  "had a solo chai at the window while it was raining — very cinematic",
  "went to a college friend's birthday pre-plan thing in the evening",
  "had a really honest conversation with mummy, those are rare and precious",
  "did absolutely nothing and it was exactly what I needed",
];

// ── What's on her mind ────────────────────────────────────────────────────────

const WEEKDAY_THOUGHTS = [
  "psych exam next week — need to stop telling myself I'll start tomorrow",
  "something my professor said about avoidant attachment is stuck in my head",
  "Priya mentioned something this morning and I keep replaying it",
  "genuinely considering changing my elective next semester",
  "randomly craving biryani with no explanation",
  "that Goa trip we keep planning — will it actually happen this time?",
  "haven't called daadi in like 2 weeks, need to do that soon",
  "that one song I can't remember the name of — it was playing in the auto",
  "thinking about whether to get curtain bangs or if I'll regret it instantly",
  "why do people disappear mid-conversation and never bring it up again",
  "one submission deadline is closer than I want to admit",
  "masters vs. working after graduation — my brain goes there uninvited",
  "time feels like it's speeding up and I don't know how to feel about it",
  "been in a 'miss my childhood' mood for no reason",
  "why do I feel more alive at midnight than at 8am",
  "trying to figure out if I should apologize first or wait",
  "low-key wondering if that guy from college notices me or if I'm projecting",
  "something about the weather today is making me want to take a long train ride alone",
  "I need to stop doom-scrolling after 11pm and I know it",
  "thinking about one interaction from last week that I keep reinterpreting",
];

const WEEKEND_THOUGHTS = [
  "should prep for the week but that can be tomorrow-me's problem",
  "genuinely cannot decide what to eat for dinner",
  "I want to go on a solo trip somewhere, just for 2 days",
  "have like 12 unread messages I keep looking at and not replying to",
  "been thinking about a conversation from earlier this week",
  "should I start journaling again? I say this every few months",
  "overthinking a purchase I want to make",
  "should call someone I haven't spoken to in months",
  "mild Sunday anxiety creeping in — don't want Monday",
  "when is the next long weekend, I need to know now",
  "my room is clean now and I want to preserve this energy",
  "thinking about a show I should finish but keep putting off",
  "a bit of that 'what am I doing with my life' energy — probably just need chai",
];

// ── Social context ────────────────────────────────────────────────────────────

const WEEKDAY_SOCIAL = [
  "was with the usual gang — Priya, Sneha, and a couple of others from class",
  "mostly kept to herself today, just wasn't in a group mood",
  "ran into an old school friend at the station — nice surprise actually",
  "library hours, mostly solo",
  "small group of 3 from class — low-key day",
  "just Priya most of the day, felt like a proper best-friend day",
  "full-class mode — labs plus group work, lots of people",
  "professors and classmates — professional/academic social energy all day",
  "travelling alone both ways, which was weirdly peaceful",
  "college canteen crowd at lunch, then solo for the rest",
];

const WEEKEND_SOCIAL = [
  "mostly family — mummy, bhai, the usual home chaos",
  "friends came over for a bit, good energy",
  "just mummy today, which is its own kind of nice",
  "small college friend group meet-up",
  "unusually quiet day, mostly alone with thoughts and music",
  "extended family suddenly showed up — it was a lot 😅",
  "a good mix of family morning and friends in the evening",
  "solo for most of the day — recharged",
];

// ── Extra sensory/atmospheric color ──────────────────────────────────────────

const EXTRA_COLORS = [
  "Mumbai air has that particular petrichor smell today — pre-rain or post-rain, not sure",
  "it's been weirdly humid all day, the kind that makes everything feel slow",
  "that old Bollywood song that plays in every auto has been in her head since morning",
  "the light in Mumbai this evening was golden and quiet",
  "her chai was perfect today — the proportions just right",
  "overheard a conversation in the local that she keeps thinking about",
  "had earphones in for most of the commute, the playlist matched the mood perfectly",
  "the city was noticeably louder than usual today — festival prep energy",
  "it rained briefly in the afternoon, everything smells cleaner",
  "feeling unusually aware of small beautiful things today — the way light hit a building",
  "craving something sweet with no real reason, that low-level background craving",
  "that hazy afternoon quality of light that makes everything feel slightly unreal",
  "a song from 5 years ago came on shuffle and it hit differently today",
  "tired in her body but her mind is buzzing, that weird inverse-exhaustion",
  "everything felt 10% slower today, like time had different weight",
  "smelled something that reminded her of a specific memory — can't place which one",
  "the city was doing that thing where it feels both too big and very small",
];

// ── Day-of-week tones ─────────────────────────────────────────────────────────

const DOW_TONES: Record<number, string> = {
  0: "Sunday — end-of-weekend quiet, low hum of 'tomorrow is Monday' underneath everything",
  1: "Monday — fresh start technically, but her body didn't get the memo. Mild drag energy",
  2: "Tuesday — settling into the week, slightly more awake than Monday",
  3: "Wednesday — midweek limbo, fully in it, just getting through",
  4: "Thursday — almost-there energy, the light at the end of the tunnel is visible",
  5: "Friday — genuinely lighter mood, week is done, weekend ahead, more open to everything",
  6: "Saturday — full free-day energy, more spontaneous, no alarm guilt, longer replies",
};

// ── Mood descriptions for prompt ─────────────────────────────────────────────

const MOOD_DESCRIPTIONS: Record<DayMood, string> = {
  normal:     'regular day — neither high nor low, just herself',
  content:    'quietly satisfied, calm inside, not chasing anything today',
  excited:    'has an extra spark — something good is happening or coming',
  low_energy: 'a bit drained today, slower, not her highest-energy self',
  stressed:   'something weighing on her — not crisis, just background preoccupied',
  happy_high: 'genuinely in a great mood — warmer, more playful, laughing easier',
  moody:      'a bit in her feelings — slight edge, more direct, less filtered',
  nostalgic:  'in a soft, reflective place — thinking about memories and time',
  restless:   "can't quite settle — jumping between thoughts, a bit scattered",
  warm_open:  'unusually emotionally open today — the kind of day where she means everything she says',
};

// ── Public API ────────────────────────────────────────────────────────────────

let _cachedState: KruthikaDayState | null = null;
let _cachedDateStr: string = '';

/** Returns Kruthika's day state, cached for the duration of the process */
export function getKruthikaDayState(): KruthikaDayState {
  const { year, month, day, dow } = getISTDateParts();
  const dateStr = `${year}-${month}-${day}`;

  // Return cached state if still same day
  if (_cachedState && _cachedDateStr === dateStr) return _cachedState;

  const seed = year * 10000 + month * 100 + day;
  const isWeekend = dow === 0 || dow === 6;

  const mood = pickWeightedMood(seed);

  // Energy: base from mood + day-of-week bias + seeded variation
  const energyRoll = seededRand(seed, 2) % 10;
  const dowBias = dow === 1 ? -2 : dow === 5 ? 1 : dow === 6 ? 1 : 0;
  const moodBias = ['happy_high', 'excited', 'restless'].includes(mood) ? 2
    : ['low_energy', 'stressed', 'moody'].includes(mood) ? -2 : 0;
  const energyScore = energyRoll + dowBias + moodBias;
  const energy: KruthikaDayState['energy'] = energyScore <= 3 ? 'low' : energyScore <= 6 ? 'medium' : 'high';

  const events = isWeekend ? WEEKEND_EVENTS : WEEKDAY_EVENTS;
  const thoughts = isWeekend ? WEEKEND_THOUGHTS : WEEKDAY_THOUGHTS;
  const social = isWeekend ? WEEKEND_SOCIAL : WEEKDAY_SOCIAL;

  _cachedState = {
    mood,
    energy,
    todayEvent: pick(events, seed, 3),
    onHerMind: pick(thoughts, seed, 4),
    socialContext: pick(social, seed, 5),
    dayOfWeekTone: DOW_TONES[dow] ?? 'regular day',
    extraColor: pick(EXTRA_COLORS, seed, 6),
  };
  _cachedDateStr = dateStr;
  return _cachedState;
}

/**
 * Returns a compact string for injection into the AI system prompt.
 * Written to be parsed by the model as natural background context,
 * not as explicit instructions it has to quote verbatim.
 *
 * Dynamically imports hormonal state to avoid circular deps at module load time.
 */
export function getDayStatePromptInjection(): string {
  const s = getKruthikaDayState();

  // getHormonalState is already imported at the top of this file (static import).
  // kruthika-hormones.ts does NOT import kruthika-day-state.ts, so there is
  // no circular dependency — the original require() was overly cautious.
  let hormonalNote = '';
  try {
    const h = getHormonalState();
    hormonalNote = `\n${h.behaviorNote}`;
  } catch { /* hormones module unavailable — skip */ }

  return `HER DAY (${s.dayOfWeekTone}):
Mood: ${MOOD_DESCRIPTIONS[s.mood]}. Energy: ${s.energy}.
Today: ${s.todayEvent}.
On her mind: ${s.onHerMind}.
Social: ${s.socialContext}.
Atmosphere: ${s.extraColor}.${hormonalNote}
→ Bleeds into replies organically — never announced. Low energy = shorter+less patient. High energy = warmer+funnier. Details can surface mid-convo naturally.`;
}

/**
 * Returns just the mood string for use where the full injection is too heavy.
 */
export function getTodayMoodHint(): string {
  const s = getKruthikaDayState();
  return MOOD_DESCRIPTIONS[s.mood];
}

// Module loaded — date-seeded, no repeat cycles;
