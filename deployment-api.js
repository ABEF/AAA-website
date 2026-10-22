// Production API integration for reads and unsigned preparation only.
// This module has no wallet submission, signer, private key or broadcast path.
import {createChainReader} from './browser-wallet.js';
export const ZERO='0x'+'0'.repeat(40), ZERO_HASH='0x'+'0'.repeat(64);
const ADDRESS=/^0x[0-9a-f]{40}$/, HASH=/^0x[0-9a-f]{64}$/, DIGEST=/^[0-9a-f]{64}$/;
const fail=message=>{throw new Error(message||'Deployment response failed validation. Nothing was submitted.');};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const hex=x=>'0x'+x.toString(16),word=x=>x.toString(16).padStart(64,'0'),addr=x=>x.slice(2).padStart(64,'0');
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(object(x)||Array.isArray(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export function raw(x){if(typeof x!=='string'||!/^(0|[1-9][0-9]{0,77})$/.test(x)||BigInt(x)>=2n**256n)fail('Invalid exact token amount');return BigInt(x);}
const quantity=x=>{if(typeof x!=='string'||!/^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/.test(x))fail('Invalid node quantity');return BigInt(x);};
const code=x=>typeof x==='string'&&/^0x(?:[0-9a-f]{2})+$/.test(x)&&x.length<=100002;
export function parseAmount(text,decimals){
  if(!integer(decimals,0,18)||typeof text!=='string'||text.length>80||! /^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text))fail('Enter a token amount without commas or exponents.');
  const [whole,part='']=text.split('.');if(part.length>decimals)fail('Too many decimal places for this asset.');
  const value=raw(whole)*10n**BigInt(decimals)+BigInt((part.padEnd(decimals,'0'))||'0');
  if(value<=0n||value>=2n**128n)fail('Token amount is outside the supported bounds.');return value;
}
export function exactUnits(value,decimals){if(!integer(decimals,0,36))fail('Invalid token decimals');const n=raw(value),base=10n**BigInt(decimals),part=(n%base).toString().padStart(decimals,'0').replace(/0+$/,'');return (n/base).toString()+(part?'.'+part:'');}
function endpoint(value,rehearsal){
  let url;try{url=new URL(value);}catch{fail('Invalid reviewed RPC URL');}
  if(url.username||url.password||url.hash||url.search||
    (url.protocol!=='https:'&&!(rehearsal&&url.protocol==='http:'&&url.hostname==='127.0.0.1')))fail('Use a reviewed public HTTPS RPC without credentials.');
  return url.href;
}
export function validateDeployment(value,origin=globalThis.location?.origin){
  const m=clone(value);
  if(!object(m)||m.schema!==1||m.mode!=='read-and-prepare'||!['production','rehearsal'].includes(m.environment)||!DIGEST.test(m.id)||
    !integer(m.chain_id,1,Number.MAX_SAFE_INTEGER)||!HASH.test(m.genesis_hash)||!integer(m.deployment_block,0,Number.MAX_SAFE_INTEGER)||
    !HASH.test(m.deployment_block_hash)||!integer(m.confirmations,1,128)||!integer(m.max_age_seconds,1,120)||
    !/^[A-Za-z0-9 ._-]{1,50}$/.test(m.chain_name)||!/^\/[a-z0-9][a-z0-9/_-]{0,80}$/.test(m.api_prefix)||m.api_prefix.includes('//')||m.api_prefix.endsWith('/'))fail('Invalid reviewed deployment configuration');
  if(Object.keys(m).some(k=>!['schema','mode','environment','id','chain_id','genesis_hash','deployment_block','deployment_block_hash','confirmations','max_age_seconds','chain_name','api_prefix','rpc_url','projection_sha256','transaction_sha256','activation_sha256','transaction_fee_review','activation_fee_review','contracts','pool_id','input_assets','reward_assets','limits'].includes(k)))fail('Unexpected deployment setting');
  const page=new URL(origin),rehearsal=m.environment==='rehearsal';
  if(rehearsal?(page.protocol!=='http:'||page.hostname!=='127.0.0.1'):(page.protocol!=='https:'||m.chain_id===31337))fail('Deployment profile is not permitted on this origin');
  m.rpc_url=endpoint(m.rpc_url,rehearsal);
  for(const name of ['projection_sha256','transaction_sha256','activation_sha256'])if(!DIGEST.test(m[name]))fail('Missing reviewed API configuration identity');
  for(const name of ['transaction_fee_review','activation_fee_review'])if(!HASH.test(m[name]))fail('Missing reviewed fee policy');
  if(!object(m.contracts))fail();const targets=new Set();
  for(const role of ['access','nft','vault','entry','claim_router','oracle']){
    const c=m.contracts[role];if(!ADDRESS.test(c?.address)||c.address===ZERO||targets.has(c.address)||!code(c.runtime_code))fail('Invalid reviewed contract identity');targets.add(c.address);
  }
  if(!Array.isArray(m.input_assets)||!m.input_assets.length||m.input_assets.length>4||!HASH.test(m.pool_id)||m.pool_id===ZERO_HASH)fail('Invalid contribution inventory');
  const symbols=new Set(),assets=new Set();
  for(const a of m.input_assets){
    if(!['ETH','ZZZ','USDC','USDG'].includes(a.symbol)||symbols.has(a.symbol)||!ADDRESS.test(a.address)||assets.has(a.address)||targets.has(a.address)||
      !integer(a.decimals,0,18)||!ADDRESS.test(a.valuation_asset)||a.valuation_asset===ZERO||!HASH.test(a.route_id)||typeof a.enabled!=='boolean'||
      ((a.symbol==='ETH')!==(a.address===ZERO))||(a.address!==ZERO&&!code(a.runtime_code))||
      (a.address!==ZERO&&a.valuation_asset!==a.address)||(a.address===ZERO&&(a.decimals!==18||a.route_id!==ZERO_HASH)))fail('Invalid activation asset or route');
    symbols.add(a.symbol);assets.add(a.address);
  }
  if(!Array.isArray(m.reward_assets)||!m.reward_assets.length||m.reward_assets.length>32)fail('Invalid reward inventory');
  const rewards=new Set();for(const a of m.reward_assets){if(!ADDRESS.test(a.address)||rewards.has(a.address)||!integer(a.decimals,0,36)||! /^(ETH|WETH|ZZZ|USDG|USDC)$/.test(a.symbol)||(a.address===ZERO&&(a.symbol!=='ETH'||a.decimals!==18)))fail('Invalid reward currency');rewards.add(a.address);}
  if(!object(m.limits)||!integer(m.limits.gas,21000,12000000))fail('Invalid gas limit');
  for(const name of ['gas_price_wei','network_fee_wei','native_value_wei','contribution_usd_18'])if(raw(m.limits[name])===0n)fail('Missing bounded spending policy');
  return freeze(m);
}
export async function jsonRequest(fetcher,url,body,{signal,timeout=30000,maxBytes=2097152}={}){
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeout);let reader;
  try{
    const r=await fetcher(url,{method:body===undefined?'GET':'POST',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),signal:controller.signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
    if(r.redirected)fail('API redirects are not allowed');
    const length=r.headers.get('content-length');if(length!==null&&(!/^[0-9]+$/.test(length)||Number(length)>maxBytes))fail('API response is too large');
    reader=r.body?.getReader();if(!reader)fail('API response cannot be read safely');
    const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)fail('API response is too large');chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('API returned invalid JSON');}
    if(!r.ok){const error=new Error(r.status===429||r.status===503?'Service temporarily unavailable. Retry the read or review; no transaction was submitted.':'The API could not prepare this request. Refresh confirmed state.');error.status=r.status;throw error;}
    if(!object(data))fail('Invalid API response');return data;
  }finally{clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',abort);if(reader)void reader.cancel().catch(()=>{});}
}

