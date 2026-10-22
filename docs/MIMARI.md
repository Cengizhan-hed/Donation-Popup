# MIMARI — woo-donation-popup (10.34.2)

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
| `includes/elementor/` | Elementor widget sınıfları | `includes/class-elementor.php` |
| `includes/compat/` | Builder tespit (Avada/Elementor/…) | `includes/compat/class-builder-detect.php` |
| `templates/woocommerce/` | Simple add-to-cart şablon override | `templates/woocommerce/single-product/add-to-cart/simple.php` |
| `blocks/` | Gutenberg `donation-form` + `donations` | `includes/class-blocks.php:34-63` |
| `assets/js/src/` | Ön yüz JS kaynakları | `includes/config/frontend-js-stack.php` |
| `assets/js/build/` | Hash’li JS bundle + `manifest.json` | `tools/build-js-bundle.php:11-12` |
| `assets/css/src/` | Ön yüz CSS kaynakları | `includes/config/frontend-css-stack.php` |
| `assets/css/build/` | Hash’li CSS bundle + manifest | `tools/build-css-bundle.php` (stack sırası) |
| `assets/css/admin-style.css`, `assets/css/admin/products.css` | Admin UI | `includes/class-admin-assets.php` |
| `assets/js/admin-script.js`, `assets/js/admin/products.js` | Admin JS | aynı |
| `assets/css/list.css`, `assets/js/list.js` | `[wdp_donations]` liste | `includes/class-donations-list.php` |
| `tools/` | Bundle / minify / docblock | `package.json:7-9` |
| `scripts/` | pack, deploy, ship, handoff | `package.json:14-27` |
| `tests/` | PHPUnit, JS unit, smoke, E2E | `package.json:10-23` |
| `docs/` | AYARLAR + bu mimari | — |

### Bootstrap sırası

1. `woo-donation-popup.php` → `WDP_Plugin_Bootstrap::run()` (`woo-donation-popup.php:53-56`)
2. HPOS uyumluluk + autoload + Migrations::init (`includes/bootstrap/class-plugin-bootstrap.php:22-27`)
3. `plugins_loaded` → WC yoksa notice; varsa `Woo_Donation_Popup` (+ admin’de `Woo_Donation_Popup_Admin`) (`includes/bootstrap/class-plugin-bootstrap.php:35-44`)
4. Modül `init()` sırası (`includes/class-woo-donation-popup.php:47-64`): Utils → Assets → Meta_Tracking → Ajax → Cart → Order → Sadaka_Product_Visibility → **Donation_Purchasable** → Donations_List → Product_Page_Integration → Lazy_Modal → Schema → Blocks → Elementor → Form_Matrix → Shortcodes

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
| `plugins_loaded` | default | `launch_plugin`, `update_version` | `includes/bootstrap/class-plugin-bootstrap.php:26-27` |
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
| `wp_enqueue_scripts` | 25 | Meta thankyou Purchase | `includes/class-meta-tracking.php:263` |
| `wp_footer` | 1 | optional base pixel | `includes/class-meta-tracking.php:264` |
| `wp_consent_api_registered_*` | — | `__return_true` | `includes/class-meta-tracking.php:268` |
| `woocommerce_add_cart_item_data` | 10 | bağış cart data | `includes/class-cart.php:22` |
| `woocommerce_add_to_cart_validation` | 10 | alan doğrulama | `includes/class-cart.php:25` |
| `woocommerce_get_item_data` | 10 | sepet görüntü | `includes/class-cart.php:28` |
| `woocommerce_before_calculate_totals` | 99 | özel fiyat | `includes/class-cart.php:31` |
| `woocommerce_cart_item_price/subtotal` | 10 | fiyat HTML | `includes/class-cart.php:32-33` |
| `woocommerce_cart_item_quantity` | 10 | hisse qty kilidi | `includes/class-cart.php:36` |
| `woocommerce_update_cart_validation` | 10 | hisse qty engel | `includes/class-cart.php:37` |
| `woocommerce_cart_item_class/name/thumbnail` | 10 | sadaka satır görünümü | `includes/class-cart.php:39-41` |
| `woocommerce_checkout_create_order_line_item` | 10 | sipariş meta yaz | `includes/class-order.php:22` |
| `woocommerce_order_item_display_meta_key/value` | 10 | etiket çevirisi | `includes/class-order-meta-keys.php:345-346` |
| `wp_privacy_personal_data_exporters` | 10 | exporter | `includes/class-privacy.php:26` |
| `wp_privacy_personal_data_erasers` | 5 | eraser | `includes/class-privacy.php:28` |
| `wp` | 20 | ürün sayfası fallback | `includes/class-product-page-integration.php:49` |
| `body_class` / `post_class` | 10 | CSS sınıfları | `includes/class-product-page-integration.php:50-51` |
| `wp_head` | 30 | hide cart CSS | `includes/class-product-page-integration.php:52` |
| `wc_get_template` / `woocommerce_locate_template` | 20 | şablon override | `includes/class-product-page-integration.php:54-55` |
| `woocommerce_get_price_html` | 20 | fiyat gizle | `includes/class-product-page-integration.php:57` |
| `woocommerce_is_purchasable` | 20 | custom/campaign boş fiyat | `includes/class-donation-purchasable.php:24` |
| `woocommerce_loop_add_to_cart_link` | 10 | döngü Bağış Yap | `includes/class-product-page-integration.php:58` |
| `woocommerce_product_add_to_cart_text/url` | 20 | metin/URL | `includes/class-product-page-integration.php:59-60` |
| `woocommerce_product_supports` | 20 | ajax_add_to_cart vs. | `includes/class-product-page-integration.php:61` |
| `render_block_woocommerce/*` | 10 | blok sepete ekle/fiyat/buton | `includes/class-product-page-integration.php:63-66` |
| `woocommerce_single_product_summary` | 21/30 | fallback form | `includes/class-product-page-integration.php:107` |
| `woocommerce_after_single_product_summary` | 5 | below_summary | `includes/class-product-page-integration.php:103` |
| `woocommerce_structured_data_product` | 20 | schema | `includes/class-schema.php:21` |
| `rank_math/snippet/...` / `rank_math/json_ld` | 20 / 99 | Rank Math | `includes/class-schema.php:23-24` |
| `init` | default | Gutenberg blok kaydı | `includes/class-blocks.php:28` |
| `elementor/widgets/register` | default | widget | `includes/class-elementor.php:22-26` |
| `elementor/elements/categories_registered` | default | kategori | `includes/class-elementor.php:23-27` |
| `template_redirect` | 0 | form matrix | `includes/class-form-matrix.php:21` |
| `set_object_terms` + stok/kategori | 10 | liste cache bump | `includes/class-donations-list.php:38-43` |
| `wp_footer` | 20 | liste schema | `includes/class-donations-list.php:177` |
| `updated_option` / post_meta | 10 | sadaka line cache flush | `includes/class-sadaka-product-visibility.php:33-36` |
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

Kaynak: `includes/config/frontend-js-stack.php:12-258`. Özet sıra:

