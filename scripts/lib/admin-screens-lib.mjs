/**
 * admin:screens saf yardımcıları (tarayıcı gerektirmez; birim testli).
 * Yalnız arayüz metinleri toplanır; kullanıcı/sipariş verisi ve ayar DEĞERLERİ toplanmaz.
 */
import { isLiveBlockedHost } from '../../tests/e2e/helpers/network-guard.mjs';

/** Yalnız bu ortamlara izin var. Canlı ve başka her ad reddedilir. */
export const ALLOWED_ENVS = Object.freeze(['local', 'staging-hedef', 'ikram-aid']);

/** Gezinti arası bekleme (Wordfence / sunucu yükü). */
export const NAV_DELAY_MS = 400;

/** Eklenti satırı (plugins.php). */
export const PLUGIN_SLUG = 'woo-donation-popup';

/**
 * Açılacak ekranlar. Hepsi wp-admin altında, yalnız GET.
 * `optional`: yoksa hata sayılmaz (ör. yalnız eski ya da yalnız yeni ekran vardır).
 * `pluginRowOnly`: yalnız eklenti satırı toplanır (başka eklentilerin adları yazılmaz).
 * `needsProduct`: bir bağış ürünü düzenleme sayfası (`{id}` yer tutucu).
 */
export const SCREENS = Object.freeze([
  { id: 'plugins', path: '/wp-admin/plugins.php', note: 'Eklentiler (eklenti satırı ad/sürüm)', pluginRowOnly: true },
  { id: 'plugin-install', path: '/wp-admin/plugin-install.php', note: 'Eklentiler › Yeni ekle (Eklenti yükle düğmesi)' },
  { id: 'dp-settings-new', path: '/wp-admin/admin.php?page=donation-panel', note: 'Yeni ayar ekranı (Donation Panel)', optional: true },
  { id: 'dp-guide', path: '/wp-admin/admin.php?page=donation-panel-guide', note: 'Donation Panel rehberi', optional: true },
  { id: 'dp-setup', path: '/wp-admin/options.php?page=donation-panel-setup', note: 'Kurulum Sihirbazı (menüde görünmez)', optional: true },
  { id: 'privacy-settings', path: '/wp-admin/options-privacy.php', note: 'Ayarlar › Gizlilik' },
  { id: 'privacy-guide', path: '/wp-admin/privacy-policy-guide.php', note: 'Gizlilik Politikası Kılavuzu (eklenti bölümü var mı)', sectionProbe: true },
  { id: 'export-personal', path: '/wp-admin/export-personal-data.php', note: 'Araçlar › Kişisel Veriyi Dışa Aktar' },
  { id: 'erase-personal', path: '/wp-admin/erase-personal-data.php', note: 'Araçlar › Kişisel Veriyi Sil' },
  { id: 'wc-account', path: '/wp-admin/admin.php?page=wc-settings&tab=account', note: 'WooCommerce › Ayarlar › Hesaplar ve Gizlilik' },
  { id: 'wc-general', path: '/wp-admin/admin.php?page=wc-settings&tab=general', note: 'WooCommerce › Ayarlar › Genel (para birimi)' },
  { id: 'wc-checkout', path: '/wp-admin/admin.php?page=wc-settings&tab=checkout', note: 'WooCommerce › Ayarlar › Ödemeler' },
  { id: 'wc-site-visibility', path: '/wp-admin/admin.php?page=wc-settings&tab=site-visibility', note: 'WooCommerce › Ayarlar › Site görünürlüğü', optional: true },
  { id: 'wc-advanced', path: '/wp-admin/admin.php?page=wc-settings&tab=advanced', note: 'WooCommerce › Ayarlar › Gelişmiş', optional: true },
  { id: 'product-edit', path: '/wp-admin/post.php?post={id}&action=edit', note: 'Ürün düzenleme (Bağış Paneli ürün veri sekmesi)', needsProduct: true },
]);

/**
 * @param {string} envId
 * @returns {string} normalize ortam adı
 * @throws {Error} izin listesinde değilse (canlı dahil)
 */
export function assertEnvAllowed(envId) {
  const id = String(envId || '').trim().toLowerCase();
  const norm = id === 'local-wp' ? 'local' : id;
  if (isLiveBlockedHost(id)) {
    throw new Error(`admin:screens: canlı site reddedildi (${id}).`);
  }
  if (!ALLOWED_ENVS.includes(norm)) {
    throw new Error(`admin:screens: ortam izinli değil: "${id}" (izinli: ${ALLOWED_ENVS.join(', ')}).`);
  }
  return norm;
}

/**
 * Yalnız taban adresle aynı kökenli wp-admin GET gezintisine izin verir.
 * @param {string} base Site taban adresi.
 * @param {string} url Hedef adres ya da yol.
 * @returns {string} tam adres
 * @throws {Error} wp-admin dışı ya da başka köken
 */
