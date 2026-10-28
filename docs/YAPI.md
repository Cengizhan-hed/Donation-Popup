# Klasör yapısı (12.0.0)

Her klasörün tek cümlelik görevi. "Paket" sütunu dağıtım zip'inde olup olmadığını gösterir (zip kökü yalnız: ana eklenti dosyası, `uninstall.php`, `readme.txt`, `src/`, `assets/` (derlenmiş), `templates/`, `blocks/`, `languages/`; `test:package` bunu sıkı denetler).

```
woo-donation-popup/
├── woo-donation-popup.php      Eklenti başlığı + önyükleme (paket)
├── uninstall.php               Kaldırma temizliği (paket)
├── readme.txt                  WordPress.org açıklaması + değişiklik günlüğü (paket)
├── src/                        PHP çalışma zamanı kodu, ad alanı DonationPanel\ (paket)
│   ├── Core/                   Önyükleme, otomatik yükleyici (gömülü, `is_file` taramalı; classmap yok), modül kaydı, ayarlar, göçler
│   ├── Domain/                 Bağış iş kuralları (WooCommerce okuma API'sini kullanır; Modules/Cart_Hooks'a bağımlı değildir)
│   ├── WooCommerce/            Sepet, ödeme, sipariş ve HPOS bağlantıları (yalnız standart kancalar)
│   ├── Http/                   REST uçları ve istek sınırlayıcı
│   ├── Admin/                  Yönetici ekranı, sihirbaz ve rehber
│   ├── Frontend/               Ön yüz varlık yükleme ve şablon bulucu
│   ├── Modules/<Modül>/        Ayarla açılıp kapanan modüller (kapalıyken yüklenmez)
│   ├── Privacy/                WordPress dışa aktarma/silme araçları ve sipariş gizliliği
│   ├── Compat/                 Dışa açık kısa kod/kanca/meta sözleşmesi (geriye dönük uyum)
│   ├── Cli/                    WP-CLI komutları
│   └── Support/                Küçük yardımcılar (fiyat, güvenlik, günlük, telefon ülkeleri)
├── assets/                     Ön yüz ve yönetici varlıkları
│   ├── build/                  Derlenmiş çıktı (paket); `npm run build` üretir, repoda yok
│   └── src/                    Modern JS/CSS kaynağı (pakete girmez)
├── templates/                  Temadan `donation-panel/` ile geçersiz kılınabilir şablonlar (paket)
├── blocks/                     Gutenberg blok tanımları (block.json + editör betiği) (paket)
├── languages/                  .pot / .po / .mo / JSON çeviriler (paket; `parts/` hariç)
│   └── parts/                  Modül başına çeviri parçaları; `i18n:merge` birleştirir (pakete girmez)
├── tests/                      PHPUnit, JS birim, smoke, e2e (Playwright), altın kayıtlar
├── scripts/                    Geliştirme betikleri: paketleme, kalite kapıları, test koşturucular, uzak koruma
├── tools/                      Çeviri, lint, rector, psalm araçları ve ayar dosyaları (yalnız geliştirme)
├── docs/                       Mimari, ayarlar, hook, gizlilik, güvenlik, canlıya alma belgeleri
├── dev/                        Geliştirme malzemesi (pakete girmez)
│   ├── design/approved/        Onaylı bağlayıcı tasarım (TASARIM-SPEC.md + *.dc.html)
│   ├── design/showcase/        Tasarım vitrini ve ekran görüntüleri
│   └── research/               Rakip/WordPress araştırma notları (git dışı)
├── build/                      Üretilen çıktılar: zip, lint raporları, teslim notları (git dışı)
├── vendor-dev/                 Composer geliştirme araçları (git dışı)
└── (kök yapılandırma)          phpcs.xml.dist, phpstan.neon, phpunit.xml.dist, rector.php,
                                psalm-taint.xml, eslint.config.mjs, .stylelintrc.json, .jscpd.json, .distignore, .gitignore
```

