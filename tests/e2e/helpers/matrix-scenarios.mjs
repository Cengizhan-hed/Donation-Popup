/**
 * Yerel matris senaryoları. waitForTimeout yok; boş .catch yutma yok.
 */
import fs from 'node:fs';
import { expect } from '@playwright/test';
import path from 'node:path';
import { SEL, DP_SEL } from './selectors.mjs';
import { isStepShown, setChecked } from './dp-form.mjs';
import { formatMoney, formatMinPlaceholder, formatFillAmount } from './currency.mjs';
import { withCacheBust } from './env.mjs';
import {
  attachConsoleErrorCollector,
  clickAddToCartAndWait,
  isDonationAddToCartRequest,
  revealListProductTrigger,
  assertNoUnexpectedPluginErrors,
} from './checks.mjs';
import { applyNetworkGuard } from './network-guard.mjs';
import {
  emptyCartStoreApiWithFetch,
  playwrightStoreFetch,
  readStoreApiNonceGlobals,
} from './store-api.mjs';
import { getDevicePreset } from './devices.mjs';
import { matrixEval } from './matrix-setup.mjs';
import {
  classifyLoopCardsResult,
  formatLoopCardFail,
  RELATED_ROOT_SEL,
  RELATED_CARD_SEL,
  RELATED_TITLE_SEL,
} from './loop-cards.mjs';
import {
  classifyVisiblePluginEntry,
  classifyNativeCartVisibility,
  displayMismatchWarning,
  nativeCartProbeBrowser,
  LOOP_EXCLUDE_SEL,
  NATIVE_CART_FORM_SEL,
  NATIVE_ATC_BTN_SEL,
  STICKY_ATC_SEL,
  DISPLAY_MODES,
} from './product-page-ui.mjs';
import {
  probeShellOverlapBeforeAfter,
  waitAndAssertShellOverlap,
} from './shell-overlap.mjs';
import {
  attachNativeSubmitReloadGuard,
  NATIVE_SUBMIT_RELOAD_CODE,
} from './native-submit-guard.mjs';
import { FREEZE_MOTION_CSS } from './selectors.mjs';
import {
  DONOR_NAME,
  DONOR_EMAIL,
  DONOR_PHONE,
  DEDICATION,
  SHAREHOLDER_NAME,
  SHAREHOLDER_PHONE,
  completeLocalCheckout,
} from './place-order.mjs';

const CHECK_MS = 25000;
const CART_MS = 20000;
const PLUGIN_URL_RE = /\/wp-content\/plugins\/woo-donation-popup\//i;
const MIN_TOUCH = 24;
const DONATION_RELOAD_GUARD_IDS = new Set([
  'product-cart',
  'amount-ambiguous',
  'amount-tr-comma',
  'list-checkout',
  'place-order',
  'validation-errors',
]);

function extraQuery() {
  return {};
}

function locFromError(err) {
  const stack = String(err && err.stack ? err.stack : '');
  const m =
    stack.match(/matrix-scenarios\.mjs:(\d+)(?::(\d+))?/) ||
    stack.match(/([^\s()]+\.(?:mjs|js|php)):(\d+)/);
  if (m && m[0].includes('matrix-scenarios')) return `tests/e2e/helpers/matrix-scenarios.mjs:${m[1]}`;
  if (m) return `${m[1]}:${m[2]}`;
  return '';
}

function pluginConsoleErrors(errors) {
  return (errors || []).filter((e) => {
    const t = String(e);
    const k = (t.match(/kind=([a-z-]+)/) || [])[1] || '';
    if (k === 'plugin') return true;
    if (PLUGIN_URL_RE.test(t)) return true;
    if (/wdp-|hdf-donation|woo-donation-popup/i.test(t) && !/kind=(theme|upload|favicon|core)/.test(t)) {
      return true;
    }
    return false;
  });
}

function normalizePriceText(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function amountVisible(hay, amount, store) {
  const formatted = formatMoney(amount, store);
  const t = normalizePriceText(hay);
  if (t.includes(formatted)) return true;
  const compactFmt = formatted.replace(/\s+/g, '');
  if (t.replace(/\s+/g, '').includes(compactFmt)) return true;
  const n = Number(amount);
  const decimals = Number(store.decimals) || 0;
  const thousand = store.thousandSeparator ?? ',';
  const decimal = store.decimalSeparator ?? '.';
  const abs = Math.abs(n).toFixed(decimals);
  const [intRaw, frac = ''] = abs.split('.');
  const intFmt = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, thousand);
  const num = decimals > 0 ? `${intFmt}${decimal}${frac}` : intFmt;
  return t.includes(num);
}

function symbolPositionOk(hay, amount, store) {
  const t = normalizePriceText(hay);
  const symbol = String(store.symbol || '');
  if (!symbol || !t.includes(symbol)) return true;
  const n = Number(amount);
  const decimals = Number(store.decimals) || 0;
  const thousand = store.thousandSeparator ?? ',';
  const decimal = store.decimalSeparator ?? '.';
  const abs = Math.abs(n).toFixed(decimals);
  const [intRaw, frac = ''] = abs.split('.');
  const intFmt = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, thousand);
  const num = decimals > 0 ? `${intFmt}${decimal}${frac}` : intFmt;
  const iNum = t.indexOf(num);
  const iSym = t.indexOf(symbol);
  if (iNum < 0 || iSym < 0) return true;
  const pos = String(store.symbolPosition || 'left');
  if (pos === 'left' || pos === 'left_space') return iSym < iNum;
  return iNum < iSym;
}

async function gotoPath(page, baseUrl, pathName) {
  const url = withCacheBust(baseUrl, pathName || '/', extraQuery());
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CHECK_MS });
}

