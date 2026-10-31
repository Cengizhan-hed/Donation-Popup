/**
 * Telefon alanı bağlayıcısı (çekirdekte yalnız bu küçük dosya): kural tablosu + biçimleme `phone` paketindedir ve
 * ilk etkileşimde (odak / yazma / otomatik doldurma) bir kez yüklenir. Adres DOM'dan ya da kullanıcı girdisinden
 * alınmaz: bu betiğin kendi sunucu kaydındaki adresinden (`document.currentScript`: aynı köken, eklentinin
 * `assets/build/<experiences|compact>/index.js` dosyası) türetilir; doğrulanamazsa paket hiç yüklenmez ve sunucu
 * doğrulaması geçerlidir. Yüklenene kadar yazma serbesttir; yüklenince mevcut değer biçimlenir.
 */
const own = document.currentScript;
const found = own && own.src.match(/^(.*\/assets\/build\/)(?:experiences|compact)(\/index\.js(?:\?ver=[\w.-]+)?)$/);
// (Adres kimlik bilgisi/parça içermez: kalıp yalnız eklentinin kendi derleme yolunu ve `ver` sorgusunu kabul eder.)
const src = found && found[0].indexOf(`${location.origin}/`) === 0 ? `${found[1]}phone${found[2]}` : '';
let loading;

/** Bölümdeki dolu ama eksik/fazla telefon alanları; paket yokken boş (engelleme yok, sunucu doğrular). */
export const phoneBad = (root) => (window.__dpPhone && root ? window.__dpPhone.bad(root) : []);

/**
 * @param {HTMLElement} form Telefon kutusu içeren form/kart.
 * @param {object} ctx Bağlam (`bindPhone` belgesine bakın).
 */
export function phoneBind(form, ctx) {
  const go = () => {
    const run = () => window.__dpPhone && form.querySelectorAll('.donation-panel-phone').forEach((box) => window.__dpPhone.bindPhone(box, ctx));
    if (window.__dpPhone || !src) {
      run();
      return;
    }
    if (!loading) {
      loading = document.createElement('script');
      loading.src = src;
      document.head.appendChild(loading);
    }
    loading.addEventListener('load', run);
  };
  // Otomatik doldurma `input` olayı verir; yüklenince mevcut değer biçimlenir.
  ['focusin', 'input'].forEach((type) => form.addEventListener(type, go, { once: true }));
}
