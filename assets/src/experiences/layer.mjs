/**
 * Katman davranışı: HTML <dialog> (showModal, üst katman), ihtiyaçta oluşturma, odak, Esc/geri tuşu,
 * kaydırma kilidi, sürükleyerek kapatma ve mobil klavye uyumu.
 *
 * Katman HTML'i sayfada canlı DOM'da değil, inert bir <template data-dp-tpl> içindedir (CLS 0); düğmeye
 * yaklaşılınca/dokunulunca ya da ilk açılışta <dialog> olarak oluşturulur ve form bağlanır.
 */
import { NARROW_QUERY, presentedAs, shouldDismissOnDrag } from './store.mjs';
import { KEYBOARD_GONE_PX, TEXT_FIELD, keyboardDismissed, keyboardHeight, shouldHideActionBar } from './keyboard.mjs';
import { isTopmost, lockPage, unlockPage } from '../ui2-shared/scroll-lock.mjs';

let layerSeq = 0;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Kapanış animasyonu süresi (ms); azaltılmış harekette 0. */
const CLOSE_MS = 220;

/**
 * Odaklanabilir, görünür öğeler.
 *
 * @param {HTMLElement} surface Katman yüzeyi.
 * @return {HTMLElement[]} Öğeler.
 */
function focusables(surface) {
  return Array.from(surface.querySelectorAll(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
}

/**
 * @param {HTMLElement} root Kök (.donation-panel-exp).
 * @param {{ onBuild?: Function }} [hooks] `onBuild(root)`: katman DOM'u oluşunca (form bağlama).
 * @return {{open: Function, close: Function, isOpen: Function, build: Function, destroy: Function}|null} Denetleyici.
 */
export function createLayer(root, hooks = {}) {
  const kind = root.dataset.dpKind;
  const trigger = root.querySelector('[data-dp-open]');
  if (!trigger) {
    return null;
  }

  const media = window.matchMedia(NARROW_QUERY);
  const coarse = window.matchMedia('(pointer: coarse)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups = [];
  const ownerId = `layer-${++layerSeq}`;
  const viewport = window.visualViewport;
  let overlay = null;
  let surface = null;
  let titleNode = null;
  let handle = null;
  let opened = false;
  let pushed = false;
  let closeTimer = 0;
  let keyboardWasUp = false;
  let keyboardDismissedFlag = false;
  let barHome = null;
  let barTimer = 0;
  const BAR_RESTORE_MS = 400;

  const present = () => {
    root.dataset.dpPresented = presentedAs(kind, media.matches);
  };
  present();
  media.addEventListener('change', present);
  cleanups.push(() => media.removeEventListener('change', present));

  const hasTemplate = () => Boolean(root.querySelector('template[data-dp-tpl]'));

  /**
   * Katman DOM'unu oluşturur (bir kez): şablon klonlanır, olaylar bağlanır, form kurulur.
   *
   * @return {boolean} Hazır mı.
   */
  const build = () => {
    if (overlay) {
      return true;
    }
    const template = root.querySelector('template[data-dp-tpl]');
    if (!template) {
      return false;
    }
    root.appendChild(template.content.cloneNode(true));
    template.remove();
    overlay = root.querySelector('[data-dp-overlay]');
    surface = root.querySelector('[data-dp-surface]');
    if (!overlay || !surface) {
      overlay = null;
      return false;
    }
    titleNode = surface.querySelector('[data-dp-title]');
    handle = surface.querySelector('[data-dp-handle]');
    if (titleNode) {
      titleNode.setAttribute('autofocus', '');
    }
    bindSurface();
    if (typeof hooks.onBuild === 'function') {
      hooks.onBuild(root);
    }
    return true;
  };

  /**
   * Klavye açıkken alt bölüm kaydırma alanının sonuna (akışa) girer; kapanınca eski yerine döner.
   * Odak sırası değişmez (öğe zaten formun son öğesidir).
   *
   * @param {boolean} inFlow Akışa mı girsin.
   */
  const placeActionBar = (inFlow) => {
    const bar = surface.querySelector('.donation-panel-actionbar');
    const body = surface.querySelector('.donation-panel-surface__body');
    if (!bar || !body) {
      return;
    }
    const active = document.activeElement;
    const hadFocus = Boolean(active && bar.contains(active));
    if (inFlow && bar.parentNode !== body) {
      barHome = { parent: bar.parentNode, next: bar.nextSibling };
      body.appendChild(bar);
    } else if (!inFlow && barHome && bar.parentNode === body) {
      barHome.parent.insertBefore(bar, barHome.next && barHome.next.parentNode === barHome.parent ? barHome.next : null);
      barHome = null;
    } else {
      return;
    }
    if (hadFocus && document.activeElement !== active) {
      active.focus({ preventScroll: true }); // DOM taşıması odağı düşürür; odak sırası korunur
    }
  };

  const restoreActionBar = () => {
    const bar = surface && surface.querySelector('.donation-panel-actionbar');
    if (bar && (bar.contains(document.activeElement) || bar.matches(':active'))) {
      barTimer = window.setTimeout(restoreActionBar, BAR_RESTORE_MS);
      return;
    }
    placeActionBar(false);
  };

  const syncKeyboard = () => {
    if (!opened || !surface) {
      return;
    }
    const kb = viewport ? keyboardHeight(window.innerHeight, viewport.height, viewport.offsetTop) : 0;
    root.style.setProperty('--dp-kb', `${kb}px`);
    if (viewport) {
      root.style.setProperty('--dp-vvh', `${viewport.height}px`);
    }
    if (keyboardDismissed(keyboardWasUp, kb)) {
      keyboardDismissedFlag = true;
    }
    keyboardWasUp = kb > KEYBOARD_GONE_PX;
    const active = document.activeElement;
    const field = Boolean(active && surface.contains(active) && active.matches(TEXT_FIELD));
    const hide = shouldHideActionBar({ fieldFocused: field, keyboard: kb, coarse: coarse.matches, dismissed: keyboardDismissedFlag });
    if (hide) {
      root.setAttribute('data-dp-kb', '1');
    } else {
      root.removeAttribute('data-dp-kb');
    }
    window.clearTimeout(barTimer);
    if (hide) {
      placeActionBar(true);
    } else if (barHome) {
      // Alandan düğmeye dokunma (blur → pointerup → click) sırasında DOM taşınırsa tıklama kaybolur:
      // eski yerine dönüş kısa gecikmeyle ve odak/basış alt bölümdeyken ertelenir.
      barTimer = window.setTimeout(restoreActionBar, BAR_RESTORE_MS);
    }
    if (field && kb > 0 && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'center' });
    }
  };

  const onFieldFocus = (event) => {
    if (!(event.target instanceof Element) || !event.target.matches(TEXT_FIELD)) {
      return;
    }
    keyboardDismissedFlag = false;
    syncKeyboard();
    // Klavye animasyonu bitince alan görünür alana kaydırılır (iOS/Android sırası farklıdır).
    window.setTimeout(() => {
      if (opened && document.activeElement === event.target) {
        syncKeyboard();
        event.target.scrollIntoView({ block: 'center' });
      }
    }, 280);
  };

  const onFieldBlur = () => {
    // Odak bir sonraki alana geçiyorsa (Tab/Next) bölüm titremesin: sonraki turda ölçülür.
    window.setTimeout(syncKeyboard, 0);
  };

  const onKeydown = (event) => {
    // Üst üste açık katmanlarda yalnız en üstteki klavye olaylarını işler.
    if (!opened || !isTopmost(ownerId)) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    // Tab sırası tarayıcıdan bağımsız, açıkça yönetilir (WebKit düğmeleri atlayabilir).
    const items = focusables(surface);
    event.preventDefault();
    if (!items.length) {
      surface.focus();
      return;
    }
    const index = items.indexOf(document.activeElement);
    let next;
    if (index === -1) {
      next = event.shiftKey ? items.length - 1 : 0;
    } else {
      next = (index + (event.shiftKey ? -1 : 1) + items.length) % items.length;
    }
    items[next].focus();
  };

  const onPopState = () => {
    if (!opened || !pushed) {
      return;
    }
    if (!(window.history.state && window.history.state.dpLayer === ownerId)) {
      pushed = false;
      close();
    }
  };

  const finishClose = () => {
    closeTimer = 0;
    if (overlay && overlay.open) {
      overlay.close();
    }
    overlay.removeAttribute('open');
    // Odak dönüşü dialog kapandıktan sonra (modal açıkken arka plan inert; WebKit odağı kabul etmez).
    if (!opened) {
      trigger.focus({ preventScroll: true });
    }
    // Katman gerçekten kapandı (dialog artık modal değil): dışarıdan odak dönüşü için.
    root.dispatchEvent(new CustomEvent('dp:closed', { bubbles: true }));
  };

  const open = () => {
    if (opened || !build()) {
      return;
    }
    window.clearTimeout(closeTimer);
    closeTimer = 0;
    opened = true;
    keyboardWasUp = false;
    keyboardDismissedFlag = false;
    present();
    if (typeof overlay.showModal === 'function') {
      if (!overlay.open) {
        overlay.showModal();
      }
    } else {
      overlay.setAttribute('open', '');
    }
    // Aynı karede başlangıç durumu yerleşsin ki geçiş hemen başlasın (ilk boyamada görünür).
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    lockPage(ownerId, root, 'donation-panel-lock');
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('popstate', onPopState);
    try {
      window.history.pushState({ ...(window.history.state || {}), dpLayer: ownerId }, '');
      pushed = true;
    } catch {
      pushed = false;
    }
    if (viewport) {
      viewport.addEventListener('resize', syncKeyboard);
      viewport.addEventListener('scroll', syncKeyboard);
    }
    syncKeyboard();
    // Otomatik alan odağı yok (mobilde klavye açılmasın): odak başlığa.
    (titleNode || surface).focus({ preventScroll: true });
    root.dispatchEvent(new CustomEvent('dp:open', { bubbles: true }));
  };

  const close = () => {
    if (!opened) {
      return;
    }
    opened = false;
    overlay.classList.remove('is-open');
    surface.style.removeProperty('--dp-drag');
    root.removeAttribute('data-dp-kb');
    window.clearTimeout(barTimer);
    placeActionBar(false);
    trigger.setAttribute('aria-expanded', 'false');
    unlockPage(ownerId);
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('popstate', onPopState);
    if (viewport) {
      viewport.removeEventListener('resize', syncKeyboard);
      viewport.removeEventListener('scroll', syncKeyboard);
    }
    if (pushed) {
      pushed = false;
      if (window.history.state && window.history.state.dpLayer === ownerId) {
        window.history.back();
      }
    }
    closeTimer = window.setTimeout(finishClose, reduced.matches ? 0 : CLOSE_MS);
    root.dispatchEvent(new CustomEvent('dp:close', { bubbles: true }));
  };

  /**
   * Katman DOM'una bağlı olaylar (oluşturulduktan sonra bir kez).
   */
  function bindSurface() {
    // Esc: tarayıcının yerel kapatması yerine kendi kapatma akışımız (animasyon, odak dönüşü, geri tuşu).
    overlay.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close();
      }
    });
    surface.addEventListener('focusin', onFieldFocus);
    surface.addEventListener('focusout', onFieldBlur);
    root.querySelectorAll('[data-dp-close]').forEach((button) => {
      button.addEventListener('click', close);
    });

    if (handle) {
      let startY = null;
      let moved = 0;
      const onDown = (event) => {
        if (root.dataset.dpPresented !== 'sheet') {
          return;
        }
        startY = event.clientY;
        moved = 0;
        surface.classList.add('is-dragging');
        handle.setPointerCapture(event.pointerId);
      };
      const onMove = (event) => {
        if (startY === null) {
          return;
        }
        moved = Math.max(0, event.clientY - startY);
        surface.style.setProperty('--dp-drag', `${moved}px`);
      };
      const onUp = () => {
        if (startY === null) {
          return;
        }
        startY = null;
        surface.classList.remove('is-dragging');
        if (shouldDismissOnDrag(moved)) {
          close();
        } else {
          surface.style.removeProperty('--dp-drag');
        }
      };
      handle.addEventListener('pointerdown', onDown);
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    }
  }

  // Hazırlık: niyet belli olunca (yaklaşma/dokunma/odak) katman önceden oluşturulur; dokunuşta yalnız gösterilir.
  const warm = () => {
    if (hasTemplate()) {
      build();
    }
  };
  ['pointerenter', 'pointerdown', 'touchstart', 'focus'].forEach((name) => {
    trigger.addEventListener(name, warm, { passive: true, once: true });
  });
  const onTrigger = () => open();
  trigger.addEventListener('click', onTrigger);
  cleanups.push(() => trigger.removeEventListener('click', onTrigger));

  return {
    open,
    close,
    build,
    isOpen: () => opened,
    destroy: () => {
      close();
      cleanups.forEach((fn) => fn());
    },
  };
}
