import test from 'node:test';
import assert from 'node:assert/strict';
import {OperationTracker} from '../ui-state.js';
import {PreviewStore} from '../preview-store.js';
import {STORAGE_KEY,DEMO_ADDRESS,buildDemoCollection,claimable} from '../domain.js';
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
  await b.withResources(['nft:128'],()=>b.commit(topup(128,1),'initial'));
  gate.resolve();await rejected;
  await b.withResources(['nft:444'],()=>b.commit(topup(444,1),'initial'));
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
  await assert.rejects(a.commit(topup(444,1),epoch),/reset in another tab/);assert.equal(a.read().events.length,0);
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
  await assert.rejects(a.commit(topup(444,1),'initial'),/history is full/);assert.equal(a.read().events.length,1000);
  storage.setItem(STORAGE_KEY,JSON.stringify([{type:'claim',ids:[444]}]));
  await a.commit(topup(444,1),'initial');const n=a.read().collection.find(n=>n.id===444);assert.equal(n.royaltiesCents,1250);assert.equal(n.claimedCents,18400);
});
test('unsupported locking fails closed without committing',async()=>{
  const store=new PreviewStore(new Storage(),null);await assert.rejects(store.commit(topup(444,1),'initial'),/cannot safely coordinate/);assert.equal(store.read().events.length,0);
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