async function emptyCartStoreApi(page, baseUrl) {
  if (!/^https?:\/\//i.test(page.url())) {
    await gotoPath(page, baseUrl, '/');
  }
  const globals = await readStoreApiNonceGlobals(page);
  const result = await emptyCartStoreApiWithFetch(playwrightStoreFetch(page), {
    baseUrl,
    globals,
  });
  if (!result.emptied) {
    throw new Error(`Store API sepet silinemedi status=${result.status} ${result.reason}`);
  }
}

/**
 * Ürünün yeni nesil form kökü (bağlanmış). productId verilmezse sayfadaki ilk kök.
 * @param {import('@playwright/test').Page} page
 * @param {number} [productId]
 */
function productRoot(page, productId = 0) {
  const id = Number(productId) > 0 ? `[data-dp-product="${Number(productId)}"]` : '';
  return page.locator(`${DP_SEL.root}[data-dp-mounted="1"]${id}`).first();
}

async function waitFormReady(root) {
  const form = root.locator(DP_SEL.form).first();
  await form.waitFor({ state: 'visible', timeout: CHECK_MS });
  return form;
}

/**
 * Açık katmanın (popup / panel / alt sayfa) açılış animasyonu bitsin; sabit uyku yok.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} root
 */
async function settleOpenShell(page, root) {
  await root.locator(`${DP_SEL.overlay}.is-open`).first().waitFor({ state: 'visible', timeout: CHECK_MS });
  await page.waitForFunction(
    () => {
      const s = document.querySelector('[data-dp-overlay].is-open [data-dp-surface], .is-open [data-dp-surface]');
      if (!s) return false;
      if (s.getAnimations().some((a) => a.playState === 'running')) return false;
      return Number.parseFloat(getComputedStyle(s).opacity || '1') > 0.99;
    },
    undefined,
    { timeout: CHECK_MS }
  );
}

/**
 * Katman türündeki kökü aç (satır içi ise yalnız formu bekle).
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} root
 */
async function openRoot(page, root) {
  await root.waitFor({ state: 'attached', timeout: CHECK_MS });
  const kind = (await root.getAttribute('data-dp-kind')) || 'inline';
  if (kind !== 'inline') {
    const trigger = root.locator(DP_SEL.open).first();
    await trigger.waitFor({ state: 'visible', timeout: CHECK_MS });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click({ timeout: CHECK_MS });
    await settleOpenShell(page, root);
  }
  await waitFormReady(root);
  return kind;
}

/**
 * Tutar adımı: özel tutar alanı varsa yazılır; yoksa ilk önerilen tutar seçilir.
 * @param {import('@playwright/test').Locator} form
 * @param {object} store
 * @param {number|string} [amount]
 */
async function fillAmountStep(form, store, amount) {
  const custom = form.locator(DP_SEL.amount).first();
  if ((await custom.count()) > 0) {
    await custom.waitFor({ state: 'visible', timeout: CHECK_MS });
    const value = typeof amount === 'string' ? amount : formatFillAmount(amount, store) || String(amount);
    await custom.fill(value);
    return;
  }
  const preset = form.locator(DP_SEL.preset).first();
  if ((await preset.count()) > 0) await preset.click({ timeout: CHECK_MS });
}

/**
 * "Devam" ile bilgi adımına geç (adımlar tek sayfaysa bir şey yapmaz).
 * @param {import('@playwright/test').Locator} form
 */
async function advanceToDetails(form) {
  const details = form.locator(DP_SEL.detailsStep).first();
  if (await isStepShown(details)) {
    await details.waitFor({ state: 'visible', timeout: CHECK_MS });
    return;
  }
  await form.locator(DP_SEL.submit).first().click({ timeout: CHECK_MS });
  await details.waitFor({ state: 'visible', timeout: CHECK_MS });
}

/**
 * Hatasız tam doldurma: tutar -> (ithaf) -> bilgiler. Gönderim yapmaz.
 * @param {import('@playwright/test').Locator} scope Form kökü.
 * @param {object} store
 * @param {{amount?: number|string}} [opts]
 */
async function fillDonationForm(scope, store, opts = {}) {
  const form = scope.locator(DP_SEL.form).first();
  const amount = opts.amount != null ? opts.amount : store.amount;
  await fillAmountStep(form, store, amount);
  const toggle = form.locator(DP_SEL.dediToggle).first();
  if ((await toggle.count()) > 0) {
    await setChecked(toggle, true);
    await form.locator('input[name="donation_dedication"]').first().fill(DEDICATION);
  }
  await advanceToDetails(form);
  const name = form.locator(SEL.donorName).first();
  await name.waitFor({ state: 'visible', timeout: CHECK_MS });
  await name.fill(DONOR_NAME);
  const phone = form.locator(SEL.donorPhone).first();
  if ((await phone.count()) > 0 && (await phone.isVisible())) await phone.fill(DONOR_PHONE);
  const email = form.locator(SEL.donorEmail).first();
  if ((await email.count()) > 0 && (await email.isVisible())) await email.fill(DONOR_EMAIL);
  const ded = form.locator('input[name="donation_dedication"]').first();
  if ((await ded.count()) > 0 && (await ded.isVisible()) && !(await ded.inputValue())) await ded.fill(DEDICATION);
  const anon = form.locator('input[name="donation_anonymous"]').first();
  if ((await anon.count()) > 0) await setChecked(anon, true);
  const shName = form.locator('input[name="shareholder_1_name"]').first();
  if ((await shName.count()) > 0 && (await shName.isVisible())) await shName.fill(SHAREHOLDER_NAME);
  const shPhone = form.locator('input[name="shareholder_1_phone"]').first();
  if ((await shPhone.count()) > 0 && (await shPhone.isVisible())) await shPhone.fill(SHAREHOLDER_PHONE);
}

