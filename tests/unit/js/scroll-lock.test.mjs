import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

function setup(htmlAttrs = '') {
  const dom = new JSDOM(
    `<!doctype html><html${htmlAttrs}><body><header id="h"></header><main id="m"></main><div id="a"></div><div id="b"></div></body></html>`,
    { url: 'https://example.test/' }
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  delete dom.window.__dpScrollLock;
  return dom;
}

const load = async () => import(`../../../assets/src/ui2-shared/scroll-lock.mjs?${Math.random()}`);

test('iki katman: biri kapanınca kilit kalkmaz, ikisi de kapanınca kalkar (kök sınıfı yazılmaz)', async () => {
  setup();
  const { lockPage, unlockPage, isLocked } = await load();
  const html = document.documentElement;
  const a = document.getElementById('a');
  const b = document.getElementById('b');
  lockPage('A', a, 'donation-panel-lock');
  lockPage('B', b, 'donation-panel-lock');
  assert.equal(html.style.overflow, 'hidden');
  assert.equal(html.className, '', 'kök sınıfı değişmez (tema kuralları tüm belgeyi yeniden hesaplatmasın)');
  assert.equal(isLocked(), true);
  unlockPage('A');
  assert.equal(html.style.overflow, 'hidden', 'B hâlâ açık');
  unlockPage('B');
  assert.equal(html.style.overflow, '');
  assert.equal(html.style.scrollbarGutter || '', '');
  assert.equal(html.hasAttribute('style'), false, 'boş style özniteliği kalmaz');
  assert.equal(isLocked(), false);
});

test('önceki satır içi overflow geri yüklenir; farklı türler aynı kilidi paylaşır', async () => {
  setup(' style="overflow: auto"');
  const { lockPage, unlockPage } = await load();
  const html = document.documentElement;
  lockPage('A', document.getElementById('a'), 'donation-panel-sc-lock');
  lockPage('B', document.getElementById('b'), 'donation-panel-ac-lock');
  assert.equal(html.style.overflow, 'hidden');
  unlockPage('A');
  assert.equal(html.style.overflow, 'hidden');
  unlockPage('B');
  assert.equal(html.style.overflow, 'auto');
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

test('yerel kipli diyalog (native): inert özniteliği yazılmaz, kaydırma kilidi yine uygulanır', async () => {
  setup();
  const { lockPage, unlockPage } = await load();
  const a = document.getElementById('a');
  const b = document.getElementById('b');
  lockPage('A', a, 'donation-panel-lock', { native: true });
  assert.equal(document.getElementById('h').hasAttribute('inert'), false);
  assert.equal(b.hasAttribute('inert'), false);
  assert.equal(document.documentElement.style.overflow, 'hidden');
  // Altta yerel olmayan katman varken üste yerel diyalog gelirse eski arka plan inert'i kaldırılır (tarayıcı engeller).
  unlockPage('A');
  lockPage('B', b, 'donation-panel-sc-lock');
  assert.equal(a.hasAttribute('inert'), true);
  lockPage('A', a, 'donation-panel-lock', { native: true });
  assert.equal(document.getElementById('h').hasAttribute('inert'), false);
  unlockPage('A');
  assert.equal(a.hasAttribute('inert'), true, 'B yine en üstte');
  unlockPage('B');
  assert.equal(a.hasAttribute('inert'), false);
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
  assert.equal(document.documentElement.style.overflow, '');
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
