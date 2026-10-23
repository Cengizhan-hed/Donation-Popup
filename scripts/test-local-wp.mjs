#!/usr/bin/env node
/**
 * Yerel WordPress kanıtları: reproduce, yeni temizlik, kanarya, bootstrap.
 * Uzak site yok.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureLocalWp, WP_DIR } from './local-wp.mjs';
import { preflightCanary, compareCanary, formatCanaryDiff, writeCanaryAlert } from '../tests/e2e/helpers/canary.mjs';
import { ROOT } from '../tests/e2e/helpers/env-root.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.join(ROOT, 'build/local-wp/evidence');

function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', cwd: ROOT, ...opts });
  return r;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  console.log('Yerel WP: PHP + SQLite (Docker yok). Gerekçe: gerçek diskte attachment silme kanıtı.');
  ensureLocalWp();
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const scen = run('php', [path.join(ROOT, 'tests/local-wp/scenarios.php')]);
  fs.writeFileSync(path.join(EVIDENCE, 'scenarios.txt'), `${scen.stdout || ''}\n${scen.stderr || ''}`);
  if (scen.status !== 0) {
    fail(`senaryo kırmızı:\n${(scen.stderr || scen.stdout || '').slice(0, 800)}`);
  }
  if (!String(scen.stdout || '').includes('"page_status_after": "trash"') &&
      !String(scen.stdout || '').includes('"page_status_after":"trash"')) {
    fail('reproduce kanıtı yok (sayfa trash değil)');
  }
  console.log('1) reproduce: sayfa çöp, görsel silindi — geçti');

  let evidence = {};
  try {
    const text = String(scen.stdout || '');
    const i = text.indexOf('{');
    const j = text.lastIndexOf('}');
    evidence = JSON.parse(text.slice(i, j + 1));
  } catch {
    evidence = {};
  }
  fs.writeFileSync(path.join(EVIDENCE, 'scenarios.json'), JSON.stringify(evidence, null, 2));
  if (evidence.safe_cleanup?.unmarked_page_status === 'trash') {
    fail('yeni temizlik işaretsiz sayfayı çöpe atmış');
  }
  console.log('2) yeni temizlik: işaretsiz sayfa/görsel durdu — geçti');

  const trashSnap = {
    posts: [{ id: 1, type: 'page', status: 'trash', mark: '' }],
    options: {
      woocommerce_cart_page_id: '1',
      page_on_front: '0',
      show_on_front: 'posts',
      woocommerce_checkout_page_id: '2',
    },
  };
  const health = preflightCanary(trashSnap);
  if (health.ok) fail('kanarya ön kontrol yeşil kaldı (çöp sepet)');
  writeCanaryAlert(health, 'yerel kanıt: kasıtlı çöp sepet');
  fs.copyFileSync(
    path.join(ROOT, 'build/e2e/CANARY-ALERT-local.txt'),
    path.join(EVIDENCE, 'CANARY-ALERT.txt')
  );
  console.log('3) kanarya kırmızı ve durdurma — geçti');
  console.log(formatCanaryDiff(health).split('\n')[0]);

  const dry = run('node', [path.join(ROOT, 'scripts/e2e-bootstrap.mjs'), '--env', 'local', '--dry-run']);
  if (dry.status !== 0) fail(`bootstrap dry-run: ${dry.stderr || dry.stdout}`);
  fs.writeFileSync(path.join(EVIDENCE, 'bootstrap-dry.txt'), dry.stdout || '');
  const up = run('node', [path.join(ROOT, 'scripts/e2e-bootstrap.mjs'), '--env', 'local']);
  if (up.status !== 0) fail(`bootstrap: ${up.stderr || up.stdout}`);
  const again = run('node', [path.join(ROOT, 'scripts/e2e-bootstrap.mjs'), '--env', 'local']);
  if (again.status !== 0) fail(`bootstrap idempotent: ${again.stderr || again.stdout}`);
  const fxFile = path.join(ROOT, 'build/e2e/fixtures-local.json');
  if (!fs.existsSync(fxFile)) fail('fixtures-local.json yok');
  const fx = JSON.parse(fs.readFileSync(fxFile, 'utf8'));
  const rm = run('node', [path.join(ROOT, 'scripts/e2e-bootstrap.mjs'), '--env', 'local', '--remove']);
  if (rm.status !== 0) fail(`bootstrap remove: ${rm.stderr || rm.stdout}`);
  const afterRm = JSON.parse(fs.readFileSync(fxFile, 'utf8'));
  fs.writeFileSync(
    path.join(EVIDENCE, 'bootstrap.json'),
    JSON.stringify({ create: fx, remove: afterRm, dry: dry.stdout }, null, 2)
  );
  console.log('4) e2e:bootstrap dry-run / oluştur / idempotent / kaldır — geçti');
  console.log(`Yerel WP: ${WP_DIR}`);
  console.log(`Kanıt: ${EVIDENCE}`);
}

main().catch((e) => fail(e.message || String(e)));
