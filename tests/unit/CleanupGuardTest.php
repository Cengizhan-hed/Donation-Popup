<?php
/**
 * E2E temizlik korumaları — WordPress gerektirmez.
 */

use PHPUnit\Framework\TestCase;

class CleanupGuardTest extends TestCase {

	public static function setUpBeforeClass(): void {
		if (!defined('WDP_E2E_CLEANUP_LIB_ONLY')) {
			define('WDP_E2E_CLEANUP_LIB_ONLY', true);
		}
		require_once dirname(__DIR__) . '/e2e/helpers/cleanup-e2e.php';
	}

	public function test_email_needle_variable_and_constant_defined() {
		$src = file_get_contents(dirname(__DIR__) . '/e2e/helpers/cleanup-e2e.php');
		$this->assertNotFalse($src);
		$this->assertStringContainsString('$EMAIL_NEEDLE     = WDP_E2E_EMAIL_NEEDLE;', $src);
		$this->assertStringContainsString("define('WDP_E2E_EMAIL_NEEDLE', '@wdp-e2e.test');", $src);
		$this->assertStringContainsString('wp_delete_user($uid, null);', $src);
		$this->assertDoesNotMatchRegularExpression('/wp_delete_user\s*\(\s*\$\w+\s*\)\s*;/', $src);
	}

	public function test_php_lint() {
		$file = dirname(__DIR__) . '/e2e/helpers/cleanup-e2e.php';
		$out  = array();
		$code = 0;
		exec('php -l ' . escapeshellarg($file) . ' 2>&1', $out, $code);
		$this->assertSame(0, $code, implode("\n", $out));
	}

	public function test_run_id_rejects_empty_and_one() {
		$this->assertFalse(wdp_e2e_run_id_ok(''));
		$this->assertFalse(wdp_e2e_run_id_ok('1'));
		$this->assertTrue(wdp_e2e_run_id_ok('run-20261022T120000'));
	}

	public function test_empty_registry_blocks_delete() {
		$g = wdp_e2e_evaluate_delete(
			array(
				'id'            => 12,
				'run_id'        => 'run-abc',
				'expected_type' => 'product',
				'registry_ids'  => array(),
				'core_ids'      => array(),
				'type'          => 'product',
				'mark'          => 'run-abc',
			)
		);
		$this->assertFalse($g['ok']);
		$this->assertSame('empty-registry', $g['reason']);
	}

	public function test_page_and_attachment_blacklisted() {
		foreach (array('page', 'attachment', 'nav_menu_item', 'elementor_library', 'wp_template') as $type) {
			$g = wdp_e2e_evaluate_delete(
				array(
					'id'            => 5,
					'run_id'        => 'run-abc',
					'expected_type' => $type,
					'registry_ids'  => array(5),
					'core_ids'      => array(),
					'type'          => $type,
					'mark'          => 'run-abc',
				)
			);
			$this->assertFalse($g['ok'], $type);
			$this->assertSame('type-blacklist', $g['reason'], $type);
		}
	}

	public function test_core_page_id_blocked() {
		$g = wdp_e2e_evaluate_delete(
			array(
				'id'            => 10,
				'run_id'        => 'run-abc',
				'expected_type' => 'product',
				'registry_ids'  => array(10),
				'core_ids'      => array(10),
				'type'          => 'product',
				'mark'          => 'run-abc',
			)
		);
		$this->assertFalse($g['ok']);
		$this->assertSame('core-blacklist', $g['reason']);
	}

	public function test_mark_must_equal_run_id_not_one() {
		$g = wdp_e2e_evaluate_delete(
			array(
				'id'            => 9,
				'run_id'        => 'run-abc',
				'expected_type' => 'product',
				'registry_ids'  => array(9),
				'core_ids'      => array(),
				'type'          => 'product',
				'mark'          => '1',
			)
		);
		$this->assertFalse($g['ok']);
		$this->assertSame('unmarked', $g['reason']);
	}

	public function test_user_delete_requires_triple_and_no_content() {
		$base = array(
			'id'            => 4,
			'run_id'        => 'run-abc',
			'registry_ids'  => array(4),
			'email'         => 'e2e.1@wdp-e2e.test',
			'user_mark'     => 'run-abc',
			'owned'         => array(),
			'comment_count' => 0,
		);
		$ok = wdp_e2e_evaluate_user_delete($base);
		$this->assertTrue($ok['ok']);

		$owned = wdp_e2e_evaluate_user_delete(array_merge($base, array('owned' => array((object) array('ID' => 1)))));
		$this->assertFalse($owned['ok']);
		$this->assertSame('user-has-content', $owned['reason']);

		$email = wdp_e2e_evaluate_user_delete(array_merge($base, array('email' => 'admin@site.org')));
		$this->assertFalse($email['ok']);

		$mark = wdp_e2e_evaluate_user_delete(array_merge($base, array('user_mark' => '1')));
		$this->assertFalse($mark['ok']);
	}

	public function test_undefined_email_needle_bug_does_not_match_all() {
		$email = 'admin@example.org';
		$undefined = null;
		$search = '*' . $undefined;
		$this->assertSame('*', $search);
		$this->assertSame('@wdp-e2e.test', WDP_E2E_EMAIL_NEEDLE);
		$this->assertFalse(strpos($email, WDP_E2E_EMAIL_NEEDLE));
		$g = wdp_e2e_evaluate_user_delete(
			array(
				'id'            => 1,
				'run_id'        => 'run-abc',
				'registry_ids'  => array(1),
				'email'         => $email,
				'user_mark'     => 'run-abc',
				'owned'         => array(),
				'comment_count' => 0,
			)
		);
		$this->assertFalse($g['ok']);
		$this->assertSame('email', $g['reason']);
	}
}
