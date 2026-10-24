/**
 * Sağlık kontrolü: hata kaynağı ayırt etme + eklenti açık/kapalı karşılaştırma. Saf işlevler (ağ yok).
 *
 * Kural: hata kaynağı dosya yolu `plugins/woo-donation-popup/` içindeyse "bizden"; başka eklenti,
 * tema, mu-plugin ya da WP çekirdeği ise "üçüncü taraf" (geri dönüşü tetiklemez). Yol yoksa "bilinmiyor"
 * (temkinli: kırmızı sayılır).
 */
import fs from 'node:fs';
import path from 'node:path';

export const OUR_SLUG = 'woo-donation-popup';

const LEVEL_RE = /\bPHP (Fatal error|Parse error|Warning|Notice|Deprecated|Recoverable fatal error)\b|\b(Fatal error|Parse error|Warning|Notice|Deprecated):/i;
const FILE_RE = /\bin (\/[^\s:]+?\.php)(?::(\d+)| on line (\d+))/i;
const STACK_FILE_RE = /^#\d+\s+(\/[^\s(]+?\.php)\(/;
const TS_RE = /^\[(\d{1,2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2})(?: ([A-Za-z/_+-]+))?\]/;

/**
 * @param {string} file mutlak yol
 * @returns {{ kind: 'ours'|'third_party'|'unknown', owner: string }}
 */
