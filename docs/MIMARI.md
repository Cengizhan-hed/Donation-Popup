# MIMARI — woo-donation-popup (10.35.1)

Kalıcı mimari harita. Sonraki görevler için ilk okuma noktası.  
Dal referansı: `docs-mimari` / commit `220f4ec`.  
Kural: her iddia `dosya:satır`; emin olunmayan yerler **DOĞRULANMADI**.

---

## a) Klasör yapısı ve ana dosya sorumlulukları

| Yol | Sorumluluk | Kanıt |
|-----|------------|-------|
| `woo-donation-popup.php` | Giriş: sabitler, aktivasyon/deaktivasyon, bootstrap | `woo-donation-popup.php:25-56` |
| `uninstall.php` | `wdp_delete_data_on_uninstall=1` ise `WDP_Uninstall::cleanup_site`: eklenti option/transient + ürün meta (açık liste + `wdp_`/`_wdp_`/`_enable_`/`_sadaka_`/`_theme_` önekleri, yalnız `product`/`product_variation`); sipariş/HPOS dokunulmaz | `uninstall.php` + `includes/class-uninstall.php` |
| `includes/` | PHP çekirdek, admin, trait, config, şablon sınıfları | `includes/class-woo-donation-popup.php:45-64` |
| `includes/bootstrap/` | HPOS, bağımlılık, sürüm, legacy frontend | `includes/bootstrap/class-plugin-bootstrap.php:21-122` |
| `includes/config/` | JS/CSS stack, stil paketleri, form modül sırası | `includes/config/frontend-js-stack.php`, `includes/config/frontend-css-stack.php` |
| `includes/traits/` | AJAX / assets / utils parçaları | `includes/class-ajax.php:12-27` |
| `includes/templates/` | Modal kabuk, alan, kampanya header, SVG | `tools/file-descriptions.json` (satır 76–79) |
| `src/Modules/EntryPoints/` | Giriş noktaları modülü (E1): kısa kod, blok, otomatik yerleşim, yedek düğme, ürün çözücü, Elementor ince katmanı (`Elementor/`) | bkz. "Giriş noktaları modülü (E1)" |
| `includes/compat/` | Uyumluluk: `class-compat-loader.php` (boş kayıt; K8: para birimi bağdaştırıcıları çekirdekten kaldırıldı, Curcy köprüsü `docs/site-snippets/curcy-bridge.php`), `class-builder-detect.php` (yalnız genel WordPress sinyalleriyle düzenleyici/önizleme tespiti) | `includes/compat/` |
| `includes/i18n/` | JS sözlük sınıfı (`WDP_Js_I18n`) | `includes/i18n/class-wdp-js-i18n.php` |
| `languages/` | `.pot` / `tr_TR.po|.mo` (parts/ dağıtıma girmez) | `.distignore` `languages/parts/` |
| `templates/woocommerce/` | Simple add-to-cart şablon override | `templates/woocommerce/single-product/add-to-cart/simple.php` |
| `blocks/` | Gutenberg `donation-form` + `donations` | `src/Modules/EntryPoints/class-blocks.php:34-63` |
| `assets/js/src/` | Ön yüz JS kaynakları | `includes/config/frontend-js-stack.php` |
| `assets/js/build/` | Hash’li JS bundle + `manifest.json` | `tools/build-js-bundle.php:11-12` |
| `assets/css/src/` | Ön yüz CSS kaynakları | `includes/config/frontend-css-stack.php` |
| `assets/css/build/` | Hash’li CSS bundle + manifest | `tools/build-css-bundle.php` (stack sırası) |
| `assets/css/admin-style.css`, `assets/css/admin/products.css` | Admin UI | `includes/class-admin-assets.php` |
| `assets/js/admin-script.js`, `assets/js/admin/products.js` | Admin JS | aynı |
| `assets/css/list.css`, `assets/js/list.js` | `[wdp_donations]` liste | `includes/class-donations-list.php` |
| `tools/` | Bundle / minify / docblock + lint baseline (`tools/lint-baseline/`) | `package.json:7-9`, `docs/MIMARI.md` Kod kalitesi |
| `tools/bin/` | composer.phar / wp-cli.phar (git dışı, SHA `tools/lint-tools.json`) | `scripts/install-lint-tools.mjs` |
| `vendor-dev/` | PHPCS / PHPStan / PHPUnit (composer `vendor-dir`; `vendor/` sembolik bağa yazılmaz) | `composer.json` `config.vendor-dir` |
| `scripts/` | pack, deploy, ship, handoff, lint | `package.json` |
| `tests/` | PHPUnit, JS unit, smoke, E2E | `package.json:10-23` |
| `docs/` | AYARLAR + bu mimari | — |

### Bootstrap sırası

1. `woo-donation-popup.php` → `WDP_Plugin_Bootstrap::run()` (`woo-donation-popup.php:53-56`)
2. HPOS uyumluluk + autoload + Migrations::init (`includes/bootstrap/class-plugin-bootstrap.php:22-27`)
3. `init` → `load_plugin_textdomain` (`includes/bootstrap/class-plugin-bootstrap.php` `load_textdomain`)
4. `plugins_loaded` → WC yoksa notice; varsa `Woo_Donation_Popup` (+ admin’de `Woo_Donation_Popup_Admin`) (`includes/bootstrap/class-plugin-bootstrap.php:35-44`)
5. Modül `init()` sırası (`includes/class-woo-donation-popup.php:47-64`): Utils → Assets → Ajax → Cart → Order → Addon_Product_Visibility → **Donation_Purchasable** → Donations_List → Product_Page_Integration → Lazy_Modal → Blocks → Elementor → Form_Matrix → Shortcodes

---

## b) PHP sınıfları / trait’ler ve hook tablosu

### Modül başlatma (özet)

| Sınıf | Rol | init kaynağı |
|-------|-----|--------------|
| `WDP_Plugin_Bootstrap` | Yaşam döngüsü | `woo-donation-popup.php:56` |
| `Woo_Donation_Popup` | Orkestratör | bootstrap `launch_plugin` |
| `Woo_Donation_Popup_Admin` | Ayar ekranı + AJAX kaydet | bootstrap admin |
| `WDP_Migrations` | `wdp_db_version` geçişleri | bootstrap `includes/bootstrap/class-plugin-bootstrap.php:24` |
| `WDP_Ajax` + 5 trait | Ön yüz AJAX | orkestratör |
| `WDP_Cart` / `WDP_Order` | Sepet / sipariş meta | orkestratör; Order içinde Privacy + Order_Meta_Keys (`includes/class-order.php:20-25`) |
| `WDP_Donation_Purchasable` | Custom/campaign ürünler Genel fiyat boşken `woocommerce_is_purchasable` | orkestratör; `includes/class-donation-purchasable.php` |
| `WDP_Admin_Hooks` | Menü + admin AJAX | admin ctor (`includes/class-woo-donation-popup-admin.php:41`) |

### Hook tablosu (add_action / add_filter)

| Hook | Öncelik | Callback | Dosya:satır |
|------|---------|----------|-------------|
| `before_woocommerce_init` | default | HPOS `custom_order_tables` uyum | `includes/bootstrap/class-plugin-bootstrap.php:99-106` |
| `init` | default | `load_textdomain` (`woo-donation-popup` → `languages/`) | `includes/bootstrap/class-plugin-bootstrap.php` |
| `plugins_loaded` | 20 | `launch_plugin`, `update_version` (+ çekirdek `Plugin::on_plugins_loaded`, 20) | `includes/bootstrap/class-plugin-bootstrap.php` |
| `admin_notices` | default | WC eksik notice | `includes/bootstrap/class-plugin-bootstrap.php:37` |
| `admin_init` | 5 / 20 | Migrations `maybe_run` / `maybe_dismiss_notice` | `includes/class-migrations.php:72-73` |
| `admin_notices` | default | placement notice | `includes/class-migrations.php:74` |
| `upgrader_process_complete` | 10 | migration tetik | `includes/class-migrations.php:75` |
| `woocommerce_order_status_changed` | 20 | progress toplam sync | `includes/class-utils.php:52` |
| `woocommerce_order_refunded` | 20 | refund sync | `includes/class-utils.php:53` |
| `updated/added/deleted_post_meta` | 10 | ürün info cache invalidate | `includes/class-utils.php:56-58` |
| `save_post_product` | 10 | cache invalidate | `includes/class-utils.php:59` |
| `woocommerce_loaded` | 1 | `woocommerce_update_product` kaydı | `includes/class-utils.php:63` |
| `woocommerce_update_product` | 10 | cache invalidate | `includes/class-utils.php:81` |
| `before_delete_post` / `wp_trash_post` | 10 | cache purge | `includes/class-utils.php:67-68` |
| `wp_enqueue_scripts` | default | Assets enqueue | `includes/class-assets.php:61` |
| `wp_footer` | 1 | maybe enqueue / footer enqueue | `includes/class-assets.php:62`, `includes/class-assets.php:90` |
| `style_loader_tag` | 10 | no-optimize | `includes/class-assets.php:64` |
| `woocommerce_add_cart_item_data` | 10 | bağış cart data | `includes/class-cart.php:22` |
| `woocommerce_add_to_cart_validation` | 10 | alan doğrulama + yerel add-to-cart reddi | `includes/class-cart.php:25` |
| `woocommerce_store_api_validate_add_to_cart` | 10 | blok/Store API yerel ekleme reddi | `includes/class-cart.php:26` |
| `woocommerce_get_item_data` | 10 | sepet görüntü | `includes/class-cart.php:29` |
| `woocommerce_before_calculate_totals` | 99 | özel fiyat | `includes/class-cart.php:32` |
| `woocommerce_cart_item_price/subtotal` | 10 | fiyat HTML | `includes/class-cart.php:33-34` |
| `woocommerce_cart_item_quantity` | 10 | hisse qty kilidi | `includes/class-cart.php:37` |
| `woocommerce_update_cart_validation` | 10 | hisse qty engel | `includes/class-cart.php:38` |
| `woocommerce_cart_item_class/name/thumbnail` | 10 | sadaka satır görünümü | `includes/class-cart.php:40-42` |
| `woocommerce_checkout_create_order_line_item` | 10 | sipariş meta yaz | `includes/class-order.php:22` |
| `woocommerce_order_item_display_meta_key/value` | 10 | etiket çevirisi | `includes/class-order-meta-keys.php:345-346` |
| `wp_privacy_personal_data_exporters` | 10 | exporter | `includes/class-privacy.php:26` |
| `wp_privacy_personal_data_erasers` | 5 | eraser | `includes/class-privacy.php:28` |
| `wp` | 20 | native ATC unhook + fallback | `src/Modules/EntryPoints/class-auto-placement.php:49` |
| `body_class` / `post_class` | 10 | CSS sınıfları | `src/Modules/EntryPoints/class-auto-placement.php:50-51` |
| `wp_head` | 30 | hide cart CSS | `src/Modules/EntryPoints/class-auto-placement.php:52` |
| `wc_get_template` / `woocommerce_locate_template` | 20 | şablon override | `src/Modules/EntryPoints/class-auto-placement.php:54-55` |
| `woocommerce_get_price_html` | 20 | fiyat gizle | `src/Modules/EntryPoints/class-auto-placement.php:57` |
| `woocommerce_is_purchasable` | 20 | custom/campaign boş fiyat | `includes/class-donation-purchasable.php:24` |
| `woocommerce_loop_add_to_cart_link` | 10 | döngü Bağış Yap | `src/Modules/EntryPoints/class-auto-placement.php:58` |
| `woocommerce_product_add_to_cart_text/url` | 20 | metin/URL | `src/Modules/EntryPoints/class-auto-placement.php:59-60` |
| `woocommerce_product_supports` | 20 | ajax_add_to_cart vs. | `src/Modules/EntryPoints/class-auto-placement.php:61` |
| `render_block_woocommerce/*` | 10 | blok sepete ekle/fiyat/buton | `src/Modules/EntryPoints/class-auto-placement.php:63-66` |
| `woocommerce_single_product_summary` | 21/30 | fallback form | `src/Modules/EntryPoints/class-auto-placement.php:107` |
| `woocommerce_after_single_product_summary` | 5 | below_summary | `src/Modules/EntryPoints/class-auto-placement.php:103` |
| `init` | default | Gutenberg blok kaydı | `src/Modules/EntryPoints/class-blocks.php:28` |
| `elementor/widgets/register` | default | widget | `src/Modules/EntryPoints/Elementor/class-elementor-compat.php:22-26` |
| `elementor/elements/categories_registered` | default | kategori | `src/Modules/EntryPoints/Elementor/class-elementor-compat.php:23-27` |
| `template_redirect` | 0 | form matrix | `includes/class-form-matrix.php:21` |
| `set_object_terms` + stok/kategori | 10 | liste cache bump | `includes/class-donations-list.php:38-43` |
| `wp_footer` | 20 | liste schema | `includes/class-donations-list.php:177` |
| `updated_option` / post_meta | 10 | sadaka line cache flush | `includes/class-addon-product-visibility.php:33-36` |
| `admin_menu` / `admin_enqueue_scripts` | default | ayarlar | `includes/class-admin-hooks.php:23-24` |
| `woocommerce_product_data_tabs` | default | Bağış sekmesi | `includes/class-admin-product-data-tab.php:35` |
| `woocommerce_product_data_panels` | default | panel HTML | `includes/class-admin-product-data-tab.php:36` |
| `woocommerce_admin_process_product_object` | default | kayıt | `includes/class-admin-product-data-tab.php:37` |
| `bulk_actions-edit-product` + handle | default / 10 | toplu işlem | `includes/class-admin-bulk-actions.php:27-28` |
| `wp_footer` | default | legacy `wdp_add_js_helpers` | `includes/bootstrap/class-legacy-frontend.php:215` |
| Optimizer filtreleri (SG/Rocket/LS/…) | çeşitli | CSS exclude | `includes/traits/trait-wdp-assets-optimizer.php:14-31` |

AJAX hook’ları → bölüm **e**.

---

## c) JS modülleri, CSS bundle, globaller

### Build zinciri

| Adım | Komut / dosya | Çıktı |
|------|---------------|-------|
| CSS | `npm run build:css` → `tools/build-css-bundle.php` | `assets/css/build/donation-modal.<hash>.css` + `manifest.json` |
| JS | `npm run build:js` → `tools/build-js-bundle.php` (esbuild minify) | `assets/js/build/donation-modal.<hash>.js` + `manifest.json` |
| Sıra kaynağı | `includes/config/frontend-css-stack.php`, `includes/config/frontend-js-stack.php` | enqueue / birleştirme sırası |
| Runtime tercih | `should_use_js_bundle()` → filtre `wdp_use_js_bundle` varsayılan `true` | `includes/traits/trait-wdp-assets-registry.php:98-99` |
| Localize | `wp_localize_script(..., 'wdp_ajax', …)` | `includes/traits/trait-wdp-assets-registry.php:294+` |

`npm run pack` önce `build` çalıştırır (`package.json:14`); ZIP içinde admin CSS minify edilir (`scripts/package-wp-plugin.sh:59-62`).

### JS yükleme sırası (stack — bağımlılıklar)

Kaynak: `includes/config/frontend-js-stack.php`. Özet sıra:

