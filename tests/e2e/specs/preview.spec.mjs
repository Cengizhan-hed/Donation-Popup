/**
 * Önizleme (E8A): `?dp_preview=1` yalnız oturumu açık yöneticiye, modül ayardan kapalıyken (klasik motor) formu gösterir.
 * Yalnız yerel WP; `npm run e2e:experiences -- --env local --spec preview`.
 */
import { test, expect } from '@playwright/test';
import { runLocalEvalFile, parseLocalEvalJson } from '../helpers/local-wp-eval.mjs';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const WP_DIR = process.env.WDP_LOCAL_WP_DIR || '';
// Klasik motor: yeni form modülü kapalı, kısa kodu kayıtlı değil.
const base = `/?dp_exp_test=popup&dp_product=${PRODUCT}&dp_engine=legacy`;

test.describe('önizleme', () => {
  test('klasik motorda önizleme yok: ziyaretçi ya da parametresiz yönetici formu görmez', async ({ page }) => {
    await page.goto(base);
    await expect(page.locator('[data-dp-exp]')).toHaveCount(0);
    await page.goto(`${base}&dp_preview=1`);
    await expect(page.locator('[data-dp-exp]')).toHaveCount(0);
  });

  test('yetkili yönetici + dp_preview=1: form görünür, no-cache başlığı var; parametre yoksa yine görünmez', async ({ page, context, baseURL }) => {
    const auth = parseLocalEvalJson(runLocalEvalFile('tests/local-wp/auth-cookies.php', [], { env: { WDP_LOCAL_WP_DIR: WP_DIR } }));
    expect(auth.ok).toBe(true);
    await context.addCookies([
      { name: auth.logged_in_name, value: auth.logged_in, url: baseURL },
      { name: auth.auth_name, value: auth.auth, url: baseURL },
    ]);

    await page.goto(base);
    await expect(page.locator('[data-dp-exp]')).toHaveCount(0);

    const response = await page.goto(`${base}&dp_preview=1`);
    await expect(page.locator('[data-dp-exp]')).toHaveCount(1);
    expect(String(response.headers()['cache-control'] || '')).toMatch(/no-cache|no-store/);

    // Ayar yazılmadı: parametresiz yeniden yükleme yine klasik.
    await page.goto(base);
    await expect(page.locator('[data-dp-exp]')).toHaveCount(0);
  });
});
