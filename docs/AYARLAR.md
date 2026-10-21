# Bağış ayarları rehberi

Bu rehber, ekranda gördüğünüz ayarların ne işe yaradığını ve nasıl deneneceğini anlatır. Teknik terim kullanmadan, gerçek ekran etiketlerine göre yazılmıştır.

Bağış tipleri (ürün Bağış sekmesinde seçilir):

| Tip | Ne anlama gelir |
|-----|-----------------|
| Sabit tutar | Tutar ürün fiyatıdır; isteğe bağlı adet seçilir. |
| Bağışçı belirler | Bağışçı tutarı yazar (isteğe bağlı hızlı tutar düğmeleri). |
| Hisseli | Birden fazla hissedar ve hisse adedi. |
| Hedefli kampanya | İlerleme çubuğu ve hedef tutar; alt bağış formda gösterilmez. |

---

## Ayarlar sayfası sekmeleri (özet)

| Sekme | Ne işe yarar |
|-------|----------------|
| Ürünler | Tüm ürünlerin bağış tipi, kısa kodu ve (kampanyada) toplanan tutarı. Ayrıntılı ayar için “Bağış ayarları” ile ürünün Bağış sekmesine gidin. |
| Ürün sayfası ve liste | Hangi ürünlerin bağış sayılacağı, mağaza/ürün sayfasında “Bağış Yap”, formun popup / panel / sayfa içi görünümü. |
| Tasarım | Marka rengi, stil paketleri, e-posta / ithaf / anonim alanları, güven rozetleri, blok sırası. |
| Modal | Popup, sağ panel ve sayfa içi formun ölçüleri ve iç boşlukları. |
| Normal | Form ve buton renkleri, hızlı tutar düğmeleri, çok adımlı form. |
| Hisseli | Hisseli forma özel metin ve renkler. |
| Progress | İlerleme çubuğu renkleri ve hedef dolunca kutlama. |
| Başarı | Sepete ekleme sonrası teşekkür ekranı, mini sepet, varsayılan alt bağış ürünü. |
| Meta Pixel | Meta (Facebook) ölçüm olayları. |
| Kategoriler | Kategori başlık / vurgu renkleri (ürün “Kategori rengini kullan” ile). |
| Gelişmiş | Eklenti kaldırılınca veri silme; alt bağış bağlantıları denetim tablosu. |

---

## Ürün düzenleme → Bağış sekmesi

Aşağıdaki her alan için: ekran adı, ne işe yarar, hangi tipte görünür / anlamlıdır, formda nerede görünür, “Genel ayar” seçilirse hangi genel ayarı izler, nasıl denenir.

### Bağış ürünü

- **Ekran adı:** Bağış ürünü  
- **Ne işe yarar:** Bağış ürünlerinde klasik “Sepete ekle” yerine bağış formu kullanılır; ürün bağış listelerinde görünür.  
- **Tip:** Tümü  
- **Formda:** Ürün bağış ise form / “Bağış Yap”; isteğe bağlı “Normal ürün” ile klasik sepete ekle kalır.  
- **Genel ayar:** Ürün sayfası ve liste → Kapsam (tüm basit ürünler / kategoriler / yalnızca işaretli).  
- **Nasıl denenir:** 1) Kapsamı “yalnızca işaretli” yapın. 2) Üründe Genel / Bağış / Normal seçin. 3) Mağaza ve ürün sayfasında butonu kontrol edin.

### Otomatik yerleşim

- **Ekran adı:** Otomatik yerleşim  
- **Ne işe yarar:** Kapalıysa formu yalnızca kısa kod, blok veya widget ile siz eklersiniz.  
- **Tip:** Tümü  
- **Formda:** Açıkken ürün sayfasında form otomatik gelir (tema destekliyorsa).  
- **Genel ayar:** Ürün sayfası ve liste → WooCommerce sayfalarında “Sepete Ekle” yerine “Bağış Yap”.  
- **Nasıl denenir:** 1) Genel ayarı açık bırakın. 2) Üründe Kapalı seçin. 3) Ürün sayfasında otomatik form olmamalı; kısa kodla form gelmeli.

