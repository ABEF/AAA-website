import test from 'node:test';
import assert from 'node:assert/strict';
import {OperationTracker} from '../ui-state.js';
import {confirmedUpgrade,armUpgradeSound,queueUpgrade,transitionArtwork} from '../artworks.js';
import {PreviewStore} from '../preview-store.js';
import {STORAGE_KEY,DEMO_ADDRESS,buildDemoCollection,claimable,fundDemoRewards,DEMO_REWARD_ROUND,replayEvents,previouslyClaimed,activatePreview,getLevel} from '../domain.js';
import {WalletConnection} from '../wallet.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
class Storage {
  values=new Map(); fail=false;
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){if(this.fail)throw new Error('Storage full');this.values.set(key,value);}
  removeItem(key){this.values.delete(key);}
}
// Implements exclusive queues and nonblocking ifAvailable semantics.
class Locks {
  held=new Map();
  async request(key,options,fn) {
    if(options.ifAvailable&&this.held.has(key))return fn(null);
    while(this.held.has(key))await this.held.get(key).promise;
    const gate=deferred();this.held.set(key,gate);
    try{return await fn({name:key});}finally{this.held.delete(key);gate.resolve();}
  }
}
const stores=()=>{const storage=new Storage(),locks=new Locks();return {storage,locks,a:new PreviewStore(storage,locks),b:new PreviewStore(storage,locks)};};
const topup=(id,amount)=>({type:'increase',id,amount,fundingAsset:'USDC'});

test('funding conserves holder allocation, equal collective and rarity royalties without changing LP or traits',()=>{
  const before=buildDemoCollection(),{collection:after,split,royaltyReceipt}=fundDemoRewards(before,{round:DEMO_REWARD_ROUND});
  const delta=key=>after.reduce((s,n,i)=>s+n[key]-before[i][key],0);
  assert.equal(delta('individualCents'),split.owner);assert.equal(delta('collectiveCents'),split.collective);assert.equal(delta('royaltiesCents'),royaltyReceipt);
  assert.equal(split.owner+split.collective+split.compound+split.buyback,86496);
  for(const [i,n] of after.entries()) {
    assert.deepEqual({...n,individualCents:before[i].individualCents,collectiveCents:before[i].collectiveCents,royaltiesCents:before[i].royaltiesCents},before[i]);
    if(!n.lockedCents)assert.equal(claimable(n),0);
  }
  const increments=after.filter(n=>n.lockedCents).map(n=>n.collectiveCents-before.find(b=>b.id===n.id).collectiveCents);
  assert.ok(Math.max(...increments)-Math.min(...increments)<=1);
  const a=before.findIndex(n=>n.id===128),b=before.findIndex(n=>n.id===444);
  assert.ok(after[a].individualCents-before[a].individualCents>after[b].individualCents-before[b].individualCents);
  assert.throws(()=>fundDemoRewards(before,{round:'other'}),/Unknown/);
});

test('fund once across concurrent tabs, preserving old claims and top-ups, and stay claimed after reload',async()=>{
  const {a,b}=stores();await a.commit({type:'claim',ids:[444,128],scope:'all'},'initial');await a.commit(topup(444,5),'initial');
  const before=a.read().collection.find(n=>n.id===444),past=previouslyClaimed(before);
  await Promise.all([a.ensureRewardRound(),b.ensureRewardRound()]);
  assert.equal(a.read().events.filter(e=>e.type==='fund-rewards').length,1);
  const funded=a.read().collection.find(n=>n.id===444);assert.ok(claimable(funded)>0);assert.equal(previouslyClaimed(funded),past);assert.equal(funded.lockedCents,before.lockedCents);
  await a.commit({type:'claim',ids:[444],scope:'all'},'initial');await b.ensureRewardRound();
  assert.equal(claimable(b.read().collection.find(n=>n.id===444)),0);
  assert.equal(previouslyClaimed(b.read().collection.find(n=>n.id===444)),past+claimable(funded));
  const events=a.read().events;assert.deepEqual(replayEvents([...events,{type:'fund-rewards',round:DEMO_REWARD_ROUND}]),a.read().collection);
});

