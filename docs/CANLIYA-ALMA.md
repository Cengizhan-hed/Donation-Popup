# Canlıya alma planı (Faz 9 hazırlığı)

Bu belge plandır; hiçbir adım bu oturumda canlıda çalıştırılmadı. Canlı siteye yalnız aşağıdaki sırayla ve kullanıcının onayıyla dokunulur. Claude Code canlı siteye hiçbir koşulda bağlanmaz; canlı adımları kullanıcı (ya da onun yetkilendirdiği kişi) yapar. Eklenti sürümü: 11.0.0 (Faz 7 kapanışı sonrası).

## A. Hedef Derneği (canlı) — adım adım

### A0. Başlamadan önce (kullanıcı)
- [ ] Eklenti 11.0.0 staging30'da kuruldu; yerel tam paket, kalite kapıları ve göç provası yeşil (AŞAMA ÖZETİ).
- [ ] Bakım penceresi seçildi (bağış trafiğinin en düşük olduğu saat); ekiplere haber verildi.
- [ ] Canlıda kurulu eklenti 10.3.1; ilk kurulum **eklenti güncellemesi** olarak yapılır (silip yeniden kurma YOK; ayarlar korunur).

### A1. Yedek (geri alınabilirlik için zorunlu)
1. Barındırma panelinden tam yedek (dosyalar + veritabanı) al; geri yükleme denenmiş bir yedek olsun.
2. Ek olarak yalnız eklentinin kendi ayarlarını dışa aktar: `wp option get donation_panel_settings --format=json` ve eklentinin diğer `wdp_*` seçeneklerini (`wp option list --search="wdp_*" --format=json`) dosyaya al. Dosyayı sitenin dışında sakla.
3. Eski eklenti klasörünü (10.3.1) zip olarak ayır: `wp-content/plugins/woo-donation-popup` kopyası.
4. Yedek tarihini ve dosya adlarını bu belgenin sonundaki kayıt tablosuna yaz.

### A2. Curcy snippet'i (güncellemeden ÖNCE)
- [ ] Snippets › Add New (Code Snippets menüsü İngilizce görünür): `docs/site-snippets/curcy-bridge.php` içeriği (ilk satırdaki `<?php` HARİÇ). "Her yerde çalıştır", etkinleştir. Eski eklentiyle de zararsızdır.
- [ ] Sitede eski köprü (`wdp_convert_amount`) varsa içeriğini güncel dosyayla DEĞİŞTİR; iki köprüyü birlikte açma.
- [ ] Ayrıntı: `docs/site-snippets/README.md`, `docs/site-snippets/CANLIYA-ALMA.md`.

### A3. Eklentiyi kur
1. `npm run pack` ile üretilen zip (`build/`) Eklentiler › Eklenti ekle › Eklenti yükle düğmesi ile yüklenir; WordPress "mevcut sürümü değiştir" önerir, onayla.
2. Eklentiyi devre dışı bırakmadan değiştir (ayarlar bellekte kalır; etkinleştirme göçü idempotent çalışır).
3. Hemen sonra: Bağış Paneli ayar ekranı açılıyor mu, ürün veri sekmesi geliyor mu, ön yüzde bir bağış ürünü açılıyor mu bak. Hata varsa **G (geri dönüş)** bölümüne geç.
4. Mevcut kurulum olduğu için yeni motor/yeni yönetici ekranı kendiliğinden AÇILMAZ (varsayılan eski deneyim). Önce A5–A7 doğrulanır; sonra Ayarlar'dan "yeni deneyim" seçilir. Sorun çıkarsa aynı ekrandan "eski deneyime dön".

### A4. `[hd_panel_buton]` snippet'i → eklentinin kısa kodu
- Şu an canlıda `[hd_panel_buton]` bir Code Snippets parçasıdır ve yalnız `do_shortcode('[wdp_donation_button_panel id="ID"]')` döndürür. Eklenti kısa kodları HİÇ değişmedi (`[wdp_donation_button_panel]`, `id` dahil).
- Önce snippet'i olduğu gibi bırak (hâlâ çalışır); A5 doğrulaması geçince Avada ürün şablonundaki `[hd_panel_buton]` yerine doğrudan `[wdp_donation_button_panel]` yaz (`id` yazmazsan eklenti bulunduğu ürünü kendisi bulur). Sonra snippet'i devre dışı bırak; sayfaları tekrar kontrol et.
- Hızlı geri dönüş: snippet'i yeniden etkinleştir.

