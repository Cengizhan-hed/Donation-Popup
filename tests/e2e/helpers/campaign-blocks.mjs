/**
 * 10.31.0 — Kampanya blokları E2E (hedef davranışı, sosyal, aciliyet, kutlama).
 * Staging kampanya ürünü meta geçici yazılır / eski haline döner; geri yükleme hatası fail.
 * Akika (hedefe ulaşmış) ve Nafile #10695'e dokunulmaz.
 */
import { SEL } from './selectors.mjs';
import { withCacheBust } from './env.mjs';
import {
  emptyCart,
  openShellLocator,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
  makeFailure,
} from './checks.mjs';
import { getProductMeta, setProductMeta } from './staging-wp-meta.mjs';
import { requireFixtureRole, mutationBrowserContext } from './fixtures.mjs';
import { popupPagePath } from './catalog-core.mjs';
import { openMutationProductShell } from './mutation-policy.mjs';

const CHECK_MS = 25000;

const META_KEYS = [
  '_enable_progress_bar',
  '_progress_bar_limit',
  '_wdp_total_donation_amount',
  '_goal_reached_action',
  '_goal_reached_message',
  '_enable_social_proof',
  '_social_proof_text',
  '_wdp_donor_count',
  '_enable_urgency',
  '_urgency_text',
  '_urgency_ends_at',
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
  try {
    const shell = await openMutationProductShell(page, {
      baseUrl: opts.baseUrl,
      productPath: opts.productPath,
      productId: opts.productId || 0,
      timeout: CHECK_MS,
    });
    await waitShellReady(shell);
    return shell;
  } catch (openErr) {
    let trigger = shellTriggerLocator(page, 'panel', { productId: opts.productId || 0 });
    if ((await trigger.count()) === 0) {
      trigger = page.locator(`${SEL.sidePanelTrigger}, ${SEL.centeredPopupTrigger}`).first();
    }
    const one =
      (await trigger.filter({ visible: true }).count().catch(() => 0)) > 0
        ? trigger.filter({ visible: true }).first()
        : trigger.first();
    const force = (await one.getAttribute('data-wdp-goal-closed')) === '1';
    if (!force) throw openErr;
    await one.click({ timeout: CHECK_MS, force: true });
    const shell = openShellLocator(page, '');
    await waitShellReady(shell);
    return shell;
  }
}

/**
 * @param {import('@playwright/test').Locator} shell
 * @param {{ name?: string, phone?: string, amount?: string }} vals
 */
async function fillDonor(shell, vals = {}) {
  const name = shell.locator(SEL.donorName).first();
  if (await name.count()) await name.fill(vals.name || 'E2E Kampanya');
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
  if (vals.amount) {
    const price = shell.locator(SEL.customPrice).first();
    if (await price.count()) await price.fill(vals.amount);
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
 * AJAX sepete ekleme yanıtı (sunucu ret kanıtı).
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} shell
 * @param {number} productId
 */
async function postAddToCart(page, shell, productId) {
  let phoneVal = '5551234567';
  try {
    const { getActiveProfile } = await import('./profile.mjs');
    phoneVal = getActiveProfile()?.phone?.nationalExample || phoneVal;
  } catch {
    /* yedek */
  }
  return page.evaluate(
    async ({ pid, phoneVal }) => {
      const form = document.querySelector('.wdp-modal.show form, .wdp-donation-form form, form.wdp-donation-form');
      const fd = form ? new FormData(form) : new FormData();
      fd.set('action', 'wdp_ajax_add_to_cart');
      fd.set('wdp_product_id', String(pid));
      if (!fd.get('donation_full_name')) fd.set('donation_full_name', 'E2E Kampanya');
      if (!fd.get('donation_phone')) fd.set('donation_phone', phoneVal);
      if (!fd.get('custom_price')) fd.set('custom_price', '50');
      const ajax = window.wdp_ajax || {};
      if (ajax.nonce) fd.set('nonce', ajax.nonce);
      const url = ajax.ajax_url || '/wp-admin/admin-ajax.php';
      const res = await fetch(url, { method: 'POST', body: fd, credentials: 'same-origin' });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text.slice(0, 200) };
      }
      return { ok: res.ok, status: res.status, json };
    },
    { pid: productId, phoneVal }
  );
}

/**
 * @param {{ browser: import('@playwright/test').Browser, contextOpts: object, env: object, productUrls: object, productIds: object, listPagePath?: string, failures: any[], stats: { passed: number, failed: number } }} args
 */
