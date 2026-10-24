/**
 * checkout-flow / panel açılış teşhisi.
 * Yalnız yol / id / sınıf / sayı. Sorgu (ver hariç), gövde, çerez değeri, kişisel veri yok.
 */
import path from 'node:path';
import { ROOT } from './env.mjs';
import { debugDirFor } from './e2e-paths.mjs';
import { writeDebugJson } from './scenario-debug.mjs';
import { extractAjaxActionFromRequest } from './network-guard.mjs';

function pathnameOnly(url, base) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const origin = String(base || '').trim() || 'https://e2e.invalid';
    return new URL(raw, origin).pathname || '';
  } catch {
    const noQuery = raw.split('#')[0].split('?')[0];
    return noQuery.startsWith('/') ? noQuery : '';
  }
}

const TEXT_CAP = 180;
const NET_CAP = 40;

/**
 * pathname + isteğe bağlı ?ver= (başka sorgu yok).
 * @param {string} url
 * @param {string} [base]
 */
export function urlPathnameAndVer(url, base) {
  const raw = String(url || '').trim();
  if (!raw) return { pathname: '', ver: '' };
  try {
    const origin = String(base || '').trim() || 'https://e2e.invalid';
    const u = new URL(raw, origin);
    return { pathname: u.pathname || '', ver: u.searchParams.get('ver') || '' };
  } catch {
    const noHash = raw.split('#')[0];
    const [pathPart, qs = ''] = noHash.split('?');
    const pathname = pathPart.startsWith('/') ? pathPart : '';
    const ver = (qs.match(/(?:^|&)ver=([^&]*)/) || [])[1] || '';
    return { pathname, ver: decodeURIComponent(ver) };
  }
}

/**
 * Konsol satırı: metin kısaltılmış, URL sorgu/hash yok.
 * @param {string} text
 */
export function sanitizeConsoleLine(text) {
  let s = String(text || '');
  s = s.replace(/https?:\/\/[^\s)'"]+/gi, (m) => pathnameOnly(m) || m.split('?')[0].split('#')[0]);
  return s.slice(0, TEXT_CAP);
}

/**
 * Ağ özeti: yöntem + pathname + wc-ajax / action adı.
 * @param {{ method?: string, url?: string, action?: string }} raw
 */
export function summarizeNetworkHit(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const { pathname } = urlPathnameAndVer(r.url || r.pathname || '');
  let wc_ajax = String(r.wc_ajax || '');
  if (!wc_ajax && r.url) {
    try {
      const u = new URL(String(r.url), 'https://e2e.invalid');
      wc_ajax = u.searchParams.get('wc-ajax') || '';
      if (!wc_ajax) {
        const m = (u.pathname || '').match(/\/wc-ajax\/([^/]+)/i);
        wc_ajax = m ? m[1] : '';
      }
    } catch {
      wc_ajax = '';
    }
  }
  return {
    method: String(r.method || '').toUpperCase().slice(0, 8),
    pathname,
    wc_ajax: wc_ajax.slice(0, 80),
    action: String(r.action || '').slice(0, 80),
    status: Number(r.status) || 0,
  };
}

/**
 * @param {object} raw
 */
export function sanitizeCtaReady(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    form_ready: r.form_ready === true,
    await_js: r.await_js == null ? null : String(r.await_js),
    disabled: r.disabled == null ? null : !!r.disabled,
    has_gate: r.has_gate === true,
    queued: r.queued === true,
  };
}

/**
 * @param {object} raw
 */
export function sanitizeClickTarget(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const overlay = r.overlay && typeof r.overlay === 'object' ? r.overlay : null;
  return {
    tag: String(r.tag || '').slice(0, 20),
    role: String(r.role || '').slice(0, 40),
    name: String(r.name || '').slice(0, 80),
    visible: r.visible === true,
    disabled: r.disabled === true,
    loading: r.loading === true,
    is_go_checkout: r.is_go_checkout === true,
    overlay: overlay
      ? {
          tag: String(overlay.tag || '').slice(0, 20),
          id: String(overlay.id || '').slice(0, 40),
          className: String(overlay.className || '').slice(0, 120),
          is_self: overlay.is_self === true,
        }
      : null,
  };
}

