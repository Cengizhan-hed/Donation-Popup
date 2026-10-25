/**
 * Teşekkür ekranı saf mantığı (birim testli): azaltılmış hareket, konfeti parametreleri, paylaş/kopyala.
 */

/**
 * Kullanıcı azaltılmış hareket istiyor mu.
 *
 * @param {Window|null|undefined} win Pencere.
 * @return {boolean} Evet ise animasyon yok.
 */
export function prefersReducedMotion(win) {
  return !!(win && typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Konfeti parçalarının parametreleri.
 *
 * @param {number} count Parça sayısı.
 * @param {() => number} random 0..1 üreteç.
 * @return {Array<{left:number,size:number,ratio:number,round:boolean,drift:number,rotate:number,duration:number,delay:number,tone:number}>} Parçalar.
 */
export function confettiSpec(count, random) {
  const pieces = [];
  for (let i = 0; i < count; i += 1) {
    pieces.push({
      left: 5 + random() * 90,
      size: 6 + random() * 6,
      ratio: random() > 0.5 ? 1 : 2,
      round: random() > 0.5,
      drift: (random() - 0.5) * 140,
      rotate: random() * 540,
      duration: 2.2 + random() * 1.6,
      delay: random() * 0.5,
      tone: i % 4,
    });
  }
  return pieces;
}

/**
 * Önce Web Share API'yi dener, yoksa bağlantıyı panoya kopyalar. Gönderi içinde kişi bilgisi yoktur.
 *
 * @param {{share?: Function, clipboard?: {writeText: Function}}} nav `navigator` benzeri.
 * @param {{title: string, text: string, url: string}} data Paylaşılacak veri.
 * @return {Promise<'shared'|'cancelled'|'copied'|'failed'>} Sonuç.
 */
export async function shareOrCopy(nav, data) {
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: data.title, text: data.text, url: data.url });
      return 'shared';
    } catch (error) {
      if (error && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }
  if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(data.url);
      return 'copied';
    } catch (error) {
      return 'failed';
    }
  }
  return 'failed';
}
