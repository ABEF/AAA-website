// NEW CWR09 orchestration/provenance checks. The immutable source10 producer
// DTOs and complete native graph fixture are reused as data, never old bodies.
// Heads, post-anchor activity and wallet-summary assembly are declared seams;
// these checks do not claim actual EVM, moving-provider or production adoption.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DeploymentAPI} from '../deployment-api.js';
import {WalletReadGate} from '../deployment-wallet-view.js';
import {source10APISetup} from './helpers/source10-api-fixture.mjs';

const copy=value=>structuredClone(value),hex=value=>'0x'+BigInt(value).toString(16);
const OTHER='0x'+'f'.repeat(40),BAD_HASH='0x'+'e'.repeat(64);
function setup({owner,capability=1,afterDetail=()=>{},earningsResponse,afterEarnings=()=>{}}={}){
  const source=source10APISetup('checkpoint2_earnings'),o=source.f.outputs,anchor=copy(o.protocol.provenance);
  owner??=o.inventory.wallet;
  const ids=Object.values(o.nfts).filter(n=>n.owner===owner).map(n=>n.token_id).sort((a,b)=>BigInt(a)<BigInt(b)?-1:1);
  const state={now:source.now,monotonic:0,head:anchor.observed_head,paths:[],reorg:false,depthLost:false,
    details:0,earnings:0,latestReads:0,anchor,ids,owner,source,postAnchor:[]};
  const protocol=copy(o.protocol);protocol.wallet_view_profile=1;
  if(capability!==undefined)protocol.fixed_block_nft_view_profile=capability;
  const inventory={...copy(o.inventory),wallet:owner,count:ids.length,token_ids:[...ids]};
  const reader={async request(request){
    if(request.method==='eth_blockNumber')return hex(state.depthLost?anchor.block_number+source.m.confirmations-2:state.head);
    const value=await source.reader.request(request);
    if(state.reorg&&request.method==='eth_getBlockByNumber'&&request.params[0]===hex(anchor.block_number))return {...value,hash:BAD_HASH};
    return value;
  }};
  const fetcher=async(url,options={})=>{
    const path=new URL(url).pathname.replace(/^\/api/,''),fixed=path.match(/^\/v1\/nfts\/(\d+)(\/earnings)?\/at\/(\d+)\/(0x[0-9a-f]{64})$/);
    state.paths.push(path);assert.equal(options.method,'GET');
    if(path==='/v1/protocol')return new Response(JSON.stringify(protocol));
    if(fixed){
      assert.equal(Number(fixed[3]),anchor.block_number);assert.equal(fixed[4],anchor.block_hash);
      if(!fixed[2]){
        state.details++;const row=copy(o.nfts[fixed[1]]);assert.ok(row);await afterDetail(state,row,options);
        return new Response(JSON.stringify(row));
      }
      state.earnings++;const row=copy(o.nft_earnings[fixed[1]]);assert.ok(row);
      if(earningsResponse)return earningsResponse(state,row,options);
      return new Response(JSON.stringify(row));
    }
    if(/^\/v1\/nfts\/\d+(\/earnings)?$/.test(path))state.latestReads++;
    return source.fetcher(url,options);
  };
  const api=new DeploymentAPI(source.m,{origin:'http://127.0.0.1:4190',reader,fetcher,clock:()=>state.now});
  api.readGate=new WalletReadGate({clock:()=>state.monotonic,sleep:async delay=>{state.monotonic+=delay;}});
  // Existing complete-wallet assembly is independently qualified. This seam
  // returns its original producer inventory, selected by literal fixture owner.
  api.walletView=async(wallet,p)=>{assert.equal(wallet,owner);assert.equal(p.block_hash,anchor.block_hash);return {inventory:copy(inventory),totals:copy(o.wallet_summary)};};
  const read=api.nftEarningsAt.bind(api);
  api.nftEarningsAt=async(...args)=>{const result=await read(...args);await afterEarnings(state,result,api);return result;};
  Object.assign(state,{api,protocol,inventory,read:()=>api.portfolio(owner)});return state;
}

