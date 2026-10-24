/**
 * Sayfa içi E2E probe — event/fetch/XHR/listener + WDPApp validate izleme.
 * Eklenti davranışını değiştirmez; yalnızca gözlemler.
 */

const INIT_SCRIPT = `(() => {
  if (window.__wdpE2EInstalled) return;
  window.__wdpE2EInstalled = true;
  window.__wdpE2E = [];
  window.__wdpE2EListeners = [];
  window.__wdpE2EXhr = [];
  window.__wdpE2EValidation = [];

  const MAX = 400;
  function push(rec) {
    try {
      rec.t = performance.now();
      window.__wdpE2E.push(rec);
      if (window.__wdpE2E.length > MAX) window.__wdpE2E.shift();
    } catch (e) {}
  }
  function shortStack(err, n) {
    try {
      const lines = String((err && err.stack) || '').split('\\n').slice(0, n || 8);
      return lines.map((l) => l.trim()).filter(Boolean);
    } catch (e) {
      return [];
    }
  }
  function describeTarget(el) {
    if (!el || !el.tagName) return String(el);
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.')
      : '';
    const name = el.getAttribute && el.getAttribute('name') ? '[name=' + el.getAttribute('name') + ']' : '';
    return (tag + id + cls + name).slice(0, 160);
  }
  function extractActionFromBody(body) {
    try {
      if (!body) return { action: '', addon: {} };
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        const addon = {};
        let action = '';
        for (const [k, v] of body.entries()) {
          if (k === 'action') action = String(v);
          if (String(k).indexOf('sadaka_') === 0) addon[k] = String(v);
        }
        return { action, addon };
      }
      if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
        const addon = {};
        for (const [k, v] of body.entries()) {
          if (String(k).indexOf('sadaka_') === 0) addon[k] = String(v);
        }
        return { action: body.get('action') || '', addon };
      }
      const s = typeof body === 'string' ? body : '';
      if (!s) return { action: '', addon: {} };
      const params = new URLSearchParams(s);
      const addon = {};
      for (const [k, v] of params.entries()) {
        if (String(k).indexOf('sadaka_') === 0) addon[k] = String(v);
      }
      return { action: params.get('action') || '', addon };
    } catch (e) {
      return { action: '', addon: {} };
    }
  }

  // --- preventDefault / stopPropagation / stopImmediatePropagation ---
  const origPD = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function() {
    try {
      const type = this && this.type;
      if (type === 'click' || type === 'submit') {
        push({
          kind: 'preventDefault',
          type,
          target: describeTarget(this.target),
          currentTarget: describeTarget(this.currentTarget),
          stack: shortStack(new Error('pd'), 8),
        });
      }
    } catch (e) {}
    return origPD.apply(this, arguments);
  };
  const origSP = Event.prototype.stopPropagation;
  Event.prototype.stopPropagation = function() {
    try {
      const type = this && this.type;
      if (type === 'click' || type === 'submit') {
        push({
          kind: 'stopPropagation',
          type,
          target: describeTarget(this.target),
          currentTarget: describeTarget(this.currentTarget),
          stack: shortStack(new Error('sp'), 8),
        });
      }
    } catch (e) {}
    return origSP.apply(this, arguments);
  };
  const origSIP = Event.prototype.stopImmediatePropagation;
  Event.prototype.stopImmediatePropagation = function() {
    try {
      const type = this && this.type;
      if (type === 'click' || type === 'submit') {
        push({
          kind: 'stopImmediatePropagation',
          type,
          target: describeTarget(this.target),
          currentTarget: describeTarget(this.currentTarget),
          stack: shortStack(new Error('sip'), 8),
        });
      }
    } catch (e) {}
    return origSIP.apply(this, arguments);
  };

  // --- capture + bubble listeners on window/document ---
  const TYPES = ['pointerdown', 'mousedown', 'mouseup', 'click', 'submit'];
  function phaseName(p) {
    return p === 1 ? 'CAPTURE' : p === 2 ? 'TARGET' : p === 3 ? 'BUBBLE' : String(p);
  }
  function onEv(e) {
    try {
      push({
        kind: 'event',
        type: e.type,
        phase: phaseName(e.eventPhase),
        target: describeTarget(e.target),
        currentTarget: describeTarget(e.currentTarget),
        defaultPrevented: !!e.defaultPrevented,
      });
    } catch (err) {}
  }
  for (const t of TYPES) {
    window.addEventListener(t, onEv, true);
    window.addEventListener(t, onEv, false);
    document.addEventListener(t, onEv, true);
    document.addEventListener(t, onEv, false);
  }

  // --- addEventListener wrap ---
  const origAEL = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    try {
      if (type === 'click' || type === 'submit') {
        const el = this;
        const isForm = el && el.tagName === 'FORM';
        const isBtn = el && el.tagName === 'BUTTON';
        const isDoc = el === document || el === window;
        if (isForm || isBtn || isDoc) {
          const stack = shortStack(new Error('ael'), 4);
          window.__wdpE2EListeners.push({
            t: performance.now(),
            type,
            target: describeTarget(el),
            capture: !!(options === true || (options && options.capture)),
            stackFirst: stack[1] || stack[0] || '',
          });
          if (window.__wdpE2EListeners.length > 200) window.__wdpE2EListeners.shift();
        }
      }
    } catch (e) {}
    return origAEL.apply(this, arguments);
  };

  // --- fetch ---
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function(input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const method = (init && init.method) || (input && input.method) || 'GET';
        const body = init && init.body;
        const parsed = extractActionFromBody(body);
        window.__wdpE2EXhr.push({
          t: performance.now(),
          via: 'fetch',
          method: String(method).toUpperCase(),
          url: String(url).slice(0, 200),
          action: parsed.action,
          addon: parsed.addon,
          stack: shortStack(new Error('fetch'), 3),
        });
        if (window.__wdpE2EXhr.length > 200) window.__wdpE2EXhr.shift();
        push({
          kind: 'fetch',
          method: String(method).toUpperCase(),
          url: String(url).slice(0, 160),
          action: parsed.action,
        });
      } catch (e) {}
      return origFetch.apply(this, arguments);
    };
  }

  // --- XHR ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__wdpE2E = { method: String(method || 'GET').toUpperCase(), url: String(url || '') };
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    try {
      const meta = this.__wdpE2E || {};
      const parsed = extractActionFromBody(body);
      window.__wdpE2EXhr.push({
        t: performance.now(),
        via: 'xhr',
        method: meta.method || 'GET',
        url: String(meta.url || '').slice(0, 200),
        action: parsed.action,
        addon: parsed.addon,
        stack: shortStack(new Error('xhr'), 3),
      });
      if (window.__wdpE2EXhr.length > 200) window.__wdpE2EXhr.shift();
      push({
        kind: 'xhr',
        method: meta.method || 'GET',
        url: String(meta.url || '').slice(0, 160),
        action: parsed.action,
      });
    } catch (e) {}
    return origSend.apply(this, arguments);
  };
})();`;

