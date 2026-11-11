import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareFresh,activationAmountFresh,source9ClaimEntries} from '../deployment-source9-prepare.js';
import {SOURCE10_CANONICAL_SCHEMA,Source10Profile} from '../deployment-source10.js';
import {FRESH_CANONICAL_SCHEMA,freshSelector} from '../deployment-source9.js';
import {ZERO} from '../deployment-api.js';
import {source10ProfileFixture,source10Block,testAddress,testWord} from './helpers/source10-profile-fixture.mjs';

// Synthetic, typed review/transport fixtures for the real shared validator and
// new immutable graph verifier. These are not V10 API producer or EVM receipts.
const U=10n**18n,hash=c=>'0x'+c.repeat(64),hex=n=>'0x'+BigInt(n).toString(16);
const word=testWord,claimData=claims=>'0xbbeaec93'+word(32)+word(claims.length)+claims.map(c=>word(c.token_id)+word(BigInt(c.asset))+word(c.royalty?1:0)).join('');
const claimOutput=claims=>'0x'+word(32)+word(claims.length)+claims.map(c=>word(c.simulated_raw)).join('');
const jsonPolicy=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,typeof v==='bigint'||typeof v==='number'?String(v):v]));

function fixture({policy=1,ceiling=300,execution=0}={}){
  const g=source10ProfileFixture(),m=g.manifest,owner=testAddress(900),usdc=testAddress(901);
  Object.assign(m,{max_age_seconds:120,pool_id:hash('8'),transaction_policy_schema:policy,transaction_fee_review:hash('9'),activation_fee_review:hash('9')});
  Object.assign(m.limits,{maximum_contribution_loss_bps:ceiling,gas:policy===2?40000000:12000000,gas_price_wei:'100000000000',network_fee_wei:U.toString(),native_value_wei:(1000n*U).toString(),contribution_usd_18:(1000n*U).toString()});
  m.reward_assets.push({address:usdc,symbol:'USDC',decimals:6});
  const n={token_id:'444',owner,traits_ready:true,position:{activated:true,status:'active'},royalty_reporting:{opening:{claims_open:true}},claimable:{lp:[{asset:ZERO,raw:'31'},{asset:m.input_assets[1].address,raw:'11'}],royalties:[{asset:ZERO,raw:'7'},{asset:usdc,raw:'25000001'}]}};
  const claims=[{token_id:n.token_id,asset:ZERO,royalty:false},{token_id:n.token_id,asset:ZERO,royalty:true},{token_id:n.token_id,asset:usdc,royalty:true}];
  const operations=claims.map((c,i)=>({...c,symbol:i===2?'USDC':'ETH',decimals:i===2?6:18,view_raw:['31','7','25000001'][i],simulated_raw:['31','7','25000001'][i]}));
  const s={g,m,n,owner,now:4000000,calls:[],requests:[],identityCalls:0,estimate:100000n,price:1000000000n,balance:1000n*U,blockLimit:40000000,poolMinimum:0n,poolMaximum:1000n*U,simulations:new Map()};
  s.provenance={block_hash:source10Block.blockHash,block_number:99,block_timestamp:4000,accounting_version:7,custody_version:5,royalty_reporting_schema:5,eip1898_require_canonical:true,protocol_finalized:false,routing_version:3,pricing_version:2,review_policy_version:2};
  const gas={includes_all_network_components:true,currency:'native',wallet_must_refresh:true,fee_policy_review_hash:hash('9'),suggested_limit:'120000',estimated_units:'100000',price_wei:s.price.toString(),suggested_limit_cost_wei:(120000n*s.price).toString(),estimated_fee_wei:(100000n*s.price).toString()};
  if(policy===2)Object.assign(gas,{policy_schema:2,configured_gas_limit:'40000000',confirmed_block_gas_limit:'40000000',effective_gas_limit:'40000000',full_twenty_percent_headroom:true});
  s.draft={schema:policy,kind:'unsigned_transaction_draft',action:'claim',transaction:{from:owner,to:m.contracts.claim_router.address,value:'0x0',chainId:hex(m.chain_id),data:claimData(claims)},simulation:{succeeded:true,balance_overrides:false,gas_cap:policy===2?'40000000':'12000000',gas_estimate:'100000'},approvals_required:false,claim_operations:operations,network_gas:gas,prepared_at:4000,expires_at:4060,provenance:s.provenance,wallet_revalidation_required:true};
  s.simulations.set(s.draft.transaction.data,claimOutput(operations));
  if(execution===1){
    m.execution_price_version=1;m.lp_routing_version=3;
    for(const role of ['liquidity','balancing_router'])g.set(role,'LP_ROUTING_VERSION()',[3]);
    for(const role of ['oracle','contribution_pricing','liquidity','balancing_router','lp_position_executor','strategy','lp_balance_math'])g.set(role,'EXECUTION_PRICE_VERSION()',[1]);
    g.set('liquidity','executionStrategy()',[BigInt(m.contracts.lp_balance_math.address)]);g.set('oracle','executionActive()',[0]);g.set('oracle','executionSourceRevision()',[2]);
    s.provenance.execution_price_version=1;s.provenance.lp_routing_version=3;
    s.provenance.lp_execution={version:3,execution_price_version:1,execution_price:{version:1,contracts:Object.fromEntries(['oracle','contribution_pricing','liquidity','balancing_router','lp_position_executor','strategy'].map(role=>[role,m.contracts[role].address])),execution_strategy:m.contracts.lp_balance_math.address,source_revision:2,context_active:false}};
  }
  const profile=new Source10Profile(m,g.reader),baseReader=g.reader;
  s.api={manifest:m,clock:()=>s.now,native:profile,identity:async()=>{s.identityCalls++;if(s.identityHook)await s.identityHook();},protocol:async()=>({lifecycle:{new_economic_work_available_by_lifecycle:true},minting:{channel:'opensea',available:null,stage_eligibility:'unverified'},provenance:s.provenance}),nft:async(id,account)=>{if(id!==n.token_id||account!==n.owner)throw Error('Confirmed NFT owner changed');return n;},asset:symbol=>{const asset=m.input_assets.find(a=>a.symbol===symbol&&a.enabled);if(!asset)throw Error('Unreviewed contribution asset');return asset;},provenance:async p=>{assert.equal(p.block_hash,source10Block.blockHash);assert.equal(p.block_number,99);await profile.verify(source10Block);return source10Block;},request:async(path,payload)=>{s.requests.push({path,payload});if(path==='/v1/claims/plan')return s.plan;if(path==='/v1/transactions/prepare'||path==='/v1/activation/prepare')return s.draft;throw Error('Unexpected API request');}};
  s.api.reader={request:async request=>{
    const {method,params=[]}=request;s.calls.push(request);assert.ok(!/send|sign|nonce|anvil|trace/i.test(method),'No signing, nonce or mutation RPC');
    if(s.rpcHook){const answer=await s.rpcHook(method,params);if(answer!==undefined)return answer;}
    if(method==='eth_getBlockByNumber')return {hash:source10Block.blockHash,number:'0x63',timestamp:'0xfa0',gasLimit:hex(s.blockLimit)};
    if(method==='eth_gasPrice')return hex(s.price);
    if(method==='eth_estimateGas'){assert.deepEqual(params[1],source10Block);return hex(s.estimate);}
    if(method==='eth_getBalance'){assert.deepEqual(params[1],source10Block);return hex(s.balance);}
    if(method==='eth_call'&&params[0].data==='0xb95559a1'+m.pool_id.slice(2))return '0x'+[0,BigInt(m.input_assets[1].address),10020,200,0,1,1,1,1,1,200,0,s.poolMinimum,s.poolMaximum].map(word).join('');
    if(method==='eth_call'&&params[0].from){assert.equal(params.length,2);assert.deepEqual(params[1],source10Block);assert.ok(params[0].gas);const output=s.simulations.get(params[0].data);if(output===undefined)throw Error('Independent RPC rejected exact calldata');return output;}
    return baseReader.request(request);
  }};
  // The graph's own calls use the same strict transport and exact block.
  profile.reader=s.api.reader;
  for(const asset of m.input_assets)g.set('oracle','priceBounds(address)',[U,U,hash('d')],word(BigInt(asset.address)));
  s.intent={action:'claim',account:owner,claims};return s;
}

