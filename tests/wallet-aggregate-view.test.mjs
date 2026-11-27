// NEW explicit-profile2 consumer checks. No historical test module is imported.
// DTOs and clocks are synthetic; these are wire/accounting and cancellation
// proofs, not RPC, EVM, hosting or maximum-state producer qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DeploymentAPI} from '../deployment-api.js';
import {WalletReadGate} from '../deployment-wallet-view.js';
import {FRESH_CANONICAL_SCHEMA} from '../deployment-source9.js';
import {SOURCE10_CANONICAL_SCHEMA} from '../deployment-source10.js';

const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const hash=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const hex=n=>'0x'+BigInt(n).toString(16);
const copy=x=>structuredClone(x),digest=ids=>createHash('sha256').update(ids.join(','),'ascii').digest('hex');
const OWNER=address(30),OTHER=address(31),TIME=100000,BLOCK=99,BIG=(1n<<60n)+1n;
const fields=['lp_individual','lp_collective','royalties'];
const ownershipScope='Lifetime earnings of NFTs owned at this snapshot, including earlier owners; not personal wallet income.';
const tick=()=>new Promise(resolve=>queueMicrotask(resolve));

function fixture({count=17,source=10,assetCount=66,mutate=()=>{},onFetch=()=>{},
  price=a=>({available:true,usd_per_token_18:'3333333333333333333'}),
  amount=(i,a,period,f)=>BigInt(i+1)*BigInt(a+1)*BigInt(f+1)*(period==='all_time'?11n:3n)*BIG}={}){
  const assets=Array.from({length:assetCount},(_,i)=>({address:address(i?19+i:0),symbol:i===0?'ETH':i===1?'ZZZ':'CUR'+i,decimals:i<2?18:i===2?6:i%3===0?9:36}));
  const ids=Array.from({length:count},(_,i)=>((1n<<255n)+BigInt(i+1)).toString());
  const manifest={schema:source===10?5:4,source_profile:source,accounting_version:7,chain_id:31337,
    ...(source===10?{mint_integration_version:2,canonical_schema:SOURCE10_CANONICAL_SCHEMA}:{canonical_schema:FRESH_CANONICAL_SCHEMA}),
    deployment_block:1,deployment_block_hash:hash(1),genesis_hash:hash(12),confirmations:2,max_age_seconds:120,
    api_prefix:'/api',projection_sha256:'a'.repeat(64),contracts:{access:{address:address(1)},nft:{address:address(2)}},reward_assets:assets};
  const anchor={block_number:BLOCK,block_hash:hash(BLOCK),block_timestamp:TIME,observed_head:BLOCK+1,confirmations:2,
    configuration_sha256:manifest.projection_sha256,accounting_version:7,finality:'confirmation_depth_only',protocol_finalized:false,eip1898_require_canonical:true};
  const lifecycle={state:'operating',new_economic_work_available_by_lifecycle:true,claims_available_by_lifecycle:true,
    transfers_available_by_lifecycle:true,predecessor_controller:null,lp_exit_started:false};
  const history={available:true,from_block:1,start_block_hash:hash(1),start_parent_hash:hash(2),through_block:BLOCK,
    block_hash:anchor.block_hash,minted_count:count,indexer_next_block:BLOCK+2};
  const s={assets,ids,manifest,anchor,lifecycle,history,now:TIME*1000,monotonic:0,requests:[],rpc:[],identities:0,
    currentHash:anchor.block_hash,currentHead:BLOCK+1,maximum:0,active:0};
  const api=Object.create(DeploymentAPI.prototype);s.api=api;
  Object.assign(api,{manifest,origin:'http://127.0.0.1:4190',clock:()=>s.now,revision:0,active:null});
  api.readGate=new WalletReadGate({clock:()=>s.monotonic,sleep:async(ms,signal)=>{if(signal?.aborted)throw Error('cancelled');s.monotonic+=ms;s.now+=ms;}});
  api.reader={async request({method,params=[]}){
    s.rpc.push({method,params});assert.doesNotMatch(method,/send|sign|nonce|trace|anvil/i);
    if(method==='eth_blockNumber')return hex(s.currentHead);
    if(method==='eth_getBlockByNumber'&&params[0]===hex(BLOCK))return {number:hex(BLOCK),hash:s.currentHash,timestamp:hex(TIME)};
    throw Error('Unexpected aggregate fixture RPC '+method);
  }};
  api.native={async verify(block){assert.deepEqual(block,{blockHash:anchor.block_hash,requireCanonical:true});}};
  api.identity=async()=>{s.identities++;};
  const currency=offset=>{const rows=assets.slice(offset,offset+4);return {asset_offset:offset,asset_chunk_size:4,asset_count:assets.length,
    asset_ids:assets.map(a=>a.address),selected_asset_ids:rows.map(a=>a.address),asset_inventory_sha256:digest(assets.map(a=>a.address)),next_asset_offset:offset+rows.length<assets.length?offset+rows.length:null};};
  const common=()=>({schema:1,chain_id:manifest.chain_id,wallet:OWNER,nft_contract:manifest.contracts.nft.address,count,inventory_sha256:digest(ids),lifecycle:copy(lifecycle),provenance:copy(anchor)});
  s.summary=offset=>{
    const selected=ids.slice(offset,offset+16),next=offset+selected.length<count?offset+selected.length:null;
    const identity={...common(),offset,chunk_size:16,token_ids:selected,next_offset:next};
    return {...copy(identity),kind:'fixed_block_wallet_view_page',available:true,verified_count:selected.length,
      complete:offset===0&&selected.length===count,history:copy(history),...currency(0),
      summary:{...copy(identity),lp_usd_18:selected.reduce((sum,id)=>sum+(1n<<70n)+BigInt(ids.indexOf(id)),0n).toString(),
        claimable_eth_wei:selected.reduce((sum,id)=>sum+(1n<<65n)+BigInt(ids.indexOf(id)),0n).toString()},
      earnings:null,earnings_error:'aggregate_earnings_required'};
  };
  s.aggregate=offset=>{
    const slice=currency(offset),selected=assets.slice(offset,offset+4),earnings={...common(),available:true,scope:'wallet',
      token_ids:[...ids],ownership_scope:ownershipScope,...copy(slice),claims_and_conversions_are_income:false,
      unprocessed_revenue_included:false,clock:'on-chain processing/allocation time',
      window:{through_timestamp_inclusive:TIME,after_timestamp_exclusive:TIME-86400}};
    earnings.provenance.epochs=[{controller:manifest.contracts.access.address,history:copy(history),activation_cutoff:null}];
    for(const period of ['all_time','last_24h']){
      earnings[period]=selected.map(asset=>{
        const a=assets.indexOf(asset),mark=price(a),amounts=fields.map((_,f)=>ids.reduce((sum,_id,i)=>sum+amount(i,a,period,f),0n));
        const usd=n=>mark.available?n*BigInt(mark.usd_per_token_18)/10n**BigInt(asset.decimals):n===0n?0n:null;
        return {asset:asset.address,symbol:asset.symbol,decimals:asset.decimals,current_price:copy(mark),
          ...Object.fromEntries(fields.map((field,f)=>[field+'_raw',amounts[f].toString()])),
          usd_at_current_price_18:Object.fromEntries(fields.map((field,f)=>[field,usd(amounts[f])===null?null:usd(amounts[f]).toString()]))};
      });
      earnings[period+'_usd_at_current_price_18']=Object.fromEntries(fields.map(field=>[field,earnings[period].some(row=>row.usd_at_current_price_18[field]===null)?null:earnings[period].reduce((sum,row)=>sum+BigInt(row.usd_at_current_price_18[field]),0n).toString()]));
    }
    return {...common(),kind:'fixed_block_wallet_earnings_page',available:true,token_ids:[...ids],verified_count:count,complete:true,
      history:copy(history),...slice,earnings,earnings_error:null};
  };
  api.fetcher=async(url,options={})=>{
    const path=new URL(url).pathname.replace(/^\/api/,''),view=path.match(/^\/v1\/wallets\/(0x[0-9a-f]{40})\/view\/(\d+)\/(\d+)\/0$/),aggregate=path.match(/^\/v1\/wallets\/(0x[0-9a-f]{40})\/aggregate\/(\d+)\/(\d+)$/),match=view??aggregate;
    assert.ok(match,'Only explicit wallet read endpoints are permitted');assert.equal(match[1],OWNER);assert.equal(Number(match[2]),BLOCK);
    assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    const kind=view?'view':'aggregate',offset=Number(match[3]);s.requests.push({path,kind,offset,started:s.monotonic,signal:options.signal});
    const part=view?s.summary(offset):s.aggregate(offset);s.maximum=Math.max(s.maximum,++s.active);
    try{await tick();const response=await onFetch(kind,offset,s,options,part);if(response)return response;await mutate(part,kind,offset,s);return new Response(JSON.stringify(part));}
    finally{s.active--;}
  };
  s.read=(options={})=>api.walletView(OWNER,copy(anchor),{profile:2,lifecycle:copy(lifecycle),...options});
  return s;
}

