#!/usr/bin/env node
/**
 * msgfmt --check → languages/woo-donation-popup-tr_TR.mo
 *
 *   node tools/i18n/compile-mo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WDP_I18N_ROOT
  ? path.resolve(process.env.WDP_I18N_ROOT)
  : path.resolve(__dirname, '../..');
const PO = path.join(ROOT, 'languages/woo-donation-popup-tr_TR.po');
const MO = path.join(ROOT, 'languages/woo-donation-popup-tr_TR.mo');

function main() {
  if (!fs.existsSync(PO)) {
    console.error('languages/woo-donation-popup-tr_TR.po yok — önce npm run i18n:merge');
    process.exit(1);
  }
  const r = spawnSync('msgfmt', ['--check', '-o', MO, PO], { encoding: 'utf8', cwd: ROOT });
  if (r.status !== 0) {
    console.error(`msgfmt: ${(r.stderr || r.stdout || '').slice(0, 800)}`);
    process.exit(1);
  }
  console.log('wrote languages/woo-donation-popup-tr_TR.mo');
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main();
}
