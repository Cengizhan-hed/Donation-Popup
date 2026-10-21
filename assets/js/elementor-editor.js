/**
 * Elementor editor: Bağış Formu ürün seçimini WooCommerce ajax aramaya bağlar.
 */
(function ($) {
  "use strict";

  function enhanceProductSelect($select) {
    if (!$select || !$select.length || $select.data("wdpAjaxBound")) {
      return;
    }
    if (typeof $select.select2 !== "function") {
      return;
    }
    $select.data("wdpAjaxBound", true);
    var cfg = window.wdpElementor || {};
    if ($select.hasClass("select2-hidden-accessible") && typeof $select.select2 === "function") {
      $select.select2("destroy");
    }
    $select.select2({
      allowClear: true,
      minimumInputLength: 1,
      ajax: {
        url: cfg.ajaxUrl || window.ajaxurl,
        dataType: "json",
        delay: 250,
        data: function (params) {
          return {
            action: "wdp_elementor_search_products",
            nonce: cfg.nonce || "",
            q: params.term || "",
          };
        },
        processResults: function (data) {
          return { results: (data && data.results) || [] };
        },
      },
    });
  }

  function onPanelOpen(panel) {
    if (!panel || typeof panel.getControlView !== "function") {
      return;
    }
    window.setTimeout(function () {
      var $select = $(".elementor-control-product_id select");
      enhanceProductSelect($select);
    }, 0);
  }

  $(function () {
    if (!window.elementor || !window.elementor.hooks) {
      return;
    }
    window.elementor.hooks.addAction("panel/open_editor/widget/wdp-donation-form", onPanelOpen);
  });
})(window.jQuery);
