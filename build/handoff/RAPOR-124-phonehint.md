# RAPOR 124-phonehint (dal v124-phonehint)

## Alınan teknik kararlar
- Sorun yüzeyi: form (sepetli/sepetsiz) telefon alanı. Hata (`.donation-panel-error`, display:none -> flex) ve hissedar satırı ipucu (`[data-dp-phone-note]`, hidden) belirince düğme aşağı kayıyordu. Compact kartta durum satırı zaten ayrılı (absolute, yükseklik sabit); dokunulmadı.
- Çözüm tek CSS bloğu (ui2-shared/fields.css): telefon alanı olan `.donation-panel-field` içinde hata ve ipucu satırı HER ZAMAN yerleşimde, yalnız `visibility` ile gizli (3 satır, >=520 px genişlikte 2 satır, yazı 16 px). İpucu ve hata aynı grid hücresinde (karşılıklı dışlayıcı) -> tek ayrılmış alan. aria-describedby/role=status korunur; yazarken ipucu metni de temizlenir (phone.mjs, 1 satır).
- Ayrılan alan maliyeti: telefon alanının altında mobilde ~65 px (+8 px boşluk), geniş ekranda ~43 px. Katman gövdesi kaydırılabilir, klavye/alt bölüm (yalnız opacity) sözleşmesine dokunulmadı; ios/android-keyboard yeşil.
- Not (compact2 ajanına/Claude'a): compact kart hata satırı 12.5 px (istek >=16 px); compact dosyası bu görevin sahipliğinde olmadığından değiştirilmedi.

## Kanıt
- Yeni test `phone-field.spec.mjs` "ipucu/uyarı belirirken düzen kaymaz": rAF ile düğme top/left/w/h örneklenir (uyarı beliriş, kalkış, mobil önek ipucu); farklı konum sayısı 1 olmalı + alan odakta iken düğmeye ilk dokunuş (aynı koordinat) click'i düğmeye ulaşır.
- Eski kodla KIRMIZI (iphone: 2 farklı konum, beklenen 1); yeni kodla 3 cihazda (iphone/android/desktop) 9/9 yeşil.
- compact-card 47 geçti/4 atlandı; kurgu-matrix 31/2 atlandı; ios-keyboard 18; android-keyboard 8/4 atlandı; hepsi hatasız.
- `npm run test`: JS 863/864 (1 atlandı), PHPUnit yeşil; `npm run verify` temiz (analyse:security YENİ 0).
- Bütçe: fields.css gz 1543 -> 1866 B (+323 B); JS değişimi ihmal edilebilir (1 satır). `measure:plugin-perf` yapılmadı (bellek dar, diğer ajan Playwright'ta); değişiklik yalnız form CSS'i, yeni istek/JS yok.
- Gerçek Android emülatör+klavye doğrulaması YAPILMADI: başka ajanın (compact2) Playwright süreci aynı anda çalışıyordu; kural gereği eşzamanlı koşulmadı. Claude ana oturum sırası gelince koşabilir.

## Ayar/rehber
Gerek yok: görünüm/yerleşim düzeltmesi, yeni ayar veya davranış seçeneği yok. Çeviri dizgesi eklenmedi.

## Kalan işler
- Emülatörde gerçek klavye doğrulaması; `measure:plugin-perf` karşılaştırması.
- compact hata satırı yazı boyutu (12.5 px) kararı.
