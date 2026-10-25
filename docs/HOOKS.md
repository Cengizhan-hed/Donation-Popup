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
Filtre/eylemler (45): `wdp_allow_multiple_entries, wdp_amount_presets, wdp_builder_preview_context_product, wdp_builder_preview_product, wdp_campaign_media_url, wdp_client_context, wdp_donations_card_html, wdp_donations_query_args, wdp_enable_side_cart_recovery, wdp_field_hint_{email,name,note,phone}, wdp_form_context, wdp_impact_line, wdp_is_builder_preview, wdp_is_donation_product, wdp_lazy_idle_prefetch, wdp_meta_pixel_has_consent, wdp_meta_woocommerce_purchase_integration_active, wdp_min_donation_amount, wdp_modal_product_thumb_{alt,url}, wdp_order_exchange_rate, wdp_phone_{countries,default_country,excluded_countries,national_length_rules}, wdp_product_schema, wdp_progress_{convert_amount,live_rate,paid_statuses}, wdp_rate_limit_ip_max, wdp_reload_after_add_to_cart, wdp_resolve_product, wdp_sadaka_{cart_thumbnail_size,line_product_ids,price_label,toggle_label,wc_product_id}, wdp_should_enqueue_assets, wdp_show_amount_presets, wdp_supported_product_types, wdp_trust_proxy_headers, wdp_use_js_bundle`.

Yeni modüller eklendikçe bu dosyaya modül başına bölüm eklenir (ad, tür, parametre, zaman, örnek).
