/**
 * @file dom.js
 * DOM sorgulama, güvenli element oluşturma ve form kapsayıcı yardımcıları.
 * Dış API: WDPApp.dom
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['safeLog'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const { safeLog } = utils;

  // Inline style'ları kaldırarak tema/eklenti kaynaklı stil çakışmalarını önle
  // FONT-SIZE İLE İLGİLİ KOD KALDIRILDI - Inline CSS yeterli, gereksiz JS kodu flash yapıyor
  function removeInlineStylesFromTitles() {
    const titleSelectors = [
      '.wdp-form-title',
      '.wdp-modal-title',
      '.wdp-modal .wdp-modal-content h2',
      '.wdp-donation-form .wdp-modal-content h2',
      '.wdp-modal .wdp-modal-content .wdp-form-title',
      '.wdp-donation-form .wdp-modal-content .wdp-form-title',
      '.wdp-modal .wdp-modal-content h2.wdp-form-title',
      '.wdp-donation-form .wdp-modal-content h2.wdp-form-title',
      '.wdp-modal .wdp-modal-content form .wdp-form-title',
      '.wdp-donation-form .wdp-modal-content form .wdp-form-title',
      '.wdp-modal .wdp-modal-content form h2',
      '.wdp-donation-form .wdp-modal-content form h2',
      '.wdp-modal .wdp-modal-content form h2.wdp-form-title',
      '.wdp-donation-form .wdp-modal-content form h2.wdp-form-title'
    ]
    
    titleSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector)
      elements.forEach(element => {
        // Sadece display ve width - font-size inline CSS'te handle ediliyor
        const isPopupModalTitle = element.closest('.wdp-modal') && element.closest('.wdp-modal-header');
        
        if (!isPopupModalTitle) {
          // In-page forms: inline-block için sadece display
          if (element.style.display === 'block') {
            element.style.removeProperty('display');
          }
          if (element.style.width === '100%') {
            element.style.removeProperty('width');
          }
        } else {
          // Popup modal titles: block display için
          if (element.style.display && element.style.display !== 'block') {
            element.style.removeProperty('display');
          }
        }
      })
    })
  }

  /**
   * Wizard chrome'u snapshot'a yazma — reset sonrası dinleyicisiz İleri butonu üretmesin.
   */
  function getCleanFormSnapshotHtml(form) {
    if (!form) {
      return '';
    }
    const clone = form.cloneNode(true);
    clone.querySelectorAll('.wdp-wizard, .wdp-wizard-foot').forEach(function(el) {
      el.remove();
    });
    clone.querySelectorAll('[data-wdp-step], .wdp-wizard-section').forEach(function(el) {
      el.removeAttribute('data-wdp-step');
      el.removeAttribute('data-wdp-step-index');
      el.removeAttribute('hidden');
      el.removeAttribute('aria-hidden');
      el.classList.remove('wdp-wizard-section', 'is-wdp-step-active');
    });
    clone.classList.remove('wdp-wizard-ready', 'wdp-wizard-on-confirm');
    return clone.innerHTML;
  }

  // Tüm formların orijinal içeriğini sakla (modal.js'den taşındı)
  function saveOriginalForms() {
    if (!state || !state.originalForms) {
      return;
    }
    const { originalForms } = state;
    // Hem popup hem ürün içi form için çalıştır
    document.querySelectorAll(".wdp-modal, .wdp-donation-form").forEach((container) => {
      const containerId = container.id || container.getAttribute("data-product-id") || Math.random().toString(36).substr(2, 9);
      const form = container.querySelector("form");
      if (form) {
        originalForms.set(containerId, getCleanFormSnapshotHtml(form));
      }
    });
  }

  /**
   * Kullanıcı girdilerini name ile topla (form HTML değişiminde koruma).
   * @param {ParentNode|null} root
   * @returns {{ fields: Array<object>, focusName: string, selectionStart: number|null, selectionEnd: number|null }}
   */
  function captureFormValues(root) {
    const out = {
      fields: [],
      focusName: '',
      selectionStart: null,
      selectionEnd: null,
    };
    if (!root || typeof root.querySelectorAll !== 'function') {
      return out;
    }
    const active = document.activeElement;
    if (active && root.contains && root.contains(active) && active.name) {
      out.focusName = String(active.name);
      try {
        if (typeof active.selectionStart === 'number') {
          out.selectionStart = active.selectionStart;
          out.selectionEnd = active.selectionEnd;
        }
      } catch (eSel) {
        /* ignore */
      }
    }
    root.querySelectorAll('input, select, textarea').forEach((el) => {
      if (!el || !el.name) {
        return;
      }
      const type = String(el.type || el.tagName || '').toLowerCase();
      if (type === 'password' || type === 'file' || type === 'submit' || type === 'button' || type === 'image') {
        return;
      }
      if (type === 'checkbox' || type === 'radio') {
        out.fields.push({
          name: el.name,
          type: type,
          checked: !!el.checked,
          value: String(el.value || ''),
        });
        return;
      }
      out.fields.push({
        name: el.name,
        type: type,
        value: String(el.value == null ? '' : el.value),
      });
    });
    return out;
  }

  /**
   * captureFormValues çıktısını forma uygula; input/change tetikle.
   * @param {ParentNode|null} root
   * @param {{ fields?: Array<object>, focusName?: string, selectionStart?: number|null, selectionEnd?: number|null }|null} snapshot
   */
  function restoreFormValues(root, snapshot) {
    if (!root || !snapshot || !Array.isArray(snapshot.fields) || !snapshot.fields.length) {
      return;
    }
    snapshot.fields.forEach((rec) => {
      if (!rec || !rec.name) {
        return;
      }
      const type = String(rec.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        const nodes = root.querySelectorAll(
          'input[name="' + rec.name.replace(/"/g, '\\"') + '"]'
        );
        nodes.forEach((el) => {
          if (String(el.value || '') === String(rec.value || '')) {
            el.checked = !!rec.checked;
          } else if (type === 'checkbox' && nodes.length === 1) {
            el.checked = !!rec.checked;
          }
          try {
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (eCh) {
            /* ignore */
          }
        });
        return;
      }
      const el = root.querySelector(
        'input[name="' + rec.name.replace(/"/g, '\\"') + '"], select[name="' + rec.name.replace(/"/g, '\\"') + '"], textarea[name="' + rec.name.replace(/"/g, '\\"') + '"]'
      );
      if (!el) {
        return;
      }
      const next = rec.value == null ? '' : String(rec.value);
      if (String(el.value || '') === next) {
        return;
      }
      el.value = next;
      try {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (eEv) {
        /* ignore */
      }
    });
    if (snapshot.focusName) {
      const focusEl = root.querySelector(
        '[name="' + String(snapshot.focusName).replace(/"/g, '\\"') + '"]'
      );
      if (focusEl && typeof focusEl.focus === 'function') {
        try {
          focusEl.focus({ preventScroll: true });
        } catch (eF) {
          try {
            focusEl.focus();
          } catch (eF2) {
            /* ignore */
          }
        }
        if (
          typeof snapshot.selectionStart === 'number' &&
          typeof focusEl.setSelectionRange === 'function'
        ) {
          try {
            focusEl.setSelectionRange(
              snapshot.selectionStart,
              typeof snapshot.selectionEnd === 'number'
                ? snapshot.selectionEnd
                : snapshot.selectionStart
            );
          } catch (eRange) {
            /* ignore */
          }
        }
      }
    }
  }

  /**
   * Açık kabuktaki güncel bağış formunu bul (ayrılmış/eski node yerine).
   * Gizli tembel modal (`aria-hidden=false` ama `.show` yok) seçilmez — panel/popup
   * ayrımında hataların yanlış forma yazılmasını önler.
   * @param {HTMLFormElement|null} preferred
   * @returns {HTMLFormElement|null}
   */
  function isOpenDonationShell(node) {
    if (!node || typeof node.closest !== 'function') {
      return false;
    }
    const modal = node.closest('.wdp-modal');
    if (modal) {
      return modal.classList.contains('show') && modal.getAttribute('aria-hidden') !== 'true';
    }
    return !!node.closest('.hdf-donation-modal-wrapper.wdp-donation-form, .wdp-donation-form');
  }

  function getLiveDonationForm(preferred) {
    if (preferred && preferred.isConnected && isOpenDonationShell(preferred)) {
      return preferred;
    }
    const openModal = document.querySelector(
      '.wdp-modal.show form.wdp-donation-form-fields, .wdp-modal.show form.wdp-donation-form-fields, .wdp-side-panel.show form.wdp-donation-form-fields'
    );
    if (openModal) {
      return openModal;
    }
    if (preferred && preferred.isConnected) {
      return preferred;
    }
    const inline = document.querySelector(
      '.hdf-donation-modal-wrapper.wdp-donation-form form.wdp-donation-form-fields, .wdp-donation-form:not(.wdp-modal) form.wdp-donation-form-fields'
    );
    return inline || document.querySelector('form.wdp-donation-form-fields');
  }

  // DOM değişikliklerini izle - OPTIMIZED: Sadece plugin container'larını izle
  function observeDOMChanges() {
    // OPTIMIZATION: Sadece plugin container'larını bul ve onları izle (tüm body yerine)
    const pluginContainers = document.querySelectorAll('.wdp-modal, .wdp-donation-form');
    
    // Eğer container yoksa, body'yi izle (fallback - sadece ilk yükleme için)
    const targetsToObserve = pluginContainers.length > 0 
      ? Array.from(pluginContainers) 
      : [document.body];

    // Debounce için timer
    let reinitTimer = null;
    let styleRemoveTimer = null;

    const observer = new MutationObserver((mutations) => {
      let shouldReinitialize = false
      let shouldRemoveInlineStyles = false

      mutations.forEach((mutation) => {
        // OPTIMIZATION: Sadece plugin ile ilgili değişiklikleri kontrol et
        const target = mutation.target;
        
        // Eğer target plugin container değilse ve içinde plugin elementi yoksa atla
        const isPluginRelated = target.classList && (
          target.classList.contains('wdp-modal') || 
          target.classList.contains('wdp-donation-form') ||
          target.closest('.wdp-modal') || 
          target.closest('.wdp-donation-form')
        );
        
        if (!isPluginRelated && pluginContainers.length > 0) {
          // Plugin ile ilgili değil, atla (performans iyileştirmesi)
          return;
        }

        if (mutation.type === "childList" && mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.querySelector) {
              // OPTIMIZATION: Sadece plugin elementlerini kontrol et
              const isPluginNode = node.classList && (
                node.classList.contains('wdp-donate-button') || 
                node.classList.contains('wdp-open-modal') ||
                node.classList.contains('wdp-open-side-panel') ||
                node.classList.contains('wdp-donation-form') ||
                node.querySelector('.wdp-donate-button, .wdp-open-modal, .wdp-open-side-panel, .wdp-donation-form')
              );

              if (!isPluginNode && pluginContainers.length > 0) {
                return; // Plugin ile ilgili değil, atla
              }

              const buttons = node.querySelectorAll(".wdp-donate-button, .wdp-open-modal, .wdp-open-side-panel")
              if (buttons.length > 0) {
                shouldReinitialize = true
              }
              // Yeni eklenen doğrudan formlar varsa hemen başlat
              const forms = node.matches && node.matches('.wdp-donation-form') ? [node] : node.querySelectorAll && node.querySelectorAll('.wdp-donation-form')
              if (forms && forms.length) {
                if (WDPApp.init && WDPApp.init.directForms) {
                  WDPApp.init.directForms(node)
                }
                shouldRemoveInlineStyles = true
              }
              const modals = node.matches && node.matches('.wdp-modal') ? [node] : node.querySelectorAll && node.querySelectorAll('.wdp-modal')
              if (modals && modals.length) {
                if (WDPApp.init && WDPApp.init.directForms) {
                  WDPApp.init.directForms(node)
                }
                shouldRemoveInlineStyles = true
              }
              // Yeni eklenen title elementleri varsa inline style'ları kaldır
              if (node.matches && (node.matches('.wdp-form-title') || node.matches('.wdp-modal-title') || node.matches('.wdp-modal-content h2') || node.matches('.wdp-donation-form .wdp-modal-content h2'))) {
                shouldRemoveInlineStyles = true
              }
              if (node.querySelectorAll) {
                const titles = node.querySelectorAll('.wdp-form-title, .wdp-modal-title, .wdp-modal-content h2, .wdp-donation-form .wdp-modal-content h2')
                if (titles && titles.length > 0) {
                  shouldRemoveInlineStyles = true
                }
              }
            }
          })
        }
        // Attributes değişikliklerini de izle (inline style değişiklikleri için)
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          if (target.matches && (target.matches('.wdp-form-title') || target.matches('.wdp-modal-title') || target.matches('h2'))) {
            shouldRemoveInlineStyles = true
          }
        }
      })

      // OPTIMIZATION: Debounce ile gereksiz çağrıları önle
      if (shouldReinitialize) {
        if (reinitTimer) clearTimeout(reinitTimer);
        reinitTimer = setTimeout(() => {
          safeLog("Donation buttons added to DOM - reinitializing event listeners")
          if (WDPApp.init && WDPApp.init.eventListeners) {
            WDPApp.init.eventListeners()
          }
        }, 150);
      }
      
      if (shouldRemoveInlineStyles) {
        if (styleRemoveTimer) clearTimeout(styleRemoveTimer);
        // Biraz gecikmeyle inline style'ları kaldır (tema/eklenti style'ları eklemiş olabilir)
        styleRemoveTimer = setTimeout(() => {
          removeInlineStylesFromTitles()
        }, 100)
      }
    })

    // OPTIMIZATION: Her container'ı ayrı ayrı izle (subtree sadece container içinde)
    targetsToObserve.forEach((target) => {
      observer.observe(target, {
        childList: true,
        subtree: true, // Container içinde subtree kullan (performans için iyi)
        attributes: true,
        attributeFilter: ['style'],
      })
    })

    // OPTIMIZATION: Yeni eklenen container'ları da izle (sadece body için)
    if (pluginContainers.length === 0) {
      // İlk yükleme sırasında container yoktu, body'yi izle ve yeni container'ları bekle
      const containerObserver = new MutationObserver(() => {
        const newContainers = document.querySelectorAll('.wdp-modal, .wdp-donation-form');
        if (newContainers.length > 0) {
          // Yeni container'lar eklendi, onları izlemeye başla
          newContainers.forEach((container) => {
            observer.observe(container, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style'],
            })
          });
          // Body observer'ı durdur (artık sadece container'ları izleyeceğiz)
          containerObserver.disconnect();
        }
      });
      containerObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  // Export
  // Not: initializeDirectForms init.js içinde tanımlı, burada export etmiyoruz
  WDPApp.dom = {
    removeInlineStylesFromTitles,
    observeDOMChanges,
    saveOriginalForms,
    getCleanFormSnapshotHtml,
    captureFormValues,
    restoreFormValues,
    getLiveDonationForm,
    // initializeDirectForms init.js'de tanımlı
  }

  // Export dom module

})(window);
