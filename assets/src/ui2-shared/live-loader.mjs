/**
 * Canlı kampanya çubuğu yükleyicisi (form ve compact kart paketlerinde; birkaç yüz bayt).
 *
 * Çubuk betiği (`progress` paketi) kampanyalı form sayfada çizilirken zaten kuyruğa alınır. Form sonradan REST ile
 * gelirse (ör. bağış listesinden açılan katman) ve sayfada çubuk betiği yoksa, çubuğun kendi yapılandırmasındaki
 * adresten bir kez yüklenir. Kampanyasız sayfada hiçbir şey yüklenmez. Betik gelene dek seçilen tutar kaybolmaz.
 */
const KEY = '__donationPanelLiveProgress';
const QUEUE = '__donationPanelLiveQueue';
const SCRIPT_ID = 'donation-panel-progress-js';

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
  let cfg;
  try {
    cfg = JSON.parse(bar.getAttribute('data-dp-live') || '{}');
  } catch {
    return;
  }
  const src = String(cfg.src || '');
  if (!src) {
    return;
  }
  // Stil sayfada satır içi yoksa (form REST'le geldi) aynı paketin CSS'i; çubuk o ana dek boş iz olarak görünür.
  if (cfg.css && !document.getElementById('donation-panel-inline-progress') && !document.getElementById(`${SCRIPT_ID.slice(0, -3)}-css`)) {
    const link = document.createElement('link');
    link.id = `${SCRIPT_ID.slice(0, -3)}-css`;
    link.rel = 'stylesheet';
    link.href = String(cfg.css);
    document.head.appendChild(link);
  }
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = src;
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
