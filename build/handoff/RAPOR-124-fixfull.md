# RAPOR 124-fixfull (dal v124-fixfull, Opus)

Girdi: E2E-FULL-12.4-ilk-koşu.log → 97 geçti / 42 hata. Sonuç: **e2e:full 128 / 0** (android 37, desktop 39, iphone 41, iphone-mut 1, iphone-mut2 10). Bu sayı 12.3 son durumuyla (128/0) aynı.

## Kök neden tablosu

| # | Başarısız testler (ilk koşu) | Kök neden (kanıt) | Düzeltme | Kanıt sayıları |
|---|---|---|---|---|
| 1 | Hepsi android+iphone (iphone-mut2 dahil): submit-fault, fixed-cart, `*-errors-trigger/assert` (8+8), addon-* (7), checkout-flow-* (4), empty-price-*-product-cart (2). Toplam 34 | **12.4 klavye sözleşmesi.** Dokunmatik ekranda bir yazı alanı odaktayken alt bölüm (toplam + düğmeler) yerinde kalıyor; yalnız `opacity:0` + `pointer-events:none` + `inert` ile gizleniyor (layer.mjs `setBarHidden`, base.css `[data-dp-kb]`). 12.3'te bölüm kaydırma alanına taşınıyor ve tıklanabilir kalıyordu. Hata ayıklama günlüğü: `<div data-dp-field="donation_phone">` / `donation-panel-hint` / `donation_dedication` / addon anahtarı "intercepts pointer events". Odaktaki alanlar test doldurmasından (`fill`) ya da ürünün bilinçli odağından geliyor (ithaf/alt bağış anahtarı açılınca alana odak, ilk hatalı alana odak). Bu, sözleşmeye bağlı **yasal davranış**: experiences-instant.spec bunu açıkça istiyor (`data-dp-kb=1`, opacity 0, inert); kurgu-matrix yardımcısı da aynı nedenle `blur()` yapıyor. | **Test.** Yeni `tests/e2e/helpers/keyboard-dismiss.mjs` (`dismissKeyboardWithin`): eklenti içindeki odaklı alanı bırakır (gerçek bağışçının "Bitti"ye ya da boş alana dokunması gibi), sonra `data-dp-kb` ve `inert` kalkana kadar bekler. Süre dolarsa hata fırlatır, hata yutulmaz. `dp-form.mjs`: `dismissKeyboard` + `tapAction` eklendi. Şunlar `tapAction` üzerinden geçiyor: advanceToDetails, advanceToFinalStep, clickSubmit, touchPendingSubmit. `checks.mjs` clickAddToCartWithRetry: tıklamadan önce klavye kapatılıyor. `capture.mjs`: hata tetikleyici ve submit-fault (kapatma `t0`'dan önce yapılıyor, kilit süresi ölçümü değişmedi). `matrix-scenarios.mjs`: 3 tıklama. Süre, eşik ve `.catch` değişmedi. | e2e:full 128/0; iphone tek başına 52/0 |
| 2 | donor-fields-persist (desktop 4, android 2, iphone 3) | **12.4 telefon alanı yazarken ulusal biçimde grupluyor** (phone-logic.mjs `formatNational`: "5551234567" → "555 123 45 67"; v124-phone birleşmesi 0777110). Test ham dizge eşitliği bekliyordu. Siparişe giden veri zaten rakam tabanlı karşılaştırılıyor (place-order.mjs `digits()`), sunucu E.164'e çeviriyor. | **Test.** `assertDonorFieldsPersist` telefonu rakam dizisiyle karşılaştırıyor. Rakam eksik, fazla ya da boşsa yine hata veriyor; yalnız görüntüdeki boşluklara izin var. | Hata 9 → 0 |
| 3 | experiences-audit "tutar/bilgiler adımı" 12/12 (3 cihaz × popup/inline × 2). İlk koşu günlüğünde yoktu; e2e:matrix/experiences kapsamında bulundu | **Ürün.** Telefon ipucu (`p[data-dp-phone-note][hidden]`) için 758b331'de yer önceden ayrıldı: CSS `[hidden]` öğesini `display:flex/block` ile eziyordu. Denetim kuralı "`[hidden]` öğe display:none olmalı" bunu yakalıyor. Bu ayrıca temaya bağlı bir hata: `[hidden]{display:none!important}` kullanan temalarda ayrılmış yer siliniyor ve ipucu belirince kayma geri geliyor (tema bağımsızlığı ilkesi). | **Ürün.** Not öğesinde artık `hidden` yok (form.php). Görünürlük metne bağlı (`fields.css` `:not(:empty)`). `phone.mjs` yalnız metni yazıyor ya da siliyor. Hata ve not kuralları `:is()` ile birleştirildi; satır içi CSS gz tabandan küçük. | experiences 166 geçti / 0 hata; phone-field 9/9 |
| 4 | (bilgi) list.spec 48 hata | Ortam hatası: spec yanlış koşturucuyla (`e2e:experiences`) koşturuldu ve `wdp-list-sim` mu-plugin'i kurulmadı. Doğru koşturucu `run-list.mjs`. | Yok | run-list 54 geçti, 3 atlandı, 0 hata |

