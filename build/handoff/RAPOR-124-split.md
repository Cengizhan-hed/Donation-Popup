# RAPOR 124-split (dal v124-split)
## Alınan teknik kararlar
- `specs/kurgu-matrix.spec.mjs` silindi; yerine `specs/kurgu-matrix-layout-pay.spec.mjs` (düzen x ödeme, 10 test) ve `specs/kurgu-matrix-height.spec.mjs` (compact yükseklik, 1 test) + ortak `helpers/kurgu-matrix.mjs` (sabitler, adminHeights, setBehavior, cart, watch, formFlow, compactFlow).
- E-posta/alan kuralı ve klavye (blur) adımları bugünkü dosyada ayrı test değil, formFlow içindeki adımlardı. Test eklemek "kapsam aynı" kuralını bozacağı için ayrı dosya açılmadı; bunlar ortak modülde (formFlow) duruyor.
- Geriye uyumluluk: `--spec kurgu-matrix` Playwright dosya-adı deseni olduğundan her iki yeni dosyayı da koşar. Tek parça: `--spec kurgu-matrix-height` / `kurgu-matrix-layout-pay`. Describe/test adları aynı.
## Kanıt
- `--list` (dosya yolu hariç, sıralı) fark 0; 33 test (3 cihaz), 1 dosya yerine 2 dosya.
- e2e kurgu-matrix 3 cihaz: 31 geçti, 2 atlandı (önceki ile aynı). Port 9183 (9083 başka süreçte dinleniyordu, dokunulmadı).
- `npm run test`: 878 geçti, 0 kaldı, 1 atlandı. verify: lint/PHPStan/verify-js temiz; `verify:knip` worktree'de knip yok (node_modules/.bin/knip) yüzünden kırmızı, kod kaynaklı değil; ana depoda koşturun.
- ESLint yeni dosyalarda temiz. `git merge ikram-ortam`: güncel.
## Ayar/rehber
Gerek yok (yalnız test düzeni).
## Birleştirme notu
docs/MIMARI.md satır 957 ve 1033 "e2e `kurgu-matrix`" atıfı geçerli kalır (yükseklik: `kurgu-matrix-height`); istenirse güncelleyin.
## Kalan işler
Yok.
