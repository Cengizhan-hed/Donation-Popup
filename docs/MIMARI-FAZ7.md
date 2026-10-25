# MİMARİ — FAZ 7 (hedef mimari ve geçiş planı)

Bu belge hedefi ve geçiş yöntemini tanımlar; her modül birleşince `docs/MIMARI.md` ilgili bölümü güncellenir, eski bölüm silinir. Kurallar: CLAUDE.md bölüm 0 (global ilke) ve 13.

## 1. İlkeler
- Tema/oluşturucu/eklenti tanımayan, WordPress + WooCommerce standartları. Giriş yolları: kısa kod, blok, Woo kancalarıyla otomatik yerleşim, yedek düğme.
- Tek sorumluluklu sınıflar, açık bağımlılık (kurucu enjeksiyonu), global durum yok; her modül ayarla açılır/kapanır, **kapalıyken dosyası yüklenmez**.
- Dışa açık sözleşme DEĞİŞMEZ: kısa kodlar + öznitelikler (`[wdp_donation_form]`, `[wdp_donation_button]`, `[wdp_donation_button_panel]`, `[wdp_donations]`), mevcut kanca/filtre adları, ürün/sipariş meta anahtarları (okuma yedeğiyle), blok adları (`wdp/donation-form`, `wdp/donations`). Yeni genel API öneki Plugin Check'le doğrulanarak seçilir (7A: `donation_panel_` reddedildi; E0 doğru öneki bulur ve docs/HOOKS.md'ye yazar).

## 2. Dizin yapısı (`DonationPanel\` → `src/`; dosya adları WPCS: `class-foo-bar.php`, `interface-*.php`, `trait-*.php`; pakete gömülü basit autoloader, composer classmap-authoritative; kural dosyası `phpcs-src.xml.dist`, gevşetme yok — 7A bulgusu)
```
src/
  Core/        Plugin, Container, ModuleRegistry, ModuleInterface, Activator, Settings (tek ayar deposu), Migrations (idempotent adımlar), Autoloader (pakete gömülü, composer classmap-authoritative)
  Domain/      Donation, DonationType, Amount (para birimi/ondalık Woo'dan), Campaign, Goal, Progress, Product (WC_Product sarmalayıcı), Order meta sözleşmesi (DonationOrderMeta)
  Modules/
    EntryPoints/   Shortcodes, Blocks, AutoPlacement (+ FallbackButton), ProductResolver (id'siz çözüm)
    Experiences/   Popup, SidePanel, InlineForm, BottomSheet (ortak FormRenderer, TemplateLoader)
    DonationTypes/ Sabit, DonorChoice, Share (hisseli), Goal/Campaign, AddOn (alt bağış)
    Campaign/      ProgressBar, Milestones, DonorCount
    SocialProof/   isteğe bağlı; yalnız toplu gerçek veri
    Impact/        etki ifadeleri ("£40 = 1 gıda kolisi")
    SideCart/      bağışlar için yan sepet (Store API), isteğe bağlı
    DonorAccount/  header simgesi, giriş/kayıt, Bağışlarım, misafir bağlama (varsayılan kapalı)
    Thanks/        teşekkür + kutlama
    TaxRelief/     vergi indirimi beyanı (varsayılan kapalı)
  WooCommerce/ Cart (Store API uzantısı), Checkout, OrderMeta (HPOS), ProductData, Currency (filtre)
  Http/        RestController tabanı + Rest/ uç noktalar (aşağıda)
  Admin/       SettingsPage, SetupWizard, ProductDataTab, Guide (yerleşik rehber), ListTables
  Frontend/    Assets (modül başına tembel), TemplateLoader, Interactivity store kayıtları
  Support/     Html, Sanitize, I18n, Money, Logger
templates/     donation-panel/…  (tema `donation-panel/` ile geçersiz kılar, Woo şablon mantığı)
assets/        build/ (wp-scripts), src/ (js, css), her modül kendi paketi
blocks/        block.json'lı bloklar (render PHP; etkileşim Interactivity)
docs/          MIMARI.md, HOOKS.md, ARASTIRMA.md
```
Eski `includes/` modül modül `src/` altına taşınır; taşınan modülün eski dosyaları AYNI birleşmede silinir (strangler). Geçiş boyunca `includes/` yükleyicisi çalışır; yeni autoloader ikisini birlikte yönetir.

