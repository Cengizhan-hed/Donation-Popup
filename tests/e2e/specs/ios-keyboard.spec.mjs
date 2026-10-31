/**
 * 12.1 iOS klavye benzetimi: gerçek iPhone'da görülen "klavye zıplıyor" ve "sabit düğmeler alanları kapatıyor" sorunları.
 * Benzetim: tests/e2e/helpers/ios-keyboard-sim.mjs (visualViewport sahte; innerHeight değişmez; Safari kaydırması).
 * YALNIZ yerel WP + iPhone (WebKit) projesi: `npm run e2e:experiences -- --spec ios-keyboard --project iphone`.
 * Sınır: gerçek cihaz/Simülatör ön-sürüm kontrolü kullanıcıdadır (docs/MIMARI.md).
 */
import { test, expect } from '@playwright/test';
import { installIosKeyboardSim, readSim } from '../helpers/ios-keyboard-sim.mjs';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const SIZES = [
  { name: 'iPhone 13', width: 390, height: 844 },
  { name: 'iPhone SE', width: 375, height: 667 },
];
const FIELD_SEL = '[data-dp-step="details"] :is(input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), textarea:not([disabled]))';

/**
 * Bilgiler adımına gelir (tutar seç → devam).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<import('@playwright/test').Locator[]>} Görünür metin alanları (en fazla 3).
 */
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

/**
 * Ölçüm: odaktaki alanın görünür alanda ve örtülmemiş olması; gövde (kaydırma alanı) yüksekliği.
 *
 * @param {import('@playwright/test').Locator} field Alan.
 * @return {Promise<object>} Sonuç.
 */
function measureField(field) {
  return field.evaluate((el) => {
    const vv = window.visualViewport;
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const wrap = el.closest('.donation-panel-field') || el.parentElement;
    const body = document.querySelector('.donation-panel-surface__body');
    return {
      topOfVisible: vv.offsetTop,
      bottomOfVisible: vv.offsetTop + vv.height,
      fieldTop: Math.round(r.top),
      fieldBottom: Math.round(r.bottom),
      coveredByBar: Boolean(top && top.closest('.donation-panel-actionbar')),
      centerHit: Boolean(top && (top === el || wrap.contains(top))),
      bodyHeight: Math.round(body.getBoundingClientRect().height),
    };
  });
}