test('later activation receives no past receipt; defaults retain four colors and evolution stages',()=>{
  const funded=fundDemoRewards(buildDemoCollection(),{round:DEMO_REWARD_ROUND}).collection;
  const defaults=funded.filter(n=>n.exampleOwned);
  assert.deepEqual(defaults.map(n=>getLevel(n.lockedCents)).sort(),['Dormant','Enhanced','Enhanced','Singularity']);
  assert.equal(new Set(defaults.map(n=>n.color)).size,4);assert.ok(defaults.some(n=>n.rarity==='legendary'));
  const after=activatePreview(funded,{id:74,amount:100,pool:'ZZZ/WETH'}).collection;
  assert.equal(claimable(after.find(n=>n.id===74)),0);
});

test('celebration requires confirmed LP growth and a real upward evolution',()=>{
  const args={action:'activate',confirmed:true,before:'Dormant',after:'Activated',previousLP:'0',currentLP:'10000'};
  assert.equal(confirmedUpgrade(args),true);
  assert.equal(confirmedUpgrade({...args,action:'increase',before:'Enhanced',after:'Singularity',previousLP:1200,currentLP:10000}),true);
  for(const delta of [{confirmed:false},{action:'approve'},{action:'claim'},{action:'wrap'},{before:'Unavailable'},{after:'Unavailable'},{previousLP:null},{currentLP:null},{currentLP:'0'},{currentLP:'bad'},{before:'Enhanced'},{before:'Activated'}])assert.equal(confirmedUpgrade({...args,...delta}),false);
});

test('ACTI/EV playback starts in the same frame as confirmed image reveal, once per NFT',async()=>{
  const events=[],frames=[],timers=new Map();let frame=0,timerId=0;
  const keys=['AudioContext','document','matchMedia','fetch','requestAnimationFrame','setTimeout','clearTimeout'];
  const saved=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const set=(k,value)=>Object.defineProperty(globalThis,k,{value,configurable:true,writable:true});
  class Audio {
    state='running';destination={};
    async decodeAudioData(bytes){const kind=new Uint8Array(bytes)[0];return {duration:kind===1?3.69:1.425,kind};}
    createBufferSource(){return {connect(){},disconnect(){},stop(){},start(){events.push({kind:this.buffer.kind,frame});}};}
    createGain(){return {gain:{},connect(){},disconnect(){}};}
  }
  const button=id=>({dataset:{artOwner:id},isConnected:true,append(){},classList:{add(){},remove(){}}});
  const previous={cloneNode:()=>({classList:{add:()=>events.push({reveal:true,frame})},setAttribute(){},remove(){}})};
  const next={complete:true,naturalWidth:10};
  const tick=()=>{frame++;for(const f of frames.splice(0))f();};
  try {
    set('AudioContext',Audio);set('document',{hidden:false});set('matchMedia',()=>({matches:true}));
    set('fetch',async url=>({ok:true,arrayBuffer:async()=>Uint8Array.of(String(url).includes('activation')?1:2).buffer}));
    set('requestAnimationFrame',fn=>frames.push(fn));set('setTimeout',fn=>{timers.set(++timerId,fn);return timerId;});set('clearTimeout',id=>timers.delete(id));
    await armUpgradeSound();
    queueUpgrade('7','activate');transitionArtwork(button('7'),previous,next);transitionArtwork(button('7'),previous,next);
    tick();assert.equal(events.length,0);tick();
    assert.equal(events.filter(e=>e.kind===1).length,1);assert.ok(events.every(e=>e.frame===2));
    queueUpgrade('8','increase');transitionArtwork(button('8'),previous,next);tick();tick();
    assert.equal(events.filter(e=>e.kind===2).length,1);assert.equal(events.at(-1).frame,4);
    const sounds=events.filter(e=>e.kind).length;
    transitionArtwork(button('9'),previous,next);tick();tick();assert.equal(events.filter(e=>e.kind).length,sounds,'ordinary refresh is silent');
    queueUpgrade('10','claim');transitionArtwork(button('10'),previous,next);tick();tick();assert.equal(events.filter(e=>e.kind).length,sounds,'claims cannot schedule sound');
  }finally{for(const [k,v] of Object.entries(saved))if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}
});

