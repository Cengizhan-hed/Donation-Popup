#!/usr/bin/env node
/**
 * Çakışma denetimi koşucusu.
 *
 *   npm run e2e:conflicts -- --env staging|ikram [--device iphone|android|desktop|all]
 *   npm run e2e:conflicts -- --env local [--device desktop]   (yerel TT5/Storefront + uzak benzetim)
 *
 * Sipariş yok; ödeme formu doldurulmaz. Uzak: ağ/sipariş/oturum korumaları.
 * Uzak koşu yalnız Claude (REMOTE_FREEZE + operatör kapısı).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseConflictsArgs,
  canonicalConflictsEnv,
  conflictsDirFor,
  classifyConsoleEvent,
  consoleVerdict,
  detectLibraryCopies,
  evaluateWdpGlobals,
  evaluateJqueryDollar,
  scriptsVerdict,
  evaluatePhoneIntegrity,
  phoneVerdict,
  evaluateCheckoutFields,
  evaluateCurcy,
  fieldsVerdict,
  diffChromeStyles,
  cssVerdict,
  cacheVerdict,
  VERDICT,
  MIN_TOUCH_PX,
  isPluginCssUrl,
  formatConflictsSummary,
  writeConflictsSummary,
  rowHasFinding,
  countReds,
  simRemoteScriptUrls,
  simRemotePhoneProbe,
  simRemoteCheckoutProbe,
  simRemoteCurcyProbe,
  simRemoteConsoleEvents,
  PAGE_IDS,
} from './helpers/conflicts.mjs';
import { ROOT, loadE2EEnv, withCacheBust } from './helpers/env.mjs';
import { fillMissingProductSlugs } from './helpers/resolve-products.mjs';
import { installBrowserGuard } from './helpers/network-guard.mjs';
import { getDevicePreset } from './helpers/devices.mjs';
import { SEL } from './helpers/selectors.mjs';
import {
  openShellLocator,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
} from './helpers/checks.mjs';
import { isRemoteProfile, setActiveProfile, loadProfile } from './helpers/profile.mjs';
import { isRemoteFrozen, FREEZE_MESSAGE, assertOperatorGate, OPERATOR_GATE_MESSAGE } from '../../scripts/lib/remote-guard.mjs';
import { ensureAuth } from './helpers/auth.mjs';
import { applyComingSoonBypass, comingSoonQuery } from './helpers/coming-soon.mjs';
import {
  loadMatrix,
  resolveConfig,
} from './helpers/matrix-cover.mjs';
import {
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
} from './helpers/matrix-setup.mjs';

const CHECK_MS = 20000;
const LOCAL_CONFIGS = ['tt5-try-blocks-hpos', 'sf-gbp-classic-hpos'];

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function extraQuery(env) {
  const q = { hdf_no_side_cart: '1' };
  const profile = env?._profile;
  if (profile?.comingSoon) Object.assign(q, comingSoonQuery(env, profile));
  return q;
}

async function gotoPath(page, baseUrl, pathName, env, cacheBust = true) {
  const p = pathName || '/';
  const url = cacheBust ? withCacheBust(baseUrl, p, extraQuery(env)) : joinUrl(baseUrl, p);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CHECK_MS });
}

function joinUrl(base, pathName) {
  const root = String(base || '').replace(/\/$/, '');
  if (/^https?:\/\//i.test(pathName)) return pathName;
  const p = pathName.startsWith('/') ? pathName : `/${pathName}`;
  return `${root}${p}`;
}

function attachConflictCollector(page) {
  /** @type {Array<{ text: string, url: string, stack: string }>} */
  const events = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = String(msg.text() || '');
    if (/pass(word)?=/i.test(text)) return;
    const loc = typeof msg.location === 'function' ? msg.location() : {};
    events.push({
      text: text.slice(0, 300),
      url: loc && loc.url ? String(loc.url) : '',
      stack: '',
    });
  });
  page.on('pageerror', (err) => {
    events.push({
      text: String(err && err.message ? err.message : err).slice(0, 300),
      url: '',
      stack: String(err && err.stack ? err.stack : '').slice(0, 800),
    });
  });
  page.on('response', (res) => {
    const status = res.status();
    if (status !== 404 && status < 500) return;
    const url = res.url();
    if (/pass(word)?=/i.test(url)) return;
    events.push({
      text: `HTTP ${status}`,
      url: url.slice(0, 220),
      stack: '',
    });
  });
  return events;
}

