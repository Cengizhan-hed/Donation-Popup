/**
 * 12.2 slider: sayfa içi form tembel başlatma + sunucu/betik ilk durum eşliği. YALNIZ yerel WP:
 *   npm run e2e:queue -- npm run e2e:experiences -- --env local --spec experiences-lazy [--project android]
 *
 *  1) Eşlik: betik engelliyken (sunucu çıktısı) ve betik bağlandıktan sonra formun görünen her öğesinin metni, seçili durumu
 *     ve kutusu AYNI (bağlama görsel hiçbir şey değiştirmez → CLS 0, tembel bağlamada ilk dokunuşta sıçrama yok).
 *  2) Slider (6 form, yatay şerit ve üst üste solma): yalnız görünen form bağlanır; diğerleri bekler.
 *  3) Bağlanmamış formda ilk dokunuş kaybolmaz (gözlemci hiç tetiklenmese bile): tutar kartı seçilir, toplam güncellenir.
 */
import { test, expect } from '@playwright/test';

const PRODUCTS = JSON.parse(process.env.WDP_EXP_PRODUCTS || '{}');
const CUSTOM = process.env.WDP_EXP_PRODUCT_ID || String(PRODUCTS.custom || 0);
const EXP_JS = /\/woo-donation-popup\/assets\/build\/experiences\/.*\.js(\?|$)/;

/**
 * Formun görünen öğelerinin durumu (kimlik/rastgele anahtar içermez): etiket, sınıf, kendi metni, seçim/pasiflik, kutu.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {number} [index] Kaçıncı form.
 * @return {Promise<object[]>} Durum listesi.
 */
async function snapshot(page, index = 0) {
  // Yazı tipleri yüklenmiş ve düzen oturmuş olsun (karşılaştırma yalnız betiğin etkisini görsün).
  // Adımın giriş animasyonu (dp-fadeup, 4 px) bitmiş olsun: kesirli konum farkı betikten değil animasyondan gelir.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return page.evaluate((i) => {
    const form = document.querySelectorAll('[data-dp-exp] [data-dp-form]')[i];
    const base = form.getBoundingClientRect();
    const out = [];
    form.querySelectorAll('*').forEach((el) => {
      if (el.getClientRects().length === 0) return;
      const r = el.getBoundingClientRect();
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim();
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className : '',
        text: own,
        checked: el.getAttribute('aria-checked') || '',
        off: el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'),
        box: [r.left - base.left, r.top - base.top, r.width, r.height].map((v) => Math.round(v)),
      });
    });
    return out;
  }, index);
}

/** Tanı (WDP_LAZY_DEBUG): gövde çocuklarının kesirli konumları. */
function bodyInfo(page) {
  return page.evaluate(() => {
    const b = document.querySelector('[data-dp-exp] .donation-panel-surface__body');
    const rows = Array.from(b.querySelectorAll(':scope > *, :scope > section > *')).map((c) => {
      const r = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      return [c.tagName, String(c.className).slice(0, 24), +r.top.toFixed(2), +r.height.toFixed(2), cs.display, cs.marginTop, cs.marginBottom];
    });
    const bs = getComputedStyle(b);
    const head = b.parentElement.querySelector('.donation-panel-head');
    const steps = b.parentElement.querySelector('[data-dp-steps]');
    return `${JSON.stringify(rows.slice(0, 3))} scrollTop=${b.scrollTop} bodytop=${b.getBoundingClientRect().top.toFixed(3)} pt=${bs.paddingTop} disp=${bs.display} gap=${bs.rowGap} parent=${getComputedStyle(b.parentElement).display}/${getComputedStyle(b.parentElement).rowGap} head=${head.getBoundingClientRect().height.toFixed(3)} steps=${steps ? `${getComputedStyle(steps).display} ${steps.hidden} ${steps.className}` : '-'}`;
  });
}

/**
 * @param {object[]} a Önce.
 * @param {object[]} b Sonra.
 * @return {string} İlk fark (yoksa boş).
 */
function firstDiff(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      return `#${i}: ${JSON.stringify(a[i])} → ${JSON.stringify(b[i])} | önceki: ${JSON.stringify(a.slice(Math.max(0, i - 3), i).map((x) => [x.tag, x.cls.slice(0, 30), x.box]))}`;
    }
  }
  return '';
}

