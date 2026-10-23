/**
 * Ekran bütünlüğü: kabuk (popup/panel) ≠ tam sayfa.
 * Kabuk viewport çekilir; “yarım sayfa” yalnız tam sayfa ekranında.
 */

export const PAGE_HEIGHT_RATIO = 0.9;
export const SHELL_EDGE_SLACK_PX = 2;
export const SHELL_MIN_PX = 8;

/**
 * @param {string} screenName
 * @returns {'shell'|'page'}
 */
export function screenKindFromName(screenName) {
  return /-(popup|panel)-/i.test(String(screenName || '')) ? 'shell' : 'page';
}

/**
 * Tam sayfa: çekilen yükseklik referansın %90’ının altındaysa yarım kalmış.
 * Referans yoksa kontrol yok (ilk ölçüm).
 * @param {number} actualH
 * @param {number} referenceH
 * @returns {{ ok: boolean, reason: string, detail: string }}
 */
export function classifyPageHeight(actualH, referenceH) {
  const actual = Number(actualH) || 0;
  const reference = Number(referenceH) || 0;
  if (!reference || reference <= 0 || !actual) {
    return { ok: true, reason: '', detail: '' };
  }
  if (actual < reference * PAGE_HEIGHT_RATIO) {
    return {
      ok: false,
      reason: 'half-page',
      detail: `sayfa=${actual}px referans=${reference}px eşik=<%${Math.round((1 - PAGE_HEIGHT_RATIO) * 100)}`,
    };
  }
  return { ok: true, reason: '', detail: '' };
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
      : 'Sayfa belirgin kısa (sayfa yarım kalmış olabilir)',
    detail: `${result.reason || ''} ${result.detail || ''}`.trim(),
    screenshot: `${screenName}.png`,
  };
}