async function waitIdle(page) {
  await page.waitForFunction(() => document.readyState === 'complete' || window.wdp_ajax, {
    timeout: CHECK_MS,
  });
}

async function collectScripts(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('script[src]'))
      .map((s) => s.getAttribute('src') || '')
      .filter(Boolean)
  );
}

async function collectGlobals(page) {
  return page.evaluate(() => {
    const keys = Object.getOwnPropertyNames(window).filter((k) => /^wdp/i.test(k));
    const ajax = window.wdp_ajax;
    const t = typeof ajax;
    return {
      keys,
      wdpAjaxType: t,
      wdpAjaxHasUrl: !!(ajax && ajax.ajax_url),
    };
  });
}

async function collectJquery(page) {
  return page.evaluate(() => {
    const jq = window.jQuery;
    const hasJQuery = typeof jq === 'function';
    const dollarType = typeof window.$;
    let dollarIsJQuery = false;
    if (hasJQuery && dollarType === 'function') dollarIsJQuery = window.$ === jq;
    return {
      hasJQuery,
      jqueryVersion: hasJQuery && jq.fn && jq.fn.jquery ? String(jq.fn.jquery) : '',
      dollarIsJQuery,
      dollarType,
    };
  });
}

async function collectPhone(page) {
  return page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll('.wdp-phone-field, [data-wdp-phone-field]'));
    let flagCount = 0;
    let countryBtnCount = 0;
    let itiOnWdp = 0;
    let wcipiOnWdp = 0;
    for (const f of fields) {
      flagCount += f.querySelectorAll('.iti__flag, .wdp-phone-field__flag, [class*="iti__flag"]').length;
      countryBtnCount += f.querySelectorAll(
        '.wdp-phone-field__code-btn, .iti__selected-flag, .wcipi-flag, [class*="country-selector"]'
      ).length;
      itiOnWdp += f.querySelectorAll('.iti, .intl-tel-input, [data-intl-tel-input-id]').length;
      wcipiOnWdp += f.querySelectorAll('[class*="wcipi"], .wcipi-wrap, .wcipi-container').length;
      const inp = f.querySelector('input[name="donation_phone"], input[type="tel"]');
      if (inp && (inp.classList.contains('iti') || inp.getAttribute('data-intl-tel-input-id'))) itiOnWdp += 1;
    }
    return {
      wdpPhoneCount: fields.length,
      flagCount,
      countryBtnCount,
      itiOnWdp,
      wcipiOnWdp,
      itiGlobalOnWdp: fields.some((f) => {
        const inp = f.querySelector('input');
        return !!(inp && window.intlTelInputGlobals && typeof window.intlTelInputGlobals.getInstance === 'function' && window.intlTelInputGlobals.getInstance(inp));
      }),
    };
  });
}

async function collectCheckout(page) {
  return page.evaluate(() => {
    const form = document.querySelector(
      'form.woocommerce-checkout, form.checkout, .wc-block-checkout, .wp-block-woocommerce-checkout'
    );
    const phones = Array.from(
      document.querySelectorAll(
        '#billing_phone, input[name="billing_phone"], .wc-block-components-address-form__phone input'
      )
    );
    const vis = phones.filter((el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    });
    const cfe = document.querySelectorAll(
      '.thwcfd-field, [class*="thwcfd"], .woo-checkout-field-editor, [id^="billing_"][class*="thwcfd"]'
    );
    return {
      checkoutForm: !!form,
      billingPhoneVisible: vis.length,
      billingPhoneTotal: phones.length,
      cfeFieldsVisible: cfe.length,
    };
  });
}

async function collectCurcy(page) {
  return page.evaluate(() => {
    const widgets = Array.from(
      document.querySelectorAll(
        '.wmc-currency, .woo-multi-currency, [class*="wmc-currency"], .wmc-list-currencies'
      )
    );
    const form =
      document.querySelector('form.wdp-donation-form-fields, .hdf-donation-modal-wrapper.wdp-modal.show') ||
      document.querySelector('form.wdp-donation-form-fields');
    let overlapsForm = false;
    let formVisible = null;
    if (form) {
      const fr = form.getBoundingClientRect();
      const st = getComputedStyle(form);
      formVisible =
        st.display !== 'none' && st.visibility !== 'hidden' && fr.width > 0 && fr.height > 0;
      for (const w of widgets) {
        const r = w.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const hit = !(r.right <= fr.left || r.left >= fr.right || r.bottom <= fr.top || r.top >= fr.bottom);
        if (hit) overlapsForm = true;
      }
    }
    return { curcyCount: widgets.length, overlapsForm, formVisible };
  });
}

