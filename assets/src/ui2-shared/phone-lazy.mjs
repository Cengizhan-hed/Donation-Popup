/**
 * Telefon alanı bağlayıcısı (çekirdekte yalnız bu küçük dosya): kural tablosu + biçimleme `phone` paketindedir ve
 * ilk etkileşimde (odak / yazma / otomatik doldurma) bir kez yüklenir. Adres DOM'dan ya da kullanıcı girdisinden
 * alınmaz: sunucunun güvenilir yapılandırmasından gelir (betikten hemen önce basılan `self.__dpPhoneSrc`; liste/mağaza
 * kartı yolunda sunucu yanıtındaki `assets.phone`) ve yine de doğrulanır: aynı köken, kimlik bilgisi/parça yok,
 * eklentinin `assets/build/phone/index.js` dosyası, sorgu yalnız `ver`. CDN/birleştirme/erteleme (`currentScript` yok)
 * altında da çalışır. Adres yoksa ya da paket yüklenemezse yalnız sunucu doğrulaması geçerlidir: kullanıcıya hata
 * gösterilmez, konsola bir kez uyarı yazılır. Yüklenene kadar yazma serbesttir; yüklenince mevcut değer biçimlenir.
 */
const PATTERN = /\/assets\/build\/phone\/index\.js$/;
let loading;
let warned = false;

/** Tek konsol uyarısı (kullanıcıya görünmez). */
const warn = () => {
  if (!warned) {
    warned = true;
    window.console.warn('Donation Panel: phone helper could not be loaded; server-side validation applies.');
  }
};

/** @return {string} Doğrulanmış paket adresi ya da ''. */
const phoneSrc = () => {
  try {
    const url = new URL(String(window.__dpPhoneSrc || ''), location.href);
    const keys = Array.from(url.searchParams.keys());
    const query = keys.length === 0 || (keys.length === 1 && /^[A-Za-z0-9._-]{1,64}$/.test(url.searchParams.get('ver') || ''));
    return url.origin === location.origin && !url.username && !url.password && !url.hash && query && PATTERN.test(url.pathname) ? url.href : '';
  } catch {
    return '';
  }
};

/** Bölümdeki dolu ama eksik/fazla telefon alanları; paket yokken boş (engelleme yok, sunucu doğrular). */
export const phoneBad = (root) => (window.__dpPhone && root ? window.__dpPhone.bad(root) : []);

/**
 * @param {HTMLElement} form Telefon kutusu içeren form/kart.
 * @param {object} ctx Bağlam (`bindPhone` belgesine bakın).
 */
export function phoneBind(form, ctx) {
  const go = () => {
    const run = () => window.__dpPhone && form.querySelectorAll('.donation-panel-phone').forEach((box) => window.__dpPhone.bindPhone(box, ctx));
    if (window.__dpPhone) {
      run();
      return;
    }
    const src = phoneSrc();
    if (!src) {
      warn();
      return;
    }
    if (!loading) {
      loading = document.createElement('script');
      loading.src = src;
      loading.addEventListener('error', warn);
      document.head.appendChild(loading);
    }
    loading.addEventListener('load', run);
  };
  // Otomatik doldurma `input` olayı verir; yüklenince mevcut değer biçimlenir.
  ['focusin', 'input'].forEach((type) => form.addEventListener(type, go, { once: true }));
}
