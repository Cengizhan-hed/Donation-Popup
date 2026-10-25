/**
 * Karantina listesi: aralıklı (flaky) olduğu kanıtlanmış, kök nedeni bulunamamış senaryolar.
 * Karantinadaki senaryo ÇALIŞIR; ama hatası kırmızı sayılmaz, tam paket çıktısında
 * "karantina: bilgi amaçlı" satırı olarak raporlanır. Her giriş: neden + tarih + çıkış koşulu.
 */
export const QUARANTINE = [
  {
    check: 'addon-custom-popup',
    device: 'iphone',
    env: 'local',
    since: '2026-10-25',
    ref: 'AYAR-TURU-NOTLARI A7; RAPOR-7A.md',
    reason:
      'iPhone/WebKit tam pakette aralıklı (yük altında); izole 20/20 yeşil, kök neden bulunamadı. Çıkış: 7C/7D yeni alt bağış modülü + 10 ardışık tam paket yeşil.',
  },
];

/**
 * @param {string} check
 * @param {string} device
 * @param {string} env
 * @returns {typeof QUARANTINE[number]|null}
 */
export function quarantineFor(check, device, env) {
  return (
    QUARANTINE.find(
      (q) => q.check === check && q.device === device && (q.env === '*' || q.env === env)
    ) || null
  );
}