1. **i18n** (core’dan önce, bağımsız) → constants → utils → cta-viewport → state → dom  
2. phone-input → product  
3. cart/ui → cart/woo → cart/actions → cart  
4. form/messages → pricing → feedback → addon-rules → addon → ajax → validate → wizard → **cta-ready** → form  
5. shareholder/* → shareholder  
6. progress-bar → modal → form-initializer → lazy-modal → event-manager → module-loader → **init**  
   Bundle modunda `cta-ready.js` ayrıca `wdp-form-cta-ready-js` olarak bundle’dan **önce** basılır (`includes/traits/trait-wdp-assets-registry.php` `register_cta_ready_script`).

### Global nesneler

| Global | Kaynak | Not |
|--------|--------|-----|
| `window.WDPApp` | tüm `assets/js/src/**` | alt: `i18n`, `utils`, `state`, `modal`, `form`, `formCtaReady`, `cart`, `product`, `lazyModal`, `init`, … |
| `window.WDPApp.i18n` | `assets/js/src/core/i18n.js` | `__`, `_x`, `sprintf`; sözlük `wdp_ajax.i18n_dict` (`WDP_Js_I18n::dictionary`) |
| `window.wdp_ajax` | PHP localize | nonce, ajax_url, `currency`, `i18n_dict`… (`includes/traits/trait-wdp-assets-registry.php`, `WDP_Utils::get_js_currency_settings`) |
| `WDPApp.utils.formatMoney` / `parseMoney` / `parseMoneyDetailed` / `formatPrice` / `formatMinPlaceholder` | `assets/js/src/core/utils.js` | TEK biçimleyici; Intl yok; `wdp_ajax.currency` (Woo). `parseMoneyDetailed` = PHP `WDP_Utils::parse_donor_amount` (aynı kural, `tests/fixtures/amount-parse-vectors.json`). Geçerli binlik gruplama (ilk 1–3, sonrakiler tam 3) → binlik (mağaza ayırıcısı farklı olsa da; `1.250` / `1,250` her zaman 1250). Gruplamayan son `.`/`,` → ondalık adayı. 0 dp: kesir tümü sıfırsa tam sayı (`50,00`→50, `10.00`→10); sıfır değilse görünür uyarı (`Bu sitede kuruşlu tutar girilemez, örn. 10`) — yuvarlama/100× yok. N>0: kesir ≤ N kabul, > N uyarı. İki ayırıcı: son ondalık, öncekiler gruplamaysa binlik. Sepete ekle aynı doğrulama. Tutar `inputmode=decimal`; yapıştırma normalize. |
| `window.WDP.refresh` | `assets/js/src/lazy-modal.js:188-189` | DOM yenileme |

Admin: `wdp_admin` localize (`includes/class-admin-assets.php` — ayrı yığın).

### CSS stack sırası

`includes/config/frontend-css-stack.php:12-39`: foundation → forms → components → overrides (theme-isolation son).

---

## d) Veri modeli

### Options (`wp_options`)

| Anahtar | Yazıldığı yer (ör.) | Okunduğu yer (ör.) |
|---------|---------------------|---------------------|
| `wdp_version` | bootstrap `update_version` `includes/bootstrap/class-plugin-bootstrap.php:77` | `includes/bootstrap/class-plugin-bootstrap.php:66` |
| `wdp_cache_version` | activate, update_version, admin bump, style preset | `woo-donation-popup.php:29`, assets |
| `wdp_db_version` | Migrations | `includes/class-migrations.php:20` |
| `wdp_previous_version` / `wdp_migration_log` / notice/backup/lock | Migrations | `includes/class-migrations.php:21-26` |
| `wdp_placement_settings` | `WDP_Placement_Settings::save` | `includes/class-placement-settings.php::get` (`includes/class-placement-settings.php:17,84-117`) |
| `wdp_button_settings` | Normal/Tasarım kaydet + style preset | form render, inline CSS, context |
| `wdp_shareholder_settings` | Hisseli sekme | inline CSS, form |
| `wdp_success_settings` | Başarı sekme | başarı UI, sadaka varsayılan |
| `wdp_progress_bar_settings` | Progress sekme | progress CSS/JS |
| `wdp_modal_layout_settings` | Modal sekme | inline layout CSS |
| `wdp_custom_style_presets` | stil import | `WDP_Style_Presets` |
| `wdp_delete_data_on_uninstall` | Gelişmiş | `includes/class-uninstall.php` |
| `wdp_list_cache_version` | liste HTML geçersiz kılma | `WDP_Donations_List::bump_cache` |
| `wdp_css_signature` | assets registry | `includes/traits/trait-wdp-assets-registry.php:153-156` |
| `wdp_legacy_render_count` | eski (kullanılmayan) sayaç; AJAX yolu 10.33.0’da kaldırıldı | `includes/bootstrap/class-legacy-frontend.php` |
| `wdp_addon_links_audit` (eski `wdp_sadaka_links_audit` göçle kopyalanır, silinmez) | migration 10.28.4 anlık görüntü; UI 10.33.0’da kaldırıldı, option silinmez | `includes/class-addon-product-visibility.php` |
| `wdp_sadaka_visibility_cache_cleared` | migration 10.28.5 | `includes/class-migrations.php:244` |
| `wdp_migrated_10_29_0` | migration 10.29.0 (cover fee 0,5–15 onarımı, genel liste ≤6) | `includes/class-migrations.php` `step_10_29_0` |
| `wdp_migrated_10_29_1` | migration 10.29.1 (genel `amount_preset_recommended` silinir) | `includes/class-migrations.php` `step_10_29_1` |
| `wdp_migrated_10_30_0` | migration 10.30.0 (aydınlatma bağlantısı varsayılan anahtarları; veri silinmez) | `includes/class-migrations.php` `step_10_30_0` |
| `wdp_migrated_10_31_0` | migration 10.31.0 (toplanan plan + aydınlatma varsayılanı) | `includes/class-migrations.php` `step_10_31_0` |
| `wdp_migrated_10_32_0` | migration 10.32.0 (uzun aydınlatma varsayılan etiketlerini boşalt; özel metne dokunma) | `includes/class-migrations.php` `step_10_32_0` |
| `wdp_migrated_10_33_0` | migration 10.33.0 (liste önbelleği sürümü artar; veri silinmez) | `includes/class-migrations.php` `step_10_33_0` |
| `wdp_migrated_10_34_0` | migration 10.34.0 (liste önbelleği sürümü artar; kart HTML; veri silinmez) | `includes/class-migrations.php` `step_10_34_0` |

### Ürün meta (Bağış ayarları — tek kaynak `from_request`)

`WDP_Product_Settings_Service::from_request` anahtarları (10.32.0: `_theme_preset_id`, `_theme_density`, `_theme_inherit_category_color` yazılmaz; kayıtlı meta silinmez):

`_allow_custom_price`, `_min_custom_price`, `_allow_multiple_shares`, `_max_shares`, `_enable_progress_bar`, `_progress_bar_limit`, `_goal_reached_action`, `_goal_reached_message`, `_enable_product_note`, `_product_note_text`, `_enable_addon_donation`, `_addon_*` (eski `_enable_sadaka_donation`, `_sadaka_*`), `_enable_trust_strip`, `_enable_quantity`, `_enable_amount_presets`, `_enable_wizard`, `_enable_field_icons`, `_enable_impact_line`, `_progress_celebrate`, `_impact_line_text`, `_amount_presets`, `_enable_email|dedication|anonymous` (tristate `yes`/`no`/''), `_dedication_placeholder`, `_trust_badges`, `_theme_primary|primary_hover|modal_bg|radius`, `_layout_mode`, `_enable_campaign_media`, `_enable_urgency`, `_urgency_*`, `_enable_social_proof`, `_social_proof_text`, `_enable_cover_fee`, `_cover_fee_percent`, `_wdp_module_order`, `_wdp_donation_product`, `_wdp_auto_place`.

Ek progress meta: `_wdp_total_donation_amount`, `_wdp_donor_count`, `_wdp_progress_unconverted_orders` (`includes/class-utils.php`, `trait-wdp-utils-order-meta.php`).

**10.31.0 hedef / toplanan:** `WDP_Campaign_Goal` (hedefe ulaşma kararı, message/close/continue); `WDP_Progress_Currency` (`wdp_progress_convert_amount` — Curcy `wmc_order_info` / rate, sert bağımlılık yok). Toplanan = paid statuses − cover fee; boş meta → cron `wdp_recalculate_product_donation_total` (ziyaretçi taraması yok). Çubuk yüzdesi = onaylı toplam / hedef (`WDP_Campaign_Goal::compute_percent`).

**Faz 6-A/6-B (bağdaştırıcı ayrımı):** Çekirdek yalnız filtre + Woo verisi kullanır. `WDP_Progress_Currency::get_order_rate` -> `wdp_order_exchange_rate` (null, order, currency, base); canlı kur -> `wdp_progress_live_rate`; (K8: `WDP_Compat_Currency` kaldırıldı; Curcy/WOOCS okuyucuları site snippet'inde, `docs/site-snippets/`.) Ön yüz: `wdp_ajax.context` = `{currency, lang, currency_cookies[], lang_cookies[], switcher_selectors[], change_events[]}` (`wdp_client_context` filtresi); `lazy-modal.js` eklenti adı bilmez. `cart/woo.js` Avada seçicileri kaldırıldı (genel `menu-cart`/`widget-cart`/`shopping-cart` seçicileri + zaten tetiklenen standart `wc_fragment_refresh`). Oluşturucu tespiti: `Builder_Detect` genel kurallarla (`edit_products` + Gutenberg block-renderer, `is_preview()`/`is_customize_preview()`, anahtarı edit/preview/builder/fb parçası içeren dolu sorgu değişkeni) karar verir; adı bilinmeyen oluşturucu da çalışır; site sahibi ek işareti `wdp_is_builder_preview` / `wdp_builder_preview_context_product` filtreleriyle ekleyebilir (F6G: marka bazlı `WDP_Compat_Builders` kaldırıldı). Ürün sayfası yedeği (`render_builder_fallback`) zaten kanca tabanlıdır (şablon geçersiz kılma çalıştı mı).

**10.32.0 ürün teması:** `WDP_Form_Modules::resolve_product_primary_color` / `resolve_product_shell_primary` (ürün → genel; kategori rengi K5 ile kaldırıldı; `_theme_inherit_category_color` okunmaz). `build_product_theme_style` → `WDP_Color_Palette::from_hex` türevleri + `--wdp-on-primary`; hover boşsa türetilmiş; koyu `--wdp-modal-bg` için metin token’ları. Köşe `PRODUCT_THEME_RADIUS_MIN/MAX` (4–32) + `product_radius_ladder` (panel/sheet oranı). Kampanya görseli URL: filtre `wdp_campaign_media_url` (`class-campaign-header-renderer.php`).

Kapsam bayrağı: `_wdp_donation_product` (`includes/class-donation-scope.php:20`).

### Sepet öğesi anahtarları

| Anahtar | Yazma | Okuma |
|---------|-------|-------|
| `donation_data` (full_name, phone, note, email, dedication, anonymous, cover_fee, share_count, shareholders) | `WDP_Cart::add_donation_item_data` / AJAX cart-add | cart display, order meta |
| `custom_price` | cart + AJAX | `apply_custom_price_to_cart` |
| `unique_submission_key` / `unique_key` | cart | verify_submission |
| `share_count_hidden` | cart | hisse |
| `wdp_base_unit_price` | AJAX cart-add `includes/traits/trait-wdp-ajax-cart-add.php:290` | fiyat |
| `wdp_sadaka_donation`, `wdp_parent_product_id`, `wdp_parent_cart_item_key`, `wdp_sadaka_linked_wc_product` | AJAX sadaka ekleme `includes/traits/trait-wdp-ajax-cart-add.php:497-504` | cart filtreleri / remove |

### Sipariş satırı meta

Sabit anahtarlar: `wdp_donor_name|phone|email`, `wdp_donation_note`, `wdp_dedication`, `wdp_anonymous`, `wdp_cover_fee`, `wdp_share_count`, `wdp_shareholder_%d_%s` (`includes/class-order-meta-keys.php:20-30`).  
Yazma: `WDP_Order::add_donation_meta_to_order` (`includes/class-order.php:36-47`) + gizli `_custom_price` (`includes/class-order.php:38-39`).  
Eski çevrilmiş etiket anahtarları `normalize_key` ile okunur (`includes/class-order-meta-keys.php:193-198`).

### Transient / object cache / session / cookie

| Anahtar / grup | Tür | Kullanım |
|----------------|-----|----------|
| `wdp_product_info_{id}` | transient + `wdp_product_info` cache | get_product_info (`includes/traits/trait-wdp-ajax-product.php:32-68`) |
| `wdp_total_donation_*` / `wdp_donor_count_*` | object cache `wdp_donations` | Utils |
| `wdp_cart_count_*` / `wdp_cart_contents_*` | object cache `wdp_cart` | cart query (kısa TTL) |
| `wdp_rate_limit_*` | transient | Security rate limit (`includes/class-security.php:201-219`) |
| `wdp_migration_lock` | transient | Migrations |
| `wdp_addon_line_ids` | transient | Addon visibility (`TRANSIENT` const) |
| Liste HTML | 1 gün transient; `wdp_list_cache_version`; `orderby=random` atlar; UID/panel yer tutucu + admin notu cache dışı | `includes/class-donations-list.php` `render` / `bump_cache` |
| `wdp_css_version_*` / `wdp_js_version_*` | transient+cache | assets |
| WC session `get_customer_id()` | session | rate-limit / cart cache suffix (`includes/traits/trait-wdp-ajax-base.php:113-114`) |
| Para birimi/dil sinyali (istemci) | `wdp_ajax.context` (sunucu; `wdp_client_context` filtresi) | lazy-modal çerez adı/seçici/olayları buradan okur; çekirdek eklenti/çerez adı bilmez (varsayılan listeler boş; K8), site snippet'i ekler (`assets/js/src/lazy-modal.js`) |
| `wdp_vid` | HttpOnly, SameSite=Lax, 12 saat, HMAC | Misafir salt-okunur kova ayırıcı (`includes/class-security.php:18-24,300-378`). Sayfa HTML’sinde Set-Cookie yok (önbellek); AJAX `get_product_info` / `render_modal` sırasında yoksa basılır. |

Eklenti `setcookie` yalnız `wdp_vid` (10.34.10). JS çerez yazmaz.

---

## e) AJAX / REST uçları (tam liste)

`register_rest_route` / `admin_post_` / eklenti `wc_ajax_` kaydı: **yok** (grep). WC fragment yalnız istemci `get_refreshed_fragments` (`assets/js/src/cart/woo.js:35`).

Yetki notu: `run_secured_ajax` varsayılan capability `read`; misafir için `check_capability('read')` → true (`includes/class-security.php:289-296`). `get_product_info` / `get_product_name` capability=`false` (`includes/traits/trait-wdp-ajax-product.php:65,197`).

Güvenlik reddi HTTP (`WDP_Utils::json_error`, 10.34.9): asla `200` + `success:false`. `WDP_Security_Exception` türü → HTTP: `nonce`/`capability`/`origin`/`method` = 403, `rate_limit` = 429 + `Retry-After` (`includes/class-exceptions.php`, `includes/class-utils.php`). JSON `code` = tür dizesi. Giriş yapmış kullanıcıda istek sınırı anahtarı `u:<id>|a:<action>` (10.34.10’da değişmez). Misafir **yazma** (`add_to_cart` vb.) `g:<hash(session\|ip\|ua)>|a:<action>`. Misafir **salt okunur** (`get_product_info`, `render_modal`): ziyaretçi kovası `v:<hash(wdp_vid)>|a:<action>` 60/dk + IP kovası `ip:<hash(ip)>|a:<action>` 600/dk (`wdp_rate_limit_ip_max` filtresi). Tehdit: CGNAT + aynı UA gerçek bağışçıları tek 60/dk kovasına düşürmesin; sahte `wdp_vid` HMAC’siz geçersiz (IP+UA 60’a düşer); geçerli belirteç çoğaltmak IP 600/dk ile sınırlı. Yazma uçları tek katman (eski davranış). `includes/class-security.php:234-290`, `includes/traits/trait-wdp-ajax-base.php:32-40`, `includes/class-lazy-modal.php`. `get_product_info` 60/dk (salt okunur, önbellekli; liste 24 kart + idle prefetch 3 `wdp_render_modal` — product_info form açılınca). Ön yüz: 403 nonce’ta bir kez `refreshWdpAjaxNonces` + yeniden dene; 429 görünür mesaj (`assets/js/src/product.js`, `assets/js/src/form/ajax.js`).

E2E bağışçı akışı ziyaretçi (`asVisitor`, storageState yok): ürün sayfası / popup / panel / layout yayımlı katalog. Yönetici: `decideScenarioProduct.admin` (private fixture), admin sekmeleri, **alt bağış yapılandırması** (`readProductSadakaAdminConfig` → WP eval `tests/e2e/helpers/sadaka-admin-config.php`, tarayıcı yok; eval olmazsa `post.php` 45s + en fazla 1 yeniden deneme; bağışçı senaryosu yine ziyaretçi). Auth işaret dosyası origin (şema+host+port) içerir — `WDP_LOCAL_E2E_PORT` değişince eski `.auth-ok` ile wp-login’e düşülmez. Atlama yalnız `tests/e2e/helpers/skip-policy.mjs` sabit kod (enum) + `evidence: wp-data|policy|css-source` (liste sayfası yok, yayımlı ürün yok, ayar kapalı, uzakta sipariş yok, local-only, related/upsell ID boş; **theme-hides-related** yalnız `css-source` + eklenti dışı stil yolu); **DOM gözlemi / açılamadı / timeout / admin okuma / enum dışı / evidence=dom / css-source eklenti yolu → hata** (`promoteIllegalSkips`). Mutasyon paketleri (form-fields, amount-options, campaign-blocks, product-theme, shortcodes, empty-price) yayımlı katalogda ziyaretçi, **uzak private fixture’da yönetici** (`decideDonationViewContext` / `donationViewContext` tek kural; katalog rolü yayımlı olsa bile fixture id private ise yönetici). Meta yazımı tarayıcıda değil PHP eval. Mutasyon suite’leri yalnız **iphone**; android/desktop salt okunur (layout her cihazda). Kilit senaryo başına (`mutation-lock.mjs`). Teşhis: `[e2e:ajax-kind] action=… http=… kind=nonce|rate|capability|id` (`tests/e2e/helpers/ajax-error-kind.mjs`).

| Action | nopriv | Nonce | Yetki | Girdi temizleme (özet) | Çıktı | Dosya:satır |
|--------|--------|-------|-------|------------------------|-------|-------------|
| `wdp_get_cart_count` | evet | `wdp_get_cart_count` + origin | read | — | `{cart_count}` | `includes/class-ajax.php:35-36` + `includes/traits/trait-wdp-ajax-cart-query.php:47-68` |
| `wdp_get_cart_contents` | evet | `wdp_get_cart_contents` | read | — | items + count | `includes/class-ajax.php:38-39`, `includes/traits/trait-wdp-ajax-cart-query.php:74-96` |
| `wdp_ajax_add_to_cart` | evet | `wdp_ajax_add_to_cart` | read | absint/sanitize fiyat/hisse… | success cart JSON | `includes/class-ajax.php:41-42`, `includes/traits/trait-wdp-ajax-cart-add.php:22+` |
| `wdp_get_fresh_nonces` | evet | **yok** (origin sıkı + POST) | read | — | nonces map | `includes/class-ajax.php:44-45`, `includes/traits/trait-wdp-ajax-cart-session.php:17-41` |
| `wdp_verify_submission_in_cart` | evet | `wdp_ajax_add_to_cart` | read | unique_submission_key | in_cart bool | `includes/class-ajax.php:47-48`, `includes/traits/trait-wdp-ajax-cart-session.php:54-88` |
| `wdp_remove_cart_item` | evet | `wdp_remove_cart_item` | read | cart_item_key | items | `includes/class-ajax.php:50-51`, query `includes/traits/trait-wdp-ajax-cart-query.php:212+` |
| `wdp_get_product_name` | evet | `wdp_get_product_name` | yok (false) | product_id | deprecated name | `includes/class-ajax.php:54-55`, product `includes/traits/trait-wdp-ajax-product.php:145-176` |
| `wdp_get_product_info` | evet | `wdp_get_product_info` | yok (false) | product_id | form meta JSON | `includes/class-ajax.php:57-58`, `includes/traits/trait-wdp-ajax-product.php:11-128` |
| `wdp_render_modal` | evet | **bilinçli yok** | origin+rate+scope (Origin/Referer yoksa `validate_request_origin` false; `Sec-Fetch-Site` same-origin/same-site veya nonce’lu `none` istisna) | product_id, mode | `{html}` | `includes/class-lazy-modal.php:21-62` |
| `wdp_recalculate_product_total` | hayır | `wdp_admin_nonce` | `manage_woocommerce` | product_id | total JSON | `includes/class-admin-hooks.php:29` + `includes/class-admin-product-settings-ajax.php:21-56` + `includes/class-admin-request.php:21-26` |
| `wdp_save_placement_settings` | hayır | admin nonce | manage_woocommerce | placement alanları | success | `includes/class-admin-hooks.php:30` |
| `wdp_save_advanced_settings` | hayır | aynı | aynı | uninstall flag vb. | success | `includes/class-admin-hooks.php:31` |
| `wdp_save_normal_form_settings` | hayır | aynı | aynı | button_settings | success | `includes/class-admin-hooks.php:32` |
| `wdp_save_design_studio_settings` | hayır | aynı | aynı | tasarım alanları | success | `includes/class-admin-hooks.php:33` |
| `wdp_save_shareholder_form_settings` | hayır | aynı | aynı | shareholder_settings | success | `includes/class-admin-hooks.php:34` |
| `wdp_save_success_screen_settings` | hayır | aynı | aynı | success_settings | success | `includes/class-admin-hooks.php:35` |
| `wdp_save_modal_layout_settings` | hayır | aynı | aynı | modal_layout | success | `includes/class-admin-hooks.php:36` |
| `wdp_save_progress_bar_settings` | hayır | aynı | aynı | progress | success | `includes/class-admin-hooks.php:38` |
| `wdp_apply_style_preset` | hayır | aynı | aynı | preset id | success | `includes/class-admin-hooks.php:40` |
| `wdp_export_style_preset` | hayır | aynı | aynı | — | export JSON | `includes/class-admin-hooks.php:41` |
| `wdp_import_style_preset` | hayır | aynı | aynı | import payload | success | `includes/class-admin-hooks.php:42` |

Ürün Bağış paneli kaydı AJAX değil: `woocommerce_admin_process_product_object` (`includes/class-admin-product-data-tab.php:37`).

---

## f) Kısa kodlar, blok, Elementor, ürün/mağaza entegrasyonu

### Kısa kodlar

| Tag | Render | Dosya:satır |
|-----|--------|-------------|
| `[wdp_donation_button]` | popup buton+modal | `src/Modules/EntryPoints/class-shortcodes.php:21,33-40` |
| `[wdp_donation_button_panel]` | side panel | `src/Modules/EntryPoints/class-shortcodes.php:22,49-56` |
| `[wdp_donation_form]` | gömülü form | `src/Modules/EntryPoints/class-shortcodes.php:23,65-72` |
| `[wdp_donations]` | liste ızgara | `src/Modules/EntryPoints/class-shortcodes.php:24` → `WDP_Donations_List::shortcode` |

Ürün çözümleme: `Product_Resolver` + `resolve_for_output`. `id`/`slug`/`sku` açıkça verilirse bağış kapsamı atlanır.

Liste önbelleği bump (10.33.0 + 10.34.0; aynı istekte bir kez): stok/kategori (önceki) + `woocommerce_update_product`, `woocommerce_new_product`, `save_post_product`, `trashed_post` / `untrashed_post` / `before_delete_post`, `transition_post_status`, fiyat/ilerleme meta (`_price` `_regular_price` `_sale_price` `_wdp_total_donation_amount` `_wdp_donor_count`), bağış sekmesi kaydı (`on_product_settings_save`), sipariş durum / iade. 10.34.0 `step_10_34_0` bir kez sürüm artırır (kart HTML değişti).

**Liste kartı (10.34.0):** görsel ve başlık gerçek `<a href>` (ürün permalink); CTA popup/panelde `<button type="button" class="wdp-card__cta wdp-open-modal" data-wdp-lazy="1">` (sayfadan ayrılmaz); `button=link` iken `<a href>`. İç içe `<a>` yok (görsel bağlantısı `aria-hidden tabindex=-1`). Custom kart: yalnız `min. {wc_price(_min_custom_price)}` (sabit fiyat yok). Kampanya: toplanan/hedef `wc_price` + çubuk yalnız `_progress_bar_limit>0`; `DEFAULT_GOAL` kart yüzdesinde kullanılmaz; toplanan 0 anlamlı metin. Sekmeler: yalnız üründe doğrudan kategori; `get_option('default_product_cat')` ve slug `uncategorized` yok. `card_html` `includes/class-donations-list.php`.

**Fiyatsız custom/campaign (10.34.0):** `WDP_Donation_Purchasable` `woocommerce_is_purchasable` pri 20 — yayınlanmış (veya `edit_post`) bağış ürünü Genel fiyat boşken satın alınabilir. Min yalnız `_min_custom_price`. Eklenti Genel fiyatı yazmaz/eşitlemez. Kart/form birim fiyatı `wc_get_price_to_display`. Genel fiyat alanı görünür kalır; Bağış sekmesinde not.

**Şart b E2E (10.34.1, görev 2b):** Hedef (`allowMetaMutation`): custom + campaign ürününde `_regular_price`/`_price` geçici boşaltılır (`saveProductPrices`), liste önbelleği bump, (1) listede `data-product-id` görünür (2) ürün sayfası Bağış Yap (3) sepete eklenir tutar doğru (4) custom kartta sabit fiyat yok / HTML bozuk değil; `finally` eski fiyata döner — geri yükleme hatası testi fail eder. Ikram: gerçek fiyata dokunulmaz; `private` + `catalog hidden` + `_wdp_e2e_test=1` geçici custom ürün; `asAdmin` tam permalink (`pathname` `?p=` düşürmez) + sepet; `deleteMarkedProduct` (işaretsiz silinmez). Liste görünürlüğü Ikram’da atlanır. Coming soon değişmez.

**Ürün sayfası auto_place yedek (10.34.1):** Özel ürün şablonu Woo sepete-ekle öğesi içermezse şablon override ve summary kancası çalışmaz. `auto_place=yes` iken `render_builder_fallback` bir kez basar (`woocommerce_after_single_product` + `wp_footer`); `has_product_ui` / `template_override_used` varsa boş. `src/Modules/EntryPoints/class-auto-placement.php`.

**Giriş noktası yedeği ve ID'siz çözüm (Faz 7-A):** Tespit tema/oluşturucu adını bilmez; yalnız standart Woo kancaları + istek içi kayıt defteri (`WDP_Render_Registry`): kısa kod/blok/widget/şablon override/başka bir snippet'ten `do_shortcode` ile çağrılan çıktı `mark_trigger` / `claim_form` ile kayıtlanır, `has_product_ui` bunu okur. `render_builder_fallback` `woocommerce_after_single_product` **öncelik 999** (`FALLBACK_PRIORITY`) + `wp_footer` 4'te çalışır; ürün sayfası, bağış ürünü, genel `auto_place=yes`, ürün `_wdp_auto_place!=no`, kısa kod yok ve `has_product_ui` yok ise düğmeyi/formu `wdp-auto-place-fallback` içinde bir kez basar. Otomatik çizilen giriş `mark_auto` ile işaretlenir; **sonradan** aynı ürün için gelen açık kısa kod/blok/widget çıktısı boş döner (`Shortcodes::auto_entry_already_drawn`; tek giriş kuralı; builder önizlemede ve `wdp_allow_multiple_entries` filtresi `true` iken uygulanmaz). Blok tema `woocommerce/add-to-cart-form`: blok kendi çağrısında şablon override ile girişi zaten bastıysa `filter_block_add_to_cart` içeriği korur (`html_has_entry`), yalnız başka giriş varsa yerli içeriği atar. ID'siz kısa kod/blok/widget (`Product_Resolver::resolve`): `id/slug/sku` → blok `postId` → global `$product` → `is_product()` + sorgulanan ID → `get_queried_object()` ürün yazısı → global `$post` ürün yazısı → `get_the_ID()` → oluşturucu önizleme; çözülemezse çıktı ziyaretçi için sessizce boş (uyarı yalnız yönetici/önizleme). Kısa kod adları/öznitelikleri değişmez (`CompatibilityContractTest`). Testler: `tests/unit/EntryPointFallbackTest.php`; yerel HTTP e2e `npm run e2e:entry-points` (`tests/e2e/run-entry-points.mjs`; temalar `matrix.json` `entryPoints.themes`: twentytwentyfive, storefront, blocksy; test mu-plugin'i `tests/e2e/helpers/wdp-entry-sim.php` `[hd_panel_buton]` benzeri snippet'i ve Avada/Elementor benzeri "özet kancasında add-to-cart yok" düzenini (`builder_no_atc`) taklit eder; gerçek Avada yerelde kurulamaz).

**Tutar etiketi koşulu (10.34.2):** Görünür “Bağış Tutarı” yalnız gerçek tutar *girişi* olan türlerde (bağışçı belirler `render_custom_price_amount_row`, hedefli/kampanya `render_progress_amount_block`). Sabit tutar `render_fixed_price_quantity_row` fiyat kutusu + adet (eşit ızgara); etiket yok (yalnız `screen-reader-text` / `aria-label`). Hisselide tutar girişi yok → etiket yok. CSS ile gizleme yok. `includes/templates/class-form-fields-renderer.php`.

**CTA alt dolgu (10.34.2 + 10.34.10):** `--wdp-cta-clearance` varsayılan `0`. CTA varsayılan `position: relative` (akışta, son alanın altında ≈16–24px). JS `applyCtaClearance` kaydırma yoksa sınıf/spacer 0; gövde taşınca `.wdp-cta-overlays` → `sticky` + spacer = min(çubuk, bindirme). Panel footer `margin-block-start: 0`; panel main `flex: 0 1 auto` (kısa formda büyümez, taşınca küçülür). Hisselide dış `::after` 0. E2E: son öğe (görünür en alt, CTA dışı) çubuğun arkasında değil + kaydırma sonunda boşluk ≤48px (`CTA-GAP`); PNG `waitAndAssertShellOverlap`. `assets/js/src/core/cta-viewport.js`, `assets/css/src/foundation/tokens.css:186`, `layout.css`, `side-panel.css`, `tests/e2e/helpers/layout.mjs`, `shell-overlap.mjs`.

### Gutenberg

| Blok | Kayıt | Render |
|------|-------|--------|
| `blocks/donation-form` | `Blocks::register` `src/Modules/EntryPoints/class-blocks.php:52-57` | shortcode benzeri (`src/Modules/EntryPoints/class-blocks.php:72+`) |
| `blocks/donations` | `src/Modules/EntryPoints/class-blocks.php:58-62` | liste |

### Elementor

`DonationPanel\Modules\EntryPoints\Elementor\Elementor_Compat` widget kaydı (`src/Modules/EntryPoints/Elementor/class-elementor-compat.php`); widget’lar shortcode fonksiyonlarını çağırır (`src/Modules/EntryPoints/Elementor/class-*-widget.php`). Liste `image_size` + `columns_tablet`/`columns_mobile` → `Donations_List_Widget::atts_from_settings`. Ayrıntı: "Genel ilke (F6G)".

### Ürün sayfası / mağaza

- Kapı: `WDP_Placement_Settings::value('auto_place')==='yes'` (`src/Modules/EntryPoints/class-auto-placement.php:43-45`)
- Şablon: `templates/woocommerce/single-product/add-to-cart/simple.php` via `wc_get_template` / `locate_template` filtreleri (`src/Modules/EntryPoints/class-auto-placement.php:54-55`)
- Döngü: `woocommerce_loop_add_to_cart_link` (`src/Modules/EntryPoints/class-auto-placement.php:58`) — popup/panel/lazy
- Lazy modal: `data-wdp-lazy` + AJAX `wdp_render_modal` (`includes/class-lazy-modal.php`, `assets/js/src/lazy-modal.js`)
- Native ATC unhook: `unhook_native_single_add_to_cart` (`src/Modules/EntryPoints/class-auto-placement.php` `on_wp`)
- Fallback: summary hook’ları (`src/Modules/EntryPoints/class-auto-placement.php`)
- Ürün override: `_wdp_auto_place`

---

### Giriş noktaları modülü (E1; `src/Modules/EntryPoints/`, ad alanı `DonationPanel\Modules\EntryPoints`)

Eski `includes/class-{shortcodes,product-page-integration,product-resolver,blocks,elementor}.php`, `includes/elementor/*` ve `includes/compat/class-builder-detect.php` buraya taşındı; eski dosyalar silindi. Davranış birebir.

| Sınıf (dosya `class-*.php`) | Sorumluluk |
|---|---|
| `Entry_Points_Module` (`entry-points-module`) | Modül (slug `entry_points`, varsayılan AÇIK). Açıkken `Auto_Placement::init()` çağırır. WooCommerce yoksa hiçbir şey yapmaz. |
| `Shortcodes` | 4 kısa kod (`wdp_donation_button`, `wdp_donation_button_panel`, `wdp_donation_form`, `wdp_donations`; öznitelikler değişmez); ortak `render_button` / `render_form` (kısa kod, blok, widget, otomatik yerleşim hepsi bunu kullanır). |
| `Blocks` | `wdp/donation-form`, `wdp/donations` (block.json `blocks/` altında kalır; PHP render). |
| `Product_Resolver` | ID'siz çözüm sırası: id, slug, sku, blok bağlamı, global `$product`, `is_product()`, queried object, global `$post`, `get_the_ID()`, düzenleyici önizleme; `wdp_resolve_product` filtresi. Ayrıca `current_product()`, `current_product_id()`, `product_from_block()`. |
| `Builder_Detect` | Yalnız genel WP sinyalleriyle düzenleyici/önizleme tespiti (hiçbir oluşturucu adı yok). |
| `Auto_Placement` | Woo standart kancalarıyla otomatik yerleşim: `simple.php` şablon override (`wc_get_template`, `woocommerce_locate_template`), `wp` özet kancaları, blok `render_block_woocommerce/add-to-cart-*`, native add-to-cart söküm, gizleme CSS. Kapı: genel `auto_place=yes` + ürün `_wdp_auto_place!=='no'`. |
| `Fallback_Button` | Yedek düğme: şablon override çalışmadıysa ve sayfada hiç giriş çizilmediyse (`woocommerce_after_single_product` öncelik 999 + `wp_footer` 4) kendi düğmesini çizer. Çift giriş asla. |
| `Loop_Price_Filters` | Mağaza döngüsü düğmesi (popup/panel/bağlantı), sepete ekle metni/URL, ajax_add_to_cart kapatma, fiyat gizleme (`hide_price`). |
| `Elementor\Elementor_Compat` + `Donation_Form_Widget` + `Donations_List_Widget` | Yalnız kısa kodun çıktısını döndüren ince uyumluluk katmanı (yeni özellik yok). |

**Kayıt kuralı (sözleşme):** kısa kodlar, bloklar ve Elementor katmanı HER ZAMAN kayıtlıdır (`Plugin::register_entry_contract()`, yalnız WooCommerce etkinse); modül ayarı kapatılırsa yalnız otomatik yerleşim + yedek düğme + döngü/fiyat filtreleri kapanır, `Entry_Points_Module` ve bağlı sınıf dosyaları yüklenmez.
**Tek kayıt defteri:** giriş noktası durumu (`has_product_ui`, `mark_auto`, `claim_form/modal`, `duplicate_*_notice`) `WDP_Render_Registry`'de tutulur (testli: `EntryPointFallbackTest`, `Shortcodes1033Test`); tüm giriş yolları aynı defteri kullanır, bu yüzden bir ürün sayfasında ikinci giriş çizilmez (`wdp_allow_multiple_entries` ile açılır).
**Şablon:** `templates/woocommerce/single-product/add-to-cart/simple.php` `Auto_Placement::render_template_override()` çağırır.
**Analiz:** `phpcs-src.xml.dist` (sıfır gevşetme; `edit_products` WooCommerce yetkisi bildirildi) ve `phpstan-src.neon` (seviye 6; `treatPhpDocTypesAsCertain: false`, legacy `includes/` yalnız taranır; Elementor klasörü temel sınıf kurulu olmadığından PHPStan'dan hariç, PHPCS'te kalır).

## g) Ayar → kod eşlemesi

Kaynak rehber: `docs/AYARLAR.md`. Teknik varsayılanlar normalizer / placement / product service.

### Genel → ürün devralma (çözümleyiciler)

| Konu | Sıra | Fonksiyon |
|------|------|-----------|
| Bağış ürünü mü? | tip destek → meta yes/no → global scope | `WDP_Donation_Scope::evaluate` (`includes/class-donation-scope.php:81-93`) |
| E-posta / ithaf / anonim | meta `yes`/`no` → değilse `wdp_button_settings`; hisseli tipte hep kapalı; sunucu kapalı alanı yok sayar (`WDP_Donation_Optional_Fields::apply_from_request`, AJAX + legacy cart) | `resolve_flag_or_global` / `WDP_Donation_Optional_Fields` — global: `enable_donor_email`, `enable_dedication`, `enable_anonymous` |
| Çok adımlı form | ürün `_enable_wizard` tristate → global `enable_multi_step`; form sınıfı `wdp-multi-step` (JS genel bayrağa bakmaz) | CTX + `class-modal-shell-renderer.php` + `wizard.js` |
| Alan ikonları | ürün `_enable_field_icons` tristate → global `enable_field_icons`; kapalıysa `wdp-no-field-icons` | CTX + MSR |
| Aydınlatma bağlantısı | global `enable_privacy_notice` (varsayılan kapalı) + kısa etiket (`privacy_notice_text`) / URL; URL boşsa WP gizlilik sayfası; yoksa gösterilmez. Yalnız bağlantı (uzun gövde yok). Yalnız e-posta/ithaf/hissedar varken | `WDP_Donation_Optional_Fields::render_privacy_notice_html` |
| Ürün vurgu rengi | ürün `_theme_primary` → genel marka; başlık aynı kural (`WDP_Form_Modules::get_title_style_attr`) | `WDP_Form_Modules::resolve_product_*` |
| Anonim maske | yalnız herkese açık yüzeyler (`sanitize_public_donation_data`); sipariş/admin/e-posta orijinal ad | `mask_public_donor_name` |
| Hızlı tutar düğmeleri | global `enable_amount_presets==='1'` → ürün `_enable_amount_presets==='no'` gizler; yalnız custom/campaign; min altı elenir; "Önerilen" yalnız ürün `_amount_preset_recommended` dolu ve görünen listedeyse (ortadaki/genel varsayılan yok; seçili gelmez) | `render_amount_presets` (`includes/templates/class-form-fields-renderer.php`) |
| Modül sırası | sabit varsayılan sıra (`includes/config/form-modules.php`); ürün/genel sıra ayarı K4 ile kaldırıldı, eski `_wdp_module_order` / `module_order` değerleri okunmaz | `WDP_Form_Modules::resolve_order` |
| Güven rozetleri | global → ürün `_trust_badges` doluysa ürün | `resolve_trust_badges` (`includes/class-form-modules.php:145-175`) |
| Otomatik yerleşim | global `auto_place` + ürün `_wdp_auto_place!=='no'` | `should_auto_place` / meta (`src/Modules/EntryPoints/class-auto-placement.php`) |
| Native sepet gizleme | bağış ürünü tekil sayfada tüm `form.cart` + `.single_add_to_cart_button` + sticky-add-to-cart (tema sınıfı yok); döngü/ilgili/upsell/koleksiyon `:not()` ile hariç | `hide_native_cart_css` yedek; asıl yol `unhook_native_single_add_to_cart` (`woocommerce_template_single_add_to_cart` + sticky callback adı) |
| Alt bağış WC ürünü | ürün `_addon_wc_product_id` (yoksa eski `_sadaka_wc_product_id`) → yoksa success `sadaka_wc_product_id` | `WDP_Utils::resolve_addon_wc_product_id` (`includes/class-utils.php:104+`) |

### Ürün sayfası ve liste (`wdp_placement_settings`)

| Ekran (AYARLAR) | Option alanı | Varsayılan | Okuma |
|-----------------|--------------|------------|-------|
| Sepete Ekle yerine Bağış | `auto_place` | `yes` (yeni kurulum defaults; option yoksa get() `auto_place=>no`) | `includes/class-placement-settings.php:33-45,84-91` |
| Konum | `position` | `replace_cart` | aynı |
| Görünüm | `display` | `button_panel` | `DonationPanel\Modules\EntryPoints\Auto_Placement::resolve_product_page_display` (içerikte `[wdp_donation_form]` → `inline`, `[wdp_donation_button_panel]` → `button_panel`, `[wdp_donation_button]` → `button_popup`; yoksa auto_place + bu alan). E2E katalog `display`. `data-wdp-display` düğme/form. |
| Fiyat gizle | `hide_price` | `yes` | aynı |
| Form başlığı | `show_form_title` | `no` | aynı |
| Döngü butonu | `loop_button` | `panel` | aynı |
| Kapsam | `donation_scope` | `all` | Scope |
| Kategoriler | `donation_categories` | `[]` | Scope |

**Çelişki notu (AYARLAR ↔ kod):** `defaults()` `auto_place=yes` (`includes/class-placement-settings.php:35`); `get()` option yokken `auto_place=>no` zorlar (`includes/class-placement-settings.php:89-91`) — yükseltmede ikinci form önleme. AYARLAR “genel açık bırakın” der; ham `defaults()` ile `get()` davranışı farklıdır.

### Ürün Bağış sekmesi (özet tablo)

| Ekran etiketi | Meta | Varsayılan (from_request / bayrak) | Okuma |
|---------------|------|-------------------------------------|-------|
| Bağış ürünü | `_wdp_donation_product` | `''` (global) | Scope |
| Otomatik yerleşim | `_wdp_auto_place` | `''` (açık); `no` kapalı | PPI |
| Bağış tipi | bayrak üçlüsü via `WDP_Donation_Type` | — | context / AJAX |
| Hedef tutar | `_progress_bar_limit` | ≤0 / üst sınır hata; binlik parse; admin boş input `DEFAULT_GOAL` (yalnız form alanı); kart/çubuk boş hedefi göstermez (`resolve_goal_amount` 0) | context, PSS, Donations_List |
| Hedefe ulaşınca | `_goal_reached_action`, `_goal_reached_message` | boş action→message; mesaj boş→varsayılan metin | Campaign_Goal, ajax-cart-add, cart validation |
| En düşük tutar | `_min_custom_price` | `0`; **tek kaynak** (Genel fiyat min hesaplanmaz) | context / cart |
| En fazla hisse | `_max_shares` | boş → runtime `7`; kayıt/sunucu üst 50 | context, ajax-cart-add |
| Hızlı tutar / Tutarlar / Önerilen | `_enable_amount_presets`, `_amount_presets`, `_amount_preset_recommended` | presets varsayılan yes; kayıtta katı doğrulama; Önerilen yalnız ürün (boş=etiket yok; listede yoksa kayıt hata); okumada yumuşak parse | form-fields, product-settings-service |
| Adet seçici | `_enable_quantity` | boş→yes; yalnız sabit tipte; sunucu adedi kapalıyken/sabit olmayan tipte 1'e sabitler (`WDP_Cart::product_allows_quantity`, hisseli hariç) | context, ajax-cart-add |
| Cover fee | `_enable_cover_fee`, `_cover_fee_percent` | off / 0; tüm tipler; kayıt 0 veya 0,5–15 (`normalize_cover_fee_percent_for_save`, aralık dışı = hata), çalışma anı `clamp_cover_fee_percent_for_runtime`; yüzde sunucuda HER ZAMAN ürün meta'sından (`WDP_Cart::get_product_cover_fee_percent`), istemci yüzdesi yok sayılır; fiyat: custom → `custom_price`, sabit/hisseli → `wdp_base_unit_price` × (1+yüzde); sepette "İşlem ücreti" satırı; formda `data-wdp-form-total` Toplam satırı | context, cart, ajax-cart-add, form-modules |
| E-posta/İthaf/Anonim | `_enable_*` tristate | `''`→global; hisseli tipte UI+sunucu yok; geçersiz e-posta `donation_email` hatası; ithaf 120 karakter (mb); sepette e-posta/ithaf/anonim satırı (kendi sepet) | CTX + Optional_Fields + cart display |
| Ürün notu | `_enable_product_note`, `_product_note_text` | off; kayıt sınırı 400 (okumada kırpma yok) | context / PSS |
| Wizard / ikon | `_enable_wizard`, `_enable_field_icons` tristate | `''`→global (`enable_multi_step` / `enable_field_icons`) | CTX + MSR |
| Etki / aciliyet / sosyal / medya / layout / tema… | ilgili `_` meta | bkz. `from_request` | context + header renderer |
| Alt bağış | `_enable_addon_donation`, `_addon_*` (eski `_enable_sadaka_donation`, `_sadaka_*`) | off | context; kampanyada UI gizlenir (product_info `includes/traits/trait-wdp-ajax-product.php:102`) |

### Global sekmeler → option anahtarları (varsayılan örnekleri)

| Sekme | Option | Örnek varsayılanlar (normalizer) | Kanıt |
|-------|--------|----------------------------------|-------|
| Normal (+ kısmen Tasarım alanları aynı option) | `wdp_button_settings` | primary `#0f608b`, popup text `Bağış Yap`, hızlı tutar düğmeleri `enable_amount_presets` default `'0'`, `amount_presets` hiç kaydedilmemişse `WDP_Form_Modules::default_amount_presets_csv()` (ondalıklı: `5, 10, 25, 50, 100`; 0 ondalık: `100, 250, 500, 1000, 2500`; kayıtlı değer değişmez), katı doğrulama: `WDP_Admin_Settings_Normalizer::$last_validation_error`, donor email/dedication/anonymous `'0'` | `includes/class-admin-settings-normalizer.php`, `includes/class-form-modules.php:206-220` |
| Hisseli | `wdp_shareholder_settings` | header `#0f608b`, email enable `'0'` | `includes/class-admin-settings-normalizer.php:280-314` |
| Başarı | `wdp_success_settings` | buton renkleri, sadaka toggle label | `includes/class-admin-settings-normalizer.php:335-353` |
| Progress | `wdp_progress_bar_settings` | fill/pending/height | `includes/class-admin-settings-normalizer.php:372+` |
| Modal | `wdp_modal_layout_settings` | panel %50, popup 540px, … | `includes/class-admin-settings-normalizer.php:433-456` |
| Gelişmiş | `wdp_delete_data_on_uninstall` | `'0'` | `includes/class-admin-page-renderer.php:125` |
| Stil paketleri | `wdp_button_settings` (+ share/progress/success merge) + `wdp_custom_style_presets` | `WDP_Style_Presets` | `includes/class-style-presets.php` |

**AYARLAR çapraz kontrol:** Hızlı tutar düğmeleri için AYARLAR “genel kapalıysa ürün açık olsa da gelmez” → kodla uyumlu (`includes/templates/class-form-fields-renderer.php:101-111`). E-posta global anahtarı AYARLAR’da “Tasarım → E-posta”; kodda `enable_donor_email` (`includes/class-admin-settings-normalizer.php:137`, context `includes/class-donation-product-context-service.php:138`) — etiket/option adı eşleşmesi tutarlı.

---

## h) Form akışı (sıralı)

### A) Gömülü form

1. PHP: shortcode/blok/şablon → `WDP_Templates` / Modal_Shell / Form_Fields HTML  
2. `WDPApp.init` → `formInitializer.inline` (`assets/js/src/bootstrap/init.js:47-49`)  
3. `form.setup` / phone / wizard / progress

### B) Lazy buton (liste/döngü)

1. Buton `data-wdp-lazy`  
2. Niyet: pointerenter/focus/touchstart → HTML prefetch (`assets/js/src/lazy-modal.js:1-5`)  
3. Idle prefetch: `startIdlePrefetch` (`assets/js/src/bootstrap/init.js:60-62`); sunucu `wdp_lazy_idle_prefetch` filtre default 3 (`includes/traits/trait-wdp-assets-registry.php:318`)  
4. Tık → `wdp_render_modal` (nonce zorunlu değil) → HTML cache (ürün+para+dil anahtarı) → `WDPApp.modal.open`

### C) Modal açılış → iskelet → product_info

1. `modal.open` → skeleton busy: `wdp-is-skeleton`, `aria-busy`, kontrol kilidi (`assets/js/src/modal.js:318-341`)  
2. `runModalOpenInit`: değer koru → `resetForm` → `form.setup` → phone → shareholder → wizard → restore → **yeniden kilit** (`assets/js/src/modal.js:357-401`)  
3. `WDPApp.product.fetchProductInfo` → POST `wdp_get_product_info` + nonce; `product_id≤0` ile istek yok (`assets/js/src/product.js` `isValidProductId`, `assets/js/src/modal.js` `openModal`)  
4. PHP: eksik/geçersiz id `wp_send_json_error(..., 400)`; güvenlik reddi 403/429 (`json_error`); yayımlı ürün `success:true` (katalog gizliliği düşürmez) (`includes/traits/trait-wdp-ajax-product.php`). Ön yüz 400/403/429 için form hatası veya toast; 403 nonce bir kez yenilenir.  
5. Yanıt: fiyat/hisse/sadaka HTML normalize; skeleton kapanır (product/modal işbirliği)  
6. Watchdog: uzun skeleton uyarısı (`assets/js/src/modal.js:304-314`)

### D) Doğrulama → sepete ekle / ödemeye git

1. CTA HTML: JS hazır olana dek `disabled` + `.wdp-loading` + `.wdp-cta-gate__hit` kaplama (`includes/templates/class-modal-shell-renderer.php` `render_form_action_button`). Kaplama tıkı kuyruğa alınır; native disabled tık yutmaz.  
2. `WDPApp.formCtaReady` (`assets/js/src/form/cta-ready.js`): `markFormReady` submit bağlanınca kilit açar; `queueCta` + `waitForFormReady` (5 sn) sonra **aynı** `_wdpSubmitHandler` bir kez (`invokePluginSubmit`) veya görünür hata. `requestSubmit` / native click yok — form `action=""` yerel belge gönderimi ürün sayfasını yeniden yüklemez. Handler bağlıyken kuyruk devre dışı; işlem sürerken ikinci tık yutulur (tıklama başına ≤1 istek). `event-manager` yedek submit **önce** `preventDefault` (handler bağlı olsa da), sonra kuyruk / aynı handler — sessiz `return` yok. İskelet kilidi `await-js` düğmeyi `await` diye işaretler; açılınca `markFormReady` (`assets/js/src/modal.js` `lockSkeletonControls`).  
3. CTA tık / Enter / iOS «Git» → `WDPApp.form` validate (`assets/js/src/form/validate.js`, `assets/js/src/form.js` submit yolu). `onWdpFormSubmit` **her zaman önce** `preventDefault` (doğrulama reddi, belirsiz tutar, istisna). Enter son alanda `invokeEnterSubmit` (eklenti yolu, tek istek). False ise: hatalı alanı içeren her katlanmış hissedar kartı + sihirbaz adımı açılır (`revealInvalidFieldContainers` / `formWizard.revealInvalidSteps`); ilk hatalı alana odak + kaydır; her alanın altında `.wdp-input-error` (aria-invalid + aria-describedby; ilk mesaj `role=alert` bir kez duyurulur). Fiyat alanı: mesaj `.wdp-price-field` altına (para birimi kabuğunun içine değil). Açık kabuk `getLiveDonationForm` ile `.wdp-modal.show` / gömülü form (gizli tembel modal seçilmez).  
4. `submitFormData(form, isCheckout)` → `formAjax.submitFormData` (`assets/js/src/form.js:205-207`, `assets/js/src/form/ajax.js:576+`). `directFormSubmit` de `form.submit()` değil aynı AJAX.  
5. POST `action=wdp_ajax_add_to_cart` + `security` + alanlar + `wdp_ajax_flow`  
6. PHP: `ajax_add_to_cart` → rate/nonce → doğrulama → `WC()->cart->add_to_cart` (+ sadaka satırı) (`includes/traits/trait-wdp-ajax-cart-add.php`)  
7. Başarı: mini-cart UI; checkout ise yalnız `checkout_url` (Woo) ile yönlendirme — URL yoksa sepete eklendi bildirimi (`assets/js/src/form/ajax.js` `handleAjaxResponse`). Sepete ekleme sonrası **sayfa yenileme yok**; `fallbackCartUpdate` yalnız `wdp_ajax.flags.reload_after_add_to_cart` (filtre `wdp_reload_after_add_to_cart`, varsayılan kapalı) iken `location.reload` (`assets/js/src/cart/woo.js`).  
8. Ağ hatası: `verify_submission_in_cart` kurtarma (`tryRecoverCartAfterAjaxFailure` `assets/js/src/form/ajax.js:517+`)  
9. E2E: kabuk açıkken ürün sayfası belge yeniden yüklemesi **NATIVE-SUBMIT-RELOAD** (`tests/e2e/helpers/native-submit-guard.mjs`; matris + capture + uzak quick, salt okur).

---

## i) Paketleme ve dağıtım

| Mekanizma | Ne yapar | Kanıt |
|-----------|----------|-------|
| `npm run pack` | `build` + `scripts/package-wp-plugin.sh` | `package.json:14` |
| `.distignore` | ZIP dışı: node_modules, .env*, docs, tests, tools, scripts, vendor… | `.distignore:4-38` |
| `scripts/package-wp-plugin.sh` | rsync exclude → admin CSS minify → (DEST’te tools yoksa bundle yeniden denemesi uyarıya düşebilir) → prune → `build/woo-donation-popup.zip` | `scripts/package-wp-plugin.sh:57-119` |
| `npm run deploy:staging` / `deploy:ikram` | Ortak `scripts/lib/ship-core.mjs` (e2e yok). `--dry-run` uzak yazmaz; `--rollback` son yedekten. | `scripts/deploy-staging.mjs`, `scripts/deploy-ikram.mjs` |
| `npm run ship:staging` / `ship:ikram` | Güvenli zincir + (çıkış 0 ise) `e2e:quick`. Ortam farkı yalnız profil. | `scripts/ship-staging.mjs`, `scripts/ship-ikram.mjs`, `scripts/lib/ship-core.mjs` |
| `npm run ikram:wp` | Ikram WP-CLI köprüsü (yalnız alias `ikramaid`; kara liste yıkıcı komutlar) | `scripts/ikram-wp.mjs`, `scripts/lib/ikram-wp-guard.mjs` |
| Canlı kilidi | İzin listesi: `staging30.hedefdernegi.org` + `ikramaid.uk`. Kilit klasör yoluna göre (`allowedRoot`). Kara liste: `hedefdernegi.org` (canlı). Uzak hedef **tek kaynak** = profil JSON + `ALLOWED_DEPLOY_TARGETS`. `.env.deploy*` / `.env.e2e*` hedef anahtarları (`DEPLOY_SITE_URL`, `DEPLOY_WP_PATH`, `DEPLOY_SSH_ALIAS`, `DEPLOY_SSH_*`, `E2E_BASE_URL`) uzak profilde kullanılmaz (farklıysa tek satır uyarı; canlıysa `KARA LİSTE`; koşu profille devam). `spawnGuarded` üçlüsü yine izin listesiyle birebir. | `scripts/lib/deploy-guards.mjs` `applyAllowlistOverEnv` |
| Uzak doğrulama | `validateRemoteSiteUrl` birebir eşleşme | `scripts/lib/deploy-guards.mjs` |
| `npm run ship:staging` | güvenli zincir + `e2e:quick --open-report` | `scripts/ship-staging.mjs` |
| Rsync dışlama | `.distignore` tek kaynak (`pack-excludes.mjs`) | `scripts/lib/pack-excludes.mjs` |

### Kod kalitesi araçları

Yalnız geliştirme bağımlılığı. Dağıtım ZIP’ine ve hiçbir siteye girmez (`.distignore` + `package-wp-plugin.sh` prune; birim test `tests/unit/js/lint-pack.test.mjs`).

| Araç | Komut | Yapılandırma | Kanıt |
|------|-------|--------------|-------|
| PHPCS + WPCS + PHPCompatibilityWP | `npm run lint:php` | `phpcs.xml.dist` (WordPress-Extra, Docs hariç; text domain `woo-donation-popup`; önek `wdp`/`WDP`/`hdf`; WP 5.0 / PHP 7.4) | `scripts/lint-php.mjs` → `build/lint/phpcs.json\|md` |
| PHPStan 5 + WP/Woo stubs | `npm run analyse:php` | `phpstan.neon` (`includes/`, `templates/`, `blocks/`, `woo-donation-popup.php`; `tests/` `build/` hariç) | `scripts/analyse-php.mjs` → `build/lint/phpstan.json\|md` |
| WordPress Plugin Check | `npm run plugin-check` | Yerel WP `build/local-wp` + WP-CLI phar; eklenti **dağıtım ZIP**’inden; ağ yoksa atla | `scripts/plugin-check.mjs` → `build/lint/plugin-check.json\|md` |
| Baseline | `tools/lint-baseline/` (git) + kopya `build/lint/` | PHPCS JSON parmak izi; PHPStan `phpstan-baseline.neon` | `scripts/lib/lint-baseline.mjs` |
| PHPCBF (WPCS) | `npm run lint:php:fix [-- dosya]` | `phpcs.xml.dist` | `scripts/lint-php-fix.mjs` (dosyayı yerinde düzeltir; sonra `lint:php`) |
| Rector | `npm run rector:dry` | `rector.php` (kural kümesi boş; `WDP_RECTOR_RENAME=1` → 6-C "sadaka"→"addon" sınıf/yöntem adı kuralları, `tools/rector/rename-map.json`) | `scripts/rector-dry.mjs`; harita: `npm run sadaka:inventory` (DB/meta anahtarı + kanca adı **dokunma** listesi dahil). Yalnız kuru çalıştırma |
| ESLint / Stylelint | `npm run lint:js` / `lint:css` | `eslint.config.mjs` (assets/js, ES2022 betik), `.stylelintrc.json` (recommended) | `scripts/lint-front.mjs`; baseline `tools/lint-baseline/baseline-eslint.json`, `baseline-stylelint.json` (`lint:js:baseline`/`lint:css:baseline`); **`verify:lint-front` yalnız YENİ hatada kırmızı** |
| jscpd | `npm run dup:js` | `.jscpd.json` (assets/js + assets/css) | `scripts/dev-audit.mjs dup` → özet `build/handoff/FAZ6-HEDEF-LISTESI.md` (JSCPD bölümü) |
| Ölü kod (shipmonk/dead-code-detector) | `npm run dead:php` | `phpstan.dead.neon` (phpstan.neon + rules.neon; baseline'sız) | `scripts/dev-audit.mjs dead` → FAZ6-HEDEF-LISTESI.md (DEADCODE bölümü). WP kanca/dinamik geri çağrılar tanınmaz: silmeden elle doğrula |
| lint-staged | `npm run lint:staged` | `.lintstagedrc.json` (PHP: `scripts/lint-staged-php.mjs`; JS/CSS: lint-front `--files`) | Yalnız verilen dosyalarda baseline dışı yeni hata → çıkış 1 (git hook'a bağlı değil) |

Bu araçların yapılandırmaları (`rector.php`, `eslint.config.mjs`, `.stylelintrc.json`, `.jscpd.json`, `.lintstagedrc.json`, `phpstan.dead.neon`) `.distignore` ve `package-wp-plugin.sh` ile dağıtım paketinden dışlanır; hiçbiri siteye kurulmaz (doğrulandı: ZIP içinde 0 eşleşme).
| verify kapısı | `npm run verify:lint` (`verify` zinciri) | `git diff -U0` değişen satırda baseline dışı yeni hata → kırmızı; mevcut hata uyarı. Tam tarama yok. | `scripts/lint-verify-gate.mjs` |
| Kurulum | `node scripts/install-lint-tools.mjs` | composer 2.10.3 + WP-CLI 2.12.0 SHA256; `vendor-dev/` | `tools/lint-tools.json` |

Mevcut hatalar listelenir, **düzeltilmez** (ilgili faz). Yeni/değişen satır baseline’a sığınamaz.

**Güvenli kurulum zinciri (`ship-core.mjs`, staging + ikram):** 1) `verify` + `test` + `pack`; kanarya TEMİZ değilse dur. 2) `remote:discover` REMOTE-BLOCKED kuralı (ölçüm/SMS aktif → çıkış 3, kurulum yok). 3) Ön anlık görüntü `build/migration/<env>-pre-<sürüm>-<zaman>.json` (git dışı; değer konsola yok). 4) Yedek: izinli kök `wdp-backups/` altında eklenti zip + yalnız `wdp_*` seçenek JSON. 5) rsync (`--delete` yalnız eklenti dizini) → etkinleştir + `WDP_Migrations::maybe_run` + önbellek. 6) Sağlık (otomatik, siteye özel URL yok): `wp eval-file` ile PHP fatal yok / eklenti aktif / sürüm = paket / `needs_run()=false`; HTTP (Node fetch, tarayıcısız) ana sayfa, Woo mağaza, ilk yayımlanmış gerçek ürün, kısa kod/blok sayfası (`[wdp_` / `wp:wdp` / `woo-donation` / Elementor `wdp-donation-form`/`wdp-donations`; yoksa atlanır), wp-admin. HTTP istekleri `wpCliAuth` çerezi ile (Coming soon duvarı yönetici gibi). Her biri 200, critical/fatal yok; ürün ve eklenti sayfasında `wdp-` işaret. Tek satır özet. 7) Sağlık KIRMIZI → otomatik geri dönüş (zip + `wdp_*` JSON + önbellek + sağlık tekrar) ve çıkış ≠ 0. 8) Son anlık + `migration-compare`: KAYBOLDU/VARSAYILANA/DEĞİŞTİ > 0 → UYARI, çıkış **2**, geri dönüş yok (Claude karar verir); sonra kanarya (yalnız eklenti seçenekleri değişebilir). `--dry-run`: uzak yazma 0, plan `build/ship/<env>-<zaman>.md`.

### Göç provası

Canlı/staging’de göçü çalıştırmadan önce yerel prova. Eklenti kodu (PHP/JS/CSS) bu araçlarla değişmez. Değerler yalnız `build/migration/*.json` içine yazılır (git dışı); konsol ve `.md` özetinde anahtar adı, sınıf, tür, sha256 ilk 12.

| Komut | Ne yapar | Kanıt |
|-------|----------|-------|
| `npm run migration:snapshot -- --env local --label <etiket>` | Eski+güncel kaynak ağacından anahtar çıkarır; `wdp_%` + eski önekler + ürün meta; WC mağaza ayarları salt okunur. `--env staging\|ikram`: profil `ssh.alias/wpPath/siteUrl` + `findTargetById`/`findTargetByAlias`; komut `wp --path="$HOME/…" eval-file` (`spawnGuarded`, yalnız Claude; birim testte spawn yok). Eval yazma yok. Uzak payload gzip+base64 + `fold -w 76` (OpenSSL `base64 -d` uzun satırda sessiz 0 bayt üretmesin); boş decode çıkış 97. Anahtar kümesi ayrı uzak geçici dosya (`WDP_MIG_KEYS_FILE`), PHP’ye `define` enjekte edilmez. stdout boşsa stderr 300 + çıkış kodu. | `scripts/migration-snapshot.mjs`, `tests/e2e/helpers/migration-snapshot.php`, `buildGuardedEvalFileCommand` |
| `npm run migration:rehearsal -- --from 10.3.1` | Temiz yerel WP+WC → eski eklenti (`build/migration/source/10.3.1/woo-donation-popup` veya `onceki.zip` 10.28.12) → görüntü → güncel kopya + `upgrader_process_complete`/`maybe_run` → görüntü → karşılaştır → göç 2. kez (idempotent). | `scripts/migration-rehearsal.mjs`, `tests/local-wp/migration-ops.php` |
| `npm run migration:compare -- --before a.json --after b.json` | Sınıflar: KORUNDU, **KORUNDU (tür)** (sayısal eşit: `"12"`/`12px` → 12), TAŞINDI, DEĞİŞTİ, VARSAYILANA DÖNDÜ, KAYBOLDU, YENİ, **BEKLENEN DEĞİŞİM**. Çıkış 2: KAYBOLDU/VARSAYILANA DÖNDÜ/DEĞİŞTİ > 0 (sürüm/önbellek/log/`wdp_migrated_*`/`wdp_css_signature` hariç; tür farkı fail değil). `--idempotent` birebir (BEKLENEN DEĞİŞİM ve KORUNDU (tür) fail değil). | `scripts/lib/migration-compare-core.mjs` |

Anahtar çıkarıcı: `get_option`/`update_option`/`add_option`/`get_post_meta`/`update_post_meta` + `wdp_` / `_wdp_` dizgi sabitleri (`scripts/lib/migration-keys.mjs`). TAŞINDI tablosu: `WDP_Migrations::BACKUP_OPTION` → `BACKUP_RESTORED_OPTION`. BEKLENEN DEĞİŞİM: `wdp_version`, `wdp_db_version`, `wdp_cache_version`, `wdp_list_cache_version`, `wdp_migration_log`, `wdp_migrated_*`, **`wdp_css_signature`** (assets registry CSS önbellek imzası; kurulumda yenilenir, kullanıcı verisi değil). 10.3.1 kaynağı `build/migration/source/10.3.1/woo-donation-popup/` (git dışı).

**10.3.1 → güncel doldurma (10.34.3):** `step_10_27_0` → `fill_stored_options` → `WDP_Admin_Settings_Normalizer::rewrite_stored_options`. Eski sıra `array_merge($current, $clean)` normalizerin boş istek varsayılanlarını kullanıcı değerinin üstüne yazıyordu (`ui_border_radius` yokken 4 radius → 10; layout anahtarları → eksik-anahtar varsayılanı). Yeni sıra `array_merge($clean, $current)`: eksik anahtar dolar, kayıtlı değer korunur; `ui_border_radius` yoksa legacy radius’tan tohumlanır (`seed_ui_border_radius_from_legacy`). Kayıtlı **0** (keskin köşe, bulanıklık, kenarlık kalınlığı) korunur: anahtar varsa ve `''` değilse kullanılır; yalnız yoksa/boşsa varsayılan. Kanıt: `tests/unit/Migration1031SettingsPreserveTest.php`.

`.env.deploy` / `.env.e2e` / `.env.*.ikram` **okunmadı** (görev yasağı); yalnızca anahtar adları şablonlarda belgelidir. Uzak hedef env’den gelmez: `tests/e2e/profiles/*.json` + `ALLOWED_DEPLOY_TARGETS`. Env’de hedef anahtarı varsa ve listedekinden farklıysa koşu durmaz; `UYARI: <dosya> içindeki hedef anahtarları kullanılmıyor (profil tek kaynak)` (canlıysa ayrıca `KARA LİSTE`). Değer yazılmaz. Sır anahtarları (`E2E_USER` / `E2E_PASS` / coming soon) okunur; `wpCliAuth` profillerinde parola gerekmez.

**KAYIT:** `ikramaid.uk` izni Ikram Aid yayına alınmadan önce **KALDIRILACAK** (`IKRAM_ALLOW_REMOVAL_NOTE` in `scripts/lib/deploy-guards.mjs`).

---

## j) E2E altyapısı (kısa)

| Öğe | Değer |
|-----|--------|
| Komutlar | `e2e:quick`, `e2e:full`, `e2e:matrix`, `e2e:conflicts`, `e2e:remote-smoke`, `e2e`, `e2e:baseline`, `e2e:accept`, `e2e:stability`, `e2e:perf`, `e2e:catalog-explain` (`package.json`) |
| Ortam | Profil JSON `tests/e2e/profiles/*.json` (uzak URL/SSH/yol tek kaynak) + sır dosyası `.env.e2e` / `.env.e2e.ikram` (parola vb.); yükleyici `tests/e2e/helpers/env.mjs`. Opsiyonel `timeouts` `{ navigation, action, expect, settle }` ms — yoksa `resolveTimeouts`: yerel hızlı (nav 20s / action 8s), uzak nav 45s / action 15s. staging-hedef + ikram-aid `navigation: 60000` (sunucu yavaş). |
| Çıktı | `build/e2e/current/<ortam>/<cihaz>/`; baseline `tests/e2e/__baseline__/<ortam>/<cihaz>/` |
| Manifest | `run.json` (`tests/e2e/helpers/run-io.mjs`) |
| Eşik | sayfa varsayılan **%0.5**; kabuk popup/panel **%0.1** |
| Yükseklik | Kabuk (popup/panel) ekranı viewport; bütünlük = kabuk kökü görüntü alanında tam **veya** kaydırınca son form öğesi + eylem çubuğu görünür (`classifyShellCompleteness`). Kesik/eksik kabuk kırmızı. Tam sayfa (`classifyPageHeight`): `document.readyState === 'complete'` + son içerik bölgesi (`footer` / `[role=contentinfo]` / body’nin son görünür bloğu) DOM’da, üst kenarı ekranda ve ≥%90 görünür (veya alt kenar farkı ≤ 32 px; tam kesik kırmızı) + ekran yüksekliği ≥ `scrollingElement.scrollHeight` − 16 px. Kendi settle yüksekliğiyle kıyas yok. `tests/e2e/helpers/screen-completeness.mjs`, `capture.mjs` |
| Quick | Yalnız iPhone (WebKit) + değişen alan (`tests/e2e/area-map.json` + `git diff --name-only HEAD`); `--env ikram`; `--env local` TT5 yığın (`prepareLocalFullStack`, port `WDP_LOCAL_E2E_PORT` veya 8899); 4 işçi; `--all --device desktop` eski 70’lik küme |
| Full | 3 cihaz × gerçek ortam(lar), merge öncesi (`tests/e2e/run-full.mjs`) |
| Matrix | Yerel tema × mağaza pairwise (`tests/e2e/matrix.json`): TT5 + Storefront; TRY/EUR/USD/GBP; blok + klasik ödeme; HPOS açık/kapalı (her tema her ödeme türü, HPOS her durumda ≥2). 3 cihaz. Sipariş yalnız yerel (`cheque`). Koşucu `tests/e2e/run-matrix.mjs`; `--only <id>` / `--device <ad>`. Özet `build/e2e/matrix/summary.md`; ekran `build/e2e/matrix/<yapılandırma>/<cihaz>/`. Anlık görüntü SQLite kopyası; yapılandırmalar ayrı port + WP kopyasıyla paralel (varsayılan 3 işçi). Her hücre kendi `php -S` sürecini açar/kapatır; `PHP_CLI_SERVER_WORKERS` (varsayılan 2, `WDP_PHP_SERVER_WORKERS`) tek iş parçacıklı `-S` kuyruğunu hücre içinde paralelleştirir — sabit bekleme yok. Açık popup/panel: `getAnimations` bitişi + hesaplanan opaklık ≥0.99; form alanı merkezinde `elementFromPoint` modal içinde değilse **POPUP-OVERLAP** (`tests/e2e/helpers/shell-overlap.mjs`; matris + capture, uzak quick salt okur). Bağış senaryosunda kabuk açıkken ürün sayfası belge yeniden yüklemesi **NATIVE-SUBMIT-RELOAD** (`tests/e2e/helpers/native-submit-guard.mjs`; matris + capture + uzak quick, salt okur). |
| Conflicts | Uzak tema/eklenti çakışması: konsol kaynağı (eklenti kırmızı; başka eklenti/tema rapor, kırmızı değil), betik kopyası (intl-tel-input/select2/jQuery/Swiper + `window.wdp*` + `$`), telefon tek seçici **yalnız açık/görünür form** (kart içi gizli tembel form sayılmaz), ödeme CFE/Woo telefon, Curcy, CSS sızıntısı (eklenti `.css` route iptal karşılaştırması), form taşması **yalnız görünür eklenti öğesi** (display:none / visibility:hidden / aria-hidden kapalı liste / ekran okuyucu / kapalı ülke paneli hariç; bulgu `seçici genişlik>kapsayıcı kural=` + vurgulu ekran, kabuk açık). Mağaza: Woo `shopPath` + `.wdp-loop-donate`; hedef yoksa **atla** (zaman aşımı yok). Sipariş yok. `e2e:conflicts`; özet `build/e2e/conflicts/<env>/summary.md`. |
| Accept | `--env` + `--device`; yalnız Değişti+Yeni; functional hata 0 |

### Uzak keşif

Salt okunur envanter (yazma yok; `spawnGuarded` zorunlu). Claude çalıştırır; Cursor yalnız `--env local` veya sahte ssh birim testi.

| Öğe | Değer |
|-----|--------|
| Komut | `npm run remote:discover -- --env staging\|ikram` (yerel WP: `--env local`, SSH yok). Katalog teşhis: `npm run e2e:catalog-explain -- --env staging\|ikram` |
| Betik | `scripts/remote-discover.mjs` + `scripts/lib/remote-discover-lib.mjs` |
| Profil | `loadProfile` (`tests/e2e/profiles/*.json`); `ssh.alias` + `ssh.wpPath`; her `wp` çağrısında `--path`; `--skip-themes` yok |
| Çıktı | `build/discovery/<env>.json` + `.md`; kanarya `build/e2e/canary/<env>-baseline.json` |
| Engel | `facebook-for-woocommerce`, `official-facebook-pixel`, `google-listings-and-ads`, `google-site-kit` **veya herhangi bir aktif SMS eklentisi** (katalog/sınıf `sms`, ör. Netgsm) aktifse `REMOTE-BLOCKED` ve çıkış **3** |
| Giden veri statik | Kanca geri çağrıları Reflection + kaynak okuma (tetiklemez; tek seviye derinlik); Code Snippets `SELECT` (id/scope/priority/etkin + kanca/çağrı türü; ad/kod yazılmaz); snippet/kanca `wp_remote_*`/`curl_init`/`file_get_contents(http)`/`fsockopen` URL’si atama/`define`/`const`/`get_option` üzerinden yalnız host (`sabit` / `dinamik:<ad>` / `option:<anahtar>`; yol/sorgu/anahtar değeri yok); çağrı→fonksiyon→tüm `add_action`/`add_filter` kancaları (anonim gövde dahil); özet: sepete-ekleme ve sayfa görüntüleme zinciri evet/hayır; wp-cron sahip/sıklık/sonraki; WP Mail SMTP `Do Not Send` true/false + mailer + `pre_wp_mail` slug. SMTP `mail`/`smtp` ve Do Not Send=false → uyarı (engel değil). Çıktı `outbound_static` + MD «Giden veri statik denetimi» / «Snippet giden ana makineler». | `scripts/lib/remote-discover-lib.mjs` `EVAL_STATIC_OUTBOUND` / `extractOutboundHosts` / `summarizeOutboundChains` / `assembleReport` |
| Güvenlik | Sabit eval listesi; kanca/cron/snippet tetiklenmez (`do_action`/`apply_filters`/`wp_schedule`/`spawn_cron` yok); değer/e-posta/URL/anahtar yazılmaz; bağlantı hatasında en fazla 1 tekrar |
| Woo sayfa türü | `has_block('woocommerce/checkout'\|'woocommerce/cart')`, `has_shortcode`, içerikte `[woocommerce_checkout` / `[woocommerce_cart`, `CartCheckoutUtils::is_*_block_default()`. Sonuç: `block` / `classic` / `classic-in-builder` / `unknown`. İçerik yazılmaz. | `scripts/lib/remote-discover-lib.mjs` `classifyWooPageKind` / `EVAL_WOO` |

### Test ortamları ve profiller

| Profil | Dosya | Sırlar | Tema / oluşturucu | Para | Coming soon | SSH |
|--------|-------|--------|-------------------|------|-------------|-----|
| Hedef staging30 | `tests/e2e/profiles/staging-hedef.json` | `.env.e2e` + `.env.deploy` | Avada Builder | TRY `₺` | kapalı | alias `hedef-staging`, `~/www/staging30.hedefdernegi.org/public_html` |
| Ikram Aid | `tests/e2e/profiles/ikram-aid.json` | `.env.e2e.ikram` + `.env.deploy.ikram` | Blocksy + Elementor | GBP `£` | açık (paylaşım çerezi; option yazılmaz) | alias `ikramaid`, `~/www/ikramaid.uk/public_html` |
| Yerel | `tests/e2e/profiles/local.json` | `.env.e2e.local` | — | — | — | yok |

Siteye özel değer (sembol, ayırıcı, telefon ön eki, dil) testte sabit yazılmaz; profilden okunur. Uzak sayfa/ürün **tek kaynak WordPress/WooCommerce** (WP-CLI eval-file `tests/e2e/helpers/catalog-resolve.php`, salt okunur): mağaza `wc_get_page_permalink('shop')`; sepet/ödeme `wc_get_cart_url` / `wc_get_checkout_url`; bağış listesi = eklenti kısa kodu/bloğu/Elementor widget’ı veya Avada/oluşturucu meta’sında geçen **ilk yayımlanmış** sayfa. Ürün satırında `related_ids` + `upsell_ids` (`wc_get_related_products` + `get_upsell_ids`; kendi id elenir; yazma yok) — Benzer Bağışlar atlama/hata için uzak katalogda ID vardır (`applyRemoteCatalog` → `readRelatedProductIds`). Liste yoksa popup **mağaza döngüsü** `.wdp-loop-donate` / Bağış Yap; o da yoksa senaryo **ATLANIR** (hata değil). Tip `WDP_Donation_Type::for_product` (kopya yok; göç etmiş meta). Katalog explain: WP-CLI `eval-file` `--explain` bayrağını komut parametresi sanır; konumsal `explain` + `WDP_E2E_CATALOG_EXPLAIN=1` (`evalFileScriptArgs` / `evalFileEnvPrefix`). Her yayımlanmış ürün (id, ad, durum, görünürlük, purchasable, tip + bayrak açık/kapalı nedeni) → `build/e2e/catalog-explain-<profil>.md`; müşteri/sipariş/meta değeri yok. Komut `npm run e2e:catalog-explain -- --env staging|ikram` (`scripts/e2e-catalog-explain.mjs`, `spawnGuarded`). Roller yalnız yayımlanmış + katalogda görünür gerçek bağış ürünleri (permalink, `/product/{slug}` tahmini yok). Mutasyon fixture. `E2E_SHOP_PAGE` / `E2E_LIST_PAGE` / `E2E_PRODUCT_*` env uzak profilde kullanılmaz (tek satır uyarı, değer yok). Profilde ürün adı/ID sabiti yok. Katalogda yayımlanmış ürün yoksa ziyaretçi/liste/mağaza **atlanır**; ürün sayfası/form/panel/doğrulama/sepet fixture + yönetici. Fixture: `build/e2e/fixtures-<profil>.json` (private, işaretli) yönetici oturumunda; adres `get_permalink()` (sorgu dizesi dahil) — path `"/"` ana sayfa olarak kullanılmaz (hata). Uzak `allowMetaMutation: false`; koşu başı `assertRunMutationTargetsAreFixtures`. Uzak `E2E_BASE_URL` / `DEPLOY_*` env’den okunmaz; `resolveAllowedRemoteTarget` + izin listesi. Env farklıysa uyarı (durmaz); spawn üçlüsü yine birebir.

**E2E senaryo × ürün kaynağı** (`tests/e2e/helpers/catalog-core.mjs` `SCENARIO_PRODUCT_POLICY` / `decideScenarioProduct`):

| Tür | Senaryolar | Gerçek yayımlanmış ürün | Rol için gerçek yoksa |
|-----|------------|-------------------------|------------------------|
| Ziyaretçi / liste / mağaza | `visitor`, `list`, `shop-loop`, `loop-donate` | evet | **ATLA** (neden; hata değil) |
| Ürün / form / panel / sepet | `product-page`, `form`, `panel`, `validation`, `cart` | evet | fixture + **yönetici oturumu** |
| Popup | `popup` (liste; yoksa mağaza döngüsü Bağış Yap) | evet | **ATLA** — kaynak yok veya private fixture |

Private permalink (`https://site/?post_type=product&p=ID`) pathname `"/"` olsa da sorgu korunur (`navTargetFromUrl` / `pickFixtureNavTarget`). Panel fixture ürün sayfasından açılır. Popup: `resolvePopupSource` liste → mağaza → atla (`tests/e2e/helpers/catalog-core.mjs`).

**Mutasyon senaryo sınıfı (3I, `tests/e2e/helpers/mutation-policy.mjs`):**

| Sınıf | Senaryolar | Uzak | Yerel |
|-------|------------|------|-------|
| (i) product-meta | `amount-opts-*`, `form-fields-*`, `campaign-blocks-*`, `product-theme-*`, `shortcode-button-text`, `shortcode-form-outofstock` | Fixture ürün sayfası; yayımlı → **ziyaretçi**, uzak private fixture → yönetici (`donationViewContext`; katalog rolü yanıltmaz). Yalnız iphone. | Aynı (üç cihaz; fixture yayımlı) |
| (ii) local-only | `shortcodes-setup`, `shortcode-list-price-refresh`, `shortcode-tabs-aria`, `shortcode-bad-hash` | **ATLA** (neden; hata değil) — sayfa/kısa kod oluşturulmaz | Matris WP / `local` profil — liste sayfası `prepare-full` ile oluşturulur, **koşar** |

Uzakta site ayarı/sayfa yazılmaz. `npm run e2e:full -- --env local` yerel kanıt (üç cihaz; product-meta PHP `tests/local-wp/product-meta.php`, SSH yok). Yerel fixture’lar `WDP_E2E_PUBLISH_FIXTURES=1` ile yayımlanır (katalog/liste/popup koşar); uzakta private kalır.

**Sepet e-posta/ithaf gerileme (F9, `form-fields-cart-shows-email-dedication`):** Eklenti `display_donation_data_in_cart` 10.33.0 ile aynı (`includes/class-cart.php:388-479`; `git show 163fe09`). Store API `item_data` e-posta/ithaf basar (aynı filtre). 2/3 `form-fields` `onCart=/\/cart\/?/` + Hedef `wc_get_cart_url` kök/`/sepet/` 404. Asıl 404: Woo sepet sayfası `woocommerce_cart_page_id` **çöpte** (Hedef id 291 `trash`; `get_permalink` → `/?page_id=291` pathname `/`). Düzeltme (eklenti yok): `ensureWooCartPagePublished` (yalnız Hedef `allowMetaMutation`); `fillDonor` eksik alanda fail; teşhis JSON. `tests/e2e/helpers/staging-wp-meta.mjs`, `form-fields.mjs`.

Coming soon: WP-CLI `woocommerce_share_key` okunur veya `E2E_COMING_SOON_SHARE_KEY`; çerez `woo-share` (ziyaretçi liste). `asAdmin` private fixture, admin sekmeleri ve alt bağış `post.php` okuması (`wpCliAuth`: `wp user list --role=administrator` + `tests/e2e/.auth/<profil>.json` storageState; geçerliyse **aynı origin** için yeniden kullanılır). Bağışçı yüzeyleri (`asVisitor` + share): liste, popup/panel kabuğu, layout, yayımlı mutasyon formları, sadaka bağışçı adımı — oturumsuz context. `blog_public` ve coming soon option **değiştirilmez**.

### Uzak koşu güvenliği

Ölçüm/reklam ve sipariş yazımı `tests/e2e/helpers/network-guard.mjs` içinde. Her `BrowserContext` `installBrowserGuard` / `applyNetworkGuard` ile `context.route` alır (capture, auth, run-*, perf, diag, conflicts).

| Kural | Davranış |
|-------|----------|
| Tracker engeli | Uzak koşularda varsayılan ve **kapatılamaz** (env ile bile). Yerelde de açık. Liste: Facebook/Meta piksel, Google Analytics/GTM/Ads/pagead/ccm, DoubleClick, Bing, Clarity, Hotjar, TikTok, LinkedIn, Pinterest, Snap, Yandex (`mc.yandex.ru`), Segment, Plausible, Matomo (yaygın host/yol), `pixel.wp.com` / `stats.wp.com`. `fonts.googleapis.com` / `gstatic` ve sitenin kendi alanı engellenmez. Sayaç: hostname + adet (`blocked_trackers` → `run.json`); URL sorgu dizesi yazılmaz. |
| Canlı kara liste | `LIVE_HOST_BLOCKLIST` apeksi (`hedefdernegi.org` / www; staging30 hariç). HER istek iptal + `blocked_live` sayaç. **Kırmızı değil** (Avada önbellek kalıntısı). Özet + uyarı. `tests/e2e/helpers/network-guard.mjs` `isLiveBlockedHost`. |
| REMOTE-FOREIGN-WRITE | Profil `allowedHosts` dışına POST/PUT/PATCH/DELETE iptal + kırmızı. |
| Emekli host | `staging28.*` ve izinli alanın izinsiz kardeş alt alanları: GET dahil iptal + kırmızı `REMOTE-RETIRED-HOST`. Navigasyon `withCacheBust` uzak profilde bu host’lara gitmez. |
| Konsol | `ERR_BLOCKED_BY_CLIENT`, canlı font CORS, emekli ajax “access control” → `blocked-live` / `blocked-site` (eklenti hatası değil). `classifyBlockedConsoleError` / `assertNoConsoleErrors`. |
| Uzakta sipariş yok | Yalnız uzak profil (`isRemoteProfile`: `profile.remote` boolean varsa o; `ssh.alias` doluysa uzak; `id=local` yerel; `allowedHosts` yalnız 127.0.0.1/localhost ise yerel). POST `?wc-ajax=checkout`, Store API `/wc/store/v1/checkout` (POST/PUT), `admin-ajax.php?action=woocommerce_checkout`, ödeme formu POST (`wc_get_checkout_url()` yolu; sabit `/checkout/` veya `odeme` slug yok), `post-new.php?post_type=shop_order`, `wc-orders&action=new` → istek iptal + test kırmızı `REMOTE-ORDER-BLOCKED: <yol>`. GET ödeme sayfası serbest. Klasik ödeme `wc-ajax=update_order_review` / `update_shipping_method` sipariş sayılmaz (iptal + `remote_post_blocked`, kırmızı değil); gövde `woocommerce-process-checkout-nonce` yalnız `wc-ajax=checkout` / ödeme yolu POST / admin-ajax `woocommerce_checkout` için kanıt, `woocommerce_checkout_place_order` gerçek gönderim. |
| Uzakta POST varsayılan-red | Site alanına giden POST/PUT/PATCH/DELETE yalnız izin listesindeyse geçer: `wc-ajax` `add_to_cart` / `get_refreshed_fragments` / `remove_from_cart` (`apply_coupon` ve `update_order_review` yok, ödeme sayfasında da); Store API `/wc/store(/v1)/cart/*` ve `/batch` (gövdedeki tüm istekler cart yolundaysa); `admin-ajax.php` action yalnız `wp_ajax_nopriv_wdp_*` (includes/ taraması: `wdp_ajax_add_to_cart`, `wdp_get_cart_contents`, `wdp_get_cart_count`, `wdp_get_fresh_nonces`, `wdp_get_product_info`, `wdp_get_product_name`, `wdp_remove_cart_item`, `wdp_render_modal`, `wdp_verify_submission_in_cart`) + Woo sepet `woocommerce_add_to_cart` / `woocommerce_get_refreshed_fragments`; sepet formu (`wc_get_cart_url()`) `update_cart`/`remove_item`. **Profil eklentisi** `remoteReadOnlyPostActions` (yalnız JSON; kod kuralı değişmez): staging-hedef `wmc_get_products_price`, `hdf_side_cart_v8_get`, `fusion_get_webfonts_ajax` — gerçek sayfa okuma, özet `izinli-okuma`. Sayaç yazan (`fusion_form_update_view` vb.) engelli. Eklenti yönetici uçları ve sipariş uçları profil listesine konsa bile RED. `action` query / urlencoded / multipart FormData / JSON gövdeden okunur (`extractAjaxAction`; Playwright `postDataBuffer` yedek). Yönetici `wdp_save_*`, `wdp_apply_style_preset`, `wdp_import_style_preset`, `wdp_export_style_preset`, `wdp_recalculate_product_total`, `wdp_elementor_search_products` ve diğer `wp_ajax_wdp_*` (nopriv yok) iptal + kırmızı `REMOTE-ADMIN-WRITE-BLOCKED`. Diğer yazım iptal + `remote_post_blocked` (yol, sorgu yok, action adı serbest; 0 ise de `run.json` + konsol). Sipariş benzeri ayrıca kırmızı. Yerelde POST serbest. Form/panel/popup açık ekranda genel hata kutusu (`.wdp-form-error`, `.wdp-toast--error`; ör. «Ürün bilgileri alınamadı») senaryoyu kırmızı yapar (`errors` senaryosunda yalnız beklenen doğrulama serbest). Eklenti admin-ajax/REST `success=false` veya HTTP ≥400 da kırmızı (gövde yazılmaz; action + durum). |
| checkout-view-only | Uzakta ödeme sayfası açılır, ürün adı + Woo biçimli tutar doğrulanır; `fill`/`type`/`selectOption`/`check` yok, “Sipariş ver” tıklanmaz. Sipariş tamamlama atlanır (neden `skips`). **Yerelde sipariş yapılır** (`tests/e2e/helpers/place-order.mjs`): blok (`wp:woocommerce/checkout`) ve klasik (`[woocommerce_checkout]`); Place order rol/erişilebilir adla (`#place_order` varsayımı yok); Woo çekirdek cheque/cod/bacs. Blok ödeme: yalnız görünür alan (`visibleCheckoutField`) — önceki siparişin gizli fatura input’una fill yok. Sipariş sonrası `matrix-ops.php read-order` (`wc_get_order`, HPOS açık/kapalı): bağış satırı, tutar, para birimi, bağışçı alanları Türkçe karakter bozulmadan; anonim açıkken silinmez/maskelenmez. `e2e:full --env local` üç cihazda custom sipariş atlanmaz. Hisseli (≥2 hisse, `Ayşe Gül Çiftçi` / `Ömer Şahin İnce` + telefonlar öğe metasında) ve kampanya (tutar/ithaf) siparişi yalnız **iphone** (süre; meta cihazdan bağımsız). Matris `place-order` aynı yardımcıyı kullanır. |
| Oturum | Uzakta yönetici oturumu ortam başına bir kez (`tests/e2e/.auth/<profil>.json`). Geçerlilik (wp-admin) en fazla 1 kez; kilit dosyası ile işçiler paylaşır, kendileri giriş yapmaz. `wpCliAuth` form girişini hiç denemez. Form girişinde başarısızsa tekrar yok: “Giriş başarısız; Wordfence kilidini önlemek için tekrar denenmedi”. |
| Ortam kilidi | Aynı profilde aynı anda iki koşu (quick/full/ship/bootstrap/canary) yok: `build/e2e/locks/<profilId>.lock` (pid + başlangıç; ölü pid temizlenir). Farklı ortamlar paralel olabilir. `e2e:full` çocuk süreçleri ebeveynin kilidini paylaşır (`WDP_E2E_ENV_LOCK_*`). |
| Koşu defteri | Ortam+koşu başına `build/e2e/registry/<profilId>/<runId>.json` (`envId`, `siteUrl` hash, `runId`). Eski tek dosya `build/e2e/run-registry.json` okunmaz. Temizlik / kanarya / safe-remote-write / staging-wp-meta: defter `envId` ≠ etkin profil → DUR `REGISTRY-ENV-MISMATCH`; başka ortamın ID’siyle uzak komut yok. Takma ad (`staging`/`hedef`/`ikram`) → profil id (`staging-hedef`/`ikram-aid`) **tek yer** `resolveProfileId` (`profile.mjs`); defter/kilit/çıktı karşılaştırması profil id. |
| Çıktı yolları | `build/e2e/current/<profil>/`, `debug/<profil>/`, `traces/<profil>/`, `report/<profil>/report.html`, `CANARY-ALERT-<profil>.txt` — paralel koşular birbirini ezmez. Birim test etkin profilden yalıtık (`isolateUnitProfile`); ship `setActiveProfile` + `WDP_E2E_PROFILE_ID` sızdırmaz. |

Güvenli alan (10.34.0 + 10.34.4): alt CTA `env(safe-area-inset-bottom)` + JS `--wdp-safe-bottom` (iPhone-benzeri, env()=0 iken 34px taban). Kapat düğmesi başlık satırına hizalı (`top: 8px` mobil / `14px` masaüstü), form kutusuyla kesişmez, ≥44px dokunma; `--wdp-safe-top` 47px taban kapat `top`’una uygulanmaz (10.34.2 gerilemesi). Pay yalnız üst kenara yapışık kabukta (`wdp-flush-top`); yan panel içeriği zaten `padding-block-start` + `env(safe-area-inset-top)` alır. `viewport-fit=cover` enjekte edilmez. 10.34.2 `--wdp-cta-clearance` kaydırma payı. `assets/js/src/core/cta-viewport.js`, `assets/css/src` layout/mobile-polish/side-panel.

**Tutar biçimi (10.34.4 + 10.34.15):** Tek yardımcı: PHP `WDP_Utils::format_localized_amount` (wc_price sayı kısmı, ondalık kırpılmaz) + `format_min_placeholder` (`min: ` öneki); JS `formatPrice` / `formatMinPlaceholder`. Açık / hata / `product_info` sonrası yer tutucu aynı. Sembol konumu `wdp-currency-pos-{left|left_space|right|right_space}` (right/right_space `flex-direction: row-reverse`). Liste kartı `format_price_html` / `wc_price`. Matris yer tutucu + sembol konumu iddiası `tests/e2e/helpers/matrix-scenarios.mjs`. **Bağışçı ayrıştırma (10.34.15):** `parse_donor_amount` / `parseMoneyDetailed` — geçerli 1–3+3 grup binlik (`1.250` her zaman 1250); gruplamayan son ayırıcı ondalık adayı. TRY 0dp `50,00`/`10.00` → 50/10; `10,50` → kuruş uyarısı (yuvarlama/100× yok). EUR `10.50`→10.5, `10,505`→10505. Sunucu aynı kural. Vektörler `tests/fixtures/amount-parse-vectors.json`. Matris `amount-ambiguous` + `amount-tr-comma`. Test doldurma `pickDonationFillAmount`: 0 dp düz tam sayı; sayfa `wdp_ajax.currency` profili ezer (`mergeFillCurrency`). **Yerel gönderim / reload (10.34.14):** `amount-ambiguous` Enter basmaz (fill+click); iPhone’da `/cart/` kesen gezinme önceki ürün jetonuna `location.reload` (`fallbackCartUpdate`, fragment hatası). Submit her zaman `preventDefault`; sepete ekleme sonrası reload yalnız `wdp_reload_after_add_to_cart` (varsayılan kapalı). E2E `NATIVE-SUBMIT-RELOAD`.

**Ürün sayfası görünümü + ilgili ürünler (10.34.5 / 4E):** Ürün sayfası birincil UI `resolve_product_page_display` (kısa kod > auto_place `display`). Native `form.cart` gizleme 10.34.5’te yalnız `.summary` / `.entry-summary` idi; 10.34.6 tüm `form.cart` + `:not()` döngü/ilgili/upsell. Konu `.related` / `ul.products` bölümü değil (PHPUnit `test_hide_cart_css_spares_loop_forms`; sahte sayfa `css-hide-source-playwright`). Gizli ilgili bölüm: CSSOM ilk gizleyen ata + kural seçicisi + stil yolu (`tests/e2e/helpers/css-hide-source.mjs`). Kaynak `/wp-content/plugins/woo-donation-popup/` veya `style#wdp-*` → `plugin-hides-related` kırmızı. Tema/başka eklenti yolu (`ct-hidden-sm` vb.) → `theme-hides-related` atlama (`evidence: css-source`, yalnız eklenti dışı dosya yolu). Debug `loop-cards-product-css-source.txt`: etiket/sınıf/id, computed, seçici, yol — ürün adı yok. Matris `related-cards`: TT5+Storefront × 3 cihaz, bölüm + kartlar görünür.

**Yerel sepete ekle yok (10.34.6, veri bütünlüğü):** Bağış ürünü tekil sayfada Woo `woocommerce_template_single_add_to_cart` kancadan çıkarılır (`unhook_native_single_add_to_cart`); `sticky.*add.?to.?cart` adlı kopya callback’ler `$wp_filter` taramasıyla düşer (tema CSS seçicisi yok). CSS yedek: tüm `form.cart` / `.single_add_to_cart_button` / `[class*="sticky-add-to-cart"]` gizlenir, döngü/ilgili/upsell/koleksiyon `:not()` ile görünür kalır. `woocommerce_is_purchasable` değişmez. Sunucu: bağış formu/`wdp_ajax_add_to_cart` değilse `woocommerce_add_to_cart_validation` + Store API `woocommerce_store_api_validate_add_to_cart` bağış ürününü reddeder (`should_reject_native_add_to_cart`: ürün bayrağı `yes` veya `auto_place=yes`) + `wc_add_notice` hata. Matris `native-cart-hidden`: 3 görünüm × 3 cihaz × 2 tema. PHPUnit `CartNativeAddToCartTest`. `src/Modules/EntryPoints/class-auto-placement.php`, `includes/class-cart.php`.

**Ürün sayfası giriş noktası (E2E, 3G):** Sayfada görünür tam olarak **bir** eklenti girişi (gömülü form veya eklenti düğmesi — `data-wdp-display` / `.wdp-open-side-panel` / `.wdp-open-modal` / `.hdf-donation-modal-wrapper.wdp-donation-form`; tema düğmesi sayılmaz). 0 veya >1 → HATA. Düğmeyse tıklanır, kabuk (panel/popup) gerçek tipe göre açılır; form ise doğrudan. `resolve_product_page_display` farklıysa **UYARI** (`ayar inline, sayfa düğme gösteriyor — tema/oluşturucu şablonu`) — HATA değil (Avada oluşturucu şablonu). Döngü/ilgili kartlar `LOOP_EXCLUDE_SEL` (klasik + Woo blok + `.wdp-loop-donate`). Matris `product-entry-button`: TT5 kısa kod `[wdp_donation_button_panel]`. `tests/e2e/helpers/{product-page-ui,capture,matrix-scenarios}.mjs`.

**Çoklu para birimi gösterimi (uzak, salt okunur):** Profil `currencySwitch` (staging-hedef `{param:"wmc-currency",codes:["EUR","USD"]}`; Ikram yok). Sepet hazır `gotoWooCart` (`body.woocommerce-cart`); boşalt `emptyCart` (Store API, origin yoksa HTML). Store API yazma (`DELETE /cart/items`) Nonce ister (`Nonce` / `X-WC-Store-API-Nonce`; sayfa `wcStoreApiNonce` / `wc.wcSettings` / `wp.apiFetch.nonceMiddleware` veya GET yanıt başlığı). İstekler `page.request` (aynı oturum çerezi; sayfa konsoluna 401 yazılmaz); nonce yoksa DELETE yok, HTML yedek. HTML yedek yalnız **görünür** sepet formu/blok `a.remove` (`CART_PAGE_REMOVE_SEL`; tema başlık mini sepeti yok). Liste/form Woo fiyat HTML; sepet tutar/sembol Store API `GET /wp-json/wc/store/v1/cart` (nonce’lu). Dil metni yok. Curcy’ye özel eklenti kodu yok; test yalnız profil sorgu parametresi. `tests/e2e/helpers/{currency-switch,store-api,checks}.mjs`.

**e2e:quick süre:** `captureAll` bölüm süreleri `run.json` `sections` + en yavaş 5 konsol. Hedef <300 sn (uzak iPhone; 3X ölçü 384–390 s, en pahalı `popup/panel ekranları` ~150 s). Aynı koşu `wdp_e2e` jetonu (`beginNavCache`) + paylaşılan ziyaretçi/yönetici context (çoklu sekme); panel ürün sayfası önbelleğini yeniden goto etmez; popup kapat/errors taze goto yok. Kapsam aynı. Para birimi a11y/checkout ile paralel; sepet senaryosu ürün sayfasını emptyCart öncesi yeniden yüklemez; sabit `waitForTimeout` sepet/ödeme yolunda olay bazlı.

**Ekran görüntüsü stabilizasyonu (10.34.2, yalnız test):** `STABILIZE_SHOT_CSS` (`tests/e2e/helpers/stabilize-shot-css.mjs`) çekim anında `#wpadminbar` + WooCommerce Coming soon bandı (`#coming-soon-footer-banner`, `.coming-soon-footer-banner`, `.woocommerce-coming-soon-banner`, `.woocommerce-store-notice`, `.woocommerce-info`) gizler. Sınıfı kaçan kısa “Coming soon mode” düğümleri `hideComingSoonNoticeForShot` ile yalnız çekimde kapanır. İşlevsel tıklamada yok; eklenti CSS/PHP bu seçicileri gizlemez. Katalogdaki Coming soon sayfa gövdesi (asAdmin içerik) site görünürlüğü değiştirilmeden durur. `tests/unit/js/stabilize-shot-css.test.mjs`.

### Cihaz projeleri ve komutlar

Öncelik: 1) iPhone (WebKit, iPhone 15, dokunmatik, güvenli alan 47/34) 2) Android (Chromium, Pixel 7) 3) masaüstü (Chrome 1440). Tanımlar: `tests/e2e/helpers/devices.mjs`, `tests/e2e/playwright.config.mjs`.

| Komut | Davranış |
|-------|----------|
| `e2e:quick` | iPhone + alan süzgeci; hedef &lt; 5 dk |
| `e2e:full` | Ortam × cihaz **paralel** (ayrı süreç; `current/<ortam>/<cihaz>/run.json` ezilmez; ebeveyn `current/run.json` birleştirir). **iPhone üç çocuk** (`full-slices.mjs`): `iphone` çekirdek (core/shell/sadaka/a11y/checkout-flow/layout) + `iphone-mut` (amount-options/form-fields/product-theme; staging30 ~598 s) + `iphone-mut2` (campaign-blocks/shortcodes/empty-price; staging30 campaign-blocks 512 s — 10.34.13 tek dilim 1223 s / 20 dk kesildi). Mutasyon kilidi yalnız mut dilimlerinde (`wantAnyMutationArea`); android/desktop kilit almaz. Her çocuk üst süre **20 dk**. Mut dilimleri birbirini kilitlemesin diye ayrı dalga (`partitionSpawnWaves`): yerelde çekirdekten sonra sırayla; uzakta ilk mut çekirdek/android/desktop ile paralel, `mut2` sonra. Özet satırları profil id ile tekilleşir (`dedupeFullSummaryRows`). Katalog `fixture_related` private fixture related/upsell. amount-opts: genel `enable_amount_presets` WP’den yalnız açık/kapalı (`read-amount-presets-flag.php`); kapalı → `setting-off`+`wp-data` atlama; açıksa düğme yoksa HATA. empty-price list-visible: `E2E_LIST_PAGE` yok → `no-list-page`; private fixture → `private-fixture`. Yerel `checkout-flow-early-cta-iphone`: handler yokken kuyruk kanıtı. Çocuk üst süre → SIGTERM/SIGKILL, kırmızı; ebeveyn koşu sonu kanarya + temizlik + `--repair`. SIGTERM/SIGINT: tarayıcı kapanır, kilit bırakılır, meta geri yüklenir. Hedef: 2 ortam × 3 cihaz &lt; 15 dk. `--env local`: ebeveyn `prepareLocalFullStack` (TT5 matris WP, port 8899 veya `WDP_LOCAL_E2E_PORT`, fixture yayımlı + liste + panel MU); çocuk süreçler aynı PHP’yi paylaşır. Yerel üç cihaz hedef ≤ 10 dk. Yerel `checkout-flow`: blok/klasik ödeme + cheque/cod/bacs ile sipariş tamamlanır (atlanmaz); doğrulama `read-order`. Hisseli+kampanya siparişi yalnız iphone. `loop-cards-shop`: görünür kart yoksa **kırmızı** (Playwright `visible=true`; `.first()` gizli şablon kartına denk gelince timeout yutulmaz). |
| `e2e:matrix` | Yerel WP+SQLite tema/Woo matrisi; `--only` / `--device`; sipariş yalnız yerel. `place-order` `tests/e2e/helpers/place-order.mjs` (HPOS açık+kapalı × blok+klasik). |
| `e2e:conflicts` | Uzak çakışma denetimi (konsol / betik kopyası / alan / CSS sızıntısı / önbellek nonce). `npm run e2e:conflicts -- --env staging\|ikram [--device iphone\|android\|desktop\|all]`. Sipariş yok; ödeme formu doldurulmaz. Form taşması: görünür öğe + seçici/genişlik/kural; telefon: açık form; mağaza: WP shop + döngü düğmesi, yoksa atla. Çıktı `build/e2e/conflicts/<env>/summary.md`; ekran yalnız bulguda (taşmada öğe vurgulu, kabuk açık). Yerel kanıt: `--env local` (TT5+Storefront matris WP) + uzak benzetim (`--sim-remote`, varsayılan yerel). Uzak koşu yalnız Claude (REMOTE_FREEZE + operatör kapısı). Koşucu `tests/e2e/run-conflicts.mjs`; sınıflama `tests/e2e/helpers/conflicts.mjs`. |
| `e2e:remote-smoke` | Uzak kısa kritik-akış (aşağıda). |
| `e2e:stability` | Aynı cihazda iki koşu; varsayılan iPhone |

### Uzak kısa kontrol (e2e:remote-smoke)

Merge kriteri: `verify` + yerel tam paket + `e2e:remote-smoke` iki uzak ortamda yeşil. Uzak **tam paket yalnız faz sonunda / bilgi amaçlı**. Claude çalıştırır (`--env staging|ikram`); Cursor yalnız `--env local` (TT5 yığın, `prepareLocalFullStack`).

| Öğe | Değer |
|-----|--------|
| Komut | `npm run e2e:remote-smoke -- --env staging\|ikram\|local` |
| Koşucu | `tests/e2e/run-remote-smoke.mjs` + `tests/e2e/helpers/remote-smoke.mjs` |
| Cihaz | iPhone WebKit |
| Hedef süre | uzak ≤ 4 dk; yerel ≤ 1.5 dk (yığın hazırlığı hariç tutulabilir) |
| Güvenlik | Ortam kilidi + kanarya önce/sonra + defter + ağ koruması (gevşetme yok) + işaretli fixture. Uzak: `REMOTE_FREEZE` + operatör kapısı. Sipariş yok; ödeme formu doldurulmaz. |
| Kontroller (WP/Woo kanıtı; ekran gözlemli atlama yok) | (1) ürün sayfası + eklenti betikleri + tetikleyici; (2) kabuk (popup veya ürünün ayarlı kabuğu) + POPUP-OVERLAP + boş gönderimde görünür doğrulama; (3) ziyaretçi, form min tutarı → Store API doğru ürün/tutar + sepet sayfası hazır; (4) ödeme sayfası ürün adı + tutar (alan yok, sipariş yok); (5) ondalık 0 mağazada `10,50` sepete eklemez; (6) staging `currencySwitch` EUR görüntü (profil yoksa `setting-off`+`wp-data`); (7) NATIVE-SUBMIT-RELOAD yok + `remote_post_blocked` / `blocked_live` özet; (8) test sepeti temiz. |
| Zaman aşımı | `resolveTimeouts` / `getActiveTimeouts` (`profile.mjs`). Gezinme + sepet/ödeme bekleme (`gotoWooCart`, checkout `page.goto`, currency-switch, donation-flow) profil değerine bağlı. |
| Teşhis | Kırmızıda `build/e2e/debug/<profil>/remote-smoke-<kontrol>.json` + PNG. |
| Çıkış | Hata varsa 1; konsol özet satırı + `run.json`. |

### Sağlık: kaynak ayırt etme + eklenti açık/kapalı (Y6)

- **Kaynak ayırt etme** (`scripts/lib/health-attribution.mjs`, saf işlevler): `ship-health.php` PHP günlüğünün son satırlarını (≤200, e-posta maskeli, yalnız okur) döndürür; `evaluatePhpHealth` yalnız koşu başlangıcından sonraki kayıtları (zaman damgası, -60 sn pay) sınıflar. Kaynak = kaydın ilk dosya yolu (yoksa yığın izinin ilk dosyası): `plugins/woo-donation-popup/` → **bizden**; başka eklenti/tema/mu-plugin/WP çekirdeği → **üçüncü taraf** (ör. Y2 Slider Revolution); yol yok → **bilinmiyor** (temkinli, fatal ise kırmızı). Geri dönüşü yalnız bizden/bilinmeyen fatal ya da bizden gelen kırmızı sayfa tetikler; üçüncü taraf satırda `üçüncü-taraf-php=…` / `üçüncü-taraf-sayfa=…` olarak raporlanır. Kırmızı sayfa üçüncü taraf sayılır: (a) bizden fatal yokken kurulum öncesi de kırmızıydı (`opts.baselineRedNames`) ya da (b) yeni günlük fatalleri yalnız üçüncü taraf.
- **Geri dönüş bildirimi:** `build/handoff/SHIP-GERI-DONUS-<env>-<damga>.md` (sebep, kırmızı sayfalar, üçüncü taraf, sonrası). Sağlık sayfaları: ana sayfa, mağaza, ürün, bağış sayfası, wp-admin.
- **Açık/kapalı** (`npm run health:onoff` = `scripts/plugin-onoff-compare.mjs`; yerel WP, uzak yok): geçici WP köküne **gerçek WooCommerce** (e2e matrisinin önbellek zip'i; zip yoksa yer tutucu ve çıktıda "yer tutucu" yazar) + sahte üçüncü taraf kurulur; `tests/local-wp/plugin-toggle.php seed` Woo sayfalarını, HPOS'u, örnek ürünü ve `[wdp_donations][wdp_donation_form][wdp_donation_button]` sayfasını hazırlar. Eklenti KAPALI → AÇIK, 12 sayfa: ön yüz (ana sayfa, mağaza, ürün, sepet, ödeme, bağış sayfası/listesi) + yönetici (başlangıç, eklentiler, WooCommerce ayarları, Siparişler (HPOS), ürün düzenleme, eklenti ayarı). Sayfa başına PHP kaydı (kaynak: bizden/bilinmeyen sayılır; **üçüncü taraf karşılaştırmaya girmez**, arka plan istekleriyle dalgalandığı için) ve tarayıcı konsol hatası; eklenti ARTIRIRSA kırmızı. Eklenti ayar sayfası kapalıyken yok: kapalı taban `wc-settings` (`offAs`). Kanıt: `--inject-ours` kırmızı, gerçek yeşil (3 ardışık koşu). `WDP_ONOFF_DEBUG=1` sayfa başına günlük/konsol satırlarını basar.
- **Uzak taban karşılaştırması (ship, eklenti uzakta KAPATILMAZ):** `ship-core` kurulumdan ÖNCE (eski sürüm) `collectBrowseTargets` sayfalarını (ana sayfa, mağaza, ürün, sepet, ödeme, bağış sayfası, wp-admin başlangıç, WooCommerce ayarları, Siparişler (HPOS ya da klasik; `ship-url-probe.php` seçer), ürün LİSTESİ — yeni-ürün sayfası taslak kayıt yarattığı için gezilmez) yalnız **GET** ile gezer; HTML'e basılan PHP uyarılarını `scanHtmlIssues` kaynağa göre sayar (bizden/bilinmeyen + HTTP >= 500; üçüncü taraf ayrı, karşılaştırmaya girmez). Kurulum SONRASI aynı gezinti + `php-log` (yeni 'bizden' günlük kaydı) `compareToBaseline` ile kıyaslanır (yalnız ARTIŞ; eski sürümde de olan kayıt yeni hata değil); artış varsa sağlık sayfası `onoff` kırmızı → mevcut geri dönüş. Çağrı sayısı: `url-probe` 2, `auth-cookie` 2, `health-php` 1, ek uzak yazma 0; sipariş/alan doldurma yok. Taban alınamazsa karşılaştırma yapılmaz (kurulum durmaz, rapora yazılır). Tarayıcı olmadığından uzakta konsol hatası ölçülmez (yalnız yerel açık/kapalı ölçer). Kapatma bayrakları: `skipBrowse`; birim testte `forceBrowse` (skipInstall ile).
- **Yönetici varlıkları:** `WDP_Admin_Assets::enqueue` yalnız `woocommerce_page_wdp-popup-settings` ve ürün düzenleme (`post.php`/`post-new.php`, `product`, `manage_woocommerce`) ekranında kuyruğa girer; `tests/unit/AdminAssetsScreenTest.php` plugins.php, başlangıç, WC ayar/durum/siparişler, ürün listesi, ayarlar vb. ekranlarda `wdp-` handle olmadığını kanıtlar.

### ship:ikram ve güvenlik kilidi

`scripts/lib/ship-core.mjs` (ikram profili): yukarıdaki güvenli zincir; rsync kaynak/hedef sonda slash + `--delete` yalnız eklenti dizini + `.distignore`. Eklenti dizini `wp plugin path SLUG --dir` (`normalizeRemotePluginDir`). `--dry-run` uzak yazmaz. Özet `build/ship/ikram-<zaman>.md`.

**Ikram etkileşimi yalnız repo içi node scriptleri üzerinden:** `npm run ikram:wp -- …` / `deploy:ikram` / `ship:ikram`. Doğrudan `ssh` / `rsync` yazılmaz (Cursor deny). `ikram:wp` kara listesi: `db drop/reset`, `site empty`, `user delete`, `post delete`, `plugin delete/uninstall`, `option update/delete`. İzin: plugin list/get/status/path, option get, post list/get, wc …, cache flush, sg purge, eval (yıkıcı PHP yok), eval-file `tests/e2e/helpers/cleanup-e2e.php` veya `tests/e2e/helpers/e2e-temp-product.php` (yalnız `_wdp_e2e_test=1`). Builtin: `plugin-health`, `php-ok`, `debug-log`, `gateways`.

İzin: yalnız `staging30.hedefdernegi.org` (`hedef-staging` + `~/www/staging30.hedefdernegi.org/`) ve `ikramaid.uk` (`ikramaid` + `~/www/ikramaid.uk/`). Kara liste `hedefdernegi.org` / `~/www/hedefdernegi.org` (canlı). **ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.**

Operatör kapısı: uzak spawn yalnız `CLAUDECODE=1` ve Cursor ajan işaretleri yokken (`scripts/lib/remote-guard.mjs`). Cursor CLI deny: `.cursor/cli.json`. Canlı yol taraması: `scripts/lib/live-target-scan.mjs` (`npm run verify`).

### Test verisi temizliği

Sipariş/müşteri/ürün: e-posta `*@wdp-e2e.test` + meta `_wdp_e2e_test=<runId>`. Defter `build/e2e/registry/<profilId>/<runId>.json` — yalnız bu koşunun oluşturduğu ID’ler. Her functional koşu sonunda `tests/e2e/helpers/test-cleanup.mjs`: yerelde PHP `eval-file` (`WDP_LOCAL_WP_DIR`, SSH yok); uzakta SSH `wp eval` (HPOS `wc_get_orders`, işaretli ürün `WP_Query`; yedek PHP `cleanup-e2e.php`). Defter `envId` etkin profil değilse `REGISTRY-ENV-MISMATCH` (spawn/SSH yok). Silme hatası koşuyu fail eder. Koruma siparişi, işaretsiz ürün ve başka ortamın ID’si silinmez.

Ödeme URL: `wc_get_checkout_url()` (`tests/e2e/helpers/checkout-setup.mjs`). Uzak: **hiçbir ödeme ayarı yazılmaz** (cheque/bacs/cod değiştirilmez); sipariş view-only. Yerel: Woo çekirdek cheque/cod/bacs `matrix-ops.php enable-offline-gateways` ile açılır; sipariş atlanmaz. Ürün ID: WP-CLI `post list` + Store API yedek (`resolve-products.mjs`). Konsol 404: istek URL + `kind=` (favicon/theme/plugin/blocked-live/blocked-site) — gizlenmez.
Eklenti `checkout_url` / `cart_url` PHP: `wc_get_checkout_url()` / `wc_get_cart_url()` (`includes/traits/trait-wdp-assets-registry.php` ~312; ajax-cart-add ~247/330). JS yalnız `resolveStorefrontUrl` (`assets/js/src/core/utils.js`); URL yoksa yönlendirme yok, başarı bildirimi kalır (sabit `/odeme-sayfasi/` `/sepet/` `/checkout/` yok). Test beklenen yol WP `wc_get_checkout_url`. Sepet doğrulama fail: `build/e2e/debug/<profil>/cart-state-<senaryo>-<cihaz>.json` (ekleme status/success/cart_count, ziyaretçi/yönetici bağlamı, çerez adı+alan/yol, Store API + /cart önbellek başlıkları, DOM satır; sınıf `baglam-farki`/`cerez-yok`/`onbellek`/`bilinmiyor`; değer yok). checkout-flow teşhis: `build/e2e/debug/<profil>/checkout-flow-<cihaz>.json` (pathname / HTTP / items_count / 3xx / oturum çerezi varlığı + `cta_ready` / eklenti betikleri `wdp-form-cta-ready-js` + `wdp-donation-modal-js` src pathname+ver / `WDPApp` / `_wdpSubmitHandler` / tıklanan öğe rol-ad-görünür-örten-disabled / tıklama sonrası ağ yöntem+pathname+wc-ajax/action / kısaltılmış konsol / kabuk PNG yolu; sınıf `form-dogrulama-reddi` / `sepet-boş-yönlendirme` / `eklenti-checkout-url-yanlış` / `tema-yönlendirmesi` / `tıklama-gezinmedi`). checkout-flow tutarı form `min`/önerilen (DOM, eklenti çıktısı); `pickDonationFillAmount` 0 dp düz tam sayı (`50`), N>0 mağaza biçimi; sayfa `wdp_ajax.currency` profili ezer (`mergeFillCurrency`). `type=number` makine biçimi (nokta, binlik yok, step=1 → tam sayı), `type=text` mağaza ondalığı; sabit 10 yok. Panel açılış: kabuktan önce ön yüz ürün (`body.single-product` veya ürün id); değilse sınıf `yanlış-sayfa` (sessiz devam yok). Panel JSON: tetikleyici, tıklama, kabuk DOM, sayfa pathname/body_class, konsol, PNG. `tests/e2e/helpers/flow-diag.mjs`.

---

## k) Gözlemlenen riskler / teknik borç (düzeltme yok)

| # | Gözlem | Dosya:satır |
|---|--------|-------------|
| 1 | `wdp_render_modal` nonce’suz (bilinçli; önbellek); koruma origin+rate+scope | `includes/class-lazy-modal.php:33-41` |
| 2 | `wdp_get_fresh_nonces` nonce’suz; credential_issuance origin | `includes/traits/trait-wdp-ajax-cart-session.php:17-22` |
| 3 | Misafir için `WDP_Security::check_capability('read')` her zaman true (`includes/class-security.php:240-244`); `run_secured_ajax` varsayılan `$capability='read'` (`includes/traits/trait-wdp-ajax-base.php:90-96`) — uç listesi aşağıda | `includes/class-security.php:240-244` |
| 4 | `wdp_render_modal` sunucu maliyeti / nonce’suz → CLAUDE durum notuyla uyumlu gözlem | `includes/class-lazy-modal.php`, `includes/traits/trait-wdp-assets-registry.php` |
| 5 | Uninstall 10.33.0’da açık ürün meta listesi + önek; sipariş/HPOS hâlâ dokunulmaz (bilinçli) | `includes/class-uninstall.php` |
| 6 | Deprecated `wdp_get_product_name` hâlâ kayıtlı; taslak/özel/şifreli/gizli ürün `validate_product_id` ile kapatıldı | `includes/class-ajax.php:53-55`, `includes/class-security.php:131-167` |
| 7 | Legacy nopriv `wdp_render_donation_button` 10.33.0’da kaldırıldı; PHP `wdp_render_donation_button()` yardımcısı duruyor | `includes/bootstrap/class-legacy-frontend.php` |
| 8 | `pack` script DEST’te `tools/` yokken yeniden build denemesi → uyarıya düşebilir; asıl bundle `npm run build` ile gelir | `scripts/package-wp-plugin.sh:66-78` + `.distignore:37` |
| 9 | Boş / noop catch ve `.catch(() => {})` envanteri (düzeltme yok) — alt tablo | grep `includes/`, `templates/`, `blocks/`, `assets/js/src/` |
| 10 | product_info + transient 1 saat; meta değişince invalidate bağımlı | `includes/traits/trait-wdp-ajax-product.php:67-68`, utils hooks |
| 11 | Hisseli default max 7 hem JS constants hem PHP boş meta | `assets/js/src/core/constants.js:54`, context `includes/class-donation-product-context-service.php:60-61` |
| 12 | Placement `get()` vs `defaults()` auto_place farkı (yükseltme güvenliği) | `includes/class-placement-settings.php:35,89-91` |

### k.3 Misafir `capability=read` / `false` uçları

`check_capability('read')` misafirde true (`includes/class-security.php:240-244`). `run_secured_ajax(..., $capability='read')` varsayılanı `enforce_capability` çağırır (`includes/traits/trait-wdp-ajax-base.php:90-96`).

| Action | `$capability` | Kanıt (çağrı) |
|--------|---------------|---------------|
| `wdp_get_cart_count` | `read` (varsayılan) | `includes/traits/trait-wdp-ajax-cart-query.php:48` |
| `wdp_get_cart_contents` | `read` (varsayılan) | `includes/traits/trait-wdp-ajax-cart-query.php:75` |
| `wdp_ajax_add_to_cart` | `read` (varsayılan) | `includes/traits/trait-wdp-ajax-cart-add.php:24` |
| `wdp_verify_submission_in_cart` | `read` (varsayılan) | `includes/traits/trait-wdp-ajax-cart-session.php:56` |
| `wdp_remove_cart_item` | `read` (varsayılan) | `includes/traits/trait-wdp-ajax-cart-query.php:213` |
| `wdp_get_product_info` | `false` (atlanır) | `includes/traits/trait-wdp-ajax-product.php:13` |
| `wdp_get_product_name` | `false` (atlanır) | `includes/traits/trait-wdp-ajax-product.php:151` |

Not: `wdp_get_fresh_nonces` `run_secured_ajax` kullanmaz; doğrudan `enforce_capability('read')` (`includes/traits/trait-wdp-ajax-cart-session.php:25`) → aynı misafir-true yolu.

### k.9 Boş / noop catch envanteri (düzeltme yok)

Tarama: `includes/`, `templates/`, `blocks/`, `assets/js/src/` — boş gövde, yalnız yorum, veya `.catch(() => {})` / `.catch(function () {})`. PHP `catch` içinde hata işleyen bloklar (json_error vb.) listede yok. `templates/` ve `blocks/` içinde eşleşme yok.

| Dosya:satır | Biçim | Değerlendirme |
|-------------|-------|---------------|
| `assets/js/src/modal.js:423` | `.catch(() => {})` | Progress bar `fetchCart` sonrası; gerçek ağ/sepet hatasını gizler |
| `assets/js/src/modal.js:792` | `.catch(() => {})` | Aynı progress sync yolu (ikinci çağrı); gerçek hatayı gizler |
| `assets/js/src/modal.js:794` | `catch (_) { /* noop */ }` | Progress kurulum sarmalayıcısı; iç hata yutulur |
| `assets/js/src/cart/actions.js:271` | `.catch(() => {})` | Form reset sonrası progress `fetchCart`; gerçek hatayı gizler |
| `assets/js/src/lazy-modal.js:417` | `.catch(function () { /* yorum */ })` | Bilinçli: niyet ön yükleme hatasını gösterme |
| `assets/js/src/lazy-modal.js:500` | `.catch(function () {})` | Bilinçli: idle prefetch hatasını yutma (pump devam) |
| `assets/js/src/core/utils.js:302` | `.catch(function() {})` | Görünür olunca nonce yenileme; başarısızlık sessiz (bilinçli tolerans / hata gizleme) |
| `assets/js/src/product.js:365` | `catch (_) { /* noop */ }` | `input` event dispatch (eski tarayıcı); bilinçli noop |
| `assets/js/src/form/wizard.js:485` | `catch (e) {}` | `shareholder.relayout`; gerçek layout hatasını gizler |
| `assets/js/src/form/wizard.js:518` | `catch (e3) {}` | `focus({ preventScroll })`; bilinçli (tarayıcı farkı) |
| `assets/js/src/form/wizard.js:528` | `catch (e4) {}` | `startViewTransition` yoksa fallback; bilinçli |
| `includes/class-admin-assets.php:228` | inline JS `catch (e) {}` | `history.replaceState` sekme hash; bilinçli |
| `includes/class-admin-assets.php:294` | inline JS `catch (e) {}` | hashchange `replaceState`; bilinçli |

---

## Çeviri (i18n)

Kaynak dil (dönüşüm sonrası) İngilizce `__('…', 'woo-donation-popup')`; görünür Türkçe `languages/woo-donation-popup-tr_TR.po|.mo`. Bu aşamada kaynak metinler hâlâ Türkçe; altyapı davranış değiştirmez.

| Parça | Dosya | Not |
|-------|-------|-----|
| Domain Path | `woo-donation-popup.php` başlık `Domain Path: /languages` | WP 6.7+ `init`’te yükle |
| Yükleme | `WDP_Plugin_Bootstrap::load_textdomain` | `load_plugin_textdomain('woo-donation-popup', false, dirname(plugin_basename(WDP_PLUGIN_FILE)) . '/languages')` |
| JS sözlük | `includes/i18n/class-wdp-js-i18n.php` → `wdp_ajax.i18n_dict` | Üretici: `tools/i18n/gen-js-strings.mjs` (`--check`) |
| JS API | `WDPApp.i18n.__(msg, domain)`, `_x(msg, ctx, domain)`, `sprintf` | Bağlam anahtarı `ctx\u0004msg`; yoksa kaynak |
| POT | `npm run i18n:pot` → `tools/i18n/make-pot.mjs` | xgettext PHP + `WDPApp.i18n.__` / `_x` |
| Birleşim | `npm run i18n:merge` | `languages/parts/*.po` → `tr_TR.po`; aynı msgid farklı msgstr = ÇAKIŞMA |
| MO | `npm run i18n:mo` | `msgfmt --check` |
| Altın 1 | `tools/i18n/golden/golden-tr-source.json` | PHP tokenizer (`tools/i18n/token-scan.php`); regex değil |
| Tuzak | `tools/i18n/golden/text-as-key-report.md` | `===` / `in_array` / `switch` / dizi anahtarı |
| Altın 2 | `npm run i18n:golden -- --capture\|--compare` | `tests/golden/i18n/<locale>/<config>/<ekran>.json` |
| Paket | `.distignore` `languages/parts/` | `*.po` / `*.pot` / `*.mo` ZIP’e girer |

Blok düzenleyici betikleri WordPress `wp.i18n` kullanır (tasarım kararı). Ön yüz bundle `wp.i18n` bağırlığı taşımaz.

Yerel biçimler (D5): yönetici önizleme tutarları mağaza ayarından (`wc_price` metne çevrilmiş; JS çipleri `wdp_admin.currency_symbol` + `price_format`); işlem ücreti yüzdesi ondalık ayırıcısı `wc_get_price_decimal_separator()`; `lazy-modal.js` para/dil önbellek anahtarında sabit `TRY`/`tr` yok (boş); `WDP_Progress_Currency::get_base_currency()` ve sepet verisi para birimi yedeği boş. Elementor arama anahtar sözcükleri `_x('…', 'elementor widget search keyword', …)` ile çevrilebilir (`languages/parts/D5.po`); altın 2 çıkarıcısı bu çağrıları çevirir. Tarih biçimi: sabit biçim yok (taramada 0). RTL: `npm run e2e:rtl` yerelde 34/34.

---

## Doğrulama notu

| Bölüm | Kapsam |
|-------|--------|
| a Klasör | Tam (kök + ana dizinler okundu) |
| b Hook’lar | Tam grep `includes/**/*.php` + bootstrap; her satır doğrulandı |
| c JS/CSS | Stack dosyaları + build araçları + localize tam; her src dosyasının gövdesi kısmi |
| d Veri modeli | Option/meta/cart/order anahtarları koddan; yazma/okuma örnekleri — tüm çağrı siteleri eksiksiz envanter **kısmi** |
| e AJAX | Tam (`wp_ajax_` / nopriv / rest / admin-post / wc_ajax` grep); her ucun sanitizasyon derinliği özet |
| f Entegrasyon | Shortcode/blok/Elementor/PPI girişleri tam; widget gövdeleri kısmi |
| g Ayar eşlemesi | Placement + ürün meta listesi + normalizer varsayılanları + AYARLAR çapraz; Normal/Tasarım’daki **her** renk alanının ekran etiketi tek tek **kısmi** (çok sayıda UI alanı aynı option’da) |
| h Form akışı | modal/product/formAjax/PHP add_to_cart ana yol tam; wizard/sadaka yan dalları kısmi |
| i Pack/deploy | script + guards + distignore tam; `.env` okunmadı |
| Çeviri (i18n) | Domain Path + init yükleme + JS sözlük + araçlar + altın kayıt; msgid dönüşümü yok |
| j E2E | komut/eşik/klasör tam; tüm senaryo listesi kısmi |
| k Riskler | Yalnız gözlenen maddeler; boş catch + misafir `read` uçları grep ile eklendi |

