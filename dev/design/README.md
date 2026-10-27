# Donation Panel — tasarım sistemi ve prototipler (Faz 7D)

Bu klasör **eklenti kodu değildir**; Faz 7E'nin uygulayacağı görsel dili, etkileşimleri ve ekranları kanıtlayan çalışır prototipdir. Açmak için: `python3 -m http.server 9910 --directory design` → `http://localhost:9910/showcase/index.html` (vitrin; iframe'ler `../<ekran>.html` yükler, bu yüzden klasörü `design/` kökünden sunun).

| Dosya | Ne |
|---|---|
| `tokens.css` | Tek görsel dil: `--dp-*` belirteçleri + tema köprüsü + koyu mod + azaltılmış hareket |
| `components.css` | Bileşenler (düğme, tutar çipi, alan, katman/panel/alt panel, ilerleme, kart, liste, durumlar) |
| `dp.js`, `screens.js`, `admin.js` | Prototip davranışı (form çekirdeği, katman yöneticisi, ekranlar). Üretim kodu Interactivity API ile yeniden yazılır; davranış sözleşmesi buradadır |
| `mock.css`, `admin.css` | Yalnız vitrin: tema **simülasyonu** ve yönetim çerçevesi (eklentiye girmez) |
| `*.html` | 16 etkileşimli ekran. URL: `?lang=tr\|en\|ar&theme=avada\|blocksy\|tt25\|storefront\|neutral&scheme=dark&open=0` |
| `showcase/` | `shoot.mjs` ile üretilen ekran görüntüleri; `index.html` = canlı vitrin (16 ekran, her biri mobil 390 px + masaüstü 1280 px ölçekli iframe, tema/dil/koyu mod seçici, sabit içindekiler, tembel yükleme, görüntü yedeği; `index-preview.png` önizleme); `contact-sheet.html` = eski görüntü kontak sayfası (`make-index.mjs` üretir) |
| `KARARLAR.md` | Neden bu düzen; rakip kalıplarından alınanlar ve bilinçli alınmayanlar |

## 1. İlkeler
1. **Tek form çekirdeği, üç kap.** Popup, yan panel, alt panel ve sayfa içi form aynı içeriktir; yalnız kap değişir. Ekran ≤ 639 px iken popup ve yan panel otomatik **alttan panel** olur. Yeni deneyim eklemek = yeni kap, yeni form değil.
2. **Önce başparmak.** Ana eylem her zaman altta, sabit eylem çubuğunda (toplam + düğme); güvenli alan `env(safe-area-inset-bottom)`; klavye açılınca `visualViewport` ile panel görünür alana oturur, odaklı alan ortaya kaydırılır.
3. **Tema neyse o.** Renk, yazı, köşe `--wp--preset--*` / `--wp--custom--radius` önayarlarından türer; yoksa nötr (teal, sistem yazısı, 14 px köşe). Temaya/oluşturucuya özel seçici yoktur. Düğme yazı rengi birincil renkten otomatik (göreli renk sözdizimi; desteklenmezse beyaz) hesaplanır → kontrast korunur.
4. **Somut ve sakin.** Tutar çiplerinin altında etki ifadesi, tek vurgu rengi, bol boşluk (4 px ritmi), tek ağırlıklı başlık hiyerarşisi. Baskı yok: ücret kutusu asla önceden işaretli değil, bahşiş kaydırıcısı yok.
5. **Az adım.** Tutar → bilgiler (→ vergi indirimi, yalnız modül açıksa) → ödeme sayfası. Adım göstergesi ve her adımda görünen toplam.
6. **Gizlilik.** Teşekkür ve sosyal kanıt ekranlarında kişi bilgisi yok; bağış listesi yalnız adının görünmesine izin verenleri (ad + soyad baş harfi) gösterir.
7. **Düzenli bağış** yalnız abonelik yeteneği varsa (`donation_panel_frequency_options`): üstte "Tek seferlik / Aylık" anahtarı (`?sub=1` ile görülür). Yoksa hiç çizilmez.

## 2. Belirteçler (özet)
Renk: `primary`, `primary-strong` (metin/bağlantı), `primary-soft/softer`, `on-primary`, `surface/2/3`, `text`, `text-muted`, `border/strong`, durum `success|warning|danger|info` (+`-soft`), `gold` (kutlama). Yazı: `--dp-font-body/heading`, ölçek `xs…2xl`. Boşluk `space-1…12`, `gutter` 20 px, `touch` 48 px. Köşe `radius` tek değerden türer (`xs…sheet`). Gölge `shadow-1…3, sheet, focus`. Hareket süreleri + `ease-out`, `ease-spring`. Alt ağaçta yeniden temalanır: `.dp` üstüne `--dp-bridge-primary` ya da `--dp-bridge-radius` yazmak tüm türevleri günceller (sihirbaz önizlemesi böyle çalışır).

