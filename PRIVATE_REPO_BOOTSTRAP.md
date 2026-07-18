# SoRita Private Repo Bootstrap

Bu dokuman artik eski modeli anlatmaz. Guncel continuity akisi icin [CONTINUITY_MODEL.md](./CONTINUITY_MODEL.md) dosyasini kullanin.

## Guncel Kural

- `.env`, `android/keystore.properties` ve private signing anahtarlari repo icinde tutulmaz.
- Gercek secret dosyalari yalnizca `SoRita_secrests` klasorunde saklanir.
- Yeni makinede restore islemi `RESTORE-TO-PROJECT.ps1` ile yapilir.

## Hemen Baslangic

```powershell
git clone https://github.com/cayankuzu/SoRita.git
cd SoRita
powershell -ExecutionPolicy Bypass -File "$HOME\Desktop\SoRita_secrests\RESTORE-TO-PROJECT.ps1" -ProjectRoot (Get-Location).Path
npm ci
```
