import { getJson } from './rest.mjs';

/**
 * Tek bağış satırı (yalnız metin düğümleri; HTML enjekte edilmez).
 *
 * @param {object} item   Girdi.
 * @param {string} anon   Adı olmayan bağışçı etiketi.
 * @return {HTMLLIElement} Satır.
 */
export function buildRow(item, anon) {
  const row = document.createElement('li');
  row.className = 'donation-panel-list__row is-new';
  const avatar = document.createElement('span');
  avatar.className = 'donation-panel-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = item.name ? Array.from(item.name)[0] : '♡';
  const text = document.createElement('div');
  text.className = 'donation-panel-list__t';
  const name = document.createElement('b');
  name.textContent = item.name || anon;
  const ago = document.createElement('small');
  ago.textContent = item.ago || '';
  text.append(name, ago);
  const amount = document.createElement('span');
  amount.className = 'donation-panel-num';
  amount.textContent = item.label || '';
  row.append(avatar, text, amount);
  return row;
}

/**
 * Canlı liste: "Daha fazla" sayfa ekler.
 *
 * @param {HTMLElement} root Liste kabı.
 */
export function initFeed(root) {
  const button = root.querySelector('[data-dp-feed-more]');
  const list = root.querySelector('[data-dp-feed-list]');
  if (!button || !list || root.dataset.dpReady === '1') {
    return;
  }
  root.dataset.dpReady = '1';
  button.addEventListener('click', async () => {
    button.disabled = true;
    const next = (Number(root.dataset.page) || 1) + 1;
    const data = await getJson('donation-panel/v1/donations', {
      product_id: root.dataset.productId && root.dataset.productId !== '0' ? root.dataset.productId : '',
      page: next,
      per_page: root.dataset.perPage || 5,
    });
    button.disabled = false;
    if (!data) {
      return;
    }
    (data.items || []).forEach((item) => list.appendChild(buildRow(item, root.dataset.anon || '')));
    root.dataset.page = String(next);
    button.hidden = !data.has_more;
  });
}
