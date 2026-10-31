# RAPOR-124-androidrun (dal v124-androidrun)

## Alınan teknik kararlar
- **e2e:android CDP düşmesi kök nedeni:** `dismissChromeFirstRun` uiautomator dökümü geçiş anında "null root node" döndürünce boş XML'i "düğme yok" sayıp erken çıkıyordu (karşılama/bildirim ekranı açık kalıyordu). Düzeltme: `dumpUi` (4 deneme, geçerli `<hierarchy` şartı), art arda 2 TEMİZ okuma gelene dek döngü (<=14 tur), "Wait"/"Close app" (ANR) düğmeleri listeye eklendi. Spec: kalibrasyon dokunuşu `bringToFront` + 12 deneme. Bu ortamda emülatör çalışıyor (rc=139 yok; `dangerouslyDisableSandbox` ile).
- **Ölçüm düzeltmesi:** `kbOpen` odaktan (focusin) ölçülür (eskiden dokunuş + kaydırma beklemesi dahil, 2,5 sn pencere, çoğu zaman null); pencere 4,5 sn; ilk alan bekleme 4,5 sn.
- **`NO_KEYBOARD_MS` 2000 -> 4000** (keyboard.mjs; gerekçe kodda). 2 sn'de soğuk açılışta (emülatör yeni açıldıktan sonra ilk klavye) düğme erken göründü, klavye gelince yeniden gizlendi (kb izi [true,false,true]; firstMs 2123 ve 2692). Soğuk en yavaş 2993 ms; 4 sn ~1,33x.
- Test sınırları: android/ios-keyboard yedek penceresi 3950-4800 ms, bekleme timeout 7000; yeni yavaş-klavye vakası "soğuk 3,2 sn"; yavaş vaka gözlem penceresi 4,5 sn; birim test aralığı 3500-4000.

## Kanıt (AVD wdp-pixel7-a35, Android 15, Chromium 159, -no-window swiftshader; odaktan ilk görünüm küçülmesi, ms)
| Klavye | koşu (4 sn sürümü) | firstMs (= settledMs, tek adım) |
|---|---|---|
| Gboard | 5/5 yeşil | 2092 (soğuk), 844, 522, 1364, 685 |
| AnySoftKeyboard | 5/5 yeşil | 1344 (soğuk), 1290, 505, 637, 621 |
- 2 sn'lik önceki sürümde ölçümler: Gboard 1201, 611, 541, 481, 647, 436, 1982, 845, 2993*, 758, 630, 2123*, 2692* (*soğuk; erken görünme/hata); AnySoft 1483, 731, 670, 992, 845, 1434, 386, 609.
- Yeşil koşularda kb izi tek değer [true]; bar/btn/gövde/yüzey rect=1, docY=1; >=12 px alt boşluk sağlandı.
- Yerel: android-keyboard 22 geçti/11 atlandı/0 hata; layer-motion 35 geçti/4 atlandı/0 hata; ios-keyboard iphone projeleri geçti, `desktop` projesinde 4 hata (TABANDA AYNI 4 hata: dokunmatik olmayan projede bölüm gizlenmez; değişiklikle ilgisiz). `npm test`: PHPUnit 909 OK, JS 886 geçti/0 hata. `verify`: yalnız son adım `analyse:security` kırmızı (Semgrep kurulu değil; `npm run security:install`), öncekiler geçti.
- Altyapı: emülatör bellek darlığında ara sıra kendiliğinden kapanıyor (~4 kez); o koşular atlandı/başarısız sayıldı ve emülatör yeniden başlatılıp tekrarlandı.

## Ayar/rehber
Gerek yok: kullanıcıya görünen ayar/davranış değişmedi (iç zamanlayıcı süresi; fiziksel klavyede ilk tuş beklemeden devreye girer, yalnız hiç yazılmayan durumda ~4 sn).

## Ana oturum için komutlar
ANDROID_HOME=ANDROID_SDK_ROOT=$HOME/.wdp-android-sdk; `$ANDROID_HOME/emulator/emulator -avd wdp-pixel7-a35 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory 2048 &` -> `adb shell getprop sys.boot_completed` = 1 -> `WDP_ANDROID_CHROME_PKG=org.chromium.chrome WDP_LOCAL_E2E_PORT=9089 [WDP_ANDROID_IME=com.menny.android.anysoftkeyboard/.SoftKeyboard] npm run e2e:android` -> `adb emu kill`.

## Kalan işler
- 4 sn sınırının gerçek cihazda doğrulanması (emülatör yazılım çizimi gerçek telefondan yavaş).
- CLAUDE.md/docs'ta "~2 sn" ifadesi varsa güncelle (paylaşılan dosya, dokunulmadı); RAPOR-124-fixfull'deki "2 sn" eskidi.
