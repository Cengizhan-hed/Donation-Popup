import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MUTATION_SCENARIOS,
  KIND_PRODUCT_META,
  KIND_LOCAL_ONLY,
  mutationScenarioKind,
  skipLocalOnlyOnRemote,
  deviceRunsMutations,
} from '../../../tests/e2e/helpers/mutation-policy.mjs';

describe('mutasyon senaryo sınıfı', () => {
  it('amount/form/campaign/theme product-meta; shortcode liste local-only', () => {
    assert.equal(mutationScenarioKind('amount-opts-e-initial-empty-no-recommended'), KIND_PRODUCT_META);
    assert.equal(mutationScenarioKind('form-fields-invalid-email-visible'), KIND_PRODUCT_META);
    assert.equal(mutationScenarioKind('campaign-blocks-close-blocks'), KIND_PRODUCT_META);
    assert.equal(mutationScenarioKind('product-theme-primary-and-contrast'), KIND_PRODUCT_META);
    assert.equal(mutationScenarioKind('shortcode-form-outofstock'), KIND_PRODUCT_META);
    assert.equal(mutationScenarioKind('shortcodes-setup'), KIND_LOCAL_ONLY);
    assert.equal(mutationScenarioKind('shortcode-list-price-refresh'), KIND_LOCAL_ONLY);
  });

  it('uzakta local-only atlanır; yerelde koşar', () => {
    const skips = [];
    const stats = { skipped: 0 };
    assert.equal(
      skipLocalOnlyOnRemote({ _profile: { id: 'staging-hedef', ssh: { alias: 'hedef-staging' } } }, 'shortcodes-setup', skips, stats),
      true
    );
    assert.equal(stats.skipped, 1);
    assert.equal(skips[0].check, 'shortcodes-setup');
    assert.match(skips[0].description, /yalnız yerel/);
    assert.equal(
      skipLocalOnlyOnRemote({ _profile: { id: 'local', remote: false } }, 'shortcodes-setup', skips, stats),
      false
    );
    assert.equal(
      skipLocalOnlyOnRemote({ _profile: { id: 'staging-hedef', ssh: { alias: 'hedef-staging' } } }, 'amount-opts-g-min-hides-below', skips, stats),
      false
    );
  });

  it('mutasyon yalnız iphone', () => {
    assert.equal(deviceRunsMutations('iphone'), true);
    assert.equal(deviceRunsMutations('android'), false);
    assert.equal(deviceRunsMutations('desktop'), false);
  });

  it('tabloda her satırın id/kind/suite’si var', () => {
    assert.ok(MUTATION_SCENARIOS.length >= 20);
    for (const row of MUTATION_SCENARIOS) {
      assert.ok(row.id, JSON.stringify(row));
      assert.ok(row.kind === KIND_PRODUCT_META || row.kind === KIND_LOCAL_ONLY, row.id);
      assert.ok(row.suite, row.id);
    }
  });
});
