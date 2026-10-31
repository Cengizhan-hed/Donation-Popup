# RAPOR 124-email2 (dal v124-email2)

## Alınan teknik kararlar
- Madde 1 İPTAL (kullanıcı): Beklemede (on-hold) e-postasına teşekkür/not/kampanya satırı EKLENMEDİ. `Email_Thanks::EMAIL_IDS` aynen (işleniyor + tamamlandı). Ayar açıklaması ve Rehber 2. madde "yalnız ödemesi alınmış bağışlarda; Woo'nun Beklemede e-postasına dokunulmaz" diye güncellendi (TR/EN).
- Blok e-posta düzenleyicisi: bayrak `block_email_editor` (WC 11.2.1; seçenek `woocommerce_feature_block_email_editor_enabled` = yes; kaynak: Woo `Package.php`/`FeaturesController.php`). Yerel testte yalnız mu-plugin `pre_option` süzgeciyle açıldı (kalıcı değişiklik yok, geçici WP).
- Sonuç: bayrak AÇIKKEN mevcut kancalar (`woocommerce_email_before_order_table`, formatted_meta süzgeci) çalışıyor; ek kod gerekmedi. Fark yalnız: teşekkür `email-block-layout` içinde stilsiz düz `<p>` (klasikte Woo CSS satır içi stil verir). Testte sabitlendi, Rehber 6. madde eklendi.

## Kanıt
- phpunit Email: 27 test / 95 doğrulama yeşil (yeni: on-hold render çıktısı yok + EMAIL_IDS sabit); `npm run verify` yeşil (i18n, lint, plugin-check, güvenlik 0 yeni).
- Mailpit e2e (3 cihaz her biri): classic EN, blocks TR, blocks TR (2 koşu), classic EN + blok-editör, blocks TR + blok-editör, blocks EN on-hold + blok-editör, classic TR on-hold: hepsi 3/3 yeşil. On-hold: teşekkür yok, kampanya satırı yok, Woo "on-hold" metni ve kalem etiketleri bozulmamış.
- Not: iki koşuda başka ajanın 9066 portundaki WP'si ortak Mailpit'e "Order failed" e-postası düşürdü (kirlenme, tek seferlik); yeniden koşuda yeşil. Mailpit paylaşımı paralel ajanlarda sorun olabilir.

## Ayar/rehber
- Ayar `thanks.email` açıklaması güncellendi; Rehber → Bağışçı e-postaları 2. madde güncellendi, 6. madde (blok düzenleyici) eklendi. Çeviri: languages/parts/email2.po (Claude birleştirir: i18n:merge/mo/json).
- Test araçları: `run-mail.mjs --on-hold --block-email`, `wdp-mail-opts.php` (onHold, blockEmail).

## Kalan işler
- measure:plugin-perf koşulmadı (ön yüz değişmedi; yalnız admin metin + test dosyaları).
- Blok düzenleyicide yayımlanmış özel e-posta şablonu (kullanıcı düzenlemesi) senaryosu test edilmedi; varsayılan şablon doğrulandı.
