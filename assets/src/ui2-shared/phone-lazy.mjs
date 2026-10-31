/**
 * Telefon alanı bağlayıcısı (çekirdekte yalnız bu küçük dosya): kural tablosu + biçimleme `phone` paketindedir ve
 * ilk etkileşimde (odak / yazma / otomatik doldurma) bir kez yüklenir. Adres DOM'dan ya da kullanıcı girdisinden
 * alınmaz: bu betiğin kendi sunucu kaydındaki adresinden (`document.currentScript`: aynı köken, eklentinin
 * `assets/build/<experiences|compact>/index.js` dosyası) türetilir; doğrulanamazsa paket hiç yüklenmez ve sunucu
 * doğrulaması geçerlidir. Yüklenene kadar yazma serbesttir; yüklenince mevcut değer biçimlenir.
 */
const own = document.currentScript;
const found = own && own.src.match(/^(.*\/assets\/build\/)(?:experiences|compact)(\/index\.js(?:\?ver=[\w.-]+)?)$/);
const src = found && found[0].indexOf(`${location.origin}/`) === 0 ? `${found[1]}phone${found[2]}` : '';
let loading;

/** Bölümdeki dolu ama eksik/fazla telefon alanları; paket yokken boş (engelleme yok, sunucu doğrular). */
export const phoneBad = (root) => (window.__dpPhone && root ? window.__dpPhone.bad(root) : []);

/**
 * @param {HTMLElement} form Telefon kutusu içeren form/kart.
 * @param {(box: HTMLElement) => object} ctxFor Kutuya göre bağlam (paket yüklenince çağrılır).
 */
export function phoneBind(form, ctxFor) {
  const run = () => form.querySelectorAll('.donation-panel-phone').forEach((box) => window.__dpPhone.bindPhone(box, ctxFor(box)));
  const go = () => {
    if (window.__dpPhone) {
      run();
    } else if (src) {
      loading =
        loading ||
        new Promise((done) => {
          const tag = document.createElement('script');
          tag.src = src;
          tag.onload = tag.onerror = done;
          document.head.appendChild(tag);
        });
      loading.then(() => window.__dpPhone && run());
    }
  };
  ['focusin', 'input', 'change'].forEach((type) => form.addEventListener(type, go, { once: true }));
}
