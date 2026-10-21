import {DeploymentAPI,ZERO,raw,exactUnits} from './deployment-api.js';
import {DeploymentSession} from './deployment-session.js';
import {DeploymentTransactions} from './deployment-transactions.js';
import {escape as e,usd,units} from './local-client.js';
import {rewardHistoryUSD,royaltyTrait} from './local-view.js';
import {COLORWAYS,PATTERNS,findArtwork,paletteTrait,preloadEvolutions} from './artworks.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const text=(s,v)=>{const n=$(s);if(n)n.textContent=v;};
const short=a=>a.slice(0,6)+'…'+a.slice(-4);
export function nativeRewards(n,scope){
  const rows=(scope?[scope]:['lp','royalties']).flatMap(k=>n.claimable[k]).filter(a=>a.asset===ZERO);
  if(!rows.length||rows.some(a=>a.raw===null||a.available===false))return null;
  return rows.reduce((s,a)=>s+raw(a.raw),0n).toString();
}
export function renderPositionAmounts(n){
  const lp=`<div class="position-attached-lp"><span>LP attached</span><strong>${e(usd(n.position.current_lp_value.raw))}</strong></div>`;
  if(!n.position.activated)return lp;
  const history=`<div class="position-earnings">${[['last_24h','24h'],['all_time','all time']].map(([key,label])=>`<div><span>Fees generated · ${label}</span><span class="earnings-value">${e(usd(rewardHistoryUSD(n,key)))}</span></div>`).join('')}</div>`;
  const amount=nativeRewards(n),pending=['lp','royalties'].some(k=>n.claimable[k].some(a=>a.asset!==ZERO&&(a.raw===null||raw(a.raw)>0n)));
  return lp+history+`<div class="position-reward-total"><span>Rewards to claim</span><strong>${amount===null?'Unavailable':e(units(amount))+' ETH'}</strong></div>`+(pending?'<p class="small-note">Additional source-token rewards await conversion or verification.</p>':'');
}
export function createDeploymentView(config){
  const link=document.createElement('link');link.rel='stylesheet';link.href='./local-view.css';document.head.append(link);
  const bar=document.createElement('div');bar.className='container local-status';bar.innerHTML='<span role="status">Checking reviewed deployment…</span><button type="button" class="text-link" data-deployment-refresh>Refresh ↻</button>';document.querySelector('main').before(bar);
  const status=(message,error=false)=>{bar.querySelector('span').textContent=message;bar.classList.toggle('is-error',error);};
  // Configuration failures never fall back to invented portfolio data.
  let api;try{api=new DeploymentAPI(config);}catch(error){
    document.querySelector('main').innerHTML='<section class="container app-view"><h1>Deployment configuration unavailable</h1><p>Account data and transaction preparation are disabled.</p></section>';
    status(error.message,true);$$('[data-connect]').forEach(b=>b.disabled=true);
    const noop=()=>{};return {updateWallet:noop,renderPortfolio:noop,renderMetrics:noop,renderCollection:noop,openWallet:noop,refresh:noop,setProviders:noop,renderMint:noop,failed:true};
  }
  const m=api.manifest,dialog=document.createElement('dialog');dialog.className='dialog local-confirm';dialog.setAttribute('aria-label','Unsigned transaction review');document.body.append(dialog);
  let providers=[],snapshot=null,readiness=null,page=0,sequence=0,busy=false,preparing=false,error=null,quoteSequence=0;
  let store=null;try{store=sessionStorage;}catch{}
  let transactions=null,review=null,stage=null,reviewTimer=null;
  const localSigning=m.environment==='rehearsal'&&m.chain_id===31337&&new URL(m.rpc_url).protocol==='http:'&&new URL(m.rpc_url).hostname==='127.0.0.1';
  const session=new DeploymentSession({storage:store,key:'popl-deployment-address:'+m.id,onChange:()=>{
    sequence++;quoteSequence++;review=null;api.cancel();snapshot=null;busy=false;preparing=false;error=null;dialog.close();$('#nft-dialog').close();render();
    if(!session.busy&&session.account)void refresh();
  }});
  if(localSigning)transactions=new DeploymentTransactions(api,session,{onChange:()=>render(),onProgress:value=>{
    stage=value.stage;
    const messages={checking:'Checking the reviewed transaction…',wallet:'Confirm in your selected wallet.',submitted:'Transaction sent. Waiting for confirmation…',confirming:'Checking the saved transaction on-chain…',confirmed:'Transaction confirmed. Refreshing confirmed balances…',failed:'Transaction reverted. No LP change was applied.',reconciling:'Transaction confirmed. Checking confirmed balances…'};
    status(messages[value.stage]||'Checking transaction status…');
    text('.local-confirm [data-deployment-progress]',messages[value.stage]||'Checking transaction status…');render();
  }});
  const recovery=document.createElement('button');recovery.type='button';recovery.className='text-link';recovery.dataset.deploymentRecover='';recovery.textContent='Recover saved transaction ↻';recovery.hidden=true;bar.append(recovery);
  const network=document.createElement('button');network.type='button';network.className='text-link';network.dataset.deploymentNetwork='';network.textContent='Switch to '+m.chain_name;network.hidden=true;bar.append(network);
  function pending(){if(!transactions||!session.account||!session.provider)return null;try{return transactions.pending();}catch(err){status(err.message,true);return {invalid:true};}}
  const stale=()=>!snapshot||Math.floor(Date.now()/1000)-snapshot.protocol.provenance.block_timestamp>m.max_age_seconds;
  const blocked=()=>busy||preparing||transactions?.busy||Boolean(pending())||session.busy||!session.account||stale();
  text('.network-tag',m.chain_name+(localSigning?' · local wallet rehearsal':' · read & review'));text('.demo-label',localSigning?'LOCAL ANVIL':'UNSIGNED REVIEW');
  text('.demo-banner-copy',localSigning?'Local Anvil transactions only. No public assets move.':'Confirmed contract data and unsigned preparation. Signing is not enabled.');
  text('[data-view="my-nfts"] .page-heading p','Your confirmed holdings, attached LP and funded rewards.');
  text('#portfolio-disconnected > p:last-of-type','Connect a wallet to read its public holdings on '+m.chain_name+'. No signature or transaction is requested.');
  text('#wallet-dialog > .small-note',localSigning?'Connect your account; every local transaction requires a separate wallet confirmation.':'Only your public account is authorized. This deployment profile cannot sign or send transactions.');
  text('#nft-dialog .eyebrow','CONFIRMED POSITION');
  text('.portfolio-footnote p','Each card shows its confirmed snapshot. Earnings include LP and royalties at reviewed current prices; unavailable prices are not zero.');
  $('#reset-demo').hidden=true;$('#demo-wallet').hidden=true;
  // Collection-wide aggregation is not supplied by the wallet-ID endpoint. Do
  // not disguise the current eight-card page as the entire collection/wallet.
  $$('#portfolio-connected .metric-grid,.collection-analytics,.collection-filters,[data-view="collection"] .pagination,#collection-activity-summary').forEach(n=>n.hidden=true);
  const pager=document.createElement('div');pager.className='local-actions';pager.innerHTML='<button class="button button-secondary" data-deployment-page="-1">Previous</button><span role="status"></span><button class="button button-secondary" data-deployment-page="1">Next</button>';$('#owned-nfts').after(pager);
  function walletOptions(){
    $('#wallet-providers').innerHTML=providers.map((p,i)=>`<button class="wallet-option" data-deployment-provider="${i}" ${session.busy?'disabled':''}><span>◇</span><span>${e(p.name)}</span><span>→</span></button>`).join('')+(session.options.length>1?'<p>Select the account to view:</p>'+session.options.map(a=>`<button class="wallet-option local-id" data-deployment-account="${a}">${a}</button>`).join(''):'');
    text('#wallet-message',session.busy?'Authorize address access in your wallet.':session.account?'Selected: '+session.account:providers.length?'Choose a wallet, then select an authorized account.':'No wallet detected. Enable an Ethereum-compatible wallet extension.');
    $('#wallet-connected-actions').hidden=!session.account;
    text('#connected-wallet-description',session.account||'');
  }
  function updateWallet(){
    $$('[data-connect]').forEach(b=>b.textContent=session.account?short(session.account):'Connect wallet ↗');
    renderMint();if($('#wallet-dialog').open)walletOptions();
  }
  function renderMint(){
    const button=$('#mint-submit');if(!button)return;
    button.type='button';button.disabled=busy||preparing||transactions?.busy||Boolean(pending())||session.busy||Boolean(readiness?.new_minting_stopped)||readiness?.minted>=1000;
    button.textContent=transactions?.busy?(review?.requested_action==='mint'?(stage==='wallet'?'Confirm mint in wallet…':'Checking mint confirmation…'):'Wallet operation in progress…'):preparing?'Preparing review…':busy?'Reading confirmed state…':session.account?(localSigning?'Review mint ↗':'Review unsigned mint ↗'):'Connect wallet ↗';
    text('#mint-message','0.05 ETH mint price. Network gas is separate. '+(localSigning?'Local Anvil only; confirm each send in your wallet.':'This profile does not submit transactions.'));
    if(readiness){text('#mint-supply',readiness.minted+' / 1,000');text('#mint-remaining',(1000-readiness.minted)+' remaining');}
  }
  function renderMetrics(){$$('[data-metric]').forEach(n=>n.textContent='Unavailable');}
  function renderCollection(){
    text('#result-count','Collection inventory not configured');$('#positions-body').innerHTML='<tr><td colspan="5">Use My NFTs for your confirmed positions. Full collection aggregation is not enabled in this review profile.</td></tr>';
  }
  const artFor=n=>n.traits_ready&&n.position.evolution_value_available?findArtwork(`${COLORWAYS[n.traits.palette]?.id}-${PATTERNS[n.traits.pattern]?.id}-${n.traits.rarity.toLowerCase()}-${n.position.evolution}`):null;
  function traits(n){const art=artFor(n);return n.traits_ready?`<strong>${e(n.traits.rarity)}</strong><span>${e(art?.colorStyle||'')}</span>${paletteTrait(COLORWAYS[n.traits.palette].colors)}${royaltyTrait(n)}`:'<span>Awaiting verified reveal</span>';}
  function renderPortfolio(){
    $('#portfolio-disconnected').hidden=Boolean(session.account);$('#portfolio-connected').hidden=!session.account;
    text('#portfolio-address',session.account?short(session.account):'');text('#portfolio-label',busy?'READING CONFIRMED STATE':'UNSIGNED REVIEW');
    text('.portfolio-account .small-note',snapshot?'Holdings at block '+snapshot.inventory.provenance.block_number:'Confirmed holdings unavailable');
    const items=snapshot?.nfts||[];
    text('#my-count',snapshot?`${snapshot.inventory.count} NFTs owned · showing ${items.length} on this page`:'');
    $('#owned-nfts').innerHTML=items.map(n=>{const art=artFor(n);if(art)preloadEvolutions(art);return `<article class="nft-card"><div class="nft-card-art">${art?`<button class="art-image-button" data-deployment-id="${n.token_id}" aria-label="View PoPL #${n.mint_ordinal}"><img class="nft-artwork" src="${art.src}" alt="${e(art.colorLabel+' '+art.rarityLabel+' '+art.evolutionLabel)}" width="1024" height="1024" loading="lazy"></button>`:'<div class="local-art-unavailable">Artwork state unavailable</div>'}</div><div class="nft-card-body"><div class="nft-card-title"><h3>PoPL #${n.mint_ordinal}</h3><span>${e(n.position.evolution_value_available?n.position.evolution:'Unavailable')}</span></div><div class="nft-card-traits">${traits(n)}</div>${renderPositionAmounts(n)}<div class="local-position-actions">${n.position.activated?`<button class="button" data-deployment-claim="${n.token_id}" ${blocked()||!nativeRewards(n)||nativeRewards(n)==='0'?'disabled':''}>Review claim</button>`:''}<button class="button button-secondary" data-deployment-id="${n.token_id}" data-deployment-grow ${blocked()||!n.traits_ready?'disabled':''}>${n.position.activated?'Grow attached LP':'Activate'}</button></div><p class="small-note">Confirmed block ${n.provenance.block_number}</p></div></article>`;}).join('')||`<p class="local-empty">${e(busy?'Reading your confirmed positions…':error||'No NFTs owned by this address.')}</p>`;
    $('#claim-all').disabled=blocked()||!items.some(n=>nativeRewards(n)&&nativeRewards(n)!=='0');text('#claim-all','Review claims on this page ↗');
    pager.hidden=!snapshot||snapshot.inventory.count<=8;pager.querySelector('span').textContent=`Page ${page+1}`;
    pager.querySelector('[data-deployment-page="-1"]').disabled=busy||page===0;
    pager.querySelector('[data-deployment-page="1"]').disabled=busy||!snapshot||(page+1)*8>=snapshot.inventory.count;
  }
  function render(){updateWallet();renderPortfolio();recovery.hidden=!pending();recovery.disabled=Boolean(transactions?.busy);network.hidden=!localSigning||!session.account;network.disabled=Boolean(transactions?.busy)||Boolean(pending());}
  async function refresh({keepDialog=false}={}){
    if(transactions?.busy)return;const current=++sequence,owner=session.account;api.cancel();busy=true;error=null;if(!keepDialog){review=null;dialog.close();}render();
    try{
      const ready=await api.readiness();if(current!==sequence)return;readiness=ready;
      const data=owner?await api.portfolio(owner,page):(await api.protocol(),null);
      if(current!==sequence||owner!==session.account)return;// A refresh must not publish a pending contribution's new artwork before
      // its canonical Entry receipt and LP position have been reconciled.
      const waiting=pending(),target=waiting?.context?.intent?.id;
      if(data&&target&&['activate','increase'].includes(waiting.context.action)){
        const previous=snapshot?.nfts.find(n=>n.token_id===target);
        data.nfts=data.nfts.map(n=>n.token_id!==target?n:previous||{...n,position:{...n.position,current_lp_value:{...n.position.current_lp_value,available:false,raw:null},evolution_value_available:false}});
      }
      snapshot=data;status(pending()?'A saved transaction needs recovery. Check its status before a new review.':localSigning?'Confirmed data loaded. Local Anvil wallet ready.':'Confirmed data loaded. Review only; no transactions can be sent.');
    }catch(err){if(current!==sequence)return;error=err.message;snapshot=null;status(error,true);}
    finally{if(current===sequence){busy=false;render();}}
  }
  function openWallet(){text('#wallet-title','Connect to view your holdings.');text('#wallet-dialog .dialog-intro','Choose a wallet and account. Reads use the reviewed '+m.chain_name+' deployment.');walletOptions();if(!$('#wallet-dialog').open)$('#wallet-dialog').showModal();}
  async function connect(index){if(session.busy)return;const p=providers[index];if(!p)return;try{await session.connect(p);if(session.account)$('#wallet-dialog').close();}catch(err){text('#wallet-message',err.code===4001?'Connection cancelled. No transaction was requested.':err.message);status('Wallet connection was not completed.',true);}}
  async function quote(form){
    const generation=++quoteSequence,current=sequence;form.elements.amount.value='';form.elements.consent.checked=false;form.querySelector('button[type=submit]').disabled=true;
    text('#nft-dialog [data-deployment-feedback]','Reading the reviewed activation price…');
    try{const result=await api.activationAmount(form.elements.asset.value);if(generation!==quoteSequence||current!==sequence||!form.isConnected||!$('#nft-dialog').open)return;
      form.elements.amount.value=result.amount;form.querySelector('button[type=submit]').disabled=false;text('#nft-dialog [data-deployment-feedback]','$100 in value, rounded up only to the smallest token unit. Rechecked during preparation.');
    }catch(err){if(generation===quoteSequence&&form.isConnected)text('#nft-dialog [data-deployment-feedback]',err.message);}
  }
  function details(id,grow=false){
    if(blocked())return void refresh();const n=snapshot.nfts.find(n=>n.token_id===id);if(!n)return;
    quoteSequence++;const action=n.position.activated?'increase':'activate',assets=m.input_assets.filter(a=>a.enabled);
    const balance=scope=>{const amount=nativeRewards(n,scope);return amount===null?'Unavailable':units(amount)+' ETH';};
    $('#nft-dialog-content').innerHTML=`<h2 id="nft-details-title">PoPL #${n.mint_ordinal}</h2><div class="nft-card-traits">${traits(n)}</div>${renderPositionAmounts(n)}${!grow&&n.position.activated?`<div class="breakdown-rows"><div>LP rewards <span>${e(balance('lp'))}</span></div><div>Royalties <span>${e(balance('royalties'))}</span></div></div>`:''}${grow?`<form data-deployment-contribution="${id}" data-action="${action}" class="liquidity-form"><label class="input-label">Contribution asset<select name="asset">${assets.map(a=>`<option value="${a.symbol}">${a.symbol}</option>`).join('')}</select></label><label class="input-label">Token amount<input class="amount-input" name="amount" type="text" inputmode="decimal" autocomplete="off" required ${action==='activate'?'readonly':''}></label><p class="small-note">${action==='activate'?'Activate with $100 in value.':'Add at least $5 in value.'} At least 99% must become added LP; network gas is separate.</p><label class="checkbox-label"><input name="consent" type="checkbox" required><span>I understand this funds LP attached to the NFT and the principal cannot be redeemed.</span></label><button type="submit" class="button" ${assets.length?'':'disabled'}>${localSigning?'Review':'Prepare unsigned'} ${action==='activate'?'activation':'LP addition'} ↗</button><p class="form-message" data-deployment-feedback role="status"></p></form>`:''}`;
    $('#nft-dialog').showModal();const form=$('[data-deployment-contribution]');if(grow&&action==='activate'&&assets.length)void quote(form);
  }
  async function prepare(intent,{afterApproval=false}={}){
    if(preparing||transactions?.busy)return;if(!session.account)return openWallet();if(pending())return void recover();if(stale()&&!afterApproval)return void refresh();
    preparing=true;updateWallet();const current=sequence;
    try{
      const permission=await session.verify();const draft=transactions?await transactions.prepare({...intent,account:permission.account},{afterApproval}):await api.prepare({...intent,account:permission.account});await session.verify();
      if(current!==sequence||permission.revision!==session.revision||permission.account!==session.account)return;
      const labels={mint:'Mint',claim:'Claim ETH rewards',approve:'Approve exact contribution',activate:'Activate NFT',increase:'Grow attached LP'};
      review=draft;stage=null;const context=draft.liquidity_context;
      dialog.innerHTML=`<h2>${e(labels[draft.action])}</h2><p class="eyebrow">${localSigning?'LOCAL WALLET REVIEW':'UNSIGNED REVIEW'} · ${e(m.chain_name)}</p><p>${localSigning?'Nothing is sent until you confirm in the selected wallet.':'This profile cannot send transactions. Nothing has been approved or transferred.'}</p><div class="nft-detail-rewards"><div>Account <b class="local-id">${e(permission.account)}</b></div><div>Destination <b class="local-id">${e(draft.transaction.to)}</b></div>${draft.source?`<div>Contribution <b>${e(exactUnits(draft.source.amount_raw,api.asset(intent.asset).decimals))} ${e(intent.asset)}</b></div>`:`<div>Native value <b>${e(exactUnits(BigInt(draft.transaction.value).toString(),18))} ETH</b></div>`}${draft.simulated_lp_added_usd_18?`<div>Simulated LP added <b>${e(usd(draft.simulated_lp_added_usd_18))}</b></div>`:''}<div>Network gas · separate review limit <b>${e(exactUnits(draft.network_gas.max_cost_wei,18))} ETH</b></div></div>${draft.action==='approve'?'<p>Approval alone adds no liquidity. After a confirmed approval, the complete Entry operation must be prepared again.</p>':''}${context?.in_range===false?'<p class="is-error">The LP is outside its active trading range. '+e(String(context.rebalance?.explanation||'Next eligible rebalance unavailable.').slice(0,600))+' Next keeper execution is not guaranteed.</p>':''}<p role="status" data-deployment-expiry>Review expires at ${e(new Date(draft.expires_at*1000).toLocaleTimeString())}.</p><details><summary>Exact unsigned calldata</summary><code>${e(draft.transaction.data)}</code></details><p role="status" data-deployment-progress></p>${draft.signing_enabled?'<button type="button" class="button" data-deployment-send>Confirm in your wallet</button>':''}<button type="button" class="button button-secondary" data-deployment-close>Close</button>`;
      clearTimeout(reviewTimer);dialog.showModal();const timer=setTimeout(()=>{if(dialog.open&&!transactions?.busy){text('[data-deployment-expiry]','This review has expired. Prepare again using current confirmed state.');const send=dialog.querySelector('[data-deployment-send]');if(send)send.disabled=true;}},Math.max(0,draft.expires_at*1000-Date.now()));reviewTimer=timer;dialog.addEventListener('close',()=>clearTimeout(timer),{once:true});
      status(localSigning?'Review ready. Confirm in your wallet to send the local transaction.':'Unsigned review prepared. Signing remains disabled.');
    }catch(err){if(current===sequence){status(err.message,true);text('#nft-dialog [data-deployment-feedback]',err.message);}}
    finally{if(current===sequence){preparing=false;updateWallet();}}
  }
  function resultDialog(result){
    clearTimeout(reviewTimer);
    const complete=result.reconciled,confirmed=result.status==='confirmed';
    const title=complete?(confirmed?'Transaction confirmed':'Transaction reverted'):confirmed?'Confirmed · balances catching up':'Check transaction status';
    const message=result.error||(complete?(confirmed?'Confirmed contract state is ready to refresh.':'The operation reverted; network gas may have been spent.'):'Check the same saved transaction. Do not submit it again.');
    dialog.innerHTML=`<h2>${e(title)}</h2><p role="status" data-deployment-progress>${e(message)}</p>${result.hash?`<p class="local-id">Transaction: ${e(result.hash)}</p>`:''}${!complete&&!result.hash?'<label>Transaction hash from your wallet<input class="amount-input" data-deployment-hash autocomplete="off" placeholder="0x…"></label>':''}${complete?'':'<button class="button" data-deployment-recover>Recover status</button>'}<button class="button button-secondary" data-deployment-close>Close</button>`;
    if(!dialog.open)dialog.showModal();
  }
  async function finish(result,current){
    if(current!==sequence)return;
    if(result.status==='none'){dialog.close();await refresh();return;}
    if(result.reconciled&&result.status==='confirmed'&&result.action==='approve'){
      // Keep the dialog open, but ask for a fresh complete Entry review. No send.
      dialog.innerHTML='<h2>Approval confirmed</h2><p>Preparing the LP transaction. Approval alone adds no liquidity.</p><button class="button button-secondary" data-deployment-close>Close</button>';
      await prepare(result.intent,{afterApproval:true});return;
    }
    resultDialog(result);
    if(result.reconciled){review=null;$('#nft-dialog').close();await refresh({keepDialog:true});}
  }
  async function submit(){
    if(!transactions||!review||transactions.busy)return;const current=sequence,selected=review;clearTimeout(reviewTimer);
    dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await finish(await transactions.submit(selected),current);}
    catch(err){if(current!==sequence)return;status(err.message,true);
      if(pending())resultDialog({status:'unresolved',hash:pending()?.hash,error:err.message});
      else {review=null;dialog.innerHTML=`<h2>${err.rejected?'Transaction cancelled':'Transaction not sent'}</h2><p>${e(err.message)}</p><p>Refresh balances before preparing a new review.</p><button class="button button-secondary" data-deployment-close>Close</button>`;}}
    finally{stage=null;render();}
  }
  async function recover(){
    if(!transactions||transactions.busy||!session.account)return;const current=sequence;
    const hashInput=dialog.querySelector('[data-deployment-hash]')?.value.trim();
    dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await finish(await transactions.recover(hashInput||undefined),current);}
    catch(err){if(current===sequence){status(err.message,true);resultDialog({status:'unresolved',hash:pending()?.hash,error:err.message});}}
    finally{stage=null;render();}
  }
  async function switchNetwork(){try{await transactions?.switchNetwork();status('Selected network verified. Refresh and prepare a new review.');await refresh();}catch(err){status(err.code===4001?'Network switch cancelled.':err.message,true);}}
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||!b.matches('[data-connect],[data-deployment-provider],[data-deployment-account],[data-deployment-refresh],[data-deployment-id],[data-deployment-claim],[data-deployment-page],[data-deployment-close],[data-deployment-send],[data-deployment-recover],[data-deployment-network],#mint-submit,#disconnect-wallet,#claim-all,#demo-wallet,#reset-demo'))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(b.matches('[data-deployment-send]'))return void submit();
    if(b.matches('[data-deployment-recover]'))return void recover();
    if(b.matches('[data-deployment-network]'))return void switchNetwork();
    if(b.matches('[data-connect]'))return openWallet();
    if(b.matches('[data-deployment-provider]'))return void connect(Number(b.dataset.deploymentProvider));
    if(b.matches('[data-deployment-account]'))return void session.select(b.dataset.deploymentAccount).then(()=>$('#wallet-dialog').close()).catch(err=>status(err.message,true));
    if(b.matches('[data-deployment-refresh]'))return void refresh();
    if(b.matches('[data-deployment-close]')){review=null;dialog.close();return;}
    if(b.matches('[data-deployment-id]'))return details(b.dataset.deploymentId,b.hasAttribute('data-deployment-grow'));
    if(b.matches('[data-deployment-claim]'))return void prepare({action:'claim',ids:[b.dataset.deploymentClaim]});
    if(b.matches('[data-deployment-page]')){page+=Number(b.dataset.deploymentPage);return void refresh();}
    if(b.id==='disconnect-wallet'){session.disconnect();$('#wallet-dialog').close();return;}
    if(b.id==='mint-submit'){if(!session.account)return openWallet();if(!$('#mint-form').reportValidity())return;return void prepare({action:'mint'});}
    if(b.id==='claim-all')return void prepare({action:'claim',ids:(snapshot?.nfts||[]).filter(n=>nativeRewards(n)&&nativeRewards(n)!=='0').map(n=>n.token_id)});
  },true);
  document.addEventListener('submit',event=>{const f=event.target;if(!f.matches('[data-deployment-contribution]'))return;event.preventDefault();event.stopImmediatePropagation();if(!f.reportValidity())return;void prepare({action:f.dataset.action,id:f.dataset.deploymentContribution,amount:f.elements.amount.value,asset:f.elements.asset.value});},true);
  document.addEventListener('change',event=>{const f=event.target.closest('[data-deployment-contribution]');if(!f||event.target.name!=='asset')return;f.elements.consent.checked=false;if(f.dataset.action==='activate')void quote(f);});
  window.addEventListener('hashchange',()=>{quoteSequence++;review=null;dialog.close();$('#nft-dialog').close();});
  window.addEventListener('pagehide',()=>{sequence++;api.cancel();dialog.close();});
  return {updateWallet,renderPortfolio,renderMetrics,renderCollection,renderMint,openWallet,refresh,setProviders:items=>{providers=items;walletOptions();void session.restore(items);}};
}
