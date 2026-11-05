import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeConfig,choose,normalize,hash,fitText,validEndpoint} from './built/core.js';
import {providerRequest,parseProvider,classify} from './built/providers.js';
const config=()=>mergeConfig({});
const track=(id,extra={})=>({id,name:id,moods:['tension'],tags:[],exclude:[],gain:1,intensity:-1,...extra});
test('排除标签优先；已适合的曲目保持；下一首避开当前曲目',()=>{
 const d={mood:'tension',intensity:2,tags:['潜入']};const ts=[track('a'),track('b',{tags:['潜入']}),track('c',{tags:['潜入'],exclude:['潜入']})];
 assert.equal(choose(ts,d,'b',[]).id,'b');assert.equal(choose(ts,d,'b',[],true).id,'a');assert.equal(choose([track('a')],d,'a',[],true).id,'a');assert.equal(choose([track('c',{deleted:true})],d,'',[]),undefined);
});
test('同分曲目轮换避免刚播放过的重复选中',()=>{const ts=['a','b','c'].map(id=>track(id));assert.equal(choose(ts,{mood:'tension',intensity:1,tags:[]},'a',['a','b'],true).id,'c');});
test('结构验证拒绝未知类别和不合法强度，过滤未知标签',()=>{assert.throws(()=>normalize({mood:'fake',intensity:1},config()));assert.throws(()=>normalize({mood:'tension',intensity:'abc'},config()));assert.deepEqual(normalize({mood:'tension',intensity:2,tags:['潜入','fake']},config()).tags,['潜入']);});
test('缓存指纹区分世界线、正文与模型配置',async()=>{assert.notEqual(await hash(['world-a','story']),await hash(['world-b','story']));assert.notEqual(await hash(['world-a','story']),await hash(['world-a','story edited']));});
test('超长文本保留头尾，普通文本不截断',()=>{assert.equal(fitText('short',100),'short');const s=fitText('start'+'x'.repeat(1000)+'end',100);assert.ok(s.startsWith('start'));assert.ok(s.endsWith('end'));});
test('API 限定 HTTPS 或本地 HTTP，不允许凭据混入 URL',()=>{assert.equal(validEndpoint('http://localhost:11434/v1'),'http://localhost:11434/*');assert.throws(()=>validEndpoint('http://example.com/v1'));assert.throws(()=>validEndpoint('https://user:secret@example.com'));});
test('兼容 API 只发当前状态，不携带整个曲库；自定义模式不添加厂商参数',()=>{const c=config();c.backend='custom';c.profiles.custom={base:'https://api.example.com/v1',model:'my-model',key:'',format:''};const r=providerRequest(c,{story:'test'});assert.equal(r.url,'https://api.example.com/v1/chat/completions');assert.equal(r.body.thinking,undefined);assert.equal(r.body.response_format,undefined);assert.equal(r.body.max_tokens,220);});
test('Jev 合并多个问题在同一请求，并独立解析概率',()=>{const c=config();c.backend='jev';const r=providerRequest(c,{story:'test'});assert.equal(r.url,'https://api.typesafe.ai/v1/systemone');assert.equal(r.body.state.story,'test');assert.equal(r.body.questions.mood.type,'choice');assert.equal(r.body.questions.intensity.type,'score');const d=parseProvider(c,{answers:{mood:{choice:'tension',confidence:.8},intensity:{score:2},tag3:{noul:.9}}});assert.equal(d.mood,'tension');assert.deepEqual(d.tags,['潜入']);});
test('Jev 只生成剧情分类问题，不请求音乐说明转换',()=>{const c=config();c.backend='jev';const r=providerRequest(c,{story:'休息'});assert.ok(r.body.questions.intensity);assert.ok(!Object.keys(r.body.questions).some(k=>k.startsWith('exclude')));});
test('HTTP 失败不重试、不切换后端，重定向禁止携带密钥',async()=>{const old=globalThis.fetch;let calls=0;globalThis.fetch=async(url,opts)=>{calls++;assert.ok(url.includes('deepseek'));assert.equal(opts.redirect,'error');return {ok:false,status:429};};try{const c=config();c.profiles.deepseek.key='test';await assert.rejects(classify(c,{story:'test'},new AbortController().signal),/429/);assert.equal(calls,1);}finally{globalThis.fetch=old;}});
