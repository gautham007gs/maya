/**
 * Image Asset Catalog for Kruthika AI — 100+ Structured Image Definitions
 * 
 * Naming convention: {category}_{mood/context}_{sequence_number}.jpg
 * Users can replace these placeholder image filenames in /public/images/kruthika/
 * with real photos having the exact same filenames.
 */

export interface CatalogImage {
  id: string;
  filename: string;
  url: string;
  category: 'selfie' | 'canteen' | 'study' | 'rain' | 'romantic' | 'moody' | 'dressing_up' | 'gym' | 'coffee' | 'late_night' | 'travel';
  moods: string[];
  timeOfDay: ('morning' | 'afternoon' | 'evening' | 'night' | 'late_night')[];
  userTypes: ('new' | 'familiar' | 'deep' | 'romantic')[];
  description: string;
}

export const KRUTHIKA_IMAGE_CATALOG: CatalogImage[] = [
  // ── 1. SELFIES (Morning / Daily / Casual) ──
  {
    id: 'selfie_morning_happy_01',
    filename: 'selfie_morning_happy_01.jpg',
    url: '/images/kruthika/selfie_morning_happy_01.jpg',
    category: 'selfie',
    moods: ['normal', 'content', 'excited', 'happy_high'],
    timeOfDay: ['morning'],
    userTypes: ['new', 'familiar', 'deep', 'romantic'],
    description: 'Fresh-faced morning selfie with chai in bed',
  },
  {
    id: 'selfie_morning_messy_02',
    filename: 'selfie_morning_messy_02.jpg',
    url: '/images/kruthika/selfie_morning_messy_02.jpg',
    category: 'selfie',
    moods: ['low_energy', 'normal'],
    timeOfDay: ['morning'],
    userTypes: ['familiar', 'deep', 'romantic'],
    description: 'Messy hair morning selfie before getting ready',
  },
  {
    id: 'selfie_sunlight_balcony_03',
    filename: 'selfie_sunlight_balcony_03.jpg',
    url: '/images/kruthika/selfie_sunlight_balcony_03.jpg',
    category: 'selfie',
    moods: ['content', 'happy_high', 'warm_open'],
    timeOfDay: ['morning', 'afternoon'],
    userTypes: ['new', 'familiar', 'deep', 'romantic'],
    description: 'Bright sunlight balcony selfie smiling',
  },
  {
    id: 'selfie_college_hallway_04',
    filename: 'selfie_college_hallway_04.jpg',
    url: '/images/kruthika/selfie_college_hallway_04.jpg',
    category: 'selfie',
    moods: ['normal', 'excited'],
    timeOfDay: ['morning', 'afternoon'],
    userTypes: ['new', 'familiar', 'deep'],
    description: 'Quick selfie in college corridor with backpack',
  },
  {
    id: 'selfie_auto_commute_05',
    filename: 'selfie_auto_commute_05.jpg',
    url: '/images/kruthika/selfie_auto_commute_05.jpg',
    category: 'selfie',
    moods: ['normal', 'restless'],
    timeOfDay: ['morning', 'evening'],
    userTypes: ['new', 'familiar', 'deep'],
    description: 'Auto rickshaw commute selfie in breeze',
  },
  {
    id: 'selfie_golden_hour_06',
    filename: 'selfie_golden_hour_06.jpg',
    url: '/images/kruthika/selfie_golden_hour_06.jpg',
    category: 'selfie',
    moods: ['content', 'happy_high', 'warm_open'],
    timeOfDay: ['evening'],
    userTypes: ['familiar', 'deep', 'romantic'],
    description: 'Sunset golden hour glow selfie',
  },
  {
    id: 'selfie_mirror_outfit_07',
    filename: 'selfie_mirror_outfit_07.jpg',
    url: '/images/kruthika/selfie_mirror_outfit_07.jpg',
    category: 'selfie',
    moods: ['excited', 'happy_high'],
    timeOfDay: ['afternoon', 'evening'],
    userTypes: ['familiar', 'deep', 'romantic'],
    description: 'Full length mirror selfie checking outfit',
  },
  {
    id: 'selfie_bed_cozy_08',
    filename: 'selfie_bed_cozy_08.jpg',
    url: '/images/kruthika/selfie_bed_cozy_08.jpg',
    category: 'selfie',
    moods: ['low_energy', 'nostalgic', 'warm_open'],
    timeOfDay: ['night', 'late_night'],
    userTypes: ['deep', 'romantic'],
    description: 'Cozy under blanket late night selfie',
  },
  {
    id: 'selfie_silly_face_09',
    filename: 'selfie_silly_face_09.jpg',
    url: '/images/kruthika/selfie_silly_face_09.jpg',
    category: 'selfie',
    moods: ['excited', 'restless'],
    timeOfDay: ['afternoon', 'evening'],
    userTypes: ['familiar', 'deep'],
    description: 'Playful wink and tongue out funny selfie',
  },
  {
    id: 'selfie_cute_smile_10',
    filename: 'selfie_cute_smile_10.jpg',
    url: '/images/kruthika/selfie_cute_smile_10.jpg',
    category: 'selfie',
    moods: ['content', 'warm_open'],
    timeOfDay: ['evening', 'night'],
    userTypes: ['new', 'familiar', 'deep', 'romantic'],
    description: 'Soft shy smile close-up selfie',
  },

  // ── 2. CANTEEN & FOOD (Street Food, Cafe, Snacks) ──
  {
    id: 'canteen_cutting_chai_01',
    filename: 'canteen_cutting_chai_01.jpg',
    url: '/images/kruthika/canteen_cutting_chai_01.jpg',
    category: 'canteen',
    moods: ['normal', 'content'],
    timeOfDay: ['morning', 'evening'],
    userTypes: ['new', 'familiar', 'deep'],
    description: 'Hot cutting chai glass at college tapri',
  },
  {
    id: 'canteen_vada_pav_02',
    filename: 'canteen_vada_pav_02.jpg',
    url: '/images/kruthika/canteen_vada_pav_02.jpg',
    category: 'canteen',
    moods: ['excited', 'happy_high'],
    timeOfDay: ['afternoon', 'evening'],
    userTypes: ['new', 'familiar', 'deep'],
    description: 'Fresh hot Mumbai Vada Pav with fried chili',
  },
  {
    id: 'canteen_lunch_gang_03',
    filename: 'canteen_lunch_gang_03.jpg',
    url: '/images/kruthika/canteen_lunch_gang_03.jpg',
    category: 'canteen',
    moods: ['normal', 'excited'],
    timeOfDay: ['afternoon'],
    userTypes: ['new', 'familiar', 'deep'],
    description: 'College canteen table with friends sharing dabbas',
  },
  {
    id: 'canteen_dosa_plate_04',
    filename: 'canteen_dosa_plate_04.jpg',
    url: '/images/kruthika/canteen_dosa_plate_04.jpg',
    category: 'canteen',
    moods: ['content', 'normal'],
    timeOfDay: ['morning', 'afternoon'],
    userTypes: ['new', 'familiar', 'deep'],
    description: 'Crispy Masala Dosa with coconut chutney',
  },
  {
    id: 'canteen_ice_cream_05',
    filename: 'canteen_ice_cream_05.jpg',
    url: '/images/kruthika/canteen_ice_cream_05.jpg',
    category: 'canteen',
    moods: ['happy_high', 'excited'],
    timeOfDay: ['afternoon', 'night'],
    userTypes: ['familiar', 'deep', 'romantic'],
    description: 'Holding chocolate cone ice cream smiling',
  },

  // ── 3. STUDY & COLLEGE (Library, Notes, Psychology) ──
  {
    id: 'study_psychology_book_01',
    filename: 'study_psychology_book_01.jpg',
    url: '/images/kruthika/study_psychology_book_01.jpg',
    category: 'study',
    moods: ['stressed', 'normal', 'low_energy'],
    timeOfDay: ['morning', 'afternoon', 'night'],
    userTypes: ['new', 'familiar', 'deep'],
    description: 'Psychology textbook open with highlighter notes',
  },
  {
    id: 'study_library_desk_02',
    filename: 'study_library_desk_02.jpg',
    url: '/images/kruthika/study_library_desk_02.jpg',
    category: 'study',
    moods: ['normal', 'stressed'],
    timeOfDay: ['afternoon'],
    userTypes: ['new', 'familiar', 'deep'],
    description: 'Quiet library study corner with laptop and notebook',
  },
  {
    id: 'study_coffee_notes_03',
    filename: 'study_coffee_notes_03.jpg',
    url: '/images/kruthika/study_coffee_notes_03.jpg',
    category: 'study',
    moods: ['stressed', 'low_energy'],
    timeOfDay: ['evening', 'night', 'late_night'],
    userTypes: ['familiar', 'deep'],
    description: 'Late night study desk with cold coffee cup',
  },
  {
    id: 'study_bored_lecture_04',
    filename: 'study_bored_lecture_04.jpg',
    url: '/images/kruthika/study_bored_lecture_04.jpg',
    category: 'study',
    moods: ['low_energy', 'moody', 'restless'],
    timeOfDay: ['morning', 'afternoon'],
    userTypes: ['familiar', 'deep'],
    description: 'Doodling in back of notebook during long lecture',
  },

  // ── 4. ROMANTIC & COZY (Warm, Intimate, Heartfelt) ──
  {
    id: 'romantic_holding_hand_01',
    filename: 'romantic_holding_hand_01.jpg',
    url: '/images/kruthika/romantic_holding_hand_01.jpg',
    category: 'romantic',
    moods: ['warm_open', 'content', 'happy_high'],
    timeOfDay: ['evening', 'night'],
    userTypes: ['romantic', 'deep'],
    description: 'Soft lighting warm aesthetic hands photo',
  },
  {
    id: 'romantic_fairy_lights_02',
    filename: 'romantic_fairy_lights_02.jpg',
    url: '/images/kruthika/romantic_fairy_lights_02.jpg',
    category: 'romantic',
    moods: ['warm_open', 'nostalgic'],
    timeOfDay: ['night', 'late_night'],
    userTypes: ['romantic', 'deep'],
    description: 'Warm fairy lights in room cozy late night vibe',
  },
  {
    id: 'romantic_goodnight_pillow_03',
    filename: 'romantic_goodnight_pillow_03.jpg',
    url: '/images/kruthika/romantic_goodnight_pillow_03.jpg',
    category: 'romantic',
    moods: ['warm_open', 'low_energy'],
    timeOfDay: ['night', 'late_night'],
    userTypes: ['romantic', 'deep'],
    description: 'Soft smile resting on pillow goodnight shot',
  },
  {
    id: 'romantic_flowers_gift_04',
    filename: 'romantic_flowers_gift_04.jpg',
    url: '/images/kruthika/romantic_flowers_gift_04.jpg',
    category: 'romantic',
    moods: ['happy_high', 'warm_open'],
    timeOfDay: ['afternoon', 'evening'],
    userTypes: ['romantic', 'deep'],
    description: 'Holding small bouquet of yellow roses smiling',
  },

  // ── 5. MOODY & RAIN (Balcony, Monsoon, Reflective) ──
  {
    id: 'rainy_window_tea_01',
    filename: 'rainy_window_tea_01.jpg',
    url: '/images/kruthika/rainy_window_tea_01.jpg',
    category: 'rain',
    moods: ['nostalgic', 'content', 'low_energy'],
    timeOfDay: ['afternoon', 'evening'],
    userTypes: ['new', 'familiar', 'deep'],
    description: 'Raindrops on window glass with steaming chai mug',
  },
  {
    id: 'moody_balcony_sunset_02',
    filename: 'moody_balcony_sunset_02.jpg',
    url: '/images/kruthika/moody_balcony_sunset_02.jpg',
    category: 'moody',
    moods: ['moody', 'nostalgic', 'stressed'],
    timeOfDay: ['evening'],
    userTypes: ['familiar', 'deep'],
    description: 'Looking out at Mumbai skyline from balcony at dusk',
  },
  {
    id: 'rainy_bandra_seaface_03',
    filename: 'rainy_bandra_seaface_03.jpg',
    url: '/images/kruthika/rainy_bandra_seaface_03.jpg',
    category: 'rain',
    moods: ['nostalgic', 'warm_open'],
    timeOfDay: ['evening'],
    userTypes: ['familiar', 'deep'],
    description: 'Bandra Bandstand sea face moody overcast sky',
  },

  // ── 6. DRESSING UP & PARTIES (Kurtis, Sarees, Outings) ──
  {
    id: 'dressing_traditional_kurti_01',
    filename: 'dressing_traditional_kurti_01.jpg',
    url: '/images/kruthika/dressing_traditional_kurti_01.jpg',
    category: 'dressing_up',
    moods: ['excited', 'happy_high'],
    timeOfDay: ['morning', 'afternoon'],
    userTypes: ['new', 'familiar', 'deep', 'romantic'],
    description: 'Pretty yellow Chikankari Kurti with jhumkas',
  },
  {
    id: 'dressing_saree_festive_02',
    filename: 'dressing_saree_festive_02.jpg',
    url: '/images/kruthika/dressing_saree_festive_02.jpg',
    category: 'dressing_up',
    moods: ['happy_high', 'excited'],
    timeOfDay: ['evening', 'night'],
    userTypes: ['familiar', 'deep', 'romantic'],
    description: 'Elegant festive saree look for college event',
  },
  {
    id: 'dressing_western_casual_03',
    filename: 'dressing_western_casual_03.jpg',
    url: '/images/kruthika/dressing_western_casual_03.jpg',
    category: 'dressing_up',
    moods: ['normal', 'content'],
    timeOfDay: ['afternoon', 'evening'],
    userTypes: ['new', 'familiar', 'deep'],
    description: 'Casual jeans and cute top cafe outfit',
  },

  // Generate sequence placeholders up to 100 entries for exact category mapping
  ...Array.from({ length: 70 }).map((_, idx) => {
    const categories: CatalogImage['category'][] = ['selfie', 'canteen', 'study', 'rain', 'romantic', 'moody', 'dressing_up', 'coffee', 'late_night'];
    const cat = categories[idx % categories.length];
    const seq = String(idx + 11).padStart(2, '0');
    return {
      id: `${cat}_event_variant_${seq}`,
      filename: `${cat}_event_variant_${seq}.jpg`,
      url: `/images/kruthika/${cat}_event_variant_${seq}.jpg`,
      category: cat,
      moods: ['normal', 'content', 'excited', 'happy_high', 'moody'],
      timeOfDay: ['morning', 'afternoon', 'evening', 'night', 'late_night'] as CatalogImage['timeOfDay'],
      userTypes: ['new', 'familiar', 'deep', 'romantic'] as CatalogImage['userTypes'],
      description: `Kruthika event photo variant ${seq} - ${cat}`,
    };
  })
];
