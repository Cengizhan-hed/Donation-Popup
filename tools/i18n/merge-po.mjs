#!/usr/bin/env node
/**
 * Merge languages/parts/*.po → languages/woo-donation-popup-tr_TR.po.
 * Same msgid with different msgstr → ÇAKIŞMA (exit 1).
 *
 *   node tools/i18n/merge-po.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WDP_I18N_ROOT
  ? path.resolve(process.env.WDP_I18N_ROOT)
  : path.resolve(__dirname, '../..');
const PARTS = path.join(ROOT, 'languages/parts');
const OUT = path.join(ROOT, 'languages/woo-donation-popup-tr_TR.po');

function unescapePo(s) {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function escapePo(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * @param {string} src
 * @returns {Array<{ comments: string, msgctxt: string, msgid: string, msgidPlural: string, msgstr: string, msgstrPlural: string[] }>}
 */
export function parsePoEntries(src) {
  const entries = [];
  const blocks = src.replace(/^\uFEFF/, '').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n');
    let comments = [];
    let msgctxt = '';
    let msgid = null;
    let msgidPlural = '';
    let msgstr = '';
    /** @type {string[]} */
    const msgstrPlural = [];
    let field = '';
    const take = (raw) => {
      const m = raw.match(/^"(.*)"$/);
      return m ? unescapePo(m[1]) : '';
    };
    for (const line of lines) {
      if (line.startsWith('#')) {
        comments.push(line);
        continue;
      }
      const head = line.match(/^(msgctxt|msgid_plural|msgid|msgstr\[(\d+)\]|msgstr)\s+(.*)$/);
      if (head) {
        field = head[1];
        const val = take(head[3]);
        if (field === 'msgctxt') msgctxt = val;
        else if (field === 'msgid') msgid = val;
        else if (field === 'msgid_plural') msgidPlural = val;
        else if (field === 'msgstr') msgstr = val;
        else if (field.startsWith('msgstr[')) {
          const idx = Number(head[2]);
          msgstrPlural[idx] = val;
        }
        continue;
      }
      if (field && /^".*"$/.test(line)) {
        const extra = take(line);
        if (field === 'msgctxt') msgctxt += extra;
        else if (field === 'msgid') msgid = (msgid || '') + extra;
        else if (field === 'msgid_plural') msgidPlural += extra;
        else if (field === 'msgstr') msgstr += extra;
        else if (field.startsWith('msgstr[')) {
          const idx = Number(field.match(/\[(\d+)\]/)[1]);
          msgstrPlural[idx] = (msgstrPlural[idx] || '') + extra;
        }
      }
    }
    if (msgid === null) continue;
    entries.push({
      comments: comments.join('\n'),
      msgctxt,
      msgid,
      msgidPlural,
      msgstr,
      msgstrPlural,
    });
  }
  return entries;
}

function entryKey(e) {
  return (e.msgctxt ? e.msgctxt + '\u0004' : '') + e.msgid;
}

function formatEntry(e) {
  const lines = [];
  if (e.comments) lines.push(e.comments);
  if (e.msgctxt) lines.push(`msgctxt "${escapePo(e.msgctxt)}"`);
  lines.push(`msgid "${escapePo(e.msgid)}"`);
  if (e.msgidPlural) {
    lines.push(`msgid_plural "${escapePo(e.msgidPlural)}"`);
    const n = Math.max(2, e.msgstrPlural.length);
    for (let i = 0; i < n; i += 1) {
      lines.push(`msgstr[${i}] "${escapePo(e.msgstrPlural[i] || '')}"`);
    }
  } else {
    lines.push(`msgstr "${escapePo(e.msgstr)}"`);
  }
  return lines.join('\n');
}

function headerPo() {
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '+0000');
  return `# Turkish translation for woo-donation-popup.
# Copyright (C) WooCommerce Donation Panel
msgid ""
msgstr ""
"Project-Id-Version: woo-donation-popup\\n"
"Report-Msgid-Bugs-To: \\n"
"POT-Creation-Date: ${now}\\n"
"PO-Revision-Date: ${now}\\n"
"Last-Translator: \\n"
"Language-Team: \\n"
"Language: tr_TR\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Text-Domain: woo-donation-popup\\n"
"Plural-Forms: nplurals=2; plural=(n > 1);\\n"
`;
}

export function mergeParts(partFiles) {
  /** @type {Map<string, { entry: object, files: string[] }>} */
  const map = new Map();
  /** @type {string[]} */
  const conflicts = [];
  for (const file of partFiles) {
    const src = fs.readFileSync(file, 'utf8');
    for (const e of parsePoEntries(src)) {
      if (e.msgid === '') continue;
      const key = entryKey(e);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { entry: e, files: [path.basename(file)] });
        continue;
      }
      const same =
        prev.entry.msgstr === e.msgstr &&
        JSON.stringify(prev.entry.msgstrPlural) === JSON.stringify(e.msgstrPlural);
      if (!same) {
        conflicts.push(
          `ÇAKIŞMA msgid=${JSON.stringify(e.msgid)} ctx=${JSON.stringify(e.msgctxt)} files=${prev.files.join(',')},${path.basename(file)}`
        );
      } else {
        prev.files.push(path.basename(file));
      }
    }
  }
  return { map, conflicts };
}

function main() {
  if (!fs.existsSync(PARTS)) fs.mkdirSync(PARTS, { recursive: true });
  const files = fs
    .readdirSync(PARTS)
    .filter((n) => n.endsWith('.po'))
    .map((n) => path.join(PARTS, n))
    .sort();
  const { map, conflicts } = mergeParts(files);
  if (conflicts.length) {
    console.error(conflicts.join('\n'));
    process.exit(1);
  }
  const body = [...map.values()]
    .map((x) => x.entry)
    .sort((a, b) => entryKey(a).localeCompare(entryKey(b)))
    .map(formatEntry)
    .join('\n\n');
  fs.writeFileSync(OUT, headerPo() + (body ? '\n' + body + '\n' : ''), 'utf8');
  console.log(`wrote languages/woo-donation-popup-tr_TR.po (${map.size} msgid, ${files.length} part)`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    main();
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}
