#!/usr/bin/env node
/**
 * RTL yerleşim: ar + he_IL, iPhone + masaüstü.
 * Ekranlar: ANA_REPO/build/handoff/I18N-R1-ekran/rtl-ar-<ekran>-<cihaz>.png
 *
 *   WDP_LOCAL_E2E_PORT=9450 node tests/e2e/run-rtl-layout.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './helpers/env-root.mjs';
import { withCacheBust } from './helpers/env.mjs';
import { SEL, FREEZE_MOTION_CSS } from './helpers/selectors.mjs';
import { setActiveProfile } from './helpers/profile.mjs';
import { loadMatrix, resolveConfig, rtlSpec } from './helpers/matrix-cover.mjs';
import {
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
  restoreSqlite,
  matrixEval,
  applyMatrixLocale,
} from './helpers/matrix-setup.mjs';
import { applyNetworkGuard } from './helpers/network-guard.mjs';
import { clickShellTrigger, openShellLocator } from './helpers/checks.mjs';
import { getDevicePreset } from './helpers/devices.mjs';
import { assertRtlLayout, RTL_LAYOUT_CODE } from './helpers/rtl-layout.mjs';

const __filename = fileURLToPath(import.meta.url);
const CHECK_MS = 25000;
const ANA_SHOT_DIR =
  '/Users/cengizhancoban/Desktop/Wordpress Eklentiler/Donation Popup/Donation Popup/build/handoff/I18N-R1-ekran';
// Yeni tek yönetici menüsünün ekranları (sayfa sluglari).
const ADMIN_SCREENS = ['donation-panel', 'donation-panel-campaigns', 'donation-panel-forms'];

function extraQuery() {
  return { hdf_no_side_cart: '1' };
}

async function gotoPath(page, baseUrl, pathName) {
  const url = withCacheBust(baseUrl, pathName || '/', extraQuery());
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CHECK_MS });
}

async function shot(page, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const freeze = await page.addStyleTag({ content: FREEZE_MOTION_CSS });
  try {
    await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
  } finally {
    await freeze.evaluate((el) => el.remove());
  }
}

async function loginAdmin(page, baseUrl) {
  await gotoPath(page, baseUrl, '/wp-login.php');
  const user = page.locator('#user_login');
  if (await user.count()) {
    await user.fill('admin');
    await page.locator('#user_pass').fill('admin');
    await Promise.all([
      page.waitForURL(/wp-admin/, { timeout: CHECK_MS }),
      page.locator('#wp-submit').click(),
    ]);
  }
}

async function openDisplay(page, baseUrl, productPath, kind) {
  await gotoPath(page, baseUrl, productPath);
  if (kind === 'inline') {
    await page.waitForSelector(SEL.inlineDonationForm, { timeout: CHECK_MS });
    return page.locator(SEL.inlineDonationForm).first();
  }
  const triggerSel = kind === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger;
  const trigger = page.locator(triggerSel).first();
  await trigger.waitFor({ state: 'visible', timeout: CHECK_MS });
  await clickShellTrigger(trigger, CHECK_MS);
  const shell = openShellLocator(page, kind === 'panel' ? 'panel' : 'popup');
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  return shell;
}

async function closeShell(page) {
  const closer = page.locator(SEL.modalClose).first();
  if (await closer.count()) {
    await closer.click();
    await page.locator(SEL.openModalShell).waitFor({ state: 'hidden', timeout: CHECK_MS }).catch(() => {
      throw new Error(`${RTL_LAYOUT_CODE}: kabuk kapanmadı`);
    });
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} file
 * @param {{ expectPanel?: boolean }} [opts]
 */
async function checkAndShot(page, file, opts = {}) {
  const sample = await assertRtlLayout(page, opts);
  if (file) await shot(page, file);
  return sample;
}

