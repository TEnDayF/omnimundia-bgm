import {Config,mergeConfig,validEndpoint} from './core';
import type {Connection,ModelProfile} from './profile-types';
export function upgradeConfig(raw:any):Config{
 const c=mergeConfig(raw);if(raw==null){c.connections=[];c.models=[];c.tasks={scene:''};c.maxOutput=220;c.version=2;return c;}if(c.version===2&&c.connections&&c.models&&c.tasks){c.tasks={scene:c.tasks.scene};return c;}
 const names={deepseek:'DeepSeek 官方',local:'本机兼容服务',jev:'TypeSafe Jev',custom:'自定义兼容接口'};
 c.connections=Object.entries(c.profiles).map(([id,p]:[string,any])=>({id,name:names[id],protocol:id==='jev'?'systemone':'chat',base:p.base,key:p.key,auth:id==='local'&&!p.key?'none':'bearer',header:'x-api-key',prefix:'',path:id==='jev'?'/systemone':'/chat/completions',modelsPath:id==='jev'?'':'/models',timeout:c.timeout,headers:{}}));
 c.models=c.connections.map(p=>({id:p.id+'-model',connectionId:p.id,name:names[p.id],model:c.profiles[p.id].model,output:p.protocol==='systemone'?'typed':c.profiles[p.id].format==='json_object'?'json_object':'prompt',tokenField:p.protocol==='systemone'?'none':'max_tokens',stream:false,extra:{}}));
 c.tasks={scene:c.backend+'-model'};c.maxOutput=220;c.version=2;return c;
}
export function resolve(c:Config){
 const u=c.version===2?c:upgradeConfig(c),id=u.tasks.scene;
 const model=u.models.find(m=>m.id===id),connection=u.connections.find(p=>p.id===model?.connectionId);
 if(!model||!connection||model.disabled||connection.disabled)throw Error('当前没有有效的判断模型，请在 AI 设置中添加并选择模型');return {model,connection};
}
export function objectParams(value:any,reserved:string[]=[]){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('附加参数必须是 JSON 对象');for(const k of Object.keys(value))if(reserved.includes(k.toLowerCase()))throw Error('不能覆盖保留字段：'+k);return value;}
export function validateConnection(p:Connection){
 if(!p.name.trim())throw Error('连接名称不能为空');validEndpoint(p.base);
 if(!['chat','systemone'].includes(p.protocol))throw Error('尚未支持此协议');
 if(!['bearer','header','none'].includes(p.auth))throw Error('无效鉴权方式');
 for(const path of [p.path,p.modelsPath])if(path&&(!path.startsWith('/')||path.startsWith('//')||/[\\?#]/.test(path)))throw Error('接口路径必须是同源路径，不能含查询参数');
 if(!p.path)throw Error('请求路径不能为空');if(!Number.isFinite(p.timeout)||p.timeout<5||p.timeout>120)throw Error('超时应为 5–120 秒');
 if(p.auth==='header'&&(!/^[a-zA-Z0-9-]+$/.test(p.header)||['host','cookie','content-type'].includes(p.header.toLowerCase())))throw Error('鉴权请求头名称无效');
 objectParams(p.headers,['authorization','cookie','host','x-api-key',p.auth==='header'?p.header.toLowerCase():'']);
 for(const [k,v] of Object.entries(p.headers))if(!/^[a-zA-Z0-9-]+$/.test(k)||typeof v!=='string'||/[\r\n]/.test(v))throw Error('附加请求头必须是有效名称和单行字符串');
}
export function validateModel(m:ModelProfile,p:Connection){
 if(!m.name.trim()||!m.model.trim())throw Error('显示名称与模型 ID 不能为空');
 if(!['json_object','json_schema','prompt','typed'].includes(m.output)||!['max_tokens','max_completion_tokens','none'].includes(m.tokenField))throw Error('模型能力配置无效');
 if((p.protocol==='systemone')!==(m.output==='typed'))throw Error('Jev 需要类型化输出，聊天接口不能使用类型化输出');
 if(p.protocol==='systemone'&&m.stream)throw Error('Jev 不使用聊天 SSE');
 objectParams(m.extra,['messages','input','state','questions','model','authorization','api_key','url','base_url','stream','stream_options','max_tokens','max_completion_tokens','max_output_tokens','response_format','thinking','__proto__','constructor','prototype']);
}
export function headersFor(p:Connection){const headers:Record<string,string>={'Content-Type':'application/json',...p.headers};if(p.auth!=='none'){if(!p.key.trim())throw Error('请填写 API Key，或为本地服务选择无鉴权');headers[p.auth==='bearer'?'Authorization':p.header]=(p.auth==='bearer'?'Bearer ':p.prefix)+p.key.trim();}return headers;}
export function signature(c:Config){const {connection:p,model:m}=resolve(c);return [2,p.id,p.protocol,p.base,p.path,p.auth,p.header,p.prefix,p.headers,p.timeout,{...m,family:undefined},c.maxOutput||220,c.moods,c.tags,c.maxChars];}
export async function modelList(c:Config,connectionId:string,signal:AbortSignal){const p=c.connections.find(p=>p.id===connectionId);validateConnection(p);if(!p.modelsPath)throw Error('此服务没有配置模型列表路径，请手动填写模型 ID');const r=await fetch(p.base.replace(/\/$/,'')+p.modelsPath,{headers:headersFor(p),signal,redirect:'error'});if(!r.ok)throw Error('获取模型列表失败：HTTP '+r.status);const data=await r.json();const ids=(data.data||data.models||[]).map(x=>typeof x==='string'?x:x.id||x.name).filter(x=>typeof x==='string');if(!ids.length)throw Error('未识别到模型列表，请手动填写');return ids as string[];}
