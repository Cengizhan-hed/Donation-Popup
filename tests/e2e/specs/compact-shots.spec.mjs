/**
 * Compact kart görüntüleri ve yükseklik ölçümü (YALNIZ yerel WP; yalnız masaüstü projesi, genişlik setViewportSize ile).
 * Her genişlik (1440/820/375/320) × ürün (hedefsiz / hedefli / sabit fiyatlı) × adım; ayrıca en kalabalık haller
 * (beyan + etki ifadesi) için kart ve DOĞAL içerik yüksekliği (kutu yüksekliği 1 px'e indirilince). Kart yükseklikleri
 * `yukseklik.json`, boşluklar `bosluk.json`.
 * Çalıştırma: `WDP_COMPACT_SHOTS=<klasör> npm run e2e:queue -- npm run e2e:experiences -- --spec compact-shots --project desktop --env local`.
 * Sipariş VERİLMEZ (ödeme düğmesine basılmaz).
 */
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const IDS = JSON.parse(process.env.WDP_EXP_PRODUCTS || '{}');
const SHOTS = process.env.WDP_COMPACT_SHOTS || '';
const CARD = '[data-dp-compact]';
const DONOR = { name: 'Çağlar Şükrü Öztürk', phone: '7700 900123' };

const step = (page, name) => page.locator(CARD).first().locator(`[data-dp-cstep="${name}"]`);
const height = (page) => page.locator(CARD).first().evaluate((el) => Math.round(el.getBoundingClientRect().height * 10) / 10);
/** Doğal içerik yüksekliği: kutu yüksekliği 1 px'e indirilince kartın aldığı yükseklik. */
const natural = (page) =>
  page.locator(CARD).first().evaluate((el) => {
    el.style.setProperty('--dp-compact-h', '1px');
    const value = Math.round(el.getBoundingClientRect().height * 10) / 10;
    el.style.removeProperty('--dp-compact-h');
    return value;
  });

async function open(page, baseURL, id, query = '') {
  await page.context().clearCookies();
  // Doğrudan bağış çerezi AÇIK: kart yine sepetli olmalı.
  await page.context().addCookies([
    { name: 'dp_progress_fresh', value: '1', url: baseURL },
    { name: 'dp_direct', value: '1', url: baseURL },
  ]);
  await page.goto(`/?dp_compact=plain&dp_ids=${id}${query}`);
  await expect(page.locator(`${CARD}[data-dp-ready="1"]`).first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Etkin adımda görünen bloklar arasındaki en büyük dikey boşluk (px); hata satırı boşken ayrılmış yer boşluk sayılır.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<number>} En büyük boşluk.
 */
const maxGap = (page) =>
  page.locator(CARD).first().evaluate((card) => {
    const active = card.querySelector('.donation-panel-compact__step.is-on');
    if (!active) return 0;
    const boxes = [];
    Array.from(active.children).forEach((el) => {
      if (el.matches('template, .donation-panel-compact__sheet, [hidden]')) return;
      const target = el.classList.contains('donation-panel-compact__foot') ? el.querySelector('.donation-panel-compact__cta') || el : el;
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
  } else if (await amount.locator('[data-dp-camount-in]').count()) {
    await amount.locator('[data-dp-camount-in]').fill('60');
  }
}

async function fillDetails(page) {
  // Sabit fiyatta ad/telefon tek ekranda ("amount").
  const details = (await step(page, 'details').count()) ? step(page, 'details') : step(page, 'amount');
  await details.locator('input[name="donation_full_name"]').fill(DONOR.name);
  await details.locator('input[name="donation_phone"]').fill(DONOR.phone);
}

test.describe('compact görüntüler', () => {
  test.beforeEach(() => {
    test.skip(!SHOTS || !IDS.custom || test.info().project.name !== 'desktop', 'WDP_COMPACT_SHOTS + masaüstü');
    test.setTimeout(900000);
  });

  test('her genişlik × ürün × adım + en kalabalık haller', async ({ page, baseURL }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const products = { hedefsiz: IDS.custom, hedefli: IDS.campaign, sabit: IDS.fixed };
    const out = {};
    for (const width of [1440, 820, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [label, id] of Object.entries(products)) {
        if (!id) continue;
        const key = `${width}-${label}`;
        await open(page, baseURL, id);
        out[key] = await height(page);
        out[`${key}-dogal`] = await natural(page);
        await shot(page, `${key}-1-tutar`);
        await chooseAmount(page);
        await shot(page, `${key}-1-tutar-secili`);
        const form = label === 'sabit' ? step(page, 'amount') : step(page, 'details');
        if (label !== 'sabit') {
          await step(page, 'amount').locator('[data-dp-cnext]').click();
        }
        await expect(form).toHaveClass(/is-on/);
        await shot(page, `${key}-2-bilgiler`);
        await form.locator('button[type="submit"]').click();
        await shot(page, `${key}-2-bilgiler-hata`);
        await fillDetails(page);
        await shot(page, `${key}-2-bilgiler-dolu`);
        out[`${key}-son`] = await height(page);
      }
      // En kalabalık haller: beyan × etki × ürün türü (kampanyalı kart dahil). Hepsi aynı kart yüksekliğinde olmalı.
      for (const [label, id] of Object.entries(products)) {
        if (!id) continue;
        for (const tax of [0, 1]) {
          for (const impact of [0, 1]) {
            const q = `${tax ? '&dp_ctax=1' : ''}${impact ? '&dp_cimpact=1' : ''}`;
            await open(page, baseURL, id, q);
            const key = `${width}-${label}-b${tax}e${impact}`;
            out[key] = await height(page);
            out[`${key}-dogal`] = await natural(page);
            // Tutar seçilince etki satırı dolar: doğal yükseklik yine aynı (satır yeri baştan ayrılı).
            await chooseAmount(page);
            out[`${key}-secili-dogal`] = await natural(page);
            if (tax && impact) {
              await shot(page, `${width}-${label}-beyan-etki-1`);
              if (label !== 'sabit') {
                await chooseAmount(page);
                await step(page, 'amount').locator('[data-dp-cnext]').click();
                await expect(step(page, 'details')).toHaveClass(/is-on/);
                out[`${key}-adim2`] = await height(page);
                out[`${key}-adim2-dogal`] = await natural(page);
                await shot(page, `${width}-${label}-beyan-etki-2`);
              }
            }
          }
        }
      }
    }
    fs.writeFileSync(path.join(SHOTS, 'yukseklik.json'), `${JSON.stringify(out, null, 2)}\n`);
    fs.writeFileSync(path.join(SHOTS, 'bosluk.json'), `${JSON.stringify(GAPS, null, 2)}\n`);
    console.log(`COMPACT_SHOT_HEIGHTS ${JSON.stringify(out)}`);
    console.log(`COMPACT_SHOT_GAPS ${JSON.stringify(GAPS)}`);
  });
});
