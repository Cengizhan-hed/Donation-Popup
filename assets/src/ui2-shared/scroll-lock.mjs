/**
 * Ortak sayfa kilidi: birden çok katman (popup, yan sepet, bağışçı hesabı) aynı anda açılabilir.
 *
 * - Kaydırma kilidi kökte (html) satır içi `overflow: hidden` ile yapılır ve onu kullanan SON katman kapanınca kalkar
 *   (sayaç yerine sahip kaydı). Kök öğeye sınıf EKLENMEZ: temaların `html[class*=…]` / `html:not(.x) …` gibi kökten
 *   başlayan kuralları sınıf değişince tüm belgenin stilini yeniden hesaplatır (ağır temada açılışta onlarca ms).
 *   Önceki satır içi değer saklanır ve geri yüklenir.
 * - Katman açıkken sayfanın geri kalanı `inert` olur (odak/ekran okuyucu dışarı kaçmaz); sayaçlı geri alınır.
 *   Yerel kipli `<dialog>` (showModal) kullanan katman `native: true` verir: tarayıcı arka planı zaten etkisiz kılar,
 *   öznitelik yazılmaz (her `inert` özniteliği o alt ağacın stilini yeniden hesaplatır).
 * - Kaydırma çubuğu kaybolunca sayfa yana kaymasın (titreme) diye, YALNIZ çubuk gerçekten yer kaplıyorsa (klasik çubuk)
 *   kökün `padding-inline-end` değeri çubuk genişliği kadar artırılır; kaplama çubukta ya da taşmasız sayfada hiçbir şey
 *   yazılmaz. `scrollbar-gutter: stable` KULLANILMAZ: Chromium temanın `::-webkit-scrollbar` biçimli çubuğunda
 *   `overflow: hidden` iken boşluğu korumuyor (ölçüldü: 1265 → 1280 px), tasarımsız eski kilit de taşmasız sayfaya boşluk
 *   ekleyip içeriği sola kaydırıyordu. Ölçüm (çubuk + kökün mevcut iç boşluğu) niyet anında yapılır.
 *
 * Her paket ayrı derlendiği için durum `window.__dpScrollLock` üzerinde ortaktır (kopyalar aynı kaydı görür).
 */

const FLAG = '__dpScrollLock';

/**
 * @return {{owners: Map<string, {className: string, container: Element, native: boolean}>, inert: Map<Element, {prior: boolean}>, gutter: string|null, overflow: string|null}} Ortak durum.
 */
function state() {
  if (!window[FLAG]) {
    window[FLAG] = { owners: new Map(), inert: new Map(), gutter: null, overflow: null, pad: null, gap: null };
  }
  ['overflow', 'pad', 'gap', 'gutter'].forEach((key) => {
    if (!(key in window[FLAG])) {
      window[FLAG][key] = null; // eski sürüm paketinin kurduğu durum
    }
  });
  return window[FLAG];
}

/**
 * Klasik kaydırma çubuğunun kapladığı genişlik (px; kaplama çubukta/taşmasız sayfada 0). Önbellekli; pencere boyutu
 * değişince yeniden ölçülür. Okuma düzen ister: katman bunu dokunma NİYETİNDE (`measureScrollbar`) çağırır, açılış
 * tıklamasında okuma olmaz (önbellek boşsa — ör. yalnız klavyeyle açılış — bir kez ölçülür).
 *
 * @return {number} Genişlik.
 */
function scrollbarGap() {
  const s = state();
  if (s.gap === null) {
    const html = document.documentElement;
    s.gap = Math.max(0, Math.round(window.innerWidth - html.clientWidth));
    // Kökün mevcut iç boşluğu (tema verdiyse) korunur: kilitte değer = mevcut + çubuk.
    s.padBase = s.gap > 0 ? parseFloat(window.getComputedStyle(html).paddingInlineEnd) || 0 : 0;
    if (!s.gapReset) {
      s.gapReset = true;
      window.addEventListener(
        'resize',
        () => {
          if (!s.owners.size) {
            s.gap = null;
          }
        },
        { passive: true }
      );
    }
  }
  return s.gap;
}

/**
 * Niyet anında (üstüne gelme/basma/odak; düzen zaten hesaplı) kaydırma çubuğunu ölçer; kilitliyken ölçmez.
 *
 * @return {number} Genişlik.
 */
export function measureScrollbar() {
  const s = state();
  return s.owners.size ? s.gap || 0 : scrollbarGap();
}

/**
 * Katman kökünden gövdeye kadar her düzeydeki kardeşler: katmanın dışında kalan tüm sayfa içeriği.
 * (Katman bir içerik bölümünün içinde çizilse bile geri kalan sayfa arka plan sayılır.)
 *
 * @param {Element} container Katman kökü.
 * @return {Element[]} Arka plan öğeleri.
 */
