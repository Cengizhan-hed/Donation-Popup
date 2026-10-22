/**
 * Merkezi uzak erişim kilidi.
 *
 * spawn/exec düzeyinde: ssh / scp / sftp / rsync (uzak) ve WP-CLI köprüleri
 * bu modülden geçer. build/handoff/REMOTE_FREEZE varsa işlem yok.
 *
 * Operatör kapısı: yalnız CLAUDECODE=1 ve Cursor ajan işareti yokken.
 * Yerel paket rsync (--local-pack) uzak sayılmaz; freeze/kapı onu durdurmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertRemoteTarget,
  findTargetByAlias,
  hasBlockedHedefMention,
} from './deploy-guards.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../..');
export const REMOTE_FREEZE_PATH = path.join(REPO_ROOT, 'build/handoff/REMOTE_FREEZE');
export const REMOTE_BINS = new Set(['ssh', 'scp', 'sftp', 'rsync']);

export const FREEZE_MESSAGE =
  'UZAK ERİŞİM KİLİTLİ (2026-10-22): build/handoff/REMOTE_FREEZE dosyası var. ' +
  'İzinli uzak siteler dahil SSH/SCP/SFTP/rsync/WP-CLI gönderilemez. ' +
  'Kilidi yalnız kullanıcı kaldırır.';

export const OPERATOR_GATE_MESSAGE =
  'Uzak işlemler yalnız Claude tarafından merkezi koruma üzerinden çalıştırılır.';

/**
 * Cursor ajan kabuğunda görülen adlar (değer yok).
 * Editörden gelenler HARİÇ: CURSOR_EXTENSION_HOST_ROLE, CURSOR_LAYOUT,
 * CURSOR_SPAWNED_BY_EXTENSION_ID, CURSOR_SPAWN_CHAIN, CURSOR_WORKSPACE_LABEL.
 */
export const CURSOR_AGENT_ENV_KEYS = [
  'CURSOR_INVOKED_AS',
  'CURSOR_AGENT',
  '__CURSOR_SANDBOX_ENV_RESTORE',
  'CURSOR_RIPGREP_PATH',
  'CURSOR_CONVERSATION_ID',
  'CURSOR_REQUEST_ID',
];

export const CURSOR_EDITOR_ENV_KEYS = [
  'CURSOR_EXTENSION_HOST_ROLE',
  'CURSOR_LAYOUT',
  'CURSOR_SPAWNED_BY_EXTENSION_ID',
  'CURSOR_SPAWN_CHAIN',
  'CURSOR_WORKSPACE_LABEL',
];

const MAX_SSH_RETRIES = 1;

/**
 * @returns {boolean}
 */
export function isRemoteFrozen(freezePath = REMOTE_FREEZE_PATH) {
  return fs.existsSync(freezePath);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function assertOperatorGate(env = process.env) {
  const e = env || {};
  if (String(e.CLAUDECODE || '') !== '1') {
    throw new Error(OPERATOR_GATE_MESSAGE);
  }
  for (const key of CURSOR_AGENT_ENV_KEYS) {
    if (e[key] !== undefined && String(e[key]) !== '') {
      throw new Error(OPERATOR_GATE_MESSAGE);
    }
  }
}

/**
 * @param {string[]} args
 * @returns {string[]}
 */
export function redactSpawnArgs(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (a === '-i') {
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
    if (/^[a-zA-Z0-9._-]+:~/.test(a)) return true;
  }
  return false;
}

const SSH_TAKES_VALUE = new Set([
  '-i',
  '-p',
  '-P',
  '-l',
  '-o',
  '-F',
  '-J',
  '-b',
  '-c',
  '-S',
  '-e',
  '--rsh',
]);

/**
 * @param {string} bin
 * @param {string[]} args
 * @returns {{ alias: string, remoteCommand: string, rsyncDest: string }}
 */
export function parseRemoteInvocation(bin, args) {
  const base = path.basename(String(bin || ''));
  const list = (args || []).map(String);
  let alias = '';
  let remoteCommand = '';
  let rsyncDest = '';

  if (base === 'ssh') {
    const pos = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a === '--') {
        pos.push(...list.slice(i + 1));
        break;
      }
      if (a.startsWith('-')) {
        const flag = a.includes('=') ? a.slice(0, a.indexOf('=')) : a;
        if (SSH_TAKES_VALUE.has(flag) && !a.includes('=')) i += 1;
        continue;
      }
      pos.push(a);
    }
    alias = pos[0] || '';
    if (alias.includes('@')) {
      alias = '';
    }
    remoteCommand = pos.slice(1).join(' ');
  } else if (base === 'scp' || base === 'sftp' || base === 'rsync') {
    for (const a of list) {
      if (a.startsWith('-')) continue;
      const m = a.match(/^([a-zA-Z0-9._-]+):(.+)$/);
      if (m && !/^[A-Za-z]:[\\/]/.test(a)) {
        alias = m[1];
        rsyncDest = a;
        break;
      }
      const m2 = a.match(/^([a-zA-Z0-9._-]+@[^:]+):(.+)$/);
      if (m2) {
        alias = '';
        rsyncDest = a;
        break;
      }
    }
  }

  return { alias, remoteCommand, rsyncDest };
}