async function snapshotChrome(page) {
  return page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      if (el.closest('.wdp-modal, .hdf-donation-modal-wrapper, [class*="wdp-"]')) return null;
      const cs = getComputedStyle(el);
      return {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        margin: cs.margin,
        padding: cs.padding,
      };
    };
    const body = getComputedStyle(document.body);
    return {
      body: {
        color: body.color,
        backgroundColor: body.backgroundColor,
        fontFamily: body.fontFamily,
        fontSize: body.fontSize,
        margin: body.margin,
        padding: body.padding,
      },
      heading: pick('.wp-block-site-title, .site-title, header h1, h1, .wp-block-site-title a'),
      menu: pick('header nav, .wp-block-navigation, .main-navigation, #site-navigation, nav'),
      footer: pick('footer, .site-footer, .wp-block-template-part'),
      wooButton: pick(
        '.single_add_to_cart_button, .woocommerce a.button, .wp-block-button__link, button.alt'
      ),
    };
  });
}

async function collectFormLayout(page) {
  return page.evaluate((min) => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth > doc.clientWidth + 1;
    const form =
      document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show form.wdp-donation-form-fields') ||
      document.querySelector('form.wdp-donation-form-fields') ||
      document.querySelector('.wdp-modal-content');
    if (!form) {
      return { overflow, formVisible: null, clipped: false, badTouch: [] };
    }
    const st = getComputedStyle(form);
    const box = form.getBoundingClientRect();
    const formVisible =
      st.display !== 'none' && st.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const clipped = box.right > vw + 2 || box.left < -2;
    const nodes = Array.from(
      form.querySelectorAll(
        'button, a[href], [role="button"], .wdp-amount-preset, input[type="checkbox"]'
      )
    );
    const badTouch = [];
    for (const el of nodes) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 0 || r.height <= 0) continue;
      if (r.width + 1 < min || r.height + 1 < min) {
        badTouch.push({
          tag: el.tagName,
          name: (el.getAttribute('name') || el.className || '').toString().slice(0, 60),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return { overflow, formVisible, clipped, badTouch };
  }, MIN_TOUCH_PX);
}

async function probeProductAjax(page, productId) {
  return page.evaluate(async (id) => {
    const ajax = window.wdp_ajax;
    if (!ajax || !ajax.ajax_url) {
      return { noncePresent: false, ok: false, skipped: false, status: 0, success: false };
    }
    const nonce = (ajax.nonces && ajax.nonces.get_product_info) || '';
    if (!nonce) return { noncePresent: false, ok: false, status: 0, success: false };
    const body = new URLSearchParams();
    body.set('action', 'wdp_get_product_info');
    body.set('product_id', String(id || 0));
    body.set('security', nonce);
    let status = 0;
    let success = false;
    try {
      const res = await fetch(ajax.ajax_url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: body.toString(),
      });
      status = res.status;
      const json = await res.json();
      success = !!(json && json.success);
    } catch (e) {
      return { noncePresent: true, ok: false, status, success: false };
    }
    return { noncePresent: true, ok: status < 400 && success, status, success };
  }, Number(productId) || 0);
}

async function probeAddToCartNonce(page) {
  return page.evaluate(async () => {
    const ajax = window.wdp_ajax;
    if (!ajax || !ajax.ajax_url) return { skipped: true, nonceFail: false };
    const nonce = (ajax.nonces && ajax.nonces.ajax_add_to_cart) || ajax.nonce || '';
    if (!nonce) return { skipped: false, nonceFail: true };
    const body = new URLSearchParams();
    body.set('action', 'wdp_ajax_add_to_cart');
    body.set('security', nonce);
    try {
      const res = await fetch(ajax.ajax_url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: body.toString(),
      });
      const status = res.status;
      const text = await res.text();
      const nonceFail = status === 403 || text === '-1' || text === '0' || text === '-1\n';
      return { skipped: false, nonceFail, status };
    } catch (e) {
      return { skipped: false, nonceFail: true, status: 0 };
    }
  });
}

