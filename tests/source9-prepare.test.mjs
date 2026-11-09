import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareFresh,activationAmountFresh,source9ClaimEntries} from '../deployment-source9-prepare.js';
import {freshSelector,FreshProfile,FRESH_CANONICAL_SCHEMA} from '../deployment-source9.js';
import {createChainReader} from '../browser-wallet.js';
import {ZERO,DeploymentAPI} from '../deployment-api.js';
import {source9Setup} from './helpers/source9-profile-fixture.mjs';

const fixture=JSON.parse(await readFile(new URL('./fixtures/source9-api-v3.json',import.meta.url)));
const hash=c=>'0x'+c.repeat(64),address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const word=n=>BigInt(n).toString(16).padStart(64,'0'),hex=n=>'0x'+BigInt(n).toString(16),U=10n**18n;
const block={blockHash:hash('b'),requireCanonical:true};
const keys=c=>({token_id:c.token_id,asset:c.asset,royalty:c.royalty});
const policyJSON=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,typeof v==='bigint'||typeof v==='number'?String(v):v]));
const claimData=claims=>'0xbbeaec93'+word(32)+word(claims.length)+claims.map(c=>word(c.token_id)+word(BigInt(c.asset))+word(c.royalty?1:0)).join('');
const claimOutput=claims=>'0x'+word(32)+word(claims.length)+claims.map(c=>word(c.simulated_raw)).join('');

// These tests isolate unsigned review validation. Claim DTOs are emitted by the
// actual Python Transactions/ClaimPlanner, with explicitly synthetic RPC state.
// Entry cases below are typed local DTO fixtures, not real EVM execution proof.
function setup(policy=1){
  const f=structuredClone(fixture.cases['claim_policy'+policy]),draft=f.outputs.draft,plan=f.outputs.plan;
  const assets=f.read_configuration.assets.map(a=>({...a,enabled:true,runtime_code:a.address===ZERO?undefined:f.codes[a.address]}));
  const m={schema:4,...f.profile,canonical_schema:FRESH_CANONICAL_SCHEMA,transaction_policy_schema:policy,chain_id:31337,max_age_seconds:120,pool_id:hash('8'),input_assets:assets.filter(a=>['ETH','ZZZ'].includes(a.symbol)),reward_assets:assets,contracts:Object.fromEntries(Object.entries(f.pins).map(([role,a])=>[role,{address:a,runtime_code:f.codes[a]}])),limits:{gas:policy===2?40000000:12000000,gas_price_wei:'100000000000',network_fee_wei:U.toString(),native_value_wei:(1000n*U).toString(),contribution_usd_18:(1000n*U).toString(),maximum_contribution_loss_bps:200},transaction_fee_review:hash('9'),activation_fee_review:hash('9')};
  m.contracts.entry={address:address(113),runtime_code:'0x6001'};m.contracts.protocol_policy={address:address(114),runtime_code:'0x6002'};
  const s={f,m,draft,plan,now:4000000,calls:[],requests:[],identityCalls:0,headers:0,estimate:100000n,price:1000000000n,balance:1000n*U,simulations:new Map([[draft.transaction.data,claimOutput(draft.claim_operations)]])};
  s.nft=structuredClone(f.outputs.nft);s.protocol=structuredClone(f.outputs.protocol);
  s.terms={version:1,domain:'entry',policy:m.contracts.protocol_policy.address,fingerprint:hash('e'),minimum_activation_usd_18:100n*U,minimum_growth_usd_18:5n*U,maximum_idle_bps:500,revision:1n};
  s.loss=200;s.poolMinimum=0n;s.poolMaximum=1000n*U;s.lower=U;s.upper=U;
  s.api={manifest:m,clock:()=>s.now,identity:async()=>{s.identityCalls++;if(s.identityHook)await s.identityHook();},protocol:async()=>s.protocol,nft:async(id,owner)=>{assert.equal(id,s.nft.token_id);assert.equal(owner,s.nft.owner);return s.nft;},asset:symbol=>{const a=m.input_assets.find(a=>a.symbol===symbol&&a.enabled);if(!a)throw Error('Asset disabled');return a;},provenance:async(p)=>{assert.equal(p.block_hash,block.blockHash);assert.equal(p.block_number,99);return block;},request:async(path,payload)=>{s.requests.push({path,payload});if(path==='/v1/claims/plan')return s.plan;if(path==='/v1/activation/prepare'||path==='/v1/transactions/prepare')return s.draft;throw Error('Unexpected endpoint');},native:{price:async(_asset,b)=>{assert.deepEqual(b,block);return {lower:s.lower,upper:s.upper,fingerprint:hash('d'),policy_id:hash('f')};},cap:async b=>{assert.deepEqual(b,block);return s.loss;},entryPolicy:async b=>{assert.deepEqual(b,block);return s.terms;}}};
  s.api.reader={request:async({method,params=[]})=>{
    s.calls.push({method,params});assert.ok(!/send|sign|nonce|anvil/i.test(method),'No wallet mutation or nonce request');
    if(s.rpcHook){const result=await s.rpcHook(method,params);if(result!==undefined)return result;}
    if(method==='eth_getBlockByNumber'){assert.equal(params[0],'0x63');s.headers++;return {hash:hash('b'),number:'0x63',timestamp:'0xfa0',gasLimit:hex(s.blockLimit??40000000)};}
    if(method==='eth_getCode'){assert.deepEqual(params[1],block);return Object.values(m.contracts).find(c=>c.address===params[0])?.runtime_code||m.input_assets.find(a=>a.address===params[0])?.runtime_code;}
    if(method==='eth_call'){
      assert.deepEqual(params[1],block);
      if(params[0].data==='0xb95559a1'+m.pool_id.slice(2))return '0x'+[0,BigInt(m.input_assets[1].address),10020,200,0,1,1,1,1,1,200,0,s.poolMinimum,s.poolMaximum].map(word).join('');
      assert.equal(params.length,2,'No state or balance overrides');assert.ok(params[0].gas);assert.equal(params[0].chainId,undefined);
      const result=s.simulations.get(params[0].data);if(result===undefined)throw Error('Independent RPC refused exact calldata');return result;
    }
    if(method==='eth_estimateGas'){assert.deepEqual(params[1],block);return hex(s.estimate);}
    if(method==='eth_gasPrice')return hex(s.price);
    if(method==='eth_getBalance'){assert.deepEqual(params[1],block);return hex(s.balance);}
    throw Error('Unexpected RPC '+method);
  }};
  s.intent={action:'claim',account:f.request.wallet,claims:f.request.claims};return s;
}

