/**
 * WooCommerce Donation Modal Popup Admin Scripts
 */
;((window, document, $) => {
  // DOM hazır olduğunda
  $(document).ready(() => {
    // Değişkenleri tanımla
    const wdp_admin = window.wdp_admin // Declare wdp_admin variable
    var $noticeContainer = $("#wdp-admin-notices")
    var $productSearch = $("#wdp-product-search")

    // Başarı mesajı göster
    function showSuccessMessage(message) {
      $noticeContainer
        .removeClass("notice-error wdp-admin-notice--error")
        .addClass("notice-success wdp-admin-notice--success")
        .html("<p>" + message + "</p>")
        .stop(true, true)
        .css({ opacity: 1, display: "block" })
        .addClass("wdp-admin-notice--visible")

      // 3 saniye sonra mesajı gizle
      setTimeout(() => {
        $noticeContainer.removeClass("wdp-admin-notice--visible").fadeOut()
      }, 3200)
    }

    // Hata mesajı göster
    function showErrorMessage(message) {
      $noticeContainer
        .removeClass("notice-success wdp-admin-notice--success")
        .addClass("notice-error wdp-admin-notice--error")
        .html("<p>" + message + "</p>")
        .stop(true, true)
        .css({ opacity: 1, display: "block" })
        .addClass("wdp-admin-notice--visible")
    }

    // Form tipi mutual exclusivity - bir form tipi açıldığında diğerleri kapansın
    function handleFormTypeExclusivity($row, changedType) {
      var allowCustomPrice = $row.find('input[name="allow_custom_price"]').is(":checked")
      var allowMultipleShares = $row.find('input[name="allow_multiple_shares"]').is(":checked")
      var enableProgressBar = $row.find('input[name="enable_progress_bar"]').is(":checked")

      // Eğer bir form tipi açıldıysa diğerlerini kapat
      if (changedType === 'custom_price' && allowCustomPrice) {
        $row.find('input[name="allow_multiple_shares"]').prop('checked', false)
        $row.find('input[name="enable_progress_bar"]').prop('checked', false)
      } else if (changedType === 'multiple_shares' && allowMultipleShares) {
        $row.find('input[name="allow_custom_price"]').prop('checked', false)
        $row.find('input[name="enable_progress_bar"]').prop('checked', false)
      } else if (changedType === 'progress_bar' && enableProgressBar) {
        $row.find('input[name="allow_custom_price"]').prop('checked', false)
        $row.find('input[name="allow_multiple_shares"]').prop('checked', false)
      }
    }

    // Ürün arama / filtreleme (kategori başlıklarıyla uyumlu)
    if ($productSearch && $productSearch.length) {
      $productSearch.on("input", function () {
        var query = $(this).val().toLowerCase().trim()

        $(".wdp-product-card").each(function () {
          var $card = $(this)
          var nameText = $card.find(".wdp-product-title a").text().toLowerCase()
          var shortcodeText = $card.find(".wdp-shortcode").text().toLowerCase()

          if (!query || nameText.indexOf(query) !== -1 || shortcodeText.indexOf(query) !== -1) {
            $card.show()
          } else {
            $card.hide()
          }
        })

        // Kategori bölümlerini, içlerinde görünür ürün kartı olup olmamasına göre gizle/göster
        $(".wdp-category-section").each(function () {
          var $section = $(this)
          var hasVisibleProducts = $section.find(".wdp-product-card:visible").length > 0

          if (hasVisibleProducts || !query) {
            $section.show()
          } else {
            $section.hide()
          }
        })
      })
    }

    // Form tipi değişikliklerini dinle (kart tabanlı ürün satırları)
    $(document).on("change", 'input[name="allow_custom_price"]', function () {
      var $row = $(this).closest(".wdp-product-card")
      handleFormTypeExclusivity($row, 'custom_price')
    })

    $(document).on("change", 'input[name="allow_multiple_shares"]', function () {
      var $row = $(this).closest(".wdp-product-card")
      handleFormTypeExclusivity($row, 'multiple_shares')
    })

    $(document).on("change", 'input[name="enable_progress_bar"]', function () {
      var $row = $(this).closest(".wdp-product-card")
      handleFormTypeExclusivity($row, 'progress_bar')
    })

    // Tek ürün ayarlarını kaydet
    $(".wdp-save-product").on("click", function () {
      var $button = $(this)
      var $row = $button.closest(".wdp-product-card")
      var productId = $row.data("product-id")
      var $spinner = $row.find(".spinner")

      // Spinner'ı göster
      $spinner.css("visibility", "visible")

      // Ayarları al
      var allowCustomPrice = $row.find('input[name="allow_custom_price"]').is(":checked")
      var minCustomPrice = $row.find('input[name="min_custom_price"]').val()
      var allowMultipleShares = $row.find('input[name="allow_multiple_shares"]').is(":checked")
      var maxShares = $row.find('input[name="max_shares"]').val()
      var enableProgressBar = $row.find('input[name="enable_progress_bar"]').is(":checked")
      var progressBarLimit = $row.find('input[name="progress_bar_limit"]').val()
      var enableProductNote = $row.find('input[name="enable_product_note"]').is(":checked")
      var productNoteIcon = $row.find('select[name="product_note_icon"]').val()
      var productNoteText = $row.find('textarea[name="product_note_text"]').val()

      // AJAX isteği gönder
      $.ajax({
        url: wdp_admin.ajax_url,
        type: "POST",
        data: {
          action: "wdp_save_product_settings",
          nonce: wdp_admin.nonce,
          product_id: productId,
          allow_custom_price: allowCustomPrice,
          min_custom_price: minCustomPrice,
          allow_multiple_shares: allowMultipleShares,
          max_shares: maxShares,
          enable_progress_bar: enableProgressBar,
          progress_bar_limit: progressBarLimit,
          enable_product_note: enableProductNote,
          product_note_icon: productNoteIcon,
          product_note_text: productNoteText,
        },
        success: (response) => {
          if (response.success) {
            showSuccessMessage(response.data.message)
          } else {
            showErrorMessage(response.data.message)
          }
        },
        error: () => {
          showErrorMessage(wdp_admin.save_error)
        },
        complete: () => {
          // Spinner'ı gizle
          $spinner.css("visibility", "hidden")
        },
      })
    })

    // Tüm değişiklikleri kaydet
    $("#wdp-save-all").on("click", function () {
      var $button = $(this)
      var $spinner = $button.next(".spinner")
      var $rows = $(".wdp-product-card")
      var totalRows = $rows.length
      var processedRows = 0
      var successCount = 0

      // Spinner'ı göster
      $spinner.css("visibility", "visible")

      // Her satır için
      $rows.each(function () {
        var $row = $(this)
        var productId = $row.data("product-id")

        // Ayarları al
        var allowCustomPrice = $row.find('input[name="allow_custom_price"]').is(":checked")
        var minCustomPrice = $row.find('input[name="min_custom_price"]').val()
        var allowMultipleShares = $row.find('input[name="allow_multiple_shares"]').is(":checked")
        var maxShares = $row.find('input[name="max_shares"]').val()
        var enableProgressBar = $row.find('input[name="enable_progress_bar"]').is(":checked")
        var progressBarLimit = $row.find('input[name="progress_bar_limit"]').val()
        var enableProductNote = $row.find('input[name="enable_product_note"]').is(":checked")
        var productNoteIcon = $row.find('select[name="product_note_icon"]').val()
        var productNoteText = $row.find('textarea[name="product_note_text"]').val()

        // AJAX isteği gönder
        $.ajax({
          url: wdp_admin.ajax_url,
          type: "POST",
          data: {
            action: "wdp_save_product_settings",
            nonce: wdp_admin.nonce,
            product_id: productId,
            allow_custom_price: allowCustomPrice,
            min_custom_price: minCustomPrice,
            allow_multiple_shares: allowMultipleShares,
            max_shares: maxShares,
            enable_progress_bar: enableProgressBar,
            progress_bar_limit: progressBarLimit,
            enable_product_note: enableProductNote,
            product_note_icon: productNoteIcon,
            product_note_text: productNoteText,
          },
          success: (response) => {
            if (response.success) {
              successCount++
            }
          },
          complete: () => {
            processedRows++

            // Tüm satırlar işlendiyse
            if (processedRows === totalRows) {
              // Spinner'ı gizle
              $spinner.css("visibility", "hidden")

              // Başarı mesajı göster
              if (successCount === totalRows) {
                showSuccessMessage(wdp_admin.save_success)
              } else {
                showErrorMessage(successCount + " / " + totalRows + " ürün için ayarlar kaydedildi.")
              }
            }
          },
        })
      })
    })

    // Shortcode kopyala
    $(".wdp-copy-shortcode").on("click", function () {
      var $button = $(this)
      var shortcode = $button.data("shortcode")

      // Modern clipboard API kullan
      if (navigator.clipboard && window.isSecureContext) {
        // Modern yöntem - HTTPS gerektirir
        navigator.clipboard.writeText(shortcode).then(function() {
          // Başarılı
          var originalText = $button.text()
          $button.text("Kopyalandı!")
          
          // 2 saniye sonra orijinal metni geri yükle
          setTimeout(() => {
            $button.text(originalText)
          }, 2000)
        }).catch(function(err) {
          // Hata durumunda fallback yöntemi kullan
          fallbackCopy(shortcode, $button)
        })
      } else {
        // Fallback yöntemi - eski tarayıcılar için
        fallbackCopy(shortcode, $button)
      }
    })

    // Fallback kopyalama fonksiyonu
    function fallbackCopy(text, $button) {
      // Geçici bir textarea oluştur
      var $temp = $("<textarea>")
      $("body").append($temp)
      $temp.val(text).select()

      try {
        // Kopyala
        var successful = document.execCommand("copy")
        if (successful) {
          // Başarılı
          var originalText = $button.text()
          $button.text("Kopyalandı!")
          
          // 2 saniye sonra orijinal metni geri yükle
          setTimeout(() => {
            $button.text(originalText)
          }, 2000)
        } else {
          // Başarısız
          $button.text("Kopyalanamadı!")
          setTimeout(() => {
            $button.text("Kopyala")
          }, 2000)
        }
      } catch (err) {
        // Hata
        $button.text("Hata!")
        setTimeout(() => {
          $button.text("Kopyala")
        }, 2000)
      }

      // Geçici textarea'yı kaldır
      $temp.remove()
    }

    var WDP_TAB_KEYS = [
      "products",
      "modal-layout",
      "normal-form",
      "shareholder-form",
      "progress-bar",
      "success-screen",
    ]

    function normalizeTabHash(raw) {
      if (!raw) {
        return null
      }
      var h = String(raw).replace(/^#/, "")
      if (WDP_TAB_KEYS.indexOf(h) !== -1) {
        return h
      }
      var legacy = h.match(/^wdp-(.+)-tab$/)
      if (legacy && WDP_TAB_KEYS.indexOf(legacy[1]) !== -1) {
        return legacy[1]
      }
      return null
    }

    function wdpSyncMapCards(tabKey) {
      $(".wdp-map-card").removeClass("is-active")
      $(".wdp-map-card[data-tab=\"" + tabKey + "\"]").addClass("is-active")
    }

    function wdpActivateTab(tabKey, opts) {
      opts = opts || {}
      if (WDP_TAB_KEYS.indexOf(tabKey) === -1) {
        return
      }
      $(".wdp-tab-content").removeClass("wdp-tab-active").attr("aria-hidden", "true")
      $(".nav-tab")
        .removeClass("nav-tab-active")
        .attr("aria-selected", "false")

      $(".nav-tab[data-tab=\"" + tabKey + "\"]")
        .addClass("nav-tab-active")
        .attr("aria-selected", "true")
      $("#wdp-" + tabKey + "-tab")
        .addClass("wdp-tab-active")
        .attr("aria-hidden", "false")

      wdpSyncMapCards(tabKey)

      if (!opts.skipHistory) {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", "#" + tabKey)
        } else {
          window.location.hash = tabKey
        }
      }

      if (!opts.skipScroll) {
        var $navWrap = $(".wdp-nav-tab-wrapper, .nav-tab-wrapper").first()
        if ($navWrap.length && $navWrap[0].scrollIntoView) {
          $navWrap[0].scrollIntoView({ block: "nearest", behavior: "smooth" })
        }
      }
    }

    // Tab geçişi (üst menü)
    $(".nav-tab").on("click", function (e) {
      e.preventDefault()
      wdpActivateTab($(this).data("tab"))
    })

    // Sekme haritası kartları
    $(document).on("click", ".wdp-map-card", function () {
      var key = $(this).data("tab")
      if (key) {
        wdpActivateTab(key)
      }
    })

    var wdpHashBoot = true

    // Sayfa açılışında veya geri/ileri: hash ile sekme
    function wdpApplyHashTab() {
      var raw = window.location.hash || ""
      var key = normalizeTabHash(raw)
      if (key) {
        wdpActivateTab(key, { skipScroll: wdpHashBoot })
        wdpHashBoot = false
        return
      }
      // Yalnızca hash tamamen boşaldığında ürün sekmesine dön (#wdp-normal-sec-* gibi iç anchor’lar ürün sekmesine atlama yapmaz)
      var hashCleared = raw === "" || raw === "#"
      if (!wdpHashBoot && hashCleared) {
        wdpActivateTab("products", { skipHistory: true })
      }
      wdpHashBoot = false
    }
    wdpApplyHashTab()
    $(window).on("hashchange", wdpApplyHashTab)

    var $initialTab = $(".wdp-nav-tab-wrapper .nav-tab.nav-tab-active").first()
    if ($initialTab.length) {
      wdpSyncMapCards($initialTab.data("tab"))
    }

    // Normal form ayarlarını kaydet
    $("#wdp-normal-form-settings-form").on("submit", function (e) {
      e.preventDefault()
      var $form = $(this)
      var $button = $("#wdp-save-normal-form-settings")
      var $spinner = $button.next(".spinner")

      // Spinner'ı göster
      $spinner.css("visibility", "visible")

      // Form verilerini al
      var formData = $form.serialize()

      // AJAX isteği gönder
      $.ajax({
        url: wdp_admin.ajax_url,
        type: "POST",
        data: formData + "&action=wdp_save_normal_form_settings&nonce=" + wdp_admin.nonce,
        success: (response) => {
          var $inlineMsg = $button
            .closest(".submit")
            .find(".wdp-inline-save-message")

          if (response.success) {
            showSuccessMessage(response.data.message)
            if ($inlineMsg.length) {
              $inlineMsg
                .text(response.data.message)
                .addClass("is-visible")
            }
          } else {
            showErrorMessage(response.data.message)
            if ($inlineMsg.length) {
              $inlineMsg
                .text(response.data.message || wdp_admin.save_error)
                .addClass("is-visible")
            }
          }

          if ($inlineMsg && $inlineMsg.length) {
            setTimeout(() => {
              $inlineMsg.fadeOut(200, function () {
                $(this).text("").removeClass("is-visible").show()
              })
            }, 2500)
          }
        },
        error: () => {
          showErrorMessage(wdp_admin.save_error)
        },
        complete: () => {
          // Spinner'ı gizle
          $spinner.css("visibility", "hidden")
        },
      })
    })

    // Hisseli form ayarlarını kaydet
    $("#wdp-shareholder-form-settings-form").on("submit", function (e) {
      e.preventDefault()
      var $form = $(this)
      var $button = $("#wdp-save-shareholder-form-settings")
      var $spinner = $button.next(".spinner")

      // Spinner'ı göster
      $spinner.css("visibility", "visible")

      // Form verilerini al
      var formData = $form.serialize()

      // AJAX isteği gönder
      $.ajax({
        url: wdp_admin.ajax_url,
        type: "POST",
        data: formData + "&action=wdp_save_shareholder_form_settings&nonce=" + wdp_admin.nonce,
        success: (response) => {
          if (response.success) {
            showSuccessMessage(response.data.message)
          } else {
            showErrorMessage(response.data.message)
          }
        },
        error: () => {
          showErrorMessage(wdp_admin.save_error)
        },
        complete: () => {
          // Spinner'ı gizle
          $spinner.css("visibility", "hidden")
        },
      })
    })

    // Başarı ekranı ayarlarını kaydet
    $("#wdp-success-screen-settings-form").on("submit", function (e) {
      e.preventDefault()
      var $form = $(this)
      var $button = $("#wdp-save-success-screen-settings")
      var $spinner = $button.next(".spinner")

      // Spinner'ı göster
      $spinner.css("visibility", "visible")

      // Form verilerini al
      var formData = $form.serialize()

      // AJAX isteği gönder
      $.ajax({
        url: wdp_admin.ajax_url,
        type: "POST",
        data: formData + "&action=wdp_save_success_screen_settings&nonce=" + wdp_admin.nonce,
        success: (response) => {
          if (response.success) {
            showSuccessMessage(response.data.message)
          } else {
            showErrorMessage(response.data.message)
          }
        },
        error: () => {
          showErrorMessage(wdp_admin.save_error)
        },
        complete: () => {
          // Spinner'ı gizle
          $spinner.css("visibility", "hidden")
        },
      })
    })
  })

  // Gradient checkbox değiştiğinde renk alanlarını göster/gizle
  $("#shareholders_area_use_gradient").on("change", function () {
    var isChecked = $(this).is(":checked")
    if (isChecked) {
      $(".shareholders-area-color-row").show()
      $(".shareholders-area-solid-row").hide()
    } else {
      $(".shareholders-area-color-row").hide()
      $(".shareholders-area-solid-row").show()
    }
  })

  // Sayfa yüklendiğinde kontrol et
  if ($("#shareholders_area_use_gradient").is(":checked")) {
    $(".shareholders-area-color-row").show()
    $(".shareholders-area-solid-row").hide()
  } else {
    $(".shareholders-area-color-row").hide()
    $(".shareholders-area-solid-row").show()
  }

  // Popup buton font-family değiştiğinde özel font alanını göster/gizle
  $("#popup_button_font_family").on("change", function () {
    var selectedValue = $(this).val()
    if (selectedValue === "custom") {
      $("#popup_button_custom_font_row").show()
    } else {
      $("#popup_button_custom_font_row").hide()
    }
  })

  // Sayfa yüklendiğinde kontrol et
  if ($("#popup_button_font_family").val() === "custom") {
    $("#popup_button_custom_font_row").show()
  } else {
    $("#popup_button_custom_font_row").hide()
  }

  // Popup button size "custom" seçildiğinde özel alanları göster/gizle
  function togglePopupButtonSizeRows() {
    var selectedSize = $("#popup_button_size").val()
    var isCustom = selectedSize === "custom"
    $("#popup_button_custom_min_width_row").toggle(isCustom)
    $("#popup_button_custom_min_height_row").toggle(isCustom)
    $("#popup_button_custom_padding_x_row").toggle(isCustom)
  }

  $("#popup_button_size").on("change", togglePopupButtonSizeRows)
  togglePopupButtonSizeRows()
})(window, document, jQuery)