Kaynak tarama: `tools/file-descriptions.json`, `docs/AYARLAR.md`, `README.md`, `woo-donation-popup.php`, `includes/**`, `assets/js/src/**` (stack + kritik akış), `assets/css` stack, `blocks/`, `templates/`, `uninstall.php`, `scripts/`, `package.json`, `.distignore`, `tests/e2e` helpers özeti.

**Düzeltme (docs-mimari):** (A) tüm `dosya:satır` referansları depo köküne göre tam yola çevrildi ve `ls`/`find` ile doğrulandı; (B) bölüm k’ya boş/noop catch envanteri eklendi; (C) misafir `check_capability('read')` + `run_secured_ajax` uç listesi eklendi.

---

## Test güvenliği ve 2026-10-22 olayı

Hedef staging’de (staging28.hedefdernegi.org) E2E temizlik **gerçek sayfaları çöpe attı** ve medyayı kalıcı sildi. Yeni staging açılacak; bu bölüm kilitleri belgeler.

### Kök neden (kanıt düzeyi: yüksek — mekanizma yerelde yeniden üretildi)

HEAD `dbe472e` `tests/e2e/helpers/test-cleanup.mjs:64-65` `wp_delete_user((int)$u->ID)` **reassign’sız**. WordPress bu çağrıda kullanıcının yazı/sayfalarını `wp_delete_post` ile **çöpe** atar; **attachment çöp olmadığı için kalıcı silinir** (dosya diskten gider). Belirtiler (Ana sayfa/Sepet/Ödeme/Bağış Doğrulama çöp; Anasayfa ve Su Kuyusu Slider klasörleri boş) bu mekanizmayla örtüşür.

