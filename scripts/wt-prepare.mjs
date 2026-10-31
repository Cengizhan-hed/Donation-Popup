#!/usr/bin/env node
/**
 * Yeni git worktree'yi koşuya hazırlar: .gitignore'daki gerekli dosyaları ana depodan
 * APFS klonuyla (copy-on-write; olmazsa normal kopya) kopyalar (var olana dokunmaz),
 * node_modules'u da klonlar; npm kurulumu yalnız bağımlılık özeti farklıysa çalışır.
 * Kullanım: npm run wt:prepare -- <worktree-klasörü> [--dry-run] [--force] [--skip-install]
 * Sembolik bağ kurulmaz; .env*, .auth, *.pem, *.key, ~/.ssh asla kopyalanmaz.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_FREE_BYTES = 10 * 1024 ** 3;

/** Kopyalanacak göreli yollar (ana depodan). */
export const COPY_ENTRIES = [
  'tests/e2e/__baseline__',
  'tests/e2e/__baseline_prev__',
  'vendor',
  'vendor-dev',
  'tools/bin/*.phar',
  'build/local-wp/wordpress',
  'build/local-wp/install.php',
  'build/local-wp/wordpress-latest.zip',
  'build/local-wp/woocommerce.latest-stable.zip',
  'build/local-wp/plugin-check.latest-stable.zip',
  'build/local-wp/sqlite-database-integration.zip',
  'build/migration/cache',
];

/** Asla kopyalanmayacak göreli yol parçaları (açık kara liste). */
export function isDenied(relPath) {
  const p = relPath.split(path.sep).join('/');
  const parts = p.split('/');
  const base = parts[parts.length - 1];
  if (base === '.env' || base.startsWith('.env.') || base.startsWith('.env')) return true;
  if (/\.(pem|key)$/i.test(base)) return true;
  if (parts.includes('.auth')) return true;
  if (parts.includes('.ssh')) return true;
  if (parts.includes('node_modules') || parts.includes('.git')) return true;
  return false;
}

/** Joker (tools/bin/*.phar) açar; yoksa boş döner. */
export function expandEntry(root, entry) {
  if (!entry.includes('*')) return fs.existsSync(path.join(root, entry)) ? [entry] : [];
  const dir = path.dirname(entry);
  const re = new RegExp('^' + path.basename(entry).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => re.test(f)).map((f) => path.join(dir, f));
}

/** Verilen hedef ana depodaki (ana klasör hariç) kayıtlı bir worktree mi? */
export function validateWorktree(root, target, listOutput) {
  const out = listOutput ?? execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' });
  const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
  const t = real(target);
  const main = real(root);
  if (t === main) return { ok: false, reason: 'Hedef ana deponun kendisi olamaz.' };
  const trees = out.split('\n').filter((l) => l.startsWith('worktree ')).map((l) => real(l.slice(9).trim()));
  if (!trees.includes(t)) return { ok: false, reason: 'Hedef `git worktree list` içinde kayıtlı bir worktree değil.' };
  return { ok: true, path: t };
}

function walk(abs, rel, acc) {
  const st = fs.lstatSync(abs);
  if (st.isSymbolicLink()) return;
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(abs)) walk(path.join(abs, f), path.join(rel, f), acc);
  } else if (st.isFile()) {
    acc.push({ rel, size: st.size });
  }
}

/** Plan: her dosya için kopyala / atla (var, kara liste). */
export function buildPlan(root, dest, { force = false, entries = COPY_ENTRIES } = {}) {
  const copy = [];
  const skipped = [];
  for (const entry of entries) {
    for (const rel of expandEntry(root, entry)) {
      const files = [];
      walk(path.join(root, rel), rel, files);
      for (const f of files) {
        if (isDenied(f.rel)) skipped.push({ rel: f.rel, why: 'kara liste' });
        else if (!force && fs.existsSync(path.join(dest, f.rel))) skipped.push({ rel: f.rel, why: 'var' });
        else copy.push(f);
      }
    }
  }
  return { copy, skipped };
}

export function applyPlan(root, dest, plan) {
  for (const f of plan.copy) {
    const to = path.join(dest, f.rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(root, f.rel), to, fs.constants.COPYFILE_FICLONE);
  }
}

/** Dizin ağacını klonla (macOS cp -c, Linux --reflink=auto); olmazsa normal kopya. Var olan dosyaların üzerine yazar. */
export function cloneTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  const attempts = [];
  if (process.platform === 'darwin') attempts.push({ clone: true, args: ['-c', '-R', src + path.sep + '.', dst] });
  else if (process.platform === 'linux') attempts.push({ clone: true, args: ['--reflink=auto', '-R', src + path.sep + '.', dst] });
  attempts.push({ clone: false, args: ['-R', src + path.sep + '.', dst] });
  for (const a of attempts) {
    const r = spawnSync('cp', a.args, { stdio: 'ignore' });
    if (r.status === 0) return { clone: a.clone };
  }
  throw new Error('kopyalama başarısız: ' + src);
}

/** Klon desteği yoklaması: hedef volume'de küçük dosyayı `cp -c` ile kopyalar. */
export function probeClone(dir) {
  if (process.platform !== 'darwin') return false;
  const a = fs.mkdtempSync(path.join(dir, '.wdp-clone-probe-'));
  try {
    fs.writeFileSync(path.join(a, 'a'), 'x');
    return spawnSync('cp', ['-c', path.join(a, 'a'), path.join(a, 'b')], { stdio: 'ignore' }).status === 0;
  } finally {
    fs.rmSync(a, { recursive: true, force: true });
  }
}

