#!/usr/bin/env node
/**
 * Faz 7 modern JS derlemesi (@wordpress/scripts): assets/src/<modul>/index.js -> assets/build/.
 * Kaynak yoksa atlanir (mevcut build/pack akisini bozmaz). Kaynak assets/src paketten cikarilir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/src');
/** Giriş noktaları: assets/src/index.js ve assets/src/<modül>/index.js (çıktı: assets/build/<modül>/index.js). */
const entries = [];
if (fs.existsSync(SRC)) {
  for (const e of fs.readdirSync(SRC, { withFileTypes: true })) {
    if (e.isFile() && /^index\.(m?js|jsx|ts|tsx)$/.test(e.name)) {
      entries.push(`index=./assets/src/${e.name}`);
    } else if (e.isDirectory()) {
      const file = fs.readdirSync(path.join(SRC, e.name)).find((f) => /^index\.(m?js|jsx|ts|tsx)$/.test(f));
      if (file) {
        entries.push(`${e.name}/index=./assets/src/${e.name}/${file}`);
      }
    }
  }
}
if (!entries.length) {
  console.log('build:modules: assets/src altinda giris yok, atlandi.');
  process.exit(0);
}
const r = spawnSync(
  path.join(ROOT, 'node_modules/.bin/wp-scripts'),
  ['build', ...entries, '--output-path=assets/build'],
  { cwd: ROOT, stdio: 'inherit' }
);
process.exit(r.status ?? 1);
