/**
 * Offline unit tests for post-login classification (no network).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPostLoginPage } from './auth.mjs';

describe('classifyPostLoginPage', () => {
  it('treats wp-admin dashboard as success even when notices mention authentication code', () => {
    const url = 'https://example.com/wp-admin/';
    const html = `
      <html><body class="wp-admin wp-core-ui">
        <div id="wpadminbar"></div>
        <div class="notice"><p>Wordfence authentication code settings are available.</p></div>
      </body></html>
    `;
    assert.equal(classifyPostLoginPage(url, html).outcome, 'success');
  });

  it('detects 2FA only on login screen with a real one-time-code field', () => {
    const url = 'https://example.com/wp-login.php';
    const html = `
      <html><body class="login">
        <form id="loginform">
          <input type="text" name="user_login" id="user_login" />
          <input type="text" autocomplete="one-time-code" name="wfls-token" />
        </form>
      </body></html>
    `;
    assert.equal(classifyPostLoginPage(url, html).outcome, '2fa');
  });

  it('surfaces #login_error on the login screen', () => {
    const url = 'https://example.com/wp-login.php';
    const html = `
      <html><body class="login">
        <div id="login_error">Geçersiz kullanıcı adı.</div>
        <form id="loginform">
          <input type="text" name="log" id="user_login" />
        </form>
      </body></html>
    `;
    const result = classifyPostLoginPage(url, html);
    assert.equal(result.outcome, 'login_error');
    assert.match(result.loginErrorText || '', /Geçersiz kullanıcı adı/);
  });
});