export async function runCampaignBlocksChecks({
  browser,
  contextOpts,
  env,
  productUrls,
  productIds,
  listPagePath,
  failures,
  stats,
  createAdminContext,
  createVisitorContext,
}) {
  const checks = [];
  const baseUrl = env.E2E_BASE_URL;
  const listPath = popupPagePath(env, listPagePath);
  let campaignId = productIds.campaign || 0;
  let campaignPath = productUrls.campaign;
  try {
    const fx = requireFixtureRole(env, 'campaign');
    campaignId = fx.id;
    campaignPath = fx.path || fx.url || campaignPath;
  } catch (e) {
    failures.push(
      makeFailure({
        check: 'campaign-blocks-fixture',
        description: String(e.message || e),
        error: e,
      })
    );
    stats.failed += 1;
    return;
  }

  const ctx = await mutationBrowserContext(browser, contextOpts, createAdminContext, {
    createVisitorContext,
    env,
    role: 'campaign',
  });
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
    if (campaignId <= 0 || !campaignPath) {
      throw new Error('E2E kampanya ürün yolu/id yok');
    }
    // Güvenlik: bilinen staging ürünlerine dokunma
    const protectedIds = (env._profile?.protectedProductIds || [10695]).map(Number);
    if (protectedIds.includes(campaignId)) {
      throw new Error(`Kampanya E2E korunan ürüne (#${campaignId}) dokunamaz`);
    }

    for (const key of META_KEYS) {
      snapshot[key] = await getProductMeta(campaignId, key);
    }

    const open = async () =>
      openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: campaignPath,
        productId: campaignId,
      });

    // --- message: mesaj bağıştan önce, bağış alınır ---
    try {
      await emptyCart(page, baseUrl);
      await setProductMeta(campaignId, '_enable_progress_bar', 'yes');
      await setProductMeta(campaignId, '_progress_bar_limit', '500');
      await setProductMeta(campaignId, '_wdp_total_donation_amount', '500');
      await setProductMeta(campaignId, '_goal_reached_action', 'message');
      await setProductMeta(campaignId, '_goal_reached_message', '');
      metaTouched = true;

      const shell = await open();
      const notice = shell.locator('[data-wdp-goal-notice="1"]').first();
      await notice.waitFor({ state: 'visible', timeout: CHECK_MS });
      const amount = shell.locator(SEL.customPrice).first();
      const noticeBox = await notice.boundingBox();
      const amountBox = amount.count() ? await amount.boundingBox() : null;
      if (noticeBox && amountBox && noticeBox.y >= amountBox.y) {
        throw new Error('Hedef mesajı tutar alanından önce değil');
      }
      await fillDonor(shell, { amount: '50' });
      const add = shell.locator(SEL.addToCart).first();
      if (await add.isDisabled()) {
        throw new Error('message modunda Sepete Ekle disabled olmamalı');
      }
      pass('campaign-blocks-message-before-amount');
    } catch (e) {
      fail('campaign-blocks-message-before-amount', 'message: mesaj bağıştan önce', e);
    }

    // --- close: alan/düğme pasif + sunucu ret ---
    try {
      await emptyCart(page, baseUrl);
      await setProductMeta(campaignId, '_goal_reached_action', 'close');
      await setProductMeta(campaignId, '_wdp_total_donation_amount', '500');
      await setProductMeta(campaignId, '_progress_bar_limit', '500');
      metaTouched = true;
      const shell = await open();
      const notice = shell.locator('[data-wdp-goal-notice="1"]').first();
      await notice.waitFor({ state: 'visible', timeout: CHECK_MS });
      const closed = shell.locator('.wdp-goal-closed, [data-wdp-goal-closed="1"]').first();
      if ((await closed.count()) === 0) {
        throw new Error('close sarmalayıcı yok');
      }
      const addBtn = shell.locator('button[name="donation_add_to_cart"]').first();
      if ((await addBtn.count()) && !(await addBtn.isDisabled())) {
        throw new Error('close modunda Sepete Ekle disabled değil');
      }
      const post = await postAddToCart(page, shell, campaignId);
      const success = post.json && (post.json.success === true || post.json.success === 'true');
      if (success) {
        throw new Error('close modunda sunucu bağışı kabul etti: ' + JSON.stringify(post.json).slice(0, 180));
      }
      pass('campaign-blocks-close-blocks');
    } catch (e) {
      fail('campaign-blocks-close-blocks', 'close: pasif + sunucu ret', e);
    }

    // --- continue: mesaj yok ---
    try {
      await setProductMeta(campaignId, '_goal_reached_action', 'continue');
      await setProductMeta(campaignId, '_wdp_total_donation_amount', '500');
      metaTouched = true;
      const shell = await open();
      const notice = shell.locator('[data-wdp-goal-notice="1"]');
      if ((await notice.count()) > 0 && (await notice.first().isVisible())) {
        throw new Error('continue modunda hedef mesajı görünmemeli');
      }
      pass('campaign-blocks-continue-no-message');
    } catch (e) {
      fail('campaign-blocks-continue-no-message', 'continue: mesaj yok', e);
    }

    // --- hedef aşımı: çubuk %100 + gerçek tutar ---
    try {
      await setProductMeta(campaignId, '_progress_bar_limit', '500');
      await setProductMeta(campaignId, '_wdp_total_donation_amount', '750');
      await setProductMeta(campaignId, '_goal_reached_action', 'message');
      metaTouched = true;
      const shell = await open();
      const pct = shell.locator('[data-wdp-progress-pct-text]').first();
      const pctText = ((await pct.textContent()) || '').trim();
      if (!/^100(\.0)?%$/.test(pctText.replace(/\s/g, ''))) {
        throw new Error('Aşımda yüzde 100 değil: ' + pctText);
      }
      const fill = shell.locator('.wdp-progress-bar-fill').first();
      const width = await fill.evaluate((el) => el.style.width || '');
      if (!width.startsWith('100')) {
        throw new Error('Dolgu %100 değil: ' + width);
      }
      const amountHtml = (await shell.locator('.wdp-progress-bar-amount').first().textContent()) || '';
      if (!/750/.test(amountHtml.replace(/\s/g, ''))) {
        throw new Error('Gerçek tutar (750) görünmüyor: ' + amountHtml);
      }
      pass('campaign-blocks-overflow-bar');
    } catch (e) {
      fail('campaign-blocks-overflow-bar', 'hedef aşımı çubuk %100 + tutar', e);
    }

    // --- bitiş tarihi geçmiş şerit gizli ---
    try {
      await setProductMeta(campaignId, '_enable_urgency', 'yes');
      await setProductMeta(campaignId, '_urgency_text', 'E2E aciliyet');
      await setProductMeta(campaignId, '_urgency_ends_at', '2000-01-01');
      metaTouched = true;
      const shell = await open();
      const banner = shell.locator('.wdp-urgency-banner');
      if ((await banner.count()) > 0 && (await banner.first().isVisible())) {
        throw new Error('Geçmiş bitişte aciliyet şeridi görünür');
      }
      pass('campaign-blocks-urgency-expired');
    } catch (e) {
      fail('campaign-blocks-urgency-expired', 'bitiş tarihi geçmiş şerit gizli', e);
    }

    // --- sosyal kanıt {donors} ---
    try {
      await setProductMeta(campaignId, '_enable_social_proof', 'yes');
      await setProductMeta(campaignId, '_social_proof_text', '{donors} kişi bağış yaptı');
      await setProductMeta(campaignId, '_wdp_donor_count', '3');
      metaTouched = true;
      // product_info / donor cache düşsün (invalidate meta sonrası).
      await page.goto(withCacheBust(baseUrl, listPath, { _: String(Date.now()) }), {
        waitUntil: 'domcontentloaded',
      });
      const shell = await open();
      const social = shell.locator('.wdp-social-proof').first();
      await social.waitFor({ state: 'visible', timeout: CHECK_MS });
      const t = (await social.textContent()) || '';
      if (!/\b3\b/.test(t) || /\{donors\}/.test(t) || /128/.test(t)) {
        throw new Error('Sosyal kanıt beklenen değil (3 kişi): ' + t);
      }
      pass('campaign-blocks-social-donors');
    } catch (e) {
      fail('campaign-blocks-social-donors', 'sosyal kanıt {donors}', e);
    }

    // --- hedef olayı yalnız geçişte (başta %100 → olay/animasyon DOM'u yok) ---
    try {
      await setProductMeta(campaignId, '_wdp_total_donation_amount', '500');
      await setProductMeta(campaignId, '_progress_bar_limit', '500');
      metaTouched = true;
      const shell = await open();
      const bar = shell.locator('.wdp-progress-bar-container').first();
      const was = await bar.getAttribute('data-wdp-was-complete');
      if (was !== '1') {
        throw new Error('data-wdp-was-complete başlangıçta 1 olmalı, got=' + was);
      }
      await page.waitForTimeout(400);
      if (await bar.locator('.wdp-progress-celebrate').count()) {
        throw new Error('Başlangıçta %100 iken eski kutlama DOM’u eklendi');
      }
      pass('campaign-blocks-goal-reached-only-on-transition');
    } catch (e) {
      fail('campaign-blocks-goal-reached-only-on-transition', 'hedef olayı yalnız geçişte', e);
    }
  } catch (e) {
    fail('campaign-blocks-runner', 'Kampanya blokları E2E koşucusu', e);
  } finally {
    if (metaTouched && campaignId > 0) {
      try {
        await restoreMeta(campaignId, snapshot);
        pass('campaign-blocks-meta-restore');
      } catch (restoreErr) {
        fail('campaign-blocks-meta-restore', 'Kampanya meta geri yükleme başarısız', restoreErr);
      }
    }
    await ctx.close();
  }

  return {
    ok: failures.filter((f) => String(f.check || '').startsWith('campaign-blocks-')).length === 0,
    checks,
  };
}
