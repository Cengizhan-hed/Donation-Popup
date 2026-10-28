# MIMARI — woo-donation-popup (12.0.0)

Kalıcı mimari harita. Sonraki görevler için ilk okuma noktası.
12.0.0 ile eski form motoru ve eski yönetici ekranı KALDIRILDI: tek deneyim (`src/Modules/Experiences` + onaylı yeni tasarım), tek yönetici menüsü (`src/Admin`), ödeme sayfası otomatik doldurma (`Checkout_Prefill`). Dört dal birleşti: a1 (eski çekirdek kaldırma), adm (yönetici), ui1 (popup/panel/form), ui2 (teşekkür/yan sepet/giriş/Bağışlarım) + d (ödeme ön doldurma); ardından 12-int (entegrasyon).
Kural: emin olunmayan yerler **DOĞRULANMADI** diye işaretlenir. Aşağıdaki "Tarihsel kayıt" başlıklı bölümler (Faz 7 ve öncesi) eski motoru anlatabilir; geçerli durum bu dosyanın a–h bölümleri ve "12.0.0 entegrasyon kararları" bölümüdür.

---

## a) Klasör yapısı ve ana dosya sorumlulukları

| Yol | Sorumluluk |
|-----|------------|
| `woo-donation-popup.php` | Giriş: sabitler (`WDP_PLUGIN_FILE/VERSION/PLUGIN_DIR/PLUGIN_URL/ASSET_VERSION`), `src/Core/class-autoloader.php` yükler, `Bootstrap::run()` çağırır; kısa kod uyumu için 2 ince işlev sarmalayıcı (`wdp_render_donation_button()`, `wdp_render_donation_form()`) |
| `uninstall.php` | `src/Core/class-uninstall.php` (`Uninstall::cleanup_site`): "verileri sil" bayrağı (önce `donation_panel_settings.general.delete_data_on_uninstall`, yoksa `wdp_delete_data_on_uninstall`) açıksa eklenti seçenek/geçici verisi + ürün meta önekleri; sipariş/HPOS'a dokunmaz |
| `src/Core/` | `Autoloader` (gömülü; `DonationPanel\Foo\Bar_Baz` -> `src/Foo/class-bar-baz.php`), `Bootstrap`, `Plugin`, `Container`, `Settings`, `Module_Registry`, `Module_Interface`, `Migrations` + `Version_Migrations` + `Release_12_Upgrade` + `Legacy_Settings_Importer`, `Uninstall` |
| `src/Domain/` | Bağış alan mantığı (çoğu statik; WooCommerce okuma API'sini — `wc_get_*`/`WC_*` — kullanır, ama `Modules\` ve `Cart_Hooks`'a bağımlı DEĞİL: dış katman olay/süzgeçle bilgilendirilir): `Donation_Scope`, `Donation_Type`, `Campaign_Goal`, `Campaign_Totals`, `Progress_Currency`, `Placement_Settings`, `Product_Context`, `Button_Settings`, `Amount_Presets`, `Cover_Fee`, `Addon_Settings`, `Addon_Product_Visibility`, `Privacy_Notice` |
| `src/WooCommerce/` | Sepet kancaları (`Cart_Hooks`, `Cart`, `Cart_Data`, `Addon_Line`), sipariş kalemi meta (`Order_Hooks`, `Order_Meta_Keys`, `Donation_Order_Meta`), satın alınabilirlik (`Donation_Purchasable`), `Checkout/Checkout_Prefill` |
| `src/Http/` | `Rest_Controller` tabanı, `Rate_Limiter`, `Rest/Ping_Controller` |
| `src/Frontend/` | `Assets` (modül varlık kaydı + `add_brand_variables`), `Template_Loader` (tema geçersiz kılma) |
| `src/Modules/<Modül>/` | `EntryPoints`, `Experiences`, `Campaign`, `Impact`, `SocialProof`, `SideCart`, `Thanks`, `TaxRelief`, `DonorAccount`, `Preview` |
| `src/Admin/` | Tek yönetici menüsü ve ekranları (`Admin_Bootstrap`, `Pages`, `Field_Registry`, `Settings_Store`, `Admin_Controller`, `Status`, `Setup_Wizard`, `Guide`, `Admin_View`, `Admin_Assets`) |
| `src/Privacy/` | `Order_Privacy` (WP dışa aktar/sil: sipariş kalemi), `Privacy_Tools` (politika metni, eski `wdp_vid` çerezi temizliği) |
| `src/Support/` | `Price`, `Security`, `Logger`, `Debug`, `Admin_Notice`, `Phone_Countries` |
| `src/Compat/class-public-contract.php` | Dışa açık geri uyum sözleşmesinin TEK dosyası (kısa kod/blok/kanca/veri anahtarı; bkz. f) |
| `src/Cli/` | WP-CLI: kampanya toplamı yeniden hesaplama (`Cli_Command`, `Totals_Recalculator`) |
| `includes/` | **Kalan, geçici**: yalnız ürün düzenleme "Bağış" sekmesi ve onun yardımcıları (`class-admin-product-data-tab`, `-products-list-table`, `-bulk-actions`, `-product-settings-ajax`, `-request`, `class-product-settings-service`, `class-form-modules`, `class-color-palette`, `class-style-presets`, `class-icon-library`, `config/`), `class-woo-donation-popup-admin`/`-admin-hooks`/`-admin-assets` (yalnız ürün sekmesi için küçültüldü) ve eski küresel adların köprüsü (`class-autoloader` = `WDP_Autoloader::MOVED` sınıf takma adları, `class-admin-bridge`, shim'ler `class-utils/-assets/-templates/-donation-optional-fields`). `Bootstrap` köprü dosyası yoksa atlar. Ürün sekmesi yeni kodla yeniden yazılınca silinecek (açık iş) |
| `templates/donation-panel/` | Tema ile geçersiz kılınabilir şablonlar: `experiences/{form,popup,side-panel,inline,bottom-sheet}.php`, `thanks/summary.php`, `tax-relief/step.php` |
| `templates/woocommerce/` | `single-product/add-to-cart/simple.php` (otomatik yerleşim şablon override) |
| `blocks/` | `donation-form`, `donations` (block.json + editör `index.js`); `src/Modules/DonorAccount/block/block.json` |
| `assets/src/` | Modern JS/CSS kaynakları (modül başına): `experiences`, `campaign`, `side-cart`, `thanks`, `donor-account`, `admin`, `ui2-shared` |
| `assets/build/` | `@wordpress/scripts` çıktısı: `<modül>/index.{js,css,asset.php}` (+ `-rtl.css`) |
| `assets/src/list/` -> `assets/build/list` | `[wdp_donations]` liste istemcisi (sekme süzgeci, form açma; 12-ui3). Eski `assets/css/list.css` ve `assets/js/list.js` SİLİNDİ |
| `assets/{css,js}/admin/products.*` | Yalnız ürün "Bağış" sekmesi (eski elle yazılmış dosyalar; paketlenir) |
| `languages/` | `.pot`, `tr_TR.po/.mo`, blok JSON çevirileri; `parts/` dağıtıma girmez |
| `tools/`, `scripts/`, `tests/`, `docs/`, `dev/` (`dev/design/approved`, `dev/design/showcase`, `dev/research`) | Geliştirme (pakete girmez; `.distignore` izinli kök listesi). Ayrıntı ve tam klasör ağacı: `docs/YAPI.md` (kaynak). `design/` ve `research/` artık `dev/` altındadır |

Not: çalışma ağacında gitignore'lu eski `assets/css/build/`, `assets/js/build/` dosyaları kalmış olabilir; kaynakta ve pakette yoktur, `build:css`/`build:js` betikleri `package.json`'da duruyor ama hedef dosyaları (`tools/build-*-bundle.php`) silindi — gerçek derleme `build:modules`. (**DOĞRULANMADI:** `package.json` 12.0.0 değişikliğinin bu iki betiği kaldırıp kaldırmadığı.)

### Bootstrap sırası

1. `woo-donation-popup.php` sabitleri tanımlar, `Core\Autoloader` kaydeder, `Bootstrap::run()` çağırır (`src/Core/class-bootstrap.php`).
2. `Bootstrap::run()`: HPOS uyumluluk bildirimi (`before_woocommerce_init`), yönetici köprüsü (`includes/class-admin-bridge.php` varsa), `Version_Migrations::init`, Preview/CLI, `Plugin::boot`; `init` -> çeviri yükleme (`load_textdomain`); `plugins_loaded` 20 -> `launch_plugin` (WooCommerce yoksa uyarı; admin'de ürün sekmesi sınıfı) + `update_version`.
3. `Plugin::on_plugins_loaded` (öncelik 20): `Migrations::run()` (adımlar `settings_import_v1` v1, `release_12_upgrade` v2) -> `register_core_hooks()` (WooCommerce varsa: `Campaign_Totals`, `Cart_Hooks`, `Order_Hooks`, `Addon_Product_Visibility`, `Donation_Purchasable`, `Donations_List`, `Checkout_Prefill`) -> `Public_Contract::register()` (kısa kodlar, bloklar, Elementor ince katmanı) -> `Module_Registry::boot()` -> yönetimde ya da `donation-panel/v1/admin` REST isteğinde `Admin\Admin_Bootstrap::init` -> `do_action('donation_panel_modules_booted')`.
4. `rest_api_init` -> `Plugin::register_rest_routes` (`donation_panel_rest_controllers` süzgeci; her modül kendi denetleyicisini ekler). `wp_enqueue_scripts` 5 -> `Assets::register_all`.
5. Modül kaydı (`Plugin::register_modules`): `entry_points` (açık), `experiences` (açık, koşulsuz), `campaign` (açık), `impact` (açık), `side_cart`, `social_proof`, `thanks`, `tax_relief`, `donor_account` (varsayılan kapalı; açma/kapama yönetici Genel Bakış'tan ya da `donation_panel_module_enabled` süzgeciyle; `Settings::seed_fresh_install` yeni kurulumda yalnız varsayılan şema kaydını yazar). Kapalı modülün dosyası yüklenmez (sınıf adı metin olarak kayıtlıdır).

---

## b) PHP sınıfları ve hook tablosu

Kaldırılan eski sınıflar (12.0.0): `Woo_Donation_Popup`, `WDP_Ajax` + trait'ler, `WDP_Assets` (yükleyici/erteleme/gömülü veri), `WDP_Lazy_Modal`, `WDP_Form_Matrix`, `WDP_Templates`/modal-shell/form-fields renderer'ları, `WDP_Exceptions`, `WDP_Js_I18n`, `WDP_Plugin_Bootstrap`, eski yönetici sayfa/sekme render sınıfları, `Ui_Switch`, `Settings_Page`. Eski küresel adlar (`WDP_Utils` vb.) yalnız `includes/class-autoloader.php` takma adlarıyla yönetici ürün sekmesine hizmet eder. `WDP_Utils` bölündü: `Price`, `Campaign_Totals`, `Addon_Settings`, `Admin_Notice`, `Debug`, `Button_Settings`.

### Gerçek kanca tablosu (kaynak: `grep -rn "add_action\|add_filter" src includes woo-donation-popup.php`)

| Kanca | Öncelik | Geri çağrı | Dosya |
|-------|---------|------------|-------|
| `init` | 10 | `Bootstrap::load_textdomain` | `src/Core/class-bootstrap.php` |
| `plugins_loaded` | 20 | `Bootstrap::launch_plugin`, `update_version`; `Plugin::on_plugins_loaded` | `src/Core/class-bootstrap.php`, `class-plugin.php` |
| `before_woocommerce_init` | 10 | HPOS `custom_order_tables` bildirimi | `class-bootstrap.php` |
| `rest_api_init` | 10 | `Plugin::register_rest_routes` | `src/Core/class-plugin.php` |
| `wp_enqueue_scripts` | 5 | `Assets::register_all` | `class-plugin.php` |
| `admin_init` 5/20, `admin_notices`, `upgrader_process_complete` | | `Version_Migrations::maybe_run`/`maybe_dismiss_notice`/`maybe_admin_notice`/`on_upgrader_complete` | `src/Core/class-version-migrations.php` |
| `woocommerce_add_cart_item_data` | 99 / 20 | `Cart_Hooks::stamp_input_currency`; `Tax_Relief_Module::add_cart_item_data` | `src/WooCommerce/class-cart-hooks.php` |
| `woocommerce_add_to_cart_validation`, `woocommerce_store_api_validate_add_to_cart` | 10 | bağış alan doğrulama + eklenti akışı dışında yerel ekleme reddi | `Cart_Hooks` |
| `woocommerce_get_item_data`, `woocommerce_before_calculate_totals` (99), `woocommerce_cart_item_price/subtotal`, `woocommerce_cart_item_quantity`, `woocommerce_update_cart_validation`, `woocommerce_cart_item_class/name/thumbnail` | | sepet görünümü, özel fiyat, hisse miktar kilidi | `Cart_Hooks` |
| `woocommerce_blocks_loaded` | 10 | `Cart::register_store_api` (Store API uzantısı `donation-panel`) | `src/WooCommerce/class-cart.php` |
| `woocommerce_checkout_create_order_line_item` | 10 / 20 | `Order_Hooks::add_donation_meta_to_order`; `Tax_Relief_Module::write_order_meta` | `Order_Hooks` |
| `woocommerce_order_item_display_meta_key/value` | 10 | etiket çevirisi | `Order_Meta_Keys`, `Donation_Order_Meta` |
| `woocommerce_is_purchasable` | 20 / 99 | `Donation_Purchasable` (Genel fiyatsız custom/campaign); `Addon_Line` | `src/WooCommerce/` |
| `woocommerce_add_to_cart` 30, `template_redirect` 20 | | `Checkout_Prefill` (ödeme alanı ön doldurma) | `src/WooCommerce/Checkout/` |
| `woocommerce_order_status_changed` 20, `woocommerce_order_refunded` 20, `before_delete_post`/`wp_trash_post`/`untrashed_post`, `updated/added/deleted_post_meta`, `save_post_product`, `woocommerce_update_product`, `woocommerce_loaded` 1, `wdp_recalculate_product_donation_total` (cron) | | kampanya toplamı senkronu + önbellek | `src/Domain/class-campaign-totals.php` |
| `updated_option`, `*_post_meta` | 10 | ek bağış satırı önbellek temizliği | `Addon_Product_Visibility` |
| `set_object_terms`, `woocommerce_product_set_stock(_status)`, `*_product_cat`, `woocommerce_new_product`, `trashed/untrashed_post`, `transition_post_status`, `*_post_meta`, `woocommerce_order_status_changed/refunded` | | `[wdp_donations]` liste önbelleği artırma | `src/Modules/EntryPoints/class-donations-list.php` |
| `wp` 20, `body_class`, `post_class`, `wp_head` 30, `wc_get_template`, `woocommerce_locate_template`, `woocommerce_get_price_html`, `woocommerce_loop_add_to_cart_link`, `woocommerce_product_add_to_cart_text/url`, `woocommerce_product_supports`, `render_block_woocommerce/{add-to-cart-form,add-to-cart-with-options,product-price,product-button}`, `woocommerce_after_single_product` 999, `wp_footer` 4, `woocommerce_single_product_summary`, `woocommerce_after_single_product_summary` 5 | | otomatik yerleşim, döngü/fiyat filtreleri, yedek düğme | `Auto_Placement`, `Loop_Price_Filters`, `Fallback_Button` |
| `init` | 10 | `Blocks::register`; kısa kod kaydı (`Experiences`, `Campaign`, `SocialProof`, `SideCart`, `DonorAccount` modülleri) | `src/Modules/` |
| `elementor/widgets/register`, `elementor/elements/categories_registered` | | Elementor ince katmanı | `src/Modules/EntryPoints/Elementor/class-elementor-compat.php` |
| `donation_panel_rest_controllers` | 10 | her modül kendi REST denetleyicisini ekler; yönetici denetleyicisi | modüller, `Admin_Bootstrap` |
| `donation_panel_form_model` | 15 / 20 | `Campaign_Module::filter_model`, `Impact_Module::filter_model`, `Public_Contract::filter_form_model` | |
| `donation_panel_amount_presets` | 20 | `Public_Contract::filter_amount_presets` (eski `wdp_amount_presets` köprüsü) | |
| `donation_panel_form_steps` 20, `donation_panel_form_step_tax_relief` | | `Tax_Relief_Module` ek adım | |
| `rest_request_before_callbacks` | 10 | `Tax_Relief_Module::capture_request` | |
| `woocommerce_before_thankyou` | 5 | `Thanks_Module::render` | |
| `woocommerce_add_to_cart_fragments`, `wp_enqueue_scripts` 20, `wp_footer` 5 | | `Side_Cart_Module` (sayaç parçası, çekmece) | |
| `woocommerce_get_query_vars`, `woocommerce_account_menu_items`, `woocommerce_endpoint_<ep>_title`, `woocommerce_account_<ep>_endpoint`, `woocommerce_before_checkout_registration_form`, `wp_footer` 5, `wp_loaded` | | `Donor_Account_Module` (Bağışlarım uç noktası, giriş penceresi) | |
| `wp_privacy_personal_data_exporters` 10/11, `wp_privacy_personal_data_erasers` 5/6, `admin_init` (politika metni), `init` 1 (`wdp_vid` çerezini sil) | | `Order_Privacy`, `Privacy_Tools` | `src/Privacy/` |
| `admin_menu` 30, `admin_enqueue_scripts`, `admin_page_access_denied` 1, `plugin_action_links_<dosya>`, `load-<hook>` | | `Admin_Bootstrap` (tek menü, eski adres yönlendirmesi, Rehber yardım sekmeleri) | `src/Admin/class-admin-bootstrap.php` |
| `send_headers`, `admin_bar_node` | | `Preview` (`?dp_preview=1`) | `src/Modules/Preview/` |
| `woocommerce_product_data_tabs/panels`, `woocommerce_admin_process_product_object`, `bulk_actions-edit-product` + handle, `admin_enqueue_scripts`, `wp_ajax_wdp_recalculate_product_total` | | ürün "Bağış" sekmesi (kalan `includes/`) | `includes/class-admin-*.php` |

Dışa açık `apply_filters`/`do_action` listesi: `docs/HOOKS.md`.

---

## c) JS modülleri, CSS, build zinciri

Ön yüz ve yönetici varlıkları modern, jQuery'siz ES modülleri (`.mjs`) ve düz CSS'tir; eski "bundle + stack + `WDPApp`/`wdp_ajax` global" sistemi silindi.

| Adım | Komut / dosya | Çıktı |
|------|---------------|-------|
| Derleme | `npm run build` (zincirin gerçek adımı `npm run build:modules` -> `scripts/build-modules.mjs`) | `assets/src/index.*` ve `assets/src/<modül>/index.{js,mjs,...}` girişleri `wp-scripts build` ile `assets/build/<modül>/index.{js,css,asset.php}` (+ RTL CSS) |
| Kaynak klasörleri | `assets/src/{experiences,campaign,side-cart,thanks,donor-account,admin,ui2-shared}` | `ui2-shared/tokens.css` ortak türetilmiş belirteçler (bkz. "12.0.0 entegrasyon kararları") |
| Kayıt | `Frontend\Assets::define(slug, script, style)` + `register_all()`; sürüm/bağımlılık `index.asset.php`'den | modül varlığı yalnız ilgili sayfada/modül açıkken yüklenir |
| Yönetici | `assets/src/admin/{index,dom,api,wizard}.mjs` + `admin.css` -> `assets/build/admin`; `Admin_Assets` yalnız kendi ekran kancalarında yükler | |
| Paket | `npm run pack` (build + `scripts/package-wp-plugin.sh`); `assets/src` pakete girmez | `build/woo-donation-popup.zip` |

Ön yüz sözleşmesi: sunucu form HTML'ini şablondan üretir (`templates/donation-panel/experiences/*.php`), JS davranış ekler (`store.mjs` saf durum makinesi, `layer.mjs` katman/odak tuzağı, `form.mjs` adımlar/doğrulama/sepete ekle, `index.mjs`). Olaylar: `dp:added` (kök), `donation-panel:cart-added` (document). Para birimi biçimi sunucudan (WooCommerce ayarları); JS'te ayrı biçimleyici/sözlük/global yok. Bütçe (ui1 ölçümü): JS ~6 KB gz, CSS ~7 KB gz.

---

## d) Veri modeli

Option ve meta anahtarları 12.0.0'da DEĞİŞMEDİ (geri uyum sözleşmesi, `Public_Contract::DATA_KEYS`). Yalnız kaldırılanlar: `donation_panel_settings.experiences` grubu (`experiences.engine`), `admin.ui`, seçenek `wdp_upgrade_new_default`, `wdp_deprecated_ajax_*` sayaçları, `wdp_product_info_*` geçici verileri (`Release_12_Upgrade` siler). Eski sürüm göçlerinin `wdp_legacy_render_count` gibi izleri yalnız okunur/silinir.

### Options (`wp_options`)

| Anahtar | Not |
|---------|-----|
| `donation_panel_settings` | Yeni şemalı ayar deposu (`Core\Settings`): `general`, `modules`, `design`, `display`, `form`, `shares`, `placement`, `checkout`, `impact`, `thanks`, `tax_relief`, `admin` (`wizard`, `wizard_step`). Ayrıntı g) |
| `donation_panel_migrations` | Göç adımı durumu (`settings_import_v1`, `release_12_upgrade`) |
| `wdp_button_settings`, `wdp_placement_settings`, `wdp_shareholder_settings`, `wdp_success_settings`, `wdp_progress_bar_settings`, `wdp_modal_layout_settings`, `wdp_custom_style_presets` | Eski seçenekler SİLİNMEZ. `Button_Settings`/`Placement_Settings`/`Product_Context` hâlâ okur; yönetici ekranı yazarken eşlemesi olanlara yansıtır (`Settings_Store::mirror`) |
| `wdp_version`, `wdp_cache_version`, `wdp_db_version`, `wdp_previous_version`, `wdp_migration_log`, `wdp_migrated_*`, `wdp_migration_lock` (geçici), `wdp_list_cache_version`, `wdp_addon_links_audit` | Sürüm/göç/liste önbelleği (`Bootstrap`, `Version_Migrations`, `Donations_List`) |
| `wdp_delete_data_on_uninstall` | Eski veri silme bayrağı; `general.delete_data_on_uninstall` yoksa okunur |

### Ürün meta (Bağış sekmesi; kalan `includes/class-product-settings-service.php::from_request`)

`_allow_custom_price`, `_min_custom_price`, `_allow_multiple_shares`, `_max_shares`, `_enable_progress_bar`, `_progress_bar_limit`, `_goal_reached_action`, `_goal_reached_message`, `_enable_product_note`, `_product_note_text`, `_enable_addon_donation`, `_addon_*` (eski `_enable_sadaka_donation`, `_sadaka_*` okuma yedeği), `_enable_trust_strip`, `_enable_quantity`, `_enable_amount_presets`, `_amount_presets`, `_amount_preset_recommended`, `_enable_wizard`, `_enable_field_icons`, `_enable_impact_line`, `_impact_line_text`, `_enable_email|dedication|anonymous`, `_dedication_placeholder`, `_trust_badges`, `_theme_primary|primary_hover|modal_bg|radius`, `_layout_mode`, `_enable_campaign_media`, `_enable_urgency`, `_urgency_*`, `_enable_social_proof`, `_social_proof_text`, `_enable_cover_fee`, `_cover_fee_percent`, `_wdp_donation_product`, `_wdp_auto_place`. `Domain\Product_Context` bunları okur; yeni formun hangi alanı görsel olarak kullandığı alan bazında **DOĞRULANMADI** (kaldırılan eski görünüm alanları için bkz. docs/AYARLAR.md notu).

Toplam/ilerleme meta: `_wdp_total_donation_amount`, `_wdp_donor_count`, `_wdp_manual_total`, `_wdp_progress_unconverted_orders`, `_wdp_campaign_starts_at|ends_at` (süzgeç `donation_panel_campaign_period`). 12.0.0 yeni: `_wdp_carried_amount` (= göç anındaki saklı toplam) ve `_wdp_campaign_start` (Unix, göç anı) yalnız yoksa kurulur; saklı toplam DEĞİŞMEZ (kullanımı: toplam tanımı, bkz. "K2").

### Sepet öğesi anahtarları

`donation_data` (full_name, phone, note, email, dedication, anonymous, cover_fee, share_count, shareholders), `custom_price`, `unique_submission_key`, `wdp_base_unit_price`, `wdp_input_currency`, `wdp_sadaka_donation`, `wdp_sadaka_linked_wc_product` (+ `wdp_parent_*`), vergi indirimi `donation_panel_tax_relief`. Yazan: `Cart_Hooks` + `Experiences\Cart_Controller` (REST `/cart/add`).

### Sipariş satırı meta

`wdp_donor_name|phone|email`, `wdp_donation_note`, `wdp_dedication`, `wdp_anonymous`, `wdp_cover_fee`, `wdp_share_count`, `wdp_shareholder_%d_%s`, `wdp_donation_type`, `wdp_donation_frequency`, gizli `_custom_price`, `_donation_panel_video_url` (video bağlantısı), `_wdp_tax_relief_declared`, `_wdp_tax_relief_text_hash`. Yazma: `Order_Hooks::add_donation_meta_to_order` (`woocommerce_checkout_create_order_line_item`). Eski çevrilmiş etiket anahtarları `Order_Meta_Keys::normalize_key` ile okunur. Bağışçının yazdığı hiçbir alan anonim dahil sipariş kaydından silinmez/maskelenmez (yalnız herkese açık yüzeyler maskeler).

### Transient / önbellek / oturum

| Anahtar | Kullanım |
|---------|----------|
| `wdp_rate_limit_*`, `donation_panel_rate*` | Hız sınırı (`Support\Security`, `Http\Rate_Limiter`) |
| `wdp_addon_line_ids` | Ek bağış satırı önbelleği |
| nesne önbelleği `wdp_donations` | Kampanya toplamı/bağışçı sayısı (`Campaign_Totals`) |
| `wdp_list_cache_version` + 1 günlük transient | `[wdp_donations]` HTML önbelleği |
| `wdp_vid` | KALDIRILDI (Faz 8): eski çerez gelirse yok sayılır/silinir (`Privacy_Tools::expire_legacy_cookie`); eklenti çerez YAZMAZ. Bkz. docs/PRIVACY.md |

---

## e) REST uçları (ad alanı `donation-panel/v1`) ve kalan yönetici AJAX'ı

12.0.0'da ziyaretçiye açık `admin-ajax` uçları KALDIRILDI (`wdp_ajax_add_to_cart, wdp_get_cart_contents, wdp_get_cart_count, wdp_get_fresh_nonces, wdp_get_product_info, wdp_get_product_name, wdp_remove_cart_item, wdp_render_modal, wdp_verify_submission_in_cart`; `Public_Contract::RETIRED_AJAX_ACTIONS`; sözleşme testi kayıtlı olmadıklarını doğrular). `GET /modal` ve `wdp_render_modal_require_nonce` da yok. Kalan tek `wp_ajax_` eylemi yöneticiye ait `wdp_recalculate_product_total` (`manage_woocommerce`, ürün sekmesi; `includes/class-admin-hooks.php`).

Gerçek uçlar (`grep -rn register_rest_route src`):

| Uç | Yöntem | Yetki / koruma | Modül · dosya |
|----|--------|----------------|----------------|
| `/ping` | GET | herkese açık | `Http/Rest/class-ping-controller.php` |
| `/product/{id}/form` (id isteğe bağlı) | GET | herkese açık, salt okunur, hız sınırı | `Experiences/class-form-controller.php` |
| `/validate` | POST | WP REST nonce + hız sınırı; sunucuda yazmaz | `Experiences/class-form-controller.php` |
| `/cart/add` | POST | JSON zorunlu, girişli kullanıcıda `X-WP-Nonce`, hız sınırı, `submission_key` ile çift ekleme koruması | `Experiences/class-cart-controller.php` |
| `/nonce` | GET | herkese açık, `no-store` | `Experiences/class-cart-controller.php` |
| `/progress/{id}`, `/impact/{id}` | GET | salt okunur, kişi verisiz | `Campaign`, `Impact` |
| `/donations`, `/donations/stats` | GET | salt okunur, kişi verisiz | `SocialProof` |
| `/side-cart` GET, `/side-cart/suggestion` POST | | oturumdaki sepet, `no-store` | `SideCart` |
| `/account/session` GET, `/account/login` POST, `/account/register` POST, `/account/reset` POST, `/account/donations` GET, `/account/repeat` POST, `/account/link-guest` POST, `/account/link-guest/confirm` POST | | yazma uçları `wp_rest` nonce + hız sınırı; oturum gerektirenler `member` izniyle | `DonorAccount/class-account-controller.php` |
| `/admin/settings` POST, `/admin/wizard` POST, `/admin/export` GET, `/admin/import` POST | | `manage_woocommerce` + `X-WP-Nonce` + hız sınırı | `Admin/class-admin-controller.php` |

Yanıtlar kişi verisi döndürmez (hesap uçları oturumlu kullanıcının kendi verisi hariç). Hata biçimi `WP_Error` `donation_panel_*` kodları; güvenlik reddi 403/429. Ayrıntı ve parametreler: docs/HOOKS.md. Store API: `extensions['donation-panel']` kişi verisiz özet + `POST /wc/store/v1/cart/extensions` ile yalnız `dedication/note/anonymous` güncellenir. Uzak e2e koruması için bkz. "12.0.0 entegrasyon kararları (iv)".

---

## f) Kısa kodlar, blok, Elementor, ürün/mağaza entegrasyonu

### Geri uyum katmanı: `Compat\Public_Contract` (tek dosya)

Eski sürümlerden beri sitelerin kullandığı adlar bu dosyada toplanır ve yeni koda yönlendirilir; başka yerde eski ad bulunmaz. Sözleşme sabitleri: `SHORTCODES`, `BLOCKS`, `ACTIVE_HOOKS` (27 ad, kodda çalışır), `RETIRED_HOOKS` (20 ad, çağrılmaz), `RETIRED_AJAX_ACTIONS`, `DATA_KEYS`. Test: `tests/unit/Contract/PublicContractTest.php` (13 test). `register()` (WooCommerce yüklüyken): kısa kodlar, `Blocks::init`, `Elementor_Compat::init`, `donation_panel_amount_presets` ve `donation_panel_form_model` köprüleri. Giriş dosyasında 2 ince işlev sarmalayıcı (`wdp_render_donation_button/form`) `Public_Contract::render_for_product` çağırır.

### Kısa kodlar

| Tag | Render |
|-----|--------|
| `[wdp_donation_button]` | popup düğmesi (+ katman) |
| `[wdp_donation_button_panel]` | sağ panel düğmesi (`id` ile; DEĞİŞMEZ) |
| `[wdp_donation_form]` | sayfa içi form |
| `[wdp_donations]` | liste ızgarası (`Donations_List::shortcode`) |
| `[donation_panel_experience id kind button_text]` | yeni kısa kod (`kind=popup|side_panel|inline|bottom_sheet`) |
| `[donation_panel_progress]`, `[donation_panel_social_proof]`, `[donation_panel_side_cart]`, `[donation_panel_account]` | modül kısa kodları |

Eski kısa kodlar `Shortcodes::render_button/render_form` -> `Experience_Renderer::render` -> `Module_Registry::get('experiences')->shortcode()` zincirinden yeni deneyimi çizer; `donation_panel_experience_html` süzgeci çıktıyı değiştirebilir. Öznitelikler: `id/slug/sku/text/button_text` çalışır; `class` -> `<div class="donation-panel-entry ...">` sarmalayıcı; `title/show_title` yeni formda kullanılmaz. `id` yoksa ürün `Product_Resolver::resolve` ile bulunur (`id/slug/sku` -> blok `postId` -> global `$product` -> `is_product()` + sorgulanan nesne -> global `$post` -> `get_the_ID()` -> düzenleyici önizleme; filtre `wdp_resolve_product`); çözülemezse ziyaretçiye boş. Döngü/liste kartı düğmeleri (`loop_button`, `[wdp_donations]` kartı) ürün sayfasına BAĞLANTI olur (ağır formu liste başına basmamak için; isteğe bağlı tembel açıcı sonraki iş).

### Gutenberg ve Elementor

Bloklar `wdp/donation-form`, `wdp/donations` (`src/Modules/EntryPoints/class-blocks.php`; block.json `blocks/`; editör betiği `wp.i18n` + `wp_set_script_translations`). Hesap bloğu: `src/Modules/DonorAccount/block/block.json`. Elementor: `Elementor_Compat` + `Donation_Form_Widget` + `Donations_List_Widget` yalnız kısa kodun çıktısını döndüren ince uyumluluk katmanıdır (yeni özellik almaz; eklenti başka hiçbir oluşturucuyu tanımaz).

### Giriş noktaları modülü (`src/Modules/EntryPoints/`)

| Sınıf | Sorumluluk |
|---|---|
| `Entry_Points_Module` (`entry_points`, varsayılan açık) | Açıkken `Auto_Placement::init()`; WooCommerce yoksa hiçbir şey |
| `Shortcodes`, `Blocks`, `Experience_Renderer` | giriş çizimi (yukarıda) |
| `Product_Resolver`, `Builder_Detect` | ID'siz ürün çözümü; yalnız genel WP sinyalleriyle düzenleyici/önizleme tespiti |
| `Auto_Placement` | Woo standart kancalarıyla otomatik yerleşim: `simple.php` şablon override, `wp` özet kancaları, blok `render_block_woocommerce/add-to-cart-*`, native add-to-cart söküm, gizleme CSS. Kapı: `placement.auto_place` + ürün `_wdp_auto_place !== 'no'` |
| `Fallback_Button` | Kancalar çalışmazsa kendi düğmesi (`woocommerce_after_single_product` 999 + `wp_footer` 4); aynı sayfada asla iki giriş |
| `Loop_Price_Filters` | Mağaza döngüsü düğmesi, sepete ekle metni/URL, ajax_add_to_cart kapatma, fiyat gizleme |
| `Render_Registry`, `Render_Guard` | İstek içi kayıt defteri: çift giriş/çift form engeli (`wdp_allow_multiple_entries` ile açılır) |
| `Donations_List` | `[wdp_donations]`; kart CTA ürün bağlantısı; önbellek |

Kayıt kuralı: kısa kodlar, bloklar, Elementor katmanı HER ZAMAN kayıtlı (WooCommerce etkinse); modül kapatılırsa yalnız otomatik yerleşim + yedek düğme + döngü/fiyat filtreleri durur. Kural (S5): görünür giriş yoksa eklenti kendi düğmesini çizer; ürün/genel ayarda otomatik yerleşim kapalıysa çizmez.

Ürün sayfası/mağaza ayrıntıları (fiyatsız custom/campaign satın alınabilirliği, native sepet gizleme, tek giriş kuralı) aşağıdaki Faz 7 öncesi tarihsel notlarda; kod yolu artık yukarıdaki sınıflardadır.

---

## g) Ayar → kod eşlemesi

Kaynak rehber: `docs/AYARLAR.md`. Tek yazma yolu yönetici ekranıdır (`Admin\Settings_Store`): doğrular -> `donation_panel_settings` (Core `Settings`) -> eşlemesi olan alanları eski `wdp_*` seçeneğine yansıtır (`mirror`). Okuma: Core kayıtlıysa o, yoksa eski seçenek, yoksa şema varsayılanı. Alan tanımlarının tek kaynağı `Admin\Field_Registry`.

### Çekirdek ayar şeması (`Core\Settings`)

`general.delete_data_on_uninstall`; `modules.{entry_points,experiences,campaign,impact,social_proof,side_cart,thanks,tax_relief,donor_account}`; `design.{colors,brand,accent,button_text,button_full_width}`; `display.mode`; `form.{presets_enabled,presets,donor_email,dedication,dedication_label,anonymous,multi_step,trust_enabled,trust_text,privacy_notice,privacy_text,privacy_url}`; `shares.{header_text,copy_button,email}`; `placement.{auto_place,position,hide_price,show_title,loop_button,scope,categories}`; `checkout.{addon_product_id,addon_label}`; `impact.map`; `thanks.{celebrate,share,message}`; `tax_relief.{step_label,title,text,checkbox_label}`; `admin.{wizard,wizard_step}`.

### Eski ayar -> yeni alan (özet; tam tablo `build/handoff/12-adm-ayar-envanteri.md`)

| Eski (`wdp_*`) | Yeni | Durum |
|---|---|---|
| `popup_button_text`, `popup_button_color`, `popup_button_full_width`, `brand_color` | `design.button_text`, `design.accent`, `design.button_full_width`, `design.brand` | taşındı |
| `enable_amount_presets`, `amount_presets`, `enable_multi_step`, `trust_strip_*`, e-posta/ithaf/anonim | `form.*` | taşındı |
| `auto_place`, `position`, `display`, `hide_price`, `show_form_title`, `loop_button`, `donation_scope`, `donation_categories` | `placement.*`, `display.mode` | taşındı |
| `wdp_delete_data_on_uninstall` | `general.delete_data_on_uninstall` | taşındı |
| renk/yazı/boşluk/köşe/genişlik/dolgu değerleri | tasarım belirteçleri (`--dp-*`) ve tema | yeni modelde otomatik (152 eski ayardan 29 taşındı, 91 otomatik, 32 eski motora özgü kaldırıldı; kayıp 0, testle kanıtlı) |

### Genel -> ürün devralma

| Konu | Sıra | Fonksiyon |
|------|------|-----------|
| Bağış ürünü mü? | tip desteği -> meta yes/no -> `placement.scope` | `Domain\Donation_Scope::evaluate` |
| E-posta / ithaf / anonim | ürün meta `yes`/`no` -> genel `form.*`; hisseli tipte hep kapalı; sunucu kapalı alanı yok sayar | `Product_Context` |
| Çok adımlı form | ürün `_enable_wizard` -> `form.multi_step` | `Product_Context` |
| Aydınlatma bağlantısı | `form.privacy_notice` (açık) + e-posta/ithaf/hisse alanı varsa; adres boşsa WP gizlilik sayfası | `Domain\Privacy_Notice` |
| Hızlı tutarlar | genel `form.presets_enabled` -> ürün `_enable_amount_presets='no'` gizler; yalnız custom/campaign; "Önerilen" yalnız ürün `_amount_preset_recommended` | `Domain\Amount_Presets` |
| İşlem ücreti | yüzde HER ZAMAN ürün meta'sından, aralık 0 veya 0,5-15 | `Domain\Cover_Fee`, `Cart_Hooks` |
| Otomatik yerleşim | `placement.auto_place` + ürün `_wdp_auto_place` | `Auto_Placement` |
| Ek bağış ürünü | ürün `_addon_wc_product_id` (eski `_sadaka_wc_product_id`) -> `checkout.addon_product_id` | `Domain\Addon_Settings` |

Ürün Bağış sekmesi (kalan `includes/`) alanları ve davranışı `docs/AYARLAR.md` "Ürün düzenleme -> Bağış sekmesi" bölümündedir; varsayılanlar `Product_Settings_Service::from_request`.

**Çelişki notu:** `Placement_Settings::defaults()` `auto_place=yes`; seçenek yokken `get()` `auto_place=>no` zorlar (yükseltmede ikinci form önleme).

---

## h) Form akışı (12.0.0; tek deneyim)

1. **Çizim:** giriş (kısa kod/blok/otomatik yerleşim) -> `Experience_Renderer` -> `Experiences_Module::shortcode` -> `Form_Renderer` -> `Form_Context` (model: `Product_Context` + ayarlar; süzgeçler `donation_panel_form_model/_steps/_fields/_amount_presets/_frequency_options`) -> şablon `templates/donation-panel/experiences/{popup,side-panel,inline,bottom-sheet}.php` içinde `form.php`. Kaplar: `Popup`, `Side_Panel`, `Inline_Form`, `Bottom_Sheet`; başlık/kapat düğmesi `form.php`'dedir.
2. **Açılış:** düğme katmanı açar (`layer.mjs`: odak tuzağı, Esc, kaydırma kilidi, sürükleyerek kapatma, `visualViewport` klavye uyumu). Form HTML'i sayfada hazırdır; gerektiğinde `GET /product/{id}/form` aynı modeli/HTML'i döndürür.
3. **Adımlar:** `Form_Context::steps()` türe göre: tutarı bağışçı seçiyorsa `amount` + `details`; sabit tutar/hisseli türlerde tek `details`; ek adımlar `donation_panel_form_steps` ile (vergi indirimi).
4. **Doğrulama:** istemci (`form.mjs`) + `POST /validate` (yazmaz) + sunucuda asıl doğrulama `Cart_Controller`/`Field_Validator`/`Cart_Hooks`; telefon: seçili ön ek + ulusal numara birleşip `+90 532...` biçiminde `donation_phone` olarak gider.
5. **Sepete ekle:** `POST /cart/add` (`submission_key` ile çift ekleme koruması; bayat nonce 403 -> `GET /nonce` + bir kez yeniden dene) -> `Cart_Hooks::run_in_plugin_flow` -> `WC()->cart->add_to_cart`. Eklenti akışı dışında yerel `?add-to-cart=` ve Store API ile bağış ürünü ekleme reddedilir (`should_reject_native_add_to_cart`). Başarı: `{cart_item_key, cart_count, checkout_url, cart_url}`; "ödemeye git" -> `checkout_url`; "sepete ekle, başka bağış seç" -> katman kapanır, `dp:added` + `donation-panel:cart-added` olayları (yan sepet dinler).
6. **Ödeme:** Woo klasik ya da blok ödeme. `Checkout_Prefill` (`woocommerce_add_to_cart` 30, `template_redirect` 20, yalnız `is_checkout()`, order-received hariç) oturum müşterisinin BOŞ fatura alanlarını (ad/soyad ayrılır, telefon, e-posta) sepetteki en son bağışın `donation_data`'sından doldurur; klasik ve blok ödeme aynı müşteriyi okur; dolu alana (giriş yapmış hesap) dokunulmaz; kalıcı müşteri kaydı yok; `woocommerce_checkout_get_value` bilerek kullanılmaz (POST'u ezerdi); hisseli bağış atlanır.
7. **Sipariş:** `woocommerce_checkout_create_order_line_item` -> `Order_Hooks` kalem meta (Türkçe karakter bozulmadan; anonim dahil hiçbir alan silinmez). Kampanya toplamı: `Campaign_Totals` sipariş durum kancalarıyla.

---

## 12.0.0 entegrasyon kararları

1. **`Settings_Store::mirror` hâlâ gerekli.** Form bağlamı (`Domain\Product_Context`, `Button_Settings`, `Placement_Settings`) eski `wdp_button_settings`, `wdp_placement_settings` vb. seçeneklerden okur; yönetici ekranı hem Core `Settings`'e (`donation_panel_settings`) hem eşlemesi olan alanlar için bu seçeneklere yazar. Kaldırma yalnız form bağlamı Core ayarına çevrilince (ayrı iş; veri kaybı olmasın diye eski seçenekler silinmez).
2. **Tasarım belirteçleri tek kaynak `--dp-*`** (`assets/src/experiences/base.css`). ui2'nin `assets/src/ui2-shared/tokens.css` içindeki `--dpx-*` değişkenleri yalnız türetilmiş takma adlardır (`--dpx-accent: var(--dp-color-accent, var(--dp-color-primary))` vb.). Marka/eylem rengi: yönetici ayarı `design.colors = custom` iken `design.brand` ve `design.accent` değerleri `Frontend\Assets::add_brand_variables` ile `:root .donation-panel{--dp-color-primary:..;--dp-accent:..}` olarak satır içi stile yazılır (yalnız geçerli `#hex`; istek başına bir kez); `base.css` `--dp-color-accent: var(--dp-accent, var(--dp-bridge-accent))` olarak türetir. Aksi halde (`design.colors` tema) hiçbir şey yazılmaz, renkler tema ön ayarından gelir. Açık renklerde beyaz yazı kontrastı `oklch` ile otomatik koyulaştırılır (genel çözüm; temaya özel yok).
3. **Form entegrasyonları:** telefon ön eki `Support\Phone_Countries` (mağaza ülkesinden varsayılan ülke; `Form_Context::phone()` ön ek listesi üretir, `form.mjs` seçili ön ek + ulusal numarayı birleştirir); gizlilik bağlantısı `Domain\Privacy_Notice` (ayar `form.privacy_notice` açık + formda e-posta/ithaf/hisse alanı varsa gösterilir; adres boşsa WP gizlilik sayfası, o da yoksa gösterilmez); açma düğmesi tam genişlik: ayar `popup_button_full_width` (yönetimde `design.button_full_width`) -> `Form_Renderer::button_full_width` -> şablonlarda `.donation-panel-btn--block`.
4. **Uzak güvenlik koruması** (`tests/e2e/helpers/network-guard.mjs`): uzak ortamda `donation-panel/v1` altında yazan her istek (`cart/add`, `side-cart/suggestion`, `account/*` — tekrar bağış, giriş bağlama vb. —, `admin/*`) engellidir; yalnız GET ve sunucuda yazmayan `validate` POST'u geçer (`DONATION_PANEL_REST_READ_ONLY_POST_ROUTES = ['validate']`). Bu, eski admin-ajax izin listesinin karşılığıdır (eski AJAX listesi emekli ve donmuş). Hem `/wp-json/donation-panel/v1/...` hem `?rest_route=` biçimi çözülür.
5. **Ödeme ön doldurma:** `WooCommerce\Checkout\Checkout_Prefill` (bkz. h-6). Testler: `tests/unit/Checkout/CheckoutPrefillTest.php`, e2e `checkout-prefill` (klasik + blok).
6. **Tek deneyim / tek yönetici:** `engine`, `ENGINES`, `engine_is_new`, `admin.ui`, `Ui_Switch`, `wdp_upgrade_new_default`, "eski deneyime dön" kaldırıldı; `Plugin::register_modules` `experiences` + `impact` koşulsuz açık. Eski adres `wdp-popup-settings` `admin_page_access_denied` ile Genel Bakış'a yönlenir.

---

## i) Paketleme ve dağıtım

| Mekanizma | Ne yapar | Kanıt |
|-----------|----------|-------|
| `npm run pack` | `build` + `scripts/package-wp-plugin.sh` | `package.json:14` |
| `.distignore` | ZIP dışı: node_modules, .env*, docs, tests, tools, scripts, vendor… | `.distignore:4-38` |
| `scripts/package-wp-plugin.sh` | rsync exclude → admin CSS minify →  prune → `build/woo-donation-popup.zip` | `scripts/package-wp-plugin.sh:57-119` |
| `npm run deploy:staging` / `deploy:ikram` | Ortak `scripts/lib/ship-core.mjs` (e2e yok). `--dry-run` uzak yazmaz; `--rollback` son yedekten. | `scripts/deploy-staging.mjs`, `scripts/deploy-ikram.mjs` |
| `npm run ship:staging` / `ship:ikram` | Güvenli zincir + (çıkış 0 ise) `e2e:quick`. Ortam farkı yalnız profil. | `scripts/ship-staging.mjs`, `scripts/ship-ikram.mjs`, `scripts/lib/ship-core.mjs` |
| `npm run ikram:wp` | Ikram WP-CLI köprüsü (yalnız alias `ikramaid`; kara liste yıkıcı komutlar) | `scripts/ikram-wp.mjs`, `scripts/lib/ikram-wp-guard.mjs` |
| Canlı kilidi | İzin listesi: `staging30.hedefdernegi.org` + `ikramaid.uk`. Kilit klasör yoluna göre (`allowedRoot`). Kara liste: `hedefdernegi.org` (canlı). Uzak hedef **tek kaynak** = profil JSON + `ALLOWED_DEPLOY_TARGETS`. `.env.deploy*` / `.env.e2e*` hedef anahtarları (`DEPLOY_SITE_URL`, `DEPLOY_WP_PATH`, `DEPLOY_SSH_ALIAS`, `DEPLOY_SSH_*`, `E2E_BASE_URL`) uzak profilde kullanılmaz (farklıysa tek satır uyarı; canlıysa `KARA LİSTE`; koşu profille devam). `spawnGuarded` üçlüsü yine izin listesiyle birebir. | `scripts/lib/deploy-guards.mjs` `applyAllowlistOverEnv` |
| Uzak doğrulama | `validateRemoteSiteUrl` birebir eşleşme | `scripts/lib/deploy-guards.mjs` |
| `npm run ship:staging` | güvenli zincir + `e2e:quick --open-report` | `scripts/ship-staging.mjs` |
| Rsync dışlama | `.distignore` tek kaynak (`pack-excludes.mjs`) | `scripts/lib/pack-excludes.mjs` |

E8M paket içeriği: `.distignore` ayrıca `test-results/`, `playwright-report/`, `blob-report/`, `coverage/`, `build/`, `.cursor*`, `.claude*`, `.env*`, `.last-run.json` dışlar (Plugin Check hidden_files bulgusu). Kanıt: `npm run test:package` (`tests/unit/js/package-contents.test.mjs`; zip'i üretir, sahte `test-results/.last-run.json` koyup izinli kök/uzantı listesine, gizli/geliştirme dosyası yokluğuna ve < 5 MB'a bakar); `verify`'a bağlı. Çıktı `build/woo-donation-popup.zip`. `docs/` WordPress.org paketine girmez (yalnız readme.txt + README.md); belgeler depoda kalır.

### Kod kalitesi araçları

Yalnız geliştirme bağımlılığı. Dağıtım ZIP’ine ve hiçbir siteye girmez (`.distignore` + `package-wp-plugin.sh` prune; birim test `tests/unit/js/lint-pack.test.mjs`).

| Araç | Komut | Yapılandırma | Kanıt |
|------|-------|--------------|-------|
| PHPCS + WPCS + PHPCompatibilityWP | `npm run lint:php` | `phpcs.xml.dist` (WordPress-Extra, Docs hariç; text domain `woo-donation-popup`; önek `wdp`/`WDP`/`hdf`; WP 5.0 / PHP 7.4) | `scripts/lint-php.mjs` → `build/lint/phpcs.json\|md` |
| PHPStan 6 + WP/Woo stubs | `npm run analyse:php` | `phpstan.neon` (12-f: seviye 6, baseline yok; `src/`, `templates/`, `blocks/`, ana dosya; bkz. "12-int2" bölümü) | `scripts/analyse-php.mjs` → `build/lint/phpstan.json\|md` |
| WordPress Plugin Check | `npm run plugin-check` | Yerel WP `build/local-wp` + WP-CLI phar; eklenti **dağıtım ZIP**’inden; ağ yoksa atla | `scripts/plugin-check.mjs` → `build/lint/plugin-check.json\|md` |
| Baseline | `tools/lint-baseline/` (git) + kopya `build/lint/` | 12-f sonrası yalnız ESLint/Stylelint/Plugin Check; PHPCS/PHPStan baseline'ı YOK | `scripts/lib/lint-baseline.mjs` |
| PHPCBF (WPCS) | `npm run lint:php:fix [-- dosya]` | `phpcs.xml.dist` | `scripts/lint-php-fix.mjs` (dosyayı yerinde düzeltir; sonra `lint:php`) |
| Rector | `npm run rector:dry` | `rector.php` (kural kümesi boş; `WDP_RECTOR_RENAME=1` → 6-C "sadaka"→"addon" sınıf/yöntem adı kuralları, `tools/rector/rename-map.json`) | `scripts/rector-dry.mjs`; harita: `npm run sadaka:inventory` (DB/meta anahtarı + kanca adı **dokunma** listesi dahil). Yalnız kuru çalıştırma |
| ESLint / Stylelint | `npm run lint:js` / `lint:css` | `eslint.config.mjs` (assets/js, ES2022 betik), `.stylelintrc.json` (recommended) | `scripts/lint-front.mjs`; baseline `tools/lint-baseline/baseline-eslint.json`, `baseline-stylelint.json` (`lint:js:baseline`/`lint:css:baseline`); **`verify:lint-front` yalnız YENİ hatada kırmızı** |
| jscpd | `npm run dup:js` | `.jscpd.json` (assets/js + assets/css) | `scripts/dev-audit.mjs dup` → özet `build/handoff/FAZ6-HEDEF-LISTESI.md` (JSCPD bölümü) |
| Ölü kod (shipmonk/dead-code-detector) | `npm run dead:php` | `tools/phpstan.dead.neon` (phpstan.neon + rules.neon; baseline'sız) | `scripts/dev-audit.mjs dead` → FAZ6-HEDEF-LISTESI.md (DEADCODE bölümü). WP kanca/dinamik geri çağrılar tanınmaz: silmeden elle doğrula |
| lint-staged | `npm run lint:staged` | `.lintstagedrc.json` (PHP: `scripts/lint-staged-php.mjs`; JS/CSS: lint-front `--files`) | Yalnız verilen dosyalarda baseline dışı yeni hata → çıkış 1 (git hook'a bağlı değil) |

Bu araçların yapılandırmaları (`rector.php`, `eslint.config.mjs`, `.stylelintrc.json`, `.jscpd.json`, `.lintstagedrc.json`; `tools/phpstan.dead.neon` zaten `tools/` altında) `.distignore` ve `package-wp-plugin.sh` ile dağıtım paketinden dışlanır; hiçbiri siteye kurulmaz (doğrulandı: ZIP içinde 0 eşleşme).
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

> 12.0.0 notu: eski modal/admin-ajax'a bağlı senaryo adları, seçiciler (`.wdp-*`, `WDPApp`) ve `includes/...` satır başvuruları tarihseldir; e2e yardımcıları ve baseline'lar yeni deneyime (`.dp-*`) göre yeniden bağlandı. Uzak ağ koruması için bkz. "12.0.0 entegrasyon kararları" (4).

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

## k) Teknik borç ve açık işler (12.0.0)

Eski k.1-k.9 gözlemleri (nonce'suz `wdp_render_modal`, misafir `capability=read` AJAX uçları, `wdp_get_fresh_nonces`, eski AJAX boş-catch envanteri, eski JS `catch` listesi) ilgili ön yüz admin-ajax uçları ve eski JS kaldırıldığı için GEÇERSİZDİR (REST uçları e bölümünde; hepsi `permission_callback` + hız sınırı ile). Güncel açık işler:

| # | Konu |
|---|------|
| 1 | `includes/` altındaki ürün "Bağış" sekmesi ve yardımcıları (~4.800 satır) yeni kodla yeniden yazılıp `includes/` ve köprü (`WDP_Autoloader::MOVED`) silinecek; `Style_Presets`, `Icon_Library`, `Color_Palette` yeni formda kullanılmıyor olabilir (silmeden doğrula: **DOĞRULANMADI**) |
| 2 | Ürün Bağış sekmesindeki eski görünüm alanlarının (tema rengi, düzen, alan ikonu vb.) yeni formdaki karşılığı alan bazında doğrulanmadı |
| 3 | `Settings_Store::mirror` (eski `wdp_*` seçeneklerine yansıtma) form bağlamı Core ayarına geçince kaldırılır |
| 4 | Döngü/liste kartı için isteğe bağlı tembel açıcı (şimdilik ürün bağlantısı) |
| 5 | Kampanyalar ekranındaki "yeniden hesapla" yer tutucusu (`.dpa-recalc-slot`) işlevi; `_wdp_carried_amount`/`_wdp_campaign_start` kullanımı (kampanya toplamı, bkz. K2) |
| 6 | `package.json` içinde dosyası silinmiş eski `build:css`/`build:js` betikleri (DOĞRULANMADI) |
| 7 | Faz 8: KVKK/GDPR dışa aktarma/silme uçları ve Consent API ayrıntıları (`docs/PRIVACY.md`) |


---

## Çeviri (i18n)

Kaynak dil İngilizce `__('…', 'woo-donation-popup')`; görünür Türkçe `languages/woo-donation-popup-tr_TR.po|.mo`. 12.0.0: modül çevirileri `languages/parts/<kod>.po` altında yazılır, `npm run verify:i18n` birleştirir ve doğrular.

| Parça | Dosya | Not |
|-------|-------|-----|
| Domain Path | `woo-donation-popup.php` başlık `Domain Path: /languages` | WP 6.7+ `init`’te yükle |
| Yükleme | `Core\Bootstrap::load_textdomain` | `load_plugin_textdomain('woo-donation-popup', false, dirname(plugin_basename(WDP_PLUGIN_FILE)) . '/languages')` |
| JS sözlük | KALDIRILDI (12.0.0) | Ön yüz iletileri sunucudan (model/şablon/veri öznitelikleri) gelir; eski `WDPApp.i18n` ve `wdp_ajax.i18n_dict` yok |
| JS API | Blok editörü: `wp.i18n` + `wp_set_script_translations` (`languages/*-wdp-block-*.json`) | `tools/i18n/verify-js.mjs` `assets/src` + `assets/js/admin` tarar |
| POT | `npm run i18n:pot` → `tools/i18n/make-pot.mjs` | xgettext PHP (+ blok betikleri) |
| Birleşim | `npm run i18n:merge` | `languages/parts/*.po` → `tr_TR.po`; aynı msgid farklı msgstr = ÇAKIŞMA |
| MO | `npm run i18n:mo` | `msgfmt --check` |
| Altın 1 | `tools/i18n/golden/golden-tr-source.json` | PHP tokenizer (`tools/i18n/token-scan.php`); regex değil |
| Tuzak | `tools/i18n/golden/text-as-key-report.md` | `===` / `in_array` / `switch` / dizi anahtarı |
| Altın 2 | `npm run i18n:golden -- --capture\|--compare` | `tests/golden/i18n/<locale>/<config>/<ekran>.json` |
| Paket | `.distignore` `languages/parts/` | `*.po` / `*.pot` / `*.mo` ZIP’e girer |

Blok düzenleyici betikleri WordPress `wp.i18n` kullanır. Ön yüz modülleri `wp.i18n` bağımlılığı taşımaz.

Yerel biçimler (D5): yönetici önizleme tutarları mağaza ayarından (`wc_price` metne çevrilmiş; JS çipleri `wdp_admin.currency_symbol` + `price_format`); işlem ücreti yüzdesi ondalık ayırıcısı `wc_get_price_decimal_separator()`; `lazy-modal.js` para/dil önbellek anahtarında sabit `TRY`/`tr` yok (boş); `WDP_Progress_Currency::get_base_currency()` ve sepet verisi para birimi yedeği boş. Elementor arama anahtar sözcükleri `_x('…', 'elementor widget search keyword', …)` ile çevrilebilir (`languages/parts/D5.po`); altın 2 çıkarıcısı bu çağrıları çevirir. Tarih biçimi: sabit biçim yok (taramada 0). RTL: `npm run e2e:rtl` yerelde 34/34.

---


## Doğrulama notu (12.0.0)

Bu belgenin a-h bölümleri 12.0.0 kaynağından yeniden yazıldı: dizin yapısı `git ls-files`/`ls` ile, kancalar `grep -rn "add_action\|add_filter" src includes woo-donation-popup.php` ile, REST uçları `grep -rn register_rest_route src` ile, filtre/eylemler `grep -rn "apply_filters\|do_action" src` ile doğrulandı. DOĞRULANMADI işaretli noktalar ve bölüm k tablosu açık işlerdir. Aşağıdaki Faz 7 ve öncesi bölümler tarihsel kayıttır.

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


> **Tarihsel kayıt: 12.0.0'da eski motor kaldırıldı.** Aşağıdaki bölümler (6-C, F6G, 7A, K5/K6/K1/K4, E0-E8, K2/K3/K7...) Faz 6-7 sürecinin kaydıdır. `engine=legacy|new`, `admin.ui`, "eski motorun yanında", `includes/` sınıf adları, `wdp_ajax`/`WDPApp`/admin-ajax uçları ve eski bundle/stack anlatımları ARTIK GEÇERSİZDİR; geçerli durum a-h bölümleri ve "12.0.0 entegrasyon kararları"dır. Kısa doğruluk notları ilgili başlıkların altına eklendi.

## 6-C: "sadaka" -> "addon" iç adlandırma (10.35.2)

- Araç: `tools/rector/rename-map.json` + `WDP_RECTOR_RENAME=1 php vendor-dev/bin/rector process` (yöntem adları), tek seferlik betikle sınıf/dosya/JS/CSS/test adları; "protect" listesi (istek/dizi anahtarları, kanca adları, DOM sınıf/öznitelikleri, betik handle'ları, sepet öğe anahtarları `wdp_sadaka_donation`/`wdp_sadaka_linked_wc_product`, `-sadaka` benzersiz anahtar eki, `wdp_sadaka_visibility_cache_cleared`) DEĞİŞMEDİ.
- Kalıcı ürün meta anahtarları yeni adlara taşındı: `_enable_addon_donation`, `_addon_toggle_label`, `_addon_wc_product_id`, `_addon_min_price`, `_addon_fixed_price`, `_addon_donation_message`. Göç `WDP_Migrations::step_10_35_2` (sürüm kapılı, idempotent; yalnız yeni anahtarı olmayan ürüne kopyalar; eski anahtar silinmez). Okuma: `WDP_Addon_Product_Visibility::get_meta()` önce yeni, yoksa eski (`LEGACY_META`). Meta sorguları OR ile iki anahtarı da tarar; `delete` iki anahtarı da siler; uninstall eski anahtarları da temizler.
- Sipariş öğe meta anahtarlarında "sadaka" yoktu (değişiklik yok). Kısa kodlar, öznitelikleri, blok/Elementor adları, kanca adları değişmedi; kanıt: `tests/unit/CompatibilityContractTest.php`, göç: `tests/unit/AddonMetaMigrationTest.php`.

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
- Yükleme: **pakete gömülü otomatik yükleyici** (`src/Core/class-autoloader.php`: `DonationPanel\Foo\Bar_Baz` -> `src/Foo/class-bar-baz.php`, çağrıda `is_file` taraması; opcache ile ucuz). Composer classmap KULLANILMAZ (belge eskiden yanlış söylüyordu). `mb_*` işlevleri WordPress `compat.php` polyfill'iyle her zaman tanımlıdır (kırpma sessizce atlanmaz).
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


## E2A: Form deneyimleri modülü (tarihsel; 12.0.0'da tek deneyim)

> 12.0.0: `experiences.engine` ve `Settings::engine_is_new()` kaldırıldı; modül koşulsuz açık. Aşağıdaki "legacy/new" ifadeleri tarihseldir.

- **Anahtar:** `donation_panel_settings.experiences.engine` = `legacy` (varsayılan) | `new` (`Settings::engine_is_new()`). `Plugin::register_modules` `experiences` modülünü metin sınıf adıyla kaydeder; `legacy` iken `src/Modules/Experiences/` altındaki hiçbir dosya yüklenmez (PHPUnit: `E2AEngineSwitchTest`, ayrı süreçte). Eski motor, kısa kodlar, AJAX uçları ve e2e/golden DEĞİŞMEDİ.
- **PHP (`src/Modules/Experiences/`):** `Experiences_Module` (kısa kod `donation_panel_experience`, REST kaydı, tembel varlık), `Form_Context` (eski ürün bağlamından kişi verisiz form modeli), `Form_Renderer` (tek çekirdek `form.php` + kap şablonu), `Experience_Container` + `Popup`, `Side_Panel`, `Inline_Form`, `Bottom_Sheet` (yalnız kap işaretlemesi/şablon adı), `Field_Validator` (tutar ayrıştırma, alan kuralları; çok baytlı güvenli), `Form_Controller` (REST).
- **Şablonlar:** `templates/donation-panel/experiences/{form,popup,side-panel,inline,bottom-sheet}.php`; `Template_Loader` ile tema geçersiz kılabilir.
- **Ön yüz (`assets/src/experiences/`):** `store.mjs` (saf durum makinesi, birim testli), `layer.mjs` (aç/kapa, açık yönetilen odak tuzağı, Esc, kaydırma kilidi, sürükleyerek kapatma, `visualViewport` klavye uyumu, `data-dp-presented`: ≤639 px popup/yan panel -> `sheet`), `form.mjs` (tutar çipleri `radiogroup`, doğrulama REST, sepete ekleme şimdilik mevcut `wdp_ajax_add_to_cart`), `base.css` (`design/tokens.css` + `design/components.css` türetmesi, `--dp-*`, mantıksal CSS/RTL, `prefers-reduced-motion`, tema özel seçici yok). jQuery yok. Bağımsız modern JS (`.mjs`; paket `commonjs` olduğu için webpack ESM olarak okusun diye); Interactivity API E2B+ değerlendirmesi.
- **Derleme:** `npm run build:modules` (`scripts/build-modules.mjs`: `assets/src/<modül>/index.(m)js` -> `assets/build/<modül>/index.js|css`); `npm run build` artık bunu da çağırır. `assets/src` pakete girmez, `assets/build` girer. Varlıklar yalnız `[donation_panel_experience]` çizilen sayfada kuyruğa alınır.
- **Bütçe:** JS ~3,5 KB gz (hedef ≤25), CSS ~4,9 KB gz (hedef ≤8); test `tests/unit/js/experiences-store.test.mjs`.
- **e2e:** `npm run e2e:experiences` (yalnız yerel, port `WDP_LOCAL_E2E_PORT`, varsayılan 8911): 4 kap x iPhone (WebKit) / Android / masaüstü, açılır-kapanır, odak tuzağı, >=44 px, axe WCAG 2.2 AA, RTL, Türkçe karakterli sepete gönderim, legacy motorda yeni varlık yok. Yardımcı mu-plugin: `tests/e2e/helpers/wdp-exp-sim.php`.
- **Bilinen sınırlar:** (Store API köprüsü E2B'de eklendi), tek adım form (tutar+bilgiler), `wp.i18n` yerine sunucudan veri özniteliğiyle iletiler, hissedar (çok hisse) alanları yok.

## E2B: Sepet köprüsü, Store API uzantısı, sipariş meta (tarihsel; 12.0.0'da koşulsuz)

> 12.0.0: eski `class-cart.php` `Cart_Hooks`'a taşındı; `donation_modal` POST yolu ve `wdp_ajax_flow` bayrak köprüsü yok, REST `/cart/add` tek yol (`Cart_Hooks::run_in_plugin_flow`).

- **Sınıflar (`src/WooCommerce/`):** `Cart_Data` (saf: form girdisi -> eski `donation_data`/`custom_price`/`unique_key` sözleşmesi; yalnız modelde açık alanlar; çok baytlı güvenli kırpma; kişi verisiz özet), `Cart` (`add_item()`: Field_Validator + eski sunucu kuralları `WDP_Campaign_Goal`/`WDP_Cart::get_donation_amount_error` -> `WC_Cart::add_to_cart`; Store API uç verisi + `/cart/extensions` güncelleme), `Donation_Order_Meta` (`woocommerce_checkout_create_order_line_item`; eski `WDP_Order` yazıcısının yerini `init` 99'da alır, çift yazım yok; `WDP_Order_Meta_Keys::build_item_meta` ile ESKİ anahtarlar birebir; anonim veriyi silmez/maskelemez; yalnız sipariş kalemi API'si = HPOS uyumlu, doğrudan postmeta yok).
- **REST (`Cart_Controller`):** `POST /cart/add` (JSON zorunlu = çapraz site form gönderimi yok), `GET /nonce` (`no-store`; oturum çerezinden kullanıcı). Tarayıcı `form.mjs` doğrulamayı ve eklemeyi tek istekte yapar; 403'te nonce'u tazeleyip bir kez yeniden dener; `submission_key` çift eklemeyi önler. `/validate` ucu duruyor (canlı alan doğrulaması için).
- **Eski doğrulama köprüsü:** `class-cart.php` (dokunulmadı) `$_POST['action']=wdp_ajax_add_to_cart` + `wdp_ajax_flow=1` bayrağını arar; `Cart::with_plugin_flow` bunu yalnız `add_to_cart` süresince kurar, sonra `$_POST`'u geri yükler.
- **Fiyat/çoklu para birimi:** sepete yalnız `custom_price` yazılır; uygulama/dönüşüm mevcut `woocommerce_before_calculate_totals` yolundadır (Curcy3 alanı; bu sınıf dönüştürmez).
- **Kapsam dışı (bilerek):** doğrudan `wc/store/v1/cart/add-item` ile bağış ürünü ekleme (eski kural reddetmeye devam eder; desteklenen yol `/cart/add`), hissedar/işlem ücreti/ek bağış satırları, bağış türünün sipariş metasına yazımı (tür filtresi varsayılan boş), sipariş düzeyi yeni meta anahtarı.
- **Testler:** PHPUnit `CartTest`, `CartControllerTest`, `DonationOrderMetaTest` (29); e2e `tests/e2e/specs/experiences-cart.spec.mjs` (`npm run e2e:experiences -- --spec experiences-cart [--checkout blocks]`, yerel): 3 cihazda tutar->sepet->ödeme + Store API sepet doğrulaması, anonim ve girişli bayat nonce, REST hata biçimi, HPOS siparişi (klasik + blok ödeme) meta kontrolü, legacy'de uçlar yok.

## E4: Yan sepet modülü (`side_cart`, `src/Modules/SideCart/`)

- **Ne:** bağışlar için sepet çekmecesi; dar ekranda (≤ 639 px) alttan panel (tutamaç + sürükleyerek kapatma), geniş ekranda yan panel (RTL'de ters yön). İsteğe bağlı: `modules.side_cart`, **varsayılan KAPALI**; kapalıyken `Side_Cart_Module` dosyası yüklenmez (kayıt: `Plugin::register_modules`, yalnız metin sınıf adı). Eski motor (`engine=legacy`) ile de çalışır (motordan bağımsız).
- **Dosyalar:** `Side_Cart_Module` (kancalar), `Side_Cart_Lines` (sepet öğesi -> satır modeli; ithaf, hissedar adları, tür, miktar kuralı; fiyatlar WooCommerce'in `woocommerce_cart_item_price` / `_subtotal` filtreleriyle = mini sepetle aynı, çoklu para birimi eklentileri bunlara bağlanır), `Side_Cart_Renderer` (sunucuda çizilen gövde/tetikleyici/kabuk; tüm metinler çevrilebilir, tutarlar `wc_price`), `Side_Cart_Controller` (`GET donation-panel/v1/side-cart`: `{count, subtotal, html}`, `no-store`, 600/dk hız sınırı). Ön yüz: `assets/src/side-cart/` (`index.mjs` davranış, `logic.mjs` saf mantık, `side-cart.css`; jQuery yok) -> `assets/build/side-cart/`.
- **Veri akışı:** ilk çıktı `wp_footer`'da sunucuda çizilir; kaldır/miktar = WooCommerce Store API (`cart/remove-item`, `cart/update-item`, `Nonce` başlığı GET `cart` yanıtından, 403'te bir kez tazelenir); her işlemden sonra gövde `GET /side-cart` ile yeniden çizilir (eski yanıt yeni yanıtı ezmez: sıra sayacı). Hisse (hissedar) bağışında miktar değişmez, yalnız kaldırılır.
- **Tetikleyici ve açılış:** kısa kod `[donation_panel_side_cart]` (sepet simgesi + sayaç, 44 px). Sayaç WooCommerce `woocommerce_add_to_cart_fragments` ile (`span.donation-panel-sc__count`) ve sayfa önbelleğine karşı yüklemede REST ile tazelenir. Otomatik açılış olayları: `wc-blocks_added_to_cart` (blok), `added_to_cart` (klasik; yalnız jQuery varsa), `donation-panel:cart-added` (eklentinin kendi olayı). Temaya/oluşturucuya özel kod yok.
- **Yükleme kapsamı:** varlıklar yalnız ön yüzde ve sepet/ödeme sayfaları HARİÇ yüklenir (`donation_panel_side_cart_load` filtresiyle değiştirilebilir). Woo mini sepeti/blok sepetiyle çakışmaz (kendi kök sınıfı `donation-panel-sc`, kendi olay adları).
- **Erişilebilirlik:** `role="dialog" aria-modal`, odak tuzağı (açık Tab yönetimi), Esc, odak tetikleyiciye döner (WebKit düğmeye odak vermediği için tıklanan öğe saklanır), tüm hedefler ≥ 44 px, güvenli alan, `aria-live`/`aria-busy`, `prefers-reduced-motion`, koyu mod.
- **Bilinen sınır / sonraki adım:** yeni motorun formu başarıda ödeme sayfasına yönlendirdiği için çekmeceyi kendisi açmaz; formun `donation-panel:cart-added` olayını göndermesi E2 alanında küçük bir eklemedir (bu görevde Experiences'a dokunulmadı).
- **Testler:** PHPUnit `SideCartTest` (9), JS `tests/unit/js/side-cart-logic.test.mjs` (5); e2e `npm run e2e:side-cart [-- --project iphone]` (yerel; `tests/e2e/run-side-cart.mjs` + `helpers/wdp-sc-sim.php` + `specs/side-cart.spec.mjs`): yeni + eski motor × iPhone/Android/masaüstü — boş durum/Esc/odak, ekleme sonrası açılış (ithaf + hissedar adları, Türkçe), miktar/kaldır (Store API ile eşleşme), yerleşim + RTL, odak tuzağı + dokunma boyutu, axe WCAG 2.2 AA, REST ekleme yolu (39 test). Çeviri: `languages/parts/E4.po`.

## E3: Kampanya, etki ifadeleri, sosyal kanıt (üç ayrı modül; tek ön yüz paketi)

- **Modüller (`src/Modules/`):** `Campaign` (slug `campaign`, varsayılan AÇIK), `Impact` (`impact`, 12.0.0'da varsayılan AÇIK), `SocialProof` (`social_proof`, varsayılan KAPALI; K3). Üçü de `Module_Registry` ile ayar/filtre ile açılıp kapanır; kapalıyken `*-module.php` ve yardımcı sınıfları yüklenmez (test: `CampaignModulesTest::test_disabled_modules_load_no_files`). Kayıt: `Plugin::register_modules` içinde ardışık üç satır.
- **Veri kaynağı (dokunulmadı, yalnız okuma):** `WDP_Campaign_Goal` (hedef/toplam/ulaşıldı), `WDP_Utils::get_donor_count` / `get_progress_paid_statuses` / `compute_order_progress_amounts`, `WDP_Progress_Currency::from_store_amount` (toplamlar ana birimde; gösterim değeri yalnız `donation_panel_convert_amount` filtresiyle çevrilir, varsayılan dönüşüm yok). Eski ilerleme çubuğu (`wdp-progress-bar-*`) ve mevcut kısa kod/öznitelikler DEĞİŞMEDİ.
- **Campaign:** `Progress_Data` (saf `build()` + 30 sn geçici önbellek, para birimi başına), `Milestones` (ürün meta `_donation_panel_milestones`, satır `yüzde=etiket`, en çok 6), `Progress_Renderer` (SSR kart; `role=progressbar`), `Progress_Controller` (`GET /donation-panel/v1/progress/{id}`: salt okunur, herkese açık, hız sınırlı, `Cache-Control`; kampanya yoksa 404; gövdede kişi verisi yok). Yeni kısa kod: `[donation_panel_progress id="" milestones="yes" donors="yes"]` (`id` yoksa bulunduğu ürün).
- **Impact:** `Impact_Map` (ürün meta `_donation_panel_impact` ya da site ayarı `impact.map` [Settings şemasına `text` tipi eklendi]; satır `birim=tekil|çoğul`, `{count}` adet; en yakın alt kademe, adet = tam bölüm), `Impact_Module::filter_model` (`donation_panel_form_model` ile `model['impact']` ekler; Experiences dosyalarına dokunulmaz), `GET /donation-panel/v1/impact/{id}`. Ön yüz formu zenginleştirir: tutar çiplerinin altında `£40 = 1 food parcel` (yazılan tutarda da canlı).
- **SocialProof (K3):** `Donation_Feed` — ad HİÇBİR koşulda gösterilmez (12-fix2 #21: `wdp_public_name` rızası okunmaz; `name` anahtarı biçim sabit kalsın diye vardır ve boştur; ön yüz "A kind donor" yazar); yalnız tutar ve zaman döner. Yanıt anahtarları sabit: ad, tutar, etiket, tarih, göreli zaman (e-posta/telefon/not/ithaf yok; `donation_panel_social_proof_entry` filtresiyle değiştirilebilir ama kişi verisi eklenmemeli). `GET /donations` (sayfalı, `per_page` ≤ 20, en çok 250 sipariş taranır) ve `GET /donations/stats` (bağışçı, bugün, toplanan; 5 dk önbellek). Kısa kod `[donation_panel_social_proof id="" variant="line|counters|feed" per_page="5"]`. Bağışçıya ad izni sorusu Faz 7 form tasarımına bağlıdır; o zamana dek hiçbir ad görünmez (güvenli varsayılan).
- **Ön yüz (`assets/src/campaign/`):** tek paket `assets/build/campaign/index.js|css` (gz toplam ~6,4 KB; bütçe 25 KB). `progress.mjs` (görününce dolma, sayaç, taze veri), `impact.mjs`, `social.mjs` (yalnız metin düğümleri), `format.mjs` (saf, `campaign-format.test.mjs`), `rest.mjs` (`link rel=api.w.org`). Yalnız ilgili çıktı varken kuyruğa girer; RTL (mantıksal özellikler + `-rtl.css`), `prefers-reduced-motion`, koyu mod (`--dp-*` belirteçleri).
- **Çeviri:** `languages/parts/E3.po`. **Testler:** PHPUnit `tests/unit/E3/CampaignModulesTest.php`, JS `tests/unit/js/campaign-format.test.mjs`, e2e `npm run e2e:campaign` (yerel WP; `tests/e2e/specs/campaign.spec.mjs` + `helpers/wdp-campaign-sim.php`; 7 senaryo x iPhone/Android/masaüstü, axe WCAG 2.2 AA, RTL, azaltılmış hareket, REST gizlilik; port `WDP_LOCAL_E2E_PORT`, varsayılan 8923).
- **Bilerek yapılmadı:** kayan bildirim (tasarım C; kişi kaygısı), yönetici ürün alanları (ara hedef/etki metası için UI Faz 7 yönetici ekranı), blok.

## E2D: Para birimi doğruluğu (yeni + eski sepet yolu)
- Sepet satırı: `Cart::add_item()` yazılan tutarlı satıra `wdp_input_currency` (etkin birim) damgalar; `WDP_Cart::apply_custom_price_to_cart` fiyatı `WDP_Progress_Currency::to_store_amount()` ile ana birime çevirir, gösterim `from_store_amount()`; dönüşüm kaynağı yalnız `donation_panel_convert_amount` (varsayılan: dönüşüm yok).
- `$_POST` bayrağı kalktı: `WDP_Cart::run_in_plugin_flow( callable )` derinlik sayacı açar; `is_ajax_add_to_cart_flow()` bunu da sayar. `$_POST` değişmez.
- Minimum bağış: `WDP_Cart::get_donation_amount_error( $amount, $min_meta, $id, $plain, $input_currency = '' )` yazılan tutarı (boşsa etkin birim) ana birime çevirip ürün minimumuyla kıyaslar; ileti minimumu yazılan birimde gösterir (`amount_to_store_currency` / `amount_from_store_currency`). `Field_Validator` (yeni motor) aynı kuralı uygular.
- Sipariş kalemi: `_wdp_input_currency` (`_custom_price`'ın birimi; yalnız damgalı satır). `compute_order_progress_amounts` `_custom_price` satırını bu birimden ana birime çevirir (ödemeden önce para birimi değiştirilse bile kampanya toplamı doğru); damgasız eski satırlar sipariş birimiyle (davranış aynı).

## E6: Teşekkür/kutlama (`thanks`) + vergi indirimi beyanı (`tax_relief`)
- **Modüller:** ikisi de VARSAYILAN KAPALI (`modules.thanks`, `modules.tax_relief`); kapalıyken dosyaları yüklenmez (`ThanksAndTaxReliefTest::test_disabled_modules_load_no_files`). Kayıt: `Plugin::register_modules`. Ayar grupları (Settings şeması): `thanks.{celebrate,share,message}`, `tax_relief.{step_label,title,text,checkbox_label}` (boşsa genel, çevrilebilir varsayılan; ülke/ad varsayımı yok). Yönetici ekranı alanı Faz 7 yönetici ekranı işi (şimdilik `Settings::update` / filtre).
- **Thanks (`src/Modules/Thanks`):** `Thanks_Module` WooCommerce standart `woocommerce_before_thankyou` (öncelik 5) kancasına çıktı ekler; sayfa/menü oluşturmaz, Woo'nun sipariş anahtarı doğrulamasına güvenir; `failed/cancelled` siparişte ve bağış satırı olmayan siparişte hiçbir şey basmaz. `Thanks_Summary::build()` (saf) yalnız `product_id, project, amount` + toplam + para birimi üretir; KİŞİ BİLGİSİ yok (testle sabit). Bağış satırı = `_custom_price` metası ya da `WDP_Donation_Scope`. Tutar `wc_price(…, currency=sipariş birimi)`. Etki ifadesi: Impact modülü açıksa, tek bağış satırında ve sipariş birimi mağaza birimiyse `Impact_Map` YALNIZ okunur. Şablon `donation-panel/thanks/summary.php` (tema geçersiz kılar). Paylaşım: Web Share API, yoksa bağlantıyı kopyalar (metin yalnız proje adı; `data-*` ile çeviri, JS `wp.i18n` gerekmez); "Tekrar bağış" = ürün bağlantısı.
- **Kutlama:** halka + onay işareti CSS ile çizilir; 26 parçalık sade konfeti 4,5 sn sonra silinir; `prefers-reduced-motion` altında JS konfeti hiç oluşturmaz, CSS animasyonları kapalı ve işaret tam görünür. Paket `assets/build/thanks/` (`assets/src/thanks/`: `index.mjs`, `logic.mjs` saf+birim testli, `thanks.css`); yalnız teşekkür özeti basılan sayfada kuyruğa alınır.
- **TaxRelief (`src/Modules/TaxRelief`):** Experiences dosyalarına dokunmaz: `donation_panel_form_steps` ile `tax_relief` adımı eklenir, içerik `donation_panel_form_step_tax_relief` ile `templates/donation-panel/tax-relief/step.php`'den basılır (önceden işaretli OLMAYAN, zorunlu OLMAYAN onay kutusu `donation_tax_relief`). Bayrak aktarımı: `rest_request_before_callbacks` yalnız `/donation-panel/v1/cart/add` isteğinde kutu değerini bellekte tutar → `woocommerce_add_cart_item_data` sepet öğesine `donation_panel_tax_relief` koyar (tek kullanımlık) → `woocommerce_checkout_create_order_line_item` (klasik + blok ödeme aynı kanca) sipariş KALEMİNE ve SİPARİŞE `_wdp_tax_relief_declared=yes` ve `_wdp_tax_relief_text_hash` (beyan metninin normalize SHA-256'sı) yazar; yalnız WooCommerce nesne API'si (HPOS). Sepet/ödeme satırında "Tax relief declaration: Yes" (`woocommerce_get_item_data`), sipariş ekranında `woocommerce_admin_order_data_after_billing_address` satırı. Bağışçı alanları (ad, ithaf, telefon…) hiç değiştirilmez/maskelenmez. Ad/adres/posta kodu AYRI toplanmaz: WooCommerce ödeme sayfasındaki fatura bilgisi kullanılır (mükerrer veri ve KVKK/GDPR yükü yok).
- **Bağımlılık:** adım kancası `donation_panel_form_steps`/`donation_panel_form_step_{id}` E2C'de (dal `f7-e2c`); bu dal E2C birleşmeden o kancayı görmez (modül kancayı yalnız ekler, kendi başına zarar vermez).
- **Çeviri:** `languages/parts/E6.po`. **Testler:** PHPUnit `tests/unit/E6/ThanksAndTaxReliefTest.php`, JS `tests/unit/js/thanks-logic.test.mjs`.

## E2C: Bağış türleri + çok adımlı form (tarihsel; `Experiences` içinde, 12.0.0'da koşulsuz)

- **Tür (`Form_Context::kind()`):** eski ürün bayraklarından, eski önceliğle (`WDP_Donation_Type::infer_from_flags` ile aynı): hisseli > hedefli kampanya > bağışçı belirler (serbest tutar) > sabit tutar. Model anahtarları: `kind`, `unit_price`, `quantity{enabled,min,max}`, `cover_fee` (yüzde; ürün ayarından, 0 = kapalı), `addon` (etiket/ileti/sabit/en düşük; kapalıysa `null`), `steps`, `shareholder` (hissedar alan tanımları), `fields` (hisseli türde boş: kişi alanları hissedar satırlarıdır). Hedefli kampanya en düşük tutarı `progress_min_price`'tan alır.
- **Tutar kuralı (`Field_Validator`):** sabit tutar ve hisseli türde tutar SUNUCUDA `birim fiyat x adet` olarak hesaplanır, istemci tutarı yok sayılır (adet 1..max; sabit tutarda adet seçici ürün ayarıyla kapalıysa 1). Serbest/kampanyada yazılan tutar doğrulanır. Hisseli: her hisse için ad+telefon zorunlu, hata anahtarı `shareholder_{n}_{alan}`; ek bağış açıksa tutar (sabit ya da yazılan; en düşük tutar kuralı) doğrulanır (`addon_amount`).
- **Sepet (`Cart::add_item`):** adet = `add_to_cart` miktarı (hisseli: hisse sayısı); işlem ücreti yüzdesi YALNIZ sunucudaki modelden gelir (istemci yüzdesi yok sayılır): serbest türde `custom_price = round(tutar x (1+%), woo ondalık)`, sabit/hisselide `wdp_base_unit_price`; `donation_data.cover_fee/cover_fee_percent`. Hisseli veri eski sözleşmeyle aynı (`share_count`, 1 tabanlı `shareholders[n]{name,phone,email,note}`; `Cart_Data::share_data`). Sepet öğesi ek anahtarları: `donation_panel_kind` (+ `donation_panel_type` = düzenli bağış seçeneği, yalnız modelde tanımlıysa).
- **Ek bağış (`Addon_Line`):** ana satırdan SONRA ayrı sepet satırı; eski sözleşme birebir (`wdp_sadaka_donation`, `wdp_parent_product_id`, `wdp_parent_cart_item_key`, `wdp_sadaka_linked_wc_product`, `donation_data.is_sadaka`). Ek satır eklenemezse ana satır geri alınır (yarım sepet yok).
- **Sipariş meta (`Donation_Order_Meta`):** eski anahtarlar değişmedi; YENİ: `wdp_donation_type` (fixed|custom|shares|campaign; ek bağış satırında yok) ve `wdp_donation_frequency` (varsa). Yönetici ekranında "Donation type/frequency" etiketi ve tür adı gösterilir.
- **Adım akışı (`form.php`, `form.mjs`, `store.mjs`):** tutar -> bilgiler (-> ek adımlar) -> gönder. Adım göstergesi (`.donation-panel-steps`), "Adım n/m · ad" etiketi (`aria-live`), geri düğmesi, her adımda toplam + bilgiler adımında döküm (bağış/işlem ücreti/ek bağış/toplam). Adım başına hızlı istemci denetimi (zorunlu alan, tutar, en düşük tutar); tam doğrulama sunucuda — sunucu önceki adımdaki alanı reddederse o adıma dönülür. Toplam hesabı sunucuyla aynı yuvarlama kuralı (`withFee`/`computeTotals` birim testli). Ek adım (vergi indirimi, E6) kancası: `donation_panel_form_steps` + `donation_panel_form_step_{id}` (varsayılan boş).
- **Düzenli bağış anahtarı** yalnız `donation_panel_frequency_options` doluysa çizilir (değişmedi).
- **Kapsam dışı (bilerek):** vergi indirimi içeriği (E6), etki ifadesi/ilerleme/sosyal kanıt (E2D/E3), hesap alanları, sürekli bağış yürütme (abonelik eklentisi), `includes/class-cart.php` ve `class-progress-currency.php`.
- **Testler:** PHPUnit `DonationKindsAndAddonLineTest` + güncellenen E2A; JS `experiences-types.test.mjs`; e2e `tests/e2e/specs/experiences-types.spec.mjs` (`npm run e2e:experiences -- --spec experiences-types [--checkout blocks]`): 4 tür x 3 cihaz, ücret + ek bağış toplamı/ayrı satır, adım akışı + sunucu hatasında adıma dönüş, düzenli bağış anahtarı, HPOS sipariş (hisseli + ücret/ek bağış; Türkçe karakter). Test altyapısı: `wdp-exp-seed.php` (işaretli test ürününe ücret + ek bağış), `wdp-exp-sim.php` (`?dp_freq=1`, e2e'de hız sınırı sıfırlama).

## E5: Bağışçı Hesabı modülü (`donor_account`, `src/Modules/DonorAccount/`)

- **Ne:** isteğe bağlı (`modules.donor_account`, **varsayılan KAPALI**; kapalıyken dosyaları yüklenmez; kayıt `Plugin::register_modules`). Header kişi simgesi → giriş/kayıt/şifre sıfırlama penceresi (≤ 639 px alttan panel, tutamaç + sürükleyerek kapatma; geniş ekranda ortada), WooCommerce Hesabım içinde **Bağışlarım** (`my-donations`), misafir bağışlarını e-posta doğrulamasıyla hesaba bağlama, ödeme sayfasında hesap oluşturma açıklaması. Tasarım sözleşmesi: `design/account.html`, `design/mydonations.html`.
- **Giriş yolları (global ilke):** kısa kod `[donation_panel_account]`, blok `donation-panel/account` (`block/block.json`, `autoRegister` + PHP render; editör betiği yok). Elementor/Avada/tema özel kod YOK.
- **Dosyalar:** `Donor_Account_Module` (kancalar), `Account_Controller` (REST), `Account_Renderer` (tüm HTML, kaçışlı), `Donation_History` (sipariş → bağış satırı), `Guest_Link_Token` (belirteç). Ön yüz: `assets/src/donor-account/{index.mjs,logic.mjs,donor-account.css}` → `assets/build/donor-account/` (jQuery yok). Çeviri: `languages/parts/E5.po`.
- **Kimlik doğrulama = WP/Woo altyapısı:** giriş `wp_signon`; kayıt `wc_create_new_customer` (WooCommerce ayarı `woocommerce_enable_myaccount_registration` kapalıysa 403); şifre sıfırlama `get_password_reset_key` + `woocommerce_reset_password_notification` (WooCommerce e-postası). Kendi parola/oturum/e-posta kodu yok.
- **Güvenlik:** her yazma ucu `wp_rest` nonce + `Rate_Limiter` (giriş 10/dk, kayıt 6/dk, sıfırlama 5/dk, bağlama isteği 3/10 dk, onay 10/10 dk; `donation_panel_account_rate_limit` süzgeci). **Enumeration yok:** giriş hatası tek iletidir (WordPress hata metni sızdırılmaz); kayıt yanıtı e-posta var/yok için aynıdır (var olan e-postaya hesap açılmaz; istemci kayıttan sonra giriş dener, başarısızsa tek giriş iletisi gösterilir); sıfırlama yanıtı her durumda aynıdır. `GET /account/session` taze nonce verir (önbellekli sayfada bayat nonce olmaz; çerezdeki kullanıcıya göre üretilir, `rest-nonce` admin-ajax eylemiyle aynı yaklaşım). Tüm yanıtlar `no-store, private`. Kişi verisi herkese açık uçta yok; günlüğe yazılmaz.
- **Bağışlarım:** `woocommerce_get_query_vars` + `woocommerce_account_menu_items` + `woocommerce_account_my-donations_endpoint` (uç nokta adı `donation_panel_account_endpoint` süzgeci). Veri yalnız `wc_get_orders(customer_id)` (HPOS uyumlu, sayfalı) + satır düzeyinde `customer_id` doğrulaması; bağış alanları `WDP_Order_Meta_Keys::get_item_donation_data` ile eski (çevrilmiş) ve yeni anahtarlardan. Satır: proje (kalem adı), tür (ürünün ilk kategorisi), durum (`wc_get_order_status_name`), tarih (`wc_format_datetime`), tutar (`wc_price`, siparişin para birimi), ithaf, makbuz (= Woo sipariş görüntüleme bağlantısı), tekrar bağış (yayımlanmış ürün bağlantısı). `GET /donation-panel/v1/account/donations?page=&per_page=` (oturum + nonce).
- **Misafir bağışı bağlama:** `POST /account/link-guest` hesap e-postasına tek kullanımlık, 60 dk süreli bağlantı gönderir (`wp_mail`; `user_meta` `_donation_panel_guest_link` içinde yalnız HMAC karması). Bağlantı Bağışlarım sayfasını açar ve **onay düğmesi** gösterir (GET ile durum değişmez; e-posta tarayıcıları bağlantıyı tüketemez). `POST /account/link-guest/confirm` belirteci doğrular + tüketir; yalnız `customer_id = 0` VE fatura e-postası hesap e-postasıyla eşleşen siparişleri bağlar. Doğrulanmadan hiçbir sipariş bağlanmaz. **Woo çakışma notu:** WooCommerce yeni hesap açılışında (`wc_update_new_customer_past_orders`) aynı e-postalı misafir siparişlerini kendisi bağlar; bu davranış WooCommerce'in standardıdır ve eklenti ona dokunmaz. Eklentinin doğrulamalı yolu, hesabı Woo kaydı dışında (ör. farklı e-postayla açılmış hesap) bağlamak içindir.
- **Ödeme sayfası:** `woocommerce_before_checkout_registration_form` ile WooCommerce'in kayıt kutusunun üstüne açıklama (kutuyu ve ayarını WooCommerce yönetir; blok ödemede eklentinin eklediği bir şey yok).
- **Varlık yükleme:** blok temalarında içerik `wp_enqueue_scripts`'ten ÖNCE çizilir; modül bu durumda kuyruğa almayı kayıttan sonraya erteler (`enqueue()`). Varlıklar yalnız kısa kod/blok çizilen sayfada, Bağışlarım sayfasında ve ödeme sayfasında (kayıt kutusu varken) yüklenir.
- **Gizlilik (Faz 8 için veri alanları):** kullanıcı metası `_donation_panel_guest_link` (karma + bitiş + e-posta; silinmesi/dışa aktarılması gerekir); modül kendi siparişi/kişi tablosu oluşturmaz, sipariş verisi WooCommerce'in gizlilik araçlarına bağlıdır; `donation_panel_guest_orders_linked` eylemi yalnız sayı taşır. Kayıt ve bağlama için yeni çerez yok.
- **Testler:** PHPUnit `DonorAccountModuleTest` (20: belirteç süre/tek kullanım/karma/kullanıcıya bağlı, yalnız kendi siparişleri + eski anahtar, nonce, hız sınırı, enumeration eşitliği, yetki, bağlama kuralları, kaçış, modül kaydı), JS `tests/unit/js/donor-account-logic.test.mjs` (6); e2e `npm run e2e:donor-account [-- --project iphone] --env local` (`tests/e2e/run-donor-account.mjs` + `helpers/wdp-da-sim.php` + `specs/donor-account.spec.mjs`; yerel HPOS siparişleri, e-postalar yakalanır): pencere yerleşimi, odak/Esc, dokunma boyutu, tek tip hata, giriş, kayıt, sıfırlama, Bağışlarım, bağlama (başka kullanıcının bağlantısı dahil), ödeme notu, axe WCAG 2.2 AA.

## E7: Yönetici deneyimi (tarihsel; 12.0.0'da tek yönetici menüsü)

> 12.0.0: `admin.ui`, `Settings::admin_ui_is_new`, `donation_panel_admin_ui` süzgeci ve `DONATION_PANEL_ADMIN_UI` sabiti KALDIRILDI; `src/Admin` her zaman yüklenir (yönetimde ya da `donation-panel/v1/admin` REST isteğinde). Güncel menü/sayfa yapısı docs/AYARLAR.md ve a) bölümü: tek üst menü "Bağış Paneli" + alt sayfalar Genel Bakış, Kampanyalar, Formlar ve Görünüm, Sepet ve Ödeme, Bağışçı Hesabı, Gizlilik, Araçlar, Rehber + gizli sihirbaz `donation-panel-setup`.

- **Strangler anahtarı:** Core ayarı `admin.ui` (`legacy` varsayılan | `new`), `Settings::admin_ui_is_new()`; `donation_panel_admin_ui` süzgeci ve `DONATION_PANEL_ADMIN_UI` sabiti üstüne yazar. `Plugin::on_plugins_loaded` yalnız `is_admin()` VE `new` iken `Admin_Bootstrap::init()` çağırır; aksi halde `src/Admin/*` hiç yüklenmez (PHPUnit `test_legacy_ui_loads_no_admin_file`). Ön yüz ve eski yönetici ekranı etkilenmez. Yeni ekranın içinden "Klasik ekran" seçimiyle geri dönülür (Gelişmiş sekmesi); eski ekrandaki ayarlar/ürün veri sekmesi/`wdp_*` seçenekleri dokunulmadan kalır. Ayar yeni ekrana geçişi şimdilik süzgeç/sabit/seçenekle yapılır (`includes/` bu görevde değişmedi; eski ekrana düğme eklemek ayrı iş).
- **Menü:** WooCommerce altında `donation-panel` (Ayarlar; TR "Bağış Paneli"), `donation-panel-guide` (Rehber), gizli `donation-panel-setup` (sihirbaz; üst öğe `options.php`). Yetki `manage_woocommerce`.
- **Dosyalar:** `Admin_Bootstrap` (menü + kancalar), `Settings_Page` (Settings API: `register_setting` + `settings_fields` + `option_page_capability_donation_panel`; tek `sanitize()`: `_form` işaretli gönderimde işaretsiz onay kutusu = kapalı, enum doğrulama, `Settings::normalize`; modül/şema dışı anahtarlar korunur), `Setup_Wizard` (4 adım; `admin_post_donation_panel_wizard` + nonce + yetki; `apply()` amaç→modül varsayılanı; ürün OLUŞTURMAZ, yalnız ürün listesine yönlendirir), `Guide` (sayfa + WP yardım sekmeleri; bölümler tek kaynak `Guide::sections()`), `Admin_Assets` (kendi ekran kancası dışında hiçbir varlık), `Admin_View` (kaçışlı satır/anahtar/seçim yardımcıları).
- **Ayarlar (yalnız Core ayarına yazar):** `modules.{campaign,impact,social_proof,thanks,tax_relief,donor_account,side_cart}`, `experiences.engine`, `admin.ui`, `admin.wizard` (`''|done|skipped`), `general.delete_data_on_uninstall`, `thanks.*`, `tax_relief.*`, `impact.map`. Para birimi bağdaştırıcısı: yalnız durum rozeti (`has_filter('donation_panel_convert_amount')`) + rehber notu.
- **Varlıklar:** `src/Admin/assets/admin.{css,js}` (derleme yok; jQuery yok; WP yönetici renk şeması `--wp-admin-theme-color`; mantıksal özellikler = RTL; reduced-motion; yapışkan kaydet çubuğu + `scroll-margin`). Yalnız kendi 3 ekranında yüklenir (Y6).
- **Sihirbaz amaç → modül:** `simple` (thanks açık; campaign/impact/donor_account kapalı), `campaign` (campaign+impact+thanks), `regular` (campaign+thanks+donor_account). Yeni form yalnız açık onayla. Atlama (`skipped`) hiçbir modülü değiştirmez.
- **Testler:** PHPUnit `tests/unit/Admin/E7AdminTest.php` (23: anahtar varsayılanı/filtre, legacy iken dosya yüklenmez, menü yetkisi + gizli sihirbaz, varlık kapsamı, sanitize [işaretsiz=kapalı, enum, Türkçe, yetkisiz], kalıcılık, render kaçışı, sihirbaz apply, rehber); e2e `npm run e2e:admin-e7 [-- --project iphone]` (`run-admin-e7.mjs` + `helpers/wdp-admin-sim.php` + `specs/admin-e7.spec.mjs`; yerel WP; oturum yalnız yerel test ucu): klavyeyle sekme, önizleme, kaydet/yükle + Türkçe + eski `wdp_*` karması değişmez + ürün sayısı değişmez, klasik ekrana dönüş, varsayılan eski ekran, varlık kapsamı, sihirbaz (bitir/atla), rehber + yardım sekmeleri, yetki/nonce (abone 403, nonce'suz yazma yok), axe WCAG 2.2 AA (her sekme, sihirbaz, rehber, RTL), mobil dokunma hedefi/taşma.
- **Ürün veri sekmesi (madde 4):** değişmedi; yeni ayarlarla çelişen yer bulunmadı (yeni ekran yalnız Core ayarına yazar, ürün meta anahtarları ayrı).
- **Çeviri:** `languages/parts/E7.po` (126 msgid + 1 çoğul; mevcut "Copy/Back/Continue/Goal/Donate/Advanced/Social proof/Tax relief declaration/You do not have permission to do this." çevirileri yeniden kullanıldı).


## E8A: Önizleme, varsayılan geçişi, geriye dönük toplam komutu

> 12.0.0: "varsayılan geçişi" (yeni kurulumda `engine=new`/`admin.ui=new`, yükseltmede `wdp_upgrade_new_default`) ortadan kalktı; yalnız Önizleme (`?dp_preview=1`) ve toplam komutu geçerlidir.
- **Önizleme** (`src/Modules/Preview/class-preview.php`): `?dp_preview=1`, yalnız oturumu açık + `manage_woocommerce` yetkili kullanıcı için; diğer herkes için etkisiz. `WDP_Plugin_Bootstrap::run` parametre varken sınıfı yükler (yoksa dosya yüklenmez); yetki `plugins_loaded` 1'de denetlenir (modül kaydı 20'den önce). Açıkken `Settings::set_preview(true)` bellekte tüm modülleri ve `engine_is_new()`'ü açar (ayar YAZILMAZ); yanıta `nocache_headers` + `DONOTCACHEPAGE`; yönetici çubuğunda "çık" bağlantısı. Salt okunur görünüm: REST uçları önizleme dışında normal kurallarla kayıtlı olduğundan gönderim önizlemede çalışmaz. Bağlantı biçimi: `<sayfa adresi>?dp_preview=1` (`Preview::link_for`).
- **Varsayılan geçişi** (`Settings`): yeni kurulum (etkinleştirmede, `donation_panel_settings` ve `wdp_version`/`wdp_cache_version` yok) `Settings::seed_fresh_install()` ile (12.0.0'da yalnız varsayılan şema kaydını; eskiden `experiences.engine=new` + `admin.ui=new`) yazar; mevcut kurulumda hiçbir şey yazılmaz (idempotent). `wdp_upgrade_new_default` seçeneği (varsayılan KAPALI; `donation_panel_upgrade_new_default` filtresi) açılırsa motor/ekran seçimi hiç kaydedilmemiş kurulumlar yeni deneyime geçer; açık kayıt ("eski deneyime dön") her zaman kazanır.
- **`wp donation-panel recalc-totals [--product=ID|--all] [--dry-run]`** (`src/Cli/`, yalnız `WP_CLI` varken kaydolur): `WDP_Utils::recalculate_product_donation_totals()` tek sipariş taramasıyla çok ürünü hesaplar (`$dry_run` iken ürün meta, sipariş bayrağı, uyarı listesi, günlük YAZILMAZ). Uygulamada yalnız farklı çıkan ürünler yazılır; sipariş içeriği değişmez, yalnız eklentinin `_wdp_progress_*` sayım bayrakları (çift sayımı önler). Döviz kuru bulunamayan sipariş satırı toplama katılmaz, uyarı olarak sayılır.


## E8D: Gizlilik araçları, wdp_vid, render_modal nonce (Faz 8)

> 12.0.0: `wdp_render_modal` AJAX ucu, `wdp_render_modal_require_nonce` süzgeci ve `GET /modal` kaldırıldı; aşağıdaki modal/nonce anlatımı tarihseldir. Gizlilik araçları (`Order_Privacy`, `Privacy_Tools`) ve `wdp_vid` kaldırması geçerlidir.

- **Gizlilik:** `WDP_Privacy` (`includes/class-privacy.php`) sipariş kalemi verisini dışa aktarır/anonimleştirir (sayfa 50; telefon eşleşmesi; "tutulan" mesajı). `DonationPanel\Privacy\Privacy_Tools` (`src/Privacy/`) hesap bağlama kaydı için dışa aktarıcı/silici, `wp_add_privacy_policy_content` önerisi (yalnız `admin_init`) ve eski çerez temizliğini yapar; `WDP_Privacy::init` içinden her zaman yüklenir (modül ayarından bağımsız). Envanter: `docs/PRIVACY.md`.
- **wdp_vid:** kaldırıldı (gerekçe PRIVACY.md). `WDP_Security::get_visitor_id/mint/parse` silindi; `get_rate_limit_key($a, $use_visitor_token)` imzası korunur (parametre artık yok sayılır), okuma uçlarında yalnız IP katmanı (`READ_IP_RATE_LIMIT`) eklenir.
- **wdp_render_modal:** AJAX artık nonce ister (`wdp_render_modal`; süzgeç `wdp_render_modal_require_nonce`, varsayılan true). Başarısızlık HTTP 403 + `code: nonce`; istemci (`assets/js/src/lazy-modal.js`) yeni nonce alıp bir kez yeniden dener (değişmedi). Önbellek dostu nonce'suz yol: `GET /wp-json/donation-panel/v1/modal?product_id=&mode=` (`src/Http/Rest/class-modal-controller.php`; herkese açık, salt okunur, 60/dk, `no-store`); `WDP_Lazy_Modal::build()` ortak üretici. Denetleyici `donation_panel_rest_controllers` süzgeciyle eklenir.

> 12.0.0 notu: `wdp-quality-sim.php` durum dosyasındaki `engine` ve `admin-screens.mjs` `--ui new|legacy` bayrakları test altyapısı kalıntısı olabilir (motor/ekran seçimi kodda yok; DOĞRULANMADI, test yardımcıları ayrı temizlenecek).

## E8B: Kalite kapıları koşucusu (yalnız yerel; `npm run e2e:quality` — betik Claude tarafından eklenecek: `e2e:quality=node tests/e2e/run-quality.mjs`)

- **Ne ölçer:** `tests/e2e/run-quality.mjs` her yapılandırma için yerel WP işçisi kurar (4 tema × 4 para birimi × blok/klasik ödeme × HPOS açık/kapalı; `helpers/quality-env.mjs` `qualityConfigs()`: tt5/TRY/blok/HPOS, storefront/GBP/klasik/HPOS, blocksy/EUR/blok/HPOS yok, tt4/USD/klasik/HPOS yok) ve sırayla: (a) `specs/quality-gates.spec.mjs` 3 cihazda (iPhone WebKit, Android Chromium, masaüstü) — axe WCAG 2.2 AA (`wcag2a/aa/21a/21aa/22aa`; ürün sayfası, popup, yan panel, yeni motor popup/yan panel/alttan panel/satır içi form/kampanya/sosyal kanıt, hesap popup'ı, yan sepet, teşekkür), akış (sepet → ödeme → sipariş; kayıt tutarı/para birimi/HPOS/Türkçe ithaf), para birimi biçimi, `dir=rtl` taşma; (b) `helpers/quality-lighthouse.mjs` — Lighthouse mobil, simüle yavaş 4G, sayfa başına 3 koşu medyan, her koşu öncesi HTTP önbelleği temizlenir (çerez/sepet korunur), `?dp_q_off=1` ile eklenti pasif KONTROL ölçümü (eşik: perf ≥ 90, erişilebilirlik ≥ 95; kontrol de eşiğin altında ve eklenti kaynaklı kayıp ≤ 3 puan ise "ortam-sinirli"); (c) `helpers/quality-budget.mjs` — sayfa türü (ürün, mağaza, ödeme, yalnız-kısa-kod) başına eklenti JS/CSS gzip toplamı ve modüller kapalıyken modül adlı varlık yüklenmediği (bütçe JS ≤ 60 KB, CSS ≤ 30 KB).
- **Yerel altyapı:** `helpers/wdp-quality-sim.php` (mu-plugin; yalnız geçici yerel işçiye kopyalanır): durum dosyası `wp-content/wdp-quality-state.json` (`engine`, `modules`: `all|none|default|[slug,…]`), sepet ucu `?dp_q_add`, sipariş ucu `?dp_q_order`, test sayfaları `?dp_q_test=kit|shortcode`, `?dp_q_off=1` (eklenti pasif), `?dp_q_strip=css|js|side` (teşhis). `helpers/gzip-proxy.mjs`: PHP yerleşik sunucusu sıkıştırmadığı için Lighthouse yalnız yerel gzip vekili (varsayılan port = işçi portu + 500) üzerinden ölçer. Portlar: `WDP_Q_PORT` (8942), `WDP_Q_PROXY_PORT`, `WDP_Q_LH_PORT` (9422).
- **Çıktı:** `build/quality/ozet.json`, `ozet.md` (`helpers/quality-md.mjs`), `results.jsonl`. Bağımlılık notu: `lighthouse` ve `@axe-core/playwright` dev bağımlılığı olarak eklenmeli (worktree'de `npm install --no-save` ile kuruldu; `package.json` bu parçada değişmedi).
- **Düzeltmeler (eklenti):** CSS paket küçültmesi hiç çalışmıyordu (`tools/build-css-bundle.php`: uzantısız geçici dosya → esbuild hatası → sessiz geri dönüş; artık `.css` uzantılı, `@layer` güvenlik denetimi yorum satırını saymaz): paket 313 885 → 267 979 bayt (gzip 42,7 → 33,3 KB). Erişilebilirlik: telefon ülke kodu düğmesi (`aria-label` yerine görünür metni içeren gizli metin; WCAG 2.5.3), yan sepet tetikleyicisi (aynı), `quantity` ve `share_count` girişlerine ad.

## Worktree hazırlama (`npm run wt:prepare`)
- `npm run wt:prepare -- <worktree> [--dry-run] [--force] [--skip-install]`: yeni git worktree'yi tek komutla koşuya hazırlar (`scripts/wt-prepare.mjs`, Node fs; kabuk cp/tar yok, sembolik bağ yok).
- Hedef `git worktree list`te kayıtlı olmalı; ana klasör ya da başka yol reddedilir. Boş disk < 10 GB ise reddedilir.
- Ana depodan kopyalanır: tests/e2e/__baseline__ (+__baseline_prev__), vendor, vendor-dev, tools/bin/*.phar, build/local-wp (WP + zip'ler), build/migration/cache. Var olan dosyaya dokunulmaz (`--force` yazar); build/e2e/matrix, evidence kopyalanmaz.
- **APFS klonu (E8Y):** dosyalar `fs.copyFileSync(..., COPYFILE_FICLONE)`, `node_modules` dizin olarak `cp -c -R` (Linux `--reflink=auto`) ile copy-on-write klonlanır; klon olmazsa normal kopya. Çıktıda `klon: evet/hayır`. Sembolik bağ yok (§14 korunur); klon yazılana dek disk tutmaz. node_modules içindeki `.env*`, `*.pem`, `*.key`, `.auth`, `.ssh` kopyadan silinir.
- Kara liste (birim testli): `.env*`, `.auth`, `*.pem`, `*.key`, `.ssh`, node_modules (dosya planında), .git.
- `npm install --no-package-lock --legacy-peer-deps` yalnız `package.json` + `node_modules/.package-lock.json` sha256 özeti ana depodakinden farklıysa çalışır (ana depoda package-lock.json senkron değil; lock yerine bu özet kullanılır); `ajv@8 --no-save` yalnız kopyada ajv major 8 değilse. `composer.lock` farklıysa uyarı yazılır. `--skip-install` kurulumu atlar.
- Ölçüm (27 bin dosya + node_modules, 3 koşu): eski yöntem (normal kopya + npm install) 38–96 sn; yeni (klon) 31–43 sn, npm install atlanır; ayrıntı RAPOR-E8Y.md.

## Kaynak kapısı (`node scripts/resource-gate.mjs`)
- Yeni (ağır) ajan başlamadan önce: boş disk (`df -k`), kullanılabilir bellek (`vm_stat`: free+inactive+speculative sayfa), takas (`sysctl vm.swapusage`). Çıkış 0 = başla, 1 = bekle (neden satırı).
- Varsayılan eşikler: disk ≥ 20 GB, bellek ≥ 4 GB, takas < 2 GB; `--min-disk-gb`, `--min-free-mem-gb`, `--max-swap-gb`, `--json` ya da `WDP_GATE_MIN_DISK_GB`/`WDP_GATE_MIN_FREE_MEM_GB`/`WDP_GATE_MAX_SWAP_GB`.
- Playwright `--workers` önerisi: min(4, CPU/2, bellek/1,5 GB); takas ≥ 1 GB ise −1, ≥ 2 GB ise 1.
- Bağımlılıksız; ayrıştırıcılar sahte çıktıyla birim testli (`tests/unit/js/resource-gate.test.mjs`). package.json'a `resource:gate` E8Z'de eklenir.

## E8J — Ön yüz paketi erteleme (tarihsel; eski paket 12.0.0'da silindi)
- **Sorun (E8B):** eski motor paketi (`donation-modal.*.js` 68 KB gzip) ürün/mağaza sayfasında sayfa yüklenirken çalışıyor; Lighthouse mobil tt5 ürün 59–73 (eklentisiz 92).
- **Çözüm (yalnız yükleme stratejisi; CSS kural içeriği/şablon HTML'i değişmedi):** `includes/class-assets-defer.php` (`WDP_Assets_Defer`, `WDP_Assets::init`te bağlanır) WordPress `script_loader_tag` süzgeciyle yalnız `wdp-form-cta-ready-js` + `wdp-donation-modal-js` betiklerinin `<script src>` etiketini `type="text/wdp-deferred" data-wdp-src` yapar (satır içi `wdp_ajax` verisi, bağımlılıklar `jquery`/`wc-add-to-cart`, sıra, tutamaç aynı). Küçük satır içi yükleyici `assets/js/defer-loader.js` (≈4 KB, istek başına bir kez, ES5, bağımlılıksız) onları sırayla gerçek betik olarak ekler (`async=false`).
- **Tetikleyiciler:** `pointerover`/`pointerdown`/`touchstart`/`focusin` (tetikleyici düğme `.wdp-donate-button/.wdp-open-modal/.wdp-open-side-panel`, `.wdp-cta-gate`, `.wdp-donation-form` üzerinde) → hemen yükle. Paket yokken tıklama kaybolmaz: yakalanır (`preventDefault`), düğmeye `wdp-loading` + `aria-busy`, yükleme sonrası aynı hedefe yeniden gönderilir (bağlantılar `a[href]` hariç, kendi yoluyla). Boşta: satır içi form olan sayfada (`[data-wdp-display="inline"]`; CTA "yükleniyor" bekler) `load` + 300 ms, yalnız tetikleyici düğmeli sayfada (mağaza/arşiv, kısa kod düğmesi) `load` + 4 sn (`requestIdleCallback`).
- **Yükleme sonrası başlatma:** paket `load` olayından sonra geldiği için `window load` işleyicisi çalışmaz; yükleyici `moduleLoader.update`, `dom.observeDOMChanges`, `formInitializer.direct(document)` adımlarını kendisi çağırır.
- **Kapatma:** `add_filter( 'wdp_defer_frontend_assets', '__return_false' )` (yönetici, AJAX, JSON, feed, Customizer önizlemesinde zaten kapalı). Mağaza/arşivde düğme yoksa paket zaten hiç yüklenmez (`WDP_Assets::should_enqueue_assets`, değişmedi).
- **Bilerek yapılmayan:** CSS bölme/erteleme. Paket tek `@layer`/token zinciri; tetikleyici düğmenin kuralları `tokens/polish/base/buttons/accessibility` içinde iç içe — ayırmak kural içeriğini/katman sırasını değiştirir (E8G'nin alanı) ve tek giriş noktası olan düğmede FOUC/CLS riski doğurur. Öneri: ayrı iş olarak "kritik (tokens+tetikleyici) / ertelenen (modal-panel-form)" CSS bölmesi, FOUC'suz doğrulamayla.
- **Test:** `tests/unit/AssetsDeferTest.php` (etiket yeniden yazımı); `tests/e2e/specs/quality-gates.spec.mjs` "yükleme" (mağazada etkileşimden önce paket isteği yok, hover sonrası yüklenir + panel açılır; doğrudan tıklama kaybolmaz; satır içi formda CTA boşta açılır). Ölçüm: `WDP_Q_NODEFER=1` (`wdp-quality-sim.php` `nodefer`) erteleme kapalı kontrol; bütçe tablosu "ertelenen JS" sütunu (`quality-budget.mjs`).

## Uyum testleri (E8N): Elementor Pro (yalnız test; eklentide Elementor kodu YOK)
- Eklenti Elementor'u tanımaz (CLAUDE.md §0). `tests/e2e/helpers/elementor-compat.mjs` yalnız sayfada Elementor Pro DOM işareti (`[data-elementor-type="product"]`, `.elementor-widget-woocommerce-cart|checkout-page|my-account|menu-cart`) var mı diye bakar; yoksa senaryo `ScenarioSkip`: "Theme Builder <tür> şablonu yok: kullanıcı oluşturunca koşar".
- 6 senaryo: ürün şablonu, Cart, Checkout (view-only), My Account (ziyaretçi), Menu Cart + yan sepet (iki panel birlikte açık değil, sayaç), bağışçı hesabı penceresi (odak tuzağı/Esc/kaydırma kilidi). Her biri: eklenti kaynaklı JS hatası yok, çift yükleme yok (`wdp`/`dp-`/`hdf-` yinelenen id, yinelenen betik).
- Koşucu `npm run e2e:elementor-compat`: varsayılan local = TÜMÜ ATLANIR; `-- --sim` yerel şablon simülasyonu (`wdp-elementor-sim.php` işaretleri taklit eder; gerçek Elementor yerelde kurulamaz); `-- --env ikram-aid` uzak (yalnız Claude; merkezi koruma, ortam kilidi, kanarya, ağ koruması, ziyaretçi, sipariş/forma verisi yok). Başka ortam reddedilir.
- Spec (`elementor-pro-compat.spec.mjs`) yalnız loopback adreste ve `WDP_ELEMENTOR_COMPAT=sim` iken koşar. Kullanıcı adımları: `build/handoff/ELEMENTOR-PRO-KURULUM-ADIMLARI.md`.

## E8W — Ürün sayfası HTML yükü (tarihsel; `WDP_Client_Data` ve `wdp_ajax` silindi)
- **Ölçüm bulgusu:** ürün sayfası HTML'i 153 KB: eklenti payı ≈43 KB (satır içi `wdp_ajax` 31,6 KB, satır içi CSS 8,5 KB, yükleyici 4 KB, satır içi form ≈7 KB; E8J'deki "~70 KB form" tahmini yanlış okumaydı — 70 KB değil ≈7 KB). Popup/panel/alt panel formu ürün/mağaza sayfasında zaten basılmaz (`data-wdp-lazy`, ilk etkileşimde `wdp_render_modal`/E8D REST `modal` ucu); yalnız sayfa içi form sunucuda basılı kalır (LCP/CLS).
- **Çözüm:** `includes/class-client-data.php` (`WDP_Client_Data`, `WDP_Assets::init`te bağlanır). Telefon ülke listesi (≈21,7 KB) ve çeviri sözlüğü (`i18n_dict`, ≈5,8 KB) satır içi `wdp_ajax`ten çıkar; `?wdp_client_data=<yerel ayar>&ver=<sürüm-çeviri özeti>` adresinden ayrı, önbelleğe alınabilir (`public, max-age=86400`) bir betik olarak gelir ve `window.wdp_ajax.phone.countries` + `window.wdp_ajax.i18n_dict` alanlarını ekler. İçerik birebir aynıdır (önce/sonra JSON eşitliği doğrulandı); `wdp_ajax` küçük çekirdek (≈5,6 KB: nonce, para birimi, metinler, düğme simgeleri, `phone.default_country`).
- **Sıra (eşzamanlı okuma sözleşmesi korunur):** `wdp_ajax` artık `wdp-form-cta-ready-js` tutamacının satır içi verisidir; `wdp-client-data-js` ona bağlıdır ve paketin (`wdp-donation-modal-js`) bağımlılığıdır → sıra: `var wdp_ajax` → veri betiği → paket. Erteleme açıkken (E8J) veri betiği de `type="text/wdp-deferred"` olur ve yükleyici onu paketle aynı sırada ekler; erteleme kapalıyken normal alt bilgi betiği.
- **Uç:** `init` (99) kancasında `?wdp_client_data` varsa yanıt verip çıkar (WP şablonu yüklenmez). Yerel ayar yalnız `ab[c][_XX][_xx]` biçiminde kabul edilir (aksi 400); `switch_to_locale` ile o dilin çevirisi kullanılır. Kişi verisi/oturum yok; çerezsiz önbelleklenebilir.
- **Kapatma:** `add_filter( 'wdp_split_client_data', '__return_false' )` (eski satır içi davranış). Modüler geliştirme yığını (paket yok) her zaman satır içi.
- **Ölçüm düzeni (tests/e2e/helpers/quality-lighthouse.mjs):** ürün ve mağaza artık BOŞ sepetle ölçülür. Sepet doluyken WooCommerce mini-sepet blok varlıkları (~1 MB: components, react-dom, wc-blocks…) ürün sayfasında yüklenir ve eklentisiz kontrolde (`dp_q_off`) sepet kalamaz (bağış ürünü eklenti pasifken geçersiz sayılıp sepetten düşer) → eski "eklenti payı" yanıltıcıydı. Sepetli ürün (`urun-sepetli`, kontrol: eklenti varlıkları çıkarılmış `dp_q_strip=all`) ve ödeme ayrı satır. Teşhis anahtarları (yalnız yerel sim): `dp_q_html=json|form|css|all`, `dp_q_strip=all`.
- **Kalan fark:** eklentili ürün sayfasında FCP ≈ +600 ms; `dp_q_strip=css` ile kontrol düzeyine iner → neden render-engelleyen 34 KB gzip CSS (E8J "CSS bölme" önerisi; ayrı iş).
- **Test:** `quality-gates.spec.mjs` "yükleme" (2 yeni test: satır içi veri çekirdeği < 10 KB ve ülke/sözlük gömülü değil, veri betiği paketten önce çalışır ve telefon ülke paneli 245 seçenek çizer; uç başlıkları + geçersiz yerel ayar 400).

## K3 — Kritik CSS: tam stil paketi ilk boyamayı engellemez
- **Sorun (E8W ölçümü):** tek paket `donation-modal.<hash>.css` (268 KB ham / 34 KB gzip) render-engelleyiciydi; ürün sayfasında FCP ≈ +600 ms. Paketin çoğu (popup, yan panel, teşekkür, toast, hareket, sihirbaz, kampanya...) ilk görünümde işe yaramaz.
- **Yaklaşım (tek yön, güvenli):** ilk görünümde DOM'da bulunan kuralların ALT KÜMESİ satır içi basılır; TAM paket ise aynı yerde, aynı sırayla ama engelleyici olmadan (`media="print"` + `onload` → `all`) sonradan yüklenir. Tam paket sonradan eksiksiz geldiği için basamaklı sıra özgün düzenle aynıdır (kritik kural önce, aynı kural tam pakette yine var); kritik alt kümede olmayan hiçbir kural kaybolmaz. Satır içi ayar CSS'i (`wp_add_inline_style`) bağlantıdan SONRA kalmaya devam eder. `<noscript>` yedeği özgün bağlantıyı verir.
- **Ayıklayıcı:** `tools/css-critical/build-critical.mjs` (derlemede `tools/build-css-bundle.php` çağırır; çıktı `assets/css/build/critical.<hash>.css`, `manifest.json` → `critical`). Ölçüt: kuralın seçicisi (durum sözde sınıfları `:hover/:focus/...` ve sözde öğeler atılarak) `tools/css-critical/fixtures/*.html` örneklerinden birinde bir öğeyle eşleşirse (LTR ve RTL bağlamı) kural kritiktir; yalnız eşleşen seçiciler tutulur; `@media/@supports/@container` sarmalayıcıları, `@font-face`, kullanılan `@keyframes` korunur; ayrıştırılamayan seçici kritik sayılır. Örnekler ürün (sabit/serbest/hisse/kampanya) ve mağaza sayfalarının `<body>` işaretlemesidir (`capture-fixtures.mjs`, yalnız yerel WP); tema/oluşturucuya özel hiçbir ayıklama yoktur. Playwright Chromium yoksa ayıklayıcı çıkış kodu 3 verir; derleme tek pakete düşer (eski davranış).
- **Çalışma zamanı:** `WDP_Assets::get_critical_bundle_css()` (manifest `critical`), `WDP_Assets_Defer::filter_style_tag()` (`style_loader_tag`, yalnız `wdp-donation-modal-css`; betik ertelemesiyle aynı `is_active()` koşulları: yönetici/AJAX/besleme/özelleştirici dışında). Kapatma: `add_filter( 'wdp_defer_frontend_styles', '__return_false' )` (ya da `wdp_defer_frontend_assets`).
- **İşlev yükleyicisi:** `assets/js/defer-loader.js` `whenStyles()`: paket başlamadan önce tam paketin yüklenmesini bekler (`media` hâlâ `print` ise `all` yapar; `load` ya da 4 sn zaman aşımı) → popup/panel/teşekkür stilleri hazır olmadan açılmaz, yanıp sönme yok. Tıklama yeniden gönderimi aynı kapıdan geçer.
- **Risk notları:** (1) Önbellek/optimizasyon eklentileri `onload` özniteliğini silerse tam paket `media=print` kalır; yükleyici (boşta/etkileşim) `media=all` yapar. (2) Örneklerde olmayan yeni ilk-görünüm işaretlemesi (yeni sınıf) tam paket gelene kadar stilsiz kalır → `quality-gates` "kritik alt küme tek başına ilk ekranı tam paketle aynı çizer" testi (statik ilk boyama piksel eşitliği) bunu yakalar; yeni sınıf eklenince örnekleri `capture-fixtures.mjs` ile yenile. (3) RTL: örnekler RTL bağlamında da eşleştirilir; kritik alt küme RTL kurallarını içerir.
- **Ölçüm düzeni:** `WDP_Q_NOSTYLEDEFER=1` (sim durumu `nostyledefer`) eski engelleyici davranışı verir (önce/sonra).
- **Uygulanan son biçim (düzeltme):** `media="print"`+`onload` ilk denemede tam paketi ilk yükle aynı anda indirdiği için (bant genişliği yarışı; FCP kazancı yalnız ~150 ms) bırakıldı. Son biçim: tam paketin yerine `<meta name="wdp-deferred-style" data-id data-href>` yer tutucusu (ilk yükte İSTEK YOK), `assets/js/style-defer-loader.js` (satır içi, ES5) sayfa yüklendikten sonra boşta (`requestIdleCallback`, ≤1,5 sn) ya da ilk etkileşimde (pointerdown/touchstart/keydown/focusin) yer tutucunun yerine `<link rel=stylesheet>` ekler (aynı DOM konumu → aynı basamaklı sıra). `assets/js/defer-loader.js` paket betiğini başlatmadan önce `WDPStyles.load()` ile stilin hazır olmasını bekler (4 sn zaman aşımı).
- **Küçük modül stilleri satır içi:** `donation-panel-*` tutamaçlı ve ≤ 12 KB stil dosyaları (yan sepet 9,7 KB, bağışçı hesabı 9,6 KB) ayrı engelleyici istek yerine `<style id="<tutamaç>-css">` olarak basılır (yan sepet kapalı çekmece işaretlemesi her sayfada olduğundan stilsiz kalamaz; ~2,5 KB gzip, ayrı istek ≈ +150 ms FCP). Büyük modül stilleri (deneyimler 24 KB, kampanya 16 KB) yalnız kullanıldığı sayfada eskisi gibi bağlantıdır.
- **Örnekler (fixtures):** `bt-*` (blok tema: ürün 4 tür + mağaza), `sf-*` (klasik WooCommerce işaretlemesi: `ul.products li.product`, ilgili ürünler), `bk-*` (klasik, başka tema işaretlemesi) — hepsi yalnız WooCommerce/eklenti işaretlemesinin bulunduğu örneklerdir, ayıklayıcı tema adı bilmez. Yeni ilk-görünüm sınıfı eklenirse `capture-fixtures.mjs` ile yenile; test (`quality-gates` "kritik alt küme tek başına ilk ekranı tam paketle aynı çizer": 4 ürün türü + mağaza, JS paketi ve tam paket engelli, piksel farkı ≤ %0,05) bunu yakalar. WooCommerce "ilgili ürünler" her yüklemede rastgele olduğundan karşılaştırmada gizlenir.
- **Ölçüm özeti (yerel, boş sepet, ürün sayfası, 3 koşu medyan, simüle yavaş 4G):** ilk yük CSS (gzip) 37,8 KB engelleyici → 18 KB satır içi + 33 KB ertelenen; FCP tt5 2573 → 2270 ms (eklentisiz 1969), perf 90 → 92 (kontrol 94). Ayrıntı RAPOR-K3.md.

## K7 — Kritik CSS 2. tur: sayfa türüne göre küme + değişken budama; tt4 teşhisi
- **Sayfa türü başına kritik küme:** `build-critical.mjs` örnek adından türü çıkarır (`bt|sf|bk-<tür>`: `product-fixed|custom|shares|campaign|shop`), her tür için ayrı alt küme üretir (`assets/css/build/critical.<tür>.<hash>.css`; `manifest.json` → `critical_sets`; birleşim `critical` olarak kalır = güvenli varsayılan). `WDP_Assets_Defer::critical_page_type()`: ürün sayfasında `WDP_Donation_Type::for_product()`, mağaza/ürün arşivinde `shop`, tanınmayan sayfada '' → birleşim. Süzgeç `wdp_critical_css_page_type` (türü değiştirir/boşaltır). Tema/oluşturucu tespiti yok.
- **`:root` değişken budama:** kritik çıktıdaki `:root` özel özelliklerinden, kritik kurallarda (`var()` zinciriyle) ve PHP/şablon/JS/blok kaynaklarında (satır içi ayar CSS'i, JS) adı geçmeyenler atılır; tam paket sonradan hepsini getirir. `CRITICAL_NO_PRUNE=1` kapatır.
- **Boyut (ham / gzip):** birleşim 94,9 KB / 13,4 KB → 88,5 KB / 12,1 KB; sabit tutarlı ürün 62,8 / 9,5 → 55,8 / 8,1; serbest 55,3 / 8,0; hisse 44,4 / 6,8; kampanya 67,9 / 9,9; mağaza 15,9 / 3,6 → 7,1 / 1,8 KB.
- **Yapılmayan:** `html body :is(...)` önekinin kuralı kısaltılması (özgüllük değişirdi; kritikte ~250 önek ≈ 2,5 KB ham, gzip'te ihmal edilebilir; ölçüldü) ve ilk ekran dışı bölümlerin ayıklanması (örnekler eklenti CSS'siz ve temasız olduğundan konum güvenilir değil).
- **Kapı:** `quality-gates` piksel eşitliği (4 ürün türü + mağaza, tam sayfa, ≤ %0,05) türe özel kümeyle; ek kontroller: sabit ürün kritik < 70 KB, mağaza < 20 KB, kampanya kümesi sabit kümeden geniş.
- **tt4 teşhisi (yerel, 5 koşu; `tests/e2e/quality-diag-fonts.mjs`):** eklenti kendi `@font-face`/`font-display` tanımlamaz (yazı tipi `inherit`); FCP iki kiplidir (1,97 / 4,52 sn) ve eklentisiz kontrol sayfasında da görülür (mağaza kontrolü 2/5 yavaş; ürün eklentili 4/5, kontrol 0/5). Yazı tipi istekleri (Inter 326 KB, Cardo 146 KB) her iki durumda ~180-230 ms'de başlar; fark ilk boyamanın (gözlenen iz) yazı tipi bitişinden önce mi sonra mı olduğuna bağlı Lighthouse simülasyon basamağıdır: eklenti HTML/CSS'i ilk boyamayı birkaç ms geciktirdiğinde yazı tipi FCP bağımlılığı olur (+~2,5 sn). Eklenti CSS'siz (`dp_q_strip=css`) 0/5 yavaş. LCP öğesi Lighthouse düğüm bilgisi vermedi ("-"); LCP eklentisiz 5,1 sn / eklentili 5,4 sn (tema kaynaklı, sayfa görseli). Sonuç: tema yazı tipi yarışı + eklenti satır içi yükü; eklentide düzeltilecek yazı tipi tanımı yok, yük küçültmek tek kaldıraç (K7 ile yapıldı, basamağı değiştirmedi).
- **tt5 notu:** FCP 2272 / eklentisiz 1970 (+300 ms) aynı basamak etkisidir: ürün giriş formunu HTML'den çıkarınca (`dp_q_html=form`) 1968'e iner; CSS boyutundan bağımsızdır (kritik 13,4 → 8,1 KB gzip, FCP aynı).

## Hızlı test düzeni (E8Z)

- **`npm run test:affected [-- --base ikram-ortam] [--print|--run] [--json] [--no-e2e]`** (`scripts/affected-tests.mjs`): `git diff <base>...HEAD` + çalışma ağacı değişikliklerinden etkilenen PHPUnit dosyalarını, JS birim testlerini ve e2e koşucularını bulur. (a) Ters bağımlılık yürüyüşü (en çok 3 adım): PHP sınıf adı/`use`/kanca adı, JS `import`, testin kaynak dosya yolunu anması; varsa `build/graph/graph.json` dosya kenarları eklenir. (b) `scripts/lib/test-map.json`: yol deseni -> e2e koşucusu (elle bakım). Haritada olmayan dosya -> **güvenli varsayılan**: tüm PHPUnit + JS + `e2e:quick`. `--run` e2e'leri `e2e:queue` üzerinden `--env local` ile koşar.
- **Bu betik ajan içi hızlandırıcıdır, merge kapısı DEĞİLDİR.** Merge öncesi `verify` + tam `test` + gerekli e2e kapıda yine koşar. Yeni modül/klasör eklenince `test-map.json` güncellenir.
- **`npm run e2e:queue -- <komut…>`** (`scripts/e2e-queue.mjs`): tüm Playwright tabanlı e2e betikleri için tek kuyruk. `build/e2e/queue.lock` (`wx` özel oluşturma) + FIFO biletler (`build/e2e/queue/`); ölü süreç kilidi/bileti temizlenir; bekleme süresi yazdırılır. `WDP_E2E_WORKERS` değeri `scripts/resource-gate.mjs --workers` varsa ondan, yoksa boş bellek / 1,5 GB (en çok CPU çekirdeği; takas > 2 GB ise yarısı) ile türetilir; `tests/e2e/playwright.config.mjs` `workers` ayarını bu env'den okur (yoksa 1).
- **Ajan kuralı:** e2e koşuları `npm run e2e:queue -- npm run e2e:<ad> -- --env local` ile başlatılır (paralel ajanlar Playwright'ı aynı anda koşmaz). Port yine ajana özeldir.

## E8S — staging30 toplam yeniden hesap kuru çalıştırma (`npm run staging:recalc-dryrun`)

- `scripts/staging-recalc-dryrun.mjs` + `scripts/lib/staging-recalc-dryrun.mjs`: sabit eval-file `tests/e2e/helpers/recalc-dryrun.php`, `Totals_Recalculator::run($ids, true)` ile ürün başına eski toplam -> hesaplanan toplam + "kur bulunamadı" uyarılarını JSON/`--md` üretir. Yalnız `staging-hedef` (Ikram ve canlı reddedilir), `CLAUDECODE=1`, `buildGuardedEvalFileCommand` (klasör kilidi, REMOTE_FREEZE).
- Yazma yok iki katmanlı: çalıştırmadan önce PHP dosyası `WRITE_CALL_RE` + `dry_run=false` kalıbı için taranır; çalışma anında `WDP_DRY_RUN_ONLY` sabiti ile `dry_run !== true` çağrısı reddedilir. Çıktıda kişisel veri yok (ürün id/başlık, sayılar).
- `-- --local`: aynı PHP yerel WP'de (`WDP_RECALC_DIGEST=1`) koşar, önce/sonra veritabanı özeti (`_wdp*` meta/seçenek + tablo satır sayıları, sha256) aynı değilse hata verir.

## E8U — Yönetici ekran adı doğrulama (`npm run admin:screens`)
- `node scripts/admin-screens.mjs --env local|staging-hedef|ikram-aid [--ui new|legacy (yalnız yerel)] [--check-doc docs/CANLIYA-ALMA.md] [--strict]`: mevcut yönetici oturumuyla (`helpers/auth.mjs`, oturum tek kez) wp-admin ekranlarını yalnız GET ile açar; sol menü, sayfa başlığı, sekme/bölüm başlığı ve ayar etiketlerini METİN olarak toplar. Tıklama/yazma yok; `ctx.route` GET/HEAD dışını keser (ağ koruması + ortam kilidi + uzakta operatör kapısı, dondurma ve kanarya öncesi/sonrası).
- Kişisel veri ve ayar değeri toplanmaz (girdi değerleri, bildirimler, tablo satırları okunmaz; plugins.php'de yalnız kendi eklenti satırı). Ekran görüntüsü yalnız yerelde. Çıktı: `build/handoff/admin-screens-<env>.json|md`.
- `--check-doc`: belgede `A › B › C` biçiminde yazılmış yolları çıkarır, menü ağacı + toplanan metinlerle karşılaştırır, "belgede geçen ama bulunamayan" listesini üretir (site yönetici dili belgeden farklıysa yalancı eksik çıkabilir). İzinli ortam: local, staging-hedef, ikram-aid; canlı reddedilir. Saf mantık: `scripts/lib/admin-screens-lib.mjs`, test: `tests/unit/js/admin-screens.test.mjs`.

## E8Q — Eski/yeni yönetici ekranı geçişi (KALDIRILDI, 12.0.0)

`src/Admin/class-ui-switch.php`, `donation_panel_switch_ui` admin-post eylemi, "Klasik ekrana dön" düğmesi ve motor seçici etiketleri silindi (eski ekran 11.0.x'te bir sürüm "eski deneyime dön" olarak kalmıştı; 12.0.0'da kaldırma sözü yerine getirildi). Eklentiler listesi "Settings" bağlantısı doğrudan `donation-panel` sayfasına gider; eski `wdp-popup-settings` adresi Genel Bakış'a yönlenir. Silinen testler: `E8QUiSwitchTest`, `admin-e7` E8Q senaryoları.

## K2 — Kampanya toplamları: tanım, "elle eklenen tutar", göç önerisi

- **Tanım (tek kaynak `WDP_Utils::compute_order_progress_lines`):** yalnız `wdp_progress_paid_statuses` (varsayılan completed, processing); iptal/başarısız/bekleyen/beklemede/iadeli-durum sayılmaz; satır başına iade (`get_total_refunded_for_item`) düşülür; işlem ücreti ayrılır; tutar sipariş anındaki kurla ana para birimine çevrilir (`WDP_Progress_Currency::convert_to_base`; kur yoksa satır toplama katılmaz, "kursuz satır" uyarısı, sayı uydurulmaz); yalnız o ürünün satırları. Wc_get_orders/Woo API kullanıldığı için HPOS açık/kapalı aynı.
- **Kampanya dönemi (isteğe bağlı):** `_wdp_campaign_starts_at` / `_wdp_campaign_ends_at` (Y-m-d, site saat dilimi, bitiş günü 23:59:59 dahil) ya da `donation_panel_campaign_period` süzgeci; yoksa tüm zamanlar. Tarih = sipariş OLUŞTURMA tarihi (ödeme tarihi çevrimdışı yöntemlerde boştur). Yönetici ekranı yok (alanı sonraki iş karar verir). Aynı kural artımlı sayımda da geçerlidir (`compute_order_progress_amounts`).
- **Elle eklenen tutar:** ürün meta `_wdp_manual_total` (ana para birimi, >= 0; elden/havale gibi sitede siparişi olmayan bağışlar). Yönetici: ürün düzenleme > Bağış sekmesi, "Raised" satırının altında sayı alanı (nonce `wdp_save_product_donation` + `manage_woocommerce`/`edit_post`, `wc_format_decimal`, negatif yok; boş = 0). Hiçbir yeniden hesap/artımlı güncelleme/komut bu anahtarı yazmaz ya da azaltmaz (testli).
- **Tek okuma:** `WDP_Utils::get_total_donation_amount()` = `get_calculated_total_donation_amount()` (`_wdp_total_donation_amount`) + `get_manual_total()`; toplu: `get_totals_for_products()`. Kampanya hedefi/ilerleme (`WDP_Campaign_Goal`), ürün bağlamı, sepet/ajan yanıtı, ürün listesi ve yönetici özeti yalnız bunlardan okur. Saklanan sayaç hesaplanan kısımdır; eski anahtar ve kısa kodlar değişmedi.
- **`Totals_Recalculator::run($ids, $dry_run = true, $allow_write = false)`:** VARSAYILAN KURU ÇALIŞTIRMA. Yazma yalnız `$dry_run === false` VE `$allow_write === true`; izinsiz yazma isteği `RuntimeException` (hiçbir şey yazılmaz). CLI: `wp donation-panel recalc-totals --apply --i-understand` (yalnız `--apply` reddedilir; `--dry-run` ya da bayraksız = kuru). Yazma yalnız hesaplanan sayaçları günceller. `scripts/staging-recalc-dryrun.mjs` ve eval dosyasında yazma yolu YOK (statik denetim + birim test).
- **Göç ÖNERİSİ (uygulama yok):** `Totals_Recalculator::migration_suggestion()`: fark = saklanan - yeni; fark > 0 → önerilen elle eklenen = fark (bağışçının gördüğü sayı değişmez); fark < 0 → önerilen 0, `display_increases` (saklanan aşağı çekilmez, karar için raporlanır). Göç sonrası gösterilecek = yeni + mevcut elle + önerilen. Neden ayrıştırması (salt okunur, tüm sipariş durumları taranır; kişisel veri yok): durum (ödenmemiş siparişler toplamı), dönem dışı, iade (iade edilen satır + tam iadeli sipariş), yabancı/kursuz satır; pozitif fark sırayla durum > dönem > iade'ye paylaştırılır, kalan "elle giriş"; negatif fark: yabancı birimli satır varsa "para birimi", yoksa "veri yok". Dry-run çıktısı sütunları: saklanan, yeni hesaplanan, fark, önerilen elle eklenen, göç sonrası gösterilecek, olası neden (+ `--detail <id,id>` ile bileşen dökümü).
- **Testler:** `tests/unit/K2/K2CampaignTotalsTest.php` (tanım, dönem, iade, kur, durum ayrıştırması, izinsiz yazma reddi, elle tutarın korunması), `E8ARecalcTotalsTest`, `staging-recalc-dryrun.test.mjs`.

## Minimum sürüm gerçek testi (K4, tek seferlik, yerel)

`node scripts/min-versions.mjs --wp 6.3.5 --wc 8.0.3 [--theme storefront|twentytwentythree] [--store gbp|eur|...] [--checkout classic|blocks] [--hpos 0|1] [--port 8974] [--clean] [--no-reinstall]`

- Yalnız yerel: `build/min-versions/<kimlik>/` altında belirli WP + WooCommerce sürümüyle SQLite WP kurar (zip'ler yalnız wordpress.org / downloads.wordpress.org; indirilenler çalıştırılmaz), mevcut matris senaryolarını (`matrix-scenarios.mjs`, iPhone) koşar, `php-errors.log` içinde `plugins/woo-donation-popup` satırlarını sayar, `sonuc.json` yazar.
- Makinede yalnız PHP 8.4 var; PHP 7.4 için gerçek koşu yapılmadı. Statik kanıt: `phpcs --standard=PHPCompatibilityWP --runtime-set testVersion 7.4-` eklenti kodunda 0 sorun.
- Bulgu: WooCommerce 8.0–8.4 `AddToCartForm.php` (`add_is_descendent_of_single_product_block_hidden_input_to_product_form`) `preg_replace` ile `<button type="submit"…>` kalıbının TÜM eşleşmelerini ilk düğmeyle değiştirir; blok tema ürün şablonunda formda iki submit düğmesi varsa "ödemeye git" düğmesi kaybolur. Ayrıntı ve çözüm önerisi: build/handoff/RAPOR-K4.md.

## K5 — WC 8.0–8.4 AddToCartForm düğme kalıbı

WooCommerce 8.0–8.4 `AddToCartForm` `preg_replace` ile formdaki tüm `<button type="submit"` kalıplarını ilk eşleşmeyle değiştirir. Bağış düğmeleri (`includes/templates/class-modal-shell-renderer.php` `render_form_action_button`, `templates/donation-panel/experiences/form.php`) `type="submit"` özniteliğini SONA yazar (`<button%1$s name="..." type="submit">`); davranış/erişilebilirlik değişmez. Test: `tests/unit/SubmitButtonMarkupTest.php` (render + kaynak taraması).

## 12-int2 — Üçüncü dalga: araçlar, liste, kampanya toplamı (12.0.0)

**Araç tablosu (12-f; yukarıdaki "Araç" tablosundaki eski PHPCS/PHPStan/baseline satırlarını geçersiz kılar):** tek `phpcs.xml.dist` (gevşetme yok; `src/`, `templates/`, `blocks/`, ana dosya, `uninstall.php`; `WDP_*` sabitleri için dar satır içi istisna) + tek `phpstan.neon` (seviye 6, baseline yok; `phpstan.dead.neon` bunu include eder). `tools/lint-baseline/` yalnız ESLint/Stylelint/Plugin Check için kalır. PHPCS/PHPStan baseline'ları silindi. Karne: `npm run code:report` -> `build/handoff/KOD-KARNESI.md`.

**Paketleme (12-f):** dağıtım zip kökünde yalnız izinli girdiler (ana dosya, `uninstall.php`, `readme.txt`, `src/`, `assets/` derlenmiş, `templates/`, `blocks/`, `languages/`). Liste üç yerde birlikte güncellenir: `.distignore` başlığı, `scripts/package-wp-plugin.sh` `ALLOWED_TOP`, `tests/unit/js/package-contents.test.mjs`. `design/` ve `research/` artık `dev/` altında. Uzak ağ kuralı: `donation-panel/v1` izin listesi (4 rota) + Store API `cart/add-item` izinli, checkout/sipariş engelli (CLAUDE.md §2). Klasör ağacı kaynağı: `docs/YAPI.md`.

**`[wdp_donations]` listesi (12-ui3):** `assets/build/list` (Assets slug `list`). Kart düğmesi gerçek ürün bağlantısıdır (`<a data-wdp-form>`; JS yokken ürün sayfasına gider). JS varken `list` istemcisi `GET donation-panel/v1/experience/{id}?kind=popup|side_panel|bottom_sheet` ile kap+form HTML'ini alır, gövdeye `.wdp-form-host` olarak ekler, `dp:scan` olayıyla `experiences` modülüne bağlar, gizli tetikleyiciyi tıklar; kapanınca odak düğmeye döner. `button="link"` -> form yüklenmez. Sekmeler `<nav>` içinde bağlantıdır (JS'siz uyum; `aria-current`). Yeni öznitelik `title` (varsayılan boş). Önbellek anahtarında `MARKUP_REV`. Rozet günleri `donation_panel_campaign_days_left`. Süzgeç `wdp_donations_card_html` korunur. Uç: salt okunur, ziyaretçiye açık, nonce istemez; koruma hız sınırı (60/dk) + `Cache-Control: no-store`; gizli/taslak ürün 404. Denetleyici `src/Modules/EntryPoints/class-experience-controller.php`.

**Kampanya toplamı formülü (12-e):** `src/Domain/class-campaign-formula.php` (`Campaign_Formula`). Saklanan toplam = devreden tutar (`_wdp_carried_amount`) + kampanya başlangıcından (`_wdp_campaign_start`) sonra ÖDENMİŞ siparişlerdeki bağış tutarı (iade düşülmüş; mevcut kurla ana para birimi). Gösterilen = saklanan + elle eklenen (`_wdp_manual_total`, dokunulmaz). "Ödenmiş" = `Campaign_Totals::get_progress_paid_statuses()`. Sayılma anı: ödeme tarihi -> tamamlanma -> oluşturma tarihi. Artımlı güncelleme formülle uyumlu: yeni ödenmiş sipariş artırır, iptal/iade azaltır; başlangıçtan ÖNCE sayılmış siparişin iptal/iadesi saklanan toplamı değiştirmez. Meta anahtarları `_wdp_carried_amount`, `_wdp_campaign_start`, `_wdp_totals_log` (kim/ne zaman/eski/yeni; son 100) yalnız `Campaign_Formula` + artımlı sipariş kancalarınca yazılır. Yeniden hesap: yalnız yönetici onayıyla, önizleme -> uygula; uygula önizlemedeki tutarı `expected` olarak gönderir (bayatsa 409; bitiş tarihi geçmişteyse reddedilir). Önizleme POST'tur ve hiçbir şey yazmaz. WP-CLI `wp donation-panel recalc-totals` yalnız kuru çalıştırmadır (`--apply` hata verir). Kaldırıldı: otomatik/cron toplu yazma (`wdp_recalculate_product_donation_total` kancası; dışarıdan zamanlanmışsa işlevsiz kalır). Eski AJAX ucu silinmedi, önizlemeye çevrildi.

## 12-fix / 12-g / 12-fix2 — Bağımsız inceleme düzeltmeleri, ölçüm aracı, entegrasyon testleri

**Katmanlar (12-fix #17):** `Domain` artık `Modules\` ve `WooCommerce\Cart_Hooks` kullanmaz: olay `donation_panel_totals_changed` (Donations_List dinler) ve süzgeç `donation_panel_cart_pending_total` (Cart_Hooks yanıtlar), `Price::format_for_message`. `Domain` içinde `WC_`/`wc_get_*` çağrıları vardır (WooCommerce okuma API'si); "Domain WooCommerce'ten bağımsız" ifadesi doğru DEĞİLDİR — tam ayrım geniş yeniden düzenleme, ayrı iş. Kural testle korunur: `LayerDependencyTest`.

**Kilit:** `Domain\Named_Lock` (`add_option` tabanlı atomik; kampanya toplamı, bağışçı sayısı, sipariş sayımı). Göçler `Core\Migrations` kendi kilidini kullanır (120 sn eskime; hata `donation_panel_migrations_error` + yönetici bildirimi; kalan adımlar sonraki istekte kaldığı yerden sürer). Gerçek veritabanında atomiklik: `MigrationLockIntegrationTest`.

**İstemci IP:** `Http\Client_Ip`; varsayılan `REMOTE_ADDR`; `X-Forwarded-For`/`X-Real-IP` yalnız `donation_panel_trusted_proxies` listesindeki vekilden (IP/CIDR, v4+v6). `WC_Geolocation::get_ip_address()` KULLANILMADI (başlıklara koşulsuz güvenir). Girişli kullanıcı kendi kimliğiyle sayılır.

**Tutar:** sınır `Domain\Amount_Limits` (`donation_panel_max_amount`, varsayılan 9.999.999); ayrıştırma Woo ondalık sayısı ve ayırıcılarına göre `Support\Price::parse_donor_amount` (PHP) = `assets/src/experiences/amount.mjs` (JS), ortak vektörler `tests/fixtures/amount-parse-vectors.json` (TRY/USD/EUR/GBP/KWD, Türk/İngiliz/Alman biçimleri). Kural: ondalığı <3 olan mağazada tek ayırıcı + tam 3 basamak binliktir (1.250 = 1250); ondalığı ≥3 (KWD/BHD) mağazada ayırıcı mağazanın ondalık ayırıcısıysa ondalık, binlik ayırıcısıysa binlik, ikisi de değilse BELİRSİZ: sunucu ve form "şu biçimde yazın, ör. 10,000" der (tahmin etmez). Form seçili tutarı sunucuya mağaza ondalık ayırıcısıyla gönderir (`data-thousand-sep`/`data-decimal-sep` formdan gelir).

**Sipariş kalemi yazıcısı:** tek yazıcı `WooCommerce\Donation_Order_Meta` (çekirdek `Order_Hooks::init`). **Uninstall:** yalnız kesin liste; yeni anahtar eklerken `Uninstall::product_meta_keys/option_names/transient_prefixes` güncellenmeli (`UninstallIntegrationTest` başka eklentinin `_enable_*`/`_theme_*`/`_addon_*` meta'sının kalmasını gerçek WP'de doğrular).

**JS:** `assets/src/ui2-shared/scroll-lock.mjs` ortak durum `window.__dpScrollLock` (paketler ayrı derlendiği için); yeni katman modülü `lockPage/unlockPage/isTopmost` kullanmalı.

**Adlandırma (#28):** kod içi Türkçe iç adlar genel adlara çevrildi: ürün bağlamı/admin form anahtarları `sadaka_*` → `addon_*`, `donation_data.is_sadaka` → `is_addon`, sepet gönderim anahtarı soneki `-addon`. DIŞA AÇIK adlar DEĞİŞMEZ: kancalar `wdp_sadaka_*`, sepet kalemi `wdp_sadaka_donation`/`wdp_sadaka_linked_wc_product`, ürün meta `_sadaka_*`/`_enable_sadaka_donation` (okuma yedeği), seçenek `wdp_sadaka_links_audit`, geçici `wdp_sadaka_line_ids`, `wdp_success_settings` alt anahtarları `sadaka_wc_product_id`/`sadaka_toggle_label` (veritabanı), CSS sınıfı `wdp-sadaka-cart-thumb` (yeni `wdp-addon-cart-thumb` ile birlikte basılır). `src/Compat/class-legacy-context.php`: `wdp_form_context` süzgecini eski `sadaka_*` anahtarlarıyla çalıştırır ve değişiklikleri yeni adlara geri yazar; eski sepet oturumundaki `is_sadaka` işareti okunur. `LegacyNamingTest` `src/` içinde listede olmayan "sadaka" adını yasaklar. Test sınıfları özelliğe göre adlandırıldı (E0/E2A/Fix*/K5/Migration* önekleri kalktı; dizinler `Campaign`, `Thanks`, `Settings`, `Hardening`); çoklu para birimi testi `ForeignCurrencyCartAmountTest` (eklenti adı yok; yalnız `docs/site-snippets/` altındaki snippet testi `SiteSnippetCurcyBridgeTest` siteye özeldir).

**Sosyal kanıt (K3, #21):** ad HİÇBİR koşulda gösterilmez; `wdp_public_name` rızası okunmaz.

**Kapsam davranışı (#6/#7):** açık `id`/`slug`/`sku`'lu kısa kod/blok/widget bağış kapsamı dışı ürün için çizilmez ve REST reddeder; ziyaretçi boş çıktı, `manage_woocommerce` yetkilisi `Admin_Notice::manager_notice_html` ipucu görür (`OutOfScopeShortcodeNoticeTest`).

**Entegrasyon testleri (#29):** `npm run test:integration` (verify zincirinde, ~9 sn): `scripts/test-integration.mjs` `build/local-wp/wordpress`'i APFS klonuyla `build/integration-wp/wordpress`'e kopyalar (uzak bağlantı yok; `--fresh` yeniden kopyalar), eklenti dosyalarını her koşuda yeniden eşler, `tests/integration/prepare.php` ile WooCommerce + eklenti etkinleştirir ve HPOS'u açar (tablolar dâhil), `phpunit.integration.xml.dist` çalışır. Testler `WDP_Integration_Test_Case` taban sınıfından gerçek WooCommerce nesneleri üretir ve YALNIZ kendi oluşturduğu kayıtları siler. Kapsam: bağış olmayan ürün sepete girmez, ikinci bağış birincinin üstüne yazmaz, tutar sınırı (+ süzgeç), kampanya toplamı tek sayım/bayat nesne/HPOS çöp-silme, uninstall kapsamı, göç kilidi + yarıda kalan göçün devamı, proxy/IP hız sınırı kovası. Birim testler (sahte WP) hızlı mantığı, entegrasyon gerçek WP/Woo/HPOS davranışını kapsar.

**Ölçüm aracı (12-g):** `tests/e2e/quality-diag-lcp.mjs` (LCP/uzun görev tanı aracı; `npm run e2e:queue -- node tests/e2e/quality-diag-lcp.mjs --theme twentytwentyfour --runs 5 --variants plugin,control,stripjs`). Desteklenen aralık: PHP 7.4–8.4 (Playground kanıtı; 8.5 denenmedi), WP 6.3.5+, WC 8.0.3+. Playground tek seferlik doğrulama içindir; matris yerine geçmez (§23 madde 4). E8J/K3/E8W bölümleri eski motoru anlatır (tarihsel).

## 12.1 — Adlandırma, doğrudan bağış, sıfır yük (güncel)

**CSS adlandırma:** tüm ön yüz stili `.donation-panel` kökü altındadır; bileşen sınıfları `donation-panel-*` (ör. `donation-panel-btn`, `donation-panel-amount`, `donation-panel-actionbar`). Global seçici, sıfırlama ve `!important` yoktur. Yalnız `@keyframes` adları (`dp-spin`, `dp-fadeup`, `dp-shake`, …), özel özellikler (`--dp-*`) ve JS'in kullandığı `data-dp-*` öznitelikleri/`id` önekleri `dp-` ile kalır (CSS sınıfı DEĞİL; sözleşme: tasarım belirteçleri tek kaynak `--dp-*`). Ortak temel (belirteçler + düğmeler) `assets/src/experiences/base.css` içindedir; `assets/src/campaign/base.css` bunun eski bir kopyasıydı (tekilleştirme RAPOR-121-clean "Kalan işler").

**İstemci IP ve vekil:** `Http\Client_Ip::trusted_proxies()` listesi Araçlar ekranındaki "Trusted proxy addresses" ayarından (`general.trusted_proxies`, varsayılan boş) okunur ve `donation_panel_trusted_proxies` süzgeciyle değiştirilebilir (`docs/HOOKS.md`).

**Doğrudan (sepetsiz) bağış — `src/WooCommerce/Direct/`:** `Direct_Settings` (ürün meta `_donation_panel_direct` yes|no|boş = genel `direct.enabled`; süzgeç `donation_panel_direct_enabled`), `Direct_Order_Factory` (REST `POST donation-panel/v1/direct`: sepet akışıyla AYNI sunucu doğrulaması, tek kalemlik bekleyen sipariş, `submission_key` idempotency'si `add_option` kilidiyle; aynı anahtar + aynı içerik mevcut siparişin ödeme/teşekkür bağlantısını döndürür, farklı içerik 422; sepete dokunmaz; ödeme WooCommerce order-pay sayfasında geçidin kendi alanlarıyla, eklenti ödeme tamamlama/purchase kancası ÇAĞIRMAZ), `Direct_Cleanup` (zamanlama yalnız ilk doğrudan siparişte kurulur; saatlik olay `_donation_panel_direct` işaretli bekleyen/başarısız siparişleri `donation_panel_direct_pending_ttl` sn sonra iptal eder).

**Sıfır yük kuralları (CLAUDE.md §24):** `Frontend\Front_Gate` — `DONATION_PANEL_DISABLE` sabiti, `general.disable_frontend` ayarı ve `donation_panel_front_disabled` süzgeci; ön yüz isteğinde (yönetici/cron/WP-CLI hariç; REST yalnız adres örüntüsünden anlaşılır) bağışçı yüzeyi çıktısı 0. `Frontend\Assets` — modül başına TEMBEL kayıt: tanımlar (`define( $slug, $script, $style )`) yalnız bellekte tutulur, koşulsuz `wp_enqueue_scripts` kancası yoktur; kayıt ve kuyruk yalnız yüzey çizilirken `enqueue( $slug )` ile yapılır (çizim anı kuyruğu; engellemeyen stil için `$defer_style`). Arayüzsüz sayfada 0 CSS/JS/istek; arayüzlü sayfada ilk yük bütçesi: ≤~3 KB kritik CSS + 1 CSS + 1 JS.

**Lint kapıları (12.1 temizliği):** `npm run lint:js` (ESLint, `assets/src` + `blocks`, `complexity` ≤ 15) ve `npm run lint:css` (Stylelint recommended, `assets/src/**/*.css` + `assets/critical`) taban (baseline) YOKTUR; tek bulgu kırmızıdır (`scripts/lint-front.mjs`). `npm run lint:js:dev` tests/tools/scripts için bilgi amaçlı sayım verir (karmaşıklık sınırı orada kapalı; teknik borç). Plugin Check kapısı da tabansızdır; yalnız `trademarked_term` (klasör adı "woo-…", bkz. CLAUDE.md §1) kabul edilmiş bulgudur. Ölü kod aracı yapılandırması `tools/phpstan.dead.neon`, kopya kod `.jscpd.json` (`assets/src`, `assets/critical`, `blocks`).
