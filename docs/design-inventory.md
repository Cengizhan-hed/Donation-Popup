# Stage 2C FAZ 0 — Form tasarım sistemi envanteri

**Plugin:** WooCommerce Donation Panel · **Kaynak sürüm:** 10.27.1 · **Hedef:** 10.28.0  
**Dal:** `stage-2c-form-design`  
**Amaç:** Sonraki fazların ve `WDP_Migrations` 10.28.0 adımının tek kaynağı. Dağıtıma girmez.

---

## Appendix — Build / inline / sekmeler / migrations

### CSS stack (`includes/config/frontend-css-stack.php` → `tools/build-css-bundle.php`)

| # | Path |
|---|------|
| 1 | `src/foundation/tokens.css` |
| 2 | `src/foundation/polish.css` |
| 3 | `src/foundation/base.css` |
| 4 | `src/foundation/layout.css` |
| 5 | `src/forms/shared.css` |
| 6 | `src/forms/field-stack.css` |
| 7 | `src/forms/container-queries.css` |
| 8 | `src/components/phone-field.css` |
| 9 | `src/forms/hisseli.css` |
| 10 | `src/components/quantity.css` |
| 11 | `src/components/amount-presets.css` |
| 12 | `src/components/buttons.css` |
| 13 | `src/components/loading.css` |
| 14 | `src/components/wizard.css` |
| 15 | `src/components/progress-bar.css` |
| 16 | `src/components/success.css` |
| 17 | `src/components/toast.css` |
| 18 | `src/components/side-panel.css` |
| 19 | `src/components/motion.css` |
| 20 | `src/components/feedback.css` |
| 21 | `src/components/accessibility.css` |
| 22 | `src/components/product-note.css` |
| 23 | `src/components/sadaka-donation.css` |
| 24 | `src/components/ux-enhancements.css` |
| 25 | `src/components/campaign-modules.css` |
| 26 | `src/components/mobile-polish.css` |
| 27 | `src/overrides/theme-isolation-overrides.css` |

### Inline styles (`trait-wdp-assets-inline-styles.php`)

Şu an ~60 KB satır içi CSS üretir: `:root` + `.hdf-donation-modal-wrapper` değişkenleri, buton gölge derleyicileri, cam/glass zorlamaları, mobil remaps, kritik modal CSS.  
**2C hedefi:** yalnızca `.wdp-root` / ürün kapsayıcısında token tanımları (~1 KB).

### Mevcut admin sekmeleri → 2C

| Şimdi | 2C |
|-------|-----|
| Ürünler | Ürünler |
| Ürün sayfası ve liste | Ürün sayfası ve liste |
| Tasarım + Modal + Normal + Hisseli + Progress + Başarı (görsel) + Kategoriler | **Görünüm** |
| Modal/Normal/Hisseli/Progress/Başarı (metin/davranış) | **Formlar ve metinler** |
| Meta Pixel | **Entegrasyonlar** |
| Gelişmiş | **Gelişmiş** |

### Migrations

| Item | Değer |
|------|--------|
| Option | `wdp_db_version` |
| Mevcut adım | `10.27.0` → `step_10_27_0` (FAQ silme, placement) |
| 2C eklenecek | `10.28.0` → yedek + token eşlemesi + ölü anahtar silme |

---

## (a) CSS kaynak dosyaları