## Alınan teknik kararlar
- Kök neden 1 test tarafında düzeltildi, ürün değişmedi. 12.4'te onaylı sözleşme şöyle: telefonda klavye açıkken düğme gizli kalır, kullanıcı klavyeyi kapatınca geri gelir. Bunu experiences-instant ve ios/android-keyboard testleri doğruluyor. Test artık gerçek bağışçının adımını taklit ediyor (önce klavyeyi kapat, sonra dokun).
- Kaba işaretçili cihazda ekran klavyesi hiç açılmıyorsa (iPad + fiziksel klavye, Chromebook tablet kipi) bölüm alan odaktayken görünmez kalıyor. Kullanıcı boş bir yere dokununca geri geliyor; telefon kullanıcısını (%90+) etkilemiyor. Ürün düzeltmesi önerisi: odaktan sonra ~1 sn içinde klavye ölçülmezse `dismissed=true`. Bu yalnız "Kalan işler"e yazıldı, çünkü onaylı mobil davranışı değiştirir.
- Telefon gruplama yasal: ekranda gösterim biçimi, kayıtta rakamlar ve E.164.
- Telefon notu `[hidden]` yerine `:empty` ile gizleniyor: `[hidden]` = display:none sözleşmesi korunuyor, temadan bağımsız. `:has` desteklemeyen tarayıcıda not boş bir `<p>` oluyor, görünür bir etkisi yok.

## Kanıt (yerel, port 9088, tek Playwright süreci, worker 1)
| Koşu | Sonuç |
|---|---|
| e2e:full (son, birleşik taban) | 128 geçti, 0 atlandı, 0 hata. Karantina addon-custom-popup geçti |
| e2e:matrix (8 yapılandırma × 3 cihaz) | son kod üzerinde yeniden koşu: 24 satır, 264 geçti, 0 hata |
| experiences (varsayılan) | 166 geçti, 23 atlandı, 0 hata (önce 12 hata) |
| kurgu-matrix / direct-pay / compact-card / phone-field / list | 31 / 45 / 52 / 9 / 54 geçti, hepsi 0 hata |
| verify | EXIT 0 (Semgrep, PHPCS, PHPStan, Plugin Check, lint, analyse:security yeni 0) |
| test | PHPUnit 909 OK; node 883 geçti / 0 hata. Bir koşuda ship-health-local "wdp_db_version yazılmadı" düştü (yerel WP durumu, değişiklikle ilgisiz); tek başına 2/2 ve tam koşu 883/0 yeniden yeşil |

