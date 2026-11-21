// NEW focused wallet-financial verification. No old test module is imported.
// Synthetic wire/price/RPC data checks current production API aggregation only;
// it is not a provider, service, actual market, EVM or deployment acceptance run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
// When installed as tests/wallet-financial-view.test.mjs every default import is
// repository-relative. External qualification may select its reviewed checkout.
const local=path=>process.env.WALLET_WEBSITE_ROOT?pathToFileURL(resolve(process.env.WALLET_WEBSITE_ROOT,path)).href:new URL('../'+path,import.meta.url).href;
const {DeploymentAPI}=await import(local('deployment-api.js'));
const {FRESH_CANONICAL_SCHEMA}=await import(local('deployment-source9.js'));
const {SOURCE10_CANONICAL_SCHEMA}=await import(local('deployment-source10.js'));
const {earnedUSD,loadWalletFinancials}=await import(local('deployment-view.js'));
const {source10APISetup}=await import(local('tests/helpers/source10-api-fixture.mjs'));
const {source9Setup}=await import(local('tests/helpers/source9-profile-fixture.mjs'));
const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const hash=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const hex=n=>'0x'+BigInt(n).toString(16);
const clone=x=>structuredClone(x);
const digest=ids=>createHash('sha256').update(ids.join(','),'ascii').digest('hex');
const OWNER=address(30),OTHER=address(31),ZERO=address(0),BLOCK=99,TIME=100000;
const fields=['lp_individual','lp_collective','royalties'];
const currencies=[{address:ZERO,symbol:'ETH',decimals:18},{address:address(20),symbol:'ZZZ',decimals:18},
  {address:address(21),symbol:'USD6',decimals:6},{address:address(22),symbol:'TOK9',decimals:9},
  {address:address(23),symbol:'TOK36',decimals:36}];