function entrySetup({asset='ETH',action='activate',approval=false}={}){
  const s=setup(),source=s.api.asset(asset),amount=100n*U,id=s.nft.token_id;
  s.nft.position.activated=action==='increase';s.nft.position.status=action==='increase'?'active':'dormant';
  const data='0x6169e438'+word(id)+s.m.pool_id.slice(2)+word(BigInt(source.address))+word(amount)+word(99)+word(4060)+word(action==='increase'?1:0)+word(200)+s.terms.fingerprint.slice(2);
  s.draft={schema:1,kind:approval?'approval_required':'activation_transaction',action,token_id:id,pool_id:s.m.pool_id,activation_ready:!approval,transaction:{from:s.intent.account,to:approval?source.address:s.m.contracts.entry.address,value:!approval&&asset==='ETH'?hex(amount):'0x0',chainId:'0x7a69',data:approval?'0x095ea7b3'+word(BigInt(s.m.contracts.entry.address))+word(amount):data},approval_steps:approval?[{asset:source.address,spender:s.m.contracts.entry.address,amount_raw:amount.toString(),reset_first:false,reprepare_after_confirmation:true}]:[],source:{asset:source.address,amount_raw:amount.toString(),value_usd_18:(100n*U).toString()},contribution:approval?null:{source_usd_18:(100n*U).toString(),required_deployed_usd_18:(98n*U).toString(),marginal_deployed_usd_18:(99n*U).toString(),net_contribution_usd_18:(99n*U).toString(),shares_added_raw:'500',lp_liquidity_added_raw:'100',lp_token_id:'200',converted_amount_raw:amount.toString(),simulation_gas_used:'90000'},contribution_policy:policyJSON(s.terms),execution_limit_bps:200,reviewed_maximum_loss_bps:200,minimum_deployed_usd_18:(98n*U).toString(),minimum_liquidity_raw:approval?null:'99',minimum_conversion_output_raw:null,network_gas:{...s.draft.network_gas,included_in_execution_loss:false},prepared_at:4000,expires_at:4060,onchain_deadline:approval?null:4060,provenance:{...s.draft.provenance,accounting_version:7,routing_version:3,pricing_version:2,review_policy_version:2},wallet_revalidation_required:true,state_overrides:false,liquidity_context:{portfolio:{main:{token_id:'200'},residual:null}}};
  s.intent={action,account:s.intent.account,id,asset,amount:'100'};s.simulations.set(s.draft.transaction.data,approval?'0x'+word(1):'0x');return s;
}