/**
 * Doğrulama: tutarı boşalt -> tutar hatası + odak; geçerli tutar -> bilgi adımı; boş gönder -> her zorunlu alanda hata + odak.
 * Not: tutar-adımı tutarsız formlarda (sabit fiyat / hisse) yalnız bilgi adımı denetlenir.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} root
 * @param {object} store
 * @param {string} label
 */
async function checkValidationErrors(page, root, store, label) {
  const form = root.locator(DP_SEL.form).first();
  const custom = form.locator(DP_SEL.amount).first();
  const visibleError = async (name) => {
    const el = form.locator(DP_SEL.error(name)).filter({ visible: true }).first();
    await el.waitFor({ state: 'visible', timeout: CHECK_MS });
    const text = String((await el.textContent()) || '').trim();
    if (!text) throw new Error(`${label}: ${name} hata metni boş`);
  };
  if ((await custom.count()) > 0) {
    await custom.fill('');
    await form.locator(DP_SEL.submit).first().click({ timeout: CHECK_MS });
    await visibleError('amount');
    const focused = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute('name')) || '');
    if (focused !== 'amount') throw new Error(`${label}: tutar hatasında odak '${focused}' (beklenen amount)`);
    await custom.fill(formatFillAmount(store.amount, store) || String(store.amount));
  } else {
    const preset = form.locator(DP_SEL.preset).first();
    if ((await preset.count()) > 0) await preset.click({ timeout: CHECK_MS });
  }
  await advanceToDetails(form);
  await form.locator(DP_SEL.submit).first().click({ timeout: CHECK_MS });
  const required = await form.evaluate((f) => {
    const step = f.querySelector('[data-dp-step="details"]') || f;
    return Array.from(step.querySelectorAll('input[required]:not(:disabled), textarea[required]:not(:disabled)'))
      .filter((el) => el.offsetParent !== null && String(el.value || '').trim() === '')
      .map((el) => el.getAttribute('name'));
  });
  if (!required.length) throw new Error(`${label}: bilgi adımında boş zorunlu alan bulunamadı`);
  for (const name of required) await visibleError(name);
  const focused = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute('name')) || '');
  if (!required.includes(focused)) {
    throw new Error(`${label}: odak '${focused}' hatalı alanlarda değil (${required.join(',')})`);
  }
}

/**
 * Sepet/ödeme sepet ekle isteklerini yakalayan ağ yoklaması (yerel form gönderimi = belge gezinmesi).
 * @param {import('@playwright/test').Page} page
 */
function attachSubmitNetworkProbe(page) {
  const startPath = (() => {
    try {
      return new URL(page.url()).pathname;
    } catch {
      return '';
    }
  })();
  /** @type {string[]} */
  const ajax = [];
  /** @type {string[]} */
  const nativeDoc = [];
  /** @param {import('@playwright/test').Request} req */
  const onReq = (req) => {
    if (isDonationAddToCartRequest(req)) {
      ajax.push(`${req.method()} ${req.url()}`);
    }
    if (typeof req.resourceType === 'function' && req.resourceType() === 'document') {
      try {
        const u = new URL(req.url());
        if (startPath && u.pathname === startPath) {
          nativeDoc.push(`${req.method()} ${u.pathname}`);
        }
      } catch {
        /* URL */
      }
    }
  };
  page.on('request', onReq);
  return {
    ajax,
    nativeDoc,
    detach() {
      page.off('request', onReq);
    },
  };
}

function assertSingleAjaxNoNative(probe, label) {
  if (probe.ajax.length !== 1) {
    throw new Error(`${label}: sepete ekle istek ${probe.ajax.length} (beklenen 1)`);
  }
  if (probe.nativeDoc.length) {
    throw new Error(`${label}: yerel form gönderimi ${probe.nativeDoc.join(', ')}`);
  }
}

/**
 * Son adımdaki gönder düğmesi: REST sepet isteği + ödeme sayfasına yönlenme.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} scope
 * @param {string} label
 */
async function goCheckoutFromForm(page, scope, label = 'product-cart') {
  const go = scope.locator(DP_SEL.form).first().locator(DP_SEL.submit).first();
  await go.waitFor({ state: 'visible', timeout: CHECK_MS });
  const probe = attachSubmitNetworkProbe(page);
  try {
    const ajax = await clickAddToCartAndWait(
      page,
      async () => {
        await go.click({ timeout: CHECK_MS, noWaitAfter: true });
      },
      { timeout: CART_MS }
    );
    if (ajax.timedOut || !ajax.ok) {
      throw new Error(`sepete ekle REST başarısız status=${ajax.status} timedOut=${ajax.timedOut} ${ajax.bodyPreview}`);
    }
    assertSingleAjaxNoNative(probe, label);
  } finally {
    probe.detach();
  }
  await page.waitForURL((u) => /checkout|order-pay|odeme|ödeme/i.test(u.pathname + u.search), { timeout: CHECK_MS });
}

/**
 * Tutar alanı yer tutucusu + sembol: sembol mağaza simgesiyle aynı, tutar alanı görünür ve boş.
 * @param {import('@playwright/test').Locator} scope
 * @param {object} store
 */
async function assertAmountFieldAndSymbol(scope, store) {
  const input = scope.locator(DP_SEL.amount).first();
  if ((await input.count()) === 0) return;
  await input.waitFor({ state: 'visible', timeout: CHECK_MS });
  const ph = String((await input.getAttribute('placeholder')) || '').trim();
  if (!ph) throw new Error('tutar alanı yer tutucusu boş');
  const sym = String((await scope.locator('.donation-panel-custom__sym').first().textContent()) || '').trim();
  const want = String(store.symbol || '').trim();
  if (want && sym !== want) throw new Error(`tutar alanı sembolü '${sym}' ≠ mağaza '${want}'`);
}

