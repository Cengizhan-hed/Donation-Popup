/**
 * Yerel E2E: eklenti AJAX hata TÜRÜ (nonce/rate/capability/id). Gövde/kişisel veri yok.
 */

const KIND_RE = /^(nonce|rate|capability|origin|id|method)$/;

/**
 * @param {number} status
 * @param {object|null} json
 * @returns {'nonce'|'rate'|'capability'|'origin'|'id'|'method'|'other'|''}
 */
export function classifyPluginAjaxErrorKind(status, json) {
  const st = Number(status) || 0;
  const inner = json && typeof json === 'object' && json.data && typeof json.data === 'object' ? json.data : json;
  const code = inner && inner.code !== undefined ? inner.code : json && json.code;
  const msg = String((inner && inner.message) || (json && json.message) || '').toLowerCase();
  if (st === 429 || code === 'rate_limit' || /çok fazla istek/.test(msg)) return 'rate';
  if (code === 'capability' || /yetkiniz/.test(msg)) return 'capability';
  if (code === 'origin' || /istek kaynağı/.test(msg)) return 'origin';
  if (code === 'method' || /istek metodu/.test(msg)) return 'method';
  if (/geçersiz ürün|ürün bulunamadı/.test(msg)) return 'id';
  if (st === 403 || code === 'nonce' || /güvenlik|nonce/.test(msg)) return 'nonce';
  if (json && json.success === false) return 'other';
  if (st >= 400) return 'other';
  return '';
}

/**
 * @param {import('@playwright/test').Page} page
 */
export function attachAjaxErrorKindLogger(page) {
  if (!page || typeof page.on !== 'function' || page.__wdpAjaxKind) return;
  page.__wdpAjaxKind = true;
  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (!/\/admin-ajax\.php/i.test(url) && !/\/wp-json\//i.test(url)) return;
      const req = res.request();
      let action = '';
      try {
        const post = req.postData() || '';
        const m = /(?:^|&)action=([^&]+)/.exec(post);
        if (m) action = decodeURIComponent(m[1].replace(/\+/g, ' '));
      } catch {
        action = '';
      }
      if (!/^wdp_/.test(action) && !/woo-donation-popup|\/wdp[_/-]/i.test(url)) return;
      const status = Number(res.status()) || 0;
      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      const fail = (json && json.success === false) || status >= 400;
      if (!fail) return;
      const kind = classifyPluginAjaxErrorKind(status, json);
      const safeKind = KIND_RE.test(kind) ? kind : 'other';
      const safeAction = /^[a-z0-9_]+$/i.test(action) ? action : '(unknown)';
      console.log(`[e2e:ajax-kind] action=${safeAction} http=${status} kind=${safeKind}`);
    } catch {
      /* teşhis test akışını düşürmez */
    }
  });
}

/**
 * @param {import('@playwright/test').BrowserContext} ctx
 */
export function attachAjaxErrorKindLoggerOnContext(ctx) {
  if (!ctx || typeof ctx.on !== 'function' || ctx.__wdpAjaxKind) return;
  ctx.__wdpAjaxKind = true;
  ctx.on('page', (page) => attachAjaxErrorKindLogger(page));
}
