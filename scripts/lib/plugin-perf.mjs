/**
 * Eklentiye ait hız sayıları için saf yardımcılar (CLAUDE.md §25 hız kabul ölçütü). Tarayıcı/ağ yok; birim testli.
 *
 * - Eklenti URL'si eşleşmesi (`/wp-content/plugins/woo-donation-popup/` ve REST ad alanı).
 * - Chrome izi (CDP Tracing, `devtools.timeline` + `v8`) → eklenti betiklerinin ana iş parçacığı süresi (derleme +
 *   değerlendirme + işlev çağrısı aralıklarının birleşimi; iç içe olaylar iki kez sayılmaz) ve eklentiye atfedilen
 *   50 ms üzeri uzun görevler.
 * - `layout-shift` kayıtları → yalnız kaynağı eklenti öğesi olan kaymaların toplamı.
 * - Satır içi `<style id="donation-panel-inline-*">` boyutu (ham + gzip tahmini).
 * - Eşik değerlendirmesi (GEÇTİ/KALDI).
 */
import zlib from 'node:zlib';

export const PLUGIN_SLUG = 'woo-donation-popup';
export const LONG_TASK_MS = 50;

/** Kabul eşikleri (§25). `max` dahil (≤), `lt` hariç (<). */
export const THRESHOLDS = {
  uiLessRequests: { max: 0, unit: 'istek', label: 'Arayüzsüz: eklenti isteği' },
  uiLessBytes: { max: 0, unit: 'B', label: 'Arayüzsüz: eklenti baytı' },
  uiLessQueries: { max: 0, unit: 'sorgu', label: 'Arayüzsüz: ek sorgu' },
  uiLessCookies: { max: 0, unit: 'çerez', label: 'Arayüzsüz: eklenti çerezi' },
  uiLessDom: { max: 0, unit: 'öğe', label: 'Arayüzsüz: eklenti DOM işareti' },
  blocking: { max: 0, unit: 'dosya', label: 'Render engelleyen eklenti dosyası' },
  // §25 bütçe kararı (2026-10-29): CSS'in tamamı satır içi; yüzey başına ≤9 KB, sayfa toplamı ≤16 KB gzip; CSS dosyası 0.
  inlineCssSurfaceGzip: { max: 9 * 1024, unit: 'B', label: 'Satır içi CSS, en büyük yüzey (gzip)' },
  inlineCssGzip: { max: 16 * 1024, unit: 'B', label: 'Satır içi CSS, sayfa toplamı (gzip)' },
  cssGzip: { max: 0, unit: 'B', label: 'Eklenti CSS dosyası (ilk yük, gzip)' },
  jsGzip: { max: 25 * 1024, unit: 'B', label: 'Eklenti JS (ilk yük, gzip)' },
  mainThreadMs: { max: 50, unit: 'ms', label: 'Eklenti ana iş parçacığı (4× CPU)' },
  longTasks: { max: 0, unit: 'görev', label: 'Eklentiye atfedilen uzun görev (>50 ms)' },
  cls: { max: 0, unit: '', label: 'CLS katkısı (eklenti kaynaklı)' },
  inpOpen: { lt: 200, unit: 'ms', label: 'INP: dokunma → panel' },
  inpAmount: { lt: 200, unit: 'ms', label: 'INP: tutar kartı' },
  tapToPanel: { lt: 100, unit: 'ms', label: 'Dokunuş → panel (5 koşu medyanı)' },
};

/**
 * Adres eklentiye mi ait: eklenti dizinindeki dosya ya da eklentinin REST ad alanı.
 *
 * @param {string} url Adres.
 * @param {string} [slug] Eklenti klasörü.
 * @return {boolean} Eklentiye ait mi.
 */
export function isPluginUrl(url, slug = PLUGIN_SLUG) {
  const u = String(url || '');
  if (!u) return false;
  if (u.includes(`/wp-content/plugins/${slug}/`)) return true;
  return /\/wp-json\/donation-panel\/|[?&]rest_route=%2Fdonation-panel|[?&]rest_route=\/donation-panel/.test(u);
}

/**
 * Eklenti çerezi mi (ad öneki; WooCommerce'in kendi sepet/oturum çerezleri sayılmaz).
 *
 * @param {string} name Çerez adı.
 * @return {boolean} Eklentiye ait mi.
 */
export function isPluginCookie(name) {
  return /^(?:wdp_|donation_panel|dp_)/i.test(String(name || ''));
}

