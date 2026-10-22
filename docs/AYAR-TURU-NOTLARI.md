# Ayar turu notları

**Kural:** Ayarları kullanıcıyla elle, tek tek gözden geçiriyoruz. Ayar başına Cursor'a görev GÖNDERİLMEZ. Bölüm bitince tüm düzeltmeler tek bir Cursor görevi olur.
**Kayıt kuralı:** Her not, karar ve test sonucu ANINDA bu dosyaya yazılır.

## Bölüm: Tutar seçenekleri (5 ayar)

| # | Ayar | Durum |
|---|------|-------|
| 1 | Hızlı tutar düğmeleri | 10.29.0 ship + quick Geçti (E2E a–e) |
| 2 | Tutarlar | 10.29.0 (Y3–Y6 + PHPUnit + E2E g/f) |
| 3 | Adet seçici | 10.29.0 (N3 + sunucu qty=1 + E2E h) |
| 4 | İşlem ücretini karşıla | 10.29.0 (Y1 tüm tipler + Toplam + E2E i) |
| 5 | İşlem ücreti (%) | 10.29.0 (Y2 0,5–15 + meta’dan oku) |

**Ship:** staging 10.29.0; quick 40/0/0; Değişti 4 custom kabuk (Önerilen). Accept/commit bekliyor (görsel kontrol).

## Bilgiler (koddan doğrulandı)

| Konu | Bilgi | Kaynak |
|------|-------|--------|
| Hızlı tutar düğmeleri | Ürün `_enable_amount_presets` yes/no. Görünmesi için genel ayar (Ayarlar → Normal → "Chip'leri göster") VE ürün kutusu açık olmalı. Genel varsayılan kapalı ('0'), ürün varsayılanı açık. | class-form-fields-renderer.php:101-111 |
| Tutarlar | Ürün `_amount_presets`; boşsa genel liste, o da boşsa yedek 100, 250, 500, 1000, 2500. | class-form-fields-renderer.php:31-62 |
| Tip koşulu | `render_amount_section`'da tip koşulu yok (`open_type_scope` kullanılmıyor). | class-form-fields-renderer.php |
| "En çok tercih" | Gerçek veriden gelmiyor, ortadaki düğmeye otomatik veriliyor. | class-form-fields-renderer.php:128 |
| Tutar kutusu | `value=""`; düğmenin seçili görünmesi kutudaki değere bağlı. | class-form-fields-renderer.php:288, pricing.js:251-266 |
| Staging | "Chip'leri göster" açık; Nafile Kurbanı formunda ₺100–₺2.500 düğmeleri görünüyor. E2E ekran farkları beklenen değişiklik. | — |

## Test sonuçları

| Test | Sonuç |
|------|-------|
| Form ilk açıldığında (sayfa ve popup) | Hiçbir tutar seçili gelmiyor. |
| Tutar seç, popup'ı kapat, aç | Seçim korunuyor (ör. 500 TL). |
| a) Nafile'de 500 TL seç, kapat, aynı sayfada Sadaka formunu aç: boş mu? | Elle test YAPILMAYACAK; otomatik E2E testi olacak |
| b) Seçim yap, sayfayı yenile, formu aç: boş mu? | Otomatik E2E testi olacak |
| c) Seçim yap, Sepete Ekle, aynı ürünün formunu tekrar aç: boş mu? | Otomatik E2E testi olacak |
| Seçim nerede saklanıyor? | Kodda tutar seçimi için sessionStorage/localStorage kullanımı YOK (assets/js/src taraması: yalnız meta-tracking.js, core/utils.js nonce, cart/woo.js fragments). Büyük olasılıkla bellek/DOM (modal kapanınca silinmiyor). Test b (yenileme) ile kesinleşir. |

## Kararlar

| Kod | Karar |
|-----|-------|
| K1 (Seçenek A) | Hiçbir tutar asla otomatik seçili gelmez; bağışçı kendisi seçer. Seçim koruması yalnız aynı ürünün aynı sayfa oturumunda, sepete eklenene kadar geçerli. |
| K2 | "En çok tercih" → "Önerilen". Önerilen tutar genel ayarda ve üründe seçilebilsin (varsayılan: ortadaki). Önerilen tutar SEÇİLİ gelmez, yalnız etiketlenir. |

## Bölüm sonu düzeltme notları (tek Cursor görevi olacak)

| # | Düzeltme |
|---|----------|
| N1 | "Chip'leri göster" → "Hızlı tutar düğmelerini göster" + açıklama: "Tutar kutusunun üstünde 100 ₺ / 250 ₺ gibi tek tıkla seçilen düğmeler." |
| N2 | Ürün kutusu açıklamasına: "Genel ayar (Ayarlar → Normal) kapalıysa bu kutu işaretli olsa da düğmeler görünmez." |
| N3 | Tipe göre gizleme: Hızlı tutar düğmeleri ve Tutarlar yalnız Bağışçı belirler + Hedefli kampanya'da görünsün; Adet seçici yalnız Sabit tutarda (ekranda doğrulanacak). İşlem ücreti tüm tiplerde. |
| N4 | K1'i garanti altına al (ürün değişimi, yenileme, sepete ekleme sonrası başka tutar seçili gelmesin) + E2E. |
| N5 | K2 (Önerilen) + E2E. |
| N6 | (2D/2F) Önerilen düğme diğerlerinden yüksek, farklı çerçeveli (amount-presets.css:69-75); tüm düğmeler aynı yükseklikte olmalı. |
| N7 | Teknik terim içeren tüm etiketleri turun geri kalanında da not al (aşağıdaki tabloya ekle). |

## Teknik terim içeren etiketler (N7)

| Ekranda yazan | Neden sorunlu | Öneri |
|---------------|---------------|-------|
| Chip'leri göster | "Chip" teknik terim | Hızlı tutar düğmelerini göster |
| Chip tutarları (Normal sekmesi) | Aynı terim | Hızlı tutar düğmeleri |

## Analiz: Ayar 2-5 (koddan, 2026-10-20)

| # | Ayar | Ne yapar | Sorun | Önerilen düzeltme |
|---|------|----------|-------|-------------------|
| 2 | Tutarlar | Ürün `_amount_presets` (virgül/boşluk/noktalı virgül ayrımlı, en fazla 6) > genel liste > yedek 100,250,500,1000,2500 (class-form-fields-renderer.php:31-62; ayrıştırma class-form-modules.php:184) | (1) Genel liste sınırsız, ürün listesi 6 ile kesiliyor. (2) Ayrıştırıcı harf/geçersiz karakteri sessizce atıyor ("5o0" → 50); kullanıcıya uyarı yok. (3) Ondalık/binlik karışıyor: "1.000" → 1, "1,5" → ayırıcı sayıldığı için 1 ve 5. (4) Tutarlar en düşük tutarın altındaysa ne olacağı belirsiz. (5) Tip koşulu yok (N3). | Ayrıştırmayı kaydetmeden önce doğrula, geçersizde uyarı ver; genel listeyi de 6'ya sınırla; min altı tutarı gizle/uyar; yalnız Bağışçı belirler + Hedefli kampanyada göster |
| 3 | Adet seçici | Ürün `_enable_quantity` (boşsa açık); kapalıysa form sınıfı `wdp-no-quantity` ile CSS gizliyor (class-modal-shell-renderer.php:301,488; field-stack.css:94-98) | Yalnız CSS ile gizleniyor; form hâlâ adet gönderebilir (sunucu tarafı doğrulama ayrıca kontrol edilmeli). Tip koşulu yok: bağışçı belirler/hisselide anlamsız ama ayar görünür (N3). | Yalnız Sabit tutarda göster; kapalıyken sunucuda adet=1 zorla; E2E |
| 4 | İşlem ücretini karşıla | Ürün `_enable_cover_fee`; formda onay kutusu (class-form-modules.php:309) | (1) Ücret yalnız `allow_custom_price` yolunda uygulanıyor (cart-add.php:236); Sabit tutarlı üründe kutu görünse de ücret EKLENMİYOR olabilir (doğrulanacak). (2) "Toplam" satırı kutu işaretlenince güncellenmiyor: JS'te ücret hesabı yok (yalnız ajax.js:616-635 gönderiyor). AYARLAR.md "toplam artar" diyor, kodla uyumsuz. (3) Sepet satırında ücretin ayrı görünmediği doğrulanacak. | Toplam satırına ücret ekle; kutu yalnız ücretin uygulandığı tiplerde görünsün; sepet/sipariş notunda ücreti ayrı göster; E2E |
| 5 | İşlem ücreti (%) | Ürün `_cover_fee_percent` | Sınırlar tutarsız: yönetici ekranı en fazla 15 (admin-product-data-tab.php:618), kayıt 0-20 (product-settings-service.php:308), context 20 (context-service.php:160), forma/sepete 0,5-15 (form-modules.php:316, cart-add.php:168). 15-20 arası girilirse sessizce 15'e iner; 0-0,5 arası 0,5'e çıkar. İstemci yüzdeyi gönderiyor (ajax.js:621), sunucu ürün değerini yeniden doğrulamıyor, yalnız 0-15 sınırı. | Her yerde tek sınır (0,5-15); sunucuda her zaman ürün meta'sından oku, istemci değerini yok say |

