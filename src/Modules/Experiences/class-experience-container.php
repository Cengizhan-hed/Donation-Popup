<?php
/**
 * Form kabı: yalnız kap işaretlemesini seçer (popup, yan panel, sayfa içi, alttan panel).
 *
 * Form çekirdeği tektir; kap yalnız şablon adı ve katman türünü belirler.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

defined( 'ABSPATH' ) || exit;

/**
 * Experience_Container.
 */
abstract class Experience_Container {

	/**
	 * Kap slug'ı.
	 *
	 * @return string
	 */
	abstract public function slug();

	/**
	 * Şablon adı (`templates/donation-panel/` altında; tema geçersiz kılabilir).
	 *
	 * @return string
	 */
	abstract public function template();

	/**
	 * Katman (overlay) türü; sayfa içi kapta boş.
	 *
	 * @return string `modal`, `panel`, `sheet` ya da boş.
	 */
	public function layer() {
		return '';
	}

	/**
	 * Düğmeyle açılan kap mı (sayfa içi form açılmaz).
	 *
	 * @return bool
	 */
	public function is_layer() {
		return '' !== $this->layer();
	}

	/**
	 * Slug'dan (ve kısa takma adlardan) kap üretir; bilinmeyen değer popup olur.
	 *
	 * @param string $slug Kap adı.
	 * @return Experience_Container
	 */
	public static function make( $slug ) {
		$slug = str_replace( '-', '_', sanitize_key( (string) $slug ) );
		switch ( $slug ) {
			case 'panel':
			case 'side_panel':
				return new Side_Panel();
			case 'inline':
			case 'inline_form':
				return new Inline_Form();
			case 'sheet':
			case 'bottom_sheet':
				return new Bottom_Sheet();
			default:
				return new Popup();
		}
	}

	/**
	 * Tüm kap slug'ları.
	 *
	 * @return string[]
	 */
	public static function slugs() {
		return array( 'popup', 'side_panel', 'inline', 'bottom_sheet' );
	}
}