async function openFormIfNeeded(page, pageId, ctx) {
  if (pageId === 'cart' || pageId === 'checkout') return;
  if (pageId === 'product') {
    const inline = page.locator(`${SEL.inlineDonationForm} ${SEL.donationForm}, ${SEL.donationForm}`).first();
    if ((await inline.count()) > 0 && (await inline.isVisible())) return;
    const trigger = page.locator(`${SEL.donateTrigger}, ${SEL.sidePanelTrigger}`).first();
    if ((await trigger.count()) === 0) return;
    await trigger.waitFor({ state: 'visible', timeout: CHECK_MS });
    await clickShellTrigger(trigger, CHECK_MS);
    const shell = openShellLocator(page, '');
    await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
    return;
  }
  if (pageId === 'shop') {
    const list = page.locator('.wdp-list-wrap, .wdp-list').first();
    if ((await list.count()) === 0) return;
    await list.waitFor({ state: 'visible', timeout: CHECK_MS });
    if (ctx.productId) await revealListProductTrigger(page, ctx.productId);
    const trigger = shellTriggerLocator(page, 'popup', { productId: ctx.productId || 0 });
    if ((await trigger.count()) === 0) return;
    await clickShellTrigger(trigger, CHECK_MS);
    const shell = openShellLocator(page, 'popup');
    await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
    return;
  }
  if (pageId === 'panel') {
    const trigger = page.locator(SEL.sidePanelTrigger).first();
    if ((await trigger.count()) === 0) {
      const any = page.locator(SEL.donateTrigger).first();
      if ((await any.count()) === 0) return;
      await clickShellTrigger(any, CHECK_MS);
    } else {
      await clickShellTrigger(trigger, CHECK_MS);
    }
    const shell = openShellLocator(page, 'panel');
    await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  }
}

async function applyCssBlock(page) {
  const handler = async (route) => {
    if (isPluginCssUrl(route.request().url())) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.fallback();
  };
  await page.route('**/*', handler);
  return handler;
}

async function shotFinding(page, dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

function pathFromProbe(probe, env, pageId) {
  if (pageId === 'product' || pageId === 'panel') {
    return (
      probe?.products?.custom?.path ||
      probe?.products?.fixed?.path ||
      env?.E2E_PRODUCT_CUSTOM ||
      env?.E2E_PRODUCT_FIXED ||
      ''
    );
  }
  if (pageId === 'shop') {
    return probe?.listPath || env?.E2E_LIST_PAGE || env?.E2E_SHOP_PAGE || '';
  }
  if (pageId === 'cart') {
    const u = probe?.cartUrl || env?.E2E_CART_PAGE || '/cart/';
    try {
      return /^https?:\/\//i.test(u) ? new URL(u).pathname : u;
    } catch {
      return '/cart/';
    }
  }
  if (pageId === 'checkout') {
    const u = probe?.checkoutUrl || env?.E2E_CHECKOUT_PAGE || '/checkout/';
    try {
      return /^https?:\/\//i.test(u) ? new URL(u).pathname : u;
    } catch {
      return '/checkout/';
    }
  }
  return '/';
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {object} ctx
 */
function firstFinding(...parts) {
  const red = parts.find((p) => p && p.verdict === VERDICT.red);
  if (red) return red.finding || '';
  const warn = parts.find((p) => p && p.verdict === VERDICT.warn);
  return warn?.finding || '';
}

async function runPageChecks(page, ctx) {
  const events = ctx.events;
  const classified = (events || []).map((e) => classifyConsoleEvent(e));
  const con = consoleVerdict(classified);

  const srcs = await collectScripts(page);
  const glob = await collectGlobals(page);
  const jq = await collectJquery(page);
  const copies = detectLibraryCopies(srcs);
  const globals = evaluateWdpGlobals(glob.keys, glob);
  const dollar = evaluateJqueryDollar(jq);
  const scr = scriptsVerdict(copies, globals, dollar);

  const phone = phoneVerdict(evaluatePhoneIntegrity(await collectPhone(page)));
  const checkout = evaluateCheckoutFields(await collectCheckout(page));
  const curcy = evaluateCurcy(await collectCurcy(page));
  const fld = fieldsVerdict(phone, checkout, curcy, { pageId: ctx.pageId });

  const formLayout = await collectFormLayout(page);
  const withCss = ctx.chromeWithCss || (await snapshotChrome(page));
  const cssHandler = await applyCssBlock(page);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: CHECK_MS });
  await waitIdle(page);
  const withoutCss = await snapshotChrome(page);
  await page.unroute('**/*', cssHandler);
  const cssDiff = diffChromeStyles(withCss, withoutCss);
  const css = cssVerdict(cssDiff, formLayout);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: CHECK_MS });
  await waitIdle(page);
  let ajax = { skipped: true, reason: 'wdp_ajax yok' };
  const hasAjax = await page.evaluate(() => !!(window.wdp_ajax && window.wdp_ajax.ajax_url));
  if (hasAjax && ctx.productId && ctx.pageId !== 'checkout') {
    const first = await probeProductAjax(page, ctx.productId);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: CHECK_MS });
    await waitIdle(page);
    const second = await probeProductAjax(page, ctx.productId);
    let addToCart = { skipped: true, nonceFail: false };
    if (ctx.pageId === 'product') addToCart = await probeAddToCartNonce(page);
    ajax = { ...second, addToCart };
    if (!first.noncePresent && second.noncePresent) ajax = second;
  } else if (ctx.pageId === 'checkout') {
    ajax = { skipped: true, reason: 'checkout-view-only' };
  }
  const cache = cacheVerdict(ajax);
  const cacheV = cache.verdict === VERDICT.skip ? { verdict: VERDICT.pass, finding: '' } : cache;

  return {
    console: con.verdict,
    scripts: scr.verdict,
    fields: fld.verdict,
    css: css.verdict,
    cache: cacheV.verdict,
    finding: firstFinding(con, scr, fld, css, cacheV),
  };
}

