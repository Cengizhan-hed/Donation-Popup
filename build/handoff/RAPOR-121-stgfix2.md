# RAPOR 121-stgfix2 (dal v121-stgfix2)

## Alınan teknik kararlar
- `dp-form.mjs`: yeni `waitForVisibleCandidate(candidates, timeout)`: ilk görünür adayı CHECK_MS'e kadar yoklayarak bekler; zaman aşımında aday sayısı + her adayın display/visibility/boyut/gizleyen ata bilgisini döndürür.
- `capture.mjs openShellForMode`: anlık `isVisible` döngüsü yerine bu bekleme; "trigger-gorunmez adaylar=N hepsi gizli ..." ayrıntısı korundu (nedenlerle).
- `remote-smoke.mjs`: yeni `clickFirstVisibleTrigger` (görünür, döngü dışı adayı bekler; hata metninde locator + aday durumu + kind). Shell-open ve iki başka tıklama noktası (add-to-cart, ambiguous) bunu kullanır; eski `.first()` tıklaması kalktı.
- `advanceToDetails`: vergi indirimi (tax_relief) adımı bilgiden ÖNCE geliyorsa kutu işaretlenmeden "Devam" ile geçer. Adım bilgiden SONRA ise (eklentinin gerçek sırası: tutar → bilgi → vergi) ana düğme formu gönderir; bu yüzden tıklamadan açık hata verir. Beyan metni/onay uydurulmadı.
- Not: Ikram hatası (`details:hidden, tax_relief:shown`) form zaten son adımdayken `advanceToDetails` çağrıldığını gösterir (gerçek sıra: tax en sondadır, `Tax_Relief_Module::add_step`); çağıran akışın tutar→bilgi sırasını/adım durumunu Ikram'da Claude uzak koşuda doğrulamalı.

## Kanıt tablosu
| Kontrol | Sonuç |
|---|---|
| lint:js | 0 bulgu |
| tests/unit/js/*.test.mjs | 740 test, 739 geçti, 0 kalan (1 atlanan) |
| dp-form-playwright (yeni: tax-önce geçiş, negatif tax-sonra → gönderim yok, waitForVisibleCandidate geç görünür + zaman aşımı nedeni) | 12/12 |
| e2e:quick --env local (port 8938) | "E2E quick passed": işlevsel 32 geçti / 0 hata (görev metnindeki 41 yerine 32 sayıldı); 67 sn. Görsel: 1 değişti (iphone-popup-custom-errors.png); accept edilmedi, yalnız test yardımcıları değiştiği için eklenti kaynaklı değil, önceden var olan fark olabilir (Claude incelemeli) |
| Yerelde tax_relief gerçek koşu | tests/e2e/specs/thanks-tax.spec.mjs (e2e:e6) zaten modülü açıp 3 adımı sürüyor; bu görevde koşulmadı |

## Kalan işler
- Uzak yeniden koşu (staging30 shell-open, Ikram Gift Aid) Claude'da.
