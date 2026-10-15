/**
 * Form değer koruma + iskelet etkileşimsizlik (dom.js / modal akışı).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function loadDom() {
  const code = fs.readFileSync(path.join(root, 'assets/js/src/core/dom.js'), 'utf8');
  const elements = [];
  function el(tag) {
    const node = {
      tagName: tag.toUpperCase(),
      nodeType: 1,
      childNodes: [],
      parentNode: null,
      name: '',
      type: tag === 'input' ? 'text' : '',
      value: '',
      checked: false,
      attributes: {},
      dataset: {},
      classList: { add() {}, remove() {}, contains() { return false; } },
      isConnected: true,
      setAttribute(k, v) {
        this.attributes[k] = String(v);
        if (k === 'name') this.name = String(v);
        if (k === 'type') this.type = String(v);
      },
      getAttribute(k) {
        return this.attributes[k] != null ? this.attributes[k] : null;
      },
      hasAttribute(k) {
        return Object.prototype.hasOwnProperty.call(this.attributes, k);
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
      querySelector(sel) {
        return this.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll(sel) {
        const out = [];
        const parts = String(sel)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const walk = (n) => {
          if (!n || n.nodeType !== 1) return;
          for (const part of parts) {
            if (part === 'input, select, textarea') continue;
            if (part === 'input' || part === 'select' || part === 'textarea') {
              if (n.tagName === part.toUpperCase()) out.push(n);
              continue;
            }
            const nameM = /\[name="([^"]+)"\]/.exec(part);
            if (nameM && n.name === nameM[1]) {
              const tag = part.split('[')[0];
              if (!tag || n.tagName === tag.toUpperCase()) out.push(n);
            }
          }
          if (parts.length === 1 && parts[0] === 'input, select, textarea') {
            /* handled below */
          }
          (n.childNodes || []).forEach(walk);
        };
        if (sel === 'input, select, textarea') {
          const walk2 = (n) => {
            if (!n || n.nodeType !== 1) return;
            if (/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName)) out.push(n);
            (n.childNodes || []).forEach(walk2);
          };
          walk2(this);
          return out;
        }
        walk(this);
        return out;
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true;
      },
      focus() {
        sandbox.document.activeElement = this;
      },
      setSelectionRange() {},
    };
    elements.push(node);
    return node;
  }

  const body = el('body');
  const sandbox = {
    window: {
      WDPApp: {
        utils: { ensureModule: () => ({ module: { safeLog() {} }, isValid: true, missingMethods: [] }), safeLog() {} },
        state: { originalForms: new Map() },
      },
      document: null,
      MutationObserver: class {
        observe() {}
        disconnect() {}
      },
    },
    document: {
      body,
      activeElement: null,
      createElement: el,
      querySelector: (s) => body.querySelector(s),
      querySelectorAll: (s) => body.querySelectorAll(s),
    },
    console,
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(code, sandbox);
  return { WDPApp: sandbox.window.WDPApp, el, body, document: sandbox.document };
}

test('capture + restore: donation_full_name ve phone korunur', () => {
  const { WDPApp, el, body } = loadDom();
  const form = el('form');
  body.appendChild(form);
  const name = el('input');
  name.setAttribute('name', 'donation_full_name');
  name.setAttribute('type', 'text');
  name.value = 'E2E Test';
  form.appendChild(name);
  const phone = el('input');
  phone.setAttribute('name', 'donation_phone');
  phone.setAttribute('type', 'tel');
  phone.value = '5551234567';
  form.appendChild(phone);

  const snap = WDPApp.dom.captureFormValues(form);
  assert.equal(snap.fields.length, 2);

  name.value = '';
  phone.value = '';
  WDPApp.dom.restoreFormValues(form, snap);
  assert.equal(name.value, 'E2E Test');
  assert.equal(phone.value, '5551234567');
});

test('innerHTML benzeri değişimde restore yeni node\'lara yazar', () => {
  const { WDPApp, el, body } = loadDom();
  const form = el('form');
  body.appendChild(form);
  const name1 = el('input');
  name1.setAttribute('name', 'donation_full_name');
  name1.value = 'Ali';
  form.appendChild(name1);

  const snap = WDPApp.dom.captureFormValues(form);
  // Simüle: form içeriği değişti (eski node koptu)
  form.childNodes.length = 0;
  const name2 = el('input');
  name2.setAttribute('name', 'donation_full_name');
  name2.value = '';
  form.appendChild(name2);

  WDPApp.dom.restoreFormValues(form, snap);
  assert.equal(name2.value, 'Ali');
});

test('iskelet CSS kuralı pointer-events:none içerir', () => {
  const css = fs.readFileSync(
    path.join(root, 'assets/css/src/components/ux-enhancements.css'),
    'utf8'
  );
  assert.match(css, /wdp-is-skeleton[\s\S]*pointer-events:\s*none/);
});

test('modal.js capture/restore, inert ve skeleton disabled kilidi kullanır', () => {
  const js = fs.readFileSync(path.join(root, 'assets/js/src/modal.js'), 'utf8');
  assert.match(js, /captureModalFormValues|captureFormValues/);
  assert.match(js, /restoreModalFormValues|restoreFormValues/);
  assert.match(js, /setAttribute\('inert'/);
  assert.match(js, /setModalSkeletonBusy/);
  assert.match(js, /lockSkeletonControls/);
  assert.match(js, /wdpSkeletonLock/);
  // restore, wizard/phone kurulumundan sonra ve unlock öncesi
  const restoreAt = js.indexOf('restoreModalFormValues(modal, preserved)');
  const unlockAt = js.indexOf('setModalSkeletonBusy(modal, false)');
  assert.ok(restoreAt > 0 && unlockAt > restoreAt, 'restore unlock öncesi olmalı');
});

test('validateForm canlı forma yönlendirir', () => {
  const js = fs.readFileSync(path.join(root, 'assets/js/src/form/validate.js'), 'utf8');
  assert.match(js, /getLiveDonationForm/);
});

test('feedback ayrılmış node yerine canlı alan kullanır', () => {
  const js = fs.readFileSync(path.join(root, 'assets/js/src/form/feedback.js'), 'utf8');
  assert.match(js, /isConnected === false/);
  assert.match(js, /getLiveDonationForm/);
});
