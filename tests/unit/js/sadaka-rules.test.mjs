/**
 * Sadaka doğrulama kuralları (assets/js/src/form/sadaka-rules.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.resolve(__dirname, '../../../assets/js/src/form/sadaka-rules.js');

function loadRules() {
  const code = fs.readFileSync(rulesPath, 'utf8');
  const sandbox = { window: {}, console };
  sandbox.window.WDPApp = {};
  vm.runInNewContext(code, sandbox);
  return sandbox.window.WDPApp.sadakaRules;
}

const rules = loadRules();

test('parseAmount: 5566 / 5.566 / 5,566', () => {
  assert.equal(rules.parseAmount('5566'), 5566);
  assert.equal(rules.parseAmount('5.566'), 5566);
  assert.equal(rules.parseAmount('5,566'), 5566);
  assert.ok(Number.isNaN(rules.parseAmount('')));
  assert.ok(Number.isNaN(rules.parseAmount('abc')));
});

test('validateAmount: panel closed always ok', () => {
  assert.equal(rules.validateAmount({ panelOpen: false, raw: '' }).ok, true);
});

test('validateAmount: empty / 0 / negative', () => {
  assert.equal(rules.validateAmount({ panelOpen: true, raw: '' }).ok, false);
  assert.equal(rules.validateAmount({ panelOpen: true, raw: '' }).reason, 'empty');
  assert.equal(rules.validateAmount({ panelOpen: true, raw: '0' }).ok, false);
  assert.equal(rules.validateAmount({ panelOpen: true, raw: '-5' }).ok, false);
});

test('validateAmount: 5566 and locale forms', () => {
  assert.equal(rules.validateAmount({ panelOpen: true, raw: '5566' }).ok, true);
  assert.equal(rules.validateAmount({ panelOpen: true, raw: '5.566' }).value, 5566);
  assert.equal(rules.validateAmount({ panelOpen: true, raw: '5,566' }).value, 5566);
});

test('validateAmount: below min', () => {
  const r = rules.validateAmount({ panelOpen: true, raw: '50', min: 100 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'below_min');
});

test('validateAmount: fixed amount', () => {
  const r = rules.validateAmount({ panelOpen: true, raw: '', fixedAmount: 250 });
  assert.equal(r.ok, true);
  assert.equal(r.value, 250);
});
