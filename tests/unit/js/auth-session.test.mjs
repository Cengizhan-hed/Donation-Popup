/**
 * Oturum yeniden kullanımı ve Wordfence tekrar-yok kuralı.
 * Gerçek uzak site yok.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {
  ensureAuth,
  resetAuthStateForTests,
  setAuthFileForProfile,
  getFormLoginAttemptCount,
  AUTH_NO_RETRY,
  AUTH_DIR,
} from '../../../tests/e2e/helpers/auth.mjs';

function fakeEnv(baseUrl) {
  return {
    E2E_BASE_URL: baseUrl || 'http://127.0.0.1:9',
    E2E_USER: 'e2e',
    E2E_PASS: 'x',
    E2E_LOGIN_PATH: '/wp-login.php',
    E2E_PROFILE_ID: 'selftest-1b',
    _profile: { id: 'local', wpCliAuth: false, comingSoon: false },
  };
}

function fakeContext() {
  return {
    async route() {},
    async close() {},
    async newPage() {
      return {
        async goto() {
          return { status: () => 200 };
        },
        async content() {
          return '<body class="wp-admin"><div id="wpadminbar"></div></body>';
        },
        url: () => 'http://127.0.0.1/wp-admin/',
        async title() {
          return 'Dashboard';
        },
        async close() {},
      };
    },
    async addCookies() {},
    async storageState() {},
  };
}

function fakeBrowser() {
  const ctx = fakeContext();
  return {
    async newContext() {
      return ctx;
    },
    async close() {},
  };
}

describe('auth oturum yeniden kullanımı', () => {
  const dest = path.join(AUTH_DIR, 'selftest-1b.json');

  beforeEach(() => {
    resetAuthStateForTests();
    setAuthFileForProfile('selftest-1b');
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    fs.writeFileSync(
      dest,
      JSON.stringify({ cookies: [{ name: 'wordpress_logged_in', value: 'x', domain: '127.0.0.1', path: '/' }], origins: [] }),
      'utf8'
    );
  });

  it('geçerli storageState varken ikinci çağrıda form girişi yok; geçerlilik 1 kez', async () => {
    let formCalls = 0;
    let validateCalls = 0;
    const env = fakeEnv();
    const opts = {
      launchBrowser: async () => fakeBrowser(),
      validateStorageState: async () => {
        validateCalls += 1;
        return true;
      },
      performFormLogin: async () => {
        formCalls += 1;
        return dest;
      },
    };
    const first = await ensureAuth(env, opts);
    const second = await ensureAuth(env, opts);
    assert.equal(first, dest);
    assert.equal(second, dest);
    assert.equal(formCalls, 0);
    assert.equal(validateCalls, 1);
    assert.equal(getFormLoginAttemptCount(), 0);
  });
});

describe('auth başarısız girişte tekrar yok', () => {
  /** @type {http.Server} */
  let server;
  /** @type {number} */
  let port;
  let postCount = 0;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer((req, res) => {
        if (req.method === 'POST') postCount += 1;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><body class="login">
          <div id="login_error">Geçersiz kullanıcı adı.</div>
          <form id="loginform" method="post" action="/wp-login.php">
            <input type="text" name="log" id="user_login" />
            <input type="password" name="pwd" id="user_pass" />
            <input type="submit" id="wp-submit" />
          </form>
        </body></html>`);
      });
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((r) => server.close(r));
  });

  it('tek deneme; Wordfence mesajı; ikinci POST yok', async () => {
    resetAuthStateForTests();
    setAuthFileForProfile('selftest-1b-fail');
    postCount = 0;
    const dest = path.join(AUTH_DIR, 'selftest-1b-fail.json');
    try {
      fs.unlinkSync(dest);
    } catch {
      /* yok */
    }
    const env = fakeEnv(`http://127.0.0.1:${port}`);
    env.E2E_PROFILE_ID = 'selftest-1b-fail';
    await assert.rejects(() => ensureAuth(env), (e) => {
      assert.match(String(e.message), /Wordfence kilidini önlemek için tekrar denenmedi/);
      assert.equal(String(e.message).includes(AUTH_NO_RETRY), true);
      return true;
    });
    assert.equal(getFormLoginAttemptCount(), 1);
    assert.ok(postCount <= 1, `beklenen tek POST, görülen ${postCount}`);
  });

  it('enjekte formLogin başarısızsa ikinci kez çağrılmaz', async () => {
    resetAuthStateForTests();
    setAuthFileForProfile('selftest-1b-hook');
    const dest = path.join(AUTH_DIR, 'selftest-1b-hook.json');
    try {
      fs.unlinkSync(dest);
    } catch {
      /* yok */
    }
    let formCalls = 0;
    const env = fakeEnv();
    env.E2E_PROFILE_ID = 'selftest-1b-hook';
    await assert.rejects(
      () =>
        ensureAuth(env, {
          launchBrowser: async () => fakeBrowser(),
          validateStorageState: async () => false,
          performFormLogin: async () => {
            formCalls += 1;
            throw new Error('sahte hata');
          },
        }),
      (e) => {
        assert.match(String(e.message), /Wordfence kilidini önlemek için tekrar denenmedi/);
        return true;
      }
    );
    assert.equal(formCalls, 1);
  });
});
