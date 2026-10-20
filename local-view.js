import {LocalClient,escape as e,units,usd,sum,uint,balances,hasClaim,readyRewards,pendingConversion} from './local-client.js';
import {COLORWAYS,PATTERNS,RARITIES,findArtwork,paletteTrait,preloadEvolutions,confirmedUpgrade,armUpgradeSound,queueUpgrade,transitionArtwork} from './artworks.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const short=a=>`${a.slice(0,6)}…${a.slice(-4)}`;
const text=(s,value)=>{const n=$(s);if(n)n.textContent=value;};
const lpValue=n=>n.position.current_lp_value.available?n.position.current_lp_value.raw:null;
const earned=(n,period)=>rewardHistoryUSD(n,period);
const artFor=n=>n.traits_ready&&n.position.evolution_value_available?findArtwork(`${COLORWAYS[n.traits.palette]?.id}-${PATTERNS[n.traits.pattern]?.id}-${n.traits.rarity.toLowerCase()}-${n.position.evolution}`):null;
const buttonArt=n=>{const art=artFor(n);return art?`<button class="art-image-button" data-local-id="${n.token_id}" aria-label="View PoPL #${n.mint_ordinal}"><img class="nft-artwork" src="${art.src}" alt="${e(art.colorLabel+' '+art.rarityLabel+' '+art.evolutionLabel)}" width="1024" height="1024" loading="lazy"><span class="art-enlarge">↗</span></button>`:'<div class="local-art-unavailable">Artwork state unavailable</div>';};
const row=(label,value)=>`<div><span>${label}</span><b>${e(value)}</b></div>`;
const claimRows=n=>[...readyRewards(n,'lp'),...readyRewards(n,'royalties')];
export const royaltyTrait=n=>{
  const multiplier=n.traits_ready?RARITIES.find(r=>r.label===n.traits.rarity)?.royaltyMultiplier:null;
  const active=n.position.activated;
  return `<span class="royalty-trait${active?'':' is-dormant'}" title="${active?'Rarity multiplier for NFT-sale royalties':'Activate this NFT to enable its royalty share'}">Royalty weight ${multiplier?`×${multiplier}`:'· unrevealed'}</span>`;
};


export function contributionError(amount, consent, kind='activate') {
  const minimum=kind==='increase'?5:100;
  if(!['activate','increase'].includes(kind)||typeof amount!=='string'||!(/^[1-9][0-9]{0,4}$/).test(amount)||Number(amount)<minimum)return `Enter a whole amount from ${minimum} to 99,999 in local USD value.`;
  if(kind==='activate'&&amount!=='100')return 'Activation is exactly $100 in value. Add more separately with Grow attached LP.';
  if(consent!==true)return 'Tick the checkbox to confirm that the LP principal cannot be redeemed.';
  return null;
}
export const sameContribution=(a,b)=>Boolean(a&&b&&['session','account','id','amount','asset'].every(key=>a[key]===b[key]));

// Pending displays keep identity/artwork only, never cached financial values.
export function positionRows(n, pendingLabel=null) {
  const labels=typeof pendingLabel==='object'&&pendingLabel?pendingLabel:{lp:pendingLabel,history:pendingLabel,rewards:pendingLabel};
  const lp=`<div class="position-attached-lp"><span>LP attached</span><strong>${e(labels.lp||usd(lpValue(n)))}</strong></div>`;
  if(!n.position.activated)return lp;
  // Sum the same currency exactly; never add unrelated token units or assume a price.
  return lp+earningsSummary(n,labels.history)+claimTotal(n,labels.rewards);
}
export function rewardHistoryUSD(n,period) {
  if(n.position?.activated===false)return '0';
  const h=n.earnings;
  if(!['last_24h','all_time'].includes(period)||h?.available!==true||h.scope!=='nft'||h.token_id!==n.token_id||h.chain_id!==n.chain_id||
    !n.provenance?.block_hash||h.provenance?.block_hash!==n.provenance.block_hash)return null;
  try { const total=sum(['lp_individual','lp_collective','royalties'].map(k=>h[period+'_usd_at_current_price_18']?.[k])); if(total!==null)uint(total); return total; }
  catch { return null; }
}
export function earningsSummary(n,pendingLabel=null) {
  const value=period=>pendingLabel||usd(rewardHistoryUSD(n,period));
  return `<div class="position-earnings" aria-label="NFT earnings, LP rewards plus royalties"><div><span>Fees generated · 24h</span><span class="earnings-value">${e(value('last_24h'))}</span></div><div><span>Fees generated · all time</span><span class="earnings-value">${e(value('all_time'))}</span></div></div>`;
}
function claimTotal(n,pendingLabel=null) {
  const waiting=!pendingLabel&&pendingConversion(n).length>0;
  return `<div class="position-reward-total"><span>Rewards to claim</span><strong>${e(pendingLabel||balances(claimRows(n)))}</strong></div>${waiting?'<p class="small-note">Some rewards are awaiting ETH conversion.</p>':''}`;
}
export function positionFinancialDetails(n) {
  const position=`<section class="position-breakdown"><div class="position-attached-lp"><span>LP attached</span><strong>${e(usd(lpValue(n)))}</strong></div>${n.position.activated?earningsSummary(n):''}</section>`;
  if(!n.position.activated)return position+'<p class="small-note">Activate this NFT to start earning LP fees and royalties.</p>';
  const pending=pendingConversion(n);
  return `${position}<section class="position-breakdown claim-breakdown">${claimTotal(n)}<div class="breakdown-rows">${row('LP rewards',balances(readyRewards(n,'lp')))}${row('Royalties',balances(readyRewards(n,'royalties')))}${pending.length?row('Awaiting ETH conversion',balances(pending)):''}</div>${pending.length?'<p class="small-note">These token balances remain attached to this NFT. A failed conversion leaves them intact.</p>':''}</section>`;
}

