# Site snippet'leri (siteye özel köprüler)

Donation Panel çekirdeği hiçbir çoklu para birimi/dil eklentisini tanımaz; yalnız WooCommerce'in etkin para birimini ve belgelenmiş filtreleri kullanır. Bu klasördeki dosyalar, kullanan sitenin kendi koduna (Code Snippets) yapıştıracağı köprülerdir. Eklenti paketine girmez, eklentiyle kurulmaz.

## Çekirdeğin sunduğu filtreler

| Filtre | İmza | Varsayılan |
|---|---|---|
| `wdp_order_exchange_rate` | `( ?float $rate, $order, string $currency, string $base )` | `null` (kur bilinmiyor) |
| `wdp_progress_live_rate` | `( ?float $rate, string $currency, string $base )` | `null` |
| `wdp_convert_amount` | `( float $amount, string $from, string $to, array $context )` | tutar aynen (dönüşüm yok) |
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
