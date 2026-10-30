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
  inpOpen: { lt: 200, unit: 'ms', label: 'INP: dokunma → panel (5 örnek medyanı)' },
  inpAmount: { lt: 200, unit: 'ms', label: 'INP: tutar kartı (5 örnek medyanı)' },
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

/** INP örnek sayısı (her örnek yeni yükleme); eşik örneklerin medyanına uygulanır (tek örnek gürültülü). */
export const INP_RUNS = 5;

/**
 * Event Timing kayıtlarından [from, to) penceresindeki en uzun etkileşim (aynı `interactionId` olayların en büyüğü).
 * Event Timing yalnız ≥16 ms kaydeder: pencerede etkileşim yoksa 0 (= <16 ms).
 *
 * @param {Array<{interactionId?:number, startTime:number, duration:number}>} events Olaylar.
 * @param {number} from Başlangıç (ms, dahil).
 * @param {number} [to] Bitiş (ms, hariç; varsayılan sonsuz).
 * @return {number} En uzun etkileşim süresi (ms).
 */
export function maxInteraction(events, from, to = Infinity) {
  const byId = new Map();
  for (const e of events || []) {
    if (!e.interactionId || e.startTime < from || e.startTime >= to) continue;
    byId.set(e.interactionId, Math.max(byId.get(e.interactionId) || 0, e.duration));
  }
  return byId.size ? Math.max(...byId.values()) : 0;
}

/**
 * INP örneklerinin özeti: her etkileşim türü için örnek listesi ve medyanı (ölçülmeyen örnek NaN, medyana girmez).
 *
 * @param {Array<{open:number, amount:number}>} samples Örnekler.
 * @return {{open:number, amount:number, openRuns:number[], amountRuns:number[]}} Medyanlar ve koşular.
 */
