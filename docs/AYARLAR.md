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
- **Ne işe yarar:** İlerleme çubuğunun yüzde 100 sayılacağı kampanya hedefi.  
- **Tip:** Hedefli kampanya  
- **Formda:** İlerleme çubuğunun hedefi.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** 1) Tipi kampanya yapın. 2) Hedefi değiştirin. 3) Formda yüzdeyi yenileyin.

### En düşük tutar

- **Ekran adı:** En düşük tutar  
- **Ne işe yarar:** Bağışçının yazabileceği en düşük tutar; kampanyada ürün fiyatı daha düşükse o kullanılır.  
- **Tip:** Bağışçı belirler, Hedefli kampanya  
- **Formda:** Tutar alanı doğrulaması.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Min altında tutar yazıp sepete eklemeyi deneyin; hata görünmeli.

### En fazla hisse

- **Ekran adı:** En fazla hisse  
- **Ne işe yarar:** Tek seferde seçilebilecek en yüksek hisse adedi.  
- **Tip:** Hisseli  
- **Formda:** Hisse artırma üst limiti.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Limiti aşmayı deneyin; artmamalı.

### Toplanan

- **Ekran adı:** Toplanan  
- **Ne işe yarar:** Ödemesi alınmış siparişlerden hesaplanan toplam; yenile simgesi yeniden hesaplar.  
- **Tip:** Hedefli kampanya (yönetim özeti)  
- **Formda:** İlerleme çubuğunun doluluk oranı.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Yenile’ye basıp yüzdeyi kontrol edin.

### Kutlama animasyonu

- **Ekran adı:** Kutlama animasyonu  
- **Ne işe yarar:** Bağış eklendiğinde ilerleme çubuğunda kısa bir kutlama gösterir.  
- **Tip:** Hedefli kampanya  
- **Formda:** Sepete ekleme sonrası kısa animasyon.  
- **Genel ayar:** Progress sekmesindeki “Hedef dolunca kutlama” ayrı bir genel ayardır.  
- **Nasıl denenir:** Kampanya formunda sepete ekleyip animasyonu izleyin.

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
- **Tip:** Tümü  
- **Formda:** Bağışçı bilgilerinde e-posta satırı.  
- **Genel ayar:** Tasarım → E-posta alanı.  
- **Nasıl denenir:** Tasarım’da açık + üründe Genel → e-posta var; üründe Kapalı → yok.

### İthaf alanı

- **Ekran adı:** İthaf alanı  
- **Ne işe yarar:** Bağışın kimin adına yapıldığını yazmak için alan gösterir.  
- **Tip:** Tümü  
- **Formda:** İthaf metin kutusu.  
- **Genel ayar:** Tasarım → İthaf.  
- **Nasıl denenir:** Açıkken ithaf yazıp sepete ekleyin.

### İthaf örnek metni

- **Ekran adı:** İthaf örnek metni  
- **Ne işe yarar:** İthaf alanı boşken içinde görünen örnek metin.  
- **Tip:** Tümü  
- **Formda:** Alanın soluk örnek yazısı.  
- **Genel ayar (boşsa):** Tasarım → İthaf placeholder.  
- **Nasıl denenir:** Ürün metnini değiştirip formda görün.

### Anonim bağış

- **Ekran adı:** Anonim bağış  
- **Ne işe yarar:** Bağışçının adının gizli kalmasını seçebileceği kutucuk.  
- **Tip:** Tümü  
- **Formda:** “İsmim gizli kalsın” benzeri kutu.  
- **Genel ayar:** Tasarım → Anonim.  
- **Nasıl denenir:** Kutuyu işaretleyip sepete ekleyin.

### Ürün notu / Not metni

- **Ekran adı:** Ürün notu; Not metni  
- **Ne işe yarar:** Formun üstünde kısa bilgilendirme notu.  
- **Tip:** Tümü  
- **Formda:** Form başında not kartı.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Açıp metin girin → form başında görünmeli.

### Çok adımlı form

- **Ekran adı:** Çok adımlı form  
- **Ne işe yarar:** Formu bağışçı bilgisi ve tutar olarak adım adım gösterir.  
- **Tip:** Tümü  
- **Formda:** Adım adım geçiş.  
- **İlgili genel ayar:** Normal → Çok adımlı formu etkinleştir (ürün kapalı olsa bile genel açık olabilir).  
- **Nasıl denenir:** Üründe açın → adım adım arayüz.

### Alan ikonları

- **Ekran adı:** Alan ikonları  
- **Ne işe yarar:** Ad, telefon ve e-posta alanlarının başında ikon gösterir.  
- **Tip:** Tümü  
- **Formda:** Alan başı ikonları.  
- **İlgili genel ayar:** Tasarım → Alan ikonları; ürün Kapalı ise gizlenir.  
- **Nasıl denenir:** Kapatın → ikonlar kaybolmalı.

### Etki satırı / Etki metni

