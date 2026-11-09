import test from 'node:test';
import assert from 'node:assert/strict';
import {Source10Profile,SOURCE10_ROLES,SOURCE10_CANONICAL_SCHEMA,MINT_VERSIONS,validateSource10Manifest,freshKeccak,freshSelector} from '../deployment-source10.js';
import {FRESH_CANONICAL_SCHEMA,validateFreshManifest} from '../deployment-source9.js';
import {source10ProfileFixture,source10Block,testWord,testAddress} from './helpers/source10-profile-fixture.mjs';

const clone=value=>structuredClone(value);
const key=(s,role,signature,argument='')=>s.manifest.contracts[role].address+':'+freshSelector(signature)+argument;

test('source10 requires its explicit schema5 Mint2 V10 identity and all 33 distinct pins',()=>{
  const {manifest}=source10ProfileFixture();
  assert.equal(SOURCE10_CANONICAL_SCHEMA,'0x39072e4b9a0ee67088975eb1e1705d8c18c76abc065e31bab795739387ec2952');
  assert.equal(SOURCE10_ROLES.length,33);
  assert.ok(MINT_VERSIONS.includes('mint_integration_version'));
  assert.doesNotThrow(()=>validateSource10Manifest(manifest));
  assert.throws(()=>validateFreshManifest(manifest));
  for(const change of [m=>m.schema=4,m=>m.source_profile=9,m=>m.mint_integration_version=1,m=>m.mint_integration_version=true,m=>delete m.mint_integration_version,m=>m.accounting_version=6,m=>m.canonical_schema=FRESH_CANONICAL_SCHEMA,
    ...['seadrop_mint','seadrop','metadata_renderer','nft_canonical'].map(role=>m=>delete m.contracts[role]),
    m=>m.contracts.nft_canonical.address=m.contracts.metadata_renderer.address,m=>m.contracts.extra={address:testAddress(250),runtime_code:'0x6000'},m=>m.limits.maximum_contribution_loss_bps=1001]){
    const candidate=clone(manifest);change(candidate);assert.throws(()=>validateSource10Manifest(candidate));
  }
});

test('source10 permits the exact66-currency LP/royalty union and rejects a67th descriptor',()=>{
  const {manifest}=source10ProfileFixture();
  for(let i=0;i<64;i++)manifest.reward_assets.push({address:testAddress(300+i),symbol:'R'+i,decimals:18});
  assert.equal(manifest.reward_assets.length,66);assert.doesNotThrow(()=>validateSource10Manifest(manifest));
  manifest.reward_assets.push({address:testAddress(400),symbol:'EXTRA',decimals:18});assert.throws(()=>validateSource10Manifest(manifest),/reward descriptor inventory/);
});

test('source10 verifies exact SeaDrop, renderer, codec and retained LP graph only at one canonical block',async()=>{
  const s=source10ProfileFixture();await s.profile.verify(source10Block);
  assert.equal(s.calls.filter(c=>c.method==='eth_getCode').length,33);
  for(const request of s.calls){assert.ok(['eth_call','eth_getCode'].includes(request.method));assert.deepEqual(request.params[1],source10Block);}
  for(const [role,signature] of [['nft','seaDropMint()'],['nft','metadataRenderer()'],['nft','canonicalModule()'],['seadrop_mint','MINT_INTEGRATION_VERSION()'],['seadrop_mint','seaDropCodeHash()'],['nft_canonical','nft()']])assert.ok(s.calls.some(c=>c.method==='eth_call'&&c.params[0].to===s.manifest.contracts[role].address&&c.params[0].data===freshSelector(signature)));
  // The external SeaDrop has no protocol access() method. Renderer and codec
  // identities are runtime-pinned; no invented version getter is required.
  assert.equal(s.calls.some(c=>c.method==='eth_call'&&c.params[0].to===s.manifest.contracts.seadrop.address),false);
  assert.equal('send' in s.profile,false);assert.equal('sign' in s.profile,false);assert.equal('provider' in s.profile,false);
});

test('graph proof concurrency is at most six and simultaneous callers coalesce',async()=>{
  const s=source10ProfileFixture();let inFlight=0,maximum=0;
  const reader={async request(request){inFlight++;maximum=Math.max(maximum,inFlight);try{await new Promise(resolve=>setTimeout(resolve,0));return await s.reader.request(request);}finally{inFlight--;}}};
  const profile=new Source10Profile(s.manifest,reader);
  await Promise.all([profile.verify(source10Block),profile.verify(source10Block),profile.verify(source10Block)]);
  assert.ok(maximum>1);assert.ok(maximum<=6);assert.equal(inFlight,0);assert.equal(s.calls.filter(c=>c.method==='eth_getCode').length,33);
});

