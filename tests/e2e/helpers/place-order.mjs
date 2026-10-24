/**
 * Yerel sipariş tamamlama (blok + klasik). Uzakta çağrılmaz.
 * Place order: rol / erişilebilir ad; #place_order varsayımı yok.
 */
import { parseLocalEvalJson, runLocalEvalFile } from './local-wp-eval.mjs';

export const CHECKOUT_MS = 25000;

/** Görev 3M: Türkçe karakter bütünlüğü. */
export const DONOR_NAME = 'Çağrı Şükrü Öztürk İğdır';
export const DONOR_PHONE = '5551234567';
export const DONOR_EMAIL = 'cagri.sukru@wdp-e2e.test';
export const DEDICATION = 'Çağrı Şükrü Öztürk İğdır';
export const SHAREHOLDER_NAME = 'Gülşen Çığ İğdır';
export const SHAREHOLDER_PHONE = '5559876543';

/** e2e:full hisseli sipariş (≥2 hisse, Türkçe karakter). */
export const SHAREHOLDERS = [
  { name: 'Ayşe Gül Çiftçi', phone: '5551234567' },
  { name: 'Ömer Şahin İnce', phone: '5559876543' },
];

export const PLACE_ORDER_NAME_RE =
  /place order|sipariş ver|siparişi onayla|siparişi tamamla|ödenecek tutarı öde/i;
export const CONTINUE_NAME_RE = /^(continue|devam et|devam|next|ileri)$/i;
export const OFFLINE_GATEWAY_NAME_RE =
  /cheque|check payments|çek|bacs|bank transfer|havale|eft|cash on delivery|kapıda ödeme|cod/i;

const PLACE_ORDER_CSS =
  '#place_order, button[name="woocommerce_checkout_place_order"], .wc-block-components-checkout-place-order-button, button.wc-block-components-checkout-place-order-button';

const OFFLINE_IDS = ['cheque', 'cod', 'bacs'];

/**
 * @param {string} [wpDir]
 */
export function localWpDir(wpDir = '') {
  return String(wpDir || process.env.WDP_LOCAL_WP_DIR || '').trim();
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<'blocks'|'classic'|'unknown'>}
 */
export async function detectCheckoutKind(page) {
  const blocks = page.locator(
    '.wc-block-checkout, .wp-block-woocommerce-checkout, .wc-block-components-checkout-place-order-button'
  );
  if ((await blocks.count()) > 0) return 'blocks';
  const classic = page.locator(
    'form.checkout.woocommerce-checkout, #billing_first_name, button[name="woocommerce_checkout_place_order"]'
  );
  if ((await classic.count()) > 0) return 'classic';
  return 'unknown';
}

/**
 * Place order: önce rol/erişilebilir ad, CSS yedek (blokta #place_order yok).
 * @param {import('@playwright/test').Page} page
 */
export async function findPlaceOrderButton(page) {
  const byRole = page.getByRole('button', { name: PLACE_ORDER_NAME_RE });
  const n = await byRole.count();
  for (let i = 0; i < n; i += 1) {
    const btn = byRole.nth(i);
    if (await btn.isVisible()) return btn;
  }
  const css = page.locator(PLACE_ORDER_CSS).first();
  if ((await css.count()) > 0 && (await css.isVisible())) return css;
  return null;
}

/**
 * @param {import('@playwright/test').Page} page
 */
/**
 * Blok ödeme: önceki siparişten kayıtlı adres fatura alanını DOM’da bırakır ama gizler.
 * .first() gizli input’a denk gelirse fill 25 sn bekler.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
async function visibleCheckoutField(page, selector) {
  const loc = page.locator(selector);
  const n = await loc.count();
  for (let i = 0; i < n; i += 1) {
    const el = loc.nth(i);
    if (await el.isVisible()) return el;
  }
  return null;
}

async function clickContinueIfNeeded(page) {
  const place = await findPlaceOrderButton(page);
  if (place) return;
  const cont = page.getByRole('button', { name: CONTINUE_NAME_RE }).first();
  if ((await cont.count()) > 0 && (await cont.isVisible())) {
    await cont.click({ timeout: 8000 });
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {object} store
 */
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

