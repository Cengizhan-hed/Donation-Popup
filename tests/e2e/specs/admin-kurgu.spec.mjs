/**
 * 12.3 kurgu (yönetici): Sepet ve ödeme → "Bağışçılar nasıl öder" (genel + 5 tür), ürün ekranında geçerli değer + kaynak,
 * ayarda görünen = ön yüzde uygulanan (form `data-direct`), Formlar ve görünüm → Compact kart (kısa kod oluşturucu,
 * yükseklik tablosu), Rehber iki bölüm (ekran yolu + kısa kod + şema), axe WCAG 2.2 AA 0, mobil taşma 0.
 * YALNIZ yerel WP: `npm run e2e:queue -- npm run e2e:admin-e7 -- --env local --spec admin-kurgu`.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SHOTS = process.env.WDP_ADM_SHOTS || '';
const PID = Number(process.env.WDP_EXP_PRODUCT_ID || 0);
const P = (slug) => `/wp-admin/admin.php?page=${slug}`;

test.describe.configure({ mode: 'serial' });

async function login(page) {
  const r = await page.request.get('/?dp_ad_login=1&role=administrator');
  expect(r.status(), await r.text()).toBe(200);
}
async function state(page) {
  return (await page.request.get('/?dp_ad_state=1')).json();
}
async function axe(page, where = '.dpa') {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(
    async ({ tags, ctx }) => {
      const out = await window.axe.run(ctx, { runOnly: { type: 'tag', values: tags } });
      return out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
    },
    { tags: AXE_TAGS, ctx: where },
  );
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}
async function shot(page, info, name, locator = null) {
  if (!SHOTS) return;
  const dev = info.project.name === 'desktop' ? 'masaustu' : info.project.name;
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, `${name}-${dev}.png`);
  if (locator) {
    await locator.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: false });
  }
}
async function saveType(page, type, value) {
  await page.goto(P('donation-panel-checkout'));
  await page.selectOption(`#dpa-f-direct-type_${type}`, value);
  await page.click('[data-dpa-save]');
  await expect(page.locator('[data-dpa-msg]')).toHaveText(/Saved|Kaydedildi/);
}
/** Ürün sayfasındaki formun ödeme davranışı (`data-direct`). */
async function frontDirect(page) {
  await page.goto(`/?p=${PID}`);
  const trigger = page.locator('.donation-panel-trigger, [data-dp-open]').first();
  if (await trigger.count()) {
    await trigger.click();
  }
  const form = page.locator('[data-dp-form]').first();
  await expect(form).toBeAttached({ timeout: 20000 });
  // Sepetli formda öznitelik yazılmaz.
  return (await form.getAttribute('data-direct')) === '1' ? '1' : '0';
}

test.beforeEach(async ({ page }) => {
  test.skip(!PID, 'ürün yok');
  await login(page);
  expect((await page.request.get('/?dp_ad_reset=1')).status()).toBe(200);
});

test('Sepet ve ödeme: "Bağışçılar nasıl öder" bölümü başta; genel + 5 tür, her birinin altında açıklama; axe 0', async ({ page }, info) => {
  await page.goto(P('donation-panel-checkout'));
  const section = page.locator('#dpa-s-payment');
  await expect(section).toBeVisible();
  expect(await page.locator('.dpa-card--section').first().getAttribute('id')).toBe('dpa-s-payment');
  await expect(section.locator('#dpa-f-direct-enabled')).toBeAttached();
  for (const type of ['fixed', 'custom', 'shares', 'campaign', 'addon']) {
    const select = section.locator(`#dpa-f-direct-type_${type}`);
    await expect(select).toBeVisible();
    expect(await select.locator('option').evaluateAll((o) => o.map((x) => x.value))).toEqual(['', 'cart', 'direct']);
    await expect(section.locator(`#dpa-f-direct-type_${type}-desc`)).not.toBeEmpty();
  }
  expect(await axe(page)).toEqual([]);
  await noOverflow(page);
  await shot(page, info, 'sepet-odeme-bagiscilar-nasil-oder', section);
});

