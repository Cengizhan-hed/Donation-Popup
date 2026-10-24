<?php
/**
 * WDP_Exception tabanı ve ürün, doğrulama, güvenlik, sepet hata türleri.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Base exception class
 */
class WDP_Exception extends Exception {
    
    /**
     * Log the exception
     *
     * @return void
     */
    public function log() {
        WDP_Utils::log(array(
            'exception' => get_class($this),
            'message' => $this->getMessage(),
            'file' => $this->getFile(),
            'line' => $this->getLine(),
            'trace' => $this->getTraceAsString(),
        ));
    }
}

/**
 * Product not found exception
 */
class WDP_Product_Not_Found_Exception extends WDP_Exception {
    
    /**
     * Constructor
     *
     * @param int $product_id Product ID.
     */
    public function __construct($product_id) {
        parent::__construct(
            sprintf(__('Product not found. ID: %d', 'woo-donation-popup'), $product_id),
            404
        );
    }
}

/**
 * Validation exception
 */
class WDP_Validation_Exception extends WDP_Exception {
    
    /**
     * Validation errors
     *
     * @var array
     */
    private $errors = array();
    
    /**
     * Constructor
     *
     * @param string $message Error message.
     * @param array  $errors  Validation errors.
     */
    public function __construct($message, array $errors = array()) {
        parent::__construct($message, 400);
        $this->errors = $errors;
    }
    
    /**
     * Get validation errors
     *
     * @return array
     */
    public function getErrors() {
        return $this->errors;
    }
}

/**
 * Security exception
 */
class WDP_Security_Exception extends WDP_Exception {

    /** @var string nonce|rate_limit|capability|origin|method */
    private $kind = 'nonce';

    /** @var int Retry-After seconds (429). */
    private $retry_after = 0;

    /**
     * Constructor
     *
     * @param string|null $message     Error message.
     * @param string      $kind        nonce|rate_limit|capability|origin|method.
     * @param int         $retry_after Retry-After seconds for rate_limit.
     */
    public function __construct($message = null, $kind = 'nonce', $retry_after = 0) {
        $kind = strtolower(preg_replace('/[^a-z0-9_]/', '', (string) $kind));
        $allowed = array('nonce', 'rate_limit', 'capability', 'origin', 'method');
        if (!in_array($kind, $allowed, true)) {
            $kind = 'nonce';
        }
        $this->kind        = $kind;
        $this->retry_after = max(0, (int) $retry_after);
        if (null === $message) {
            $message = __('Security verification failed. Please refresh the page and try again.', 'woo-donation-popup');
        }
        $http = ('rate_limit' === $kind) ? 429 : 403;
        parent::__construct($message, $http);
    }

    /**
     * @return string
     */
    public function getKind() {
        return $this->kind;
    }

    /**
     * @return int
     */
    public function getRetryAfter() {
        return $this->retry_after;
    }
}

/**
 * Cart exception
 */
class WDP_Cart_Exception extends WDP_Exception {
    
    /**
     * Constructor
     *
     * @param string $message Error message.
     */
    public function __construct($message) {
        parent::__construct($message, 500);
    }
}