/**
 * Kapat düğmesi ≥44px ve form kutusuyla kesişmez (yalnız katmanlarda).
 * @param {import('@playwright/test').Page} page
 */
async function assertCloseNotOverlappingForm(page) {
  const info = await page.evaluate(() => {
    const overlay = document.querySelector('[data-dp-overlay].is-open');
    if (!overlay) return { skip: true };
    const close = overlay.querySelector('[data-dp-close]');
    const body = overlay.querySelector('[data-dp-step]:not([hidden]) .donation-panel-fieldset, [data-dp-step]:not([hidden]) .donation-panel-field');
    if (!close) return { error: 'kapat düğmesi yok' };
    const c = close.getBoundingClientRect();
    const f = body ? body.getBoundingClientRect() : null;
    const overlap = f ? !(c.right <= f.left || c.left >= f.right || c.bottom <= f.top || c.top >= f.bottom) : false;
    return { overlap, cw: c.width, ch: c.height };
  });
  if (info.skip) return;
  if (info.error) throw new Error(info.error);
  if (info.cw + 1 < 44 || info.ch + 1 < 44) {
    throw new Error(`kapat dokunma hedefi < 44px (${Math.round(info.cw)}x${Math.round(info.ch)})`);
  }
  if (info.overlap) throw new Error('kapat düğmesi form alanlarıyla kesişiyor');
}

async function openProductForm(page, baseUrl, productPath, productId = 0) {
  await gotoPath(page, baseUrl, productPath);
  const root = productRoot(page, productId);
  await openRoot(page, root);
  await assertNoUnexpectedPluginErrors(page, { scenarioId: 'product-cart' });
  return root;
}

async function openListPopup(page, baseUrl, listPath, productId) {
  await gotoPath(page, baseUrl, listPath);
  await page.locator('.wdp-list-wrap, .wdp-list').first().waitFor({ state: 'visible', timeout: CHECK_MS });
  await revealListProductTrigger(page, productId);
  const cta = page.locator(`.wdp-list [data-wdp-form="${Number(productId)}"]`).first();
  await cta.waitFor({ state: 'visible', timeout: CHECK_MS });
  await cta.click({ timeout: CHECK_MS });
  const root = page.locator(`${DP_SEL.root}[data-dp-mounted="1"][data-dp-product="${Number(productId)}"]`).first();
  await settleOpenShell(page, root);
  await waitFormReady(root);
  await assertNoUnexpectedPluginErrors(page, { scenarioId: 'list-checkout' });
  return root;
}

/**
 * Sayfadaki (liste/ilgili ürün dışı) görünür eklenti girişleri: satır içi form, panel düğmesi, popup düğmesi.
 * @param {import('@playwright/test').Page} page
 */
async function entryCounts(page) {
  return page.evaluate(
    ({ excludeSel, inlineSel, panelSel, popupSel }) => {
      const excluded = (el) => !!(el && el.closest(excludeSel));
      const vis = (el) => {
        if (!el) return false;
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return (
          st.display !== 'none' &&
          st.visibility !== 'hidden' &&
          Number.parseFloat(st.opacity || '1') > 0.05 &&
          r.width > 4 &&
          r.height > 4
        );
      };
      const pick = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => !excluded(el));
      return {
        inlineVisible: pick(inlineSel).filter(vis).length,
        panelVisible: pick(panelSel).filter(vis).length,
        popupVisible: pick(popupSel).filter(vis).length,
      };
    },
    {
      excludeSel: LOOP_EXCLUDE_SEL,
      inlineSel: DP_SEL.inlineRoot,
      panelSel: DP_SEL.panelOpen,
      popupSel: DP_SEL.popupOpen,
    }
  );
}

/**
 * Blok sepet/ödeme sayfaları istemcide geç çizilir: metin koşulu sağlanana dek yokla (sabit uyku yok).
 * @param {import('@playwright/test').Page} page
 * @param {(body: string) => boolean} ok
 * @returns {Promise<string>} Son gövde metni.
 */
async function pollBodyText(page, ok, { collapsed = false } = {}) {
  // collapsed: blok ödeme özeti mobilde katlıdır; gizli satırlar da sayılsın diye textContent okunur.
  const read = () => page.locator('body').evaluate((b, c) => (c ? b.textContent || '' : b.innerText), collapsed);
  try {
    await expect.poll(async () => ok(await read()), { timeout: CHECK_MS, intervals: [250, 500, 1000] }).toBe(true);
  } catch {
    // Koşul sağlanmadı: çağıran gerçek metinle anlamlı hata üretir.
  }
  return read();
}

async function cartHasAmount(page, baseUrl, amount, store) {
  await gotoPath(page, baseUrl, '/cart/');
  await page
    .locator(
      '.woocommerce-cart-form, .wc-block-cart, .wp-block-woocommerce-cart, .cart_item, .wc-block-cart-items'
    )
    .first()
    .waitFor({ state: 'visible', timeout: CHECK_MS });
  const body = await pollBodyText(page, (t) => amountVisible(t, amount, store));
  if (!amountVisible(body, amount, store)) {
    throw new Error(`sepet tutar biçimi yok (beklenen ${formatMoney(amount, store)}): ${normalizePriceText(body).slice(0, 280)}`);
  }
  if (!symbolPositionOk(body, amount, store)) {
    throw new Error(`sepet sembol konumu hatalı (${store.symbolPosition})`);
  }
}

