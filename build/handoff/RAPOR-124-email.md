# RAPOR 124-email (dal v124-email, worktree wt-124-email)

## Alınan teknik kararlar
1. **Dil:** WooCommerce mekanizması aynen kullanıldı: müşteri e-postaları `wc_switch_to_site_locale` ile SİTE diline geçer, yönetici e-postası geçerli dilde gider. Eklenti etiketleri `__()` ile e-posta anında üretilir (saklanan meta anahtarı değişmez). Karışık dilin asıl kaynağı eski (çevrilmiş etiketli) anahtarlardı ("Bağışçı Adı" anahtarı EN e-postada Türkçe kalıyordu): e-posta bağlamında bu anahtarlar sabit anahtara çevrilip e-posta anındaki dilin etiketiyle gösterilir.
2. **Bağlam:** `Email_Context` yalnız e-posta çizilirken dolu: `woocommerce_email_header` (e-posta nesnesi), `woocommerce_email_before_order_table` (`$sent_to_admin`, kesin), bitiş `after_order_table` / `footer` / `email_sent`. Düz metin şablonlarında header/footer kancası yok; bu yüzden sipariş tablosu kancaları esas alındı. Bilinmeyen alıcı = en kısıtlayıcı (müşteri). Bağlam dışında süzgeç hiçbir şey yapmaz (sızıntı testli).
3. **Süzgeç** `woocommerce_order_item_get_formatted_meta_data` (öncelik 20): teknik anahtarlar (`_*`, `donation_panel_*`, tanınmayan `wdp_*`) her e-postada gizli; müşteri e-postasında bağışçı + hissedar telefonu (sabit ve eski anahtar) gizli; bağış tipi/sıklığı, ad, not, ithaf, e-posta kalır. Yönetici e-postasında hepsi kalır. Sipariş verisi ve yönetici sipariş ekranı değişmez. Not: WooCommerce fatura bölümü telefonu müşteri e-postasında yine gösterir (kullanıcı kararı gereği); yalnız KALEM telefonu gizlenir.
4. **Teşekkür bölümü:** yalnız `customer_processing_order` ve `customer_completed_order` (karar metnindeki kapsam; on-hold/havale e-postasına eklenmez, istenirse `Email_Thanks::EMAIL_IDS`'e eklenir). Metin kaynağı teşekkür ekranıyla aynı: yeni `Thanks_Summary::message()` (şablon da bunu kullanır). Bağış satırı yoksa hiçbir şey basılmaz. Kampanya satırı: `Progress_Data::for_product` (e-posta anındaki değer) + `wc_price` (Woo para biçimi), kampanya modülü kapalıysa yok. Düz `<p>`; stili Woo e-posta CSS'i satır içine alır (`margin: 0 0 16px`, gövde paragraflarıyla aynı). Metin `wp_kses` (a, strong, b, em, i, br) + `wpautop`; düz metin sürümü etiketleri ayıklar, `&` bozulmaz. Teşekkür ekranı modülünden bağımsız çalışır.
5. **Ayar:** `thanks.email` (bool, varsayılan AÇIK), Sepet ve Ödeme → Teşekkür ekranı bölümü; bölüm ve `thanks.message` açıklamaları e-postayı da anlatacak şekilde güncellendi.
6. Kanca kaydı `Order_Hooks::init` → `Email_Hooks::init()` (yalnız `add_action/add_filter`; sınıflar ilk e-postada yüklenir; ön yüzde çıktı/istek/sorgu yok).
7. Ek madde: `Uninstall::transient_prefixes()` içine `wdp_cf_` eklendi (birim testli).
8. Yerel e2e'de çevrimdışı ödeme (cheque) siparişi test mu-plugin'inde `woocommerce_*_process_payment_order_status` ile "işleniyor" yapıldı (müşteriye "işleniyor" e-postası için); eklenti koduna girmez.

## Kanıt (sayılarla)
- Birim: `phpunit` 876 test / 7664 assertion yeşil (yeni `tests/unit/Email/EmailTest.php`: 14 test, 35 assertion: müşteri/yönetici süzgeci, eski anahtar etiketi TR+EN, bağlam sızıntısı, teşekkür ayarı/varsayılan/boş sipariş, kampanya satırı HTML+düz, düz metin, yönetici/başka e-posta atlanır, kanca kaydı, `wdp_cf_`). JS testleri 854 geçti / 0 kalan (bir başarısızlık `scripts/lib/plugin-settings.mjs` izin listesinde `thanks.email` eksik olmasındandı; eklendi).
- `npm run verify` çıkış 0 (build, smoke, i18n, lint, package, integration, plugin-check, güvenlik taraması: YENİ 0). (verify, birleştirilmiş çeviri dosyalarıyla koşuldu; bu dosyalar worktree'de geri alındı, Claude birleştirecek.)
- Mailpit e2e (yerel, ayrı Mailpit portu 1035/8035, port 9067): classic EN (desktop) geçti; blocks TR (desktop) geçti; classic EN `--no-thanks` geçti; classic TR 3 cihaz (iphone/android/desktop) 3/3; blocks EN 3 cihaz 3/3. Denetimler: teknik meta yok (`wdp_*`, `donation_panel_`, `_custom_price`); müşteri e-postasında telefon kalem etiketi yok, yönetici e-postasında etiket + değer var (yönetici e-postasında telefon sayısı müşteridekinden fazla); etiketler dilinde, diğer dilin etiketi yok; teşekkür metni (Türkçe karakterli) yalnız müşteri e-postasında, sipariş tablosundan önce, HTML+düz metin; ayar kapalıyken yok; kampanya satırı (hedef 5.000, EN "raised of" / TR "hedefin") var; yatay taşma yok (≤800 px).
- Ekran görüntüleri + metin sürümleri: `build/handoff/RAPOR-124-email/mail-<classic|blocks>-<iphone|android|desktop>-<musteri|yonetici>.png/.txt` (15 dosya; görsel modele gösterilmedi).
- Dil denemesi notu: yerel kalıptaki `wdp-i18n-locale` mu-plugin'i `determine_locale`'i tr_TR'ye kilitler = "yönetici dili"; site dili `--locale` ile verilir. EN site + TR yönetici: müşteri e-postası İngilizce, yönetici e-postası Türkçe etiketli (Woo mekanizması beklenen davranışı).
- Hız: arayüzsüz sayfada eklenti çıktısı/istek/sorgu eklenmedi (yalnız kanca kaydı + küçük `Email_Hooks` dosyası); `measure:plugin-perf` bellek darlığından KOŞULMADI (Claude koşsun).

## Ayar/rehber güncellemesi
- Ayar: Bağış Paneli → Sepet ve Ödeme → Teşekkür ekranı → "Bağışçı e-postalarında teşekkür" (varsayılan açık) + açıklama; `Settings` şemasına `thanks.email`; `scripts/lib/plugin-settings.mjs` izin listesine eklendi.
- Rehber: yeni bölüm "Bağışçı e-postaları" (`email`, 5 adım, "Teşekkür ayarlarını aç" bağlantısı).
- Çeviri: `languages/parts/email.po` (13 dizge; Claude `i18n:pot/merge/mo/json` yapsın).

## Birleştirme notları (Claude)
- `i18n:pot`, `i18n:merge`, `i18n:mo`, `i18n:json` çalıştırılmalı (yeni dizgeler: parça dosyası). Merge sonrası `npm run verify:i18n` yeşil.
- Dokunulan ortak/başka alan dosyaları (küçük, ekleme): `src/Core/class-settings.php` (+`thanks.email`), `src/Core/class-uninstall.php` (+`wdp_cf_`), `src/Modules/Thanks/class-thanks-summary.php` (+`message()`), `templates/donation-panel/thanks/summary.php` (varsayılan metin tek kaynağa), `src/WooCommerce/class-order-hooks.php` (+1 satır), `scripts/lib/plugin-settings.mjs`, `tests/bootstrap-unit.php` (+`wpautop` taklidi). `class-plugin.php`, package.json, docs'a dokunulmadı.
- docs/HOOKS.md: yeni dışa açık kanca yok; yalnız WooCommerce kancalarına bağlanıldı.

## Kalan işler
- On-hold (havale) e-postasına teşekkür eklenip eklenmeyeceği iş kararı (şimdi yalnız İşleniyor/Tamamlandı).
- `measure:plugin-perf` (yerel + iki uzak) ve gerçek-site e-posta incelemesi Claude'da.
- Woo yeni e-posta düzenleyicisi (blok tabanlı e-posta şablonları) açık sitelerde `before_order_table` kancası farklı çalışabilir; kapalıyken (varsayılan) doğrulandı.
