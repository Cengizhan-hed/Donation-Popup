/**
 * @file admin-script.js
 * Admin sekmeleri, AJAX kaydetme, ürün kartları ve bildirimler için jQuery tabanlı script.
 */
;((window, document, $) => {
  const cfg = window.wdp_admin || {}
  const TAB_KEYS = [
    "products",
    "design-studio",
    "modal-layout",
    "normal-form",
    "shareholder-form",
    "progress-bar",
    "success-screen",
    "meta",
    "category-colors",
    "advanced",
  ]

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

  let dirtySuppressDepth = 0

  function withDirtySuppressed(fn) {
    dirtySuppressDepth += 1
    try {
      return fn()
    } finally {
      dirtySuppressDepth -= 1
    }
  }

  function markDirty($scope) {
    if (dirtySuppressDepth > 0) return
    if ($scope && $scope.length) {
      $scope.addClass("is-dirty")
    }
  }

  function clearDirty($scope) {
    if ($scope && $scope.length) {
      $scope.removeClass("is-dirty")
    }
  }

  function clearAllDirty() {
    $(".wdp-product-card.is-dirty, .wdp-admin-settings-form.is-dirty").removeClass("is-dirty")
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
    // Prefer direct shell children; fall back if markup was historically broken.
    let $allPanels = $(".wdp-admin-shell > .wdp-tab-content")
    if ($allPanels.length < TAB_KEYS.length) {
      $allPanels = $(".wdp-admin-wrap .wdp-tab-content")
    }
    const $targetTab = $('.wdp-nav-tab-wrapper .nav-tab[data-tab="' + tabKey + '"]')
    const $targetPanel = $("#wdp-" + tabKey + "-tab")
    if (!$targetPanel.length) return

    $tabs.removeClass("nav-tab-active").attr("aria-selected", "false").attr("tabindex", "-1")
    $allPanels
      .removeClass("wdp-tab-active")
      .attr("aria-hidden", "true")
      .attr("hidden", "hidden")
      .css("display", "none")

    $targetTab.addClass("nav-tab-active").attr("aria-selected", "true").attr("tabindex", "0")
    $targetPanel
      .addClass("wdp-tab-active")
      .attr("aria-hidden", "false")
      .removeAttr("hidden")
      .css("display", "block")

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
    } else if (changedType === "custom_price" && !allowCustomPrice && enableProgressBar) {
      // Progress forms require a custom amount field.
      $row.find('input[name="enable_progress_bar"]').prop("checked", false)
    } else if (changedType === "multiple_shares" && allowMultipleShares) {
      $row.find('input[name="allow_custom_price"], input[name="enable_progress_bar"]').prop("checked", false)
    } else if (changedType === "progress_bar" && enableProgressBar) {
      $row.find('input[name="allow_multiple_shares"]').prop("checked", false)
      $row.find('input[name="allow_custom_price"]').prop("checked", true)
    }
  }

  function applySavedProductSettings($row, settings) {
    if (!$row || !$row.length || !settings || typeof settings !== "object") {
      return
    }
    if (typeof settings.allow_custom_price === "boolean") {
      $row.find('input[name="allow_custom_price"]').prop("checked", settings.allow_custom_price)
    }
    if (typeof settings.allow_multiple_shares === "boolean") {
      $row.find('input[name="allow_multiple_shares"]').prop("checked", settings.allow_multiple_shares)
    }
    if (typeof settings.enable_progress_bar === "boolean") {
      $row.find('input[name="enable_progress_bar"]').prop("checked", settings.enable_progress_bar)
    }
    if (typeof settings.enable_product_note === "boolean") {
      $row.find('input[name="enable_product_note"]').prop("checked", settings.enable_product_note)
    }
    if (typeof settings.enable_sadaka_donation === "boolean") {
      $row.find('input[name="enable_sadaka_donation"]').prop("checked", settings.enable_sadaka_donation)
    }
    if (settings.min_custom_price != null && settings.min_custom_price !== "") {
      $row.find('input[name="min_custom_price"]').val(settings.min_custom_price)
    }
    if (settings.max_shares != null && settings.max_shares !== "") {
      $row.find('input[name="max_shares"]').val(settings.max_shares)
    }
    if (settings.progress_bar_limit != null && settings.progress_bar_limit !== "") {
      $row.find('input[name="progress_bar_limit"]').val(settings.progress_bar_limit)
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
      product_note_text: $row.find('textarea[name="product_note_text"]').val(),
      enable_sadaka_donation: $row.find('input[name="enable_sadaka_donation"]').is(":checked"),
      sadaka_toggle_label: $row.find('input[name="sadaka_toggle_label"]').val(),
      sadaka_min_price: $row.find('input[name="sadaka_min_price"]').val(),
      sadaka_fixed_price: $row.find('input[name="sadaka_fixed_price"]').val(),
      sadaka_wc_product_id: $row.find('input[name="sadaka_wc_product_id"]').val(),
      sadaka_donation_message: $row.find('textarea[name="sadaka_donation_message"]').val(),
      enable_trust_strip: $row.find('input[name="enable_trust_strip"]').is(":checked"),
      enable_quantity: $row.find('input[name="enable_quantity"]').is(":checked"),
      enable_amount_presets: $row.find('input[name="enable_amount_presets"]').is(":checked"),
      enable_wizard: $row.find('input[name="enable_wizard"]').is(":checked"),
      enable_field_icons: $row.find('input[name="enable_field_icons"]').is(":checked"),
      enable_impact_line: $row.find('input[name="enable_impact_line"]').is(":checked"),
      progress_celebrate: $row.find('input[name="progress_celebrate"]').is(":checked"),
      impact_line_text: $row.find('input[name="impact_line_text"]').val(),
      amount_presets: $row.find('input[name="amount_presets"]').val(),
      enable_email: $row.find('input[name="enable_email"]').is(":checked"),
      enable_dedication: $row.find('input[name="enable_dedication"]').is(":checked"),
      enable_anonymous: $row.find('input[name="enable_anonymous"]').is(":checked"),
      dedication_placeholder: $row.find('input[name="dedication_placeholder"]').val(),
      layout_mode: $row.find('select[name="layout_mode"]').val(),
      enable_campaign_media: $row.find('input[name="enable_campaign_media"]').is(":checked"),
      theme_inherit_category_color: $row.find('input[name="theme_inherit_category_color"]').is(":checked"),
      theme_primary: $row.find('input[name="theme_primary"]').val(),
      theme_primary_hover: $row.find('input[name="theme_primary_hover"]').val(),
      theme_radius: $row.find('input[name="theme_radius"]').val(),
      theme_density: $row.find('select[name="theme_density"]').val(),
      theme_modal_bg: $row.find('input[name="theme_modal_bg"]').val(),
      enable_urgency: $row.find('input[name="enable_urgency"]').is(":checked"),
      urgency_text: $row.find('input[name="urgency_text"]').val(),
      urgency_ends_at: $row.find('input[name="urgency_ends_at"]').val(),
      enable_social_proof: $row.find('input[name="enable_social_proof"]').is(":checked"),
      social_proof_text: $row.find('input[name="social_proof_text"]').val(),
      enable_faq: $row.find('input[name="enable_faq"]').is(":checked"),
      faq_items: $row.find('textarea[name="faq_items"]').val(),
      enable_cover_fee: $row.find('input[name="enable_cover_fee"]').is(":checked"),
      cover_fee_percent: $row.find('input[name="cover_fee_percent"]').val(),
      module_order: $row.find('input[name="module_order"]').val(),
      trust_badges: $row.find('textarea[name="trust_badges"]').val(),
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

  function bindCompactShortcodeSelector() {
    $(document)
      .off("change.wdpShortcodeSelect", ".wdp-shortcode-select")
      .on("change.wdpShortcodeSelect", ".wdp-shortcode-select", function () {
        const $select = $(this)
        const selected = String($select.val() || "")
        const $container = $select.closest(".wdp-shortcode-compact")
        if (!$container.length) return

        $container.find(".wdp-shortcode-current").text(selected)
        $container.find(".wdp-copy-shortcode-current").attr("data-shortcode", selected)
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
    // Sekmeler `wdp-admin-tabs` inline script ile yönetilir.
    // jQuery tarafı yalnızca global API varsa ona delege eder (çift bağlama yok).
    if (typeof window.wdpAdminActivateTab === "function") {
      window.wdpActivateTab = window.wdpAdminActivateTab
      return
    }

    $(document)
      .off("click.wdpAdminTabs", ".wdp-nav-tab-wrapper .nav-tab")
      .on("click.wdpAdminTabs", ".wdp-nav-tab-wrapper .nav-tab", function (event) {
        event.preventDefault()
        const key = $(this).attr("data-tab") || $(this).data("tab")
        activateTab(String(key || ""))
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
        const $spinner = $(this).next(".spinner")
        toggleSpinner($spinner, true)

        requestSaveProduct(collectProductSettings($row))
          .done((response) => {
            if (response && response.success) {
              if (response.data && response.data.settings) {
                applySavedProductSettings($row, response.data.settings)
              }
              showNotice(true, response.data.message || cfg.save_success, true)
              clearDirty($row)
            } else {
              showNotice(false, (response && response.data && response.data.message) || cfg.save_error, false)
            }
          })
          .fail(() => showNotice(false, cfg.save_error, false))
          .always(() => toggleSpinner($spinner, false))
      })

    $(document)
      .off("click.wdpAdminRecalc", ".wdp-recalculate-total")
      .on("click.wdpAdminRecalc", ".wdp-recalculate-total", function () {
        const $button = $(this)
        const $row = $button.closest(".wdp-product-card")
        const $spinner = $button.next(".spinner")
        if ($button.prop("disabled")) return
        $button.prop("disabled", true)
        toggleSpinner($spinner, true)

        $.ajax({
          url: cfg.ajax_url,
          type: "POST",
          dataType: "json",
          data: {
            action: "wdp_recalculate_product_total",
            nonce: cfg.nonce,
            product_id: $button.data("product-id"),
          },
        })
          .done((response) => {
            if (response && response.success) {
              if (response.data && response.data.total_text) {
                $row.find(".wdp-product-total__value").text(response.data.total_text)
              }
              showNotice(true, (response.data && response.data.message) || cfg.save_success, true)
            } else {
              showNotice(false, (response && response.data && response.data.message) || cfg.save_error, false)
            }
          })
          .fail((xhr) => {
            const msg = xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message
            showNotice(false, msg || cfg.save_error, false)
          })
          .always(() => {
            $button.prop("disabled", false)
            toggleSpinner($spinner, false)
          })
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
          const $row = $(this)
          requestSaveProduct(collectProductSettings($row))
            .done((response) => {
              if (response && response.success) {
                successCount += 1
                if (response.data && response.data.settings) {
                  applySavedProductSettings($row, response.data.settings)
                }
              }
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

  function bindProductCollapsibles() {
    $(document)
      .off("click.wdpAdminCollapse", ".wdp-collapse-toggle")
      .on("click.wdpAdminCollapse", ".wdp-collapse-toggle", function () {
        const $toggle = $(this)
        const $card = $toggle.closest(".wdp-product-card")
        const target = String($toggle.data("collapse-target") || "")
        if (!$card.length || !target) return

        const $target = $card.find(target).first()
        if (!$target.length) return

        const willOpen = !$target.hasClass("is-open")
        $target.toggleClass("is-open", willOpen)
        $toggle.attr("aria-expanded", willOpen ? "true" : "false")
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

  function bindCategoryColorPreview() {
    const $form = $("#wdp-category-colors-settings-form")
    if (!$form.length) return

    function syncBlock($block) {
      const $enable = $block.find('input[type="checkbox"][name^="category_color_enable"]')
      const $picker = $block.find(".wdp-cat-color-picker")
      const $preview = $block.find(".wdp-cat-color-block__product-name")
      if (!$picker.length) return

      const color = $picker.val() || "#1f2937"
      if ($enable.is(":checked")) {
        $preview.css("color", color)
      } else {
        $preview.css("color", "")
      }
    }

    $form
      .off("input.wdpCatColor change.wdpCatColor")
      .on("input.wdpCatColor change.wdpCatColor", ".wdp-cat-color-picker, input[name^='category_color_enable']", function () {
        syncBlock($(this).closest(".wdp-cat-color-block"))
        markDirty($form.closest(".wdp-admin-settings-form"))
      })

    $form.find(".wdp-cat-color-block").each(function () {
      syncBlock($(this))
    })
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

  function bindProgressLivePreview() {
    const $form = $("#wdp-progress-bar-settings-form")
    const $card = $("#wdp-admin-progress-preview .wdp-admin-progress-preview__card")
    if (!$form.length || !$card.length) return

    function applyColor($input) {
      const cssVar = $input.attr("data-ap-var")
      const val = $input.val()
      if (cssVar && val) {
        $card.css(cssVar, val)
      }
    }

    $form.find(".wdp-progress-live-input").each(function () {
      applyColor($(this))
    })

    $form
      .off("input.wdpProgressPreview change.wdpProgressPreview")
      .on("input.wdpProgressPreview change.wdpProgressPreview", ".wdp-progress-live-input", function () {
        applyColor($(this))
      })
      .on("input.wdpProgressPreview change.wdpProgressPreview", ".wdp-progress-live-height", function () {
        let h = parseInt($(this).val(), 10)
        if (!Number.isFinite(h)) h = 22
        h = Math.max(12, Math.min(32, h))
        $card.css("--wdp-ap-h", h + "px")
      })
  }

  function bindNormalFormLivePreview() {
    const $form = $("#wdp-normal-form-settings-form")
    const $root = $("#wdp-admin-normal-preview")
    if (!$form.length || !$root.length) return

    const map = {
      title_color: "--wdp-lp-title",
      close_button_color: "--wdp-lp-close",
      modal_background_color: "--wdp-lp-modal-bg",
      input_border_color: "--wdp-lp-input-border",
      label_color: "--wdp-lp-label",
      button_primary_color: "--wdp-lp-primary",
      button_checkout_color: "--wdp-lp-checkout",
      popup_button_color: "--wdp-lp-trigger-bg",
      popup_button_text_color: "--wdp-lp-trigger-fg",
    }

    function sync() {
      Object.keys(map).forEach(function (name) {
        const $el = $form.find('[name="' + name + '"]').first()
        if ($el.length && $el.val()) {
          $root.css(map[name], $el.val())
        }
      })
      const size = parseInt($form.find('[name="title_font_size"]').val(), 10)
      if (Number.isFinite(size)) {
        $root.css("--wdp-lp-title-size", Math.max(14, Math.min(32, size)) + "px")
      }
      const radius = parseInt($form.find('[name="ui_border_radius"]').val(), 10)
      if (Number.isFinite(radius)) {
        $root.css("--wdp-lp-radius", Math.max(0, Math.min(28, radius)) + "px")
      }
      const addText = $form.find('[name="button_text_add_to_cart"]').val()
      if (addText) $root.find("[data-lp-add]").text(addText)
      const payText = $form.find('[name="button_text_go_checkout"]').val()
      if (payText) $root.find("[data-lp-pay]").text(payText)
      const trigger = $form.find('[name="popup_button_text"]').val()
      if (trigger) $root.find(".wdp-admin-normal-preview__trigger").text(trigger)

      const wizardOn = $form.find('[name="enable_multi_step"]').is(":checked")
      $root.toggleClass("is-wizard", wizardOn)
      const $wiz = $root.find("[data-lp-wizard]")
      if ($wiz.length) {
        if (wizardOn) $wiz.removeAttr("hidden")
        else $wiz.attr("hidden", "hidden")
      }

      const presetsOn = $form.find('[name="enable_amount_presets"]').is(":checked")
      const presetsRaw = String($form.find('[name="amount_presets"]').val() || "")
      const parts = presetsOn ? presetsRaw.split(/[\s,;]+/).filter(Boolean).slice(0, 5) : []
      const $presets = $root.find("[data-lp-presets]")
      if ($presets.length) {
        $presets.empty()
        if (presetsOn) {
          $presets.removeAttr("hidden")
          const popularIndex = parts.length > 0 ? Math.floor(parts.length / 2) : -1
          const popularLabel = "En çok tercih"
          parts.forEach(function (p, i) {
            const n = parseFloat(String(p).replace(/[^\d.]/g, ""))
            if (!Number.isFinite(n) || n <= 0) return
            const $chip = $('<span class="wdp-admin-normal-preview__chip"/>').text("₺" + Math.round(n))
            if (i === popularIndex) {
              $chip.addClass("is-popular is-selected").attr("data-popular-label", popularLabel)
            }
            $presets.append($chip)
          })
        } else {
          $presets.attr("hidden", "hidden")
        }
      }
    }

    sync()
    $form
      .off("input.wdpNormalPreview change.wdpNormalPreview")
      .on("input.wdpNormalPreview change.wdpNormalPreview", ":input", sync)
  }

  function bindModalLayoutLivePreview() {
    const $form = $("#wdp-modal-layout-settings-form")
    const $root = $("#wdp-admin-layout-preview")
    if (!$form.length || !$root.length) return

    function sync() {
      let w = parseInt($form.find('[name="popup_modal_width_desktop"]').val(), 10)
      if (!Number.isFinite(w)) w = 540
      w = Math.max(300, Math.min(800, w))
      const scale = Math.min(1, 300 / w)
      const pt = parseInt($form.find('[name="modal_padding_top_desktop"]').val(), 10) || 16
      const pr = parseInt($form.find('[name="modal_padding_right_desktop"]').val(), 10) || 16
      const pb = parseInt($form.find('[name="modal_padding_bottom_desktop"]').val(), 10) || 16
      const pl = parseInt($form.find('[name="modal_padding_left_desktop"]').val(), 10) || 16
      let sp = parseInt($form.find('[name="side_panel_width_desktop_percent"]').val(), 10)
      if (!Number.isFinite(sp)) sp = 50
      sp = Math.max(30, Math.min(100, sp))

      $root.css({
        "--wdp-lp-modal-w": w + "px",
        "--wdp-lp-scale": String(scale),
        "--wdp-lp-pad": pt + "px " + pr + "px " + pb + "px " + pl + "px",
        "--wdp-lp-sp": sp + "%",
      })
      $root.find("[data-lp-width]").text(w + "px")
      $root.find("[data-lp-sp]").text(sp + "%")
    }

    sync()
    $form
      .off("input.wdpLayoutPreview change.wdpLayoutPreview")
      .on("input.wdpLayoutPreview change.wdpLayoutPreview", ":input", sync)
  }

  function bindShareholderLivePreview() {
    const $form = $("#wdp-shareholder-form-settings-form")
    const $root = $("#wdp-admin-share-preview")
    if (!$form.length || !$root.length) return

    const cssMap = {
      shareholder_header_bg: "--wdp-lp-sh-header-bg",
      shareholder_header_color: "--wdp-lp-sh-header-fg",
      shareholder_card_bg: "--wdp-lp-sh-card-bg",
      shareholder_card_border: "--wdp-lp-sh-card-border",
      shareholders_area_bg: "--wdp-lp-sh-area",
      shareholders_area_border: "--wdp-lp-sh-area-border",
    }

    function sync() {
      Object.keys(cssMap).forEach(function (name) {
        const $el = $form.find('[name="' + name + '"]').first()
        if ($el.length && $el.val()) $root.css(cssMap[name], $el.val())
      })
      const radius = parseInt($form.find('[name="shareholder_card_radius"]').val(), 10)
      if (Number.isFinite(radius)) {
        $root.css("--wdp-lp-sh-radius", Math.max(0, Math.min(40, radius)) + "px")
      }
      const header = $form.find('[name="shareholder_header_text"]').val()
      if (header) $root.find("[data-lp-sh-header]").text(header)
      const namePh = $form.find('[name="shareholder_name_placeholder"]').val()
      if (namePh) $root.find("[data-lp-sh-name]").text(namePh)
      const phonePh = $form.find('[name="shareholder_phone_placeholder"]').val()
      if (phonePh) $root.find("[data-lp-sh-phone]").text(phonePh)
      const notePh = $form.find('[name="shareholder_note_placeholder"]').val()
      if (notePh) $root.find("[data-lp-sh-note]").text(notePh)
      const emailPh = $form.find('[name="shareholder_email_placeholder"]').val()
      if (emailPh) $root.find("[data-lp-sh-email]").text(emailPh)
      const copyText = $form.find('[name="shareholder_copy_button_text"]').val()
      if (copyText) $root.find("[data-lp-sh-copy]").text(copyText)

      const showCopy = $form.find('[name="shareholder_enable_copy_button"]').is(":checked")
      $root.find("[data-lp-sh-copy]").toggle(showCopy)
      const showEmail = $form.find('[name="shareholder_enable_email"]').is(":checked")
      $root.find("[data-lp-sh-email]").prop("hidden", !showEmail)
      $root.toggleClass("is-two-col", $form.find('[name="shareholder_layout"]').val() === "two-column")
      $root.attr("data-density", $form.find('[name="shareholder_density"]').val() || "normal")
    }

    sync()
    $form
      .off("input.wdpSharePreview change.wdpSharePreview")
      .on("input.wdpSharePreview change.wdpSharePreview", ":input", sync)
  }

  function bindSuccessLivePreview() {
    const $form = $("#wdp-success-screen-settings-form")
    const $root = $("#wdp-admin-success-preview")
    if (!$form.length || !$root.length) return

    const cssMap = {
      success_message_bg: "--wdp-lp-su-msg-bg",
      success_message_color: "--wdp-lp-su-msg-fg",
      success_message_border: "--wdp-lp-su-msg-bd",
      success_button_color: "--wdp-lp-su-btn",
      mini_cart_bg: "--wdp-lp-su-cart-bg",
      mini_cart_border: "--wdp-lp-su-cart-bd",
      cart_item_name_color: "--wdp-lp-su-name",
      cart_item_price_color: "--wdp-lp-su-price",
    }

    function sync() {
      Object.keys(cssMap).forEach(function (name) {
        const $el = $form.find('[name="' + name + '"]').first()
        if ($el.length && $el.val()) $root.css(cssMap[name], $el.val())
      })
      const msgR = parseInt($form.find('[name="success_message_radius"]').val(), 10)
      if (Number.isFinite(msgR)) $root.css("--wdp-lp-su-msg-r", Math.max(0, Math.min(50, msgR)) + "px")
      const btnR = parseInt($form.find('[name="success_button_radius"]').val(), 10)
      if (Number.isFinite(btnR)) $root.css("--wdp-lp-su-btn-r", Math.max(0, Math.min(50, btnR)) + "px")
      const cartR = parseInt($form.find('[name="mini_cart_radius"]').val(), 10)
      if (Number.isFinite(cartR)) $root.css("--wdp-lp-su-cart-r", Math.max(0, Math.min(50, cartR)) + "px")

      const cart = $form.find('[name="success_text_view_cart"]').val()
      if (cart) $root.find("[data-lp-su-cart]").text(cart)
      const pay = $form.find('[name="success_text_go_checkout"]').val()
      if (pay) $root.find("[data-lp-su-pay]").text(pay)
      const neu = $form.find('[name="success_text_new_donation"]').val()
      if (neu) $root.find("[data-lp-su-new]").text(neu)
    }

    sync()
    $form
      .off("input.wdpSuccessPreview change.wdpSuccessPreview")
      .on("input.wdpSuccessPreview change.wdpSuccessPreview", ":input", sync)
  }

  $(function () {
    if (!$(".wdp-admin-wrap").length) return

    $(document).on("change", "[data-wdp-toggle-target]", function () {
      const sel = $(this).attr("data-wdp-toggle-target")
      if (!sel) return
      const $target = $(sel)
      if (!$target.length) return
      if (this.checked) $target.removeAttr("hidden")
      else $target.attr("hidden", "hidden")
    })

    bindTabSystem()
    bindProductSearch()
    bindCopyShortcodes()
    bindCompactShortcodeSelector()
    bindProductSaveActions()
    bindProductCollapsibles()
    bindConditionalRows()
    bindDirtyStateTracking()

    bindSettingsForm("#wdp-normal-form-settings-form", "wdp_save_normal_form_settings", "#wdp-save-normal-form-settings", true)
    bindSettingsForm("#wdp-design-studio-settings-form", "wdp_save_design_studio_settings", "#wdp-save-design-studio-settings", true)
    bindSettingsForm("#wdp-shareholder-form-settings-form", "wdp_save_shareholder_form_settings", "#wdp-save-shareholder-form-settings", false)
    bindSettingsForm("#wdp-success-screen-settings-form", "wdp_save_success_screen_settings", "#wdp-save-success-screen-settings", false)
    bindSettingsForm("#wdp-modal-layout-settings-form", "wdp_save_modal_layout_settings", "#wdp-save-modal-layout-settings", false)
    bindSettingsForm("#wdp-progress-bar-settings-form", "wdp_save_progress_bar_settings", "#wdp-save-progress-bar-settings", false)
    bindSettingsForm("#wdp-meta-tracking-settings-form", "wdp_save_meta_tracking_settings", "#wdp-save-meta-tracking-settings", false)
    bindSettingsForm("#wdp-category-colors-settings-form", "wdp_save_category_colors_settings", "#wdp-save-category-colors-settings", false)
    bindSettingsForm("#wdp-advanced-settings-form", "wdp_save_advanced_settings", "#wdp-save-advanced-settings", false)
    bindCategoryColorPreview()
    bindProgressLivePreview()
    bindNormalFormLivePreview()
    bindModalLayoutLivePreview()
    bindShareholderLivePreview()
    bindSuccessLivePreview()
    bindDesignStudio()
    // Init sırasında tetiklenen programatik input/change sonrası temiz başla.
    clearAllDirty()
  })

  function fillFormFieldsFromMap($form, map) {
    if (!$form || !$form.length || !map) return
    Object.keys(map).forEach(function (key) {
      const $field = $form.find('[name="' + key + '"]')
      if (!$field.length) return
      const val = map[key]
      if ($field.is(':checkbox')) {
        $field.prop("checked", val === "1" || val === 1 || val === true)
      } else if ($field.is("select")) {
        $field.val(String(val)).trigger("change")
      } else {
        $field.val(String(val)).trigger("input").trigger("change")
      }
    })
  }

  function applyPackToAdminForms(pack) {
    if (!pack || typeof pack !== "object") return
    fillFormFieldsFromMap($("#wdp-normal-form-settings-form"), pack.button || {})
    fillFormFieldsFromMap($("#wdp-design-studio-settings-form"), pack.button || {})
    if (pack.button && (pack.button.brand_color || pack.button.button_primary_color)) {
      $("#brand_color")
        .val(String(pack.button.brand_color || pack.button.button_primary_color))
        .trigger("input")
    }
    fillFormFieldsFromMap($("#wdp-shareholder-form-settings-form"), pack.shareholder || {})
    fillFormFieldsFromMap($("#wdp-progress-bar-settings-form"), pack.progress || {})
    const prog = pack.progress || {}
    Object.keys(prog).forEach(function (k) {
      const $f = $('#wdp-progress-bar-settings-form [name="progress_' + k + '"]')
      if ($f.length) $f.val(String(prog[k])).trigger("change")
    })
    fillFormFieldsFromMap($("#wdp-success-screen-settings-form"), pack.success || {})
  }

  function bindDesignStudio() {
    const packs = (cfg && cfg.style_packs) || {}

    $(document)
      .off("click.wdpPreset", ".wdp-style-preset-card")
      .on("click.wdpPreset", ".wdp-style-preset-card", function (event) {
        event.preventDefault()
        const id = String($(this).data("preset-id") || "")
        const pack = packs[id]
        if (!pack) return
        $(".wdp-style-preset-card").removeClass("is-active")
        $(this).addClass("is-active")
        $("#style_preset_id").val(id)
        applyPackToAdminForms(pack)
        showNotice(
          true,
          (cfg.i18n && cfg.i18n.preset_applied) ||
            "Paket form alanlarına uygulandı. Kalıcı olması için “Paketi şimdi uygula & kaydet” veya “Ayarları Kaydet” kullanın.",
          true
        )
      })

    $("#wdp-apply-style-preset-now")
      .off("click.wdpPresetApply")
      .on("click.wdpPresetApply", function (event) {
        event.preventDefault()
        event.stopPropagation()
        const $btn = $(this)
        const id = String($("#style_preset_id").val() || $(".wdp-style-preset-card.is-active").data("preset-id") || "")
        if (!id) {
          showNotice(false, "Önce bir görünüm paketi seçin.", false)
          return
        }
        $btn.prop("disabled", true)
        $.ajax({
          url: cfg.ajax_url,
          type: "POST",
          dataType: "json",
          data: {
            action: "wdp_apply_style_preset",
            nonce: cfg.nonce,
            preset_id: id,
          },
        })
          .done(function (res) {
            if (!(res && res.success)) {
              showNotice(false, (res && res.data && res.data.message) || cfg.save_error, false)
              return
            }
            const pack = (res.data && res.data.pack) || packs[id] || {}
            applyPackToAdminForms(pack)
            if (res.data && res.data.brand_color) {
              $("#brand_color").val(String(res.data.brand_color)).trigger("input")
            }
            $(".wdp-style-preset-card").removeClass("is-active")
            $('.wdp-style-preset-card[data-preset-id="' + id + '"]').addClass("is-active")
            $("#style_preset_id").val(id)
            showNotice(true, (res.data && res.data.message) || cfg.save_success, true)
            clearDirty($("#wdp-design-studio-settings-form"))
          })
          .fail(function () {
            showNotice(false, cfg.save_error, false)
          })
          .always(function () {
            $btn.prop("disabled", false)
          })
      })

    $("#wdp-export-style-preset")
      .off("click.wdpPresetExport")
      .on("click.wdpPresetExport", function (event) {
        event.preventDefault()
        $.post(cfg.ajax_url, {
          action: "wdp_export_style_preset",
          nonce: cfg.nonce,
          label: "Custom export",
        }).done(function (res) {
          if (!(res && res.success && res.data && res.data.pack)) return
          const blob = new Blob([JSON.stringify(res.data.pack, null, 2)], { type: "application/json" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "wdp-style-preset.json"
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)
          showNotice(true, "Paket JSON olarak indirildi.", true)
        })
      })

    $("#wdp-import-style-preset-file")
      .off("change.wdpPresetImport")
      .on("change.wdpPresetImport", function (e) {
        const file = e.target.files && e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = function () {
          $.ajax({
            url: cfg.ajax_url,
            type: "POST",
            dataType: "json",
            data: {
              action: "wdp_import_style_preset",
              nonce: cfg.nonce,
              pack_json: String(reader.result || ""),
            },
          })
            .done(function (res) {
              if (!(res && res.success)) {
                showNotice(false, (res && res.data && res.data.message) || cfg.save_error, false)
                return
              }
              const id = (res.data && res.data.preset_id) || ""
              if (id && packs[id]) {
                applyPackToAdminForms(packs[id])
                $("#style_preset_id").val(id)
                $(".wdp-style-preset-card").removeClass("is-active")
                $('.wdp-style-preset-card[data-preset-id="' + id + '"]').addClass("is-active")
              }
              showNotice(true, (res.data && res.data.message) || cfg.save_success, true)
            })
            .fail(function () {
              showNotice(false, cfg.save_error, false)
            })
        }
        reader.readAsText(file)
        e.target.value = ""
      })

    $(document)
      .off("click.wdpIconChip", ".wdp-icon-picker__chip")
      .on("click.wdpIconChip", ".wdp-icon-picker__chip", function () {
        const $root = $(this).closest("[data-wdp-icon-picker]")
        const val = String($(this).data("icon-value") || "")
        $root.find(".wdp-icon-picker__chip").removeClass("is-selected")
        $(this).addClass("is-selected")
        $root.find(".wdp-icon-picker__value").val(val)
        $root.find(".wdp-icon-picker__preview").html($(this).html())
      })

    $(document)
      .off("click.wdpIconReset", ".wdp-icon-picker__reset")
      .on("click.wdpIconReset", ".wdp-icon-picker__reset", function () {
        const $root = $(this).closest("[data-wdp-icon-picker]")
        const $first = $root.find(".wdp-icon-picker__chip").first()
        if ($first.length) $first.trigger("click")
      })

    $(document)
      .off("click.wdpIconMedia", ".wdp-icon-picker__media")
      .on("click.wdpIconMedia", ".wdp-icon-picker__media", function (e) {
        e.preventDefault()
        if (!window.wp || !wp.media) return
        const $root = $(this).closest("[data-wdp-icon-picker]")
        const frame = wp.media({
          title: (cfg.i18n && cfg.i18n.media_title) || "Select icon",
          button: { text: (cfg.i18n && cfg.i18n.media_button) || "Use" },
          multiple: false,
          library: { type: "image" },
        })
        frame.on("select", function () {
          const attachment = frame.state().get("selection").first().toJSON()
          if (!attachment || !attachment.id) return
          const val = "attachment:" + attachment.id
          $root.find(".wdp-icon-picker__value").val(val)
          $root.find(".wdp-icon-picker__chip").removeClass("is-selected")
          const url = attachment.url || ""
          $root.find(".wdp-icon-picker__preview").html(
            url ? '<img src="' + url + '" alt="" width="22" height="22" />' : ""
          )
        })
        frame.open()
      })

    // Global brand color → live swatch + tüm admin form önizlemeleri.
    function hexToRgb(hex) {
      const h = String(hex || "").replace("#", "")
      if (h.length !== 6) return null
      return {
        r: Number.parseInt(h.slice(0, 2), 16),
        g: Number.parseInt(h.slice(2, 4), 16),
        b: Number.parseInt(h.slice(4, 6), 16),
      }
    }
    function mixHex(a, b, t) {
      const A = hexToRgb(a)
      const B = hexToRgb(b)
      if (!A || !B) return a
      const m = (x, y) => Math.round(x + (y - x) * t)
      const to = (n) => n.toString(16).padStart(2, "0")
      return "#" + to(m(A.r, B.r)) + to(m(A.g, B.g)) + to(m(A.b, B.b))
    }
    function shadeHex(hex, amount) {
      return mixHex(hex, amount < 0 ? "#000000" : "#ffffff", Math.abs(amount))
    }
    function setNamedColor(name, hex, options) {
      const opts = options || {}
      const $els = $(
        'input[name="' + name + '"], #' + name + ', input[data-ap-var][name="' + name + '"]'
      )
      $els.each(function () {
        if ($(this).attr("type") === "color" || $(this).hasClass("wdp-progress-live-input")) {
          $(this).val(hex)
          if (!opts.silent) {
            $(this).trigger("input")
          }
        }
      })
    }
    function refreshBrandSwatches(hex, options) {
      const opts = options || {}
      const primary = String(hex || "").trim()
      if (!/^#[0-9a-fA-F]{6}$/.test(primary)) return
      const hover = shadeHex(primary, -0.14)
      const dark = shadeHex(primary, -0.28)
      const soft = shadeHex(primary, 0.88)
      const checkout = shadeHex(primary, 0.12)
      const pending = shadeHex(primary, 0.42)
      const map = {
        primary: primary,
        primary_hover: hover,
        primary_dark: dark,
        primary_soft: soft,
        checkout: checkout,
        progress_pending: pending,
      }
      const keys = ["primary", "primary_hover", "primary_dark", "primary_soft", "checkout", "progress_pending"]
      $(".wdp-brand-palette-preview__swatch").each(function (i) {
        const key = keys[i]
        if (!key || !map[key]) return
        $(this).attr("title", map[key])
        $(this).find("i").css("background", map[key])
      })

      const colorOpts = opts.silent ? { silent: true } : {}
      // Linked color fields (kaydetmeden önce önizleme tutarlı kalsın)
      setNamedColor("button_primary_color", primary, colorOpts)
      setNamedColor("button_primary_hover", hover, colorOpts)
      setNamedColor("popup_button_color", primary, colorOpts)
      setNamedColor("button_checkout_color", checkout, colorOpts)
      setNamedColor("title_color", dark, colorOpts)
      setNamedColor("label_color", dark, colorOpts)
      setNamedColor("input_border_color", shadeHex(primary, 0.55), colorOpts)
      setNamedColor("shareholder_header_bg", primary, colorOpts)
      setNamedColor("shareholder_header_bg_hover", hover, colorOpts)
      setNamedColor("shareholder_header_color", "#ffffff", colorOpts)
      setNamedColor("shareholders_scrollbar_color", primary, colorOpts)
      setNamedColor("shareholder_card_border", shadeHex(primary, 0.55), colorOpts)
      setNamedColor("shareholders_area_bg", soft, colorOpts)
      setNamedColor("shareholders_area_border", shadeHex(primary, 0.55), colorOpts)
      setNamedColor("fill_color", primary, colorOpts)
      setNamedColor("pending_bg", pending, colorOpts)
      setNamedColor("progress_container_border", shadeHex(primary, 0.55), colorOpts)
      setNamedColor("container_border", shadeHex(primary, 0.55), colorOpts)
      setNamedColor("success_button_color", primary, colorOpts)
      setNamedColor("success_message_color", primary, colorOpts)
      setNamedColor("mini_cart_bg", soft, colorOpts)
      setNamedColor("mini_cart_border", shadeHex(primary, 0.55), colorOpts)
      setNamedColor("cart_item_price_color", primary, colorOpts)

      // Normal form preview
      $("#wdp-admin-normal-preview").css({
        "--wdp-lp-primary": primary,
        "--wdp-lp-checkout": checkout,
        "--wdp-lp-trigger-bg": primary,
        "--wdp-lp-input-border": shadeHex(primary, 0.55),
      })

      // Hisseli preview
      $("#wdp-admin-share-preview").css({
        "--wdp-lp-sh-header-bg": primary,
        "--wdp-lp-sh-header-fg": "#ffffff",
      })

      // Progress preview
      $("#wdp-admin-progress-preview .wdp-admin-progress-preview__card").css({
        "--wdp-ap-fill": primary,
        "--wdp-ap-pending": pending,
        "--wdp-ap-draft": shadeHex(primary, 0.55),
        "--wdp-ap-track": soft,
      })
      $("#wdp-admin-progress-preview .wdp-admin-progress-preview__hdr span:first-child strong").css(
        "color",
        primary
      )

      // Success preview
      $("#wdp-admin-success-preview").css({
        "--wdp-lp-su-btn": primary,
        "--wdp-lp-su-msg": primary,
        "--wdp-lp-su-price": primary,
      })
      $("#wdp-admin-success-preview .wdp-admin-success-preview__msg").css({
        color: primary,
        borderColor: shadeHex(primary, 0.55),
        background: soft,
      })
      $("#wdp-admin-success-preview .wdp-admin-success-preview__row .price").css("color", primary)

      // Layout preview accent
      $("#wdp-admin-layout-preview").css({
        "--wdp-lp-primary": primary,
      })
    }
    $(document)
      .off("input.wdpBrandColor change.wdpBrandColor", "#brand_color")
      .on("input.wdpBrandColor change.wdpBrandColor", "#brand_color", function () {
        refreshBrandSwatches($(this).val())
      })
    // Sayfa yükünde önizlemeyi sessizce senkronize et — dirty tetikleme.
    if ($("#brand_color").length) {
      withDirtySuppressed(function () {
        refreshBrandSwatches($("#brand_color").val(), { silent: true })
      })
    }
  }
})(window, document, jQuery)