1. constants → meta-tracking → utils → cta-viewport → state → dom  
2. phone-input → product  
3. cart/ui → cart/woo → cart/actions → cart  
4. form/messages → pricing → feedback → sadaka-rules → sadaka → ajax → validate → wizard → form  
5. shareholder/* → shareholder  
6. progress-bar → modal → form-initializer → lazy-modal → event-manager → module-loader → **init**

### Global nesneler

| Global | Kaynak | Not |
|--------|--------|-----|
| `window.WDPApp` | tüm `assets/js/src/**` | alt: `utils`, `state`, `modal`, `form`, `cart`, `product`, `lazyModal`, `init`, … |
| `window.wdp_ajax` | PHP localize | nonce, ajax_url, `currency` (code/symbol/decimals/thousandSeparator/decimalSeparator/symbolPosition), meta… (`includes/traits/trait-wdp-assets-registry.php`, `WDP_Utils::get_js_currency_settings`) |
| `WDPApp.utils.formatMoney` / `parseMoney` | `assets/js/src/core/utils.js` | TEK biçimleyici; Intl yok; `wdp_ajax.currency` ayarları. 0 ondalıkta her ayırıcı binlik. DOM/sunucu tutarı nokta-ondalıklı ham sayı. |
| `window.WDP.refresh` | `assets/js/src/lazy-modal.js:188-189` | DOM yenileme |
| `window.WDPMetaTracking` | `assets/js/src/meta-tracking.js` | Pixel olayları |

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
| `wdp_meta_tracking_settings` | Meta sekme | `WDP_Meta_Tracking` |
| `wdp_category_title_colors` | Kategoriler | `WDP_Category_Title_Color_Service` |
| `wdp_custom_style_presets` | stil import | `WDP_Style_Presets` |
| `wdp_delete_data_on_uninstall` | Gelişmiş | `includes/class-uninstall.php` |
| `wdp_list_cache_version` | liste HTML geçersiz kılma | `WDP_Donations_List::bump_cache` |
| `wdp_css_signature` | assets registry | `includes/traits/trait-wdp-assets-registry.php:153-156` |
| `wdp_legacy_render_count` | eski (kullanılmayan) sayaç; AJAX yolu 10.33.0’da kaldırıldı | `includes/bootstrap/class-legacy-frontend.php` |
| `wdp_sadaka_links_audit` | migration 10.28.4 anlık görüntü; UI 10.33.0’da kaldırıldı, option silinmez | `includes/class-sadaka-product-visibility.php` |
| `wdp_meta_purchase_wc_migration_v1` | Meta migrate | `includes/class-meta-tracking.php:193-208` |
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

`_allow_custom_price`, `_min_custom_price`, `_allow_multiple_shares`, `_max_shares`, `_enable_progress_bar`, `_progress_bar_limit`, `_goal_reached_action`, `_goal_reached_message`, `_enable_product_note`, `_product_note_text`, `_enable_sadaka_donation`, `_sadaka_*`, `_enable_trust_strip`, `_enable_quantity`, `_enable_amount_presets`, `_enable_wizard`, `_enable_field_icons`, `_enable_impact_line`, `_progress_celebrate`, `_impact_line_text`, `_amount_presets`, `_enable_email|dedication|anonymous` (tristate `yes`/`no`/''), `_dedication_placeholder`, `_trust_badges`, `_theme_primary|primary_hover|modal_bg|radius`, `_layout_mode`, `_enable_campaign_media`, `_enable_urgency`, `_urgency_*`, `_enable_social_proof`, `_social_proof_text`, `_enable_cover_fee`, `_cover_fee_percent`, `_wdp_module_order`, `_wdp_donation_product`, `_wdp_auto_place`.

Ek progress meta: `_wdp_total_donation_amount`, `_wdp_donor_count`, `_wdp_progress_unconverted_orders` (`includes/class-utils.php`, `trait-wdp-utils-order-meta.php`).

**10.31.0 hedef / toplanan:** `WDP_Campaign_Goal` (hedefe ulaşma kararı, message/close/continue); `WDP_Progress_Currency` (`wdp_progress_convert_amount` — Curcy `wmc_order_info` / rate, sert bağımlılık yok). Toplanan = paid statuses − cover fee; boş meta → cron `wdp_recalculate_product_donation_total` (ziyaretçi taraması yok). Çubuk yüzdesi = onaylı toplam / hedef (`WDP_Campaign_Goal::compute_percent`).

**10.32.0 ürün teması:** `WDP_Form_Modules::resolve_product_primary_color` / `resolve_product_shell_primary` (ürün → kategori → genel; `_theme_inherit_category_color` okunmaz). `build_product_theme_style` → `WDP_Color_Palette::from_hex` türevleri + `--wdp-on-primary`; hover boşsa türetilmiş; koyu `--wdp-modal-bg` için metin token’ları. Köşe `PRODUCT_THEME_RADIUS_MIN/MAX` (4–32) + `product_radius_ladder` (panel/sheet oranı). Kampanya görseli URL: filtre `wdp_campaign_media_url` (`class-campaign-header-renderer.php`).

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
| `wdp_rate_limit_*` | transient | Security rate limit (`includes/class-security.php:149-160`) |
| `wdp_migration_lock` | transient | Migrations |
| `wdp_sadaka_line_ids` | transient | Sadaka visibility (`TRANSIENT` const) |
| Liste HTML | 1 gün transient; `wdp_list_cache_version`; `orderby=random` atlar; UID/panel yer tutucu + admin notu cache dışı | `includes/class-donations-list.php` `render` / `bump_cache` |
| `wdp_css_version_*` / `wdp_js_version_*` | transient+cache | assets |
| WC session `get_customer_id()` | session | rate-limit / cart cache suffix (`includes/traits/trait-wdp-ajax-base.php:113-114`) |
| Curcy/WPML cookie (istemci) | cookie okuma JS | lazy-modal para/dil anahtarı (`assets/js/src/lazy-modal.js:61-93`) — eklenti set etmez |

Eklenti tarafında özel `setcookie` **DOĞRULANMADI** (grep: PHP’de setcookie yok; JS yalnız okur).

---

## e) AJAX / REST uçları (tam liste)

`register_rest_route` / `admin_post_` / eklenti `wc_ajax_` kaydı: **yok** (grep). WC fragment yalnız istemci `get_refreshed_fragments` (`assets/js/src/cart/woo.js:35`).

Yetki notu: `run_secured_ajax` varsayılan capability `read`; misafir için `check_capability('read')` → true (`includes/class-security.php:240-244`). `get_product_info` / `get_product_name` capability=`false` (`includes/traits/trait-wdp-ajax-product.php:13,151`).

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
| `wdp_elementor_search_products` | hayır | `wdp_elementor_search_products` | `edit_products` / `edit_posts` | q | `{results:[{id,text}]}` bağış kapsamı, tip sınırı yok | `includes/class-elementor.php` |
| `wdp_recalculate_product_total` | hayır | `wdp_admin_nonce` | `manage_woocommerce` | product_id | total JSON | `includes/class-admin-hooks.php:29` + `includes/class-admin-product-settings-ajax.php:21-56` + `includes/class-admin-request.php:21-26` |
| `wdp_save_placement_settings` | hayır | admin nonce | manage_woocommerce | placement alanları | success | `includes/class-admin-hooks.php:30` |
| `wdp_save_advanced_settings` | hayır | aynı | aynı | uninstall flag vb. | success | `includes/class-admin-hooks.php:31` |
| `wdp_save_normal_form_settings` | hayır | aynı | aynı | button_settings | success | `includes/class-admin-hooks.php:32` |
| `wdp_save_design_studio_settings` | hayır | aynı | aynı | tasarım alanları | success | `includes/class-admin-hooks.php:33` |
| `wdp_save_shareholder_form_settings` | hayır | aynı | aynı | shareholder_settings | success | `includes/class-admin-hooks.php:34` |
| `wdp_save_success_screen_settings` | hayır | aynı | aynı | success_settings | success | `includes/class-admin-hooks.php:35` |
| `wdp_save_modal_layout_settings` | hayır | aynı | aynı | modal_layout | success | `includes/class-admin-hooks.php:36` |
| `wdp_save_category_colors_settings` | hayır | aynı | aynı | category colors | success | `includes/class-admin-hooks.php:37` |
| `wdp_save_progress_bar_settings` | hayır | aynı | aynı | progress | success | `includes/class-admin-hooks.php:38` |
| `wdp_save_meta_tracking_settings` | hayır | aynı | aynı | meta | success | `includes/class-admin-hooks.php:39` |
| `wdp_apply_style_preset` | hayır | aynı | aynı | preset id | success | `includes/class-admin-hooks.php:40` |
| `wdp_export_style_preset` | hayır | aynı | aynı | — | export JSON | `includes/class-admin-hooks.php:41` |
| `wdp_import_style_preset` | hayır | aynı | aynı | import payload | success | `includes/class-admin-hooks.php:42` |

Ürün Bağış paneli kaydı AJAX değil: `woocommerce_admin_process_product_object` (`includes/class-admin-product-data-tab.php:37`).

---

## f) Kısa kodlar, blok, Elementor, ürün/mağaza entegrasyonu

### Kısa kodlar

| Tag | Render | Dosya:satır |
|-----|--------|-------------|
| `[wdp_donation_button]` | popup buton+modal | `includes/class-shortcodes.php:21,33-40` |
| `[wdp_donation_button_panel]` | side panel | `includes/class-shortcodes.php:22,49-56` |
| `[wdp_donation_form]` | gömülü form | `includes/class-shortcodes.php:23,65-72` |
| `[wdp_donations]` | liste ızgara | `includes/class-shortcodes.php:24` → `WDP_Donations_List::shortcode` |

Ürün çözümleme: `WDP_Product_Resolver` + `resolve_for_output`. `id`/`slug`/`sku` açıkça verilirse bağış kapsamı atlanır.

Liste önbelleği bump (10.33.0 + 10.34.0; aynı istekte bir kez): stok/kategori (önceki) + `woocommerce_update_product`, `woocommerce_new_product`, `save_post_product`, `trashed_post` / `untrashed_post` / `before_delete_post`, `transition_post_status`, fiyat/ilerleme meta (`_price` `_regular_price` `_sale_price` `_wdp_total_donation_amount` `_wdp_donor_count`), bağış sekmesi kaydı (`on_product_settings_save`), sipariş durum / iade. 10.34.0 `step_10_34_0` bir kez sürüm artırır (kart HTML değişti).

**Liste kartı (10.34.0):** görsel ve başlık gerçek `<a href>` (ürün permalink); CTA popup/panelde `<button type="button" class="wdp-card__cta wdp-open-modal" data-wdp-lazy="1">` (sayfadan ayrılmaz); `button=link` iken `<a href>`. İç içe `<a>` yok (görsel bağlantısı `aria-hidden tabindex=-1`). Custom kart: yalnız `min. {wc_price(_min_custom_price)}` (sabit fiyat yok). Kampanya: toplanan/hedef `wc_price` + çubuk yalnız `_progress_bar_limit>0`; `DEFAULT_GOAL` kart yüzdesinde kullanılmaz; toplanan 0 anlamlı metin. Sekmeler: yalnız üründe doğrudan kategori; `get_option('default_product_cat')` ve slug `uncategorized` yok. `card_html` `includes/class-donations-list.php`.

**Fiyatsız custom/campaign (10.34.0):** `WDP_Donation_Purchasable` `woocommerce_is_purchasable` pri 20 — yayınlanmış (veya `edit_post`) bağış ürünü Genel fiyat boşken satın alınabilir. Min yalnız `_min_custom_price`. Eklenti Genel fiyatı yazmaz/eşitlemez. Kart/form birim fiyatı `wc_get_price_to_display`. Genel fiyat alanı görünür kalır; Bağış sekmesinde not.

**Şart b E2E (10.34.1, görev 2b):** Hedef (`allowMetaMutation`): custom + campaign ürününde `_regular_price`/`_price` geçici boşaltılır (`saveProductPrices`), liste önbelleği bump, (1) listede `data-product-id` görünür (2) ürün sayfası Bağış Yap (3) sepete eklenir tutar doğru (4) custom kartta sabit fiyat yok / HTML bozuk değil; `finally` eski fiyata döner — geri yükleme hatası testi fail eder. Ikram: gerçek fiyata dokunulmaz; `private` + `catalog hidden` + `_wdp_e2e_test=1` geçici custom ürün; `asAdmin` tam permalink (`pathname` `?p=` düşürmez) + sepet; `deleteMarkedProduct` (işaretsiz silinmez). Liste görünürlüğü Ikram’da atlanır. Coming soon değişmez.

**Ürün sayfası auto_place yedek (10.34.1):** Elementor/Avada şablonu Woo sepete-ekle öğesi içermezse şablon override ve summary kancası çalışmaz. `auto_place=yes` iken `render_builder_fallback` bir kez basar (`woocommerce_after_single_product` + `wp_footer`); `has_product_ui` / `template_override_used` varsa boş. `includes/class-product-page-integration.php`.

**Tutar etiketi koşulu (10.34.2):** Görünür “Bağış Tutarı” yalnız gerçek tutar *girişi* olan türlerde (bağışçı belirler `render_custom_price_amount_row`, hedefli/kampanya `render_progress_amount_block`). Sabit tutar `render_fixed_price_quantity_row` fiyat kutusu + adet (eşit ızgara); etiket yok (yalnız `screen-reader-text` / `aria-label`). Hisselide tutar girişi yok → etiket yok. CSS ile gizleme yok. `includes/templates/class-form-fields-renderer.php`.

**CTA alt dolgu (10.34.2):** `--wdp-cta-clearance` = `--wdp-form-cta-height` + `max(10px, env(safe-area-inset-bottom), --wdp-safe-bottom)`. Popup `scroll-padding-bottom`; panel `.wdp-side-panel-main` `max-height: 100%` yok (footer kardeş, örtmez), son içerik kaydırınca çubuğun üstünde. E2E `tests/e2e/helpers/layout.mjs` (boundingBox; öğe yoksa fail). `assets/css/src/foundation/tokens.css`, `layout.css`, `side-panel.css`.

### Gutenberg

| Blok | Kayıt | Render |
|------|-------|--------|
| `blocks/donation-form` | `WDP_Blocks::register` `includes/class-blocks.php:52-57` | shortcode benzeri (`includes/class-blocks.php:72+`) |
| `blocks/donations` | `includes/class-blocks.php:58-62` | liste |

### Elementor

`WDP_Elementor` widget kaydı (`includes/class-elementor.php`); widget’lar shortcode fonksiyonlarını çağırır (`includes/elementor/class-widget-*.php`). Form ürün seçimi SELECT2 ajax (`wdp_elementor_search_products`). Liste `image_size` + `columns_tablet`/`columns_mobile` → `WDP_Donations_List::atts_from_elementor_settings`.

### Ürün sayfası / mağaza

- Kapı: `WDP_Placement_Settings::value('auto_place')==='yes'` (`includes/class-product-page-integration.php:43-45`)
- Şablon: `templates/woocommerce/single-product/add-to-cart/simple.php` via `wc_get_template` / `locate_template` filtreleri (`includes/class-product-page-integration.php:54-55`)
- Döngü: `woocommerce_loop_add_to_cart_link` (`includes/class-product-page-integration.php:58`) — popup/panel/lazy
- Lazy modal: `data-wdp-lazy` + AJAX `wdp_render_modal` (`includes/class-lazy-modal.php`, `assets/js/src/lazy-modal.js`)
- Fallback: summary hook’ları (`includes/class-product-page-integration.php:100-107`)
- Ürün override: `_wdp_auto_place` (`includes/class-product-page-integration.php:515`, `includes/class-product-page-integration.php:556`)

---

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
| Ürün vurgu rengi | ürün `_theme_primary` → kategori `wdp_category_title_colors` → genel marka; başlık aynı kural (`get_title_style_attr`) | `WDP_Form_Modules::resolve_product_*` / `WDP_Category_Title_Color_Service` |
| Anonim maske | yalnız herkese açık yüzeyler (`sanitize_public_donation_data`); sipariş/admin/e-posta orijinal ad | `mask_public_donor_name` |
| Hızlı tutar düğmeleri | global `enable_amount_presets==='1'` → ürün `_enable_amount_presets==='no'` gizler; yalnız custom/campaign; min altı elenir; "Önerilen" yalnız ürün `_amount_preset_recommended` dolu ve görünen listedeyse (ortadaki/genel varsayılan yok; seçili gelmez) | `render_amount_presets` (`includes/templates/class-form-fields-renderer.php`) |
| Modül sırası | ürün `_wdp_module_order` dolu → yoksa button `module_order` → defaults | `WDP_Form_Modules::resolve_order` (`includes/class-form-modules.php:74-84`) |
| Güven rozetleri | global → ürün `_trust_badges` doluysa ürün | `resolve_trust_badges` (`includes/class-form-modules.php:145-175`) |
| Otomatik yerleşim | global `auto_place` + ürün `_wdp_auto_place!=='no'` | `should_auto_place` / meta (`includes/class-product-page-integration.php:515+`) |
| Alt bağış WC ürünü | ürün `_sadaka_wc_product_id` → yoksa success `sadaka_wc_product_id` | `WDP_Utils::resolve_sadaka_wc_product_id` (`includes/class-utils.php:104+`) |

### Ürün sayfası ve liste (`wdp_placement_settings`)

| Ekran (AYARLAR) | Option alanı | Varsayılan | Okuma |
|-----------------|--------------|------------|-------|
| Sepete Ekle yerine Bağış | `auto_place` | `yes` (yeni kurulum defaults; option yoksa get() `auto_place=>no`) | `includes/class-placement-settings.php:33-45,84-91` |
| Konum | `position` | `replace_cart` | aynı |
| Görünüm | `display` | `button_panel` | aynı |
| Fiyat gizle | `hide_price` | `yes` | aynı |
| Form başlığı | `show_form_title` | `no` | aynı |
| Döngü butonu | `loop_button` | `panel` | aynı |
| Kapsam | `donation_scope` | `all` | Scope |
| Kategoriler | `donation_categories` | `[]` | Scope |
| Schema | `schema` | `auto` | `WDP_Schema` |

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
| Kutlama | `_progress_celebrate` | boş→yes; yalnız onaylı %100 geçişinde | progress-bar.js `data-wdp-was-complete` |
| Hızlı tutar / Tutarlar / Önerilen | `_enable_amount_presets`, `_amount_presets`, `_amount_preset_recommended` | presets varsayılan yes; kayıtta katı doğrulama; Önerilen yalnız ürün (boş=etiket yok; listede yoksa kayıt hata); okumada yumuşak parse | form-fields, product-settings-service |
| Adet seçici | `_enable_quantity` | boş→yes; yalnız sabit tipte; sunucu adedi kapalıyken/sabit olmayan tipte 1'e sabitler (`WDP_Cart::product_allows_quantity`, hisseli hariç) | context, ajax-cart-add |
| Cover fee | `_enable_cover_fee`, `_cover_fee_percent` | off / 0; tüm tipler; kayıt 0 veya 0,5–15 (`normalize_cover_fee_percent_for_save`, aralık dışı = hata), çalışma anı `clamp_cover_fee_percent_for_runtime`; yüzde sunucuda HER ZAMAN ürün meta'sından (`WDP_Cart::get_product_cover_fee_percent`), istemci yüzdesi yok sayılır; fiyat: custom → `custom_price`, sabit/hisseli → `wdp_base_unit_price` × (1+yüzde); sepette "İşlem ücreti" satırı; formda `data-wdp-form-total` Toplam satırı | context, cart, ajax-cart-add, form-modules |
| E-posta/İthaf/Anonim | `_enable_*` tristate | `''`→global; hisseli tipte UI+sunucu yok; geçersiz e-posta `donation_email` hatası; ithaf 120 karakter (mb); sepette e-posta/ithaf/anonim satırı (kendi sepet) | CTX + Optional_Fields + cart display |
| Ürün notu | `_enable_product_note`, `_product_note_text` | off; kayıt sınırı 400 (okumada kırpma yok) | context / PSS |
| Wizard / ikon | `_enable_wizard`, `_enable_field_icons` tristate | `''`→global (`enable_multi_step` / `enable_field_icons`) | CTX + MSR |
| Etki / aciliyet / sosyal / medya / layout / tema… | ilgili `_` meta | bkz. `from_request` | context + header renderer |
| Alt bağış | `_enable_sadaka_donation`, `_sadaka_*` | off | context; kampanyada UI gizlenir (product_info `includes/traits/trait-wdp-ajax-product.php:102`) |
| Blok sırası | `_wdp_module_order` | boş→global | resolve_order |

### Global sekmeler → option anahtarları (varsayılan örnekleri)

| Sekme | Option | Örnek varsayılanlar (normalizer) | Kanıt |
|-------|--------|----------------------------------|-------|
| Normal (+ kısmen Tasarım alanları aynı option) | `wdp_button_settings` | primary `#0f608b`, popup text `Bağış Yap`, hızlı tutar düğmeleri `enable_amount_presets` default `'0'`, `amount_presets` hiç kaydedilmemişse `WDP_Form_Modules::default_amount_presets_csv()` (ondalıklı: `5, 10, 25, 50, 100`; 0 ondalık: `100, 250, 500, 1000, 2500`; kayıtlı değer değişmez), katı doğrulama: `WDP_Admin_Settings_Normalizer::$last_validation_error`, donor email/dedication/anonymous `'0'` | `includes/class-admin-settings-normalizer.php`, `includes/class-form-modules.php:206-220` |
| Hisseli | `wdp_shareholder_settings` | header `#0f608b`, email enable `'0'` | `includes/class-admin-settings-normalizer.php:280-314` |
| Başarı | `wdp_success_settings` | buton renkleri, sadaka toggle label | `includes/class-admin-settings-normalizer.php:335-353` |
| Progress | `wdp_progress_bar_settings` | fill/pending/height | `includes/class-admin-settings-normalizer.php:372+` |
| Modal | `wdp_modal_layout_settings` | panel %50, popup 540px, … | `includes/class-admin-settings-normalizer.php:433-456` |
| Meta Pixel | `wdp_meta_tracking_settings` | enabled/view/add_to_cart on; purchase off; require_consent on | `includes/class-meta-tracking.php:24-39` |
| Kategoriler | `wdp_category_title_colors` | — | service OPTION_KEY |
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
3. `WDPApp.product.fetchProductInfo` → POST `wdp_get_product_info` + nonce (`assets/js/src/product.js:45-47`, `assets/js/src/modal.js:403-405`)  
4. Yanıt: fiyat/hisse/sadaka HTML normalize; skeleton kapanır (product/modal işbirliği)  
5. Watchdog: uzun skeleton uyarısı (`assets/js/src/modal.js:304-314`)

### D) Doğrulama → sepete ekle / ödemeye git

1. CTA tık → `WDPApp.form` validate (`assets/js/src/form/validate.js`, `assets/js/src/form.js` submit yolu)  
2. `submitFormData(form, isCheckout)` → `formAjax.submitFormData` (`assets/js/src/form.js:205-207`, `assets/js/src/form/ajax.js:576+`)  
3. POST `action=wdp_ajax_add_to_cart` + `security` + alanlar + `wdp_ajax_flow`  
4. PHP: `ajax_add_to_cart` → rate/nonce → doğrulama → `WC()->cart->add_to_cart` (+ sadaka satırı) (`includes/traits/trait-wdp-ajax-cart-add.php`)  
5. Başarı: mini-cart UI, Meta AddToCart, checkout ise yönlendirme (`assets/js/src/form/ajax.js` `handleAjaxResponse`)  
6. Ağ hatası: `verify_submission_in_cart` kurtarma (`tryRecoverCartAfterAjaxFailure` `assets/js/src/form/ajax.js:517+`)

---

## i) Paketleme ve dağıtım

| Mekanizma | Ne yapar | Kanıt |
|-----------|----------|-------|
| `npm run pack` | `build` + `scripts/package-wp-plugin.sh` | `package.json:14` |
| `.distignore` | ZIP dışı: node_modules, .env*, docs, tests, tools, scripts, vendor… | `.distignore:4-38` |
| `scripts/package-wp-plugin.sh` | rsync exclude → admin CSS minify → (DEST’te tools yoksa bundle yeniden denemesi uyarıya düşebilir) → prune → `build/woo-donation-popup.zip` | `scripts/package-wp-plugin.sh:57-119` |
| `npm run deploy:staging` | `scripts/deploy-staging.mjs` | `package.json` |
| `npm run deploy:ikram` / `ship:ikram` | rsync + SSH alias `ikramaid` (`--dry-run` kuru çalıştırma); ardından `e2e:quick --env ikram` | `scripts/deploy-ikram.mjs`, `scripts/ship-ikram.mjs` |
| `npm run ikram:wp` | Ikram WP-CLI köprüsü (yalnız alias `ikramaid`; kara liste yıkıcı komutlar) | `scripts/ikram-wp.mjs`, `scripts/lib/ikram-wp-guard.mjs` |
| Canlı kilidi | İzin listesi: `staging30.hedefdernegi.org` + `ikramaid.uk`. Kilit klasör yoluna göre (`allowedRoot`). Kara liste: `hedefdernegi.org` (canlı). | `scripts/lib/deploy-guards.mjs` |
| Uzak doğrulama | `validateRemoteSiteUrl` birebir eşleşme | `scripts/lib/deploy-guards.mjs` |
| `npm run ship:staging` | deploy + `e2e:quick --open-report` | `scripts/ship-staging.mjs` |
| Rsync dışlama | `.distignore` tek kaynak (`pack-excludes.mjs`) | `scripts/lib/pack-excludes.mjs` |

### Göç provası

Canlı/staging’de göçü çalıştırmadan önce yerel prova. Eklenti kodu (PHP/JS/CSS) bu araçlarla değişmez. Değerler yalnız `build/migration/*.json` içine yazılır (git dışı); konsol ve `.md` özetinde anahtar adı, sınıf, tür, sha256 ilk 12.

| Komut | Ne yapar | Kanıt |
|-------|----------|-------|
| `npm run migration:snapshot -- --env local --label <etiket>` | Eski+güncel kaynak ağacından anahtar çıkarır; `wdp_%` + eski önekler + ürün meta; WC mağaza ayarları salt okunur. `--env staging\|ikram`: profil `ssh.alias/wpPath/siteUrl` + `findTargetById`/`findTargetByAlias`; komut `wp --path="$HOME/…" eval-file` (`spawnGuarded`, yalnız Claude; birim testte spawn yok). Eval yazma yok. Uzak payload gzip+base64 + `fold -w 76` (OpenSSL `base64 -d` uzun satırda sessiz 0 bayt üretmesin); boş decode çıkış 97. Anahtar kümesi ayrı uzak geçici dosya (`WDP_MIG_KEYS_FILE`), PHP’ye `define` enjekte edilmez. stdout boşsa stderr 300 + çıkış kodu. | `scripts/migration-snapshot.mjs`, `tests/e2e/helpers/migration-snapshot.php`, `buildGuardedEvalFileCommand` |
| `npm run migration:rehearsal -- --from 10.3.1` | Temiz yerel WP+WC → eski eklenti (`build/migration/source/10.3.1/woo-donation-popup` veya `onceki.zip` 10.28.12) → görüntü → güncel kopya + `upgrader_process_complete`/`maybe_run` → görüntü → karşılaştır → göç 2. kez (idempotent). | `scripts/migration-rehearsal.mjs`, `tests/local-wp/migration-ops.php` |
| `npm run migration:compare -- --before a.json --after b.json` | Sınıflar: KORUNDU, TAŞINDI, DEĞİŞTİ, VARSAYILANA DÖNDÜ, KAYBOLDU, YENİ, **BEKLENEN DEĞİŞİM**. Çıkış 2: KAYBOLDU/VARSAYILANA DÖNDÜ/DEĞİŞTİ > 0 (sürüm/önbellek/log/`wdp_migrated_*` hariç). `--idempotent` birebir (BEKLENEN DEĞİŞİM fail değil). | `scripts/lib/migration-compare-core.mjs` |

Anahtar çıkarıcı: `get_option`/`update_option`/`add_option`/`get_post_meta`/`update_post_meta` + `wdp_` / `_wdp_` dizgi sabitleri (`scripts/lib/migration-keys.mjs`). TAŞINDI tablosu: `WDP_Migrations::BACKUP_OPTION` → `BACKUP_RESTORED_OPTION`. BEKLENEN DEĞİŞİM: `wdp_version`, `wdp_db_version`, `wdp_cache_version`, `wdp_list_cache_version`, `wdp_migration_log`, `wdp_migrated_*`. 10.3.1 kaynağı `build/migration/source/10.3.1/woo-donation-popup/` (git dışı).

`.env.deploy` / `.env.e2e` / `.env.*.ikram` **okunmadı** (görev yasağı); yalnızca anahtar adları şablonlarda belgelidir.

**KAYIT:** `ikramaid.uk` izni Ikram Aid yayına alınmadan önce **KALDIRILACAK** (`IKRAM_ALLOW_REMOVAL_NOTE` in `scripts/lib/deploy-guards.mjs`).

---

## j) E2E altyapısı (kısa)

| Öğe | Değer |
|-----|--------|
| Komutlar | `e2e:quick`, `e2e:full`, `e2e:matrix`, `e2e`, `e2e:baseline`, `e2e:accept`, `e2e:stability`, `e2e:perf` (`package.json`) |
| Ortam | Profil JSON `tests/e2e/profiles/*.json` + sır dosyası `.env.e2e` / `.env.e2e.ikram`; yükleyici `tests/e2e/helpers/env.mjs` |
| Çıktı | `build/e2e/current/<ortam>/<cihaz>/`; baseline `tests/e2e/__baseline__/<ortam>/<cihaz>/` |
| Manifest | `run.json` (`tests/e2e/helpers/run-io.mjs`) |
| Eşik | sayfa varsayılan **%0.5**; kabuk popup/panel **%0.1** |
| Quick | Yalnız iPhone (WebKit) + değişen alan (`tests/e2e/area-map.json` + `git diff --name-only HEAD`); `--env ikram`; `--all --device desktop` eski 70’lik küme |
| Full | 3 cihaz × gerçek ortam(lar), merge öncesi (`tests/e2e/run-full.mjs`) |
| Matrix | Yerel tema × mağaza pairwise (`tests/e2e/matrix.json`): TT5 + Storefront; TRY/EUR/USD/GBP; blok + klasik ödeme; HPOS açık/kapalı (her tema her ödeme türü, HPOS her durumda ≥2). 3 cihaz. Sipariş yalnız yerel (`cheque`). Koşucu `tests/e2e/run-matrix.mjs`; `--only <id>` / `--device <ad>`. Özet `build/e2e/matrix/summary.md`; ekran `build/e2e/matrix/<yapılandırma>/<cihaz>/`. Anlık görüntü SQLite kopyası; yapılandırmalar ayrı port + WP kopyasıyla paralel (varsayılan 3 işçi). |
| Accept | `--env` + `--device`; yalnız Değişti+Yeni; functional hata 0 |

### Uzak keşif

Salt okunur envanter (yazma yok; `spawnGuarded` zorunlu). Claude çalıştırır; Cursor yalnız `--env local` veya sahte ssh birim testi.

| Öğe | Değer |
|-----|--------|
| Komut | `npm run remote:discover -- --env staging\|ikram` (yerel WP: `--env local`, SSH yok) |
| Betik | `scripts/remote-discover.mjs` + `scripts/lib/remote-discover-lib.mjs` |
| Profil | `loadProfile` (`tests/e2e/profiles/*.json`); `ssh.alias` + `ssh.wpPath`; her `wp` çağrısında `--path`; `--skip-themes` yok |
| Çıktı | `build/discovery/<env>.json` + `.md`; kanarya `build/e2e/canary/<env>-baseline.json` |
| Engel | `facebook-for-woocommerce`, `official-facebook-pixel`, `google-listings-and-ads`, `google-site-kit` **veya herhangi bir aktif SMS eklentisi** (katalog/sınıf `sms`, ör. Netgsm) aktifse `REMOTE-BLOCKED` ve çıkış **3** |
| Giden veri statik | Kanca geri çağrıları Reflection + kaynak okuma (tetiklemez; tek seviye derinlik); Code Snippets `SELECT` (id/scope/priority/etkin + kanca/çağrı türü; ad/kod yazılmaz); wp-cron sahip/sıklık/sonraki; WP Mail SMTP `Do Not Send` true/false + mailer + `pre_wp_mail` slug. SMTP `mail`/`smtp` ve Do Not Send=false → uyarı (engel değil). Çıktı `outbound_static` + MD «Giden veri statik denetimi». | `scripts/lib/remote-discover-lib.mjs` `EVAL_STATIC_OUTBOUND` / `detectOutboundCalls` / `assembleReport` |
| Güvenlik | Sabit eval listesi; kanca/cron/snippet tetiklenmez (`do_action`/`apply_filters`/`wp_schedule`/`spawn_cron` yok); değer/e-posta/URL/anahtar yazılmaz; bağlantı hatasında en fazla 1 tekrar |
| Woo sayfa türü | `has_block('woocommerce/checkout'\|'woocommerce/cart')`, `has_shortcode`, içerikte `[woocommerce_checkout` / `[woocommerce_cart`, `CartCheckoutUtils::is_*_block_default()`. Sonuç: `block` / `classic` / `classic-in-builder` / `unknown`. İçerik yazılmaz. | `scripts/lib/remote-discover-lib.mjs` `classifyWooPageKind` / `EVAL_WOO` |

### Test ortamları ve profiller

| Profil | Dosya | Sırlar | Tema / oluşturucu | Para | Coming soon | SSH |
|--------|-------|--------|-------------------|------|-------------|-----|
| Hedef staging30 | `tests/e2e/profiles/staging-hedef.json` | `.env.e2e` + `.env.deploy` | Avada Builder | TRY `₺` | kapalı | alias `hedef-staging`, `~/www/staging30.hedefdernegi.org/public_html` |
| Ikram Aid | `tests/e2e/profiles/ikram-aid.json` | `.env.e2e.ikram` + `.env.deploy.ikram` | Blocksy + Elementor | GBP `£` | açık (paylaşım çerezi; option yazılmaz) | alias `ikramaid`, `~/www/ikramaid.uk/public_html` |
| Yerel | `tests/e2e/profiles/local.json` | `.env.e2e.local` | — | — | — | yok |

Siteye özel değer (sembol, ayırıcı, telefon ön eki, dil) testte sabit yazılmaz; profilden okunur. Ürün eşlemesi rol bazlı (`custom` / `fixed` / `shares` / `campaign`); uzak profilde ürün adı/ID yok (bootstrap fixture). `shares: null` → hisseli testler atlanır (gizlenmez). Uzak profillerde `allowMetaMutation: false` (yükleyici reddeder); mutasyon yalnız bootstrap ürünlerinde. `E2E_BASE_URL` uzak profilde `baseUrl` ile birebir aynı olmalı.

**Sepet e-posta/ithaf gerileme (F9, `form-fields-cart-shows-email-dedication`):** Eklenti `display_donation_data_in_cart` 10.33.0 ile aynı (`includes/class-cart.php:388-479`; `git show 163fe09`). Store API `item_data` e-posta/ithaf basar (aynı filtre). 2/3 `form-fields` `onCart=/\/cart\/?/` + Hedef `wc_get_cart_url` kök/`/sepet/` 404. Asıl 404: Woo sepet sayfası `woocommerce_cart_page_id` **çöpte** (Hedef id 291 `trash`; `get_permalink` → `/?page_id=291` pathname `/`). Düzeltme (eklenti yok): `ensureWooCartPagePublished` (yalnız Hedef `allowMetaMutation`); `fillDonor` eksik alanda fail; teşhis JSON. `tests/e2e/helpers/staging-wp-meta.mjs`, `form-fields.mjs`.

Coming soon: WP-CLI `woocommerce_share_key` okunur veya `E2E_COMING_SOON_SHARE_KEY`; çerez `woo-share` (ziyaretçi liste). Ürün/mağaza/ödeme: `asAdmin` (`wpCliAuth`: `wp user list --role=administrator` + `tests/e2e/.auth/<profil>.json` storageState; geçerliyse yeniden kullanılır). Ziyaretçi yüzeyleri (`asVisitor` + share): liste, popup kabuğu, boş-ürün mesaj sızıntısı — oturumsuz context. `blog_public` ve coming soon option **değiştirilmez**.

### Uzak koşu güvenliği

Ölçüm/reklam ve sipariş yazımı `tests/e2e/helpers/network-guard.mjs` içinde. Her `BrowserContext` `installBrowserGuard` / `applyNetworkGuard` ile `context.route` alır (capture, auth, run-*, perf, diag).

| Kural | Davranış |
|-------|----------|
| Tracker engeli | Uzak koşularda varsayılan ve **kapatılamaz** (env ile bile). Yerelde de açık. Liste: Facebook/Meta piksel, Google Analytics/GTM/Ads/pagead/ccm, DoubleClick, Bing, Clarity, Hotjar, TikTok, LinkedIn, Pinterest, Snap, Yandex (`mc.yandex.ru`), Segment, Plausible, Matomo (yaygın host/yol), `pixel.wp.com` / `stats.wp.com`. `fonts.googleapis.com` / `gstatic` ve sitenin kendi alanı engellenmez. Sayaç: hostname + adet (`blocked_trackers` → `run.json`); URL sorgu dizesi yazılmaz. |
| Uzakta sipariş yok | Yalnız uzak profil (`isRemoteProfile`: `profile.remote` boolean varsa o; `ssh.alias` doluysa uzak; `id=local` yerel; `allowedHosts` yalnız 127.0.0.1/localhost ise yerel). POST `?wc-ajax=checkout`, Store API `/wc/store/v1/checkout` (POST/PUT), `admin-ajax.php?action=woocommerce_checkout`, ödeme formu POST (`wc_get_checkout_url()` yolu; sabit `/checkout/` veya `odeme` slug yok), `post-new.php?post_type=shop_order`, `wc-orders&action=new` → istek iptal + test kırmızı `REMOTE-ORDER-BLOCKED: <yol>`. GET ödeme sayfası serbest. |
| Uzakta POST varsayılan-red | Site alanına giden POST/PUT/PATCH/DELETE yalnız izin listesindeyse geçer: `wc-ajax` `add_to_cart` / `get_refreshed_fragments` / `remove_from_cart` (`apply_coupon` ve `update_order_review` yok, ödeme sayfasında da); Store API `/wc/store(/v1)/cart/*` ve `/batch` (gövdedeki tüm istekler cart yolundaysa); `admin-ajax.php` action `wdp_*` + `woocommerce_add_to_cart` / `woocommerce_get_refreshed_fragments`; sepet formu (`wc_get_cart_url()`) `update_cart`/`remove_item`. Diğer yazım iptal + `remote_post_blocked` (yol, sorgu yok, action adı serbest). Sipariş benzeri ayrıca kırmızı. Yerelde POST serbest. |
| checkout-view-only | Uzakta ödeme sayfası açılır, ürün adı + Woo biçimli tutar doğrulanır; `fill`/`type`/`selectOption`/`check` yok, “Sipariş ver” tıklanmaz. Sipariş tamamlama atlanır (neden `skips`). Sipariş/HPOS yalnız `local.json`. |
| Oturum | Uzakta yönetici oturumu ortam başına bir kez (`tests/e2e/.auth/<profil>.json`). Geçerlilik (wp-admin) en fazla 1 kez; kilit dosyası ile işçiler paylaşır, kendileri giriş yapmaz. `wpCliAuth` form girişini hiç denemez. Form girişinde başarısızsa tekrar yok: “Giriş başarısız; Wordfence kilidini önlemek için tekrar denenmedi”. |

Güvenli alan (10.34.0 + 10.34.2): alt CTA `env(safe-area-inset-bottom)` + JS `--wdp-safe-bottom` (iPhone-benzeri, env()=0 iken 34px taban); kapat düğmesi `env(safe-area-inset-top)` + `--wdp-safe-top` (47px taban). `viewport-fit=cover` enjekte edilmez. 10.34.2 `--wdp-cta-clearance` kaydırma payı. `assets/js/src/core/cta-viewport.js`, `assets/css/src` layout/mobile-polish/side-panel.

**Ekran görüntüsü stabilizasyonu (10.34.2, yalnız test):** `STABILIZE_SHOT_CSS` (`tests/e2e/helpers/stabilize-shot-css.mjs`) çekim anında `#wpadminbar` + WooCommerce Coming soon bandı (`#coming-soon-footer-banner`, `.coming-soon-footer-banner`, `.woocommerce-coming-soon-banner`, `.woocommerce-store-notice`, `.woocommerce-info`) gizler. Sınıfı kaçan kısa “Coming soon mode” düğümleri `hideComingSoonNoticeForShot` ile yalnız çekimde kapanır. İşlevsel tıklamada yok; eklenti CSS/PHP bu seçicileri gizlemez. Katalogdaki Coming soon sayfa gövdesi (asAdmin içerik) site görünürlüğü değiştirilmeden durur. `tests/unit/js/stabilize-shot-css.test.mjs`.

### Cihaz projeleri ve komutlar

Öncelik: 1) iPhone (WebKit, iPhone 15, dokunmatik, güvenli alan 47/34) 2) Android (Chromium, Pixel 7) 3) masaüstü (Chrome 1440). Tanımlar: `tests/e2e/helpers/devices.mjs`, `tests/e2e/playwright.config.mjs`.

| Komut | Davranış |
|-------|----------|
| `e2e:quick` | iPhone + alan süzgeci; hedef &lt; 5 dk |
| `e2e:full` | 3 cihaz × ortam; cihazlar sırayla (meta yarışı yok); env içinde ürün URL/ID bir kez |
| `e2e:matrix` | Yerel WP+SQLite tema/Woo matrisi; `--only` / `--device`; sipariş yalnız yerel |
| `e2e:stability` | Aynı cihazda iki koşu; varsayılan iPhone |

### ship:ikram ve güvenlik kilidi

`scripts/deploy-ikram.mjs`: verify + test + pack → uzak eklenti **dizinini** (`wp plugin path SLUG --dir`; dosya yolu `normalizeRemotePluginDir` ile düzeltilir) zip yedekle (`$HOME/wdp-backups`) → rsync kaynak/hedef sonda slash + `--delete` yalnız eklenti dizini + `.distignore` dışlamaları → activate + migrations → `wp eval 'echo 1;'` → `wp sg purge` / `wp cache flush` / liste cache bump. `--dry-run` uzak yazmaz.

**Ikram etkileşimi yalnız repo içi node scriptleri üzerinden:** `npm run ikram:wp -- …` / `deploy:ikram` / `ship:ikram`. Doğrudan `ssh` / `rsync` yazılmaz (Cursor deny). `ikram:wp` kara listesi: `db drop/reset`, `site empty`, `user delete`, `post delete`, `plugin delete/uninstall`, `option update/delete`. İzin: plugin list/get/status/path, option get, post list/get, wc …, cache flush, sg purge, eval (yıkıcı PHP yok), eval-file `tests/e2e/helpers/cleanup-e2e.php` veya `tests/e2e/helpers/e2e-temp-product.php` (yalnız `_wdp_e2e_test=1`). Builtin: `plugin-health`, `php-ok`, `debug-log`, `gateways`.

İzin: yalnız `staging30.hedefdernegi.org` (`hedef-staging` + `~/www/staging30.hedefdernegi.org/`) ve `ikramaid.uk` (`ikramaid` + `~/www/ikramaid.uk/`). Kara liste `hedefdernegi.org` / `~/www/hedefdernegi.org` (canlı). **ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.**

Operatör kapısı: uzak spawn yalnız `CLAUDECODE=1` ve Cursor ajan işaretleri yokken (`scripts/lib/remote-guard.mjs`). Cursor CLI deny: `.cursor/cli.json`. Canlı yol taraması: `scripts/lib/live-target-scan.mjs` (`npm run verify`).

### Test verisi temizliği

Sipariş/müşteri/ürün: e-posta `*@wdp-e2e.test` + meta `_wdp_e2e_test=1`. Her functional koşu sonunda `tests/e2e/helpers/test-cleanup.mjs` SSH `wp eval` (HPOS `wc_get_orders`, işaretli ürün `WP_Query`; yedek PHP `cleanup-e2e.php`). Silme hatası koşuyu fail eder. Koruma siparişi ve işaretsiz ürün silinmez.

Ödeme URL: `wc_get_checkout_url()` (`tests/e2e/helpers/checkout-setup.mjs`). Hedef (`allowMetaMutation`): çek geçici açılır, sonra eski haline döner. Ikram: ödeme ayarı yazılmaz; çevrimdışı yöntem yoksa sipariş tamamlama atlanır (neden yazılı). Ürün ID: WP-CLI `post list` + Store API yedek (`resolve-products.mjs`). Konsol 404: istek URL + `kind=` (favicon/theme/plugin) — gizlenmez.

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
| `assets/js/src/progress-bar.js:99` | `catch (e) {}` | İsteğe bağlı Meta `trackCustom`; analitik hatası bilinçli yutulur |
| `assets/js/src/bootstrap/event-manager.js:125` | `catch (dbc) {}` | İsteğe bağlı Meta debug click; analitik hatası bilinçli yutulur |
| `assets/js/src/meta-tracking.js:38` | `catch (e) {}` | `console.log` debug; bilinçli |
| `assets/js/src/meta-tracking.js:109` | `catch (err) {}` | `fbq` kuyruk flush; üçüncü taraf / bilinçli |
| `assets/js/src/meta-tracking.js:148` | `catch (e) {}` | `fbq` çağrı; üçüncü taraf / bilinçli |
| `assets/js/src/meta-tracking.js:196` | `catch (e) {}` | once callback; gerçek callback hatasını gizleyebilir |
| `assets/js/src/meta-tracking.js:213` | `catch (e) {}` | `sessionStorage.setItem`; bilinçli (gizlilik / kota) |
| `assets/js/src/meta-tracking.js:229` | `catch (e) {}` | `localStorage.setItem`; bilinçli (gizlilik / kota) |
| `assets/js/src/meta-tracking.js:438` | `catch (eLog) {}` | Purchase debug `console.log`; bilinçli |
| `assets/js/src/form/wizard.js:485` | `catch (e) {}` | `shareholder.relayout`; gerçek layout hatasını gizler |
| `assets/js/src/form/wizard.js:508` | `catch (e) {}` | Meta wizard step; isteğe bağlı analitik / bilinçli |
| `assets/js/src/form/wizard.js:518` | `catch (e3) {}` | `focus({ preventScroll })`; bilinçli (tarayıcı farkı) |
| `assets/js/src/form/wizard.js:528` | `catch (e4) {}` | `startViewTransition` yoksa fallback; bilinçli |
| `includes/class-admin-assets.php:228` | inline JS `catch (e) {}` | `history.replaceState` sekme hash; bilinçli |
| `includes/class-admin-assets.php:294` | inline JS `catch (e) {}` | hashchange `replaceState`; bilinçli |

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
- Klasör kilidi: alias + `wpPath` + `siteUrl` üçlüsü `ALLOWED_DEPLOY_TARGETS` kaydıyla birebir. Komut içi `~/` `/home/` `$HOME/` `--path=` yolları izinli kökün içinde. Uzak komutta `..` yol parçası, göreli/`cd ~`/`cd -`/`cd $HOME`/`cd`, `pushd`/`popd`, `ln -s`, `find /`, `ls ~`, `ls /` RED. `hedefdernegi.org` yalnız `staging30.hedefdernegi.org` biçiminde.
- İzinli hedefler (**tek yer** `scripts/lib/deploy-guards.mjs`): `staging-hedef` (`hedef-staging`, `~/www/staging30.hedefdernegi.org/`), `ikram-aid` (`ikramaid`, `~/www/ikramaid.uk/`). Kara liste: `hedefdernegi.org`, `www.hedefdernegi.org`, `~/www/hedefdernegi.org`. `ikramaid.uk` kaldırma notu durur; freeze ikram’ı da keser.
- Cursor deny: `.cursor/cli.json` (`Shell(ssh|scp|sftp|rsync|curl|wget|…)` + `.env*` okuma/yazma).
- Canlı tarama: `scripts/lib/live-target-scan.mjs` `npm run verify` zincirinde; ihlal dosya:satır ile kırmızı.
- Silme: `tests/e2e/helpers/cleanup-e2e.php` + `safe-remote-write.mjs`. Koşullar: (a) `_wdp_e2e_test=<run_id>` (sabit `"1"` değil), (b) `build/e2e/run-registry.json` içinde, (c) beklenen post_type. Defter boşsa hiçbir şey silinmez. Fixture ürünleri temizlik silmez (yalnız `e2e:bootstrap --remove-fixtures`, işaret+sahiplik: id fixture dosyasında, meta işaretle eşit, durum private). Koşu defteri her koşuda sıfırlanırken `fixtures` kayıtları korunur.
- Kara liste: `page`, `attachment`, `nav_menu_item`, `wp_template*`, `elementor_library`, Woo/WP çekirdek sayfa ID’leri (`page_on_front`, `woocommerce_*_page_id`, eklenti başarı sayfası). Kullanıcı silme: meta + e-posta + defter; içerik varsa red; `wp_delete_user($id, null)` yalnız içerik 0 iken.
- Fixture: `npm run e2e:bootstrap -- --env local`. `--env staging\|ikram --dry-run` uzak yazmadan plan listeler (`_wdp_e2e_test=<run_id>`, `private`, katalog/arama gizli, sayfa/menü/kategori/görsel/ayar yok, kayıt defteri). Gerçek kurulum: kanarya → ürünler → kanarya (beklenen = defter ∪ doğrulanmış fixture). Başarıda (yalnız fark = yeni/silinen fixture) `build/e2e/canary/<env>-baseline.json` otomatik güncellenir. Tek satır: `Kanarya: önce TEMİZ/KIRMIZI, sonra TEMİZ/KIRMIZI (beklenen yeni: N ürün)`. Silme: `--remove-fixtures` ( `--remove` eşanlamlı). Uzak gerçek koşu yalnız Claude. Mutasyon testleri (amount-options, form-fields, campaign-blocks, product-theme, shortcodes, empty-price) fixture yoksa `e2e:bootstrap çalıştırın` ile FAIL. Gizli ürün listede görünmez; liste/kart testleri gerçek katalog ürünlerini yalnız okur.

### Kanarya

`tests/e2e/helpers/canary.mjs` + `canary-snapshot.php` yalnız okur. `npm run e2e:canary -- --env staging\|ikram\|local`: salt okunur ölçüm → `build/e2e/canary/<env>-baseline.json` ile karşılaştır. Beklenen kayıtlar = koşu defteri (`build/e2e/run-registry.json`) ∪ ortamın kalıcı fixture dosyası (`build/e2e/fixtures-<profil>.json`). Fixture ürünü yalnız üçü doğrulanırsa beklenen sayılır: id dosyada, uzakta `_wdp_e2e_test` fixture işaretine eşit, durum private (doğrulama mevcut anlık görüntüdeki `mark`+`status`; ek uzak komut yok). Defter/fixture dışı fark → `build/e2e/CANARY-ALERT.txt` + kırmızı durdurma. `--update-baseline` yalnız TEMİZ iken (fark yok veya yalnız defter/doğrulanmış fixture). `e2e:bootstrap` başarıyla bitince (yalnız fark = fixture) baseline’ı yazar; `--remove-fixtures` sonrası da. Profil `ssh.alias/wpPath/siteUrl` + `spawnGuarded`; komut `wp --path=<wpPath> eval-file`. Ön kontrol (site-bağımsız): id 0 = ayarlı değil, sorun değil (`page_for_posts`, `page_on_front`, `woocommerce_terms_page_id`, `woocommerce_myaccount_page_id`, `woocommerce_shop_page_id`). `page_on_front` yalnız `show_on_front=page` ve id>0 iken var/publish olmalı. KIRMIZI yalnız ayarlı (id>0) sayfa yok/çöp/taslak. `woocommerce_cart_page_id` / `woocommerce_checkout_page_id` id 0 → UYARI (engel değil; blok sepet/ödeme şablon da olabilir). KIRMIZI olunca CANARY-ALERT option adı + id + durum yazar (içerik yok; boş `pre-bootstrap` etiketi yok).

### Yerel kanıt ortamı

Docker / wp-env yok. `scripts/local-wp.mjs`: PHP + WordPress + SQLite (`build/local-wp/wordpress`). `ensureLocalWp(kök)` veya `ensureLocalWp({ quiet, root })`; `resetLocalWp(kök)` prova kökünü sıfırlar. `tests/local-wp/eval-file.php` hedefi `$wdp_eval_target` / `$wdp_eval_args` (WP 7.1 `pages.php` `$file` sızıntısı). `npm run test:local-wp` reproduce + yeni temizlik + kanarya + bootstrap.

Eklenti kodu (`includes/`, `uninstall.php`) sayfa oluşturmaz/silmez; `wp_trash_post` kancaları yalnız dinler (`includes/class-utils.php:55,72`). `update_option` eklentide `wdp_*` (migrasyon yedeği `BACKUP_OPTION_KEYS` de `wdp_*`; döngü süzgeci yok — yedek eklenti kendi dosyası).
