import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateFreshNFT,validateFreshCollectionPosition} from '../deployment-source9-data.js';
import {nativeRewards,renderPositionAmounts,pendingLPText,principalReturnNote,reviewedClaimPlan} from '../deployment-view.js';
import {positionClaimEntries,ZERO} from '../deployment-api.js';
import {freshSelector} from '../deployment-source9.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/source9-api-v3.json',import.meta.url)));
const metadata=fixture.cases.active_single.rpc_responses.find(r=>r.method==='eth_call'&&r.params[0].data===freshSelector('metadataPolicy()')).result.slice(2).match(/.{64}/g).map(w=>BigInt('0x'+w));
const terms={enhanced_usd_18:metadata[0],singularity_usd_18:metadata[1]};
function setup(name='active_single'){
  const f=structuredClone(fixture.cases[name]);
  return {n:f.outputs.nft,m:{contracts:Object.fromEntries(Object.entries(f.outputs.nft.contracts).map(([k,v])=>[k,{address:v}])),input_assets:f.read_configuration.assets.filter(a=>a.symbol==='ETH'||a.symbol==='ZZZ'),reward_assets:f.read_configuration.assets}};
}
for(const name of ['active_single','active_residual','price_unavailable','dormant','principal_allocated','principal_ready','principal_paid'])test('actual backend source9 DTO validates: '+name,()=>{
  const {n,m}=setup(name);assert.equal(validateFreshNFT(n,m,terms),n);
});
test('exact LP ZZZ is disclosed as pending, never summed as ETH or silently claimed',()=>{
  const {n}=setup();const eth=n.claimable.lp[0],royalty=n.claimable.royalties[0];
  assert.equal(nativeRewards(n),(BigInt(eth.raw)+BigInt(royalty.raw)).toString());
  assert.match(pendingLPText(n),/5\.000000000000000017 ZZZ/);
  assert.ok(positionClaimEntries(n).some(c=>c.royalty&&c.asset!==ZERO));
  assert.ok(!positionClaimEntries(n).some(c=>!c.royalty&&c.asset!==ZERO));
  assert.match(renderPositionAmounts(n),/Paid in their original currency/);
});
test('dormant cards omit rewards, history and royalty opening notices',()=>{
  const {n}=setup('dormant'),html=renderPositionAmounts(n);
  assert.doesNotMatch(html,/Rewards to claim|Fees generated|claims open|Pending LP/);
});
test('separate principal return survives retained rewards and never enters ETH total',()=>{
  const {n,m}=setup('principal_ready');const before=nativeRewards(n);
  assert.match(principalReturnNote(n),/Principal remaining/);
  assert.match(principalReturnNote(n),/separate from rewards/);
  n.principal_return.assets[0].allocated_raw='900000000000000000000';
  n.principal_return.assets[0].remaining_raw='900000000000000000000';n.principal_return.assets[0].claimable_raw='900000000000000000000';
  assert.equal(nativeRewards(n),before);validateFreshNFT(n,m,terms);
});

test('terminal allocation phases, original amounts and payout flags remain coherent',()=>{
  for(const mutate of [n=>n.principal_return.allocated=false,n=>n.principal_return.paid=true,n=>n.principal_return.holder_claim_available_by_lifecycle=false,n=>n.principal_return.automatic_payout_available_by_lifecycle=false,n=>n.principal_return.assets[0].remaining_raw='122',n=>n.principal_return.assets[0].claimable_raw=null,n=>n.lifecycle.lp_exit_started=false,n=>n.lifecycle.lp_exit_phase_code=2,n=>n.lifecycle.new_economic_work_available_by_lifecycle=true]){const {n,m}=setup('principal_ready');mutate(n);assert.throws(()=>validateFreshNFT(n,m,terms));}
  for(const mutate of [n=>n.principal_return.allocated=true,n=>n.principal_return.paid=true]){const {n,m}=setup();mutate(n);assert.throws(()=>validateFreshNFT(n,m,terms));}
  const {n,m}=setup('principal_allocated');assert.equal(n.principal_return.assets[0].claimable_raw,null);validateFreshNFT(n,m,terms);
});

test('paid principal stays historical with zero remaining and no payout flag',()=>{
  for(const mutate of [n=>n.principal_return.assets[0].remaining_raw='1',n=>n.principal_return.assets[0].allocated_raw=null,n=>n.position.principal_redeemable=true,n=>n.principal_return.automatic_payout_available_by_lifecycle=true,n=>{n.principal_return.phase_code=2;n.principal_return.phase='allocating';}]){const {n,m}=setup('principal_paid');mutate(n);assert.throws(()=>validateFreshNFT(n,m,terms));}
});