### A5. Doğrulama (yalnız görüntüleme, sipariş YOK)
- [ ] 3–4 farklı bağış ürününde (sabit tutar, serbest tutar, hissedar, kampanya) bağış düğmesi görünüyor, panel açılıyor.
- [ ] Mobil (iPhone/Android) ve masaüstünde panel açılışı ve tutar seçimi.
- [ ] Curcy ile EUR ve USD'ye geç: panel tutarları seçili para biriminde; 100 EUR yazılınca sepette ve ödeme sayfasında 100 EUR kalıyor (sipariş verme).
- [ ] İlerleme çubuğu toplamı güncellemeden önceki sayıyla aynı (yalnız sayı karşılaştır).
- [ ] Önbellek eklentisi/CDN önbelleğini temizle; Wordfence/ek güvenlik uyarısı yok.

### A6. Geriye dönük kampanya toplamı
Eski EUR/USD siparişleri kur meta'sı olmadan kaydedilmiş olabilir; toplam bu yüzden eksik/yanlış olabilir.
1. Önce yalnız rapor (hiçbir şey yazmaz): `wp donation-panel recalc-totals --all --dry-run`
2. Tabloyu incele: ürün başına eski → hesaplanan toplam; "kur bulunamadı" uyarıları listelenir (bu siparişler olduğu gibi/ hariç sayılır).
2b. **staging30 dry-run sonucu (2026-10-26, Hedef canlı kopyası; yalnız okundu, hiçbir şey yazılmadı)**: 32 ürünün 32'sinde "eski toplam" ile "hesaplanan" farklı; dönüştürülemeyen (kuru bilinmeyen) satır 0. Büyük farklar var (ör. Zekat 7.400 → 354.254; Sadaka 55.239 → 110.574; Büyükbaş Vacip Hisseli 1.584.000 → 2.208.000; bazı ürünlerde hesaplanan DAHA DÜŞÜK: Küçükbaş Vacip 30.000 → 24.000, Fidan 4.000 → 0). Sebep belirsiz: saklanan toplam yalnız kampanya özelliği açıldıktan sonraki siparişleri (artımlı) ya da yalnız belirli sipariş durumlarını sayıyor olabilir; recalc tüm sipariş geçmişini yeniden toplar. Tam tablo: `build/handoff/recalc-dryrun-staging.md`. **Uygulamadan ÖNCE**: (a) hangi ürünlerde kampanya hedefi/ilerleme çubuğu açık (yalnız o ürünlerin toplamı bağışçıya görünür; diğerlerine uygulama), (b) saklanan toplamın tanımı (kod: `WDP_Utils` ilerleme toplamı; hangi sipariş durumları), (c) "düşen" ürünler (hesaplanan < eski) neden; (d) iş kararı: tarihsel toplam mı gösterilsin, yoksa mevcut sayaçlar mı korunsun. Bu karar kullanıcıda; `--product=ID` ile ürün ürün uygula.
3. Beklenmedik büyük fark varsa DUR; uygulama adımına geçme, Claude'a (staging30 verisiyle) tekrar incelettir.
4. Uygulama (yalnız yedekten sonra): `wp donation-panel recalc-totals --all` (ya da `--product=ID`). Siparişleri değiştirmez; yalnız ürün toplam meta/önbelleğini günceller. Tekrar çalıştırmak güvenlidir.