// Modal görünüm ayarlarını kaydet - DOM ready dışında ama jQuery yüklendikten sonra
jQuery(document).ready(function($) {
  // Başarı mesajı göster
  function showSuccessMessage(message) {
    var $noticeContainer = $("#wdp-admin-notices")
    if ($noticeContainer.length === 0) {
      // Eğer notice container yoksa, formun üstüne ekle
      $noticeContainer = $('<div id="wdp-admin-notices" class="notice wdp-admin-notice"></div>')
      $("#wdp-modal-layout-settings-form").before($noticeContainer)
    }
    $noticeContainer
      .removeClass("notice-error")
      .addClass("notice-success")
      .html("<p>" + message + "</p>")
      .show()

    // 3 saniye sonra mesajı gizle
    setTimeout(() => {
      $noticeContainer.fadeOut()
    }, 3000)
  }

  // Hata mesajı göster
  function showErrorMessage(message) {
    var $noticeContainer = $("#wdp-admin-notices")
    if ($noticeContainer.length === 0) {
      // Eğer notice container yoksa, formun üstüne ekle
      $noticeContainer = $('<div id="wdp-admin-notices" class="notice wdp-admin-notice"></div>')
      $("#wdp-modal-layout-settings-form").before($noticeContainer)
    }
    $noticeContainer
      .removeClass("notice-success")
      .addClass("notice-error")
      .html("<p>" + message + "</p>")
      .show()
  }

  // Modal görünüm ayarlarını kaydet
  $("#wdp-modal-layout-settings-form").on("submit", function (e) {
    e.preventDefault()
    var $form = $(this)
    var $button = $("#wdp-save-modal-layout-settings")
    var $spinner = $button.next(".spinner")

    // Spinner'ı göster
    if ($spinner.length > 0) {
      $spinner.css("visibility", "visible")
    }

    // Form verilerini al
    var formData = $form.serialize()

    // AJAX isteği gönder
    $.ajax({
      url: wdp_admin.ajax_url,
      type: "POST",
      data: formData + "&action=wdp_save_modal_layout_settings&nonce=" + wdp_admin.nonce,
      dataType: "json",
      success: function(response) {
        if (response && response.success) {
          showSuccessMessage(response.data && response.data.message ? response.data.message : "Ayarlar başarıyla kaydedildi.")
        } else {
          var errorMsg = response && response.data && response.data.message ? response.data.message : "Ayarlar kaydedilirken bir hata oluştu."
          showErrorMessage(errorMsg)
        }
      },
      error: function(xhr, status, error) {
        console.error("AJAX Error:", status, error)
        showErrorMessage(wdp_admin && wdp_admin.save_error ? wdp_admin.save_error : "Ayarlar kaydedilirken bir hata oluştu.")
      },
      complete: function() {
        // Spinner'ı gizle
        if ($spinner.length > 0) {
          $spinner.css("visibility", "hidden")
        }
      },
    })
  })
})(window, document, jQuery)

