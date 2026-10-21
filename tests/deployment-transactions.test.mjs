import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './deployment-api.test.mjs';
import {DeploymentTransactions} from '../deployment-transactions.js';
import {DeploymentSession} from '../deployment-session.js';
const hash=c=>'0x'+c.repeat(64),word=n=>BigInt(n).toString(16).padStart(64,'0');
const addressWord=a=>a.slice(2).padStart(64,'0'),hex=n=>'0x'+BigInt(n).toString(16);
const TOPIC='0x0b7799b44b2fea7595e7c3227a0d4457e298ff7304e8068aaec078f1d4ed76e0';
const store=()=>{const items=new Map();return {getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v),removeItem:k=>items.delete(k)};};
function fixture(name='mint',options={}){
  const s=setup(name);s.nonce=0n;s.sent=[];s.receipt=null;s.transaction=null;s.walletChain='0x7a69';s.accounts=[s.f.nft.owner];
  const oldReader=s.reader.request;
  s.reader.request=async request=>{
    const {method,params=[]}=request;
    if(s.rpcFault===method)throw Error('provider unavailable');
    if(method==='eth_getTransactionCount')return hex(s.nonce);
    if(method==='eth_getBalance')return hex(10n**30n);
    if(method==='eth_gasPrice')return s.f.draft.network_gas.price_wei?hex(s.f.draft.network_gas.price_wei):'0x1';
    if(method==='eth_estimateGas')return hex(s.f.draft.network_gas.estimated_units);
    if(method==='eth_getTransactionReceipt')return s.receipt;
    if(method==='eth_getTransactionByHash')return s.transaction;
    if(method==='eth_call'&&params[0].to!==s.m.contracts.oracle.address)return '0x';
    return oldReader(request);
  };
  const listeners=new Map();s.events=(name,value)=>{for(const f of listeners.get(name)||[])f(value);};
  s.provider={on:(n,f)=>listeners.set(n,[...(listeners.get(n)||[]),f]),removeListener:(n,f)=>listeners.set(n,(listeners.get(n)||[]).filter(v=>v!==f)),request:async({method,params=[]})=>{
    if(method==='eth_accounts'||method==='eth_requestAccounts')return s.accounts;
    if(method==='eth_chainId')return s.walletChain;
    if(method==='eth_getBlockByNumber')return {hash:s.m.genesis_hash};
    if(method==='wallet_switchEthereumChain'){s.walletChain=params[0].chainId;s.events('chainChanged',s.walletChain);return null;}
    if(method==='eth_sendTransaction'){
      if(s.reject)throw Object.assign(Error('cancelled'),{code:4001});
      s.sent.push(params[0]);s.nonce++;const tx=params[0],txHash=hash('8');
      s.transaction={...tx,hash:txHash,input:tx.data,blockHash:hash('b'),blockNumber:'0x63',transactionIndex:'0x0'};
      s.receipt={transactionHash:txHash,transactionIndex:'0x0',blockHash:hash('b'),blockNumber:'0x63',from:tx.from,to:tx.to,status:s.revert?'0x0':'0x1',gasUsed:'0x5208',effectiveGasPrice:tx.gasPrice,logs:[]};
      if(tx.data.startsWith('0x35b13b87')){
        const c=s.f.draft;s.f.nft.position.activated=true;s.f.nft.position.shares_raw='1000';s.f.nft.position.evolution='activated';s.f.nft.position.current_lp_value.raw='99000000000000000000';
        s.receipt.logs=[{address:s.m.contracts.entry.address,blockHash:hash('b'),transactionHash:txHash,topics:[TOPIC,'0x'+addressWord(tx.from),'0x'+word(c.token_id),c.pool_id],data:'0x'+addressWord(c.source.asset)+word(c.source.amount_raw)+word(c.source.value_usd_18)+addressWord(s.m.contracts.vault.address)+word(100)+word(c.action==='increase'?1:0)}];
      }
      if(s.afterSend)await s.afterSend();
      if(s.lostResponse)throw Error('transport lost after submit');
      return txHash;
    }
    throw Error('Unexpected wallet method '+method);
  }};
  const stages=[],session=new DeploymentSession({storage:store(),key:'test',onChange:()=>{}});
  s.session=session;s.stages=stages;s.storage=options.storage||store();
  const held=new Set(),locks=options.locks||{request:async(key,_options,fn)=>{if(held.has(key))return fn(null);held.add(key);try{return await fn({name:key});}finally{held.delete(key);}}};
  s.coordinator=()=>new DeploymentTransactions(s.api,session,{walletOptions:{storage:s.storage,locks,clock:()=>s.now,monotonic:()=>s.now,receiptAttempts:1,pause:async()=>{},random:()=> 'reviewed-api-operation-0001'},onProgress:value=>stages.push(value)});
  s.start=async()=>{await session.connect({id:'test',provider:s.provider});s.flow=s.coordinator();return s;};
  return s;
}
for(const name of ['mint','activate_eth','activate_zzz','activate_usdc','activate_usdg','increase_zzz','increase_usdc_5','increase_eth_5','approve_usdc','approve_zzz','claim'])test('typed local API transaction confirms: '+name,async()=>{
  const s=await fixture(name).start(),review=await s.flow.prepare(s.intent);
  assert.equal(s.sent.length,0);assert.equal(review.signing_enabled,true);
  const result=await s.flow.submit(review);assert.equal(result.status,'confirmed',result.error);assert.equal(result.reconciled,true,result.error);assert.equal(s.sent.length,1);assert.equal(s.flow.pending(),null);
});
test('all nonlocal/nonloopback signing profiles reject; shared signer and public config unchanged',async()=>{
  const s=fixture();
  for(const update of [{environment:'production'},{chain_id:1},{rpc_url:'https://rpc.example.org'}])assert.throws(()=>new DeploymentTransactions({...s.api,manifest:{...s.m,...update}},s.session),/restricted/);
  assert.throws(()=>new DeploymentTransactions({...s.api,origin:'https://example.org'},s.session),/restricted/);
  const source=await readFile(new URL('../browser-wallet.js',import.meta.url),'utf8');assert.match(source,/quantity\(policy.chainId\)!==31337n/);
  assert.match(await readFile(new URL('../deployment-config.js',import.meta.url),'utf8'),/DEPLOYMENT = null/);
});
test('rejection clears only the unsent operation; a fresh review can continue',async()=>{
  const s=await fixture().start(),r=await s.flow.prepare(s.intent);s.reject=true;await assert.rejects(s.flow.submit(r),/cancelled/);assert.equal(s.flow.pending(),null);assert.equal(s.sent.length,0);s.reject=false;assert.equal((await s.flow.submit(await s.flow.prepare(s.intent))).status,'confirmed');
});
test('expiry, account changes and dependency mutation block before signing',async()=>{
  for(const mutate of [s=>s.now+=61000,s=>s.events('accountsChanged',[]),s=>s.codes[s.m.contracts.nft.address]='0x6001']){
    const s=await fixture().start(),r=await s.flow.prepare(s.intent);mutate(s);await assert.rejects(s.flow.submit(r));assert.equal(s.sent.length,0);
  }
});
test('wrong network requires explicit switch and fresh verified review',async()=>{
  const s=await fixture().start();s.walletChain='0x1';await assert.rejects(s.flow.prepare(s.intent),/network/);assert.equal(s.sent.length,0);await s.flow.switchNetwork();assert.equal(s.walletChain,'0x7a69');assert.equal((await s.flow.submit(await s.flow.prepare(s.intent))).status,'confirmed');
});
test('uncertain submission retains journal and recovers same hash after reload without a second send',async()=>{
  const s=await fixture().start(),r=await s.flow.prepare(s.intent);s.lostResponse=true;assert.equal((await s.flow.submit(r)).status,'unresolved');assert.equal(s.flow.pending().hash,null);await assert.rejects(s.flow.prepare(s.intent),/Recover/);
  const next=s.coordinator();assert.equal((await next.recover(hash('8'))).reconciled,true);assert.equal(s.sent.length,1);assert.equal(next.pending(),null);
});
test('confirmed transaction plus lagging API stays confirmed and recovers without resubmission',async()=>{
  const s=await fixture().start(),r=await s.flow.prepare(s.intent);s.afterSend=()=>{s.fetchHook=async()=>{throw Error('API unavailable');};};
  const result=await s.flow.submit(r);assert.equal(result.status,'confirmed');assert.equal(result.reconciled,false);assert.match(result.error,/confirmed on-chain/);assert.equal(s.flow.pending().status,'confirmed');s.fetchHook=null;assert.equal((await s.flow.recover()).reconciled,true);assert.equal(s.sent.length,1);
});
test('successful approval does not change NFT or LP; next complete review does not send automatically',async()=>{
  const s=await fixture('approve_usdc').start(),before=structuredClone(s.f.nft.position),r=await s.flow.prepare(s.intent);assert.equal(r.action,'approve');const result=await s.flow.submit(r);assert.deepEqual(s.f.nft.position,before);assert.equal(result.action,'approve');
  const next=setup('activate_usdc');s.f.draft=next.f.draft;
  const lp=await s.flow.prepare(result.intent,{afterApproval:true});assert.equal(lp.action,'activate');assert.equal(s.sent.length,1);assert.equal((await s.flow.submit(lp)).reconciled,true);assert.equal(s.sent.length,2);
});
test('a second approval is never silently chained after the first confirmed approval',async()=>{
  const s=await fixture('approve_usdc').start();const result=await s.flow.submit(await s.flow.prepare(s.intent));await assert.rejects(s.flow.prepare(result.intent,{afterApproval:true}),/Approval is confirmed/);assert.equal(s.sent.length,1);
});
for(const [label,mutate] of [['missing event',s=>s.receipt.logs=[]],['wrong amount',s=>s.receipt.logs[0].data='0x'+addressWord(s.f.draft.source.asset)+word(1)+s.receipt.logs[0].data.slice(130)],['removed event',s=>s.receipt.logs[0].removed=true],['not active',s=>s.f.nft.position.activated=false],['no shares',s=>s.f.nft.position.shares_raw='0'],['unavailable value',s=>{s.f.nft.position.current_lp_value.available=false;s.f.nft.position.current_lp_value.raw=null;s.f.nft.position.evolution_value_available=false;}]])test('no LP presentation until confirmed effect: '+label,async()=>{
  const s=await fixture('activate_zzz').start();s.afterSend=()=>mutate(s);const result=await s.flow.submit(await s.flow.prepare(s.intent));assert.equal(result.status,'confirmed');assert.equal(result.reconciled,false);assert.ok(s.flow.pending());assert.equal(s.sent.length,1);
});
test('a revert clears after verified failure and does not pretend LP succeeded',async()=>{
  const s=await fixture().start();s.revert=true;const r=await s.flow.submit(await s.flow.prepare(s.intent));assert.equal(r.status,'failed');assert.equal(r.reconciled,true);assert.equal(s.flow.pending(),null);
});
test('one operation cannot submit concurrently twice or across tabs',async()=>{
  const s=await fixture().start(),r=await s.flow.prepare(s.intent);const first=s.flow.submit(r);await assert.rejects(s.flow.submit(r),/in progress/);await first;assert.equal(s.sent.length,1);
  const blocked=await fixture('mint',{locks:{request:async(_key,_options,fn)=>fn(null)}}).start();await assert.rejects(blocked.flow.submit(await blocked.flow.prepare(blocked.intent)),/another tab/);assert.equal(blocked.sent.length,0);
});
