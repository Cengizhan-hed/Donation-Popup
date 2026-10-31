# CLAUDE.md — woo-donation-popup (kısa sürüm; 2026-10-30 token diyeti)

Kullanıcıyla **Türkçe** konuş. Ayrıntı/geçmiş: docs/KURALLAR-DETAY.md (eski tam metin, §-referansları orada), docs/KARARLAR.md, docs/MIMARI.md, docs/AYAR-TURU-NOTLARI.md, docs/HOOKS.md. Bu dosya ve GOREV-ORTAK.md sık değişmez (önbellek); yalnız ekle.

## 1. Yön ve ilkeler
- Sürüm 12.x. Test sitelerinde (staging30, Ikram) yalnız yeni deneyim; eski kod yok. Tek menü "Bağış Paneli". Onaylı tasarım bağlayıcı: `dev/design/approved/`. Kampanya toplamları göçte değişmez.
- **Global ilke:** eklenti hiçbir temayı/sayfa oluşturucuyu/eklentiyi tanımaz; Elementor/Avada/Divi'ye özel kod, seçici, tespit YOK. Yalnız WP/WooCommerce standartları. Giriş yolları: kısa kod, blok, Woo kancalarıyla otomatik yerleşim, yedek düğme. Elementor widget'ı yalnız kısa kodu döndüren ince uyumluluk katmanı. Tema uyumu CSS değişkenleri/theme.json ile; temaya özel düzeltme yok (sorun = genel davranışı düzelt).
- **Genel eklenti:** her tema, ülke, dil, para birimi, ödeme yöntemi için çalışır; mobil birinci öncelik (%90+ mobil). Site/ülke/tema varsayımı koda girmez; test site adları yalnız test profillerinde. WooCommerce ile tam uyum (HPOS, blok+klasik ödeme, Woo para/sayı ayarları). Kapsam: yalnız iyi bağış almak için gereken; yeni özellik önce gerekçeyle sorulur.
- **Veri bütünlüğü:** bağışçının yazdığı alanlar sipariş kaydına eksiksiz ve Türkçe karakterleri bozulmadan ulaşır; hiçbir ayar bunları silmez/maskelemez.
- Dışa açık kısa kod/kanca/meta anahtarları değişmez (uyumluluk dosyası + sözleşme testleri). `[wdp_donation_button_panel]`, `[wdp_donation_form id= layout=]`, `id` yoksa bulunduğu ürünü kendisi bulur.

## 2. Güvenlik (istisnasız)
- Uzak ortamlar yalnız: `hedef-staging` (`~/www/staging30.hedefdernegi.org/public_html`) ve `ikramaid` (`~/www/ikramaid.uk/public_html`); kilit klasör yoluna göre. **Canlı (hedefdernegi.org) hiçbir koşulda hedef olamaz**; kurulumu kullanıcı zip'ten yapar (`build/woo-donation-popup.zip`, docs/CANLIYA-ALMA.md). Tüm uzak komutlar `scripts/lib/remote-guard.mjs`'den geçer; `build/handoff/REMOTE_FREEZE` varken uzak yok. Uzak komutları yalnız Claude ana oturumu yürütür; ajanlar/Cursor uzak komut çalıştırmaz.
- Testler siteye zarar vermez: yalnız kendi işaretli kayıtlarını siler; sayfa/menü/kullanıcı/Woo sayfası/site ayarı oluşturulmaz-silinmez-değişmez; mutasyon yalnız `e2e:bootstrap` ürünlerinde. Her uzak koşu öncesi/sonrası kanarya (yalnız hash). Beklenmeyen fark test penceresi dışındaysa yalnız o ortamın uzak koşuları durur ve kullanıcıya bildirilir; test kaynaklıysa tüm uzak koşular durur. Yöneticinin içerik düzenlemesi "dış değişiklik (otomatik kabul)"; kullanıcı ayarı kendi değiştirdiyse `e2e:canary -- --env X --accept-user-option anahtar`.
- Uzakta sipariş/alan doldurma/e-posta/SMS/ödeme/webhook yok; sipariş denemeleri yalnız yerelde. Uzakta ölçüm/reklam servisleri engelli. Wordfence oturumu bir kez açılır.
- e2e varsayılan ortamı `local`; uzak yalnız açık `--env staging-hedef|ikram-aid`.
- Gizli/kişisel veri: `~/.ssh`, `.env*`, `tests/e2e/.auth/**`, `*.pem`, `*.key` okunmaz; gerçek sipariş/müşteri/ayar değeri ekrana/rapora yazılmaz (yalnız sayı/hash). Şifre/token sohbete yazılmaz.
- Kritik kapılar (kullanıcı onayı): site görünürlüğü, canlıya dokunan her şey, ödeme/e-posta/SMS ayarları. Commit/push/main merge: parça testleri geçince toplu onaylı.
- Soru kuralı: vizyona göre karar verilebilen konular sorulmaz; Claude karar verir, rapora "Alınan teknik kararlar" yazar. Yalnız kritik kapı ve gerçek iş kararı sorulur (numaralı, öneri işaretli, toplu).

