/**
 * Canlı hedef taraması — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scanText,
  scanLiveTargets,
  leftoverHedefMentions,
  leftoverWwwPaths,
} from '../../../scripts/lib/live-target-scan.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import {
  loadProfile,
  assertRemoteProfileSafe,
  isRemoteProfile,
} from '../../../tests/e2e/helpers/profile.mjs';

describe('live-target-scan', () => {
  it('örnek ihlal dosyasını yakalar', () => {
    const sample = [
      'const live = "https://hedefdernegi.org";', // live-scan:allow-reject-test
      'rsync src ~/www/hedefdernegi.org/public_html', // live-scan:allow-reject-test
    ].join('\n');
    const unmarked = 'const live = "https://hedefdernegi.org";\npath = "~/www/hedefdernegi.org/x";\n'; // live-scan:allow-reject-test
    const hits = scanText('tmp-sample.mjs', unmarked);
    assert.ok(hits.length >= 2, JSON.stringify(hits));
    assert.ok(hits.some((h) => h.reason.includes('staging30 dışında')));
    assert.ok(hits.some((h) => h.reason.includes('~/www/')));
    void sample;
  });

  it('staging30 ve izinli kök geçer', () => {
    const ok = scanText(
      'ok.mjs',
      'const u = "https://staging30.hedefdernegi.org";\nconst p = "~/www/staging30.hedefdernegi.org/public_html";\n'
    );
    assert.deepEqual(ok, []);
  });

  it('işaretli reddetme satırı taramadan düşer', () => {
    const line = 'https://hedefdernegi.org // live-scan:allow-reject-test';
    assert.deepEqual(scanText('t.mjs', line), []);
  });

  it('leftover yardımcıları', () => {
    assert.ok(leftoverHedefMentions('https://www.hedefdernegi.org').length); // live-scan:allow-reject-test
    assert.equal(leftoverHedefMentions('https://staging30.hedefdernegi.org').length, 0);
    assert.ok(leftoverWwwPaths('~/www/hedefdernegi.org/staging').length); // live-scan:allow-reject-test
    assert.equal(leftoverWwwPaths('~/www/ikramaid.uk/public_html').length, 0);
  });

  it('mevcut repo taraması (verify ile aynı kural)', () => {
    const hits = scanLiveTargets(ROOT);
    assert.deepEqual(
      hits,
      [],
      hits.map((h) => `${h.file}:${h.line} ${h.reason}`).join('\n')
    );
  });
});

describe('e2e profiller', () => {
  it('staging-hedef staging30 + mutasyon kapalı + ssh üçlüsü', () => {
    const p = loadProfile('staging-hedef');
    assert.equal(p.baseUrl, 'https://staging30.hedefdernegi.org');
    assert.equal(p.allowMetaMutation, false);
    assert.equal(p.ssh.alias, 'hedef-staging');
    assert.equal(p.ssh.wpPath, '~/www/staging30.hedefdernegi.org/public_html');
    assert.equal(p.wpCliAuth, true);
    assert.deepEqual(p.protectedProductIds, []);
    assert.equal(p.altDonationProductId, 0);
    assert.equal(p.products.custom.role, 'custom');
    assert.equal(p.products.custom.id, undefined);
    assert.equal(p.products.custom.name, undefined);
    assert.deepEqual(p.remoteReadOnlyPostActions, [
      'wmc_get_products_price',
      'hdf_side_cart_v8_get',
      'fusion_get_webfonts_ajax',
    ]);
    assert.equal(p.currencySwitch.param, 'wmc-currency');
    assertRemoteProfileSafe(p);
  });

  it('ikram-aid ssh + mutasyon kapalı', () => {
    const p = loadProfile('ikram-aid');
    assert.equal(p.allowMetaMutation, false);
    assert.equal(p.ssh.alias, 'ikramaid');
    assert.equal(p.ssh.wpPath, '~/www/ikramaid.uk/public_html');
    assert.equal(p.products.custom.name, undefined);
    assert.equal(p.listPageId, undefined);
    assert.equal(p.currencySwitch, undefined);
    assertRemoteProfileSafe(p);
  });

  it('uzak profilde allowMetaMutation=true reddedilir', () => {
    assert.throws(
      () =>
        assertRemoteProfileSafe({
          id: 'staging-hedef',
          allowMetaMutation: true,
          baseUrl: 'https://staging30.hedefdernegi.org',
          ssh: { alias: 'hedef-staging', wpPath: '~/www/staging30.hedefdernegi.org/public_html' },
        }),
      /allowMetaMutation/
    );
  });

  it('yerel profil uzak değildir', () => {
    const p = loadProfile('local');
    assert.equal(isRemoteProfile(p), false);
    assert.equal(p.allowMetaMutation, true);
  });
});
