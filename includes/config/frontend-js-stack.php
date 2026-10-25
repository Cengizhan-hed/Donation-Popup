<?php
/**
 * Ön yüz JS modüllerinin handle, dosya yolu ve bağımlılık sırası yapılandırması.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

return array(
	array(
		'handle' => 'wdp-i18n-js',
		'file'   => 'src/core/i18n.js',
		'deps'   => array(),
	),
	array(
		'handle' => 'wdp-constants-js',
		'file'   => 'src/core/constants.js',
		'deps'   => array(),
	),
	array(
		'handle' => 'wdp-meta-tracking-js',
		'file'   => 'src/meta-tracking.js',
		'deps'   => array(),
	),
	array(
		'handle' => 'wdp-utils-js',
		'file'   => 'src/core/utils.js',
		'deps'   => array(),
	),
	array(
		'handle' => 'wdp-cta-viewport-js',
		'file'   => 'src/core/cta-viewport.js',
		'deps'   => array( 'wdp-utils-js' ),
	),
	array(
		'handle' => 'wdp-state-js',
		'file'   => 'src/core/state.js',
		'deps'   => array( 'wdp-utils-js' ),
	),
	array(
		'handle' => 'wdp-dom-js',
		'file'   => 'src/core/dom.js',
		'deps'   => array( 'wdp-state-js' ),
	),
	array(
		'handle' => 'wdp-phone-input-js',
		'file'   => 'src/phone-input.js',
		'deps'   => array( 'wdp-utils-js' ),
	),
	array(
		'handle' => 'wdp-product-js',
		'file'   => 'src/product.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-state-js' ),
	),
	array(
		'handle' => 'wdp-cart-ui-js',
		'file'   => 'src/cart/ui.js',
		'deps'   => array( 'wdp-utils-js' ),
	),
	array(
		'handle' => 'wdp-cart-woo-js',
		'file'   => 'src/cart/woo.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-state-js', 'wdp-constants-js' ),
	),
	array(
		'handle' => 'wdp-cart-actions-js',
		'file'   => 'src/cart/actions.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-state-js', 'wdp-cart-ui-js', 'wdp-cart-woo-js' ),
	),
	array(
		'handle' => 'wdp-cart-js',
		'file'   => 'src/cart.js',
		'deps'   => array( 'wdp-cart-ui-js', 'wdp-cart-woo-js', 'wdp-cart-actions-js' ),
	),
	array(
		'handle' => 'wdp-form-messages-js',
		'file'   => 'src/form/messages.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-phone-input-js' ),
	),
	array(
		'handle' => 'wdp-form-pricing-js',
		'file'   => 'src/form/pricing.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-state-js' ),
	),
	array(
		'handle' => 'wdp-form-feedback-js',
		'file'   => 'src/form/feedback.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-dom-js' ),
	),
	array(
		'handle' => 'wdp-form-sadaka-rules-js',
		'file'   => 'src/form/addon-rules.js',
		'deps'   => array( 'wdp-utils-js' ),
	),
	array(
		'handle' => 'wdp-form-sadaka-js',
		'file'   => 'src/form/addon.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-form-messages-js', 'wdp-form-pricing-js', 'wdp-form-feedback-js', 'wdp-form-sadaka-rules-js' ),
	),
	array(
		'handle' => 'wdp-form-ajax-js',
		'file'   => 'src/form/ajax.js',
		'deps'   => array(
			'wdp-utils-js',
			'wdp-state-js',
			'wdp-cart-js',
			'wdp-form-pricing-js',
			'wdp-form-sadaka-js',
			'wdp-form-feedback-js',
		),
	),
	array(
		'handle' => 'wdp-form-validate-js',
		'file'   => 'src/form/validate.js',
		'deps'   => array(
			'wdp-utils-js',
			'wdp-dom-js',
			'wdp-form-messages-js',
			'wdp-form-pricing-js',
			'wdp-form-feedback-js',
			'wdp-form-sadaka-js',
		),
	),
	array(
		'handle' => 'wdp-form-wizard-js',
		'file'   => 'src/form/wizard.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-form-feedback-js', 'wdp-form-validate-js' ),
	),
	array(
		'handle' => 'wdp-form-cta-ready-js',
		'file'   => 'src/form/cta-ready.js',
		'deps'   => array(),
	),
	array(
		'handle' => 'wdp-form-js',
		'file'   => 'src/form.js',
		'deps'   => array(
			'wdp-utils-js',
			'wdp-state-js',
			'wdp-cart-js',
			'wdp-phone-input-js',
			'wdp-form-messages-js',
			'wdp-form-pricing-js',
			'wdp-form-feedback-js',
			'wdp-form-sadaka-js',
			'wdp-form-ajax-js',
			'wdp-form-validate-js',
			'wdp-form-wizard-js',
			'wdp-form-cta-ready-js',
		),
	),
	array(
		'handle' => 'wdp-shareholder-layout-js',
		'file'   => 'src/shareholder/layout.js',
		'deps'   => array(),
	),
	array(
		'handle' => 'wdp-shareholder-list-js',
		'file'   => 'src/shareholder/list.js',
		'deps'   => array( 'wdp-shareholder-layout-js' ),
	),
	array(
		'handle' => 'wdp-shareholder-scroll-js',
		'file'   => 'src/shareholder/scroll.js',
		'deps'   => array( 'wdp-shareholder-layout-js', 'wdp-shareholder-list-js', 'wdp-state-js' ),
	),
	array(
		'handle' => 'wdp-shareholder-guidance-js',
		'file'   => 'src/shareholder/guidance.js',
		'deps'   => array( 'wdp-form-js' ),
	),
	array(
		'handle' => 'wdp-shareholder-render-js',
		'file'   => 'src/shareholder/render.js',
		'deps'   => array(
			'wdp-shareholder-layout-js',
			'wdp-shareholder-list-js',
			'wdp-shareholder-scroll-js',
			'wdp-shareholder-guidance-js',
			'wdp-phone-input-js',
		),
	),
	array(
		'handle' => 'wdp-shareholder-quantity-js',
		'file'   => 'src/shareholder/quantity.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-state-js', 'wdp-shareholder-render-js' ),
	),
	array(
		'handle' => 'wdp-shareholder-forms-sync-js',
		'file'   => 'src/shareholder/forms-sync.js',
		'deps'   => array( 'wdp-utils-js' ),
	),
	array(
		'handle' => 'wdp-shareholder-setup-js',
		'file'   => 'src/shareholder/setup.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-state-js', 'wdp-product-js', 'wdp-constants-js' ),
	),
	array(
		'handle' => 'wdp-shareholder-js',
		'file'   => 'src/shareholder.js',
		'deps'   => array(
			'wdp-utils-js',
			'wdp-state-js',
			'wdp-dom-js',
			'wdp-product-js',
			'wdp-form-js',
			'wdp-shareholder-layout-js',
			'wdp-shareholder-list-js',
			'wdp-shareholder-scroll-js',
			'wdp-shareholder-guidance-js',
			'wdp-shareholder-render-js',
			'wdp-shareholder-quantity-js',
			'wdp-shareholder-forms-sync-js',
			'wdp-shareholder-setup-js',
		),
	),
	array(
		'handle' => 'wdp-progress-bar-js',
		'file'   => 'src/progress-bar.js',
		'deps'   => array( 'wdp-utils-js' ),
	),
	array(
		'handle' => 'wdp-modal-js',
		'file'   => 'src/modal.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-state-js', 'wdp-dom-js', 'wdp-form-js', 'wdp-shareholder-js', 'wdp-progress-bar-js' ),
	),
	array(
		'handle' => 'wdp-form-initializer-js',
		'file'   => 'src/bootstrap/form-initializer.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-form-js', 'wdp-shareholder-js' ),
	),
	array(
		'handle' => 'wdp-lazy-modal-js',
		'file'   => 'src/lazy-modal.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-dom-js', 'wdp-modal-js' ),
	),
	array(
		'handle' => 'wdp-event-manager-js',
		'file'   => 'src/bootstrap/event-manager.js',
		'deps'   => array( 'wdp-utils-js', 'wdp-modal-js', 'wdp-form-js', 'wdp-form-cta-ready-js', 'wdp-lazy-modal-js' ),
	),
	array(
		'handle' => 'wdp-module-loader-js',
		'file'   => 'src/bootstrap/module-loader.js',
		'deps'   => array( 'wdp-utils-js' ),
	),
	array(
		'handle' => 'wdp-init-js',
		'file'   => 'src/bootstrap/init.js',
		'deps'   => array(
			'wdp-utils-js',
			'wdp-cta-viewport-js',
			'wdp-state-js',
			'wdp-dom-js',
			'wdp-modal-js',
			'wdp-form-js',
			'wdp-shareholder-js',
			'wdp-cart-js',
			'wdp-progress-bar-js',
			'wdp-form-initializer-js',
			'wdp-lazy-modal-js',
			'wdp-event-manager-js',
			'wdp-module-loader-js',
			'wdp-constants-js',
		),
	),
);
