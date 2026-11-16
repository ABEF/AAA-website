import test from 'node:test';
import assert from 'node:assert/strict';
import {positionArtwork,positionEvolutionLabel,holdPendingArtwork} from '../deployment-view.js';

const nft=(changes={})=>({traits_ready:true,traits:{palette:0,pattern:0,rarity:'Rare'},
  position:{activated:true,evolution:'enhanced',evolution_value_available:true,
    current_lp_value:{available:true,raw:'1000000000000000000000'},...changes}});

test('unavailable activated valuation uses labelled fallback without inventing value',()=>{
  const n=nft({evolution:'activated',evolution_value_available:false,current_lp_value:{available:false,raw:null}});
  const before=structuredClone(n);
  assert.equal(positionArtwork(n).evolution,'activated');
  assert.equal(positionEvolutionLabel(n),'Valuation unavailable · Activated fallback');
  assert.deepEqual(n,before);
});

test('dormant and unrevealed NFTs never gain activation from an outage fallback',()=>{
  const dormant=nft({activated:false,evolution:'dormant'});
  assert.equal(positionArtwork(dormant).evolution,'dormant');
  assert.equal(positionEvolutionLabel(dormant),'dormant');
  assert.equal(positionArtwork(nft({activated:false,evolution_value_available:false})),null);
  assert.equal(positionArtwork({...nft(),traits_ready:false,traits:null}),null);
});

test('terminal artwork remains activated with explicit LP exited label',()=>{
  const n=nft({evolution:'lp_exited',current_lp_value:{available:true,raw:'0'}});
  assert.equal(positionArtwork(n).evolution,'activated');
  assert.equal(positionEvolutionLabel(n),'LP exited');
  assert.equal(n.position.activated,true);
});

test('known current tiers retain their actual variants without fallback',()=>{
  for(const evolution of ['activated','enhanced','singularity']){
    const n=nft({evolution});
    assert.equal(positionArtwork(n).evolution,evolution);
    assert.equal(positionEvolutionLabel(n),evolution);
  }
});

const principal=(changes={})=>({available:true,phase_code:3,phase:'ready',allocated:true,paid:false,
  assets:[{allocated_raw:'100',remaining_raw:'100'},{allocated_raw:'200',remaining_raw:'200'}],...changes});
const exited=r=>({...nft({evolution:'lp_exited'}),...(r===undefined?{}:{principal_return:r})});

test('dormant activation closes only for an explicit authenticated exit flag',()=>{
  const n=nft({activated:false,evolution:'dormant'});
  assert.equal(positionEvolutionLabel({...n,lifecycle:{lp_exit_started:true}}),'Dormant · activation closed');
  for(const lp_exit_started of [false,'true',1,undefined]){
    assert.equal(positionEvolutionLabel({...n,lifecycle:{lp_exit_started}}),'dormant');
  }
  assert.equal(positionEvolutionLabel({...nft(),lifecycle:{lp_exit_started:true}}),'enhanced');
});

test('missing or unavailable principal data preserves a generic terminal label',()=>{
  for(const r of [undefined,null,{available:false}])assert.equal(positionEvolutionLabel(exited(r)),'LP exited');
});

test('closing and partial allocation label allocation pending without pretending payout',()=>{
  for(const [phase_code,phase] of [[1,'closing'],[2,'allocating']]){
    const r=principal({phase_code,phase,allocated:false,assets:[]});
    assert.equal(positionEvolutionLabel(exited(r)),'LP exited · allocation pending');
  }
});

test('paid principal label requires exact ready and paid settlement state',()=>{
  const r=principal({paid:true,assets:[{allocated_raw:'100',remaining_raw:'0'},{allocated_raw:'200',remaining_raw:'0'}]});
  assert.equal(positionEvolutionLabel(exited(r)),'LP exited · principal paid');
  assert.equal(positionArtwork(exited(r)).evolution,'activated');
});

test('allocated pending payout and zero entitlement have distinct truthful labels',()=>{
  assert.equal(positionEvolutionLabel(exited(principal())),'LP exited · payout pending');
  assert.equal(positionEvolutionLabel(exited(principal({phase_code:2,phase:'allocating'}))),'LP exited · distribution not ready');
  const zero=principal({assets:[{allocated_raw:'0',remaining_raw:'0'},{allocated_raw:'0',remaining_raw:'0'}]});
  assert.equal(positionEvolutionLabel(exited(zero)),'LP exited · no principal to return');
  assert.equal(positionEvolutionLabel(exited({...zero,paid:true})),'LP exited · no principal to return');
});

test('malformed or contradictory settlement stays generic instead of inventing paid state',()=>{
  const cases=[principal({paid:'true'}),principal({phase_code:'3'}),principal({phase:'closing'}),
    principal({phase_code:2,phase:'allocating',paid:true}),
    principal({assets:[{allocated_raw:100,remaining_raw:100},{allocated_raw:'200',remaining_raw:'200'}]}),
    principal({assets:[{allocated_raw:'100',remaining_raw:'0'},{allocated_raw:'200',remaining_raw:'200'}]})];
  for(const r of cases)assert.equal(positionEvolutionLabel(exited(r)),'LP exited');
});

test('pending LP target without previous artwork cannot use activated outage fallback',()=>{
  for(const action of ['activate','increase']){
    const incoming={...nft(),token_id:'10'},other={...nft(),token_id:'20'};
    const before=structuredClone(incoming);
    const result=holdPendingArtwork([incoming,other],{context:{action,intent:{id:'10'}}});
    assert.equal(result[0].ui_artwork_pending_unconfirmed,true);
    assert.equal(positionArtwork(result[0]),null);
    assert.equal(positionEvolutionLabel(result[0]),'Awaiting confirmed LP execution');
    assert.equal(result[1],other);
    assert.deepEqual(incoming,before);
    assert.equal(incoming.ui_artwork_pending_unconfirmed,undefined);
  }
});

test('pending LP target keeps a known previous image and leaves other confirmed cards unchanged',()=>{
  const previous={...nft({evolution:'activated'}),token_id:'10'};
  const incoming={...nft({evolution:'singularity'}),token_id:'10'},other={...nft(),token_id:'20'};
  const result=holdPendingArtwork([incoming,other],{context:{action:'increase',intent:{id:'10'}}},[previous]);
  assert.equal(result[0],previous);
  assert.equal(positionArtwork(result[0]).evolution,'activated');
  assert.equal(result[1],other);
  assert.equal(result[1].ui_artwork_pending_unconfirmed,undefined);
});

test('claims and other non-LP pending operations never withhold or mark artwork',()=>{
  const items=[{...nft(),token_id:'10'},{...nft(),token_id:'20'}];
  for(const action of ['claim','approve','mint','transfer']){
    const result=holdPendingArtwork(items,{context:{action,intent:{id:'10'}}});
    assert.equal(result,items);
    assert.equal(result[0].ui_artwork_pending_unconfirmed,undefined);
    assert.equal(positionArtwork(result[0]).evolution,'enhanced');
  }
});