test('every new parent binding and both codec registries are authenticated independently',async()=>{
  for(const [role,signature] of [['nft','seaDropMint()'],['seadrop_mint','access()'],['seadrop_mint','nft()'],['seadrop_mint','seaDrop()'],['nft','metadataRenderer()'],['metadata_renderer','access()'],['nft','canonicalModule()'],['nft_canonical','access()'],['nft_canonical','nft()']]){
    const s=source10ProfileFixture();s.set(role,signature,[testAddress(250)]);await assert.rejects(s.profile.verify(source10Block),/binding/);
  }
  const s=source10ProfileFixture();s.set('handoff','moduleAt(uint8)',[s.manifest.contracts.rewards_canonical.address],testWord(0));await assert.rejects(s.profile.verify(source10Block),/binding/);
  const t=source10ProfileFixture(),label='0x'+[...new TextEncoder().encode('ZZZNFTCanonical')].map(n=>n.toString(16).padStart(2,'0')).join('');
  t.set('access','module(bytes32)',[t.manifest.contracts.nft.address],freshKeccak(label).slice(2));await assert.rejects(t.profile.verify(source10Block),/binding/);
});

test('Mint2 manifest cannot substitute helper2, V9 codec or a different SeaDrop runtime commitment',async()=>{
  for(const value of [0,2]){const s=source10ProfileFixture();s.set('seadrop_mint','MINT_INTEGRATION_VERSION()',[value]);await assert.rejects(s.profile.verify(source10Block),/capability/);}
  const s=source10ProfileFixture();s.set('handoff','SCHEMA()',[FRESH_CANONICAL_SCHEMA]);await assert.rejects(s.profile.verify(source10Block),/V10/);
  const t=source10ProfileFixture();t.set('seadrop_mint','seaDropCodeHash()',['0x'+'1'.repeat(64)]);await assert.rejects(t.profile.verify(source10Block),/runtime hash/);
  for(const role of ['seadrop_mint','seadrop','metadata_renderer','nft_canonical']){const u=source10ProfileFixture();u.codes.set(u.manifest.contracts[role].address,'0x600099');await assert.rejects(u.profile.verify(source10Block),/runtime changed/);}
});

test('mutable sale configuration, mint availability and lifetime mint counts do not gate existing rights',async()=>{
  const s=source10ProfileFixture();
  // This reader deliberately has no mutable sale replies. Adding even one of
  // these reads to graph authentication fails this test instead of inventing
  // eligibility from a phase window or a current owner balance.
  const mutable=new Set(['configured()','minting()','currentPhase()','mintConfig()','reviewedMintPrice()','configurationHash()','configurationValuesHash()','getPublicDrop(address)','salePolicy()','mintEnd()','getMintStats(address)','originalMintRecipient(uint256)','mintStageOf(uint256)'].map(freshSelector));
  const reader={async request(request){if(request.method==='eth_call'&&mutable.has(request.params[0].data.slice(0,10)))throw Error('Mutable mint terms must not gate rewards');return s.reader.request(request);}};
  const profile=new Source10Profile(s.manifest,reader);await profile.verify(source10Block);
  assert.equal(await profile.cap(source10Block),300);
  assert.equal((await profile.metadataPolicy(source10Block)).enhanced_usd_18,1000n*10n**18n);
  assert.equal(s.calls.some(c=>c.method==='eth_call'&&mutable.has(c.params[0].data.slice(0,10))),false);
});

test('a reviewed contribution ceiling stays separate from ownership and reward verification',async()=>{
  const s=source10ProfileFixture(),manifest=clone(s.manifest);manifest.limits.maximum_contribution_loss_bps=200;
  const stricter=new Source10Profile(manifest,s.reader);await stricter.verify(source10Block);
  await assert.rejects(stricter.cap(source10Block),/reviewed ceiling/);
  assert.equal(await s.profile.cap(source10Block),300);
  s.set('budget','contributionLossBps()',[1001]);await assert.rejects(s.profile.cap(source10Block),/reviewed ceiling/);
});

test('caller manifest mutation cannot retarget a cached source10 graph or widen its ceiling',async()=>{
  const s=source10ProfileFixture(),original=s.manifest.contracts.budget.address;
  await s.profile.verify(source10Block);s.manifest.contracts.budget.address=testAddress(250);s.manifest.limits.maximum_contribution_loss_bps=1000;
  assert.equal(s.profile.m.contracts.budget.address,original);assert.equal(s.profile.m.limits.maximum_contribution_loss_bps,300);
  assert.throws(()=>s.profile.m.contracts.budget.address=testAddress(250),TypeError);
  assert.equal(await s.profile.cap(source10Block),300);assert.equal(s.calls.at(-1).params[0].to,original);
});