export function assertAdminGetUrl(base, url) {
  const b = new URL(base);
  const u = new URL(url, b);
  if (u.origin !== b.origin) throw new Error(`admin:screens: yabancı köken reddedildi: ${u.origin}`);
  if (!u.pathname.startsWith('/wp-admin/')) throw new Error(`admin:screens: wp-admin dışı yol reddedildi: ${u.pathname}`);
  return u.toString();
}

/**
 * İstek yöntemi yalnız GET/HEAD ise okuma sayılır.
 * @param {string} method HTTP yöntemi.
 * @returns {boolean}
 */
export function isReadMethod(method) {
  const m = String(method || '').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

/**
 * Ekranın adresini üretir; `{id}` yer tutucusu ürün kimliği ile doldurulur.
 * @param {string} base Site taban adresi.
 * @param {{ path: string, needsProduct?: boolean }} screen Ekran.
 * @param {number|string} [productId] Ürün kimliği.
 * @returns {string|null} adres ya da ürün gerekip yoksa null
 */
export function screenUrl(base, screen, productId) {
  let p = screen.path;
  if (screen.needsProduct) {
    const id = Math.abs(Number.parseInt(String(productId), 10) || 0);
    if (!id) return null;
    p = p.replace('{id}', String(id));
  }
  return assertAdminGetUrl(base, p);
}

/**
 * Metni karşılaştırma için normalleştirir (Türkçe küçük harf, noktalama yok, tek boşluk).
 * @param {string} s Metin.
 * @returns {string}
 */
export function norm(s) {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[‘’“”"'`]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Belge metninden `A › B › C` biçimli yolları çıkarır.
 * Son parça ilk ayırıcıda (`:` `,` `.` `;` `(` `—` tırnak) kesilir; yan çizgi (`/`) seçenek ayırır.
 * @param {string} markdown Belge metni.
 * @returns {{ raw: string, segments: string[][], line: number }[]} Her yol için seçenek listeleri.
 */
export function extractDocPaths(markdown) {
  const out = [];
  const seen = new Set();
  const lines = String(markdown || '').split(/\r?\n/);
  lines.forEach((text, i) => {
    if (!text.includes('›')) return;
    const plain = text
      .replace(/^\s*(?:[-*+]\s*(?:\[[ xX]\]\s*)?|\d+[.)]\s*)+/, '')
      .replace(/[`*_]/g, '');
    const re = /([^\s›:,;().—"“”'][^›:,;().—"“”]*?(?:\s*›\s*[^›:,;().—"“”]+)+)/g;
    let m;
    while ((m = re.exec(plain)) !== null) {
      const raw = m[1].trim();
      const segments = raw
        .split('›')
        .map((seg) => seg.trim())
        .filter(Boolean)
        .map((seg) => seg.split(/\s*\/\s*/).map((a) => a.trim()).filter(Boolean));
      if (segments.length < 2) continue;
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ raw, segments, line: i + 1 });
    }
  });
  return out;
}

/**
 * Toplanan ekranlardan düz metin havuzu ve menü ağacı üretir.
 * @param {{ menu?: { label: string, subs: { label: string }[] }[], screens?: object[] }} data Toplanan veri.
 * @returns {{ top: string[], subsByTop: Map<string, string[]>, texts: string[] }}
 */
export function buildCorpus(data) {
  const top = [];
  const subsByTop = new Map();
  const texts = [];
  for (const m of data.menu || []) {
    const t = norm(m.label);
    if (!t) continue;
    top.push(t);
    subsByTop.set(t, (m.subs || []).map((s) => norm(s.label)).filter(Boolean));
    texts.push(t, ...subsByTop.get(t));
  }
  for (const s of data.screens || []) {
    for (const k of ['title', 'docTitle', 'note']) if (s[k]) texts.push(norm(s[k]));
    for (const k of ['tabs', 'headings', 'labels', 'buttons', 'productTabs', 'menuLabels']) {
      for (const x of s[k] || []) texts.push(norm(x));
    }
    if (s.pluginRow && s.pluginRow.name) texts.push(norm(s.pluginRow.name));
  }
  return { top, subsByTop, texts: [...new Set(texts.filter(Boolean))] };
}

/**
 * Parça, havuzdaki bir metinle eşleşiyor mu? (iki yönlü içerme; kısa metinler tam eşleşir)
 * @param {string[]} texts Normalleştirilmiş metinler.
 * @param {string} seg Aranan parça.
 * @returns {boolean}
 */
export function hasText(texts, seg) {
  const n = norm(seg);
  if (!n) return false;
  return texts.some((t) => t === n || (n.length >= 4 && t.includes(n)) || (t.length >= 5 && n.includes(t)));
}

/**
 * Belgede geçen yolları toplanan veriyle karşılaştırır.
 * İlk parça üst menü ya da herhangi bir metin; sonrakiler (alt menü varsa onun altında) havuzda aranır.
 * @param {{ raw: string, segments: string[][], line: number }[]} docPaths Belge yolları.
 * @param {object} data Toplanan veri.
 * @returns {{ found: object[], missing: { raw: string, line: number, missingSegment: string }[] }}
 */
export function compareDocPaths(docPaths, data) {
  const corp = buildCorpus(data);
  const found = [];
  const missing = [];
  for (const p of docPaths) {
    let bad = '';
    const first = p.segments[0];
    const topHit = corp.top.find((t) => first.some((a) => hasText([t], a)));
    if (!topHit && !first.some((a) => hasText(corp.texts, a))) bad = first.join(' / ');
    for (let i = 1; i < p.segments.length && !bad; i++) {
      const alts = p.segments[i];
      const pool = topHit && i === 1 && (corp.subsByTop.get(topHit) || []).length ? [...(corp.subsByTop.get(topHit) || []), ...corp.texts] : corp.texts;
      if (!alts.some((a) => hasText(pool, a))) bad = alts.join(' / ');
    }
    if (bad) missing.push({ raw: p.raw, line: p.line, missingSegment: bad });
    else found.push({ raw: p.raw, line: p.line });
  }
  return { found, missing };
}

/**
 * Sol menüden eklentinin hangi ayar ekranını sunduğunu belirler.
 * @param {{ label: string, subs: { label: string, slug?: string }[], slug?: string }[]} menu Menü.
 * @returns {{ uiMode: 'new'|'none', slugs: string[] }}
 */
export function detectUiMode(menu) {
  const slugs = [];
  for (const m of menu || []) {
    for (const x of [m, ...(m.subs || [])]) {
      if (x.slug && /^donation-panel/.test(x.slug)) slugs.push(x.slug);
    }
  }
  const uniq = [...new Set(slugs)];
  const hasNew = uniq.some((s) => s.startsWith('donation-panel'));
  return { uiMode: hasNew ? 'new' : 'none', slugs: uniq };
}

/**
 * Sayfada çalıştırılan toplayıcı (kendi içinde eksiksiz; dış değişken kullanmaz).
 * Yalnız arayüz metni okur: girdi değerleri, bildirimler, tablo satırları (eklenti satırı hariç) okunmaz.
 * @param {{ pluginSlug: string, pluginRowOnly: boolean, wantMenu: boolean }} opts Seçenekler.
 */
export function collectScreenDom(opts) {
  const clean = (el) => {
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('.awaiting-mod,.update-plugins,.plugin-count,.count,.pending-count,.screen-reader-text,script,style,.notice').forEach((n) => n.remove());
    return (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  };
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].slice(0, 200);
  const slugOf = (href) => {
    try {
      const u = new URL(href, location.href);
      return u.searchParams.get('page') || u.pathname.split('/').pop() || '';
    } catch (e) {
      return '';
    }
  };
  const out = {
    docTitle: (document.title || '').replace(/\s+/g, ' ').trim().slice(0, 140),
    bodyClass: '',
    denied: false,
    loginScreen: !!document.querySelector('#loginform'),
    title: '',
    tabs: [],
    headings: [],
    labels: [],
    buttons: [],
    productTabs: [],
    pluginRow: null,
    menu: [],
  };
  out.denied = !!document.querySelector('.wp-die-message, #error-page');
  if (out.denied) out.headings = [clean(document.querySelector('.wp-die-message, #error-page'))].slice(0, 1);
  if (opts.wantMenu) {
    out.menu = [...document.querySelectorAll('#adminmenu > li')]
      .filter((li) => !li.classList.contains('wp-menu-separator'))
      .map((li) => {
        const a = li.querySelector(':scope > a');
        return {
          label: clean(li.querySelector(':scope > a .wp-menu-name')),
          slug: a ? slugOf(a.getAttribute('href') || '') : '',
          subs: [...li.querySelectorAll(':scope > .wp-submenu li:not(.wp-submenu-head) > a')].map((s) => ({
            label: clean(s),
            slug: slugOf(s.getAttribute('href') || ''),
          })),
        };
      })
      .filter((m) => m.label);
  }
  const wrap = document.querySelector('#wpbody-content') || document.body;
  if (opts.pluginRowOnly) {
    const row =
      document.querySelector(`tr[data-slug="${opts.pluginSlug}"]`) ||
      document.querySelector(`tr[data-plugin^="${opts.pluginSlug}/"]`) ||
      document.querySelector(`#the-list tr.${opts.pluginSlug}`);
    out.pluginRowCount = document.querySelectorAll('#the-list tr').length;
    if (row) {
      const ver = clean(row.querySelector('.plugin-version-author-uri'));
      out.pluginRow = {
        name: clean(row.querySelector('.plugin-title strong')),
        version: (ver.match(/\d+(?:\.\d+){1,3}[\w.-]*/) || [''])[0],
        active: row.classList.contains('active'),
      };
    }
    out.title = clean(document.querySelector('.wrap h1'));
    return out;
  }
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const titleEl =
    [...wrap.querySelectorAll('.wrap > h1, h1.wp-heading-inline, .wrap h1, h1')].find(visible) ||
    [...wrap.querySelectorAll('.wrap > h2, h2')].find(visible);
  out.title = clean(titleEl);
  out.tabs = uniq([...wrap.querySelectorAll('.nav-tab, .nav-tab-wrapper a, [role="tab"], .subsubsub a, .wc-tabs a')].map(clean));
  out.headings = uniq([...wrap.querySelectorAll('h1, h2, h3, h4, legend, summary, .postbox .hndle')].map(clean));
  out.labels = uniq([...wrap.querySelectorAll('label, .form-table th, .form-table legend, th.titledesc')].map(clean));
  out.buttons = uniq([
    ...[...wrap.querySelectorAll('a.page-title-action, .upload-view-toggle, button, a.button')].map(clean),
    ...[...wrap.querySelectorAll('input[type="submit"], input[type="button"]')].map((i) => (i.getAttribute('value') || '').trim()),
  ]);
  out.productTabs = uniq([...document.querySelectorAll('ul.product_data_tabs li a')].map(clean));
  return out;
}

/**
 * Raporu Markdown'a çevirir.
 * @param {{ env: string, baseHost: string, generatedAt: string, uiMode: object, screens: object[], docCheck?: object }} report Rapor.
 * @returns {string}
 */
export function renderMarkdown(report) {
  const L = [];
  L.push(`# Yönetici ekran adları — ${report.env}`);
  L.push('');
  L.push(`Tarih: ${report.generatedAt} · Yalnız arayüz metni; kişisel veri ve ayar değeri yok.`);
  L.push(`Ayar ekranı kipi: **${report.uiMode.uiMode}** (menü slug: ${report.uiMode.slugs.join(', ') || 'yok'})`);
  L.push('');
  L.push('## Sol menü');
  for (const m of report.menu || []) {
    L.push(`- ${m.label}${m.subs.length ? ` › ${m.subs.map((s) => s.label).join(' | ')}` : ''}`);
  }
  L.push('');
  L.push('## Ekranlar');
  for (const s of report.screens) {
    L.push('');
    L.push(`### ${s.note || s.id}`);
    L.push(`- Yol: \`${s.path}\` — durum: ${s.status}`);
    if (s.title) L.push(`- Sayfa başlığı: ${s.title}`);
    if (s.pluginRowCount !== undefined && !s.pluginRow) L.push(`- Eklenti satırı bulunamadı (listedeki satır sayısı: ${s.pluginRowCount})`);
    if (s.pluginRow) L.push(`- Eklenti satırı: ${s.pluginRow.name} ${s.pluginRow.version} (${s.pluginRow.active ? 'etkin' : 'etkin değil'})`);
    if (s.tabs && s.tabs.length) L.push(`- Sekmeler: ${s.tabs.join(' | ')}`);
    if (s.productTabs && s.productTabs.length) L.push(`- Ürün veri sekmeleri: ${s.productTabs.join(' | ')}`);
    if (s.headings && s.headings.length) L.push(`- Bölüm başlıkları: ${s.headings.slice(0, 40).join(' | ')}`);
    if (s.labels && s.labels.length) L.push(`- Etiketler: ${s.labels.slice(0, 60).join(' | ')}`);
    if (s.buttons && s.buttons.length) L.push(`- Düğmeler: ${s.buttons.slice(0, 30).join(' | ')}`);
    if (s.sectionFound !== undefined) L.push(`- Eklenti bölümü (Gizlilik Kılavuzu): ${s.sectionFound ? 'var' : 'yok'}`);
  }
  if (report.docCheck) {
    L.push('');
    L.push(`## Belge kontrolü (${report.docCheck.doc})`);
    L.push(`Bulunan: ${report.docCheck.found.length} · Bulunamayan: ${report.docCheck.missing.length}`);
    for (const x of report.docCheck.missing) {
      L.push(`- satır ${x.line}: \`${x.raw}\` — bulunamayan parça: "${x.missingSegment}"`);
    }
    if (report.env !== 'local') {
      L.push('');
      L.push('Not: eşleşme sitenin yönetici dilindeki metinlerle yapılır; dil farkı yalancı "bulunamadı" üretebilir.');
    }
  }
  L.push('');
  return L.join('\n');
}
