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

/** `data-dp-kb` öznitelik değişimlerini zaman damgasıyla kaydeder (çağrı anından itibaren). */
function watchKbAttr(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-dp-exp]');
    const log = [];
    window.__dpKbLog = log;
    window.__dpKbT0 = performance.now();
    new MutationObserver(() => {
      log.push({ t: Math.round(performance.now() - window.__dpKbT0), kb: root.hasAttribute('data-dp-kb') });
    }).observe(root, { attributes: true, attributeFilter: ['data-dp-kb'] });
  });
}

/** Alt bölüm düğmesi gerçekten dokunulabilir mi: opacity 1, inert değil, merkezindeki öğe düğmenin kendisi. */
function barTappable(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('.donation-panel-actionbar');
    const btn = bar && bar.querySelector('[data-dp-submit]');
    if (!btn) {
      return { ok: false, why: 'düğme yok', opacity: '' };
    }
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const opacity = getComputedStyle(bar).opacity;
    return { ok: !bar.hasAttribute('inert') && opacity === '1' && Boolean(hit && btn.contains(hit)), inert: bar.hasAttribute('inert'), opacity };
  });
}

test.describe('Ekran klavyesi gelmeyen dokunmatik cihaz (fiziksel klavyeli tablet) ve yavaş klavye', () => {
  test.use({ viewport: { width: 412, height: 780 } });
  test.beforeEach(({ browserName }, info) => {
    void browserName;
    test.skip(info.project.name === 'desktop', 'dokunmatik olmayan masaüstü projesinde alt bölüm hiç gizlenmez');
  });

  /**
   * Klavyesiz cihaz akışı: alan 0'a dokun, (isteğe bağlı) hemen yaz; bölümün görünmesini bekle; alan 1'e geç ve yaz
   * (bölüm görünür kalır); düğmeye dokun. Dönüş: kb durum izi (dokunuştan önce), kare izi.
   */
  async function noKeyboardFlow(page, fields, { typeFirst }) {
    await watchKbAttr(page);
    await startFrames(page);
    await fields[0].tap();
    if (typeFirst) {
      await fields[0].pressSequentially('Ab', { delay: 30 });
    } else {
      await page.waitForTimeout(600);
      // Yazılmadıkça bekleme penceresinde (klavye henüz gelebilir) mevcut davranış: gizli.
      expect(await page.locator('[data-dp-exp]').getAttribute('data-dp-kb'), '600 ms, yazma yok: hâlâ gizli').toBe('1');
    }
    await expect(page.locator('[data-dp-exp]')).not.toHaveAttribute('data-dp-kb', '1', { timeout: 4000 });
    await expect.poll(() => barTappable(page).then((x) => x.ok), { timeout: 2000 }).toBe(true);
    // Alan değişimi ve yazma: bölüm görünür kalır (katman ömrü boyunca fiziksel klavye bilgisi).
    await fields[1].tap();
    await fields[1].pressSequentially('Cd', { delay: 30 });
    await page.waitForTimeout(2500);
    expect((await barTappable(page)).ok, 'ikinci alanda dokunulabilir').toBe(true);
    const log = (await page.evaluate(() => window.__dpKbLog)).slice();
    const frames = await stopFrames(page);
    // Düğmeye gerçekten dokunulur (dokunuş düğmeye ulaşır).
    await page.evaluate(() => {
      window.__dpBtnClicks = 0;
      document.querySelector('.donation-panel-actionbar [data-dp-submit]').addEventListener('click', () => { window.__dpBtnClicks += 1; }, { capture: true, once: true });
    });
    await page.locator('.donation-panel-actionbar [data-dp-submit]').tap();
    expect(await page.evaluate(() => window.__dpBtnClicks), 'dokunuş düğmeye ulaştı').toBe(1);
    // Tam iki durum değişimi (odakta gizle → göster); ikinci alanda tekrar gizleme yok. Yalnız opacity: kutular tek değer.
    expect(log.map((x) => x.kb), JSON.stringify(log)).toEqual([true, false]);
    expect(frames.length, 'yeterli kare').toBeGreaterThan(60);
    expect(distinct(frames, (f) => f.bar), 'alt bölüm kutusu').toBe(1);
    expect(distinct(frames, (f) => f.btn), 'düğme kutusu').toBe(1);
    return log;
  }

  test('fiziksel klavye (yazma var, görünür alan sabit): alt bölüm ilk tuşta görünür ve dokunulabilir', async ({ page }) => {
    await installAndroidKeyboardSim(page, { mode: 'none' });
    const fields = await openDetails(page);
    test.skip(fields.length < 2, 'bilgiler adımında en az 2 metin alanı yok');
    const log = await noKeyboardFlow(page, fields, { typeFirst: true });
    console.log(`KBD-PHYS ${JSON.stringify(log)}`);
    // Zamanlayıcı beklenmez: görünme, yazmayla (yedek süreden çok önce).
    expect(log[1].t - log[0].t, `görünme gecikmesi ${JSON.stringify(log)}`).toBeLessThan(800);
  });

  test('yazılmayan + klavye açılmayan: yedek zamanlayıcıyla (~2 sn) tek seferde görünür ve dokunulabilir', async ({ page }) => {
    await installAndroidKeyboardSim(page, { mode: 'none' });
    const fields = await openDetails(page);
    test.skip(fields.length < 2, 'bilgiler adımında en az 2 metin alanı yok');
    const log = await noKeyboardFlow(page, fields, { typeFirst: false });
    console.log(`KBD-NOKB ${JSON.stringify(log)}`);
    expect(log[1].t - log[0].t, `görünme gecikmesi ${JSON.stringify(log)}`).toBeGreaterThanOrEqual(1950);
    expect(log[1].t - log[0].t, `görünme gecikmesi ${JSON.stringify(log)}`).toBeLessThanOrEqual(2800);
  });

  for (const slow of [
    { name: 'tek adımda 1 sn gecikmeli klavye', opts: { mode: 'visual', delay: 1000 } },
    { name: 'yavaş animasyonlu klavye (0,5→1,7 sn, 7 adım)', opts: { mode: 'visual', delay: 500, steps: 7, stepMs: 200 } },
    { name: 'resizes-content, 1 sn gecikmeli', opts: { mode: 'content', delay: 1000 } },
    { name: 'çok yavaş: 1,8 sn gecikmeli (yedek süreye yakın)', opts: { mode: 'visual', delay: 1800 } },
  ]) {
    test(`yavaş klavye: ${slow.name} — düğme hiç erken görünmez, durum tek değer`, async ({ page }) => {
      await installAndroidKeyboardSim(page, slow.opts);
      const fields = await openDetails(page);
      test.skip(fields.length < 1, 'metin alanı yok');
      await watchKbAttr(page);
      await startFrames(page);
      await fields[0].tap();
      // Gizleme geçişi (opacity .12 s) bittikten sonra 3,5 sn boyunca 100 ms aralıkla: bölüm hiç görünür/dokunulabilir olmamalı.
      await page.waitForTimeout(200);
      const visibleAt = [];
      for (let i = 0; i < 35; i += 1) {
        await page.waitForTimeout(100);
        const s = await barTappable(page);
        if (s.ok || s.opacity !== '0') {
          visibleAt.push({ i, ...s });
        }
      }
      expect(await page.evaluate(() => window.__dpKbSim.keyboardUp), 'klavye açıldı').toBe(true);
      // Klavye açıldıktan sonra yazma (gerçek kullanıcı): sanal klavyede bölüm gizli kalır.
      await fields[0].pressSequentially('Ab', { delay: 30 });
      await page.waitForTimeout(300);
      const afterType = await barTappable(page);
      if (afterType.ok || afterType.opacity !== '0') {
        visibleAt.push({ i: 'yazma', ...afterType });
      }
      const log = await page.evaluate(() => window.__dpKbLog);
      const frames = await stopFrames(page);
      console.log(`KBD-SLOW ${slow.name} ${JSON.stringify(log)} görünür=${visibleAt.length}`);
      expect(visibleAt, JSON.stringify(visibleAt)).toEqual([]);
      expect(log.map((x) => x.kb), `kb durum izi tek değer ${JSON.stringify(log)}`).toEqual([true]);
      expect(distinct(frames, (f) => f.bar), 'alt bölüm kutusu').toBe(1);
    });
  }
});
