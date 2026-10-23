import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setActiveProfile } from '../../../tests/e2e/helpers/profile.mjs';
import { usesLocalWpMeta, getProductMeta } from '../../../tests/e2e/helpers/staging-wp-meta.mjs';
import { CART_READY_SEL } from '../../../tests/e2e/helpers/checks.mjs';
import { skipLocalOnlyOnRemote } from '../../../tests/e2e/helpers/mutation-policy.mjs';
import { loopProductSlug } from '../../../tests/e2e/helpers/catalog-core.mjs';

describe('yerel e2e:full altyapı (3K)', () => {
  it('usesLocalWpMeta: local evet, uzak hayır', () => {
    setActiveProfile({ id: 'local', allowedHosts: ['127.0.0.1'] });
    assert.equal(usesLocalWpMeta(), true);
    setActiveProfile({ id: 'staging-hedef', ssh: { alias: 'hedef-staging' } });
    assert.equal(usesLocalWpMeta(), false);
    setActiveProfile(null);
  });

  it('yerel getProductMeta SSH denemez (WDP_LOCAL_WP_DIR yok)', async () => {
    setActiveProfile({ id: 'local', allowedHosts: ['127.0.0.1'] });
    const prev = process.env.WDP_LOCAL_WP_DIR;
    delete process.env.WDP_LOCAL_WP_DIR;
    try {
      await assert.rejects(() => getProductMeta(15, '_price'), /WDP_LOCAL_WP_DIR yok/);
    } finally {
      if (prev !== undefined) process.env.WDP_LOCAL_WP_DIR = prev;
      setActiveProfile(null);
    }
  });

  it('CART_READY_SEL gizli wp-block-woocommerce-cart sarmalayıcısını beklemez', () => {
    assert.match(CART_READY_SEL, /woocommerce-cart-form/);
    assert.match(CART_READY_SEL, /wc-block-cart-items|empty-cart/);
    assert.match(CART_READY_SEL, /wp-block-woocommerce-cart:not\(\[hidden\]\)/);
    assert.doesNotMatch(CART_READY_SEL, /(^|,\s*)\.wp-block-woocommerce-cart(,|$)/);
  });

  it('loopProductSlug tam URL değil path slug döner', () => {
    assert.equal(
      loopProductSlug(
        { slug: 'wdp-e2e-custom', id: 15 },
        'http://127.0.0.1:8899/product/wdp-e2e-custom/'
      ),
      'wdp-e2e-custom'
    );
    assert.equal(
      loopProductSlug({ slug: '', path: '/product/wdp-e2e-fixed/' }, ''),
      'wdp-e2e-fixed'
    );
  });

  it('yerel eval extra env WDP_LOCAL_WP_DIR birleştirir (SSH yok)', async () => {
    const { runLocalEvalFile } = await import('../../../tests/e2e/helpers/local-wp-eval.mjs');
    const prev = process.env.WDP_LOCAL_WP_DIR;
    delete process.env.WDP_LOCAL_WP_DIR;
    try {
      assert.throws(() => runLocalEvalFile('tests/local-wp/matrix-ops.php', ['probe']), /WDP_LOCAL_WP_DIR yok/);
    } finally {
      if (prev !== undefined) process.env.WDP_LOCAL_WP_DIR = prev;
    }
  });

  it('shortcodes-setup yerelde atlanmaz', () => {
    const skips = [];
    const stats = { skipped: 0 };
    assert.equal(
      skipLocalOnlyOnRemote({ _profile: { id: 'local' } }, 'shortcodes-setup', skips, stats),
      false
    );
    assert.equal(stats.skipped, 0);
  });
});
