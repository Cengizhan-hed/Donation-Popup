#!/usr/bin/env node
/**
 * Tek seferlik teşhis: errors senaryosunda buton / lastValidation / hata DOM / screenshot boyutu.
 * Kullanım: node tests/e2e/diag-errors.mjs
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

async function probeAfterClick(page, label) {
  return page.evaluate((lbl) => {
    const shell =
      document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show:not(.wdp-side-panel)') ||
      document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.wdp-side-panel.show') ||
      document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show');
    const form = shell ? shell.querySelector('form.wdp-donation-form-fields') : null;
    const WDPApp = window.WDPApp || {};
    const lastValidation =
      (WDPApp.form && WDPApp.form.lastValidation) ||
      (WDPApp.formValidate && WDPApp.formValidate.lastValidation) ||
      null;
    const errNodes = form
      ? Array.from(
          form.querySelectorAll(
            '.wdp-form-error, .wdp-input-error, [role="alert"].wdp-form-error, [role="alert"].wdp-input-error'
          )
        ).map((el) => ({
          tag: el.tagName,
          className: String(el.className || ''),
          text: (el.textContent || '').trim().slice(0, 120),
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility,
          opacity: window.getComputedStyle(el).opacity,
          offsetParent: !!el.offsetParent,
          rect: (() => {
            const r = el.getBoundingClientRect();
            return { w: r.width, h: r.height, top: r.top };
          })(),
        }))
      : [];
    const goBtn = form ? form.querySelector('button[name="donation_go_checkout"]') : null;
    const shellBox = shell ? shell.getBoundingClientRect() : null;
    const content = shell ? shell.querySelector('.wdp-modal-content') : null;
    const contentBox = content ? content.getBoundingClientRect() : null;
    const shares = form
      ? Array.from(form.querySelectorAll('.wdp-shareholder-form')).map((f, i) => {
          const icon = f.querySelector('.wdp-shareholder-icon');
          const before = icon ? window.getComputedStyle(icon, '::before') : null;
          return {
            i,
            collapsed: f.classList.contains('collapsed'),
            iconContent: before ? before.content : null,
            iconTransform: before ? before.transform : null,
          };
        })
      : [];
    return {
      label: lbl,
      hasShell: !!shell,
      shellId: shell ? shell.id : null,
      isSidePanel: !!(shell && shell.classList.contains('wdp-side-panel')),
      shellBox: shellBox
        ? { w: Math.round(shellBox.width), h: Math.round(shellBox.height) }
        : null,
      contentBox: contentBox
        ? { w: Math.round(contentBox.width), h: Math.round(contentBox.height) }
        : null,
      goBtn: goBtn
        ? {
            name: goBtn.getAttribute('name'),
            type: goBtn.getAttribute('type'),
            disabled: !!goBtn.disabled,
            visible: !!(goBtn.offsetParent || goBtn.getClientRects().length),
          }
        : null,
      lastValidation,
      errNodes,
      visibleErrorCount: errNodes.filter(
        (n) => n.display !== 'none' && n.visibility !== 'hidden' && Number.parseFloat(n.opacity) > 0.05 && n.rect.h > 0
      ).length,
      shares,
    };
  }, label);
}

async function runOne(env, browser, { key, mode, pagePath, productId }) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const page = await ctx.newPage();
  const url = withCacheBust(env.E2E_BASE_URL, pagePath);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const trigger = shellTriggerLocator(page, mode, { productId });
  const triggerCount = await trigger.count();
  await trigger.first().click({ timeout: CHECK_MS }).catch((e) => ({ err: String(e) }));
  await openShellLocator(page, mode).waitFor({ state: 'visible', timeout: CHECK_MS }).catch(() => {});

  const before = await probeAfterClick(page, 'before-goCheckout');

  // Mevcut E2E ile aynı: sayfa genelinden ilk goCheckout (kabuk dışı da olabilir)
  const pageBtn = page.locator(SEL.goCheckout).first();
  const shellBtn = openShellLocator(page, mode).locator(SEL.goCheckout).first();
  const pageBtnCount = await pageBtn.count();
  const shellBtnCount = await shellBtn.count();
  const pageBtnInfo = await pageBtn
    .evaluate((el) => ({
      inShell: !!(el.closest && el.closest('.hdf-donation-modal-wrapper.wdp-modal.show')),
      name: el.getAttribute('name'),
      type: el.type,
      outer: el.outerHTML.slice(0, 180),
    }))
    .catch(() => null);

  const clickTarget = 'page-first-goCheckout';
  const clickResult = await pageBtn
    .click({ timeout: CHECK_MS })
    .then(() => ({ ok: true }))
    .catch((e) => ({ ok: false, error: String(e.message || e) }));

  await page.waitForTimeout(300);
  const afterClick = await probeAfterClick(page, 'after-goCheckout-300ms');

  // Alternatif: kabuk içi buton
  // (yeniden açmadan sadece durum)

  const shotShell = path.join(OUT, `diag-${mode}-${key}-shell.png`);
  const shotContent = path.join(OUT, `diag-${mode}-${key}-content.png`);
  const shotPage = path.join(OUT, `diag-${mode}-${key}-page.png`);
  const shell = openShellLocator(page, mode);
  if ((await shell.count()) > 0) {
    await shell.screenshot({ path: shotShell }).catch(() => {});
    const content = shell.locator(SEL.modalContent).first();
    if ((await content.count()) > 0) {
      await content.screenshot({ path: shotContent }).catch(() => {});
    }
  }
  await page.screenshot({ path: shotPage, fullPage: false }).catch(() => {});

  const tracePath = path.join(OUT, `diag-${mode}-${key}.zip`);
  await ctx.tracing.stop({ path: tracePath });
  await ctx.close();

  return {
    key,
    mode,
    pagePath,
    productId,
    triggerCount,
    pageBtnCount,
    shellBtnCount,
    pageBtnInfo,
    clickTarget,
    clickResult,
    before,
    afterClick,
    shots: {
      shell: path.relative(ROOT, shotShell),
      content: path.relative(ROOT, shotContent),
      page: path.relative(ROOT, shotPage),
      trace: path.relative(ROOT, tracePath),
    },
  };
}

async function main() {
  const env = loadE2EEnv();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const probe = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await probe.newPage();
  await p.goto(withCacheBust(env.E2E_BASE_URL, '/'), { waitUntil: 'domcontentloaded' }).catch(() => {});
  const products = productPaths(env);
  const productUrls = await resolveAllProductPaths(p, env.E2E_BASE_URL, products);
  const fixedId = await resolveProductIdBySlug(p, env.E2E_BASE_URL, products.fixed);
  const sharesId = await resolveProductIdBySlug(p, env.E2E_BASE_URL, products.shares);
  await probe.close();

  const jobs = [
    { key: 'fixed', mode: 'popup', pagePath: env.E2E_LIST_PAGE, productId: fixedId },
    { key: 'fixed', mode: 'panel', pagePath: productUrls.fixed, productId: fixedId },
    { key: 'shares', mode: 'popup', pagePath: env.E2E_LIST_PAGE, productId: sharesId },
  ];

  const results = [];
  for (const job of jobs) {
    console.log(`diag ${job.mode}-${job.key}…`);
    results.push(await runOne(env, browser, job));
  }
  await browser.close();

  const outFile = path.join(OUT, 'errors-diag.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log('Wrote', path.relative(ROOT, outFile));
  for (const r of results) {
    console.log(
      `\n=== ${r.mode}-${r.key} ===`,
      `\nclick:`,
      r.clickResult,
      `\npageBtn inShell:`,
      r.pageBtnInfo && r.pageBtnInfo.inShell,
      `\nlastValidation:`,
      JSON.stringify(r.afterClick.lastValidation),
      `\nvisibleErrors:`,
      r.afterClick.visibleErrorCount,
      `\nshellBox:`,
      r.afterClick.shellBox,
      `\ncontentBox:`,
      r.afterClick.contentBox,
      `\nshares:`,
      JSON.stringify(r.afterClick.shares)
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
