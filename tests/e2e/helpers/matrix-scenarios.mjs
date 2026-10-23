/**
 * Yerel matris senaryoları. waitForTimeout yok; boş .catch yutma yok.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SEL } from './selectors.mjs';
import { formatMoney, formatMinPlaceholder } from './currency.mjs';
import { withCacheBust } from './env.mjs';
import {
  attachConsoleErrorCollector,
  clickAddToCartAndWait,
  openShellLocator,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
  assertNoUnexpectedPluginErrors,
} from './checks.mjs';
import { applyNetworkGuard } from './network-guard.mjs';
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
import { FREEZE_MOTION_CSS } from './selectors.mjs';

const CHECK_MS = 25000;
const CART_MS = 20000;
const DONOR_NAME = 'Çağrı Şükür İğde Öznur';
const DONOR_PHONE = '5551234567';
const DONOR_EMAIL = 'cagri.sukr@wdp-e2e.test';
const DEDICATION = 'Çağrı Şükür İğde Öznur';
const PLUGIN_URL_RE = /\/wp-content\/plugins\/woo-donation-popup\//i;
const MIN_TOUCH = 24;

function extraQuery() {
  return { hdf_no_side_cart: '1' };
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
  const result = await page.evaluate(async (base) => {
    const root = String(base).replace(/\/$/, '');
    const get = await fetch(`${root}/wp-json/wc/store/v1/cart`, { credentials: 'same-origin' });
    const nonce = get.headers.get('Nonce') || get.headers.get('X-WC-Store-API-Nonce') || '';
    const headers = {};
    if (nonce) headers.Nonce = nonce;
    const res = await fetch(`${root}/wp-json/wc/store/v1/cart/items`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers,
    });
    return { ok: !!res && (res.ok || res.status === 409), status: res ? res.status : 0 };
  }, baseUrl);
  if (!result.ok) {
    throw new Error(`Store API sepet silinemedi status=${result.status}`);
  }
}

async function waitFormReady(root) {
  const form = root.locator(SEL.donationForm).first();
  await form.waitFor({ state: 'visible', timeout: CHECK_MS });
  return form;
}

/**
 * Popup/panel açıldıktan sonra animasyon bitsin + POPUP-OVERLAP.
 * @param {import('@playwright/test').Page} page
 */
async function settleOpenShell(page) {
  await waitAndAssertShellOverlap(page, CHECK_MS);
}

/**
 * Doğrulama hatalarını tetikle: görünür canlı formdaki ödeme düğmesi.
 * Gönderim bağlanmamışsa validateForm yedeği (hata UI'sini ölçer).
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} scope
 * @param {string} type
 * @param {string} modeId
 */
