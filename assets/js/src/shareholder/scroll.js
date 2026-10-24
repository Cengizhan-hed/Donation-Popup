/**
 * @file scroll.js
 * Hisse listesinde kaydırma, sticky başlık ve görünürlük.
 * Dış API: WDPApp.shareholderScroll
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const layout = WDPApp.shareholderLayout || {};
  const listApi = WDPApp.shareholderList || {};
  const state = (WDPApp.state) || {};

  const shareholderLayoutRafByArea = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  const shareholderUpdateRafByRoot = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function isSidePanelModal(modal) {
    return typeof layout.isSidePanelModal === 'function' ? layout.isSidePanelModal(modal) : false;
  }

  function clearSidePanelShareholderScrollLayout(modal) {
    if (typeof layout.clearSidePanelShareholderScrollLayout === 'function') {
      layout.clearSidePanelShareholderScrollLayout(modal);
    }
  }

  function ensureShareholderList(container) {
    if (typeof listApi.ensureShareholderList === 'function') {
      return listApi.ensureShareholderList(container);
    }
    return container ? container.querySelector('.wdp-shareholders-scroll') : null;
  }

  function computeShareholderScrollViewportHeight(shareholdersList) {
    if (typeof layout.computeShareholderScrollViewportHeight === 'function') {
      return layout.computeShareholderScrollViewportHeight(shareholdersList);
    }
    return 440;
  }

  function applyShareholderScrollHeights(area, container, list, heightPx) {
    if (typeof layout.applyShareholderScrollHeights === 'function') {
      layout.applyShareholderScrollHeights(area, container, list, heightPx);
    }
  }

  function clearShareholderScrollHeights(area, container, list) {
    if (typeof layout.clearShareholderScrollHeights === 'function') {
      layout.clearShareholderScrollHeights(area, container, list);
    }
  }

  /** İlk ölçülen hissedar alanı yüksekliğini dataset'e yazar (geri dönüş için). */
  function cacheShareholdersBaseHeight(container) {
    if (!container) {
      return;
    }
    const areaElement = container.closest('.wdp-shareholders-area');
    if (!areaElement || areaElement.dataset.baseHeight) {
      return;
    }
    requestAnimationFrame(function() {
      const measuredHeight = areaElement.offsetHeight;
      if (measuredHeight > 0) {
        areaElement.dataset.baseHeight = String(measuredHeight);
      }
    });
  }

  /**
   * Scrollable sınıfına göre inline stil temizliği veya CSS'e bırakma.
   * @param {HTMLElement} container
   * @param {boolean} enableScroll
   */
  function applyShareholderScrollStyles(container, enableScroll) {
    if (!container) {
      return;
    }

    const scrollElement = container.querySelector('.wdp-shareholders-scroll');
    const areaElement = container.closest('.wdp-shareholders-area');
    const modalRoot = container.closest('.wdp-modal');

    if (isSidePanelModal(modalRoot)) {
      clearSidePanelShareholderScrollLayout(modalRoot);
      return;
    }

    if (!enableScroll) {
      [container, scrollElement, areaElement].forEach(function(el) {
        if (!el) {
          return;
        }
        el.style.removeProperty('max-height');
        el.style.removeProperty('height');
        el.style.removeProperty('overflow');
        el.style.removeProperty('overflow-y');
        el.style.removeProperty('overscroll-behavior');
        el.style.removeProperty('-webkit-overflow-scrolling');
        el.style.removeProperty('touch-action');
        el.style.removeProperty('padding-right');
        el.style.removeProperty('margin-right');
        el.style.removeProperty('padding-inline-end');
        el.style.removeProperty('margin-inline-end');
        el.style.removeProperty('--wdp-shareholders-height');
      });
      if (areaElement) {
        areaElement.classList.remove('scrollable');
      }
      return;
    }

    if (areaElement && !areaElement.classList.contains('scrollable')) {
      areaElement.classList.add('scrollable');
    }
    if (container && !container.classList.contains('scrollable')) {
      container.classList.add('scrollable');
    }
  }

  /** Pencere yeniden boyutlandığında tüm hissedar alanlarını günceller. */
  function bindShareholderResizeListener() {
    if (state.shareholdersResizeBound || typeof window === 'undefined') {
      return;
    }
    window.addEventListener('resize', function() {
      document.querySelectorAll('.wdp-modal, .wdp-donation-form').forEach(function(modal) {
        if (modal.querySelector('.wdp-shareholders-container')) {
          scheduleShareholdersScrollableUpdate(modal);
        }
      });
    }, { passive: true });
    state.shareholdersResizeBound = true;
  }

  /** RAF ile tek karede scroll güncellemesi (performans). */
  function scheduleShareholdersScrollableUpdate(root) {
    if (!root || typeof window === 'undefined') {
      return;
    }
    if (!shareholderUpdateRafByRoot) {
      updateShareholdersScrollable(root);
      return;
    }
    const pending = shareholderUpdateRafByRoot.get(root);
    if (pending) {
      window.cancelAnimationFrame(pending);
    }
    const rafId = window.requestAnimationFrame(function() {
      shareholderUpdateRafByRoot.delete(root);
      updateShareholdersScrollable(root);
    });
    shareholderUpdateRafByRoot.set(root, rafId);
  }

  function cancelPendingShareholderLayout(areaElement) {
    if (!areaElement || !shareholderLayoutRafByArea || typeof window === 'undefined') {
      return;
    }
    const pending = shareholderLayoutRafByArea.get(areaElement);
    if (pending) {
      window.cancelAnimationFrame(pending);
      shareholderLayoutRafByArea.delete(areaElement);
    }
  }

  /** Eski kapalı-form sayacı rozetini kaldırır (artık kullanılmıyor). */
  function updateCollapsedFormsCount(modal) {
    if (!modal) {
      return;
    }
    const sharesSection = modal.querySelector('.wdp-shares-section');
    if (!sharesSection) {
      return;
    }
    const header = sharesSection.querySelector('.wdp-shares-header');
    if (!header) {
      return;
    }
    header.classList.remove('has-badge');
    const countBadge = header.querySelector('.wdp-collapsed-count');
    if (countBadge) {
      countBadge.remove();
    }
  }

  /**
   * Hisse sayısına göre scrollable durumunu ve yüksekliği günceller.
   * @param {HTMLElement} modal `.wdp-modal` veya `.wdp-donation-form` kökü
   */
  function updateShareholdersScrollable(modal) {
    const shareholdersContainer = modal.querySelector('.wdp-shareholders-container');
    if (!shareholdersContainer) {
      return;
    }
    const shareholdersList = ensureShareholderList(shareholdersContainer);
    if (!shareholdersList) {
      return;
    }

    const shareholdersArea = shareholdersContainer.closest('.wdp-shareholders-area');
    const shareCountInput = modal.querySelector('input[name="share_count"]');
    const shareCount = shareCountInput ? Number.parseInt(shareCountInput.value, 10) || 1 : 1;
    const forms = shareholdersList.querySelectorAll('.wdp-shareholder-form');
    const shouldScroll = shareCount > 1 || forms.length > 1;

    if (isSidePanelModal(modal)) {
      if (shouldScroll && shareholdersArea) {
        shareholdersArea.classList.add('scrollable');
        shareholdersContainer.classList.add('scrollable');
        shareholdersList.style.overflowY = 'auto';
        shareholdersList.style.overflowX = 'hidden';
        shareholdersList.style.webkitOverflowScrolling = 'touch';
        shareholdersList.style.touchAction = 'pan-y';
        shareholdersList.style.flex = '1 1 auto';
        shareholdersList.style.minHeight = '0';
        shareholdersList.style.overscrollBehavior = 'contain';
      } else {
        clearSidePanelShareholderScrollLayout(modal);
      }
      return;
    }

    if (shareholdersArea) {
      if (shouldScroll) {
        shareholdersArea.classList.add('scrollable');
        cancelPendingShareholderLayout(shareholdersArea);
        const layoutRaf = requestAnimationFrame(function() {
          if (shareholderLayoutRafByArea) {
            shareholderLayoutRafByArea.delete(shareholdersArea);
          }
          const viewportHeight = computeShareholderScrollViewportHeight(shareholdersList);
          const prevScrollTop = shareholdersList.scrollTop || 0;
          applyShareholderScrollHeights(
            shareholdersArea,
            shareholdersContainer,
            shareholdersList,
            viewportHeight
          );
          if (prevScrollTop > 0) {
            shareholdersList.scrollTop = Math.max(0, prevScrollTop);
          }
        });
        if (shareholderLayoutRafByArea) {
          shareholderLayoutRafByArea.set(shareholdersArea, layoutRaf);
        }
      } else {
        cancelPendingShareholderLayout(shareholdersArea);
        shareholdersArea.classList.remove('scrollable');
        clearShareholderScrollHeights(shareholdersArea, shareholdersContainer, shareholdersList);
      }
    }

    shareholdersContainer.classList.toggle('scrollable', shouldScroll);

    if (!shouldScroll) {
      cacheShareholdersBaseHeight(shareholdersContainer);
    }

    applyShareholderScrollStyles(shareholdersContainer, shouldScroll);

    if (shouldScroll) {
      bindShareholderResizeListener();
    }

    updateCollapsedFormsCount(modal);
  }

  function calculateShareholderMaxHeight() {
    if (typeof layout.calculateShareholderMaxHeight === 'function') {
      return layout.calculateShareholderMaxHeight();
    }
    return 440;
  }

  WDPApp.shareholderScroll = {
    cacheShareholdersBaseHeight: cacheShareholdersBaseHeight,
    applyShareholderScrollStyles: applyShareholderScrollStyles,
    bindShareholderResizeListener: bindShareholderResizeListener,
    scheduleShareholdersScrollableUpdate: scheduleShareholdersScrollableUpdate,
    updateShareholdersScrollable: updateShareholdersScrollable,
    updateCollapsedFormsCount: updateCollapsedFormsCount,
    calculateShareholderMaxHeight: calculateShareholderMaxHeight,
  };
})(window);
