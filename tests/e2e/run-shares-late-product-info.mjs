#!/usr/bin/env node
/**
 * shares-late-product-info — product_info gecikince hissedar verisi / hata mesajı korunmalı.
 *
 *   node tests/e2e/run-shares-late-product-info.mjs
 *
 * Düzeltme öncesi kırmızı, sonrası yeşil beklenir. quick içinde de koşar (capture.mjs).
 */
import { chromium } from '@playwright/test';
import { loadE2EEnv, productPaths, withCacheBust, ROOT } from './helpers/env.mjs';
import {
  CHECK_MS,
  clickShellTrigger,
  makeFailure,
  openShellLocator,
  resolveAllProductPaths,
  resolveProductIdBySlug,
  revealListProductTrigger,
  shellTriggerLocator,
} from './helpers/checks.mjs';
import { SEL } from './helpers/selectors.mjs';
import { peekActiveProfile } from './helpers/profile.mjs';
import { installBrowserGuard } from './helpers/network-guard.mjs';
import fs from 'node:fs';
import path from 'node:path';

const DELAY_MS = 1500;
const NAME_VAL = 'Kim Adına Kesilecek';
const NOTE_VAL = 'Geç yanıt notu';

function phoneVal() {
  return peekActiveProfile()?.phone?.nationalExample || '5551234567';
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} delayMs
 */
async function installProductInfoDelay(page, delayMs = DELAY_MS) {
  await page.route('**/admin-ajax.php*', async (route) => {
    const req = route.request();
    const post = req.postData() || '';
    const url = req.url();
    const isProductInfo =
      /wdp_get_product_info/i.test(post) || /wdp_get_product_info/i.test(url);
    if (!isProductInfo) {
      await route.continue();
      return;
    }
    await new Promise((r) => setTimeout(r, delayMs));
    await route.continue();
  });
}

/**
 * @param {import('@playwright/test').Locator} shell
 */
async function waitShellInteractive(shell, page) {
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  await page
    .waitForFunction(
      () => {
        const modal = document.querySelector('.wdp-modal.show');
        if (!modal || modal.classList.contains('wdp-is-skeleton')) return false;
        if (modal.getAttribute('aria-busy') === 'true') return false;
        const name = modal.querySelector('input[name^="shareholder_name_"]');
        return !!(name && !name.disabled && name.isConnected);
      },
      null,
      { timeout: 12000 }
    )
    .catch(() => {
      throw new Error('Kabuk iskelet kilidi / hissedar adı zamanında açılmadı');
    });
}

/**
 * @param {import('@playwright/test').Locator} shell
 */
async function fillShareholder1(shell) {
  const name = shell.locator('input[name="shareholder_name_1"]').first();
  const phone = shell.locator('input[name="shareholder_phone_1"]').first();
  const note = shell.locator('textarea[name="shareholder_note_1"]').first();
  await name.waitFor({ state: 'visible', timeout: CHECK_MS });
  await name.fill(NAME_VAL);
  await phone.fill(phoneVal());
  if ((await note.count()) > 0) {
    await note.fill(NOTE_VAL);
  }
}

/**
 * @param {import('@playwright/test').Locator} shell
 */
async function readShareholder1(shell) {
  const name = await shell.locator('input[name="shareholder_name_1"]').first().inputValue().catch(() => '');
  const phone = await shell.locator('input[name="shareholder_phone_1"]').first().inputValue().catch(() => '');
  const note =
    (await shell.locator('textarea[name="shareholder_note_1"]').count()) > 0
      ? await shell.locator('textarea[name="shareholder_note_1"]').first().inputValue().catch(() => '')
      : NOTE_VAL;
  return { name, phone, note };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} shell
 */
async function countVisibleInputErrors(shell) {
  return shell.evaluate((root) => {
    function shown(el) {
      if (!el) return false;
      if (el.closest && el.closest('.wdp-shareholder-form.collapsed')) return false;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        Number.parseFloat(st.opacity || '1') > 0.05 &&
        r.width > 0 &&
        r.height > 0
      );
    }
    return [...root.querySelectorAll('.wdp-input-error')].filter(shown).map((el) =>
      (el.textContent || '').trim().slice(0, 80)
    );
  });
}

/**
 * @param {object} opts
 * @returns {Promise<{ ok: boolean, failures: object[], detail: string, passed: number, failed: number }>}
 */
