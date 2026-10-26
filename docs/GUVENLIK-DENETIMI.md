# Güvenlik denetimi (Faz 8, E8E)

Kapsam: `src/`, `includes/`, `templates/`, `blocks/`, `assets/js`. Yöntem: WPCS Security/DB sniff'leri (WordPress-Extra) + elle okuma. E8D'nin alanı (`src/Privacy`, `wdp_render_modal` nonce'u, `wdp_vid` çerezi) bu denetimde yalnız gözlemlendi.
Risk: Y yüksek, O orta, D düşük. Durum: Düzeltildi (test var), Kabul (gerekçeli), Liste (sonra).

| Uç / yer | Bulgu | Risk | Durum |
|---|---|---|---|
| REST `form/{id}`, `form/validate`, `cart/add` (varsayılan sağlayıcılar) | Taslak/özel/parolalı/gizli ürün kimliğiyle form modeli (başlık, görsel, ön ayarlar) okunabiliyor, taslak ürün sepete eklenebilirdi (eski AJAX yolu `validate_product_id` ile kapalıydı, yeni REST yolunda yoktu) | O | Düzeltildi: `Rest_Controller::is_hidden_product()`; testler `E8ESecurityTest` |
| REST `progress/{id}`, `impact/{id}`, `donations`, `stats` | Aynı ürün görünürlük açığı (kampanya toplamı, bağış akışı) | O | Düzeltildi (404), test var |
| REST `account/reset`, `account/register` | IP başına sınır var, ama dağıtık IP ile tek e-postaya yağdırma (e-posta bombası) mümkündü | O | Düzeltildi: hedef (e-posta) başına 3 / 15 dk; aşımda yanıt değişmez (numaralandırma yok), e-posta gitmez; test var |
| Tüm `register_rest_route` (10 rota) | `permission_callback` hepsinde var; `__return_true` yok. Herkese açık olanlar salt okunur ya da nonce + sınırlı | - | Temiz; sözleşme testi `test_no_route_uses_return_true...` |
| REST yazan uçlar (`account/*`, `form/validate`) | Nonce zorunlu: yoksa 403; üye uçları `is_user_logged_in`; sınır aşımı 429 | - | Temiz; testler var |
| REST `cart/add` | Nonce yok; CSRF'e karşı `Content-Type: application/json` zorunlu (çapraz kökenli JSON ön uçuş ister; 415) + IP sınırı 20/dk. Etkisi yalnız ziyaretçinin kendi sepeti | D | Kabul (gerekçeli); test: 415 |
| REST `nonce`, `account/session` | Çerezden kullanıcı çözüp taze nonce verir; WordPress `rest-nonce` ile aynı yaklaşım, yanıt `no-store`, çapraz kökenli okunamaz | D | Kabul |
| admin-ajax yönetici işleyicileri (13) | Hepsi `check_ajax_referer('wdp_admin_nonce')` + `manage_woocommerce`; hiçbirinde `nopriv` yok | - | Temiz; kaynak taraması testi |
| admin-ajax ön yüz işleyicileri (8) | `run_secured_ajax`: nonce + POST + kaynak (Origin/Referer/Sec-Fetch) + yetki + hız sınırı; salt okunur olanlar ziyaretçi çerezi + IP katmanı | - | Temiz |
| `wp_ajax_*_render_modal` | Bilinçli nonce yok (sayfa önbelleği bayat nonce); koruma: origin + sınır; salt okunur, yalnız görünür ürün | D | E8D alanı; bu denetimde değişmedi (nonce kararı E8D) |
| `admin_post` kurulum sihirbazı | `current_user_can` + `check_admin_referer` + `wp_safe_redirect` | - | Temiz |
| Toplu eylemler (ürün listesi) | Yetki + `check_admin_referer('bulk-wdp_products')` + `wp_safe_redirect`; Woo toplu eylemi yetki denetler | - | Temiz |
| Giriş temizleme | `sanitize_text/textarea/phone`, `absint`, `wp_unslash`, Unicode güvenli kısaltma; tutar `sanitize_numeric` | - | Temiz |
| Çıktı kaçışlama (PHP) | WPCS `EscapeOutput` 145 bulgu: 100+ yönetici etiketi (`__()` doğrudan echo, çevirmen güvenilir), ikon/SVG yardımcıları, önceden kaçışlanmış öznitelik dizgileri, istisna iletileri. Bağışçı verisi taşıyan yerde kaçışsız çıktı bulunmadı | D | Liste: sistematik `esc_html__`/`wp_kses` dönüşümü Faz 8 sonrası toplu işi (araçla); sıfırlama konusu yeni kodda zaten sıfır |
| Çıktı kaçışlama (JS) | `innerHTML` yalnız sabit ikon/SVG, sunucunun ürettiği modal HTML'i ve `<textarea>` ile HTML-çözme; bağışçı/sunucu metni `textContent` ile | - | Temiz |
| `$wpdb` | Tüm sorgular `prepare`; `uninstall` ve göçlerde `esc_like`; tek sniff bulgusu şablonlu `IN (%s...)` (yer tutucular üretiliyor) | D | Kabul |
| Yeniden yönlendirme | Yalnız `wp_safe_redirect`; `wp_redirect` yok | - | Temiz |
| Dosya yükleme / yol | `$_FILES` yok; şablon bulucu yol dizisi (`..`, mutlak, `:`) reddeder; `include` yalnız bulucudan | - | Temiz |
| SSRF / `wp_remote_*` | Kodda yok | - | Temiz |
| Serileştirme / `eval` / `exec` | Yok (`unserialize` kullanılmıyor; stil paketi içe aktarma JSON + sınır) | - | Temiz |
| Hız sınırı | REST: `Rate_Limiter` (transient, IP karması); eski AJAX: eylem + ziyaretçi belirteci + IP; yeni: hedef başına sınır. Ters vekil arkasında IP: `wdp_trust_proxy_headers` süzgeci | D | Kabul; belge notu |
| Hesap girişi `wp_signon` | IP başına 10/dk; hesap bazlı kilit bilerek yok (hesap kilitleme DoS verir; WordPress çekirdeği de yapmaz) | D | Kabul |
| Şifre sıfırlama zamanlaması | Var olan hesapta e-posta üretimi daha uzun sürer (ölçülebilir zaman farkı) | D | Liste (asenkron gönderim Faz 9) |
| Bağımlılıklar | `npm audit --omit=dev`: 0 açık. `composer.lock`: üretim paketi 0 (yalnız geliştirme paketleri); `composer audit` çalıştırılacak araç bu makinede yok, üretim bağımlılığı olmadığından etkisiz | - | Temiz |

## Eklenen testler (`tests/unit/E8/E8ESecurityTest.php`, 14 test)
Gizli ürün tespiti (taslak/özel/bekleyen/gizli; yönetici hariç; yok ürün), varsayılan sağlayıcılar, progress/impact/donations/stats 404, e-posta başına sınır (6 farklı IP, 3 gönderim, aynı yanıt), IP sınırı 429, nonce'suz yazan uç 403 + üye ucu girişsiz, `cart/add` 415, kaynakta `__return_true` yok + her rotada `permission_callback`, yönetici AJAX işleyicilerinin hepsi koruma çağırıyor.