Kurallar:
- Dağıtıma girecek yeni üst düzey girdi eklenmez; `.distignore` + `scripts/package-wp-plugin.sh` izinli listesi ve `tests/unit/js/package-contents.test.mjs` birlikte güncellenmeden paket kökü değişmez.
- Tek PHPCS kural dosyası (`phpcs.xml.dist`, gevşetme yok) ve tek PHPStan yapılandırması (`phpstan.neon`, seviye 6, baseline yok).
- Kod karnesi: `npm run code:report` → `build/handoff/KOD-KARNESI.md`.
- Ölü kod yapılandırması `tools/phpstan.dead.neon` (kökte ikinci neon yok); lint tabanı (baseline) yok.

## Dosya dizini (tek satır amaç)

Kural: amacı tek satırda yazılamayan dosya silinir. `src/` ve `assets/src/` dosya dosya, diğerleri klasör/grup düzeyinde listelenir.

### src/ (PHP, ad alanı `DonationPanel\`)

| Dosya | Amaç |
|---|---|
| `Admin/Product/class-product-admin.php` | Ürün yönetimi girişi: veri sekmesi, liste sütunu/toplu işlemler, varlıklar. |
| `Admin/Product/class-product-assets.php` | "Donation" sekmesinin CSS/JS'i yalnız ürün düzenleme ekranında yüklenir. |
| `Admin/Product/class-product-data-tab.php` | WooCommerce ürün veri sekmesi "Donation" (standart sekme API'si). |
| `Admin/Product/class-product-list.php` | Ürün listesinde "Donation" sütunu ve bağış ürünü toplu işlemleri. |
| `Admin/Product/class-product-settings.php` | Sekmeden gelen alanları doğrular, ürün meta eşlemesine çevirir. |
| `Admin/class-admin-assets.php` | Yönetici CSS/JS'i yalnız eklentinin kendi ekranlarında (Y6). |
| `Admin/class-admin-bootstrap.php` | Tek üst menü "Bağış Paneli", alt sayfalar, eski adres yönlendirmeleri. |
| `Admin/class-admin-controller.php` | Yönetici REST uçları: ayar kaydı, sihirbaz ilerlemesi, dışa/içe aktarma. |
| `Admin/class-admin-view.php` | Yönetici ekranı çıktı yardımcıları (kabuk, kart, satır, anahtar, alan). |
| `Admin/class-campaign-totals-controller.php` | Kampanya toplamı REST uçları: devreden tutar, önizlemeli yeniden hesap. |
| `Admin/class-field-registry.php` | Yönetici ayar alanlarının tek kaynağı (sayfa, bölüm, etiket, tip, doğrulama). |
| `Admin/class-guide.php` | Yerleşik rehber alt sayfası + WordPress bağlamsal yardım sekmeleri. |
| `Admin/class-pages.php` | Yönetici alt sayfalarının çıktısı (Genel Bakış … Araçlar). |
| `Admin/class-settings-store.php` | Yönetici ayarlarının okuma/yazma katmanı, doğrulama ve eski seçenek yansıtması. |
| `Admin/class-setup-wizard.php` | Beş adımlı, atlanabilir kurulum sihirbazı. |
| `Admin/class-status.php` | Genel Bakış durum kutusu ve kurulum ilerlemesi (yalnız okur). |
| `Cli/class-cli-command.php` | WP-CLI `wp donation-panel recalc-totals` (varsayılan kuru çalıştırma). |
| `Cli/class-totals-recalculator.php` | Kampanya toplamı önizlemesi (salt okunur): saklanan ↔ formülle hesaplanan. |
| `Compat/class-legacy-context.php` | Eski iç adlar için okuma bağdaştırıcıları (`wdp_form_context` süzgeci vb.). |
| `Compat/class-public-contract.php` | Dışa açık kısa kod/kanca/meta sözleşmesi (TEK uyumluluk dosyası). |
| `Core/class-autoloader.php` | Pakete gömülü otomatik yükleyici (`DonationPanel\` → WPCS dosya adı). |
| `Core/class-bootstrap.php` | Etkinleştirme/devre dışı bırakma, HPOS uyumu, çeviri, sürüm güncelleme. |
| `Core/class-container.php` | Basit bağımlılık kabı (üreticiler + kurucu enjeksiyonu). |
| `Core/class-legacy-settings-importer.php` | Eski `wdp_*` seçeneklerini yeni ayar deposuna idempotent içe alır. |
| `Core/class-migrations.php` | Sürüm kapılı, idempotent göç çalıştırıcısı. |
| `Core/class-module-registry.php` | Ayarla açılıp kapanan modüller; kapalı modülün dosyası yüklenmez. |
| `Core/class-plugin.php` | Eklentinin tek girişi: kabı kurar, kancaları bağlar, modülleri açar. |
| `Core/class-release-12-upgrade.php` | 12.0.0 yükseltme adımı: eski çekirdek artıklarını temizler. |
| `Core/class-settings.php` | Şemalı, sürümlü tek ayar deposu `donation_panel_settings`. |
| `Core/class-uninstall.php` | Kaldırma: ürün ayarları ve eklenti seçenekleri; sipariş/HPOS dokunulmaz. |
| `Core/class-version-migrations.php` | Sıralı, idempotent, loglanan veritabanı göç adımları. |
| `Core/interface-module-interface.php` | Modül sözleşmesi. |
| `Domain/class-addon-product-visibility.php` | Alt bağış WC ürün bağlantılarını bilgi amaçlı izler. |
| `Domain/class-addon-settings.php` | Ek bağış ürün ayarları ve tutar doğrulama. |
| `Domain/class-amount-limits.php` | Tek bağış tutarı üst sınırı (doğrulayıcı ve fiyat çözücü ortak). |
| `Domain/class-amount-presets.php` | Hızlı bağış tutarları: varsayılanlar ve kayıtlı liste. |
| `Domain/class-button-settings.php` | Düğme ayarları: okuma ve eski anahtarları yeni şemaya taşıma. |
| `Domain/class-campaign-formula.php` | Kampanya toplamı formülü (tek yer): devreden + başlangıçtan sonra ödenenler. |
| `Domain/class-campaign-goal.php` | Hedefli kampanya: hedefe ulaşma kararı, mesaj, kapatma kapısı. |
| `Domain/class-campaign-totals.php` | Sipariş durumuna göre artımlı toplam, bağışçı sayısı, önbellekler. |
| `Domain/class-cover-fee.php` | İşlem ücretini karşılama: yüzde sınırı ve tutara uygulama. |
| `Domain/class-donation-scope.php` | Ürünün bağış ürünü sayılıp sayılmadığı (işaret + genel kapsam + tip). |
| `Domain/class-donation-type.php` | Bağış tipi (sabit / serbest / hisseli / kampanya) ve eski meta bayrakları. |
| `Domain/class-named-lock.php` | `add_option` tabanlı kısa ömürlü atomik kilit. |
| `Domain/class-placement-settings.php` | "Ürün sayfası ve liste" yerleşim ayarları. |
| `Domain/class-privacy-notice.php` | Form altındaki gizlilik bağlantısı (metin sitede). |
| `Domain/class-product-context.php` | WC ürününden normalize form bağlamı (fiyat, hisse, addon). |
| `Domain/class-product-meta.php` | Ürün meta okuma (WP meta önbelleğinden, ek sorgu yok). |
| `Domain/class-progress-currency.php` | Toplanan tutar para birimi dönüşümü (yalnız belgelenmiş süzgeçler). |
| `Frontend/class-assets.php` | Modül başına TEMBEL varlık kaydı (§24 sıfır yük). |
| `Frontend/class-front-gate.php` | `DONATION_PANEL_DISABLE` / `general.disable_frontend` ön yüz kapısı. |
| `Frontend/class-template-loader.php` | Temanın `donation-panel/` klasörü varsayılan şablonları geçersiz kılar. |
| `Frontend/class-theme-colors.php` | WP global stil/theme.json paletinden ana ve eylem rengi seçer. |
| `Http/Rest/class-direct-donation-controller.php` | REST `POST direct`: sepetsiz bağış, ödeme adresi döndürür. |
| `Http/Rest/class-ping-controller.php` | REST `GET ping`: yalnız sürüm + modül listesi. |
| `Http/class-client-ip.php` | İstemci IP'si; vekil başlıkları yalnız güvenilen vekilden. |
| `Http/class-rate-limiter.php` | Transient tabanlı sabit pencere hız sınırlayıcı (kimlik karma saklanır). |
| `Http/class-rest-controller.php` | REST taban sınıfı: ad alanı, yetki/nonce, hız sınırı, tek tip hata. |
| `Modules/Campaign/class-campaign-module.php` | Kampanya modülü: ilerleme çubuğu, ara hedefler, bağışçı sayısı. |
| `Modules/Campaign/class-milestones.php` | Ara hedef ayrıştırma ve vuruş hesabı (saf mantık). |
| `Modules/Campaign/class-progress-controller.php` | REST `GET progress/{id}` (salt okunur, önbellekli). |
| `Modules/Campaign/class-progress-data.php` | Kampanya ilerleme verisi (kişi verisi yok). |
| `Modules/Campaign/class-progress-renderer.php` | Kampanya ilerleme kartı çıktısı (sunucuda tam). |
| `Modules/DonorAccount/block/block.json` | Bağışçı hesabı bloğu tanımı. |
| `Modules/DonorAccount/class-account-controller.php` | REST bağışçı hesabı uçları (`account/...`). |
| `Modules/DonorAccount/class-account-renderer.php` | Header simgesi, giriş/kayıt/sıfırlama penceresi, Bağışlarım listesi. |
| `Modules/DonorAccount/class-donation-history.php` | Bağışlarım veri modeli (yalnız kullanıcının kendi siparişleri). |
| `Modules/DonorAccount/class-donor-account-module.php` | Bağışçı hesabı modülü (isteğe bağlı, varsayılan kapalı). |
| `Modules/DonorAccount/class-guest-link-token.php` | Misafir bağışı hesaba bağlama belirteci (tek kullanımlık, karması saklanır). |
| `Modules/EntryPoints/Elementor/class-donation-form-widget.php` | Elementor ince katmanı: form widget'ı (yalnız kısa kodu çalıştırır). |
| `Modules/EntryPoints/Elementor/class-donations-list-widget.php` | Elementor ince katmanı: liste widget'ı (yalnız kısa kodu çalıştırır). |
| `Modules/EntryPoints/Elementor/class-elementor-compat.php` | Elementor widget kaydı (ince uyumluluk). |
| `Modules/EntryPoints/class-auto-placement.php` | Woo standart kancalarıyla ürün sayfasında otomatik giriş. |
| `Modules/EntryPoints/class-blocks.php` | Gutenberg blokları: form ve liste (PHP `render_callback`). |
| `Modules/EntryPoints/class-builder-detect.php` | Düzenleyici/önizleme tespiti (yalnız genel WP sinyalleri). |
| `Modules/EntryPoints/class-donations-list.php` | `[wdp_donations]` liste kısa kodu: sorgu, sekme, kart, önbellek. |
| `Modules/EntryPoints/class-entry-points-module.php` | Giriş noktaları modülü: otomatik yerleşim + yedek düğme. |
| `Modules/EntryPoints/class-experience-controller.php` | REST `GET experience/{id}`: kap + form HTML'i. |
| `Modules/EntryPoints/class-experience-renderer.php` | Kısa kod/blok/otomatik yerleşimin deneyimi çizdiği tek köprü. |
| `Modules/EntryPoints/class-fallback-button.php` | Hiçbir giriş çizilmediyse eklentinin yedek düğmesi (çift giriş yok). |
| `Modules/EntryPoints/class-loop-price-filters.php` | Mağaza döngüsü düğmesi ve fiyat gizleme (Woo standart süzgeçleri). |
| `Modules/EntryPoints/class-product-resolver.php` | Kısa kod/blok/widget özniteliklerinden ürünü çözer. |
| `Modules/EntryPoints/class-render-guard.php` | Çizim girişlerini hatalara karşı korur (tampon, günlük, boş çıktı). |
| `Modules/EntryPoints/class-render-registry.php` | Aynı istekte yinelenen form/kap çıktısını engeller. |
| `Modules/EntryPoints/class-shortcodes.php` | Düğme/panel/sayfa içi form kısa kodlarının ortak çizimi. |
| `Modules/Experiences/class-bottom-sheet.php` | Alttan açılan panel kabı. |
| `Modules/Experiences/class-cart-controller.php` | REST `POST cart/add` ve `GET nonce`. |
| `Modules/Experiences/class-experience-container.php` | Kap işaretlemesi seçimi (popup, yan panel, sayfa içi, alttan panel). |
| `Modules/Experiences/class-experiences-module.php` | Form deneyimi modülü: tek çekirdek + 4 kap, REST, tembel varlıklar. |
| `Modules/Experiences/class-field-validator.php` | Alan doğrulama: hata iletileri + normalize tutar. |
| `Modules/Experiences/class-form-context.php` | Ürün ayarlarından kap-bağımsız tek form modeli. |
| `Modules/Experiences/class-form-controller.php` | REST `GET product/{id}/form` ve `POST validate`. |
| `Modules/Experiences/class-form-renderer.php` | Çekirdek form + seçilen kap sarmalayıcısı (şablonlar `Template_Loader`). |
| `Modules/Experiences/class-inline-form.php` | Sayfa içi gömülü form kabı. |
| `Modules/Experiences/class-popup.php` | Ortada açılan popup (≤639 px alttan panel). |
| `Modules/Experiences/class-side-panel.php` | Yandan açılan panel (RTL soldan; ≤639 px alttan). |
| `Modules/Impact/class-impact-controller.php` | REST `GET impact/{id}`: kademeler + hazır ifadeler. |
| `Modules/Impact/class-impact-map.php` | Tutar → somut karşılık (saf ayrıştırma ve hesap). |
| `Modules/Impact/class-impact-module.php` | Etki ifadeleri modülü. |
| `Modules/Preview/class-preview.php` | `?dp_preview=1` yönetici önizlemesi (`manage_woocommerce`). |
| `Modules/SideCart/class-side-cart-controller.php` | REST `GET side-cart`: çekmece gövdesi. |
| `Modules/SideCart/class-side-cart-lines.php` | Sepet öğesinden satır gösterim modeli. |
| `Modules/SideCart/class-side-cart-module.php` | Yan sepet modülü (isteğe bağlı, varsayılan kapalı). |
| `Modules/SideCart/class-side-cart-renderer.php` | Çekmece gövdesi, tetikleyici ve kabuk çıktısı. |
| `Modules/SideCart/class-side-cart-suggestion.php` | "Bağışınıza eklemek ister misiniz?" küçük tutar kartları. |
| `Modules/SocialProof/class-donation-feed.php` | Yalnız toplu gerçek veri (kişi bilgisi yok). |
| `Modules/SocialProof/class-donations-controller.php` | REST `GET donations` ve `donations/stats`. |
| `Modules/SocialProof/class-social-proof-module.php` | Sosyal kanıt modülü (isteğe bağlı, varsayılan kapalı). |
| `Modules/SocialProof/class-social-proof-renderer.php` | Tek satır, sayaç şeridi, canlı liste çıktısı. |
| `Modules/TaxRelief/class-tax-relief-declaration.php` | Vergi indirimi beyanı: metin, özet (hash), sipariş meta yapısı. |
| `Modules/TaxRelief/class-tax-relief-module.php` | Vergi indirimi modülü (isteğe bağlı, varsayılan kapalı). |
| `Modules/Thanks/class-thanks-module.php` | "Sipariş alındı" sayfasına bağış özeti, kutlama ve paylaşım. |
| `Modules/Thanks/class-thanks-summary.php` | Kişi bilgisiz teşekkür özeti (saf mantık). |
| `Privacy/class-order-privacy.php` | WP kişisel veri dışa aktarma/silme kayıtçıları (siparişteki bağışçı alanları). |
| `Privacy/class-privacy-tools.php` | Hesap verisi dışa aktarma/silme ve gizlilik politikası önerisi. |
| `Support/class-admin-notice.php` | Yalnız yönetimde/önizlemede görünen küçük uyarı. |
| `Support/class-debug.php` | `WP_DEBUG` açıkken günlük yazar. |
| `Support/class-logger.php` | WC_Logger sarmalayıcı (kişisel veri yazmaz). |
| `Support/class-phone-countries.php` | Ülke listesi, mağaza ülkesinden varsayılan, ulusal numara uzunluğu. |
| `Support/class-price.php` | Tutar biçimi ve bağışçı tutarı ayrıştırma (Woo ayarlarıyla). |
| `Support/class-security.php` | Küçük genel güvenlik yardımcıları. |
| `WooCommerce/Checkout/class-checkout-prefill.php` | Ödeme sayfası alanlarını formda yazılanlarla ön doldurur. |
| `WooCommerce/Direct/class-direct-cleanup.php` | Süresi geçen bekleyen doğrudan bağış siparişlerini iptal eder. |
| `WooCommerce/Direct/class-direct-order-factory.php` | Tek kalemlik bekleyen sipariş üretir (idempotent, sepete dokunmaz). |
| `WooCommerce/Direct/class-direct-settings.php` | Doğrudan bağış ayarı (`_donation_panel_direct` + genel `direct.enabled`). |
| `WooCommerce/class-addon-line.php` | Ana bağışın yanına ayrı ürün/tutarla eklenen ek bağış satırı. |
| `WooCommerce/class-cart-data.php` | Form girdisini sepet öğesi sözleşmesine çevirir. |
| `WooCommerce/class-cart-hooks.php` | Sepet kancaları: bağış verisi, özel fiyat, hisse kilidi, görünüm. |
| `WooCommerce/class-cart.php` | Bağışı sepete ekler, Store API uzantısını kaydeder. |
| `WooCommerce/class-donation-order-meta.php` | Sepet bağış verisini sipariş kalemi meta alanlarına yazan tek yazıcı. |
| `WooCommerce/class-donation-purchasable.php` | Fiyatı boş serbest/hedefli bağış ürünleri satın alınabilir olur. |
| `WooCommerce/class-order-hooks.php` | Ödeme sırasında bağış/hisse verisini sipariş meta alanlarına yazar. |
| `WooCommerce/class-order-meta-keys.php` | Sipariş kalemi bağış meta anahtarları (dilden bağımsız sabitler, etiketler). |

### assets/src/, blocks/, templates/

| Yol | Amaç |
|---|---|
| `assets/src/experiences/` | Form çekirdeği: `form.mjs` (adımlar, gönderim), `store.mjs` (durum makinesi), `amount.mjs` (tutar ayrıştırma), `layer.mjs` (`<dialog>` katmanı), `keyboard.mjs` (mobil klavye), `base.css` (belirteç + form stili), `index.mjs` (giriş). |
| `assets/src/campaign/` | Kampanya paketi: ilerleme, etki ifadesi, sosyal kanıt (`format/progress/impact/social/rest.mjs`, `base/components/campaign.css`, `index.mjs`). |
| `assets/src/list/` | Bağış listesi: kategori süzgeci ve kart düğmesiyle form açma (`index.mjs`, `logic.mjs`, `list.css`). |
| `assets/src/side-cart/` | Yan sepet çekmecesi (`index.mjs`, `logic.mjs`, `side-cart.css`). |
| `assets/src/thanks/` | Teşekkür ekranı: kutlama ve paylaşım (`index.mjs`, `logic.mjs`, `thanks.css`). |
| `assets/src/donor-account/` | Bağışçı hesabı penceresi ve Bağışlarım (`index.mjs`, `logic.mjs`, `donor-account.css`). |
| `assets/src/admin/` | Yönetici ekranları: REST istemcisi, sihirbaz, kampanyalar, `admin.css` (jQuery yok). |
| `assets/src/admin-products/` | Ürün "Donation" sekmesi: alan gösterme, kısa kod kopyalama, `products.css`. |
| `assets/src/ui2-shared/` | Paketler arası ortak: `scroll-lock.mjs` (sayfa kilidi), `controls.css` (form öğesi yalıtımı), `tokens.css` (yüzey belirteçleri). |
| `assets/critical/experiences.css` | Arayüzlü sayfada satır içi basılan kritik CSS (≤ ~3 KB). |
| `blocks/donation-form/`, `blocks/donations/` | Gutenberg blok tanımı (`block.json`) + editör betiği (`index.js`). |
| `templates/donation-panel/experiences/` | Kap ve form şablonları (popup, yan panel, sayfa içi, alttan panel, form); temadan geçersiz kılınabilir. |
| `templates/donation-panel/tax-relief/step.php`, `templates/donation-panel/thanks/summary.php` | Vergi indirimi ek adımı ve teşekkür özeti şablonları. |
| `templates/woocommerce/single-product/add-to-cart/simple.php` | Basit ürün sepete ekle şablonunun bağış düğmesi/formu ile değişimi. |

### tests/, scripts/, tools/ (klasör/grup düzeyi)

| Yol | Amaç |
|---|---|
| `tests/unit/` | PHPUnit birim testleri (Core, Experiences, Hardening, Campaign, Privacy, Settings, …) ve kök düzeyi alan testleri. |
| `tests/unit/js/` | Node birim testleri: saf ön yüz mantığı, betik kitaplıkları, paket içeriği, ağ koruması. |
| `tests/integration/`, `tests/local-wp/` | Gerçek WP/Woo/HPOS entegrasyon testleri ve yerel WP kurulum yardımcıları. |
| `tests/smoke/`, `tests/security/` | Derleme sonrası duman testi; Psalm taint kanarya dosyaları. |
| `tests/e2e/run-*.mjs` | Tek komutla koşan uçtan uca koşucular (`e2e:quick/full/matrix/…`). |
| `tests/e2e/specs/` | Playwright spec dosyaları (kalite kapıları, denetimler). |
| `tests/e2e/helpers/` | E2E yardımcıları: kimlik, kanarya, ağ koruması, yakalama, senaryolar; `wdp-*-sim.php` yerel WP benzetim betikleri. |
| `tests/e2e/profiles/`, `tests/e2e/matrix.json`, `tests/e2e/area-map.json` | Ortam profilleri, tema matrisi, alan → test eşlemesi. |
| `tests/fixtures/`, `tests/golden/i18n/` | Ortak test verileri (tutar ayrıştırma vektörleri vb.) ve çeviri altın kayıtları. |
| `tests/bootstrap-unit.php` | PHPUnit sahte WP önyüklemesi. |
| `scripts/*.mjs`, `scripts/lib/` | Geliştirme betikleri: paketleme, kalite kapıları (lint/plugin-check/security), test koşturucular, yerel WP, uzak koruma (`lib/remote-guard.mjs`), yalnız Claude'un çalıştırdığı kurulum/keşif betikleri. |
| `scripts/package-wp-plugin.sh` | Dağıtım zip'i: izinli kök girdiler + `.distignore`. |
| `tools/i18n/` | Çeviri: `.pot` üretimi, `.po` birleştirme, `.mo/.json` derleme, doğrulama ve altın kayıt araçları. |
| `tools/rector/`, `tools/psalm/`, `tools/security-baseline/` | Rector yeniden adlandırma eşlemesi, Psalm taint saplamaları, güvenlik taraması tabanı/kuralları. |
| `tools/phpstan-bootstrap.php`, `tools/phpstan.dead.neon`, `tools/lint-tools.json` | PHPStan önyüklemesi, ölü kod yapılandırması, lint aracı sürüm listesi. |
| `tools/bin/` | Yerel `composer.phar`, `wp-cli.phar` (git dışı). |
