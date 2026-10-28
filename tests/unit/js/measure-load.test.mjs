import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePage, PAGES } from '../../../scripts/measure-load.mjs';

const BASE = 'http://127.0.0.1:8921';

test('parsePage: harici kaynakları, render engelleyenleri ve satır içi blokları sayar', () => {
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="/wp-content/plugins/woo-donation-popup/assets/build/experiences/index.css?ver=1">
    <link rel="stylesheet" href="/a.css" media="print">
    <script src="/head.js"></script>
    <script src="/deferred.js" defer></script>
    <style>.a{}</style>
  </head><body><script>var x=1;</script><div class="dp dp-exp" data-dp-exp></div>
  <script src="/wp-content/plugins/woo-donation-popup/assets/build/experiences/index.js" defer></script></body></html>
  <!--wdp-probe {"queries":7,"sql":[],"autoload":10,"owned":{}}-->`;
  const parsed = parsePage(html, BASE);
  assert.equal(parsed.resources.length, 5);
  assert.deepEqual(parsed.blocking.sort(), ['/head.js', '/wp-content/plugins/woo-donation-popup/assets/build/experiences/index.css?ver=1'].sort());
  assert.equal(parsed.inlineStyles, 1);
  assert.equal(parsed.inlineScripts, 1);
  assert.equal(parsed.probe.queries, 7);
  assert.ok(parsed.markers >= 2, 'eklenti DOM işaretleri sayılmalı');
});

test('parsePage: ürün adı/slug içindeki "wdp-" eklenti DOM sayılmaz', () => {
  const parsed = parsePage('<html><body><li class="product post-1 product_cat-wdp-e2e"><a href="/product/wdp-e2e-x/">x</a></li></body></html>', BASE);
  assert.equal(parsed.markers, 0);
});

test('PAGES: arayüzsüz sayfa türleri kapsanır (ana, blog, sayfa, bağış dışı ürün, mağaza, sepet, ödeme, hesabım)', () => {
  const none = PAGES.filter((p) => !p.ui).map((p) => p.page);
  for (const expected of ['home', 'blog', 'page', 'plainprod', 'shop', 'cart', 'checkout', 'account']) {
    assert.ok(none.includes(expected), expected);
  }
});