async function runLocaleDevice({ resolved, locale, deviceId, port, shotDir, saveShots }) {
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(`${resolved.id}-rtl-${locale}`, port, snap, { hpos: !!resolved.hpos });
  restoreSqlite(wpDir, snap);
  const loc = applyMatrixLocale(wpDir, locale);
  if (!loc.ok) throw new Error(`locale ${locale}: ${JSON.stringify(loc).slice(0, 200)}`);
  matrixEval(wpDir, ['ensure-admin']);
  const server = await startPhpServer({ wpDir, port });
  const preset = getDevicePreset(deviceId);
  const browser = await preset.browserType.launch({ headless: true });
  const results = [];
  const products = (probe && probe.products) || {};
  const fileFor = (screen) =>
    saveShots ? path.join(shotDir, `rtl-ar-${screen}-${deviceId}.png`) : '';

  try {
    const context = await browser.newContext({ ...preset.context });
    await applyNetworkGuard(context, { profile: { id: 'local' }, allowedHosts: ['127.0.0.1', 'localhost'] });
    const page = await context.newPage();
    page.setDefaultTimeout(CHECK_MS);
    page.setDefaultNavigationTimeout(CHECK_MS);

    const run = async (id, fn) => {
      const t0 = Date.now();
      try {
        await fn();
        results.push({ id, ok: true, ms: Date.now() - t0, error: '' });
      } catch (e) {
        results.push({
          id,
          ok: false,
          ms: Date.now() - t0,
          error: String(e && e.message ? e.message : e).slice(0, 1600),
        });
      }
    };

    const custom = products.custom || products.fixed || Object.values(products)[0];
    const campaign = products.campaign || custom;

    await run('popup', async () => {
      if (!custom || !custom.path) throw new Error('ürün yok');
      matrixEval(wpDir, ['product-content', 'custom', 'button_popup']);
      await openDisplay(page, server.url.replace(/\/$/, ''), custom.path, 'popup');
      await checkAndShot(page, fileFor('popup'));
      if (process.env.WDP_DBG) console.log(JSON.stringify(await page.evaluate(() => { const i = document.querySelector('.wdp-modal.show .wdp-phone-field__number'); if (!i) return null; const c = getComputedStyle(i); const r = i.getBoundingClientRect(); return { ta: c.textAlign, dir: c.direction, pi: c.paddingInlineStart, l: r.left, r: r.right, ub: c.unicodeBidi }; })));
      await closeShell(page);
    });

    await run('panel', async () => {
      if (!custom || !custom.path) throw new Error('ürün yok');
      matrixEval(wpDir, ['product-content', 'custom', 'button_panel']);
      await openDisplay(page, server.url.replace(/\/$/, ''), custom.path, 'panel');
      await checkAndShot(page, fileFor('panel'), { expectPanel: true });
      await closeShell(page);
    });

    await run('inline', async () => {
      if (!custom || !custom.path) throw new Error('ürün yok');
      matrixEval(wpDir, ['product-content', 'custom', '']);
      matrixEval(wpDir, ['placement-display', 'inline']);
      await openDisplay(page, server.url.replace(/\/$/, ''), custom.path, 'inline');
      await checkAndShot(page, fileFor('inline'));
    });

    await run('progress', async () => {
      const rec = campaign || custom;
      if (!rec || !rec.path) throw new Error('progress ürün yok');
      matrixEval(wpDir, ['product-content', rec === campaign ? 'campaign' : 'custom', 'button_popup']);
      await openDisplay(page, server.url.replace(/\/$/, ''), rec.path, 'popup');
      const bar = page.locator('.wdp-progress-bar-container').first();
      if (await bar.count()) {
        await bar.waitFor({ state: 'visible', timeout: CHECK_MS });
      }
      await checkAndShot(page, fileFor('progress'));
      await closeShell(page);
    });

    await run('error', async () => {
      if (!custom || !custom.path) throw new Error('ürün yok');
      matrixEval(wpDir, ['product-content', 'custom', 'button_popup']);
      const root = await openDisplay(page, server.url.replace(/\/$/, ''), custom.path, 'popup');
      const submit = root.locator(`${SEL.addToCart}, ${SEL.goCheckout}`).first();
      if (await submit.count()) {
        await submit.click();
        await page.locator(`${SEL.formError}, ${SEL.fieldError}, ${SEL.toastError}`).first().waitFor({
          state: 'visible',
          timeout: 8000,
        });
      }
      await checkAndShot(page, fileFor('error'));
      await closeShell(page);
    });

    await run('cart', async () => {
      const cartPath = probe.cartUrl ? new URL(probe.cartUrl).pathname : '/cart/';
      await gotoPath(page, server.url.replace(/\/$/, ''), cartPath);
      await checkAndShot(page, fileFor('cart'));
    });

    await run('checkout', async () => {
      const checkoutPath = probe.checkoutUrl ? new URL(probe.checkoutUrl).pathname : '/checkout/';
      await gotoPath(page, server.url.replace(/\/$/, ''), checkoutPath);
      await checkAndShot(page, fileFor('checkout'));
    });

    await run('related', async () => {
      const rec = products.fixed || custom;
      if (!rec || !rec.path) throw new Error('related ürün yok');
      await gotoPath(page, server.url.replace(/\/$/, ''), rec.path);
      await checkAndShot(page, fileFor('related'));
    });

    if (!preset.isMobile) {
      await run('admin', async () => {
        await loginAdmin(page, server.url.replace(/\/$/, ''));
        for (const slug of ADMIN_SCREENS) {
          await gotoPath(page, server.url.replace(/\/$/, ''), `/wp-admin/admin.php?page=${slug}`);
          await page.waitForSelector('.dpa', { timeout: CHECK_MS });
          await checkAndShot(page, fileFor(`admin-${slug}`));
        }
      });
    }

    await context.close();
  } finally {
    await browser.close();
    await server.stop();
  }
  return results;
}

