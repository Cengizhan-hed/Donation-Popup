=== Donation Panel for WooCommerce ===
Contributors: cengizhancoban
Tags: donation, woocommerce, charity, popup, fundraising
Requires at least: 5.0
Tested up to: 7.1
Requires PHP: 7.4
Requires Plugins: woocommerce
Stable tag: 10.35.1
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

== Changelog ==

= 10.35.1 =
* Plugin renamed to Donation Panel for WooCommerce; author and description updated; readme.txt added.

= 10.35.0 =
* Language support: English source strings with Turkish translation, RTL support, phone country list from the store country.

= 10.34.x =
* Theme and WooCommerce compatibility matrix, safer testing tools, many fixes.
