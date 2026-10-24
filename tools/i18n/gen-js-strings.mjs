#!/usr/bin/env node
/**
 * Scan JS sources for WDPApp.i18n.__ / _x and rewrite the PHP dictionary region.
 *
 *   node tools/i18n/gen-js-strings.mjs
 *   node tools/i18n/gen-js-strings.mjs --check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WDP_I18N_ROOT
  ? path.resolve(process.env.WDP_I18N_ROOT)
  : path.resolve(__dirname, '../..');
const PHP_FILE = path.join(ROOT, 'includes/i18n/class-wdp-js-i18n.php');
const BEGIN = '// BEGIN WDP_JS_I18N';
const END = '// END WDP_JS_I18N';
const DOMAIN = 'woo-donation-popup';

const CALL_RE =
  /WDPApp\.i18n\.(__|_x)\s*\(\s*(['"])((?:\\.|(?!\2).)*)\2(?:\s*,\s*(['"])((?:\\.|(?!\4).)*)\4)?(?:\s*,\s*(['"])((?:\\.|(?!\6).)*)\6)?\s*\)/g;

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === 'build') continue;
      walkJs(abs, out);
      continue;
    }
    if (name.isFile() && name.name.endsWith('.js')) out.push(abs);
  }
  return out;
}

function unescapeStr(s) {
  return s.replace(/\\(['"\\nrt])/g, (_, ch) => {
    if (ch === 'n') return '\n';
    if (ch === 'r') return '\r';
    if (ch === 't') return '\t';
    return ch;
  });
}

function phpSingle(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

export function extractJsI18nCalls(source) {
  const found = [];
  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(source))) {
    const fn = m[1];
    const a = unescapeStr(m[3] || '');
    const b = m[5] != null ? unescapeStr(m[5]) : '';
    const c = m[7] != null ? unescapeStr(m[7]) : '';
    if (fn === '_x') {
      found.push({ fn, msg: a, ctx: b, domain: c || DOMAIN });
    } else {
      found.push({ fn, msg: a, ctx: '', domain: b || DOMAIN });
    }
  }
  return found;
}

function collectCalls(root = ROOT) {
  const files = [
    ...walkJs(path.join(root, 'assets/js/src')),
    ...walkJs(path.join(root, 'assets/js')).filter((f) => !f.includes(`${path.sep}src${path.sep}`) && !f.includes(`${path.sep}build${path.sep}`)),
    ...walkJs(path.join(root, 'blocks')),
  ];
  /** @type {Map<string, { fn: string, msg: string, ctx: string }>} */
  const map = new Map();
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const call of extractJsI18nCalls(src)) {
      if (call.domain && call.domain !== DOMAIN) continue;
      const key = call.ctx ? `${call.ctx}\u0004${call.msg}` : call.msg;
      if (!map.has(key)) map.set(key, { fn: call.fn, msg: call.msg, ctx: call.ctx });
    }
  }
  return [...map.values()].sort((a, b) => {
    const ka = a.ctx ? `${a.ctx}\u0004${a.msg}` : a.msg;
    const kb = b.ctx ? `${b.ctx}\u0004${b.msg}` : b.msg;
    return ka.localeCompare(kb);
  });
}

export function renderPhpRegion(calls) {
  const lines = [BEGIN];
  for (const c of calls) {
    if (c.ctx) {
      const key = `${phpSingle(c.ctx)} . "\\x04" . ${phpSingle(c.msg)}`;
      lines.push(
        `\t\t$out[ ${key} ] = _x(${phpSingle(c.msg)}, ${phpSingle(c.ctx)}, ${phpSingle(DOMAIN)});`
      );
    } else {
      const key = c.msg.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      lines.push(`\t\t$out['${key}'] = __(${phpSingle(c.msg)}, ${phpSingle(DOMAIN)});`);
    }
  }
  lines.push('\t\t' + END);
  return lines.join('\n');
}

function applyRegion(phpSrc, region) {
  const start = phpSrc.indexOf(BEGIN);
  const end = phpSrc.indexOf(END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`class-wdp-js-i18n.php içinde ${BEGIN} / ${END} yok`);
  }
  const endLine = phpSrc.indexOf('\n', end);
  const after = endLine >= 0 ? phpSrc.slice(endLine) : '\n';
  return phpSrc.slice(0, start) + region + after;
}

function currentRegion(phpSrc) {
  const start = phpSrc.indexOf(BEGIN);
  const end = phpSrc.indexOf(END);
  if (start < 0 || end < 0) throw new Error('bölge işaretleri yok');
  const endLine = phpSrc.indexOf('\n', end);
  return phpSrc.slice(start, endLine >= 0 ? endLine : phpSrc.length).trimEnd();
}

export function generate(root = ROOT) {
  const phpPath = path.join(root, 'includes/i18n/class-wdp-js-i18n.php');
  const phpSrc = fs.readFileSync(phpPath, 'utf8');
  const region = renderPhpRegion(collectCalls(root));
  return { phpPath, phpSrc, next: applyRegion(phpSrc, region), region };
}

function main() {
  const check = process.argv.includes('--check');
  const { phpPath, phpSrc, next, region } = generate(ROOT);
  const prev = currentRegion(phpSrc);
  if (prev === region) {
    console.log(check ? 'i18n js-strings: değişmedi' : 'i18n js-strings: güncel');
    return;
  }
  if (check) {
    console.error('i18n js-strings: class-wdp-js-i18n.php bölgesi JS kaynağıyla uyuşmuyor. Çalıştır: node tools/i18n/gen-js-strings.mjs');
    process.exit(1);
  }
  fs.writeFileSync(phpPath, next, 'utf8');
  console.log('i18n js-strings: class-wdp-js-i18n.php güncellendi');
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main();
}
