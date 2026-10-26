/**
 * E8M: paketlenen zip yalniz izinli desenlere uyar (gelistirme/test ciktisi, gizli dosya yok).
 * Yerel: scripts/package-wp-plugin.sh calistirilir; uzak komut yok.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ZIP = path.join(ROOT, 'build/woo-donation-popup.zip');
const PLANT_DIR = path.join(ROOT, 'test-results');
const PLANT = path.join(PLANT_DIR, '.last-run.json');

const TOP_ALLOWED = new Set([
  'woo-donation-popup.php', 'uninstall.php', 'readme.txt', 'README.md', 'LICENSE', 'license.txt',
  'includes', 'src', 'assets', 'templates', 'blocks', 'languages',
]);
const EXT_ALLOWED = new Set([
  'php', 'js', 'css', 'json', 'mo', 'po', 'pot', 'txt', 'md', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'woff', 'woff2', 'html', 'map',
]);

function buildZip() {
  // Gelistirme ciktisi varmis gibi (Plugin Check hidden_files bulgusu) taklit edilir, sonra silinir.
  const plantedDir = !fs.existsSync(PLANT_DIR);
  const plantedFile = !fs.existsSync(PLANT);
  fs.mkdirSync(PLANT_DIR, { recursive: true });
  if (plantedFile) fs.writeFileSync(PLANT, '{}');
  try {
    // E8P: `npm run pack` ile ayni sira — once derleme (assets/css|js/build, assets/build), sonra paket.
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore' });
    execFileSync('sh', ['scripts/package-wp-plugin.sh'], { cwd: ROOT, stdio: 'ignore' });
  } finally {
    if (plantedFile) fs.rmSync(PLANT, { force: true });
    if (plantedDir) fs.rmSync(PLANT_DIR, { recursive: true, force: true });
  }
  return execFileSync('unzip', ['-Z1', ZIP], { encoding: 'utf8' })
    .split('\n').filter(Boolean);
}

function checkEntries(entries) {
  const files = entries.filter((e) => !e.endsWith('/')).map((e) => e.replace(/^woo-donation-popup\//, ''));
  assert.ok(files.includes('woo-donation-popup.php'));
  assert.ok(files.includes('readme.txt'));
  assert.ok(files.includes('uninstall.php'));

  const bad = [];
  for (const f of files) {
    const parts = f.split('/');
    if (parts.some((p) => p.startsWith('.'))) bad.push(`gizli: ${f}`);
    if (!TOP_ALLOWED.has(parts[0])) bad.push(`izinsiz kok: ${f}`);
    const ext = path.extname(f).slice(1).toLowerCase();
    if (parts.length > 1 && !EXT_ALLOWED.has(ext)) bad.push(`izinsiz uzanti: ${f}`);
    if (/(^|\/)(test-results|playwright-report|blob-report|node_modules|vendor|vendor-dev|tests|tools|scripts|docs|coverage|research|design)\//.test(f) || /^build\//.test(f)) {
      bad.push(`gelistirme klasoru: ${f}`);
    }
    if (/(package(-lock)?\.json|composer\.(json|lock)|phpunit|phpcs|phpstan|eslint|\.zip$|\.log$)/i.test(path.basename(f))) {
      bad.push(`gelistirme dosyasi: ${f}`);
    }
    if (f.startsWith('assets/src/')) bad.push(`kaynak: ${f}`);
    if (/(^|\/)CHANGELOG\.md$/i.test(f)) bad.push(`changelog (readme.txt yeterli): ${f}`);
  }
  assert.deepEqual(bad, []);
  return files;
}

test('paket: yalniz izinli desenler, gizli/gelistirme dosyasi yok', () => {
  checkEntries(buildZip());
});

// E8P: calisma zamaninin yukledigi derleme ciktilari pakette VAR olmali (.distignore `build/` hatasi).
test('paket: derlenmis on yuz paketleri + manifestler zip icinde (E8P)', () => {
  const files = new Set(checkEntries(buildZip()));
  for (const dir of ['assets/css/build', 'assets/js/build']) {
    assert.ok(files.has(`${dir}/manifest.json`), `${dir}/manifest.json zip'te yok`);
    const man = JSON.parse(execFileSync('unzip', ['-p', ZIP, `woo-donation-popup/${dir}/manifest.json`], { encoding: 'utf8' }));
    assert.ok(man.file, `${dir}/manifest.json 'file' anahtari yok`);
    const rel = String(man.file).replace(/^build\//, '');
    assert.ok(files.has(`${dir}/${rel}`), `manifest dosyasi zip'te yok: ${dir}/${rel}`);
  }
  // PHP'nin assets/build/... ile kaydettigi her varlik.
  const wanted = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.php')) {
        for (const m of fs.readFileSync(f, 'utf8').matchAll(/['"](assets\/build\/[A-Za-z0-9_\-./]+\.(?:js|css))['"]/g)) wanted.add(m[1]);
      }
    }
  };
  for (const d of ['src', 'includes']) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  assert.ok(wanted.size > 0, 'PHP kaynaginda assets/build yolu bulunamadi');
  for (const w of wanted) assert.ok(files.has(w), `PHP'nin yukledigi derlenmis varlik zip'te yok: ${w}`);
  // katmanli kaynaklar yedek olarak pakette kalir
  assert.ok([...files].some((f) => f.startsWith('assets/css/src/')));
  assert.ok([...files].some((f) => f.startsWith('assets/js/src/')));
});

test('paket: boyut makul (< 5 MB)', () => {
  const size = fs.statSync(ZIP).size;
  assert.ok(size < 5 * 1024 * 1024, `zip ${size} bayt`);
});

// --- E8T: `wp dist-archive` (npm run pack:dist) ciktisi icin ayni kurallar. Arac kurulu degilse atlanir.
const DIST_ZIP = path.join(ROOT, 'build/dist/woo-donation-popup.zip');
const DIST_READY = fs.existsSync(path.join(ROOT, 'build/wpcli-packages/vendor/wp-cli/dist-archive-command'));

function buildDistZip() {
  execFileSync('node', ['scripts/pack-dist.mjs'], { cwd: ROOT, stdio: 'ignore' });
  return execFileSync('unzip', ['-Z1', DIST_ZIP], { encoding: 'utf8' }).split('\n').filter(Boolean);
}

test('dist-archive paketi: yalniz izinli desenler, gizli/gelistirme dosyasi yok', { skip: !DIST_READY && 'dist-archive-command kurulu degil (node scripts/pack-dist.mjs --install)' }, () => {
  const files = checkEntries(buildDistZip());
  assert.ok(files.includes('woo-donation-popup.php'));
  assert.ok(fs.statSync(DIST_ZIP).size < 5 * 1024 * 1024);
});

// Bilinen fark (RAPOR-E8T): dist-archive `/assets/src/` desenini sabitlemez, assets/css/src ve assets/js/src'yi de dislar.
// Pakette `build/` deseni bundle'lari da dislar -> katmanli on yuz kaynaklari pakette kalmaz. Duzelince todo kalkar.
test('dist-archive paketi: assets/css/src + assets/js/src katmanli kaynaklari var', { todo: 'dist-archive .distignore eslesmesi', skip: !DIST_READY && 'arac yok' }, () => {
  const files = buildDistZip().map((e) => e.replace(/^woo-donation-popup\//, ''));
  assert.ok(files.some((f) => f.startsWith('assets/css/src/')));
  assert.ok(files.some((f) => f.startsWith('assets/js/src/')));
});
