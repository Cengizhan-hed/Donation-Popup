/**
 * RTL yerleşim kontrolleri. Kırmızı kod: RTL-LAYOUT.
 */
export const RTL_LAYOUT_CODE = 'RTL-LAYOUT';

const TEXT_ALIGN_OK = new Set(['start', 'end', 'right', 'left']);

/**
 * @param {string} locale
 */
export function isRtlLocale(locale) {
  const loc = String(locale || '');
  const base = loc.includes('_') ? loc.slice(0, loc.indexOf('_')) : loc;
  return ['ar', 'he', 'fa', 'ur'].includes(base);
}

/**
 * RTL sayfada kalıcı kontroller.
 * @param {import('@playwright/test').Page} page
 * @param {{ expectPanel?: boolean, scopeSel?: string }} [opts]
 */
export async function assertRtlLayout(page, opts = {}) {
  const expectPanel = !!opts.expectPanel;
  const scopeSel = opts.scopeSel || '';
  // Açılış animasyonu bitsin: kabuk kutusu 3 ardışık karede sabit kalana dek bekle.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const q = () => document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show .wdp-modal-content');
        let last = '';
        let same = 0;
        const t0 = performance.now();
        const tick = () => {
          const el = q();
          if (!el) return resolve();
          const r = el.getBoundingClientRect();
          const key = [r.left, r.top, r.right, r.bottom].map((n) => Math.round(n * 2)).join(',');
          same = key === last ? same + 1 : 0;
          last = key;
          if (same >= 6 || performance.now() - t0 > 4000) return resolve();
          requestAnimationFrame(tick);
        };
        tick();
      })
  );
  const sample = await page.evaluate((sel) => {
    const html = document.documentElement;
    const body = document.body;
    const dir = String(html.getAttribute('dir') || html.dir || '').toLowerCase();
    const computed = window.getComputedStyle(html).direction;
    const bodyDir = window.getComputedStyle(body).direction;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const overflowBy = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

    let offenders = [];
    if (overflow) {
      const cw = document.documentElement.clientWidth;
      let n = document.querySelector('.wp-list-table');
      while (n && n !== document.body) { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); offenders.push('ANC ' + n.tagName + '.' + String(n.className).slice(0,30) + ' w' + Math.round(r.width) + ' ' + cs.display + ' ox=' + cs.overflowX); n = n.parentElement; }
      offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('.wdp-products-table-form') || el.closest('#adminmenuwrap')) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > cw + 1 || r.left < -1)) offenders.push(el.tagName + '.' + String(el.className).slice(0, 30) + '#' + el.id + ' L' + Math.round(r.left) + ' R' + Math.round(r.right));
        if (offenders.length >= 8) break;
      }
    }
    const scopes = [];
    const add = (el) => {
      if (el && !scopes.includes(el)) scopes.push(el);
    };
    if (sel) {
      document.querySelectorAll(sel).forEach(add);
    }
    document.querySelectorAll(
      '.wdp-modal.show .wdp-modal-content, .wdp-donation-form .wdp-modal-content, .wdp-admin-wrap, .wdp-form-error, .wdp-progress-bar-container'
    ).forEach(add);

    const aligns = [];
    for (const root of scopes) {
      const nodes = root.querySelectorAll('label, h2, .wdp-modal-title, .wdp-form-title, .wdp-field-stack__input, p');
      for (const el of nodes) {
        const st = window.getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        aligns.push({
          align: st.textAlign,
          dir: st.direction,
        });
        if (aligns.length >= 12) break;
      }
      if (aligns.length >= 12) break;
    }

    const shell = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show .wdp-modal-content');
    let shellBox = null;
    let shellInside = true;
    if (shell) {
      const r = shell.getBoundingClientRect();
      shellBox = { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
      const vh = window.innerHeight || document.documentElement.clientHeight;
      shellInside = r.left >= -2 && r.right <= vw + 2 && r.top >= -2 && r.bottom <= vh + 8;
    }

    const panel = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.wdp-side-panel.show .wdp-modal-content');
    let panelLeft = null;
    let panelOnStart = null;
    if (panel) {
      const r = panel.getBoundingClientRect();
      panelLeft = r.left;
      panelOnStart = r.left <= 8;
    }

    return {
      dir,
      computed,
      bodyDir,
      overflow,
      overflowBy,
      offenders,
      aligns,
      shellBox,
      shellInside,
      panelLeft,
      panelOnStart,
      vw,
    };
  }, scopeSel);

  const reasons = [];
  if (sample.dir !== 'rtl' && sample.computed !== 'rtl' && sample.bodyDir !== 'rtl') {
    reasons.push(`html dir=${sample.dir || '—'} computed=${sample.computed}`);
  }
  if (sample.overflow) {
    reasons.push(`yatay taşma +${sample.overflowBy}px ${sample.offenders.join(' | ')}`);
  }
  if (sample.shellBox && !sample.shellInside) {
    reasons.push(`kabuk viewport dışı L=${Math.round(sample.shellBox.left)} R=${Math.round(sample.shellBox.right)} T=${Math.round(sample.shellBox.top)} B=${Math.round(sample.shellBox.bottom)} vw=${sample.vw}`);
  }
  if (expectPanel) {
    if (sample.panelLeft == null) {
      reasons.push('yan panel yok');
    } else if (!sample.panelOnStart) {
      reasons.push(`yan panel sol kenarda değil left=${Math.round(sample.panelLeft)}`);
    }
  }
  for (const a of sample.aligns) {
    if (!TEXT_ALIGN_OK.has(a.align)) continue;
    const rtlText = a.dir === 'rtl' || sample.computed === 'rtl' || sample.dir === 'rtl';
    if (!rtlText) continue;
    if (a.align === 'left') {
      reasons.push(`metin hizası left (RTL’de start/right beklenir)`);
      break;
    }
  }
  if (reasons.length) {
    throw new Error(`${RTL_LAYOUT_CODE}: ${reasons.join('; ')}`);
  }
  return sample;
}
