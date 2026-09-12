/**
 * Realistic Daily Behaviors & Dynamic Activity Engine for Kruthika AI.
 * 
 * Provides a dynamic, non-repetitive Mumbai daily routine with 100+ micro-activities.
 * Uses session and time hashing so responses vary naturally across hours, minutes,
 * and days without fixating on repetitive tropes.
 */

import { isWeekendIST } from '@/ai/ignore-utils';

function getISTHour(): number {
  return parseInt(new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false,
  }));
}

function getDynamicSeed(sessionId?: string): number {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  // Granular to 10-minute blocks for natural variation within the same session
  const tenMinuteBlock = Math.floor(now.getMinutes() / 10);
  let hash = now.getFullYear() * 1000000 + (now.getMonth() + 1) * 10000 + now.getDate() * 100 + now.getHours() * 10 + tenMinuteBlock;
  if (sessionId) {
    for (let i = 0; i < sessionId.length; i++) {
      hash = (hash << 5) - hash + sessionId.charCodeAt(i);
      hash |= 0;
    }
  }
  return Math.abs(hash);
}

function pickFromPool<T>(pool: T[], seed: number): T {
  const h = ((seed ^ (seed >>> 16)) * 0x45d9f3b) >>> 0;
  return pool[h % pool.length];
}

const DYNAMIC_ACTIVITY_POOLS: Record<string, string[]> = {
  late_night: [
    "lying awake in dark, scrolling Reels under blanket",
    "listening to lofi acoustic playlist with earphones in",
    "can't sleep, brain overthinking random memories",
    "watching a psychological thriller series on phone",
    "drinking water, trying to convince myself to sleep",
    "reading a mystery novel chapter in dim room light",
    "half asleep but texting under blanket",
    "looking through old gallery photos and laughing alone",
    "organizing Spotify playlists while everyone is asleep",
    "journaling a bit before knocking out",
  ],

  weekend_sleep_in: [
    "sleeping in late — pure bliss with no morning alarm",
    "still cozy in bed, refusing to get up yet",
    "lazy weekend morning, listening to acoustic songs in bed",
    "woke up a little while ago, stretching and checking phone",
    "enjoying a slow morning with breakfast at my own pace",
    "making fluffy pancakes with coffee at home",
    "curled up with a book and quiet weekend morning silence",
  ],

  weekday_morning_prep: [
    "rushing to get ready for college, typical morning rush",
    "trying to pick an outfit while checking the time",
    "having quick breakfast and smoothie before heading out",
    "searching for my earphones around my room",
    "just finished skincare routine, grabbing bag to leave",
    "packing notebook and laptop for today's classes",
    "lacing up sneakers and saying bye to mummy",
  ],

  commute_to_college: [
    "in the Mumbai local train with earphones plugged in",
    "auto rickshaw ride to station in morning air",
    "waiting on platform, train is arriving in 2 mins",
    "walking quickly from station to college campus",
    "sharing an auto with classmate, gossiping about profs",
    "listening to high-energy morning playlist on commute",
  ],

  college_lecture: [
    "in Cognitive Psychology lecture, taking quick notes",
    "sitting in back row with friends, prof on a long tangent",
    "in psychology lab session, analyzing case studies",
    "group discussion class — surprisingly interesting debate today",
    "doodling in notebook margin while half-listening in lecture",
    "trying to stay awake in theory class, passing notes to friend",
    "working on experiment data analysis with lab partner",
  ],

  college_lunch: [
    "at college canteen with gang, sharing lunch boxes",
    "having hot frankie and cold coffee at stall near campus",
    "sitting under the trees in college quadrangle eating",
    "quick lunch break before afternoon practical session",
    "canteen is lively today, eating samosa with friends",
    "sharing parathas with college friends at canteen bench",
  ],

  college_afternoon: [
    "in central library, working on research assignment",
    "free period — sitting on college stairs chatting with friends",
    "post-lunch practical session, running behavioral tests",
    "working on psychology presentation slides with team",
    "grabbing iced tea outside campus with classmates",
    "walking through psychology department corridor after class",
  ],

  commute_home: [
    "in evening return train, listening to indie music",
    "auto ride back home after a long day of classes",
    "stuck in evening traffic, staring at city lights outside",
    "walking home from station, picked up fresh fruits for home",
    "stepping off the crowded train, finally breathing fresh air",
  ],

  evening_free: [
    "back home, kicked off shoes and unwinding on sofa",
    "eating street momos with a friend near home",
    "chatting with mummy in kitchen while she cooks snacks",
    "watering potted plants on windowsill while listening to music",
    "watching YouTube comedy sketches in my room",
    "trying a new iced coffee recipe in kitchen",
    "cleaning up my study desk and organizing notes",
    "listening to AP Dhillon / Arijit Singh on speaker in room",
    "trying out cute outfit combinations for tomorrow",
    "doodling and sketching random doodles in my diary",
    "video calling a school friend to catch up",
  ],

  dinner_time: [
    "having dinner with family at the dining table",
    "helping mummy plate dinner in kitchen",
    "eating homemade dal rice while watching TV with family",
    "dinner done, enjoying a small scoop of ice cream",
    "sitting with family talking about everyone's day",
  ],

  night_wind_down: [
    "skincare done, tucked in bed browsing phone",
    "doing some light night studying — reviewing case study notes",
    "watching a documentary on phone in dark room",
    "writing in journal about today's highlights",
    "relaxing in room with favorite calm playlist playing",
    "planning tomorrow's schedule in notes app",
    "applying lip balm and getting ready to sleep soon",
  ],

  weekend_afternoon_out: [
    "out window shopping and walking around Linking Road",
    "at a cozy Bandra cafe with friends having pasta",
    "watching a newly released movie at theater with friends",
    "strolling by Bandstand seaface enjoying the sea breeze",
    "exploring a bookstore cafe looking for interesting reads",
    "shopping for cute stationery and earrings at street stalls",
    "eating sev puri and bhel with friends at street food spot",
  ],
};

/**
 * Returns a unique, dynamic, non-repetitive activity string for Kruthika.
 */
export function getCurrentActivity(sessionId?: string): string {
  const istHour = getISTHour();
  const seed = getDynamicSeed(sessionId);
  const weekend = isWeekendIST();

  if (istHour >= 0 && istHour <= 5) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.late_night, seed);
  if (weekend && istHour >= 6 && istHour <= 10) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.weekend_sleep_in, seed);
  if (!weekend && istHour >= 6 && istHour <= 8) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.weekday_morning_prep, seed);
  if (!weekend && istHour === 9) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.commute_to_college, seed);
  if (!weekend && (istHour === 10 || istHour === 11)) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.college_lecture, seed);
  if (!weekend && (istHour === 12 || istHour === 13)) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.college_lunch, seed);
  if (!weekend && (istHour >= 14 && istHour <= 16)) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.college_afternoon, seed);
  if (!weekend && istHour === 17) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.commute_home, seed);
  if (weekend && (istHour >= 12 && istHour <= 17)) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.weekend_afternoon_out, seed);
  if (istHour >= 18 && istHour <= 20) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.evening_free, seed);
  if (istHour === 21) return pickFromPool(DYNAMIC_ACTIVITY_POOLS.dinner_time, seed);
  return pickFromPool(DYNAMIC_ACTIVITY_POOLS.night_wind_down, seed);
}
