/**
 * İlgili-ürün gizleme kaynağı (CSSOM). Kişisel veri yok: yalnız etiket/sınıf/id, seçici, stil yolu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { PLUGIN_STYLE_PATH, SKIP_EVIDENCE, SKIP_REASONS } from './skip-policy.mjs';

export { PLUGIN_STYLE_PATH };

/** @param {string} source */
export function isPluginCssSource(source) {
  return String(source || '').includes(PLUGIN_STYLE_PATH);
}

/**
 * css-source atlaması: dosya yolu var ve eklenti dışı.
 * `inline` / boş → değil (kanıt yok).
 * @param {string} source
 */
export function isThemeCssSource(source) {
  const s = String(source || '').trim();
  if (!s || s === 'inline') return false;
  if (isPluginCssSource(s)) return false;
  return s.includes('/') || /\.css(\b|$)/i.test(s);
}

/**
 * @param {string} href
 * @returns {string} pathname (sorgu yok)
 */
export function pathnameFromHref(href) {
  const raw = String(href || '').trim();
  if (!raw || raw === 'inline') return raw;
  try {
    const u = new URL(raw, 'http://local.invalid');
    return u.pathname || raw.split('?')[0];
  } catch {
    return raw.split('?')[0].split('#')[0];
  }
}

/**
 * @param {{ hiding?: boolean, source?: string }|null} diag
 * @returns {{ verdict: 'visible'|'plugin'|'theme'|'unknown', check: string }}
 */
export function classifyRelatedHideSource(diag) {
  if (!diag || !diag.hiding) {
    return { verdict: 'visible', check: '' };
  }
  const source = String(diag.source || '');
  if (isPluginCssSource(source)) {
    return { verdict: 'plugin', check: 'plugin-hides-related' };
  }
  if (isThemeCssSource(source)) {
    return { verdict: 'theme', check: 'theme-hides-related' };
  }
  return { verdict: 'unknown', check: '' };
}

/**
 * @param {object} diag
 */
export function formatRelatedHideDebug(diag) {
  const d = diag || {};
  const cs = d.computed || {};
  return [
    `hide=${d.hiding ? 'yes' : 'no'}`,
    `ancestor tag=${d.tag || ''} class=${d.className || ''} id=${d.id || ''}`,
    `computed display=${cs.display || ''} visibility=${cs.visibility || ''} opacity=${cs.opacity || ''} height=${cs.height || ''}`,
    `rule selector=${d.selector || ''} source=${d.source || ''} prop=${d.prop || ''} value=${d.value || ''}`,
    `verdict=${d.verdict || classifyRelatedHideSource(d).verdict}`,
  ].join('\n');
}

/**
 * @param {object} diag
 * @returns {string} relative path
 */
export function writeRelatedHideDebug(diag) {
  const debugDir = path.join(ROOT, 'build/e2e/debug', String(process.env.WDP_E2E_PROFILE_ID || 'local'));
  fs.mkdirSync(debugDir, { recursive: true });
  const file = path.join(debugDir, 'loop-cards-product-css-source.txt');
  fs.writeFileSync(file, formatRelatedHideDebug(diag) + '\n', 'utf8');
  return path.relative(ROOT, file);
}

/**
 * Gizli bölüm + CSSOM kaynağı → atla / eklenti-kırmızı / mevcut akış.
 * @param {{ hiding?: boolean, source?: string, selector?: string }} hide
 */
export function decideRelatedHideOutcome(hide) {
  const cls = classifyRelatedHideSource(hide);
  const detail = formatRelatedHideDebug({ ...hide, verdict: cls.verdict });
  if (cls.verdict === 'plugin') {
    return {
      action: 'fail',
      check: 'plugin-hides-related',
      description: 'Eklenti CSS ilgili ürünler bölümünü gizliyor',
      detail,
    };
  }
  if (cls.verdict === 'theme') {
    return {
      action: 'skip',
      check: 'theme-hides-related',
      reason: SKIP_REASONS.THEME_HIDES_RELATED,
      evidence: SKIP_EVIDENCE.CSS_SOURCE,
      source: String(hide.source || ''),
      detail,
    };
  }
  return { action: 'continue', detail };
}

/**
 * Tarayıcıda çalışır (page.evaluate). Kapanış yok — tüm girdi `opts`.
 * @param {{ rootSel?: string, similarPat?: string, cardSel?: string, headingSel?: string, sectionSel?: string, pluginPath?: string }} opts
 */
