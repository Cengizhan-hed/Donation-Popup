# MIMARI — woo-donation-popup (10.28.12)

Kalıcı mimari harita. Sonraki görevler için ilk okuma noktası.  
Dal referansı: `docs-mimari` / commit `220f4ec`.  
Kural: her iddia `dosya:satır`; emin olunmayan yerler **DOĞRULANMADI**.

---

## a) Klasör yapısı ve ana dosya sorumlulukları

| Yol | Sorumluluk | Kanıt |
|-----|------------|-------|
| `woo-donation-popup.php` | Giriş: sabitler, aktivasyon/deaktivasyon, bootstrap | `woo-donation-popup.php:25-56` |
| `uninstall.php` | Kaldırmada yalnızca `wdp_delete_data_on_uninstall=1` ise option/transient/`wdp_*`+`_wdp_*` ürün meta siler; sipariş meta dokunulmaz | `uninstall.php:22-53` |
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
4. Modül `init()` sırası (`includes/class-woo-donation-popup.php:47-64`): Utils → Assets → Meta_Tracking → Ajax → Cart → Order → Sadaka_Product_Visibility → Donations_List → Product_Page_Integration → Lazy_Modal → Schema → Blocks → Elementor → Form_Matrix → Shortcodes

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
| `window.wdp_ajax` | PHP localize | nonce, ajax_url, currency, meta… (`includes/traits/trait-wdp-assets-registry.php:294`) |
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
| `wdp_delete_data_on_uninstall` | Gelişmiş | `uninstall.php:22` |
| `wdp_list_cache_version` | liste/sadaka flush | `Donations_List` / sadaka |
| `wdp_css_signature` | assets registry | `includes/traits/trait-wdp-assets-registry.php:153-156` |
| `wdp_legacy_render_count` | legacy button AJAX | `includes/bootstrap/class-legacy-frontend.php:95-96` |
| `wdp_sadaka_links_audit` | migration 10.28.4 | admin Gelişmiş |
| `wdp_meta_purchase_wc_migration_v1` | Meta migrate | `includes/class-meta-tracking.php:193-208` |
| `wdp_sadaka_visibility_cache_cleared` | migration 10.28.5 | `includes/class-migrations.php:244` |

### Ürün meta (Bağış ayarları — tek kaynak `from_request`)

`includes/class-product-settings-service.php:330-378` anahtarları:

`_allow_custom_price`, `_min_custom_price`, `_allow_multiple_shares`, `_max_shares`, `_enable_progress_bar`, `_progress_bar_limit`, `_enable_product_note`, `_product_note_text`, `_enable_sadaka_donation`, `_sadaka_*`, `_enable_trust_strip`, `_enable_quantity`, `_enable_amount_presets`, `_enable_wizard`, `_enable_field_icons`, `_enable_impact_line`, `_progress_celebrate`, `_impact_line_text`, `_amount_presets`, `_enable_email|dedication|anonymous` (tristate `yes`/`no`/''), `_dedication_placeholder`, `_trust_badges`, `_theme_*`, `_layout_mode`, `_enable_campaign_media`, `_enable_urgency`, `_urgency_*`, `_enable_social_proof`, `_social_proof_text`, `_enable_cover_fee`, `_cover_fee_percent`, `_wdp_module_order`, `_wdp_donation_product`, `_wdp_auto_place`.

Ek progress meta: `_wdp_total_donation_amount`, `_wdp_donor_count` (`includes/class-utils.php:544-580`).

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
| Liste HTML | transient (liste sınıfı) | `includes/class-donations-list.php:168-171` |
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
| `wdp_render_modal` | evet | **bilinçli yok** | origin+rate+scope | product_id, mode | `{html}` | `includes/class-lazy-modal.php:21-62` |
| `wdp_render_donation_button` | evet | `wdp_render_donation_button` | origin+rate | product_id, button_text | `{html}` | `includes/bootstrap/class-legacy-frontend.php:172-217` |
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

Ürün çözümleme: `WDP_Product_Resolver` + `resolve_for_output` (`includes/class-shortcodes.php:212+`).

