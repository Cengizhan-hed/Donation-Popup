# Changelog

All notable changes to WooCommerce Donation Modal Popup will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [10.2.0] - 2024-12-XX

### Added
- **Performance Optimizations:**
  - Object cache support for product data (faster than transient)
  - Object cache for asset versioning (CSS/JS)
  - Cart count and contents caching (3-5 seconds)
  - Optimized product meta queries (single query instead of multiple)
  - Enhanced critical CSS (minimized for faster initial render)
  - DNS prefetch for Google Fonts
  - Passive event listeners for scroll/resize events

- **Security Enhancements:**
  - Request origin validation (CSRF protection)
  - Capability checks for AJAX operations
  - Enhanced IP address validation
  - Rate limiting with object cache (faster lookups)
  - Input length limits (quantity, custom price, notes)
  - Timestamp validation (prevents replay attacks)
  - Maximum share count limit (50) to prevent abuse
  - Enhanced email validation
  - Rate limit logging for monitoring

### Changed
- **Performance:**
  - Asset versioning now uses object cache first, transient as fallback
  - Product info caching uses both object cache and transient
  - Cart operations clear cache automatically
  - Critical CSS optimized for minimal size
  - Font preload optimized with DNS prefetch

- **Security:**
  - All AJAX endpoints now validate request origin
  - Rate limiting uses object cache for better performance
  - Enhanced input sanitization with length limits
  - Product ID validation on all endpoints

### Fixed
- Cart cache invalidation after adding items
- Product meta caching consistency
- Asset version caching across requests

### Technical
- **MAJOR CSS SPECIFICITY UPDATE**: All CSS selectors now use maximum specificity (GiveWP-style approach)
- All selectors now start with `html body` for highest specificity
- Added multiple class combinations and attribute selectors throughout all CSS files
- Enhanced theme isolation - CSS now overrides any theme styles without using !important
- Updated layout.css, buttons.css, alerts.css, accessibility.css with maximum specificity
- All media queries now use maximum specificity selectors
- Improved RTL support with higher specificity selectors
- CSS specificity increased from ~0,0,1,0 to ~0,0,3,0+ (element + class + attribute + pseudo-class)
- All theme conflicts now resolved through specificity rather than !important
- Better compatibility with all WordPress themes
- Consistent styling across all themes without visual breaks or layout shifts

## [10.1.2] - 2024-12-XX

### Fixed
- Shareholder form collapsed icon now points left (‹) instead of right (›)
- Removed blue border/outline that appears when clicking the donation button

## [10.1.1] - 2024-12-XX

### Fixed
- Shareholder form icons are now perfectly aligned with the header title (h3) - same vertical position
- Icons now show different directions: right arrow (›) when collapsed, down arrow (⌄) when expanded
- Improved icon centering using flexbox alignment

## [10.1.0] - 2024-12-XX

### Changed
- Removed unnecessary animations from donation button (transform, box-shadow effects)
- Simplified button hover effect to only background color change for better mobile experience
- Unified shareholder form icons - both open and closed states now use the same chevron-down icon
- Improved icon alignment - shareholder form icons are now perfectly centered

### Fixed
- Mobile users can now see popup opening immediately after button click without animation delay
- Shareholder form icons now have consistent appearance in both open and closed states

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

