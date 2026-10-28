import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

function setup() {
  const dom = new JSDOM(
    '<!doctype html><html><body><header id="h"></header><main id="m"></main><div id="a"></div><div id="b"></div></body></html>',
    { url: 'https://example.test/' }
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  delete dom.window.__dpScrollLock;
  return dom;
}

const load = async () => import(`../../../assets/src/ui2-shared/scroll-lock.mjs?${Math.random()}`);

test('iki katman: biri kapanınca kilit kalkmaz, ikisi de kapanınca kalkar', async () => {
  setup();
  const { lockPage, unlockPage } = await load();
  const html = document.documentElement;
  const a = document.getElementById('a');
  const b = document.getElementById('b');
  lockPage('A', a, 'donation-panel-lock');
  lockPage('B', b, 'donation-panel-lock');
  assert.equal(html.classList.contains('donation-panel-lock'), true);
  unlockPage('A');
  assert.equal(html.classList.contains('donation-panel-lock'), true, 'B hâlâ açık');
  unlockPage('B');
  assert.equal(html.classList.contains('donation-panel-lock'), false);
  assert.equal(html.style.scrollbarGutter || '', '');
});

test('farklı sınıflar bağımsız temizlenir', async () => {
  setup();
  const { lockPage, unlockPage } = await load();
  const html = document.documentElement;
  lockPage('A', document.getElementById('a'), 'donation-panel-sc-lock');
  lockPage('B', document.getElementById('b'), 'donation-panel-ac-lock');
  unlockPage('A');
  assert.equal(html.classList.contains('donation-panel-sc-lock'), false);
  assert.equal(html.classList.contains('donation-panel-ac-lock'), true);
  unlockPage('B');
  assert.equal(html.classList.contains('donation-panel-ac-lock'), false);
});

test('arka plan inert olur, katmanın kendisi olmaz; sayaçlı geri alınır', async () => {
  setup();
  const { lockPage, unlockPage } = await load();
  const a = document.getElementById('a');
  const b = document.getElementById('b');
  lockPage('A', a, 'donation-panel-lock');
  assert.equal(document.getElementById('h').hasAttribute('inert'), true);
  assert.equal(a.hasAttribute('inert'), false);
  assert.equal(b.hasAttribute('inert'), true, 'A açıkken B bölümü arka plandır');
  lockPage('B', b, 'donation-panel-lock');
  assert.equal(a.hasAttribute('inert'), true, 'B üstteyken A arka plandır');
  assert.equal(b.hasAttribute('inert'), false);
  unlockPage('B');
  assert.equal(a.hasAttribute('inert'), false);
  assert.equal(document.getElementById('h').hasAttribute('inert'), true, 'A hâlâ açık');
  unlockPage('A');
  assert.equal(document.getElementById('h').hasAttribute('inert'), false);
  assert.equal(b.hasAttribute('inert'), false);
});

test('isTopmost: yalnız en üst katman; çift unlock zararsız', async () => {
  setup();
  const { lockPage, unlockPage, isTopmost } = await load();
  lockPage('A', document.getElementById('a'), 'donation-panel-lock');
  lockPage('B', document.getElementById('b'), 'donation-panel-lock');
  assert.equal(isTopmost('B'), true);
  assert.equal(isTopmost('A'), false);
  unlockPage('B');
  unlockPage('B');
  assert.equal(isTopmost('A'), true);
  unlockPage('A');
  assert.equal(document.documentElement.classList.contains('donation-panel-lock'), false);
});

test('önceden inert olan öğe kilitten sonra da inert kalır', async () => {
  setup();
  const { lockPage, unlockPage } = await load();
  const h = document.getElementById('h');
  h.setAttribute('inert', '');
  lockPage('A', document.getElementById('a'), 'donation-panel-lock');
  unlockPage('A');
  assert.equal(h.hasAttribute('inert'), true);
});
