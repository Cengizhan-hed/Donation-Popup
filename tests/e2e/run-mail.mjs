#!/usr/bin/env node
/**
 * Mail e2e: yerel WP + Mailpit. YALNIZ yerel (--env local); uzak profil reddedilir.
 *
 *   npm run e2e:queue -- node tests/e2e/run-mail.mjs [--project desktop] [--checkout classic|blocks]
 *
 * Port: WDP_LOCAL_E2E_PORT (varsayılan 9064). Mailpit: 1025/8025 (çalışıyorsa yeniden kullanılır).
 * mu-plugin `wdp-mail-sink.php` yalnız bu geçici yerel WP'ye kopyalanır (eklenti/zip'e girmez).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadMatrix } from './helpers/matrix-cover.mjs';
import { ensureMailpit, SMTP_PORT, HTTP_PORT } from './helpers/mailpit.mjs';
import {
  ensureMatrixTemplate,
  ensureTheme,
  matrixEval,
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
  restoreSqlite,
} from './helpers/matrix-setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = Number(process.env.WDP_LOCAL_E2E_PORT || 9064) || 9064;

/** @param {string[]} argv @param {string} name @return {string} */
function flag(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? String(argv[i + 1] || '') : '';
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--env') && !/^(local|local-wp)$/.test(flag(argv, '--env'))) {
    console.error('e2e mail yalnız --env local ile çalışır.');
    process.exit(2);
  }
  const theme = process.env.WDP_EXP_THEME || 'twentytwentyfive';
  const store = loadMatrix().stores.try;
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);
  const checkout = flag(argv, '--checkout') === 'blocks' ? 'blocks' : 'classic';
  const resolved = { id: `mail-${theme}-${checkout}`, themeSpec: { slug: theme }, storeSpec: store, checkout, hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  const mu = path.join(wpDir, 'wp-content/mu-plugins');
  fs.mkdirSync(mu, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'helpers/wdp-e6-sim.php'), path.join(mu, 'wdp-e6-sim.php'));
  fs.copyFileSync(path.join(__dirname, 'helpers/wdp-mail-sink.php'), path.join(mu, 'wdp-mail-sink.php'));
  // 12.4 email: site dili, teşekkür e-postası ayarı, kampanya hedefi (yalnız bu geçici yerel WP).
  const locale = flag(argv, '--locale') === 'tr_TR' ? 'tr_TR' : 'en_US';
  const thanksEmail = !argv.includes('--no-thanks');
  fs.copyFileSync(path.join(__dirname, 'helpers/wdp-mail-opts.php'), path.join(mu, 'wdp-mail-opts.php'));
  fs.writeFileSync(
    path.join(wpDir, 'wp-content/wdp-mail-opts.json'),
    JSON.stringify({
      locale,
      thanksEmail,
      blockEmail: argv.includes('--block-email'),
      onHold: argv.includes('--on-hold'),
      message: 'Allah kabul etsin, bağışınız için çok teşekkürler: çğüşiö ÇĞÜŞİÖ.',
      campaignProduct: Number(probe.products.custom.id),
    })
  );
  restoreSqlite(wpDir, snap);
  const gateways = matrixEval(wpDir, ['enable-offline-gateways']);
  if (gateways && gateways.ok === false) throw new Error(`çevrimdışı ödeme yöntemleri açılamadı: ${gateways.error || ''}`);
  const mailpit = await ensureMailpit();
  const server = await startPhpServer({ wpDir, port: PORT });
  let status;
  try {
    fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
    const args = ['playwright', 'test', '-c', 'tests/e2e/playwright.config.mjs', flag(argv, '--spec') || 'specs/mail.spec'];
    const project = flag(argv, '--project');
    if (project) args.push('--project', project);
    const r = spawnSync('npx', args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_BASE_URL: `http://127.0.0.1:${PORT}`,
        WDP_EXP_PRODUCT_ID: String(probe.products.custom.id),
        WDP_EXP_TRY: '1',
        WDP_EXP_CHECKOUT: checkout,
        WDP_MAIL_LOCALE: locale,
        WDP_MAIL_BLOCKEMAIL: argv.includes('--block-email') ? '1' : '0',
        WDP_MAIL_ONHOLD: argv.includes('--on-hold') ? '1' : '0',
        WDP_MAIL_THANKS: thanksEmail ? '1' : '0',
        WDP_EXP_STORE: JSON.stringify(store),
        WDP_LOCAL_WP_DIR: wpDir,
        WDP_MAILPIT_SMTP_PORT: String(SMTP_PORT),
        WDP_MAILPIT_HTTP_PORT: String(HTTP_PORT),
      },
    });
    status = r.status ?? 1;
    if (status === 0) fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
  } finally {
    await server.stop();
    await mailpit.stop();
  }
  process.exit(status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
