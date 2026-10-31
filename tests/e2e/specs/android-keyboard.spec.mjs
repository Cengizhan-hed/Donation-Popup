/**
 * 12.4 Android klavye benzetimi (Playwright Chromium + Pixel 7): iki Chrome davranışı.
 *  (a) visual: düzen viewport'u sabit, visualViewport küçülür (Chrome 108+ varsayılanı).
 *  (b) content: düzen viewport'u gerçekten küçülür (resizes-content / eski WebView).
 * Senaryo: panel → Bilgiler adımı → alana dokun/yaz → alanlar arası geçiş → boş yere dokunup kapat; kare kare (rAF)
 * alt bölüm + düğme konum/genişlik, gövde scrollbar, gövde scrollTop sıçraması, alanın örtülmemesi.
 * YALNIZ yerel WP: `npm run e2e:experiences -- --spec android-keyboard --project android`.
 */
import { test, expect } from '@playwright/test';
import { installAndroidKeyboardSim } from '../helpers/android-keyboard-sim.mjs';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const MODES = ['visual', 'content'];
const FIELD_SEL = '[data-dp-step="details"] :is(input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), textarea:not([disabled]))';

async function openDetails(page) {
  await page.goto(`/?dp_exp_test=popup&dp_product=${PRODUCT}`);
  await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-dp-open]').click();
  await expect(page.locator('[data-dp-overlay]')).toHaveClass(/is-open/);
  await page.waitForTimeout(700);
  const surface = page.locator('[data-dp-surface]');
  const preset = surface.locator('[data-dp-preset]').first();
  if (await preset.count()) {
    await preset.click();
  } else {
    await surface.locator('input[name="amount"]:not([type="hidden"])').fill('25');
  }
  await surface.locator('[data-dp-submit]').first().click();
  await expect(surface.locator('[data-dp-step="details"]')).toBeVisible();
  await page.waitForTimeout(500);
  const all = page.locator(FIELD_SEL);
  const out = [];
  for (let i = 0; i < (await all.count()) && out.length < 3; i += 1) {
    if (await all.nth(i).isVisible()) {
      out.push(all.nth(i));
    }
  }
  return out;
}

/** rAF örnekleyici: alt bölüm/düğme yüzey alt kenarına göre; gövde scrollbar ve scrollTop; sayfa kaydırması. */
function startFrames(page) {
  return page.evaluate(() => {
    const frames = [];
    window.__dpFrames = frames;
    window.__dpFramesOn = true;
    const rel = (r, s) => [Math.round(r.left * 100) / 100, Math.round(r.width * 100) / 100, Math.round((s.bottom - r.bottom) * 100) / 100, Math.round(r.height * 100) / 100];
    const tick = () => {
      const surface = document.querySelector('[data-dp-surface]');
      const bar = document.querySelector('.donation-panel-actionbar');
      const body = document.querySelector('.donation-panel-surface__body');
      if (surface && bar && body) {
        const sr = surface.getBoundingClientRect();
        const btn = bar.querySelector('button, a');
        frames.push({
          bar: rel(bar.getBoundingClientRect(), sr),
          btn: btn ? rel(btn.getBoundingClientRect(), sr) : null,
          bodyW: Math.round(body.getBoundingClientRect().width * 100) / 100,
          surfW: Math.round(sr.width * 100) / 100,
          sbar: body.offsetWidth - body.clientWidth,
          docSbar: window.innerWidth - document.documentElement.clientWidth,
          docY: Math.round(window.scrollY),
        });
      }
      if (window.__dpFramesOn) {
        requestAnimationFrame(tick);
      }
    };
    tick();
  });
}

async function stopFrames(page) {
  return page.evaluate(() => {
    window.__dpFramesOn = false;
    return window.__dpFrames;
  });
}

const distinct = (frames, pick) => new Set(frames.map((f) => JSON.stringify(pick(f)))).size;

