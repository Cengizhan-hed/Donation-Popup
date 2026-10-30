/**
 * Canlı kampanya çubuğu yükleyicisi (form ve compact kart paketlerinde; birkaç yüz bayt).
 *
 * Çubuk betiği (`progress` paketi) kampanyalı form sayfada çizilirken zaten kuyruğa alınır. Form sonradan REST ile
 * gelirse (ör. bağış listesinden açılan katman) ve sayfada çubuk betiği yoksa bir kez yüklenir. Adres sayfadaki
 * öznitelikten ALINMAZ: bu paketin kendi adresinden türetilir (aynı köken, eklentinin assets/build/progress/ yolu);
 * öznitelikten yalnız doğrulanmış sürüm belirteci okunur. Kampanyasız sayfada hiçbir şey yüklenmez.
 */
import { progressAssetUrls } from './live-loader-url.mjs';

const KEY = '__donationPanelLiveProgress';
const QUEUE = '__donationPanelLiveQueue';
const SCRIPT_ID = 'donation-panel-progress-js';
const STYLE_ID = 'donation-panel-progress-css';
// Paket betiği çalışırken (defer; modül değil) kendi adresi. Sonradan okunamaz.
const SELF = document.currentScript && document.currentScript.src ? document.currentScript.src : '';

/**
 * Sayfada çubuk varsa çubuk betiğini hazırlar (zaten yüklüyse yeni çubukları bağlar).
 *
 * @param {ParentNode} [scope] Kapsam.
 */
export function ensureLiveProgress(scope = document) {
  const api = window[KEY];
  if (api) {
    api.scan();
    return;
  }
  const bar = scope.querySelector('[data-dp-live]');
  if (!bar || document.getElementById(SCRIPT_ID)) {
    return;
  }
  let token;
  try {
    token = String(JSON.parse(bar.getAttribute('data-dp-live') || '{}').v || '');
  } catch {
    return;
  }
  const urls = progressAssetUrls(SELF, token, window.location.origin);
  if (!urls) {
    return;
  }
  // Stil sayfada satır içi yoksa (form REST'le geldi) aynı paketin CSS'i; çubuk o ana dek boş iz olarak görünür.
  if (!document.getElementById('donation-panel-inline-progress') && !document.getElementById(STYLE_ID)) {
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = urls.css;
    document.head.appendChild(link);
  }
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = urls.js;
  script.async = true;
  document.head.appendChild(script);
}

if (!window[QUEUE]) {
  window[QUEUE] = [];
  // Betik gelmeden seçilen tutarlar sıraya alınır; betik başlayınca yeniden uygulanır.
  document.addEventListener('donation-panel:amount', (event) => {
    if (!window[KEY]) {
      window[QUEUE].push(event);
      ensureLiveProgress();
    }
  });
}