for(const policy of [1,2])test('actual Python policy'+policy+' original-currency claim DTO is independently reviewed and frozen',async()=>{
  const s=setup(policy),r=await prepareFresh(s.api,s.intent);
  assert.deepEqual(r.transaction,s.draft.transaction);assert.deepEqual(r.claims,s.draft.claim_operations);
  assert.equal(r.signing_enabled,false);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.claims));assert.equal(r.transaction.nonce,undefined);
  assert.ok(s.calls.some(c=>c.method==='eth_call')&&s.calls.some(c=>c.method==='eth_estimateGas'));
  assert.equal(s.requests[0].path,'/v1/transactions/prepare');
});

for(const policy of [1,2])test('actual Python policy'+policy+' planner retains every explicit classification and only one next batch',async()=>{
  const s=setup(policy),r=await prepareFresh(s.api,{...s.intent,plan:true});
  assert.equal(s.requests[0].path,'/v1/claims/plan');assert.deepEqual(r.claim_plan,s.plan);assert.equal(r.claim_plan.replan_after_confirmation,true);assert.equal(r.claim_plan.automatic_submission,false);
  assert.equal(r.claim_plan.entries.length,s.intent.claims.length);assert.deepEqual(r.transaction,s.plan.next_batch.transaction);
});

for(const policy of [1,2])test('complete DeploymentAPI and FreshProfile review actual Python policy'+policy+' ID-selected claim planning',async()=>{
  const s=source9Setup('claim_policy'+policy);
  const reader=createChainReader(s.m.rpc_url,{fetcher:async(_url,options)=>{
    const request=JSON.parse(options.body),result=await s.reader.request(request);
    return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
  }});
  const api=new DeploymentAPI(s.m,{origin:'http://127.0.0.1:4190',reader,fetcher:s.fetcher,clock:()=>s.now});
  const r=await api.prepare({action:'claim',account:s.f.nft.owner,ids:[s.f.nft.token_id],plan:true});
  assert.ok(api.native instanceof FreshProfile);assert.equal(r.signing_enabled,false);
  assert.deepEqual(r.transaction,s.f.plan.next_batch.transaction);assert.equal(r.claim_plan.entries.length,3);
  assert.equal(r.claims.find(c=>c.symbol==='USDC'&&c.royalty).simulated_raw,'25000001');
  assert.ok(r.claims.filter(c=>!c.royalty).every(c=>c.asset===ZERO));
  assert.ok(s.calls.some(c=>c.method==='eth_estimateGas'));
  assert.ok(!s.calls.some(c=>c.method&&/send|sign|nonce|trace|anvil/i.test(c.method)));
});

test('ordinary selection preserves royalty currencies and leaves LP ZZZ pending',async()=>{
  const s=setup(),n=s.nft,entries=source9ClaimEntries(n);
  assert.ok(n.claimable.lp.some(a=>a.symbol==='ZZZ'&&BigInt(a.raw)>0n));
  assert.ok(entries.some(c=>c.royalty&&c.asset===address(21)));assert.ok(entries.filter(c=>!c.royalty).every(c=>c.asset===ZERO));
  assert.deepEqual(entries,s.intent.claims);
  const r=await prepareFresh(s.api,{action:'claim',account:s.intent.account,ids:[n.token_id]});assert.equal(r.claims.length,3);
  n.claimable.royalties.find(a=>a.asset===address(21)).raw=null;n.claimable.royalties.find(a=>a.asset===address(21)).available=false;
  assert.ok(!source9ClaimEntries(n).some(c=>c.asset===address(21)));
});

