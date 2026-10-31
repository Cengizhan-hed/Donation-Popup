/**
 * 12.4 gömülü kart formu paketi: PHP kodlayıcı (`Form_Pack`) ↔ JS çözücü (`assets/src/list/pack.mjs`) kayıpsız uyum,
 * boyut kazancı, bozuk paket ve `<script>` içi güvenli JSON.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { decodeOps, ID_TOKEN, KEY_TOKEN, openPack, restoreTokens } from '../../../assets/src/list/pack.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const COUNTRIES = Array.from({ length: 240 }, (_, i) => `<option value="${i + 1}">Ülke ${i} (+${i + 1})</option>`).join('\n');

/**
 * Gerçek forma benzer çıktı (kap + form; ülke listesi hissedar başına yinelenir).
 *
 * @param {number} id     Ürün.
 * @param {number} n      Sayfa sayacı.
 * @param {string} title  Ad.
 * @param {number} price  Tutar.
 * @param {number} holder Hissedar bloğu.
 * @return {string} HTML.
 */
function form(id, n, title, price, holder = 1) {
  const key = `dp-${id}-popup-${n}`;
  const blocks = Array.from(
    { length: holder },
    (_, h) => `<fieldset data-dp-holder="${h + 1}"><legend>${h + 1}. Hissedar</legend><label for="${key}-h${h}">Ad</label><input id="${key}-h${h}" aria-describedby="${key}-h${h}-err"><select name="cc_${h}">${COUNTRIES}</select></fieldset>`
  ).join('\n');
  return `<div class="donation-panel donation-panel-exp" data-dp-exp data-dp-kind="popup" data-dp-product="${id}" data-dp-nonce="">
<button type="button" data-dp-open aria-controls="${key}">Bağış Yap</button>
<template data-dp-tpl><dialog id="${key}" aria-labelledby="${key}-title"><form data-product-id="${id}" data-title="${title}" data-min="${id}">
<h2 id="${key}-title">${title}</h2><span data-dp-progress="{&quot;id&quot;:${id},&quot;pd&quot;:1}"></span>
<strong>₺${price}</strong><input type="hidden" value="${price}" />${blocks}
<p>Not: &lt;/script&gt; ve <!-- yorum --> ve ğüşiöç</p></form></dialog></template></div>`;
}

/**
 * @param {Record<string, string>} forms Ürün → HTML.
 * @return {{raw: string, data: any}} Paket.
 */
function encodePhp(forms) {
  const r = spawnSync('php', [path.join(ROOT, 'tests/unit/js/form-pack-encode.php')], { input: JSON.stringify(forms), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return { raw: r.stdout, data: JSON.parse(r.stdout) };
}

test('PHP Form_Pack → JS çözücü: kayıpsız (belirteçler geri konunca özgün HTML, yeni benzersiz anahtar)', () => {
  const forms = {};
  for (let i = 0; i < 24; i += 1) {
    const id = 100 + i;
    forms[id] = form(id, i + 1, `Su Kuyusu ${i}`, 25 * (1 + (i % 7)), i % 3 === 0 ? 4 : 1);
  }
  const { raw, data } = encodePhp(forms);
  const reader = openPack(data);
  assert.ok(reader);
  assert.deepEqual(reader.ids.sort(), Object.keys(forms).sort());
  for (const [id, html] of Object.entries(forms)) {
    const decoded = reader.form(id);
    assert.ok(decoded.includes(KEY_TOKEN) && decoded.includes(ID_TOKEN), 'belirteçli');
    const oldKey = html.match(/id="(dp-\d+-popup-\d+)"/)[1];
    assert.equal(restoreTokens(decoded, id, oldKey), html, `ürün ${id}`);
    const fresh = restoreTokens(decoded, id, `dp-${id}-popup-e9`);
    assert.ok(!fresh.includes(oldKey) && fresh.includes(`id="dp-${id}-popup-e9"`) && fresh.includes(`data-dp-product="${id}"`));
  }
  // Boyut: ham HTML toplamının küçük bir kısmı (ortak şablon + fark).
  const total = Object.values(forms).reduce((a, h) => a + Buffer.byteLength(h), 0);
  assert.ok(raw.length < total / 8, `paket ${raw.length} B, ham ${total} B`);
  // <script> içinde güvenli: kapanış etiketi ve yorum açılışı yok.
  assert.ok(!/<\/script/i.test(raw) && !raw.includes('<!--'));
});

test('belirteç karakteri zaten olan form eklenmez (kayıpsızlık), bozuk paket null/istisna', () => {
  const { data } = encodePhp({ 7: form(7, 1, 'A', 10), 8: `x${KEY_TOKEN}y` });
  assert.equal(data.added['8'], 0);
  assert.deepEqual(openPack(data).ids, ['7']);
  assert.equal(openPack({ v: 2, t: [], f: {} }), null);
  assert.equal(openPack(null), null);
  assert.throws(() => decodeOps([5, 3], ['a']), /range/);
  assert.throws(() => decodeOps(['a', 0, 0], []), /op/);
  const broken = openPack({ v: 1, t: [], f: { 9: [3, 2] } });
  assert.equal(broken.form('9'), null);
  assert.equal(broken.form('10'), null);
});

test('decodeOps: kendi çıktısına kopya (yinelenen blok) ve şablon akışı', () => {
  assert.deepEqual(decodeOps(['a', 'b', -1, 2, 0, 1], ['z']), ['a', 'b', 'a', 'b', 'z']);
});