function backgroundOf(container) {
  const body = document.body;
  const skip = ['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT'];
  const out = [];
  let node = container;
  while (node && node !== body && node.parentElement) {
    Array.from(node.parentElement.children).forEach((sibling) => {
      if (sibling !== node && !skip.includes(sibling.tagName)) {
        out.push(sibling);
      }
    });
    node = node.parentElement;
  }
  return out;
}

/**
 * Kökte satır içi bir özelliği kilit süresince sabitler; önceki satır içi değer saklanır ve kilit kalkınca geri yüklenir.
 *
 * @param {HTMLElement} html Kök öğe.
 * @param {object} s Ortak durum.
 * @param {string} key Durumdaki saklama anahtarı.
 * @param {string} prop CSS özelliği.
 * @param {string} value Kilitliyken değer.
 * @param {boolean} locked Kilit açık mı.
 */
function pinStyle(html, s, key, prop, value, locked) {
  if (locked && s[key] === null) {
    s[key] = html.style.getPropertyValue(prop) || '';
    html.style.setProperty(prop, value);
  } else if (!locked && s[key] !== null) {
    if (s[key]) {
      html.style.setProperty(prop, s[key]);
    } else {
      html.style.removeProperty(prop);
    }
    s[key] = null;
  }
}

/**
 * Tüm sahiplerin durumundan kaydırma kilidini ve inert'i yeniden hesaplar (en üstteki sahibin arka planı inert).
 * Yalnız yazma yapar (düzen okuması yok).
 */
function apply() {
  const s = state();
  const html = document.documentElement;
  const locked = s.owners.size > 0;

  // Kaydırma çubuğu sıçraması (titreme): çubuk YALNIZ gerçekten yer kaplıyorsa (klasik çubuk) genişliği kadar iç boşluk;
  // ölçüm kilitten ÖNCE (çoğunlukla niyet anında önbelleğe alınmış; değilse overflow yazılmadan önce burada).
  const gap = locked && s.overflow === null ? scrollbarGap() : s.gap || 0;
  // Kaydırma kilidi (satır içi; kök sınıfı yok).
  pinStyle(html, s, 'overflow', 'overflow', 'hidden', locked);
  pinStyle(html, s, 'gutter', 'scrollbar-gutter', 'stable', false); // eski sürüm paketinin bıraktığı değer temizlenir
  pinStyle(html, s, 'pad', 'padding-inline-end', `${(s.padBase || 0) + gap}px`, locked && (gap > 0 || s.pad !== null));
  if (!html.getAttribute('style')) {
    html.removeAttribute('style');
  }

  // inert: yalnız en üstteki katmanın arka planı (yerel kipli diyalogda tarayıcı yapar).
  const top = Array.from(s.owners.values()).pop();
  const target = new Set(top && !top.native ? backgroundOf(top.container) : []);
  s.inert.forEach((info, el) => {
    if (!target.has(el)) {
      if (!info.prior) {
        el.removeAttribute('inert');
      }
      s.inert.delete(el);
    }
  });
  target.forEach((el) => {
    if (!s.inert.has(el)) {
      s.inert.set(el, { prior: el.hasAttribute('inert') });
      el.setAttribute('inert', '');
    }
  });
}

/**
 * Katman açılırken çağrılır (aynı sahip tekrar çağırırsa tazelenir).
 *
 * @param {string} owner Benzersiz sahip kimliği.
 * @param {Element} container Katmanın kök öğesi (inert dışı kalır).
 * @param {string} className Katman türü etiketi (donation-panel-lock | donation-panel-sc-lock | donation-panel-ac-lock);
 *                           yalnız kayıt içindir, köke yazılmaz.
 * @param {{native?: boolean}} [opts] `native`: katman yerel kipli `<dialog>` (showModal) — arka plan inert'i tarayıcıda.
 */
export function lockPage(owner, container, className, opts = {}) {
  const s = state();
  s.owners.delete(owner);
  s.owners.set(owner, { className, container, native: Boolean(opts && opts.native) });
  apply();
}

/**
 * Katman kapanırken çağrılır (çift çağrı zararsız).
 *
 * @param {string} owner Sahip kimliği.
 */
export function unlockPage(owner) {
  const s = state();
  if (!s.owners.delete(owner)) {
    return;
  }
  apply();
}

/**
 * @param {string} owner Sahip kimliği.
 * @return {boolean} Bu katman en üstte mi (klavye olaylarını yalnız en üst katman işler).
 */
export function isTopmost(owner) {
  const keys = Array.from(state().owners.keys());
  return keys.length > 0 && keys[keys.length - 1] === owner;
}

/**
 * @return {boolean} Sayfa kilitli mi (en az bir katman açık).
 */
export function isLocked() {
  return state().owners.size > 0;
}
