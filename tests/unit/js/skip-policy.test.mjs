/**
 * Atlama politikası: yalnız enum kod + wp-data|policy; DOM / bilinmeyen → hata.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKIP_REASONS,
  SKIP_EVIDENCE,
  makeSkip,
  classifySkip,
  classifySkipReason,
  promoteIllegalSkips,
} from '../../../tests/e2e/helpers/skip-policy.mjs';

describe('classifySkip', () => {
  it('liste sayfası yok (wp-data) → atlama', () => {
    const rec = makeSkip({
      check: 'list-page',
      reason: SKIP_REASONS.NO_LIST_PAGE,
      evidence: SKIP_EVIDENCE.WP_DATA,
    });
    assert.equal(rec.reason, 'no-list-page');
    assert.equal(rec.evidence, 'wp-data');
    assert.equal(classifySkip(rec), 'skip');
    assert.equal(classifySkipReason(rec), 'skip');
  });

  it('enum dışı kod → hata', () => {
    assert.equal(
      classifySkip({ reason: 'popup-tetikleyici', evidence: SKIP_EVIDENCE.WP_DATA }),
      'fail'
    );
    assert.equal(classifySkip({ reason: 'skip-desktop', evidence: SKIP_EVIDENCE.POLICY }), 'fail');
    assert.equal(classifySkipReason('Sipariş tamamlama atlandı (checkout-view-only)'), 'fail');
    assert.equal(classifySkipReason(''), 'fail');
    assert.equal(classifySkip(null), 'fail');
  });

  it('evidence dom → hata', () => {
    assert.equal(
      classifySkip({
        reason: SKIP_REASONS.NO_RELATED_PRODUCTS,
        evidence: 'dom',
      }),
      'fail'
    );
  });

  it('css-source + tema yolu → atlama', () => {
    const rec = makeSkip({
      check: 'theme-hides-related',
      reason: SKIP_REASONS.THEME_HIDES_RELATED,
      evidence: SKIP_EVIDENCE.CSS_SOURCE,
      source: '/wp-content/themes/blocksy/static/bundle/main.min.css',
      detail: 'sel=.ct-hidden-sm',
    });
    assert.equal(rec.reason, 'theme-hides-related');
    assert.equal(rec.evidence, 'css-source');
    assert.equal(rec.source, '/wp-content/themes/blocksy/static/bundle/main.min.css');
    assert.equal(classifySkip(rec), 'skip');
  });

  it('css-source + eklenti yolu → hata', () => {
    assert.equal(
      classifySkip(
        makeSkip({
          reason: SKIP_REASONS.THEME_HIDES_RELATED,
          evidence: SKIP_EVIDENCE.CSS_SOURCE,
          source: '/wp-content/plugins/woo-donation-popup/assets/css/frontend.css',
        })
      ),
      'fail'
    );
    assert.equal(
      classifySkip({
        reason: SKIP_REASONS.THEME_HIDES_RELATED,
        evidence: SKIP_EVIDENCE.CSS_SOURCE,
        source: '/wp-content/plugins/woo-donation-popup/#wdp-hide-native-cart',
      }),
      'fail'
    );
    assert.equal(
      classifySkip({
        reason: SKIP_REASONS.THEME_HIDES_RELATED,
        evidence: SKIP_EVIDENCE.CSS_SOURCE,
        source: 'inline',
      }),
      'fail'
    );
    assert.equal(
      classifySkip({
        reason: SKIP_REASONS.THEME_HIDES_RELATED,
        evidence: SKIP_EVIDENCE.CSS_SOURCE,
      }),
      'fail'
    );
  });

  it('theme-hides-related wp-data veya yanlış reason → hata', () => {
    assert.equal(
      classifySkip({
        reason: SKIP_REASONS.THEME_HIDES_RELATED,
        evidence: SKIP_EVIDENCE.WP_DATA,
        source: '/wp-content/themes/blocksy/static/bundle/main.min.css',
      }),
      'fail'
    );
    assert.equal(
      classifySkip({
        reason: SKIP_REASONS.NO_RELATED_PRODUCTS,
        evidence: SKIP_EVIDENCE.CSS_SOURCE,
        source: '/wp-content/themes/blocksy/static/bundle/main.min.css',
      }),
      'fail'
    );
  });

  it('politika atlamaları geçer', () => {
    assert.equal(
      classifySkip(
        makeSkip({
          reason: SKIP_REASONS.NO_REMOTE_ORDERS,
          evidence: SKIP_EVIDENCE.POLICY,
        })
      ),
      'skip'
    );
    assert.equal(
      classifySkip(
        makeSkip({
          reason: SKIP_REASONS.LOCAL_ONLY,
          evidence: SKIP_EVIDENCE.POLICY,
          detail: 'kısa kod liste sayfası',
        })
      ),
      'skip'
    );
    assert.equal(
      classifySkip(
        makeSkip({
          reason: SKIP_REASONS.SETTING_OFF,
          evidence: SKIP_EVIDENCE.WP_DATA,
        })
      ),
      'skip'
    );
  });
});

describe('promoteIllegalSkips', () => {
  it('yapılandırılmamış / altyapı atlamasını failures listesine taşır', () => {
    const skips = [
      { check: 'addon-fixed-popup', description: 'Atlandı — ürün düzenleme sayfası açılamadı (#13)' },
      makeSkip({
        check: 'ok',
        reason: SKIP_REASONS.LOCAL_ONLY,
        evidence: SKIP_EVIDENCE.POLICY,
        detail: 'kısa kod liste sayfası',
      }),
      {
        check: 'loop-cards-product',
        reason: SKIP_REASONS.NO_RELATED_PRODUCTS,
        evidence: 'dom',
        description: 'Benzer Bağışlar kartı yok',
      },
    ];
    const failures = [];
    const stats = { skipped: 3, failed: 0 };
    const n = promoteIllegalSkips({
      skips,
      failures,
      stats,
      makeFailure: (row) => row,
    });
    assert.equal(n, 2);
    assert.equal(skips.length, 1);
    assert.equal(skips[0].check, 'ok');
    assert.equal(skips[0].reason, SKIP_REASONS.LOCAL_ONLY);
    assert.equal(failures.length, 2);
    assert.match(failures[0].description, /Altyapı atlaması hata/);
    assert.equal(stats.skipped, 1);
    assert.equal(stats.failed, 2);
  });

  it('tema css-source atlama kalır, eklenti yolu yükselir', () => {
    const skips = [
      makeSkip({
        check: 'theme-hides-related',
        reason: SKIP_REASONS.THEME_HIDES_RELATED,
        evidence: SKIP_EVIDENCE.CSS_SOURCE,
        source: '/wp-content/themes/blocksy/static/bundle/main.min.css',
      }),
      makeSkip({
        check: 'plugin-hides-related',
        reason: SKIP_REASONS.THEME_HIDES_RELATED,
        evidence: SKIP_EVIDENCE.CSS_SOURCE,
        source: '/wp-content/plugins/woo-donation-popup/assets/css/wdp.css',
      }),
    ];
    const failures = [];
    const stats = { skipped: 2, failed: 0 };
    const n = promoteIllegalSkips({
      skips,
      failures,
      stats,
      makeFailure: (row) => row,
    });
    assert.equal(n, 1);
    assert.equal(skips.length, 1);
    assert.equal(skips[0].check, 'theme-hides-related');
    assert.equal(failures.length, 1);
    assert.equal(stats.skipped, 1);
    assert.equal(stats.failed, 1);
  });

  it('liste sayfası yok (wp-data) atlama kalır', () => {
    const skips = [
      makeSkip({
        check: 'list-page',
        reason: SKIP_REASONS.NO_LIST_PAGE,
        evidence: SKIP_EVIDENCE.WP_DATA,
      }),
    ];
    const failures = [];
    const stats = { skipped: 1, failed: 0 };
    const n = promoteIllegalSkips({
      skips,
      failures,
      stats,
      makeFailure: (row) => row,
    });
    assert.equal(n, 0);
    assert.equal(skips.length, 1);
    assert.equal(failures.length, 0);
    assert.equal(stats.skipped, 1);
    assert.equal(stats.failed, 0);
  });
});
