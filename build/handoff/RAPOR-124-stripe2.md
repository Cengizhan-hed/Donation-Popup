# RAPOR 124-stripe2 — Stripe: blok ödeme sayfası, GBP, EUR (dal v124-stripe2)

Yalnız yerel WP. Uzak komut yok. Anahtar değerleri okunmadı/yazdırılmadı (yalnız `run-stripe.mjs` içinde ortamdan).
Geçit: WooCommerce Stripe Payment Gateway 11.1.1, TEST modu; `stripe listen` → `/?wc-api=wc_stripe`. Spec: `stripe-payments.spec.mjs`
(compact spec'e dokunulmadı). Tema twentytwentyfive, HPOS açık.

## Sonuç
| Koşu | Ödeme sayfası | Para birimi | Cihaz | Sonuç | Webhook (iletilen / HTTP 200) |
|---|---|---|---|---|---|
| a | **Blok** | TRY | iphone + android + masaüstü | **36/36** (3 ayrı kesintisiz koşu, 12'şer) | 3 × 36 / 36 |
| b | Klasik | **GBP** | iphone + android + masaüstü | **36/36** (tek kesintisiz koşu, 26.5 dk) | 108 / 108 |
| c | Klasik | **EUR** | masaüstü | **12/12** | 36 / 36 |
| (önceki, 124-stripe) | Klasik | TRY | 3 cihaz | 45/45 (compact dahil) | 129 / 129 |

Kesintisiz kanıtı: sayılan tüm koşularda PHP sunucusu yeniden başlatması 0. Dışarıdan kesilen iki koşu **sayılmadı**, yeniden koşuldu:
iPhone blok (başka ajanın `pkill -f playwright` çağrısı) ve EUR ilk koşu (port 9074, wt-124-email4-base ile çakıştı; iki taraf birbirinin
PHP sunucusunu kapattı → `ECONNREFUSED` ve "There was an error processing your order"). Son iPhone blok koşusu port 9095'te yapıldı.

## Senaryo × ödeme sayfası × para birimi (3 koşuda da aynı sonuç)
| Senaryo (sepetli / doğrudan) | Sipariş durumu | payment_complete / ödenmiş geçiş / teşekkür | Kampanya toplamı | Tutar biçimi (teşekkür + e-posta) | E-posta |
|---|---|---|---|---|---|
| Başarılı 4242 | processing | 1 / 1 / 1 | +125, bir kez | TRY `₺125` · GBP `£125.00` · EUR `125,00 €` | müşteri + yönetici (2), ad/telefon/not Türkçe karakterli |
| 3DS tamam | processing | 1 / 1 / 1 | +140 | — | — |
| 3DS red | failed | 0 / 0 / – | 0 | — | — |
| Reddedilen kart → aynı sayfada 4242 | processing (aynı sipariş) | 1 / 1 | +160 | hata metni görünür | — |
| Yarıda bırakma (3DS "İptal") | failed | 0 | 0 | — | — |
| Gecikmeli teyit (istemci doğrulaması kesilir) | pending → processing (webhook işleyicisi) | 1 / 1 / 0 | +180, bir kez | — | — |

Toplam kuralı (her testte): artış = o aralıkta ödenen siparişlerin bağış tutarı, her biri bir kez. Bağışçı sayısı = ödenen sipariş
sayısı. Canlı ilerleme çubuğu ödeme sonrası yeni toplamı mağaza ayraçlarıyla gösterdi (₺1.250 / £1,250.00 / 1.250,00 €).
Blok ödeme sayfasında ödeme öğesi, 3DS, hata bildirimi (blok bildirim şeridi) ve doğrudan bağışın order-pay sayfası sorunsuz çalıştı.

Ağ koruması: yalnız birinci taraf + Stripe alan adları geçti. Engellenenler: `r.stripe.com`, `m.stripe.com` (ölçüm), `hcaptcha.com`.
GBP'de 1 testte `client.px-cloud.net` (Stripe Link'in Birleşik Krallık'ta yüklediği bot koruması) da engellendi; ödeme etkilenmedi.

## Bulunan hatalar
- **Eklentide yeni hata yok.** Para biçimi (simge konumu, binlik/ondalık ayraç, ondalık sayısı) teşekkür özetinde, Woo sipariş
  ayrıntısında, e-postalarda ve canlı çubukta mağaza ayarıyla uyumlu.
- Geçitten gelen (bilgi): kartlı ödemede webhook teyidi 2 dk ertelenir ve sipariş 5 dk kilitli kalır (124-stripe raporunda da var).
  Gecikmeli teyit testinde kilidin süresi yerel uçla dolmuş sayılıyor (`lockExpiredSimulated: true`).
- Altyapı: paralel ajanlarda port çakışması (9074) karşılıklı sunucu öldürmeye yol açtı. Öneri: GOREV tariflerinde port ataması
  tek yerden yapılsın ya da `freeListenPort` yalnız kendi PID'ini kapatsın (CLAUDE.md'deki yeni süreç kuralıyla uyumlu).

## Test değişikliği (yalnız test)
- `stripe-flow.mjs`: `moneyPattern(store, amount)` — Woo para biçimi deseni (ayraçlar, ondalık, simge konumu; boşluk/nbsp esnek).
- `stripe-payments.spec.mjs`: başarılı senaryoda biçimli tutar teşekkür sayfası + teşekkür özeti + her e-postada denetlenir.
  Canlı çubuk değeri mağaza ayraçlarıyla çözülür (önceki `[^0-9]` ayıklaması GBP/EUR'da kuruşları yutuyordu).

## Anahtar sızıntısı taraması
`node tests/e2e/stripe-leak-scan.mjs`: 62 kaynak (dal farkı, izlenmeyen dosyalar, raporlar, listen/PHP günlükleri, işçi wc-logs ve
kanca günlükleri) → **0 eşleşme**.

## Ayar/rehber
Davranış değişmedi; gerek yok.

## Hız
Ön yüz kodu değişmedi (yalnız test), ölçüm gerekmedi.

## Kanıt dosyaları
`build/handoff/RAPOR-124-stripe/results-{try-blocks,gbp-classic,eur-classic}.jsonl` (cihaz başına tekil senaryo kaydı, kişisel veri yok),
`listen-*.json` (webhook sayıları).

## Kalan işler
- Blok ödeme × GBP/EUR çapraz koşusu yapılmadı (iki eksen ayrı ayrı yeşil). İstenirse: `--checkout blocks --store gbp`.
- Gerçek cihazda iOS Safari 3DS görsel kanıtı kullanıcıda.
