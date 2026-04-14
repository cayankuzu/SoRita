import type { PlaceList, User } from '@/app/data/contracts/entities';
import { normalizeLocalizedData } from '@/app/data/repositories/normalizeLocalizedData';
import { getBrowserStorage } from '@/app/platform/storage/browserStorage';

const USERS_KEY = 'sorita_users';
const CURRENT_USER_KEY = 'sorita_current_user';
const LISTS_KEY = 'sorita_lists';
const SEEDED_KEY = 'sorita_seeded_v11';
const localStorage = getBrowserStorage();

export const DEMO_USER: User = {
  id: 'demo-user-001',
  email: 'emre.aksoy@email.com',
  name: 'Emre Aksoy',
  username: 'emreaksoy',
  profilePhoto: 'https://images.unsplash.com/photo-1764084051438-369ad6a09334?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBwb3J0cmFpdCUyMGhlYWRzaG90JTIwY2FzdWFsJTIwc21pbGluZ3xlbnwxfHx8fDE3NzQyMDc0NDd8MA&ixlib=rb-4.1.0&q=80&w=400',
  coverPhoto: 'https://images.unsplash.com/photo-1734771790664-2a39e8c12616?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpc3RhbmJ1bCUyMGJvc3Bob3J1cyUyMHNreWxpbmUlMjBwYW5vcmFtYXxlbnwxfHx8fDE3NzQyMDc0NDB8MA&ixlib=rb-4.1.0&q=80&w=600',
  bio: 'Yazilimci & kafe avcisi. Istanbul\'un her kosesini kesfediyorum ☕🗺️',
  following: ['user-002', 'user-003', 'user-004', 'user-005'],
  followers: ['user-002', 'user-003', 'user-005'],
};

const MOCK_USERS: User[] = [
  DEMO_USER,
  {
    id: 'user-002',
    email: 'selin.yildiz@email.com',
    name: 'Selin Yıldız',
    username: 'selinyildiz',
    profilePhoto: 'https://images.unsplash.com/photo-1759873821395-c29de82a5b99?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHdvbWFuJTIwc21pbGluZyUyMHBvcnRyYWl0JTIwbmF0dXJhbCUyMGxpZ2h0fGVufDF8fHx8MTc3NDIwNzQ0MXww&ixlib=rb-4.1.0&q=80&w=400',
    coverPhoto: 'https://images.unsplash.com/photo-1762342895328-ef64b725584e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xvcmZ1bCUyMGlzdGFuYnVsJTIwc3RyZWV0cyUyMGdhbGF0YXxlbnwxfHx8fDE3NzQyMDc0NDJ8MA&ixlib=rb-4.1.0&q=80&w=600',
    bio: 'UX Tasarimci 🎨 3. dalga kahve bagimlisi ☕ Istanbul sokak sanati meraklisi',
    following: ['user-003', 'demo-user-001', 'user-005'],
    followers: ['user-003', 'demo-user-001', 'user-004'],
  },
  {
    id: 'user-003',
    email: 'can.ozturk@email.com',
    name: 'Can Öztürk',
    username: 'canozturk',
    profilePhoto: 'https://images.unsplash.com/photo-1770024482715-1cb6065a17c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHlsaXNoJTIwbWFuJTIwcG9ydHJhaXQlMjB1cmJhbiUyMGNpdHl8ZW58MXx8fHwxNzc0MjA3NDQyfDA&ixlib=rb-4.1.0&q=80&w=400',
    coverPhoto: 'https://images.unsplash.com/photo-1677741447965-6066cdf3bd1b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXBwYWRvY2lhJTIwaG90JTIwYWlyJTIwYmFsbG9vbnMlMjBzdW5yaXNlfGVufDF8fHx8MTc3NDIwNzQ0NXww&ixlib=rb-4.1.0&q=80&w=600',
    bio: 'Fotograf & seyahat 📸 Turkiye\'nin her kosesini belgeliyorum 🌍',
    following: ['user-002', 'demo-user-001', 'user-004'],
    followers: ['user-002', 'demo-user-001', 'user-004', 'user-005'],
  },
  {
    id: 'user-004',
    email: 'elif.sahin@email.com',
    name: 'Elif Şahin',
    username: 'elifsahin',
    profilePhoto: 'https://images.unsplash.com/photo-1662892894338-a65a189ac1c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHdvbWFuJTIwc3VuZ2xhc3NlcyUyMHN1bW1lciUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NDIwNzQ0Mnww&ixlib=rb-4.1.0&q=80&w=400',
    coverPhoto: 'https://images.unsplash.com/photo-1770500484013-8a03e9aa2bd8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZWdlYW4lMjBzZWElMjBjb2FzdCUyMHR1cmtleSUyMGxhbmRzY2FwZXxlbnwxfHx8fDE3NzQyMDc0NDV8MA&ixlib=rb-4.1.0&q=80&w=600',
    bio: 'Akdenizli foodie 🍕 Tatil & lezzet rotalari 🏖️ Antalya-Istanbul arasi',
    following: ['demo-user-001', 'user-002', 'user-003'],
    followers: ['user-003'],
  },
  {
    id: 'user-005',
    email: 'deniz.korkmaz@email.com',
    name: 'Deniz Korkmaz',
    username: 'denizkorkmaz',
    profilePhoto: 'https://images.unsplash.com/photo-1747710016904-2b93d97ffb72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHBvcnRyYWl0JTIwd2FybSUyMHNtaWxlJTIwaGVhZHNob3R8ZW58MXx8fHwxNzc0MjA3NzUwfDA&ixlib=rb-4.1.0&q=80&w=400',
    coverPhoto: 'https://images.unsplash.com/photo-1591078314943-85c674b3789b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib2RydW0lMjB0dXJrZXklMjBzZWFzaWRlJTIwbWFyaW5hfGVufDF8fHx8MTc3NDIwNzc1N3ww&ixlib=rb-4.1.0&q=80&w=600',
    bio: 'Yoga ogretmeni 🧘 Doga yuruyusleri & saglikli yasam 🌿 Bodrum asigi',
    following: ['user-002', 'user-003', 'demo-user-001'],
    followers: ['demo-user-001', 'user-006'],
  },
  {
    id: 'user-006',
    email: 'burak.celik@email.com',
    name: 'Burak Çelik',
    username: 'burakcelik',
    profilePhoto: 'https://images.unsplash.com/photo-1769072058450-ac7cc0d0a541?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBiZWFyZCUyMHBvcnRyYWl0JTIwY2FzdWFsJTIwb3V0ZG9vcnxlbnwxfHx8fDE3NzQyMDc3NTB8MA&ixlib=rb-4.1.0&q=80&w=400',
    coverPhoto: 'https://images.unsplash.com/photo-1695109237033-7bb924cefde6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpc3RhbmJ1bCUyMGdhbGF0YSUyMHRvd2VyJTIwc3RyZWV0fGVufDF8fHx8MTc3NDIwNzc1Mnww&ixlib=rb-4.1.0&q=80&w=600',
    bio: 'Gurmand & gece hayati 🌙 Craft bira kolleksiyoncusu 🍺 Besiktas JK 🦅',
    following: ['user-005', 'user-003'],
    followers: [],
  },
];