### Bağış tipi

- **Ekran adı:** Bağış tipi (Sabit tutar / Bağışçı belirler / Hisseli / Hedefli kampanya)  
- **Ne işe yarar:** Formun nasıl çalışacağını seçer; altta yalnızca seçili tipin alanları görünür.  
- **Tip:** Seçici kendisi  
- **Formda:** Sabitte adet, bağışçı belirlerde tutar alanı, hisselide hissedar kartları, kampanyada ilerleme çubuğu.  
- **Genel ayar:** Yok (ürüne özel).  
- **Nasıl denenir:** Her tipi seçip formu açın; alanların tipi yansıttığını kontrol edin.

### Hedef tutar

- **Ekran adı:** Hedef tutar  
- **Ne işe yarar:** İlerleme çubuğunun yüzde 100 sayılacağı kampanya hedefi (mağaza ana para biriminde). Boş/≤0 veya üst sınır (1.000.000.000) aşımı kaydı durdurur; sessizce 100000’e çekilmez. Binlik ayırıcılı giriş (`100.000`) kabul edilir.  
- **Tip:** Hedefli kampanya  
- **Formda:** İlerleme çubuğunun hedefi.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** 1) Tipi kampanya yapın. 2) Hedefi değiştirin. 3) Formda yüzdeyi yenileyin.

### Hedefe ulaşınca

- **Ekran adı:** Hedefe ulaşınca; Hedefe ulaşınca mesaj  
- **Ne işe yarar:** `continue` (mesaj yok, bağış devam), `message` (teşekkür mesajı + bağış devam; varsayılan), `close` (yeni bağış kapalı + mesaj; sunucu reddeder). Meta boş = message. Mesaj bağış tutarından önce görünür.  
- **Tip:** Hedefli kampanya  
- **Formda:** `.wdp-goal-reached-notice`; close iken tutar/Sepete Ekle pasif.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Toplananı hedefe çekip üç seçeneği deneyin.

### En düşük tutar

- **Ekran adı:** En düşük tutar  
- **Ne işe yarar:** Bağışçının yazabileceği en düşük tutar. Hedefli kampanyada formda ürün fiyatı ile bu tutarın küçüğü kullanılır; ürün fiyatı yok/0 ise yalnız bu alan.  
- **Tip:** Bağışçı belirler, Hedefli kampanya  
- **Formda:** Tutar alanı doğrulaması.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Min altında tutar yazıp sepete eklemeyi deneyin; hata görünmeli.

### En fazla hisse

- **Ekran adı:** En fazla hisse  
- **Ne işe yarar:** Tek seferde seçilebilecek en yüksek hisse adedi (en fazla 50; admin ve sunucu aynı sınır).  
- **Tip:** Hisseli  
- **Formda:** Hisse artırma üst limiti.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Limiti aşmayı deneyin; artmamalı.

### Toplanan

- **Ekran adı:** Toplanan  
- **Ne işe yarar:** Yalnız processing/completed siparişlerden; işlem ücreti hariç; tutarlar mağaza ana para birimine (sipariş kuru / Curcy) çevrilir. on-hold sayılmaz. Yenile simgesi tam yeniden hesaplar. Dönüşülemeyen siparişler uyarıda sayılır.  
- **Tip:** Hedefli kampanya (yönetim özeti)  
- **Formda:** İlerleme çubuğu dolgusu ve “toplandı” tutarı (yüzde onaylı toplamdan; hedef aşımında çubuk %100, tutar gerçek).  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Yenile’ye basıp yüzdeyi kontrol edin.

### Kutlama animasyonu

