/**
 * Uzak kısa kontrol (e2e:remote-smoke): iPhone WebKit, 8 kritik akış.
 * Yeni senaryo yok — mevcut donation-flow / checks / currency-switch / native-submit-guard.
 */
import path from 'node:path';
import { withCacheBust } from './env.mjs';
import { DP_SEL, SEL } from './selectors.mjs';
import { advanceToDetails, clickSubmit, ensureDetailsStepForEmptySubmit, formOf, touchPendingSubmitExpectAmountError } from './dp-form.mjs';
import {
  applyTimeoutsToPage,
  isRemoteProfile,
  resolveProfileId,
} from './profile.mjs';
import {
  classifyVisiblePluginEntry,
  collectVisiblePluginEntry,
  LOOP_EXCLUDE_SEL,
} from './product-page-ui.mjs';
import {
  cartItemCount,
  cartStoreSnapshot,
  clickAddToCartWithRetry,
  clickShellTrigger,
  emptyCart,
  gotoWooCart,
  isDonationAddToCartRequest,
  makeFailure,
  openShellLocator,
  visibleValidationErrors,
} from './checks.mjs';
import { waitAndAssertShellOverlap } from './shell-overlap.mjs';
import {
  fillDonationShell,
  resolveDonationFillAmount,
} from './donation-flow.mjs';
import { comingSoonQuery } from './coming-soon.mjs';
import { collectPluginRuntime, shotDebugPng } from './flow-diag.mjs';
import { attachNativeSubmitReloadGuard } from './native-submit-guard.mjs';
import {
  currencySwitchFromProfile,
  extractPriceSnapshot,
  symbolForCode,
} from './currency-switch.mjs';
import { textHasFormattedAmount } from './currency.mjs';
import {
  assertProductNavTarget,
  decideScenarioProduct,
  productNavPath,
} from './catalog-core.mjs';
import { checkoutPathFromUrl } from './checkout-setup.mjs';
import { writeDebugJson } from './scenario-debug.mjs';
import { debugDirFor } from './e2e-paths.mjs';
import { SKIP_EVIDENCE, SKIP_REASONS, classifySkip, makeSkip } from './skip-policy.mjs';

export const SMOKE_CHECKS = Object.freeze([
  'product-page',
  'shell-open',
  'add-to-cart',
  'checkout-view',
  'amount-ambiguous',
  'currency-switch',
  'guards',
  'empty-cart',
]);

/**
 * @param {string[]} argv
 */
export function parseRemoteSmokeArgs(argv = process.argv.slice(2)) {
  const a = argv.filter((x) => x !== '--');
  let envRaw = 'local';
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--env' || x === '--profile') envRaw = String(a[++i] || envRaw);
    else if (x.startsWith('--env=')) envRaw = x.slice('--env='.length);
  }
  return { envId: resolveProfileId(envRaw) || 'local' };
}

export function isLocalSmokeEnv(envId) {
  const v = String(envId || '').toLowerCase();
  return v === 'local' || v === 'local-wp';
}

/**
 * Ziyaretçi smoke için yayımlı ürün (custom → fixed → campaign → shares).
 * @param {object} env
 * @returns {{ role: string, pagePath: string, id: number, name: string, display: string }|null}
 */
export function pickSmokeProduct(env) {
  for (const role of ['custom', 'fixed', 'campaign', 'shares']) {
    const decision = decideScenarioProduct(env, role, 'product-page');
    if (decision.action === 'skip' || decision.admin) continue;
    const rec = env._resolvedProducts?.[role];
    const raw = rec?.nav || rec?.url || rec?.path || env[`E2E_PRODUCT_${role.toUpperCase()}`];
    if (!raw) continue;
    let pagePath = '';
    try {
      pagePath = rec?.fromFixture ? assertProductNavTarget(raw, role) : productNavPath(raw) || String(raw);
    } catch {
      continue;
    }
    if (!pagePath || pagePath === '/') continue;
    return {
      role,
      pagePath,
      id: Number(rec?.id || 0),
      name: String(rec?.name || rec?.title || ''),
      display: String(rec?.display || ''),
    };
  }
  return null;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} check
 * @param {object} payload
 */
