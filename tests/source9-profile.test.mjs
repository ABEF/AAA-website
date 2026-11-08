import test from 'node:test';
import assert from 'node:assert/strict';
import {FreshProfile,FRESH_ROLES,FRESH_CANONICAL_SCHEMA,validateFreshManifest,freshKeccak,freshSelector} from '../deployment-source9.js';
import {source9ProfileFixture,source9Setup,source9Block,testWord,testAddress} from './helpers/source9-profile-fixture.mjs';

test('Ethereum Keccak public identity vectors use Keccak padding and exact selectors',()=>{
  assert.equal(freshKeccak('0x'),'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(freshKeccak('0x616263'),'0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  assert.equal(freshSelector('access()'),'0x71907f17');assert.equal(freshSelector('transfer(address,uint256)'),'0xa9059cbb');
  assert.equal(FRESH_CANONICAL_SCHEMA,'0xd077e0d60fbbef64fe13686e9deef1d4bf95fb9f9c1e632da05a58b8db6de5e8');
  for(const input of ['abc','0x1','0xzz',null])assert.throws(()=>freshKeccak(input));
});

test('source9 verifies fixed exact-LP parents and all runtime pins using read RPC only',async()=>{
  const s=source9ProfileFixture();await s.profile.verify(source9Block);
  assert.equal(s.calls.filter(c=>c.method==='eth_getCode').length,FRESH_ROLES.length);
  for(const c of s.calls){assert.ok(['eth_call','eth_getCode'].includes(c.method));assert.deepEqual(c.params[1],source9Block);}
  assert.equal(s.calls.some(c=>c.method==='eth_call'&&['0x2e4c02f3','0x2e59691a'].includes(c.params[0].data.slice(0,10))),false);
  assert.equal(await s.profile.cap(source9Block),200);
});

test('graph checks bound RPC concurrency and coalesce simultaneous proofs at one canonical hash',async()=>{
  const s=source9ProfileFixture();let inFlight=0,maximum=0;
  const reader={async request(request){inFlight++;maximum=Math.max(maximum,inFlight);try{await new Promise(resolve=>setTimeout(resolve,0));return await s.reader.request(request);}finally{inFlight--;}}};
  const profile=new FreshProfile(s.manifest,reader);await Promise.all([profile.verify(source9Block),profile.verify(source9Block)]);
  assert.ok(maximum>1);assert.ok(maximum<=6);assert.equal(s.calls.filter(c=>c.method==='eth_getCode').length,FRESH_ROLES.length);assert.equal(inFlight,0);
});

test('the historical accounting3 shape cannot be relabeled as source9',()=>{
  const {manifest:m}=source9ProfileFixture();
  for(const change of [n=>n.schema=3,n=>n.source_profile=8,n=>n.accounting_version=6,n=>n.canonical_schema='0x'+'1'.repeat(64),n=>n.routing_version=2,n=>n.review_policy_version=1,n=>n.custody_version=4,n=>delete n.lp_allocation_version,n=>delete n.contracts.rewards_canonical,n=>n.contracts.extra={address:testAddress(250),runtime_code:'0x6000'},n=>n.input_assets[0].route_id='0x'+'0'.repeat(64),n=>n.input_assets[1].symbol='USDC',n=>n.input_assets[1].valuation_asset=testAddress(251),n=>n.limits.maximum_contribution_loss_bps=1001]){
    const candidate=structuredClone(m);change(candidate);assert.throws(()=>validateFreshManifest(candidate));
  }
});

test('fresh manifest binds both LP currency descriptors and the explicit transaction consumer policy',()=>{
  const {manifest:m}=source9ProfileFixture();
  for(const change of [n=>delete n.transaction_policy_schema,n=>n.transaction_policy_schema=3,n=>n.reward_assets.pop(),n=>n.reward_assets[1].decimals=6,n=>n.reward_assets[1].symbol='OTHER',n=>n.reward_assets.push({address:testAddress(250),symbol:'ABCDEFGHIJKLMNOPQ',decimals:18}),n=>n.reward_assets.push({address:n.contracts.vault.address,symbol:'ABC',decimals:18}),n=>n.reward_assets.push({...n.reward_assets[0]})]){const candidate=structuredClone(m);change(candidate);assert.throws(()=>validateFreshManifest(candidate));}
  const policy2=structuredClone(m);policy2.transaction_policy_schema=2;assert.doesNotThrow(()=>validateFreshManifest(policy2));
});

test('actual Python fresh7 read DTO graph verifies with explicitly synthetic absent source extras',async()=>{
  for(const name of ['active_single','active_residual','price_unavailable','dormant','principal_allocated','principal_ready','principal_paid']){
    const s=source9Setup(name);await s.profile.verify(s.block);
    assert.equal(s.f.nft.provenance.accounting_version,7);assert.equal(s.m.projection_sha256,s.f.projection_identity);
    const metadata=await s.profile.metadataPolicy(s.block);
    // This non-default fingerprint is produced independently by the actual
    // Python ProtocolPolicy observer, not by the synthetic helper's defaults.
    assert.equal(metadata.enhanced_usd_18,2000n*10n**18n);assert.equal(metadata.singularity_usd_18,20000n*10n**18n);assert.equal(metadata.revision,4n);
    assert.equal(metadata.fingerprint,'0xce6c23957c3e8f1935bd1307bb7c9f5488cd9d9e8bd7daa3de7ef2aa54ae4211');
  }
});

for(const [role,method,value] of [['vault','ACCOUNTING_VERSION()',6],['rewards','LP_ALLOCATION_VERSION()',0],['principal_exit','CUSTODY_VERSION()',4],['royalties','ROYALTY_SETTLEMENT_VERSION()',3],['entry','ENTRY_ROUTING_VERSION()',2],['entry','REVIEW_POLICY_VERSION()',1],['budget','RESIDUAL_REINVEST_VERSION()',0],['lp_position_executor','RESIDUAL_EXIT_VERSION()',0],['access','isSealed()',0]])test('source9 refuses historical or unsupported '+role+'.'+method,async()=>{
  const s=source9ProfileFixture();s.set(role,method,[value]);await assert.rejects(s.profile.verify(source9Block),/capability/);
});

test('same tuple shape cannot hide wrong canonical child, typed executor parent or upstream links',async()=>{
  for(const [role,method] of [['rewards','canonicalModule()'],['rewards_canonical','rewards()'],['lp_position_executor','liquidityManager()'],['lp_balance_math','balancer()'],['position_manager','poolManager()'],['state_view','poolManager()'],['access','protocolPolicy()']]){
    const s=source9ProfileFixture();s.set(role,method,[testAddress(250)]);await assert.rejects(s.profile.verify(source9Block),/binding/);
  }
  const s=source9ProfileFixture();s.set('handoff','moduleAt(uint8)',[s.manifest.contracts.rewards.address],testWord(3));await assert.rejects(s.profile.verify(source9Block),/binding/);
});

test('runtime changes, malformed getters and noncanonical block selectors fail closed',async()=>{
  for(const role of ['rewards_canonical','lp_position_executor','pool_manager','fees']){const s=source9ProfileFixture();s.codes.set(s.manifest.contracts[role].address,'0x600099');await assert.rejects(s.profile.verify(source9Block),/runtime changed/);}
  const s=source9ProfileFixture();s.getters.set(s.manifest.contracts.vault.address+':'+freshSelector('ACCOUNTING_VERSION()'),'0x07');await assert.rejects(s.profile.verify(source9Block),/malformed/);
  for(const block of ['latest',{blockHash:source9Block.blockHash,requireCanonical:false},{...source9Block,blockNumber:'0x1'}])await assert.rejects(source9ProfileFixture().profile.verify(block),/canonical/);
});

test('failed graph verification is retryable and successful proofs are scoped to one canonical hash',async()=>{
  const s=source9ProfileFixture();s.set('rewards','LP_ALLOCATION_VERSION()',[0]);await assert.rejects(s.profile.verify(source9Block));s.set('rewards','LP_ALLOCATION_VERSION()',[1]);await s.profile.verify(source9Block);const count=s.calls.length;await s.profile.verify(source9Block);assert.equal(s.calls.length,count);
  await assert.rejects(s.profile.verify({blockHash:'0x'+'c'.repeat(64),requireCanonical:true}),/Unpinned/);assert.ok(s.calls.length>count);
});

test('entry and metadata policy observations retain exact units and independently recompute scoped fingerprints',async()=>{
  const s=source9ProfileFixture(),entry=await s.profile.entryPolicy(source9Block),metadata=await s.profile.metadataPolicy(source9Block);
  assert.equal(entry.minimum_activation_usd_18,100n*10n**18n);assert.equal(entry.minimum_growth_usd_18,5n*10n**18n);assert.equal(entry.maximum_idle_bps,500);assert.equal(entry.revision,1n);
  assert.equal(metadata.enhanced_usd_18,1000n*10n**18n);assert.equal(metadata.singularity_usd_18,10000n*10n**18n);
  s.policy('entry',[120n*10n**18n,6n*10n**18n,500n,2n]);assert.equal((await s.profile.entryPolicy(source9Block)).minimum_activation_usd_18,120n*10n**18n);
  s.set('protocol_policy','entryFingerprint()',['0x'+'9'.repeat(64)]);await assert.rejects(s.profile.entryPolicy(source9Block),/fingerprint/);
});

test('policy ABI widths, positive revisions, minima and ordered cosmetic thresholds are enforced',async()=>{
  for(const values of [[10n**18n-1n,10n**18n,500n,1n],[100n*10n**18n,101n*10n**18n,500n,1n],[100n*10n**18n,5n*10n**18n,4001n,1n],[100n*10n**18n,5n*10n**18n,500n,0n],[1n<<128n,5n*10n**18n,500n,1n]]){const s=source9ProfileFixture();s.policy('entry',values);await assert.rejects(s.profile.entryPolicy(source9Block),/bounds/);}
  for(const values of [[0n,100n,1n],[100n,100n,1n],[100n,1000n,1n<<64n]]){const s=source9ProfileFixture();s.policy('metadata',values);await assert.rejects(s.profile.metadataPolicy(source9Block),/bounds/);}
});

test('dual prices verify original asset code, source admission and both exact bounds without routed getters',async()=>{
  const s=source9ProfileFixture();for(const asset of s.manifest.input_assets){const price=await s.profile.price(asset,source9Block);assert.equal(price.lower,10n**18n);assert.equal(price.upper,101n*10n**16n);assert.equal(price.asset,asset.address);}
  s.codes.set(s.manifest.input_assets[1].address,'0x600099');await assert.rejects(s.profile.price(s.manifest.input_assets[1],source9Block),/token identity/);
  const t=source9ProfileFixture();t.set('activation_assets','isContributionAsset(address)',[0],testWord(0));await assert.rejects(t.profile.price(t.manifest.input_assets[0],source9Block),/admission/);
  const u=source9ProfileFixture();u.set('oracle','priceBounds(address)',[0,1,1],testWord(0));await assert.rejects(u.profile.price(u.manifest.input_assets[0],source9Block),/price bounds/);
});

test('an increased contribution cap never silently exceeds the reviewed manifest',async()=>{
  const s=source9ProfileFixture();s.set('budget','contributionLossBps()',[201]);await assert.rejects(s.profile.cap(source9Block),/reviewed ceiling/);
  assert.equal('send' in s.profile,false);assert.equal('sign' in s.profile,false);assert.equal('provider' in s.profile,false);
});
