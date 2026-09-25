export const homeTr = {
  errorDescription: 'Ana akış şu an yüklenemiyor. Lütfen tekrar dene.',
  errorTitle: 'Akış şu anda açılamıyor',
  exploreCta: 'Keşfet',
  noFeedDescription: 'Takip ettiğin kişiler henüz herkese açık liste paylaşmadı.',
  noFeedTitle: 'Henüz paylaşım yok',
  noFollowingDescription: 'Keşfet sayfasından ilginç listeleri bul ve kullanıcıları takip et.',
  noFollowingTitle: 'Henüz kimseyi takip etmiyorsun',
  partialDataDescription:
    'Kayıtlı akış gösteriliyor. Aşağı çekerek veya şimdi tekrar deneyerek güncelleyebilirsin.',
  partialDataTitle: 'Bazı güncellemeler tamamlanamadı',
  partialDataRetry: 'Şimdi dene',
} as const;

export const exploreTr = {
  empty: {
    noList: 'Henüz liste yok',
    noListDescription: 'Herkese açık listeler burada görünecek.',
    noPhoto: 'Henüz fotoğraf yok',
    noPhotoDescription: 'Paylaşılan fotoğraflar burada görünecek.',
    noPlace: 'Henüz mekân yok',
    noPlaceDescription: 'Paylaşılan mekânlar burada görünecek.',
    noResult: 'Sonuç bulunamadı',
    noUser: 'Henüz kullanıcı yok',
    noUserDescription: 'Kullanıcılar burada görünecek.',
    noUserResult: 'Kullanıcı bulunamadı',
    keepTyping: 'Biraz daha yaz',
    keepTypingDescription: 'Aramak için en az 3 harf yaz.',
    tryDifferentSearch: 'Farklı bir arama deneyin.',
  },
  errorTitle: 'Keşfet şu anda açılamıyor',
  errorDescription: 'Keşfet içerikleri şu an yüklenemiyor. Lütfen tekrar dene.',
  followRequiresUser: 'Takip işlemi için aktif kullanıcı gerekli.',
  loadMore: 'Daha fazla göster',
  // Without a query the grid is suggestions; with one, it is what matched.
  resultCount: (count: number, searching: boolean) =>
    searching ? `${count} sonuç` : `${count} öneri`,
  loadMoreHint: 'Aşağı indikçe yeni sonuçlar yüklenir',
  partialDataDescription:
    'Kayıtlı sonuçlar gösteriliyor. Bağlantı düzelince tekrar deneyebilirsin.',
  partialDataTitle: 'Bazı keşfet sonuçları güncellenemedi',
  search: {
    list: 'Liste ara...',
    photo: 'Fotoğraf veya mekân ara...',
    person: 'Kişi ara...',
    place: 'Mekân veya adres ara...',
  },
  tabs: {
    lists: 'Listeler',
    people: 'Kişiler',
    photos: 'Fotoğraflar',
    places: 'Mekânlar',
  },
  title: 'Keşfet',
  toast: {
    followRequestSent: 'Takip isteği gönderildi',
    followUpdated: 'Takip durumu güncellendi',
    userFollowed: 'Kullanıcı takip edildi',
  },
} as const;
