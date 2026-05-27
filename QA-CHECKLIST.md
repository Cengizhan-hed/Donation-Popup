# Donation Popup QA Checklist

Use this checklist before production deploys.

## Refactor regression pass (v10.2.6+)

- [ ] `php tests/smoke/run.php` exits 0 after `npm run build`.
- [ ] PHP `php -l` on all plugin files (no syntax errors).
- [ ] Plugin activates without fatal; WooCommerce inactive shows admin notice only.
- [ ] AJAX add-to-cart with invalid nonce returns JSON error (not PHP fatal).
- [ ] Order complete updates `_wdp_donation_totals_applied` via order object (HPOS site if available).
- [ ] Legacy `WDP.renderDonationButton` still works on pages without full bundle (optional).
- [ ] `wdp_legacy_render_count` option increments when legacy AJAX is used.
- [ ] Production ZIP includes `assets/css/build/manifest.json` and `assets/js/build/manifest.json` after `npm run pack`.
- [ ] Mobile validation: no center alert popup; summary above buttons only.
- [ ] `wdp_get_product_name` still returns name (deprecated flag in JSON) if called by old integrations.

## 1) Modal and Form Basics

- Open donation modal from product page and shortcode button.
- Verify close button, ESC, and outside-click behavior.
- Verify focus moves into modal and returns to trigger after close.

## 2) Shareholder Flow Stability

- Set share count quickly: `1 -> 7 -> 1`.
- Repeat rapid `+/-` interactions for at least 10 seconds.
- Confirm phone input text area/placeholder does not shift horizontally.
- Confirm no row overlap, white blocks, or broken collapses.
- Verify one-row and multi-row submission both succeed.

## 3) Phone Input Behavior

- Country selector opens from flag area only.
- Dial code updates when country changes.
- Phone input accepts digits only.
- Paste non-digit characters and confirm sanitization.

## 4) Cart and Success Screen

- Add to cart from single-donation form and shareholder form.
- Validate mini cart price rendering (currency symbol + amount, no entity text).
- Remove item from mini cart and verify UI updates without reload.
- Verify continue/new donation path restores form correctly.

## 5) Security Smoke Checks

- Try entering HTML/JS payloads in name/note fields (e.g. `<script>alert(1)</script>`).
- Confirm payload renders as plain text in UI and cart meta.
- Verify AJAX actions still require nonce and same-origin session.

## 6) Responsive Pass

- Desktop: Chrome + Safari.
- Mobile: iOS Safari + Android Chrome.
- Tablet: iPad Safari or Chrome tablet mode.
- Re-run sections 2, 3, and 4 on each breakpoint.

## 7) Regression Quick Pass

- Checkout redirect button still works.
- Add-to-cart button state resets after failures.
- Progress bar updates after add/remove cart actions.
- No console errors during normal user flow.
