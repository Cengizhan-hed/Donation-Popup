# Donation Panel for WooCommerce — Kanca ve Genel API Başvurusu

Sürüm 12.0.0. Önek kuralı: yeni API `donation_panel_` ile başlar (gerekçe: docs/MIMARI-FAZ7.md §8). Eski `wdp_*` adları dışa açık sözleşmedir; **"korunur"** işaretliler çalışmaya devam eder, adları DEĞİŞMEZ ve aşağıda "Eski sözleşme" altında listelenir. Sözleşme tek dosyada: `src/Compat/class-public-contract.php` (sabitler `ACTIVE_HOOKS`, `RETIRED_HOOKS`, `RETIRED_AJAX_ACTIONS`). Sözleşme testi: `tests/unit/Contract/PublicContractTest.php`. Bu listenin kaynağı: `grep -rn "apply_filters\|do_action" src` (12.0.0).

## Çekirdek (yeni)

| Ad | Tür | Parametreler | Ne zaman |
|---|---|---|---|
| `donation_panel_module_enabled` | filtre | `bool $enabled, string $slug` | Modülün açık/kapalı kararı; kapalı modülün dosyası yüklenmez. |
| `donation_panel_modules_booted` | eylem | `string[] $active_slugs` | Etkin modüller başlatıldıktan sonra. |
| `donation_panel_rest_controllers` | filtre | `array $controllers` | REST denetleyici listesi (ad alanı `donation-panel/v1`). |
| `donation_panel_template_theme_folder` | filtre | `string $folder` | Tema geçersiz kılma klasörü (varsayılan `donation-panel`). |
| `donation_panel_campaign_period` | filtre | `array $period, int $product_id` | Kampanya toplamının sipariş tarih aralığı (başlangıç/bitiş); varsayılan ürün meta `_wdp_campaign_starts_at` / `_wdp_campaign_ends_at`. |
| `donation_panel_experience_html` | filtre | `string\|null $html, int $product_id, string $kind, string $button_text` | Giriş noktası (kısa kod/blok/otomatik yerleşim) çıktısını üretir ya da değiştirir; `null` = eklentinin kendi deneyimi çizilir. |
| `donation_panel_located_template` | filtre | `string $path, string $name` | Bulunan şablon yolu. |
| `donation_panel_before_template` / `donation_panel_after_template` | eylem | `string $name, string $file, array $args` | Şablon çıktısının öncesi/sonrası. |

Şablon geçersiz kılma: tema içinde `donation-panel/<ad>.php`.
Ayarlar: `donation_panel_settings` seçeneği (şemalı, sürümlü; yalnız `DonationPanel\Core\Settings` ile okunur/yazılır). Göç: `donation_panel_migrations` durum seçeneği; eski `wdp_*` seçenekleri okunur, silinmez.

## Eski sözleşme (geriye dönük uyum; adlar DEĞİŞMEZ)

Kaynak: `src/Compat/class-public-contract.php`.

Kısa kodlar (**korunur**): `[wdp_donation_button]`, `[wdp_donation_button_panel]` (`id`), `[wdp_donation_form]`, `[wdp_donations]`. Öznitelikler: `id, slug, sku, text, button_text, class, title, show_title`; 12.0.0'da `id/slug/sku/text/button_text` çalışır, `class` bir `<div class="donation-panel-entry ...">` sarmalayıcıya gider, `title/show_title` yeni formda kullanılmaz.
Bloklar (**korunur**): `wdp/donation-form`, `wdp/donations`.
PHP işlevleri (**korunur**): `wdp_render_donation_button()`, `wdp_render_donation_form()` (giriş dosyasında ince sarmalayıcı).
Meta (**korunur**): sipariş kalemi `wdp_donor_name, wdp_donor_phone, wdp_donor_email, wdp_donation_note`; ürün `_enable_sadaka_donation, _sadaka_min_price` (okuma yedeği) ve `_enable_addon_donation, _addon_min_price`; sepet `wdp_sadaka_donation, wdp_sadaka_linked_wc_product`.

