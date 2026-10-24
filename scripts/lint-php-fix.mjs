#!/usr/bin/env node
/** PHPCBF (WPCS) — otomatik düzeltilebilir PHPCS hatalarını düzeltir. Dosya/klasör verilmezse phpcs.xml.dist kapsamı. Yalnız geliştirme. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHPCBF = path.join(ROOT, 'vendor-dev/bin/phpcbf');
if (!fs.existsSync(PHPCBF)) {
  console.error('phpcbf yok. Önce: node scripts/install-lint-tools.mjs');
  process.exit(2);
}
const r = spawnSync('php', [PHPCBF, '-q', ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });
// phpcbf: 0 = düzeltilecek yok, 1 = düzeltildi, 2 = düzeltilemeyen kaldı, 3 = işlem hatası
process.exit(r.status === 3 ? 3 : 0);
