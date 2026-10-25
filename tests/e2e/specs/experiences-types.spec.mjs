/**
 * Experiences (E2C): bağış türleri (sabit, serbest, hisseli, kampanya), adım akışı, işlem ücreti, ek bağış, sipariş metası.
 * YALNIZ yerel WP (`npm run e2e:experiences -- --spec experiences-types [--checkout blocks]`); uzak yok.
 */
import { test, expect } from '@playwright/test';
import { completeLocalCheckout } from '../helpers/place-order.mjs';

const IDS = JSON.parse(process.env.WDP_EXP_PRODUCTS || '{}');
const CHECKOUT = process.env.WDP_EXP_CHECKOUT === 'blocks' ? 'blocks' : 'classic';
const STORE = JSON.parse(process.env.WDP_EXP_STORE || '{}');
const WP_DIR = process.env.WDP_LOCAL_WP_DIR || '';
const CHECKOUT_URL = /checkout|odeme|ödeme/i;
const DONOR = { name: 'Çağlar Şükrü Öztürk İğdır', phone: '+44 7700 900123', email: 'caglar.sukru@wdp-e2e.test' };
const HOLDERS = [
  { name: 'Çağlar Şükrü İğdır', phone: '+44 7700 900123', note: 'Ğüşiöç ĞÜŞİÖÇ notu' },
  { name: 'Öznur Ünal Çelik', phone: '+90 555 111 22 33', note: '' },
];

const pageUrl = (id, extra = '') => `/?dp_exp_test=inline&dp_product=${id}${extra}`;

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} role Ürün rolü.
 * @param {string} [extra] Ek sorgu.
 */
async function load(page, role, extra = '') {
  test.skip(!IDS[role], `${role} test ürünü yok`);
  await page.goto(pageUrl(IDS[role], extra));
  await expect(page.locator('[data-dp-form]')).toBeVisible({ timeout: 20000 });
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 */
async function next(page) {
  await page.locator('[data-dp-submit]').click();
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} step Beklenen görünür adım.
 */
async function expectStep(page, step) {
  await expect(page.locator(`[data-dp-step="${step}"]`)).toBeVisible();
  await expect(page.locator('[data-dp-step]:visible')).toHaveCount(1);
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<object>} Store API sepeti.
 */
async function storeApiCart(page) {
  const response = await page.request.get('/?rest_route=/wc/store/v1/cart');
  expect(response.status()).toBe(200);
  return response.json();
}

const minor = (cart) => 10 ** Number(cart.totals.currency_minor_unit);
const totalItems = (cart) => Number(cart.totals.total_items) / minor(cart);
const digits = (value) => String(value).replace(/\D/g, '');
const unitOf = async (page) => Number(await page.locator('[data-dp-form]').getAttribute('data-unit'));

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} text Beklenen toplam (yalnız rakamlar karşılaştırılır).
 */
