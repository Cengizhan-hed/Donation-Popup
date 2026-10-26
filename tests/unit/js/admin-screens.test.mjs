/**
 * admin:screens saf yardımcıları (scripts/lib/admin-screens-lib.mjs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCREENS,
  assertEnvAllowed,
  assertAdminGetUrl,
  isReadMethod,
  screenUrl,
  norm,
  extractDocPaths,
  compareDocPaths,
  detectUiMode,
  renderMarkdown,
} from '../../../scripts/lib/admin-screens-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('ortam: yalnız local, staging-hedef, ikram-aid; canlı ve yabancı reddedilir', () => {
  assert.equal(assertEnvAllowed('local'), 'local');
  assert.equal(assertEnvAllowed('local-wp'), 'local');
  assert.equal(assertEnvAllowed('staging-hedef'), 'staging-hedef');
  assert.equal(assertEnvAllowed('ikram-aid'), 'ikram-aid');
  const live = ['hedef' + 'dernegi.org', 'www.hedef' + 'dernegi.org', 'canli', 'hedef', 'staging'];
  for (const bad of live) assert.throws(() => assertEnvAllowed(bad), /reddedildi|izinli değil/, bad);
});

test('adres: yalnız aynı kökenli wp-admin; yabancı köken ve wp-admin dışı reddedilir', () => {
  const base = 'https://site.example';
  assert.equal(assertAdminGetUrl(base, '/wp-admin/plugins.php'), 'https://site.example/wp-admin/plugins.php');
  assert.throws(() => assertAdminGetUrl(base, 'https://evil.example/wp-admin/x.php'), /yabancı köken/);
  assert.throws(() => assertAdminGetUrl(base, '/wp-login.php'), /wp-admin dışı/);
  assert.throws(() => assertAdminGetUrl(base, '/?add-to-cart=1'), /wp-admin dışı/);
});

test('yöntem: yalnız GET/HEAD okuma sayılır', () => {
  assert.ok(isReadMethod('get') && isReadMethod('HEAD'));
  for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) assert.equal(isReadMethod(m), false);
});

test('ekran listesi: tüm yollar wp-admin altında, benzersiz kimlik, ürün yer tutucusu', () => {
  const ids = new Set();
  for (const s of SCREENS) {
    assert.ok(!ids.has(s.id), s.id);
    ids.add(s.id);
    assert.ok(s.path.startsWith('/wp-admin/'), s.path);
    assertAdminGetUrl('https://x.test', s.path.replace('{id}', '1'));
  }
  for (const need of ['plugins', 'privacy-settings', 'privacy-guide', 'export-personal', 'erase-personal', 'wc-account', 'wc-general', 'wc-checkout', 'product-edit']) {
    assert.ok(ids.has(need), need);
  }
  const prod = SCREENS.find((s) => s.needsProduct);
  assert.equal(screenUrl('https://x.test', prod, 0), null);
  assert.equal(screenUrl('https://x.test', prod, '42'), 'https://x.test/wp-admin/post.php?post=42&action=edit');
  assert.ok(!SCREENS.some((s) => /elementor|theme-builder|fusion/i.test(s.path)));
});

test('norm: Türkçe küçük harf ve noktalama', () => {
  assert.equal(norm('  Ödemeler: "Genel"  '), 'ödemeler genel');
  assert.equal(norm('IŞIK'), 'ışık');
});

test('belge yolları: › ile yazılmış yollar çıkarılır', () => {
  const md = [
    '- [ ] Code Snippets › Yeni ekle: `curcy` içeriği.',
    '1. zip Eklentiler › Yeni ekle › Eklenti yükle ile yüklenir.',
    '- Araçlar › Kişisel veriyi dışa aktar / sil: deneme',
    'yol yok burada',
  ].join('\n');
  const p = extractDocPaths(md);
  assert.equal(p.length, 3);
  assert.deepEqual(p[0].segments, [['Code Snippets'], ['Yeni ekle']]);
  assert.deepEqual(p[1].segments.map((s) => s[0]), ['zip Eklentiler', 'Yeni ekle', 'Eklenti yükle ile yüklenir']);
  assert.deepEqual(p[2].segments[1], ['Kişisel veriyi dışa aktar', 'sil']);
  assert.equal(p[0].line, 1);
});

test('belge karşılaştırma: bulunan / bulunamayan', () => {
  const data = {
    menu: [
      { label: 'WooCommerce', slug: 'woocommerce', subs: [{ label: 'Ayarlar' }, { label: 'Donation Panel' }] },
      { label: 'Eklentiler', slug: 'plugins.php', subs: [{ label: 'Yüklü eklentiler' }, { label: 'Yeni ekle' }] },
    ],
    screens: [
      { tabs: ['Genel', 'Hesaplar ve Gizlilik'], headings: [], labels: [], buttons: ['Eklenti yükle'] },
    ],
  };
  const paths = extractDocPaths(
    ['WooCommerce › Ayarlar › Hesaplar ve Gizlilik: x', 'Eklentiler › Yeni ekle › Eklenti yükle ile', 'Code Snippets › Yeni ekle: y'].join('\n')
  );
  const r = compareDocPaths(paths, data);
  assert.equal(r.found.length, 2);
  assert.equal(r.missing.length, 1);
  assert.match(r.missing[0].raw, /Code Snippets/);
  assert.equal(r.missing[0].line, 3);
});

test('menü kipi: yeni / eski / ikisi / yok', () => {
  const mk = (...slugs) => [{ label: 'WooCommerce', subs: slugs.map((s) => ({ label: s, slug: s })) }];
  assert.equal(detectUiMode(mk('donation-panel', 'donation-panel-guide')).uiMode, 'new');
  assert.equal(detectUiMode(mk('wdp-popup-settings')).uiMode, 'legacy');
  assert.equal(detectUiMode(mk('donation-panel', 'wdp-popup-settings')).uiMode, 'both');
  assert.equal(detectUiMode(mk('wc-settings')).uiMode, 'none');
});

test('Markdown çıktısı: başlık, kip ve eksik yol listesi', () => {
  const md = renderMarkdown({
    env: 'local',
    generatedAt: 'x',
    uiMode: { uiMode: 'new', slugs: ['donation-panel'] },
    menu: [{ label: 'WooCommerce', subs: [{ label: 'Ayarlar' }] }],
    screens: [{ id: 'plugins', path: '/wp-admin/plugins.php', note: 'Eklentiler', status: 'tamam', title: 'Eklentiler', tabs: [], headings: [], labels: [], buttons: [] }],
    docCheck: { doc: 'docs/CANLIYA-ALMA.md', found: [], missing: [{ raw: 'A › B', line: 7, missingSegment: 'B' }] },
  });
  assert.match(md, /Ayar ekranı kipi: \*\*new\*\*/);
  assert.match(md, /satır 7: `A › B`/);
});

test('betik yapısı: yazma çağrısı yok, canlı adres yok, POST/tıklama yok', () => {
  const root = path.resolve(__dirname, '../../..');
  for (const f of ['scripts/admin-screens.mjs', 'scripts/lib/admin-screens-lib.mjs']) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert.ok(!/\.(click|fill|type|check|press|setInputFiles|selectOption)\(/.test(src), `${f}: etkileşim çağrısı`);
    assert.ok(!/\b(ssh|scp|rsync|sftp)\b\s*\(/.test(src), `${f}: uzak ikili`);
    assert.ok(!/hedef\s*dernegi\.org/i.test(src.replace(/staging30\.hedefdernegi\.org/g, '')), `${f}: canlı adres`);
  }
});