function runSimRemote() {
  const rows = [];
  const cons = simRemoteConsoleEvents().map((e) => classifyConsoleEvent(e));
  const cv = consoleVerdict(cons);
  rows.push({
    id: 'konsol-sınıflama',
    expected: VERDICT.red,
    actual: cv.verdict,
    finding: cv.finding,
    ok: cv.verdict === VERDICT.red && cons.some((c) => !c.red && c.source === 'other-plugin'),
  });
  const copies = detectLibraryCopies(simRemoteScriptUrls());
  const sv = scriptsVerdict(
    copies,
    evaluateWdpGlobals(['wdp_ajax', 'wdpForeign'], { wdpAjaxType: 'object', wdpAjaxHasUrl: true }),
    evaluateJqueryDollar({ hasJQuery: true, dollarType: 'function', dollarIsJQuery: false })
  );
  rows.push({
    id: 'betik-kopya+global+$',
    expected: VERDICT.warn,
    actual: sv.verdict,
    finding: sv.finding,
    ok: sv.verdict === VERDICT.warn || sv.verdict === VERDICT.red,
  });
  const ph = phoneVerdict(evaluatePhoneIntegrity(simRemotePhoneProbe()));
  rows.push({
    id: 'çift-telefon-seçici',
    expected: VERDICT.red,
    actual: ph.verdict,
    finding: ph.finding,
    ok: ph.verdict === VERDICT.red,
  });
  const ch = evaluateCheckoutFields(simRemoteCheckoutProbe());
  rows.push({
    id: 'ödeme-telefon-çift',
    expected: VERDICT.red,
    actual: ch.ok ? VERDICT.pass : VERDICT.red,
    finding: ch.reason,
    ok: ch.ok === false,
  });
  const cu = evaluateCurcy(simRemoteCurcyProbe());
  rows.push({
    id: 'curcy-form-örtme',
    expected: VERDICT.red,
    actual: cu.ok ? VERDICT.pass : VERDICT.red,
    finding: cu.reason,
    ok: cu.ok === false,
  });
  const leak = diffChromeStyles(
    { heading: { color: 'rgb(0, 0, 0)' }, '.wdp-modal': { color: 'rgb(1, 1, 1)' } },
    { heading: { color: 'rgb(255, 0, 0)' }, '.wdp-modal': { color: 'rgb(2, 2, 2)' } }
  );
  const css = cssVerdict(leak, { formVisible: true, overflow: false, clipped: false, badTouch: [] });
  rows.push({
    id: 'css-sızıntı-başlık',
    expected: VERDICT.red,
    actual: css.verdict,
    finding: css.finding,
    ok: css.verdict === VERDICT.red && leak.leaked.includes('heading') && !leak.leaked.includes('.wdp-modal'),
  });
  const stale = cacheVerdict({ noncePresent: false, ok: false });
  rows.push({
    id: 'önbellek-nonce-yok',
    expected: VERDICT.red,
    actual: stale.verdict,
    finding: stale.finding,
    ok: stale.verdict === VERDICT.red,
  });
  return rows;
}

