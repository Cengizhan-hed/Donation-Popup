# RAPOR 124-email3 (dal v124-email3, taban ikram-ortam birleştirildi)

## Alınan teknik kararlar
- Teşekkür bölümü (`Email_Thanks::html`): e-posta uyumlu `<table role="presentation">` + tek hücre + `<p>` paragraflar; renk/boşluk/font SATIR İÇİ; `<style>`, `<link>`, `<img>`, sınıf yok. Renkler WooCommerce e-posta ayarlarından (`woocommerce_email_text_color`, `_base_color`, `_body_background_color`), `sanitize_hex_color` ile doğrulanır, geçersizse Woo varsayılanı; zemin = vurgu renginin %8 karışımı. Stil `wp_kses` kaçışlamasından SONRA eklenir (mesajdaki stil/olay öznitelikleri atılır). Düz metin sürümü değişmedi.
- Woo klasik şablonu satır içine alırken stili yeniden yazar (boşluklar, `bgcolor`/`align` eklenir); testler boşluk-duyarsız karşılaştırır.
- Özel blok şablonu: test WP'sinde mu-plugin ile `woo_email` yazısı (publish, `customer_processing_order`, kanonik içerik + işaret paragrafı; `WCTransactionalEmailPostsManager::save_email_template_post_id`). Sonuç: ek kod gerekmedi; teşekkür bölümü, etiketler, telefon gizleme özel şablonda da doğru (Woo içeriği `##WOO_CONTENT##` ile aynen yerleşir, kancalar çalışır).
- Yalıtım: her test benzersiz alıcı `donor.<koşu>.<test>.<cihaz>@wdp-e2e.test`; yönetici e-postaları koşuya özgü `admin.<koşu>@...` adresine yönlendirilir (mu-plugin `adminEmail`), içinde bağışçı adresi geçenler süzülür. Doğrulama `/api/v1/search?query=to:"..."`; silme yalnız arama (kendi adresi) ve kimlikle. `clearMailbox()` (tüm kutu) artık spec'te kullanılmıyor. Playwright çıktısı koşuya özgü `test-results/mail-<koşu>`; ortak `test-results` silinmez. Not: `ensureMailpit` kendi başlattığı Mailpit'i koşu bitince durdurur; paralel koşuda Mailpit'i önceden ayrı başlatın (kanıtta öyle yapıldı).

## Kanıt
- phpunit tümü: 877 test / 7674 doğrulama yeşil (Email: 27 test / 103); `npm run verify` yeşil (lint, i18n, plugin-check, güvenlik YENİ 0).
- Mail e2e (her biri 3 cihaz, 3/3 yeşil): classic EN; blocks TR; classic EN + blok-editör; blocks TR + blok-editör; classic EN + blok-editör + ÖZEL ŞABLON; blocks TR + blok-editör + ÖZEL ŞABLON; classic on-hold + blok-editör.
- Biçim eşitliği (masaüstü, 3 yapı: klasik / blok varsayılan şablon düzeni / blok özel şablon): bölüm HTML'i farkı yalnız satır sonu ve kampanya tutarı/dil metni; yapı, renk, boşluk aynı (`difflib`).
- Paralel iki koşu (port 9071 ve 9072, aynı Mailpit 8035): A 08:37:18-08:37:40, B 08:37:29-08:37:51 (~11 sn çakışma), her ikisi 3/3 yeşil; araya konan `noise@wdp-e2e.test` iletisi koşular sonunda duruyor; kutuda başka kalıntı yok.
- Bulgu: paylaşılan matris şablonuna eşzamanlı başlayan iki koşu `installCurrentPlugin` yarışına girer (ENOENT chmod). Çözüm: ikinci koşuyu şablon kurulumundan sonra başlat (12 sn ara yetti). Mail yalıtımıyla ilgisiz, mevcut matris altyapısı sınırı.
- Ekran görüntüsü (≤800 px): `build/handoff/RAPOR-124-email3/{cmp-classic,par-a,par-b}/mail-*-desktop-musteri.png` (yalnız masaüstü müşteri e-postaları saklandı). Bir tanesi incelendi: kutu sipariş tablosunun üstünde, vurgu şeridi + açık zemin, taşma yok.
- measure:plugin-perf koşulmadı: ön yüz/JS/CSS değişmedi (yalnız e-posta HTML'i, yönetici metni, test dosyaları).

## Ayar/rehber
- Ayar `thanks.email` açıklaması güncellendi (klasik/blok aynı görünüm, Woo e-posta renkleri). Rehber → Bağışçı e-postaları 6. madde yeniden yazıldı ("stilsiz" ifadesi kaldırıldı; özel yayımlanmış şablon dahil). Ayrı yeni ayar gerekmedi (renkler Woo ayarından geliyor; gerekçe: ikinci bir renk ayarı kapsam dışı).
- Çeviri: `languages/parts/email3.po` (2 dizge; Claude birleştirir: i18n:merge/mo/json). Önceki email2.po'daki iki eski msgid artık eskidi (email3 yenilerini içerir).

## Kalan işler
- `i18n:merge/mo/json` ve ana dala birleştirme (Claude).
- Woo blok e-posta düzenleyicisinin kendi renk/tema ayarları (global styles) okunmaz; yalnız klasik Woo e-posta renk seçenekleri kullanılır. Gerekirse kullanıcı kararı.
- `run-mail.mjs` hata durumunda yazılan e-postalar kutuda kalabilir (yalnız kendi adresi; sonraki koşu temizler).