### Gutenberg

| Blok | Kayıt | Render |
|------|-------|--------|
| `blocks/donation-form` | `WDP_Blocks::register` `includes/class-blocks.php:52-57` | shortcode benzeri (`includes/class-blocks.php:72+`) |
| `blocks/donations` | `includes/class-blocks.php:58-62` | liste |

### Elementor

`WDP_Elementor` widget kaydı (`includes/class-elementor.php`); widget’lar shortcode fonksiyonlarını çağırır (`includes/elementor/class-widget-*.php`).

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
| E-posta / ithaf / anonim | meta `yes`/`no` → değilse `wdp_button_settings` | `meta_flag_or_global` (`includes/class-donation-product-context-service.php:190-199`) — global anahtarlar: `enable_donor_email`, `enable_dedication`, `enable_anonymous` |
| Chip (hızlı tutar) | global `enable_amount_presets==='1'` → ürün `_enable_amount_presets==='no'` gizler | `render_amount_presets` (`includes/templates/class-form-fields-renderer.php:101-111`) |
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
| Hedef tutar | `_progress_bar_limit` | tip kampanya → `DEFAULT_GOAL` clamp | context |
| En düşük tutar | `_min_custom_price` | `0` | context / cart |
| En fazla hisse | `_max_shares` | boş → runtime `7` | context `includes/class-donation-product-context-service.php:60-61`, product_info `includes/traits/trait-wdp-ajax-product.php:98-99` |
| Kutlama | `_progress_celebrate` | boş→yes | context |
| Hızlı tutar / Tutarlar | `_enable_amount_presets`, `_amount_presets` | presets varsayılan yes | form-fields |
| Adet seçici | `_enable_quantity` | boş→yes | context |
| Cover fee | `_enable_cover_fee`, `_cover_fee_percent` | off / 0 | context |
| E-posta/İthaf/Anonim | `_enable_*` tristate | `''`→global | meta_flag_or_global |
| Ürün notu | `_enable_product_note`, `_product_note_text` | off | context |
| Wizard / ikon / etki / aciliyet / sosyal / medya / layout / tema… | ilgili `_` meta | bkz. `from_request` | context + header renderer |
| Alt bağış | `_enable_sadaka_donation`, `_sadaka_*` | off | context; kampanyada UI gizlenir (product_info `includes/traits/trait-wdp-ajax-product.php:102`) |
| Blok sırası | `_wdp_module_order` | boş→global | resolve_order |

### Global sekmeler → option anahtarları (varsayılan örnekleri)

| Sekme | Option | Örnek varsayılanlar (normalizer) | Kanıt |
|-------|--------|----------------------------------|-------|
| Normal (+ kısmen Tasarım alanları aynı option) | `wdp_button_settings` | primary `#0f608b`, popup text `Bağış Yap`, chips `enable_amount_presets` default `'0'`, `amount_presets` `100, 250, …`, donor email/dedication/anonymous `'0'` | `includes/class-admin-settings-normalizer.php:31-140` |
| Hisseli | `wdp_shareholder_settings` | header `#0f608b`, email enable `'0'` | `includes/class-admin-settings-normalizer.php:280-314` |
| Başarı | `wdp_success_settings` | buton renkleri, sadaka toggle label | `includes/class-admin-settings-normalizer.php:335-353` |
| Progress | `wdp_progress_bar_settings` | fill/pending/height | `includes/class-admin-settings-normalizer.php:372+` |
| Modal | `wdp_modal_layout_settings` | panel %50, popup 540px, … | `includes/class-admin-settings-normalizer.php:433-456` |
| Meta Pixel | `wdp_meta_tracking_settings` | enabled/view/add_to_cart on; purchase off; require_consent on | `includes/class-meta-tracking.php:24-39` |
| Kategoriler | `wdp_category_title_colors` | — | service OPTION_KEY |
| Gelişmiş | `wdp_delete_data_on_uninstall` | `'0'` | `includes/class-admin-page-renderer.php:125` |
| Stil paketleri | `wdp_button_settings` (+ share/progress/success merge) + `wdp_custom_style_presets` | `WDP_Style_Presets` | `includes/class-style-presets.php` |