Aynı commit’te `tests/e2e/helpers/cleanup-e2e.php`: `const EMAIL_NEEDLE` varken **`$EMAIL_NEEDLE` değişkeni tanımsız**. `'*' . $EMAIL_NEEDLE` → `'*'`; `get_users(search '*')` geniş eşleşme; PHP 8’de `strpos($email, null)` → `0` (atlanmaz). Bu dosya `eval-file` ile çalışırsa **tüm kullanıcılar** silinebilir (admin içeriği dahil). `test-cleanup.mjs` HEAD sürümü inline `wp eval` kullanır (`*@wdp-e2e.test`); `cleanup-e2e.php` `ikram:wp eval-file` ve 2d çalışma ağacı `runEvalFile` yolundan gider. Hangi koşunun staging28’de `$EMAIL_NEEDLE` yolunu tetiklediği koşu JSON’larında **kesinleşmedi** (belirsiz); mekanizma **kesin**.

İşaret yalnız sipariş/ürün meta `_wdp_e2e_test=1` idi; kullanıcı meta + kayıt defteri + içerik sayımı yoktu.

### Yazma izin listesi / kara liste / kayıt defteri

- Tek kapı: `scripts/lib/remote-guard.mjs` `assertRemoteAllowed` / `spawnGuarded` + `assertRemoteTarget`. `build/handoff/REMOTE_FREEZE` varken ssh/scp/sftp/rsync (uzak) yok. `node --test` / `WDP_UNIT_TEST=1` / `npm test` altında `spawnGuarded` gerçek ssh/scp/sftp/rsync çalıştırmaz (yalnız `spawnImpl`); birim test ağa çıkamaz.
- Uzak WP `--path`: `shellQuoteWpPath` / `wpPathFlag` (`~/www/x` → `"$HOME/www/x"`) — `--path=~/…` kelime ortasında `~` açılmaz; `$HOME` çift tırnakta açılır. Kilit `unquoteShellWpPath` + `normalizeRemotePath` (`$HOME`/`/home/<user>` → `~`) ile aynı yolu tanır.
- Operatör kapısı: uzak işlem yalnız `process.env.CLAUDECODE === '1'` iken; Cursor ajan env işaretleri (`CURSOR_AGENT`, `CURSOR_INVOKED_AS`, `CURSOR_CONVERSATION_ID`, `CURSOR_REQUEST_ID`, `CURSOR_RIPGREP_PATH`, `__CURSOR_SANDBOX_ENV_RESTORE`) RED. Editörden gelen `CURSOR_EXTENSION_HOST_ROLE` / `CURSOR_LAYOUT` / `CURSOR_SPAWNED_BY_EXTENSION_ID` / `CURSOR_SPAWN_CHAIN` / `CURSOR_WORKSPACE_LABEL` hariç.
- Klasör kilidi: `spawnGuarded` / `checkRemoteTarget` alias + `wpPath` + `siteUrl` üçlüsü `ALLOWED_DEPLOY_TARGETS` kaydıyla birebir (env farklı olsa da spawn’a listedeki üçlü gider). Komut içi `~/` `/home/` `$HOME/` `--path=` yolları izinli kökün içinde. Uzak komutta `..` yol parçası, göreli/`cd ~`/`cd -`/`cd $HOME`/`cd`, `pushd`/`popd`, `ln -s`, `find /`, `ls ~`, `ls /` RED. `hedefdernegi.org` yalnız `staging30.hedefdernegi.org` biçiminde.
- İzinli hedefler (**tek yer** `scripts/lib/deploy-guards.mjs`): `staging-hedef` (`hedef-staging`, `~/www/staging30.hedefdernegi.org/`), `ikram-aid` (`ikramaid`, `~/www/ikramaid.uk/`). Kara liste: `hedefdernegi.org`, `www.hedefdernegi.org`, `~/www/hedefdernegi.org`. Env’deki canlı değer kullanılmaz + `KARA LİSTE` uyarısı; koşu profille devam. `ikramaid.uk` kaldırma notu durur; freeze ikram’ı da keser.
- Cursor deny: `.cursor/cli.json` (`Shell(ssh|scp|sftp|rsync|curl|wget|…)` + `.env*` okuma/yazma).
- Canlı tarama: `scripts/lib/live-target-scan.mjs` `npm run verify` zincirinde; ihlal dosya:satır ile kırmızı.
- Silme: `tests/e2e/helpers/cleanup-e2e.php` + `safe-remote-write.mjs`. Koşullar: (a) `_wdp_e2e_test=<run_id>` (sabit `"1"` değil), (b) `build/e2e/run-registry.json` içinde, (c) beklenen post_type. Defter boşsa hiçbir şey silinmez. Fixture ürünleri temizlik silmez (yalnız `e2e:bootstrap --remove-fixtures`, işaret+sahiplik: id fixture dosyasında, meta işaretle eşit, durum private). Koşu defteri her koşuda sıfırlanırken `fixtures` kayıtları korunur.
- Kara liste: `page`, `attachment`, `nav_menu_item`, `wp_template*`, `elementor_library`, Woo/WP çekirdek sayfa ID’leri (`page_on_front`, `woocommerce_*_page_id`, eklenti başarı sayfası). Kullanıcı silme: meta + e-posta + defter; içerik varsa red; `wp_delete_user($id, null)` yalnız içerik 0 iken.
- Fixture: `npm run e2e:bootstrap -- --env local`. `--env staging\|ikram --dry-run` uzak yazmadan plan listeler (`_wdp_e2e_test=<run_id>`, `private`, katalog/arama gizli, sayfa/menü/kategori/görsel/ayar yok, kayıt defteri). Gerçek kurulum: kanarya → ürünler → kanarya (beklenen = defter ∪ doğrulanmış fixture). Başarıda (yalnız fark = yeni/silinen fixture) `build/e2e/canary/<profilId>-baseline.json` otomatik güncellenir (eski `staging`/`ikram` dosyası okunur). Tek satır: `Kanarya: önce TEMİZ/KIRMIZI, sonra TEMİZ/KIRMIZI (beklenen yeni: N ürün)`. Silme: `--remove-fixtures` ( `--remove` eşanlamlı). **Onarım:** `npm run e2e:bootstrap -- --env X --repair` (önce `--dry-run` listesi; önce/sonra kanarya). Yalnız defter+fixture dosyasındaki işaretli ürünlerin metasını bootstrap varsayılanına döner (fiyat dahil); işaretsiz id RED (`assertRepairTargetMarked`). Yazmadan önce etkin profil defterine `registerMutated` (kanarya beklenen sayar); baseline yalnız işaretli ürün `modified` (gerçek kayıt asla; başka fark → KIRMIZI, yazılmaz). Uzak gerçek koşu yalnız Claude. Mutasyon testleri fixture yoksa `e2e:bootstrap çalıştırın` ile FAIL. Yazma hedefi fixture listesinde değilse koşu başı + `assertProductWritable` kırmızı. `empty-price` her zaman fixture id (katalog 10720 yazılmaz). Hisseli/kampanya/sadaka/hedefe-ulaşmış/boş-fiyat uzak private fixture + yönetici oturumu (`donationViewContext`). Gizli ürün listede görünmez; ziyaretçi yalnız yayımlanmış katalog. Yerel `e2e:full` fixture’ı yayımlar.

