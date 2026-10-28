import { describeImpact, formatMoney, parseAmount } from './format.mjs';
import { getJson } from './rest.mjs';

/**
 * Seçili tutarı okur (işaretli çip, yoksa yazılan alan).
 *
 * @param {HTMLFormElement} form Form.
 * @return {number|null} Tutar.
 */
function currentAmount(form) {
  // Seçili hazır tutarın ifadesini kartın kendisi gösterir; satır yalnız yazılan tutar için.
  if (form.querySelector('[data-dp-preset][aria-checked="true"]')) {
    return null;
  }
  const input = form.querySelector('input[name="amount"]');
  return input ? parseAmount(input.value) : null;
}

/**
 * Forma etki ifadesi satırı ekler (REST'te ifade yoksa hiçbir şey eklenmez).
 *
 * @param {HTMLFormElement} form Form.
 */
export async function initImpact(form) {
  if (form.dataset.dpImpact === '1' || !form.dataset.productId) {
    return;
  }
  form.dataset.dpImpact = '1';
  const data = await getJson(`donation-panel/v1/impact/${form.dataset.productId}`);
  const holder = form.querySelector('[data-dp-amounts]');
  if (!data || !Array.isArray(data.tiers) || !data.tiers.length || !holder) {
    return;
  }
  const line = document.createElement('p');
  line.className = 'donation-panel-impact';
  line.setAttribute('aria-live', 'polite');
  line.hidden = true;
  holder.appendChild(line);

  const symbolNode = form.querySelector('[data-symbol]');
  const preNode = form.querySelector('.donation-panel-prefixed .pre');
  const symbol = (symbolNode && symbolNode.dataset.symbol) || (preNode && preNode.textContent) || '';
  const decimals = Number(form.dataset.decimals) || 0;
  const locale = document.documentElement.lang || undefined;

  const update = () => {
    const amount = currentAmount(form);
    const text = amount ? describeImpact(amount, data.tiers, locale) : '';
    line.hidden = text === '';
    line.textContent = text ? `${formatMoney(amount, symbol, decimals, locale)} = ${text}` : '';
  };
  new window.MutationObserver(update).observe(form, { attributes: true, attributeFilter: ['aria-checked'], subtree: true });
  form.addEventListener('input', update);
  update();
}
