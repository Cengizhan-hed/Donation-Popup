/**
 * WooCommerce Store API sepet: nonce’lu okuma/yazma (oturum = aynı context).
 * DELETE /cart/items ve POST /cart/remove-item Nonce ister; yoksa 401 konsol hatası.
 */

export function storeApiNonceFromGlobals(globals) {
  const g = globals && typeof globals === 'object' ? globals : {};
  const wc = g.wc && typeof g.wc === 'object' ? g.wc : {};
  const wcSettings = g.wcSettings || wc.wcSettings || {};
  return String(
    g.wcStoreApiNonce ||
      wc.storeApiNonce ||
      wcSettings.storeApiNonce ||
      g.storeApiNonce ||
      (g.wpApiFetch && g.wpApiFetch.nonce) ||
      (g.wpApiSettings && g.wpApiSettings.nonce) ||
      ''
  ).trim();
}

export function storeApiNonceFromHeaders(headers) {
  if (!headers) return '';
  const get =
    typeof headers.get === 'function'
      ? (k) => headers.get(k)
      : (k) => {
          const want = String(k).toLowerCase();
          for (const [key, val] of Object.entries(headers)) {
            if (String(key).toLowerCase() === want) return val;
          }
          return null;
        };
  return String(get('Nonce') || get('X-WC-Store-API-Nonce') || get('nonce') || '').trim();
}

export function storeApiHeaders(nonce, extra = {}) {
  const headers = { Accept: 'application/json', ...extra };
  const n = String(nonce || '').trim();
  if (n) {
    headers.Nonce = n;
    headers['X-WC-Store-API-Nonce'] = n;
  }
  return headers;
}

export function storeApiCartUrl(baseUrl, suffix = '/cart') {
  const root = String(baseUrl || '').replace(/\/$/, '');
  const path = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `${root}/wp-json/wc/store/v1${path}`;
}

/**
 * @param {(url:string, init:object) => Promise<{ok:boolean,status:number,headers:{get:(k:string)=>string|null}, json?:()=>Promise<any>}>} fetchImpl
 * @param {{ url: string, method?: string, nonce?: string, body?: string }} args
 */
export async function storeApiFetch(fetchImpl, args) {
  const method = String(args.method || 'GET').toUpperCase();
  const init = {
    method,
    credentials: 'same-origin',
    headers: storeApiHeaders(args.nonce, args.headers),
  };
  if (args.body != null) init.body = args.body;
  return fetchImpl(args.url, init);
}

/**
 * GET /cart ile taze nonce; yazma yalnız nonce varken.
 * Sepet yalnız bu fetch’in oturumundaki çerezle boşalır (başka kullanıcı yok).
 *
 * @param {(url:string, init:object) => Promise<{ok:boolean,status:number,headers:{get:(k:string)=>string|null}, json?:()=>Promise<any>}>} fetchImpl
 * @param {{ baseUrl: string, globals?: object }} opts
 * @returns {Promise<{ emptied: boolean, status: number, reason: string, nonce: string, requested: string[] }>}
 */
export async function emptyCartStoreApiWithFetch(fetchImpl, opts) {
  const requested = [];
  let nonce = storeApiNonceFromGlobals(opts.globals);
  const cartUrl = storeApiCartUrl(opts.baseUrl, '/cart');
  const itemsUrl = storeApiCartUrl(opts.baseUrl, '/cart/items');

  requested.push('GET /cart');
  const getRes = await storeApiFetch(fetchImpl, { url: cartUrl, method: 'GET', nonce });
  const headerNonce = storeApiNonceFromHeaders(getRes.headers);
  if (headerNonce) nonce = headerNonce;

  if (!nonce) {
    return {
      emptied: false,
      status: getRes.status,
      reason: 'missing-nonce',
      nonce: '',
      requested,
    };
  }

  requested.push('DELETE /cart/items');
  const del = await storeApiFetch(fetchImpl, { url: itemsUrl, method: 'DELETE', nonce });
  if (del.ok || del.status === 409) {
    return { emptied: true, status: del.status, reason: '', nonce, requested };
  }
  return {
    emptied: false,
    status: del.status,
    reason: `delete-status-${del.status}`,
    nonce,
    requested,
  };
}

/**
 * Playwright APIRequestContext → fetchImpl (sayfa konsoluna 401 yazılmaz).
 * @param {import('@playwright/test').Page} page
 */
export function playwrightStoreFetch(page) {
  return async (url, init = {}) => {
    const res = await page.request.fetch(url, {
      method: init.method || 'GET',
      headers: init.headers,
      data: init.body,
      failOnStatusCode: false,
    });
    const headerMap = res.headers();
    return {
      ok: res.ok(),
      status: res.status(),
      headers: {
        get(name) {
          const want = String(name).toLowerCase();
          for (const [k, v] of Object.entries(headerMap)) {
            if (k.toLowerCase() === want) return v;
          }
          return null;
        },
      },
      json: () => res.json(),
    };
  };
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function readStoreApiNonceGlobals(page) {
  return page.evaluate(() => {
    const w = window;
    const wc = w.wc || {};
    const wcSettings = w.wcSettings || wc.wcSettings || {};
    return {
      wcStoreApiNonce: w.wcStoreApiNonce || '',
      storeApiNonce: wcSettings.storeApiNonce || wc.storeApiNonce || '',
      wcSettings: { storeApiNonce: wcSettings.storeApiNonce || '' },
      wc: { wcSettings: { storeApiNonce: (wc.wcSettings && wc.wcSettings.storeApiNonce) || '' } },
      wpApiSettings: w.wpApiSettings ? { nonce: w.wpApiSettings.nonce || '' } : null,
      wpApiFetch: {
        nonce:
          (w.wp &&
            w.wp.apiFetch &&
            w.wp.apiFetch.nonceMiddleware &&
            w.wp.apiFetch.nonceMiddleware.nonce) ||
          '',
      },
    };
  });
}
