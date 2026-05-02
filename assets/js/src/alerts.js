/**
 * Alerts - Alert/Popup sistemi
 * showAlert, dismissAlert, clearAlerts
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', [])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;

  const WDP_ALERT_AUTO_DISMISS = 7000;
  const WDP_ALERT_TEMPLATES = {
    error: {
      defaultTitle: 'Bir şeyler ters gitti',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 1-7.07 2.93A9.95 9.95 0 0 1 12 2Zm0 2.25a7.75 7.75 0 1 0 5.48 2.27A7.71 7.71 0 0 0 12 4.25Zm0 4a1.1 1.1 0 0 1 1.09 1.19l-.32 3.9a.77.77 0 0 1-1.54 0l-.32-3.9A1.1 1.1 0 0 1 12 8.25Zm0 7.5a1.25 1.25 0 1 1-1.25 1.25A1.25 1.25 0 0 1 12 15.75Z" fill="currentColor"/></svg>'
    },
    warning: {
      defaultTitle: 'Dikkat edilmesi gerekenler var',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 4.05-8.66 15A1 1 0 0 0 3.17 20h17.66a1 1 0 0 0 .87-1.5l-8.66-15a1 1 0 0 0-1.74 0ZM12 9a1 1 0 0 1 .93.64 1 1 0 0 1 .07.36l-.25 4.25a.75.75 0 0 1-1.5 0L11 10a1 1 0 0 1 1-1Zm0 8a1.25 1.25 0 1 1-1.25 1.25A1.25 1.25 0 0 1 12 17Z" fill="currentColor"/></svg>'
    },
    success: {
      defaultTitle: 'İşlem başarıyla tamamlandı',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 10.5a9 9 0 1 1-9-9 1 1 0 0 1 0 2 7 7 0 1 0 7 7 1 1 0 0 1 2 0Z" fill="currentColor"/><path d="M16.78 6.72a1 1 0 0 1 0 1.41l-5.19 5.19a1 1 0 0 1-1.41 0l-2.16-2.19a1 1 0 0 1 1.41-1.41l1.46 1.46 4.48-4.46a1 1 0 0 1 1.41 0Z" fill="currentColor"/></svg>'
    },
    info: {
      defaultTitle: 'Bilginize',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 1-7.07 2.93A9.95 9.95 0 0 1 12 2Zm0 2.25a7.75 7.75 0 1 0 5.48 2.27A7.71 7.71 0 0 0 12 4.25Zm0 3a1.25 1.25 0 1 1-1.25 1.25A1.25 1.25 0 0 1 12 7.25Zm0 3a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 12 10.25Z" fill="currentColor"/></svg>'
    }
  };

  let wdpActiveAlertTimer = null;

  function clearAlerts() {
    if (wdpActiveAlertTimer) {
      clearTimeout(wdpActiveAlertTimer);
      wdpActiveAlertTimer = null;
    }

    document.querySelectorAll('.wdp-alert-overlay').forEach((overlay) => {
      overlay.classList.remove('show');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 180);
    });
  }

  function dismissAlert(alertRoot, { immediate = false } = {}) {
    const target = alertRoot || document.querySelector('.wdp-alert-overlay');

    if (!target) {
      return;
    }

    if (wdpActiveAlertTimer) {
      clearTimeout(wdpActiveAlertTimer);
      wdpActiveAlertTimer = null;
    }

    const remove = () => {
      if (target.parentNode) {
        target.parentNode.removeChild(target);
      }
    };

    if (immediate) {
      remove();
      return;
    }

    target.classList.remove('show');
    setTimeout(remove, 180);
  }

  function showAlert(messages, options = {}) {
    const config = Object.assign({
      type: 'error',
      title: undefined,
      autoClose: true,
      autoCloseDelay: WDP_ALERT_AUTO_DISMISS,
      nonClosable: false,
      persistent: false
    }, options);

    const template = WDP_ALERT_TEMPLATES[config.type] || WDP_ALERT_TEMPLATES.error;
    const descriptionList = Array.isArray(messages) ? messages : [messages];

    const normalizedMessages = descriptionList
      .filter((item) => item !== undefined && item !== null && String(item).trim() !== '')
      .map((item) => String(item));

    if (!normalizedMessages.length) {
      return;
    }

    const alertTitle = String(config.title || template.defaultTitle);

    clearAlerts();

    const overlay = document.createElement('div');
    overlay.className = 'hdf-donation-modal-wrapper wdp-alert-overlay';
    overlay.dataset.wdpAlert = 'true';

    const card = document.createElement('div');
    card.className = `wdp-alert wdp-alert--${config.type}`;
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-live', 'assertive');
    card.setAttribute('aria-modal', 'true');
    card.tabIndex = -1;

    const icon = document.createElement('div');
    icon.className = 'wdp-alert__icon';
    icon.setAttribute('aria-hidden', 'true');
    // template.icon internal static SVG literal, user verisi içermez.
    icon.innerHTML = template.icon;

    const body = document.createElement('div');
    body.className = 'wdp-alert__body';

    const title = document.createElement('h3');
    title.className = 'wdp-alert__title';
    title.textContent = alertTitle;

    const list = document.createElement('ul');
    list.className = 'wdp-alert__list';
    normalizedMessages.forEach((msg) => {
      const li = document.createElement('li');
      li.textContent = msg;
      list.appendChild(li);
    });

    body.appendChild(title);
    body.appendChild(list);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'wdp-alert__close';
    closeButton.setAttribute('aria-label', 'Kapat');
    const closeSymbol = document.createElement('span');
    closeSymbol.setAttribute('aria-hidden', 'true');
    closeSymbol.textContent = '×';
    closeButton.appendChild(closeSymbol);

    card.appendChild(icon);
    card.appendChild(body);
    card.appendChild(closeButton);

    overlay.appendChild(card);
    const activeWrapper = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show')
      || document.querySelector('.hdf-donation-modal-wrapper.wdp-donation-form')
      || document.body;
    activeWrapper.appendChild(overlay);
    
    // Non-closable alert için data attribute ekle
    if (config.nonClosable || config.persistent) {
      overlay.dataset.wdpNonClosable = 'true';
      if (closeButton) {
        closeButton.style.display = 'none';
      }
    }

    requestAnimationFrame(() => {
      overlay.classList.add('show');
      try {
        card.focus({ preventScroll: true });
      } catch (error) {
        card.focus();
      }
    });

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        if (!config.nonClosable && !config.persistent) {
          event.stopPropagation();
          closeAlert();
        }
      }
    };

    const closeAlert = (options = {}) => {
      if (overlay.dataset.wdpNonClosable === 'true' && !options.forceClose) {
        return;
      }
      document.removeEventListener('keydown', handleEsc);
      dismissAlert(overlay, options);
    };

    document.addEventListener('keydown', handleEsc);

    if (closeButton) {
      closeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!config.nonClosable && !config.persistent) {
          closeAlert();
        }
      });
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        event.stopPropagation();
        if (!config.nonClosable && !config.persistent) {
          closeAlert();
        }
      }
    });
    
    card.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    if (config.autoClose) {
      wdpActiveAlertTimer = window.setTimeout(() => {
        closeAlert();
      }, config.autoCloseDelay);
    }
  }

  // Export
  WDPApp.alerts = {
    show: showAlert,
    dismiss: dismissAlert,
    clear: clearAlerts,
  };

})(window);

