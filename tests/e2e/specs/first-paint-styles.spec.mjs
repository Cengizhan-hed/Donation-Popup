/**
 * 12.2 fouc (CLAUDE.md §25): ilk boyamada görünen hiçbir eklenti öğesi bir kare bile stilsiz görünemez.
 * YALNIZ yerel WP: `npm run e2e:queue -- node tests/e2e/run-first-paint.mjs [--theme X] [--project Y]`.
 *
 * Yöntem (tema-bağımsız; yalnız eklentinin `.donation-panel` / data-* işaretleri):
 *  - Eklentinin TÜM CSS dosyası istekleri 3000 ms geciktirilir (route); Chromium'da ek olarak yavaş 4G + 4× CPU (CDP).
 *  - Sayfa betiklerinden önce çalışan init betiği her `requestAnimationFrame`'de (boyamadan hemen önce) görünür eklenti
 *    öğelerini bulur; bir öğe İLK görünür olduğu karede hesaplanmış stilleri denetlenir (tutar kartı köşe/yükseklik, düğme
 *    arka planı = jeton rengi, alan ≥48, adet düğmesi ≥44, liste düzeni grid/flex, simge boyutu…).
 *  - Slider benzetimi (gizli kap 500 ms sonra görünür) ve AJAX benzetimi (kısa kod HTML'i fetch + innerHTML) ayrıca.
 *  - Panel: CSS isteği 3000 ms gecikmeliyken dokunuştan görünür, stilli panele <100 ms.
 */
import { test, expect } from '@playwright/test';

const IDS = JSON.parse(process.env.WDP_FP_IDS || '{"product":0,"fixed":0,"campaign":0}');
const q = (view) => `/?dp_fp=${view}&dp_product=${IDS.product}&dp_fixed=${IDS.fixed}&dp_campaign=${IDS.campaign}`;
const CSS_DELAY_MS = 3000;

/**
 * Eklenti CSS dosyalarını geciktirir; Chromium'da yavaş ağ + 4× CPU.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {import('@playwright/test').BrowserContext} context Bağlam.
 * @param {string} browserName Tarayıcı.
 */
async function slowDown(page, context, browserName) {
  await page.route(/\/woo-donation-popup\/.*\.css(\?|$)/, async (route) => {
    await new Promise((r) => setTimeout(r, CSS_DELAY_MS));
    await route.continue();
  });
  if (browserName === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }
}

/**
 * Sayfa betiklerinden önce: her karede ilk kez görünen eklenti öğesini denetler, sonucu `window.__fp`'ye yazar.
 */
