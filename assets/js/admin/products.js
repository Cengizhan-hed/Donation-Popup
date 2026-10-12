/**
 * @file products.js
 * Ayarlar → Ürünler tablosu ve ürün "Bağış" sekmesi: kopyalama, toplam yenileme, bağış tipi, satır editörleri ve blok sırası.
 */
;((window, document) => {
  "use strict"

  const cfg = window.wdpProductsAdmin || {}
  const i18n = cfg.i18n || {}

  function announce(message) {
    const region = document.querySelector("[data-wdp-products-status]")
    if (!region || !message) return
    region.textContent = ""
    window.setTimeout(() => {
      region.textContent = message
    }, 40)
  }

  /* ---------------------------------------------------------------------
   * Clipboard
   * ------------------------------------------------------------------- */

  function legacyCopy(text) {
    const temp = document.createElement("textarea")
    temp.value = text
    temp.setAttribute("readonly", "")
    temp.style.position = "fixed"
    temp.style.opacity = "0"
    document.body.appendChild(temp)
    temp.select()
    let ok = false
    try {
      ok = document.execCommand("copy")
    } catch (e) {
      ok = false
    }
    temp.remove()
    return ok
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        () => true,
        () => legacyCopy(text)
      )
    }
    return Promise.resolve(legacyCopy(text))
  }

  function flashCopied(button) {
    button.classList.add("is-copied")
    const icon = button.querySelector(".dashicons")
    const isIconOnly = !!icon && button.textContent.trim() === ""
    const original = isIconOnly ? null : button.textContent
    if (icon) icon.classList.replace("dashicons-admin-page", "dashicons-yes")
    if (!isIconOnly) button.textContent = i18n.copied || "Kopyalandı"

    window.setTimeout(() => {
      button.classList.remove("is-copied")
      if (icon) icon.classList.replace("dashicons-yes", "dashicons-admin-page")
      if (original !== null) button.textContent = original
    }, 1600)
  }

  function onCopyClick(button) {
    let text = button.getAttribute("data-wdp-copy") || ""
    const targetSelector = button.getAttribute("data-wdp-copy-target")
    if (!text && targetSelector) {
      const target = document.querySelector(targetSelector)
      if (target) text = target.value || target.textContent || ""
    }
    if (!text) return

    copyText(text).then((ok) => {
      if (ok) {
        flashCopied(button)
        announce((i18n.copied || "Kopyalandı") + ": " + text)
      } else {
        announce(i18n.copyFailed || "")
      }
    })
  }

  /* ---------------------------------------------------------------------
   * Progress total recalculation
   * ------------------------------------------------------------------- */

  function updateProgress(widget, total, totalText) {
    if (!widget) return
    const goal = parseFloat(widget.getAttribute("data-goal") || "0")
    const percent = goal > 0 ? Math.min(100, Math.floor((total / goal) * 100)) : 0

    const totalEl = widget.querySelector("[data-wdp-progress-total]")
    const barEl = widget.querySelector("[data-wdp-progress-bar]")
    const trackEl = widget.querySelector("[data-wdp-progress-track]")
    const percentEl = widget.querySelector("[data-wdp-progress-percent]")

    if (totalEl && totalText) totalEl.textContent = totalText
    if (barEl) barEl.style.width = percent + "%"
    if (trackEl) trackEl.setAttribute("aria-valuenow", String(percent))
    if (percentEl) percentEl.textContent = "%" + percent
  }

  function onRecalcClick(button) {
    if (button.disabled || !cfg.ajaxUrl) return
    const productId = button.getAttribute("data-product-id")
    if (!productId) return

    button.disabled = true
    button.classList.add("is-busy")
    button.setAttribute("aria-busy", "true")
    announce(i18n.recalculating || "")

    const body = new window.FormData()
    body.append("action", "wdp_recalculate_product_total")
    body.append("nonce", cfg.nonce || "")
    body.append("product_id", productId)

    window
      .fetch(cfg.ajaxUrl, { method: "POST", credentials: "same-origin", body: body })
      .then((response) => response.json().catch(() => null))
      .then((json) => {
        const data = (json && json.data) || {}
        if (json && json.success) {
          updateProgress(button.closest("[data-wdp-progress]"), Number(data.total) || 0, data.total_text || "")
          announce(data.message || "")
        } else {
          announce(data.message || i18n.error || "")
        }
      })
      .catch(() => announce(i18n.error || ""))
      .finally(() => {
        button.disabled = false
        button.classList.remove("is-busy")
        button.removeAttribute("aria-busy")
      })
  }

  /* ---------------------------------------------------------------------
   * Product panel: donation type
   * ------------------------------------------------------------------- */

  function applyType(panel, type) {
    panel.querySelectorAll("[data-wdp-type-card]").forEach((card) => {
      const input = card.querySelector("[data-wdp-type-input]")
      card.classList.toggle("is-selected", !!input && input.checked)
    })

    panel.querySelectorAll("[data-wdp-type-scope]").forEach((scope) => {
      const types = (scope.getAttribute("data-wdp-type-scope") || "").split(/\s+/)
      const visible = types.indexOf(type) !== -1
      scope.hidden = !visible
      if (!visible) {
        // A hidden invalid control would silently block the product form submit.
        scope.querySelectorAll("input, select, textarea").forEach((control) => {
          if (typeof control.checkValidity === "function" && !control.checkValidity()) {
            control.value = control.defaultValue
          }
        })
      }
    })
  }

  /* ---------------------------------------------------------------------
   * Product panel: repeaters
   * ------------------------------------------------------------------- */

  function syncRepeater(repeater) {
    const max = parseInt(repeater.getAttribute("data-max") || "0", 10)
    const rows = repeater.querySelectorAll("[data-wdp-repeater-rows] > [data-wdp-repeater-row]")
    const add = repeater.querySelector("[data-wdp-repeater-add]")
    if (add) add.disabled = max > 0 && rows.length >= max
  }

  function addRepeaterRow(repeater) {
    const template = repeater.querySelector("template[data-wdp-repeater-template]")
    const list = repeater.querySelector("[data-wdp-repeater-rows]")
    if (!template || !list) return

    const index = parseInt(repeater.getAttribute("data-next-index") || "0", 10)
    repeater.setAttribute("data-next-index", String(index + 1))

    const html = template.innerHTML.replace(/__INDEX__/g, String(index))
    const holder = document.createElement("ol")
    holder.innerHTML = html.trim()
    const row = holder.firstElementChild
    if (!row) return

    list.appendChild(row)
    syncRepeater(repeater)
    const first = row.querySelector("input, select, textarea")
    if (first) first.focus()
    announce(i18n.rowAdded || "")
  }

  function removeRepeaterRow(button) {
    const repeater = button.closest("[data-wdp-repeater]")
    const row = button.closest("[data-wdp-repeater-row]")
    if (!repeater || !row) return

    const sibling = row.previousElementSibling || row.nextElementSibling
    row.remove()
    syncRepeater(repeater)

    const focusTarget = sibling
      ? sibling.querySelector("[data-wdp-repeater-remove]")
      : repeater.querySelector("[data-wdp-repeater-add]")
    if (focusTarget) focusTarget.focus()
    announce(i18n.rowRemoved || "")
  }

  /* ---------------------------------------------------------------------
   * Product panel: module order
   * ------------------------------------------------------------------- */

  function moveOrderItem(button) {
    const item = button.closest("[data-wdp-order-item]")
    if (!item) return
    const direction = button.getAttribute("data-wdp-order-move")
    const target = direction === "up" ? item.previousElementSibling : item.nextElementSibling
    if (!target) return

    if (direction === "up") {
      target.before(item)
    } else {
      target.after(item)
    }
    button.focus()
    const label = item.querySelector(".wdp-order__label")
    announce((i18n.moved || "") + (label ? " " + label.textContent : ""))
  }

  /* ---------------------------------------------------------------------
   * Product panel: open the tab from #wdp_donation and on invalid fields
   * ------------------------------------------------------------------- */

  function activateDonationTab() {
    const key = cfg.tabKey || "wdp_donation"
    const link = document.querySelector("#woocommerce-product-data ." + key + "_options > a")
    if (!link) return false
    link.click()
    return true
  }

  function openFromHash() {
    const key = cfg.tabKey || "wdp_donation"
    if (window.location.hash !== "#" + key) return
    if (activateDonationTab()) {
      const box = document.getElementById("woocommerce-product-data")
      if (box) box.scrollIntoView({ block: "start" })
    }
  }

  function revealInvalid(event) {
    const control = event.target
    if (!control || !control.closest) return
    const panel = control.closest("[data-wdp-product-panel]")
    if (!panel) return

    if (panel.offsetParent === null) activateDonationTab()
    let details = control.closest("details")
    while (details) {
      details.open = true
      details = details.parentElement ? details.parentElement.closest("details") : null
    }
  }

  function initColorPickers(panel) {
    const $ = window.jQuery
    if (!$ || !$.fn || typeof $.fn.wpColorPicker !== "function") return
    $(panel).find(".wdp-color-field").wpColorPicker()
  }

  function initPanel(panel) {
    panel.addEventListener("change", (event) => {
      const target = event.target
      if (target.matches("[data-wdp-type-input]")) {
        applyType(panel, target.value)
      } else if (target.matches("[data-wdp-order-toggle]")) {
        const fieldset = panel.querySelector("[data-wdp-order]")
        if (fieldset) fieldset.disabled = !target.checked
      } else if (target.matches("[data-wdp-shortcode-select]")) {
        const output = panel.querySelector("[data-wdp-shortcode-output]")
        if (output) output.value = target.value
      }
    })

    panel.addEventListener("click", (event) => {
      const add = event.target.closest("[data-wdp-repeater-add]")
      if (add) {
        event.preventDefault()
        addRepeaterRow(add.closest("[data-wdp-repeater]"))
        return
      }
      const remove = event.target.closest("[data-wdp-repeater-remove]")
      if (remove) {
        event.preventDefault()
        removeRepeaterRow(remove)
        return
      }
      const move = event.target.closest("[data-wdp-order-move]")
      if (move) {
        event.preventDefault()
        moveOrderItem(move)
      }
    })

    panel.querySelectorAll("[data-wdp-repeater]").forEach(syncRepeater)

    const output = panel.querySelector("[data-wdp-shortcode-output]")
    if (output) {
      output.addEventListener("focus", () => output.select())
    }

    const form = panel.closest("form")
    if (form) form.addEventListener("invalid", revealInvalid, true)

    initColorPickers(panel)
  }

  function init() {
    document.addEventListener("click", (event) => {
      const copy = event.target.closest("[data-wdp-copy], [data-wdp-copy-target]")
      if (copy) {
        event.preventDefault()
        onCopyClick(copy)
        return
      }
      const recalc = event.target.closest("[data-wdp-recalc]")
      if (recalc) {
        event.preventDefault()
        onRecalcClick(recalc)
      }
    })

    document.querySelectorAll("[data-wdp-product-panel]").forEach(initPanel)

    if (document.querySelector("[data-wdp-product-panel]")) {
      // WooCommerce binds its tab handlers on jQuery ready; run after them.
      window.setTimeout(openFromHash, 0)
      window.addEventListener("hashchange", openFromHash)
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }
})(window, document)
