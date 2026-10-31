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

const FIRST_RUN_BUTTONS = ['Use without an account', 'No thanks', 'Got it', 'No, thanks', 'Skip'];

/**
 * Chrome ilk açılış karşılama/bildirim ekranlarını adb + uiautomator ile atlar (bayrak dosyası kullanıcı derlemesinde
 * okunmadığı için). Ekranlar yoksa hızlı döner. Sonra Chrome durdurulur.
 *
 * @param {string} serial Cihaz.
 */
export function dismissChromeFirstRun(serial) {
  adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'about:blank', 'com.android.chrome'], serial);
  for (let i = 0; i < 8; i += 1) {
    spawnSync('sleep', ['2']);
    adb(['shell', 'uiautomator', 'dump', '/sdcard/wdp-ui.xml'], serial);
    const xml = adb(['shell', 'cat', '/sdcard/wdp-ui.xml'], serial).out;
    let hit = null;
    for (const label of FIRST_RUN_BUTTONS) {
      const m = xml.match(new RegExp(`text="${label}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
      if (m) {
        hit = [Math.round((+m[1] + +m[3]) / 2), Math.round((+m[2] + +m[4]) / 2)];
        break;
      }
    }
    if (!hit) {
      break;
    }
    adb(['shell', 'input', 'tap', String(hit[0]), String(hit[1])], serial);
  }
  adb(['shell', 'rm', '-f', '/sdcard/wdp-ui.xml'], serial);
  adb(['shell', 'am', 'force-stop', 'com.android.chrome'], serial);
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
