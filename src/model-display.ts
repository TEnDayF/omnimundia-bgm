import type {Connection,ModelProfile} from './profile-types';
// UI hints only: names never change the endpoint, protocol, or request model ID.
export function familyHint(id:string){
 const value=id.toLowerCase();
 for(const [pattern,name] of [[/deepseek/,'DeepSeek'],[/qwen/,'Qwen'],[/claude/,'Claude'],[/gemini/,'Gemini'],[/(^|[/_-])(gpt|o[134])([/_-]|$)/,'GPT'],[/llama/,'Llama'],[/\bjev\b/,'Jev']] as [RegExp,string][])if(pattern.test(value))return name;
 return '';
}
export function deployment(base:string){try{const host=new URL(base).hostname;return ['localhost','127.0.0.1','[::1]'].includes(host)?'本机服务':'在线／远程服务';}catch{return '地址未配置';}}
export function modelLabel(m:ModelProfile,p?:Connection){return `${(m.name===p?.name?m.model:m.name)||m.model||'未命名模型'} · ${p?.name||'服务未配置'}`;}
export function modelKind(p?:Connection){return p?.protocol==='systemone'?'结构化决策':'文本生成';}
