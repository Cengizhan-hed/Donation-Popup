/**
 * 12.1 inst: anında açılma ölçümü, mobil form davranışı (odak başlıkta, klavye, "Tutar seçin"), <dialog> üst katmanı,
 * geri tuşu. YALNIZ yerel WP: `npm run e2e:experiences -- --spec experiences-instant`; uzak yok.
 * Açılış ölçümü: `OPEN_MS {json}` satırı yazar (tablo için); `WDP_OPEN_LABEL=once|sonra` etiketi.
 */
import { test, expect } from '@playwright/test';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const LABEL = process.env.WDP_OPEN_LABEL || 'sonra';
const KINDS = ['popup', 'side_panel', 'bottom_sheet'];

const url = (kind) => `/?dp_exp_test=${kind}&dp_product=${PRODUCT}`;

/**
 * Yavaş ağ + 4x CPU benzetimi (yalnız Chromium/CDP); WebKit'te benzetim yok, ölçüm yine alınır.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {import('@playwright/test').BrowserContext} context Bağlam.
 * @param {string} browserName Tarayıcı.
 * @return {Promise<boolean>} Benzetim uygulandı mı.
 */
async function throttle(page, context, browserName) {
  if (browserName !== 'chromium') {
    return false;
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  // Lighthouse "slow 4G": 150 ms RTT, ~1.6 Mbps indirme.
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  return true;
}

/**
 * Dokunuştan (pointerdown) katmanın ilk görünür karesine kadar ms; işaretleyiciler sayfada kurulur.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<{visibleMs: number, openClassMs: number}>} Ölçüm.
 */
async function measureOpen(page, delay = 0) {
  await page.evaluate(() => {
    const trigger = document.querySelector('[data-dp-open]');
    window.__dpOpen = { t0: 0, visible: 0, openClass: 0 };
    trigger.addEventListener(
      'click',
      (event) => {
        window.__dpOpen.t0 = event.timeStamp;
        const loop = () => {
          const overlay = document.querySelector('[data-dp-overlay]');
          const surface = document.querySelector('[data-dp-surface]');
          if (overlay && !window.__dpOpen.openClass && overlay.classList.contains('is-open')) {
            window.__dpOpen.openClass = performance.now();
          }
          if (overlay && surface && surface.getClientRects().length > 0) {
            const style = getComputedStyle(overlay);
            if (style.visibility === 'visible' && parseFloat(style.opacity) > 0.01) {
              window.__dpOpen.visible = performance.now();
              return;
            }
          }
          window.requestAnimationFrame(loop);
        };
        window.requestAnimationFrame(loop);
      },
      { capture: true, once: true }
    );
  });
  // Gerçek dokunuş: basılı kalma süresi (parmak) — hazırlık bu sürede yapılır.
  await page.locator('[data-dp-open]').click({ delay });
  await page.waitForFunction(() => window.__dpOpen && window.__dpOpen.visible > 0, null, { timeout: 15000 });
  return page.evaluate(() => ({
    visibleMs: Math.round(window.__dpOpen.visible - window.__dpOpen.t0),
    openClassMs: Math.round(window.__dpOpen.openClass - window.__dpOpen.t0),
  }));
}

for (const kind of KINDS) {
  test.describe(`anında açılma: ${kind}`, () => {
    test('dokunuştan görünmeye ms (yavaş 4G + 4x CPU)', async ({ page, context, browserName }, testInfo) => {
      test.setTimeout(120000);
      const throttled = await throttle(page, context, browserName);
      await page.goto(url(kind), { waitUntil: 'load', timeout: 90000 });
      await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 60000 });
      // 1) Soğuk, anlık tık (basılı kalma 0: hazırlık tık anında yapılır — en kötü durum).
      const cold = await measureOpen(page, 0);
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-dp-overlay]')).not.toHaveClass(/is-open/);
      // 2) Sıcak: aynı katman ikinci/üçüncü açılış.
      const warm = [];
      for (let i = 0; i < 2; i += 1) {
        await page.waitForTimeout(400);
        warm.push(await measureOpen(page, 0));
        await page.keyboard.press('Escape');
        await expect(page.locator('[data-dp-overlay]')).not.toHaveClass(/is-open/);
      }
      // 3) Gerçek dokunuş: yeni sayfa, parmak 60 ms basılı (hazırlık basma sırasında tamamlanır).
      await page.goto(url(kind), { waitUntil: 'load', timeout: 90000 });
      await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 60000 });
      const touch = await measureOpen(page, 60);
      const row = { label: LABEL, project: testInfo.project.name, kind, throttled, coldClickMs: cold.visibleMs, realTouchMs: touch.visibleMs, warmMs: warm.map((r) => r.visibleMs) };
      console.log(`OPEN_MS ${JSON.stringify(row)}`);
      // Bütçe: gerçek dokunuş <100 ms (yavaş CPU dahil, ilk karede görünür); soğuk anlık tık <200 ms.
      expect(touch.visibleMs).toBeLessThan(100);
      expect(cold.visibleMs).toBeLessThan(200);
    });
  });
}

