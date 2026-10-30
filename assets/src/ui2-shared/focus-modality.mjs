/**
 * Odak kipi (12.3): metin alanlarında tarayıcı `:focus-visible`'ı fareyle/dokunuşla tıklamada da eşleştirir; belirgin
 * halka yalnız KLAVYE ile gelinen odakta görünsün diye, eklenti alanına (`.donation-panel` içi) odak geldiğinde son giriş
 * klavyeyse odaklanan öğeye `data-dp-kbd` yazılır, değilse kaldırılır. Fare/dokunuşta yalnız ince kenarlık rengi değişir
 * (controls.css). Yalnız odaklanan öğeye yazılır (kök öğeye değil: tüm belgenin stili yeniden hesaplanmaz).
 * Belge düzeyinde üç pasif yakalama dinleyicisi; paketler arasında tek kurulum (`window.__dpFocusModality`).
 */

/** Klavye kipini başlatan tuşlar (yazı tuşları değil: alana yazmak kipi değiştirmez). */
const NAV_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ', 'Escape']);

/**
 * @param {{key?: string, metaKey?: boolean, ctrlKey?: boolean, altKey?: boolean}} event Tuş olayı.
 * @return {boolean} Bu tuş klavye ile gezinme mi.
 */
export function isNavigationKey(event) {
  return Boolean(event) && !event.metaKey && !event.ctrlKey && !event.altKey && NAV_KEYS.has(String(event.key));
}

export function installFocusModality() {
  if (typeof window === 'undefined' || window.__dpFocusModality) {
    return;
  }
  window.__dpFocusModality = true;
  let keyboard = false;
  document.addEventListener(
    'keydown',
    (event) => {
      if (isNavigationKey(event)) {
        keyboard = true;
      }
    },
    { capture: true, passive: true }
  );
  const pointer = () => {
    keyboard = false;
  };
  document.addEventListener('pointerdown', pointer, { capture: true, passive: true });
  document.addEventListener(
    'focusin',
    (event) => {
      const el = event.target;
      if (!el || !el.closest || !el.closest('.donation-panel')) {
        return;
      }
      if (keyboard) {
        if (!el.hasAttribute('data-dp-kbd')) {
          el.setAttribute('data-dp-kbd', '');
        }
      } else if (el.hasAttribute('data-dp-kbd')) {
        el.removeAttribute('data-dp-kbd');
      }
    },
    { capture: true, passive: true }
  );
}
