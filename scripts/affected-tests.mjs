#!/usr/bin/env node
/**
 * E8Z: etkilenen testler. Değişen dosyalardan (git diff <base>...HEAD + çalışma ağacı) hangi PHPUnit /
 * JS birim / e2e koşucusunun çalışması gerektiğini hesaplar.
 *
 *   npm run test:affected [-- --base ikram-ortam] [--print|--run] [--json] [--no-e2e]
 *
 * ÖNEMLİ: Bu betik AJAN İÇİ HIZLANDIRICIDIR, merge kapısı DEĞİLDİR. Merge öncesi tam paket
 * (verify + test + e2e) yine koşar. Emin olunmayan her durumda daha ÇOK test seçilir.
 *
 * Eşleme: (a) ters bağımlılık yürüyüşü (PHP sınıf adı / use / require / kanca adı, JS import /
 * dosya yolu anması; varsa build/graph/graph.json dosya kenarları da eklenir), (b) scripts/lib/test-map.json
 * yol deseni -> e2e koşucuları. Haritaya düşmeyen dosya -> tüm PHPUnit + JS + e2e:quick.
 * Yalnız yerel; uzak komut yok. e2e koşuları `npm run e2e:queue --` üzerinden (--env local).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_PATH = path.join(ROOT, 'scripts/lib/test-map.json');
const GRAPH_PATH = path.join(ROOT, 'build/graph/graph.json');

const SCAN_DIRS = ['src', 'includes', 'assets/src', 'assets/js', 'templates', 'blocks', 'scripts', 'tests/unit', 'tests/e2e'];
const SCAN_ROOT_FILES = ['woo-donation-popup.php', 'uninstall.php'];
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'vendor-dev', 'build', '.git', '__baseline__', '__baseline_prev__', 'fixtures', 'golden']);
const MAX_DEPTH = 3;

const isPhpTest = (f) => /^tests\/unit\/.*Test\.php$/.test(f);
const isJsTest = (f) => /^tests\/unit\/js\/.*\.test\.mjs$/.test(f);

/** Basit glob -> RegExp: ** her derinlik, * tek klasör düzeyi. */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if ('.+?^${}()|[]\\'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

export function loadMap(p = MAP_PATH) {
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  m.rules = m.rules.map((r) => ({ ...r, re: globToRegExp(r.pattern) }));
  return m;
}

function walk(dir, out, root) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out, root);
    else if (/\.(php|mjs|js|cjs|css)$/.test(e.name) && !/\.min\.js$/.test(e.name)) out.push(rel);
  }
}

export function listSources(root = ROOT) {
  const out = [];
  for (const d of SCAN_DIRS) walk(d, out, root);
  for (const f of SCAN_ROOT_FILES) if (fs.existsSync(path.join(root, f))) out.push(f);
  return out;
}

const GENERIC_NAMES = new Set(['Test', 'TestCase', 'Exception', 'Plugin', 'Settings', 'Core', 'Admin', 'Http', 'Helper', 'Fake']);

