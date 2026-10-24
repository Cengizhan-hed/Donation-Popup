# CLAUDE.md — woo-donation-popup

Her oturumun başında oku. Kullanıcıyla **Türkçe** konuş. Bu dosya tek kaynaktır; ayrıntı docs/MIMARI.md (kod/altyapı) ve docs/AYAR-TURU-NOTLARI.md (kararlar/notlar).

## 1. Ürün vizyonu (her kararın ölçütü)

- **Genel eklenti.** WooCommerce kurulu her sitede, her temada ve sayfa oluşturucuda, kurulum dışında ek iş gerektirmeden harika çalışır. Site, ülke, dil, para birimi, tema ya da ödeme yöntemi varsayımı koda gömülmez; değerler WooCommerce/WordPress'ten okunur ya da ayar olur.
- **Test siteleri yalnız test ortamıdır.** Site adları yalnız test ortam profillerinde geçer; kodda, ekran metinlerinde, eklenti başlığı/açıklamasında, belgelerde ve adlandırmada geçmez (temizlik Faz 6). **Karar (2026-10-24):** eklenti adı "Donation Panel for WooCommerce", yazar Cengizhan Çoban; klasör adı ve text domain değişmez (`woo-donation-popup`). WordPress.org dizininde ad çakışması varsa kullanıcıya bildirilir. Uygulama Faz 6.
- **Bağışçı:** çok kolay, hızlı, güven verici; sade ama çok güzel. %90+ mobil → **mobil birinci öncelik**, mobilde masaüstünden de iyi; masaüstü de kusursuz.
- **Yönetici:** kolay kurulum, akıllı varsayılanlar, az ve anlaşılır ayar, her ayarın altında kısa açıklama, modern yönetim ekranı, iyi kullanım rehberi.
- **WooCommerce ile %100 uyum:** para birimi, ondalık, ayırıcılar, mağaza ülkesi, vergi, sepet, ödeme (blok + klasik), sipariş, HPOS, çoklu para birimi yalnız WooCommerce'in standart yollarıyla. Belirli ödeme yöntemine ya da çoklu para birimi eklentisine özel kod yok.
- **Kapsam:** yalnız iyi bağış almak için gereken. WP/Woo/tema/sayfa oluşturucunun yaptığı eklenmez (sayfa içeriği, gizlilik metinleri, sipariş listesi, e-posta, dışa aktarma). Gizlilik metni sitede; eklenti yalnız formun altında bağlantı gösterir. Yeni özellik gerekiyorsa önce kullanıcıya gerekçeyle sorulur.
- **Genel düşünme kontrolü (her parçada):** "Başka bir WooCommerce sitesinde (farklı tema, ülke, dil, para birimi, ödeme yöntemi, sayfa oluşturucu, kalabalık eklenti listesi) mobilde ve masaüstünde aynı kalitede çalışır mı?" Hayırsa genel çözüm; bir ortamda görülen hata genel durumda düzeltilir ve test genel durumu kapsar.
- **Veri bütünlüğü:** bağışçının yazdığı alanlar (ithaf, kim adına, hissedar adları, telefon, e-posta) sipariş kaydına eksiksiz ve Türkçe karakterleri bozulmadan ulaşır; hiçbir ayar (anonim dahil) bunları sipariş kaydından silmez/maskelemez.

## 2. Güvenlik kuralları (istisnasız)

**Uzak ortamlar (yalnız bunlar):**

| Profil | SSH alias | WP yolu | Not |
|---|---|---|---|
| staging-hedef | `hedef-staging` | `~/www/staging30.hedefdernegi.org/public_html` | Canlının kopyası, gerçek bağışçı verisi; Avada, Curcy TL/EUR/USD |
| ikram-aid | `ikramaid` | `~/www/ikramaid.uk/public_html` | Blocksy + Elementor, GBP, coming soon açık |

