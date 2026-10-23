/**
 * Mutasyon senaryo sınıfı (3I).
 * (i) product-meta — yalnız fixture ürün metası; uzakta yönetici + fixture ürün adresi.
 * (ii) local-only — global ayar / sayfa / kısa kod sayfası; uzakta ATLA (hata değil).
 */
import { withCacheBust } from './env.mjs';
import { isRemoteProfile } from './profile.mjs';
import {
  openShellLocator,
  clickShellTrigger,
  shellTriggerLocator,
} from './checks.mjs';
import { SEL } from './selectors.mjs';

export const KIND_PRODUCT_META = 'product-meta';
export const KIND_LOCAL_ONLY = 'local-only';

/** Mutasyon suite’leri yalnız bu cihazda (diğerleri salt okunur). */
export const MUTATION_DEVICE_ID = 'iphone';

/**
 * @param {string} [deviceId]
 */
export function deviceRunsMutations(deviceId) {
  return String(deviceId || '').toLowerCase() === MUTATION_DEVICE_ID;
}

/** @type {Array<{ id: string, kind: string, suite: string, reason?: string }>} */
export const MUTATION_SCENARIOS = [
  { id: 'amount-opts-e-initial-empty-no-recommended', kind: KIND_PRODUCT_META, suite: 'amount-options' },
  { id: 'amount-opts-k2-recommended-only-configured', kind: KIND_PRODUCT_META, suite: 'amount-options' },
  { id: 'amount-opts-checkout-always-active', kind: KIND_PRODUCT_META, suite: 'amount-options' },
  { id: 'amount-opts-d-same-product-persist', kind: KIND_PRODUCT_META, suite: 'amount-options' },
  { id: 'amount-opts-a-switch-product-clears', kind: KIND_PRODUCT_META, suite: 'amount-options' },
  { id: 'amount-opts-b-reload-clears', kind: KIND_PRODUCT_META, suite: 'amount-options' },
  { id: 'amount-opts-c-after-cart-clears', kind: KIND_PRODUCT_META, suite: 'amount-options' },
  { id: 'amount-opts-g-min-hides-below', kind: KIND_PRODUCT_META, suite: 'amount-options' },
  { id: 'amount-opts-h-quantity-fixed', kind: KIND_PRODUCT_META, suite: 'amount-options' },
  { id: 'amount-opts-i-cover-fee-total', kind: KIND_PRODUCT_META, suite: 'amount-options' },
  { id: 'form-fields-invalid-email-visible', kind: KIND_PRODUCT_META, suite: 'form-fields' },
  { id: 'form-fields-closed-fields-ignored', kind: KIND_PRODUCT_META, suite: 'form-fields' },
  { id: 'form-fields-dedication-maxlength', kind: KIND_PRODUCT_META, suite: 'form-fields' },
  { id: 'form-fields-anonymous-public-masked', kind: KIND_PRODUCT_META, suite: 'form-fields' },
  { id: 'form-fields-cart-shows-email-dedication', kind: KIND_PRODUCT_META, suite: 'form-fields' },
  { id: 'form-fields-wizard-product-on', kind: KIND_PRODUCT_META, suite: 'form-fields' },
  { id: 'form-fields-wizard-product-off', kind: KIND_PRODUCT_META, suite: 'form-fields' },
  { id: 'form-fields-icons-off', kind: KIND_PRODUCT_META, suite: 'form-fields' },
  { id: 'form-fields-privacy-notice', kind: KIND_PRODUCT_META, suite: 'form-fields' },
  { id: 'campaign-blocks-message-before-amount', kind: KIND_PRODUCT_META, suite: 'campaign-blocks' },
  { id: 'campaign-blocks-close-blocks', kind: KIND_PRODUCT_META, suite: 'campaign-blocks' },
  { id: 'campaign-blocks-continue-no-message', kind: KIND_PRODUCT_META, suite: 'campaign-blocks' },
  { id: 'campaign-blocks-overflow-bar', kind: KIND_PRODUCT_META, suite: 'campaign-blocks' },
  { id: 'campaign-blocks-urgency-expired', kind: KIND_PRODUCT_META, suite: 'campaign-blocks' },
  { id: 'campaign-blocks-social-donors', kind: KIND_PRODUCT_META, suite: 'campaign-blocks' },
  { id: 'campaign-blocks-celebrate-only-transition', kind: KIND_PRODUCT_META, suite: 'campaign-blocks' },
  { id: 'product-theme-primary-and-contrast', kind: KIND_PRODUCT_META, suite: 'product-theme' },
  { id: 'product-theme-fallback-no-product-primary', kind: KIND_PRODUCT_META, suite: 'product-theme' },
  { id: 'product-theme-radius-clamp', kind: KIND_PRODUCT_META, suite: 'product-theme' },
  { id: 'product-theme-privacy-link', kind: KIND_PRODUCT_META, suite: 'product-theme' },
  {
    id: 'shortcodes-setup',
    kind: KIND_LOCAL_ONLY,
    suite: 'shortcodes',
    reason: 'kısa kod liste sayfası (uzakta sayfa oluşturulmaz)',
  },
  {
    id: 'shortcode-list-price-refresh',
    kind: KIND_LOCAL_ONLY,
    suite: 'shortcodes',
    reason: 'kısa kod liste sayfası (uzakta sayfa oluşturulmaz)',
  },
  {
    id: 'shortcode-tabs-aria',
    kind: KIND_LOCAL_ONLY,
    suite: 'shortcodes',
    reason: 'kısa kod liste sayfası (uzakta sayfa oluşturulmaz)',
  },
  {
    id: 'shortcode-bad-hash',
    kind: KIND_LOCAL_ONLY,
    suite: 'shortcodes',
    reason: 'kısa kod liste sayfası (uzakta sayfa oluşturulmaz)',
  },
  { id: 'shortcode-button-text', kind: KIND_PRODUCT_META, suite: 'shortcodes' },
  { id: 'shortcode-form-outofstock', kind: KIND_PRODUCT_META, suite: 'shortcodes' },
];

