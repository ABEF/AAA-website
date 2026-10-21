import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DeploymentAPI,validateDeployment,ZERO,ZERO_HASH,parseAmount,exactUnits,jsonRequest} from '../deployment-api.js';
import {DeploymentSession} from '../deployment-session.js';
import {nativeRewards,renderPositionAmounts} from '../deployment-view.js';
const fixtures=JSON.parse(await readFile(new URL('./fixtures/deployment-api.json',import.meta.url)));
const copy=x=>structuredClone(x),address=n=>'0x'+n.toString(16).padStart(40,'0'),hash=c=>'0x'+c.repeat(64);
const words=n=>'0x'+n.toString(16).padStart(64,'0');
export function setup(name='activate_zzz',mutate=()=>{}){
  const f=copy(fixtures[name]),source=f.draft.source?.asset||address(20),symbol=source===ZERO?'ETH':name.includes('usdc')?'USDC':name.includes('usdg')?'USDG':'ZZZ';
  const pins=f.pins||{...f.protocol.contracts,entry:address(85),oracle:address(86)};
  const codes={...f.codes};for(const a of Object.values(pins))codes[a]??='0x6000';
  const m={schema:1,mode:'read-and-prepare',environment:'rehearsal',id:'d'.repeat(64),chain_id:31337,chain_name:'Local API rehearsal',genesis_hash:hash('c'),deployment_block:10,deployment_block_hash:hash('a'),confirmations:12,max_age_seconds:120,api_prefix:'/api',rpc_url:'http://127.0.0.1:9999',projection_sha256:f.projection_identity,transaction_sha256:f.draft.provenance.transaction_configuration_sha256||'1'.repeat(64),activation_sha256:f.draft.provenance.activation_configuration_sha256||'2'.repeat(64),transaction_fee_review:hash('9'),activation_fee_review:hash('f'),contracts:Object.fromEntries(['access','nft','vault','entry','claim_router','oracle'].map(k=>[k,{address:pins[k],runtime_code:codes[pins[k]]}])),pool_id:f.draft.pool_id||hash('f'),input_assets:[{symbol,address:source,decimals:f.source_decimals||18,valuation_asset:source===ZERO?address(20):source,route_id:f.route||ZERO_HASH,enabled:true,...(source===ZERO?{}:{runtime_code:codes[source]})}],reward_assets:[{address:ZERO,symbol:'ETH',decimals:18},{address:address(20),symbol:'ZZZ',decimals:18},{address:address(21),symbol:'USDC',decimals:f.nft.claimable.lp.find(a=>a.asset===address(21)).decimals}],limits:{gas:12000000,gas_price_wei:'100000000000',network_fee_wei:'1000000000000000000',native_value_wei:'1000000000000000000000',contribution_usd_18:'1000000000000000000000000'}};
  const calls=[],inventory={schema:2,chain_id:31337,available:true,wallet:f.nft.owner,nft_contract:pins.nft,count:1,token_ids:[f.nft.token_id],provenance:f.nft.provenance};
  const state={f,m,codes,calls,inventory,now:1000000,price:10n**18n};mutate(state);
  const reader={request:async({method,params=[]})=>{
    calls.push({method,params});if(state.readHook)await state.readHook(method,params);
    if(method==='eth_chainId')return state.chain||'0x7a69';if(method==='eth_blockNumber')return '0x6e';
    if(method==='eth_getBlockByNumber')return params[0]==='0x0'?{hash:m.genesis_hash}:params[0]==='0xa'?{hash:m.deployment_block_hash}:{hash:state.blockHash||hash('b'),number:'0x63',timestamp:'0x3de'};
    if(method==='eth_getCode')return codes[params[0]];
    if(method==='eth_call'){assert.equal(params[0].to,m.contracts.oracle.address);assert.equal(params[0].data,'0xaea91078'+m.input_assets[0].valuation_asset.slice(2).padStart(64,'0'));return words(state.price);}
    throw Error('Unexpected RPC method '+method);
  }};
  const fetcher=async(url,options)=>{
    const path=new URL(url).pathname;calls.push({path,options});if(state.fetchHook)await state.fetchHook(path,options);
    const response=state.response?await state.response(path):path.endsWith('/protocol')?f.protocol:path.endsWith('/mint-readiness')?f.readiness:path.includes('/wallets/')?inventory:path.endsWith('/prepare')?f.draft:path.endsWith('/earnings')?{error:'not configured'}:f.nft;
    return new Response(JSON.stringify(response),{status:path.endsWith('/earnings')?404:200,headers:{'Content-Type':'application/json'}});
  };
  state.reader=reader;state.fetcher=fetcher;state.api=new DeploymentAPI(m,{origin:'http://127.0.0.1:4188',reader,fetcher,clock:()=>state.now});
  state.intent=f.draft.action==='mint'?{action:'mint',account:f.nft.owner}:f.draft.action==='claim'?{action:'claim',account:f.nft.owner,ids:[f.nft.token_id]}:{action:f.draft.action,account:f.nft.owner,id:f.nft.token_id,asset:symbol,amount:exactUnits(f.draft.source.amount_raw,m.input_assets[0].decimals)};
  return state;
}
for(const name of Object.keys(fixtures))test('actual Python response accepted and independently reconstructed: '+name,async()=>{
  const s=setup(name),r=await s.api.prepare(s.intent);assert.equal(r.signing_enabled,false);assert.deepEqual(r.transaction,s.f.draft.transaction);assert.equal(r.action,name.startsWith('approve')?'approve':s.intent.action);assert.equal(typeof s.api.send,'undefined');assert.ok(Object.isFrozen(r.transaction));assert.ok(s.calls.every(c=>!c.method||!/(send|sign|anvil)/i.test(c.method)));
});
test('token quantities are exact; invalid, exponential, overprecision and zero inputs fail',()=>{
  assert.equal(parseAmount('123.456789',6),123456789n);assert.equal(exactUnits('123456789',6),'123.456789');
  for(const x of ['', '0','01','1e6','-1','NaN','Infinity','1,000','1.0000001',' 1','1.'])assert.throws(()=>parseAmount(x,6));
  assert.throws(()=>parseAmount('9'.repeat(78),18));assert.equal(exactUnits('9',0),'9');
});
test('activation uses oracle token price, exact $100 plus at most a raw rounding unit',async()=>{
  const s=setup();s.price=3n*10n**18n;const q=await s.api.activationAmount('ZZZ');assert.equal(q.raw,'33333333333333333334');assert.equal(q.value_usd_18,'100000000000000000002');
  s.price=0n;await assert.rejects(s.api.activationAmount('ZZZ'),/price/);
});
test('production config requires HTTPS and never enables signing or accepts unknown switches',()=>{
  const s=setup(),prod={...s.m,environment:'production',chain_id:46630,rpc_url:'https://rpc.example.org'};
  assert.equal(validateDeployment(prod,'https://app.example.org').mode,'read-and-prepare');
  for(const m of [{...prod,mode:'live'},{...prod,chain_id:31337},{...prod,signing_enabled:true},{...prod,rpc_url:'https://secret@example.org'},{...prod,api_prefix:'//example.org'},{...prod,api_prefix:'/api/'},{...prod,projection_sha256:null}])assert.throws(()=>validateDeployment(m,'https://app.example.org'));
  assert.throws(()=>validateDeployment(prod,'http://app.example.org'));assert.throws(()=>validateDeployment(s.m,'https://app.example.org'));
});
for(const [label,mutate] of [
  ['chain',s=>s.chain='0x1'],['API configuration',s=>s.f.protocol.provenance.configuration_sha256='9'.repeat(64)],
  ['stale snapshot',s=>s.now=1200000],['canonical hash',s=>s.blockHash=hash('e')],
  ['target',s=>s.f.draft.transaction.to=address(99)],['value',s=>s.f.draft.transaction.value='0x1'],
  ['data',s=>s.f.draft.transaction.data+='00'],['extra transaction field',s=>s.f.draft.transaction.gas='0xffff'],
  ['deadline',s=>s.f.draft.expires_at=999],['overlong expiry',s=>s.f.draft.expires_at=1200],
  ['sender',s=>s.f.draft.transaction.from=address(31)],['fee identity',s=>s.f.draft.network_gas.fee_policy_review_hash=hash('0')],
  ['unqualified fee model',s=>s.f.draft.network_gas.includes_all_network_components=false],['gas ceiling',s=>s.f.draft.network_gas.suggested_limit='12000001'],
  ['fee arithmetic',s=>s.f.draft.network_gas.suggested_limit_cost_wei='1'],['runtime',s=>s.codes[s.f.draft.transaction.to]='0x6001'],
  ['state override',s=>s.f.draft.state_overrides=true],['LP shortfall',s=>s.f.draft.contribution.marginal_deployed_usd_18='1'],
  ['LP units shortfall',s=>s.f.draft.contribution.lp_liquidity_added_raw='0'],['shares zero',s=>s.f.draft.contribution.shares_added_raw='0'],
  ['wrong source valuation',s=>s.f.draft.source.value_usd_18='1'],['price changed',s=>s.price=2n*10n**18n],
  ['owner changed',s=>s.f.nft.owner=address(31)],['unrevealed',s=>s.f.nft.traits_ready=false],
  ['lifecycle stopped',s=>s.f.protocol.lifecycle.new_economic_work_available_by_lifecycle=false],
])test('reject '+label+' without any submission',async()=>{const s=setup('activate_zzz',mutate);await assert.rejects(s.api.prepare(s.intent));});
test('approval is exact, not unlimited, and requires another complete simulation',async()=>{
  const s=setup('approve_usdc');const r=await s.api.prepare(s.intent);assert.equal(r.action,'approve');assert.equal(r.minimum_deployed_usd_18,'99000000000000000000');assert.equal(r.source.amount_raw,'100000000');
  for(const mutation of [d=>d.approval_steps[0].amount_raw='1000000000000000',d=>d.approval_steps[0].spender=address(99),d=>d.approval_steps[0].reset_first=true,d=>d.approval_steps[0].reprepare_after_confirmation=false]){const v=setup('approve_usdc');mutation(v.f.draft);await assert.rejects(v.api.prepare(v.intent));}
});
test('top-up below $5 and activation above/below exact amount are rejected',async()=>{
  for(const [name,amount] of [['increase_zzz','4.999'],['activate_zzz','101'],['activate_zzz','99']]){const s=setup(name);await assert.rejects(s.api.prepare({...s.intent,amount}));}
});
test('claim only selects funded ETH, never source tokens or duplicate NFTs',async()=>{
  const s=setup('claim');const r=await s.api.prepare(s.intent);assert.equal(r.claims.length,1);assert.equal(r.claims[0].asset,ZERO);
  await assert.rejects(s.api.prepare({...s.intent,ids:[s.f.nft.token_id,s.f.nft.token_id]}));
  s.f.draft.claim_operations[0].royalty=false;await assert.rejects(s.api.prepare(s.intent),/selection/);
});
test('mint does not allocate liquidity or reserve a returned NFT',async()=>{
  const s=setup('mint');const r=await s.api.prepare(s.intent);assert.equal(r.transaction.value,'0xb1a2bc2ec50000');assert.equal(r.source,null);assert.equal(r.token_id,undefined);
  s.f.readiness.new_minting_stopped=true;await assert.rejects(s.api.prepare(s.intent),/unavailable/);
});
test('an expiry or reorg during the final checks invalidates the prepared review',async()=>{
  for(const change of ['expiry','reorg']){
    const s=setup('mint');let identityCalls=0;s.readHook=async method=>{if(method==='eth_chainId'&&++identityCalls===2){if(change==='expiry')s.now=1061000;else s.blockHash=hash('e');}};
    await assert.rejects(s.api.prepare(s.intent));
  }
});
test('portfolio reads bounded cards with no invented earnings and rejects an oversized inventory',async()=>{
  const s=setup('mint');const data=await s.api.portfolio(s.f.nft.owner);assert.equal(data.nfts.length,1);assert.equal(data.nfts[0].earnings.available,false);
  s.inventory.count=1001;s.inventory.token_ids=Array.from({length:1001},(_,i)=>String(i+1));await assert.rejects(s.api.portfolio(s.f.nft.owner));
});
test('a 1,000-ID wallet fetches only eight card projections with at most two in flight',async()=>{
  const s=setup('mint');s.inventory.count=1000;s.inventory.token_ids=Array.from({length:1000},(_,i)=>String(i+1));let active=0,peak=0,count=0;
  s.response=async path=>{
    if(path.endsWith('/protocol'))return s.f.protocol;if(path.includes('/wallets/'))return s.inventory;if(path.endsWith('/earnings'))return {};
    const id=path.split('/').at(-1);count++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;return {...copy(s.f.nft),token_id:id,mint_ordinal:Number(id)};
  };
  const data=await s.api.portfolio(s.f.nft.owner);assert.equal(count,8);assert.equal(peak,2);assert.equal(data.nfts.length,8);assert.equal(data.inventory.count,1000);
});
test('mint readiness and malformed values fail closed',async()=>{
  for(const mutate of [s=>s.f.readiness.minted=1001,s=>s.f.nft.position.current_lp_value.unit='ETH',s=>s.f.nft.position.current_lp_value.decimals=6,s=>s.f.nft.claimable.lp[0].available=false]){
    const s=setup('mint',mutate);await assert.rejects(s.f.readiness.minted===1001?s.api.readiness():s.api.nft(s.f.nft.token_id,s.f.nft.owner));
  }
});
test('wallet changes discard late portfolio responses',async()=>{
  const s=setup('mint');s.fetchHook=async path=>{if(path.includes('/wallets/'))s.api.cancel();};await assert.rejects(s.api.portfolio(s.f.nft.owner));
});
test('unavailable royalty balances remain unknown, never zero or combined with unrelated tokens',()=>{
  const n=copy(fixtures.claim.nft);assert.equal(nativeRewards(n),'33333333333333333333');
  n.claimable.royalties.find(a=>a.asset===ZERO).raw=null;assert.equal(nativeRewards(n),null);assert.match(renderPositionAmounts(n),/Unavailable/);
  n.position.activated=false;const html=renderPositionAmounts(n);assert.doesNotMatch(html,/Rewards to claim|Fees generated/);
});
test('API request transport excludes credentials and redirects; size and error results are bounded',async()=>{
  let options;await jsonRequest(async(_url,o)=>{options=o;return new Response('{}');},'https://app.example.org/api/v1/protocol');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  for(const response of [new Response('[]'),new Response('not-json'),new Response('x'.repeat(300)),new Response('{}',{status:503}),{redirected:true}])await assert.rejects(jsonRequest(async()=>response,'https://app.example.org/api',{a:1},{maxBytes:256}));
});
test('aborted request never retries or ignores cancellation',async()=>{
  const c=new AbortController();let calls=0;const task=jsonRequest(async(_url,{signal})=>{calls++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));},'https://app.example.org/api',undefined,{signal:c.signal});c.abort();await assert.rejects(task);assert.equal(calls,1);
});
function wallet(accounts=[address(30)]){const listeners={},methods=[];return {id:'wallet',name:'Wallet',provider:{methods,request:async({method})=>{methods.push(method);return accounts;},on:(e,f)=>listeners[e]=f,removeListener:e=>delete listeners[e],emit:(e,v)=>listeners[e]?.(v)}};}
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('ordinary addresses accepted; multiple authorized accounts require explicit selection',async()=>{
  const w=wallet([address(91),address(92)]),s=new DeploymentSession({storage:storage(),key:'test'});await s.connect(w);assert.equal(s.account,null);await s.select(address(92));assert.equal(s.account,address(92));await s.verify();assert.ok(w.provider.methods.every(m=>['eth_accounts','eth_requestAccounts'].includes(m)));
});
test('restore uses read-only permission checks and isolated deployment storage',async()=>{
  const store=storage(),w=wallet(),s=new DeploymentSession({storage:store,key:'one'});await s.connect(w);w.provider.methods.length=0;
  const restored=new DeploymentSession({storage:store,key:'one'});await restored.restore([w]);assert.equal(restored.account,address(30));assert.deepEqual(w.provider.methods,['eth_accounts']);
  const other=new DeploymentSession({storage:store,key:'two'});await other.restore([w]);assert.equal(other.account,null);
});
test('account changes and disconnects invalidate prior selections and reviews',async()=>{
  const w=wallet(),s=new DeploymentSession({storage:storage(),key:'one'});await s.connect(w);const revision=s.revision;w.provider.emit('accountsChanged',[address(30),address(31)]);assert.equal(s.account,null);assert.ok(s.revision>revision);w.provider.emit('disconnect');assert.equal(s.provider,null);
});
test('revoked remembered account never silently restores a different account',async()=>{
  const store=storage();store.setItem('one',JSON.stringify({account:address(30),provider:'wallet'}));const w=wallet([address(31)]),s=new DeploymentSession({storage:store,key:'one'});await s.restore([w]);assert.equal(s.account,null);assert.deepEqual(s.options,[address(31)]);
});
test('cancelled/late connection cannot revive a disconnected account',async()=>{
  let done;const w=wallet();w.provider.request=()=>new Promise(resolve=>done=resolve);const s=new DeploymentSession({storage:storage(),key:'one'});const task=s.connect(w);s.disconnect();done([address(30)]);await task;assert.equal(s.account,null);assert.equal(s.provider,null);
});
test('published default keeps the public demo and local signer boundaries',async()=>{
  const config=await readFile(new URL('../deployment-config.js',import.meta.url),'utf8');assert.match(config,/export const DEPLOYMENT = null/);
  const signer=await readFile(new URL('../browser-wallet.js',import.meta.url),'utf8');assert.match(signer,/chainId:'0x7a69'/);
  for(const file of ['deployment-api.js','deployment-view.js','deployment-session.js']){const source=await readFile(new URL('../'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/eth_sendTransaction|eth_sendRawTransaction|personal_sign|eth_signTypedData/);}
});