for(const source of [9,10])for(const count of [0,1,17,1000])test(`NEW aggregate profile2 source${source} ${count} NFTs completes66 currencies without cross-product reads`,async()=>{
  const s=fixture({source,count}),out=await s.read(),triangular=BigInt(count)*BigInt(count+1)/2n,index=BigInt(count)*BigInt(Math.max(0,count-1))/2n;
  assert.deepEqual(out.inventory.token_ids,s.ids);assert.equal(out.inventory.inventory_sha256,digest(s.ids));assert.equal(out.inventory.complete,true);
  assert.equal(out.totals.lp_usd_18,(BigInt(count)*(1n<<70n)+index).toString());assert.equal(out.totals.claimable_eth_wei,(BigInt(count)*(1n<<65n)+index).toString());
  assert.equal(out.earnings.scope,'wallet');assert.equal(out.earnings.ownership_scope,ownershipScope);assert.equal(out.earnings_error,null);
  assert.deepEqual(out.earnings.window,{through_timestamp_inclusive:TIME,after_timestamp_exclusive:TIME-86400});
  for(const period of ['all_time','last_24h'])for(const [a,row] of out.earnings[period].entries())for(const [f,field] of fields.entries()){
    const expected=triangular*BigInt(a+1)*BigInt(f+1)*(period==='all_time'?11n:3n)*BIG;
    assert.equal(row[field+'_raw'],expected.toString());assert.equal(row.usd_at_current_price_18[field],(expected*3333333333333333333n/10n**BigInt(row.decimals)).toString());
  }
  assert.equal(s.requests.filter(row=>row.kind==='view').length,Math.max(1,Math.ceil(count/16)));assert.equal(s.requests.filter(row=>row.kind==='aggregate').length,17);
  assert.equal(s.requests.length,Math.max(1,Math.ceil(count/16))+17);assert.equal(s.maximum,1);assert.equal(s.identities,1);
  assert.ok(s.requests.every((row,i)=>i===0||row.started-s.requests[i-1].started>=1000));assert.ok(s.now<(TIME+120)*1000);
});

