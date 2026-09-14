export const LEGAL_CONSENT_VERSION = '2026-09-08-terms-community-privacy';

export type LegalDocumentId = 'terms' | 'community' | 'privacy' | 'kvkk';

type LegalDocumentSection = {
  title: string;
  body: string[];
};

export type LegalDocument = {
  id: LegalDocumentId;
  buttonLabel: string;
  title: string;
  summary: string;
  sections: LegalDocumentSection[];
};

export const LEGAL_DOCUMENT_IDS: LegalDocumentId[] = [
  'terms',
  'community',
  'privacy',
  'kvkk',
];

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  terms: {
    id: 'terms',
    buttonLabel: 'Kullanım Koşulları',
    title: 'Kullanım Koşulları',
    summary: 'UGC alanlarına erişmeden önce kabul edilmesi gereken ana şartlar.',
    sections: [
      {
        title: 'Topluluk Güvenliği',
        body: [
          'SoRita, kullanıcı üretimli içerik barındıran bir sosyal platformdur.',
          'Uygunsuz içerik, taciz, nefret söylemi, cinsel istismar, şiddet tehdidi, doxxing, spam ve sahtecilik için sıfır tolerans uygulanır.',
          'Kullanıcılar, hesaplarını veya içeriklerini kötüye kullandıklarında içerikleri kaldırılabilir ve hesapları askıya alınabilir ya da tamamen kapatılabilir.',
        ],
      },
      {
        title: 'Moderasyon ve Yaptırım',
        body: [
          'Kullanıcı raporları önem ve risk düzeyine göre moderasyon incelemesine alınır.',
          'Uygunsuz olduğu tespit edilen içerikler kaldırılır; ihlali yapan hesaplar geçici veya kalıcı olarak sistemden çıkarılabilir.',
          'Bloklanan kullanıcıların içerikleri feed, yorum ve profil görünümlerinden anında gizlenir.',
        ],
      },
      {
        title: 'Kullanıcı Sorumluluğu',
        body: [
          'Paylaştığınız her yorum, liste, fotoğraf, profil metni ve mekân içeriğinden siz sorumlusunuz.',
          'Bir başka kişinin haklarını ihlal eden veya gerçek dünyada zarar oluşturabilecek içerikler paylaşılamaz.',
        ],
      },
    ],
  },
  community: {
    id: 'community',
    buttonLabel: 'Topluluk Kuralları',
    title: 'Topluluk Kuralları',
    summary: 'Güvenli bir sosyal harita deneyimi için zorunlu davranış kuralları.',
    sections: [
      {
        title: 'İzin Verilmeyen Davranışlar',
        body: [
          'Hakaret, cinsel içerikli taciz, nefret söylemi, tehdit, spam ve yönlendirilmiş kötü niyetli kampanyalar yasaktır.',
          'Yanıltıcı mekân bilgisi, sahte liste, sahte yorum veya organize manipülasyon davranışları kabul edilmez.',
        ],
      },
      {
        title: 'Raporlama ve Engelleme',
        body: [
          'Her kullanıcı içeriği veya profili uygulama içinden raporlayabilir.',
          'Bir kullanıcıyı engellediğinizde ilgili içerikler anında sizden gizlenir ve moderasyon incelemesi için sistemde güvenlik sinyali oluşturulur.',
        ],
      },
    ],
  },
  privacy: {
    id: 'privacy',
    buttonLabel: 'Gizlilik',
    title: 'Gizlilik Politikası',
    summary: 'Hesap, içerik ve güvenlik olayları sırasında veri işleme esasları.',
    sections: [
      {
        title: 'İşlenen Veriler',
        body: [
          'Hesap oluşturma sırasında kimlik ve profil bilgileri; liste, mekân, yorum ve fotoğraf içerikleri; güvenlik ve moderasyon kayıtları işlenir.',
          'Sentry etkin olduğunda çökme ve hata kayıtları, performans izleri, ekran veya işlem adı ve düşük kardinaliteli sınırlı ürün olayı metrikleri işlenebilir; bu kayıtlar hesap güvenliği ve hata incelemesi için dahili kullanıcı kimliğiyle ilişkilendirilebilir.',
          'İsteğe bağlı PostHog ürün analitiği varsayılan olarak kapalıdır ve yalnızca Ayarlar üzerinden açıkça etkinleştirdiğinizde çalışır. Bu akışta anonim kurulum tanımlayıcısı, olay türü, ekran veya işlem adı ile sınırlı süre ve sayaç ölçümleri işlenebilir; hesap kimliği, kullanıcı içeriği, arama metni, medya adresi ve hassas konum gönderilmez.',
          'SoRita reklam kimliği veya reklam ilişkilendirme (attribution) SDK’sı kullanmaz.',
          'Raporlama, engelleme ve güvenlik incelemeleri sırasında gerekli olduğunda moderasyon verileri saklanır.',
        ],
      },
      {
        title: 'Amaç ve Saklama',
        body: [
          'Veriler; hizmet sunumu, hesap güvenliği, kötüye kullanım tespiti, yasal yükümlülükler ve topluluk moderasyonu amaçlarıyla işlenir.',
          'Raporlanan içerikler ve güvenlik olayları, inceleme ve yasal gereklilikler için gerekli olduğu sürece tutulur.',
          'İsteğe bağlı ürün analitiği tercihini dilediğiniz zaman Ayarlar üzerinden kapatabilirsiniz; bu işlem yeni ürün olayı gönderimini durdurur. Daha önce iletilmiş anonim ölçümlerin saklama süresi ve silme işlemleri, yayın öncesinde onaylanan sağlayıcı saklama politikasıyla sınırlandırılır.',
        ],
      },
    ],
  },
  kvkk: {
    id: 'kvkk',
    buttonLabel: 'KVKK',
    title: 'KVKK Aydınlatma Metni',
    summary: '6698 sayılı Kanun kapsamında temel bilgilendirme.',
    sections: [
      {
        title: 'Veri Sorumlusu ve Amaç',
        body: [
          'SoRita üzerindeki hesabınız ve kullanıcı içerikleriniz, hizmetin sunulması ve güvenli şekilde işletilmesi amacıyla işlenir.',
          'Moderasyon, kötüye kullanım tespiti ve kullanıcı güvenliği süreçleri KVKK kapsamında meşru menfaat ve hukuki yükümlülük temelleriyle yürütülür.',
        ],
      },
      {
        title: 'Haklarınız',
        body: [
          'KVKK kapsamındaki erişim, düzeltme, silme ve itiraz haklarınızı destek kanallarımız üzerinden kullanabilirsiniz.',
          'Güvenlik incelemeleri kapsamında saklanması zorunlu kayıtlar, ilgili mevzuat elverdiği ölçüde silinir veya anonimleştirilir.',
        ],
      },
    ],
  },
};

export function getLegalDocument(documentId: LegalDocumentId) {
  return LEGAL_DOCUMENTS[documentId];
}