### Kanarya

`tests/e2e/helpers/canary.mjs` + `canary-snapshot.php` yalnız okur. `npm run e2e:canary -- --env staging\|ikram\|local`: salt okunur ölçüm → `build/e2e/canary/<env>-baseline.json` ile karşılaştır. Beklenen kayıtlar = koşu defteri (`build/e2e/run-registry.json`) ∪ ortamın kalıcı fixture dosyası (`build/e2e/fixtures-<profil>.json`). Fixture ürünü yalnız üçü doğrulanırsa beklenen sayılır: id dosyada, uzakta `_wdp_e2e_test` fixture işaretine eşit, durum private (doğrulama mevcut anlık görüntüdeki `mark`+`status`; ek uzak komut yok). Defter/fixture dışı fark → `build/e2e/CANARY-ALERT.txt` + kırmızı durdurma. `--update-baseline` yalnız TEMİZ iken (fark yok veya yalnız defter/doğrulanmış fixture). `e2e:bootstrap` başarıyla bitince (yalnız fark = fixture) baseline’ı yazar; `--remove-fixtures` sonrası da. Profil `ssh.alias/wpPath/siteUrl` + `spawnGuarded`; komut `wp --path=<wpPath> eval-file`. Ön kontrol (site-bağımsız): id 0 = ayarlı değil, sorun değil (`page_for_posts`, `page_on_front`, `woocommerce_terms_page_id`, `woocommerce_myaccount_page_id`, `woocommerce_shop_page_id`). `page_on_front` yalnız `show_on_front=page` ve id>0 iken var/publish olmalı. KIRMIZI yalnız ayarlı (id>0) sayfa yok/çöp/taslak. `woocommerce_cart_page_id` / `woocommerce_checkout_page_id` id 0 → UYARI (engel değil; blok sepet/ödeme şablon da olabilir). KIRMIZI olunca CANARY-ALERT option adı + id + durum yazar (içerik yok; boş `pre-bootstrap` etiketi yok).

