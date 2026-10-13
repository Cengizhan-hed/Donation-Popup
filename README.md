# WooCommerce Donation Modal Popup

WooCommerce bağış popup / sağ panel eklentisi. Ürün bazlı bağış formları, hisseli bağış, sadaka satırı, progress bar ve Meta Pixel entegrasyonu sunar.

## Gereksinimler

- WordPress 5.0+
- WooCommerce 3.0+
- PHP 7.4+

## Kurulum

1. Eklentiyi `wp-content/plugins/` altına yükleyin ve etkinleştirin.
2. **WooCommerce → Bağış Popup Ayarları** menüsünden ürün ve görünüm ayarlarını yapın.
3. Shortcode örnekleri:
   - `[wdp_donation_form]` — ürün sayfasında mevcut ürünün formu (id zorunlu değil)
   - `[wdp_donation_form id="123"]` / `slug="kurban"` / `sku="SKU"` — belirli ürün
   - `[wdp_donation_button]` / `[wdp_donation_button_panel]` — buton + popup / sağ panel
   - `[wdp_donations]` — bağış ürünleri ızgarası

## Geliştirme

```bash
npm install
npm run build      # CSS + JS bundle üretir
npm run verify     # build + smoke test
npm run pack       # dağıtım ZIP'i (build/woo-donation-popup.zip)
```

Derlenmiş asset'ler `assets/css/build/` ve `assets/js/build/` altında oluşur. Kaynak dosyalar sırasıyla `includes/config/frontend-css-stack.php` ve `frontend-js-stack.php` ile tanımlanır.

**Önemli:** Canlıya almadan önce mutlaka `npm run build` çalıştırın. WordPress varsayılan olarak hashed bundle + `manifest.json` kullanır; yalnızca `assets/*/src` değiştirmek canlı arayüzü güncellemez.

Tüm kaynak dosyaların başında Türkçe `@file` açıklaması bulunur. Güncellemek için:

```bash
php tools/apply-file-docblocks.php
```

Açıklama metinleri `tools/file-descriptions.json` dosyasındadır.

---

## Dosya rehberi

Aşağıda projedeki her kaynak dosyanın kısa Türkçe açıklaması yer alır. Yeni dosya eklerken hem dosya başlığına hem bu listeye ekleme yapın.

### Kök

| Dosya | Ne işe yarar |
|-------|----------------|
| `woo-donation-popup.php` | WordPress eklenti giriş dosyası; sabitleri tanımlar ve bootstrap sınıfını başlatır. |
| `uninstall.php` | Kaldırmada yalnızca "Eklenti kaldırılınca tüm verilerini sil" açıksa `wdp_` option/transient ve ürün meta verilerini siler; sipariş verilerine dokunmaz. |

### `tools/` — Derleme araçları

| Dosya | Ne işe yarar |
|-------|----------------|
| `tools/build-css-bundle.php` | CSS kaynaklarını stack sırasına göre tek bundle'da birleştirir. |
| `tools/build-js-bundle.php` | JS modüllerini stack sırasına göre tek bundle'da birleştirir. |
| `tools/file-descriptions.json` | Dosya başlıkları için Türkçe açıklama manifesti. |
| `tools/apply-file-docblocks.php` | Manifest'teki açıklamaları kaynak dosyalara yazar. |

### `includes/` — PHP çekirdek sınıflar

