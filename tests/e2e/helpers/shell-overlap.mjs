/**
 * Açık popup/panel: hesaplanan opaklık + elementFromPoint (tema başlığı üstüne binebilir mi).
 * Salt okur; uzak quick’te de çalışır. Sabit bekleme yok.
 */
export const POPUP_OVERLAP_CODE = 'POPUP-OVERLAP';
export const MIN_SHELL_OPACITY = 0.99;
export const PANEL_CTA_BOTTOM_CODE = 'PANEL-CTA-BOTTOM';
/** Yan panelde alt eylem çubuğu ile panel içeriği alt kenarı arasında izin verilen en çok boşluk (px). */
export const MAX_PANEL_CTA_BOTTOM_GAP = 48;

const OPEN_SHELL_SEL = '.hdf-donation-modal-wrapper.wdp-modal.show';

/**
 * Tarayıcıda örnekle (page.evaluate’e doğrudan verilir; kapanış yok).
 * @returns {object}
 */
export function collectShellOverlapSample() {
  const infiniteAnim = (a) => {
    if (!a || !a.effect || typeof a.effect.getComputedTiming !== 'function') return false;
    try {
      const t = a.effect.getComputedTiming();
      return !!(t && t.iterations === Infinity);
    } catch (eInf) {
      return false;
    }
  };
  const shell = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show');
  if (!shell) {
    return { found: false, opacities: [], contentOpacity: 0, hits: [], animRunning: 0, parentIsBody: false };
  }
  const content = shell.querySelector('.wdp-modal-content') || shell;
  /** @type {Array<{ tag: string, className: string, opacity: number }>} */
  const opacities = [];
  let node = /** @type {HTMLElement | null} */ (shell);
  while (node && node !== document.documentElement) {
    const st = window.getComputedStyle(node);
    opacities.push({
      tag: node.tagName,
      className: String(node.className || '').slice(0, 96),
      opacity: Number.parseFloat(st.opacity || '1'),
    });
    node = node.parentElement;
  }
  const contentOpacity = Number.parseFloat(window.getComputedStyle(content).opacity || '1');

  let animRunning = 0;
  const countAnims = (el) => {
    if (!el || typeof el.getAnimations !== 'function') return;
    try {
      const list = el.getAnimations({ subtree: false });
      for (const a of list) {
        if (a && a.playState === 'running' && !infiniteAnim(a)) animRunning += 1;
      }
    } catch (eCount) {
      animRunning += 0;
    }
  };
  countAnims(shell);
  countAnims(content);

  const cr = content.getBoundingClientRect();
  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;
  /** @type {Array<{ name: string, x: number, y: number, inShell: boolean, topTag: string, topClass: string }>} */
  const hits = [];
  const fields = shell.querySelectorAll(
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
  );
  for (const field of fields) {
    const st = window.getComputedStyle(field);
    const r = field.getBoundingClientRect();
    if (st.display === 'none' || st.visibility === 'hidden' || r.width < 4 || r.height < 4) continue;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > vw || y > vh) continue;
    if (x < cr.left || x > cr.right || y < cr.top || y > cr.bottom) continue;
    const top = document.elementFromPoint(x, y);
    const inShell = !!(top && (shell === top || shell.contains(top)));
    hits.push({
      name: (field.getAttribute && field.getAttribute('name')) || field.tagName,
      x: Math.round(x),
      y: Math.round(y),
      inShell,
      topTag: top ? top.tagName : '',
      topClass: top ? String(top.className || '').slice(0, 96) : '',
    });
    if (hits.length >= 8) break;
  }
  if (!hits.length && cr.width > 8 && cr.height > 8) {
    const x = Math.min(vw - 1, Math.max(1, cr.left + cr.width / 2));
    const y = Math.min(vh - 1, Math.max(1, cr.top + Math.min(cr.height / 2, vh / 2)));
    const top = document.elementFromPoint(x, y);
    const inShell = !!(top && (shell === top || shell.contains(top)));
    hits.push({
      name: '(content-center)',
      x: Math.round(x),
      y: Math.round(y),
      inShell,
      topTag: top ? top.tagName : '',
      topClass: top ? String(top.className || '').slice(0, 96) : '',
    });
  }

  /* Yan panel: alt eylem çubuğu (kısa içerikte de) panelin dibine sabit. */
  let panelCta = null;
  if (shell.classList.contains('wdp-side-panel')) {
    const footer = shell.querySelector('.wdp-side-panel-footer-zone');
    if (footer) {
      const fr = footer.getBoundingClientRect();
      if (fr.height > 0) {
        panelCta = {
          gapToPanelBottom: Math.round(cr.bottom - fr.bottom),
          gapToViewportBottom: Math.round(vh - fr.bottom),
        };
      }
    }
  }

  return {
    found: true,
    panelCta,
    opacities,
    contentOpacity,
    hits,
    animRunning,
    parentIsBody: shell.parentNode === document.body,
  };
}