/**
 * @param {object} raw
 */
export function sanitizePluginRuntime(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const scripts = Array.isArray(r.scripts)
    ? r.scripts.slice(0, 20).map((s) => ({
        id: String((s && s.id) || '').slice(0, 80),
        pathname: urlPathnameAndVer((s && (s.src || s.pathname)) || '').pathname || String((s && s.pathname) || ''),
        ver: String((s && s.ver) || urlPathnameAndVer((s && s.src) || '').ver || '').slice(0, 40),
        defer: !!(s && s.defer),
        async: !!(s && s.async),
      }))
    : [];
  return {
    scripts,
    cta_ready_script: r.cta_ready_script === true,
    main_bundle: r.main_bundle === true,
    possibly_combined: r.possibly_combined === true,
    has_wdp_app: r.has_wdp_app === true,
    has_submit_handler: r.has_submit_handler === true,
    cta_data: r.cta_data && typeof r.cta_data === 'object' ? sanitizeCtaReady(r.cta_data) : null,
  };
}

/**
 * @param {object} raw
 */
export function sanitizeShellDom(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    open_count: Number.isFinite(Number(r.open_count)) ? Number(r.open_count) : 0,
    side_panel: r.side_panel === true,
    centered: r.centered === true,
    className: String(r.className || '').slice(0, 160),
  };
}

/**
 * CTA hazırlık (kişisel veri yok).
 * @param {import('@playwright/test').Locator} shell
 */
export async function collectCtaReadyState(shell) {
  return shell.evaluate(() => {
    const form =
      document.querySelector('.wdp-modal.show form') ||
      document.querySelector('.wdp-donation-form form') ||
      document.querySelector('form.wdp-donation-form');
    const go = form
      ? form.querySelector('button[name="donation_go_checkout"]')
      : document.querySelector('button[name="donation_go_checkout"]');
    const gate = form
      ? form.querySelector('.wdp-cta-gate__hit')
      : document.querySelector('.wdp-cta-gate__hit');
    return {
      form_ready: !!(form && (form._wdpSubmitHandler || (form.dataset && form.dataset.wdpFormReady === '1'))),
      await_js: go ? go.getAttribute('data-wdp-await-js') : null,
      disabled: go ? !!go.disabled : null,
      has_gate: !!gate,
      queued: !!(form && form._wdpQueuedSubmitter),
    };
  });
}

/**
 * Eklenti betikleri + WDPApp / handler / CTA data-*.
 * @param {import('@playwright/test').Page} page
 */
