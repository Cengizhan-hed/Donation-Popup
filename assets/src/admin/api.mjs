/**
 * REST istemcisi (fetch + X-WP-Nonce).
 *
 * @param {{rest: string, nonce: string}} cfg Yapılandırma.
 * @return {{get: Function, post: Function}} İstemci.
 */
export function createApi(cfg) {
  const call = async (method, path, body) => {
    const init = {
      method,
      credentials: 'same-origin',
      headers: { 'X-WP-Nonce': cfg.nonce, Accept: 'application/json' },
    };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(cfg.rest + path, init);
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const err = new Error((data && data.message) || '');
      err.status = res.status;
      throw err;
    }
    return data;
  };
  return {
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body),
  };
}
