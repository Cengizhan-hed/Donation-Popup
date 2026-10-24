/**
 * validateForm false yolları: görünür hata + odak + lastValidation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function makeClassList(el) {
  const set = new Set();
  return {
    add(...cs) {
      cs.forEach((c) => set.add(c));
      el._className = [...set].join(' ');
    },
    remove(...cs) {
      cs.forEach((c) => set.delete(c));
      el._className = [...set].join(' ');
    },
    contains(c) {
      return set.has(c);
    },
    toggle(c, force) {
      if (force === true) set.add(c);
      else if (force === false) set.delete(c);
      else if (set.has(c)) set.delete(c);
      else set.add(c);
      el._className = [...set].join(' ');
      return set.has(c);
    },
  };
}

function createDom() {
  /** @type {any[]} */
  const all = [];
  let focused = null;

  function matches(el, sel) {
    if (!sel) return false;
    if (sel.startsWith('.')) {
      return el.classList.contains(sel.slice(1));
    }
    if (sel.startsWith('#')) {
      return el.id === sel.slice(1);
    }
    if (sel.includes('[')) {
      // basit: name="x" veya [hidden] veya [data-...]
      const nameM = sel.match(/\[name="([^"]+)"\]/);
      if (nameM) {
        const tagOk = !sel.split('[')[0] || el.tagName.toLowerCase() === sel.split('[')[0].toLowerCase() || !/^[a-z]/i.test(sel);
        const tagPart = sel.split('[')[0];
        if (tagPart && /^[a-z]/i.test(tagPart) && el.tagName.toLowerCase() !== tagPart.toLowerCase()) {
          return false;
        }
        return el.getAttribute('name') === nameM[1];
      }
      const nameCaret = sel.match(/\[name\^="([^"]+)"\]/);
      if (nameCaret) {
        return String(el.getAttribute('name') || '').startsWith(nameCaret[1]);
      }
      if (sel === '[hidden]' || sel.endsWith('[hidden]')) {
        return el.hasAttribute('hidden');
      }
      const dataM = sel.match(/\[data-([\w-]+)\]/);
      if (dataM) {
        return el.hasAttribute('data-' + dataM[1]);
      }
      const typeM = sel.match(/\[type="([^"]+)"\]/);
      if (typeM) {
        const tagPart = sel.split('[')[0];
        if (tagPart && /^[a-z]/i.test(tagPart) && el.tagName.toLowerCase() !== tagPart.toLowerCase()) {
          return false;
        }
        return el.getAttribute('type') === typeM[1];
      }
      if (/\[required\]/.test(sel)) {
        const tagPart = sel.split('[')[0];
        if (tagPart && /^[a-z]/i.test(tagPart) && el.tagName.toLowerCase() !== tagPart.toLowerCase()) {
          return false;
        }
        return !!el.required || el.hasAttribute('required');
      }
    }
    if (sel.includes(',')) {
      return sel.split(',').some((s) => matches(el, s.trim()));
    }
    if (sel.includes('.')) {
      const [tag, ...cls] = sel.split('.');
      if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
      return cls.every((c) => el.classList.contains(c));
    }
    return el.tagName.toLowerCase() === sel.toLowerCase();
  }

  function queryAll(rootEl, selector) {
    const parts = String(selector)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const out = [];
    function walk(node) {
      if (!node || node.nodeType !== 1) return;
      for (const p of parts) {
        // descendant: "a b" veya tek seçici
        const tokens = p.split(/\s+/).filter(Boolean);
        if (tokens.length === 1) {
          if (matches(node, tokens[0])) out.push(node);
        } else {
          // basit iki seviyeli: ancestor descendant
          // tam ağaçta: eğer node son token'a uyuyorsa ve bir ata ilk tokenlara uyuyorsa
          const last = tokens[tokens.length - 1];
          if (!matches(node, last)) continue;
          let cur = node.parentNode;
          let ti = tokens.length - 2;
          while (cur && ti >= 0) {
            if (matches(cur, tokens[ti])) ti -= 1;
            cur = cur.parentNode;
          }
          if (ti < 0) out.push(node);
        }
      }
      (node.childNodes || []).forEach(walk);
    }
    walk(rootEl);
    return out;
  }

  function createElement(tag) {
    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      childNodes: [],
      parentNode: null,
      attributes: /** @type {Record<string,string>} */ ({}),
      dataset: {},
      style: {},
      value: '',
      required: false,
      disabled: false,
      readOnly: false,
      type: tag === 'input' ? 'text' : '',
      name: '',
      id: '',
      placeholder: '',
      _className: '',
      _text: '',
      get className() {
        return this._className;
      },
      set className(v) {
        this._className = String(v || '');
        this.classList = makeClassList(this);
        String(v || '')
          .split(/\s+/)
          .filter(Boolean)
          .forEach((c) => this.classList.add(c));
      },
      get textContent() {
        return this._text;
      },
      set textContent(v) {
        this._text = String(v == null ? '' : v);
      },
      classList: null,
      setAttribute(k, v) {
        this.attributes[k] = String(v);
        if (k === 'name') this.name = String(v);
        if (k === 'type') this.type = String(v);
        if (k === 'id') this.id = String(v);
        if (k === 'required') this.required = true;
        if (k === 'class') this.className = String(v);
        if (k.startsWith('data-')) {
          const camel = k
            .slice(5)
            .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          this.dataset[camel] = String(v);
        }
      },
      getAttribute(k) {
        if (k === 'name') return this.name || null;
        if (k === 'type') return this.type || null;
        if (k === 'class') return this._className || null;
        return this.attributes[k] != null ? this.attributes[k] : null;
      },
      hasAttribute(k) {
        if (k === 'required') return !!this.required;
        if (k === 'hidden') return Object.prototype.hasOwnProperty.call(this.attributes, 'hidden');
        return this.getAttribute(k) != null;
      },
      removeAttribute(k) {
        delete this.attributes[k];
        if (k === 'required') this.required = false;
      },
      appendChild(child) {
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
      },
      insertBefore(child, ref) {
        child.parentNode = this;
        if (!ref) {
          this.childNodes.push(child);
          return child;
        }
        const i = this.childNodes.indexOf(ref);
        if (i < 0) this.childNodes.push(child);
        else this.childNodes.splice(i, 0, child);
        return child;
      },
      get firstChild() {
        return this.childNodes[0] || null;
      },
      remove() {
        if (!this.parentNode) return;
        const list = this.parentNode.childNodes;
        const i = list.indexOf(this);
        if (i >= 0) list.splice(i, 1);
        this.parentNode = null;
      },
      querySelector(sel) {
        return queryAll(this, sel)[0] || null;
      },
      querySelectorAll(sel) {
        return queryAll(this, sel);
      },
      closest(sel) {
        let cur = this;
        while (cur) {
          if (matches(cur, sel)) return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      contains(node) {
        if (node === this) return true;
        return (this.childNodes || []).some(
          (c) => c === node || (c.contains && c.contains(node))
        );
      },
      focus() {
        focused = this;
      },
      scrollIntoView() {},
      setCustomValidity() {},
      getClientRects() {
        return [{ width: 10, height: 10 }];
      },
      addEventListener() {},
      removeEventListener() {},
    };
    el.classList = makeClassList(el);
    all.push(el);
    return el;
  }

  const body = createElement('body');
  const document = {
    body,
    createElement,
    getElementById(id) {
      return all.find((e) => e.id === id) || null;
    },
    querySelector(sel) {
      return queryAll(body, sel)[0] || null;
    },
    querySelectorAll(sel) {
      return queryAll(body, sel);
    },
  };

  const windowObj = {
    document,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (cb) => {
      cb();
      return 1;
    },
    setTimeout: (cb) => {
      /* unit: auto-dismiss'i tetikleme */
      return 0;
    },
    clearTimeout() {},
    getComputedStyle: () => ({ position: 'static' }),
    wdp_ajax: { strings: {} },
    WDPApp: {},
  };
  windowObj.window = windowObj;

  return {
    window: windowObj,
    document,
    getFocused: () => focused,
    createElement,
    attachForm(htmlFields) {
      const form = createElement('form');
      form.className = 'wdp-donation-form';
      body.appendChild(form);
      htmlFields(form, createElement);
      return form;
    },
  };
}

