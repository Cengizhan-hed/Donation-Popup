import { clampPercent, formatMoney } from './format.mjs';
import { getJson } from './rest.mjs';

const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Sayıyı yumuşak sayar (azaltılmış harekette doğrudan son değer).
 *
 * @param {HTMLElement} node     Metin düğümü.
 * @param {number}      from     Başlangıç.
 * @param {number}      to       Bitiş.
 * @param {(n:number)=>string} format Biçimleyici.
 */
function tween(node, from, to, format) {
  if (reduced() || from === to) {
    node.textContent = format(to);
    return;
  }
  const start = window.performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 1200);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = format(from + (to - from) * eased);
    if (t < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

/**
 * Kartı sunucudan gelen taze veriye göre günceller (önbellekli sayfalarda eski toplamı düzeltir).
 *
 * @param {HTMLElement} root Kart.
 * @param {object}      data REST yanıtı.
 */
export function applyProgress(root, data) {
  const percent = clampPercent(data.percent);
  const bar = root.querySelector('.dp-bar');
  const fill = root.querySelector('.dp-bar__fill');
  if (bar) {
    bar.setAttribute('aria-valuenow', String(percent));
  }
  if (fill) {
    fill.style.setProperty('--p', String(percent));
  }
  const pct = root.querySelector('[data-dp-percent]');
  if (pct) {
    pct.textContent = `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
  }
  const raised = root.querySelector('[data-dp-raised]');
  if (raised && data.currency) {
    const previous = Number(root.dataset.raised) || 0;
    const next = Number(data.raised) || 0;
    const symbol = data.currency.symbol || '';
    const decimals = Number(data.currency.decimals) || 0;
    const locale = document.documentElement.lang || undefined;
    tween(raised, previous, next, (n) => formatMoney(n, symbol, decimals, locale));
    root.dataset.raised = String(next);
  }
  root.querySelectorAll('[data-dp-ms]').forEach((el) => {
    el.classList.toggle('is-hit', percent + 0.00001 >= Number(el.dataset.dpMs));
  });
  const complete = Boolean(data.reached);
  root.classList.toggle('is-complete', complete);
  const badge = root.querySelector('[data-dp-reached]');
  if (badge) {
    badge.hidden = !complete;
  }
  root.dataset.percent = String(percent);
}

/**
 * Kart: görününce çubuk dolar, sonra taze veri çekilir.
 *
 * @param {HTMLElement} root Kart.
 */
export function initProgress(root) {
  if (root.dataset.dpReady === '1') {
    return;
  }
  root.dataset.dpReady = '1';
  const fill = root.querySelector('.dp-bar__fill');
  const target = clampPercent(root.dataset.percent);
  const run = () => {
    if (fill && !reduced()) {
      fill.style.setProperty('--p', '0');
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => fill.style.setProperty('--p', String(target))));
    }
    const id = root.dataset.productId;
    if (id) {
      getJson(`donation-panel/v1/progress/${id}`).then((data) => {
        if (data) {
          applyProgress(root, data);
        }
      });
    }
  };
  if ('IntersectionObserver' in window) {
    const io = new window.IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    });
    io.observe(root);
  } else {
    run();
  }
}