test('a caller cannot mutate the canonical hash between parallel proof batches or a later policy read',async()=>{
  for(const operation of ['verify','cap','entryPolicy','metadataPolicy','price']){
    const s=source10ProfileFixture(),block={...source10Block};let changed=false;
    const reader={async request(request){if(!changed){changed=true;block.blockHash='0x'+'c'.repeat(64);block.requireCanonical=false;}return s.reader.request(request);}};
    const profile=new Source10Profile(s.manifest,reader);
    if(operation==='price')await profile.price(s.manifest.input_assets[0],block);else await profile[operation](block);
    assert.ok(changed);assert.ok(s.calls.length>=33);for(const request of s.calls)assert.deepEqual(request.params[1],source10Block);
    const count=s.calls.length;await profile.verify(source10Block);assert.equal(s.calls.length,count);
  }
});

test('malformed new getters and unpinned block selectors fail closed without poisoning retry',async()=>{
  const s=source10ProfileFixture(),k=key(s,'seadrop_mint','MINT_INTEGRATION_VERSION()');s.getters.set(k,'0x01');
  await assert.rejects(s.profile.verify(source10Block),/malformed/);s.set('seadrop_mint','MINT_INTEGRATION_VERSION()',[1]);await s.profile.verify(source10Block);
  const count=s.calls.length;await s.profile.verify(source10Block);assert.equal(s.calls.length,count);
  for(const block of ['latest',{blockHash:source10Block.blockHash,requireCanonical:false},{...source10Block,blockNumber:'0x1'}])await assert.rejects(s.profile.verify(block),/canonical/);
  await assert.rejects(s.profile.verify({blockHash:'0x'+'c'.repeat(64),requireCanonical:true}),/Unpinned/);assert.ok(s.calls.length>count);
});

test('retained core capability and typed executor bindings still reject historical or wrong modules',async()=>{
  for(const [role,signature,value] of [['vault','ACCOUNTING_VERSION()',6],['rewards','LP_ALLOCATION_VERSION()',0],['principal_exit','CUSTODY_VERSION()',4],['access','isSealed()',0],['budget','RESIDUAL_REINVEST_VERSION()',0]]){
    const s=source10ProfileFixture();s.set(role,signature,[value]);await assert.rejects(s.profile.verify(source10Block),/capability/);
  }
  for(const [role,signature] of [['rewards','canonicalModule()'],['rewards_canonical','rewards()'],['lp_position_executor','liquidityManager()'],['lp_balance_math','balancer()'],['position_manager','poolManager()']]){
    const s=source10ProfileFixture();s.set(role,signature,[testAddress(250)]);await assert.rejects(s.profile.verify(source10Block),/binding/);
  }
});

test('entry and metadata policies retain independent scoped fingerprints and exact units',async()=>{
  const s=source10ProfileFixture(),entry=await s.profile.entryPolicy(source10Block),metadata=await s.profile.metadataPolicy(source10Block);
  assert.equal(entry.minimum_activation_usd_18,100n*10n**18n);assert.equal(entry.minimum_growth_usd_18,5n*10n**18n);assert.equal(entry.maximum_idle_bps,500);
  assert.equal(metadata.enhanced_usd_18,1000n*10n**18n);assert.equal(metadata.singularity_usd_18,10000n*10n**18n);
  s.policy('entry',[120n*10n**18n,6n*10n**18n,500n,2n]);assert.equal((await s.profile.entryPolicy(source10Block)).minimum_activation_usd_18,120n*10n**18n);
  s.set('protocol_policy','entryFingerprint()',['0x'+'9'.repeat(64)]);await assert.rejects(s.profile.entryPolicy(source10Block),/fingerprint/);
  assert.equal((await s.profile.metadataPolicy(source10Block)).revision,1n);
});

test('ETH and fixed ZZZ still require reviewed token identity, admission and positive dual-source bounds',async()=>{
  const s=source10ProfileFixture();for(const asset of s.manifest.input_assets){const price=await s.profile.price(asset,source10Block);assert.equal(price.lower,10n**18n);assert.equal(price.upper,101n*10n**16n);assert.equal(price.asset,asset.address);}
  s.codes.set(s.manifest.input_assets[1].address,'0x600099');await assert.rejects(s.profile.price(s.manifest.input_assets[1],source10Block),/token identity/);
  const t=source10ProfileFixture();t.set('activation_assets','isContributionAsset(address)',[0],testWord(0));await assert.rejects(t.profile.price(t.manifest.input_assets[0],source10Block),/admission/);
  const u=source10ProfileFixture();u.set('oracle','priceBounds(address)',[0,1,1],testWord(0));await assert.rejects(u.profile.price(u.manifest.input_assets[0],source10Block),/price bounds/);
});
