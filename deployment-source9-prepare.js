// Source9 owner reviews only. No nonce, wallet, signer or submission capability.
import {raw,ZERO,parseAmount,exactUnits} from './deployment-api.js';

const ADDRESS=/^0x[0-9a-f]{40}$/,HASH=/^0x[0-9a-f]{64}$/;
const fail=message=>{throw Error(message);};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const hex=n=>'0x'+BigInt(n).toString(16),word=n=>BigInt(n).toString(16).padStart(64,'0');
const addressWord=a=>a.slice(2).padStart(64,'0');
const copy=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const quantity=x=>{if(typeof x!=='string'||!/^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/.test(x))fail('Invalid independent RPC quantity');return BigInt(x);};
const words=(value,count)=>{if(typeof value!=='string'||!/^0x(?:[0-9a-f]{64})*$/.test(value)||value.length!==2+64*count)fail('Malformed independent simulation result');return value.slice(2).match(/.{64}/g)?.map(v=>BigInt('0x'+v))||[];};
const claimIdentity=({token_id,asset,royalty})=>({token_id,asset,royalty});
const claimKey=c=>`${c.token_id}:${c.asset}:${c.royalty}`;
const ceil=(a,b)=>(a+b-1n)/b;
const policyJSON=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,typeof v==='number'||typeof v==='bigint'?String(v):v]));
const sameObject=(a,b)=>object(a)&&object(b)&&Object.keys(a).sort().join()===Object.keys(b).sort().join()&&Object.keys(b).every(k=>a[k]===b[k]);

function profile(api){
  const m=api.manifest;
  if(m.schema!==4||m.source_profile!==9||m.accounting_version!==7||m.routing_version!==3||m.review_policy_version!==2||m.pricing_version!==2||m.custody_version!==5||!api.native)fail('This review requires the explicit fresh source9 deployment');
  if(![1,2].includes(m.transaction_policy_schema))fail('Select an explicit reviewed transaction policy');
  return m;
}

function requireFresh(api,draft,action,{activation=false}={}){
  const now=Math.floor(api.clock()/1000),schema=activation?1:api.manifest.transaction_policy_schema;
  if(draft.schema!==schema||draft.action!==action||!integer(draft.prepared_at,now-120,now+30)||!integer(draft.expires_at,now+1,now+60)||draft.expires_at<=draft.prepared_at||draft.expires_at>draft.provenance.block_timestamp+api.manifest.max_age_seconds||draft.wallet_revalidation_required!==true)fail('Unsigned review expired or differs from the selected action');
}

async function poolMinimum(api,block){
  const m=api.manifest;
  // The fourteen-word accounting PoolConfig is authenticated by FreshProfile.
  const answer=await api.reader.request({method:'eth_call',params:[{to:m.contracts.pools.address,data:'0xb95559a1'+m.pool_id.slice(2)},block]});
  const values=words(answer,14);
  if(values[0]!==0n||!values[1]||values[5]!==1n||values[6]!==1n||!values[13]||values[13]<values[12])fail('Contribution pool is unavailable or its limits are inconsistent');
  const zzz=m.input_assets.find(a=>a.symbol==='ZZZ');
  if(!zzz||values[1]!==BigInt(zzz.address))fail('Contribution pool no longer has the fixed ETH/ZZZ pair');
  return {minimum:values[12],maximum:values[13]};
}

export async function activationAmountFresh(api,symbol){
  const m=profile(api),asset=api.asset(symbol),protocol=await api.protocol(),block=await api.provenance(protocol.provenance);
  const [price,terms,pool]=await Promise.all([api.native.price(asset,block),api.native.entryPolicy(block),poolMinimum(api,block)]);
  const minimum=terms.minimum_activation_usd_18>pool.minimum?terms.minimum_activation_usd_18:pool.minimum;
  const amount=ceil(minimum*10n**BigInt(asset.decimals),price.lower),value=amount*price.lower/10n**BigInt(asset.decimals);
  if(!amount||amount>=2n**128n||value>pool.maximum||value>raw(m.limits.contribution_usd_18))fail('Activation amount is outside the reviewed pool or spending limits');
  await api.provenance(protocol.provenance);
  return freeze({asset:symbol,amount:exactUnits(amount.toString(),asset.decimals),raw:amount.toString(),value_usd_18:value.toString(),minimum_activation_usd_18:minimum.toString(),contribution_policy:policyJSON(terms),provenance:copy(protocol.provenance)});
}