function loadValidateStack(dom) {
  const files = [
    'assets/js/src/form/messages.js',
    'assets/js/src/form/feedback.js',
    'assets/js/src/form/validate.js',
  ];
  const sandbox = {
    window: dom.window,
    document: dom.document,
    console,
  };
  sandbox.window.console = console;
  for (const rel of files) {
    const code = fs.readFileSync(path.join(root, rel), 'utf8');
    vm.runInNewContext(code, sandbox);
  }
  return sandbox.window.WDPApp;
}

function visibleErrorTexts(form) {
  const out = [];
  form.querySelectorAll('.wdp-input-error, .wdp-form-error').forEach((el) => {
    const t = String(el.textContent || '').trim();
    if (t) out.push(t);
  });
  return out;
}

/** Mesajı parentElement konumuna göre değil aria-describedby / yakın kökle bulur. */
function fieldErrorEl(input, form) {
  if (!input) return null;
  const described = input.getAttribute && input.getAttribute('aria-describedby');
  if (described) {
    const ids = String(described)
      .split(/\s+/)
      .filter(Boolean);
    for (const id of ids) {
      const byId = form.querySelector('#' + id);
      if (byId && byId.classList && byId.classList.contains('wdp-input-error')) {
        return byId;
      }
    }
  }
  const near =
    input.closest && input.closest('.wdp-price-field, .wdp-field-stack__row, .wdp-form-group');
  return (near && near.querySelector && near.querySelector('.wdp-input-error')) || null;
}

