/**
 * @file cta-ready.js
 * CTA (Sepete Ekle / Ödemeye Git) form JS hazır olana dek kuyruk + kilit.
 * Erken dokunuş sessiz yutulmaz: ya bekler (kuyruk) ya da görünür yükleniyor.
 * Kuyruk asla yerel form gönderimi (belge POST/GET) yapmaz;
 * hazır olunca aynı _wdpSubmitHandler bir kez çağrılır.
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
    return !!(form && typeof form._wdpSubmitHandler === 'function');
  }

  function isFormProcessing(form) {
    return !!(form && form.dataset && form.dataset.wdpProcessing === '1');
  }

  function makeSyntheticSubmitEvent(form, submitter) {
    return {
      type: 'submit',
      target: form,
      currentTarget: form,
      submitter: submitter || (form && form._wdpLastClickSubmitter) || null,
      defaultPrevented: true,
      preventDefault: function preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation: function stopPropagation() {},
      stopImmediatePropagation: function stopImmediatePropagation() {},
    };
  }

  /**
   * Eklentinin kendi gönderim yolu — native belge gönderimi / click yok.
   * Tıklama başına en fazla bir çağrı (işlem sürerken kilit).
   */
  function invokePluginSubmit(form, submitter) {
    if (!form || typeof form._wdpSubmitHandler !== 'function') {
      return false;
    }
    if (form._wdpCtaInFlight) {
      if (isFormProcessing(form)) {
        return false;
      }
      form._wdpCtaInFlight = false;
    }
    if (form._wdpCtaInFlight) {
      return false;
    }
    form._wdpCtaInFlight = true;
    if (submitter) {
      form._wdpLastClickSubmitter = submitter;
    }
    const ev = makeSyntheticSubmitEvent(form, submitter);
    try {
      form._wdpSubmitHandler.call(form, ev);
    } catch (err) {
      form._wdpCtaInFlight = false;
      throw err;
    }
    if (!isFormProcessing(form)) {
      form._wdpCtaInFlight = false;
    }
    return true;
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
    if (isFormReady(form)) {
      return;
    }
    if (form._wdpQueuedSubmitter) {
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
    if (!isFormReady(form)) {
      return false;
    }
    const queued = form._wdpQueuedSubmitter;
    form._wdpQueuedSubmitter = null;
    return invokePluginSubmit(form, queued);
  }

  function showSetupFailed(form) {
    const msg = WDPApp.i18n.__('The form is not ready yet. Please wait a few seconds and try again.', 'woo-donation-popup');
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
      invokePluginSubmit(form, btn);
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
    invokePluginSubmit: invokePluginSubmit,
    waitForFormReady: waitForFormReady,
    showSetupFailed: showSetupFailed,
    CTA_SEL: CTA_SEL,
    MAX_WAIT_MS: MAX_WAIT_MS,
  };
})(window);
