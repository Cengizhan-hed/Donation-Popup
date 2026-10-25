#!/usr/bin/env node
/**
 * Altın kayıt 2 — görünür eklenti metni (capture / compare).
 *
 *   npm run i18n:golden -- --capture [--locale tr_TR]
 *   npm run i18n:golden -- --compare [--locale tr_TR]
 *   npm run i18n:golden -- --compare --locale en_US --assert-english
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ROOT } from './helpers/env-root.mjs';
import { withCacheBust } from './helpers/env.mjs';
import { SEL } from './helpers/selectors.mjs';
import { setActiveProfile } from './helpers/profile.mjs';
import { loadMatrix, resolveConfig } from './helpers/matrix-cover.mjs';
import {
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
  restoreSqlite,
  matrixEval,
} from './helpers/matrix-setup.mjs';
import { applyNetworkGuard } from './helpers/network-guard.mjs';
import { clickShellTrigger, openShellLocator } from './helpers/checks.mjs';
import {
  normalizeVisibleText,
  textToLines,
  diffScreenLines,
  findTurkishInText,
  extractElementorWidgetStrings,
  writeScreen,
  readScreen,
  goldenDir,
} from './helpers/i18n-text.mjs';

const __filename = fileURLToPath(import.meta.url);
const CONFIGS = ['tt5-try-blocks-hpos', 'sf-gbp-classic-hpos'];
const KINDS = ['fixed', 'custom', 'shares', 'campaign'];
const DISPLAYS = [
  { id: 'popup', mode: 'button_popup', trigger: 'popup' },
  { id: 'panel', mode: 'button_panel', trigger: 'panel' },
  { id: 'inline', mode: 'inline', trigger: '' },
];
const ADMIN_TABS = [
  'products',
  'placement',
  'design-studio',
  'modal-layout',
  'normal-form',
  'shareholder-form',
  'progress-bar',
  'success-screen',
  'advanced',
];
const CHECK_MS = 25000;

function parseArgs(argv) {
  const out = {
    capture: false,
    compare: false,
    locale: 'tr_TR',
    assertEnglish: false,
    only: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--capture') out.capture = true;
    else if (a === '--compare') out.compare = true;
    else if (a === '--assert-english') out.assertEnglish = true;
    else if (a === '--locale') out.locale = String(argv[++i] || 'tr_TR');
    else if (a === '--only') out.only = String(argv[++i] || '');
  }
  if (!out.capture && !out.compare) out.capture = true;
  return out;
}

function extraQuery() {
  return { hdf_no_side_cart: '1' };
}

async function gotoPath(page, baseUrl, pathName) {
  const url = withCacheBust(baseUrl, pathName || '/', extraQuery());
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CHECK_MS });
}

async function extractFromSelectors(page, selectors) {
  return page.evaluate((sels) => {
    const seen = new Set();
    const chunks = [];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el)) continue;
        if (el.closest && [...seen].some((p) => p.contains && p.contains(el))) continue;
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (st.display === 'none' || st.visibility === 'hidden' || r.width < 2 || r.height < 2) continue;
        const t = (el.innerText || '').replace(/\u00a0/g, ' ').trim();
        if (!t) continue;
        seen.add(el);
        chunks.push(t);
      }
    }
    return chunks.join('\n');
  }, selectors);
}

function toPayload(id, raw, extra = {}) {
  const text = normalizeVisibleText(raw);
  return {
    id,
    text,
    lines: textToLines(text),
    ...extra,
  };
}

async function captureElementor(locale, configId) {
  const widgets = extractElementorWidgetStrings(ROOT, locale);
  const lines = [];
  for (const w of widgets) {
    if (w.title) lines.push(w.title);
    for (const k of w.keywords) lines.push(k);
  }
  const payload = {
    id: 'elementor-widgets',
    locale,
    config: configId,
    widgets,
    text: lines.join('\n'),
    lines,
  };
  return payload;
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

async function captureAdmin(page, baseUrl, locale, configId, probe) {
  const out = [];
  await loginAdmin(page, baseUrl);
  await gotoPath(page, baseUrl, '/wp-admin/admin.php?page=wdp-popup-settings');
  await page.waitForSelector('.wdp-admin-wrap', { timeout: CHECK_MS });
  for (const tab of ADMIN_TABS) {
    const link = page.locator(`.wdp-nav-tab-wrapper a.nav-tab[data-tab="${tab}"]`).first();
    if (await link.count()) {
      await link.click();
      const panel = page.locator(`#wdp-${tab}-tab, [aria-labelledby="wdp-tab-${tab}"]`).first();
      if (await panel.count()) {
        await panel.waitFor({ state: 'visible', timeout: CHECK_MS });
      }
    }
    const raw = await extractFromSelectors(page, ['.wdp-admin-wrap']);
    out.push(toPayload(`admin-tab-${tab}`, raw, { locale, config: configId }));
  }

  const products = (probe && probe.products) || {};
  const first = products.fixed || products.custom || Object.values(products)[0];
  if (first && first.id) {
    await gotoPath(page, baseUrl, `/wp-admin/post.php?post=${first.id}&action=edit`);
    const tab = page.locator(SEL.productDonationTab).first();
    if (await tab.count()) {
      await tab.click();
      await page.waitForSelector('#wdp_donation_data, .wdp_donation_options', { timeout: CHECK_MS });
    }
    const raw = await extractFromSelectors(page, ['#wdp_donation_data', '.wdp_donation_options', '#woocommerce-product-data .wdp_donation_tab']);
    out.push(toPayload('admin-product-data-tab', raw, { locale, config: configId }));
  }
  return out;
}

async function openDisplay(page, baseUrl, productPath, display) {
  await gotoPath(page, baseUrl, productPath);
  if (display.id === 'inline') {
    await page.waitForSelector(SEL.inlineDonationForm, { timeout: CHECK_MS });
    return page.locator(SEL.inlineDonationForm).first();
  }
  const triggerSel = display.id === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger;
  const trigger = page.locator(triggerSel).first();
  await trigger.waitFor({ state: 'visible', timeout: CHECK_MS });
  await clickShellTrigger(trigger, CHECK_MS);
  const shell = openShellLocator(page, display.trigger);
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  return shell;
}

async function captureForms(page, baseUrl, wpDir, locale, configId, probe) {
  const out = [];
  const products = (probe && probe.products) || {};
  for (const kind of KINDS) {
    const rec = products[kind];
    if (!rec || !rec.path) continue;
    for (const display of DISPLAYS) {
      if (display.id === 'inline') {
        const cleared = matrixEval(wpDir, ['product-content', kind, '']);
        if (cleared && cleared.ok === false) {
          throw new Error(`product-content ${kind} clear: ${cleared.error || ''}`);
        }
        const place = matrixEval(wpDir, ['placement-display', 'inline']);
        if (place && place.ok === false) {
          throw new Error(`placement-display inline: ${place.error || ''}`);
        }
      } else {
        const set = matrixEval(wpDir, ['product-content', kind, display.mode]);
        if (set && set.ok === false) {
          throw new Error(`product-content ${kind} ${display.mode}: ${set.error || ''}`);
        }
      }
      const root = await openDisplay(page, baseUrl, rec.path, display);
      const openRaw = await root.innerText();
      out.push(toPayload(`form-${display.id}-${kind}-open`, openRaw, { locale, config: configId }));

      const submit = root.locator(`${SEL.addToCart}, ${SEL.goCheckout}`).first();
      if (await submit.count()) {
        await submit.click();
        await page.locator(`${SEL.formError}, ${SEL.fieldError}, ${SEL.toastError}`).first().waitFor({
          state: 'visible',
          timeout: 8000,
        }).catch(() => {
          throw new Error(`boş-gönderim hata görünmedi: ${display.id}-${kind}`);
        });
      }
      const errRaw = await root.innerText();
      out.push(toPayload(`form-${display.id}-${kind}-error`, errRaw, { locale, config: configId }));

      if (display.id !== 'inline') {
        const closer = page.locator(SEL.modalClose).first();
        if (await closer.count()) await closer.click();
      }
    }
  }
  return out;
}

async function captureCartCheckout(page, baseUrl, locale, configId, probe) {
  const out = [];
  const cartPath = probe.cartUrl ? new URL(probe.cartUrl).pathname : '/cart/';
  const checkoutPath = probe.checkoutUrl ? new URL(probe.checkoutUrl).pathname : '/checkout/';
  await gotoPath(page, baseUrl, cartPath);
  const cartRaw = await extractFromSelectors(page, [
    '.woocommerce-cart-form',
    '.wc-block-cart',
    '.shop_table',
    '[class*="wdp-"]',
    '.woocommerce-info',
    '.wc-block-components-product-details',
  ]);
  out.push(toPayload('cart', cartRaw, { locale, config: configId }));
  await gotoPath(page, baseUrl, checkoutPath);
  const coRaw = await extractFromSelectors(page, [
    '.woocommerce-checkout',
    '.wc-block-checkout',
    '[class*="wdp-"]',
    '.wc-block-components-product-details',
    '.woocommerce-checkout-review-order',
  ]);
  out.push(toPayload('checkout', coRaw, { locale, config: configId }));
  return out;
}

async function extractSortedCards(page, cardSels, rootSels) {
  return page.evaluate(
    ({ cards, roots }) => {
      const norm = (s) =>
        String(s || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      const seen = new Set();
      const texts = [];
      const rootsEl = roots.flatMap((sel) => Array.from(document.querySelectorAll(sel)));
      const scope = rootsEl.length ? rootsEl : [document];
      for (const root of scope) {
        const nodes = root.querySelectorAll(cards.join(','));
        for (const el of nodes) {
          if (seen.has(el)) continue;
          seen.add(el);
          const t = norm(el.innerText);
          if (t) texts.push(t);
        }
      }
      texts.sort((a, b) => a.localeCompare(b));
      return texts.join('\n');
    },
    { cards: cardSels, roots: rootSels }
  );
}

async function captureListRelated(page, baseUrl, locale, configId, probe) {
  const out = [];
  if (probe.listPath) {
    await gotoPath(page, baseUrl, probe.listPath);
    const raw = await extractSortedCards(
      page,
      ['.wdp-card', 'li.product'],
      ['.wdp-list-wrap', '.wdp-list']
    );
    out.push(toPayload('donations-list', raw, { locale, config: configId }));
  }
  const rec = (probe.products && (probe.products.fixed || probe.products.custom)) || null;
  if (rec && rec.path) {
    await gotoPath(page, baseUrl, rec.path);
    const raw = await extractSortedCards(
      page,
      ['li.product', 'li.wc-block-product', '.wdp-card'],
      [
        '.related.products',
        '.upsells.products',
        '.wp-block-woocommerce-related-products',
        '.wp-block-woocommerce-product-collection',
      ]
    );
    out.push(toPayload('related-cards', raw, { locale, config: configId }));
  }
  return out;
}

function applyLocale(wpDir, locale) {
  const evalFile = path.join(ROOT, 'tests/local-wp/eval-file.php');
  const r = spawnSync(
    'php',
    ['-d', 'memory_limit=1024M', evalFile, 'tests/local-wp/i18n-locale.php', locale],
    {
      encoding: 'utf8',
      cwd: ROOT,
      env: { ...process.env, WDP_LOCAL_WP_DIR: wpDir },
      timeout: 60000,
    }
  );
  if (r.status !== 0) {
    throw new Error(`locale: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  }
}

async function captureConfig(resolved, locale, port) {
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, port, snap, { hpos: !!resolved.hpos });
  restoreSqlite(wpDir, snap);
  applyLocale(wpDir, locale);
  const server = await startPhpServer({ wpDir, port });
  const screens = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await applyNetworkGuard(context, { profileId: 'local', allowedHosts: ['127.0.0.1', 'localhost'] });
    const page = await context.newPage();
    screens.push(...(await captureForms(page, server.url.replace(/\/$/, ''), wpDir, locale, resolved.id, probe)));
    screens.push(...(await captureCartCheckout(page, server.url.replace(/\/$/, ''), locale, resolved.id, probe)));
    screens.push(...(await captureListRelated(page, server.url.replace(/\/$/, ''), locale, resolved.id, probe)));
    screens.push(...(await captureAdmin(page, server.url.replace(/\/$/, ''), locale, resolved.id, probe)));
    screens.push(await captureElementor(locale, resolved.id));
    await context.close();
  } finally {
    await browser.close();
    await server.stop();
  }
  return screens;
}

function writeOrCompare(flags, screens) {
  const diffs = [];
  const englishHits = [];
  for (const s of screens) {
    if (flags.assertEnglish || flags.locale === 'en_US') {
      const hit = findTurkishInText(s.text || s.lines.join('\n'));
      if (hit.letters.length || hit.words.length) {
        englishHits.push(`${s.config}/${s.id}: letters=${hit.letters.join('')} words=${hit.words.join(',')}`);
      }
    }
    if (flags.capture) {
      writeScreen(flags.locale, s.config, s);
    }
    if (flags.compare) {
      const prev = readScreen(flags.locale, s.config, s.id);
      if (!prev) {
        diffs.push(`${s.config}/${s.id}: altın kayıt yok`);
        continue;
      }
      const d = diffScreenLines(prev, s);
      if (d.length) diffs.push(`${s.config}/${s.id}:\n  ${d.slice(0, 12).join('\n  ')}`);
    }
  }
  return { diffs, englishHits };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  setActiveProfile({ id: 'local', allowedHosts: ['127.0.0.1', 'localhost'] });
  const matrix = loadMatrix();
  const want = CONFIGS.filter((id) => !flags.only || flags.only === id).map((id) => resolveConfig(matrix, id));
  const basePort = Number(process.env.WDP_I18N_PORT || 9310);
  const all = [];
  for (let i = 0; i < want.length; i += 1) {
    const screens = await captureConfig(want[i], flags.locale, basePort + i);
    all.push(...screens);
  }
  const { diffs, englishHits } = writeOrCompare(flags, all);
  const dir = goldenDir(flags.locale);
  console.log(`ekran: ${all.length} → ${path.relative(ROOT, dir)}`);
  if (flags.assertEnglish && englishHits.length) {
    console.error('assert-english:\n' + englishHits.join('\n'));
    process.exit(1);
  }
  if (flags.compare && diffs.length) {
    console.error('fark:\n' + diffs.join('\n'));
    process.exit(1);
  }
  if (flags.compare) console.log('compare: yeşil');
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invoked) {
  main().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  });
}

export { parseArgs, toPayload };
