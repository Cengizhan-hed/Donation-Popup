/**
 * Android emülatör/cihaz yardımcıları (gerçek Chrome; yalnız YEREL test URL'si, `adb reverse` ile).
 * Emülatör/adb yoksa `connectAndroid` null döner; çağıran testi açık mesajla ATLAR.
 */
import { spawnSync } from 'node:child_process';
import { _android } from '@playwright/test';

/**
 * @param {string[]} args adb argümanları.
 * @param {string} [serial] Cihaz seri numarası.
 * @return {{ok: boolean, out: string}} Sonuç.
 */
export function adb(args, serial = '') {
  const r = spawnSync('adb', serial ? ['-s', serial, ...args] : args, { encoding: 'utf8', timeout: 60000 });
  return { ok: r.status === 0, out: String(r.stdout || '') + String(r.stderr || '') };
}

/**
 * @return {Promise<{device: import('@playwright/test').AndroidDevice, serial: string}|null>} İlk cihaz ya da null.
 */
export async function connectAndroid() {
  if (!adb(['version']).ok) {
    return null;
  }
  let devices;
  try {
    devices = await _android.devices();
  } catch {
    return null;
  }
  if (!devices.length) {
    return null;
  }
  return { device: devices[0], serial: devices[0].serial() };
}

/** Test edilen tarayıcı paketi (varsayılan Google Chrome; Chromium anlık görüntüsü için org.chromium.chrome). */
export const CHROME_PKG = process.env.WDP_ANDROID_CHROME_PKG || 'com.android.chrome';

const FIRST_RUN_BUTTONS = ['Use without an account', 'Stay signed out', 'No thanks', 'Got it', 'No, thanks', 'Skip', 'Wait', 'Close app'];

/**
 * Ekran düzenini (uiautomator) okur; geçiş anında "null root node" hatası verebilir, bu yüzden birkaç kez dener.
 *
 * @param {string} serial Cihaz.
 * @return {string} XML ya da boş.
 */
function dumpUi(serial) {
  for (let k = 0; k < 4; k += 1) {
    const d = adb(['shell', 'uiautomator', 'dump', '/sdcard/wdp-ui.xml'], serial);
    if (d.ok && !/null root node|ERROR/.test(d.out)) {
      const xml = adb(['shell', 'cat', '/sdcard/wdp-ui.xml'], serial).out;
      if (xml.includes('<hierarchy')) {
        return xml;
      }
    }
    spawnSync('sleep', ['1']);
  }
  return '';
}

/**
 * Chrome ilk açılış karşılama/bildirim ekranlarını adb + uiautomator ile atlar (bayrak dosyası kullanıcı derlemesinde
 * okunmadığı için). Ekranlar yoksa hızlı döner. Sonra Chrome durdurulur.
 *
 * @param {string} serial Cihaz.
 */
export function dismissChromeFirstRun(serial) {
  adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'about:blank', CHROME_PKG], serial);
  let clean = 0;
  for (let i = 0; i < 14 && clean < 2; i += 1) {
    spawnSync('sleep', ['2']);
    const xml = dumpUi(serial);
    let hit = null;
    for (const label of FIRST_RUN_BUTTONS) {
      const m = xml.match(new RegExp(`text="${label}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
      if (m) {
        hit = [Math.round((+m[1] + +m[3]) / 2), Math.round((+m[2] + +m[4]) / 2)];
        break;
      }
    }
    if (hit) {
      clean = 0;
      adb(['shell', 'input', 'tap', String(hit[0]), String(hit[1])], serial);
    } else if (xml) {
      clean += 1; // boş okuma (geçiş anı, "null root node") çıkış sayılmaz; art arda 2 temiz okuma gerekir
    }
  }
  adb(['shell', 'rm', '-f', '/sdcard/wdp-ui.xml'], serial);
  adb(['shell', 'am', 'force-stop', CHROME_PKG], serial);
}

/**
 * Yerel test portunu cihazdan erişilir yapar (127.0.0.1:PORT cihaz içinde bilgisayara gider).
 *
 * @param {string} serial Cihaz.
 * @param {number|string} port Port.
 * @return {boolean} Başarılı mı.
 */
export function reversePort(serial, port) {
  return adb(['reverse', `tcp:${port}`, `tcp:${port}`], serial).ok;
}