- **Ekran adı:** Kutlama animasyonu  
- **Ne işe yarar:** Hedefe ulaşıldığında (onaylı toplam geçiş anında) kısa kutlama gösterir; sayfa açılışında zaten %100 ise kutlama yok.  
- **Tip:** Hedefli kampanya  
- **Formda:** İlerleme çubuğu kutlaması.  
- **Genel ayar:** Progress sekmesindeki “Hedef dolunca kutlama” ayrı bir genel ayardır.  
- **Nasıl denenir:** Hedefin altında açıp onaylı toplamı geçirin.

### Hızlı tutar düğmeleri

- **Ekran adı:** Hızlı tutar düğmeleri (genel ayarda "Hızlı tutar düğmelerini göster")  
- **Ne işe yarar:** Tutar kutusunun üstünde 100 ₺ / 250 ₺ gibi tek tıkla seçilen düğmeler.  
- **Tip:** Yalnız "Bağışçı belirler" ve "Hedefli kampanya" (yönetimde diğer tiplerde gizli; formda gelmez)  
- **Formda:** Tutar alanının üstündeki düğmeler. En düşük tutarın altındakiler gizlenir; hepsi gizlenirse bölüm tamamen kalkar.  
- **Genel ayar (gösterim):** Normal → Hızlı tutar düğmelerini göster. Üründe kapalıysa gizlenir; genel kapalıysa ürün açık olsa da düğmeler gelmez.  
- **Nasıl denenir:** Normal'de düğmeleri açın, üründe kapatın → düğme yok; ikisini açın → düğme var.

### Tutarlar (hızlı tutar düğmeleri listesi)

- **Ekran adı:** Tutarlar (genel ayarda "Hızlı tutar düğmeleri")  
- **Ne işe yarar:** Yalnız tam sayılar; virgül, boşluk veya noktalı virgülle ayırın (en fazla 6, genel ayarda da). "1.000", "1,5", "5o0" gibi değerler geçersizdir: kayıt durur ve hatalı değer hata mesajında gösterilir. Ürün alanı boşsa genel ayardaki tutarlar kullanılır.  
- **Tip:** Yukarıdaki gibi  
- **Formda:** Hızlı tutar düğmeleri. Hiçbir tutar kendiliğinden seçili gelmez.  
- **Genel ayar:** Normal → Hızlı tutar düğmeleri.  
- **Nasıl denenir:** Ürüne `50, 100` yazın; formda yalnızca bunlar görünsün. `1.000` yazın; kayıt hata vermeli.

### Önerilen tutar

- **Ekran adı:** Önerilen tutar  
- **Ne işe yarar:** Üründe doluysa ve o tutar o an görünen hızlı tutar düğmeleri arasındaysa yalnız o düğmede "Önerilen" etiketi gösterir. Boş bırakılırsa hiçbir tutarda etiket yok. Listede olmayan / tam sayı olmayan değer kaydı durdurur. Etiketli tutar kendiliğinden seçilmez.  
- **Tip:** Yalnız "Bağışçı belirler" ve "Hedefli kampanya" (hisseli/sabitte admin alanı gizli)  
- **Genel ayar:** Yok (10.29.1’de Normal sekmesinden kaldırıldı; eski genel değer yok sayılır / migration siler).  
- **Nasıl denenir:** Alanı boş bırakın → etiket yok; `250` yazın → yalnız 250 ₺ düğmesinde etiket; `777` yazın → kayıt hata.

### Adet seçici

- **Ekran adı:** Adet seçici  
- **Ne işe yarar:** Sabit tutarlı formda adet artırma/azaltma düğmelerini gösterir. Kapalıysa (ve sabit olmayan tiplerde) sunucu adedi her zaman 1 yapar.  
- **Tip:** Yalnız sabit tutar (yönetimde diğer tiplerde gizli)  
- **Formda:** Adet +/-.  
- **Genel ayar:** Yok (ürüne özel; boş bırakılırsa açıktır).  
- **Nasıl denenir:** Sabit tipte kapatın → adet gizlenmeli.

### İşlem ücretini karşıla / İşlem ücreti (%)

