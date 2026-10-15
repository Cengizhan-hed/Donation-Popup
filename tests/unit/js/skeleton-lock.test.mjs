/**
 * İskelet kilidi: 8 durum — kilit her yolda açılır (10.28.9).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function el(tag, attrs = {}) {
  const node = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    childNodes: [],
    parentNode: null,
    className: '',
    id: attrs.id || '',
    name: attrs.name || '',
    type: attrs.type || (tag === 'input' ? 'text' : ''),
    value: attrs.value || '',
    disabled: !!attrs.disabled,
    checked: false,
    attributes: { ...(attrs.id ? { id: attrs.id } : {}), ...(attrs.name ? { name: attrs.name } : {}) },
    dataset: Object.create(null),
    style: {
      _props: Object.create(null),
      setProperty(k, v) {
        this._props[k] = v;
      },
      removeProperty(k) {
        delete this._props[k];
      },
      get display() {
        return this._props.display || '';
      },
      set display(v) {
        this._props.display = v;
      },
    },
    classList: {
      _set: new Set(String(attrs.className || attrs.class || '').split(/\s+/).filter(Boolean)),
      add(...c) {
        c.forEach((x) => this._set.add(x));
        node.className = [...this._set].join(' ');
      },
      remove(...c) {
        c.forEach((x) => this._set.delete(x));
        node.className = [...this._set].join(' ');
      },
      contains(c) {
        return this._set.has(c);
      },
      toggle(c) {
        if (this.contains(c)) this.remove(c);
        else this.add(c);
      },
    },
    isConnected: true,
    textContent: attrs.textContent || '',
    setAttribute(k, v) {
      this.attributes[k] = String(v);
      if (k === 'id') this.id = String(v);
      if (k === 'name') this.name = String(v);
      if (k === 'class') {
        this.className = String(v);
        this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean));
      }
      if (k === 'disabled') this.disabled = true;
    },
    getAttribute(k) {
      if (k === 'aria-busy') return this.attributes['aria-busy'] != null ? this.attributes['aria-busy'] : null;
      if (k === 'inert') return Object.prototype.hasOwnProperty.call(this.attributes, 'inert') ? '' : null;
      return this.attributes[k] != null ? this.attributes[k] : null;
    },
    hasAttribute(k) {
      return Object.prototype.hasOwnProperty.call(this.attributes, k);
    },
    removeAttribute(k) {
      delete this.attributes[k];
      if (k === 'disabled') this.disabled = false;
    },
    appendChild(c) {
      c.parentNode = this;
      this.childNodes.push(c);
      return c;
    },
    contains(other) {
      let cur = other;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentNode;
      }
      return false;
    },
    closest(sel) {
      let cur = this;
      while (cur) {
        if (sel === '.wdp-modal-close' && cur.classList.contains('wdp-modal-close')) return cur;
        if (sel === '.wdp-modal' && cur.classList.contains('wdp-modal')) return cur;
        cur = cur.parentNode;
      }
      return null;
    },
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
      querySelectorAll(sel) {
        const out = [];
        const nameMatch = /^(input|select|textarea|button|div|form|\*)?(?:\[name="([^"]+)"\])?$/.exec(
          String(sel || '').split(',')[0].trim()
        );
        const walk2 = (n) => {
          if (!n || n.nodeType !== 1) return;
          if (sel === 'input, select, textarea, button') {
            if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(n.tagName)) out.push(n);
          } else if (sel === '.wdp-modal-content' && n.classList.contains('wdp-modal-content')) out.push(n);
          else if (sel === 'form' && n.tagName === 'FORM') out.push(n);
          else if (sel === '.wdp-form-error' && n.classList.contains('wdp-form-error')) out.push(n);
          else if (sel === 'form.wdp-has-shareholders, form.wdp-donation-form-fields' && n.tagName === 'FORM')
            out.push(n);
          else if (sel === '.wdp-modal-header' && n.classList.contains('wdp-modal-header')) out.push(n);
          else if (sel === '.wdp-progress-bar-container' && n.classList.contains('wdp-progress-bar-container'))
            out.push(n);
          else if (sel === '.wdp-modal-title' && n.classList.contains('wdp-modal-title')) out.push(n);
          else if (nameMatch && nameMatch[2] && n.name === nameMatch[2]) {
            const tag = (nameMatch[1] || '').toUpperCase();
            if (!tag || n.tagName === tag) out.push(n);
          }
          (n.childNodes || []).forEach(walk2);
        };
        walk2(this);
        return out;
      },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    dispatchEvent() {
      return true;
    },
    _innerHTML: '',
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(html) {
      this._innerHTML = String(html || '');
      this.childNodes = [];
      // Minimal parse: recreate name/phone/error for resetForm snapshots
      if (/donation_full_name/.test(this._innerHTML)) {
        const name = el('input', { name: 'donation_full_name', type: 'text' });
        this.appendChild(name);
      }
      if (/donation_phone/.test(this._innerHTML)) {
        this.appendChild(el('input', { name: 'donation_phone', type: 'tel' }));
      }
      if (/wdp-form-error/.test(this._innerHTML)) {
        this.appendChild(el('div', { className: 'wdp-form-error' }));
      }
    },
  };
  if (attrs.className || attrs.class) {
    node.classList.add(...String(attrs.className || attrs.class).split(/\s+/).filter(Boolean));
  }
  Object.keys(attrs).forEach((k) => {
    if (k === 'className' || k === 'class' || k === 'textContent') return;
    node.setAttribute(k, attrs[k]);
  });
  return node;
}

function buildModal(id, { sidePanel = false } = {}) {
  const modal = el('div', {
    id,
    className: 'hdf-donation-modal-wrapper wdp-modal' + (sidePanel ? ' wdp-side-panel' : ''),
  });
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('data-product-id', id.replace(/\D/g, '') || '1');
  const content = el('div', { className: 'wdp-modal-content' });
  const form = el('form', { className: 'wdp-donation-form-fields' });
  const err = el('div', { className: 'wdp-form-error' });
  err.style.display = 'none';
  const name = el('input', { name: 'donation_full_name', type: 'text' });
  const phone = el('input', { name: 'donation_phone', type: 'tel' });
  const closeBtn = el('button', { className: 'wdp-modal-close', type: 'button' });
  form.appendChild(err);
  form.appendChild(name);
  form.appendChild(phone);
  content.appendChild(closeBtn);
  content.appendChild(form);
  modal.appendChild(content);
  return { modal, content, form, name, phone, err };
}

function loadModalModule({ throwOnSetup = false, productFetch = null } = {}) {
  const body = el('body');
  const timers = [];
  let timerId = 1;
  function HTMLElement() {}
  function setTimeoutFn(fn, ms) {
    return sandbox.window.setTimeout(fn, ms);
  }
  function clearTimeoutFn(id) {
    return sandbox.window.clearTimeout(id);
  }
  const sandbox = {
    Number,
    String,
    Boolean,
    Error,
    Promise,
    Math,
    parseInt,
    isFinite,
    WeakMap,
    Map,
    Set,
    Object,
    Array,
    JSON,
    HTMLElement,
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
    window: {
      WDPApp: {
        utils: {
          ensureModule: (name, methods) => {
            const mod =
              name === 'utils'
                ? {
                    safeLog() {},
                    focusFirstElement() {},
                    activateFocusTrap() {
                      return () => {};
                    },
                    announceStatus() {},
                  }
                : name === 'state'
                  ? sandbox.window.WDPApp.state
                  : {};
            return { module: mod, isValid: true, missingMethods: [] };
          },
          safeLog() {},
          focusFirstElement() {},
          activateFocusTrap() {
            return () => {};
          },
          announceStatus() {},
          emitWdpEvent() {},
        },
        state: {
          activeModal: null,
          originalForms: new Map(),
          lastFocusedElement: null,
          focusTrapCleanup: null,
        },
        form: {
          setup(form) {
            if (throwOnSetup) {
              throw new Error('setup boom');
            }
            form.dataset.wdpFormInitialized = '1';
          },
        },
        formFeedback: {
          showFormError(form, message) {
            let box = form.querySelector('.wdp-form-error');
            if (!box) {
              box = el('div', { className: 'wdp-form-error' });
              form.appendChild(box);
            }
            box.textContent = message;
            box.style.display = 'block';
          },
        },
        product: {
          fetchProductInfo: productFetch || function () {
            return Promise.resolve(null);
          },
          fetch: null,
        },
        formWizard: null,
        phoneInput: null,
        progressBar: null,
        shareholder: null,
        cart: null,
        cartActions: null,
      },
      document: null,
      requestAnimationFrame(cb) {
        return sandbox.window.setTimeout(() => cb(0), 0);
      },
      setTimeout(fn, ms) {
        const id = timerId++;
        timers.push({ id, fn, ms: ms || 0, cleared: false });
        return id;
      },
      clearTimeout(id) {
        const t = timers.find((x) => x.id === id);
        if (t) t.cleared = true;
      },
      scrollY: 0,
      pageYOffset: 0,
      scrollTo() {},
      console: { warn() {}, log() {} },
      WeakMap,
      Number,
      String,
      parseInt,
      isFinite: Number.isFinite.bind(Number),
      Math,
      Error,
      Promise,
      Map,
      Set,
      HTMLElement,
    },
    document: {
      body,
      documentElement: el('html'),
      activeElement: null,
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      createElement: el,
      addEventListener() {},
      removeEventListener() {},
    },
    console: { warn() {}, log() {} },
  };
  function walkAll(root, visit) {
    visit(root);
    (root.childNodes || []).forEach((c) => walkAll(c, visit));
  }
  body.querySelector = function (sel) {
    let found = null;
    walkAll(this, (n) => {
      if (found || !n || n.nodeType !== 1) return;
      if (sel && sel.startsWith('#') && n.id === sel.slice(1)) found = n;
      if (sel === '.wdp-modal.show' && n.classList.contains('wdp-modal') && n.classList.contains('show'))
        found = n;
    });
    return found;
  };
  body.querySelectorAll = function (sel) {
    const all = [];
    walkAll(this, (n) => {
      if (!n || n.nodeType !== 1) return;
      if (sel === '*') all.push(n);
    });
    return all;
  };
  sandbox.document.getElementById = (id) => {
    let found = null;
    walkAll(body, (n) => {
      if (!found && n && n.id === id) found = n;
    });
    return found;
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.window = sandbox.window;
  sandbox.document.body = body;
  // form.innerHTML for resetForm snapshot path
  const origAppend = el('div').appendChild;
  void origAppend;

  const code = fs.readFileSync(path.join(root, 'assets/js/src/modal.js'), 'utf8');
  vm.runInNewContext(code, sandbox);

  function flush(ms = 0) {
    const due = timers.filter((t) => !t.cleared && t.ms <= ms);
    due.forEach((t) => {
      t.cleared = true;
      t.fn();
    });
  }
  function flushWatchdog() {
    const due = timers.filter((t) => !t.cleared && t.ms >= 10000);
    due.forEach((t) => {
      t.cleared = true;
      t.fn();
    });
  }

  return {
    WDPApp: sandbox.window.WDPApp,
    body,
    flush,
    flushWatchdog,
    timers,
  };
}

function isUnlocked(modal, nameInput) {
  return (
    !modal.classList.contains('wdp-is-skeleton') &&
    modal.getAttribute('aria-busy') == null &&
    !nameInput.disabled &&
    nameInput.dataset.wdpSkeletonLock == null
  );
}

test('kaynak: try/finally + bekçi + open-token + setSkeletonBusy export', () => {
  const js = fs.readFileSync(path.join(root, 'assets/js/src/modal.js'), 'utf8');
  assert.match(js, /finally\s*\{[\s\S]*setModalSkeletonBusy\(modal,\s*false\)/);
  assert.match(js, /SKELETON_WATCHDOG_MS\s*=\s*10000/);
  assert.match(js, /wdpOpenToken|wdp-open-token|dataset\.wdpOpenToken/);
  assert.match(js, /setSkeletonBusy:\s*setModalSkeletonBusy/);
  const product = fs.readFileSync(path.join(root, 'assets/js/src/product.js'), 'utf8');
  assert.match(product, /openToken/);
  assert.match(product, /isStaleProductInfoRequest/);
  assert.match(product, /AbortController|PRODUCT_INFO_TIMEOUT_MS/);
});

test('1) Normal açılış: init sonrası kilit açık', () => {
  const { WDPApp, body, flush } = loadModalModule();
  const { modal, name } = buildModal('wdp-modal-1');
  body.appendChild(modal);
  WDPApp.state.originalForms.set(
    'wdp-modal-1',
    '<input name="donation_full_name" type="text"><input name="donation_phone" type="tel"><div class="wdp-form-error"></div>'
  );

  WDPApp.modal.open(1);
  assert.ok(modal.classList.contains('show'), 'açılış show');
  assert.ok(modal.dataset.wdpOpenToken, 'token');
  // Sync popup: init hemen biter → kilit açık
  assert.ok(!modal.classList.contains('wdp-is-skeleton'));
  assert.equal(modal.getAttribute('aria-busy'), null);
  flush(0);
  const name2 = modal.querySelector('input[name="donation_full_name"]');
  assert.ok(name2, 'name alanı');
  assert.equal(!!name2.disabled, false);
  void name;
});

test('2) product_info HATA: kilit yine açık (init sync unlock)', async () => {
  const { WDPApp, body, flush } = loadModalModule({
    productFetch: () => Promise.resolve({ success: false, message: 'fail' }),
  });
  const { modal, name } = buildModal('wdp-modal-2');
  body.appendChild(modal);
  WDPApp.state.originalForms.set('wdp-modal-2', '<input name="donation_full_name"><div class="wdp-form-error"></div>');
  WDPApp.modal.open(2);
  flush(0);
  await Promise.resolve();
  assert.ok(!modal.classList.contains('wdp-is-skeleton'));
  assert.equal(modal.getAttribute('aria-busy'), null);
  void name;
});

test('3) product_info ağ hatası: kilit açık', async () => {
  const { WDPApp, body, flush } = loadModalModule({
    productFetch: () =>
      Promise.resolve(null).then(() => {
        /* ağ hatası sonrası null — fetchProductInfo displayError */
        return null;
      }),
  });
  const { modal } = buildModal('wdp-modal-3');
  body.appendChild(modal);
  WDPApp.state.originalForms.set('wdp-modal-3', '<input name="donation_full_name"><div class="wdp-form-error"></div>');
  WDPApp.modal.open(3);
  assert.ok(modal.classList.contains('show'));
  flush(0);
  await Promise.resolve();
  assert.ok(!modal.classList.contains('wdp-is-skeleton'));
  assert.equal(modal.getAttribute('aria-busy'), null);
});

