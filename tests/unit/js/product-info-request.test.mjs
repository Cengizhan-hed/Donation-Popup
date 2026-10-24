/**
 * get_product_info: 0 id ile fetch yok; hata mesajı görünür.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

class FakeFormData {
  constructor() {
    this._map = new Map();
  }
  append(k, v) {
    this._map.set(String(k), String(v));
  }
  get(k) {
    return this._map.has(String(k)) ? this._map.get(String(k)) : null;
  }
}

function loadProduct(fetchImpl) {
  const code = fs.readFileSync(path.join(root, 'assets/js/src/product.js'), 'utf8');
  const productDataCache = new Map();
  const productInfoRequests = new Map();
  const toasts = [];
  const announced = [];
  const document = {
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { style: {}, classList: { add() {}, remove() {}, contains() { return false; } } }; },
    body: { appendChild() {} },
  };
  const utils = {
    ensureModule(name) {
      return { module: win.WDPApp[name] || {}, isValid: true, missingMethods: [] };
    },
    safeLog() {},
    getAjaxNonce() { return 'n'; },
    formatCurrency(v) { return String(v); },
    formatPrice(v) { return String(v); },
    formatMinPlaceholder() { return ''; },
    applyCurrencyShellPosition() {},
    announceStatus(msg) { announced.push(msg); },
    isValidProductId(value) {
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) && n > 0;
    },
    productInfoErrorMessage(data) {
      if (data && typeof data.message === 'string' && data.message.trim()) return data.message.trim();
      if (data && data.data && typeof data.data.message === 'string') return data.data.message.trim();
      return '';
    },
    showToast(opts) { toasts.push(opts || {}); },
    classifyAjaxFailure(status, data) {
      const st = Number(status) || 0;
      const code = data && data.code;
      const msg = String((data && data.message) || (data && data.data && data.data.message) || '').toLowerCase();
      if (st === 429 || code === 'rate_limit' || /çok fazla istek/.test(msg)) return 'rate';
      if (/geçersiz ürün|ürün bulunamadı/.test(msg)) return 'id';
      if (st === 403 || code === 'nonce') return 'nonce';
      return '';
    },
    refreshWdpAjaxNonces() {
      win.wdp_ajax.nonces.get_product_info = 'fresh';
      return Promise.resolve(true);
    },
  };
  const win = {
    wdp_ajax: {
      ajax_url: 'https://example.test/wp-admin/admin-ajax.php',
      nonces: { get_product_info: 'n' },
      strings: { error: 'Bir hata oluştu' },
    },
    document,
    WDPApp: { utils, state: { productPrices: {}, productDataCache, productInfoRequests } },
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    AbortController,
  };
  win.window = win;
  vm.runInNewContext(code, {
    window: win,
    document,
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    FormData: FakeFormData,
    fetch: fetchImpl,
  });
  return { product: win.WDPApp.product, toasts, announced, fetchCalls: fetchImpl._calls };
}

function mockFetch() {
  const calls = [];
  const fn = (url, opts) => {
    calls.push({ url, opts });
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ success: true, product_name: 'X' })),
    });
  };
  fn._calls = calls;
  return fn;
}

test('product_id 0 / geçersiz ile fetch atılmaz', async () => {
  const fetchImpl = mockFetch();
  const { product } = loadProduct(fetchImpl);
  const r0 = await product.getData(0);
  const rEmpty = await product.getData('');
  const rNeg = await product.getData(-4);
  assert.equal(r0, null);
  assert.equal(rEmpty, null);
  assert.equal(rNeg, null);
  assert.equal(fetchImpl._calls.length, 0);
});

test('geçerli id ile fetch gider', async () => {
  const fetchImpl = mockFetch();
  const { product } = loadProduct(fetchImpl);
  const data = await product.getData(9);
  assert.equal(fetchImpl._calls.length, 1);
  const body = fetchImpl._calls[0].opts.body;
  assert.ok(body instanceof FormData || (body && typeof body.get === 'function'));
  if (body && typeof body.get === 'function') {
    assert.equal(body.get('product_id'), '9');
    assert.equal(body.get('action'), 'wdp_get_product_info');
  }
  assert.equal(data.success, true);
});

test('403 nonce yanıtında bir kez taze nonce ile yeniden dener', async () => {
  let n = 0;
  const fetchImpl = () => {
    n += 1;
    if (n === 1) {
      return Promise.resolve({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({ success: false, code: 'nonce', message: 'Güvenlik' })),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ success: true, product_name: 'Y' })),
    });
  };
  fetchImpl._calls = [];
  const { product } = loadProduct(fetchImpl);
  const data = await product.getData(8);
  assert.equal(n, 2);
  assert.equal(data.success, true);
});

test('429 yanıtında kullanıcıya istek sınırı mesajı', async () => {
  const fetchImpl = () => Promise.resolve({
    ok: false,
    status: 429,
    text: () => Promise.resolve(JSON.stringify({
      success: false,
      code: 'rate_limit',
      message: 'Çok fazla istek gönderildi. Lütfen bir süre bekleyip tekrar deneyin.',
    })),
  });
  fetchImpl._calls = [];
  const { product, toasts, announced } = loadProduct(fetchImpl);
  await product.fetch(12, {});
  const texts = [...toasts.map((t) => t.message), ...announced].join(' ');
  assert.match(texts, /çok fazla istek/i);
});

test('400 yanıtında kullanıcıya görünür mesaj', async () => {
  const fetchImpl = () => Promise.resolve({
    ok: false,
    status: 400,
    text: () => Promise.resolve(JSON.stringify({
      success: false,
      data: { message: 'Geçersiz ürün ID' },
    })),
  });
  fetchImpl._calls = [];
  const { product, toasts, announced } = loadProduct(fetchImpl);
  await product.fetch(12, {});
  const texts = [...toasts.map((t) => t.message), ...announced].join(' ');
  assert.match(texts, /Geçersiz ürün ID|alınamadı|could not be loaded/);
});
