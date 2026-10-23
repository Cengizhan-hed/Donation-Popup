/**
 * @file cta-ready.js
 * CTA (Sepete Ekle / Ödemeye Git) form JS hazır olana dek kuyruk + kilit.
 * Erken dokunuş sessiz yutulmaz: ya bekler (kuyruk) ya da görünür yükleniyor.
 * Dış API: WDPApp.formCtaReady
 */

(function (window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  if (WDPApp.formCtaReady && WDPApp.formCtaReady.MAX_WAIT_MS) {
    return;
  }

  const CTA_SEL = 'button[name="donation_add_to_cart"], button[name="donation_go_checkout"]';
  const MAX_WAIT_MS = 5000;
  const TICK_MS = 100;

  function isFormReady(form) {
    return !!(form && form._wdpSubmitHandler);
  }

  function markFormReady(form) {
    if (!form) {
      return;
    }
    if (form.dataset) {
      form.dataset.wdpFormReady = '1';
    }
    const buttons = form.querySelectorAll(CTA_SEL);
    for (let i = 0; i < buttons.length; i += 1) {
      const btn = buttons[i];
      if (btn.getAttribute('data-wdp-await-js') !== '1') {
        continue;
      }
      if (btn.dataset && btn.dataset.wdpSkeletonLock != null) {
        continue;
      }
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('data-wdp-await-js');
      btn.classList.remove('wdp-cta-await-js');
      btn.classList.remove('wdp-loading');
      const gate = btn.closest ? btn.closest('.wdp-cta-gate') : null;
      if (gate && gate.classList) {
        gate.classList.add('is-ready');
      }
    }
  }

  function queueCta(form, submitter) {
    if (!form) {
      return;
    }
    form._wdpQueuedSubmitter = submitter || form._wdpLastClickSubmitter || null;
    const btn = form._wdpQueuedSubmitter;
    if (btn && btn.classList) {
      btn.classList.add('wdp-loading');
    }
  }

  function flushQueuedCta(form) {
    if (!form || !form._wdpQueuedSubmitter) {
      return false;
    }
    const queued = form._wdpQueuedSubmitter;
    form._wdpQueuedSubmitter = null;
    if (typeof form.requestSubmit === 'function') {
      if (queued && queued.form === form) {
        form.requestSubmit(queued);
      } else {
        form.requestSubmit();
      }
    } else if (queued && typeof queued.click === 'function') {
      queued.click();
    }
    return true;
  }

  function showSetupFailed(form) {
    const msg = 'Form henüz yüklenemedi. Lütfen birkaç saniye bekleyip tekrar deneyin.';
    if (form && WDPApp.formFeedback && typeof WDPApp.formFeedback.showFormError === 'function') {
      WDPApp.formFeedback.showFormError(form, msg);
      return;
    }
    const errorMsg = form && form.querySelector ? form.querySelector('.wdp-form-error') : null;
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.style.display = 'block';
      errorMsg.setAttribute('role', 'alert');
    }
  }

  function waitForFormReady(form, onReady, onTimeout) {
    if (isFormReady(form)) {
      if (typeof onReady === 'function') {
        onReady();
      }
      return;
    }
    const started = Date.now();
    function tick() {
      if (WDPApp.form && typeof WDPApp.form.setup === 'function' && form && !form._wdpSubmitHandler) {
        WDPApp.form.setup(form);
      }
      if (isFormReady(form)) {
        if (typeof onReady === 'function') {
          onReady();
        }
        return;
      }
      if (Date.now() - started >= MAX_WAIT_MS) {
        if (typeof onTimeout === 'function') {
          onTimeout();
        } else {
          showSetupFailed(form);
        }
        return;
      }
      setTimeout(tick, TICK_MS);
    }
    setTimeout(tick, TICK_MS);
  }

  function onGateClick(e) {
    const t = e.target;
    const hit = t && t.closest ? t.closest('.wdp-cta-gate__hit') : null;
    if (!hit) {
      return;
    }
    const form = hit.closest ? hit.closest('form') : null;
    const gate = hit.closest ? hit.closest('.wdp-cta-gate') : null;
    const btn = gate && gate.querySelector ? gate.querySelector(CTA_SEL) : null;
    if (!form) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (isFormReady(form) && (!btn || btn.dataset.wdpSkeletonLock == null)) {
      markFormReady(form);
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit(btn && btn.form === form ? btn : undefined);
      } else if (btn && typeof btn.click === 'function') {
        btn.disabled = false;
        btn.click();
      }
      return;
    }
    queueCta(form, btn);
    waitForFormReady(
      form,
      function onReady() {
        markFormReady(form);
        flushQueuedCta(form);
      },
      function onTimeout() {
        showSetupFailed(form);
      }
    );
  }

  if (document && typeof document.addEventListener === 'function') {
    document.addEventListener('click', onGateClick, true);
  }

  WDPApp.formCtaReady = {
    isFormReady: isFormReady,
    markFormReady: markFormReady,
    queueCta: queueCta,
    flushQueuedCta: flushQueuedCta,
    waitForFormReady: waitForFormReady,
    showSetupFailed: showSetupFailed,
    CTA_SEL: CTA_SEL,
    MAX_WAIT_MS: MAX_WAIT_MS,
  };
})(window);
