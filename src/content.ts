import {icon} from './icons';
import {clampPosition} from './workflow';
(() => {
 const marker='omni-bgm-host';if(document.getElementById(marker))return;
 const host=document.createElement('div');host.id=marker;host.dataset.version='1.4.3';document.documentElement.append(host);const root=host.attachShadow({mode:'closed'});
 root.innerHTML=`<style>:host{all:initial;position:fixed;right:24px;bottom:28px;z-index:2147483600;font:13px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;color:#edf2ee;color-scheme:dark}*{box-sizing:border-box}section{width:292px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;background:#171d19;border:1px solid #63796a;border-radius:12px;padding:16px;box-shadow:0 12px 32px #0006}header{display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #35443a;color:#b8e2c1;cursor:grab}header strong{display:flex;align-items:center;gap:8px}.ui-icon{vertical-align:middle;flex:none}button,select{font:inherit;color:inherit;background:transparent;border:1px solid #63796a;border-radius:6px;padding:6px 10px;min-height:34px;cursor:pointer}button:hover{background:#242e27}button:disabled{opacity:.55}button:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid #b8e2c1;outline-offset:2px}header button{padding:5px 8px;border-color:transparent}header span{display:flex;gap:4px}.row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}p{margin:10px 0;overflow-wrap:anywhere}#track{font-size:16px;font-weight:600;margin:14px 0 8px}small{color:#b3c0b7}#status{display:block;margin:10px 0;font-size:12px}.error{color:#ffb5ac}.error:empty{display:none}input{width:100%;accent-color:#b8e2c1}select{max-width:100%;min-width:0;flex:1;background:#111713}.hidden{display:none!important}strong{font-weight:600}#compactPause{background:#b8e2c1;border-color:#b8e2c1;color:#14291b;flex:1}#compactNext{flex:1}#pause,#next{display:none}#body{padding-top:4px}#start{width:100%;margin:12px 0 8px}#settings{width:100%;margin-top:12px;border-color:#35443a;color:#b3c0b7}#resetPosition{font-size:12px;border-color:transparent;color:#b3c0b7}#retry{font-size:12px}::selection{background:#b8e2c1;color:#14291b}button{transition:background-color .16s ease-out}@media(prefers-reduced-motion:reduce){button{transition:none}}</style><section><header><strong>${icon('music')}随境配乐</strong><span><button id="fold" aria-label="展开播放器" aria-expanded="false">${icon('plus')}</button> <button id="hide" aria-label="隐藏悬浮播放器">${icon('close')}</button></span></header><p id="track">尚未启用</p><div class="row"><button id="compactPause">暂停</button><button id="compactNext">下一首</button></div><div id="body" class="hidden"><small id="status"></small><p id="error" class="error"></p><div class="row"><button id="enable">开启</button><button id="pause">暂停</button><button id="next">下一首</button><button id="retry" title="手动发送一次情境判断请求">重判 · 1 次请求</button></div><div class="row"><select id="mood" aria-label="锁定情绪"><option value="">自动情绪</option></select><button id="lock">锁曲</button></div><p><input id="volume" type="range" min="0" max="1" step="0.01" aria-label="音量"></p><button id="start" title="发送当前完整回合；缓存命中不计新请求">开始配乐</button><button id="resetPosition">重置位置</button><button id="settings">曲库与设置 ↗</button></div></section>`;
 const $=(id:string)=>root.getElementById(id) as any;let state:any={},controlError='',folded=true,lastSig='',changed=Date.now(),lastSent='',lastBusy=0,sending=false;
 const send=(m:any)=>chrome.runtime.sendMessage(m);
 let pos:{x:number;y:number}|undefined,drag:any=null;
 function place(){if(drag)return;const box=host.getBoundingClientRect(),point=clampPosition(pos,innerWidth,innerHeight,box.width,box.height);host.style.right='auto';host.style.bottom='auto';host.style.left=point.left+'px';host.style.top=point.top+'px';}
 const panel=root.querySelector('section');
 panel.addEventListener('pointerdown',(e:PointerEvent)=>{if(e.button!==0||(e.target as HTMLElement).closest('button,input,select,textarea,a,label,summary'))return;const r=host.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};panel.setPointerCapture?.(e.pointerId);});
 panel.addEventListener('pointermove',(e:PointerEvent)=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<4)return;drag.moved=true;e.preventDefault();(panel as HTMLElement).style.userSelect='none';const box=host.getBoundingClientRect(),maxX=Math.max(0,innerWidth-box.width-8),maxY=Math.max(0,innerHeight-box.height-8);host.style.right='auto';host.style.bottom='auto';host.style.left=Math.max(0,Math.min(maxX,drag.left+dx))+'px';host.style.top=Math.max(0,Math.min(maxY,drag.top+dy))+'px';});
 function endDrag(e:PointerEvent){if(!drag||e.pointerId!==drag.id)return;const moved=drag.moved;drag=null;(panel as HTMLElement).style.userSelect='';if(moved){const r=host.getBoundingClientRect();pos={x:r.left/Math.max(1,innerWidth-r.width-8),y:r.top/Math.max(1,innerHeight-r.height-8)};void control('floatPosition',pos);}place();}
 panel.addEventListener('pointerup',endDrag);panel.addEventListener('pointercancel',endDrag);panel.addEventListener('lostpointercapture',endDrag);window.addEventListener('resize',place);if(typeof ResizeObserver!=='undefined')new ResizeObserver(place).observe(panel);
 $('start').onclick=()=>control('start');$('resetPosition').onclick=()=>control('floatPosition',null);

 function setFolded(value:boolean){folded=value;$('body').classList.toggle('hidden',folded);$('fold').innerHTML=icon(folded?'plus':'minus');$('fold').setAttribute('aria-expanded',String(!folded));$('fold').setAttribute('aria-label',folded?'展开播放器':'折叠播放器');place();}
 function showControlError(message:string){controlError=message;$('error').textContent=message;setFolded(false);}
 async function control(command:string,value?:any){try{const r=await send({type:'control',command,value});if(r.ok){controlError='';render(r.data);}else showControlError(r.error||'操作未完成，请重试');}catch{showControlError('连接中断，请刷新游戏页');}}
 $('fold').onclick=()=>setFolded(!folded);
 $('compactPause').onclick=()=>control('paused',!state.paused);$('compactNext').onclick=()=>control('next');
 $('hide').onclick=()=>control('floating',false);$('enable').onclick=()=>control('enabled',!state.enabled);$('pause').onclick=()=>control('paused',!state.paused);$('next').onclick=()=>control('next');$('retry').onclick=()=>control('retry');$('lock').onclick=()=>control('lockTrack',!state.lockTrack);$('mood').onchange=()=>control('lockMood',$('mood').value);$('volume').onchange=()=>control('volume',+$('volume').value);$('settings').onclick=()=>send({type:'openSettings'});
 function render(s:any){if(!s)return;state=s;if(!drag)pos=s.floatPosition;host.style.display=s.floating&&/^\/game\//.test(location.pathname)?'block':'none';$('track').textContent=s.trackName||'未播放';$('status').textContent=[s.status,s.moods?.find(m=>m.id===s.decision?.mood)?.name,s.decision?.tags?.join(' · ')].filter(Boolean).join(' / ');$('error').textContent=controlError||s.error||'';$('enable').textContent=s.enabled?'关闭自动':'开启自动';$('pause').textContent=s.paused?'恢复':'暂停';$('compactPause').textContent=s.paused?'恢复':'暂停';$('lock').textContent=s.lockTrack?'解锁曲目':'锁曲';if(root.activeElement!==$('volume'))$('volume').value=s.volume;
 const signature=JSON.stringify(s.moods);if($('mood').dataset.sig!==signature){$('mood').replaceChildren(new Option('自动情绪',''),...s.moods.filter(m=>!m.disabled).map(m=>new Option(m.name,m.id)));$('mood').dataset.sig=signature;}$('mood').value=s.lockMood||'';place();
 }
 let confirmedGame:{id:string;world:string}|null=null;
 function snapshot(){
  if(document.visibilityState==='hidden')return {game:/^\/game\/[^/]+/.test(location.pathname),visible:false};
  const gameId=/^\/game\/[^/]+/.test(location.pathname)?location.pathname.split('/')[2]:'';
  if(confirmedGame?.id!==gameId)confirmedGame=null;
  if(!gameId)return {game:false,visible:true};
  const scene=document.querySelector('.scene-content > .scene') as HTMLElement;const counter=document.querySelector('.page-status')?.textContent||'';const match=counter.match(/第\s*(\d+)\s*\/\s*(\d+)\s*回合/);
  const input=document.querySelector('textarea[placeholder="在这里自定义你的行动..."]');
  const buttons=[...document.querySelectorAll('button')].filter(x=>x.getClientRects().length);
  const submit=buttons.find(b=>/^提交$/.test(b.textContent.trim()));
  const generating=buttons.some(b=>/^(停止生成|停止推演|取消生成)$/.test(b.textContent.trim()));
  const worldNode=[...document.querySelectorAll('span')].find(x=>/^世界线「[^」]+」$/.test(x.textContent.trim()));
  const world=worldNode?.textContent.trim()||confirmedGame?.world||'unknown';
  if(!scene||!match||!input){
   // A known game's generation view is still foreground playback, but cannot be classified.
   if(confirmedGame&&(generating||(scene&&match))){lastBusy=Date.now();return {game:true,visible:true,scene:{gameId,world,ready:false}};}
   confirmedGame=null;return {game:false,visible:true};
  }
  confirmedGame={id:gameId,world};
  const busy=!submit||submit.disabled||submit.getAttribute('aria-disabled')==='true'||submit.classList.contains('is-loading')||generating;
  if(busy)lastBusy=Date.now();
  const text=scene.innerText.trim();const turn=+match[1];
  const sig=JSON.stringify([gameId,world,turn,text]);if(sig!==lastSig){lastSig=sig;changed=Date.now();}
  // Require both an enabled submit control and a quiet body; never treat the static AI生成 label as activity.
  const ready=!busy&&Date.now()-changed>2500&&Date.now()-lastBusy>1000&&text.length>10;
  const context=turn===+match[2]?[...document.querySelectorAll('#pane-player-entity li')].filter(e=>['位置','当前目标','短期目标'].includes(e.querySelector('.item-name')?.textContent.trim())).map(e=>e.querySelector('.item-name')?.textContent+':'+e.querySelector('.item-value')?.textContent).join('；').slice(0,600):'';
  const sceneData={text,world,turn,total:+match[2],gameId,context,ready,title:document.querySelector('h1')?.textContent?.trim().slice(0,80)||'Omnimundia'};
  return {game:true,visible:document.visibilityState==='visible',scene:sceneData};
 }
 async function tick(){if(sending)return;sending=true;try{const data=snapshot();const sig=JSON.stringify(data.scene);const msg:any={type:'heartbeat',game:data.game,visible:data.visible};if(data.visible&&sig!==lastSent){msg.scene=data.scene||{ready:false};lastSent=sig;}const r=await send(msg);if(r.ok){render(r.data);if(r.data.needScene)lastSent='';}}catch{host.style.display=/^\/game\//.test(location.pathname)?'block':'none';$('track').textContent='扩展连接已断开';$('status').textContent='更新扩展后请刷新游戏标签页';$('body').classList.remove('hidden');}finally{sending=false;}}
 setInterval(tick,1000);document.addEventListener('visibilitychange',tick);window.addEventListener('pagehide',()=>send({type:'heartbeat',game:false,visible:false}).catch(()=>{}));void tick();
})();
