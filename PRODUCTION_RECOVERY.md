# Production Recovery

Bu belge continuity modelinin kisa ozeti olarak korunur. Ayrintili talimatlar icin [CONTINUITY_MODEL.md](./CONTINUITY_MODEL.md) dosyasina gecin.

## Guncel Recovery Ozeti

- GitHub repoda kaynak kodu, migration'lar, edge function kodu ve client config dosyalari kalir.
- Gercek `.env`, `credentials.json`, iOS signing dosyalari, `android/keystore.properties` ve release keystore yalnizca `SoRita_secrests` klasorunde tutulur.
- Yeni makinede once repo clone edilir, sonra `RESTORE-TO-PROJECT.ps1` ile secret dosyalari geri yuklenir.

```powershell
git clone https://github.com/cayankuzu/SoRita.git
cd SoRita
powershell -ExecutionPolicy Bypass -File "$HOME\Desktop\SoRita_secrests\RESTORE-TO-PROJECT.ps1" -ProjectRoot (Get-Location).Path
npm ci
```
