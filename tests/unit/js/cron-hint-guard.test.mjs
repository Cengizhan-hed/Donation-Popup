/**
 * cron-status crontab ipucu: guard yalnız TAM sabit dizgeyi WP-CLI --path kuralından muaf tutar. Ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRemoteTarget,
  CRON_CRONTAB_HINT_COMMAND,
  isCronCrontabHintCommand,
} from '../../../scripts/lib/deploy-guards.mjs';
import { CRON_CRONTAB_HINT_COMMAND as FROM_IKRAM } from '../../../scripts/lib/ikram-wp-guard.mjs';

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
const ENVS = [STAGING, IKRAM];
const H = CRON_CRONTAB_HINT_COMMAND;

describe('cron crontab ipucu istisnasi (tam sabit dizge)', () => {
  it('ikram-wp-guard ayni sabiti dışa açar', () => {
    assert.equal(FROM_IKRAM, H);
  });

  it('tam komut her iki izinli ortamda gecer', () => {
    for (const e of ENVS) {
      assert.equal(checkRemoteTarget({ ...e, remoteCommand: H }).ok, true);
    }
  });

  it('varyasyonlar reddedilir', () => {
    const variants = [
      `${H}; wp plugin list`,
      `${H} && wp plugin list`,
      `${H} | wp plugin list`,
      ` ${H}`,
      `${H} `,
      `${H}\nwp plugin list`,
      H.replace('wp-cron\\.php|wp cron event run', 'x|wp cron event run'),
      H.replace('grep -qE', 'grep -E'),
      `wp cron event run --all`,
      `crontab -l | wp cron event run`,
    ];
    for (const e of ENVS) {
      for (const v of variants) {
        assert.equal(checkRemoteTarget({ ...e, remoteCommand: v }).ok, false, v);
      }
    }
  });

  it('isCronCrontabHintCommand yalniz tam eslesme', () => {
    assert.equal(isCronCrontabHintCommand(H), true);
    assert.equal(isCronCrontabHintCommand(`${H};`), false);
    assert.equal(isCronCrontabHintCommand(''), false);
    assert.equal(isCronCrontabHintCommand(undefined), false);
  });

  it('istisna diger kurallari gevsetmez', () => {
    assert.equal(checkRemoteTarget({ alias: 'hedefdernegi', remoteCommand: H }).ok, false);
    assert.equal(checkRemoteTarget({ alias: 'baska', remoteCommand: H }).ok, false);
    assert.equal(checkRemoteTarget({ ...STAGING, wpPath: IKRAM.wpPath, remoteCommand: H }).ok, false);
  });
});
