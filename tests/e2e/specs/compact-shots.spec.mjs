/**
 * Compact kart önce/sonra görüntüleri (YALNIZ yerel WP; yalnız masaüstü projesi, genişlik setViewportSize ile).
 * Her genişlik (1440/820/375/320) × ürün (hedefsiz / hedefli / sabit fiyatlı) × akış (sepetli / doğrudan) × adım; ayrıca
 * vergi indirimi beyanlı bilgiler adımı ve etki ifadeli tutar adımı. Kart yükseklikleri `yukseklik.json`.
 * Çalıştırma: `WDP_COMPACT_SHOTS=<klasör> npm run e2e:queue -- npm run e2e:experiences -- --spec compact-shots --project desktop --env local`.
 * Sipariş VERİLMEZ (ödeme düğmesine basılmaz).
 */
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const IDS = JSON.parse(process.env.WDP_EXP_PRODUCTS || '{}');
const SHOTS = process.env.WDP_COMPACT_SHOTS || '';
const CARD = '[data-dp-compact]';
const DONOR = { name: 'Çağlar Şükrü Öztürk', email: 'caglar@example.org', phone: '7700 900123' };

const step = (page, name) => page.locator(CARD).first().locator(`[data-dp-cstep="${name}"]`);
const height = (page) => page.locator(CARD).first().evaluate((el) => Math.round(el.getBoundingClientRect().height * 10) / 10);

async function open(page, baseURL, id, direct, query = '') {
  await page.context().clearCookies();
  const cookies = [{ name: 'dp_progress_fresh', value: '1', url: baseURL }];
  if (direct) {
    cookies.push({ name: 'dp_direct', value: '1', url: baseURL });
  }
  await page.context().addCookies(cookies);
  await page.goto(`/?dp_compact=plain&dp_ids=${id}${query}`);
  await expect(page.locator(`${CARD}[data-dp-ready="1"]`).first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Etkin adımda görünen bloklar arasındaki en büyük dikey boşluk (px). Durum satırında yalnız görünen metin (güven satırı ya
 * da hata) sayılır; ayrılmış boş yer boşluk sayılır.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<number>} En büyük boşluk.
 */
const maxGap = (page) =>
  page.locator(CARD).first().evaluate((card) => {
    const step = card.querySelector('.donation-panel-compact__step.is-on');
    if (!step) return 0;
    const boxes = [];
    Array.from(step.children).forEach((el) => {
      if (el.matches('template, .donation-panel-compact__sheet, [hidden]')) return;
      let target = el;
      if (el.classList.contains('donation-panel-compact__status')) {
        target = el.classList.contains('has-err') ? el.querySelector('[data-dp-cerr]') : el.querySelector('.donation-panel-compact__trust');
      }
      if (!target) return;
      const r = target.getBoundingClientRect();
      if (r.height > 0) boxes.push(r);
    });
    let max = 0;
    for (let i = 1; i < boxes.length; i++) {
      max = Math.max(max, boxes[i].top - boxes[i - 1].bottom);
    }
    return Math.round(max * 10) / 10;
  });

const GAPS = {};

async function shot(page, name) {
  await page.waitForTimeout(320);
  GAPS[name] = await maxGap(page);
  await page.locator(CARD).first().screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function chooseAmount(page) {
  const amount = step(page, 'amount');
  const chip = amount.locator('.donation-panel-compact__chip').first();
  const plus = amount.locator('[data-dp-cqty="1"]');
  if (await chip.count()) {
    await chip.click();
  } else if (await plus.count()) {
    await plus.click();
  } else {
    await amount.locator('[data-dp-camount-in]').fill('60');
  }
}

async function fillDetails(page) {
  const details = step(page, 'details');
  await details.locator('input[name="donation_full_name"]').fill(DONOR.name);
  const email = details.locator('input[name="donation_email"]');
  if (await email.count()) {
    await email.fill(DONOR.email);
  }
  await details.locator('input[name="donation_phone"]').fill(DONOR.phone);
}

test.describe('compact görüntüler', () => {
  test.beforeEach(() => {
    test.skip(!SHOTS || !IDS.custom || test.info().project.name !== 'desktop', 'WDP_COMPACT_SHOTS + masaüstü');
    test.setTimeout(900000);
  });

  test('her genişlik × ürün × akış × adım', async ({ page, baseURL }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const products = { hedefsiz: IDS.custom, hedefli: IDS.campaign, sabit: IDS.fixed };
    const out = {};
    for (const width of [1440, 820, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [label, id] of Object.entries(products)) {
        if (!id) continue;
        for (const flow of ['sepetli', 'dogrudan']) {
          const direct = flow === 'dogrudan';
          const key = `${width}-${label}-${flow}`;
          await open(page, baseURL, id, direct);
          out[key] = await height(page);
          await shot(page, `${key}-1-tutar`);
          await chooseAmount(page);
          await shot(page, `${key}-1-tutar-secili`);
          await step(page, 'amount').locator('[data-dp-cnext]').click();
          await expect(step(page, 'details')).toHaveClass(/is-on/);
          await shot(page, `${key}-2-bilgiler`);
          await step(page, 'details').locator('button[type="submit"]').click();
          await shot(page, `${key}-2-bilgiler-hata`);
          await fillDetails(page);
          // Sepetli akışta ikinci adım son adımdır (ödeme düğmesi bu adımda): ileri gidilmez (sepete ekleme yok).
          if (await page.locator(`${CARD} [data-dp-cstep="pay"]`).count()) {
            await step(page, 'details').locator('button[type="submit"]').click();
            await expect(step(page, 'pay')).toHaveClass(/is-on/);
            await shot(page, `${key}-3-odeme`);
          } else {
            await shot(page, `${key}-2-bilgiler-dolu`);
          }
          out[`${key}-son`] = await height(page);
        }
      }
      // Vergi indirimi beyanı (bilgiler adımı) ve etki ifadesi (tutar adımı), doğrudan akış.
      await open(page, baseURL, IDS.custom, true, '&dp_ctax=1&dp_cimpact=1');
      out[`${width}-beyan`] = await height(page);
      await chooseAmount(page);
      await shot(page, `${width}-etki-1-tutar-secili`);
      await step(page, 'amount').locator('[data-dp-cnext]').click();
      await expect(step(page, 'details')).toHaveClass(/is-on/);
      await shot(page, `${width}-beyan-2-bilgiler`);
      const more = step(page, 'details').locator('[data-dp-ctax-more]');
      if (await more.count()) {
        await more.click();
        await shot(page, `${width}-beyan-2-ayrinti`);
      }
    }
    fs.writeFileSync(path.join(SHOTS, 'yukseklik.json'), `${JSON.stringify(out, null, 2)}\n`);
    fs.writeFileSync(path.join(SHOTS, 'bosluk.json'), `${JSON.stringify(GAPS, null, 2)}\n`);
    console.log(`COMPACT_SHOT_HEIGHTS ${JSON.stringify(out)}`);
    console.log(`COMPACT_SHOT_GAPS ${JSON.stringify(GAPS)}`);
  });
});
