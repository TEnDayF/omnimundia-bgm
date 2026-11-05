import {get} from './db';
let current:any=null,outgoing:any=null,until=0,master=.55,generation=0,ramp:any=null;
function dispose(a:any){if(a){a.audio.pause();URL.revokeObjectURL(a.url);}}
function notify(event:string){if(current)void chrome.runtime.sendMessage({type:'audioEvent',event,id:current.id,position:current.audio.currentTime}).catch(()=>{});}
function pause(){until=0;generation++;clearInterval(ramp);dispose(outgoing);outgoing=null;if(current){current.audio.pause();current.audio.volume=Math.min(1,master*current.gain);notify('position');}}
async function play(m:any){
 const gen=++generation;until=m.until;master=m.volume;
 if(current?.id===m.id&&!m.restart){current.gain=m.gain;current.audio.volume=Math.min(1,master*m.gain);if(current.audio.paused)await current.audio.play();return;}
 const item=await get('blobs',m.id);if(gen!==generation||Date.now()>until)return;if(!item?.blob)throw Error('音频不存在');
 clearInterval(ramp);dispose(outgoing);outgoing=current;
 const a=new Audio();const url=URL.createObjectURL(item.blob);a.src=url;a.preload='auto';
 current={id:m.id,audio:a,url,gain:m.gain};a.volume=m.fade&&outgoing?0:Math.min(1,master*m.gain);
 a.addEventListener('loadedmetadata',()=>{if(m.position>0&&m.position<a.duration)a.currentTime=m.position;},{once:true});
 a.addEventListener('ended',()=>{if(current?.audio===a)notify('ended');});a.addEventListener('error',()=>notify('error'));
 try{await a.play();}catch(e){notify('error');throw e;}
 if(gen!==generation||Date.now()>until){a.pause();return;}
 if(outgoing&&m.fade){const start=Date.now(),old=outgoing,initial=old.audio.volume;ramp=setInterval(()=>{const p=Math.min(1,(Date.now()-start)/(m.fade*1000));a.volume=Math.min(1,master*m.gain*p);old.audio.volume=initial*(1-p);if(p===1){clearInterval(ramp);dispose(old);if(outgoing===old)outgoing=null;}},40);}else{dispose(outgoing);outgoing=null;}
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{if(m.target!=='audio')return;const run=async()=>{
 if(m.command==='play')await play(m);
 if(m.command==='pause')pause();
 if(m.command==='stop'){pause();dispose(current);current=null;}
 if(m.command==='lease'){until=m.until;master=m.volume;if(current){if(!outgoing)current.audio.volume=Math.min(1,master*current.gain);if(current.audio.paused)await current.audio.play();}}
 };run().then(()=>respond({ok:true})).catch(()=>respond({ok:false}));return true;});
setInterval(()=>{if(until&&Date.now()>until)pause();},250);
setInterval(()=>{if(current&&!current.audio.paused)notify('position');},2000);
