/**
 * Compact bağış kartı e2e (YALNIZ yerel WP): `[wdp_donation_form layout="compact"]`.
 *  - Kart yüksekliği 4 adımda (tutar → bilgiler → ödeme → teşekkür), hata/geri durumlarında AYNI (getBoundingClientRect);
 *    Chromium'da kart içi layout-shift toplamı 0 (PerformanceObserver).
 *  - Kaydırıcı (CSS scroll-snap + Swiper benzeri sürükleme/ok tuşu/tekerlek dinleyicisi): kart içinde slayt değişmez.
 *  - Hedefli (0 bağış / bağış sonrası), hedefsiz, sabit fiyatlı ürün; geçersiz tutar, eksik bilgi, geri, teşekkür
 *    (test kart geçidi `wdp_sim_card`, order-pay katmanda aynı kökenli çerçevede); TR/EN; axe 0.
 * Çalıştırma: `npm run e2e:queue -- npm run e2e:experiences -- --spec compact-card --env local`.
 * Görüntüler/yükseklikler: WDP_COMPACT_SHOTS klasörüne (verilmişse).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const IDS = JSON.parse(process.env.WDP_EXP_PRODUCTS || '{}');
const SHOTS = process.env.WDP_COMPACT_SHOTS || '';
const DONOR = { name: 'Çağlar Şükrü Öztürk', email: 'caglar@example.org', phone: '7700 900123' };
const CARD = '[data-dp-compact]';

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} baseURL Taban.
 * @param {{ids: number[], view?: string, query?: string, direct?: boolean}} opts Seçenekler.
 */
async function open(page, baseURL, { ids, view = 'plain', query = '', direct = true }) {
  const cookies = [{ name: 'dp_progress_fresh', value: '1', url: baseURL }];
  if (direct) {
    cookies.push({ name: 'dp_direct', value: '1', url: baseURL });
  }
  await page.context().addCookies(cookies);
  await page.addInitScript(() => {
    window.__ls = [];
    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((e) => {
          const card = document.querySelector('[data-dp-compact]');
          const sources = e.sources || [];
          window.__ls.push({
            v: e.value,
            t: e.startTime,
            input: Boolean(e.hadRecentInput),
            card: Boolean(card && sources.some((s) => s.node && card.contains(s.node))),
            src: sources.map((s) => `${s.node ? `${s.node.nodeName}.${s.node.className}` : '?'} ${JSON.stringify(s.previousRect)}->${JSON.stringify(s.currentRect)}`).join(' | '),
          });
        });
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      window.__ls = null;
    }
  });
  await page.goto(`/?dp_compact=${view}&dp_ids=${ids.join(',')}${query}`);
  await expect(page.locator(`${CARD}[data-dp-ready="1"]`).first()).toBeVisible({ timeout: 20000 });
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {number} [nth] Kart sırası.
 * @return {Promise<number>} Kart yüksekliği (px).
 */
const height = (page, nth = 0) => page.locator(CARD).nth(nth).evaluate((el) => el.getBoundingClientRect().height);
const step = (page, name, nth = 0) => page.locator(CARD).nth(nth).locator(`[data-dp-cstep="${name}"]`);

/**
 * Kart içi layout-shift toplamı — CLS tanımından da sıkı: kullanıcı girdisinden hemen sonraki kaymalar (hadRecentInput) DAHİL
 * (yalnız Chromium destekler; diğerlerinde null).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {number} since performance.now() başlangıcı.
 * @return {Promise<number|null>} Toplam.
 */
const cardShift = (page, since) =>
  page.evaluate((t) => (window.__ls ? window.__ls.filter((e) => e.card && e.t >= t).reduce((a, e) => a + e.v, 0) : null), since);

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} name Dosya adı.
 */
