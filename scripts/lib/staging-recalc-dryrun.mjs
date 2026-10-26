/**
 * staging30 toplam yeniden hesap KURU ÇALIŞTIRMA mantığı. Ağ yok (remote enjekte edilir).
 * PHP dosyası yazma çağrısı içermez (çalıştırmadan önce statik denetim); yalnız staging-hedef.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildGuardedEvalFileCommand } from './deploy-guards.mjs';
import { ROOT, assertReadOnlyReportSource, assertStagingTarget, parseJsonOutput, verifyRemoteSite } from './staging-tools.mjs';

export const RECALC_EVAL_FILE = 'tests/e2e/helpers/recalc-dryrun.php';

/** Yazma modunu çağıran kalıp (dry_run=false / run(..., false)). */
const WRITE_MODE_RE = /->\s*run\s*\([^;]*,\s*false\s*\)|recalculate_product_donation_totals\s*\([^;]*,\s*false\s*\)/i;

/** @param {string} src */
export function assertDryRunSource(src) {
  const ro = assertReadOnlyReportSource(src);
  if (!ro.ok) return ro;
  if (WRITE_MODE_RE.test(src)) return { ok: false, reason: 'PHP dosyası dry_run=false çağrısı içeriyor.' };
  if (!/WDP_DRY_RUN_ONLY/.test(src)) return { ok: false, reason: 'PHP dosyasında WDP_DRY_RUN_ONLY koruması yok.' };
  return { ok: true };
}

/**
 * @param {Record<string,string>} env
 * @param {{ remoteFn: (cmd: string) => string, readFile?: (rel: string) => Buffer }} deps
 */
export function runRecalcDryRun(env, deps) {
  const t = assertStagingTarget(env, undefined);
  if (!t.ok) throw new Error(t.reason);
  const readFile = deps.readFile || ((rel) => fs.readFileSync(path.join(ROOT, rel)));
  const buf = readFile(RECALC_EVAL_FILE);
  const chk = assertDryRunSource(buf.toString('utf8'));
  if (!chk.ok) throw new Error(chk.reason);
  verifyRemoteSite(deps.remoteFn, env);
  const res = parseJsonOutput(
    deps.remoteFn(buildGuardedEvalFileCommand(env.DEPLOY_WP_PATH, { tmpPrefix: 'wdp-recalc', b64: buf.toString('base64') }))
  );
  if (!res.ok) throw new Error(`recalc-dryrun: ${res.error || 'bilinmiyor'}`);
  if (res.dry_run !== true || Number(res.written) !== 0) throw new Error('recalc-dryrun: beklenmeyen yazma bildirimi.');
  return res;
}

/** @param {{ rows: any[], base_currency?: string, differs?: number, unconverted?: number }} res */
export function toMarkdown(res) {
  const lines = [
    `Para birimi (ana): ${res.base_currency || '-'} | ürün: ${res.rows.length} | farklı: ${res.differs} | dönüştürülemeyen satır: ${res.unconverted}`,
    '',
    '| Ürün | Başlık | Eski toplam | Hesaplanan | Fark | Eski/yeni bağışçı | Sipariş | Uyarı |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const r of res.rows) {
    const title = String(r.title || '').replace(/\|/g, '/');
    const warn = r.unconverted > 0 ? `kur bulunamadı (${r.unconverted})` : '';
    lines.push(`| ${r.product_id} | ${title} | ${r.old_total ?? '-'} | ${r.new_total} | ${r.delta ?? '-'} | ${r.old_donors ?? '-'} / ${r.new_donors} | ${r.orders} | ${warn} |`);
  }
  return lines.join('\n');
}
