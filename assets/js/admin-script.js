/**
 * WooCommerce Donation Modal Popup Admin Scripts
 */
;((window, document, $) => {
  const cfg = window.wdp_admin || {}
  const TAB_KEYS = ["products", "modal-layout", "normal-form", "shareholder-form", "progress-bar", "success-screen"]

  function ensureNoticeContainer($anchor) {
    let $notice = $("#wdp-admin-notices")
    if (!$notice.length && $anchor && $anchor.length) {
      $notice = $('<div id="wdp-admin-notices" class="notice wdp-admin-notice" role="status" aria-live="polite"></div>')
      $anchor.before($notice)
    }
    return $notice
  }

  function showNotice(isSuccess, message, autoHide) {
    const $notice = ensureNoticeContainer($(".wdp-admin-shell").first())
    if (!$notice.length) return

    $notice
      .removeClass("notice-success notice-error wdp-admin-notice--success wdp-admin-notice--error wdp-admin-notice--visible")
      .addClass(isSuccess ? "notice-success wdp-admin-notice--success" : "notice-error wdp-admin-notice--error")
      .empty()
      .append($("<p/>").text(message || ""))
      .show()
      .addClass("wdp-admin-notice--visible")

    if (autoHide) {
      window.setTimeout(() => {
        $notice.removeClass("wdp-admin-notice--visible").fadeOut(180)
      }, 3000)
    }
  }

  function toggleSpinner($spinner, visible) {
    if (!$spinner || !$spinner.length) return
    $spinner.css("visibility", visible ? "visible" : "hidden")
  }

  function markDirty($scope) {
    if ($scope && $scope.length) {
      $scope.addClass("is-dirty")
    }
  }

  function clearDirty($scope) {
    if ($scope && $scope.length) {
      $scope.removeClass("is-dirty")
    }
  }

  function normalizeTabHash(rawHash) {
    const raw = String(rawHash || "").replace(/^#/, "")
    if (!raw) return null
    if (TAB_KEYS.indexOf(raw) !== -1) return raw
    const legacy = raw.match(/^wdp-(.+)-tab$/)
    if (legacy && TAB_KEYS.indexOf(legacy[1]) !== -1) return legacy[1]
    return null
  }

  function scrollActiveTabIntoView() {
    const activeTab = $(".wdp-nav-tab-wrapper .nav-tab-active").get(0)
    if (activeTab && typeof activeTab.scrollIntoView === "function") {
      activeTab.scrollIntoView({ block: "nearest", inline: "nearest" })
    }
  }

  function activateTab(tabKey, options) {
    const opts = options || {}
    if (TAB_KEYS.indexOf(tabKey) === -1) return

    const $tabs = $(".wdp-nav-tab-wrapper .nav-tab")
    const $panels = $(".wdp-tab-content")
    const $targetTab = $('.wdp-nav-tab-wrapper .nav-tab[data-tab="' + tabKey + '"]')
    const $targetPanel = $("#wdp-" + tabKey + "-tab")

    $tabs.removeClass("nav-tab-active").attr("aria-selected", "false").attr("tabindex", "-1")
    $panels.removeClass("wdp-tab-active").attr("aria-hidden", "true")

    $targetTab.addClass("nav-tab-active").attr("aria-selected", "true").attr("tabindex", "0")
    $targetPanel.addClass("wdp-tab-active").attr("aria-hidden", "false")
    if (!opts.skipHistory) {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", "#" + tabKey)
      } else {
        window.location.hash = tabKey
      }
    }

    scrollActiveTabIntoView()
  }

  function handleTabKeyboardNavigation(event) {
    const key = event.key
    if (["ArrowRight", "ArrowLeft", "Home", "End", "Enter", " "].indexOf(key) === -1) {
      return
    }

    const $tabs = $(".wdp-nav-tab-wrapper .nav-tab")
    const currentIndex = $tabs.index(event.currentTarget)
    if (currentIndex < 0) return

    let nextIndex = currentIndex
    if (key === "ArrowRight") nextIndex = (currentIndex + 1) % $tabs.length
    if (key === "ArrowLeft") nextIndex = (currentIndex - 1 + $tabs.length) % $tabs.length
    if (key === "Home") nextIndex = 0
    if (key === "End") nextIndex = $tabs.length - 1

    if (key === "Enter" || key === " ") {
      event.preventDefault()
      activateTab($(event.currentTarget).data("tab"))
      return
    }

    event.preventDefault()
    const nextTab = $tabs.get(nextIndex)
    if (nextTab) {
      nextTab.focus()
      activateTab($(nextTab).data("tab"))
    }
  }

  function handleFormTypeExclusivity($row, changedType) {
    const allowCustomPrice = $row.find('input[name="allow_custom_price"]').is(":checked")
    const allowMultipleShares = $row.find('input[name="allow_multiple_shares"]').is(":checked")
    const enableProgressBar = $row.find('input[name="enable_progress_bar"]').is(":checked")

    if (changedType === "custom_price" && allowCustomPrice) {
      $row.find('input[name="allow_multiple_shares"], input[name="enable_progress_bar"]').prop("checked", false)
    } else if (changedType === "multiple_shares" && allowMultipleShares) {
      $row.find('input[name="allow_custom_price"], input[name="enable_progress_bar"]').prop("checked", false)
    } else if (changedType === "progress_bar" && enableProgressBar) {
      $row.find('input[name="allow_custom_price"], input[name="allow_multiple_shares"]').prop("checked", false)
    }
  }

  function collectProductSettings($row) {
    return {
      product_id: $row.data("product-id"),
      allow_custom_price: $row.find('input[name="allow_custom_price"]').is(":checked"),
      min_custom_price: $row.find('input[name="min_custom_price"]').val(),
      allow_multiple_shares: $row.find('input[name="allow_multiple_shares"]').is(":checked"),
      max_shares: $row.find('input[name="max_shares"]').val(),
      enable_progress_bar: $row.find('input[name="enable_progress_bar"]').is(":checked"),
      progress_bar_limit: $row.find('input[name="progress_bar_limit"]').val(),
      enable_product_note: $row.find('input[name="enable_product_note"]').is(":checked"),
      product_note_icon: $row.find('select[name="product_note_icon"]').val(),
      product_note_text: $row.find('textarea[name="product_note_text"]').val(),
    }
  }

  function requestSaveProduct(payload) {
    return $.ajax({
      url: cfg.ajax_url,
      type: "POST",
      dataType: "json",
      data: $.extend(
        {
          action: "wdp_save_product_settings",
          nonce: cfg.nonce,
        },
        payload
      ),
    })
  }

  function bindProductSearch() {
    const $input = $("#wdp-product-search")
    if (!$input.length) return

    $input.off("input.wdpAdmin").on("input.wdpAdmin", function () {
      const query = String($(this).val() || "").toLowerCase().trim()

      $(".wdp-product-card").each(function () {
        const $card = $(this)
        const textPool = (
          $card.find(".wdp-product-title a").text() +
          " " +
          $card.find(".wdp-shortcode").text()
        ).toLowerCase()
        $card.toggle(!query || textPool.indexOf(query) !== -1)
      })

      $(".wdp-category-section").each(function () {
        const hasVisibleProducts = $(this).find(".wdp-product-card:visible").length > 0
        $(this).toggle(hasVisibleProducts || !query)
      })
    })
  }

  function bindCopyShortcodes() {
    $(document)
      .off("click.wdpAdminCopy", ".wdp-copy-shortcode")
      .on("click.wdpAdminCopy", ".wdp-copy-shortcode", function () {
        const $button = $(this)
        const original = $button.text()
        const shortcode = String($button.data("shortcode") || "")
        if (!shortcode) return

        const onSuccess = () => {
          $button.text("Kopyalandı!")
          window.setTimeout(() => $button.text(original), 1600)
        }

        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(shortcode).then(onSuccess).catch(() => {
            const $temp = $("<textarea>").val(shortcode).appendTo("body")
            $temp.get(0).select()
            try {
              document.execCommand("copy")
              onSuccess()
            } finally {
              $temp.remove()
            }
          })
          return
        }

        const $temp = $("<textarea>").val(shortcode).appendTo("body")
        $temp.get(0).select()
        try {
          document.execCommand("copy")
          onSuccess()
        } finally {
          $temp.remove()
        }
      })
  }

  function bindSettingsForm(selector, action, buttonSelector, withInlineMessage) {
    const $form = $(selector)
    if (!$form.length) return

    $form.off("submit.wdpAdmin").on("submit.wdpAdmin", function (event) {
      event.preventDefault()
      const $button = $(buttonSelector)
      const $spinner = $button.next(".spinner")
      const $inlineMessage = withInlineMessage ? $button.closest(".submit").find(".wdp-inline-save-message") : $()
      toggleSpinner($spinner, true)

      $.ajax({
        url: cfg.ajax_url,
        type: "POST",
        dataType: "json",
        data: $(this).serialize() + "&action=" + action + "&nonce=" + cfg.nonce,
      })
        .done((response) => {
          if (response && response.success) {
            const message = (response.data && response.data.message) || cfg.save_success
            showNotice(true, message, true)
            clearDirty($form)
            if ($inlineMessage.length) {
              $inlineMessage.text(message).addClass("is-visible")
              window.setTimeout(() => {
                $inlineMessage.removeClass("is-visible").text("")
              }, 2200)
            }
            return
          }
          showNotice(false, (response && response.data && response.data.message) || cfg.save_error, false)
        })
        .fail(() => {
          showNotice(false, cfg.save_error, false)
        })
        .always(() => toggleSpinner($spinner, false))
    })
  }

  function bindTabSystem() {
    $(document)
      .off("click.wdpAdminTabs", ".wdp-nav-tab-wrapper .nav-tab")
      .on("click.wdpAdminTabs", ".wdp-nav-tab-wrapper .nav-tab", function (event) {
        event.preventDefault()
        activateTab($(this).data("tab"))
      })

    $(document)
      .off("keydown.wdpAdminTabs", ".wdp-nav-tab-wrapper .nav-tab")
      .on("keydown.wdpAdminTabs", ".wdp-nav-tab-wrapper .nav-tab", handleTabKeyboardNavigation)

    let firstRun = true
    const applyHash = () => {
      const key = normalizeTabHash(window.location.hash)
      if (key) {
        activateTab(key, { skipScroll: firstRun })
      } else if (firstRun) {
        activateTab("products", { skipHistory: true, skipScroll: true })
      }
      firstRun = false
    }

    applyHash()
    $(window).off("hashchange.wdpAdmin").on("hashchange.wdpAdmin", applyHash)
  }

  function bindProductSaveActions() {
    $(document)
      .off("change.wdpAdminFormMode")
      .on("change.wdpAdminFormMode", 'input[name="allow_custom_price"]', function () {
        handleFormTypeExclusivity($(this).closest(".wdp-product-card"), "custom_price")
      })
      .on("change.wdpAdminFormMode", 'input[name="allow_multiple_shares"]', function () {
        handleFormTypeExclusivity($(this).closest(".wdp-product-card"), "multiple_shares")
      })
      .on("change.wdpAdminFormMode", 'input[name="enable_progress_bar"]', function () {
        handleFormTypeExclusivity($(this).closest(".wdp-product-card"), "progress_bar")
      })

    $(document)
      .off("click.wdpAdminSaveOne", ".wdp-save-product")
      .on("click.wdpAdminSaveOne", ".wdp-save-product", function () {
        const $row = $(this).closest(".wdp-product-card")
        const $spinner = $row.find(".spinner")
        toggleSpinner($spinner, true)

        requestSaveProduct(collectProductSettings($row))
          .done((response) => {
            if (response && response.success) {
              showNotice(true, response.data.message || cfg.save_success, true)
              clearDirty($row)
            } else {
              showNotice(false, (response && response.data && response.data.message) || cfg.save_error, false)
            }
          })
          .fail(() => showNotice(false, cfg.save_error, false))
          .always(() => toggleSpinner($spinner, false))
      })

    $("#wdp-save-all")
      .off("click.wdpAdmin")
      .on("click.wdpAdmin", function () {
        const $spinner = $(this).next(".spinner")
        const $rows = $(".wdp-product-card")
        const total = $rows.length
        if (!total) return

        let processed = 0
        let successCount = 0
        toggleSpinner($spinner, true)

        $rows.each(function () {
          requestSaveProduct(collectProductSettings($(this)))
            .done((response) => {
              if (response && response.success) successCount += 1
            })
            .always(() => {
              processed += 1
              if (processed === total) {
                toggleSpinner($spinner, false)
                if (successCount === total) {
                  showNotice(true, cfg.save_success, true)
                  clearDirty($rows)
                } else {
                  showNotice(false, successCount + " / " + total + " ürün için ayarlar kaydedildi.", false)
                }
              }
            })
        })
      })
  }

  function bindConditionalRows() {
    const togglePopupCustomFontRow = () => {
      $("#popup_button_custom_font_row").toggle($("#popup_button_font_family").val() === "custom")
    }

    const togglePopupButtonSizeRows = () => {
      const isCustom = $("#popup_button_size").val() === "custom"
      $("#popup_button_custom_min_width_row, #popup_button_custom_min_height_row, #popup_button_custom_padding_x_row").toggle(isCustom)
    }

    const toggleButtonShadowRows = () => {
      $(".wdp-button-shadow-group").each(function () {
        const $grp = $(this)
        const slot = String($grp.data("shadow-slot") || "")
        if (!slot) return
        const enabled = $("#button_shadow_" + slot + "_enabled").is(":checked")
        $grp.find("tr.button-shadow-rows").toggle(enabled)
        if (enabled) {
          const hover = $("#button_shadow_" + slot + "_hover_enhanced").is(":checked")
          $grp.find("tr.button-shadow-hover-extra").toggle(hover)
        } else {
          $grp.find("tr.button-shadow-hover-extra").hide()
        }
      })
    }

    const toggleButtonShadowHoverRows = () => {
      $(".wdp-button-shadow-group").each(function () {
        const $grp = $(this)
        const slot = String($grp.data("shadow-slot") || "")
        if (!slot) return
        const master = $("#button_shadow_" + slot + "_enabled").is(":checked")
        const hover = $("#button_shadow_" + slot + "_hover_enhanced").is(":checked")
        $grp.find("tr.button-shadow-hover-extra").toggle(master && hover)
      })
    }

    $("#popup_button_font_family").off("change.wdpAdmin").on("change.wdpAdmin", togglePopupCustomFontRow)
    $("#popup_button_size").off("change.wdpAdmin").on("change.wdpAdmin", togglePopupButtonSizeRows)
    $("#button_shadow_sc_enabled, #button_shadow_modal_enabled")
      .off("change.wdpAdmin")
      .on("change.wdpAdmin", toggleButtonShadowRows)
    $("#button_shadow_sc_hover_enhanced, #button_shadow_modal_hover_enhanced")
      .off("change.wdpAdmin")
      .on("change.wdpAdmin", toggleButtonShadowHoverRows)

    togglePopupCustomFontRow()
    togglePopupButtonSizeRows()
    toggleButtonShadowRows()
  }

  function bindDirtyStateTracking() {
    $(document)
      .off("input.wdpAdminDirty change.wdpAdminDirty")
      .on("input.wdpAdminDirty change.wdpAdminDirty", ".wdp-product-card :input", function () {
        markDirty($(this).closest(".wdp-product-card"))
      })
      .on("input.wdpAdminDirty change.wdpAdminDirty", ".wdp-admin-settings-form :input", function () {
        markDirty($(this).closest(".wdp-admin-settings-form"))
      })

    $(window)
      .off("beforeunload.wdpAdminDirty")
      .on("beforeunload.wdpAdminDirty", function () {
        const hasDirtyState = $(".wdp-product-card.is-dirty, .wdp-admin-settings-form.is-dirty").length > 0
        if (!hasDirtyState) {
          return undefined
        }
        return "Kaydedilmemiş değişiklikleriniz var."
      })
  }

  $(function () {
    if (!$(".wdp-admin-wrap").length) return

    bindTabSystem()
    bindProductSearch()
    bindCopyShortcodes()
    bindProductSaveActions()
    bindConditionalRows()
    bindDirtyStateTracking()

    bindSettingsForm("#wdp-normal-form-settings-form", "wdp_save_normal_form_settings", "#wdp-save-normal-form-settings", true)
    bindSettingsForm("#wdp-shareholder-form-settings-form", "wdp_save_shareholder_form_settings", "#wdp-save-shareholder-form-settings", false)
    bindSettingsForm("#wdp-success-screen-settings-form", "wdp_save_success_screen_settings", "#wdp-save-success-screen-settings", false)
    bindSettingsForm("#wdp-modal-layout-settings-form", "wdp_save_modal_layout_settings", "#wdp-save-modal-layout-settings", false)
    bindSettingsForm("#wdp-progress-bar-settings-form", "wdp_save_progress_bar_settings", "#wdp-save-progress-bar-settings", false)
  })
})(window, document, jQuery)
