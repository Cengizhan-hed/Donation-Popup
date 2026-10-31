# Changelog

All notable changes to Donation Panel for WooCommerce are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [12.4.0]

### Added
- Phone field: country table, number formatting, +code and leading 0 stripping, warning hint, E.164 hand-off to the order, server-side validation.
- Customer email: thank-you section (can be turned off in the settings; only for paid orders); item labels in the recipient's language; phone and technical meta filtered out of customer emails; compatibility with the block email editor.
- Email info line for logged-in donors (no layout shift).
- Android keyboard verification (emulator test).
- Strict `verify` (no silent skips), Knip, test port reservation.

### Changed
- Card forms are embedded in the page HTML: 0 extra requests.
- Compact card v3: cart flow only, 356 px card, single fixed-price screen, trust line and Total row removed, setting `compact.trust` removed.
- The email field appears only in the direct + guest flow and is required; it is not shown in cart forms.
- On keyboard close only the lower section changes opacity; the field stays at least 12 px above the keyboard.
- Removed email settings are cleaned up by migration.

### Fixed
- Direct donations did not ask for an email, so Stripe payments failed.
- The button shook and shrank while the keyboard closed.
- The phone hint shifted the button.
- Semgrep did not scan JS.

### Security
- Card bundle is independent of capability; per-product cache key.
- `logged_in` is a boolean only.
- Read-only cron-status.

## [12.3.0]

### Added
- Direct donation settings at three levels: global switch, per donation type (fixed, donor-chosen, shares, campaign, add-on) and per product, with a "current value (source)" line on the product screen.
- Compact card v2: 384 px wide, 2 or 3 steps, Gift Aid / tax declaration with a Details layer, trust line (setting `compact.trust`), shortcode builder and guide sections in the admin.
- Live campaign progress bar on every surface (shortcode card, form in every container, compact card): personal preview of the donor's own amount, cart sync (including the side cart), refresh after payment, goal celebration, "Be the first to give" at zero; three admin settings.
- Form prefetch: list and shop cards fetch their forms once after load, so the panel opens without a request on tap (filter `donation_panel_prefetch_forms`).
- Color source display in the admin (theme palette role, default, or your own choice).
- Side cart settings: floating button, button corner, add-on suggestion (product, up to 3 amounts, short line).

### Changed
- Layer open/close animation: `overflow: clip`, a separate backdrop layer, a springless 260 ms ease; the panel no longer shakes.
- Focus: a thin border for mouse and touch, a ring for keyboard.
- Colors: only named palette roles are used; a theme without them gets a neutral default and an admin notice instead of a guessed color.

### Fixed
- On direct donations the add-on option was silently dropped.
- On block themes the shop card did not open the form.
- Side cart style leaks (Storefront focus ring and button hover border).
- An untranslated donation type name was shown in the side cart.

### Security
- REST root and prefetch URL validation (same origin and plugin namespace only).
- The batch endpoint rate limit is charged per product.
- Script and style URLs are never read from the DOM.

### Rollback plan
1. Reinstall the 12.2.0 plugin zip over the folder (docs/CANLIYA-ALMA.md G2 steps). Settings and orders are kept.
2. New keys written by 12.3.0 (`direct.type_*`, `progress.*`, `compact.trust`, side cart settings) are ignored by 12.2.0 and can stay.
3. A button color computed from a neutral default is only a display fallback; no stored color is changed.

## [12.2.0]

### Fixed — zero tolerance for unstyled content
- Every donation surface visible at first paint (inline form, compact card, donation list/cards, campaign bar, buttons) carries the CSS it needs as an inline `<style>` right before its output, once per page, scoped to `.donation-panel`. It is styled in every page builder, slider, editor preview and AJAX response without content scanning.
- The plugin loads no CSS file on the front end; render-blocking plugin files: 0.
- The panel (popup, side panel, bottom sheet, side cart, direct payment) is styled the instant it opens; the "wait for styles" fallback was removed.
- All inline SVG icons carry width/height.

### Fixed — layout shift (CLS) root causes
- The step label and the first button state ("Choose an amount" / "Donate %s", lock, hidden total) are rendered on the server exactly as the script would render them, so nothing moves when the script attaches.

### Added
- Compact donation card: `[wdp_donation_form id="…" layout="compact"]`, with the same option in the block and the Elementor compatibility widget. The card height never changes between steps (steps share one grid cell; inactive steps are hidden and inert), events inside the card do not reach sliders, no product image. Payment opens in a layer showing the standard WooCommerce order-pay page.
- Without `layout`, the form renders exactly as before.

### Changed
- Color settings accept a CSS variable as well as hex (for example `var(--e-global-color-primary)`); contrast is checked in the browser after the variable resolves.
- Admin preview notes are shown only in the editor preview, never to visitors.

### Test infrastructure (not shipped)
- Canary scope: only what tests and installation can change is guarded; a real administrator's content edits are accepted automatically, risky changes warn.
- Plugin-owned speed measurement (`measure:plugin-perf`): requests, bytes, queries, cookies, render-blocking files, main-thread time, long tasks, CLS attribution, INP (median of 5 samples), tap→panel (median of 5).
- First-paint test: computed styles of plugin elements checked in the first painted frame with throttled network and CPU.

### Rollback plan
1. Reinstall the 12.1.1 plugin zip over the folder (docs/CANLIYA-ALMA.md G2 steps). Settings and orders are kept.
2. New option keys written by 12.2.0 are harmless in 12.1.1 and can stay: `compact.quick_amounts`, `compact.first_text`, `compact.reset_hidden`. Shortcodes with `layout="compact"` fall back to the standard form in 12.1.1.
3. If a color setting holds a CSS variable (`var(--…)`), set it to a hex value before rolling back; 12.1.1 expects hex.

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
