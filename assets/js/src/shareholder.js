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
    ? WDPApp.utils.ensureModule('utils', ['safeLog', 'formatCurrency'])
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
  const { safeLog, formatCurrency } = utils;
  const { productPrices, shareholdersResizeBound } = state;
  const { getData: getProductInfoData } = product;

  // Constants
  const SHAREHOLDER_SCROLL_CONFIG = {
    min: 260,
    max: 440,
    ratio: 0.6,
  };

  // Helper: Ensure shareholder list container exists
  function ensureShareholderList(container) {
    if (!container) return null;
    
    // CRITICAL: Container'ın görünürlüğünü garanti et
    container.style.display = '';
    container.style.visibility = 'visible';
    container.style.opacity = '1';
    
    // CRITICAL: Parent area'nın da görünür olduğundan emin ol
    const shareholdersArea = container.closest('.wdp-shareholders-area');
    if (shareholdersArea) {
      shareholdersArea.style.display = 'flex';
      shareholdersArea.style.visibility = 'visible';
      shareholdersArea.style.opacity = '1';
    }
    
    let list = container.querySelector(".wdp-shareholders-scroll");
    if (list) {
      // Mevcut listeyi görünür yap
      list.style.display = '';
      list.style.visibility = 'visible';
      list.style.opacity = '1';
      return list;
    }

    list = document.createElement("div");
    list.className = "wdp-shareholders-scroll";
    // Yeni listeyi görünür yap
    list.style.display = '';
    list.style.visibility = 'visible';
    list.style.opacity = '1';

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
        requestAnimationFrame(() => {
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
            
            // CRITICAL: Scroll container'ın height'ını 1. formun yüksekliği kadar yap
            // Böylece 2. formun header'ı görünmez, sadece scroll yapınca görünür
            // ABSOLUTE FIX: Formun border'ı dahil tüm yüksekliği al (border görünür olsun)
            const firstFormHeight = firstForm.offsetHeight;
            // CRITICAL: Formun border'ı görünür olsun - scrollHeight'e 1px ekle (border için)
            // Böylece 1. formun alt border'ı scroll container içinde görünür
            const scrollHeight = Math.min(firstFormHeight + 1, areaHeightValue);
            shareholdersList.style.maxHeight = scrollHeight + 'px';
            shareholdersList.style.height = scrollHeight + 'px';
            
            // CRITICAL: Shareholders-container'ın height'ını da ayarla (boşluk olmasın)
            const shareholdersContainer = shareholdersList.closest('.wdp-shareholders-container');
            if (shareholdersContainer) {
              shareholdersContainer.style.height = scrollHeight + 'px';
              shareholdersContainer.style.maxHeight = scrollHeight + 'px';
            }
          }
        });
      } else {
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
        countBadge.style.display = 'none'; // CRITICAL: Badge'i tamamen gizle
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
      }
      // CRITICAL: Badge'i göster
      countBadge.style.display = 'inline-block';
      
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
        countBadge.style.display = 'none'; // CRITICAL: Badge'i tamamen gizle
      }
    }
  }

  // Create shareholder form element
  function createShareholderForm(index) {
    const form = document.createElement("div");
    form.className = "wdp-shareholder-form";
    form.setAttribute("data-index", index);

    // CRITICAL: Form'un görünürlüğünü garanti et
    form.style.display = '';
    form.style.visibility = 'visible';
    form.style.opacity = '1';

    // İlk form açık, diğerleri kapalı
    const isFirst = index === 1;
    if (!isFirst) {
      form.classList.add("collapsed");
    }

    // Daha hızlı yükleme için basit HTML yapısı
    form.innerHTML = `
      <div class="wdp-shareholder-header">
        <h3>${index}. Hissedar Bilgileri <span class='wdp-shareholder-icon'></span></h3>
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
    if (modal && shareholdersList) {
      updateCollapsedFormsCount(modal, shareholdersList);
    }
  }

  // Setup shareholder header click handler
  function setupShareholderHeaderClick(form) {
    const header = form.querySelector('.wdp-shareholder-header');
    if (!header) return;
    
    // Önceki event listener'ları temizle
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);
    
    // Click event listener ekle
    newHeader.addEventListener('click', (e) => {
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

    // Yeni formu listeye ekle
    list.appendChild(newForm);
    setupCopyFormButton(newForm);
    setupShareholderHeaderClick(newForm);

    const newCopyBtn = newForm.querySelector('.wdp-copy-form-btn');
    if (newCopyBtn) {
      newCopyBtn.disabled = false;
      newCopyBtn.classList.add('is-active');
    }

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
      shareholdersArea.style.display = 'flex';
      shareholdersArea.style.flexDirection = 'column';
      shareholdersArea.style.visibility = 'visible';
      shareholdersArea.style.opacity = '1';
      shareholdersArea.removeAttribute('hidden');
    }
    
    // CRITICAL: Container ve list görünürlüğünü garanti et
    if (container) {
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      container.removeAttribute('hidden');
    }
    
    if (list) {
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.visibility = 'visible';
      list.style.opacity = '1';
      list.removeAttribute('hidden');
    }
    
    // CRITICAL: ÖNCE orijinal formu kesinlikle kapat
    originalForm.classList.add('collapsed');
    const originalContent = originalForm.querySelector('.wdp-shareholder-content');
    if (originalContent) {
      originalContent.style.display = 'none';
      originalContent.style.visibility = 'hidden';
      originalContent.style.opacity = '0';
    }
    
    // CRITICAL: Tüm diğer formları da kapat (yeni form hariç)
    const allForms = list.querySelectorAll('.wdp-shareholder-form');
    allForms.forEach((form) => {
      if (form !== newForm) {
        form.classList.add('collapsed');
        const content = form.querySelector('.wdp-shareholder-content');
        if (content) {
          content.style.display = 'none';
          content.style.visibility = 'hidden';
          content.style.opacity = '0';
        }
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
      updateCollapsedFormsCount(contextRoot, list);
    }
    
    // CRITICAL: Son bir kez daha kontrol et ve garanti et
    requestAnimationFrame(() => {
      // Orijinal formu kesinlikle kapat
      originalForm.classList.add('collapsed');
      const origContent = originalForm.querySelector('.wdp-shareholder-content');
      if (origContent) {
        origContent.style.display = 'none';
        origContent.style.visibility = 'hidden';
        origContent.style.opacity = '0';
      }
      
      // Yeni formu kesinlikle aç
      newForm.classList.remove('collapsed');
      const newCont = newForm.querySelector('.wdp-shareholder-content');
      if (newCont) {
        newCont.style.display = 'flex';
        newCont.style.visibility = 'visible';
        newCont.style.opacity = '1';
      }
      
      // Yeni formu görünür alana scroll et
      newForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      safeLog(`Hissedar formu kopyalandı: ${newIndex}. Hissedar (açık olarak), ${currentCount}. Hissedar (kapalı)`);
    });
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
    shareholdersContainer.style.display = '';
    shareholdersContainer.style.visibility = 'visible';
    shareholdersContainer.style.opacity = '1';
    shareholdersList.style.display = '';
    shareholdersList.style.visibility = 'visible';
    shareholdersList.style.opacity = '1';
    
    const shareholdersArea = shareholdersContainer.closest('.wdp-shareholders-area');
    if (shareholdersArea) {
      shareholdersArea.style.display = 'flex';
      shareholdersArea.style.visibility = 'visible';
      shareholdersArea.style.opacity = '1';
    }
    
    // CRITICAL: Sadece 1. form gösterilsin - diğer formlar oluşturulur ama gizlenir
    if (shareCount > existingCount) {
      // Yeni formlar ekle
      for (let i = existingCount + 1; i <= shareCount; i++) {
        const newForm = createShareholderForm(i);
        // Sadece 1. form görünür, diğerleri gizli
        if (i > 1) {
          newForm.style.display = '';
          newForm.style.visibility = 'visible';
          newForm.style.opacity = '1';
          newForm.classList.add('collapsed');
          const content = newForm.querySelector('.wdp-shareholder-content');
          if (content) {
            content.style.display = 'none';
          }
        }
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
    
    // CRITICAL: Sadece 1. form görünür olsun - ama scroll için tüm formlar DOM'da görünür olmalı
    // Scroll çalışması için tüm formlar görünür olmalı, sadece içerikleri gizli olmalı
    const allForms = shareholdersList.querySelectorAll('.wdp-shareholder-form');
    allForms.forEach((form, idx) => {
      const formIndex = parseInt(form.getAttribute('data-index'), 10);
      if (formIndex === 1) {
        // CRITICAL: Hisse adedi 1'e düştüğünde 1. form kapalıysa otomatik aç
        form.style.display = '';
        form.style.visibility = 'visible';
        form.style.opacity = '1';
        form.classList.remove('collapsed');
        const content = form.querySelector('.wdp-shareholder-content');
        if (content) {
          content.style.display = 'flex';
          content.style.visibility = 'visible';
          content.style.opacity = '1';
        }
      } else {
        // Scroll için form görünür olmalı ama içeriği gizli
        form.style.display = '';
        form.style.visibility = 'visible';
        form.style.opacity = '1';
        form.classList.add('collapsed');
        const content = form.querySelector('.wdp-shareholder-content');
        if (content) {
          content.style.display = 'none';
        }
      }
    });

    // Copy button ve header click event listener'larını ekle
    const allFormsForCopy = shareholdersList.querySelectorAll('.wdp-shareholder-form');
    allFormsForCopy.forEach((form) => {
      setupCopyFormButton(form);
      setupShareholderHeaderClick(form);
    });
    
    // CRITICAL: Update scrollable class immediately - BEFORE browser renders
    // This prevents modal expansion by applying height constraints instantly
    // shareholdersArea'yı yukarıda zaten tanımladık, tekrar tanımlamaya gerek yok
    if (shareholdersArea && shareCount > 1) {
      // Immediately add scrollable class before updateShareholdersScrollable
      shareholdersArea.classList.add('scrollable');
      shareholdersContainer.classList.add('scrollable');
    } else if (shareholdersArea && shareCount <= 1) {
      // Remove scrollable class when count is 1
      shareholdersArea.classList.remove('scrollable');
      shareholdersContainer.classList.remove('scrollable');
      // CRITICAL: ShareCount 1'e düştüğünde container'ların görünürlüğünü garanti et
      shareholdersArea.style.display = 'flex';
      shareholdersArea.style.visibility = 'visible';
      shareholdersArea.style.opacity = '1';
      shareholdersContainer.style.display = '';
      shareholdersContainer.style.visibility = 'visible';
      shareholdersContainer.style.opacity = '1';
      shareholdersList.style.display = '';
      shareholdersList.style.visibility = 'visible';
      shareholdersList.style.opacity = '1';
    }
    
    // Then update scrollable state (this will clean up and ensure consistency)
    updateShareholdersScrollable(modal);
  }

  // Setup share quantity buttons
  function setupShareQuantityButtons(modal, shareCountInput, baseProductPrice, priceInput) {
    // ✅ GÜVENLİ: Fonksiyon scope içinde helper (fonksiyon bitince otomatik temizlenir)
    const $modal = (sel) => modal.querySelector(sel);
    
    safeLog("Setting up share quantity buttons for modal:", modal.id);
    
    // Hisse adedi artırma/azaltma butonlarını bul
    const decreaseBtn = $modal(".wdp-share-btn.decrease");
    const increaseBtn = $modal(".wdp-share-btn.increase");

    // Quantity input'unu bul
    const quantityInput = $modal('input[name="quantity"]');
    
    safeLog("Found buttons:", {
      decreaseBtn: !!decreaseBtn,
      increaseBtn: !!increaseBtn,
      quantityInput: !!quantityInput
    });

    // Input değişikliğini dinle - Önce eski event listener'ları temizle
    let activeShareCountInput =
      shareCountInput && shareCountInput.parentNode
        ? shareCountInput
        : $modal('input[name="share_count"]');
    if (!activeShareCountInput) {
      safeLog("Share count input not found for setupShareQuantityButtons");
      return;
    }

    const newShareCountInput = activeShareCountInput.cloneNode(true);
    if (activeShareCountInput.parentNode) {
      activeShareCountInput.parentNode.replaceChild(newShareCountInput, activeShareCountInput);
    }
    
    // Yeni input referansını güncelle
    const updatedShareCountInput = $modal('input[name="share_count"]');
    
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
        safeLog("Modal HTML:", modal.outerHTML.substring(0, 500));
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
        sharesSection.style.display = 'flex';
        sharesSection.style.flexDirection = 'column';
        sharesSection.style.visibility = 'visible';
        sharesSection.style.opacity = '1';
        sharesSection.removeAttribute('hidden');
        safeLog("Shares section made visible with flex display");
      }
      
      const sharesHeader = $modal('.wdp-shares-header');
      if (sharesHeader) {
        sharesHeader.style.display = 'grid';
        sharesHeader.style.visibility = 'visible';
        sharesHeader.style.opacity = '1';
        sharesHeader.removeAttribute('hidden');
        safeLog("Shares header made visible with grid display");
      }
      
      // CRITICAL: Share counter input'unu görünür yap ve değeri göster
      const shareCounter = $modal('.wdp-share-counter');
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
          // CRITICAL: Input değerinin görünür olmasını garanti et
          shareCountInputInCounter.style.webkitTextFillColor = '#1f2937';
          safeLog("Share counter input made visible");
        }
      }
      
      // Hissedar alanını da görünür yap
      const shareholdersArea = shareholdersContainer.closest('.wdp-shareholders-area');
      if (shareholdersArea) {
        shareholdersArea.style.display = 'flex';
        shareholdersArea.style.flexDirection = 'column';
        shareholdersArea.style.visibility = 'visible';
        shareholdersArea.style.opacity = '1';
        shareholdersArea.removeAttribute('hidden');
        safeLog("Shareholders area made visible");
      }
      
      // Container'ı görünür yap
      shareholdersContainer.style.display = 'flex';
      shareholdersContainer.style.flexDirection = 'column';
      shareholdersContainer.style.visibility = 'visible';
      shareholdersContainer.style.opacity = '1';
      shareholdersContainer.removeAttribute('hidden');
      safeLog("Shareholders container made visible");
      
      // Hissedar listesini oluştur veya bul
      const shareholdersList = ensureShareholderList(shareholdersContainer);
      if (!shareholdersList) {
        safeLog("ERROR: Could not ensure shareholder list in container");
        return;
      }
      
      // CRITICAL: Shareholders list'i görünür yap
      shareholdersList.style.display = 'flex';
      shareholdersList.style.flexDirection = 'column';
      shareholdersList.style.visibility = 'visible';
      shareholdersList.style.opacity = '1';
      shareholdersList.removeAttribute('hidden');
      safeLog("Shareholders list made visible");

      // Başlangıç değerini 1 olarak ayarla ve event'leri tetikle
      shareCountInput.value = "1";
      // CRITICAL: Input görünürlüğünü garanti et
      shareCountInput.style.visibility = 'visible';
      shareCountInput.style.opacity = '1';
      shareCountInput.style.color = '#1f2937';
      shareCountInput.style.display = 'block';
      shareCountInput.style.webkitTextFillColor = '#1f2937';
      shareCountInput.removeAttribute('hidden');
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
        firstForm.style.display = '';
        firstForm.style.visibility = 'visible';
        firstForm.style.opacity = '1';
        firstForm.style.position = 'relative';
        safeLog("First form visibility set");
        
        // Form header'ı görünür yap
        const header = firstForm.querySelector('.wdp-shareholder-header');
        if (header) {
          header.style.display = '';
          header.style.visibility = 'visible';
          header.style.opacity = '1';
          safeLog("First form header made visible");
        }
        
        const content = firstForm.querySelector('.wdp-shareholder-content');
        if (content) {
          content.style.display = 'flex';
          content.style.visibility = 'visible';
          content.style.opacity = '1';
          safeLog("First form content made visible with flex display");
          
          // Input'ları da görünür yap
          const inputs = content.querySelectorAll('input, textarea, button');
          inputs.forEach((input, idx) => {
            input.style.display = '';
            input.style.visibility = 'visible';
            input.style.opacity = '1';
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
        // CRITICAL: Scroll için tüm formlar görünür olmalı, sadece içerikleri gizli
        // Form görünür olacak ama içeriği gizli olacak (scroll için gerekli)
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
      setupShareholderHeaderClick(form);
    }

    // CRITICAL: Sadece 1. form görünür olsun - ama scroll için tüm formlar DOM'da görünür olmalı
    // Scroll çalışması için tüm formlar görünür olmalı, sadece içerikleri gizli olmalı
    var allForms = shareholdersList.querySelectorAll(".wdp-shareholder-form");
    allForms.forEach((form) => {
      const formIndex = parseInt(form.getAttribute('data-index'), 10);
      if (formIndex === 1) {
        // CRITICAL: Hisse adedi 1'e düştüğünde 1. form kapalıysa otomatik aç
        form.style.display = '';
        form.style.visibility = 'visible';
        form.style.opacity = '1';
        form.classList.remove("collapsed");
        var contentEl = form.querySelector(".wdp-shareholder-content");
        if (contentEl) {
          contentEl.style.display = "flex";
        }
      } else {
        // Scroll için form görünür olmalı ama içeriği gizli
        form.style.display = '';
        form.style.visibility = 'visible';
        form.style.opacity = '1';
        form.classList.add("collapsed");
        var contentEl = form.querySelector(".wdp-shareholder-content");
        if (contentEl) {
          contentEl.style.display = "none";
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

  // Export shareholder module

})(window);