| Dosya | Ne işe yarar |
|-------|----------------|
| `class-woo-donation-popup.php` | Ana orkestratör; modülleri başlatır, aktivasyon/deaktivasyon kancaları. |
| `class-autoloader.php` | `WDP_*` sınıf adlarını dosya yollarına eşleyen autoloader. |
| `class-exceptions.php` | Özel exception türleri (ürün, doğrulama, güvenlik, sepet). |
| `class-utils.php` | Log, JSON yanıt, sadaka çözümü, progress bar toplamları, önbellek. |
| `class-security.php` | Sanitizasyon, nonce, yetki, rate limit doğrulaması. |
| `class-assets.php` | Ön yüz CSS/JS yükleme orkestrasyonu. |
| `class-ajax.php` | `wp_ajax_*` kancalarını kaydeder; mantık trait'lerde. |
| `class-cart.php` | Sepet kancaları; bağış verisi, özel fiyat, hisse kilidi. |
| `class-order.php` | Sipariş satırına bağış/hisse meta verisi yazar. |
| `class-order-meta-keys.php` | Sipariş satırı meta anahtarlarının tek kaynağı: sabit `wdp_*` anahtarlar, görünen etiketler, eski (çevrilmiş) anahtar uyumluluğu. |
| `class-privacy.php` | WordPress kişisel veri dışa aktarma/silme kayıtçıları (bağışçı ve hissedar alanları, `[deleted]` ile anonimleştirme). |
| `class-templates.php` | Modal, form, buton ve alan HTML çıktısı. |
| `class-shortcodes.php` | Bağış butonu, panel, form ve `[wdp_donations]` kısa kodları. |
| `class-donation-scope.php` | Bir ürünün bağış ürünü sayılıp sayılmadığı (kapsam + işaret + tip). |
| `class-product-resolver.php` | Kısa kod/blok/widget için ürün çözümleyici (id, slug, sku, bağlam). |
| `class-render-registry.php` | İstek içinde yinelenen form/modal HTML’ini önler. |
| `class-product-page-integration.php` | Ürün sayfasına otomatik yerleşim, döngü butonu, blok şablon uyumu. |
| `class-donations-list.php` | `[wdp_donations]` sorgu, kart, sekme ve önbellek. |
| `class-lazy-modal.php` | Liste/döngü için gecikmeli modal AJAX (`wdp_render_modal`). |
| `class-schema.php` | WooCommerce / Rank Math Product JSON-LD kuralları. |
| `class-blocks.php` | Gutenberg bağış formu ve liste blokları. |
| `class-elementor.php` | Elementor Free widget kaydı. |
| `class-form-matrix.php` | Form test sayfası (`?wdp_form_matrix=1`). |
| `class-placement-settings.php` | `wdp_placement_settings` varsayılanları ve normalizer. |
| `class-migrations.php` | `wdp_db_version` geçişleri; idempotent adımlar. |
| `class-render-guard.php` | Render giriş noktalarında çökme koruması. |
| `class-phone-field.php` | Ülke kodlu telefon alanı verisi ve kuralları. |
| `class-meta-tracking.php` | Meta Pixel olayları ve teşekkür sayfası scriptleri. |
| `class-progress-form.php` | Hedefli bağış progress bar form alanı HTML'i. |
| `class-donation-product-context-service.php` | Üründen normalize form bağlamı üretir. |
| `class-product-settings-service.php` | Admin ürün meta ayarlarını normalize eder. |
| `class-donation-type.php` | Bağış tipi ↔ eski meta bayrakları eşlemesi (çıkarım, kayıt, tablo filtresi). |
| `class-category-title-color-service.php` | Kategori bazlı modal başlık rengi. |

### `includes/` — Admin (ayarlar sayfası)

| Dosya | Ne işe yarar |
|-------|----------------|
| `class-woo-donation-popup-admin.php` | Ayarlar sayfası denetleyicisi ve AJAX kaydetme uçları. |
| `class-admin-hooks.php` | Admin menü, asset ve AJAX eylem bağlantıları. |
| `class-admin-assets.php` | Admin CSS/JS yükleme ve `wdp_admin` localize verisi. |
| `class-admin-page-renderer.php` | Ayarlar sayfası kabuğu ve ürünler sekmesi. |
| `class-admin-products-list-table.php` | Ayarlar → Ürünler tablosu (`WP_List_Table`): bağış tipi rozeti, kısa kod, hedef/toplanan, arama ve filtreler. |
| `class-admin-product-data-tab.php` | Ürün düzenleme ekranındaki "Bağış" sekmesi (bağış tipi, gruplu ayarlar, kısa kod) ve ürünle birlikte kayıt. |
| `class-admin-renderer-helpers.php` | Ortak admin form sarmalayıcı ve kaydet butonu. |
| `class-admin-request.php` | Admin AJAX nonce/yetki ve JSON yanıtları. |
| `class-admin-settings-normalizer.php` | Tüm sekme ayar isteklerini sınırlar ve normalize eder. |
| `class-admin-product-settings-ajax.php` | Ürün ilerleme toplamını yeniden hesaplayan AJAX. |
| `class-admin-placement-tab-renderer.php` | Ayarlar → Ürün sayfası ve liste sekmesi. |
| `class-admin-bulk-actions.php` | Bağış ürünü işaretleme toplu işlemleri (ayarlar tablosu + WC ürün listesi). |
| `class-admin-form-tabs-renderer.php` | Normal/hisseli form ve başarı ekranı sekmeleri. |
| `class-admin-layout-tabs-renderer.php` | Modal düzeni ve progress bar stil sekmeleri. |
| `class-admin-category-colors-tab-renderer.php` | Kategori başlık rengi seçim formu. |
| `class-admin-meta-tracking-tab-renderer.php` | Meta Pixel ayarları sekmesi. |

