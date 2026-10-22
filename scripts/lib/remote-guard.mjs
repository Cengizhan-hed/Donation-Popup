/**
 * Merkezi uzak erişim kilidi.
 *
 * spawn/exec düzeyinde: ssh / scp / rsync (uzak) ve WP-CLI köprüleri
 * bu modülden geçer. build/handoff/REMOTE_FREEZE varsa işlem yok.
 *
 * Yerel paket rsync (--local-pack) uzak sayılmaz; freeze onu durdurmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  isLiveHedefHost,
  isRetiredHedefStaging,
  matchAllowedTarget,
} from './deploy-guards.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../..');
export const REMOTE_FREEZE_PATH = path.join(REPO_ROOT, 'build/handoff/REMOTE_FREEZE');
export const REMOTE_BINS = new Set(['ssh', 'scp', 'rsync']);

export const FREEZE_MESSAGE =
  'UZAK ERİŞİM KİLİTLİ (2026-10-22): build/handoff/REMOTE_FREEZE dosyası var. ' +
  'staging28, ikramaid.uk, hedefdernegi.org ve diğer uzak sitelere SSH/SCP/rsync/WP-CLI gönderilemez. ' +
  'Kilidi yalnız kullanıcı kaldırır.';

/**
 * @returns {boolean}
 */
export function isRemoteFrozen() {
  return fs.existsSync(REMOTE_FREEZE_PATH);
}

/**
 * @param {string[]} args
 * @returns {string[]}
 */
export function redactSpawnArgs(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (a === '-i' || a === '-i') {
      out.push(a, '[redacted-key-path]');
      i += 1;
      continue;
    }
    if (a === '--rsh' || a === '-e') {
      out.push(a, '[redacted-rsh]');
      i += 1;
      continue;
    }
    out.push(a);
  }
  return out;
}

/**
 * rsync hedefi uzak mı? (`host:path`, `-e ssh`, `--rsh`)
 * @param {string[]} args
 */
export function isRemoteRsync(args) {
  const list = (args || []).map(String);
  if (list.some((a) => a === '-e' || a === '--rsh' || a.startsWith('--rsh='))) {
    return true;
  }
  for (const a of list) {
    if (a.startsWith('-')) continue;
    if (/^[a-zA-Z0-9._-]+@[^:]+:/.test(a)) return true;
    if (/^[a-zA-Z0-9._-]+:\//.test(a) && !/^[A-Za-z]:[\\/]/.test(a)) return true;
  }
  return false;
}

/**
 * @param {{
 *   bin?: string,
 *   args?: string[],
 *   siteUrl?: string,
 *   wpPath?: string,
 *   localPack?: boolean,
 * }} [opts]
 */
export function assertRemoteAllowed(opts = {}) {
  const bin = path.basename(String(opts.bin || ''));
  const args = Array.isArray(opts.args) ? opts.args.map(String) : [];
  const localPack = !!opts.localPack && bin === 'rsync' && !isRemoteRsync(args);

  if (localPack) {
    if (isRemoteRsync(args)) {
      throw new Error('Yerel paket rsync uzak hedef içeriyor; reddedildi.');
    }
    return { ok: true, localPack: true };
  }

  if (isRemoteFrozen()) {
    throw new Error(FREEZE_MESSAGE);
  }

  const siteUrl = String(opts.siteUrl || '').trim();
  const wpPath = String(opts.wpPath || '').trim();
  const hay = `${siteUrl} ${wpPath} ${args.join(' ')}`;

  if (isLiveHedefHost(siteUrl) || isLiveHedefHost(wpPath) || isLiveHedefHost(hay)) {
    throw new Error('Kara liste: hedefdernegi.org (canlı) kesin engelli.');
  }
  if (isRetiredHedefStaging(siteUrl) || isRetiredHedefStaging(wpPath) || isRetiredHedefStaging(hay)) {
    throw new Error(
      'Hedef staging (staging28.hedefdernegi.org) izin listesinden çıkarıldı (2026-10-22 olayı). ' +
        'Yeni adres kullanıcı verene kadar deploy/E2E uzak yazma yok.'
    );
  }

  if (siteUrl || wpPath) {
    const allowed = matchAllowedTarget(siteUrl || hay, wpPath || hay);
    if (!allowed.ok) {
      throw new Error(allowed.reason || 'Hedef izin listesinde değil.');
    }
  }

  return { ok: true, localPack: false };
}

/**
 * ssh / scp / rsync (ve diğer) spawn. Uzak ikililer assertRemoteAllowed’dan geçer.
 *
 * @param {string} bin
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptions} [spawnOpts]
 * @param {{ siteUrl?: string, wpPath?: string, localPack?: boolean }} [guardOpts]
 */
export function spawnGuarded(bin, args, spawnOpts = {}, guardOpts = {}) {
  const base = path.basename(String(bin));
  const list = Array.isArray(args) ? args.map(String) : [];
  if (REMOTE_BINS.has(base)) {
    assertRemoteAllowed({
      bin: base,
      args: list,
      siteUrl: guardOpts.siteUrl,
      wpPath: guardOpts.wpPath,
      localPack: !!guardOpts.localPack,
    });
  }
  return spawnSync(bin, list, spawnOpts);
}

function printErr(msg) {
  console.error(msg);
  process.exit(1);
}

function cliMain(argv) {
  const args = argv.slice(2);
  if (args[0] === '--assert') {
    try {
      assertRemoteAllowed({
        bin: args[1] || 'ssh',
        siteUrl: process.env.DEPLOY_SITE_URL || '',
        wpPath: process.env.DEPLOY_WP_PATH || '',
      });
    } catch (e) {
      printErr(e && e.message ? e.message : String(e));
    }
    return;
  }
  if (args[0] === '--assert-local-pack') {
    try {
      assertRemoteAllowed({ bin: 'rsync', args: ['/tmp/a/', '/tmp/b/'], localPack: true });
    } catch (e) {
      printErr(e && e.message ? e.message : String(e));
    }
    return;
  }
  if (args[0] === '--exec') {
    let localPack = false;
    let rest = args.slice(1);
    if (rest[0] === '--local-pack') {
      localPack = true;
      rest = rest.slice(1);
    }
    if (rest[0] === '--') rest = rest.slice(1);
    const bin = rest[0];
    const binArgs = rest.slice(1);
    if (!bin) printErr('remote-guard --exec: ikili yok');
    const res = spawnGuarded(
      bin,
      binArgs,
      { encoding: 'utf8', cwd: REPO_ROOT, stdio: 'inherit' },
      { localPack }
    );
    process.exit(res.status ?? 1);
  }
  printErr('Kullanım: remote-guard.mjs --assert | --assert-local-pack | --exec [--local-pack] -- <bin> <args>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cliMain(process.argv);
}