const tick=()=>new Promise(resolve=>queueMicrotask(resolve));
function harness({count=17,source=10,mutate=()=>{},onFetch=async()=>{},prices=()=>({available:true,usd_per_token_18:'3333333333333333333'}),amounts=(i,a,p,f)=>BigInt(i+1)*BigInt(a+1)*BigInt(f+1)*(p==='all_time'?11n:3n)*((1n<<60n)+1n)}={}){
  const ids=Array.from({length:count},(_,i)=>((1n<<255n)+BigInt(i+1)).toString());
  const manifest={schema:source===10?5:4,source_profile:source,mint_integration_version:source===10?2:undefined,
    canonical_schema:source===10?SOURCE10_CANONICAL_SCHEMA:FRESH_CANONICAL_SCHEMA,
    chain_id:31337,deployment_block:1,deployment_block_hash:hash(1),genesis_hash:hash(12),confirmations:2,max_age_seconds:120,
    api_prefix:'/api',projection_sha256:'a'.repeat(64),contracts:{nft:{address:address(2)}},accounting_version:7,reward_assets:clone(currencies)};
  const anchor={block_number:BLOCK,block_hash:hash(99),block_timestamp:TIME,observed_head:BLOCK+1,confirmations:2,
    finality:'confirmation_depth_only',protocol_finalized:false,eip1898_require_canonical:true,configuration_sha256:manifest.projection_sha256,accounting_version:7};
  const history={available:true,from_block:1,start_block_hash:hash(1),start_parent_hash:hash(0),through_block:BLOCK,block_hash:anchor.block_hash,
    indexer_next_block:BLOCK+2,logs_examined:count,claim_events:7,royalty_conversion_events:0,lp_conversion_events:3,minted_count:count,
    scope:'NEW synthetic complete ingestion fixture.',completeness:'Synthetic ingestion, no cryptographic completeness proof.'};
  const lifecycle={state:'operating',state_code:0,handoff_phase:'idle',preparation_active:false,paused:false,
    origin:{chain_id:31337,vault:address(3)},origin_available:true,predecessor_controller:null,successor_controller:null,
    handoff_destination_controller:null,peer_deployments_verified:false,claims_available_by_lifecycle:true,transfers_available_by_lifecycle:true,
    new_economic_work_available_by_lifecycle:true,scope:'NEW synthetic same-chain lifecycle.',lp_exit_started:false,lp_exit_phase_code:0,lp_exit_phase:'operating'};
  const s={ids,manifest,anchor,history,lifecycle,requests:[],rpc:[],now:TIME*1000,currentHash:anchor.block_hash,currentHead:BLOCK+1,maximum:0,active:0};
  const api=Object.create(DeploymentAPI.prototype);s.api=api;
  Object.assign(api,{manifest,origin:'http://127.0.0.1:4190',clock:()=>s.now,revision:0,active:null});
  api.reader={async request({method,params=[]}){s.rpc.push({method,params});assert.doesNotMatch(method,/send|sign|nonce|trace|anvil/i);
    if(method==='eth_blockNumber')return hex(s.currentHead);
    if(method==='eth_getBlockByNumber'&&params[0]===hex(BLOCK))return {number:hex(BLOCK),hash:s.currentHash,timestamp:hex(TIME)};
    throw Error('Unexpected synthetic read '+method);}};
  // Deliberate graph seam for workload/wire tests. Constructor compositions below
  // use the real native graph and real NFT validator without this seam.
  api.native={async verify(p){assert.deepEqual(p,{blockHash:anchor.block_hash,requireCanonical:true});}};
  api.identity=async()=>{};
  api.protocol=async()=>({schema:2,chain_id:31337,provenance:clone(anchor),lifecycle:clone(lifecycle)});
  s.inventory={schema:2,chain_id:31337,wallet:OWNER,nft_contract:manifest.contracts.nft.address,available:true,count,token_ids:clone(ids),
    provenance:clone(anchor),history:clone(history),lifecycle:clone(lifecycle)};
  s.rows=(offset,period)=>currencies.map((asset,a)=>{
    const selected=ids.slice(offset,offset+16),price=prices(a,period,offset),raw=fields.map((_,f)=>selected.reduce((sum,id)=>sum+amounts(ids.indexOf(id),a,period,f),0n));
    const value=amount=>price.available?amount*BigInt(price.usd_per_token_18)/10n**BigInt(asset.decimals):amount===0n?0n:null;
    return {asset:asset.address,symbol:asset.symbol,decimals:asset.decimals,current_price:clone(price),
      ...Object.fromEntries(fields.map((f,i)=>[f+'_raw',raw[i].toString()])),
      usd_at_current_price_18:Object.fromEntries(fields.map((f,i)=>[f,value(raw[i])===null?null:value(raw[i]).toString()]))};});
  s.part=(kind,offset)=>{
    const selected=ids.slice(offset,offset+16),next=offset+selected.length<count?offset+selected.length:null;
    const common={schema:1,chain_id:31337,wallet:OWNER,nft_contract:manifest.contracts.nft.address,inventory_sha256:digest(ids),count,offset,chunk_size:16,
      token_ids:selected,next_offset:next,provenance:clone(anchor)};
    if(kind==='nfts')return {...common,kind:'fixed_block_wallet_inventory_page',available:true,verified_count:selected.length,complete:offset===0&&selected.length===count,
      history:clone(history),lifecycle:clone(lifecycle),scope:'NEW synthetic wallet ownership page.'};
    if(kind==='summary')return {...common,lp_usd_18:selected.reduce((sum,id)=>sum+(1n<<70n)+BigInt(ids.indexOf(id)),0n).toString(),
      claimable_eth_wei:selected.reduce((sum,id)=>sum+(1n<<65n)+BigInt(ids.indexOf(id)),0n).toString()};
    const out={...common,available:true,scope:'wallet_chunk',claims_and_conversions_are_income:false,unprocessed_revenue_included:false,
      clock:'on-chain processing/allocation time',window:{through_timestamp_inclusive:TIME,after_timestamp_exclusive:TIME-86400},
      all_time:s.rows(offset,'all_time'),last_24h:s.rows(offset,'last_24h')};
    for(const p of ['all_time','last_24h'])out[p+'_usd_at_current_price_18']=Object.fromEntries(fields.map(f=>[f,out[p].some(r=>r.usd_at_current_price_18[f]===null)?null:
      out[p].reduce((sum,r)=>sum+BigInt(r.usd_at_current_price_18[f]),0n).toString()]));
    return out;};
  api.fetcher=async(url,options={})=>{
    const path=new URL(url).pathname.replace(/^\/api/,'');s.requests.push({path,signal:options.signal});
    const match=path.match(/\/(nfts|summary|earnings)\/([0-9]+)\/([0-9]+)$/);
    if(!match)throw Error('Unexpected synthetic endpoint '+path);
    assert.equal(Number(match[2]),BLOCK);assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');
    const kind=match[1],offset=Number(match[3]),part=s.part(kind,offset);s.active++;s.maximum=Math.max(s.maximum,s.active);
    try{await tick();await onFetch(kind,offset,s,options);await mutate(part,kind,offset,s);return new Response(JSON.stringify(part));}finally{s.active--;}};
  return s;
}
function independentRaw(s,period,asset,field){let n=0n;for(let i=0;i<s.ids.length;i++)n+=BigInt(i+1)*BigInt(asset+1)*BigInt(field+1)*(period==='all_time'?11n:3n)*((1n<<60n)+1n);return n;}
for(const source of [9,10])for(const count of [0,1,16,17,1000])test(`NEW source${source} ${count} holdings complete exact financial pages`,async()=>{
  const s=harness({source,count}),inventory=await s.api.walletInventory(OWNER,clone(s.anchor)),totals=await s.api.walletTotals(inventory),earnings=await s.api.walletEarnings(inventory);
  assert.deepEqual(inventory.token_ids,s.ids);assert.equal(totals.count,count);assert.equal(earnings.token_ids.length,count);
  const indexSum=BigInt(count)*BigInt(Math.max(0,count-1))/2n;
  assert.equal(totals.lp_usd_18,(BigInt(count)*(1n<<70n)+indexSum).toString());
  assert.equal(totals.claimable_eth_wei,(BigInt(count)*(1n<<65n)+indexSum).toString());
  for(const period of ['all_time','last_24h'])for(const [a,row] of earnings[period].entries())for(const [f,field] of fields.entries()){
    const raw=independentRaw(s,period,a,f);assert.equal(row[field+'_raw'],raw.toString());
    assert.equal(row.usd_at_current_price_18[field],(raw*3333333333333333333n/10n**BigInt(row.decimals)).toString());}
  const pages=Math.max(1,Math.ceil(count/16));for(const kind of ['nfts','summary','earnings'])assert.equal(s.requests.filter(r=>r.path.includes('/'+kind+'/')).length,pages);
  assert.ok(s.maximum<=2);assert.equal(earnings.claims_and_conversions_are_income,false);
});
test('NEW aggregate original raw currency before each asset USD floor',async()=>{
  const s=harness({count:17,prices:()=>({available:true,usd_per_token_18:'1'}),amounts:(_i,a,p,f)=>a===2&&f===2?(p==='all_time'?60000n:30000n):0n});
  const first=s.part('earnings',0),second=s.part('earnings',16),out=await s.api.walletEarnings(s.inventory);
  assert.equal(first.all_time[2].usd_at_current_price_18.royalties,'0');assert.equal(second.all_time[2].usd_at_current_price_18.royalties,'0');
  assert.equal(out.all_time[2].royalties_raw,'1020000');assert.equal(out.all_time[2].usd_at_current_price_18.royalties,'1');
  assert.equal(earnedUSD(out,'all_time'),'1');
});
for(const metric of ['lp_usd_18','claimable_eth_wei'])test('NEW one unavailable '+metric+' poisons only that complete wallet total',async()=>{
  const s=harness({mutate:(p,k,o)=>{if(k==='summary'&&o===16)p[metric]=null;}}),out=await s.api.walletTotals(s.inventory);
  assert.equal(out[metric],null);assert.notEqual(out[metric==='lp_usd_18'?'claimable_eth_wei':'lp_usd_18'],null);
});
test('NEW unpriced nonzero currency retains exact income and unavailable USD',async()=>{
  const s=harness({prices:a=>a===2?{available:false,usd_per_token_18:null,reason:'synthetic price unavailable'}:{available:true,usd_per_token_18:'1000000000000000000'}});
  const out=await s.api.walletEarnings(s.inventory);assert.equal(out.all_time[2].royalties_raw,independentRaw(s,'all_time',2,2).toString());
  assert.equal(out.all_time[2].usd_at_current_price_18.royalties,null);assert.equal(earnedUSD(out,'all_time'),null);
});
test('NEW unpriced empty wallet has authenticated exact zero history',async()=>{
  const s=harness({count:0,prices:()=>({available:false,usd_per_token_18:null,reason:'not configured'})});
  const out=await s.api.walletEarnings(s.inventory);assert.equal(earnedUSD(out,'all_time'),'0');assert.equal(earnedUSD(out,'last_24h'),'0');
});
const defects=[
  ['changed owner',p=>p.wallet=OTHER],['changed chain',p=>p.chain_id++],['changed inventory digest',p=>p.inventory_sha256='b'.repeat(64)],
  ['wrong ID order',p=>p.token_ids.reverse()],['wrong page offset',p=>p.offset=0],['missing next page',p=>p.next_offset=null],
  ['changed block hash',p=>p.provenance.block_hash=hash(98)],['changed configuration',p=>p.provenance.configuration_sha256='b'.repeat(64)],
];
for(const [label,change] of defects)for(const kind of ['summary','earnings'])test(`NEW financial ${kind} rejects ${label} at a middle page`,async()=>{
  const s=harness({count:33,mutate:(p,k,o)=>{if(k===kind&&o===16)change(p);}});
  await assert.rejects(kind==='summary'?s.api.walletTotals(s.inventory):s.api.walletEarnings(s.inventory));
});
for(const [label,change] of [
  ['missing currency',p=>p.all_time.pop()],['duplicate currency',p=>p.all_time[1]=clone(p.all_time[0])],
  ['invented USD total',p=>p.all_time_usd_at_current_price_18.royalties='1'],
  ['negative earned raw',p=>p.all_time[0].royalties_raw='-1'],['claims counted as income',p=>p.claims_and_conversions_are_income=true],
  ['unprocessed revenues included',p=>p.unprocessed_revenue_included=true],['day greater than lifetime',p=>p.last_24h[0].royalties_raw=(1n<<200n).toString()],
])test('NEW complete earnings reject '+label,async()=>{
  const s=harness({count:33,mutate:(p,k,o)=>{if(k==='earnings'&&o===16)change(p);}});await assert.rejects(s.api.walletEarnings(s.inventory));
});
test('NEW internally valid divergent page prices are rejected',async()=>{
  const s=harness({prices:(_a,_p,offset)=>({available:true,usd_per_token_18:offset===16?'2000000000000000000':'1000000000000000000'})});
  await assert.rejects(s.api.walletEarnings(s.inventory),/price changed/i);
});
for(const kind of ['summary','earnings'])for(const cause of ['abort','expiry','reorg'])test(`NEW ${kind} final ${cause} discards all accumulated financial values`,async()=>{
  const controller=new AbortController(),s=harness({onFetch:async(k,o,state)=>{if(k!==kind||o!==16)return;
    if(cause==='abort')controller.abort();else if(cause==='expiry')state.now+=121000;else state.currentHash=hash(98);}});
  await assert.rejects(kind==='summary'?s.api.walletTotals(s.inventory,{signal:controller.signal}):s.api.walletEarnings(s.inventory,{signal:controller.signal}));
});
for(const kind of ['summary','earnings'])test(`NEW ${kind} missing middle response returns no partial result`,async()=>{
  const s=harness({count:33,onFetch:async(k,o)=>{if(k===kind&&o===16)throw Error('Synthetic unavailable middle response');}});
  await assert.rejects(kind==='summary'?s.api.walletTotals(s.inventory):s.api.walletEarnings(s.inventory),/unavailable middle/);
  assert.equal(s.requests.some(r=>r.path.endsWith('/'+kind+'/'+BLOCK+'/32')),false);
});
for(const kind of ['summary','earnings'])test(`NEW ${kind} captures caller-owned inventory before the first await`,async()=>{
  const s=harness(),original=clone(s.inventory),pending=kind==='summary'?s.api.walletTotals(s.inventory):s.api.walletEarnings(s.inventory);
  // Neither consumer-owned edits nor subsequent UI reuse may retarget a read.
  Object.assign(s.inventory,{wallet:OTHER,count:1,nft_contract:address(999)});s.inventory.token_ids.splice(0,16);s.inventory.provenance.block_hash=hash(88);
  const out=await pending;assert.equal(out.wallet,original.wallet);assert.equal(out.count,original.count);assert.deepEqual(out.provenance,original.provenance);
  if(kind==='earnings')assert.deepEqual(out.token_ids,original.token_ids);
  assert.ok(s.requests.every(r=>r.path.includes('/'+OWNER+'/')));
});
for(const kind of ['summary','earnings'])test(`NEW ${kind} rejects API revision change independently of caller AbortController`,async()=>{
  const s=harness({onFetch:async(k,o,state)=>{if(k===kind&&o===16)state.api.cancel();}});
  await assert.rejects(kind==='summary'?s.api.walletTotals(s.inventory):s.api.walletEarnings(s.inventory));
});
for(const kind of ['summary','earnings'])test(`NEW ${kind} rechecks freshness after awaited native verification`,async()=>{
  const s=harness();s.api.native.verify=async()=>{if(s.requests.some(r=>r.path.endsWith('/'+kind+'/'+BLOCK+'/16')))s.now+=121000;};
  await assert.rejects(kind==='summary'?s.api.walletTotals(s.inventory):s.api.walletEarnings(s.inventory));
});
for(const kind of ['summary','earnings'])test(`NEW ${kind} guards the microtask after completed final verification`,async()=>{
  const s=harness({count:1}),original=s.api._walletRead.bind(s.api);let completed=false;
  s.api._walletRead=(...args)=>{
    const context=original(...args),finish=context.finish;
    context.finish=async()=>{await finish();completed=true;queueMicrotask(()=>{if(kind==='summary')s.api.cancel();else s.now=(TIME+120)*1000;});};
    return context;
  };
  await assert.rejects(kind==='summary'?s.api.walletTotals(s.inventory):s.api.walletEarnings(s.inventory),kind==='summary'?/cancelled|superseded/:/expired/);
  assert.equal(completed,true,'The real captured context completed all final RPC and identity checks');
  assert.equal(s.requests.length,1,'The race occurs after the complete production financial read');
});
for(const kind of ['summary','earnings'])test(`NEW ${kind} propagates the remaining snapshot freshness deadline into an active request`,{timeout:3000},async()=>{
  const s=harness({count:1,onFetch:async(k,_o,_state,options)=>{if(k!==kind)return;
    await new Promise((resolve,reject)=>{if(options.signal.aborted)return reject(Error('Synthetic read aborted'));
      options.signal.addEventListener('abort',()=>reject(Error('Synthetic read aborted')),{once:true});});}});
  s.now=(TIME+120)*1000-20;const started=Date.now();
  await assert.rejects(kind==='summary'?s.api.walletTotals(s.inventory):s.api.walletEarnings(s.inventory));
  assert.equal(s.requests.length,1);assert.equal(s.requests[0].signal.aborted,true);assert.ok(Date.now()-started<2000,'The default 30-second request timeout cannot substitute for snapshot expiry');
});
for(const [label,change] of [
  ['wrong inventory schema',i=>i.schema=1],['wrong inventory chain',i=>i.chain_id++],['wrong inventory NFT',i=>i.nft_contract=address(90)],
  ['zero owner',i=>i.wallet=ZERO],['unavailable inventory',i=>i.available=false],['mismatched count',i=>i.count--],
  ['repeated NFT',i=>i.token_ids[1]=i.token_ids[0]],['noncanonical full-width ID',i=>i.token_ids[0]='0'+i.token_ids[0]],
])for(const kind of ['summary','earnings'])test(`NEW ${kind} rejects ${label} before API access`,async()=>{
  const s=harness();change(s.inventory);await assert.rejects(kind==='summary'?s.api.walletTotals(s.inventory):s.api.walletEarnings(s.inventory));assert.equal(s.requests.length,0);
});
for(const source of [9,10])test(`NEW actual source${source} constructor native and NFT validation compose with financial pages`,async()=>{
  const s=source===10?source10APISetup('checkpoint2_earnings'):source9Setup('checkpoint2_earnings'),saved=s.f.outputs;
  const inventory=saved.inventory,base='/v1/wallets/'+inventory.wallet,fetcher=async(url,options)=>{
    const path=new URL(url).pathname.replace(/^\/api/,'');
    if(path===base+'/nfts/'+inventory.provenance.block_number+'/0')return new Response(JSON.stringify({...clone(inventory),schema:1,kind:'fixed_block_wallet_inventory_page',offset:0,chunk_size:16,
      verified_count:inventory.count,next_offset:null,complete:true,inventory_sha256:digest(inventory.token_ids),scope:'NEW synthetic page derived from saved current producer DTO.'}));
    if(path===base+'/nfts')assert.fail('Fresh reads cannot request a legacy complete inventory');return s.fetcher(url,options);
  };
  const api=new DeploymentAPI(s.m,{origin:'http://127.0.0.1:4190',reader:s.reader,fetcher,clock:()=>s.now});
  const portfolio=await api.portfolio(inventory.wallet),totals=await api.walletTotals(portfolio.inventory),earnings=await api.walletEarnings(portfolio.inventory);
  assert.equal(portfolio.inventory.count,inventory.count);assert.equal(portfolio.nfts.length,inventory.count);
  assert.equal(totals.lp_usd_18,saved.wallet_summary.lp_usd_18);assert.equal(totals.claimable_eth_wei,saved.wallet_summary.claimable_eth_wei);
  assert.deepEqual(earnings.all_time,saved.wallet_earnings.all_time);assert.deepEqual(earnings.last_24h,saved.wallet_earnings.last_24h);
  for(const nft of portfolio.nfts)assert.deepEqual(nft.claimable,saved.nfts[nft.token_id].claimable);
  assert.ok(s.calls.some(c=>c.method==='eth_getCode'));assert.equal(s.calls.some(c=>c.method&&/send|sign|nonce|anvil|trace/i.test(c.method)),false);
});

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
test('NEW independent wallet metrics start together and publish each settled branch once',async()=>{
  const totals=deferred(),earnings=deferred(),published=deferred(),events=[],inventory={count:1000},seen=[];
  const api={walletTotals(i,o){assert.equal(i,inventory);assert.equal(o.signal,undefined);events.push('totals');return totals.promise;},
    walletEarnings(i,o){assert.equal(i,inventory);assert.equal(o.signal,undefined);events.push('earnings');return earnings.promise;}};
  const pending=loadWalletFinancials(api,inventory,{onTotals:value=>seen.push(['totals',value]),onEarnings:value=>{seen.push(['earnings',value]);published.resolve();}});
  await tick();assert.deepEqual(events,['totals','earnings']);assert.deepEqual(seen,[]);
  const earned={all_time:'exact history'},total={lp_usd_18:'123'};earnings.resolve(earned);await published.promise;
  assert.deepEqual(seen,[['earnings',{value:earned,error:null}]]);totals.resolve(total);
  const statuses=await pending;assert.deepEqual(statuses.map(x=>x.status),['fulfilled','fulfilled']);
  assert.deepEqual(seen,[['earnings',{value:earned,error:null}],['totals',{value:total,error:null}]]);
});
test('NEW unavailable wallet metric preserves the other complete healthy result without retry',async()=>{
  const totals=deferred(),earnings=deferred(),published=deferred(),error=Error('Synthetic LP/claimable read unavailable'),seen=[],calls=[];
  const api={walletTotals(){calls.push('totals');return totals.promise;},walletEarnings(){calls.push('earnings');return earnings.promise;}};
  const pending=loadWalletFinancials(api,{count:1000},{onTotals:value=>{seen.push(['totals',value]);published.resolve();},onEarnings:value=>seen.push(['earnings',value])});
  totals.reject(error);await published.promise;assert.deepEqual(seen,[['totals',{value:null,error}]]);
  const complete={scope:'wallet',all_time:'confirmed'};earnings.resolve(complete);const statuses=await pending;
  assert.deepEqual(statuses.map(x=>x.status),['rejected','fulfilled']);assert.deepEqual(calls,['totals','earnings']);
  assert.deepEqual(seen,[['totals',{value:null,error}],['earnings',{value:complete,error:null}]]);
});
test('NEW aborted account refresh never publishes late healthy or failed metric callbacks',async()=>{
  const totals=deferred(),earnings=deferred(),controller=new AbortController(),seen=[],calls=[];
  const api={walletTotals(_i,o){calls.push('totals');assert.equal(o.signal,controller.signal);return totals.promise;},
    walletEarnings(_i,o){calls.push('earnings');assert.equal(o.signal,controller.signal);return earnings.promise;}};
  const pending=loadWalletFinancials(api,{count:17},{signal:controller.signal,onTotals:v=>seen.push(v),onEarnings:v=>seen.push(v)});
  await tick();controller.abort();totals.resolve({lp_usd_18:'999'});earnings.reject(Error('Late cancelled read'));await pending;
  assert.deepEqual(seen,[]);assert.deepEqual(calls,['totals','earnings']);
});

