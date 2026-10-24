/**
 * Ekran bütünlüğü: kabuk (popup/panel) ≠ tam sayfa.
 * Kabuk viewport çekilir; “yarım sayfa” yalnız tam sayfa ekranında
 * (readyState + son içerik bölgesi + ekran ≥ scrollHeight).
 */

/** Tam sayfa çekim: ekran yüksekliği scrollHeight’tan en fazla bu kadar kısa olabilir. */
export const PAGE_HEIGHT_TOLERANCE_PX = 16;
export const SHELL_EDGE_SLACK_PX = 2;
export const SHELL_MIN_PX = 8;
/** Son bölge: üst kenar ekranda + ≥%90 görünür veya alt kenar farkı ≤ bu (Avada 20 px). */
export const LAST_REGION_MIN_VISIBLE_RATIO = 0.9;
export const LAST_REGION_BOTTOM_SLACK_PX = 32;

/**
 * @param {string} screenName
 * @returns {'shell'|'page'}
 */
export function screenKindFromName(screenName) {
  return /-(popup|panel)-/i.test(String(screenName || '')) ? 'shell' : 'page';
}

/**
 * @typedef {{
 *   readyState?: string,
 *   screenshotH?: number,
 *   scrollHeight?: number,
 *   fullPage?: boolean,
 *   lastRegionKind?: 'footer'|'contentinfo'|'last-block'|'',
 *   lastRegionInDom?: boolean,
 *   lastRegionInShot?: boolean,
 *   lastRegionTop?: number,
 *   lastRegionBottom?: number,
 * }} PageCompletenessMetrics
 */

/**
 * Son bölge görünürlüğü: üst kenar ekranda ve (≥%90 görünür veya alt fark ≤ 32 px).
 * Üst kenar dışarıda / bölge yok → false (tam kesik kırmızı).
 * @param {{ top: number, bottom: number, shotH: number, lastRegionInShot?: boolean }} x
 */
export function lastRegionFitsShot(x) {
  const shotH = Number(x && x.shotH) || 0;
  const top = Number(x && x.top) || 0;
  const bottom = Number(x && x.bottom) || 0;
  if (!(shotH > 0)) {
    return typeof (x && x.lastRegionInShot) === 'boolean' ? !!x.lastRegionInShot : false;
  }
  const topOnScreen = top >= -PAGE_HEIGHT_TOLERANCE_PX && top < shotH;
  if (!topOnScreen) return false;
  const height = Math.max(0, bottom - top);
  const visTop = Math.max(top, 0);
  const visBottom = Math.min(bottom, shotH);
  const visible = Math.max(0, visBottom - visTop);
  const ratio = height > 0 ? visible / height : 1;
  const bottomSlack = bottom - shotH;
  return ratio >= LAST_REGION_MIN_VISIBLE_RATIO || bottomSlack <= LAST_REGION_BOTTOM_SLACK_PX;
}

/**
 * Tam sayfa, tema bağımsız: readyState complete + son içerik bölgesi DOM’da ve
 * çekilen ekranın içinde (üst kenar + ≥%90 / alt ≤32 px) + (fullPage)
 * ekran yüksekliği ≥ scrollHeight − tolerans.
 * Kendi settle yüksekliğiyle kıyas yok (3Y no-op).
 * @param {PageCompletenessMetrics} metrics
 * @returns {{ ok: boolean, reason: string, detail: string }}
 */