- **Ekran adı:** İşlem ücretini karşıla; İşlem ücreti (%)  
- **Ne işe yarar:** Bağışçıya ödeme işlem maliyetini üstlenme seçeneği sunar; tutara eklenecek yüzde. 0 = kapalı, aksi halde 0,5–15; aralık dışı değer kaydedilmez (hata gösterilir). Yüzde her zaman üründen okunur, istemciden gelen değer yok sayılır.  
- **Tip:** Tüm tipler (özel, kampanya, sabit, hisseli)  
- **Formda:** "İşlem ücretini karşıla" kutusu; işaretlenince "Toplam" satırı güncellenir. Sepet satırında ve sipariş notunda "İşlem ücreti +%X" ayrıca görünür.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Açıp yüzde girin; kutuyu işaretleyip toplamın arttığını görün.

### E-posta alanı

- **Ekran adı:** E-posta alanı  
- **Ne işe yarar:** Bağışçıdan e-posta ister.  
- **Tip:** Sabit / Bağışçı belirler / Hedefli kampanya (hisselide yok).  
- **Formda:** Bağışçı bilgilerinde e-posta satırı (`maxlength=100`). Boş serbest; dolu ama geçersizse gönderim durur (görünür hata). Kapalıysa sunucu POST’taki değeri yok sayar. Sepet satırında görünür.  
- **Genel ayar:** Tasarım → E-posta alanı.  
- **Nasıl denenir:** Tasarım’da açık + üründe Genel → e-posta var; üründe Kapalı → yok; geçersiz adres → hata.

### İthaf alanı

- **Ekran adı:** İthaf alanı  
- **Ne işe yarar:** Bağışın kimin adına yapıldığını yazmak için alan gösterir.  
- **Tip:** Sabit / Bağışçı belirler / Hedefli kampanya (hisselide yok).  
- **Formda:** İthaf metin kutusu (120 karakter). Kapalıysa sunucu yok sayar. Sepet satırında görünür.  
- **Genel ayar:** Tasarım → İthaf alanı.  
- **Nasıl denenir:** Açıkken ithaf yazıp sepete ekleyin.

### İthaf örnek metni

- **Ekran adı:** İthaf örnek metni  
- **Ne işe yarar:** İthaf alanı boşken içinde görünen örnek metin.  
- **Tip:** Sabit / Bağışçı belirler / Hedefli kampanya  
- **Formda:** Alanın soluk örnek yazısı (kayıt sınırı 120).  
- **Genel ayar (boşsa):** Tasarım → İthaf örnek metni.  
- **Nasıl denenir:** Ürün metnini değiştirip formda görün.

### Anonim bağış

- **Ekran adı:** Anonim bağış  
- **Ne işe yarar:** İşaretlenirse bağışçı adı herkese açık listelerde gizlenir; sipariş kayıtlarında görünür.  
- **Tip:** Sabit / Bağışçı belirler / Hedefli kampanya (hisselide yok).  
- **Formda:** “İsmim gizli kalsın” kutusu. Sepette “İsmim gizli kalsın: Evet” satırı. Mini sepet herkese açık alt kümede tam ad maskelenir.  
- **Genel ayar:** Tasarım → Anonim bağış.  
- **Nasıl denenir:** Kutuyu işaretleyip sepete ekleyin; herkese açık yanıtta tam ad olmamalı.

### Ürün notu / Not metni

- **Ekran adı:** Ürün notu; Not metni  
- **Ne işe yarar:** Bağışçının yazdığı not değildir; formun üstünde gösterilen bilgi metnidir.  
- **Tip:** Tümü  
- **Formda:** Form başında not kartı. Kayıt sınırı 400 (mevcut uzun metin okunurken kırpılmaz).  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Açıp metin girin → form başında görünmeli.

### Çok adımlı form

