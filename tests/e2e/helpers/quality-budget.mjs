/**
 * Boyut bütçesi (E8B): sayfa türü başına eklentinin ön yüz JS/CSS gzip toplamı; modül kapalıyken yüklenmeyenler. HTTP düzeyi, yerel WP.
 */
import zlib from 'node:zlib';
import { setQualityState } from './quality-env.mjs';

export const BUDGET = { jsKb: 60, cssKb: 30 };
const MODULE_WORDS = /side-?cart|campaign|impact|social|thanks|tax|account|donor/i;

const gz = (buf) => zlib.gzipSync(buf, { level: 6 }).length;

/**
 * @param {string} base Taban adres.
 * @param {string} html Sayfa.
 * @return {Promise<{files:{file:string,type:string,raw:number,gzip:number}[], inlineGzip:{js:number,css:number}, js:number, css:number}>} Ölçüm.
 */
async function measure(base, html) {
  const re = /<(link|script)\b[^>]*(?:href|src)=["']([^"']*\/woo-donation-popup\/[^"']*)["'][^>]*>/gi;
  const files = [];
  const seen = new Set();
  for (const m of html.matchAll(re)) {
    const url = new URL(m[2].replace(/&#038;/g, '&'), base);
    const key = url.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = /\.css$/i.test(key) ? 'css' : /\.js$/i.test(key) ? 'js' : '';
    if (!type) continue;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    files.push({ file: key.split('/woo-donation-popup/')[1], type, raw: buf.length, gzip: gz(buf) });
  }
  const inlineGzip = { js: 0, css: 0 };
  for (const m of html.matchAll(/<(style|script)\b[^>]*\bid=["'](wdp-|donation-panel|dp-)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)) {
    inlineGzip[m[1].toLowerCase() === 'style' ? 'css' : 'js'] += gz(Buffer.from(m[3]));
  }
  const js = files.filter((f) => f.type === 'js').reduce((a, f) => a + f.gzip, 0) + inlineGzip.js;
  const css = files.filter((f) => f.type === 'css').reduce((a, f) => a + f.gzip, 0) + inlineGzip.css;
  return { files, inlineGzip, js, css };
}

/**
 * @param {{base:string, wpDir:string}} w İşçi.
 * @param {object} qcfg Yapılandırma.
 * @return {Promise<object[]>} Satırlar.
 */
export async function runBudget(w, qcfg) {
  const rows = [];
  const { ids } = qcfg;
  const addRes = await fetch(`${w.base}/?dp_q_add=${ids.custom}&amount=${qcfg.store.amount || 50}`);
  const cookie = (addRes.headers.getSetCookie ? addRes.headers.getSetCookie() : []).map((c) => c.split(';')[0]).join('; ');
  const pages = [
    { type: 'urun', path: ids.fixedPath },
    { type: 'magaza', path: '/shop/' },
    { type: 'odeme', path: new URL(qcfg.checkoutUrl).pathname, cookie },
    { type: 'yalniz-kisa-kod', path: `/?dp_q_test=shortcode&dp_product=${ids.custom}` },
  ];
  for (const modules of ['all', 'none']) {
    setQualityState(w.wpDir, { engine: 'new', modules, override: true });
    for (const p of pages) {
      const res = await fetch(`${w.base}${p.path}`, { headers: p.cookie ? { cookie: p.cookie } : {} });
      const html = await res.text();
      const m = await measure(w.base, html);
      const handles = m.files.map((f) => f.file.split('/').pop());
      const offenders = modules === 'none' ? handles.filter((h) => MODULE_WORDS.test(h)) : [];
      rows.push({
        config: qcfg.id,
        theme: qcfg.theme,
        page: p.type,
        modules,
        jsGzipKb: +(m.js / 1024).toFixed(1),
        cssGzipKb: +(m.css / 1024).toFixed(1),
        files: handles,
        moduleOffenders: offenders,
        ok: res.status === 200 && m.js / 1024 <= BUDGET.jsKb && m.css / 1024 <= BUDGET.cssKb && offenders.length === 0,
      });
    }
  }
  setQualityState(w.wpDir, { engine: 'new', modules: 'all', override: true });
  return rows;
}
