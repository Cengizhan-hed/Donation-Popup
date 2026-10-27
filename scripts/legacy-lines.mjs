#!/usr/bin/env node
/**
 * Eski çekirdek sayacı (12.0.0): `includes/` ve eskiye ait artakalan satır sayısı, kategori kategori.
 *
 *   node scripts/legacy-lines.mjs [--json]
 *
 * Kategoriler:
 *  - yönetici-bekleyen : eski yönetici ekranı (includes/class-admin-*.php, class-woo-donation-popup-admin.php) ve yalnız
 *    onun kullandığı yardımcılar (Form_Modules, Product_Settings_Service, Color_Palette, Icon_Library, Style_Presets,
 *    ayar yapılandırmaları). `adm` dalgası kaldırır.
 *  - köprü             : includes/class-autoloader.php + class-admin-bridge.php + küçük yönlendirme sınıfları
 *    (eski WDP_* sınıfları). Yönetici dosyalarıyla birlikte silinir.
 *  - eski-ön-yüz       : eski modal/form JS-CSS kaynakları, paket betikleri (hedef: 0).
 *  - diğer-includes    : yukarıdakilere girmeyen includes/ dosyası (hedef: 0).
 * Hedef: sahip olunan yollarda (köprü hariç) yönetici-bekleyen dışında 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} dir */
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** @param {string} file */
function countLines(file) {
  const text = fs.readFileSync(file, 'utf8');
  return text === '' ? 0 : text.split('\n').length;
}

const BRIDGE = new Set([
  'includes/class-autoloader.php',
  'includes/class-admin-bridge.php',
  'includes/class-utils.php',
  'includes/class-assets.php',
  'includes/class-templates.php',
  'includes/class-donation-optional-fields.php',
]);
const ADMIN_HELPERS = new Set([
  'includes/class-form-modules.php',
  'includes/class-product-settings-service.php',
  'includes/class-color-palette.php',
  'includes/class-icon-library.php',
  'includes/class-style-presets.php',
]);

/** @param {string} rel */
function categoryOf(rel) {
  if (BRIDGE.has(rel)) return 'köprü';
  if (/^includes\/class-admin-/.test(rel) || rel === 'includes/class-woo-donation-popup-admin.php' || ADMIN_HELPERS.has(rel) || rel.startsWith('includes/config/')) {
    return 'yönetici-bekleyen';
  }
  return 'diğer-includes';
}

const result = { 'yönetici-bekleyen': 0, köprü: 0, 'eski-ön-yüz': 0, 'diğer-includes': 0 };
const files = {};
for (const abs of walk(path.join(ROOT, 'includes'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const n = countLines(abs);
  const cat = categoryOf(rel);
  result[cat] += n;
  files[rel] = { category: cat, lines: n };
}
for (const dir of ['assets/js/src', 'assets/css/src', 'assets/js/build', 'assets/css/build']) {
  for (const abs of walk(path.join(ROOT, dir))) {
    result['eski-ön-yüz'] += countLines(abs);
    files[path.relative(ROOT, abs).replace(/\\/g, '/')] = { category: 'eski-ön-yüz', lines: countLines(abs) };
  }
}
for (const rel of ['tools/build-css-bundle.php', 'tools/build-js-bundle.php', 'assets/js/defer-loader.js', 'assets/js/style-defer-loader.js']) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) {
    result['eski-ön-yüz'] += countLines(abs);
    files[rel] = { category: 'eski-ön-yüz', lines: countLines(abs) };
  }
}
const total = Object.values(result).reduce((a, b) => a + b, 0);
const mine = total - result['yönetici-bekleyen'] - result.köprü;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total, owned_by_a1: mine, categories: result, files }, null, 2));
} else {
  console.log('Eski çekirdek satır sayacı (includes/ + eski ön yüz)');
  console.log(`  yönetici-bekleyen : ${result['yönetici-bekleyen']}  (adm dalgası kaldırır)`);
  console.log(`  köprü             : ${result.köprü}  (yönetici dosyalarıyla birlikte silinir)`);
  console.log(`  eski-ön-yüz       : ${result['eski-ön-yüz']}  (hedef 0)`);
  console.log(`  diğer-includes    : ${result['diğer-includes']}  (hedef 0)`);
  console.log(`  TOPLAM            : ${total}`);
  console.log(`  a1 sahipliği (köprü + yönetici-bekleyen hariç): ${mine}`);
}
process.exit(mine === 0 ? 0 : 1);