test('NEW aggregate missing prices preserve exact zero versus unavailable USD',async()=>{
  const s=fixture({count:17,assetCount:6,price:a=>a===4?{available:false,usd_per_token_18:null,reason:'unavailable'}:{available:true,usd_per_token_18:'1'},amount:(i,a,_period,f)=>a===4?0n:BigInt(i+a+f+1)});
  const out=await s.read();for(const period of ['all_time','last_24h'])for(const field of fields)assert.equal(out.earnings[period][4].usd_at_current_price_18[field],'0');
  const unavailable=fixture({count:17,assetCount:6,price:a=>a===4?{available:false,usd_per_token_18:null,reason:'unavailable'}:{available:true,usd_per_token_18:'1'}});
  const other=await unavailable.read();for(const field of fields)assert.equal(other.earnings.all_time_usd_at_current_price_18[field],null);
});

test('NEW aggregate cursor method rejects malformed owner block and currency offsets before fetch',()=>{
  const s=fixture();for(const args of [[OTHER,99,1],[OWNER,0,0],[OWNER,99,-4],[OWNER,99,68],[OWNER,99,1],[OWNER,99,true],[address(0),99,0]])assert.throws(()=>s.api.walletAggregate(...args),/Invalid aggregate wallet cursor/);
  assert.equal(s.requests.length,0);assert.throws(()=>s.api.walletView(OWNER,s.anchor,{profile:null}),/Unsupported wallet view profile/);
});

