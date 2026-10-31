/**
 * Doğrudan (sepetsiz) bağış e2e (YALNIZ yerel WP): form -> `POST direct` -> order-pay -> ödeme yöntemi -> teşekkür.
 * Çek/havale/kapıda + test kart geçidi; sepete dokunulmaz; çift gönderim tek sipariş.
 * Çalıştırma: `npm run e2e:queue -- npm run e2e:experiences -- --spec direct-pay --env local`.
 */
import { test, expect } from '@playwright/test';
import { parseLocalEvalJson, runLocalEvalFile } from '../helpers/local-wp-eval.mjs';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const DONOR = { name: 'Çağlar Şükrü Öztürk', phone: '+44 7700 900123', email: 'dogrudan@wdp-e2e.test' };

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} baseURL Taban adres.
 */
async function openForm(page, baseURL, extra = '') {
  await page.context().addCookies([{ name: 'dp_direct', value: '1', url: baseURL }]);
  await page.goto(`/?dp_exp_test=inline&dp_product=${PRODUCT}${extra}`);
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
  // 12.4: doğrudan akışta e-posta zorunlu (order-pay fatura sormaz; ödeme geçitleri ve sipariş e-postaları ister).
  await expect(page.locator('input[name="donation_email"]')).toHaveAttribute('required', '');
  await page.locator('input[name="donation_email"]').fill(DONOR.email);
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

// --- 12.4 email4: e-posta kuralı (doğrudan: misafirde zorunlu, girişlide sorulmaz; sepetli: formda yok) ---
const WP_DIR = process.env.WDP_LOCAL_WP_DIR || '';

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 */
async function fillWithoutEmail(page) {
  await page.locator('input[name="amount"]').fill('60');
  await page.locator('[data-dp-submit]').click();
  await expect(page.locator('[data-dp-step="details"]')).toBeVisible();
  await page.locator('input[name="donation_full_name"]').fill(DONOR.name);
  await page.locator('input[name="donation_phone"]').fill(DONOR.phone);
}

/**
 * @param {string} url Sipariş ödeme adresi.
 * @return {{ok: boolean, billing: string, item: string}} Siparişin e-postaları.
 */
function orderEmails(url) {
  const orderId = Number((url.match(/order-pay\/(\d+)/) || [])[1] || 0);
  expect(orderId).toBeGreaterThan(0);
  return parseLocalEvalJson(runLocalEvalFile('tests/e2e/helpers/wdp-order-email.php', [String(orderId)], { env: { WDP_LOCAL_WP_DIR: WP_DIR } }));
}

test('misafir, doğrudan: e-posta boşken ilerleme engellenir, hata görünür, istek gitmez', async ({ page, baseURL }) => {
  await openForm(page, baseURL);
  await fillWithoutEmail(page);
  let posts = 0;
  page.on('request', (r) => {
    if (r.url().includes('/donation-panel/v1/direct')) posts += 1;
  });
  await page.locator('[data-dp-submit]').click();
  const error = page.locator('[data-dp-error="donation_email"]');
  await expect(error).toBeVisible();
  await expect(error).not.toHaveText('');
  await expect(page).not.toHaveURL(/order-pay/);
  expect(posts).toBe(0);
});

test('sunucu da reddeder: e-postasız ve biçimi bozuk doğrudan istek 4xx, sipariş açılmaz', async ({ page, baseURL }) => {
  await openForm(page, baseURL);
  const base = { product_id: Number(PRODUCT), amount: '60', donation_full_name: DONOR.name, donation_phone: DONOR.phone };
  for (const email of ['', 'bozuk-adres', '<b>x</b>@ornek.org']) {
    const response = await page.request.post('/?rest_route=/donation-panel/v1/direct', {
      headers: { 'Content-Type': 'application/json' },
      data: { ...base, donation_email: email },
    });
    expect(response.status(), `e-posta "${email}"`).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  }
});

test('girişli, doğrudan: e-posta alanı gösterilmez; sipariş hesap e-postasıyla açılır', async ({ page, context, baseURL }) => {
  const auth = parseLocalEvalJson(
    runLocalEvalFile('tests/e2e/helpers/wdp-checkout-prefill-user.php', [JSON.stringify({ first_name: 'Hesap' })], { env: { WDP_LOCAL_WP_DIR: WP_DIR } })
  );
  expect(auth.ok).toBe(true);
  await context.addCookies([
    { name: auth.logged_in_name, value: auth.logged_in, url: baseURL },
    { name: auth.auth_name, value: auth.auth, url: baseURL },
  ]);
  // Temanın `logged-in` gövde sınıfını basmadığı sayfa: karar yalnız REST yanıtındaki `logged_in` boolean'ından gelir.
  await openForm(page, baseURL, '&dp_no_login_class=1');
  await expect(page.locator('body')).not.toHaveClass(/logged-in/);
  const nonceBodies = [];
  let nonceCalls = 0;
  page.on('response', async (r) => {
    if (r.url().includes('/donation-panel/v1/nonce')) {
      nonceCalls += 1;
      nonceBodies.push({ cache: r.headers()['cache-control'] || '', vary: r.headers().vary || '', body: await r.json() });
    }
  });
  await fillWithoutEmail(page);
  await expect(page.locator('[data-dp-field="donation_email"]')).toBeHidden();
  await expect(page.locator('input[name="donation_email"]')).toBeDisabled();
  await expect(page.locator('input[name="donation_email"]')).not.toHaveAttribute('required', /.*/);
  await page.locator('[data-dp-submit]').click();
  await page.waitForURL(/order-pay/, { timeout: 30000 });
  const order = orderEmails(page.url());
  expect(order.ok).toBe(true);
  expect(order.billing).toBe('wdp-e2e-prefill@wdp-e2e.test');
  expect(order.item).toBe('wdp-e2e-prefill@wdp-e2e.test');
  // Ek istek yok: nonce zaten gönderimde alınırdı; ilk etkileşimde bir kez alınır ve gönderimde yeniden kullanılır.
  expect(nonceCalls).toBe(1);
  expect(Object.keys(nonceBodies[0].body).sort()).toEqual(['logged_in', 'nonce']);
  expect(nonceBodies[0].body.logged_in).toBe(true);
  expect(nonceBodies[0].cache).toMatch(/no-store/);
  expect(nonceBodies[0].vary.toLowerCase()).toContain('cookie');
});

test('misafir, gövde sınıfı süzgeçli sayfa: alan görünür ve zorunlu, yanıtta logged_in=false', async ({ page, baseURL }) => {
  await openForm(page, baseURL, '&dp_no_login_class=1');
  const bodies = [];
  page.on('response', async (r) => {
    if (r.url().includes('/donation-panel/v1/nonce')) bodies.push(await r.json());
  });
  await fillWithoutEmail(page);
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0].logged_in).toBe(false);
  await expect(page.locator('[data-dp-field="donation_email"]')).toBeVisible();
  await expect(page.locator('input[name="donation_email"]')).toBeEnabled();
  await expect(page.locator('input[name="donation_email"]')).toHaveAttribute('required', '');
});

test('misafir, doğrudan: yazılan e-posta siparişe eksiksiz yazılır', async ({ page, baseURL }) => {
  await openForm(page, baseURL);
  await fill(page);
  await page.locator('[data-dp-submit]').click();
  await page.waitForURL(/order-pay/, { timeout: 30000 });
  const order = orderEmails(page.url());
  expect(order.billing).toBe(DONOR.email);
  expect(order.item).toBe(DONOR.email);
});
