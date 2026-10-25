<?php
/**
 * Tasarım stüdyosu: stil paketi kartları, yüzey token’ları, ikon seçici ve güven şeridi.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Admin_Design_Studio_Renderer
 */
class WDP_Admin_Design_Studio_Renderer {

	/**
	 * Full Design Studio tab.
	 *
	 * @return void
	 */
	public static function render_tab() {
		$button_settings = get_option( 'wdp_button_settings', array() );
		if ( ! is_array( $button_settings ) ) {
			$button_settings = array();
		}
		$settings = wp_parse_args(
			$button_settings,
			array(
				'brand_color'            => '#0f608b',
				'style_preset_id'        => 'classic',
				'form_density'           => 'normal',
				'glass_blur_px'          => '22',
				'glass_fill_opacity'     => '90',
				'overlay_tint'           => '#0f172a',
				'overlay_opacity'        => '52',
				'elevation_level'        => '3',
				'body_font_family'       => 'inherit',
				'enable_donor_email'     => '0',
				'enable_dedication'      => '0',
				'enable_anonymous'       => '0',
				'dedication_placeholder' => __( 'On behalf of? (optional)', 'woo-donation-popup' ),
				'trust_badges'           => '',
				'motion_intensity'       => 'normal',
				'chip_style'             => 'soft',
			)
		);
		if ( empty( $settings['brand_color'] ) && ! empty( $settings['button_primary_color'] ) ) {
			$settings['brand_color'] = $settings['button_primary_color'];
		}

		WDP_Admin_Renderer_Helpers::open_settings_split();
		WDP_Admin_Renderer_Helpers::open_form_container( 'wdp-design-studio-settings-form' );

		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__( 'Design Studio', 'woo-donation-popup' ) . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__( 'The global brand color automatically generates all button, progress, and accent tones (light / dark).', 'woo-donation-popup' ) . '</li><li>' . esc_html__( 'Appearance packs, glass/surface tokens, icons, and trust badges are managed here.', 'woo-donation-popup' ) . '</li></ul></div>';

		echo '<div id="wdp-studio-sec-brand" class="wdp-settings-section">';
		self::render_brand_color_section( $settings );
		echo '</div>';

		echo '<div id="wdp-studio-sec-presets" class="wdp-settings-section">';
		self::render_style_presets_section( isset( $settings['style_preset_id'] ) ? (string) $settings['style_preset_id'] : 'classic' );
		echo '</div>';

		echo '<div id="wdp-studio-sec-surface" class="wdp-settings-section">';
		self::render_surface_section( $settings );
		echo '</div>';

		echo '<div id="wdp-studio-sec-icons" class="wdp-settings-section">';
		self::render_icons_section( $settings );
		echo '</div>';

		echo '<div id="wdp-studio-sec-modules" class="wdp-settings-section">';
		self::render_modules_section( $settings );
		echo '</div>';

		WDP_Admin_Renderer_Helpers::close_form_container( 'wdp-save-design-studio-settings', true );
		WDP_Admin_Renderer_Helpers::begin_live_preview_aside( 'wdp-live-preview-studio', __( 'Studio preview', 'woo-donation-popup' ) );
		echo '<p class="description">' . esc_html__( 'Pack and surface settings apply on the front end after you save. Product overrides come from the product card.', 'woo-donation-popup' ) . '</p>';
		WDP_Admin_Renderer_Helpers::close_settings_split();
	}

