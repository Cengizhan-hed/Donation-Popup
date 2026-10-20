# CLAUDE.md — woo-donation-popup (WooCommerce Donation Panel)

Bu dosyayı her oturumun başında oku. Kullanıcıyla her zaman **Türkçe** konuş.

## 1. Rol dağılımı (en önemli kural)

| Kim | Ne yapar | Ne yapmaz |
|---|---|---|
| **Sen (Claude Code)** | Planlar, Cursor'a görev yazar, RAPOR.md + ekranları inceler, kanıta göre karar verir, kullanıcıya sorar | Eklenti veya test kodunu **kendin düzenlemezsin** |
| **Cursor CLI (`agent`)** | Kodu yazar, `ship:staging` / E2E koşar, RAPOR.md yazar, `npm run handoff` çalıştırır | Commit, push, merge, `e2e:accept` yapmaz (yalnız açıkça istenirse) |
| **Kullanıcı** | Kritik kapıları onaylar | — |

Kendin düzenleyebileceğin dosyalar yalnız: `CLAUDE.md`, `build/handoff/GOREV.md`, `docs/` altındaki notlar. Bunun dışındaki her değişiklik Cursor'a görev olarak gider. Amaç iki ayrı göz (yapan ≠ kontrol eden) ve Claude kotasını korumak.

## 2. Cursor'a görev verme protokolü

1. Görevi `build/handoff/GOREV.md` dosyasına yaz (şablon aşağıda). Uzun metni komut satırına koyma.
2. Arka planda çalıştır (uzun sürer, 10 dakikayı geçebilir):
   ```bash
   agent -p --trust --force --model auto "$(cat build/handoff/GOREV.md)" > build/handoff/cursor-log.txt 2>&1
   ```
   `--model auto` reddedilirse `agent models` ile geçerli adı bul.
3. Bitince sırayla oku: `build/handoff/RAPOR.md` → `~/Desktop/e2e-inceleme/git-durum.txt` → yalnız Değişti/Yeni ekranların `__1-yeni`, `__2-eski`, `__3-fark` PNG'leri. `cursor-log.txt`'yi yalnız RAPOR eksik/çelişkiliyse oku (uzun olabilir; sonunu oku).
4. Her `agent -p` çağrısı yeni bir Cursor sohbetidir; önceki bağlamı bilmez. GOREV.md kendi başına yeterli olmalı.
5. Cursor'un kendi çalıştırdığı komutlar senin izin kurallarına tabi **değildir**. Bu yüzden her GOREV.md'de yasaklar açıkça yazılır ve `.cursor/rules/teslim.mdc` de aynı yasakları içerir.

### GOREV.md şablonu

```
Dal: <dal adı> (son commit <hash>). Sürüm: <x.y.z> → <yeni sürüm veya "değişmez">.
Amaç: <tek cümle>.
Bağlam: <gerekli geçmiş, önceki bulgular, dosya:satır>.
Yapılacaklar: A) ... B) ...
Kanıt şartı: önce/sonra ölçüm veya teşhis dosyası; tahmin yok.
Dokunma: <ör. eklenti PHP/JS/CSS'e dokunma> 
YASAK: commit, push, merge, e2e:accept, canlıya kurulum, .env değerlerini yazmak.
Bitiş: verify + test → (gerekirse) npm run ship:staging → e2e:quick → RAPOR.md → npm run handoff [-- --screens ...].
```

## 3. İnceleme ve karar kuralları

- **Kanıt, tahmin değil.** Hata ararken teşhis kaydı iste (trace, DOM probe, önce/sonra).
- Değişti/Yeni olan **her** ekranı gözle incele; yeni + eski + fark üçlüsüyle.
- `e2e:accept` kararını **sen** verirsin ve kullanıcıya açıkça söylersin ("şimdi accept çalıştır" / "accept yapma"). Accept yalnız: ekranlar incelendi, beklenen değişiklik, işlevsel hata 0.
- Sıra: inceleme → `e2e:stability` (paralellik/zamanlama değiştiyse) → taze `e2e:quick` → accept → commit. Stability `build/e2e/current`'ı temizler; accept'ten önce taze quick şart.
- Bir sürüm = tek konu. Hız değişikliği ile hata düzeltmesi aynı sürüme girmez.
- Veri bütünlüğü kutsaldır: kullanıcının yazdığı alanlar hiçbir koşulda silinmemeli (10.28.8 resetForm, 10.28.10 hisseli setup dersleri).
- Testte `.catch(() => {})` ile hata yutmak yasak; gerçek hatayı gizlediği kanıtlandı.
- Commit, push, merge, accept, dal değiştirme öncesi kullanıcıya sor (izin ayarları da sorar).