function installProbe() {
  const state = { results: {}, frames: 0 };
  window.__fp = state;
  const px = (v) => parseFloat(v) || 0;
  const transparent = (c) => !c || c === 'transparent' || /rgba\(0, 0, 0, 0\)/.test(c);
  /** Öğe bağlamında bir CSS değişkeninin çözülmüş arka plan rengi (jeton). */
  const token = (el, name) => {
    const probe = document.createElement('i');
    probe.style.cssText = `position:absolute;inline-size:0;block-size:0;background:var(${name})`;
    el.appendChild(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  };
  const shown = (el) => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    return typeof el.checkVisibility === 'function' ? el.checkVisibility({ visibilityProperty: true, opacityProperty: false }) : true;
  };
  const box = (el) => el.getBoundingClientRect();
  const svgOk = (el) => {
    const s = el.querySelector('svg');
    if (!s) return true;
    const r = s.getBoundingClientRect();
    return r.width <= 32 && r.height <= 32;
  };
  const amount = (el) => {
    const cs = getComputedStyle(el);
    return { ok: px(cs.borderTopLeftRadius) > 0 && box(el).height >= 44, info: `r=${cs.borderTopLeftRadius} h=${Math.round(box(el).height)}` };
  };
  const field = (el) => ({ ok: box(el).height >= 48, info: `h=${Math.round(box(el).height)}` });
  const primary = (el) => {
    const cs = getComputedStyle(el);
    const want = token(el, '--_bg');
    return {
      ok: !transparent(want) && cs.backgroundColor === want && box(el).height >= 44,
      info: `bg=${cs.backgroundColor} jeton=${want} h=${Math.round(box(el).height)}`,
    };
  };
  const stepper = (el) => ({ ok: box(el).width >= 44 && box(el).height >= 44, info: `${Math.round(box(el).width)}x${Math.round(box(el).height)}` });
  const icon = (el) => ({ ok: box(el).width <= 32 && box(el).height <= 32, info: `${Math.round(box(el).width)}x${Math.round(box(el).height)}` });
  const roundBtn = (el) => {
    const cs = getComputedStyle(el);
    return {
      ok: box(el).width >= 40 && box(el).height >= 40 && px(cs.borderTopLeftRadius) > 0 && svgOk(el),
      info: `${Math.round(box(el).width)}x${Math.round(box(el).height)} r=${cs.borderTopLeftRadius} svg=${svgOk(el)}`,
    };
  };
  const bar = (el) => {
    const cs = getComputedStyle(el);
    const h = box(el).height;
    return {
      ok: h >= 4 && h <= 32 && px(cs.borderTopLeftRadius) > 0 && !transparent(cs.backgroundColor),
      info: `h=${Math.round(h)} r=${cs.borderTopLeftRadius} bg=${cs.backgroundColor}`,
    };
  };
  const grid = (el) => {
    const d = getComputedStyle(el).display;
    return { ok: /grid|flex/.test(d), info: `display=${d}` };
  };
  const form = (scope) => [
    [`${scope} tutar kartı`, `${scope} .donation-panel-amount`, amount],
    [`${scope} tutar alanı`, `${scope} .donation-panel-custom`, field],
    [`${scope} ana düğme`, `${scope} .donation-panel-btn--accent`, primary],
    [`${scope} adet düğmesi`, `${scope} .donation-panel-stepper button`, stepper],
    [`${scope} metin alanı`, `${scope} .donation-panel-input`, field],
    [`${scope} simge`, `${scope} svg.donation-panel-ico`, icon],
  ];
  const CHECKS = [
    ['hesap simgesi', '.donation-panel-ac__trigger', roundBtn],
    ['yan sepet düğmesi', '.donation-panel-sc__trigger', roundBtn],
    ['tetikleyici düğme', '#fp-trigger [data-dp-open]', primary],
    ['kampanya çubuğu', '#fp-progress .donation-panel-bar', bar],
    ['kampanya rakamları', '#fp-progress .donation-panel-progress__nums', grid],
    ['liste düzeni', '#fp-list .wdp-list', grid],
    ...form('#fp-inline'),
    ...form('#fp-slider'),
    ...form('#fp-ajax'),
  ];
  const frame = () => {
    state.frames += 1;
    for (const [name, selector, fn] of CHECKS) {
      if (state.results[name]) continue;
      const el = Array.from(document.querySelectorAll(selector)).find(shown);
      if (!el) continue;
      let out;
      try {
        out = fn(el);
      } catch (e) {
        out = { ok: false, info: `hata: ${e && e.message}` };
      }
      state.results[name] = { ...out, frame: state.frames, t: Math.round(performance.now()) };
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/**
 * Sonuçları bekler (beklenen tüm adlar kaydedilene dek) ve döndürür.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string[]} names Beklenen denetim adları.
 * @return {Promise<Record<string, {ok: boolean, info: string, frame: number, t: number}>>} Sonuçlar.
 */
async function collect(page, names) {
  await page
    .waitForFunction((list) => list.every((n) => window.__fp && window.__fp.results[n]), names, { timeout: 20000 })
    .catch((e) => console.log(`FP_WAIT ${e.message.split('\n')[0]}`));
  return page.evaluate(() => window.__fp.results);
}

/**
 * Kaydedilen TÜM denetimler (zorunlu + o karede görünür olan isteğe bağlılar) ilk görünür karede stilli olmalı.
 *
 * @param {Record<string, {ok: boolean, info: string, frame: number}>} results Sonuçlar.
 * @param {string[]} names Zorunlu adlar (kaydedilmiş olmalı).
 */
function assertStyled(results, names) {
  const all = Object.keys(results);
  const bad = all.filter((n) => !results[n].ok).map((n) => `${n}: ${results[n].info} (kare ${results[n].frame})`);
  console.log(`FP_FRAMES ${JSON.stringify(Object.fromEntries(all.map((n) => [n, results[n].ok ? 'ok' : results[n].info])))}`);
  expect(
    names.filter((n) => !results[n]),
    'zorunlu yüzeyler görünmedi',
  ).toEqual([]);
  expect(bad, `ilk görünür karede stilsiz eklenti öğeleri:\n${bad.join('\n')}`).toEqual([]);
}

/** Serbest tutarlı ürün (tutar kartları + alan) ve sabit tutarlı ürün (adet seçici) için ilk adımda görünenler. */
const customNames = (scope) => [`${scope} tutar kartı`, `${scope} tutar alanı`, `${scope} ana düğme`, `${scope} simge`];
const fixedNames = (scope) => [`${scope} adet düğmesi`, `${scope} ana düğme`, `${scope} simge`];

test.describe('ilk boyama: eklenti öğeleri stilli (CSS dosyaları 3 sn gecikmeli)', () => {
  test.beforeEach(async ({ page, context, browserName }) => {
    test.setTimeout(150000);
    await page.addInitScript(installProbe);
    await slowDown(page, context, browserName);
  });

  test('tüm yüzeyler: hesap simgesi, yan sepet, tetikleyici, kampanya çubuğu, sayfa içi form, liste, slider, AJAX', async ({ page }, testInfo) => {
    await page.goto(q('page'), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await testInfo.attach('ilk-kare-domcontentloaded', { body: await page.screenshot(), contentType: 'image/png' });
    const names = [
      'hesap simgesi',
      'yan sepet düğmesi',
      'tetikleyici düğme',
      'kampanya çubuğu',
      'kampanya rakamları',
      'liste düzeni',
      ...customNames('#fp-inline'),
      ...fixedNames('#fp-slider'),
      ...fixedNames('#fp-ajax'),
    ];
    assertStyled(await collect(page, names), names);
  });

  test('slider benzetimi: yalnız gizli kapta form (500 ms sonra görünür)', async ({ page }) => {
    await page.goto(q('slider'), { waitUntil: 'domcontentloaded', timeout: 90000 });
    const names = fixedNames('#fp-slider');
    assertStyled(await collect(page, names), names);
  });

  test('AJAX benzetimi: yalnız fetch + innerHTML ile gelen form', async ({ page }) => {
    await page.goto(q('ajax'), { waitUntil: 'domcontentloaded', timeout: 90000 });
    const names = fixedNames('#fp-ajax');
    assertStyled(await collect(page, names), names);
  });

  test('panel: CSS gecikmeliyken dokunuştan stilli panele <100 ms (5 koşu medyanı, her koşu stilli)', async ({ page }) => {
    const runs = [];
    for (let i = 0; i < 5; i += 1) {
      runs.push(await openOnce(page));
    }
    const sorted = runs.map((r) => r.ms).sort((a, b) => a - b);
    console.log(`FP_PANEL ${JSON.stringify({ median: sorted[2], runs: sorted, sample: runs[0] })}`);
    expect(sorted[2], 'dokunuştan görünür panele ms (medyan)').toBeLessThan(100);
    for (const out of runs) {
      expect(out.surfaceBg).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      expect(parseFloat(out.surfaceRadius)).toBeGreaterThan(0);
      expect(parseFloat(out.cardRadius)).toBeGreaterThan(0);
      expect(out.cardH).toBeGreaterThanOrEqual(44);
    }
  });
});

/**
 * Yeni sayfa yükler, betik bağlanınca gerçek dokunuşla (60 ms basılı) açar; dokunuştan görünür panele ms + panel stilleri.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<{ms: number, surfaceBg: string, surfaceRadius: string, cardRadius: string, cardH: number}>} Ölçüm.
 */
async function openOnce(page) {
  await page.goto(q('trigger'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 60000 });
  await page.evaluate(() => {
    const trigger = document.querySelector('[data-dp-open]');
    window.__dpOpen = { t0: 0, visible: 0, styled: null };
    trigger.addEventListener(
      'click',
      (event) => {
        window.__dpOpen.t0 = event.timeStamp;
        const loop = () => {
          const overlay = document.querySelector('[data-dp-overlay]');
          const surface = document.querySelector('[data-dp-surface]');
          if (overlay && surface && surface.getClientRects().length > 0) {
            const style = getComputedStyle(overlay);
            if (style.visibility === 'visible' && parseFloat(style.opacity) > 0.01) {
              window.__dpOpen.visible = performance.now();
              const s = getComputedStyle(surface);
              const card = surface.querySelector('.donation-panel-amount');
              window.__dpOpen.styled = {
                surfaceBg: s.backgroundColor,
                surfaceRadius: s.borderTopLeftRadius,
                cardRadius: card ? getComputedStyle(card).borderTopLeftRadius : '',
                cardH: card ? Math.round(card.getBoundingClientRect().height) : 0,
              };
              return;
            }
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      },
      { capture: true, once: true },
    );
  });
  await page.locator('[data-dp-open]').click({ delay: 60 });
  await page.waitForFunction(() => window.__dpOpen && window.__dpOpen.visible > 0, null, { timeout: 15000 });
  return page.evaluate(() => ({ ms: Math.round(window.__dpOpen.visible - window.__dpOpen.t0), ...window.__dpOpen.styled }));
}
