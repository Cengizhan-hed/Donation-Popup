/**
 * @file forms-sync.js
 * Birden fazla hisse formundaki ortak alanları senkronize eder.
 * Dış API: WDPApp.shareholderFormsSync
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const { safeLog } = utils;

  const { registerHooks, callHook } = WDPApp.utils.createHookRegistry();

  function isSidePanelModal(modal) { return callHook('isSidePanelModal', modal); }
  function applyShareholdersAreaVisibility(area) { callHook('applyShareholdersAreaVisibility', area); }
  function applyShareholdersContainerVisibility(container) { callHook('applyShareholdersContainerVisibility', container); }
  function ensureShareholderList(container) { return callHook('ensureShareholderList', container); }
  function setupWdpPhoneFields(root) { callHook('setupWdpPhoneFields', root); }
  function createShareholderForm(index) { return callHook('createShareholderForm', index); }
  function setupCopyFormButton(form) { callHook('setupCopyFormButton', form); }
  function setupShareholderHeaderClick(form) { callHook('setupShareholderHeaderClick', form); }
  function isFormFilled(form) { return callHook('isFormFilled', form); }
  function checkShareholderFormWarning(form) { callHook('checkShareholderFormWarning', form); }
  function scheduleShareholdersScrollableUpdate(root) { callHook('scheduleShareholdersScrollableUpdate', root); }
  function updateCollapsedFormsCount(modal) { callHook('updateCollapsedFormsCount', modal); }
  function syncShareholderUnitPricesFromModal(modal) { callHook('syncShareholderUnitPricesFromModal', modal); }
  function refreshShareholderGuidance(root) { callHook('refreshShareholderGuidance', root); }

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
        if (typeof utils.scrollIntoViewSafe === 'function') {
          utils.scrollIntoViewSafe(formToScrollTo, { behavior: 'smooth', block: 'nearest' });
        } else {
          formToScrollTo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
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
    scheduleShareholdersScrollableUpdate(modal);
    
    // CRITICAL: Fiyatı güncelle (hisse adedi değiştiğinde)
    // updatePriceBasedOnShareCount fonksiyonu setupShareQuantityButtons scope'unda tanımlı
    if (typeof modal._wdpUpdateSharePrice === 'function') {
      modal._wdpUpdateSharePrice();
    }
    refreshShareholderGuidance(modal);
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
        if (typeof utils.scrollIntoViewSafe === 'function') {
          utils.scrollIntoViewSafe(formToScrollTo, { behavior: 'smooth', block: 'nearest' });
        } else {
          formToScrollTo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    // Scrollable class'ını güncelle
    const modal = container.closest('.wdp-modal') || container.closest('.wdp-donation-form');
    scheduleShareholdersScrollableUpdate(modal);
    
    // Kapalı form sayısını güncelle
    updateCollapsedFormsCount(modal);
    syncShareholderUnitPricesFromModal(modal);
    refreshShareholderGuidance(modal);
  }
  WDPApp.shareholderFormsSync = {
    registerHooks: registerHooks,
    updateShareholderFormsInternal: updateShareholderFormsInternal,
    updateShareholderForms: updateShareholderForms,
  };
})(window);