- **Ekran adı:** Çok adımlı form  
- **Ne işe yarar:** Formu bağışçı bilgisi ve tutar olarak adım adım gösterir.  
- **Tip:** Tümü  
- **Formda:** Adım adım geçiş; ithaf/anonim bloğu Bilgiler adımında.  
- **Ürün:** Genel ayarı kullan / Açık / Kapalı (`_enable_wizard`).  
- **İlgili genel ayar:** Normal → Çok adımlı form.  
- **Nasıl denenir:** Üründe Açık → adım adım; Kapalı → tek ekran (genel açık olsa bile).

### Alan ikonları

- **Ekran adı:** Alan ikonları  
- **Ne işe yarar:** Ad, not ve e-posta satırlarındaki ikonlar.  
- **Tip:** Tümü  
- **Formda:** Alan başı ikonları; ürün boşken genel ayar.  
- **Ürün:** Genel ayarı kullan / Açık / Kapalı.  
- **İlgili genel ayar:** Tasarım → Alan ikonları.  
- **Nasıl denenir:** Kapalı → `wdp-no-field-icons`, ikonlar kaybolmalı.

### Aydınlatma metni bağlantısı

- **Ekran adı:** Aydınlatma metni bağlantısını göster  
- **Ne işe yarar:** Formda kişisel veri aydınlatma bağlantısı gösterir (varsayılan kapalı). Aydınlatma metni sitenizdeki KVKK/Gizlilik sayfasında olmalıdır; burada yalnız kısa bağlantı gösterilir. Varsayılan etiket: “Kişisel verilerin işlenmesine ilişkin aydınlatma metni” (ayardan değişir).  
- **Tip:** E-posta, ithaf veya hissedar alanlarından en az biri varken  
- **Formda:** Yalnız bağlantı (yeni sekme, `rel=noopener`). Adres boşsa WordPress Gizlilik Politikası sayfası; o da yoksa bağlantı gösterilmez + yönetici uyarısı.  
- **Genel ayar:** Tasarım → Aydınlatma metni bağlantısı.  
- **Nasıl denenir:** Açıp e-posta alanını açın → formda kısa bağlantı görünmeli.

### Etki satırı / Etki metni

- **Ekran adı:** Etki satırı; Etki metni  
- **Ne işe yarar:** Başlığın altında bağışın etkisini anlatan kısa cümle. Boş bırakılırsa satır görünmez.  
- **Tip:** Tümü (yönetim)  
- **Formda:** Başlık altı etki satırı.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Açıp metin girin; formu kontrol edin.

### Aciliyet şeridi / Aciliyet metni / Bitiş tarihi

- **Ekran adı:** Aciliyet şeridi; Aciliyet metni; Bitiş tarihi  
- **Ne işe yarar:** Kampanyanın süreli olduğunu vurgular. Bitiş (Y-m-d) site saat diliminde gün sonuna (23:59:59) kadar şeridi gösterir; yalnız şeridi kaldırır (kampanyayı kapatmaz).  
- **Tip:** Tümü (yönetim)  
- **Formda:** Üstte aciliyet şeridi (`data-ends-at` + JS yedek).  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Metin + yarın bitiş → şerit var; dünü yazın → şerit yok.

### Sosyal kanıt / Sosyal kanıt metni

- **Ekran adı:** Sosyal kanıt; Sosyal kanıt metni  
- **Ne işe yarar:** Gerçek bağışçı sayısı; metinde `{donors}` yer tutucusu. Sayı 0 ise satır gizli. Varsayılan: “{donors} kişi bağış yaptı”.  
- **Tip:** Tümü (yönetim)  
- **Formda:** Sosyal kanıt satırı.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Açıp `{donors}` içeren metin girin.

### Güven rozetleri / Rozetler

- **Ekran adı:** Güven rozetleri; Rozetler  
- **Ne işe yarar:** Formun altında güven mesajları. Genel ayar kapalıysa ürün açık olsa da gösterilmez. Ürün listesi doluysa genel listenin yerine geçer.  
- **Tip:** Tümü  
- **Formda:** Sepete ekle altı güven şeridi.  
- **Genel ayar (boş rozetler):** Tasarım → Güven rozetleri / Güven metni.  
- **Nasıl denenir:** Ürün rozeti yazın → formda o metin.

