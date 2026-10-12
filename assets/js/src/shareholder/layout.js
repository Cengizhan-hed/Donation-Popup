/**
 * @file layout.js
 * Hisseli bağış kart düzeni ve grid yerleşimi.
 * Dış API: WDPApp.shareholderLayout
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});

  const SHAREHOLDER_SCROLL_CONFIG = {
    min: 260,
    max: 440,
    ratio: 0.6,
  };

  /** Öğeyi görünür yapar; isteğe bağlı display değeri verilir. */
  function ensureVisible(element, preferredDisplay) {
    if (!element) return;
    if (preferredDisplay) {
      element.style.display = preferredDisplay;
    } else if (element.style.display === 'none') {
      element.style.display = '';
    }
    element.style.removeProperty('visibility');
    element.style.removeProperty('opacity');
    element.removeAttribute('hidden');
  }

  /** Modal yan panel modunda mı? */
  function isSidePanelModal(modal) {
    return !!(modal && modal.classList && modal.classList.contains('wdp-side-panel'));
  }

  /** Yan panelde hissedar scroll inline stillerini sıfırlar. */
  function clearSidePanelShareholderScrollLayout(modal) {
    if (!modal) {
      return;
    }
    modal.querySelectorAll('.wdp-shareholders-area, .wdp-shareholders-container, .wdp-shareholders-scroll').forEach((el) => {
      el.classList.remove('scrollable');
      el.style.removeProperty('height');
      el.style.removeProperty('max-height');
      el.style.removeProperty('min-height');
      el.style.removeProperty('overflow');
      el.style.removeProperty('overflow-y');
      el.style.removeProperty('overflow-x');
    });
  }

  function applyShareholdersAreaVisibility(area) {
    if (!area) return;
    ensureVisible(area);
    area.classList.add('wdp-is-visible');
  }

  function applyShareholdersContainerVisibility(container) {
    if (!container) return;
    ensureVisible(container);
    container.classList.add('wdp-is-visible');
  }

  /** Viewport oranına göre maksimum scroll yüksekliği. */
  function calculateShareholderMaxHeight() {
    if (typeof window === 'undefined') {
      return SHAREHOLDER_SCROLL_CONFIG.max;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportHeight) {
      return SHAREHOLDER_SCROLL_CONFIG.max;
    }

    const rawTarget = viewportHeight * SHAREHOLDER_SCROLL_CONFIG.ratio;
    return Math.round(
      Math.min(
        Math.max(rawTarget, SHAREHOLDER_SCROLL_CONFIG.min),
        SHAREHOLDER_SCROLL_CONFIG.max
      )
    );
  }

  /**
   * ~2 tam kart + 3. kartın bir kısmı görünecek şekilde liste yüksekliği hesaplar.
   */
  function computeShareholderScrollViewportHeight(shareholdersList) {
    const cap = calculateShareholderMaxHeight();
    if (!shareholdersList) {
      return cap;
    }
    const forms = shareholdersList.querySelectorAll('.wdp-shareholder-form');
    if (!forms.length) {
      return cap;
    }
    if (forms.length === 1) {
      const single = forms[0].offsetHeight || forms[0].getBoundingClientRect().height;
      return Math.min(cap, Math.max(SHAREHOLDER_SCROLL_CONFIG.min, Math.ceil(single)));
    }

    const gapPx = 10;
    let total = 0;
    const fullVisible = 2;
    for (let i = 0; i < Math.min(forms.length, fullVisible); i++) {
      const h = forms[i].offsetHeight || forms[i].getBoundingClientRect().height;
      total += h;
      if (i > 0) {
        total += gapPx;
      }
    }
    if (forms.length > fullVisible) {
      const next = forms[fullVisible];
      let peek = 44;
      if (next) {
        if (next.classList.contains('collapsed')) {
          const hdr = next.querySelector('.wdp-shareholder-header');
          peek = hdr ? hdr.offsetHeight || 44 : 44;
        } else {
          peek = Math.min((next.offsetHeight || 120) * 0.4, 64);
        }
      }
      total += peek + gapPx;
    }
    return Math.min(cap, Math.max(SHAREHOLDER_SCROLL_CONFIG.min, Math.ceil(total + 8)));
  }

  /** Hesaplanan yüksekliği alan/konteyner/liste öğelerine uygular. */
  function applyShareholderScrollHeights(shareholdersArea, shareholdersContainer, shareholdersList, heightPx) {
    if (!shareholdersArea || !shareholdersList || !Number.isFinite(heightPx) || heightPx <= 0) {
      return;
    }
    const h = Math.round(heightPx) + 'px';
    shareholdersArea.style.height = h;
    shareholdersArea.style.maxHeight = h;
    shareholdersArea.style.minHeight = '0';
    if (shareholdersContainer) {
      shareholdersContainer.style.height = h;
      shareholdersContainer.style.maxHeight = h;
      shareholdersContainer.style.minHeight = '0';
    }
    shareholdersList.style.height = h;
    shareholdersList.style.maxHeight = h;
    shareholdersList.style.minHeight = '0';
    shareholdersList.style.overflowY = 'auto';
    shareholdersList.style.overflowX = 'hidden';
    shareholdersList.style.webkitOverflowScrolling = 'touch';
    shareholdersList.style.touchAction = 'pan-y';
    shareholdersList.style.overscrollBehavior = 'contain';
  }

  function clearShareholderScrollHeights(shareholdersArea, shareholdersContainer, shareholdersList) {
    [shareholdersArea, shareholdersContainer, shareholdersList].forEach((el) => {
      if (!el) {
        return;
      }
      el.style.removeProperty('height');
      el.style.removeProperty('max-height');
      el.style.removeProperty('min-height');
      el.style.removeProperty('overflow');
      el.style.removeProperty('overflow-y');
      el.style.removeProperty('overflow-x');
      el.style.removeProperty('-webkit-overflow-scrolling');
      el.style.removeProperty('touch-action');
      el.style.removeProperty('overscroll-behavior');
    });
    if (shareholdersArea && shareholdersArea.dataset) {
      delete shareholdersArea.dataset.initialHeight;
    }
  }

  WDPApp.shareholderLayout = {
    ensureVisible: ensureVisible,
    isSidePanelModal: isSidePanelModal,
    clearSidePanelShareholderScrollLayout: clearSidePanelShareholderScrollLayout,
    applyShareholdersAreaVisibility: applyShareholdersAreaVisibility,
    applyShareholdersContainerVisibility: applyShareholdersContainerVisibility,
    calculateShareholderMaxHeight: calculateShareholderMaxHeight,
    computeShareholderScrollViewportHeight: computeShareholderScrollViewportHeight,
    applyShareholderScrollHeights: applyShareholderScrollHeights,
    clearShareholderScrollHeights: clearShareholderScrollHeights,
  };
})(window);
