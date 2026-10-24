/**
 * Genel enable_amount_presets: yalnız açık/kapalı; değer yazılmaz.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGlobalAmountPresetsOn,
  decideAmountOptsSuite,
  skipAmountOptsIfSettingOff,
  AMOUNT_OPTS_CHECK_IDS,
} from '../../../tests/e2e/helpers/amount-presets-flag.mjs';
import { SKIP_EVIDENCE, SKIP_REASONS, classifySkip } from '../../../tests/e2e/helpers/skip-policy.mjs';

describe('isGlobalAmountPresetsOn', () => {
  it('1 / yes / true açık; 0 / no / boş kapalı', () => {
    assert.equal(isGlobalAmountPresetsOn({ enable_amount_presets: '1' }), true);
    assert.equal(isGlobalAmountPresetsOn({ enable_amount_presets: 'yes' }), true);
    assert.equal(isGlobalAmountPresetsOn({ enable_amount_presets: true }), true);
    assert.equal(isGlobalAmountPresetsOn({ enable_amount_presets: '0' }), false);
    assert.equal(isGlobalAmountPresetsOn({ enable_amount_presets: 'no' }), false);
    assert.equal(isGlobalAmountPresetsOn({}), false);
    assert.equal(isGlobalAmountPresetsOn(null), false);
  });
});

describe('decideAmountOptsSuite', () => {
  it('kapalı → setting-off + wp-data; açık → run', () => {
    const off = decideAmountOptsSuite(false);
    assert.equal(off.action, 'skip');
    assert.equal(off.reason, SKIP_REASONS.SETTING_OFF);
    assert.equal(off.evidence, SKIP_EVIDENCE.WP_DATA);
    assert.equal(classifySkip(off), 'skip');
    assert.equal(decideAmountOptsSuite(true).action, 'run');
  });
});

describe('skipAmountOptsIfSettingOff', () => {
  it('kapalıysa tüm amount-opts-* atlanır; değer dökülmez', () => {
    const skips = [];
    const stats = { skipped: 0 };
    assert.equal(skipAmountOptsIfSettingOff(false, skips, stats), true);
    assert.ok(AMOUNT_OPTS_CHECK_IDS.length >= 5);
    assert.equal(skips.length, AMOUNT_OPTS_CHECK_IDS.length);
    assert.equal(stats.skipped, AMOUNT_OPTS_CHECK_IDS.length);
    assert.equal(skips[0].reason, SKIP_REASONS.SETTING_OFF);
    assert.equal(skips[0].evidence, SKIP_EVIDENCE.WP_DATA);
    const json = JSON.stringify(skips);
    assert.doesNotMatch(json, /"enable_amount_presets":|"0"|"1"/);
    assert.equal(skipAmountOptsIfSettingOff(true, [], { skipped: 0 }), false);
  });
});
