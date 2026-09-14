export const navigationTr = {
  explore: 'Keşfet',
  home: 'Ana Sayfa',
  map: 'Harita',
  profile: 'Profil',
} as const;

export const notificationsTr = {
  accept: 'Onayla',
  categories: {
    all: 'Tümü',
    comments: 'Yorumlar',
    follows: 'Takip',
    likes: 'Beğeniler',
    places: 'Mekânlar',
    quotes: 'Alıntılar',
  },
  emptyDescription: 'Bu kategoride şu an içerik bulunmuyor.',
  emptyTitle: 'Bildirim yok',
  errorTitle: 'Bildirimler açılamıyor',
  errorDescription: 'Bildirimler şu an yüklenemiyor. Lütfen tekrar dene.',
  newCount: (count: number) => `${count} yeni bildirim`,
  openHint: 'İlgili içeriği aç',
  processingRequest: 'Takip isteği işleniyor',
  read: 'Okundu',
  resultCount: (count: number) => `${count} bildirim`,
  targetUnavailable: 'Bu bildirimin bağlı olduğu içerik artık açılamıyor.',
  unread: 'Okunmadı',
  unreadHint: (count: number) => `${count} okunmamış bildirim`,
  partialDescription:
    'Kayıtlı bildirimler gösteriliyor. Bağlantı düzelince tekrar deneyebilirsin.',
  partialTitle: 'Bazı bildirimler güncellenemedi',
  relativeTime: {
    days: (count: number) => `${count} gün önce`,
    hours: (count: number) => `${count} saat önce`,
    minutes: (count: number) => `${count} dk önce`,
    weeks: (count: number) => `${count} hafta önce`,
  },
  reject: 'Reddet',
  toast: {
    allRead: 'Tüm bildirimler okundu olarak işaretlendi',
    followRequestAccepted: 'Takip isteği onaylandı',
    followRequestRejected: 'Takip isteği reddedildi',
    markAllFailed: 'Bildirimler güncellenemedi',
  },
  status: {
    accepted: 'Onaylandı',
    rejected: 'Reddedildi',
  },
  systemPushFallbackBody: 'Yeni sistem bildirimi',
  title: 'Bildirimler',
  channelName: 'SoRita anlık bildirimleri',
  channelDescription:
    'Takipler, yorumlar, alıntılar ve diğer sosyal hareketler için yüksek öncelikli bildirimler',
} as const;