- Kilit **klasör yoluna** göre: `hedef-staging` kullanıcısı canlıya da erişebilir; `~/www/staging30.hedefdernegi.org` dışı her yol yasak. Canlı (`hedefdernegi.org`, `~/www/hedefdernegi.org`) hiçbir koşulda hedef olamaz. Tüm uzak komutlar `scripts/lib/remote-guard.mjs` merkezi korumasından geçer; `build/handoff/REMOTE_FREEZE` varken uzak komut yok.
- **Testler siteye zarar veremez:** yalnız kendi oluşturup benzersiz işaretlediği kayıtları siler. Sayfa, menü, kullanıcı, WooCommerce sayfası, ortam dosyası, site ayarı oluşturulmaz/silinmez/değiştirilmez. Mutasyon yalnız `e2e:bootstrap` ile oluşturulan işaretli, gizli test ürünlerinde. Her uzak koşu öncesi/sonrası kanarya; beklenmeyen fark → `CANARY-ALERT`. Fark test penceresi dışında ve test kodunun yazmadığı bir ayardaysa **yalnız o ortamın uzak koşuları durur**, kullanıcıya bildirilir, diğer her şey (yerel işler, öteki ortam, sonraki fazların yerel kısmı) devam eder. Fark test kodundan geliyorsa tüm uzak koşular durur. Gerçek kaydı test onarmaz. Site sahibi ayarı kendisi değiştirdiyse: `npm run e2e:canary -- --env X --accept-user-option anahtar1,anahtar2` (yalnız adı verilen anahtarlar tabana işlenir; başka fark varsa red).
- **Uzaktan veri gönderilmez:** uzakta sipariş yok (ödeme sayfası açılır, ürün/tutar doğrulanır, alan doldurulmaz). Sipariş/HPOS denemeleri yalnız yerelde. E-posta, SMS, ödeme, terk edilmiş sepet, webhook eklentilerine dokunulmaz. Uzak koşularda ölçüm/reklam servisleri (Meta, Google Analytics/Tag Manager/Ads vb.) tarayıcıda varsayılan engelli. Wordfence: oturum bir kez açılır, yeniden kullanılır; tekrarlı giriş yok.
- **Gizli/kişisel veri:** `~/.ssh`, `.env*`, `tests/e2e/.auth/**`, `*.pem`, `*.key` okunmaz. Gerçek sipariş/müşteri/kullanıcı/eklenti ayarı değeri ekrana, günlüğe, rapora, ILERLEME.md'ye yazılmaz; yalnız sayı ve hash.
- **Kritik kapılar (kullanıcı onayı):** site görünürlüğü, canlıya dokunan her şey, ödeme/e-posta/SMS ayarları. Accept, commit, push, main'e merge: toplu onay verildi (2026-10-22) — her parça testleri geçince yapılır.
- **Cursor da bağlı:** Cursor ssh/scp/sftp/rsync/uzak komut çalıştırmaz (`.cursor/cli.json` deny + operatör kapısı: uzak işlem yalnız `CLAUDECODE=1` iken). Cursor `env -u CLAUDECODE` ile başlatılır. Canlı yol/alan adı Cursor'un yazdığı hiçbir betikte hedef olamaz (verify taraması). İncelemede Cursor'un komutları ve yolları kontrol edilir.

## 3. Rol ve çalışma düzeni

| Kim | Ne yapar |
|---|---|
| Claude Code | **Varsayılan (CLAUDE MODU): kodu kendisi yazar**; büyük ve bölünebilir işleri paralel olarak Cursor'a ayrı worktree'lerde verir. Planlar, inceler, testleri ve **tüm uzak işlemleri** yürütür, accept/commit/merge. `.claude/**` ve gizli dosyalar yasak |
| Cursor CLI (`agent`) | Verilen büyük işleri yazar, yerel verify/test/E2E koşar, RAPOR yazar. Uzak komut, commit, push, merge, accept yok |
| Kullanıcı | Yalnız iş kararları ve kritik kapılar |

