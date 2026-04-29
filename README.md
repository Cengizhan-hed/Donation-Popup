# WooCommerce Donation Modal Popup

**Evrensel Tema Uyumluluğu ile WooCommerce Bağış Sistemi**

## 🎯 Özellikler

### ✨ Ana Özellikler
- **Modal Popup Bağış Sistemi**: Modern ve kullanıcı dostu arayüz
- **Özel Fiyatlandırma**: Kullanıcılar istedikleri miktarı girebilir
- **Çoklu Hisse Sistemi**: Bir ürün için birden fazla hisse satın alma
- **Responsive Tasarım**: Tüm cihazlarda mükemmel görünüm
- **Evrensel Tema Uyumluluğu**: Tüm WordPress temalarında çalışır

### 🛠 Teknik Özellikler
- **AJAX Desteği**: Sayfa yenilenmeden işlemler
- **Güvenlik**: Nonce doğrulaması ve form validasyonu
- **Önbellek Uyumluluğu**: Tüm önbellek sistemleriyle uyumlu
- **SEO Dostu**: Arama motorları için optimize edilmiş
- **Performans**: Hızlı yükleme ve optimize edilmiş kod

## 📋 Gereksinimler

- WordPress 5.0 veya üzeri
- WooCommerce 3.0 veya üzeri
- PHP 7.4 veya üzeri

## 🚀 Kurulum

1. **Plugin'i Yükleyin**
   - WordPress admin panelinde "Eklentiler > Yeni Ekle" bölümüne gidin
   - Plugin dosyalarını yükleyin ve etkinleştirin

2. **WooCommerce Kontrolü**
   - WooCommerce eklentisinin yüklü ve aktif olduğundan emin olun

3. **İlk Kurulum**
   - Plugin etkinleştirildikten sonra otomatik olarak kurulum tamamlanır

## ⚙️ Yapılandırma

### Admin Paneli Ayarları

1. **WooCommerce > Bağış Popup Ayarları** menüsüne gidin
2. Her ürün için aşağıdaki ayarları yapabilirsiniz:
   - **Özel Fiyat**: Kullanıcıların özel miktar girmesine izin ver
   - **Minimum Fiyat**: Minimum bağış miktarı belirle
   - **Çoklu Hisse**: Birden fazla hisse satın alma özelliği
   - **Maksimum Hisse**: Maksimum hisse sayısı

### Shortcode Kullanımı

#### Bağış Butonu
```php
[wdp_donation_button id="123" text="Bağış Yap" class="custom-class" style="background: red;"]
```

#### Doğrudan Form
```php
[wdp_donation_form id="123" button_text="Bağış Yap" title="Özel Başlık" show_title="yes" class="custom-class"]
```

### Shortcode Parametreleri

| Parametre | Açıklama | Varsayılan |
|-----------|----------|------------|
| `id` | Ürün ID'si | 0 |
| `text` | Buton metni | "Bağış Yap" |
| `button_text` | Form buton metni | "Bağış Yap" |
| `title` | Form başlığı | Ürün adı |
| `show_title` | Başlığı göster/gizle | "yes" |
| `class` | Özel CSS sınıfı | "" |
| `style` | Özel CSS stili | "" |

## 🎨 Tema Uyumluluğu

### Desteklenen Temalar
- ✅ **Avada/Fusion**
- ✅ **Divi/Extra**
- ✅ **Elementor**
- ✅ **Astra**
- ✅ **GeneratePress**
- ✅ **OceanWP**
- ✅ **Storefront**
- ✅ **Twenty Twenty Serisi**
- ✅ **Tüm WooCommerce Temaları**

### Otomatik Uyumluluk
Plugin otomatik olarak tema tespiti yapar ve gerekli uyumluluk dosyalarını yükler.

## 🔧 Gelişmiş Kullanım

### PHP Fonksiyonları

```php
// Bağış butonu render et
echo wdp_render_donation_button($product_id, $button_text);

// Bağış formu render et
echo wdp_render_donation_form($product_id, $args);
```

### JavaScript API

```javascript
// Modal aç
openModal(productId);

// Modal kapat
closeModal(modalElement);

// Ürün bilgilerini al
fetchProductInfo(productId);
```

## 🛡️ Güvenlik

### Güvenlik Özellikleri
- **Nonce Doğrulaması**: AJAX isteklerinde güvenlik
- **Form Validasyonu**: Sunucu tarafında doğrulama
- **XSS Koruması**: Çıktı temizleme
- **SQL Injection Koruması**: Hazırlanmış sorgular
- **CSRF Koruması**: Cross-site request forgery koruması

### Güvenlik Kontrolleri
- Ürün varlığı kontrolü
- Satın alınabilirlik kontrolü
- Stok durumu kontrolü
- Minimum fiyat kontrolü
- Maksimum hisse kontrolü

## 📱 Responsive Tasarım

### Mobil Uyumluluk
- Touch-friendly butonlar
- Mobil optimize edilmiş formlar
- Responsive modal boyutları
- Mobil tarayıcı uyumluluğu

### Breakpoint'ler
- **Desktop**: 1200px+
- **Tablet**: 768px - 1199px
- **Mobile**: 320px - 767px

## 🔄 Önbellek Uyumluluğu