async function main() {
  setActiveProfile({ id: 'local', allowedHosts: ['127.0.0.1', 'localhost'] });
  const matrix = loadMatrix();
  const spec = rtlSpec(matrix);
  const resolved = resolveConfig(matrix, spec.baseConfig);
  const port = Number(process.env.WDP_LOCAL_E2E_PORT || process.env.WDP_RTL_PORT || 9450);
  fs.mkdirSync(ANA_SHOT_DIR, { recursive: true });

  const locales = spec.locales.filter(Boolean);
  const devices = spec.devices.filter((d) => d === 'iphone' || d === 'desktop');
  const all = [];
  let n = 0;
  for (const locale of locales) {
    for (const deviceId of devices) {
      const saveShots = locale === 'ar';
      const rows = await runLocaleDevice({
        resolved,
        locale,
        deviceId,
        port: port + n,
        shotDir: ANA_SHOT_DIR,
        saveShots,
      });
      n += 1;
      for (const r of rows) {
        all.push({ locale, device: deviceId, ...r });
        const mark = r.ok ? 'geçti' : 'HATA';
        console.log(`${locale} ${deviceId} ${r.id}: ${mark} ${r.ms}ms${r.error ? ' ' + r.error : ''}`);
      }
    }
  }
  const failed = all.filter((r) => !r.ok);
  const shots = fs.existsSync(ANA_SHOT_DIR)
    ? fs.readdirSync(ANA_SHOT_DIR).filter((f) => f.endsWith('.png'))
    : [];
  console.log(`RTL-LAYOUT ${all.length - failed.length}/${all.length}  ekran=${shots.length} → ${ANA_SHOT_DIR}`);
  if (failed.length) {
    console.error(failed.map((f) => `${f.locale}/${f.device}/${f.id}: ${f.error}`).join('\n'));
    process.exit(1);
  }
}

if (process.argv[1] === __filename) {
  main().catch((e) => {
    console.error(e && e.message ? e.message : e);
    process.exit(1);
  });
}
