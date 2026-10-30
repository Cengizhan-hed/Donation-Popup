/**
 * Donation Panel — kampanya paketi (ilerleme, etki ifadesi, sosyal kanıt). Yalnız ilgili öğe olan sayfada yüklenir.
 */
// Ortak çekirdek (belirteç/düğme) ui-core parçasında; Assets bu paketten önce bir kez basar.
import './components.css';
import './campaign.css';
import { initProgress } from './progress.mjs';
import { initImpact } from './impact.mjs';
import { initFeed } from './social.mjs';
import { syncColors } from '../ui2-shared/color-sync.mjs';

/**
 * Köke bağlı tüm parçaları başlatır.
 *
 * @param {ParentNode} scope Kapsam.
 */
function scan(scope) {
  scope.querySelectorAll('[data-dp-progress]').forEach(initProgress);
  scope.querySelectorAll('[data-dp-form]').forEach(initImpact);
  scope.querySelectorAll('[data-dp-social="feed"]').forEach(initFeed);
}

function init() {
  syncColors();
  scan(document);
  // Form sonradan eklenirse (ör. REST ile gelen parça) etki ifadesi de eklenir.
  new window.MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          scan(node);
        }
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