test('unchanged snapshot is reused immutably; external writes and resets invalidate it',async()=>{
  const {a,b}=stores(),first=a.read();assert.equal(a.read(),first);
  assert.throws(()=>first.collection[0].lockedCents=1,TypeError);
  assert.throws(()=>first.events.push({type:'mint'}),TypeError);
  await b.commit(topup(444,100),'initial');const next=a.read();assert.notEqual(next,first);
  assert.equal(next.collection.find(n=>n.id===444).lockedCents,153200);assert.equal(a.read(),next);
  await b.reset();const reset=a.read();assert.notEqual(reset,next);assert.notEqual(reset.epoch,first.epoch);
});
test('cached state never conceals broken storage or a changed malformed log',()=>{
  const {a,storage}=stores();a.read();const original=storage.getItem.bind(storage);
  storage.getItem=()=>{throw Error('Storage denied');};assert.throws(()=>a.read(),/denied/);
  storage.getItem=original;storage.setItem(STORAGE_KEY,'broken');assert.throws(()=>a.read(),/unreadable/);
  storage.setItem(STORAGE_KEY,'[]');assert.equal(a.read().events.length,0);
});
test('large valid log is replayed once per version without changing legacy meaning',()=>{
  const {a,storage}=stores();storage.setItem(STORAGE_KEY,JSON.stringify(Array(1000).fill(topup(444,.01))));
  const first=a.read();for(let i=0;i<100;i++)assert.equal(a.read(),first);
  assert.equal(first.collection.find(n=>n.id===444).lockedCents,144200);
});
test('expired action cannot commit after background suspension; cancellation preserves newer locks',async()=>{
  const {a}=stores();let now=0;const t=new OperationTracker(()=>1,{clock:()=>now});
  const expired=t.begin(['nft:444'],'increase');now=15000;
  await assert.rejects(a.commit(topup(444,5),'initial',()=>t.assertCurrent(expired)),/expired/);
  assert.equal(a.read().events.length,0);t.cancelAll();
  const newer=t.begin(['nft:444'],'claim');t.finish(expired);assert.equal(t.get('nft:444'),newer);
  t.cancelAll();assert.throws(()=>t.assertCurrent(newer),/no longer current/);
});

