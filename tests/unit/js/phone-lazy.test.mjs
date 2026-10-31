import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * O2: telefon tembel paketi `document.currentScript` olmadan (CDN/birleştirme/erteleme) da sunucunun verdiği adresle
 * yüklenir; geçersiz/eksik adreste yüklenmez, kullanıcıya hata yok, konsola tek uyarı.
 */
function setup(src) {
  const appended = [];
  const warnings = [];
  const handlers = {};
  global.location = { origin: 'https://site.test', href: 'https://site.test/bagis/' };
  global.document = {
    currentScript: null,
    createElement: () => ({ addEventListener() {} }),
    head: { appendChild: (node) => appended.push(node) },
  };
  global.window = { __dpPhoneSrc: src, console: { warn: (msg) => warnings.push(msg) } };
  const form = {
    box: true,
    addEventListener: (type, fn) => (handlers[type] = fn),
    removeEventListener: (type) => delete handlers[type],
    querySelector() {
      return this.box ? {} : null;
    },
    querySelectorAll: () => [],
  };
  return { appended, warnings, handlers, form };
}

const SRC = 'https://site.test/wp-content/plugins/p/assets/build/phone/index.js?ver=1';

test('telefon kutusu yok: paket istenmez, dinleyici tüketilmez; kutu sonradan eklenince yüklenir', async () => {
  const env = setup(SRC);
  env.form.box = false;
  const { phoneBind } = await import(`../../../assets/src/ui2-shared/phone-lazy.mjs?c=${Math.random()}`);
  phoneBind(env.form, {});
  env.handlers.focusin();
  env.handlers.input();
  assert.equal(env.appended.length, 0);
  env.form.box = true;
  env.handlers.focusin();
  assert.equal(env.appended.length, 1);
  assert.equal(env.handlers.focusin, undefined);
});

test('currentScript yok: sunucu adresi (aynı köken, eklenti yolu) ile yüklenir', async () => {
  const env = setup('https://site.test/wp-content/plugins/woo-donation-popup/assets/build/phone/index.js?ver=abc');
  const { phoneBind } = await import(`../../../assets/src/ui2-shared/phone-lazy.mjs?a=${Math.random()}`);
  phoneBind(env.form, {});
  env.handlers.focusin();
  assert.equal(env.appended.length, 1);
  assert.equal(env.appended[0].src, 'https://site.test/wp-content/plugins/woo-donation-popup/assets/build/phone/index.js?ver=abc');
  assert.equal(env.warnings.length, 0);
});

test('adres yok ya da güvensiz: yüklenmez, tek konsol uyarısı', async () => {
  for (const bad of [undefined, 'https://evil.test/wp-content/plugins/p/assets/build/phone/index.js', 'https://site.test/x.js', 'https://site.test/assets/build/phone/index.js?ver=1&a=2']) {
    const env = setup(bad);
    const { phoneBind } = await import(`../../../assets/src/ui2-shared/phone-lazy.mjs?b=${Math.random()}`);
    phoneBind(env.form, {});
    env.handlers.focusin();
    assert.equal(env.appended.length, 0, String(bad));
    assert.equal(env.warnings.length, 1, String(bad));
  }
});