function entry({asset='ETH',action='activate',approval=false,policy=1,ceiling=300,execution=0}={}){
  const s=fixture({ceiling,execution}),m=s.m,source=s.api.asset(asset),amount=(action==='increase'?5n:100n)*U;
  s.n.position.activated=action==='increase';s.n.position.status=action==='increase'?'active':'dormant';
  const required=amount*97n/100n,tx={from:s.owner,to:approval?source.address:m.contracts.entry.address,value:!approval&&asset==='ETH'?hex(amount):'0x0',chainId:hex(m.chain_id),data:approval?'0x095ea7b3'+word(BigInt(m.contracts.entry.address))+word(amount):'0x6169e438'+word(s.n.token_id)+m.pool_id.slice(2)+word(BigInt(source.address))+word(amount)+word(99)+word(4060)+word(action==='increase'?1:0)+word(300)};
  s.termsPromise=s.api.native.entryPolicy(source10Block).then(terms=>{s.terms=terms;if(!approval)tx.data+=terms.fingerprint.slice(2);s.draft.contribution_policy=jsonPolicy(terms);s.simulations.set(tx.data,approval?'0x'+word(1):'0x');});
  s.draft={schema:1,kind:approval?'approval_required':'activation_transaction',action,token_id:s.n.token_id,pool_id:m.pool_id,activation_ready:!approval,transaction:tx,approval_steps:approval?[{asset:source.address,spender:m.contracts.entry.address,amount_raw:amount.toString(),reset_first:false,reprepare_after_confirmation:true}]:[],source:{asset:source.address,amount_raw:amount.toString(),value_usd_18:amount.toString()},contribution:approval?null:{source_usd_18:amount.toString(),required_deployed_usd_18:required.toString(),marginal_deployed_usd_18:required.toString(),net_contribution_usd_18:amount.toString(),shares_added_raw:'500',lp_liquidity_added_raw:'100',lp_token_id:'200',converted_amount_raw:amount.toString(),simulation_gas_used:'90000'},execution_limit_bps:300,reviewed_maximum_loss_bps:300,minimum_deployed_usd_18:required.toString(),minimum_liquidity_raw:approval?null:'99',minimum_conversion_output_raw:null,network_gas:{...s.draft.network_gas,included_in_execution_loss:false},prepared_at:4000,expires_at:4060,onchain_deadline:approval?null:4060,provenance:s.provenance,wallet_revalidation_required:true,state_overrides:false,liquidity_context:{portfolio:{main:{token_id:'200'},residual:null}}};
  if(policy===2){m.activation_policy_schema=2;m.limits.gas=16000000;s.blockLimit=18000000;s.estimate=11000000n;s.draft.schema=2;Object.assign(s.draft.network_gas,{policy_schema:2,estimated_units:'11000000',suggested_limit:'13200000',estimated_fee_wei:(11000000n*s.price).toString(),suggested_limit_cost_wei:(13200000n*s.price).toString(),configured_gas_limit:'16000000',confirmed_block_gas_limit:'18000000',effective_gas_limit:'16000000',full_twenty_percent_headroom:true});}
  s.intent={action,account:s.owner,id:s.n.token_id,asset,amount:action==='increase'?'5':'100'};return s;
}

