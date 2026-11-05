import {selectionExplanation,validateBindings} from './workflow';
import {upgradeConfig,resolve,signature,validateConnection,validateModel,headersFor} from './profiles';
import {DEFAULTS,mergeConfig,Config,Decision,Track,hash,choose,fitText} from './core';
import * as db from './db';
import {classify} from './providers';
let c:Config=mergeConfig({}), scenes=new Map<number,any>(),activeTab:number|null=null,epoch=0,controller:AbortController|null=null,creation:Promise<void>|null=null;
let state:any={status:'尚未启用',error:'',decision:null,trackId:'',trackName:'',position:0,history:[],cacheHits:0,requests:0,usage:[],key:'',pending:false,failures:{},configHold:[],attempted:{},cacheHoldNext:false,pinnedTab:null,startRequested:null,owner:null,source:null,resultSource:null,lastRequest:null,statusTime:Date.now(),explanation:null};
let attempt='',leaseBusy=false,cacheMaintenance=false,cacheEpoch=0;
const ready=(async()=>{await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});const old=(await chrome.storage.local.get('config')).config;c=upgradeConfig(old);if(old?.version!==2)await chrome.storage.local.set({configBackupV1:old||{},config:c});const saved=(await chrome.storage.session.get('runtime')).runtime;if(saved)state={...state,...saved,pending:false};})();
async function save(){await chrome.storage.session.set({runtime:state});}
async function patchConfig(p:any){c=mergeConfig({...c,...p});await chrome.storage.local.set({config:c});}
let observedStatus='';
function publicState(){if(state.status!==observedStatus){observedStatus=state.status;state.statusTime=Date.now();}const {failures,attempted,configHold,cacheHoldNext,owner,...visible}=state;let backend='未配置';try{backend=resolve(c).connection.name;}catch{}return {...visible,usage:state.usage.slice(-8),enabled:c.enabled,paused:c.paused,floating:c.floating,volume:c.volume,lockMood:c.lockMood,lockTrack:c.lockTrack,moods:c.moods,backend,floatPosition:c.floatPosition};}
async function readiness(){
 const tabs=await chrome.tabs.query({url:'https://omnimundia.cn/game/*'});const targets=tabs.filter(t=>t.url?.startsWith('https://omnimundia.cn/game/')||scenes.has(t.id)).map(t=>{const s=scenes.get(t.id);return {tabId:t.id,title:s?.title||t.title||'Omnimundia',connected:!!s&&s.game&&Date.now()-s.seen<6000,ready:!!s?.ready,world:s?.world||'',turn:s?.turn??null};});
 const tracks:Track[]=await db.all('tracks'),audio=new Set(await db.keys('blobs'));let modelError='',permission=false,modelId='',protocol='';try{const {model,connection}=resolve(c);modelId=model.model;protocol=connection.protocol;validateConnection(connection);validateModel(model,connection);headersFor(connection);permission=chrome.permissions?await chrome.permissions.contains({origins:[new URL(connection.base).origin+'/*']}):true;if(!permission)modelError='尚未授权所选接口来源';}catch(e){modelError=e.message;}
 const usable=tracks.filter(t=>!t.deleted&&audio.has(t.id)&&t.moods.some(id=>c.moods.some(m=>m.id===id&&!m.disabled))).length;
 const checks=[{name:'游戏页面',ok:targets.some(t=>t.connected),detail:!targets.length?'未发现打开的 Omnimundia 游玩页':targets.some(t=>t.connected)?'已收到页面连接信号':'页面已打开，但没有连接信号，请刷新游戏页并检查扩展网站访问权限'},{name:'自动配乐',ok:c.enabled,detail:c.enabled?'已开启':'未开启'},{name:'手动暂停',ok:!c.paused,detail:c.paused?'已暂停，点击开始可恢复':'未暂停'},{name:'模型与权限',ok:!modelError,detail:modelError||'配置和权限检查通过，尚不代表服务实际连通'},{name:'可用音乐',ok:usable>0,detail:`${usable} 首有音频且已分类；${tracks.filter(t=>!t.deleted).length} 首在曲库`}];
 return {version:chrome.runtime.getManifest?.().version||'1.2.0',checks,targets,usable,modelReady:!modelError,permission,modelId,protocol,pinnedTab:state.pinnedTab,allReady:checks.every(x=>x.ok)};
}
async function statusView(){const f=await foreground();if(!c.enabled)state.status='自动配乐未开启';else if(c.paused)state.status='已手动暂停';else if(!f)state.status=state.startRequested?'已准备开始，请返回选定游戏页面':state.pinnedTab?'等待固定游戏标签页回到前台':'等待前台游玩页面连接';else{state.source={tabId:f.tab,gameId:f.scene.gameId,title:f.scene.title||'Omnimundia',world:f.scene.world,turn:f.scene.turn};if(state.configHold.includes(JSON.stringify([f.scene.gameId,f.scene.world,f.scene.turn,f.scene.text])))state.status='配置或缓存已更新 · 点击开始或手动重判';else if(!f.scene.ready)state.status='等待剧情生成完成';}return publicState();}
async function diagnostics(){const r=await readiness(),v=await statusView();return {version:r.version,time:new Date().toISOString(),checks:r.checks,model:{id:r.modelId,protocol:r.protocol,permission:r.permission},game:{openTabs:r.targets.length,connectedTabs:r.targets.filter(t=>t.connected).length,turn:v.source?.turn??null},playback:{status:v.status,statusTime:v.statusTime,enabled:c.enabled,paused:c.paused,trackSelected:!!v.trackId,locked:!!(c.lockMood||c.lockTrack)},request:state.lastRequest,cacheHits:state.cacheHits,successfulResponses:state.requests};}
async function ensureAudio(){if(await chrome.offscreen.hasDocument())return;if(!creation)creation=chrome.offscreen.createDocument({url:'offscreen.html',reasons:[chrome.offscreen.Reason.AUDIO_PLAYBACK],justification:'播放用户本地导入的背景音乐并进行交叉淡入淡出'}).finally(()=>creation=null);await creation;}
async function audio(command:string,data:any={},create=false){if(create)await ensureAudio();if(!await chrome.offscreen.hasDocument())return;return chrome.runtime.sendMessage({target:'audio',command,...data});}
async function foreground(){const w=await chrome.windows.getLastFocused();if(!w.focused||w.state==='minimized')return null;const [t]=await chrome.tabs.query({active:true,windowId:w.id});if(!t?.id||(state.pinnedTab&&state.pinnedTab!==t.id))return null;const s=scenes.get(t.id);if(!s?.game||!s.visible||Date.now()-s.seen>4500)return null;return {tab:t.id,scene:s};}
async function gate(){await ready;const f=await foreground();const id=f?.tab??null;if(id!==activeTab){activeTab=id;epoch++;controller?.abort();controller=null;state.pending=false;attempt='';}if(f?.scene.gameId){const owner=JSON.stringify([f.scene.gameId,f.scene.world]);if(state.owner&&state.owner!==owner){
 // The site's displayed world identifier can change when a turn finishes.
 // Invalidate the decision, but only a different game may dispose the playing track.
 const previousGame=JSON.parse(state.owner)[0];
 epoch++;controller?.abort();state.pending=false;attempt='';state.key='';state.decision=null;
 if(previousGame!==f.scene.gameId){state.trackId='';state.trackName='';state.position=0;state.history=[];await audio('stop');}
 }state.owner=owner;}return f;}
