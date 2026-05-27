/**
 * @deprecated 10.2.6 Alert overlay UI removed; use utils.clearAlerts() and inline validation.
 * Kept as a no-op shim so old cached HTML that still loads this handle does not throw.
 */
(function (window) {
  'use strict';
  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const clearAlerts =
    WDPApp.utils && typeof WDPApp.utils.clearAlerts === 'function'
      ? WDPApp.utils.clearAlerts
      : function () {
          document.querySelectorAll('.wdp-alert-overlay').forEach(function (overlay) {
            if (overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }
          });
        };

  WDPApp.alerts = {
    clear: clearAlerts,
    show: function () {},
    dismiss: function () {},
  };
})(window);
