export const systemTr = {
  configErrorDescription:
    'Bu sürüm güvenli biçimde başlatılamıyor. Uygulamanın güncel sürümünü kullanıp yeniden dene.',
  configErrorDeveloperDetails: 'Geliştirme yapılandırmasında eksik değerler:',
  configErrorHint: 'Sorun devam ederse uygulama desteğiyle iletişime geç.',
  configErrorTitle: 'Uygulama başlatılamadı',
  connectionSlow: 'Bağlantı geç yanıt veriyor. Lütfen tekrar dene.',
  connectionUnavailable:
    'İnternet bağlantısı şu an kullanılamıyor. Bağlantını kontrol edip tekrar dene.',
  contentFailedDescription: 'Bu içerik görüntülenemedi.',
  contentFailedRetry: 'Yenile',
  crashDescription:
    'Uygulama beklenmeyen bir hatayla karşılaştı. Yeniden deneyerek akışa geri dönebilirsin.',
  crashRetry: 'Yeniden dene',
  crashTitle: 'Bir şeyler ters gitti',
  developmentMessage: 'Geliştirme mesajı',
  expoGoMapLimitationDescription:
    "Bu emülatör şu an Expo Go ile açılıyor. Android native Google Maps, Expo Go paketinde gerekli yetkileri alamadığı için boş görünebilir. Gerçek SoRita geliştirici build'inde harita düzgün yüklenir.",
  expoGoMapLimitationTitle: 'Android Expo Go harita kısıtı',
  exitPrompt: 'Uygulamadan çıkmak için bir kez daha bas.',
  missingAccountTitle: 'Hesap silindi',
  missingAccountMessage: 'Bu hesap artık mevcut olmadığı için oturumun kapatıldı.',
  requestFailed: (status: number) => `İstek başarısız oldu (${status})`,
  sessionRefreshFailed: 'Oturum yenilenemedi. Lütfen tekrar giriş yap.',
  uploadCancelDescription:
    'Devam eden yükleme durdurulacak. Kaydedilmemiş ilerleme korunmayabilir.',
  uploadCancelTitle: 'Yükleme iptal edilsin mi?',
  offlineMessage: 'İnternet bağlantısı yok',
  offlinePendingChanges: (count: number) =>
    `İnternet bağlantısı yok. ${count} değişiklik bağlantı gelince gönderilecek.`,
  syncingChanges: 'Değişiklikler senkronize ediliyor…',
  syncFailed: (count: number) =>
    `${count} değişiklik gönderilemedi. Otomatik olarak tekrar denenecek.`,
} as const;

export const moderationTr = {
  commentField: 'Yorum',
  nameField: 'Ad alanı',
  objectionableContent: (fieldName: string) =>
    `${fieldName} topluluk kurallarına aykırı ifade içeriyor.`,
  placeNameField: 'Mekân adı',
  placeNoteField: 'Mekân notu',
  placeTitleField: 'Mekân başlığı',
  usernameField: 'Kullanıcı adı',
} as const;

export const categoriesTr = {
  bar: 'Bar',
  beach: 'Plaj',
  cafe: 'Kafe',
  museum: 'Müze / Tarihi Yer',
  nightlife: 'Gece Hayatı',
  other: 'Diğer',
  park: 'Park',
  restaurant: 'Restoran',
  shopping: 'Alışveriş',
} as const;
