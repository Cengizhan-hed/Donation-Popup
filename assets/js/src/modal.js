/**
 * @file modal.js
 * Modal aç/kapa, odak tuzağı, panel geçişi ve form yaşam döngüsü.
 * Dış API: WDPApp.modal
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule) 
    ? WDPApp.utils.ensureModule('utils', ['safeLog', 'focusFirstElement', 'activateFocusTrap', 'announceStatus'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const { safeLog, focusFirstElement, activateFocusTrap, announceStatus } = utils;
  const modalLifecycleState = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  let sidePanelScrollLockY = 0;
  let centerModalScrollLockY = 0;
  let pendingOpenRequest = null;

  function getModalLifecycleState(modal) {
    if (!modal || !modalLifecycleState) return '';
    return modalLifecycleState.get(modal) || '';
  }

  function setModalLifecycleState(modal, nextState) {
    if (!modal || !modalLifecycleState) return;
    if (!nextState) {
      modalLifecycleState.delete(modal);
      return;
    }
    modalLifecycleState.set(modal, nextState);
  }

  function flushPendingOpen() {
    const pending = pendingOpenRequest;
    pendingOpenRequest = null;
    if (!pending) {
      return;
    }
    openModal(pending.productId, pending.options);
  }

  function isSidePanelModal(modal) {
    return !!(modal && modal.classList.contains('wdp-side-panel'));
  }

  function resolveModalId(productId, options) {
    if (options && options.modalId) {
      return String(options.modalId);
    }
    return 'wdp-modal-' + productId;
  }

  function lockBodyScroll(isSidePanel) {
    // Blur/opacity/scrim flaş üretiyordu → solid overlay.
    // overflow:hidden + 100vw scrollbar kaybı titreşim yapıyordu → body position:fixed + scrollbar-gutter.
    if (document.body.classList.contains('wdp-modal-open') || document.body.classList.contains('wdp-side-panel-open')) {
      return;
    }
    const legacyScrim = document.getElementById('wdp-page-scrim');
    if (legacyScrim && legacyScrim.parentNode) {
      legacyScrim.parentNode.removeChild(legacyScrim);
    }

    const scrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add('wdp-scroll-locked');

    if (isSidePanel) {
      sidePanelScrollLockY = scrollY;
      document.body.classList.add('wdp-side-panel-open');
    } else {
      centerModalScrollLockY = scrollY;
      document.body.classList.add('wdp-modal-open');
    }

    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  function unlockBodyScroll() {
    const wasSidePanel = document.body.classList.contains('wdp-side-panel-open');
    const wasModal = document.body.classList.contains('wdp-modal-open');
    const scrollY = wasSidePanel ? sidePanelScrollLockY : centerModalScrollLockY;

    document.body.classList.remove('wdp-modal-open', 'wdp-side-panel-open');
    document.documentElement.classList.remove('wdp-scroll-locked');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.documentElement.style.removeProperty('--wdp-scrollbar-width');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    sidePanelScrollLockY = 0;
    centerModalScrollLockY = 0;

    if (wasSidePanel || wasModal) {
      window.scrollTo(0, scrollY || 0);
    }
  }

  // Tüm formların orijinal içeriğini sakla (tek kaynak: dom modülü; yükleme sırası için yedek yol)
  function saveOriginalForms() {
    const domModule = WDPApp.dom;
    if (domModule && typeof domModule.saveOriginalForms === 'function') {
      domModule.saveOriginalForms();
      return;
    }
    const { originalForms } = state;
    document.querySelectorAll(".wdp-modal, .wdp-donation-form").forEach((container) => {
      const containerId = container.id || container.getAttribute("data-product-id") || Math.random().toString(36).substr(2, 9);
      const form = container.querySelector("form");
      if (form) {
        originalForms.set(containerId, form.innerHTML);
      }
    });
  }

  function setupShareholderSection(modal, productId) {
    const sharesSection = modal.querySelector(".wdp-shares-section")
    const shareCountInput = modal.querySelector('input[name="share_count"]')
    if (!sharesSection && !shareCountInput) {
      return
    }
    safeLog("Shareholder form detected, setting up")
    const quantityRow = modal.querySelector(".wdp-product-quantity")
    if (quantityRow) {
      quantityRow.style.display = "none"
    }
    if (!WDPApp.shareholder) {
      return
    }
    const setupFunc = WDPApp.shareholder.setup || WDPApp.shareholder.setupShareholderForms
    if (typeof setupFunc !== 'function') {
      safeLog("ERROR: setupShareholderForms function not found in WDPApp.shareholder")
      return
    }
    safeLog("Setting up shareholder forms for modal:", modal.id)
    try {
      setupFunc(modal, productId)
      safeLog("Shareholder forms setup completed")
    } catch (error) {
      safeLog("ERROR setting up shareholder forms:", error)
      safeLog("Error stack:", error.stack)
      try {
        setupFunc(modal, productId)
        safeLog("Shareholder forms setup retry completed")
      } catch (retryError) {
        safeLog("ERROR on retry setting up shareholder forms:", retryError)
      }
    }
  }

  function bindModalGlobalListeners() {
    document.removeEventListener("mousedown", handleOutsideClick)
    document.removeEventListener("keydown", handleEscKeyPress)
    document.addEventListener("mousedown", handleOutsideClick)
    document.addEventListener("keydown", handleEscKeyPress)
  }

  function syncModalStateClasses(modal) {
    if (!modal) {
      return;
    }
    const panelContent = modal.querySelector('.wdp-modal-content');
    const hasShareholders = !!modal.querySelector('form.wdp-has-shareholders');
    const hasSuccess = !!modal.querySelector('.wdp-success-screen');
    if (panelContent) {
      panelContent.classList.toggle('wdp-has-shareholders', hasShareholders);
      panelContent.classList.toggle('wdp-has-success', hasSuccess);
    }
    modal.classList.toggle('wdp-has-shareholders', hasShareholders);
    modal.classList.toggle('wdp-has-success', hasSuccess);
  }

  function trackModalViewContent(modal, productId, sidePanelMode) {
    if (!window.WDPMetaTracking || typeof window.WDPMetaTracking.trackViewContentDonation !== "function") {
      return
    }
    try {
      const qtyEl = modal.querySelector('input[name="quantity"]')
      const qty = qtyEl ? parseInt(qtyEl.value, 10) || 1 : 1
      let unitPrice = 0
      if (modal.dataset && modal.dataset.wdpUnitPrice !== undefined && modal.dataset.wdpUnitPrice !== "") {
        unitPrice = parseFloat(modal.dataset.wdpUnitPrice)
      }
      if (!Number.isFinite(unitPrice)) {
        unitPrice = 0
      }
      const titleEl = modal.querySelector(".wdp-modal-title")
      const cname = titleEl ? titleEl.textContent.trim() : ""
      window.WDPMetaTracking.trackViewContentDonation({
        productId: productId,
        contentName: cname,
        quantity: qty,
        itemPrice: unitPrice,
        value: unitPrice > 0 ? unitPrice * qty : undefined,
        formType: sidePanelMode ? "side_panel" : "popup",
      })
    } catch (metaErr) {
      safeLog("Meta ViewContent:", metaErr)
    }
  }

  function runModalOpenInit(modal, productId, sidePanelMode) {
    if (!modal || state.activeModal !== modal) {
      return
    }

    resetForm(modal)

    const donationForm = modal.querySelector('form')
    if (donationForm && WDPApp.form && typeof WDPApp.form.setup === 'function') {
      WDPApp.form.setup(donationForm)
    }
    if (donationForm && WDPApp.formWizard && typeof WDPApp.formWizard.reset === 'function') {
      WDPApp.formWizard.reset(donationForm)
    }

    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.refreshInRoot === 'function') {
      WDPApp.phoneInput.refreshInRoot(modal)
    } else if (WDPApp.phoneInput && typeof WDPApp.phoneInput.setupInRoot === 'function') {
      WDPApp.phoneInput.setupInRoot(modal)
    }

    setupShareholderSection(modal, productId)

    if (donationForm && WDPApp.formWizard && typeof WDPApp.formWizard.setup === 'function') {
      WDPApp.formWizard.setup(donationForm)
      if (typeof WDPApp.formWizard.reset === 'function') {
        WDPApp.formWizard.reset(donationForm)
      }
    }

    const loadProductInfo = WDPApp.product && (WDPApp.product.fetchProductInfo || WDPApp.product.fetch)
    if (typeof loadProductInfo === 'function') {
      loadProductInfo(productId)
    }

    const progressBarContainer = modal.querySelector('.wdp-progress-bar-container')
    if (progressBarContainer && WDPApp.progressBar && typeof WDPApp.progressBar.setup === 'function') {
      try {
        WDPApp.progressBar.setup(progressBarContainer)
        safeLog("Progress bar setup completed for modal", modal.id)
        const fetchCart =
          (WDPApp.cartActions && WDPApp.cartActions.fetchContents) ||
          (WDPApp.cart && WDPApp.cart.fetchContents)
        if (typeof fetchCart === 'function') {
          fetchCart()
            .then((items) => {
              if (WDPApp.progressBar && typeof WDPApp.progressBar.syncFromCartItems === 'function') {
                WDPApp.progressBar.syncFromCartItems(items)
              }
            })
            .catch(() => {})
        }
      } catch (err) {
        safeLog("Progress bar setup error:", err)
      }
    }

    syncModalStateClasses(modal)

    trackModalViewContent(modal, productId, sidePanelMode)
    bindModalGlobalListeners()
    modal.classList.remove('wdp-is-skeleton')

    focusFirstElement(modal)
    state.focusTrapCleanup = activateFocusTrap(modal)

    const modalTitle = modal.querySelector('.wdp-modal-title')
    if (modalTitle && modalTitle.textContent) {
      announceStatus(`${modalTitle.textContent.trim()} formu açıldı`, 'polite')
    } else {
      announceStatus(sidePanelMode ? 'Bağış paneli açıldı' : 'Bağış formu açıldı', 'polite')
    }

    safeLog("Modal init completed for product ID:", productId)
  }

  // Modal'ı aç — sağ panelde önce görünür yap, ağır init'i sonraki karede çalıştır
  function openModal(productId, options) {
    try {
      productId = Number.parseInt(productId, 10)
      const modalId = resolveModalId(productId, options)
      const modal = document.getElementById(modalId)
      safeLog("Modal element found:", modal)
      safeLog("Modal ID searched:", modalId)

      if (!modal) {
        safeLog("ERROR: Modal not found for product ID:", productId)
        return
      }
      const lifecycleState = getModalLifecycleState(modal)
      if (lifecycleState === 'opening' || lifecycleState === 'closing') {
        pendingOpenRequest = { productId: productId, options: options || null }
        return
      }
      if (state.activeModal === modal && modal.classList.contains('show')) {
        return
      }

      const sidePanelMode = isSidePanelModal(modal)
      if (sidePanelMode && !modal.classList.contains('wdp-side-panel')) {
        modal.classList.add('wdp-side-panel')
      }

      state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null

      if (state.focusTrapCleanup) {
        state.focusTrapCleanup()
        state.focusTrapCleanup = null
      }

      const errorMsg = modal.querySelector(".wdp-form-error")
      if (errorMsg) {
        errorMsg.style.display = "none"
        errorMsg.textContent = ""
      }

      resetShareholderValidationIfNeeded(modal)

      if (modal.parentNode !== document.body) {
        try {
          document.body.appendChild(modal)
        } catch (e) {
          safeLog('Modal move to body failed:', e)
        }
      }

      modal.setAttribute('aria-hidden', 'false')
      // Şablondaki inline display/visibility/opacity CSS .show'dan baskın gelir; hepsini temizle
      modal.style.removeProperty('display')
      modal.style.removeProperty('visibility')
      modal.style.removeProperty('opacity')
      modal.classList.remove('wdp-side-panel--closing')
      modal.classList.add('wdp-is-skeleton')

      state.activeModal = modal
      pendingOpenRequest = null

      if (WDPApp.utils && typeof WDPApp.utils.emitWdpEvent === 'function') {
        WDPApp.utils.emitWdpEvent('wdp:form:open', { productId: productId, modal: modal, sidePanel: sidePanelMode })
      }

      if (sidePanelMode) {
        setModalLifecycleState(modal, 'opening')
        lockBodyScroll(true)
        modal.classList.add('show', 'wdp-side-panel--opening')
        bindModalGlobalListeners()

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (getModalLifecycleState(modal) !== 'opening' || state.activeModal !== modal) {
              return
            }
            modal.classList.remove('wdp-side-panel--opening')
            runModalOpenInit(modal, productId, sidePanelMode)
            setModalLifecycleState(modal, 'open')
          })
        })
      } else {
        setModalLifecycleState(modal, 'opening')
        lockBodyScroll(false)
        modal.classList.add('show')
        runModalOpenInit(modal, productId, sidePanelMode)
        setModalLifecycleState(modal, 'open')
      }

      safeLog("Modal opened successfully for product ID:", productId)
    } catch (error) {
      safeLog("ERROR in openModal:", error)
      safeLog("Error stack:", error.stack)
    }
  }

  // Modal dışına tıklama olayını işle
  function handleOutsideClick(e) {
    const modal = state.activeModal
    if (modal) {
      // Alert overlay'ine tıklama modal'ı kapatmasın
      if (e.target.closest('.wdp-alert-overlay')) {
        return;
      }

      if (e.target.closest('.wdp-phone-country-panel')) {
        return;
      }
      
      const modalContent = modal.querySelector(".wdp-modal-content")
      if (
        modalContent &&
        !modalContent.contains(e.target) &&
        !e.target.classList.contains("wdp-open-modal") &&
        !e.target.classList.contains("wdp-open-side-panel") &&
        !e.target.classList.contains("wdp-donate-button") &&
        !e.target.closest(".wdp-open-modal") &&
        !e.target.closest(".wdp-open-side-panel") &&
        !e.target.closest(".wdp-modal-content")
      ) {
        closeModal(modal)
        // Olay dinleyicisini kaldır
        document.removeEventListener("mousedown", handleOutsideClick)
      }
    }
  }

  // ESC tuşuna basma olayını işle
  function handleEscKeyPress(e) {
    // Alert overlay açıkken modal'ı kapatma
    if (document.querySelector('.wdp-alert-overlay.show')) {
      return;
    }
    
    if (e.key === "Escape" && state.activeModal) {
      closeModal(state.activeModal)
      // Olay dinleyicisini kaldır
      document.removeEventListener("keydown", handleEscKeyPress)
    }
  }

  const SIDE_PANEL_CLOSE_MS = 380

  function resetShareholderValidationIfNeeded(modal) {
    if (!modal) {
      return
    }
    const form = modal.querySelector('form.wdp-has-shareholders, form.wdp-donation-form-fields')
    if (!form || !WDPApp.shareholder) {
      return
    }
    if (typeof WDPApp.shareholder.resetValidationUI === 'function') {
      WDPApp.shareholder.resetValidationUI(form)
    }
  }

  function finalizeModalClose(modal) {
    const modalHeader = modal.querySelector('.wdp-modal-header')
    if (modalHeader) {
      modalHeader.classList.remove('wdp-hidden-on-success')
    }
    const modalProgress = modal.querySelector('.wdp-progress-bar-container')
    if (modalProgress) {
      modalProgress.classList.remove('wdp-hidden-on-success')
    }

    resetShareholderValidationIfNeeded(modal)

    // Inline display:none kullanma — CSS :not(.show) gizler; inline reopen’da bir frame flaş yapıyordu
    modal.classList.remove('show', 'wdp-side-panel--closing', 'wdp-is-skeleton')
    modal.setAttribute('aria-hidden', 'true')
    modal.style.removeProperty('display')
    modal.style.removeProperty('visibility')
    modal.style.removeProperty('opacity')
    modal.classList.remove('wdp-has-success')

    unlockBodyScroll()

    const lastFocused = state.lastFocusedElement
    state.lastFocusedElement = null
    if (lastFocused && typeof lastFocused.focus === 'function') {
      setTimeout(() => {
        lastFocused.focus()
      }, 0)
    }

    safeLog('Modal closed successfully')
    setModalLifecycleState(modal, 'closed')
    flushPendingOpen()
  }

  // Modal'ı kapat — sağ panel sağa kayarak kapanır
  function closeModal(modal) {
    if (!modal) return

    const wasSidePanel = modal.classList.contains('wdp-side-panel')
    const isOpen = modal.classList.contains('show')
    const isClosing = modal.classList.contains('wdp-side-panel--closing')
    const lifecycleState = getModalLifecycleState(modal)

    if (isClosing || lifecycleState === 'closing') {
      return
    }
    setModalLifecycleState(modal, 'closing')

    if (state.focusTrapCleanup) {
      state.focusTrapCleanup()
      state.focusTrapCleanup = null
    }

    document.removeEventListener('mousedown', handleOutsideClick)
    document.removeEventListener('keydown', handleEscKeyPress)

    state.activeModal = null
    modal.setAttribute('aria-hidden', 'true')

    announceStatus(wasSidePanel ? 'Bağış paneli kapatıldı' : 'Bağış formu kapatıldı', 'polite')

    if (wasSidePanel && isOpen) {
      modal.classList.add('wdp-side-panel--closing')

      const panelContent = modal.querySelector('.wdp-modal-content')
      let finished = false

      const completeClose = () => {
        if (finished) return
        finished = true
        if (panelContent) {
          panelContent.removeEventListener('animationend', onPanelAnimationEnd)
        }
        finalizeModalClose(modal)
      }

      const onPanelAnimationEnd = (event) => {
        if (event.target !== panelContent) return
        if (event.animationName !== 'wdp-side-panel-slide-out') return
        completeClose()
      }

      if (panelContent) {
        panelContent.addEventListener('animationend', onPanelAnimationEnd)
      }

      setTimeout(completeClose, SIDE_PANEL_CLOSE_MS + 80)
      return
    }

    finalizeModalClose(modal)
  }

  // Form içeriğini sıfırla
  function resetForm(modal) {
    const { originalForms } = state;
    const modalId = modal.id
    const form = modal.querySelector("form")

    // Eğer orijinal form içeriği saklanmışsa, geri yükle
    if (originalForms.has(modalId) && form) {
      // Wizard DOM/state form.innerHTML ile kopuyor; önce temizle.
      if (WDPApp.formWizard && typeof WDPApp.formWizard.destroy === 'function') {
        WDPApp.formWizard.destroy(form)
      }
      const snapshot = originalForms.get(modalId)
      const useSnapshot =
        snapshot &&
        (snapshot.indexOf('wdp-phone-field') !== -1 ||
          !form.querySelector('[data-wdp-phone-field]'));
      if (useSnapshot) {
        form.innerHTML = snapshot
      }
      form.classList.remove('wdp-has-success')
      const panelContent = modal.querySelector('.wdp-modal-content')
      if (panelContent) {
        panelContent.classList.remove('wdp-has-success')
      }
      syncModalStateClasses(modal)

      // Form alanlarını temizle. Readonly/disabled atlanır: quantity/share_count için .value="" atanabildiğinden
      // (readonly sadece kullanıcı girişini keser) ilk açılışta sayaç boş kalıyor, +/- sonrası düzeliyordu.
      form.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"], textarea').forEach((input) => {
        if (input.readOnly || input.disabled) {
          return
        }
        // Progress tutar alanı: boş bırak; minimum yalnızca placeholder'da.
        if (
          input.name === 'custom_price' &&
          (input.classList.contains('wdp-progress-bar-price-input') ||
            form.classList.contains('wdp-has-progress-bar'))
        ) {
          input.value = ""
          delete input.dataset.wdpCustomUnit
          delete input.dataset.wdpDefaultPrice
          return
        }
        input.value = ""
      })

      // Form gönderim olayını bağla
      if (WDPApp.form && WDPApp.form.setup) {
        WDPApp.form.setup(form)
      }

      if (WDPApp.phoneInput && typeof WDPApp.phoneInput.refreshInRoot === 'function') {
        WDPApp.phoneInput.refreshInRoot(modal)
      }

      // Progress bar'ı başlat (form reset edildiğinde)
      const progressBarContainer = modal.querySelector('.wdp-progress-bar-container');
      if (progressBarContainer && WDPApp.progressBar && typeof WDPApp.progressBar.setup === 'function') {
        try {
          progressBarContainer.removeAttribute('data-wdp-progress-setup');
          WDPApp.progressBar.setup(progressBarContainer);
          const fetchCart =
            (WDPApp.cartActions && WDPApp.cartActions.fetchContents) ||
            (WDPApp.cart && WDPApp.cart.fetchContents);
          if (typeof fetchCart === 'function') {
            fetchCart()
              .then((items) => {
                if (WDPApp.progressBar && typeof WDPApp.progressBar.syncFromCartItems === 'function') {
                  WDPApp.progressBar.syncFromCartItems(items);
                }
              })
              .catch(() => {});
          }
        } catch (_) { /* noop */ }
      }
    }
  }

  // Export
  WDPApp.modal = {
    open: openModal,
    close: closeModal,
    resetForm,
    saveOriginalForms,
    syncStateClasses: syncModalStateClasses,
    handleOutsideClick,
    handleEscKeyPress,
  }

  // Export modal module

})(window);
