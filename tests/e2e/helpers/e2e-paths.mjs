/**
 * E2E çıktı/defter/kilit yolları — ortam başına (paralel koşular ezmesin).
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { peekActiveProfile } from './profile.mjs';

export function safeProfileId(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

export function activeProfileId() {
  const fromEnv = safeProfileId(process.env.WDP_E2E_PROFILE_ID);
  if (fromEnv) return fromEnv;
  return safeProfileId(peekActiveProfile()?.id);
}

/**
 * Çıktı klasörleri: profil yoksa local (yazma yine ortam altına).
 * @param {string} [raw]
 */
export function outputProfileId(raw) {
  return safeProfileId(raw) || activeProfileId() || 'local';
}

/**
 * Defter/kilit: profil id zorunlu.
 * @param {string} [raw]
 */
export function requireProfileId(raw) {
  const id = safeProfileId(raw) || activeProfileId();
  if (!id) throw new Error('E2E profil id yok');
  return id;
}

export function hashSiteUrl(url) {
  const s = String(url || '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();
  if (!s) return '';
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

export function registryBaseDir() {
  return path.join(ROOT, 'build/e2e/registry');
}

export function registryDir(envId) {
  return path.join(registryBaseDir(), requireProfileId(envId));
}

export function registryPointerPath(envId) {
  return path.join(registryDir(envId), 'CURRENT');
}

export function registryFilePath(envId, runId) {
  const id = String(runId || '').replace(/[^A-Za-z0-9._:-]/g, '');
  if (!id) throw new Error('registryFilePath: runId yok');
  return path.join(registryDir(envId), `${id}.json`);
}

export function lockDir() {
  return path.join(ROOT, 'build/e2e/locks');
}

export function lockFilePath(envId) {
  return path.join(lockDir(), `${requireProfileId(envId)}.lock`);
}

export function debugDirFor(envId) {
  return path.join(ROOT, 'build/e2e/debug', outputProfileId(envId));
}

export function tracesDirFor(envId) {
  return path.join(ROOT, 'build/e2e/traces', outputProfileId(envId));
}

export function reportDirFor(envId) {
  return path.join(ROOT, 'build/e2e/report', outputProfileId(envId));
}

export function canaryAlertPathFor(envId) {
  return path.join(ROOT, 'build/e2e', `CANARY-ALERT-${outputProfileId(envId)}.txt`);
}

export function currentProfileDir(envId) {
  return path.join(ROOT, 'build/e2e/current', outputProfileId(envId));
}

export function diffDirFor(envId) {
  return path.join(ROOT, 'build/e2e/diff', outputProfileId(envId));
}

export function runJsonFor(envId) {
  return path.join(currentProfileDir(envId), 'run.json');
}