for(const policy of [1,2])test('source10 policy'+policy+' keeps ETH LP and original-currency royalty claims exact and unsigned',async()=>{
  const s=fixture({policy}),review=await prepareFresh(s.api,s.intent);
  assert.deepEqual(review.transaction,s.draft.transaction);assert.deepEqual(review.claims,s.draft.claim_operations);
  assert.equal(review.claims.at(-1).simulated_raw,'25000001');assert.equal(review.claims.at(-1).symbol,'USDC');
  assert.equal(review.signing_enabled,false);assert.ok(Object.isFrozen(review)&&Object.isFrozen(review.transaction));assert.equal(review.transaction.nonce,undefined);
  assert.equal(s.m.schema,5);assert.equal(s.m.canonical_schema,SOURCE10_CANONICAL_SCHEMA);
});

for(const options of [{asset:'ETH'},{asset:'ZZZ'},{asset:'ETH',action:'increase'},{asset:'ZZZ',action:'increase'},{asset:'ZZZ',approval:true}])test('source10 exact300bps Entry3 review '+JSON.stringify(options),async()=>{
  const s=entry(options);await s.termsPromise;const review=await prepareFresh(s.api,s.intent);
  assert.equal(review.signing_enabled,false);assert.deepEqual(review.transaction,s.draft.transaction);
  assert.equal(review.execution_limit_bps,300);assert.equal(review.minimum_deployed_usd_18,(BigInt(s.draft.source.value_usd_18)*97n/100n).toString());
  if(options.approval){assert.equal(review.action,'approve');assert.equal(review.simulated_lp_added_usd_18,null);assert.equal(s.draft.approval_steps[0].amount_raw,review.source.amount_raw);}
  else assert.equal(review.simulated_lp_added_usd_18,s.draft.contribution.required_deployed_usd_18);
  assert.equal(s.requests[0].payload.slippage_bps,100,'Total300 does not widen the separately selected venue floor');
});