// Ordinary collection claims include funded native LP rewards and the original
// royalty currencies. Pending LP ZZZ is a separate, explicit holder decision.
export function source9ClaimEntries(n){
  const result=[];
  for(const [scope,royalty] of [['lp',false],['royalties',true]]){
    if(royalty){if(typeof n.royalty_reporting?.opening?.claims_open!=='boolean')fail('Royalty opening status is unavailable');if(!n.royalty_reporting.opening.claims_open)continue;}
    if(!Array.isArray(n.claimable?.[scope]))fail('Claim ledger is unavailable');
    for(const row of n.claimable[scope]){
      if(!royalty&&row.asset!==ZERO)continue;
      if(row.available===false||row.raw===null||row.raw===undefined)continue;
      if(raw(row.raw)>0n)result.push({token_id:n.token_id,asset:row.asset,royalty});
    }
  }
  return result;
}

function validateSelections(m,selections){
  if(!Array.isArray(selections)||selections.length<1||selections.length>32)fail('Select one to 32 explicit NFT/currency/ledger entries');
  const seen=new Set(),zzz=m.input_assets.find(a=>a.symbol==='ZZZ')?.address;
  return selections.map(c=>{
    if(!object(c)||Object.keys(c).sort().join()!=='asset,royalty,token_id'||!ADDRESS.test(c.asset)||typeof c.royalty!=='boolean'||raw(c.token_id)===0n||!m.reward_assets.some(a=>a.address===c.asset)||!c.royalty&&![ZERO,zzz].includes(c.asset))fail('Invalid or unreviewed explicit claim selection');
    const key=claimKey(c);if(seen.has(key))fail('Repeated claim selection');seen.add(key);return claimIdentity(c);
  });
}

async function selections(api,intent){
  const m=api.manifest;
  if(intent.claims!==undefined)return validateSelections(m,intent.claims);
  if(!Array.isArray(intent.ids)||!intent.ids.length||intent.ids.length>8||new Set(intent.ids).size!==intent.ids.length)fail('Select one to eight NFTs to claim');
  if(intent.claim_assets!==undefined&&(!Array.isArray(intent.claim_assets)||!intent.claim_assets.length||new Set(intent.claim_assets).size!==intent.claim_assets.length||intent.claim_assets.some(a=>!m.reward_assets.some(x=>x.address===a))))fail('Select reviewed original payout currencies');
  const result=[];
  for(const id of intent.ids){if(raw(id)===0n)fail('Invalid NFT ID');const n=await api.nft(id,intent.account);result.push(...source9ClaimEntries(n).filter(c=>intent.claim_assets===undefined||intent.claim_assets.includes(c.asset)));}
  if(!result.length)fail('No funded rewards are available for the selected entries');
  return validateSelections(m,result);
}

function claimTransaction(m,owner,claims){
  return {from:owner,to:m.contracts.claim_router.address,value:'0x0',chainId:hex(m.chain_id),data:'0xbbeaec93'+word(32)+word(claims.length)+claims.map(c=>word(raw(c.token_id))+addressWord(c.asset)+word(c.royalty?1:0)).join('')};
}

function claimDraft(m,draft,claims){
  if(draft.kind!=='unsigned_transaction_draft'||draft.simulation?.succeeded!==true||draft.simulation.balance_overrides!==false||draft.approvals_required!==false||!Array.isArray(draft.claim_operations)||JSON.stringify(draft.claim_operations.map(claimIdentity))!==JSON.stringify(claims))fail('Unsigned claim simulation or selection differs');
  for(const c of draft.claim_operations){const asset=m.reward_assets.find(a=>a.address===c.asset);if(!asset||asset.symbol!==c.symbol||asset.decimals!==c.decimals||!raw(c.view_raw)||!raw(c.simulated_raw))fail('Claim has no verified original-currency payout');}
}

