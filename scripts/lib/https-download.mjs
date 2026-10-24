/**
 * Geliştirme aracı indirme — curl/wget yok; Node https + yönlendirme.
 */
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

/**
 * @param {string} url
 * @param {string} dest
 */
export function downloadHttps(url, dest) {
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
              resolve(dest);
            });
          });
          out.on('error', reject);
        })
        .on('error', reject);
    };
    follow(url);
  });
}