async function expectTotal(page, text) {
  await expect.poll(async () => digits(await page.locator('[data-dp-total]').innerText())).toBe(digits(text));
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 */
async function fillDonor(page) {
  await page.locator('input[name="donation_full_name"]').fill(DONOR.name);
  await page.locator('input[name="donation_phone"]').fill(DONOR.phone);
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 */
async function fillHolders(page) {
  for (let i = 0; i < HOLDERS.length; i += 1) {
    const n = i + 1;
    await page.locator(`input[name="shareholder_${n}_name"]`).fill(HOLDERS[i].name);
    await page.locator(`input[name="shareholder_${n}_phone"]`).fill(HOLDERS[i].phone);
    if (HOLDERS[i].note) {
      await page.locator(`input[name="shareholder_${n}_note"]`).fill(HOLDERS[i].note);
    }
  }
}

test.describe('bağış türleri (yeni motor)', () => {
  test('sabit tutar: adet seçici toplamı günceller, sepette adet ve tutar doğru', async ({ page }) => {
    await load(page, 'fixed');
    await expect(page.locator('[data-dp-qty-box]')).toBeVisible();
    await expect(page.locator('[data-dp-steplabel]')).toContainText('1');
    await expectTotal(page, '100');
    await page.locator('[data-dp-qty="1"]').click();
    await page.locator('[data-dp-qty="1"]').click();
    await expect(page.locator('[data-dp-qty-out]')).toHaveText('3');
    await expectTotal(page, '300');
    await page.locator('[data-dp-qty="-1"]').click();
    await expectTotal(page, '200');

    await next(page);
    await expectStep(page, 'details');
    await fillDonor(page);
    await next(page);
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    const cart = await storeApiCart(page);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
    expect(totalItems(cart)).toBe(200);
    expect(cart.items[0].extensions['donation-panel'].kind).toBe('fixed');
  });

  test('hisseli: hisse sayısı kadar hissedar satırı, her hisse için zorunlu alan, sepette hisse adedi', async ({ page }) => {
    await load(page, 'shares');
    const unit = await unitOf(page);
    expect(unit).toBeGreaterThan(0);
    await expectTotal(page, String(unit));
    await page.locator('[data-dp-qty="1"]').click();
    await expect(page.locator('[data-dp-qty-out]')).toHaveText('2');
    await expectTotal(page, String(unit * 2));

    await next(page);
    await expectStep(page, 'details');
    await expect(page.locator('[data-dp-holder="1"]')).toBeVisible();
    await expect(page.locator('[data-dp-holder="2"]')).toBeVisible();
    await expect(page.locator('[data-dp-holder="3"]')).toBeHidden();
    await expect(page.locator('input[name="donation_full_name"]')).toHaveCount(0);

    await next(page);
    await expect(page.locator('[data-dp-field="shareholder_1_name"]')).toHaveClass(/has-error/);
    await expect(page.locator('input[name="shareholder_1_name"]')).toBeFocused();
    await page.locator('input[name="shareholder_1_name"]').fill(HOLDERS[0].name);
    await page.locator('input[name="shareholder_1_phone"]').fill(HOLDERS[0].phone);
    await next(page);
    await expect(page.locator('[data-dp-field="shareholder_2_name"]')).toHaveClass(/has-error/);
    await expect(page.locator('[data-dp-field="shareholder_1_name"]')).not.toHaveClass(/has-error/);

    await fillHolders(page);
    await next(page);
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    const cart = await storeApiCart(page);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
    expect(totalItems(cart)).toBe(unit * 2);
    expect(JSON.stringify(cart.items[0].extensions['donation-panel'])).not.toContain('Çağlar');
    expect(cart.items[0].extensions['donation-panel'].kind).toBe('shares');
  });

  test('hisse sayısı azalınca fazla hissedar satırı kapanır ve gönderilmez', async ({ page }) => {
    await load(page, 'shares');
    await page.locator('[data-dp-qty="1"]').click();
    await page.locator('[data-dp-qty="-1"]').click();
    await expectTotal(page, String(await unitOf(page)));
    await next(page);
    await expect(page.locator('[data-dp-holder="2"]')).toBeHidden();
    await expect(page.locator('input[name="shareholder_2_name"]')).toBeDisabled();
  });

  test('hedefli kampanya: yazılan tutar sepete gider', async ({ page }) => {
    await load(page, 'campaign');
    await page.locator('input[name="amount"]').fill('75');
    await expectTotal(page, '75');
    await next(page);
    await expectStep(page, 'details');
    await fillDonor(page);
    await next(page);
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    const cart = await storeApiCart(page);
    expect(totalItems(cart)).toBe(75);
    expect(cart.items[0].extensions['donation-panel'].kind).toBe('campaign');
  });

  test('serbest tutar: işlem ücreti ve ek bağış toplamı, ayrı satır, en düşük tutar kuralı', async ({ page }) => {
    await load(page, 'addon');
    await page.locator('input[name="amount"]').fill('100');
    await expectTotal(page, '100');
    await page.locator('input[name="donation_cover_fee"]').check();
    await expectTotal(page, '105');

    await page.locator('input[name="addon_active"]').check();
    await expect(page.locator('[data-dp-addon-box]')).toBeVisible();
    await next(page);
    await expect(page.locator('[data-dp-field="addon_amount"]')).toHaveClass(/has-error/);
    await expectStep(page, 'amount');
    await page.locator('input[name="addon_amount"]').fill('5');
    await next(page);
    await expect(page.locator('[data-dp-field="addon_amount"]')).toHaveClass(/has-error/);
    await page.locator('input[name="addon_amount"]').fill('25');
    await expectTotal(page, '130');

    await next(page);
    await expectStep(page, 'details');
    await expect(page.locator('[data-dp-line="fee"]')).toBeVisible();
    await expect(page.locator('[data-dp-line="addon"]')).toBeVisible();
    expect(digits(await page.locator('[data-dp-line="total"] [data-dp-line-value]').innerText())).toBe('130');
    await fillDonor(page);
    await next(page);
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    const cart = await storeApiCart(page);
    expect(cart.items).toHaveLength(2);
    expect(totalItems(cart)).toBe(130);
    const lines = cart.items.map((item) => Number(item.totals.line_total) / minor(cart)).sort((a, b) => a - b);
    expect(lines).toEqual([25, 105]);
  });

  test('ücret ve ek bağış kapalıyken toplam yalnız bağış tutarıdır', async ({ page }) => {
    await load(page, 'addon');
    await page.locator('input[name="amount"]').fill('100');
    await page.locator('input[name="donation_cover_fee"]').check();
    await page.locator('input[name="addon_active"]').check();
    await page.locator('input[name="addon_amount"]').fill('25');
    await expectTotal(page, '130');
    await page.locator('input[name="donation_cover_fee"]').uncheck();
    await page.locator('input[name="addon_active"]').uncheck();
    await expectTotal(page, '100');
    await next(page);
    await fillDonor(page);
    await next(page);
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    const cart = await storeApiCart(page);
    expect(cart.items).toHaveLength(1);
    expect(totalItems(cart)).toBe(100);
  });
});

test.describe('adım akışı', () => {
  test('geri düğmesi değerleri korur; adım göstergesi ve etiket güncellenir', async ({ page }) => {
    await load(page, 'custom');
    await expect(page.locator('[data-dp-back]')).toBeHidden();
    await page.locator('input[name="amount"]').fill('75');
    await next(page);
    await expectStep(page, 'details');
    await expect(page.locator('[data-dp-steplabel]')).toContainText('2');
    await expect(page.locator('.dp-steps__i.is-current')).toHaveCount(1);
    await page.locator('input[name="donation_full_name"]').fill('Öznur');
    await page.locator('[data-dp-back]').click();
    await expectStep(page, 'amount');
    await expect(page.locator('input[name="amount"]')).toHaveValue('75');
    await expectTotal(page, '75');
    await next(page);
    await expect(page.locator('input[name="donation_full_name"]')).toHaveValue('Öznur');
  });

  test('sunucu önceki adımdaki alan hatası döndürürse o adıma dönülür', async ({ page }) => {
    await load(page, 'custom');
    await page.route('**/donation-panel/v1/cart/add*', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'donation_panel_cart_rejected', message: 'x', data: { status: 400, errors: { amount: 'Tutar sunucuda reddedildi.' } } }),
      })
    );
    await page.locator('input[name="amount"]').fill('75');
    await next(page);
    await fillDonor(page);
    await next(page);
    await expectStep(page, 'amount');
    await expect(page.locator('[data-dp-error="amount"]').first()).toContainText('Tutar sunucuda reddedildi.');
  });

  test('düzenli bağış anahtarı yalnız seçenek filtresi doluysa çizilir', async ({ page }) => {
    await load(page, 'custom');
    await expect(page.locator('input[name="donation_type"]')).toHaveCount(0);
    await load(page, 'custom', '&dp_freq=1');
    await expect(page.locator('input[name="donation_type"]')).toHaveCount(2);
    await expect(page.locator('.dp-seg')).toBeVisible();
  });
});

