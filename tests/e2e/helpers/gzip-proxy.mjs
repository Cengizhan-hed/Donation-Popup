/**
 * Yerel kalite ölçümü için gzip vekili: PHP yerleşik sunucusu yanıtları sıkıştırmaz, üretim sunucuları sıkıştırır.
 * Lighthouse aktarım boyutlarını gerçekçi görsün diye metin yanıtlar gzip'lenir. Yalnız yerel (127.0.0.1) hedef.
 */
import http from 'node:http';
import zlib from 'node:zlib';

const TEXT = /^(text\/|application\/(javascript|json|xml|x-javascript)|image\/svg)/i;

/**
 * @param {number} originPort PHP sunucusu portu.
 * @param {number} port Vekil portu.
 * @return {Promise<{stop:()=>Promise<void>, base:string}>} Vekil.
 */
export function startGzipProxy(originPort, port) {
  const from = `127.0.0.1:${originPort}`;
  const to = `127.0.0.1:${port}`;
  const server = http.createServer((req, res) => {
    const headers = { ...req.headers, host: from, 'accept-encoding': 'identity' };
    const up = http.request({ host: '127.0.0.1', port: originPort, method: req.method, path: req.url, headers }, (ur) => {
      const chunks = [];
      ur.on('data', (c) => chunks.push(c));
      ur.on('end', () => {
        let body = Buffer.concat(chunks);
        const h = { ...ur.headers };
        if (h.location) h.location = String(h.location).split(from).join(to);
        if (Array.isArray(h['set-cookie'])) h['set-cookie'] = h['set-cookie'].map((c) => c.replace(/;\s*domain=[^;]+/i, ''));
        const type = String(h['content-type'] || '');
        if (TEXT.test(type)) {
          body = Buffer.from(body.toString('utf8').split(from).join(to), 'utf8');
          if (body.length > 256) {
            body = zlib.gzipSync(body, { level: 6 });
            h['content-encoding'] = 'gzip';
          }
          h.vary = 'Accept-Encoding';
        }
        h['content-length'] = String(body.length);
        delete h['transfer-encoding'];
        res.writeHead(ur.statusCode || 200, h);
        res.end(body);
      });
    });
    up.on('error', (e) => {
      res.writeHead(502);
      res.end(String(e));
    });
    req.pipe(up);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () =>
      resolve({
        base: `http://${to}`,
        stop: () => new Promise((r) => server.close(() => r())),
      })
    );
  });
}