export function classifyPageHeight(metrics) {
  const x = metrics && typeof metrics === 'object' ? metrics : {};
  const ready = String(x.readyState || '');
  if (ready !== 'complete') {
    return { ok: false, reason: 'not-complete', detail: `readyState=${ready || '(yok)'}` };
  }
  if (!x.lastRegionInDom) {
    return {
      ok: false,
      reason: 'last-region-missing',
      detail: 'footer / [role=contentinfo] / son görünür blok yok',
    };
  }
  const shotH = Number(x.screenshotH) || 0;
  const top = Number(x.lastRegionTop) || 0;
  const bottom = Number(x.lastRegionBottom) || 0;
  const inShot = lastRegionFitsShot({
    top,
    bottom,
    shotH,
    lastRegionInShot: x.lastRegionInShot,
  });
  if (!inShot) {
    return {
      ok: false,
      reason: 'last-region-clipped',
      detail: `kind=${x.lastRegionKind || '?'} top=${Math.round(top)} bottom=${Math.round(bottom)} ekran=${Math.round(shotH)}px`,
    };
  }
  const scrollH = Number(x.scrollHeight) || 0;
  const fullPage = x.fullPage !== false;
  if (fullPage && scrollH > 0 && shotH < scrollH - PAGE_HEIGHT_TOLERANCE_PX) {
    return {
      ok: false,
      reason: 'half-page',
      detail: `ekran=${Math.round(shotH)}px scrollHeight=${Math.round(scrollH)}px tol=${PAGE_HEIGHT_TOLERANCE_PX}`,
    };
  }
  return { ok: true, reason: x.lastRegionKind || 'complete', detail: '' };
}

/**
 * Tarayıcıda çalışır (page.evaluate). Footer yoksa body’nin son görünür bloğu.
 * @returns {PageCompletenessMetrics}
 */
export function collectPageCompletenessMetrics() {
  const scroller = document.scrollingElement || document.documentElement;
  const scrollHeight = scroller ? scroller.scrollHeight : 0;
  const readyState = document.readyState || '';
  const hasBox = (el) => {
    if (!el) return false;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return st.display !== 'none' && st.visibility !== 'hidden' && r.width >= 1 && r.height >= 1;
  };
  const docY = (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
  };
  /** @type {{ el: Element, kind: 'footer'|'contentinfo'|'last-block' }|null} */
  let picked = null;
  const footer = document.querySelector('footer');
  if (footer && hasBox(footer)) {
    picked = { el: footer, kind: 'footer' };
  } else {
    const info = document.querySelector('[role="contentinfo"]');
    if (info && hasBox(info)) {
      picked = { el: info, kind: 'contentinfo' };
    }
  }
  if (!picked && document.body) {
    const skip = /^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE|META)$/;
    let last = null;
    let lastBottom = -Infinity;
    Array.from(document.body.children).forEach((el) => {
      if (skip.test(el.tagName) || !hasBox(el)) return;
      const y = docY(el);
      if (y.bottom >= lastBottom) {
        lastBottom = y.bottom;
        last = el;
      }
    });
    if (last) picked = { el: last, kind: 'last-block' };
  }
  const y = picked ? docY(picked.el) : { top: 0, bottom: 0 };
  return {
    readyState,
    scrollHeight,
    lastRegionKind: picked ? picked.kind : '',
    lastRegionInDom: !!picked,
    lastRegionTop: y.top,
    lastRegionBottom: y.bottom,
  };
}

/**
 * @typedef {{
 *   hasShell?: boolean,
 *   shellW?: number,
 *   shellH?: number,
 *   shellTop?: number,
 *   shellLeft?: number,
 *   shellRight?: number,
 *   shellBottom?: number,
 *   vw?: number,
 *   vh?: number,
 *   headerVisible?: boolean,
 *   ctaVisible?: boolean,
 *   lastItemVisible?: boolean,
 *   canScroll?: boolean,
 *   scrolledToEnd?: boolean,
 *   lastItemVisibleAfterScroll?: boolean,
 *   ctaVisibleAfterScroll?: boolean,
 * }} ShellCompletenessMetrics
 */

/**
 * Kabuk kökü görüntü alanında tam görünür veya kaydırınca son öğe + eylem çubuğu görünür.
 * Kesik / eksik / minik kabuk kırmızı (gevşetme yok).
 * @param {ShellCompletenessMetrics} m
 * @returns {{ ok: boolean, reason: string, detail: string }}
 */
