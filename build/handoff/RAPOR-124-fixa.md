# RAPOR-124-fixa (dal v124-fixa; taban ikram-ortam b9de644 birleşik)

## Bulgu -> düzeltme
| Bulgu | Düzeltme | Test |
|---|---|---|
| Y1 | `FORM_OPTIONS` + `home`, `siteurl`, `permalink_structure`, `woocommerce_checkout_page_id` (değişince bump); `cache_key` bu dört seçeneği de içerir (liste ve kart parçası anahtarı değişir) | Review124FixesTest::cache_key_changes_when_... |
| O1 | Anahtar sürümsüz (`cache_version` değerin içinde `cv`); `Donations_List::is_current` uyuşmazsa yeniden üretir ve AYNI anahtara yazar; liste ve ürün parçası için birikim yok | many_bumps_keep_a_single_stored_row (50 bump -> 2 girdi), stored_value_is_stale_..., CardFormsTest güncellendi |
| D6 | `render_piece` HTML'den \x01/\x02 denetim karakterlerini temizler; kart formu atlanmaz (Türkçe karakter korunur). `Form_Pack::normalize` hâlâ ham belirteçli girdiyi reddeder (kayıpsızlık); boş sonuçta mevcut niyette tek GET yedeği zaten devrede | control_characters_are_stripped_... |
| O5 | `create`: `donation_email` skaler değilse 400 `donation_panel_invalid_email`; `input()` içinde `is_scalar` koruması (uyarı yok) | array_email_is_rejected_with_400 (failOnWarning açık) |
| D1 | Göç yalnız eklentinin kendi başka ürün meta'sını (`Uninstall::product_meta_keys()` ya da `_wdp_` öneki) taşıyan üründe `_enable_email` siler; başkasının meta'sı dokunulmaz (okuma zaten yok sayılıyor) | other_plugins_enable_email_meta_is_left_alone; entegrasyon testi güncellendi |
| D2 | `clean_settings`: oku -> hesapla -> yazmadan hemen önce yeniden oku; değiştiyse taze değerden yeniden hesapla (en çok 3 deneme) | concurrent_settings_save_is_merged_not_overwritten |
| D5 | `/nonce` kovası `rest_nonce`, limit 30 -> 120/dk (sabitler `NONCE_BUCKET`, `NONCE_LIMIT`). Not: kova adı zaten bağış kovalarından ayrıydı; asıl sorun düşük limitti. Kötüye kullanım koruması (aynı-köken, IP/belirteç sınırı, güvenilmez IP'de site tavanı) korunur | nonce_bucket_is_separate_and_wider...; CartControllerTest güncellendi |

## Alınan teknik kararlar
- O1 için "bump'ta sil" yerine sürümsüz anahtar: liste anahtarları nitelik karmasından türediği için numaralandırıp silmek güvensiz; üzerine yazma birikimi kökten önler.
- Uninstall: transient önekleri (`wdp_list_`, `wdp_cf_`) zaten kapsamlı; anahtar adları değişmedi. `_enable_email` kaldırmada hâlâ listede (Uninstall, "verileri sil" seçeneği açıkken tüm ürünlerde siler; aynı sınıf başka öneksiz anahtarlar için de böyle). Kapsam kararı bu görevin dışında: Kalan işler.
- Dışa açık sözleşme (kısa kod, kanca, meta anahtarları) değişmedi; yeni sabitler ve `cache_version/is_current` iç API.

## Kanıt
- PHPUnit: 897 test / 8675 doğrulama, 0 hata (2 atlama önceden var). `npm test` JS: 879 test, 878 geçti, 0 başarısız (1 atlama).
- `lint:php` 0 hata; `verify` (build, smoke, lint, knip, entegrasyon 60 test/737 doğrulama, plugin-check, güvenlik analizi YENİ 0) yeşil.
- e2e (yerel, port 9085, 3 cihaz): list 54 geçti/3 atlama; experiences-cart 23 geçti/4 atlama.
- e2e direct-pay: 30 geçti, 15 BAŞARISIZ. Hepsi aynı nedenle: "girişli, doğrudan" ve "alan -> bilgi satırı" testleri İngilizce `account email` bekliyor, sitede Türkçe çeviri geliyor ("Bağış makbuzunuz hesabınızın e-postasına gönderilecek"). `git checkout ikram-ortam -- src` ile TABANDA aynı test aynı biçimde başarısız (doğrulandı) -> bu görevden bağımsız, önceden var. Düzeltme (testi dilden bağımsız yapmak/çeviri) fixa kapsamı dışı; öneri: spec'te metin yerine veri özniteliği/ikili dil deseni.
- measure:plugin-perf çalıştırılmadı: ön yüze/bayta etki yok; değişiklik PHP önbellek anahtarı + REST girdisi (anahtar hesabı için 4 `get_option`, bunlar autoload).

## Ayar/rehber
Gerek yok: iç düzeltme (önbellek anahtarı, doğrulama, göç sağlamlaştırma); yönetici ayarı ve kullanıcıya görünen davranış değişmedi.

## Kalan işler
- direct-pay spec'inin dil bağımlılığı (yukarı).
- Uninstall'daki önek taşımayan genel meta adları (`_enable_email` dahil) için kapsam kararı.
- `languages/*` dokunulmadı (yeni çeviri dizgesi yok; `verify` .po'yu değiştirdi, geri alındı).
