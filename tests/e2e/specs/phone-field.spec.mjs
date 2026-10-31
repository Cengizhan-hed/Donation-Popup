/**
 * Telefon alanı e2e (YALNIZ yerel WP): form (hissedar satırı) ve compact kart.
 *  - Yazma biçimlenir (TR 530 307 15 93), fazla hane girilemez, yapıştırmada temizlenir (0, 00, +kod), ülke seçimi kodu izler.
 *  - Eksik hane: alan altında/durum satırında ileti (odak çıkınca), devam düğmesi pasif ve ilerletmez; tamamlanınca açılır.
 *  - TR/UK mobil önek denetimi yalnız uyarıdır (engel değil, alan geçersiz işaretlenmez).
 * Çalıştırma: `npm run e2e:queue -- npm run e2e:experiences -- --spec phone-field --env local`.
 */
import { test, expect } from '@playwright/test';

const IDS = JSON.parse(process.env.WDP_EXP_PRODUCTS || '{}');
const CARD = '[data-dp-compact]';

const isoOf = (select) => select.evaluate((el) => (el.selectedOptions[0] ? el.selectedOptions[0].dataset.iso : ''));

/**
 * @param {import('@playwright/test').Locator} box `.donation-panel-phone` kutusu.
 * @param {string} value Yazılacak ham değer (yapıştırma gibi tek seferde).
 */
async function paste(box, value) {
  await box.locator('.donation-panel-phone__input').fill(value);
}

/**
 * Ortak telefon davranışı: bir kutu üzerinde (form ve kart aynı mantığı kullanır).
 *
 * @param {import('@playwright/test').Locator} box Kutu.
 */
async function behaviours(box) {
  const input = box.locator('.donation-panel-phone__input');
  const select = box.locator('[data-dp-dial]');
  await select.selectOption('90');
  await expect(box.locator('[data-dp-dial-label]')).toHaveText('+90');
  expect(await isoOf(select)).toBe('tr');

  // Yazma: baştaki 0 ayıklanır, biçimlenir, fazlası girilemez.
  await input.fill('');
  await input.pressSequentially('0530307', { delay: 10 });
  await expect(input).toHaveValue('530 307');
  await input.fill('');
  await input.pressSequentially('530307159399', { delay: 5 });
  await expect(input).toHaveValue('530 307 15 93');

  // Yapıştırma: farklı yazımlar aynı sonucu verir.
  for (const raw of ['0530 307 15 93', '+90 530 307 15 93', '0090 (530) 307-15-93', '905303071593']) {
    await paste(box, raw);
    await expect(input).toHaveValue('530 307 15 93');
    expect(await isoOf(select)).toBe('tr');
  }
  // +ülke kodu: ülke seçimi izler.
  await paste(box, '+44 7911 123456');
  await expect(input).toHaveValue('7911 123456');
  expect(await isoOf(select)).toBe('gb');
  await expect(box.locator('[data-dp-dial-label]')).toHaveText('+44');
  await paste(box, '+90 530 307 15 93');
  expect(await isoOf(select)).toBe('tr');

  // Klavye/otomatik doldurma için doğru öznitelikler.
  await expect(input).toHaveAttribute('inputmode', 'tel');
  await expect(input).toHaveAttribute('autocomplete', 'tel');
}