export async function collectPluginRuntime(page) {
  const raw = await page.evaluate(() => {
    const scripts = [];
    document.querySelectorAll('script[src], script[id]').forEach((el) => {
      const id = el.id || '';
      const src = el.getAttribute('src') || '';
      if (!/wdp|woo-donation-popup|fusion-scripts|avada|combined/i.test(`${id} ${src}`)) return;
      let pathname = '';
      let ver = '';
      if (src) {
        try {
          const u = new URL(src, location.href);
          pathname = u.pathname || '';
          ver = u.searchParams.get('ver') || '';
        } catch {
          pathname = src.split('?')[0];
        }
      }
      scripts.push({
        id,
        pathname,
        ver,
        defer: !!el.defer,
        async: !!el.async,
      });
    });
    const form =
      document.querySelector('.wdp-modal.show form') ||
      document.querySelector('form.wdp-donation-form');
    const go = form && form.querySelector('button[name="donation_go_checkout"]');
    const hasCtaTag = scripts.some(
      (s) => s.id === 'wdp-form-cta-ready-js' || /cta-ready/i.test(s.pathname + s.id)
    );
    const hasMain = scripts.some(
      (s) =>
        s.id === 'wdp-donation-modal-js' ||
        /woo-donation-popup\/assets\/js\//i.test(s.pathname) ||
        /wdp-donation-modal/i.test(s.id + s.pathname)
    );
    const hasWdpApp = !!window.WDPApp;
    return {
      scripts,
      cta_ready_script: hasCtaTag,
      main_bundle: hasMain,
      possibly_combined: !hasCtaTag && !hasMain && hasWdpApp,
      has_wdp_app: hasWdpApp,
      has_submit_handler: !!(form && form._wdpSubmitHandler),
      cta_data: go
        ? {
            form_ready: !!(form && (form._wdpSubmitHandler || form.dataset.wdpFormReady === '1')),
            await_js: go.getAttribute('data-wdp-await-js'),
            disabled: !!go.disabled,
            has_gate: !!form.querySelector('.wdp-cta-gate__hit'),
            queued: !!form._wdpQueuedSubmitter,
          }
        : null,
    };
  });
  return sanitizePluginRuntime(raw);
}

/**
 * Tıklanan öğe: rol/ad, görünür, örten (elementFromPoint), disabled/yükleniyor.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} locator
 */
export async function collectClickTarget(page, locator) {
  const box = await locator.boundingBox().catch(() => null);
  const n = await locator.count().catch(() => 0);
  if (!n) {
    return sanitizeClickTarget({
      tag: '',
      role: '',
      name: '',
      visible: false,
      disabled: false,
      loading: false,
      is_go_checkout: false,
      overlay: null,
    });
  }
  const raw = await locator.first().evaluate((el, point) => {
    let overlay = null;
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      const top = document.elementFromPoint(point.x, point.y);
      if (top) {
        overlay = {
          tag: top.tagName,
          id: top.id || '',
          className: String(top.className || '').slice(0, 120),
          is_self: !!(top === el || (el.contains && el.contains(top))),
        };
      }
    }
    const st = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const visible =
      st.display !== 'none' &&
      st.visibility !== 'hidden' &&
      Number(st.opacity) > 0 &&
      rect.width + rect.height > 0;
    return {
      tag: el.tagName,
      role: el.getAttribute('role') || (el.tagName === 'BUTTON' ? 'button' : ''),
      name: (el.getAttribute('name') || el.getAttribute('aria-label') || el.textContent || '')
        .trim()
        .slice(0, 80),
      visible,
      disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
      loading: el.classList.contains('wdp-loading') || el.getAttribute('data-wdp-await-js') === '1',
      is_go_checkout: el.getAttribute('name') === 'donation_go_checkout',
      overlay,
    };
  }, box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null);
  return sanitizeClickTarget(raw);
}

/**
 * Tetikleyici + kabuk DOM.
 * @param {import('@playwright/test').Page} page
 */
export async function collectShellDomState(page) {
  const raw = await page.evaluate(() => {
    const open = document.querySelectorAll('.hdf-donation-modal-wrapper.wdp-modal.show');
    const first = open[0];
    return {
      open_count: open.length,
      side_panel: !!(first && first.classList.contains('wdp-side-panel')),
      centered: !!(first && !first.classList.contains('wdp-side-panel')),
      className: first ? String(first.className || '') : '',
    };
  });
  return sanitizeShellDom(raw);
}

/**
 * Tıklama sonrası ağ (yöntem + pathname + wc-ajax/action). Gövde yok.
 * @param {import('@playwright/test').Page} page
 */
