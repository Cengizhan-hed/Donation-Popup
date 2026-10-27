import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyI18n, looksTurkish, tokensOf } from '../../../tools/i18n/verify.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function makeRoot(files, goldenCalls, poText) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-i18n-verify-'));
  fs.mkdirSync(path.join(root, 'tools/i18n/golden'), { recursive: true });
  fs.mkdirSync(path.join(root, 'languages'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'tools/i18n/token-scan.php'), path.join(root, 'tools/i18n/token-scan.php'));
  for (const [f, src] of Object.entries(files)) fs.writeFileSync(path.join(root, f), src);
  fs.writeFileSync(path.join(root, 'tools/i18n/golden/golden-tr-source.json'), JSON.stringify({ calls: goldenCalls }));
  fs.writeFileSync(path.join(root, 'languages/woo-donation-popup-tr_TR.po'), poText);
  return root;
}

const PO = (entries) =>
  `msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n\n` +
  entries.map(([id, str]) => `msgid "${id}"\nmsgstr "${str}"\n`).join('\n');

describe('i18n verify', () => {
  it('Türkçe tespiti: harf ve özgü sözcük', () => {
    assert.equal(looksTurkish('Bağış'), true);
    assert.equal(looksTurkish('Add to cart'), false);
    assert.equal(looksTurkish('Sepete ekle'), true);
    assert.equal(looksTurkish('Save settings'), false);
  });

  it('yer tutucu ve etiket çoklu kümesi', () => {
    assert.deepEqual(tokensOf('%1$s of %2$s <b>x</b>').ph, ['%1$s', '%2$s']);
    assert.equal(tokensOf('a <b>x</b>').tags.length, 2);
  });

  it('doğru dönüşüm → TEMİZ', () => {
    const root = makeRoot(
      { 'src/a.php': "<?php\n$x = __('Add to cart', 'woo-donation-popup');\n$y = esc_html__('Donation amount: %s', 'woo-donation-popup');\n" },
      [
        { file: 'src/a.php', function: '__', msgid: 'Sepete Ekle', plural: null, context: null },
        { file: 'src/a.php', function: 'esc_html__', msgid: 'Bağış tutarı: %s', plural: null, context: null },
      ],
      PO([['Add to cart', 'Sepete Ekle'], ['Donation amount: %s', 'Bağış tutarı: %s']])
    );
    const r = verifyI18n({ root });
    assert.equal(r.ok, true, r.errors.join('\n'));
  });

  it('Türkçe msgid, eksik po, yer tutucu uyuşmazlığı, değişmiş çeviri → KIRMIZI', () => {
    const root = makeRoot(
      {
        'src/a.php':
          "<?php\n__('Sepete Ekle', 'woo-donation-popup');\n__('Amount: %s', 'woo-donation-popup');\n__('Save', 'woo-donation-popup');\n",
      },
      [
        { file: 'src/a.php', function: '__', msgid: 'Sepete Ekle', plural: null, context: null },
        { file: 'src/a.php', function: '__', msgid: 'Tutar: %s', plural: null, context: null },
        { file: 'src/a.php', function: '__', msgid: 'Kaydet', plural: null, context: null },
      ],
      PO([['Amount: %s', 'Tutar'], ['Save', 'Kaydetmek']])
    );
    const r = verifyI18n({ root });
    assert.equal(r.ok, false);
    const text = r.errors.join('\n');
    assert.match(text, /turkce-msgid/);
    assert.match(text, /po-yok/);
    assert.match(text, /yer-tutucu/);
    assert.match(text, /parite-eksik/);
      });

  it('--files kapsamı yalnız o dosyaları denetler', () => {
    const root = makeRoot(
      {
        'src/a.php': "<?php\n__('Add to cart', 'woo-donation-popup');\n",
        'src/b.php': "<?php\n__('Sepete Ekle', 'woo-donation-popup');\n",
      },
      [
        { file: 'src/a.php', function: '__', msgid: 'Sepete Ekle', plural: null, context: null },
        { file: 'src/b.php', function: '__', msgid: 'Sepete Ekle', plural: null, context: null },
      ],
      PO([['Add to cart', 'Sepete Ekle']])
    );
    assert.equal(verifyI18n({ root, files: ['src/a.php'] }).ok, true);
    assert.equal(verifyI18n({ root, files: ['src/b.php'] }).ok, false);
  });
});
