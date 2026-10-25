import test from 'node:test';
import assert from 'node:assert/strict';
import { confettiSpec, prefersReducedMotion, shareOrCopy } from '../../../assets/src/thanks/logic.mjs';

test('prefersReducedMotion: matchMedia yoksa ya da eşleşmezse hayır', () => {
  assert.equal(prefersReducedMotion(null), false);
  assert.equal(prefersReducedMotion({}), false);
  assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(prefersReducedMotion({ matchMedia: (q) => ({ matches: q.includes('reduce') }) }), true);
});

test('confettiSpec: 26 parça, sınırlar içinde, 4 ton', () => {
  const pieces = confettiSpec(26, () => 0.5);
  assert.equal(pieces.length, 26);
  assert.ok(pieces.every((p) => p.left >= 5 && p.left <= 95 && p.duration >= 2.2 && p.duration <= 3.8 && p.delay <= 0.5));
  assert.deepEqual([...new Set(pieces.map((p) => p.tone))].sort(), [0, 1, 2, 3]);
});

test('shareOrCopy: Web Share varsa paylaşır, iptal hata sayılmaz', async () => {
  const calls = [];
  const data = { title: 't', text: 'x', url: 'https://e.test/p' };
  assert.equal(await shareOrCopy({ share: async (d) => calls.push(d) }, data), 'shared');
  assert.deepEqual(calls[0], data);
  const abort = Object.assign(new Error('x'), { name: 'AbortError' });
  assert.equal(await shareOrCopy({ share: async () => { throw abort; } }, data), 'cancelled');
});

test('shareOrCopy: Web Share yoksa bağlantıyı kopyalar; hiçbiri yoksa failed', async () => {
  let copied = '';
  assert.equal(await shareOrCopy({ clipboard: { writeText: async (t) => { copied = t; } } }, { title: '', text: '', url: 'https://e.test/p' }), 'copied');
  assert.equal(copied, 'https://e.test/p');
  assert.equal(await shareOrCopy({}, { title: '', text: '', url: 'u' }), 'failed');
  assert.equal(await shareOrCopy({ clipboard: { writeText: async () => { throw new Error('denied'); } } }, { title: '', text: '', url: 'u' }), 'failed');
});

test('shareOrCopy: paylaşım hatası (iptal değil) kopyalamaya düşer', async () => {
  let copied = false;
  const nav = { share: async () => { throw new Error('boom'); }, clipboard: { writeText: async () => { copied = true; } } };
  assert.equal(await shareOrCopy(nav, { title: '', text: '', url: 'u' }), 'copied');
  assert.equal(copied, true);
});
