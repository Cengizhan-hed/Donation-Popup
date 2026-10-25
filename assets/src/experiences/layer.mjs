/**
 * Katman davranışı: aç/kapa, odak tuzağı, Esc, kaydırma kilidi, sürükleyerek kapatma, klavye uyumu.
 */
import { NARROW_QUERY, presentedAs, shouldDismissOnDrag } from './store.mjs';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

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
 * @param {HTMLElement} root Kök (.dp-exp).
 * @return {{open: Function, close: Function, isOpen: Function, destroy: Function}|null} Denetleyici.
 */
export function createLayer(root) {
  const kind = root.dataset.dpKind;
  const overlay = root.querySelector('[data-dp-overlay]');
  const surface = root.querySelector('[data-dp-surface]');
  const trigger = root.querySelector('[data-dp-open]');
  if (!overlay || !surface || !trigger) {
    return null;
  }

  const media = window.matchMedia(NARROW_QUERY);
  const handle = root.querySelector('[data-dp-handle]');
  const cleanups = [];
  let opened = false;

  const present = () => {
    root.dataset.dpPresented = presentedAs(kind, media.matches);
  };
  present();
  media.addEventListener('change', present);
  cleanups.push(() => media.removeEventListener('change', present));

  const viewport = window.visualViewport;
  const fitViewport = () => {
    if (!viewport) {
      return;
    }
    const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    root.style.setProperty('--dp-kb', `${keyboard}px`);
    root.style.setProperty('--dp-vvh', `${viewport.height}px`);
    const active = document.activeElement;
    if (opened && keyboard > 0 && active && surface.contains(active) && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'center' });
    }
  };

  const onKeydown = (event) => {
    if (!opened) {
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
    const items = focusables(surface);
    if (!items.length) {
      event.preventDefault();
      surface.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === surface)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const open = () => {
    if (opened) {
      return;
    }
    opened = true;
    present();
    overlay.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('dp-lock');
    document.addEventListener('keydown', onKeydown, true);
    if (viewport) {
      viewport.addEventListener('resize', fitViewport);
      viewport.addEventListener('scroll', fitViewport);
    }
    fitViewport();
    const target = surface.querySelector('[role="radio"][tabindex="0"], input:not([type="hidden"]), button[data-dp-submit]');
    window.requestAnimationFrame(() => (target || surface).focus({ preventScroll: true }));
    root.dispatchEvent(new CustomEvent('dp:open', { bubbles: true }));
  };

  const close = () => {
    if (!opened) {
      return;
    }
    opened = false;
    overlay.classList.remove('is-open');
    surface.style.removeProperty('--dp-drag');
    trigger.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('dp-lock');
    document.removeEventListener('keydown', onKeydown, true);
    if (viewport) {
      viewport.removeEventListener('resize', fitViewport);
      viewport.removeEventListener('scroll', fitViewport);
    }
    trigger.focus({ preventScroll: true });
    root.dispatchEvent(new CustomEvent('dp:close', { bubbles: true }));
  };

  const onTrigger = () => open();
  trigger.addEventListener('click', onTrigger);
  cleanups.push(() => trigger.removeEventListener('click', onTrigger));

  const onOverlayClick = (event) => {
    if (event.target === overlay) {
      close();
    }
  };
  overlay.addEventListener('click', onOverlayClick);
  cleanups.push(() => overlay.removeEventListener('click', onOverlayClick));

  root.querySelectorAll('[data-dp-close]').forEach((button) => {
    button.addEventListener('click', close);
    cleanups.push(() => button.removeEventListener('click', close));
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
    cleanups.push(() => {
      handle.removeEventListener('pointerdown', onDown);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    });
  }

  return {
    open,
    close,
    isOpen: () => opened,
    destroy: () => {
      close();
      cleanups.forEach((fn) => fn());
    },
  };
}
