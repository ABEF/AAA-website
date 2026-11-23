// NEW unit checks of the real portfolio/cancel controller ownership only.
// Small dependency seams below do not qualify constructor, native proofs or DTOs.
// No historical suite/helper is imported or executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DeploymentAPI} from '../deployment-api.js';

const OWNER='0x'+'1'.repeat(40),OTHER='0x'+'2'.repeat(40),NFT='0x'+'3'.repeat(40),HASH='0x'+'4'.repeat(64);
const deferred=()=>{let resolve;const promise=new Promise(value=>{resolve=value;});return {promise,resolve};};
const card=(id,owner)=>({token_id:id,owner,provenance:{block_hash:HASH}});
function waitOrAbort(signal,ready){
  return new Promise((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(Error('owned read aborted'));};
    if(signal.aborted)return abort();
    signal.addEventListener('abort',abort,{once:true});
    ready.then(()=>{signal.removeEventListener('abort',abort);resolve();});
  });
}
function harness(ids=['1','2']){
  const signals=[],earned=[],owners=new Map();
  const api=Object.assign(Object.create(DeploymentAPI.prototype),{
    manifest:{schema:1,chain_id:31337,contracts:{nft:{address:NFT}}},native:null,revision:0,active:null,
    protocol:async signal=>{signals.push(signal);return {provenance:{block_hash:HASH}};},
    snapshot:async value=>value,identity:async()=>{},provenance:async()=>{},validateEarnings:()=>{},
    nft:async(id,owner,signal)=>{signals.push(signal);owners.set(id,owner);return card(id,owner);},
    request:async(path,_body,signal)=>{
      signals.push(signal);
      if(path.startsWith('/v1/wallets/'))return {available:true,wallet:path.split('/')[3],nft_contract:NFT,count:ids.length,token_ids:[...ids],provenance:{block_hash:HASH}};
      const id=path.split('/')[3];earned.push(id);
      return {schema:1,chain_id:31337,scope:'nft',token_id:id,owner:owners.get(id),provenance:{block_hash:HASH}};
    }
  });
  return {api,signals,earned,owners};
}

test('NEW failing card aborts its pending sibling and publishes no portfolio',async()=>{
  const h=harness(),started=deferred(),failure=Error('first card failed');let aborted=0;
  h.api.nft=async(id,_owner,signal)=>{
    h.signals.push(signal);
    if(id==='1'){await started.promise;throw failure;}
    signal.addEventListener('abort',()=>{aborted++;},{once:true});started.resolve();
    await waitOrAbort(signal,new Promise(()=>{}));throw Error('unreachable');
  };
  await assert.rejects(h.api.portfolio(OWNER),error=>error===failure);
  assert.equal(aborted,1);assert.ok(h.signals.every(signal=>signal.aborted));
  assert.deepEqual(h.earned,[]);assert.equal(h.api.active,null);
});

test('NEW successful portfolio closes its controller after all card reads settle',async()=>{
  const h=harness();const result=await h.api.portfolio(OWNER);
  assert.equal(result.nfts.length,2);assert.deepEqual(h.earned,['1','2']);
  assert.ok(h.signals.length>=6&&h.signals.every(signal=>signal.aborted));
  assert.equal(h.api.active,null);assert.equal(result.inventory.wallet,OWNER);
});

test('NEW one failing API instance cannot abort a concurrent independent instance',async()=>{
  const first=harness(['1']),second=harness(['1']),a=deferred(),b=deferred(),aStarted=deferred(),bStarted=deferred();
  first.api.nft=async(_id,_owner,signal)=>{first.signals.push(signal);aStarted.resolve();await waitOrAbort(signal,a.promise);throw Error('first instance failed');};
  second.api.nft=async(id,owner,signal)=>{second.signals.push(signal);second.owners.set(id,owner);bStarted.resolve();await waitOrAbort(signal,b.promise);return card(id,owner);};
  const pa=first.api.portfolio(OWNER),pb=second.api.portfolio(OTHER);pa.catch(()=>{});pb.catch(()=>{});
  await Promise.all([aStarted.promise,bStarted.promise]);a.resolve();await assert.rejects(pa,/first instance failed/);
  assert.ok(first.signals.every(signal=>signal.aborted));assert.ok(second.signals.every(signal=>!signal.aborted));
  b.resolve();assert.equal((await pb).inventory.wallet,OTHER);assert.ok(second.signals.every(signal=>signal.aborted));
});

test('NEW account cancellation aborts only its own instance',async()=>{
  const first=harness(['1']),second=harness(['1']),a=deferred(),b=deferred(),aStarted=deferred(),bStarted=deferred();
  for(const [h,ready,started]of [[first,a,aStarted],[second,b,bStarted]])h.api.nft=async(id,owner,signal)=>{
    h.signals.push(signal);h.owners.set(id,owner);started.resolve();await waitOrAbort(signal,ready.promise);return card(id,owner);
  };
  const pa=first.api.portfolio(OWNER),pb=second.api.portfolio(OTHER);pa.catch(()=>{});pb.catch(()=>{});
  await Promise.all([aStarted.promise,bStarted.promise]);first.api.cancel();await assert.rejects(pa,/owned read aborted/);
  assert.ok(first.signals.every(signal=>signal.aborted));assert.ok(second.signals.every(signal=>!signal.aborted));
  b.resolve();assert.equal((await pb).inventory.wallet,OTHER);
});

test('NEW superseded portfolio cleanup cannot clear or abort its replacement',async()=>{
  const h=harness(['1']),oldStarted=deferred(),newStarted=deferred(),finish=deferred();let oldSignal,newSignal;
  h.api.nft=async(id,owner,signal)=>{
    h.signals.push(signal);h.owners.set(id,owner);
    if(owner===OWNER){oldSignal=signal;oldStarted.resolve();await waitOrAbort(signal,new Promise(()=>{}));}
    else{newSignal=signal;newStarted.resolve();await waitOrAbort(signal,finish.promise);}
    return card(id,owner);
  };
  const old=h.api.portfolio(OWNER);old.catch(()=>{});await oldStarted.promise;
  const current=h.api.portfolio(OTHER);current.catch(()=>{});await newStarted.promise;await assert.rejects(old,/owned read aborted/);
  assert.equal(oldSignal.aborted,true);assert.equal(newSignal.aborted,false);assert.equal(h.api.active.signal,newSignal);
  finish.resolve();assert.equal((await current).inventory.wallet,OTHER);assert.equal(newSignal.aborted,true);assert.equal(h.api.active,null);
});
