/**
 * 12.4 Stripe e2e yardımcıları (YALNIZ yerel WP; `run-stripe.mjs`). Eklentimiz Stripe'a özel kod içermez: burada yalnız
 * test sürücüsü (Stripe Payment Element çerçevesi + 3D Secure test sayfası) ve yerel gözlem ucu (wdp-stripe-sim.php) var.
 * Ödeme kimlikleri/istemci sırları hiçbir yere yazılmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { fillCheckout, findPlaceOrderButton } from './place-order.mjs';

export const CARDS = Object.freeze({
  success: '4242424242424242',
  threeds: '4000002500003155',
  declined: '4000000000000002',
});

export const RESULTS_DIR = path.resolve(process.cwd(), 'build/handoff/RAPOR-124-stripe');

/** Ödeme adımı / teşekkür adresleri. */
export const PAY_URL = /checkout|odeme|ödeme|order-pay/i;
// order-pay adresi de `key=wc_order` taşır: teşekkür yalnız order-received.
export const THANKS_URL = /order-received/i;

/** Görünür hata bildirimleri (klasik + blok ödeme + order-pay). */
const NOTICE = '.woocommerce-error, .woocommerce-NoticeGroup-checkout, .wc-block-components-notice-banner.is-error, .woocommerce-notices-wrapper [role="alert"]';

/** @param {string} baseURL */
export function assertLocal(baseURL) {
  expect(String(baseURL || '')).toMatch(/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/);
}

/**
 * Yerel gözlem ucu: ürün toplamı + `since` sonrası siparişler + kanca günlüğü.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {number|string} product
 * @param {number} since Sunucu zamanı (sn).
 */
export async function state(request, product, since = 0) {
  const r = await request.get(`/?dp_stripe_state=1&dp_product=${product}&dp_since=${since}&_=${Date.now()}`);
  expect(r.status(), 'gözlem ucu').toBe(200);
  return r.json();
}

/**
 * Form → (bilgiler) → ödeme adımı. Doğrudan akışta `dp_direct` çerezi (yerel mu-plugin süzgeci) açıktır.
 * @param {import('@playwright/test').Page} page
 * @param {{ baseURL: string, product: string|number, direct: boolean, amount: string, donor: { name: string, phone: string, email: string, note: string } }} o
 */
export async function openAndSubmit(page, o) {
  if (o.direct) await page.context().addCookies([{ name: 'dp_direct', value: '1', url: o.baseURL }]);
  await page.goto(`/?dp_stripe=form&dp_product=${o.product}`);
  const form = page.locator('#sp-form [data-dp-form]');
  await expect(form).toBeVisible({ timeout: 20000 });
  if (o.direct) await expect(form).toHaveAttribute('data-direct', '1');
  await form.locator('input[name="amount"]').fill(o.amount);
  await form.locator('[data-dp-submit]').click();
  await expect(form.locator('[data-dp-step="details"]')).toBeVisible();
  await form.locator('input[name="donation_full_name"]').fill(o.donor.name);
  await form.locator('input[name="donation_phone"]').fill(o.donor.phone);
  const email = form.locator('input[name="donation_email"]');
  if (o.direct) await expect(email, 'doğrudan akışta e-posta alanı zorunlu').toHaveAttribute('required', '');
  if (await email.count()) await email.fill(o.donor.email);
  await form.locator('[data-dp-note-toggle]').click();
  await form.locator('textarea[name="donation_note"]').fill(o.donor.note);
  await form.locator('[data-dp-submit]').click();
  const tax = form.locator('[data-dp-step="tax_relief"]');
  if (await tax.isVisible()) await form.locator('[data-dp-submit]').click();
  await page.waitForURL(PAY_URL, { timeout: 30000 });
  if (o.direct) expect(page.url(), 'doğrudan akış order-pay sayfasına gider').toMatch(/order-pay/);
}

/**
 * Sepetli akışta WooCommerce ödeme formu (klasik/blok) doldurulur; doğrudan akışta order-pay fatura sormaz.
 * @param {import('@playwright/test').Page} page
 * @param {{ direct: boolean, checkout: string, store: object, donor: object }} o
 */