### Yerel kanıt ortamı

Docker / wp-env yok. `scripts/local-wp.mjs`: PHP + WordPress + SQLite (`build/local-wp/wordpress`). `ensureLocalWp(kök)` veya `ensureLocalWp({ quiet, root })`; `resetLocalWp(kök)` prova kökünü sıfırlar. `tests/local-wp/eval-file.php` hedefi `$wdp_eval_target` / `$wdp_eval_args` (WP 7.1 `pages.php` `$file` sızıntısı). `npm run test:local-wp` reproduce + yeni temizlik + kanarya + bootstrap.

`e2e:full --env local`: `prepareLocalFullStack` (8899) matris TT5 işçisi + `bootstrap-fixtures.php` (upsert, fiyat/preset, `_enable_amount_presets`, yayımlı) + `matrix-ops.php prepare-full` (panel, `wdp_button_settings.enable_amount_presets=1`, `[wdp_donations]` liste `tabs=yes`, alt bağış, TT5 panel kısa kodu MU, klasik `[woocommerce_cart]` **yalnız içerik** — Woo sayfa ID/durum korunur, çöp/yeni sayfa yok; `wdp_matrix_update_woo_page_content` + `wdp_matrix_ensure_woo_core_pages`). Ürün meta yerelde `tests/local-wp/product-meta.php` (SSH yok; `staging-wp-meta.mjs` `usesLocalWpMeta`). Döngü eşlemesi `loopProductSlug` (tam URL değil path slug + fixture id). PHP `-S` log her açılışta sıfırlanır; çıkış/sağlık yoksa otomatik yeniden başlar; Action Scheduler async loopback kapalı (tek iş parçacıklı `-S` kilitlenmesi). `startPhpServer` `PHP_CLI_SERVER_WORKERS` ile hücre içi eşzamanlı HTTP (matris + full aynı makinede ayrı port: `WDP_MATRIX_BASE_PORT` / `WDP_LOCAL_E2E_PORT`). `freeListenPort` SIGTERM→SIGKILL, kalıntı PID yok. Sepet hazır: `wc_get_cart_url()` yolu + `body.woocommerce-cart` + DOMContentLoaded; klasik/blok işaret varsa görünür beklenir (yoksa Avada/oluşturucu). Sepet içeriği (adet/ürün/tutar) Store API `GET /wp-json/wc/store/v1/cart`; dil metni yok.

