# RAPOR 121-matrixfix (dal v121-matrixfix)
## Alınan teknik kararlar
- `checkValidationErrors` (tests/e2e/helpers/matrix-scenarios.mjs): tutar boşken tıklama kaldırıldı; düğmenin `aria-disabled="true"`, `.is-pending` sınıfı ve boş olmayan etiketi doğrulanıyor (etiket sabit TR metni değil; yalnız boş değil denetimi). Tutar-hatası+odak beklentisi kaldırıldı.
- Geçerli tutarda `aria-disabled="false"` doğrulaması eklendi. Bilgi adımı boş gönder + zorunlu alan hataları + odak AYNEN.
- Kaynak: assets/src/experiences/form.mjs paint().
## Kanıt tablosu (--env local, port 8936, worker 1)
sf-usd-blocks-nohpos ve sf-gbp-classic-hpos × iphone/android/desktop: 11/0/0 (40-46 sn); 6/6 yeşil.
## Negatif kontrol
Çalıştırılamadı (araç izni reddedildi). Gerekçe: toHaveAttribute/toHaveClass kesin eşleşme; düğme etkin kalırsa zaman aşımıyla kırılır. İsteğe bağlı: 'true'->'false' yapıp tek hücre koş.
## Kalan işler
verify/test koşulmadı (yalnız test dosyası değişti). Merge Claude'da.
