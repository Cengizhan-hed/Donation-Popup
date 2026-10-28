# RAPOR 121-stgfix3 (dal v121-stgfix3, worktree ../wt-121-stgfix3)

## Alınan teknik kararlar
- Ikram submit-fault: yeni `returnToDetails(form)` (tests/e2e/helpers/dp-form.mjs). Ad alanı gizliyse `[data-dp-back]` ile bilgi adımına döner; tutar adımındaysa `advanceToDetails`; geri düğmesi yoksa `'locked-step'` döner ve `runSubmitFaultChecks` (capture.mjs) son adımdaki ilk görünür yazılabilir alanı (kutu: değiştir/doğrula; metin: yaz/oku) yoklar. Gevşetme yok, `.catch(()=>{})` yok. Tek adımlı formda ad alanı görünür: eski yol.
- staging30 popup-custom-open teşhisi: `waitForVisibleCandidate` başarısız olunca `build/e2e/debug/<profil>/trigger-gorunmez-<mod>-<ürün>.json` + `.png` yazılır. JSON: URL (sorgu dahil), bağlam (misafir/yönetici), `document.title`, sayfadaki tüm `[data-dp-open]` sayısı, ilk adayın body'ye kadar ata zinciri (tag.class, display, visibility, opacity, hidden, rect). Kimlik/çerez/değer yazılmaz (`collectHiddenTriggerDump`). `openShellForMode` 4. parametre `ctxKind`.

## Kanıt tablosu
| Kontrol | Sonuç |
|---|---|
| lint:js | 0 bulgu |
| dp-form-playwright birim | 16/16 geçti (4 yeni: geri-dön, geri yok, zaten görünür, teşhis dökümü) |
| e2e:quick local | geçti (79 sn); JS birim tam 743/0 |

## Kalan işler
- Ikram'da submit-fault düzeltmesi uzak koşuda doğrulanmalı (Claude).
- staging30 popup-custom-open: uzak koşudan sonra debug JSON/PNG okunup neden belirlenecek (ata zinciri `div.tab-content` 0x0 şüphesi).
- MIMARI notu gerekmez (yalnız test yardımcıları).