test('4) Yüklenirken kapat: finalize unlock', () => {
  const { WDPApp, body, flush } = loadModalModule();
  const { modal } = buildModal('wdp-side-panel-4', { sidePanel: true });
  body.appendChild(modal);
  WDPApp.state.originalForms.set('wdp-side-panel-4', '<input name="donation_full_name"><div class="wdp-form-error"></div>');
  // Yükleme ortası: kilit açıkken kapat (rAF init’ten önce)
  modal.classList.add('show');
  WDPApp.state.activeModal = modal;
  WDPApp.modal.setSkeletonBusy(modal, true);
  assert.ok(modal.classList.contains('wdp-is-skeleton'));
  assert.equal(modal.getAttribute('aria-busy'), 'true');
  WDPApp.modal.close(modal);
  flush(500);
  assert.ok(!modal.classList.contains('wdp-is-skeleton'));
  assert.equal(modal.getAttribute('aria-busy'), null);
  const nameLive = modal.querySelector('input[name="donation_full_name"]');
  if (nameLive) assert.equal(!!nameLive.disabled, false);
});

test('5) Kapatıp yeniden aç + farklı ürün token', () => {
  const { WDPApp, body, flush } = loadModalModule();
  const a = buildModal('wdp-modal-10');
  const b = buildModal('wdp-modal-11');
  body.appendChild(a.modal);
  body.appendChild(b.modal);
  WDPApp.state.originalForms.set('wdp-modal-10', '<input name="donation_full_name"><div class="wdp-form-error"></div>');
  WDPApp.state.originalForms.set('wdp-modal-11', '<input name="donation_full_name"><div class="wdp-form-error"></div>');
  WDPApp.modal.open(10);
  flush(0);
  const token1 = a.modal.dataset.wdpOpenToken;
  assert.ok(token1, 'open token set');
  WDPApp.modal.close(a.modal);
  flush(500);
  WDPApp.modal.open(10);
  flush(0);
  assert.notEqual(a.modal.dataset.wdpOpenToken, token1);
  assert.ok(!a.modal.classList.contains('wdp-is-skeleton'));
  WDPApp.modal.close(a.modal);
  flush(500);
  WDPApp.modal.open(11);
  flush(0);
  assert.ok(!b.modal.classList.contains('wdp-is-skeleton'));
  assert.equal(b.modal.getAttribute('aria-busy'), null);
});