function attachCustomPrice(form, el, attrs = {}) {
  const wrap = el('div');
  wrap.className = 'wdp-price-field wdp-custom-price-field';
  const shell = el('div');
  shell.className = 'wdp-custom-price-shell';
  const currency = el('span');
  currency.className = 'wdp-custom-price-currency';
  currency.textContent = '₺';
  shell.appendChild(currency);
  const price = el('input');
  price.setAttribute('name', attrs.name || 'custom_price');
  price.className = 'wdp-custom-price-input';
  price.value = attrs.value != null ? attrs.value : '';
  if (attrs.min) price.setAttribute('min', attrs.min);
  shell.appendChild(price);
  wrap.appendChild(shell);
  form.appendChild(wrap);
  return { wrap, shell, price };
}

test('false: donation_full_name boş → görünür hata + odak + lastValidation', () => {
  const dom = createDom();
  const WDPApp = loadValidateStack(dom);
  const form = dom.attachForm((form, el) => {
    const name = el('input');
    name.setAttribute('name', 'donation_full_name');
    name.required = true;
    name.value = '';
    const row = el('div');
    row.className = 'wdp-field-stack__row';
    row.appendChild(name);
    form.appendChild(row);
    const phone = el('input');
    phone.setAttribute('type', 'tel');
    phone.setAttribute('name', 'donation_phone');
    phone.value = '5551234567';
    form.appendChild(phone);
  });

  // phoneInput yok → dolu telefon ok sayılır
  const ok = WDPApp.formValidate.validateForm(form);
  assert.equal(ok, false);
  const texts = visibleErrorTexts(form);
  assert.ok(texts.some((t) => /Ad Soyad|Full name|zorunlu|required/i.test(t)), texts.join(' | '));
  assert.equal(WDPApp.form.lastValidation.ok, false);
  assert.ok(
    WDPApp.form.lastValidation.failures.some((f) => f.field === 'donation_full_name')
  );
  assert.equal(dom.getFocused()?.name, 'donation_full_name');
});