async function writeSmokeDebug(page, check, payload) {
  const file = path.join(debugDirFor(), `remote-smoke-${check}.json`);
  writeDebugJson(file, payload);
  let png = '';
  try {
    png = await shotDebugPng(page, `remote-smoke-${check}`);
  } catch (e) {
    png = `screenshot-fail: ${String(e && e.message ? e.message : e).slice(0, 80)}`;
  }
  return { debugFile: file, png };
}

function extraQuery(env, profile, extra = {}) {
  return { ...comingSoonQuery(env, profile), ...extra };
}

/**
 * @param {import('@playwright/test').Locator} shell
 */
export async function clickFirstVisibleTrigger(page, triggerSel, timeout, kind = '') {
  // Sayfa/oluşturucu hazır olana dek ilk görünür, döngü dışı adayı bekler (anlık kontrol yarış yaratır).
  const deadline = Date.now() + timeout;
  let lastState = 'aday yok';
  for (;;) {
    const n = await page.locator(triggerSel).count();
    const states = [];
    for (let i = 0; i < n; i += 1) {
      const btn = page.locator(triggerSel).nth(i);
      const inLoop = await btn.evaluate(
        (el, excludeSel) => !!(el.classList.contains('wdp-loop-donate') || (el.closest && el.closest(excludeSel))),
        LOOP_EXCLUDE_SEL
      );
      if (inLoop) {
        states.push(`#${i}:dongu-ici`);
        continue;
      }
      if (!(await btn.isVisible())) {
        states.push(`#${i}:gizli`);
        continue;
      }
      try {
        await clickShellTrigger(btn, timeout);
      } catch (e) {
        throw new Error(
          `kabuk tetikleyicisi tıklama hatası: locator=${triggerSel} aday=#${i}/${n} gorunur=true kind=${kind} — ${String(e && e.message ? e.message : e).split('\n')[0]}`
        );
      }
      return;
    }
    lastState = n ? states.join(',') : 'aday yok';
    if (Date.now() > deadline) break;
    await page.waitForTimeout(150);
  }
  throw new Error(`kabuk tetikleyicisi tıklanamadı: locator=${triggerSel} adaylar=[${lastState}] kind=${kind}`);
}

export async function clickAddOrGo(page, shell, timeout) {
  void page;
  await clickSubmit(shell, timeout);
}

function attachAddToCartProbe(page) {
  /** @type {string[]} */
  const ajax = [];
  /** @param {import('@playwright/test').Request} req */
  const onReq = (req) => {
    if (isDonationAddToCartRequest(req)) {
      ajax.push(`${req.method()} ${req.url()}`);
    }
  };
  page.on('request', onReq);
  return {
    ajax,
    detach() {
      page.off('request', onReq);
    },
  };
}

async function readPageCurrency(page) {
  return page.evaluate(() => {
    const form = document.querySelector('[data-dp-form]');
    return {
      code: '',
      decimals: form ? Number(form.getAttribute('data-decimals')) : NaN,
      thousandSeparator: form ? form.getAttribute('data-thousand-sep') : undefined,
      decimalSeparator: form ? form.getAttribute('data-decimal-sep') : undefined,
      symbol: '',
    };
  });
}

/**
 * Ödeme sayfası beklenmedik bir sayfaysa (ör. Coming soon, giriş, boş sepet yönlendirmesi) açık sınıfla hata.
 * Yalnız durum kodu, yol, gövde sınıfları ve ÇEREZ ADLARI yazılır (değer yok).
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Response|null} resp
 */
