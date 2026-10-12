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
            sprintf(__('Ürün bulunamadı. ID: %d', 'woo-donation-popup'), $product_id),
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
    
    /**
     * Constructor
     *
     * @param string $message Error message.
     */
    public function __construct($message = null) {
        if (null === $message) {
            $message = __('Güvenlik doğrulaması başarısız oldu. Lütfen sayfayı yenileyip tekrar deneyin.', 'woo-donation-popup');
        }
        parent::__construct($message, 403);
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