export function classifyPath(file) {
  const f = String(file || '').replace(/\\/g, '/');
  if (!f) return { kind: 'unknown', owner: '' };
  const ours = new RegExp(`/plugins/${OUR_SLUG}/`);
  if (ours.test(f)) return { kind: 'ours', owner: OUR_SLUG };
  const m = f.match(/\/(plugins|mu-plugins|themes)\/([^/]+)/);
  if (m) return { kind: 'third_party', owner: `${m[1]}/${m[2]}` };
  if (/\/wp-(admin|includes)\//.test(f)) return { kind: 'third_party', owner: 'wp-core' };
  return { kind: 'unknown', owner: '' };
}

/** Kişisel veri sızmasın: e-posta maskele, uzunluk kes. */
export function sanitizeLogLine(line) {
  return String(line || '').replace(/[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/g, '<e-posta>').slice(0, 300);
}

/**
 * @param {string} line
 * @returns {number|null} epoch sn (UTC varsayımı) ya da null
 */
export function logLineEpoch(line) {
  const m = String(line || '').match(TS_RE);
  if (!m) return null;
  const t = Date.parse(`${m[1].replace(/-/g, ' ')} UTC`);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/**
 * Günlük satırlarını gruplar (zaman damgalı satır = yeni kayıt; yığın izi satırları öncekine eklenir),
 * `sinceEpoch` öncesi kayıtları atar, kaynağa göre ayırır. Kaynak: kayıt başlığındaki ilk dosya yolu;
 * yoksa yığın izindeki ilk dosya.
 *
 * @param {string[]} lines
 * @param {{ sinceEpoch?: number }} [opts]
 */
export function classifyLogLines(lines, opts = {}) {
  const since = Number(opts.sinceEpoch || 0);
  const records = [];
  for (const raw of lines || []) {
    const line = String(raw || '');
    if (!line.trim()) continue;
    const ts = logLineEpoch(line);
    if (ts !== null || LEVEL_RE.test(line) || !records.length) {
      records.push({ ts, head: line, extra: [] });
    } else {
      records[records.length - 1].extra.push(line);
    }
  }
  const out = { ours: [], thirdParty: [], unknown: [], fatalOurs: 0, fatalThirdParty: 0 };
  let lastTs = null;
  for (const r of records) {
    if (r.ts !== null) lastTs = r.ts;
    const effective = r.ts !== null ? r.ts : lastTs;
    if (since && effective !== null && effective < since) continue;
    const level = (r.head.match(LEVEL_RE) || [])[1] || (r.head.match(LEVEL_RE) || [])[2] || '';
    if (!level) continue;
    const isFatal = /fatal|parse/i.test(level);
    let file = (r.head.match(FILE_RE) || [])[1] || '';
    if (!file) {
      for (const e of r.extra) {
        const sm = e.match(STACK_FILE_RE);
        if (sm) { file = sm[1]; break; }
      }
    }
    const cls = classifyPath(file);
    const entry = {
      level: level.replace(/^PHP /i, ''),
      fatal: isFatal,
      owner: cls.owner,
      file: file.replace(/^.*\/wp-content\//, 'wp-content/'),
      line: Number((r.head.match(FILE_RE) || [])[2] || (r.head.match(FILE_RE) || [])[3] || 0),
    };
    if (cls.kind === 'ours') { out.ours.push(entry); if (isFatal) out.fatalOurs++; }
    else if (cls.kind === 'third_party') { out.thirdParty.push(entry); if (isFatal) out.fatalThirdParty++; }
    else out.unknown.push(entry);
  }
  return out;
}

/**
 * Günlük sınıflamasına göre PHP sağlık "geri dönüş sebebi". Bizden ya da bilinmeyen FATAL kırmızı;
 * üçüncü taraf her seviye yalnız bilgi. Bizden uyarı/bildirim kırmızı değil (açık/kapalı karşılaştırması bakar).
 *
 * @param {ReturnType<typeof classifyLogLines>} cls
 */
export function logVerdict(cls) {
  const reasons = [];
  const ourFatal = cls.ours.filter((e) => e.fatal).length;
  const unkFatal = cls.unknown.filter((e) => e.fatal).length;
  if (ourFatal) reasons.push(`bizden PHP fatal x${ourFatal}`);
  if (unkFatal) reasons.push(`kaynağı bilinmeyen PHP fatal x${unkFatal}`);
  const owners = [...new Set(cls.thirdParty.map((e) => e.owner))];
  return {
    red: reasons.length > 0,
    reasons,
    thirdParty: owners.length ? { count: cls.thirdParty.length, fatal: cls.fatalThirdParty, owners } : null,
  };
}

const HTML_ISSUE_RE = /\b(Warning|Notice|Deprecated|Fatal error|Parse error): [^\n]*? in (\/[^\s<]+?\.php) on line (\d+)/g;

/**
 * Uzak salt-okunur sayfa gezintisi: HTML'e basılan PHP uyarı/bildirimlerini kaynağa göre sayar
 * (`display_errors` açık sitelerde görünür; kapalıysa 0). Üçüncü taraf ayrı sayılır, karşılaştırmaya girmez.
 *
 * @param {string} html
 * @returns {{ ours: number, thirdParty: number, unknown: number }}
 */
export function scanHtmlIssues(html) {
  const text = String(html || '').replace(/<\/?(b|strong|br\s*\/?)>/gi, '');
  const out = { ours: 0, thirdParty: 0, unknown: 0 };
  for (const m of text.matchAll(HTML_ISSUE_RE)) {
    const k = classifyPath(m[2]).kind;
    if (k === 'ours') out.ours++;
    else if (k === 'third_party') out.thirdParty++;
    else out.unknown++;
  }
  return out;
}

/**
 * Sayfa gezintisi ölçümü (karşılaştırma biçimi): sunucu hatası (HTTP >= 500) bilinmeyen sayılır.
 * Uzakta tarayıcı yok → konsol hatası 0 (yalnız yerel açık/kapalı koşusu konsolu ölçer).
 *
 * @param {{ status?: number, text?: string }|null} res
 */
export function browseMetricsFromResponse(res) {
  if (!res) return { consoleErrors: 0, phpIssues: 0, ours: 0, thirdParty: 0 };
  const scan = scanHtmlIssues(res.text);
  const server = Number(res.status || 0) >= 500 ? 1 : 0;
  return { consoleErrors: 0, phpIssues: scan.ours + scan.unknown + server, ours: scan.ours, thirdParty: scan.thirdParty };
}

/**
 * Kırmızı sayfaları kaynağa göre etiketler. Üçüncü taraf: (a) kurulumdan ÖNCE de kırmızıydı ya da
 * (b) günlük yeni kaydı yalnız üçüncü taraf fatal içeriyor (bizden/bilinmeyen fatal yok).
 *
 * @param {Array<{ name: string, ok: boolean, skipped?: boolean, reason?: string }>} pages
 * @param {{ cls?: ReturnType<typeof classifyLogLines>, baselineRedNames?: string[] }} [ctx]
 */
export function attributePages(pages, ctx = {}) {
  const cls = ctx.cls || { ours: [], thirdParty: [], unknown: [], fatalThirdParty: 0 };
  const base = new Set(ctx.baselineRedNames || []);
  const ourFatal = cls.ours.some((e) => e.fatal) || cls.unknown.some((e) => e.fatal);
  const tpFatal = cls.thirdParty.some((e) => e.fatal);
  return (pages || []).map((p) => {
    if (p.ok || p.skipped) return p;
    if (!ourFatal && (base.has(p.name) || tpFatal)) {
      return { ...p, thirdParty: true, reason: `üçüncü taraf: ${p.reason || 'kırmızı'}` };
    }
    return { ...p, source: 'ours_or_unknown' };
  });
}

/** Geri dönüşü tetikleyen sayfa var mı (üçüncü taraf hariç). */
export function pagesTriggerRollback(pages) {
  return (pages || []).some((p) => !p.ok && !p.skipped && !p.thirdParty);
}

/**
 * Eklenti açık/kapalı karşılaştırması. Eklenti AÇIKKEN bir sayfada konsol hatası ya da PHP uyarı/bildirimi
 * kapalıya göre fazlaysa kırmızı. Üçüncü taraf kaynaklar iki tarafta eşit olduğundan fark vermez.
 *
 * @param {Record<string, { consoleErrors?: number, phpIssues?: number, ours?: number }>} off
 * @param {Record<string, { consoleErrors?: number, phpIssues?: number, ours?: number }>} on
 * @param {{ tolerance?: number }} [opts]
 */
export function compareOnOff(off, on, opts = {}) {
  const tol = Number(opts.tolerance || 0);
  const rows = [];
  for (const name of Object.keys(on || {})) {
    const a = off?.[name] || {};
    const b = on[name] || {};
    const dConsole = Number(b.consoleErrors || 0) - Number(a.consoleErrors || 0);
    const dPhp = Number(b.phpIssues || 0) - Number(a.phpIssues || 0);
    const ours = Number(b.ours || 0);
    rows.push({ name, dConsole, dPhp, ours, red: dConsole > tol || dPhp > tol || ours > 0 });
  }
  return { red: rows.some((r) => r.red), rows };
}

/**
 * Uzak (kapatma yasak): "açık" sayıları tabana kıyasla.
 * @param {Record<string, { consoleErrors?: number, phpIssues?: number }>} baseline
 * @param {Record<string, { consoleErrors?: number, phpIssues?: number }>} current
 */
export function compareToBaseline(baseline, current) {
  const rows = [];
  for (const name of Object.keys(current || {})) {
    const a = baseline?.[name];
    if (!a) continue; // tabanda olmayan sayfa karşılaştırılamaz
    const b = current[name] || {};
    const dConsole = Number(b.consoleErrors || 0) - Number(a.consoleErrors || 0);
    const dPhp = Number(b.phpIssues || 0) - Number(a.phpIssues || 0);
    // Eski sürümde de olan "bizden" kayıt yeni hata sayılmaz: yalnız artış.
    const dOurs = Number(b.ours || 0) - Number(a.ours || 0);
    rows.push({ name, dConsole, dPhp, ours: Math.max(0, dOurs), red: dConsole > 0 || dPhp > 0 || dOurs > 0 });
  }
  return { red: rows.some((r) => r.red), rows };
}

export function formatOnOffLine(res) {
  const bad = res.rows.filter((r) => r.red).map((r) => `${r.name}(+konsol ${r.dConsole}, +php ${r.dPhp}, bizden ${r.ours})`);
  return `Açık/kapalı: ${res.red ? 'KIRMIZI' : 'YEŞİL'} ${res.rows.length} sayfa${bad.length ? ` — ${bad.join('; ')}` : ''}`;
}

/**
 * Geri dönüş bildirimi: build/handoff/SHIP-GERI-DONUS-<env>-<damga>.md
 */
export function writeRollbackNotice(dir, info) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `SHIP-GERI-DONUS-${info.env}-${info.stamp}.md`);
  const body = [
    `# Ship otomatik geri dönüş — ${info.env} (${info.stamp})`,
    '',
    `- Sürüm: ${info.version}`,
    `- Sebep: ${(info.reasons || []).join('; ') || 'sağlık kırmızı'}`,
    `- Kırmızı sayfalar: ${(info.redPages || []).join(', ') || '-'}`,
    `- Üçüncü taraf (geri dönüşü tetiklemedi): ${(info.thirdParty || []).join(', ') || '-'}`,
    `- Geri dönüş sonrası: ${info.after || '-'}`,
    '',
  ].join('\n');
  fs.writeFileSync(file, body, 'utf8');
  return file;
}
