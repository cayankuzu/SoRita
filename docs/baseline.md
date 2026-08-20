# SoRita doğrulanmış yerel baseline

Tarih: 2026-08-17
Saat dilimi: Europe/Istanbul

Çalışma ağacı kullanıcıya ait mevcut değişikliklerle birlikte kirliydi; bu nedenle önceki uzak
dal eşitliği, temiz ağaç, deploy veya imzalı release iddiası yapılmaz.

| Kapı | Güncel yerel kanıt |
|---|---:|
| Lint | 0 warning |
| Test | 140 dosya / 731 test |
| Statements | %94,64 |
| Branches | %90,01 |
| Functions | %93,91 |
| Lines | %94,85 |
| Expo Doctor | 19/19 |
| Hermes Android bundle | 8,83 MiB / 12 MiB |
| Security-focused suite | 6 dosya / 74 test |
| Production raw audit | 10 high; iki yamalanmamış build-only `image-size` advisory zinciri |
| Policy audit | PASS; süreli Metro-only kabul ve asset guard ile |
| Android | Standalone build/install/launch ve emulator görsel smoke PASS |

Yerel k6 CLI mevcut ve 10.000 VU profili parse edildi. Tam yük koşusu staging kimlikleri ister.
Supabase CLI mevcut, fakat Docker daemon olmadığı için DB reset/lint/pgTAP yerelde çalıştırılmadı.
iOS ve production sağlayıcı/store kanıtı üretilmedi.

Detaylar: `docs/release/FINAL_RELEASE_EVIDENCE.md`.
