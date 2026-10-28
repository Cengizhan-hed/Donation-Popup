/**
 * Mobil klavye mantığı (saf işlevler; DOM yok, birim test edilebilir).
 */

/** Görsel görünüm bu kadar küçülürse ekran klavyesi açık sayılır (px). */
export const KEYBOARD_MIN_PX = 120;

/** Görsel görünüm bu değerin altına dönünce klavye kapanmış sayılır (px). */
export const KEYBOARD_GONE_PX = 40;

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