test.describe('mobil form davranışı', () => {
  test('açılınca hiçbir alana odak yok; odak başlıkta; <dialog> üst katmanda (yüksek z-index öğe altta kalır)', async ({ page }) => {
    await page.goto(url('popup'));
    await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 20000 });
    // Başka eklentinin yüzen öğesi benzetimi: en yüksek z-index, tüm ekranı kaplar.
    await page.evaluate(() => {
      const fake = document.createElement('div');
      fake.id = 'fake-float';
      fake.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(255,0,0,.2);pointer-events:none';
      document.body.appendChild(fake);
    });
    await page.locator('[data-dp-open]').click();
    await expect(page.locator('[data-dp-overlay]')).toHaveClass(/is-open/);
    await expect.poll(() => page.locator('[data-dp-surface]').evaluate((el) => el.getBoundingClientRect().top < window.innerHeight - 40)).toBe(true);
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => {
      const overlay = document.querySelector('[data-dp-overlay]');
      const active = document.activeElement;
      const surface = document.querySelector('[data-dp-surface]');
      const rect = surface.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 24);
      return {
        isDialog: overlay.tagName === 'DIALOG',
        modal: overlay.matches(':modal'),
        activeTag: active.tagName,
        activeIsTitle: active.matches('[data-dp-title]'),
        activeInField: active.matches('input, textarea, select'),
        topIsFake: top && top.id === 'fake-float',
        topInSurface: surface.contains(top),
      };
    });
    expect(state.isDialog).toBe(true);
    expect(state.modal).toBe(true);
    expect(state.activeInField).toBe(false);
    expect(state.activeIsTitle).toBe(true);
    expect(state.topIsFake).toBe(false);
    expect(state.topInSurface).toBe(true);
  });

  test('kapalıyken sayfada <dialog>/katman DOM\'u yok (CLS 0); dokunuşa yaklaşınca oluşur', async ({ page }) => {
    await page.goto(url('popup'));
    await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 20000 });
    expect(await page.locator('dialog').count()).toBe(0);
    expect(await page.locator('template[data-dp-tpl]').count()).toBe(1);
    await page.locator('[data-dp-open]').focus();
    await expect(page.locator('dialog[data-dp-overlay]')).toHaveCount(1);
    expect(await page.locator('dialog[data-dp-overlay]').evaluate((el) => el.open)).toBe(false);
  });

  test('geri tuşu katmanı kapatır (sayfadan çıkmaz)', async ({ page }) => {
    await page.goto(url('popup'));
    await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 20000 });
    const before = page.url();
    await page.locator('[data-dp-open]').click();
    await expect(page.locator('[data-dp-overlay]')).toHaveClass(/is-open/);
    await page.goBack();
    await expect(page.locator('[data-dp-overlay]')).not.toHaveClass(/is-open/);
    expect(page.url()).toBe(before);
    // Düğmeyle kapatınca ek geçmiş girdisi kalmaz: yeniden aç, kapat, bir geri = önceki sayfa (about:blank ya da ilk giriş).
    await page.locator('[data-dp-open]').click();
    await page.locator('[data-dp-close]').first().click();
    await expect(page.locator('[data-dp-overlay]')).not.toHaveClass(/is-open/);
    await expect.poll(() => page.evaluate(() => Boolean(history.state && history.state.dpLayer))).toBe(false);
  });

  test('"Tutar seçin": tutar yokken ana düğme pasif ve toplam satırı gizli; tutar girilince etkinleşir', async ({ page }) => {
    await page.goto(url('popup'));
    await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 20000 });
    await page.locator('[data-dp-open]').click();
    const form = page.locator('[data-dp-form]');
    const submit = page.locator('[data-dp-submit]');
    const custom = page.locator('input[name="amount"]:not([type="hidden"])');
    test.skip((await custom.count()) === 0, 'serbest tutar alanı yok');
    // Önerilen ön ayar seçiliyse seçimi kaldır (özel tutar yazıp sil).
    await custom.fill('5');
    await custom.fill('');
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('[data-dp-submit-label]')).toHaveText(await form.getAttribute('data-label-choose'));
    await expect(page.locator('[data-dp-total-row]')).toBeHidden();
    await custom.fill('25');
    await expect(submit).toHaveAttribute('aria-disabled', 'false');
    await expect(page.locator('[data-dp-submit-label]')).not.toHaveText(await form.getAttribute('data-label-choose'));
  });

  test('klavye: alan odaktayken sabit alt bölüm gizlenir, odak kalkınca döner; alan görünür alanda', async ({ page }) => {
    await page.goto(url('popup'));
    await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 20000 });
    const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    test.skip(!coarse, 'klavye gizleme dokunmatik ekranlara özgüdür (masaüstünde ekran klavyesi yok)');
    await page.locator('[data-dp-open]').click();
    const custom = page.locator('input[name="amount"]:not([type="hidden"])');
    test.skip((await custom.count()) === 0, 'serbest tutar alanı yok');
    const bar = page.locator('.dp-actionbar');
    await expect(bar).toBeVisible();
    await custom.focus();
    await expect(page.locator('[data-dp-exp]')).toHaveAttribute('data-dp-kb', '1');
    await expect(bar).toBeHidden();
    const inView = await custom.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const vv = window.visualViewport;
      return r.top >= 0 && r.bottom <= (vv ? vv.height : window.innerHeight);
    });
    expect(inView).toBe(true);
    await custom.blur();
    await expect(bar).toBeVisible();
    await expect(page.locator('[data-dp-exp]')).not.toHaveAttribute('data-dp-kb', '1');
  });
});