### Desteklenen Önbellek Sistemleri
- ✅ **W3 Total Cache**
- ✅ **WP Super Cache**
- ✅ **WP Rocket**
- ✅ **SG Optimizer**
- ✅ **WP Engine**
- ✅ **Cloudflare**
- ✅ **Tüm CDN'ler**

### Otomatik Önbellek Temizleme
Plugin, güncellemelerden sonra otomatik olarak önbellekleri temizler.

## 🐛 Sorun Giderme

### Yaygın Sorunlar

#### Modal Açılmıyor
1. JavaScript hatalarını kontrol edin (F12)
2. jQuery yüklü olduğundan emin olun
3. Tema uyumluluğunu kontrol edin

#### CSS Çakışması
1. Tema CSS'ini kontrol edin
2. Z-index değerlerini kontrol edin
3. Önbellekleri temizleyin

#### AJAX Hataları
1. Nonce değerlerini kontrol edin
2. WooCommerce aktif olduğundan emin olun
3. PHP hata loglarını kontrol edin

### Debug Modu
```php
// wp-config.php dosyasına ekleyin
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

## 📊 Performans

### Optimizasyonlar
- Lazy loading
- CSS/JS minification
- Önbellek sistemi
- Optimize edilmiş AJAX
- Gereksiz kod temizleme

### Performans İpuçları
1. Önbellek eklentisi kullanın
2. CDN kullanın
3. Görsel optimizasyonu yapın
4. Gereksiz eklentileri kaldırın

### Frontend CSS Build (Hash'li Tek Dosya)
- Üretim (production) için önerilen yöntem tek hash'li CSS bundle kullanmaktır.
- Komut:
```bash
php tools/build-css-bundle.php
```
- Komut şu dosyaları üretir:
  - `assets/css/build/donation-modal.<hash>.css`
  - `assets/css/build/manifest.json`
- Eklenti bu manifest dosyasını otomatik algılar ve varsa tek bundle dosyayı enqueue eder.
- Manifest yoksa otomatik olarak katmanlı `assets/css/src/*` fallback yükleme çalışır.

### Dağıtım ZIP Paketleme (Release)
- Üretim kurulumu için ZIP paketini script ile oluşturun:
```bash
npm run pack
```
- Script çıktısı: `build/woo-donation-popup.zip`
- Paketleme dışlama kuralları tek kaynaktan `.distignore` dosyasından okunur.
- Böylece geliştirme dosyaları (ör. `.git`, `node_modules`, lock dosyaları, local env) yanlışlıkla release paketine girmez.

## 🔄 Güncellemeler

### Versiyon 10.0
- ✅ Evrensel tema uyumluluğu
- ✅ Gelişmiş güvenlik kontrolleri
- ✅ Performans optimizasyonları
- ✅ Yeni tema desteği
- ✅ CSS çakışma düzeltmeleri

### Gelecek Güncellemeler
- [ ] Daha fazla tema desteği
- [ ] Gelişmiş raporlama
- [ ] Çoklu dil desteği
- [ ] API entegrasyonları

## 📞 Destek

### Destek Kanalları
- **Dokümantasyon**: Bu README dosyası
- **Hata Raporları**: GitHub Issues
- **Özellik İstekleri**: GitHub Discussions

### Katkıda Bulunma
1. Fork yapın
2. Feature branch oluşturun
3. Değişikliklerinizi commit edin
4. Pull request gönderin

## 📄 Lisans

Bu plugin GPL v2 veya üzeri lisansı altında dağıtılmaktadır.

## 🙏 Teşekkürler

- WordPress topluluğu
- WooCommerce ekibi
- Tema geliştiricileri

---

**WooCommerce Donation Modal Popup** - Tüm WordPress sitelerinde mükemmel çalışan bağış sistemi. # Donation-Popup

## 🧱 Tasarım Sistemi
- Tüm bileşenler `.wdp-scope` alanında normalize edilir; eklenti stilleri temadan izole çalışır.
- Temel tasarım token'ları (`--wdp-primary`, `--wdp-button-primary`, `--wdp-radius-*`, `--wdp-space-*`) ile renk/spacing tutarlılığı sağlanır.
- Popup ve gömülü formlar aynı markup'ı paylaşır; `wdp-modal-content` genişliği masaüstü/mobilde otomatik adapte olur.
- Form gridleri (`wdp-price-quantity-row`, `wdp-button-group`, `wdp-shareholder-form`) hem masaüstü hem mobilde aynı layout prensipleriyle çalışır.

## ✅ Hızlı QA Kontrol Listesi
1. Popup ve gömülü formu masaüstü/mobilde açın; hisseli / özel fiyatlı / sabit ürünleri tek tek kontrol edin.
2. Sayaçları (+/−) deneyin, minimum fiyat uyarısını tetikleyin; alert görseli ve `aria-live` duyurusunun çıktığını doğrulayın.
3. Modalı overlay'e tıklayarak, ESC ile ve kapat butonuyla kapatıp arka planın yeniden etkileşimli olduğunu teyit edin.
4. Başarılı ekleme sonrasında “Yeni Bağış Ekle” butonuyla form reset’inin ve success ekranının render edildiğini kontrol edin.
5. Farklı tema / sayfa şablonlarında formları yerleştirip overflow, taşma, font veya buton hizası sapması olup olmadığına bakın.
