/**
 * 12-d: ödeme sayfası ön doldurma — bağış formundaki ad/telefon/e-posta fatura alanlarına gelir.
 * YALNIZ yerel WP: `npm run e2e:queue -- npm run e2e:experiences -- --env local --spec checkout-prefill [--checkout blocks]`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { parseLocalEvalJson, runLocalEvalFile } from '../helpers/local-wp-eval.mjs';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const CHECKOUT = process.env.WDP_EXP_CHECKOUT === 'blocks' ? 'blocks' : 'classic';
const WP_DIR = process.env.WDP_LOCAL_WP_DIR || '';
const DONOR = { name: 'Çağlar Şükrü Öztürk İğdır', phone: '+44 7700 900123' };
const CHECKOUT_URL = /checkout|odeme|ödeme/i;
const SHOT_DIR = path.resolve(process.cwd(), process.env.WDP_ONCE_SONRA_DIR || 'build/handoff/ONCE-SONRA/checkout-prefill');

const sel = CHECKOUT === 'blocks'
  ? { first: '#billing-first_name, #shipping-first_name', last: '#billing-last_name, #shipping-last_name', phone: '#billing-phone, #shipping-phone', email: '#email' }
  : { first: '#billing_first_name', last: '#billing_last_name', phone: '#billing_phone', email: '#billing_email' };

/** @param {import('@playwright/test').Page} page */
async function donate(page) {
  await page.goto(`/?dp_exp_test=inline&dp_product=${PRODUCT}`);
  await expect(page.locator('[data-dp-form]')).toBeVisible({ timeout: 20000 });
  await page.locator('input[name="amount"]').fill('50');
  await page.locator('[data-dp-submit]').click();
  await expect(page.locator('[data-dp-step="details"]')).toBeVisible();
  await page.locator('input[name="donation_full_name"]').fill(DONOR.name);
  await page.locator('input[name="donation_phone"]').fill(DONOR.phone);
  const email = page.locator('input[name="donation_email"]');
  const hasEmail = (await email.count()) > 0;
  if (hasEmail) {
    await email.fill('caglar.sukru@wdp-e2e.test');
  }
  await page.locator('[data-dp-submit]').click();
  await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
  await expect(page.locator(sel.first).first()).toBeVisible({ timeout: 30000 });
  return hasEmail;
}

/** @param {import('@playwright/test').Page} page @param {import('@playwright/test').TestInfo} info @param {string} name */
async function shot(page, info, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${CHECKOUT}-${info.project.name}-${name}.png`), fullPage: true });
}

/** @param {import('@playwright/test').BrowserContext} context @param {string} baseURL @param {object} billing */
async function loginAs(context, baseURL, billing) {
  const auth = parseLocalEvalJson(
    runLocalEvalFile('tests/e2e/helpers/wdp-checkout-prefill-user.php', [JSON.stringify(billing)], { env: { WDP_LOCAL_WP_DIR: WP_DIR } })
  );
  expect(auth.ok).toBe(true);
  await context.addCookies([
    { name: auth.logged_in_name, value: auth.logged_in, url: baseURL },
    { name: auth.auth_name, value: auth.auth, url: baseURL },
  ]);
}

test.describe(`ödeme ön doldurma (${CHECKOUT})`, () => {
  test('misafir: ad, soyad, telefon (ve varsa e-posta) dolu gelir ve değiştirilebilir', async ({ page }, info) => {
    const hasEmail = await donate(page);
    await expect(page.locator(sel.first).first()).toHaveValue('Çağlar Şükrü Öztürk');
    await expect(page.locator(sel.last).first()).toHaveValue('İğdır');
    await expect(page.locator(sel.phone).first()).toHaveValue(DONOR.phone);
    if (hasEmail) {
      await expect(page.locator(sel.email).first()).toHaveValue('caglar.sukru@wdp-e2e.test');
    }
    await shot(page, info, 'misafir');
    await page.locator(sel.first).first().fill('Değişti');
    await expect(page.locator(sel.first).first()).toHaveValue('Değişti');
  });

  test('girişli, hesap dolu: hesaptaki değerlerin üzerine yazılmaz', async ({ page, context, baseURL }, info) => {
    await loginAs(context, baseURL, { first_name: 'Hesap', last_name: 'Sahibi', phone: '+90 500 000 00 00', email: 'hesap@wdp-e2e.test' });
    await donate(page);
    await expect(page.locator(sel.first).first()).toHaveValue('Hesap');
    await expect(page.locator(sel.last).first()).toHaveValue('Sahibi');
    await expect(page.locator(sel.phone).first()).toHaveValue('+90 500 000 00 00');
    await shot(page, info, 'girisli-dolu');
  });

  test('girişli, hesapta yalnız ad var: yalnız boş alanlar dolar', async ({ page, context, baseURL }, info) => {
    await loginAs(context, baseURL, { first_name: 'Hesap' });
    await donate(page);
    await expect(page.locator(sel.first).first()).toHaveValue('Hesap');
    await expect(page.locator(sel.last).first()).toHaveValue('İğdır');
    await expect(page.locator(sel.phone).first()).toHaveValue(DONOR.phone);
    await shot(page, info, 'girisli-kismi');
  });
});