### Blok sırası

- **Ekran adı:** Bu ürüne özel sıra kullan / blok sırası  
- **Ne işe yarar:** Başlık altı 5 bloğun sırası (media, impact, urgency, social_proof, progress); kapalıysa Tasarım’daki genel sıra.  
- **Tip:** Tümü  
- **Formda:** Medya, etki, aciliyet, sosyal kanıt, ilerleme sırası.  
- **Genel ayar:** Tasarım → Varsayılan modül sırası (yalnız bu 5 kimlik).  
- **Nasıl denenir:** Özel sıra açıp yukarı/aşağı taşıyın; formu kontrol edin.

### Alt bağış ekle

- **Ekran adı:** Alt bağış ekle  
- **Ne işe yarar:** Ana bağışa ek olarak küçük bir bağış (sadaka) ekleme.  
- **Tip:** Formda hedefli kampanya dışında (kampanyada ayarlar saklanır ama formda gösterilmez).  
- **Formda:** “Alt Bağış Ekle” düğmesi ve satır.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Sabit veya bağışçı belirler tipinde açın; formu kontrol edin.

### Düğme metni (alt bağış)

- **Ekran adı:** Düğme metni  
- **Ne işe yarar:** Alt bağışı açan düğmenin metni.  
- **Tip:** Alt bağış açıkken  
- **Formda:** Toggle düğmesi.  
- **Genel ayar (boşsa):** Başarı → Alt Bağış Toggle Metni.  
- **Nasıl denenir:** Boş bırakın → Başarı sekmesindeki metin; doldurun → ürün metni.

### Alt bağış ürünü

- **Ekran adı:** Alt bağış ürünü  
- **Ne işe yarar:** Sepete eklenecek ikinci WooCommerce ürünü. Yalnızca basit, yayımlanmış veya özel ürün seçilmeli; ürünün kendisi seçilemez.  
- **Tip:** Alt bağış açıkken  
- **Formda:** Sepette ikinci satır.  
- **Genel ayar (boşsa):** Başarı → Varsayılan alt bağış ürünü.  
- **Nasıl denenir:** 1) Ürün seçin veya boş bırakıp genel varsayılanı kullanın. 2) Alt bağışı açıp sepete ekleyin. 3) Sepette iki satır olmalı. Geçersiz seçim kaydedilmez; alan altında hata görünür.

### En düşük tutar / Sabit tutar (alt bağış)

- **Ekran adı:** En düşük tutar; Sabit tutar  
- **Ne işe yarar:** Özel tutarda alt sınır; sabit tutar doluysa o kullanılır.  
- **Tip:** Alt bağış açıkken  
- **Formda:** Alt bağış tutar alanı veya sabit satır.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Sabit tutar girip sepete ekleyin; veya min altında tutarı deneyin.

### Alt bağış notu

- **Ekran adı:** Alt bağış notu  
- **Ne işe yarar:** Alt bağış satırının yanında görünen açıklama.  
- **Tip:** Alt bağış açıkken  
- **Formda:** Satır yanı metin.  
- **Genel ayar:** Yönetimde ayrı genel alan yok; boşsa eklenti varsayılan metni kullanılır.  
- **Nasıl denenir:** Metni değiştirip formda görün.

### Düzen / Ürün görselini göster

- **Ekran adı:** Düzen; Ürün görselini göster  
- **Ne işe yarar:** Klasik / Kampanya / Hikâye yerleşimi; öne çıkan görsel. **Boş = Klasik; genel düzen ayarı yoktur.** Görsel açıkken ürünün öne çıkan görseli yoksa yönetici uyarısı.  
- **Tip:** Tümü  
- **Formda:** Yerleşim ve üst görsel (`wdp_campaign_media_url` filtresi URL’yi değiştirebilir). Liste kartları ürün temasını kullanmaz.  
- **Genel ayar:** Yok (düzen ürün başına).  
- **Nasıl denenir:** Hikâye düzeni + görsel açın.

