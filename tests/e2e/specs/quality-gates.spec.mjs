/**
 * Kalite kapıları (E8B): axe WCAG 2.2 AA (bağış formu, popup/panel, yan sepet, kampanya kartı, teşekkür, hesap popup'ı),
 * akış (sepet -> ödeme blok/klasik -> sipariş, HPOS), para birimi biçimi, RTL düzeni. 3 cihaz.
 * YALNIZ yerel WP; koşucu: `node tests/e2e/run-quality.mjs` (ortam: WDP_Q_CFG, WDP_Q_RESULTS, E2E_BASE_URL, WDP_LOCAL_WP_DIR).
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordResult } from '../helpers/quality-env.mjs';
import { formatMoney } from '../helpers/currency.mjs';
import { completeLocalCheckout, detectCheckoutKind, DEDICATION } from '../helpers/place-order.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const CFG = JSON.parse(process.env.WDP_Q_CFG || '{}');
const IDS = CFG.ids || {};
const STORE = CFG.store || {};

const GATE = (title) => (/^axe/.test(title) ? 'axe' : /^akış/.test(title) ? 'akis-odeme-hpos' : /^para/.test(title) ? 'para-birimi' : /^rtl/.test(title) ? 'rtl' : 'diger');

test.afterEach(async ({}, info) => {
  recordResult({
    gate: GATE(info.title),
    config: CFG.id,
    theme: CFG.theme,
    device: info.project.name,
    name: info.title,
    ok: info.status === 'passed',
    detail: info.status === 'passed' ? '' : String((info.error && info.error.message) || '').slice(0, 600),
  });
});

/**
 * Sayfada axe çalıştırır; ihlalleri okunur dizi olarak verir (eklentinin kendi alanı: `.wdp-*`/`.dp*` içindekiler öncelikli,
 * ama kapsam tüm sayfadır: tema kaynaklı ihlaller `theme:` önekiyle ayrılır).
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} [include] Kapsam seçicisi (boş = tüm sayfa).
 * @return {Promise<string[]>} İhlaller.
 */
