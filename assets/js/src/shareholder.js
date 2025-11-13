/**
 * Shareholder - Hissedar formları yönetimi
 * ensureShareholderList, setupShareholderForms, setupShareQuantityButtons,
 * createShareholderForm, toggleShareholderForm, setupShareholderToggles,
 * setupCopyFormButton, duplicateShareholderForm, updateShareholdersScrollable,
 * updateCollapsedFormsCount, applyShareholderScrollStyles, cacheShareholdersBaseHeight,
 * bindShareholderResizeListener, calculateShareholderMaxHeight, setupDirectShareholderForms,
 * updateShareholderForms
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Utils, state ve product'i güvenli bir şekilde al (henüz yüklenmemişse boş obje)
  const utils = WDPApp.utils || {};
  const state = WDPApp.state || {};
  const product = WDPApp.product || {};
  const { safeLog, formatCurrency } = utils;
  const { productPrices, shareholdersResizeBound } = state;
  const { getData: getProductInfoData } = product;
  
  // Utils henüz yüklenmemişse hata ver
  if (!WDPApp.utils || typeof utils.safeLog !== 'function') {
    console.error('WDP ERROR: utils.js must be loaded before shareholder.js!');
    console.error('WDP: WDPApp.utils:', WDPApp.utils);
  }

  // Constants
  const SHAREHOLDER_SCROLL_CONFIG = {
    min: 260,
    max: 440,
    ratio: 0.6,
  };

  // Helper: Ensure shareholder list container exists
  function ensureShareholderList(container) {
    if (!container) return null;
    let list = container.querySelector(".wdp-shareholders-scroll");
    if (list) return list;

    list = document.createElement("div");
    list.className = "wdp-shareholders-scroll";

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

  // Helper: Update scrollable class for shareholders container
  function updateShareholdersScrollable(modal) {
    const shareholdersContainer = modal.querySelector('.wdp-shareholders-container');
    if (!shareholdersContainer) return;
    const shareholdersList = ensureShareholderList(shareholdersContainer);
    if (!shareholdersList) return;
    const forms = shareholdersList.querySelectorAll('.wdp-shareholder-form');
    // Scroll sadece hisse adedi 1'den fazla olduğunda aktif olsun (scrollbar görünsün)
    const shouldScroll = forms.length > 1;
    
    // CRITICAL: Immediately add/remove scrollable class to prevent modal expansion
    // CSS will handle height constraints through scrollable class
    const shareholdersArea = shareholdersContainer.closest('.wdp-shareholders-area');
    if (shareholdersArea) {
      if (shouldScroll) {
        // Immediately add scrollable class - CSS will apply height constraints
        shareholdersArea.classList.add('scrollable');
      } else {
        shareholdersArea.classList.remove('scrollable');
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
    updateCollapsedFormsCount(modal, shareholdersList);
  }

  // Helper: Update collapsed forms count badge
  function updateCollapsedFormsCount(modal, scrollElement) {
    if (!modal) return;
    
    // Modal'dan sharesSection'u bul (scrollElement olmasa bile)
    const sharesSection = modal.querySelector('.wdp-shares-section');
    if (!sharesSection) return;
    
    const header = sharesSection.querySelector('.wdp-shares-header');
    if (!header) return;
    
    // Form sayısını kontrol et (scrollElement varsa ondan, yoksa modal'dan)
    const allForms = scrollElement 
      ? scrollElement.querySelectorAll('.wdp-shareholder-form')
      : modal.querySelectorAll('.wdp-shareholder-form');
    const totalForms = allForms.length;
    
    // Sadece 1 form varsa badge'i tamamen gizle veya kaldır
    if (totalForms <= 1) {
      header.classList.remove('has-badge');
      const countBadge = header.querySelector('.wdp-collapsed-count');
      if (countBadge) {
        countBadge.textContent = '';
      }
      return;
    }
    
    // Kapalı form sayısını hesapla
    const collapsedForms = scrollElement
      ? scrollElement.querySelectorAll('.wdp-shareholder-form.collapsed')
      : modal.querySelectorAll('.wdp-shareholder-form.collapsed');
    const collapsedCount = collapsedForms.length;
    
    let countBadge = header.querySelector('.wdp-collapsed-count');
    
    if (collapsedCount > 0) {
      if (!countBadge) {
        countBadge = document.createElement('span');
        countBadge.className = 'wdp-collapsed-count';
        header.appendChild(countBadge);
        
        // Window resize event listener ekle (sadece bir kez)
        if (!countBadge.dataset.resizeListenerAdded) {
          countBadge.dataset.resizeListenerAdded = 'true';
          let resizeTimeout;
          const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
              updateCollapsedFormsCount(modal, scrollElement);
            }, 150);
          };
          window.addEventListener('resize', handleResize, { passive: true });
        }
      }
      
      // Mobilde kısaltılmış metin
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        countBadge.textContent = `${collapsedCount} form • ⬇`;
      } else {
        countBadge.textContent = `${collapsedCount} kapalı form var • Aşağı kaydırın`;
      }
      // Header'a badge class'ı ekle
      header.classList.add('has-badge');
    } else {
      // Badge yoksa header'dan class'ı kaldır
      header.classList.remove('has-badge');
      if (countBadge) {
        countBadge.textContent = '';
      }
    }
  }

  // Create shareholder form element
  function createShareholderForm(index) {
    const form = document.createElement("div");
    form.className = "wdp-shareholder-form";
    form.setAttribute("data-index", index);

    // İlk form açık, diğerleri kapalı
    const isFirst = index === 1;
    if (!isFirst) {
      form.classList.add("collapsed");
    }

    // Daha hızlı yükleme için basit HTML yapısı
    form.innerHTML = `
      <div class="wdp-shareholder-header">
        <h3>${index}. Hissedar Bilgileri <span class='wdp-shareholder-icon'></span></h3>
        <button type="button" class="wdp-shareholder-toggle">
          <span>${isFirst ? "▼" : "▶"}</span>
        </button>
      </div>
      <div class="wdp-shareholder-content" ${!isFirst ? 'style="display: none;"' : ''}>
        <input type="text" name="shareholder_name_${index}" placeholder="Ad Soyad *" autocomplete="name" required />
        <input type="tel" name="shareholder_phone_${index}" placeholder="Telefon Numarası *" autocomplete="tel" required />
        <textarea name="shareholder_note_${index}" rows="2" placeholder="Not (isteğe bağlı)"></textarea>
        <button type="button" class="wdp-copy-form-btn">
          📋 Kopyasını Oluştur
        </button>
      </div>
    `;

    // Input'ları hemen aktif hale getir
    const nameInput = form.querySelector('input[type="text"]');
    const phoneInput = form.querySelector('input[type="tel"]');
    
    if (nameInput) {
      nameInput.style.pointerEvents = 'auto';
      nameInput.style.opacity = '1';
      nameInput.style.visibility = 'visible';
      nameInput.removeAttribute('readonly');
      nameInput.removeAttribute('disabled');
    }
    
    if (phoneInput) {
      phoneInput.style.pointerEvents = 'auto';
      phoneInput.style.opacity = '1';
      phoneInput.style.visibility = 'visible';
      phoneInput.removeAttribute('readonly');
      phoneInput.removeAttribute('disabled');
    }

    return form;
  }

  // Toggle shareholder form (accordion logic)
  function toggleShareholderForm(form) {
    if (!form) return;

    safeLog('Toggle form called for:', form.getAttribute('data-index'));

    // Tüm formları bul
    const container = form.closest('.wdp-shareholders-scroll') || form.closest('.wdp-shareholders-container');
    if (!container) return;

    const allForms = container.querySelectorAll('.wdp-shareholder-form');
    
    // Tıklanan formun mevcut durumunu kontrol et
    const isCurrentlyCollapsed = form.classList.contains('collapsed');
    const clickedFormIndex = parseInt(form.getAttribute('data-index'), 10);

    // Accordion mantığı: Sadece bir form açık olabilir
    if (isCurrentlyCollapsed) {
      // Form kapalıysa: Tüm formları kapat, tıklanan formu aç
      allForms.forEach((otherForm) => {
        if (otherForm === form) {
          // Tıklanan formu aç
          otherForm.classList.remove('collapsed');
          const contentEl = otherForm.querySelector('.wdp-shareholder-content');
          const toggleSpanEl = otherForm.querySelector('.wdp-shareholder-toggle span');
          if (contentEl) {
            contentEl.style.display = 'grid';
          }
          if (toggleSpanEl) {
            toggleSpanEl.textContent = '▼';
          }
        } else {
          // Diğer formları kapat
          otherForm.classList.add('collapsed');
          const contentEl = otherForm.querySelector('.wdp-shareholder-content');
          const toggleSpanEl = otherForm.querySelector('.wdp-shareholder-toggle span');
          if (contentEl) {
            contentEl.style.display = 'none';
          }
          if (toggleSpanEl) {
            toggleSpanEl.textContent = '▶';
          }
        }
      });
    } else {
      // Form açıksa: Eğer ilk form değilse, ilk formu aç
      if (clickedFormIndex !== 1) {
        const firstForm = container.querySelector('.wdp-shareholder-form[data-index="1"]');
        if (firstForm) {
          // Tüm formları kapat
          allForms.forEach((otherForm) => {
            otherForm.classList.add('collapsed');
            const contentEl = otherForm.querySelector('.wdp-shareholder-content');
            const toggleSpanEl = otherForm.querySelector('.wdp-shareholder-toggle span');
            if (contentEl) {
              contentEl.style.display = 'none';
            }
            if (toggleSpanEl) {
              toggleSpanEl.textContent = '▶';
            }
          });
          // İlk formu aç
          firstForm.classList.remove('collapsed');
          const contentEl = firstForm.querySelector('.wdp-shareholder-content');
          const toggleSpanEl = firstForm.querySelector('.wdp-shareholder-toggle span');
          if (contentEl) {
            contentEl.style.display = 'grid';
          }
          if (toggleSpanEl) {
            toggleSpanEl.textContent = '▼';
          }
        }
      }
      // İlk form açıksa hiçbir şey yapma
    }

    const root = form.closest('.wdp-modal, .wdp-donation-form');
    if (root) {
      updateShareholdersScrollable(root);
      // Kapalı form sayısını güncelle
      const shareholdersList = form.closest('.wdp-shareholders-scroll') || container.querySelector('.wdp-shareholders-scroll');
      updateCollapsedFormsCount(root, shareholdersList);
    }
  }

  // Setup shareholder toggles
  function setupShareholderToggles() {
    const shareholderForms = document.querySelectorAll(".wdp-shareholder-form");

    shareholderForms.forEach((form) => {
      const header = form.querySelector(".wdp-shareholder-header");
      const toggle = form.querySelector(".wdp-shareholder-toggle");

      if (header && toggle) {
        // Önceki event listener'ları temizle
        const newHeader = header.cloneNode(true);
        const newToggle = newHeader.querySelector(".wdp-shareholder-toggle");
        header.parentNode.replaceChild(newHeader, header);
        
        // Yeni referansları al
        const updatedHeader = form.querySelector(".wdp-shareholder-header");
        const updatedToggle = form.querySelector(".wdp-shareholder-toggle");

        // Header'a tıklama event'i ekle
        updatedHeader.addEventListener("click", (e) => {
          // Eğer tıklanan element toggle butonu veya onun içindeki bir element ise
          if (e.target === updatedToggle || updatedToggle.contains(e.target)) {
            return;
          }
          toggleShareholderForm(form);
        });

        // Toggle butonuna tıklama event'i ekle
        updatedToggle.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation(); // Event'in header'a yayılmasını engelle
          toggleShareholderForm(form);
        });
      }

      // Kopyasını oluştur butonu için event listener'ları ekle
      setupCopyFormButton(form);
    });
  }

  // Setup copy form button
  function setupCopyFormButton(form) {
    const nameInput = form.querySelector('input[type="text"]');
    const phoneInput = form.querySelector('input[type="tel"]');
    const copyBtn = form.querySelector('.wdp-copy-form-btn');

    if (!nameInput || !phoneInput || !copyBtn) return;

    // Önceki event listener'ları temizle
    const newCopyBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
    newCopyBtn.disabled = true;
    newCopyBtn.classList.remove('is-active');
    newCopyBtn.style.display = 'none';

    // Event listener'ları direkt ekle - clone işlemi yok
    const checkFields = () => {
      const nameValue = nameInput.value.trim();
      const phoneValue = phoneInput.value.trim();
      
      const isReady = Boolean(nameValue && phoneValue);
      newCopyBtn.disabled = !isReady;
      newCopyBtn.classList.toggle('is-active', isReady);
      newCopyBtn.style.display = isReady ? 'inline-flex' : 'none';
      newCopyBtn.style.opacity = isReady ? '1' : '0';
      newCopyBtn.style.pointerEvents = isReady ? 'auto' : 'none';
    };

    // Event listener'ları ekle
    nameInput.addEventListener('input', checkFields);
    phoneInput.addEventListener('input', checkFields);

    // Sayfa yüklendiğinde mevcut değerleri kontrol et
    checkFields();

    // Kopyasını oluştur butonuna tıklama
    newCopyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Mevcut form verilerini al
      const nameValue = nameInput.value.trim();
      const phoneValue = phoneInput.value.trim();
      const noteValue = form.querySelector('textarea').value.trim();
      
      if (!nameValue || !phoneValue) {
        return;
      }
      
      // Yeni form oluştur
      duplicateShareholderForm(form, nameValue, phoneValue, noteValue);
    });
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
    const newNoteTextarea = newForm.querySelector('textarea');
    
    if (newNameInput) newNameInput.value = nameValue;
    if (newPhoneInput) newPhoneInput.value = phoneValue;
    if (newNoteTextarea) newNoteTextarea.value = noteValue;

    // Yeni formu listeye ekle ve toggle'ları yeniden bağla
    list.appendChild(newForm);
    setupShareholderToggles();
    
    const contextRoot = container.closest('.wdp-modal') || container.closest('.wdp-donation-form');
    updateShareholdersScrollable(contextRoot);
    
    requestAnimationFrame(() => {
      toggleShareholderForm(newForm);
      newForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    const newCopyBtn = newForm.querySelector('.wdp-copy-form-btn');
    if (newCopyBtn) {
      newCopyBtn.disabled = false;
      newCopyBtn.classList.add('is-active');
    }

    // Hisse adedini güncelle - Global fonksiyonu kullan
    safeLog(`Kopyalama sonrası hisse adedi güncelleniyor: ${newIndex}`);
    
    // 1. Önce global fonksiyonu dene
    if (typeof window.updateShareCountForModal === 'function') {
      window.updateShareCountForModal(newIndex);
      safeLog(`Global fonksiyon ile hisse adedi güncellendi: ${newIndex}`);
    } else {
      // 2. Fallback - Manuel güncelleme
      const allShareCountInputs = document.querySelectorAll('input[name="share_count"]');
      allShareCountInputs.forEach(input => {
        input.value = newIndex;
        // Event'leri tetikle
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        safeLog(`Manuel hisse adedi güncellendi: ${newIndex}`);
      });
    }
    
    // 3. Ek güvenlik - Modal içindeki tüm input'ları kontrol et
    const modal = container.closest('.wdp-modal');
    if (modal) {
      const modalShareInputs = modal.querySelectorAll('input[name="share_count"]');
      modalShareInputs.forEach(input => {
        input.value = newIndex;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        safeLog(`Modal içi hisse adedi güncellendi: ${newIndex}`);
      });
    }
    
    // 4. Quantity input'unu da güncelle
    const quantityInput = container.closest('.wdp-donation-form').querySelector('input[name="quantity"]');
    if (quantityInput) {
      quantityInput.value = newIndex;
      safeLog(`Quantity input güncellendi: ${newIndex}`);
    }
    
    // Fiyat hesaplamasını manuel olarak yap
    const priceInput = container.closest('.wdp-donation-form').querySelector('input[name="custom_price"]');
    
    if (priceInput) {
      // Mevcut fiyatı al ve hisse başına düşen fiyatı hesapla
      const currentPrice = parseFloat(priceInput.value) || 0;
      const currentShares = parseFloat(newIndex) || 1;
      const basePrice = currentPrice / currentShares;
      
      // Yeni toplam fiyatı hesapla
      const totalPrice = basePrice * newIndex;
      priceInput.value = totalPrice.toFixed(0);
      safeLog(`Fiyat güncellendi: ${totalPrice} TL (${basePrice} TL x ${newIndex} hisse)`);
    }

    safeLog(`Hissedar formu kopyalandı: ${newIndex}. Hissedar (açık olarak)`);
  }

  // Update shareholder forms (internal function used by setupShareQuantityButtons)
  function updateShareholderFormsInternal(modal) {
    // Güncel share count input'unu bul
    const currentShareCountInput = modal.querySelector('input[name="share_count"]');
    const shareCount = Number.parseInt(currentShareCountInput.value, 10) || 1;
    safeLog("Updating shareholder forms for count:", shareCount);

    // Maksimum 7 hissedar kontrolü
    if (shareCount > 7) {
      currentShareCountInput.value = 7;
      return updateShareholderFormsInternal(modal);
    }

    // Hissedar formları konteynerini bul
    const shareholdersContainer = modal.querySelector(".wdp-shareholders-container");
    if (!shareholdersContainer) return;
    const shareholdersList = ensureShareholderList(shareholdersContainer);
    if (!shareholdersList) return;

    // Mevcut form sayısını kontrol et
    const existingForms = shareholdersList.querySelectorAll(".wdp-shareholder-form");
    const existingCount = existingForms.length;
    safeLog("Existing forms:", existingCount, "New count:", shareCount);

    if (shareCount > existingCount) {
      // Yeni formlar ekle
      for (let i = existingCount + 1; i <= shareCount; i++) {
        const newForm = createShareholderForm(i);
        shareholdersList.appendChild(newForm);
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
    }

    // Form toggle olaylarını yeniden ayarla
    setupShareholderToggles();
    
    // CRITICAL: Update scrollable class immediately - BEFORE browser renders
    // This prevents modal expansion by applying height constraints instantly
    const shareholdersArea = shareholdersContainer.closest('.wdp-shareholders-area');
    if (shareholdersArea && shareCount > 1) {
      // Immediately add scrollable class before updateShareholdersScrollable
      shareholdersArea.classList.add('scrollable');
      shareholdersContainer.classList.add('scrollable');
    } else if (shareholdersArea && shareCount <= 1) {
      // Remove scrollable class when count is 1
      shareholdersArea.classList.remove('scrollable');
      shareholdersContainer.classList.remove('scrollable');
    }
    
    // Then update scrollable state (this will clean up and ensure consistency)
    updateShareholdersScrollable(modal);
  }

  // Setup share quantity buttons
  function setupShareQuantityButtons(modal, shareCountInput, baseProductPrice, priceInput) {
    safeLog("Setting up share quantity buttons for modal:", modal.id);
    
    // Hisse adedi artırma/azaltma butonlarını bul
    const decreaseBtn = modal.querySelector(".wdp-share-btn.decrease");
    const increaseBtn = modal.querySelector(".wdp-share-btn.increase");

    // Quantity input'unu bul
    const quantityInput = modal.querySelector('input[name="quantity"]');
    
    safeLog("Found buttons:", {
      decreaseBtn: !!decreaseBtn,
      increaseBtn: !!increaseBtn,
      quantityInput: !!quantityInput
    });

    // Input değişikliğini dinle - Önce eski event listener'ları temizle
    let activeShareCountInput =
      shareCountInput && shareCountInput.parentNode
        ? shareCountInput
        : modal.querySelector('input[name="share_count"]');
    if (!activeShareCountInput) {
      safeLog("Share count input not found for setupShareQuantityButtons");
      return;
    }

    const newShareCountInput = activeShareCountInput.cloneNode(true);
    if (activeShareCountInput.parentNode) {
      activeShareCountInput.parentNode.replaceChild(newShareCountInput, activeShareCountInput);
    }
    
    // Yeni input referansını güncelle
    const updatedShareCountInput = modal.querySelector('input[name="share_count"]');
    
    // Event listener'ları temizleme fonksiyonu
    function removeAllEventListeners(element) {
      const newElement = element.cloneNode(true);
      if (element.parentNode) {
        element.parentNode.replaceChild(newElement, element);
      }
      return newElement;
    }
    
    // Önce mevcut event listener'ları temizleyelim
    let newDecreaseBtn = null;
    let newIncreaseBtn = null;
    
    if (decreaseBtn) {
      newDecreaseBtn = removeAllEventListeners(decreaseBtn);
    }

    if (increaseBtn) {
      newIncreaseBtn = removeAllEventListeners(increaseBtn);
    }
    
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
    }
    
    // Decrease butonu event listener'ı
    if (newDecreaseBtn) {
      newDecreaseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeLog("Decrease button clicked");
        const currentValue = Number.parseInt(updatedShareCountInput.value, 10) || 1;
        if (currentValue > 1) {
          const newValue = currentValue - 1;
          updateShareCount(newValue);
        }
      });
    }

    // Increase butonu event listener'ı
    if (newIncreaseBtn) {
      newIncreaseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeLog("Increase button clicked");
        const currentValue = Number.parseInt(updatedShareCountInput.value, 10) || 1;
        if (currentValue < 7) {
          const newValue = currentValue + 1;
          updateShareCount(newValue);
        }
      });
    }
    
    // Input değişikliği event listener'ı
    if (updatedShareCountInput) {
      updatedShareCountInput.addEventListener("input", function () {
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
      });
    }

    // Form toggle olaylarını ekle
    setupShareholderToggles();

    // Hisse adedine göre fiyatı güncelle
    function updatePriceBasedOnShareCount() {
      if (!priceInput) return;

      // Güncel hisse adedini al
      const currentShareCountInput = modal.querySelector('input[name="share_count"]');
      const shareCount = Number.parseInt(currentShareCountInput.value, 10) || 1;

      const baseMinValue = Number.parseFloat((priceInput.dataset.baseMin || '').toString().trim());
      const perShareFallback = Number.isFinite(baseMinValue) && baseMinValue > 0
        ? baseMinValue
        : Number.parseFloat((baseProductPrice || 0).toString());

      const effectiveMin = Number.isFinite(perShareFallback) && perShareFallback > 0
        ? perShareFallback * shareCount
        : 0;

      let totalPrice = Number.parseFloat((baseProductPrice || 0).toString()) * shareCount;

      if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
        totalPrice = effectiveMin;
      }

      if (effectiveMin > 0 && (!Number.isFinite(totalPrice) || totalPrice < effectiveMin)) {
        totalPrice = effectiveMin;
      }

      safeLog("Fiyat güncelleniyor:", baseProductPrice, "x", shareCount, "=", totalPrice, "(min:", effectiveMin, ")");

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

    // Başlangıç değerlerini ayarla
    const currentShareCountInput = modal.querySelector('input[name="share_count"]');
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
      safeLog("=== SETUP SHAREHOLDER FORMS START ===");
      safeLog("Modal ID:", modal.id);
      safeLog("Product ID:", productId);
      
      // Ürün ID'sini integer'a çevir
      productId = Number.parseInt(productId, 10);

      // Hisse adedi input'unu bul
      const shareCountInput = modal.querySelector('input[name="share_count"]');
      if (!shareCountInput) {
        safeLog("ERROR: Share count input not found in modal:", modal.id);
        safeLog("Modal HTML preview:", modal.innerHTML.substring(0, 300));
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
      let shareholdersContainer = modal.querySelector(".wdp-shareholders-container");
      if (!shareholdersContainer) {
        safeLog("Shareholders container not found on first try, retrying...");
        // Biraz bekle ve tekrar dene (DOM henüz hazır olmayabilir)
        await new Promise(resolve => setTimeout(resolve, 50));
        shareholdersContainer = modal.querySelector(".wdp-shareholders-container");
        if (!shareholdersContainer) {
          safeLog("ERROR: Shareholders container not found in modal after retry:", modal.id);
          safeLog("Modal HTML:", modal.innerHTML.substring(0, 500));
          safeLog("Searching for .wdp-shares-section:", modal.querySelector(".wdp-shares-section"));
          return;
        }
      }
      safeLog("Shareholders container found:", shareholdersContainer);
      const shareholdersList = ensureShareholderList(shareholdersContainer);
      safeLog("Shareholders list ensured:", shareholdersList);

      // Başlangıç değerini 1 olarak ayarla ve event'leri tetikle
      shareCountInput.value = "1";
      shareCountInput.dispatchEvent(new Event('input', { bubbles: true }));
      shareCountInput.dispatchEvent(new Event('change', { bubbles: true }));
      safeLog("Initial share count set to 1");

      // Mevcut içeriği temizle
      shareholdersList.innerHTML = "";

      // İlk hissedar formunu hemen oluştur
      const firstForm = createShareholderForm(1);
      shareholdersList.appendChild(firstForm);
      safeLog("First shareholder form created");
      
      cacheShareholdersBaseHeight(shareholdersContainer);

      // Hemen event listener'ları ekle
      setupShareholderToggles();
      
      // Scrollable class'ını güncelle
      updateShareholdersScrollable(modal);

      // Fiyat alanını bul
      const priceInput = modal.querySelector('input[name="custom_price"]');

      // Ürün ID'sini al
      const productIdInput = modal.querySelector('input[name="add-to-cart"]');
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
          })
          .catch((error) => {
            safeLog("Error fetching product price:", error);
          });
      }

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
      values[i] = {
        name: form.querySelector('input[type="text"]')?.value || '',
        phone: form.querySelector('input[type="tel"]')?.value || '',
        note: form.querySelector('textarea')?.value || ''
      };
    }

    // Form sayısı artarsa: sadece yeni form(lar) ekle
    if (shareCount > existingCount) {
      for (let i = existingCount + 1; i <= shareCount; i++) {
        var newForm = createShareholderForm(i);
        shareholdersList.appendChild(newForm);
        // Yeni form için event listener'ları ekle
        setupCopyFormButton(newForm);
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
      const noteInput = form.querySelector('textarea');
      if (values[i]) {
        if (nameInput) nameInput.value = values[i].name;
        if (phoneInput) phoneInput.value = values[i].phone;
        if (noteInput) noteInput.value = values[i].note;
      }
      // Event listener'ları tekrar ekle (gerekirse)
      setupCopyFormButton(form);
    }

    // Form toggle olaylarını ekle (sadece yeni eklenenler için)
    setupShareholderToggles();

    // Accordion mantığı: Sadece ilk form açık olsun, diğerleri kapalı
    var allForms = shareholdersList.querySelectorAll(".wdp-shareholder-form");
    allForms.forEach((form, index) => {
      const formIndex = parseInt(form.getAttribute('data-index'), 10);
      if (formIndex === 1) {
        // İlk form açık
        form.classList.remove("collapsed");
        var contentEl = form.querySelector(".wdp-shareholder-content");
        var toggleSpanEl = form.querySelector(".wdp-shareholder-toggle span");
        if (contentEl) {
          contentEl.style.display = "grid";
        }
        if (toggleSpanEl) {
          toggleSpanEl.textContent = "▼";
        }
      } else {
        // Diğer formlar kapalı
        form.classList.add("collapsed");
        var contentEl = form.querySelector(".wdp-shareholder-content");
        var toggleSpanEl = form.querySelector(".wdp-shareholder-toggle span");
        if (contentEl) {
          contentEl.style.display = "none";
        }
        if (toggleSpanEl) {
          toggleSpanEl.textContent = "▶";
        }
      }
    });

    // Scrollable class'ını güncelle
    const modal = container.closest('.wdp-modal') || container.closest('.wdp-donation-form');
    updateShareholdersScrollable(modal);
    
    // Kapalı form sayısını güncelle
    updateCollapsedFormsCount(modal, shareholdersList);
  }

  // Setup direct shareholder forms
  function setupDirectShareholderForms(formContainer, productId, productData) {
    // Popup ile aynı setupShareholderForms fonksiyonunu kullan
    setupShareholderForms(formContainer, productId);
  }

  // Export
  WDPApp.shareholder = {
    ensureList: ensureShareholderList,
    setup: setupShareholderForms,
    setupQuantityButtons: setupShareQuantityButtons,
    createForm: createShareholderForm,
    toggleForm: toggleShareholderForm,
    setupToggles: setupShareholderToggles,
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
  };

  console.log('✅ WDP: shareholder.js loaded');
  console.log('📦 WDP: WDPApp.shareholder exported:', !!WDPApp.shareholder);
  console.log('🔧 WDP: setupShareholderForms function:', typeof WDPApp.shareholder.setup);

})(window);

