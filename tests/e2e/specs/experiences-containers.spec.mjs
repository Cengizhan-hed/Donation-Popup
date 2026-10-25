/**
 * Experiences (E2A): 4 kap x iPhone/Android/masaüstü — açılır/kapanır, odak tuzağı, dokunma boyutu, axe.
 * Yalnız yerel WP (yeni motor); `npm run e2e:experiences`.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const KINDS = ['popup', 'side_panel', 'bottom_sheet', 'inline'];
const NARROW = 639.98;

const url = (kind, extra = '') => `/?dp_exp_test=${kind}&dp_product=${PRODUCT}${extra}`;

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} kind Kap.
 * @param {string} [extra] Ek sorgu.
 */
async function load(page, kind, extra = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url(kind, extra));
  await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 20000 }).catch(async () => {
    // Tetikleyici görünür olmalı; inline kapta kök görünür.
    await expect(page.locator('[data-dp-exp]')).toHaveCount(1);
  });
  return errors;
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} kind Kap.
 */
async function openIfLayer(page, kind) {
  if (kind === 'inline') {
    return;
  }
  await page.locator('[data-dp-open]').click();
  await expect(page.locator('[data-dp-overlay]')).toHaveClass(/is-open/);
}

const surfaceOf = (page, kind) => (kind === 'inline' ? page.locator('.dp-inline') : page.locator('[data-dp-surface]'));

