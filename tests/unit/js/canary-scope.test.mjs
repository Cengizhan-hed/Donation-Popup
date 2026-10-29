/**
 * Kanarya kapsamı (CLAUDE.md §25, 12.2): yönetici içerik düzenlemesi otomatik kabul,
 * riskli değişiklikler KIRMIZI/UYARI. Ağ yok, yalnız sahte anlık görüntü.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CANARY_SCHEMA,
  compareCanary,
  evaluateCanaryHealth,
  absorbAutoAccepted,
  persistAutoAcceptedBaseline,
  formatCanaryReportLines,
  formatCanaryDiff,
  acceptUserOptionChanges,
  isVolatileOptionKey,
  readSnapshot,
} from '../../../tests/e2e/helpers/canary.mjs';
import { isolateUnitProfile } from '../../../tests/e2e/helpers/profile.mjs';

let restore = () => {};
beforeEach(() => {
  restore = isolateUnitProfile({ id: 'local', remote: false, allowedHosts: ['127.0.0.1'] });
});
afterEach(() => restore());

const EMPTY_REG = { created: [], mutated: [] };

function siteSnap(over = {}) {
  const posts = over.posts || [
    { id: 10, type: 'page', status: 'publish', modified: 'a', mark: '' },
    { id: 11, type: 'page', status: 'publish', modified: 'a', mark: '' },
    { id: 12, type: 'page', status: 'publish', modified: 'a', mark: '' },
    { id: 20, type: 'page', status: 'publish', modified: 'a', mark: '' },
    { id: 30, type: 'product', status: 'publish', modified: 'a', mark: '', meta: 'm30', donation: true },
    { id: 40, type: 'attachment', status: 'inherit', modified: 'a', mark: '' },
    { id: 41, type: 'elementor_library', status: 'publish', modified: 'a', mark: '' },
  ];
  return {
    schema: CANARY_SCHEMA,
    posts,
    options: {
      show_on_front: 'page',
      page_on_front: '20',
      page_for_posts: '0',
      woocommerce_cart_page_id: '10',
      woocommerce_checkout_page_id: '11',
      woocommerce_myaccount_page_id: '12',
      woocommerce_shop_page_id: '0',
      woocommerce_terms_page_id: '0',
      woocommerce_currency: 'sha256:aaa',
      woocommerce_version: 'sha256:v1',
      donation_panel_settings: 'sha256:ds1',
      wdp_cache_version: 'sha256:c1',
      active_plugins: '["woocommerce/woocommerce.php","woo-donation-popup/woo-donation-popup.php"]',
      stylesheet: 'twentytwentyfive',
      template: 'twentytwentyfive',
      users_by_role: '{"administrator":1}',
      ...(over.options || {}),
    },
    env_files: { 'wp-config.php': true, '.htaccess': true, 'index.php': true, 'wp-load.php': true, ...(over.env_files || {}) },
    user_count: over.user_count ?? 1,
    page_count: posts.filter((p) => p.type === 'page').length,
    product_count: posts.filter((p) => p.type === 'product').length,
    attachment_count: over.attachment_count ?? posts.filter((p) => p.type === 'attachment').length,
  };
}

function health(baseline, current, opts = {}) {
  return evaluateCanaryHealth(current, 'local', EMPTY_REG, { baseline, fixtures: null, ...opts });
}

describe('kanarya kapsamı §25', () => {
  it('(a) sayfa + Elementor şablonu + ek yeni/değişik → TEMİZ, dış değişiklik (otomatik kabul) satırı, taban güncellenir', () => {
    const base = siteSnap();
    const cur = siteSnap({
      posts: [
        ...base.posts.map((p) => (p.id === 20 || p.id === 41 || p.id === 11 ? { ...p, modified: 'b' } : p)),
        { id: 50, type: 'page', status: 'draft', modified: 'b', mark: '' },
        { id: 51, type: 'elementor_library', status: 'publish', modified: 'b', mark: '' },
        { id: 52, type: 'attachment', status: 'inherit', modified: 'b', mark: '' },
        { id: 53, type: 'nav_menu_item', status: 'publish', modified: 'b', mark: '' },
      ],
    });
    const h = health(base, cur);
    assert.equal(h.ok, true, JSON.stringify(h.diffs));
    assert.ok(h.external.some((d) => d.id === 51 && d.change === 'created'));
    assert.ok(h.external.some((d) => d.id === 52 && d.change === 'created'));
    assert.ok(h.external.some((d) => d.id === 41 && d.change === 'modified'));
    assert.ok(h.external.some((d) => d.option === 'attachment_count'));
    const lines = formatCanaryReportLines('önce', h);
    assert.equal(lines[0], 'kanarya önce: TEMİZ');
    assert.ok(lines.some((l) => /dış değişiklik \(otomatik kabul\)/.test(l)));
    assert.match(formatCanaryDiff({ ok: true, diffs: [], warnings: [], external: h.external }), /otomatik kabul/);
    // taban güncellenir → aynı anlık görüntü artık fark üretmez
    assert.equal(h.baselineUpdate.changed, true);
    const again = health(h.baselineUpdate.baseline, cur);
    assert.equal(again.ok, true);
    assert.equal(again.external.length, 0, JSON.stringify(again.external));
    assert.equal(again.warnings.length, 0);
  });

  it('(b) sıradan ek/şablon silindi → UYARI ama geçer; taban güncellenir', () => {
    const base = siteSnap();
    const cur = siteSnap({ posts: base.posts.filter((p) => p.id !== 40 && p.id !== 41), attachment_count: 0 });
    const h = health(base, cur);
    assert.equal(h.ok, true, JSON.stringify(h.diffs));
    assert.ok(h.warnings.some((d) => d.id === 40 && d.change === 'deleted'));
    assert.ok(h.warnings.some((d) => d.id === 41 && d.change === 'deleted'));
    assert.ok(formatCanaryReportLines('önce', h).some((l) => /UYARI 2/.test(l)));
    const again = health(h.baselineUpdate.baseline, cur);
    assert.equal(again.ok, true);
    assert.equal(again.warnings.length + again.external.length, 0);
  });

  it('(c) WooCommerce ödeme sayfası silindi → KIRMIZI', () => {
    const base = siteSnap();
    const cur = siteSnap({ posts: base.posts.filter((p) => p.id !== 11) });
    const h = health(base, cur);
    assert.equal(h.ok, false);
    assert.ok(h.diffs.some((d) => d.id === 11 && d.change === 'deleted'));
    assert.equal(h.baselineUpdate, null);
    // çöpe atma da KIRMIZI
    const trashed = siteSnap({ posts: base.posts.map((p) => (p.id === 11 ? { ...p, status: 'trash' } : p)) });
    assert.equal(health(base, trashed).ok, false);
  });

  it('(d) woocommerce_* ya da donation_panel_* seçeneği (test dışı) değişti → KIRMIZI; oynak anahtar sayılmaz', () => {
    const base = siteSnap();
    const woo = health(base, siteSnap({ options: { woocommerce_currency: 'sha256:bbb' } }));
    assert.equal(woo.ok, false);
    assert.ok(woo.diffs.some((d) => d.option === 'woocommerce_currency'));
    const dp = health(base, siteSnap({ options: { donation_panel_settings: 'sha256:ds2' } }));
    assert.equal(dp.ok, false);
    assert.ok(dp.diffs.some((d) => d.option === 'donation_panel_settings'));
    const noisy = health(base, siteSnap({ options: { woocommerce_version: 'sha256:v2', wdp_cache_version: 'sha256:c2' } }));
    assert.equal(noisy.ok, true, JSON.stringify(noisy.diffs));
    assert.equal(isVolatileOptionKey('woocommerce_admin_notices'), true);
    assert.equal(isVolatileOptionKey('donation_panel_migrations_lock'), true);
    assert.equal(isVolatileOptionKey('woocommerce_checkout_page_id'), false);
    assert.equal(isVolatileOptionKey('woocommerce_blocks_foo'), false);
    assert.equal(isVolatileOptionKey('wdp_button_settings'), false);
  });

  it('(d2) kurulum sonrası (installPhase) eklenti seçeneği değişimi geçer ve tabana işlenir; Woo ayarı yine KIRMIZI', () => {
    const base = siteSnap();
    const cur = siteSnap({ options: { donation_panel_settings: 'sha256:ds2' } });
    const h = health(base, cur, { installPhase: true });
    assert.equal(h.ok, true, JSON.stringify(h.diffs));
    assert.deepEqual(h.install.map((d) => d.option), ['donation_panel_settings']);
    assert.equal(h.baselineUpdate.baseline.options.donation_panel_settings, 'sha256:ds2');
    const woo = health(base, siteSnap({ options: { woocommerce_currency: 'sha256:bbb' } }), { installPhase: true });
    assert.equal(woo.ok, false);
  });

  it('(e) show_on_front değişti → KIRMIZI', () => {
    const base = siteSnap();
    const h = health(base, siteSnap({ options: { show_on_front: 'posts' } }));
    assert.equal(h.ok, false);
    assert.ok(h.diffs.some((d) => d.option === 'show_on_front'));
  });

  it('(f) bağış ürünü meta değişti → KIRMIZI; yalnız içerik (modified) değişti → otomatik kabul', () => {
    const base = siteSnap();
    const metaChanged = siteSnap({ posts: base.posts.map((p) => (p.id === 30 ? { ...p, meta: 'm30x' } : p)) });
    const h = health(base, metaChanged);
    assert.equal(h.ok, false);
    assert.ok(h.diffs.some((d) => d.id === 30 && d.change === 'meta'));
    const contentOnly = siteSnap({ posts: base.posts.map((p) => (p.id === 30 ? { ...p, modified: 'b' } : p)) });
    const c = health(base, contentOnly);
    assert.equal(c.ok, true, JSON.stringify(c.diffs));
    // bağış ürünü silinmesi KIRMIZI
    assert.equal(health(base, siteSnap({ posts: base.posts.filter((p) => p.id !== 30) })).ok, false);
  });

  it('(g) etkin tema değişti → KIRMIZI; --accept-user-option akışı aynen çalışır', () => {
    const base = siteSnap();
    const cur = siteSnap({ options: { stylesheet: 'blocksy', template: 'blocksy' } });
    const h = health(base, cur);
    assert.equal(h.ok, false);
    assert.ok(h.diffs.some((d) => d.option === 'stylesheet'));
    const acc = acceptUserOptionChanges(base, cur, h.diffs, ['stylesheet', 'template']);
    assert.equal(acc.ok, true, acc.reason);
    assert.equal(health(acc.baseline, cur).ok, true);
    // eklenti listesi değişimi de KIRMIZI
    const plug = health(base, siteSnap({ options: { active_plugins: '["woocommerce/woocommerce.php"]' } }));
    assert.equal(plug.ok, false);
  });

  it('kullanıcı rolü/sayısı ve ortam dosyası silinmesi KIRMIZI', () => {
    const base = siteSnap();
    assert.equal(health(base, siteSnap({ options: { users_by_role: '{"administrator":2}' } })).ok, false);
    assert.equal(health(base, siteSnap({ user_count: 2 })).ok, false);
    const env = health(base, siteSnap({ env_files: { '.htaccess': false } }));
    assert.equal(env.ok, false);
    assert.ok(env.diffs.some((d) => d.change === 'env-file-deleted' && d.file === '.htaccess'));
  });

  it('defter dışı işaretli test kaydı (yeni) → KIRMIZI', () => {
    const base = siteSnap();
    const cur = siteSnap({ posts: [...base.posts, { id: 90, type: 'product', status: 'private', modified: 'b', mark: 'run-x' }] });
    const h = health(base, cur);
    assert.equal(h.ok, false);
    assert.ok(h.diffs.some((d) => d.id === 90 && d.change === 'created'));
  });

  it('eski şema tabanı: yeni kapsam anahtarları fark sayılmaz, tabana eklenir', () => {
    const cur = siteSnap();
    const legacy = {
      posts: cur.posts.map((p) => ({ id: p.id, type: p.type, status: p.status, modified: p.modified, mark: p.mark })),
      options: {
        show_on_front: 'page',
        page_on_front: '20',
        page_for_posts: '0',
        woocommerce_cart_page_id: '10',
        woocommerce_checkout_page_id: '11',
        woocommerce_myaccount_page_id: '12',
        woocommerce_shop_page_id: '0',
        woocommerce_terms_page_id: '0',
      },
      user_count: 1,
      page_count: cur.page_count,
      product_count: cur.product_count,
      attachment_count: cur.attachment_count,
    };
    const h = health(legacy, cur);
    assert.equal(h.ok, true, JSON.stringify(h.diffs));
    assert.ok(h.coverage.includes('woocommerce_currency'));
    const next = h.baselineUpdate.baseline;
    assert.equal(next.schema, CANARY_SCHEMA);
    assert.equal(next.options.stylesheet, 'twentytwentyfive');
    assert.equal(next.posts.find((p) => p.id === 30).meta, 'm30');
    assert.deepEqual(next.env_files, cur.env_files);
    // sonraki koşuda tema değişimi artık yakalanır
    assert.equal(health(next, siteSnap({ options: { stylesheet: 'blocksy' } })).ok, false);
  });

  it('persistAutoAcceptedBaseline yalnız TEMİZ + değişiklikte yazar', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-canary-scope-'));
    const file = path.join(dir, 'b.json');
    const base = siteSnap();
    const cur = siteSnap({ posts: [...base.posts, { id: 60, type: 'page', status: 'publish', modified: 'b', mark: '' }] });
    const h = health(base, cur);
    assert.equal(persistAutoAcceptedBaseline('local', h, { file }).written, true);
    assert.ok(readSnapshot(file).posts.some((p) => p.id === 60));
    const red = health(base, siteSnap({ options: { show_on_front: 'posts' } }));
    assert.equal(persistAutoAcceptedBaseline('local', red, { file: path.join(dir, 'x.json') }).written, false);
    assert.equal(fs.existsSync(path.join(dir, 'x.json')), false);
    const same = health(base, base);
    assert.equal(persistAutoAcceptedBaseline('local', same, { file: path.join(dir, 'y.json') }).written, false);
  });

  it('absorbAutoAccepted defterdeki test kaydını tabana almaz', () => {
    const base = siteSnap();
    const cur = siteSnap({ posts: [...base.posts, { id: 91, type: 'product', status: 'private', modified: 'b', mark: 'boot-1' }] });
    const cmp = compareCanary(base, cur, { allowedCreatedIds: [91] });
    assert.equal(cmp.ok, true, JSON.stringify(cmp.diffs));
    const r = absorbAutoAccepted(base, cur, cmp);
    assert.equal(r.baseline.posts.some((p) => p.id === 91), false);
  });
});
