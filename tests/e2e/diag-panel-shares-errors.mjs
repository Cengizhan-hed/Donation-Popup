#!/usr/bin/env node
/**
 * Panel vs popup hisseli goCheckout sonrası hata DOM karşılaştırması.
 *   node tests/e2e/diag-panel-shares-errors.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { loadE2EEnv, ROOT, productPaths, withCacheBust } from './helpers/env.mjs';
import {
  CHECK_MS,
  openShellLocator,
  resolveAllProductPaths,
  resolveProductIdBySlug,
  shellTriggerLocator,
} from './helpers/checks.mjs';
import { SEL } from './helpers/selectors.mjs';

const OUT = path.join(ROOT, 'build/e2e/debug');

async function dumpShell(page, mode) {
  const shell = openShellLocator(page, mode);
  return shell.evaluate((root) => {
    const form = root.querySelector('form.wdp-donation-form-fields');
    const lv =
      (window.WDPApp && window.WDPApp.form && window.WDPApp.form.lastValidation) || null;

    function info(el) {
      if (!el) return null;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const parent = el.parentElement;
      const pst = parent ? getComputedStyle(parent) : null;
      return {
        tag: el.tagName,
        className: String(el.className || '').slice(0, 120),
        name: el.getAttribute('name') || '',
        text: (el.textContent || '').trim().slice(0, 100),
        display: st.display,
        visibility: st.visibility,
        opacity: st.opacity,
        overflow: st.overflow,
        overflowY: st.overflowY,
        zIndex: st.zIndex,
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
        offsetParent: !!el.offsetParent,
        parentDisplay: pst ? pst.display : null,
        parentOverflow: pst ? pst.overflow : null,
        inCollapsed: !!(el.closest && el.closest('.wdp-shareholder-form.collapsed')),
        contentDisplay: (() => {
          const c = el.closest && el.closest('.wdp-shareholder-form');
          const content = c && c.querySelector('.wdp-shareholder-content');
          return content ? getComputedStyle(content).display : null;
        })(),
      };
    }

    const fields = ['shareholder_name_1', 'shareholder_phone_1'].map((name) => {
      const el = form ? form.querySelector(`[name="${name}"]`) : null;
      const err =
        el &&
        (el.closest('.wdp-field-stack__row') || el.parentElement)?.querySelector(
          '.wdp-input-error'
        );
      return {
        name,
        field: info(el),
        hasWdpError: !!(el && el.classList.contains('wdp-error')),
        ariaInvalid: el ? el.getAttribute('aria-invalid') : null,
        errorDiv: info(err),
      };
    });

    const allInputErrors = [...root.querySelectorAll('.wdp-input-error')].map(info);
    const headers = [...root.querySelectorAll('.wdp-shareholder-header')].map((h) => ({
      ...info(h),
      statusInvalid: h.classList.contains('wdp-header-status-invalid'),
      statusValid: h.classList.contains('wdp-header-status-valid'),
    }));
    const forms = [...root.querySelectorAll('.wdp-shareholder-form')].map((f, i) => ({
      i,
      collapsed: f.classList.contains('collapsed'),
      contentDisplay: (() => {
        const c = f.querySelector('.wdp-shareholder-content');
        return c ? getComputedStyle(c).display : null;
      })(),
      contentOverflow: (() => {
        const c = f.querySelector('.wdp-shareholder-content');
        return c ? getComputedStyle(c).overflow : null;
      })(),
    }));

    const isSidePanel = root.classList.contains('wdp-side-panel');
    const scroll = root.querySelector('.wdp-shareholders-scroll');
    return {
      shellId: root.id,
      isSidePanel,
      lastValidation: lv,
      fields,
      allInputErrors,
      headers,
      forms,
      formError: info(root.querySelector('.wdp-form-error')),
      scroll: scroll
        ? {
            overflow: getComputedStyle(scroll).overflow,
            overflowY: getComputedStyle(scroll).overflowY,
            h: Math.round(scroll.getBoundingClientRect().height),
            scrollTop: scroll.scrollTop,
            scrollHeight: scroll.scrollHeight,
          }
        : null,
      compactMq: window.matchMedia('(max-width: 768px)').matches,
    };
  });
}

async function runMode(env, browser, { mode, pagePath, productId }) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const page = await ctx.newPage();
  await page.goto(withCacheBust(env.E2E_BASE_URL, pagePath), { waitUntil: 'domcontentloaded' });
  await shellTriggerLocator(page, mode, { productId }).click({ timeout: CHECK_MS });
  const shell = openShellLocator(page, mode);
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  await shell.locator(SEL.goCheckout).first().click({ timeout: CHECK_MS });
  await page.waitForTimeout(200);
  const t200 = await dumpShell(page, mode);
  await page.waitForTimeout(800);
  const t1000 = await dumpShell(page, mode);

  // prepareErrorShot benzeri stabilize (kabuk scope)
  await shell.evaluate((scope) => {
    const forms = Array.from(scope.querySelectorAll('.wdp-shareholder-form'));
    forms.forEach((form, i) => {
      if (i === 0) form.classList.remove('collapsed');
      else form.classList.add('collapsed');
    });
  });
  await page.waitForTimeout(100);
  const afterStabilize = await dumpShell(page, mode);

  const trace = path.join(OUT, `diag-shares-${mode}.zip`);
  await ctx.tracing.stop({ path: trace });
  await ctx.close();
  return { mode, t200, t1000, afterStabilize, trace: path.relative(ROOT, trace) };
}

async function main() {
  const env = loadE2EEnv();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const probe = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await probe.newPage();
  await p.goto(withCacheBust(env.E2E_BASE_URL, '/'), { waitUntil: 'domcontentloaded' });
  const products = productPaths(env);
  const urls = await resolveAllProductPaths(p, env.E2E_BASE_URL, products);
  const sharesId = await resolveProductIdBySlug(p, env.E2E_BASE_URL, products.shares);
  await probe.close();

  const results = [];
  results.push(
    await runMode(env, browser, {
      mode: 'popup',
      pagePath: env.E2E_LIST_PAGE,
      productId: sharesId,
    })
  );
  results.push(
    await runMode(env, browser, {
      mode: 'panel',
      pagePath: urls.shares,
      productId: sharesId,
    })
  );
  await browser.close();

  const out = path.join(OUT, 'panel-vs-popup-shares-errors.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('Wrote', path.relative(ROOT, out));
  for (const r of results) {
    const s = r.t200;
    console.log(`\n=== ${r.mode} @200ms ===`);
    console.log('lv', JSON.stringify(s.lastValidation));
    console.log(
      'fields',
      s.fields.map((f) => ({
        name: f.name,
        wdpError: f.hasWdpError,
        errH: f.errorDiv && f.errorDiv.h,
        errDisplay: f.errorDiv && f.errorDiv.display,
        errText: f.errorDiv && f.errorDiv.text,
        inCollapsed: f.errorDiv && f.errorDiv.inCollapsed,
        contentDisplay: f.field && f.field.contentDisplay,
      }))
    );
    console.log(
      'headers',
      s.headers.map((h) => ({ invalid: h.statusInvalid, h: h.h, display: h.display }))
    );
    console.log('forms', s.forms);
    console.log('allInputErrors', s.allInputErrors.length, s.allInputErrors.map((e) => e.text));
    console.log('scroll', s.scroll);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