export async function runSharesLateProductInfoChecks({
  browser,
  contextOpts,
  env,
  sharesProductPath,
  listPagePath,
  sharesProductId,
  guestExtra = {},
  failures: extFailures = null,
  stats = null,
}) {
  const failures = extFailures || [];
  let passed = 0;
  let failed = 0;

  /**
   * @param {'panel'|'popup'} mode
   * @param {'values'|'errors'} kind
   */
  async function one(mode, kind) {
    const check = `shares-late-product-info-${mode}-${kind}`;
    const ctx = await browser.newContext(contextOpts);
    const page = await ctx.newPage();
    try {
      await installProductInfoDelay(page, DELAY_MS);
      const pagePath = mode === 'panel' ? sharesProductPath : listPagePath || env.E2E_LIST_PAGE;
      await page.goto(withCacheBust(env.E2E_BASE_URL, pagePath, guestExtra), {
        waitUntil: 'domcontentloaded',
      });
      if (mode === 'popup') {
        await revealListProductTrigger(page, sharesProductId);
      }
      await clickShellTrigger(shellTriggerLocator(page, mode, { productId: sharesProductId }), CHECK_MS);
      const shell = mode === 'popup' ? openShellLocator(page, '') : openShellLocator(page, mode);
      await waitShellInteractive(shell, page);

      if (kind === 'values') {
        await fillShareholder1(shell);
        // product_info gecikmesi bitsin (+ buffer)
        await page.waitForTimeout(DELAY_MS + 800);
        const after = await readShareholder1(shell);
        const nameOk = after.name.trim() === NAME_VAL;
        const expectedPhone = phoneVal();
        const phoneOk =
          String(after.phone).replace(/\D/g, '').endsWith(expectedPhone.replace(/\D/g, '')) ||
          after.phone.includes(expectedPhone);
        const noteOk = !after.note || after.note.trim() === NOTE_VAL;
        if (!nameOk || !phoneOk || !noteOk) {
          failed += 1;
          if (stats) stats.failed += 1;
          failures.push(
            makeFailure({
              check,
              description: 'Gecikmeli product_info sonrası hissedar alanları sıfırlandı',
              detail: `name=${JSON.stringify(after.name)} phone=${JSON.stringify(after.phone)} note=${JSON.stringify(after.note)}`,
            })
          );
        } else {
          passed += 1;
          if (stats) stats.passed += 1;
        }
        return;
      }

      // errors: yanıt gelmeden goCheckout
      await shell.locator(SEL.goCheckout).first().click({ timeout: CHECK_MS });
      await page
        .waitForFunction(() => {
          const last = window.WDPApp && window.WDPApp.form && window.WDPApp.form.lastValidation;
          return !!(last && last.ok === false);
        }, null, { timeout: CHECK_MS })
        .catch(() => {
          throw new Error('goCheckout sonrası lastValidation.ok===false yok');
        });
      const before = await countVisibleInputErrors(shell);
      await page.waitForTimeout(DELAY_MS + 800);
      const after = await countVisibleInputErrors(shell);
      const still =
        after.length >= 1 && after.some((t) => /hissedar|ad|telefon/i.test(t));
      if (!still) {
        failed += 1;
        if (stats) stats.failed += 1;
        failures.push(
          makeFailure({
            check,
            description: 'product_info yanıtı sonrası hissedar hata mesajları kayboldu',
            detail: `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
          })
        );
      } else {
        passed += 1;
        if (stats) stats.passed += 1;
      }
    } catch (e) {
      failed += 1;
      if (stats) stats.failed += 1;
      failures.push(
        makeFailure({
          check: `shares-late-product-info-${mode}-${kind}`,
          description: 'Senaryo çöktü',
          error: e,
        })
      );
    } finally {
      await page.close().catch(() => {});
      await ctx.close().catch(() => {});
    }
  }

  // 4 senaryo paralel (her biri kendi context) — quick wall süresini kısaltır
  await Promise.all([
    one('panel', 'values'),
    one('panel', 'errors'),
    one('popup', 'values'),
    one('popup', 'errors'),
  ]);

  return {
    ok: failed === 0,
    failures,
    passed,
    failed,
    detail: failed
      ? failures.map((f) => f.check + ': ' + (f.description || '')).join(' | ')
      : 'all ok',
  };
}

async function main() {
  const env = loadE2EEnv();
  const browser = await chromium.launch();
  installBrowserGuard(browser, env);
  const contextOpts = {
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  };
  const probe = await browser.newContext(contextOpts);
  const p = await probe.newPage();
  await p.goto(withCacheBust(env.E2E_BASE_URL, '/'), { waitUntil: 'domcontentloaded' });
  const products = productPaths(env);
  const urls = await resolveAllProductPaths(p, env.E2E_BASE_URL, products);
  const sharesId = await resolveProductIdBySlug(p, env.E2E_BASE_URL, products.shares);
  await probe.close();

  const t0 = Date.now();
  const result = await runSharesLateProductInfoChecks({
    browser,
    contextOpts,
    env,
    sharesProductPath: urls.shares,
    listPagePath: env.E2E_LIST_PAGE,
    sharesProductId: sharesId,
  });
  const ms = Date.now() - t0;
  await browser.close();

  const outDir = path.join(ROOT, 'build/e2e/debug');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'shares-late-product-info.json');
  fs.writeFileSync(
    outFile,
    JSON.stringify({ ok: result.ok, ms, failures: result.failures, detail: result.detail }, null, 2)
  );

  console.log(result.ok ? 'PASS' : 'FAIL', `(${(ms / 1000).toFixed(1)}s)`);
  console.log(result.detail);
  console.log('Wrote', path.relative(ROOT, outFile));
  if (result.failures.length) {
    for (const f of result.failures) {
      console.log('•', f.check, f.description, f.detail || (f.error && f.error.message) || '');
    }
  }
  process.exit(result.ok ? 0 : 1);
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (process.argv[1] && process.argv[1].includes('run-shares-late-product-info')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