### Ana renk / hover / arka plan / köşe

- **Ekran adı:** Ana renk; Ana renk (üzerine gelince); Arka plan rengi; Köşe yuvarlaklığı (px)  
- **Ne işe yarar:** Bu ürüne özel renk ve köşe. Ana renk boşsa kategori rengi, o da yoksa genel marka rengi. Hover boşsa ana renkten türetilir. Köşe 4–32 px (boş/0 = genel). Yoğunluk ürün ekranından gizlendi (meta silinmez).  
- **Tip:** Tümü  
- **Formda:** Kabuk CSS değişkenleri (türev palet, `--wdp-on-primary`, panel/sheet köşe oranı).  
- **Genel ayar:** Tasarım (marka) ve Normal (modal arka plan, UI radius); Kategoriler → kategori renkleri.  
- **Nasıl denenir:** Hex girin (`#` isteğe bağlı); açık renkte düğme yazısının koyu olduğunu kontrol edin.

### Kısa kodlar

Ürün sekmesinde ve Ürünler tablosunda üç kod kopyalanır: buton, panel, form (hepsi `id="…"` ile). Gutenberg blokları ve Elementor widget’ları aynı render fonksiyonlarını kullanır.

**Kapsam atlama:** `id`, `slug` veya `sku` ile ürün açıkça verilirse bağış kapsamı kontrolü uygulanmaz (ürün kapsam dışında da çalışır). Kimlik verilmezse (mevcut ürün sayfası) kapsam dışındaki ürün boş döner; uyarı yalnız `edit_products` yetkilisine görünür.

**`style`:** `[wdp_donation_button]` ve panel için kaldırıldı; verilirse yok sayılır (eski içerik bozulmaz).

#### `[wdp_donation_button]` — ortada pencere

Blok: Gutenberg **Bağış formu** (`wdp/donation-form`, görünüm = popup). Elementor: **Bağış Formu** (görünüm = ortada pencere).

| Öznitelik | Varsayılan | Sınır | Açıklama |
|-----------|------------|-------|----------|
| `id` | (yok) | pozitif tam sayı | WooCommerce ürün ID. |
| `slug` | (yok) | slug | Ürün kısa adı. |
| `sku` | (yok) | metin | Stok kodu. |
| `text` / `button_text` | genel “Bağış Yap” | düz metin | Popup buton yazısı (`text` yoksa `button_text`). |
| `class` | (yok) | boşlukla ayrılmış sınıflar; her parça `sanitize_html_class` | Ek CSS sınıfı. |
| `style` | — | yok sayılır | Eski içerik uyumu. |

#### `[wdp_donation_button_panel]` — sağ panel

Blok/widget: aynı form bloğu, görünüm = panel. Öznitelikler buton ile aynı.

#### `[wdp_donation_form]` — sayfa içi form

Blok: görünüm = sayfa içi form. Elementor: görünüm = sayfa içi form. Stoksuz veya satın alınamaz üründe form basılmaz (yetkiliye uyarı). `text` / `button_text` yok sayılır (Sepete Ekle / Ödemeye Git genel ayardan gelir); blok ve widget inline iken alanı gizler.

| Öznitelik | Varsayılan | Sınır | Açıklama |
|-----------|------------|-------|----------|
| `id` / `slug` / `sku` | (yok) | aynı | Ürün seçimi; kapsam atlama notu yukarıda. |
| `show_title` | `yes` | `yes` / `no` | Ürün başlığı. |
| `title` | (ürün adı) | metin | Başlık metni. |
| `class` | (yok) | çoklu sınıf, parça parça temizlenir | Ek CSS sınıfı. |
| `text` / `button_text` | — | yok sayılır | Yalnız popup/panelde kullanılır. |

#### `[wdp_donations]` — bağış listesi

