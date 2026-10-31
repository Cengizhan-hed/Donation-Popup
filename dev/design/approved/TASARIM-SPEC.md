# Bağış Paneli — Onaylanan Tasarım (v1)

Kaynak: claude.ai tasarım tuvali "Bağış Paneli — Yeni Tasarım Taslakları". Bu klasördeki *.dc.html dosyaları her ekranın birebir görünümüdür (stiller satır içi). `{{brand}}` = ana renk, `{{accent}}` = eylem (düğme) rengi. Rakamlar, isimler ve görseller örnektir.

## Ekranlar
1. Main.dc.html — Mobil: tutar seçimi (alttan panel, adım 1/2)
2. Bilgiler.dc.html — Mobil: bağışçı bilgileri (adım 2/2)
3. Tesekkur.dc.html — Mobil: teşekkür ekranı
4. Liste.dc.html — Mobil: bağış listesi, kategori sekmeleri, kampanya ve ürün kartları
5. Masaustu.dc.html — Masaüstü: sağ panel (hisseli ürün örneği)
6. YanSepet.dc.html — Mobil: yan sepet
7. Giris.dc.html — Mobil: giriş/kayıt (alttan panel)
8. Bagislarim.dc.html — Mobil: Bağışlarım paneli
9. AdminGenel.dc.html — Yönetici: tek "Bağış Paneli" menüsü + genel bakış
10. AdminSihirbaz.dc.html — Yönetici: kurulum sihirbazı

## Tasarım dili (token'lar)
- Renk: brand (varsayılan temadan; örnek #12305A), accent/eylem (örnek #C2511C; beyaz yazıyla kontrast ≥4.5:1 zorunlu), metin #14213D, ikincil metin #5B6475, kenarlık #DDE1E7, zemin (sıcak) #F6F2EC, ilerleme zemini #EDE7DF, seçili kart zemini #EEF3FA, başarı #1E6B45 / #E5F3EB.
- Yazı: mockup'ta Plus Jakarta Sans; eklentide VARSAYILAN temanın yazı tipi (inherit). Ağırlıklar: başlık 800, etiket 600–700, gövde 400–500. Sayılar tabular-nums.
- Köşe: alttan panel 28, kart 16–22, giriş alanı 14, düğme 14–16, hap/etiket 999.
- Boyut: ana düğme 56 px yükseklik; tüm dokunma alanları ≥44 px; giriş alanları 50–52 px; mobil yan boşluk 20 px.
- Gölge: kartlarda çok hafif (0 1px 2px + 0 8px 24px düşük opaklık); paneller için belirgin.
- Desenler: tutma çubuklu alttan panel; adım göstergesi (ADIM 1/2 + çubuk); etki ifadeli tutar kartları, "EN ÇOK SEÇİLEN" rozeti; serbest tutar için kesikli çerçeveli alan; formun üstünde kampanya ilerleme çubuğu ve hedef/bağışçı/kalan gün satırı; sabit alt bölümde toplam + ana düğme + güven satırı; teşekkür ekranında kampanyaya katkı çubuğu; yan sepette ek bağış önerisi.
- Erişilebilirlik: gerçek button/a/input/label; ikon düğmelerinde aria-label; metin kontrastı ≥4.5:1.

## Compact kart v3 (12.4)
(Yalnız ekleme; yukarıdaki onaylı içerik değişmedi.)
- **Amaç:** slider/hero içinde bağışçıyı ödeme sayfasına götüren kart. Her zaman sepetli akış (doğrudan/sepetsiz değil).
- **Akış:** serbest tutarda 2 adım (tutar, sonra bağış türü/ek seçenek); sabit fiyatta tek ekran. Son adımda düğme doğrudan ödeme sayfasına götürür.
- **Kaldırılanlar:** güven satırı (`compact.trust` ayarı), "Toplam" satırı (toplam düğme metnindedir), kart içi e-posta alanı.
- **Boyut:** kart yüksekliği **356 px** (sabit); Elementor slayt/konteyner en az **372 px**. Kart genişliği önceki düzenle aynı.
- **Dokunma ve yazı:** dokunma alanları ≥48 px; yazı ≥16 px (iOS yakınlaştırma ve okunabilirlik).
- **Düğme metni:** "Ödemeye geç · £X" (tutar sitenin para biriminde ve biçiminde).
