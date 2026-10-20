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
