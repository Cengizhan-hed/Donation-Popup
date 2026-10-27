/**
 * merge-po, i18n-text normalize/compare.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractWpI18nCalls, makeJson, HANDLE_SOURCES } from '../../../tools/i18n/make-json.mjs';
import { parsePoEntries, mergeParts } from '../../../tools/i18n/merge-po.mjs';
import {
  normalizeVisibleText,
  diffScreenLines,
  findTurkishInText,
  extractElementorWidgetStrings,
} from '../../../tests/e2e/helpers/i18n-text.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('merge-po', () => {
  it('aynı msgid farklı msgstr = çakışma', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-po-'));
    const a = path.join(dir, 'A.po');
    const b = path.join(dir, 'B.po');
    fs.writeFileSync(a, 'msgid "Save"\nmsgstr "Kaydet"\n');
    fs.writeFileSync(b, 'msgid "Save"\nmsgstr "Sakla"\n');
    const { conflicts } = mergeParts([a, b]);
    assert.ok(conflicts.some((c) => c.includes('ÇAKIŞMA')));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('aynı çeviri çakışma değildir', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-po-'));
    const a = path.join(dir, 'A.po');
    const b = path.join(dir, 'B.po');
    fs.writeFileSync(a, 'msgid "Save"\nmsgstr "Kaydet"\n');
    fs.writeFileSync(b, 'msgid "Save"\nmsgstr "Kaydet"\n');
    const { conflicts, map } = mergeParts([a, b]);
    assert.equal(conflicts.length, 0);
    assert.equal(map.size, 1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('parsePoEntries msgid okur', () => {
    const entries = parsePoEntries('msgid "Hi"\nmsgstr "Merhaba"\n');
    assert.equal(entries[0].msgid, 'Hi');
    assert.equal(entries[0].msgstr, 'Merhaba');
  });
});

describe('i18n-text', () => {
  it('normalize sayı/tarih/kimlik maskeler', () => {
    const t = normalizeVisibleText('Tutar 1.234,50  2026-10-24  #99 sipariş');
    assert.match(t, /#AMT#|#N#/);
    assert.match(t, /#DATE#/);
  });

  it('satır farklarını listeler', () => {
    const d = diffScreenLines({ lines: ['A', 'B'] }, { lines: ['A', 'C'] });
    assert.equal(d.length, 1);
    assert.match(d[0], /L2/);
  });

  it('Türkçe harf ve sözcük bulur', () => {
    const hit = findTurkishInText('Bağış tutarı Kaydet');
    assert.ok(hit.letters.length > 0);
    assert.ok(hit.words.includes('Bağış'));
    assert.ok(hit.words.includes('Kaydet'));
  });

  it('Elementor get_title kaynaklarını okur', () => {
    const widgets = extractElementorWidgetStrings(ROOT);
    assert.ok(widgets.length >= 2);
    assert.ok(widgets.some((w) => w.title.includes('Bağış')));
  });
});

describe('make-json', () => {
  it('wp.i18n __ / _x çağrılarını tarar', () => {
    const src = `
      const { __, _x } = wp.i18n;
      __('Save', 'woo-donation-popup');
      _x('Open', 'button', 'woo-donation-popup');
    `;
    const calls = extractWpI18nCalls(src);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].msg, 'Save');
    assert.equal(calls[1].ctx, 'button');
  });

  it('handle JSON üretir (locale_data.messages)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-json-'));
    const po = path.join(dir, 't.po');
    fs.writeFileSync(po, 'msgid "Donation form"\nmsgstr "Bağış formu"\n');
    const r = makeJson({ root: ROOT, po: [po], locale: 'tr_TR', outDir: dir });
    assert.ok(r.written.length >= 1);
    const form = r.written.find((w) => w.handle === 'wdp-block-donation-form');
    assert.ok(form);
    const j = JSON.parse(fs.readFileSync(path.join(dir, path.basename(form.file)), 'utf8'));
    assert.ok(j.locale_data && j.locale_data.messages);
    assert.equal(j.locale_data.messages['Donation form'][0], 'Bağış formu');
    assert.ok(HANDLE_SOURCES['wdp-block-donations']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('token-scan', () => {
  it('PHP tokenizer gettext çağrılarını JSON olarak verir', () => {
    const r = spawnSync('php', ['tools/i18n/token-scan.php', ROOT], {
      encoding: 'utf8',
      cwd: ROOT,
      maxBuffer: 32 * 1024 * 1024,
    });
    assert.equal(r.status, 0, r.stderr);
    const data = JSON.parse(r.stdout);
    assert.ok(data.call_count > 0);
    assert.ok(Array.isArray(data.calls));
    assert.ok(data.calls.some((c) => c.function === '__' && c.file.includes('class-pages.php')));
  });
});
