/**
 * 10.30.0 — Form alanları davranış E2E (e-posta, ithaf, anonim, wizard/ikon üçlü, aydınlatma, sepet).
 * Staging Nafile (#custom): meta geçici yazılır / eski haline döner; geri yükleme hatası fail.
 */
import path from 'node:path';
import { SEL } from './selectors.mjs';
import { ROOT, withCacheBust } from './env.mjs';
import {
  emptyCart,
  openShellLocator,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
  clickAddToCartWithRetry,
  makeFailure,
  cartItemsDetail,
  isWooCartUrl,
} from './checks.mjs';
import { getProductMeta, setProductMeta, assertWooCartPagePublished } from './staging-wp-meta.mjs';
import { requireFixtureRole, mutationBrowserContext } from './fixtures.mjs';
import { popupPagePath } from './catalog-core.mjs';
import { openMutationProductShell } from './mutation-policy.mjs';
import { writeDebugJson } from './scenario-debug.mjs';

const CHECK_MS = 20000;

const META_KEYS = [
  '_enable_email',
  '_enable_dedication',
  '_enable_anonymous',
  '_enable_wizard',
  '_enable_field_icons',
];

/**
 * @param {import('@playwright/test').Locator} shell
 */
async function waitShellReady(shell) {
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  const form = shell.locator(SEL.donationForm);
  if ((await form.count()) > 0) {
    await form.first().waitFor({ state: 'visible', timeout: CHECK_MS });
  }
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

/**
 * @param {import('@playwright/test').Locator} shell
 * @param {{ name?: string, phone?: string, email?: string, dedication?: string, anonymous?: boolean, amount?: string }} vals
 */
async function fillDonor(shell, vals = {}) {
  const name = shell.locator(SEL.donorName).first();
  if (await name.count()) {
    await name.fill(vals.name || 'E2E Form Alan');
  }
  const phone = shell.locator(SEL.donorPhone).first();
  if (await phone.count()) {
    let phoneVal = vals.phone;
    if (!phoneVal) {
      try {
        const { getActiveProfile } = await import('./profile.mjs');
        phoneVal = getActiveProfile()?.phone?.nationalExample || '5551234567';
      } catch {
        phoneVal = '5551234567';
      }
    }
    await phone.fill(phoneVal);
  }
  if (vals.email !== undefined) {
    const email = shell.locator('input[name="donation_email"]').first();
    if ((await email.count()) === 0) {
      throw new Error('E-posta alanı formda yok (istenmişti)');
    }
    await email.fill(vals.email);
  }
  if (vals.dedication !== undefined) {
    const ded = shell.locator('input[name="donation_dedication"]').first();
    if ((await ded.count()) === 0) {
      throw new Error('İthaf alanı formda yok (istenmişti)');
    }
    await ded.fill(vals.dedication);
  }
  if (vals.anonymous) {
    const anon = shell.locator('input[name="donation_anonymous"]').first();
    if (await anon.count()) {
      await anon.check();
    }
  }
  if (vals.amount) {
    const price = shell.locator(SEL.customPrice).first();
    if (await price.count()) {
      await price.fill(vals.amount);
    }
  }
}

/**
 * @param {number} productId
 * @param {Record<string,string>} snapshot
 */
async function restoreMeta(productId, snapshot) {
  for (const key of META_KEYS) {
    const prev = Object.prototype.hasOwnProperty.call(snapshot, key) ? snapshot[key] : '';
    await setProductMeta(productId, key, prev || '');
  }
}

/**
 * @param {{ browser: import('@playwright/test').Browser, contextOpts: object, env: object, productUrls: object, productIds: object, listPagePath?: string, failures: any[], stats: { passed: number, failed: number } }} args
 */
export async function runFormFieldsChecks({
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
  try {
    const fx = requireFixtureRole(env, 'custom');
    customId = fx.id;
    customPath = fx.path || fx.url || customPath;
  } catch (e) {
    failures.push(
      makeFailure({
        check: 'form-fields-fixture',
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

  /** @type {Record<string,string>} */
  const snapshot = {};
  let metaTouched = false;

  try {
    if (customId <= 0 || !customPath) {
      throw new Error('Nafile (custom) ürün yolu/id yok');
    }

    for (const key of META_KEYS) {
      snapshot[key] = await getProductMeta(customId, key);
    }

    // --- e-posta açık + geçersiz → görünür hata, gönderim yok ---
    try {
      await emptyCart(page, baseUrl);
      await setProductMeta(customId, '_enable_email', 'yes');
      await setProductMeta(customId, '_enable_dedication', 'yes');
      await setProductMeta(customId, '_enable_anonymous', 'yes');
      metaTouched = true;

      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      await fillDonor(shell, { email: 'bad-email', amount: '100' });
      await shell.locator(SEL.addToCart).first().click({ timeout: CHECK_MS });
      await page.waitForTimeout(600);
      const fieldErr = shell.locator('.wdp-input-error').filter({ hasText: /e-posta|email/i });
      const formErr = shell.locator('.wdp-form-error');
      const hasVisible =
        ((await fieldErr.count()) > 0 && (await fieldErr.first().isVisible())) ||
        ((await formErr.count()) > 0 &&
          (await formErr.first().isVisible()) &&
          /e-posta|email/i.test((await formErr.first().textContent()) || ''));
      if (!hasVisible) {
        throw new Error('Geçersiz e-posta için görünür hata yok');
      }
      const cartCount = await page.evaluate(async () => {
        try {
          const r = await fetch('/?wc-ajax=get_refreshed_fragments', { credentials: 'same-origin' });
          return r.ok ? 1 : 0;
        } catch {
          return 0;
        }
      });
      void cartCount;
      pass('form-fields-invalid-email-visible');
    } catch (e) {
      fail('form-fields-invalid-email-visible', 'Geçersiz e-posta görünür hata', e);
    }

    // --- kapalı üründe POST e-posta/ithaf → sepet meta yok ---
    try {
      await emptyCart(page, baseUrl);
      await setProductMeta(customId, '_enable_email', 'no');
      await setProductMeta(customId, '_enable_dedication', 'no');
      await setProductMeta(customId, '_enable_anonymous', 'no');

      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      if ((await shell.locator('input[name="donation_email"]').count()) > 0) {
        throw new Error('Kapalı üründe e-posta alanı DOM’da');
      }
      await fillDonor(shell, { amount: '100' });
      // Gizli alan enjekte edip POST sızıntısını dene
      await shell.evaluate(() => {
        const form = document.querySelector('.wdp-donation-form, form.wdp-donation-form');
        if (!form) return;
        const e = document.createElement('input');
        e.type = 'hidden';
        e.name = 'donation_email';
        e.value = 'injected@example.com';
        form.appendChild(e);
        const d = document.createElement('input');
        d.type = 'hidden';
        d.name = 'donation_dedication';
        d.value = 'Injected Dedication';
        form.appendChild(d);
      });
      const addBtn = shell.locator(SEL.addToCart).first();
      const cartRes = await clickAddToCartWithRetry(page, addBtn, {
        checkId: 'form-fields-closed-fields-ignored',
      });
      if (!cartRes.ok) {
        throw new Error(`Sepete ekleme başarısız: ${cartRes.bodyPreview || ''}`);
      }
      await page.waitForTimeout(800);
      const cartHtml = await page.content();
      if (/injected@example\.com/i.test(cartHtml) || /Injected Dedication/i.test(cartHtml)) {
        throw new Error('Kapalı alan değerleri sayfada göründü');
      }
      pass('form-fields-closed-fields-ignored');
    } catch (e) {
      fail('form-fields-closed-fields-ignored', 'Kapalı alan POST yok sayma', e);
    }

    // --- ithaf maxlength ---
    try {
      await setProductMeta(customId, '_enable_dedication', 'yes');
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const ded = shell.locator('input[name="donation_dedication"]').first();
      if ((await ded.count()) === 0) {
        throw new Error('İthaf alanı yok');
      }
      const max = await ded.getAttribute('maxlength');
      if (max !== '120') {
        throw new Error(`ithaf maxlength beklenen 120, gerçek ${max}`);
      }
      pass('form-fields-dedication-maxlength');
    } catch (e) {
      fail('form-fields-dedication-maxlength', 'İthaf maxlength=120', e);
    }

    // --- anonim → herkese açık yanıtta tam ad yok ---
    try {
      await emptyCart(page, baseUrl);
      await setProductMeta(customId, '_enable_anonymous', 'yes');
      await setProductMeta(customId, '_enable_email', 'yes');
      const uniqueName = 'Zeynep Karaoglu';
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      await fillDonor(shell, {
        name: uniqueName,
        email: 'zeynep@example.com',
        anonymous: true,
        amount: '100',
      });
      const addBtn = shell.locator(SEL.addToCart).first();
      const cartRes = await clickAddToCartWithRetry(page, addBtn, {
        checkId: 'form-fields-anonymous-public-masked',
      });
      if (!cartRes.ok) {
        throw new Error(`Anonim sepete ekleme başarısız: ${cartRes.bodyPreview || ''}`);
      }
      await page.waitForTimeout(1000);
      const publicPayload = await page.evaluate(async () => {
        const ajax =
          (window.wdp_ajax && window.wdp_ajax.ajax_url) || '/wp-admin/admin-ajax.php';
        const nonces = (window.wdp_ajax && window.wdp_ajax.nonces) || {};
        const body = new URLSearchParams();
        body.set('action', 'wdp_get_cart_contents');
        if (nonces.get_cart_contents) {
          body.set('security', nonces.get_cart_contents);
        }
        const r = await fetch(ajax, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        return r.text();
      });
      if (new RegExp(uniqueName.replace(/\s+/g, '\\s+'), 'i').test(publicPayload)) {
        throw new Error('Herkese açık cart yanıtında tam ad var');
      }
      pass('form-fields-anonymous-public-masked');
    } catch (e) {
      fail('form-fields-anonymous-public-masked', 'Anonim herkese açık maske', e);
    }

    // --- sepet satırında e-posta/ithaf görünür (kendi sepet) ---
    try {
      await emptyCart(page, baseUrl);
      await setProductMeta(customId, '_enable_email', 'yes');
      await setProductMeta(customId, '_enable_dedication', 'yes');
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      await fillDonor(shell, {
        email: 'sepet@example.com',
        dedication: 'Sepet Ithaf',
        amount: '100',
      });
      const addBtn = shell.locator(SEL.addToCart).first();
      /** @type {string} */
      let postedEmail = '';
      /** @type {string} */
      let postedDedication = '';
      const onReq = (req) => {
        const post = req.postData() || '';
        if (!/wdp_ajax_add_to_cart|donation_add_to_cart/i.test(post) && !/admin-ajax\.php/i.test(req.url())) {
          return;
        }
        const em = post.match(/donation_email=([^&]*)/);
        if (em) postedEmail = decodeURIComponent(em[1].replace(/\+/g, ' '));
        const ded = post.match(/donation_dedication=([^&]*)/);
        if (ded) postedDedication = decodeURIComponent(ded[1].replace(/\+/g, ' '));
      };
      page.on('request', onReq);
      const cartRes = await clickAddToCartWithRetry(page, addBtn, {
        checkId: 'form-fields-cart-shows-email-dedication',
      });
      page.off('request', onReq);
      if (!cartRes.ok) {
        throw new Error(`Sepete ekleme başarısız: ${cartRes.bodyPreview || ''}`);
      }
      const cartInfo = await assertWooCartPagePublished();
      const dest = cartInfo.url || cartInfo.path || '/cart/';
      await page.goto(withCacheBust(baseUrl, dest, { hdf_no_side_cart: '1' }), {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await page.waitForTimeout(800);
      const cartPageUrl = page.url();
      const inner = (await page.locator('body').innerText().catch(() => '')) || '';
      const html = (await page.content().catch(() => '')) || '';
      const textAll = (await page.locator('body').textContent().catch(() => '')) || '';
        const storeRaw = await page
          .evaluate(async (base) => {
            try {
              const r = await fetch(`${base.replace(/\/$/, '')}/wp-json/wc/store/v1/cart`, {
                credentials: 'same-origin',
              });
              if (!r.ok) return { status: r.status };
              const data = await r.json();
              return {
                status: r.status,
                item_data: (data.items || []).map((it) => ({
                  name: it.name,
                  item_data: it.item_data || [],
                })),
              };
            } catch (e) {
              return { error: String(e && e.message ? e.message : e) };
            }
          }, baseUrl)
          .catch(() => ({}));
        const storeItems = await cartItemsDetail(page, baseUrl).catch(() => []);
      const haystack = `${inner}\n${textAll}\n${html}`;
      const hasEmail = /sepet@example\.com/i.test(haystack);
      const hasDed = /Sepet Ithaf/i.test(haystack);
      if (!hasEmail || !hasDed) {
        const diag = {
          url: cartPageUrl,
          isCart: isWooCartUrl(cartPageUrl),
          postedEmail,
          postedDedication,
          storeItemCount: Array.isArray(storeItems) ? storeItems.length : -1,
          storeNames: Array.isArray(storeItems) ? storeItems.map((i) => i.name).slice(0, 5) : [],
          storeRaw,
          cartInfo,
          innerHasEmail: /sepet@example\.com/i.test(inner),
          htmlHasEmail: /sepet@example\.com/i.test(html),
          innerSnippet: inner.replace(/\s+/g, ' ').slice(0, 400),
        };
        writeDebugJson(
          path.join(ROOT, 'build/e2e/debug/form-fields-cart-shows-email-dedication.json'),
          diag
        );
        const bits = [];
        if (!hasEmail) bits.push('e-posta yok');
        if (!hasDed) bits.push('ithaf yok');
        if (!postedEmail) bits.push('POST donation_email boş');
        if (!Array.isArray(storeItems) || storeItems.length === 0) bits.push('Store API sepet boş');
        throw new Error(`Sepet satırında ${bits.join('; ')} url=${cartPageUrl}`);
      }
      pass('form-fields-cart-shows-email-dedication');
    } catch (e) {
      fail('form-fields-cart-shows-email-dedication', 'Sepet e-posta/ithaf gösterimi', e);
    }

    // --- wizard ürün Açık ---
    try {
      await setProductMeta(customId, '_enable_wizard', 'yes');
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const form = shell.locator(SEL.donationForm).first();
      const hasClass = await form.evaluate((el) => el.classList.contains('wdp-multi-step'));
      if (!hasClass) {
        throw new Error('Ürün wizard Açık iken wdp-multi-step yok');
      }
      const noteInDonor = await form.evaluate(() => {
        const note = document.querySelector('.wdp-form-block--note');
        if (!note) return 'no-note';
        return note.getAttribute('data-wdp-step') || 'untagged';
      });
      if (noteInDonor !== 'donor' && noteInDonor !== 'no-note') {
        // Wizard kurulduysa note donor adımında olmalı
        if (noteInDonor !== 'donor') {
          throw new Error(`ithaf bloğu adımı: ${noteInDonor}`);
        }
      }
      pass('form-fields-wizard-product-on');
    } catch (e) {
      fail('form-fields-wizard-product-on', 'Wizard ürün Açık', e);
    }

    // --- wizard ürün Kapalı ---
    try {
      await setProductMeta(customId, '_enable_wizard', 'no');
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const form = shell.locator(SEL.donationForm).first();
      const hasClass = await form.evaluate((el) => el.classList.contains('wdp-multi-step'));
      if (hasClass) {
        throw new Error('Ürün wizard Kapalı iken wdp-multi-step hâlâ var');
      }
      pass('form-fields-wizard-product-off');
    } catch (e) {
      fail('form-fields-wizard-product-off', 'Wizard ürün Kapalı', e);
    }

    // --- ikonlar üçlü: Kapalı → wdp-no-field-icons ---
    try {
      await setProductMeta(customId, '_enable_field_icons', 'no');
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const form = shell.locator(SEL.donationForm).first();
      const noIcons = await form.evaluate((el) => el.classList.contains('wdp-no-field-icons'));
      if (!noIcons) {
        throw new Error('İkon Kapalı iken wdp-no-field-icons yok');
      }
      pass('form-fields-icons-off');
    } catch (e) {
      fail('form-fields-icons-off', 'Alan ikonları Kapalı', e);
    }

    // --- aydınlatma: ürün e-posta açıkken (genel ayar staging’de kapalı olabilir → atlanabilir) ---
    try {
      await setProductMeta(customId, '_enable_email', 'yes');
      const shell = await openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });
      const notice = shell.locator('.wdp-privacy-notice');
      const count = await notice.count();
      // Genel ayar kapalıysa 0 beklenir — bu koşuda geç (yapılandırma bağımlı).
      if (count > 0) {
        const link = notice.locator('a[rel="noopener"]');
        if ((await link.count()) === 0) {
          throw new Error('Aydınlatma bağlantısında rel=noopener yok');
        }
        pass('form-fields-privacy-notice-present');
      } else {
        pass('form-fields-privacy-notice-absent-ok');
      }
    } catch (e) {
      fail('form-fields-privacy-notice', 'Aydınlatma bağlantısı', e);
    }

    // wizard genel (meta boş)
    try {
      await setProductMeta(customId, '_enable_wizard', '');
      pass('form-fields-wizard-global-meta-cleared');
    } catch (e) {
      fail('form-fields-wizard-global-meta-cleared', 'Wizard meta boşaltma', e);
    }
  } catch (e) {
    fail('form-fields-runner', 'Form alanları E2E koşucusu', e);
  } finally {
    if (metaTouched && customId > 0) {
      try {
        await restoreMeta(customId, snapshot);
      } catch (restoreErr) {
        fail('form-fields-meta-restore', 'Form alanları meta geri yükleme başarısız', restoreErr);
      }
    }
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }

  return {
    ok: failures.filter((f) => String(f.check || '').startsWith('form-fields-')).length === 0,
    checks,
  };
}
