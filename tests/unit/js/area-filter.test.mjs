import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathMatches, areasForFiles } from '../../../tests/e2e/helpers/area-filter.mjs';

const map = {
  unmappedFallback: ['core', 'shell'],
  paths: [
    { match: 'assets/js/src/form/pricing.js', areas: ['amount-options'] },
    { match: 'includes/class-cart.php', areas: ['checkout-flow'] },
  ],
};

describe('area-filter', () => {
  it('pathMatches prefix and exact', () => {
    assert.equal(pathMatches('includes/class-cart.php', 'includes/class-cart.php'), true);
    assert.equal(pathMatches('includes/class-cart.php', 'includes/'), true);
    assert.equal(pathMatches('assets/js/src/form/pricing.js', 'includes/'), false);
  });

  it('maps known files to areas', () => {
    const r = areasForFiles(['assets/js/src/form/pricing.js'], map);
    assert.deepEqual(r.areas, ['amount-options']);
    assert.equal(r.unmatched.length, 0);
  });

  it('unmapped files add fallback (safe wider set)', () => {
    const r = areasForFiles(['woo-donation-popup.php'], map);
    assert.ok(r.areas.includes('core'));
    assert.ok(r.areas.includes('shell'));
    assert.deepEqual(r.unmatched, ['woo-donation-popup.php']);
  });

  it('ignores docs and CLAUDE.md', () => {
    const r = areasForFiles(['docs/MIMARI.md', 'CLAUDE.md'], map);
    assert.deepEqual(r.areas, []);
    assert.deepEqual(r.unmatched, []);
  });

  it('ignores gitignore and env examples', () => {
    const r = areasForFiles(['.gitignore', '.env.e2e.ikram.example'], map);
    assert.deepEqual(r.areas, []);
    assert.deepEqual(r.unmatched, []);
  });
});
