# CLAUDE.md — woo-donation-popup

Her oturumun başında oku. Kullanıcıyla **Türkçe** konuş. Bu dosya tek kaynaktır; ayrıntı docs/MIMARI.md (kod/altyapı) ve docs/AYAR-TURU-NOTLARI.md (kararlar/notlar).

## 0. GLOBAL İLKE (en üst kural; 2026-10-25) — tüm kuralların üstündedir
- **Eklenti hiçbir temayı, sayfa oluşturucuyu ya da eklentiyi tanımaz.** Elementor'a, Avada'ya, Divi'ye ya da başka bir tema/eklentiye özel kod, element, widget, CSS ya da tespit yazılmaz. Her şey WordPress ve WooCommerce standartlarıyla yapılır.
- **Giriş yolları yalnız:** kısa kod (her sayfa oluşturucu çalıştırır), blok (WP standardı), WooCommerce standart kancalarıyla otomatik yerleşim, kancalar çalışmazsa eklentinin kendi yedek düğmesi. Kısa kod ve blok `id` verilmezse bulunduğu ürünü kendisi bulur.
- **Avada (Fusion Builder) elementi YAPILMAZ** (yapıldıysa kaldırılır). Mevcut Elementor widget'ı yeni özellik almaz; yalnız kısa kodun çıktısını döndüren ince uyumluluk katmanıdır (Ikram Appeals sayfası kullanıyor). Elementor'a bağlı diğer tüm kod bu ilkeye göre kaldırılır.
- **Tema uyumu:** renk, yazı, boşluk CSS değişkenleri ve WordPress global stilleriyle (varsa theme.json ön ayarlarıyla) gelir; temaya özel seçici/düzeltme yazılmaz.
- İlke tasarım, refaktör, test ve belgelerin hepsi için geçerlidir. Bir tema/oluşturucuda sorun çıkarsa çözüm o temaya özel kod değil, eklentinin genel davranışını düzeltmektir. (Test ortam profilleri ve kara listeler site/tema adı tutabilir; üretim koduna girmez.)

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
| Claude Code | **Kod YAZMAZ** (PHP/JS/CSS/test/betik/yapılandırma dosyası düzenlemez). Planlar, işleri 15–30 dk'lık bağımsız parçalara böler, Cursor'a ayrı worktree'lerde AYNI ANDA verir, inceler, testleri ve **tüm uzak işlemleri** yürütür, commit/merge/accept yapar, belge (.md) yazar. `.claude/**` ve gizli dosyalar yasak |
| Cursor CLI (`agent`) | Verilen büyük işleri yazar, yerel verify/test/E2E koşar, RAPOR yazar. Uzak komut, commit, push, merge, accept yok |
| Kullanıcı | Yalnız iş kararları ve kritik kapılar |

