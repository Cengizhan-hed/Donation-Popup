/**
 * Sayfa içi E2E probe — event/fetch/XHR/listener izleme.
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
    // Yeni nesil: REST JSON gövdesi (donation-panel/v1/cart/add); addon_ önekli alanlar ayrı toplanır.
    try {
      const addon = {};
      if (!body) return { action: '', addon };
      let obj = null;
      if (typeof body === 'string') {
        try {
          obj = JSON.parse(body);
        } catch (e) {
          obj = null;
        }
      }
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          if (String(k).indexOf('addon_') === 0) addon[k] = String(v);
        }
      }
      return { action: '', addon };
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
 * Ek bağış kutusu + ana düğme anlık görüntüsü (yeni nesil form).
 * @param {import('@playwright/test').Page} page
 */
export async function snapshotAddonAndButton(page) {
  return page
    .evaluate(() => {
      const open = document.querySelector('[data-dp-overlay].is-open');
      const scope = open || document;
      const wrap = scope.querySelector('[data-dp-addon]');
      const panel = wrap ? wrap.querySelector('[data-dp-addon-box]') : null;
      const btn = scope.querySelector('[data-dp-submit]');
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
      const toggle = wrap ? wrap.querySelector('input[name="addon_active"]') : null;
      return {
        wrapOpen: !!(toggle && toggle.checked),
        wrapClass: wrap ? String(wrap.className || '') : '',
        panel: animInfo(panel),
        wrapAnim: animInfo(wrap),
        inputs,
        buttonRect: btnRect,
        buttonDisabled: btn ? btn.getAttribute('aria-disabled') === 'true' : null,
      };
    })
    .catch(() => null);
}
