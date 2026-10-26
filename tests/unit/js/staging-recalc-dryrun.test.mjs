/**
 * staging-recalc-dryrun mantığı: ağ yok (sahte uzak); yalnız staging-hedef; PHP yazma içermez.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ALLOWED_DEPLOY_TARGETS, inspectRemoteCommand } from '../../../scripts/lib/deploy-guards.mjs';
import { ROOT } from '../../../scripts/lib/staging-tools.mjs';
import { RECALC_EVAL_FILE, assertDryRunSource, runRecalcDryRun, toMarkdown } from '../../../scripts/lib/staging-recalc-dryrun.mjs';

const T = ALLOWED_DEPLOY_TARGETS.find((t) => t.id === 'staging-hedef');
const I = ALLOWED_DEPLOY_TARGETS.find((t) => t.id === 'ikram-aid');
const ENV = { DEPLOY_SSH_ALIAS: T.sshAlias, DEPLOY_WP_PATH: T.wpPath, DEPLOY_SITE_URL: T.siteUrl };
const PHP = fs.readFileSync(path.join(ROOT, RECALC_EVAL_FILE), 'utf8');

const OK_RESULT = {
  ok: true,
  dry_run: true,
  written: 0,
  base_currency: 'TRY',
  differs: 1,
  unconverted: 2,
  rows: [{ product_id: 7, title: 'A|B', old_total: 10, new_total: 12.5, delta: 2.5, old_donors: 1, new_donors: 2, orders: 2, unconverted: 2 }],
};

function fakeRemote(result) {
  const calls = [];
  const fn = (cmd) => {
    calls.push(cmd);
    if (cmd.startsWith('wp option get siteurl')) return ENV.DEPLOY_SITE_URL;
    return JSON.stringify(result);
  };
  return { fn, calls };
}

describe('PHP dosyası', () => {
  it('yazma çağrısı ve dry_run=false içermez; koruma var', () => {
    assert.equal(assertDryRunSource(PHP).ok, true);
    assert.match(PHP, /define\(\s*'WDP_DRY_RUN_ONLY'/);
  });
  it('yazma içeren / yazma modunu çağıran kaynak reddedilir', () => {
    assert.equal(assertDryRunSource(PHP + "\nupdate_option('a','b');").ok, false);
    assert.equal(assertDryRunSource(PHP + '\n$calc->run( $ids, false );').ok, false);
    assert.equal(assertDryRunSource(PHP + '\n\\WDP_Utils::recalculate_product_donation_totals( $ids, false );').ok, false);
    assert.equal(assertDryRunSource(PHP.replace(/WDP_DRY_RUN_ONLY/g, 'X')).ok, false);
  });
});

describe('ortam koruması', () => {
  it('Ikram ve canlı reddedilir; uzak komut hiç gönderilmez', () => {
    const r = fakeRemote(OK_RESULT);
    const ikram = { DEPLOY_SSH_ALIAS: I.sshAlias, DEPLOY_WP_PATH: I.wpPath, DEPLOY_SITE_URL: I.siteUrl };
    assert.throws(() => runRecalcDryRun(ikram, { remoteFn: r.fn }));
    const live = { ...ENV, DEPLOY_SITE_URL: 'https://hedefdernegi.org' }; // live-scan:blacklist-def
    assert.throws(() => runRecalcDryRun(live, { remoteFn: r.fn }));
    const livePath = { ...ENV, DEPLOY_WP_PATH: '~/www/hedefdernegi.org/public_html' }; // live-scan:blacklist-def
    assert.throws(() => runRecalcDryRun(livePath, { remoteFn: r.fn }));
    assert.equal(r.calls.length, 0);
  });
  it('staging-hedef: komut uzak korumadan geçer, sonuç döner', () => {
    const r = fakeRemote(OK_RESULT);
    const res = runRecalcDryRun(ENV, { remoteFn: r.fn });
    assert.equal(res.written, 0);
    const evalCmd = r.calls.find((c) => !c.startsWith('wp option get siteurl'));
    assert.equal(inspectRemoteCommand(evalCmd, { wpPath: T.wpPath }).ok !== false, true);
  });
  it('yazma bildiren ya da hatalı sonuç reddedilir', () => {
    assert.throws(() => runRecalcDryRun(ENV, { remoteFn: fakeRemote({ ...OK_RESULT, written: 1 }).fn }), /yazma/);
    assert.throws(() => runRecalcDryRun(ENV, { remoteFn: fakeRemote({ ok: false, error: 'x' }).fn }), /recalc-dryrun/);
  });
  it('yazma içeren PHP ile uzak komut hiç gitmez', () => {
    const r = fakeRemote(OK_RESULT);
    const readFile = () => Buffer.from(`${PHP}\nupdate_post_meta(1,'a','b');`);
    assert.throws(() => runRecalcDryRun(ENV, { remoteFn: r.fn, readFile }), /yazma/i);
    assert.equal(r.calls.length, 0);
  });
});

describe('Markdown', () => {
  it('tablo üretir, uyarı ve | kaçışı', () => {
    const md = toMarkdown(OK_RESULT);
    assert.match(md, /\| 7 \| A\/B \| 10 \| 12.5 \| 2.5 \| 1 \/ 2 \| 2 \| kur bulunamadı \(2\) \|/);
  });
});
