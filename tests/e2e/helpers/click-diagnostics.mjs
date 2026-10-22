/**
 * Sepete Ekle tıklamasında "istek yok" teşhisi — Playwright page.evaluate.
 */

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} button
 * @param {{ networkTail?: Array<{ method: string, url: string, status: number, action?: string }> }} [opts]
 */
export async function collectAddToCartDiagnostics(page, button, opts = {}) {
  const box = await button.boundingBox().catch(() => null);
  const diag = await page.evaluate(async (point) => {
    const btn =
      document.querySelector('button[name="donation_add_to_cart"]') ||
      document.querySelector('.wdp-modal.show button[name="donation_add_to_cart"]');
    const form = btn ? btn.closest('form') : null;
    const wrap = form ? form.querySelector('[data-wdp-sadaka-donation]') : null;

    let topAtPoint = null;
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      const el = document.elementFromPoint(point.x, point.y);
      if (el) {
        topAtPoint = {
          tag: el.tagName,
          id: el.id || '',
          className: String(el.className || '').slice(0, 120),
          outerHTML: String(el.outerHTML || '').slice(0, 300),
        };
      }
    }

    let jqEvents = null;
    try {
      if (typeof window.jQuery !== 'undefined' && btn) {
        const ev = window.jQuery._data(btn, 'events');
        jqEvents = ev ? Object.keys(ev) : [];
        const formEv = form ? window.jQuery._data(form, 'events') : null;
        jqEvents = {
          button: jqEvents,
          form: formEv ? Object.keys(formEv) : [],
        };
      }
    } catch (e) {
      jqEvents = { error: String(e.message || e) };
    }

    const WDPApp = window.WDPApp || {};
    const modules = {};
    for (const k of [
      'form',
      'formAjax',
      'formSadaka',
      'formValidate',
      'formFeedback',
      'sadakaRules',
      'lazyModal',
      'init',
      'eventManager',
      'phoneInput',
    ]) {
      modules[k] = !!(WDPApp[k] && (typeof WDPApp[k] === 'object' || typeof WDPApp[k] === 'function'));
    }

    /** Görünür alan anlık görüntüsü (name/value/validity + telefon gizlileri) */
    const fields = [];
    if (form) {
      form.querySelectorAll('input, select, textarea').forEach((inp) => {
        try {
          const style = window.getComputedStyle(inp);
          const rect = inp.getBoundingClientRect();
          const visible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width + rect.height > 0;
          const type = (inp.getAttribute('type') || inp.tagName || '').toLowerCase();
          const isHiddenType = type === 'hidden';
          const isPhoneRelated =
            type === 'tel' ||
            (inp.name && /phone/i.test(inp.name)) ||
            !!(inp.closest && inp.closest('[data-wdp-phone-field]'));
          if (!visible && !isHiddenType && !isPhoneRelated) {
            return;
          }
          let validity = null;
          try {
            if (inp.validity) {
              validity = {
                valid: !!inp.validity.valid,
                valueMissing: !!inp.validity.valueMissing,
                typeMismatch: !!inp.validity.typeMismatch,
                tooShort: !!inp.validity.tooShort,
                tooLong: !!inp.validity.tooLong,
                customError: !!inp.validity.customError,
              };
            }
          } catch (eV) {
            validity = null;
          }
          const fieldRoot = inp.closest ? inp.closest('[data-wdp-phone-field]') : null;
          fields.push({
            name: inp.getAttribute('name') || '',
            type,
            visible,
            disabled: !!inp.disabled,
            required: !!inp.required,
            value: String(inp.value || '').slice(0, 60),
            validity,
            phoneInit: fieldRoot
              ? {
                  rootInit: fieldRoot.dataset.wdpPhoneInit || '',
                  inputInit: inp.dataset.wdpPhoneInit || '',
                  country: fieldRoot.dataset.selectedCountry || fieldRoot.dataset.defaultCountry || '',
                }
              : inp.dataset.wdpPhoneInit
                ? { inputInit: inp.dataset.wdpPhoneInit }
                : null,
            normalizedPhone:
              isPhoneRelated && WDPApp.phoneInput && typeof WDPApp.phoneInput.getNormalizedValue === 'function'
                ? String(WDPApp.phoneInput.getNormalizedValue(inp) || '').slice(0, 40)
                : null,
          });
        } catch (eField) {
          /* skip */
        }
      });
    }

    const visibleErrors = [];
    if (form) {
      form.querySelectorAll('.wdp-input-error, .wdp-form-error').forEach((el) => {
        try {
          const st = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (st.display === 'none' || st.visibility === 'hidden' || r.height + r.width === 0) {
            return;
          }
          const t = String(el.textContent || '').trim();
          if (t) visibleErrors.push(t.slice(0, 200));
        } catch (eE) {
          /* skip */
        }
      });
    }

    const lastValidation =
      (WDPApp.form && WDPApp.form.lastValidation) ||
      (WDPApp.formValidate && WDPApp.formValidate.lastValidation) ||
      null;

    const ajax = window.wdp_ajax || {};
    return {
      buttonOuterHTML: btn ? String(btn.outerHTML || '').slice(0, 300) : null,
      buttonDisabled: btn ? !!btn.disabled : null,
      buttonType: btn ? btn.getAttribute('type') : null,
      topAtPoint,
      jqEvents,
      formFlags: form
        ? {
            wdpFormInitialized: form.dataset.wdpFormInitialized || '',
            wdpProcessing: form.dataset.wdpProcessing || '',
            wdpRetryingSubmit: form.dataset.wdpRetryingSubmit || '',
            hasSubmitHandler: !!form._wdpSubmitHandler,
            actionClickBound: btn ? btn.dataset.wdpActionClickBound || '' : '',
          }
        : null,
      sadakaFlags: wrap
        ? {
            className: String(wrap.className || ''),
            isOpen: wrap.classList.contains('is-open'),
            altWcId: wrap.getAttribute('data-wdp-alt-wc-product-id') || '',
            fixedPrice: wrap.getAttribute('data-wdp-alt-fixed-price') || '',
            hiddenPanel: !!(wrap.querySelector('.wdp-sadaka-donation__panel') || {}).hidden,
          }
        : null,
      modules,
      wdpAjax: !!(ajax && ajax.ajax_url),
      nonce: ajax.nonce || '',
      nonces: ajax.nonces || {},
      fields,
      lastValidation,
      visibleErrors,
    };
  }, box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null);

  return {
    ...diag,
    networkTail: opts.networkTail || [],
  };
}