test.describe('telefon alanı', () => {
  test('form (hissedar satırı): biçimleme, yapıştırma, eksik hane uyarısı, pasif devam, mobil önek yalnız ipucu', async ({ page }) => {
    test.skip(!IDS.shares, 'hisseli test ürünü yok');
    await page.goto(`/?dp_exp_test=inline&dp_product=${IDS.shares}`);
    await expect(page.locator('[data-dp-form]')).toBeVisible({ timeout: 20000 });
    const box = page.locator('[data-dp-holder="1"] .donation-panel-phone');
    await behaviours(box);

    const input = box.locator('.donation-panel-phone__input');
    const submit = page.locator('[data-dp-submit]');
    const error = page.locator('[data-dp-error="shareholder_1_phone"]');
    const note = page.locator('[data-dp-holder="1"] [data-dp-phone-note]');

    // Eksik hane: yazarken sessiz, odak çıkınca iletisi, devam pasif.
    await page.locator('input[name="shareholder_1_name"]').fill('Çağlar Şükrü');
    await input.fill('');
    await input.pressSequentially('530 307 15', { delay: 5 });
    await expect(error).toBeHidden();
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
    await input.blur();
    await expect(error).toBeVisible();
    await expect(error).not.toHaveText('');
    await submit.click({ force: true }); // aria-disabled düğme: Playwright pasif sayar, kullanıcı yine dokunabilir.
    await expect(error).toBeVisible();
    await expect(page).toHaveURL(/dp_exp_test=inline/);

    // Tamamlanınca ileti kalkar, düğme açılır.
    await input.pressSequentially('93', { delay: 5 });
    await expect(error).toBeHidden();
    await expect(submit).toHaveAttribute('aria-disabled', 'false');

    // TR mobil önek: yalnız ipucu (engel değil, geçersiz işareti yok).
    await paste(box, '212 555 12 34');
    await input.blur();
    await expect(note).toBeVisible();
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await expect(submit).toHaveAttribute('aria-disabled', 'false');
    await paste(box, '530 307 15 93');
    await input.blur();
    await expect(note).toBeHidden();
  });

  test('compact kart: biçimleme, yapıştırma, eksik hane uyarısı, pasif devam, mobil önek yalnız uyarı', async ({ page, baseURL }) => {
    test.skip(!IDS.custom, 'serbest tutarlı test ürünü yok');
    await page.context().addCookies([
      { name: 'dp_progress_fresh', value: '1', url: baseURL },
      { name: 'dp_direct', value: '1', url: baseURL },
    ]);
    await page.goto(`/?dp_compact=plain&dp_ids=${IDS.custom}`);
    const card = page.locator(`${CARD}[data-dp-ready="1"]`).first();
    await expect(card).toBeVisible({ timeout: 20000 });
    await card.locator('[data-dp-camount-in]').fill('40');
    await card.locator('[data-dp-cstep="amount"] [data-dp-cnext]').click();
    const details = card.locator('[data-dp-cstep="details"]');
    await expect(details).toBeVisible();
    await details.locator('input[name="donation_full_name"]').fill('Çağlar Şükrü Öztürk');
    const email = details.locator('input[name="donation_email"]');
    if (await email.count()) {
      await email.fill('caglar@example.org');
    }
    const box = details.locator('.donation-panel-phone');
    await behaviours(box);

    const input = box.locator('.donation-panel-phone__input');
    const cta = details.locator('button[type="submit"]');
    const status = details.locator('[data-dp-cerr]');
    await input.fill('');
    await input.pressSequentially('530 307 15', { delay: 5 });
    await expect(cta).toHaveAttribute('aria-disabled', 'true');
    await expect(status).toHaveText('');
    await input.blur();
    await expect(status).not.toHaveText('');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await cta.click({ force: true });
    await expect(details).toBeVisible();
    await expect(card.locator('[data-dp-cstep="pay"].is-on')).toHaveCount(0);

    await input.pressSequentially('93', { delay: 5 });
    await expect(cta).toHaveAttribute('aria-disabled', 'false');
    await expect(status).toHaveText('');

    // Mobil önek uyarısı: geçersiz işareti yok, devam eder.
    await paste(box, '212 555 12 34');
    await input.blur();
    await expect(status).not.toHaveText('');
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await expect(cta).toHaveAttribute('aria-disabled', 'false');
    await cta.click();
    await expect(card.locator('[data-dp-cstep="pay"].is-on')).toHaveCount(1);
  });
});