async function gasPolicy(api,draft,source,block){
  const m=api.manifest,fee=draft.network_gas,policy=source?1:m.transaction_policy_schema;
  if(!object(fee)||fee.includes_all_network_components!==true||fee.currency!=='native'||fee.wallet_must_refresh!==true||source&&fee.included_in_execution_loss!==false||fee.fee_policy_review_hash!==(source?m.activation_fee_review:m.transaction_fee_review))fail('Network fee policy is not reviewed');
  const gas=raw(fee.suggested_limit),estimate=raw(fee.estimated_units),price=raw(fee.price_wei),cost=gas*price;
  let cap=12000000n;
  if(policy===2){
    const header=await api.reader.request({method:'eth_getBlockByNumber',params:[hex(draft.provenance.block_number),false]});
    if(header?.hash!==draft.provenance.block_hash||quantity(header.number)!==BigInt(draft.provenance.block_number)||quantity(header.timestamp)!==BigInt(draft.provenance.block_timestamp))fail('Confirmed block gas identity differs');
    const blockLimit=quantity(header.gasLimit),configured=BigInt(m.limits.gas);cap=configured<blockLimit?configured:blockLimit;
    if(configured<21000n||configured>64000000n||blockLimit<21000n||blockLimit>=2n**64n||fee.policy_schema!==2||fee.configured_gas_limit!==configured.toString()||fee.confirmed_block_gas_limit!==blockLimit.toString()||fee.effective_gas_limit!==cap.toString()||fee.full_twenty_percent_headroom!==true)fail('Transaction policy2 differs from the configured and confirmed block limits');
  }else if(['policy_schema','configured_gas_limit','confirmed_block_gas_limit','effective_gas_limit','full_twenty_percent_headroom'].some(k=>Object.hasOwn(fee,k)))fail('Policy1 cannot accept a policy2 gas envelope');
  const padded=ceil(estimate*120n,100n),suggested=policy===2?padded:(padded<cap?padded:cap);
  if(gas<21000n||gas>BigInt(m.limits.gas)||gas>cap||estimate<21000n||estimate>gas||gas!==suggested||policy===2&&padded>cap||!price||price>raw(m.limits.gas_price_wei)||cost>raw(m.limits.network_fee_wei)||fee.suggested_limit_cost_wei!==cost.toString()||fee.estimated_fee_wei!==(estimate*price).toString()||quantity(draft.transaction.value)>raw(m.limits.native_value_wei))fail('Gas, headroom or value exceeds the reviewed policy');
  if(!source&&(draft.simulation.gas_cap!==cap.toString()||draft.simulation.gas_estimate!==estimate.toString()))fail('Simulation gas cap differs from the reviewed policy');
  return {gas,price,cost,cap,policy};
}

async function independentFinal(api,draft,expected,action,source,block,gas){
  const m=api.manifest,target=source&&action==='approve'?source:m.contracts[source?'entry':'claim_router'];
  const code=await api.reader.request({method:'eth_getCode',params:[expected.to,block]});
  if(code!==target.runtime_code)fail('Transaction target code differs from the reviewed deployment');
  const {chainId,...tx}=expected,request={...tx,gas:hex(gas.cap)};
  const result=await api.reader.request({method:'eth_call',params:[request,block]});
  if(action==='approve'){
    if(result!=='0x'&&result!=='0x'+word(1))fail('Independent exact approval simulation failed');
  }else if(source){if(result!=='0x')fail('Independent Entry3 simulation returned unexpected data');}
  else {
    const values=words(result,draft.claim_operations.length+2);
    if(values[0]!==32n||values[1]!==BigInt(draft.claim_operations.length)||values.slice(2).some((v,i)=>!v||v!==raw(draft.claim_operations[i].simulated_raw)))fail('Independent claim simulation differs from the original-currency payouts');
  }
  const estimate=quantity(await api.reader.request({method:'eth_estimateGas',params:[request,block]}));
  const price=quantity(await api.reader.request({method:'eth_gasPrice'}));
  const balance=quantity(await api.reader.request({method:'eth_getBalance',params:[expected.from,block]}));
  if(estimate<21000n||estimate>gas.gas||gas.policy===2&&ceil(estimate*120n,100n)>gas.gas||!price||price>gas.price||balance<quantity(expected.value)+gas.cost)fail('Independent simulation, fee or wallet balance changed; prepare a fresh review');
  // Repeat block policy after simulation to reject inconsistent same-hash RPCs.
  if(gas.policy===2)await gasPolicy(api,draft,source,block);
}

