#!/usr/bin/env node
/**
 * JS i18n doğrulama.
 *
 *  --scan <dosya|klasör,...>   JS dizgilerinde (yorum satırları HARİÇ) Türkçe harf/sözcük içerenleri listeler;
 *                              varsa çıkış 1 (dönüşüm bitince 0 olmalı).
 *  --map  <js-<kod>.json,...>  Eşleme dosyalarını (tools/i18n/golden/js-*.json) .po ile karşılaştırır:
 *      her girdi {file, tr, en, ctx?}: (1) po'da (ctx,en) → msgstr === tr BİREBİR; (2) dosyada en metni
 *      WDPApp.i18n.__/_x çağrısında geçer; (3) dosyada tr dizgisi artık dizgi olarak kalmaz.
 *
 *   node tools/i18n/verify-js.mjs --scan assets/js/src
 *   node tools/i18n/verify-js.mjs --map tools/i18n/golden/js-J1.json --po languages/parts/J1.po
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parsePoEntries } from './merge-po.mjs';
import { looksTurkish } from './verify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WDP_I18N_ROOT
  ? path.resolve(process.env.WDP_I18N_ROOT)
  : path.resolve(__dirname, '../..');

/**
 * Yorumları atlayarak JS dizgi değişmezlerini çıkarır.
 * @param {string} src
 * @returns {Array<{ text: string, line: number }>}
 */
export function extractJsStrings(src) {
  const out = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '\n') {
      line += 1;
      i += 1;
    } else if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i += 1;
    } else if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line += 1;
        i += 1;
      }
      i += 2;
    } else if (c === '"' || c === "'" || c === '`') {
      const q = c;
      const startLine = line;
      let buf = '';
      i += 1;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') {
          buf += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (src[i] === '\n') line += 1;
        buf += src[i];
        i += 1;
      }
      i += 1;
      out.push({ text: buf, line: startLine });
    } else if (c === '/' && /[=(,:;!&|?{}\[\n]\s*$/.test(src.slice(Math.max(0, i - 3), i)) === true) {
      // olası regex değişmezi: sonuna kadar atla
      i += 1;
      while (i < n && src[i] !== '/' && src[i] !== '\n') {
        if (src[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
    } else {
      i += 1;
    }
  }
  return out;
}

function listJs(target) {
  const full = path.resolve(ROOT, target);
  if (!fs.existsSync(full)) return [];
  const st = fs.statSync(full);
  if (st.isFile()) return [full];
  const res = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.js$/.test(e.name) && !/\.min\.js$/.test(e.name)) res.push(p);
    }
  };
  walk(full);
  return res;
}

export function scanTurkishStrings(targets) {
  const hits = [];
  for (const t of targets) {
    for (const f of listJs(t)) {
      const src = fs.readFileSync(f, 'utf8');
      for (const s of extractJsStrings(src)) {
        if (looksTurkish(s.text)) {
          hits.push({ file: path.relative(ROOT, f), line: s.line, text: s.text.slice(0, 70) });
        }
      }
    }
  }
  return hits;
}

function readPo(files) {
  const map = new Map();
  for (const f of files) {
    const p = path.resolve(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const e of parsePoEntries(fs.readFileSync(p, 'utf8'))) {
      if (e.msgid) map.set(`${e.msgctxt || ''}\u0004${e.msgid}`, e);
    }
  }
  return map;
}

export function verifyJsMap(mapFiles, poFiles) {
  const po = readPo(poFiles);
  const errors = [];
  let count = 0;
  for (const mf of mapFiles) {
    const j = JSON.parse(fs.readFileSync(path.resolve(ROOT, mf), 'utf8'));
    for (const e of j.entries || []) {
      count += 1;
      const loc = `${e.file}`;
      const key = `${e.ctx || ''}\u0004${e.en}`;
      const p = po.get(key);
      if (!p) {
        errors.push(`po-yok: ${loc} «${String(e.en).slice(0, 50)}»`);
        continue;
      }
      if (p.msgstr !== e.tr) errors.push(`çeviri-farklı: ${loc} «${String(e.en).slice(0, 40)}» po=«${p.msgstr.slice(0, 40)}» altın=«${String(e.tr).slice(0, 40)}»`);
      const full = path.resolve(ROOT, e.file);
      if (!fs.existsSync(full)) {
        errors.push(`dosya-yok: ${loc}`);
        continue;
      }
      const strings = extractJsStrings(fs.readFileSync(full, 'utf8')).map((s) => s.text);
      if (!strings.some((s) => s === e.en || s === String(e.en).replace(/'/g, "\\'") || s === String(e.en).replace(/"/g, '\\"'))) {
        errors.push(`kodda-yok: ${loc} «${String(e.en).slice(0, 50)}» (WDPApp.i18n.__ çağrısı bulunamadı)`);
      }
      if (e.tr !== e.en && strings.some((s) => s === e.tr)) {
        errors.push(`turkce-kaldi: ${loc} «${String(e.tr).slice(0, 50)}»`);
      }
    }
  }
  return { ok: errors.length === 0, errors, count };
}

function parseArgs(argv) {
  const a = argv.filter((x) => x !== '--');
  const out = { scan: [], map: [], po: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--scan') out.scan = String(a[++i] || '').split(',').filter(Boolean);
    else if (a[i] === '--map') out.map = String(a[++i] || '').split(',').filter(Boolean);
    else if (a[i] === '--po') out.po = String(a[++i] || '').split(',').filter(Boolean);
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  let bad = 0;
  if (args.scan.length) {
    const hits = scanTurkishStrings(args.scan);
    console.log(`verify-js --scan: ${hits.length} Türkçe dizgi`);
    for (const h of hits.slice(0, 100)) console.log(`  ✗ ${h.file}:${h.line} «${h.text}»`);
    if (hits.length) bad += 1;
  }
  if (args.map.length) {
    const po = args.po.length ? args.po : ['languages/woo-donation-popup-tr_TR.po'];
    const r = verifyJsMap(args.map, po);
    console.log(`verify-js --map: ${r.count} girdi, ${r.errors.length} hata`);
    for (const e of r.errors.slice(0, 100)) console.log(`  ✗ ${e}`);
    if (!r.ok) bad += 1;
  }
  console.log(bad ? 'verify-js KIRMIZI' : 'verify-js TEMİZ');
  process.exit(bad ? 1 : 0);
}