/** Dosyadan: bildirilen sembol/kanca adları ve başvurduğu sembol/yol/kanca belirteçleri. */
export function analyseFile(rel, text) {
  const declares = new Set();
  const hooks = new Set();
  const refs = new Set();
  const pathRefs = new Set();
  if (rel.endsWith('.php')) {
    for (const m of text.matchAll(/^\s*(?:abstract\s+|final\s+)*(?:class|interface|trait|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) declares.add(m[1]);
    for (const m of text.matchAll(/^\s*function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)) {
      if (m[1].length > 8) declares.add(m[1]);
    }
    for (const m of text.matchAll(/\b[A-Za-z_][A-Za-z0-9_]{3,}\b/g)) refs.add(m[0]);
    for (const m of text.matchAll(/(?:add_action|add_filter|do_action|apply_filters)\(\s*['"]([^'"]+)['"]/g)) {
      if (/^(wdp_|donation_panel|woo_donation)/.test(m[1])) hooks.add(m[1]);
    }
  } else if (!rel.endsWith('.css')) {
    for (const m of text.matchAll(/^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z_$][\w$]*)/gm)) declares.add(m[1]);
    for (const m of text.matchAll(/\b[A-Za-z_][A-Za-z0-9_]{3,}\b/g)) refs.add(m[0]);
  }
  if (!rel.endsWith('.css')) for (const m of text.matchAll(/(?:from|import|require)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) pathRefs.add(m[1]);
  return { declares, hooks, refs, pathRefs };
}

/**
 * Ters bağımlılık grafiği: kenar a -> b  = "a, b'ye dayanır" (b değişirse a etkilenir).
 * Dönen: Map<b, Set<a>> (dependents).
 */
export function buildDependents(root = ROOT, files = listSources(root), { useGraph = true } = {}) {
  const info = new Map();
  const texts = new Map();
  for (const f of files) {
    let t = '';
    try {
      t = fs.readFileSync(path.join(root, f), 'utf8');
    } catch {
      continue;
    }
    texts.set(f, t);
    info.set(f, analyseFile(f, t));
  }
  const declaredBy = new Map();
  const hookBy = new Map();
  for (const [f, a] of info) {
    for (const d of a.declares) {
      if (GENERIC_NAMES.has(d)) continue;
      if (!declaredBy.has(d)) declaredBy.set(d, new Set());
      declaredBy.get(d).add(f);
    }
    for (const h of a.hooks) {
      if (!hookBy.has(h)) hookBy.set(h, new Set());
      hookBy.get(h).add(f);
    }
  }
  const dependents = new Map();
  const add = (b, a) => {
    if (a === b) return;
    if (!dependents.has(b)) dependents.set(b, new Set());
    dependents.get(b).add(a);
  };
  const baseKey = (f) => path.posix.basename(f);
  for (const [f, a] of info) {
    for (const r of a.refs) {
      const ds = declaredBy.get(r);
      if (ds) for (const b of ds) add(b, f);
    }
    for (const h of a.hooks) for (const b of hookBy.get(h) || []) add(b, f);
    for (const p of a.pathRefs) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), p));
      for (const cand of [target, `${target}.mjs`, `${target}.js`, `${target}.php`, `${target}/index.mjs`]) if (info.has(cand)) add(cand, f);
    }
  }
  // Dosya yolu anması: testler/betikler kaynak dosyayı yolla okuyabilir (fs.readFileSync('assets/js/x.js'), require).
  const testLike = [...info.keys()].filter((f) => f.startsWith('tests/') || f.startsWith('scripts/'));
  for (const f of testLike) {
    const t = texts.get(f);
    for (const b of info.keys()) {
      if (b === f) continue;
      const bn = baseKey(b);
      if (bn.length < 6) continue;
      if (t.includes(b) || (t.includes(bn) && !/^(index|base|logic|store|form)\./.test(bn))) add(b, f);
    }
  }
  if (useGraph) {
    try {
      const g = JSON.parse(fs.readFileSync(path.join(root, 'build/graph/graph.json'), 'utf8'));
      const byId = new Map(g.nodes.map((n) => [n.id, n.source_file]));
      for (const l of g.links || []) {
        const a = byId.get(l.source);
        const b = byId.get(l.target);
        if (a && b && a !== b && info.has(a) && info.has(b)) add(b, a);
      }
    } catch {
      /* graph yok/eski: kendi taramamız yeterli */
    }
  }
  return dependents;
}

/** Değişen dosyadan ters yürüyüşle ulaşılan tüm dosyalar (MAX_DEPTH adım). */
export function reverseWalk(changed, dependents, maxDepth = MAX_DEPTH) {
  const seen = new Map(changed.map((c) => [c, 0]));
  let frontier = [...changed];
  for (let d = 1; d <= maxDepth; d++) {
    const next = [];
    for (const f of frontier) {
      for (const a of dependents.get(f) || []) {
        if (!seen.has(a)) {
          seen.set(a, d);
          next.push(a);
        }
      }
    }
    frontier = next;
  }
  return seen;
}

/**
 * Saf hesap. files: değişen yollar (repo köküne göre, /). ctx: { map, dependents, allFiles }.
 * Dönen: { phpunit:{all,files,dirs}, js:{all,files}, e2e:[...], reasons:[], unmapped:[], ignored:[] }
 */
export function computeAffected(files, ctx) {
  const { map, dependents, allFiles } = ctx;
  const res = { phpunit: { all: false, files: new Set(), dirs: new Set() }, js: { all: false, files: new Set() }, e2e: new Set(), reasons: [], unmapped: [], ignored: [] };
  const live = [];
  for (const f of files) {
    const rules = map.rules.filter((r) => r.re.test(f));
    if (rules.length && rules.every((r) => r.ignore)) {
      res.ignored.push(f);
      continue;
    }
    if (!rules.length) {
      res.unmapped.push(f);
      res.reasons.push(`${f}: haritada yok -> güvenli varsayılan (tüm PHPUnit + JS + ${map.safeDefault.e2e.join(', ')})`);
      continue;
    }
    live.push(f);
    for (const r of rules) {
      (r.e2e || []).forEach((e) => res.e2e.add(e));
      (r.phpunit || []).forEach((d) => res.phpunit.dirs.add(d));
      res.reasons.push(`${f}: ${r.reason}${r.e2e ? ` -> ${r.e2e.join(', ')}` : ''}`);
    }
  }
  if (res.unmapped.length) {
    res.phpunit.all = true;
    res.js.all = true;
    map.safeDefault.e2e.forEach((e) => res.e2e.add(e));
  }
  const walked = reverseWalk(live, dependents);
  for (const [f, depth] of walked) {
    if (isPhpTest(f)) {
      res.phpunit.files.add(f);
      if (depth > 0 && !live.includes(f)) res.reasons.push(`${f}: ${depth}. adımda bağımlı PHPUnit`);
    } else if (isJsTest(f)) {
      res.js.files.add(f);
      if (depth > 0 && !live.includes(f)) res.reasons.push(`${f}: ${depth}. adımda bağımlı JS birim`);
    } else if (f.startsWith('tests/e2e/') && depth > 0) {
      // e2e yardımcı/koşucu dosyası bağımlı: koşucu adını eşleme tablosundan bul
      for (const r of map.rules) if (r.e2e && r.re.test(f)) r.e2e.forEach((e) => res.e2e.add(e));
    }
  }
  // Elle PHPUnit dizinleri: o dizindeki tüm testler
  for (const d of res.phpunit.dirs) {
    for (const f of allFiles) if (isPhpTest(f) && f.startsWith(`${d}/`)) res.phpunit.files.add(f);
  }
  return res;
}

