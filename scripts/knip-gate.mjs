#!/usr/bin/env node
/**
 * verify:knip — kullanılmayan dosya/dışa aktarım/bağımlılık kapısı (knip.jsonc). Yalnız geliştirme; pakete girmez.
 * knip yoksa ya da çalışmazsa KIRMIZI (çıkış 1); bulgu varsa knip'in çıkış kodu (1) korunur. Sessiz atlama yok.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'node_modules/.bin/knip');
if (!fs.existsSync(BIN)) {
  console.error('verify:knip KIRMIZI: knip bulunamadı (node_modules/.bin/knip). Kurulum: npm ci');
  process.exit(1);
}
const r = spawnSync(BIN, ['--no-progress', ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });
if (r.error || r.status === null) {
  console.error(`verify:knip KIRMIZI: knip çalışmadı (${r.error ? r.error.message : 'sinyal ' + r.signal})`);
  process.exit(1);
}
if (r.status !== 0) {
  console.error('verify:knip KIRMIZI: knip bulgu raporladı (ya da yapılandırma hatası).');
  process.exit(1);
}
console.log('verify:knip temiz');
