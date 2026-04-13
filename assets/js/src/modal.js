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

  // Tüm formların orijinal içeriğini sakla
  function saveOriginalForms() {
    const { originalForms } = state;
    // Hem popup hem ürün içi form için çalıştır
    document.querySelectorAll(".wdp-modal, .wdp-donation-form").forEach((container) => {
      const containerId = container.id || container.getAttribute("data-product-id") || Math.random().toString(36).substr(2, 9);
      const form = container.querySelector("form");
      if (form) {
        originalForms.set(containerId, form.innerHTML);
      }
    });
  }

  // Modal'ı aç fonksiyonunu düzelt - scroll pozisyonunu koru
  function openModal(productId) {
    try {
      // Ürün ID'sini integer'a çevir
      productId = Number.parseInt(productId, 10)

      const modal = document.getElementById("wdp-modal-" + productId)
      safeLog("Modal element found:", modal)
      safeLog("Modal ID searched:", "wdp-modal-" + productId)

      if (!modal) {
        safeLog("ERROR: Modal not found for product ID:", productId)
        
        // Tüm modal'ları kontrol et
        const allModals = document.querySelectorAll(".wdp-modal")
        safeLog("All modals found:", allModals.length)
        allModals.forEach((m, index) => {
          safeLog(`Modal ${index + 1}:`, {
            id: m.id,
            classes: m.className,
            display: m.style.display,
            visible: m.offsetParent !== null
          })
        })
        
        // Tüm butonları kontrol et
        const allButtons = document.querySelectorAll(".wdp-donate-button, .wdp-open-modal")
        safeLog("All buttons found:", allButtons.length)
        allButtons.forEach((b, index) => {
          safeLog(`Button ${index + 1}:`, {
            element: b,
            productId: b.getAttribute("data-product-id"),
            classes: b.className,
            text: b.textContent
          })
        })
        
        return
      }

      safeLog("Modal found, current display:", modal.style.display)
      safeLog("Modal current classes:", modal.className)

      state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null

      if (state.focusTrapCleanup) {
        state.focusTrapCleanup()
        state.focusTrapCleanup = null
      }

      // Form içeriğini sıfırla
      resetForm(modal)

      // Hata mesajını gizle
      const errorMsg = modal.querySelector(".wdp-form-error")
      if (errorMsg) {
        errorMsg.style.display = "none"
        errorMsg.textContent = ""
      }

      // Modal'ı body'nin en üst seviyesine taşı (stacking context sorunlarını önler)
      if (modal.parentNode !== document.body) {
        try {
          document.body.appendChild(modal)
        } catch (e) {
          safeLog('Modal move to body failed:', e)
        }
      }

      modal.setAttribute('aria-hidden', 'false')

      // Modal'ı göster - CSS class kullan
      safeLog("Adding 'show' class to modal")
      modal.classList.add("show")
      safeLog("Setting display to 'flex'")
      modal.style.display = "flex"
      modal.style.visibility = "visible"
      modal.style.opacity = "1"
      
      safeLog("Modal classes after show:", modal.className)
      safeLog("Modal display after show:", modal.style.display)

      // CRITICAL: Sadece overflow: hidden kullan - position: fixed kullanma
      // Bu şekilde scroll pozisyonu korunur ve sayfa hareket etmez
      // Scrollbar genişliğini hesapla ve padding ekle (layout shift önlemek için)
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      if (scrollbarWidth > 0) {
        document.documentElement.style.setProperty('--wdp-scrollbar-width', scrollbarWidth + 'px')
      }
      document.body.style.overflow = "hidden"
      document.body.classList.add("wdp-modal-open")
      safeLog("Body classes after modal open:", document.body.className)

        // Hissedar bölümünü kontrol et ve hemen ayarla - INSTANT (no delay)
        const sharesSection = modal.querySelector(".wdp-shares-section")
        const shareCountInput = modal.querySelector('input[name="share_count"]')
        
        if (sharesSection || shareCountInput) {
          safeLog("Shareholder form detected, setting up")
          // Ürün adedi bölümünü gizle (Hisseli formda ürün adedi hissedar sayısına göre otomatik belirlenir)
          const quantityRow = modal.querySelector(".wdp-product-quantity")
          if (quantityRow) {
            quantityRow.style.display = "none"
          }

          // Hissedar formlarını oluştur - INSTANT (no delay for maximum performance)
          if (WDPApp.shareholder) {
            // Önce setup fonksiyonunu kontrol et (export'ta setup olarak tanımlı)
            const setupFunc = WDPApp.shareholder.setup || WDPApp.shareholder.setupShareholderForms;
            if (setupFunc && typeof setupFunc === 'function') {
              safeLog("Setting up shareholder forms for modal:", modal.id);
              // INSTANT execution - no delay
              try {
                setupFunc(modal, productId);
                safeLog("Shareholder forms setup completed");
              } catch (error) {
                safeLog("ERROR setting up shareholder forms:", error);
                safeLog("Error stack:", error.stack);
                // Retry once immediately (no delay)
                try {
                  setupFunc(modal, productId);
                  safeLog("Shareholder forms setup retry completed");
                } catch (retryError) {
                  safeLog("ERROR on retry setting up shareholder forms:", retryError);
                }
              }
            } else {
              safeLog("ERROR: setupShareholderForms function not found in WDPApp.shareholder");
            }
          } else {
            // Modül henüz yüklenmemişse, immediate retry (no delay)
            if (WDPApp.shareholder) {
              const setupFunc = WDPApp.shareholder.setup || WDPApp.shareholder.setupShareholderForms;
              if (setupFunc && typeof setupFunc === 'function') {
                safeLog("Retrying shareholder forms setup after module load");
                setupFunc(modal, productId);
              }
            }
          }
        }

      // Ürün bilgilerini AJAX ile al
      if (WDPApp.product && WDPApp.product.fetchProductInfo) {
        WDPApp.product.fetchProductInfo(productId)
      }

      // Progress bar'ı başlat (modal açıldığında)
      const progressBarContainer = modal.querySelector('.wdp-progress-bar-container');
      if (progressBarContainer) {
        const progressBar = WDPApp.progressBar;
        if (progressBar && typeof progressBar.setup === 'function') {
          safeLog("Setting up progress bar for modal:", modal.id);
          // Modal açıldıktan sonra progress bar'ı başlat
          requestAnimationFrame(function() {
            progressBar.setup(progressBarContainer);
            safeLog("Progress bar setup completed for modal");
          });
        } else {
          // Modül henüz yüklenmemişse, immediate retry
          requestAnimationFrame(function() {
            const retryProgressBar = WDPApp.progressBar;
            if (retryProgressBar && typeof retryProgressBar.setup === 'function') {
              retryProgressBar.setup(progressBarContainer);
              safeLog("Progress bar setup retry completed for modal");
            }
          });
        }
      }

      // Aktif modal'ı kaydet
      state.activeModal = modal
      safeLog("Active modal set:", state.activeModal)

      // Modal tekrar açılıyorsa aynı listener'ların birikmesini önle.
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("keydown", handleEscKeyPress)

      // Modal dışına tıklama olayını ekle - Her modal açılışında yeniden ekle
      document.addEventListener("mousedown", handleOutsideClick)

      // ESC tuşuna basma olayını ekle - Her modal açılışında yeniden ekle
      document.addEventListener("keydown", handleEscKeyPress)
      
      focusFirstElement(modal)
      state.focusTrapCleanup = activateFocusTrap(modal)

      const modalTitle = modal.querySelector('.wdp-modal-title')
      if (modalTitle && modalTitle.textContent) {
        announceStatus(`${modalTitle.textContent.trim()} formu açıldı`, 'polite')
      } else {
        announceStatus('Bağış formu açıldı', 'polite')
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

      // Custom phone country panel + legacy iti portal (if any).
      if (
        e.target.closest('.wdp-phone-country-panel') ||
        e.target.closest('.iti--container') ||
        e.target.closest('.wdp-iti-dropdown-root')
      ) {
        return;
      }
      
      const modalContent = modal.querySelector(".wdp-modal-content")
      if (
        modalContent &&
        !modalContent.contains(e.target) &&
        !e.target.classList.contains("wdp-open-modal") &&
        !e.target.classList.contains("wdp-donate-button") &&
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

  // Modal'ı kapat fonksiyonunu düzelt - scroll pozisyonunu koru
  function closeModal(modal) {
    if (!modal) return

    // Modal header'ı tekrar göster (eğer gizliyse) - sadece popup için
    const modalHeader = modal.querySelector('.wdp-modal-header');
    if (modalHeader) {
      modalHeader.classList.remove('wdp-hidden-on-success');
    }

    // Modal'ı gizle - CSS class'ı da kaldır
    modal.classList.remove("show")
    modal.style.display = "none"
    modal.style.visibility = "hidden"
    modal.style.opacity = "0"
    modal.setAttribute('aria-hidden', 'true')

    if (state.focusTrapCleanup) {
      state.focusTrapCleanup()
      state.focusTrapCleanup = null
    }
    
    document.body.classList.remove("wdp-modal-open")

    // CRITICAL: Sadece overflow'u kaldır - position: fixed kullanmadığımız için scroll pozisyonu zaten korunuyor
    document.body.style.overflow = ""
    // Scrollbar width CSS variable'ını da temizle
    document.documentElement.style.removeProperty('--wdp-scrollbar-width')

    // Olay dinleyicilerini kaldır
    document.removeEventListener("mousedown", handleOutsideClick)
    document.removeEventListener("keydown", handleEscKeyPress)

    state.activeModal = null

    const lastFocused = state.lastFocusedElement
    state.lastFocusedElement = null
    if (lastFocused && typeof lastFocused.focus === 'function') {
      setTimeout(() => {
        lastFocused.focus()
      }, 0)
    }

    announceStatus('Bağış formu kapatıldı', 'polite')
    
    safeLog("Modal closed successfully")
  }

  // Form içeriğini sıfırla
  function resetForm(modal) {
    const { originalForms } = state;
    const modalId = modal.id
    const form = modal.querySelector("form")

    // Eğer orijinal form içeriği saklanmışsa, geri yükle
    if (originalForms.has(modalId) && form) {
      form.innerHTML = originalForms.get(modalId)

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
      
      // Progress bar'ı başlat (form reset edildiğinde)
      const progressBarContainer = modal.querySelector('.wdp-progress-bar-container');
      if (progressBarContainer) {
        const progressBar = WDPApp.progressBar;
        if (progressBar && typeof progressBar.setup === 'function') {
          // Form reset edildikten sonra progress bar'ı başlat
          requestAnimationFrame(function() {
            progressBar.setup(progressBarContainer);
          });
        }
      }
    }
  }

  // Export
  WDPApp.modal = {
    open: openModal,
    close: closeModal,
    resetForm,
    saveOriginalForms,
    handleOutsideClick,
    handleEscKeyPress,
  }

  // Export modal module

})(window);