### A7. İlk gerçek EUR/USD sipariş doğrulaması
- [ ] Kullanıcı kendi küçük EUR bağışını (gerçek ödeme) yapar; sonra USD ile bir tane daha.
- [ ] Siparişte: tutar/para birimi doğru, bağışçı alanları (ithaf, kim adına, hissedarlar, telefon) Türkçe karakterlerle eksiksiz.
- [ ] Kampanya toplamı beklenen kurla artıyor (sipariş meta'sında kur kayıtlı; `recalc-totals --dry-run` aynı toplamı veriyor).
- [ ] Sipariş e-postası, SMS ve Bitrix24 aktarımı geliyor (A8).

### A8. Kullanıcının yapacağı testler (eklenti dışı entegrasyonlar)
- [ ] Sipariş/teşekkür e-postası geldi mi (bağışçı + yönetici)
- [ ] SMS bildirimi
- [ ] POS / ödeme sağlayıcısı akışı (yöntemler: kart, havale)
- [ ] Bitrix24 aktarımı (sipariş alanları, bağış türü)
- [ ] Terk edilmiş sepet eklentisi davranışı
- [ ] Ölçüm/reklam etiketleri (GA/GTM/Meta) bağış olayını yazıyor mu

### A9. Gizlilik/KVKK
- [ ] Ayarlar › Gizlilik › "Gizlilik ilkesi rehberi" ekranında "WooCommerce Bağış Paneli" bölümü görünüyor (Türkçe yönetici dilinde eklenti adı böyle görünür) (öneri metin; sayfa metnini site sahibi yazar/günceller).
- [ ] Araçlar › Kişisel verileri dışa aktar / Kişisel verileri sil: bir deneme e-postası ile (kendi adresin) bağış kayıtları bulunuyor ve siliniyor (sipariş tutarı muhasebe için kalır).
- [ ] Eski `wdp_vid` çerezi artık yazılmıyor (tarayıcıda yeni çerez oluşmuyor).

### A10. Yeni deneyimi açma (isteğe bağlı, A5–A9 geçince)
Yükseltilen kurulumda eski deneyim kalır; yeni deneyim iki adımda açılır:
1. **Yeni yönetici ekranı:** WooCommerce › "Bağış Popup Ayarları" ekranının üstündeki mavi kutuda "Yeni Bağış Paneli deneyimi hazır" → "Yeni yönetici ekranını aç" düğmesi. Yeni ekran: WooCommerce › "Bağış Paneli" (sekmeler: Genel, Modüller, Metinler, Gelişmiş; ayrıca "Bağış Paneli rehberi"). Kutuyu "Kapat" ile gizleyebilirsiniz.
2. **Yeni form motoru:** Bağış Paneli › Genel › "Bağış formu deneyimi" listesinden "Yeni form motoru" seçilir (eski: "Klasik form motoru (12.0'da kaldırılacak)"). Bir bağış ürününde mobil + masaüstü kontrol edin. Modüller (kampanya kartı, yan sepet, teşekkür ekranı, sosyal kanıt, bağışçı hesabı, vergi indirimi beyanı) Modüller sekmesinden tek tek açılır.
- Sorun olursa: yeni ekranın üstündeki "Klasik ekrana dön" düğmesi ve Genel sekmesinde form motorunu "Klasik"e alın. Ayarlar silinmez.

## G. Geri dönüş planı
| Belirti | Adım | Süre |
|---|---|---|
| Yeni deneyimde görsel/işlev sorunu | Bağış Paneli › Genel › form motorunu "Klasik"e al + "Klasik ekrana dön" | 1 dk |
| Eklenti sonrası genel sorun | Eklentiyi devre dışı bırak (ayarlar silinmez); `[hd_panel_buton]` snippet'ini etkin tut | 2 dk |
| Eklenti dosyası bozuk / fatal | FTP ya da barındırma dosya yöneticisinden klasörü eski 10.3.1 kopyasıyla değiştir | 5 dk |
| Veri sorunu (toplam yanlış) | Yedekten eklenti seçeneklerini geri yükle; `recalc-totals` yalnız ürün meta'sını yazdığı için siparişler zaten etkilenmez | 10 dk |
| Hepsi başarısız | Barındırma tam yedeğini geri yükle | yedeğe bağlı |

Not: Eklentinin eski çerezi (`wdp_vid`) kaldırıldı; geri dönüşte eski sürüm onu yeniden yazar, zararsızdır.

## B. Ikram Aid yayına alma listesi

Ikram (ikramaid.uk): Blocksy + Elementor, GBP, şu an "coming soon" açık. Test için eklentinin kendi ayarlarından modüller açıktır (yeni motor, kampanya, etki, sosyal kanıt, yan sepet, bağışçı hesabı, teşekkür, vergi indirimi/Gift Aid).

### B1. Yayından önce (site sahibi)
- [ ] `?dp_preview=1` ile (yönetici girişliyken) formlar, kampanya kartları, yan sepet, bağışçı hesabı gerçek ürünlerde incelendi; metinler İngilizce, GBP biçimleri doğru.
- [ ] WooCommerce ayarları (kullanıcı yapar; eklenti değiştirmez):
  - WooCommerce › Ayarlar › Hesaplar ve gizlilik: "Ödeme sırasında hesap oluşturmaya izin ver", "Hesap sayfasında kayıt" gerektiği gibi ayarla (bağışçı hesabı modülü için).
  - WooCommerce › Ayarlar › Genel: para birimi GBP, ondalık/ayırıcı, mağaza ülkesi (UK).
  - WooCommerce › Ayarlar › Ödemeler: gerçek ödeme yöntemleri (şu an çek/havale/kapıda ödeme; kart sağlayıcısı eklenecekse eklentisini kur).
  - WooCommerce › Ayarlar › Site görünürlüğü: "Çok yakında" yerine "Yayında" seç (yayın anı).
- [ ] Gift Aid beyanı: metin yasal incelemeden geçti; bağış formunda "tax relief" ifadesi onaylandı (HMRC koşulları site sahibi sorumluluğunda; eklenti yalnız onay kutusu ve sipariş kaydı tutar).
- [ ] Yayın öncesi uzak güvenlik ayarı: eklentinin test amaçlı `ikramaid.uk` ship izni KALDIRILIR (CLAUDE.md §2 tablosu / `remote-guard`); bundan sonra Claude bu siteye bağlanmaz.

### B2. Yayın anı
- [ ] "Coming soon" kapat; önbelleği temizle.
- [ ] Ödeme sayfasında dış istek yok (eski WooPayments stripe.js POST'u kapandı; coming-soon nedeniyle ödeme sayfası kontrolü yayında yeniden yapılır: tarayıcı ağ sekmesinde beklenmeyen üçüncü taraf POST yok).
- [ ] Kullanıcı gerçek küçük bir GBP bağışı yapar; sipariş, e-posta, makbuz/Gift Aid alanı, teşekkür ekranı, "Bağışlarım" paneli (hesap açıksa) kontrol edilir.
- [ ] Gizlilik: politika sayfasında eklenti öneri metni yerleştirildi; dışa aktar/sil aracı denendi (A9 ile aynı).

### B3. Geri dönüş
- Yeni deneyim: Bağış Paneli › Genel › form motoru "Klasik" ve "Klasik ekrana dön". Yayın: "coming soon" yeniden aç. Eklenti: devre dışı bırak (ayarlar silinmez).

## Kayıt tablosu (kullanıcı doldurur)
| Adım | Tarih/saat | Yapan | Not |
|---|---|---|---|
| Tam yedek | | | |
| Curcy snippet | | | |
| Eklenti güncelleme | | | |
| recalc dry-run | | | |
| recalc uygula | | | |
| İlk EUR siparişi | | | |
| İlk USD siparişi | | | |

## Ekran adı doğrulaması (staging30, 2026-10-26; `npm run admin:screens`, yalnız GET)
- Eklenti satırı: "WooCommerce Bağış Paneli 11.0.0" (Türkçe yönetici dilinde; İngilizce yönetici dilinde "Donation Panel for WooCommerce").
- **Eski ayar ekranı (yükseltilen kurulumda ilk haliyle kalır):** WooCommerce › "Bağış Popup Ayarları" (sekmeler: Ürünler, Ürün sayfası ve liste, Tasarım, Modal, Normal, Hisseli, Progress, Başarı, Gelişmiş).
- **Ürün düzenleme:** Ürün verisi kutusunda "Bağış" sekmesi (bağış ürünü ayarları).
- **Gizlilik:** Ayarlar › Gizlilik › "Gizlilik ilkesi rehberi" sayfasında eklenti bölümü var. Araçlar › "Kişisel verileri dışa aktar" ve "Kişisel verileri sil".
- **WooCommerce:** Ayarlar › sekmeler: Genel, Ürünler, Gönderim, Ödemeler, Hesaplar ve gizlilik, E-postalar, Entegrasyon, Site görünürlüğü ("Çok yakında" / "Yayında"), Satış Noktası, Gelişmiş. Hesaplar ve gizlilik: "Misafir ödemesini etkinleştir", "Ödeme sırasında oturum açmayı etkinleştir", "Müşterilerin bir hesap oluşturmasına izin verin" bölümü.
- Yeni "Donation Panel" ekranları (`page=donation-panel`, rehber, sihirbaz) staging30'da HTTP 403: yükseltilen kurulumda `admin.ui=legacy` olduğu için kayıtlı değil (beklenen). Yeni deneyime geçiş yolu: eski ekranın üstündeki "Yeni yönetici ekranını aç" düğmesi (A10).