/** @param {number[]} a Sayılar. @return {number} Medyan (boşsa NaN). */
export function median(a) {
  const s = a.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!s.length) return NaN;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Sayfa HTML'indeki eklenti satır içi stilleri (`<style id="donation-panel-inline-…">`).
 *
 * @param {string} html Sayfa.
 * @return {{count:number, raw:number, gzip:number, ids:string[], surfaces:Record<string, number>, maxSurfaceGzip:number}}
 *   Toplamlar; `gzip` tüm stiller birlikte sıkıştırılarak, `surfaces` her yüzey (id) ayrı sıkıştırılarak.
 */
export function inlinePluginStyles(html) {
  const ids = [];
  const surfaces = {};
  let body = '';
  for (const m of String(html || '').matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)) {
    const id = (m[1].match(/\bid=["']([^"']+)["']/i) || [])[1] || '';
    if (!/^donation-panel-inline/i.test(id)) continue;
    ids.push(id);
    body += m[2];
    surfaces[id] = (surfaces[id] || 0) + (m[2] ? zlib.gzipSync(Buffer.from(m[2]), { level: 9 }).length : 0);
  }
  const raw = Buffer.byteLength(body);
  const sizes = Object.values(surfaces);
  return {
    count: ids.length,
    raw,
    gzip: raw ? zlib.gzipSync(Buffer.from(body), { level: 9 }).length : 0,
    ids,
    surfaces,
    maxSurfaceGzip: sizes.length ? Math.max(...sizes) : 0,
  };
}

/** İz olayları: URL taşıyan betik olayları (derleme, değerlendirme, çağrı). */
const SCRIPT_EVENTS = new Set(['EvaluateScript', 'v8.compile', 'v8.compileModule', 'v8.evaluateModule', 'FunctionCall', 'v8.run', 'V8.ScriptCompiler']);

/**
 * Olayın betik adresi (Chrome iz biçimleri arasında farklı alanlar).
 *
 * @param {object} ev İz olayı.
 * @return {string} Adres ya da boş.
 */
export function eventUrl(ev) {
  const a = (ev && ev.args) || {};
  const d = a.data || {};
  return String(d.url || d.scriptName || a.fileName || d.fileName || a.url || '');
}

/**
 * Ana iş parçacıkları (`CrRendererMain`) için pid:tid kümesi; meta veri yoksa tüm iş parçacıkları.
 *
 * @param {object[]} events İz olayları.
 * @return {Set<string>|null} Küme ya da null (süzgeç yok).
 */
export function mainThreads(events) {
  const s = new Set();
  for (const ev of events) {
    if (ev.ph === 'M' && ev.name === 'thread_name' && ev.args && ev.args.name === 'CrRendererMain') s.add(`${ev.pid}:${ev.tid}`);
  }
  return s.size ? s : null;
}

/**
 * Aralıkları birleştirir (µs).
 *
 * @param {Array<[number, number]>} list [başlangıç, bitiş].
 * @return {Array<[number, number]>} Örtüşmesiz, sıralı.
 */
