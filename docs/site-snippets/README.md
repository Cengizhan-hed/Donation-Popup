# Site snippet'leri (siteye özel köprüler)

Donation Panel çekirdeği hiçbir çoklu para birimi/dil eklentisini tanımaz; yalnız WooCommerce'in etkin para birimini ve belgelenmiş filtreleri kullanır. Bu klasördeki dosyalar, kullanan sitenin kendi koduna (Code Snippets) yapıştıracağı köprülerdir. Eklenti paketine girmez, eklentiyle kurulmaz.

## Çekirdeğin sunduğu filtreler

| Filtre | İmza | Varsayılan |
|---|---|---|
| `wdp_order_exchange_rate` | `( ?float $rate, $order, string $currency, string $base )` | `null` (kur bilinmiyor) |
| `wdp_progress_live_rate` | `( ?float $rate, string $currency, string $base )` | `null` |
| `donation_panel_convert_amount` | `( float $amount, string $from, string $to, array $context )` | tutar aynen (dönüşüm yok). Eski ad `wdp_convert_amount` hâlâ çalışır; snippet yalnız birine bağlanmalı |
| `wdp_client_context` | `( array $context )` | çerez/olay listeleri boş, genel seçiciler |

Kur ve dönüşüm yoksa, farklı para birimli bir siparişin tutarı ilerleme çubuğuna eklenmez (yanlış toplam yerine eksik toplam).

## curcy-bridge.php (Curcy / WOOCS / WPML)

Kurulum
1. Code Snippets > Yeni ekle. `curcy-bridge.php` içeriğini, ilk satırdaki `<?php` HARİÇ yapıştırın.
2. "Her yerde çalıştır" seçin, kaydedip etkinleştirin.

Test (yalnız görüntüleme, sipariş verilmez)
1. Ana para biriminden farklı bir Curcy para birimi seçin (değiştirici ile).
2. Bağış düğmesine dokunun: panelde tutarlar seçilen para biriminde görünmeli; para birimini değiştirince panel yeniden oluşmalı.
3. İlerleme çubuğunda toplanan tutar ana birimde görünmeli (farklı para birimli eski siparişler siparişin kuruyla çevrilir).

Geri alma: snippet'i devre dışı bırakın. Eklenti çalışmaya devam eder; yalnız farklı para birimli siparişler ilerleme toplamına eklenmez ve panel para birimi değişimini çerezden izlemez (sayfa yenilenince doğru görünür).

## Curcy `wmc_order_info` uyum notu (2026-10-25)

- Köprü `wmc_order_info[<KOD>]['rate']` okur. Curcy'nin siparişe yazdığı yapı: kod anahtarlı dizi (`rate`, `decimals`, `pos`, `custom_symbol`, `is_main` ...); `rate` = 1 ana birim kaç sipariş birimi eder (ana birim 1). Yön, çekirdeğin beklediğiyle (ana = sipariş / rate) uyumlu.
- Kaynak koda/belgeye erişilemedi (context7'de Curcy yok, yerelde eklenti yok); yukarıdaki bilgi bilinen yapıdan, kesin değil. Doğrulama: `scripts/staging-progress-report.mjs` çıktısındaki `order_meta` (wmc_order_info var mı, para birimi anahtarı var mı, rate==1 sayısı) ve `curcy_live_list`.
- Şüphe: EUR için `converted_sum == line_total_sum` ise (a) `wmc_order_info[EUR].rate` siparişte 1 yazılmış olabilir, (b) sipariş para birimi/`get_woocommerce_currency()` Curcy ile aynı kodu döndürüyor olabilir, (c) satır tutarları zaten ana birimde saklanmış olabilir. `rate_source` ve `rate_min/max` hangisi olduğunu ayırır.

## Tutar dönüşümü notu (CURCY3, 2026-10-25)

- Bağışçının seçili birimde (örn. EUR) yazdığı tutar sepete mağaza ana biriminde (TRY) konur: `ana = tutar / oran`; Curcy gösterirken geri çevirir, böylece 100 EUR sepette/ödemede/siparişte 100 EUR kalır. Önceki köprü bu dönüşümü yapmıyordu (100 yazılan 2 EUR oluyordu).
- Köprü artık `donation_panel_convert_amount` adına bağlanır. Sitede eski köprü (`wdp_convert_amount`) kuruluysa içeriğini bu klasördeki güncel dosyayla DEĞİŞTİRİN (iki köprüyü birlikte açmayın).
- Kampanya toplamı: ana birim `woocommerce_currency` ayarından okunur (etkin para birimi EUR iken EUR siparişler artık ana birime çevrilir).
