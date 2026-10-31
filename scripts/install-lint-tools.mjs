#!/usr/bin/env node
/**
 * Sistem composer'ı ile vendor-dev kur; wp-cli.phar indir (SHA doğrula).
 * Sistemde composer yoksa yedek: build/tools/composer.phar (repoya girmez, SHA doğrulanır).
 * Yalnız geliştirme; siteye/pakete gitmez. curl/wget kullanılmaz.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/lint-tools.json'), 'utf8'));

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u, n = 0) => {
      if (n > 8) {
        reject(new Error(`çok yönlendirme: ${url}`));
        return;
      }
      https
        .get(u, { headers: { 'User-Agent': 'wdp-lint-tools' } }, (res) => {
          const loc = res.headers.location;
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && loc) {
            res.resume();
            follow(new URL(loc, u).href, n + 1);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode} ${u}`));
            return;
          }
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          const tmp = `${dest}.part`;
          const out = fs.createWriteStream(tmp);
          res.pipe(out);
          out.on('finish', () => {
            out.close((err) => {
              if (err) {
                reject(err);
                return;
              }
              fs.renameSync(tmp, dest);
              resolve();
            });
          });
          out.on('error', reject);
        })
        .on('error', reject);
    };
    follow(url);
  });
}

/**
 * @param {{ version: string, url: string, sha256: string, dest: string }} spec
 */
async function ensurePhar(spec) {
  const dest = path.join(ROOT, spec.dest);
  if (fs.existsSync(dest) && sha256File(dest) === spec.sha256) {
    console.log(`OK ${spec.dest} (${spec.version})`);
    return dest;
  }
  console.log(`İndiriliyor ${spec.url}`);
  try {
    await download(spec.url, dest);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`İndirme başarısız (${spec.dest}): ${msg}. Ağ yoksa geliştirme aracı atlanır.`);
  }
  const got = sha256File(dest);
  if (got !== spec.sha256) {
    fs.rmSync(dest, { force: true });
    throw new Error(`SHA256 uyuşmadı ${spec.dest}: beklenen ${spec.sha256} alınan ${got}`);
  }
  fs.chmodSync(dest, 0o755);
  console.log(`Doğrulandı ${spec.dest} sha256=${got.slice(0, 12)}…`);
  return dest;
}

/** Sistem composer'ı varsa onu kullanır; yoksa null (yedek phar indirilir). */
function systemComposer() {
  const r = spawnSync('composer', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? ['composer'] : null;
}

function runComposer(cmd, args) {
  const r = spawnSync(cmd[0], [...cmd.slice(1), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    env: { ...process.env, COMPOSER_VENDOR_DIR: 'vendor-dev' },
  });
  if (r.status !== 0) {
    throw new Error(`composer ${args.join(' ')} çıkış ${r.status}`);
  }
}

const composerOnly = process.argv.includes('--composer-only');
const skipComposer = process.argv.includes('--skip-composer');

const composerCmd = systemComposer() || ['php', await ensurePhar(TOOLS.composer)];
if (!composerOnly) {
  await ensurePhar(TOOLS.wpCli);
}

if (!skipComposer) {
  const lock = path.join(ROOT, 'composer.lock');
  const check = spawnSync(
    composerCmd[0],
    [...composerCmd.slice(1), 'validate', '--no-check-publish', '--no-check-all'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, COMPOSER_VENDOR_DIR: 'vendor-dev' } }
  );
  const lockOk = fs.existsSync(lock) && check.status === 0 && !/not up to date/i.test(`${check.stdout}${check.stderr}`);
  const args = lockOk
    ? ['install', '--no-interaction', '--prefer-dist']
    : ['update', '--no-interaction', '--prefer-dist'];
  runComposer(composerCmd, args);
}

console.log('lint araçları hazır (vendor-dev/, tools/bin/)');