test('görünen = uygulanan: tür ayarı ürün ekranında kaynağıyla görünür ve ön yüz formuna aynen uygulanır; ürün geçersiz kılar', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'ayar akışı masaüstünde (ön yüz cihaz matrisi kurgu-matrix içinde)');
  // Ürün kaydetme + ön yüz açılışları: yük altında 30 sn varsayılanı yetmeyebilir.
  test.setTimeout(120000);
  expect(await frontDirect(page)).toBe('0');

  await saveType(page, 'custom', 'direct');
  expect((await state(page)).settings.direct.type_custom).toBe('direct');
  await page.goto(`/wp-admin/post.php?post=${PID}&action=edit`);
  const effective = page.locator('[data-wdp-direct-effective]');
  await expect(effective).toHaveAttribute('data-wdp-direct-effective', 'direct');
  await expect(effective).toHaveAttribute('data-wdp-direct-source', 'type');
  await expect(effective).toContainText(/Current value|Geçerli değer/);
  // Bağış sekmesi açılınca satır görünür (görüntü için; değer gizli sekmede de doğru).
  await page.locator('#woocommerce-product-data .wdp_donation_options > a').click();
  await expect(effective).toBeVisible();
  await shot(page, info, 'urun-gecerli-deger-tur', effective);
  expect(await frontDirect(page)).toBe('1');

  // Tür "sepetli" + genel açık → sepetli (tür genelin önünde).
  await page.goto(P('donation-panel-checkout'));
  await page.locator('#dpa-f-direct-enabled').check();
  await page.selectOption('#dpa-f-direct-type_custom', 'cart');
  await page.click('[data-dpa-save]');
  await expect(page.locator('[data-dpa-msg]')).toHaveText(/Saved|Kaydedildi/);
  expect(await frontDirect(page)).toBe('0');

  // Tür "genel ayarı kullan" → genel (açık) → doğrudan.
  await saveType(page, 'custom', '');
  expect(await frontDirect(page)).toBe('1');
  await page.goto(`/wp-admin/post.php?post=${PID}&action=edit`);
  await expect(page.locator('[data-wdp-direct-effective]')).toHaveAttribute('data-wdp-direct-source', 'global');
});

test('Formlar ve görünüm: Compact kart bölümü — açıklama, kısa kod oluşturucu (ürün seç → kod + kopyala), yükseklik tablosu; axe 0', async ({ page }, info) => {
  await page.goto(P('donation-panel-forms'));
  const card = page.locator('#dpa-s-compact');
  await expect(card).toBeVisible();
  await expect(card.locator('.dpa-card__intro')).toContainText(/slider|hero/i);
  const code = card.locator('[data-dpa-compact-text]');
  await expect(code).toHaveText('[wdp_donation_form layout="compact"]');
  await card.locator('[data-dpa-compact-product]').selectOption(String(PID));
  const expected = `[wdp_donation_form id="${PID}" layout="compact"]`;
  await expect(code).toHaveText(expected);
  await expect(card.locator('[data-dpa-compact-code] [data-dpa-copy]')).toHaveAttribute('data-dpa-copy', expected);
  await expect(card.locator('.dpa-compact-heights tbody tr')).toHaveCount(3);
  await expect(card.locator('.dpa-compact-heights')).toContainText('--dp-compact-h-sm');
  for (const id of ['compact.quick_amounts', 'compact.first_text', 'compact.reset_hidden']) {
    await expect(card.locator(`[data-dpa-field="${id}"]`)).toBeAttached();
  }
  expect(await axe(page)).toEqual([]);
  await noOverflow(page);
  await card.scrollIntoViewIfNeeded();
  await shot(page, info, 'formlar-compact-kart', card);
});

test('Rehber: "Compact kartı slider\'a ekleme" ve "Doğrudan bağışı açma" (ekran yolu + kısa kod + şema + ayara bağlantı); axe 0', async ({ page }, info) => {
  await page.goto(P('donation-panel-guide'));
  const compact = page.locator('#dpa-g-compact');
  const direct = page.locator('#dpa-g-direct');
  await expect(compact).toContainText('layout="compact"');
  await expect(compact).toContainText(/Forms and appearance|Formlar ve Görünüm/);
  await expect(compact.locator('svg[role="img"][width][height]')).toBeVisible();
  await expect(compact.locator('a[href*="#dpa-s-compact"]')).toBeVisible();
  await expect(direct).toContainText(/Cart and checkout|Sepet ve Ödeme/);
  await expect(direct.locator('svg[role="img"][width][height]')).toBeVisible();
  await expect(direct.locator('a[href*="#dpa-s-payment"]')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await noOverflow(page);
  await shot(page, info, 'rehber-compact', compact);
  await shot(page, info, 'rehber-dogrudan', direct);
});