- **Kod yazma modları:** CLAUDE MODU (varsayılan). Kullanıcı **"CURSOR MODU"** yazınca ya da kullanım limiti uyarısı görününce: Claude yalnız yönetir ve inceler, kodu Cursor yazar. Her parça sonunda `build/handoff/SIRADAKI-IS.md` güncellenir (sıradaki işler, kabul şartları, güvenlik kuralları, son durum); Claude limiti dolarsa Cursor bu dosyayla yalnız yerelde devam edebilmeli.
- **Onay beklerken:** yalnız o karara bağlı iş durur; bağımsız işler sürer. "Her şey durdu" durumu olmaz.

- **Görev verme:** `build/handoff/GOREV-<kod>.md` (+ ortak kurallar `GOREV-ORTAK.md`). Parça ≤ ~30 dk. Bağımsız parçalar ayrı git worktree'lerinde paralel (`../wt-<kod>`, dal `<kod>`; node_modules/vendor sembolik bağ). Başlatma:
  `cd ../wt-X && env -u CLAUDECODE -u CLAUDE_CODE_SESSION_ID agent -p --trust --force --model auto "$(cat <ANA>/build/handoff/GOREV-X.md)" > <ANA>/build/handoff/cursor-log-X.txt 2>&1` (arka planda).
- Her `agent -p` yeni sohbettir; görev metni kendi başına yeterli olmalı (şablon: Dal/Sürüm, Amaç, Bağlam dosya:satır, Yapılacaklar, Kanıt şartı, Dokunma, Bitiş). Kod değiştiren her görev docs/MIMARI.md'nin ilgili bölümünü günceller.
- **İnceleme:** önce `RAPOR-<kod>.md`, sonra yalnız değişen satırlar (`git diff`); ekran değişikliğinde `__1-yeni/__2-eski/__3-fark` PNG'leri. Uzun günlük/çıktı doğrudan okunmaz; betikler özet üretir. Kanıt, tahmin değil.
- **Kesintisiz:** kritik kapılar dışında durma. Cursor çalışırken en geç 10 dk'da bir kontrol; beklerken sonraki parçayı hazırla. 20 dk ilerleme yoksa sebebi araştır, parçayı böl.
- Her parça kendi testleriyle geçince ayrı commit + merge. Bir sürüm = tek konu.
- **ILERLEME.md** (`build/handoff/`): Claude, Cursor ve alt ajanlar en geç 10 dk'da bir satır, en alta, gerçek saatle: `SAAT – KİM – NE BİTTİ – ŞU AN – SIRADA`. Parça başında tahmini süre; aşılırsa neden. Test sonucu tek satır: ortam, tema, cihaz, geçen/kalan/hata, süre. Parça sonunda ayırıcı + kısa özet.
- **Dosya disiplini:** belgeler yalnız CLAUDE.md, docs/MIMARI.md, docs/AYARLAR.md, docs/AYAR-TURU-NOTLARI.md, build/handoff/. Karar ve notlar anında AYAR-TURU-NOTLARI.md'ye.
- **E2E kuralları:** `e2e:accept` yalnız ekranlar incelendi + beklenen değişiklik + işlevsel hata 0. Sıra: inceleme → (zamanlama değiştiyse) `e2e:stability` → taze `e2e:quick` → accept → commit. Testte `.catch(() => {})` yasak. Eşik: sayfa ≤ %0.5 (≤16 px yükseklik farkı sayılmaz), kabuk ≤ %0.1.
- **Merge kriteri (2026-10-24):** `verify` + yerel tam paket yeşil + uzak kısa kontrol (`e2e:remote-smoke`) iki ortamda yeşil. Uzak **tam paket yalnız faz sonunda ve bilgi amaçlı**; hataları önce yerelde benzetimle üret. Uzak zaman aşımları ortam profilinden ayarlanır (sunucu yavaşlığı).
- **Test hızı:** işlevsel testlerin çoğu yerelde; uzak yalnız ortama özgü kontrol ve parça sonu doğrulaması. Sabit bekleme yok (olay/öğe bazlı). `e2e:quick` hedefi < 5 dk. Cihaz önceliği: iPhone (WebKit) → Android (Chromium) → masaüstü (Chrome); her bağış akışı üç cihazda.