## 3. Rol ve çalışma düzeni
- **Claude ana oturum kod YAZMAZ/DÜZENLEMEZ** (PHP/JS/CSS/test/betik/yapılandırma; `.claude/**` ve gizli dosyalar yasak; hata: python/sed ile elle kod değiştirme de yasak, çakışmayı ajana çöz). Planlar, görevlendirir, inceler, testleri ve tüm uzak işlemleri yürütür, commit/merge yapar, .md yazar. Kodu **alt ajanlar** yazar (Cursor limitli; 12 Kas 2026'ya kadar kapalı, sonra `--model auto`).
- **Model (12.3 diyeti):** ana oturum **Sonnet 5.5**. Opus 5.5 yalnız gerçekten zor kod işinde ve tek görevde (gerekçe ILERLEME'ye); **Fable yok**; mekanik işler (test koşturma, özet, biçim, belge) **Haiku**.
- **Paralellik ≤3 ajan**, tek konulu birleştirilmiş görevler; aynı dosyalara dokunan görevler paralel koşmaz. Her ajan ayrı port, ayrı worktree (`git worktree add ../wt-<kod> -b <dal>` + `npm run wt:prepare -- <mutlak yol>`; sembolik bağ yok). İşi biten worktree aynı turda silinir. Başlamadan `npm run resource:gate` (disk ≥10 GB zorunlu, ≥20 hedef; `clean:disk`).
- **Görev tarifi:** `build/handoff/GOREV-<kod>.md` (kısa, kesin: amaç, dosya sahipliği, kabul, testler, uzak komut yasak) + `GOREV-ORTAK.md` (≤60 satır). Ajan yalnız bunları okur. Başarısız görev ≤2 deneme sonra tarif değişir. Alt ajan her anlamlı adımda `WIP:` commit (yalnız kendi yollar, `git add -A` yasak), `.wdp-agent.lock`, ILERLEME ≤10 dk, SIRADAKI-IS güncel; limit dolunca "devam" ile son WIP'ten sürülür, baştan başlanmaz.
- **Paylaşılan dosyalar** (languages/*, package.json, class-plugin.php, docs, CLAUDE.md) ajan elle dokunmaz; çeviri `languages/parts/<kod>.po`, birleştirmeyi (`i18n:pot/merge/mo/json`) Claude yapar.
- **Token disiplini:** uzun dosyalar baştan okunmaz (Graphify, LSP, satır aralığı); test/günlük çıktısı yalnız özet; rapor ve ILERLEME satırları kısa; **görseller modele toplu gösterilmez** — önce piksel karşılaştırma (pixelmatch); yalnız eşiği aşan ve her ekran türünden bir mobil + bir masaüstü temsilci, ≤800 px genişlikte gösterilir; önce/sonra görüntüleri diske/rapora gider. Ara adımlarda yalnız etkilenen testler; tam matris ve uzak koşular yalnız sürüm sonunda bir kez. Her alt iş bitince yeni oturum önerilir; SIRADAKI-IS.md güncel.
- **Bekleme:** beklerken turu "bitince devam ederim" diyerek bitirme gerekmiyorsa ajan bildirimi yeterli; uzun işler arka planda, ≤5 dk yoklama. Tur yalnız AŞAMA ÖZETİ verirken ya da limit dolunca biter.
- **İnceleme:** önce RAPOR-<kod>.md, sonra yalnız değişen satırlar. Kanıt sayılarla; "çalışıyor" tahmini kabul edilmez. Playwright ≤1 süreç (`e2e:queue`, worker 1); video kapalı; eski test çıktıları koşu öncesi silinir.
- **Test eşiği:** test ürünün yetersiz davranışı yüzünden kırılıyorsa eşik gevşetilmez, ürün düzeltilir; eşik yalnız ölçüm hatası kanıtlanırsa ve gerekçesi rapora yazılarak değiştirilir.
- **Süreç durdurma:** ajanlar yalnız kendi başlattıkları süreçleri durdurur (PID/süreç grubu kaydı); `pkill -f`, `killall` ve ad eşleşmeli toplu öldürme yasak (Hookify kuralı `hookify.block-broad-kill.local.md`).
- **E2E/accept:** `e2e:accept` yalnız ekranlar incelendi + beklenen değişiklik + işlevsel hata 0. Testte `.catch(() => {})` yasak. Eşik: sayfa ≤%0.5, kabuk ≤%0.1.
- **Merge kriteri:** `verify` + yerel tam paket + uzak kısa kontrol (`e2e:remote-smoke`) iki ortamda yeşil + hız karşılaştırması (§5). Uzak tam paket yalnız faz sonu, bilgi amaçlı.
- **Kurulum:** staging30 ve Ikram'a eklentiyi Claude kurar/test eder (`ship:staging`, `ship:ikram`). Ikram gerçek yayına girince kurallar yeniden belirlenir. Eklentinin KENDİ ayarları test için değiştirilebilir (önceki değer rapora); Woo/tema/site ayarlarına dokunulmaz.

## 4. Kalıcı ürün kuralları
- **AYARLAR VE REHBER:** her yeni/değişen özellik (a) yönetici ekranında ayar + her ayarın altında kısa açıklama, (b) Bağış Paneli → Rehber'de adım adım (ekran yolu, kısa kod, görsel) olmadan "bitti" sayılmaz. Ayarda görünen = uygulanan (test). AŞAMA ÖZETİ'nde "ayar/rehber güncellemesi" satırı zorunlu. Kontrol listesi: `build/handoff/KONTROL-LISTESI.md`.
- **Kurgu ayrımı:** compact düzen yalnız görünüm; doğrudan (sepetsiz) bağış ödeme davranışı, her düzenden bağımsız; öncelik ürün > bağış türü > genel (`Direct_Settings::decide`).
- **Renk:** tema paletinden yalnız açıkça adlandırılmış rol renkleri; eşleşme yoksa nötr varsayılan + "temadan okunamadı" uyarısı; kaynak ekranda yazar; kullanıcının seçimi hiç değişmez. Renk alanı hex ve CSS değişkeni kabul eder.
- **Kod/adlandırma:** PHP `DonationPanel\`, `src/`; kanca/seçenek `donation_panel_`, CSS `.donation-panel` kökü altında, global seçici/`!important` yok; eski `wdp_` yalnız src/Compat. Ön yüzde jQuery/React/harici kaynak/takip yok. Kalite kapıları: PHPCS WP tam, PHPStan, Plugin Check, ESLint/Stylelint temiz (yeni kodda 0), axe WCAG 2.2 AA 0. Resmi belge (context7, WP skills) ile karar; tahmin yok.

## 5. HIZ BÜTÇELERİ (§-2 ve §24–25 özeti; regresyon yok)
- **Hiçbir güncelleme yavaşlatamaz.** Her sürümde `measure:plugin-perf` yerelde 4 tema + iki uzak sitede önceki sürümle karşılaştırılır; herhangi bir ölçüt kötüleşirse sürüm kurulmaz, önce düzeltilir. Ölçülen kötüleşme gürültü olarak ancak eşli ölçümle kanıtlanırsa kabul.
- Arayüzsüz sayfada eklentiden 0 istek/bayt/sorgu/çerez/CSS/JS. Arayüzlü sayfada render engelleyen 0; eklenti CSS dosyası 0 (tümü satır içi); satır içi CSS yüzey başına ≤9 KB, sayfa toplamı ≤16 KB gzip; JS ≤~25 KB gzip; ana iş parçacığı ≤50 ms ve uzun görev 0 (yavaşlatılmış CPU); CLS katkısı 0; INP <200 ms; dokunuş→panel <100 ms (yavaş 4G + 4× CPU, 5 koşu medyanı); dokunuşta ağ isteği yok (ön alma); animasyon yalnız transform/opacity, reduced-motion'da yok.
- Stilsiz görünme sıfır tolerans: baştan görünen çıktı kendi CSS'iyle (satır içi, sayfada bir kez) gelir; panel her koşulda stilli ve anında açılır. Sunucu: arayüzlüde ≤2 sorgu, autoload ≤5 KB, sayfa HTML'inde nonce/kullanıcıya özel içerik yok, ilk ziyarette çerez yok.
- Güvenlik (ön yüz): betik/stil URL'si veya REST kökü HTML özniteliğinden alınmaz; yalnız sunucunun güvenilir yapılandırması, aynı köken + eklenti yolu doğrulanır; hız sınırı ürün başına.

## 6. Komutlar
`npm run verify` / `test` / `test:local-wp` / `e2e:bootstrap -- --env X` / `e2e:quick|full|matrix` / `e2e:remote-smoke -- --env X` (yalnız Claude) / `e2e:accept|stability|perf|canary` / `measure:plugin-perf` / `ship:staging|ship:ikram` (yalnız Claude) / `lint:php|js|css` / `plugin-check` / `i18n:pot|merge|mo|json|verify` / `resource:gate` / `clean:disk` / `wt:prepare`.

## 7. İletişim
- Türkçe, kısa; ayarlar kompakt tablo; komut tek blok; onay gerektiren komuttan önce ne yapacağı ve "yalnız okur / dosya değiştirir / geri alınması zor" tek cümle. Kullanıcı teknik değil.
- Faz sonunda AŞAMA ÖZETİ (≤1 sayfa): ne doğrulandı, sürümler/commit'ler, hız tablosu (önceki sürümle), ayar/rehber güncellemesi, açık sorunlar, kararlar, sıradaki adım, yaklaşık token/süre ve en pahalı 3 iş.
- Her mesajın son satırı: `✅ BİTTİ – sıra sende` / `⏳ BEKLİYOR – <ne çalışıyor>` / `❓ ONAY GEREKİYOR – <ne için>`.

## 8. Durum (2026-10-30; sürüm 12.3 yolunda)
- 12.3 kapsamı (birleşti): kurgu ayrımı + ayar/rehber, anında açılış (ön alma), titreme düzeltmesi, ince odak, canlı ilerleme çubuğu, renk kuralı, yan sepet denetimi. Bekleyen: compact kart v2 (CSS ≤9 KB, ana iş) + progress2 (döngü katmanı) birleşmesi → tam paket → ship iki site → hız karşılaştırması.
- **12.4 (yeni oturum):** görsel cila (piksel karşılaştırma + temsilci ekranlar), code-review ikinci tur, Lighthouse (≥7 koşu), hello-elementor `[products]` ön alma sorunu, ölü kod (confetti/bar--chunky) temizliği, Stripe test modu, KVKK/Faz 8/9 listeleri (docs/CANLIYA-ALMA.md).
- Açık: Cursor 12 Kas'a kadar kapalı; gerçek ödeme geçidi testleri kullanıcıda ("BEN YAPARIM"); iOS Safari otomatik doldurma görsel kanıtı gerçek cihazda.
