/**
 * ============================================================================
 * MODAL.JS - MODAL YÖNETİM MODÜLÜ
 * ============================================================================
 * 
 * DOSYA: modal.js
 * KONUM: /assets/js/src/modal.js
 * 
 * AMAÇ:
 * Modal (popup) açma/kapama, form reset, focus trap, keyboard navigation.
 * 
 * ANA İŞLEVLER:
 * 1. openModal - Modal açma
 * 2. closeModal - Modal kapatma
 * 3. resetForm - Form sıfırlama
 * 4. handleOutsideClick - Dışarı tıklama ile kapatma
 * 5. handleEscKeyPress - ESC tuşu ile kapatma
 * 6. saveOriginalForms - Form orijinal içeriğini kaydetme
 * 
 * MODAL AÇMA:
 * - Product ID ile modal bulma
 * - Scroll pozisyonunu koruma
 * - Body scroll lock
 * - Focus trap aktivasyonu
 * - ARIA live region duyurma
 * - Animation trigger
 * 
 * MODAL KAPATMA:
 * - Body scroll unlock
 * - Focus trap deaktivasyonu
 * - Form reset
 * - Animation trigger
 * - Focus'u açan butona geri döndürme
 * 
 * FOCUS MANAGEMENT:
 * - Focus trap (modal içinde tutma)
 * - First focusable element'e odaklanma
 * - ESC tuşu ile kapatma
 * - Tab navigation
 * 
 * ACCESSIBILITY:
 * - ARIA attributes (aria-hidden, aria-modal)
 * - Keyboard navigation
 * - Screen reader announcements
 * - Focus management
 * 
 * PERFORMANS:
 * - Debounced event handlers
 * - Cached DOM references
 * - Optimized animations
 * 
 * DEPENDENCIES:
 * - utils.js (focusFirstElement, activateFocusTrap, announceStatus)
 * - state.js (form state, original forms)
 * 
 * EXPORT:
 * WDPApp.modal = { open, close, reset, ... }
 * 
 * ============================================================================
 * 
 * Modal - Modal işlemleri
 * openModal, closeModal, resetForm, handleOutsideClick, handleEscKeyPress
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
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.documentElement.style.setProperty('--wdp-scrollbar-width', scrollbarWidth + 'px');
    }
    document.body.style.overflow = 'hidden';
    if (isSidePanel) {
      document.body.classList.add('wdp-side-panel-open');
    } else {
      document.body.classList.add('wdp-modal-open');
    }
  }

  function unlockBodyScroll() {
    document.body.classList.remove('wdp-modal-open', 'wdp-side-panel-open');
    document.body.style.overflow = '';
    document.documentElement.style.removeProperty('--wdp-scrollbar-width');
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

    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.refreshInRoot === 'function') {
      WDPApp.phoneInput.refreshInRoot(modal)
    } else if (WDPApp.phoneInput && typeof WDPApp.phoneInput.setupInRoot === 'function') {
      WDPApp.phoneInput.setupInRoot(modal)
    }

    setupShareholderSection(modal, productId)

    const loadProductInfo = WDPApp.product && (WDPApp.product.fetchProductInfo || WDPApp.product.fetch)
    if (typeof loadProductInfo === 'function') {
      loadProductInfo(productId)
    }

    const progressBarContainer = modal.querySelector('.wdp-progress-bar-container')
    if (progressBarContainer && WDPApp.progressBar && typeof WDPApp.progressBar.setup === 'function') {
      try {
        WDPApp.progressBar.setup(progressBarContainer)
        safeLog("Progress bar setup completed for modal", modal.id)
      } catch (err) {
        safeLog("Progress bar setup error:", err)
      }
    }

    syncModalStateClasses(modal)

    trackModalViewContent(modal, productId, sidePanelMode)
    bindModalGlobalListeners()

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

      state.activeModal = modal

      if (sidePanelMode) {
        setModalLifecycleState(modal, 'opening')
        lockBodyScroll(true)
        modal.classList.add('show', 'wdp-side-panel--opening')
        bindModalGlobalListeners()

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            modal.classList.remove('wdp-side-panel--opening')
            runModalOpenInit(modal, productId, sidePanelMode)
            setModalLifecycleState(modal, 'open')
          })
        })
      } else {
        setModalLifecycleState(modal, 'opening')
        modal.classList.add('show')
        lockBodyScroll(false)
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

  function finalizeModalClose(modal) {
    const modalHeader = modal.querySelector('.wdp-modal-header')
    if (modalHeader) {
      modalHeader.classList.remove('wdp-hidden-on-success')
    }

    const isSidePanel = modal.classList.contains('wdp-side-panel')

    modal.style.display = 'none'
    modal.classList.remove('show', 'wdp-side-panel--closing')
    modal.setAttribute('aria-hidden', 'true')
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
          WDPApp.progressBar.setup(progressBarContainer);
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