async function checkoutHasProductAmount(page, amount, store, productName) {
  await page
    .locator(
      '.woocommerce-checkout, .wc-block-checkout, form.checkout, .wp-block-woocommerce-checkout'
    )
    .first()
 .waitFor({ state: 'visible', timeout: CHECK_MS });
  const body = await pollBodyText(
    page,
    (t) => amountVisible(t, amount, store) && (!productName || t.includes(productName) || /WDP E2E Custom/i.test(t)),
    { collapsed: true }
  );
  if (productName && !body.includes(productName) && !/WDP E2E Custom/i.test(body)) {
    throw new Error(`ödeme sayfasında ürün adı yok: ${normalizePriceText(body).slice(0, 240)}`);
  }
  if (!amountVisible(body, amount, store)) {
    throw new Error(`ödeme tutar biçimi yok (beklenen ${formatMoney(amount, store)})`);
  }
}

async function assertNoOverflow(page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      overflow: doc.scrollWidth > doc.clientWidth + 1,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  if (overflow.overflow) {
    throw new Error(`yatay kaydırma var scroll=${overflow.scrollWidth} client=${overflow.clientWidth}`);
  }
}

async function assertTouchAndButtons(page) {
  const info = await page.evaluate((min) => {
    const root = document.querySelector('[data-dp-overlay].is-open') || document.querySelector('[data-dp-form]') || document.body;
    const nodes = Array.from(
      root.querySelectorAll(
        'button, a[href], [role="button"], [role="radio"]'
      )
    );
    const bad = [];
    let visibleButtons = 0;
    for (const el of nodes) {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (st.display === 'none' || st.visibility === 'hidden' || r.width <= 0 || r.height <= 0) continue;
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') visibleButtons += 1;
      if (r.width + 1 < min || r.height + 1 < min) {
        bad.push({
          tag: el.tagName,
          name: (el.getAttribute('name') || el.className || '').toString().slice(0, 80),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    const form = document.querySelector('[data-dp-overlay].is-open [data-dp-surface], [data-dp-form]');
    const box = form ? form.getBoundingClientRect() : null;
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const clipped = box ? box.right > vw + 2 || box.left < -2 : false;
    return { bad, visibleButtons, clipped };
  }, MIN_TOUCH);
  if (info.visibleButtons < 1) throw new Error('formda görünür düğme yok');
  if (info.clipped) throw new Error('form viewport dışına taşıyor');
  if (info.bad.length) {
    const sample = info.bad
      .slice(0, 3)
      .map((b) => `${b.name || b.tag} ${b.w}x${b.h}`)
      .join('; ');
    throw new Error(`dokunma hedefi < ${MIN_TOUCH}px: ${sample}`);
  }
}

async function snapshotChromeStyles(page) {
  return page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      if (el.closest('.wdp-modal, .hdf-donation-modal-wrapper, [class*="wdp-"], [class*="donation-panel"]')) return null;
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
    const bodyCs = getComputedStyle(document.body);
    return {
      body: {
        color: bodyCs.color,
        backgroundColor: bodyCs.backgroundColor,
        fontFamily: bodyCs.fontFamily,
        fontSize: bodyCs.fontSize,
        margin: bodyCs.margin,
        padding: bodyCs.padding,
      },
      heading: pick('.wp-block-site-title, .site-title, header h1, h1, .wp-block-site-title a'),
      menu: pick('header nav, .wp-block-navigation, .main-navigation, #site-navigation, nav'),
    };
  });
}

function stylesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function appendOverlapKanit(dir, row) {
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, '_overlap.jsonl'), `${JSON.stringify(row)}\n`, 'utf8');
}

function appendNativeSubmitKanit(dir, row) {
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, '_native-submit.jsonl'), `${JSON.stringify(row)}\n`, 'utf8');
}

/**
 * Popup/panel açıkken olay bazlı bekle + POPUP-OVERLAP; kabuk ekranı viewport.
 * @param {import('@playwright/test').Page} page
 * @param {string} dir
 * @param {string} name
 */
async function shot(page, dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  const shellOpen = (await page.locator(SEL.openModalShell).count()) > 0;
  const popupOrPanel = /(?:^|-)(popup|panel)(?:-|$)/i.test(String(name || ''));
  /** @type {Error | null} */
  let overlapErr = null;
  if (shellOpen) {
    await waitAndAssertShellOverlap(page, 8000);
    try {
      const probe = await probeShellOverlapBeforeAfter(page, 8000);
      appendOverlapKanit(dir, {
        name,
        immediateOk: !!(probe.immediateClass && probe.immediateClass.ok),
        afterOk: !!(probe.afterClass && probe.afterClass.ok),
        immediateMinOp: probe.immediateClass ? probe.immediateClass.minOpacity : null,
        afterMinOp: probe.afterClass ? probe.afterClass.minOpacity : null,
        immediateOutside: probe.immediateClass ? probe.immediateClass.outside : null,
        afterOutside: probe.afterClass ? probe.afterClass.outside : null,
        immediateAnim: probe.immediate && probe.immediate.animRunning,
        afterAnim: probe.afterWait && probe.afterWait.animRunning,
        parentIsBody: probe.afterWait && probe.afterWait.parentIsBody,
        immediateReasons: probe.immediateClass ? probe.immediateClass.reasons : [],
        afterReasons: probe.afterClass ? probe.afterClass.reasons : [],
      });
    } catch (eProbe) {
      overlapErr = eProbe instanceof Error ? eProbe : new Error(String(eProbe));
      appendOverlapKanit(dir, { name, error: overlapErr.message });
    }
  }
  /** @type {import('@playwright/test').ElementHandle | null} */
  let freezeHandle = null;
  if (shellOpen) {
    freezeHandle = await page.addStyleTag({ content: FREEZE_MOTION_CSS });
  }
  try {
    await page.screenshot({
      path: file,
      fullPage: !(shellOpen && popupOrPanel),
      animations: 'disabled',
    });
  } finally {
    if (freezeHandle) {
      await freezeHandle.evaluate((el) => el.remove());
    }
  }
  if (overlapErr) throw overlapErr;
  return file;
}