- **Ekran adı:** Etki satırı; Etki metni  
- **Ne işe yarar:** Başlığın altında bağışın etkisini anlatan kısa cümle.  
- **Tip:** Tümü (yönetim)  
- **Formda:** Başlık altı etki satırı.  
- **Genel ayar:** Yönetimde ayrı bir genel “etki metni” alanı yoktur; boş bırakılırsa satır çoğu zaman görünmez.  
- **Nasıl denenir:** Açıp metin girin; formu kontrol edin.

### Aciliyet şeridi / Aciliyet metni / Bitiş tarihi

- **Ekran adı:** Aciliyet şeridi; Aciliyet metni; Bitiş tarihi  
- **Ne işe yarar:** Kampanyanın süreli olduğunu vurgular; bitişten sonra şerit gizlenir.  
- **Tip:** Tümü (yönetim)  
- **Formda:** Üstte aciliyet şeridi.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Metin + yarın bitiş → şerit var; dünü yazın → şerit yok.

### Sosyal kanıt / Sosyal kanıt metni

- **Ekran adı:** Sosyal kanıt; Sosyal kanıt metni  
- **Ne işe yarar:** Kaç kişinin bağış yaptığını anlatan satır.  
- **Tip:** Tümü (yönetim)  
- **Formda:** Sosyal kanıt satırı.  
- **Genel ayar:** Yok  
- **Nasıl denenir:** Açıp metin girin.

### Güven rozetleri / Rozetler

- **Ekran adı:** Güven rozetleri; Rozetler  
- **Ne işe yarar:** Formun altında güvenli ödeme gibi kısa güven mesajları.  
- **Tip:** Tümü  
- **Formda:** Sepete ekle altı güven şeridi.  
- **Genel ayar (boş rozetler):** Tasarım → Güven rozetleri / Güven metni. Genel güven şeridi kapalıysa hiç görünmez.  
- **Nasıl denenir:** Ürün rozeti yazın → formda o metin.

### Blok sırası

- **Ekran adı:** Bu ürüne özel sıra kullan / blok sırası  
- **Ne işe yarar:** Başlık altı blokların sırası; kapalıysa Tasarım’daki genel sıra kullanılır.  
- **Tip:** Tümü  
- **Formda:** Medya, etki, aciliyet, sosyal kanıt, ilerleme sırası.  
- **Genel ayar:** Tasarım → Varsayılan modül sırası.  
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

### Düzen / Ürün görselini göster / Kategori rengini kullan

- **Ekran adı:** Düzen; Ürün görselini göster; Kategori rengini kullan  
- **Ne işe yarar:** Klasik / Kampanya / Hikâye yerleşimi; öne çıkan görsel; kategori renklerini kullanma.  
- **Tip:** Tümü  
- **Formda:** Yerleşim ve üst görsel; ana renk kategoriden.  
- **Genel ayar:** Kategori rengi → Kategoriler sekmesi.  
- **Nasıl denenir:** Hikâye düzeni + görsel açın; kategori rengi işaretleyin.

### Ana renk / hover / arka plan / köşe / yoğunluk

- **Ekran adı:** Ana renk; Ana renk (üzerine gelince); Arka plan rengi; Köşe yuvarlaklığı; Yoğunluk  
- **Ne işe yarar:** Bu ürüne özel renk, köşe ve boşluk. Boş bırakılanlar genel tasarımı izler.  
- **Tip:** Tümü  
- **Formda:** Düğme, panel ve alan stilleri.  
- **Genel ayar:** Tasarım (marka / yoğunluk) ve Normal (birincil renk, modal arka plan, UI radius).  
- **Nasıl denenir:** Hex renk girin; hover ve arka planı kontrol edin.

### Kısa kodlar

- **Ekran adı:** Kısa kod kutuları (ayar değil)  
- **Ne işe yarar:** Buton (ortada), sağ panel, sayfa içi form vb. kodları kopyalama.  
- **Nasıl denenir:** Kodu bir sayfaya yapıştırıp ön yüzü kontrol edin.

---

## Alt bağış bağlantıları (Gelişmiş)

10.28.4 güncellemesi, “Alt bağış ekle” kapalıyken dolu kalmış veya geçersiz `_sadaka_wc_product_id` değerlerini temizler. Sonuç:

1. **Ayarlar → Gelişmiş → Alt bağış bağlantıları** tablosunda ana ürün → alt bağış ürünü ve durum (geçerli / temizlendi + neden).  
2. Aynı özet `wdp_migration_log` seçeneğinde (sürüm 10.28.4 satırı) tutulur.

**10.28.5:** Alt bağış bağlantısı bir ürünün görünürlüğünü veya bağış ürünü olmasını etkilemez. Aynı ürün hem kendi sayfasında/listelerde bağış ürünü olabilir hem de başka bir ürünün alt bağışı olarak seçilebilir. Listede gizlemek isterseniz WooCommerce ürün ayarında **Katalog görünürlüğü: Gizli** kullanın. Ürünler tablosunda bilgi rozeti: “Alt bağış olarak kullanılıyor (N)” (üzerine gelince ana ürün adları).
