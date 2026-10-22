/**
 * WordPress / WooCommerce login once; save storageState.
 * On failure: screenshot before password fill + Turkish diagnostics (never log E2E_PASS).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { ROOT } from './env.mjs';

export const AUTH_DIR = path.join(ROOT, 'tests/e2e/.auth');
export const AUTH_FILE = path.join(AUTH_DIR, 'user.json');

/** @type {string|null} */
let authFileOverride = null;

/**
 * @param {string} profileId
 */
export function setAuthFileForProfile(profileId) {
  const id = String(profileId || '').trim() || 'default';
  authFileOverride = path.join(AUTH_DIR, `${id}.json`);
  return authFileOverride;
}

export function getAuthFile() {
  return authFileOverride || AUTH_FILE;
}
const DEBUG_DIR = path.join(ROOT, 'build/e2e/debug');
const LOGIN_FAILURE_SHOT = path.join(DEBUG_DIR, 'login-failure.png');

/** Real 2FA / OTP fields only — no free-text keyword matching. */
const TWO_FA_INPUT_RE =
  /<input\b[^>]*(?:\bname\s*=\s*["'][^"']*(?:2fa|otp|code)[^"']*["']|\bautocomplete\s*=\s*["']one-time-code["'])[^>]*>/i;
const TWO_FA_ID_RE = /\bid\s*=\s*["'](?:wfls-token|wfls-prompt-overlay)["']/i;

/**
 * @param {string} text
 * @param {Record<string, string>} env
 */
function redactSecrets(text, env) {
  let out = String(text ?? '');
  const pass = env.E2E_PASS;
  if (pass) {
    out = out.split(pass).join('[redacted]');
  }
  return out;
}

/**
 * @param {string} base
 * @param {string} relPath
 */
function joinUrl(base, relPath) {
  const p = relPath.startsWith('/') ? relPath : `/${relPath}`;
  return new URL(p, base.endsWith('/') ? base : `${base}/`).toString();
}

/**
 * @param {string} url
 * @returns {string}
 */
function urlPathname(url) {
  try {
    return new URL(url).pathname || '';
  } catch {
    return '';
  }
}

/**
 * @param {string} html
 * @param {string} id
 */
function htmlHasId(html, id) {
  const re = new RegExp(`\\bid\\s*=\\s*["']${id}["']`, 'i');
  return re.test(html);
}

/**
 * Definite wp-admin success: path + body.wp-admin + #wpadminbar, no login form.
 * When true, 2FA / CAPTCHA scans must not run.
 *
 * @param {string} url
 * @param {string} html
 */
export function isDefiniteAdminSuccess(url, html) {
  const pathname = urlPathname(url);
  if (!pathname.startsWith('/wp-admin/')) return false;
  if (!/<body\b[^>]*\bclass\s*=\s*["'][^"']*\bwp-admin\b/i.test(html)) return false;
  if (!htmlHasId(html, 'wpadminbar')) return false;
  if (htmlHasId(html, 'loginform') || htmlHasId(html, 'user_login')) return false;
  return true;
}

/**
 * Still on a login / challenge screen.
 *
 * @param {string} url
 * @param {string} html
 */
export function isLoginScreen(url, html) {
  if (/wp-login\.php/i.test(url) || /sgs-token/i.test(url)) return true;
  return htmlHasId(html, 'loginform');
}

/**
 * @param {string} html
 */
export function hasTwoFactorChallenge(html) {
  return TWO_FA_INPUT_RE.test(html) || TWO_FA_ID_RE.test(html);
}

/**
 * CAPTCHA widgets (iframe/div markers).
 *
 * @param {string} html
 */
export function hasCaptchaChallenge(html) {
  return /\b(?:g-recaptcha|cf-turnstile|h-captcha)\b/i.test(html);
}

/**
 * @param {string} html
 * @returns {string}
 */
function extractLoginErrorText(html) {
  const m = html.match(/id\s*=\s*["']login_error["'][^>]*>([\s\S]*?)<\/(?:div|p)>/i);
  if (!m) return '';
  return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Classify page after credential submit (or any post-login URL + HTML).
 * Success is evaluated first; 2FA/CAPTCHA only on the login screen with real fields.
 *
 * @param {string} url
 * @param {string} html
 * @returns {{ outcome: 'success' | '2fa' | 'captcha' | 'login_error' | 'pending', loginErrorText?: string }}
 */
export function classifyPostLoginPage(url, html) {
  if (isDefiniteAdminSuccess(url, html)) {
    return { outcome: 'success' };
  }

  if (!isLoginScreen(url, html)) {
    return { outcome: 'pending' };
  }

  if (hasTwoFactorChallenge(html)) {
    return { outcome: '2fa' };
  }

  if (hasCaptchaChallenge(html)) {
    return { outcome: 'captcha' };
  }

  if (htmlHasId(html, 'login_error')) {
    return { outcome: 'login_error', loginErrorText: extractLoginErrorText(html) };
  }

  return { outcome: 'pending' };
}

function clearLoginFailureShot() {
  if (!fs.existsSync(LOGIN_FAILURE_SHOT)) return;
  try {
    fs.unlinkSync(LOGIN_FAILURE_SHOT);
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, string>} env
 */
async function adminLooksLoggedIn(page, env) {
  const res = await page.goto(joinUrl(env.E2E_BASE_URL, '/wp-admin/'), {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  const status = res ? res.status() : 0;
  const url = page.url();
  if (status === 404) return { ok: false, status };
  const html = await page.content().catch(() => '');
  const ok = isDefiniteAdminSuccess(url, html);
  return { ok, status };
}

/**
 * @param {import('@playwright/test').BrowserContext} context
 * @param {Record<string, string>} env
 */
async function storageStateOpensAdmin(context, env) {
  const page = await context.newPage();
  try {
    const { ok, status } = await adminLooksLoggedIn(page, env);
    if (!ok) {
      const url = page.url();
      const title = await page.title().catch(() => '');
      console.error(
        `[e2e:catch-fail] wp-admin probe ok=false status=${status} url=${url} title=${String(title).slice(0, 80)}`
      );
    }
    return ok;
  } catch (e) {
    console.error(`[e2e:catch-fail] storageStateOpensAdmin: ${e && e.message ? e.message : e}`);
    return false;
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<'wp'|'woo'|null>}
 */
async function detectLoginForm(page) {
  const wpUser = page.locator('#user_login');
  const wooUser = page.locator('#username');
  if ((await wpUser.count()) > 0 && (await wpUser.first().isVisible().catch(() => false))) {
    return 'wp';
  }
  if ((await wooUser.count()) > 0 && (await wooUser.first().isVisible().catch(() => false))) {
    return 'woo';
  }
  return null;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} status
 * @param {Record<string, string>} env
 */
async function collectFailureHints(page, status, env) {
  /** @type {string[]} */
  const hints = [];
  const url = page.url();
  const html = await page.content().catch(() => '');
  let onHome = false;
  try {
    const u = new URL(url);
    const pathOnly = u.pathname.replace(/\/$/, '') || '/';
    onHome = pathOnly === '/';
  } catch {
    /* ignore */
  }

  if (status === 404 || onHome) {
    hints.push(
      'Giriş adresi yanlış olabilir. .env.e2e\'deki E2E_LOGIN_PATH değerini kontrol edin.'
    );
  }

  if (isLoginScreen(url, html)) {
    if (hasCaptchaChallenge(html)) {
      hints.push('Girişte CAPTCHA var; e2e kullanıcısı için kapatılmalı.');
    }
    if (hasTwoFactorChallenge(html)) {
      hints.push(
        'İki adımlı doğrulama açık. e2e-test kullanıcısının rolünü \'Mağaza yöneticisi\' yapın veya bu kullanıcı için 2FA\'yı kapatın.'
      );
    }
    const errLoc = page.locator('#login_error, .woocommerce-error').first();
    if ((await errLoc.count()) > 0) {
      const msg = redactSecrets(((await errLoc.innerText().catch(() => '')) || '').trim(), env);
      if (msg) {
        hints.push(`Giriş formu hata mesajı: ${msg}`);
      }
    }
  }

  return hints;
}

/**
 * Publish pre-password screenshot (or capture current page) and throw diagnostics.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} status
 * @param {string|null} prePasswordShot
 * @param {Record<string, string>} env
 * @param {string} reason
 */
async function failLogin(page, status, prePasswordShot, env, reason) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  if (prePasswordShot && fs.existsSync(prePasswordShot)) {
    fs.copyFileSync(prePasswordShot, LOGIN_FAILURE_SHOT);
  } else {
    await page.screenshot({ path: LOGIN_FAILURE_SHOT, fullPage: true }).catch(() => {});
  }

  const title = redactSecrets(await page.title().catch(() => ''), env);
  const url = redactSecrets(page.url(), env);
  const hints = await collectFailureHints(page, status, env);

  const lines = [
    `E2E giriş başarısız: ${reason}`,
    `Son URL: ${url}`,
    `HTTP durum: ${status || 'bilinmiyor'}`,
    `Sayfa başlığı: ${title || '(boş)'}`,
    'Ekran görüntüsü: build/e2e/debug/login-failure.png',
  ];
  for (const h of hints) {
    lines.push(`İpucu: ${h}`);
  }
  throw new Error(lines.join('\n'));
}

/**
 * @param {import('@playwright/test').BrowserContext} context
 */
async function finishSuccessfulLogin(context) {
  const dest = getAuthFile();
  await context.storageState({ path: dest });
  clearLoginFailureShot();
  console.log('Giriş başarılı');
  return dest;
}

/** @type {import('@playwright/test').Cookie[] | null} */
let inMemoryAdminCookies = null;

/**
 * WP-CLI oturum çerezleri (bellekte; dosyaya yazılmaz, değer loglanmaz).
 * @returns {import('@playwright/test').Cookie[] | null}
 */
export function getInMemoryAdminCookies() {
  return inMemoryAdminCookies;
}

/**
 * WP-CLI oturum çerezi — şifre yok, görünürlük değişmez.
 * Çerez değeri loglanmaz ve dosyaya yazılmaz.
 * @param {Record<string, string>} env
 */
async function authViaWpCliCookie(env) {
  const { wp } = await import('./wp-remote.mjs');
  let idRaw = '';
  try {
    idRaw = wp('wp user list --role=administrator --field=ID --number=1');
  } catch (e) {
    console.error('[e2e:catch-fail] wpCliAuth: wp user list --role=administrator başarısız');
    return null;
  }
  const adminId = parseInt(String(idRaw).trim().split(/\s+/)[0], 10);
  if (!Number.isFinite(adminId) || adminId <= 0) {
    console.error('[e2e:catch-fail] wpCliAuth: yönetici kullanıcı yok (wp user list --role=administrator boş)');
    return null;
  }
  const php = [
    'if (!function_exists("wp_generate_auth_cookie")) { echo ""; return; }',
    `$id = ${adminId};`,
    '$exp = time() + WEEK_IN_SECONDS;',
    'echo wp_json_encode(array(',
    '  "logged_in_name" => LOGGED_IN_COOKIE,',
    '  "logged_in" => wp_generate_auth_cookie($id, $exp, "logged_in"),',
    '  "auth_name" => AUTH_COOKIE,',
    '  "auth" => wp_generate_auth_cookie($id, $exp, "auth"),',
    '  "secure_auth_name" => SECURE_AUTH_COOKIE,',
    '  "secure_auth" => wp_generate_auth_cookie($id, $exp, "secure_auth"),',
    '));',
  ].join(' ');
  let raw = '';
  try {
    raw = wp(`wp eval '${php.replace(/'/g, `'\\''`)}'`);
  } catch (e) {
    console.error('[e2e:catch-fail] wpCliAuth eval: başarısız');
    return null;
  }
  const jsonLine = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{') && l.endsWith('}'))
    .pop();
  let data;
  try {
    data = JSON.parse(jsonLine || String(raw).trim());
  } catch (e) {
    console.error('[e2e:catch-fail] wpCliAuth JSON ayrıştırılamadı');
    return null;
  }
  if (!data || !data.logged_in || !data.logged_in_name) {
    console.error('[e2e:catch-fail] wpCliAuth: çerez alanları boş');
    return null;
  }
  let host = '';
  try {
    host = new URL(env.E2E_BASE_URL).hostname;
  } catch {
    return null;
  }
  const cookieDomain = host.replace(/^www\./, '');
  const cookies = [
    {
      name: data.logged_in_name,
      value: data.logged_in,
      domain: cookieDomain,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ];
  for (const pair of [
    [data.auth_name, data.auth],
    [data.secure_auth_name, data.secure_auth],
  ]) {
    if (pair[0] && pair[1]) {
      cookies.push({
        name: pair[0],
        value: pair[1],
        domain: cookieDomain,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      });
    }
  }
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (env?._profile?.comingSoon) {
      const { applyComingSoonBypass } = await import('./coming-soon.mjs');
      await applyComingSoonBypass(context, env._profile, env);
    }
    await context.addCookies(cookies);
    const ok = await storageStateOpensAdmin(context, env);
    if (!ok) {
      console.error('[e2e:catch-fail] wpCliAuth: çerez kondu ama /wp-admin açılamadı');
      await context.close();
      inMemoryAdminCookies = null;
      return null;
    }
    inMemoryAdminCookies = cookies;
    await context.close();
    clearLoginFailureShot();
    console.log('Giriş başarılı (wpCliAuth, bellek)');
    return 'memory';
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * @param {Record<string, string>} env
 */
export async function ensureAuth(env) {
  if (env && env.E2E_PROFILE_ID) setAuthFileForProfile(env.E2E_PROFILE_ID);
  if (inMemoryAdminCookies && inMemoryAdminCookies.length) {
    return 'memory';
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const dest = getAuthFile();

  if (!env?._profile?.wpCliAuth && fs.existsSync(dest)) {
    const probe = await chromium.launch();
    try {
      const context = await probe.newContext({
        viewport: { width: 1440, height: 900 },
        storageState: dest,
      });
      const ok = await storageStateOpensAdmin(context, env);
      await context.close();
      if (ok) {
        clearLoginFailureShot();
        return dest;
      }
    } finally {
      await probe.close().catch(() => {});
    }
  }

  if (env?._profile?.wpCliAuth) {
    const viaCli = await authViaWpCliCookie(env);
    if (viaCli) return viaCli;
    throw new Error(
      'wpCliAuth: WP-CLI oturum çerezi ile /wp-admin açılamadı (form girişi atlandı).'
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  if (env?._profile?.comingSoon) {
    const { applyComingSoonBypass } = await import('./coming-soon.mjs');
    await applyComingSoonBypass(context, env._profile, env);
  }
  // Keep traces off during login so credentials never land in a trace.
  await context.tracing.stop().catch(() => {});
  const page = await context.newPage();

  const loginUrl = joinUrl(env.E2E_BASE_URL, env.E2E_LOGIN_PATH);
  let status = 0;
  /** @type {string|null} */
  let prePasswordShot = null;

  try {
    const res = await page.goto(loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    status = res ? res.status() : 0;
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const formKind = await detectLoginForm(page);
    if (!formKind) {
      await failLogin(
        page,
        status,
        null,
        env,
        'Giriş formu bulunamadı (#user_login / #username).'
      );
    }

    // Capture before password fill; published only on failure.
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    prePasswordShot = path.join(DEBUG_DIR, '.login-pre.png');
    await page.screenshot({ path: prePasswordShot, fullPage: true });

    if (formKind === 'wp') {
      await page.fill('#user_login', env.E2E_USER);
      await page.fill('#user_pass', env.E2E_PASS);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
        page.click('#wp-submit'),
      ]);
    } else {
      await page.fill('#username', env.E2E_USER);
      await page.fill('#password', env.E2E_PASS);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
        page.click('button[name="login"]'),
      ]);
    }

    await page.waitForLoadState('domcontentloaded').catch(() => {});

    const postUrl = page.url();
    const postHtml = await page.content().catch(() => '');
    const classified = classifyPostLoginPage(postUrl, postHtml);

    if (classified.outcome === 'success') {
      return await finishSuccessfulLogin(context);
    }

    if (classified.outcome === '2fa') {
      await failLogin(
        page,
        status,
        prePasswordShot,
        env,
        'Giriş sonrası ek doğrulama isteniyor.'
      );
    }

    if (classified.outcome === 'captcha') {
      await failLogin(page, status, prePasswordShot, env, 'Girişte CAPTCHA engeli var.');
    }

    if (classified.outcome === 'login_error') {
      await failLogin(page, status, prePasswordShot, env, 'Giriş formu hata döndürdü.');
    }

    // Not definite success and not a login-screen challenge (e.g. Woo my-account): probe /wp-admin/.
    const admin = await adminLooksLoggedIn(page, env);
    if (!admin.ok) {
      await failLogin(
        page,
        admin.status || status,
        prePasswordShot,
        env,
        'Giriş sonrası /wp-admin/ açılamadı.'
      );
    }

    return await finishSuccessfulLogin(context);
  } finally {
    if (prePasswordShot && fs.existsSync(prePasswordShot)) {
      try {
        fs.unlinkSync(prePasswordShot);
      } catch {
        /* ignore */
      }
    }
    await browser.close().catch(() => {});
  }
}