export function diagnoseRelatedHideBrowser(opts) {
  const pluginPath = (opts && opts.pluginPath) || '/wp-content/plugins/woo-donation-popup/';
  const rootSel =
    (opts && opts.rootSel) ||
    '.related.products, .upsells.products, section.related, .wp-block-woocommerce-related-products, .wp-block-woocommerce-product-collection';
  const similarPat = (opts && opts.similarPat) || 'benzer\\s*bağış';
  const cardSel = (opts && opts.cardSel) || 'li.product, li.wc-block-product';
  // Siteye özgü başlık/bölüm seçicileri çağıranın (ortam profili) verdiği opts'tan gelir.
  const headingSel = (opts && opts.headingSel) || 'h1,h2,h3,h4';
  const sectionSel =
    (opts && opts.sectionSel) ||
    '.related, section, .wp-block-woocommerce-product-collection, .wp-block-woocommerce-related-products';

  function safeTokens(s) {
    return String(s || '')
      .split(/\s+/)
      .filter((c) => /^[A-Za-z0-9_-]{1,64}$/.test(c))
      .slice(0, 12)
      .join(' ');
  }

  function pathnameOf(href) {
    const raw = String(href || '').trim();
    if (!raw) return '';
    try {
      return new URL(raw, document.baseURI).pathname || raw.split('?')[0];
    } catch {
      return raw.split('?')[0].split('#')[0];
    }
  }

  function sheetSource(sheet) {
    if (!sheet) return 'inline';
    if (sheet.href) return pathnameOf(sheet.href);
    const node = sheet.ownerNode;
    const id = node && node.id ? String(node.id) : '';
    if (id === 'wdp-hide-native-cart' || (id && id.indexOf('wdp-') === 0)) {
      return pluginPath + '#' + id;
    }
    return id ? 'inline#' + id : 'inline';
  }

  function attrTokens(el, name) {
    if (!el) return '';
    const raw = (el.getAttribute && el.getAttribute(name)) || '';
    return safeTokens(raw);
  }

  function hidingProp(st, rect) {
    if (st.display === 'none') return { prop: 'display', value: st.display };
    if (st.visibility === 'hidden') return { prop: 'visibility', value: st.visibility };
    const opacity = Number.parseFloat(st.opacity == null ? '1' : String(st.opacity));
    if (Number.isFinite(opacity) && opacity <= 0.05) return { prop: 'opacity', value: String(st.opacity) };
    const h = rect ? Math.round(rect.height) : 0;
    if (h <= 0) return { prop: 'height', value: String(st.height || h) };
    return null;
  }

  function walkRules(list, visit) {
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const rule = list[i];
      // Stil kuralı önce: Chromium CSSStyleRule.cssRules boş liste (truthy) olabilir.
      if (rule.selectorText && rule.style) {
        visit(rule);
        continue;
      }
      if (rule.media && rule.cssRules) {
        try {
          if (rule.media.mediaText && !window.matchMedia(rule.media.mediaText).matches) {
            continue;
          }
        } catch {
          /* yine de yürü */
        }
        walkRules(rule.cssRules, visit);
        continue;
      }
      if (rule.cssRules && rule.cssRules.length) {
        walkRules(rule.cssRules, visit);
      }
    }
  }

  function findRule(el, prop) {
    const inlineVal = el.style && el.style.getPropertyValue(prop);
    const inlineImp = el.style && el.style.getPropertyPriority(prop) === 'important';
    const matches = [];
    const sheets = document.styleSheets;
    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      walkRules(rules, (rule) => {
        let ok = false;
        try {
          ok = el.matches(rule.selectorText);
        } catch {
          return;
        }
        if (!ok) return;
        const val = rule.style.getPropertyValue(prop);
        if (!val) return;
        matches.push({
          selector: String(rule.selectorText || '').slice(0, 240),
          source: sheetSource(rule.parentStyleSheet || sheet),
          important: rule.style.getPropertyPriority(prop) === 'important',
          value: val,
          prop,
        });
      });
    }
    const important = matches.filter((m) => m.important);
    const pool = important.length ? important : matches;
    const last = pool.length ? pool[pool.length - 1] : null;
    if (inlineVal && (inlineImp || !last || !last.important)) {
      return {
        selector: 'style',
        source: 'inline',
        important: inlineImp,
        value: inlineVal,
        prop,
      };
    }
    return last;
  }

  function findRoot() {
    const benzerRe = new RegExp(similarPat, 'i');
    const headings = Array.from(document.querySelectorAll(headingSel));
    const benzer = headings.find((h) => benzerRe.test(h.textContent || ''));
    return (
      (benzer && (benzer.closest(sectionSel) || benzer.parentElement)) ||
      document.querySelector(rootSel)
    );
  }

  const root = findRoot();
  const start = root || document.querySelector(cardSel);
  if (!start) {
    return {
      hiding: false,
      tag: '',
      className: '',
      id: '',
      computed: {},
      selector: '',
      source: '',
      prop: '',
      value: '',
      verdict: 'visible',
    };
  }

  let node = start;
  let found = null;
  let heightOnly = null;
  while (node && node !== document.documentElement) {
    const st = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    if (st.display === 'none' || st.visibility === 'hidden') {
      found = { node, st, r };
      break;
    }
    const opacity = Number.parseFloat(st.opacity == null ? '1' : String(st.opacity));
    if (Number.isFinite(opacity) && opacity <= 0.05) {
      found = { node, st, r };
      break;
    }
    if (!heightOnly && r.height <= 0) {
      heightOnly = { node, st, r };
    }
    node = node.parentElement;
  }
  if (!found) found = heightOnly;

  if (!found) {
    return {
      hiding: false,
      tag: start.tagName || '',
      className: attrTokens(start, 'class'),
      id: attrTokens(start, 'id'),
      computed: {
        display: getComputedStyle(start).display,
        visibility: getComputedStyle(start).visibility,
        opacity: getComputedStyle(start).opacity,
        height: String(Math.round(start.getBoundingClientRect().height)),
      },
      selector: '',
      source: '',
      prop: '',
      value: '',
      verdict: 'visible',
    };
  }

  const hp = hidingProp(found.st, found.r);
  const rule = hp ? findRule(found.node, hp.prop) : null;
  const computed = {
    display: found.st.display,
    visibility: found.st.visibility,
    opacity: found.st.opacity,
    height: String(Math.round(found.r.height)),
  };
  const source = rule ? rule.source : '';
  const plugin = source.indexOf(pluginPath) !== -1;
  const theme = !plugin && source && source !== 'inline' && (source.indexOf('/') !== -1 || /\.css(\b|$)/i.test(source));
  return {
    hiding: true,
    tag: found.node.tagName || '',
    className: attrTokens(found.node, 'class'),
    id: attrTokens(found.node, 'id'),
    computed,
    selector: rule ? rule.selector : '',
    source,
    prop: hp ? hp.prop : '',
    value: rule ? rule.value : hp ? hp.value : '',
    verdict: plugin ? 'plugin' : theme ? 'theme' : 'unknown',
  };
}
