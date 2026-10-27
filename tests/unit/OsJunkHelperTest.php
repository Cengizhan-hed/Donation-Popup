<?php
/**
 * OS artığı yok sayan "klasör yok/boş" yardımcısı.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class OsJunkHelperTest extends TestCase {

	public function test_absent_only_junk_and_real_file(): void {
		$base = sys_get_temp_dir() . '/wdp-junk-' . uniqid('', true);
		$dir  = $base . '/includes';
		$this->assertTrue( wdp_test_dir_absent_or_only_os_junk( $dir ) );
		mkdir( $dir . '/sub', 0777, true );
		file_put_contents( $dir . '/.DS_Store', 'x' );
		file_put_contents( $dir . '/sub/._a', 'x' );
		file_put_contents( $dir . '/Thumbs.db', 'x' );
		$this->assertTrue( wdp_test_dir_absent_or_only_os_junk( $dir ) );
		file_put_contents( $dir . '/sub/class-a.php', '<?php' );
		$this->assertFalse( wdp_test_dir_absent_or_only_os_junk( $dir ) );
		foreach ( array( $dir . '/.DS_Store', $dir . '/Thumbs.db', $dir . '/sub/._a', $dir . '/sub/class-a.php' ) as $f ) {
			unlink( $f );
		}
		rmdir( $dir . '/sub' );
		rmdir( $dir );
		rmdir( $base );
	}
}