export function inpSummary(samples) {
  const openRuns = (samples || []).map((s) => s.open).filter((n) => Number.isFinite(n)).map((n) => Math.round(n));
  const amountRuns = (samples || []).map((s) => s.amount).filter((n) => Number.isFinite(n)).map((n) => Math.round(n));
  return { open: median(openRuns), amount: median(amountRuns), openRuns, amountRuns };
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
/** Yazı tipi değişiminde metin düğümü kutusunun en çok yükseklik farkı (px; yalnız eşleşen yazı tipi pencerede yüklenince). */
export const FONT_METRIC_PX = 2;

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
 * Bir yazı tipi yüzü (FontFace) metnin hesaplanmış yazı tipiyle eşleşiyor mu: ilk aile adı (tırnaksız, küçük harf),
 * kalınlık (yüzde aralık "100 900" olabilir) ve stil.
 *
 * @param {{family:string, weight?:string, style?:string}} face Yüklenen yüz.
 * @param {[string, string, string]|null} font Metnin [font-family, font-weight, font-style] değeri.
 * @return {boolean} Eşleşirse.
 */
export function fontMatches(face, font) {
  if (!face || !font) return false;
  const norm = (s) => String(s || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
  const first = norm(String(font[0] || '').split(',')[0]);
  if (!first || first !== norm(face.family)) return false;
  const weightOf = (w) => (w === 'bold' ? 700 : w === 'normal' || !w ? 400 : Number(w));
  const want = weightOf(String(font[1] || '400'));
  const range = String(face.weight || '400').trim().split(/\s+/).map(weightOf);
  const lo = range[0];
  const hi = range.length > 1 ? range[1] : range[0];
  if (Number.isFinite(lo) && Number.isFinite(hi) && (want < lo || want > hi)) return false;
  const style = (s) => (String(s || 'normal').indexOf('italic') === 0 || String(s || '').indexOf('oblique') === 0 ? 'italic' : 'normal');
  return style(face.style) === style(font[2]);
}

/**
 * Eklenti kaynaklı CLS (yakın girdi olmayan kaymalar, `hadRecentInput` false):
 *  - kaynaklardan biri eklenti öğesi (`.donation-panel*` / `[data-dp-*]`) VE eklenti dışı (belgede duran) bir öğe de
 *    kayıyor VE kayma bir web fontu yüklenmesiyle aynı pencerede → `font` (tema/font kaynaklı; eklenti tema yazı tipini
 *    bilerek devralır, §0). Tema seçicisi bilinmez: "eklenti dışı" = eklenti işareti taşımayan her kaynak.
 *  - aksi hâlde en az bir kaynağı eklenti öğesi olan kayma → `plugin` (karışık ama font penceresi dışında olan da
 *    eklentiye yazılır — muhafazakâr).
 *  - yalnız eklenti metin düğümleri, boyları değişmeden ya da yalnız yazı tipi metriği kadar (|dh| ≤ 2 px) kayıyor VE her birinin hesaplanmış yazı tipi (aile +
 *    kalınlık + stil) pencerede yüklenen bir FontFace ile eşleşiyor → `font` (aynı yazı tipini kullanan tema öğesi o
 *    karede görünür alanda olmayabilir; metnin kendi yazı tipi değişimi kanıttır). Betik metni değiştirirse genişlik
 *    ya da kardeş öğeler de kayar; yazı tipi eşleşmesi olmadan bu kural uygulanmaz.
 *  - kaynak düğümlerinin hepsi belgeden çıkmışsa (`node` null) eklentiye yazılmaz, `unknown` sayılır.
 *
 * @param {Array<{value:number, startTime?:number, hadRecentInput?:boolean, sources?:Array<{plugin?:boolean, detached?:boolean, text?:boolean, font?:string[]|null, dh?:number}>}>} shifts Kaymalar.
 * @param {{fontTimes?: number[], fontFaces?: Array<{t:number, family:string, weight?:string, style?:string}>, window?: {beforeMs:number, afterMs:number}}} [opts] Yazı tipi yükleme zamanları ve yüzleri.
 * @return {{plugin:number, font:number, total:number, pluginShifts:number, fontShifts:number, unknown:number}} Toplamlar.
 */
export function clsAttribution(shifts, opts = {}) {
  const fontTimes = opts.fontTimes || [];
  const win = opts.window || FONT_SHIFT_WINDOW;
  const fontFaces = opts.fontFaces || [];
  const live = (shifts || []).filter((s) => !s.hadRecentInput);
  // Metnin kendi yazı tipi (aile + kalınlık + stil) o pencerede yüklendi (font swap): yalnız metin düğümleri. Metin
  // düğümü kutusu yazı tipinin üst/alt uzunluğundan gelir: değişimde ≤ FONT_METRIC_PX yükseklik farkı (ör. dy-1 dh1)
  // yazı tipi metriğidir (12.3 fix: geç yüklenen yazı tipiyle betiksiz sayfada aynı imza üretildi).
  const ownFontSwap = (s) =>
    (s.sources || []).length > 0 &&
    (s.sources || []).every(
      (x) =>
        x.text &&
        !x.detached &&
        Math.abs(Number(x.dh) || 0) <= FONT_METRIC_PX &&
        fontFaces.some((f) => nearFontLoad(Number(s.startTime), [Number(f.t)], win) && fontMatches(f, x.font))
    );
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
      if ((foreign && nearFontLoad(Number(s.startTime), fontTimes, win)) || (reflowOnly(s) && themeReflowNear(s)) || ownFontSwap(s)) {
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

/**
 * TARAYICI tarafı (kendi içinde kapalı; `page.evaluate` ile `(${fn})(window, …)` biçiminde çalışır, dış ada başvurmaz):
 * `selector` ile eşleşen öğelerden dokunulabilir ilkini seçer. Her aday dikeyde ortalanır (`block:'center'`; sabit /
 * yapışkan üstbilgi altında kalmasın; kaydırılabilir kap içinde de çalışır), iki kare beklenir (yapışkan üstbilgi,
 * giriş animasyonu yerleşsin), sonra görünürlük ve isabet denetlenir: `elementFromPoint` sonucu öğenin kendisi ya da
 * soyundan biri olmalı (SVG çocukları dahil; `Node.contains`). Merkez örtülüyse kutunun içindeki dört noktaya daha
 * bakılır. Slider'da yatayda ekran dışı / üst üste slaytlar elenir (yatay kaydırma yapılmaz).
 * Dönüş `{index, x, y, reason}`: `x,y` doğrulanmış dokunma noktası (görünüm koordinatı; çağıran bu noktaya dokunur,
 * arada kaydırma yok). Bulunamazsa `index:-1` ve `reason` (ilk üç adayın eleme nedeni; örtülüyse üstteki öğe
 * `etiket#kimlik.sınıf`).
 *
 * @param {Window} w Pencere.
 * @param {string} selector Saf CSS seçici (Playwright sözde seçicisi değil).
 * @return {Promise<{index:number, x:number, y:number, reason:string}>} Sonuç.
 */
export async function pickVisibleTarget(w, selector) {
  const doc = w.document;
  const frames = () =>
    new Promise((resolve) => {
      if (typeof w.requestAnimationFrame !== 'function') {
        resolve();
        return;
      }
      w.requestAnimationFrame(() => w.requestAnimationFrame(() => resolve()));
    });
  const describe = (n) => {
    if (!n || !n.tagName) return n ? String(n.nodeName || 'düğüm') : 'yok';
    const raw = typeof n.className === 'string' ? n.className : (n.className && n.className.baseVal) || '';
    const cls = raw.trim() ? `.${raw.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    return `${String(n.tagName).toLowerCase()}${n.id ? `#${n.id}` : ''}${cls}`;
  };
  const hiddenWhy = (el) => {
    const cs = w.getComputedStyle(el);
    if (cs.display === 'none') return 'display:none';
    if (cs.visibility !== 'visible') return `visibility:${cs.visibility}`;
    if (Number(cs.opacity) === 0) return 'opacity:0';
    return '';
  };
  const pts = [
    [0.5, 0.5],
    [0.3, 0.5],
    [0.7, 0.5],
    [0.5, 0.3],
    [0.5, 0.7],
  ];
  const list = Array.from(doc.querySelectorAll(selector));
  const reasons = [];
  for (let i = 0; i < list.length; i += 1) {
    const el = list[i];
    let r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) {
      reasons.push(`#${i} boyut 0`);
      continue;
    }
    const cx = r.left + r.width / 2;
    if (cx < 0 || cx > w.innerWidth) {
      reasons.push(`#${i} yatayda ekran dışı`);
      continue;
    }
    // Ortalama döngüsü (en çok 5): `behavior:'instant'` sayfanın `scroll-behavior: smooth` ayarını ezer (yumuşak kaydırma
    // iki karede bitmez, öğe "dikeyde ekran dışı" kalıyordu). Hâlâ ortada değilse pencere ve en yakın kaydırma kabı
    // farka göre kaydırılır (iç kaydırma kabı, yapışkan üstbilgi, kaydırınca yer değiştiren öğe).
    const scroller = (node) => {
      for (let p = node.parentElement; p && p !== doc.documentElement; p = p.parentElement) {
        const cs = w.getComputedStyle(p);
        if (/(auto|scroll|overlay)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
      }
      return null;
    };
    const box = scroller(el);
    for (let k = 0; k < 5; k += 1) {
      if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      await frames();
      const rr = el.getBoundingClientRect();
      const mid = rr.top + Math.min(rr.height, w.innerHeight) / 2;
      const delta = mid - w.innerHeight / 2;
      if (Math.abs(delta) <= w.innerHeight / 4 && rr.top + rr.height > 0 && rr.top < w.innerHeight) break;
      if (box) box.scrollBy({ top: delta, behavior: 'instant' });
      else w.scrollBy({ top: delta, behavior: 'instant' });
      await frames();
    }
    let why = hiddenWhy(el);
    // Görünür olunca başlayan giriş animasyonu: birkaç kare daha bekle (sabit bekleme değil, kare bazlı).
    for (let k = 0; why && k < 20; k += 1) {
      await frames();
      why = hiddenWhy(el);
    }
    if (why) {
      reasons.push(`#${i} ${why}`);
      continue;
    }
    r = el.getBoundingClientRect();
    // Noktalar kutunun görünür kesitinde (görünümden uzun öğe, kısmen görünen sabit çubuk).
    const vis = { left: Math.max(r.left, 0), top: Math.max(r.top, 0), right: Math.min(r.left + r.width, w.innerWidth), bottom: Math.min(r.top + r.height, w.innerHeight) };
    let cover = '';
    let found = null;
    for (const [fx, fy] of pts) {
      if (vis.right <= vis.left || vis.bottom <= vis.top) break;
      const x = vis.left + (vis.right - vis.left) * fx;
      const y = vis.top + (vis.bottom - vis.top) * fy;
      const hit = doc.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) {
        found = { x, y };
        break;
      }
      if (!cover) cover = describe(hit);
    }
    if (found) return { index: i, x: Math.round(found.x), y: Math.round(found.y), reason: '' };
    if (cover) {
      reasons.push(`#${i} üstte ${cover}`);
      continue;
    }
    // Neden ayrıntısı: konum, kaydırma kabı, sabit/yapışkan ya da dönüşümlü üst öğe (kaydırınca yerinden oynamayan).
    let pinned = '';
    for (let p = el; p && p !== doc.documentElement && !pinned; p = p.parentElement) {
      const cs = w.getComputedStyle(p);
      if (cs.position === 'fixed' || cs.position === 'sticky') pinned = `${cs.position} ${describe(p)}`;
      else if (cs.transform && cs.transform !== 'none') pinned = `transform ${describe(p)}`;
    }
    reasons.push(`#${i} dikeyde ekran dışı (üst ${Math.round(r.top)}, alt ${Math.round(r.top + r.height)}, görünüm ${w.innerHeight}; kap ${box ? describe(box) : 'pencere'}${pinned ? `; ${pinned}` : ''})`);
  }
  return { index: -1, x: 0, y: 0, reason: reasons.slice(0, 3).join('; ') || 'eşleşen öğe yok' };
}

/**
 * Chrome izinde `click` olay işleyicisinin (EventDispatch type=click; en uzunu) İÇİNDE zorunlu eşzamanlı stil/düzen
 * hesapları (UpdateLayoutTree, Layout). `minMs` altındaki kayıtlar (ör. tek öğe odak denetimi) `small` olarak ayrı sayılır.
 *
 * @param {object[]|{traceEvents:object[]}} trace İz.
 * @param {{minMs?: number, type?: string}} [opts] Seçenekler.
 * @return {{clicks:number, clickMs:number, forced:number, small:number, styleMs:number, layoutMs:number, items:Array<{name:string, ms:number, elements:number}>}} Sonuç.
 */
export function forcedLayoutsInClick(trace, opts = {}) {
  const events = Array.isArray(trace) ? trace : (trace && trace.traceEvents) || [];
  const minUs = (opts.minMs ?? 0.5) * 1000;
  const type = opts.type || 'click';
  const clicks = events.filter((e) => e.name === 'EventDispatch' && e.ph === 'X' && e.args && e.args.data && e.args.data.type === type);
  const out = { clicks: clicks.length, clickMs: 0, forced: 0, small: 0, styleMs: 0, layoutMs: 0, items: [] };
  if (!clicks.length) return out;
  const c = clicks.reduce((x, y) => (Number(y.dur || 0) > Number(x.dur || 0) ? y : x));
  const a = c.ts;
  const b = c.ts + Number(c.dur || 0);
  out.clickMs = +(Number(c.dur || 0) / 1000).toFixed(1);
  for (const e of events) {
    if (e.ph !== 'X' || e.pid !== c.pid || e.tid !== c.tid || e.ts < a || e.ts > b) continue;
    if (e.name !== 'UpdateLayoutTree' && e.name !== 'Layout') continue;
    const dur = Number(e.dur || 0);
    if (e.name === 'Layout') out.layoutMs += dur / 1000;
    else out.styleMs += dur / 1000;
    if (dur < minUs) {
      out.small += 1;
      continue;
    }
    out.forced += 1;
    const item = { name: e.name, ms: +(dur / 1000).toFixed(1), elements: Number((e.args && e.args.elementCount) || 0) };
    // İz `disabled-by-default-devtools.timeline.stack` ile alındıysa zorlayan çağrı (ilk iki çerçeve; tanı).
    const stack = (e.args && e.args.beginData && e.args.beginData.stackTrace) || [];
    if (stack.length) item.stack = stack.slice(0, 2).map((f) => `${f.functionName || '?'}@${String(f.url || '').split('/').pop().split('?')[0]}:${f.lineNumber}:${f.columnNumber}`).join(' < ');
    out.items.push(item);
  }
  out.styleMs = +out.styleMs.toFixed(1);
  out.layoutMs = +out.layoutMs.toFixed(1);
  // Zorlayan JS çağrı noktası sayısı (yığınlı izde): aynı çağrının (ör. tarayıcının showModal içi odak adımı) birden çok
  // kaydı tek nokta sayılır. Yığın yoksa -1.
  out.sites = out.items.some((i) => i.stack) ? new Set(out.items.map((i) => (i.stack || '?').split(' < ')[0])).size : -1;
  // Tıklamadan ilk boyamaya (Paint/PrePaint) kadar TÜM stil/düzen işi (zorunlu + karedeki): toplam açılış maliyeti.
  const paint = events
    .filter((e) => e.ph === 'X' && e.pid === c.pid && e.tid === c.tid && e.ts >= b && (e.name === 'Paint' || e.name === 'PrePaint'))
    .sort((x, y) => x.ts - y.ts)[0];
  const end = paint ? paint.ts + Number(paint.dur || 0) : b;
  let frame = 0;
  for (const e of events) {
    if (e.ph !== 'X' || e.pid !== c.pid || e.tid !== c.tid || e.ts < a || e.ts > end) continue;
    if (e.name === 'UpdateLayoutTree' || e.name === 'Layout') frame += Number(e.dur || 0);
  }
  out.toPaintMs = +((end - a) / 1000).toFixed(1);
  out.frameStyleLayoutMs = +(frame / 1000).toFixed(1);
  return out;
}

/**
 * TARAYICI tarafı (kendi içinde kapalı): dokunuş → panel ölçer. `selector` eşleşmelerinden `index`. öğeye
 * yakalama evresinde `click` dinleyicisi takar; t0 = `event.timeStamp`. Görünür `dialog[open]` (getClientRects > 0
 * ve visibility visible) MutationObserver ile (attributes ['open'], subtree, childList) yakalanır — rAF yoklaması
 * yok, bu yüzden açılış anına kare gecikmesi eklenmez; tıklama anında zaten açıksa hemen. Açık ama henüz görünmez
 * (ör. stil gelmedi) diyalog için yedek: her kare yeniden bakılır. Açılış anından sonra iki rAF → t1.
 * Sonuç `w.__dpTap = {t0, tOpen, t1}` (ms, performance zaman ekseni). t1'de `w.__dpPerfSignal('tap')` (varsa) çağrılır:
 * ölçüm betiği bitişi yoklamadan öğrenir (yoklama betiği 4× CPU'da kareyi geciktirip ölçümü bozuyordu).
 *
 * @param {Window} w Pencere.
 * @param {string} selector Tetikleyici seçicisi.
 * @param {number} index Tetikleyici indeksi.
 * @return {boolean} Tetikleyici bulundu mu.
 */
export function installTapProbe(w, selector, index) {
  const doc = w.document;
  const state = { t0: 0, tOpen: 0, t1: 0 };
  w.__dpTap = state;
  const trig = doc.querySelectorAll(selector)[index];
  if (!trig) return false;
  const visibleDialog = () =>
    Array.from(doc.querySelectorAll('dialog[open]')).find((x) => x.getClientRects().length > 0 && w.getComputedStyle(x).visibility === 'visible');
  let mo = null;
  let done = false;
  const check = () => {
    if (done) return true;
    if (!visibleDialog()) return false;
    done = true;
    state.tOpen = w.performance.now();
    if (mo) mo.disconnect();
    w.requestAnimationFrame(() =>
      w.requestAnimationFrame(() => {
        state.t1 = w.performance.now();
        // Ölçüm betiğine bitiş bildirimi (Playwright bağlaması; varsa). Yoklama betiği ölçüm penceresine girmesin.
        if (typeof w.__dpPerfSignal === 'function') w.__dpPerfSignal('tap');
      })
    );
    return true;
  };
  const fallback = () => {
    if (!check()) w.requestAnimationFrame(fallback);
  };
  trig.addEventListener(
    'click',
    (event) => {
      state.t0 = event.timeStamp;
      if (check()) return;
      mo = new w.MutationObserver(() => check());
      mo.observe(doc.documentElement, { attributes: true, attributeFilter: ['open'], subtree: true, childList: true });
      w.requestAnimationFrame(fallback);
    },
    { capture: true, once: true }
  );
  return true;
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
