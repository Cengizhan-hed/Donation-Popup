#!/usr/bin/env node
/**
 * i18n doğrulama (Faz 5 güvencesi).
 *
 * Kurallar (kapsam: --files verilirse yalnız o PHP dosyaları, yoksa hepsi):
 *  1. Güncel gettext çağrılarının msgid/plural/bağlamında Türkçe harf ya da bilinen Türkçe sözcük YOK.
 *  2. Her çağrının (msgctxt, msgid) karşılığı .po'da var ve msgstr boş değil.
 *  3. msgid ile msgstr'de yer tutucu ve HTML etiket çoklu kümeleri eşit.
 *  4. Altın parite: altın kayıttaki (dönüşümden önceki) Türkçe metinlerin HEPSİ güncel çağrıların .po
 *     çevirileri arasında birebir ve aynı sayıda bulunur (kaybolan/değişen = HATA). Fazladan metin (yeni
 *     sarılan düz Türkçe) HATA değil, bilgi olarak listelenir.
 *
 *   node tools/i18n/verify.mjs [--files a.php,b.php] [--po p1.po,p2.po] [--parts] [--golden dosya.json] [--json]
 *   (--po verilmezse languages/woo-donation-popup-tr_TR.po; --parts: languages/parts/*.po de okunur)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parsePoEntries } from './merge-po.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WDP_I18N_ROOT
  ? path.resolve(process.env.WDP_I18N_ROOT)
  : path.resolve(__dirname, '../..');

export const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;
/** Yalnız Türkçe'ye özgü sözcükler (İngilizce ile çakışmayanlar). */
export const TURKISH_WORDS = [
  'bağış', 'sepet', 'sepete', 'ödeme', 'tutar', 'ürün', 'ayar', 'ayarlar', 'ayarları', 'lütfen', 'geçersiz', 'kaydet',
  'başarı', 'giriniz', 'seçin', 'renk', 'rengi', 'metin', 'metni', 'alan', 'alanı', 'göster', 'gösterir', 'hissedar',
  'hisse', 'hisseli', 'kampanya', 'ithaf', 'telefon numarası', 'bulunamadı', 'varsayılan', 'yalnızca', 'için', 'veya',
  'olarak', 'kullanılır', 'açık', 'kapalı', 'boşsa', 'oluştu', 'tekrar deneyin', 'kategori', 'sayfa', 'başlık', 'buton',
  'butonu', 'düğme', 'düğmeleri', 'arka plan', 'gölge', 'köşe', 'önerilen', 'soyad', 'eposta', 'e-posta adresi',
];

const WORD_RE = new RegExp(`(^|[^\\p{L}])(${TURKISH_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}])`, 'iu');

export function looksTurkish(s) {
  const t = String(s || '');
  if (!t) return false;
  return TURKISH_LETTERS.test(t) || WORD_RE.test(t);
}

/** %s %d %1$s %% ve {…} dışı yer tutucular + HTML etiketleri */
export function tokensOf(s) {
  const t = String(s || '');
  const ph = (t.match(/%(?:\d+\$)?[sdfFuxXeEgGcboi]|%%/g) || []).map((x) => x);
  const tags = (t.match(/<\/?[a-zA-Z][^>]*>/g) || []).map((x) => x.replace(/\s+/g, ' ').replace(/\s*\/>$/, '/>'));
  return { ph: ph.sort(), tags: tags.sort() };
}

function eqArr(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function readCalls(root) {
  const r = spawnSync('php', [path.join(root, 'tools/i18n/token-scan.php'), root], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`token-scan başarısız: ${String(r.stderr || '').slice(0, 300)}`);
  const j = JSON.parse(r.stdout);
  return Array.isArray(j.calls) ? j.calls : [];
}

function readPoMap(files) {
  /** @type {Map<string, any>} */
  const map = new Map();
  const conflicts = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const e of parsePoEntries(fs.readFileSync(f, 'utf8'))) {
      if (!e.msgid) continue;
      const key = `${e.msgctxt || ''}\u0004${e.msgid}`;
      const prev = map.get(key);
      if (prev && (prev.msgstr !== e.msgstr || prev.msgstrPlural.join('|') !== e.msgstrPlural.join('|'))) {
        conflicts.push(`${e.msgid}`);
      }
      map.set(key, e);
    }
  }
  return { map, conflicts };
}

/**
 * @param {{ root?: string, files?: string[], po?: string[], parts?: boolean, golden?: string }} opts
 */
