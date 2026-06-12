export const LEGAL_CONSENT_VERSION = '2026-04-16';

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
    buttonLabel: 'Kullanim Kosullari',
    title: 'Kullanim Kosullari',
    summary: 'UGC alanlarina erismeden once kabul edilmesi gereken ana sartlar.',
    sections: [
      {
        title: 'Topluluk Guvenligi',
        body: [
          'SoRita, kullanici uretimli icerik barindiran bir sosyal platformdur.',
          'Uygunsuz icerik, taciz, nefret soylemi, cinsel istismar, siddet tehdidi, doxxing, spam ve sahtecilik icin sifir tolerans uygulanir.',
          'Kullanicilar, hesaplarini veya iceriklerini kotuye kullandiklarinda icerikleri kaldirilabilir ve hesaplari askiya alinabilir ya da tamamen kapatilabilir.',
        ],
      },
      {
        title: 'Moderasyon ve Yaptirim',
        body: [
          'Kullanici raporlari en gec 24 saat icinde incelenir.',
          'Uygunsuz oldugu tespit edilen icerikler kaldirilir; ihlali yapan hesaplar gecici veya kalici olarak sistemden cikarilabilir.',
          'Bloklanan kullanicilarin icerikleri feed, yorum ve profil gorunumlerinden aninda gizlenir.',
        ],
      },
      {
        title: 'Kullanici Sorumlulugu',
        body: [
          'Paylastiginiz her yorum, liste, fotograf, profil metni ve mekan iceriginden siz sorumlusunuz.',
          'Bir baska kisinin haklarini ihlal eden veya gercek dunyada zarar olusturabilecek icerikler paylasilamaz.',
        ],
      },
    ],
  },
  community: {
    id: 'community',
    buttonLabel: 'Topluluk Kurallari',
    title: 'Topluluk Kurallari',
    summary: 'Guvenli bir sosyal harita deneyimi icin zorunlu davranis kurallari.',
    sections: [
      {
        title: 'Izin Verilmeyen Davranislar',
        body: [
          'Hakaret, cinsel icerikli taciz, nefret soylemi, tehdit, spam ve yonlendirilmis kotu niyetli kampanyalar yasaktir.',
          'Yaniltici mekan bilgisi, sahte liste, sahte yorum veya organize manipulasyon davranislari kabul edilmez.',
        ],
      },
      {
        title: 'Raporlama ve Engelleme',
        body: [
          'Her kullanici icerigi veya profili uygulama icinden raporlayabilir.',
          'Bir kullaniciyi engellediginizde ilgili icerikler aninda sizden gizlenir ve moderasyon incelemesi icin sistemde guvenlik sinyali olusturulur.',
        ],
      },
    ],
  },
  privacy: {
    id: 'privacy',
    buttonLabel: 'Gizlilik',
    title: 'Gizlilik Politikasi',
    summary: 'Hesap, icerik ve guvenlik olaylari sirasinda veri isleme esaslari.',
    sections: [
      {
        title: 'Islenen Veriler',
        body: [
          'Hesap olusturma sirasinda kimlik ve profil bilgileri; liste, mekan, yorum ve fotograf icerikleri; guvenlik ve moderasyon kayitlari islenir.',
          'Raporlama, engelleme ve guvenlik incelemeleri sirasinda gerekli oldugunda moderasyon verileri saklanir.',
        ],
      },
      {
        title: 'Amac ve Saklama',
        body: [
          'Veriler; hizmet sunumu, hesap guvenligi, kotuye kullanim tespiti, yasal yukumlulukler ve topluluk moderasyonu amaclariyla islenir.',
          'Raporlanan icerikler ve guvenlik olaylari, inceleme ve yasal gereklilikler icin gerekli oldugu surece tutulur.',
        ],
      },
    ],
  },
  kvkk: {
    id: 'kvkk',
    buttonLabel: 'KVKK',
    title: 'KVKK Aydinlatma Metni',
    summary: '6698 sayili Kanun kapsaminda temel bilgilendirme.',
    sections: [
      {
        title: 'Veri Sorumlusu ve Amac',
        body: [
          'SoRita uzerindeki hesabiniz ve kullanici icerikleriniz, hizmetin sunulmasi ve guvenli sekilde isletilmesi amaciyla islenir.',
          'Moderasyon, kotuye kullanim tespiti ve kullanici guvenligi surecleri KVKK kapsaminda mesru menfaat ve hukuki yukumluluk temelleriyle yurutulur.',
        ],
      },
      {
        title: 'Haklariniz',
        body: [
          'KVKK kapsamindaki erisim, duzeltme, silme ve itiraz haklarinizi destek kanallarimiz uzerinden kullanabilirsiniz.',
          'Guvenlik incelemeleri kapsaminda saklanmasi zorunlu kayitlar, ilgili mevzuat elverdigi olcude silinir veya anonimlestirilir.',
        ],
      },
    ],
  },
};

export function getLegalDocument(documentId: LegalDocumentId) {
  return LEGAL_DOCUMENTS[documentId];
}