Eklenti kodu (`includes/`, `uninstall.php`) sayfa oluşturmaz/silmez; `wp_trash_post` kancaları yalnız dinler (`includes/class-utils.php:55,72`). `update_option` eklentide `wdp_*` (migrasyon yedeği `BACKUP_OPTION_KEYS` de `wdp_*`; döngü süzgeci yok — yedek eklenti kendi dosyası).


## 6-C: "sadaka" -> "addon" iç adlandırma (10.35.2)

- Araç: `tools/rector/rename-map.json` + `WDP_RECTOR_RENAME=1 php vendor-dev/bin/rector process` (yöntem adları), tek seferlik betikle sınıf/dosya/JS/CSS/test adları; "protect" listesi (istek/dizi anahtarları, kanca adları, DOM sınıf/öznitelikleri, betik handle'ları, sepet öğe anahtarları `wdp_sadaka_donation`/`wdp_sadaka_linked_wc_product`, `-sadaka` benzersiz anahtar eki, `wdp_sadaka_visibility_cache_cleared`) DEĞİŞMEDİ.
- Kalıcı ürün meta anahtarları yeni adlara taşındı: `_enable_addon_donation`, `_addon_toggle_label`, `_addon_wc_product_id`, `_addon_min_price`, `_addon_fixed_price`, `_addon_donation_message`. Göç `WDP_Migrations::step_10_35_2` (sürüm kapılı, idempotent; yalnız yeni anahtarı olmayan ürüne kopyalar; eski anahtar silinmez). Okuma: `WDP_Addon_Product_Visibility::get_meta()` önce yeni, yoksa eski (`LEGACY_META`). Meta sorguları OR ile iki anahtarı da tarar; `delete` iki anahtarı da siler; uninstall eski anahtarları da temizler.
- Sipariş öğe meta anahtarlarında "sadaka" yoktu (değişiklik yok). Kısa kodlar, öznitelikleri, blok/Elementor adları, kanca adları değişmedi; kanıt: `tests/unit/CompatibilityContractTest.php`, göç: `tests/unit/Migration10352AddonMetaTest.php`.

## Genel ilke (F6G, 10.35.x)

Eklenti hiçbir tema, sayfa oluşturucu ya da eklentiyi tanımaz (CLAUDE.md bölüm 0). Giriş yolları yalnız: kısa kod, blok, Woo standart kancalarıyla otomatik yerleşim, yedek düğme. Tema uyumu CSS değişkenleri + WordPress global stilleriyle; temaya özel seçici yok.

**Kaldırılanlar (F6G):** Avada (Fusion Builder) elementi (`class-compat-avada-element.php`, `fusion_builder_before_init` kaydı, `CompatAvadaElementTest`, `languages/parts/F7B.po`); `class-compat-builders.php` (Avada/Elementor/Divi/Bricks/Beaver işaretleri; `wdp_is_builder_preview` ve `wdp_builder_preview_context_product` filtreleri site sahibi için kalır); Elementor düzenleyici betiği `assets/js/elementor-editor.js` + `wdp_elementor_search_products` ajax uç noktası + `elementor/editor/after_enqueue_scripts` kancası; `WDP_Donations_List::atts_from_elementor_settings` (widget sınıfına `atts_from_settings` olarak taşındı); ölü `wdp_ajax.theme/theme_slug` varsayılanları. Yönetici yardım metni genel "sayfa oluşturucu/kısa kod" diline çevrildi (altın liste bilinçli güncellendi: 3 msgid).

**Elementor ince uyumluluk katmanı:** `Elementor_Compat` yalnız `elementor/widgets/register` + `elementor/elements/categories_registered`. Widget adları (`wdp-donation-form`, `wdp-donations`) ve ayar anahtarları sabit (kayıtlı sayfalar). `render()` ayarları kısa kod özniteliklerine çevirir ve eşdeğer kısa kod işleyicisini çağırır (`Shortcodes::donation_*_shortcode`, `WDP_Donations_List::shortcode`). `product_id` artık TEXT (kayıtlı kimlik aynen okunur). Test: `ElementorI18nTest`.

## Yükleme kapsamı (F6E, 10.35.2+)

İlke: eklenti CSS/JS/satır içi çıktısı yalnız gereken sayfada yüklenir; tema/sayfa oluşturucuya özel kod yok.

| Kural | Yer |
|---|---|
| Erken karar (`wp_enqueue_scripts`): kısa kod/blok içeren yazı, metin widget'ı kısa kodu, bağış ürünü sayfası (`product_requires_front_assets`), mağaza/ürün arşivi **yalnız ana sorguda en az bir bağış ürünü varsa** (`main_query_has_donation_product`, ayar `auto_place=yes` ve `loop_button!=off`) | `includes/class-assets.php` `should_enqueue_assets` |
| Geç karar: çizim anında `WDP_Assets::force_enqueue()` (kısa kod, blok, widget, giriş noktası, yan sepet, döngü düğmesi, bağış listesi); varlıklar footer'da (`maybe_enqueue_in_footer`) | `class-shortcodes.php`, `class-donations-list.php`, `class-product-page-integration.php`, `class-form-matrix.php`, `templates/class-modal-shell-renderer.php` |
| Sepet/ödeme: kısa kod yoksa yüklenmez | `should_enqueue_assets` |
| Yönetici: yalnız eklentinin kendi ekranları (Y6) | `class-admin-assets.php` |
| Sayfa-türü yok: ana sayfa, blog, düz sayfa, bağış kapsamı dışı ürün, Hesabım | hiçbir kanca |

Ölçüm: `npm run e2e:asset-scope [-- --table --files]` (yerel WP, 3 tema: twentytwentyfive, storefront, blocksy; `tests/e2e/run-asset-scope.mjs` + `helpers/wdp-scope-sim.php`). Sayfa türü başına eklenti dosyası, satır içi stil/betik ve `wdp-` DOM düğümü sayılır; "yok" beklenen yerde 0 değilse kırmızı.

| Sayfa türü | Önce (dosya / satır içi) | Sonra (dosya / satır içi / wdp düğüm) |
|---|---|---|
| Ana sayfa, blog, düz sayfa, bağış kapsamı dışı ürün, sepet (boş), ödeme (boş), Hesabım | 0 / 0 | 0 / 0 / 0 |
| Mağaza arşivi, listede bağış ürünü YOK | 3 / 4 | 0 / 0 / 0 |
| Mağaza arşivi, bağış ürünleriyle (döngü düğmesi) | 3 / 4 | 3 / 4 / 8 |
| Bağış ürünü sayfası | 3 / 5-6 | 3 / 5 / 71 |
| Bağış listesi sayfası (`[wdp_donations]`) | 5 / 5-6 | 5 / 5 / 35 |

Not: sepet/ödemede bağış öğesi olan koşul ayrı ölçülmedi (boş sepet).

### 6-F: ölü ve tekrar eden kod (davranış değişmez)

- **JS ortak yardımcı:** `WDPApp.utils.createHookRegistry()` (`assets/js/src/core/utils.js`) → `{ registerHooks, callHook, hasHook }`; `form/ajax.js` ve `shareholder/{setup,quantity,forms-sync,render}.js` kendi kopyası yerine bunu kullanır. `form/ajax.js` `finishAjaxRequest` (jQuery `complete` + fetch `finally` ortak temizliği), `shareholder/setup.js` `applyResolvedBasePrice` (birim fiyat uygulama) ortaklaştırıldı.
- **i18n yedek bloğu:** `WDPApp.i18n` yedeği artık yalnız `core/utils.js`'te (yığında `core/i18n.js` ilk, `utils.js` ikinci; öteki 8 modül utils'ten sonra yüklenir). Tek dosyayı vm ile yükleyen birim testler sandbox'a `WDPApp.i18n` ekler.
- **Silinen kamu yöntemleri (referanssız, sözleşme dışı):** `WDP_Addon_Product_Visibility::has_explicit_donation_flag`, `WDP_Security::validate_nonce`/`escape_output`, `WDP_Render_Registry::has_modal`, `WDP_Utils_Order_Meta_Trait::get_progress_reversal_statuses`, `WDP_Assets::request_should_enqueue_frontend_assets`, `WDP_Order_Meta_Keys::shareholder_fields`, `WDP_Progress_Form::render_form_fields`.
- **Bırakılanlar:** WooCommerce/WP/Elementor geri çağrıları ve `WP_List_Table` `column_*` (yanlış pozitif); `WDP_Templates` cephe yöntemleri (şablon geçersiz kılma/dış kod sözleşmesi riski); test destek yöntemleri; `sync_order_donation_totals_on_complete` (geriye uyum kancası). `buttons.css` tekrarları: `:is()` seçici listesinin özgüllüğü kaskadı belirlediği için kısaltılmadı. Ayrıntı: `build/handoff/FAZ6-HEDEF-LISTESI.md` "6-F durumu".