## 4. Kullanıcıyla iletişim

- Türkçe, kısa; ayarlar kompakt tablo; komut tek kopyala-yapıştır blok. Kullanıcı teknik değil: onay gerektiren komuttan önce ne yapacağını ve "yalnız okur / dosya değiştirir / geri alınması zor" olduğunu tek cümleyle yaz.
- Teknik kararları Claude verir ve raporda "Alınan teknik kararlar" olarak yazar; kullanıcıya yalnız iş kararları sorulur (numaralı, seçenekli, öneri işaretli, toplu).
- Şifre, token, `.env` değeri asla sohbete veya dosyaya yazılmaz.
- Faz sonunda AŞAMA ÖZETİ mesajı (dosya değil): ne doğrulandı, sürümler/commit'ler, açık sorunlar, kararlar, sıradaki adım; en fazla 1 sayfa.
- Her mesajın son satırı: `✅ BİTTİ – sıra sende` / `⏳ BEKLİYOR – Cursor çalışıyor, bitince kendim devam edeceğim` / `❓ ONAY GEREKİYOR – <ne için>`. Cursor çalışırken ✅ yazılmaz.

## 5. Proje

- Eklenti `woo-donation-popup`. Repo GitHub `Cengizhan-hed/Donation-Popup` (private), remote `origin`.
- Canlı Hedef sitesi: eklenti 10.3.1, **dokunulmaz** (Faz 9'a kadar).
- İş bağlamı: bağış → saha ekipleri → iş yapılır → bağışçıya video. Elden bağış yok. Çok para birimi (Hedef TL/EUR/USD Curcy; Ikram GBP + Gift Aid ileride).

| Komut | Ne |
|---|---|
| `npm run verify` / `npm run test` | Derleme + smoke (+ canlı hedef taraması) / PHPUnit + JS birim |
| `npm run test:local-wp` | Yerel WP (PHP + SQLite) kanıt ortamı |
| `npm run e2e:bootstrap [-- --dry-run] --env X` | İşaretli, gizli test ürünleri |
| `npm run remote:discover -- --env X` | Uzak salt okunur keşif (yalnız Claude) |
| `npm run ship:staging` / `ship:ikram` | Paketle + izinli uzak ortama kur + e2e:quick (yalnız Claude) |
| `npm run e2e:quick` / `e2e:full` / `e2e:matrix` | iPhone + değişen alan / 3 cihaz × ortam / tema matrisi |
| `npm run e2e:remote-smoke -- --env X` | Uzak kısa kontrol: kritik bağış akışları (yalnız Claude) |
| `npm run e2e:accept` / `e2e:stability` / `e2e:perf` / `e2e:canary` | Baseline kabul / kararlılık / hız / kanarya |
| `npm run lint:php` / `analyse:php` / `plugin-check` | PHPCS (WordPress standartları) / PHPStan / WordPress Plugin Check — yalnız geliştirme, pakete girmez, siteye kurulmaz |
| `npm run handoff [-- --screens a,b]` | Teslim klasörü `~/Desktop/e2e-inceleme` |

## 6. Yol haritası

Faz 1 güvenli bağlantı ✅ → Faz 2 göç provası ✅ → Faz 3 bekleyen işler ✅ → Faz 4 tema/Woo uyum matrisi ✅ → **Faz 5 dil desteği** (kaynak dil İngilizce + tr_TR çeviri; `.pot`; JS `wp.i18n`; Elementor widget adları; telefon ön eki mağaza ülkesinden; tutar/yüzde/tarih WooCommerce/WordPress ayarlarıyla; RTL; Ikram İngilizce, Hedef Türkçe — Hedef'te görünen metinler birebir korunur) → **Faz 6 refaktör** (Graphify kod haritası [GRAPHIFY_BACKEND=none]; özellik envanteri Çekirdek / WP-Woo zaten yapıyor / Gereksiz; Curcy/WOOCS/WPML ve Avada/Divi özel kodları standart yollara; "sadaka" iç adı → genel ad, eski DB anahtarları idempotent göçle korunur, göç provası tekrarlanır; site adı + eklenti adı/yazar + README; ölü/tekrar kod; yönetici ve ön yüz dosyaları yalnız gereken sayfada yüklenir; kaldırma/birleştirme önerileri TOPLU karar listesi) → **dur, AŞAMA ÖZETİ, Faz 7'ye başlama** → Faz 7 bağışçı deneyimi + tasarım (tasarım claude.ai'da hazırlanıp onaylanır; G listesi, yönetici ekranı, rehber; **"Bağışçı Hesabı" modülü**: isteğe bağlı, varsayılan kapalı; header kişi simgesi (kısa kod/blok/Elementor widget'ı); giriş/kayıt/şifre sıfırlama popup'ı (mobilde alttan panel); Bağışlarım paneli (WooCommerce Hesabım içinde: bağış türü, proje, durum, makbuz, tekrar bağış); önceki misafir bağışlarının e-posta doğrulamasıyla hesaba bağlanması; ödeme sayfasında hesap oluşturma seçeneği; kimlik doğrulama ve güvenlik tamamen WooCommerce/WordPress altyapısıyla; **tasarım onaylanana kadar kod yazma**) → Faz 8 güvenlik denetimi + WP gizlilik araçları uyumu → Faz 9 canlıya alma (Curcy/e-posta/SMS/POS testlerini kullanıcı yapar).

**Araçlar (yalnız proje klasöründe, dev bağımlılığı):** WordPress Plugin Check (yerel WP + WP-CLI), PHPCS + WordPress Coding Standards, PHPStan + WordPress/WooCommerce tanımları; hepsi `verify`'a bağlı. Mevcut hatalar yalnız listelenir/kategorize edilir, ilgili fazda düzeltilir; **yeni kodda hata sıfır**. Graphify Faz 6 başında yalnız kod modunda.

## 7. Durum (2026-10-24, Faz 1–4 sonu — Faz 5 öncesi DUR)

- `main` = 10.33.0. `ikram-ortam` = **10.34.15** (127 commit önde; tüm parçalar test geçince birleşti, push'lu). main'e merge: uzak tam paket yeşil olunca (açık kırmızılar aşağıda).
- Uzak sürümler: staging30 **10.34.15**, Ikram **10.34.13** (10.34.15 kurulumu kanarya ile durdu — Ikram'da 3 ödeme yöntemi (çek/havale/kapıda) "açık"a geçmiş; test kodunda uzak yol yok; kullanıcıya soruldu). **Tüm uzak koşular kullanıcı yanıtına kadar DURDU.**
- Son doğrulama: yerel full 302/0/0, matris 12×11/0; staging30 full 202/81/5; Ikram full 225/66/7 (10.34.13).
- Güvenlik altyapısı: merkezi koruma + klasör kilidi, ağ koruması (canlı/emekli/yabancı yazma, sipariş yok), ortam+koşu defteri, ortam kilidi, kanarya öncesi/sonrası + `e2e:bootstrap --repair`, keşif snippet/kanca host raporu.
- Bulgu listesi ve kararlar: docs/AYAR-TURU-NOTLARI.md (T1–T19, S1–S3b, A1–A6, G28–G33, P1, M1–M5).
- Açık (eski): Curcy sipariş kur meta (Faz 9), KVKK dışa aktarma/silme + `wdp_vid` çerez kaydı (Faz 8), `wdp_render_modal` nonce'suz (Faz 8), Ikram İngilizce sitede Türkçe etiketler (Faz 5).
