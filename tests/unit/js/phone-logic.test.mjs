import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, formatNational, parsePhone, typing } from '../../../assets/src/ui2-shared/phone-logic.mjs';

const rules = JSON.parse(fs.readFileSync(new URL('../../../src/Support/phone-rules.json', import.meta.url), 'utf8'));
const vectors = JSON.parse(fs.readFileSync(new URL('../../fixtures/phone-vectors.json', import.meta.url), 'utf8'));
const idx = buildIndex(rules);

test('ortak vektörler: PHP ile aynı sonuç', () => {
  assert.ok(vectors.cases.length >= 20);
  vectors.cases.forEach((c, i) => {
    const r = parsePhone(c.raw, c.iso, idx);
    const label = `${i} ${c.iso} ${c.raw}`;
    assert.equal(r.status, c.status, label);
    assert.equal(r.iso, c.oiso, label);
    assert.equal(r.national, c.national, label);
    assert.equal(r.e164, c.e164, label);
    assert.equal(r.warning, c.warning, label);
    assert.equal(r.hint, c.hint, label);
  });
});

test('tablo: tüm ülkeler, makul aralıklar, E.164 en çok 15 hane', () => {
  const isos = Object.keys(idx.table);
  assert.ok(isos.length >= 240);
  isos.forEach((iso) => {
    const row = idx.table[iso];
    assert.match(iso, /^[a-z]{2}$/);
    assert.ok(row.min >= 4 && row.max >= row.min && row.max <= 13, iso);
    assert.ok(row.dial.length + row.max <= 15, iso);
  });
});

test('biçimleme: TR 3-3-2-2, UK 4-6, ABD 3-3-4, bilinmeyen üçerli', () => {
  assert.equal(formatNational('5303071593', 'tr', idx), '530 307 15 93');
  assert.equal(formatNational('53030', 'tr', idx), '530 30');
  assert.equal(formatNational('7911123456', 'gb', idx), '7911 123456');
  assert.equal(formatNational('5551234567', 'us', idx), '555 123 4567');
  assert.equal(formatNational('123456789', 'gh', idx), '123 456 789');
  assert.equal(formatNational('', 'tr', idx), '');
});

test('yazarken: baştaki 0 ayıklanır, fazla hane girilemez', () => {
  assert.deepEqual(typing('0', 'tr', idx), { iso: 'tr', national: '', display: '', hold: false });
  assert.equal(typing('0530307', 'tr', idx).display, '530 307');
  assert.equal(typing('0530 307 15 93 99', 'tr', idx).display, '530 307 15 93');
  assert.equal(typing('0530 307 15 93 99', 'tr', idx).national, '5303071593');
  assert.equal(typing('07911123456789', 'gb', idx).national, '7911123456');
});

test('yapıştırma: +90, 0090, kodlu ve kodsuz numara temizlenir; ülke seçimi güncellenir', () => {
  assert.deepEqual(typing('+90 530 307 15 93', 'gb', idx), { iso: 'tr', national: '5303071593', display: '530 307 15 93', hold: false });
  assert.equal(typing('0090 (530) 307-15-93', 'gb', idx).iso, 'tr');
  assert.equal(typing('+44 7911 123456', 'tr', idx).iso, 'gb');
  assert.equal(typing('+44 7911 123456', 'tr', idx).display, '7911 123456');
  assert.equal(typing('905303071593', 'tr', idx).national, '5303071593');
  assert.equal(typing('+1 416 555 0199', 'ca', idx).iso, 'ca');
  assert.equal(typing('+1 416 555 0199', 'tr', idx).iso, 'us');
});

test('yazarken: + sonrası kod tamamlanmadıysa değer olduğu gibi kalır', () => {
  assert.deepEqual(typing('+', 'tr', idx), { iso: 'tr', national: '', display: '+', hold: true });
  assert.equal(typing('+9', 'tr', idx).hold, true);
  assert.equal(typing('00', 'tr', idx).hold, true);
  assert.equal(typing('+90', 'gb', idx).iso, 'tr');
  assert.equal(typing('+90', 'gb', idx).hold, false);
});

test('seçicide olmayan ülke koduna geçilmez', () => {
  const only = new Set(['tr', 'gb']);
  assert.equal(typing('+966 50', 'tr', idx, only).hold, true);
  assert.equal(typing('+44 79', 'tr', idx, only).iso, 'gb');
});

test('uzunluk: güvenilir ülkede engel (TR 10, UK 9–10, ABD 10), şüpheli ülkede geçiş + uyarı', () => {
  const cases = [
    ['tr', '530 307 15 93', 'ok', ''],
    ['tr', '530 307 15', 'short', ''],
    ['gb', '7911 123456', 'ok', ''],
    ['gb', '7911 12345', 'ok', ''], // UK 9 hane geçerli
    ['gb', '7911 1234', 'short', ''],
    ['gb', '7911 1234567', 'long', ''],
    ['us', '555 123 4567', 'ok', ''],
    ['us', '555 123 456', 'short', ''],
    ['de', '151 12345678', 'ok', ''],
    ['de', '151 1234', 'ok', 'length'], // güvenilir değil: engel yok, uyarı
    ['de', '151 123', 'short', ''], // çok kısa: yine engel
    ['sa', '50 123 4567', 'ok', ''],
    ['sa', '50 123 456', 'ok', 'length'],
    ['jp', '90 1234 5678', 'ok', ''],
    ['jp', '90 1234 56', 'ok', 'length'],
  ];
  cases.forEach(([iso, value, status, hint]) => {
    const r = parsePhone(value, iso, idx);
    assert.equal(r.status, status, `${iso} ${value}`);
    assert.equal(r.hint, hint, `${iso} ${value}`);
  });
});

test('yazarken sınır: güvenilir ülkede kural, şüpheli ülkede gevşetilmiş en çok hane', () => {
  assert.equal(typing('0530 307 15 93 99', 'tr', idx).national.length, 10);
  assert.equal(typing('07911 1234567', 'gb', idx).national.length, 10);
  assert.equal(typing('1511234567890123', 'de', idx).national.length, 13); // 11 + 3 = 14 ama E.164: ülke kodu + numara ≤ 15
});