for(const options of [{asset:'ETH'},{asset:'ZZZ',action:'increase'},{asset:'ZZZ',approval:true}])test('source10 activation gas policy2 retains confirmed cap and full headroom '+JSON.stringify(options),async()=>{
  const s=entry({...options,policy:2});await s.termsPromise;const review=await prepareFresh(s.api,s.intent);
  assert.equal(review.network_gas.gas_limit,'13200000');assert.equal(review.signing_enabled,false);
  assert.ok(s.calls.filter(c=>['eth_call','eth_estimateGas'].includes(c.method)&&c.params[0]?.from).every(c=>c.params[0].gas===hex(16000000)));
});

test('source10 amount discovery uses governed minima and both USD bounds without mint eligibility',async()=>{
  const s=fixture(),r=await activationAmountFresh(s.api,'ZZZ');assert.equal(r.amount,'100');assert.equal(r.minimum_activation_usd_18,(100n*U).toString());
  assert.equal(s.requests.length,0);const mutableMint=['currentPhase()','configurationHash()','config()','reviewedMintPrice()'].map(freshSelector);
  assert.ok(s.calls.some(c=>c.method==='eth_call'));assert.ok(s.calls.filter(c=>c.method==='eth_call').every(c=>!mutableMint.includes(c.params[0].data.slice(0,10))));
});

test('source10 rejects a97percent deployment short by one raw unit and a mismatched source budget',async()=>{
  for(const change of [s=>s.draft.contribution.marginal_deployed_usd_18=(97n*U-1n).toString(),s=>s.draft.minimum_deployed_usd_18=(98n*U).toString(),s=>s.draft.contribution.required_deployed_usd_18=(98n*U).toString(),s=>s.draft.execution_limit_bps=200]){
    const s=entry();await s.termsPromise;change(s);await assert.rejects(prepareFresh(s.api,s.intent));
  }
});

test('source10 requires the upper USD bound when calculating the contribution floor',async()=>{
  const s=entry();await s.termsPromise;s.g.set('oracle','priceBounds(address)',[U,101n*U/100n,hash('d')],word(0));
  await assert.rejects(prepareFresh(s.api,s.intent),/Contribution review/);
});