async function runDeviceOnTarget({ preset, env, baseUrl, probe, theme, pages, shotRoot, storageState }) {
  const browser = await preset.browserType.launch({ headless: true });
  installBrowserGuard(browser, env);
  const contextOpts = { ...preset.context };
  if (storageState) contextOpts.storageState = storageState;
  const context = await browser.newContext(contextOpts);
  if (env?._profile?.comingSoon) {
    await applyComingSoonBypass(context, env._profile, env);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(CHECK_MS);
  page.setDefaultNavigationTimeout(CHECK_MS);
  const events = attachConflictCollector(page);
  const rows = [];
  const productId =
    Number(probe?.products?.custom?.id || probe?.products?.fixed?.id || env?._resolvedProducts?.custom?.id || 0) || 0;
  try {
    for (const pageId of pages) {
      if (!PAGE_IDS.includes(pageId)) continue;
      events.length = 0;
      const target = pathFromProbe(probe, env, pageId);
      const t0 = Date.now();
      /** @type {object} */
      let checks = {
        console: VERDICT.skip,
        scripts: VERDICT.skip,
        fields: VERDICT.skip,
        css: VERDICT.skip,
        cache: VERDICT.skip,
        finding: '',
      };
      let shot = '';
      try {
        if (!target) {
          checks.finding = `atlandı: ${pageId} yolu yok`;
          checks.console = VERDICT.pass;
          checks.scripts = VERDICT.pass;
          checks.fields = VERDICT.pass;
          checks.css = VERDICT.pass;
          checks.cache = VERDICT.pass;
        } else {
          await gotoPath(page, baseUrl, target, env, true);
          await waitIdle(page);
          const chromeWithCss = await snapshotChrome(page);
          await openFormIfNeeded(page, pageId, { productId });
          checks = await runPageChecks(page, { pageId, productId, events, env, chromeWithCss });
        }
      } catch (e) {
        checks.console = VERDICT.red;
        checks.finding = String(e && e.message ? e.message : e).slice(0, 240);
      }
      if (rowHasFinding({ ...checks })) {
        try {
          shot = await shotFinding(page, shotRoot, `${pageId}-${preset.id}`);
          shot = path.relative(ROOT, shot);
        } catch (shotErr) {
          shot = `screenshot-fail: ${String(shotErr && shotErr.message ? shotErr.message : shotErr).slice(0, 80)}`;
        }
      }
      rows.push({
        page: pageId,
        device: preset.id,
        theme,
        ...checks,
        shot,
        ms: Date.now() - t0,
      });
    }
  } finally {
    await context.close();
    await browser.close();
  }
  return rows;
}

function localEnvStub(baseUrl) {
  return {
    E2E_BASE_URL: baseUrl.replace(/\/$/, ''),
    E2E_USER: '',
    E2E_PASS: '',
    E2E_LOGIN_PATH: '/wp-login.php',
    E2E_PRODUCT_FIXED: '',
    E2E_PRODUCT_CUSTOM: '',
    E2E_PRODUCT_SHARES: '',
    E2E_PRODUCT_CAMPAIGN: '',
    E2E_LIST_PAGE: '',
    E2E_SHOP_PAGE: '',
    E2E_CART_PAGE: '/cart/',
    E2E_CHECKOUT_PAGE: '/checkout/',
    E2E_PROFILE_ID: 'local',
    _profile: { id: 'local', allowedHosts: ['127.0.0.1', 'localhost'] },
  };
}

async function runLocal(flags) {
  const matrix = loadMatrix();
  const wantIds = flags.themes
    ? LOCAL_CONFIGS.filter((id) => {
        const cfg = resolveConfig(matrix, id);
        return flags.themes.includes(cfg.theme) || flags.themes.includes(id) || flags.themes.includes(cfg.themeSpec?.slug);
      })
    : LOCAL_CONFIGS;
  const ids = wantIds.length ? wantIds : LOCAL_CONFIGS;
  const rows = [];
  const servers = [];
  try {
    for (let i = 0; i < ids.length; i++) {
      const resolved = resolveConfig(matrix, ids[i]);
      const { snap, meta } = prepareConfigSnapshot(resolved);
      const probe = meta.probe || meta;
      const port = flags.port + i;
      const wpDir = materializeWorker(resolved.id, port, snap);
      const server = await startPhpServer({ wpDir, port });
      servers.push(server);
      const env = localEnvStub(server.url);
      setActiveProfile(env._profile);
      for (const deviceId of flags.devices) {
        const preset = getDevicePreset(deviceId);
        const shotRoot = path.join(conflictsDirFor('local'), resolved.id, deviceId);
        const part = await runDeviceOnTarget({
          preset,
          env,
          baseUrl: server.url.replace(/\/$/, ''),
          probe,
          theme: resolved.theme,
          pages: flags.pages,
          shotRoot,
        });
        rows.push(...part);
      }
    }
  } finally {
    for (const s of servers) {
      await s.stop();
    }
  }
  return rows;
}

async function runRemote(flags, envName) {
  const profile = loadProfile(envName === 'staging' ? 'staging-hedef' : 'ikram-aid');
  if (isRemoteFrozen()) fail(FREEZE_MESSAGE);
  try {
    assertOperatorGate();
  } catch {
    fail(OPERATOR_GATE_MESSAGE);
  }
  let env = loadE2EEnv({ envId: envName === 'staging' ? 'staging-hedef' : 'ikram' });
  env = await fillMissingProductSlugs(env);
  const storageState = await ensureAuth(env);
  const probe = {
    products: {
      custom: {
        id: env._resolvedProducts?.custom?.id,
        path: env.E2E_PRODUCT_CUSTOM,
      },
      fixed: {
        id: env._resolvedProducts?.fixed?.id,
        path: env.E2E_PRODUCT_FIXED,
      },
    },
    listPath: env.E2E_LIST_PAGE,
    cartUrl: env.E2E_CART_PAGE,
    checkoutUrl: env.E2E_CHECKOUT_PAGE,
  };
  const rows = [];
  for (const deviceId of flags.devices) {
    const preset = getDevicePreset(deviceId);
    const shotRoot = path.join(conflictsDirFor(envName), deviceId);
    const part = await runDeviceOnTarget({
      preset,
      env,
      baseUrl: env.E2E_BASE_URL,
      probe,
      theme: profile.theme || envName,
      pages: flags.pages,
      shotRoot,
      storageState,
    });
    rows.push(...part);
  }
  return rows;
}

async function main() {
  const flags = parseConflictsArgs(process.argv.slice(2));
  if (flags.help) {
    console.log(
      'npm run e2e:conflicts -- --env staging|ikram|local [--device iphone|android|desktop|all] [--sim-remote]'
    );
    process.exit(0);
  }
  const envName = canonicalConflictsEnv(flags.envRaw);
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const simWanted = flags.simRemote === null ? envName === 'local' : flags.simRemote;
  const sim = simWanted ? runSimRemote() : [];
  if (sim.length) {
    const missed = sim.filter((s) => !s.ok);
    if (missed.length) {
      fail(`uzak benzetim kaçırdı: ${missed.map((m) => m.id).join(', ')}`);
    }
  }

  let rows = [];
  if (envName === 'local') {
    setActiveProfile({ id: 'local', allowedHosts: ['127.0.0.1', 'localhost'] });
    rows = await runLocal(flags);
  } else {
    rows = await runRemote(flags, envName);
  }

  const durationMs = Date.now() - t0;
  const dir = conflictsDirFor(envName);
  const summaryFile = path.join(dir, 'summary.md');
  const body = formatConflictsSummary({
    envName,
    devices: flags.devices,
    rows,
    startedAt,
    durationMs,
    sim,
  });
  writeConflictsSummary(summaryFile, body);

  const reds = countReds(rows);
  const table = rows
    .map(
      (r) =>
        `${r.page.padEnd(10)} ${r.device.padEnd(8)} ${String(r.theme || '—').padEnd(16)} ${r.console}/${r.scripts}/${r.fields}/${r.css}/${r.cache} ${r.finding}`
    )
    .join('\n');
  console.log(table || '(satır yok)');
  console.log(`özet: ${path.relative(ROOT, summaryFile)}`);
  if (reds > 0) process.exit(1);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((e) => fail(e && e.message ? e.message : String(e)));
}

export { parseConflictsArgs, runSimRemote };