test('partial plan keeps blocked and unassessed selections visible for a fresh replan',async()=>{
  const s=setup();
  const d=s.plan.next_batch;d.claim_operations=d.claim_operations.slice(0,1);d.transaction.data=claimData(d.claim_operations);s.simulations.set(d.transaction.data,claimOutput(d.claim_operations));
  s.plan.entries[1].status='blocked';s.plan.entries[1].reason='royalty_window_not_open';
  s.plan.entries[2].status='unassessed';s.plan.entries[2].reason='replan_after_confirmation';
  s.plan.remaining_claims=s.plan.entries.slice(1).map(({selection_index,status,reason,...row})=>({...keys(row),selection_index,status,reason}));
  const r=await prepareFresh(s.api,{...s.intent,plan:true});assert.equal(r.claims.length,1);assert.equal(r.claim_plan.entries.length,3);assert.equal(r.claim_plan.remaining_claims.length,2);assert.equal(s.requests.length,1);
});

test('no executable plan returns all zero, blocked and unavailable rows without an executable transaction',async()=>{
  const s=setup();s.plan.next_batch=null;s.plan.planning.final_batch_revalidated=false;
  for(const [i,status] of ['zero','blocked','unavailable'].entries()){s.plan.entries[i].status=status;s.plan.entries[i].reason='explicit_'+status;}
  s.plan.entries[0].view_raw='0';s.plan.entries[2].view_raw=null;
  s.plan.remaining_claims=s.plan.entries.slice(1).map(({selection_index,status,reason,...row})=>({...keys(row),selection_index,status,reason}));
  const r=await prepareFresh(s.api,{...s.intent,plan:true});assert.equal(r.transaction,null);assert.equal(r.network_gas,null);assert.equal(r.claim_plan.entries.length,3);assert.equal(s.calls.length,0);assert.equal(s.requests.length,1);
});

for(const [name,change] of [
  ['omitted selection',s=>s.plan.entries.pop()],['unclassified selection',s=>s.plan.entries[0].status='pending'],
  ['hidden remainder',s=>s.plan.remaining_claims.push({...s.intent.claims[0],selection_index:0,status:'blocked',reason:'bad'})],
  ['automatic submission',s=>s.plan.automatic_submission=true],['eleven trials',s=>s.plan.planning.trial_count=11],
  ['changed batch snapshot',s=>s.plan.next_batch.provenance.block_hash=hash('a')],
])test('planner rejects '+name,async()=>{const s=setup();change(s);await assert.rejects(prepareFresh(s.api,{...s.intent,plan:true}));});

test('explicit claim selection rejects repeated identities, too many operations and unreviewed currency',async()=>{
  const s=setup();for(const claims of [[s.intent.claims[0],s.intent.claims[0]],Array(33).fill(s.intent.claims[0]),[{...s.intent.claims[0],asset:address(222)}]])await assert.rejects(prepareFresh(s.api,{...s.intent,claims}));
});

for(const options of [{asset:'ETH'},{asset:'ZZZ'},{asset:'ETH',action:'increase'},{asset:'ZZZ',action:'increase'},{asset:'ZZZ',approval:true}])test('direct Entry3 '+JSON.stringify(options)+' uses the exact seven-field tuple and scoped review',async()=>{
  const s=entrySetup(options),r=await prepareFresh(s.api,s.intent);
  assert.equal(freshSelector('executeReviewed((uint256,bytes32,address,uint256,uint128,uint256,bool),uint16,bytes32)'),'0x6169e438');
  assert.deepEqual(r.transaction,s.draft.transaction);assert.equal(r.action,options.approval?'approve':s.intent.action);assert.equal(r.expected_contribution_policy,s.terms.fingerprint);
  if(!options.approval){assert.equal(r.transaction.data.length,10+9*64);assert.equal(r.simulated_lp_added_usd_18,(99n*U).toString());}
  else assert.equal(r.simulated_lp_added_usd_18,null);
});