async function checkoutPageGuard(page, resp) {
  const info = await page.evaluate(() => ({
    bodyClass: String(document.body.className || '').split(/\s+/).filter(Boolean).slice(0, 8),
    comingSoon: !!document.querySelector('.woocommerce-coming-soon, [class*="coming-soon"], [id*="coming-soon"]'),
    isCheckout: !!document.querySelector('body.woocommerce-checkout, .wp-block-woocommerce-checkout, form.woocommerce-checkout, .wc-block-checkout'),
  }));
  if (info.isCheckout && !info.comingSoon) return;
  const cookies = (await page.context().cookies()).map((c) => c.name).filter((n) => /woo|wp_|wdp|session|cart|share/i.test(n));
  let finalPath = '';
  try {
    finalPath = new URL(page.url()).pathname;
  } catch {
    finalPath = '';
  }
  const kind = info.comingSoon ? 'coming-soon-engeli' : 'odeme-sayfasi-degil';
  throw new Error(
    `${kind}: status=${resp ? resp.status() : '?'} yol=${finalPath} bodyClass=${info.bodyClass.join('.')} cerezler=${[...new Set(cookies)].join(',')}`
  );
}

/**
 * @param {{
 *   page: import('@playwright/test').Page,
 *   env: object,
 *   profile: object,
 *   product: { role: string, pagePath: string, id: number, name: string, display: string },
 *   timeouts: { navigation: number, action: number, expect: number, settle: number },
 *   failures: object[],
 *   skips: object[],
 *   stats: { passed: number, failed: number, skipped: number },
 *   debugFiles: string[],
 * }} ctx
 */