test('false: telefon eksik → görünür hata + lastValidation phone rule', () => {
  const dom = createDom();
  const WDPApp = loadValidateStack(dom);
  WDPApp.phoneInput = {
    validatePhoneField(input) {
      const v = String(input.value || '').trim();
      if (!v) return { ok: true, empty: true };
      return { ok: false, empty: false, reason: 'too_short' };
    },
    ensureNationalDisplayInForm() {},
  };
  // messages getPhoneValidationState uses phoneInput
  const form = dom.attachForm((form, el) => {
    const name = el('input');
    name.setAttribute('name', 'donation_full_name');
    name.required = true;
    name.value = 'Ali Veli';
    form.appendChild(name);
    const phone = el('input');
    phone.setAttribute('type', 'tel');
    phone.setAttribute('name', 'donation_phone');
    phone.value = '555';
    const row = el('div');
    row.className = 'wdp-field-stack__row';
    row.appendChild(phone);
    form.appendChild(row);
  });

  const ok = WDPApp.formValidate.validateForm(form);
  assert.equal(ok, false);
  const texts = visibleErrorTexts(form);
  assert.ok(texts.some((t) => /Telefon|phone/i.test(t)), texts.join(' | '));
  assert.ok(
    WDPApp.form.lastValidation.failures.some(
      (f) => f.field === 'donation_phone' && /phone/.test(f.rule)
    )
  );
  assert.equal(dom.getFocused()?.name, 'donation_phone');
});

test('false: custom_price boş (pricing yüklü) → görünür hata + odak', () => {
  const dom = createDom();
  dom.window.WDPApp = {
    formPricing: {
      parseNormalizedAmount: (raw) => {
        const n = Number(String(raw).replace(',', '.'));
        return Number.isFinite(n) ? n : NaN;
      },
      customPriceRowHasQtyCounter: () => false,
    },
  };
  const WDPApp = loadValidateStack(dom);
  let priceRef = null;
  let shellRef = null;
  let wrapRef = null;
  const form = dom.attachForm((form, el) => {
    const name = el('input');
    name.setAttribute('name', 'donation_full_name');
    name.required = true;
    name.value = 'Ali';
    form.appendChild(name);
    const attached = attachCustomPrice(form, el, { value: '' });
    priceRef = attached.price;
    shellRef = attached.shell;
    wrapRef = attached.wrap;
  });

  const ok = WDPApp.formValidate.validateForm(form);
  assert.equal(ok, false);
  const texts = visibleErrorTexts(form);
  assert.ok(texts.some((t) => /bağış tutar|donation amount/i.test(t)), texts.join(' | '));
  assert.ok(
    WDPApp.form.lastValidation.failures.some((f) => f.rule === 'price_empty')
  );
  assert.equal(dom.getFocused()?.name, 'custom_price');
  const msg = fieldErrorEl(priceRef, form);
  assert.ok(msg, 'mesaj aria-describedby / yakın kökle bulunmalı');
  assert.equal(msg.parentNode, wrapRef, 'hata .wdp-price-field altında');
  assert.notEqual(msg.parentNode, shellRef, 'hata para birimi kabuğunun içinde olmamalı');
  assert.equal(
    WDPApp.formFeedback.getInputErrorAnchor(priceRef),
    wrapRef,
    'anchor custom_price → .wdp-price-field'
  );
});