test('source10 retains nonzero net NAV, shares, physical liquidity and no-override proof requirements',async()=>{
  for(const change of [s=>s.draft.contribution.net_contribution_usd_18='0',s=>s.draft.contribution.shares_added_raw='0',s=>s.draft.contribution.lp_liquidity_added_raw='98',s=>s.draft.contribution.lp_token_id='0',s=>s.draft.state_overrides=true]){
    const s=entry();await s.termsPromise;change(s);await assert.rejects(prepareFresh(s.api,s.intent));
  }
});

test('source10 exact approvals cannot be inflated, reset or treated as LP execution',async()=>{
  for(const change of [s=>s.draft.approval_steps[0].amount_raw=(101n*U).toString(),s=>s.draft.approval_steps[0].reset_first=true,s=>s.draft.approval_steps[0].reprepare_after_confirmation=false,s=>s.draft.contribution={}]){
    const s=entry({asset:'ZZZ',approval:true});await s.termsPromise;change(s);await assert.rejects(prepareFresh(s.api,s.intent));
  }
});

test('source10 leaves an independently reviewed200bps ceiling intact',async()=>{
  const s=entry({ceiling:200});await s.termsPromise;
  await assert.rejects(prepareFresh(s.api,s.intent),/reviewed ceiling/);assert.equal(s.m.limits.maximum_contribution_loss_bps,200);
});

test('source10 owner changes, paused work and stale policy fingerprint fail closed',async()=>{
  for(const change of [s=>s.n.owner=testAddress(999),s=>s.api.protocol=async()=>({lifecycle:{new_economic_work_available_by_lifecycle:false}}),s=>s.draft.contribution_policy.fingerprint=hash('c'),s=>s.draft.transaction.data=s.draft.transaction.data.slice(0,-64)+hash('c').slice(2)]){
    const s=entry();await s.termsPromise;change(s);await assert.rejects(prepareFresh(s.api,s.intent));
  }
});

test('source10 rejects expired reviews and does not publish a review that expires during final verification',async()=>{
  const expired=fixture();expired.draft.expires_at=4000;await assert.rejects(prepareFresh(expired.api,expired.intent),/expired/);
  const late=fixture();late.identityHook=()=>{if(late.identityCalls===2)late.now=4060000;};await assert.rejects(prepareFresh(late.api,late.intent),/expired/);
});

test('source10 direct mint rejects before any API, graph or simulation request',async()=>{
  const s=fixture();await assert.rejects(prepareFresh(s.api,{action:'mint',account:s.owner}),/OpenSea/);
  assert.equal(s.identityCalls,0);assert.equal(s.requests.length,0);assert.equal(s.calls.length,0);assert.equal(s.g.calls.length,0);
});

test('closed V9/V10 preparation profiles reject partial, mixed and unknown identities before reads',async()=>{
  for(const change of [m=>m.schema=4,m=>m.source_profile=9,m=>m.mint_integration_version=1,m=>delete m.mint_integration_version,m=>m.mint_integration_version=true,m=>m.canonical_schema=FRESH_CANONICAL_SCHEMA,m=>m.schema=6,m=>m.accounting_version=10]){
    const s=fixture();change(s.m);await assert.rejects(prepareFresh(s.api,s.intent),/explicit source9\/V9/);assert.equal(s.identityCalls,0);assert.equal(s.requests.length,0);
  }
});

test('source10 ordinary selection includes original royalty currencies and leaves ZZZ LP rewards pending',async()=>{
  const s=fixture();assert.deepEqual(source9ClaimEntries(s.n),s.intent.claims);
  const review=await prepareFresh(s.api,{action:'claim',account:s.owner,ids:[s.n.token_id]});assert.equal(review.claims.length,3);
  assert.ok(review.claims.filter(c=>!c.royalty).every(c=>c.asset===ZERO));assert.equal(s.n.claimable.lp[1].raw,'11');
  s.n.royalty_reporting.opening.claims_open=false;assert.deepEqual(source9ClaimEntries(s.n),[s.intent.claims[0]]);
});

