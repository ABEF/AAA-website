// NEW actual Python-reader DTO -> production JS assembly composition.
// Deployment/native graph, RPC headers and clocks are declared seams. The
// producing Python reader/getter parser/exact engine are identified in JSON;
// this is not a full F6/source10 runtime, real provider or site qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {DeploymentAPI} from '../deployment-api.js';
import {WalletReadGate} from '../deployment-wallet-view.js';

test('NEW actual backend aggregate DTOs compose with production consumer and independent exact totals',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/wallet-aggregate-20261127/producer.json',import.meta.url),'utf8'));
  assert.equal(fixture.kind,'actual_reader_produced_aggregate_consumer_fixture');assert.equal(fixture.production_approved,false);
  assert.equal(fixture.source_profile,null);assert.equal(fixture.mint_integration_version,null);assert.equal(fixture.canonical_version,null);
  assert.ok(fixture.seams.length>=4);assert.equal(fixture.accounting_version,7);
  const copy=value=>structuredClone(value),hex=value=>'0x'+BigInt(value).toString(16),requests=[],rpc=[];
  const manifest={chain_id:fixture.chain_id,accounting_version:7,projection_sha256:fixture.configuration_sha256,
    reward_assets:fixture.assets,contracts:fixture.contracts,confirmations:fixture.confirmations,
    max_age_seconds:fixture.max_age_seconds,deployment_block:fixture.deployment_block,api_prefix:'/api'};
  let now=fixture.anchor.block_timestamp*1000,monotonic=0,identities=0,proofs=0;
  const api=Object.create(DeploymentAPI.prototype);
  Object.assign(api,{manifest,revision:0,origin:'http://127.0.0.1:4191',clock:()=>now,active:null});
  api.readGate=new WalletReadGate({clock:()=>monotonic,sleep:async delay=>{monotonic+=delay;now+=delay;}});
  api.native={async verify(block){proofs++;assert.deepEqual(block,{blockHash:fixture.anchor.block_hash,requireCanonical:true});}};
  api.reader={async request({method,params=[]}){
    rpc.push(method);assert.doesNotMatch(method,/sign|send|nonce|anvil|trace/i);
    if(method==='eth_blockNumber')return hex(fixture.anchor.observed_head);
    if(method==='eth_getBlockByNumber'&&params[0]===hex(fixture.anchor.block_number))return {number:hex(fixture.anchor.block_number),hash:fixture.anchor.block_hash,timestamp:hex(fixture.anchor.block_timestamp)};
    throw Error('Unexpected neutral composition RPC');
  }};
  api.identity=async()=>{identities++;};
  // This deliberately neutral fixture declares no source9/source10 runtime
  // profile. The profile selector/typed endpoint method have separate NEW
  // checks. Here the real request/gate/provenance/validation/assembly consume
  // exact producer DTOs without inventing a deployment identity.
  api.walletAggregate=(owner,block,offset,signal)=>{
    assert.equal(owner,fixture.wallet);assert.equal(block,fixture.anchor.block_number);
    return api.request(`/v1/wallets/${owner}/aggregate/${block}/${offset}`,undefined,signal);
  };
  api.fetcher=async(url,options)=>{
    const path=new URL(url).pathname.replace(/^\/api/,''),view=path.match(/^\/v1\/wallets\/(0x[0-9a-f]{40})\/view\/(\d+)\/(\d+)\/0$/),aggregate=path.match(/^\/v1\/wallets\/(0x[0-9a-f]{40})\/aggregate\/(\d+)\/(\d+)$/),match=view??aggregate;
    assert.ok(match);assert.equal(match[1],fixture.wallet);assert.equal(Number(match[2]),fixture.anchor.block_number);
    assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    const part=(view?fixture.summary_pages:fixture.aggregate_pages)[match[3]];assert.ok(part);
    requests.push({kind:view?'summary':'aggregate',offset:Number(match[3]),started:monotonic});
    return new Response(JSON.stringify(part));
  };
  const first=fixture.summary_pages['0'];
  const result=await api.walletView(fixture.wallet,copy(fixture.anchor),{profile:2,lifecycle:copy(first.lifecycle)});
  assert.equal(result.inventory.complete,true);assert.equal(result.inventory.count,17);
  assert.equal(result.inventory.inventory_sha256,createHash('sha256').update(result.inventory.token_ids.join(','),'ascii').digest('hex'));
  assert.equal(result.totals.lp_usd_18,fixture.expected_lp_usd_18);assert.equal(result.totals.claimable_eth_wei,fixture.expected_claimable_eth_wei);
  assert.equal(result.earnings_error,null);assert.equal(result.earnings.scope,'wallet');assert.deepEqual(result.earnings.window,fixture.expected_window);
  for(const period of ['all_time','last_24h'])for(const row of result.earnings[period]){
    assert.deepEqual(Object.fromEntries(['lp_individual','lp_collective','royalties'].map(field=>[field+'_raw',row[field+'_raw']])),fixture.expected_earnings[period][row.asset]);
    for(const field of ['lp_individual','lp_collective','royalties'])assert.equal(row.usd_at_current_price_18[field],(BigInt(row[field+'_raw'])*BigInt(row.current_price.usd_per_token_18)/10n**BigInt(row.decimals)).toString());
  }
  assert.equal(result.earnings.all_time.length,fixture.assets.length);assert.equal(result.earnings.last_24h.length,fixture.assets.length);
  assert.deepEqual(requests.map(({kind,offset})=>({kind,offset})),[{kind:'summary',offset:0},{kind:'summary',offset:16},{kind:'aggregate',offset:0},{kind:'aggregate',offset:4}]);
  assert.ok(requests.every((row,index)=>index===0||row.started-requests[index-1].started>=1000));
  assert.equal(identities,1);assert.ok(proofs>=6);assert.ok(rpc.length>0);
  assert.ok(fixture.resource_observations.every(row=>Number.isInteger(row.RPC)&&row.RPC>=0&&row.RPC<=1024));
});