/**
 * Context/page oluşur oluşmaz çağır (goto öncesi).
 * @param {import('@playwright/test').Page|import('@playwright/test').BrowserContext} target
 */
export async function installPageProbe(target) {
  await target.addInitScript(INIT_SCRIPT);
}

/**
 * WDPApp form validate / addon / submit sarmala (davranış değişmez).
 * @param {import('@playwright/test').Page} page
 */
export async function wrapWdpValidationHooks(page) {
  await page
    .evaluate(() => {
      try {
        const WDPApp = window.WDPApp;
        if (!WDPApp) return;
        window.__wdpE2EValidation = window.__wdpE2EValidation || [];
        function log(rec) {
          rec.t = performance.now();
          window.__wdpE2EValidation.push(rec);
          if (window.__wdpE2EValidation.length > 100) window.__wdpE2EValidation.shift();
        }
        function wrapFn(obj, key, label) {
          if (!obj || typeof obj[key] !== 'function' || obj[key].__wdpE2EWrapped) return;
          const orig = obj[key];
          const wrapped = function () {
            const t0 = performance.now();
            let result;
            let err = null;
            try {
              result = orig.apply(this, arguments);
            } catch (e) {
              err = String(e && e.message ? e.message : e);
              throw e;
            } finally {
              const lastVal =
                (window.WDPApp &&
                  window.WDPApp.form &&
                  window.WDPApp.form.lastValidation) ||
                (window.WDPApp &&
                  window.WDPApp.formValidate &&
                  window.WDPApp.formValidate.lastValidation) ||
                null;
              log({
                label,
                ms: performance.now() - t0,
                result:
                  typeof result === 'boolean'
                    ? result
                    : result && typeof result === 'object'
                      ? {
                          ok: result.ok,
                          reason: result.reason,
                          empty: result.empty,
                          value: result.value,
                          min: result.min,
                        }
                      : String(result),
                falseRule:
                  result && typeof result === 'object' && result.ok === false
                    ? result.reason || 'ok:false'
                    : result === false
                      ? 'returned_false'
                      : null,
                lastValidation: lastVal,
                error: err,
              });
            }
            return result;
          };
          wrapped.__wdpE2EWrapped = true;
          obj[key] = wrapped;
        }
        // form.js validateForm genelde formValidate.validateForm üzerinden
        if (WDPApp.formValidate) {
          wrapFn(WDPApp.formValidate, 'validateForm', 'formValidate.validateForm');
        }
        if (WDPApp.form && typeof WDPApp.form.validateForm === 'function') {
          wrapFn(WDPApp.form, 'validateForm', 'form.validateForm');
        }
        if (WDPApp.formAddon) {
          wrapFn(WDPApp.formAddon, 'validateAddonDonation', 'formAddon.validateAddonDonation');
        }
        if (WDPApp.addonRules) {
          wrapFn(WDPApp.addonRules, 'validateAmount', 'addonRules.validateAmount');
          wrapFn(WDPApp.addonRules, 'parseAmount', 'addonRules.parseAmount');
        }
        // submit handler formu bağlandıktan sonra _wdpSubmitHandler üzerinde
        // (form açıldıktan sonra yeniden çağrılabilir — bayrak yok)
        const forms = document.querySelectorAll(
          'form.wdp-donation-form-fields, form.wdp-donation-form, form.wdp-form'
        );
        forms.forEach((form, idx) => {
          if (form._wdpSubmitHandler && !form._wdpSubmitHandler.__wdpE2EWrapped) {
            const orig = form._wdpSubmitHandler;
            const wrapped = function (e) {
              const t0 = performance.now();
              let result;
              try {
                result = orig.apply(this, arguments);
              } finally {
                log({
                  label: 'form._wdpSubmitHandler',
                  formIndex: idx,
                  ms: performance.now() - t0,
                  result: result,
                  defaultPrevented: e ? !!e.defaultPrevented : null,
                });
              }
              return result;
            };
            wrapped.__wdpE2EWrapped = true;
            form.removeEventListener('submit', orig, true);
            form.addEventListener('submit', wrapped, true);
            form._wdpSubmitHandler = wrapped;
          }
        });
        // Modül sarmalaması bir kez; form handler her çağrıda taranır
        if (!window.__wdpE2EValWrapped) {
          window.__wdpE2EValWrapped = true;
        }
      } catch (e) {
        console.error('[e2e:catch-fail] wrapWdpValidationHooks:in-page', e && e.message ? e.message : e);
        throw e;
      }
    })
    .catch((e) => {
      console.error('[e2e:catch-fail] wrapWdpValidationHooks:evaluate', e && e.message ? e.message : e);
      throw e instanceof Error ? e : new Error(String(e));
    });
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function collectPageProbeLogs(page) {
  return page
    .evaluate(() => {
      const events = Array.isArray(window.__wdpE2E) ? window.__wdpE2E.slice(-200) : [];
      return {
        pageEvents: events,
        listeners: Array.isArray(window.__wdpE2EListeners)
          ? window.__wdpE2EListeners.slice(-80)
          : [],
        xhrLog: Array.isArray(window.__wdpE2EXhr) ? window.__wdpE2EXhr.slice(-80) : [],
        validation: Array.isArray(window.__wdpE2EValidation)
          ? window.__wdpE2EValidation.slice(-80)
          : [],
      };
    })
    .catch(() => ({
      pageEvents: [],
      listeners: [],
      xhrLog: [],
      validation: [],
    }));
}

/**
 * Alt bağış paneli + buton anlık görüntüsü.
 * @param {import('@playwright/test').Page} page
 */
export async function snapshotAddonAndButton(page) {
  return page
    .evaluate(() => {
      const wrap = document.querySelector(
        '.wdp-modal.show [data-wdp-sadaka-donation], [data-wdp-sadaka-donation]'
      );
      const panel = wrap ? wrap.querySelector('.wdp-sadaka-donation__panel') : null;
      const btn = document.querySelector(
        '.wdp-modal.show button[name="donation_add_to_cart"], button[name="donation_add_to_cart"]'
      );
      function animInfo(el) {
        if (!el) return null;
        let anims = 0;
        try {
          anims = typeof el.getAnimations === 'function' ? el.getAnimations().length : 0;
        } catch (e) {}
        const st = window.getComputedStyle(el);
        return {
          animCount: anims,
          height: st.height,
          opacity: st.opacity,
          transform: st.transform,
          visibility: st.visibility,
          display: st.display,
        };
      }
      const inputs = [];
      if (wrap) {
        wrap.querySelectorAll('input, select, textarea').forEach((inp) => {
          inputs.push({
            name: inp.getAttribute('name') || '',
            type: inp.getAttribute('type') || inp.tagName,
            disabled: !!inp.disabled,
            required: !!inp.required,
            readOnly: !!inp.readOnly,
            value: String(inp.value || '').slice(0, 40),
          });
        });
      }
      let btnRect = null;
      if (btn) {
        const r = btn.getBoundingClientRect();
        btnRect = { x: r.x, y: r.y, w: r.width, h: r.height };
      }
      return {
        wrapOpen: !!(wrap && wrap.classList.contains('is-open')),
        wrapClass: wrap ? String(wrap.className || '') : '',
        panel: animInfo(panel),
        wrapAnim: animInfo(wrap),
        inputs,
        buttonRect: btnRect,
        buttonDisabled: btn ? !!btn.disabled : null,
      };
    })
    .catch(() => null);
}
