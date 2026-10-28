/**
 * Doğrudan (sepetsiz) bağış e2e (YALNIZ yerel WP): form -> `POST direct` -> order-pay -> ödeme yöntemi -> teşekkür.
 * Çek/havale/kapıda + test kart geçidi; sepete dokunulmaz; çift gönderim tek sipariş.
 * Çalıştırma: `npm run e2e:queue -- npm run e2e:experiences -- --spec direct-pay --env local`.
 */
import { test, expect } from '@playwright/test';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const DONOR = { name: 'Çağlar Şükrü Öztürk', phone: '+44 7700 900123' };

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} baseURL Taban adres.
 */
async function openForm(page, baseURL) {
  await page.context().addCookies([{ name: 'dp_direct', value: '1', url: baseURL }]);
  await page.goto(`/?dp_exp_test=inline&dp_product=${PRODUCT}`);
  await expect(page.locator('[data-dp-form]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-dp-form]')).toHaveAttribute('data-direct', '1');
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 */
async function fill(page) {
  await page.locator('input[name="amount"]').fill('60');
  await page.locator('[data-dp-submit]').click();
  await expect(page.locator('[data-dp-step="details"]')).toBeVisible();
  await page.locator('input[name="donation_full_name"]').fill(DONOR.name);
  await page.locator('input[name="donation_phone"]').fill(DONOR.phone);
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<object>} Store API sepeti.
 */
async function cart(page) {
  const response = await page.request.get('/?rest_route=/wc/store/v1/cart');
  expect(response.status()).toBe(200);
  return response.json();
}

for (const method of ['cod', 'bacs', 'cheque', 'wdp_sim_card']) {
  test(`doğrudan bağış: ${method} ile ödeme, sepet boş kalır`, async ({ page, baseURL }) => {
    await openForm(page, baseURL);
    await fill(page);
    const statuses = [];
    page.on('response', (r) => {
      if (r.url().includes('/donation-panel/v1/direct')) statuses.push(r.status());
      expect(r.url()).not.toContain('/donation-panel/v1/cart/add');
    });
    await page.locator('[data-dp-submit]').click();
    await page.waitForURL(/order-pay/, { timeout: 30000 });
    expect(statuses).toEqual([200]);
    expect((await cart(page)).items).toHaveLength(0);

    const radio = page.locator(`input[name="payment_method"][value="${method}"]`);
    await expect(radio).toBeAttached({ timeout: 15000 });
    await radio.check({ force: true });
    await page.locator('#place_order').click();
    await page.waitForURL(/order-received/, { timeout: 30000 });
    await expect(page.locator('body')).toContainText(/60/);
    expect((await cart(page)).items).toHaveLength(0);
  });
}

test('ağ hatası sonrası yeniden deneme: aynı içerik aynı siparişi bulur (reused), ikinci sipariş yok', async ({ page, baseURL }) => {
  await openForm(page, baseURL);
  await fill(page);
  let calls = 0;
  const redirects = [];
  const reused = [];
  await page.route('**/donation-panel/v1/direct*', async (route) => {
    calls += 1;
    const upstream = await route.fetch();
    const body = await upstream.json();
    redirects.push(body.redirect_url);
    reused.push(body.reused);
    if (calls === 1) {
      // Sunucu siparişi açtı ama yanıt istemciye ulaşmadı.
      await route.abort('failed');
      return;
    }
    await route.fulfill({ response: upstream, json: body });
  });
  await page.locator('[data-dp-submit]').click();
  await expect.poll(() => calls, { timeout: 15000 }).toBe(1);
  await expect(page).not.toHaveURL(/order-pay/);
  await page.locator('[data-dp-submit]').click();
  await page.waitForURL(/order-pay/, { timeout: 30000 });
  expect(calls).toBe(2);
  expect(reused).toEqual([false, true]);
  expect(redirects[1]).toBe(redirects[0]);
});
