/**
 * Uzak keşif: yazma yok, eval temiz, çıktı sızıntısız, REMOTE-BLOCKED.
 * Ağ yok; sahte ssh spawn.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BLOCKED_ACTIVE_SLUGS,
  DISCOVER_STEPS,
  WRITE_PHP_RE,
  WRITE_TAIL_RE,
  blockedActivePlugins,
  blockedExitCode,
  buildRemoteWpCommand,
  canonicalEnv,
  classifyPlugin,
  compactPhp,
  getDiscoverWpTails,
  getEvalSnippets,
  parseJsonBlob,
  runGuardedSsh,
  sanitizeDiscoveryOutput,
  tailsForWriteScan,
} from '../../../scripts/lib/remote-discover-lib.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import { createRemoteRunner, runDiscover } from '../../../scripts/remote-discover.mjs';

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
      assert.doesNotMatch(php, /do_action|apply_filters/);
      assert.doesNotMatch(compactPhp(php), WRITE_PHP_RE);
    }
  });

  it('uzak wp komutunda --path var, skip-themes yok', () => {
    for (const tail of getDiscoverWpTails()) {
      const cmd = buildRemoteWpCommand('~/www/staging30.hedefdernegi.org/public_html', tail);
      assert.match(cmd, /--path='/);
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
    assert.throws(() => runGuardedSsh(fake, 'ikramaid', 'wp eval "echo 1;" --path=/x', {}, {}), /ssh başarısız/);
    assert.equal(n, 1);
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

  it('canonical env ve json blob', () => {
    assert.equal(canonicalEnv('hedef'), 'staging');
    assert.equal(canonicalEnv('ikram-aid'), 'ikram');
    assert.deepEqual(parseJsonBlob('Notice: x\n{"a":1}\n'), { a: 1 });
    assert.equal(classifyPlugin('google-site-kit'), 'measurement');
    assert.equal(classifyPlugin('hello-dolly'), 'unclassified');
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
