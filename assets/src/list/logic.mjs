/**
 * Bağış listesi: DOM'suz saf yardımcılar (birim testli).
 */

const SLUG_OK = /^[a-z0-9_-]+$/i;
const HASH_PREFIX = 'bagis-';

/**
 * `#bagis-<slug>` adresinden kategori slug'ı.
 *
 * @param {string} hash Adres parçası.
 * @return {string} Slug ya da ''.
 */
export function parseHashSlug(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw.startsWith(HASH_PREFIX)) {
    return '';
  }
  const slug = raw.slice(HASH_PREFIX.length);
  return SLUG_OK.test(slug) ? slug : '';
}

/**
 * Kart kategorileri seçili sekmeye uyuyor mu.
 *
 * @param {string} cats Boşlukla ayrılmış kategori slug'ları.
 * @param {string} slug Sekme slug'ı ('all' = hepsi).
 * @return {boolean} Görünmeli mi.
 */
export function matchesCategory(cats, slug) {
  if (!slug || slug === 'all') {
    return true;
  }
  return String(cats || '')
    .split(/\s+/)
    .includes(slug);
}

/**
 * Form ucu adresi.
 *
 * @param {string} rest Kök REST adresi (`.../donation-panel/v1/`).
 * @param {string} id   Ürün kimliği.
 * @param {string} kind Kap türü.
 * @return {string} Adres.
 */
export function buildExperienceUrl(rest, id, kind) {
  const base = String(rest || '');
  const joiner = base.includes('?') ? '&' : '?';
  // Düz bağlantı yapısında (`?rest_route=/donation-panel/v1/`) yol sonuna eklenir, sorgu `&` ile.
  return `${base}experience/${encodeURIComponent(String(id))}${joiner}kind=${encodeURIComponent(String(kind || 'popup'))}`;
}

/**
 * Tıklama betiğe mi ait (yeni sekme/pencere istekleri varsayılan kalır).
 *
 * @param {{button?: number, metaKey?: boolean, ctrlKey?: boolean, shiftKey?: boolean, altKey?: boolean}} event Olay.
 * @return {boolean} Betik açsın mı.
 */
