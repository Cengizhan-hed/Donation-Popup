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

  function keyboardInsetPx() {
    const vv = window.visualViewport;
    if (!vv) {
      return 0;
    }
    const overlap = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    return overlap > 40 ? Math.round(overlap) : 0;
  }

  function roots() {
    return document.querySelectorAll('.hdf-donation-modal-wrapper.wdp-modal.show, .wdp-donation-form');
  }

  function applyInset() {
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
    scheduleApply();
  }

  WDPApp.ctaViewport = {
    init: init,
    refresh: applyInset,
  };
})(window);