// A display snapshot never authorizes another transaction. Unknown/session-changed
// state remains unavailable; ordinary transaction refresh only marks affected fields.
export function operationScope(draft,session,account) {
  const ids=draft.action==='claim'?(draft.claims||[]).map(c=>c.token_id):[draft.targetId||draft.contributionContext?.id];
  return {session,account,action:draft.action,ids:[...new Set(ids.filter(id=>typeof id==='string'))]};
}
export function refreshLabels(id,scope,{stale,busy,session,account}) {
  const clear={lp:null,rewards:null,history:null,artwork:false};
  if(!stale)return clear;
  if(!busy||!scope||scope.session!==session||scope.account!==account)
    return {lp:busy?'Refreshing…':'Unavailable',rewards:busy?'Refreshing…':'Unavailable',history:busy?'Refreshing…':'Unavailable',artwork:false};
  if(!scope.ids.includes(id))return clear;
  if(['activate','increase'].includes(scope.action))return {...clear,lp:'Updating…',artwork:true};
  if(scope.action==='claim')return {...clear,rewards:'Refreshing balance…'};
  if(scope.action==='transfer')return {lp:'Refreshing ownership…',rewards:'Refreshing ownership…',history:'Refreshing ownership…',artwork:false};
  return clear;
}

// Reuse loaded artwork on routine renders; crossfade only a confirmed new image.
function withArtworkContinuity(container, render) {
  const previous=new Map([...container.querySelectorAll('.art-image-button[data-local-id]')].map(b=>[b.dataset.localId,b]));
  render();
  for(const button of container.querySelectorAll('.art-image-button[data-local-id]')) {
    const old=previous.get(button.dataset.localId),next=button.querySelector('img'),prior=old?.querySelector('img');
    if(!prior||!next)continue;
    if(prior.getAttribute('src')===next.getAttribute('src')) {
      old.disabled=button.disabled;button.replaceWith(old);continue;
    }
    transitionArtwork(button,prior,next);
  }
}