async function triggerEmptyFormValidation(page, scope, type, modeId) {
  const formLoc = scope.locator(SEL.donationForm).first();
  await formLoc.waitFor({ state: 'visible', timeout: CHECK_MS });
  if (type === 'shares') {
    await scope.locator('.wdp-shareholder-form').first().waitFor({ state: 'attached', timeout: CHECK_MS });
  }
  await page.waitForFunction(
    (formSel) => {
      const forms = Array.from(document.querySelectorAll(formSel));
      const live = forms.find((f) => {
        const modal = f.closest && f.closest('.wdp-modal');
        if (modal && !modal.classList.contains('show')) return false;
        const shell = f.closest('.wdp-modal, .wdp-donation-form, .hdf-donation-modal-wrapper');
        if (shell && (shell.classList.contains('wdp-is-skeleton') || shell.getAttribute('aria-busy') === 'true')) {
          return false;
        }
        return true;
      });
      return !!(
        live &&
        window.WDPApp &&
        window.WDPApp.formValidate &&
        typeof window.WDPApp.formValidate.validateForm === 'function'
      );
    },
    SEL.donationForm,
    { timeout: CHECK_MS }
  );
  await page.evaluate(() => {
    const app = window.WDPApp;
    if (app && app.form) app.form.lastValidation = null;
    if (app && app.formValidate) app.formValidate.lastValidation = null;
  });
  const go = formLoc.locator(SEL.goCheckout).first();
  await go.waitFor({ state: 'visible', timeout: CHECK_MS });
  await go.evaluate((btn) => {
    const form = btn.form || (btn.closest && btn.closest('form'));
    const app = window.WDPApp || {};
    if (form && app.form && typeof app.form.setup === 'function' && !form._wdpSubmitHandler) {
      app.form.setup(form);
    }
    if (form && typeof form.requestSubmit === 'function') {
      try {
        form.requestSubmit(btn);
        return;
      } catch (eRs) {
        /* WebKit disabled/not-a-submitter */
      }
    }
    if (typeof btn.click === 'function') {
      btn.click();
    }
  });
  const lastFailed = async () =>
    page.evaluate(() => {
      const app = window.WDPApp || {};
      const last =
        (app.form && app.form.lastValidation) ||
        (app.formValidate && app.formValidate.lastValidation) ||
        null;
      return !!(last && last.ok === false && Array.isArray(last.failures) && last.failures.length);
    });
  try {
    await page.waitForFunction(() => {
      const app = window.WDPApp || {};
      const last =
        (app.form && app.form.lastValidation) ||
        (app.formValidate && app.formValidate.lastValidation) ||
        null;
      return !!(last && last.ok === false && Array.isArray(last.failures) && last.failures.length);
    }, { timeout: 4000 });
  } catch (eFirst) {
    if (!(await lastFailed())) {
      await formLoc.evaluate((form) => {
        const app = window.WDPApp || {};
        const validate =
          (app.formValidate && app.formValidate.validateForm) ||
          (app.form && app.form.validateForm) ||
          null;
        if (typeof validate === 'function') {
          validate(form);
        }
      });
    }
  }
  try {
    await page.waitForFunction(() => {
      const app = window.WDPApp || {};
      const last =
        (app.form && app.form.lastValidation) ||
        (app.formValidate && app.formValidate.lastValidation) ||
        null;
      return !!(last && last.ok === false && Array.isArray(last.failures) && last.failures.length);
    }, { timeout: CHECK_MS });
  } catch (eWait) {
    const diag = await page.evaluate((formSel) => {
      const app = window.WDPApp || {};
      const last =
        (app.form && app.form.lastValidation) ||
        (app.formValidate && app.formValidate.lastValidation) ||
        null;
      const forms = Array.from(document.querySelectorAll(formSel));
      const live = forms.find((f) => {
        const modal = f.closest && f.closest('.wdp-modal');
        return !(modal && !modal.classList.contains('show'));
      });
      const btn = live && live.querySelector('button[name="donation_go_checkout"]');
      return {
        href: String(location.href || '').replace(/https?:\/\/[^/]+/i, ''),
        lastOk: last && last.ok,
        failN: last && last.failures ? last.failures.length : 0,
        rows: document.querySelectorAll('.wdp-shareholder-form').length,
        btns: document.querySelectorAll('button[name="donation_go_checkout"]').length,
        hasHandler: !!(live && live._wdpSubmitHandler),
        btnDisabled: !!(btn && btn.disabled),
        btnType: btn ? String(btn.getAttribute('type') || btn.type || '') : '',
        wizard: !!(live && live.classList.contains('wdp-wizard-ready')),
      };
    }, SEL.donationForm);
    throw new Error(
      `${type}/${modeId}: lastValidation.ok===false yok path=${diag.href} lastOk=${diag.lastOk} failN=${diag.failN} rows=${diag.rows} btns=${diag.btns} handler=${diag.hasHandler} disabled=${diag.btnDisabled} type=${diag.btnType} wizard=${diag.wizard}`
    );
  }
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
      })
  );
}

/**
 * Yer tutucu = wc biçimi (ondalık kırpılmaz); sembol konumu left/right.
 * @param {import('@playwright/test').Locator} scope
 * @param {object} store
 */
async function assertMinPlaceholderAndSymbol(scope, store) {
  const input = scope.locator(SEL.customPrice).first();
  if ((await input.count()) === 0) return;
  await input.waitFor({ state: 'visible', timeout: CHECK_MS });
  const minRaw = await input.getAttribute('min');
  const min = Number.parseFloat(String(minRaw || '10'));
  const amount = Number.isFinite(min) && min > 0 ? min : 10;
  const expected = formatMinPlaceholder(amount, store);
  const ph = String((await input.getAttribute('placeholder')) || '').trim();
  if (ph !== expected) {
    throw new Error(`yer tutucu '${ph}' ≠ '${expected}' (${store.symbolPosition || 'left'})`);
  }
  const posOk = await scope.evaluate((root, want) => {
    const shell = root.querySelector('.wdp-custom-price-shell') || document.querySelector('.wdp-custom-price-shell');
    if (!shell) return true;
    const sym = shell.querySelector('.wdp-custom-price-currency');
    const inp = shell.querySelector('input[name="custom_price"]');
    if (!sym || !inp) return true;
    const sr = sym.getBoundingClientRect();
    const ir = inp.getBoundingClientRect();
    const leftish = want === 'left' || want === 'left_space';
    return leftish ? sr.left <= ir.left + 1 : sr.left >= ir.left - 1;
  }, String(store.symbolPosition || 'left'));
  if (!posOk) {
    throw new Error(`sembol konumu görsel olarak hatalı (${store.symbolPosition})`);
  }
}

/**
 * Kapat düğmesi form kutusuyla kesişmez, ≥44px.
 * @param {import('@playwright/test').Page} page
 */
