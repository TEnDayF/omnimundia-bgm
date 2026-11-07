import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {IDBFactory} from 'fake-indexeddb';
import {upgradeConfig,signature} from './built/profiles.js';
import {familyHint,deployment,modelLabel} from './built/model-display.js';
const wait=async f=>{for(let n=0;n<150;n++){if(f())return;await new Promise(r=>setTimeout(r,5));}throw Error('UI timeout');};
async function setup(t,initial){
 const dom=new JSDOM(await readFile(new URL('../extension/options.html',import.meta.url),'utf8'),{url:'https://ui-test.invalid',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window;w.indexedDB=new IDBFactory();w.structuredClone=structuredClone;w.scrollTo=()=>{};w.AbortController=AbortController;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 let config=upgradeConfig(initial),permit=true,fetches=0;const writes=[];
 w.chrome={runtime:{sendMessage:async m=>{if(m.type==='saveConfig'){writes.push(m.patch);config={...config,...structuredClone(m.patch)};}if(m.type==='readiness')return {ok:true,data:{version:'1.3.0',checks:[],targets:[]}};return {ok:true,data:m.type==='saveConfig'?config:{}};}},storage:{local:{get:async key=>key==='config'?{config}:{}}},permissions:{contains:async()=>permit,request:async()=>permit}};
 w.fetch=async()=>{fetches++;return {ok:true,json:async()=>({data:[{id:'deepseek-test'},{id:'Qwen/test'}]})};};
 w.eval(await readFile(new URL('../extension/options.js',import.meta.url),'utf8'));
 await wait(()=>w.document.querySelector('.nav'));
 const el=s=>{const e=w.document.querySelector(s);assert.ok(e,s);return e;};
 const click=async s=>{const e=el(s);e.click();await wait(()=>!e.disabled);};
 const fill=(s,v)=>{const e=el(s);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const change=(s,v)=>{const e=el(s);e.value=v;e.dispatchEvent(new w.Event('change',{bubbles:true}));};
 return {w,el,click,fill,change,writes,get config(){return config},get fetches(){return fetches},deny(){permit=false}};
}
test('统一添加流程：取消无配置副作用，获取列表填入草稿，保存与用途分配相互独立',async t=>{
 const x=await setup(t),{el,click,fill,change}=x;
 assert.equal(el('.nav').querySelectorAll('button').length,5);
 await click('.nav [data-id=settings]');await click('[data-action=newConnection]');
 fill('#connName','应取消的服务');await click('#dialog [data-action=close]');assert.equal(x.writes.length,0);
 await click('[data-action=newConnection]');fill('#connName','我的本地服务');fill('#base','http://localhost:1234/v1');change('#auth','none');
 await click('[data-action=saveConnection]');assert.equal(x.config.connections.length,1);assert.equal(x.config.models.length,0);
 assert.equal(x.config.tasks.scene,'');await click('[data-action=newModel]');
 await click('[data-action=fetchModels]');assert.equal(x.fetches,1);await click('[data-action=useFetched]');
 assert.equal(el('#modelId').value,'deepseek-test');assert.match(el('#modelName').value,/DeepSeek/);assert.equal(el('#modelFamily').value,'DeepSeek');
 await click('[data-action=saveModel]');assert.equal(x.config.models.length,1);assert.equal(x.config.tasks.scene,'');
 change('#sceneModel',x.config.models[0].id);await click('[data-action=saveTasks]');
 assert.equal(x.config.tasks.scene,x.config.models[0].id);assert.equal(x.fetches,1);
 fill('#modelName','取消的重命名');await click('[data-action=resetModel]');
 assert.notEqual(x.config.models[0].name,'取消的重命名');await click('[data-action=newModel]');fill('#modelId','discarded');await click('#dialog [data-action=close]');assert.equal(x.config.models.length,1);
});
test('权限拒绝：保留草稿与常驻错误，不创建服务、不请求模型',async t=>{
 const x=await setup(t);x.deny();await x.click('.nav [data-id=settings]');await x.click('[data-action=newConnection]');
 x.fill('#connName','测试服务');x.fill('#base','https://example.invalid/v1');await x.click('[data-action=saveConnection]');
 assert.equal(x.config.connections.length,0);assert.equal(x.el('#connName').value,'测试服务');assert.equal(x.el('#dialogError').hidden,false);assert.match(x.el('#dialogError').textContent,/未获得/);assert.equal(x.fetches,0);
});
test('品牌只是提示，首次安装无品牌模板，旧配置完整保留，家族字段不影响缓存签名',()=>{
 assert.equal(familyHint('vendor/DeepSeek-R1'),'DeepSeek');assert.equal(familyHint('private-unknown'),'');assert.equal(deployment('http://localhost:1234'),'本机服务');
 assert.equal(modelLabel({name:'平台',model:'actual-id'},{name:'平台'}),'actual-id · 平台');
 assert.deepEqual(upgradeConfig(undefined).models,[]);
 const c=upgradeConfig({}),before=JSON.stringify(signature(c));c.models[0].family='自定义家族';assert.equal(JSON.stringify(signature(c)),before);
 assert.deepEqual(upgradeConfig(c),c);
});



test('新版页面：新建情绪不覆盖当前类别，弹窗没有重复字段 ID，整合页保存不发送模型请求',async t=>{
 const x=await setup(t),{click,fill,el}=x;
 await click('.nav [data-id=categories]');
 const oldName=x.config.moods[0].name;
 await click('[data-action=newMood]');
 const ids=[...x.w.document.querySelectorAll('[id]')].map(e=>e.id);
 assert.equal(new Set(ids).size,ids.length);
 fill('#dialogMoodName','新建测试类别');fill('#dialogMoodDesc','在测试的情境下使用');
 await click('#dialog [data-action=saveMood]');
 assert.equal(x.config.moods[0].name,oldName);
 assert.equal(x.config.moods.at(-1).name,'新建测试类别');
 assert.equal(el('#moodName').value,'新建测试类别');
 fill('#moodName','修改后的类别');await click('.nav [data-id=data]');await click('.nav [data-id=categories]');assert.equal(el('#moodName').value,'修改后的类别');await click('[data-action=saveMood]');
 assert.equal(x.config.moods.at(-1).name,'修改后的类别');
 await click('.nav [data-id=data]');fill('#fade','3');await click('[data-action=savePrefs]');
 assert.equal(x.config.fade,3);assert.equal(x.fetches,0);
 assert.ok(el('[data-action=pickBackup]'));assert.ok(el('[data-action=clearCache]'));assert.ok(el('[data-action=copyDiagnostics]'));
});


test('模型删除：当前模型受保护，取消无副作用，移入回收列表并可恢复，保留服务和当前绑定',async t=>{
 const x=await setup(t,{}),{click,el}=x;const services=JSON.stringify(x.config.connections),active=x.config.tasks.scene;
 await click('.nav [data-id=settings]');
 await click('[data-action=deleteModel]');assert.match(el('#pageError').textContent,/当前判断模型/);assert.ok(!x.config.models.find(m=>m.id===active).deleted);
 await click('[data-action=pickModel][data-id=local-model]');await click('[data-action=deleteModel]');await click('#dialog [data-action=close]');
 assert.ok(!x.config.models.find(m=>m.id==='local-model').deleted);
 await click('[data-action=deleteModel]');await click('[data-action=confirmDeleteModel]');
 assert.equal(x.config.models.find(m=>m.id==='local-model').deleted,true);assert.equal(x.w.document.querySelector('[data-action=pickModel][data-id=local-model]'),null);
 assert.equal(x.config.tasks.scene,active);assert.equal(JSON.stringify(x.config.connections),services);
 await click('[data-action=deletedModels]');await click('[data-action=restoreModel][data-id=local-model]');
 assert.equal(x.config.models.find(m=>m.id==='local-model').deleted,false);assert.equal(x.config.models.find(m=>m.id==='local-model').disabled,true);
 assert.equal(x.config.tasks.scene,active);assert.equal(x.fetches,0);
});

test('自定义标签：顶部入口可添加标签，保存不调用模型，情绪分类不变',async t=>{
 const x=await setup(t,{}),{click,fill,el}=x;const moods=JSON.stringify(x.config.moods);
 await click('.nav [data-id=categories]');await click('.main-head [data-action=editTags]');
 fill('#tags',x.config.tags.join('，')+'，森林，雨夜');await click('[data-action=saveTags]');
 assert.ok(x.config.tags.includes('森林'));assert.ok(x.config.tags.includes('雨夜'));assert.equal(JSON.stringify(x.config.moods),moods);assert.equal(x.fetches,0);
 assert.match(el('#notice').textContent,/自定义标签已保存/);
});

test('管理入口归属唯一，完整配置保留在上级页面，播放状态仍能刷新',async t=>{
 const x=await setup(t,{}),{click,el}=x;
 await wait(()=>el('#runtimeDetail').textContent.includes('还没有音乐播放'));
 assert.equal(x.w.document.querySelector('#readyChecks'),null);
 await click('.nav [data-id=settings]');
 for(const action of ['newConnection','newModel','saveTasks'])assert.equal(x.w.document.querySelectorAll('[data-action='+action+']').length,1);
 assert.equal(x.w.document.querySelector('[data-action=editModel]'),null);
 assert.equal(x.w.document.querySelectorAll('[data-action=editConnection]').length,x.config.connections.length);
 assert.equal(x.w.document.querySelector('[data-id=services]'),null);
 await click('.nav [data-id=categories]');assert.equal(x.w.document.querySelectorAll('[data-action=editTags]').length,1);
 await click('.nav [data-id=data]');
 for(const action of ['clearCache','restoreCache','saveCachePolicy','pruneCache','savePrefs','copyDiagnostics'])assert.equal(x.w.document.querySelectorAll('[data-action='+action+']').length,1);
 for(const id of ['playback','cache','services'])assert.equal(x.w.document.querySelector('[data-action=page][data-id='+id+']'),null);
 assert.ok(el('#cacheScope'));assert.ok(el('#cacheMax'));assert.ok(el('#readyChecks'));
 assert.equal(x.fetches,0);assert.equal(x.writes.length,0);
});
