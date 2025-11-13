# JavaScript Modül Yapısı

Bu klasör, WooCommerce Donation Modal Popup eklentisinin JavaScript kodlarını modüler yapıda organize eder.

## Modül Yapısı

```
src/
├── utils/      - Yardımcı fonksiyonlar (format, log, ajax, accessibility)
├── state/      - Global state yönetimi
├── modal/      - Modal işlemleri (open, close, reset)
├── form/       - Form işlemleri (setup, validate, submit)
├── shareholder/- Hissedar form yönetimi
├── product/    - Ürün bilgileri (fetch, apply)
├── cart/       - Sepet işlemleri (fetch, update, display)
├── alerts/     - Alert/popup sistemi
├── dom/        - DOM manipülasyonları (inline styles, observers)
└── init/       - Başlatma ve event listener'lar
```

## Build İşlemi

Modülleri birleştirmek için:
```bash
php build-js.php
```

Bu script, tüm modülleri sırayla birleştirip `assets/js/donation-modal.js` dosyasını oluşturur.

## Mevcut Durum

- ✅ Modül klasörleri hazır
- ✅ Utils, State, DOM modülleri oluşturuldu
- ⏳ Diğer modüller hazırlanıyor
- ⏳ Build script hazırlanıyor

## Not

Mevcut `donation-modal.js` dosyası çalışır durumda. Modüler yapıya geçiş için:
1. Tüm modüller oluşturulacak
2. Build script ile test edilecek
3. Çalışırsa mevcut dosya güncellenecek

