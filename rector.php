<?php
/**
 * Rector — yalnız geliştirme (dağıtım paketine girmez). Kuru çalıştırma: npm run rector:dry
 *
 * Varsayılan kural kümesi BİLEREK boş: otomatik yeniden yazım yalnız insan onayıyla eklenen kurallarla yapılır.
 * 6-C "sadaka" -> "addon" iskeleti: `node scripts/sadaka-inventory.mjs` tools/rector/rename-map.json üretir;
 * WDP_RECTOR_RENAME=1 ile etkinleşir. DB/sipariş meta anahtarları ve kanca adları haritada "protect" listesindedir, DEĞİŞMEZ.
 */

declare(strict_types=1);

use Rector\Config\RectorConfig;

$rename = array( 'classes' => array(), 'methods' => array(), 'functions' => array(), 'constants' => array() );
if ( is_readable( __DIR__ . '/tools/rector/rename-map.json' ) ) {
	$rename = array_merge( $rename, json_decode( (string) file_get_contents( __DIR__ . '/tools/rector/rename-map.json' ), true ) ?: array() );
}

$config = RectorConfig::configure()
	->withPaths( array( __DIR__ . '/src', __DIR__ . '/templates', __DIR__ . '/blocks', __DIR__ . '/woo-donation-popup.php' ) )
	->withSkip( array( __DIR__ . '/vendor', __DIR__ . '/vendor-dev', __DIR__ . '/tests', __DIR__ . '/build' ) )
	->withBootstrapFiles( array( __DIR__ . '/tools/phpstan-bootstrap.php' ) )
	->withCache( __DIR__ . '/build/lint/rector-cache' );

// 6-C: yalnız PHP sınıf/fonksiyon/sabit adları. WDP_RECTOR_RENAME=1 ile etkinleşir (aksi halde kural yok).
if ( getenv( 'WDP_RECTOR_RENAME' ) === '1' ) {
	$config = $config->withConfiguredRule( \Rector\Renaming\Rector\Name\RenameClassRector::class, $rename['classes'] )
		->withConfiguredRule( \Rector\Renaming\Rector\FuncCall\RenameFunctionRector::class, $rename['functions'] )
		->withConfiguredRule( \Rector\Renaming\Rector\ConstFetch\RenameConstantRector::class, $rename['constants'] )
		->withConfiguredRule(
			\Rector\Renaming\Rector\MethodCall\RenameMethodRector::class,
			array_map(
				static fn( array $m ) => new \Rector\Renaming\ValueObject\MethodCallRename( $m['class'], $m['old'], $m['new'] ),
				$rename['methods']
			)
		);
}

return $config;