test('false: custom_price min altı → price_below_min', () => {
  const dom = createDom();
  dom.window.WDPApp = {
    formPricing: {
      parseNormalizedAmount: (raw) => Number(raw),
      customPriceRowHasQtyCounter: () => false,
    },
    utils: { formatCurrency: (n) => n + ' TL' },
  };
  const WDPApp = loadValidateStack(dom);
  let priceRef = null;
  let shellRef = null;
  let wrapRef = null;
  const form = dom.attachForm((form, el) => {
    const name = el('input');
    name.setAttribute('name', 'donation_full_name');
    name.required = true;
    name.value = 'Ali';
    form.appendChild(name);
    const attached = attachCustomPrice(form, el, { value: '50', min: '100' });
    priceRef = attached.price;
    shellRef = attached.shell;
    wrapRef = attached.wrap;
  });

  assert.equal(WDPApp.formValidate.validateForm(form), false);
  assert.ok(
    WDPApp.form.lastValidation.failures.some((f) => f.rule === 'price_below_min')
  );
  assert.ok(visibleErrorTexts(form).length > 0);
  const msg = fieldErrorEl(priceRef, form);
  assert.ok(msg, 'min altı mesajı aria-describedby ile bulunmalı');
  assert.equal(msg.parentNode, wrapRef);
  assert.notEqual(msg.parentNode, shellRef);
});

test('false: hissedar adı boş → görünür hata', () => {
  const dom = createDom();
  const WDPApp = loadValidateStack(dom);
  const form = dom.attachForm((form, el) => {
    const name = el('input');
    name.setAttribute('name', 'donation_full_name');
    name.required = true;
    name.value = 'Ali';
    form.appendChild(name);
    const shareCount = el('input');
    shareCount.setAttribute('name', 'share_count');
    shareCount.value = '1';
    form.appendChild(shareCount);
    const row = el('div');
    row.className = 'wdp-shareholder-form';
    row.setAttribute('data-index', '1');
    const sn = el('input');
    sn.setAttribute('name', 'shareholder_name_1');
    sn.value = '';
    row.appendChild(sn);
    const sp = el('input');
    sp.setAttribute('type', 'tel');
    sp.setAttribute('name', 'shareholder_phone_1');
    sp.value = '5551234567';
    row.appendChild(sp);
    form.appendChild(row);
  });

  assert.equal(WDPApp.formValidate.validateForm(form), false);
  assert.ok(
    WDPApp.form.lastValidation.failures.some((f) => f.rule === 'shareholder_name_required')
  );
  assert.ok(visibleErrorTexts(form).some((t) => /Hissedar|Shareholder|zorunlu|required/i.test(t)));
});

test('false: sadaka invalid (input yok) → genel form mesajı', () => {
  const dom = createDom();
  dom.window.WDPApp = {
    formSadaka: { validateSadakaDonation: () => false },
  };
  const WDPApp = loadValidateStack(dom);
  const form = dom.attachForm((form, el) => {
    const name = el('input');
    name.setAttribute('name', 'donation_full_name');
    name.required = true;
    name.value = 'Ali';
    form.appendChild(name);
    const wrap = el('div');
    wrap.setAttribute('data-wdp-sadaka-donation', '1');
    form.appendChild(wrap);
  });

  assert.equal(WDPApp.formValidate.validateForm(form), false);
  const texts = visibleErrorTexts(form);
  assert.ok(
    texts.some((t) => /işaretli alanları kontrol|highlighted fields|sadaka|alt bağış|additional donation|Geçerli|valid/i.test(t)),
    texts.join(' | ')
  );
});

test('false: sadaka invalid → görünür geri bildirim + lastValidation', () => {
  const dom = createDom();
  dom.window.WDPApp = {
    formSadaka: { validateSadakaDonation: () => false },
  };
  const WDPApp = loadValidateStack(dom);
  const form = dom.attachForm((form, el) => {
    const name = el('input');
    name.setAttribute('name', 'donation_full_name');
    name.required = true;
    name.value = 'Ali';
    form.appendChild(name);
    const wrap = el('div');
    wrap.setAttribute('data-wdp-sadaka-donation', '1');
    const inp = el('input');
    inp.setAttribute('name', 'sadaka_custom_price');
    inp.value = '';
    wrap.appendChild(inp);
    form.appendChild(wrap);
  });

  assert.equal(WDPApp.formValidate.validateForm(form), false);
  assert.ok(
    WDPApp.form.lastValidation.failures.some((f) => f.rule === 'sadaka_invalid')
  );
  assert.ok(visibleErrorTexts(form).length > 0, 'görünür hata olmalı');
});

