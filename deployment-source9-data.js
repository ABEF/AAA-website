// Fresh7 DTO validation. Whole-unit monetary amounts never use floating point.
import {raw,ZERO} from './deployment-api.js';
const fail=m=>{throw Error(m);};
const address=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x);
const hash=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
const int=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const same=(a,b)=>a===b;

export function validateFreshCollectionPosition(n,m,metadata,lifecycle=n.lifecycle){
  const p=n.position,v=p?.current_lp_value,active=p?.activated;
  if(!address(n.owner)||n.owner===ZERO||typeof active!=='boolean'||typeof n.traits_ready!=='boolean'||
    !['active','parked','outbound','exited','dormant'].includes(p.status)||(p.status==='dormant')!==!active||
    !int(p.royalty_weight,0,3)||(p.royalty_weight>0)!==active||typeof p.principal_redeemable!=='boolean')fail('Fresh NFT eligibility or custody is inconsistent');
  if(n.traits_ready){
    if(!['Commun','Rare','Legendary'].includes(n.traits?.rarity)||!int(n.traits.palette,0,57)||!int(n.traits.pattern,0,3)||
      active&&p.royalty_weight!==['Commun','Rare','Legendary'].indexOf(n.traits.rarity)+1)fail('Fresh royalty weight differs from rarity');
  }else if(n.traits!==null||active)fail('Unrevealed NFT cannot have active liquidity');
  if(typeof v?.available!=='boolean'||v.decimals!==18||v.unit!=='USD'||v.source!=='NFT.currentLPValue'||p.evolution_value_available!==v.available)fail('Fresh LP valuation is malformed');
  const amount=v.available?raw(v.raw):null;
  if(!v.available&&v.raw!==null||!active&&amount!==0n||v.available&&!['active','dormant','exited'].includes(p.status))fail('Fresh LP valuation contradicts custody');
  const exited=p.status==='exited';
  if(exited&&(!v.available||amount!==0n)||!exited&&p.principal_redeemable)fail('Returned principal contradicts LP state');
  const stage=!active?'dormant':exited?'lp_exited':amount!==null&&amount>=metadata.singularity_usd_18?'singularity':amount!==null&&amount>=metadata.enhanced_usd_18?'enhanced':'activated';
  if(p.evolution!==stage)fail('Fresh evolution differs from confirmed governed thresholds');
  if(n.principal_return)validatePrincipalReturn(n,m,lifecycle);
  else fail('Fresh principal return state is unavailable');
  return n;
}

export function validatePrincipalReturn(n,m,lifecycle=n.lifecycle){
  const r=n.principal_return;
  if(typeof r.available!=='boolean')fail('Invalid principal return availability');
  if(!r.available){
    if(n.position.principal_redeemable||r.holder_claim_available_by_lifecycle===true||r.automatic_payout_available_by_lifecycle===true||
      Array.isArray(r.assets)&&r.assets.some(a=>['allocated_raw','remaining_raw','claimable_raw'].some(key=>a[key]!==null&&a[key]!==undefined)))fail('Unavailable principal return cannot contain payable amounts');
    return r;
  }
  if(r.beneficiary!==n.owner||!int(r.phase_code,0,3)||r.phase!==['operating','closing','allocating','ready'][r.phase_code]||typeof r.allocated!=='boolean'||typeof r.paid!=='boolean'||
    typeof r.holder_claim_available_by_lifecycle!=='boolean'||typeof r.automatic_payout_available_by_lifecycle!=='boolean'||
    !Array.isArray(r.assets)||r.assets.length!==2||r.holder_claim_available_by_lifecycle!==n.position.principal_redeemable)fail('Principal return beneficiary or lifecycle differs');
  if(r.allocated&&r.phase_code<2||r.phase_code===3&&!r.allocated||r.paid&&(!r.allocated||r.phase_code!==3)||n.position.status==='exited'&&r.phase_code===0||
    r.phase_code>=2&&n.position.activated&&n.position.status!=='exited')fail('Principal allocation contradicts the terminal phase');
  if(lifecycle&&(typeof lifecycle.lp_exit_started!=='boolean'||!int(lifecycle.lp_exit_phase_code,0,3)||
    lifecycle.lp_exit_phase_code!==r.phase_code||lifecycle.lp_exit_phase!==r.phase||lifecycle.lp_exit_started!==(r.phase_code!==0)||
    lifecycle.lp_exit_started&&lifecycle.new_economic_work_available_by_lifecycle!==false))fail('Principal return phase differs from canonical lifecycle');
  const expected=[ZERO,m.input_assets.find(a=>a.symbol==='ZZZ').address];let owed=false;
  for(const [i,a] of r.assets.entries()){
    const d=m.reward_assets.find(x=>x.address===expected[i]);
    if(a.asset!==expected[i]||a.symbol!==d?.symbol||a.decimals!==d.decimals)fail('Principal return currency differs');
    const values=['allocated_raw','remaining_raw','claimable_raw'].map(k=>a[k]===null?null:raw(a[k]));
    if(r.allocated&&values.slice(0,2).some(x=>x===null)||!r.allocated&&values.slice(0,2).some(x=>x!==null)||
      (r.phase_code===3)!==(values[2]!==null)||values[0]!==null&&(values[1]!== (r.paid?0n:values[0])||values[2]!==null&&values[2]!==values[1])||
      !n.position.activated&&values.some(value=>value!==null&&value!==0n))fail('Principal return amounts do not reconcile');
    if(values[1]!==null&&values[1]>0n)owed=true;
  }
  const payable=r.phase_code===3&&!r.paid&&owed;
  if(r.holder_claim_available_by_lifecycle!==payable||r.automatic_payout_available_by_lifecycle!==payable)fail('Principal payout flags contradict actual remaining amounts');
  return r;
}

