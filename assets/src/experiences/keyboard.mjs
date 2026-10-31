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
 * Dokunmatik ekranda odaktan sonra ekran klavyesinin gelmesi için beklenen en uzun süre (ms). Bu sürede görsel görünüm
 * (visualViewport) açılma eşiği kadar küçülmezse cihazda ekran klavyesi yok sayılır (fiziksel klavyeli tablet,
 * Chromebook tablet kipi): alt bölüm gösterilir. Yavaş klavyeli cihazlar için iki koruma: (1) 1200 ms, klavye açılış
 * animasyonlarının (iOS ~250–350 ms, Android ~300–600 ms) iki katından uzun; (2) karar ancak görsel görünüm
 * VIEWPORT_STABLE_MS boyunca yeniden boyutlanmadıysa verilir (açılış animasyonu sürerken karar ertelenir).
 * Sinyal: yalnız visualViewport `resize` (tüm güncel tarayıcılar; MDN "VisualViewport: resize event").
 * `navigator.virtualKeyboard` yalnız Chromium'da ve `overlaysContent = true` iken olay verir; bu kip görünüm küçülmesini
 * kapatıp mevcut yerleşimi değiştirdiği için kullanılmaz.
 */
export const NO_KEYBOARD_MS = 1200;

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