async function shot(page, name) {
  if (!SHOTS) {
    return;
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(250);
  await page.locator(CARD).first().screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

/**
 * Bilgiler adımını doldurur (e-posta alanı ürün ayarına bağlı).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 */
async function fillDetails(page) {
  // Sabit fiyatta ayrı bilgiler adımı yok: alanlar tek ekranda ("amount").
  const details = (await step(page, 'details').count()) ? step(page, 'details') : step(page, 'amount');
  await details.locator('input[name="donation_full_name"]').fill(DONOR.name);
  const email = details.locator('input[name="donation_email"]');
  if (await email.count()) {
    await email.fill(DONOR.email);
  }
  await details.locator('input[name="donation_phone"]').fill(DONOR.phone);
}

/**
 * Ödeme katmanında test kart geçidiyle öder ve teşekkür adımını bekler.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {(n: string) => Promise<void>} [onOpen] Katman açıkken (görüntü vb.).
 */
async function payInLayer(page, onOpen) {
  await step(page, 'pay').locator('[data-dp-cpay]').click();
  const dialog = page.locator('dialog[data-dp-overlay]');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  const frame = page.frameLocator('[data-dp-cframe]');
  const radio = frame.locator('input[name="payment_method"][value="wdp_sim_card"]');
  await expect(radio).toBeAttached({ timeout: 30000 });
  if (onOpen) {
    await onOpen('open');
  }
  await radio.check({ force: true });
  await frame.locator('#place_order').click();
  await expect(step(page, 'thanks')).toHaveClass(/is-on/, { timeout: 30000 });
  await expect(dialog).toBeHidden();
}

/**
 * Serbest tutarlı ürünle tam akış; her adımda yükseklik ölçülür.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} [prefix] Görüntü öneki ('' = görüntü yok).
 * @param {{pay?: object}} [info] Ek ölçümler (ödeme sayfası yüksekliği).
 * @return {Promise<number[]>} Yükseklikler.
 */
async function fullFlow(page, prefix = '', info = {}) {
  const heights = [await height(page)];
  const amount = step(page, 'amount');
  const next = amount.locator('[data-dp-cnext]');
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  if (prefix) await shot(page, `${prefix}adim-1`);

  // Tutar yokken devam (aria-disabled: odaklanır/tıklanır ama ilerlemez): tek satır hata, yükseklik aynı.
  await next.click({ force: true });
  await expect(amount.locator('[data-dp-cerr]')).not.toBeEmpty();
  heights.push(await height(page));

  // Geçersiz yazı → hâlâ pasif; hızlı tutar → etkin.
  const input = amount.locator('[data-dp-camount-in]');
  if (await input.count()) {
    await input.fill('abc');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
  }
  const chip = amount.locator('.donation-panel-compact__chip').first();
  if (await chip.count()) {
    await chip.click();
  } else {
    await input.fill('60');
  }
  await expect(next).toHaveAttribute('aria-disabled', 'false');
  await next.click();
  await expect(step(page, 'details')).toHaveClass(/is-on/);
  await expect(step(page, 'amount')).toHaveAttribute('inert', '');
  await expect(page.locator(`${CARD} [data-dp-live]`)).toContainText('2');
  heights.push(await height(page));

  // Eksik bilgi: hata satırı + aria-invalid, yükseklik aynı.
  await step(page, 'details').locator('button[type="submit"]').click();
  await expect(step(page, 'details').locator('[data-dp-cerr]')).not.toBeEmpty();
  await expect(step(page, 'details').locator('input[name="donation_full_name"]')).toHaveAttribute('aria-invalid', 'true');
  heights.push(await height(page));
  await fillDetails(page);
  if (prefix) await shot(page, `${prefix}adim-2`);
  await step(page, 'details').locator('button[type="submit"]').click();
  await expect(step(page, 'pay')).toHaveClass(/is-on/);
  await expect(step(page, 'pay').locator('[data-dp-crecap-name]')).toHaveText(DONOR.name);
  heights.push(await height(page));

  // Geri ve yeniden ileri.
  await step(page, 'pay').locator('[data-dp-cback]').click();
  await expect(step(page, 'details')).toHaveClass(/is-on/);
  heights.push(await height(page));
  await step(page, 'details').locator('button[type="submit"]').click();
  await expect(step(page, 'pay')).toHaveClass(/is-on/);
  if (prefix) await shot(page, `${prefix}adim-3`);

  await payInLayer(page, async () => {
    heights.push(await height(page));
    // Ödeme kararı ölçümü: order-pay içeriği (ürün tablosu + ödeme yöntemleri) kartın sabit yüksekliğine sığar mı.
    const payFrame = page.frames().find((f) => f.url().includes('donation_panel_embed'));
    if (payFrame) {
      info.pay = await payFrame.evaluate(() => {
        const box = document.getElementById('payment');
        return { document: document.documentElement.scrollHeight, payment: box ? Math.round(box.getBoundingClientRect().height) : 0 };
      });
    }
    if (prefix && SHOTS) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SHOTS, `${prefix}adim-3-katman.png`) });
    }
  });
  heights.push(await height(page));
  await expect(page.locator(`${CARD} [data-dp-cthanks]`)).toContainText(/\d/);
  if (prefix) await shot(page, `${prefix}adim-4`);

  // Yeniden bağış: başa döner, tutar seçili değil.
  await step(page, 'thanks').locator('[data-dp-cagain]').click();
  await expect(step(page, 'amount')).toHaveClass(/is-on/);
  await expect(step(page, 'amount').locator('input[data-dp-cquick]:checked')).toHaveCount(0);
  await expect(step(page, 'amount').locator('[data-dp-cnext]')).toHaveAttribute('aria-disabled', 'true');
  heights.push(await height(page));
  return heights;
}

