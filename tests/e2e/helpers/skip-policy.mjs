/**
 * E2E atlama politikası: altyapı hatası kırmızı; atlama yalnız sabit listeden.
 * Bilinmeyen gerekçe → hata.
 */

/** Bilinçli kapsam dışı (uzak sipariş yok, local-only, katalog yok, ayar kapalı). */
export const ALLOWED_SKIP_PATTERNS = Object.freeze([
  /checkout-view-only/i,
  /uzakta sipariş yok/i,
  /Sipariş tamamlama atlandı/i,
  /yalnız yerel:/i,
  /private fixture listede\/mağazada görünmez/i,
  /yayımlanmış katalog ürünü yok/i,
  /liste sayfası yok ve mağaza döngüsü/i,
  /liste yok ve mağaza döngüsü yok/i,
  /Alt bağış ekle işaretli değil/i,
  /ürün ID boş ve genel varsayılan yok/i,
  /Benzer Bağışlar/i,
  /Liste sayfası yolu yok/i,
  /Mağaza sayfası WooCommerce/i,
  /\[wdp_donations\] ızgarası yok/i,
  /hisseli ürün yok/i,
  /para birimi gösterimi atlandı/i,
  /Ürün\/liste\/mağaza yolu yok/i,
  /ürün yolu yok/i,
  /ürünü yok →/i,
  /Genel fiyat boş doğrulaması atlandı/i,
  /ürün yok → atla/i,
  /popup tetikleyici/i,
  /atlandı: mağaza döngüsü tıklandı, kabuk yok/i,
  /atlandı: mağaza döngüsü tıklandı, kabuk görünür değil/i,
  /wdp_ajax yok/i,
  /skip-desktop/i,
  /Mağaza döngüsü kartı yok/i,
  /atlandı: .+ yolu yok/i,
]);

/** Yönetici açılamadı / timeout / oturum yok — atlama değil hata. */
export const INFRA_SKIP_PATTERNS = Object.freeze([
  /açılamadı/i,
  /timeout/i,
  /timed?\s*out/i,
  /zaman aşımı/i,
  /admin okuma hata/i,
  /yönetici oturumu yok/i,
  /wp-login/i,
  /Store API[’']den ürün ID bulunamadı/i,
]);

/**
 * @param {string} description
 * @returns {'skip'|'fail'}
 */
export function classifySkipReason(description) {
  const text = String(description || '').trim();
  if (!text) return 'fail';
  for (const re of INFRA_SKIP_PATTERNS) {
    if (re.test(text)) return 'fail';
  }
  for (const re of ALLOWED_SKIP_PATTERNS) {
    if (re.test(text)) return 'skip';
  }
  return 'fail';
}

/**
 * @param {object} opts
 * @param {Array<{check:string,description:string,detail?:string}>} opts.skips
 * @param {object[]} opts.failures
 * @param {{ skipped?: number, failed?: number }} [opts.stats]
 * @param {(row: object) => object} opts.makeFailure
 * @returns {number} hata olarak yükselen atlama sayısı
 */
export function promoteIllegalSkips({ skips, failures, stats, makeFailure }) {
  if (!Array.isArray(skips) || !Array.isArray(failures) || typeof makeFailure !== 'function') {
    return 0;
  }
  const kept = [];
  let promoted = 0;
  for (const s of skips) {
    const desc = String(s?.description || s?.detail || '');
    if (classifySkipReason(desc) === 'fail') {
      failures.push(
        makeFailure({
          check: s.check || 'skip',
          description: `Altyapı atlaması hata: ${desc}`,
          detail: s.detail || desc,
        })
      );
      promoted += 1;
      if (stats) {
        stats.skipped = Math.max(0, (Number(stats.skipped) || 1) - 1);
        stats.failed = (Number(stats.failed) || 0) + 1;
      }
    } else {
      kept.push(s);
    }
  }
  skips.length = 0;
  skips.push(...kept);
  return promoted;
}
