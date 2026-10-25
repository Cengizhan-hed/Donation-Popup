# Tasarım kararları (7D)

## Neden bu düzen
| Karar | Gerekçe |
|---|---|
| **Tek form, üç kap; ≤ 639 px'te her şey alt panel** | Ziyaretçilerin %90+'ı mobil. Ortada popup küçük ekranda klavye ile kavga eder; alttan panel başparmak bölgesinde, sürükleyerek kapanır, sayfa bağlamını gösterir. Masaüstünde popup/yan panel kalır. Bakım: tek içerik, tek test. |
| **Sabit alt eylem çubuğu (toplam + ana düğme)** | Ana düğme kaydırmaya girmez, toplam hep görünür; güvenli alan ve klavye açıkken de görünür kalır. |
| **Tutar çipi + etki ifadesi** | "Ne alıyorum?" sorusunu çipin içinde yanıtlar; tutar rakamdan karşılığa dönüşür. İfade ürün ayarıdır, boş olabilir. "En çok tercih edilen" rozeti yalnız yöneticinin seçtiği çipte (sosyal baskı yok). |
| **Diğer tutar, çipin yanında değil altında genişler** | Tek dokunuşla açılır, sayısal klavye, büyük yazı, para birimi öneki. |
| **Adım çubuğu + "Adım 1/2" metni** | Ne kadar kaldığını bilmek terki azaltır; renk dışında metinle de verilir. |
| **Birincil renk temadan; düğme yazısı otomatik** | Genel ilke: temayı tanımayan eklenti. Kontrast, göreli renk ile hesaplanır; açık renkli temada beyaz-üstü-beyaz olmaz. |
| **Web yazısı yüklenmez** | Hız ve tema uyumu; başlıklarda tema başlık yazısı devralınır. |
| **Ücret karşılama kutusu kapalı, kenarlıklı satır olarak** | Güven (ön seçili bahşiş şikâyeti). Satır tamamı dokunma alanı. |
| **İthaf "Bir ithaf ekle" açılır bölümü** | Çoğu bağışçı kullanmaz; formu uzatmaz ama bulunur; veri bütünlüğü için alanlar sipariş kaydına eksiksiz gider (7E). |
| **Vergi indirimi tek soru + beyan kutusu** | Ikram ihtiyacı; "Hayır" tek dokunuş; "Evet" ise ad+adres. Metin yönetici ayarı (ülkeye özel değil). Yanıt hatırlanır notu. |
| **Teşekkür: sade kutlama, kişi bilgisi yok** | Halka+onay çizimi ve kısa konfeti; "ne olacak" üç adım iş modelimizi (sahada yapılır → video) anlatır; hesapta izleme çağrısı. Ekranda e-posta/ad yok (paylaşılan ekran/omuz üstü). |
| **Sosyal kanıt: yalnız toplu sayı** | K3 + KVKK/GDPR. Üç biçim: tek satır, sayaç şeridi, kayan bildirim; hepsi gerçek veri. |
| **Bağış listesi: ad + baş harf, yalnız izin verenler; diğerleri "Anonim destekçi"** | Kişi bilgisi sızdırmadan canlılık. Boş/yükleniyor/hata durumları tasarlandı. |
| **İlerleme: dört varyant** (standart, ara hedefli, kalın yüzdeli, ince kart içi) | Farklı yerleşimlere uyar; ara hedefler "kuyu 1/2/köy" gibi somut dönüm noktası, altın işaret. Hedefte düğme kapanmaz. |
| **Bağışçı hesabı: alt panel giriş/kayıt/sıfırlama** | Mobilde sayfadan çıkmadan; kayıtta misafir bağış bağlama bilgisi açıkça yazılır. Bağışlarım kartları: tür/durum rozetleri, makbuz, tekrar bağış (aynı form açılır), video hazırsa "Videoyu izle". Sosyal giriş yok (kapsam). |
| **Yönetici: 4 adımlı sihirbaz + 4 sekmeli sade ayar + canlı önizleme** | İlk adım "yapacağınız bir şey yok" — mağaza ayarları denetlenip onay işaretiyle gösterilir. Önerilen seçenek her yerde ilk ve açık. Her ayar altında tek cümle. Modüller anahtar: kapalıysa yüklenmez (hız). Sabit kaydet çubuğu. |
| **Koyu mod ve RTL baştan** | Belirteçler iki şemalı; mantıksal CSS; Arapça ekran kanıt. |

## Rakip araştırmasından alınan kalıplar (kendi sözlerimizle, hiçbir şey kopyalanmadı)
Tutar = somut karşılık (UNICEF/İHH türü karşılık kartı fikri) • tutar seçimi ilk görünür öğe, ek tık yok • aylık/tek seferlik anahtarı üstte (yalnız yetenek varsa) • tek soruluk vergi indirimi, yanıt hatırlanır • tek satır güven şeridi • ücret karşılama açık "hayır" yolu ile • URL ile tutar ön doldurma (`?amount=`) mimaride • teşekkür ekranında bağışçı geri bildirimi (video) beklentisi.

## Bilinçli alınmayanlar
- **Ön seçili bahşiş/ücret, bahşiş kaydırıcısı** (güven şikâyeti).
- **Canlı bağışçı akışı (isim+tutar)** — kişi bilgisi; yalnız toplu sayaç.
- **Geri sayım/yapay kıtlık, "X kişi şu an bakıyor"** — sahte aciliyet güveni zedeler.
- **Ödeme yöntemlerini panelde öne çekme** — Woo ödeme sayfası işi (kapsam).
- **Zekât hesaplayıcı** — Faz 7 sonrası aday (ARASTIRMA.md).
- **Akış içi SSS** — bilinçle kaldırılmıştı; yerine güven satırı.
- **Sosyal giriş, bağış sahibi profili, topluluk sayfaları** — kapsam dışı.
- **Rakip görsel/animasyon dili** — hiçbiri kopyalanmadı; görünüm tamamen kendi belirteçlerimizdir (kalın sistem yazısı, tek vurgu, yaylı geçişler).

## Varsayımlar / açık
Gerçek temalar kurulu değil: 4 tema CSS önayarıyla simüle (vitrinde belirtildi). Konfeti sade tutuldu; onay: yönetici kapatabilmeli (ayar önerisi 7E). Etki ifadesi metin uzunluğu: 2 satıra kadar tasarlandı.