export function classifyShellCompleteness(m) {
  const x = m && typeof m === 'object' ? m : {};
  const vw = Number(x.vw) || 0;
  const vh = Number(x.vh) || 0;
  const w = Number(x.shellW) || 0;
  const h = Number(x.shellH) || 0;
  const top = Number(x.shellTop) || 0;
  const left = Number(x.shellLeft) || 0;
  const right = Number(x.shellRight) || 0;
  const bottom = Number(x.shellBottom) || 0;

  if (!x.hasShell) {
    return { ok: false, reason: 'shell-missing', detail: 'açık kabuk kökü yok' };
  }
  if (w < SHELL_MIN_PX || h < SHELL_MIN_PX) {
    return { ok: false, reason: 'shell-tiny', detail: `kabuk=${Math.round(w)}x${Math.round(h)}` };
  }

  const fullyInView =
    top >= -SHELL_EDGE_SLACK_PX &&
    left >= -SHELL_EDGE_SLACK_PX &&
    (vh <= 0 || bottom <= vh + SHELL_EDGE_SLACK_PX) &&
    (vw <= 0 || right <= vw + SHELL_EDGE_SLACK_PX);

  const endReachable = !!(
    x.scrolledToEnd &&
    x.lastItemVisibleAfterScroll &&
    x.ctaVisibleAfterScroll
  );
  const ctaOk = !!(x.ctaVisible || x.ctaVisibleAfterScroll);
  const lastOk = !!(x.lastItemVisible || x.lastItemVisibleAfterScroll);
  const complete = !!(ctaOk && lastOk && (x.scrolledToEnd || !x.canScroll));

  if (complete && fullyInView) {
    return { ok: true, reason: 'in-viewport', detail: '' };
  }
  if (complete || endReachable) {
    return { ok: true, reason: 'scroll-end', detail: '' };
  }
  if (!ctaOk) {
    return { ok: false, reason: 'shell-cta-missing', detail: 'eylem çubuğu görünür değil' };
  }
  if (x.canScroll && !endReachable) {
    return {
      ok: false,
      reason: 'shell-scroll-end',
      detail: 'kaydırılabilir içerik sonuna erişilemedi (son öğe + eylem çubuğu)',
    };
  }
  return {
    ok: false,
    reason: 'shell-clipped',
    detail: `kabuk=${Math.round(h)}px vh=${Math.round(vh)} top=${Math.round(top)} bottom=${Math.round(bottom)}`,
  };
}

/**
 * Tarayıcıda çalışır (page.evaluate). Kaydırır, ölçer, eski konumları geri alır.
 * @returns {ShellCompletenessMetrics}
 */