## Hız (measure:plugin-perf yerel tt5, --no-lh; önce = ikram-ortam dosyaları, sonra = son durum)
| sayfa | satır içi CSS gz önce → sonra | JS gz | ana iş ms medyan önce → sonra | CLS | dokunuş→panel |
|---|---|---|---|---|---|
| popup | 7776 → 7770 | 11799 = | 2.4 → 2.4 | 0 | 32 → 31 |
| bagis-urunu-tutar | 7776 → 7770 | 15559 = | 6.6 → 6.9 [6.9,5.9,6.9] | 0 | — |
| kampanya-urunu | 8301 → 8297 | 19574 = | 9.9 [9.9,14.8,9.5] → 10.6 [16.7,8.7,10.6] | 0 | — |
| sayfa-ici-form | 7776 → 7770 | 11799 = | 5.7 → 6.6 [4.7,6.6,6.6] (önceki ara koşular 5.5/5.6) | 0 | — |
| bagis-listesi | 8908 → 8909 | 3760 = | 1.4 → 1.2 | 0 | 31 → 31 |
| compact-kart | 6325 → 6317 | 6299 = | 1 → 1 | 0 | — |
- Ölçüt: 171 geçti, 0 kaldı (önce de 0 kaldı).
- Bayt değişimi ilk yüklemede yalnız satır içi CSS'te: −4 ile −8 B gz arası. Liste sayfasındaki +1 B, ui-fields yüzeyinin farklı sıkıştırma bağlamından geliyor.
- JS ilk yük baytları değişmedi. phone.mjs yalnız tembel telefon paketinde küçüldü.
- Ana iş ms farkları koşular arası dağılım içinde: aynı sayfa için ara koşularda 5.5, 5.6 ve 10.0 ms ölçüldü. Eklentinin ilk yüklenen JS'sine dokunulmadı. Kesin kanıt istenirse eşli ölçüm `--lh` olmadan tekrar koşulabilir.

## Ayar/rehber
Gerek yok. Yönetici ayarı ya da kullanıcıya görünen davranış değişmedi; telefon ipucu aynı yerde, aynı metinle görünüyor.

## Değişen dosyalar
- Test: tests/e2e/helpers/keyboard-dismiss.mjs (yeni), dp-form.mjs, capture.mjs, checks.mjs, matrix-scenarios.mjs
- Ürün: assets/src/ui2-shared/fields.css, assets/src/ui2-shared/phone.mjs, templates/donation-panel/experiences/form.php
- Çeviri/paylaşılan dosyaya dokunulmadı. `npm run build` languages/woo-donation-popup-tr_TR.po dosyasında 2 satırlık bir yan değişiklik üretiyor; her seferinde geri alındı.

## Kalan işler
1. (Öneri, iş kararı) Fiziksel klavyeli dokunmatik cihazda alt bölüm: klavye ~1 sn içinde ölçülmezse görünür olsun. Değişecek yer: layer.mjs `onFieldFocus` + experiences-instant sözleşme testi.
2. Uzak doğrulama (remote-smoke iki site) Claude'da.

---

# Ek görev: fiziksel klavyeli dokunmatik cihaz (kullanıcının yöntemi)

## Ne yapıldı
`assets/src/experiences/keyboard.mjs` ve `layer.mjs` değişti; ayar yok, davranış otomatik.

1. **Birincil işaret: yazma var, görünür alan küçülmemiş.** Alan odaktayken `input` ya da `keydown` gelir ama visualViewport küçülmemişse (küçülme < 80 px, `typedWithoutKeyboard`), fiziksel klavye sayılır. Alt bölüm tek seferde görünür. Sanal klavyede yazma ancak görünüm küçüldükten sonra olur, o yüzden bu koşul sağlanmaz ve davranış eskisi gibi kalır.
2. **Destek: `navigator.virtualKeyboard`.** Yalnız `geometrychange` dinleniyor; `overlaysContent`'e dokunulmuyor. Kaynak MDN: olay klavye gösterilip gizlenince ateşlenir, API deneysel ve yalnız güvenli bağlamda çalışır. Yükseklik > 0 bildirilirse sanal klavye görülmüş sayılır.
3. **Yedek zamanlayıcı: hiç yazılmadıysa NO_KEYBOARD_MS = 2000 ms.**
   - Görünüm 400 ms içinde yeniden boyutlandıysa karar ertelenir.
   - Oturumda bir kez sanal klavye görüldüyse (görünüm küçüldü ya da API bildirdi) zamanlayıcı o oturumda kullanılmaz.
   - Fiziksel klavye bilgisi katman ömrü boyunca tutulur; alan değiştirince düğmeler yeniden gizlenmez.
   - Gerçek klavye ölçülünce bu bilgi sıfırlanır.

