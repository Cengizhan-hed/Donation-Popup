import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUARANTINE, quarantineFor } from '../../e2e/helpers/quarantine.mjs';

test('karantina: yalnız listelenen check+cihaz+ortam eşleşir', () => {
  assert.ok(quarantineFor('addon-custom-popup', 'iphone', 'local'));
  assert.equal(quarantineFor('addon-custom-popup', 'android', 'local'), null);
  assert.equal(quarantineFor('addon-custom-panel', 'iphone', 'local'), null);
  assert.equal(quarantineFor('addon-custom-popup', 'iphone', 'staging'), null);
});

test('karantina: her girişte neden, tarih ve çıkış koşulu var', () => {
  for (const q of QUARANTINE) {
    assert.ok(q.reason && q.since && q.ref, q.check);
    assert.match(q.reason, /Çıkış:/);
  }
});