function nameParts(full) {
  const parts = String(full || DONOR_NAME).trim().split(/\s+/);
  return {
    first: parts[0] || 'E2E',
    last: parts.slice(1).join(' ') || 'Test',
  };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {object} store
 * @param {{ name?: string, email?: string, phone?: string }} donor
 */
export async function fillClassicCheckout(page, store, donor = {}) {
  const first = page.locator('#billing_first_name').first();
  await first.waitFor({ state: 'visible', timeout: CHECKOUT_MS });
  const parts = nameParts(donor.name || DONOR_NAME);
  await first.fill(parts.first);
  const last = page.locator('#billing_last_name').first();
  if ((await last.count()) > 0) await last.fill(parts.last);
  const email = page.locator('#billing_email').first();
  if ((await email.count()) > 0) await email.fill(donor.email || DONOR_EMAIL);
  const phone = page.locator('#billing_phone').first();
  if ((await phone.count()) > 0) await phone.fill(donor.phone || DONOR_PHONE);
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

/**
 * @param {import('@playwright/test').Page} page
 * @param {object} store
 * @param {{ name?: string, email?: string, phone?: string }} donor
 */
export async function fillBlocksCheckout(page, store, donor = {}) {
  await page
    .locator('.wc-block-checkout, .wp-block-woocommerce-checkout, #email, form.wc-block-checkout__form')
    .first()
    .waitFor({ state: 'visible', timeout: CHECKOUT_MS });
  await page.waitForFunction(() => {
    const email = document.querySelector('#email, input[type="email"]');
    if (email) {
      const st = window.getComputedStyle(email);
      if (st.display !== 'none' && st.visibility !== 'hidden' && email.getClientRects().length) {
        return true;
      }
    }
    return !!document.querySelector(
      '.wc-block-components-address-card, .wc-block-components-address-form, .wc-block-components-checkout-place-order-button'
    );
  }, { timeout: CHECKOUT_MS });
  const email = await visibleCheckoutField(page, '#email, input[type="email"]');
  if (email) await email.fill(donor.email || DONOR_EMAIL);
  const parts = nameParts(donor.name || DONOR_NAME);
  const first = await visibleCheckoutField(page, '#billing-first_name, #shipping-first_name');
  if (first) await first.fill(parts.first);
  const last = await visibleCheckoutField(page, '#billing-last_name, #shipping-last_name');
  if (last) await last.fill(parts.last);
  const addr = await visibleCheckoutField(page, '#billing-address_1, #shipping-address_1');
  if (addr) await addr.fill(store.address || 'Test Cad. 1');
  const city = await visibleCheckoutField(page, '#billing-city, #shipping-city');
  if (city) await city.fill(store.city || 'Istanbul');
  const post = await visibleCheckoutField(page, '#billing-postcode, #shipping-postcode');
  if (post) await post.fill(store.postcode || '34000');
  const phone = await visibleCheckoutField(page, '#billing-phone, #shipping-phone');
  if (phone) await phone.fill(donor.phone || DONOR_PHONE);
  await fillStateField(
    page,
    '#billing-state, #shipping-state, .wc-block-components-state-input input',
    store
  );
  await clickContinueIfNeeded(page);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {'blocks'|'classic'|string} kind
 * @param {object} store
 * @param {{ name?: string, email?: string, phone?: string }} donor
 */
export async function fillCheckout(page, kind, store, donor = {}) {
  let resolved = kind;
  if (!resolved || resolved === 'unknown') {
    resolved = await detectCheckoutKind(page);
  }
  if (resolved === 'blocks') {
    await fillBlocksCheckout(page, store, donor);
  } else {
    await fillClassicCheckout(page, store, donor);
  }
  const terms = page
    .locator('#terms, input[name="terms"], .wc-block-terms-and-conditions input[type="checkbox"]')
    .first();
  if ((await terms.count()) > 0) {
    await terms.check({ force: true });
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} [gatewayId]
 */
export async function selectOfflineGateway(page, gatewayId = 'cheque') {
  const id = String(gatewayId || 'cheque');
  const radio = page
    .locator(
      `#payment_method_${id}, input[name="payment_method"][value="${id}"], input[name="radio-control-wc-payment-method-options"][value="${id}"], #radio-control-wc-payment-method-options-${id}`
    )
    .first();
  if ((await radio.count()) > 0) {
    await radio.check({ force: true });
    return id;
  }
  const label = page.getByText(OFFLINE_GATEWAY_NAME_RE).first();
  if ((await label.count()) > 0) {
    await label.click({ timeout: 8000 });
    return id;
  }
  throw new Error(`ödeme yöntemi ${id} formda yok`);
}

/**
 * @param {string} url
 */
export function parseOrderIdFromUrl(url) {
  const thanks = String(url || '');
  const idMatch = thanks.match(/order-received\/(\d+)/i) || thanks.match(/[?&]order[=-](\d+)/i);
  return idMatch ? Number(idMatch[1]) : 0;
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
export async function clickPlaceOrder(page) {
  await clickContinueIfNeeded(page);
  const btn = await findPlaceOrderButton(page);
  if (!btn) {
    throw new Error(
      `Place order düğmesi yok (rol/ad ${PLACE_ORDER_NAME_RE}); url=${page.url()}`
    );
  }
  await btn.click({ timeout: CHECKOUT_MS, noWaitAfter: true });
  try {
    await page.waitForURL(/order-received|order-pay|key=wc_order/i, {
      timeout: CHECKOUT_MS,
      waitUntil: 'domcontentloaded',
    });
  } catch (e) {
    const err = page
      .locator('.wc-block-components-validation-error, .woocommerce-error, [role="alert"]')
      .first();
    const errText = (await err.count()) > 0 ? await err.innerText() : '';
    throw new Error(
      `sipariş tamamlanmadı url=${page.url()} validasyon=${errText || ''} (${e.message})`
    );
  }
  const orderId = parseOrderIdFromUrl(page.url());
  if (!orderId) throw new Error(`sipariş id yok: ${page.url()}`);
  return orderId;
}

/**
 * @param {number|string} orderId
 * @param {string} [wpDir]
 */
export function readLocalOrder(orderId, wpDir = '') {
  const dir = localWpDir(wpDir);
  if (!dir) throw new Error('yerel WP: WDP_LOCAL_WP_DIR yok');
  return parseLocalEvalJson(
    runLocalEvalFile('tests/local-wp/matrix-ops.php', ['read-order', String(orderId)], {
      env: { WDP_LOCAL_WP_DIR: dir },
    })
  );
}

function metaHay(rec, item) {
  const meta = (item && item.meta) || {};
  const shareholders = [];
  for (let i = 1; i <= 12; i += 1) {
    const n = String(meta[`wdp_shareholder_${i}_name`] || '');
    const p = String(meta[`wdp_shareholder_${i}_phone`] || '');
    if (!n && !p) continue;
    shareholders.push({ name: n, phone: p, index: i });
  }
  return {
    meta,
    name: String(meta.wdp_donor_name || rec.billingName || ''),
    email: String(meta.wdp_donor_email || rec.billingEmail || ''),
    phone: String(meta.wdp_donor_phone || rec.billingPhone || ''),
    dedication: String(meta.wdp_dedication || ''),
    anonymous: String(meta.wdp_anonymous || ''),
    shareholder: String(meta.wdp_shareholder_1_name || ''),
    shareholderPhone: String(meta.wdp_shareholder_1_phone || ''),
    shareholders,
  };
}

function assertUnmasked(label, value, expected) {
  const v = String(value || '');
  if (!v) throw new Error(`${label} sipariş metasından eksik`);
  if (/\*{2,}|\[deleted\]|anonim/i.test(v) && !expected.toLowerCase().includes('anonim')) {
    throw new Error(`${label} silindi/maskelendi: ${v}`);
  }
}

/**
 * Sipariş kaydı: bağış satırı, tutar, para birimi, bağışçı alanları, TR karakter, anonim silmez.
 * @param {object} rec wdp_matrix_read_order
 * @param {{
 *   donorName?: string,
 *   donorEmail?: string,
 *   donorPhone?: string,
 *   dedication?: string,
 *   shareholderName?: string,
 *   shareholderPhone?: string,
 *   shareholders?: Array<{ name: string, phone?: string }>,
 *   amount?: number|string,
 *   currency?: string,
 *   anonymous?: boolean,
 *   hpos?: boolean,
 *   productName?: string
 * }} expected
 */
export function assertLocalOrderRecord(rec, expected = {}) {
  if (!rec || rec.ok === false) {
    throw new Error(`sipariş okunamadı: ${(rec && rec.error) || 'boş'}`);
  }
  const items = Array.isArray(rec.items) ? rec.items : [];
  if (!items.length) throw new Error('siparişte bağış satırı yok');
  const item = items[0];
  if (expected.productName) {
    const names = items.map((it) => String(it.name || '')).join(' ');
    if (!names.includes(expected.productName)) {
      throw new Error(`bağış satırı adı yok: ${names.slice(0, 160)}`);
    }
  }
  const hay = metaHay(rec, item);
  if (expected.donorName) {
    assertUnmasked('bağışçı adı', hay.name, expected.donorName);
    if (hay.name !== expected.donorName && hay.name.indexOf('Çağrı') < 0) {
      throw new Error(`Türkçe karakter kaybı (ad): '${hay.name}' ≠ '${expected.donorName}'`);
    }
    if (hay.meta.wdp_donor_name && hay.meta.wdp_donor_name !== expected.donorName) {
      throw new Error(
        `bağışçı adı bozulmuş: '${hay.meta.wdp_donor_name}' ≠ '${expected.donorName}'`
      );
    }
  }
  if (expected.donorEmail) {
    assertUnmasked('e-posta', hay.email, expected.donorEmail);
    if (hay.email !== expected.donorEmail) {
      throw new Error(`e-posta uyuşmuyor: ${hay.email}`);
    }
  }
  if (expected.donorPhone) {
    const digits = (s) => String(s || '').replace(/\D+/g, '');
    if (!digits(hay.phone).endsWith(digits(expected.donorPhone).slice(-7))) {
      throw new Error(`telefon uyuşmuyor: ${hay.phone}`);
    }
  }
  if (expected.dedication) {
    assertUnmasked('ithaf', hay.dedication, expected.dedication);
    if (hay.dedication !== expected.dedication && hay.dedication.indexOf('Çağrı') < 0) {
      throw new Error(`ithaf eksik/bozuk: '${hay.dedication}'`);
    }
  }
  if (expected.shareholderName) {
    assertUnmasked('hissedar adı', hay.shareholder, expected.shareholderName);
    if (hay.shareholder !== expected.shareholderName) {
      throw new Error(
        `hissedar adı bozulmuş: '${hay.shareholder}' ≠ '${expected.shareholderName}'`
      );
    }
  }
  if (expected.shareholderPhone) {
    const digits = (s) => String(s || '').replace(/\D+/g, '');
    if (!digits(hay.shareholderPhone).endsWith(digits(expected.shareholderPhone).slice(-7))) {
      throw new Error(`hissedar telefonu uyuşmuyor: ${hay.shareholderPhone}`);
    }
  }
  if (Array.isArray(expected.shareholders) && expected.shareholders.length) {
    if (hay.shareholders.length < expected.shareholders.length) {
      throw new Error(
        `hissedar sayısı ${hay.shareholders.length} < ${expected.shareholders.length}`
      );
    }
    const digits = (s) => String(s || '').replace(/\D+/g, '');
    for (let i = 0; i < expected.shareholders.length; i += 1) {
      const want = expected.shareholders[i] || {};
      const got = hay.shareholders[i] || { name: '', phone: '' };
      if (want.name) {
        assertUnmasked(`${i + 1}. hissedar adı`, got.name, want.name);
        if (got.name !== want.name) {
          throw new Error(`${i + 1}. hissedar adı bozulmuş: '${got.name}' ≠ '${want.name}'`);
        }
      }
      if (want.phone) {
        if (!digits(got.phone).endsWith(digits(want.phone).slice(-7))) {
          throw new Error(`${i + 1}. hissedar telefonu uyuşmuyor: ${got.phone}`);
        }
      }
    }
  }
  if (expected.anonymous) {
    if (hay.meta.wdp_donor_name && /\*|\[deleted\]/i.test(hay.meta.wdp_donor_name)) {
      throw new Error(`anonim açıkken ad maskelendi: ${hay.meta.wdp_donor_name}`);
    }
    if (expected.donorName && hay.meta.wdp_donor_name && hay.meta.wdp_donor_name !== expected.donorName) {
      throw new Error(`anonim açıkken ad değişti: ${hay.meta.wdp_donor_name}`);
    }
  }
  if (expected.amount != null && expected.amount !== '') {
    const total = Number(rec.total);
    const want = Number(expected.amount);
    if (!Number.isFinite(total) || Math.abs(total - want) > 0.009) {
      throw new Error(`sipariş toplamı ${rec.total} ≠ ${expected.amount} (hpos=${rec.hpos})`);
    }
  }
  if (expected.currency) {
    if (String(rec.currency || '') !== String(expected.currency)) {
      throw new Error(`para birimi ${rec.currency} ≠ ${expected.currency}`);
    }
  }
  if (typeof expected.hpos === 'boolean' && !!rec.hpos !== expected.hpos) {
    throw new Error(`HPOS ${rec.hpos} ≠ beklenen ${expected.hpos}`);
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   store: object,
 *   checkoutKind?: string,
 *   gatewayId?: string,
 *   donor?: { name?: string, email?: string, phone?: string },
 *   expected?: object,
 *   wpDir?: string
 * }} opts
 */
export async function completeLocalCheckout(page, opts) {
  const store = opts.store || {};
  const donor = opts.donor || {
    name: DONOR_NAME,
    email: DONOR_EMAIL,
    phone: DONOR_PHONE,
  };
  const kind = opts.checkoutKind || (await detectCheckoutKind(page));
  await fillCheckout(page, kind, store, donor);
  const gw = opts.gatewayId && OFFLINE_IDS.includes(opts.gatewayId) ? opts.gatewayId : 'cheque';
  await selectOfflineGateway(page, gw);
  const orderId = await clickPlaceOrder(page);
  const rec = readLocalOrder(orderId, opts.wpDir);
  assertLocalOrderRecord(rec, opts.expected || {});
  return { orderId, rec };
}

export { PLACE_ORDER_CSS };
