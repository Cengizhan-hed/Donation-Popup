/**
 * CSSOM teşhis: Blocksy ct-hidden-sm (tema) vs eklenti yolu vs native-cart CSS.
 * Yerel sahte sayfa — uzak yok, kişisel veri yok.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from '@playwright/test';
import {
  PLUGIN_STYLE_PATH,
  diagnoseRelatedHideBrowser,
  classifyRelatedHideSource,
  decideRelatedHideOutcome,
} from '../../../tests/e2e/helpers/css-hide-source.mjs';
import { classifySkip, makeSkip } from '../../../tests/e2e/helpers/skip-policy.mjs';

/** 10.34.6 hide_native_cart_css — ilgili bölümü hedeflemez. */
const HIDE_NATIVE_CART_CSS =
  'body.single-product form.cart:not(.wdp-form):not(.wdp-donation-form-fields)' +
  ':not(.related form.cart):not(.upsells form.cart):not(ul.products form.cart)' +
  ':not(.wdp-list form.cart):not(.wdp-donations form.cart)' +
  ':not(.wp-block-woocommerce-related-products form.cart)' +
  ':not(.wp-block-woocommerce-product-collection form.cart),' +
  'body.single-product .single_add_to_cart_button:not(.wdp-donate-button):not(.wdp-open-modal):not(.wdp-loop-donate)' +
  ':not(.related .single_add_to_cart_button):not(.upsells .single_add_to_cart_button)' +
  ':not(ul.products .single_add_to_cart_button)' +
  ':not(.wp-block-woocommerce-related-products .single_add_to_cart_button)' +
  ':not(.wp-block-woocommerce-product-collection .single_add_to_cart_button),' +
  'body.single-product [class*="sticky-add-to-cart"],body.single-product [class*="sticky"][class*="add-to-cart"]' +
  '{display:none!important}';

const THEME_CSS_PATH = '/wp-content/themes/blocksy/static/bundle/main.min.css';
const PLUGIN_CSS_PATH = '/wp-content/plugins/woo-donation-popup/assets/css/frontend.css';

const RELATED_HTML = `
<section class="related products" id="related">
  <h2>Benzer Bağışlar</h2>
  <ul class="products">
    <li class="product">
      <h2 class="woocommerce-loop-product__title">Sample</h2>
      <form class="cart"><button type="submit" class="single_add_to_cart_button">Add</button></form>
      <a href="#">Donate</a>
    </li>
  </ul>
</section>`;

/** @type {http.Server} */
let server;
/** @type {number} */
let port;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname === THEME_CSS_PATH) {
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
        res.end('@media (max-width: 2000px) { .ct-hidden-sm { display: none !important; } }\n');
        return;
      }
      if (url.pathname === PLUGIN_CSS_PATH) {
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
        res.end('.related { display: none !important; }\n');
        return;
      }
      if (url.pathname === '/theme-hides.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><head>
          <link rel="stylesheet" href="${THEME_CSS_PATH}">
        </head><body class="single-product">
          <div class="summary entry-summary"><form class="cart"><button class="single_add_to_cart_button">Add</button></form></div>
          <section class="related products ct-hidden-sm">
            <h2>Benzer Bağışlar</h2>
            <ul class="products"><li class="product"><h2 class="woocommerce-loop-product__title">Sample</h2><a>Donate</a></li></ul>
          </section>
        </body></html>`);
        return;
      }
      if (url.pathname === '/plugin-hides.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><head>
          <link rel="stylesheet" href="${PLUGIN_CSS_PATH}">
        </head><body class="single-product">${RELATED_HTML}</body></html>`);
        return;
      }
      if (url.pathname === '/plugin-spares.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><head>
          <style id="wdp-hide-native-cart">${HIDE_NATIVE_CART_CSS}</style>
        </head><body class="single-product">
          <div class="summary entry-summary">
            <form class="cart" id="summary-cart"><button type="submit" class="single_add_to_cart_button" id="summary-btn">Add</button></form>
          </div>
          ${RELATED_HTML}
        </body></html>`);
        return;
      }
      res.writeHead(404);
      res.end('no');
    });
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });
}

async function diagnose(page) {
  return page.evaluate(diagnoseRelatedHideBrowser, {
    pluginPath: PLUGIN_STYLE_PATH,
    rootSel: '.related.products, section.related',
    similarPat: 'benzer\\s*bağış',
    cardSel: 'li.product',
  });
}

describe('css-hide-source Playwright', () => {
  before(async () => {
    await startServer();
  });
  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('ct-hidden-sm tema CSS → theme-hides-related atlama', async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}/theme-hides.html`, { waitUntil: 'load' });
      const diag = await diagnose(page);
      assert.equal(diag.hiding, true);
      assert.match(String(diag.className), /ct-hidden-sm/);
      assert.equal(diag.computed.display, 'none');
      assert.match(String(diag.selector), /ct-hidden-sm/);
      assert.equal(diag.source, THEME_CSS_PATH);
      const cls = classifyRelatedHideSource(diag);
      assert.equal(cls.verdict, 'theme');
      assert.equal(cls.check, 'theme-hides-related');
      const out = decideRelatedHideOutcome(diag);
      assert.equal(out.action, 'skip');
      assert.equal(
        classifySkip(
          makeSkip({
            check: out.check,
            reason: out.reason,
            evidence: out.evidence,
            source: out.source,
            detail: out.detail,
          })
        ),
        'skip'
      );
    } finally {
      await browser.close();
    }
  });

  it('eklenti stil dosyası .related gizler → plugin-hides-related', async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}/plugin-hides.html`, { waitUntil: 'load' });
      const diag = await diagnose(page);
      assert.equal(diag.hiding, true);
      assert.equal(diag.source, PLUGIN_CSS_PATH);
      assert.match(String(diag.selector), /related/);
      const cls = classifyRelatedHideSource(diag);
      assert.equal(cls.verdict, 'plugin');
      assert.equal(cls.check, 'plugin-hides-related');
      assert.equal(decideRelatedHideOutcome(diag).action, 'fail');
    } finally {
      await browser.close();
    }
  });

  it('hide_native_cart_css ilgili bölümü ve döngü formunu gizlemez', async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}/plugin-spares.html`, { waitUntil: 'load' });
      const vis = await page.evaluate(() => {
        const st = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return { display: 'missing' };
          const c = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return { display: c.display, w: Math.round(r.width), h: Math.round(r.height) };
        };
        return {
          summary: st('#summary-cart'),
          related: st('section.related'),
          relatedForm: st('.related form.cart'),
          relatedCard: st('.related li.product'),
        };
      });
      assert.equal(vis.summary.display, 'none');
      assert.notEqual(vis.related.display, 'none');
      assert.ok(vis.related.h > 4, JSON.stringify(vis.related));
      assert.notEqual(vis.relatedForm.display, 'none');
      assert.ok(vis.relatedCard.h > 4, JSON.stringify(vis.relatedCard));
      const diag = await diagnose(page);
      assert.equal(diag.hiding, false);
      assert.equal(classifyRelatedHideSource(diag).verdict, 'visible');
    } finally {
      await browser.close();
    }
  });
});