for (const mode of MODES) {
  test.describe(`Android klavye benzetimi: ${mode}`, () => {
    test.use({ viewport: { width: 412, height: 780 } });
    test.beforeEach(({ browserName }, info) => {
      void browserName;
      test.skip(info.project.name === 'desktop', 'dokunmatik olmayan masaüstü projesinde ekran klavyesi yok');
    });

    test('dokun/yaz/alanlar arası geçiş/boş yere dokun: düğme sabit, scrollbar girmez, alan örtülmez', async ({ page }) => {
      await installAndroidKeyboardSim(page, { mode });
      const fields = await openDetails(page);
      test.skip(fields.length < 2, 'bilgiler adımında en az 2 metin alanı yok');
      await startFrames(page);

      const jumps = [];
      for (let i = 0; i < fields.length; i += 1) {
        await fields[i].tap();
        await page.waitForTimeout(i === 0 ? 1200 : 700);
        await fields[i].pressSequentially('Ab', { delay: 30 });
        const m = await fields[i].evaluate((el) => {
          const vv = window.visualViewport;
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const body = document.querySelector('.donation-panel-surface__body');
          return {
            kb: document.querySelector('[data-dp-exp]').getAttribute('data-dp-kb'),
            fieldBottom: Math.round(r.bottom), fieldTop: Math.round(r.top),
            visBottom: Math.round(vv.offsetTop + vv.height),
            covered: Boolean(hit && hit.closest('.donation-panel-actionbar')),
            bodyH: Math.round(body.getBoundingClientRect().height),
          };
        });
        jumps.push(m);
        expect(m.kb, `alan ${i}: kb açık ${JSON.stringify(m)}`).toBe('1');
        expect(m.covered, `alan ${i} sabit bölüm altında ${JSON.stringify(m)}`).toBe(false);
        expect(m.fieldBottom, `alan ${i} klavye altında ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.visBottom - 12);
        expect(m.fieldTop, `alan ${i} üstte taştı ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(0);
        expect(m.bodyH, `gövde çok dar ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(100);
      }
      // Boş yere dokun: odak alandan çıkar (başlığa), klavye kapanır.
      await page.locator('[data-dp-title]').tap();
      await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
      await expect.poll(async () => page.evaluate(() => window.__dpKbSim.keyboardUp), { timeout: 5000 }).toBe(false);
      await page.waitForTimeout(1200);
      const frames = await stopFrames(page);
      const trace = {
        mode, frames: frames.length,
        barRects: distinct(frames, (f) => f.bar), btnRects: distinct(frames, (f) => f.btn),
        bodyWidths: distinct(frames, (f) => f.bodyW), surfaceWidths: distinct(frames, (f) => f.surfW),
        bodySbar: distinct(frames, (f) => f.sbar), docSbar: distinct(frames, (f) => f.docSbar), docY: distinct(frames, (f) => f.docY),
      };
      console.log(`KBD-AND ${JSON.stringify(trace)}`);
      expect(frames.length, 'yeterli kare').toBeGreaterThan(60);
      expect(trace.barRects, `alt bölüm konum/genişlik ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.btnRects, `düğme konum/genişlik ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.bodyWidths, `gövde genişliği ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.surfaceWidths, `yüzey genişliği ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.bodySbar, `gövde scrollbar girip çıktı ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.docSbar, `sayfa scrollbar girip çıktı ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.docY, `sayfa kaydı sıçradı ${JSON.stringify(trace)}`).toBe(1);
    });

    test('klavye kapanışı: alan odakta kalsa da (geri hareketi) alt bölüm sallanmaz', async ({ page }) => {
      await installAndroidKeyboardSim(page, { mode });
      const fields = await openDetails(page);
      test.skip(fields.length < 1, 'metin alanı yok');
      await fields[0].tap();
      await expect.poll(async () => page.evaluate(() => window.__dpKbSim.keyboardUp)).toBe(true);
      await page.waitForTimeout(900);
      await startFrames(page);
      await page.evaluate(() => window.__dpAndroidKbClose()); // alan odakta kalır
      await expect.poll(async () => page.evaluate(() => window.__dpKbSim.keyboardUp), { timeout: 5000 }).toBe(false);
      await page.waitForTimeout(1200);
      const frames = await stopFrames(page);
      const trace = { mode, frames: frames.length, barRects: distinct(frames, (f) => f.bar), btnRects: distinct(frames, (f) => f.btn), bodyWidths: distinct(frames, (f) => f.bodyW), surfaceWidths: distinct(frames, (f) => f.surfW), docSbar: distinct(frames, (f) => f.docSbar) };
      console.log(`KBD-AND-KAPANIS ${JSON.stringify(trace)}`);
      expect(frames.length).toBeGreaterThan(20);
      expect(trace.barRects, JSON.stringify(trace)).toBe(1);
      expect(trace.btnRects, JSON.stringify(trace)).toBe(1);
      expect(trace.bodyWidths, JSON.stringify(trace)).toBe(1);
      expect(trace.surfaceWidths, JSON.stringify(trace)).toBe(1);
      expect(trace.docSbar, JSON.stringify(trace)).toBe(1);
    });
  });
}
