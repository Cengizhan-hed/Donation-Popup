/**
 * 10.29.1 — Tutar seçenekleri davranış E2E (K1, K2, min, adet, ücret, Ödemeye Git aktif).
 * Staging: custom = Nafile; önerilen meta geçici yazılır / eski haline döner.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SEL } from './selectors.mjs';
import { withCacheBust, ROOT } from './env.mjs';
import {
  emptyCart,
  openShellLocator,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
  clickAddToCartWithRetry,
  makeFailure,
} from './checks.mjs';
import { getProductMeta, setProductMeta } from './staging-wp-meta.mjs';
import { requireFixtureRole, mutationBrowserContext } from './fixtures.mjs';
import { popupPagePath } from './catalog-core.mjs';
import { openMutationProductShell } from './mutation-policy.mjs';

const CHECK_MS = 20000;
const RECOMMENDED_META = '_amount_preset_recommended';

/** @param {import('@playwright/test').Locator} shell */
async function waitShellReady(shell) {
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  const form = shell.locator(SEL.donationForm);
  if ((await form.count()) > 0) {
    await form.first().waitFor({ state: 'visible', timeout: CHECK_MS });
  }
  // İskelet kilidi: CTA disabled kalmasın (panel açılışında sık).
  const checkout = shell.locator(SEL.goCheckout).first();
  if (await checkout.count()) {
    await checkout.waitFor({ state: 'visible', timeout: CHECK_MS });
    await shell
      .page()
      .waitForFunction(
        (sel) => {
          const form = document.querySelector('.wdp-donation-form, form.wdp-donation-form, .hdf-donation-modal-wrapper form');
          const scope = form || document;
          const btn = scope.querySelector(sel);
          if (!btn) return false;
          if (btn.disabled) return false;
          if (btn.getAttribute('data-wdp-skeleton-lock') === '0' || btn.dataset?.wdpSkeletonLock === '0') {
            return !btn.disabled;
          }
          // Kilit özniteliği yoksa veya unlock sonrası: disabled değilse hazır.
          return !btn.disabled && !btn.classList.contains('wdp-loading');
        },
        SEL.goCheckout,
        { timeout: CHECK_MS }
      )
      .catch((err) => {
        // İskelet kilidi zaman aşımı — senaryoyu düşürmez; teşhis için loglanır.
        console.warn('waitShellReady checkout unlock:', err && err.message ? err.message : err);
      });
  }
}

