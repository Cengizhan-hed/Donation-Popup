#!/usr/bin/env node
/**
 * Kritik CSS ayıklayıcısı (K3). Tam derlenmiş paketten, ilk görünümdeki işaretlemeye (tools/css-critical/fixtures/*.html)
 * uyan kuralları ayıklar; sonuç ürün/mağaza sayfasında SATIR İÇİ basılır, tam paket engelleyici olmadan sonradan yüklenir.
 *
 *   node tools/css-critical/build-critical.mjs <tam-paket.css> <çıktı.css>
 *
 * Ölçüt: kuralın seçicilerinden biri (durum sözde sınıfları ve sözde öğeler atılarak) örneklerin birinde bir öğeyle
 * eşleşirse kural kritiktir (@media/@supports/@container sarmalayıcıları korunur; yazım sırası korunur). Seçici ayrıştırılamazsa
 * kural kritik sayılır (güvenli yön). LTR ve RTL bağlamı birlikte denenir. Tema/oluşturucuya özel hiçbir ayıklama yoktur.
 * Çıktı tam paketin ALT KÜMESİDİR; tam paket sonradan aynı sırayla yüklendiği için basamaklı sıra bozulmaz.
 * Tarayıcı (Playwright Chromium) ya da örnek yoksa çıkış kodu 3: derleyici bölmeden tek paketle devam eder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error('Kullanım: build-critical.mjs <tam-paket.css> <çıktı.css>');
  process.exit(2);
}

const STATE_PSEUDO = /:(?:hover|focus|focus-visible|focus-within|active|visited|link|any-link|target|disabled|enabled|checked|indeterminate|invalid|valid|user-invalid|user-valid|in-range|out-of-range|placeholder-shown|required|optional|read-only|read-write|autofill|fullscreen|modal|open|popover-open|playing|paused)(?![\w-])/gi;
const PSEUDO_ELEMENT = /::?(?:before|after|first-line|first-letter)(?![\w-])|::[\w-]+(?:\([^)]*\))?|:-(?:webkit|moz|ms)-[\w-]+(?:\([^)]*\))?/gi;

const fixtureDir = path.join(here, 'fixtures');
const fixtures = fs.existsSync(fixtureDir) ? fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.html') && (!process.env.CRITICAL_ONLY || f.startsWith(process.env.CRITICAL_ONLY))).sort() : [];
if (!fixtures.length) {
  console.error('Örnek (fixture) yok.');
  process.exit(3);
}

let chromium;
try {
  ({ chromium } = require('@playwright/test'));
} catch (e) {
  console.error('Playwright yok; kritik CSS üretilmedi.');
  process.exit(3);
}
const postcss = require('postcss');

/**
 * Seçiciyi eşleştirme için sadeleştirir.
 * @param {string} sel Seçici.
 * @return {string} Sadeleşmiş seçici.
 */
function simplify(sel) {
  let s = sel.replace(PSEUDO_ELEMENT, '').replace(STATE_PSEUDO, '');
  s = s.replace(/\(\s*\)/g, '(*)').trim();
  // Sözde öğe atılınca sonu boşalan bileşik seçiciye evrensel seçici ekle ("a >" gibi).
  s = s.replace(/([>+~])\s*$/, '$1 *').replace(/^\s*([>+~])/, '* $1');
  return s;
}

const css = fs.readFileSync(inFile, 'utf8');
const root = postcss.parse(css);

const selectorSet = new Set();
root.walkRules((rule) => {
  if (rule.parent && rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
  for (const raw of rule.selectors) selectorSet.add(simplify(raw));
});
const selectors = [...selectorSet];

const browser = await chromium.launch();
const matched = new Set();
try {
  const modes = process.env.CRITICAL_MODE === 'rtl' ? [true] : process.env.CRITICAL_MODE === 'ltr' ? [false] : [false, true];
  for (const rtl of modes) {
    for (const f of fixtures) {
      const page = await browser.newPage();
      await page.setContent(fs.readFileSync(path.join(fixtureDir, f), 'utf8'), { waitUntil: 'domcontentloaded' });
      const hits = await page.evaluate(
        ({ list, rtlMode }) => {
          if (rtlMode) {
            document.documentElement.setAttribute('dir', 'rtl');
            document.documentElement.classList.add('rtl');
            document.body.classList.add('rtl');
          }
          const found = [];
          for (const s of list) {
            try {
              if (s === '' || document.querySelector(s)) found.push(s);
            } catch (e) {
              found.push(s); // ayrıştırılamadı: kritik say (güvenli yön)
            }
          }
          return found;
        },
        { list: selectors, rtlMode: rtl }
      );
      hits.forEach((h) => matched.add(h));
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const keyframesUsed = new Set();
const out = postcss.root();

/**
 * Kritik kuralları hedefe ekler.
 * @param {object} container Kaynak düğüm.
 * @param {object} target Hedef düğüm.
 */
function filterContainer(container, target) {
  container.each((node) => {
    if (node.type === 'rule') {
      if (node.parent && node.parent.type === 'atrule' && /keyframes$/i.test(node.parent.name)) return;
      const keep = node.selectors.filter((raw) => matched.has(simplify(raw)));
      if (keep.length) {
        const copy = node.clone();
        copy.selectors = keep; // eşleşmeyen seçiciler ilk görünümde etkisizdir; tam paket sonradan hepsini getirir
        target.append(copy);
        node.walkDecls(/^animation(-name)?$/i, (d) => {
          d.value.split(/[\s,]+/).forEach((tok) => keyframesUsed.add(tok));
        });
      }
    } else if (node.type === 'atrule') {
      const name = node.name.toLowerCase();
      if (name === 'media' || name === 'supports' || name === 'container' || name === 'layer' || name === 'scope') {
        if (!node.nodes) {
          if (name === 'layer') target.append(node.clone()); // "@layer a, b;" sıra bildirimi
          return;
        }
        const wrapper = node.clone({ nodes: [] });
        filterContainer(node, wrapper);
        if (wrapper.nodes && wrapper.nodes.length) target.append(wrapper);
      } else if (name === 'font-face' || name === 'property' || name === 'charset') {
        target.append(node.clone());
      }
    }
  });
}
filterContainer(root, out);

root.walkAtRules(/keyframes$/i, (node) => {
  if (keyframesUsed.has(node.params.trim())) out.append(node.clone());
});

const result = out.toString();
fs.writeFileSync(outFile, `${result.trim()}\n`);
const raw = fs.statSync(inFile).size;
console.log(`kritik CSS: ${result.length} bayt (tam paket ${raw}; %${Math.round((result.length / raw) * 100)}); örnek ${fixtures.length} x LTR/RTL; eşleşen seçici ${matched.size}/${selectors.length}`);
