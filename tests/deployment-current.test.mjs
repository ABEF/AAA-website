import test from 'node:test';
import assert from 'node:assert/strict';
import {currentSetup,currentFixtureNames} from './helpers/deployment-current-fixture.mjs';
import {validateDeployment,ZERO,ZERO_HASH} from '../deployment-api.js';
import {CurrentNativeProfile,CURRENT_CANONICAL_SCHEMA} from '../deployment-native.js';
import {contributionPolicyText} from '../deployment-view.js';
const word=n=>'0x'+BigInt(n).toString(16).padStart(64,'0'),aw=a=>a.slice(2).padStart(64,'0');
const block={blockHash:'0x'+'b'.repeat(64),requireCanonical:true};

for(const name of currentFixtureNames)test('source-bound current3 Python DTO reconstructs '+name,async()=>{
  const s=currentSetup(name),review=await s.api.prepare(s.intent);
  assert.ok(s.api.native instanceof CurrentNativeProfile);assert.equal(review.signing_enabled,false);
  assert.deepEqual(review.transaction,s.f.draft.transaction);
  assert.equal(s.f.nft.provenance.accounting_version,3);
  if(name==='claim_eth_both'){assert.equal(review.claims.length,2);assert.ok(review.claims.every(c=>c.asset===ZERO));return;}
  assert.equal(review.execution_limit_bps,200);assert.equal(review.reviewed_maximum_loss_bps,200);
  assert.equal(review.minimum_deployed_usd_18,'98000000000000000000');
  assert.equal(review.action,name.startsWith('approve')?'approve':s.intent.action);
  if(name==='approve_zzz'){
    assert.equal(review.transaction.to,s.m.input_assets.find(a=>a.symbol==='ZZZ').address);
    assert.equal(review.transaction.data,'0x095ea7b3'+aw(s.m.contracts.entry.address)+word(100n*10n**18n).slice(2));
  }else assert.equal(review.transaction.data.slice(0,10),'0x7d2edfe7');
});

for(const [name,change] of [
  ['missing accounting',m=>delete m.accounting_version],['missing governance',m=>delete m.governance_version],
  ['old governance',m=>m.governance_version=1],['old fees',m=>m.fee_intake_version=0],
  ['old canonical',m=>m.canonical_schema=ZERO_HASH],['unknown setting',m=>m.signing_enabled=true],
  ['stablecoin source',m=>m.input_assets[1].symbol='USDC'],['wrapper input',m=>m.input_assets[1].symbol='WETH'],
  ['missing ZZZ',m=>m.input_assets.pop()],['third source',m=>m.input_assets.push({...m.input_assets[1],symbol:'USDG'})],
  ['missing handoff pin',m=>delete m.contracts.handoff],['missing fees pin',m=>delete m.contracts.fees],
])test('current3 manifest rejects '+name,()=>{
  const m=structuredClone(currentSetup().m);change(m);assert.throws(()=>validateDeployment(m,'http://127.0.0.1:4190'));
});
test('schema3 cannot be a relabelled schema2 or legacy configuration',()=>{
  for(const schema of [1,2]){const m=structuredClone(currentSetup().m);m.schema=schema;assert.throws(()=>validateDeployment(m,'http://127.0.0.1:4190'));}
});

for(const [name,role,selector,value] of [
  ['accounting2','vault','0xebbc42b6',word(2)],['timelock governance','access','0xf3f0172e',word(1)],
  ['old fee intake','fees','0x5b9715f3',word(0)],['unsealed','access','0x631f9852',word(0)],
  ['wrong canonical chain','vault','0x0c7bdd72',word(46630)],['wrong canonical schema','handoff','0xb4a8b1b8',ZERO_HASH],
  ['wrong fixed ZZZ','activation_assets','0xa4dff0a2',word(999)],['missing source policy','activation_assets','0x9694a103','0x'],
  ['zero governance','access','0x5aa6e675',word(0)],
])test('current3 chain verification rejects '+name,async()=>{
  const s=currentSetup();s.set(role,selector,value);await assert.rejects(s.api.protocol());
});
test('current3 checks handoff/fee runtime and controller module parents',async()=>{
  for(const role of ['fees','handoff']){
    const s=currentSetup();s.f.codes[s.pins[role]]='0x600099';await assert.rejects(s.api.protocol(),/implementation changed/);
    const p=currentSetup();p.set(role,'0x71907f17',word(999));await assert.rejects(p.api.protocol(),/parent binding/);
  }
});
test('current3 immutable checks cache only successful exact canonical block verification',async()=>{
  const s=currentSetup();await s.api.native.verify(block);const first=s.calls.length;
  await s.api.native.verify(block);assert.equal(s.calls.length,first);
  const t=currentSetup();t.set('fees','0x5b9715f3',word(0));await assert.rejects(t.api.native.verify(block));
  t.set('fees','0x5b9715f3',word(1));await t.api.native.verify(block);
});