/**
 * Kabuk + içerik + atalar opak ve animasyon bitmiş mi (evaluate).
 * @param {number} minOp
 * @returns {boolean}
 */
export function shellOpaqueNow(minOp) {
  const floor = typeof minOp === 'number' ? minOp : 0.99;
  const infiniteAnim = (a) => {
    if (!a || !a.effect || typeof a.effect.getComputedTiming !== 'function') return false;
    try {
      const t = a.effect.getComputedTiming();
      return !!(t && t.iterations === Infinity);
    } catch (eInf) {
      return false;
    }
  };
  const shell = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show');
  if (!shell) return false;
  if (shell.classList.contains('wdp-side-panel--opening')) return false;
  const content = shell.querySelector('.wdp-modal-content') || shell;
  const nodes = [shell, content];
  for (const el of nodes) {
    const st = window.getComputedStyle(el);
    if (Number.parseFloat(st.opacity || '1') < floor) return false;
    if (typeof el.getAnimations === 'function') {
      try {
        const anims = el.getAnimations({ subtree: false });
        if (anims.some((a) => a && a.playState === 'running' && !infiniteAnim(a))) return false;
      } catch (eAnim) {
        return false;
      }
    }
  }
  let p = /** @type {HTMLElement | null} */ (shell);
  while (p && p !== document.documentElement) {
    if (Number.parseFloat(window.getComputedStyle(p).opacity || '1') < floor) return false;
    p = p.parentElement;
  }
  return true;
}

/**
 * @param {ReturnType<typeof collectShellOverlapSample>} sample
 * @param {number} [minOpacity]
 */
export function classifyShellOverlap(sample, minOpacity = MIN_SHELL_OPACITY) {
  if (!sample || !sample.found) {
    return {
      ok: false,
      code: POPUP_OVERLAP_CODE,
      reasons: ['kabuk yok'],
      minOpacity: 0,
      hits: 0,
      outside: 0,
    };
  }
  const reasons = [];
  const ops = (sample.opacities || []).map((o) => Number(o.opacity));
  const contentOp = Number(sample.contentOpacity);
  const all = ops.concat(Number.isFinite(contentOp) ? [contentOp] : []);
  const minOp = all.length ? Math.min(...all) : 0;
  const product = all.length ? all.reduce((a, b) => a * b, 1) : 0;
  if (!(minOp >= minOpacity) || !(product >= minOpacity)) {
    reasons.push(`opaklık min=${minOp} çarpım=${product} < ${minOpacity}`);
  }
  const hits = Array.isArray(sample.hits) ? sample.hits : [];
  const outside = hits.filter((h) => !h.inShell);
  if (!hits.length) {
    reasons.push('form alanı merkezi yok');
  }
  if (outside.length) {
    reasons.push(
      outside
        .slice(0, 3)
        .map((h) => `${h.name}@${h.x},${h.y}→${h.topTag}.${String(h.topClass || '').slice(0, 48)}`)
        .join(' | ')
    );
  }
  let ctaCode = '';
  if (sample.panelCta && sample.panelCta.gapToPanelBottom > MAX_PANEL_CTA_BOTTOM_GAP) {
    ctaCode = PANEL_CTA_BOTTOM_CODE;
    reasons.push(
      `${PANEL_CTA_BOTTOM_CODE}: yan panel alt eylem çubuğu dibe sabit değil (boşluk ${sample.panelCta.gapToPanelBottom}px > ${MAX_PANEL_CTA_BOTTOM_GAP}px)`
    );
  }
  return {
    ok: reasons.length === 0,
    code: reasons.length ? ctaCode || POPUP_OVERLAP_CODE : '',
    reasons,
    minOpacity: minOp,
    hits: hits.length,
    outside: outside.length,
  };
}