	/**
	 * Global brand color + live palette preview swatches.
	 *
	 * @param array $settings Settings.
	 * @return void
	 */
	public static function render_brand_color_section( array $settings ) {
		WDP_Admin_Renderer_Helpers::render_section_heading(
			__( 'Global brand color', 'woo-donation-popup' ),
			__( 'Pick one color — buttons, progress, focus rings, and soft background tones are generated automatically.', 'woo-donation-popup' )
		);

		$brand = isset( $settings['brand_color'] ) ? (string) $settings['brand_color'] : '';
		if ( ! sanitize_hex_color( $brand ) ) {
			$brand = ! empty( $settings['button_primary_color'] ) ? (string) $settings['button_primary_color'] : '#0f608b';
		}
		$brand   = sanitize_hex_color( $brand ) ? $brand : '#0f608b';
		$palette = class_exists( 'WDP_Color_Palette' ) ? WDP_Color_Palette::from_hex( $brand ) : array( 'primary' => $brand );

		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="brand_color">' . esc_html__( 'Brand color', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<input type="color" id="brand_color" name="brand_color" value="' . esc_attr( $brand ) . '" />';
		echo '<p class="description">' . esc_html__( 'What it does: This is your site’s main identity color. When you save, Add to cart / Go to checkout / popup trigger / progress fill / success-screen accents update automatically from the light–dark palette generated from this color. If the “Primary” field on the product card is filled, it overrides the brand color for that product.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr></table>';

		echo '<div class="wdp-brand-palette-preview" aria-hidden="true">';
		$swatches = array(
			'primary'          => __( 'Primary', 'woo-donation-popup' ),
			'primary_hover'    => __( 'Hover', 'woo-donation-popup' ),
			'primary_dark'     => __( 'Dark', 'woo-donation-popup' ),
			'primary_soft'     => __( 'Light', 'woo-donation-popup' ),
			'checkout'         => __( 'Checkout', 'woo-donation-popup' ),
			'progress_pending' => __( 'Pending', 'woo-donation-popup' ),
		);
		foreach ( $swatches as $key => $label ) {
			$hex = isset( $palette[ $key ] ) ? $palette[ $key ] : $brand;
			echo '<span class="wdp-brand-palette-preview__swatch" style="--wdp-swatch:' . esc_attr( $hex ) . '" title="' . esc_attr( $hex ) . '">';
			echo '<i style="background:' . esc_attr( $hex ) . '"></i>';
			echo '<em>' . esc_html( $label ) . '</em>';
			echo '</span>';
		}
		echo '</div>';
	}

	/**
	 * Style preset cards + import/export toolbar.
	 *
	 * @param string $current_id Active preset id.
	 * @return void
	 */
	public static function render_style_presets_section( $current_id = 'classic' ) {
		$current_id = sanitize_key( (string) $current_id );
		if ( $current_id === '' ) {
			$current_id = 'classic';
		}

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__( 'Appearance packs', 'woo-donation-popup' ),
			__( 'Click a pack — colors, radius, and density fill the form fields. They apply on the site after you save.', 'woo-donation-popup' )
		);

		echo '<input type="hidden" name="style_preset_id" id="style_preset_id" value="' . esc_attr( $current_id ) . '" />';
		echo '<div class="wdp-style-presets" data-wdp-style-presets>';

		foreach ( WDP_Style_Presets::get_cards_for_admin() as $card ) {
			$id     = $card['id'];
			$active = ( $id === $current_id ) ? ' is-active' : '';
			$swatch = ! empty( $card['swatch'] ) ? sanitize_hex_color( $card['swatch'] ) : '';
			echo '<button type="button" class="wdp-style-preset-card' . esc_attr( $active ) . '" data-preset-id="' . esc_attr( $id ) . '"' . ( $swatch ? ' style="--wdp-preset-swatch:' . esc_attr( $swatch ) . '"' : '' ) . '>';
			if ( $swatch ) {
				echo '<span class="wdp-style-preset-card__swatch" aria-hidden="true"><i style="background:' . esc_attr( $swatch ) . '"></i><i style="background:' . esc_attr( $swatch ) . ';opacity:.72"></i><i style="background:' . esc_attr( $swatch ) . ';opacity:.42"></i></span>';
			}
			echo '<span class="wdp-style-preset-card__title">' . esc_html( $card['label'] ) . '</span>';
			echo '<span class="wdp-style-preset-card__desc">' . esc_html( $card['description'] ) . '</span>';
			echo '</button>';
		}

		echo '</div>';

		echo '<div class="wdp-style-presets__toolbar">';
		echo '<button type="button" class="button" id="wdp-export-style-preset">' . esc_html__( 'Export current appearance', 'woo-donation-popup' ) . '</button>';
		echo '<label class="button" for="wdp-import-style-preset-file">' . esc_html__( 'Import pack', 'woo-donation-popup' ) . '</label>';
		echo '<input type="file" id="wdp-import-style-preset-file" accept="application/json,.json" hidden />';
		echo '<button type="button" class="button button-primary" id="wdp-apply-style-preset-now">' . esc_html__( 'Apply pack now & save', 'woo-donation-popup' ) . '</button>';
		echo '<p class="description">' . esc_html__( 'Clicking a card: Only fills the form fields (does not save yet). “Apply pack now & save”: Writes the selected pack to the database; updates Regular / Share-based / Progress / Success colors; the page does not reload. Export: Downloads current settings as JSON. Import: Loads a JSON pack and applies it.', 'woo-donation-popup' ) . '</p>';
		echo '</div>';
	}

