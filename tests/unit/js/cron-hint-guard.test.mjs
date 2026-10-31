/**
 * Eski crontab ipucu istisnasi KALDIRILDI: tam eski komut dizesi de reddedilir. Ag yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as guards from '../../../scripts/lib/deploy-guards.mjs';
import * as ikramGuard from '../../../scripts/lib/ikram-wp-guard.mjs';

const { checkRemoteTarget } = guards;
const STAGING = {
  alias: 'hedef-staging',
  wpPath: '~/www/staging30.hedefdernegi.org/public_html',
  siteUrl: 'https://staging30.hedefdernegi.org',
};
const IKRAM = {
  alias: 'ikramaid',
  wpPath: '~/www/ikramaid.uk/public_html',
  siteUrl: 'https://ikramaid.uk',
};
// Eski sabit komutun birebir metni (artik hicbir yerde tanimli degil).
const OLD =
  "if crontab -l 2>/dev/null | grep -qE 'wp-cron\\.php|wp cron event run'; then echo crontab_wp_cron=yes; else echo crontab_wp_cron=no; fi";

describe('cron crontab ipucu istisnasi kaldirildi', () => {
  it('sabit ve yardimci disa acilmaz', () => {
    assert.equal('CRON_CRONTAB_HINT_COMMAND' in guards, false);
    assert.equal('isCronCrontabHintCommand' in guards, false);
    assert.equal('CRON_CRONTAB_HINT_COMMAND' in ikramGuard, false);
  });

  it('tam eski komut iki ortamda da reddedilir', () => {
    for (const e of [STAGING, IKRAM]) {
      assert.equal(checkRemoteTarget({ ...e, remoteCommand: OLD }).ok, false);
    }
  });
});
