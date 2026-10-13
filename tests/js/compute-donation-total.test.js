/**
 * Node unit test for computeDonationTotal (no framework).
 * Run: node tests/js/compute-donation-total.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pricingPath = path.join(__dirname, '../../assets/js/src/form/pricing.js');
const code = fs.readFileSync(pricingPath, 'utf8');

const sandbox = {
  window: {
    WDPApp: {
      state: { productPrices: { 1: 6000 } },
      utils: { formatCurrency: (v) => '₺' + String(v) },
    },
  },
  console,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const pricing = sandbox.window.WDPApp.formPricing;
assert.ok(pricing && typeof pricing.computeDonationTotal === 'function', 'computeDonationTotal exported');
assert.strictEqual(pricing.roundMoney(10.126), 10.13);
assert.ok(Number.isNaN(pricing.parseNormalizedAmount('')));

let JSDOM = null;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (e) {
  JSDOM = null;
}

if (!JSDOM) {
  console.log('OK compute-donation-total (helpers; jsdom not installed)');
  process.exit(0);
}

function fakeForm(html, unitPrice) {
  const dom = new JSDOM(`<!DOCTYPE html><body><div class="wdp-modal" data-wdp-unit-price="${unitPrice}"><form>${html}</form></div></body>`);
  return dom.window.document.querySelector('form');
}

const formFixed = fakeForm(
  '<div class="wdp-fixed-price-counter-row"><input name="quantity" value="3" /></div>',
  6000
);
assert.strictEqual(pricing.computeDonationTotal(formFixed).total, 18000);

const formShare = fakeForm('<input name="share_count" value="1" />', 6000);
assert.strictEqual(pricing.computeDonationTotal(formShare).total, 6000);

const formShare3 = fakeForm('<input name="share_count" value="3" />', 6000);
assert.strictEqual(pricing.computeDonationTotal(formShare3).total, 18000);

const formCustomEmpty = fakeForm(
  '<div class="wdp-custom-price-row"><input name="custom_price" value="" class="wdp-custom-price-input" /></div>',
  0
);
assert.strictEqual(pricing.computeDonationTotal(formCustomEmpty).total, null);

console.log('OK compute-donation-total');