export async function runRemoteSmokeChecks(ctx) {
  const { page, env, profile, product, timeouts, failures, skips, stats, debugFiles } = ctx;
  applyTimeoutsToPage(page, timeouts);
  const extra = extraQuery(env, profile);
  const reloadGuard = attachNativeSubmitReloadGuard(page);
  let filledAmount = 0;
  let productName = product.name;

  const fail = async (check, description, err) => {
    const detail = err && err.message ? String(err.message) : String(err || '');
    const diag = await writeSmokeDebug(page, check, {
      check,
      description,
      detail: detail.slice(0, 400),
      url: page.url(),
      role: product.role,
    });
    debugFiles.push(diag.debugFile);
    failures.push(
      makeFailure({
        check,
        description,
        error: err instanceof Error ? err : new Error(detail || description),
        debugFile: diag.debugFile,
      })
    );
    stats.failed += 1;
  };

  const pass = () => {
    stats.passed += 1;
  };

  const skipWp = (check, reason, detail, evidence = SKIP_EVIDENCE.WP_DATA) => {
    const row = makeSkip({
      check,
      reason,
      evidence,
      detail,
    });
    if (classifySkip(row) === 'fail') {
      failures.push(makeFailure({ check, description: `Altyapı atlaması hata: ${row.description}` }));
      stats.failed += 1;
      return;
    }
    skips.push(row);
    stats.skipped += 1;
  };

  // (1) ürün sayfası + betikler + tetikleyici
  try {
    await page.goto(withCacheBust(env.E2E_BASE_URL, product.pagePath, extra), {
      waitUntil: 'domcontentloaded',
      timeout: timeouts.navigation,
    });
    await page.waitForFunction(() => document.readyState === 'complete', {
      timeout: timeouts.expect,
    });
    const runtime = await collectPluginRuntime(page);
    // Yeni nesil: form paketi (donation-panel-experiences-js) yüklü VE en az bir kök bağlanmış (data-dp-mounted).
    const scriptsOk = !!(runtime.main_bundle || runtime.has_wdp_app);
    if (!scriptsOk) {
      throw new Error(
        `eklenti betiği yok bundle=${runtime.main_bundle} bağlı_kök=${runtime.has_wdp_app}`
      );
    }
    // Tema/sayfa oluşturucu girişi geç çizebilir: örnekle (sabit bekleme değil), süre sınırı profilden.
    const deadline = Date.now() + timeouts.expect;
    let classified = classifyVisiblePluginEntry(await collectVisiblePluginEntry(page));
    while (!classified.ok && Date.now() < deadline) {
      // Sayfa oluşturucular (Avada vb.) öğeyi kaydırınca gösterir: adım adım kaydır.
      await page.evaluate(() => window.scrollBy(0, Math.max(300, Math.round(window.innerHeight * 0.8))));
      await new Promise((r) => setTimeout(r, 250));
      classified = classifyVisiblePluginEntry(await collectVisiblePluginEntry(page));
    }
    if (!classified.ok) {
      const probe = await page.evaluate(
        ({ inlineSel, panelSel, popupSel }) => {
          const one = (sel) => {
            const all = Array.from(document.querySelectorAll(sel));
            const el = all[0];
            if (!el) return { n: 0 };
            const st = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
              n: all.length,
              display: st.display,
              visibility: st.visibility,
              opacity: st.opacity,
              w: Math.round(r.width),
              h: Math.round(r.height),
              inLoop: !!el.closest('.wdp-loop-donate,.wdp-form-host,[class*="related"],[class*="upsells"],ul.products'),
              parent: (el.parentElement && el.parentElement.className ? String(el.parentElement.className) : '').slice(0, 60),
            };
          };
          return { inline: one(inlineSel), panel: one(panelSel), popup: one(popupSel), url: location.pathname };
        },
        { inlineSel: SEL.inlineDonationForm, panelSel: SEL.sidePanelTrigger, popupSel: SEL.centeredPopupTrigger }
      );
      throw new Error(`${classified.reason || 'bağış tetikleyicisi görünmüyor'} probe=${JSON.stringify(probe)}`);
    }
    pass();
  } catch (e) {
    await fail('product-page', 'Ürün sayfası / eklenti betiği / tetikleyici', e);
    return;
  }

  // (2) kabuk + POPUP-OVERLAP + boş gönderim doğrulama
  try {
    const ui = await collectVisiblePluginEntry(page);
    const classified = classifyVisiblePluginEntry(ui);
    if (classified.kind === 'panel' || classified.kind === 'popup') {
      const triggerSel = classified.kind === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger;
      await clickFirstVisibleTrigger(page, triggerSel, timeouts.action, classified.kind);
    }
    const shell =
      classified.kind === 'form'
        ? page.locator(SEL.inlineRoot).first()
        : openShellLocator(page, classified.kind === 'panel' ? 'panel' : classified.kind === 'popup' ? 'popup' : '');
    await shell.waitFor({ state: 'visible', timeout: timeouts.expect });
    const overlap = await waitAndAssertShellOverlap(page, timeouts.settle);
    if (overlap && overlap.ok === false) {
      throw new Error(`POPUP-OVERLAP: ${overlap.reason || 'form alanı örtülü'}`);
    }
    reloadGuard.clearHits();
    reloadGuard.arm();
    // İlk adım boşken ana düğme: tutar adımı varsa tutar, yoksa bilgi adımı alanları doğrulanır.
    const price = formOf(shell).locator(SEL.customPrice).first();
    if ((await price.count()) > 0 && (await price.isVisible())) {
      await price.fill('');
      // 12.1: tutar boşken düğme pasif (aria-disabled); tıklama yok. Doğrula, tutar seç, bilgi adımında boş gönder.
      const submitBtn = formOf(shell).locator(DP_SEL.submit).first();
      const pending = await submitBtn.getAttribute('aria-disabled');
      if (pending !== 'true') throw new Error(`tutar boşken düğme pasif değil (aria-disabled=${pending})`);
      await advanceToDetails(formOf(shell));
    } else {
      // Hazır tutar kartlı ürün (serbest tutar alanı yok): pasif düğmeyi doğrula, tutar seçip bilgi adımına geç.
      await ensureDetailsStepForEmptySubmit(formOf(shell));
    }
    const name = formOf(shell).locator(SEL.donorName).first();
    if ((await name.count()) > 0 && (await name.isVisible())) await name.fill('');
    await clickAddOrGo(page, shell, timeouts.action);
    await formOf(shell)
      .locator('[data-dp-error]')
      .filter({ hasText: /\S/ })
      .first()
      .waitFor({ state: 'visible', timeout: timeouts.expect })
      .catch((e) => {
        throw new Error('boş gönderimde görünür doğrulama mesajı yok: ' + String(e.message || e).split('\n')[0]);
      });
    const errs = await visibleValidationErrors(page);
    if (!errs.length) {
      throw new Error('boş gönderimde görünür doğrulama mesajı yok');
    }
    reloadGuard.assertClear('shell-open');
    reloadGuard.disarm();
    pass();
  } catch (e) {
    await fail('shell-open', 'Kabuk açılışı / POPUP-OVERLAP / boş gönderim', e);
    return;
  }

  // (3) geçerli tutar → Store API + sepet sayfası
  try {
    await Promise.race([
      emptyCart(page, env.E2E_BASE_URL),
      new Promise((_, rej) => setTimeout(() => rej(new Error('emptyCart timeout')), timeouts.action)),
    ]);
    await page.goto(withCacheBust(env.E2E_BASE_URL, product.pagePath, extra), {
      waitUntil: 'domcontentloaded',
      timeout: timeouts.navigation,
    });
    const uiAdd = await collectVisiblePluginEntry(page);
    const classAdd = classifyVisiblePluginEntry(uiAdd);
    if (classAdd.kind === 'panel' || classAdd.kind === 'popup') {
      const triggerSel = classAdd.kind === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger;
      await clickFirstVisibleTrigger(page, triggerSel, timeouts.action, classAdd.kind);
    }
    const shell =
      classAdd.kind === 'form'
        ? page.locator(SEL.inlineRoot).first()
        : openShellLocator(page, classAdd.kind === 'panel' ? 'panel' : classAdd.kind === 'popup' ? 'popup' : '');
    await shell.waitFor({ state: 'visible', timeout: timeouts.expect });
    const picked = await resolveDonationFillAmount(shell, profile.currency);
    filledAmount = picked.amount;
    await fillDonationShell(shell, { kind: 'custom', amount: picked.amount, fill: picked.fill });
    reloadGuard.clearHits();
    reloadGuard.arm();
    await clickAddOrGo(page, shell, timeouts.action);
    reloadGuard.assertClear('add-to-cart');
    reloadGuard.disarm();
    // Başarılı eklemede form ödeme sayfasına yönlendirir (REST cart/add yanıtındaki checkout_url).
    await page.waitForURL(/checkout|odeme|ödeme|order/i, { timeout: timeouts.navigation });
    const store = await cartStoreSnapshot(page, env.E2E_BASE_URL);
    if (!store.items_count) {
      throw new Error(`Store API sepet boş items=${store.items_count}`);
    }
    const hit = store.items.find((it) => {
      if (product.id && Number(it.id) === product.id) return true;
      if (productName && String(it.name || '').includes(productName)) return true;
      return store.items.length === 1;
    });
    if (!hit) {
      throw new Error(`Store API ürün yok id=${product.id} items=${store.items.map((i) => i.id).join(',')}`);
    }
    const cartAmt = Number(hit.totals);
    if (Number.isFinite(filledAmount) && Number.isFinite(cartAmt) && Math.abs(cartAmt - filledAmount) > 0.009) {
      throw new Error(`Store API tutar ${cartAmt} ≠ form ${filledAmount}`);
    }
    if (!productName) productName = hit.name;
    await gotoWooCart(page, env.E2E_BASE_URL);
    pass();
  } catch (e) {
    await fail('add-to-cart', 'Geçerli tutarla sepete ekle / Store API / sepet sayfası', e);
    return;
  }

  // (4) ödeme sayfası — alan doldurma yok, sipariş yok
  try {
    const checkoutPath = checkoutPathFromUrl(env.E2E_CHECKOUT_PAGE || '', env.E2E_BASE_URL);
    const checkoutResp = await page.goto(withCacheBust(env.E2E_BASE_URL, checkoutPath, extra), {
      waitUntil: 'domcontentloaded',
      timeout: timeouts.navigation,
    });
    try {
      await checkoutPageGuard(page, checkoutResp);
    } catch (guardErr) {
      throw guardErr;
    }
    await page
      .locator('body.woocommerce-checkout, .wp-block-woocommerce-checkout, form.woocommerce-checkout, .wc-block-checkout')
      .first()
      .waitFor({ state: 'attached', timeout: timeouts.expect });
    await page.waitForFunction(() => {
      return !!(
        document.querySelector(
          '.wc-block-components-product-name, td.product-name, .cart_item, .wc-block-components-order-summary-item, form.checkout, .wc-block-checkout'
        )
      );
    }, { timeout: timeouts.expect });
    const summaryBtn = page
      .locator(
        '.wc-block-components-order-summary button[aria-expanded], .wc-block-components-panel__button, .wc-block-components-checkout-order-summary__title'
      )
      .first();
    if ((await summaryBtn.count()) > 0 && (await summaryBtn.isVisible())) {
      const expanded = await summaryBtn.getAttribute('aria-expanded');
      if (expanded !== 'true') {
        await summaryBtn.click({ timeout: timeouts.action });
      }
    }
    const nameEl = page
      .locator(
        '.wc-block-components-product-name, .wc-block-components-order-summary-item__description, .product-name, td.product-name, .cart_item .product-name a'
      )
      .filter({ visible: true })
      .first();
    await nameEl.waitFor({ state: 'visible', timeout: timeouts.expect });
    const nameText = ((await nameEl.textContent()) || '').trim();
    if (!nameText) {
      throw new Error('checkout-view-only: ödeme sayfasında ürün adı görünmüyor');
    }
    const bodyText = await page.locator('body').innerText();
    if (filledAmount && !textHasFormattedAmount(bodyText, filledAmount, profile.currency)) {
      throw new Error('checkout-view-only: WooCommerce biçimli tutar ödeme sayfasında görünmüyor');
    }
    if (isRemoteProfile(profile)) {
      skipWp('checkout-view-order', SKIP_REASONS.NO_REMOTE_ORDERS, 'view-only', SKIP_EVIDENCE.POLICY);
    }
    pass();
  } catch (e) {
    const msg = e && e.message ? String(e.message) : '';
    if (/^coming-soon-engeli/.test(msg) && profile.comingSoon) {
      // Kanıt: profil/keşif coming_soon=yes (WP verisi) + sayfada coming soon işareti. Yayın öncesi site; ödeme içeriği doğrulanamaz.
      skipWp(
        'checkout-view',
        SKIP_REASONS.COMING_SOON_CHECKOUT,
        msg.replace(/cerezler=.*$/, '').trim(),
        SKIP_EVIDENCE.WP_DATA
      );
    } else {
      await fail('checkout-view', 'Ödeme sayfası ürün adı / tutar (view-only)', e);
      return;
    }
  }

  // (5) belirsiz/kuruşlu tutar — ondalık 0 mağazada 10,50
  try {
    await Promise.race([
      emptyCart(page, env.E2E_BASE_URL),
      new Promise((_, rej) => setTimeout(() => rej(new Error('emptyCart timeout')), timeouts.action)),
    ]);
    await page.goto(withCacheBust(env.E2E_BASE_URL, product.pagePath, extra), {
      waitUntil: 'domcontentloaded',
      timeout: timeouts.navigation,
    });
    const uiAmb = await collectVisiblePluginEntry(page);
    const classAmb = classifyVisiblePluginEntry(uiAmb);
    if (classAmb.kind === 'panel' || classAmb.kind === 'popup') {
      const triggerSel = classAmb.kind === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger;
      await clickFirstVisibleTrigger(page, triggerSel, timeouts.action, classAmb.kind);
    }
    const shell =
      classAmb.kind === 'form'
        ? page.locator(SEL.inlineRoot).first()
        : openShellLocator(page, classAmb.kind === 'panel' ? 'panel' : classAmb.kind === 'popup' ? 'popup' : '');
    await shell.waitFor({ state: 'visible', timeout: timeouts.expect });
    const pageCur = await readPageCurrency(page);
    const decimals = Number.isFinite(pageCur.decimals) ? pageCur.decimals : Number(profile.currency?.decimals);
    if (!(Number.isFinite(decimals) && decimals <= 0)) {
      skipWp('amount-ambiguous', SKIP_REASONS.SETTING_OFF, `decimals=${decimals}`);
    } else {
      const price = formOf(shell).locator(SEL.customPrice).first();
      await price.waitFor({ state: 'visible', timeout: timeouts.expect });
      await price.fill('10,50');
      reloadGuard.clearHits();
      reloadGuard.arm();
      const probe = attachAddToCartProbe(page);
      try {
        // 12.1: belirsiz tutarda ana düğme pasif; doğrula, force ile dokun, tutar hatası görünür, istek yok.
        await touchPendingSubmitExpectAmountError(formOf(shell), timeouts.expect);
        if (probe.ajax.length) {
          throw new Error(`10,50 sepete eklendi (${probe.ajax.length} istek)`);
        }
        reloadGuard.assertClear('amount-ambiguous');
      } finally {
        reloadGuard.disarm();
        probe.detach();
      }
      pass();
    }
  } catch (e) {
    await fail('amount-ambiguous', 'Belirsiz/kuruşlu tutar sepete eklenmedi', e);
  }

  // (6) staging Curcy EUR görüntü (profil currencySwitch yoksa WP-data atla)
  const spec = currencySwitchFromProfile(profile);
  if (!spec || !spec.codes.includes('EUR')) {
    skipWp('currency-switch', SKIP_REASONS.SETTING_OFF, 'currencySwitch.EUR yok');
  } else {
    try {
      const param = spec.param;
      await page.goto(withCacheBust(env.E2E_BASE_URL, product.pagePath, extraQuery(env, profile, { [param]: 'EUR' })), {
        waitUntil: 'domcontentloaded',
        timeout: timeouts.navigation,
      });
      const snap = extractPriceSnapshot(await page.content(), profile.currency);
      const euro = symbolForCode('EUR');
      const has = snap.symbols.some((s) => s.includes(euro)) || snap.texts.some((t) => t.includes(euro));
      if (!has) {
        throw new Error(`EUR görüntüde ${euro} yok symbols=${snap.symbols.join('|') || '—'}`);
      }
      pass();
    } catch (e) {
      await fail('currency-switch', 'Para birimi EUR görüntü doğrulaması', e);
    }
  }

  // (7) NATIVE-SUBMIT-RELOAD — canlı/remote_post özeti koşucu raporlar
  try {
    reloadGuard.assertClear('guards');
    pass();
  } catch (e) {
    await fail('guards', 'NATIVE-SUBMIT-RELOAD', e);
  }

  // (8) test sepeti temiz
  try {
    await Promise.race([
      emptyCart(page, env.E2E_BASE_URL),
      new Promise((_, rej) => setTimeout(() => rej(new Error('emptyCart timeout')), timeouts.action)),
    ]);
    const n = await cartItemCount(page, env.E2E_BASE_URL);
    if (n > 0) throw new Error(`sepet temiz değil items=${n}`);
    pass();
  } catch (e) {
    await fail('empty-cart', 'Test sepeti temizlenemedi', e);
  }

  try {
    reloadGuard.detach();
  } catch (e) {
    console.error(`[e2e:catch-fail] reloadGuard.detach: ${e && e.message ? e.message : e}`);
  }
}
