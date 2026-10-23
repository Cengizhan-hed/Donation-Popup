/**
 * @file cta-viewport.js
 * Sticky CTA keyboard safety: sync --wdp-keyboard-inset from visualViewport.
 * Dış API: WDPApp.ctaViewport
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});

  let listenersBound = false;
  let vvBound = false;
  let rafId = null;
  const observedRoots = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  function keyboardInsetPx() {
    const vv = window.visualViewport;
    if (!vv) {
      return 0;
    }
    const overlap = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    return overlap > 40 ? Math.round(overlap) : 0;
  }

  function readEnvSafe(side) {
    const prop = side === 'top' ? 'padding-top' : 'padding-bottom';
    const envName = side === 'top' ? 'safe-area-inset-top' : 'safe-area-inset-bottom';
    try {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;' + prop + ':env(' + envName + ',0px)';
      document.documentElement.appendChild(probe);
      const px = parseFloat(window.getComputedStyle(probe)[side === 'top' ? 'paddingTop' : 'paddingBottom']) || 0;
      probe.parentNode.removeChild(probe);
      return px;
    } catch (e) {
      return 0;
    }
  }

  function isIphoneLike() {
    const nav = window.navigator || {};
    const ua = String(nav.userAgent || '');
    if (/iPhone|iPod/.test(ua)) {
      return true;
    }
    return nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1;
  }

  /**
   * viewport-fit=cover olmasa da iPhone home indicator için taban boşluk.
   * env() 0 ise 34px taban; gerçek env varsa onu kullanır. Tema seçicisi yok.
   * --wdp-safe-top yalnız üst kenara yapışık (flush) kabukta; kapat düğmesi
   * başlık satırındadır ve form kutusuna binmez (içerik zaten padding alır).
   */
  function applySafeBottom() {
    const envBottom = readEnvSafe('bottom');
    const envTop = readEnvSafe('top');
    const floorBottom = (isIphoneLike() && envBottom < 20) ? 34 : 0;
    document.documentElement.style.setProperty('--wdp-safe-bottom', Math.max(envBottom, floorBottom) + 'px');
    document.documentElement.style.setProperty('--wdp-safe-top', '0px');
    document.querySelectorAll('.hdf-donation-modal-wrapper.wdp-modal.show, .wdp-donation-form').forEach((root) => {
      const content = root.querySelector('.wdp-modal-content') || root;
      const top = content.getBoundingClientRect().top;
      const flush = top <= 2;
      root.classList.toggle('wdp-flush-top', flush);
      if (flush) {
        root.style.setProperty('--wdp-safe-top', Math.max(envTop, 0) + 'px');
      } else {
        root.style.removeProperty('--wdp-safe-top');
      }
    });
  }

  function roots() {
    return document.querySelectorAll('.hdf-donation-modal-wrapper.wdp-modal.show, .wdp-donation-form');
  }

  /**
   * Sticky overlay + spacer only when a body actually scrolls.
   * Short forms keep the bar in flow (design gap = flex gap + CTA padding).
   */
  function applyCtaClearance() {
    roots().forEach((root) => {
      const cta = root.querySelector('.wdp-form-cta-zone, .wdp-side-panel-footer-zone');
      if (!cta) {
        root.style.removeProperty('--wdp-cta-clearance');
        return;
      }
      cta.classList.remove('wdp-cta-overlays');
      root.style.setProperty('--wdp-cta-clearance', '0px');
      void cta.offsetHeight;

      const scrollers = root.querySelectorAll(
        '.wdp-side-panel-main, .wdp-donation-form-fields, .wdp-shareholders-scroll'
      );
      let overflowing = false;
      for (let i = 0; i < scrollers.length; i++) {
        if (scrollers[i].scrollHeight > scrollers[i].clientHeight + 1) {
          overflowing = true;
          break;
        }
      }
      if (!overflowing) {
        return;
      }

      cta.classList.add('wdp-cta-overlays');
      void cta.offsetHeight;

      const ctaBox = cta.getBoundingClientRect();
      const height = Math.ceil(ctaBox.height);
      if (height < 1) {
        return;
      }
      const pos = window.getComputedStyle(cta).position;
      if (pos !== 'sticky' && pos !== 'fixed') {
        return;
      }

      let need = 0;
      for (let j = 0; j < scrollers.length; j++) {
        const el = scrollers[j];
        if (el.scrollHeight <= el.clientHeight + 1) {
          continue;
        }
        const r = el.getBoundingClientRect();
        const overlaps =
          ctaBox.top < r.bottom - 2 &&
          ctaBox.bottom > r.top + 2 &&
          ctaBox.left < r.right - 2 &&
          ctaBox.right > r.left + 2;
        if (!overlaps) {
          continue;
        }
        const overlap = Math.ceil(r.bottom - ctaBox.top);
        if (overlap > need) {
          need = overlap;
        }
      }
      if (need < 2) {
        return;
      }
      root.style.setProperty('--wdp-cta-clearance', Math.min(height, need) + 'px');
    });
  }

  function observeOpenRoots() {
    roots().forEach((root) => {
      if (observedRoots) {
        if (observedRoots.has(root)) {
          return;
        }
        observedRoots.add(root);
      }
      const obs = new MutationObserver(scheduleApply);
      obs.observe(root, { childList: true, subtree: true });
    });
  }

  function applyInset() {
    applySafeBottom();
    applyCtaClearance();
    observeOpenRoots();
    const inset = keyboardInsetPx();
    const value = inset + 'px';
    roots().forEach((root) => {
      if (inset > 0) {
        root.style.setProperty('--wdp-keyboard-inset', value);
        root.classList.add('wdp-keyboard-open');
      } else {
        root.style.removeProperty('--wdp-keyboard-inset');
        root.classList.remove('wdp-keyboard-open');
      }
    });
    if (inset === 0) {
      document.querySelectorAll('.hdf-donation-modal-wrapper, .wdp-donation-form').forEach((root) => {
        root.style.removeProperty('--wdp-keyboard-inset');
        root.classList.remove('wdp-keyboard-open');
      });
    }
  }

  function scheduleApply() {
    if (rafId !== null) {
      return;
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      applyInset();
    });
  }

  function bindVisualViewport() {
    if (vvBound || !window.visualViewport) {
      return;
    }
    vvBound = true;
    window.visualViewport.addEventListener('resize', scheduleApply, { passive: true });
    window.visualViewport.addEventListener('scroll', scheduleApply, { passive: true });
  }

  function onFocusIn(e) {
    const target = e && e.target;
    if (!target || !target.closest) {
      return;
    }
    if (!target.closest('.wdp-modal, .wdp-donation-form')) {
      return;
    }
    const tag = target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      return;
    }
    bindVisualViewport();
    scheduleApply();
  }

  function onFocusOut() {
    window.setTimeout(scheduleApply, 90);
  }

  function init() {
    if (listenersBound) {
      return;
    }
    listenersBound = true;
    bindVisualViewport();
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('orientationchange', scheduleApply, { passive: true });
    document.addEventListener('wdp:form:open', scheduleApply);
    scheduleApply();
  }

  WDPApp.ctaViewport = {
    init: init,
    refresh: applyInset,
    applySafeBottom: applySafeBottom,
    applyCtaClearance: applyCtaClearance,
  };
})(window);