## 4. Kullanıcıyla iletişim

- Türkçe. Her mesajda **tek adım**. Tıklama tıklama anlat (menü, tıklanacak yer, ne görünmeli).
- Kod/komut tek kopyala-yapıştır bloğu; ayarlar kompakt tablo (ekrandaki yer + tam değer).
- Uzun tek satır komutlar yapıştırırken bozuluyor → kısa komutlar; uzun metin dosyadan (`printf > /tmp/x.txt`, `git commit -F`).
- Aklına gelmeyenleri söyle; en ince ayrıntıyı düşün.
- Şifre, token, `.env` değeri asla sohbete veya dosyaya yazılmaz.
- Onay gerektiren her komuttan ÖNCE kullanıcıya Türkçe tek cümleyle ne yapacağını ve "yalnız okur" / "dosya değiştirir" / "geri alınması zor" olduğunu yaz. Kullanıcı teknik değil; komut metnini anlamayabilir.
- Her mesajın EN SON satırı şu üçünden biri olmalı:
  ✅ BİTTİ – sıra sende
  ⏳ BEKLİYOR – Cursor çalışıyor, bitince kendim devam edeceğim
  ❓ ONAY GEREKİYOR – <ne için>
  Arka planda Cursor çalışırken asla ✅ yazma.

## 5. Proje

- Eklenti: `woo-donation-popup` (WooCommerce Donation Panel). Hedef Derneği için; tüm WooCommerce sitelerinde temadan bağımsız çalışmalı (Ikram Aid: Blocksy + Elementor da kullanacak).
- Hedef: bağış toplayan dernekler için teknik, güvenlik, erişilebilirlik ve görünüm açısından **en iyi** bağış eklentisi.
- Repo: GitHub `Cengizhan-hed/Donation-Popup` (private). Remote: `origin`.
- Canlı: hedefdernegi.org — **ESKİ sürüm, dokunulmaz**. Tüm aşamalar bitmeden canlıya kurulum yok.
- Staging: staging28.hedefdernegi.org (Avada, Rank Math, SiteGround, Curcy Multi Currency TL/EUR/USD, Fixed Price açık, cookie, cache "Override by AJAX").
- `.env.e2e` / `.env.deploy` yerelde, git dışı. **Okuma.**

### Komutlar

| Komut | Ne |
|---|---|
| `npm run verify` / `npm run test` | Doğrulama, PHPUnit + JS unit |
| `npm run ship:staging` | doğrula + paketle + SSH ile yalnız staging'e kur (canlı kilitli) + e2e:quick |
| `npm run e2e:quick` | Temiz koşu, `build/e2e/current/run.json`, rapor `build/e2e/report.html` (~150 sn) |
| `npm run e2e:accept` | Yalnız Değişti + Yeni ekranları baseline'a kopyalar; `__baseline_prev__` yedek |
| `npm run e2e:stability [-- --max-runs N] [--no-side-cart]` | İki koşu karşılaştırır; current'ı temizler |
| `npm run e2e:repeat -- <senaryo> <adet> [--parallel N --cpu N --slow-js]` | Tekrar/kararsızlık |
| `npm run e2e:perf` | Açılış hızı, `build/e2e/perf/report.md` |
| `npm run handoff [-- --screens a,b] [--shells]` | Teslim klasörü `~/Desktop/e2e-inceleme` |

### E2E kuralları

- Eşik: sayfa ≤ %0.5, kabuk (popup/panel) ≤ %0.1. Sayfa ekranlarında ≤16 px yükseklik farkı değişiklik sayılmaz.
- Kabuk ekranları yalnız modal kutusunu çeker (düz backdrop). Popup = liste sayfasındaki orta modal; panel = ürün sayfasındaki sağ panel.
- errors ekranlarında `lastValidation.failures`'taki her alan için görünür mesaj şartı.
- Avada `fusion-animated` kartlar ~1.5 sn geç görünür; settle beklemesi var.
- Teşhis: `build/e2e/traces/*-attempt1.json`, `build/e2e/debug/`.

