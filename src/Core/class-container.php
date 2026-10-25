<?php
/**
 * Basit bağımlılık kabı: tanımlı üreticiler + kurucu enjeksiyonu (tip ipuçlu sınıf parametreleri).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Container.
 */
class Container {

	/**
	 * Üreticiler.
	 *
	 * @var array<string, callable>
	 */
	private $factories = array();

	/**
	 * Tek örnekli tanımlar.
	 *
	 * @var array<string, bool>
	 */
	private $shared = array();

	/**
	 * Çözülmüş örnekler.
	 *
	 * @var array<string, mixed>
	 */
	private $instances = array();

	/**
	 * Çözülmekte olan kimlikler (döngü tespiti).
	 *
	 * @var array<string, bool>
	 */
	private $resolving = array();

	/**
	 * Her çağrıda yeni örnek üreten tanım.
	 *
	 * @param string   $id      Kimlik (genelde sınıf adı).
	 * @param callable $factory function ( Container $c ).
	 * @return void
	 */
	public function bind( $id, callable $factory ) {
		$this->factories[ $id ] = $factory;
		unset( $this->shared[ $id ], $this->instances[ $id ] );
	}

	/**
	 * Tek örnek üreten tanım.
	 *
	 * @param string   $id      Kimlik.
	 * @param callable $factory function ( Container $c ).
	 * @return void
	 */
	public function singleton( $id, callable $factory ) {
		$this->factories[ $id ] = $factory;
		$this->shared[ $id ]    = true;
		unset( $this->instances[ $id ] );
	}

	/**
	 * Hazır bir örneği kaydeder.
	 *
	 * @param string $id       Kimlik.
	 * @param mixed  $instance Örnek.
	 * @return void
	 */
	public function instance( $id, $instance ) {
		$this->instances[ $id ] = $instance;
		$this->shared[ $id ]    = true;
	}

	/**
	 * Kimlik çözülebilir mi (tanımlı ya da yüklenebilir sınıf).
	 *
	 * @param string $id Kimlik.
	 * @return bool
	 */
	public function has( $id ) {
		return isset( $this->factories[ $id ] ) || array_key_exists( $id, $this->instances ) || class_exists( $id );
	}

	/**
	 * Örneği döndürür; tanımsızsa sınıfı kurucu enjeksiyonuyla üretir.
	 *
	 * @param string $id Kimlik.
	 * @return mixed
	 * @throws \RuntimeException Çözülemezse ya da döngü varsa.
	 */
	public function get( $id ) {
		if ( array_key_exists( $id, $this->instances ) ) {
			return $this->instances[ $id ];
		}
		if ( isset( $this->resolving[ $id ] ) ) {
			throw new \RuntimeException( 'Container: dairesel bagimlilik: ' . esc_html( $id ) );
		}

		$this->resolving[ $id ] = true;
		try {
			if ( isset( $this->factories[ $id ] ) ) {
				$object = call_user_func( $this->factories[ $id ], $this );
			} else {
				$object = $this->autowire( $id );
			}
		} finally {
			unset( $this->resolving[ $id ] );
		}

		if ( ! empty( $this->shared[ $id ] ) ) {
			$this->instances[ $id ] = $object;
		}

		return $object;
	}

	/**
	 * Sınıfı kurucu parametrelerini kaptan çözerek üretir.
	 *
	 * @param string $class_name Sınıf adı.
	 * @return object
	 * @throws \RuntimeException Sınıf yok ya da parametre çözülemezse.
	 */
	private function autowire( $class_name ) {
		if ( ! class_exists( $class_name ) ) {
			throw new \RuntimeException( 'Container: tanimli degil: ' . esc_html( $class_name ) );
		}

		$reflection  = new \ReflectionClass( $class_name );
		$constructor = $reflection->getConstructor();
		if ( null === $constructor || ! $reflection->isInstantiable() ) {
			if ( ! $reflection->isInstantiable() ) {
				throw new \RuntimeException( 'Container: ornek uretilemez: ' . esc_html( $class_name ) );
			}
			return new $class_name();
		}

		$args = array();
		foreach ( $constructor->getParameters() as $parameter ) {
			$type = $parameter->getType();
			if ( $type instanceof \ReflectionNamedType && ! $type->isBuiltin() ) {
				$args[] = $this->get( $type->getName() );
			} elseif ( $parameter->isDefaultValueAvailable() ) {
				$args[] = $parameter->getDefaultValue();
			} else {
				throw new \RuntimeException( 'Container: parametre cozulemedi: ' . esc_html( $class_name . '::$' . $parameter->getName() ) );
			}
		}

		return $reflection->newInstanceArgs( $args );
	}
}
