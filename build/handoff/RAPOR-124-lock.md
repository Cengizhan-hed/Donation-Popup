# RAPOR 124-lock

## Alınan teknik kararlar
- Bağımlılıksız yardımcı `tests/e2e/helpers/file-lock.mjs` (`withFileLockSync`): `fs.openSync(..., 'wx')` ile atomik kilit, içerik `{pid, at}`; bayat kilit = ölü PID veya yaş > 15 dk (yarım yazılmışsa >5 sn); bekleme `Atomics.wait` ile 200 ms aralık, 10 dk zaman aşımı ve net hata mesajı; bırakma `finally` + `exit` + SIGINT/SIGTERM.
- Kilit tüm `ensureMatrixTemplate()` gövdesini sarar (yalnız `installCurrentPlugin` değil: Woo/tema kurulumu, wp-config, taban anlık görüntü de aynı yarışa açıktı). Kilit dosyası: `build/e2e/matrix/_template.lock`. İşlev eşzamanlı olduğu için API eşzamanlı bırakıldı.
- Gecikmeli başlatma notu RAPOR-124-email3.md'den kaldırıldı; kodda/belgede başka yoktu.

## Kanıt
- Birim: `file-lock.test.mjs` 6/6 (al/bırak, hata sonrası bırak, ölü PID, eski damga, zaman aşımı mesajı, iki süreç paralel bekleme). `npm run test`: PHPUnit 877 test OK; JS 861 test, 860 geçti, 0 kalan başarısız.
- `npm run verify` yeşil (yeni bulgu 0).
- Kırmızı (kilitsiz, `git stash`): `run-mail.mjs` 9071 + 9072 aynı anda, gecikmesiz, temiz şablon: koşu A `ENOENT chmod ... plugins/woo-donation-popup/languages/parts/E8E.po` ile düştü (2 ENOENT satırı), B geçti.
- Yeşil (kilitli): aynı iki koşu, şablon silinmiş halde aynı anda: A 3/3 geçti (28.2 sn), B 3/3 geçti (23.2 sn); biri "[kilit] ... bekleniyor" yazdı; koşu sonrası `_template.lock` kalmadı.

## Ayar/rehber güncellemesi
Gerek yok: yalnız yerel test altyapısı, kullanıcıya görünür davranış yok.

## Kalan işler
Aynı yardımcı başka ortak kurulum adımlarına (ör. `scripts/migration-rehearsal.mjs`) gerekirse uygulanabilir; bu görev kapsamında değil.