test('NEW aggregate missing duplicated and changed inventory or currency envelopes are rejected',async()=>{
  const changes=[
    p=>p.inventory_sha256='b'.repeat(64),p=>p.count++,p=>p.token_ids.reverse(),p=>p.verified_count--,p=>p.complete=false,
    p=>p.selected_asset_ids.reverse(),p=>p.asset_count--,p=>p.asset_inventory_sha256='b'.repeat(64),p=>p.next_asset_offset=8,
    p=>p.asset_ids.pop(),p=>p.wallet=OTHER,p=>p.chain_id++,p=>p.nft_contract=OTHER,p=>p.offset=0,
    p=>p.provenance.block_hash=hash(66),p=>p.provenance.configuration_sha256='b'.repeat(64),p=>p.history.start_parent_hash=hash(67),
    p=>p.lifecycle.state='changed',p=>p.earnings.token_ids.pop(),p=>p.earnings.ownership_scope='Personal wallet income',p=>p.earnings.all_time.pop(),
  ];
  for(const change of changes){const s=fixture({count:17,assetCount:6,mutate:(part,kind)=>{if(kind==='aggregate')change(part);}});await assert.rejects(s.read());}
});

test('NEW aggregate window raw precision and contradictory provenance are rejected',async()=>{
  for(const change of [p=>p.earnings.window.after_timestamp_exclusive++,p=>p.earnings.claims_and_conversions_are_income=true,
    p=>p.earnings.all_time[0].lp_individual_raw=1,p=>p.earnings.last_24h[0].current_price.usd_per_token_18='2',
    p=>p.earnings.provenance.confirmations=1,p=>p.earnings.provenance.accounting_version=6,p=>p.earnings.provenance.protocol_finalized=true]){
    const s=fixture({count:1,assetCount:6,mutate:(part,kind)=>{if(kind==='aggregate')change(part);}});await assert.rejects(s.read());
  }
});

test('NEW aggregate epoch identity is stable but ambient indexer progress is allowed',async()=>{
  const pass=fixture({count:17,assetCount:6,mutate:(part,kind,offset)=>{if(kind==='aggregate'){part.history.indexer_next_block+=offset;part.earnings.provenance.epochs[0].history.indexer_next_block+=offset;}}});
  assert.equal((await pass.read()).earnings.all_time.length,6);
  for(const change of [p=>p.earnings.provenance.epochs[0].history.start_parent_hash=hash(7),p=>p.earnings.provenance.epochs[0].activation_cutoff={block:50,transaction:1},p=>p.earnings.provenance.epochs.push(copy(p.earnings.provenance.epochs[0]))]){
    const s=fixture({count:17,assetCount:6,mutate:(part,kind,offset)=>{if(kind==='aggregate'&&offset===4)change(part);}});await assert.rejects(s.read());
  }
});

for(const status of [429,503])test(`NEW aggregate isolated${status} currency transport preserves complete holdings and totals`,async()=>{
  const s=fixture({count:17,assetCount:6,onFetch:(kind,offset)=>kind==='aggregate'&&offset===4?new Response(status===503?'{"error":"service_busy"}':'{}',{status}):null});
  const out=await s.read();assert.equal(out.inventory.complete,true);assert.notEqual(out.totals.lp_usd_18,null);assert.equal(out.earnings,null);assert.match(out.earnings_error,/unavailable/);
  assert.equal(s.requests.filter(row=>row.kind==='view').length,2);assert.equal(s.requests.filter(row=>row.kind==='aggregate').length,2);
});

