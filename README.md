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
npm run test       # PHPUnit + Node birim testleri
npm run e2e:quick   # hızlı staging E2E (ürün + form + liste; ≤ ~150 sn)
npm run ship:staging # staging deploy + e2e:quick + raporu aç
npm run e2e:accept  # son çalıştırmanın ekranlarını baseline’a birleştir (güvenli)
```

**Staging akışı:** her değişiklikten sonra `npm run ship:staging`; rapor temizse bildirin; bilerek değiştiyse `npm run e2e:accept` (yalnızca `run.json`’daki ekranlar; işlevsel hata varken reddeder).

Kaynak / dağıtım ZIP (`npm run pack` veya `.distignore`): `.env.deploy`, `.env.e2e`, `tests/e2e/.auth/*`, `tests/e2e/__baseline__/*` dahil edilmez.

Derlenmiş asset'ler `assets/css/build/` ve `assets/js/build/` altında oluşur. Kaynak dosyalar sırasıyla `includes/config/frontend-css-stack.php` ve `frontend-js-stack.php` ile tanımlanır.

## Gerçek sitede test

Staging üzerinde Playwright ile görsel + işlevsel kontrol. **Yalnızca staging**; test kullanıcısı canlıda olmamalıdır.

1. Proje kökünde `.env.e2e` oluşturun (şablon: `.env.e2e.example`). Anahtarlar:
   - `E2E_BASE_URL` — staging kök adresi (`staging` içermeli; aksi halde `E2E_ALLOW_PROD=1` gerekir)
   - `E2E_USER` / `E2E_PASS` — yalnızca staging’de var olan test kullanıcısı
   - `E2E_LOGIN_PATH` — (isteğe bağlı) giriş yolu; varsayılan `/wp-login.php`. SiteGround Security ile gizlenmiş giriş için örn. `/hedefdev/`
   - `E2E_PRODUCT_FIXED` / `E2E_PRODUCT_CUSTOM` / `E2E_PRODUCT_SHARES` / `E2E_PRODUCT_CAMPAIGN` — ürün slug’ları
   - `E2E_LIST_PAGE` / `E2E_SHOP_PAGE` — bağış listesi ve mağaza yolları
2. `npm install` ve `npx playwright install chromium webkit`
3. Önerilen: `npm run ship:staging` (deploy + hızlı E2E + rapor açılır). Her çalıştırma `build/e2e/current/` ve `diff/` temizler; yalnızca bu koşuda çekilen ekranlar karşılaştırılır. Eksik baseline → `Yeni referans`.
4. Bilerek UI değiştiyse: `npm run e2e:accept` — `run.json` zorunlu, işlevsel hata = 0; yalnızca listedeki ekranlar baseline’a birleşir (mobil/admin gibi çekilmeyenler silinmez). Eski baseline `__baseline_prev__/`.
5. Tam referans: `npm run e2e:baseline`. Tam karşılaştırma: `npm run e2e`.

Ayarların ne işe yaradığı: [docs/AYARLAR.md](docs/AYARLAR.md) (Türkçe, ürün Bağış sekmesi + ayar sekmeleri).

Giriş başarısız olursa testler durur; `build/e2e/debug/login-failure.png` (şifre doldurulmadan önce) ve konsolda son URL, HTTP durum, sayfa başlığı yazılır. Olası ipuçları:
- 404 veya ana sayfaya yönlendirme → `E2E_LOGIN_PATH` değerini kontrol edin
- sayfada CAPTCHA (`g-recaptcha` / `cf-turnstile` / `hcaptcha`) → e2e kullanıcısı için kapatılmalı
- 2FA / OTP / authentication code → e2e kullanıcısının rolünü Mağaza yöneticisi yapın veya 2FA’yı kapatın
- `#login_error` / `.woocommerce-error` → form hata metni konsola yazılır (`E2E_PASS` asla yazılmaz)

`.env.e2e`, baseline ve auth dosyaları git’e girmez; E2E dağıtım ZIP’ine dahil edilmez.

## Staging’e otomatik kurulum

Yalnızca staging. Canlı site yolu veya URL ile çalışmaz; kilitler tutmazsa hiçbir şey yapılmaz.

1. Proje kökünde `.env.deploy` oluşturun (şablon: `.env.deploy.example`):
   - `DEPLOY_SSH_HOST` / `DEPLOY_SSH_USER` / `DEPLOY_SSH_PORT` / `DEPLOY_SSH_KEY`
   - `DEPLOY_WP_PATH` — staging WordPress kökü (mutlak yol; içinde `staging` geçmeli; `/www/hedefdernegi.org/` olmamalı)
   - `DEPLOY_SITE_URL` — staging site adresi (`staging` içermeli; uzak `wp option get siteurl` ile birebir aynı olmalı)
2. SSH anahtarı Mac anahtar zincirinden (`ssh-agent`) kullanılır; betik şifre istemez.
3. Komutlar:
   - `npm run deploy:staging` — `verify` + `test` + `pack`, uzak yedek, `wp plugin install --force --activate`, geçiş adımları, önbellek temizliği
   - `npm run deploy:staging:rollback` — `/home/customer/wdp-backups/` içindeki en son yedeği geri kurar
   - `npm run ship:staging` — `deploy:staging` + `e2e:quick` + `build/e2e/report.html` açılır

Gizli değerler terminale yazılmaz. Çıktı örneği: `Staging'e kuruldu: 10.28.7`.

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
| `uninstall.php` | "Eklenti kaldırılınca verileri sil" açıksa eklenti seçenekleri, transient’ler ve ürün bağış meta’sı silinir; siparişlere ve WooCommerce çekirdek anahtarlarına dokunulmaz. |

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
| `class-product-page-integration.php` | WooCommerce şablon override, döngü Bağış Yap, fiyat gizleme, blok uyumu. |
| `templates/woocommerce/.../simple.php` | Simple ürün sepete ekle şablonunun bağış UI ile değiştirilmesi. |
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
| `[wdp_donation_button]` | `id`, `slug`, `sku`, `text` / `button_text`, `class` (`style` yok sayılır) | Ortada açılan pencere. |
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
2. Ürün kısa açıklamalarındaki eski `[wdp_donation_form id="…"]` kodlarını ürün içeriğinden temizleyin (çift form olmasın).
3. Bağışlar sayfasındaki görsel+başlık+buton Code Block yığınını tek `[wdp_donations]` ile değiştirin.
4. Ürün ID arayan özel snippet’leri (`[hd_panel_buton]` vb.) kaldırın; eklenti ürünü sayfa bağlamından çözer.

## Kaldırılan özellik: form içi SSS

Formun içindeki SSS modülü 10.27.0’da tamamen kaldırıldı. SSS’ler ürün sayfası içeriğinde tutulmalıdır (SEO ve Rank Math FAQ schema için). Eski `_enable_faq` / `_faq_items` meta değerleri güncellemede silinir.

## Sürüm notları

### 10.33.0 — Kısa kod / blok / Elementor / Gelişmiş

- `[wdp_donations]` önbelleği ürün kaydı, fiyat, bağış sekmesi ve sipariş durumunda yenilenir; `random` atlanır; admin notu cache’e girmez.
- Liste sekmeleri ARIA; `style` özniteliği yok sayılır; `text`/`button_text` popup/panelde eşleşir.
- Elementor ürün SELECT2 ajax; liste `image_size` + tablet/mobil sütun.
- Admin: 3 kısa kod; elle kısa kod filtresi ve alt bağış denetim tablosu kaldırıldı.
- Kaldırmada ürün ayarları açık listeyle silinir (siparişlere dokunulmaz); onay kutusu.
- Kullanılmayan `wdp_render_donation_button` AJAX kaldırıldı; yayımlanmamış ürün bilgisi sızmaz.

### 10.32.0 — Bu ürüne özel görünüm + aydınlatma bağlantısı

- Renk önceliği: ürün ana rengi → kategori → genel; “Kategori rengini kullan” kutusu kaldırıldı (meta silinmez).
- Hex: `#` opsiyonel; geçersizde kayıt hatası; boş = temizle. Türev palet + `--wdp-on-primary` (WCAG kontrast).
- Köşe 4–32 tek sınır; panel/sheet orantılı. Yoğunluk ürün UI’dan gizlendi; `_theme_preset_id` okunmaz/yazılmaz.
- Aydınlatma: yalnız kısa bağlantı etiketi; uzun varsayılan metin kaldırıldı (migration `10.32.0`).

### 10.31.0 — Kampanya blokları (hedef davranışı, toplanan, çok para birimi)

- Hedefe ulaşınca: ürün başına `continue` / `message` / `close` (varsayılan message); close sunucu + sepet doğrulaması.
- Toplanan: yalnız processing/completed; işlem ücreti hariç; Curcy/GBP dönüşümü; boş meta’da ziyaretçi taraması yok.
- Sosyal kanıt `{donors}`; aciliyet bitişi site TZ gün sonu; ilerleme yüzdesi = onaylı toplam; aydınlatma varsayılanı saha aktarımını kapsar.

### 10.30.0 — Form alanları (e-posta, ithaf, anonim, wizard/ikon, aydınlatma)

- Hisselide e-posta/ithaf/anonim yok (ürün sekmesi + sunucu).
- Kapalı alan POST’ta yok sayılır (AJAX + legacy cart); geçersiz e-posta hata + gönderim durur.
- İthaf/ad/not karakter (mb) sınırları; ürün notu kayıt 400; ithaf örnek metni 120.
- Anonim: herkese açık yüzeylerde ad maskelenir; sipariş/admin değişmez; sepet satırında e-posta/ithaf/anonim görünür.
- Wizard ve alan ikonları ürün üçlü (Genel/Açık/Kapalı); JS form sınıfına bakar.
- İsteğe bağlı aydınlatma bağlantısı (varsayılan kapalı); debug logda e-posta/ithaf maskelenir.
- Migration `10.30.0`: aydınlatma anahtarları eklenir (veri silinmez).

### 10.29.1 — Önerilen yalnız ürün; Ödemeye Git solukluğu
- "Önerilen" etiketi yalnız üründe Önerilen tutar doluysa ve görünen listedeyse; ortadaki/genel varsayılan kaldırıldı.
- Ödemeye Git: Dual CTA artık `--wdp-primary` kullanır (soluk `--wdp-success` checkout rengi yerine).
- Migration `10.29.1`: genel `amount_preset_recommended` silinir.

### 10.29.0 — Tutar seçenekleri (hızlı tutar, adet, işlem ücreti)

- **Etiketler:** "Chip" → "Hızlı tutar düğmeleri"; "En çok tercih" → "Önerilen" (10.29.1’de yalnız ürün alanı; seçili gelmez).
- **K1:** Hiçbir tutar otomatik seçili gelmez; seçim yalnız aynı ürün/oturumda (bellek); sepete ekleme / yenileme / ürün değişiminde temizlenir.
- **Tutarlar:** Kayıtta yalnız tam sayı (en fazla 6, genel liste dahil); geçersizde kayıt durur. Min altı düğmeler gizlenir. Yalnız Bağışçı belirler + Hedefli kampanya.
- **Adet:** Yalnız sabit tutar; kapalıysa sunucu adet=1 zorlar.
- **İşlem ücreti:** Tüm tiplerde; Toplam satırı canlı; yüzde 0,5–15 (0=kapalı); sunucu yüzdesi her zaman ürün meta’sından.

### 10.28.12 — Benzer Bağışlar E2E zamanlaması + idle Save-Data

- **Teşhis:** Ürün sayfası “Benzer Bağışlar” kartlarında başlık/buton DOM’da vardı; Avada `.fusion-post-cards.fusion-animated` `visibility:hidden` iken ekran alınıyordu (eklenti döngüyü silmiyor). Mağaza WooCommerce `ul.products` — animasyon yok, “Aynı” kaldı.
- **E2E:** `settleForScreenshot` animasyon görünür olana kadar bekler; ürün + mağazada görünür başlık + “Bağış Yap” işlevsel iddiası.
- **Idle prefetch:** `navigator.connection.saveData` / `2g` / `slow-2g` / `webdriver` → atlanır (niyet ön yükleme açık kalır).

### 10.28.11 — Mağaza lazy modal niyet ön yükleme + E2E hız

- **Mağaza/döngü:** `pointerenter` / `focus` / `touchstart` ile `wdp_render_modal` önceden çağrılır; tıklamada hazır HTML. Önbellek anahtarı = ürün + para birimi + dil; Curcy değişince geçersiz. Boşta: `requestIdleCallback` + `IntersectionObserver`, varsayılan ilk 3 görünür ürün, eşzamanlı 1 (`wdp_lazy_idle_prefetch` filtresi). Form sayfaya gömülmez.
- **Nonce:** Sunucu `wdp_render_modal` için nonce zorunlu tutmaz (sayfa önbelleği); istemci hata olursa tıklamada `wdp_get_fresh_nonces` + yeniden dener.
- **E2E:** quick ≤180 sn (shares-late paralellik); stability kabuk eşiği özeti; accept yalnız Değişti+Yeni; `e2e:perf` mağaza hover bütçesi (≤300 ms uyarı).

### 10.28.10 — Gecikmeli product_info hissedar verisini silmez

- **Kök neden:** `applyProductInfo` → `shareholder.setup` satırlar varken `innerHTML=""` ile listeyi yeniden kuruyordu; kullanıcı adı/telefon/not ve `.wdp-input-error` kayboluyordu.
- **Düzeltme:** Satırlar varken soft-sync (fiyat/rozet/+/−/görünürlük); wipe yok. `force:true` gerekirsen capture→restore (10.28.8 kalıbı) + armed ise doğrulamayı yeniden boya.
- **E2E:** `shares-late-product-info` (product_info ~1.5 sn gecikmeli) quick içinde.

### 10.28.9 — İskelet kilidi her yolda açılır

- **try/finally:** `runModalOpenInit` ve `openModal` hata yolunda kilit + `aria-busy` kalkar.
- **Bekçi:** 10 sn içinde açılmazsa zorla unlock + görünür uyarı + `console.warn`.
- **İstek kimliği:** `data-wdp-open-token`; eski `wdp_get_product_info` yanıtı yeni formu ezmez. Ürün bilgisi 10 sn zaman aşımı + panel/popup hata banner’ı.

### 10.28.8 — İskelet kilidi (disabled) + restore sırası

- **Playwright/otomasyon:** Yalnızca `inert` yetmez; iskelette input/select/textarea/button `disabled` (+ `data-wdp-skeleton-lock`). `resetForm` sonrası kilit yenilenir.
- **Restore sırası:** Değerler wizard/phone kurulumundan sonra, kilit açılmadan hemen önce geri yüklenir.

### 10.28.7 — Modal açılışında kullanıcı verisi korunur

- **Yarış:** Side panel açılışında gecikmeli `resetForm` doldurulmuş Ad Soyad’ı siliyordu (yük altında). İskelet sırasında form `inert` + etkileşimsiz; init sonrası değerler geri yüklenir.
- **Lazy modal:** Aynı ürün/tipte HTML değiştirilmez; değişirse girdiler name ile aktarılır.
- **Hata DOM:** `validateForm` / `showInputError` açık kabuktaki güncel forma yazar.

### 10.28.6 — validateForm sessiz false giderildi

- **Doğrulama geri bildirimi:** `validateForm` false döndüğünde her yolda görünür Türkçe alan hatası (veya form üstü genel mesaj) + ilk hatalı alana odak/kaydırma. Sessiz false yok.
- **Teşhis:** `WDPApp.form.lastValidation = { ok, failures:[{field, rule, value}] }` (yalnızca okuma; dış dönüş hâlâ boolean).
- **Kurallar değişmedi:** zorunluluk, telefon uzunluğu, min tutar aynı; yalnızca görünür geri bildirim eklendi.

### 10.28.5 — Alt bağış görünürlüğü etkilemez + ship/accept E2E

- **Ürün kararı:** Bir ürün hem kendi başına bağış ürünü hem de başka bir ürünün alt bağışı olabilir. Alt bağış bağlantısı görünürlüğü veya bağış kapsamını etkilemez; listede gizlemek için WooCommerce “Katalog görünürlüğü: Gizli” kullanılır.
- **Gizleme kaldırıldı:** `wdp_is_donation_product` filtresi ve sorgu dışlamaları yok. Sınıf bilgi amaçlı (hangi ürünler alt bağış olarak kullanılıyor).
- **Ürünler tablosu:** “Alt bağış olarak kullanılıyor (N)” rozeti (tooltip: ana ürün adları). “Gizli önerilir” kaldırıldı.
- **Geçiş 10.28.5:** görünürlük transient/önbellek temizliği + `wdp_list_cache_version` artışı. 10.28.4 denetim tablosu korunur.
- **E2E:** Kontrol beklemesi ≤ 5 sn; eksik öğe hata yazar, akış durmaz. `e2e:quick` form (popup/panel) dahil, ≤ ~150 sn; `run.json` manifesti; rapor yalnızca bu koşunun ekranlarını karşılaştırır. `e2e:accept` güvenli birleştirme (hata varken reddeder).

### 10.28.4 — Alt bağış tespiti, Avada listeleri, E2E hızı, staging kurulum

- **Alt bağış tespiti:** Yalnızca genel varsayılan veya “Alt bağış ekle” açık ürünlerin seçtiği WC ürünü sayılır; kendini gösteren ID hariç. Kayıtta geçersiz seçim temizlenir.
- **Geçiş 10.28.4:** Eski/kapalı `_sadaka_wc_product_id` değerleri temizlenir; Ayarlar → Gelişmiş → “Alt bağış bağlantıları” tablosu + `wdp_migration_log`.
- **E2E / staging:** `e2e:quick`, `deploy:staging` / `ship:staging`. Ayar rehberi: `docs/AYARLAR.md`.

### 10.28.3 — Alt bağış ürün gizleme ve E2E kararlılığı

- **(10.28.5 ile geri alındı)** Alt bağış WC ürünlerini listelerden gizleme yaklaşımı kaldırıldı; ürün hem bağış hem alt bağış olabilir.
- **Ürün Bağış sekmesi / genel ayar:** `wc-product-search` ile ürün adına göre seçim (mevcut ID korunur).
- **E2E:** Alt bağış senaryoları yapılandırmaya bağlı; raporda Geçti / Atlandı / Hata.

### 10.28.2 — Alt bağış (sadaka) tutarı doğrulaması

- **Alt bağış tutarı:** Açık sadaka panelinde yalnızca sadaka doğrulayıcısı çalışır; geçerli tutar yazılınca hata anında kalkar; panel kapanınca alan/hatalar sıfırlanır. Genel “Bu alan zorunludur” mesajı alt bağış alanına yanlışlıkla basılmaz.
- **Sunucu:** `sadaka_custom_price` sayı / > 0 / min doğrulanır; sessizce yutulmaz. WooCommerce alt bağış ürünü yoksa veya geçersizse “Sadaka Bağışı Ekle” gösterilmez (`edit_products` yetkilisine uyarı).
- **E2E:** sadaka senaryosu (popup/panel, sabit + bağışçı belirler); görsel raporda Durum (Aynı/Değişti) ve `E2E_DIFF_THRESHOLD` (varsayılan %0,5); hata ekranlarında animasyon/odak kararlılığı.

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