async function assertCloseNotOverlappingForm(page) {
  const info = await page.evaluate(() => {
    const root = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show');
    if (!root) return { skip: true };
    const close = root.querySelector('button.wdp-modal-close');
    const form =
      root.querySelector('.wdp-donation-form-fields') ||
      root.querySelector('form.wdp-donation-form-fields');
    if (!close) return { error: 'kapat düğmesi yok' };
    if (!form) return { error: 'form kutusu yok' };
    const c = close.getBoundingClientRect();
    const f = form.getBoundingClientRect();
    const overlap = !(c.right <= f.left || c.left >= f.right || c.bottom <= f.top || c.top >= f.bottom);
    return { overlap, cw: c.width, ch: c.height, cy: c.y, fy: f.y };
  });
  if (info.skip) return;
  if (info.error) throw new Error(info.error);
  if (info.cw + 1 < 44 || info.ch + 1 < 44) {
    throw new Error(`kapat dokunma hedefi < 44px (${Math.round(info.cw)}x${Math.round(info.ch)})`);
  }
  if (info.overlap) {
    throw new Error(
      `kapat düğmesi form kutusuyla kesişiyor (close.y=${Number(info.cy).toFixed(1)} form.y=${Number(info.fy).toFixed(1)})`
    );
  }
}

/**
 * @param {import('@playwright/test').Locator} scope
 * @param {object} store
 */
async function fillDonationForm(scope, store) {
  const amount = store.amount;
  const price = scope.locator(SEL.customPrice).first();
  if ((await price.count()) > 0) {
    await price.waitFor({ state: 'visible', timeout: CHECK_MS });
    await price.fill(String(amount));
  } else {
    const preset = scope.locator('.wdp-amount-preset, [data-wdp-amount]').first();
    if ((await preset.count()) > 0) await preset.click({ timeout: CHECK_MS });
  }
  const name = scope.locator(SEL.donorName).first();
  await name.waitFor({ state: 'visible', timeout: CHECK_MS });
  await name.fill(DONOR_NAME);
  const phone = scope.locator(SEL.donorPhone).first();
  if ((await phone.count()) > 0) await phone.fill(DONOR_PHONE);
  const email = scope.locator(SEL.donorEmail).first();
  if ((await email.count()) > 0) await email.fill(DONOR_EMAIL);
  const ded = scope.locator('input[name="donation_dedication"]').first();
  if ((await ded.count()) > 0) await ded.fill(DEDICATION);
}

async function addToCart(page, scope) {
  const add = scope.locator(SEL.addToCart).first();
  await add.waitFor({ state: 'visible', timeout: CHECK_MS });
  const ajax = await clickAddToCartAndWait(
    page,
    async () => {
      await add.click({ timeout: CHECK_MS });
    },
    { timeout: CART_MS }
  );
  if (ajax.timedOut || !ajax.ok) {
    throw new Error(
      `sepete ekle AJAX başarısız status=${ajax.status} timedOut=${ajax.timedOut} ${ajax.bodyPreview}`
    );
  }
}

async function goCheckoutFromForm(page, scope) {
  const go = scope.locator(SEL.goCheckout).first();
  await go.waitFor({ state: 'visible', timeout: CHECK_MS });
  const ajax = await clickAddToCartAndWait(
    page,
    async () => {
      await go.click({ timeout: CHECK_MS, noWaitAfter: true });
    },
    { timeout: CART_MS }
  );
  if (ajax.timedOut && !/checkout|odeme|ödeme/i.test(page.url())) {
    throw new Error(`ödemeye git AJAX/yönlendirme yok: ${ajax.bodyPreview} url=${page.url()}`);
  }
  await page.waitForURL(
    (u) => /checkout|order-pay|odeme|ödeme/i.test(u.pathname + u.search),
    { timeout: CHECK_MS }
  );
}

async function openProductForm(page, baseUrl, productPath) {
  await gotoPath(page, baseUrl, productPath);
  const inline = page.locator(`${SEL.inlineDonationForm} ${SEL.donationForm}, ${SEL.donationForm}`).first();
  if ((await inline.count()) > 0 && (await inline.isVisible())) {
    await assertNoUnexpectedPluginErrors(page, { scenarioId: 'product-cart' });
    return page.locator('body');
  }
  const trigger = page.locator(`${SEL.donateTrigger}, ${SEL.sidePanelTrigger}`).first();
  await trigger.waitFor({ state: 'visible', timeout: CHECK_MS });
  await clickShellTrigger(trigger, CHECK_MS);
  const shell = openShellLocator(page, '');
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  await settleOpenShell(page);
  await waitFormReady(shell);
  await assertNoUnexpectedPluginErrors(page, { scenarioId: 'product-cart' });
  return shell;
}

