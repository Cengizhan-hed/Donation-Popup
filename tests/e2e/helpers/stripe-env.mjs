/**
 * 12.4 Stripe (YALNIZ yerel): test anahtarlarını `.env.stripe.local` dosyasından okur, doğrular, maskeler.
 * Değerler hiçbir zaman yazdırılmaz; yalnız var/yok ve önek doğrulaması döner.
 *
 * Dosya araması: WDP_STRIPE_ENV_FILE → çalışma kökü → git ortak dizininin üstü (ana depo kökü; worktree'ler için).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

/** Gizli anahtar/imza desenleri (günlük/rapor maskesi ve sızıntı taraması). */
export const SECRET_RE = /\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{6,}|\bwhsec_[A-Za-z0-9]{6,}/g;

/**
 * @param {string} text
 * @return {string}
 */
export function maskSecrets(text) {
  return String(text || '').replace(SECRET_RE, (m) => `${m.split('_').slice(0, m.startsWith('whsec') ? 1 : 2).join('_')}_***`);
}

/**
 * @param {string} root Çalışma kökü (worktree ya da ana depo).
 * @return {string} Bulunan dosya yolu ya da ''.
 */
export function findStripeEnvFile(root) {
  const candidates = [];
  if (process.env.WDP_STRIPE_ENV_FILE) candidates.push(path.resolve(process.env.WDP_STRIPE_ENV_FILE));
  candidates.push(path.join(root, '.env.stripe.local'));
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) {
    candidates.push(path.join(path.dirname(r.stdout.trim()), '.env.stripe.local'));
  }
  return candidates.find((f) => fs.existsSync(f)) || '';
}

/**
 * Anahtarları yükler ve doğrular. process.env'e YAZMAZ (alt süreçlere yalnız gerektiğinde açıkça verilir).
 * @param {string} root
 * @return {{ state: 'ok'|'missing'|'invalid', reason: string, file: string, keys: { publishable: string, secret: string } }}
 */
export function loadStripeKeys(root) {
  const file = findStripeEnvFile(root);
  const empty = { publishable: '', secret: '' };
  if (!file) return { state: 'missing', reason: '.env.stripe.local bulunamadı', file: '', keys: empty };
  let parsed;
  try {
    parsed = parseEnv(fs.readFileSync(file, 'utf8'));
  } catch {
    return { state: 'invalid', reason: '.env.stripe.local okunamadı/çözümlenemedi', file, keys: empty };
  }
  const secret = String(parsed.STRIPE_TEST_SECRET_KEY || '').trim();
  const publishable = String(parsed.STRIPE_TEST_PUBLISHABLE_KEY || '').trim();
  if (!secret || !publishable) {
    return { state: 'missing', reason: 'STRIPE_TEST_SECRET_KEY / STRIPE_TEST_PUBLISHABLE_KEY eksik', file, keys: empty };
  }
  // Canlı anahtar ya da başka biçim: HİÇBİR ŞEY yapılmaz (değer yazdırılmaz).
  if (!secret.startsWith('sk_test_')) {
    const live = secret.startsWith('sk_live_') || secret.startsWith('rk_live_');
    return { state: 'invalid', reason: live ? 'gizli anahtar CANLI (sk_live_) — durduruldu' : 'gizli anahtar sk_test_ ile başlamıyor — durduruldu', file, keys: empty };
  }
  if (!publishable.startsWith('pk_test_')) {
    return { state: 'invalid', reason: 'yayınlanabilir anahtar pk_test_ ile başlamıyor — durduruldu', file, keys: empty };
  }
  return { state: 'ok', reason: '', file, keys: { publishable, secret } };
}

/**
 * Ortam kopyasından STRIPE_* değişkenlerini çıkarır (Playwright/PHP sunucusu anahtar görmez).
 * @param {Record<string, string|undefined>} env
 * @return {Record<string, string|undefined>}
 */
export function withoutStripeEnv(env) {
  const out = { ...env };
  for (const k of Object.keys(out)) {
    if (/^STRIPE_/i.test(k)) delete out[k];
  }
  return out;
}
