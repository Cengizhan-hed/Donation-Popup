import { buildRestUrl } from './format.mjs';

/**
 * WordPress REST kök adresi (standart `link rel="https://api.w.org/"`).
 *
 * @return {string} Kök adres.
 */
function restBase() {
  const link = document.querySelector('link[rel="https://api.w.org/"]');
  return link ? link.href : `${window.location.origin}/wp-json/`;
}

/**
 * Salt okunur GET; yanıt JSON'u ya da null (404 / ağ hatası: özellik sessizce kapalı kalır).
 *
 * @param {string} route Yol (`donation-panel/v1/...`).
 * @param {Object<string,string|number>} query Sorgu.
 * @return {Promise<object|null>} Yanıt.
 */
export async function getJson(route, query = {}) {
  try {
    const response = await window.fetch(buildRestUrl(restBase(), route, query), { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    return response.ok ? await response.json() : null;
  } catch (error) {
    window.console.debug('donation-panel: istek tamamlanamadı', error);
    return null;
  }
}