test('false: katlanmış hissedar kartı açılır + görünür mesaj + aria', () => {
  const dom = createDom();
  const WDPApp = loadValidateStack(dom);
  const form = dom.attachForm((form, el) => {
    const name = el('input');
    name.setAttribute('name', 'donation_full_name');
    name.required = true;
    name.value = 'Ali';
    form.appendChild(name);
    const shareCount = el('input');
    shareCount.setAttribute('name', 'share_count');
    shareCount.value = '1';
    form.appendChild(shareCount);
    const row = el('div');
    row.className = 'wdp-shareholder-form collapsed';
    row.setAttribute('data-index', '1');
    const header = el('div');
    header.className = 'wdp-shareholder-header';
    row.appendChild(header);
    const content = el('div');
    content.className = 'wdp-shareholder-content';
    content.style.display = 'none';
    const nameRow = el('div');
    nameRow.className = 'wdp-field-stack__row';
    const sn = el('input');
    sn.setAttribute('name', 'shareholder_name_1');
    sn.value = '';
    nameRow.appendChild(sn);
    const phoneRow = el('div');
    phoneRow.className = 'wdp-field-stack__row';
    const sp = el('input');
    sp.setAttribute('type', 'tel');
    sp.setAttribute('name', 'shareholder_phone_1');
    sp.value = '';
    phoneRow.appendChild(sp);
    content.appendChild(nameRow);
    content.appendChild(phoneRow);
    row.appendChild(content);
    form.appendChild(row);
  });

  assert.equal(WDPApp.formValidate.validateForm(form), false);
  const row = form.querySelector('.wdp-shareholder-form');
  assert.equal(row.classList.contains('collapsed'), false, 'hatalı kart açık olmalı');
  const texts = visibleErrorTexts(form);
  assert.ok(texts.some((t) => /Hissedar|Shareholder|zorunlu|required/i.test(t)), texts.join(' | '));
  const sn = form.querySelector('[name="shareholder_name_1"]');
  assert.equal(sn.getAttribute('aria-invalid'), 'true');
  const desc = sn.getAttribute('aria-describedby');
  assert.ok(desc, 'aria-describedby bağlı');
  const msg = form.querySelector('#' + desc);
  assert.ok(msg, 'mesaj id ile bulunmalı');
  assert.equal(msg.getAttribute('role'), 'alert');
  const phoneErr = form.querySelector('[name="shareholder_phone_1"]');
  const phoneDesc = phoneErr.getAttribute('aria-describedby');
  const phoneMsg = phoneDesc ? form.querySelector('#' + phoneDesc) : null;
  assert.ok(phoneMsg, 'telefon mesajı var');
  assert.equal(phoneMsg.getAttribute('role'), 'status');
  assert.equal(dom.getFocused()?.name, 'shareholder_name_1');
});

test('ok: geçerli form → lastValidation.ok true, hata yok', () => {
  const dom = createDom();
  const WDPApp = loadValidateStack(dom);
  const form = dom.attachForm((form, el) => {
    const name = el('input');
    name.setAttribute('name', 'donation_full_name');
    name.required = true;
    name.value = 'Ali Veli';
    form.appendChild(name);
    const phone = el('input');
    phone.setAttribute('type', 'tel');
    phone.setAttribute('name', 'donation_phone');
    phone.value = '5551234567';
    form.appendChild(phone);
  });

  assert.equal(WDPApp.formValidate.validateForm(form), true);
  assert.equal(WDPApp.form.lastValidation.ok, true);
  assert.equal(WDPApp.form.lastValidation.failures.length, 0);
  assert.equal(visibleErrorTexts(form).length, 0);
});
