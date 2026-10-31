/**
 * Katman davranışı: HTML <dialog> (showModal, üst katman), ihtiyaçta oluşturma, odak, Esc/geri tuşu,
 * kaydırma kilidi, sürükleyerek kapatma ve mobil klavye uyumu.
 *
 * Katman HTML'i sayfada canlı DOM'da değil, inert bir <template data-dp-tpl> içindedir (CLS 0); düğmeye
 * yaklaşılınca/dokunulunca ya da ilk açılışta <dialog> olarak oluşturulur ve form bağlanır.
 */
import { NARROW_QUERY, presentedAs, shouldDismissOnDrag } from './store.mjs';
import { KEYBOARD_MIN_PX, TEXT_FIELD, keyboardShrink, nextKeyboardUp, shouldHideActionBar } from './keyboard.mjs';
import { isTopmost, lockPage, measureScrollbar, unlockPage } from '../ui2-shared/scroll-lock.mjs';

let layerSeq = 0;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Kapanış animasyonu süresi (ms; CSS --dp-dur-base ile aynı, yarıda kesilmesin); azaltılmış harekette 0. */
const CLOSE_MS = 260;

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
  let keyboardUp = false;
  let keyboardDismissedFlag = false;
  let fieldFocused = false;
  let baseline = 0;
  let baselineWidth = 0;
  let geoFrame = 0;
  let openFrame = 0;
  let settleTimer = 0;
  let blurTimer = 0;
  let revealTimer = 0;
  let revealTarget = null;
  let barHidden = false;
  const SETTLE_MS = 100; // resize debounce
  const BLUR_GRACE_MS = 250; // alandan alana geçişte klavye durumu korunur
  const REVEAL_WARM_MS = 150; // klavye zaten açık
  const REVEAL_COLD_MS = 450; // klavye açılış animasyonu için yedek zamanlayıcı (resize gelmezse)

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
   * Yerleşim değişkenleri (kare başına en çok bir kez): görsel görünüm yüksekliği ve altta kalan boşluk.
   * Yalnız geometri; klavye "açık/kapalı" kararına GİRMEZ (geri besleme döngüsü olmasın).
   */
  const applyGeometry = () => {
    geoFrame = 0;
    if (!opened || !surface || !viewport) {
      return;
    }
    const below = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
    const kb = `${below}px`;
    const vvh = `${Math.round(viewport.height)}px`;
    // Yalnız değiştiyse yaz (aynı değer de stil geçersizlemesi doğurur; ağır temada kare başına ek hesap).
    if (root.style.getPropertyValue('--dp-kb') !== kb) {
      root.style.setProperty('--dp-kb', kb);
    }
    if (root.style.getPropertyValue('--dp-vvh') !== vvh) {
      root.style.setProperty('--dp-vvh', vvh);
    }
  };

  const scheduleGeometry = () => {
    if (!geoFrame) {
      geoFrame = window.requestAnimationFrame(applyGeometry);
    }
  };

  /** Klavyesiz kararlı yükseklik: iOS'ta innerHeight değişmez, Chrome Android'de küçülür; en büyük değer tutulur. */
  const updateBaseline = () => {
    const height = window.innerHeight; // clientHeight okumak açılışta zorunlu düzen hesabı tetikler (açılış ms bütçesi)
    if (!baseline || window.innerWidth !== baselineWidth || (!keyboardUp && height > baseline)) {
      baseline = height;
      baselineWidth = window.innerWidth;
    }
  };

  const isTextField = (el) => Boolean(el && el instanceof Element && surface && surface.contains(el) && el.matches(TEXT_FIELD));

  /** Odaktaki alanı en çok bir kez, klavye yerleştikten sonra görünür yapar. */
  const reveal = () => {
    window.clearTimeout(revealTimer);
    revealTimer = 0;
    const target = revealTarget;
    revealTarget = null;
    if (opened && target && document.activeElement === target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'nearest' });
    }
  };

  /** Alt bölümü yerinde gizler/gösterir (yalnız durum değişince yazar; opacity + inert). */
  const setBarHidden = (hide) => {
    if (hide === barHidden) {
      return;
    }
    barHidden = hide;
    if (hide) {
      root.setAttribute('data-dp-kb', '1');
    } else {
      root.removeAttribute('data-dp-kb');
    }
    const bar = surface.querySelector('.donation-panel-actionbar');
    if (bar) {
      bar.toggleAttribute('inert', hide); // gizliyken odak/dokunma almaz
    }
  };

  /**
   * Klavye durumu (histerezisli) + alt bölümün gizlenmesi/görünmesi: tek yerde, tek karede.
   *
   * @param {boolean} measured Gerçek ölçümden mi (resize sonrası) çağrıldı.
   */
  const syncKeyboard = (measured = false) => {
    if (!opened || !surface) {
      return;
    }
    updateBaseline();
    if (viewport) {
      const wasUp = keyboardUp;
      keyboardUp = nextKeyboardUp(wasUp, keyboardShrink(baseline, viewport.height));
      if (wasUp && !keyboardUp) {
        keyboardDismissedFlag = true; // klavye kapandı, alan odakta (Android geri hareketi)
      }
    }
    // Alan odağı bırakılsa da klavye gerçekten kapanana (resize) dek gizli kalır: görünür alan hâlâ küçükken alt bölümün
    // akışa dönmesi taşma ve sıçrama yaratır (iPhone SE).
    const hide =
      (keyboardUp && !fieldFocused) ||
      shouldHideActionBar({
        fieldFocused,
        keyboard: keyboardUp ? KEYBOARD_MIN_PX : 0,
        coarse: coarse.matches,
        dismissed: keyboardDismissedFlag,
      });
    // Tek seferlik durum değişimi: alt bölüm yerinde kalır, yalnız opacity ile gizlenir/görünür (konum/boyut geçişi yok).
    setBarHidden(hide);
    if (measured && keyboardUp && revealTarget) {
      reveal(); // klavye yerleşti: tek kaydırma
    }
  };

  /** resize olayı: geometri hemen (kare başına), karar ~100 ms sakinleşince (debounce). */
  const onViewportResize = () => {
    scheduleGeometry();
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => syncKeyboard(true), SETTLE_MS);
  };

  const onFieldFocus = (event) => {
    if (!isTextField(event.target)) {
      return;
    }
    window.clearTimeout(blurTimer);
    fieldFocused = true;
    keyboardDismissedFlag = false;
    // Ön-klavye durumu: ilk odakta resize olayı geç gelir; alt çubuk hemen akışa girer, alan örtülmez.
    syncKeyboard();
    revealTarget = event.target;
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(reveal, keyboardUp ? REVEAL_WARM_MS : REVEAL_COLD_MS);
  };

  const onFieldBlur = () => {
    // Alandan alana geçişte (Tab/dokunma) durum korunur: blur sonrası kısa süre içinde başka alana odak gelmezse kapanır.
    window.clearTimeout(blurTimer);
    blurTimer = window.setTimeout(() => {
      if (!opened || isTextField(document.activeElement)) {
        return;
      }
      fieldFocused = false;
      revealTarget = null;
      syncKeyboard();
    }, BLUR_GRACE_MS);
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

  /**
   * Açılıştan sonraki ilk karede (rAF; boyamadan önce, tıklama işleyicisinin dışında): klavyesiz taban yükseklik,
   * görsel görünüm geometrisi ve klavye durumu. Okumalar burada toplanır; tıklama işleyicisinde düzen okuması yok.
   */
  const afterOpenFrame = () => {
    openFrame = 0;
    if (!opened) {
      return;
    }
    // Önce okumalar (açılışta klavye kapalı: syncKeyboard yazmaz), sonra geometri yazımı — karede zorunlu hesap yok.
    updateBaseline();
    syncKeyboard();
    applyGeometry();
  };

  const openNow = () => {
    if (opened || !build()) {
      return;
    }
    window.clearTimeout(closeTimer);
    const reopening = Boolean(closeTimer) || Boolean(overlay.open); // kapanış animasyonu sürerken: diyalog zaten açık
    closeTimer = 0;
    opened = true;
    keyboardUp = false;
    keyboardDismissedFlag = false;
    fieldFocused = false;
    baseline = 0;
    // Tüm DOM yazmaları showModal'dan ÖNCE ve tek seferde: zorunlu stil/düzen hesabı yalnız showModal'ın kendi odak
    // adımında bir kez yapılır (ağır tema CSS'inde her ek zorunlu hesap onlarca ms). Tıklama işleyicisinde okuma yok.
    present();
    // Geometri (--dp-kb / --dp-vvh) ilk karede, boyamadan önce ve yalnız değiştiyse yazılır (afterOpenFrame).
    trigger.setAttribute('aria-expanded', 'true');
    // Yerel kipli diyalogda arka plan inert'i tarayıcıdadır (öznitelik yazmak tüm alt ağaçların stilini yeniden hesaplatır).
    lockPage(ownerId, root, 'donation-panel-lock', { native: typeof overlay.showModal === 'function' });
    // @starting-style destekleniyorsa açılış geçişi CSS'ten başlar: `is-open` gösterimden önce eklenir; katman ilk
    // karesinden görünür (visibility) olduğundan showModal'ın odak adımı başlığa (autofocus) odaklanır. Desteklemeyen
    // tarayıcıda eski yol: göster → başlangıç durumunu yerleştir (tek düzen okuması) → `is-open`.
    const startingStyle = !reopening && typeof window.CSSStartingStyleRule !== 'undefined';
    if (startingStyle) {
      overlay.classList.add('is-open');
    }
    if (typeof overlay.showModal === 'function') {
      if (!overlay.open) {
        overlay.showModal();
      }
    } else {
      overlay.setAttribute('open', '');
    }
    if (!startingStyle) {
      void overlay.offsetWidth;
      overlay.classList.add('is-open');
    }
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('popstate', onPopState);
    try {
      window.history.pushState({ ...(window.history.state || {}), dpLayer: ownerId }, '');
      pushed = true;
    } catch {
      pushed = false;
    }
    if (viewport) {
      viewport.addEventListener('resize', onViewportResize);
      viewport.addEventListener('scroll', scheduleGeometry);
    }
    window.cancelAnimationFrame(openFrame);
    openFrame = window.requestAnimationFrame(afterOpenFrame);
    // Otomatik alan odağı yok (mobilde klavye açılmasın): odak başlığa. showModal başlığa (autofocus) zaten odaklandıysa
    // yeniden çağrılmaz (ek stil hesabı yok); odak kaydırması yok (preventScroll).
    const focusStart = () => (titleNode || surface).focus({ preventScroll: true });
    if (!overlay.contains(document.activeElement)) {
      focusStart();
    }
    if (!overlay.contains(document.activeElement)) {
      // Açılış karesinde katman hâlâ visibility:hidden ise (stil/geçiş yerleşmedi; sayfa yeni yüklendiyse sık) focus()
      // sessizce düşer ve modal tuzak odağı dışarıda bırakır: görünür olana dek (en çok ~30 kare) yeniden dene.
      let tries = 0;
      const retry = () => {
        if (!opened || !overlay || overlay.contains(document.activeElement) || tries >= 30) {
          return;
        }
        tries += 1;
        focusStart();
        window.requestAnimationFrame(retry);
      };
      window.requestAnimationFrame(retry);
    }
    root.dispatchEvent(new CustomEvent('dp:open', { bubbles: true }));
  };

  // Stil beklemesi yok (CLAUDE.md §25): katman CSS'i çıktının önünde satır içi gelir; panel her koşulda anında açılır.
  const open = openNow;

  const close = () => {
    if (!opened) {
      return;
    }
    opened = false;
    overlay.classList.remove('is-open');
    surface.style.removeProperty('--dp-drag');
    root.removeAttribute('data-dp-kb');
    barHidden = false;
    const closingBar = surface && surface.querySelector('.donation-panel-actionbar');
    if (closingBar) {
      closingBar.removeAttribute('inert');
    }
    trigger.setAttribute('aria-expanded', 'false');
    unlockPage(ownerId);
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('popstate', onPopState);
    if (viewport) {
      viewport.removeEventListener('resize', onViewportResize);
      viewport.removeEventListener('scroll', scheduleGeometry);
    }
    [settleTimer, blurTimer, revealTimer].forEach((t) => window.clearTimeout(t));
    if (geoFrame) {
      window.cancelAnimationFrame(geoFrame);
      geoFrame = 0;
    }
    if (openFrame) {
      window.cancelAnimationFrame(openFrame);
      openFrame = 0;
    }
    revealTarget = null;
    fieldFocused = false;
    keyboardUp = false;
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
    // overflow: clip desteklemeyen tarayıcı: odak kaydırması katmanı yana kaydırırsa sıfırla (panel yerinde kalsın).
    overlay.addEventListener(
      'scroll',
      () => {
        if (overlay.scrollLeft || overlay.scrollTop) {
          overlay.scrollLeft = 0;
          overlay.scrollTop = 0;
        }
      },
      { passive: true }
    );
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
  // Kaydırma çubuğu da burada ölçülür (düzen hesaplı; açılış tıklamasında okuma olmasın).
  const warm = () => {
    measureScrollbar();
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
    warm,
    isOpen: () => opened,
    destroy: () => {
      close();
      cleanups.forEach((fn) => fn());
    },
  };
}
