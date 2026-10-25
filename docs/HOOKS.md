# Donation Panel for WooCommerce — Kanca ve Genel API Başvurusu

Önek kuralı: yeni API `donation_panel_` ile başlar (gerekçe: docs/MIMARI-FAZ7.md §8). Eski `wdp_*` adları dışa açık sözleşmedir, DEĞİŞMEZ ve aşağıda "Eski sözleşme" altında listelenir. Sözleşme testi: `tests/unit/Core/E0PublicApiContractTest.php`.

## Çekirdek (yeni)

| Ad | Tür | Parametreler | Ne zaman |
|---|---|---|---|
| `donation_panel_module_enabled` | filtre | `bool $enabled, string $slug` | Modülün açık/kapalı kararı; kapalı modülün dosyası yüklenmez. |
| `donation_panel_modules_booted` | eylem | `string[] $active_slugs` | Etkin modüller başlatıldıktan sonra. |
| `donation_panel_rest_controllers` | filtre | `array $controllers` | REST denetleyici listesi (ad alanı `donation-panel/v1`). |
| `donation_panel_template_theme_folder` | filtre | `string $folder` | Tema geçersiz kılma klasörü (varsayılan `donation-panel`). |
| `donation_panel_located_template` | filtre | `string $path, string $name` | Bulunan şablon yolu. |
| `donation_panel_before_template` / `donation_panel_after_template` | eylem | `string $name, string $file, array $args` | Şablon çıktısının öncesi/sonrası. |

Şablon geçersiz kılma: tema içinde `donation-panel/<ad>.php`.
Ayarlar: `donation_panel_settings` seçeneği (şemalı, sürümlü; yalnız `DonationPanel\Core\Settings` ile okunur/yazılır). Göç: `donation_panel_migrations` durum seçeneği; eski `wdp_*` seçenekleri okunur, silinmez.

## Eski sözleşme (adları değişmez)

Kısa kodlar: `[wdp_donation_button]`, `[wdp_donation_button_panel]` (`id`), `[wdp_donation_form]`, `[wdp_donations]`. Öznitelikler: `id, slug, sku, text, button_text, class, title, show_title`.
Bloklar: `wdp/donation-form`, `wdp/donations`.
AJAX (ön yüz, giriş yapmış/yapmamış): `wdp_ajax_add_to_cart, wdp_get_cart_contents, wdp_get_cart_count, wdp_get_fresh_nonces, wdp_get_product_info, wdp_get_product_name, wdp_remove_cart_item, wdp_render_modal, wdp_verify_submission_in_cart`.
Meta: sipariş kalemi `wdp_donor_name, wdp_donor_phone, wdp_donor_email, wdp_donation_note`; ürün `_enable_sadaka_donation, _sadaka_min_price` (okuma yedeği) ve `_enable_addon_donation, _addon_min_price`; sepet `wdp_sadaka_donation, wdp_sadaka_linked_wc_product`.
Filtre/eylemler (43): `wdp_allow_multiple_entries, wdp_amount_presets, wdp_builder_preview_context_product, wdp_builder_preview_product, wdp_campaign_media_url, wdp_client_context, wdp_convert_amount, wdp_donations_card_html, wdp_donations_query_args, wdp_enable_side_cart_recovery, wdp_field_hint_{email,name,note,phone}, wdp_form_context, wdp_impact_line, wdp_is_builder_preview, wdp_is_donation_product, wdp_lazy_idle_prefetch, wdp_min_donation_amount, wdp_modal_product_thumb_{alt,url}, wdp_order_exchange_rate, wdp_phone_{countries,default_country,excluded_countries,national_length_rules}, wdp_progress_{convert_amount,live_rate,paid_statuses}, wdp_rate_limit_ip_max, wdp_reload_after_add_to_cart, wdp_resolve_product, wdp_sadaka_{cart_thumbnail_size,line_product_ids,price_label,toggle_label,wc_product_id}, wdp_should_enqueue_assets, wdp_show_amount_presets, wdp_supported_product_types, wdp_trust_proxy_headers, wdp_use_js_bundle`.

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
