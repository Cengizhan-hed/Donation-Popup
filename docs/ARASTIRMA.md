# ARAŞTIRMA ÖZETİ (Faz 7B) — bağış deneyimi ve rakipler

Kaynak: `research/notes-wp-plugins.md`, `notes-platforms.md`, `notes-charities.md` (yerel, git/paket dışı). Yöntem: yalnız herkese açık sayfaların metni; forma veri yazılmadı, hiçbir şey indirilmedi, kod/görsel/metin kopyalanmadı, her bulgu kendi sözlerimizle. **Sınır:** araç düz metin okuyucuydu — canlı akışların görsel ayrıntıları, adım sayıları, teşekkür ekranları ve ilerleme çubuklarının görünümü doğrulanamadı; bu başlıklar "yaygın kalıp" düzeyindedir ve Faz 7D prototiplerinde kendi tasarımımızla çözülür. Erişilemeyen siteler (Islamic Relief 403, Deniz Feneri sertifika hatası, Penny Appeal alan adı, LaunchGood/GoFundMe/Classy/Stripe Payment Links) düşük güvenle işaretlendi.

## 1. Özellik matrisi (özet)
| Alan | WP eklentileri (Give, Charitable, Seamless, Woo bağış eklentileri) | Barındırılan platformlar (Donorbox, Fundraise Up, Givebutter, Zeffy, Every.org, JustGiving) | Büyük kuruluşlar (UNICEF, MSF, charity: water, Kızılay, İHH, Muslim Hands) |
|---|---|---|---|
| Tutar seçimi | ön ayarlı tutarlar; Charitable'da tutar başına kısa açıklama + URL ile ön doldurma | ön ayarlı + serbest; aylıkta daha küçük önerilen tutarlar (Donorbox) | somut karşılık kartları (UNICEF, İHH: adet × birim + sepet) |
| Düzenli bağış | ücretli ek/duvar (Give) | tek sefer→aylık geçiş teklifi (Fundraise Up), "yalnız aylık" mod (Donorbox) | üstte aylık/tek seferlik anahtarı, aylık önde (UNICEF, MSF); şartlar açık yazılmalı (Penny Appeal düzenleyici bulgusu) |
| Ödeme | kendi sipariş sistemi (Give) ya da Woo ham akışı | ödeme yöntemlerini ilk adıma çekip en olası olanı önceden seçme (Every.org, kendi raporu +%29,5 dönüşüm) | hızlı ödeme kuruluşa göre değişir |
| Ücret/bahşiş | – | ön seçili bahşiş şikâyet doğuruyor (Givebutter); kaydırıcı + açık "0" yolu + iade (JustGiving) iyi kalıp | – |
| Vergi indirimi | Gift Aid (Seamless, ücretli eklentiler) | tek soru: "İngiltere vergi mükellefi misin?"; yanıt hatırlanır, son adımda değiştirilebilir, ad/adres yalnız "evet" ise (JustGiving) | Kızılay: bağış sorgula + sertifika |
| Güven | sınırlı | bağımsız rozetler, akış içi kısa SSS (Every.org, 4 soru) | dolaylı gider oranı beyanı (Kızılay %9), "%100 modeli" (charity: water), bağımsız rozetler |
| Dini bağışlar | – | – | zekât hesaplayıcı yaygın; fitre/fidye/keffaret sabit tutarlı kartlar + "zekâta uygun" etiketi (Penny Appeal); Ramazan son on gece otomatik bağış fikri |
| Bağışçı hesabı | Give bağışçı paneli (bizim Bağışçı Hesabı ile örtüşür) | giriş/panel | – |
| Sosyal kanıt / ilerleme | canlı bağışçı akışı ücretli duvar | son bağışçılar, hedef çubuğu yaygın | kampanya kartı ikinci adım (ek tık) |
| Yaygın şikâyetler | ücret duvarı, bakımsızlık, çakışma, yanlış yüzde/sayı biçimi | ön seçili bahşiş | ana sayfada tutar seçimi yok (ek tık) |