Ek bulgu (Ayar 1): "En çok tercih" otomatik ortadaki düğme (K2'de çözülecek).

## Kararlar: Tutar seçenekleri bölümü (2026-10-20, kullanıcı verdi)

| Kod | Karar |
|-----|-------|
| Y1 | a: İşlem ücreti tüm tiplerde çalışır ve Toplam satırına yansır. |
| Y2 | a: Ücret yüzdesi sınırı her yerde 0,5–15. |
| Y3 | a: Geçersiz hızlı tutar girişinde kaydetme durur, hatalı kısım gösterilir. |
| Y4 | b: Hızlı tutarlarda yalnız tam sayı. Bağışçının kutuya yazdığı serbest tutar etkilenmez. |
| Y5 | a: En düşük tutarın altındaki hızlı düğmeler gizlenir. |
| Y6 | a: Genel hızlı tutar listesi de en fazla 6. |
| Onay | Toplu onay VERİLDİ: tek Cursor görevi (N1–N7, K1–K2, Y1–Y6, tablo önerileri, otomatik testler a/b/c dahil) + ship:staging + quick; sonra en fazla 8 maddelik görsel liste; kullanıcı "tamam" deyince accept + commit + push. |

## Durum: 10.29.0 (dal ayar-tutar-secenekleri)

| Konu | Sonuç |
|------|-------|
| Cursor görevi | Bitti; verify + test geçti (PHPUnit 178, JS 43); staging'de 10.29.0; e2e:quick işlevsel 40/0/0 |
| Görsel | 4 ekran Değişti (custom popup/panel open + errors): "Önerilen" etiketi + düğmeler görünür; hiçbir tutar seçili değil |
| Gözlem | Önerilen düğmenin mavi çerçevesi "seçili" gibi okunabilir; kullanıcı staging'de değerlendirecek |
| Açık | Staging ürünlerinde ücret kapalıysa E2E "i" atlanabilir (bu koşuda geçti). Kalan teknik adlar: chip_style option, CSS sınıf adları (kullanıcıya görünmez) |
| Bekleyen | Kullanıcı görsel kontrol → "tamam" → accept + commit + push |

## YÖN DEĞİŞİKLİĞİ (2026-10-20)

Görsel/CSS düzeltmeleri en sona kalır; ayar turunda yalnız DAVRANIŞ düzeltilir. Her bölüm: koddan analiz → tek mesaj (tablo + numaralı kararlar) → onay → tek Cursor görevi (düzeltme + otomatik test + ship + quick) → en fazla 3 maddelik davranış kontrolü → accept + commit + push + merge. Kalan bölümler sırası: Form alanları → Kampanya blokları (Akika hedefe ulaştı ama bağış almaya devam ediyor: karar listesine eklenecek) → Bu ürüne özel görünüm → Kısa kod. Tur bitince: 6. Durum + AŞAMA ÖZETİ (GÖRSEL AŞAMA listesi dahil).

| Karar | İçerik |
|-------|--------|
| K2 (güncel) | "Önerilen" yalnız üründe "Önerilen tutar" doluysa ve o tutar listede varsa görünür. Boşsa hiçbir düğmede görünmez. Ortadaki otomatik varsayılan ve genel ayardaki önerilen tutar KALDIRILIR. Ürün alanı açıklaması: "Boş bırakılırsa hiçbir tutarda Önerilen etiketi gösterilmez." |
| Ödemeye Git | 4 custom ekranda eskiye göre soluk; sebep kanıtlanacak. Disabled/pasif veya Toplam yan etkisiyse şimdi düzelt (buton her zaman aktif, doğrulama tıklayınca). Yalnız CSS ise görsel aşamaya yaz. |

## GÖRSEL AŞAMA (sona kalan)

| # | Madde |
|---|-------|
| G1 | N6: tüm hızlı tutar düğmeleri eşit yükseklik (Önerilen için etiket yer kaplamasın) |
| G2 | Önerilen düğme seçili gibi görünmesin: aynı çerçeve, yalnız küçük yazı |
| G3 | Seçili düğme dolgulu ve baskın olsun |
| G4 | Ürün sayfası "Bağış Yap" bilgi kartından geniş |
| G5 | Mağaza buton yazısı hizası (Avada `.button`, yazı yukarıda) |
| G6 | Popup / panel buton sırası aynı olsun (popup: Sepete Ekle solda; panel: Ödemeye Git üstte) |
| G7 | "Benzer Bağışlar" turuncu butonlar liste mavisiyle tutarsız |
| G8 | Panelde içerik ile butonlar arası büyük boşluk |
| G9 | Not ikonu hizasız (2E) |
| G10 | Sabit fiyattaki fiyat kutusu buton gibi görünüyor; her tipte "Toplam" satırı (2D) |
| G11 | Bağışçı belirler tutar alanında "min" ipucu yok (2E) |

## Durum: 10.29.1 (kabul edildi)

| Konu | Sonuç |
|------|-------|
| K2 | Önerilen yalnız üründe dolu ve listedeki tutarda; genel ayar ve otomatik orta kaldırıldı |
| Ödemeye Git | Disabled değil; sebep CSS (`--wdp-success` açık renk, buttons.css:263-276). Cursor primary'ye çevirdi; iki düğme aynı mavi |
| Test verisi | Staging Nafile'de `_amount_presets`=50, 100 ve ücret %5 kullanıcı tarafından girildi (baseline bu duruma göre kabul edildi) |
| Test borcu | amount-options.mjs:291 `.catch(() => {})` ve :631 boş catch (yorumlu) yutma yasağına aykırı; sonraki Cursor görevinde düzeltilecek |
| GÖRSEL | G12: Sepete Ekle ikincil (çerçeveli) kural specificity kaybediyor; iki CTA da dolgulu mavi |
| e2e:quick | 42/0/0; accept: 4 ekran |

## Bölüm: Form alanları (analiz, 2026-10-20; kararlar bekliyor)

| Ayar | Davranış sorunu | Önerilen düzeltme |
|------|-----------------|-------------------|
| E-posta alanı | Hisseli formda render edilmiyor (FFR ~690-712) ama ürün sekmesi gösteriyor; kapalıyken sunucu yine kabul ediyor (AJX:147); geçersiz e-posta sessizce siliniyor (AJX:148-151); uzunluk sınırı yok; sepette görünmüyor | Hisselide gizle; kapalıysa sunucu yok say; geçersizde hata; maxlength |
| İthaf alanı | 120 bayt (sunucu) / 120 karakter (form) / eski yolda sınırsız; Türkçe karakter ortadan bölünebilir; kapalıyken kabul | mb_substr 120 karakter, her yolda |
| İthaf örnek metni | Ürün kutusu 120, kayıt 160 | 120 |
| Anonim bağış | Hiçbir yerde uygulanmıyor (yalnız sipariş meta); açıklama vaat ediyor | Karar gerekli |
| Ürün notu | Kutu 400, kayıt 1000 | 400 |
| Çok adımlı form | Genel açıkken ürün kapatamıyor; ithaf/anonim bloğunun hangi adımda çıktığı doğrulanacak | Ürüne üçlü seçim |
| Alan ikonları | Genel ayar formda okunmuyor; ürün varsayılanı "yes" | Boşken genel ayarı oku |
| KVKK | Formda aydınlatma metni yok; debug günlüğünde e-posta/ithaf maskelenmiyor (ajax.js:714-719) | Aydınlatma bağlantı ayarı; maskeleme |

Görsel aşamaya: G13 etiket birliği (İthaf placeholder, wizard, Anonim üç ifade, ikon açıklaması "ad, not, e-posta").

## Kararlar: Form alanları (2026-10-20)

| Kod | Karar |
|-----|-------|
| F1 a | Hisselide e-posta/ithaf/anonim gizlenir (ürün sekmesinde de) |
| F2 a | Sunucu ürün ayarına bakıp kapalı alanı yok sayar |
| F3 b | Anonim seçilirse isim YALNIZ herkese açık yerlerde maskelenir (kampanya bağışçı listesi, sayaçlar, teşekkür ekranı vb.). Sipariş, yönetici ekranı, e-posta, makbuz kayıtları DEĞİŞMEZ |
| F4 a | İthaf her yolda 120 karakter |
| F5 a | Ürün notu 400 |
| F6 a | Çok adımlı form ürün düzeyinde Genel/Açık/Kapalı |
| F7 a | Alan ikonları: ürün boşken genel ayar okunur |
| F8 a | Geçersiz e-postada hata, gönderim durur |
| F9 a | Sepet satırında e-posta/ithaf/anonim gösterilir |
| F10 a | Ayardan açılıp kapanan aydınlatma bağlantısı; varsayılan adres WordPress Gizlilik Politikası sayfası (ayarlıysa) |
| Ek | ajax.js:714-719 günlük maskeleme düzeltilir; önceki testteki iki hata yutma yeri düzeltilir |
| Onay | Toplu onay verildi |

## Güvenlik denetimi notları (denetim aşamasına)

| Konu | Not |
|------|-----|
| KVKK dışa aktarma/silme eşleşmesi | Bağışçı sorgusu yalnız faturalama e-postası veya wdp_donor_email ile eşleşiyor (class-privacy.php:78, 227-290). Fatura e-postası farklı, e-posta alanı kapalıysa kayıt bulunamayabilir; telefon/ad ile eşleşme yok. Şimdi düzeltilmeyecek. |
| Eski yol | CART add_donation_item_data (CART:52-110) hâlâ erişilebilir mi, doğrulanacak |
| E-posta şablonları | Sipariş satır meta'sının (ad/telefon/ithaf) müşteri/yönetici e-postasında basılıp basılmadığı doğrulanacak |

## Bölüm: Kampanya blokları (analiz, 2026-10-20; kararlar bekliyor)

Akika: Hedefe ulaşınca yalnız ekran değişiyor ("Hedefe ulaşıldı", konfeti); sunucu bağışı kabul etmeye devam ediyor (trait-wdp-ajax-cart-add.php:20-260, hedef kontrolü yok), toplanan hedefi aşıyor. Mevcut "hedefe ulaşınca davranış" ayarı yok.

| Ayar | Davranış sorunu | Teknik karar (Claude) |
|------|-----------------|-----------------------|
| Hedef tutar | Hedef ≤0 sessizce 100000'e çekiliyor (PSS:382-386); sunucuda zorlanmıyor | ≤0'da kayıt hatası, üst sınır; ürün başına `goal_reached_action` (continue/message/close), close iken sunucu + woocommerce_add_to_cart_validation + checkout'ta toplam+bekleyen ≥ hedef reddeder |
| En düşük tutar | Kampanyada "ürün fiyatı ile min'in küçüğü" kuralı açıklanmamış | Açıklamaya yaz |
| En fazla hisse | Admin 100, sunucu 50 | Tek sınır |
| Toplanan | on-hold (havale) sayılmıyor; silinen/çöpe atılan sipariş ve processing→on-hold düşmüyor olabilir; ilk okumada ağır tarama; işlem ücreti toplama dahil olabilir; Curcy dönüşümü yok | Düşme kancaları; arka plan hesap; ücret toplamdan hariç; çubuk %100'de kalır, gerçek tutar gösterilir |
| Kutlama animasyonu | Açıklama "bağış eklendiğinde" ama kod yalnız onaylı ≥100'de; baştan %100 ise her açılışta kutlayabilir (PB:320) | Yalnız oturumda geçiş anında; açıklama "Hedef dolunca" |
| Etki satırı/metni | "Genel etki metni" açıklaması var, ayar yok | Açıklama "Boşsa satır görünmez"; ürün başına, genel yok |
| Aciliyet şeridi/metni | — | — |
| Bitiş tarihi | UTC: bitiş günü başında (TR 03:00) şerit kapanıyor; geçersiz tarih sessizce süresiz | Y-m-d doğrula, wp_timezone() ile gün sonu; geçersizde hata; önbellek için JS yedek |
| Sosyal kanıt metni | Sabit metin, örnek "128 kişi"; uydurma sayı riski | `{donors}` yer tutucusu gerçek sayıdan; 0 ise gizle |
| Güven rozetleri/Rozetler | Genel kapalıysa ürün açık olsa da çıkmaz; ürün listesi genel listeyi değiştirir | Açıklamaya yaz |
| Blok sırası | Genel alanın örneği (`sadaka,trust`) yanıltıcı | Genel alan yalnız 5 başlık bloğu |
| İlerleme çubuğu | Metin yüzdesi bekleyen dahil, dolgu yalnız onaylı | Tek fonksiyon |

Görsel aşama: G14 yüzde gösterimi (admin floor / form 1 ondalık), sekme yardımında "Üst Limit" adı.
Güvenlik denetimi notu: etki/aciliyet/sosyal kanıt/rozet çıktıları esc_html ile temiz.

## Kararlar: Kampanya blokları (2026-10-20)

| Kod | Karar |
|-----|-------|
| K1 b | Hedefe ulaşan kampanya bağış almaya devam eder + mesaj. Ürün başına `goal_reached_action` (continue / message / close) ayarı; varsayılan message |
| K2 | Ürün başına mesaj alanı; varsayılan metin: "Hedefimize ulaştık, desteğiniz için teşekkür ederiz. Bu kampanyaya yapılan fazla bağışlar benzer projelerimizde kullanılır." Mesaj bağıştan ÖNCE formda görünür |
| K3 a | on-hold (havale/EFT) toplananda sayılmaz; yalnız ödemesi onaylananlar |
| K4 b | Elle/offline bağış alanı EKLENMEZ (elden bağış yok) |
| K5 a | Sosyal kanıt yalnız gerçek sayı (`{donors}`) |
| K6 a | Aciliyet bitişi yalnız şeridi kaldırır; kampanya kapanışı K1 ayarıyla ayrı |
| K7 | EUR/USD bağış gelebilir, Ikram Aid için GBP de hedefleniyor: Toplanan tutarda doğru para birimi dönüşümü yapılacak (ürünün/mağaza para birimine, sipariş tarihindeki kurla; teknik karar rapora yazılacak) |
| Onay | Toplu onay verildi; Form alanları bitince başlat |

## Sonraya bırakılanlar (şimdi YAPMA)

| Konu | Not |
|------|-----|
| GiveWP karşılaştırması | Eksik özellik analizi: düzenli bağış, bağışçı paneli, makbuz, raporlar vb. |
| Saha iletimi (Refaktörde) | WooCommerce sipariş dışa aktarması + sipariş öğesi bilgileri sahaya iletim için yeterli mi, kontrol et (yeni özellik eklenmez) |
| Aydınlatma bağlantısı (F10) | Eklenti uzun varsayılan metin YAZMAZ; yalnız kısa bağlantı: "Kişisel verilerin işlenmesine ilişkin aydınlatma metni" (etiket ayardan değişir, adres Gizlilik Politikası sayfası). Yurt dışı aktarım bilgisi sitedeki KVKK sayfasının işidir. 10.31.0'daki uzun varsayılan metin 10.32.0'da kaldırılır |
| Refaktör | Ayar turu sonrası: dosya yapısı sadeleştirme, ölü kod, adlandırma; davranış değişmez. Özellik envanteri: her özellik ve ayar için Çekirdek / WP-WooCommerce zaten yapıyor / Gereksiz etiketi ve öneri (koru / sadeleştir / kaldır). Kampanya blokları (kutlama, sosyal kanıt, aciliyet, etki metni) ve tasarım ayarları dahil |

## Durum: 10.31.0 Kampanya blokları (kabul edildi, main'e merge)

| Konu | Sonuç |
|------|-------|
| Test | verify + PHPUnit 214 + JS 43 geçti; e2e:quick 60/0/0; accept 4 ekran (campaign popup/panel open/errors) |
| Akıbet | Akika: mesaj bağıştan önce görünüyor, ₺147.750 / hedef ₺100.000 %100 |
| CANLIYA ALMA ENGELİ | Curcy sipariş meta anahtarı (`wmc_order_info` vb.) gerçek EUR/USD siparişle DOĞRULANMADI; anahtar yoksa satır toplamdan atlanıyor ("N sipariş dönüştürülemedi") → canlıda toplanan EKSİK görünebilir. 2İ öncesi gerçek/test siparişle ölçülecek |
| G14 | Yüzde gösterimi (admin floor / form 1 ondalık), "Üst Limit" adı |
| G15 | Tamamlanmış (hedefe ulaşıldı) çubuk/yüzde rengi eskisinden açık (is-complete `--wdp-success`); marka mavisiyle tutarlı olmalı |
| G16 | Close durumunda `aria-disabled` tetikleyici, erişilebilirlik gözden geçirmesi |

## Bölüm: Bu ürüne özel görünüm (analiz, 2026-10-20; kararlar bekliyor)

Genel: ürün teması kabuk div'ine satır içi CSS değişkeni olarak yazılıyor (modal-shell-renderer.php:320,498); popup, panel, sayfa içi form aynı; tip koşulu yok; liste kartı (`[wdp_donations]`) ürün temasını kullanmıyor. Güvenlik: kaçışlama yeterli (sanitize_hex_color + esc_attr).

| Ayar | Davranış sorunu | Teknik karar (Claude) |
|------|-----------------|-----------------------|
| Düzen | "Genel ayarı kullan" yok, boş = klasik | İş kararı P1 |
| Ürün görselini göster | Görsel yoksa sessiz boş | Admin'de uyarı |
| Kategori rengini kullan | Açıkken ürünün ana rengi sessizce yok sayılıyor; başlık ve ana renk öncelik kuralları farklı | İş kararı P2; tek öncelik kuralı belgelenir |
| Ana renk | Geçersiz hex sessizce siliniyor; `#`'siz giriş (desen izin veriyor) siliniyor (service:471); açık renkte beyaz buton yazısı okunmaz; türevler (soft/border) genel markada kalır | `#` otomatik ekle; geçersizde kayıt hatası; ürün için `WDP_Color_Palette::from_hex` ile tüm türevler + `--wdp-on-primary`; kontrast <4.5:1 ise uyar + yazı rengi otomatik |
| Hover rengi | Boşsa genel hover (ton uyumsuz) | Boşsa ana renkten türet |
| Arka plan rengi | Koyu seçilirse metin okunmaz | Kontrast uyarısı; yalnız açık/koyu algılayıp metin rengini türet |
| Köşe | Kayıt 0-40, çıktı 4-32, UI 4-32 (1-3 ve 33-40 kayıtlı ama farklı çiziliyor); panel/sheet köşesi genel kalıyor | Tek sınır 4-32 (tek sabit), kayıtta uyarı, panel köşesi orantılı |
| Yoğunluk | ETKİSİZ: `--wdp-density` hiçbir CSS/JS'te okunmuyor (tokens.css:302 yalnız tanım) | Ayar şimdilik gizlenir (kayıtlı veri silinmez); CSS'e bağlama GÖRSEL AŞAMA'da |
| Ölü meta `_theme_preset_id` | Kullanılmıyor, stil paketiyle bağ yok | Kaldırma önerisi: okuma/yazma çıkar, kayıtlı veri silinmez |

Güvenlik denetimi notu: ürün ayarı kaydında nonce/yetki bu analizde doğrulanmadı.
Görsel aşama: G17 yoğunluk CSS bağlama; G18 hikâye düzeni dar ekranda; G19 karışık palet/köşe.

## Kararlar: Bu ürüne özel görünüm (2026-10-20)

| Kod | Karar |
|-----|-------|
| P1 a | Düzen ürün başına, boş = Klasik |
| P2 | "Kategori rengini kullan" kutusu KALDIRILIR (kayıtlı veri silinmez, okunmaz). Kural: ürün ana rengi doluysa o; boşsa kategori rengi; o da boşsa genel renk. Renk alanı altına: "Boş bırakılırsa kategori rengi, o da yoksa genel renk kullanılır." |
| P3 a | Liste kartları genel tasarımda kalır |
| Düzeltme | Aydınlatma: uzun varsayılan metin kaldırılır, yalnız kısa bağlantı (bkz. Sonraya bırakılanlar) |
| Onay | Toplu onay verildi |

## Durum: 10.32.0 Bu ürüne özel görünüm (main'e merge)

| Konu | Sonuç |
|------|-------|
| Test | verify + PHPUnit 229 + JS 43; e2e:quick 65/0/0; görsel Değişti 0 (accept gerekmedi) |
| Dikkat | ship içindeki ilk e2e'de `form-fields-wizard-product-off` tetikleyici tıklama timeout (63/0/1); tekrar koşuda geçti. Kararsızlık şüphesi: e2e:stability ile refaktörde incele |
| Dikkat | e2e:quick süresi ~150 sn → ~840 sn'ye çıktı (testler eklendi); refaktörde E2E hız/paralellik gözden geçirilecek |
| Güvenlik notu | Ürün ayarı kaydı: nonce + manage_woocommerce + edit_post var (class-admin-product-data-tab.php:99-106) |
| Görsel aşama | G17 yoğunluk CSS bağlama; G18 hikâye düzeni dar ekran; G19 karışık palet/köşe; koyu modal arka plan görsel doğrulama |

## Bölüm: Kısa kod / blok / Elementor / Gelişmiş (analiz, 2026-10-20; kararlar bekliyor)

Kapsam: [wdp_donation_button], [wdp_donation_button_panel], [wdp_donation_form], [wdp_donations], Gutenberg wdp/donation-form ve wdp/donations, Elementor "Bağış Formu" ve "Bağış Listesi", ürün sekmesi "Kısa kodlar", Ürünler sekmesi kısa kod sütunu, Gelişmiş sekmesi. Üç giriş (kısa kod, blok, widget) aynı render fonksiyonuna iniyor: yinelenen mantık yok.

| Konu | Davranış sorunu | Teknik karar (Claude) |
|------|-----------------|-----------------------|
| `style` özniteliği (buton) | CSS enjeksiyonuna açık (düşük risk) | Kaldır (tema/Elementor stilini yapar) |
| id/slug/sku ile verilen ürün | Bağış kapsamı kontrolü atlanıyor (bilinçli), belgede yok | AYARLAR.md'ye yaz |
| `button_text` (form) | Ölü öznitelik: şablon kullanmıyor; blok/widget yanlış anahtar (`text`) gönderiyor | Yalnız popup/panelde göster, inline formda alanı gizle (karar 8a) |
| Form: aynı ürün ikinci kez | Sessizce gizleniyor, editöre HTML yorumu | Mevcut hal (karar 4a) |
| Ürünü çözülemeyen kod | Ziyaretçiye boş, not yalnız yöneticiye | Mevcut hal (karar 3a) |
| Form: stoksuz/satın alınamaz | render_form'da kontrol yok (şablonda unavailable_notice kapsamı doğrulanacak) | Kontrol ekle |
| [wdp_donations] önbellek | 1 gün transient; ürün kaydında (ad/fiyat/görsel/yayın) bump yok → bayat; sipariş tamamlanınca bump doğrulanacak; orderby=random 1 gün sabit; aynı öznitelikli iki liste aynı sekme id'si; boş sonuçta editörün admin notu cache'e girip ziyaretçiye gidebilir | Ürün kaydı/çöp/durum ve sipariş kancalarında bump; random için cache atla; admin notu ve sekme id'si cache dışı |
| Liste sekmeleri | aria-controls hedefi yok, tabpanel rolü yok; list.js hash'te querySelector kırılabilir | ARIA tamamla; hash beyaz liste/CSS.escape |
| Liste tip filtresi | Çok tipte limit'ten az ürün çıkabilir | Sorguyu düzelt |
| Elementor ürün seçimi | 300 ürün sınırı, her yüklemede sorgu, yalnız simple | Ajax arama |
| Elementor liste widget | image_size kontrolü yok | Ekle |
| Ürün sekmesi "Kısa kodlar" | 6 satır, kimliksizler yanıltıcı | İş kararı 6 |
| Ürünler tablosu filtresi | "Elle eklenmiş kısa kod" yalnız ürün içeriğine bakıyor, yanıltıcı | İş kararı 5 |
| Gelişmiş: veri silme | Ürün ayarlarının çoğu `_enable_*`, `_sadaka_*` vb. wdp ön eksiz; uninstall bunları silmiyor; ekran metni yanlış/eksik; onay uyarısı yok; sipariş/HPOS dokunulmuyor (doğru) | İş kararı 7; onay kutusu + "geri alınamaz" metni |
| Gelişmiş: alt bağış denetim tablosu | Bir kerelik 10.28.4 anlık görüntüsü, canlı değil; yeni kurulumda anlamsız | İş kararı 2 |
| nopriv AJAX | wdp_render_modal sağlam (origin+hız sınırı, nonce'suz bilinçli); eski wdp_render_donation_button yolu ölü/yinelenen aday; get_product_name/info taslak/özel ürün sızdırıyor mu doğrulanacak | Eski yolu denetle, kullanılmıyorsa kaldır; sızıntı testi |
| Belgelenme | AYARLAR.md öznitelik tablosu yok (README'de var) | AYARLAR.md'ye ekle |

Güvenlik denetimi notu: origin başlığı yokken wdp_render_modal davranışı doğrulanacak; get_product_name/info sızıntı testi.
Görsel aşama: G20 kapalı hedef butonunun görünümü (is-disabled), G21 tablo satır içi stiller (Gelişmiş).

## Kararlar: Kısa kod (2026-10-21)

| Kod | Karar |
|-----|-------|
| S1 a | [wdp_donations] kalır |
| S2 a | Gelişmiş sekmesindeki "Alt bağış bağlantıları" denetim tablosu kaldırılır |
| S3 a | Ürünler sekmesindeki "Elle eklenmiş kısa kod" filtresi kaldırılır |
| S4 a | Ürün sekmesinde ve Ürünler tablosunda 3 kısa kod: buton, panel, form |
| S5 a | Eklenti kaldırılınca tüm ürün ayarları (`_enable_*`, `_sadaka_*` dahil) ve eklenti seçenekleri silinir; siparişlere dokunulmaz; kaydederken "geri alınamaz" onay kutusu |
| Ek şart | Liste önbelleği, ürünün WooCommerce fiyatı ve bağış sekmesi ayarları değiştiğinde de yenilenir |
| Teknik kararlar | Onaylandı (liste önbelleği, ARIA, style kaldır, button_text, Elementor ajax, eski AJAX yolu) |
| Onay | Toplu onay verildi (accept + commit + push + merge). Sonra ayar turu kapanır, 6. Durum + AŞAMA ÖZETİ + refaktör ön önerisi |
| Sıra kararı | Ayar turundan sonra: 1) Ikram Aid test ortamı, 2) dil desteği (i18n), 3) refaktör |

