# WooCommerce Donation Modal Popup

WooCommerce bağış popup / sağ panel eklentisi.

## Gereksinimler

- WordPress 5.0+
- WooCommerce 3.0+
- PHP 7.4+

## Kurulum

1. Eklentiyi `wp-content/plugins/` altına yükleyin ve etkinleştirin.
2. WooCommerce ürünlerinde bağış ayarlarını yapın.
3. Shortcode: `[donation_button product_id="123"]`

## Geliştirme

```bash
npm run build
```

Asset bundle'ları `assets/css/build/` ve `assets/js/build/` altında üretilir.

## Klasör yapısı

- `includes/` — PHP sınıfları (`class-*.php`) ve `traits/`
- `includes/bootstrap/` — yükleme
- `includes/config/` — CSS/JS stack
- `assets/js/src/` — `core/`, `bootstrap/`, feature dosyaları (`form.js`, `modal.js`, …)
- `assets/css/src/` — `foundation/`, `forms/`, `components/`, `overrides/`
- `tools/` — bundle build scriptleri

## Dosyalama kuralları

- Yeni PHP sınıfı: `includes/class-*.php`
- Yeni trait: `includes/traits/trait-wdp-*.php`
- Yeni JS feature: `assets/js/src/{feature}.js` (gereksiz alt klasör açma)
- Yeni CSS: mevcut `foundation/forms/components/overrides` içinde tek dosya yaklaşımı