function canPlay(){return c.enabled&&!c.paused;}
async function pause(){await audio('pause');}
async function lease(){if(leaseBusy)return;leaseBusy=true;try{const f=await gate();if(!f||!canPlay()){await pause();return;}if(state.trackId){await audio('lease',{until:Date.now()+4500,volume:c.volume},false);} }finally{leaseBusy=false;}}
async function playSelected(next=false){
 const f=await gate();if(!f||!canPlay())return;const expectedEpoch=epoch;
 const tracks:Track[]=await db.all('tracks');const live=tracks.filter(t=>!t.deleted);
 const d=c.lockMood?{mood:c.lockMood,intensity:1,tags:[]}:state.decision;
 let t=c.lockTrack?live.find(t=>t.id===c.lockTrack):d?choose(live,d,state.trackId,state.history,next):null;
 if(!t)t=live.find(t=>t.id===c.defaultTrack);
 if(expectedEpoch!==epoch)return;
 if(!t){state.explanation=selectionExplanation(live,d,state.trackId,'');state.trackId='';state.trackName='';state.status=state.error?'判断失败 · 默认静音':'没有匹配曲目 · 静音';await audio('stop');await save();return;}
 state.explanation=selectionExplanation(live,d,state.trackId,t.id,!!(c.lockTrack||c.lockMood));
 const same=t.id===state.trackId;const position=same&&!next?state.position:0;
 state.trackId=t.id;state.trackName=t.name;if(!same||next)state.history=[t.id,...state.history.filter(x=>x!==t.id)].slice(0,6);
 await ensureAudio();if(expectedEpoch!==epoch||!canPlay()||!(await foreground()))return;
 await audio('play',{id:t.id,gain:t.gain,volume:c.volume,fade:same&&!next?0:c.fade,position, restart:next,until:Date.now()+4500});await save();
}
async function recordUsage(u:any){state.requests++;state.usage.push(u);state.usage=state.usage.slice(-100);const old=(await chrome.storage.local.get('usage')).usage||{requests:0,input:0,output:0,unknown:0};old.requests++;old.input+=u.input||0;old.output+=u.output||0;if(u.input===null)old.unknown++;await chrome.storage.local.set({usage:old});}
async function analyze(force=false){
 if(cacheMaintenance)return;const cacheGeneration=cacheEpoch;
 const f=await gate();if(!f||!canPlay())return;
 if(c.lockTrack||c.lockMood){state.status='手动锁定';state.resultSource='manual';await playSelected();return;}
 const s=f.scene;const hold=JSON.stringify([s.gameId,s.world,s.turn,s.text]);if(state.cacheHoldNext){state.cacheHoldNext=false;if(!force){state.configHold.push(hold);await save();return;}}if(!force&&state.configHold.includes(hold))return;if(force)state.configHold=state.configHold.filter(x=>x!==hold);if(!s.ready){state.status='等待剧情生成完成';return;}
 const snapshot=JSON.parse(JSON.stringify(c)) as Config;try{resolve(snapshot);}catch{state.status='请先配置模型并分配剧情判断用途';state.error='打开 AI 配置 → 模型与服务，添加后在功能分配中选择。';await save();return;}const confSig=await hash(signature(snapshot));
 const key=await hash([s.gameId,s.world,s.turn,s.text,confSig]);
 if(!force&&key===state.key&&state.decision){if(!state.trackId||!await chrome.offscreen.hasDocument())await playSelected();return;}
 if(!force&&state.failures[key]){state.error=state.failures[key];state.status='本回合判断失败 · 点击重判可重试';return;}
 if(force)delete state.failures[key];
 if(!force&&key===attempt)return;
 controller?.abort();epoch++;const generation=epoch;const local=new AbortController();controller=local;attempt=key;state.error='';
 const cached=force?null:await db.get('cache',key);
 if(generation!==epoch)return;
 if(cached){state.resultSource='cache';state.decision=cached.decision;state.key=key;state.cacheHits++;state.status='已复用剧情判断';await playSelected();return;}
 const tracks:Track[]=await db.all('tracks');if(!tracks.some(t=>!t.deleted)){state.status='请先导入音乐';attempt='';return;}
 const previous=(await db.get('cache',`last:${s.gameId}:${s.world}`));
 const input:any={story:fitText(s.text,c.maxChars),context:s.context||''};
 if(previous&&previous.turn===s.turn-1)input.previous={mood:previous.decision.mood,intensity:previous.decision.intensity,tags:previous.decision.tags};
 if(generation!==epoch||cacheMaintenance||cacheGeneration!==cacheEpoch)return;
 if(!force&&state.attempted[key]){state.status='本回合已尝试请求，需手动重判';return;}
 state.attempted[key]=Date.now();const ids=Object.keys(state.attempted);if(ids.length>300)for(const id of ids.slice(0,ids.length-300))delete state.attempted[id];
 state.pending=true;state.status='正在判断情境';state.lastRequest={stage:'request',started:Date.now(),outcome:'pending',model:resolve(snapshot).model.model};await save();
 const timeout=setTimeout(()=>local.abort('timeout'),resolve(snapshot).connection.timeout*1000);
 try{
  const result=await classify(snapshot,input,local.signal);await recordUsage(result.usage);if(generation===epoch)state.lastRequest={stage:'complete',started:state.lastRequest?.started,finished:Date.now(),ms:result.usage.ms,outcome:'success',model:resolve(snapshot).model.model};
  if(cacheGeneration!==cacheEpoch)return;
  await db.put('cache',{id:key,decision:result.decision,time:Date.now(),gameId:s.gameId,world:s.world,turn:s.turn,title:s.title||'Omnimundia'});
  if(generation!==epoch)return;
  await db.put('cache',{id:`last:${s.gameId}:${s.world}`,turn:s.turn,decision:result.decision,gameId:s.gameId,world:s.world,title:s.title||'Omnimundia',time:Date.now()});
  await db.applyCachePolicy(c.cachePolicy);state.resultSource='model';state.key=key;state.decision=result.decision;state.status='情境已更新';await playSelected();
 }catch(e){if(generation===epoch){state.lastRequest={stage:e.stage||'request',started:state.lastRequest?.started,finished:Date.now(),outcome:'failed',code:local.signal.aborted?'timeout':e.code||'network',http:e.status||null,ms:e.ms||null,model:resolve(snapshot).model.model};state.error=local.signal.aborted?'判断已超时；可手动重试':String(e.message||e);state.failures[key]=state.error;state.status='判断失败 · 保持当前音乐';if(!state.trackId){state.decision=null;await playSelected();}}}
 finally{clearTimeout(timeout);if(generation===epoch){state.pending=false;controller=null;await save();}}
}
function invalidate(){epoch++;controller?.abort();controller=null;state.pending=false;attempt='';}
async function heartbeat(m:any,sender:chrome.runtime.MessageSender){
 const id=sender.tab?.id;if(!id)return;
 const prev=scenes.get(id);const s={...(prev||{}),...(m.scene||{}),visible:!!m.visible,game:!!m.game,seen:Date.now()};scenes.set(id,s);
 if(m.scene&&prev&&[prev.text,prev.world,prev.turn,prev.ready,prev.gameId].join('|')!==[s.text,s.world,s.turn,s.ready,s.gameId].join('|')&&activeTab===id)invalidate();
 await lease();const f=await foreground();if(f?.tab===id&&state.startRequested===id&&s.ready){state.startRequested=null;state.configHold=state.configHold.filter(x=>x!==JSON.stringify([s.gameId,s.world,s.turn,s.text]));state.cacheHoldNext=false;}if(f?.tab===id)void analyze().catch(e=>{state.error=e.message;});return {...await statusView(),needScene:!s.text};
}
async function control(cmd:string,value:any){
 if(cmd==='floatPosition'){if(value!==null&&(!Number.isFinite(value?.x)||!Number.isFinite(value?.y)))throw Error('无效位置');await patchConfig({floatPosition:value===null?undefined:{x:Math.max(0,Math.min(1,value.x)),y:Math.max(0,Math.min(1,value.y))}});return publicState();}
 if(cmd==='pinTab'){state.pinnedTab=value?Number(value):null;invalidate();await save();await lease();return statusView();}
 if(cmd==='start'){const r=await readiness();if(!r.modelReady)throw Error('请先完成模型配置与接口授权');if(!r.usable)throw Error('请先导入音频并为至少一首音乐分类');const target=value?Number(value):state.pinnedTab||r.targets.find(t=>t.connected)?.tabId;if(!target||!r.targets.some(t=>t.tabId===target&&t.connected))throw Error('尚未连接游戏页，请刷新该标签页');if(state.pinnedTab&&state.pinnedTab!==target)throw Error('请先解除或调整固定标签页');await patchConfig({enabled:true,paused:false});state.startRequested=target;await save();const f=await gate();if(f?.tab===target&&f.scene.ready){state.startRequested=null;state.configHold=state.configHold.filter(x=>x!==JSON.stringify([f.scene.gameId,f.scene.world,f.scene.turn,f.scene.text]));state.cacheHoldNext=false;void analyze();}return statusView();}

 if(cmd==='enabled'){await patchConfig({enabled:!!value});invalidate();}
 if(cmd==='paused'){await patchConfig({paused:!!value});if(value)invalidate();}
 if(cmd==='volume')await patchConfig({volume:Math.max(0,Math.min(1,Number(value)))});
 if(cmd==='floating')await patchConfig({floating:!!value});
 if(cmd==='lockMood'&&value&&!c.moods.some(m=>m.id===value&&!m.disabled))throw Error('所选情绪已停用');
 if(cmd==='lockMood'){await patchConfig({lockMood:String(value),lockTrack:''});invalidate();}
 if(cmd==='lockTrack'){await patchConfig({lockTrack:value?state.trackId:'',lockMood:''});invalidate();}
 if(cmd==='next'){await playSelected(true);return publicState();}
 if(cmd==='retry'){const f=await foreground();if(!f?.scene.ready)throw Error('请回到已完成剧情生成的游玩页再重判');if(state.pending)return publicState();attempt='';void analyze(true);return publicState();}
 await lease();void analyze();return publicState();
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{
 if(m.target==='audio')return;
 const task=async()=>{await ready;
  const internal=sender.url?.startsWith(chrome.runtime.getURL(''));
  const site=sender.tab&&sender.url?.startsWith('https://omnimundia.cn/');
  if(m.type==='heartbeat'&&site)return heartbeat(m,sender);
  if(m.type==='control'&&(internal||site))return control(m.command,m.value);
  if(m.type==='state'&&(internal||site))return statusView();
  if(m.type==='readiness'&&internal)return readiness();
  if((m.type==='mergeMood'||m.type==='toggleMood')&&internal){
   const from=c.moods.find(x=>x.id===m.from);if(!from)throw Error('类别不存在');let updated:Track[]=[],moods=c.moods.map(x=>({...x})),lockMood=c.lockMood;
   if(m.type==='mergeMood'){const to=c.moods.find(x=>x.id===m.to&&!x.disabled);if(!to||to.id===from.id)throw Error('请选择另一个启用的目标类别');updated=(await db.all('tracks')).filter(t=>t.moods.includes(from.id)).map(t=>({...t,moods:[...new Set(t.moods.map(id=>id===from.id?to.id:id))]}));moods=moods.map(x=>x.id===from.id?{...x,disabled:true}:x);if(lockMood===from.id)lockMood=to.id;}
   else{moods=moods.map(x=>x.id===from.id?{...x,disabled:!x.disabled}:x);if(moods.find(x=>x.id===from.id).disabled&&lockMood===from.id)lockMood='';}
   const next={...c,moods,lockMood};validateBindings(next);const archive=await db.changeLibrary(updated,[],{label:m.type==='mergeMood'?'合并情绪类别':'切换情绪类别启用状态',moods:c.moods,tags:c.tags,afterMoods:moods,afterTags:c.tags});try{await chrome.storage.local.set({config:next});c=next;}catch(e){await db.restoreLibrary(archive);throw e;}invalidate();state.key='';state.decision=null;state.configHold=[...scenes.values()].map(s=>JSON.stringify([s.gameId,s.world,s.turn,s.text]));await save();return c;
  }
  if(m.type==='restoreLibrary'&&internal){const meta=await db.restoreLibrary(String(m.id));if(meta?.moods){const ids=new Set(meta.moods.map(x=>x.id));c={...c,moods:[...meta.moods,...c.moods.filter(x=>!ids.has(x.id))],tags:[...new Set([...c.tags,...meta.tags||[]])]};if(!c.moods.some(x=>x.id===c.lockMood&&!x.disabled))c.lockMood='';await chrome.storage.local.set({config:c});}invalidate();state.key='';state.decision=null;state.configHold=[...scenes.values()].map(s=>JSON.stringify([s.gameId,s.world,s.turn,s.text]));await save();return c;}

  if(m.type==='diagnostics'&&internal)return diagnostics();
  if(m.type==='cacheInfo'&&internal)return db.cacheInfo();
  if((m.type==='clearCache'||m.type==='restoreCache')&&internal){
   if(cacheMaintenance)throw Error('缓存操作正在进行，请稍候');cacheMaintenance=true;cacheEpoch++;invalidate();state.cacheHoldNext=![...scenes.values()].some(s=>s.text);
   state.configHold=[...new Set([...state.configHold,...[...scenes.values()].filter(s=>s.text).map(s=>JSON.stringify([s.gameId,s.world,s.turn,s.text]))])].slice(-30);
   try{const count=m.type==='clearCache'?(m.policy?await db.applyCachePolicy(c.cachePolicy):await db.recycleCache(m.scope||'all')):await db.restoreCache(String(m.id));state.key='';state.decision=null;state.failures={};state.attempted={};state.cacheHits=0;state.error='';state.status=m.type==='clearCache'?'回合缓存已清除 · 等待新回合或手动重判':'缓存已恢复 · 等待新回合或手动重判';await save();return {count,...await db.cacheInfo()};}finally{cacheMaintenance=false;}
  }
  if(m.type==='recordUsage'&&internal){await recordUsage(m.usage);await save();return true;}
  if(m.type==='saveConfig'&&internal){const allowed=['connections','models','tasks','maxOutput','maxChars','moods','tags','enabled','floating','volume','fade','defaultTrack','cachePolicy'];const patch=Object.fromEntries(Object.entries(m.patch||{}).filter(([k])=>allowed.includes(k)));const next=upgradeConfig({...c,...patch});validateBindings(next);if(patch.cachePolicy){const p:any=patch.cachePolicy;if(!Number.isInteger(p.maxRounds)||p.maxRounds<0||p.maxRounds>100000||!Number.isInteger(p.days)||p.days<0||p.days>3650)throw Error('缓存策略数值无效');}await chrome.storage.local.set({config:next});c=next;invalidate();state.configHold=[...new Set([...state.configHold,...[...scenes.values()].map(s=>JSON.stringify([s.gameId,s.world,s.turn,s.text]))])].slice(-30);await save();await lease();if(state.decision)await playSelected();return c;}
  if(m.type==='settings'&&internal){c=upgradeConfig((await chrome.storage.local.get('config')).config);invalidate();state.configHold=[...new Set([...state.configHold,...[...scenes.values()].map(s=>JSON.stringify([s.gameId,s.world,s.turn,s.text]))])].slice(-30);await save();await lease();if(state.decision)await playSelected();return publicState();}
  if(m.type==='openSettings'&&(site||internal)){await chrome.runtime.openOptionsPage();return true;}
  if(m.type==='audioEvent'&&internal){
   if(m.id===state.trackId&&Number.isFinite(m.position))state.position=m.position;
   if(m.event==='ended')await playSelected(true);
   if(m.event==='error'){state.error='音频无法播放，请在曲库试听检查格式或文件';state.lastAudioError={time:Date.now(),code:'audio_decode'};state.status='播放失败';}
   await save();return true;
  }
  if(m.type==='library'&&internal){attempt='';if(m.changedId===state.trackId){const t=await db.get('tracks',state.trackId);if(!t||t.deleted){state.trackId='';state.trackName='';await audio('stop');}}if(state.decision)await playSelected();void analyze();return true;}
  throw Error('不支持的请求');
 };
 task().then(x=>respond({ok:true,data:x})).catch(e=>respond({ok:false,error:String(e.message||e)}));return true;
});
chrome.tabs.onActivated.addListener(()=>{void lease();});
chrome.tabs.onRemoved.addListener(id=>{if(state.pinnedTab===id)state.pinnedTab=null;scenes.delete(id);void lease();});
chrome.tabs.onUpdated.addListener((id,info)=>{if(info.url&&!info.url.startsWith('https://omnimundia.cn/game/')){scenes.delete(id);void lease();}});
chrome.windows.onFocusChanged.addListener(()=>{void lease();});
chrome.runtime.onInstalled.addListener(()=>{void ready.then(async()=>{if(!(await chrome.storage.local.get('config')).config)await patchConfig({});});});
