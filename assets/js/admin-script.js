/**
 * WooCommerce Donation Modal Popup Admin Scripts
 */
;((window, document, $) => {
  // DOM hazır olduğunda
  $(document).ready(() => {
    // Değişkenleri tanımla
    const wdp_admin = window.wdp_admin // Declare wdp_admin variable
    var $noticeContainer = $("#wdp-admin-notices")

    // Başarı mesajı göster
    function showSuccessMessage(message) {
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
      $noticeContainer
        .removeClass("notice-success")
        .addClass("notice-error")
        .html("<p>" + message + "</p>")
        .show()
    }

    // Tek ürün ayarlarını kaydet
    $(".wdp-save-product").on("click", function () {
      var $button = $(this)
      var $row = $button.closest("tr")
      var productId = $row.data("product-id")
      var $spinner = $row.find(".spinner")

      // Spinner'ı göster
      $spinner.css("visibility", "visible")

      // Ayarları al
      var allowCustomPrice = $row.find('input[name="allow_custom_price"]').is(":checked")
      var minCustomPrice = $row.find('input[name="min_custom_price"]').val()
      var allowMultipleShares = $row.find('input[name="allow_multiple_shares"]').is(":checked")
      var maxShares = $row.find('input[name="max_shares"]').val()

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
      var $rows = $(".wdp-products-table tbody tr")
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

    // Tab geçişi
    $(".nav-tab").on("click", function (e) {
      e.preventDefault()
      var $tab = $(this)
      var targetTab = $tab.data("tab")

      // Tüm tab'ları gizle
      $(".wdp-tab-content").removeClass("wdp-tab-active")
      $(".nav-tab").removeClass("nav-tab-active")

      // Seçili tab'ı göster
      $tab.addClass("nav-tab-active")
      $("#wdp-" + targetTab + "-tab").addClass("wdp-tab-active")
    })

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
})(window, document, jQuery)