const KINDS = ['custom', 'fixed', 'shares', 'campaign', 'addon'].filter((k) => Number(PRODUCTS[k]) > 0 || (k === 'custom' && Number(CUSTOM) > 0));

for (const kind of KINDS) {
  test(`eşlik: sunucu çıktısı = bağlanmış form (${kind})`, async ({ page }) => {
    const id = kind === 'custom' ? CUSTOM : PRODUCTS[kind];
    const url = `/?dp_exp_test=inline&dp_product=${id}`;
    await page.route(EXP_JS, (route) => route.abort());
    await page.goto(url, { waitUntil: 'load' });
    await expect(page.locator('[data-dp-exp] [data-dp-form]').first()).toBeVisible();
    const before = await snapshot(page);
    const debugBefore = process.env.WDP_LAZY_DEBUG ? await bodyInfo(page) : '';
    await page.unroute(EXP_JS);
    await page.goto(url, { waitUntil: 'load' });
    await expect(page.locator('[data-dp-exp][data-dp-ready="1"]').first()).toBeAttached({ timeout: 20000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const after = await snapshot(page);
    if (process.env.WDP_LAZY_DEBUG) console.log('DEBUG', kind, debugBefore, '\n=>', await bodyInfo(page));
    expect(before.length).toBeGreaterThan(5);
    expect(firstDiff(before, after), 'bağlama görünen bir şeyi değiştirdi').toBe('');
  });
}

for (const mode of ['track', 'fade']) {
  test(`slider (${mode}): yalnız görünen form bağlanır, kalanlar bekler`, async ({ page }) => {
    await page.goto(`/?dp_exp_test=slider&dp_mode=${mode}&dp_product=${CUSTOM}`, { waitUntil: 'load' });
    await expect(page.locator('[data-dp-exp]')).toHaveCount(6);
    await expect(page.locator('[data-dp-exp][data-dp-ready="1"]')).toHaveCount(1, { timeout: 20000 });
    await expect(page.locator('[data-sim-slide="0"] [data-dp-exp]')).toHaveAttribute('data-dp-ready', '1');
    // Hepsi "etkileşime hazır" işaretli (ilk dokunuş formu eşzamanlı bağlar).
    await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toHaveCount(6);
    if (mode === 'track') {
      // Slayt 2'ye geçiş (kaydırıcıların genel davranışı: şerit kayar) → yaklaşınca bağlanır.
      await page.evaluate(() => {
        document.querySelector('.sim-track').style.transform = 'translateX(-100%)';
      });
      await expect(page.locator('[data-sim-slide="1"] [data-dp-exp]')).toHaveAttribute('data-dp-ready', '1', { timeout: 10000 });
      await expect(page.locator('[data-dp-exp][data-dp-ready="1"]')).toHaveCount(2);
    }
  });
}

test('bağlanmamış formda ilk dokunuş kaybolmaz (gözlemci tetiklenmese de)', async ({ page }) => {
  // Gözlemci hiç tetiklenmez: form yalnız etkileşimle bağlanabilir.
  await page.addInitScript(() => {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  await page.goto(`/?dp_exp_test=inline&dp_product=${CUSTOM}`, { waitUntil: 'load' });
  const root = page.locator('[data-dp-exp]').first();
  await expect(root).toHaveAttribute('data-dp-mounted', '1', { timeout: 20000 });
  await expect(root).not.toHaveAttribute('data-dp-ready', '1');
  const value = await root.locator('[data-dp-preset][aria-checked="false"]').first().getAttribute('data-dp-preset');
  const chip = root.locator(`[data-dp-preset="${value}"]`).first();
  await chip.click();
  await expect(root).toHaveAttribute('data-dp-ready', '1');
  await expect(chip).toHaveAttribute('aria-checked', 'true');
  await expect(root.locator('[data-dp-submit]')).toHaveAttribute('aria-disabled', 'false');
  const total = await root.locator('[data-dp-total]').textContent();
  expect(total.replace(/[^\d]/g, '')).toContain(String(Math.round(Number(value))));
});
