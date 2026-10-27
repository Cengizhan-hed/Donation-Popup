# Gizlilik envanteri (Faz 8, E8D)

Eklentinin kaydettiği kişisel veri ve gizlilik araçları. Kaynak: `includes/class-privacy.php`, `src/Privacy/class-privacy-tools.php`.

| Veri | Nerede | Amaç | Saklama | Silme / dışa aktarma |
|---|---|---|---|---|
| Bağışçı adı, telefon, e-posta, not, ithaf (`wdp_donor_*`, `wdp_donation_note`, `wdp_dedication`) | Sipariş KALEMİ meta (`woocommerce_order_itemmeta`) | Bağışın sahibine ulaştırılması, video/teşekkür | Siparişle birlikte | WP dışa aktarma + silme (`WDP_Privacy`): silme değeri `[deleted]` yapar |
| Hissedar adı/telefon/e-posta/not (`wdp_shareholder_N_*`) | Sipariş kalemi meta | Hisse bağışında hissedar bilgisi | Siparişle birlikte | Aynı: hissedarın kendi e-postası ya da fatura e-postası eşleşirse |
| Anonim bayrağı (`wdp_anonymous`) | Sipariş kalemi meta | Anonim gösterim | Siparişle birlikte | Bayrak kişisel değil; silmede korunur. (Eski `wdp_public_name` izni artık okunmaz: sosyal kanıtta ad hiç gösterilmez.) |
| Tutar, tür, dönem, ilerleme (`_custom_price`, `wdp_donation_type`, `wdp_donation_frequency`, `_wdp_progress_*`) | Sipariş kalemi / sipariş meta | Muhasebe, kampanya toplamı | Siparişle birlikte | KİŞİSEL DEĞİL; muhasebe için tutulur (silmede "tutulan" mesajı döner) |
| Vergi indirimi beyanı (`_wdp_tax_relief_declared`, `_wdp_tax_relief_text_hash`) | Sipariş / kalem meta | Beyanın kanıtı (yasal kayıt) | Siparişle birlikte | Tutulur (yasal kayıt); kişisel alan içermez |
| Misafir bağışı bağlama kaydı (`_donation_panel_guest_link`) | Kullanıcı meta | E-posta doğrulamasıyla önceki misafir bağışlarını hesaba bağlama | 1 saat; kullanılınca silinir. Düz belirteç saklanmaz, yalnız HMAC karması + e-posta | WP dışa aktarma (karma çıkmaz) + silme: tamamen silinir (`Privacy_Tools`) |
| Bağışçı hesabı (kullanıcı, parola, Hesabım) | WordPress/WooCommerce kullanıcıları | Giriş, Bağışlarım | WP/Woo kuralları | WP/Woo kendi araçları (eklenti ayrıca veri tutmaz) |
| Sepet oturumu (tutar, bağış alanları) | WooCommerce oturumu | Sepet/ödeme | WooCommerce oturum süresi | WooCommerce |
| İstek sınırı sayaçları (`wdp_rate_limit_*`, `donation_panel_rl_*`) | Geçici veri (transient) | Kötüye kullanım koruması | En çok birkaç dakika | IP/UA yalnız tek yönlü karma (md5) anahtarının parçasıdır; ham IP saklanmaz |
| `wdp_vid` çerezi | — (KALDIRILDI) | Eskiden yalnız istek sınırı kovası | — | Eski çerez gelirse yok sayılır ve tarayıcıdan silinir (`Privacy_Tools::expire_legacy_cookie`) |

## wdp_vid kararı

`wdp_vid` yalnız salt okunur uçların (`get_product_info`, `render_modal`) istek sınırı kovasını ziyaretçiye göre ayırıyordu; bağışın çalışması için gerekli değildi (kesin zorunlu çerez değil) ve rızasız yazılıyordu. KALDIRILDI: Consent API koşulu gerektirmeyecek biçimde eklenti hiçbir çerez yazmaz. Kova artık IP+UA(+Woo oturumu) karmasıdır; ortak IP (CGNAT) için IP katmanı (600/dk, `wdp_rate_limit_ip_max` süzgeci) korunur. Sosyal kanıt/sayaç özellikleri bu çerezi hiç kullanmaz (gerçek sipariş verisi).

## Araçlar

- Dışa aktarma/silme: e-posta ile (fatura e-postası, bağışçı e-postası, hissedar e-postası); telefon eşleşmesi yalnız sipariş e-postası BOŞSA ya da istek sahibininse (başkasının verisi sızmaz). Sayfa başına ≤ 50 sipariş. Yalnız WooCommerce sipariş API'si (`wc_get_order(s)`) + kalem meta tablosu; HPOS açık/kapalı fark etmez, doğrudan `postmeta` sorgusu yok.
- Silme sipariş kaydını/tutarını silmez; yalnız kişisel alanları `[deleted]` yapar ve "tutulan" mesajı döndürür.
- Gizlilik politikası önerisi: `wp_add_privacy_policy_content` (yalnız `admin_init`; yalnız öneri metni).
- Araçlar modül ayarından bağımsız her zaman yüklenir (`WDP_Privacy::init` -> `Privacy_Tools::init`).
