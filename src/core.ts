import type {Connection,ModelProfile} from './profile-types';
export type Mood={id:string;name:string;description:string;disabled?:boolean};
export type Decision={mood:string;intensity:number;tags:string[];exclude?:string[];source?:string;confidence?:number};
export type Track={id:string;name:string;moods:string[];tags:string[];exclude:string[];description:string;gain:number;intensity:number;deleted?:boolean;size:number;type:string;fingerprint?:string};
export const MOODS:Mood[]=[['relax','休闲','安全、平静的日常活动'],['explore','探索','旅行、发现、调查未知环境'],['mystery','神秘','未知秘密或难以解释的异象'],['tension','紧张','危险逼近、戒备、尚未进入实际战斗'],['battle','战斗','正在发生的正面交战'],['victory','胜利','危险解除、成功、庆祝'],['sad','悲伤','失落、哀悼、离别'],['warm','温情','亲密、安慰、友善交流']].map(([id,name,description])=>({id,name,description}));
export const TAGS=['日常','旅行','调查','潜入','追逐','危险','正面战斗','悬疑','庆祝','离别','安慰','浪漫'];
export const DEFAULTS={enabled:false,paused:false,floating:true,volume:0.55,fade:2,defaultTrack:'',lockTrack:'',lockMood:'',backend:'deepseek',profiles:{deepseek:{base:'https://api.deepseek.com/v1',model:'deepseek-flash',key:'',format:'json_object'},local:{base:'http://localhost:11434/v1',model:'',key:'',format:'json_object'},jev:{base:'https://api.typesafe.ai/v1',model:'jev-latest',key:'',format:''},custom:{base:'',model:'',key:'',format:'json_object'}},moods:MOODS,tags:TAGS,maxChars:14000,timeout:30};
export type Config=typeof DEFAULTS & {version?:number;connections?:Connection[];models?:ModelProfile[];tasks?:{scene:string};maxOutput?:number;floatPosition?:{x:number;y:number};cachePolicy?:{maxRounds:number;days:number};};
export function mergeConfig(c:any):Config{return {...DEFAULTS,...c,profiles:Object.fromEntries(Object.entries(DEFAULTS.profiles).map(([k,v])=>[k,{...v,...c?.profiles?.[k]}]))} as Config;}
export function fitText(text:string,max:number){if(text.length<=max)return text;return text.slice(0,Math.floor(max*.35))+'\n[中间省略]\n'+text.slice(-Math.floor(max*.65));}
export async function hash(value:any){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function normalize(d:any,c:Config):Decision{
 if(!d||!c.moods.some(m=>m.id===d.mood&&!m.disabled)||!Number.isFinite(Number(d.intensity)))throw Error('模型返回了无效情绪或强度');
 return {mood:d.mood,intensity:Math.max(0,Math.min(3,Number(d.intensity))),tags:Array.isArray(d.tags)?d.tags.filter(x=>c.tags.includes(x)):[],exclude:Array.isArray(d.exclude)?d.exclude.filter(x=>c.tags.includes(x)):[],...(Number.isFinite(d.confidence)?{confidence:d.confidence}:{})};
}
export function rank(t:Track,d:Decision){if(t.deleted||!t.moods.includes(d.mood)||t.exclude.some(x=>d.tags.includes(x))||t.tags.some(x=>d.exclude?.includes(x)))return -Infinity;return 10+t.tags.filter(x=>d.tags.includes(x)).length*3-(t.intensity<0?0:Math.abs(t.intensity-d.intensity)*2);}
export function choose(tracks:Track[],d:Decision,current:string,history:string[],next=false){
 const candidates=tracks.map(t=>({t,s:rank(t,d)})).filter(x=>Number.isFinite(x.s));
 const existing=candidates.find(x=>x.t.id===current);const best=Math.max(...candidates.map(x=>x.s));
 if(!next&&existing&&existing.s>=best-2)return existing.t;
 const pool=candidates.filter(x=>!next||candidates.length===1||x.t.id!==current);
 pool.sort((a,b)=>(b.s-(history.includes(b.t.id)?2:0))-(a.s-(history.includes(a.t.id)?2:0)));
 return pool[0]?.t;
}
export function validEndpoint(base:string){const u=new URL(base);if(u.username||u.password||u.search||u.hash)throw Error('接口地址不能包含账号、查询参数或片段');if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error('远程接口必须使用 HTTPS；本机可使用 HTTP');return u.origin+'/*';}
