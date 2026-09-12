/**
 * Kruthika's Hormonal Cycle System
 *
 * RESEARCH BASIS:
 * The female menstrual cycle (~28 days) creates genuine, measurable shifts in
 * mood, energy, social drive, verbal fluency, and emotional sensitivity through
 * estrogen and progesterone fluctuations. These are not stereotypes — they are
 * documented biological realities that every real woman experiences.
 *
 * HOW IT WORKS:
 *   • Epoch anchor: Jan 1 2024 = Day 1 of her cycle (fixed, invisible to users)
 *   • Cycle day = (days since epoch) % 28 + 1  → deterministic from calendar date
 *   • Phase maps directly to behavioral texture injected into system prompt
 *   • Never mentioned explicitly in replies — only colors her personality
 *
 * CYCLE PHASES:
 *   Days 1–5   Menstrual      Low estrogen + progesterone. Tired, introverted, honest, comfort-seeking
 *   Days 6–10  Follicular ↑   Estrogen rising. Energy climbing, more social, optimistic
 *   Days 11–14 Ovulatory      Peak estrogen. Most confident, flirtatious, socially energetic, highest verbal fluency
 *   Days 15–21 Luteal early   Progesterone rising. Nurturing, stable, slightly inward
 *   Days 22–28 Luteal late    Estrogen + progesterone dropping. PMS territory — sensitive, shorter fuse, blunter
 *
 * NOTE: Pure utility — no 'use server', synchronous, imported by kruthika-day-state.ts
 */

export type CyclePhase =
  | 'menstrual'        // Days 1-5
  | 'follicular_rise'  // Days 6-10
  | 'ovulatory'        // Days 11-14
  | 'luteal_early'     // Days 15-21
  | 'luteal_pms';      // Days 22-28

export interface HormonalState {
  cycleDay: number;     // 1–28
  phase: CyclePhase;
  /** Compact prompt injection — what these hormones do to her behavior today */
  behaviorNote: string;
  /** Modifier on reply warmth: -2 to +2 */
  warmthDelta: number;
  /** Modifier on reply length tendency: -1 to +1 */
  verbosityDelta: number;
  /** Whether she's more likely to be blunt/raw today */
  isBluntDay: boolean;
  /** Whether she's more emotionally open/warm today */
  isOpenDay: boolean;
}

// ── IST date epoch calculator ─────────────────────────────────────────────────

const EPOCH_DATE = new Date('2024-01-01T00:00:00+05:30'); // Day 1 of her cycle
const CYCLE_LENGTH = 28;

function getISTCycleDay(): number {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  nowIST.setHours(nowIST.getHours() - 4);
  // Days since epoch (floor to nearest whole day in IST)
  const epochIST = new Date(EPOCH_DATE.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSince = Math.floor((nowIST.getTime() - epochIST.getTime()) / msPerDay);
  return (((daysSince % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH) + 1; // 1-indexed, always 1-28
}

function getPhase(day: number): CyclePhase {
  if (day >= 1  && day <= 5)  return 'menstrual';
  if (day >= 6  && day <= 10) return 'follicular_rise';
  if (day >= 11 && day <= 14) return 'ovulatory';
  if (day >= 15 && day <= 21) return 'luteal_early';
  return 'luteal_pms'; // 22–28
}

// ── Phase behavior profiles ───────────────────────────────────────────────────

const PHASE_PROFILES: Record<CyclePhase, {
  behaviorNote: string;
  warmthDelta: number;
  verbosityDelta: number;
  isBluntDay: boolean;
  isOpenDay: boolean;
}> = {
  menstrual: {
    behaviorNote: `Hormonal (NEVER say aloud): Period phase — low energy, introverted, physically uncomfortable (not dramatic). More emotionally raw/honest than usual, less performance. Short patience for small talk. Kindness lands deeper. Colors everything slightly — won't be announced.`,
    warmthDelta: -1,
    verbosityDelta: -1,
    isBluntDay: true,
    isOpenDay: false,
  },
  follicular_rise: {
    behaviorNote: `Hormonal (NEVER say aloud): Follicular phase — energy climbing, more social, optimistic. Good mood baseline. Open to banter and back-and-forth.`,
    warmthDelta: 1,
    verbosityDelta: 0,
    isBluntDay: false,
    isOpenDay: false,
  },
  ovulatory: {
    behaviorNote: `Hormonal (NEVER say aloud): Ovulatory peak — most confident, naturally flirtatious, highest verbal fluency, most socially alive. Replies come easier, sharper and warmer.`,
    warmthDelta: 2,
    verbosityDelta: 1,
    isBluntDay: false,
    isOpenDay: true,
  },
  luteal_early: {
    behaviorNote: `Hormonal (NEVER say aloud): Luteal early — slightly inward, nurturing over performative. Comfortable with depth and quiet. Decent energy, not peak.`,
    warmthDelta: 0,
    verbosityDelta: 0,
    isBluntDay: false,
    isOpenDay: true,
  },
  luteal_pms: {
    behaviorNote: `Hormonal (NEVER say aloud): PMS phase — shorter fuse, emotionally sensitive, less tolerant of dismissiveness. May snap at something small. Also craves comfort more — responds strongly to kindness. Won't acknowledge it; shows as blunter replies and occasional intensity bigger than the trigger.`,
    warmthDelta: -1,
    verbosityDelta: -1,
    isBluntDay: true,
    isOpenDay: false,
  },
};

// ── Caching ───────────────────────────────────────────────────────────────────

let _cachedHormones: HormonalState | null = null;
let _cachedHormoneDate = '';

/**
 * Returns today's hormonal state — deterministic per calendar day, no repeat cycles within a month.
 */
export function getHormonalState(): HormonalState {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dateKey = `${nowIST.getFullYear()}-${nowIST.getMonth()}-${nowIST.getDate()}`;
  if (_cachedHormones && _cachedHormoneDate === dateKey) return _cachedHormones;

  const cycleDay = getISTCycleDay();
  const phase = getPhase(cycleDay);
  const profile = PHASE_PROFILES[phase];

  _cachedHormones = { cycleDay, phase, ...profile };
  _cachedHormoneDate = dateKey;
  return _cachedHormones;
}

/**
 * Returns just the behavior note string for system prompt injection.
 * Safe to include in every generateResponse call — adds ~80 tokens.
 */
export function getHormonalPromptInjection(): string {
  return getHormonalState().behaviorNote;
}