function isSshConnectionError(res) {
  const t = `${res?.stderr || ''} ${res?.stdout || ''} ${res?.error?.message || ''} ${res?.error?.code || ''}`;
  return /connection (refused|reset|timed out|closed)|broken pipe|wordfence|no route to host|ECONNRESET|ETIMEDOUT/i.test(
    t
  );
}

/**
 * @param {{
 *   bin?: string,
 *   args?: string[],
 *   siteUrl?: string,
 *   wpPath?: string,
 *   alias?: string,
 *   remoteCommand?: string,
 *   rsyncDest?: string,
 *   localPack?: boolean,
 *   env?: NodeJS.ProcessEnv,
 *   freezePath?: string,
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

  assertOperatorGate(opts.env || process.env);

  if (isRemoteFrozen(opts.freezePath || REMOTE_FREEZE_PATH)) {
    throw new Error(FREEZE_MESSAGE);
  }

  const parsed = parseRemoteInvocation(bin, args);
  const alias = String(opts.alias || parsed.alias || '').trim();
  const siteUrl = String(opts.siteUrl || '').trim();
  const wpPath = String(opts.wpPath || '').trim();
  const remoteCommand = String(opts.remoteCommand || parsed.remoteCommand || '');
  const rsyncDest = String(opts.rsyncDest || parsed.rsyncDest || '');
  const hay = `${alias} ${siteUrl} ${wpPath} ${remoteCommand} ${rsyncDest} ${args.join(' ')}`;

  if (hasBlockedHedefMention(hay)) {
    throw new Error('Kara liste: hedefdernegi.org (canlı) kesin engelli.'); // live-scan:blacklist-def
  }

  if (REMOTE_BINS.has(bin) || alias || siteUrl || wpPath || remoteCommand || rsyncDest) {
    const fromAlias = findTargetByAlias(alias);
    assertRemoteTarget({
      alias: alias || fromAlias?.sshAlias,
      wpPath: wpPath || fromAlias?.wpPath,
      siteUrl: siteUrl || fromAlias?.siteUrl,
      remoteCommand,
      rsyncDest,
    });
  }

  return { ok: true, localPack: false };
}

/**
 * ssh / scp / sftp / rsync spawn. Uzak ikililer assertRemoteAllowed + assertRemoteTarget.
 *
 * SSH bağlantı hatasında en fazla 1 tekrar (Wordfence).
 *
 * @param {string} bin
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptions} [spawnOpts]
 * @param {{ siteUrl?: string, wpPath?: string, alias?: string, localPack?: boolean, env?: NodeJS.ProcessEnv }} [guardOpts]
 */
export function spawnGuarded(bin, args, spawnOpts = {}, guardOpts = {}) {
  const base = path.basename(String(bin));
  const list = Array.isArray(args) ? args.map(String) : [];
  const parsed = parseRemoteInvocation(base, list);
  if (REMOTE_BINS.has(base)) {
    assertRemoteAllowed({
      bin: base,
      args: list,
      siteUrl: guardOpts.siteUrl,
      wpPath: guardOpts.wpPath,
      alias: guardOpts.alias || parsed.alias,
      remoteCommand: parsed.remoteCommand,
      rsyncDest: parsed.rsyncDest,
      localPack: !!guardOpts.localPack,
      env: guardOpts.env,
    });
  }

  const remoteSsh = REMOTE_BINS.has(base) && !(guardOpts.localPack && base === 'rsync' && !isRemoteRsync(list));
  let res = spawnSync(bin, list, spawnOpts);
  if (remoteSsh && isSshConnectionError(res)) {
    let retries = 0;
    while (retries < MAX_SSH_RETRIES) {
      retries += 1;
      res = spawnSync(bin, list, spawnOpts);
      if (!isSshConnectionError(res)) break;
    }
  }
  return res;
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
        alias: process.env.DEPLOY_SSH_ALIAS || '',
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
