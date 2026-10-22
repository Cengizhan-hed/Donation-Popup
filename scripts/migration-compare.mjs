#!/usr/bin/env node
/**
 * İki anlık görüntüyü karşılaştırır. Raporda değer yok.
 *
 *   node scripts/migration-compare.mjs --before a.json --after b.json --out build/migration/compare-x.md
 * Çıkış 2: KAYBOLDU / VARSAYILANA DÖNDÜ / DEĞİŞTİ > 0 (TAŞINDI hariç)
 * --idempotent: birebir aynı değilse 2
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../tests/e2e/helpers/env-root.mjs';
import { extractRemapTable } from './lib/migration-keys.mjs';
import {
  compareSnapshots,
  compareIdempotent,
  formatCompareMarkdown,
} from './lib/migration-compare-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

/**
 * @param {string[]} argv
 */
export function parseCompareArgs(argv) {
  const a = argv.filter((x) => x !== '--');
  const out = {
    before: '',
    after: '',
    out: '',
    migrations: path.join(ROOT, 'includes/class-migrations.php'),
    defaults: '',
    idempotent: false,
    title: '',
  };
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--before') out.before = String(a[++i] || '');
    else if (x === '--after') out.after = String(a[++i] || '');
    else if (x === '--out') out.out = String(a[++i] || '');
    else if (x === '--migrations') out.migrations = String(a[++i] || out.migrations);
    else if (x === '--defaults') out.defaults = String(a[++i] || '');
    else if (x === '--idempotent') out.idempotent = true;
    else if (x === '--title') out.title = String(a[++i] || '');
  }
  return out;
}

function loadJson(file) {
  const p = path.resolve(file);
  if (!fs.existsSync(p)) throw new Error(`JSON yok: ${file}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * @param {ReturnType<typeof parseCompareArgs>} args
 */
export function runCompare(args) {
  if (!args.before || !args.after) {
    throw new Error('Kullanım: --before <json> --after <json> [--out md] [--idempotent]');
  }
  const before = loadJson(args.before);
  const after = loadJson(args.after);
  let remap = {};
  if (args.migrations && fs.existsSync(args.migrations)) {
    remap = extractRemapTable(fs.readFileSync(args.migrations, 'utf8'));
  }
  /** @type {Record<string, unknown>} */
  let defaults = {};
  /** @type {Record<string, unknown>} */
  let fieldDefaults = {};
  if (args.defaults && fs.existsSync(args.defaults)) {
    const d = JSON.parse(fs.readFileSync(args.defaults, 'utf8'));
    defaults = d.defaults || d.options || d;
    fieldDefaults = d.fieldDefaults || {};
  }
  const result = args.idempotent
    ? compareIdempotent(before, after)
    : compareSnapshots(before, after, { remap, defaults, fieldDefaults });

  const md = formatCompareMarkdown(result, {
    title: args.title || (args.idempotent ? 'İdempotent göç karşılaştırması' : 'Göç karşılaştırması'),
    beforeLabel: args.before,
    afterLabel: args.after,
  });
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, md, 'utf8');
    console.log(`yazıldı: ${args.out}`);
  } else {
    console.log(md);
  }
  const counts = result.counts;
  console.log(
    `sayılar: KORUNDU=${counts.KORUNDU} TAŞINDI=${counts.TAŞINDI} DEĞİŞTİ=${counts.DEĞİŞTİ} VARSAYILANA DÖNDÜ=${counts['VARSAYILANA DÖNDÜ']} KAYBOLDU=${counts.KAYBOLDU} YENİ=${counts.YENİ}`
  );
  if (result.problems.length) {
    console.log('sorunlu:');
    for (const r of result.problems) {
      console.log(`- ${r.class} ${r.key} ${r.beforeHash} → ${r.afterHash}`);
    }
  }
  return result;
}

function main() {
  try {
    const args = parseCompareArgs(process.argv.slice(2));
    const result = runCompare(args);
    if (result.fail) process.exit(2);
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
