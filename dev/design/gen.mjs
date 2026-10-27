import fs from 'node:fs';
const pre = { rtl: "<script>if(!location.search.includes('lang'))history.replaceState(0,'','?lang=ar')</script>" };
const titles = { popup:'Popup', rtl:'RTL (Arapça) popup', panel:'Yan panel', inline:'Sayfa içi form', sheet:'Alt panel (mobil)', sheetkb:'Alt panel, klavye açık', cart:'Yan sepet', campaign:'Kampanya kartları', list:'Bağış listesi', thanks:'Teşekkür ekranı', social:'Sosyal kanıt', tax:'Vergi indirimi beyanı', account:'Bağışçı hesabı', mydonations:'Bağışlarım', wizard:'Kurulum sihirbazı', settings:'Ayarlar' };
for (const [k, v] of Object.entries(titles)) {
  const admin = ['wizard', 'settings'].includes(k);
  const body = k === 'sheetkb' ? 'sheet' : k;
  const extra = k === 'sheetkb' ? "<script>if(!location.search.includes('kb'))history.replaceState(0,'','?'+location.search.slice(1)+(location.search?'&':'')+'kb=1')</script>" : '';
  fs.writeFileSync(`design/${k}.html`, `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark">
<title>${v} · Donation Panel prototype</title>
<link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="components.css"><link rel="stylesheet" href="mock.css">${admin ? '<link rel="stylesheet" href="admin.css">' : ''}
</head><body class="mk" data-screen="${body}">${pre[k] || ''}${extra}
<script src="dp.js"></script><script src="${admin ? 'admin.js' : 'screens.js'}"></script></body></html>
`);
}