test('NEW aggregate explicit unavailable requires honest verification flags and complete identity',async()=>{
  const unavailable=part=>{part.earnings=null;part.earnings_error='earnings_unavailable';part.verified_count=0;part.complete=false;};
  const good=fixture({count:17,assetCount:6,mutate:(part,kind)=>{if(kind==='aggregate')unavailable(part);}});assert.equal((await good.read()).earnings,null);
  for(const change of [p=>p.verified_count=p.count,p=>p.complete=true,p=>p.token_ids.pop(),p=>p.inventory_sha256='f'.repeat(64),p=>p.earnings_error='unknown']){
    const s=fixture({count:17,assetCount:6,mutate:(part,kind)=>{if(kind==='aggregate'){unavailable(part);change(part);}}});await assert.rejects(s.read());
  }
});

test('NEW aggregate generic projection failures remain fatal without fallback',async()=>{
  const s=fixture({count:17,assetCount:6,onFetch:kind=>kind==='aggregate'?new Response('{"error":"confirmed_projection_unavailable"}',{status:503}):null});
  await assert.rejects(s.read(),error=>error.status===503&&error.apiCode===undefined);assert.equal(s.requests.length,3);
});

test('NEW aggregate NFT pages require explicit profile2 marker and ordered complete identities',async()=>{
  for(const change of [p=>p.earnings_error='earnings_unavailable',p=>p.earnings={},p=>p.token_ids.reverse(),p=>p.summary.token_ids.pop(),p=>p.summary.provenance.finality='finalized',p=>p.next_offset=32]){
    const s=fixture({count:17,assetCount:6,mutate:(part,kind)=>{if(kind==='view')change(part);}});await assert.rejects(s.read());assert.equal(s.requests.filter(row=>row.kind==='aggregate').length,0);
  }
});

for(const phase of ['view','aggregate'])test(`NEW aggregate cancellation during${phase} sends no later page`,async()=>{
  const controller=new AbortController(),s=fixture({count:17,assetCount:6,onFetch:(kind)=>{if(kind===phase)controller.abort();}});
  await assert.rejects(s.read({signal:controller.signal}),/cancelled|superseded/);assert.equal(s.requests.at(-1).kind,phase);assert.equal(s.identities,0);
});

for(const mode of ['revision','expiry','hash'])test(`NEW aggregate final${mode} change rejects already assembled financials`,async()=>{
  const s=fixture({count:17,assetCount:6});s.api.identity=async()=>{s.identities++;if(mode==='revision')s.api.revision++;else if(mode==='expiry')s.now=(TIME+120)*1000;else s.currentHash=hash(7);};
  if(mode==='hash'){
    const read=s.api.reader.request.bind(s.api.reader);let calls=0;s.api.reader.request=async request=>{if(request.method==='eth_getBlockByNumber'&&++calls===6)s.currentHash=hash(7);return read(request);};
  }
  await assert.rejects(s.read(),mode==='revision'?/superseded/:mode==='expiry'?/expired/:/not confirmed/);
});

test('NEW aggregate explicit capability2 portfolio uses new path and never a signing method',async()=>{
  const s=fixture({count:0,assetCount:6});let capability=2;
  s.api.protocol=async()=>({wallet_view_profile:capability,provenance:copy(s.anchor),lifecycle:copy(s.lifecycle)});
  const out=await s.api.portfolio(OWNER);assert.equal(out.financials.inventory.complete,true);assert.equal(out.financials.earnings.all_time.length,6);
  assert.equal(s.requests.filter(row=>row.kind==='view').length,1);assert.equal(s.requests.filter(row=>row.kind==='aggregate').length,2);
  capability=3;await assert.rejects(s.api.portfolio(OWNER),/Unsupported wallet view profile/);assert.equal(s.requests.length,3);
  assert.ok(s.rpc.every(row=>! /send|sign|nonce|anvil|trace/i.test(row.method)));
});