## 2. Bizim için en değerli kalıplar (fikir; global ilke ve WooCommerce standartlarıyla)
1. **Tutar = somut karşılık.** Her tutar çipinin altında kısa etki ifadesi ("£40 = 1 gıda kolisi"); ürün ayarı, çevrilebilir, boş olabilir. URL ile tutar/dönem ön doldurma (`?amount=40`).
2. **Varsayılan akıllı, adım az.** Tutar → bilgiler → ödeme; ana bağış sayfasında tutar seçimi ilk görünür öğe (ek tık yok). Mobilde alttan panel.
3. **Aylık/tek seferlik anahtarı** yalnız abonelik yeteneği varsa (aşağıdaki karar) üstte, şartlar net.
4. **Ücret karşılama** yalnız standart Woo ücret satırıyla; açık "0/hayır" yolu, ön seçili değil (güven).
5. **Vergi indirimi beyanı** tek soru + yöneticinin yazdığı beyan; evet ise ad/adres, sipariş metası.
6. **Güven şeridi** tek satır (güvenli ödeme, makbuz) + isteğe bağlı kısa SSS (akış içi). Kuruluşun kendi beyanları (oran, sertifika) yönetici metni olarak.
7. **Dini bağış türleri:** hisse (var), zekât hesaplayıcı (Faz 7 sonrası aday), fitre/fidye/keffaret hazır tutar kartları + "zekâta uygun" etiketi (ürün etiketi/ayarı).
8. **Bağışçı geri bildirimi** (video/rapor) bizim iş akışımıza özgü: teşekkür ekranında "bağışınızın raporu e-postayla/hesabınızda" ifadesi, hesapta Bağışlarım'da durum.
9. **Sosyal kanıt = yalnız gerçek veri ve kişi bilgisi yok** ("3 kişi bağış yaptı", toplam, son 24 saat); isteğe bağlı modül (K3).

## 3. Kararlar (vizyona göre; kapsam kuralı: yalnız iyi bağış almak için gerekli)
| Konu | Karar | Gerekçe |
|---|---|---|
| **Düzenli (aylık) bağış** | Çekirdekte kendi abonelik/yinelenen ödeme kodu YAZILMAZ. Çekirdek yalnız `donation_panel_frequency_options` filtresi + sipariş meta sözleşmesi sunar; abonelik, WooCommerce'in standart abonelik ürün yeteneğiyle (ürün sağlayıcıdan gelir) çalışır, yetenek yoksa "aylık" seçeneği hiç görünmez. Eklenti adı/ürün tipi tespiti yok: seçenek yalnız filtre ile eklenir. | Standart Woo'da yinelenen ödeme yok (ücretli eklenti gerekir); global ilke eklentiyi tanımaz; güvenlik ve PCI yükü alınmaz. |
| **Vergi indirimi beyanı** | Genel, ayar tabanlı modül, **varsayılan kapalı**: onay kutusu, yöneticinin yazdığı beyan metni, "evet" ise zorunlu tam ad + adres, hepsi sipariş meta (HPOS uyumlu); ülke/adlandırma sabit değil (Gift Aid yalnız örnek ön ayar metni). Dışa gönderim yok (HMRC dahil). | Ikram için değerli; WP/Woo zaten sipariş/dışa aktarma yapar; veri bütünlüğü kuralı. |
| **Bahşiş/ücret** | Mevcut "işlem ücretini karşıla" korunur, ön seçili olmaz, açık hayır yolu. | Güven. |
| **Ödeme yöntemi öne çekme** | Eklenti karışmaz (Woo ödeme sayfası/ağ geçidi işi). | Kapsam. |
| **Zekât hesaplayıcı** | Faz 7 kapsamı dışı aday (Faz 7 sonrası listede). | Kapsam; önce çekirdek akış. |
| **Canlı bağışçı akışı** | Sosyal kanıt modülü içinde yalnız toplu sayaç; kişi bilgisi yok. | KVKK/GDPR. |
| **Akış içi SSS** | Önceki "form içi SSS" kaldırılmıştı; yerine tek satır güven + isteğe bağlı bilgi bağlantısı. | Basitlik. |

## 4. Açık doğrulamalar (Faz 7D'de canlı gözlemle ya da kendi test kullanıcılarımızla)
- Rakiplerin mobil adım sayıları ve alttan panel davranışları (görsel gözlem yapılmadı).
- Teşekkür ekranı kalıpları ve kutlama animasyonları (kendi tasarımımızı prototipte doğrularız).
