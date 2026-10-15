/**
 * E2E görsel URL karşılaştırması — WP boyut sonekleri + SiteGround webp/avif.
 */

/**
 * Query/hash at, son yol parçası, .webp/.avif + uzantı + -NxN/-scaled sil, küçük harf.
 * @param {string} url
 * @returns {string}
 */
export function normalizeImageStem(url) {
  if (!url) return '';
  let s = String(url).trim();
  if (!s || s.toLowerCase().startsWith('data:')) return '';
  s = s.split('#')[0].split('?')[0];
  try {
    const u = new URL(s, 'https://example.invalid');
    const parts = u.pathname.split('/').filter(Boolean);
    s = parts[parts.length - 1] || '';
  } catch (e) {
    const parts = s.split('/').filter(Boolean);
    s = parts[parts.length - 1] || '';
  }
  try {
    s = decodeURIComponent(s);
  } catch (e) {
    /* keep raw */
  }
  s = s.toLowerCase();
  // SiteGround vb.: dosya.jpg.webp / dosya.webp
  s = s.replace(/\.(webp|avif)$/i, '');
  // asıl uzantı
  s = s.replace(/\.[a-z0-9]{2,5}$/i, '');
  // WP boyut / scaled
  s = s.replace(/-scaled$/i, '');
  s = s.replace(/-\d+x\d+$/i, '');
  // scaled boyutlu varyantlardan sonra kalmış olabilir
  s = s.replace(/-scaled$/i, '');
  return s;
}

/**
 * Normalize kökler eşit veya biri diğeriyle başlıyor.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function imageStemsMatch(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/**
 * srcset özniteliğinden URL listesi.
 * @param {string} srcset
 * @returns {string[]}
 */
export function parseSrcsetUrls(srcset) {
  if (!srcset) return [];
  return String(srcset)
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/**
 * currentSrc, beklenen data-orig-src veya srcset adaylarından biriyle eşleşiyor mu?
 * @param {string} currentSrc
 * @param {string} dataOrigSrc
 * @param {string[]} [srcsetAttrs] data-orig-srcset / data-srcset / srcset değerleri
 * @returns {boolean}
 */
export function currentSrcMatchesExpected(currentSrc, dataOrigSrc, srcsetAttrs = []) {
  const expectedUrls = [];
  if (dataOrigSrc) expectedUrls.push(dataOrigSrc);
  for (const attr of srcsetAttrs || []) {
    for (const u of parseSrcsetUrls(attr)) {
      expectedUrls.push(u);
    }
  }
  const realExpected = expectedUrls.filter((u) => u && !String(u).toLowerCase().startsWith('data:'));
  if (!realExpected.length) return true;

  const cur = normalizeImageStem(currentSrc);
  if (!cur) return false;

  for (const exp of realExpected) {
    if (imageStemsMatch(cur, normalizeImageStem(exp))) return true;
  }
  return false;
}