**AYARLAR çapraz kontrol:** Chip için AYARLAR “genel kapalıysa ürün açık olsa da gelmez” → kodla uyumlu (`includes/templates/class-form-fields-renderer.php:101-111`). E-posta global anahtarı AYARLAR’da “Tasarım → E-posta”; kodda `enable_donor_email` (`includes/class-admin-settings-normalizer.php:137`, context `includes/class-donation-product-context-service.php:138`) — etiket/option adı eşleşmesi tutarlı.

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
| `npm run deploy:staging` | `scripts/deploy-staging.mjs` | `package.json:24` |
| Canlı kilidi | `validateDeployEnv`: path+URL içinde `staging`; `/www/hedefdernegi.org/` reddi; zorunlu SSH alanları | `scripts/lib/deploy-guards.mjs:10-51` |
| Uzak doğrulama | `validateRemoteSiteUrl` birebir eşleşme | `scripts/lib/deploy-guards.mjs:60-72` |
| `npm run ship:staging` | deploy + `e2e:quick --open-report` | `scripts/ship-staging.mjs:23-29` |

`.env.deploy` / `.env.e2e` **okunmadı** (görev yasağı); yalnızca anahtar adları README/şablonlarda belgelidir.

---

## j) E2E altyapısı (kısa)

| Öğe | Değer |
|-----|--------|
| Komutlar | `e2e:quick`, `e2e`, `e2e:baseline`, `e2e:accept`, `e2e:stability`, `e2e:perf`, … (`package.json:15-22`) |
| Ortam | `.env.e2e` (git dışı); yükleyici `tests/e2e/helpers/env.mjs` |
| Çıktı | `build/e2e/current/`, `diff/`, `report.html`; baseline `tests/e2e/__baseline__/` |
| Manifest | `run.json` (`tests/e2e/helpers/run-io.mjs`) |
| Eşik | sayfa varsayılan **%0.5**; kabuk popup/panel **%0.1** (`tests/e2e/helpers/env.mjs:76-83`, `tests/e2e/helpers/report.mjs:38-48`) |
| Quick | desktop Chromium, functional + ekran (`tests/e2e/run-quick.mjs:1-9`) |
| Accept | yalnız Değişti+Yeni; functional hata 0 (`tests/e2e/run-accept.mjs` — ayrıntı README) |

---

## k) Gözlemlenen riskler / teknik borç (düzeltme yok)

| # | Gözlem | Dosya:satır |
|---|--------|-------------|
| 1 | `wdp_render_modal` nonce’suz (bilinçli; önbellek); koruma origin+rate+scope | `includes/class-lazy-modal.php:33-41` |
| 2 | `wdp_get_fresh_nonces` nonce’suz; credential_issuance origin | `includes/traits/trait-wdp-ajax-cart-session.php:17-22` |
| 3 | Misafir için `WDP_Security::check_capability('read')` her zaman true (`includes/class-security.php:240-244`); `run_secured_ajax` varsayılan `$capability='read'` (`includes/traits/trait-wdp-ajax-base.php:90-96`) — uç listesi aşağıda | `includes/class-security.php:240-244` |
| 4 | `wdp_render_modal` sunucu maliyeti / nonce’suz → CLAUDE durum notuyla uyumlu gözlem | `includes/class-lazy-modal.php`, `includes/traits/trait-wdp-assets-registry.php` |
| 5 | Uninstall yalnız `wdp_*` / `_wdp_*` ürün meta; `_allow_custom_price` vb. bağış meta silinmez | `uninstall.php:43-52` vs product meta listesi |
| 6 | Deprecated `wdp_get_product_name` hâlâ kayıtlı | `includes/class-ajax.php:53-55` |
| 7 | Legacy `wdp_render_donation_button` + `wdp_legacy_render_count` | `includes/bootstrap/class-legacy-frontend.php:215-217` |
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