## Durum: 10.33.0 Kısa kod (kabul edildi, main'e merge) — AYAR TURU KAPANDI

| Konu | Sonuç |
|------|-------|
| Test | verify + PHPUnit 242 + JS 43; e2e:quick 70/0/0; 10 ekran accept (fixed/shares/campaign/custom popup+panel: Ödemeye Git artık Sepete Ekle ile aynı mavi, 10.29.1 kararı tüm tiplere yayıldı; 1 px genişlik kayması) |
| Güvenlik | Yetkisiz uçlar: taslak/özel/şifreli ürün sızıntısı yok; wdp_render_modal origin yok → reddedilir; eski nopriv wdp_render_donation_button kaldırıldı |
| Uninstall | Açık anahtar listesi + onay; sipariş/HPOS/WooCommerce çekirdek silinmez |

## IKRAM AID ORTAMI ve GENEL UYUM GÖREVİ (2026-10-21)

Kullanıcı düzeltmeleri: Ikram Aid için AYRI staging kurulmaz (ortam hazır); Ikram'da Curcy YOK, GBP WooCommerce ana para birimi. Temel ilkeler CLAUDE.md'nin en üstüne eklendi.

| Konu | Not |
|------|-----|
| Ortam | ikramaid.uk (gerçek, yayında olmayan site): WP 7.1.3, WooCommerce 11.2.1, Blocksy + Elementor 4.3.5 Free, Slider Revolution 7, SiteGround (sg-cachepress + object-cache), GBP (2 ondalık, virgül binlik), İngiltere, İngilizce. SSH alias "ikramaid", WP yolu ~/www/ikramaid.uk/public_html. Eklenti 10.32.0 kurulu |
| Ürünler | Sadaqah, Zakat, Orphan Support (bağışçı belirler, min 5), Food Pack £40, Qurbani £120 (sabit), Water Well (hedefli £3.000). General fiyat geçici olarak min tutara eşitlenmiş. Appeals sayfası (post 100): Elementor "Bağış Listesi" |
| Kurallar | Sayfa/ürün içeriği/tasarıma dokunma. Arama motoru engeli ve WooCommerce "Coming soon" açık kalır (değiştirmek KRİTİK KAPI, önce kullanıcıya sor). Gerçek ödeme yok; test sipariş/müşteri kayıtları işaretlenir ve her koşudan sonra silinir |
| Güvenlik kilidi | ship hedefi izinli: yalnız staging28.hedefdernegi.org ve ikramaid.uk; hedefdernegi.org (canlı) kesin engelli. Ikram Aid yayına alınmadan önce ikramaid.uk izni KALDIRILACAK (KAYIT) |
| Test düzeni | Cihaz sırası: iPhone (WebKit) → Android (Chromium) → masaüstü (Chrome). e2e:quick yalnız iPhone, değişen alan, hedef <5 dk. Tam paket (3 cihaz, 2 gerçek ortam) merge öncesi. Tema matrisi sürüm öncesi (Avada, Blocksy, Twenty Twenty-Five, Storefront; çeşitli para birimi/ayırıcı/sembol konumu; blok + klasik ödeme; HPOS açık/kapalı). Siteye özel değerler ortam profilinden okunur; baseline'lar ortam+cihaz başına ayrı |
| Kabul a | Liste kartı: görsel ve başlık gerçek `<a href>` (ürün sayfası); "Bağış Yap" sayfadan ayrılmadan formu açar; ürünü olmayan kategori/Uncategorized sekme yok |
| Kabul b | Bağışçı belirler/Hedefli: General fiyat BOŞ olsa da listede görünür ve sepete eklenir; min tutarın tek kaynağı Bağış sekmesi; mevcut ürünler bozulmaz; liste önbelleği doğru yenilenir |
| Kabul c-g | c: Bağışçı belirler kartında sabit fiyat yok. d: Hedefli kartta toplanan+hedef tutar. e: tutar alanı etiketi tüm türlerde aynı (Water Well'de yok). f: Bağış Formu widget "ürün bulunamadı" yalnız Elementor editöründe. g: GBP ana para biriminde tutar/toplam/ücret/hedef/sipariş doğru |
| Genel uyum denetimi | Siteye/ülkeye/temaya bağlı varsayımların listesi (TL/₺, +90, sabit Türkçe, TR kuralları, sabit ondalık/ayırıcı, Avada seçicisi, Hedef ürün adı/ID, ödeme yöntemi/çoklu para birimi eklentisine özel kod, Curcy'ye özel kod); her bulgu: dosya, ne yapıyor, WP/Woo standart karşılığı, hangi görevde düzelecek. Kabul şartlarını bozanlar bu görevde düzelir, kalanı yalnız listelenir |
| Curcy | Hiçbir ortamda kurulu değil: "Curcy kur kaydı" engeli ertelendi; Hedef canlıya alınmadan önce Curcy staging28'e kurulunca kapatılır. Bu görevde Curcy testi YOK. Eklentideki Curcy'ye özel kod → genel uyum listesine |
| Sonraki göreve (DİL) | Metin çevirisi; telefon ön eki WooCommerce mağaza ülkesinden (Ikram +44, Hedef +90); tüm tutarların WooCommerce sayı biçimiyle yazılması ("£3,000.00" vs "£3.000 kaldı", "0.0%"); Elementor widget'larının İngilizce aramada bulunması |
| Sonraki göreve (FORM ALANI YÖNETİMİ) | Telefonun zorunlu/isteğe bağlı olması ayar olacak (varsayılan zorunlu) |
| Sonraki göreve (GÜVENLİK) | "KVKK denetimi" genel gizlilik denetimi: KVKK + UK GDPR + WordPress kişisel veri dışa aktarma/silme araçları; fatura e-postasıyla sınırlı eşleşme bu kapsamda |
| Plan | Görev 3 Cursor görevine bölünür: (1) ortam altyapısı + test düzeni, (2) kabul şartları a-g + mobil baseline "Benzer Bağışlar" + genel uyum denetimi listesi, (3) tema/Woo uyum matrisi |

### GÖRSEL AŞAMA eklemeleri

| # | Madde |
|---|-------|
| G22 | Görsel aşama mobilden başlayarak tasarlanır; dört temada (Avada, Blocksy, Twenty Twenty-Five, Storefront) mobil ve masaüstünde doğrulanır |
| G23 | Formdaki büyük boşluk |
| G24 | Sabit fiyat kutusu buton gibi görünüyor (= G10) |
| G25 | "Ödemeye Git" ile "Sepete Ekle" aynı ağırlıkta (ikincil/birincil ayrımı) |
| G26 | Ad Soyad ve Not alanlarının hizası |
| G27 | Liste kartlarının sayfa başlığıyla aynı hizada olmaması |

## GENEL UYUM DENETİMİ (kod taraması, 10.33.0, 2026-10-21) — yalnız tespit

Görev: DİL = i18n/sayı biçimi/telefon; REF = refaktör; GÜV = güvenlik; FORM = form alanı yönetimi; KABUL = 2/3. Önem: Y/O/D.

| # | Alan | Bulgu (dosya:satır) | Woo/WP standardı | Görev | Önem |
|---|------|---------------------|------------------|-------|------|
| 1 | JS para biçimleme | `formatPrice` sabit `tr-TR` (utils.js:85); `formatCurrency` yalnız USD en-US, EUR de-DE, diğer HER ŞEY tr-TR → GBP £1.000,5 (utils.js:123-133) | Woo ayarları (ondalık sayı, binlik/ondalık ayırıcı, fiyat biçimi) wdp_ajax'a aktarılıp JS'te kullanılır | KABUL (çekirdek mekanizma) + DİL (yayılım) | Y |
| 2 | JS tutar ayrıştırma | Nokta her zaman binlik sayılıyor: "100.50" → 10050 (utils.js:68,115; product.js:317-324; cart/ui.js:30); pricing.js:69, sadaka-rules.js:28-30 tahmin; wizard.js:425, ajax.js:624 | Woo ondalık ayırıcısıyla ayrıştır / DOM'a ham nokta-ondalıklı sayı | KABUL (GBP doğruluğu) | Y |
| 3 | Varsayılan hızlı tutarlar | 100,250,500,1000,2500 para birimine bakmadan (form-fields-renderer.php:37; normalizer:88,210; form-tabs-renderer:368,470); varsayılan hedef 100000 (donation-type.php:25) | Para birimine duyarlı varsayılan (ya da boş) | KABUL (GBP) + DİL | Y/O |
| 4 | PHP biçim | Yüzde `number_format(...,',')` (cart.php:465, form-modules.php:707); `$symbol . wc_format_decimal` (cart.php:631-632); sabit ₺ yönetici önizlemesi (form-tabs-renderer:411,414,483; layout-tabs:115); sembol/kod yedekleri ₺/TRY (utils-price:38, assets-registry:284,286, progress-currency:26, cart-add:384 ve JS 6 yerde); girdi ayrıştırma "Türkçe ondalık" (form-modules:214,254,307,339; settings-service:540-559; utils:266-269) | wc_price, wc_format_localized_decimal, get_woocommerce_currency(_symbol), wc_format_decimal | DİL | O/D |
| 5 | Telefon | Varsayılan ülke 'tr' (class-phone-field.php:196-202; registry:345; phone-input.js:24-25,48); Türkiye listenin başına sabit, Collator('tr_TR'), ülke adları Türkçe sabit, tr için özel normalleştirme (phone-input.js:32,119-124) | `WC()->countries->get_base_country()`, `get_countries()`, locale sıralaması | DİL | Y/O |
| 6 | Sabit Türkçe metin | JS ~45 satır: cart/ui.js ("Sepete Git", "Bağış Sepetiniz", "Sepetten Kaldır", "Sepetiniz boş"), progress-bar.js ("Hedefe ulaşıldı", "kaldı"), form/messages, validate, wizard, form, ajax, feedback, modal (yedek metinler); block.json başlıkları; order-meta-keys.php:155-157 çift sürüm | wdp_ajax.strings / wp_set_script_translations / `__()` | DİL | Y/O |
| 7 | Türkiye kuralı | TC kimlik/il/vergi YOK (uyumlu); Collator tr_TR; "İthaf/hisse/sadaka" kavram adları İslami-Türkçe (genel özellik olarak tasarlanmış) | | DİL | O |
| 8 | Tema/builder | builder-detect: Avada (fusion_tb_section, FusionBuilder), Divi, Bricks, Beaver tespiti (compat/class-builder-detect.php) ve product-page-integration.php:17 Avada Layouts yorumu; theme-isolation-overrides.css `html body` + !important; sepet satırı CSS'i yalnız klasik tablo (blok sepet/ödemede çalışmaz). CSS'te tema adı/seçicisi YOK (uyumlu) | | REF (+3/3 blok ödeme) | O/D |
| 9 | Hedef'e özel | Ürün/ID/alan adı yok (uyumlu); "sadaka" ~560 geçiş iç ad (sadaka.js, cart.php, class-sadaka-product-visibility...) — genel "alt bağış" özelliği; eklenti başlığı "Hedef Derneği" | | REF (iç ad), DİL (etiket) | O/D |
| 10 | Curcy/çoklu para birimine özel kod | class-progress-currency.php:3,47,63-69,84,107-113 (`wmc_order_info`, `_wmc_order_*`, `_woocs_order_rate`, `WOOMULTI_CURRENCY_Data`); lazy-modal.js:73-80 (çerezler wmc_/woocs_), :136-159 (`.woocs_currency`, wmc_/woocs_/curcy_currency_changed olayları), :90 (WPML çerezleri) | Genel `wdp_progress_convert_amount` / `wdp_progress_live_rate` filtreleri, `get_woocommerce_currency()`, `document.documentElement.lang`, genel `wdp:currency-changed` | REF (genelleştir) + Hedef canlı öncesi Curcy doğrulaması | O |
| 11 | WooCommerce yolları | HPOS bildirimi var; sipariş okuma `$order->get_meta` (yedek get_post_meta zararsız); migration/uninstall `$wpdb` yalnız ürün meta; sepet `add_to_cart`/`woocommerce_before_calculate_totals` standart; toplanan `wc_get_orders` | | REF (küçük) | D |
| 12 | Vergi | Kart fiyatı ham `$product->get_price()` (donations-list.php:802,809); `wc_get_price_to_display` hiçbir yerde yok → vergi dahil/hariç gösterim ayarı gözetilmiyor | `wc_get_price_to_display($product)` | KABUL (kart fiyatı) | O |
| 13 | Liste: fiyatsız ürün | Sorgu `is_purchasable()` ister (donations-list.php:650); General fiyatı boş bağışçı-belirler ürün listeden düşer; `product_is_unavailable` (shortcodes.php:268) aynı; eklenti fiyat boşken is_purchasable'ı true yapıyor mu DOĞRULANACAK | | KABUL (şart b) | Y |
| 14 | Widget mesajı | Kısa kod "ürün bulunamadı" shortcodes.php:226; Elementor widget'larında benzer mesaj bulunmadı: yalnız editörde görünme (şart f) doğrulanacak | | KABUL (f) | O |
| 15 | Saat dilimi / dil kodu / RTL | `wp_timezone()` doğru; lazy-modal.js:91 yedek 'tr' (düşük); RTL: accessibility.css `[dir=rtl]` var ama 34 fiziksel margin/padding-left; tam RTL doğrulanmadı | mantıksal özellikler | DİL | D |
| 16 | GÜV / FORM | Bu taramada ilke ihlali bulunmadı | | | |

KARAR (Claude): 2/3'te yalnız GBP doğruluğunu sağlayan ÇEKİRDEK düzeltilir: Woo sayı ayarlarını wdp_ajax ile JS'e aktar + tek JS biçimleme/ayrıştırma yardımcısı (maddeler 1, 2) + GBP/USD için güvenli varsayılan hızlı tutar/hedef (madde 3) + madde 12-14. Metinlerin çevirisi, telefon ön eki ve geri kalan tüm biçimlendirme yayılımı DİL görevinde.

## OLAY: Test temizliği staging28'de gerçek sayfaları çöpe attı (2026-10-22)

| Konu | Not |
|------|-----|
| Belirti | staging28'de "Ana sayfa" ve "Bağış Doğrulama — Donation Success Page" çöpe gitti; WordPress Okuma ayarı "Son yazılarınız"a döndü. Daha önce 2b'de Woo sepet sayfası (id 291) de çöpte bulunmuştu (muhtemelen aynı kaynak) |
| Durum | Koşular durduruldu; MERGE YOK (kullanıcı kararı). Sayfaların geri yüklenmesi KULLANICININ işi (Cursor/Claude yapmaz) |
| Kural | CLAUDE.md "TEST GÜVENLİĞİ" maddesi eklendi |
| İş | Görev 2d: kök neden (adli inceleme, salt okunur), düzeltme, kanarya denetimi, Ikram'da aynı olay var mı kontrolü |

### Olay sonucu (Görev 2e, yalnız yerel; 2026-10-22)

| Konu | Sonuç |
|------|-------|
| Mekanizma | KESİN: `wp_delete_user($id)` reassign'sız → o kullanıcının sayfaları ÇÖPE, medyası KALICI silinir. Yerelde yeniden üretildi (build/local-wp/evidence/scenarios.json) |
| Kod | YÜKSEK OLASILIK: test-cleanup.mjs:64-65 (HEAD dbe472e) `@wdp-e2e.test` kullanıcıları siliyordu (işaret/kayıt defteri/içerik kontrolü yok); cleanup-e2e.php'de `$EMAIL_NEEDLE` tanımsız → search '*' tüm kullanıcılar riski. Hasar veren koşuda hangisinin çalıştığı BELİRSİZ (JSON saklı değil) |
| Eklenti | Çürütüldü: sayfa/medya/kullanıcı oluşturma-silme-çöp YOK, WP/Woo sayfa ayarlarına yazmaz; tüm update_option/delete_option yalnız wdp_* |
| Ikram | Hasar kanıtlanamadı (belirsiz): temizlik kullanıcı silme kodu Ikram'da da çalışabilirdi; kayıtta Ikram'da silme yok (bir koşuda SSH koptu). Kullanıcı elle kontrol edecek |
| Düzeltme | Merkezi uzak koruma (spawnGuarded + REMOTE_FREEZE), staging28 izinden çıktı, tek korumalı temizlik (run_id + kayıt defteri + kara liste + kullanıcı içerik kontrolü), createTempPage/deletePost/ensureWooCartPagePublished kaldırıldı, uzak ayar yazımı kalktı, kanarya, e2e:bootstrap (fixture), yerel WP kanıt ortamı (`npm run test:local-wp`) |
| Durum | REMOTE_FREEZE AKTİF; uzak komut yok; 2/3-2c-2e değişiklikleri UNCOMMITTED; merge/accept yok; yeni staging adresi bekleniyor |
| Açık | Ikram baseline'ları ve Hedef accept bekliyor (yeni staging + fixture modu sonrası yeniden üretilecek); Görev 3/3 (tema/WooCommerce uyum matrisi) bekliyor |

## YENİ OTURUM: ANA YÖNERGE (2026-10-22)

Kullanıcı yönergesi önceki tüm görev metinlerinin yerini aldı; CLAUDE.md buna göre yeniden yazıldı. Bu oturum: Faz 1–4, Faz 5'ten önce AŞAMA ÖZETİ.

| Konu | Not |
|------|-----|
| Uzak ortamlar | staging30 (`hedef-staging`, `~/www/staging30.hedefdernegi.org/public_html`) + Ikram (`ikramaid`, `~/www/ikramaid.uk/public_html`). staging28 emekli. Kilit klasör yoluna göre |
| Toplu onay | Accept, commit, push, main'e merge: parça testleri geçince Claude yapar. Kritik kapı: site görünürlüğü, canlı, ödeme/e-posta/SMS ayarları |
| Teknik karar (Claude) | Cursor `env -u CLAUDECODE` ile başlatılır; uzak işlem operatör kapısı `CLAUDECODE=1` ister → Cursor uzak komut çalıştıramaz (cli.json deny'a ek ikinci katman) |
| Teknik karar (Claude) | Faz 1 üç paralel worktree parçası: 1A kilit/profil/cli.json/canlı tarama, 1B ölçüm engeli/uzakta sipariş yok/oturum, 1C salt okunur keşif |
| Faz 2 riski | Canlı 10.3.1 git geçmişinde yok (ilk commit sonrası); göç adımları 10.27.0'dan başlıyor. 10.3.1 ayarları "ilk kurulum" sanılıp varsayılana dönebilir. Karar: önce staging30'dan 10.3.1 kaynağı + ayar anlık görüntüsü (yerel, git dışı) ile YEREL prova, sonra staging30 |
| 2B (10.34.3) | Prova 21 ayar değişimi sınıf 4’tü (kayıp): `rewrite_stored_options` boş istekle normalizer çalıştırıp `array_merge($current, $clean)` ile kullanıcı radius/layout değerini eziyordu. `ui_border_radius` 10.3.1’de yok → 10 yazılıp 4 radius senkron. Düzeltme genel: kullanıcı anahtarı kazanır; `ui_border_radius` yoksa legacy radius’tan tohum. Bilinçli birim dönüşümü yok (docs/design-inventory radius birleştirme yönetici kaydında kalır, göçte değer ezilmez). |
| 2C (10.34.3) | 2B tohumu `absint(...) > 0` ile kayıtlı 0’ı yok sayıyordu (keskin köşe → 10). Kural: anahtar varsa ve `''` değilse 0 dahil korunur; yalnız yoksa/boşsa 10. `pick_int` / hissedar radius / gölge bulanıklığı aynı `has_int_token`. Runtime CSS (`trait-wdp-assets-inline-styles` `ui_radius <= 0` → 12) bu görevde dokunulmadı. |
| Site adı geçişleri (Faz 6) | `woo-donation-popup.php:4` açıklama "Bu eklenti Hedef Derneği tarafından hazırlanmaktadır"; `:5` Author "Hedef Derneği"; README.md:47 (`/hedefdev/` örneği), :71 (hedefdernegi yol örneği), :400 ("Ikram Aid uyumu" değişiklik günlüğü); betik adları `scripts/{deploy,ship}-ikram.mjs`, `ikram-wp.mjs`, `lib/ikram-wp-guard.mjs`; `.env.*.ikram.example`; docs/CLAUDE.md (iç belge). Eklenti kodu (includes/assets/templates/blocks) temiz |

## FAZ 1 KEŞİF (2026-10-22, salt okunur)

| Ortam | Bulgu |
|------|-------|
| staging30 | WP 7.1.3, WC 11.2.1, PHP 8.2, Avada, tr_TR, TRY 0 ondalık, binlik "." ondalık "." (ikisi aynı!), sembol solda, TR, vergi kapalı, HPOS açık, eklenti 10.3.1 (wdp seçeneği 10), 38 aktif eklenti. Ödeme: yalnız POS Entegratör (gpos) açık. E-posta: WP Mail SMTP (mailer `mail`). SMS: Netgsm. wp-cron 71 kanca |
| staging30 ENGEL | facebook-for-woocommerce, official-facebook-pixel, google-listings-and-ads, google-site-kit AKTİF (kullanıcı etkisiz sanıyordu) → uzak koşu DURDURULDU, kullanıcıya bildirildi. Sepete ekleme kancasında: netgsm, google-site-kit, facebook-for-woocommerce, code-snippets (sunucu tarafı olay gönderebilir) |
| staging30 görünürlük | blog_public=1, coming soon kapalı (arama motorlarına açık) — kritik kapı, kullanıcıya soruldu |
| Ikram | WP 7.1.3, WC 11.2.1, blocksy-child, en_US, GBP 2 ondalık "," ".", GB, HPOS açık, eklenti 10.34.2, 10 aktif eklenti; ölçüm/SMS/SMTP/webhook yok; ödeme yöntemlerinin hepsi kapalı; coming soon açık, blog_public=0. Sepet/ödeme klasik |
| Ikram bootstrap | 7 private + gizli işaretli test ürünü (id 913–919), fixtures build/e2e/fixtures-ikram-aid.json |
| 10.3.1 kaynağı | staging30'dan salt okunur indirildi → build/migration/source/10.3.1 (git dışı) |

## FAZ 4 yerel matris bulguları (4A, 2026-10-22; testler 60/60 geçti ama ekran incelemesinde)

| # | Bulgu | Görev |
|---|-------|-------|
| M1 | Tutar alanı yer tutucusu `€ min: 10`: sembol mağaza ayarı (right_space) yerine hep solda | Faz 5 (Woo sayı/sembol biçimi) + matris testine sembol konumu kontrolü eklenecek |
| M2 | İngilizce sitede sepet satırı etiketleri Türkçe (Bağışçı, E-posta, İthaf) | Faz 5 |
| M3 | Sepette telefon `(905551234567)`: `+` ve biçim yok | Faz 5 |
| M4 | Telefon ön eki EUR/US mağazada `+90` (mağaza ülkesinden gelmeli) | Faz 5 (bilinen) |
| M5 | TT5: form alanı metinleri soldan girintili, simge yok → boşluk (hizasız) | Faz 7 (G26) |

## FAZ 1–3 ara bulgular (2026-10-22)

| # | Bulgu | Sonuç |
|---|-------|-------|
| F1 | Birim test Claude kabuğunda gerçek SSH açtı (salt okunur, zararsız düştü) | 1F: testler ağa çıkamaz; sahte ssh shim ile 0 çağrı kanıtı |
| F2 | Uzak `base64 -d` (OpenSSL) uzun tek satırda sessizce 0 bayt | 1H: gzip+fold, boş dosyada çıkış 97 |
| F3 | Kanarya ön kontrolü id=0'ı (page_for_posts, terms) eksik sayıyordu | 1I: id 0 = ayarlı değil |
| F4 | Uzak POST varsayılan-red eklentinin FormData isteğini engelledi ("Ürün bilgileri alınamadı"), test yakalamadı; `wdp_*` kalıbı yönetici kaydetme uçlarını da kapsıyordu | 1K: 4 gövde türü ayrıştırıcı, yalnız nopriv uçlar, görünür eklenti hatası = KIRMIZI |
| F5 | GÖÇ: 10.3.1 → güncel 21 özelleştirilmiş görünüm ayarını eziyordu (canlıya gitseydi Hedef ayarları bozulurdu) | 2B+2C (10.34.3): kullanıcı değeri kazanır, 0 dahil; gerçek veri provası 700 korundu / 0 kayıp / idempotent; 25 ürün 464 meta korundu |
| F6 | Ikram: açık durumda "£ min: 5" (hata durumunda 5.00) — GBP 2 ondalık bozuk; kapat (×) form kenarına biniyor (10.34.2 güvenli alan) | 3A; Ikram accept bekletildi |
| F7 | Ikram: "Bağış Yap", "Tümü", form etiketleri İngilizce sitede Türkçe | Faz 5 |
| Not | staging30 snippet #27 sepete eklemeye bağlı (terk edilmiş sepet olayı); #29 ödeme tamamlanınca dış istek; #43 form gönderiminde API+e-posta. Testler sipariş/form göndermiyor | Raporlandı |
