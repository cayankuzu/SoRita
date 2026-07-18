import { uniqueStrings } from '@/mobile/app/shared/utils/format';

export type ProfileInterestOption = {
  value: string;
  label: string;
};

export const PROFILE_INTEREST_OPTIONS: ProfileInterestOption[] = [
  { value: 'coffee', label: 'Kahve keşfi' },
  { value: 'third_wave_coffee', label: '3. dalga kahve' },
  { value: 'matcha_tea', label: 'Matcha ve çay seremonisi' },
  { value: 'brunch', label: 'Brunch rotaları' },
  { value: 'breakfast_spots', label: 'Kahvaltı mekânları' },
  { value: 'new_tastes', label: 'Yeni lezzetler' },
  { value: 'street_food', label: 'Sokak lezzetleri' },
  { value: 'fine_dining', label: 'Fine dining deneyimleri' },
  { value: 'world_cuisine', label: 'Dünya mutfakları' },
  { value: 'dessert', label: 'Tatlı durakları' },
  { value: 'bakery_patisserie', label: 'Fırından yeni çıkmışlar' },
  { value: 'wine_bars', label: 'Wine bar ve şarap tadımı' },
  { value: 'vegan', label: 'Vegan ve sağlıklı yaşam' },
  { value: 'nightlife', label: 'Gece hayatı' },
  { value: 'cocktails', label: 'Kokteyl mekânları' },
  { value: 'craft_beer', label: 'Craft bira' },
  { value: 'rooftop_evenings', label: 'Rooftop akşamları' },
  { value: 'live_music', label: 'Canlı müzik' },
  { value: 'jazz_blues', label: 'Jazz ve blues geceleri' },
  { value: 'dj_sets', label: 'DJ setleri ve kulüp geceleri' },
  { value: 'festivals', label: 'Festival ve etkinlikler' },
  { value: 'art_design', label: 'Sanat ve tasarım' },
  { value: 'museums', label: 'Müze ve sergiler' },
  { value: 'contemporary_art', label: 'Çağdaş sanat' },
  { value: 'history', label: 'Tarih ve mimari' },
  { value: 'architecture_walks', label: 'Mimari yürüyüşler' },
  { value: 'photography', label: 'Fotoğrafçılık' },
  { value: 'sunset_spots', label: 'Gün batımı noktaları' },
  { value: 'content_creator', label: 'İçerik üretimi' },
  { value: 'travel', label: 'Seyahat planları' },
  { value: 'road_trips', label: 'Road trip rotaları' },
  { value: 'boutique_stays', label: 'Butik oteller ve staycation' },
  { value: 'nature', label: 'Doğa kaçamakları' },
  { value: 'hiking', label: 'Trekking ve yürüyüş' },
  { value: 'camping', label: 'Kamp hafta sonları' },
  { value: 'beach', label: 'Deniz ve plaj' },
  { value: 'surf_swim', label: 'Yüzme ve su sporları' },
  { value: 'wellness', label: 'Wellness ve spa' },
  { value: 'mindfulness', label: 'Yoga ve mindfulness' },
  { value: 'pilates_reformer', label: 'Pilates ve reformer' },
  { value: 'fitness', label: 'Koşu ve fitness' },
  { value: 'cycling', label: 'Bisiklet rotaları' },
  { value: 'remote_work', label: 'Uzaktan çalışma' },
  { value: 'study_dates', label: 'Study date ve sakin mekânlar' },
  { value: 'startup_networking', label: 'Startup ve networking buluşmaları' },
  { value: 'books', label: 'Kitaplar ve okumak' },
  { value: 'vinyl_collecting', label: 'Plak ve müzik koleksiyonu' },
  { value: 'board_games', label: 'Board game akşamları' },
  { value: 'cinema_series', label: 'Film ve dizi' },
  { value: 'indie_cinema', label: 'Bağımsız sinema' },
  { value: 'fashion', label: 'Moda ve stil' },
  { value: 'shopping', label: 'Alışveriş ve vintage' },
  { value: 'thrift_vintage', label: 'Thrift ve vintage avcılığı' },
  { value: 'design_stores', label: 'Konsept store ve tasarım dükkânları' },
  { value: 'technology', label: 'Teknoloji ve üretkenlik' },
  { value: 'gaming', label: 'Gaming ve e-spor' },
  { value: 'pet_friendly', label: 'Pet dostu yaşam' },
  { value: 'family_time', label: 'Ailece planlar' },
  { value: 'romantic_dates', label: 'Romantik randevular' },
  { value: 'solo_time', label: 'Solo date planları' },
  { value: 'hidden_gems', label: 'Gizli keşifler' },
  { value: 'local_markets', label: 'Lokal pazarlar ve semt hayatı' },
  { value: 'minimal_living', label: 'Minimal yaşam ve sade mekânlar' },
  { value: 'sustainable_living', label: 'Sürdürülebilir yaşam' },
] as const;

