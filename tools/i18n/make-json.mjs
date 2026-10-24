#!/usr/bin/env node
/**
 * Build WordPress Jed JSON files from .po for editor script handles.
 *
 *   node tools/i18n/make-json.mjs [--po file.po] [--locale tr_TR]
 *   npm run i18n:json
 *
 * Output: languages/woo-donation-popup-<locale>-<handle>.json
 *   { locale_data: { messages: { "": { domain, lang, plural-forms }, "msgid": ["msgstr"] } } }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parsePoEntries } from './merge-po.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WDP_I18N_ROOT
  ? path.resolve(process.env.WDP_I18N_ROOT)
  : path.resolve(__dirname, '../..');

const DOMAIN = 'woo-donation-popup';

/** handle → relative JS source (wp.i18n). */
export const HANDLE_SOURCES = {
  'wdp-block-donation-form': 'blocks/donation-form/index.js',
  'wdp-block-donations': 'blocks/donations/index.js',
  'wdp-elementor-editor': 'assets/js/elementor-editor.js',
};

const CALL_RE =
  /(?:^|[^\w.$])(__|_x)\s*\(\s*(['"])((?:\\.|(?!\2).)*)\2(?:\s*,\s*(['"])((?:\\.|(?!\4).)*)\4)?(?:\s*,\s*(['"])((?:\\.|(?!\6).)*)\6)?\s*\)/g;

function unescapeStr(s) {
  return s.replace(/\\(['"\\nrt])/g, (_, ch) => {
    if (ch === 'n') return '\n';
    if (ch === 'r') return '\r';
    if (ch === 't') return '\t';
    return ch;
  });
}

/**
 * @param {string} source
 * @returns {Array<{ fn: string, msg: string, ctx: string }>}
 */
export function extractWpI18nCalls(source) {
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

function readPoMap(poFiles) {
  const map = new Map();
  for (const f of poFiles) {
    const abs = path.resolve(ROOT, f);
    if (!fs.existsSync(abs)) continue;
    for (const e of parsePoEntries(fs.readFileSync(abs, 'utf8'))) {
      if (!e.msgid) continue;
      map.set(`${e.msgctxt || ''}\u0004${e.msgid}`, e);
    }
  }
  return map;
}

function defaultPoFiles() {
  const files = [path.join(ROOT, 'languages/woo-donation-popup-tr_TR.po')];
  const parts = path.join(ROOT, 'languages/parts');
  if (fs.existsSync(parts)) {
    for (const n of fs.readdirSync(parts).sort()) {
      if (n.endsWith('.po')) files.push(path.join(parts, n));
    }
  }
  return files;
}

function jedKey(msg, ctx) {
  return ctx ? `${ctx}\u0004${msg}` : msg;
}

/**
 * @param {{ root?: string, po?: string[], locale?: string, outDir?: string }} opts
 */
export function makeJson(opts = {}) {
  const root = opts.root ? path.resolve(opts.root) : ROOT;
  const locale = opts.locale || 'tr_TR';
  const outDir = opts.outDir || path.join(root, 'languages');
  const poFiles = (opts.po && opts.po.length ? opts.po : defaultPoFiles()).map((p) => path.resolve(root, p));
  const po = readPoMap(poFiles);
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const [handle, rel] of Object.entries(HANDLE_SOURCES)) {
    const srcPath = path.join(root, rel);
    const calls = fs.existsSync(srcPath) ? extractWpI18nCalls(fs.readFileSync(srcPath, 'utf8')) : [];
    /** @type {Record<string, string[] | { domain: string, lang: string, 'plural-forms': string }>} */
    const messages = {
      '': {
        domain: 'messages',
        lang: locale,
        'plural-forms': 'nplurals=2; plural=(n > 1);',
      },
    };
    let count = 0;
    for (const c of calls) {
      const e = po.get(`${c.ctx || ''}\u0004${c.msg}`);
      if (!e || !e.msgstr) continue;
      messages[jedKey(c.msg, c.ctx)] = [e.msgstr];
      count += 1;
    }
    const payload = {
      'translation-revision-date': new Date().toISOString(),
      generator: 'WDP make-json',
      source: rel,
      domain: 'messages',
      locale_data: { messages },
    };
    const out = path.join(outDir, `${DOMAIN}-${locale}-${handle}.json`);
    fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    written.push({ handle, file: path.relative(root, out), strings: count });
  }
  return { ok: true, written };
}

function parseArgs(argv) {
  const a = argv.filter((x) => x !== '--');
  const out = { po: [], locale: 'tr_TR' };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--po') out.po = String(a[++i] || '').split(',').filter(Boolean);
    else if (a[i] === '--locale') out.locale = String(a[++i] || 'tr_TR');
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const r = makeJson(args);
  for (const w of r.written) {
    console.log(`i18n:json ${w.file} (${w.strings} msgid)`);
  }
}