for (const kind of KINDS) {
  test.describe(`kap: ${kind}`, () => {
    test('açılır, odak içeri girer, Esc/kapat/arka plan ile kapanır, odak tetikleyiciye döner', async ({ page }) => {
      test.skip(kind === 'inline', 'sayfa içi kap açılıp kapanmaz');
      const errors = await load(page, kind);
      const root = page.locator('[data-dp-exp]');
      const narrow = (page.viewportSize()?.width ?? 1440) <= NARROW;
      const expected = kind === 'bottom_sheet' || narrow ? 'sheet' : kind === 'side_panel' ? 'panel' : 'modal';
      await expect(root).toHaveAttribute('data-dp-presented', expected);

      await openIfLayer(page, kind);
      const surface = surfaceOf(page, kind);
      await expect(surface).toBeVisible();
      await expect(page.locator('[data-dp-open]')).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(() => surface.evaluate((el) => el.contains(document.activeElement))).toBe(true);

      // Odak tuzağı: çok sayıda Tab odağı yüzeyin dışına çıkarmaz.
      for (let i = 0; i < 14; i += 1) {
        await page.keyboard.press('Tab');
        expect(await surface.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      }
      await page.keyboard.press('Shift+Tab');
      expect(await surface.evaluate((el) => el.contains(document.activeElement))).toBe(true);

      // Esc kapatır, odak tetikleyiciye döner.
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-dp-overlay]')).not.toHaveClass(/is-open/);
      await expect(page.locator('[data-dp-open]')).toBeFocused();

      // Kapat düğmesi.
      await openIfLayer(page, kind);
      await page.locator('[data-dp-close]').click();
      await expect(page.locator('[data-dp-overlay]')).not.toHaveClass(/is-open/);

      // Arka plana dokunma/tıklama (yüzeyin dışı).
      await openIfLayer(page, kind);
      await page.locator('[data-dp-overlay]').click({ position: { x: 4, y: 4 } });
      await expect(page.locator('[data-dp-overlay]')).not.toHaveClass(/is-open/);
      expect(errors).toEqual([]);
    });

    test('dokunma hedefleri >= 44 px ve etiketler/ad var', async ({ page }) => {
      await load(page, kind);
      await openIfLayer(page, kind);
      await page.waitForTimeout(700); // açılış animasyonu bitsin (ölçek geçişi ölçümü bozar)
      const small = await surfaceOf(page, kind).evaluate((el) => {
        const out = [];
        el.querySelectorAll('button, [role="radio"], input:not([type="hidden"]), textarea, .dp-check').forEach((node) => {
          const style = getComputedStyle(node);
          if (style.visibility === 'hidden' || style.display === 'none' || node.classList.contains('dp-sr')) {
            return;
          }
          if (node.closest('.dp-check') && node.tagName === 'INPUT') {
            return; // satırın kendisi hedef
          }
          if (node.closest('.dp-seg__item') && node.tagName === 'INPUT') {
            return;
          }
          const box = node.getBoundingClientRect();
          if (box.height > 0 && (box.height < 43.5 || box.width < 43.5)) {
            out.push(`${node.tagName}.${node.className} ${Math.round(box.width)}x${Math.round(box.height)}`);
          }
        });
        return out;
      });
      expect(small).toEqual([]);
    });

    test('axe WCAG 2.2 AA: 0 hata', async ({ page }) => {
      await load(page, kind);
      await openIfLayer(page, kind);
      // Açılış animasyonu bitmeden kontrast ölçülmez.
      await page.waitForTimeout(700);
      await page.evaluate(AXE);
      const result = await page.evaluate(async (selector) => {
        // eslint-disable-next-line no-undef
        return axe.run(document.querySelector(selector), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
      }, kind === 'inline' ? '.dp-inline' : '[data-dp-surface]');
      const summary = result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
      expect(summary).toEqual([]);
    });
  });
}

test.describe('form çekirdeği (yeni motor)', () => {
  test('tutar çipi seçimi, ok tuşları, toplam, boş gönderimde alan hataları ve odak', async ({ page }) => {
    await load(page, 'inline');
    const chips = page.locator('[data-dp-preset]');
    expect(await chips.count()).toBeGreaterThan(1);
    await chips.nth(1).click();
    await expect(chips.nth(1)).toHaveAttribute('aria-checked', 'true');
    const total = page.locator('[data-dp-total]');
    const value = await chips.nth(1).getAttribute('data-dp-preset');
    await expect(total).toContainText(String(Math.trunc(Number(value))));

    await chips.nth(1).focus();
    await page.keyboard.press('ArrowRight');
    await expect(chips.nth(2)).toHaveAttribute('aria-checked', 'true');
    await expect(chips.nth(2)).toBeFocused();

    const custom = page.locator('input[name="amount"]');
    await custom.fill('1.250');
    await expect(total).toContainText('1.250');
    await expect(chips.nth(2)).toHaveAttribute('aria-checked', 'false');

    await custom.fill('');
    await page.locator('[data-dp-submit]').click();
    await expect(page.locator('[data-dp-field="donation_full_name"]')).toHaveClass(/has-error/);
    await expect(page.locator('[data-dp-field="amount"]')).toHaveClass(/has-error/);
    await expect(page.locator('[data-dp-summary]')).toHaveClass(/is-visible/);
    await expect(page.locator('input[name="amount"]')).toBeFocused();
  });

  test('Türkçe karakterli alanlar doğrulamadan geçer ve sepete gider', async ({ page }) => {
    await load(page, 'inline');
    await page.locator('[data-dp-preset]').first().click();
    let body = '';
    page.on('response', (r) => {
      if (r.url().includes('admin-ajax.php')) {
        r.text().then((t) => {
          body = t;
        }, () => {});
      }
    });
    await page.locator('input[name="donation_full_name"]').fill('Çağlar Şükrü Öztürk İğdır');
    await page.locator('input[name="donation_phone"]').fill('+44 7700 900123');
    await page.locator('textarea[name="donation_note"]').fill('Ğüşiöç ĞÜŞİÖÇ notu');
    const validate = page.waitForResponse((r) => r.url().includes('/donation-panel/v1/validate'));
    const add = page.waitForResponse((r) => r.url().includes('admin-ajax.php') && (r.request().postData() || '').includes('wdp_ajax_add_to_cart'));
    await page.locator('[data-dp-submit]').click();
    const validated = await (await validate).json();
    expect(validated.valid).toBe(true);
    const added = await add;
    expect(added.status()).toBe(200);
    await page.waitForURL(/checkout|cart|odeme|sepet/i, { timeout: 30000 });
  });

  test('RTL: yan panel sol kenardan açılır', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) <= NARROW, 'mobilde yan panel alttan panel olur');
    await load(page, 'side_panel');
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
    });
    await openIfLayer(page, 'side_panel');
    await page.waitForTimeout(700);
    const box = await page.locator('[data-dp-surface]').boundingBox();
    expect(box.x).toBeLessThan(5);
  });
});

test.describe('eski motor (engine=legacy)', () => {
  test('yeni kısa kod, varlık ve işaretleme yüklenmez', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(url('popup', '&dp_engine=legacy'));
    await expect(page.locator('[data-dp-exp]')).toHaveCount(0);
    expect(requests.filter((u) => u.includes('assets/build/experiences'))).toEqual([]);
    expect(await page.content()).not.toContain('dp-overlay');
  });
});
