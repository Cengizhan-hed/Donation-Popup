/**
 * @file render.js
 * Tek hisse satırı HTML üretimi ve alan bağlama.
 * Dış API: WDPApp.shareholderRender
 * Resolve WDPApp.* at call time for modules loaded later in the stack.
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const { safeLog } = utils;
  const shareholderLayout = WDPApp.shareholderLayout || {};
  const shareholderList = WDPApp.shareholderList || {};
  const shareholderScroll = WDPApp.shareholderScroll || {};
  const shareholderGuidance = WDPApp.shareholderGuidance || {};
  // Do not freeze shareholderQuantity at load — stack loads quantity after render.

  const { registerHooks, callHook, hasHook } = WDPApp.utils.createHookRegistry();

  function ensureShareholderList(container) {
    return typeof shareholderList.ensureShareholderList === 'function'
      ? shareholderList.ensureShareholderList(container) : null;
  }
  function applyShareholdersAreaVisibility(area) {
    if (typeof shareholderLayout.applyShareholdersAreaVisibility === 'function') {
      shareholderLayout.applyShareholdersAreaVisibility(area);
    }
  }
  function applyShareholdersContainerVisibility(container) {
    if (typeof shareholderLayout.applyShareholdersContainerVisibility === 'function') {
      shareholderLayout.applyShareholdersContainerVisibility(container);
    }
  }
  function updateCollapsedFormsCount(modal) {
    if (typeof shareholderScroll.updateCollapsedFormsCount === 'function') {
      shareholderScroll.updateCollapsedFormsCount(modal);
    }
  }
  function updateShareholdersScrollable(modal) {
    if (typeof shareholderScroll.updateShareholdersScrollable === 'function') {
      shareholderScroll.updateShareholdersScrollable(modal);
    }
  }
  function scheduleShareholdersScrollableUpdate(root) {
    if (typeof shareholderScroll.scheduleShareholdersScrollableUpdate === 'function') {
      shareholderScroll.scheduleShareholdersScrollableUpdate(root);
    }
  }
  function syncShareholderUnitPricesFromModal(modal) {
    const shareholderQuantity = WDPApp.shareholderQuantity || {};
    if (typeof shareholderQuantity.syncShareholderUnitPricesFromModal === 'function') {
      shareholderQuantity.syncShareholderUnitPricesFromModal(modal);
      return;
    }
    if (hasHook('syncShareholderUnitPricesFromModal')) {
      callHook('syncShareholderUnitPricesFromModal', modal);
    }
  }
  function attachGuidanceListeners(form) {
    if (typeof shareholderGuidance.attachGuidanceListeners === 'function') {
      shareholderGuidance.attachGuidanceListeners(form);
    }
  }
  function refreshShareholderGuidance(root) {
    if (typeof shareholderGuidance.refreshShareholderGuidance === 'function') {
      shareholderGuidance.refreshShareholderGuidance(root);
    }
  }
  function checkShareholderFormWarning(form) {
    if (typeof shareholderGuidance.checkShareholderFormWarning === 'function') {
      shareholderGuidance.checkShareholderFormWarning(form);
    }
  }
  function setupWdpPhoneFields(root) {
    if (hasHook('setupWdpPhoneFields')) {
      callHook('setupWdpPhoneFields', root);
      return;
    }
    const phone = WDPApp.phoneInput;
    if (root && phone && typeof phone.setupInRoot === 'function') {
      phone.setupInRoot(root);
    }
  }

  // Shareholder metinlerini PHP'den al (wdp_ajax üzerinden)
  const wdpAjax = window.wdp_ajax || {};
  const shareholderTexts = (wdpAjax && wdpAjax.shareholder_texts) || {};

  /* Field stack icons — prefer localized icons from admin, fallback SVG */
  const buttonIcons = (wdpAjax && wdpAjax.button_icons) || {};
  const FS_ICON_USER = buttonIcons.user || '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-1c0-2.66-5.33-4-8-4z"/></svg>';
  const FS_ICON_NOTE = buttonIcons.note || '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
  const FS_ICON_EMAIL = buttonIcons.email || '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>';
  const enableCopyButton = (typeof shareholderTexts.enable_copy_button === 'boolean')
    ? shareholderTexts.enable_copy_button
    : true;
  const layoutMode = typeof shareholderTexts.layout === 'string' ? shareholderTexts.layout : 'single';
  const densityMode = typeof shareholderTexts.density === 'string' ? shareholderTexts.density : 'normal';
  const enableEmailField = (typeof shareholderTexts.enable_email === 'boolean')
    ? shareholderTexts.enable_email
    : false;


  /** @param {HTMLElement|null} form */
  function getShareholderNoteTextarea(form) {
    return form ? form.querySelector('textarea[name^="shareholder_note_"]') : null;
  }

  function createShareholderForm(index) {
    const headerText = String(shareholderTexts.header || WDPApp.i18n.__('Shareholder details', 'woo-donation-popup'));
    const namePlaceholder = String(shareholderTexts.name_placeholder || WDPApp.i18n.__('Full name *', 'woo-donation-popup'));
    const phonePlaceholder = String(shareholderTexts.phone_placeholder || WDPApp.i18n.__('Phone number *', 'woo-donation-popup'));
    const notePlaceholder = String(shareholderTexts.note_placeholder || WDPApp.i18n.__('Note (optional)', 'woo-donation-popup'));
    const emailPlaceholder = String(shareholderTexts.email_placeholder || WDPApp.i18n.__('Email (optional)', 'woo-donation-popup'));
    const copyButtonText = String(shareholderTexts.copy_button || WDPApp.i18n.__('Create a copy', 'woo-donation-popup'));
    const fieldGroupLabel = String(shareholderTexts.header || WDPApp.i18n.__('Shareholder details', 'woo-donation-popup'));
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
          otherForm.classList.remove('is-active');
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
      form.classList.add('is-active');
      content.style.display = 'flex';
      
      // Scroll container'ı bul ve scroll yap
      if (shareholdersList) {
        requestAnimationFrame(() => {
          if (utils.scrollIntoViewSafe) {
            utils.scrollIntoViewSafe(form, { behavior: 'smooth', block: 'center' });
          } else {
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          const firstInput = form.querySelector('.wdp-shareholder-content input, .wdp-shareholder-content textarea');
          if (firstInput && typeof firstInput.focus === 'function') {
            try { firstInput.focus({ preventScroll: true }); } catch (e) { firstInput.focus(); }
          }
        });
      }
    } else {
      // Formu kapat
      form.classList.add('collapsed');
      form.classList.remove('is-active');
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
      requestAnimationFrame(() => {
        scheduleShareholdersScrollableUpdate(root);
      });
      refreshShareholderGuidance(root);
    }
  }

  /** Tüm kapalı formlardaki eski uyarı rozetlerini temizler. */
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
    normalizedCopyBtn.setAttribute('aria-disabled', 'true');

    // Event listener'ları direkt ekle - clone işlemi yok
    const checkFields = () => {
      const nameValue = nameInput.value.trim();
      const phoneValue = phoneInput.value.trim();
      
      const isReady = Boolean(nameValue && phoneValue);
      normalizedCopyBtn.disabled = !isReady;
      normalizedCopyBtn.classList.toggle('is-active', isReady);
      normalizedCopyBtn.setAttribute('aria-disabled', isReady ? 'false' : 'true');
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
      safeLog('Maximum share count reached (7)');
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
    safeLog(`Updating share count after copy: ${newIndex}`);
    
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
      safeLog(`Price updated: ${totalPrice} (${basePrice} x ${newIndex} shares)`);
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

      if (typeof utils.scrollIntoViewSafe === 'function') {
        utils.scrollIntoViewSafe(newForm, { behavior: 'auto', block: 'nearest' });
      } else {
        try {
          newForm.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        } catch (e) {
          newForm.scrollIntoView(false);
        }
      }
      safeLog(`Shareholder form copied: ${newIndex}. shareholder (open), ${currentCount}. shareholder (collapsed)`);
      if (contextRoot) {
        refreshShareholderGuidance(contextRoot);
      }
    });
  }

  function isFormFilled(form) {
    if (!form) return false;
    const nameInput = form.querySelector('input[name^="shareholder_name_"]');
    const phoneInput = form.querySelector('input[name^="shareholder_phone_"]');
    const nameValue = nameInput ? nameInput.value.trim() : '';
    if (!nameValue) {
      return false;
    }
    if (!phoneInput) {
      return false;
    }
    const formMessages = WDPApp.formMessages || {};
    if (typeof formMessages.getPhoneValidationState === 'function') {
      return formMessages.getPhoneValidationState(phoneInput, { required: true }).ok;
    }
    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.validatePhoneField === 'function') {
      const result = WDPApp.phoneInput.validatePhoneField(phoneInput, { required: true, silent: true });
      if (result && typeof result.ok === 'boolean') {
        return result.ok;
      }
    }
    return phoneInput.value.trim().length > 0;
  }
  WDPApp.shareholderRender = {
    registerHooks: registerHooks,
    createShareholderForm: createShareholderForm,
    toggleShareholderForm: toggleShareholderForm,
    setupShareholderHeaderClick: setupShareholderHeaderClick,
    setupCopyFormButton: setupCopyFormButton,
    duplicateShareholderForm: duplicateShareholderForm,
    isFormFilled: isFormFilled,
  };
})(window);
