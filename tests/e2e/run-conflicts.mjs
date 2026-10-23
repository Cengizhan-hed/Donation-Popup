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
  phoneProbeFromSnaps,
  evaluateCheckoutFields,
  evaluateCurcy,
  fieldsVerdict,
  diffChromeStyles,
  cssVerdict,
  cacheVerdict,
  pickOverflowHit,
  VERDICT,
  MIN_TOUCH_PX,
  SHOP_DONATE_SEL,
  shopConflictPath,
  shopSkipReason,
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
  simRemoteHiddenShopPhoneSnaps,
  simRemoteOpenPhoneSnap,
  simRemoteFalseOverflowNodes,
  simRemoteRealOverflowHit,
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
  waitOpenShellSettled,
} from './helpers/checks.mjs';
import { waitAndAssertShellOverlap } from './helpers/shell-overlap.mjs';
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
  const snaps = await page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll('.wdp-phone-field, [data-wdp-phone-field]'));
    return fields.map((f) => {
      const st = getComputedStyle(f);
      const r = f.getBoundingClientRect();
      const shell = f.closest('.hdf-donation-modal-wrapper.wdp-modal');
      const inline = f.closest('.hdf-donation-modal-wrapper.wdp-donation-form, .wdp-donation-form');
      const inOpenVisibleForm = shell
        ? shell.classList.contains('show') && shell.getAttribute('aria-hidden') !== 'true'
        : !!inline;
      const inp = f.querySelector('input[name="donation_phone"], input[type="tel"]');
      let iti = f.querySelectorAll('.iti, .intl-tel-input, [data-intl-tel-input-id]').length;
      if (inp && (inp.classList.contains('iti') || inp.getAttribute('data-intl-tel-input-id'))) iti += 1;
      const itiGlobal = !!(
        inp &&
        window.intlTelInputGlobals &&
        typeof window.intlTelInputGlobals.getInstance === 'function' &&
        window.intlTelInputGlobals.getInstance(inp)
      );
      return {
        inOpenVisibleForm,
        display: st.display,
        visibility: st.visibility,
        hidden: !!f.hidden,
        ariaHidden: f.getAttribute('aria-hidden') === 'true',
        width: r.width,
        height: r.height,
        flags: f.querySelectorAll('.iti__flag, .wdp-phone-field__flag, [class*="iti__flag"]').length,
        btns: f.querySelectorAll(
          '.wdp-phone-field__code-btn, .iti__selected-flag, .wcipi-flag, [class*="country-selector"]'
        ).length,
        iti,
        wcipi: f.querySelectorAll('[class*="wcipi"], .wcipi-wrap, .wcipi-container').length,
        itiGlobal,
      };
    });
  });
  return phoneProbeFromSnaps(snaps);
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
  const snap = await page.evaluate((min) => {
    const pathHint = (el) => {
      if (!el) return '';
      if (el.id) return `#${el.id}`;
      const cls = String(el.className || '')
        .split(/\s+/)
        .filter((c) => /^(wdp-|hdf-)/.test(c))
        .slice(0, 3);
      const tag = (el.tagName || '').toLowerCase();
      return cls.length ? `${tag}.${cls.join('.')}` : tag;
    };
    const ignored = (el) => {
      if (!el) return true;
      if (el.hidden || el.getAttribute('aria-hidden') === 'true') return true;
      if (el.closest('[hidden], [aria-hidden="true"]')) return true;
      if (el.classList.contains('screen-reader-text') || el.closest('.screen-reader-text')) return true;
      const panel = el.closest('.wdp-phone-country-panel');
      if (panel && (panel.hidden || panel.getAttribute('aria-hidden') === 'true')) return true;
      const disc = el.closest('[aria-expanded="false"]');
      if (disc && disc !== el && (el.getAttribute('role') === 'listbox' || el.closest('[role="listbox"]'))) {
        return true;
      }
      return false;
    };
    const doc = document.documentElement;
    const overflow = doc.scrollWidth > doc.clientWidth + 1;
    const shell = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show');
    const inline = document.querySelector(
      '.hdf-donation-modal-wrapper.wdp-donation-form:not(.wdp-modal), .wdp-donation-form:not(.wdp-modal)'
    );
    const root = shell
      ? shell.querySelector('.wdp-modal-content') || shell
      : inline;
    if (!root) {
      return { overflow, formVisible: null, vw: 0, nodes: [], badTouch: [] };
    }
    const st = getComputedStyle(root);
    const box = root.getBoundingClientRect();
    const formVisible =
      st.display !== 'none' && st.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    if (!formVisible) {
      return { overflow, formVisible: false, vw: 0, nodes: [], badTouch: [] };
    }
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const openCountry = document.querySelector('.wdp-phone-country-panel:not([hidden])');
    const scan = [root, ...Array.from(root.querySelectorAll('button, a[href], [role="button"], input, textarea, select, [class*="wdp-"]'))];
    if (openCountry && !openCountry.hidden && openCountry.getAttribute('aria-hidden') !== 'true') {
      scan.push(openCountry, ...Array.from(openCountry.querySelectorAll('button, input, [class*="wdp-"]')));
    }
    const seen = new Set();
    const nodes = [];
    for (const el of scan) {
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const ancestorHidden = !!el.closest('[hidden]');
      const ancestorAria = !!el.closest('[aria-hidden="true"]');
      const srText =
        el.classList.contains('screen-reader-text') || !!el.closest('.screen-reader-text');
      const closedCountry = (() => {
        const p = el.closest('.wdp-phone-country-panel');
        return !!(p && (p.hidden || p.getAttribute('aria-hidden') === 'true'));
      })();
      const closedDisclosure = (() => {
        const list = el.closest('[role="listbox"], [role="menu"]');
        if (!list) return false;
        const owner = list.closest('[aria-expanded="false"]');
        return !!owner;
      })();
      nodes.push({
        selector: pathHint(el),
        role: el === root ? 'content' : 'child',
        left: r.left,
        right: r.right,
        width: r.width,
        height: r.height,
        display: cs.display,
        visibility: cs.visibility,
        hidden: !!el.hidden,
        ariaHidden: el.getAttribute('aria-hidden') === 'true',
        ancestorHidden,
        ancestorAriaHidden: ancestorAria,
        srText,
        closedCountry,
        closedDisclosure,
        containerLeft: box.left,
        containerRight: box.right,
        containerWidth: box.width,
      });
    }
    const badTouch = [];
    for (const el of root.querySelectorAll(
      'button, a[href], [role="button"], .wdp-amount-preset, input[type="checkbox"]'
    )) {
      if (ignored(el)) continue;
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
    return { overflow, formVisible: true, vw, nodes, badTouch };
  }, MIN_TOUCH_PX);
  const hit = pickOverflowHit(snap.nodes || [], { vw: snap.vw });
  return {
    overflow: !!snap.overflow,
    formVisible: snap.formVisible,
    clipped: !!hit,
    hit,
    badTouch: snap.badTouch || [],
    vw: snap.vw,
  };
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

async function visibleShopDonate(page) {
  const loc = page.locator(SHOP_DONATE_SEL);
  const vis = loc.filter({ visible: true });
  if ((await vis.count()) > 0) return vis.first();
  return null;
}

/**
 * @returns {Promise<{ opened: boolean, skipped: boolean, reason: string }>}
 */
async function openFormIfNeeded(page, pageId, ctx) {
  if (pageId === 'cart' || pageId === 'checkout') {
    return { opened: false, skipped: false, reason: '' };
  }
  if (pageId === 'shop') {
    const trigger = await visibleShopDonate(page);
    if (!trigger) {
      return {
        opened: false,
        skipped: false,
        failed: true,
        reason: 'mağaza döngüsünde eklenti düğmesi yok',
      };
    }
    await clickShellTrigger(trigger, CHECK_MS);
    const shell = openShellLocator(page, '');
    if ((await shell.count()) === 0) {
      return { opened: false, skipped: false, failed: true, reason: 'mağaza döngüsü tıklandı, kabuk yok' };
    }
    const vis = await shell.isVisible();
    if (!vis) {
      return { opened: false, skipped: false, failed: true, reason: 'mağaza döngüsü tıklandı, kabuk görünür değil' };
    }
    await waitOpenShellSettled(page);
    return { opened: true, skipped: false, reason: '' };
  }
  if (pageId === 'product') {
    const inline = page.locator(`${SEL.inlineDonationForm} ${SEL.donationForm}`).first();
    if ((await inline.count()) > 0 && (await inline.isVisible())) {
      return { opened: true, skipped: false, reason: '' };
    }
    const trigger = page.locator(`${SEL.donateTrigger}, ${SEL.sidePanelTrigger}`).first();
    if ((await trigger.count()) === 0) {
      return { opened: false, skipped: false, reason: '' };
    }
    const visTrig = trigger.filter({ visible: true });
    if ((await visTrig.count()) === 0) {
      return { opened: false, skipped: false, reason: '' };
    }
    await clickShellTrigger(visTrig, CHECK_MS);
    const shell = openShellLocator(page, '');
    if ((await shell.count()) === 0 || !(await shell.isVisible())) {
      return { opened: false, skipped: false, reason: '' };
    }
    await waitOpenShellSettled(page);
    return { opened: true, skipped: false, reason: '' };
  }
  if (pageId === 'panel') {
    const trigger = page.locator(SEL.sidePanelTrigger).first();
    if ((await trigger.count()) === 0) {
      return { opened: false, skipped: false, reason: '' };
    }
    const visTrig = trigger.filter({ visible: true });
    if ((await visTrig.count()) === 0) {
      return { opened: false, skipped: false, reason: '' };
    }
    await clickShellTrigger(visTrig, CHECK_MS);
    const shell = openShellLocator(page, 'panel');
    if ((await shell.count()) === 0 || !(await shell.isVisible())) {
      return { opened: false, skipped: false, reason: '' };
    }
    await waitOpenShellSettled(page);
    return { opened: true, skipped: false, reason: '' };
  }
  return { opened: false, skipped: false, reason: '' };
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

async function highlightOverflowHit(page, hit) {
  if (!hit || !hit.selector) return;
  await page.evaluate((sel) => {
    const nodes = Array.from(document.querySelectorAll(sel));
    const el =
      nodes.find((n) => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) || nodes[0];
    if (!el) return;
    el.setAttribute('data-wdp-overflow-hit', '1');
    el.style.setProperty('outline', '3px solid #dc2626', 'important');
    el.style.setProperty('outline-offset', '2px', 'important');
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }, hit.selector);
}

async function shotFinding(page, dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  const shellOpen = (await page.locator(SEL.openModalShell).count()) > 0;
  if (shellOpen) {
    await waitAndAssertShellOverlap(page, 8000);
  }
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
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
    return shopConflictPath(probe, env);
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
  let ajax = { skipped: false, noncePresent: false, ok: false, reason: 'wdp_ajax yok' };
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
  } else if (!hasAjax) {
    ajax = { skipped: false, noncePresent: false, ok: false, reason: 'wdp_ajax yok' };
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
    layout: formLayout,
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
  const hiddenPhone = phoneVerdict(evaluatePhoneIntegrity(phoneProbeFromSnaps(simRemoteHiddenShopPhoneSnaps())));
  rows.push({
    id: 'gizli-kart-telefon',
    expected: VERDICT.pass,
    actual: hiddenPhone.verdict,
    finding: hiddenPhone.finding,
    ok: hiddenPhone.verdict === VERDICT.pass,
  });
  const openPhone = phoneVerdict(
    evaluatePhoneIntegrity(phoneProbeFromSnaps([...simRemoteHiddenShopPhoneSnaps(), simRemoteOpenPhoneSnap()]))
  );
  rows.push({
    id: 'açık-form-tek-seçici',
    expected: VERDICT.pass,
    actual: openPhone.verdict,
    finding: openPhone.finding,
    ok: openPhone.verdict === VERDICT.pass && openPhone.finding === '',
  });
  const falseHit = pickOverflowHit(simRemoteFalseOverflowNodes(), { vw: 390 });
  const falseCss = cssVerdict({ leaked: [] }, { formVisible: true, clipped: !!falseHit, hit: falseHit });
  rows.push({
    id: 'gizli-sr-text-tasmaz',
    expected: VERDICT.pass,
    actual: falseCss.verdict,
    finding: falseCss.finding,
    ok: falseCss.verdict === VERDICT.pass && !falseHit,
  });
  const realHit = pickOverflowHit([simRemoteRealOverflowHit()], { vw: 390 });
  const realCss = cssVerdict({ leaked: [] }, { formVisible: true, clipped: !!realHit, hit: realHit });
  rows.push({
    id: 'görünür-öğe-taşması',
    expected: VERDICT.red,
    actual: realCss.verdict,
    finding: realCss.finding,
    ok: realCss.verdict === VERDICT.red && /form taşıyor/.test(realCss.finding) && /kural=/.test(realCss.finding),
  });
  rows.push({
    id: 'shop-yol-yok-atla',
    expected: VERDICT.skip,
    actual: VERDICT.skip,
    finding: shopSkipReason({ shopPath: '' }),
    ok: shopSkipReason({ shopPath: '' }).startsWith('atlandı:'),
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
          const catalogSkip = pageId === 'shop' || pageId === 'product' || pageId === 'panel';
          if (catalogSkip) {
            checks.finding =
              pageId === 'shop'
                ? shopSkipReason({ shopPath: '' })
                : 'atlandı: ürün yolu katalogda yok';
            checks.console = VERDICT.skip;
            checks.scripts = VERDICT.skip;
            checks.fields = VERDICT.skip;
            checks.css = VERDICT.skip;
            checks.cache = VERDICT.skip;
          } else {
            checks.finding = `${pageId} yolu WP/Woo katalogunda yok`;
            checks.console = VERDICT.red;
            checks.scripts = VERDICT.red;
            checks.fields = VERDICT.red;
            checks.css = VERDICT.red;
            checks.cache = VERDICT.red;
          }
        } else {
          await gotoPath(page, baseUrl, target, env, true);
          await waitIdle(page);
          const chromeWithCss = await snapshotChrome(page);
          const opened = await openFormIfNeeded(page, pageId, {
            productId,
            shopPath: shopConflictPath(probe, env),
          });
          if (opened.failed) {
            checks.console = VERDICT.red;
            checks.scripts = VERDICT.red;
            checks.fields = VERDICT.red;
            checks.css = VERDICT.red;
            checks.cache = VERDICT.red;
            checks.finding = opened.reason;
          } else if (opened.skipped && pageId === 'shop') {
            checks = await runPageChecks(page, { pageId, productId, events, env, chromeWithCss });
            if (!rowHasFinding(checks)) {
              checks.finding = opened.reason;
            }
          } else {
            checks = await runPageChecks(page, { pageId, productId, events, env, chromeWithCss });
          }
        }
      } catch (e) {
        const msg = String(e && e.message ? e.message : e);
        if (pageId === 'shop' && /timeout|waitfor/i.test(msg)) {
          checks.console = VERDICT.red;
          checks.scripts = VERDICT.red;
          checks.fields = VERDICT.red;
          checks.css = VERDICT.red;
          checks.cache = VERDICT.red;
          checks.finding = `mağaza açılamadı: ${msg.slice(0, 80)}`;
        } else {
          checks.console = VERDICT.red;
          checks.finding = msg.slice(0, 240);
        }
      }
      if (rowHasFinding({ ...checks })) {
        try {
          if (checks.layout && checks.layout.hit) {
            await openFormIfNeeded(page, pageId, {
              productId,
              shopPath: shopConflictPath(probe, env),
            });
            await highlightOverflowHit(page, checks.layout.hit);
          }
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

function localEnvStub(baseUrl, probe = {}) {
  return {
    E2E_BASE_URL: baseUrl.replace(/\/$/, ''),
    E2E_USER: '',
    E2E_PASS: '',
    E2E_LOGIN_PATH: '/wp-login.php',
    E2E_PRODUCT_FIXED: probe?.products?.fixed?.path || '',
    E2E_PRODUCT_CUSTOM: probe?.products?.custom?.path || '',
    E2E_PRODUCT_SHARES: probe?.products?.shares?.path || '',
    E2E_PRODUCT_CAMPAIGN: probe?.products?.campaign?.path || '',
    E2E_LIST_PAGE: probe?.listPath || '',
    E2E_SHOP_PAGE: probe?.shopPath || '',
    E2E_CART_PAGE: '/cart/',
    E2E_CHECKOUT_PAGE: '/checkout/',
    E2E_PROFILE_ID: 'local',
    _profile: { id: 'local', allowedHosts: ['127.0.0.1', 'localhost'] },
    _catalog: { shop: probe?.shopPath ? { path: probe.shopPath } : null },
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
      const env = localEnvStub(server.url, probe);
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
    shopPath: env.E2E_SHOP_PAGE,
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