## 3. Veri ve iletişim
- **REST** (`donation-panel/v1`): `GET /product/{id}/form` (render parçası + veri), `POST /validate`, `POST /cart/add` (Store API'ye köprü), `GET /progress/{id}`, `GET /donations` (bağış listesi, sayfalı), `POST /account/link-guest` (e-posta doğrulamalı), `GET /account/donations`. Nonce/yetki: yazma uçları WP REST nonce + hız sınırı; salt-okunur uçlar herkese açık veri döndürür (kişi bilgisi yok, kişisel veri yok). `wp_ajax_*` eski uçlar geçiş süresince yeni uçlara köprüdür, sonra kaldırılır; dışarıdan çağrılan eski eylem adları Faz 8'e kadar yaşar.
- **Sepet:** WooCommerce Store API (`/wc/store/v1/cart/add-item`) + Store API uzantısı (bağış alanları `extensions['donation-panel']`); blok ve klasik sepet/ödeme uyumlu. Sipariş meta yazımı tek sınıfta (`DonationOrderMeta`), HPOS API'leri.
- **Ayar deposu:** tek `donation_panel_settings` seçeneği (şemalı, sürümlü); eski `wdp_*` seçenekleri idempotent göçle okunur (eski anahtar silinmez).
- **Tutar/para birimi:** Woo'nun etkin para birimi ve biçimleri; dönüşüm yalnız `donation_panel_convert_amount` filtresi (varsayılan: dönüşüm yok). Bağdaştırıcılar site snippet'i (`docs/site-snippets/`).

## 4. Ön yüz
- **Interactivity API** (WordPress standardı; asgari WP 6.6): sunucuda render edilmiş şablon + `data-wp-*`; durum/etkileşim küçük ES modülleri; jQuery yok. Derleme `@wordpress/scripts` (modül çıktısı, `view.js` bloğa özgü, tembel). İlk yük bütçesi: kritik CSS ≤ 8 KB gz, modül JS ≤ 25 KB gz (modal/panel açılışı ihtiyaç anında dinamik import); Lighthouse mobil perf ≥ 90, erişilebilirlik ≥ 95; axe WCAG 2.2 AA 0 hata.
- **Tasarım sistemi:** `--dp-*` CSS değişkenleri (renk, yazı, boşluk, köşe, gölge, hareket); varsayılanlar temanın global stillerinden (`--wp--preset--*`, `--wp--style--*`) türetilir, yoksa nötr değerler; tema özel seçici yok; `prefers-reduced-motion`/`prefers-color-scheme`/RTL (mantıksal CSS).
- Deneyimler: popup, sağ yan panel, sayfa içi form, mobilde alttan panel (sürükleme tutamağı, güvenli alan, klavye açıkken görünür alanlar, ≥ 44 px dokunma), ortak form çekirdeği.

## 5. Genel API (docs/HOOKS.md'de belgelenir)
Filtreler: `donation_panel_amount_presets`, `donation_panel_convert_amount`, `donation_panel_frequency_options`, `donation_panel_form_fields`, `donation_panel_is_entry_point_rendered`, `donation_panel_module_enabled`. Eylemler: `donation_panel_donation_added`, `donation_panel_order_meta_saved`. Eski kancalar köprülenir; sözleşme testi korur.

## 6. Kalite kapıları (verify'a bağlı)
PHPCS WP tam (`src/` için gevşetme yok), PHPStan 6+ (yeni kod), Plugin Check temiz (yeni bulgu 0), ESLint/Stylelint temiz, JS/CSS boyut bütçesi testi, Lighthouse + axe e2e (yerel, 4 tema × 3 cihaz), sözleşme testi (kısa kod/kanca/meta), göç testleri (eski anahtarlı fixture → göç → ikinci çalıştırma değişiklik yok).

## 7. Geçiş sırası (her adım = ayrı merge; her merge: verify + yerel tam + iki uzak remote-smoke + sağlık)
- **E0 Çekirdek:** namespace/autoload (composer PSR-4 + gömülü classmap), Plugin/Container/ModuleRegistry/Settings, REST tabanı, TemplateLoader, wp-scripts derlemesi, HOOKS.md iskeleti, sözleşme testleri.
- **E1 Giriş noktaları + yedek + çözümleyici** (EntryPoints) — mevcut davranış korunur.
- **E2 Form deneyimleri + tasarım sistemi** (Experiences; REST + Store API; yeni ön yüz) — en büyük parça.
- **E3 Kampanya/ilerleme + etki ifadeleri + sosyal kanıt.**
- **E4 Yan sepet.**
- **E5 Bağışçı hesabı.**
- **E6 Teşekkür/kutlama + vergi indirimi beyanı.**
- **E7 Yönetici deneyimi** (sihirbaz, sade ayar, rehber).
Kaldırılan eski dosyalar her adımda MIMARI.md'ye yazılır; `includes/` sıfırlanınca `phpcs.xml.dist` istisnaları silinir.