test('6) Popup ve panel ardışık: her ikisi de unlock', () => {
  const { WDPApp, body, flush } = loadModalModule();
  const popup = buildModal('wdp-modal-20');
  const panel = buildModal('wdp-side-panel-21', { sidePanel: true });
  body.appendChild(popup.modal);
  body.appendChild(panel.modal);
  WDPApp.state.originalForms.set('wdp-modal-20', '<input name="donation_full_name"><div class="wdp-form-error"></div>');
  WDPApp.state.originalForms.set('wdp-side-panel-21', '<input name="donation_full_name"><div class="wdp-form-error"></div>');
  WDPApp.modal.open(20);
  flush(0);
  assert.ok(!popup.modal.classList.contains('wdp-is-skeleton'));
  WDPApp.modal.close(popup.modal);
  flush(500);
  WDPApp.modal.open(21, { modalId: 'wdp-side-panel-21' });
  flush(0);
  flush(0);
  assert.ok(!panel.modal.classList.contains('wdp-is-skeleton'));
  assert.equal(panel.modal.getAttribute('aria-busy'), null);
});

test('7) Init sırasında JS hatası: finally unlock + uyarı', () => {
  const { WDPApp, body, flush } = loadModalModule({ throwOnSetup: true });
  const { modal } = buildModal('wdp-modal-7');
  body.appendChild(modal);
  WDPApp.state.originalForms.set('wdp-modal-7', '<input name="donation_full_name"><div class="wdp-form-error"></div>');
  WDPApp.modal.open(7);
  flush(0);
  assert.ok(!modal.classList.contains('wdp-is-skeleton'));
  assert.equal(modal.getAttribute('aria-busy'), null);
  // showFormError mock form üzerindeki .wdp-form-error'a yazar (reset sonrası yeni node olabilir)
  const boxes = [];
  const walk = (n) => {
    if (!n || n.nodeType !== 1) return;
    if (n.classList && n.classList.contains('wdp-form-error') && n.textContent) boxes.push(n.textContent);
    (n.childNodes || []).forEach(walk);
  };
  walk(modal);
  const msg = boxes.join(' ');
  assert.match(msg, /Form tam yüklenemedi|bilgilerinizi kontrol/i);
});