for(const [name,change] of [
  ['old routed selector',s=>s.draft.transaction.data='0x7d2edfe7'+s.draft.transaction.data.slice(10)],
  ['preconversion minimum',s=>s.draft.minimum_conversion_output_raw='0'],
  ['changed scoped policy',s=>s.draft.contribution_policy.fingerprint=hash('a')],
  ['changed policy minimum',s=>s.draft.contribution_policy.minimum_activation_usd_18=(101n*U).toString()],
  ['raised same-block governed minimum',s=>s.terms.minimum_activation_usd_18=101n*U],
  ['stronger admitted pool minimum',s=>s.poolMinimum=101n*U],
  ['wider current cap',s=>s.loss=300],['caller cap changed',s=>s.intent.maximum_loss_bps=100],
  ['incumbent value replacing marginal LP',s=>s.draft.contribution.marginal_deployed_usd_18=(97n*U).toString()],
  ['missing actual added liquidity',s=>s.draft.contribution.lp_liquidity_added_raw='0'],
  ['changed exact source',s=>s.draft.contribution.converted_amount_raw=(101n*U).toString()],
  ['unfunded share issuance',s=>s.draft.contribution.shares_added_raw='0'],
  ['state overrides',s=>s.draft.state_overrides=true],['expiry',s=>s.now=4060000],
  ['wrong native value',s=>s.draft.transaction.value='0x0'],
])test('fresh contribution rejects '+name,async()=>{const s=entrySetup();change(s);await assert.rejects(prepareFresh(s.api,s.intent));});

test('activation amounts use same-block governed and stronger pool minima',async()=>{
  const s=entrySetup();s.terms.minimum_activation_usd_18=125n*U;s.poolMinimum=150n*U;
  const r=await activationAmountFresh(s.api,'ETH');assert.equal(r.amount,'150');assert.equal(r.minimum_activation_usd_18,(150n*U).toString());assert.equal(r.contribution_policy.fingerprint,s.terms.fingerprint);
  s.poolMinimum=0n;assert.equal((await activationAmountFresh(s.api,'ZZZ')).amount,'125');
});

test('activation rejects over-target input and a quote made stale by the captured price',async()=>{
  const over=entrySetup();over.intent.amount='101';await assert.rejects(prepareFresh(over.api,over.intent),/exact reviewed activation amount/);
  const stale=entrySetup(),quoted=await activationAmountFresh(stale.api,'ETH');assert.equal(quoted.amount,'100');
  stale.lower=2n*U;stale.upper=2n*U;await assert.rejects(prepareFresh(stale.api,{...stale.intent,amount:quoted.amount}),/exact reviewed activation amount/);
});

test('activation uses exactly the smallest raw unit rounded up to its governed target',async()=>{
  const s=entrySetup();s.terms.minimum_activation_usd_18=U;s.terms.minimum_growth_usd_18=U;s.lower=3n*U;s.upper=3n*U;
  const quote=await activationAmountFresh(s.api,'ETH'),amount=333333333333333334n;
  assert.equal(quote.raw,amount.toString());assert.equal(quote.amount,'0.333333333333333334');assert.equal((amount-1n)*s.lower/U<U,true);
  const gross=amount*s.lower/U,required=gross-gross*200n/10000n;
  s.intent.amount=quote.amount;s.draft.source.amount_raw=amount.toString();s.draft.source.value_usd_18=gross.toString();
  s.draft.contribution_policy=policyJSON(s.terms);s.draft.minimum_deployed_usd_18=required.toString();
  Object.assign(s.draft.contribution,{source_usd_18:gross.toString(),required_deployed_usd_18:required.toString(),marginal_deployed_usd_18:gross.toString(),net_contribution_usd_18:gross.toString(),converted_amount_raw:amount.toString()});
  s.draft.transaction.value=hex(amount);s.draft.transaction.data='0x6169e438'+word(s.intent.id)+s.m.pool_id.slice(2)+word(0)+word(amount)+word(99)+word(4060)+word(0)+word(200)+s.terms.fingerprint.slice(2);
  s.simulations.set(s.draft.transaction.data,'0x');const r=await prepareFresh(s.api,s.intent);assert.equal(r.source.amount_raw,amount.toString());
  await assert.rejects(prepareFresh(s.api,{...s.intent,amount:'0.333333333333333335'}),/exact reviewed activation amount/);
});

