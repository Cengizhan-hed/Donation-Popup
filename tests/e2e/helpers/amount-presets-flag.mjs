/**
 * Genel `enable_amount_presets` — yalnız açık/kapalı. Ham option değeri loglanmaz.
 */
import { SKIP_EVIDENCE, SKIP_REASONS, makeSkip } from './skip-policy.mjs';
import { MUTATION_SCENARIOS } from './mutation-policy.mjs';
import { usesLocalWpMeta } from './staging-wp-meta.mjs';
import { parseLocalEvalJson, runLocalEvalFile } from './local-wp-eval.mjs';
import { runEvalFile } from './wp-remote.mjs';

const FLAG_PHP = 'tests/e2e/helpers/read-amount-presets-flag.php';

export const AMOUNT_OPTS_CHECK_IDS = MUTATION_SCENARIOS.filter((s) => s.suite === 'amount-options').map(
  (s) => s.id
);

/**
 * @param {unknown} buttonSettings
 */
export function isGlobalAmountPresetsOn(buttonSettings) {
  const v =
    buttonSettings && typeof buttonSettings === 'object'
      ? buttonSettings.enable_amount_presets
      : buttonSettings;
  return v === '1' || v === 1 || v === true || v === 'yes';
}

/**
 * @param {boolean} globalOn
 */
export function decideAmountOptsSuite(globalOn) {
  if (!globalOn) {
    return {
      action: 'skip',
      reason: SKIP_REASONS.SETTING_OFF,
      evidence: SKIP_EVIDENCE.WP_DATA,
    };
  }
  return { action: 'run' };
}

function parseFlagJson(text) {
  const raw = String(text || '');
  const i = raw.indexOf('{');
  const j = raw.lastIndexOf('}');
  if (i < 0 || j < i) {
    throw new Error('amount-presets-flag: JSON yok');
  }
  const data = JSON.parse(raw.slice(i, j + 1));
  if (!data || data.ok !== true) {
    throw new Error('amount-presets-flag: ok değil');
  }
  return data.on === true;
}

/**
 * WP’den genel ayarı oku. Dönüş yalnız boolean; değer yazdırılmaz.
 * @returns {Promise<boolean>}
 */
export async function readGlobalAmountPresetsOn() {
  if (usesLocalWpMeta()) {
    return parseFlagJson(runLocalEvalFile(FLAG_PHP));
  }
  return parseFlagJson(runEvalFile(FLAG_PHP));
}

/**
 * @param {boolean} globalOn
 * @param {Array<object>} skips
 * @param {{ skipped?: number }} stats
 * @returns {boolean} true ise koşma
 */
export function skipAmountOptsIfSettingOff(globalOn, skips, stats) {
  const d = decideAmountOptsSuite(globalOn);
  if (d.action !== 'skip') return false;
  const list = Array.isArray(skips) ? skips : [];
  for (const id of AMOUNT_OPTS_CHECK_IDS) {
    list.push(
      makeSkip({
        check: id,
        reason: d.reason,
        evidence: d.evidence,
        detail: 'enable_amount_presets',
      })
    );
    if (stats) stats.skipped = (stats.skipped || 0) + 1;
  }
  return true;
}
