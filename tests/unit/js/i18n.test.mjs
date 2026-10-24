/**
 * WDPApp.i18n — sözlük, bağlam, sprintf (Node vm).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const src = fs.readFileSync(path.join(root, 'assets/js/src/core/i18n.js'), 'utf8');

function load(dict = {}) {
  const context = {
    window: { wdp_ajax: { i18n_dict: dict } },
    globalThis: {},
  };
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(src, context);
  return context.window.WDPApp.i18n;
}

test('sözlükte yoksa kaynak metin döner', () => {
  const i18n = load({});
  assert.equal(i18n.__('Save', 'woo-donation-popup'), 'Save');
  assert.equal(i18n._x('Save', 'button', 'woo-donation-popup'), 'Save');
});

test('sözlükte olan msgid çevrilir', () => {
  const i18n = load({ Save: 'Kaydet', Hello: 'Merhaba' });
  assert.equal(i18n.__('Save', 'woo-donation-popup'), 'Kaydet');
  assert.equal(i18n.__('Missing', 'woo-donation-popup'), 'Missing');
});

test('bağlam anahtarı ctx\\u0004msg', () => {
  const i18n = load({
    Save: 'Kaydet',
    ['button\u0004Save']: 'Kaydet (düğme)',
  });
  assert.equal(i18n._x('Save', 'button', 'woo-donation-popup'), 'Kaydet (düğme)');
  assert.equal(i18n._x('Save', 'title', 'woo-donation-popup'), 'Save');
});

test('sprintf %s %d %1$s %2$s %%', () => {
  const i18n = load({});
  assert.equal(i18n.sprintf('Hello %s', 'Ada'), 'Hello Ada');
  assert.equal(i18n.sprintf('n=%d', '12'), 'n=12');
  assert.equal(i18n.sprintf('%2$s-%1$s', 'A', 'B'), 'B-A');
  assert.equal(i18n.sprintf('100%%'), '100%');
  assert.equal(i18n.sprintf('%s %d', 'x', 3), 'x 3');
});