test('exact ZZZ approval never widens amount, resets allowance or fabricates LP proof',async()=>{
  for(const change of [s=>s.draft.approval_steps[0].amount_raw=(101n*U).toString(),s=>s.draft.approval_steps[0].reset_first=true,s=>s.draft.approval_steps[0].reprepare_after_confirmation=false,s=>s.draft.contribution={}]){const s=entrySetup({asset:'ZZZ',approval:true});change(s);await assert.rejects(prepareFresh(s.api,s.intent));}
});

for(const [name,change] of [
  ['policy2 schema on policy1',s=>s.draft.schema=2],['unreviewed policy2 fields',s=>s.draft.network_gas.policy_schema=2],
  ['claim calldata changed',s=>s.draft.transaction.data+='0'.repeat(64)],
  ['claim currency relabelled',s=>s.draft.claim_operations[2].symbol='ETH'],
  ['independent payouts changed',s=>s.simulations.set(s.draft.transaction.data,'0x'+word(32)+word(3)+word(19)+word(1)+word(1))],
  ['malformed independent result',s=>s.simulations.set(s.draft.transaction.data,'0x')],
  ['independent estimate grew',s=>s.estimate=120001n],['independent gas price grew',s=>s.price=1000000001n],
  ['native balance missing',s=>s.balance=0n],['runtime changed',s=>s.rpcHook=method=>method==='eth_getCode'?'0x600099':undefined],
])test('unsigned final verification rejects '+name,async()=>{const s=setup();change(s);await assert.rejects(prepareFresh(s.api,s.intent));});

test('policy2 binds the confirmed block cap and full20% estimate headroom',async()=>{
  for(const change of [s=>s.blockLimit=30000000,s=>s.draft.network_gas.full_twenty_percent_headroom=false,s=>s.draft.network_gas.suggested_limit='100000',s=>s.estimate=100001n,s=>s.draft.network_gas.configured_gas_limit='64000000']){const s=setup(2);change(s);await assert.rejects(prepareFresh(s.api,s.intent));}
  const s=setup(2);s.rpcHook=method=>{if(method==='eth_getBlockByNumber'&&s.headers===1)return {hash:hash('b'),number:'0x63',timestamp:'0xfa0',gasLimit:hex(39999999)};};await assert.rejects(prepareFresh(s.api,s.intent),/policy2/);
});

test('policy2 works through the unchanged real read-only transport and rejects a reorged block header',async()=>{
  for(const reorg of [false,true]){
    const s=setup(2),backend=s.api.reader,transportCalls=[];
    if(reorg)s.rpcHook=method=>method==='eth_getBlockByNumber'?{hash:hash('a'),number:'0x63',timestamp:'0xfa0',gasLimit:hex(40000000)}:undefined;
    s.api.reader=createChainReader('http://127.0.0.1:9999',{fetcher:async(_url,options)=>{
      const request=JSON.parse(options.body);transportCalls.push(request.method);
      const result=await backend.request(request);return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
    }});
    if(reorg)await assert.rejects(prepareFresh(s.api,s.intent),/identity differs/);
    else {const r=await prepareFresh(s.api,s.intent);assert.equal(r.signing_enabled,false);assert.ok(transportCalls.includes('eth_getBlockByNumber'));assert.ok(transportCalls.includes('eth_estimateGas'));}
    assert.ok(!transportCalls.includes('eth_getBlockByHash'));
  }
});

test('a policy2 plan with no batch still authenticates its effective confirmed-block gas cap',async()=>{
  const s=setup(2);s.plan.next_batch=null;s.plan.planning.final_batch_revalidated=false;
  for(const row of s.plan.entries){row.status='unassessed';row.reason='planning_attempt_limit';}
  s.plan.remaining_claims=s.plan.entries.map(({selection_index,status,reason,...row})=>({...keys(row),selection_index,status,reason}));
  const r=await prepareFresh(s.api,{...s.intent,plan:true});assert.equal(r.transaction,null);assert.equal(s.headers,2);
  s.blockLimit=30000000;await assert.rejects(prepareFresh(s.api,{...s.intent,plan:true}),/gas cap/);
});

