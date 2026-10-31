/**
 * Mobil klavye mantığı (saf işlevler; DOM yok, birim test edilebilir).
 */

/** Görsel görünüm bu kadar küçülürse ekran klavyesi açık sayılır (px). */
export const KEYBOARD_MIN_PX = 150;

/** Görsel görünüm bu değerin altına dönünce klavye kapanmış sayılır (px). */
export const KEYBOARD_GONE_PX = 80;

/** Odaktaki alanın alt kenarı ile görünür alanın (klavyenin) üst kenarı arasında kalacak en az boşluk (px). */
export const REVEAL_GAP_PX = 12;

/** Yazı alanı seçicisi (onay kutusu/radyo/düğme klavye açmaz). */
export const TEXT_FIELD =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="file"]):not([type="hidden"]), textarea, select';

/**
 * Ekran klavyesinin kapladığı yükseklik.
 *
 * @param {number} layoutHeight   Düzen görünümü yüksekliği (window.innerHeight).
 * @param {number} viewportHeight Görsel görünüm yüksekliği (visualViewport.height).
 * @param {number} offsetTop      Görsel görünümün üst kayması.
 * @return {number} Piksel (0 ya da büyük).
 */
export function keyboardHeight(layoutHeight, viewportHeight, offsetTop = 0) {
  const value = Number(layoutHeight) - Number(viewportHeight) - Number(offsetTop);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Klavyenin kapladığı yükseklik, offsetTop'tan BAĞIMSIZ (iOS Safari odaktaki alan için görsel görünümü kaydırır:
 * offsetTop büyüyünce `layout - height - offsetTop` sıfıra düşüp klavye kapanmış sanılırdı).
 *
 * @param {number} baseline       Klavyesiz kararlı yükseklik (açılıştaki en büyük innerHeight/clientHeight).
 * @param {number} viewportHeight Görsel görünüm yüksekliği.
 * @return {number} Küçülme (px; 0 ya da büyük).
 */