function validatePlan(api,plan,owner,claims){
  const m=api.manifest,now=Math.floor(api.clock()/1000),p=plan.planning;
  if(plan.schema!==m.transaction_policy_schema||plan.kind!=='unsigned_claim_plan'||plan.wallet!==owner||plan.chain_id!==m.chain_id||plan.automatic_submission!==false||plan.production_approved!==false||plan.replan_after_confirmation!==true||!integer(plan.prepared_at,now-120,now+30)||!integer(plan.expires_at,now+1,now+60)||plan.expires_at<=plan.prepared_at||plan.expires_at>plan.provenance.block_timestamp+m.max_age_seconds||plan.provenance.accounting_version!==7||plan.provenance.custody_version!==5||plan.provenance.royalty_reporting_schema!==5||plan.provenance.eip1898_require_canonical!==true||plan.provenance.protocol_finalized!==false||!Array.isArray(plan.entries)||plan.entries.length!==claims.length||!Array.isArray(plan.remaining_claims)||!object(p)||p.maximum_selection!==32||p.maximum_trials!==10||!integer(p.trial_count,0,10)||!Array.isArray(p.attempts)||p.attempts.length!==p.trial_count||p.batch_optimality_guaranteed!==false||p.final_batch_revalidated!==(plan.next_batch!==null))fail('Claim plan is incomplete or differs from the selected bounded policy');
  const batch=[],remaining=[];
  for(const [index,c] of claims.entries()){
    const row=plan.entries[index],asset=m.reward_assets.find(a=>a.address===c.asset);
    if(!object(row)||row.selection_index!==index||JSON.stringify(claimIdentity(row))!==JSON.stringify(c)||!['in_next_batch','zero','blocked','unavailable','unassessed'].includes(row.status)||typeof row.reason!=='string'||!row.reason||row.view_raw!==null&&raw(row.view_raw)<0n||row.symbol!==undefined&&(row.symbol!==asset.symbol||row.decimals!==asset.decimals))fail('A selected claim disappeared or has an invalid classification');
    if(row.status==='zero'&&row.view_raw!=='0'||row.status==='in_next_batch'&&(row.view_raw===null||raw(row.view_raw)===0n))fail('Claim classification contradicts its observed balance');
    if(row.status==='in_next_batch')batch.push(c);
    else if(row.status!=='zero')remaining.push({...c,selection_index:index,status:row.status,reason:row.reason});
  }
  if(JSON.stringify(plan.remaining_claims)!==JSON.stringify(remaining)||Boolean(batch.length)!==(plan.next_batch!==null))fail('Claim plan omitted unresolved selections');
  for(const attempt of p.attempts){if(!Array.isArray(attempt.selection_indices)||!attempt.selection_indices.length||new Set(attempt.selection_indices).size!==attempt.selection_indices.length||attempt.selection_indices.some(i=>!integer(i,0,claims.length-1))||!['simulated','unresolved','over_budget'].includes(attempt.outcome))fail('Invalid bounded claim planning trial');}
  return batch;
}

async function planGasPolicy(api,plan){
  let cap=12000000n;
  if(api.manifest.transaction_policy_schema===2){
    const p=plan.provenance,header=await api.reader.request({method:'eth_getBlockByNumber',params:[hex(p.block_number),false]});
    if(header?.hash!==p.block_hash||quantity(header.number)!==BigInt(p.block_number)||quantity(header.timestamp)!==BigInt(p.block_timestamp))fail('Claim plan confirmed gas block differs');
    const blockLimit=quantity(header.gasLimit),configured=BigInt(api.manifest.limits.gas);
    if(blockLimit<21000n||blockLimit>=2n**64n||configured<21000n||configured>64000000n)fail('Claim plan gas cap is outside reviewed policy2 bounds');
    cap=blockLimit<configured?blockLimit:configured;
  }
  if(plan.planning.simulation_gas_cap!==cap.toString())fail('Claim plan gas cap differs from the configured confirmed-block policy');
}