async function openListPopup(page, baseUrl, listPath, productId) {
  await gotoPath(page, baseUrl, listPath);
  await page.locator('.wdp-list-wrap, .wdp-list').first().waitFor({ state: 'visible', timeout: CHECK_MS });
  await revealListProductTrigger(page, productId);
  const trigger = shellTriggerLocator(page, 'popup', { productId });
  await clickShellTrigger(trigger, CHECK_MS);
  const shell = openShellLocator(page, 'popup');
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  await settleOpenShell(page);
  await waitFormReady(shell);
  await assertNoUnexpectedPluginErrors(page, { scenarioId: 'list-checkout' });
  return shell;
}

async function cartHasAmount(page, baseUrl, amount, store) {
  await gotoPath(page, baseUrl, '/cart/');
  await page
    .locator(
      '.woocommerce-cart-form, .wc-block-cart, .wp-block-woocommerce-cart, .cart_item, .wc-block-cart-items'
    )
    .first()
    .waitFor({ state: 'visible', timeout: CHECK_MS });
  const body = await page.locator('body').innerText();
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
  const body = await page.locator('body').innerText();
  if (productName && !body.includes(productName) && !/WDP E2E Custom/i.test(body)) {
    throw new Error(`ödeme sayfasında ürün adı yok: ${normalizePriceText(body).slice(0, 240)}`);
  }
  if (!amountVisible(body, amount, store)) {
    throw new Error(`ödeme tutar biçimi yok (beklenen ${formatMoney(amount, store)})`);
  }
}

async function fillStateField(page, selector, store) {
  let el = page.locator(selector).first();
  if ((await el.count()) === 0) {
    el = page.getByLabel(/province|state|il \/ ilçe|bundesland/i).first();
  }
  if ((await el.count()) === 0) return;
  if (!(await el.isVisible())) return;
  const tag = await el.evaluate((node) => node.tagName.toLowerCase());
  if (tag === 'select') {
    if (store.state) {
      try {
        await el.selectOption(store.state);
        return;
      } catch {
        await el.selectOption({ label: store.stateLabel || store.city || store.state });
        return;
      }
    }
    const value = await el.evaluate((s) => {
      const opt = [...s.options].find((o) => o.value);
      return opt ? opt.value : '';
    });
    if (value) await el.selectOption(value);
    return;
  }
  await el.click();
  const name = store.stateLabel || store.city || store.state;
  if (name) {
    const option = page.getByRole('option', { name: new RegExp(name, 'i') }).first();
    if ((await option.count()) > 0) {
      await option.click();
      return;
    }
  }
  const firstOpt = page.locator('[role="option"]').nth(1);
  if ((await firstOpt.count()) > 0) await firstOpt.click();
}

async function fillClassicCheckout(page, store) {
  const first = page.locator('#billing_first_name').first();
  await first.waitFor({ state: 'visible', timeout: CHECK_MS });
  const parts = DONOR_NAME.split(' ');
  await first.fill(parts[0] || 'Cagri');
  const last = page.locator('#billing_last_name').first();
  if ((await last.count()) > 0) await last.fill(parts.slice(1).join(' ') || 'Test');
  const email = page.locator('#billing_email').first();
  if ((await email.count()) > 0) await email.fill(DONOR_EMAIL);
  const phone = page.locator('#billing_phone').first();
  if ((await phone.count()) > 0) await phone.fill(DONOR_PHONE);
  const addr = page.locator('#billing_address_1').first();
  if ((await addr.count()) > 0) await addr.fill(store.address || 'Test Cad. 1');
  const city = page.locator('#billing_city').first();
  if ((await city.count()) > 0) await city.fill(store.city || 'Istanbul');
  const post = page.locator('#billing_postcode').first();
  if ((await post.count()) > 0) await post.fill(store.postcode || '34000');
  const country = page.locator('#billing_country').first();
  if ((await country.count()) > 0 && store.country) {
    await country.selectOption(store.country);
  }
  await fillStateField(page, '#billing_state', store);
}

async function fillBlocksCheckout(page, store) {
  const email = page.locator('#email, input[type="email"]').first();
  await email.waitFor({ state: 'visible', timeout: CHECK_MS });
  await email.fill(DONOR_EMAIL);
  const parts = DONOR_NAME.split(' ');
  const first = page.locator('#billing-first_name, #shipping-first_name').first();
  if ((await first.count()) > 0) await first.fill(parts[0] || 'Cagri');
  const last = page.locator('#billing-last_name, #shipping-last_name').first();
  if ((await last.count()) > 0) await last.fill(parts.slice(1).join(' ') || 'Test');
  const addr = page.locator('#billing-address_1, #shipping-address_1').first();
  if ((await addr.count()) > 0) await addr.fill(store.address || 'Test Cad. 1');
  const city = page.locator('#billing-city, #shipping-city').first();
  if ((await city.count()) > 0) await city.fill(store.city || 'Istanbul');
  const post = page.locator('#billing-postcode, #shipping-postcode').first();
  if ((await post.count()) > 0) await post.fill(store.postcode || '34000');
  const phone = page.locator('#billing-phone, #shipping-phone').first();
  if ((await phone.count()) > 0) await phone.fill(DONOR_PHONE);
  await fillStateField(page, '#billing-state, #shipping-state, .wc-block-components-state-input input', store);
  const place = page.locator('.wc-block-components-checkout-place-order-button').first();
  if ((await place.count()) === 0 || !(await place.isVisible())) {
    const cont = page.getByRole('button', { name: /continue|devam|sipariş ver|place order/i }).first();
    if ((await cont.count()) > 0) await cont.click({ timeout: 8000 });
  }
}

