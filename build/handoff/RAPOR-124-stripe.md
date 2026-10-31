# RAPOR 124-stripe — Stripe TEST modu, yerel uçtan uca (dal v124-stripe)

Yalnız yerel WP (build/e2e/matrix işçisi, port 9066). Uzak komut/ssh/--env≠local YOK; uzak sitelere Stripe yapılandırması gitmedi.
Resmi **WooCommerce Stripe Payment Gateway 11.1.1** (wordpress.org zip'i `build/e2e/matrix/_cache`, repo/zip dışı), TEST modu,
anahtarlar `.env.stripe.local`'dan yalnız betik içinde (değer hiçbir yere yazılmadı), `stripe listen` (CLI 1.55.6) → `/?wc-api=wc_stripe`.
Mağaza: TRY (matrix `try`), tema twentytwentyfive, klasik ödeme, HPOS açık.

## Sonuç (özet)
- **Stripe spec'leri: 45/45 yeşil** (15 senaryo × iphone + android + masaüstü; 30.6 dk; `run5`).
- **Bulunan gerçek hata (eklentimiz, DÜZELTİLDİ):** doğrudan (sepetsiz) bağışta e-posta sorulmuyordu → order-pay sayfası fatura
  sormadığı için Stripe ödemesi `Missing required customer field: email` ile **failed**; bağışçıya "Failed order" e-postası gitti, para alınamadı.
  Ayrıca kart düğmesi tıklanınca sessizce hiçbir şey olmuyordu (geçidin istemci doğrulaması). Düzeltme geçide özel değil: doğrudan akışta
  e-posta alanı her zaman zorunlu (WooCommerce ödeme formundaki `billing_email` standardıyla aynı).
- Webhook: 129 olay iletildi, 129 × HTTP 200 (payment_intent.succeeded 33, charge.succeeded 33, requires_action 39, payment_failed 18, charge.failed 6).
- Anahtar sızıntısı taraması: **0 eşleşme** (ayrıntı aşağıda).

## Senaryo tablosu (her satır 3 cihazda aynı sonuç; `build/handoff/RAPOR-124-stripe/results-try-classic.jsonl`)
| Senaryo | Akış | Sipariş durumu | payment_complete / ödenmiş geçiş / teşekkür kancası | Kampanya toplamı | Not |
|---|---|---|---|---|---|
| Başarılı (4242) | sepetli | processing | 1 / 1 / 1 | +125 (bir kez) | teşekkür özeti 1 kez; canlı çubuk + REST yeni toplam; e-posta müşteri+yönetici, ad/telefon/not Türkçe karakterli |
| Başarılı (4242) | doğrudan | processing | 1 / 1 / 1 | +125 | aynı denetimler |
| 3DS tamam (3155) | sepetli / doğrudan | processing | 1 / 1 / 1 | +140 | — |
| 3DS red | sepetli / doğrudan | failed | 0 / 0 / – | 0 | görünür hata, düğme kilitli değil |
| Reddedilen kart (0002) → aynı sayfada 4242 | sepetli / doğrudan | processing (aynı sipariş) | 1 / 1 | +160 | "The card was declined" görünür; ek ödenmemiş sipariş 0 |
| Yarıda bırakma (3DS penceresi "İptal") | sepetli / doğrudan | failed | 0 | 0 | yeniden bağış formu sorunsuz; doğrudan akışta bekleyen (pending) sipariş ≤1 |
| Gecikmeli teyit (istemci doğrulaması kesilir) | sepetli / doğrudan | pending → processing **webhook işleyicisiyle** | 1 / 1 / 0 | +180 (bir kez) | teşekkür sayfası görülmediği için teşekkür kancası 0 (beklenen) |
| Compact kart, çerçeveli ödeme 4242 | doğrudan | processing | 1 / 1 / 1 | +210 | iframe (order-pay `donation_panel_embed=1`) içinde Payment Element |
| Compact kart, çerçevede 3DS | doğrudan | processing | 1 / 1 / 1 | +220 | 3DS sınaması iç içe çerçevede |
| Compact kart, çerçeve kapatılır → yeniden aç, öde | doğrudan | 1 sipariş, processing | 1 | +230 | kapatınca ödenmez, toplam artmaz |

Toplam kuralı (her testte): artış = o aralıkta ödenmiş duruma geçen siparişlerin bağış tutarı, her biri bir kez (`expectRaised`); bağışçı
sayısı artışı = ödenen sipariş sayısı. Ödenmemiş (failed/pending) hiçbir sipariş toplama girmedi.

Ağ koruması: yalnız birinci taraf + `stripe.com / stripe.network / stripecdn.com` geçti; engellenen: `r.stripe.com`, `m.stripe.com`
(ölçüm), `hcaptcha.com` (Stripe'ın gömdüğü üçüncü taraf) — 36 testte 0 başka üçüncü taraf. İzin yalnız yerel tabanda (`applyLocalThirdPartyAllowlist` yerel olmayan hostta hata verir).

## Alınan teknik kararlar
1. **Doğrudan bağışta e-posta zorunlu** (`Form_Context::require_email`): alan kapalıysa telefondan sonra eklenir, açıksa zorunlu yapılır;
   sepetli akış değişmez. Sunucu doğrulaması aynı modelden (Field_Validator/Cart_Data) — ek kod yok. Gerekçe: order-pay fatura sormaz;
   WooCommerce ödeme formunda e-posta standart zorunlu alan; kartlı ödeme ve sipariş e-postaları ister. Geçide özel kod yok.
   (Sayfa HTML'i kullanıcıya özel olamayacağı için girişli kullanıcıda da alan görünür; `autocomplete=email` doldurur. REST'te girişli
   bağışçı e-postayı boş gönderirse hesap e-postası kullanılır — `Direct_Donation_Controller::input`.)
2. Gecikmeli teyit sınaması: geçit kartlı ödemede `payment_intent.succeeded` işlemesini **2 dk erteler** ve sipariş **5 dk ödeme kilidi**
   tutar (geçit tasarımı). Yerel işçide `DISABLE_WP_CRON` olduğundan test, WP-Cron'un işini yapan yerel uç (`?dp_stripe_cron=1`) çağırır ve
   20 sn sonra kilidin süresini dolmuş sayar (`dp_expire_lock`; gerçekte ≤5 dk bekleme). Sonuç: durum webhook işleyicisinden processing.
3. Stripe Elements `fill()` ile "tamamlanmış" saymaz → tuş tuş yazım; "Link" bölümü odak değişince düğmeyi kaydırır → düğme görünür alana
   alınıp konumu durulunca tıklanır (yalnız test sürücüsü).
4. Koşucu Playwright'ı eşzamansız başlatır: `spawnSync` olay döngüsünü kilitleyince `stripe listen` borusu doluyor ve ~10 dk sonra webhook
   yönlendirmesi duruyordu (ilk 3 cihazlı koşuda 8 hata bu yüzdendi).
5. Kurulum PHP'si `tests/local-wp/stripe-setup.php` (yerel-WP-özel klasör; `tests/e2e/helpers` altında `update_option` yasağı testi korunur).

## Kanıt (sayılarla)
- Stripe e2e: 45/45 (iphone 15, android 15, masaüstü 15). Önceki koşular: run1 3/12, run2 10/15, run3 7/8, run4 37/45 (listen borusu) → düzeltmeler.
- `npm run test`: JS 842 geçti / 0 hata (1 atlanan, önceden), PHPUnit 822 test / 4920 doğrulama OK (yeni: `test_direct_requires_the_donor_email_and_cart_flow_is_unchanged`).
- PHPCS (değişen 3 PHP dosyası): 0. ESLint (yeni/değişen JS): 0.
- Etkilenen mevcut e2e (doğrudan akış testleri zorunlu e-postayı doldurur): `direct-pay|compact-card|console-clean` 3 cihaz **68 geçti / 4 atlandı / 0 hata**;
  `kurgu-matrix` masaüstü **11/11**. `kurgu-matrix` mobilde (android 6/10, iphone) popup/side_panel/bottom_sheet satırları **sepetli dahil** 2 dk zaman aşımı —
  sepetli akış bu değişiklikten etkilenmez (Form_Context yalnız `direct=true` dalında değişti), yani bu işten bağımsız/önceden var; aynı anda
  başka bir ajan (wt-124-c1-base) kurgu-matrix iphone taban koşusu yapıyordu. Claude'un ayrıca değerlendirmesi önerilir.
- `npm run test:integration`: 58 test / 714 doğrulama OK (DirectDonationTest istek yardımcısı e-posta gönderir; girişli bağışçı boş e-postada hesap e-postası).
- `npm run verify`: **çıkış 0** (build, smoke, lint, i18n, paket, entegrasyon, plugin-check, güvenlik analizi).

## Anahtar sızıntısı taraması
`node tests/e2e/stripe-leak-scan.mjs` (desen `(sk|pk|rk)_(test|live)_…`, `whsec_…`; değer yazdırmaz): dal farkı (merge-base'den) + izlenmeyen
dosyalar + bu rapor + `RAPOR-124-stripe/` + listen/PHP günlükleri + işçi wc-logs/kanca günlüğü → **18 kaynak, 0 eşleşme**. Çalışma
çıktıları (scratch günlükleri) ayrıca tarandı: 0. `stripe listen` çıktısı yazılmadan önce maskelenir; Playwright/PHP sunucusu
`STRIPE_*` ortam değişkenlerini görmez; geçit günlüğü kapalı (`logging=no`).

## Bulunan diğer konular (eklentimiz dışı / bilgi)
- Geçit (Stripe 11.1.1): kartlı ödemede webhook teyidi 2 dk ertelenir + 5 dk kilit — istemci dönmezse sipariş en geç ~5–7 dk sonra
  ödenmiş olur (WP-Cron çalışıyorsa). Canlı sitede WP-Cron'un (ya da sunucu cron'unun) çalıştığı doğrulanmalı.
- Stripe test hesabında "link" ödeme yöntemi etkin değil uyarısı (konsol) — geçit/hesap ayarı.
- Sipariş kalemi meta etiketleri (Bağışçı Adı/Telefonu…) İngilizce sitede Türkçe kalıyor (124-mail bulgusuyla aynı; bu işte dokunulmadı).

## Ayar/rehber güncellemesi
- Ayar: Sepet ve ödeme → Bağışçılar nasıl öder → "Skip the cart (direct donation)" açıklamasına cümle eklendi (e-posta zorunlu, nedeni).
- Rehber: Bağış Paneli → Rehber → "Turning on direct donation" bölümüne "Email: …" maddesi.
- Çeviri: `languages/parts/124-stripe.po` (4 dizge; TR). Birleştirme Claude'da.
- Test: ayarda görünen = uygulanan (`DirectBehaviorTest`: açıklama + Rehber metni + model zorunlu alanı).

## Hız
Ön yüz CSS/JS değişmedi; yalnız doğrudan akışta form HTML'ine bir alan (≈300 bayt) eklenir, sepetli akışta HTML aynı.
`measure:plugin-perf` gerekmedi (görev tarifi: ön yüz kodu değişmiyorsa).

## Birleştirme notu
- package.json önerisi: `"e2e:stripe": "node tests/e2e/run-stripe.mjs"`, `"stripe:leak-scan": "node tests/e2e/stripe-leak-scan.mjs"`.
  Kullanım: `npm run e2e:queue -- node tests/e2e/run-stripe.mjs [--project desktop] [--checkout blocks] [--store gbp] [--grep <ad>]`.
  Anahtar yoksa: "ATLANDI" (çıkış 0); `sk_test_` değilse (ör. `sk_live_`) hiçbir şey yapmadan durur (çıkış 3).
- i18n: `languages/parts/124-stripe.po` → `i18n:merge/mo/json`.
- Diğer ajanların doğrudan akış testleri (direct-pay, kurgu-matrix, console-clean) zorunlu e-postayı dolduracak şekilde güncellendi;
  yeni doğrudan akış testleri de `donation_email` doldurmalı.

## Kalan işler
- Blok ödeme (`--checkout blocks`) ve GBP/EUR mağaza koşusu yapılmadı (koşucu destekler; süre nedeniyle). Öneri: faz sonunda bir kez.
- Gerçek cihazda (iOS Safari) 3DS görsel kanıtı kullanıcıda.
- Canlıda Stripe webhook uç noktası + imza sırrı yapılandırması (kullanıcı; kritik kapı).
