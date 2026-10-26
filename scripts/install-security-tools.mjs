#!/usr/bin/env node
/**
 * Güvenlik analizi araçları (yalnız geliştirme; pakete girmez, siteye kurulmaz):
 *  - Psalm: composer require-dev (vendor-dev/), `npm run test:install` ile gelir.
 *  - Semgrep: proje içi sanal ortam build/semgrep-venv, sürüm sabit (resmi PyPI paketi, >= 2 hafta önce yayımlı).
 * Semgrep kuralları depoda yerel dosyadır (tools/security-baseline/semgrep-rules); tarama ağsız, --metrics=off.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEMGREP_VERSION = '1.179.0'; // PyPI 2026-10-02
const VENV = path.join(ROOT, 'build/semgrep-venv');

function run(bin, args) {
  const r = spawnSync(bin, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`${bin} ${args.join(' ')} başarısız (çıkış ${r.status})`);
    process.exit(r.status || 1);
  }
}

if (!fs.existsSync(path.join(VENV, 'bin/python'))) run('python3', ['-m', 'venv', VENV]);
run(path.join(VENV, 'bin/pip'), ['install', '--quiet', `semgrep==${SEMGREP_VERSION}`]);
console.log(`Semgrep ${SEMGREP_VERSION} hazır: build/semgrep-venv`);
if (!fs.existsSync(path.join(ROOT, 'vendor-dev/bin/psalm'))) {
  console.log('Psalm yok: önce `npm run test:install` (composer install).');
}