async function selectCheque(page) {
  const radio = page.locator('#payment_method_cheque, input[name="radio-control-wc-payment-method-options"][value="cheque"], #radio-control-wc-payment-method-options-cheque').first();
  if ((await radio.count()) > 0) {
    await radio.check({ force: true });
    return;
  }
  const label = page.getByText(/cheque|check payments|çek/i).first();
  if ((await label.count()) > 0) {
    await label.click({ timeout: 8000 });
    return;
  }
  throw new Error('cheque ödeme yöntemi formda yok');
}

async function placeOrder(page) {
  const btn = page
    .locator(
      '#place_order, button[name="woocommerce_checkout_place_order"], .wc-block-components-checkout-place-order-button, button.wc-block-components-checkout-place-order-button'
    )
    .first();
  await btn.waitFor({ state: 'visible', timeout: CHECK_MS });
  await btn.click({ timeout: CHECK_MS, noWaitAfter: true });
  try {
    await page.waitForURL(/order-received|order-pay|key=wc_order/i, {
      timeout: CHECK_MS,
      waitUntil: 'domcontentloaded',
    });
  } catch (e) {
    const body = normalizePriceText(await page.locator('body').innerText());
    const err = page.locator('.wc-block-components-validation-error, .woocommerce-error, [role="alert"]').first();
    const errText = (await err.count()) > 0 ? await err.innerText() : '';
    throw new Error(`sipariş tamamlanmadı url=${page.url()} validasyon=${errText || body.slice(0, 240)} (${e.message})`);
  }
  const thanks = page.url();
  const idMatch = thanks.match(/order-received\/(\d+)/i) || thanks.match(/[?&]order[=-](\d+)/i);
  const orderId = idMatch ? Number(idMatch[1]) : 0;
  if (!orderId) throw new Error(`sipariş id yok: ${thanks}`);
  return orderId;
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
    const root =
      document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show, form.wdp-donation-form-fields') ||
      document.body;
    const nodes = Array.from(
      root.querySelectorAll(
        'button, a[href], [role="button"], .wdp-amount-preset, input[type="checkbox"]'
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
    const form = document.querySelector('form.wdp-donation-form-fields, .wdp-modal-content');
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
    try {
      await fn();
      row.ok = true;
    } catch (e) {
      row.error = String(e && e.message ? e.message : e).slice(0, 400);
      row.loc = locFromError(e);
      try {
        row.shot = await shot(page, shotDir, `fail-${id}`);
      } catch (shotErr) {
        row.shot = `screenshot-fail: ${String(shotErr && shotErr.message ? shotErr.message : shotErr).slice(0, 80)}`;
      }
    }
    row.ms = Date.now() - started;
    results.push(row);
  };

  try {
    await runOne('product-cart', async () => {
      await gotoPath(page, baseUrl, '/');
      await emptyCartStoreApi(page, baseUrl);
      const scope = await openProductForm(page, baseUrl, productPath);
      await assertMinPlaceholderAndSymbol(scope, store);
      await fillDonationForm(scope, store);
      await addToCart(page, scope);
      await cartHasAmount(page, baseUrl, amount, store);
      await shot(page, shotDir, 'product-cart');
    });

    await runOne('list-checkout', async () => {
      await emptyCartStoreApi(page, baseUrl);
      const shell = await openListPopup(page, baseUrl, listPath, productId);
      await assertMinPlaceholderAndSymbol(shell, store);
      await assertCloseNotOverlappingForm(page);
      await fillDonationForm(shell, store);
      await goCheckoutFromForm(page, shell);
      await checkoutHasProductAmount(page, amount, store, productName);
      await shot(page, shotDir, 'list-checkout');
    });

    await runOne('place-order', async () => {
      await emptyCartStoreApi(page, baseUrl);
      const scope = await openProductForm(page, baseUrl, productPath);
      await fillDonationForm(scope, store);
      await goCheckoutFromForm(page, scope);
      if (checkoutKind === 'blocks' || probe.checkoutBlocks) {
        await fillBlocksCheckout(page, store);
      } else {
        await fillClassicCheckout(page, store);
      }
      await selectCheque(page);
      const orderId = await placeOrder(page);
      const rec = matrixEval(wpDir, ['read-order', String(orderId)]);
      if (!rec.ok) throw new Error(`wc_get_order okunamadı: ${rec.error || ''}`);
      const item = (rec.items || [])[0] || { meta: {} };
      const meta = item.meta || {};
      const hay = [meta.wdp_donor_name, rec.billingName, JSON.stringify(rec)].join(' ');
      if (!hay.includes('Çağrı') && !hay.includes('Şükür') && !String(meta.wdp_donor_name).includes('Çağrı')) {
        throw new Error(`bağışçı adı eksik/bozuk: ${JSON.stringify(meta).slice(0, 240)}`);
      }
      if (String(meta.wdp_donor_name || rec.billingName).indexOf('Çağrı') < 0) {
        throw new Error(`Türkçe karakter kaybı (ad): ${meta.wdp_donor_name || rec.billingName}`);
      }
      if (meta.wdp_donor_email && meta.wdp_donor_email !== DONOR_EMAIL && rec.billingEmail !== DONOR_EMAIL) {
        throw new Error(`e-posta uyuşmuyor: ${meta.wdp_donor_email || rec.billingEmail}`);
      }
      if (meta.wdp_dedication && meta.wdp_dedication.indexOf('Çağrı') < 0) {
        throw new Error(`ithaf eksik/bozuk: ${meta.wdp_dedication}`);
      }
      const total = Number(rec.total);
      if (!Number.isFinite(total) || Math.abs(total - Number(amount)) > 0.009) {
        throw new Error(`sipariş toplamı ${rec.total} ≠ ${amount} (hpos=${rec.hpos})`);
      }
      await shot(page, shotDir, 'place-order');
    });

    await runOne('native-cart-hidden', async () => {
      try {
        for (const display of DISPLAY_MODES) {
          const set = matrixEval(wpDir, ['placement-display', display]);
          if (!set.ok) throw new Error(`görünüm yazılamadı ${display}: ${set.error || ''}`);
          await gotoPath(page, baseUrl, productPath);
          const native = await page.evaluate(nativeCartProbeBrowser, {
            excludeSel: LOOP_EXCLUDE_SEL,
            formSel: NATIVE_CART_FORM_SEL,
            btnSel: NATIVE_ATC_BTN_SEL,
            stickySel: STICKY_ATC_SEL,
          });
          const nativeClassified = classifyNativeCartVisibility(native);
          if (!nativeClassified.ok) {
            throw new Error(`${display}: ${nativeClassified.reason}`);
          }
          const ui = await page.evaluate(
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
              inlineSel: SEL.inlineDonationForm,
              panelSel: SEL.sidePanelTrigger,
              popupSel: SEL.centeredPopupTrigger,
            }
          );
          const classified = classifyVisiblePluginEntry(ui);
          if (!classified.ok) {
            throw new Error(
              `${display}: eklenti girişi ${classified.reason} inline=${ui.inlineVisible} panel=${ui.panelVisible} popup=${ui.popupVisible}`
            );
          }
          if (classified.kind === 'form') {
            const form = page.locator(`${SEL.inlineDonationForm}, ${SEL.donationForm}`).first();
            await form.waitFor({ state: 'visible', timeout: CHECK_MS });
          } else {
            const triggerSel = classified.kind === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger;
            const n = await page.locator(triggerSel).count();
            let clicked = false;
            for (let i = 0; i < n; i += 1) {
              const btn = page.locator(triggerSel).nth(i);
              const inLoop = await btn.evaluate(
                (el, excludeSel) =>
                  !!(el.classList.contains('wdp-loop-donate') || (el.closest && el.closest(excludeSel))),
                LOOP_EXCLUDE_SEL
              );
              if (inLoop) continue;
              if (!(await btn.isVisible())) continue;
              await btn.scrollIntoViewIfNeeded();
              await clickShellTrigger(btn, CHECK_MS);
              clicked = true;
              break;
            }
            if (!clicked) throw new Error(`${display}: birincil bağış düğmesi tıklanamadı`);
            const shell = openShellLocator(page, classified.kind === 'panel' ? 'panel' : 'popup');
            await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
            await settleOpenShell(page);
            await waitFormReady(shell);
            const close = shell.locator(SEL.modalClose).first();
            if ((await close.count()) > 0) {
              await close.click({ timeout: CHECK_MS });
              await shell.waitFor({ state: 'hidden', timeout: CHECK_MS });
            }
          }
          await shot(page, shotDir, `native-cart-hidden-${display}`);
        }
      } finally {
        const restore = matrixEval(wpDir, ['placement-display', 'inline']);
        if (!restore.ok) throw new Error(`görünüm geri alınamadı: ${restore.error || ''}`);
      }
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
      try {
        await gotoPath(page, baseUrl, productPath);
        const ui = await page.evaluate(
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
            inlineSel: SEL.inlineDonationForm,
            panelSel: SEL.sidePanelTrigger,
            popupSel: SEL.centeredPopupTrigger,
          }
        );
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
        await page.waitForFunction(() => !!(window.WDPApp && window.WDPApp.modal), { timeout: CHECK_MS });
        const n = await page.locator(SEL.sidePanelTrigger).count();
        let clicked = false;
        for (let i = 0; i < n; i += 1) {
          const btn = page.locator(SEL.sidePanelTrigger).nth(i);
          const inLoop = await btn.evaluate(
            (el, excludeSel) =>
              !!(el.classList.contains('wdp-loop-donate') || (el.closest && el.closest(excludeSel))),
            LOOP_EXCLUDE_SEL
          );
          if (inLoop) continue;
          if (!(await btn.isVisible())) continue;
          await btn.scrollIntoViewIfNeeded();
          await clickShellTrigger(btn, CHECK_MS);
          clicked = true;
          break;
        }
        if (!clicked) throw new Error('birincil panel düğmesi tıklanamadı');
        const anyShell = openShellLocator(page, '');
        await anyShell.waitFor({ state: 'visible', timeout: CHECK_MS });
        const isPanel = await anyShell.evaluate((el) => el.classList.contains('wdp-side-panel'));
        if (!isPanel) {
          throw new Error('kabuk panel değil (popup açıldı)');
        }
        await settleOpenShell(page);
        await waitFormReady(anyShell);
        await shot(page, shotDir, 'product-entry-button');
      } finally {
        const clr = matrixEval(wpDir, ['product-content', 'custom', 'clear']);
        if (!clr.ok) throw new Error(`kısa kod geri alınamadı: ${clr.error || ''}`);
      }
    });

    await runOne('appearance', async () => {
      const scope = await openProductForm(page, baseUrl, productPath);
      await waitFormReady(scope);
      await assertMinPlaceholderAndSymbol(scope, store);
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
      try {
        for (const mode of modes) {
          const set = matrixEval(wpDir, ['placement-display', mode.display]);
          if (!set.ok) throw new Error(`görünüm ${mode.display}: ${set.error || ''}`);
          for (const type of types) {
            const product = probe.products[type];
            await gotoPath(page, baseUrl, product.path);
            let scope;
            if (mode.id === 'inline') {
              const wrap = page.locator(SEL.inlineDonationForm).first();
              await wrap.waitFor({ state: 'visible', timeout: CHECK_MS });
              await waitFormReady(wrap);
              scope = wrap;
            } else {
              const triggerSel = mode.id === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger;
              const n = await page.locator(triggerSel).count();
              let clicked = false;
              for (let i = 0; i < n; i += 1) {
                const btn = page.locator(triggerSel).nth(i);
                const inLoop = await btn.evaluate(
                  (el, excludeSel) =>
                    !!(el.classList.contains('wdp-loop-donate') || (el.closest && el.closest(excludeSel))),
                  LOOP_EXCLUDE_SEL
                );
                if (inLoop) continue;
                if (!(await btn.isVisible())) continue;
                await btn.scrollIntoViewIfNeeded();
                await clickShellTrigger(btn, CHECK_MS);
                clicked = true;
                break;
              }
              if (!clicked) throw new Error(`${type}/${mode.id}: tetikleyici yok`);
              scope = openShellLocator(page, mode.id);
              await scope.waitFor({ state: 'visible', timeout: CHECK_MS });
              await settleOpenShell(page);
              await waitFormReady(scope);
            }
            await triggerEmptyFormValidation(page, scope, type, mode.id);
            const state = await scope.evaluate((root) => {
              const app = window.WDPApp || {};
              const last =
                (app.form && app.form.lastValidation) ||
                (app.formValidate && app.formValidate.lastValidation) ||
                null;
              const failures = (last && last.failures) || [];
              const missingMsgs = [];
              const collapsedStill = [];
              for (const f of failures) {
                const field = f && f.field ? String(f.field) : '';
                if (!field) continue;
                const input = root.querySelector(`[name="${field}"]`);
                if (!input) {
                  missingMsgs.push(`${field}:yok`);
                  continue;
                }
                const row = input.closest && input.closest('.wdp-shareholder-form');
                if (row && row.classList.contains('collapsed')) {
                  collapsedStill.push(field);
                }
                let err = null;
                const did = input.getAttribute && input.getAttribute('aria-describedby');
                if (did) {
                  const ids = String(did)
                    .split(/\s+/)
                    .filter(Boolean);
                  for (const id of ids) {
                    try {
                      err = root.querySelector('#' + CSS.escape(id)) || document.getElementById(id);
                    } catch (eId) {
                      err = root.querySelector('#' + id) || document.getElementById(id);
                    }
                    if (err) break;
                  }
                }
                if (!err) {
                  const near =
                    input.closest &&
                    input.closest('.wdp-price-field, .wdp-field-stack__row, .wdp-form-group');
                  err = near && near.querySelector && near.querySelector('.wdp-input-error');
                }
                const st = err ? window.getComputedStyle(err) : null;
                const r = err ? err.getBoundingClientRect() : { width: 0, height: 0 };
                const shown =
                  err &&
                  st &&
                  st.display !== 'none' &&
                  st.visibility !== 'hidden' &&
                  Number.parseFloat(st.opacity || '1') > 0.05 &&
                  r.width > 0 &&
                  r.height > 0 &&
                  String(err.textContent || '').trim();
                if (!shown) missingMsgs.push(field);
              }
              let firstDomName = '';
              for (const el of root.querySelectorAll('.wdp-error')) {
                if (el.closest && el.closest('.wdp-shareholder-form.collapsed')) continue;
                if (el.closest && el.closest('[hidden]')) continue;
                const st = window.getComputedStyle(el);
                const box = el.getBoundingClientRect();
                if (st.display === 'none' || st.visibility === 'hidden' || box.width < 1 || box.height < 1) {
                  continue;
                }
                firstDomName = el.getAttribute && el.getAttribute('name') ? el.getAttribute('name') : '';
                if (firstDomName) break;
              }
              const active = document.activeElement;
              const focusName = active && active.getAttribute ? active.getAttribute('name') || '' : '';
              const focusOnFailure = (f) => {
                if (!f || !f.field) return false;
                if (f.field === focusName) return true;
                const input = root.querySelector(`[name="${f.field}"]`);
                if (!input) return false;
                if (active === input) return true;
                if (input.contains && input.contains(active)) return true;
                const wrap =
                  (input.closest && input.closest('.wdp-phone-field, .iti, .wdp-field-stack__row, .wdp-shareholder-form')) ||
                  null;
                return !!(wrap && wrap.contains && wrap.contains(active));
              };
              const header = root.querySelector('.wdp-shareholder-header');
              const title = header && header.querySelector('h3');
              const badge = header && header.querySelector('.wdp-unit-price-badge');
              const parseRgb = (s) => {
                const m = String(s || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
                return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
              };
              const lum = (rgb) => {
                const lin = rgb.map((c) => {
                  const v = c / 255;
                  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
                });
                return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
              };
              const ratio = (a, b) => {
                if (!a || !b) return 0;
                const hi = Math.max(lum(a), lum(b));
                const lo = Math.min(lum(a), lum(b));
                return (hi + 0.05) / (lo + 0.05);
              };
              let titleRatio = 0;
              let badgeRatio = 0;
              if (header && title) {
                const hs = getComputedStyle(header);
                const ts = getComputedStyle(title);
                titleRatio = ratio(parseRgb(hs.backgroundColor), parseRgb(ts.color));
                if (badge) {
                  const bs = getComputedStyle(badge);
                  const bg = parseRgb(bs.backgroundColor);
                  const headerBg = parseRgb(hs.backgroundColor);
                  badgeRatio = ratio(bg && bg[0] + bg[1] + bg[2] > 0 ? bg : headerBg, parseRgb(bs.color));
                }
              }
              return {
                missingMsgs,
                collapsedStill,
                focusName,
                firstDomName,
                titleRatio,
                badgeRatio,
                failCount: failures.length,
                focusOk: failures.some(focusOnFailure),
              };
            });
            if (state.missingMsgs.length) {
              throw new Error(
                `${type}/${mode.id}: görünür alan mesajı yok ${state.missingMsgs.join(',')}`
              );
            }
            if (state.collapsedStill.length) {
              throw new Error(
                `${type}/${mode.id}: katlanmış kaldı ${state.collapsedStill.join(',')}`
              );
            }
            if (!state.focusOk) {
              throw new Error(
                `${type}/${mode.id}: odak ${state.focusName || '(yok)'} hatalı alanda değil`
              );
            }
            if (type === 'shares') {
              if (state.titleRatio < 4.5) {
                throw new Error(
                  `${type}/${mode.id}: başlık kontrast ${state.titleRatio.toFixed(2)} < 4.5`
                );
              }
              if (state.badgeRatio < 4.5) {
                throw new Error(
                  `${type}/${mode.id}: rozet kontrast ${state.badgeRatio.toFixed(2)} < 4.5`
                );
              }
            }
            await shot(page, shotDir, `errors-${type}-${mode.id}`);
          }
        }
      } finally {
        const restore = matrixEval(wpDir, ['placement-display', 'inline']);
        if (!restore.ok) throw new Error(`görünüm geri alınamadı: ${restore.error || ''}`);
      }
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