**KALDIRILDI — ön yüz AJAX eylemleri (12.0.0):** `wdp_ajax_add_to_cart, wdp_get_cart_contents, wdp_get_cart_count, wdp_get_fresh_nonces, wdp_get_product_info, wdp_get_product_name, wdp_remove_cart_item, wdp_render_modal, wdp_verify_submission_in_cart`. Artık kayıtlı değildir; yerine REST `donation-panel/v1` (aşağıda). Süzgeç `wdp_render_modal_require_nonce` ve REST `GET donation-panel/v1/modal` de yoktur. Kaldırılan ayar/seçenekler: `donation_panel_settings.experiences.engine`, `admin.ui`, seçenek `wdp_upgrade_new_default`, `wdp_deprecated_ajax_*` sayaçları; `donation_panel_admin_ui` süzgeci ve `DONATION_PANEL_ADMIN_UI` sabiti.

**Etkin eski filtre/eylemler — korunur (26; kodda uygulanır):** `wdp_allow_multiple_entries, wdp_amount_presets` (yeni `donation_panel_amount_presets`'e yönlendirilir), `wdp_builder_preview_context_product, wdp_builder_preview_product, wdp_convert_amount, wdp_donations_card_html, wdp_donations_query_args, wdp_form_context, wdp_is_builder_preview, wdp_is_donation_product, wdp_min_donation_amount, wdp_order_exchange_rate, wdp_phone_{countries,default_country,excluded_countries,national_length_rules}, wdp_progress_{convert_amount,live_rate,paid_statuses}, wdp_resolve_product, wdp_sadaka_{cart_thumbnail_size,line_product_ids,toggle_label,wc_product_id}` (`wdp_sadaka_toggle_label` yeni deneyime yönlendirilir)`, wdp_supported_product_types, wdp_trust_proxy_headers`.

**Emekli eski filtre/eylemler (21; ekleyen kod bozulmaz ama ARTIK ÇAĞRILMAZ — eski modal/form arayüzüne aitti):** `wdp_campaign_media_url, wdp_client_context, wdp_critical_css_page_type, wdp_defer_frontend_assets, wdp_defer_frontend_styles, wdp_enable_side_cart_recovery, wdp_field_hint_{email,name,note,phone}, wdp_impact_line, wdp_lazy_idle_prefetch, wdp_modal_product_thumb_{alt,url}, wdp_rate_limit_ip_max, wdp_reload_after_add_to_cart, wdp_sadaka_price_label, wdp_should_enqueue_assets, wdp_show_amount_presets, wdp_split_client_data, wdp_use_js_bundle`.

Eski kaldırılanlar (K56): `wdp_meta_pixel_has_consent`, `wdp_meta_woocommerce_purchase_integration_active` (Meta Pixel), `wdp_product_schema`. Para birimi (K8): `wdp_convert_amount` korunur (aşağıda `donation_panel_convert_amount` ile). Para birimi bağdaştırıcıları (Curcy/WOOCS/WPML) çekirdekte yoktur; Curcy için `docs/site-snippets/`.

## Güvenlik ve veri bütünlüğü kancaları (12-fix)

| Ad | Tür | Parametreler | Ne zaman |
|---|---|---|---|
| `donation_panel_trusted_proxies` | filtre | `string[] $proxies` | Güvenilen ters vekil/CDN adresleri (IP ya da CIDR, ör. `10.0.0.0/8`); varsayılan değer Araçlar ekranındaki "Trusted proxy addresses" ayarıdır (`general.trusted_proxies`, varsayılan boş); süzgeç bu listeyi değiştirir. `X-Forwarded-For`/`X-Real-IP` YALNIZ doğrudan bağlanan adres bu listedeyse okunur (sağdan ilk güvenilmeyen adres). Eski `wdp_trust_proxy_headers` hâlâ çalışır. Hız sınırı bu IP'ye göre kovalanır (girişli kullanıcı kendi kimliğiyle). |
| `donation_panel_client_ip` | filtre | `string $ip, string $remote` | Hız sınırı için çözülen istemci IP'sini değiştirir. |
| `donation_panel_max_amount` | filtre | `float $max` | Bağışçının yazabileceği en büyük tutar (varsayılan 9.999.999); doğrulayıcı, ek bağış ve sepet fiyat çözücü aynı sınırı kullanır. |
| `donation_panel_lock_attempts` | filtre | `int $attempts` | Kampanya toplamı/bağışçı sayısı kilidi için deneme sayısı (varsayılan 10 x 50 ms). Kilit alınamazsa iş yine çalışır (bağış kaybı olmasın). |
| `donation_panel_totals_changed` | eylem | (parametre yok) | Kampanya toplamı/bağışçı sayısı, yerleşim ya da ek bağış görünürlüğü değişince (Domain, dış katmanı bu olayla bilgilendirir; bağış listesi önbelleği buna bağlıdır). |
| `donation_panel_cart_pending_total` | filtre | `float $total, int $product_id` | Sepetteki bekleyen bağış tutarı (Domain bu süzgeçle `Cart_Hooks`'a sormadan okur). |

**Eski anahtar bağdaştırıcısı:** `wdp_form_context` süzgeci ek bağış anahtarlarını eski adlarla (`sadaka_wc_product_id`, `sadaka_toggle_label`, `sadaka_min_price`, `sadaka_fixed_price`, `sadaka_donation_message`, `sadaka_is_fixed_price`, `sadaka_price_placeholder`, `enable_sadaka_donation`) görür ve değiştirebilir; iç kod `addon_*` kullanır (`src/Compat/class-legacy-context.php`). Eski sepet oturumundaki `donation_data.is_sadaka` işareti de okunur.

**Davranış notu (kapsam):** açık `id`/`slug`/`sku`'lu kısa kod, blok ve widget bağış kapsamı dışındaki ürün için artık çizilmez ve REST (`cart/add`, `form`, `experience`) bu ürünü reddeder. Kapsam `marked`/`categories` iken ürünün bağış olarak işaretlenmesi/kategoriye alınması gerekir. Ziyaretçi boş çıktı görür; `manage_woocommerce` yetkisi olan kullanıcı sayfada nedenini söyleyen ipucunu görür.

## Giriş noktaları modülü (`entry_points`, E1)

Modül slug'ı `entry_points` (varsayılan açık; `donation_panel_module_enabled` filtresi ya da `donation_panel_settings.modules.entry_points` ile kapanır). Kapalıyken yalnız otomatik yerleşim + yedek düğme + döngü/fiyat filtreleri durur; kısa kodlar, bloklar ve Elementor ince katmanı her zaman kayıtlıdır (sözleşme). Modülün kullandığı kancalar (hepsi **korunur**; yeni olarak `donation_panel_experience_html` Çekirdek tablosundadır):

| Ad | Tür | Parametreler | Sınıf |
|---|---|---|---|
| `wdp_resolve_product` | filtre | `WC_Product|null $product, array $atts, array $context` | `Product_Resolver::resolve` |
| `wdp_allow_multiple_entries` | filtre | `bool $allow, int $product_id` | `Shortcodes` (aynı üründe birden çok giriş) |
| `wdp_is_builder_preview` | filtre | `bool $is_preview` | `Builder_Detect` |
| `wdp_builder_preview_product` / `wdp_builder_preview_context_product` | filtre | `WC_Product|null` | `Builder_Detect` |

Kullanılan WooCommerce kancaları: `wc_get_template`, `woocommerce_locate_template`, `woocommerce_get_price_html`, `woocommerce_loop_add_to_cart_link`, `woocommerce_product_add_to_cart_text/url`, `woocommerce_product_supports`, `render_block_woocommerce/{add-to-cart-form,add-to-cart-with-options,product-price,product-button}`, `woocommerce_single_product_summary`, `woocommerce_after_single_product_summary`, `woocommerce_after_single_product` (yedek, öncelik 999), `wp_footer` (yedek, 4).

## Form deneyimleri modülü (`experiences`)

Tek deneyimdir (12.0.0'da `experiences.engine` ayarı ve eski motor kaldırıldı); modül koşulsuz açıktır. Eski kısa kodlar bu modülün formunu çizer.

Kısa kod: `[donation_panel_experience id="" kind="popup|side_panel|inline|bottom_sheet" button_text=""]`. `id` yoksa bulunduğu ürünü kendisi bulur (`Product_Resolver`).

REST (`donation-panel/v1`, kişi verisi döndürmez; tam uç listesi docs/MIMARI.md e):

| Uç | Yöntem | Yetki | Not |
|---|---|---|---|
| `/product/{id}/form` | GET | herkese açık, salt okunur, hız sınırı 60/dk | `{ product_id, model, html }`. Kimliksiz `/product/form` çağrısı 404 değil açık hata verir: `400 donation_panel_product_id_required`; bilinmeyen ürün `404 donation_panel_product_not_found`. |
| `/validate` | POST | WP REST nonce (`X-WP-Nonce`) + hız sınırı 30/dk | Gövde: `product_id, amount, donation_*`. Yanıt `{ valid, errors{alan:ileti}, amount }`; girilen değerler geri yazılmaz. |
| `/cart/add` | POST | herkese açık; JSON zorunlu (aksi 415); girişli kullanıcıda `X-WP-Nonce`; hız sınırı 20/dk | Gövde: `product_id, amount, donation_*, donation_type, submission_key`. Başarı `{ success, cart_item_key, cart_count, checkout_url, cart_url }` (`no-store`). Hata `400/409` `donation_panel_cart_rejected` + `data.errors{alan:ileti}`. Aynı `submission_key` ikinci kez sepete eklemez. |
| `/nonce` | GET | herkese açık, hız sınırı 30/dk | `{ nonce }`, `Cache-Control: no-store`; girişli kullanıcı kimliği oturum çerezinden okunur. Bayat nonce (403) alan istemci bunu çağırıp bir kez yeniden dener. |

Store API uzantısı (`extensions['donation-panel']`): sepet öğesinde kişi verisiz özet `{ is_donation, anonymous, has_dedication, has_note, type }`; `POST /wc/store/v1/cart/extensions` ile `namespace=donation-panel`, `data={ key, dedication?, note?, anonymous? }` yalnız bu üç alanı günceller. Sipariş kalemi meta anahtarları değişmez (`wdp_donor_name`, `wdp_donor_phone`, `wdp_donor_email`, `wdp_donation_note`, `wdp_dedication`, `wdp_anonymous`, `_custom_price`).

| Ad | Tür | Parametreler | Ne zaman |
|---|---|---|---|
| `donation_panel_amount_presets` | filtre | `float[] $presets, int $product_id` | Hızlı tutar seçenekleri (en çok 6). |
| `donation_panel_frequency_options` | filtre | `array $options [{value,label}], int $product_id` | Bağış türü (ör. tek seferlik/aylık); varsayılan boş = tür seçici çizilmez. |
| `donation_panel_form_fields` | filtre | `array $fields, array $legacy_context` | Alan tanımları; alan adları sipariş sözleşmesiyle aynı kalmalı (`donation_full_name, donation_phone, donation_email, donation_dedication, donation_note, donation_anonymous`). |
| `donation_panel_form_model` | filtre | `array $model, array $legacy_context` | Tüm form modeli (kişi verisi eklemeyin). |

Form modeli anahtarları (12.0.0 ui1; `donation_panel_form_model` ile değiştirilebilir): `image, subtitle, badge, brand, accent, privacy_url, phone{iso,dial,countries}, campaign{raised,goal,percent,donors,days_left,reached}` (`campaign` anahtarını Campaign modülü ekler). `brand`/`accent` (`#hex`) form üzerinde `--dp-color-primary`/`--dp-accent` olur. Tarayıcı olayları: `dp:added` (kök), `donation-panel:cart-added` (document). Veri öznitelikleri: `data-dp-title/steps/total-row/submit-label/addcart/trust/legal/dedi-toggle/note-toggle/dial`.

Şablonlar (tema `donation-panel/experiences/<ad>.php` ile geçersiz kılar): `form.php` (çekirdek; başlık ve kapat düğmesi burada, başlık kimliği `{dom_key}-title`), `popup.php`, `side-panel.php`, `inline.php`, `bottom-sheet.php`. Şablona `$args` = `model, container, dom_key, args, form_html` geçer.

Yeni modüller eklendikçe bu dosyaya modül başına bölüm eklenir (ad, tür, parametre, zaman, örnek).

## Kanca sırası notu (E2X)

Eklenti `plugins_loaded` öncelik 20'de başlar (ayrıntı: docs/MIMARI.md "Kanca sırası"). Kısa kodlar, `wdp_*`/`donation_panel_*` filtreleri ve eklenti sınıfları üzerinde çalışan snippet'ler `init` ya da sonrasında çalıştırılmalıdır; `plugins_loaded` 10'da yapılan çağrı fatal vermez, ancak kısa kod işlenmemiş etiket olarak kalır ve filtreler varsayılanını döndürür. Sözleşme kanıtı: `tests/unit/js/hook-order-contract.test.mjs`.

## Para birimi dönüşümü: `donation_panel_convert_amount` (CURCY3)

`apply_filters( 'donation_panel_convert_amount', float $amount, string $from, string $to, array $context ): float`

- Anlam: `$amount` tutarını `$from` para biriminden `$to` para birimine çevir (ISO kodları). Varsayılan: dönüşüm YOK, tutar aynen döner (Woo'nun etkin para birimi tek birimmiş gibi çalışır).
- Eski ad `wdp_convert_amount` aynı imza ve anlamla, yeni filtreden SONRA uygulanır (geriye dönük uyum). Bir snippet yalnız birine bağlanmalı, ikisine birden bağlanırsa çift dönüşüm olur.
- Çekirdek iki yönde çağırır: (1) kullanıcı para birimi -> mağaza ana birimi (`woocommerce_currency` ayarı): bağışçının seçili birimde yazdığı tutar (örn. 100 EUR) sepete ana birimde konur, çoklu para birimi eklentisi gösterirken geri çevirir ve sepet/ödeme/siparişte 100 EUR görünür; kampanya toplamı da (sipariş kuru yoksa) bu yönle çevrilir. (2) ana birim -> etkin birim: yalnız sepet satırı gösterimi için, dönüşümün tersi.
- `$context['context']`: `cart_line` | `cart_display`; ilerleme toplamında `$context['order']`.
- Kur yönü örneği (1 TRY = 0,02 EUR): `100 EUR -> TRY = 100 / 0,02 = 5000`; `5000 TRY -> EUR = 5000 * 0,02 = 100`. Genel formül: `ana = tutar / oran($from)`, `sonuç = ana * oran($to)` (oran: "1 ana birim = kaç birim").
- Ana birim her zaman WooCommerce ayarıdır (`get_option('woocommerce_currency')`); `get_woocommerce_currency()` ziyaretçinin gördüğü (etkin) birimdir.
- Yeni sepet satırı alanı: `wdp_input_currency` (tutarın yazıldığı birim; damgasız eski satırlar dönüşümsüz).
- Kur eklentisi köprüsü: `docs/site-snippets/curcy-bridge.php`.

## Yan sepet (`side_cart`, E4)

- **Kısa kod:** `[donation_panel_side_cart]` — sepet simgesi + kalem sayacı düğmesi (çekmeceyi açar). Öznitelik yok.
- **Ayar:** `modules.side_cart` (varsayılan kapalı) ya da `donation_panel_module_enabled` filtresi (`$slug === 'side_cart'`).
- **Filtre `donation_panel_side_cart_load`:** `apply_filters( 'donation_panel_side_cart_load', bool $load )` — çekmece ve varlıkları bu sayfada yüklensin mi (varsayılan: ön yüz, sepet/ödeme sayfaları hariç).
- **Filtre `donation_panel_side_cart_floating`:** `apply_filters( 'donation_panel_side_cart_floating', bool $enabled )` — yüzen yan sepet düğmesi bu istekte gösterilsin mi (varsayılan ayar `side_cart.floating`, açık; tema kendi sepet simgesini gösteriyorsa kapatılır).
- **Sabit `DONATION_PANEL_DISABLE`:** `define( 'DONATION_PANEL_DISABLE', true )` (wp-config.php) ön yüz isteklerinde bağışçı yüzeyini kapatır (çıktı, CSS/JS ve istek 0); sepet/sipariş kancaları sürer. Ayar karşılığı `general.disable_frontend`. **Filtre `donation_panel_front_disabled`:** `apply_filters( 'donation_panel_front_disabled', bool $off )` sabit/ayar sonucunu değiştirir (`Frontend\Front_Gate::disabled`).
- **REST:** `GET /wp-json/donation-panel/v1/side-cart` -> `{ count: int, subtotal: string(html), html: string(html) }`; `Cache-Control: no-store, private`; oturumdaki sepete özel.
- **Tarayıcı olayları (dinlenir, `document` üzerinde):** `wc-blocks_added_to_cart`, `donation-panel:cart-added` (sepet yenilenir + çekmece açılır); klasik `added_to_cart` (jQuery varsa). **Gönderilir:** `donation-panel:cart-updated` (`detail.count`) her yeniden çizimden sonra.
- **Filtre `donation_panel_side_cart_suggestion`:** `apply_filters( 'donation_panel_side_cart_suggestion', array $suggestion )` — ek bağış önerisi `[ 'product_id' => int, 'amounts' => float[], 'title' => string, 'hint' => string ]` (varsayılan boş = öneri yok; ürün yayımlanmamışsa ya da sepette zaten varsa gösterilmez).
- **REST:** `POST /wp-json/donation-panel/v1/side-cart/suggestion` — öneri ürünü/tutar sunucu önerisinden doğrulanır, bağışçı bilgisi sepetteki satırdan alınır.
- **WooCommerce parçası:** `woocommerce_add_to_cart_fragments` ile `span.donation-panel-sc__count` sayaç rozeti.
- **DOM işaretleri (kararlı):** `[data-dp-sc-open]` (tetikleyici), `[data-dp-sc-count]`, `[data-dp-sc-go]` (ödemeye git bağlantısı), `.donation-panel-sc__*` sınıfları.

## Kampanya, etki ifadeleri, sosyal kanıt (E3)

Filtreler:
- `donation_panel_milestones( array $milestones, int $product_id )` — `[ [ 'at' => float(1-100), 'label' => string ], ... ]`.
- `donation_panel_impact_map( array $tiers, int $product_id )` — `[ [ 'unit' => float, 'one' => string, 'other' => string ], ... ]` (`{count}` adet yer tutucusu).
- `donation_panel_social_proof_entry( array $entry, object $order )` — `[ 'name', 'amount', 'timestamp' ]`; kişi verisi (e-posta, telefon, not) EKLENMEZ.

- `donation_panel_campaign_days_left( int|null $days, int $product_id )` — kampanyanın kalan gün sayısı (varsayılan `null`; doluysa form üstü kampanya bloğunda "N gün kaldı" gösterilir).

Veri anahtarları: ürün meta `_donation_panel_milestones` (satır `yüzde=etiket`), `_donation_panel_impact` (satır `birim=tekil|çoğul`); site ayarı `impact.map`; ad izni meta `wdp_public_name` ARTIK OKUNMAZ (K3: sosyal kanıtta kişi bilgisi yok; ad hiçbir koşulda gösterilmez, yalnız tutar ve zaman döner).

Kısa kodlar (yeni): `[donation_panel_progress]`, `[donation_panel_social_proof]`. REST (`donation-panel/v1`): `GET /progress/{id}`, `GET /impact/{id}`, `GET /donations`, `GET /donations/stats` (hepsi salt okunur, kişi verisiz).

## Teşekkür ve vergi indirimi beyanı (E6)

Modüller: `thanks` ve `tax_relief` (ikisi de varsayılan kapalı; `donation_panel_module_enabled` ya da `donation_panel_settings.modules.*`).

| Ad | Tür | Parametreler | Ne zaman |
|---|---|---|---|
| `donation_panel_tax_relief_texts` | filtre | `array $texts {step_label,title,text,checkbox_label}` | Beyan metinleri (ayar boşsa genel varsayılan üzerinde). Metin değişirse yeni siparişlerin `_wdp_tax_relief_text_hash` değeri değişir. |

Kullanılan: `donation_panel_form_steps` (adım ekler), `donation_panel_form_step_tax_relief` (adım içeriği), `donation_panel_form_model` değişmez. WooCommerce kancaları: `woocommerce_before_thankyou`, `woocommerce_add_cart_item_data`, `woocommerce_get_item_data`, `woocommerce_checkout_create_order_line_item`, `woocommerce_admin_order_data_after_billing_address`; WordPress: `rest_request_before_callbacks`.

Yeni sipariş meta (sipariş ve sipariş kalemi): `_wdp_tax_relief_declared` (`yes`; yalnız onay işaretliyse), `_wdp_tax_relief_text_hash` (SHA-256). Sepet öğesi anahtarı: `donation_panel_tax_relief`. Şablonlar (tema geçersiz kılar): `donation-panel/thanks/summary.php`, `donation-panel/tax-relief/step.php`.

## Bağış türleri ve adımlar (E2C)

Yeni kancalar (varsayılan: davranış değişmez):

| Ad | Tür | Parametreler | Ne zaman |
|---|---|---|---|
| `donation_panel_form_steps` | filtre | `array $steps [{id,label}], int $product_id` | Form adımları (varsayılan `amount`, `details`). Ek adım (ör. vergi indirimi) eklenir; `amount` ve `details` kaldırılamaz (kaldırılırsa varsayılana dönülür). |
| `donation_panel_form_step_{id}` | eylem | `array $model` | Ek adımın içeriğini basar (kişi verisi basmayın; alan adları sipariş sözleşmesine uymalı). |

Form modeline eklenen anahtarlar (`donation_panel_form_model` filtresiyle değiştirilebilir): `kind` (`fixed|custom|shares|campaign`), `unit_price`, `quantity`, `cover_fee`, `addon`, `steps`, `shareholder`.

`POST /donation-panel/v1/cart/add` gövdesine eklenen alanlar: `quantity` (sabit tutar), `share_count` + `shareholders` (`[{name,phone,email?,note?}]`, hisseli), `donation_cover_fee` (`1`; yüzde sunucudan), `addon_active` + `addon_amount` (ek bağış). Hata anahtarları: `quantity`, `share_count`, `shareholder_{n}_{name|phone|email|note}`, `addon_amount`.

Sipariş kalemi meta (yeni): `wdp_donation_type` (`fixed|custom|shares|campaign`), `wdp_donation_frequency` (düzenli bağış seçeneği). Store API uzantısına `kind` eklendi (kişi verisiz).

## Bağışçı Hesabı (`donor_account`, E5)

- **Kısa kod:** `[donation_panel_account]` — header kişi simgesi (oturum yoksa giriş penceresini açar; oturum varsa Hesabım bağlantısı). Öznitelik yok. **Blok:** `donation-panel/account` (aynı çıktı).
- **Ayar:** `modules.donor_account` (varsayılan kapalı) ya da `donation_panel_module_enabled` filtresi (`$slug === 'donor_account'`). Kayıt formu WooCommerce ayarına bağlıdır: `woocommerce_enable_myaccount_registration`.
- **Filtre `donation_panel_account_endpoint`:** `apply_filters( 'donation_panel_account_endpoint', string $endpoint )` — Hesabım içindeki Bağışlarım uç noktası adı (varsayılan `my-donations`).
- **Filtre `donation_panel_account_rate_limit`:** `apply_filters( 'donation_panel_account_rate_limit', int $limit, string $bucket )` — uç başına dakika/pencere sınırı (`account_session|login|register|reset|donations|link_guest|link_confirm`).
- **Filtre `donation_panel_donation_video_url`:** `apply_filters( 'donation_panel_donation_video_url', string $url, object $order )` — Bağışlarım'daki "Video" bağlantısı (varsayılan sipariş meta `_donation_panel_video_url`; yoksa düğme çizilmez; yalnız `http(s)://`).
- **Eylem `donation_panel_guest_orders_linked`:** `do_action( 'donation_panel_guest_orders_linked', int $user_id, int $linked )` — doğrulanmış bağlamadan sonra (kişi verisi taşımaz).
- **REST (`/wp-json/donation-panel/v1/account/...`):** `GET session` `{logged_in, registration, nonce}`; `POST login` `{email, password, remember}` → `{ok, nonce}`; `POST register` `{email, password}` → `{ok}` (e-posta var/yok için aynı); `POST reset` `{email}` → `{ok}` (her durumda aynı); `GET donations?page&per_page` (oturum) → `{rows, html, total, pages, page}`; `POST repeat` (oturum; kendi siparişindeki bağışı aynı tutarla sepete ekler, başarısızsa ürün sayfasına yönlendirir); `POST link-guest` (oturum) → `{ok}`; `POST link-guest/confirm` `{token}` (oturum) → `{linked}`. Yazma uçları `X-WP-Nonce` (wp_rest) ister; yanıtlar `no-store, private`. Hata kodları: `donation_panel_bad_nonce` 403, `donation_panel_rate_limited` 429, `donation_panel_login_failed` 401, `donation_panel_invalid_email|weak_password` 400, `donation_panel_registration_disabled` 403, `donation_panel_link_invalid` 400.
- **WooCommerce kancaları (standart):** `woocommerce_get_query_vars`, `woocommerce_account_menu_items`, `woocommerce_endpoint_{endpoint}_title`, `woocommerce_account_{endpoint}_endpoint`, `woocommerce_before_checkout_registration_form`, `woocommerce_reset_password_notification` (tetiklenir).
- **DOM işaretleri (kararlı):** `[data-dp-acc-open]` (tetikleyici), `[data-dp-acc]` (pencere), `[data-dp-acc-form="login|register|reset"]`, `[data-dp-acc-page]`, `[data-dp-acc-card]`, `[data-dp-acc-link]`, `.donation-panel-ac__*` sınıfları.

## Ödeme sayfası otomatik doldurma (`Checkout_Prefill`)

Yeni kanca yok. WooCommerce kancaları: `woocommerce_add_to_cart` (30) ve `template_redirect` (20; yalnız `is_checkout()`, order-received hariç). Oturum müşterisinin BOŞ fatura alanları (ad/soyad, telefon, e-posta) sepetteki en son bağışın verisinden doldurulur; dolu alana dokunulmaz. Ayrıntı: docs/MIMARI.md h-6.

## REST uçları (12-int2 eklemeleri)

| Uç | Yöntem | Yetki | Not |
|---|---|---|---|
| `donation-panel/v1/experience/{id}?kind=popup\|side_panel\|bottom_sheet` | GET | herkese açık (salt okunur) | Liste/döngü kartı için form kabı + form HTML'i (`src/Modules/EntryPoints/class-experience-controller.php`). Hız sınırı 60/dk, `Cache-Control: no-store`; gizli/taslak/bağış olmayan ürün 404. Yanıttaki nonce'lar taze. |
| `donation-panel/v1/admin/campaigns/{id}/recalc/preview` | POST | `manage_woocommerce` + `X-WP-Nonce` | Kampanya toplamı önizlemesi (saklanan/hesaplanan/fark/sipariş sayısı); hiçbir şey yazmaz. 20/dk. |
| `donation-panel/v1/admin/campaigns/{id}/recalc` | POST | `manage_woocommerce` + `X-WP-Nonce` | Önizlemedeki tutarı `expected` olarak gönderir; arada değiştiyse 409, bitiş tarihi geçmişteyse red. Her yazma `_wdp_totals_log` meta günlüğüne. 10/dk. |
| `donation-panel/v1/admin/campaigns/{id}/carried` | POST | `manage_woocommerce` + `X-WP-Nonce` | Devreden tutarı (`_wdp_carried_amount`) düzenler. 30/dk. |

Notlar: `[wdp_donations]` kısa kodu/bloğu yeni `title` özniteliğini alır (varsayılan boş). `wdp_donations_card_html` süzgeci korunur; `donation_panel_campaign_days_left` liste kartı rozetinde de kullanılır. Kaldırılan eylem: cron `wdp_recalculate_product_donation_total` (dışarıdan zamanlanmışsa işlevsiz kalır). WP-CLI `wp donation-panel recalc-totals` yalnız kuru çalıştırmadır.

## 12.1 güvenlik notları
- **Meta:** `_donation_panel_direct_owner` (doğrudan bağış siparişinin sahip belirteci, tuzlu karma). **Transient:** `donation_panel_direct_site_qty` (30 sn bekleyen adet sayacı).
- **`Rate_Limiter::hit()` 4. parametre** `$donation_bucket` (varsayılan `false` = katı). Üçüncü taraf kodu bu sınıfı çağırmamalıdır; ayar için `donation_panel_trusted_proxies` süzgeci ve Araçlar → "Ziyaretçi adresi" kullanılır.
- **REST:** `/nonce` ve `/account/session` cross-site isteklere 403 döner (CORS başlıksız).

## 12.1.1 notları
- `donation_panel_cart_pending_total` yalnız sepete ekleme kapısında etkilidir; görünümde (kampanya "ulaşıldı" iletisi, döngü fiyat süzgeçleri) bekleyen toplam sayılmaz.
- `donation_panel_side_cart_load` aynı kalır.
