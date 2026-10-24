/**
 * Kabuk/form açıkken ürün sayfası belge yeniden yüklemesi = yerel form / location.reload.
 * Salt okur; matris + capture + uzak quick.
 */

export const NATIVE_SUBMIT_RELOAD_CODE = 'NATIVE-SUBMIT-RELOAD';

const PRODUCT_PATH_RE = /\/(product|urun|produkt|produit)\//i;

/**
 * @param {string} raw
 * @returns {string}
 */
export function pageNavKey(raw) {
  try {
    const u = new URL(String(raw || ''), 'http://wdp.local');
    const token = u.searchParams.get('wdp_e2e') || '';
    const path = u.pathname.replace(/\/$/, '') || '/';
    return `${path}|${token}`;
  } catch {
    return '';
  }
}

/**
 * @param {string} pathname
 */
export function isProductDocumentPath(pathname) {
  const p = String(pathname || '');
  return PRODUCT_PATH_RE.test(p) || /wdp-e2e-custom/i.test(p);
}

/**
 * @param {{
 *   armed?: boolean,
 *   resourceType?: string,
 *   requestKey?: string,
 *   seenProductKeys?: string[],
 *   isProduct?: boolean,
 * }} evt
 */
export function classifyNativeSubmitReload(evt) {
  const armed = !!(evt && evt.armed);
  const type = evt && evt.resourceType ? String(evt.resourceType) : '';
  if (!armed || type !== 'document') {
    return { hit: false, code: '' };
  }
  const key = evt && evt.requestKey ? String(evt.requestKey) : '';
  if (!key) {
    return { hit: false, code: '' };
  }
  const seen = Array.isArray(evt.seenProductKeys) ? evt.seenProductKeys : [];
  const product = evt && evt.isProduct === true;
  if (product && seen.includes(key)) {
    return { hit: true, code: NATIVE_SUBMIT_RELOAD_CODE };
  }
  return { hit: false, code: '' };
}

/**
 * @param {import('@playwright/test').Page} page
 */
export function attachNativeSubmitReloadGuard(page) {
  if (page._wdpNativeReloadGuard) {
    return page._wdpNativeReloadGuard;
  }
  /** @type {{ armed: boolean, seenProductKeys: string[], hits: object[], journal: object[] }} */
  const state = {
    armed: false,
    seenProductKeys: [],
    hits: [],
    journal: [],
  };

  const onReq = (req) => {
    let resourceType = '';
    try {
      resourceType = typeof req.resourceType === 'function' ? req.resourceType() : '';
    } catch {
      return;
    }
    if (resourceType !== 'document') {
      return;
    }
    const url = req.url();
    let pathname = '';
    try {
      pathname = new URL(url).pathname;
    } catch {
      return;
    }
    const key = pageNavKey(url);
    const isProduct = isProductDocumentPath(pathname);
    const row = {
      t: Date.now(),
      method: req.method(),
      url: String(url).replace(/https?:\/\/[^/]+/i, ''),
      key,
      armed: state.armed,
      isProduct,
    };
    state.journal.push(row);
    const cls = classifyNativeSubmitReload({
      armed: state.armed,
      resourceType,
      requestKey: key,
      seenProductKeys: state.seenProductKeys,
      isProduct,
    });
    if (cls.hit) {
      state.hits.push({ ...row, code: cls.code });
    }
  };

  const onNav = (frame) => {
    if (frame !== page.mainFrame()) {
      return;
    }
    const url = frame.url();
    let pathname = '';
    try {
      pathname = new URL(url).pathname;
    } catch {
      return;
    }
    if (!isProductDocumentPath(pathname)) {
      return;
    }
    const key = pageNavKey(url);
    if (key && !state.seenProductKeys.includes(key)) {
      state.seenProductKeys.push(key);
    }
  };

  page.on('request', onReq);
  page.on('framenavigated', onNav);

  const guard = {
    arm() {
      state.armed = true;
    },
    disarm() {
      state.armed = false;
    },
    clearHits() {
      state.hits.length = 0;
    },
    hits: state.hits,
    journal: state.journal,
    state,
    assertClear(label) {
      if (!state.hits.length) {
        return;
      }
      const sample = state.hits
        .slice(0, 3)
        .map((h) => `${h.method} ${h.url}`)
        .join('; ');
      throw new Error(`${NATIVE_SUBMIT_RELOAD_CODE}${label ? ` ${label}` : ''}: ${sample}`);
    },
    wrapError(label, err) {
      if (!state.hits.length) {
        return err;
      }
      const sample = state.hits
        .slice(0, 3)
        .map((h) => `${h.method} ${h.url}`)
        .join('; ');
      const extra = err && err.message ? ` | ${err.message}` : '';
      return new Error(`${NATIVE_SUBMIT_RELOAD_CODE}${label ? ` ${label}` : ''}: ${sample}${extra}`);
    },
    detach() {
      page.off('request', onReq);
      page.off('framenavigated', onNav);
      delete page._wdpNativeReloadGuard;
    },
  };
  page._wdpNativeReloadGuard = guard;
  return guard;
}
