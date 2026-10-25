/**
 * Dağıtım ZIP'inde lint/geliştirme yollarının bulunmaması.
 */
export const DIST_FORBIDDEN_PATTERNS = [
  /(?:^|\/)vendor-dev(?:\/|$)/,
  /(?:^|\/)tools\/bin(?:\/|$)/,
  /(?:^|\/)phpcs\.xml(?:\.dist)?$/,
  /(?:^|\/)phpstan(?:\.verify)?\.neon$/,
  /(?:^|\/)phpstan-baseline\.neon$/,
  /(?:^|\/)composer\.(json|lock|phar)$/,
  /(?:^|\/)composer-setup\.php$/,
];

export const DISTIGNORE_REQUIRED = [
  'vendor-dev/',
  'phpcs.xml.dist',
  'phpcs-src.xml.dist',
  'phpstan.neon',
  'phpstan.verify.neon',
  'composer.json',
  'tools/',
];

/**
 * @param {string[]} entries zip içi yollar (woo-donation-popup/... veya göreli)
 * @returns {string[]}
 */
export function forbiddenZipEntries(entries) {
  const out = [];
  for (const raw of entries) {
    const rel = String(raw || '')
      .replace(/\\/g, '/')
      .replace(/^woo-donation-popup\//, '');
    if (!rel || rel.endsWith('/')) continue;
    if (DIST_FORBIDDEN_PATTERNS.some((re) => re.test(rel))) out.push(rel);
  }
  return out;
}