| Dosya | Ne işe yarar | Patch? | 2C kararı |
|-------|--------------|--------|-----------|
| `foundation/tokens.css` | Marka, cam, tipografi, gölge, yoğunluk jetonları | Hayır | **yeniden yazılacak** — FAZ 2 token seti |
| `foundation/polish.css` | Kapat, başlık, info strip yamaları | Kısmen | **silinecek** — içerik shell/components’e |
| `foundation/base.css` | Modal/form reset + tipografi | Hayır | **yeniden yazılacak** → `reset-scope.css` + `base.css` |
| `foundation/layout.css` | Cam kabuk, masaüstü kart, mobil sheet, sticky CTA | Kısmen | **yeniden yazılacak** → `shells/*` |
| `forms/shared.css` | Ortak alan/etiket/grup | Hayır | **yeniden yazılacak** → `components/field.css` vb. |
| `forms/field-stack.css` | Dikey alan yığını + hata | Hayır | **yeniden yazılacak** → `components/field.css` |
| `forms/container-queries.css` | CQ form düzeni | Hayır | **taşınacak** — 2B sistemi shells/inline’a |
| `forms/hisseli.css` | Hisse kartları | Kısmen | **yeniden yazılacak** → `components/shares.css` |
| `components/phone-field.css` | Ülke telefon UI | Hayır | **yeniden yazılacak** → `components/phone.css` |
| `components/quantity.css` | Adet stepper (ağır) | Hayır | **yeniden yazılacak** → `components/stepper.css` |
| `components/amount-presets.css` | Hızlı tutar çipleri | Hayır | **yeniden yazılacak** → `components/chips.css` + `amount.css` |
| `components/buttons.css` | Donate/submit/close | Yüksek özgüllük | **yeniden yazılacak** → `components/buttons.css` |
| `components/loading.css` | Overlay/spinner | Hayır | **yeniden yazılacak** (token) |
| `components/wizard.css` | Adımlı mod | Hayır | **yeniden yazılacak** |
| `components/progress-bar.css` | Kampanya ilerleme | Çok `!important` | **yeniden yazılacak** → `components/progress.css` |
| `components/success.css` | Teşekkür + mini-cart | Hayır | **yeniden yazılacak** |
| `components/toast.css` | Toast | Kısmen | **yeniden yazılacak** |
| `components/side-panel.css` | Sağ panel kabuk | Compat | **yeniden yazılacak** → `shells/panel.css` |
| `components/motion.css` | Geçişler + reduce-motion | Hayır | **silinecek** — opacity/shell giriş ≤200ms base’de |
| `components/feedback.css` | Form hata/başarı kutuları | Hayır | **yeniden yazılacak** → field/footer |
| `components/accessibility.css` | Odak halkaları, SR | Hayır | **taşınacak** — reset-scope + tokens focus |
| `components/product-note.css` | Ürün notu rozeti | Hayır | **yeniden yazılacak** → info-row / header |
| `components/sadaka-donation.css` | Sadaka satırı | Hayır | **yeniden yazılacak** → `sadaka.css` |
| `components/ux-enhancements.css` | Skeleton, CTA press, celebrate | Yama | **silinecek** — gerekli parça components’e |
| `components/campaign-modules.css` | Aciliyet, sosyal kanıt, cover-fee | Hayır | **yeniden yazılacak** → `info-row.css` |
| `components/mobile-polish.css` | Mobil overlap/safe-area yamaları | **Evet** | **silinecek** — shells’te doğru çözülecek |
| `overrides/theme-isolation-overrides.css` | Tema çakışma yamaları | **Evet** | **silinecek** — FAZ 5 `reset-scope` |

**Yeni 2C yapı (FAZ 6.1):**

```
foundation/  tokens, reset-scope, base
shells/      modal, panel, sheet, inline
components/  field, phone, amount, chips, stepper, shares, progress,
             sadaka, checkbox, info-row, buttons, footer, success, toast, wizard, loading
list/        liste kartları
```

---

## (b) Tüm ayarlar

### Üst düzey `wdp_*` option’lar

