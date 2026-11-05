import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {IDBFactory} from 'fake-indexeddb';
const code=await readFile(new URL('../extension/offscreen.js',import.meta.url),'utf8');
test('双音轨交叉淡入淡出、立即暂停、续播与租期失效保护',async()=>{
 const indexedDB=new IDBFactory();await new Promise(res=>{const r=indexedDB.open('omni-bgm',1);r.onupgradeneeded=()=>['tracks','blobs','cache'].forEach(s=>r.result.createObjectStore(s,{keyPath:'id'}));r.onsuccess=()=>{const tx=r.result.transaction('blobs','readwrite');['a','b'].forEach(id=>tx.objectStore('blobs').put({id,blob:new Blob(['tone'])}));tx.oncomplete=res;};});
 let listener,now=1000;const timers=new Map(),instances=[],events=[];let nextTimer=0;
 class FakeAudio{paused=true;currentTime=0;duration=20;volume=1;handlers={};constructor(){instances.push(this);}addEventListener(name,fn){this.handlers[name]=fn;}async play(){this.paused=false;this.handlers.loadedmetadata?.();}pause(){this.paused=true;}}
 vm.runInNewContext(code,{chrome:{runtime:{onMessage:{addListener:f=>listener=f},sendMessage:async m=>events.push(m)}},indexedDB,URL:{createObjectURL:()=>Math.random().toString(),revokeObjectURL:()=>{}},Audio:FakeAudio,Date:{now:()=>now},setInterval:(fn,ms)=>{timers.set(++nextTimer,{fn,ms});return nextTimer;},clearInterval:id=>timers.delete(id)});
 const send=m=>new Promise(r=>listener({target:'audio',...m},{},r));const ticks=ms=>[...timers.values()].filter(t=>t.ms===ms).forEach(t=>t.fn());
 await send({command:'play',id:'a',gain:1,volume:.6,fade:2,position:3,until:10000});assert.equal(instances[0].currentTime,3);assert.equal(instances[0].paused,false);
 await send({command:'play',id:'b',gain:1,volume:.6,fade:2,position:0,until:10000});assert.equal(instances[1].volume,0);now+=1000;ticks(40);assert.ok(Math.abs(instances[0].volume-.3)<.001);assert.ok(Math.abs(instances[1].volume-.3)<.001);
 await send({command:'pause'});assert.ok(instances.every(a=>a.paused));instances[1].currentTime=5;await send({command:'lease',volume:.5,until:5000});assert.equal(instances[1].paused,false);assert.equal(instances[1].currentTime,5);now=5001;ticks(250);assert.ok(instances.every(a=>a.paused));assert.ok(events.some(e=>e.event==='position'));
});