/** Kopya içindeki kara listedeki öğeleri (.env*, *.pem, *.key, .auth, .ssh) siler; sayıyı döner. */
export function scrubDenied(dir) {
  let n = 0;
  const walkDir = (abs) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const p = path.join(abs, e.name);
      const bad = e.name.startsWith('.env') || /\.(pem|key)$/i.test(e.name) || e.name === '.auth' || e.name === '.ssh';
      if (bad) { fs.rmSync(p, { recursive: true, force: true }); n++; continue; }
      if (e.isDirectory()) walkDir(p);
    }
  };
  if (fs.existsSync(dir)) walkDir(dir);
  return n;
}

const sha = (f) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null);

/** Bağımlılık özeti: package.json + node_modules/.package-lock.json. */
export function npmDigest(dir) {
  return [sha(path.join(dir, 'package.json')), sha(path.join(dir, 'node_modules', '.package-lock.json'))].join(':');
}

/** npm kurulumu gerekli mi? Özet farklıysa ya da node_modules yoksa evet. */
export function needsInstall(root, dest) {
  if (!fs.existsSync(path.join(dest, 'node_modules', '.package-lock.json'))) return true;
  return npmDigest(root) !== npmDigest(dest);
}

export function ajvMajor(dir) {
  try { return Number(JSON.parse(fs.readFileSync(path.join(dir, 'node_modules/ajv/package.json'), 'utf8')).version.split('.')[0]); } catch { return 0; }
}

export function freeBytes(p) {
  const s = fs.statfsSync(p);
  return s.bavail * s.bsize;
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';

function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) {
    console.error('Kullanım: npm run wt:prepare -- <worktree-klasörü> [--dry-run] [--force] [--skip-install]');
    process.exit(2);
  }
  const v = validateWorktree(ROOT, path.resolve(process.cwd(), target));
  if (!v.ok) { console.error('RED: ' + v.reason); process.exit(1); }
  const free = freeBytes(ROOT);
  if (free < MIN_FREE_BYTES) {
    console.error(`RED: boş disk ${mb(free)} < 10 GB.`);
    process.exit(1);
  }
  const plan = buildPlan(ROOT, v.path, { force: flags.has('--force') });
  const total = plan.copy.reduce((a, f) => a + f.size, 0);
  if (flags.has('--dry-run')) {
    const groups = new Map();
    for (const f of plan.copy) {
      const k = f.rel.split(path.sep).slice(0, 3).join('/');
      const g = groups.get(k) || { n: 0, size: 0 };
      g.n++; g.size += f.size; groups.set(k, g);
    }
    console.log('DRY-RUN — kopyalanacak:');
    for (const [k, g] of groups) console.log(`  ${k}  ${g.n} dosya  ${mb(g.size)}`);
    console.log(`Toplam: ${plan.copy.length} dosya, ${mb(total)}; atlanan: ${plan.skipped.length}`);
    console.log('node_modules: APFS klonu (cp -c); npm install yalnız bağımlılık özeti farklıysa; ajv@8 yoksa --no-save kurulur' + (flags.has('--skip-install') ? ' (--skip-install: atlanır)' : ''));
    return;
  }
  const clone = probeClone(v.path);
  const t0 = Date.now();
  applyPlan(ROOT, v.path, plan);
  const byWhy = plan.skipped.reduce((m, s) => ((m[s.why] = (m[s.why] || 0) + 1), m), {});
  console.log(`Kopyalanan: ${plan.copy.length} dosya, ${mb(total)}; atlanan: ${JSON.stringify(byWhy)}`);
  if (fs.existsSync(path.join(ROOT, 'node_modules'))) {
    const r = cloneTree(path.join(ROOT, 'node_modules'), path.join(v.path, 'node_modules'));
    const removed = scrubDenied(path.join(v.path, 'node_modules'));
    console.log(`node_modules ${r.clone ? 'klonlandı' : 'kopyalandı'} (kara liste temizliği: ${removed} öğe)`);
  }
  console.log(`klon: ${clone ? 'evet' : 'hayır'} (${((Date.now() - t0) / 1000).toFixed(1)} sn)`);
  if (sha(path.join(ROOT, 'composer.lock')) !== sha(path.join(v.path, 'composer.lock'))) {
    console.warn('UYARI: composer.lock ana depodan farklı; vendor kopyası eski olabilir (composer install gerekebilir).');
  }
  if (!flags.has('--skip-install')) {
    const run = (a) => {
      const r = spawnSync('npm', a, { cwd: v.path, stdio: 'inherit' });
      if (r.status !== 0) { console.error('npm ' + a.join(' ') + ' başarısız'); process.exit(r.status || 1); }
    };
    if (needsInstall(ROOT, v.path)) run(['install', '--no-package-lock', '--legacy-peer-deps']);
    else console.log('npm install atlandı (bağımlılık özeti aynı)');
    if (ajvMajor(v.path) !== 8) run(['install', 'ajv@8', '--no-save', '--no-package-lock', '--legacy-peer-deps']);
  }
  console.log('Hazır: ' + v.path);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) main();