export function attachPostClickNetwork(page) {
  /** @type {ReturnType<typeof summarizeNetworkHit>[]} */
  const hits = [];
  const onResponse = (res) => {
    const req = res.request();
    const type = typeof req.resourceType === 'function' ? req.resourceType() : '';
    if (type === 'image' || type === 'font' || type === 'stylesheet' || type === 'media') return;
    hits.push(
      summarizeNetworkHit({
        method: req.method(),
        url: res.url(),
        action: extractAjaxActionFromRequest(req),
        status: res.status(),
      })
    );
    if (hits.length > NET_CAP) hits.shift();
  };
  page.on('response', onResponse);
  return {
    hits,
    dispose() {
      page.off('response', onResponse);
    },
    /**
     * @param {number} [ms]
     */
    async wait(ms = 5000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return hits.slice();
    },
  };
}

/**
 * Konsol hataları (kısaltılmış, sorgu yok).
 * @param {import('@playwright/test').Page} page
 */
export function attachSanitizedConsole(page) {
  /** @type {string[]} */
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() !== 'error') return;
    errors.push(sanitizeConsoleLine(msg.text()));
    if (errors.length > 20) errors.shift();
  };
  const onPageError = (err) => {
    errors.push(sanitizeConsoleLine(String(err && err.message ? err.message : err)));
    if (errors.length > 20) errors.shift();
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  return {
    errors,
    dispose() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    },
  };
}

/**
 * Kabuk PNG (kişisel veri yok — yalnız dosya yolu JSON’da).
 * @param {import('@playwright/test').Page} page
 * @param {string} stem
 */
export async function shotDebugPng(page, stem) {
  const file = path.join(debugDirFor(), `${String(stem || 'shot').replace(/[^\w.-]+/g, '_')}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch((e) => {
    console.error(`[e2e:catch-fail] debug-png ${stem}: ${e && e.message ? e.message : e}`);
  });
  return path.relative(ROOT, file);
}

/**
 * checkout-flow genişletilmiş alanlar (güvenli).
 * @param {object} raw
 */
export function buildCheckoutFlowDiagExtras(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    cta_ready: r.cta_ready ? sanitizeCtaReady(r.cta_ready) : null,
    plugin: sanitizePluginRuntime(r.plugin || r.scripts || {}),
    click_target: r.click_target ? sanitizeClickTarget(r.click_target) : null,
    network_after_click: Array.isArray(r.network_after_click)
      ? r.network_after_click.slice(0, NET_CAP).map(summarizeNetworkHit)
      : [],
    console_errors: Array.isArray(r.console_errors)
      ? r.console_errors.map(sanitizeConsoleLine).slice(0, 15)
      : [],
    png_before: r.png_before ? path.basename(String(r.png_before)) : '',
    png_after: r.png_after ? path.basename(String(r.png_after)) : '',
  };
}

/**
 * @param {string} deviceId
 * @param {string} key shares|campaign|fixed|custom
 * @param {object} raw
 */
export function writePanelOpenDebug(deviceId, key, raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const payload = {
    device: String(deviceId || ''),
    key: String(key || ''),
    class: String(r.class || 'panel-acilamadi'),
    trigger: r.trigger && typeof r.trigger === 'object'
      ? {
          tag: String(r.trigger.tag || '').slice(0, 20),
          className: String(r.trigger.className || '').slice(0, 120),
          visible: r.trigger.visible === true,
          count: Number(r.trigger.count) || 0,
        }
      : null,
    click_target: r.click_target ? sanitizeClickTarget(r.click_target) : null,
    plugin: sanitizePluginRuntime(r.plugin || {}),
    shell: sanitizeShellDom(r.shell || {}),
    console_errors: Array.isArray(r.console_errors)
      ? r.console_errors.map(sanitizeConsoleLine).slice(0, 15)
      : [],
    png: r.png ? path.basename(String(r.png)) : '',
    detail: String(r.detail || '').slice(0, 220),
  };
  const file = path.join(
    debugDirFor(),
    `panel-${String(key || 'key')}-open-${String(deviceId || 'device')}.json`
  );
  writeDebugJson(file, payload);
  return path.relative(ROOT, file);
}