export function gitChanged(base, root = ROOT) {
  const out = new Set();
  const run = (args) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null;
  };
  const committed = run(['diff', '--name-only', `${base}...HEAD`]);
  (committed || []).forEach((f) => out.add(f));
  const porcelain = run(['status', '--porcelain', '--untracked-files=all']) || [];
  for (const line of porcelain) {
    let p = line.slice(3);
    if (p.includes(' -> ')) p = p.split(' -> ')[1];
    out.add(p.replace(/^"|"$/g, ''));
  }
  return { files: [...out].filter((f) => !f.startsWith('test-results/') && !f.startsWith('node_modules/')), baseOk: committed !== null };
}

export function formatReport(res) {
  const lines = [];
  lines.push('ETKİLENEN TESTLER (ajan içi hızlandırıcı; merge kapısı DEĞİL — tam paket kapıda yine koşar)');
  lines.push(`PHPUnit : ${res.phpunit.all ? 'TÜMÜ' : `${res.phpunit.files.size} dosya`}`);
  if (!res.phpunit.all) for (const f of [...res.phpunit.files].sort()) lines.push(`  - ${f}`);
  lines.push(`JS birim: ${res.js.all ? 'TÜMÜ' : `${res.js.files.size} dosya`}`);
  if (!res.js.all) for (const f of [...res.js.files].sort()) lines.push(`  - ${f}`);
  lines.push(`e2e     : ${res.e2e.size ? [...res.e2e].sort().join(', ') : '(yok)'}`);
  lines.push('Gerekçe :');
  for (const r of res.reasons.slice(0, 40)) lines.push(`  * ${r}`);
  if (res.reasons.length > 40) lines.push(`  * ... +${res.reasons.length - 40} satır`);
  if (res.ignored.length) lines.push(`Yok sayılan (belge vb.): ${res.ignored.length} dosya`);
  return lines.join('\n');
}

export function toPlain(res) {
  return { phpunit: { all: res.phpunit.all, files: [...res.phpunit.files].sort() }, js: { all: res.js.all, files: [...res.js.files].sort() }, e2e: [...res.e2e].sort(), reasons: res.reasons, unmapped: res.unmapped, ignored: res.ignored };
}

function runCmd(cmd, args, env = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  return spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } }).status ?? 1;
}

function main() {
  const argv = process.argv.slice(2);
  const bi = argv.indexOf('--base');
  const base = bi >= 0 ? argv[bi + 1] : 'ikram-ortam';
  const doRun = argv.includes('--run');
  const json = argv.includes('--json');
  const { files, baseOk } = gitChanged(base);
  if (!baseOk) console.error(`Uyarı: '${base}' dalı bulunamadı; yalnız çalışma ağacı değişiklikleri kullanıldı.`);
  const map = loadMap();
  const allFiles = listSources();
  const res = computeAffected(files, { map, dependents: buildDependents(ROOT, allFiles), allFiles });
  if (json) {
    console.log(JSON.stringify(toPlain(res), null, 2));
  } else {
    console.log(`Değişen dosya: ${files.length} (taban: ${base})`);
    console.log(formatReport(res));
  }
  if (!doRun) return;
  let fail = 0;
  const php = res.phpunit.all ? [] : [...res.phpunit.files].sort();
  if (res.phpunit.all) fail += runCmd('php', ['vendor/bin/phpunit', '-c', 'phpunit.xml.dist']) ? 1 : 0;
  else for (const f of php) fail += runCmd('php', ['vendor/bin/phpunit', '-c', 'phpunit.xml.dist', f]) ? 1 : 0;
  const js = res.js.all ? fs.readdirSync(path.join(ROOT, 'tests/unit/js')).filter((f) => f.endsWith('.test.mjs')).map((f) => `tests/unit/js/${f}`) : [...res.js.files].sort();
  if (js.length) fail += runCmd('node', ['--test', ...js], { WDP_UNIT_TEST: '1' }) ? 1 : 0;
  if (!argv.includes('--no-e2e')) {
    for (const e of [...res.e2e].sort()) fail += runCmd('npm', ['run', 'e2e:queue', '--', 'npm', 'run', e, '--', '--env', 'local']) ? 1 : 0;
  }
  console.log(fail ? `\nBAŞARISIZ komut sayısı: ${fail}` : '\nEtkilenen testler yeşil (kapı değil; merge öncesi tam paket koşar).');
  process.exit(fail ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
