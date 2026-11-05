import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {IDBFactory} from 'fake-indexeddb';
import {upgradeConfig,signature} from './built/profiles.js';
import {familyHint,deployment,modelLabel} from './built/model-display.js';
const wait=async f=>{for(let n=0;n<150;n++){if(f())return;await new Promise(r=>setTimeout(r,5));}throw Error('UI timeout');};
async function setup(t){
 const dom=new JSDOM(await readFile(new URL('../extension/options.html',import.meta.url),'utf8'),{url:'https://ui-test.invalid',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window;w.indexedDB=new IDBFactory();w.structuredClone=structuredClone;w.scrollTo=()=>{};w.AbortController=AbortController;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 let config=upgradeConfig(undefined),permit=true,fetches=0;const writes=[];
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
 assert.equal(x.config.tasks.scene,'');await click('[data-action=addServiceModel]');
 await click('[data-action=fetchModels]');assert.equal(x.fetches,1);await click('[data-action=useFetched]');
 assert.equal(el('#modelId').value,'deepseek-test');assert.match(el('#modelName').value,/DeepSeek/);assert.equal(el('#modelFamily').value,'DeepSeek');
 await click('[data-action=saveModel]');assert.equal(x.config.models.length,1);assert.equal(x.config.tasks.scene,'');
 change('#sceneModel',x.config.models[0].id);await click('[data-action=saveTasks]');
 assert.equal(x.config.tasks.scene,x.config.models[0].id);assert.equal(x.fetches,1);
 await click('[data-action=editModel]');fill('#modelName','取消的重命名');await click('#dialog [data-action=close]');
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