export async function fillBilling(page, o) {
  if (o.direct) return;
  await fillCheckout(page, o.checkout, o.store, o.donor);
}

/**
 * Kart alanlarını taşıyan Stripe Payment Element çerçevesi.
 * @param {import('@playwright/test').Page} page
 * @return {Promise<import('@playwright/test').Frame>}
 */
export async function cardFrame(page) {
  let found = null;
  await expect
    .poll(
      async () => {
        for (const f of page.frames()) {
          if (!/stripe\.com/.test(f.url()) || f.isDetached()) continue;
          // Hatadan sonra ödeme bölümü yeniden çizilir: eski (gizli) çerçeve değil, görünen çerçeve.
          const host = await f.frameElement();
          if (!(await host.isVisible())) continue;
          if ((await f.locator('input[name="number"]').count()) > 0) {
            found = f;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000, message: 'Stripe kart çerçevesi' }
    )
    .toBe(true);
  return /** @type {any} */ (found);
}

/**
 * Stripe Elements `fill` ile tamamlanmış saymaz: tuş tuş yazılır.
 * @param {import('@playwright/test').Page} page
 * @param {string} number
 */
export async function typeCard(page, number) {
  const f = await cardFrame(page);
  // Hata bildirimi sonrası Stripe alanı geçişte olabilir (görünürlük denetimi takılır): odak + klavye, tıklama yok.
  for (const [name, value] of [['number', number], ['expiry', '1234'], ['cvc', '123']]) {
    const input = f.locator(`input[name="${name}"]`);
    await input.focus();
    await input.press('ControlOrMeta+a');
    await input.press('Backspace');
    await input.pressSequentially(value, { delay: 25 });
  }
  const postal = f.locator('input[name="postalCode"]');
  if ((await postal.count()) > 0 && (await postal.isVisible())) await postal.fill('34000');
}

/**
 * Ödeme düğmesi. Stripe'ın "Link" bölümü odak değişince yer değiştirir: önce görünür alana alınır ve konumu durulur.
 * @param {import('@playwright/test').Page} page
 * @param {boolean} direct
 */
export async function placeOrder(page, direct) {
  const btn = direct ? page.locator('#place_order') : await findPlaceOrderButton(page);
  if (!btn) throw new Error('ödeme düğmesi yok');
  await btn.scrollIntoViewIfNeeded();
  let last = '';
  await expect
    .poll(async () => {
      const b = await btn.boundingBox();
      const now = b ? `${Math.round(b.x)}:${Math.round(b.y)}` : '';
      const stable = now !== '' && now === last;
      last = now;
      return stable;
    }, { timeout: 5000, intervals: [150] })
    .toBe(true);
  await btn.click({ noWaitAfter: true });
}

/**
 * Stripe 3D Secure test sayfası: COMPLETE / FAIL; `cancel` dış kabuğun kapat/iptal düğmesi (yarıda bırakma).
 * @param {import('@playwright/test').Page} page
 * @param {'complete'|'fail'|'cancel'} action
 */
export async function answer3ds(page, action) {
  // "İptal": büyük İ /i ile i'ye katlanmaz → kök eşleşmesi.
  const re = action === 'complete' ? /^complete$/i : action === 'fail' ? /^fail$/i : /ptal$|^cancel$|^close$|^kapat$/i;
  const challengeOpen = () => page.frames().some((f) => /three-ds-2-challenge|testmode-acs\.stripe\.com/.test(f.url()));
  /** @return {Promise<import('@playwright/test').Locator|null>} */
  const findButton = async () => {
    for (const f of page.frames()) {
      const u = f.url();
      const inChallenge = action === 'cancel' ? /three-ds-2-challenge/.test(u) : /testmode-acs\.stripe\.com|3d_secure/.test(u);
      if (!inChallenge) continue;
      const b = f.getByRole('button', { name: re });
      try {
        if ((await b.count()) > 0) return b.first();
      } catch (e) {
        // Çerçeve bu arada kalktı (sınama bitti): düğme yok sayılır.
        if (!/detached|destroyed|Target closed/i.test(String(e && e.message))) throw e;
      }
    }
    return null;
  };
  await expect.poll(async () => Boolean(await findButton()), { timeout: 45000, message: `3DS düğmesi (${action})` }).toBe(true);
  // Test sayfası düğmeleri yüklenir yüklenmez tıklanınca tepki vermeyebilir: kapanana dek (en çok 4 kez) yeniden tıkla.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const btn = await findButton();
    if (!btn) break;
    await page.waitForTimeout(attempt === 0 ? 800 : 300);
    await btn.click({ timeout: 10000 });
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && (await findButton())) await page.waitForTimeout(250);
    if (!(await findButton())) break;
  }
  await expect.poll(async () => Boolean(await findButton()), { timeout: 15000, message: `3DS kapanmadı (${action})` }).toBe(false);
  return challengeOpen();
}

