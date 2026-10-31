/**
 * 12.4 GERÇEK Android testi: emülatördeki (AVD wdp-pixel7-a35) gerçek Chrome + gerçek sanal klavye (Gboard).
 * Emülatör/adb yoksa test ATLANIR. Telefon bağlanmaz; yalnız yerel WP (`adb reverse`).
 * Çalıştırma: emülatör açıkken `WDP_LOCAL_E2E_PORT=9065 npm run e2e:experiences -- --spec gercek-android --project android`.
 * Bellek dar: emülatör çalışırken başka Playwright koşusu yapılmaz; iş bitince `adb emu kill`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { test, expect, chromium } from '@playwright/test';
import { adb, CHROME_PKG, connectAndroid, dismissChromeFirstRun, reversePort } from '../helpers/android-device.mjs';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const OUT = path.resolve('build/android');
const FIELD_SEL = '[data-dp-step="details"] :is(input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), textarea:not([disabled]))';

test.describe('gerçek Android Chrome (emülatör)', () => {
  test('gerçek klavye: dokun/yaz/alanlar arası geçiş/boş yere dokun; alt bölüm ve düğme sabit', async () => {
    test.setTimeout(240000);
    const conn = await connectAndroid();
    test.skip(!conn, 'ATLANDI: adb/Android emülatörü yok (AVD wdp-pixel7-a35 başlatılmadı).');
    const { device, serial } = conn;
    const base = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:8911');
    expect(reversePort(serial, base.port), 'adb reverse').toBe(true);
    adb(['shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1'], serial);
    fs.mkdirSync(OUT, { recursive: true });
    const remote = '/sdcard/wdp-gercek-android.mp4';
    const rec = spawn('adb', ['-s', serial, 'shell', 'screenrecord', '--time-limit', '60', remote], { stdio: 'ignore' });

    const step = (m) => console.log(`ADIM ${Date.now() % 1000000} ${m}`);
    dismissChromeFirstRun(serial);
    step('launch');
    // Gerçek Chrome: am start + adb forward (devtools soketi) + CDP (Playwright launchBrowser Chrome 124'te takılıyor).
    adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'about:blank', CHROME_PKG], serial);
    await new Promise((r) => setTimeout(r, 3000));
    expect(adb(['forward', 'tcp:9333', 'localabstract:chrome_devtools_remote'], serial).ok, 'adb forward').toBe(true);
    let browser = null;
    for (let i = 0; i < 10 && !browser; i += 1) {
      try {
        await fetch('http://127.0.0.1:9333/json/version');
        browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    expect(browser, 'CDP bağlantısı').not.toBeNull();
    const context = browser.contexts()[0];
    step('launched');
    try {
      const page = context.pages()[0] || (await context.newPage());
      step('newPage');
      await page.goto(`http://127.0.0.1:${base.port}/?dp_exp_test=popup&dp_product=${PRODUCT}`);
      step('goto');
      await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 30000 });
      step('mounted');
      // Gerçek dokunuş: adb input tap (CSS px → cihaz px; Chrome üst çubuğu kayması bir dokunuşla ölçülür).
      await page.evaluate(() => {
        window.__dpTouch = null;
        window.addEventListener('touchstart', (e) => { window.__dpTouch = [e.touches[0].clientX, e.touches[0].clientY]; }, { capture: true, passive: true });
      });
      let calib = { t: null, dpr: 1 };
      for (let k = 0; k < 5 && !calib.t; k += 1) {
        adb(['shell', 'input', 'tap', '540', '1200'], serial);
        await page.waitForTimeout(900);
        calib = await page.evaluate(() => ({ t: window.__dpTouch, dpr: window.devicePixelRatio }));
      }
      expect(calib.t, 'dokunuş kalibrasyonu').not.toBeNull();
      const offY = 1200 - calib.t[1] * calib.dpr;
      const tap = async (loc) => {
        // Kullanıcı gibi: hedef klavyenin altında kaldıysa önce gövdeyi kaydırır (görünür alanın ortasına).
        await loc.evaluate((el) => {
          const vv = window.visualViewport;
          const r = el.getBoundingClientRect();
          if (r.bottom > vv.offsetTop + vv.height - 8 || r.top < vv.offsetTop) {
            el.scrollIntoView({ block: 'center' });
          }
        });
        await page.waitForTimeout(250);
        const b = await loc.boundingBox();
        adb(['shell', 'input', 'tap', String(Math.round((b.x + b.width / 2) * calib.dpr)), String(Math.round((b.y + b.height / 2) * calib.dpr + offY))], serial);
        await page.waitForTimeout(150);
      };
      await tap(page.locator('[data-dp-open]'));
      step('tapped open');
      await expect(page.locator('[data-dp-overlay]')).toHaveClass(/is-open/);
      await page.waitForTimeout(900);
      const surface = page.locator('[data-dp-surface]');
      const preset = surface.locator('[data-dp-preset]').first();
      if (await preset.count()) {
        await tap(preset);
      } else {
        await surface.locator('input[name="amount"]:not([type="hidden"])').fill('25');
      }
      await tap(surface.locator('[data-dp-submit]').first());
      await expect(surface.locator('[data-dp-step="details"]')).toBeVisible();
      await page.waitForTimeout(600);
      const all = page.locator(FIELD_SEL);
      const fields = [];
      for (let i = 0; i < (await all.count()) && fields.length < 3; i += 1) {
        if (await all.nth(i).isVisible()) {
          fields.push(all.nth(i));
        }
      }
      expect(fields.length, 'bilgiler adımında metin alanı').toBeGreaterThan(1);

      const env = await page.evaluate(() => ({ ih: window.innerHeight, vv: window.visualViewport.height, dpr: window.devicePixelRatio, ua: navigator.userAgent.match(/Chrome\/[\d.]+/)[0] }));
      await page.evaluate(() => {
        const frames = [];
        window.__dpFrames = frames;
        window.__dpFramesOn = true;
        window.__dpVv = [];
        window.visualViewport.addEventListener('resize', () => window.__dpVv.push([Math.round(performance.now()), window.innerHeight, Math.round(window.visualViewport.height), Math.round(window.visualViewport.offsetTop)]));
        const rel = (r, s) => [Math.round(r.left * 100) / 100, Math.round(r.width * 100) / 100, Math.round((s.bottom - r.bottom) * 100) / 100, Math.round(r.height * 100) / 100];
        const tick = () => {
          const s = document.querySelector('[data-dp-surface]');
          const bar = document.querySelector('.donation-panel-actionbar');
          const body = document.querySelector('.donation-panel-surface__body');
          if (s && bar && body) {
            const sr = s.getBoundingClientRect();
            const btn = bar.querySelector('button, a');
            frames.push({
              bar: rel(bar.getBoundingClientRect(), sr), btn: btn ? rel(btn.getBoundingClientRect(), sr) : null,
              bodyW: Math.round(body.getBoundingClientRect().width * 100) / 100, surfW: Math.round(sr.width * 100) / 100,
              sbar: body.offsetWidth - body.clientWidth, docSbar: window.innerWidth - document.documentElement.clientWidth, docY: Math.round(window.scrollY),
            });
          }
          if (window.__dpFramesOn) {
            requestAnimationFrame(tick);
          }
        };
        tick();
      });

      const keyboardShown = () => adb(['shell', 'dumpsys', 'input_method'], serial).out.includes('mInputShown=true');
      const perField = [];
      for (let i = 0; i < fields.length; i += 1) {
        step(`alan ${i} dokun`);
        await tap(fields[i]);
        await page.waitForTimeout(i === 0 ? 2500 : 1500);
        adb(['shell', 'input', 'text', 'Ab'], serial);
        await page.waitForTimeout(400);
        const m = await fields[i].evaluate((el) => {
          const vv = window.visualViewport;
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return {
            ih: window.innerHeight, vv: Math.round(vv.height), offTop: Math.round(vv.offsetTop),
            sT: Math.round(el.closest('.donation-panel-surface__body').scrollTop),
            sMax: Math.round(el.closest('.donation-panel-surface__body').scrollHeight - el.closest('.donation-panel-surface__body').clientHeight),
            bodyBottom: Math.round(el.closest('.donation-panel-surface__body').getBoundingClientRect().bottom),
            kb: document.querySelector('[data-dp-exp]').getAttribute('data-dp-kb'),
            fieldBottom: Math.round(r.bottom), visBottom: Math.round(vv.offsetTop + vv.height),
            covered: Boolean(hit && hit.closest('.donation-panel-actionbar')), val: el.value.length,
          };
        });
        m.imeShown = keyboardShown();
        perField.push(m);
      }
      // Boş yere dokun: başlığa dokun (alan odağı kaybeder), klavye kapanır.
      await tap(page.locator('[data-dp-title]'));
      await page.waitForTimeout(2500);
      const closedVv = await page.evaluate(() => ({ ih: window.innerHeight, vv: Math.round(window.visualViewport.height) }));
      const imeAfter = keyboardShown();
      const frames = await page.evaluate(() => {
        window.__dpFramesOn = false;
        return window.__dpFrames;
      });
      const vvLog = await page.evaluate(() => window.__dpVv);
      const distinct = (pick) => new Set(frames.map((f) => JSON.stringify(pick(f)))).size;
      const trace = {
        env, frames: frames.length, vvResizes: vvLog.length, perField, closedVv, imeAfter,
        barRects: distinct((f) => f.bar), btnRects: distinct((f) => f.btn), bodyWidths: distinct((f) => f.bodyW),
        surfaceWidths: distinct((f) => f.surfW), bodySbar: distinct((f) => f.sbar), docSbar: distinct((f) => f.docSbar), docY: distinct((f) => f.docY),
      };
      fs.writeFileSync(path.join(OUT, 'gercek-android-iz.json'), JSON.stringify({ trace, vvLog, barSet: [...new Set(frames.map((f) => JSON.stringify(f.bar)))] }, null, 2));
      console.log(`KBD-GERCEK ${JSON.stringify(trace)}`);
      await page.screenshot({ path: path.join(OUT, 'gercek-android-son.png') });

      expect(perField.some((m) => m.imeShown), `gerçek sanal klavye açılmadı ${JSON.stringify(perField)}`).toBe(true);
      for (const [i, m] of perField.entries()) {
        expect(m.covered, `alan ${i} sabit bölüm altında ${JSON.stringify(m)}`).toBe(false);
        expect(m.fieldBottom, `alan ${i} klavye altında ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.visBottom - 12); // alanın altı ile klavye arasında en az 12 px
      }
      expect(imeAfter, 'klavye kapanmadı').toBe(false);
      expect(trace.barRects, `alt bölüm konum/genişlik ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.btnRects, `düğme ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.bodyWidths, `gövde genişliği ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.surfaceWidths, `yüzey genişliği ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.bodySbar, `gövde scrollbar ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.docSbar, `sayfa scrollbar ${JSON.stringify(trace)}`).toBe(1);
      expect(trace.docY, `sayfa kayması ${JSON.stringify(trace)}`).toBe(1);
    } finally {
      await browser.close().catch(() => {});
      adb(['shell', 'am', 'force-stop', CHROME_PKG], serial);
      adb(['shell', 'pkill', '-2', 'screenrecord'], serial);
      await new Promise((r) => setTimeout(r, 1500));
      rec.kill();
      adb(['pull', remote, path.join(OUT, 'gercek-android.mp4')], serial);
      adb(['shell', 'rm', '-f', remote], serial);
      await device.close().catch(() => {});
      adb(['forward', '--remove', 'tcp:9333'], serial);
    }
  });
});
