/**
 * Uzak keşif: yazma yok, eval temiz, çıktı sızıntısız, REMOTE-BLOCKED.
 * Ağ yok; sahte ssh spawn.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  BLOCKED_ACTIVE_SLUGS,
  CRON_ORPHAN,
  DISCOVER_STEPS,
  EVAL_STATIC_OUTBOUND,
  EVAL_WOO,
  STATIC_SCAN_HOOKS,
  WRITE_PHP_RE,
  WRITE_TAIL_RE,
  assembleReport,
  blockedActivePlugins,
  blockedExitCode,
  buildRemoteWpCommand,
  canonicalEnv,
  classifyPlugin,
  classifyWooPageKind,
  compactPhp,
  detectOutboundCalls,
  extractOutboundHosts,
  getDiscoverWpTails,
  getEvalSnippets,
  parseJsonBlob,
  renderMarkdown,
  runGuardedSsh,
  sanitizeDiscoveryOutput,
  tailsForWriteScan,
} from '../../../scripts/lib/remote-discover-lib.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import { createRemoteRunner, runDiscover } from '../../../scripts/remote-discover.mjs';

const FAKE_SNIPPET_27 = `
add_action("woocommerce_add_to_cart", "hedef_check_abandoned_cart_event");
add_action("woocommerce_add_cart_item_data", "hedef_check_abandoned_cart_event");
function hedef_check_abandoned_cart_event() {
  wp_remote_post("https://api.ornek.com/v1/secret-path?token=1", array(
    "headers" => array("Authorization" => "Bearer abc"),
    "body" => array("key" => "XYZ"),
  ));
  wp_remote_get($endpoint);
  wp_safe_remote_request(API_BASE);
  file_get_contents(get_option("cart_webhook_url"));
  fsockopen("events.ornek.net", 443);
  curl_init("https://hooks.ornek.io/abc/secret");
}
`;

function assertHostLeakFree(blob) {
  const t = String(blob);
  assert.equal(t.includes('secret-path'), false, 'yol sızdı');
  assert.equal(t.includes('token=1'), false, 'sorgu sızdı');
  assert.equal(/Bearer\s+abc/i.test(t), false, 'Authorization değeri sızdı');
  assert.equal(t.includes('?key=XYZ'), false, 'sorgu anahtarı sızdı');
  assert.equal(t.includes('/v1/'), false, 'yol sızdı');
  assert.equal(t.includes('https://api.ornek.com'), false, 'tam URL sızdı');
}

describe('remote-discover komut listesi', () => {
  it('komut listesinde yazma yok', () => {
    const tails = getDiscoverWpTails();
    assert.ok(tails.length >= 8);
    const scanned = tailsForWriteScan(tails);
    for (const t of scanned) {
      assert.doesNotMatch(t, WRITE_TAIL_RE, t);
      assert.doesNotMatch(t, /\boption\s+(update|delete|add|set)\b/i, t);
      assert.doesNotMatch(t, /\bpost\s+(create|update|delete)\b/i, t);
      assert.doesNotMatch(t, /(?:^|\s)user(?:\s|$)/i, t);
      assert.doesNotMatch(t, /\bdb\s+query\b/i, t);
      assert.doesNotMatch(t, /\bplugin\s+(activate|deactivate|install|delete)\b/i, t);
    }
    for (const step of DISCOVER_STEPS) {
      assert.ok(step.kind === 'eval' || step.kind === 'eval-file', step.id);
    }
  });

  it('eval dizgilerinde yazma fonksiyonu yok ve tek tırnak yok', () => {
    const snippets = getEvalSnippets();
    assert.ok(snippets.length >= 6);
    for (const php of snippets) {
      assert.equal(php.includes("'"), false, 'eval tek tırnak içeremez');
      assert.doesNotMatch(php, WRITE_PHP_RE);
      assert.doesNotMatch(php, /do_action|apply_filters|wp_schedule|spawn_cron/);
      assert.doesNotMatch(compactPhp(php), WRITE_PHP_RE);
    }
  });

  it('uzak wp komutunda --path var, skip-themes yok', () => {
    for (const tail of getDiscoverWpTails()) {
      const cmd = buildRemoteWpCommand('~/www/staging30.hedefdernegi.org/public_html', tail);
      assert.match(cmd, /--path=/);
      assert.doesNotMatch(cmd, /--skip-themes/);
      assert.doesNotMatch(cmd, /--skip-plugins/);
      assert.match(cmd, /^wp /);
    }
  });
});

describe('remote-discover çıktı temizleyici', () => {
  it('sahte veride e-posta/URL/anahtar rapora sızmıyor', () => {
    const dirty = {
      contact: 'admin@example.com',
      site: 'https://staging.example.org/path?foo=secret',
      key: 'sk_live_1234567890abcdefXYZ',
      note: 'token=abc123&password=hunter2',
      woo: { currency: 'TRY', price_thousand_sep: '.', price_num_decimals: '2' },
      nested: { mail: 'donor.name@charity.org' },
    };
    const clean = sanitizeDiscoveryOutput(dirty);
    const json = JSON.stringify(clean);
    assert.equal(json.includes('admin@example.com'), false);
    assert.equal(json.includes('donor.name@charity.org'), false);
    assert.equal(/https?:\/\//.test(json), false);
    assert.equal(json.includes('sk_live_'), false);
    assert.equal(json.includes('staging.example.org'), false);
    assert.equal(json.includes('foo=secret'), false);
    assert.equal(clean.woo.currency, 'TRY');
    assert.equal(clean.woo.price_thousand_sep, '.');
    assert.equal(clean.woo.price_num_decimals, '2');
    assert.match(clean.contact, /redacted-email/);
    assert.match(clean.site, /redacted-url/);
  });
});

describe('remote-discover REMOTE-BLOCKED', () => {
  it('google-site-kit aktif → çıkış 3', () => {
    const plugins = [
      { slug: 'woocommerce', status: 'active', version: '8.0' },
      { slug: 'google-site-kit', status: 'active', version: '1.2.3' },
    ];
    assert.deepEqual(blockedActivePlugins(plugins), ['google-site-kit']);
    assert.equal(blockedExitCode(plugins), 3);
  });

  it('yok veya pasif → çıkış 0', () => {
    assert.equal(blockedExitCode([]), 0);
    assert.equal(
      blockedExitCode([{ slug: 'google-site-kit', status: 'inactive' }]),
      0
    );
    assert.equal(
      blockedExitCode([{ slug: 'facebook-for-woocommerce', status: 'must-use' }]),
      0
    );
    for (const slug of BLOCKED_ACTIVE_SLUGS) {
      assert.equal(blockedExitCode([{ slug, status: 'active' }]), 3);
    }
  });
});

describe('remote-discover sahte ssh', () => {
  it('bağlantı hatasında en fazla 1 tekrar', () => {
    let n = 0;
    const fake = () => {
      n += 1;
      if (n === 1) return { status: 255, stderr: 'Connection timed out', stdout: '' };
      return { status: 0, stdout: 'ok', stderr: '' };
    };
    const res = runGuardedSsh(fake, 'ikramaid', 'wp core version --path=/tmp', {}, { siteUrl: 'https://ikramaid.uk', wpPath: '~/www/ikramaid.uk/public_html' });
    assert.equal(n, 2);
    assert.equal(res.stdout, 'ok');
  });

  it('WP hatasında tekrar denemez', () => {
    let n = 0;
    const fake = () => {
      n += 1;
      return { status: 1, stderr: 'Error: WooCommerce yok', stdout: '' };
    };
    assert.throws(() => runGuardedSsh(fake, 'ikramaid', 'wp eval "echo 1;" --path=/x', {}, {}), /ssh başarısız \(çıkış 1\)/);
    assert.equal(n, 1);
  });

  it('stdout boşsa stderr 300 + çıkış kodu (e-posta/URL/anahtar yok)', () => {
    const fake = () => ({
      status: 0,
      stdout: '',
      stderr: 'admin@example.com https://staging.example.org/secret sk_live_abc123XYZ token=hunter2',
    });
    assert.throws(
      () =>
        runGuardedSsh(
          fake,
          'ikramaid',
          'wp eval "echo 1;" --path=/x',
          {},
          { requireStdout: true, siteUrl: 'https://ikramaid.uk', wpPath: '~/www/ikramaid.uk/public_html' }
        ),
      (err) => {
        const msg = String(err && err.message ? err.message : err);
        assert.match(msg, /ssh başarısız \(çıkış 0\)/);
        assert.match(msg, /redacted-email/);
        assert.match(msg, /redacted-url/);
        assert.match(msg, /redacted-key/);
        assert.equal(msg.includes('admin@example.com'), false);
        assert.equal(/https?:\/\//.test(msg), false);
        assert.equal(msg.includes('sk_live_'), false);
        assert.equal(msg.includes('hunter2'), false);
        return true;
      }
    );
  });

  it('tüm uzak adımlar ssh + --path, skip-themes yok', () => {
    const calls = [];
    const payload = JSON.stringify({
      php: '8.2',
      wp: '6.7',
      wc: '',
      theme: 'blocksy',
      parent_theme: 'blocksy',
      locale: 'en_GB',
      wplang: '',
      multisite: 0,
      plugins: [{ slug: 'woocommerce', status: 'active', version: '8.0' }],
      hooks: {},
      gateways: [],
      mail: { active: 0, plugin: '', mailer: '' },
      webhooks: { total: 0, by_status: {}, by_topic: {} },
      cron: {},
      orders: 0,
      products: 0,
      users: 1,
      pages: 1,
      wdp_version: '',
      wdp_option_count: 0,
      posts: [],
      options: {},
      user_count: 1,
      attachment_count: 0,
      page_count: 1,
      product_count: 0,
    });
    const fake = (bin, args) => {
      calls.push({ bin, args });
      const remote = String(args[args.length - 1] || '');
      if (remote.startsWith('echo ')) {
        return { status: 0, stdout: '/home/u/www/ikramaid.uk/public_html', stderr: '' };
      }
      return { status: 0, stdout: payload, stderr: '' };
    };
    const runner = createRemoteRunner({
      spawn: fake,
      alias: 'ikramaid',
      wpPath: '~/www/ikramaid.uk/public_html',
      siteUrl: 'https://ikramaid.uk',
    });
    const { report, exitCode } = runDiscover({ envName: 'ikram', runner, writeFiles: false });
    assert.equal(exitCode, 0);
    assert.equal(report.env, 'ikram');
    assert.ok(calls.length >= 8);
    assert.equal(
      calls.every((c) => c.bin === 'ssh'),
      true
    );
    const wpCalls = calls.filter((c) => /\bwp\s/.test(String(c.args[c.args.length - 1] || '')));
    assert.ok(wpCalls.length >= 7);
    for (const c of wpCalls) {
      const remote = String(c.args[c.args.length - 1] || '');
      assert.match(remote, /--path=/);
      assert.doesNotMatch(remote, /--skip-themes|--skip-plugins/);
    }
  });

  it('ödeme/sepet türü: block / classic / classic-in-builder / unknown', () => {
    assert.equal(classifyWooPageKind({ hasBlock: true }), 'block');
    assert.equal(classifyWooPageKind({ hasShortcode: true }), 'classic');
    assert.equal(
      classifyWooPageKind({ contentHasShortNeedle: true, builder: true }),
      'classic-in-builder'
    );
    assert.equal(classifyWooPageKind({ hasShortcode: true, builder: true }), 'classic-in-builder');
    assert.equal(classifyWooPageKind({ blockDefault: true }), 'block');
    assert.equal(classifyWooPageKind({}), 'unknown');
    const php = EVAL_WOO;
    assert.match(php, /has_block/);
    assert.match(php, /has_shortcode/);
    assert.match(php, /is_checkout_block_default/);
    assert.match(php, /is_cart_block_default/);
    assert.match(php, /classic-in-builder/);
    assert.doesNotMatch(php, /echo \$c\b/);
    assert.doesNotMatch(php, /"content"\s*=>/);
    assert.equal(php.includes("'"), false);
  });

  it('canonical env ve json blob', () => {
    assert.equal(canonicalEnv('hedef'), 'staging');
    assert.equal(canonicalEnv('ikram-aid'), 'ikram');
    assert.deepEqual(parseJsonBlob('Notice: x\n{"a":1}\n'), { a: 1 });
    assert.equal(classifyPlugin('google-site-kit'), 'measurement');
    assert.equal(classifyPlugin('hello-dolly'), 'unclassified');
  });
});

describe('remote-discover giden veri statik denetimi', () => {
  it('sahte kaynaklarda çağrı türleri tespit edilir', () => {
    const src = `
      wp_remote_get($u);
      wp_safe_remote_post($u);
      $h = new WP_Http();
      curl_init();
      fsockopen($host, 80);
      stream_socket_client($tcp);
      file_get_contents('http://example.test/x');
      file_get_contents("https://example.test/y");
      wp_mail($to, $s, $b);
      WC()->mailer();
      $mailer->send($email);
    `;
    const c = detectOutboundCalls(src);
    assert.equal(c['wp_remote_*'], 1);
    assert.equal(c['wp_safe_remote_*'], 1);
    assert.equal(c.WP_Http, 1);
    assert.equal(c['curl_*'], 1);
    assert.equal(c.fsockopen, 1);
    assert.equal(c.stream_socket_client, 1);
    assert.equal(c.file_get_contents_http, 2);
    assert.equal(c.wp_mail, 1);
    assert.equal(c.WC_mailer, 1);
    assert.equal(c.send, 1);
  });

  it('snippet kodu ve adı rapora sızmıyor', () => {
    const report = assembleReport({
      envName: 'local',
      profileId: 't',
      stepData: {
        plugins: { plugins: [{ slug: 'code-snippets', status: 'active', version: '3' }] },
        static_outbound: {
          snippets: [
            {
              id: 42,
              name: 'LEAK_NAME_XYZ',
              code: 'add_action("init", "x"); wp_mail("donor@secret.org", "hi", "body");',
              scope: 'global',
              priority: 10,
              active: 1,
            },
          ],
          cron: [{ hook: 'orphan_job', owner: 'sahipsiz', next_run: 1, schedule: 'once', calls: {} }],
        },
      },
      canaryRel: '',
    });
    const blob = `${JSON.stringify(report)}\n${renderMarkdown(report)}`;
    assert.equal(blob.includes('LEAK_NAME_XYZ'), false);
    assert.equal(blob.includes('donor@secret.org'), false);
    assert.equal(blob.includes('add_action("init"'), false);
    const sn = report.outbound_static.snippets.find((s) => s.id === 42);
    assert.ok(sn);
    assert.equal('name' in sn, false);
    assert.equal('code' in sn, false);
    assert.ok(sn.hooks.includes('init'));
    assert.ok(sn.calls.wp_mail >= 1);
    assert.match(renderMarkdown(report), /Giden veri statik denetimi/);
    assert.equal(
      report.outbound_static.cron[0].owner,
      CRON_ORPHAN
    );
    assert.equal(JSON.stringify(report).includes('/wp-content/'), false);
  });

  it('aktif SMS eklentisi REMOTE-BLOCKED çıkış 3; pasif değil', () => {
    assert.equal(blockedExitCode([{ slug: 'netgsm', status: 'active' }]), 3);
    assert.deepEqual(blockedActivePlugins([{ slug: 'netgsm', status: 'active' }]), ['netgsm']);
    assert.equal(blockedExitCode([{ slug: 'netgsm', status: 'inactive' }]), 0);
    const report = assembleReport({
      envName: 'local',
      profileId: 't',
      stepData: { plugins: { plugins: [{ slug: 'woocommerce', status: 'active' }] } },
      canaryRel: '',
    });
    assert.equal(report.outbound_static.sms, 'pasif');
    assert.equal(blockedExitCode(report.plugins), 0);
  });

  it('WP Mail SMTP Do Not Send=false + mailer smtp → uyarı, engel değil', () => {
    const report = assembleReport({
      envName: 'local',
      profileId: 't',
      stepData: {
        plugins: { plugins: [{ slug: 'wp-mail-smtp', status: 'active' }] },
        outbound: {
          mail: { active: 1, plugin: 'wp-mail-smtp', mailer: 'smtp', do_not_send: false },
        },
      },
      canaryRel: '',
    });
    assert.equal(report.outbound.mail.do_not_send, false);
    assert.equal(report.outbound_static.mail.do_not_send, false);
    assert.equal(report.outbound_static.mail.mailer, 'smtp');
    assert.ok(report.outbound_static.warnings.some((w) => /Do Not Send=false/.test(w)));
    assert.equal(blockedExitCode(report.plugins), 0);
  });

  it('EVAL_STATIC_OUTBOUND taraması tetiklemez ve kancaları içerir', () => {
    const php = EVAL_STATIC_OUTBOUND;
    assert.equal(php.includes("'"), false);
    assert.doesNotMatch(php, WRITE_PHP_RE);
    assert.doesNotMatch(php, /do_action|apply_filters|wp_schedule|spawn_cron/);
    assert.match(php, /ReflectionMethod|ReflectionFunction/);
    assert.match(php, /SELECT id, scope, priority, active, code/);
    assert.match(php, /wdp_st_hosts/);
    assert.match(php, /woocommerce_add_cart_item_data/);
    assert.doesNotMatch(php, /echo \$src\b/);
    assert.doesNotMatch(php, /"code"\s*=>/);
    assert.doesNotMatch(php, /"name"\s*=>/);
    for (const h of STATIC_SCAN_HOOKS) {
      assert.equal(php.includes(`"${h}"`), true, h);
    }
  });

  it('sahte kodda yalnız host; yol/sorgu/Authorization yok', () => {
    const hosts = extractOutboundHosts(FAKE_SNIPPET_27);
    const byHost = Object.fromEntries(hosts.map((h) => [h.host, h]));
    assert.equal(byHost['api.ornek.com']?.kind, 'sabit');
    assert.equal(byHost['api.ornek.com']?.hook, 'woocommerce_add_to_cart');
    assert.equal(byHost['dinamik:$endpoint']?.kind, 'dinamik');
    assert.equal(byHost['dinamik:API_BASE']?.kind, 'dinamik');
    assert.equal(byHost['option:cart_webhook_url']?.kind, 'option-adı');
    assert.equal(byHost['events.ornek.net']?.kind, 'sabit');
    assert.equal(byHost['hooks.ornek.io']?.kind, 'sabit');
    const blob = JSON.stringify(hosts);
    assertHostLeakFree(blob);
    assert.equal(blob.includes('abc/secret'), false);
  });

  it('snippet host tablosu rapora yol/anahtar sızdırmaz', () => {
    const report = assembleReport({
      envName: 'staging',
      profileId: 't',
      stepData: {
        plugins: { plugins: [{ slug: 'code-snippets', status: 'active', version: '3' }] },
        static_outbound: {
          snippets: [
            {
              id: 27,
              name: 'LEAK_NAME_XYZ',
              code: FAKE_SNIPPET_27,
              scope: 'global',
              priority: 10,
              active: 1,
            },
          ],
          hook_scan: [
            {
              hook: 'woocommerce_add_to_cart',
              kind: 'plugin',
              slug: 'ornek-eklenti',
              calls: { 'wp_remote_*': 1 },
              count: 1,
              hosts: [
                {
                  host: 'https://api.ornek.com/v1/secret-path?token=1',
                  kind: 'sabit',
                  hook: 'woocommerce_add_to_cart',
                },
              ],
            },
          ],
        },
      },
      canaryRel: '',
    });
    const md = renderMarkdown(report);
    const blob = `${JSON.stringify(report)}\n${md}`;
    assertHostLeakFree(blob);
    assert.equal(blob.includes('LEAK_NAME_XYZ'), false);
    assert.match(md, /Snippet giden ana makineler/);
    assert.match(md, /api\.ornek\.com/);
    assert.match(md, /dinamik:\$endpoint/);
    assert.match(md, /option:cart_webhook_url/);
    const sn = report.outbound_static.snippets.find((s) => s.id === 27);
    assert.ok(sn);
    assert.equal('code' in sn, false);
    assert.ok(sn.hosts.some((h) => h.host === 'api.ornek.com' && h.kind === 'sabit'));
    const hookHosts = report.outbound_static.hooks.find((h) => h.hook === 'woocommerce_add_to_cart');
    assert.ok(hookHosts.hosts.every((h) => h.host === 'api.ornek.com' && !h.host.includes('/')));
  });

  it('yerel sahte snippet tablosu: EVAL host çıkarır (uzak yok)', () => {
    const tmp = path.join(os.tmpdir(), `wdp-4n-snip-${process.pid}.php`);
    const rows = [
      {
        id: 27,
        scope: 'global',
        priority: 10,
        active: 1,
        code: FAKE_SNIPPET_27,
      },
      {
        id: 29,
        scope: 'global',
        priority: 10,
        active: 1,
        code: 'add_action("woocommerce_payment_complete", "x"); function x() { wp_remote_post("https://pay.ornek.com/v2/secret?key=XYZ"); }',
      },
    ];
    const rowsJson = JSON.stringify(rows).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const stub = `<?php
if (!defined("ARRAY_A")) define("ARRAY_A", "ARRAY_A");
class WdpFakeDb {
  public $prefix = "wp_";
  public $rows;
  function __construct($rows) { $this->rows = $rows; }
  function suppress_errors($x = null) { return false; }
  function esc_like($t) { return $t; }
  function prepare($q, $a = null) { return $q; }
  function get_var($q = null) { return "wp_snippets"; }
  function get_results($q = null, $t = null) { return $this->rows; }
}
$wpdb = new WdpFakeDb(json_decode('${rowsJson}', true));
$wp_filter = array();
if (!function_exists("_get_cron_array")) { function _get_cron_array() { return array(); } }
${EVAL_STATIC_OUTBOUND}
`;
    fs.writeFileSync(tmp, stub, 'utf8');
    try {
      const r = spawnSync('php', [tmp], { encoding: 'utf8', timeout: 30000 });
      assert.equal(r.status, 0, r.stderr || r.stdout || 'php çıkış');
      const data = parseJsonBlob(r.stdout || '');
      const sn27 = (data.snippets || []).find((s) => Number(s.id) === 27);
      const sn29 = (data.snippets || []).find((s) => Number(s.id) === 29);
      assert.ok(sn27, 'snippet 27 yok');
      assert.ok(sn29, 'snippet 29 yok');
      const hosts27 = (sn27.hosts || []).map((h) => h.host);
      assert.ok(hosts27.includes('api.ornek.com'));
      assert.ok(hosts27.includes('dinamik:$endpoint') || hosts27.includes('dinamik:endpoint'));
      assert.ok(hosts27.some((h) => String(h).startsWith('option:cart_webhook_url')));
      assert.ok((sn29.hosts || []).some((h) => h.host === 'pay.ornek.com'));
      const blob = JSON.stringify(data);
      assertHostLeakFree(blob);
      assert.equal(blob.includes('FAKE_SNIPPET'), false);
      assert.equal('code' in sn27, false);
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch (e) {
        if (e && e.code !== 'ENOENT') throw e;
      }
    }
  });

  it('remote:discover staging çıktısı yerelde sahte snippet ile host tablosu üretir', () => {
    const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-4n-disc-'));
    const payload = {
      php: '8.2',
      wp: '6.7',
      wc: '8.0',
      theme: 'avada',
      parent_theme: 'avada',
      locale: 'tr_TR',
      wplang: 'tr_TR',
      multisite: 0,
      plugins: [{ slug: 'code-snippets', status: 'active', version: '3' }],
      hooks: {},
      gateways: [],
      mail: { active: 0, plugin: '', mailer: '' },
      webhooks: { total: 0, by_status: {}, by_topic: {} },
      cron: {},
      hook_scan: [],
      snippets: [
        {
          id: 27,
          scope: 'global',
          priority: 10,
          active: 1,
          hooks: ['woocommerce_add_to_cart', 'woocommerce_add_cart_item_data'],
          calls: { 'wp_remote_*': 8 },
          hosts: [
            { host: 'api.ornek.com', kind: 'sabit', hook: 'woocommerce_add_to_cart' },
            { host: 'dinamik:$endpoint', kind: 'dinamik', hook: 'woocommerce_add_to_cart' },
            { host: 'option:cart_webhook_url', kind: 'option-adi', hook: 'woocommerce_add_to_cart' },
          ],
        },
      ],
      orders: 0,
      products: 0,
      users: 1,
      pages: 1,
      wdp_version: '',
      wdp_option_count: 0,
      posts: [],
      options: {},
      user_count: 1,
      attachment_count: 0,
      page_count: 1,
      product_count: 0,
    };
    const fake = () => ({ status: 0, stdout: JSON.stringify(payload), stderr: '' });
    const runner = createRemoteRunner({
      spawn: fake,
      alias: 'hedef-staging',
      wpPath: '~/www/staging30.hedefdernegi.org/public_html',
      siteUrl: 'https://staging30.hedefdernegi.org',
    });
    const { report, md, exitCode } = runDiscover({
      envName: 'staging',
      runner,
      outRoot,
      writeFiles: true,
    });
    assert.equal(exitCode, 0);
    assert.equal(report.env, 'staging');
    const mdFile = fs.readFileSync(path.join(outRoot, 'build/discovery/staging.md'), 'utf8');
    assert.match(mdFile, /Snippet giden ana makineler/);
    assert.match(mdFile, /api\.ornek\.com/);
    assert.match(mdFile, /dinamik:\$endpoint/);
    assert.match(mdFile, /option:cart_webhook_url/);
    assert.match(md, /snippet id/);
    assertHostLeakFree(`${JSON.stringify(report)}\n${mdFile}`);
    const sn = report.outbound_static.snippets.find((s) => s.id === 27);
    assert.ok(sn.hosts.some((h) => h.host === 'api.ornek.com'));
    assert.equal(sn.hosts.every((h) => !String(h.host).includes('/')), true);
  });
});

describe('canary-snapshot.php salt özet', () => {
  it('siteurl ve permalink_structure hash; ham URL yok', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'tests/e2e/helpers/canary-snapshot.php'),
      'utf8'
    );
    assert.match(src, /hash\s*\(\s*'sha256'/);
    assert.doesNotMatch(
      src,
      /'siteurl'\s*=>\s*\(string\)\s*get_option\s*\(\s*'siteurl'\s*\)/
    );
    assert.match(src, /permalink_structure/);
    assert.doesNotMatch(src, /post_content|post_title|post_excerpt/);
  });
});
