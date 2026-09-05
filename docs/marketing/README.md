# SoRita pazarlama paketi

Tarih: 2026-09-04
Durum: Depo tarafı hazır. **Yayın NO-GO** — cihaz/sağlayıcı/mağaza kanıtı
tamamlanmadı (`quality/release-scorecard.json`).

Bu paket uygulamaya hiçbir özellik eklemez. Ürünün bugün yaptığı işi daha
anlaşılır ve daha dürüst anlatmak için vardır.

## Belgeler

| Belge | Ne işe yarar |
| --- | --- |
| [claims-register.md](claims-register.md) | **Paketin omurgası.** Her iddia, dayanağı ve izin verilen ifade |
| [positioning-and-messaging.md](positioning-and-messaging.md) | Konumlandırma, segment, JTBD, mesaj hiyerarşisi, marka sesi |
| [store-listing-tr.md](store-listing-tr.md) | App Store ve Play metinleri, veri güvenliği beyanı |
| [screenshot-storyboard.md](screenshot-storyboard.md) | Mağaza görselleri: kare planı, ölçüler, çekim kuralları |
| [ad-creative-briefs.md](ad-creative-briefs.md) | Üç reklam açısı, hook, video akışı, kanal, metrik |
| [go-to-market-plan.md](go-to-market-plan.md) | Aşamalı kanal planı ve karar kuralları |
| [measurement-plan.md](measurement-plan.md) | Yeni SDK eklemeden huni ölçümü |
| [pitch-deck-outline-tr.md](pitch-deck-outline-tr.md) | 10 slaytlık sunum iskeleti |

## Çalışma kuralı

1. Bir iddia kullanılacaksa önce kütükte satırı olur.
2. Satırın kanıt sütunu boşsa iddia **yayınlanmaz**.
3. `ÖLÇÜLMEDİ` satırlarından hiçbir ifade metne girmez.
4. Pazarlama materyalinde geçen her ekran, dondurulmuş ürün yüzeyinde
   gerçekten bulunmalıdır.

Dördüncü kural elle değil, makineyle denetlenir:

```
npm run marketing:check
```

Guard, `utils/guards/check-marketing-claims.mjs`:

- pazarlama belgelerinde adı geçen her rota/sekmeyi
  `quality/feature-surface.snapshot.json` ile karşılaştırır;
- kütükteki her satırın kanıt sütununu zorunlu tutar;
- yasak abartı kelimelerini ("en iyi", "garantili", "AI destekli", "binlerce
  kullanıcı" gibi) iddia metinlerinde yakalar;
- kütükte tanımlı olmayan bir `C#` referansına atıf yapılmışsa kırılır.

## Neden bu kadar katı

Bu ürünün en savunulabilir ayrımı reklamsız ve takipsiz olması (C3). Bu
iddianın değeri, doğruluğuyla doğru orantılıdır: tek bir abartılı cümle,
kanıta dayalı bütün paketi değersizleştirir. Katılık pazarlamayı
zayıflatmıyor — inandırıcı kılan tek şey o.

## Yayın öncesi

- [ ] `npm run marketing:check` yeşil
- [ ] Ekran görüntüleri aday build'den alındı, SHA kaydedildi
- [ ] Veri güvenliği formu `store-listing-tr.md` tablosuyla birebir aynı
- [ ] Kütükte `ÖLÇÜLMEDİ` kalan satırların hiçbiri metinlerde geçmiyor
- [ ] Sunumdaki traction slaytı hâlâ "henüz ölçülmedi" diyor
