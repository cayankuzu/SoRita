# SoRita — dal, uzak depo ve yayın sapması

- Aday commit: `46c5052ff687d0a6695829b70708abd67037e8ec`
- Branch: `chore/final-release-candidate-aaa`
- Ölçüm tarihi: 2026-09-05
- Yöntem: `git fetch --all --prune --tags`, `gh pr list`, `gh api` ile
  doğrudan sorgulandı. Aşağıdaki her satır çalıştırılmış bir komutun çıktısıdır.

## Dallar

| Dal | Commit | Durum |
| --- | --- | --- |
| `main` | `2c8cf22` | `origin/main` izliyor |
| `chore/final-release-candidate-aaa` | `46c5052ff687d0a6695829b70708abd67037e8ec` | main'in 10 commit önünde, 0 commit gerisinde |

Sapma tek yönlü ve doğrusaldır; `main` bu dalda olmayan hiçbir commit
taşımıyor, yani rebase/merge çakışması beklenmiyor.

## Uzak depolar

| Ad | URL | Durum |
| --- | --- | --- |
| `origin` | `https://github.com/cayankuzu/SoRita.git` | Erişilebilir |
| `sorita00` | `https://github.com/cayankuzu/SoRita_00.git` | **Repository not found** |

`sorita00` yüzünden `git fetch --all` daima hata ile biter. Bu uzak depo
çalışma ağacında, betiklerde, iş akışlarında veya belgelerde **hiçbir yerde**
referans edilmiyor; yalnız yerel `.git/config` içinde duruyor.

Kaldırılmadı: uzak depo tanımı depo içeriğinin parçası değil, yerel git
yapılandırmasıdır; sahibinin kararıdır. Öneri: `git remote remove sorita00`.

## Yayın etiketleri

**Hiç yok.** Depoda tek bir etiket bulunmuyor, dolayısıyla "son yayın
etiketinden bugüne değişiklikler" diye bir karşılaştırma yapılamıyor. Bu, ilk
yayın öncesi bir depo için tutarlıdır ama yayın sonrası geri alma (rollback)
referansı da yok demektir.

## Açık PR'lar

Yedi açık PR var; hepsi Dependabot:

| # | Konu | Dal |
| --- | --- | --- |
| 26 | react-native-pager-view 8.0.0 → 9.0.3 | `dependabot/npm_and_yarn/react-native-pager-view-9.0.3` |
| 25 | knip 6.27.0 → 6.34.0 | `dependabot/npm_and_yarn/knip-6.34.0` |
| 24 | actions/checkout 7.0.0 → 7.0.1 | `dependabot/github_actions/actions/checkout-7.0.1` |
| 23 | expo/expo-github-action 8.2.1 → 9.0.0 | `dependabot/github_actions/expo/expo-github-action-9.0.0` |
| 20 | react-native-gesture-handler 2.30.1 → 3.2.1 | `dependabot/npm_and_yarn/react-native-gesture-handler-3.2.1` |
| 19 | test-tooling grubu (2 paket) | `dependabot/npm_and_yarn/test-tooling-03a3299ce5` |
| 18 | expo-react-native grubu (29 paket) | `dependabot/npm_and_yarn/expo-react-native-e7a93294d8` |

PR 26, 20, 19 ve 18 major sürüm sıçraması içeriyor ve CI'ları kırmızı;
bunlar yeni binary gerektiren native değişikliklerdir, OTA ile geçilemez.
Yayın adayına dahil edilmediler.

## Dal koruması — P0

`gh api repos/cayankuzu/SoRita/branches/main/protection` → **404 Branch not
protected**. `gh api repos/cayankuzu/SoRita/rulesets` → **`[]`**.

Yani `main`:

- PR zorunluluğu yok,
- required status check yok,
- force-push ve dal silme engellenmemiş,
- çözülmemiş konuşma / bayat onay kuralı yok.

Master prompt bunu açıkça P0 sayıyor. **Düzeltilmedi:** dal koruması açmak,
sahibinin kendi `main`'e doğrudan push akışını da bloke eder; bu, depo
sahibinin vereceği bir karardır. Önerilen minimum (tek kişilik proje için iki
onaylayan şartı olmadan):

```bash
gh api -X PUT repos/cayankuzu/SoRita/branches/main/protection   -H "Accept: application/vnd.github+json"   -f "required_status_checks[strict]=true"   -f "required_status_checks[contexts][]=Release gates green"   -F "enforce_admins=true"   -F "required_pull_request_reviews[required_approving_review_count]=0"   -F "restrictions=null"   -F "allow_force_pushes=false"   -F "allow_deletions=false"
```

## `main` üzerinde kırmızı CI — P1

`Media Upload Session Sweeper` iş akışı `main` üzerinde **art arda beş kez**
başarısız oldu (`33859428833`, `33883299965`, `33905712137`,
`33921290662`, `33931857686`).

Kök neden: `20260830173000_durable_media_upload_sessions_and_state_guards.sql`
migration'ı hosted Supabase projesine uygulanmamış; `PGRST202` ile RPC schema
cache'te bulunamıyor. Ayrıntı ve düzeltme adımı
[MANUAL_STEPS.md](../MANUAL_STEPS.md) bölüm 20'de.

Bu, yerel hiçbir kapının göremeyeceği bir kusurdur: ops testi RPC'yi stub'lıyor.

## Sonuç

Depo tarafı sapması temiz ve doğrusal. Yayını engelleyen iki şey depo dışında:
korumasız `main` ve uygulanmamış bir production migration'ı. İkisi de sahibinin
sağlayıcı yetkisini gerektiriyor.