test('final expiry discards the review and source9 mint stays blocked on every environment',async()=>{
  const s=setup();s.identityHook=()=>{if(s.identityCalls===2)s.now=4060000;};await assert.rejects(prepareFresh(s.api,s.intent),/expired/);
  for(const environment of ['production','rehearsal']){const t=setup();t.m.environment=environment;await assert.rejects(prepareFresh(t.api,{action:'mint',account:t.intent.account}),/OpenSea/);assert.equal(t.requests.length,0);}
});


// Explicit activation policy2 typed DTOs; actual runtime qualification is separate.
function entryGasPolicy2(options={}){
  const s=entrySetup(options);s.m.activation_policy_schema=2;s.m.limits.gas=16000000;
  s.draft.schema=2;s.blockLimit=18000000;s.estimate=11000000n;
  Object.assign(s.draft.network_gas,{estimated_units:'11000000',suggested_limit:'13200000',estimated_fee_wei:(11000000n*s.price).toString(),suggested_limit_cost_wei:(13200000n*s.price).toString(),policy_schema:2,configured_gas_limit:'16000000',confirmed_block_gas_limit:'18000000',effective_gas_limit:'16000000',full_twenty_percent_headroom:true});
  return s;
}

for(const options of [{asset:'ETH'},{asset:'ZZZ'},{asset:'ETH',action:'increase'},{asset:'ZZZ',action:'increase'},{asset:'ZZZ',approval:true}])test('activation gas2 exact unsigned '+JSON.stringify(options)+' retains full headroom above12M',async()=>{
  const s=entryGasPolicy2(options),r=await prepareFresh(s.api,s.intent);
  assert.equal(r.signing_enabled,false);assert.equal(r.network_gas.gas_limit,'13200000');assert.deepEqual(r.transaction,s.draft.transaction);
  assert.equal(s.calls.filter(c=>c.method==='eth_getBlockByNumber').length,2);
  for(const c of s.calls.filter(c=>['eth_call','eth_estimateGas'].includes(c.method)&&c.params[0].from))assert.equal(c.params[0].gas,hex(16000000));
});

for(const [name,change] of [
  ['missing explicit selector',s=>delete s.m.activation_policy_schema],['old draft schema',s=>s.draft.schema=1],
  ['wrong gas policy schema',s=>s.draft.network_gas.policy_schema=1],['different configured cap',s=>s.draft.network_gas.configured_gas_limit='12000000'],
  ['different confirmed cap',s=>s.blockLimit=17000000],['different effective cap',s=>s.draft.network_gas.effective_gas_limit='15000000'],
  ['missing full headroom',s=>s.draft.network_gas.full_twenty_percent_headroom=false],['late estimate headroom grew',s=>s.estimate=11000001n],
  ['configured cap below padded gas',s=>s.m.limits.gas=12000000],['fee budget exhausted',s=>s.m.limits.network_fee_wei='1'],
])test('activation gas2 rejects '+name,async()=>{const s=entryGasPolicy2();change(s);await assert.rejects(prepareFresh(s.api,s.intent));});

test('activation policy2 does not widen unsigned claim policy1 beyond12M',async()=>{
  const s=setup();s.m.activation_policy_schema=2;s.m.limits.gas=16000000;
  const r=await prepareFresh(s.api,s.intent);assert.equal(r.signing_enabled,false);
  for(const c of s.calls.filter(c=>['eth_call','eth_estimateGas'].includes(c.method)&&c.params[0].from))assert.equal(c.params[0].gas,hex(12000000));
  const over=setup();over.m.activation_policy_schema=2;over.m.limits.gas=16000000;over.draft.network_gas.estimated_units='11000000';over.draft.network_gas.suggested_limit='13200000';
  await assert.rejects(prepareFresh(over.api,over.intent));
});