### `includes/bootstrap/`

| Dosya | Ne işe yarar |
|-------|----------------|
| `class-plugin-bootstrap.php` | HPOS uyumu, bağımlılık yükleme, sürüm güncelleme, WC kontrolü. |
| `class-legacy-frontend.php` | Geriye dönük `wdp_render_*` yardımcıları ve eski AJAX uçları. |

### `includes/config/`

| Dosya | Ne işe yarar |
|-------|----------------|
| `frontend-js-stack.php` | Ön yüz JS modül sırası, handle ve bağımlılıklar. |
| `frontend-css-stack.php` | Ön yüz CSS birleştirme ve enqueue sırası. |

### `includes/traits/` — Paylaşılan PHP mantığı

| Dosya | Ne işe yarar |
|-------|----------------|
| `trait-wdp-ajax-base.php` | AJAX temel yardımcılar: sepet, nonce, rate limit. |
| `trait-wdp-ajax-product.php` | `get_product_info` AJAX yanıtı. |
| `trait-wdp-ajax-cart-add.php` | `ajax_add_to_cart` sepete ekleme mantığı. |
| `trait-wdp-ajax-cart-session.php` | Nonce yenileme ve gönderim anahtarı doğrulama. |
| `trait-wdp-ajax-cart-query.php` | Sepet sayacı, mini-cart, satır silme. |
| `trait-wdp-assets-registry.php` | Asset kaydı, manifest okuma, koşullu enqueue. |
| `trait-wdp-assets-inline-styles.php` | Dinamik inline CSS ve JS yapılandırma verisi. |
| `trait-wdp-assets-optimizer.php` | Önbellek/minify eklenti dışlamaları. |
| `trait-wdp-utils-price.php` | Fiyat formatlama yardımcıları. |
| `trait-wdp-utils-order-meta.php` | HPOS uyumlu sipariş meta işlemleri. |
| `trait-wdp-utils-legacy-settings.php` | Eski ayar anahtarlarını yeni şemaya taşır. |

### `assets/css/src/foundation/` — Tasarım temeli

| Dosya | Ne işe yarar |
|-------|----------------|
| `tokens.css` | Glass modal jetonları: IHH yeşili, cam blur, tipografi. |
| `polish.css` | Kapat, başlık, bilgi şeridi ve tipografi cilası. |
| `base.css` | Temel sıfırlama ve ortak tipografi. |
| `layout.css` | Cam panel, masaüstü kart, mobil bottom-sheet, sticky CTA. |

### `assets/css/src/forms/`

| Dosya | Ne işe yarar |
|-------|----------------|
| `shared.css` | Normal ve hisseli formların ortak alan stilleri. |
| `field-stack.css` | Dikey alan yığını, input ve hata durumları. |
| `hisseli.css` | Hisseli bağış kartları ve çoklu bağışçı alanları. |

### `assets/css/src/components/`

| Dosya | Ne işe yarar |
|-------|----------------|
| `side-panel.css` | Sağdan açılan bağış paneli ve overlay. |
| `phone-field.css` | Ülke kodlu telefon alanı stilleri. |
| `buttons.css` | Bağış, gönder ve kapat düğmeleri. |
| `loading.css` | Yükleme spinner ve bekletme durumu. |
| `quantity.css` | Miktar artır/azalt kontrolleri. |
| `progress-bar.css` | Hedefli bağış progress bar görünümü. |
| `success.css` | Başarı/teşekkür ekranı ve mini sepet özeti. |
| `toast.css` | Kısa süreli bildirim balonları. |
| `motion.css` | Ortak animasyonlar (reduce-motion uyumlu). |
| `feedback.css` | Form hata ve bilgi mesaj kutuları. |
| `accessibility.css` | Odak halkası ve klavye erişilebilirliği. |
| `product-note.css` | Ürün notu alanı ve bilgi kutusu. |
| `sadaka-donation.css` | Sadaka alt bağış satırı stilleri. |

