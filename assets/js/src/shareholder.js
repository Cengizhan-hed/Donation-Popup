/**
 * Shareholder - Hissedar formları yönetimi
 * ensureShareholderList, setupShareholderForms, setupShareQuantityButtons,
 * createShareholderForm, setupCopyFormButton, duplicateShareholderForm, updateShareholdersScrollable,
 * updateCollapsedFormsCount, applyShareholderScrollStyles, cacheShareholdersBaseHeight,
 * bindShareholderResizeListener, calculateShareholderMaxHeight, setupDirectShareholderForms,
 * updateShareholderForms
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['safeLog', 'formatCurrency', 'escapeHtml', 'debounce'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const productCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('product', ['getData'])
    : { module: WDPApp.product || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const product = productCheck.module;
  const { safeLog, formatCurrency, escapeHtml, debounce } = utils;
  const { productPrices, shareholdersResizeBound } = state;
  const { getData: getProductInfoData } = product;

  function setupWdpPhoneFields(root) {
    const phone = WDPApp.phoneInput;
    if (root && phone && typeof phone.setupInRoot === 'function') {
      phone.setupInRoot(root);
    }
  }

  // Shareholder metinlerini PHP'den al (wdp_ajax üzerinden)
  const wdpAjax = window.wdp_ajax || {};
  const shareholderTexts = (wdpAjax && wdpAjax.shareholder_texts) || {};

  /* Field stack icons — same paths as PHP WDP_Templates (filled, matched weight) */
  const FS_ICON_USER = '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-1c0-2.66-5.33-4-8-4z"/></svg>';
  const FS_ICON_NOTE = '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
  const FS_ICON_EMAIL = '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>';
  const enableCopyButton = (typeof shareholderTexts.enable_copy_button === 'boolean')
    ? shareholderTexts.enable_copy_button
    : true;
  const layoutMode = typeof shareholderTexts.layout === 'string' ? shareholderTexts.layout : 'single';
  const densityMode = typeof shareholderTexts.density === 'string' ? shareholderTexts.density : 'normal';
  const enableEmailField = (typeof shareholderTexts.enable_email === 'boolean')
    ? shareholderTexts.enable_email
    : false;

  // Constants
  const SHAREHOLDER_SCROLL_CONFIG = {
    min: 260,
    max: 440,
    ratio: 0.6,
  };

  /** @param {HTMLElement|null} form */
  function getShareholderNoteTextarea(form) {
    return form ? form.querySelector('textarea[name^="shareholder_note_"]') : null;
  }

  function ensureVisible(element, preferredDisplay) {
    if (!element) return;
    if (preferredDisplay) {
      element.style.display = preferredDisplay;
    } else if (element.style.display === 'none') {
      element.style.display = '';
    }
    element.style.visibility = 'visible';
    element.style.opacity = '1';
    element.removeAttribute('hidden');
  }

  function shareholdersAreaHasRail(area) {
    return !!(area && area.classList && area.classList.contains('wdp-shareholders-area--with-rail'));
  }

  function isSidePanelModal(modal) {
    return !!(modal && modal.classList && modal.classList.contains('wdp-side-panel'));
  }

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

  /** Satır içi display/flex — sol adım rayı varken CSS grid’i ezmemeli */
  function applyShareholdersAreaVisibility(area) {
    if (!area) return;
    area.style.visibility = 'visible';
    area.style.opacity = '1';
    area.removeAttribute('hidden');
    if (shareholdersAreaHasRail(area)) {
      area.style.display = 'block';
      area.style.flexDirection = '';
    } else {
      area.style.display = 'flex';
      area.style.flexDirection = 'column';
    }
  }

  function applyShareholdersContainerVisibility(container) {
    if (!container) return;
    const area = container.closest('.wdp-shareholders-area');
    container.style.visibility = 'visible';
    container.style.opacity = '1';
    container.removeAttribute('hidden');
    if (shareholdersAreaHasRail(area)) {
      container.style.display = 'grid';
      container.style.flexDirection = '';
    } else {
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
    }
  }

  function ensureReadableInput(element) {
    if (!element) return;
    ensureVisible(element, 'block');
    element.style.color = '#1f2937';
    element.style.webkitTextFillColor = '#1f2937';
  }

  // Helper: Ensure shareholder list container exists
  function ensureShareholderList(container) {
    if (!container) return null;

    // CRITICAL: Container'ın görünürlüğünü garanti et
    ensureVisible(container);

    // CRITICAL: Parent area'nın da görünür olduğundan emin ol
    const shareholdersArea = container.closest('.wdp-shareholders-area');
    if (shareholdersArea) {
      applyShareholdersAreaVisibility(shareholdersArea);
    }

    let list = container.querySelector(".wdp-shareholders-scroll");
    if (list) {
      // Mevcut listeyi görünür yap
      ensureVisible(list, 'flex');
      list.style.flexDirection = 'column';
      return list;
    }

    list = document.createElement("div");
    list.className = "wdp-shareholders-scroll";
    // Yeni listeyi görünür yap
    ensureVisible(list, 'flex');
    list.style.flexDirection = 'column';

    while (container.firstChild) {
      list.appendChild(container.firstChild);
    }

    container.appendChild(list);
    return list;
  }

  // Helper: Calculate max height for shareholder area
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
        SHAREHOLDER_SCROLL_CONFIG.max,
      ),
    );
  }

  // Helper: Cache base height for shareholder area
  function cacheShareholdersBaseHeight(container) {
    if (!container) return;
    const areaElement = container.closest('.wdp-shareholders-area');
    if (!areaElement || areaElement.dataset.baseHeight) return;

    requestAnimationFrame(() => {
      const measuredHeight = areaElement.offsetHeight;
      if (measuredHeight > 0) {
        areaElement.dataset.baseHeight = String(measuredHeight);
      }
    });
  }

  // Helper: Apply scroll styles to shareholder container
  function applyShareholderScrollStyles(container, enableScroll) {
    if (!container) return;

    const scrollElement = container.querySelector('.wdp-shareholders-scroll');
    const areaElement = container.closest('.wdp-shareholders-area');
    const modalRoot = container.closest('.wdp-modal');

    if (isSidePanelModal(modalRoot)) {
      clearSidePanelShareholderScrollLayout(modalRoot);
      return;
    }
    
    // CRITICAL: When enabling scroll, DO NOT remove height constraints immediately
    // Let CSS handle it through scrollable class, but ensure class is applied first
    if (!enableScroll) {
      // When disabling scroll, clean up all inline styles
      [container, scrollElement, areaElement].forEach((el) => {
        if (!el) return;
        el.style.removeProperty('max-height');
        el.style.removeProperty('height');
        el.style.removeProperty('overflow');
        el.style.removeProperty('overflow-y');
        el.style.removeProperty('overscroll-behavior');
        el.style.removeProperty('-webkit-overflow-scrolling');
        el.style.removeProperty('touch-action');
        el.style.removeProperty('padding-right');
        el.style.removeProperty('margin-right');
        el.style.removeProperty('--wdp-shareholders-height');
      });
      
      if (areaElement) {
        areaElement.classList.remove('scrollable');
      }
      return;
    }

    // When enabling scroll, ensure scrollable class is already applied (done in updateShareholdersScrollable)
    // CSS will handle height constraints through scrollable class
    // No inline styles needed - rely entirely on CSS
    if (areaElement && !areaElement.classList.contains('scrollable')) {
      areaElement.classList.add('scrollable');
    }
    
    if (container && !container.classList.contains('scrollable')) {
      container.classList.add('scrollable');
    }
  }

  // Helper: Bind resize listener for shareholder containers
  function bindShareholderResizeListener() {
    if (shareholdersResizeBound || typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      document
        .querySelectorAll('.wdp-shareholders-container.scrollable')
        .forEach((container) => applyShareholderScrollStyles(container, container.classList.contains('scrollable')));
    };

    window.addEventListener('resize', handleResize, { passive: true });
    state.shareholdersResizeBound = true;
  }

  const shareholderLayoutRafByArea = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

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

  // Helper: Update scrollable class for shareholders container
  function updateShareholdersScrollable(modal) {
    if (isSidePanelModal(modal)) {
      clearSidePanelShareholderScrollLayout(modal);
      return;
    }

    const shareholdersContainer = modal.querySelector('.wdp-shareholders-container');
    if (!shareholdersContainer) return;
    const shareholdersList = ensureShareholderList(shareholdersContainer);
    if (!shareholdersList) return;
    
    // CRITICAL: shareCount'u kontrol et - görünür form sayısını değil
    // Çünkü sadece 1. form görünür ama shareCount > 1 ise scroll olmalı
    const shareCountInput = modal.querySelector('input[name="share_count"]');
    const shareCount = shareCountInput ? Number.parseInt(shareCountInput.value, 10) || 1 : 1;
    const forms = shareholdersList.querySelectorAll('.wdp-shareholder-form');
    // Scroll sadece hisse adedi 1'den fazla olduğunda aktif olsun (scrollbar görünsün)
    // CRITICAL: shareCount'u kontrol et, görünür form sayısını değil
    const shouldScroll = shareCount > 1;
    
    // CRITICAL: Immediately add/remove scrollable class to prevent modal expansion
    // CSS will handle height constraints through scrollable class
    const shareholdersArea = shareholdersContainer.closest('.wdp-shareholders-area');
    if (shareholdersArea) {
      // ABSOLUTE FIX: Modal ilk açıldığında shareholders-area'nın height'ını kaydet
      // Böylece scrollable olduğunda aynı height'ı kullanabiliriz
      if (!shareholdersArea.dataset.initialHeight) {
        // İlk açılışta height'ı kaydet (1 form için)
        requestAnimationFrame(() => {
          const initialHeight = shareholdersArea.offsetHeight;
          if (initialHeight > 0) {
            shareholdersArea.dataset.initialHeight = initialHeight + 'px';
          }
        });
      }
      
      if (shouldScroll) {
        // Immediately add scrollable class - CSS will apply height constraints
        shareholdersArea.classList.add('scrollable');
        
        // ABSOLUTE FIX: Modal yüksekliği sabit kalacak - ilk açıldığındaki height'ı kullan
        // CRITICAL: Scroll container'ın height'ını 1. formun yüksekliği kadar yap
        // Böylece 2. formun header'ı görünmez, sadece scroll yapınca görünür
        cancelPendingShareholderLayout(shareholdersArea);
        const layoutRaf = requestAnimationFrame(() => {
          shareholderLayoutRafByArea && shareholderLayoutRafByArea.delete(shareholdersArea);
          if (shareholdersList && shareholdersArea) {
            // 1. formun yüksekliğini al
            const firstForm = shareholdersList.querySelector('.wdp-shareholder-form[data-index="1"]');
            if (!firstForm) return;
            
            // ABSOLUTE FIX: Modal ilk açıldığında kaydedilen height'ı kullan
            // CRITICAL: Popup ve sayfa içi form için aynı height hesaplama mantığı
            // Eğer kaydedilmemişse, scrollable class'ını geçici olarak kaldırıp height'ı ölç
            let areaHeightValue;
            if (shareholdersArea.dataset.initialHeight) {
              areaHeightValue = parseFloat(shareholdersArea.dataset.initialHeight);
            } else {
              // CRITICAL: Scrollable class'ını geçici olarak kaldır, height'ı ölç
              const wasScrollable = shareholdersArea.classList.contains('scrollable');
              if (wasScrollable) {
                shareholdersArea.classList.remove('scrollable');
              }
              
              // Height'ı hemen ölç (scrollable olmadan)
              const currentHeight = shareholdersArea.offsetHeight;
              if (currentHeight > 0) {
                shareholdersArea.dataset.initialHeight = currentHeight + 'px';
                areaHeightValue = currentHeight;
              } else {
                // Fallback: CSS'teki clamp() değerini kullan
                const computedAreaHeight = window.getComputedStyle(shareholdersArea).height;
                areaHeightValue = parseFloat(computedAreaHeight) || 280;
                shareholdersArea.dataset.initialHeight = areaHeightValue + 'px';
              }
              
              // Scrollable class'ını geri ekle
              if (wasScrollable) {
                shareholdersArea.classList.add('scrollable');
              }
            }
            
            // ABSOLUTE FIX: Shareholders-area'nın height'ını ilk açıldığındaki height'a sabitle
            // CRITICAL: Modal yüksekliği hiç değişmeyecek - sadece scroll container içinde scroll olacak
            shareholdersArea.style.height = areaHeightValue + 'px';
            shareholdersArea.style.maxHeight = areaHeightValue + 'px';
            shareholdersArea.style.minHeight = areaHeightValue + 'px';
            
            // CRITICAL: Shareholders-container'ın height'ını areaHeightValue kadar yap (boşluk olmasın)
            const shareholdersContainer = shareholdersList.closest('.wdp-shareholders-container');
            if (shareholdersContainer) {
              shareholdersContainer.style.height = areaHeightValue + 'px';
              shareholdersContainer.style.maxHeight = areaHeightValue + 'px';
              shareholdersContainer.style.minHeight = '0';
            }
            
            // CRITICAL: Scroll container'ın height'ını areaHeightValue kadar yap
            // Böylece scroll container areaHeightValue kadar yükseklikte olacak ve beyaz alan olmayacak
            shareholdersList.style.height = areaHeightValue + 'px';
            shareholdersList.style.maxHeight = areaHeightValue + 'px';
            shareholdersList.style.minHeight = '0';
            
            // CRITICAL: Scroll pozisyonunu sıfırla (beyaz alan sorununu önlemek için)
            shareholdersList.scrollTop = 0;
          }
        });
        if (shareholderLayoutRafByArea) {
          shareholderLayoutRafByArea.set(shareholdersArea, layoutRaf);
        }
      } else {
        cancelPendingShareholderLayout(shareholdersArea);
        shareholdersArea.classList.remove('scrollable');
        // Scroll container'ın height'ını sıfırla
        shareholdersList.style.maxHeight = '';
        shareholdersList.style.height = '';
        // Shareholders-container'ın height'ını da sıfırla
        const shareholdersContainer = shareholdersList.closest('.wdp-shareholders-container');
        if (shareholdersContainer) {
          shareholdersContainer.style.height = '';
          shareholdersContainer.style.maxHeight = '';
        }
        // Shareholders-area'nın inline style'larını da temizle (CSS'e geri dön)
        shareholdersArea.style.height = '';
        shareholdersArea.style.maxHeight = '';
        shareholdersArea.style.minHeight = '';
        // ABSOLUTE FIX: initialHeight'ı temizleme - bir sonraki scrollable için kullanılabilir
      }
    }
    
    shareholdersContainer.classList.toggle('scrollable', shouldScroll);
    
    if (!shouldScroll) {
      cacheShareholdersBaseHeight(shareholdersContainer);
    }
    
    // Apply scroll styles - ensures CSS classes are properly applied
    applyShareholderScrollStyles(shareholdersContainer, shouldScroll);
    
    if (shouldScroll) {
      bindShareholderResizeListener();
    }
    
    // Badge'i her zaman güncelle (hisse adedi 1'e düştüğünde de temizlemek için)
    updateCollapsedFormsCount(modal);
  }

  /** Kapalı form sayacı / mavi bilgi bandı kaldırıldı — üst özet tek satırda. */
  function updateCollapsedFormsCount(modal) {
    if (!modal) return;
    const sharesSection = modal.querySelector('.wdp-shares-section');
    if (!sharesSection) return;
    const header = sharesSection.querySelector('.wdp-shares-header');
    if (!header) return;
    header.classList.remove('has-badge');
    const countBadge = header.querySelector('.wdp-collapsed-count');
    if (countBadge) {
      countBadge.remove();
    }
  }

  /** Bir modal/form kökü için tek debounced guidance yenilemesi (çok hissedar + input olaylarında maliyeti düşürür). */
  const shareholderGuidanceDebouncedByRoot = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function queueShareholderGuidanceRefresh(root) {
    if (!root) {
      return;
    }
    if (typeof debounce === 'function' && shareholderGuidanceDebouncedByRoot) {
      let run = shareholderGuidanceDebouncedByRoot.get(root);
      if (!run) {
        run = debounce(function () {
          refreshShareholderGuidance(root);
        }, 72);
        shareholderGuidanceDebouncedByRoot.set(root, run);
      }
      run();
      return;
    }
    refreshShareholderGuidance(root);
  }

  function getShareholderForms(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll('.wdp-shareholder-form'));
  }

  /**
   * Doğrulama dataset bayrakları her zaman iç form (wdp-donation-form-fields) üzerinde tutulur.
   * Bazı çağrılar .wdp-modal kökü ile geldiğinden, armed / target okuma-yazma için formu çözümler.
   */
  function resolveShareholderValidationRoot(scope) {
    if (!scope) {
      return null;
    }
    try {
      if (scope.nodeType === 1 && scope.tagName === 'FORM') {
        if (scope.classList.contains('wdp-donation-form-fields') || scope.classList.contains('wdp-has-shareholders')) {
          return scope;
        }
      }
    } catch (eResolve) {
      /* ignore */
    }
    if (typeof scope.closest === 'function') {
      const direct =
        scope.closest('form.wdp-donation-form-fields') ||
        scope.closest('form.wdp-has-shareholders') ||
        scope.closest('form');
      if (direct) {
        return direct;
      }
    }
    if (typeof scope.querySelector === 'function') {
      const inner = scope.querySelector('form.wdp-donation-form-fields, form.wdp-has-shareholders');
      if (inner) {
        return inner;
      }
    }
    return null;
  }

  function getRowRequiredState(form) {
    if (!form) {
      return { complete: true, missing: [] };
    }
    const nameInput = form.querySelector('input[name^="shareholder_name_"]');
    const phoneInput = form.querySelector('input[name^="shareholder_phone_"]');
    const missing = [];
    if (!nameInput || !nameInput.value.trim()) {
      missing.push('Ad Soyad');
    }
    if (!phoneInput || !phoneInput.value.trim()) {
      missing.push('Telefon');
    }
    return {
      complete: missing.length === 0,
      missing: missing,
    };
  }

  function stripShareholderRowStatusUI(form) {
    if (!form) return;
    form.querySelectorAll('.wdp-shareholder-status, .wdp-shareholder-status-note').forEach(function (el) {
      el.remove();
    });
  }

  /** Eski üst “Hissedar Form Durumu” bandı kaldırıldı; sol adım rayı tek ilerleme göstergesi. Kalıntı DOM temizliği. */
  function removeShareholderOverview(root) {
    if (!root) return;
    const sharesHeader = root.querySelector('.wdp-shares-header');
    if (!sharesHeader) return;
    sharesHeader.querySelectorAll('.wdp-shareholder-overview').forEach(function (el) {
      el.remove();
    });
  }

  function isShareValidationArmed(root) {
    return !!(root && root.dataset && root.dataset.wdpShareValidationArmed === '1');
  }

  function setShareValidationArmed(root, armed, targetIndex) {
    const bag = resolveShareholderValidationRoot(root) || root;
    if (!bag || !bag.dataset) return;
    bag.dataset.wdpShareValidationArmed = armed ? '1' : '0';
    if (armed && Number.isFinite(Number(targetIndex)) && Number(targetIndex) > 0) {
      bag.dataset.wdpShareValidationTarget = String(Number(targetIndex));
    } else {
      delete bag.dataset.wdpShareValidationTarget;
    }
    refreshShareholderGuidance(root);
  }

  function refreshShareholderGuidance(root) {
    if (!root) return;
    const bag = resolveShareholderValidationRoot(root) || root;
    removeShareholderOverview(bag);
    const forms = getShareholderForms(bag);
    if (!forms.length) {
      syncShareholderStepRail(bag);
      return;
    }
    const armed = isShareValidationArmed(bag);
    const targetIndex = Number.parseInt((bag.dataset && bag.dataset.wdpShareValidationTarget) || '0', 10) || 0;

    forms.forEach(function (form) {
      stripShareholderRowStatusUI(form);
      const state = getRowRequiredState(form);
      const formIndex = Number.parseInt(form.getAttribute('data-index') || '0', 10) || 0;
      form.classList.remove('is-complete', 'is-incomplete', 'is-incomplete-pending', 'is-targeted-incomplete');
      if (armed && !state.complete && targetIndex > 0 && formIndex === targetIndex) {
        form.classList.add('is-targeted-incomplete');
      }
    });

    forms.forEach(function (form) {
      checkShareholderFormWarning(form);
    });

    syncShareholderStepRail(bag);
  }

  /**
   * Hisse numaraları: sol dikey gösterge (masaüstü), dar ekranda yatay.
   * Tamamlanma: getRowRequiredState ile (ad + telefon) — mevcut doğrulama ile uyumlu.
   * Aktif adım: açık (collapsed olmayan) kart; yoksa ilk eksik hisse.
   * Durum önceliği: submit sonrası armed + eksik → kırmızı; tamamlandı → yeşil; açık eksik → mavi; diğer eksik → nötr.
   */
  function syncShareholderStepRail(root) {
    if (!root || typeof document === 'undefined') {
      return;
    }
    const bag = resolveShareholderValidationRoot(root) || root;
    const armed = isShareValidationArmed(bag);
    bag.querySelectorAll('.wdp-shareholders-area').forEach((area) => {
      const rail = area.querySelector('.wdp-shareholders-step-rail');
      if (!rail) {
        return;
      }
      const list = area.querySelector('.wdp-shareholders-scroll');
      if (!list) {
        return;
      }
      const forms = Array.from(list.querySelectorAll('.wdp-shareholder-form'));
      rail.textContent = '';
      if (forms.length === 0) {
        rail.setAttribute('hidden', 'hidden');
        return;
      }
      rail.removeAttribute('hidden');
      let currentIdx = forms.findIndex((f) => !f.classList.contains('collapsed'));
      if (currentIdx < 0) {
        currentIdx = forms.findIndex((f) => !getRowRequiredState(f).complete);
      }
      if (currentIdx < 0) {
        currentIdx = forms.length - 1;
      }
      forms.forEach((form, idx) => {
        if (idx > 0) {
          const connector = document.createElement('span');
          connector.className = 'wdp-shareholders-step-connector';
          connector.setAttribute('aria-hidden', 'true');
          rail.appendChild(connector);
        }
        const n = idx + 1;
        const state = getRowRequiredState(form);
        const step = document.createElement('button');
        step.type = 'button';
        step.className = 'wdp-shareholders-step-item';
        step.textContent = String(n);
        step.setAttribute('aria-label', 'Hisse ' + n);
        if (armed && !state.complete) {
          step.classList.add('is-invalid');
          step.setAttribute('aria-invalid', 'true');
        } else {
          step.removeAttribute('aria-invalid');
          if (state.complete) {
            step.classList.add('is-complete');
          } else if (idx === currentIdx) {
            step.classList.add('is-current');
          } else {
            step.classList.add('is-pending');
          }
        }
        step.addEventListener('click', () => {
          const reduceMotion = typeof window !== 'undefined' && window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          try {
            form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
          } catch (e) {
            form.scrollIntoView(false);
          }
          const header = form.querySelector('.wdp-shareholder-header');
          if (header && form.classList.contains('collapsed')) {
            header.click();
          }
        });
        rail.appendChild(step);
      });
    });
  }

  function attachGuidanceListeners(form) {
    if (!form || form.dataset.wdpGuidanceBound === '1') {
      return;
    }
    const refresh = (e) => {
      const bag = resolveShareholderValidationRoot(form) || form.closest('form');
      if (bag) {
        bag.dataset.wdpShareValidationArmed = '0';
        delete bag.dataset.wdpShareValidationTarget;
        if (e && e.target && e.target.classList && e.target.classList.contains('wdp-error')) {
          e.target.classList.remove('wdp-error');
        }
        queueShareholderGuidanceRefresh(bag);
      }
    };
    const nameInput = form.querySelector('input[name^="shareholder_name_"]');
    const phoneInput = form.querySelector('input[name^="shareholder_phone_"]');
    if (nameInput) {
      nameInput.addEventListener('input', refresh);
    }
    if (phoneInput) {
      phoneInput.addEventListener('input', refresh);
    }
    form.dataset.wdpGuidanceBound = '1';
  }

  function syncShareholderUnitPrices(modal, unitNumeric) {
    if (!modal) return;
    const nodes = modal.querySelectorAll('.wdp-shareholder-unit-price');
    if (!nodes.length) return;
    const labelBase = (wdpAjax.strings && wdpAjax.strings.unit_price_label) ? String(wdpAjax.strings.unit_price_label) : 'Birim fiyat';
    let text = '';
    if (Number.isFinite(unitNumeric) && unitNumeric > 0) {
      text = formatCurrency(unitNumeric);
    }
    nodes.forEach((el) => {
      el.textContent = text;
      if (text) {
        el.removeAttribute('aria-hidden');
        el.setAttribute('aria-label', `${labelBase} ${text}`);
      } else {
        el.setAttribute('aria-hidden', 'true');
        el.removeAttribute('aria-label');
      }
    });
  }

  function resolveShareUnitPrice(modal) {
    if (!modal) {
      return 0;
    }
    const ds = modal.getAttribute('data-wdp-unit-price');
    let unit = ds ? Number.parseFloat(ds) : 0;
    if (!Number.isFinite(unit) || unit <= 0) {
      const productId = modal.getAttribute('data-product-id')
        || (modal.querySelector('input[name="wdp_product_id"]') && modal.querySelector('input[name="wdp_product_id"]').value);
      if (productId && productPrices && productPrices[productId]) {
        unit = Number.parseFloat(productPrices[productId]);
      }
    }
    return Number.isFinite(unit) && unit > 0 ? unit : 0;
  }

  function updateSharesTotalBar(modal) {
    if (!modal) {
      return;
    }
    const form = modal.querySelector('form.wdp-has-shareholders');
    if (!form) {
      return;
    }
    const bar = form.querySelector('.wdp-shares-total-bar');
    if (!bar) {
      return;
    }
    const countInput = form.querySelector('input[name="share_count"]');
    const count = countInput ? Math.max(1, Number.parseInt(countInput.value, 10) || 1) : 1;
    const valueEl = bar.querySelector('.wdp-shares-total-bar__value');
    if (!valueEl) {
      return;
    }
    const unit = resolveShareUnitPrice(modal);
    if (!unit) {
      bar.hidden = true;
      return;
    }
    valueEl.textContent = formatCurrency(unit * count);
    bar.hidden = count < 2;
  }

  function syncShareholderUnitPricesFromModal(modal) {
    if (!modal) return;
    const idInput = modal.querySelector('input[name="wdp_product_id"], input[name="add-to-cart"]');
    const id = idInput ? Number.parseInt(idInput.value, 10) : 0;
    let unit = 0;
    if (id && productPrices && Number.isFinite(Number(productPrices[id]))) {
      unit = Number(productPrices[id]);
    }
    if (!Number.isFinite(unit) || unit <= 0) {
      const ds = modal.getAttribute('data-wdp-unit-price');
      unit = ds ? Number.parseFloat(ds) : 0;
    }
    syncShareholderUnitPrices(modal, unit);
    updateSharesTotalBar(modal);
  }

  // Create shareholder form element
  function createShareholderForm(index) {
    const headerText = String(shareholderTexts.header || 'Hissedar Bilgileri');
    const namePlaceholder = String(shareholderTexts.name_placeholder || 'Ad Soyad *');
    const phonePlaceholder = String(shareholderTexts.phone_placeholder || 'Telefon Numarası *');
    const notePlaceholder = String(shareholderTexts.note_placeholder || 'Not (isteğe bağlı)');
    const emailPlaceholder = String(shareholderTexts.email_placeholder || 'E-posta (isteğe bağlı)');
    const copyButtonText = String(shareholderTexts.copy_button || '📋 Kopyasını Oluştur');
    const fieldGroupLabel = String(shareholderTexts.header || 'Hissedar Bilgileri');
    const safeIndex = Math.max(1, Number.parseInt(index, 10) || 1);

    const form = document.createElement("div");
    form.className = "wdp-shareholder-form";
    form.setAttribute("data-index", String(safeIndex));
    // Kart yoğunluğu (compact / normal / spacious)
    if (densityMode === 'compact') {
      form.classList.add('wdp-shareholder-density-compact');
    } else if (densityMode === 'spacious') {
      form.classList.add('wdp-shareholder-density-spacious');
    } else {
      form.classList.add('wdp-shareholder-density-normal');
    }

    // CRITICAL: Form'un görünürlüğünü garanti et
    form.style.display = '';
    form.style.visibility = 'visible';
    form.style.opacity = '1';

    // İlk form açık, diğerleri kapalı
    const isFirst = safeIndex === 1;
    if (!isFirst) {
      form.classList.add("collapsed");
    }

    const header = document.createElement('div');
    header.className = 'wdp-shareholder-header';
    const headerPrimary = document.createElement('div');
    headerPrimary.className = 'wdp-shareholder-header__primary';
    const title = document.createElement('h3');
    title.textContent = `${safeIndex}. ${headerText}`;
    const unitPrice = document.createElement('span');
    unitPrice.className = 'wdp-shareholder-unit-price wdp-unit-price-badge';
    unitPrice.setAttribute('aria-hidden', 'true');
    headerPrimary.appendChild(title);
    headerPrimary.appendChild(unitPrice);
    const headerIcon = document.createElement('span');
    headerIcon.className = 'wdp-shareholder-icon';
    header.appendChild(headerPrimary);
    header.appendChild(headerIcon);
    form.appendChild(header);

    const content = document.createElement('div');
    content.className = `wdp-shareholder-content ${layoutMode === 'two-column' ? 'wdp-shareholder-layout-two-column' : 'wdp-shareholder-layout-single'}`;
    if (!isFirst) {
      content.style.display = 'none';
    }
    const fieldStack = document.createElement('div');
    fieldStack.className = 'wdp-field-stack';
    fieldStack.setAttribute('role', 'group');
    fieldStack.setAttribute('aria-label', fieldGroupLabel);

    const nameRow = document.createElement('div');
    nameRow.className = 'wdp-field-stack__row wdp-field-stack__row--name';
    const userIcon = document.createElement('span');
    userIcon.className = 'wdp-field-stack__icon';
    userIcon.setAttribute('aria-hidden', 'true');
    userIcon.innerHTML = FS_ICON_USER;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'wdp-field-stack__input';
    nameInput.name = `shareholder_name_${safeIndex}`;
    nameInput.placeholder = namePlaceholder;
    nameInput.autocomplete = 'name';
    nameInput.required = true;
    nameRow.appendChild(userIcon);
    nameRow.appendChild(nameInput);
    fieldStack.appendChild(nameRow);

    const phoneRow = document.createElement('div');
    phoneRow.className = 'wdp-field-stack__row wdp-field-stack__row--phone';
    const phoneWrap = document.createElement('div');
    phoneWrap.className = 'wdp-field-stack__phone';
    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.createFieldElement === 'function') {
      phoneWrap.appendChild(
        WDPApp.phoneInput.createFieldElement({
          name: `shareholder_phone_${safeIndex}`,
          placeholder: phonePlaceholder,
          required: true,
        })
      );
    } else {
      const phoneInput = document.createElement('input');
      phoneInput.type = 'tel';
      phoneInput.className = 'wdp-field-stack__input';
      phoneInput.name = `shareholder_phone_${safeIndex}`;
      phoneInput.placeholder = phonePlaceholder;
      phoneInput.autocomplete = 'tel';
      phoneInput.required = true;
      phoneInput.setAttribute('inputmode', 'tel');
      phoneWrap.appendChild(phoneInput);
    }
    phoneRow.appendChild(phoneWrap);
    fieldStack.appendChild(phoneRow);

    if (enableEmailField) {
      const emailRow = document.createElement('div');
      emailRow.className = 'wdp-field-stack__row wdp-field-stack__row--email';
      const emailIcon = document.createElement('span');
      emailIcon.className = 'wdp-field-stack__icon';
      emailIcon.setAttribute('aria-hidden', 'true');
      emailIcon.innerHTML = FS_ICON_EMAIL;
      const emailInput = document.createElement('input');
      emailInput.type = 'email';
      emailInput.className = 'wdp-field-stack__input';
      emailInput.name = `shareholder_email_${safeIndex}`;
      emailInput.placeholder = emailPlaceholder;
      emailInput.autocomplete = 'email';
      emailRow.appendChild(emailIcon);
      emailRow.appendChild(emailInput);
      fieldStack.appendChild(emailRow);
    }

    const noteRow = document.createElement('div');
    noteRow.className = 'wdp-field-stack__row wdp-field-stack__row--textarea';
    const noteIcon = document.createElement('span');
    noteIcon.className = 'wdp-field-stack__icon';
    noteIcon.setAttribute('aria-hidden', 'true');
    noteIcon.innerHTML = FS_ICON_NOTE;
    const noteInput = document.createElement('textarea');
    noteInput.className = 'wdp-field-stack__textarea';
    noteInput.name = `shareholder_note_${safeIndex}`;
    noteInput.rows = 1;
    noteInput.placeholder = notePlaceholder;
    noteRow.appendChild(noteIcon);
    noteRow.appendChild(noteInput);
    fieldStack.appendChild(noteRow);

    content.appendChild(fieldStack);
    if (enableCopyButton) {
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'wdp-copy-form-btn';
      copyButton.textContent = copyButtonText;
      content.appendChild(copyButton);
    }
    form.appendChild(content);

    // Input'ları hemen aktif hale getir
    const createdNameInput = form.querySelector('input[type="text"]');
    const createdPhoneInput = form.querySelector('input[type="tel"]');
    
    if (createdNameInput) {
      createdNameInput.style.pointerEvents = 'auto';
      createdNameInput.style.opacity = '1';
      createdNameInput.style.visibility = 'visible';
      createdNameInput.removeAttribute('readonly');
      createdNameInput.removeAttribute('disabled');
    }
    
    if (createdPhoneInput) {
      createdPhoneInput.style.pointerEvents = 'auto';
      createdPhoneInput.style.opacity = '1';
      createdPhoneInput.style.visibility = 'visible';
      createdPhoneInput.removeAttribute('readonly');
      createdPhoneInput.removeAttribute('disabled');
    }

    attachGuidanceListeners(form);
    refreshShareholderGuidance(form.closest('.wdp-modal') || form.closest('.wdp-donation-form') || form);

    return form;
  }


  // Toggle shareholder form content
  function toggleShareholderForm(form) {
    if (!form) return;
    
    const content = form.querySelector('.wdp-shareholder-content');
    if (!content) return;
    
    const isCollapsed = form.classList.contains('collapsed');
    
    // CRITICAL: Accordion davranışı - bir form açıldığında diğer tüm formlar kapanmalı
    const shareholdersList = form.closest('.wdp-shareholders-scroll');
    if (shareholdersList && isCollapsed) {
      // Tüm formları kapat
      const allForms = shareholdersList.querySelectorAll('.wdp-shareholder-form');
      allForms.forEach((otherForm) => {
        if (otherForm !== form) {
          otherForm.classList.add('collapsed');
          const otherContent = otherForm.querySelector('.wdp-shareholder-content');
          if (otherContent) {
            otherContent.style.display = 'none';
          }
        }
      });
    }
    
    if (isCollapsed) {
      // Formu aç
      form.classList.remove('collapsed');
      content.style.display = 'flex';
      
      // Scroll container'ı bul ve scroll yap
      if (shareholdersList) {
        requestAnimationFrame(() => {
          form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    } else {
      // Formu kapat
      form.classList.add('collapsed');
      content.style.display = 'none';
    }
    
    // Badge'i güncelle
    const modal = form.closest('.wdp-modal') || form.closest('.wdp-donation-form');
    if (modal) {
      updateCollapsedFormsCount(modal);
    }
    
    // Kapalı form uyarısını kontrol et
    checkShareholderFormWarning(form);
    
    // Diğer formların uyarılarını da kontrol et (accordion davranışı nedeniyle)
    if (shareholdersList) {
      const allForms = shareholdersList.querySelectorAll('.wdp-shareholder-form');
      allForms.forEach(otherForm => {
        if (otherForm !== form) {
          checkShareholderFormWarning(otherForm);
        }
      });
    }
    const root = form.closest('.wdp-modal') || form.closest('.wdp-donation-form');
    if (root) {
      refreshShareholderGuidance(root);
    }
  }
  
  /** Satır içi uyarı rozeti kaldırıldı; eski DOM kalıntılarını temizler. */
  function checkShareholderFormWarning(form) {
    if (!form) return;
    const warningBadge = form.querySelector('.wdp-shareholder-warning');
    if (!warningBadge) return;
    warningBadge.classList.remove('show');
    warningBadge.textContent = '';
    warningBadge.removeAttribute('title');
    warningBadge.removeAttribute('aria-label');
    warningBadge.remove();
  }
  
  // Tüm kapalı formları kontrol et
  function checkAllShareholderFormWarnings(modal) {
    if (!modal) return;
    
    const shareholdersList = modal.querySelector('.wdp-shareholders-scroll') || 
                             modal.querySelector('.wdp-shareholders-container');
    if (!shareholdersList) return;
    
    const collapsedForms = shareholdersList.querySelectorAll('.wdp-shareholder-form.collapsed');
    collapsedForms.forEach(form => {
      checkShareholderFormWarning(form);
    });
    refreshShareholderGuidance(modal);
  }

  // Setup shareholder header click handler
  function setupShareholderHeaderClick(form) {
    const header = form.querySelector('.wdp-shareholder-header');
    if (!header) return;

    if (header.dataset.wdpHeaderClickBound === '1') {
      return;
    }
    header.dataset.wdpHeaderClickBound = '1';

    // Click event listener ekle
    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleShareholderForm(form);
    });
  }

  // Setup copy form button
  function setupCopyFormButton(form) {
    const nameInput = form.querySelector('input[type="text"]');
    const phoneInput = form.querySelector('input[type="tel"]');
    const copyBtn = form.querySelector('.wdp-copy-form-btn');

    if (!nameInput || !phoneInput || !copyBtn) return;

    const normalizedCopyBtn = form.querySelector('.wdp-copy-form-btn');
    normalizedCopyBtn.disabled = true;
    normalizedCopyBtn.classList.remove('is-active');
    normalizedCopyBtn.style.display = 'none';

    // Event listener'ları direkt ekle - clone işlemi yok
    const checkFields = () => {
      const nameValue = nameInput.value.trim();
      const phoneValue = phoneInput.value.trim();
      
      const isReady = Boolean(nameValue && phoneValue);
      normalizedCopyBtn.disabled = !isReady;
      normalizedCopyBtn.classList.toggle('is-active', isReady);
      normalizedCopyBtn.style.display = isReady ? 'inline-flex' : 'none';
      normalizedCopyBtn.style.opacity = isReady ? '1' : '0';
      normalizedCopyBtn.style.pointerEvents = isReady ? 'auto' : 'none';
      const root = form.closest('.wdp-modal') || form.closest('.wdp-donation-form');
      if (root) {
        refreshShareholderGuidance(root);
      }
    };

    // Event listener'ları bir kez ekle
    if (nameInput.dataset.wdpCopyWatcherBound !== '1') {
      nameInput.dataset.wdpCopyWatcherBound = '1';
      nameInput.addEventListener('input', checkFields);
    }
    if (phoneInput.dataset.wdpCopyWatcherBound !== '1') {
      phoneInput.dataset.wdpCopyWatcherBound = '1';
      phoneInput.addEventListener('input', checkFields);
    }

    // Sayfa yüklendiğinde mevcut değerleri kontrol et
    checkFields();

    // Kopyasını oluştur butonuna tıklama
    if (normalizedCopyBtn.dataset.wdpCopyClickBound !== '1') {
      normalizedCopyBtn.dataset.wdpCopyClickBound = '1';
      normalizedCopyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Mevcut form verilerini al
        const nameValue = nameInput.value.trim();
        const phoneValue = WDPApp.phoneInput && typeof WDPApp.phoneInput.getValueForCopy === 'function'
          ? WDPApp.phoneInput.getValueForCopy(phoneInput)
          : phoneInput.value.trim();
        const noteEl = getShareholderNoteTextarea(form);
        const noteValue = noteEl ? noteEl.value.trim() : '';
        
        if (!nameValue || !phoneValue) {
          return;
        }
        
        // Yeni form oluştur
        duplicateShareholderForm(form, nameValue, phoneValue, noteValue);
      });
    }
  }

  // Duplicate shareholder form
  function duplicateShareholderForm(originalForm, nameValue, phoneValue, noteValue) {
    const container = originalForm.closest('.wdp-shareholders-container');
    const list = ensureShareholderList(container);
    if (!list) return;

    // Mevcut form sayısını bul
    const existingForms = list.querySelectorAll('.wdp-shareholder-form');
    const currentCount = existingForms.length;
    
    // Maksimum 7 hisse kontrolü
    if (currentCount >= 7) {
      safeLog('Maksimum hisse sayısına ulaşıldı (7)');
      return;
    }

    const newIndex = currentCount + 1;

    // Yeni form oluştur
    const newForm = createShareholderForm(newIndex);
    
    // Form verilerini doldur
    const newNameInput = newForm.querySelector('input[type="text"]');
    const newPhoneInput = newForm.querySelector('input[type="tel"]');
    const newNoteTextarea = getShareholderNoteTextarea(newForm);
    
    if (newNameInput) newNameInput.value = nameValue;

    // Yeni formu listeye ekle
    list.appendChild(newForm);
    setupCopyFormButton(newForm);
    setupShareholderHeaderClick(newForm);
    syncShareholderUnitPricesFromModal(container.closest('.wdp-modal') || container.closest('.wdp-donation-form'));

    const newCopyBtn = newForm.querySelector('.wdp-copy-form-btn');
    if (newCopyBtn) {
      newCopyBtn.disabled = false;
      newCopyBtn.classList.add('is-active');
    }

    setupWdpPhoneFields(newForm);
    if (newPhoneInput && phoneValue && WDPApp.phoneInput && typeof WDPApp.phoneInput.applyPastedNumber === 'function') {
      WDPApp.phoneInput.applyPastedNumber(newPhoneInput, phoneValue);
    }
    if (newNoteTextarea) newNoteTextarea.value = noteValue;

    // CRITICAL: Context root'u bir kez al (gereksiz tekrarı önle)
    const contextRoot = container.closest('.wdp-modal') || container.closest('.wdp-donation-form');
    
    // CRITICAL: Tüm hissedar form yapısını görünür yap
    const sharesSection = container.closest('.wdp-shares-section');
    if (sharesSection) {
      sharesSection.style.display = 'flex';
      sharesSection.style.flexDirection = 'column';
      sharesSection.style.visibility = 'visible';
      sharesSection.style.opacity = '1';
      sharesSection.removeAttribute('hidden');
    }
    
    const sharesHeader = sharesSection ? sharesSection.querySelector('.wdp-shares-header') : null;
    if (sharesHeader) {
      sharesHeader.style.display = 'grid';
      sharesHeader.style.visibility = 'visible';
      sharesHeader.style.opacity = '1';
      sharesHeader.removeAttribute('hidden');
    }
    
    // CRITICAL: Share counter görünürlüğünü garanti et
    const shareCounter = sharesSection ? sharesSection.querySelector('.wdp-share-counter') : (contextRoot ? contextRoot.querySelector('.wdp-share-counter') : null);
    if (shareCounter) {
      shareCounter.style.display = 'flex';
      shareCounter.style.visibility = 'visible';
      shareCounter.style.opacity = '1';
      shareCounter.removeAttribute('hidden');
      const shareCountInputInCounter = shareCounter.querySelector('input[name="share_count"]');
      if (shareCountInputInCounter) {
        shareCountInputInCounter.style.visibility = 'visible';
        shareCountInputInCounter.style.opacity = '1';
        shareCountInputInCounter.style.color = '#1f2937';
        shareCountInputInCounter.style.display = 'block';
        shareCountInputInCounter.removeAttribute('hidden');
        // CRITICAL: Input değerinin görünür olmasını garanti et (WebKit için)
        shareCountInputInCounter.style.webkitTextFillColor = '#1f2937';
      }
    }
    
    // CRITICAL: Shareholders area görünürlüğünü garanti et
    const shareholdersArea = container.closest('.wdp-shareholders-area');
    if (shareholdersArea) {
      applyShareholdersAreaVisibility(shareholdersArea);
    }
    
    // CRITICAL: Container ve list görünürlüğünü garanti et
    if (container) {
      applyShareholdersContainerVisibility(container);
    }
    
    if (list) {
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.visibility = 'visible';
      list.style.opacity = '1';
      list.removeAttribute('hidden');
    }
    
    /* Kaynak hissedar kartı kullanıcı verisini saklamalı: kopyalayınca orijinali kapatmak alanların
       "silindiği" hissini veriyordu. Orijinal (ve diğer) formları çökertme; içerik display:none atanmasın.
       Accordion gerekiyorsa kullanıcı başlıktan kolayca daraltır — kopyadan sonra tek açılmayı yeni karta verdik. */
    const clearInlineContentVisibility = (formEl) => {
      const c = formEl && formEl.querySelector('.wdp-shareholder-content');
      if (!c) return;
      c.style.display = '';
      c.style.visibility = '';
      c.style.opacity = '';
    };

    clearInlineContentVisibility(originalForm);

    originalForm.classList.remove('collapsed');

    /* Diğer kartlar: yeni kopyanın odak kaydı olması için accordion hissi korunur ancak görünür inline gizlemeler sıfırlanır */
    const allForms = list.querySelectorAll('.wdp-shareholder-form');
    allForms.forEach((form) => {
      clearInlineContentVisibility(form);
      if (form === newForm) {
        return;
      }
      if (form === originalForm) {
        form.classList.remove('collapsed');
        return;
      }
      form.classList.add('collapsed');
      const content = form.querySelector('.wdp-shareholder-content');
      if (content && form.classList.contains('collapsed')) {
        content.style.display = 'none';
      }
    });
    
    // CRITICAL: Yeni formu kesinlikle aç
    newForm.classList.remove('collapsed');
    const newContent = newForm.querySelector('.wdp-shareholder-content');
    if (newContent) {
      newContent.style.display = 'flex';
      newContent.style.visibility = 'visible';
      newContent.style.opacity = '1';
    }
    // Form görünürlüğünü garanti et
    newForm.style.display = '';
    newForm.style.visibility = 'visible';
    newForm.style.opacity = '1';
    newForm.removeAttribute('hidden');
    
    // CRITICAL: Hisse adedini güncelle
    safeLog(`Kopyalama sonrası hisse adedi güncelleniyor: ${newIndex}`);
    
    // CRITICAL: Tüm share_count input'larını güncelle ve görünür yap
    const allShareCountInputs = contextRoot ? contextRoot.querySelectorAll('input[name="share_count"]') : document.querySelectorAll('input[name="share_count"]');
    allShareCountInputs.forEach(input => {
      input.value = newIndex;
      // CRITICAL: Input görünürlüğünü garanti et
      input.style.visibility = 'visible';
      input.style.opacity = '1';
      input.style.color = '#1f2937';
      input.style.display = 'block';
      input.style.webkitTextFillColor = '#1f2937';
      input.removeAttribute('hidden');
      // CRITICAL: Parent container'ı da görünür yap
      const parentCounter = input.closest('.wdp-share-counter');
      if (parentCounter) {
        parentCounter.style.display = 'flex';
        parentCounter.style.visibility = 'visible';
        parentCounter.style.opacity = '1';
        parentCounter.removeAttribute('hidden');
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    // Quantity input'unu güncelle
    const quantityInput = contextRoot ? contextRoot.querySelector('input[name="quantity"]') : null;
    if (quantityInput) {
      quantityInput.value = newIndex;
    }
    
    // Fiyat hesaplamasını yap
    const priceInput = contextRoot ? contextRoot.querySelector('input[name="custom_price"]') : null;
    if (priceInput && priceInput.value) {
      const currentPrice = parseFloat(priceInput.value) || 0;
      // CRITICAL: Mevcut hisse sayısını kullan (currentCount değil, mevcut share_count değeri)
      const currentShareCount = currentCount > 0 ? currentCount : 1;
      const basePrice = currentShareCount > 0 ? currentPrice / currentShareCount : currentPrice;
      const totalPrice = basePrice * newIndex;
      priceInput.value = totalPrice.toFixed(0);
      safeLog(`Fiyat güncellendi: ${totalPrice} TL (${basePrice} TL x ${newIndex} hisse)`);
    }
    
    // Scrollable durumunu güncelle
    updateShareholdersScrollable(contextRoot);
    
    // Badge'i güncelle
    if (contextRoot && list) {
      updateCollapsedFormsCount(contextRoot);
    }
    
    // CRITICAL: Son bir kez daha kontrol et ve garanti et
    requestAnimationFrame(() => {
      originalForm.classList.remove('collapsed');
      clearInlineContentVisibility(originalForm);
      const origContent = originalForm.querySelector('.wdp-shareholder-content');
      if (origContent) {
        origContent.style.display = '';
      }

      newForm.classList.remove('collapsed');
      const newCont = newForm.querySelector('.wdp-shareholder-content');
      if (newCont) {
        newCont.style.display = 'flex';
        newCont.style.visibility = 'visible';
        newCont.style.opacity = '1';
      }

      try {
        newForm.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      } catch (e) {
        newForm.scrollIntoView(false);
      }
      safeLog(`Hissedar formu kopyalandı: ${newIndex}. Hissedar (açık olarak), ${currentCount}. Hissedar (kapalı)`);
      if (contextRoot) {
        refreshShareholderGuidance(contextRoot);
      }
    });
  }

  // Helper: Check if a form is filled (has name and phone)
  function isFormFilled(form) {
    if (!form) return false;
    const nameInput = form.querySelector('input[name^="shareholder_name_"]');
    const phoneInput = form.querySelector('input[name^="shareholder_phone_"]');
    const nameValue = nameInput ? nameInput.value.trim() : '';
    const phoneValue = phoneInput ? phoneInput.value.trim() : '';
    return nameValue.length > 0 && phoneValue.length > 0;
  }

  // Update shareholder forms (internal function used by setupShareQuantityButtons)
  function updateShareholderFormsInternal(modal) {
    // ✅ GÜVENLİ: Fonksiyon scope içinde helper (fonksiyon bitince otomatik temizlenir)
    const $modal = (sel) => modal.querySelector(sel);
    
    // Güncel share count input'unu bul
    const currentShareCountInput = $modal('input[name="share_count"]');
    if (!currentShareCountInput) return;
    const shareCount = Number.parseInt(currentShareCountInput.value, 10) || 1;
    safeLog("Updating shareholder forms for count:", shareCount);

    // Maksimum 7 hissedar kontrolü
    if (shareCount > 7) {
      currentShareCountInput.value = 7;
      return updateShareholderFormsInternal(modal);
    }

    // Hissedar formları konteynerini bul
    const shareholdersContainer = $modal(".wdp-shareholders-container");
    if (!shareholdersContainer) return;
    const shareholdersList = ensureShareholderList(shareholdersContainer);
    if (!shareholdersList) return;

    // Mevcut form sayısını kontrol et
    const existingForms = shareholdersList.querySelectorAll(".wdp-shareholder-form");
    const existingCount = existingForms.length;
    safeLog("Existing forms:", existingCount, "New count:", shareCount);

    // CRITICAL: Container'ların görünürlüğünü garanti et
    shareholdersContainer.style.visibility = 'visible';
    shareholdersContainer.style.opacity = '1';
    shareholdersList.style.display = '';
    shareholdersList.style.visibility = 'visible';
    shareholdersList.style.opacity = '1';
    applyShareholdersContainerVisibility(shareholdersContainer);
    
    const shareholdersArea = shareholdersContainer.closest('.wdp-shareholders-area');
    if (shareholdersArea) {
      applyShareholdersAreaVisibility(shareholdersArea);
    }
    
    // CRITICAL: Yeni formlar eklenirken mevcut formların durumunu kontrol et
    if (shareCount > existingCount) {
      // Mevcut formların dolu olup olmadığını kontrol et
      let allPreviousFormsFilled = true;
      for (let i = 0; i < existingCount; i++) {
        const form = existingForms[i];
        if (!isFormFilled(form)) {
          allPreviousFormsFilled = false;
          break;
        }
      }
      
      // Yeni formlar ekle
      for (let i = existingCount + 1; i <= shareCount; i++) {
        const newForm = createShareholderForm(i);
        // Yeni formlar başlangıçta kapalı olacak, accordion mantığında açılacak
        newForm.style.display = '';
        newForm.style.visibility = 'visible';
        newForm.style.opacity = '1';
        newForm.classList.add('collapsed');
        const content = newForm.querySelector('.wdp-shareholder-content');
        if (content) {
          content.style.display = 'none';
        }
        shareholdersList.appendChild(newForm);
        
        // Yeni form için event listener'ları ekle
        setupCopyFormButton(newForm);
        setupShareholderHeaderClick(newForm);
        checkShareholderFormWarning(newForm);
      }

      setupWdpPhoneFields(shareholdersList);
      
      // Eğer önceki formlar doluysa, mevcut açık formları kapat
      if (allPreviousFormsFilled) {
        existingForms.forEach((form) => {
          form.classList.add('collapsed');
          const content = form.querySelector('.wdp-shareholder-content');
          if (content) {
            content.style.display = 'none';
          }
        });
      }
    } else if (shareCount < existingCount) {
      // Fazla formları kaldır
      const formsToRemove = existingForms.length - shareCount;
      for (let i = 0; i < formsToRemove; i++) {
        const lastForm = existingForms[existingForms.length - 1 - i];
        if (lastForm && lastForm.parentNode) {
          lastForm.parentNode.removeChild(lastForm);
        }
      }
      if (WDPApp.phoneInput && typeof WDPApp.phoneInput.refreshInRoot === 'function') {
        WDPApp.phoneInput.refreshInRoot(shareholdersList);
      }
    }
    
    // CRITICAL: Form açık/kapalı durumunu belirle - accordion mantığı ile
    // Mantık:
    // 1. Accordion: Bir form açıksa diğerleri kapalı olmalı
    // 2. Dolu formlar otomatik açılmamalı (kullanıcı açarsa açılır)
    // 3. Yeni form eklendiğinde, eğer önceki formlar doluysa yeni form açık olmalı
    // 4. Eğer önceki formlar boşsa, ilk boş form açık kalmalı
    const allForms = shareholdersList.querySelectorAll('.wdp-shareholder-form');
    
    // Önce tüm formların durumunu kontrol et
    let firstEmptyFormIndex = null;
    let allFormsBeforeNewAreFilled = true;
    let currentlyOpenFormIndex = null;
    let wasNewFormAdded = shareCount > existingCount;
    
    // Yeni form eklenmeden önceki formların dolu olup olmadığını kontrol et
    if (wasNewFormAdded) {
      for (let i = 0; i < existingCount; i++) {
        const form = existingForms[i];
        if (!isFormFilled(form)) {
          allFormsBeforeNewAreFilled = false;
          break;
        }
      }
    }
    
    allForms.forEach((form) => {
      const formIndex = parseInt(form.getAttribute('data-index'), 10);
      const isFilled = isFormFilled(form);
      const wasOpen = !form.classList.contains('collapsed');
      
      // Şu anda açık olan formu bul (ama sadece yeni form eklenmeden önce açık olanlar)
      // Yeni form eklenirse, önceki açık formu görmezden gel
      if (wasOpen && formIndex <= shareCount && (!wasNewFormAdded || formIndex <= existingCount)) {
        // Yeni form eklenmediyse veya bu form yeni eklenen formlardan önceki bir form ise
        currentlyOpenFormIndex = formIndex;
      }
      
      // İlk boş formu bul
      if (firstEmptyFormIndex === null && !isFilled && formIndex <= shareCount) {
        firstEmptyFormIndex = formIndex;
      }
      
      // Yeni eklenen formlardan önceki formların dolu olup olmadığını kontrol et
      if (formIndex < shareCount && !isFilled) {
        allFormsBeforeNewAreFilled = false;
      }
    });
    
    // Hangi formun açık olması gerektiğini belirle
    let formToOpenIndex = null;
    
    // Eğer yeni form eklendiyse ve önceki formlar doluysa, yeni form açık olmalı
    if (wasNewFormAdded && allFormsBeforeNewAreFilled) {
      formToOpenIndex = shareCount; // Yeni eklenen form (en son eklenen)
    } 
    // Eğer şu anda açık bir form varsa ve o form hala geçerliyse, onu açık tut
    else if (currentlyOpenFormIndex !== null && currentlyOpenFormIndex <= shareCount) {
      formToOpenIndex = currentlyOpenFormIndex;
    }
    // Eğer hiç açık form yoksa, ilk boş formu veya 1. formu aç
    else {
      formToOpenIndex = firstEmptyFormIndex !== null ? firstEmptyFormIndex : 1;
    }
    
    // Şimdi formların açık/kapalı durumunu belirle (accordion mantığı)
    let formToScrollTo = null;
    allForms.forEach((form) => {
      const formIndex = parseInt(form.getAttribute('data-index'), 10);
      
      // Form görünürlüğünü garanti et
      form.style.display = '';
      form.style.visibility = 'visible';
      form.style.opacity = '1';
      
      // Sadece belirlenen form açık olmalı (accordion mantığı)
      if (formIndex === formToOpenIndex && formIndex <= shareCount) {
        form.classList.remove('collapsed');
        const content = form.querySelector('.wdp-shareholder-content');
        if (content) {
          content.style.display = 'flex';
          content.style.visibility = 'visible';
          content.style.opacity = '1';
        }
        // Yeni açılan formu scroll için işaretle
        formToScrollTo = form;
      } else {
        form.classList.add('collapsed');
        const content = form.querySelector('.wdp-shareholder-content');
        if (content) {
          content.style.display = 'none';
        }
      }
    });
    
    // Yeni açılan formu görünür alana scroll et
    if (formToScrollTo) {
      requestAnimationFrame(() => {
        // CRITICAL: Önce scroll pozisyonunu sıfırla (beyaz alan sorununu önlemek için)
        if (shareholdersList.scrollTop > 0) {
          shareholdersList.scrollTop = 0;
        }
        formToScrollTo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } else {
      // Eğer scroll edilecek form yoksa, scroll pozisyonunu sıfırla
      requestAnimationFrame(() => {
        if (shareholdersList && shareholdersList.scrollTop > 0) {
          shareholdersList.scrollTop = 0;
        }
      });
    }

    // Copy button ve header click event listener'larını ekle
    const allFormsForCopy = shareholdersList.querySelectorAll('.wdp-shareholder-form');
    allFormsForCopy.forEach((form) => {
      setupCopyFormButton(form);
      setupShareholderHeaderClick(form);
      checkShareholderFormWarning(form);
    });

    syncShareholderUnitPricesFromModal(modal);
    
    // CRITICAL: Update scrollable class immediately - BEFORE browser renders
    // This prevents modal expansion by applying height constraints instantly
    // shareholdersArea'yı yukarıda zaten tanımladık, tekrar tanımlamaya gerek yok
    if (!isSidePanelModal(modal) && shareholdersArea && shareCount > 1) {
      // Immediately add scrollable class before updateShareholdersScrollable
      shareholdersArea.classList.add('scrollable');
      shareholdersContainer.classList.add('scrollable');
    } else if (shareholdersArea && shareCount <= 1) {
      // Remove scrollable class when count is 1
      shareholdersArea.classList.remove('scrollable');
      shareholdersContainer.classList.remove('scrollable');
      // CRITICAL: ShareCount 1'e düştüğünde container'ların görünürlüğünü garanti et
      applyShareholdersAreaVisibility(shareholdersArea);
      applyShareholdersContainerVisibility(shareholdersContainer);
      shareholdersList.style.display = '';
      shareholdersList.style.visibility = 'visible';
      shareholdersList.style.opacity = '1';
    }
    
    // Then update scrollable state (this will clean up and ensure consistency)
    updateShareholdersScrollable(modal);
    
    // CRITICAL: Fiyatı güncelle (hisse adedi değiştiğinde)
    // updatePriceBasedOnShareCount fonksiyonu setupShareQuantityButtons scope'unda tanımlı
    if (typeof updatePriceBasedOnShareCount === 'function') {
      updatePriceBasedOnShareCount();
    }
    refreshShareholderGuidance(modal);
  }

  // Setup share quantity buttons
  function setupShareQuantityButtons(modal, shareCountInput, baseProductPrice, priceInput) {
    // ✅ GÜVENLİ: Fonksiyon scope içinde helper (fonksiyon bitince otomatik temizlenir)
    const $modal = (sel) => modal.querySelector(sel);
    
    safeLog("Setting up share quantity buttons for modal:", modal.id);
    
    // Hisse adedi artırma/azaltma butonlarını bul
    const decreaseBtn = $modal(".wdp-share-btn.wdp-share-btn-decrease");
    const increaseBtn = $modal(".wdp-share-btn.wdp-share-btn-increase");

    // Quantity input'unu bul
    const quantityInput = $modal('input[name="quantity"]');
    
    safeLog("Found buttons:", {
      decreaseBtn: !!decreaseBtn,
      increaseBtn: !!increaseBtn,
      quantityInput: !!quantityInput
    });

    // Input değişikliğini dinle
    let activeShareCountInput =
      shareCountInput && shareCountInput.parentNode
        ? shareCountInput
        : $modal('input[name="share_count"]');
    if (!activeShareCountInput) {
      safeLog("Share count input not found for setupShareQuantityButtons");
      return;
    }

    const updatedShareCountInput = activeShareCountInput;
    const handlerBag = modal._wdpShareHandlers || (modal._wdpShareHandlers = {});
    
    // Hisse adedini güncelleme fonksiyonu
    function updateShareCount(newValue) {
      safeLog("Updating share count to:", newValue);
      
      // Input değerini güncelle
      if (updatedShareCountInput) {
        updatedShareCountInput.value = newValue;
        // Event'leri tetikle
        updatedShareCountInput.dispatchEvent(new Event('input', { bubbles: true }));
        updatedShareCountInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Quantity değerini güncelle
      if (quantityInput) {
        quantityInput.value = newValue;
        safeLog("Quantity updated to:", newValue);
      }
      
      // Formları güncelle
      updateShareholderFormsInternal(modal);
      updatePriceBasedOnShareCount();
      updateSharesTotalBar(modal);
    }
    
    // Decrease butonu event listener'ı
    if (decreaseBtn) {
      if (handlerBag.decreaseMousedown) {
        decreaseBtn.removeEventListener("mousedown", handlerBag.decreaseMousedown);
      }
      handlerBag.decreaseMousedown = () => {
        const sharesSection = modal.querySelector('.wdp-shares-section');
        if (sharesSection) {
          sharesSection.classList.add('wdp-quantity-active');
          setTimeout(() => {
            sharesSection.classList.remove('wdp-quantity-active');
          }, 200);
        }
      };
      decreaseBtn.addEventListener("mousedown", handlerBag.decreaseMousedown);

      if (handlerBag.decreaseClick) {
        decreaseBtn.removeEventListener("click", handlerBag.decreaseClick);
      }
      handlerBag.decreaseClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeLog("Decrease button clicked");
        const currentValue = Number.parseInt(updatedShareCountInput.value, 10) || 1;
        if (currentValue > 1) {
          const newValue = currentValue - 1;
          updateShareCount(newValue);
        }
      };
      decreaseBtn.addEventListener("click", handlerBag.decreaseClick);
    }

    // Increase butonu event listener'ı
    if (increaseBtn) {
      if (handlerBag.increaseMousedown) {
        increaseBtn.removeEventListener("mousedown", handlerBag.increaseMousedown);
      }
      handlerBag.increaseMousedown = () => {
        const sharesSection = modal.querySelector('.wdp-shares-section');
        if (sharesSection) {
          sharesSection.classList.add('wdp-quantity-active');
          setTimeout(() => {
            sharesSection.classList.remove('wdp-quantity-active');
          }, 200);
        }
      };
      increaseBtn.addEventListener("mousedown", handlerBag.increaseMousedown);

      if (handlerBag.increaseClick) {
        increaseBtn.removeEventListener("click", handlerBag.increaseClick);
      }
      handlerBag.increaseClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeLog("Increase button clicked");
        const currentValue = Number.parseInt(updatedShareCountInput.value, 10) || 1;
        if (currentValue < 7) {
          const newValue = currentValue + 1;
          updateShareCount(newValue);
        }
      };
      increaseBtn.addEventListener("click", handlerBag.increaseClick);
    }
    
    // Input değişikliği event listener'ı
    if (updatedShareCountInput) {
      if (handlerBag.shareInput) {
        updatedShareCountInput.removeEventListener("input", handlerBag.shareInput);
      }
      handlerBag.shareInput = function () {
        let currentValue = Number.parseInt(this.value, 10) || 1;
        
        // Sınırları kontrol et
        if (currentValue > 7) {
          currentValue = 7;
          this.value = currentValue;
        } else if (currentValue < 1) {
          currentValue = 1;
          this.value = currentValue;
        }

        // Quantity değerini de güncelle
        if (quantityInput) {
          quantityInput.value = currentValue;
          safeLog("Quantity updated to:", currentValue);
        }

        // Değişiklikleri güvenli bir şekilde uygula
        updateShareholderFormsInternal(modal);
        updatePriceBasedOnShareCount();
      };
      updatedShareCountInput.addEventListener("input", handlerBag.shareInput);
    }

    // Copy button event listener'larını ekle
    const allFormsForCopy = document.querySelectorAll(".wdp-shareholder-form");
    allFormsForCopy.forEach((form) => {
      setupCopyFormButton(form);
    });

    // Hisse adedine göre fiyatı güncelle
    function updatePriceBasedOnShareCount() {
      if (!priceInput) return;

      // Güncel hisse adedini al (fonksiyon scope içindeki $modal helper kullan)
      const currentShareCountInput = $modal('input[name="share_count"]');
      if (!currentShareCountInput) return;
      const shareCount = Number.parseInt(currentShareCountInput.value, 10) || 1;

      // Base price'ı al - önce dataset'ten, sonra baseProductPrice'tan, sonra mevcut fiyattan
      const baseMinValue = Number.parseFloat((priceInput.dataset.baseMin || '').toString().trim());
      let currentBasePrice = baseProductPrice;
      
      // Eğer baseProductPrice 0 veya geçersizse, dataset'ten veya mevcut fiyattan al
      if (!Number.isFinite(currentBasePrice) || currentBasePrice <= 0) {
        if (Number.isFinite(baseMinValue) && baseMinValue > 0) {
          currentBasePrice = baseMinValue;
        } else {
          // Mevcut fiyatı hisse sayısına bölerek base price'ı hesapla
          const currentPriceValue = Number.parseFloat((priceInput.value || '').toString().trim());
          if (Number.isFinite(currentPriceValue) && currentPriceValue > 0 && shareCount > 0) {
            currentBasePrice = currentPriceValue / shareCount;
          } else {
            currentBasePrice = 0;
          }
        }
      }

      const perShareFallback = Number.isFinite(currentBasePrice) && currentBasePrice > 0
        ? currentBasePrice
        : (Number.isFinite(baseMinValue) && baseMinValue > 0 ? baseMinValue : 0);

      const effectiveMin = Number.isFinite(perShareFallback) && perShareFallback > 0
        ? perShareFallback * shareCount
        : 0;

      let totalPrice = Number.parseFloat((currentBasePrice || 0).toString()) * shareCount;

      if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
        totalPrice = effectiveMin;
      }

      if (effectiveMin > 0 && (!Number.isFinite(totalPrice) || totalPrice < effectiveMin)) {
        totalPrice = effectiveMin;
      }

      safeLog("Fiyat güncelleniyor:", currentBasePrice, "x", shareCount, "=", totalPrice, "(min:", effectiveMin, ", baseProductPrice:", baseProductPrice, ")");

      if (effectiveMin > 0) {
        priceInput.setAttribute('min', effectiveMin.toFixed(2));
        priceInput.dataset.minTotal = effectiveMin.toString();
        if (!priceInput.placeholder || priceInput.placeholder.toLowerCase().startsWith('min')) {
          priceInput.placeholder = `Min: ${formatCurrency(effectiveMin)}`;
        }
      }

      if (Number.isFinite(totalPrice) && totalPrice > 0) {
        const roundedValue = Number.parseFloat(totalPrice.toFixed(2));
        priceInput.value = Number.isInteger(roundedValue)
          ? roundedValue.toFixed(0)
          : roundedValue.toFixed(2);
      }

      // Quantity input'unu da hisse sayısına göre güncelle
      if (quantityInput) {
        quantityInput.value = shareCount;
        safeLog("Final quantity update:", shareCount);
      }
    }

    // Başlangıç değerlerini ayarla (fonksiyon scope içindeki $modal helper kullan)
    const currentShareCountInput = $modal('input[name="share_count"]');
    if (!currentShareCountInput) return;
    const initialShareCount = Number.parseInt(currentShareCountInput.value, 10) || 1;
    if (quantityInput) {
      quantityInput.value = initialShareCount;
      safeLog("Initial quantity set to:", initialShareCount);
    }
    
    // Başlangıç fiyatını ayarla
    updatePriceBasedOnShareCount();
    
    // Global fonksiyon olarak kaydet - kopyalama fonksiyonu için
    window.updateShareCountForModal = updateShareCount;
  }

  // Setup shareholder forms
  async function setupShareholderForms(modal, productId) {
    try {
      safeLog("setupShareholderForms called with modal:", modal?.id || modal?.className, "productId:", productId);
      
      // Setup shareholder forms
      
      // Ürün ID'sini integer'a çevir
      productId = Number.parseInt(productId, 10);

      // Hisse adedi input'unu bul - DOM query caching kullan
      const $modal = (sel) => modal.querySelector(sel);
      const shareCountInput = $modal('input[name="share_count"]');
      if (!shareCountInput) {
        safeLog("ERROR: Share count input not found in modal:", modal.id || modal.className);
        return;
      }
      safeLog("Share count input found:", shareCountInput);

      const hostForm =
        typeof modal.matches === 'function' && modal.matches('form')
          ? modal
          : modal.querySelector('form');
      if (hostForm) {
        hostForm.classList.add('wdp-has-shareholders');
      }

      // Hissedar formları konteynerini bul - Eğer bulunamazsa bir kez daha dene
      // DOM query caching kullan (üstte tanımlı $modal)
      let shareholdersContainer = $modal(".wdp-shareholders-container");
      if (!shareholdersContainer) {
        // Biraz bekle ve tekrar dene (DOM henüz hazır olmayabilir)
        const constants = WDPApp.constants || {};
        const timing = constants.TIMING || {};
        const domCheckDelay = timing.DOM_CHECK_DELAY || 50;
        await new Promise(resolve => setTimeout(resolve, domCheckDelay));
        shareholdersContainer = $modal(".wdp-shareholders-container");
        if (!shareholdersContainer) {
          safeLog("ERROR: Shareholders container not found in modal/form after retry:", modal.id || modal.className);
          return;
        }
      }
      
      // CRITICAL: Tüm container'ları görünür yap - önce en üst seviyeden başla
      const sharesSection = shareholdersContainer.closest('.wdp-shares-section');
      if (sharesSection) {
        ensureVisible(sharesSection, 'flex');
        sharesSection.style.flexDirection = 'column';
        safeLog("Shares section made visible with flex display");
      }
      
      const sharesHeader = $modal('.wdp-shares-header');
      if (sharesHeader) {
        ensureVisible(sharesHeader, 'grid');
        safeLog("Shares header made visible with grid display");
      }
      
      // CRITICAL: Share counter input'unu görünür yap ve değeri göster
      const shareCounter = $modal('.wdp-share-counter');
      if (shareCounter) {
        ensureVisible(shareCounter, 'flex');
        const shareCountInputInCounter = shareCounter.querySelector('input[name="share_count"]');
        if (shareCountInputInCounter) {
          // CRITICAL: Input değerinin görünür olmasını garanti et
          ensureReadableInput(shareCountInputInCounter);
          safeLog("Share counter input made visible");
        }
      }
      
      // Hissedar alanını da görünür yap
      const shareholdersArea = shareholdersContainer.closest('.wdp-shareholders-area');
      if (shareholdersArea) {
        applyShareholdersAreaVisibility(shareholdersArea);
        safeLog("Shareholders area made visible");
      }
      
      removeShareholderOverview(modal);
      // Container'ı görünür yap (rail varken grid; yoksa flex sütunu)
      applyShareholdersContainerVisibility(shareholdersContainer);
      safeLog("Shareholders container made visible");
      
      // Hissedar listesini oluştur veya bul
      const shareholdersList = ensureShareholderList(shareholdersContainer);
      if (!shareholdersList) {
        safeLog("ERROR: Could not ensure shareholder list in container");
        return;
      }
      
      // CRITICAL: Shareholders list'i görünür yap
      ensureVisible(shareholdersList, 'flex');
      shareholdersList.style.flexDirection = 'column';
      safeLog("Shareholders list made visible");

      // Başlangıç değerini 1 olarak ayarla ve event'leri tetikle
      shareCountInput.value = "1";
      // CRITICAL: Input görünürlüğünü garanti et
      ensureReadableInput(shareCountInput);
      shareCountInput.dispatchEvent(new Event('input', { bubbles: true }));
      shareCountInput.dispatchEvent(new Event('change', { bubbles: true }));
      safeLog("Initial share count set to 1");

      // Mevcut içeriği temizle
      shareholdersList.innerHTML = "";

      // İlk hissedar formunu hemen oluştur
      const firstForm = createShareholderForm(1);
      if (firstForm) {
        shareholdersList.appendChild(firstForm);
        safeLog("First shareholder form created and appended to DOM");
        
        // Form görünürlüğünü garanti et
        ensureVisible(firstForm);
        firstForm.style.position = 'relative';
        safeLog("First form visibility set");
        
        // Form header'ı görünür yap
        const header = firstForm.querySelector('.wdp-shareholder-header');
        if (header) {
          ensureVisible(header);
          safeLog("First form header made visible");
        }
        
        const content = firstForm.querySelector('.wdp-shareholder-content');
        if (content) {
          ensureVisible(content, 'flex');
          safeLog("First form content made visible with flex display");
          
          // Input'ları da görünür yap
          const inputs = content.querySelectorAll('input, textarea, button');
          inputs.forEach((input, idx) => {
            ensureVisible(input);
            safeLog(`Input ${idx + 1} made visible:`, input.name || input.type);
          });
        } else {
          safeLog("ERROR: First form content not found");
        }
      } else {
        safeLog("ERROR: Failed to create first shareholder form");
        return;
      }
      
      cacheShareholdersBaseHeight(shareholdersContainer);

      // Hemen copy button ve header click event listener'larını ekle
      setupCopyFormButton(firstForm);
      setupShareholderHeaderClick(firstForm);
      
      // İlk form için uyarı kontrolü (kapalı değilse uyarı göstermez)
      checkShareholderFormWarning(firstForm);

      setupWdpPhoneFields(shareholdersList);

      syncShareholderUnitPricesFromModal(modal);
      updateSharesTotalBar(modal);
      
      // ABSOLUTE FIX: Modal ilk açıldığında shareholders-area'nın height'ını kaydet
      // Böylece scrollable olduğunda aynı height'ı kullanabiliriz
      if (shareholdersArea) {
        requestAnimationFrame(() => {
          // İlk form oluşturulduktan sonra height'ı kaydet (1 form için)
          const initialHeight = shareholdersArea.offsetHeight;
          if (initialHeight > 0 && !shareholdersArea.dataset.initialHeight) {
            shareholdersArea.dataset.initialHeight = initialHeight + 'px';
            safeLog("Initial shareholders-area height saved:", initialHeight + 'px');
          }
        });
      }
      
      // Scrollable class'ını güncelle
      updateShareholdersScrollable(modal);
      refreshShareholderGuidance(modal);

      // Fiyat alanını bul
      const priceInput = modal.querySelector('input[name="custom_price"]');

      // Ürün ID'sini al
      const productIdInput = modal.querySelector('input[name="wdp_product_id"], input[name="add-to-cart"]');
      if (!productIdInput) {
        safeLog("Product ID input not found in modal:", modal.id);
        return;
      }

      // Ürün fiyatını saklamak için değişken
      let baseProductPrice = 0;

      // Sayaç butonlarını hemen aktif hale getir (fiyat daha sonra güncellenecek)
      setupShareQuantityButtons(modal, shareCountInput, baseProductPrice, priceInput);

      // Doğrudan form için ürün bilgilerini kontrol et
      const productDataInput = modal.querySelector('input[name="product_data"]');
      if (productDataInput) {
        try {
          const productData = JSON.parse(productDataInput.value);
          if (productData) {
            // Ürün fiyatını al ve sakla
            baseProductPrice = Number.parseFloat(productData.price) || 0;
            safeLog("Product price from data attribute:", baseProductPrice);

            if (priceInput && baseProductPrice > 0) {
              if (!priceInput.dataset.baseMin || Number.parseFloat(priceInput.dataset.baseMin) <= 0) {
                priceInput.dataset.baseMin = baseProductPrice.toString();
              }

              if (!priceInput.value) {
                priceInput.value = baseProductPrice.toFixed(0);
              }
            }

            setupShareQuantityButtons(modal, modal.querySelector('input[name="share_count"]'), baseProductPrice, priceInput);
            syncShareholderUnitPricesFromModal(modal);
            updateSharesTotalBar(modal);
            setupWdpPhoneFields(modal);
            refreshShareholderGuidance(modal);
            return;
          }
        } catch (e) {
          safeLog("Error parsing product data:", e);
        }
      }

      const directProductId = Number.parseInt(productIdInput.value, 10);
      if (!Number.isFinite(directProductId)) {
        safeLog("Invalid product ID for direct form:", productIdInput.value);
        return;
      }

      if (getProductInfoData) {
        getProductInfoData(directProductId)
          .then((data) => {
            if (!data || !data.success) {
              safeLog("Ürün fiyatı alınamadı (cached/fetch):", data);
              return;
            }

            baseProductPrice = Number.parseFloat(data.price) || 0;
            if (productPrices) {
              productPrices[directProductId] = baseProductPrice;
            }
            safeLog("Product price from data cache/fetch:", baseProductPrice);

            if (priceInput && baseProductPrice > 0) {
              if (!priceInput.dataset.baseMin || Number.parseFloat(priceInput.dataset.baseMin) <= 0) {
                priceInput.dataset.baseMin = baseProductPrice.toString();
              }

              if (!priceInput.value) {
                priceInput.value = baseProductPrice.toFixed(0);
              }
            }

            setupShareQuantityButtons(modal, modal.querySelector('input[name="share_count"]'), baseProductPrice, priceInput);
            syncShareholderUnitPricesFromModal(modal);
            updateSharesTotalBar(modal);
            setupWdpPhoneFields(modal);
            refreshShareholderGuidance(modal);
          })
          .catch((error) => {
            safeLog("Error fetching product price:", error);
          });
      }

      setupWdpPhoneFields(modal);
      refreshShareholderGuidance(modal);

    } catch (error) {
      safeLog("Error in setupShareholderForms:", error);
    }
  }

  // Update shareholder forms (for direct forms - different signature)
  function updateShareholderForms(container, productData) {
    var shareCountInput = container.querySelector('input[name="share_count"]');
    if (!shareCountInput) return;

    var shareCount = Number.parseInt(shareCountInput.value, 10) || 1;
    var maxShares = productData ? Number.parseInt(productData.max_shares, 10) || 7 : 7;

    // Maksimum hisse sayısı kontrolü
    if (shareCount > maxShares) {
      shareCountInput.value = maxShares;
      shareCount = maxShares;
    }

    var shareholdersContainer = container.querySelector(".wdp-shareholders-container");
    if (!shareholdersContainer) return;
    var shareholdersList = ensureShareholderList(shareholdersContainer);
    if (!shareholdersList) return;

    // Mevcut formları ve input değerlerini topla
    var existingForms = Array.from(shareholdersList.querySelectorAll('.wdp-shareholder-form'));
    var existingCount = existingForms.length;

    // Mevcut input değerlerini sakla (ad, telefon, not)
    var values = [];
    for (let i = 0; i < existingCount; i++) {
      const form = existingForms[i];
      const telEl = form.querySelector('input[type="tel"]');
      let phoneStored = telEl ? telEl.value : '';
      if (telEl && WDPApp.phoneInput && typeof WDPApp.phoneInput.getValueForCopy === 'function') {
        phoneStored = WDPApp.phoneInput.getValueForCopy(telEl) || phoneStored;
      }
      values[i] = {
        name: form.querySelector('input[type="text"]')?.value || '',
        phone: phoneStored,
        note: getShareholderNoteTextarea(form)?.value || ''
      };
    }

    // Mevcut formların dolu olup olmadığını kontrol et (yeni formlar eklenmeden önce)
    var allPreviousFormsFilled = true;
    for (let i = 0; i < existingCount; i++) {
      const form = existingForms[i];
      if (!isFormFilled(form)) {
        allPreviousFormsFilled = false;
        break;
      }
    }
    
    // Form sayısı artarsa: sadece yeni form(lar) ekle
    if (shareCount > existingCount) {
      for (let i = existingCount + 1; i <= shareCount; i++) {
        var newForm = createShareholderForm(i);
        // CRITICAL: Scroll için tüm formlar görünür olmalı, sadece içerikleri gizli
        // Form görünür olacak ama içeriği gizli olacak (scroll için gerekli)
        // Yeni formlar başlangıçta kapalı olacak, sonra mantık ile açılacak
        shareholdersList.appendChild(newForm);
        // Yeni form için event listener'ları ekle
        setupCopyFormButton(newForm);
        setupShareholderHeaderClick(newForm);
      }
    }
    // Form sayısı azalırsa: sadece fazla formu kaldır
    else if (shareCount < existingCount) {
      for (let i = existingCount; i > shareCount; i--) {
        var formToRemove = shareholdersList.querySelector(`.wdp-shareholder-form[data-index="${i}"]`);
        if (formToRemove) {
          shareholdersList.removeChild(formToRemove);
        }
      }
    }

    // Kalan formlara eski değerleri geri yaz (sadece ilk shareCount kadarına)
    var updatedForms = shareholdersList.querySelectorAll('.wdp-shareholder-form');
    for (let i = 0; i < shareCount; i++) {
      const form = updatedForms[i];
      if (!form) continue;
      const nameInput = form.querySelector('input[type="text"]');
      const phoneInput = form.querySelector('input[type="tel"]');
      const noteInput = getShareholderNoteTextarea(form);
      if (values[i]) {
        if (nameInput) nameInput.value = values[i].name;
        if (phoneInput) phoneInput.value = values[i].phone;
        if (noteInput) noteInput.value = values[i].note;
      }
      // Event listener'ları tekrar ekle (gerekirse)
      setupCopyFormButton(form);
      setupShareholderHeaderClick(form);
      checkShareholderFormWarning(form);
    }

    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.refreshInRoot === 'function') {
      WDPApp.phoneInput.refreshInRoot(shareholdersList);
    } else {
      setupWdpPhoneFields(shareholdersList);
    }
    for (let ri = 0; ri < shareCount; ri++) {
      const rf = updatedForms[ri];
      if (!rf || !values[ri] || !values[ri].phone) continue;
      const pIn = rf.querySelector('input[type="tel"]');
      if (pIn && WDPApp.phoneInput && typeof WDPApp.phoneInput.applyPastedNumber === 'function') {
        WDPApp.phoneInput.applyPastedNumber(pIn, values[ri].phone);
      }
    }

    // CRITICAL: Form açık/kapalı durumunu belirle - accordion mantığı ile (updateShareholderFormsInternal ile aynı)
    // Mantık:
    // 1. Accordion: Bir form açıksa diğerleri kapalı olmalı
    // 2. Dolu formlar otomatik açılmamalı (kullanıcı açarsa açılır)
    // 3. Yeni form eklendiğinde, eğer önceki formlar doluysa yeni form açık olmalı
    // 4. Eğer önceki formlar boşsa, ilk boş form açık kalmalı
    var allForms = shareholdersList.querySelectorAll(".wdp-shareholder-form");
    
    // Önce tüm formların durumunu kontrol et
    var firstEmptyFormIndex = null;
    var currentlyOpenFormIndex = null;
    var wasNewFormAdded = shareCount > existingCount;
    
    allForms.forEach((form) => {
      const formIndex = parseInt(form.getAttribute('data-index'), 10);
      const isFilled = isFormFilled(form);
      const wasOpen = !form.classList.contains('collapsed');
      
      // Şu anda açık olan formu bul (sadece yeni formlar eklenmeden önce açık olanlar)
      if (wasOpen && formIndex <= shareCount && (!wasNewFormAdded || formIndex <= existingCount)) {
        currentlyOpenFormIndex = formIndex;
      }
      
      // İlk boş formu bul
      if (firstEmptyFormIndex === null && !isFilled && formIndex <= shareCount) {
        firstEmptyFormIndex = formIndex;
      }
    });
    
    // Hangi formun açık olması gerektiğini belirle
    var formToOpenIndex = null;
    
    // Eğer yeni form eklendiyse ve önceki formlar doluysa, yeni form açık olmalı
    if (wasNewFormAdded && allPreviousFormsFilled) {
      formToOpenIndex = shareCount; // Yeni eklenen form
    } 
    // Eğer şu anda açık bir form varsa ve o form hala geçerliyse, onu açık tut
    else if (currentlyOpenFormIndex !== null && currentlyOpenFormIndex <= shareCount) {
      formToOpenIndex = currentlyOpenFormIndex;
    }
    // Eğer hiç açık form yoksa, ilk boş formu veya 1. formu aç
    else {
      formToOpenIndex = firstEmptyFormIndex !== null ? firstEmptyFormIndex : 1;
    }
    
    // Şimdi formların açık/kapalı durumunu belirle (accordion mantığı)
    var formToScrollTo = null;
    allForms.forEach((form) => {
      const formIndex = parseInt(form.getAttribute('data-index'), 10);
      
      // Form görünürlüğünü garanti et
      form.style.display = '';
      form.style.visibility = 'visible';
      form.style.opacity = '1';
      
      // Sadece belirlenen form açık olmalı (accordion mantığı)
      if (formIndex === formToOpenIndex && formIndex <= shareCount) {
        form.classList.remove("collapsed");
        var contentEl = form.querySelector(".wdp-shareholder-content");
        if (contentEl) {
          contentEl.style.display = "flex";
        }
        // Yeni açılan formu scroll için işaretle
        formToScrollTo = form;
      } else {
        form.classList.add("collapsed");
        var contentEl = form.querySelector(".wdp-shareholder-content");
        if (contentEl) {
          contentEl.style.display = "none";
        }
      }
    });
    
    // Yeni açılan formu görünür alana scroll et
    if (formToScrollTo) {
      requestAnimationFrame(function() {
        formToScrollTo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    // Scrollable class'ını güncelle
    const modal = container.closest('.wdp-modal') || container.closest('.wdp-donation-form');
    updateShareholdersScrollable(modal);
    
    // Kapalı form sayısını güncelle
    updateCollapsedFormsCount(modal);
    syncShareholderUnitPricesFromModal(modal);
    refreshShareholderGuidance(modal);
  }

  // Setup direct shareholder forms
  function setupDirectShareholderForms(formContainer, productId, productData) {
    // Popup ile aynı setupShareholderForms fonksiyonunu kullan
    setupShareholderForms(formContainer, productId);
  }

  // Export
  WDPApp.shareholder = {
    ensureList: ensureShareholderList,
    syncUnitPrices: syncShareholderUnitPricesFromModal,
    setup: setupShareholderForms,
    setupQuantityButtons: setupShareQuantityButtons,
    createForm: createShareholderForm,
    setupCopyButton: setupCopyFormButton,
    duplicateForm: duplicateShareholderForm,
    updateScrollable: updateShareholdersScrollable,
    updateCollapsedCount: updateCollapsedFormsCount,
    applyScrollStyles: applyShareholderScrollStyles,
    cacheBaseHeight: cacheShareholdersBaseHeight,
    bindResizeListener: bindShareholderResizeListener,
    calculateMaxHeight: calculateShareholderMaxHeight,
    setupDirect: setupDirectShareholderForms,
    updateForms: updateShareholderForms,
    refreshGuidance: refreshShareholderGuidance,
    setValidationArmed: setShareValidationArmed,
    updateSharesTotalBar,
  };

  // Export shareholder module

})(window);