/**
 * @param {object} args
 */
export async function runDeviceScenarios({
  browserType,
  deviceId,
  baseUrl,
  wpDir,
  probe,
  store,
  checkoutKind,
  shotDir,
}) {
  const preset = getDevicePreset(deviceId);
  const browser = await preset.browserType.launch({ headless: true });
  const results = [];
  const context = await browser.newContext({ ...preset.context });
  await applyNetworkGuard(context, { profile: { id: 'local' } });
  const page = await context.newPage();
  page.setDefaultTimeout(CHECK_MS);
  page.setDefaultNavigationTimeout(CHECK_MS);
  const errors = attachConsoleErrorCollector(page);
  const reloadGuard = attachNativeSubmitReloadGuard(page);
  const product = probe.products?.custom || {};
  const productPath = product.path || '/';
  const productId = Number(product.id || 0);
  const listPath = probe.listPath || '/wdp-e2e-list/';
  const amount = store.amount;
  const productName = 'WDP E2E Custom';
  const overlapLog = path.join(shotDir, '_overlap.jsonl');
  if (fs.existsSync(overlapLog)) fs.unlinkSync(overlapLog);

  const runOne = async (id, fn) => {
    const started = Date.now();
    /** @type {{ id: string, ok: boolean, ms: number, error: string, loc: string, shot: string }} */
    const row = { id, ok: false, ms: 0, error: '', loc: '', shot: '' };
    const guardOn = DONATION_RELOAD_GUARD_IDS.has(id);
    if (guardOn) {
      reloadGuard.clearHits();
      reloadGuard.arm();
    } else {
      reloadGuard.disarm();
    }
    try {
      await fn();
      if (guardOn) {
        reloadGuard.assertClear(id);
      }
      row.ok = true;
    } catch (e) {
      const wrapped = guardOn ? reloadGuard.wrapError(id, e) : e;
      row.error = String(wrapped && wrapped.message ? wrapped.message : wrapped).slice(0, 400);
      row.loc = locFromError(e);
      try {
        row.shot = await shot(page, shotDir, `fail-${id}`);
      } catch (shotErr) {
        row.shot = `screenshot-fail: ${String(shotErr && shotErr.message ? shotErr.message : shotErr).slice(0, 80)}`;
      }
    }
    if (guardOn) {
      appendNativeSubmitKanit(shotDir, {
        id,
        code: NATIVE_SUBMIT_RELOAD_CODE,
        hits: reloadGuard.hits.length,
        journal: reloadGuard.journal.slice(-12),
        ok: row.ok,
      });
    }
    reloadGuard.disarm();
    row.ms = Date.now() - started;
    results.push(row);
  };

  try {
    await runOne('product-cart', async () => {
      await gotoPath(page, baseUrl, '/');
      await emptyCartStoreApi(page, baseUrl);
      const scope = await openProductForm(page, baseUrl, productPath, productId);
      await assertAmountFieldAndSymbol(scope, store);
      await fillDonationForm(scope, store);
      await goCheckoutFromForm(page, scope, 'product-cart');
      await cartHasAmount(page, baseUrl, amount, store);
      await shot(page, shotDir, 'product-cart');
    });

    await runOne('amount-ambiguous', async () => {
      // Yeni motor: "10,5" / "10.5" ondalık olarak okunur (ondalıksız para birimlerinde tam sayı); sepete doğru tutar girer.
      await gotoPath(page, baseUrl, '/');
      await emptyCartStoreApi(page, baseUrl);
      const scope = await openProductForm(page, baseUrl, productPath, productId);
      const code = String(store.currency || '').toUpperCase();
      const fillAmount = Number(store.decimals) > 0 ? 10.5 : 10;
      await fillDonationForm(scope, store, { amount: fillAmount });
      await goCheckoutFromForm(page, scope, 'amount-ambiguous');
      await cartHasAmount(page, baseUrl, fillAmount, store);
      await shot(page, shotDir, `amount-ambiguous-${code.toLowerCase()}`);
    });

    await runOne('amount-tr-comma', async () => {
      // Virgüllü yazım: "50,00" tam tutar; "10,50" kuruşlu -> ondalıksız mağazada reddedilir (REST 400 + tutar hatası), ondalıklıda 10.5 olarak sepete girer.
      if (String(store.currency || '').toUpperCase() !== 'TRY') {
        return;
      }
      await gotoPath(page, baseUrl, '/');
      await emptyCartStoreApi(page, baseUrl);
      const okScope = await openProductForm(page, baseUrl, productPath, productId);
      await fillDonationForm(okScope, store, { amount: '50,00' });
      await goCheckoutFromForm(page, okScope, 'amount-tr-comma');
      await cartHasAmount(page, baseUrl, 50, store);
      await shot(page, shotDir, 'amount-tr-comma-ok');

      await emptyCartStoreApi(page, baseUrl);
      const scope = await openProductForm(page, baseUrl, productPath, productId);
      await fillDonationForm(scope, store, { amount: '10,50' });
      if (Number(store.decimals) > 0) {
        await goCheckoutFromForm(page, scope, 'amount-tr-comma');
        await cartHasAmount(page, baseUrl, 10.5, store);
        return;
      }
      const probeNet = attachSubmitNetworkProbe(page);
      try {
        const [res] = await Promise.all([
          page.waitForResponse((r) => isDonationAddToCartRequest(r.request()), { timeout: CART_MS }),
          scope.locator(DP_SEL.submit).first().click({ timeout: CHECK_MS, noWaitAfter: true }),
        ]);
        if (res.status() !== 400) throw new Error(`TRY 10,50 reddedilmeliydi, status=${res.status()}`);
        const err = scope.locator(DP_SEL.error('amount')).filter({ visible: true }).first();
        await err.waitFor({ state: 'visible', timeout: CHECK_MS });
        if (!String((await err.textContent()) || '').trim()) throw new Error('tutar hata metni boş');
        if (probeNet.nativeDoc.length) throw new Error(`yerel form gönderimi ${probeNet.nativeDoc.join(', ')}`);
      } finally {
        probeNet.detach();
      }
      await shot(page, shotDir, 'amount-tr-comma-warn');
    });

    await runOne('list-checkout', async () => {
      await emptyCartStoreApi(page, baseUrl);
      const shell = await openListPopup(page, baseUrl, listPath, productId);
      await assertAmountFieldAndSymbol(shell, store);
      await assertCloseNotOverlappingForm(page);
      await fillDonationForm(shell, store);
      await goCheckoutFromForm(page, shell, 'list-checkout');
      // Blok ödeme özeti mobilde katlı ve satırları yalnız açılınca çizer: ad denetimi yalnız klasik ödemede.
      const blocksCheckout = checkoutKind === 'blocks' || probe.checkoutBlocks;
      await checkoutHasProductAmount(page, amount, store, blocksCheckout ? '' : productName);
      await shot(page, shotDir, 'list-checkout');
    });

    await runOne('place-order', async () => {
      await emptyCartStoreApi(page, baseUrl);
      const scope = await openProductForm(page, baseUrl, productPath, productId);
      await fillDonationForm(scope, store);
      await goCheckoutFromForm(page, scope, 'place-order');
      const kind = checkoutKind === 'blocks' || probe.checkoutBlocks ? 'blocks' : 'classic';
      await completeLocalCheckout(page, {
        store,
        checkoutKind: kind,
        gatewayId: 'cheque',
        wpDir,
        expected: {
          donorName: DONOR_NAME,
          donorEmail: DONOR_EMAIL,
          donorPhone: DONOR_PHONE,
          dedication: DEDICATION,
          amount,
          currency: store.currency,
          anonymous: true,
          hpos: !!probe.hpos,
          productName,
        },
      });
      await shot(page, shotDir, 'place-order');
    });

    await runOne('native-cart-hidden', async () => {
      let failure = null;
      try {
        for (const display of DISPLAY_MODES) {
          const set = matrixEval(wpDir, ['placement-display', display]);
          if (!set.ok) throw new Error(`görünüm yazılamadı ${display}: ${set.error || ''}`);
          await gotoPath(page, baseUrl, productPath);
          const nativeCart = await page.evaluate(nativeCartProbeBrowser, {
            excludeSel: LOOP_EXCLUDE_SEL,
            formSel: NATIVE_CART_FORM_SEL,
            btnSel: NATIVE_ATC_BTN_SEL,
            stickySel: STICKY_ATC_SEL,
          });
          const nativeClassified = classifyNativeCartVisibility(nativeCart);
          if (!nativeClassified.ok) {
            throw new Error(`${display}: ${nativeClassified.reason}`);
          }
          const ui = await entryCounts(page);
          const classified = classifyVisiblePluginEntry(ui);
          if (!classified.ok) {
            throw new Error(
              `${display}: eklenti girişi ${classified.reason} inline=${ui.inlineVisible} panel=${ui.panelVisible} popup=${ui.popupVisible}`
            );
          }
          const root = productRoot(page, productId);
          if (classified.kind === 'form') {
            await waitFormReady(root);
          } else {
            await openRoot(page, root);
            await root.locator(DP_SEL.close).first().click({ timeout: CHECK_MS });
            await root.locator(`${DP_SEL.overlay}.is-open`).first().waitFor({ state: 'hidden', timeout: CHECK_MS });
          }
          await shot(page, shotDir, `native-cart-hidden-${display}`);
        }
      } catch (error) {
        failure = error;
      }
      const restore = matrixEval(wpDir, ['placement-display', 'inline']);
      if (!restore.ok) throw new Error(`görünüm geri alınamadı: ${restore.error || ''}`);
      if (failure) throw failure;
    });

    await runOne('related-cards', async () => {
      await gotoPath(page, baseUrl, productPath);
      await page.evaluate((rootSel) => {
        const root = document.querySelector(rootSel);
        if (root && typeof root.scrollIntoView === 'function') {
          root.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
      }, RELATED_ROOT_SEL);
      await page.waitForFunction(
        ({ rootSel, cardSel }) => {
          const root = document.querySelector(rootSel);
          if (!root) return false;
          const stRoot = getComputedStyle(root);
          if (stRoot.display === 'none' || stRoot.visibility === 'hidden') return false;
          return Array.from(root.querySelectorAll(cardSel)).some((el) => {
            const st = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return (
              st.display !== 'none' &&
              st.visibility !== 'hidden' &&
              Number.parseFloat(st.opacity || '1') > 0.05 &&
              r.width > 4 &&
              r.height > 4
            );
          });
        },
        { rootSel: RELATED_ROOT_SEL, cardSel: RELATED_CARD_SEL },
        { timeout: CHECK_MS }
      );
      const info = await page.evaluate(({ rootSel, cardSel, titleSel }) => {
        const vis = (el) => {
          if (!el) return false;
          const st = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return (
            st.display !== 'none' &&
            st.visibility !== 'hidden' &&
            Number.parseFloat(st.opacity || '1') > 0.05 &&
            r.width > 4 &&
            r.height > 4
          );
        };
        const root = document.querySelector(rootSel);
        const cards = root ? Array.from(root.querySelectorAll(cardSel)) : [];
        const donateRe = /bağış\s*yap|donate/i;
        const rows = cards.map((card, i) => {
          const title = card.querySelector(titleSel);
          const btn = Array.from(card.querySelectorAll('a, button')).find((el) =>
            donateRe.test((el.textContent || '').trim())
          );
          return {
            i,
            titleText: (title && (title.textContent || '').trim().slice(0, 80)) || '',
            titleVisible: vis(title),
            btnText: (btn && (btn.textContent || '').trim().slice(0, 40)) || '',
            btnVisible: vis(btn),
            cardVisible: vis(card),
          };
        });
        return { headingVisible: vis(root), cardCount: cards.length, rows };
      }, { rootSel: RELATED_ROOT_SEL, cardSel: RELATED_CARD_SEL, titleSel: RELATED_TITLE_SEL });
      const classified = classifyLoopCardsResult(info.rows, { requireVisible: true });
      if (classified.status !== 'ok') {
        throw new Error(
          `ilgili ürünler görünür olmalı reason=${classified.reason} headingVis=${info.headingVisible} n=${info.cardCount} ${classified.bad.map(formatLoopCardFail).join(' | ')}`
        );
      }
      await shot(page, shotDir, 'related-cards');
    });

    await runOne('product-entry-button', async () => {
      const set = matrixEval(wpDir, ['product-content', 'custom', 'button_panel']);
      if (!set.ok) throw new Error(`kısa kod yazılamadı: ${set.error || ''}`);
      let failure = null;
      try {
        await gotoPath(page, baseUrl, productPath);
        const ui = await entryCounts(page);
        const classified = classifyVisiblePluginEntry(ui);
        if (!classified.ok || classified.kind !== 'panel') {
          throw new Error(
            `kısa kod düğme beklenirdi ok=${classified.ok} kind=${classified.kind} ${classified.reason} inline=${ui.inlineVisible} panel=${ui.panelVisible} popup=${ui.popupVisible}`
          );
        }
        const warn = displayMismatchWarning('inline', classified.kind);
        if (!/ayar inline, sayfa düğme/.test(warn)) {
          throw new Error(`mismatch uyarısı yok: '${warn}'`);
        }
        const root = productRoot(page, productId);
        const kind = await openRoot(page, root);
        if (kind !== 'side_panel') {
          throw new Error(`kabuk panel değil (${kind})`);
        }
        await shot(page, shotDir, 'product-entry-button');
      } catch (error) {
        failure = error;
      }
      const clr = matrixEval(wpDir, ['product-content', 'custom', 'clear']);
      if (!clr.ok) throw new Error(`kısa kod geri alınamadı: ${clr.error || ''}`);
      if (failure) throw failure;
    });

    await runOne('appearance', async () => {
      const scope = await openProductForm(page, baseUrl, productPath, productId);
      await assertAmountFieldAndSymbol(scope, store);
      await assertCloseNotOverlappingForm(page);
      await assertNoOverflow(page);
      await assertTouchAndButtons(page);
      await shot(page, shotDir, 'appearance-form');
      await gotoPath(page, baseUrl, '/');
      const withPlugin = await snapshotChromeStyles(page);
      try {
        matrixEval(wpDir, ['plugin', 'off']);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: CHECK_MS });
        const without = await snapshotChromeStyles(page);
        if (!stylesEqual(withPlugin, without)) {
          throw new Error(
            `eklenti açık/kapalı tema stili farkı: ${JSON.stringify({ withPlugin, without }).slice(0, 400)}`
          );
        }
      } finally {
        matrixEval(wpDir, ['plugin', 'on']);
      }
      await shot(page, shotDir, 'appearance-home');
    });

    await runOne('validation-errors', async () => {
      const types = ['fixed', 'custom', 'shares', 'campaign'];
      const modes = [
        { id: 'inline', display: 'inline' },
        { id: 'panel', display: 'button_panel' },
        { id: 'popup', display: 'button_popup' },
      ];
      const missing = types.filter((t) => !probe.products?.[t]?.path);
      if (missing.length) {
        throw new Error(`matris ürün eksik: ${missing.join(',')}`);
      }
      let failure = null;
      try {
        for (const mode of modes) {
          const set = matrixEval(wpDir, ['placement-display', mode.display]);
          if (!set.ok) throw new Error(`görünüm ${mode.display}: ${set.error || ''}`);
          for (const type of types) {
            const prod = probe.products[type];
            await gotoPath(page, baseUrl, prod.path);
            const root = productRoot(page, Number(prod.id || 0));
            await openRoot(page, root);
            await checkValidationErrors(page, root, store, `${type}/${mode.id}`);
            await shot(page, shotDir, `errors-${type}-${mode.id}`);
          }
        }
      } catch (error) {
        failure = error;
      }
      const restore = matrixEval(wpDir, ['placement-display', 'inline']);
      if (!restore.ok) throw new Error(`görünüm geri alınamadı: ${restore.error || ''}`);
      if (failure) throw failure;
    });

    await runOne('console', async () => {
      const fatal = pluginConsoleErrors(errors);
      if (fatal.length) {
        throw new Error(`eklenti konsol hatası: ${fatal.slice(0, 4).join(' | ')}`);
      }
    });
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  return results;
}

export { DONOR_NAME, DONOR_EMAIL, DEDICATION, pluginConsoleErrors, amountVisible, locFromError };