/**
 * Görünür hata metni (boş değilse) — panel/akış kilitlenmedi mi diye düğme de denetlenir.
 * @param {import('@playwright/test').Page} page
 * @return {Promise<string>}
 */
export async function visibleError(page) {
  let text = '';
  await expect
    .poll(
      async () => {
        let parts = [];
        try {
          parts = await page.locator(NOTICE).allInnerTexts();
        } catch (e) {
          // order-pay formu gönderilince sayfa yenilenir: bu turda bağlam yok, sonraki turda yeniden okunur.
          if (!/Execution context was destroyed|navigation/i.test(String(e && e.message))) throw e;
        }
        text = parts.join(' ').replace(/\s+/g, ' ').trim();
        return text.length;
      },
      { timeout: 30000, message: 'görünür ödeme hatası' }
    )
    .toBeGreaterThan(0);
  return text;
}

/**
 * Kampanya toplamı: artış = `since` sonrası ödenmiş duruma geçen siparişlerin bu üründeki bağış tutarı (her biri BİR kez).
 * Önceki senaryodan geç gelen teyit (webhook) de bu kurala girer; böylece çift sayım ve ödenmemiş siparişin sayılması yakalanır.
 * @param {{ raised: number }} before
 * @param {{ raised: number, paid: { ids: number[], sum: number } }} after
 * @param {{ paidOrder?: number, amount?: number, unpaid?: number[] }} [o]
 * @return {number} Artış.
 */
export function expectRaised(before, after, o = {}) {
  const delta = after.raised - before.raised;
  expect(delta, `toplam artışı ödenen siparişlerin tutarı kadar (ödenen: ${after.paid.ids.join(',') || '-'})`).toBeCloseTo(after.paid.sum, 2);
  if (o.paidOrder) {
    expect(after.paid.ids, 'bu sipariş ödenmiş sayıldı').toContain(o.paidOrder);
    expect(after.paid.sum).toBeGreaterThanOrEqual(Number(o.amount || 0) - 0.005);
  }
  for (const id of o.unpaid || []) expect(after.paid.ids, `sipariş ${id} toplama girmez`).not.toContain(id);
  return delta;
}

/**
 * Kanca günlüğünden sayımlar.
 * @param {Array<Record<string, any>>} log
 * @param {number} orderId
 */
export function hookCounts(log, orderId) {
  const mine = log.filter((r) => r.o === orderId);
  return {
    payment_complete: mine.filter((r) => r.e === 'payment_complete').length,
    to_processing: mine.filter((r) => r.e === 'status' && (r.to === 'processing' || r.to === 'completed')).length,
    thankyou: mine.filter((r) => r.e === 'thankyou').length,
    via_webhook: mine.filter((r) => r.e === 'status' && r.via === 'webhook').length,
    statuses: mine.filter((r) => r.e === 'status').map((r) => `${r.from}>${r.to}@${r.via}`),
  };
}

/**
 * Senaryo sonucunu rapor dosyasına ekler (yalnız sayılar/durumlar; kişisel veri ya da ödeme kimliği yok).
 * @param {Record<string, unknown>} row
 */
export function record(row) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `results-${process.env.WDP_STRIPE_STORE_KEY || 'try'}-${process.env.WDP_EXP_CHECKOUT || 'classic'}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(row) + '\n');
}