for (const size of SIZES) {
  test.describe(`iOS klavye benzetimi: ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('Ad Soyad → Telefon → Not: kb bir kez açılır, titremez, alan örtülmez, kapanınca çubuk döner', async ({ page }) => {
      await installIosKeyboardSim(page);
      const fields = await openDetails(page);
      test.skip(fields.length < 2, 'bilgiler adımında en az 2 metin alanı yok');

      await page.evaluate(() => {
        const root = document.querySelector('[data-dp-exp]');
        window.__dpKbAttr = { on: 0, off: 0 };
        new MutationObserver(() => {
          window.__dpKbAttr[root.hasAttribute('data-dp-kb') ? 'on' : 'off'] += 1;
        }).observe(root, { attributes: true, attributeFilter: ['data-dp-kb'] });
        window.__dpFixedBody = false;
        const chk = () => {
          if (getComputedStyle(document.body).position === 'fixed' || getComputedStyle(document.documentElement).position === 'fixed') {
            window.__dpFixedBody = true;
          }
          requestAnimationFrame(chk);
        };
        chk();
      });

      // (i) İlk alan: kb açılır; 3 sn boyunca 150 ms aralıkla durum + kaydırma örneklenir.
      await fields[0].focus();
      await expect.poll(async () => (await readSim(page)).keyboardUp).toBe(true);
      const samples = [];
      for (let i = 0; i < 20; i += 1) {
        samples.push(await page.evaluate(() => ({
          kb: document.querySelector('[data-dp-exp]').hasAttribute('data-dp-kb'),
          st: Math.round(document.querySelector('.donation-panel-surface__body').scrollTop),
        })));
        await page.waitForTimeout(150);
      }
      const kbChanges = samples.filter((s, i) => i > 0 && s.kb !== samples[i - 1].kb).length;
      const stChanges = samples.filter((s, i) => i > 0 && s.st !== samples[i - 1].st).length;
      expect(kbChanges, `kb durum değişimi ${JSON.stringify(samples.map((s) => +s.kb))}`).toBeLessThanOrEqual(2);
      expect(stChanges, `scrollTop değişimi ${JSON.stringify(samples.map((s) => s.st))}`).toBeLessThanOrEqual(2);
      expect(samples[samples.length - 1].kb).toBe(true);

      // (ii)(iii)(v) alandan alana geçiş.
      const offBefore = (await page.evaluate(() => window.__dpKbAttr)).off;
      for (let i = 0; i < fields.length; i += 1) {
        const before = (await readSim(page)).scrollIntoView;
        await fields[i].focus();
        await page.waitForTimeout(900);
        const m = await measureField(fields[i]);
        const after = (await readSim(page)).scrollIntoView;
        expect(m.coveredByBar, `alan ${i} sabit çubuk altında ${JSON.stringify(m)}`).toBe(false);
        expect(m.centerHit, `alan ${i} merkezinde başka öğe ${JSON.stringify(m)}`).toBe(true);
        expect(m.fieldBottom, `alan ${i} klavyenin altında ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.bottomOfVisible - 8);
        expect(m.fieldTop, `alan ${i} görünür alanın üstünde ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(m.topOfVisible);
        expect(m.bodyHeight, `kaydırma alanı çok dar ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(120);
        expect(after - before, `alan ${i}: scrollIntoView sayısı`).toBeLessThanOrEqual(1);
        expect(await page.locator('[data-dp-exp]').getAttribute('data-dp-kb'), `alan ${i}: kb açık kalmalı`).toBe('1');
      }
      const offAfter = (await page.evaluate(() => window.__dpKbAttr)).off;
      expect(offAfter - offBefore, 'alandan alana geçişte kb kapanıp açılmamalı').toBe(0);

      // (vii) body/html position:fixed yok.
      expect(await page.evaluate(() => window.__dpFixedBody)).toBe(false);

      // (iv) klavye kapanınca alt çubuk eski yerine döner.
      await fields[fields.length - 1].blur();
      await expect.poll(async () => (await readSim(page)).keyboardUp, { timeout: 5000 }).toBe(false);
      await expect(page.locator('[data-dp-exp]')).not.toHaveAttribute('data-dp-kb', '1', { timeout: 5000 });
      await expect
        .poll(() => page.evaluate(() => !document.querySelector('.donation-panel-actionbar').closest('.donation-panel-surface__body')), { timeout: 5000 })
        .toBe(true);
    });

    test('12.4: klavye kapanışında alt bölüm ve düğme kare kare konum/genişlik değiştirmez', async ({ page }) => {
      await installIosKeyboardSim(page);
      const fields = await openDetails(page);
      test.skip(fields.length < 1, 'bilgiler adımında metin alanı yok');
      await fields[0].focus();
      await expect.poll(async () => (await readSim(page)).keyboardUp).toBe(true);
      await page.waitForTimeout(900);
      // rAF örnekleme: alt bölüm/düğme/gövde; konum yüzey alt kenarına göre (yüzeyin klavyeyle inip çıkması hariç).
      await page.evaluate(() => {
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
            });
          }
          if (window.__dpFramesOn) {
            requestAnimationFrame(tick);
          }
        };
        tick();
      });
      await fields[0].blur();
      await expect.poll(async () => (await readSim(page)).keyboardUp, { timeout: 5000 }).toBe(false);
      await page.waitForTimeout(1200);
      const frames = await page.evaluate(() => {
        window.__dpFramesOn = false;
        return window.__dpFrames;
      });
      const distinct = (pick) => new Set(frames.map((f) => JSON.stringify(pick(f)))).size;
      const trace = { frames: frames.length, barRects: distinct((f) => f.bar), btnRects: distinct((f) => f.btn), bodyWidths: distinct((f) => f.bodyW), surfaceWidths: distinct((f) => f.surfW) };
      console.log(`KBD-IZ ${size.name} ${JSON.stringify(trace)}`);
      expect(frames.length, 'yeterli kare örneklendi').toBeGreaterThan(20);
      expect(trace.barRects, `alt bölüm konum/genişlik ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.btnRects, `düğme konum/genişlik ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.bodyWidths, `gövde genişliği ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.surfaceWidths, `yüzey genişliği ${JSON.stringify(trace)}`).toBe(1);
    });

    test('giriş alanlarında yazı boyutu en az 16px (iOS odak yakınlaşması yok)', async ({ page }) => {
      await installIosKeyboardSim(page);
      await openDetails(page);
      const small = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.donation-panel input, .donation-panel select, .donation-panel textarea'))
          .filter((el) => !['checkbox', 'radio', 'hidden', 'button', 'submit'].includes(el.type))
          .map((el) => ({ name: el.name || el.className, fs: parseFloat(getComputedStyle(el).fontSize) }))
          .filter((x) => x.fs < 16)
      );
      expect(small).toEqual([]);
    });
  });
}