export function createLocalView(client=null) {
  const c=client||new LocalClient();let busy=false,stale=true,page=1,selected=null,confirmDraft=null,sequence=0;
  const contributionAmounts=new Map(),contributionAssets=new Map();let selectedMode="breakdown";let lastSnapshot=null,lastSnapshotSession=null,approvedContribution=null,updatingNFT=null,refreshScope=null;
  const bar=document.createElement('div');bar.className='container local-status';bar.innerHTML='<span role="status">Connecting to local contracts…</span><button class="text-link" data-local-refresh>Refresh ↻</button>';document.querySelector('main').before(bar);
  const dialog=document.createElement('dialog');dialog.className='dialog local-confirm';dialog.setAttribute('aria-label','Confirm local transaction');document.body.append(dialog);
  const css=document.createElement('link');css.rel='stylesheet';css.href='./local-view.css';document.head.append(css);
  const status=(message,error=false)=>{
    bar.firstElementChild.textContent=message;bar.classList.toggle('is-error',error);
    const feedback=$('#nft-dialog [data-local-feedback]');
    if(feedback&&$('#nft-dialog').open){feedback.textContent=message;feedback.classList.toggle('is-error',error);}
  };
  const contributionBusy=value=>{
    const f=$('#nft-dialog [data-local-contribution]');if(!f)return;
    f.setAttribute('aria-busy',String(value));f.querySelectorAll('input,select,button').forEach(n=>n.disabled=value||blocked());
    f.querySelector('[type="submit"]').textContent=value?'Preparing transaction…':`Review ${f.dataset.localKind==='activate'?'activation':'LP addition'} ↗`;
  };
  const blocked=()=>busy||stale||!c.state||c.state.uncertain||Boolean(c.pending)||Boolean(c.connectionError);
  const owned=()=>c.state?.nfts.filter(n=>n.owner===c.account)||[];
  const closeConfirmation=()=>{if(confirmDraft)status('Confirmation cancelled. No transaction was sent.');confirmDraft=null;sequence++;if(dialog.open)dialog.close();};
  dialog.addEventListener('close',()=>{if(confirmDraft)status('Confirmation cancelled. No transaction was sent.');confirmDraft=null;sequence++;});
  window.addEventListener('hashchange',()=>{closeConfirmation();if($('#nft-dialog').open)$('#nft-dialog').close();});
  text('.network-tag','Local · Anvil 31337');text('.demo-label','LOCAL CONTRACT TEST');
  text('.demo-banner-copy span','Disposable test assets · real local transactions · mock venue, prices and randomness');
  text('[data-view="my-nfts"] .page-heading p:last-child','Your confirmed local holdings, attached LP and funded fee rights.');
  text('#portfolio-disconnected > p:last-of-type','Choose a disposable local wallet. No extension, private key or public funds are needed.');
  text('.portfolio-account .small-note','Confirmed local contract state');
  text('.portfolio-footnote p','Earnings use today’s prices and actual processed allocations. LP claimable includes individual + collective rewards. Royalties and lifetime claims retain their currency; unavailable prices are never treated as zero.');
  text('#portfolio-connected .metric-grid article:first-child > span:last-child','Current on-chain value, including attributed idle/compound');
  $$('#portfolio-connected .metric-grid article:nth-child(2) > span:last-child, #portfolio-connected .metric-grid article:nth-child(3) > span:last-child').forEach(n=>n.textContent='LP rewards + royalties at today’s price');
  text('#mint-form .mono','LOCAL CONTRACT');text('[data-view="mint"] .subtle-pill','LOCAL MINT');
  text('#mint-form .mint-flow span:last-child','02 · Activate with ZZZ, USDG, USDC or ETH');
  text('#mint-form > p.small-note','Mint a dormant NFT, then activate with exactly $100 in value. Local mock feed: $1 per token.');
  text('#mint-form .mint-summary > div:first-child span','Minted · local chain');
  text('#mint-form .mint-summary > div:nth-child(2) span','Mint price · test ETH');
  text('#mint-form .mint-summary > div:last-child b','$100 in value');
  text('#mint-form .checkbox-label span','I understand this sends a local transaction. Activation attaches nonredeemable LP; only funded rewards can be claimed.');
  text('.mint-disclaimer','Review each transaction and its separate gas. The artwork controls explore designs; the contract assigns your actual traits using local mock randomness.');
  text('#nft-dialog .eyebrow','CONFIRMED LOCAL POSITION');
  text('.collection-analytics .small-note','');$('.collection-analytics').hidden=true;
  text('[data-view="collection"] .metric-grid article:nth-child(2) > span:last-child','Actual processed local revenue');
  text('.compact-metrics-values > div:last-child span','Pool volume · 24h');text('.compact-metrics-values > div:last-child strong','Unavailable');
  text('.artwork-explainer > div:last-child p','1,000 total supply · local fixture capped at 20 mints.');
  const liveFaq=$$('.faq-list details').find(d=>d.querySelector('summary').textContent==='Is this live?');
  if(liveFaq)liveFaq.querySelector('p').textContent='This local website submits to its own disposable Anvil chain. The actual core contracts are used with a mock LP venue, test feeds and mock randomness. Public-chain integration and production approval remain open.';
  $('#reset-demo').hidden=true;

  function updateWallet() {
    $$('.wallet-button').forEach(n=>n.textContent=c.account?`${c.browser?'Wallet':'Local'} · ${short(c.account)}`:c.browser?'Connect browser wallet ↗':'Choose test wallet ↗');
    $('#wallet-connected-actions').hidden=!c.account;
    text('#connected-wallet-description',c.account?`Local wallet: ${c.account}`:'');
    const count=c.state?.nfts.length;
    text('#mint-supply',count==null?'Unavailable':`${count} / 1,000`);
    text('#mint-remaining',count==null?'Waiting for confirmed state':`${20-count} more mints in this disposable session · production supply 1,000`);
    $('#mint-submit').type=c.account?'submit':'button';$('#mint-submit').disabled=blocked()||count>=20;
    text('#mint-submit',busy?'Processing…':c.account?'Review local mint ↗':c.browser?'Connect browser wallet ↗':'Choose test wallet ↗');
    if($('#wallet-dialog').open)renderWalletOptions();
  }
  function renderWalletOptions() {
    if(c.browser) {
      const localChain=typeof c.wallet?.state?.chainId==='string'&&c.wallet.state.chainId.toLowerCase()==='0x7a69';
      $('#wallet-providers').innerHTML=(c.providers.length?c.providers.map((p,i)=>`<button type="button" class="wallet-option" data-browser-provider="${i}" ${busy?'disabled':''}><span class="wallet-option-icon">↗</span><span><strong>${e(p.name)}</strong><small>Sign with your wallet · disposable Anvil only</small></span></button>`).join(''):'<p class="small-note">Open this page in Chrome with MetaMask or another compatible wallet installed.</p>')+
        (c.manifest?`<p class="small-note">RPC: <code>${e(c.manifest.rpc_url)}</code><br>Chain ID: 31337. Use a disposable fixture account: ${c.accounts.map(e).join(' or ')}.</p>`:'')+
        (c.wallet?.provider?(localChain?`<p class="small-note">${c.connectionVerified?'PoPL local network selected.':'Chain 31337 selected; connection not verified.'}</p>`:`<button class="button button-secondary" data-browser-network ${busy?'disabled':''}>Switch to the local network</button>`):'')+
        `<p class="form-message${c.connectionError?' is-error':''}" role="status" aria-live="polite">${e(c.connectionError||(busy?'Confirm the connection in your wallet…':''))}</p><a class="text-link" href="./#my-nfts">Use service test wallets instead ↗</a>`;
      return;
    }
    if(!c.accounts.length){$('#wallet-providers').innerHTML=`<p class="small-note" role="status">${busy?'Loading test wallets and confirmed positions…':'Local state is unavailable. Refresh to load the test wallets.'}</p><button class="text-link" data-local-refresh ${busy?'disabled':''}>${busy?'Loading…':'Refresh ↻'}</button>`;return;}
    $('#wallet-providers').innerHTML=c.accounts.map((a,i)=>`<button type="button" class="wallet-option" data-local-account="${a}" ${c.pending||busy&&!stale?'disabled':''}><span class="wallet-option-icon">◇</span><span><strong>Test wallet ${i===0?'A':'B'}</strong><small>${a}</small></span><span>→</span></button>`).join('')+'<a class="text-link" href="./?wallet=browser#my-nfts">Use a browser wallet ↗</a>';
  }
  function openWallet() {
    closeConfirmation();$('#nft-dialog').close();text('#wallet-title',c.browser?'Connect your browser wallet.':'Choose a local wallet.');
    text('#wallet-dialog .dialog-intro',c.browser?'Your wallet signs and submits. The local service prepares unsigned calls and reads receipts.':'Disposable Anvil accounts. This local service submits only to its own test chain.');
    text('#wallet-dialog > .small-note',c.browser?'This profile only accepts the displayed disposable Anvil chain.':'No browser wallet or public funds are accessed.');$('#demo-wallet').hidden=true;
    renderWalletOptions();updateWallet();if(!$('#wallet-dialog').open)$('#wallet-dialog').showModal();
  }
  function renderPortfolio() {
    $('#portfolio-disconnected').hidden=Boolean(c.account);$('#portfolio-connected').hidden=!c.account;
    const retain=stale&&busy&&refreshScope?.session===c.session?.token&&refreshScope?.account===c.account;
    text('#portfolio-label',stale&&!retain?(busy?'READING CONTRACTS':'STATE UNAVAILABLE'):c.account?'LOCAL CONTRACT PORTFOLIO':'CHOOSE A LOCAL WALLET');
    text('.portfolio-account .small-note',retain?`Last confirmed block ${lastSnapshot?.protocol.provenance.block_number??''} · refreshing transaction results`:'Confirmed local contract state');
    if(!c.account)return;
    const pendingText=busy?'Updating…':'Unavailable';
    if(c.state&&!stale){lastSnapshot=c.state;lastSnapshotSession=c.session.token;}
    const items=stale?(lastSnapshotSession===c.session?.token?lastSnapshot?.nfts.filter(n=>n.owner===c.account)||[]:[]):owned();text('#portfolio-address',`Local wallet · ${short(c.account)}`);
    text('#my-liquidity',stale&&!retain?pendingText:usd(sum(items.map(lpValue))));
    text('#my-fees-all',stale&&!retain?pendingText:usd(sum(items.map(n=>earned(n,'all_time')))));
    text('#my-fees-day',stale&&!retain?pendingText:usd(sum(items.map(n=>earned(n,'last_24h')))));
    text('#my-claimable',stale&&!retain?pendingText:balances(items.flatMap(claimRows)));
    text('#my-count',stale&&!retain?(busy?'Updating confirmed positions…':'Refresh before making a transaction'):`${items.length} NFTs · ${items.filter(n=>n.position.activated).length} active`);
    const claimCount=items.filter(hasClaim).length;
    $('#claim-all').hidden=false;$('#claim-all').disabled=blocked()||!claimCount;
    text('#claim-all',claimCount>10?'Review claims · next 10 NFTs':'Review claim all ↗');
    withArtworkContinuity($('#owned-nfts'),()=>{
      $('#owned-nfts').setAttribute('aria-busy',String(stale&&busy&&!retain));
      $('#owned-nfts').innerHTML=items.length?items.map(n=>{
        const labels=refreshLabels(n.token_id,refreshScope,{stale,busy,session:c.session?.token,account:c.account});
        const art=artFor(n);if(art)preloadEvolutions(art);
        return `<article class="nft-card" data-local-position="${n.token_id}" aria-busy="${Boolean(labels.lp||labels.rewards||labels.history)}"><div class="nft-card-art">${buttonArt(n)}${labels.artwork?`<span class="local-art-status" role="status">${busy?'Updating · last confirmed artwork':'Last confirmed artwork · refresh required'}</span>`:''}</div><div class="nft-card-body"><div class="nft-card-title"><h3>PoPL #${n.mint_ordinal}</h3><span class="level-badge">${e(n.position.evolution||'Unavailable')}</span></div><div class="nft-card-traits">${traits(n)}</div>${positionRows(n,labels)}${n.position.activated?'':`<div class="position-buttons"><button class="button" data-local-id="${n.token_id}" data-local-grow ${blocked()?'disabled':''}>Activate ↗</button></div>`}${n.position.activated?`<div class="local-position-actions"><button class="button" data-local-action="claim" data-local-token="${n.token_id}" ${blocked()||!hasClaim(n)?'disabled':''}>Claim</button><button class="button button-secondary" data-local-id="${n.token_id}" data-local-grow ${blocked()?'disabled':''}>Grow attached LP</button></div>`:''}</div><button class="nft-card-detail-link" data-local-id="${n.token_id}" ${stale?'disabled':''}><span>Position & reward breakdown</span><span>↗</span></button></article>`;}).join(''):stale?`<p class="local-empty" role="status">${busy?'Reading your confirmed positions…':'Confirmed state unavailable. Refresh balances to recover; do not repeat an already confirmed transaction.'}</p>`:'<p class="local-empty">No NFTs owned by this wallet. Mint one or transfer an NFT from the other local wallet.</p>';
      if(stale)$('#owned-nfts').querySelectorAll('.art-image-button').forEach(b=>b.disabled=true);
    });
  }
  function traits(n) {
    const art=artFor(n),style=COLORWAYS[n.traits?.palette]?.colorStyle;return (art?`<span class="rarity-tag">${e(art.rarityLabel)}</span><span>${e(({monochrome:"Monochrome",bicolor:"Bicolor",tricolor:"Tricolor"})[style]||"Unknown style")}</span>${paletteTrait(art.colors)}`:'<span>Traits or current evolution unavailable</span>')+royaltyTrait(n);
  }
  function renderMetrics() {
    const s=c.state,values={};
    if(s&&!stale){
      values.liquidity=usd(sum(s.nfts.map(lpValue)));values.activeRatio=`${s.nfts.filter(n=>n.position.activated).length} / ${s.nfts.length}`;values.dormant=s.nfts.filter(n=>!n.position.activated).length;
      values.feesAllTime=usd(s.earnings?.all_time_usd_at_current_price_18?.lp_processed ?? null);values.fees24h=usd(s.earnings?.last_24h_usd_at_current_price_18?.lp_processed ?? null);
    }
    $$('[data-metric]').forEach(n=>n.textContent=values[n.dataset.metric]??(busy?'Updating…':'Unavailable'));
    const n=s?.nfts.find(n=>n.position.activated),art=n&&artFor(n);
    if(art&&!stale){
      text('.overview-position-card h2',`PoPL #${n.mint_ordinal}`);
      // Locate the title by its original content when the card class changes.
      const title=$$('h2').find(el=>/^PoPL #/.test(el.textContent));if(title)title.textContent=`PoPL #${n.mint_ordinal}`;
      text('#overview-example-lp',usd(lpValue(n)));text('#overview-example-state',`${art.evolutionLabel} · ${art.rarityLabel}`);
      $('#overview-example-image').src=art.src;$('#overview-example-image').alt=`${art.colorLabel} ${art.evolutionLabel}`;
      delete $('#overview-example-art').dataset.nftId;$('#overview-example-art').dataset.localId=n.token_id;
    }else{text('#overview-example-lp',busy?'Updating…':'Unavailable');$('#overview-example-art').disabled=true;}
    if(n&&!stale)$('#overview-example-art').disabled=false;
  }
  function renderCollection() {
    if(stale){$('#positions-body').innerHTML=`<tr><td colspan="5">${busy?'Updating confirmed collection…':'Confirmed local collection unavailable. Refresh to inspect it.'}</td></tr>`;return;}
    const query=$('#nft-search').value.trim().replace(/^#/,'');
    let items=c.state.nfts.filter(n=>{
      const art=artFor(n),value=id=>$(id).value;
      return (!query||String(n.mint_ordinal).includes(query)||n.token_id.includes(query))&&(value('#status-filter')==='all'||(value('#status-filter')==='active')===n.position.activated)
        &&(value('#rarity-filter')==='all'||n.traits?.rarity.toLowerCase()===value('#rarity-filter'))&&(value('#color-filter')==='all'||art?.colors.includes(value('#color-filter')))&&(value('#color-style-filter')==='all'||art?.colorStyle===value('#color-style-filter'));
    });
    const sort=$('#sort-positions').value;
    if(sort==='newest')items.sort((a,b)=>b.mint_ordinal-a.mint_ordinal);
    if(['liquidity','fees'].includes(sort))items.sort((a,b)=>{const v=n=>BigInt((sort==='liquidity'?lpValue(n):earned(n,'all_time'))||'0');return v(a)===v(b)?0:v(a)>v(b)?-1:1;});
    const pages=Math.max(1,Math.ceil(items.length/8));page=Math.max(1,Math.min(page,pages));
    $('#positions-body').innerHTML=items.slice((page-1)*8,page*8).map(n=>`<tr><td><div class="position-identity"><div class="position-art">${buttonArt(n)}</div><div><span class="nft-name">PoPL #${n.mint_ordinal}</span><span class="position-traits">${e(n.traits?.rarity||'Unrevealed')} · ${e(n.position.evolution||'Unavailable')}</span></div></div></td><td>${usd(lpValue(n))}</td><td>${usd(earned(n,'all_time'))}</td><td>${usd(earned(n,'last_24h'))}</td><td><button class="position-view" data-local-id="${n.token_id}" aria-label="View PoPL #${n.mint_ordinal}">↗</button></td></tr>`).join('')||'<tr><td colspan="5">No matching local NFTs.</td></tr>';
    text('#result-count',`${items.length} local positions`);text('#page-info',`Page ${page} of ${pages}`);$('#page-prev').disabled=page===1;$('#page-next').disabled=page===pages;
  }
  function details(id,mode='breakdown') {
    if(stale||!c.state)return;
    const n=c.state.nfts.find(n=>n.token_id===id);if(!n)return;
    selected=id;selectedMode=mode;
    const mine=n.owner===c.account,active=n.position.activated;
    const assets=(c.state.input_assets||[{symbol:'TEST-1',enabled:true}]).map(a=>({...a,enabled:a.enabled&&(a.symbol!=='ETH'||c.state.contribution_flow?.native_eth_atomic===true)}));
    const chosen=contributionAssets.get(id)||assets.find(a=>a.enabled)?.symbol;
    const contribution=mine&&mode==='contribute';
    let controls='';
    if(contribution) controls=`<form class="liquidity-form" novalidate data-local-contribution="${id}" data-local-kind="${active?'increase':'activate'}"><h3>${active?'Grow attached LP':'Activate your NFT'}</h3><label class="input-label">CONTRIBUTE WITH<select name="asset">${assets.map(a=>`<option value="${e(a.symbol)}" ${a.symbol===chosen?'selected':''} ${a.enabled?'':'disabled'}>${e(a.symbol)}${a.symbol==='ETH'&&!a.enabled?' · native test setup required':''}</option>`).join('')}</select></label><label class="input-label">${e(chosen)} AMOUNT<input name="amount" type="text" inputmode="numeric" value="${active?5:100}" ${active?'':'readonly'} required><span data-local-equivalent>${active?'5':'100'} ${e(chosen)} = $${active?'5':'100'} at the local mock price${active?' · minimum $5':' · fixed activation value'}</span></label><p class="small-note">Disposable local assets with $1 mock prices. At least 99% must become added LP; network gas is separate. ERC20: exact approval if needed, then one LP transaction. Native ETH: one atomic LP transaction in the native test setup. No public route is qualified.</p>${c.state.input_assets?'':'<p class="small-note">This older session supports TEST-1 only. ZZZ, USDG, USDC and ETH require the updated named-asset fixture; TEST-1 is not a substitute for them.</p>'}<label class="checkbox-label"><input name="consent" type="checkbox" required><span>The LP principal cannot be redeemed. Only funded fees can be claimed.</span></label><p class="local-form-feedback" data-local-feedback role="status" aria-live="polite"></p><button type="submit" class="button button-full" ${blocked()?'disabled':''}>Review ${active?'LP addition':'activation'} ↗</button></form>`;
    else if(mine)controls=`<div class="local-actions">${active?`<button class="button" data-local-action="claim" data-local-token="${id}" ${blocked()||!hasClaim(n)?'disabled':''}>Claim LP fees + royalties</button>`:''}<button class="button button-secondary" data-local-id="${id}" data-local-grow ${blocked()?'disabled':''}>${active?'Grow attached LP':'Activate your NFT'}</button></div>`;
    withArtworkContinuity($('#nft-dialog-content'),()=>{$('#nft-dialog-content').innerHTML=`<div class="nft-detail-art">${buttonArt(n)}</div><div class="nft-detail-heading"><h2 id="nft-details-title">PoPL #${n.mint_ordinal}</h2><span class="level-badge">${e(n.position.evolution||'Unavailable')}</span></div><div class="nft-detail-traits">${traits(n)}</div>${contribution?`<div class="position-attached-lp"><span>LP attached</span><strong>${usd(lpValue(n))}</strong></div>`:positionFinancialDetails(n)}${controls}`;});
    const input=$('#nft-dialog [name="amount"]'),consent=$('#nft-dialog [name="consent"]'),asset=$('#nft-dialog [name="asset"]');
    if(input&&active&&contributionAmounts.has(id))input.value=contributionAmounts.get(id);
    if(input)updateContributionQuote(input.form);
    if(input&&sameContribution(approvedContribution,{session:c.session.token,account:c.account,id,amount:input.value,asset:asset.value})){
      consent.checked=true;$('#nft-dialog [data-local-feedback]').textContent='Previous step confirmed. Review the next transaction to finish adding LP.';
    }
    if(!$('#nft-dialog').open)$('#nft-dialog').showModal();
  }
  function render(){
    updateWallet();renderPortfolio();renderMetrics();renderCollection();
    if(c.browser){
      let recovery=bar.querySelector('[data-browser-recovery]');
      if(c.pending){
        if(!recovery){recovery=document.createElement('div');recovery.dataset.browserRecovery='';bar.append(recovery);}
        const entered=recovery.querySelector('input')?.value||'';
        recovery.innerHTML=c.pending.hash?`<small>Saved transaction: ${e(c.pending.hash)} · Refresh checks this transaction only.</small>`:'<label class="input-label">Inspect your wallet activity. If sent, paste its transaction hash to recover.<input data-browser-hash placeholder="0x…" maxlength="66"></label>';
        if(recovery.querySelector('input'))recovery.querySelector('input').value=entered;
      } else recovery?.remove();
    }
    $$('[data-local-refresh]').forEach(n=>n.disabled=busy);
  }
  async function refresh() {
    if(busy)return;busy=true;stale=true;
    refreshScope=c.account&&lastSnapshotSession===c.session?.token?{session:c.session.token,account:c.account,action:'refresh',ids:[]}:null;
    closeConfirmation();$('#nft-dialog').close();status('Refreshing confirmed balances…');render();
    try{const recovered=await c.refresh();stale=false;updatingNFT=null;status(`${recovered?'Recovered '+recovered.status+' operation. ':''}Local block ${c.state.protocol.provenance.block_number} · ETH USD price unavailable · no public funds`);}
    catch(err){status(`${err.message}. Refresh to recover confirmed state.`,true);}
    finally{busy=false;if(!stale)refreshScope=null;render();}
  }
  async function browserConnect(index,network=false) {
    if(busy)return;
    let connected=false;
    busy=true;c.connectionError=null;closeConfirmation();status(network?'Confirm the local network in your wallet…':'Choose the disposable account in your wallet…');render();
    try {
      if(network)await c.setupNetwork();else await c.connect(index);
      if(c.account&&!c.connectionError){connected=true;$('#wallet-dialog').close();status('Browser wallet connected. Refreshing confirmed positions…');}
    }catch(error){c.connectionError=c.connectionError||error.message;status(c.connectionError,true);}
    finally{busy=false;render();}
    if(connected)await refresh();
  }
  function updateContributionQuote(form) {
    const symbol=form.elements.asset.value,amount=form.elements.amount.value;
    form.elements.amount.parentElement.firstChild.textContent=`${symbol} AMOUNT`;
    form.querySelector('[data-local-equivalent]').textContent=`${amount||'0'} ${symbol} = $${amount||'0'} at the local $1 mock price · ${form.dataset.localKind==='activate'?'fixed $100 activation':'minimum $5'}`;
  }
  async function prepare(action,extras={}) {
    if(blocked()){status(busy?'A local operation is already running. Please wait.':'Refresh confirmed balances before reviewing a transaction.',true);return;}if(!c.account)return openWallet();
    if(extras.id)selected=extras.id;busy=true;const current=++sequence;render();contributionBusy(true);status('Preparing your transaction and estimating gas. Nothing has been sent…');
    try {
      const draft=await c.prepare(action,extras);if(sequence!==current)return;
      confirmDraft={...draft,targetId:extras.id||null,contributionContext:['activate','increase'].includes(action)?{session:c.session.token,account:c.account,id:extras.id,amount:extras.amount,asset:extras.asset||'TEST-1'}:null};$('#nft-dialog').close();
      const claims=draft.claims.map(a=>`${units(a.simulated_raw,a.decimals)} ${a.symbol} (${a.royalty?'royalties':'LP fees'})`).join(' + ');
      const recipient=draft.action==='transfer'?row('New NFT owner',c.state.accounts.find(a=>a!==draft.account)):'';
      dialog.innerHTML=`<div class="dialog-heading"><p class="eyebrow">LOCAL WALLET · ANVIL 31337</p><button class="icon-button" data-local-cancel aria-label="Cancel transaction">×</button></div><h2>${({wrap:'Wrap test ETH',approve:(draft.approval_raw==='0'?'Reset allowance · ':'Approve ')+(draft.approval_asset||(draft.contribution_asset==='ETH'?'WETH':draft.contribution_asset)||'TEST-1'),activate:'Activate your NFT',increase:'Add attached LP',mint:'Mint a dormant NFT',claim:'Claim funded fees',transfer:'Transfer your NFT'})[draft.action]}</h2><p class="small-note">${draft.action==='wrap'?'Unsupported legacy wrapping step. Use the native-ETH setup.':draft.action==='approve'?'Exact token allowance only; no LP is added yet. Next: review and confirm the single LP transaction.':draft.action==='transfer'?'Attached LP and all unclaimed rights follow the NFT to the other local wallet.':'Exact calldata simulated against the local deployment. Confirmation expires in 60 seconds.'}</p><div class="nft-detail-rewards">${row('Wallet',short(draft.account))}${row('To',draft.transaction.to)}${recipient}${row('Value',units(BigInt(draft.transaction.value).toString())+' test ETH')}${draft.contribution?row('Contribution',draft.contribution+' '+(draft.contribution_asset||'TEST-1')):''}${!['approve','wrap'].includes(draft.action)&&draft.minimum_lp_usd_18?row('Minimum LP added · 99%',usd(draft.minimum_lp_usd_18)):''}${draft.action==='approve'&&draft.approval_raw==='0'?row('Allowance','Reset to zero before exact approval'):''}${claims?row('Simulated claim',claims):''}${row('Network gas · separate maximum',units(draft.network_gas.max_cost_wei,18,12)+' test ETH')}</div><details><summary>Transaction details</summary><code class="local-id">${e(draft.transaction.data)}</code></details><div class="local-actions"><button class="button button-secondary" data-local-cancel>Cancel</button><button class="button" data-local-confirm>${c.browser?'Confirm in your wallet':'Confirm local transaction'}</button></div>`;
      dialog.showModal();status('Review the confirmation. No transaction has been sent.');
    }catch(err){status(err.message,true);}
    finally{busy=false;render();contributionBusy(false);}
  }
  async function execute() {
    if(!confirmDraft||busy)return;const draft=confirmDraft;let outcome=null;
    const previous=c.state?.nfts.find(n=>n.token_id===draft.targetId),session=c.session.token,account=c.account;
    if(['activate','increase'].includes(draft.action))armUpgradeSound();confirmDraft=null;dialog.innerHTML='<h2>Confirming transaction…</h2><p role="status">Waiting for the local receipt and confirmed balances. Keep this window open; do not repeat the transaction.</p>';refreshScope=operationScope(draft,c.session.token,c.account);busy=true;render();status(c.browser?'Confirm the exact transaction in your browser wallet…':'Submitting to the disposable local chain…');
    try {
      outcome=await c.execute(draft);
      if(outcome.status==='confirmed'&&['approve','wrap'].includes(draft.action))approvedContribution=draft.contributionContext;
      if(outcome.status==='confirmed'&&['activate','increase'].includes(draft.action)){approvedContribution=null;updatingNFT=draft.contributionContext?.id||null;}
      stale=true;render();
      status(outcome.status==='confirmed'?`Confirmed ${draft.action}. Reading updated balances…`:`Transaction failed: ${outcome.error}`,outcome.status!=='confirmed');
      await c.refresh();stale=false;
      const next=c.state?.nfts.find(n=>n.token_id===draft.targetId);
      if(session===c.session.token&&account===c.account&&previous&&next?.position.activated&&confirmedUpgrade({action:draft.action,confirmed:outcome?.status==='confirmed',before:previous.position.evolution,after:next.position.evolution,previousLP:lpValue(previous),currentLP:lpValue(next)}))queueUpgrade(draft.targetId,draft.action);
      const hashes=outcome.transactions.join(', ');
      status(`${outcome.status==='confirmed'?'Confirmed '+draft.action:outcome.error}${draft.action==='approve'?' · Approval confirmed. Preparing the next step; LP is not added yet.':''} · ${hashes}`,outcome.status!=='confirmed');
      if(outcome.status==='confirmed'&&draft.action==='mint')location.hash='my-nfts';
      if(outcome.status==='confirmed'&&!['approve','wrap'].includes(draft.action))dialog.close();
      if(outcome.status==='confirmed'&&['activate','increase','claim'].includes(draft.action)&&draft.targetId&&selected)details(selected,['approve','wrap'].includes(draft.action)?'contribute':'breakdown');
    }catch(err){
      if(!outcome&&err.rejected&&!c.pending) {
        stale=true;status('State changed in another wallet. Refreshing before a new review…');
        try{await c.refresh();stale=false;status('Nothing was submitted. Review the transaction again using the updated balances.');}
        catch(readError){status(`${readError.message}. Refresh confirmed balances before reviewing again.`,true);}
      } else {stale=true;status(outcome?.status==='confirmed'?`Confirmed ${draft.action}. Balance refresh failed: ${err.message}. Refresh balances only; do not repeat this transaction. · ${outcome.transactions.join(', ')}`:`${err.message}. Refresh to recover; do not submit a new action.`,true);}}
    finally{busy=false;if(!stale){updatingNFT=null;refreshScope=null;}render();if(!stale&&$('#nft-dialog').open&&selected)details(selected,selectedMode);
      if(!stale&&outcome?.status==='confirmed'&&['activate','increase'].includes(draft.action)&&$('#nft-dialog').open&&selected===draft.targetId)$('#nft-dialog').scrollTo({top:0,behavior:'instant'});
    }
    if(!stale&&outcome?.status==='confirmed'&&['approve','wrap'].includes(draft.action)&&session===c.session.token&&account===c.account&&dialog.open){
      const context=draft.contributionContext;
      if(context)await prepare(draft.requested_action,{id:context.id,amount:context.amount,asset:context.asset});
    }
    if(!confirmDraft&&dialog.open){dialog.innerHTML=`<h2>${c.pending?'Recover transaction status':'Review required'}</h2><p>${c.pending?'Your transaction is saved. Check its status using the same transaction hash; do not submit it again.':stale?'Refresh confirmed balances before preparing another transaction.':'Review the transaction again using the updated balances.'}</p>${c.browser&&c.pending&&!c.pending.hash?'<label class="input-label">Transaction hash from your wallet (if sent)<input data-browser-hash placeholder="0x…" maxlength="66"></label>':''}${stale?'<button class="button" data-local-refresh>Recover status</button>':''}<button class="button button-secondary" data-local-cancel>Close</button>`;}
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    const relevant=b.matches('[data-browser-provider],[data-browser-network],[data-connect],[data-local-id],[data-local-account],[data-local-action],[data-local-refresh],[data-local-cancel],[data-local-confirm],#disconnect-wallet,#demo-wallet,#mint-submit,#claim-all,#reset-demo,#page-next,#page-prev');
    if(!relevant)return;event.stopImmediatePropagation();
    if(b.id==='mint-submit'&&c.account&&!blocked())return;event.preventDefault();
    if(b.matches('[data-browser-provider]'))return void browserConnect(Number(b.dataset.browserProvider));
    if(b.matches('[data-browser-network]'))return void browserConnect(null,true);
    if(b.matches('[data-local-refresh]')){if(c.browser)c.recoveryHash=dialog.querySelector('[data-browser-hash]')?.value.trim()||bar.querySelector('[data-browser-hash]')?.value.trim()||null;return void refresh();}
    if(b.matches('[data-local-cancel]'))return closeConfirmation();
    if(b.matches('[data-local-confirm]'))return void execute();
    if(b.matches('[data-connect]')||b.id==='mint-submit')return openWallet();
    if(b.dataset.localId){details(b.dataset.localId,b.hasAttribute('data-local-grow')?'contribute':'breakdown');return;}
    if(b.dataset.localAccount){if(c.pending||busy&&!stale)return;try{c.select(b.dataset.localAccount);}catch(err){status(err.message,true);return;}$('#wallet-dialog').close();closeConfirmation();render();return;}
    if(b.id==='disconnect-wallet'){if(busy)return;try{c.select(null);}catch(err){status(err.message,true);return;}$('#wallet-dialog').close();closeConfirmation();render();return;}
    if(b.id==='claim-all')return void prepare('claim_all');
    if(b.dataset.localAction)return void prepare(b.dataset.localAction,{id:b.dataset.localToken});
    if(b.id==='page-next'||b.id==='page-prev'){page+=b.id==='page-next'?1:-1;renderCollection();}
  },true);
  document.addEventListener('submit',event=>{
    const f=event.target;if(f.id!=='mint-form'&&!f.matches('[data-local-contribution]'))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(f.matches('[data-local-contribution]')){
      const message=contributionError(f.elements.amount.value,f.elements.consent.checked,f.dataset.localKind);
      if(message){status(message,true);f.reportValidity();return;}
    }else if(!f.reportValidity())return;
    if(f.id==='mint-form')void prepare('mint');else {contributionAmounts.set(f.dataset.localContribution,f.elements.amount.value);contributionAssets.set(f.dataset.localContribution,f.elements.asset.value);void prepare(f.dataset.localKind,{id:f.dataset.localContribution,amount:f.elements.amount.value,...(c.state.input_assets?{asset:f.elements.asset.value}:{})});}
  },true);
  document.addEventListener('input',event=>{
    const f=event.target.closest('[data-local-contribution]');if(!f)return;
    updateContributionQuote(f);approvedContribution=null;
    if(['amount','asset'].includes(event.target.name))f.elements.consent.checked=false;
    const feedback=f.querySelector('[data-local-feedback]');feedback.textContent='';feedback.classList.remove('is-error');
  });
  c.onSession=()=>{updateWallet();renderPortfolio();};
  if(c.browser){
    text('#portfolio-disconnected > p:last-of-type','Connect a browser wallet to the displayed disposable Anvil chain.');
    c.onWalletChange=()=>{if(!busy)closeConfirmation();sequence++;approvedContribution=null;render();};
  }
  return {updateWallet,renderPortfolio,renderMetrics,renderCollection,openWallet,refresh,details,render,registerProvider:item=>{c.registerProvider?.(item);}};
}