/**
 * Sayfada çalışır: öğe üzerinde sola kaydırma (dokunma + işaretçi olayları). WebKit'te `Touch` kurucusu yoksa yalnız
 * dokunma türlü işaretçi olayları gönderilir.
 *
 * @param {string} selector Öğe seçicisi.
 */
function SWIPE(selector) {
  const el = document.querySelector(selector);
  try {
    const t = (x) => new Touch({ identifier: Date.now(), target: el, clientX: x, clientY: 20 });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(300)] }));
    el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [t(60)] }));
  } catch {
    // WebKit: Touch kurucusu yok.
  }
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300, pointerType: 'touch' }));
  el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 60, pointerType: 'touch' }));
  document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
}

const same = (heights) => {
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  expect(max - min, `yükseklikler: ${heights.map((h) => h.toFixed(1)).join(', ')}`).toBeLessThanOrEqual(0.5);
};

test.describe('compact kart', () => {
  test.beforeEach(() => {
    test.skip(!IDS.custom, 'test ürünleri yok');
    test.setTimeout(150000);
  });

  test('hedefli ürün 0 bağış: hedef + davetkâr cümle, yüzde yok', async ({ page, baseURL }) => {
    await open(page, baseURL, { ids: [IDS.campaign] });
    const camp = step(page, 'amount').locator('[data-dp-ccamp]');
    await expect(camp).toHaveAttribute('data-zero', '1');
    await expect(camp.locator('[data-dp-cfirst]')).toBeVisible();
    await expect(camp.locator('[data-dp-cpct]')).toBeHidden();
    await expect(camp.locator('[data-dp-cgoal]')).toBeVisible();
    // 12.3 v2: "£0 / £3,000 · İlk bağışı siz yapın" tek satırda; tam sayıda ".00" yok; bağışçı sayısı 0 iken yok.
    await expect(camp.locator('[data-dp-craised]')).toBeVisible();
    await expect(camp.locator('[data-dp-craised]')).toHaveText(/^\D*0\D*$/);
    await expect(camp.locator('[data-dp-cgoal]')).toHaveText(/^\/\s/);
    expect(await camp.locator('.donation-panel-compact__nums').innerText()).not.toMatch(/[.,]00(?!\d)/);
    await expect(camp.locator('[data-dp-cdonors]')).toBeHidden();
    const rows = await camp.locator('[data-dp-craised], [data-dp-cgoal], [data-dp-cfirst]').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(Math.max(...rows) - Math.min(...rows), 'tek satır').toBeLessThanOrEqual(4);
  });

  test('v2: adım sayısı akışa göre (sepetli 2, doğrudan 3), ara "ödeme sayfasında tamamlayacaksınız" adımı yok', async ({ page, baseURL }) => {
    await open(page, baseURL, { ids: [IDS.custom], direct: false });
    const card = page.locator(CARD).first();
    await expect(card.locator('[data-dp-cstep]')).toHaveCount(2);
    await expect(card.locator('[data-dp-cstep="pay"]')).toHaveCount(0);
    await expect(step(page, 'amount').locator('.donation-panel-compact__count')).toHaveText('1/2');
    await expect(step(page, 'details').locator('.donation-panel-compact__count')).toHaveText('2/2');
    // Bilgiler adımının düğmesi ödemeye geçer ve tutarı gösterir (sipariş/sepete ekleme bu testte yok).
    await card.locator('[data-dp-camount-in]').fill('40');
    await step(page, 'amount').locator('[data-dp-cnext]').click();
    await expect(step(page, 'details')).toHaveClass(/is-on/);
    await expect(step(page, 'details').locator('[data-dp-cpay-label]')).toContainText('40');
    await expect(page.locator(`${CARD} [data-dp-live]`)).toContainText('2');

    await page.context().clearCookies();
    await open(page, baseURL, { ids: [IDS.custom], direct: true });
    await expect(page.locator(CARD).first().locator('[data-dp-cstep]')).toHaveCount(4);
    await expect(step(page, 'amount').locator('.donation-panel-compact__count')).toHaveText('1/3');
    await expect(step(page, 'pay').locator('.donation-panel-compact__count')).toHaveText('3/3');
  });

  test('v2: boşluk ≤24 px (her adım; hedefli, hedefsiz, sabit), üst satır tek hizada, dokunma ≥48 px', async ({ page, baseURL }) => {
    const gap = () =>
      page.locator(CARD).first().evaluate((card) => {
        const active = card.querySelector('.donation-panel-compact__step.is-on');
        const boxes = [];
        Array.from(active.children).forEach((el) => {
          if (el.matches('template, .donation-panel-compact__sheet, [hidden]')) return;
          // Alt bölge: üstü görünen durum metni (güven satırı ya da hata), altı düğme.
          let target = el;
          if (el.classList.contains('donation-panel-compact__foot')) {
            const status = el.querySelector('.donation-panel-compact__status');
            const text = status && status.classList.contains('has-err') ? status.querySelector('[data-dp-cerr]') : el.querySelector('.donation-panel-compact__trust');
            target = text || el;
          }
          if (target && target.getBoundingClientRect().height > 0) boxes.push(target.getBoundingClientRect());
        });
        let max = 0;
        for (let i = 1; i < boxes.length; i++) max = Math.max(max, boxes[i].top - boxes[i - 1].bottom);
        return max;
      });
    for (const id of [IDS.custom, IDS.campaign, IDS.fixed].filter(Boolean)) {
      await open(page, baseURL, { ids: [id] });
      expect(await gap(), `tutar ${id}`).toBeLessThanOrEqual(24.5);
      // Sabit fiyat: tutar adımı yok; ilk ekran ("amount") bilgi alanlarını da taşır.
      const one = id === IDS.fixed;
      const details = step(page, one ? 'amount' : 'details');
      const chip = step(page, 'amount').locator('.donation-panel-compact__chip');
      if (await chip.count()) {
        const widths = await chip.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
        expect(Math.max(...widths) - Math.min(...widths), 'hızlı tutarlar eşit genişlik').toBeLessThanOrEqual(1);
        expect(Math.min(...(await chip.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))))).toBeGreaterThanOrEqual(48);
        await chip.first().click();
      }
      if (!one) {
        await step(page, 'amount').locator('[data-dp-cnext]').click();
      }
      await expect(details).toHaveClass(/is-on/);
      expect(await gap(), `bilgiler ${id}`).toBeLessThanOrEqual(24.5);
      const rows = await details.locator('.donation-panel-compact__field').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
      expect(Math.min(...rows), 'alan satırı ≥48 px').toBeGreaterThanOrEqual(48);
      if (one) {
        // Fiyat satırı ve adet düğmeleri ≥48 px dokunma hedefi.
        const box = await details.locator('.donation-panel-compact__fixed').evaluate((el) => el.getBoundingClientRect().height);
        expect(box, 'fiyat satırı ≥48 px').toBeGreaterThanOrEqual(48);
        const btns = await details.locator('[data-dp-cqty]').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height); }));
        for (const size of btns) expect(size, 'adet düğmesi ≥48 px').toBeGreaterThanOrEqual(48);
      }
      // Üst satır: geri, başlık, tutar, sayaç aynı hizada (dikey merkezler ±2 px); başlık tek satır.
      const centers = await details
        .locator('.donation-panel-compact__top > *')
        .evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; }));
      expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(2);
      expect(await details.locator('[data-dp-ctitle]').evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
      await fillDetails(page);
      await details.locator('button[type="submit"]').click();
      await expect(step(page, 'pay')).toHaveClass(/is-on/);
      expect(await gap(), `ödeme ${id}`).toBeLessThanOrEqual(24.5);
    }
  });

  test('v2: güven satırı düğmenin üstünde; hata aynı yeri alır (yükseklik aynı); ayarla kapanır', async ({ page, baseURL }) => {
    await open(page, baseURL, { ids: [IDS.custom] });
    const amount = step(page, 'amount');
    const trust = amount.locator('.donation-panel-compact__trust');
    await expect(trust).toBeVisible();
    await expect(trust.locator('svg[width="14"][height="14"]')).toHaveCount(1);
    const h0 = await height(page);
    const ctaTop = await amount.locator('[data-dp-cnext]').evaluate((el) => el.getBoundingClientRect().top);
    const trustBottom = await trust.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(ctaTop - trustBottom).toBeLessThanOrEqual(24);
    await amount.locator('[data-dp-cnext]').click({ force: true });
    await expect(amount.locator('[data-dp-cerr]')).not.toBeEmpty();
    await expect(trust).toBeHidden();
    same([h0, await height(page)]);
    await open(page, baseURL, { ids: [IDS.custom], query: '&dp_ctrust=0' });
    // Ödeme adımının bilgilendirme notu (aynı yer) ayardan bağımsızdır; tutar ve bilgiler adımında satır yok.
    await expect(step(page, 'amount').locator('.donation-panel-compact__trust')).toHaveCount(0);
    await expect(step(page, 'details').locator('.donation-panel-compact__trust')).toHaveCount(0);
    same([h0, await height(page)]);
  });

  test('v2: toplam ve etki satırı (seçilen tutar; sabit fiyatta adet × fiyat), "Başka tutar" hızlı seçimi kaldırır', async ({ page, baseURL }) => {
    await open(page, baseURL, { ids: [IDS.custom], query: '&dp_cimpact=1' });
    const amount = step(page, 'amount');
    const total = amount.locator('[data-dp-ctotal]');
    await expect(total).toHaveText('—');
    const h0 = await height(page);
    const chip = amount.locator('.donation-panel-compact__chip').first();
    await chip.click();
    await expect(amount.locator('input[data-dp-cquick]:checked')).toHaveCount(1);
    await expect(total).toHaveText(/\d/);
    await amount.locator('[data-dp-camount-in]').fill('60');
    await expect(amount.locator('input[data-dp-cquick]:checked')).toHaveCount(0);
    await expect(total).toContainText('60');
    await expect(amount.locator('[data-dp-ceffect]')).toHaveText(/family food parcel/);
    await amount.locator('[data-dp-camount-in]').fill('5');
    await expect(amount.locator('[data-dp-ceffect]')).toHaveText('');
    same([h0, await height(page)]);
    if (IDS.fixed) {
      await open(page, baseURL, { ids: [IDS.fixed] });
      const fixedTotal = step(page, 'amount').locator('[data-dp-ctotal]');
      const unit = await fixedTotal.innerText();
      const plus = step(page, 'amount').locator('[data-dp-cqty="1"]');
      if (await plus.count()) {
        await plus.click();
        await expect(fixedTotal).not.toHaveText(unit);
      }
    }
  });

  test('v2: vergi indirimi beyanı başlık + kısa hal + Ayrıntılar (kart içi, yükseklik aynı, Esc kapatır)', async ({ page, baseURL }) => {
    await open(page, baseURL, { ids: [IDS.custom], query: '&dp_ctax=1' });
    const h0 = await height(page);
    // Beyan kartı büyütmez: yükseklik beyansız kartla aynı (taban 382 px + kenarlık).
    await open(page, baseURL, { ids: [IDS.custom] });
    expect(Math.abs(h0 - (await height(page))), 'beyanlı = beyansız yükseklik').toBeLessThanOrEqual(0.5);
    await open(page, baseURL, { ids: [IDS.custom], query: '&dp_ctax=1' });
    await page.locator(`${CARD} [data-dp-camount-in]`).fill('30');
    await step(page, 'amount').locator('[data-dp-cnext]').click();
    const details = step(page, 'details');
    await expect(details.locator('.donation-panel-compact__taxt > b')).toHaveText('Boost your donation by 25% with Gift Aid');
    await expect(details.locator('.donation-panel-compact__taxs')).toBeVisible();
    const more = details.locator('[data-dp-ctax-more]');
    expect((await more.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    const sheet = details.locator('[data-dp-ctax-sheet]');
    await expect(sheet).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(sheet).toBeFocused();
    await expect(sheet).toContainText('UK taxpayer');
    same([h0, await height(page)]);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();
    await more.click();
    await sheet.locator('[data-dp-ctax-close]').click();
    await expect(sheet).toBeHidden();
    await details.locator('[data-dp-ctax]').check();
    await fillDetails(page);
    await details.locator('button[type="submit"]').click();
    await expect(step(page, 'pay').locator('[data-dp-crecap-tax-row]')).toBeVisible();
    same([h0, await height(page)]);
  });

  test('akış + yükseklik sabit (4 adım, hata, geri) + kart içi CLS 0', async ({ page, baseURL }) => {
    await open(page, baseURL, { ids: [IDS.custom] });
    // Ölçüm sayfa ve tema yazı tipleri yüklendikten sonra başlar (yazı tipi değişimi temanındır; kart adımlarına ait değildir).
    await page.waitForLoadState('networkidle');
    const since = await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now()))))));
    // Bilgi: yükleme sırasındaki kart içi kaymalar (yazı tipi değişimi) ayrıca raporlanır.
    console.log(`COMPACT_LOAD_SHIFTS ${JSON.stringify(await page.evaluate((t) => (window.__ls || []).filter((e) => e.card && e.t < t), since))}`);
    same(await fullFlow(page));
    // Son geçişin (yeniden bağış) kareleri de kayda girsin.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(400);
    const shift = await cardShift(page, since);
    if (shift !== null) {
      const entries = await page.evaluate((t) => window.__ls.filter((e) => e.card && e.t >= t), since);
      console.log(`COMPACT_SHIFTS ${JSON.stringify(entries)}`);
      expect(shift, `kart içi kaymalar: ${JSON.stringify(entries)}`).toBe(0);
    }
  });

  test('hedefsiz ürün: kampanya çubuğu yok; tutar önceden seçili değil; en çok 3 hızlı tutar', async ({ page, baseURL }) => {
    await open(page, baseURL, { ids: [IDS.custom] });
    await expect(page.locator(`${CARD} [data-dp-ccamp]`)).toHaveCount(0);
    const chips = page.locator(`${CARD} [data-dp-cquick]`);
    expect(await chips.count()).toBeLessThanOrEqual(3);
    await expect(page.locator(`${CARD} [data-dp-cquick]:checked`)).toHaveCount(0);
    await expect(page.locator(`${CARD} [data-dp-camount-in]`)).toHaveAttribute('inputmode', 'decimal');
  });

  test('hızlı tutar 0: yalnız tutar alanı', async ({ page, baseURL }) => {
    await open(page, baseURL, { ids: [IDS.custom], query: '&dp_cquick=0' });
    await expect(page.locator(`${CARD} [data-dp-cquick]`)).toHaveCount(0);
    await expect(page.locator(`${CARD} [data-dp-camount-in]`)).toBeVisible();
  });

  test('sabit fiyatlı ürün: fiyat + adet, fiyat değiştirilemez, yükseklik sabit', async ({ page, baseURL }) => {
    test.skip(!IDS.fixed, 'sabit ürün yok');
    await open(page, baseURL, { ids: [IDS.fixed] });
    const amount = step(page, 'amount');
    // Tek ekran: ayrı tutar/bilgiler adımı yok; fiyat × adet = toplam tek satır, hemen altında alanlar, düğme aynı ekranda.
    await expect(amount.locator('[data-dp-camount-in]')).toHaveCount(0);
    await expect(step(page, 'details')).toHaveCount(0);
    await expect(amount).toHaveClass(/is-on/);
    // Doğrudan akış (open varsayılanı): 2 adım; sepetli tek adımda sayaç çizilmez (birim testte).
    await expect(amount.locator('.donation-panel-compact__count')).toHaveText('1/2');
    await expect(amount.locator('input[name="donation_full_name"]')).toBeVisible();
    await expect(amount.locator('input[name="donation_phone"]')).toBeVisible();
    const h0 = await height(page);
    const total = amount.locator('[data-dp-ctotal]');
    const before = await total.innerText();
    const plus = amount.locator('[data-dp-cqty="1"]');
    if (await plus.count()) {
      await expect(amount.locator('[data-dp-cunit]')).toBeVisible();
      await plus.click();
      await expect(amount.locator('[data-dp-cqty-out]')).toHaveText('2');
      await expect(total).not.toHaveText(before);
      await expect(amount.locator('button[type="submit"]')).toBeVisible();
      // Fiyat, adet ve toplam aynı satırda (dikey merkezler ±3 px).
      const centers = await amount
        .locator('.donation-panel-compact__fixed > b, .donation-panel-compact__fixed .donation-panel-stepper')
        .evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; }));
      expect(Math.max(...centers) - Math.min(...centers), 'fiyat satırı tek hizada').toBeLessThanOrEqual(3);
    }
    // Düğme etiketi toplamı taşır (sepetli: "Ödemeye geç · £X"), tek satır.
    const pay = amount.locator('[data-dp-cpay]');
    if (await pay.count()) {
      await expect(pay).toContainText(/\d/);
      expect(await pay.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(60);
    }
    // Eksik bilgi: hata aynı ekranda, alan işaretli, yükseklik aynı.
    await amount.locator('button[type="submit"]').click();
    await expect(amount.locator('[data-dp-cerr]')).not.toBeEmpty();
    await expect(amount.locator('input[name="donation_full_name"]')).toHaveAttribute('aria-invalid', 'true');
    // Gizli tutar/adet alanları bilgi sayılmaz: adet seçimi hata sayılmaz.
    same([h0, await height(page)]);
  });

  test('sabit fiyat doğrudan: tek ekran → ödeme (2/2) → geri tek ekran → öde → teşekkür; yükseklik sabit', async ({ page, baseURL }) => {
    test.skip(!IDS.fixed, 'sabit ürün yok');
    await open(page, baseURL, { ids: [IDS.fixed] });
    const one = step(page, 'amount');
    const heights = [await height(page)];
    const plus = one.locator('[data-dp-cqty="1"]');
    if (await plus.count()) {
      await plus.click();
    }
    await fillDetails(page);
    await one.locator('button[type="submit"]').click();
    await expect(step(page, 'pay')).toHaveClass(/is-on/);
    await expect(step(page, 'pay').locator('.donation-panel-compact__count')).toHaveText('2/2');
    heights.push(await height(page));
    // Ödeme özeti toplamı tek ekrandaki toplamla aynı.
    await expect(step(page, 'pay').locator('[data-dp-crecap-amount]')).toHaveText(await one.locator('[data-dp-ctotal]').innerText());
    await step(page, 'pay').locator('[data-dp-cback]').click();
    await expect(one).toHaveClass(/is-on/);
    await expect(one.locator('input[name="donation_full_name"]')).toHaveValue(DONOR.name);
    await one.locator('button[type="submit"]').click();
    await expect(step(page, 'pay')).toHaveClass(/is-on/);
    await payInLayer(page);
    heights.push(await height(page));
    same(heights);
  });

  test('kaydırıcı: kart içinde sürükleme, ok tuşu, yazma ve tekerlek slaytı değiştirmez', async ({ page, baseURL, isMobile }) => {
    await open(page, baseURL, { ids: [IDS.custom, IDS.campaign || IDS.custom, IDS.fixed || IDS.custom], view: 'slider' });
    const card = page.locator(CARD).first();
    const changes = () => page.evaluate(() => window.__slides.changes);
    // Düzenek doğrulaması: kartın DIŞINDA (slayt etiketi) sürükleme slaytı değiştirir.
    const label = page.locator('.t-label').first();
    const lb = await label.boundingBox();
    if (isMobile) {
      await page.evaluate(SWIPE, '.t-label');
    } else {
      await page.mouse.move(lb.x + lb.width - 10, lb.y + lb.height / 2);
      await page.mouse.down();
      await page.mouse.move(lb.x + 10, lb.y + lb.height / 2, { steps: 5 });
      await page.mouse.up();
    }
    expect(await changes()).toBeGreaterThan(0);
    await page.evaluate(() => {
      window.__slideGo(0);
      window.__slides.changes = 0;
    });

    // Kart içinde sürükleme.
    if (isMobile) {
      await page.evaluate(SWIPE, '[data-dp-compact] [data-dp-ctitle]');
    } else {
      const box = await card.boundingBox();
      await page.mouse.move(box.x + box.width - 20, box.y + 30);
      await page.mouse.down();
      await page.mouse.move(box.x + 20, box.y + 30, { steps: 8 });
      await page.mouse.up();
      // Tekerlek (yatay) kart üzerinde.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(300, 0);
    }
    // Ok tuşu ve yazma (alan + hızlı tutar).
    const input = card.locator('[data-dp-camount-in]');
    await input.click();
    await input.type('25');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    const chip = card.locator('[data-dp-cquick]').first();
    if (await chip.count()) {
      await chip.focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('End');
    }
    expect(await changes()).toBe(0);
    expect(await page.evaluate(() => document.getElementById('t-slider').scrollLeft)).toBe(0);
  });

  test('kaydırıcı: ayar açıkken kart görünmez olunca başa döner, kapalıyken dönmez', async ({ page, baseURL }) => {
    for (const reset of [false, true]) {
      await open(page, baseURL, { ids: [IDS.custom, IDS.campaign || IDS.custom], view: 'slider', query: reset ? '&dp_creset=1' : '' });
      const card = page.locator(CARD).first();
      await card.locator('[data-dp-camount-in]').fill('30');
      await card.locator('[data-dp-cnext]').click();
      await expect(card).toHaveAttribute('data-dp-step', 'details');
      await page.evaluate(() => window.__slideGo(1));
      await page.waitForTimeout(600);
      await expect(card).toHaveAttribute('data-dp-step', reset ? 'amount' : 'details');
    }
  });

  test('Türkçe: metinler çevrilir', async ({ page, baseURL }) => {
    await open(page, baseURL, { ids: [IDS.custom], query: '&dp_locale=tr_TR' });
    const next = page.locator(`${CARD} [data-dp-cnext-label]`);
    await expect(next).toHaveText('Tutar seçin');
    await page.locator(`${CARD} [data-dp-camount-in]`).fill('40');
    await expect(next).toHaveText('Devam et');
    await expect(page.locator(`${CARD} [data-dp-camount-in]`)).toHaveAttribute('placeholder', /[a-zçğıöşü]/i);
  });

  test('axe WCAG 2.2 AA: her adımda 0 hata', async ({ page, baseURL }) => {
    await open(page, baseURL, { ids: [IDS.campaign || IDS.custom] });
    await page.evaluate(AXE);
    const run = () =>
      page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        const r = await axe.run(document.querySelector('[data-dp-compact]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
        return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
      });
    await page.waitForTimeout(300);
    expect(await run()).toEqual([]);
    await page.locator(`${CARD} [data-dp-camount-in]`).fill('35');
    await page.locator(`${CARD} [data-dp-cnext]`).click();
    await page.waitForTimeout(300);
    expect(await run()).toEqual([]);
    await fillDetails(page);
    await step(page, 'details').locator('button[type="submit"]').click();
    await page.waitForTimeout(300);
    expect(await run()).toEqual([]);
  });

  test('genişlikler: 1440/1024/820/375/320 yükseklik sabit + görüntüler', async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'genişlik taraması masaüstü projesinde');
    const out = {};
    for (const width of [1440, 1024, 820, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page, baseURL, { ids: [IDS.custom] });
      const shots = [1440, 820, 375].includes(width) ? `${width}-` : '';
      const info = {};
      const heights = await fullFlow(page, shots, info);
      same(heights);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      out[width] = Math.round(heights[0] * 10) / 10;
      out[`${width}-odeme-sayfasi`] = info.pay || null;
    }
    console.log(`COMPACT_HEIGHTS ${JSON.stringify(out)}`);
    if (SHOTS) {
      fs.writeFileSync(path.join(SHOTS, 'yukseklik.json'), `${JSON.stringify(out, null, 2)}\n`);
    }
  });

  // Son test: kampanyaya gerçek (yerel, test geçidi) bağış → teşekkürde çubuk sayfa yenilenmeden güncellenir.
  test('hedefli ürün: bağış sonrası teşekkürde kampanya çubuğu güncellenir (tek istek)', async ({ page, baseURL }, testInfo) => {
    test.skip(!IDS.campaign || testInfo.project.name !== 'desktop', 'kampanya bağışı yalnız masaüstü projesinde (son)');
    await open(page, baseURL, { ids: [IDS.campaign] });
    const h0 = await height(page);
    await page.locator(`${CARD} [data-dp-camount-in]`).fill('75');
    await page.locator(`${CARD} [data-dp-cnext]`).click();
    await fillDetails(page);
    await step(page, 'details').locator('button[type="submit"]').click();
    const progress = [];
    page.on('request', (r) => {
      if (r.url().includes('/donation-panel/v1/progress/')) progress.push(r.url());
    });
    await payInLayer(page);
    const camp = step(page, 'thanks').locator('[data-dp-ccamp]');
    await expect(camp).toHaveAttribute('data-zero', '0', { timeout: 15000 });
    await expect(camp.locator('[data-dp-craised]')).toContainText(/\d/);
    expect(progress).toHaveLength(1);
    same([h0, await height(page)]);
  });
});
