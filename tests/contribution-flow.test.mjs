import test from 'node:test';
import assert from 'node:assert/strict';
import {operationScope,refreshLabels,sameContribution} from '../local-view.js';
import {findArtwork,evolutionArtworks} from '../artworks.js';
import {FUNDING_ASSETS} from '../domain.js';
const context={stale:true,busy:true,session:'session',account:'owner'};
test('one confirmed contribution refresh marks only its NFT LP and artwork',()=>{
  const scope=operationScope({action:'increase',targetId:'2'},'session','owner');
  assert.deepEqual(refreshLabels('2',scope,context),{lp:'Updating…',rewards:null,history:null,artwork:true});
  assert.deepEqual(refreshLabels('3',scope,context),{lp:null,rewards:null,history:null,artwork:false});
  assert.equal(refreshLabels('2',scope,{...context,stale:false}).artwork,false);
});
test('claims touch reward balances only and never redraw evolution',()=>{
  const scope=operationScope({action:'claim',claims:[{token_id:'1'},{token_id:'2'},{token_id:'1'}]},'session','owner');
  assert.deepEqual(scope.ids,['1','2']);
  for(const id of scope.ids)assert.deepEqual(refreshLabels(id,scope,context),{lp:null,rewards:'Refreshing balance…',history:null,artwork:false});
  assert.equal(refreshLabels('3',scope,context).rewards,null);
});
test('approvals and wrapping do not imply deployed LP or change artwork',()=>{
  for(const action of ['approve','wrap'])assert.deepEqual(refreshLabels('1',operationScope({action,targetId:'1'},'session','owner'),context),{lp:null,rewards:null,history:null,artwork:false});
});
test('failed reads and different sessions do not retain spendable balances',()=>{
  const scope=operationScope({action:'increase',targetId:'1'},'session','owner');
  for(const changes of [{busy:false},{session:'new'},{account:'new'}]){
    const labels=refreshLabels('2',scope,{...context,...changes});
    assert.ok(labels.lp);assert.ok(labels.rewards);assert.equal(labels.artwork,false);
  }
});
test('approval acknowledgement includes input identity',()=>{
  const a={session:'s',account:'a',id:'1',amount:'100',asset:'USDC'};
  assert.equal(sameContribution(a,{...a}),true);
  assert.equal(sameContribution(a,{...a,asset:'USDG'}),false);
});
test('four preloaded evolutions retain fixed identity and never mutate the selected art',()=>{
  const art=findArtwork('cyan-arcs-commun-dormant');
  assert.ok(art);
  const before=JSON.stringify(art),variants=evolutionArtworks(art);
  assert.equal(variants.length,4);assert.equal(new Set(variants.map(a=>a.src)).size,4);
  for(const a of variants){assert.equal(a.paletteId,art.paletteId);assert.equal(a.pattern,art.pattern);assert.equal(a.rarity,art.rarity);}
  assert.equal(JSON.stringify(art),before);assert.deepEqual(evolutionArtworks({...art}),[]);
});
test('public selector keeps the four agreed choices with ETH representing native input',()=>{
  assert.deepEqual([...FUNDING_ASSETS].sort(),['ETH','USDC','USDG','ZZZ']);
});