test.describe('sipariş (HPOS, yalnız yerel)', () => {
  test('hisseli sipariş: tür, hisse sayısı ve her hissedarın alanları Türkçe karakterle eksiksiz', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'sipariş denemesi bir cihazda (yerel)');
    test.setTimeout(180000);
    await load(page, 'shares');
    const unit = await unitOf(page);
    await page.locator('[data-dp-qty="1"]').click();
    await next(page);
    await fillHolders(page);
    await next(page);
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    const { rec } = await completeLocalCheckout(page, {
      store: STORE,
      checkoutKind: CHECKOUT,
      wpDir: WP_DIR,
      donor: { name: DONOR.name, email: DONOR.email, phone: DONOR.phone },
      expected: { amount: String(unit * 2), hpos: true, currency: 'TRY', shareholders: HOLDERS.map(({ name, phone }) => ({ name, phone })) },
    });
    const meta = rec.items[0].meta;
    expect(meta.wdp_donation_type).toBe('shares');
    expect(String(meta.wdp_share_count)).toBe('2');
    expect(meta.wdp_shareholder_1_name).toBe(HOLDERS[0].name);
    expect(meta.wdp_shareholder_1_note).toBe(HOLDERS[0].note);
    expect(meta.wdp_shareholder_2_name).toBe(HOLDERS[1].name);
  });

  test('ücret + ek bağış siparişi: tür ve işlem ücreti metası, ek satır ayrı', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'sipariş denemesi bir cihazda (yerel)');
    test.setTimeout(180000);
    await load(page, 'addon');
    await page.locator('input[name="amount"]').fill('100');
    await page.locator('input[name="donation_cover_fee"]').check();
    await page.locator('input[name="addon_active"]').check();
    await page.locator('input[name="addon_amount"]').fill('25');
    await next(page);
    await fillDonor(page);
    await page.locator('textarea[name="donation_note"]').fill('Ğüşiöç ĞÜŞİÖÇ notu');
    await next(page);
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    const { rec } = await completeLocalCheckout(page, {
      store: STORE,
      checkoutKind: CHECKOUT,
      wpDir: WP_DIR,
      donor: { name: DONOR.name, email: DONOR.email, phone: DONOR.phone },
      expected: { amount: '130', hpos: true, currency: 'TRY', donorName: DONOR.name, donorPhone: DONOR.phone },
    });
    expect(rec.items).toHaveLength(2);
    const main = rec.items.find((item) => item.meta && item.meta.wdp_donation_type);
    expect(main).toBeTruthy();
    expect(main.meta.wdp_donation_type).toBe('custom');
    expect(String(main.meta.wdp_cover_fee)).toBe('5');
    expect(main.meta.wdp_donation_note).toBe('Ğüşiöç ĞÜŞİÖÇ notu');
    expect(rec.items.filter((item) => item.meta && item.meta.wdp_donation_type)).toHaveLength(1);
  });
});