| Option | Anahtar | Admin sekmesi (şimdi) | Varsayılan | Kullanım | Tür | 2C yeri |
|--------|---------|----------------------|------------|----------|-----|---------|
| `wdp_button_settings` | *(bag)* | Tasarım / Normal | nested | CSS/JS/templates | mixed | Görünüm + Formlar ve metinler |
| `wdp_shareholder_settings` | *(bag)* | Hisseli | nested | CSS + JS texts | mixed | Görünüm + Formlar ve metinler |
| `wdp_success_settings` | *(bag)* | Başarı | nested | CSS + texts + sadaka | mixed | Görünüm + Formlar ve metinler |
| `wdp_progress_bar_settings` | *(bag)* | Progress | nested | CSS + celebrate | mixed | Görünüm (+ celebrate → Formlar) |
| `wdp_modal_layout_settings` | *(bag)* | Modal | nested | Genişlik/padding CSS | visual | Görünüm (sadeleştirilmiş) |
| `wdp_placement_settings` | *(bag)* | Ürün sayfası ve liste | nested | Placement runtime | behavior | Ürün sayfası ve liste |
| `wdp_meta_tracking_settings` | *(bag)* | Meta Pixel | nested | Pixel | behavior | Entegrasyonlar |
| `wdp_category_title_colors` | `{term_id}`→hex | Kategoriler | `[]` | Başlık/primary renk | visual | Görünüm |
| `wdp_custom_style_presets` | pack map | Tasarım | `[]` | Hazır stil | visual | Görünüm |
| `wdp_delete_data_on_uninstall` | — | Gelişmiş | `'0'` | uninstall | behavior | Gelişmiş |
| `wdp_version` / `wdp_cache_version` / `wdp_css_signature` / `wdp_db_version` / `wdp_previous_version` / `wdp_migration_log` / `wdp_list_cache_version` / `wdp_legacy_render_count` / `wdp_meta_purchase_wc_migration_v1` / `wdp_notice_placement_intro` | — | — | internal | Bootstrap/migrate | internal | Gelişmiş / internal |
| `wdp_settings_backup_10_27` | — | — | — | **2C yeni** | internal | Migration yedeği |

### `wdp_placement_settings`

| Anahtar | Varsayılan | Tür | 2C |
|---------|------------|-----|-----|
| `auto_place` | fresh `yes` / upgrade `no` | behavior | Ürün sayfası ve liste |
| `position` | `replace_cart` | behavior | Ürün sayfası ve liste |
| `display` | `inline` | behavior | Ürün sayfası ve liste |
| `hide_price` | `yes` | behavior | Ürün sayfası ve liste |
| `show_form_title` | `no` | visual | Ürün sayfası ve liste |
| `loop_button` | `link` | behavior | Ürün sayfası ve liste |
| `donation_scope` | `all` | behavior | Ürün sayfası ve liste |
| `donation_categories` | `[]` | behavior | Ürün sayfası ve liste |
| `schema` | `auto` | behavior | Ürün sayfası ve liste |

### `wdp_button_settings` (seçilmiş / tüm kritik anahtarlar)

| Anahtar | Varsayılan | Tür | 2C |
|---------|------------|-----|-----|
| `brand_color` / `button_primary_color` / `button_primary_hover` | `#0f608b` / `#0c4f72` | visual | → `--wdp-primary` (Görünüm); hover color-mix |
| `style_preset_id` | `classic` | visual | Görünüm — hazır stiller (Sade/Yumuşak/Keskin/Kurumsal) |
| `ui_border_radius` (+ synced radii) | `10` | visual | → radius md (Görünüm) |
| `modal_background_color` | `#ffffff` | visual | **kaldırılıyor** — runtime zaten `#fff` zorlar |
| `input_border_color` | `#d1d5db` | visual | token `--wdp-border` (sabit; ayar kaldırılabilir) |
| `title_color` / `title_font_size` / `title_font_size_mobile` | `#1f2937` / `27` | visual | → font boyutu S/M/L + `--wdp-text` |
| `close_button_color` | `#6b7280` | visual | **kaldırılıyor** — muted token |
| `button_checkout_color` / `button_checkout_hover` | yeşil | visual | **kaldırılıyor** — tek primary; success yalnızca başarı ikonu |
| `popup_button_text` / `button_text_*` | Bağış Yap / Sepete Ekle / Ödemeye Git | text | Formlar ve metinler |
| `popup_button_*` (renk, hover, text color, size, font, border, full_width, custom dims) | çeşitli | visual | sadeleştir → primary + on-primary; özel boyutlar **kaldırılıyor** |
| `label_color` / `label_font_size` / `label_font_weight` / `placeholder_color` / `form_gap` | çeşitli | visual | token sabitleri; **kaldırılıyor** (elle ayar yok) |
| `form_button_order` | `add_first` | behavior | Formlar — birincil eylem (ödeme/sepet) |
| `form_button_alignment` | `left` | visual | **kaldırılıyor** — sabit CTA düzeni |
| `enable_multi_step` | `'0'` | behavior | Formlar ve metinler |
| `enable_amount_presets` / `amount_presets` | `'0'` / CSV | behavior | Formlar ve metinler |
| `enable_field_icons` | `'1'` | visual | Görünüm — alanlar |
| `trust_strip_enabled` / `trust_strip_text` / `trust_badges` | | text/behavior | Formlar — güven rozetleri |
| `module_order` | `''` | behavior | Formlar |
| `icon_field_*` | builtin | visual | Görünüm (veya sabit builtin) |
| `form_density` | `normal` | visual | Görünüm — yoğunluk sıkı/normal/rahat |
| `glass_blur_px` / `glass_fill_opacity` | 22 / 90 | visual | **kaldırılıyor** — dead (forced none/white) |
| `elevation_level` | `3` | visual | **kaldırılıyor** — tek `--wdp-shadow-shell` |
| `overlay_tint` / `overlay_opacity` | `#0f172a` / 52 | visual | sabit token veya sade overlay |
| `body_font_family` | `inherit` | visual | Görünüm — tema / sistem |
| `motion_intensity` | `normal` | visual | **kaldırılıyor** — CSS tüketmiyor |
| `chip_style` | `soft` | visual | **kaldırılıyor** — CSS tüketmiyor |
| `enable_donor_email` / `enable_dedication` / `enable_anonymous` / `dedication_placeholder` | | behavior/text | Formlar — bağışçı alanları |
| `button_shadow_sc_*` / `button_shadow_modal_*` (22 key) | | visual | **kaldırılıyor** — buton gölgesi yok |

