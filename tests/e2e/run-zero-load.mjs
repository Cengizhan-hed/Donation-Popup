#!/usr/bin/env node
/**
 * Sıfır yük e2e (CLAUDE.md §24; yalnız yerel WP + SQLite; uzak yok):
 *   npm run e2e:zero-load
 * `scripts/measure-load.mjs`'i çalıştırır ve çıkış kodunu denetler: arayüzsüz sayfalarda eklenti kapalı ↔ açık fark 0/0/0
 * (istek, gzip bayt, render engelleyen, satır içi, çerez, sorgu), tüm modüller açıkken de; `DONATION_PANEL_DISABLE` açıkken
 * eklenti DOM'u/varlığı/sorgusu 0; arayüzlüde çekirdek ≤1 CSS + ≤1 JS, sorgu ≤+2, bütçe (CSS ≤12 KB, JS ≤25 KB gzip), autoload ≤5 KB.
 * Port: `WDP_LOCAL_E2E_PORT` (varsayılan 8921). Kuyruk: `npm run e2e:queue -- npm run e2e:zero-load`.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const res = spawnSync(process.execPath, [path.join(root, 'scripts/measure-load.mjs')], { cwd: root, stdio: 'inherit', env: process.env });
if (res.status !== 0) {
  console.error(`e2e:zero-load: HATA (çıkış ${res.status})`);
  process.exit(1);
}
console.log('e2e:zero-load: geçti');