test('independent NFT actions run together; overlapping batch acquires no partial resources',()=>{
  const t=new OperationTracker(()=>1),a=t.begin(['nft:444'],'increase'),b=t.begin(['nft:128'],'claim');
  assert.throws(()=>t.begin(['nft:91','nft:444'],'claim'),/already pending/);
  assert.equal(t.get('nft:91'),undefined);assert.equal(t.get('nft:128'),b);
  t.finish(a);assert.equal(t.get('nft:444'),undefined);assert.equal(t.get('nft:128'),b);
  t.finish(a);t.finish(b);assert.equal(t.pending.size,0);
});
test('account or chain round trip invalidates pending operation; old completion cannot release a new lock',()=>{
  let context=1;const t=new OperationTracker(()=>context),old=t.begin(['nft:444'],'claim');
  context+=2;assert.throws(()=>t.assertCurrent(old),/Wallet or network changed/);
  t.finish(old);const next=t.begin(['nft:444'],'increase');t.finish(old);assert.equal(t.get('nft:444'),next);
});
test('two tabs commit independent contributions without overwriting either',async()=>{
  const {a,b}=stores(),before=buildDemoCollection();
  await Promise.all([a.commit(topup(444,100),'initial'),b.commit(topup(128,200),'initial')]);
  const after=a.read();assert.equal(after.events.length,2);
  for(const [id,value] of [[444,100],[128,200]])assert.equal(after.collection.find(n=>n.id===id).lockedCents,before.find(n=>n.id===id).lockedCents+value*100);
});
test('same NFT sequential contributions accumulate against latest state',async()=>{
  const {a,b}=stores();await Promise.all([a.commit(topup(444,100),'initial'),b.commit(topup(444,200),'initial')]);
  assert.equal(a.read().collection.find(n=>n.id===444).lockedCents,173200);
});
test('competing claims never credit the same funded balance twice',async()=>{
  const {a,b}=stores(),event={type:'claim',ids:[444],scope:'all'};
  const outcomes=await Promise.allSettled([a.commit(event,'initial'),b.commit(event,'initial')]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(a.read().events.length,1);
  const nft=a.read().collection.find(n=>n.id===444);assert.equal(claimable(nft),0);assert.equal(nft.claimedCents+nft.royaltiesClaimedCents,19650);
});
test('cross-tab resource lock rejects conflicting NFT action, allows another, releases after failure',async()=>{
  const {a,b}=stores(),gate=deferred(),ready=deferred();
  const running=a.withResources(['nft:444'],async()=>{ready.resolve();await gate.promise;throw new Error('Cancelled');});
  const rejected=assert.rejects(running,/Cancelled/);await ready.promise;
  await assert.rejects(b.withResources(['nft:444'],()=>assert.fail()),/another tab/);
  await b.withResources(['nft:128'],()=>b.commit(topup(128,5),'initial'));
  gate.resolve();await rejected;
  await b.withResources(['nft:444'],()=>b.commit(topup(444,5),'initial'));
});
test('batch cross-tab conflict releases previously acquired resources',async()=>{
  const {a,b}=stores(),gate=deferred(),ready=deferred();
  const running=a.withResources(['nft:444'],async()=>{ready.resolve();await gate.promise;});await ready.promise;
  await assert.rejects(b.withResources(['nft:128','nft:444'],()=>assert.fail()),/another tab/);
  await b.withResources(['nft:128'],()=>{});gate.resolve();await running;
});
test('concurrent mints allocate different NFT and artwork inventory IDs',async()=>{
  const {a,b}=stores();const [one,two]=await Promise.all([a.commit({type:'mint'},'initial'),b.commit({type:'mint'},'initial')]);
  assert.notEqual(one.nft.id,two.nft.id);assert.notEqual(one.nft.inventoryId,two.nft.inventoryId);assert.equal(a.read().collection.length,102);
});
test('reset invalidates a pending action even when the log was already empty',async()=>{
  const {a,b}=stores(),epoch=a.read().epoch;await b.reset();
  await assert.rejects(a.commit(topup(444,5),epoch),/reset in another tab/);assert.equal(a.read().events.length,0);
});
test('failed storage write never returns success or changes canonical preview state',async()=>{
  const {a,storage}=stores();storage.fail=true;
  await assert.rejects(a.commit(topup(444,10),'initial'),/Storage full/);assert.equal(a.read().collection.find(n=>n.id===444).lockedCents,143200);
});
test('context is rechecked inside the event lock after waiting',async()=>{
  const {a,locks}=stores(),gate=deferred(),ready=deferred();let valid=true;
  const blocker=locks.request(`${STORAGE_KEY}:events`,{},async()=>{ready.resolve();await gate.promise;});await ready.promise;
  const pending=a.commit(topup(444,10),'initial',()=>{if(!valid)throw new Error('context changed');});
  valid=false;gate.resolve();await blocker;await assert.rejects(pending,/context changed/);assert.equal(a.read().events.length,0);
});
test('corrupt, oversized and full logs fail explicitly, without deleting legacy events',async()=>{
  const {a,storage}=stores();storage.setItem(STORAGE_KEY,'broken');assert.throws(()=>a.read(),/unreadable/);
  storage.setItem(STORAGE_KEY,JSON.stringify(Array(1001).fill({})));assert.throws(()=>a.read(),/invalid/);
  storage.setItem(STORAGE_KEY,JSON.stringify(Array(1000).fill(topup(444,.01))));
  await assert.rejects(a.commit(topup(444,5),'initial'),/history is full/);assert.equal(a.read().events.length,1000);
  storage.setItem(STORAGE_KEY,JSON.stringify([{type:'claim',ids:[444]}]));
  await a.commit(topup(444,5),'initial');const n=a.read().collection.find(n=>n.id===444);assert.equal(n.royaltiesCents,1250);assert.equal(n.claimedCents,18400);
});
test('unsupported locking fails closed without committing',async()=>{
  const store=new PreviewStore(new Storage(),null);await assert.rejects(store.commit(topup(444,5),'initial'),/cannot safely coordinate/);assert.equal(store.read().events.length,0);
});
test('demo connection restores across reload and explicit disconnect clears it',async()=>{
  const storage=new Storage(),a=new WalletConnection(()=>{},storage);a.connectDemo(DEMO_ADDRESS);
  const b=new WalletConnection(()=>{},storage);assert.equal(await b.restore(),true);assert.equal(b.state.address,DEMO_ADDRESS);
  b.disconnect();assert.equal(await new WalletConnection(()=>{},storage).restore(),false);
});
test('browser restoration reads public account state only and rejects ambiguous provider',async()=>{
  const storage=new Storage(),calls=[],provider={request:async({method})=>{calls.push(method);return method==='eth_chainId'?'0x1':[DEMO_ADDRESS];}};
  await new WalletConnection(()=>{},storage).connect(provider,'Wallet','wallet.example');calls.length=0;
  const b=new WalletConnection(()=>{},storage),p={provider,name:'Wallet',id:'wallet.example'};
  assert.equal(await b.restore([p,p]),false);assert.deepEqual(calls,[]);
  assert.equal(await b.restore([p]),true);assert.deepEqual(calls,['eth_accounts','eth_chainId']);
});
test('late connect or restore result cannot resurrect a disconnected wallet',async()=>{
  const storage=new Storage(),gate=deferred(),wallet=new WalletConnection(()=>{},storage);
  const provider={request:async({method})=>method==='eth_chainId'?'0x1':gate.promise};
  const pending=wallet.connect(provider);wallet.disconnect();gate.resolve([DEMO_ADDRESS]);
  await assert.rejects(pending,/Connection changed/);assert.equal(wallet.state,null);
  await wallet.connect({request:async({method})=>method==='eth_chainId'?'0x1':[DEMO_ADDRESS]},'Wallet','wallet');
  const restoreGate=deferred(),b=new WalletConnection(()=>{},storage);
  const restoring=b.restore([{id:'wallet',name:'Wallet',provider:{request:async({method})=>method==='eth_chainId'?'0x1':restoreGate.promise}}]);
  b.disconnect();restoreGate.resolve([DEMO_ADDRESS]);assert.equal(await restoring,false);assert.equal(b.state,null);
});
test('account and chain events invalidate pending operations even when changed back',async()=>{
  const handlers=new Map(),wallet=new WalletConnection(()=>{},new Storage());
  const provider={request:async({method})=>method==='eth_chainId'?'0x1':[DEMO_ADDRESS],on:(e,h)=>handlers.set(e,h),removeListener:(e)=>handlers.delete(e)};
  await wallet.connect(provider);const tracker=new OperationTracker(()=>wallet.revision),op=tracker.begin(['nft:444'],'claim');
  handlers.get('chainChanged')('0x2');handlers.get('chainChanged')('0x1');assert.throws(()=>tracker.assertCurrent(op),/Wallet or network/);
  tracker.finish(op);const next=tracker.begin(['nft:444'],'increase');handlers.get('accountsChanged')(['0x'+'1'.repeat(40)]);handlers.get('accountsChanged')([DEMO_ADDRESS]);assert.throws(()=>tracker.assertCurrent(next),/Wallet or network/);
});

test('authorized second account selection survives reload without a permission prompt',async()=>{
  const first='0x'+'9'.repeat(40),selected=DEMO_ADDRESS,store=new Storage(),calls=[];
  const provider={request:async({method})=>{calls.push(method);return method==='eth_chainId'?'0x7a69':[first,selected];}};
  const before=new WalletConnection(()=>{},store);
  before.attach(provider,[first,selected],'0x7a69','MetaMask','io.metamask',selected);
  const after=new WalletConnection(()=>{},store);
  assert.equal(await after.restore([{provider,name:'MetaMask',id:'io.metamask'}]),true);
  assert.equal(after.state.address,selected);assert.deepEqual(after.accounts,[first,selected]);
  assert.deepEqual(calls,['eth_accounts','eth_chainId']);
});
test('authorized account attachment rejects a selection absent from the returned accounts',()=>{
  const wallet=new WalletConnection(()=>{},new Storage()),other='0x'+'9'.repeat(40);
  assert.throws(()=>wallet.attach({},[DEMO_ADDRESS],'0x7a69','Wallet','wallet',other),/not authorized/);
  assert.equal(wallet.state,null);
});
