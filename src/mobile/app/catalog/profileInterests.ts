export type ProfileInterestOption = {
  value: string;
  label: string;
};

export const PROFILE_INTEREST_OPTIONS: ProfileInterestOption[] = [
  { value: 'coffee', label: 'Kahve kesfi' },
  { value: 'third_wave_coffee', label: '3. dalga kahve' },
  { value: 'matcha_tea', label: 'Matcha ve cay seremonisi' },
  { value: 'brunch', label: 'Brunch rotalari' },
  { value: 'breakfast_spots', label: 'Kahvalti mekanlari' },
  { value: 'new_tastes', label: 'Yeni lezzetler' },
  { value: 'street_food', label: 'Sokak lezzetleri' },
  { value: 'fine_dining', label: 'Fine dining deneyimleri' },
  { value: 'world_cuisine', label: 'Dunya mutfaklari' },
  { value: 'dessert', label: 'Tatli duraklari' },
  { value: 'bakery_patisserie', label: 'Firindan yeni cikmislar' },
  { value: 'wine_bars', label: 'Wine bar ve sarap tadimi' },
  { value: 'vegan', label: 'Vegan ve saglikli yasam' },
  { value: 'nightlife', label: 'Gece hayati' },
  { value: 'cocktails', label: 'Kokteyl mekanlari' },
  { value: 'craft_beer', label: 'Craft bira' },
  { value: 'rooftop_evenings', label: 'Rooftop aksamlar' },
  { value: 'live_music', label: 'Canli muzik' },
  { value: 'jazz_blues', label: 'Jazz ve blues geceleri' },
  { value: 'dj_sets', label: 'DJ setleri ve kulup geceleri' },
  { value: 'festivals', label: 'Festival ve etkinlikler' },
  { value: 'art_design', label: 'Sanat ve tasarim' },
  { value: 'museums', label: 'Muze ve sergiler' },
  { value: 'contemporary_art', label: 'Cagdas sanat' },
  { value: 'history', label: 'Tarih ve mimari' },
  { value: 'architecture_walks', label: 'Mimari yuruyusler' },
  { value: 'photography', label: 'Fotografcilik' },
  { value: 'sunset_spots', label: 'Gun batimi noktalari' },
  { value: 'content_creator', label: 'Icerik uretimi' },
  { value: 'travel', label: 'Seyahat planlari' },
  { value: 'road_trips', label: 'Road trip rotalari' },
  { value: 'boutique_stays', label: 'Butik oteller ve staycation' },
  { value: 'nature', label: 'Doga kacamaklari' },
  { value: 'hiking', label: 'Trekking ve yuruyus' },
  { value: 'camping', label: 'Kamp hafta sonlari' },
  { value: 'beach', label: 'Deniz ve plaj' },
  { value: 'surf_swim', label: 'Yuzme ve su sporlari' },
  { value: 'wellness', label: 'Wellness ve spa' },
  { value: 'mindfulness', label: 'Yoga ve mindfulness' },
  { value: 'pilates_reformer', label: 'Pilates ve reformer' },
  { value: 'fitness', label: 'Kosu ve fitness' },
  { value: 'cycling', label: 'Bisiklet rotalari' },
  { value: 'remote_work', label: 'Uzaktan calisma' },
  { value: 'study_dates', label: 'Study date ve sakin mekanlar' },
  { value: 'startup_networking', label: 'Startup ve networking bulusmalari' },
  { value: 'books', label: 'Kitaplar ve okumak' },
  { value: 'vinyl_collecting', label: 'Plak ve muzik koleksiyonu' },
  { value: 'board_games', label: 'Board game aksamlari' },
  { value: 'cinema_series', label: 'Film ve dizi' },
  { value: 'indie_cinema', label: 'Bagimsiz sinema' },
  { value: 'fashion', label: 'Moda ve stil' },
  { value: 'shopping', label: 'Alisveris ve vintage' },
  { value: 'thrift_vintage', label: 'Thrift ve vintage avciligi' },
  { value: 'design_stores', label: 'Konsept store ve tasarim dukkanlari' },
  { value: 'technology', label: 'Teknoloji ve uretkenlik' },
  { value: 'gaming', label: 'Gaming ve e-spor' },
  { value: 'pet_friendly', label: 'Pet dostu yasam' },
  { value: 'family_time', label: 'Ailece planlar' },
  { value: 'romantic_dates', label: 'Romantik randevular' },
  { value: 'solo_time', label: 'Solo date planlari' },
  { value: 'hidden_gems', label: 'Gizli kesifler' },
  { value: 'local_markets', label: 'Lokal pazarlar ve semt hayatı' },
  { value: 'minimal_living', label: 'Minimal yasam ve sade mekanlar' },
  { value: 'sustainable_living', label: 'Surdurulebilir yasam' },
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

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

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
