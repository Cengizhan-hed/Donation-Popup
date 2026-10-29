=== Donation Panel for WooCommerce ===
Contributors: cengizhancoban
Tags: donation, woocommerce, charity, popup, fundraising
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Requires Plugins: woocommerce
Stable tag: 12.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Adds a donation form to WooCommerce products as a popup, side panel or inline form.

== Description ==

Donation Panel for WooCommerce turns WooCommerce products into donation products. Donors pick or type an amount and continue through the normal WooCommerce cart and checkout, so currency, tax, payment methods and orders work the way your store already does.

* Popup, side panel or inline form, designed mobile first.
* Fixed amount, donor-chosen amount, shared (multi-share) and goal-based campaign donation types.
* Progress bar for campaigns.
* Dedication and on-behalf-of fields saved on the order.
* Works with classic and block checkout and with HPOS.
* Shortcodes, a Gutenberg block and Elementor widgets.
* Turkish translation included; right-to-left languages supported.

== Installation ==

1. Upload the plugin to `/wp-content/plugins/woo-donation-popup/` or install it from the Plugins screen.
2. Activate it (WooCommerce must be active).
3. Open WooCommerce > Donation Popup settings and choose your products and appearance.
4. Add a form with `[wdp_donation_form]`, `[wdp_donation_button]` or `[wdp_donations]`.

== Frequently Asked Questions ==

= Does it need WooCommerce? =
Yes. Currency, decimals, taxes, payment and orders all come from WooCommerce.

= Does it work with block checkout and HPOS? =
Yes, both classic and block checkout and High-Performance Order Storage are supported.

= How do I add the form to a page? =
Use the `[wdp_donation_form id="123"]` shortcode, the Gutenberg block or the Elementor widget.

= Where is my privacy text? =
Write it on your site; the form only shows a link to the page you choose.

== Upgrade Notice ==

= 12.2.0 =
No unstyled flash: forms are styled from the first frame, nothing render-blocking. New compact donation card for sliders. Colors accept CSS variables. Rolling back to 12.1.1 is safe. Back up before updating.

= 12.1.1 =
Caching fix. The page HTML is now identical for every visitor, so page caches can store it safely; cart, account state and campaign totals load in the browser. Nothing new is written to the database; rolling back to 12.1.0 is safe. Back up before updating.

= 12.1.0 =
Performance and security release. Nothing loads on pages without a donation surface; direct donations, floating side cart button, theme colors. Settings and orders are kept. Back up before updating.

= 12.0.0 =
Major release. One experience, one menu: the previous form engine and settings screens were removed. Settings, orders, shortcodes and blocks are kept. Back up before updating.

== Changelog ==

= 12.2.0 =
* Fixed: zero tolerance for unstyled content. Each visible donation surface carries its own small inline style (once per page); the plugin loads no CSS file and nothing render-blocking; the panel is styled the moment it opens (the old "wait for styles" fallback was removed).
* Fixed: layout shift root causes. The step label and the first button state are rendered on the server.
* Added: compact donation card (`[wdp_donation_form id="123" layout="compact"]`, also in the block and Elementor widget): fixed height on every step, payment opens in a layer.
* Changed: color settings accept a CSS variable such as `var(--brand)`; contrast is checked in the browser.
* Changed: admin preview notes are shown only in the editor preview.
* Rollback: new keys `compact.quick_amounts`, `compact.first_text`, `compact.reset_hidden` are ignored by 12.1.1; returning to 12.1.1 with the zip is safe.

= 12.1.1 =
* Security/caching: the page HTML is the same for all visitors; side cart content and account icon state are read in the browser through REST; no request when there is no cart cookie; campaign display counts only the confirmed total.
* Changed: a page with no donation surface (form or shortcode) no longer shows the floating side cart button to visitors with a cart cookie.
* Rollback: 12.1.1 writes no new option or meta keys; returning to 12.1.0 with the zip is safe.

= 12.1.0 =
* Added: direct donation (no cart), instant open, theme color palette support, floating side cart button, trusted proxy setting, security hardening.
* Changed: vertical cards, no image in the form, h2 headings, `.donation-panel` class prefix, keyboard behavior on mobile.
* Removed: old baselines and dead code. Zero front-end load on pages without a donation surface.

= 12.0.0 =
* One experience, one menu, new design; donation form pre-fills the checkout page. The previous form engine and admin screens were removed.
* Shortcodes, blocks, hooks and stored settings keep working (compatibility contract).


= 11.0.0 =
* New architecture: namespaced code (`DonationPanel\`), REST endpoints and a WooCommerce Store API bridge for the cart; the `wdp_render_modal` request is now protected by a nonce.
* New donation form engine: three steps, all donation types (fixed, donor-chosen, shared, campaign, add-on).
* Campaign goals and progress bars; impact statements; optional social proof module (real data only, no personal details).
* Side cart, thank-you screen and tax relief declaration.
* Donor account module (optional, off by default): sign in, register, My donations in WooCommerce My Account.
* New admin screens with a setup wizard and a built-in guide.
* WordPress privacy tools: personal data export and erase, plus a suggested privacy policy text. The `wdp_vid` cookie was removed.
* Security fixes: hidden add-on products are kept out of the catalog, per-email limit on donations.
* Performance: deferred script bundle and a fix for CSS minification.
* WP-CLI: `wp donation-panel recalc-totals`. Preview any form with `?dp_preview=1`.
* "Return to the old experience" option, available for one release and removed in 12.0.
* Hooks and filters are documented in docs/HOOKS.md.
* Compatibility: shortcodes and post meta keys are unchanged.

= 10.35.2 =
* Internal naming made generic (add-on donation); existing product settings are migrated automatically and stay readable.

= 10.35.1 =
* Plugin renamed to Donation Panel for WooCommerce; author and description updated; readme.txt added.

= 10.35.0 =
* Language support: English source strings with Turkish translation, RTL support, phone country list from the store country.

= 10.34.x =
* Theme and WooCommerce compatibility matrix, safer testing tools, many fixes.