export function shouldHandleClick(event) {
  return !event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * İşaretlemedeki REST kökü güvenilir mi: sayfayla AYNI köken ve eklentinin kendi ad alanı (güzel bağlantı
 * `…/donation-panel/v1/` ya da düz `?rest_route=/donation-panel/v1/`). Başka köken, başka yol, kimlik bilgisi/parça
 * ya da ek sorgu içeren adres reddedilir (yanıt HTML'i sayfaya basıldığı için kaynak kesin doğrulanır).
 *
 * @param {string} rest     Öznitelikteki adres.
 * @param {string} pageHref Sayfa adresi (`location.href`).
 * @return {string} Doğrulanmış, normalleştirilmiş kök ya da ''.
 */
export function trustedRestRoot(rest, pageHref) {
  let url;
  let page;
  try {
    page = new URL(String(pageHref));
    url = new URL(String(rest || ''), page.href);
  } catch {
    return '';
  }
  if (url.origin !== page.origin || url.username || url.password || url.hash) {
    return '';
  }
  const pretty = /\/donation-panel\/v1\/$/.test(url.pathname) && !url.search;
  const keys = Array.from(url.searchParams.keys());
  const plain = keys.length === 1 && url.searchParams.get('rest_route') === '/donation-panel/v1/';
  return pretty || plain ? url.href : '';
}

/** Toplu ön alma isteği başına en çok ürün (sunucu sınırıyla aynı). */
export const BATCH_MAX = 12;

/**
 * Toplu form ucu adresi (`experiences?ids=1,2&kind=…`).
 *
 * @param {string}   rest Kök REST adresi.
 * @param {string[]} ids  Ürün kimlikleri (yinelenen/geçersiz atılır).
 * @param {string}   kind Kap türü.
 * @return {string} Adres ('' = geçerli kimlik yok).
 */
export function buildBatchUrl(rest, ids, kind) {
  const list = uniqueIds(ids);
  if (!list.length) {
    return '';
  }
  const base = String(rest || '');
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}experiences${joiner}ids=${list.join(',')}&kind=${encodeURIComponent(String(kind || 'popup'))}`;
}

/**
 * @param {Array<string|number>} ids Kimlikler.
 * @return {string[]} Yalnız pozitif tam sayılar, sırası korunmuş, tekrarsız.
 */
export function uniqueIds(ids) {
  const out = [];
  (ids || []).forEach((raw) => {
    const id = String(raw).trim();
    if (/^[1-9]\d*$/.test(id) && !out.includes(id)) {
      out.push(id);
    }
  });
  return out;
}

/**
 * Kimlikleri en çok `size` boyutlu parçalara böler.
 *
 * @param {string[]} ids  Kimlikler.
 * @param {number}   size Parça boyutu.
 * @return {string[][]} Parçalar.
 */
export function chunk(ids, size = BATCH_MAX) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

/**
 * Görünür alana yaklaşan kartların formu boşta önceden alınsın mı (veri tasarrufu / 2G'de yalnız niyetle alınır).
 *
 * @param {{saveData?: boolean, effectiveType?: string}|undefined} connection `navigator.connection`.
 * @return {boolean} Önceden alınsın mı.
 */
export function shouldPrefetchAhead(connection) {
  if (!connection) {
    return true;
  }
  if (connection.saveData) {
    return false;
  }
  return !/(^|-)2g$/.test(String(connection.effectiveType || ''));
}

/**
 * Önbellek anahtarı (aynı ürün + kap türü sayfada bir kez alınır; liste ve mağaza kartı paylaşır).
 *
 * @param {string} rest Kök REST adresi.
 * @param {string} id   Ürün kimliği.
 * @param {string} kind Kap türü.
 * @return {string} Anahtar.
 */
export function hostKey(rest, id, kind) {
  return `${String(rest || '')}|${String(id)}|${String(kind || 'popup')}`;
}

/** REST'le gelen katmanın isteğe bağlı paketleri: yalnız bilinen slug ve eklentinin kendi derleme yolu. */
const LAZY_PATHS = { progress: /\/assets\/build\/progress\/index\.js$/ };

/**
 * REST yanıtındaki (`assets`) isteğe bağlı paket bilgisi. Adres yalnız SUNUCU YANITINDAN gelir (DOM özniteliğinden asla)
 * ve yine de doğrulanır: aynı köken, kimlik bilgisi/parça yok, yol eklentinin `assets/build/<slug>/index.js` dosyası,
 * sorgu yalnız `ver`. Kimlikler yalnız rakam. Geçersizse null (paket yüklenmez; katman durağan çubukla çalışır).
 *
 * @param {any}    data     Ayrıştırılmış yanıt.
 * @param {string} slug     Paket (yalnız `progress`).
 * @param {string} pageHref Sayfa adresi.
 * @return {{ids: string[], script: string, style: string}|null} Bilgi.
 */
export function lazyAsset(data, slug, pageHref) {
  const has = (obj, key) => Boolean(obj) && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
  const entry = has(data, 'assets') && has(data.assets, slug) ? data.assets[slug] : null;
  if (!entry || !has(LAZY_PATHS, slug) || !Array.isArray(entry.ids)) {
    return null;
  }
  const script = trustedAssetUrl(entry.script, LAZY_PATHS[slug], pageHref);
  const ids = uniqueIds(entry.ids.map(String));
  return script && ids.length ? { ids, script, style: typeof entry.style === 'string' ? entry.style : '' } : null;
}

/**
 * Paket adresi: aynı köken, kimlik bilgisi/parça yok, yol kalıba uyar, sorgu yok ya da yalnız `ver`.
 *
 * @param {string} raw      Adres.
 * @param {RegExp} pattern  Yol kalıbı.
 * @param {string} pageHref Sayfa adresi.
 * @return {string} Doğrulanmış adres ya da ''.
 */
function trustedAssetUrl(raw, pattern, pageHref) {
  let url;
  let page;
  try {
    page = new URL(String(pageHref));
    url = new URL(String(raw || ''), page.href);
  } catch {
    return '';
  }
  const keys = Array.from(url.searchParams.keys());
  const query = keys.length === 0 || (keys.length === 1 && /^[A-Za-z0-9._-]{1,64}$/.test(url.searchParams.get('ver') || ''));
  const clean = url.origin === page.origin && !url.username && !url.password && !url.hash;
  return clean && query && pattern.test(url.pathname) ? url.href : '';
}
