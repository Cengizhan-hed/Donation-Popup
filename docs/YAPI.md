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
└── (kök yapılandırma)          phpcs.xml.dist, phpstan.neon (+ phpstan.dead.neon), phpunit.xml.dist, rector.php,
                                psalm-taint.xml, eslint.config.mjs, .stylelintrc.json, .jscpd.json, .distignore, .gitignore
```

Kurallar:
- Dağıtıma girecek yeni üst düzey girdi eklenmez; `.distignore` + `scripts/package-wp-plugin.sh` izinli listesi ve `tests/unit/js/package-contents.test.mjs` birlikte güncellenmeden paket kökü değişmez.
- Tek PHPCS kural dosyası (`phpcs.xml.dist`, gevşetme yok) ve tek PHPStan yapılandırması (`phpstan.neon`, seviye 6, baseline yok).
- Kod karnesi: `npm run code:report` → `build/handoff/KOD-KARNESI.md`.