const BY_ID = new Map(MUTATION_SCENARIOS.map((s) => [s.id, s]));

/**
 * @param {string} id
 */
export function mutationScenarioKind(id) {
  return BY_ID.get(String(id || ''))?.kind || '';
}

/**
 * @param {string} id
 */
export function mutationScenarioOf(id) {
  return BY_ID.get(String(id || '')) || null;
}

/**
 * Uzakta local-only → skip (hata değil).
 * @param {object} env
 * @param {string} checkId
 * @param {Array<{check:string,description:string}>} skips
 * @param {{ skipped?: number }} stats
 * @returns {boolean} true ise koşma
 */
export function skipLocalOnlyOnRemote(env, checkId, skips, stats) {
  const row = mutationScenarioOf(checkId);
  if (!row || row.kind !== KIND_LOCAL_ONLY) return false;
  if (!isRemoteProfile(env?._profile)) return false;
  skips.push({
    check: checkId,
    description: `yalnız yerel: ${row.reason || 'global ayar/sayfa'}`,
  });
  if (stats) stats.skipped = (stats.skipped || 0) + 1;
  return true;
}

/**
 * Fixture ürün sayfasını yönetici oturumunda aç (liste yok; private ürün).
 * @param {import('@playwright/test').Page} page
 * @param {{ baseUrl: string, productPath: string, productId?: number, timeout?: number }} opts
 */
export async function openMutationProductShell(page, opts) {
  const productPath = opts?.productPath || opts?.path || '';
  const baseUrl = opts?.baseUrl || '';
  const productId = Number(opts?.productId || 0);
  const timeout = Number(opts?.timeout || 20000);
  if (!productPath) {
    throw new Error('fixture ürün adresi yok');
  }
  await page.goto(withCacheBust(baseUrl, productPath, { hdf_no_side_cart: '1' }), {
    waitUntil: 'domcontentloaded',
    timeout,
  });
  const visibleForm = page.locator(SEL.donationForm).filter({ visible: true }).first();
  if ((await visibleForm.count()) > 0) {
    const wrap = page
      .locator('.hdf-donation-modal-wrapper, .wdp-donation-form')
      .filter({ has: page.locator(SEL.donationForm) })
      .first();
    if ((await wrap.count()) > 0) return wrap;
    return visibleForm;
  }
  let trigger = shellTriggerLocator(page, 'panel', { productId });
  if ((await trigger.count()) === 0) {
    trigger = shellTriggerLocator(page, 'popup', { productId });
  }
  if ((await trigger.count()) === 0) {
    trigger = page.locator(`${SEL.sidePanelTrigger}, ${SEL.centeredPopupTrigger}`).first();
  }
  await clickShellTrigger(trigger, timeout);
  const shell = openShellLocator(page, '');
  await shell.waitFor({ state: 'visible', timeout });
  await shell.locator(SEL.donationForm).first().waitFor({ state: 'visible', timeout });
  return shell;
}
