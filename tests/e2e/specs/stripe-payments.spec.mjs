/**
 * 12.4 Stripe (TEST modu) uçtan uca — YALNIZ yerel WP: `npm run e2e:queue -- node tests/e2e/run-stripe.mjs [--project desktop] [--checkout blocks]`.
 * Resmi "WooCommerce Stripe Payment Gateway" + `stripe listen` webhook yönlendirmesi; eklentimiz Stripe'a özel kod içermez.
 * Anahtar yoksa (run-stripe.mjs WDP_STRIPE_READY vermez) spec ATLANIR.
 *
 * Her senaryo sepetli ve doğrudan (sepetsiz) bağışta: başarılı, 3DS tamam, 3DS red, reddedilen kart + yeniden deneme,
 * yarıda bırakma, gecikmeli teyit (istemci doğrulaması kesilir → durum webhook ile güncellenir).
 * Denetim: sipariş durumu, kanca sayıları (yinelenmez), kampanya toplamı yalnız ödenen siparişte ve bir kez, canlı çubuk,
 * bağışçı alanları (Türkçe karakter) siparişte, e-posta (Mailpit). Ağ: birinci taraf + yalnız Stripe alan adları.
 */
import { test, expect } from '@playwright/test';
import { applyLocalThirdPartyAllowlist } from '../helpers/network-guard.mjs';
import { clearMailbox, listMessages, waitForMessages, recipients } from '../helpers/mailpit.mjs';
import {
  CARDS,
  THANKS_URL,
  expectRaised,
  answer3ds,
  assertLocal,
  fillBilling,
  hookCounts,
  moneyPattern,
  openAndSubmit,
  placeOrder,
  record,
  state,
  typeCard,
  visibleError,
} from '../helpers/stripe-flow.mjs';

const READY = process.env.WDP_STRIPE_READY === '1';
const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const CHECKOUT = process.env.WDP_EXP_CHECKOUT === 'blocks' ? 'blocks' : 'classic';
const STORE = JSON.parse(process.env.WDP_EXP_STORE || '{}');
const PAID = ['processing', 'completed'];
const VERIFY = /wc-ajax=wc_stripe_(verify_intent|update_order_status)/;

test.skip(!READY, 'Stripe test anahtarı yok ya da koşu run-stripe.mjs dışında: spec atlandı (yalnız yerel, anahtar .env.stripe.local).');

/** @param {string} flow @param {string} scenario @param {string} project */
function donor(flow, scenario, project) {
  return {
    name: 'Çağlar Şükrü Öztürk İğdır',
    phone: '+44 7700 900123',
    email: `stripe-${flow}-${scenario}-${project}@wdp-e2e.test`,
    note: 'Ğüşiöç ĞÜŞİÖÇ notu',
  };
}

/** @param {string} url */
function orderIdFrom(url) {
  const m = String(url).match(/order-(?:received|pay)\/(\d+)/) || String(url).match(/[?&]order(?:-pay|-received)?=(\d+)/);
  return m ? Number(m[1]) : 0;
}

