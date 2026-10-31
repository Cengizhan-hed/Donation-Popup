/**
 * staging-snippet / staging-progress-report mantığı — ağ yok (sahte uzak).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  ROOT,
  SNIPPET_NAME,
  SNIPPET_DESC,
  REPORT_EVAL_FILE,
  SNIPPET_EVAL_FILE,
  assertStagingTarget,
  assertReadOnlyReportSource,
  buildSnippetCommand,
  parseJsonOutput,
  runSnippetOp,
  runProgressReport,
} from '../../../scripts/lib/staging-tools.mjs';
import { inspectRemoteCommand, ALLOWED_DEPLOY_TARGETS } from '../../../scripts/lib/deploy-guards.mjs';

const T = ALLOWED_DEPLOY_TARGETS.find((t) => t.id === 'staging-hedef');
const ENV = {
  DEPLOY_SSH_ALIAS: T.sshAlias,
  DEPLOY_WP_PATH: T.wpPath,
  DEPLOY_SITE_URL: T.siteUrl,
};

/** Sahte uzak: komutları kaydeder; siteurl sorgusuna doğru yanıt, eval'e verilen JSON. */
function fakeRemote(evalOut, envOverride) {
  const calls = [];
  const fn = (cmd) => {
    calls.push(cmd);
    if (cmd.startsWith('wp option get siteurl')) return (envOverride || ENV).DEPLOY_SITE_URL;
    return evalOut;
  };
  return { fn, calls };
}

describe('staging-tools: hedef kilidi', () => {
  it('yalnız staging30 kabul edilir', () => {
    assert.equal(assertStagingTarget(ENV, { id: 'staging-hedef' }).ok, true);
    assert.equal(assertStagingTarget({ ...ENV, DEPLOY_WP_PATH: '~/www/ikramaid.uk/public_html' }, undefined).ok, false);
    assert.equal(assertStagingTarget({ ...ENV, DEPLOY_SSH_ALIAS: 'ikramaid' }, undefined).ok, false);
    assert.equal(assertStagingTarget({ ...ENV, DEPLOY_SITE_URL: 'https://example.org' }, undefined).ok, false);
    assert.equal(assertStagingTarget(ENV, { id: 'ikram-aid' }).ok, false);
    // klasör kaçışı
    assert.equal(assertStagingTarget({ ...ENV, DEPLOY_WP_PATH: `${T.allowedRoot}../x` }, undefined).ok, false);
  });

  it('siteurl uyuşmazsa uzak eval çağrılmaz', () => {
    const { fn, calls } = fakeRemote('{}');
    const bad = (cmd) => (cmd.startsWith('wp option get siteurl') ? 'https://baska.example' : fn(cmd));
    assert.throws(() => runSnippetOp(ENV, 'status', { remoteFn: bad }), /eşleşmiyor/);
    assert.equal(calls.length, 0);
  });
});

describe('staging-tools: snippet komutları', () => {
  const evalB64 = Buffer.from('<?php echo 1;').toString('base64');

  it('install: yol kilitli, env anahtarları WDP_E2E_*, komut guard geçer', () => {
    const cmd = buildSnippetCommand(ENV.DEPLOY_WP_PATH, 'install', { evalB64, codeB64: Buffer.from('echo 2;').toString('base64') });
    assert.match(cmd, /WDP_E2E_SNIPPET_OP='install'/);
    assert.ok(cmd.includes(`WDP_E2E_SNIPPET_NAME='${SNIPPET_NAME}'`));
    assert.ok(cmd.includes(SNIPPET_DESC));
    assert.match(cmd, /WDP_E2E_SNIPPET_CODE_FILE="\$ENVF" wp --path=/);
    assert.equal(inspectRemoteCommand(cmd, T.allowedRoot).ok, true);
    assert.ok(cmd.includes('staging30'));
  });

  it('status/remove: kod dosyası yok', () => {
    for (const op of ['status', 'remove']) {
      const cmd = buildSnippetCommand(ENV.DEPLOY_WP_PATH, op, { evalB64 });
      assert.ok(!cmd.includes('ENVF'));
      assert.ok(cmd.includes(`WDP_E2E_SNIPPET_OP='${op}'`));
    }
    assert.throws(() => buildSnippetCommand(ENV.DEPLOY_WP_PATH, 'drop', { evalB64 }), /Geçersiz/);
    assert.throws(() => buildSnippetCommand(ENV.DEPLOY_WP_PATH, 'install', { evalB64 }), /kod gerekli/);
  });

  it('install: kaynak içeriği gerçekten komuta gömülür (gzip+b64)', () => {
    const { fn, calls } = fakeRemote('notice\n{"ok":true,"id":7}\n');
    const res = runSnippetOp(ENV, 'install', { remoteFn: fn });
    assert.equal(res.id, 7);
    const evalCmd = calls[1];
    const blobs = [...evalCmd.matchAll(/printf '%s\\n' '([A-Za-z0-9+/=]+)'/g)].map((m) => gunzipSync(Buffer.from(m[1], 'base64')).toString('utf8'));
    const src = fs.readFileSync(path.join(ROOT, 'docs/site-snippets/curcy-bridge.php'), 'utf8');
    assert.ok(blobs.some((b) => b === src), 'curcy-bridge.php içeriği gömülmedi');
    assert.ok(blobs.some((b) => b === fs.readFileSync(path.join(ROOT, SNIPPET_EVAL_FILE), 'utf8')));
  });

  it('parseJsonOutput son JSON satırını alır', () => {
    assert.deepEqual(parseJsonOutput('Warning: x\n{"a":1}\n'), { a: 1 });
    assert.throws(() => parseJsonOutput('hata'), /JSON/);
  });
});

describe('staging-tools: salt okunur rapor', () => {
  it('gerçek rapor dosyası yazma çağrısı içermez', () => {
    const src = fs.readFileSync(path.join(ROOT, REPORT_EVAL_FILE), 'utf8');
    assert.equal(assertReadOnlyReportSource(src).ok, true);
  });

  it('yazma çağrıları yakalanır', () => {
    for (const bad of ['update_option("a",1);', 'wp_delete_post(1);', '$wpdb->query("x");', '$order->save();', 'update_post_meta(1,"a",2);']) {
      assert.equal(assertReadOnlyReportSource(`<?php ${bad}`).ok, false, bad);
    }
  });

  it('yazma içeren dosya ile uzak çağrı yapılmaz', () => {
    const { fn, calls } = fakeRemote('{}');
    assert.throws(
      () => runProgressReport(ENV, { remoteFn: fn, readFile: () => Buffer.from('<?php update_option("a",1);') }),
      /yazma çağrısı/
    );
    assert.equal(calls.length, 0);
  });

  it('rapor JSON döner; komut guard geçer', () => {
    const { fn, calls } = fakeRemote('{"report":"wdp-progress-report","converted_total_base":12.5}');
    const res = runProgressReport(ENV, { remoteFn: fn });
    assert.equal(res.converted_total_base, 12.5);
    assert.equal(inspectRemoteCommand(calls[1], T.allowedRoot).ok, true);
    assert.ok(!/WDP_E2E_SNIPPET/.test(calls[1]));
  });
});
