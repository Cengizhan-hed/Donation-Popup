/**
 * Bağışçı hesabı (E5): iPhone/Android/masaüstü — pencere (dar ekranda alttan panel), giriş/kayıt/şifre sıfırlama,
 * enumeration yok, Bağışlarım (HPOS siparişi, Türkçe karakter), misafir bağışı e-posta doğrulamasıyla bağlama, ödeme notu, axe.
 * YALNIZ yerel WP: `npm run e2e:donor-account [-- --project iphone]`; uzak yok. E-postalar yakalanır (gerçek gönderim yok).
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const NARROW = 639.98;
const PASSWORD = 'dogru-sifre-1';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Benzersiz e-posta (koşu içinde testler birbirinden bağımsız). */
let counter = 0;
const unique = (tag) => `${tag}-${Date.now()}-${(counter += 1)}@example.test`;

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<string[]>} Sayfa hataları.
 */
async function load(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?dp_da_test=1');
  await expect(page.locator('[data-dp-acc-open]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-dp-acc][data-dp-acc-mounted="1"]')).toHaveCount(1);
  return errors;
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} email E-posta.
 * @return {Promise<{donations: string, checkout: string, own: number, guest: number}>} Tohum bilgisi.
 */
async function seed(page, email) {
  const r = await page.request.get(`/?dp_da_seed=1&email=${encodeURIComponent(email)}&pid=${PRODUCT}`);
  expect(r.status(), await r.text()).toBe(200);
  return r.json();
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} to Alıcı.
 * @return {Promise<Array<{to: string, subject: string, body: string}>>} Yakalanan e-postalar.
 */
async function mails(page, to) {
  const r = await page.request.get(`/?dp_da_mails=1&to=${encodeURIComponent(to)}`);
  return r.json();
}

/**
 * Arayüzden giriş yapar; sayfa yenilenince simge Hesabım bağlantısına döner.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} email E-posta.
 */
async function loginViaUi(page, email) {
  await page.locator('[data-dp-acc-open]').click();
  await expect(page.locator('[data-dp-acc-overlay].is-open')).toBeVisible();
  await page.locator('#dp-ac-email').fill(email);
  await page.locator('#dp-ac-password').fill(PASSWORD);
  await page.locator('[data-dp-acc-form="login"] [data-dp-acc-submit]').click();
  await expect(page.locator('a.dp-ac__trigger')).toBeVisible({ timeout: 20000 });
}