test('8) Başarı → kapat (yeni bağış yolu) sonrası kilit yok; bekçi force unlock', () => {
  const { WDPApp, body, flush, flushWatchdog } = loadModalModule();
  const { modal } = buildModal('wdp-modal-8');
  body.appendChild(modal);
  WDPApp.state.originalForms.set('wdp-modal-8', '<input name="donation_full_name"><div class="wdp-form-error"></div>');
  // Simüle: başarı sonrası close (cart/actions new-donation)
  WDPApp.modal.open(8);
  flush(0);
  WDPApp.modal.close(modal);
  flush(500);
  assert.ok(!modal.classList.contains('wdp-is-skeleton'));

  // Bekçi: kilidi elle kapatmadan açık bırak → watchdog açar
  WDPApp.modal.setSkeletonBusy(modal, true);
  assert.ok(modal.classList.contains('wdp-is-skeleton'));
  const locked = modal.querySelector('input[name="donation_full_name"]');
  assert.ok(locked && locked.disabled);
  flushWatchdog();
  assert.ok(!modal.classList.contains('wdp-is-skeleton'));
  assert.equal(modal.getAttribute('aria-busy'), null);
  const unlocked = modal.querySelector('input[name="donation_full_name"]');
  assert.ok(unlocked);
  assert.equal(!!unlocked.disabled, false);
});
