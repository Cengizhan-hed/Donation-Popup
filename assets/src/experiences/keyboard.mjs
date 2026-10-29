/**
 * Mobil klavye mantığı (saf işlevler; DOM yok, birim test edilebilir).
 */

/** Görsel görünüm bu kadar küçülürse ekran klavyesi açık sayılır (px). */
export const KEYBOARD_MIN_PX = 150;

/** Görsel görünüm bu değerin altına dönünce klavye kapanmış sayılır (px). */
export const KEYBOARD_GONE_PX = 80;

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
 * Sabit alt bölüm (toplam + düğmeler) gizlensin mi.
 *
 * Kural: bir yazı alanı odakta VE (klavye yüksekliği eşiği aştı YA DA dokunmatik ekran). Klavye açılıp sonra
 * odak alanda kalarak kapanırsa (Android geri hareketi) bölüm bir sonraki odağa kadar geri döner.
 *
 * @param {{fieldFocused: boolean, keyboard: number, coarse: boolean, dismissed: boolean}} input Durum.
 * @return {boolean} Gizlensin mi.
 */
export function shouldHideActionBar({ fieldFocused, keyboard, coarse, dismissed }) {
  if (!fieldFocused) {
    return false;
  }
  if (keyboard >= KEYBOARD_MIN_PX) {
    return true;
  }
  return Boolean(coarse) && !dismissed;
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
