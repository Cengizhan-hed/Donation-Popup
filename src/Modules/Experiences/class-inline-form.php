<?php
/**
 * Sayfa içine gömülü form.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

defined( 'ABSPATH' ) || exit;

/**
 * Inline_Form.
 */
final class Inline_Form extends Experience_Container {

	/**
	 * Kap slug'ı.
	 *
	 * @return string
	 */
	public function slug() {
		return 'inline';
	}

	/**
	 * Şablon adı.
	 *
	 * @return string
	 */
	public function template() {
		return 'experiences/inline.php';
	}
}