## 3. Mikro etkileşimler
Hepsi `prefers-reduced-motion: reduce` altında süresi ~0 / animasyonsuz olur (belirteçler + sonda genel kural); işlev aynıdır.
- Basınca ölçek (.97, yay): düğmeler, tutar çipleri, adet düğmeleri, simge düğmeleri.
- Tutar seçimi: kenar + zemin yumuşak geçiş, sağ üstte onay rozeti yayla belirir, toplam sayı yumuşak sayar.
- Segmentli anahtar: gösterge yayla kayar (RTL'de ters).
- Katman: popup yaylı büyüme, yan panel yaylı kayma, alt panel yayla yükselir; **sürükleyip kapatma** (tutamaç ve başlık, > 110 px).
- Adım çubuğu soldan (RTL: sağdan) dolar; hata alanı kısa sarsılır + satır içi mesaj belirir.
- Aç/kapa bölüm (ithaf): `grid-template-rows` ile yumuşak yükseklik.
- İlerleme çubuğu: görünür olunca dolar (1,4 sn), tutar sayaç gibi sayar, parlama süzülmesi, ara hedef işaretleri vurulunca altın dönüşür; "bağış simüle et" ile canlı artış.
- Teşekkür: halka çizilir → onay işareti çizilir → 26 parçalık sade konfeti (3–4 sn, azaltılmış harekette yok).
- Yeni liste satırı vurgu geçişi; kayan bildirim; yükleme düğmesi (dönen halka, tıklama kapalı).

## 4. Durumlar
| Durum | Tasarım |
|---|---|
| Boş | Yumuşak daire içinde simge + 1 cümle + eylem ("Henüz bağış yok" / "Sepetiniz boş") |
| Yükleniyor | İskelet satırlar (`aria-busy`), düğmede halka; layout kaymaz |
| Hata | Kırmızı tonlu simge + "ne oldu / veri kaybolmadı" + Tekrar dene; alan hatası: alan altında simge+metin, üstte özet (`role="alert"`) |
| Başarı | Teşekkür ekranı; kaydetme: "Kaydedildi" (yönetici) |
| Hedefe ulaşıldı | Çubuk %100 + yeşil rozet; düğme kapanmaz (yönetici seçer) |

## 5. Erişilebilirlik (WCAG 2.2 AA — kural)
- **Dokunma ≥ 44 px** (varsayılan 48): düğme, çip, onay kutusu satırı, adet düğmesi, sekme, simge düğmesi (44). Hedefler arası ≥ 8 px.
- **Odak halkası** her etkileşimli öğede (2 katman: boşluk + 2 px vurgu), `:focus-visible`; hiçbir yerde `outline:none` ile yalnız bırakılmaz. Odak, kapalı kata sıkışmaz.
- **Kontrast:** metin ≥ 4.5:1 (`text-muted` bu oranla türetilir), büyük metin/bileşen sınırı ≥ 3:1; durum rengi tek başına bilgi taşımaz (simge + metin). `text-faint` yalnız yer tutucu/dekor.
- **Klavye:** katmanda odak tuzağı, `Esc` kapatır, kapanınca odak tetikleyiciye döner; tutar çipleri `radiogroup` (ok tuşları, roving tabindex; RTL'de yön tersine); sekmeler/segment `role` ile.
- **Ekran okuyucu:** katman `role="dialog" aria-modal aria-labelledby`; adım etiketi ve toplam `aria-live="polite"`; alan hatası `aria-describedby` + `role="alert"`; ilerleme `role="progressbar"` + değer; simgeler `aria-hidden`; her simge düğmesi `aria-label`.
- **Form:** görünür etiket (yer tutucu etiket değildir), `autocomplete` (name, email, tel-national, postal-code…), `inputmode`, yazı ≥ 16 px (iOS yakınlaştırmayı önler), hata mesajı düzeltme yolunu söyler.
- **Hareket:** `prefers-reduced-motion` (bkz. 3); **koyu mod:** `prefers-color-scheme` + `data-dp-scheme`; **RTL:** yalnız mantıksal özellikler (`rtl.html`, Arapça).
- Prototip doğrulaması: Playwright konsol hatası 0; tam axe/Lighthouse kapıları 7E'de ölçülür (bütçe: kritik CSS ≤ 8 KB gz).

## 6. Bilinen sınırlar
Prototip, JS ile çizer; üretimde şablonlar sunucuda render edilir (Interactivity API). Gerçek temalar kurulu değil — vitrin 4 temayı **simüle eder**; gerçek tema denemesi yerel WP matrisinde (7E) yapılır. Etki ifadeleri ve metinler örnektir; gerçek metinler ürün ayarından gelir. Konfeti ve sayaç animasyonları azaltılmış hareketle kapanır.
