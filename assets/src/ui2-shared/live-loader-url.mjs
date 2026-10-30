/**
 * Canlı çubuk yükleyicisinin adres üretimi (saf; DOM yok; birim testle doğrulanır).
 *
 * Güvenlik: betik/stil adresi ASLA sayfadaki bir öznitelikten alınmaz. Adres, yükleyiciyi taşıyan eklenti paketinin kendi
 * adresinden (`.../assets/build/<paket>/index.js`) türetilir: aynı köken, aynı eklentinin `assets/build/progress/` yolu.
 * Öznitelikten yalnız sürüm belirteci okunur ve yalnız [A-Za-z0-9._-] kabul edilir.
 */

/**
 * @param {string} selfSrc  Yükleyiciyi taşıyan betiğin adresi (document.currentScript.src).
 * @param {string} token    Sürüm belirteci (veri; doğrulanır).
 * @param {string} origin   Sayfa kökeni (location.origin).
 * @return {{js: string, css: string}|null} Adresler ya da geçersizse null.
 */
export function progressAssetUrls(selfSrc, token, origin) {
  let self;
  try {
    self = new URL(String(selfSrc || ''));
  } catch {
    return null;
  }
  if (!/^https?:$/.test(self.protocol) || self.origin !== String(origin || '')) {
    return null;
  }
  const match = self.pathname.match(/^(.*\/assets\/build\/)[a-z0-9-]+\/index\.js$/);
  if (!match) {
    return null;
  }
  const version = String(token || '');
  if (version !== '' && !/^[A-Za-z0-9._-]{1,64}$/.test(version)) {
    return null;
  }
  const query = version ? `?ver=${version}` : '';
  const base = `${self.origin}${match[1]}progress/`;
  return { js: `${base}index.js${query}`, css: `${base}index.css${query}` };
}
