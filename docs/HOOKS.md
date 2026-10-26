# Donation Panel for WooCommerce — Kanca ve Genel API Başvurusu

Önek kuralı: yeni API `donation_panel_` ile başlar (gerekçe: docs/MIMARI-FAZ7.md §8). Eski `wdp_*` adları dışa açık sözleşmedir, DEĞİŞMEZ ve aşağıda "Eski sözleşme" altında listelenir. Sözleşme testi: `tests/unit/Core/E0PublicApiContractTest.php`.

## Çekirdek (yeni)

| Ad | Tür | Parametreler | Ne zaman |
|---|---|---|---|
| `donation_panel_module_enabled` | filtre | `bool $enabled, string $slug` | Modülün açık/kapalı kararı; kapalı modülün dosyası yüklenmez. |
| `donation_panel_modules_booted` | eylem | `string[] $active_slugs` | Etkin modüller başlatıldıktan sonra. |
| `donation_panel_rest_controllers` | filtre | `array $controllers` | REST denetleyici listesi (ad alanı `donation-panel/v1`). |
| `donation_panel_admin_ui` | filtre | `string $ui` (`legacy`\|`new`) | Yönetici ekranı seçimi (ayar `admin.ui` ya da `DONATION_PANEL_ADMIN_UI` sabiti üstüne); `new` iken `src/Admin` yüklenir (E7). |
| `donation_panel_template_theme_folder` | filtre | `string $folder` | Tema geçersiz kılma klasörü (varsayılan `donation-panel`). |
| `donation_panel_campaign_period` | filtre | `array $period, int $product_id` | Kampanya toplamının sipariş tarih aralığı (başlangıç/bitiş); varsayılan ürün meta `_wdp_campaign_starts_at` / `_wdp_campaign_ends_at`. |
| `donation_panel_located_template` | filtre | `string $path, string $name` | Bulunan şablon yolu. |
| `donation_panel_before_template` / `donation_panel_after_template` | eylem | `string $name, string $file, array $args` | Şablon çıktısının öncesi/sonrası. |

Şablon geçersiz kılma: tema içinde `donation-panel/<ad>.php`.
Ayarlar: `donation_panel_settings` seçeneği (şemalı, sürümlü; yalnız `DonationPanel\Core\Settings` ile okunur/yazılır). Göç: `donation_panel_migrations` durum seçeneği; eski `wdp_*` seçenekleri okunur, silinmez.

## Eski sözleşme (adları değişmez)

Kısa kodlar: `[wdp_donation_button]`, `[wdp_donation_button_panel]` (`id`), `[wdp_donation_form]`, `[wdp_donations]`. Öznitelikler: `id, slug, sku, text, button_text, class, title, show_title`.
Bloklar: `wdp/donation-form`, `wdp/donations`.
AJAX (ön yüz, giriş yapmış/yapmamış): `wdp_ajax_add_to_cart, wdp_get_cart_contents, wdp_get_cart_count, wdp_get_fresh_nonces, wdp_get_product_info, wdp_get_product_name, wdp_remove_cart_item, wdp_render_modal, wdp_verify_submission_in_cart`.
Meta: sipariş kalemi `wdp_donor_name, wdp_donor_phone, wdp_donor_email, wdp_donation_note`; ürün `_enable_sadaka_donation, _sadaka_min_price` (okuma yedeği) ve `_enable_addon_donation, _addon_min_price`; sepet `wdp_sadaka_donation, wdp_sadaka_linked_wc_product`.
Filtre/eylemler (46): `wdp_allow_multiple_entries, wdp_amount_presets, wdp_builder_preview_context_product, wdp_builder_preview_product, wdp_campaign_media_url, wdp_client_context, wdp_convert_amount, wdp_defer_frontend_assets, wdp_defer_frontend_styles, wdp_donations_card_html, wdp_donations_query_args, wdp_enable_side_cart_recovery, wdp_field_hint_{email,name,note,phone}, wdp_form_context, wdp_impact_line, wdp_is_builder_preview, wdp_is_donation_product, wdp_lazy_idle_prefetch, wdp_min_donation_amount, wdp_modal_product_thumb_{alt,url}, wdp_order_exchange_rate, wdp_phone_{countries,default_country,excluded_countries,national_length_rules}, wdp_progress_{convert_amount,live_rate,paid_statuses}, wdp_rate_limit_ip_max, wdp_reload_after_add_to_cart, wdp_resolve_product, wdp_sadaka_{cart_thumbnail_size,line_product_ids,price_label,toggle_label,wc_product_id}, wdp_should_enqueue_assets, wdp_show_amount_presets, wdp_split_client_data, wdp_supported_product_types, wdp_trust_proxy_headers, wdp_use_js_bundle`.