Blok: **Bağış listesi** (`wdp/donations`). Elementor: **Bağış Listesi** (`columns_tablet` / `columns_mobile` ve `image_size` kısa koda geçer). 1 gün HTML önbelleği; `orderby=random` önbelleği atlar. Admin boş-liste notu ve sekme `id` önbelleğe girmez.

| Öznitelik | Varsayılan | Sınır | Açıklama |
|-----------|------------|-------|----------|
| `categories` | (tümü) | slug CSV | Kategori süzgeci. |
| `exclude_categories` | (yok) | slug CSV | Hariç kategoriler. |
| `ids` | (yok) | ID CSV | Yalnız bu ürünler. |
| `exclude` | (yok) | ID CSV | Hariç ürünler. |
| `type` | (tümü) | `fixed,custom,shares,campaign` | Çok tipte liste `limit`’e kadar doldurulur. |
| `limit` | `48` | 1–100 | Ürün sayısı. |
| `orderby` | `menu_order` | `menu_order` / `date` / `title` / `popularity` / `random` | Sıra; `random` önbellek yok. |
| `order` | `ASC` | `ASC` / `DESC` | Yön. |
| `tabs` | `yes` | `yes` / `no` | Kategori sekmeleri (ARIA tab/tabpanel). |
| `tab_all` | `yes` | `yes` / `no` | “Tümü” sekmesi. |
| `tab_all_label` | `Tümü` | metin | Tümü etiketi. |
| `columns` | `3` | 1–6 | Masaüstü sütun. |
| `columns_tablet` | `2` | 1–6 | Tablet sütun. |
| `columns_mobile` | `1` | 1–6 | Mobil sütun. |
| `gap` | `24` | 0–64 px | Kart boşluğu. |
| `image_ratio` | `4:3` | `1:1` `4:3` `3:2` `16:9` `original` | Görsel oranı. |
| `align` | `center` | `center` / `left` | Hiza. |
| `button` | `panel` | `panel` / `popup` / `link` | Kart butonu. |
| `button_full` | `yes` | `yes` / `no` | Buton tam genişlik. |
| `button_text` | (genel) | metin | Kart buton yazısı. |
| `show_image` | `yes` | `yes` / `no` | Görsel. |
| `show_excerpt` | `no` | `yes` / `no` | Özet. |
| `show_progress` | `yes` | `yes` / `no` | İlerleme. |
| `show_price` | `yes` | `yes` / `no` | Fiyat. |
| `show_category` | `no` | `yes` / `no` | Kategori. |
| `excerpt_words` | `18` | 0–60 | Özet kelime. |
| `image_size` | `woocommerce_thumbnail` | WP görsel boyutu | Kart görseli. |
| `heading_tag` | `h3` | `h2` `h3` `h4` | Kart başlığı. |
| `class` | (yok) | çoklu sınıf | Ek CSS sınıfı. |

**Nasıl denenir:** Ürün sekmesinden kodu kopyalayıp bir sayfaya yapıştırın; ön yüzde buton/panel/form ve liste sekmelerini kontrol edin.

---

## Alt bağış (Gelişmiş tablosu kaldırıldı)

10.28.4 bir kerelik `_sadaka_wc_product_id` temizliği `wdp_migration_log` ve (silinmeyen) `wdp_sadaka_links_audit` seçeneğinde durur. 10.33.0’dan itibaren Gelişmiş sekmesinde denetim tablosu yoktur.

**10.28.5:** Alt bağış bağlantısı bir ürünün görünürlüğünü veya bağış ürünü olmasını etkilemez. Aynı ürün hem kendi sayfasında/listelerde bağış ürünü olabilir hem de başka bir ürünün alt bağışı olarak seçilebilir. Listede gizlemek isterseniz WooCommerce ürün ayarında **Katalog görünürlüğü: Gizli** kullanın. Ürünler tablosunda bilgi rozeti: “Alt bağış olarak kullanılıyor (N)” (üzerine gelince ana ürün adları).
