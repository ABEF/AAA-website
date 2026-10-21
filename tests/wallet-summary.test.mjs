import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './deployment-api.test.mjs';
function summaryFixture(count=33,change=()=>{}){
  const s=setup();s.inventory.token_ids=Array.from({length:count},(_,n)=>String(n+1));s.inventory.count=count;
  s.api.request=async(path)=>{
    const offset=Number(path.split('/').at(-1)),ids=s.inventory.token_ids.slice(offset,offset+16);
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s.inventory.token_ids.join(','))))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const p={schema:1,chain_id:31337,wallet:s.inventory.wallet,nft_contract:s.m.contracts.nft.address,inventory_sha256:digest,count,
      offset,chunk_size:16,token_ids:ids,next_offset:offset+ids.length<count?offset+ids.length:null,
      lp_usd_18:String(ids.length*100),claimable_eth_wei:String(ids.length*7),provenance:s.inventory.provenance};
    change(p,offset,s);return p;
  };return s;
}
test('all holdings totals cross card and summary page boundaries',async()=>{const s=summaryFixture();const r=await s.api.walletTotals(s.inventory);assert.equal(r.lp_usd_18,'3300');assert.equal(r.claimable_eth_wei,'231');assert.equal(r.count,33);});
test('empty wallet verifies zero',async()=>{const s=summaryFixture(0);const r=await s.api.walletTotals(s.inventory);assert.equal(r.lp_usd_18,'0');assert.equal(r.claimable_eth_wei,'0');});
test('unavailable LP in any chunk poisons only LP total',async()=>{const s=summaryFixture(33,(p,n)=>{if(n===16)p.lp_usd_18=null});const r=await s.api.walletTotals(s.inventory);assert.equal(r.lp_usd_18,null);assert.equal(r.claimable_eth_wei,'231');});
test('unavailable ETH is never a partial total',async()=>{const s=summaryFixture(33,(p,n)=>{if(n===16)p.claimable_eth_wei=null});const r=await s.api.walletTotals(s.inventory);assert.equal(r.claimable_eth_wei,null);assert.equal(r.lp_usd_18,'3300');});
for(const [label,change] of [
  ['different owner',p=>p.wallet='0x'+'7'.repeat(40)],['changed inventory',p=>p.inventory_sha256='0'.repeat(64)],
  ['repeated chunk',p=>p.offset=0],['skipped chunk',p=>p.next_offset=null],['wrong NFT',p=>p.token_ids=['999']],
  ['different snapshot',p=>p.provenance={...p.provenance,block_hash:'0x'+'9'.repeat(64)}],
])test(label+' rejects whole total',async()=>{const s=summaryFixture(33,(p,n)=>{if(n===16)change(p)});await assert.rejects(s.api.walletTotals(s.inventory));});
test('cancel between chunks discards total',async()=>{const controller=new AbortController();const s=summaryFixture(33,(p,n)=>{if(n===16)controller.abort()});await assert.rejects(s.api.walletTotals(s.inventory,{signal:controller.signal}));});
test('duplicate inventory rejected',async()=>{const s=summaryFixture(33);s.inventory.token_ids[1]='1';await assert.rejects(s.api.walletTotals(s.inventory));});
test('complete 1000-item collection remains bounded to 63 requests',async()=>{let count=0;const s=summaryFixture(1000,()=>count++);const r=await s.api.walletTotals(s.inventory);assert.equal(count,63);assert.equal(r.lp_usd_18,'100000');});