test('source10 rejects relabeled royalty currency or altered independent payout amounts',async()=>{
  const relabeled=fixture();relabeled.draft.claim_operations[2].symbol='ETH';await assert.rejects(prepareFresh(relabeled.api,relabeled.intent));
  const changed=fixture();changed.simulations.set(changed.draft.transaction.data,'0x'+word(32)+word(3)+word(31)+word(7)+word(25000000));
  await assert.rejects(prepareFresh(changed.api,changed.intent),/Independent claim simulation/);
});

test('source10 policy2 rejects mismatched block caps and incomplete estimate headroom',async()=>{
  for(const change of [s=>s.blockLimit=17000000,s=>s.draft.network_gas.full_twenty_percent_headroom=false,s=>s.estimate=11000001n,s=>s.m.limits.network_fee_wei='1']){
    const s=entry({policy:2});await s.termsPromise;change(s);await assert.rejects(prepareFresh(s.api,s.intent));
  }
});

test('source10 activation policy2 never widens claim policy1 beyond12M',async()=>{
  const s=fixture();s.m.activation_policy_schema=2;s.m.limits.gas=16000000;
  const review=await prepareFresh(s.api,s.intent);assert.equal(review.signing_enabled,false);
  assert.ok(s.calls.filter(c=>['eth_call','eth_estimateGas'].includes(c.method)&&c.params[0]?.from).every(c=>c.params[0].gas===hex(12000000)));
});

for(const options of [{asset:'ETH'},{asset:'ZZZ',action:'increase'},{asset:'ZZZ',approval:true}])test('execution1 unsigned Entry review authenticates captured context graph '+JSON.stringify(options),async()=>{
  const s=entry({...options,execution:1});await s.termsPromise;const r=await prepareFresh(s.api,s.intent);
  assert.equal(r.signing_enabled,false);assert.equal(r.provenance.execution_price_version,1);assert.deepEqual(r.transaction,s.draft.transaction);
});

test('execution1 financial reviews reject mismatched or noncanonical context provenance',async()=>{
  for(const change of [s=>delete s.provenance.execution_price_version,s=>s.provenance.execution_price_version=true,s=>s.provenance.lp_routing_version=2,
    s=>s.provenance.lp_execution.version=2,s=>s.provenance.lp_execution.execution_price.context_active=true,s=>s.provenance.lp_execution.execution_price.source_revision=3,
    s=>s.provenance.lp_execution.execution_price.source_revision='2',s=>s.provenance.lp_execution.execution_price.source_revision=Number.MAX_SAFE_INTEGER+1,
    s=>s.provenance.lp_execution.execution_price.contracts.oracle=testAddress(999),s=>s.provenance.lp_execution.execution_price.contracts.extra=testAddress(999),
    s=>s.provenance.lp_execution.execution_price.extra={},s=>s.provenance.lp_execution.execution_price.execution_strategy=testAddress(999)]){
    const s=entry({execution:1});await s.termsPromise;change(s);await assert.rejects(prepareFresh(s.api,s.intent),/Execution-price/);
  }
});

test('execution1 claims remain independent of the current source-kind revision and context availability',async()=>{
  const s=fixture({execution:1});s.g.set('oracle','executionActive()',[2]);s.g.set('oracle','executionSourceRevision()',[1n<<64n]);
  const r=await prepareFresh(s.api,s.intent);assert.equal(r.action,'claim');
  const forbidden=[freshSelector('executionActive()'),freshSelector('executionSourceRevision()')];
  assert.equal(s.g.calls.some(c=>c.method==='eth_call'&&forbidden.includes(c.params[0].data)),false);
});

test('historical unsigned reviews reject attached execution1 context proofs rather than silently adopting them',async()=>{
  const s=entry();await s.termsPromise;s.provenance.lp_execution={execution_price:{version:1}};
  await assert.rejects(prepareFresh(s.api,s.intent),/Historical review/);
});
