#!/usr/bin/env node
/**
 * Kritik CSS ayıklayıcısı için DOM örnekleri (fixture) yakalar. YALNIZ yerel WP (127.0.0.1).
 *
 *   node tools/css-critical/capture-fixtures.mjs http://127.0.0.1:8973 custom=/product/x/ fixed=/product/y/ ...
 *
 * Her sayfanın <body> işaretlemesi (betik/stil/bağlantı çıkarılmış) tools/css-critical/fixtures/<ad>.html olarak yazılır.
 * Yalnız ilk görünümde DOM'da bulunan eklenti işaretlemesi önemlidir: açılır pencere/panel/teşekkür gibi tembel
 * parçalar bu sayfalarda basılmadığından bu örneklerde yoktur (stilleri ertelenen paketten gelir).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const [base, ...pairs] = process.argv.slice(2);
if (!base || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) {
  console.error('Yalnız yerel adres: http://127.0.0.1:PORT');
  process.exit(2);
}
fs.mkdirSync(dir, { recursive: true });
for (const pair of pairs) {
  const [name, url] = pair.split(/=(.+)/);
  const res = await fetch(base + url);
  let html = await res.text();
  const htmlAttrs = (html.match(/<html([^>]*)>/i) || [, ''])[1];
  const bodyAttrs = (html.match(/<body([^>]*)>/i) || [, ''])[1];
  let body = html.slice(html.search(/<body/i));
  body = body.replace(/^<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '');
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/\shttps?:\/\/127\.0\.0\.1:\d+/g, '');
  const out = `<!doctype html>\n<html${htmlAttrs}>\n<body${bodyAttrs}>\n${body.trim()}\n</body>\n</html>\n`;
  fs.writeFileSync(path.join(dir, `${name}.html`), out);
  console.log(name, out.length);
}
