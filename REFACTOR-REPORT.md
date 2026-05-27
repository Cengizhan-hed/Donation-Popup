# WooCommerce Donation Popup — Refactor Report (safe-pass-2, v10.2.6)

## 1. GENEL ÖZET

**Sürüm:** 10.2.6  
**Kapsam:** P6 temizlik + P7 AJAX modülerleştirme + P8 JS bundle + smoke testler. Public API (shortcode, AJAX action isimleri, option anahtarları) korundu.

**Yapılanlar:**
- CSS token çakışması giderildi (`--wdp-radius-*` tek hiyerarşi).
- Merkezi alert popup kaldırıldı; `clearAlerts` → `utils.js`; `alerts.css` bundle’dan çıkarıldı.
- `wdp_get_product_name` deprecated (endpoint çalışır, kullanım sayacı + JSON `deprecated`).
- `WDP_Ajax` → 5 trait dosyası (`includes/classes/traits/`).
- Production JS bundle (`tools/build-js-bundle.php`, `assets/js/build/manifest.json`).
- `wdp_ajax.validation` localize (telefon/hisse adı kuralları).
- CLI smoke: `php tests/smoke/run.php`.

---

## 2. YENİ / DEĞİŞEN DOSYALAR

| Dosya | Değişiklik |
|-------|------------|
| `assets/css/src/tokens.css` | Yinelenen radius tanımları kaldırıldı |
| `includes/config/frontend-css-stack.php` | `alerts.css` çıkarıldı |
| `includes/config/frontend-js-stack.php` | **Yeni** — JS build sırası |
| `tools/build-js-bundle.php` | **Yeni** |
| `assets/js/build/*` | Üretilen JS bundle + manifest |
| `assets/js/src/utils.js` | `clearAlerts()` |
| `assets/js/src/form.js` | alerts bağımlılığı kaldırıldı |
| `assets/js/src/alerts.js` | No-op shim (geriye uyumluluk) |
| `includes/classes/class-ajax.php` | İnce registrar + trait `use` |
| `includes/classes/traits/trait-wdp-ajax-*.php` | **Yeni** (5 trait) |
| `includes/classes/class-assets.php` | JS bundle enqueue, validation localize |
| `includes/bootstrap/class-legacy-frontend.php` | `wdp_track_deprecated_ajax_usage()` |
| `package.json` | `build`, `build:css`, `build:js` |
| `scripts/package-wp-plugin.sh` | ZIP öncesi JS bundle |
| `tests/smoke/*` | **Yeni** CLI smoke |
| `woo-donation-popup.php` | Sürüm 10.2.6 |

---

## 3. DAVRANIŞ KORUMA

| Özellik | Durum |
|---------|--------|
| Modal / form / sepet AJAX | Aynı action isimleri |
| Hissedar validasyon (inline + buton üstü özet) | Korundu |
| Mobil alert popup | **Kaldırıldı** (istek üzerine) |
| `wdp_get_product_name` | Deprecated; yanıt + nonce hâlâ var |
| Dev mod (bundle yok) | Modüler JS/CSS fallback |

**Filtreler:**
- `wdp_use_js_bundle` (default `true`) — `false` ile modüler JS.

---

## 4. BUILD / DEPLOY

```bash
npm run build          # CSS + JS bundle
npm run pack           # build + ZIP
php tests/smoke/run.php
```

ZIP içinde `assets/css/build/manifest.json` ve `assets/js/build/manifest.json` olmalı.

---

## 5. KALAN İŞLER (pass-3 önerisi)

- [ ] `class-assets.php` inline CSS → ayrı sınıf (yüksek satır sayısı).
- [ ] `form.js` / `shareholder.js` → alt modüller (validation / scroll).
- [ ] `wdp_get_product_name` kaldırma (deprecated sayaç 0 ise).
- [ ] Staging QA: `QA-CHECKLIST.md` tamamı.
- [ ] PHPUnit + WordPress test bootstrap (isteğe bağlı).

---

## 6. KABUL KRİTERLERİ

| Kriter | Durum |
|--------|--------|
| `php -l` tüm includes | Geçmeli |
| `php tests/smoke/run.php` | Geçmeli |
| Bundle manifest diskte | `npm run build` sonrası |
| Public API sabit | Evet |

**Deprecated izleme:** `get_option('wdp_deprecated_ajax_wdp_get_product_name')`