const MOCK_LISTS: PlaceList[] = [
  // ══════════════════════════════════════════════════════════
  // LIST 1 - Selin's Istanbul Cafes
  // ══════════════════════════════════════════════════════════
  {
    id: 'list-001',
    userId: 'user-002',
    name: 'Istanbul Favori Kafeler',
    description: 'Laptop dostu, WiFi\'li, kahvesi guzel Istanbul kafeleri. Hepsini tek tek denedim!',
    emoji: '☕',
    coverImage: 'https://images.unsplash.com/photo-1769142454924-e57664296b7f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpc3RhbmJ1bCUyMGNhZmUlMjBpbnRlcmlvciUyMGNvenl8ZW58MXx8fHwxNzczODI4MjcyfDA&ixlib=rb-4.1.0&q=80&w=600',
    isPublic: true,
    likes: 24,
    likedBy: ['demo-user-001', 'user-003', 'user-004'],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-03-16T14:00:00Z',
    places: [
      {
        id: 'p1',
        name: 'Petra Roasting Co.',
        title: 'Cihangir\'in en iyi filtre kahvesi',
        lat: 41.0352,
        lng: 28.9856,
        address: 'Cihangir Mah., Akarsu Cd. No:1, Beyoglu',
        notes: '3. dalga kahvecilik anlayisi. Filtre kahve ve V60 secenekleri mukemmel. Kucuk ama samimi mekan. Sourdough tost da denenmeli!',
        category: 'cafe',
        categories: ['cafe', 'bakery'],
        rating: 4.5,
        priceRange: 2,
        priceMin: 40,
        priceMax: 120,
        bestTime: 'Sabah 09:00-11:00',
        bestTimes: ['Sabah', 'Hafta ici'],
        atmosphere: ['Sakin', 'Vintage', 'Calismaya uygun', 'Cozy'],
        specialFeatures: ['WiFi', 'Filtre kahve', 'Sourdough tost', 'Priz', 'Kitap kosesi'],
        studentDiscount: true,
        photos: [
          'https://images.unsplash.com/photo-1769142454924-e57664296b7f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpc3RhbmJ1bCUyMGNhZmUlMjBpbnRlcmlvciUyMGNvenl8ZW58MXx8fHwxNzczODI4MjcyfDA&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1694679861722-1446bab924d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpc3RhbmJ1bCUyMGNhZmUlMjBsYXR0ZSUyMGFydHxlbnwxfHx8fDE3NzQyMDcyMTJ8MA&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1708461646032-5743c250ac77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3p5JTIwY2FmZSUyMGludGVyaW9yJTIwd2FybXxlbnwxfHx8fDE3NzQxMjY0MDN8MA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-01-15T10:30:00Z',
        addedBy: { userId: 'user-002', userName: 'Selin Yildiz' },
      },
      {
        id: 'p2',
        name: 'MOC Karakoy',
        title: 'Dijital gocebelerin Karakoy ussu',
        lat: 41.0219,
        lng: 28.9742,
        address: 'Kemankes Mah., Kemankes Cd. No:45, Karakoy',
        notes: 'Hizli WiFi, bolca priz. Cold brew ve matcha latte cok iyi. Uzun sure oturmak icin ideal.',
        category: 'cafe',
        categories: ['cafe', 'coworking'],
        rating: 4,
        priceRange: 2,
        priceMin: 50,
        priceMax: 150,
        bestTime: 'Ogleden sonra 14:00-17:00',
        bestTimes: ['Ogleden sonra', 'Hafta ici'],
        atmosphere: ['Modern', 'Minimalist', 'Calismaya uygun', 'Ferah'],
        specialFeatures: ['WiFi', 'Priz', 'Cold brew', 'Calisma masasi', 'Sessiz alan'],
        photos: [
          'https://images.unsplash.com/photo-1680381724318-c8ac9fe3a484?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGVjaWFsdHklMjBjb2ZmZWUlMjBsYXR0ZSUyMGFydCUyMGJhcmlzdGF8ZW58MXx8fHwxNzczODI4Mjc5fDA&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1770048532712-4fde5ef7eb90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3dvcmtpbmclMjBzcGFjZSUyMG1vZGVybiUyMGxhcHRvcHxlbnwxfHx8fDE3NzQyMDc3NTN8MA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-02-01T14:00:00Z',
        addedBy: { userId: 'user-002', userName: 'Selin Yildiz' },
      },
      {
        id: 'p3',
        name: 'Kronotrop Caddebostan',
        title: 'Kadikoy\'de brunch ve kahve duragi',
        lat: 41.0433,
        lng: 29.0087,
        address: 'Bagdat Cd. No:302, Caddebostan, Kadikoy',
        notes: 'Denize yakin konum. V60, Chemex ve espresso bazli icecekler. Brunch menusu hafta sonu muhtesem.',
        category: 'cafe',
        categories: ['cafe'],
        rating: 4.5,
        priceRange: 3,
        priceMin: 60,
        priceMax: 180,
        bestTime: 'Hafta sonu sabah',
        bestTimes: ['Hafta sonu', 'Sabah'],
        atmosphere: ['Ferah', 'Modern', 'Sik'],
        specialFeatures: ['V60', 'Chemex', 'Brunch', 'Acik alan', 'Pet dostu'],
        photos: [
          'https://images.unsplash.com/photo-1579481802836-4c56a02b36d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0dXJraXNoJTIwY29mZmVlJTIwdHJhZGl0aW9uYWwlMjBjdXAlMjBjb3BwZXJ8ZW58MXx8fHwxNzc0MjA3NDQ4fDA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-02-20T09:00:00Z',
        addedBy: { userId: 'user-002', userName: 'Selin Yildiz' },
      },
      {
        id: 'p3b',
        name: 'Cuma Kitap Kafe',
        title: 'Kitaplar arasinda kahve keyfi',
        lat: 41.0285,
        lng: 28.9735,
        address: 'Serdariekrem Cd. No:18, Galata, Beyoglu',
        notes: 'Kitapcisi olan bir kafe. Independant yayin evlerinin kitaplari var. Sessiz ve huzurlu.',
        category: 'bookstore',
        categories: ['bookstore', 'cafe'],
        rating: 4.5,
        priceRange: 2,
        priceMin: 35,
        priceMax: 90,
        bestTime: 'Ogleden sonra 14:00-17:00',
        bestTimes: ['Ogleden sonra', 'Yagmurlu hava'],
        atmosphere: ['Sakin', 'Entelektuel', 'Cozy', 'Vintage'],
        specialFeatures: ['Kitaplik', 'WiFi', 'Filtre kahve', 'Sessiz alan', 'Priz'],
        studentDiscount: true,
        photos: [
          'https://images.unsplash.com/photo-1676837567059-3aa25ad73210?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rc3RvcmUlMjBjYWZlJTIwaW50ZXJpb3IlMjBzaGVsdmVzfGVufDF8fHx8MTc3NDIwNzc1M3ww&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-05T11:00:00Z',
        addedBy: { userId: 'user-002', userName: 'Selin Yildiz' },
      },
    ],
  },
  // ══════════════════════════════════════════════════════════
  // LIST 2 - Can's Cappadocia Guide
  // ══════════════════════════════════════════════════════════
  {
    id: 'list-002',
    userId: 'user-003',
    name: 'Kapadokya Rehberi',
    description: 'Kapadokya\'da mutlaka gorulmesi gereken yerler. Balon turu, peri bacalari, yer alti sehirleri.',
    emoji: '🎈',
    coverImage: 'https://images.unsplash.com/photo-1677741447965-6066cdf3bd1b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXBwYWRvY2lhJTIwaG90JTIwYWlyJTIwYmFsbG9vbnMlMjBzdW5yaXNlfGVufDF8fHx8MTc3MzgyODI5Mnww&ixlib=rb-4.1.0&q=80&w=600',
    isPublic: true,
    likes: 41,
    likedBy: ['demo-user-001', 'user-002', 'user-004'],
    createdAt: '2026-02-01T07:00:00Z',
    updatedAt: '2026-03-15T20:00:00Z',
    places: [
      {
        id: 'p13',
        name: 'Goreme Acik Hava Muzesi',
        title: 'UNESCO mirasi peri bacalarinin kalbi',
        lat: 38.6431,
        lng: 34.8312,
        address: 'Muze Cd., Goreme, Nevsehir',
        notes: 'UNESCO Dunya Mirasi. Freskler inanilmaz iyi korunmus. Karanlik Kilise ayri bilet. En az 2 saat ayirin.',
        category: 'museum',
        categories: ['museum', 'historicsite'],
        rating: 5,
        priceRange: 3,
        priceMin: 200,
        priceMax: 200,
        bestTime: 'Sabah 08:30 (kalabalik olmadan)',
        bestTimes: ['Sabah', 'Ilkbahar', 'Sonbahar'],
        atmosphere: ['Tarihi', 'Mistik', 'Dogal'],
        specialFeatures: ['UNESCO', 'Freskler', 'Kaya kiliseler', 'Rehberli tur'],
        studentDiscount: true,
        photos: [
          'https://images.unsplash.com/photo-1743610442996-834d4eb165c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYWlyeSUyMGNoaW1uZXlzJTIwZ29yZW1lJTIwY2FwcGFkb2NpYSUyMGxhbmRzY2FwZXxlbnwxfHx8fDE3NzM4MjgzMDh8MA&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1700405486412-8678e07173ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXBwYWRvY2lhJTIwbGFuZHNjYXBlJTIwZmFpcnklMjBjaGltbmV5c3xlbnwxfHx8fDE3NzQyMDcyMTN8MA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-02-01T08:00:00Z',
        addedBy: { userId: 'user-003', userName: 'Can Ozturk' },
      },
      {
        id: 'p14',
        name: 'Uchisar Kalesi',
        title: '360 derece Kapadokya manzarasi',
        lat: 38.6312,
        lng: 34.8042,
        address: 'Uchisar Mah., Uchisar, Nevsehir',
        notes: 'Kapadokya\'nin en yuksek noktasi. 360 panoramik manzara. Gun batiminda muhtesem. Basamaklar dik, rahat ayakkabi sart.',
        category: 'viewpoint',
        categories: ['viewpoint', 'historicsite'],
        rating: 4.5,
        priceRange: 2,
        priceMin: 60,
        priceMax: 60,
        bestTime: 'Gun batimi 17:00-19:00',
        bestTimes: ['Gun batimi', 'Ilkbahar'],
        atmosphere: ['Dogal', 'Panoramik', 'Huzurlu'],
        specialFeatures: ['Panorama', 'Fotograf noktasi', 'Trekking', 'Instagram-worthy'],
        addedAt: '2026-02-05T11:00:00Z',
        addedBy: { userId: 'user-003', userName: 'Can Ozturk' },
      },
      {
        id: 'p14b',
        name: 'Derinkuyu Yeralti Sehri',
        title: 'Antik dunyayi yeraltinda kesfet',
        lat: 38.3736,
        lng: 34.7344,
        address: 'Derinkuyu Mah., Derinkuyu, Nevsehir',
        notes: '8 kat derinliginde antik yeralti sehri. 20.000 kisi yasayabiliyormus! Klostrofobikler dikkat.',
        category: 'museum',
        categories: ['museum', 'historicsite'],
        rating: 4.5,
        priceRange: 2,
        priceMin: 150,
        priceMax: 150,
        bestTime: 'Ogleden sonra 13:00-15:00',
        bestTimes: ['Ogleden sonra', 'Hafta ici'],
        atmosphere: ['Gizemli', 'Tarihi', 'Macera'],
        specialFeatures: ['Yeralti sehri', 'Rehberli tur', 'Fotograf', 'Tarihi bina'],
        studentDiscount: true,
        photos: [
          'https://images.unsplash.com/photo-1769425824374-09ee6d59237e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bmRlcmdyb3VuZCUyMGNhdmUlMjB0dW5uZWwlMjBhbmNpZW50JTIwY2FydmVkJTIwc3RvbmV8ZW58MXx8fHwxNzc0MjA3NDQ4fDA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-02-10T14:00:00Z',
        addedBy: { userId: 'user-003', userName: 'Can Ozturk' },
      },
    ],
  },
  // ══════════════════════════════════════════════════════════
  // LIST 3 - Emre's Secret Eats (Private)
  // ══════════════════════════════════════════════════════════
  {
    id: 'list-003',
    userId: 'demo-user-001',
    name: 'Gizli Lezzetler',
    description: 'Sadece benim bildigim sokak lezzetleri. Turistik olmayan, gercek Istanbul tadi.',
    emoji: '🤫',
    isPublic: false,
    likes: 0,
    likedBy: [],
    createdAt: '2026-02-15T12:00:00Z',
    updatedAt: '2026-03-12T18:00:00Z',
    places: [
      {
        id: 'p8',
        name: 'Tarihi Cinaralti Koftecisi',
        title: '50 yillik kofte efsanesi',
        lat: 41.0114,
        lng: 28.9553,
        address: 'Hocapasa Mah., Ankara Cd. No:12, Fatih',
        notes: '50 yillik kofteci. Piyaz ve kofte ikilisi efsane. Siraya girmek gerekebilir. Ogle saatlerinde gel.',
        category: 'restaurant',
        categories: ['restaurant', 'kebab'],
        rating: 5,
        priceRange: 1,
        priceMin: 80,
        priceMax: 150,
        bestTime: 'Ogle 12:00-14:00',
        bestTimes: ['Oglen', 'Hafta ici'],
        atmosphere: ['Otantik', 'Nostaljik', 'Samimi'],
        specialFeatures: ['Kofte', 'Piyaz', 'Hizli servis', 'Sokak yemegi', 'Yerel lezzetler'],
        photos: [
          'https://images.unsplash.com/photo-1756362847925-71c792d6729c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0dXJraXNoJTIwa2ViYWIlMjByZXN0YXVyYW50JTIwdHJhZGl0aW9uYWx8ZW58MXx8fHwxNzczODI4MzQxfDA&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1773958731605-076e3721f16f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0dXJraXNoJTIwZm9vZCUyMG1lYXRiYWxscyUyMGtvZnRlfGVufDF8fHx8MTc3NDIwNzIxNHww&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-02-15T13:00:00Z',
        addedBy: { userId: 'demo-user-001', userName: 'Emre Aksoy' },
      },
      {
        id: 'p8b',
        name: 'Karadeniz Pidecisi',
        title: 'Gercek Karadeniz usulu pide',
        lat: 41.0050,
        lng: 28.9780,
        address: 'Divanyolu Cd. No:78, Sultanahmet, Fatih',
        notes: 'Karadeniz usulu pide. Kusbasili ve kasarli pide favorim. Firin taze ekmek de alin.',
        category: 'restaurant',
        categories: ['restaurant'],
        rating: 4.5,
        priceRange: 1,
        priceMin: 60,
        priceMax: 130,
        bestTime: 'Aksam yemegi',
        bestTimes: ['Aksam', 'Her zaman'],
        atmosphere: ['Samimi', 'Geleneksel', 'Aile dostu'],
        specialFeatures: ['Pide', 'Lahmacun', 'Ayran', 'Sokak yemegi', 'Hizli servis'],
        photos: [
          'https://images.unsplash.com/photo-1760537491162-ecf5600d543a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJlZXQlMjBmb29kJTIwdmVuZG9yJTIwa2ViYWIlMjBncmlsbHxlbnwxfHx8fDE3NzQyMDc3NTh8MA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-01T19:00:00Z',
        addedBy: { userId: 'demo-user-001', userName: 'Emre Aksoy' },
      },
      {
        id: 'p8c',
        name: 'Hafiz Mustafa 1864',
        title: 'Osmanlidan miras tatli sanati',
        lat: 41.0105,
        lng: 28.9717,
        address: 'Hobyar Mah., Hamidiye Cd. No:84, Fatih',
        notes: 'Baklava ve Turk lokumu icin Istanbul\'un en iyisi. Dondurma da mutlaka deneyin. Tarihi mekan.',
        category: 'dessert',
        categories: ['dessert', 'cafe'],
        rating: 4.5,
        priceRange: 3,
        priceMin: 100,
        priceMax: 350,
        bestTime: 'Ogleden sonra',
        bestTimes: ['Ogleden sonra', 'Aksam'],
        atmosphere: ['Otantik', 'Lüks', 'Tarihi'],
        specialFeatures: ['Baklava', 'Turk lokumu', 'Dondurma', 'Tarihi bina', 'Fine dining'],
        photos: [
          'https://images.unsplash.com/photo-1767796777227-32ef3200fab8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0dXJraXNoJTIwYmFrbGF2YSUyMGRlc3NlcnQlMjB0cmFkaXRpb25hbHxlbnwxfHx8fDE3NzQyMDc3NTJ8MA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-08T15:00:00Z',
        addedBy: { userId: 'demo-user-001', userName: 'Emre Aksoy' },
      },
    ],
  },
  // ══════════════════════════════════════════════════════════
  // LIST 4 - Selin's Izmir Route
  // ══════════════════════════════════════════════════════════
  {
    id: 'list-004',
    userId: 'user-002',
    name: 'Izmir Sahil Rotasi',
    description: 'Kordon\'dan Alacati\'ya uzanan sahil rotasi. Deniz, gunes ve lezzet bir arada.',
    emoji: '🌊',
    coverImage: 'https://images.unsplash.com/photo-1686088842612-8a998a80263f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpem1pciUyMHNlYXNpZGUlMjBzdW5zZXQlMjBrb3Jkb24lMjBwcm9tZW5hZGV8ZW58MXx8fHwxNzczODI4MjgzfDA&ixlib=rb-4.1.0&q=80&w=600',
    isPublic: true,
    likes: 18,
    likedBy: ['demo-user-001', 'user-003'],
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-03-10T17:00:00Z',
    places: [
      {
        id: 'p10',
        name: 'Kordon Boyu Yuruyus',
        title: 'Gun batiminda bisiklet turu',
        lat: 38.4322,
        lng: 27.1384,
        address: '1. Kordon, Alsancak, Konak, Izmir',
        notes: 'Gun batimi muhtesem. Bisiklet kiralayip keyfini cikarin. Kosu ve yuruyus icin de ideal.',
        category: 'park',
        categories: ['park', 'sport'],
        rating: 5,
        priceRange: 0,
        priceMin: 0,
        priceMax: 0,
        bestTime: 'Gun batimi 17:00-19:00',
        bestTimes: ['Gun batimi', 'Sabah', 'Yaz'],
        atmosphere: ['Acik hava', 'Romantik', 'Enerjik', 'Dogal'],
        specialFeatures: ['Bisiklet yolu', 'Gun batimi', 'Deniz kenari', 'Ucretsiz park', 'Fotograf noktasi'],
        photos: [
          'https://images.unsplash.com/photo-1686088842612-8a998a80263f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpem1pciUyMHNlYXNpZGUlMjBzdW5zZXQlMjBrb3Jkb24lMjBwcm9tZW5hZGV8ZW58MXx8fHwxNzczODI4MjgzfDA&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1573589630826-d606c088d375?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpem1pciUyMGtvcmRvbiUyMHN1bnNldCUyMHByb21lbmFkZXxlbnwxfHx8fDE3NzQyMDcyMTR8MA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-01-20T10:00:00Z',
        addedBy: { userId: 'user-002', userName: 'Selin Yildiz' },
      },
      {
        id: 'p12',
        name: 'Alacati Carsi',
        title: 'Tas sokaklarda bohem gezinti',
        lat: 38.2816,
        lng: 26.3744,
        address: 'Alacati Mah., Cesme, Izmir',
        notes: 'Tas sokaklar, butik dukkanlar, otlar. Pazar gunleri cok kalabalik. Hafta ici gelin.',
        category: 'bazaar',
        categories: ['bazaar', 'boutique'],
        rating: 4.5,
        priceRange: 3,
        priceMin: 50,
        priceMax: 500,
        bestTime: 'Hafta ici sabah',
        bestTimes: ['Hafta ici', 'Sabah', 'Ilkbahar'],
        atmosphere: ['Bohem', 'Renkli', 'Artistik'],
        specialFeatures: ['Butik dukkanlar', 'Ot festivali', 'Yerel urunler', 'Fotograf noktasi', 'Instagram-worthy'],
        studentDiscount: true,
        photos: [
          'https://images.unsplash.com/photo-1718872867330-1884c5b6c78a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGFjYXRpJTIwc3RvbmUlMjBzdHJlZXRzJTIwYm91dGlxdWUlMjBzaG9wc3xlbnwxfHx8fDE3NzM4MjgzMzR8MA&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1687677929096-e55dd0bb17f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGFjYXRpJTIwc3RvbmUlMjBzdHJlZXRzJTIwY29sb3JmdWwlMjBkb29yc3xlbnwxfHx8fDE3NzQyMDc0NTN8MA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-02-14T12:00:00Z',
        addedBy: { userId: 'user-002', userName: 'Selin Yildiz' },
      },
    ],
  },
  // ══════════════════════════════════════════════════════════
  // LIST 5 - Emre's Ankara Culture Tour (Public)
  // ══════════════════════════════════════════════════════════
  {
    id: 'list-005',
    userId: 'demo-user-001',
    name: 'Ankara Kultur Turu',
    description: 'Baskentin muzeleri, tarihi mekanlari ve parklari. Hafta sonu plani icin ideal.',
    emoji: '🏛️',
    isPublic: true,
    likes: 7,
    likedBy: ['user-002'],
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-03-14T11:00:00Z',
    places: [
      {
        id: 'p5',
        name: 'Anitkabir',
        title: 'Turk tarihinin kalbi',
        lat: 39.9254,
        lng: 32.8369,
        address: 'Anittepe Mah., Cankaya, Ankara',
        notes: 'Muhtesem mimari. Muze kismi cok zengin. Saygıyla gezilmeli. Ucretsiz giris.',
        category: 'museum',
        categories: ['museum', 'historicsite'],
        rating: 5,
        priceRange: 0,
        priceMin: 0,
        priceMax: 0,
        bestTime: 'Sabah 09:00-11:00',
        bestTimes: ['Sabah', 'Hafta ici', 'Her zaman'],
        atmosphere: ['Tarihi', 'Gorkemli', 'Huzurlu'],
        specialFeatures: ['Ucretsiz giris', 'Muze', 'Rehber turlari', 'Fotograf noktasi'],
        addedAt: '2026-01-10T09:00:00Z',
        addedBy: { userId: 'demo-user-001', userName: 'Emre Aksoy' },
      },
      {
        id: 'p6',
        name: 'Ankara Kalesi',
        title: 'Panoramik sehir manzarasi',
        lat: 39.9408,
        lng: 32.8644,
        address: 'Kale Mah., Altindag, Ankara',
        notes: 'Panoramik sehir manzarasi. Gun batiminda fotograf cekmek icin ideal. Eski evleri de gezin.',
        category: 'historicsite',
        categories: ['historicsite', 'viewpoint'],
        rating: 4,
        priceRange: 0,
        priceMin: 0,
        priceMax: 0,
        bestTime: 'Gun batimi 17:00-19:00',
        bestTimes: ['Gun batimi', 'Ilkbahar'],
        atmosphere: ['Tarihi', 'Panoramik', 'Romantik'],
        specialFeatures: ['Manzara', 'Fotograf noktasi', 'Eski evler', 'Instagram-worthy'],
        photos: [
          'https://images.unsplash.com/photo-1728113278031-30d24597673d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmthcmElMjBjYXN0bGUlMjBwYW5vcmFtaWMlMjBjaXR5JTIwdmlld3xlbnwxfHx8fDE3NzM4MjgzMzd8MA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-01-12T15:00:00Z',
        addedBy: { userId: 'demo-user-001', userName: 'Emre Aksoy' },
      },
    ],
  },
  // ══════════════════════════════════════════════════════════
  // LIST 6 - Elif's Antalya Guide
  // ══════════════════════════════════════════════════════════
  {
    id: 'list-006',
    userId: 'user-004',
    name: 'Antalya Tatil Rehberi',
    description: 'Antalya\'nin en guzel plajlari, restoranlari ve kafeleri. Akdeniz cennetinde tatil plani.',
    emoji: '🏖️',
    coverImage: 'https://images.unsplash.com/photo-1683743536851-233ceb8cc636?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbnRhbHlhJTIwb2xkJTIwdG93biUyMGthbGVpY2klMjBjb2xvcmZ1bHxlbnwxfHx8fDE3NzM4MjgyOTZ8MA&ixlib=rb-4.1.0&q=80&w=600',
    isPublic: true,
    likes: 12,
    likedBy: ['user-002'],
    createdAt: '2026-02-10T08:00:00Z',
    updatedAt: '2026-03-13T15:00:00Z',
    places: [
      {
        id: 'p16',
        name: 'Kaleici Lokantasi',
        title: 'Tarihi avluda Turk mutfagi',
        lat: 36.8841,
        lng: 30.7056,
        address: 'Kaleici Mah., Pasa Camii Sk. No:5, Muratpasa',
        notes: 'Otantik avlu ortami. Manti ve kabak cicegi dolmasi harika. Canli muzik cumartesileri.',
        category: 'restaurant',
        categories: ['restaurant'],
        rating: 4.5,
        priceRange: 3,
        priceMin: 120,
        priceMax: 300,
        bestTime: 'Aksam yemegi 19:00-21:00',
        bestTimes: ['Aksam', 'Hafta sonu'],
        atmosphere: ['Otantik', 'Samimi', 'Romantik'],
        specialFeatures: ['Turk mutfagi', 'Avlu', 'Canli muzik', 'Masa servisi', 'Rezervasyon'],
        studentDiscount: true,
        photos: [
          'https://images.unsplash.com/photo-1683743536851-233ceb8cc636?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbnRhbHlhJTIwb2xkJTIwdG93biUyMGthbGVpY2klMjBjb2xvcmZ1bHxlbnwxfHx8fDE3NzM4MjgyOTZ8MA&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1677532469841-dd194d71ac6a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbnRhbHlhJTIwa2FsZWklQzMlQTdpJTIwb2xkJTIwdG93biUyMGNvbG9yZnVsfGVufDF8fHx8MTc3NDIwNzQ1NHww&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-02-10T09:00:00Z',
        addedBy: { userId: 'user-004', userName: 'Elif Sahin' },
      },
      {
        id: 'p17',
        name: 'Konyaalti Plaji',
        title: 'Kristal berrak Akdeniz',
        lat: 36.869,
        lng: 30.651,
        address: 'Konyaalti Sahili, Konyaalti, Antalya',
        notes: 'Kristal berrak su. Sabah saatlerinde cok sakin ve temiz. Sezlong fiyatlari uygun.',
        category: 'beach',
        categories: ['beach'],
        rating: 4.5,
        priceRange: 1,
        priceMin: 0,
        priceMax: 50,
        bestTime: 'Sabah 08:00-11:00',
        bestTimes: ['Sabah', 'Yaz'],
        atmosphere: ['Sakin', 'Dogal', 'Ferah'],
        specialFeatures: ['Yuzme', 'Sezlong', 'Dus', 'Deniz kenari', 'Ucretsiz park'],
        photos: [
          'https://images.unsplash.com/photo-1666260007590-6c1a4de33a05?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpdGVycmFuZWFuJTIwYmVhY2glMjBjcnlzdGFsJTIwY2xlYXIlMjB3YXRlciUyMHR1cmtleXxlbnwxfHx8fDE3NzM4MjgzMjB8MA&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1751698108080-554550c2410b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbnRhbHlhJTIwYmVhY2glMjB0dXJxdW9pc2UlMjB3YXRlcnxlbnwxfHx8fDE3NzQyMDcyMTR8MA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-02-15T12:00:00Z',
        addedBy: { userId: 'user-004', userName: 'Elif Sahin' },
      },
      {
        id: 'p18',
        name: 'Sahil Kafe & Brunch',
        title: 'Deniz manzarali serpme kahvalti',
        lat: 36.852,
        lng: 30.785,
        address: 'Lara Cd. No:45, Muratpasa, Antalya',
        notes: 'Deniz manzarasi esliginde serpme kahvalti. Hafta sonu cok kalabalik, rezervasyon yapın.',
        category: 'cafe',
        categories: ['cafe', 'restaurant'],
        rating: 4,
        priceRange: 3,
        priceMin: 100,
        priceMax: 250,
        bestTime: 'Hafta ici sabah',
        bestTimes: ['Sabah', 'Hafta ici'],
        atmosphere: ['Deniz esintili', 'Modern', 'Ferah'],
        specialFeatures: ['Kahvalti', 'Deniz manzarasi', 'WiFi', 'Teras', 'Brunch'],
        photos: [
          'https://images.unsplash.com/photo-1768236067899-51c60df7c963?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0dXJraXNoJTIwYnJlYWtmYXN0JTIwc3ByZWFkJTIwdHJhZGl0aW9uYWx8ZW58MXx8fHwxNzc0MjA3NzUxfDA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-01T16:00:00Z',
        addedBy: { userId: 'user-004', userName: 'Elif Sahin' },
      },
    ],
  },
  // ══════════════════════════════════════════════════════════
  // LIST 7 - Can's Istanbul Nightlife
  // ══════════════════════════════════════════════════════════
  {
    id: 'list-007',
    userId: 'user-003',
    name: 'Istanbul Gece Hayati',
    description: 'Beyoglu ve Kadikoy\'un en iyi barlari. Canli muzik, craft bira ve kokteyl mekanlari.',
    emoji: '🌙',
    coverImage: 'https://images.unsplash.com/photo-1603838607029-2130281cf1eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpc3RhbmJ1bCUyMG5pZ2h0bGlmZSUyMGJhciUyMGNvY2t0YWlsJTIwbmVvbnxlbnwxfHx8fDE3NzM4MjgzMDB8MA&ixlib=rb-4.1.0&q=80&w=600',
    isPublic: true,
    likes: 33,
    likedBy: ['demo-user-001', 'user-002', 'user-004', 'user-006'],
    createdAt: '2026-02-20T18:00:00Z',
    updatedAt: '2026-03-17T23:00:00Z',
    places: [
      {
        id: 'p19',
        name: 'Babylon Bomonti',
        title: 'Istanbul\'un efsanevi konser mekani',
        lat: 41.0582,
        lng: 28.978,
        address: 'Bomontiada, Birahane Sk. No:1, Sisli',
        notes: 'Istanbul\'un efsanevi muzik mekani. Yerli ve yabanci sanatcilar her hafta. Bilet onceden alin!',
        category: 'concerthall',
        categories: ['concerthall', 'nightlife'],
        rating: 5,
        priceRange: 4,
        priceMin: 150,
        priceMax: 500,
        bestTime: 'Cuma-Cumartesi 22:00+',
        bestTimes: ['Gece', 'Hafta sonu'],
        atmosphere: ['Enerjik', 'Cosmopolitan', 'Canli'],
        specialFeatures: ['Konser', 'Craft bira', 'Kokteyl bar', 'Canli muzik', 'DJ'],
        photos: [
          'https://images.unsplash.com/photo-1647168285321-7509a33bf1d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaXZlJTIwbXVzaWMlMjBjb25jZXJ0JTIwdmVudUUlMjBzdGFnZSUyMGNyb3dkfGVufDF8fHx8MTc3MzgyODMyNXww&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1765130803583-a5de64bbcc70?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyb29mdG9wJTIwYmFyJTIwY29ja3RhaWwlMjBuaWdodCUyMGNpdHklMjBsaWdodHN8ZW58MXx8fHwxNzc0MjA3NDQ5fDA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-02-20T19:00:00Z',
        addedBy: { userId: 'user-003', userName: 'Can Ozturk' },
      },
      {
        id: 'p20',
        name: 'Arkaoda',
        title: 'Kadikoy\'un underground efsanesi',
        lat: 41.0012,
        lng: 29.0287,
        address: 'Kadife Sk. No:18/A, Kadikoy',
        notes: 'Kadikoy\'un efsane mekani. DJ setler, vinyl koleksiyonu, sanat sergileri. Alternatif muzik sevenler icin.',
        category: 'nightlife',
        categories: ['nightlife', 'bar'],
        rating: 4.5,
        priceRange: 2,
        priceMin: 80,
        priceMax: 200,
        bestTime: 'Persembe-Cumartesi aksam',
        bestTimes: ['Gece', 'Hafta sonu'],
        atmosphere: ['Alternatif', 'Sanatsal', 'Underground', 'Hipster'],
        specialFeatures: ['DJ set', 'Vinyl', 'Sanat sergisi', 'Board game', 'Nargile'],
        studentDiscount: true,
        photos: [
          'https://images.unsplash.com/photo-1603838607029-2130281cf1eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpc3RhbmJ1bCUyMG5pZ2h0bGlmZSUyMGJhciUyMGNvY2t0YWlsJTIwbmVvbnxlbnwxfHx8fDE3NzM4MjgzMDB8MA&ixlib=rb-4.1.0&q=80&w=600',
          'https://images.unsplash.com/photo-1766353862019-03216f50cd27?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aW55bCUyMHJlY29yZHMlMjBtdXNpYyUyMHN0b3JlJTIwREp8ZW58MXx8fHwxNzc0MjA3NDUwfDA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-05T22:00:00Z',
        addedBy: { userId: 'user-003', userName: 'Can Ozturk' },
      },
      {
        id: 'p21',
        name: 'Bosphorus Brewing Co.',
        title: 'Kendi uretimleri craft biralar',
        lat: 41.0343,
        lng: 28.9745,
        address: 'Asmalimescit Mah., Istiklal Cd. Sk. No:7, Beyoglu',
        notes: 'Kendi uretimi craft biralar. IPA ve stout cesitleri cok iyi. Bira tadimi da yapiliyor.',
        category: 'bar',
        categories: ['bar', 'pub'],
        rating: 4,
        priceRange: 3,
        priceMin: 100,
        priceMax: 250,
        bestTime: 'Aksam 20:00-00:00',
        bestTimes: ['Aksam', 'Gece'],
        atmosphere: ['Rahat', 'Sosyal', 'Hipster'],
        specialFeatures: ['Craft bira', 'Bira tadimi', 'Canli spor', 'Mac yayini', 'Teras'],
        photos: [
          'https://images.unsplash.com/photo-1695606453521-a160be0c7706?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmFmdCUyMGJlZXIlMjBicmV3ZXJ5JTIwdGFwcyUyMGdsYXNzZXN8ZW58MXx8fHwxNzc0MjA3NDQ5fDA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-10T21:00:00Z',
        addedBy: { userId: 'user-003', userName: 'Can Ozturk' },
      },
    ],
  },
  // ══════════════════════════════════════════════════════════
  // LIST 8 - Deniz's Wellness & Nature
  // ══════════════════════════════════════════════════════════
  {
    id: 'list-008',
    userId: 'user-005',
    name: 'Huzur & Dogal Yasam',
    description: 'Yoga, hamam, doga yuruyusleri ve saglikli yasam mekanlari. Zihin ve beden icin.',
    emoji: '🧘',
    coverImage: 'https://images.unsplash.com/photo-1761971975724-31001b4de0bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b2dhJTIwc3R1ZGlvJTIwemVuJTIwaW50ZXJpb3J8ZW58MXx8fHwxNzc0MjA3NzUzfDA&ixlib=rb-4.1.0&q=80&w=600',
    isPublic: true,
    likes: 15,
    likedBy: ['demo-user-001', 'user-002'],
    createdAt: '2026-02-28T08:00:00Z',
    updatedAt: '2026-03-18T10:00:00Z',
    places: [
      {
        id: 'p30',
        name: 'Cemberlitas Hamami',
        title: '1584\'ten beri Osmanli hamam deneyimi',
        lat: 41.0085,
        lng: 28.9713,
        address: 'Vezirhan Cd. No:8, Cemberlitas, Fatih',
        notes: 'Mimar Sinan eseri tarihi hamam. Full paket alin: pestemal, kese, kopuk masaj. 1.5 saat ayin.',
        category: 'spa',
        categories: ['spa', 'historicsite'],
        rating: 5,
        priceRange: 4,
        priceMin: 400,
        priceMax: 1200,
        bestTime: 'Sabah 08:00 (sakin)',
        bestTimes: ['Sabah', 'Hafta ici', 'Kis'],
        atmosphere: ['Tarihi', 'Huzurlu', 'Lüks', 'Mistik'],
        specialFeatures: ['Turk hamami', 'Kese', 'Kopuk masaj', 'Tarihi bina', 'Sauna'],
        photos: [
          'https://images.unsplash.com/photo-1687241895282-cc38be3379e1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0dXJraXNoJTIwaGFtbWFtJTIwc3BhJTIwbWFyYmxlfGVufDF8fHx8MTc3NDIwNzc1OHww&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-02-28T09:00:00Z',
        addedBy: { userId: 'user-005', userName: 'Deniz Korkmaz' },
      },
      {
        id: 'p31',
        name: 'Zen Yoga Studio',
        title: 'Besiktas\'in huzur kosesi',
        lat: 41.0430,
        lng: 29.0017,
        address: 'Akatlar Mah., Nisbetiye Cd. No:22, Besiktas',
        notes: 'Sabah yogasi harika basliyor. Vinyasa ve Yin secenekleri var. Ilk ders ucretsiz deneme.',
        category: 'yoga',
        categories: ['yoga', 'gym'],
        rating: 4.5,
        priceRange: 3,
        priceMin: 200,
        priceMax: 500,
        bestTime: 'Sabah 07:00-09:00',
        bestTimes: ['Sabah', 'Her zaman'],
        atmosphere: ['Zen', 'Huzurlu', 'Minimalist', 'Sakin'],
        specialFeatures: ['Yoga', 'Pilates', 'Meditasyon', 'Sessiz alan'],
        photos: [
          'https://images.unsplash.com/photo-1761971975724-31001b4de0bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b2dhJTIwc3R1ZGlvJTIwemVuJTIwaW50ZXJpb3J8ZW58MXx8fHwxNzc0MjA3NzUzfDA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-02T07:30:00Z',
        addedBy: { userId: 'user-005', userName: 'Deniz Korkmaz' },
      },
      {
        id: 'p32',
        name: 'Belgrad Ormani Parkuru',
        title: 'Sehrin icinde orman yuruyusu',
        lat: 41.1656,
        lng: 28.9779,
        address: 'Belgrad Ormani, Bahcekoy, Sariyer',
        notes: 'Istanbul\'un cigerlerinde yuruyus. 6km ve 12km parkurlari var. Hafta sonu kalabalik.',
        category: 'park',
        categories: ['park', 'mountain'],
        rating: 4.5,
        priceRange: 0,
        priceMin: 0,
        priceMax: 20,
        bestTime: 'Sabah 07:00 (serin)',
        bestTimes: ['Sabah', 'Ilkbahar', 'Sonbahar'],
        atmosphere: ['Dogal', 'Huzurlu', 'Enerjik'],
        specialFeatures: ['Trekking', 'Bisiklet yolu', 'Piknik alani', 'Ucretsiz park'],
        photos: [
          'https://images.unsplash.com/photo-1631051202319-7710a8735775?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1waW5nJTIwdGVudCUyMGZvcmVzdCUyMG5hdHVyZXxlbnwxfHx8fDE3NzQxMDUwOTJ8MA&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-10T06:00:00Z',
        addedBy: { userId: 'user-005', userName: 'Deniz Korkmaz' },
      },
    ],
  },
  // ══════════════════════════════════════════════════════════
  // LIST 9 - Burak's Rooftop & Views
  // ══════════════════════════════════════════════════════════
  {
    id: 'list-009',
    userId: 'user-006',
    name: 'Rooftop & Manzara Mekanlari',
    description: 'Istanbul\'un en iyi cati kat ve manzarali mekanlari. Bogaz, sehir, gun batimi.',
    emoji: '🌇',
    coverImage: 'https://images.unsplash.com/photo-1762656668755-13c0c4be9957?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyb29mdG9wJTIwdGVycmFjZSUyMHJlc3RhdXJhbnQlMjB2aWV3fGVufDF8fHx8MTc3NDIwNzc1M3ww&ixlib=rb-4.1.0&q=80&w=600',
    isPublic: true,
    likes: 22,
    likedBy: ['user-003', 'user-005', 'demo-user-001'],
    createdAt: '2026-03-01T15:00:00Z',
    updatedAt: '2026-03-20T19:00:00Z',
    places: [
      {
        id: 'p40',
        name: 'Mikla Restaurant',
        title: 'Bogaz manzarali fine dining',
        lat: 41.0314,
        lng: 28.9762,
        address: 'The Marmara Pera, Mesrutiyet Cd. No:15, Beyoglu',
        notes: 'Michelin yildizli sef Mehmet Gurs\'un mekani. Anadolu lezzetleri modern yorumla. Rezervasyon sart!',
        category: 'restaurant',
        categories: ['restaurant'],
        rating: 5,
        priceRange: 5,
        priceMin: 800,
        priceMax: 3000,
        bestTime: 'Aksam yemegi 19:00',
        bestTimes: ['Aksam', 'Gun batimi'],
        atmosphere: ['Lüks', 'Sik', 'Panoramik', 'Romantik'],
        specialFeatures: ['Fine dining', 'Bogaz manzarasi', 'Rooftop', 'Rezervasyon', 'Sehir manzarasi'],
        photos: [
          'https://images.unsplash.com/photo-1762656668755-13c0c4be9957?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyb29mdG9wJTIwdGVycmFjZSUyMHJlc3RhdXJhbnQlMjB2aWV3fGVufDF8fHx8MTc3NDIwNzc1M3ww&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-01T16:00:00Z',
        addedBy: { userId: 'user-006', userName: 'Burak Celik' },
      },
      {
        id: 'p41',
        name: 'Galata Kulesi',
        title: '360 derece Istanbul panoramasi',
        lat: 41.0256,
        lng: 28.9741,
        address: 'Bereketzade Mah., Galata Kulesi Sk., Beyoglu',
        notes: 'Istanbul\'un sembollerinden. Terastan 360 derece manzara. Kuyruk uzun olabiliyor, online bilet alin.',
        category: 'viewpoint',
        categories: ['viewpoint', 'historicsite', 'museum'],
        rating: 4,
        priceRange: 3,
        priceMin: 200,
        priceMax: 200,
        bestTime: 'Gun batimi 17:00-18:30',
        bestTimes: ['Gun batimi', 'Hafta ici'],
        atmosphere: ['Tarihi', 'Panoramik', 'Romantik'],
        specialFeatures: ['Panorama', 'Fotograf noktasi', 'Instagram-worthy', 'Tarihi bina'],
        photos: [
          'https://images.unsplash.com/photo-1695109237033-7bb924cefde6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpc3RhbmJ1bCUyMGdhbGF0YSUyMHRvd2VyJTIwc3RyZWV0fGVufDF8fHx8MTc3NDIwNzc1Mnww&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-05T17:00:00Z',
        addedBy: { userId: 'user-006', userName: 'Burak Celik' },
      },
    ],
  },
  // ══════════════════════════════════════════════════════════
  // LIST 10 - Elif's Bodrum Favorites (via Deniz sharing)
  // ══════════════════════════════════════════════════════════
  {
    id: 'list-010',
    userId: 'user-005',
    name: 'Bodrum Rehberi',
    description: 'Bodrum\'un en iyi plajlari, koylar, restoranlar ve gece hayati. Yaz tatili icin her sey.',
    emoji: '⛵',
    coverImage: 'https://images.unsplash.com/photo-1591078314943-85c674b3789b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib2RydW0lMjB0dXJrZXklMjBzZWFzaWRlJTIwbWFyaW5hfGVufDF8fHx8MTc3NDIwNzc1N3ww&ixlib=rb-4.1.0&q=80&w=600',
    isPublic: true,
    likes: 29,
    likedBy: ['demo-user-001', 'user-004', 'user-006'],
    createdAt: '2026-03-05T10:00:00Z',
    updatedAt: '2026-03-19T16:00:00Z',
    places: [
      {
        id: 'p50',
        name: 'Bitez Plaji',
        title: 'Ruzgar sorfu ve huzur',
        lat: 37.0310,
        lng: 27.3906,
        address: 'Bitez Mah., Bodrum, Mugla',
        notes: 'Sig ve sakin deniz. Ruzgar sorfu icin mukemmel. Sezlonglar uygun fiyatli. Aileler icin ideal.',
        category: 'beach',
        categories: ['beach', 'sport'],
        rating: 4.5,
        priceRange: 1,
        priceMin: 0,
        priceMax: 100,
        bestTime: 'Sabah-ogle arasi',
        bestTimes: ['Sabah', 'Yaz'],
        atmosphere: ['Sakin', 'Dogal', 'Aile dostu', 'Tropik'],
        specialFeatures: ['Yuzme', 'Sezlong', 'Ruzgar sorfu', 'Deniz kenari', 'Cocuk oyun alani'],
        photos: [
          'https://images.unsplash.com/photo-1591078314943-85c674b3789b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib2RydW0lMjB0dXJrZXklMjBzZWFzaWRlJTIwbWFyaW5hfGVufDF8fHx8MTc3NDIwNzc1N3ww&ixlib=rb-4.1.0&q=80&w=600',
        ],
        addedAt: '2026-03-05T11:00:00Z',
        addedBy: { userId: 'user-005', userName: 'Deniz Korkmaz' },
      },
      {
        id: 'p51',
        name: 'Bodrum Kalesi',
        title: 'Sualti arkeoloji muzesi',
        lat: 37.0312,
        lng: 27.4316,
        address: 'Kale Cd., Bodrum, Mugla',
        notes: 'St. Peter Kalesi. Icimdeki sualti arkeoloji muzesi Turkiye\'nin tek ornegi. Gece isiklandirmasi muhtesem.',
        category: 'museum',
        categories: ['museum', 'historicsite'],
        rating: 4.5,
        priceRange: 2,
        priceMin: 120,
        priceMax: 120,
        bestTime: 'Sabah veya gun batimi',
        bestTimes: ['Sabah', 'Gun batimi'],
        atmosphere: ['Tarihi', 'Panoramik', 'Egitici'],
        specialFeatures: ['Muze', 'Tarihi bina', 'Panorama', 'Fotograf noktasi'],
        studentDiscount: true,
        addedAt: '2026-03-08T14:00:00Z',
        addedBy: { userId: 'user-005', userName: 'Deniz Korkmaz' },
      },
    ],
  },
];

function seedMockData() {
  if (localStorage.getItem(SEEDED_KEY)) return;

  // Clear old seed flags
  ['sorita_seeded', 'sorita_seeded_v2', 'sorita_seeded_v3', 'sorita_seeded_v4', 'sorita_seeded_v5', 'sorita_seeded_v6', 'sorita_seeded_v7', 'sorita_seeded_v8', 'sorita_seeded_v9', 'sorita_seeded_v10'].forEach(
    key => localStorage.removeItem(key)
  );
  localStorage.removeItem(USERS_KEY);
  localStorage.removeItem(LISTS_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.setItem(USERS_KEY, JSON.stringify(MOCK_USERS));
  localStorage.setItem(LISTS_KEY, JSON.stringify(MOCK_LISTS));
  localStorage.setItem(SEEDED_KEY, 'true');
}

// Auto-seed on import
seedMockData();

export const storage = {
  getUsers(): User[] {
    const data = localStorage.getItem(USERS_KEY);
    return data ? normalizeLocalizedData<User[]>(JSON.parse(data)) : [];
  },

  saveUser(user: User): void {
    const users = this.getUsers();
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  findUserByEmail(email: string): User | undefined {
    return this.getUsers().find(u => u.email === email);
  },

  getCurrentUser(): User | null {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? normalizeLocalizedData<User>(JSON.parse(data)) : null;
  },

  setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  },

  getLists(): PlaceList[] {
    const data = localStorage.getItem(LISTS_KEY);
    return data ? normalizeLocalizedData<PlaceList[]>(JSON.parse(data)) : [];
  },

  saveLists(lists: PlaceList[]): void {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  },

  getListsByUserId(userId: string): PlaceList[] {
    return this.getLists().filter(list => list.userId === userId);
  },

  getPublicLists(): PlaceList[] {
    return this.getLists().filter(list => list.isPublic);
  },

  getListById(listId: string): PlaceList | undefined {
    return this.getLists().find(list => list.id === listId);
  },

  createList(list: PlaceList): void {
    const lists = this.getLists();
    lists.push(list);
    this.saveLists(lists);
  },

  updateList(updatedList: PlaceList): void {
    const lists = this.getLists();
    const index = lists.findIndex(list => list.id === updatedList.id);
    if (index !== -1) {
      lists[index] = updatedList;
      this.saveLists(lists);
    }
  },

  deleteList(listId: string): void {
    const lists = this.getLists().filter(list => list.id !== listId);
    this.saveLists(lists);
  },

  findUserById(userId: string): User | undefined {
    return this.getUsers().find(u => u.id === userId);
  },

  updateUser(updatedUser: User): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  },

  followUser(currentUserId: string, targetUserId: string): void {
    const users = this.getUsers();
    const currentUser = users.find(u => u.id === currentUserId);
    const targetUser = users.find(u => u.id === targetUserId);
    if (!currentUser || !targetUser) return;

    const following = currentUser.following || [];
    const followers = targetUser.followers || [];

    if (following.includes(targetUserId)) {
      currentUser.following = following.filter(id => id !== targetUserId);
      targetUser.followers = followers.filter(id => id !== currentUserId);
    } else {
      currentUser.following = [...following, targetUserId];
      targetUser.followers = [...followers, currentUserId];
    }

    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    this.setCurrentUser(currentUser);
  },

  toggleLikeList(listId: string, userId: string): void {
    const lists = this.getLists();
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const likedBy = list.likedBy || [];
    if (likedBy.includes(userId)) {
      list.likedBy = likedBy.filter(id => id !== userId);
      list.likes = Math.max(0, (list.likes || 0) - 1);
    } else {
      list.likedBy = [...likedBy, userId];
      list.likes = (list.likes || 0) + 1;
    }

    this.saveLists(lists);
  },
};
