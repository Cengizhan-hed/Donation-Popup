/**
 * Alt bağış yapılandırması: WP eval (tarayıcı yok). 1 yeniden deneme.
 */
import { parseLocalEvalJson, runLocalEvalFile } from './local-wp-eval.mjs';
import { usesLocalWpMeta } from './staging-wp-meta.mjs';
import { runEvalFile } from './wp-remote.mjs';
import { peekActiveProfile, isRemoteProfile } from './profile.mjs';
import { SKIP_EVIDENCE, SKIP_REASONS } from './skip-policy.mjs';

const EVAL_FILE = 'tests/e2e/helpers/addon-admin-config.php';

function normalizeConfig(data, productId) {
  if (!data || data.ok !== true) return null;
  const enabled = !!data.enabled;
  const productWcId = Number(data.productWcId) || 0;
  const globalWcId = Number(data.globalWcId) || 0;
  const resolvedWcId = Number(data.resolvedWcId) || (productWcId > 0 ? productWcId : globalWcId);
  let reason = String(data.reason || '');
  let status = String(data.status || '');
  if (!enabled) {
    status = 'atlandı';
    reason = SKIP_REASONS.SETTING_OFF;
  } else if (resolvedWcId <= 0) {
    status = 'atlandı';
    reason = SKIP_REASONS.NO_WC_PRODUCT_ID;
  } else {
    status = 'beklenir';
    reason = `beklenir — WC ürün #${resolvedWcId}`;
  }
  return {
    enabled,
    productWcId,
    globalWcId,
    resolvedWcId,
    expected: status === 'beklenir',
    status,
    reason,
    evidence: status === 'atlandı' ? SKIP_EVIDENCE.WP_DATA : '',
    detail: `enable=${enabled} ürün_id=${productWcId} genel_id=${globalWcId} → ${reason} id=${Number(productId) || 0}`,
  };
}

function readOnce(productId) {
  const id = Number(productId) || 0;
  if (id <= 0) return null;
  const profile = peekActiveProfile();
  if (usesLocalWpMeta(profile) || !isRemoteProfile(profile)) {
    const data = parseLocalEvalJson(runLocalEvalFile(EVAL_FILE, [String(id)]));
    return normalizeConfig(data, id);
  }
  const raw = runEvalFile(EVAL_FILE, {}, String(id));
  const i = String(raw || '').indexOf('{');
  const j = String(raw || '').lastIndexOf('}');
  if (i < 0 || j < i) {
    throw new Error('addon eval JSON yok');
  }
  return normalizeConfig(JSON.parse(raw.slice(i, j + 1)), id);
}

/**
 * @param {number} productId
 * @returns {object|null}
 */
export function readAddonConfigViaEval(productId) {
  const id = Number(productId) || 0;
  if (id <= 0) return null;
  try {
    return readOnce(id);
  } catch (e) {
    console.error(`[e2e:catch-fail] addon eval deneme 1: ${e && e.message ? e.message : e}`);
  }
  try {
    return readOnce(id);
  } catch (e) {
    console.error(`[e2e:catch-fail] addon eval deneme 2: ${e && e.message ? e.message : e}`);
    throw e;
  }
}