export const PROFILE_INTEREST_META = Object.fromEntries(
  PROFILE_INTEREST_OPTIONS.map((item) => [item.value, item]),
) as Record<string, ProfileInterestOption>;

const LEGACY_INTEREST_MAP: Record<string, string[]> = {
  aquarium: ['family_time'],
  amusementcenter: ['family_time', 'festivals'],
  artcenter: ['art_design'],
  artgallery: ['art_design', 'museums'],
  bakery: ['dessert', 'coffee'],
  bar: ['cocktails', 'nightlife'],
  bazaar: ['shopping', 'hidden_gems'],
  beach: ['beach', 'travel'],
  beachclub: ['beach', 'nightlife'],
  bookstore: ['books', 'coffee'],
  breakfast: ['brunch'],
  brunchspot: ['brunch'],
  cafe: ['coffee', 'third_wave_coffee'],
  camping: ['nature', 'travel'],
  cinema: ['cinema_series'],
  cocktailbar: ['cocktails', 'nightlife'],
  concerthall: ['live_music'],
  coworking: ['remote_work', 'startup_networking'],
  dessert: ['dessert'],
  eventvenue: ['festivals'],
  forest: ['nature'],
  gelato: ['dessert'],
  gym: ['fitness'],
  historicsite: ['history', 'travel'],
  hotel: ['travel'],
  icecream: ['dessert'],
  library: ['books'],
  market: ['shopping', 'local_markets'],
  museum: ['museums', 'history'],
  musicvenue: ['live_music', 'nightlife'],
  nightclub: ['nightlife'],
  nightlife: ['nightlife'],
  park: ['nature', 'family_time'],
  petfriendlycafe: ['pet_friendly', 'coffee'],
  pilatesstudio: ['mindfulness', 'fitness'],
  restaurant: ['new_tastes', 'world_cuisine'],
  rooftop: ['cocktails', 'hidden_gems'],
  shopping: ['shopping'],
  spa: ['wellness'],
  sport: ['fitness'],
  streetfood: ['street_food', 'new_tastes'],
  studycafe: ['study_dates', 'books'],
  teahouse: ['books'],
  theater: ['art_design'],
  veganrestaurant: ['vegan'],
  viewpoint: ['photography', 'travel'],
  vintageStore: ['fashion', 'shopping'],
  watersports: ['beach', 'fitness'],
  workshop: ['art_design', 'technology'],
  yoga: ['mindfulness', 'wellness'],
};

export function normalizeProfileInterests(values: string[]) {
  return uniqueStrings(
    values.flatMap((value) => {
      if (PROFILE_INTEREST_META[value]) {
        return [value];
      }

      return LEGACY_INTEREST_MAP[value] || [];
    }),
  );
}

export function inferProfileInterestsFromCategories(values: string[]) {
  return normalizeProfileInterests(values).slice(0, 8);
}