/**
 * Tıklamadan önce MutationObserver kur; 2 sn sonra özet al.
 * @param {import('@playwright/test').Page} page
 */
export async function startDomMutationProbe(page) {
  await page.evaluate(() => {
    window.__wdpE2eMutations = [];
    if (window.__wdpE2eMo) {
      try {
        window.__wdpE2eMo.disconnect();
      } catch (e) {
        /* ignore */
      }
    }
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        window.__wdpE2eMutations.push({
          type: r.type,
          tag: r.target && r.target.nodeName,
          added: r.addedNodes ? r.addedNodes.length : 0,
          removed: r.removedNodes ? r.removedNodes.length : 0,
          attr: r.attributeName || '',
        });
        if (window.__wdpE2eMutations.length > 80) window.__wdpE2eMutations.shift();
      }
    });
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'disabled', 'hidden', 'aria-hidden', 'data-wdp-processing'],
    });
    window.__wdpE2eMo = mo;
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} [waitMs]
 */
export async function stopDomMutationProbe(page, waitMs = 2000) {
  await new Promise((r) => setTimeout(r, waitMs));
  return page.evaluate(() => {
    try {
      if (window.__wdpE2eMo) window.__wdpE2eMo.disconnect();
    } catch (e) {
      /* ignore */
    }
    const list = Array.isArray(window.__wdpE2eMutations) ? window.__wdpE2eMutations.slice() : [];
    const summary = {};
    for (const m of list) {
      const key = `${m.type}:${m.tag || '?'}:${m.attr || ''}`;
      summary[key] = (summary[key] || 0) + 1;
    }
    return { count: list.length, summary, sample: list.slice(0, 15) };
  });
}

/**
 * Network kaydından action çıkar (url-encoded veya multipart metin).
 * @param {string} postData
 */
export function extractPostAction(postData) {
  if (!postData) return '';
  try {
    const params = new URLSearchParams(postData);
    const a = params.get('action');
    if (a) return a;
  } catch (e) {
    /* fall through */
  }
  const multi = String(postData).match(/name="action"\r?\n\r?\n([^\r\n]+)/);
  if (multi) return multi[1].trim();
  const m = String(postData).match(/(?:^|&)action=([^&]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/**
 * Liste/popup tetikleyici tıklanamama kök nedeni (overlay, z-index, JS, lazy).
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} trigger
 */
export async function collectTriggerClickDiagnostics(page, trigger) {
  const box = await trigger.boundingBox().catch(() => null);
  return page.evaluate(async (point) => {
    const btn =
      document.querySelector('.wdp-open-modal[data-product-id]') ||
      document.querySelector('.wdp-open-modal');
    let topAtPoint = null;
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      const el = document.elementFromPoint(point.x, point.y);
      if (el) {
        const st = window.getComputedStyle(el);
        topAtPoint = {
          tag: el.tagName,
          id: el.id || '',
          className: String(el.className || '').slice(0, 160),
          zIndex: st.zIndex,
          pointerEvents: st.pointerEvents,
          isTrigger: !!(el.closest && el.closest('.wdp-open-modal')),
        };
      }
    }
    const WDPApp = window.WDPApp || {};
    const cons = [];
    const hiddenParent = btn
      ? !!btn.closest('.is-hidden, [hidden], [aria-hidden="true"]')
      : null;
    const style = btn ? window.getComputedStyle(btn) : null;
    const rect = btn ? btn.getBoundingClientRect() : null;
    return {
      hasWdpApp: !!window.WDPApp,
      eventManager: !!(WDPApp.eventManager && typeof WDPApp.eventManager === 'object'),
      lazyModal: !!(WDPApp.lazyModal && typeof WDPApp.lazyModal.ensureAndOpen === 'function'),
      triggerCount: document.querySelectorAll('.wdp-open-modal').length,
      hiddenParent,
      display: style ? style.display : null,
      visibility: style ? style.visibility : null,
      opacity: style ? style.opacity : null,
      zIndex: style ? style.zIndex : null,
      pointerEvents: style ? style.pointerEvents : null,
      rect: rect
        ? { w: Math.round(rect.width), h: Math.round(rect.height), t: Math.round(rect.top), b: Math.round(rect.bottom) }
        : null,
      topAtPoint,
      sgCombined: !!document.querySelector('script[src*="siteground"], script[src*="sg-cachepress"]'),
    };
  }, box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null);
}