test('NEW actual unmodified source10 earnings DTO stays coherent with cards while confirmed heads advance',async()=>{
  const baseline=setup(),otherOwner=Object.values(baseline.source.f.outputs.nfts).find(n=>n.owner!==baseline.owner).owner;
  for(const owner of [baseline.owner,otherOwner]){
    const h=setup({owner,afterDetail(state,row){
      state.head++;
      // Simultaneous later owner transfer, activation/growth and claim are
      // deliberately later-state facts; no old DTO or raw wire is relabeled.
      state.postAnchor.push({token_id:row.token_id,owner:OTHER,activated:true,growth_raw:'999999999999999999',claimed:true});
    }});
    const result=await h.read();assert.ok(h.head>h.anchor.observed_head);assert.equal(result.nfts.length,h.ids.length);
    for(const n of result.nfts){
      const expected=h.source.f.outputs.nfts[n.token_id],earned=h.source.f.outputs.nft_earnings[n.token_id];
      assert.deepEqual(n.position,expected.position);assert.deepEqual(n.claimable,expected.claimable);
      assert.equal(n.owner,owner);assert.deepEqual(n.earnings,earned);assert.equal(n.provenance.block_hash,h.anchor.block_hash);
      assert.equal('accounting_version' in earned.provenance,false);assert.equal('eip1898_require_canonical' in earned.provenance,false);
      assert.equal(n.earnings.window.through_timestamp_inclusive-n.earnings.window.after_timestamp_exclusive,86400);
    }
    assert.equal(h.latestReads,0);assert.equal(h.details,h.ids.length);assert.equal(h.earnings,h.ids.length);
    assert.equal(h.api.active,null);
    // Action preparation retains its separate fresh latest-NFT read boundary;
    // it cannot use a cached card as ownership/claim authority.
    const previous=h.api.fetcher;
    h.api.fetcher=async(url,options)=>{if(/\/v1\/nfts\/\d+$/.test(new URL(url).pathname))throw Error('fresh latest authority read');return previous(url,options);};
    await assert.rejects(h.api.prepare({action:'claim',account:owner,ids:[h.ids[0]]}),/fresh latest authority read/);
  }
});

test('NEW advertised fixed capability rejects wrong successful anchors and malformed earnings without latest fallback',async()=>{
  for(const kind of ['detail_hash','earnings_hash','earnings_currencies']){
    const h=setup({afterDetail(_state,row){if(kind==='detail_hash')row.provenance.block_hash=BAD_HASH;},
      earningsResponse(_state,row){if(kind==='earnings_hash')row.provenance.block_hash=BAD_HASH;else if(kind==='earnings_currencies')row.all_time.pop();return new Response(JSON.stringify(row));}});
    await assert.rejects(h.read(),/snapshot differs|Incomplete earnings currencies/);
    assert.equal(h.latestReads,0);assert.equal(h.api.active,null);
  }
  const missing=setup({earningsResponse(){return new Response('{}',{status:404});}});
  await assert.rejects(missing.read(),/API could not prepare/);assert.equal(missing.latestReads,0);
});

test('NEW fixed-history503 retains honest holdings only after live anchor checks; cancellation is never swallowed',async()=>{
  const h=setup({earningsResponse(){return new Response('{"error":"service_busy"}',{status:503});}});
  const result=await h.read();assert.equal(result.nfts[0].earnings.available,false);
  assert.deepEqual(result.nfts[0].claimable,h.source.f.outputs.nfts[h.ids[0]].claimable);
  assert.equal(h.latestReads,0);assert.equal(h.api.active,null);
  const abort=setup({earningsResponse(state){state.api.cancel();return new Response('{"error":"service_busy"}',{status:503});}});
  await assert.rejects(abort.read(),/cancelled|discarded/);assert.equal(abort.api.active,null);
});

test('NEW final canonical depth strict120-second and account-cancel guards survive successful fixed HTTP replies',async()=>{
  for(const failure of ['reorg','depth','expiry','account_cancel']){
    const h=setup({afterEarnings(state,_row,api){
      if(failure==='reorg')state.reorg=true;
      if(failure==='depth')state.depthLost=true;
      if(failure==='expiry')state.now=(state.anchor.block_timestamp+120)*1000;
      if(failure==='account_cancel')api.cancel();
    }});
    await assert.rejects(h.read(),/confirmed|stale|expired|cancelled|discarded/);
    assert.equal(h.latestReads,0);assert.equal(h.api.active,null);
  }
});

test('NEW absent capability preserves legacy latest routes and unsupported capability fails before card requests',async()=>{
  const legacy=setup({capability:undefined});delete legacy.protocol.fixed_block_nft_view_profile;
  const result=await legacy.read();assert.equal(result.nfts.length,1);assert.equal(legacy.latestReads,2);
  assert.equal(legacy.details,0);assert.equal(legacy.earnings,0);assert.equal(result.nfts[0].earnings.available,true);
  const unsupported=setup({capability:2});await assert.rejects(unsupported.read(),/Unsupported fixed-block NFT view profile/);
  assert.equal(unsupported.details,0);assert.equal(unsupported.latestReads,0);
});
