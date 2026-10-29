<?php
/**
 * Compact kartın ödeme katmanında açılan order-pay sayfasının yalın görünümü: tema başlığı/altbilgisi yok, yalnız
 * WooCommerce'in standart ödeme formu. `wp_head`/`wp_footer` korunur (ödeme geçidi betikleri/stilleri standart yoldan).
 * Tema `donation-panel/payment/embed.php` ile geçersiz kılabilir.
 *
 * @package DonationPanel
 */

defined( 'ABSPATH' ) || exit;
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
<style id="donation-panel-embed">.donation-panel-embed__main{box-sizing:border-box;max-inline-size:640px;margin-inline:auto;padding:16px}</style>
</head>
<body <?php body_class( 'donation-panel-embed' ); ?>>
<?php wp_body_open(); ?>
<main class="donation-panel-embed__main">
	<?php echo do_shortcode( '[woocommerce_checkout]' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- WooCommerce'in kendi kısa kod çıktısı. ?>
</main>
<?php wp_footer(); ?>
</body>
</html>