test.describe('Stripe test modu (yerel)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    assertLocal(baseURL);
    const stats = await applyLocalThirdPartyAllowlist(page.context(), { siteHost: new URL(String(baseURL)).hostname });
    // @ts-ignore test başına sayaç
    page.__guard = stats;
  });

  test.afterEach(async ({ page }, info) => {
    // @ts-ignore
    const g = page.__guard || { blocked: [], allowed: {} };
    const foreign = g.blocked.filter((h) => !/stripe\.com$|hcaptcha\.com$/.test(h));
    info.annotations.push({ type: 'guard', description: `izinli=${Object.keys(g.allowed).length} engellenen=${g.blocked.length}` });
    expect(Object.keys(g.allowed).every((h) => /(^|\.)(stripe\.com|stripe\.network|stripecdn\.com)$/.test(h)), 'yalnız Stripe alan adları geçti').toBe(true);
    record({ guard: true, test: info.title, project: info.project.name, blockedHosts: [...new Set(g.blocked)], foreignBlocked: foreign.length });
  });

  for (const flow of ['cart', 'direct']) {
    const direct = flow === 'direct';

    test(`${flow}: başarılı ödeme → durum, kancalar bir kez, toplam bir kez, canlı çubuk, alanlar, e-posta`, async ({ page, request, baseURL }, info) => {
      test.setTimeout(300000);
      const d = donor(flow, 'ok', info.project.name);
      const amount = '125';
      const before = await state(request, PRODUCT);
      const since = before.now;
      await clearMailbox();
      await openAndSubmit(page, { baseURL: String(baseURL), product: PRODUCT, direct, amount, donor: d });
      await fillBilling(page, { direct, checkout: CHECKOUT, store: STORE, donor: d });
      await typeCard(page, CARDS.success);
      await placeOrder(page, direct);
      await page.waitForURL(THANKS_URL, { timeout: 60000 });
      const orderId = orderIdFrom(page.url());
      expect(orderId).toBeGreaterThan(0);
      await expect(page.locator('[data-dp-thanks]'), 'teşekkür özeti bir kez').toHaveCount(1);
      // Tutar mağazanın Woo para biçimiyle (simge konumu, ayraçlar, ondalık) teşekkür sayfasında.
      const money = moneyPattern(STORE, Number(amount));
      await expect(page.locator('body'), `teşekkür sayfasında ${money}`).toContainText(money);
      await expect(page.locator('[data-dp-thanks]'), 'teşekkür özetinde biçimli tutar').toContainText(money);

      // Webhook'lar (payment_intent.succeeded / charge.succeeded) gelsin; yine de tek sayım.
      await expect.poll(async () => (await state(request, PRODUCT, since)).log.filter((r) => r.e === 'webhook_in').length, { timeout: 45000, message: 'webhook ulaştı' }).toBeGreaterThan(0);
      await page.waitForTimeout(3000);
      const after = await state(request, PRODUCT, since);
      const order = after.orders.find((o) => o.id === orderId);
      expect(order, 'sipariş').toBeTruthy();
      expect(PAID).toContain(order.status);
      expect(order.method).toBe('stripe');
      expect(order.paid && order.txn, 'ödeme tarihi + işlem kimliği var').toBe(true);
      expect(order.counted).toBe('yes');
      const hooks = hookCounts(after.log, orderId);
      expect(hooks.payment_complete, 'woocommerce_payment_complete bir kez').toBe(1);
      expect(hooks.to_processing, 'ödenmiş duruma geçiş bir kez').toBe(1);
      expect(hooks.thankyou, 'teşekkür kancası bir kez').toBe(1);
      expectRaised(before, after, { paidOrder: orderId, amount: Number(amount) });
      expect(after.donors - before.donors, 'bağışçı sayısı ödenen sipariş kadar').toBe(after.paid.ids.length);

      // Veri bütünlüğü: bağışçının yazdığı alanlar eksiksiz, Türkçe karakter bozulmadan.
      const item = order.items.find((i) => String(i.product) === String(PRODUCT));
      expect(item.name).toBe(d.name);
      expect(item.phone).toBe(d.phone);
      expect(item.note).toBe(d.note);
      expect(order.email_set).toBe(true);
      expect(`${order.first} ${order.last}`.trim()).toBe(d.name);

      // Canlı ilerleme çubuğu ödeme sonrası yeni toplamı gösterir (REST + sayfadaki kart).
      const rest = await request.get(`/?rest_route=/donation-panel/v1/progress/${PRODUCT}&_=${Date.now()}`);
      expect((await rest.json()).raised).toBeCloseTo(after.raised, 2);
      await page.goto(`/?dp_stripe=form&dp_product=${PRODUCT}`);
      const raisedText = page.locator('#sp-card [data-dp-live-raised]');
      // Mağaza ayraçlarıyla çözümle (TRY ₺1.250 / GBP £1,250.00 / EUR 1.250,00 €).
      const parseMoney = (t) => {
        let s = String(t || '').replace(/[^\d.,]/g, '');
        if (STORE.thousandSeparator) s = s.split(STORE.thousandSeparator).join('');
        if (STORE.decimalSeparator && STORE.decimalSeparator !== '.') s = s.replace(STORE.decimalSeparator, '.');
        return Number.parseFloat(s);
      };
      await expect.poll(async () => Math.round(parseMoney(await raisedText.textContent())), { timeout: 15000 }).toBe(Math.round(after.raised));

      // E-posta: müşteri + yönetici, ad/telefon/not Türkçe karakterlerle.
      // Önceki senaryodan geç gelen teyit e-postası da kutuya düşebilir: yalnız bu siparişin iletileri denetlenir.
      await expect.poll(async () => (await listMessages()).filter((m) => recipients(m).includes(d.email)).length, { timeout: 60000, message: 'bağışçıya e-posta' }).toBeGreaterThanOrEqual(1);
      const all = await waitForMessages({ min: 2, timeoutMs: 30000 });
      const messages = all.filter((m) => `${m.Subject || ''} ${m.Text || ''}`.includes(String(orderId)));
      const toDonor = messages.filter((m) => recipients(m).includes(d.email));
      expect(toDonor.length, 'bağışçıya e-posta').toBeGreaterThanOrEqual(1);
      expect(messages.length - toDonor.length, 'yöneticiye e-posta').toBeGreaterThanOrEqual(1);
      for (const m of messages) {
        const text = String(m.Text || '');
        expect(text).toContain(d.name);
        expect(text).toContain(d.note);
        expect(String(m.HTML || '') + text).not.toMatch(/�|Ã§|Ä±|ÅŸ/);
        expect(text, 'e-postada biçimli tutar').toMatch(money);
      }
      record({ scenario: 'basarili', flow, project: info.project.name, currency: STORE.currency, money: String(money), status: order.status, hooks, raisedDelta: after.raised - before.raised, mails: messages.length });
    });

    test(`${flow}: 3D Secure tamamlandı → başarı, toplam bir kez`, async ({ page, request, baseURL }, info) => {
      test.setTimeout(300000);
      const d = donor(flow, '3ds', info.project.name);
      const amount = '140';
      const before = await state(request, PRODUCT);
      await openAndSubmit(page, { baseURL: String(baseURL), product: PRODUCT, direct, amount, donor: d });
      await fillBilling(page, { direct, checkout: CHECKOUT, store: STORE, donor: d });
      await typeCard(page, CARDS.threeds);
      await placeOrder(page, direct);
      await answer3ds(page, 'complete');
      await page.waitForURL(THANKS_URL, { timeout: 60000 });
      const orderId = orderIdFrom(page.url());
      await expect(page.locator('[data-dp-thanks]')).toHaveCount(1);
      await page.waitForTimeout(4000);
      const after = await state(request, PRODUCT, before.now);
      const order = after.orders.find((o) => o.id === orderId);
      expect(PAID).toContain(order.status);
      const hooks = hookCounts(after.log, orderId);
      expect(hooks.payment_complete).toBe(1);
      expect(hooks.to_processing).toBe(1);
      expectRaised(before, after, { paidOrder: orderId, amount: Number(amount) });
      record({ scenario: '3ds-tamam', flow, project: info.project.name, status: order.status, hooks, raisedDelta: after.raised - before.raised });
    });

    test(`${flow}: 3D Secure reddedildi → ödenmedi, toplam artmaz, akış kilitlenmez`, async ({ page, request, baseURL }, info) => {
      test.setTimeout(300000);
      const d = donor(flow, '3dsfail', info.project.name);
      const before = await state(request, PRODUCT);
      await openAndSubmit(page, { baseURL: String(baseURL), product: PRODUCT, direct, amount: '150', donor: d });
      await fillBilling(page, { direct, checkout: CHECKOUT, store: STORE, donor: d });
      await typeCard(page, CARDS.threeds);
      await placeOrder(page, direct);
      await answer3ds(page, 'fail');
      const error = await visibleError(page);
      expect(page.url()).not.toMatch(THANKS_URL);
      await expect(direct ? page.locator('#place_order') : page.locator('form.checkout, .wc-block-checkout').first()).not.toHaveClass(/processing/);
      await page.waitForTimeout(5000);
      const after = await state(request, PRODUCT, before.now);
      const mine = after.orders.filter((o) => o.method === 'stripe' || o.via === 'donation_panel_direct');
      expect(mine.length).toBeGreaterThanOrEqual(1);
      for (const o of mine) expect(PAID, `sipariş ${o.id} ödenmiş sayılmamalı`).not.toContain(o.status);
      expectRaised(before, after, { unpaid: mine.map((o) => o.id) });
      record({ scenario: '3ds-red', flow, project: info.project.name, statuses: mine.map((o) => o.status), errorShown: error.length > 0, raisedDelta: 0 });
    });

    test(`${flow}: reddedilen kart → anlaşılır hata, yeniden deneme başarılı, toplam bir kez`, async ({ page, request, baseURL }, info) => {
      test.setTimeout(300000);
      const d = donor(flow, 'declined', info.project.name);
      const amount = '160';
      const before = await state(request, PRODUCT);
      await openAndSubmit(page, { baseURL: String(baseURL), product: PRODUCT, direct, amount, donor: d });
      await fillBilling(page, { direct, checkout: CHECKOUT, store: STORE, donor: d });
      await typeCard(page, CARDS.declined);
      await placeOrder(page, direct);
      const error = await visibleError(page);
      expect(error, 'kart reddi metni').toMatch(/declin|reddedil|card|kart/i);
      const mid = await state(request, PRODUCT, before.now);
      expectRaised(before, mid, { unpaid: mid.orders.map((o) => o.id) });
      // Aynı sayfada yeniden dene.
      await typeCard(page, CARDS.success);
      await placeOrder(page, direct);
      await page.waitForURL(THANKS_URL, { timeout: 60000 });
      const orderId = orderIdFrom(page.url());
      await page.waitForTimeout(4000);
      const after = await state(request, PRODUCT, before.now);
      const order = after.orders.find((o) => o.id === orderId);
      expect(PAID).toContain(order.status);
      expect(hookCounts(after.log, orderId).payment_complete).toBe(1);
      expectRaised(before, after, { paidOrder: orderId, amount: Number(amount) });
      const unpaid = after.orders.filter((o) => o.id !== orderId && !PAID.includes(o.status));
      record({ scenario: 'red-kart+tekrar', flow, project: info.project.name, status: order.status, extraUnpaidOrders: unpaid.length, errorShown: true, raisedDelta: after.raised - before.raised });
    });

    test(`${flow}: yarıda bırakma (3DS penceresi kapatılır) → ödenmez, toplam artmaz, yeniden bağış sorunsuz`, async ({ page, request, baseURL }, info) => {
      test.setTimeout(300000);
      const d = donor(flow, 'abandon', info.project.name);
      const before = await state(request, PRODUCT);
      await openAndSubmit(page, { baseURL: String(baseURL), product: PRODUCT, direct, amount: '170', donor: d });
      await fillBilling(page, { direct, checkout: CHECKOUT, store: STORE, donor: d });
      await typeCard(page, CARDS.threeds);
      await placeOrder(page, direct);
      await answer3ds(page, 'cancel');
      await page.waitForTimeout(3000);
      // Ödeme sayfasından ayrıl.
      await page.goto(`/?dp_stripe=form&dp_product=${PRODUCT}`);
      const mid = await state(request, PRODUCT, before.now);
      for (const o of mid.orders) expect(PAID).not.toContain(o.status);
      expectRaised(before, mid, { unpaid: mid.orders.map((o) => o.id) });
      // Yeniden bağış: form açılır, ödeme adımına ulaşır (doğrudan akışta aynı içerik aynı bekleyen siparişi bulur).
      await openAndSubmit(page, { baseURL: String(baseURL), product: PRODUCT, direct, amount: '170', donor: d });
      const after = await state(request, PRODUCT, before.now);
      // Başarısız (failed) kayıt kalabilir (geçidin kaydı); ödeme bekleyen (pending) en çok bir sipariş.
      const directPending = after.orders.filter((o) => o.via === 'donation_panel_direct' && o.status === 'pending');
      if (direct) expect(directPending.length, 'yeniden bağışta ikinci bekleyen sipariş açılmaz').toBeLessThanOrEqual(1);
      expectRaised(before, after, { unpaid: after.orders.map((o) => o.id) });
      record({ scenario: 'yarida-birakma', flow, project: info.project.name, statuses: mid.orders.map((o) => o.status), pendingLeft: after.orders.filter((o) => !PAID.includes(o.status)).length, raisedDelta: 0 });
    });

    test(`${flow}: gecikmeli teyit — istemci doğrulaması kesilir, durumu webhook günceller, toplam bir kez`, async ({ page, request, baseURL }, info) => {
      test.setTimeout(480000);
      const d = donor(flow, 'webhook', info.project.name);
      const amount = '180';
      const before = await state(request, PRODUCT);
      let aborted = 0;
      await page.route(VERIFY, async (route) => {
        aborted += 1;
        await route.abort('failed');
      });
      await openAndSubmit(page, { baseURL: String(baseURL), product: PRODUCT, direct, amount, donor: d });
      await fillBilling(page, { direct, checkout: CHECKOUT, store: STORE, donor: d });
      await typeCard(page, CARDS.threeds);
      await placeOrder(page, direct);
      await answer3ds(page, 'complete');
      await expect.poll(() => aborted, { timeout: 30000, message: 'istemci doğrulaması kesildi' }).toBeGreaterThan(0);
      // İstemci dönmedi: sipariş ödenmemiş bekler; webhook geldi ama geçit siparişi 5 dk kilitli tutar ve işi Action Scheduler'a
      // erteler (10 sn'de bir yeniden dener). Yerel işçide WP-Cron kapalı: cron'un yapacağını uç çalıştırır; 20 sn sonra hâlâ
      // ödenmediyse kilit süresi dolmuş sayılır (gerçekte ≤5 dk bekleme).
      const pending = (await state(request, PRODUCT, before.now)).orders.find((o) => o.method === 'stripe');
      expect(pending, 'istemci dönmeden sipariş').toBeTruthy();
      expect(PAID, 'istemci doğrulaması olmadan henüz ödenmiş değil').not.toContain(pending.status);
      const t0 = Date.now();
      let lockExpired = false;
      let order = null;
      await expect
        .poll(
          async () => {
            const s = await state(request, PRODUCT, before.now);
            order = s.orders.find((o) => o.id === pending.id && PAID.includes(o.status)) || null;
            if (!order) {
              const expire = !lockExpired && Date.now() - t0 > 20000;
              const cron = await request.get(`/?dp_stripe_cron=1${expire ? `&dp_expire_lock=${pending.id}` : ''}&_=${Date.now()}`);
              expect(cron.status()).toBe(200);
              if (expire) lockExpired = true;
            }
            return order ? order.status : 'bekliyor';
          },
          // Geçit kartlı ödemenin payment_intent.succeeded işlemesini 2 dk erteler (deferred_webhook_delay): ≤4 dk bekle.
          { timeout: 240000, intervals: [5000], message: 'webhook ile ödenmiş durum' }
        )
        .toMatch(/processing|completed/);
      const after = await state(request, PRODUCT, before.now);
      const hooks = hookCounts(after.log, order.id);
      expect(hooks.payment_complete).toBe(1);
      expect(hooks.to_processing).toBe(1);
      expect(hooks.statuses.some((s) => /@(webhook|cron-webhook)$/.test(s)), `durum webhook işleyicisinden: ${hooks.statuses.join(',')}`).toBe(true);
      expectRaised(before, after, { paidOrder: order.id, amount: Number(amount) });
      record({ scenario: 'webhook-gecikmeli', flow, project: info.project.name, status: order.status, hooks, verifyAborted: aborted, lockExpiredSimulated: lockExpired, raisedDelta: after.raised - before.raised });
    });
  }
});
