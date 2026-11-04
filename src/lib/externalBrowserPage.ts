import type { InAppPlatform, ClientOS } from './inAppBrowser'

/**
 * 「強制跳外部瀏覽器」中轉頁。
 * 極輕量：無框架、無外部字型、無追蹤碼（追蹤碼等帶 _ext 回來那次再觸發，避免重複計 PageView）。
 *
 * 流程：載入即嘗試跳外部瀏覽器 → 1.5 秒後還在這頁就顯示手動引導 → 永遠有「繼續在這裡瀏覽」出口。
 */

export interface ExternalBrowserPageOptions {
  platform: InAppPlatform
  os: ClientOS
  /** 回到短網址 + _ext=1（外部瀏覽器開這個，伺服器記「跳出成功」後 302 到目的地） */
  escapeUrl: string
  /** 回到短網址 + _ext=0（留在 App 內，伺服器記「留下」後照原流程跳轉） */
  stayUrl: string
  /** 複製連結用的乾淨短網址 */
  copyUrl: string
  title: string
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 放進 <script> 的字串：JSON 之外再把 < 轉掉，避免被 </script> 截斷
const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

const MENU_HINT: Record<InAppPlatform, { where: string; item: string }> = {
  facebook: { where: '右上角', item: '在瀏覽器中開啟' },
  messenger: { where: '右上角', item: '在瀏覽器中開啟' },
  instagram: { where: '右上角', item: '在瀏覽器中開啟' },
  threads: { where: '右上角', item: '在瀏覽器中開啟' },
  line: { where: '右下角', item: '在瀏覽器中開啟' },
  tiktok: { where: '右上角', item: '在瀏覽器中開啟' },
}

export function renderExternalBrowserPage(o: ExternalBrowserPageOptions): Response {
  // TikTok 沒有可用的跳轉方式；其他平台要是 iOS/Android 才有對應手法
  const canAutoJump = o.platform !== 'tiktok' && (o.platform === 'line' || o.os === 'ios' || o.os === 'android')
  const hint = MENU_HINT[o.platform]

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(o.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans TC","PingFang TC",sans-serif;background:#fafafa;color:#1f2937;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 20px}
.card{width:100%;max-width:380px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:28px 24px;text-align:center}
.spin{width:36px;height:36px;border:3px solid #e5e7eb;border-top-color:#dc2626;border-radius:50%;margin:8px auto 16px;animation:r .8s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}
h1{font-size:20px;font-weight:700;line-height:1.4;margin-bottom:10px}
p{font-size:15px;line-height:1.6;color:#4b5563}
.arrow{font-size:40px;line-height:1;margin:4px 0 8px;color:#dc2626}
.step{display:inline-block;background:#fef2f2;color:#991b1b;border-radius:8px;padding:8px 12px;font-size:15px;font-weight:600;margin:10px 0 18px;line-height:1.5}
.btn{display:block;width:100%;padding:14px;border:0;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;margin-top:10px;text-decoration:none}
.p{background:#dc2626;color:#fff}
.s{background:#f3f4f6;color:#374151}
.l{display:inline-block;margin-top:18px;font-size:14px;color:#6b7280;text-decoration:underline}
#f{display:none;width:100%;margin-top:10px;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;color:#374151}
#g{display:none}
</style>
</head>
<body>
<div class="card">
  <div id="w">
    <div class="spin"></div>
    <p>正在為你用瀏覽器開啟…</p>
  </div>
  <div id="g">
    <div id="m">
      <div class="arrow">${hint.where === '右下角' ? '↘' : '↗'}</div>
    </div>
    <h1 id="h">用瀏覽器開啟<br>結帳更順利</h1>
    <div id="m2">
      <p>點${hint.where}的 <b>⋯</b> 選單</p>
      <div class="step">選擇「${hint.item}」</div>
    </div>
    ${canAutoJump ? '<button class="btn p" id="b" type="button">用瀏覽器開啟</button>' : ''}
    <button class="btn s" id="c" type="button">複製連結</button>
    <input id="f" readonly>
    <a class="l" href="${esc(o.stayUrl)}">繼續在這裡瀏覽 →</a>
  </div>
  <noscript><p style="margin-top:12px"><a class="btn p" href="${esc(o.stayUrl)}">繼續前往</a></p></noscript>
</div>
<script>
(function(){
var P=${js(o.platform)},OS=${js(o.os)},ESC=${js(o.escapeUrl)},STAY=${js(o.stayUrl)},COPY=${js(o.copyUrl)},AUTO=${canAutoJump};
var g=document.getElementById('g'),w=document.getElementById('w'),shown=false,hid=false,t;
function show(){
  if(shown)return;shown=true;w.style.display='none';g.style.display='block';
  // 曾經被切到背景＝外部瀏覽器已開啟；使用者回來時改成「已經幫你開了」，不再教手動開
  if(hid){
    document.getElementById('m').style.display='none';
    document.getElementById('m2').style.display='none';
    document.getElementById('h').innerHTML='已經幫你用瀏覽器打開了 ✓';
    if(b)b.textContent='再開一次';
  }
}
function jump(){
  try{
    if(P==='line'){location.replace(ESC);return;}
    if(OS==='android'){
      var u=new URL(ESC);
      location.href='intent://'+u.host+u.pathname+u.search+'#Intent;scheme=https;S.browser_fallback_url='+encodeURIComponent(STAY)+';end';
      return;
    }
    if(OS==='ios'){location.href='x-safari-'+ESC;return;}
  }catch(e){}
  show();
}
var b=document.getElementById('b');
if(b){b.onclick=function(){jump();setTimeout(show,800);};}
document.getElementById('c').onclick=function(){
  var self=this;
  function fb(){var f=document.getElementById('f');f.style.display='block';f.value=COPY;f.focus();f.select();}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(COPY).then(function(){self.textContent='已複製 ✓';},fb);
  }else{fb();}
};
if(AUTO){
  jump();
  t=setTimeout(show,1500);
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){clearTimeout(t);hid=true;}else{show();}
  });
}else{show();}
})();
</script>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