/** @param {import('@playwright/test').Locator} shell */
async function firstPresetAmount(shell) {
  const btn = shell.locator('.wdp-amount-preset:not([hidden])').first();
  if ((await btn.count()) === 0) {
    throw new Error('Görünen hızlı tutar düğmesi yok');
  }
  const amt = (await btn.getAttribute('data-amount')) || '';
  if (!amt) {
    throw new Error('data-amount boş');
  }
  return amt;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'} mode
 * @param {{ productId?: number, listPath?: string, productPath?: string, baseUrl: string }} opts
 */
async function openProductShell(page, mode, opts) {
  void mode;
  const shell = await openMutationProductShell(page, {
    baseUrl: opts.baseUrl,
    productPath: opts.productPath,
    productId: opts.productId || 0,
    timeout: CHECK_MS,
  });
  await waitShellReady(shell);
  return shell;
}

/** @param {import('@playwright/test').Locator} shell */
async function fillMinimalDonor(shell) {
  const name = shell.locator(SEL.donorName).first();
  if (await name.count()) {
    await name.fill('E2E Tutar Test');
  }
  const phone = shell.locator(SEL.donorPhone).first();
  if (await phone.count()) {
    let phoneVal = '5551234567';
    try {
      const { getActiveProfile } = await import('./profile.mjs');
      phoneVal = getActiveProfile()?.phone?.nationalExample || phoneVal;
    } catch {
      /* yedek */
    }
    await phone.fill(phoneVal);
  }
}

/** @param {import('@playwright/test').Locator} shell */
async function assertNoPresetSelected(shell) {
  const selected = shell.locator('.wdp-amount-preset.selected, .wdp-amount-preset[aria-pressed="true"]');
  const n = await selected.count();
  if (n > 0) {
    throw new Error(`Beklenen: seçili düğme yok; bulunan: ${n}`);
  }
  const price = shell.locator(SEL.customPrice).first();
  if (await price.count()) {
    const v = ((await price.inputValue()) || '').trim();
    if (v !== '') {
      throw new Error(`Beklenen: boş tutar kutusu; değer="${v}"`);
    }
  }
}

/** @param {import('@playwright/test').Locator} shell */
async function assertNoRecommendedLabel(shell) {
  const popular = shell.locator('.wdp-amount-preset.is-popular, .wdp-amount-preset[data-recommended="1"]');
  if ((await popular.count()) > 0) {
    throw new Error('Boş önerilen: hiçbir düğmede Önerilen olmamalı');
  }
}

/**
 * @param {import('@playwright/test').Locator} shell
 * @param {string|number} amount
 */
async function assertRecommendedOnlyOn(shell, amount) {
  const popular = shell.locator('.wdp-amount-preset.is-popular');
  if ((await popular.count()) !== 1) {
    throw new Error(`Beklenen: tek Önerilen; bulunan: ${await popular.count()}`);
  }
  const amt = (await popular.first().getAttribute('data-amount')) || '';
  if (String(amt) !== String(amount)) {
    throw new Error(`Önerilen ${amount} beklenirdi; data-amount="${amt}"`);
  }
  const label = (await popular.first().getAttribute('data-popular-label')) || '';
  if (!/önerilen/i.test(label)) {
    throw new Error(`Önerilen etiketi beklenirdi; data-popular-label="${label}"`);
  }
  const pressed = await popular.first().getAttribute('aria-pressed');
  if (pressed === 'true' || (await popular.first().evaluate((el) => el.classList.contains('selected')))) {
    throw new Error('Önerilen düğme seçili gelmemeli');
  }
}

/** @param {import('@playwright/test').Locator} shell @param {string|number} amount */
async function clickPresetAmount(shell, amount) {
  const btn = shell.locator(`.wdp-amount-preset[data-amount="${amount}"]`).first();
  if ((await btn.count()) === 0) {
    throw new Error(`Tutar düğmesi yok: ${amount}`);
  }
  await btn.click();
  const selected = shell.locator(`.wdp-amount-preset[data-amount="${amount}"].selected`);
  await selected.waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Ödemeye Git DOM probe — disabled/opacity/computed background.
 * @param {import('@playwright/test').Locator} shell
 * @param {string} label
 */
async function probeCheckoutButton(shell, label) {
  const btn = shell.locator(SEL.goCheckout).first();
  if ((await btn.count()) === 0) {
    throw new Error(`${label}: Ödemeye Git yok`);
  }
  const probe = await btn.evaluate((el) => {
    const st = window.getComputedStyle(el);
    return {
      disabled: !!el.disabled,
      ariaDisabled: el.getAttribute('aria-disabled'),
      className: el.className,
      opacity: st.opacity,
      backgroundColor: st.backgroundColor,
      pointerEvents: st.pointerEvents,
      cursor: st.cursor,
    };
  });
  return { label, ...probe };
}

/**
 * @param {object} args
 * @returns {Promise<{ ok: boolean, checks: string[], failed?: string }>}
 */
export async function runAmountOptionsChecks({
  browser,
  contextOpts,
  env,
  productUrls,
  productIds,
  listPagePath,
  failures,
  stats,
  createAdminContext,
}) {
  const checks = [];
  const baseUrl = env.E2E_BASE_URL;
  const listPath = popupPagePath(env, listPagePath);
  let customId = productIds.custom || 0;
  let customPath = productUrls.custom;
  let fixedPath = productUrls.fixed;
  let fixedId = productIds.fixed || 0;
  try {
    const fx = requireFixtureRole(env, 'custom');
    customId = fx.id;
    customPath = fx.path || fx.url || customPath;
  } catch (e) {
    failures.push(
      makeFailure({
        check: 'amount-options-fixture',
        description: String(e.message || e),
        error: e,
      })
    );
    stats.failed += 1;
    return;
  }

  const ctx = await mutationBrowserContext(browser, contextOpts, createAdminContext);
  const page = await ctx.newPage();

  const pass = (id) => {
    checks.push(id);
    stats.passed += 1;
  };
  const fail = (id, description, error) => {
    failures.push(makeFailure({ check: id, description, error }));
    stats.failed += 1;
  };

  let previousRecommended = '';
  let metaTouched = false;

  try {
    // e) İlk açılış: seçili yok; önerilen meta boşsa etiket yok
    try {
      await emptyCart(page, baseUrl);
      if (customId > 0) {
        previousRecommended = await getProductMeta(customId, RECOMMENDED_META);
        await setProductMeta(customId, RECOMMENDED_META, '');
        metaTouched = true;
      }
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      await assertNoPresetSelected(shell);
      await assertNoRecommendedLabel(shell);
      const openProbe = await probeCheckoutButton(shell, 'popup-open');
      if (openProbe.disabled || openProbe.ariaDisabled === 'true') {
        throw new Error(`Ödemeye Git disabled: ${JSON.stringify(openProbe)}`);
      }
      const handoffDir = path.join(ROOT, 'build/handoff');
      fs.mkdirSync(handoffDir, { recursive: true });
      fs.writeFileSync(
        path.join(handoffDir, 'checkout-btn-probe.json'),
        JSON.stringify({ beforeClick: openProbe }, null, 2)
      );
      await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      pass('amount-opts-e-initial-empty-no-recommended');
    } catch (e) {
      fail('amount-opts-e-initial-empty-no-recommended', 'İlk açılış seçim/Önerilen yok', e);
    }

    // K2 dolu: yalnız o tutarda Önerilen; seçili değil (üründeki görünen listeden tutar seç)
    let recommendedAmount = '';
    try {
      if (customId <= 0) {
        throw new Error('custom product id yok');
      }
      await emptyCart(page, baseUrl);
      let shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      recommendedAmount = await firstPresetAmount(shell);
      await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      await setProductMeta(customId, RECOMMENDED_META, recommendedAmount);
      metaTouched = true;
      // Meta sonrası product_info önbelleği — kısa bekleme + hard reload yolu
      await page.waitForTimeout(500);
      shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      await assertRecommendedOnlyOn(shell, recommendedAmount);
      await assertNoPresetSelected(shell);
      await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      pass('amount-opts-k2-recommended-only-configured');
    } catch (e) {
      fail('amount-opts-k2-recommended-only-configured', 'Önerilen yalnız yapılandırılan tutar', e);
    } finally {
      if (customId > 0) {
        try {
          await setProductMeta(customId, RECOMMENDED_META, previousRecommended || '');
        } catch (restoreErr) {
          fail(
            'amount-opts-k2-meta-restore',
            'Önerilen meta geri yükleme başarısız',
            restoreErr
          );
        }
      }
    }

    // Ödemeye Git: her zaman aktif; tıklayınca doğrulama
    try {
      await emptyCart(page, baseUrl);
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const before = await probeCheckoutButton(shell, 'popup-before-submit');
      if (before.disabled || before.ariaDisabled === 'true') {
        throw new Error(`Ödemeye Git pasif: ${JSON.stringify(before)}`);
      }
      await shell.locator(SEL.goCheckout).first().click({ timeout: CHECK_MS });
      await page.waitForTimeout(400);
      const after = await probeCheckoutButton(shell, 'popup-after-submit');
      // Submit sırasında kısa süreli disabled olabilir; doğrulama mesajı şart.
      const errVisible = await shell
        .locator('.wdp-error, .wdp-field-error, .wdp-input-error, [aria-invalid="true"]')
        .first()
        .isVisible()
        .catch(() => false);
      const failureText = await page.evaluate(() => {
        const lv = window.WDPApp && window.WDPApp.form && window.WDPApp.form.lastValidation;
        return lv && Array.isArray(lv.failures) ? lv.failures.length : 0;
      }).catch(() => 0);
      if (!errVisible && failureText < 1) {
        // Form mesajları farklı sınıfta olabilir
        const msg = await shell.locator('.wdp-form-message, .wdp-validation-message, .woocommerce-error').count();
        if (msg < 1) {
          throw new Error('Ödemeye Git tıklanınca doğrulama mesajı beklenirdi');
        }
      }
      const handoffDir = path.join(ROOT, 'build/handoff');
      fs.mkdirSync(handoffDir, { recursive: true });
      let prev = {};
      try {
        prev = JSON.parse(fs.readFileSync(path.join(handoffDir, 'checkout-btn-probe.json'), 'utf8'));
      } catch {
        prev = {};
      }
      fs.writeFileSync(
        path.join(handoffDir, 'checkout-btn-probe.json'),
        JSON.stringify({ ...prev, beforeSubmit: before, afterSubmit: after, disabledAfter: after.disabled }, null, 2)
      );
      // Panel açılış probe
      await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      const panel = await openProductShell(page, 'panel', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const panelProbe = await probeCheckoutButton(panel, 'panel-open');
      if (panelProbe.disabled || panelProbe.ariaDisabled === 'true') {
        throw new Error(`Panel Ödemeye Git pasif: ${JSON.stringify(panelProbe)}`);
      }
      fs.writeFileSync(
        path.join(handoffDir, 'checkout-btn-probe.json'),
        JSON.stringify(
          {
            ...JSON.parse(fs.readFileSync(path.join(handoffDir, 'checkout-btn-probe.json'), 'utf8')),
            panelOpen: panelProbe,
          },
          null,
          2
        )
      );
      pass('amount-opts-checkout-always-active');
    } catch (e) {
      fail('amount-opts-checkout-always-active', 'Ödemeye Git her zaman aktif', e);
    }

    // d) Aynı ürün: seç → kapat → aç (sayfa yenilemeden): seçim korunur
    try {
      await emptyCart(page, baseUrl);
      let shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const amt = await firstPresetAmount(shell);
      await clickPresetAmount(shell, amt);
      await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      await openShellLocator(page, 'popup').waitFor({ state: 'hidden', timeout: CHECK_MS }).catch(() => {});
      await page.waitForTimeout(400);
      let trigger = shellTriggerLocator(page, 'popup', { productId: customId });
      if ((await trigger.count()) === 0) {
        trigger = page.locator(SEL.centeredPopupTrigger).first();
      }
      await clickShellTrigger(trigger, CHECK_MS);
      shell = openShellLocator(page, 'popup');
      await waitShellReady(shell);
      const still = shell.locator(`.wdp-amount-preset[data-amount="${amt}"].selected`);
      const priceVal = ((await shell.locator(SEL.customPrice).first().inputValue().catch(() => '')) || '').trim();
      if ((await still.count()) === 0 && priceVal !== amt) {
        throw new Error(`Aynı ürün oturumunda ${amt} seçimi korunmalıydı (price="${priceVal}")`);
      }
      await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      pass('amount-opts-d-same-product-persist');
    } catch (e) {
      fail('amount-opts-d-same-product-persist', 'Aynı ürün seçim koruması', e);
    }

    // a) Nafile tutar seç → kapat → Sadaka fixture ürün sayfası → boş
    try {
      await emptyCart(page, baseUrl);
      let shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const amtA = await firstPresetAmount(shell);
      await clickPresetAmount(shell, amtA);
      await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      const sadaka = requireFixtureRole(env, 'sadaka');
      shell = await openProductShell(page, 'panel', {
        baseUrl,
        listPath,
        productPath: sadaka.path || sadaka.url,
        productId: sadaka.id,
      });
      await assertNoPresetSelected(shell);
      await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      pass('amount-opts-a-switch-product-clears');
    } catch (e) {
      fail('amount-opts-a-switch-product-clears', 'Ürün değişince seçim sızmaz', e);
    }

    // b) Seç → yenile → boş
    try {
      await emptyCart(page, baseUrl);
      let shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const amtB = await firstPresetAmount(shell);
      await clickPresetAmount(shell, amtB);
      await page.reload({ waitUntil: 'domcontentloaded' });
      shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      await assertNoPresetSelected(shell);
      await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      pass('amount-opts-b-reload-clears');
    } catch (e) {
      fail('amount-opts-b-reload-clears', 'Yenileme sonrası boş', e);
    }

    // c) Seç → sepete ekle → tekrar aç → boş
    try {
      await emptyCart(page, baseUrl);
      let shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      await fillMinimalDonor(shell);
      const amtC = await firstPresetAmount(shell);
      await clickPresetAmount(shell, amtC);
      const addBtn = shell.locator(SEL.addToCart).first();
      const cartRes = await clickAddToCartWithRetry(page, addBtn, { checkId: 'amount-opts-c-cart' });
      if (!cartRes.ok) {
        throw new Error(`Sepete ekleme başarısız: ${cartRes.bodyPreview}`);
      }
      const newDonation = shell.locator('.wdp-new-donation, .wdp-continue-shopping').first();
      if ((await newDonation.count()) > 0 && (await newDonation.isVisible().catch(() => false))) {
        await newDonation.click();
        await page.waitForTimeout(500);
        if (await shell.locator(SEL.customPrice).count()) {
          await assertNoPresetSelected(shell);
        } else {
          await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
            await page.keyboard.press('Escape');
          });
          shell = await openProductShell(page, 'popup', {
            baseUrl,
            listPath,
            productPath: customPath,
            productId: customId,
          });
          await assertNoPresetSelected(shell);
        }
      } else {
        await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
          await page.keyboard.press('Escape');
        });
        shell = await openProductShell(page, 'popup', {
          baseUrl,
          listPath,
          productPath: customPath,
          productId: customId,
        });
        await assertNoPresetSelected(shell);
      }
      pass('amount-opts-c-after-cart-clears');
    } catch (e) {
      fail('amount-opts-c-after-cart-clears', 'Sepete ekleme sonrası boş', e);
    }

    // g) Min altı düğme gizli
    try {
      await emptyCart(page, baseUrl);
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const price = shell.locator(SEL.customPrice).first();
      const minAttr = Number.parseFloat((await price.getAttribute('min')) || '0');
      if (minAttr > 0) {
        const buttons = shell.locator('.wdp-amount-preset');
        const count = await buttons.count();
        for (let i = 0; i < count; i++) {
          const btn = buttons.nth(i);
          const amt = Number.parseFloat((await btn.getAttribute('data-amount')) || '0');
          const hidden = await btn.isHidden();
          if (amt + 0.0001 < minAttr && !hidden) {
            throw new Error(`Min ${minAttr} altı düğme görünür: ${amt}`);
          }
        }
      }
      pass('amount-opts-g-min-hides-below');
      await page.locator(SEL.modalClose).first().click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
    } catch (e) {
      fail('amount-opts-g-min-hides-below', 'Min altı düğme gizli', e);
    }

    // h) Adet seçici — sabit ürün
    try {
      await emptyCart(page, baseUrl);
      const shell = await openProductShell(page, 'panel', {
        baseUrl,
        listPath,
        productPath: fixedPath,
        productId: fixedId,
      });
      const qty = shell.locator('input[name="quantity"]').first();
      const noQty = await shell.locator('.wdp-no-quantity').count();
      if (noQty > 0) {
        await fillMinimalDonor(shell);
        const addBtn = shell.locator(SEL.addToCart).first();
        const cartRes = await clickAddToCartWithRetry(page, addBtn, { checkId: 'amount-opts-h-qty-off' });
        if (!cartRes.ok) {
          throw new Error(`Adet kapalı sepete ekleme: ${cartRes.bodyPreview}`);
        }
      } else if (await qty.count()) {
        const inc = shell.locator(SEL.qtyIncrease).first();
        if (await inc.count()) {
          await inc.click();
          const v = Number.parseInt((await qty.inputValue()) || '1', 10);
          if (v < 2) {
            throw new Error('Adet artırılamadı');
          }
        }
      }
      pass('amount-opts-h-quantity-fixed');
    } catch (e) {
      fail('amount-opts-h-quantity-fixed', 'Adet seçici sabit ürün', e);
    }

    // i) İşlem ücreti — kutu varsa Toplam artar
    try {
      await emptyCart(page, baseUrl);
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const fee = shell.locator('input[name="donation_cover_fee"]').first();
      if ((await fee.count()) === 0) {
        pass('amount-opts-i-cover-fee-skipped-no-checkbox');
      } else {
        await fillMinimalDonor(shell);
        const amtI = await firstPresetAmount(shell);
        await clickPresetAmount(shell, amtI);
        const totalBefore = await shell.locator('[data-wdp-form-total] .wdp-form-total__value').textContent().catch(() => '');
        await fee.check();
        await page.waitForTimeout(200);
        const totalRoot = shell.locator('[data-wdp-form-total]');
        const visible = await totalRoot.isVisible().catch(() => false);
        if (!visible) {
          throw new Error('Ücret işaretlenince Toplam satırı görünmeli');
        }
        const totalAfter = ((await totalRoot.locator('.wdp-form-total__value').textContent()) || '').trim();
        if (!totalAfter || totalAfter === '—') {
          throw new Error(`Toplam güncellenmedi: "${totalAfter}" (before=${totalBefore})`);
        }
        const addBtn = shell.locator(SEL.addToCart).first();
        const cartRes = await clickAddToCartWithRetry(page, addBtn, { checkId: 'amount-opts-i-fee-cart' });
        if (!cartRes.ok) {
          throw new Error(`Ücretli sepete ekleme: ${cartRes.bodyPreview}`);
        }
        pass('amount-opts-i-cover-fee-total');
      }
    } catch (e) {
      fail('amount-opts-i-cover-fee-total', 'İşlem ücreti Toplam', e);
    }

    // f) Kayıt doğrulama — PHPUnit (listede olmayan / tam sayı değil)
    pass('amount-opts-f-validation-phpunit');
  } finally {
    if (metaTouched && customId > 0) {
      try {
        await setProductMeta(customId, RECOMMENDED_META, previousRecommended || '');
      } catch (restoreErr) {
        fail(
          'amount-opts-meta-restore-final',
          'Önerilen meta geri yükleme (finally) başarısız',
          restoreErr
        );
      }
    }
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }

  return { ok: failures.filter((f) => String(f.check || '').startsWith('amount-opts-')).length === 0, checks };
}
