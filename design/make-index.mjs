import fs from 'node:fs';
const names = { popup:'Popup', rtl:'RTL (Arapça)', panel:'Yan panel', inline:'Sayfa içi form', sheet:'Alt panel (mobil)', sheetkb:'Alt panel, klavye açık', cart:'Yan sepet', campaign:'Kampanya + ilerleme', list:'Bağış listesi + durumlar', thanks:'Teşekkür', social:'Sosyal kanıt', tax:'Vergi indirimi beyanı', account:'Bağışçı hesabı (giriş)', mydonations:'Bağışlarım', wizard:'Kurulum sihirbazı', settings:'Ayarlar' };
const tn = { avada:'Avada*', blocksy:'Blocksy*', tt25:'Twenty Twenty-Five*', storefront:'Storefront*', neutral:'Nötr' };
const files = fs.readdirSync('design/showcase').filter(f => f.endsWith('.png')).sort();
const items = files.map(f => { const m = f.match(/^(\w+)-(\w+)-(mobil|masaustu)(-koyu)?\.png$/); return m && { f, s: m[1], t: m[2], v: m[3], d: !!m[4] }; }).filter(Boolean);
const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Donation Panel · Tasarım vitrini</title>
<style>:root{color-scheme:light dark;--bg:#f4f5f7;--fg:#161b22;--card:#fff;--mut:#5b6573;--ac:#0f766e}@media(prefers-color-scheme:dark){:root{--bg:#0e1116;--fg:#eef1f5;--card:#171c23;--mut:#98a1ad;--ac:#5eead4}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:28px 20px 8px;max-width:1400px;margin:auto}h1{margin:0 0 6px;font-size:clamp(24px,5vw,34px);letter-spacing:-.02em}p{margin:0;color:var(--mut);max-width:80ch}
.note{margin-top:12px;padding:12px 14px;border-radius:12px;background:var(--card);border:1px solid #8883;font-size:13.5px}
.bar{position:sticky;top:0;z-index:5;background:color-mix(in oklab,var(--bg) 88%,transparent);backdrop-filter:blur(10px);padding:12px 20px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;max-width:1400px;margin:auto}
.bar b{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin-inline:6px 2px}
button.f{min-height:40px;padding:0 14px;border-radius:99px;border:1.5px solid #8885;background:var(--card);color:var(--fg);font:inherit;font-weight:600;font-size:13.5px;cursor:pointer}button.f[aria-pressed=true]{background:var(--ac);border-color:var(--ac);color:#fff}
@media(prefers-color-scheme:dark){button.f[aria-pressed=true]{color:#06201c}}
main{max-width:1400px;margin:auto;padding:8px 20px 60px;display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(var(--w,230px),1fr))}
figure{margin:0;background:var(--card);border:1px solid #8883;border-radius:16px;overflow:hidden;display:grid}figure a{display:block;background:#8881}img{display:block;width:100%;height:auto}
figcaption{padding:10px 12px;font-size:13px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}figcaption span{color:var(--mut)}
.empty{grid-column:1/-1;color:var(--mut);padding:30px;text-align:center}</style></head><body>
<header><h1>Donation Panel — tasarım vitrini</h1><p>${items.length} ekran görüntüsü: ${Object.keys(names).length} ekran × 4 tema × mobil (390×844) + masaüstü (1440×900), artı koyu mod örnekleri. Görsele tıklayınca tam boy açılır; etkileşimli sürüm için ilgili .html dosyasını açın (örn. <code>popup.html?lang=en&amp;theme=blocksy</code>).</p>
<p class="note"><b>*</b> Avada, Blocksy, Twenty Twenty-Five ve Storefront gerçek olarak kurulu değildir: her temanın tipik global stili (yazı ailesi, birincil renk, köşe) WordPress önayar değişkenleriyle (<code>--wp--preset--*</code>) <b>SİMÜLE</b> edilmiştir. Eklentide temaya özel kod yoktur; yalnız bu değişkenler okunur (bkz. mock.css).</p></header>
<div class="bar" id="bar"></div><main id="grid"></main>
<script>const items=${JSON.stringify(items)},names=${JSON.stringify(names)},tn=${JSON.stringify(tn)};
const st={s:'all',t:'all',v:'all',d:'0'};const bar=document.getElementById('bar'),grid=document.getElementById('grid');
const groups=[['Ekran','s',[['all','Hepsi'],...Object.entries(names)]],['Tema','t',[['all','Hepsi'],...Object.entries(tn)]],['Cihaz','v',[['all','Hepsi'],['mobil','Mobil'],['masaustu','Masaüstü']]],['Mod','d',[['0','Açık'],['1','Koyu']]]];
bar.innerHTML=groups.map(([l,k,o])=>'<b>'+l+'</b>'+o.map(([v,t])=>'<button class="f" data-k="'+k+'" data-v="'+v+'" aria-pressed="'+(st[k]===v)+'">'+t+'</button>').join('')).join('');
function draw(){document.querySelectorAll('button.f').forEach(b=>b.setAttribute('aria-pressed',st[b.dataset.k]===b.dataset.v));
const l=items.filter(i=>(st.s==='all'||i.s===st.s)&&(st.t==='all'||i.t===st.t)&&(st.v==='all'||i.v===st.v)&&(i.d?'1':'0')===st.d);
grid.style.setProperty('--w',st.v==='masaustu'?'440px':'230px');
grid.innerHTML=l.length?l.map(i=>'<figure><a href="showcase/'+i.f+'" target="_blank" rel="noopener"><img loading="lazy" src="'+i.f+'" alt="'+names[i.s]+' · '+tn[i.t]+' · '+i.v+'"></a><figcaption><b>'+names[i.s]+'</b><span>'+tn[i.t]+' · '+(i.v==='mobil'?'mobil':'masaüstü')+'</span></figcaption></figure>').join(''):'<p class="empty">Bu süzgeçte görüntü yok.</p>';}
bar.onclick=e=>{const b=e.target.closest('button.f');if(!b)return;st[b.dataset.k]=b.dataset.v;draw()};draw();</script></body></html>`;
fs.writeFileSync('design/showcase/index.html', html);
console.log(items.length);
