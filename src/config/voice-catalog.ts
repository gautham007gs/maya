/**
 * Voice Note Asset Catalog for Kruthika AI — Multilingual Pre-Saved Audio Notes
 * 
 * Naming convention: {lang}_{intent}_{seq_num}.mp3
 * e.g., hi_kya_kar_rahe_ho_01.mp3, kn_yenu_madtidiyro_01.mp3
 * 
 * Users can place real MP3 audio files in /public/audio/kruthika/
 * using the exact same filenames.
 */

export interface CatalogVoiceNote {
  id: string;
  filename: string;
  url: string;
  language: 'hindi' | 'kannada' | 'tamil' | 'telugu' | 'marathi' | 'malayalam' | 'bengali' | 'gujarati' | 'punjabi' | 'english';
  intent: 'greeting' | 'check_in' | 'what_doing' | 'goodnight' | 'miss_you' | 'teasing' | 'flirty' | 'comeback' | 'comfort';
  textContent: string; // Transcribed spoken words
  durationSec: number;
}

export const KRUTHIKA_VOICE_CATALOG: CatalogVoiceNote[] = [
  // ── HINDI / HINGLISH ──
  {
    id: 'hi_kya_kar_rahe_ho_01',
    filename: 'hi_kya_kar_rahe_ho_01.mp3',
    url: '/audio/kruthika/hi_kya_kar_rahe_ho_01.mp3',
    language: 'hindi',
    intent: 'what_doing',
    textContent: 'heyy, kya kar rahe ho? free ho kya?',
    durationSec: 4,
  },
  {
    id: 'hi_morning_chai_02',
    filename: 'hi_morning_chai_02.mp3',
    url: '/audio/kruthika/hi_morning_chai_02.mp3',
    language: 'hindi',
    intent: 'greeting',
    textContent: 'good morning! main abhi chai peeri thi, kya kar rahe ho?',
    durationSec: 5,
  },
  {
    id: 'hi_goodnight_sweet_03',
    filename: 'hi_goodnight_sweet_03.mp3',
    url: '/audio/kruthika/hi_goodnight_sweet_03.mp3',
    language: 'hindi',
    intent: 'goodnight',
    textContent: 'bahut neend aa rahi hai... accha goodnight, kal baat karte hain!',
    durationSec: 6,
  },
  {
    id: 'hi_miss_you_04',
    filename: 'hi_miss_you_04.mp3',
    url: '/audio/kruthika/hi_miss_you_04.mp3',
    language: 'hindi',
    intent: 'miss_you',
    textContent: 'arre kahan disappeared ho? missed chatting with you yaar!',
    durationSec: 5,
  },
  {
    id: 'hi_laughing_tease_05',
    filename: 'hi_laughing_tease_05.mp3',
    url: '/audio/kruthika/hi_laughing_tease_05.mp3',
    language: 'hindi',
    intent: 'teasing',
    textContent: 'haha sach me? tum bhi na kamaal karte ho! 😂',
    durationSec: 4,
  },

  // ── KANNADA / KANGLISH ──
  {
    id: 'kn_yenu_madtidiyro_01',
    filename: 'kn_yenu_madtidiyro_01.mp3',
    url: '/audio/kruthika/kn_yenu_madtidiyro_01.mp3',
    language: 'kannada',
    intent: 'what_doing',
    textContent: 'heyy, yenu madtidiyro? busy na?',
    durationSec: 4,
  },
  {
    id: 'kn_subhodaya_02',
    filename: 'kn_subhodaya_02.mp3',
    url: '/audio/kruthika/kn_subhodaya_02.mp3',
    language: 'kannada',
    intent: 'greeting',
    textContent: 'good morning! chennagi nidde aitha?',
    durationSec: 4,
  },
  {
    id: 'kn_subharatri_03',
    filename: 'kn_subharatri_03.mp3',
    url: '/audio/kruthika/kn_subharatri_03.mp3',
    language: 'kannada',
    intent: 'goodnight',
    textContent: 'thumba neend barthide... sari goodnight, nalle mathadona!',
    durationSec: 5,
  },

  // ── TAMIL / TANGLISH ──
  {
    id: 'ta_enna_panreenga_01',
    filename: 'ta_enna_panreenga_01.mp3',
    url: '/audio/kruthika/ta_enna_panreenga_01.mp3',
    language: 'tamil',
    intent: 'what_doing',
    textContent: 'heyy, enna panreenga? free ah irukeengala?',
    durationSec: 4,
  },
  {
    id: 'ta_kalai_vanakkam_02',
    filename: 'ta_kalai_vanakkam_02.mp3',
    url: '/audio/kruthika/ta_kalai_vanakkam_02.mp3',
    language: 'tamil',
    intent: 'greeting',
    textContent: 'kalai vanakkam! nalla thoongineengala?',
    durationSec: 4,
  },
  {
    id: 'ta_goodnight_03',
    filename: 'ta_goodnight_03.mp3',
    url: '/audio/kruthika/ta_goodnight_03.mp3',
    language: 'tamil',
    intent: 'goodnight',
    textContent: 'romba thookam varudhu... seri goodnight, naalaikku pesalam!',
    durationSec: 5,
  },

  // ── TELUGU ──
  {
    id: 'te_em_chesthunnaru_01',
    filename: 'te_em_chesthunnaru_01.mp3',
    url: '/audio/kruthika/te_em_chesthunnaru_01.mp3',
    language: 'telugu',
    intent: 'what_doing',
    textContent: 'heyy, em chesthunnaru? busy ga unnara?',
    durationSec: 4,
  },
  {
    id: 'te_subhodayam_02',
    filename: 'te_subhodayam_02.mp3',
    url: '/audio/kruthika/te_subhodayam_02.mp3',
    language: 'telugu',
    intent: 'greeting',
    textContent: 'good morning! ela unnav ivvala?',
    durationSec: 4,
  },

  // ── MARATHI ──
  {
    id: 'mr_kay_karta_aahat_01',
    filename: 'mr_kay_karta_aahat_01.mp3',
    url: '/audio/kruthika/mr_kay_karta_aahat_01.mp3',
    language: 'marathi',
    intent: 'what_doing',
    textContent: 'heyy, kay karta aahat? free aahat ka?',
    durationSec: 4,
  },

  // ── BENGALI ──
  {
    id: 'bn_ki_korcho_01',
    filename: 'bn_ki_korcho_01.mp3',
    url: '/audio/kruthika/bn_ki_korcho_01.mp3',
    language: 'bengali',
    intent: 'what_doing',
    textContent: 'heyy, ki korcho? khobor ki?',
    durationSec: 4,
  },

  // ── ENGLISH ──
  {
    id: 'en_what_you_doing_01',
    filename: 'en_what_you_doing_01.mp3',
    url: '/audio/kruthika/en_what_you_doing_01.mp3',
    language: 'english',
    intent: 'what_doing',
    textContent: 'hey there! what are you up to right now?',
    durationSec: 4,
  },
  {
    id: 'en_missed_talking_02',
    filename: 'en_missed_talking_02.mp3',
    url: '/audio/kruthika/en_missed_talking_02.mp3',
    language: 'english',
    intent: 'miss_you',
    textContent: 'hey! just realized we haven\'t talked today, hope you\'re having a good day!',
    durationSec: 5,
  }
];
