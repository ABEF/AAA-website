import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './deployment-api.test.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/collection.json',import.meta.url)));
const digest=async ids=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ids.join(','))))].map(n=>n.toString(16).padStart(2,'0')).join('');
function collection(count=33,change=()=>{}){
  const s=setup(),ids=Array.from({length:count},(_,i)=>String(i+1));
  s.api.request=async path=>{
    if(path==='/v1/protocol')return s.f.protocol;
    const offset=Number(path.split('/').at(-1)),selected=ids.slice(offset,offset+16),positions=selected.map(id=>{
      const n=structuredClone(fixture.positions.find(n=>n.position.activated));
      Object.assign(n,{token_id:id,mint_ordinal:Number(id),owner:s.inventory.wallet});
      n.position.royalty_weight=['Commun','Rare','Legendary'].indexOf(n.traits.rarity)+1;
      return n;
    });
    const part={...structuredClone(fixture),count,inventory_token_ids:offset===0?ids:null,inventory_sha256:await digest(ids),offset,positions,next_offset:offset+selected.length<count?offset+selected.length:null,chunk_lp_usd_18:String(BigInt(positions.length)*1432n*10n**18n),chunk_activated:positions.length,provenance:s.inventory.provenance};
    change(part,offset,s);return part;
  };return s;
}
test('actual Python response validates and aggregates current LP exactly',async()=>{
  const s=setup('activate_zzz',s=>{s.m.projection_sha256=fixture.provenance.configuration_sha256;s.f.protocol.provenance.configuration_sha256=s.m.projection_sha256;});s.api.request=async path=>path==='/v1/protocol'?s.f.protocol:structuredClone(fixture);
  const r=await s.api.collectionPositions();assert.equal(r.count,2);assert.equal(r.activated,1);assert.equal(r.lp_usd_18,'1432000000000000000000');
});
test('complete collection sums only after all pages and uses no wallet permissions',async()=>{
  const s=collection(),seen=[];const r=await s.api.collectionPositions({onProgress:(n,total)=>seen.push([n,total])});
  assert.equal(r.count,33);assert.equal(r.positions.length,33);assert.equal(r.lp_usd_18,String(33n*1432n*10n**18n));assert.deepEqual(seen,[[16,33],[32,33],[33,33]]);
});
for(const [label,change] of [
  ['missing chunk',p=>p.next_offset=null],['changed inventory',p=>p.inventory_sha256='0'.repeat(64)],
  ['wrong block',p=>p.provenance={...p.provenance,block_hash:'0x'+'e'.repeat(64)}],['wrong contract',p=>p.nft_contract='0x'+'7'.repeat(40)],
  ['duplicate ordinal',p=>p.positions[1].mint_ordinal=p.positions[0].mint_ordinal],['wrong id',p=>p.positions[0].token_id='9999'],
  ['invalid owner',p=>p.positions[0].owner='<script>'],['invalid trait',p=>p.positions[0].traits.palette=58],
  ['wrong weight',p=>p.positions[0].position.royalty_weight=0],['wrong stage',p=>p.positions[0].position.evolution='singularity'],
  ['invented total',p=>p.chunk_lp_usd_18='0'],['fake active count',p=>p.chunk_activated=0],
])test(label+' rejects entire collection',async()=>{let touched=false;const s=collection(33,(p,n)=>{if(n===16){touched=true;change(p);}});await assert.rejects(s.api.collectionPositions());assert.equal(touched,true);});
test('unavailable LP leaves exact eligibility and positions available',async()=>{
  const s=collection(33,(p,n)=>{if(n===16){p.positions[0].position.current_lp_value={...p.positions[0].position.current_lp_value,available:false,raw:null};p.positions[0].position.evolution_value_available=false;p.positions[0].position.evolution='activated';p.chunk_lp_usd_18=null;}});
  const r=await s.api.collectionPositions();assert.equal(r.lp_usd_18,null);assert.equal(r.activated,33);assert.equal(r.positions.length,33);
});
test('empty collection is verified zero and malformed inventory rejected',async()=>{
  assert.equal((await collection(0).api.collectionPositions()).lp_usd_18,'0');
  const s=collection(33,p=>{if(p.inventory_token_ids)p.inventory_token_ids[1]='1';});await assert.rejects(s.api.collectionPositions());
});
test('abort and unavailable middle page never publish a partial collection',async()=>{
  const controller=new AbortController(),s=collection(33,(_,n)=>{if(n===16)controller.abort();});await assert.rejects(s.api.collectionPositions({signal:controller.signal}));
  await assert.rejects(collection(33,(_,n)=>{if(n===16)throw Error('503');}).api.collectionPositions());
});
test('1000 NFTs are bounded to 63 read requests, not a load qualification',async()=>{
  let calls=0;const s=collection(1000,()=>calls++);const r=await s.api.collectionPositions();assert.equal(calls,63);assert.equal(r.positions.length,1000);
});
