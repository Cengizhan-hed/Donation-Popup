/**
 * E4 (CLAUDE.md §24): tarayıcı konsolunda hata/uyarı 0 — arayüzsüz sayfa, arayüzlü sayfa ve doğrudan bağış akışı (YALNIZ yerel WP).
 * Dinlenenler: console.error/warning, pageerror, başarısız istek, 4xx/5xx yanıt (eklenti kaynaklı ya da aynı kökenli).
 * Çalıştırma: `WDP_WP_DEBUG_LOG=1 npm run e2e:queue -- npm run e2e:experiences -- --spec console-clean --env local`.
 */
import { test, expect } from '@playwright/test';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {string[]} Toplanan sorunlar (canlı dizi).
 */
function collect(page) {
  const issues = [];
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) issues.push(`console.${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => issues.push(`pageerror: ${String(e.message).slice(0, 200)}`));
  page.on('requestfailed', (r) => issues.push(`requestfailed: ${r.url().slice(0, 160)} ${r.failure()?.errorText || ''}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) issues.push(`http ${r.status()}: ${r.url().slice(0, 160)}`);
  });
  return issues;
}

test('konsol temiz: arayüzsüz sayfa (ana sayfa)', async ({ page }) => {
  const issues = collect(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(issues).toEqual([]);
});

test('konsol temiz: arayüzlü sayfa (satır içi form) ve form açma', async ({ page }) => {
  const issues = collect(page);
  await page.goto(`/?dp_exp_test=inline&dp_product=${PRODUCT}`);
  await expect(page.locator('[data-dp-form]')).toBeVisible({ timeout: 20000 });
  await page.locator('input[name="amount"]').fill('60');
  await page.locator('[data-dp-submit]').click();
  await expect(page.locator('[data-dp-step="details"]')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(issues).toEqual([]);
});

test('konsol temiz: doğrudan bağış akışı order-pay sayfasına kadar', async ({ page, baseURL }) => {
  const issues = collect(page);
  await page.context().addCookies([{ name: 'dp_direct', value: '1', url: baseURL }]);
  await page.goto(`/?dp_exp_test=inline&dp_product=${PRODUCT}`);
  await expect(page.locator('[data-dp-form]')).toHaveAttribute('data-direct', '1', { timeout: 20000 });
  await page.locator('input[name="amount"]').fill('60');
  await page.locator('[data-dp-submit]').click();
  await expect(page.locator('[data-dp-step="details"]')).toBeVisible();
  await page.locator('input[name="donation_full_name"]').fill('Çağlar Şükrü Öztürk');
  await page.locator('input[name="donation_phone"]').fill('+44 7700 900123');
  // 12.4: doğrudan akışta e-posta zorunlu.
  await page.locator('input[name="donation_email"]').fill('konsol@wdp-e2e.test');
  await page.locator('[data-dp-submit]').click();
  await page.waitForURL(/order-pay/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  // Üçüncü taraf (ödeme yöntemi/tema) kaynaklı gürültüyü ayırmak için yalnız eklenti yollarını ve REST yanıtlarını say.
  const own = issues.filter((i) => /donation-panel|woo-donation-popup|donation_panel/i.test(i) || !/\/wp-content\/(?:themes|plugins\/(?!woo-donation-popup))/.test(i));
  expect(own).toEqual([]);
});
