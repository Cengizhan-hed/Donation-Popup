<?php
/**
 * WooCommerce FeaturesUtil çifti (uyumluluk bildirimlerini kaydeder).
 *
 * @package DonationPanel
 */

namespace Automattic\WooCommerce\Utilities;

if ( ! class_exists( __NAMESPACE__ . '\\FeaturesUtil' ) ) {
	final class FeaturesUtil {
		/** @var array<int, array{0:string,1:string,2:bool}> */
		public static $declared = array();

		public static function declare_compatibility( $feature, $file, $compatible = true ) {
			self::$declared[] = array( (string) $feature, (string) $file, (bool) $compatible );
			return true;
		}
	}
}