async function axeViolations(page, include = '') {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(
    async ({ tags, scope }) => {
      const ctx = scope && document.querySelector(scope) ? { include: [scope] } : document;
      const res = await window.axe.run(ctx, { runOnly: { type: 'tag', values: tags } });
      const own = /(^|[\s>.#\[])(wdp|dp)[-_a-z]*|data-dp|donation_|custom_price/;
      return res.violations.flatMap((v) =>
        v.nodes.map((n) => `${own.test(n.target.join(' ') + n.html.slice(0, 160)) ? '' : 'theme:'}${v.id} (${v.impact}) ${n.target.join(' ')}`)
      );
    },
    { tags: AXE_TAGS, scope: include }
  );
}

/**
 * Yalnız eklenti kaynaklı ihlaller başarısızlık sayılır (tema ihlali raporlanır, eklentiye yüklenmez).
 * @param {string[]} v İhlaller.
 * @param {string} label Etiket.
 */
function expectNoOwn(v, label) {
  const own = v.filter((x) => !x.startsWith('theme:'));
  const theme = v.filter((x) => x.startsWith('theme:'));
  if (theme.length) test.info().annotations.push({ type: 'tema-ihlali', description: `${label}: ${theme.slice(0, 4).join(' | ')}` });
  expect(own, `${label}: ${own.join(' | ')}`).toEqual([]);
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {string[]} Sayfa hataları (yineleyen dizi).
 */
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

const kit = `/?dp_q_test=kit&dp_product=${IDS.custom}&dp_campaign=${IDS.campaign}`;

test.describe('axe', () => {
  test('axe: ürün sayfası bağış formu (eski kabuk) + popup + yan panel', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(IDS.fixedPath);
    await page.waitForLoadState('networkidle');
    expectNoOwn(await axeViolations(page), 'ürün sayfası');
    const popup = page.locator('.wdp-open-modal:not(.wdp-open-side-panel)').first();
    if (await popup.isVisible()) {
      await popup.click();
      await expect(page.locator('.hdf-donation-modal-wrapper.wdp-modal.show')).toBeVisible();
      await page.waitForTimeout(500);
      expectNoOwn(await axeViolations(page), 'popup');
      await page.keyboard.press('Escape');
    }
    const panel = page.locator('.wdp-open-side-panel').first();
    if (await panel.isVisible()) {
      await page.reload();
      await page.locator('.wdp-open-side-panel').first().click();
      await expect(page.locator('.hdf-donation-modal-wrapper.wdp-modal.wdp-side-panel.show')).toBeVisible();
      await page.waitForTimeout(500);
      expectNoOwn(await axeViolations(page), 'yan panel');
    }
    expect(errors).toEqual([]);
  });

  test('axe: mağaza listesi kartları', async ({ page }) => {
    await page.goto('/shop/');
    await page.waitForLoadState('networkidle');
    expectNoOwn(await axeViolations(page), 'mağaza');
  });

  test('axe: yeni motor her yüzey (popup, yan panel, alttan panel, satır içi form, kampanya kartı, sosyal kanıt)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(kit);
    await page.waitForLoadState('networkidle');
    expectNoOwn(await axeViolations(page), 'kit (kapalı yüzeyler, satır içi form, kampanya, sosyal kanıt)');
    for (const kind of ['popup', 'side_panel', 'bottom_sheet']) {
      await page.goto(kit);
      await page.locator(`[data-dp-kind="${kind}"] [data-dp-open]`).click();
      await expect(page.locator(`[data-dp-kind="${kind}"] [data-dp-overlay].is-open, [data-dp-kind="${kind}"] [data-dp-overlay][data-open], [data-dp-kind="${kind}"] [data-dp-surface]:visible`).first()).toBeVisible();
      await page.waitForTimeout(700);
      expectNoOwn(await axeViolations(page), `yeni ${kind}`);
    }
    expect(errors).toEqual([]);
  });

  test('axe: bağışçı hesabı giriş popup\'ı + yan sepet', async ({ page }) => {
    await page.goto(kit);
    await page.locator('[data-dp-acc-open]').click();
    await expect(page.locator('#dp-ac-dialog')).toBeVisible();
    await page.waitForTimeout(600);
    expectNoOwn(await axeViolations(page), 'hesap popup');
    await page.keyboard.press('Escape');
    const add = await page.request.get(`/?dp_q_add=${IDS.custom}&amount=${STORE.amount || 50}&dedication=${encodeURIComponent(DEDICATION)}`);
    expect((await add.json()).ok).toBe(true);
    await page.goto(kit);
    await page.locator('[data-dp-sc-open]').click();
    await expect(page.locator('[data-dp-sc-overlay].is-open')).toBeVisible();
    await page.waitForTimeout(700);
    expectNoOwn(await axeViolations(page), 'yan sepet');
  });

  test('axe: teşekkür sayfası', async ({ page }) => {
    const r = await page.request.get(`/?dp_q_order=${IDS.custom}&amount=${STORE.amount || 40}`);
    const o = await r.json();
    expect(o.ok).toBe(true);
    await page.goto(new URL(o.received_url).pathname + new URL(o.received_url).search);
    await page.waitForLoadState('networkidle');
    expectNoOwn(await axeViolations(page), 'teşekkür');
  });
});

test.describe('akış ve para birimi', () => {
  test('akış: sepet -> ödeme (blok/klasik) -> sipariş; kayıt eksiksiz, HPOS ayarına uygun', async ({ page }) => {
    const amount = Number(STORE.amount || 50);
    const add = await page.request.get(`/?dp_q_add=${IDS.custom}&amount=${amount}&dedication=${encodeURIComponent(DEDICATION)}`);
    expect((await add.json()).ok).toBe(true);
    await page.goto(new URL(CFG.checkoutUrl).pathname);
    const kind = await detectCheckoutKind(page);
    expect(kind).toBe(CFG.checkout);
    await completeLocalCheckout(page, {
      store: STORE,
      checkoutKind: kind,
      wpDir: process.env.WDP_LOCAL_WP_DIR,
      expected: { amount, currency: STORE.currency, hpos: !!CFG.hpos, dedication: DEDICATION },
    });
  });

  test('para birimi: ödeme sayfasında tutar WooCommerce biçimiyle (sembol, ondalık, ayırıcı)', async ({ page }) => {
    const amount = Number(STORE.amount || 50);
    await page.request.get(`/?dp_q_add=${IDS.custom}&amount=${amount}`);
    await page.goto(new URL(CFG.checkoutUrl).pathname);
    const want = formatMoney(amount, STORE);
    const alt = want.replace(/\s/g, '');
    // Blok ödeme özeti istemci tarafında (Store API) çizilir: görünene dek yokla.
    await expect
      .poll(async () => (await page.locator('body').innerText()).replace(/\u00a0/g, ' ').replace(/\s/g, '').includes(alt), {
        timeout: 20000,
        message: `ödeme metninde ${want} yok`,
      })
      .toBe(true);
  });

  test('para birimi: yeni motor formu ön ayar ve toplam satırı mağaza biçiminde', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(kit);
    await page.locator('[data-dp-kind="popup"] [data-dp-open]').click();
    const surface = page.locator('[data-dp-kind="popup"] [data-dp-surface]');
    await expect(surface).toBeVisible();
    const preset = surface.locator('[data-dp-preset]').first();
    const label = ((await preset.innerText()) || '').replace(/ /g, ' ').replace(/\s/g, '');
    expect(label.includes(String(STORE.symbol || '').replace(/\s/g, '')), `ön ayar ${label}, sembol ${STORE.symbol}`).toBe(true);
    await preset.click();
    const total = (await surface.locator('[data-dp-line="total"]').innerText()).replace(/ /g, ' ').replace(/\s/g, '');
    expect(total.includes(String(STORE.symbol || '').replace(/\s/g, '')), `toplam ${total}`).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('rtl', () => {
  test('rtl: dir=rtl iken yeni motor yüzeyleri ve satır içi form taşmaz, yatay kaydırma yok', async ({ page }) => {
    await page.goto(kit);
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow(), 'kapalı sayfa yatay taşma').toBeLessThanOrEqual(1);
    for (const kind of ['popup', 'side_panel', 'bottom_sheet']) {
      await page.locator(`[data-dp-kind="${kind}"] [data-dp-open]`).click();
      const surface = page.locator(`[data-dp-kind="${kind}"] [data-dp-surface]`);
      await expect(surface).toBeVisible();
      await page.waitForTimeout(800);
      const box = await surface.boundingBox();
      const vp = page.viewportSize();
      expect(box.x, `${kind} sol taşma`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `${kind} sağ taşma`).toBeLessThanOrEqual(vp.width + 1);
      expect(await overflow(), `${kind} yatay taşma`).toBeLessThanOrEqual(1);
      await page.keyboard.press('Escape');
      await expect(surface).toBeHidden();
    }
  });
});
