#!/usr/bin/env node
/**
 * Eklentinin KENDİ ayarını (donation_panel_settings; yalnız allowlist yollar) güvenle değiştirir.
 *
 *   node scripts/plugin-settings.mjs --env ikram-aid|staging-hedef|local --show
 *   node scripts/plugin-settings.mjs --env ikram-aid --set modules.side_cart=1,experiences.engine=new [--dry-run]
 *   node scripts/plugin-settings.mjs --env ikram-aid --restore build/e2e/plugin-settings-backup/<yedek>.json [--dry-run]
 *
 * Uzak ortamlarda yalnız Claude (CLAUDECODE=1); merkezi uzak koruma + klasör kilidi + REMOTE_FREEZE + ortam kilidi
 * + kanarya öncesi/sonrası. WooCommerce/tema/site ayarlarına dokunmaz. Canlı hedef kesin red.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findTargetById, pathInsideAllowedRoot, validateRemoteSiteUrl, wpPathFlag } from './lib/deploy-guards.mjs';
import { ROOT } from './lib/staging-tools.mjs';
import { PS_EVAL_FILE, buildPsCommand, parseJsonOutput, parseSetSpec, resolvePsEnv, runPluginSettings, assertPhpWriteSurface } from './lib/plugin-settings.mjs';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const a = argv.filter((x) => x !== '--');
  const out = { env: '', op: '', set: '', restore: '', dry: false };
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--env') out.env = String(a[++i] || '');
    else if (x.startsWith('--env=')) out.env = x.slice(6);
    else if (x === '--set') { out.op = 'set'; out.set = String(a[++i] || ''); }
    else if (x === '--restore') { out.op = 'restore'; out.restore = String(a[++i] || ''); }
    else if (x === '--show') out.op = 'show';
    else if (x === '--dry-run') out.dry = true;
    else throw new Error(`Bilinmeyen bayrak: ${x}`);
  }
  if (!out.env) throw new Error('--env zorunlu (local|ikram-aid|staging-hedef).');
  if (!out.op) throw new Error('İşlem yok: --show | --set a.b=1,... | --restore <yedek>');
  return out;
}

async function main() {
  let args;
  let envId;
  try {
    args = parseArgs(process.argv.slice(2));
    envId = resolvePsEnv(args.env);
  } catch (e) {
    fail(`plugin-settings: ${e.message}`);
  }
  const evalSrc = fs.readFileSync(path.join(ROOT, PS_EVAL_FILE), 'utf8');
  const ws = assertPhpWriteSurface(evalSrc);
  if (!ws.ok) fail(`plugin-settings: ${ws.reason}`);
  const evalB64 = Buffer.from(evalSrc, 'utf8').toString('base64');
  /** @type {Record<string, unknown>|undefined} */
  const values = args.op === 'set' ? parseSetSpec(args.set) : undefined;

  let runEval;
  let finish = async (fn) => fn();
  if (envId === 'local') {
    const { runLocalEvalFile, parseLocalEvalJson } = await import('../tests/e2e/helpers/local-wp-eval.mjs');
    runEval = (payload) => {
      const tmp = path.join(os.tmpdir(), `wdp-ps-${process.pid}-${Date.now()}.json`);
      fs.writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 });
      try {
        return parseLocalEvalJson(runLocalEvalFile(PS_EVAL_FILE, [], { env: { WDP_E2E_PS_PAYLOAD_FILE: tmp, WDP_LOCAL_WP_DIR: process.env.WDP_LOCAL_WP_DIR || path.join(ROOT, 'build/local-wp/wordpress') } }));
      } finally {
        fs.rmSync(tmp, { force: true });
      }
    };
  } else {
    if (process.env.CLAUDECODE !== '1') fail('plugin-settings: uzak ortamda yalnız Claude çalıştırır (CLAUDECODE=1 gerekir).');
    const { loadProfile, setActiveProfile } = await import('../tests/e2e/helpers/profile.mjs');
    const { loadDeployEnvSilent, remote, resolveWpPath, setActiveDeployEnvFile } = await import('../tests/e2e/helpers/wp-remote.mjs');
    const { withEnvRunLock } = await import('../tests/e2e/helpers/env-lock.mjs');
    const { runCanary } = await import('../tests/e2e/run-canary.mjs');
    const profile = loadProfile(envId);
    setActiveProfile(profile);
    setActiveDeployEnvFile(profile.deployEnvFile || '.env.deploy');
    const loaded = loadDeployEnvSilent();
    if (!loaded.ok) fail(`plugin-settings: ${loaded.reason}`);
    const env = { ...loaded.env };
    env.DEPLOY_WP_PATH = String(env.DEPLOY_WP_PATH || resolveWpPath(env)).trim();
    const target = findTargetById(envId);
    if (!target) fail('plugin-settings: ortam izin listesinde yok.');
    if (String(env.DEPLOY_SSH_ALIAS || '').trim() !== target.sshAlias) fail('plugin-settings: SSH alias eşleşmiyor.');
    if (!pathInsideAllowedRoot(env.DEPLOY_WP_PATH, target.allowedRoot)) fail('plugin-settings: WP yolu izinli klasör dışında.');
    if (String(env.DEPLOY_SITE_URL || '').replace(/\/$/, '') !== target.siteUrl) fail('plugin-settings: site adresi eşleşmiyor.');
    const siteCheck = remote(env, `wp option get siteurl ${wpPathFlag(env.DEPLOY_WP_PATH)}`);
    const g = validateRemoteSiteUrl(siteCheck, env.DEPLOY_SITE_URL);
    if (!g.ok) fail(`plugin-settings: ${g.reason}`);
    runEval = (payload) => parseJsonOutput(remote(env, buildPsCommand(env.DEPLOY_WP_PATH, { evalB64, payload })));
    const mutating = args.op !== 'show' && !args.dry;
    finish = (fn) =>
      withEnvRunLock(
        profile.id,
        () => {
          if (mutating) {
            const before = runCanary({ envName: profile.id });
            if (!before.ok) throw new Error('Kanarya öncesi KIRMIZI; yazılmadı.');
          }
          const r = fn();
          if (mutating) {
            const after = runCanary({ envName: profile.id });
            if (!after.ok) throw new Error('CANARY-ALERT: kanarya sonrası KIRMIZI (build/e2e/CANARY-ALERT.txt).');
          }
          return r;
        },
        { command: 'plugin-settings' }
      );
  }

  try {
    const res = await finish(() =>
      runPluginSettings({ envId, op: args.op, values, dry: args.dry, restoreFile: args.restore ? path.resolve(args.restore) : undefined, runEval })
    );
    if (args.op === 'show') {
      console.log(JSON.stringify(res, null, 2));
      return;
    }
    console.log(`Ortam: ${res.env}  ${res.dry ? '(DRY-RUN, yazılmadı)' : res.written ? '(yazıldı)' : '(değişiklik yok)'}`);
    if (res.backup) console.log(`Yedek: ${res.backup}`);
    for (const line of res.table) console.log(line);
  } catch (e) {
    fail(`plugin-settings: ${e && e.message ? e.message : e}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