export async function prepareFresh(api,intent){
  const m=profile(api),owner=intent?.account;
  if(!ADDRESS.test(owner)||owner===ZERO||!['mint','activate','increase','claim'].includes(intent?.action))fail('Invalid selected owner action');
  if(intent.action==='mint')fail('Primary mint is planned on OpenSea; public website minting is unavailable');
  if(intent.plan!==undefined&&typeof intent.plan!=='boolean')fail('Claim planning requires an explicit opt-in');
  if(intent.plan&&intent.action!=='claim')fail('Planning applies only to explicit claims');
  await api.identity();
  const protocol=await api.protocol();let draft,source=null,amount=null,expected,claims=null,plan=null,review=null,action=intent.action;
  if(intent.action==='claim'){
    claims=await selections(api,intent);
    const payload={action:'claim',wallet:owner,claims};
    if(intent.plan===true){
      plan=await api.request('/v1/claims/plan',payload);await api.provenance(plan.provenance,{transaction:true});
      const batch=validatePlan(api,plan,owner,claims);await planGasPolicy(api,plan);draft=plan.next_batch;
      if(!draft){await api.identity();await api.provenance(plan.provenance,{transaction:true});await planGasPolicy(api,plan);if(Math.floor(api.clock()/1000)>=plan.expires_at)fail('Claim plan expired during verification');return freeze({action:'claim',requested_action:'claim',intent:copy(intent),transaction:null,network_gas:null,source:null,claims:[],minimum_deployed_usd_18:null,liquidity_context:null,simulated_lp_added_usd_18:null,prepared_at:plan.prepared_at,expires_at:plan.expires_at,provenance:copy(plan.provenance),claim_plan:copy(plan),signing_enabled:false,notice:'No executable batch. Every selected claim remains classified; refresh the plan after resolving or confirming entries.'});}
      if(draft.provenance.block_hash!==plan.provenance.block_hash||draft.expires_at!==plan.expires_at)fail('Next claim batch differs from its plan snapshot');claims=batch;
    }else draft=await api.request('/v1/transactions/prepare',payload);
    claimDraft(m,draft,claims);
    if(plan&&draft.claim_operations.some(c=>plan.entries.find(r=>claimKey(r)===claimKey(c))?.view_raw!==c.view_raw))fail('Planned balance differs from the freshly verified claim batch');
    expected=claimTransaction(m,owner,claims);
  }else{
    if(!protocol.lifecycle.new_economic_work_available_by_lifecycle)fail('New contributions are currently unavailable');
    if(raw(intent.id)===0n)fail('Invalid NFT ID');
    const n=await api.nft(intent.id,owner);if(!n.traits_ready||n.position.activated!==(intent.action==='increase')||intent.action==='increase'&&n.position.status!=='active')fail('Selected action no longer matches this NFT custody');
    source=api.asset(intent.asset);amount=parseAmount(intent.amount,source.decimals);
    draft=await api.request('/v1/activation/prepare',{action:intent.action,wallet:owner,token_id:intent.id,pool_id:m.pool_id,source_asset:source.address,amount_in:amount.toString(),slippage_bps:100});
  }
  const block=await api.provenance(draft.provenance,{activation:Boolean(source),transaction:!source});
  requireFresh(api,draft,intent.action,{activation:Boolean(source)});
  if(source){
    const [bounds,loss,terms,pool]=await Promise.all([api.native.price(source,block),api.native.cap(block),api.native.entryPolicy(block),poolMinimum(api,block)]);
    const base=10n**BigInt(source.decimals),gross=amount*bounds.lower/base,upper=ceil(amount*bounds.upper,base),required=upper-upper*BigInt(loss)/10000n;
    const minimum=terms[intent.action==='increase'?'minimum_growth_usd_18':'minimum_activation_usd_18'];
    if(gross<minimum||gross<pool.minimum||gross>pool.maximum||gross>raw(m.limits.contribution_usd_18))fail('Contribution is outside the captured governed or pool limits');
    const activationTarget=terms.minimum_activation_usd_18>pool.minimum?terms.minimum_activation_usd_18:pool.minimum;
    if(intent.action==='activate'&&amount!==ceil(activationTarget*base,bounds.lower))fail('Price or activation target changed. Refresh the exact reviewed activation amount before continuing.');
    if(!integer(loss,0,m.limits.maximum_contribution_loss_bps)||intent.maximum_loss_bps!==undefined&&intent.maximum_loss_bps!==loss||draft.token_id!==intent.id||draft.pool_id!==m.pool_id||draft.source?.asset!==source.address||draft.source.amount_raw!==amount.toString()||draft.source.value_usd_18!==gross.toString()||draft.execution_limit_bps!==loss||draft.reviewed_maximum_loss_bps!==loss||draft.minimum_deployed_usd_18!==required.toString()||draft.state_overrides!==false||!sameObject(draft.contribution_policy,policyJSON(terms))||!HASH.test(terms.fingerprint)||BigInt(terms.fingerprint)===0n||draft.minimum_conversion_output_raw!==null)fail('Contribution review differs from the exact original source, captured policy or direct Entry3 profile');
    review={execution_limit_bps:loss,reviewed_maximum_loss_bps:loss,expected_contribution_policy:terms.fingerprint,contribution_policy:policyJSON(terms),source_upper_usd_18:upper.toString(),price_bounds:{asset:source.address,lower_usd_per_token_18:bounds.lower.toString(),upper_usd_per_token_18:bounds.upper.toString(),fingerprint:bounds.fingerprint,policy_id:bounds.policy_id}};
    if(draft.kind==='approval_required'){
      const steps=draft.approval_steps,step=steps?.[0];
      if(source.address===ZERO||draft.activation_ready!==false||!Array.isArray(steps)||steps.length!==1||step.asset!==source.address||step.spender!==m.contracts.entry.address||step.amount_raw!==amount.toString()||step.reset_first!==false||step.reprepare_after_confirmation!==true||draft.contribution!==null||draft.minimum_liquidity_raw!==null||draft.onchain_deadline!==null)fail('Approval is not the exact selected contribution; reprepare after confirmation');
      action='approve';expected={from:owner,to:source.address,value:'0x0',chainId:hex(m.chain_id),data:'0x095ea7b3'+addressWord(m.contracts.entry.address)+word(amount)};
    }else{
      if(draft.kind!=='activation_transaction'||draft.activation_ready!==true||!Array.isArray(draft.approval_steps)||draft.approval_steps.length||draft.onchain_deadline!==draft.expires_at)fail('Complete direct Entry3 simulation is unavailable');
      const liquidity=raw(draft.minimum_liquidity_raw),c=draft.contribution;
      if(!liquidity||liquidity>=2n**128n||!object(c)||c.source_usd_18!==gross.toString()||c.required_deployed_usd_18!==required.toString()||raw(c.marginal_deployed_usd_18)<required||raw(c.lp_liquidity_added_raw)<liquidity||!raw(c.net_contribution_usd_18)||!raw(c.shares_added_raw)||!raw(c.lp_token_id)||c.converted_amount_raw!==amount.toString()||!raw(c.simulation_gas_used))fail('Simulation does not prove the entrant-only marginal LP addition');
      expected={from:owner,to:m.contracts.entry.address,value:source.address===ZERO?hex(amount):'0x0',chainId:hex(m.chain_id),data:'0x6169e438'+word(raw(intent.id))+m.pool_id.slice(2)+addressWord(source.address)+word(amount)+word(liquidity)+word(draft.expires_at)+word(intent.action==='increase'?1:0)+word(loss)+terms.fingerprint.slice(2)};
    }
  }
  if(!object(draft.transaction)||Object.keys(draft.transaction).sort().join()!=='chainId,data,from,to,value'||Object.keys(expected).some(k=>draft.transaction[k]!==expected[k]))fail('Returned calldata does not match the selected typed action');
  const gas=await gasPolicy(api,draft,source,block);
  if(plan&&plan.planning.simulation_gas_cap!==gas.cap.toString())fail('Claim plan gas cap differs from the reviewed batch');
  await independentFinal(api,draft,expected,action,source,block,gas);
  await api.identity();await api.provenance(draft.provenance,{activation:Boolean(source),transaction:!source});
  if(Math.floor(api.clock()/1000)>=draft.expires_at)fail('Unsigned review expired during final verification');
  return freeze({action,requested_action:intent.action,intent:copy(intent),transaction:expected,network_gas:{gas_limit:gas.gas.toString(),gas_price_wei:gas.price.toString(),max_cost_wei:gas.cost.toString()},source:source?copy(draft.source):null,claims:copy(draft.claim_operations||[]),minimum_deployed_usd_18:draft.minimum_deployed_usd_18||null,liquidity_context:source?copy(draft.liquidity_context):null,simulated_lp_added_usd_18:source&&action!=='approve'?draft.contribution.marginal_deployed_usd_18:null,prepared_at:draft.prepared_at,expires_at:draft.expires_at,provenance:copy(draft.provenance),...(review||{}),...(plan?{claim_plan:copy(plan)}:{}),signing_enabled:false,notice:'Unsigned review only. Public signing is not enabled.'});
}