/**
 * getAnimations bitişi / opacity≥0.99. Sabit uyku yok.
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
export async function waitShellAnimationsDone(page, timeout = 8000) {
  await page.waitForFunction(shellOpaqueNow, MIN_SHELL_OPACITY, { timeout });
  await page.evaluate(async () => {
    const infiniteAnim = (a) => {
      if (!a || !a.effect || typeof a.effect.getComputedTiming !== 'function') return false;
      try {
        const t = a.effect.getComputedTiming();
        return !!(t && t.iterations === Infinity);
      } catch (eInf) {
        return false;
      }
    };
    const shell = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show');
    if (!shell) return;
    const content = shell.querySelector('.wdp-modal-content') || shell;
    const pending = [];
    for (const el of [shell, content]) {
      if (!el || typeof el.getAnimations !== 'function') continue;
      let anims = [];
      try {
        anims = el.getAnimations({ subtree: false }) || [];
      } catch (eList) {
        continue;
      }
      for (const a of anims) {
        if (!a || a.playState === 'finished' || a.playState === 'idle') continue;
        if (infiniteAnim(a)) continue;
        if (a.finished && typeof a.finished.then === 'function') pending.push(a.finished);
      }
    }
    if (!pending.length) return;
    await Promise.allSettled(pending);
  });
  await page.waitForFunction(shellOpaqueNow, MIN_SHELL_OPACITY, { timeout });
}

/**
 * Popup/panel açık değilse atla; açıksa bekle + iddia.
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
export async function waitAndAssertShellOverlap(page, timeout = 8000) {
  const n = await page.locator(OPEN_SHELL_SEL).count();
  if (!n) return { skipped: true };
  await waitShellAnimationsDone(page, timeout);
  return assertPopupNoOverlap(page);
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function assertPopupNoOverlap(page) {
  const n = await page.locator(OPEN_SHELL_SEL).count();
  if (!n) return { skipped: true };
  const sample = await page.evaluate(collectShellOverlapSample);
  const cls = classifyShellOverlap(sample);
  if (!cls.ok) {
    throw new Error(`${POPUP_OVERLAP_CODE}: ${cls.reasons.join('; ')}`);
  }
  return { skipped: false, ...cls, sample };
}

/**
 * Beklemeden ve bekledikten sonra örnek (A kanıtı).
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
export async function probeShellOverlapBeforeAfter(page, timeout = 8000) {
  const n = await page.locator(OPEN_SHELL_SEL).count();
  if (!n) return { skipped: true };
  const immediate = await page.evaluate(collectShellOverlapSample);
  await waitShellAnimationsDone(page, timeout);
  const afterWait = await page.evaluate(collectShellOverlapSample);
  const immediateClass = classifyShellOverlap(immediate);
  const afterClass = classifyShellOverlap(afterWait);
  if (!afterClass.ok) {
    throw new Error(`${POPUP_OVERLAP_CODE}: ${afterClass.reasons.join('; ')}`);
  }
  return {
    skipped: false,
    immediate,
    afterWait,
    immediateClass,
    afterClass,
  };
}

/**
 * Tarayıcıda: yan panel gövdesini geçici kısaltır (ilk çocuk dışındakileri gizler),
 * alt eylem çubuğunun panel dibine olan uzaklığını ölçer, sonra geri alır.
 * Kısa içerikli sitelerde (az alan) de çubuk dibe sabit kalmalı.
 */
export function measurePanelCtaWhenShort() {
  const shell = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.wdp-side-panel.show');
  if (!shell) return { skipped: 'panel yok' };
  const main = shell.querySelector('.wdp-side-panel-main:not(.wdp-side-panel-main--shares)');
  const footer = shell.querySelector('.wdp-side-panel-footer-zone');
  const content = shell.querySelector('.wdp-modal-content') || shell;
  if (!main || !footer) return { skipped: 'gövde/alt çubuk yok' };
  const kids = Array.from(main.children);
  const saved = kids.map((k) => k.style.display);
  try {
    kids.forEach((k, i) => {
      if (i > 0) k.style.setProperty('display', 'none', 'important');
    });
    void footer.offsetHeight;
    const cr = content.getBoundingClientRect();
    const fr = footer.getBoundingClientRect();
    const mr = main.getBoundingClientRect();
    return {
      skipped: '',
      gapToPanelBottom: Math.round(cr.bottom - fr.bottom),
      mainHeight: Math.round(mr.height),
      footerHeight: Math.round(fr.height),
    };
  } finally {
    kids.forEach((k, i) => {
      if (saved[i]) k.style.display = saved[i];
      else k.style.removeProperty('display');
    });
  }
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function assertPanelCtaPinnedWhenShort(page) {
  const r = await page.evaluate(measurePanelCtaWhenShort);
  if (r.skipped) return { skipped: true, reason: r.skipped };
  if (r.gapToPanelBottom > MAX_PANEL_CTA_BOTTOM_GAP) {
    throw new Error(
      `${PANEL_CTA_BOTTOM_CODE}: kısa içerikli yan panelde alt eylem çubuğu dibe sabit değil (boşluk ${r.gapToPanelBottom}px > ${MAX_PANEL_CTA_BOTTOM_GAP}px; gövde ${r.mainHeight}px)`
    );
  }
  return { skipped: false, ...r };
}
