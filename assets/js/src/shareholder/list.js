/**
 * @file list.js
 * Hisse listesi oluşturma, sıralama ve görünür satır yönetimi.
 * Dış API: WDPApp.shareholderList
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const layout = WDPApp.shareholderLayout || {};

  /** Görünürlük için layout modülünü kullanır. */
  function ensureVisible(element, preferredDisplay) {
    if (typeof layout.ensureVisible === 'function') {
      layout.ensureVisible(element, preferredDisplay);
    }
  }

  /** Hissedar alanı üst kapsayıcısını görünür yapar. */
  function applyShareholdersAreaVisibility(area) {
    if (typeof layout.applyShareholdersAreaVisibility === 'function') {
      layout.applyShareholdersAreaVisibility(area);
    }
  }

  /**
   * Hissedar kartlarının kaydırılabilir liste sarmalayıcısını garanti eder.
   * @param {HTMLElement|null} container `.wdp-shareholders-container`
   * @returns {HTMLElement|null} `.wdp-shareholders-scroll` öğesi
   */
  function ensureShareholderList(container) {
    if (!container) {
      return null;
    }

    ensureVisible(container);

    const shareholdersArea = container.closest('.wdp-shareholders-area');
    if (shareholdersArea) {
      applyShareholdersAreaVisibility(shareholdersArea);
    }

    let list = container.querySelector('.wdp-shareholders-scroll');
    if (list) {
      ensureVisible(list, 'flex');
      list.classList.add('wdp-is-visible');
      return list;
    }

    list = document.createElement('div');
    list.className = 'wdp-shareholders-scroll';
    ensureVisible(list, 'flex');
    list.classList.add('wdp-is-visible');

    while (container.firstChild) {
      list.appendChild(container.firstChild);
    }

    container.appendChild(list);
    return list;
  }

  /** Input metninin okunaklı kalması için renk düzeltmesi. */
  function ensureReadableInput(element) {
    if (!element) {
      return;
    }
    ensureVisible(element, 'block');
    element.style.color = '#1f2937';
    element.style.webkitTextFillColor = '#1f2937';
  }

  WDPApp.shareholderList = {
    ensureShareholderList: ensureShareholderList,
    ensureReadableInput: ensureReadableInput,
  };
})(window);