## Süre seçimi ve emülatör
- Emülatör bu oturumda başlatılamadı. `emulator -avd wdp-pixel7-a35 -sysdir …` korumalı alanda (sandbox) rc=139 ile çöktü. Korumalı alan dışında çalıştırma izni otomatik onaylayıcı tarafından reddedildi.
- Bu yüzden gerçek açılış ölçümü yok. 2000 ms, önerilen 1,5–2 sn aralığının üst sınırı; yavaş klavyede düğmeyi erken göstermemek için seçildi.
- Ölçümü kolaylaştırmak için `gercek-android.spec` güncellendi:
  - İzde artık `kbOpen {firstMs, settledMs, steps}` var: ilk alana dokunuştan görünüm küçülmesine kadar geçen süre.
  - `kbLogFields` iddiası eklendi: sanal klavyede alanlar arasında alt bölüm hiç görünmez, durum izi tek değer.
  - Klavye `WDP_ANDROID_IME` ile seçilebiliyor.
- Ana oturumun çalıştıracağı komutlar (Playwright ile aynı anda çalıştırmayın):
  - Gboard (cihaz varsayılanı): `npm run e2e:android`
  - AnySoftKeyboard: `WDP_ANDROID_IME=com.menny.android.anysoftkeyboard/.SoftKeyboard npm run e2e:android`
  - Ölçülen `kbOpen.settledMs` 2000'e yakın ya da üstündeyse sabit güncellenmeli.

## Kanıt (yerel, port 9088)
| Koşu | Sonuç |
|---|---|
| android-keyboard (android) | 10/10. visual/content kare izi 1. Fiziksel klavyede görünme gecikmesi 6 ms, yazmayla. Yazmasız modda 2001 ms, yedek zamanlayıcıyla. Yavaş klavye 4 mod (1 sn tek adım, 0,5→1,7 sn 7 adım, content 1 sn, 1,8 sn): düğme hiç görünmedi, durum izi `[true]` |
| ios-kb (iphone, iPhone 13/SE) | 10/10. Kare izi 1. Fiziksel klavyede gecikme 5–7 ms. Yazmasız modda 2001 ms |
| experiences | 166 geçti / 0 hata (experiences-instant sözleşmesi dahil) |
| e2e:full | 128 / 0 |
| verify / test | yeşil; PHPUnit 909 OK; node 886/0 (yeni birim testleri: typedWithoutKeyboard, keyboardPresence, noKeyboard) |
| measure:plugin-perf | 171 geçti / 0 kaldı |

## Hız etkisi (yeni özellik, onaylı)
- Formlu sayfalarda ilk yük JS: 11799 → 12134 B gz (+335 B; layer.mjs ek mantığı). Bütçe ~25 KB'nin içinde.
- Satır içi CSS değişmedi.
- Ana iş ms (koşular arası dağılım içinde):

| sayfa | önce | sonra |
|---|---|---|
| popup | 2.4 | 2.9 |
| sayfa-ici-form | 5.7 | 6.5 |

- Eşli ölçümle gürültü olduğu ayrıca kanıtlanmadı.
- Kural yorumu Claude'da: onaylı yeni işlev bayt ekliyor. Bayt azaltmak istenirse VirtualKeyboard dinleyicisi çıkarılabilir; işaret 2 olmadan da çalışır.

## Ayar/rehber
Gerek yok: ayar ve yönetici ekranı yok, cihaz algısı otomatik. Rehbere bir cümle eklenebilir ("fiziksel klavyeli tablette düğmeler ilk tuşta görünür"); bu docs/rehber birleştirmesi Claude'da.