	/**
	 * Surface / glass / density / typography controls.
	 *
	 * @param array $settings Button settings.
	 * @return void
	 */
	public static function render_surface_section( array $settings ) {
		WDP_Admin_Renderer_Helpers::render_section_heading(
			__( 'Surface & typography', 'woo-donation-popup' ),
			__( 'Glass panel, elevation, and form density — the real glass tokens for the Soft Glass pack live here.', 'woo-donation-popup' )
		);

		$density = isset( $settings['form_density'] ) ? (string) $settings['form_density'] : 'normal';
		$blur    = isset( $settings['glass_blur_px'] ) ? absint( $settings['glass_blur_px'] ) : 22;
		$fill_op = isset( $settings['glass_fill_opacity'] ) ? absint( $settings['glass_fill_opacity'] ) : 90;
		$elev    = isset( $settings['elevation_level'] ) ? absint( $settings['elevation_level'] ) : 3;
		$overlay = isset( $settings['overlay_tint'] ) ? (string) $settings['overlay_tint'] : '#0f172a';
		$ov_op   = isset( $settings['overlay_opacity'] ) ? absint( $settings['overlay_opacity'] ) : 52;
		$font    = isset( $settings['body_font_family'] ) ? (string) $settings['body_font_family'] : 'inherit';
		$motion  = isset( $settings['motion_intensity'] ) ? (string) $settings['motion_intensity'] : 'normal';
		$chip    = isset( $settings['chip_style'] ) ? (string) $settings['chip_style'] : 'soft';

		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="form_density">' . esc_html__( 'Form density (global)', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<select id="form_density" name="form_density">';
		foreach ( array(
			'compact'  => __( 'Compact', 'woo-donation-popup' ),
			'normal'   => __( 'Normal', 'woo-donation-popup' ),
			'spacious' => __( 'Spacious', 'woo-donation-popup' ),
		) as $k => $lab ) {
			echo '<option value="' . esc_attr( $k ) . '" ' . selected( $density, $k, false ) . '>' . esc_html( $lab ) . '</option>';
		}
		echo '</select>';
		echo '<p class="description">' . esc_html__( 'What it does: Sets inner form spacing (line height, field gaps, padding). Compact = less scrolling; Spacious = more comfortable touch use. If “Density” is set on the product card, that product overrides this setting.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="glass_blur_px">' . esc_html__( 'Glass blur (px)', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<input type="number" id="glass_blur_px" name="glass_blur_px" value="' . esc_attr( (string) $blur ) . '" min="0" max="40" class="small-text" />';
		echo '<p class="description">' . esc_html__( 'What it does: The “frosted glass” blur strength of the popup background. 0 = no blur (flat panel). Higher values = softer and heavier (performance cost may increase). Visual effect may be limited because the popup background is currently forced to flat white; it is meaningful together with Soft Glass packs.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="glass_fill_opacity">' . esc_html__( 'Glass fill opacity (%)', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<input type="number" id="glass_fill_opacity" name="glass_fill_opacity" value="' . esc_attr( (string) $fill_op ) . '" min="60" max="100" class="small-text" />';
		echo '<p class="description">' . esc_html__( 'What it does: How opaque or transparent the popup surface is. 100 = fully opaque white; 60–80 = a glass effect where the page behind shows through slightly. 85+ is recommended for readability.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="elevation_level">' . esc_html__( 'Elevation (1–5)', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<input type="number" id="elevation_level" name="elevation_level" value="' . esc_attr( (string) $elev ) . '" min="1" max="5" class="small-text" />';
		echo '<p class="description">' . esc_html__( 'What it does: Popup and card shadow depth. 1 = flat/minimal; 5 = a clearly raised shadow. Sets the “floating” feel without changing the brand hue.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="overlay_tint">' . esc_html__( 'Overlay color', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<input type="color" id="overlay_tint" name="overlay_tint" value="' . esc_attr( sanitize_hex_color( $overlay ) ? $overlay : '#0f172a' ) . '" />';
		echo '<p class="description">' . esc_html__( 'What it does: The dimmer color that darkens the background when the popup opens. Usually a dark navy/black; a dark tone close to the brand also works.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="overlay_opacity">' . esc_html__( 'Overlay opacity (%)', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<input type="number" id="overlay_opacity" name="overlay_opacity" value="' . esc_attr( (string) $ov_op ) . '" min="20" max="80" class="small-text" />';
		echo '<p class="description">' . esc_html__( 'What it does: How dark the dimmer is. Low = the background stays readable; high = more focus on the form, darker background. Typical range 40–60.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="body_font_family">' . esc_html__( 'Form font stack', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<input type="text" id="body_font_family" name="body_font_family" value="' . esc_attr( $font ) . '" class="large-text" placeholder="' . esc_attr__( "inherit or 'DM Sans', system-ui, sans-serif", 'woo-donation-popup' ) . '" />';
		echo '<p class="description">' . esc_html__( 'What it does: The typeface family inside the popup/form. “inherit” = use your theme’s font. For a custom font, write a CSS font-family (not a Google Fonts URL). E.g. \'Inter\', system-ui, sans-serif — the font must already be loaded in the theme or on the page.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="motion_intensity">' . esc_html__( 'Motion', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<select id="motion_intensity" name="motion_intensity"><option value="subtle" ' . selected( $motion, 'subtle', false ) . '>' . esc_html__( 'Subtle', 'woo-donation-popup' ) . '</option><option value="normal" ' . selected( $motion, 'normal', false ) . '>' . esc_html__( 'Normal', 'woo-donation-popup' ) . '</option><option value="expressive" ' . selected( $motion, 'expressive', false ) . '>' . esc_html__( 'Expressive', 'woo-donation-popup' ) . '</option></select>';
		echo '<p class="description">' . esc_html__( 'What it does: Sets the strength of animations such as open and success. Subtle = calmer sites; Expressive = livelier transitions. Animations are already reduced for users with “prefers-reduced-motion” on.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="chip_style">' . esc_html__( 'Quick amount button style', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<select id="chip_style" name="chip_style"><option value="soft" ' . selected( $chip, 'soft', false ) . '>' . esc_html__( 'Soft', 'woo-donation-popup' ) . '</option><option value="outline" ' . selected( $chip, 'outline', false ) . '>' . esc_html__( 'Outline', 'woo-donation-popup' ) . '</option><option value="solid" ' . selected( $chip, 'solid', false ) . '>' . esc_html__( 'Solid', 'woo-donation-popup' ) . '</option></select>';
		echo '<p class="description">' . esc_html__( 'What it does: How quick amount options (100 / 250 / 500…) look. Soft = light fill; Outline = border only; Solid = a button filled with the brand color. If quick amount buttons are off (product/general setting), this setting is hidden.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '</table>';
	}

	/**
	 * Global donor modules + trust badges + module order.
	 *
	 * @param array $settings Settings.
	 * @return void
	 */
	public static function render_modules_section( array $settings ) {
		WDP_Admin_Renderer_Helpers::render_section_heading(
			__( 'Content modules (global default)', 'woo-donation-popup' ),
			__( 'These defaults are used when the product card is off.', 'woo-donation-popup' )
		);

		$email_on = ! empty( $settings['enable_donor_email'] ) && (string) $settings['enable_donor_email'] === '1';
		$ded_on   = ! empty( $settings['enable_dedication'] ) && (string) $settings['enable_dedication'] === '1';
		$anon_on  = ! empty( $settings['enable_anonymous'] ) && (string) $settings['enable_anonymous'] === '1';
		$ded_ph   = isset( $settings['dedication_placeholder'] ) ? (string) $settings['dedication_placeholder'] : '';
		$badges   = isset( $settings['trust_badges'] ) ? $settings['trust_badges'] : '';
		if ( is_array( $badges ) ) {
			$badges = wp_json_encode( $badges );
		}

		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row">' . esc_html__( 'Email field', 'woo-donation-popup' ) . '</th><td><label class="wdp-admin-toggle"><input type="checkbox" name="enable_donor_email" value="1" ' . checked( $email_on, true, false ) . ' /> ' . esc_html__( 'Show email on the regular form', 'woo-donation-popup' ) . '</label>';
		echo '<p class="description">' . esc_html__( 'What it does: Asks the donor for an email. When on, an extra row appears on the form. If “Email field” is off on the product card, it is hidden for that product. Not shown on share-based forms.', 'woo-donation-popup' ) . '</p></td></tr>';
		echo '<tr><th scope="row">' . esc_html__( 'Dedication field', 'woo-donation-popup' ) . '</th><td><label class="wdp-admin-toggle"><input type="checkbox" name="enable_dedication" value="1" ' . checked( $ded_on, true, false ) . ' /> ' . esc_html__( 'Dedication field', 'woo-donation-popup' ) . '</label>';
		echo '<p class="description">' . esc_html__( 'What it does: Collects a dedication such as “On behalf of?”; it is written to order meta. Useful for memorial / gift donations. Not shown on share-based forms.', 'woo-donation-popup' ) . '</p></td></tr>';
		echo '<tr><th scope="row">' . esc_html__( 'Anonymous donation', 'woo-donation-popup' ) . '</th><td><label class="wdp-admin-toggle"><input type="checkbox" name="enable_anonymous" value="1" ' . checked( $anon_on, true, false ) . ' /> ' . esc_html__( 'Anonymous donation', 'woo-donation-popup' ) . '</label>';
		echo '<p class="description">' . esc_html__( 'If checked, the donor name is hidden on public lists; it remains visible on order records.', 'woo-donation-popup' ) . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="dedication_placeholder">' . esc_html__( 'Dedication placeholder', 'woo-donation-popup' ) . '</label></th><td><input type="text" id="dedication_placeholder" name="dedication_placeholder" value="' . esc_attr( $ded_ph ) . '" class="regular-text" maxlength="120" />';
		echo '<p class="description">' . esc_html__( 'What it does: Sample text shown when the dedication field is empty. Tells the user what to write; it is not a required value.', 'woo-donation-popup' ) . '</p></td></tr>';

		$privacy_on   = ! empty( $settings['enable_privacy_notice'] ) && (string) $settings['enable_privacy_notice'] === '1';
		$privacy_text = isset( $settings['privacy_notice_text'] ) ? (string) $settings['privacy_notice_text'] : '';
		$privacy_url  = isset( $settings['privacy_notice_url'] ) ? (string) $settings['privacy_notice_url'] : '';
		$wp_privacy   = function_exists( 'get_privacy_policy_url' ) ? (string) get_privacy_policy_url() : '';
		echo '<tr><th scope="row">' . esc_html__( 'Privacy notice link', 'woo-donation-popup' ) . '</th><td>';
		$privacy_placeholder = class_exists( 'WDP_Donation_Optional_Fields' )
			? WDP_Donation_Optional_Fields::default_privacy_link_label()
			: __( 'Privacy notice on the processing of personal data', 'woo-donation-popup' );
		echo '<label class="wdp-admin-toggle"><input type="checkbox" name="enable_privacy_notice" value="1" ' . checked( $privacy_on, true, false ) . ' /> ' . esc_html__( 'Show privacy notice link', 'woo-donation-popup' ) . '</label>';
		echo '<p class="description">' . esc_html__( 'The privacy notice must live on your site’s personal-data/privacy page; only the link is shown here. It appears only when the form has at least one of the email, dedication, or shareholder fields (off by default).', 'woo-donation-popup' ) . '</p>';
		echo '<p><label for="privacy_notice_text">' . esc_html__( 'Link label', 'woo-donation-popup' ) . '</label><br />';
		echo '<input type="text" id="privacy_notice_text" name="privacy_notice_text" value="' . esc_attr( $privacy_text ) . '" class="large-text" placeholder="' . esc_attr( $privacy_placeholder ) . '" /></p>';
		echo '<p class="description">' . esc_html__( 'Short label shown on the link. If left empty, the default label is used.', 'woo-donation-popup' ) . '</p>';
		echo '<p><label for="privacy_notice_url">' . esc_html__( 'Link URL', 'woo-donation-popup' ) . '</label><br />';
		echo '<input type="url" id="privacy_notice_url" name="privacy_notice_url" value="' . esc_attr( $privacy_url ) . '" class="large-text" placeholder="https://" /></p>';
		if ( $privacy_url === '' && $wp_privacy === '' ) {
			echo '<p class="description" style="color:#b32d2e">' . esc_html__( 'If the URL is empty and there is also no WordPress Privacy Policy page, the link is not shown on the form. Select a page under Settings → Privacy or enter a URL here.', 'woo-donation-popup' ) . '</p>';
		} elseif ( $privacy_url === '' && $wp_privacy !== '' ) {
			echo '<p class="description">' . esc_html__( 'If the URL is empty, the WordPress Privacy Policy page is used.', 'woo-donation-popup' ) . '</p>';
		}
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="trust_badges">' . esc_html__( 'Trust badges (JSON, max 3)', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<textarea id="trust_badges" name="trust_badges" rows="4" class="large-text code">' . esc_textarea( (string) $badges ) . '</textarea>';
		echo '<p class="description">' . esc_html__( 'What it does: Shows more than one trust badge under the form. JSON array format: [{"icon":"builtin:shield","text":"SSL"},{"icon":"builtin:heart","text":"Secure"}]. Maximum 3 badges. If empty, the single-line “Trust text” below is used as a fallback. Invalid JSON is not saved / treated as empty.', 'woo-donation-popup' ) . '</p></td></tr>';
		echo '</table>';
	}

	/**
	 * Icon pickers for fields / CTAs / trust.
	 *
	 * @param array $settings Button settings.
	 * @return void
	 */
	public static function render_icons_section( array $settings ) {
		WDP_Admin_Renderer_Helpers::render_section_heading(
			__( 'Icons', 'woo-donation-popup' ),
			__( 'Pick from the built-in SVG set or upload your own icon from the Media Library.', 'woo-donation-popup' )
		);

		$enable_field_icons = ! isset( $settings['enable_field_icons'] ) || '1' === (string) $settings['enable_field_icons'];

		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row">' . esc_html__( 'Field icons', 'woo-donation-popup' ) . '</th><td>';
		echo '<label class="wdp-admin-toggle"><input type="checkbox" name="enable_field_icons" value="1" ' . checked( $enable_field_icons, true, false ) . ' /> ';
		echo esc_html__( 'Icons on the name, note, and email rows', 'woo-donation-popup' ) . '</label>';
		echo '<p class="description">' . esc_html__( 'What it does: Turns the small icons to the left of form rows on or off. When off, the fields look simpler. A Use general / On / Off choice on the product card overrides this per product.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '</table>';

		$slots = array(
			'icon_field_user'  => array(
				'label'    => __( 'Full name icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:user',
				'help'     => __( 'Left icon on the full name row.', 'woo-donation-popup' ),
			),
			'icon_field_note'  => array(
				'label'    => __( 'Note icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:note',
				'help'     => __( 'Icon for the note / message field.', 'woo-donation-popup' ),
			),
			'icon_field_email' => array(
				'label'    => __( 'Email icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:email',
				'help'     => __( 'Icon used when the email row is on.', 'woo-donation-popup' ),
			),
			'icon_field_phone' => array(
				'label'    => __( 'Phone icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:phone',
				'help'     => __( 'Fallback/custom icon for the phone row (can be used next to the country picker).', 'woo-donation-popup' ),
			),
			'icon_cart'        => array(
				'label'    => __( 'Add to cart icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:cart',
				'help'     => __( 'Icon on the “Add to cart” CTA button.', 'woo-donation-popup' ),
			),
			'icon_checkout'    => array(
				'label'    => __( 'Go to checkout icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:checkout',
				'help'     => __( 'Icon on the “Go to checkout” CTA button.', 'woo-donation-popup' ),
			),
			'icon_trust'       => array(
				'label'    => __( 'Trust strip icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:shield',
				'help'     => __( 'Left icon of the trust text under the buttons.', 'woo-donation-popup' ),
			),
			'icon_continue'    => array(
				'label'    => __( 'Continue icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:continue',
				'help'     => __( 'Icon for the “Continue” step button on a multi-step (wizard) form.', 'woo-donation-popup' ),
			),
			'icon_success'     => array(
				'label'    => __( 'Success icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:check',
				'help'     => __( 'Confirmation icon on the success / thank-you screen.', 'woo-donation-popup' ),
			),
			'icon_sadaka'      => array(
				'label'    => __( 'Extra donation icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:gift',
				'help'     => __( 'Title/icon area of the extra donation (sadaqah) block.', 'woo-donation-popup' ),
			),
			'icon_progress'    => array(
				'label'    => __( 'Progress icon', 'woo-donation-popup' ),
				'fallback' => 'builtin:star',
				'help'     => __( 'Decorative / badge icon fallback on progress forms.', 'woo-donation-popup' ),
			),
		);

		echo '<div class="wdp-icon-pickers">';
		foreach ( $slots as $name => $meta ) {
			$val = isset( $settings[ $name ] ) && $settings[ $name ] !== ''
				? (string) $settings[ $name ]
				: $meta['fallback'];
			self::render_icon_picker_row( $name, $meta['label'], $val, isset( $meta['help'] ) ? $meta['help'] : '' );
		}
		echo '</div>';
		echo '<p class="description" style="margin-top:8px">' . esc_html__( 'Icon picker: Click a built-in SVG icon or upload your own image with “Select from media” (small PNG/SVG recommended). “Reset” returns to the first built-in icon. Changes become permanent with “Save settings”.', 'woo-donation-popup' ) . '</p>';

		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="trust_strip_enabled">' . esc_html__( 'Trust strip', 'woo-donation-popup' ) . '</label></th><td>';
		$trust_on = ! isset( $settings['trust_strip_enabled'] ) || '1' === (string) $settings['trust_strip_enabled'];
		echo '<label class="wdp-admin-toggle"><input type="checkbox" name="trust_strip_enabled" id="trust_strip_enabled" value="1" ' . checked( $trust_on, true, false ) . ' /> ';
		echo esc_html__( 'Show trust text under the CTA', 'woo-donation-popup' ) . '</label>';
		echo '<p class="description">' . esc_html__( 'What it does: Shows the “Secure payment…” line right under the Add to cart / Go to checkout buttons. If JSON badges are filled, they may take priority; if this key is off, the strip is fully hidden.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		$trust_text = isset( $settings['trust_strip_text'] ) ? (string) $settings['trust_strip_text'] : __( 'Secure payment · SSL-protected transaction', 'woo-donation-popup' );
		echo '<tr><th scope="row"><label for="trust_strip_text">' . esc_html__( 'Trust text (single-badge fallback)', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<input type="text" class="regular-text" id="trust_strip_text" name="trust_strip_text" value="' . esc_attr( $trust_text ) . '" maxlength="120" />';
		echo '<p class="description">' . esc_html__( 'What it does: Single-line trust message shown when JSON trust badges are empty. Keep it short (max 120 characters) so it stays readable under the mobile CTA.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '</table>';
	}

	/**
	 * @param string $name  Input name.
	 * @param string $label Label.
	 * @param string $value Current value.
	 * @param string $help  Optional help text.
	 * @return void
	 */
	private static function render_icon_picker_row( $name, $label, $value, $help = '' ) {
		$preview = WDP_Icon_Library::resolve( $value, 'user', 'wdp-icon-picker__preview-svg' );
		echo '<div class="wdp-icon-picker" data-wdp-icon-picker data-slot="' . esc_attr( $name ) . '">';
		echo '<div class="wdp-icon-picker__label">' . esc_html( $label ) . '</div>';
		if ( $help !== '' ) {
			echo '<p class="description wdp-icon-picker__help">' . esc_html( $help ) . '</p>';
		}
		echo '<div class="wdp-icon-picker__preview" aria-hidden="true">' . $preview . '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted SVG/img from library
		echo '<input type="hidden" name="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" class="wdp-icon-picker__value" />';
		echo '<div class="wdp-icon-picker__builtins">';
		foreach ( WDP_Icon_Library::get_builtins_for_admin() as $item ) {
			$val = 'builtin:' . $item['id'];
			$sel = ( $value === $val || $value === $item['id'] ) ? ' is-selected' : '';
			echo '<button type="button" class="wdp-icon-picker__chip' . esc_attr( $sel ) . '" data-icon-value="' . esc_attr( $val ) . '" title="' . esc_attr( $item['label'] ) . '">';
			echo $item['svg']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo '</button>';
		}
		echo '</div>';
		echo '<div class="wdp-icon-picker__actions">';
		echo '<button type="button" class="button wdp-icon-picker__media">' . esc_html__( 'Select from media', 'woo-donation-popup' ) . '</button>';
		echo '<button type="button" class="button-link wdp-icon-picker__reset">' . esc_html__( 'Reset', 'woo-donation-popup' ) . '</button>';
		echo '</div>';
		echo '</div>';
	}
}
