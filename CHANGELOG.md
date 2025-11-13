# Changelog

All notable changes to WooCommerce Donation Modal Popup will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [10.0.0] - 2024-11-13

### Added
- Complete modular architecture for CSS, JavaScript, and PHP
- Exception handling system with custom exception classes
- Security enhancements (rate limiting, enhanced sanitization)
- Performance optimizations (transient caching, asset versioning)
- Comprehensive PHPDoc documentation
- .gitignore file for version control
- CHANGELOG.md for version tracking

### Changed
- Refactored CSS into modular files in `assets/css/src/`
- Refactored JavaScript into modular files in `assets/js/src/`
- Refactored PHP into modular classes in `includes/classes/`
- Improved error handling with try-catch blocks
- Enhanced security with WDP_Security class
- Optimized asset loading with caching

### Removed
- `build-js.php` build script (no longer needed)
- `donation-modal.js` main file (modules loaded directly)
- All `!important` declarations from CSS

### Fixed
- Modal expansion issues when share count increases
- Layout shifts in header when badge appears
- Font consistency between popup and in-page forms
- Mobile view consistency with desktop
- Cache busting for modular assets

### Security
- Rate limiting for AJAX requests
- Enhanced input sanitization
- Stricter validation
- Nonce verification improvements

## [Previous Versions]

### Version 9.x
- Initial stable release
- Basic modal functionality
- Shareholder forms
- Custom pricing

---

**Version Format:** `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