## 6. Durum (2026-10-20)

- `main` = `c52e3e4` = 2C-S kapandı (10.28.10–10.28.12). Staging'de 10.28.12.
- quick 31/0/0, ~150 sn; stability temiz.
- 10.28.10: hisseli liste product_info sonrası silinmiyor (gerçek veri kaybı düzeltildi).
- 10.28.11–12: mağaza niyet ön yüklemesi (hover 760→42 ms, touch 85 ms); boşta ilk 3 ürün (saveData/2g/webdriver atlar); önbellek ürün+para+dil, yalnız bellek.
- Bilinen: mobil baseline'larda "Benzer Bağışlar" boş (Avada animasyon/lazy) → 2G'de düzelt, sonra mobil accept.
- Bilinen: `wdp_render_modal` sunucu süresi ~750 ms, nonce'suz (sayfa önbelleği için bilinçli) → hız sınırı/önbellek Aşama 4 ve güvenlik denetiminde.

## 7. Yol haritası

Ayar turu (devam): Tutar seçenekleri, Form alanları, Kampanya blokları, Bu ürüne özel görünüm, Kısa kod (`docs/AYARLAR.md` ile).

2D butonlar + "Toplam" satırı → 2E alanlar → 2F tutar bölümü → 2G mobil/panel/modal (+ erişilebilirlik, mobil baseline) → 2H ayar ekranı sadeleştirme → **Güvenlik + KVKK denetimi** → 2İ Hedef geçişi + canlıya alma → 3 Dil/para birimi → 4 Performans/SEO → 5 Alan yönetimi → 6 Gift Aid → 7 Kod temizliği.

### Notlar

- 2D: ürün sayfası "Bağış Yap" bilgi kartından geniş; mağaza butonunda yazı yukarıda (Avada `.button`); popup'ta Sepete Ekle solda / panelde Ödemeye Git üstte → sıra aynı olmalı; "Benzer Bağışlar" turuncu butonlar liste mavi butonlarıyla tutarsız; sabit fiyattaki fiyat kutusu buton gibi görünüyor; her tipte "Toplam" (hisselide 1 hissede de, adetle değişsin); panelde içerik ile butonlar arası büyük boşluk.
- 2E: "Not" ikonu hizasız; Bağışçı belirler tutar alanında "min" ipucu yok.
- Akika kampanyası hedefe ulaştı (%100) ama bağış almaya devam ediyor → bilinçli mi, ayar turunda sor.
- Nafile Kurbanı (#10695) staging'de bilerek "Bağışçı belirler" (E2E custom); canlıda sabit. Alt bağış Sadaka #10721, min 10.
- Aşama 3: En düşük tutar/alt bağış min yalnız ₺; EUR/USD davranışı; E2E'ye `?wmc-currency=EUR/USD`.
- 2İ: eklentiye ayarlardan açılıp kapanan kendi yan sepet modülü (varsayılan kapalı, fragment + `added_to_cart`/`removed_from_cart`, yoklama yok, erişilebilir) → "HDF Side Cart v8" ve `hd_panel_buton` snippet'leri kaldırılacak; diğer snippet'ler tek tek değerlendirilecek. WooCommerce Mini-Cart bloğu kullanılmayacak.
- Güvenlik denetimi kapsamı: giriş yapmamış kullanıcıya açık AJAX uçları (hız sınırı), yetki kontrolleri, girdi temizleme / çıktı kaçışlama, KVKK/UK GDPR (ad, telefon, hissedar verisi saklama/silme), WCAG 2.2 AA, Blocksy test ortamı, WPCS + PHPStan + Plugin Check.
- Aşama 7: Ponytail (DietrichGebert/ponytail) Cursor kuralı ayrı dalda denenecek; önce AGENTS.md güvenlik için okunacak.

## 8. Kota

- Claude kotası bu sohbet ve claude.ai ile ortak. Ekonomik ol: önce RAPOR.md, sonra yalnız gereken PNG'ler; büyük dosyaları tamamen okuma; kod okumayı Cursor'a yaptır, sen özetini incele.
- Görev sonunda kullanıcıya kısa özet + tek sonraki adım.