### `assets/css/src/overrides/`

| Dosya | Ne işe yarar |
|-------|----------------|
| `theme-isolation-overrides.css` | Tema çakışmalarını önleyen son katman stilleri. |

### `assets/css/` ve `assets/js/` — Admin

| Dosya | Ne işe yarar |
|-------|----------------|
| `assets/css/admin-style.css` | Bağış Popup Ayarları admin sayfası görünümü. |
| `assets/js/admin-script.js` | Admin sekmeleri, AJAX kaydetme ve bildirimler. |
| `assets/css/admin/products.css` | Ürünler tablosu ve ürün "Bağış" sekmesi stilleri (`npm run pack` ile küçültülür). |
| `assets/js/admin/products.js` | Kısa kod kopyalama, toplam yenileme, bağış tipi geçişi, satır ekle/sil ve blok sırası. |

### `assets/js/src/core/` — JS çekirdek

| Dosya | Ne işe yarar | Dış API |
|-------|----------------|---------|
| `constants.js` | Sabitler ve yapılandırma anahtarları | `WDPApp.constants` |
| `utils.js` | Fiyat formatlama, escape, nonce, odak | `WDPApp.utils` |
| `state.js` | Global modal/form durumu | `WDPApp.state` |
| `dom.js` | DOM yardımcıları | `WDPApp.dom` |

### `assets/js/src/form/` — Bağış formu modülleri

| Dosya | Ne işe yarar | Dış API |
|-------|----------------|---------|
| `messages.js` | Hata/bilgi metinleri | `WDPApp.formMessages` |
| `pricing.js` | Fiyat ve miktar hesapları | `WDPApp.formPricing` |
| `feedback.js` | Alan/form geri bildirimi | `WDPApp.formFeedback` |
| `sadaka.js` | Sadaka alt satır mantığı | `WDPApp.formSadaka` |
| `ajax.js` | AJAX sepete ekleme | `WDPApp.formAjax` |
| `validate.js` | Form doğrulama (telefon, tutar, hissedar) | `WDPApp.formValidate` |
| `../form.js` | Form orkestrasyonu (ana dosya) | `WDPApp.form` |

### `assets/js/src/shareholder/` — Hisseli bağış modülleri

| Dosya | Ne işe yarar | Dış API |
|-------|----------------|---------|
| `layout.js` | Hisse kart düzeni | `WDPApp.shareholderLayout` |
| `list.js` | Hisse listesi | `WDPApp.shareholderList` |
| `scroll.js` | Liste kaydırma | `WDPApp.shareholderScroll` |
| `guidance.js` | Kullanıcı rehber metinleri | `WDPApp.shareholderGuidance` |
| `render.js` | Hisse satırı HTML | `WDPApp.shareholderRender` |
| `quantity.js` | Hisse adedi ve fiyat | `WDPApp.shareholderQuantity` |
| `forms-sync.js` | Çoklu form senkronu | `WDPApp.shareholderFormsSync` |
| `setup.js` | İlk kurulum ve hook'lar | `WDPApp.shareholderSetup` |
| `../shareholder.js` | Hisse orkestrasyonu (ana dosya) | `WDPApp.shareholder` |

### `assets/js/src/cart/` — Sepet modülleri

| Dosya | Ne işe yarar | Dış API |
|-------|----------------|---------|
| `ui.js` | Mini sepet DOM güncellemeleri | `WDPApp.cartUi` |
| `woo.js` | WooCommerce sepet entegrasyonu | `WDPApp.cartWoo` |
| `actions.js` | Sepet sonrası aksiyonlar | `WDPApp.cartActions` |
| `../cart.js` | Sepet köprüsü (ana dosya) | `WDPApp.cart` |

### `assets/js/src/` — Diğer ön yüz modülleri

| Dosya | Ne işe yarar | Dış API |
|-------|----------------|---------|
| `modal.js` | Modal aç/kapa ve odak tuzağı | `WDPApp.modal` |
| `product.js` | Ürün bilgisi yükleme | `WDPApp.product` |
| `phone-input.js` | Telefon maskesi ve doğrulama | `WDPApp.phoneInput` |
| `progress-bar.js` | Progress bar animasyonu | `WDPApp.progressBar` |
| `meta-tracking.js` | Meta Pixel olayları | `WDPApp.metaTracking` |