// Progress bar ayarlarını kaydet
jQuery(document).ready(function($) {
  $("#wdp-progress-bar-settings-form").on("submit", function (e) {
    e.preventDefault()
    var $form = $(this)
    var $button = $("#wdp-save-progress-bar-settings")
    var $spinner = $button.next(".spinner")

    $spinner.css("visibility", "visible")

    var formData = $form.serialize()

    $.ajax({
      url: wdp_admin.ajax_url,
      type: "POST",
      data: formData + "&action=wdp_save_progress_bar_settings&nonce=" + wdp_admin.nonce,
      success: function(response) {
        if (response && response.success) {
          var msg = response.data && response.data.message ? response.data.message : wdp_admin.save_success
          var $noticeContainer = $("#wdp-admin-notices")
          if ($noticeContainer.length === 0) {
            $noticeContainer = $('<div id="wdp-admin-notices" class="notice wdp-admin-notice"></div>')
            $form.before($noticeContainer)
          }
          $noticeContainer
            .removeClass("notice-error")
            .addClass("notice-success")
            .html("<p>" + msg + "</p>")
            .show()
          setTimeout(function() {
            $noticeContainer.fadeOut()
          }, 3000)
        } else {
          var errorMsg = response && response.data && response.data.message ? response.data.message : wdp_admin.save_error
          var $noticeContainer = $("#wdp-admin-notices")
          if ($noticeContainer.length === 0) {
            $noticeContainer = $('<div id="wdp-admin-notices" class="notice wdp-admin-notice"></div>')
            $form.before($noticeContainer)
          }
          $noticeContainer
            .removeClass("notice-success")
            .addClass("notice-error")
            .html("<p>" + errorMsg + "</p>")
            .show()
        }
      },
      error: function() {
        var $noticeContainer = $("#wdp-admin-notices")
        if ($noticeContainer.length === 0) {
          $noticeContainer = $('<div id="wdp-admin-notices" class="notice wdp-admin-notice"></div>')
          $form.before($noticeContainer)
        }
        $noticeContainer
          .removeClass("notice-success")
          .addClass("notice-error")
          .html("<p>" + wdp_admin.save_error + "</p>")
          .show()
      },
      complete: function() {
        $spinner.css("visibility", "hidden")
      },
    })
  })
})
