# RAPOR 121-ios (dal v121-ios, worktree ../wt-121-ios, port 8951)

## Kök neden (a-f)
- (a) 16px: yalnız `.donation-panel-ac__input` 15px (`ui2-shared/controls.css:10`) → 16px yapıldı. Form/telefon/tutar/select zaten 16px. Bulundu+düzeltildi.
- (b) Kaydırma kilidi: body position:fixed YOK (`scroll-lock.mjs`: html overflow:hidden + inert). Bulunmadı, değişiklik yok.
- (c) Panel yüksekliği: zaten `dvh` + `--dp-vvh`; ama `--dp-kb` (margin) eski formülle. Geometri ayrıldı (`layer.mjs applyGeometry`, rAF).
- (d) GERİ-BESLEME/ZIPLAMA: BULUNDU. Eski `kb = innerHeight - vv.height - offsetTop`; Safari görsel görünümü kaydırınca offsetTop≈klavye → kb≈0 → "klavye kapandı" (dismissed) → alt çubuk geri geliyor (alanları örtüyor) + her resize/scroll'da yeniden karar. Düzeltme: algı `baseline - vv.height` (offsetTop'tan bağımsız), histerezis 150/80 px (`keyboard.mjs`), resize debounce 100 ms, alandan alana geçişte 250 ms blur payı.
- (e) scrollIntoView: eskiden her syncKeyboard'da (`block:center`) + 280 ms sonra; şimdi odak başına en çok 1 (`block:'nearest'`, klavye yerleşince/yedek 450 ms). `scroll-margin-block:24px` (`all: revert` sonrası, controls.css).
- (f) Alt bölüm: klavye açıkken akışta (önceki mekanizma korundu); ön-klavye durumu focusin'de hemen; kapanış blur+250 ms.

## Eski ↔ yeni benzetim (iPhone 13 390x844, iPhone SE 375x667; 20 örnek/150 ms)
| Senaryo | Eski kod | Yeni kod |
|---|---|---|
| kb durumu 3 sn sonunda açık | KIRMIZI (çubuk geri geldi, kb=false) x2 boyut | yeşil x2 |
| titreme (kb/scrollTop değişimi ≤2) | geçti (tek geçiş: açık→kapalı; sorun titreme değil kalıcı yanlış kapanış) | yeşil |
| alandan alana kb kapanıp açılma 0, alan örtülmez, ≥8 px klavye üstü, scrollIntoView ≤1/odak | eski kodda ilk kırmızıda ulaşılmadı | yeşil (ilk koşuda Not alanı scroll-margin eksikti, düzeltildi) |
| kapanınca çubuk geri | - | yeşil |
| giriş ≥16px, body fixed yok | yeşil | yeşil |
Benzetim gerçek hatayı yakalıyor (eski kodda kırmızı).

## Doğrulama
- `ios-keyboard` spec iphone: 4/4. lint:js 0, lint:css 0, JS birim 5/5 (yeni histerezis testi).
- `experiences-instant|audit` (3 cihaz): 34 geçti; masaüstü "anında açılma" ms testi yük gürültüsüyle zaman zaman kırmızı (aynı kod 3 koşunun 2'sinde yeşil, eski kod 2/2 yeşil): `clientHeight` okuması kaldırıldı. Başka kırmızı yok.
- `e2e:full --env local`: Geçti=128 Atlandı=0 Hata=0 (122 sn).

## Alınan teknik kararlar
- Android Chrome (innerHeight de küçülür): baseline en büyük innerHeight olduğundan aynı yol çalışır.
- Kapanışta `--dp-kb/--dp-vvh` silinmez (kapanış animasyonu zıplamasın).
- scripts önerisi (package.json paylaşılan): `"e2e:ios-kb": "node tests/e2e/run-experiences.mjs --env local --spec ios-keyboard --project iphone"`.

## Telefonda dene (gerçek cihaz kanıtı kullanıcıdan)
1. iPhone Safari'de staging30/Ikram bir ürünü aç, panelden tutar seç, Devam.
2. Ad Soyad alanına dokun: klavye bir kez açılsın, ekran zıplamasın.
3. Telefon, sonra Not alanına geç: klavye kapanıp açılmasın; alan klavyenin hemen üstünde, Bağış düğmesi alanı örtmesin.
4. Aşağı kaydır: düğmeler formun en altında olmalı.
5. Klavyeyi kapat (Bitti/dışarı dokun): sabit düğmeler alta geri gelsin.
6. Alanlara dokununca sayfa yakınlaşmasın (zoom yok).

## Kalan işler
- Gerçek cihaz onayı (kullanıcı). Gerekirse sim'e gerçek Safari ölçümleri (offsetTop değerleri) işlenir.