### `assets/js/src/bootstrap/` — Başlatma

| Dosya | Ne işe yarar | Dış API |
|-------|----------------|---------|
| `form-initializer.js` | Formlara başlangıç verisi atar | `WDPApp.formInitializer` |
| `event-manager.js` | Merkezi olay delegasyonu | `WDPApp.eventManager` |
| `module-loader.js` | Modül hazır olma kontrolü | `WDPApp.moduleLoader` |
| `init.js` | DOM hazır olunca WDPApp başlatır | `WDPApp.init` |

---

## Dosyalama kuralları

- Yeni PHP sınıfı: `includes/class-*.php`
- Yeni trait: `includes/traits/trait-wdp-*.php`
- Yeni JS modülü: `assets/js/src/` altında; stack'e `frontend-js-stack.php` ile ekleyin
- Yeni CSS: `foundation/`, `forms/`, `components/` veya `overrides/`; stack'e `frontend-css-stack.php` ile ekleyin
- Her yeni dosyaya Türkçe `@file` başlığı ve `tools/file-descriptions.json` kaydı ekleyin

## Mimari özeti

```
woo-donation-popup.php
  └── bootstrap/class-plugin-bootstrap.php
        └── class-woo-donation-popup.php (modüller)
              ├── Templates + Shortcodes (HTML)
              ├── Ajax + Cart + Order (WooCommerce)
              └── Assets (CSS/JS stack → bundle)
                    └── WDPApp.* (ön yüz JS modülleri)
```

Ön yüz JS yükleme sırası: `core` → `cart` → `form` → `shareholder` → `modal` → `bootstrap/init`.

## Testler

```bash
composer install   # PHPUnit (vendor/)
npm run test       # tests/unit
npm run verify     # build + smoke
```

## Kısa kodlar

| Kısa kod | Nitelikler | Ne basar |
|----------|------------|----------|
| `[wdp_donation_form]` | `id`, `slug`, `sku`, `show_title`, `title`, `class` | Sayfa içi form. id/slug/sku yoksa mevcut ürün. |
| `[wdp_donation_button]` | `id`, `slug`, `sku`, `text`, `class`, `style` | Ortada açılan pencere. |
| `[wdp_donation_button_panel]` | aynı | Sağ panel. |
| `[wdp_donations]` | `categories`, `exclude_categories`, `ids`, `exclude`, `type`, `limit` (1–100), `orderby` (menu_order/date/title/popularity/random), `order`, `tabs`, `tab_all`, `tab_all_label`, `columns` / `columns_tablet` / `columns_mobile` (1–6), `gap` (0–64), `image_ratio`, `align`, `button` (panel/popup/link), `button_full`, `button_text`, `show_image`, `show_excerpt`, `show_progress`, `show_price`, `show_category`, `excerpt_words`, `image_size`, `heading_tag`, `class` | Bağış listesi. |

Bloklar: Gutenberg **Bağış formu** (`wdp/donation-form`) ve **Bağış listesi** (`wdp/donations`). Elementor: kategori **Bağış (WooCommerce Donation)**.

## Geliştirici kancaları (filtreler)

| Filtre | Varsayılan | Ne işe yarar |
|--------|-----------|----------------|
| `wdp_min_donation_amount` | `1` | Ürün min. fiyatı boş/0 olsa bile kabul edilen en düşük bağış tutarı (`$min`, `$product_id`). Tutar her durumda 0'dan büyük olmalıdır. |
| `wdp_progress_paid_statuses` | `['processing','completed']` | Progress bar toplamına sayılan sipariş durumları. |
| `wdp_meta_pixel_has_consent` | `false` | WP Consent API yoksa pazarlama izni kararı ("Çerez izni gerektir" açıkken). |
| `wdp_is_donation_product` | kapsam kararı | Ürünün bağış ürünü sayılıp sayılmadığı (`$bool`, `$product`). |
| `wdp_supported_product_types` | `['simple']` | Bağış formunun desteklediği WC ürün tipleri. |
| `wdp_resolve_product` | çözümleyici sonucu | Kısa kod/blok ürünü (`$product`, `$atts`, `$context`). |
| `wdp_builder_preview_product` | son bağış ürünü | Sayfa oluşturucu önizlemesinde örnek ürün. |
| `wdp_product_schema` | tip+fiyat kararı | Product JSON-LD basılsın mı (`$keep`, `$product`, `$type`). Yoast / SEOPress / AIOSEO bu filtreyi kullanabilir. |
| `wdp_form_context` | ürün bağlamı | Form bağlamını değiştirir (yalnızca test sayfasında tip simülasyonu için yazılır). |
| `wdp_donations_query_args` | liste WP_Query args | `[wdp_donations]` sorgu argümanları. |
| `wdp_donations_card_html` | kart HTML | Liste kartı HTML’i. |