### `wdp_shareholder_settings`

| Anahtar | Tür | 2C |
|---------|-----|-----|
| `shareholder_*_text` / placeholders / copy button | text/behavior | Formlar — Hisseli |
| `shareholder_layout` / `shareholder_density` | visual | Formlar veya Görünüm; density → genel yoğunluk |
| `shareholder_enable_email` / email placeholder | behavior/text | Formlar |
| `shareholder_card_bg/border/radius/shadow` + header colors + area + scrollbar + share_counter_* | visual | **çoğu kaldırılıyor** — token’lara bağlanır; radius/shadow zaten zorlanmış |
| `shareholder_progress_status_label` | text | **kaldırılıyor** — JS okumuyor |

### `wdp_success_settings`

| Anahtar | Tür | 2C |
|---------|-----|-----|
| `success_button_*` / `success_message_*` / `mini_cart_*` / cart item colors | visual | **kaldırılıyor** veya token; metinler kalır |
| `success_text_*` | text | Formlar — Başarı ekranı |
| `sadaka_wc_product_id` / `sadaka_toggle_label` | behavior/text | Formlar — Sadaka |

### `wdp_progress_bar_settings`

| Anahtar | Tür | 2C |
|---------|-----|-----|
| `container_*` / `track_bg` / `fill_color` / `preview_bg` / `pending_bg` / `bar_height` | visual | **çoğu kaldırılıyor** — primary doldurma; bar yüksekliği token |
| `percentage_bg` / `percentage_text` | visual | **kaldırılıyor** — unused |
| `enable_celebrate` | behavior | Formlar — Hedefli kampanya |

### `wdp_modal_layout_settings`

| Anahtar | 2C |
|---------|-----|
| `side_panel_width_*` (9 key) | → panel genişliği 420/480/560 |
| `popup_modal_width_*` | → modal genişliği 480/520/600 |
| `inpage_form_width_*` | token / CQ |
| `modal_padding_*` | **kaldırılıyor** — sabit space token’ları |

### `wdp_meta_tracking_settings`

Tüm anahtarlar → **Entegrasyonlar** (davranış korunur).

---

## (c) Ürün bazında görünüm metaları