export function keyboardShrink(baseline, viewportHeight) {
  const value = Number(baseline) - Number(viewportHeight);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Histerezisli klavye durumu: açma eşiği (KEYBOARD_MIN_PX) kapama eşiğinden (KEYBOARD_GONE_PX) büyüktür; arada durum
 * korunur (düzen değişimi yeni resize üretse bile algı ters dönmez).
 *
 * @param {boolean} wasUp  Önceki durum.
 * @param {number}  shrink keyboardShrink sonucu.
 * @return {boolean} Klavye açık mı.
 */
export function nextKeyboardUp(wasUp, shrink) {
  if (wasUp) {
    return shrink >= KEYBOARD_GONE_PX;
  }
  return shrink >= KEYBOARD_MIN_PX;
}

/**
 * Fiziksel klavye algısı (dokunmatik ekran; ör. klavyeli tablet, Chromebook tablet kipi) — üç işaret, öncelik sırasıyla:
 *  1) Birincil, kanıta dayalı: alan odaktayken bağışçı yazıyor (`input`/`keydown`) ama görsel görünüm (visualViewport)
 *     küçülmemiş (typedWithoutKeyboard). Sanal klavyede yazma ancak klavye göründükten, yani görünüm küçüldükten sonra olur.
 *  2) Destek: `navigator.virtualKeyboard` varsa `geometrychange` yalnız DİNLENİR (MDN: klavye gösterilip gizlenince
 *     ateşlenir; deneysel, yalnız güvenli bağlamda). Yüksekliği > 0 bildirirse sanal klavye görülmüş sayılır.
 *     `overlaysContent` DEĞİŞTİRİLMEZ (görünüm küçülmesini kapatıp yerleşimi bozar).
 *  3) Yedek zamanlayıcı, yalnız hiç yazılmadan beklenen durum için: odaktan NO_KEYBOARD_MS sonra görünüm küçülmemiş ve
 *     VIEWPORT_STABLE_MS boyunca sakinse (açılış animasyonu sürmüyorsa) ekran klavyesi yok sayılır. Oturumda bir kez
 *     sanal klavye görüldüyse (görünüm küçüldü ya da geometrychange) zamanlayıcı o oturumda kullanılmaz.
 * NO_KEYBOARD_MS = 4000: gerçek emülatör ölçümüne göre (RAPOR-124-androidrun; Android 15, Chromium 159, Gboard ve
 * AnySoftKeyboard, odaktan ilk görünüm küçülmesine) ısınmış klavye 0,4–1,5 sn, SOĞUK ilk açılış 2,0–3,0 sn sürdü;
 * 2 sn'lik değerde soğuk açılışta düğme erken göründü ve klavye gelince yeniden gizlendi (titreme). 4 sn, en yavaş
 * ölçümün (3,0 sn) ~1,3 katıdır. Fiziksel klavyede yazma işareti (1) beklemeden devreye girer; bu süre yalnız hiç yazılmayan durumdadır.
 */
export const NO_KEYBOARD_MS = 4000;

/**
 * Yazma olayı fiziksel klavyeden mi: görünüm kapanma eşiğinin (KEYBOARD_GONE_PX) altında küçülmüş ve (varsa)
 * VirtualKeyboard API sanal klavye bildirmiyor.
 *
 * @param {{shrink: number, vkHeight?: number}} input shrink: keyboardShrink sonucu; vkHeight: navigator.virtualKeyboard.boundingRect.height.
 * @return {boolean} Fiziksel klavye.
 */
export function typedWithoutKeyboard({ shrink, vkHeight = 0 }) {
  return Number(shrink) < KEYBOARD_GONE_PX && !(Number(vkHeight) > 0);
}

/** Karar için görsel görünümün sakin kalması gereken süre (ms); bu süre içinde `resize` geldiyse açılış sürüyor sayılır. */
export const VIEWPORT_STABLE_MS = 400;

/**
 * Odaktan NO_KEYBOARD_MS sonra: ekran klavyesi var mı, karar ertelensin mi, yok mu.
 *
 * @param {{keyboardUp: boolean, sinceResize: number}} input keyboardUp: histerezisli klavye durumu; sinceResize: son
 *   görsel görünüm `resize` olayından bu yana geçen süre (ms; hiç olmadıysa Infinity).
 * @return {'present'|'wait'|'absent'} Karar.
 */
export function keyboardPresence({ keyboardUp, sinceResize }) {
  if (keyboardUp) {
    return 'present';
  }
  return sinceResize < VIEWPORT_STABLE_MS ? 'wait' : 'absent';
}

/**
 * Sabit alt bölüm (toplam + düğmeler) gizlensin mi.
 *
 * Kural: bir yazı alanı odakta VE (klavye yüksekliği eşiği aştı YA DA dokunmatik ekran). Klavye açılıp sonra
 * odak alanda kalarak kapanırsa (Android geri hareketi) bölüm bir sonraki odağa kadar geri döner. Dokunmatik ekranda
 * ekran klavyesi hiç gelmediyse (noKeyboard: keyboardPresence 'absent') bölüm görünür kalır.
 *
 * @param {{fieldFocused: boolean, keyboard: number, coarse: boolean, dismissed: boolean, noKeyboard?: boolean}} input Durum.
 * @return {boolean} Gizlensin mi.
 */
export function shouldHideActionBar({ fieldFocused, keyboard, coarse, dismissed, noKeyboard = false }) {
  if (!fieldFocused) {
    return false;
  }
  if (keyboard >= KEYBOARD_MIN_PX) {
    return true;
  }
  return Boolean(coarse) && !dismissed && !noKeyboard;
}

/**
 * Klavye "açılıp kapandı" mı (alan odakta kalsa da).
 *
 * @param {boolean} wasUp   Önceki ölçümde klavye açıktı.
 * @param {number}  keyboard Şimdiki klavye yüksekliği.
 * @return {boolean} Kapandı.
 */
export function keyboardDismissed(wasUp, keyboard) {
  return Boolean(wasUp) && keyboard <= KEYBOARD_GONE_PX;
}