Ayar varsayılanı, anlamı veya yapısı değişirse ya da bir özellik kaldırılırsa aynı aşamada `WDP_Migrations` adımı ve testi eklenir; ayar ekranı her zaman uygulanan değeri gösterir.

## Avada’dan geçiş

1. Single product layout’taki Code Block’a bir kez `[wdp_donation_button_panel]` veya `[wdp_donation_form]` ekleyin (id yok; layout ürün sayfasında o ürünü çözer). Avada Layout WooCommerce kancalarını çalıştırmadığı için otomatik yerleşim burada devreye girmez.
2. Ürün kısa açıklamalarındaki eski `[wdp_donation_form id="…"]` kodlarını Ayarlar → Ürünler → **Elle eklenmiş kısa kod: Var** filtresiyle bulun ve temizleyin (çift form olmasın).
3. Bağışlar sayfasındaki görsel+başlık+buton Code Block yığınını tek `[wdp_donations]` ile değiştirin.
4. Ürün ID arayan özel snippet’leri (`[hd_panel_buton]` vb.) kaldırın; eklenti ürünü sayfa bağlamından çözer.

## Kaldırılan özellik: form içi SSS

Formun içindeki SSS modülü 10.27.0’da tamamen kaldırıldı. SSS’ler ürün sayfası içeriğinde tutulmalıdır (SEO ve Rank Math FAQ schema için). Eski `_enable_faq` / `_faq_items` meta değerleri güncellemede silinir.

## Sürüm notları

### 10.27.1 — Ayar sekmeleri DOM’dan üretilir

- **Ürün sayfası ve liste** sekmesi açılmıyordu: `admin-script.js` ve inline `wdp-admin-tabs` sabit `TAB_KEYS` listesinde `placement` yoktu. Sekme listesi artık sayfadaki `data-tab` + panel eşleşmesinden üretiliyor; `#placement` hash, yenileme ve geri/ileri gezinme çalışır.
- Ayar formları `data-wdp-ajax-action` ile DOM’dan bağlanır; kaydedilmemiş değişiklik varken sekme değişiminde uyarı verilir.

### 10.27.0 — Aşama 2B: yerleşim, liste, bloklar, sağlamlık

- **Form içi SSS kaldırıldı** (çökme nedeni: JSON string’in dizi type-hint’e gitmesi). Ürün sayfası içeriğindeki SSS’lere dokunulmaz.
- **Çökme koruması:** form/kısa kod/blok/widget/liste/AJAX try/catch; ziyaretçiye boş, yöneticiye uyarı, hata günlüğü.
- **Bağış ürünü kapsamı:** tüm basit ürünler / kategoriler / işaretli. Ürün Bağış sekmesinde Genel ayar / Bağış ürünü / Normal ürün.
- **Kimliksiz kısa kod:** `[wdp_donation_form]` ürün sayfasında ve Avada Layout Code Block’ta çalışır (`id` / `slug` / `sku` hâlâ geçerli). Elle yazılmış id’li kodlar kapsamı yok sayar.
- **Otomatik yerleşim:** yeni kurulumda açık, güncellemede kapalı (`wdp_placement_settings`). Klasik temalarda sepete ekle yerine form; Avada Layout’ta kısa kod gerekir.
- **`[wdp_donations]`**, Gutenberg blokları, Elementor widget’ları, gecikmeli modal, schema (WooCommerce + Rank Math).
- **Form test sayfası:** Ayarlar → Ürün sayfası ve liste → Form test sayfasını aç.
- **Geçiş:** `wdp_db_version`; SSS verisi temizliği; yerleşim anahtarları açıkça yazılır.

### 10.26.0 — Aşama 2A: ürün bağış ayarlarının yeniden tasarımı

Ön yüzdeki formların görünümü ve davranışı değişmedi; mevcut ürün meta anahtarları aynen kullanılır.