// These three inputs are newly produced by backend_producer.py from actual
// Projection wallet handlers + SQLite/ExactReplay with synthetic RPC/markets.
// Unlike the pure-wire harness above, their accounting DTOs are not invented by
// JavaScript. Fixed synthetic confirmed headers (or saved replies, when supplied)
// provide transport; the native graph seam stays explicit. Constructed real
// source9/source10 native/NFT cases above cover that distinct composition.
for(const count of [1,17,1000])test(`NEW actual fresh7 backend ${count}-NFT wallet DTOs compose complete browser financial reads`,async()=>{
  const file=process.env.WALLET_BACKEND_FIXTURES?resolve(process.env.WALLET_BACKEND_FIXTURES,`scenario-${count}.json`):new URL(`fixtures/wallet-view-20261121/scenario-${count}.json`,import.meta.url);
  const f=JSON.parse(await readFile(file,'utf8')),cfg=f.read_configuration,anchor=f.protocol.provenance;
  const m={schema:4,source_profile:9,accounting_version:7,canonical_schema:FRESH_CANONICAL_SCHEMA,chain_id:cfg.chain_id,
    deployment_block:cfg.deployment_block,deployment_block_hash:cfg.deployment_block_hash,genesis_hash:hash(12),
    confirmations:cfg.confirmations,max_age_seconds:cfg.max_block_age_seconds,projection_sha256:anchor.configuration_sha256,
    api_prefix:'/api',contracts:cfg.contracts,reward_assets:cfg.assets.map(({address,symbol,decimals})=>({address,symbol,decimals}))};
  const state={active:0,maximum:0,paths:[],rpc:[]},api=Object.create(DeploymentAPI.prototype);
  Object.assign(api,{manifest:m,origin:'http://127.0.0.1:4190',clock:()=>(anchor.block_timestamp+1)*1000,revision:0,active:null});
  api.native={async verify(p){assert.deepEqual(p,{blockHash:anchor.block_hash,requireCanonical:true});}};
  const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
  const key=(method,params)=>method+':'+JSON.stringify(stable(params));
  const recorded=new Map((f.rpc_responses??[]).map(r=>[key(r.method,r.params),r.result]));
  const wire=(method,value)=>{
    const quantity=x=>Number.isSafeInteger(x)&&x>=0?hex(x):x;
    if(['eth_chainId','eth_blockNumber'].includes(method))return quantity(value);
    if(method==='eth_getBlockByNumber'&&value){const out=clone(value);for(const k of ['number','timestamp','gasLimit','gasUsed','baseFeePerGas'])if(k in out)out[k]=quantity(out[k]);return out;}
    return clone(value);
  };
  api.reader={async request({method,params=[]}){
    state.rpc.push({method,params});assert.doesNotMatch(method,/send|sign|nonce|anvil|trace/i);
    const saved=recorded.get(key(method,params));if(saved!==undefined)return wire(method,saved);
    if(method==='eth_getBlockByNumber'&&params[0]===hex(anchor.block_number))return {hash:anchor.block_hash,number:hex(anchor.block_number),timestamp:hex(anchor.block_timestamp)};
    if(method==='eth_blockNumber')return hex(anchor.observed_head);
    if(method==='eth_getBlockByNumber'&&params[0]==='0x0')return {hash:m.genesis_hash,number:'0x0',timestamp:'0x0'};
    if(method==='eth_getBlockByNumber'&&params[0]===hex(m.deployment_block))return {hash:m.deployment_block_hash,number:hex(m.deployment_block),timestamp:'0x1'};
    if(method==='eth_chainId')return hex(m.chain_id);
    throw Error('No actual produced read or labelled identity supplement for '+method+' '+JSON.stringify(params));
  }};
  api.fetcher=async(url,options={})=>{
    const path=new URL(url).pathname.replace(/^\/api/,''),match=path.match(/\/wallets\/(0x[0-9a-f]{40})\/(nfts|summary|earnings)\/([0-9]+)\/([0-9]+)$/);
    state.paths.push(path);assert.ok(match,'Only fixed-block actual DTO requests are permitted');assert.equal(match[1],f.owner);assert.equal(Number(match[3]),anchor.block_number);
    const rows=f[match[2]==='nfts'?'inventory_pages':match[2]+'_pages'],part=rows.find(p=>p.offset===Number(match[4]));
    assert.ok(part,'Missing newly produced page');assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');
    state.active++;state.maximum=Math.max(state.maximum,state.active);
    try{await tick();return new Response(JSON.stringify(part));}finally{state.active--;}
  };
  const inventory=await api.walletInventory(f.owner,clone(anchor),{lifecycle:f.protocol.lifecycle});
  const values={},settled=await loadWalletFinancials(api,inventory,{onTotals:r=>{assert.equal(r.error,null);values.totals=r.value;},onEarnings:r=>{assert.equal(r.error,null);values.earnings=r.value;}});
  assert.deepEqual(settled.map(r=>r.status),['fulfilled','fulfilled']);assert.deepEqual(inventory.token_ids,f.token_ids);assert.equal(inventory.count,count);
  assert.equal(values.totals.lp_usd_18,f.expected.lp_usd_18);assert.equal(values.totals.claimable_eth_wei,f.expected.claimable_eth_wei);
  for(const period of ['all_time','last_24h']){
    for(const row of values.earnings[period])for(const field of fields)assert.equal(row[field+'_raw'],f.expected.raw[period][row.asset][field]);
    for(const field of fields)assert.equal(values.earnings[period+'_usd_at_current_price_18'][field],f.expected.usd[period][field]);
  }
  assert.equal(values.earnings.claims_and_conversions_are_income,false);assert.ok(state.maximum<=2);
  const pages=Math.ceil(count/16);for(const kind of ['nfts','summary','earnings'])assert.equal(state.paths.filter(p=>p.includes('/'+kind+'/')).length,pages);
  assert.equal(state.paths.length,pages*3);assert.ok(state.rpc.length>0);
});

for(const field of ['lp_usd_18','claimable_eth_wei'])test(`NEW empty-wallet positive ${field} is rejected as contradictory`,async()=>{
  const s=harness({count:0});
  // Only the aggregate summary is malformed; the complete empty inventory is valid.
  const original=s.api.request.bind(s.api);
  s.api.request=async(path,...args)=>{const part=await original(path,...args);if(path.includes('/summary/'))part[field]='1';return part;};
  await assert.rejects(s.api.walletTotals(s.inventory),/Empty.*(wallet|holdings)|empty.*(wallet|holdings)/);
});