| Meta | Varsayılan | Admin | Kullanım | Tür | 2C |
|------|------------|-------|----------|-----|-----|
| `_layout_mode` | `classic` | Bağış | Shell/campaign | visual | **kalır** — classic/campaign/story |
| `_enable_campaign_media` | `no` | Bağış | Medya modülü | visual | **kalır** |
| `_theme_inherit_category_color` | `no` | Bağış | Kategori → primary | visual | **kalır** (genel ayar seçeneği) |
| `_theme_primary` | `''` | Bağış | Product CSS vars | visual | **kalır** — ana renk override |
| `_theme_primary_hover` | `''` | Bağış | hover | visual | **kaldırılıyor** — color-mix |
| `_theme_modal_bg` | `''` | Bağış | modal bg | visual | **kaldırılıyor** — yüzey sabit |
| `_theme_radius` | `''` | Bağış | radius | visual | **kalır** |
| `_theme_density` | `''` | Bağış | density | visual | genele bağlanır / kaldırılır |
| `_theme_preset_id` | `''` | UI yok | hiç uygulanmaz | visual | **kaldırılıyor** |
| `_enable_urgency` / `_urgency_text` / `_urgency_ends_at` | | Kampanya | banner | behavior/text | Ürünler (kampanya) |
| `_enable_social_proof` / `_social_proof_text` | | Kampanya | satır | | Ürünler |
| `_enable_cover_fee` / `_cover_fee_percent` | | Kampanya | ücret | | Ürünler |
| `_enable_impact_line` / `_impact_line_text` | | Form | etki | | Ürünler |
| `_enable_trust_strip` / `_trust_badges` | | Form | rozet | | Ürünler |
| `_wdp_module_order` | | | sıra | | Ürünler |
| `_progress_celebrate` | | Progress | celebrate | | Ürünler |
| `_enable_wizard` / `_enable_field_icons` / `_enable_amount_presets` / `_amount_presets` / `_enable_quantity` | | Form/Amount | | | Ürünler (davranış) |

**2C ürün “Bu ürüne özel görünüm” yalnızca:** ana renk, köşe yuvarlaklığı, düzen (`classic`/`campaign`/`story`), kampanya medyası — hepsinde “Genel ayar”.

---

## (d) Ölü ayarlar

| Ayar | Nerede | Neden ölü | 2C |
|------|--------|-----------|-----|
| `glass_blur_px` | Tasarım | `--wdp-glass-blur: none` zorlanır | sil |
| `glass_fill_opacity` | Tasarım | solid white zorlanır | sil |
| `modal_background_color` | Normal | her zaman `#ffffff` | sil |
| `motion_intensity` | Tasarım | CSS var tüketilmiyor | sil |
| `chip_style` | Tasarım | CSS var tüketilmiyor | sil |
| `percentage_bg` | Progress | frontend yok | sil |
| `percentage_text` | Progress | var var, tüketici yok | sil |
| `shareholder_card_shadow` | option | forced none | sil |
| `shareholder_card_radius` | Hisseli UI | `ui_border_radius` ezer | sil |
| `shareholders_area_radius` | option | UI yok; ezilir | sil |
| `shareholder_progress_status_label` | JS localize | JS okumuyor | sil |
| `_theme_preset_id` | meta preserve | uygulanmaz | sil |
| `button_shadow_*` (22) | Normal | 2C’de buton gölgesi yok | sil |
| FAQ keys | migration | zaten silindi | migration only |

---

## 2C yeni token ↔ eski ayar eşlemesi (FAZ 8 özeti)

| Yeni | Kaynak |
|------|--------|
| `--wdp-primary` | `brand_color` / `button_primary_color` |
| `--wdp-primary-hover/active` | color-mix (eski hover yedek) |
| `--wdp-on-primary` | kontrast hesabı |
| `--wdp-radius-md` | `ui_border_radius` (0–24 clamp) |
| `--wdp-control-h` / `--wdp-button-h` | `form_density` → sıkı/normal/rahat |
| `--wdp-font` | `body_font_family` → tema/sistem |
| `--wdp-fs-title` | `title_font_size` → S/M/L |
| `--wdp-shell-w-modal` | `popup_modal_width_desktop` → 480/520/600 |
| `--wdp-shell-w-panel` | side panel max → 420/480/560 |
| kategori renkleri | `wdp_category_title_colors` aynen |
| metinler | mevcut text key’ler → Formlar ve metinler |