export function collectShellCompletenessMetrics() {
  const root = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show');
  const vv = window.visualViewport;
  const vw = vv ? vv.width : window.innerWidth;
  const vh = vv ? vv.height : window.innerHeight;
  const empty = {
    hasShell: false,
    shellW: 0,
    shellH: 0,
    shellTop: 0,
    shellLeft: 0,
    shellRight: 0,
    shellBottom: 0,
    vw,
    vh,
    headerVisible: false,
    ctaVisible: false,
    lastItemVisible: false,
    canScroll: false,
    scrolledToEnd: false,
    lastItemVisibleAfterScroll: false,
    ctaVisibleAfterScroll: false,
  };
  if (!root) return empty;

  const content = root.querySelector('.wdp-modal-content') || root;
  const box = content.getBoundingClientRect();
  const hasBox = (el) => {
    if (!el) return false;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return st.display !== 'none' && st.visibility !== 'hidden' && r.width >= 1 && r.height >= 1;
  };
  // 100dvh panel visualViewport’tan taşabilir; ölçüt kabuk kutusu (çekilen öğe), pencere değil.
  const inShell = (el) => {
    if (!hasBox(el)) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > box.top + 1 && r.top < box.bottom - 1 && r.right > box.left + 1 && r.left < box.right - 1;
  };
  const hiddenType = (el) => el.matches('input[type="hidden"], [hidden], [aria-hidden="true"]');
  const cta = root.querySelector(
    '.wdp-form-cta-zone, .wdp-side-panel-footer-zone, button[name="donation_go_checkout"], button[name="donation_add_to_cart"]'
  );
  const header = root.querySelector(
    '.wdp-modal-header, .wdp-form-title-wrapper, .wdp-modal-title, .wdp-form-title, button.wdp-modal-close'
  );
  const inCta = (el) =>
    !!(cta && (cta.contains(el) || el.closest('.wdp-form-cta-zone, .wdp-side-panel-footer-zone')));
  const scrollers = Array.from(
    root.querySelectorAll('.wdp-side-panel-main, .wdp-donation-form-fields, .wdp-shareholders-scroll')
  );
  const scrollRoot = scrollers[0] || content;

  const findLast = () => {
    const skip = /wdp-form-cta-zone|wdp-side-panel-footer-zone|wdp-form-error/;
    const nodes = Array.from(
      scrollRoot.querySelectorAll(
        'input:not([type="hidden"]), textarea, select, button, .wdp-sadaka-donation, .wdp-cover-fee, .wdp-shareholder-form, .wdp-shareholders-area'
      )
    ).filter((el) => !hiddenType(el) && hasBox(el) && !inCta(el));
    Array.from(scrollRoot.children)
      .filter((el) => !skip.test(el.className || '') && !inCta(el) && !hiddenType(el) && hasBox(el))
      .forEach((el) => nodes.push(el));
    let last = null;
    let lastBottom = -Infinity;
    nodes.forEach((el) => {
      const b = el.getBoundingClientRect().bottom;
      if (b > lastBottom) {
        lastBottom = b;
        last = el;
      }
    });
    return last;
  };

  const prev = scrollers.map((el) => el.scrollTop);
  const canScroll = scrollers.some((el) => el.scrollHeight > el.clientHeight + 2);
  const lastBefore = findLast();
  const headerVisible = inShell(header);
  const ctaVisible = inShell(cta);
  const lastItemVisible = !!(lastBefore && inShell(lastBefore));

  scrollers.forEach((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const lastAfter = findLast();
  const scrolledToEnd =
    !canScroll ||
    scrollers.every((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
  const lastItemVisibleAfterScroll = !!(lastAfter && inShell(lastAfter));
  const ctaVisibleAfterScroll = inShell(cta);
  scrollers.forEach((el, i) => {
    el.scrollTop = prev[i];
  });

  return {
    hasShell: true,
    shellW: box.width,
    shellH: box.height,
    shellTop: box.top,
    shellLeft: box.left,
    shellRight: box.right,
    shellBottom: box.bottom,
    vw,
    vh,
    headerVisible,
    ctaVisible,
    lastItemVisible,
    canScroll,
    scrolledToEnd,
    lastItemVisibleAfterScroll,
    ctaVisibleAfterScroll,
  };
}

/**
 * @param {string} screenName
 * @param {{ ok: boolean, reason: string, detail: string }} result
 * @returns {{ check: string, description: string, detail: string, screenshot: string }}
 */
export function screenCompletenessFailure(screenName, result) {
  const kind = screenKindFromName(screenName);
  const shell = kind === 'shell';
  return {
    check: `${screenName}-page-height`,
    description: shell
      ? 'Kabuk kesilmiş veya eksik (kök görünür değil / son öğe+eylem çubuğuna erişilemedi)'
      : 'Sayfa yarım kaldı (readyState/son içerik bölgesi/ekran yüksekliği)',
    detail: `${result.reason || ''} ${result.detail || ''}`.trim(),
    screenshot: `${screenName}.png`,
  };
}
