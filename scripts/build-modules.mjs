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
const hasEntry =
  fs.existsSync(SRC) &&
  fs.readdirSync(SRC, { withFileTypes: true }).some(
    (e) =>
      (e.isFile() && /^index\.(js|jsx|ts|tsx)$/.test(e.name)) ||
      (e.isDirectory() && fs.readdirSync(path.join(SRC, e.name)).some((f) => /^index\.(js|jsx|ts|tsx)$/.test(f)))
  );
if (!hasEntry) {
  console.log('build:modules: assets/src altinda giris yok, atlandi.');
  process.exit(0);
}
const r = spawnSync(
  path.join(ROOT, 'node_modules/.bin/wp-scripts'),
  ['build', '--webpack-src-dir=assets/src', '--output-path=assets/build'],
  { cwd: ROOT, stdio: 'inherit' }
);
process.exit(r.status ?? 1);