## 7A: kural gevşetme planı ve kalite kapıları (Faz 7)

**Durum.** `includes/` (eski kod) PHPCBF ile tek seferde biçimlendirildi (PHPCS bulgusu 36.674 → ~600; kalanlar `tools/lint-baseline/baseline-phpcs.json`). `phpcs.xml.dist` iki gevşetme taşır; ikisi de **yalnız eski kod içindir**:

| Gevşetme | Kapsam | Neden gerekti | Yeni mimaride |
|---|---|---|---|
| `WordPress.Files.FileName.InvalidClassFileName` hariç | yalnız `*/includes/*` | eski sınıf `WDP_Foo` dosyası `class-foo.php` (önek dosya adında yok) | Gerekmez: `DonationPanel\Core\Foo_Bar` → `src/Core/class-foo-bar.php` (WPCS aynen karşılanır) |
| `PrefixAllGlobals.ShortPrefixPassed` severity 0 | `phpcs.xml.dist` (eski kod) | `wdp`/`hdf` önekleri 4 karakterden kısa | Gerekmez: `src/` kodu namespace `DonationPanel\` altında (global ad yok); zorunlu global ad `donation_panel_` (≥4 karakter). `phpcs-src.xml.dist` kısa öneki zaten reddeder |

**`src/` kuralı:** `phpcs-src.xml.dist` (ayrı kural dosyası): WordPress-Extra + PHPCompatibilityWP, hiçbir exclude/severity yok, yalnız uzun önekler (`DonationPanel`, `donation_panel`; kısa `wdp`/`hdf` src'de hook/global için hata verir, deneyle doğrulandı). Neden ayrı dosya: `PrefixAllGlobals` önek listesine yeni uzun önek eklenince kısa öneklerin tanınması bozuluyor ve kural yola göre sınırlanamıyor; tek dosya olursa ya eski kod kırılır ya src gevşer. `scripts/lint-php.mjs` ve `verify:lint` kapısı `src/` varsa bu dosyayı otomatik kullanır; `src/` hatalarında baseline YOK (her hata kırmızı). Tablodaki iki gevşetme yalnız `phpcs.xml.dist` (eski kod) içindedir.

**Mimari kararı (7C'ye girdi): PSR-4 dosya adı WPCS ile çelişir.** Deneyle `src/Core/Pascal.php` → `FileName.NotHyphenatedLowercase` + `InvalidClassFileName` hatası; PSR-4 ancak bu iki kuralı gevşeterek olur. "Gevşetme yok" için:
- Namespace `DonationPanel\…`, sınıf adları WPCS biçiminde (`Foo_Bar`), dosyalar `class-foo-bar.php` / `trait-…` / `interface-…`; klasörler `src/{Core,Domain,Modules/<Modül>,WooCommerce,Http,Admin,Frontend,Support}` (klasör adı denetlenmez).
- Yükleme: **Composer classmap** (`"autoload": {"classmap": ["src/"]}`, `composer dump-autoload --classmap-authoritative`; çıktı pakete gömülür). PSR-4 yerine; namespace yapısı aynı.
- Bir dosyada ya işlev ya sınıf (`Universal.Files.SeparateFunctionsFromOO`); yardımcılar statik yöntem olur.

**Eski kod:** `includes/` 7C'de `src/`'ye taşındıkça silinir; bitince `includes/` istisnaları ve `<file>includes</file>` kaldırılır. O zamana dek `verify:lint` kapısı eski dosyada da yeni/değişen satırda hata → kırmızı.

**Plugin Check kapısı (7A-3).** `npm run verify:plugin-check` (`scripts/plugin-check-gate.mjs`) `verify` zincirinin sonundadır (yerel WP + WP-CLI; ~45 sn, süre eşiği 3 dk altında olduğu için koşulsuz). `tools/lint-baseline/baseline-plugin-check.json` (dosya|kaynak|ileti başına sayı; satır numarası yok) içinde olmayan YENİ bulgu → kırmızı. Yerel WP/ağ/WP-CLI yoksa atlanır (uyarı, yeşil). Baseline yenileme: `node scripts/plugin-check-gate.mjs --write-baseline`. Hedef: Faz 7 sonunda baseline boş.

## K5 / K6 / K1 / K4: kaldırılanlar (Faz 7, `f7-k56`)

Davranış dışı her şey aynı; veritabanı ayarları silinmez (eski seçenek/meta olduğu gibi kalır, `uninstall` önek temizliği zaten `wdp_*` seçeneklerini ve ürün meta listesini kapsar). Dışa açık kanca/kısa kod/blok adları ve sipariş/ürün meta okuması değişmedi (`CompatibilityContractTest` yeşil).

| Karar | Kaldırılan | Kalan davranış / not |
|-------|------------|----------------------|
| K5 | Kategori renkleri sekmesi + `WDP_Category_Title_Color_Service` + `wp_ajax_wdp_save_category_colors_settings` + `admin-script.js` önizleme + CSS; "Başarı" sekmesindeki mini sepet arka plan/kenarlık/yarıçap alanları (`mini_cart_*`) ve satır içi CSS değişkenleri | Başlık/vurgu rengi artık yalnız ürün `_theme_primary` → genel marka (`WDP_Form_Modules::get_title_style_attr`). Mini sepet yarıçapı `--wdp-mini-cart-radius: 10px` (eski varsayılan) tokens.css'te. `wdp_enable_side_cart_recovery` filtresi (dış kanca) korunur. Eski `wdp_category_title_colors` seçeneği DB'de durur |
| K6 | Meta Pixel sekmesi, `WDP_Meta_Tracking`, `meta-tracking.js`, `window.WDPMetaTracking` çağrıları, `wdp_save_meta_tracking_settings`, AJAX yanıtındaki `meta_cart_line`, `wdp_ajax.meta`; JSON-LD: `WDP_Schema` (WooCommerce/Rank Math Product), Ürün sayfası ve liste sekmesindeki "Yapılandırılmış veri" ayarı (`schema`), bağış listesi `ItemList` JSON-LD | Meta için **Meta for WooCommerce**, şema için **Rank Math / Yoast** gibi eklentiler kullanılmalı. Eski `wdp_meta_tracking_settings` ve placement `schema` değeri DB'de durur |
| K1 | İlerleme çubuğu konfeti/`celebrate` animasyonu (JS, CSS), ürün "Kutlama animasyonu" kutusu, İlerleme sekmesi "Animasyon" kutusu, `enable_celebrate` stil ön ayar alanı, `wdp_ajax.flags.progress_celebrate`, `data-wdp-progress-celebrate` | Hedefe ulaşınca eylem (mesaj / kapat / devam) ve `wdp:progress:complete` olayı + "Goal reached" ekran okuyucu duyurusu **korunur** (artık her kullanıcıya; eskiden animasyon kapalı/azaltılmış harekette olay atlanıyordu). Yeni sade kutlama E6'da. `_progress_celebrate` meta DB'de durur |
| K4 | Ürün "Blok sırası" arayüzü (+ `products.js`/CSS), Tasarım sekmesi "Varsayılan modül sırası", `_wdp_module_order` yazımı, `WDP_Form_Modules::sanitize_header_order`, `module_order` form bağlamı anahtarı | `WDP_Form_Modules::resolve_order()` sabit varsayılan sırayı (`config/form-modules.php`) döndürür; eski özel sıralar yok sayılır (kasıtlı) |

Meta Pixel / dönüşüm izleme için kullanıcıya not (README): Meta için "Meta for WooCommerce", yapılandırılmış veri için "Rank Math" (ya da benzeri) kullanın.

## Genel kanca tablosu: para birimi (K8, `docs/site-snippets/`)

Çekirdek yalnız WooCommerce'in etkin para birimini kullanır; çoklu para birimi eklentisi adı/çerezi/işlevi çekirdekte geçmez. Kullanan site filtrelere kendi koduyla bağlanır (Hedef: `docs/site-snippets/curcy-bridge.php`; kurulum/test/geri alma `docs/site-snippets/README.md`, canlıya alma `docs/site-snippets/CANLIYA-ALMA.md`). Testler: `tests/unit/SiteSnippetCurcyBridgeTest.php` (filtre yokken tutar değişmez; snippet + Curcy saplaması ile eski davranış).

| Filtre | İmza | Varsayılan |
|---|---|---|
| `wdp_order_exchange_rate` | `( ?float $rate, $order, string $currency, string $base )` | `null` |
| `wdp_progress_live_rate` | `( ?float $rate, string $currency, string $base )` | `null` |
| `wdp_convert_amount` (yeni) | `( float $amount, string $from, string $to, array $context )`; `WDP_Progress_Currency::convert_amount()` | tutar aynen; kur yokken `convert_to_base` tutar değiştiyse bunu kullanır, değişmediyse `missing_rate` |
| `donation_panel_convert_amount` (CURCY3) | `( float $amount, string $from, string $to, array $context )`; sepet satırı: bağışçı tutarı (`wdp_input_currency`) -> ana birim (`WDP_Cart::resolve_cart_line_store_price`), gösterim: ana -> etkin birim; ayrıntı docs/HOOKS.md | tutar aynen; eski `wdp_convert_amount` sonra uygulanır |
| `wdp_progress_convert_amount` | `( array $result, float $amount, string $from, string $to, $order )` | sonuç aynen |
| `wdp_client_context` | `( array $context )` (`currency_cookies`, `lang_cookies`, `switcher_selectors`, `change_events`) | çerez/olay listeleri boş; genel seçiciler `[data-currency]`, `a[href*='currency=']` |

## E0: Faz 7 çekirdek altyapısı (yeni `src/`)
`src/` (namespace `DonationPanel\`, WPCS dosya adları) eski `includes/` ile yan yana çalışır; `includes/bootstrap/class-plugin-bootstrap.php` gömülü autoloader'ı kaydeder, davranış değişmez. Çekirdek: Plugin, Container, ModuleRegistry (kapalı modül dosyası yüklenmez), Settings (`donation_panel_settings`), Migrations + Legacy_Settings_Importer (eski `wdp_*` okunur, idempotent, silinmez), Http\Rest_Controller (`donation-panel/v1`), Frontend\Template_Loader (tema `donation-panel/`), Support\Logger. Kanca ön eki `donation_panel_` (Plugin Check kanıtı: MIMARI-FAZ7 §8; liste: docs/HOOKS.md). Modern JS: `assets/src/<modül>/index.js` -> `npm run build:modules` (`@wordpress/scripts`) -> `assets/build/` (pakete girer; `assets/src` girmez; kaynak yoksa adım atlanır).

## Kanca sırası (E2X)

Eklentinin tüm `plugins_loaded` kancaları **öncelik 20**'dedir (`src/Core/class-plugin.php:133` çekirdek; `includes/bootstrap/class-plugin-bootstrap.php:29-30` eski çekirdek `launch_plugin` + `update_version`). Çekirdek `boot()` bootstrap'tan önce kanca eklediği için aynı öncelikte önce çekirdek (göç + modüller + kısa kod/blok/Elementor kaydı), sonra eski çekirdek çalışır.

Neden 20: (1) eklenti klasörü `woo-donation-popup` alfabetik olarak `woocommerce`'ten önce yüklenir; WooCommerce sınıfı ancak kendi `plugins_loaded` kancasından sonra güvenle denetlenir, bu yüzden bizim çalışma noktamız 10'dan sonra olmalı; (2) `donation_panel_settings` ve eski `wdp_*` seçenek göçü (`Migrations::run`) eski çekirdek kurulmadan hazır olur; (3) modül kayıt defteri (`donation_panel_module_enabled` filtresi dahil) diğer eklentilerin 10'daki filtre kayıtlarından sonra okur.

Etkiler: plugins_loaded 10-19 arasında çalışan bir snippet/eklenti kısa kodları, `WDP_*` sınıflarının davranışını ya da eski çekirdek nesnesini (`$GLOBALS['woo_donation_popup']`) hazır BULAMAZ. Bu durumda `do_shortcode()` işlenmemiş etiketi döndürür (WordPress davranışı), filtreler varsayılan değerini döndürür, PHP hatası/uyarısı olmaz. Bu çağrılar `init` ya da sonrasında (render zamanı) yapılmalıdır. Kanıt: `tests/unit/js/hook-order-contract.test.mjs` (+ `tests/local-wp/hook-order-probe.php`, `hook-order-mu.php`): 10, 15 ve `init` 99'da ölçer.


## E2A: Form deneyimleri modülü (yeni nesil motor, eski motorun yanında)

- **Anahtar:** `donation_panel_settings.experiences.engine` = `legacy` (varsayılan) | `new` (`Settings::engine_is_new()`). `Plugin::register_modules` `experiences` modülünü metin sınıf adıyla kaydeder; `legacy` iken `src/Modules/Experiences/` altındaki hiçbir dosya yüklenmez (PHPUnit: `E2AEngineSwitchTest`, ayrı süreçte). Eski motor, kısa kodlar, AJAX uçları ve e2e/golden DEĞİŞMEDİ.
- **PHP (`src/Modules/Experiences/`):** `Experiences_Module` (kısa kod `donation_panel_experience`, REST kaydı, tembel varlık), `Form_Context` (eski ürün bağlamından kişi verisiz form modeli), `Form_Renderer` (tek çekirdek `form.php` + kap şablonu), `Experience_Container` + `Popup`, `Side_Panel`, `Inline_Form`, `Bottom_Sheet` (yalnız kap işaretlemesi/şablon adı), `Field_Validator` (tutar ayrıştırma, alan kuralları; çok baytlı güvenli), `Form_Controller` (REST).
- **Şablonlar:** `templates/donation-panel/experiences/{form,popup,side-panel,inline,bottom-sheet}.php`; `Template_Loader` ile tema geçersiz kılabilir.
- **Ön yüz (`assets/src/experiences/`):** `store.mjs` (saf durum makinesi, birim testli), `layer.mjs` (aç/kapa, açık yönetilen odak tuzağı, Esc, kaydırma kilidi, sürükleyerek kapatma, `visualViewport` klavye uyumu, `data-dp-presented`: ≤639 px popup/yan panel -> `sheet`), `form.mjs` (tutar çipleri `radiogroup`, doğrulama REST, sepete ekleme şimdilik mevcut `wdp_ajax_add_to_cart`), `base.css` (`design/tokens.css` + `design/components.css` türetmesi, `--dp-*`, mantıksal CSS/RTL, `prefers-reduced-motion`, tema özel seçici yok). jQuery yok. Bağımsız modern JS (`.mjs`; paket `commonjs` olduğu için webpack ESM olarak okusun diye); Interactivity API E2B+ değerlendirmesi.
- **Derleme:** `npm run build:modules` (`scripts/build-modules.mjs`: `assets/src/<modül>/index.(m)js` -> `assets/build/<modül>/index.js|css`); `npm run build` artık bunu da çağırır. `assets/src` pakete girmez, `assets/build` girer. Varlıklar yalnız `[donation_panel_experience]` çizilen sayfada kuyruğa alınır.
- **Bütçe:** JS ~3,5 KB gz (hedef ≤25), CSS ~4,9 KB gz (hedef ≤8); test `tests/unit/js/experiences-store.test.mjs`.
- **e2e:** `npm run e2e:experiences` (yalnız yerel, port `WDP_LOCAL_E2E_PORT`, varsayılan 8911): 4 kap x iPhone (WebKit) / Android / masaüstü, açılır-kapanır, odak tuzağı, >=44 px, axe WCAG 2.2 AA, RTL, Türkçe karakterli sepete gönderim, legacy motorda yeni varlık yok. Yardımcı mu-plugin: `tests/e2e/helpers/wdp-exp-sim.php`.
- **Bilinen sınırlar:** (Store API köprüsü E2B'de eklendi), tek adım form (tutar+bilgiler), `wp.i18n` yerine sunucudan veri özniteliğiyle iletiler, hissedar (çok hisse) alanları yok.

## E2B: Sepet köprüsü, Store API uzantısı, sipariş meta (yalnız `engine=new`)

- **Sınıflar (`src/WooCommerce/`):** `Cart_Data` (saf: form girdisi -> eski `donation_data`/`custom_price`/`unique_key` sözleşmesi; yalnız modelde açık alanlar; çok baytlı güvenli kırpma; kişi verisiz özet), `Cart` (`add_item()`: Field_Validator + eski sunucu kuralları `WDP_Campaign_Goal`/`WDP_Cart::get_donation_amount_error` -> `WC_Cart::add_to_cart`; Store API uç verisi + `/cart/extensions` güncelleme), `Donation_Order_Meta` (`woocommerce_checkout_create_order_line_item`; eski `WDP_Order` yazıcısının yerini `init` 99'da alır, çift yazım yok; `WDP_Order_Meta_Keys::build_item_meta` ile ESKİ anahtarlar birebir; anonim veriyi silmez/maskelemez; yalnız sipariş kalemi API'si = HPOS uyumlu, doğrudan postmeta yok).
- **REST (`Cart_Controller`):** `POST /cart/add` (JSON zorunlu = çapraz site form gönderimi yok), `GET /nonce` (`no-store`; oturum çerezinden kullanıcı). Tarayıcı `form.mjs` doğrulamayı ve eklemeyi tek istekte yapar; 403'te nonce'u tazeleyip bir kez yeniden dener; `submission_key` çift eklemeyi önler. `/validate` ucu duruyor (canlı alan doğrulaması için).
- **Eski doğrulama köprüsü:** `class-cart.php` (dokunulmadı) `$_POST['action']=wdp_ajax_add_to_cart` + `wdp_ajax_flow=1` bayrağını arar; `Cart::with_plugin_flow` bunu yalnız `add_to_cart` süresince kurar, sonra `$_POST`'u geri yükler.
- **Fiyat/çoklu para birimi:** sepete yalnız `custom_price` yazılır; uygulama/dönüşüm mevcut `woocommerce_before_calculate_totals` yolundadır (Curcy3 alanı; bu sınıf dönüştürmez).
- **Kapsam dışı (bilerek):** doğrudan `wc/store/v1/cart/add-item` ile bağış ürünü ekleme (eski kural reddetmeye devam eder; desteklenen yol `/cart/add`), hissedar/işlem ücreti/ek bağış satırları, bağış türünün sipariş metasına yazımı (tür filtresi varsayılan boş), sipariş düzeyi yeni meta anahtarı.
- **Testler:** PHPUnit `E2BCartTest`, `E2BCartControllerTest`, `E2BOrderMetaTest` (29); e2e `tests/e2e/specs/experiences-cart.spec.mjs` (`npm run e2e:experiences -- --spec experiences-cart [--checkout blocks]`, yerel): 3 cihazda tutar->sepet->ödeme + Store API sepet doğrulaması, anonim ve girişli bayat nonce, REST hata biçimi, HPOS siparişi (klasik + blok ödeme) meta kontrolü, legacy'de uçlar yok.