export function verifyI18n(opts = {}) {
  const root = opts.root ? path.resolve(opts.root) : ROOT;
  const scope = (opts.files || []).map((f) => f.replace(/^\.\//, ''));
  const inScope = (file) => !scope.length || scope.includes(file);
  const goldenFile = opts.golden || path.join(root, 'tools/i18n/golden/golden-tr-source.json');
  const golden = JSON.parse(fs.readFileSync(goldenFile, 'utf8')).calls || [];
  const calls = readCalls(root).filter((c) => inScope(c.file));
  const poFiles = (opts.po && opts.po.length ? opts.po : [path.join(root, 'languages/woo-donation-popup-tr_TR.po')]).map((p) =>
    path.resolve(root, p)
  );
  if (opts.parts) {
    const dir = path.join(root, 'languages/parts');
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.po')) poFiles.push(path.join(dir, f));
  }
  const { map: po, conflicts } = readPoMap(poFiles);

  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const infos = [];
  for (const c of conflicts) errors.push(`po-çakışma: aynı msgid farklı çeviri: ${c.slice(0, 80)}`);

  /** @type {string[]} */
  const currentTr = [];
  let newWraps = 0;
  for (const c of calls) {
    const loc = `${c.file}:${c.line}`;
    for (const [label, val] of [['msgid', c.msgid], ['plural', c.plural], ['context', c.context]]) {
      if (val && looksTurkish(val)) errors.push(`turkce-${label}: ${loc} «${String(val).slice(0, 60)}»`);
    }
    const key = `${c.context || ''}\u0004${c.msgid}`;
    const e = po.get(key);
    if (!e) {
      errors.push(`po-yok: ${loc} «${String(c.msgid).slice(0, 60)}»`);
      continue;
    }
    const tr = c.plural ? e.msgstrPlural : [e.msgstr];
    if (!tr.length || tr.some((x) => !String(x).trim())) {
      errors.push(`po-bos: ${loc} «${String(c.msgid).slice(0, 60)}»`);
      continue;
    }
    const a = tokensOf(c.msgid);
    const b = tokensOf(tr[0]);
    if (!eqArr(a.ph, b.ph)) errors.push(`yer-tutucu: ${loc} «${String(c.msgid).slice(0, 50)}» ≠ «${String(tr[0]).slice(0, 50)}»`);
    if (!eqArr(a.tags, b.tags)) errors.push(`html-etiket: ${loc} «${String(c.msgid).slice(0, 50)}»`);
    // `#. YENI-SARMA`: dönüşümden önce gettext'e sarılmamış Türkçe metin (altın kayıt dışı); parite sayımına girmez.
    const newWrap = /YENI-SARMA/.test(String(e.comments || ''));
    if (c.plural) {
      const ap = tokensOf(c.plural);
      const bp = tokensOf(tr[1] ?? tr[0]);
      if (!eqArr(ap.ph, bp.ph)) errors.push(`yer-tutucu-çoğul: ${loc}`);
      if (!newWrap) currentTr.push(`${tr[0]}\u0001${tr[1] ?? tr[0]}`);
    } else if (!newWrap) {
      currentTr.push(String(tr[0]));
    } else {
      newWraps += 1;
    }
  }

  const goldenTr = golden
    .filter((g) => inScope(g.file))
    .map((g) => (g.plural ? `${g.msgid}\u0001${g.plural}` : String(g.msgid)));

  const count = (arr) => {
    const m = new Map();
    for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
    return m;
  };
  const gc = count(goldenTr);
  const cc = count(currentTr);
  let missing = 0;
  let extra = 0;
  for (const [k, n] of gc) {
    const d = n - (cc.get(k) || 0);
    if (d > 0) {
      missing += d;
      if (missing <= 25) errors.push(`parite-eksik(${d}): «${k.replace(/\u0001/g, ' | ').slice(0, 90)}»`);
    }
  }
  for (const [k, n] of cc) {
    const d = n - (gc.get(k) || 0);
    if (d > 0) {
      // Fazla = daha önce gettext'e sarılmamış (ya da ayar varsayılanı olarak düz duran) Türkçe metnin çevrilebilir hâle gelmesi.
      // Hata DEĞİL (kayıp yok); görünür metin altın kaydı (i18n:golden --compare) davranışı ayrıca korur. Bilgi olarak listelenir.
      extra += d;
      if (extra <= 25) infos.push(`parite-fazla(${d}): «${k.replace(/\u0001/g, ' | ').slice(0, 90)}»`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    infos,
    stats: { files: scope.length || 'hepsi', calls: calls.length, golden: goldenTr.length, missing, extra, po: po.size, newWraps },
  };
}

function parseArgs(argv) {
  const a = argv.filter((x) => x !== '--');
  const out = { files: [], po: [], parts: false, json: false, golden: '' };
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--files') out.files = String(a[++i] || '').split(',').filter(Boolean);
    else if (x === '--po') out.po = String(a[++i] || '').split(',').filter(Boolean);
    else if (x === '--golden') out.golden = String(a[++i] || '');
    else if (x === '--parts') out.parts = true;
    else if (x === '--json') out.json = true;
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const r = verifyI18n(args);
  if (args.json) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(`i18n:verify — çağrı=${r.stats.calls} altın=${r.stats.golden} eksik=${r.stats.missing} fazla=${r.stats.extra} yeni-sarma=${r.stats.newWraps} po=${r.stats.po}`);
    for (const e of r.errors.slice(0, 80)) console.log(`  ✗ ${e}`);
    for (const i of (r.infos || []).slice(0, 25)) console.log(`  ℹ ${i}`);
    if (r.errors.length > 80) console.log(`  … +${r.errors.length - 80} hata daha`);
    console.log(r.ok ? 'i18n:verify TEMİZ' : `i18n:verify KIRMIZI (${r.errors.length})`);
  }
  process.exit(r.ok ? 0 : 1);
}