- **Tek "Bağış tipi":** Sabit tutar / Bağışçı belirler / Hisseli / Hedefli kampanya. Tip ayrı bir meta olarak saklanmaz; `_allow_custom_price`, `_allow_multiple_shares`, `_enable_progress_bar` bayraklarından ön yüzle aynı öncelikle çıkarılır (`WDP_Donation_Type`) ve kayıtta bu üç bayrak tutarlı şekilde yazılır. Çelişkili eski kayıtlar (ör. hisseli + progress) ön yüzün gösterdiği tipe göre okunur.
- **Ürün düzenleme → "Bağış" sekmesi:** Tip kartları, yalnızca seçili tipin alanları; Tutar seçenekleri, Form alanları, Kampanya blokları, Alt bağış ve Bu ürüne özel görünüm açılır grupları. Güven rozetleri satır ekle/sil editörüyle düzenlenir (kayıt biçimi aynı JSON). Blok sırası klavyeyle yukarı/aşağı taşınır. Kayıt WooCommerce ürün kaydıyla birlikte yapılır (nonce + `manage_woocommerce`).
- **Ayarlar → Ürünler:** Kart düzeni kaldırıldı; yerine arama, kategori ve bağış tipi filtreli, sayfa başına 20 ürünlük tablo geldi. Hedef/Toplanan ve "Yeniden hesapla" yalnızca hedefli kampanyalarda görünür. "Düzenle" ürünü doğrudan "Bağış" sekmesinde açar (`#wdp_donation`).
- **Düzeltmeler:** Rozet metinlerindeki Türkçe karakterlerin kayıtta bozulması (`u00fc`) giderildi; eski bozuk kayıtlar panelde onarılarak gösterilir. E-posta / ithaf / anonim alanları ürün bazında "Genel ayar / Açık / Kapalı" olarak seçilebilir. Özel blok sırası kapalıyken ürün artık genel sırayı izler. Eski kart kaydı `_theme_preset_id` değerini silmiyor.

### 10.25.0 — Aşama 1: kritik düzeltmeler

- **Sipariş meta anahtarları:** Yeni siparişler dilden bağımsız anahtarlar kullanır (`wdp_donor_name`, `wdp_donor_phone`, `wdp_donor_email`, `wdp_donation_note`, `wdp_dedication`, `wdp_anonymous`, `wdp_cover_fee`, `wdp_share_count`, `wdp_shareholder_{n}_{name|phone|email|note}`). Admin, e-posta ve teşekkür sayfasında `woocommerce_order_item_display_meta_key` ile çevrilebilir etiket gösterilir. Eski siparişlerdeki çevrilmiş anahtarlar değiştirilmez; okuyucular (`WDP_Order_Meta_Keys::get_item_donation_data()`) ikisini de destekler.
- **Sıfır tutar engeli:** Özel fiyat doğrulaması (AJAX + klasik form) tutarın 0'dan büyük ve `wdp_min_donation_amount` üstünde olmasını ister; sepette fiyatı 0 kalan bağış satırı kaldırılır ve uyarı gösterilir. Hata mesajlarında para birimi WooCommerce ayarından gelir.
- **Progress bar:** Toplam, ödemesi alınmış siparişlerden (`processing`, `completed`) hesaplanır. Sayılan siparişe `_wdp_progress_counted = yes` yazılır (çift sayım yok); `refunded` / `cancelled` / `failed` durumunda tutar düşülür, kısmi iadede iade edilen satır tutarı düşülür. Ürün kartında "Toplamı yeniden hesapla" eylemi vardır.
- **Meta Pixel izni:** Yeni "Çerez izni gerektir" ayarı (varsayılan açık). WP Consent API varsa `wp_has_consent('marketing')`, yoksa `wdp_meta_pixel_has_consent` filtresi. İzin sonradan verilirse (`wp_listen_for_consent_change`) pixel o anda başlatılır. Ayar kapalıysa eski davranış sürer.
- **Kaldırma ve kişisel veri:** `uninstall.php` (Gelişmiş sekmesindeki ayar açıksa). Araçlar → Kişisel verileri dışa aktar / sil, siparişlerdeki bağışçı ve hissedar alanlarını kapsar (silme = `[deleted]`).
- **Eklenti başlığı:** `Requires Plugins: woocommerce`, `Requires PHP: 7.4`; geçersiz `Woo:` / `WooCommerce:` satırları kaldırıldı.