test('collection principal phases bind the outer verified lifecycle',()=>{
  const {n,m}=setup('principal_ready'),life=n.lifecycle;delete n.lifecycle;
  assert.equal(validateFreshCollectionPosition(n,m,terms,life),n);
  assert.throws(()=>validateFreshCollectionPosition(n,m,terms,{...life,lp_exit_phase_code:1}));
});

test('unknown principal remains unavailable and never implies payable or zero amounts',()=>{
  const {n,m}=setup('principal_allocated');n.principal_return={available:false,reason:'Principal data unavailable'};
  assert.equal(validateFreshNFT(n,m,terms),n);assert.match(principalReturnNote(n),/unavailable/);
  n.principal_return.assets=[{remaining_raw:'1'}];assert.throws(()=>validateFreshNFT(n,m,terms));
});

test('dormant and terminal shares cannot be erased, fabricated or assigned to another custody bucket',()=>{
  for(const name of ['dormant','principal_allocated','principal_ready','principal_paid'])for(const mutate of [n=>n.position.shares_raw=n.position.activated?'0':'1',n=>n.position.bucket_id=n.position.activated?'0':'7']){const {n,m}=setup(name);mutate(n);assert.throws(()=>validateFreshNFT(n,m,terms));}
  for(const mutate of [n=>n.position.local_custody=null,n=>n.position.local_custody.lp_token_id='123',n=>n.position.local_custody.share_numerator_raw='1',n=>n.position.local_custody.last_rebalance_at=n.provenance.block_timestamp+1]){const {n,m}=setup('principal_ready');mutate(n);assert.throws(()=>validateFreshNFT(n,m,terms));}
});

test('parked custody preserves shares and requires a null live LP identifier',()=>{
  const {n,m}=setup('active_single');n.position.status='parked';n.position.local_custody.lp_token_id=null;delete n.position.local_custody.portfolio;n.position.current_lp_value.available=false;n.position.current_lp_value.raw=null;n.position.evolution_value_available=false;n.position.evolution='activated';
  assert.equal(validateFreshNFT(n,m,terms),n);n.position.local_custody.share_denominator_raw='1';assert.throws(()=>validateFreshNFT(n,m,terms));
});
test('duplicate legs, changed shares and invalid ticks reject instead of guessing NAV',()=>{
  for(const mutate of [n=>n.position.local_custody.portfolio.physical_legs[1].lp_token_id=n.position.local_custody.lp_token_id,n=>n.position.local_custody.share_numerator_raw='1',n=>n.position.local_custody.portfolio.physical_legs[0].tick_upper=-100]){
    const {n,m}=setup('active_residual');mutate(n);assert.throws(()=>validateFreshNFT(n,m,terms));
  }
});
test('governed cosmetic thresholds replace fixed historical USD tiers',()=>{
  const {n,m}=setup();n.position.current_lp_value.available=true;n.position.current_lp_value.raw=(2000n*10n**18n).toString();n.position.evolution_value_available=true;n.position.evolution='activated';
  const changed={enhanced_usd_18:3000n*10n**18n,singularity_usd_18:15000n*10n**18n};
  validateFreshCollectionPosition(n,m,changed);assert.throws(()=>validateFreshCollectionPosition(n,m,{enhanced_usd_18:1000n*10n**18n,singularity_usd_18:10000n*10n**18n}));
});
test('original royalty conversion flags and stale beneficiary reject',()=>{
  for(const mutate of [n=>n.claimable.royalties[1].conversion_required=true,n=>n.principal_return.beneficiary=ZERO]){
    const {n,m}=setup();mutate(n);assert.throws(()=>validateFreshNFT(n,m,terms));
  }
});
test('unavailable prices remain unavailable while exact funded claims are retained',()=>{
  const {n}=setup('price_unavailable');assert.equal(n.position.current_lp_value.raw,null);
  assert.ok(positionClaimEntries(n).length>0);assert.match(renderPositionAmounts(n),/Unavailable/);
});
test('claim plan presentation includes every status and explicitly requires replanning',()=>{
  const plan=fixture.cases.claim_policy2.outputs.plan;
  const html=reviewedClaimPlan({claim_plan:plan});
  for(const row of plan.entries)assert.match(html,new RegExp(row.status));
  assert.match(html,/nothing is queued or sent automatically/);
});