for(const [name,change] of [
  ['old provenance',n=>n.provenance.accounting_version=2],
  ['retired remote',n=>n.position.status='remote'],['retired inbound',n=>n.position.status='inbound'],
  ['dormant accrued rewards',n=>n.claimable.lp[0].raw='1'],['dormant positive principal',n=>n.position.current_lp_value.raw='1'],
  ['dormant shares',n=>n.position.shares_raw='1'],['dormant bucket',n=>n.position.bucket_id='1'],
  ['dormant entitlement',n=>n.position.royalty_weight=1],['dormant historical contribution',n=>n.position.cumulative_gross_contribution_usd_18='1'],
])test('current3 dormant NFT rejects '+name,()=>{
  const s=currentSetup(),n=structuredClone(s.f.nft);change(n);assert.throws(()=>s.api.validateNFT(n,n.token_id,n.owner));
});
test('current3 active/parked/outbound retain unclaimed rights and honest unavailable NAV',()=>{
  const s=currentSetup('increase_eth'),base=s.f.nft;
  assert.equal(s.api.validateNFT(base,base.token_id,base.owner),base);
  for(const status of ['parked','outbound']){
    const n=structuredClone(base);n.position.status=status;n.position.current_lp_value.available=false;n.position.current_lp_value.raw=null;
    n.position.evolution_value_available=false;n.position.evolution='activated';
    if(status==='parked')n.position.local_custody.lp_token_id=null;else n.position.local_custody=null;
    assert.equal(s.api.validateNFT(n,n.token_id,n.owner),n);
  }
});
test('current3 local share denominator, rarity weight and current evolution must reconcile',()=>{
  for(const change of [n=>n.position.local_custody.share_denominator_raw='1',n=>n.position.local_custody.share_numerator_raw='1',n=>n.position.local_custody.lp_token_id=null,n=>n.position.royalty_weight=3,n=>n.position.evolution='singularity']){
    const s=currentSetup('increase_eth'),n=structuredClone(s.f.nft);change(n);assert.throws(()=>s.api.validateNFT(n,n.token_id,n.owner));
  }
});
test('optional unknown reward currency stays unavailable without erasing a healthy native claim',()=>{
  const s=currentSetup('increase_eth'),n=structuredClone(s.f.nft);
  n.claimable.royalties[1].raw=null;n.claimable.royalties[1].available=false;
  assert.equal(s.api.validateNFT(n,n.token_id,n.owner),n);
});
test('current3 review shows its captured cap rather than historical99% policy',()=>{
  const s=currentSetup();assert.match(contributionPolicyText(s.m),/2%/);assert.doesNotMatch(contributionPolicyText(s.m),/99%/);
  assert.equal(s.m.canonical_schema,CURRENT_CANONICAL_SCHEMA);
});
test('current3 fixture uses the actual eight-word current Position and keeps HTTP schema2',()=>{
  const s=currentSetup('increase_eth');
  // group(uint256) selector is source-bound; never select a codec from row length.
  const group=s.f.rpc_responses.find(r=>r.target===s.pins.vault&&r.data==='0x0bd0e7fa'+word(BigInt(s.f.nft.position.bucket_id)).slice(2));
  assert.ok(group);assert.equal(group.result.length,2+8*64);
  assert.equal(s.f.protocol.schema,2);assert.equal(s.m.schema,3);
});
test('current3 unavailable contribution prices or wider contribution cap do not erase valid NFT reads',async()=>{
  for(const change of [s=>s.set('budget','0xa7b5810c',word(201)),s=>s.set('oracle','0x4cbb3d60'+aw(ZERO),'0x')]){
    const s=currentSetup('increase_eth');change(s);
    assert.equal((await s.api.nft(s.f.nft.token_id,s.f.nft.owner)).token_id,s.f.nft.token_id);
    await assert.rejects(s.api.prepare(s.intent));
  }
});
test('current3 collection rejects retired custody states while preserving verified one-NFT totals',async()=>{
  for(const status of ['active','remote','inbound']){
    const s=currentSetup('increase_eth'),n=structuredClone(s.f.nft);n.position.status=status;
    // Synthetic one-item collection: the source NFT DTO's ordinal444 is not a one-item inventory.
    n.mint_ordinal=1;
    const id=n.token_id,digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id)))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const original=s.api.fetcher;
    s.api.fetcher=async(url,options)=>new URL(url).pathname.includes('/collection/')?new Response(JSON.stringify({schema:1,chain_id:s.m.chain_id,nft_contract:s.pins.nft,available:true,count:1,inventory_sha256:digest,inventory_token_ids:[id],offset:0,chunk_size:16,positions:[n],next_offset:null,chunk_lp_usd_18:n.position.current_lp_value.raw,chunk_activated:1,provenance:s.f.protocol.provenance}),{headers:{'Content-Type':'application/json'}}):original(url,options);
    if(status==='active')assert.equal((await s.api.collectionPositions()).lp_usd_18,n.position.current_lp_value.raw);
    else await assert.rejects(s.api.collectionPositions(),/identity or eligibility/);
  }
});