- **Kod yazma düzeni (2026-10-24, eski "kod modları" kuralının yerine):** kodun TAMAMINI Cursor yazar. Küçük düzeltmeler tek görevde toplanır; görev tarifi kısa ve kesin (amaç, dosyalar, kabul şartları, testler, uzak komut yasak). Cursor çalışırken boşta beklenmez (sonraki tarifler hazırlanır, biten parçalar incelenir); incelemede yalnız değişen satırlar, uzun çıktılar özet betikle, büyük dosyalar yerine Graphify. Her parça sonunda `build/handoff/SIRADAKI-IS.md` güncellenir. **Cursor limiti dolduğunda (şu an 12 Kasım 2026'ya kadar) kod yazılmaz; kullanıcıya bildirilir ve kararı beklenir (alt ajanla kod yazma yalnız kullanıcı izniyle).** → **Güncelleme:** kullanıcı izin verdi — Cursor kullanılamıyorsa kodu Claude alt ajanları ayrı worktree'lerde yazar; Claude kendisi kod dosyası düzenlemez. **Cursor modeli kalıcı kural:** her `agent` çağrısı `--model auto` ile (Cursor editöründeki Auto); görev şablonuna da yazılır. (2026-10-24: CLI'da auto/composer-2.5/gemini dâhil tüm modeller 'usage limit' veriyor; sıfırlanma 12 Kas 2026 → alt ajan yedeği devrede. Her oturum başında `agent -p --model auto "tamam"` ile limit yeniden denenir.)
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

## 8. ANA YÖNERGE GÜNCELLEMESİ (2026-10-24; A ve B bölümleri aynen geçerli)

**Kararlar**
- Ikram'da ödeme yöntemlerini (çek, havale, kapıda) kullanıcı açtı; kanarya tabanında. Uzakta sipariş verilmez.
- staging30'da snippet #27, #29, #43, Cart Abandonment Recovery ve Slider Revolution'ı kullanıcı kapattı (dış değişiklik; kanarya tabanı güncellenir, koşular durmaz; keşifte doğrulanır). Curcy→geoplugin, Rank Math→GTM staging30'da kalır (bilgi).
- Eklenti adı "Donation Panel for WooCommerce", yazar Cengizhan Çoban; klasör/text domain `woo-donation-popup` değişmez. WordPress.org'da ad çakışması varsa bildir. Uygulama Faz 6.

**Çalışma kuralları**
- Onay beklerken yalnız o karara bağlı iş durur; bağımsızlar sürer.
- Kanarya değişikliği test penceresi dışında ve test kodunun yazmadığı bir ayardaysa yalnız o ortamın uzak koşuları durur, kullanıcıya bildirilir, gerisi sürer.
- Merge kriteri: `verify` + yerel tam paket + uzak kısa kontrol (`e2e:remote-smoke`) iki ortamda + Y6 hata karşılaştırma testi yeşil. Uzak tam paket yalnız faz sonu, bilgi amaçlı. Uzak zaman aşımları ortam profilinden.
- Üçüncü taraf eklenti/tema hataları (ör. Slider Revolution) eklentimize yüklenmez: kurulum sonrası kontrol ayırt eder, raporlar, geri dönüşü tetiklemez.
- Ikram'da dışarıya POST atan kaynak bulunur ve raporlanır.

**Kod yazma düzeni:** bkz. bölüm 3 (Cursor `--model auto`; kullanılamazsa alt ajanlar). 15–30 dk'lık bağımsız parçalar, aynı anda ayrı worktree'ler, küçük işler tek görevde, kısa kesin tarifler (amaç, dosyalar, kabul, testler, uzak komut yasağı), beklerken sonraki tarifler, incelemede yalnız değişen satırlar + özet betik + Graphify. Her parça sonunda SIRADAKI-IS.md; limit dolarsa kullanıcı "devam" yazınca oradan sürer.

**Araçlar** (yalnız proje klasörü, dev bağımlılığı, pakete girmez, siteye kurulmaz): Plugin Check (yerel WP + WP-CLI), PHPCS + WPCS, PHPStan + WP/Woo tanımları — hepsi `verify`'a bağlı; mevcut hatalar listelenir/kategorize edilir, ilgili fazda düzeltilir, yeni kodda sıfır. Graphify yalnız kod modunda (GRAPHIFY_BACKEND=none). claude-code-setup: terminal sürümü kurulup denenir (`npm i -g @anthropic-ai/claude-code`; `claude plugin install claude-code-setup@claude-plugins-official`), olmazsa eşdeğer analiz; önerilerde KURMADAN raporla; en fazla 15 dk.

**Yapılacaklar (sırayla, kesintisiz):** A) Y6 (kurulum sonrası sağlık kontrolü; açık/kapalı hata karşılaştırma testi; yönetici CSS/JS yalnız kendi ekranlarında) → B) Faz 1–4 kapanışı (kanarya tabanı, remote-smoke, güncel sürüm iki siteye, kriter sağlanınca main'e merge) → C) Araçlar → D) Faz 5 kalan doğrulamalar + uzak kurulum (Hedef Türkçe birebir; Ikram tamamen İngilizce; telefon ön eki mağaza ülkesinden; tutar/yüzde Woo sayı ayarları; tarih WP ayarları; Elementor widget adları/arama anahtar kelimeleri çevrilebilir; RTL yerel matriste) → E) Faz 6 refaktör (Graphify haritası; özellik envanteri Çekirdek/WP-Woo yapıyor/Gereksiz; Curcy/WOOCS/WPML ve Avada/Divi özel kodları standart yollara; "sadaka" iç adı genelleme + idempotent göç + iki ortamda prova; site adı temizliği, eklenti adı/yazar, README; ölü/tekrar kod; varlıklar yalnız gereken sayfada; kaldırma/birleştirme önerileri TOPLU karar listesi) → **Faz 7'ye başlamadan dur.**

**Faz 7 (yol haritası):** tasarım taslaklarını Claude hazırlar, ayrıntılı prompt o zaman verilir. "Bağışçı Hesabı" modülü: isteğe bağlı, varsayılan kapalı; header kişi simgesi (kısa kod/blok/Elementor widget'ı); giriş/kayıt/şifre sıfırlama popup'ı (mobilde alttan panel); Bağışlarım (Hesabım içinde: tür, proje, durum, makbuz, tekrar bağış); misafir bağışlarını e-posta doğrulamasıyla hesaba bağlama; ödeme sayfasında hesap oluşturma; kimlik/güvenlik tamamen WP/Woo altyapısıyla; tasarım onaylanana kadar kod yok.

**Rapor (Faz 7'den önce AŞAMA ÖZETİ):** Y6 sonucu, kapanış ve main sürümü, araç hataları (kategori+sayı), claude-code-setup önerileri, Faz 5–6 sonuçları, özellik envanteri + toplu karar listesi, Ikram dış POST kaynağı, Cursor model sorunu ve çözümü, süre dağılımı ve darboğaz.

## 9. MODEL, TOKEN VE ARAÇ KURALLARI (2026-10-24, kalıcı)
- **Model (istisnasız):** Cursor YALNIZ Auto (`--model auto`); belirli model seçilmez, Auto yoksa başka modele geçilmez → görev alt ajana. (12 Ekim'de Cursor görevleri claude-opus-5-5 ile koşunca aylık kota tek günde bitti; tekrarlanmayacak.) Claude ve alt ajanlar yalnız Sonnet; Opus yok (Agent çağrılarında `model: sonnet`). Cursor 12 Kasım 2026'ya kadar kapalı: kodu alt ajanlar yazar; sonrasında kod yine Cursor'a (Auto) döner.
- **Token:** görev tarifi dosya yolu + satır aralığı verir; kod araması önce Graphify; `GOREV-ORTAK.md` ≤ ~60 satır, ajanlar yalnız onu okur; ajanlar yalnız kendi alanının testini koşar; çıktılar özet betikle (geçen/kalan/hata + ilk hata dosya:satır); aynı dosyalara dokunan görevler paralel değil; paralel ≤ 4; başarısız görev ≤ 2 deneme sonra Claude tarifi değiştirir; mekanik toplu değişiklik (yeniden adlandırma, biçim, standart hataları) araç/betikle tek seferde, ajan yalnız doğrular.
- **Araçlar (yalnız proje, dev bağımlılığı, pakete girmez, siteye kurulmaz):** Plugin Check, PHPCS+WPCS, PHPStan (verify'a bağlı) + PHPCBF, Rector, ESLint + Stylelint, jscpd, shipmonk/dead-code-detector, lint-staged. 6-C ("sadaka" → genel ad) Rector kuralları + betikle; DB anahtarları için idempotent göç ayrı. jscpd ve dead-code çıktısı Faz 6 hedef listesi. Eski hatalar yalnız listelenir/kategorize edilir; yeni kodda hata sıfır.
- **Merge kriterine ek:** uzak açık/kapalı hata karşılaştırması (Y6) ship akışında, iki uzak ortamda; yerel `health:onoff` WooCommerce kurulu yerel WP'de Woo sayfalarını (ayarlar, siparişler, ürün düzenleme, sepet, ödeme) tam kapsar.
- **Ölçüm:** her AŞAMA ÖZETİ'nde görev başına yaklaşık token/zaman, en pahalı 3 görev, araçların ajan işini ne kadar azalttığı, sonraki faz için tasarruf önerisi.


## 10. KARARLAR (2026-10-24 gece)
- **Soru sorma kuralı:** vizyona göre karar verilebilen konular kullanıcıya sorulmaz; Claude karar verir, gerekçesini raporda "Alınan teknik kararlar"a yazar. Yalnız kritik kapılar ve gerçek iş kararları sorulur.
- **S5 kararı (Seçenek 2):** ürün sayfasında eklentinin görünür giriş noktası yoksa eklenti kendi düğmesini çizer (aynı sayfada asla iki giriş; ürün/genel ayarda otomatik yerleşim kapalıysa çizilmez; tema/oluşturucuya özel tespit yok; Avada, Blocksy, Twenty Twenty-Five, Storefront × snippet açık/kapalı testle). staging30'da `[hd_panel_buton]` snippet'i kullanıcı tarafından yeniden açıldı (kodu yalnız `do_shortcode('[wdp_donation_button_panel id="ID"]')`).
- **Geriye dönük uyum (6-C zorunlu):** tüm kısa kod adları ve öznitelikleri (özellikle `[wdp_donation_button_panel]` + `id`) HİÇ değişmez; iç adlar değişse de dışarıdan kullanılan kanca, kısa kod, meta/seçenek anahtarları geriye dönük çalışır; staging30'da snippet açıkken testle kanıtlanır.
- **ID'siz kısa kod:** `id` yoksa kısa kod/blok/widget bulundukları ürünü kendisi bulur (global $product, get_queried_object_id, Woo döngüsü; Avada/Elementor ürün şablonları dahil) — site başına ek snippet gerekmez.
- **Avada (Fusion Builder) elementi:** Elementor widget'ı ve Gutenberg bloğuyla aynı seçenekler; Avada'nın resmi element kayıt yoluyla, ayrı entegrasyon dosyasında, yalnız Avada aktifse yüklenir; çekirdek Avada'ya bağlı olmaz; "Select Element" listesinde görünür; staging30'da editörde eklenip ön yüzde çalıştığı testle kanıtlanır.

## 11. LİMİT GÜVENCESİ (kalıcı)
- Kullanım limiti her an dolabilir; hiçbir iş kaybolmamalı. Her alt ajan anlamlı her adımda kendi worktree dalına `WIP:` önekli commit atar (push yok; yalnız ilgili dosyalar, `git add -A` yasak, sembolik bağlar eklenmez). Yarım iş commit'siz diskte kalmaz.
- `build/handoff/SIRADAKI-IS.md`: her alt ajan başlarken, bitirirken ve en geç 20 dk'da bir günceller (ajan, dal/worktree, son WIP commit, kalan adımlar, sonraki komut).
- Limit dolup kullanıcı "devam" yazınca (aynı/yeni oturum): önce SIRADAKI-IS.md, ILERLEME.md son satırları ve TÜM worktree'lerin git durumu (`git worktree list`, her birinde `git status`/`git log -3`) okunur; yarım işler son WIP commit'inden sürdürülür, hiçbiri baştan başlatılmaz.

## 12. BEKLEME KURALI (kalıcı; 2026-10-25)
- Bir test ya da alt ajan beklerken turu "bitince kendim devam edeceğim" diyerek BİTİRME (gece boyu 10 saat boşa beklendi; iki kez oldu). Uzun işler arka planda başlatılır ve en geç 5 dakikada bir durumunu kontrol eden döngüyle (Monitor/until-loop + gerekirse ScheduleWakeup ≤ 300 sn) beklenir; iş bitince AYNI turda devam edilir. Tur yalnız AŞAMA ÖZETİ verirken ya da limit dolunca biter. Bildirim (task-notification) gelmese de 5 dk'lık yoklama sürer.
- Eşzamanlı yerel e2e koşuları port paylaşır: her ajan ve koşu ayrı port kullanır (`WDP_MATRIX_BASE_PORT`, `WDP_LOCAL_E2E_PORT`/`E2E_BASE_URL`), ya da yerel e2e'ler sırayla koşar.

