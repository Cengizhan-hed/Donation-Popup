/**
 * Ortak sayfa kilidi: birden çok katman (popup, yan sepet, bağışçı hesabı) aynı anda açılabilir.
 *
 * - Kaydırma kilidi sınıfı, onu kullanan SON katman kapanınca kalkar (sayaç yerine sahip kaydı).
 * - Katman açıkken sayfanın geri kalanı `inert` olur (odak/ekran okuyucu dışarı kaçmaz); sayaçlı geri alınır.
 * - Kaydırma çubuğu kaybolunca masaüstünde sıçrama olmasın diye `scrollbar-gutter: stable` verilir.
 *
 * Her paket ayrı derlendiği için durum `window.__dpScrollLock` üzerinde ortaktır (kopyalar aynı kaydı görür).
 */

const FLAG = '__dpScrollLock';

/**
 * @return {{owners: Map<string, {className: string, container: Element}>, inert: Map<Element, {count: number, prior: boolean}>, gutter: string|null}} Ortak durum.
 */
function state() {
  if (!window[FLAG]) {
    window[FLAG] = { owners: new Map(), inert: new Map(), gutter: null };
  }
  return window[FLAG];
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
 * Tüm sahiplerin durumundan inert ve sınıfları yeniden hesaplar (en üstteki sahibin arka planı inert).
 */
function apply() {
  const s = state();
  const html = document.documentElement;

  // Sınıflar: sahiplerin kullandığı sınıfların birleşimi.
  const wanted = new Set(Array.from(s.owners.values()).map((o) => o.className).filter(Boolean));
  ['donation-panel-lock', 'donation-panel-sc-lock', 'donation-panel-ac-lock'].forEach((name) => {
    if (wanted.has(name)) {
      html.classList.add(name);
    } else {
      html.classList.remove(name);
    }
  });
  wanted.forEach((name) => html.classList.add(name));

  // Kaydırma çubuğu sıçramasını önle.
  if (s.owners.size > 0 && s.gutter === null) {
    s.gutter = html.style.scrollbarGutter || '';
    html.style.scrollbarGutter = 'stable';
  } else if (s.owners.size === 0 && s.gutter !== null) {
    html.style.scrollbarGutter = s.gutter;
    if (!html.style.scrollbarGutter) {
      html.style.removeProperty('scrollbar-gutter');
    }
    s.gutter = null;
  }

  // inert: yalnız en üstteki katmanın arka planı.
  const top = Array.from(s.owners.values()).pop();
  const target = new Set(top ? backgroundOf(top.container) : []);
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
 * @param {string} className Kilit sınıfı (donation-panel-lock | donation-panel-sc-lock | donation-panel-ac-lock).
 */
export function lockPage(owner, container, className) {
  const s = state();
  s.owners.delete(owner);
  s.owners.set(owner, { className, container });
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