Kaldırılanlar (K56; sözleşmeden çıktı): `wdp_meta_pixel_has_consent`, `wdp_meta_woocommerce_purchase_integration_active` (Meta Pixel), `wdp_product_schema` (JSON-LD şeması). Yeni (K8): `wdp_convert_amount` (tutar dönüşümü; varsayılan dönüşüm yok, Woo'nun etkin para birimi). Para birimi bağdaştırıcıları (Curcy/WOOCS/WPML) çekirdekte yoktur; Curcy için `docs/site-snippets/`.

## Giriş noktaları modülü (`entry_points`, E1)

Modül slug'ı `entry_points` (varsayılan açık; `donation_panel_module_enabled` filtresi ya da `donation_panel_settings.modules.entry_points` ile kapanır). Kapalıyken yalnız otomatik yerleşim + yedek düğme + döngü/fiyat filtreleri durur; kısa kodlar, bloklar ve Elementor ince katmanı her zaman kayıtlıdır (sözleşme). Yeni (`donation_panel_`) kanca eklenmedi; modülün kullandığı eski sözleşme kancaları:

| Ad | Tür | Parametreler | Sınıf |
|---|---|---|---|
| `wdp_resolve_product` | filtre | `WC_Product|null $product, array $atts, array $context` | `Product_Resolver::resolve` |
| `wdp_allow_multiple_entries` | filtre | `bool $allow, int $product_id` | `Shortcodes` (aynı üründe birden çok giriş) |
| `wdp_is_builder_preview` | filtre | `bool $is_preview` | `Builder_Detect` |
| `wdp_builder_preview_product` / `wdp_builder_preview_context_product` | filtre | `WC_Product|null` | `Builder_Detect` |

Kullanılan WooCommerce kancaları: `wc_get_template`, `woocommerce_locate_template`, `woocommerce_get_price_html`, `woocommerce_loop_add_to_cart_link`, `woocommerce_product_add_to_cart_text/url`, `woocommerce_product_supports`, `render_block_woocommerce/{add-to-cart-form,add-to-cart-with-options,product-price,product-button}`, `woocommerce_single_product_summary`, `woocommerce_after_single_product_summary`, `woocommerce_after_single_product` (yedek, öncelik 999), `wp_footer` (yedek, 4).

## Form deneyimleri modülü (`experiences`, E2A)

Ayar `donation_panel_settings.experiences.engine` = `legacy` (varsayılan; davranış birebir eski, modülün hiçbir dosyası yüklenmez) | `new`. `new` iken `experiences` modülü açılır (modül ayarı `modules.experiences` açıkça verilmişse o kazanır).

Yeni kısa kod (eski kısa kodlar DEĞİŞMEZ): `[donation_panel_experience id="" kind="popup|side_panel|inline|bottom_sheet" button_text=""]`. `id` yoksa bulunduğu ürünü kendisi bulur (`Product_Resolver`).

REST (`donation-panel/v1`, kişi verisi döndürmez):

| Uç | Yöntem | Yetki | Not |
|---|---|---|---|
| `/product/{id}/form` | GET | herkese açık, salt okunur, hız sınırı 60/dk | `{ product_id, model, html }`. Kimliksiz `/product/form` çağrısı 404 değil açık hata verir: `400 donation_panel_product_id_required`; bilinmeyen ürün `404 donation_panel_product_not_found`. |
| `/validate` | POST | WP REST nonce (`X-WP-Nonce`) + hız sınırı 30/dk | Gövde: `product_id, amount, donation_*`. Yanıt `{ valid, errors{alan:ileti}, amount }`; girilen değerler geri yazılmaz. |
| `/cart/add` | POST | herkese açık; JSON zorunlu (aksi 415); girişli kullanıcıda `X-WP-Nonce`; hız sınırı 20/dk | Gövde: `product_id, amount, donation_*, donation_type, submission_key`. Başarı `{ success, cart_item_key, cart_count, checkout_url, cart_url }` (`no-store`). Hata `400/409` `donation_panel_cart_rejected` + `data.errors{alan:ileti}`. Aynı `submission_key` ikinci kez sepete eklemez. |
| `/nonce` | GET | herkese açık, hız sınırı 30/dk | `{ nonce }`, `Cache-Control: no-store`; girişli kullanıcı kimliği oturum çerezinden okunur. Bayat nonce (403) alan istemci bunu çağırıp bir kez yeniden dener. |

Store API uzantısı (`extensions['donation-panel']`, yalnız `new` motor): sepet öğesinde kişi verisiz özet `{ is_donation, anonymous, has_dedication, has_note, type }`; `POST /wc/store/v1/cart/extensions` ile `namespace=donation-panel`, `data={ key, dedication?, note?, anonymous? }` yalnız bu üç alanı günceller. Sipariş kalemi meta anahtarları değişmez (`wdp_donor_name`, `wdp_donor_phone`, `wdp_donor_email`, `wdp_donation_note`, `wdp_dedication`, `wdp_anonymous`, `_custom_price`).

| Ad | Tür | Parametreler | Ne zaman |
|---|---|---|---|
| `donation_panel_amount_presets` | filtre | `float[] $presets, int $product_id` | Hızlı tutar seçenekleri (en çok 6). |
| `donation_panel_frequency_options` | filtre | `array $options [{value,label}], int $product_id` | Bağış türü (ör. tek seferlik/aylık); varsayılan boş = tür seçici çizilmez. |
| `donation_panel_form_fields` | filtre | `array $fields, array $legacy_context` | Alan tanımları; alan adları sipariş sözleşmesiyle aynı kalmalı (`donation_full_name, donation_phone, donation_email, donation_dedication, donation_note, donation_anonymous`). |
| `donation_panel_form_model` | filtre | `array $model, array $legacy_context` | Tüm form modeli (kişi verisi eklemeyin). |

Şablonlar (tema `donation-panel/experiences/<ad>.php` ile geçersiz kılar): `form.php` (çekirdek), `popup.php`, `side-panel.php`, `inline.php`, `bottom-sheet.php`. Şablona `$args` = `model, container, dom_key, args, form_html` geçer.

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
- **REST:** `GET /wp-json/donation-panel/v1/side-cart` -> `{ count: int, subtotal: string(html), html: string(html) }`; `Cache-Control: no-store, private`; oturumdaki sepete özel.
- **Tarayıcı olayları (dinlenir, `document` üzerinde):** `wc-blocks_added_to_cart`, `donation-panel:cart-added` (sepet yenilenir + çekmece açılır); klasik `added_to_cart` (jQuery varsa). **Gönderilir:** `donation-panel:cart-updated` (`detail.count`) her yeniden çizimden sonra.
- **WooCommerce parçası:** `woocommerce_add_to_cart_fragments` ile `span.dp-sc__count` sayaç rozeti.
- **DOM işaretleri (kararlı):** `[data-dp-sc-open]` (tetikleyici), `[data-dp-sc-count]`, `[data-dp-sc-go]` (ödemeye git bağlantısı), `.dp-sc__*` sınıfları.

## Kampanya, etki ifadeleri, sosyal kanıt (E3)

Filtreler:
- `donation_panel_milestones( array $milestones, int $product_id )` — `[ [ 'at' => float(1-100), 'label' => string ], ... ]`.
- `donation_panel_impact_map( array $tiers, int $product_id )` — `[ [ 'unit' => float, 'one' => string, 'other' => string ], ... ]` (`{count}` adet yer tutucusu).
- `donation_panel_social_proof_entry( array $entry, object $order )` — `[ 'name', 'amount', 'timestamp' ]`; kişi verisi (e-posta, telefon, not) EKLENMEZ.

Veri anahtarları: ürün meta `_donation_panel_milestones` (satır `yüzde=etiket`), `_donation_panel_impact` (satır `birim=tekil|çoğul`); site ayarı `impact.map`; ad izni meta `wdp_public_name` = `yes` (sipariş ya da satır).

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
- **Eylem `donation_panel_guest_orders_linked`:** `do_action( 'donation_panel_guest_orders_linked', int $user_id, int $linked )` — doğrulanmış bağlamadan sonra (kişi verisi taşımaz).
- **REST (`/wp-json/donation-panel/v1/account/...`):** `GET session` `{logged_in, registration, nonce}`; `POST login` `{email, password, remember}` → `{ok, nonce}`; `POST register` `{email, password}` → `{ok}` (e-posta var/yok için aynı); `POST reset` `{email}` → `{ok}` (her durumda aynı); `GET donations?page&per_page` (oturum) → `{rows, html, total, pages, page}`; `POST link-guest` (oturum) → `{ok}`; `POST link-guest/confirm` `{token}` (oturum) → `{linked}`. Yazma uçları `X-WP-Nonce` (wp_rest) ister; yanıtlar `no-store, private`. Hata kodları: `donation_panel_bad_nonce` 403, `donation_panel_rate_limited` 429, `donation_panel_login_failed` 401, `donation_panel_invalid_email|weak_password` 400, `donation_panel_registration_disabled` 403, `donation_panel_link_invalid` 400.
- **WooCommerce kancaları (standart):** `woocommerce_get_query_vars`, `woocommerce_account_menu_items`, `woocommerce_endpoint_{endpoint}_title`, `woocommerce_account_{endpoint}_endpoint`, `woocommerce_before_checkout_registration_form`, `woocommerce_reset_password_notification` (tetiklenir).
- **DOM işaretleri (kararlı):** `[data-dp-acc-open]` (tetikleyici), `[data-dp-acc]` (pencere), `[data-dp-acc-form="login|register|reset"]`, `[data-dp-acc-page]`, `[data-dp-acc-card]`, `[data-dp-acc-link]`, `.dp-ac__*` sınıfları.

## E8D — modal nonce ve REST

| Ad | Tür | Açıklama |
|---|---|---|
| `wdp_render_modal_require_nonce` | filtre (bool, varsayılan `true`) | `wdp_render_modal` AJAX isteğinde nonce zorunluluğu. İstemci 403 (`code: nonce`) alınca yeni nonce ile bir kez yeniden dener. |
| `GET donation-panel/v1/modal` | REST (herkese açık, salt okunur) | Nonce'suz modal içeriği; yalnız görünür ürün, istek sınırı ve girdi temizleme ile korunur. |