export function validateFreshNFT(n,m,metadata){
  if(!n.lifecycle)fail('Fresh NFT canonical lifecycle is unavailable');
  validateFreshCollectionPosition(n,m,metadata);
  for(const [role,target] of Object.entries(n.contracts||{}))if(!m.contracts[role]||m.contracts[role].address!==target)fail('Fresh NFT module binding differs');
  const zzz=m.input_assets.find(a=>a.symbol==='ZZZ').address;
  if(n.claimable.default_settlement!=='native_eth'||n.claimable.lp.length!==2||
    !same(n.claimable.lp[0].asset,ZERO)||!same(n.claimable.lp[1].asset,zzz)||
    n.royalty_reporting?.schema!==5||n.royalty_reporting.allocation_method!=='whole_unit_rotating_tickets'||
    n.royalty_reporting.converter?.enabled!==false||n.royalty_reporting.converter?.address!==null)fail('Fresh exact LP or original royalty settlement differs');
  for(const a of n.claimable.royalties)if(a.settlement_mode!=='original_currency'||a.claim_asset!==a.asset||a.conversion_required!==false)fail('Royalty currency must remain original');
  if(!n.position.activated&&['lp','royalties'].some(scope=>n.claimable[scope].some(a=>a.raw!==null&&raw(a.raw)>0n)))fail('Dormant NFT has reward entitlements');
  const shares=raw(n.position.shares_raw),bucket=raw(n.position.bucket_id);
  if((shares>0n)!==n.position.activated||(bucket>0n)!==n.position.activated||!n.position.activated&&raw(n.position.cumulative_gross_contribution_usd_18)!==0n)fail('Fresh NFT shares or bucket contradict permanent eligibility');
  const c=n.position.local_custody;
  if(['active','parked','exited'].includes(n.position.status)){
    if(!c||!hash(c.pool_id)||c.pool_id==='0x'+'0'.repeat(64)||raw(c.share_numerator_raw)!==shares||raw(c.share_denominator_raw)!==raw(c.bucket_total_shares_raw)||
      raw(c.share_denominator_raw)<shares||!int(c.last_rebalance_at,0,Number.MAX_SAFE_INTEGER)||n.provenance&&c.last_rebalance_at>n.provenance.block_timestamp||
      (n.position.status==='active'?raw(c.lp_token_id)===0n:c.lp_token_id!==null))fail('Fresh local custody differs from retained NFT shares');
  }else if(c!==null)fail('Nonlocal or dormant fresh NFT contains local custody');
  if(n.position.status==='active'){
    const p=c?.portfolio;
    if(!c||!p||p.version!==2||p.bucket_id!==n.position.bucket_id||p.pool_id!==c.pool_id||!hash(c.pool_id)||p.main_lp_token_id!==c.lp_token_id||
      !hash(p.portfolio_fingerprint)||!Array.isArray(p.physical_legs)||p.physical_legs.length!==(p.secondary_lp_token_id===null?1:2)||
      raw(c.lp_token_id)===0n||raw(c.share_denominator_raw)===0n||raw(c.share_numerator_raw)>raw(c.share_denominator_raw)||
      raw(c.share_numerator_raw)!==raw(n.position.shares_raw)||raw(c.share_denominator_raw)!==raw(c.bucket_total_shares_raw))fail('Shared two-leg custody does not reconcile');
    const ids=[p.main_lp_token_id,...(p.secondary_lp_token_id===null?[]:[p.secondary_lp_token_id])];
    if(new Set(ids).size!==ids.length)fail('Duplicate physical LP position');
    for(const [i,leg] of p.physical_legs.entries())if(leg.lp_token_id!==ids[i]||raw(leg.lp_token_id)===0n||!int(leg.tick_lower,-887272,887272)||!int(leg.tick_upper,leg.tick_lower+1,887272))fail('Physical LP leg is invalid');
    if(p.physical_legs.length===2&&(p.physical_legs[1].tick_lower<p.physical_legs[0].tick_lower||p.physical_legs[1].tick_upper>p.physical_legs[0].tick_upper))fail('Residual physical range is outside the main');
    if(!Array.isArray(p.principal_amounts_raw)||p.principal_amounts_raw.length!==2)fail('Both LP assets must be valued');
    p.principal_amounts_raw.forEach(raw);
  }
  return n;
}