test.describe('bağışçı hesabı penceresi', () => {
  test('açılır: dar ekranda alttan panel, geniş ekranda ortada; Esc kapatır, odak döner', async ({ page }) => {
    const errors = await load(page);
    const trigger = page.locator('[data-dp-acc-open]');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(page.locator('[data-dp-acc-overlay].is-open')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(700);
    const box = await page.locator('[data-dp-acc-surface]').boundingBox();
    const vp = page.viewportSize();
    if (vp.width <= NARROW) {
      expect(Math.abs(box.y + box.height - vp.height)).toBeLessThan(2);
      expect(box.width).toBeGreaterThan(vp.width - 2);
    } else {
      expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
      expect(box.width).toBeLessThan(vp.width / 2);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-dp-acc-overlay].is-open')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('odak tuzağı ve dokunma boyutu ≥44 px', async ({ page }) => {
    await load(page);
    await page.locator('[data-dp-acc-open]').click();
    await page.waitForTimeout(700);
    for (let i = 0; i < 9; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('[data-dp-acc-surface]')));
      expect(inside).toBe(true);
    }
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[data-dp-acc-surface] button, [data-dp-acc-surface] input, [data-dp-acc-open]').forEach((node) => {
        const r = node.getBoundingClientRect();
        if (r.height > 0 && (r.height < 43.5 || (node.tagName !== 'INPUT' && r.width < 43.5))) {
          out.push(`${node.tagName}.${node.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      });
      return out;
    });
    expect(small).toEqual([]);
  });

  test('boş alan ve yanlış parola: alan hatası, tek tip ileti (var olan/olmayan hesap aynı)', async ({ page }) => {
    await load(page);
    const known = unique('bilinen');
    await seed(page, known);
    await page.locator('[data-dp-acc-open]').click();
    await page.locator('[data-dp-acc-form="login"] [data-dp-acc-submit]').click();
    await expect(page.locator('#dp-ac-email-err')).toBeVisible();
    await page.locator('#dp-ac-email').fill(unique('yok'));
    await page.locator('#dp-ac-password').fill('yanlis-sifre-9');
    await page.locator('[data-dp-acc-form="login"] [data-dp-acc-submit]').click();
    const box = page.locator('[data-dp-acc-view="login"] [data-dp-acc-error]');
    await expect(box).toBeVisible();
    const unknownText = await box.textContent();
    await page.locator('#dp-ac-email').fill(known);
    await page.locator('[data-dp-acc-form="login"] [data-dp-acc-submit]').click();
    await expect(box).toHaveText(unknownText);
    await expect(page.locator('[data-dp-acc-open]')).toBeVisible();
  });

  test('giriş başarılı: sayfa yenilenir, simge Hesabım bağlantısı olur', async ({ page }) => {
    await load(page);
    const email = unique('giris');
    await seed(page, email);
    await loginViaUi(page, email);
    await expect(page.locator('a.dp-ac__trigger')).toHaveAttribute('href', /my-account|hesab|account/i);
  });

  test('kayıt: yeni e-posta oturum açar; var olan e-posta aynı akışta tek tip giriş iletisiyle döner', async ({ page }) => {
    await load(page);
    await page.locator('[data-dp-acc-open]').click();
    await page.locator('[data-dp-acc-view-btn="register"]').first().click();
    await page.locator('#dp-ac-reg-email').fill(unique('yeni'));
    await page.locator('#dp-ac-reg-password').fill('yeni-sifre-123');
    await page.locator('[data-dp-acc-form="register"] [data-dp-acc-submit]').click();
    await expect(page.locator('a.dp-ac__trigger')).toBeVisible({ timeout: 20000 });

    // Var olan e-posta (başka parola): hesap açılmaz, kullanıcıya hesabın varlığı söylenmez.
    const existing = unique('mevcut');
    await seed(page, existing);
    await page.context().clearCookies();
    await load(page);
    await page.locator('[data-dp-acc-open]').click();
    await page.locator('[data-dp-acc-view-btn="register"]').first().click();
    await page.locator('#dp-ac-reg-email').fill(existing);
    await page.locator('#dp-ac-reg-password').fill('baska-parola-77');
    await page.locator('[data-dp-acc-form="register"] [data-dp-acc-submit]').click();
    const loginError = page.locator('[data-dp-acc-view="login"] [data-dp-acc-error]');
    await expect(loginError).toBeVisible();
    await expect(page.locator('[data-dp-acc-open]')).toBeVisible();
  });

  test('kayıt: kısa parola alan hatası verir', async ({ page }) => {
    await load(page);
    await page.locator('[data-dp-acc-open]').click();
    await page.locator('[data-dp-acc-view-btn="register"]').first().click();
    await page.locator('#dp-ac-reg-email').fill(unique('kisa'));
    await page.locator('#dp-ac-reg-password').fill('kisa');
    await page.locator('[data-dp-acc-form="register"] [data-dp-acc-submit]').click();
    await expect(page.locator('#dp-ac-reg-password-err')).toBeVisible();
  });

  test('şifre sıfırlama: iki durumda da aynı "e-postanızı kontrol edin" görünümü; e-posta yalnız var olan hesaba', async ({ page }) => {
    await load(page);
    const known = unique('sifirla');
    await seed(page, known);
    for (const email of [known, unique('olmayan')]) {
      await page.locator('[data-dp-acc-open]').click();
      await page.locator('[data-dp-acc-view-btn="reset"]').first().click();
      await page.locator('#dp-ac-reset-email').fill(email);
      await page.locator('[data-dp-acc-form="reset"] [data-dp-acc-submit]').click();
      await expect(page.locator('[data-dp-acc-view="sent"]')).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await expect.poll(async () => (await mails(page, known)).length, { timeout: 15000 }).toBeGreaterThan(0);
    expect((await mails(page, 'olmayan')).length).toBe(0);
  });

  test('axe WCAG 2.2 AA: 0 hata (giriş ve kayıt görünümü)', async ({ page }) => {
    await load(page);
    await page.locator('[data-dp-acc-open]').click();
    await page.waitForTimeout(800);
    await page.evaluate(AXE);
    for (const view of ['login', 'register']) {
      if (view === 'register') {
        await page.locator('[data-dp-acc-view-btn="register"]').first().click();
      }
      const result = await page.evaluate(async (tags) => {
        // eslint-disable-next-line no-undef
        return axe.run(document.querySelector('[data-dp-acc-surface]'), { runOnly: { type: 'tag', values: tags } });
      }, AXE_TAGS);
      const summary = result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
      expect(summary, view).toEqual([]);
    }
  });
});

test.describe('Bağışlarım ve misafir bağışı bağlama', () => {
  test('Bağışlarım: yalnız kendi siparişi, Türkçe ithaf, makbuz ve tekrar bağış bağlantısı; misafir siparişi henüz yok', async ({ page }) => {
    const errors = await load(page);
    const email = unique('liste');
    const info = await seed(page, email);
    await loginViaUi(page, email);
    await page.goto(info.donations);
    const cards = page.locator('[data-dp-acc-card]');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Anneannem Şükriye İğdır için');
    await expect(cards.first().locator('[data-dp-acc-receipt]')).toHaveAttribute('href', new RegExp(`view-order/${info.own}`));
    await expect(cards.first().locator('[data-dp-acc-repeat]')).toHaveAttribute('href', /./);
    await expect(page.locator('body')).not.toContainText('Misafir bağışı Çağlar için');
    await expect(page.locator('.woocommerce-MyAccount-navigation a[href*="my-donations"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('misafir bağışı: önce e-postaya bağlantı, onaylanmadan bağlanmaz; onayla bağlanır; bağlantı tek kullanımlık', async ({ page }) => {
    await load(page);
    const email = unique('baglama');
    const info = await seed(page, email);
    await loginViaUi(page, email);
    await page.goto(info.donations);
    await expect(page.locator('[data-dp-acc-page][data-dp-acc-mounted="1"]')).toHaveCount(1);
    await page.locator('[data-dp-acc-link-go]').click();
    await expect(page.locator('[data-dp-acc-link-msg]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-dp-acc-card]')).toHaveCount(1);

    let sent = [];
    await expect.poll(async () => {
      sent = await mails(page, email);
      return sent.filter((m) => /dp_link_guest=/.test(m.body)).length;
    }, { timeout: 15000 }).toBeGreaterThan(0);
    const link = sent.find((m) => /dp_link_guest=/.test(m.body)).body.match(/https?:\/\/\S+dp_link_guest=[A-Za-z0-9%]+/)[0];

    await page.goto(link);
    await expect(page.locator('[data-dp-acc-page][data-dp-acc-mounted="1"]')).toHaveCount(1);
    await expect(page.locator('[data-dp-acc-link][data-mode="confirm"]')).toBeVisible();
    await expect(page.locator('[data-dp-acc-card]')).toHaveCount(1);
    await page.locator('[data-dp-acc-link-go]').click();
    await expect(page.locator('[data-dp-acc-card]')).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('body')).toContainText('Misafir bağışı Çağlar için');

    await page.goto(link);
    await expect(page.locator('[data-dp-acc-page][data-dp-acc-mounted="1"]')).toHaveCount(1);
    await page.locator('[data-dp-acc-link-go]').click();
    await expect(page.locator('[data-dp-acc-link-msg]')).toBeVisible();
    await expect(page.locator('[data-dp-acc-card]')).toHaveCount(2);
  });

  test('başka kullanıcının bağlantısı bu kullanıcıya bağlama yapmaz', async ({ page, browser }) => {
    await load(page);
    const a = unique('sahip');
    const infoA = await seed(page, a);
    await loginViaUi(page, a);
    await page.goto(infoA.donations);
    await expect(page.locator('[data-dp-acc-page][data-dp-acc-mounted="1"]')).toHaveCount(1);
    await page.locator('[data-dp-acc-link-go]').click();
    let sent = [];
    await expect.poll(async () => {
      sent = await mails(page, a);
      return sent.filter((m) => /dp_link_guest=/.test(m.body)).length;
    }, { timeout: 15000 }).toBeGreaterThan(0);
    const link = sent.find((m) => /dp_link_guest=/.test(m.body)).body.match(/https?:\/\/\S+dp_link_guest=[A-Za-z0-9%]+/)[0];

    const ctx = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
    const other = await ctx.newPage();
    const b = unique('baskasi');
    const infoB = await (await other.request.get(`/?dp_da_seed=1&email=${encodeURIComponent(b)}&pid=${PRODUCT}`)).json();
    await other.goto('/?dp_da_test=1');
    await loginViaUi(other, b);
    await other.goto(new URL(link).pathname + new URL(link).search);
    await expect(other.locator('[data-dp-acc-page][data-dp-acc-mounted="1"]')).toHaveCount(1);
    await other.locator('[data-dp-acc-link-go]').click();
    await expect(other.locator('[data-dp-acc-link-msg]')).toBeVisible();
    await other.goto(infoB.donations);
    await expect(other.locator('[data-dp-acc-card]')).toHaveCount(1);
    await ctx.close();
  });

  test('axe WCAG 2.2 AA: 0 hata (Bağışlarım sayfası, bağlama kutusu)', async ({ page }) => {
    await load(page);
    const email = unique('axe');
    const info = await seed(page, email);
    await loginViaUi(page, email);
    await page.goto(info.donations);
    await expect(page.locator('[data-dp-acc-card]').first()).toBeVisible();
    await page.evaluate(AXE);
    const result = await page.evaluate(async (tags) => {
      // eslint-disable-next-line no-undef
      return axe.run(document.querySelector('[data-dp-acc-page]'), { runOnly: { type: 'tag', values: tags } });
    }, AXE_TAGS);
    const summary = result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
    expect(summary).toEqual([]);
  });
});

test.describe('ödeme sayfası', () => {
  test('hesap oluşturma açıklaması WooCommerce kayıt kutusunun üstünde görünür', async ({ page }) => {
    const add = await page.request.get(`/?dp_da_add=${PRODUCT}&amount=40`);
    expect((await add.json()).ok).toBe(true);
    const info = await (await page.request.get(`/?dp_da_seed=1&email=${encodeURIComponent(unique('odeme'))}&pid=${PRODUCT}`)).json();
    await page.goto(info.checkout);
    await expect(page.locator('.dp-ac__checkout-note')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#createaccount')).toBeAttached();
  });
});