export class DeploymentAPI {
  constructor(manifest,{origin=globalThis.location?.origin,fetcher=globalThis.fetch,reader,clock=()=>Date.now()}={}){
    this.manifest=validateDeployment(manifest,origin);this.origin=origin;this.fetcher=fetcher;this.clock=clock;
    this.reader=reader||createChainReader(this.manifest.rpc_url,{fetcher});this.revision=0;this.active=null;
  }
  request(path,body,signal){if(!/^\/v1\/[a-z0-9/_-]+$/.test(path))fail('Unsupported API path');return jsonRequest(this.fetcher,this.origin+this.manifest.api_prefix+path,body,{signal});}
  cancel(){this.revision++;this.active?.abort();this.active=null;}
  async identity(){
    const m=this.manifest,[chain,genesis,anchor]=await Promise.all([
      this.reader.request({method:'eth_chainId'}),this.reader.request({method:'eth_getBlockByNumber',params:['0x0',false]}),
      this.reader.request({method:'eth_getBlockByNumber',params:[hex(BigInt(m.deployment_block)),false]})]);
    if(quantity(chain)!==BigInt(m.chain_id)||genesis?.hash!==m.genesis_hash||anchor?.hash!==m.deployment_block_hash)fail('RPC does not match the reviewed deployment');
  }
  async provenance(p,{activation=false,transaction=false}={}){
    const m=this.manifest;
    if(!object(p)||(p.configuration_sha256??p.deployment_configuration_sha256)!==m.projection_sha256||
      !integer(p.block_number,m.deployment_block,Number.MAX_SAFE_INTEGER)||!HASH.test(p.block_hash)||
      !integer(p.block_timestamp,1,Number.MAX_SAFE_INTEGER)||!integer(p.observed_head,p.block_number,Number.MAX_SAFE_INTEGER)||
      p.observed_head-p.block_number+1<m.confirmations||
      (p.confirmations!==undefined&&!integer(p.confirmations,m.confirmations,128))||
      (p.deployment_block!==undefined&&p.deployment_block!==m.deployment_block)||
      (p.deployment_block_hash!==undefined&&p.deployment_block_hash!==m.deployment_block_hash)||
      (transaction&&p.transaction_configuration_sha256!==m.transaction_sha256)||
      (activation&&p.activation_configuration_sha256!==m.activation_sha256))fail('API data differs from the reviewed deployment or confirmation policy');
    const now=Math.floor(this.clock()/1000);if(p.block_timestamp>now+30||now-p.block_timestamp>m.max_age_seconds)fail('Confirmed data is stale. Refresh before reviewing.');
    const [block,head]=await Promise.all([this.reader.request({method:'eth_getBlockByNumber',params:[hex(BigInt(p.block_number)),false]}),this.reader.request({method:'eth_blockNumber'})]);
    if(block?.hash!==p.block_hash||quantity(block.number)!==BigInt(p.block_number)||quantity(block.timestamp)!==BigInt(p.block_timestamp)||quantity(head)<BigInt(p.block_number+m.confirmations-1))fail('API snapshot is not confirmed on the reviewed RPC');
    return {blockHash:p.block_hash,requireCanonical:true};
  }
  async snapshot(result,options){
    if(result.schema!==2||result.chain_id!==this.manifest.chain_id)fail('Invalid API deployment identity');
    await this.provenance(result.provenance,options);return result;
  }
  async protocol(signal){
    await this.identity();const p=await this.snapshot(await this.request('/v1/protocol',undefined,signal));
    for(const role of ['access','nft','vault','claim_router'])if(p.contracts?.[role]!==this.manifest.contracts[role].address)fail('Protocol contract binding changed');
    if(!object(p.lifecycle)||typeof p.lifecycle.new_economic_work_available_by_lifecycle!=='boolean'||typeof p.minting?.available_by_controls!=='boolean')fail('Missing canonical lifecycle');
    return p;
  }
  async readiness(signal){const r=await this.snapshot(await this.request('/v1/mint-readiness',undefined,signal));if(r.nft!==this.manifest.contracts.nft.address||!integer(r.minted,0,1000)||typeof r.new_minting_stopped!=='boolean')fail('Invalid mint readiness');return r;}
  validateNFT(n,id,owner){
    if(n.token_id!==id||n.owner!==owner||!integer(n.mint_ordinal,1,1000)||typeof n.traits_ready!=='boolean'||
      typeof n.position?.activated!=='boolean'||n.position.principal_redeemable!==false||!object(n.claimable)||
      typeof n.position.current_lp_value?.available!=='boolean'||n.position.current_lp_value.decimals!==18||n.position.current_lp_value.unit!=='USD')fail('NFT ownership or position changed; refresh your holdings');
    if(n.traits_ready&&(!['Commun','Rare','Legendary'].includes(n.traits?.rarity)||!integer(n.traits.palette,0,57)||!integer(n.traits.pattern,0,3)))fail('Invalid revealed NFT traits');
    if(n.position.current_lp_value.available)raw(n.position.current_lp_value.raw);else if(n.position.current_lp_value.raw!==null)fail('Unavailable LP must not contain an amount');
    if(n.position.evolution_value_available!==n.position.current_lp_value.available||!['dormant','activated','enhanced','singularity'].includes(n.position.evolution))fail('Invalid NFT evolution');
    for(const role of ['access','nft','vault','claim_router'])if(n.contracts?.[role]!==this.manifest.contracts[role].address)fail('NFT deployment binding differs');
    for(const scope of ['lp','royalties']){
      const rows=n.claimable[scope];if(!Array.isArray(rows)||rows.length>32)fail('Invalid reward balances');const seen=new Set();
      for(const row of rows){const a=this.manifest.reward_assets.find(a=>a.address===row.asset);
        if(!a||seen.has(row.asset)||a.symbol!==row.symbol||a.decimals!==row.decimals)fail('Unreviewed reward currency');seen.add(row.asset);
        if(row.raw===null){if(row.available!==false)fail('Invalid unavailable balance');}else {if(row.available===false)fail('Unavailable balance contains an amount');raw(row.raw);}
      }
    }
    return n;
  }
  async nft(id,owner,signal){if(raw(id)===0n||!ADDRESS.test(owner)||owner===ZERO)fail('Invalid NFT request');const n=await this.snapshot(await this.request('/v1/nfts/'+id,undefined,signal));return this.validateNFT(n,id,owner);}
  async portfolio(owner,page=0){
    if(!ADDRESS.test(owner)||owner===ZERO||!integer(page,0,124))fail('Invalid wallet request');this.cancel();const revision=this.revision,controller=new AbortController();this.active=controller;
    try{
      const protocol=await this.protocol(controller.signal),inventory=await this.snapshot(await this.request('/v1/wallets/'+owner+'/nfts',undefined,controller.signal));
      if(inventory.available!==true||inventory.wallet!==owner||inventory.nft_contract!==this.manifest.contracts.nft.address||
        !Array.isArray(inventory.token_ids)||inventory.token_ids.length>1000||inventory.count!==inventory.token_ids.length||new Set(inventory.token_ids).size!==inventory.count)fail('Invalid complete wallet inventory');
      inventory.token_ids.forEach(id=>{if(raw(id)===0n)fail();});
      const ids=inventory.token_ids.slice(page*8,page*8+8),nfts=[];
      // Two in-flight cards, eight per page. Never request 1,000 projections at once.
      for(let i=0;i<ids.length;i+=2)nfts.push(...await Promise.all(ids.slice(i,i+2).map(async id=>{
        const n=await this.nft(id,owner,controller.signal);
        try{const earned=await this.request('/v1/nfts/'+id+'/earnings',undefined,controller.signal);
          if(earned.schema!==1||earned.chain_id!==this.manifest.chain_id||earned.scope!=='nft'||earned.token_id!==id||earned.owner!==owner||earned.provenance?.block_hash!==n.provenance.block_hash)fail('Earnings snapshot differs');
          await this.provenance(earned.provenance);n.earnings=earned;
        }catch{n.earnings={available:false,reason:'Complete earnings at this position snapshot are unavailable.'};}
        return n;
      })));
      if(revision!==this.revision||controller.signal.aborted)fail('Wallet or page changed; older results were discarded');
      await this.identity();if(revision!==this.revision||controller.signal.aborted)fail('Wallet or page changed; older results were discarded');return {protocol,inventory,nfts,page};
    }finally{if(this.active===controller)this.active=null;}
  }
  async walletTotals(inventory,{signal}={}){
    const owner=inventory.wallet,ids=inventory.token_ids,anchor=inventory.provenance;
    if(inventory.available!==true||!ADDRESS.test(owner)||!Array.isArray(ids)||ids.length>1000||inventory.count!==ids.length||new Set(ids).size!==ids.length)fail('Invalid complete wallet inventory');
    if(ids.some((id,i)=>raw(id)===0n||(i&&raw(ids[i-1])>=raw(id))))fail('Wallet inventory must be ordered and unique');
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ids.join(','))))].map(n=>n.toString(16).padStart(2,'0')).join('');
    let offset=0,lp=0n,eth=0n,lpAvailable=true,ethAvailable=true;
    do{
      if(signal?.aborted)fail('Wallet totals were cancelled');
      const part=await this.request(`/v1/wallets/${owner}/summary/${anchor.block_number}/${offset}`,undefined,signal);
      await this.provenance(part.provenance);
      const expected=ids.slice(offset,offset+16),next=offset+expected.length<ids.length?offset+expected.length:null;
      if(part.schema!==1||part.chain_id!==this.manifest.chain_id||part.wallet!==owner||part.nft_contract!==this.manifest.contracts.nft.address||
        part.inventory_sha256!==digest||part.count!==ids.length||part.chunk_size!==16||part.offset!==offset||part.next_offset!==next||
        JSON.stringify(part.token_ids)!==JSON.stringify(expected)||part.provenance.block_hash!==anchor.block_hash||part.provenance.block_number!==anchor.block_number)fail('Wallet summary differs from its complete confirmed inventory');
      if(part.lp_usd_18===null)lpAvailable=false;else lp+=raw(part.lp_usd_18);
      if(part.claimable_eth_wei===null)ethAvailable=false;else eth+=raw(part.claimable_eth_wei);
      offset=next;
    }while(offset!==null);
    await this.provenance(anchor);if(signal?.aborted)fail('Wallet totals were cancelled');
    return {available:true,count:ids.length,wallet:owner,lp_usd_18:lpAvailable?lp.toString():null,claimable_eth_wei:ethAvailable?eth.toString():null,provenance:anchor};
  }

  validateEarnings(report,scope){
    if(report.schema!==1||report.chain_id!==this.manifest.chain_id||report.available!==true||report.scope!==scope||
      report.claims_and_conversions_are_income!==false||report.unprocessed_revenue_included!==false||
      report.clock!=='on-chain processing/allocation time'||
      report.window?.through_timestamp_inclusive!==report.provenance?.block_timestamp||
      report.window?.after_timestamp_exclusive!==Math.max(-1,report.provenance.block_timestamp-86400))fail('Invalid earnings accounting scope');
    const fields=scope==='collection'?['lp_processed','lp_owner_allocated','lp_collective_allocated','lp_compounding_allocated','lp_buyback_allocated','lp_collective_quarantined','royalties_received','royalties_allocated','royalties_quarantined']:['lp_individual','lp_collective','royalties'];
    for(const period of ['all_time','last_24h']){
      const rows=report[period],seen=new Set(),totals=Object.fromEntries(fields.map(k=>[k,0n]));
      if(!Array.isArray(rows)||rows.length!==this.manifest.reward_assets.length)fail('Incomplete earnings currencies');
      for(const row of rows){
        const asset=this.manifest.reward_assets.find(a=>a.address===row.asset),price=row.current_price;
        if(!asset||seen.has(row.asset)||row.decimals!==asset.decimals||row.symbol!==asset.symbol||typeof price?.available!=='boolean'||!object(row.usd_at_current_price_18))fail('Invalid earnings currency');seen.add(row.asset);
        const mark=price.available?raw(price.usd_per_token_18):null;
        if(mark===0n||mark!==null&&mark>10n**36n||mark===null&&price.usd_per_token_18!==null)fail('Invalid earnings price');
        for(const field of fields){
          const amount=raw(row[field+'_raw']);
          const value=mark===null?(amount===0n?0n:null):amount*mark/10n**BigInt(asset.decimals);
          if(row.usd_at_current_price_18[field]!== (value===null?null:value.toString()))fail('Earnings value differs from original earned currency');
          totals[field]=totals[field]===null||value===null?null:totals[field]+value;
        }
      }
      for(const field of fields)if(report[period+'_usd_at_current_price_18']?.[field]!== (totals[field]===null?null:totals[field].toString()))fail('Incomplete earnings total');
    }
    for(const row of report.last_24h){const all=report.all_time.find(a=>a.asset===row.asset);
      if(JSON.stringify(row.current_price)!==JSON.stringify(all.current_price)||fields.some(k=>raw(row[k+'_raw'])>raw(all[k+'_raw'])))fail('Earnings periods or prices differ');}
    return report;
  }
  async collectionPositions({signal,onProgress}={}){
    const protocol=await this.protocol(signal),anchor=protocol.provenance;
    let offset=0,inventory=null,digest=null,count=null,positions=[],ordinals=new Set(),lp=0n,available=true,activated=0;
    do{
      if(signal?.aborted)fail('Collection read cancelled');
      const part=await this.request(`/v1/collection/${anchor.block_number}/${offset}`,undefined,signal);
      await this.provenance(part.provenance);
      if(part.schema!==1||part.chain_id!==this.manifest.chain_id||part.available!==true||part.nft_contract!==this.manifest.contracts.nft.address||!integer(part.count,0,1000)||part.offset!==offset||part.chunk_size!==16||!Array.isArray(part.positions)||part.provenance.block_hash!==anchor.block_hash||part.provenance.block_number!==anchor.block_number||part.provenance.block_timestamp!==anchor.block_timestamp)fail('Collection snapshot differs');
      if(offset===0){
        inventory=part.inventory_token_ids;count=part.count;
        if(!Array.isArray(inventory)||inventory.length!==count||new Set(inventory).size!==count||inventory.some((id,i)=>raw(id)===0n||i&&raw(inventory[i-1])>=raw(id)))fail('Invalid complete collection inventory');
        digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(inventory.join(','))))].map(n=>n.toString(16).padStart(2,'0')).join('');
      }else if(part.inventory_token_ids!==null)fail('Unexpected repeated collection inventory');
      const expected=inventory.slice(offset,offset+16),next=offset+expected.length<count?offset+expected.length:null;
      if(part.count!==count||part.inventory_sha256!==digest||part.next_offset!==next||part.positions.length!==expected.length)fail('Incomplete collection page');
      let chunkLP=0n,chunkAvailable=true,chunkActive=0;
      for(const [index,n] of part.positions.entries()){
        const v=n.position?.current_lp_value,w=n.position?.royalty_weight,active=n.position?.activated;
        if(n.token_id!==expected[index]||!integer(n.mint_ordinal,1,count)||ordinals.has(n.mint_ordinal)||!ADDRESS.test(n.owner)||n.owner===ZERO||typeof n.traits_ready!=='boolean'||typeof active!=='boolean'||!integer(w,0,3)||(w>0)!==active||!['active','parked','remote','outbound','inbound','dormant'].includes(n.position.status)||(n.position.status==='dormant')!==!active||n.position.principal_redeemable!==false)fail('Invalid collection identity or eligibility');
        ordinals.add(n.mint_ordinal);
        if(n.traits_ready){if(!['Commun','Rare','Legendary'].includes(n.traits?.rarity)||!integer(n.traits.palette,0,57)||!integer(n.traits.pattern,0,3)||active&&w!==['Commun','Rare','Legendary'].indexOf(n.traits.rarity)+1)fail('Invalid collection traits');}
        else if(n.traits!==null||active)fail('Unrevealed NFT cannot be activated');
        if(typeof v?.available!=='boolean'||v.decimals!==18||v.unit!=='USD'||v.source!=='NFT.currentLPValue'||n.position.evolution_value_available!==v.available)fail('Invalid collection valuation');
        const amount=v.available?raw(v.raw):null;
        if(!v.available&&v.raw!==null||!active&&(amount!==0n)||v.available&&!['active','dormant'].includes(n.position.status))fail('Collection value contradicts custody');
        const stage=!active?'dormant':amount!==null&&amount>=10000n*10n**18n?'singularity':amount!==null&&amount>=1000n*10n**18n?'enhanced':'activated';
        if(n.position.evolution!==stage)fail('Collection evolution differs from confirmed LP');
        if(amount===null)chunkAvailable=false;else chunkLP+=amount;
        if(active)chunkActive++;
      }
      if(part.chunk_lp_usd_18!==(chunkAvailable?chunkLP.toString():null)||part.chunk_activated!==chunkActive)fail('Collection chunk total differs from positions');
      positions.push(...part.positions);lp+=chunkLP;available=available&&chunkAvailable;activated+=chunkActive;
      if(onProgress)onProgress(positions.length,count);
      offset=next;
    }while(offset!==null);
    await this.provenance(anchor);if(signal?.aborted)fail('Collection read cancelled');
    return {available:true,positions,count,activated,dormant:count-activated,lp_usd_18:available?lp.toString():null,provenance:anchor,inventory_sha256:digest};
  }
  async collectionEarnings({signal}={}){
    await this.identity();const result=this.validateEarnings(await this.request('/v1/earnings',undefined,signal),'collection');
    await this.provenance(result.provenance);if(signal?.aborted)fail('Collection read cancelled');return result;
  }
  async walletEarnings(inventory,{signal}={}){
    const {wallet:owner,token_ids:ids,provenance:anchor}=inventory;
    if(inventory.available!==true||!ADDRESS.test(owner)||owner===ZERO||inventory.nft_contract!==this.manifest.contracts.nft.address||!Array.isArray(ids)||ids.length>1000||inventory.count!==ids.length||new Set(ids).size!==ids.length)fail('Invalid earnings inventory');
    if(ids.some((id,i)=>raw(id)===0n||(i&&raw(ids[i-1])>=raw(id))))fail('Invalid ordered earnings inventory');
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ids.join(','))))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const fields=['lp_individual','lp_collective','royalties'];let offset=0,result=null;
    do{
      if(signal?.aborted)fail('Earnings read cancelled');
      const part=this.validateEarnings(await this.request(`/v1/wallets/${owner}/earnings/${anchor.block_number}/${offset}`,undefined,signal),'wallet_chunk');
      await this.provenance(part.provenance);
      const expected=ids.slice(offset,offset+16),next=offset+expected.length<ids.length?offset+expected.length:null;
      if(part.wallet!==owner||part.nft_contract!==this.manifest.contracts.nft.address||part.inventory_sha256!==digest||part.count!==ids.length||part.chunk_size!==16||part.offset!==offset||part.next_offset!==next||JSON.stringify(part.token_ids)!==JSON.stringify(expected)||part.provenance.block_hash!==anchor.block_hash||part.provenance.block_number!==anchor.block_number||part.provenance.block_timestamp!==anchor.block_timestamp)fail('Earnings differ from complete confirmed holdings');
      if(!ids.length&&['all_time','last_24h'].some(period=>part[period].some(row=>fields.some(k=>raw(row[k+'_raw'])!==0n))))fail('Empty holdings cannot have earnings');
      if(!result)result=clone(part);
      else for(const period of ['all_time','last_24h'])for(const row of result[period]){
        const add=part[period].find(a=>a.asset===row.asset);
        if(JSON.stringify(row.current_price)!==JSON.stringify(add.current_price))fail('Earnings price changed between chunks');
        for(const field of fields)row[field+'_raw']=(raw(row[field+'_raw'])+raw(add[field+'_raw'])).toString();
      }
      offset=next;
    }while(offset!==null);
    // Sum exact earned raw amounts before USD rounding, never 63 rounded displays.
    for(const period of ['all_time','last_24h']){
      const values=Object.fromEntries(fields.map(k=>[k,0n]));
      for(const row of result[period])for(const field of fields){
        const amount=raw(row[field+'_raw']),price=row.current_price;
        const value=price.available?amount*raw(price.usd_per_token_18)/10n**BigInt(row.decimals):amount===0n?0n:null;
        row.usd_at_current_price_18[field]=value===null?null:value.toString();
        values[field]=values[field]===null||value===null?null:values[field]+value;
      }
      result[period+'_usd_at_current_price_18']=Object.fromEntries(fields.map(k=>[k,values[k]===null?null:values[k].toString()]));
    }
    await this.provenance(anchor);if(signal?.aborted)fail('Earnings read cancelled');
    delete result.offset;delete result.next_offset;delete result.chunk_size;
    return {...result,scope:'wallet',token_ids:[...ids],inventory_sha256:digest};
  }
  asset(symbol){const a=this.manifest.input_assets.find(a=>a.symbol===symbol&&a.enabled);if(!a)fail('This contribution asset is not enabled');return a;}
  async price(asset,p){
    const block=await this.provenance(p),oracle=this.manifest.contracts.oracle;
    const runtime=await this.reader.request({method:'eth_getCode',params:[oracle.address,block]});if(runtime!==oracle.runtime_code)fail('Oracle code differs from the reviewed deployment');
    const answer=await this.reader.request({method:'eth_call',params:[{to:oracle.address,data:'0xaea91078'+addr(asset.valuation_asset)},block]});
    if(typeof answer!=='string'||!/^0x[0-9a-f]{64}$/.test(answer))fail('Oracle price is unavailable');const value=BigInt(answer);
    if(value<=0n||value>10n**36n)fail('Oracle price is outside the supported range');return value;
  }
  async activationAmount(symbol){
    const a=this.asset(symbol),protocol=await this.protocol(),price=await this.price(a,protocol.provenance);
    const amount=(100n*10n**18n*10n**BigInt(a.decimals)+price-1n)/price;
    if(amount===0n||amount>=2n**128n)fail('Activation amount is outside supported bounds');
    return {asset:symbol,amount:exactUnits(amount.toString(),a.decimals),raw:amount.toString(),value_usd_18:(amount*price/10n**BigInt(a.decimals)).toString(),provenance:protocol.provenance};
  }
  async prepare(intent){
    const m=this.manifest,owner=intent?.account;
    if(!ADDRESS.test(owner)||owner===ZERO||!['mint','activate','increase','claim'].includes(intent.action))fail('Invalid selected action');
    if(intent.action==='mint'&&m.environment!=='rehearsal')fail('Production minting is planned on OpenSea. This website mint page is a demonstration.');
    const protocol=await this.protocol();let payload,draft,expected,source=null,amount=null,claims=null;
    if(intent.action==='mint'){
      const r=await this.readiness();if(!protocol.minting.available_by_controls||r.new_minting_stopped||r.minted>=1000)fail('Minting is currently unavailable');
      payload={action:'mint',wallet:owner};expected={from:owner,to:m.contracts.vault.address,data:'0x21bf772d',value:hex(50000000000000000n),chainId:hex(BigInt(m.chain_id))};
    }else if(intent.action==='claim'){
      if(!Array.isArray(intent.ids)||!intent.ids.length||intent.ids.length>8||new Set(intent.ids).size!==intent.ids.length)fail('Select one to eight NFTs to claim');
      claims=[];for(const id of intent.ids){const n=await this.nft(id,owner);for(const [scope,royalty] of [['lp',false],['royalties',true]]){const a=n.claimable[scope].find(a=>a.asset===ZERO);if(a?.raw!==null&&a?.raw!==undefined&&raw(a.raw)>0n)claims.push({token_id:id,asset:ZERO,royalty});}}
      if(!claims.length||claims.length>32)fail('No funded ETH rewards are available for these NFTs');
      payload={action:'claim',wallet:owner,claims};expected={from:owner,to:m.contracts.claim_router.address,value:'0x0',chainId:hex(BigInt(m.chain_id)),data:'0xbbeaec93'+word(32n)+word(BigInt(claims.length))+claims.map(c=>word(raw(c.token_id))+addr(c.asset)+word(c.royalty?1n:0n)).join('')};
    }else{
      if(!protocol.lifecycle.new_economic_work_available_by_lifecycle)fail('New contributions are currently unavailable');
      const n=await this.nft(intent.id,owner);if(!n.traits_ready||n.position.activated!==(intent.action==='increase'))fail('Selected action no longer matches this NFT');
      source=this.asset(intent.asset);amount=parseAmount(intent.amount,source.decimals);
      payload={action:intent.action,wallet:owner,token_id:intent.id,pool_id:m.pool_id,source_asset:source.address,amount_in:amount.toString(),slippage_bps:100};
    }
    draft=await this.request(source?'/v1/activation/prepare':'/v1/transactions/prepare',payload);
    await this.provenance(draft.provenance,{activation:Boolean(source),transaction:!source});
    const now=Math.floor(this.clock()/1000);
    if(draft.schema!==1||draft.action!==intent.action||!integer(draft.prepared_at,now-120,now+30)||!integer(draft.expires_at,now+1,now+60)||draft.wallet_revalidation_required!==true)fail('Unsigned review expired or differs from your action');
    let action=intent.action;
    if(source){
      const price=await this.price(source,draft.provenance),gross=amount*price/10n**BigInt(source.decimals),target=100n*10n**18n;
      if(gross>raw(m.limits.contribution_usd_18)||(intent.action==='increase'?gross<5n*10n**18n:(amount!==(target*10n**BigInt(source.decimals)+price-1n)/price)))fail('Price changed or contribution is outside the limits. Refresh the amount; do not repeat a confirmed approval.');
      if(draft.token_id!==intent.id||draft.pool_id!==m.pool_id||draft.source?.asset!==source.address||draft.source.amount_raw!==amount.toString()||draft.source.value_usd_18!==gross.toString()||draft.execution_limit_bps!==100||draft.minimum_deployed_usd_18!==(gross-gross/100n).toString()||draft.state_overrides!==false)fail('Contribution review differs from the selected amount');
      if(draft.kind==='approval_required'){
        const step=draft.approval_steps?.[0];if(source.address===ZERO||draft.activation_ready!==false||draft.approval_steps.length!==1||step.asset!==source.address||step.spender!==m.contracts.entry.address||step.amount_raw!==amount.toString()||step.reset_first!==false||step.reprepare_after_confirmation!==true||draft.contribution!==null)fail('Approval is not the exact selected contribution');
        action='approve';expected={from:owner,to:source.address,value:'0x0',chainId:hex(BigInt(m.chain_id)),data:'0x095ea7b3'+addr(m.contracts.entry.address)+word(amount)};
      }else{
        if(draft.kind!=='activation_transaction'||draft.activation_ready!==true||draft.approval_steps?.length!==0||draft.onchain_deadline!==draft.expires_at)fail('Complete activation simulation is unavailable');
        const minimum=raw(draft.minimum_conversion_output_raw),liquidity=raw(draft.minimum_liquidity_raw);
        if(!liquidity||liquidity>=2n**128n||(source.route_id===ZERO_HASH?minimum!==0n:minimum===0n))fail('Invalid contribution execution minimums');
        const c=draft.contribution;if(!object(c)||c.source_usd_18!==gross.toString()||c.required_deployed_usd_18!==(gross-gross/100n).toString()||raw(c.marginal_deployed_usd_18)<gross-gross/100n||raw(c.lp_liquidity_added_raw)<liquidity||raw(c.shares_added_raw)===0n)fail('Simulation does not prove the required LP addition');
        expected={from:owner,to:m.contracts.entry.address,value:source.address===ZERO?hex(amount):'0x0',chainId:hex(BigInt(m.chain_id)),data:'0x35b13b87'+word(raw(intent.id))+m.pool_id.slice(2)+addr(source.address)+word(amount)+source.route_id.slice(2)+word(minimum)+word(liquidity)+word(BigInt(draft.expires_at))+word(intent.action==='increase'?1n:0n)};
      }
    }else{
      if(draft.kind!=='unsigned_transaction_draft'||draft.simulation?.succeeded!==true||draft.simulation.balance_overrides!==false||draft.approvals_required!==false)fail('Unsigned simulation is incomplete');
      if(claims){if(JSON.stringify(draft.claim_operations?.map(({token_id,asset,royalty})=>({token_id,asset,royalty})))!==JSON.stringify(claims))fail('Claim selection changed');for(const c of draft.claim_operations)if(c.symbol!=='ETH'||c.decimals!==18||raw(c.simulated_raw)===0n||raw(c.view_raw)===0n)fail('Claim simulation has no verified ETH payout');}
      else if(draft.claim_operations?.length!==0)fail('Unexpected mint claim payload');
    }
    const tx=draft.transaction;if(!object(tx)||Object.keys(tx).sort().join()!==['from','to','data','value','chainId'].sort().join()||Object.keys(expected).some(k=>tx[k]!==expected[k]))fail('Returned calldata does not match the selected action');
    const fee=draft.network_gas;
    if(fee?.includes_all_network_components!==true||fee.currency!=='native'||fee.wallet_must_refresh!==true||(source&&fee.included_in_execution_loss!==false)||fee.fee_policy_review_hash!==(source?m.activation_fee_review:m.transaction_fee_review))fail('Network fee policy is not qualified');
    const gas=raw(fee.suggested_limit),price=raw(fee.price_wei),cost=gas*price;
    if(gas<21000n||gas>BigInt(m.limits.gas)||raw(fee.estimated_units)<21000n||raw(fee.estimated_units)>gas||!price||price>raw(m.limits.gas_price_wei)||cost>raw(m.limits.network_fee_wei)||fee.suggested_limit_cost_wei!==cost.toString()||fee.estimated_fee_wei!==(raw(fee.estimated_units)*price).toString()||quantity(tx.value)>raw(m.limits.native_value_wei))fail('Gas or value exceeds the reviewed policy');
    const pinned=source&&action==='approve'?source:m.contracts[action==='mint'?'vault':action==='claim'?'claim_router':'entry'];
    const runtime=await this.reader.request({method:'eth_getCode',params:[tx.to,{blockHash:draft.provenance.block_hash,requireCanonical:true}]});
    if(runtime!==pinned.runtime_code)fail('Transaction target code differs from the reviewed deployment');
    await this.identity();await this.provenance(draft.provenance,{activation:Boolean(source),transaction:!source});if(Math.floor(this.clock()/1000)>=draft.expires_at)fail('Review expired during verification');
    // Deliberately no nonce, signer handle or send method. Reviewed fields are
    // suitable for a future release-gated signer, never automatic submission.
    return freeze({action,requested_action:intent.action,intent:clone(intent),transaction:expected,
      network_gas:{gas_limit:gas.toString(),gas_price_wei:price.toString(),max_cost_wei:cost.toString()},
      source:source?draft.source:null,claims:draft.claim_operations||[],minimum_deployed_usd_18:draft.minimum_deployed_usd_18||null,
      liquidity_context:source?draft.liquidity_context:null,
      simulated_lp_added_usd_18:source&&action!=='approve'?draft.contribution.marginal_deployed_usd_18:null,
      prepared_at:draft.prepared_at,expires_at:draft.expires_at,provenance:draft.provenance,
      signing_enabled:false,notice:'Unsigned review only. Public signing is not enabled.'});
  }
}
