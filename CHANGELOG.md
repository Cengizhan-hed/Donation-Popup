# Changelog

All notable changes to Donation Panel for WooCommerce are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [12.1.1]

### Security / caching
- The plugin's page HTML is identical for every visitor, so page caches can store it safely.
- Side cart content and the account icon state are read in the browser through REST.
- No request is made when there is no WooCommerce cart cookie.
- Campaign display counts only the confirmed total.

### Changed
- A page with no donation surface (form or shortcode) no longer shows the floating side cart button to visitors who have a cart cookie.

### Test infrastructure (not shipped)
- Adjustments for the disabled-button, ARIA tab and Gift Aid step tests; remote measurement scripts.

### Rollback plan
1. Reinstall the 12.1.0 plugin zip over the folder. Settings and orders are kept.
2. 12.1.1 writes no new option or meta keys, so there is nothing to clean up.

## [12.1.0]

### Added
- Direct donation (no cart): order-pay flow with WooCommerce completion hooks (purchase event fires once, idempotent).
- Instant open of the donation layer, lazy initialization.
- Theme colors: palette read from WordPress global styles; two admin color pickers.
- Floating side cart button (absent and request-free while the cart is empty).
- Trusted proxy setting (`general.trusted_proxies`).
- Security hardening: nonce origin check, rate-limit buckets, salted HMAC, submission ownership, `DONATION_PANEL_DISABLE` gate.
- Zero front-end load on pages without a donation surface; assets enqueue only when rendered.

### Changed
- Vertical cards; no image in the form; panel headings are h2; root class prefix `.donation-panel`.
- Keyboard behavior on mobile: no auto-focus, bottom section follows the flow when the keyboard is open.

### Removed
- Old visual baselines and dead code.

### Rollback plan
1. Reinstall the previous (12.0.0) plugin zip over the folder (Plugins > Add New > Upload, replace). Settings and orders are kept.
2. New keys written by 12.1.0 are harmless to 12.0.0 and may stay: `general.trusted_proxies`, `direct.enabled`, product meta `_donation_panel_direct`, `side_cart.floating`, order meta `_donation_panel_direct_owner`, autoload flag `donation_panel_autoload_v2`. No data migration needs reversing.
3. If totals look wrong, restore the plugin options from backup; `wp donation-panel recalc-totals --dry-run` previews recalculation.

## [12.0.0]

### Changed
- 12.0.0 — single experience, single menu, new design, checkout pre-fill; the previous form engine and admin screens were removed.
- One set of design tokens (`--dp-*`) drives every donor surface; brand and button colors come from the admin settings or, when empty, from the theme presets.
- The form uses the store country for the phone prefix, shows the WordPress privacy page link when enabled, and honors the full-width button setting.

### Removed
- The previous form engine, the old admin settings screen and the engine/admin switch settings (`experiences.engine`, `admin.ui`). Public shortcodes, hooks and option keys are unchanged.

## [11.0.0]

### Added
- New architecture: namespaced code (`DonationPanel\`), REST endpoints and a WooCommerce Store API bridge for the cart.
- New donation form engine with three steps and all donation types (fixed, donor-chosen, shared, campaign, add-on).
- Campaign goals and progress bars, impact statements, and an optional social proof module (real data only, no personal details).
- Side cart, thank-you screen and tax relief declaration.
- Optional donor account module (off by default): sign in, register, My donations in WooCommerce My Account.
- New admin screens with a setup wizard and a built-in guide.
- WordPress privacy tools: personal data export and erase, plus a suggested privacy policy text.
- WP-CLI command `wp donation-panel recalc-totals`.
- Preview of any form with `?dp_preview=1`.
- Hooks and filters reference in `docs/HOOKS.md`.

### Changed
- Upgraded sites keep the previous form engine and admin screens until the new experience is selected in settings; new installs use the new experience by default.
- Performance: deferred script bundle and a CSS minification fix.

### Security
- The `wdp_render_modal` request is protected by a nonce.
- Hidden add-on products are kept out of the catalog.
- Per-email limit on donations.

### Removed
- The `wdp_vid` cookie.
- The "return to the old experience" option is available for one release only and will be removed in 12.0.

### Compatibility
- Shortcodes and post meta keys are unchanged.

## [10.35.2]
- Internal naming made generic (add-on donation); existing product settings are migrated automatically.

## [10.35.1]
- Plugin renamed to Donation Panel for WooCommerce; readme.txt added.

## [10.35.0]
- Language support: English source strings with Turkish translation, RTL support.
