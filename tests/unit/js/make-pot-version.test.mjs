/**
 * K1: .pot başlığındaki Project-Id-Version eklenti sürümünden gelir (sabit yazılı sürüm yok).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchHeader, readPluginVersion } from '../../../tools/i18n/make-pot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('readPluginVersion woo-donation-popup.php Version başlığını okur', () => {
  const src = fs.readFileSync(path.join(ROOT, 'woo-donation-popup.php'), 'utf8');
  const expected = src.match(/^\s*\*\s*Version:\s*(\S+)/m)[1];
  assert.equal(readPluginVersion(ROOT), expected);
});

test('patchHeader Project-Id-Version değerini verilen sürümle değiştirir', () => {
  const pot = 'msgid ""\nmsgstr ""\n"Project-Id-Version: eski 1.2.3\\n"\n"MIME-Version: 1.0\\n"\n';
  for (const v of ['11.0.0', '99.1.2']) {
    const out = patchHeader(pot, v);
    assert.ok(out.includes(`"Project-Id-Version: woo-donation-popup ${v}\\n"`));
    assert.ok(!out.includes('eski 1.2.3'));
  }
});

test('make-pot.mjs sürümü sabit yazmaz', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools/i18n/make-pot.mjs'), 'utf8');
  assert.ok(!/Project-Id-Version: woo-donation-popup \d/.test(src));
});
