# RAPOR 121-themeindep (dal v121-themeindep)

## Tarama tablosu (tests/e2e; tema/oluşturucu seçicileri)
| Dosya | Seçici | Karar |
|---|---|---|
| capture.mjs settle | `.fusion-*` animasyon, `.fusion-header*` | profile.selectors.animated / header (varsayılan `header`) |
| capture.mjs benzer-bağış | `.fusion-title`, `.fusion-fullwidth`, `.fusion-post-cards` | profile.selectors.headings / sectionRoots / loopCards; varsayılan yalnız Woo/WP |
| capture.mjs, matrix: stabilize | `.fusion-image-wrapper`, `.fusion-animated`, `.awb-*` | stabilize-shot-css.mjs'den çıktı -> profile.selectors.stabilizeCss (yalnız staging-hedef) |
| similar-donations-probe, css-hide-source | `.fusion-*`, `.ct-headline`, `.elementor-section` | profil/opts (headingSel, sectionSel) |
| loop-cards, product-page-ui | `.fusion-title`, `.fusion-post-cards` | kaldırıldı |
| matrix-scenarios, run-conflicts | `.site-title`, `.main-navigation`, `#site-navigation`, `.site-footer` | `h1`/`nav`/`footer` |
| selectors.mjs:90 | `.elementor-widget-whatsapp` | KALDI: üçüncü taraf yüzen sohbet maskesi (ekran görüntüsü maskesi, tema değil); ileride profile taşınabilir |
| elementor-compat.mjs, run-elementor-compat, elementor-pro-compat.spec | elementor-* | KALDI: Elementor uyumluluk katmanının kendi testi (§0 ince katman) |
| conflicts.mjs 747/881 | blocksy/Avada URL'leri | KALDI: sahte çakışma verisi, seçici değil |
| matrix.json, quality-env | tema slug'ları | KALDI: ortam/matris tanımı (profil niteliğinde) |
| Woo çekirdek (`.wp-block-woocommerce-*`, `li.product`, `.woocommerce-*`) | | KALDI: WooCommerce standardı |

## Alınan teknik kararlar
- popup kabuğu işi (capture.mjs shellJobs) artık `pagePath: rel` (ürünün kendi sayfası); liste/sekme sayfası yalnız liste testlerinde. `activateAriaTabFor` genel ARIA'dır, yedek olarak kaldı (tema adı yok).
- Profile yeni anahtarlar: selectors.headings, sectionRoots, stabilizeCss (staging-hedef; ikram/local varsayılan).

## Kanıt
- lint:js 0 bulgu; JS birim 756 test: 755 geçti, 0 kalan, 1 atlandı.
- e2e:full local: android 37, desktop 39, iphone 41 (+mut 1, mut2 10): Geçti=128 Atlandı=0 Hata=0, 125.5 sn. e2e:matrix 12/12 (her hücre 11/0/0).
- Uzakta beklenen: popup-custom-open / popup-custom-errors-assert artık ürün sayfasında (Zekat sekme sorunu yok); staging baseline'ları (stabilize CSS profilden aynı kurallar) değişmemeli. Doğrulama Claude'da.

## Kalan işler
- selectors.mjs WhatsApp maskesi profile taşınabilir (düşük öncelik).