export function mergeIntervals(list) {
  const s = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** @param {Array<[number, number]>} merged Birleşik aralıklar. @param {number} a Başlangıç. @param {number} b Bitiş. @return {number} Kesişim µs. */
function overlap(merged, a, b) {
  let n = 0;
  for (const [x, y] of merged) {
    if (y <= a) continue;
    if (x >= b) break;
    n += Math.min(b, y) - Math.max(a, x);
  }
  return n;
}

/**
 * İzden eklentiye ait ana iş parçacığı süresi ve uzun görevler.
 * Atıf: uzun görev (RunTask > 50 ms), içindeki eklenti betik süresi görevin en az yarısıysa ya da tek başına 50 ms'yi
 * aşıyorsa eklentiye atfedilir; içinde eklenti süresi olan ama eşiği tutmayan görevler "katkılı" diye ayrıca sayılır.
 *
 * @param {object[]|{traceEvents:object[]}} trace İz.
 * @param {{isPlugin?: (url:string)=>boolean, longTaskMs?: number}} [opts] Seçenekler.
 * @return {{scriptMs:number, byUrl:Record<string,number>, longTasks:number, contributedLongTasks:number, longTaskDetails:Array<{dur:number, pluginMs:number}>, allLongTasks:number}} Sonuç (ms).
 */
export function attributeTrace(trace, opts = {}) {
  const events = Array.isArray(trace) ? trace : (trace && trace.traceEvents) || [];
  const isPlugin = opts.isPlugin || ((u) => isPluginUrl(u));
  const limit = (opts.longTaskMs || LONG_TASK_MS) * 1000;
  const mains = mainThreads(events);
  const onMain = (ev) => !mains || mains.has(`${ev.pid}:${ev.tid}`);
  /** @type {Map<string, Array<[number, number]>>} */
  const perThread = new Map();
  /** @type {Map<string, Array<[number, number]>>} */
  const perUrl = new Map();
  const tasks = [];
  for (const ev of events) {
    if (!onMain(ev) || typeof ev.ts !== 'number') continue;
    const dur = ev.ph === 'X' ? Number(ev.dur || 0) : 0;
    if (ev.name === 'RunTask' && ev.ph === 'X') {
      tasks.push({ key: `${ev.pid}:${ev.tid}`, a: ev.ts, b: ev.ts + dur });
      continue;
    }
    if (!SCRIPT_EVENTS.has(ev.name) || ev.ph !== 'X' || dur <= 0) continue;
    const url = eventUrl(ev);
    if (!isPlugin(url)) continue;
    const key = `${ev.pid}:${ev.tid}`;
    if (!perThread.has(key)) perThread.set(key, []);
    perThread.get(key).push([ev.ts, ev.ts + dur]);
    const short = url.split('?')[0].split(`/${PLUGIN_SLUG}/`).pop();
    if (!perUrl.has(short)) perUrl.set(short, []);
    perUrl.get(short).push([ev.ts, ev.ts + dur]);
  }
  const merged = new Map();
  let total = 0;
  for (const [k, list] of perThread) {
    const m = mergeIntervals(list);
    merged.set(k, m);
    total += m.reduce((n, [a, b]) => n + (b - a), 0);
  }
  const byUrl = {};
  for (const [u, list] of perUrl) byUrl[u] = +(mergeIntervals(list).reduce((n, [a, b]) => n + (b - a), 0) / 1000).toFixed(1);
  let longTasks = 0;
  let contributed = 0;
  let all = 0;
  const details = [];
  for (const t of tasks) {
    const dur = t.b - t.a;
    if (dur <= limit) continue;
    all += 1;
    const p = overlap(merged.get(t.key) || [], t.a, t.b);
    if (p <= 0) continue;
    if (p * 2 >= dur || p > limit) {
      longTasks += 1;
      details.push({ dur: +(dur / 1000).toFixed(1), pluginMs: +(p / 1000).toFixed(1) });
    } else {
      contributed += 1;
    }
  }
  return { scriptMs: +(total / 1000).toFixed(1), byUrl, longTasks, contributedLongTasks: contributed, longTaskDetails: details, allLongTasks: all };
}

/** Web fontu yüklenmesiyle "aynı kare" sayılan pencere (ms): yükleme bitişinden önce/sonra. Yavaşlatılmış CPU'da
 * yazı tipi değişimi → stil yeniden hesabı → yerleşim birkaç kare sürebilir. */
export const FONT_SHIFT_WINDOW = { beforeMs: 50, afterMs: 300 };
/** Eklenti ve tema metin akışı kaymalarının aynı yazı tipi değişimi sayıldığı en büyük aralık (ms; 4× CPU'da birkaç kare). */
export const REFLOW_PAIR_MS = 100;

/**
 * Kayma bir web fontu yüklenmesiyle aynı zaman penceresinde mi.
 *
 * @param {number} t Kayma zamanı (`startTime`, ms).
 * @param {number[]} fontTimes Yazı tipi yükleme bitiş zamanları (ms; `document.fonts` `loadingdone` ve font kaynaklarının
 *   `responseEnd` değeri).
 * @param {{beforeMs:number, afterMs:number}} [win] Pencere.
 * @return {boolean} Penceredeyse.
 */
export function nearFontLoad(t, fontTimes, win = FONT_SHIFT_WINDOW) {
  if (!Number.isFinite(t)) return false;
  return (fontTimes || []).some((f) => Number.isFinite(f) && t >= f - win.beforeMs && t <= f + win.afterMs);
}

/**
 * Eklenti kaynaklı CLS (yakın girdi olmayan kaymalar, `hadRecentInput` false):
 *  - kaynaklardan biri eklenti öğesi (`.donation-panel*` / `[data-dp-*]`) VE eklenti dışı (belgede duran) bir öğe de
 *    kayıyor VE kayma bir web fontu yüklenmesiyle aynı pencerede → `font` (tema/font kaynaklı; eklenti tema yazı tipini
 *    bilerek devralır, §0). Tema seçicisi bilinmez: "eklenti dışı" = eklenti işareti taşımayan her kaynak.
 *  - aksi hâlde en az bir kaynağı eklenti öğesi olan kayma → `plugin` (karışık ama font penceresi dışında olan da
 *    eklentiye yazılır — muhafazakâr).
 *  - kaynak düğümlerinin hepsi belgeden çıkmışsa (`node` null) eklentiye yazılmaz, `unknown` sayılır.
 *
 * @param {Array<{value:number, startTime?:number, hadRecentInput?:boolean, sources?:Array<{plugin?:boolean, detached?:boolean}>}>} shifts Kaymalar.
 * @param {{fontTimes?: number[], window?: {beforeMs:number, afterMs:number}}} [opts] Yazı tipi yükleme zamanları.
 * @return {{plugin:number, font:number, total:number, pluginShifts:number, fontShifts:number, unknown:number}} Toplamlar.
 */
export function clsAttribution(shifts, opts = {}) {
  const fontTimes = opts.fontTimes || [];
  const win = opts.window || FONT_SHIFT_WINDOW;
  const live = (shifts || []).filter((s) => !s.hadRecentInput);
  // Yalnız yatay metin yeniden akışı (dy=0, dh=0; genişlik/x değişir): yazı tipi metriği değişimi işareti.
  const reflowOnly = (s) => (s.sources || []).length > 0 && (s.sources || []).every((x) => !x.detached && x.dy === 0 && x.dh === 0);
  // İkinci kanıt: platform yazı tipi geri dönüşü FontFace olayı üretmeyebilir (Chromium/macOS). Eklenti-yalnız kayma
  // salt yatay metin akışıysa ve ±REFLOW_PAIR_MS içinde eklenti dışı (tema) öğenin de salt yatay metin akışı varsa
  // aynı yazı tipi değişiminin iki karesi sayılır → tema/font.
  const themeReflowNear = (s) =>
    live.some(
      (o) =>
        o !== s &&
        Math.abs(Number(o.startTime) - Number(s.startTime)) <= REFLOW_PAIR_MS &&
        (o.sources || []).length > 0 &&
        (o.sources || []).every((x) => !x.plugin) &&
        reflowOnly(o)
    );
  let plugin = 0;
  let font = 0;
  let total = 0;
  let n = 0;
  let nf = 0;
  let unknown = 0;
  for (const s of shifts || []) {
    if (s.hadRecentInput) continue;
    const v = Number(s.value) || 0;
    total += v;
    const src = s.sources || [];
    if (src.some((x) => x.plugin)) {
      const foreign = src.some((x) => !x.plugin && !x.detached);
      if ((foreign && nearFontLoad(Number(s.startTime), fontTimes, win)) || (reflowOnly(s) && themeReflowNear(s))) {
        font += v;
        nf += 1;
      } else {
        plugin += v;
        n += 1;
      }
    } else if (src.length && src.every((x) => x.detached)) {
      unknown += 1;
    }
  }
  return { plugin: +plugin.toFixed(5), font: +font.toFixed(5), total: +total.toFixed(5), pluginShifts: n, fontShifts: nf, unknown };
}

/**
 * Eşik değerlendirmesi.
 *
 * @param {keyof typeof THRESHOLDS} key Ölçüt.
 * @param {number} value Değer.
 * @return {{key:string, label:string, value:number, limit:string, pass:boolean|null}} Satır (değer yoksa pass=null).
 */
export function judgeMetric(key, value) {
  const t = THRESHOLDS[key];
  if (!t) throw new Error(`bilinmeyen ölçüt: ${key}`);
  const limit = 'lt' in t ? `< ${t.lt}${t.unit ? ' ' + t.unit : ''}` : `≤ ${t.max}${t.unit ? ' ' + t.unit : ''}`;
  if (!Number.isFinite(value)) return { key, label: t.label, value, limit, pass: null };
  const pass = 'lt' in t ? value < t.lt : value <= t.max + (key === 'cls' ? 0.00001 : 0);
  return { key, label: t.label, value, limit, pass };
}

/** @param {boolean|null} p Sonuç. @return {string} Etiket. */
export const verdict = (p) => (p === null ? 'ÖLÇÜLMEDİ' : p ? 'GEÇTİ' : 'KALDI');

/**
 * `--pages "id=/yol,id2=/yol2"` ayrıştırması.
 *
 * @param {string} spec Metin.
 * @return {Array<{id:string, path:string}>} Sayfalar.
 */
export function parsePagesArg(spec) {
  return String(spec || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.indexOf('=');
      if (i <= 0) throw new Error(`--pages biçimi id=/yol: ${s}`);
      const p = s.slice(i + 1).trim();
      if (!p.startsWith('/')) throw new Error(`--pages yolu "/" ile başlamalı: ${s}`);
      return { id: s.slice(0, i).trim(), path: p };
    });
}
