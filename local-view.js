import {LocalClient,escape as e,units,usd,sum,balances,hasClaim} from './local-client.js';
import {COLORWAYS,PATTERNS,RARITIES,findArtwork} from './artworks.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const short=a=>`${a.slice(0,6)}…${a.slice(-4)}`;
const text=(s,value)=>{const n=$(s);if(n)n.textContent=value;};
const lpValue=n=>n.position.current_lp_value.available?n.position.current_lp_value.raw:null;
const earned=(n,period)=>n.earnings?.available?sum(['lp_individual','lp_collective'].map(k=>n.earnings[period+'_usd_at_current_price_18'][k])):null;
const artFor=n=>n.traits_ready&&n.position.evolution_value_available?findArtwork(`${COLORWAYS[n.traits.palette]?.id}-${PATTERNS[n.traits.pattern]?.id}-${n.traits.rarity.toLowerCase()}-${n.position.evolution}`):null;
const buttonArt=n=>{const art=artFor(n);return art?`<button class="art-image-button" data-local-id="${n.token_id}" aria-label="View PoPL #${n.mint_ordinal}"><img class="nft-artwork" src="${art.src}" alt="${e(art.colorLabel+' '+art.rarityLabel+' '+art.evolutionLabel)}" width="1024" height="1024" loading="lazy"><span class="art-enlarge">↗</span></button>`:'<div class="local-art-unavailable">Artwork state unavailable</div>';};
const row=(label,value)=>`<div><span>${label}</span><b>${e(value)}</b></div>`;
const claimRows=n=>[...n.claimable.lp,...n.claimable.royalties];
export const royaltyTrait=n=>{
  const multiplier=n.traits_ready?RARITIES.find(r=>r.label===n.traits.rarity)?.royaltyMultiplier:null;
  const active=n.position.activated;
  return `<span class="royalty-trait${active?'':' is-dormant'}" title="${active?'Rarity multiplier for NFT-sale royalties':'Activate this NFT to enable its royalty share'}">Royalty weight ${multiplier?`×${multiplier}`:'· unrevealed'}</span>`;
};


export function contributionError(amount, consent) {
  if(typeof amount!=='string'||!(/^[1-9][0-9]{2,4}$/).test(amount))return 'Enter a whole amount from 100 to 99,999 TEST-1.';
  if(consent!==true)return 'Tick the checkbox to confirm that the LP principal cannot be redeemed.';
  return null;
}
export const sameContribution=(a,b)=>Boolean(a&&b&&['session','account','id','amount'].every(key=>a[key]===b[key]));

// Pending displays keep identity/artwork only, never cached financial values.
export function positionRows(n, pendingLabel=null) {
  const lp=`<div class="position-attached-lp"><span>LP attached</span><strong>${e(pendingLabel||usd(lpValue(n)))}</strong></div>`;
  if(!n.position.activated)return lp;
  // Sum the same currency exactly; never add unrelated token units or assume a price.
  return lp+claimTotal(n,pendingLabel);
}
function claimTotal(n,pendingLabel=null) {
  return `<div class="position-reward-total"><span>Rewards to claim</span><strong>${e(pendingLabel||balances(claimRows(n)))}</strong></div>`;
}
export function positionFinancialDetails(n) {
  const position=`<section class="position-breakdown"><h3>Attached liquidity</h3><div class="breakdown-rows">${row('LP attached',usd(lpValue(n)))}</div></section>`;
  if(!n.position.activated)return position+'<p class="small-note">Activate this NFT to start earning LP fees and royalties.</p>';
  const history=period=>n.earnings?.available?`<div class="breakdown-rows">${row('LP rewards',usd(earned(n,period)))}${row('Royalties earned',balances(n.earnings[period],'royalties_raw'))}</div>`:'<p class="small-note">History unavailable</p>';
  return `<section class="position-breakdown claim-breakdown">${claimTotal(n)}<div class="breakdown-rows">${row('LP rewards',balances(n.claimable.lp))}${row('Royalties',balances(n.claimable.royalties))}</div></section>${position}<section class="position-breakdown"><h3>Earnings history</h3><details class="earnings-period"><summary>Last 24 hours <span>${usd(earned(n,'last_24h'))} LP fees</span></summary>${history('last_24h')}</details><details class="earnings-period"><summary>All time <span>${usd(earned(n,'all_time'))} LP fees</span></summary>${history('all_time')}</details><p class="small-note">LP history uses today’s available prices. Royalties are shown in their payment currency. Claims, transfers and conversions are not new income.</p></section><section class="position-breakdown"><h3>Previously claimed · all time</h3><div class="breakdown-rows">${row('LP rewards + royalties',n.previously_claimed.available?balances(n.previously_claimed.assets,'total_raw'):'Unavailable')}</div></section>`;
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
    const overlay=prior.cloneNode(false);overlay.className='nft-artwork local-art-previous';overlay.alt='';overlay.setAttribute('aria-hidden','true');
    button.append(overlay);
    const finish=()=>{
      if(!next.naturalWidth){overlay.remove();return;}
      // Two frames establish the overlay before fading, including cached images.
      requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add('is-revealed')));
      setTimeout(()=>overlay.remove(),850);
    };
    if(next.complete)finish();else {next.addEventListener('load',finish,{once:true});next.addEventListener('error',()=>overlay.remove(),{once:true});}
  }
}

export function createLocalView() {
  const c=new LocalClient();let busy=false,stale=true,page=1,selected=null,confirmDraft=null,sequence=0;
  const contributionAmounts=new Map();let lastSnapshot=null,lastSnapshotSession=null,approvedContribution=null,updatingNFT=null;
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
    f.setAttribute('aria-busy',String(value));f.querySelectorAll('input,button').forEach(n=>n.disabled=value||blocked());
    f.querySelector('[type="submit"]').textContent=value?'Preparing transaction…':`Review ${f.dataset.localKind==='activate'?'activation':'LP addition'} ↗`;
  };
  const blocked=()=>busy||stale||!c.state||c.state.uncertain||Boolean(c.pending);
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
  $$('#portfolio-connected .metric-grid article:nth-child(2) > span:last-child, #portfolio-connected .metric-grid article:nth-child(3) > span:last-child').forEach(n=>n.textContent='Individual + collective earnings at today’s price');
  text('#mint-form .mono','LOCAL CONTRACT');text('[data-view="mint"] .subtle-pill','LOCAL MINT');
  text('#mint-form .mint-flow span:last-child','02 · Activate with TEST-1');
  text('#mint-form > p.small-note','Mint a dormant NFT, then activate with 100 TEST-1. Local mock feed: $1 per token.');
  text('#mint-form .mint-summary > div:first-child span','Minted · local chain');
  text('#mint-form .mint-summary > div:nth-child(2) span','Mint price · test ETH');
  text('#mint-form .mint-summary > div:last-child b','100 TEST-1');
  text('#mint-form .checkbox-label span','I understand this sends a local transaction. Activation attaches nonredeemable LP; only funded rewards can be claimed.');
  text('.mint-disclaimer','Review each transaction and its separate gas. The artwork controls explore designs; the contract assigns your actual traits using local mock randomness.');
  text('#nft-dialog .eyebrow','CONFIRMED LOCAL POSITION');
  text('.collection-analytics .small-note','');$('.collection-analytics').hidden=true;
  text('[data-view="collection"] .metric-grid article:nth-child(2) > span:last-child','Actual processed local revenue');
  $$('.pool-filters button').forEach((n,i)=>{n.hidden=i>0;});text('.pool-filters button','TEST-1 / TEST-2');
  text('.compact-metrics-values > div:last-child span','Pool volume · 24h');text('.compact-metrics-values > div:last-child strong','Unavailable');
  text('.artwork-explainer > div:last-child p','1,000 total supply · local fixture capped at 20 mints.');
  const liveFaq=$$('.faq-list details').find(d=>d.querySelector('summary').textContent==='Is this live?');
  if(liveFaq)liveFaq.querySelector('p').textContent='This local website submits to its own disposable Anvil chain. The actual core contracts are used with a mock LP venue, test feeds and mock randomness. Public-chain integration and production approval remain open.';
  $('#reset-demo').hidden=true;

  function updateWallet() {
    $$('.wallet-button').forEach(n=>n.textContent=c.account?`Local · ${short(c.account)}`:'Choose test wallet ↗');
    $('#wallet-connected-actions').hidden=!c.account;
    text('#connected-wallet-description',c.account?`Local wallet: ${c.account}`:'');
    const count=c.state?.nfts.length;
    text('#mint-supply',count==null?'Unavailable':`${count} / 1,000`);
    text('#mint-remaining',count==null?'Waiting for confirmed state':`${20-count} more mints in this disposable session · production supply 1,000`);
    $('#mint-submit').type=c.account?'submit':'button';$('#mint-submit').disabled=blocked()||count>=20;
    text('#mint-submit',busy?'Processing…':c.account?'Review local mint ↗':'Choose test wallet ↗');
    if($('#wallet-dialog').open)renderWalletOptions();
  }
  function renderWalletOptions() {
    if(!c.accounts.length){$('#wallet-providers').innerHTML=`<p class="small-note" role="status">${busy?'Loading test wallets and confirmed positions…':'Local state is unavailable. Refresh to load the test wallets.'}</p><button class="text-link" data-local-refresh ${busy?'disabled':''}>${busy?'Loading…':'Refresh ↻'}</button>`;return;}
    $('#wallet-providers').innerHTML=c.accounts.map((a,i)=>`<button type="button" class="wallet-option" data-local-account="${a}" ${c.pending||busy&&!stale?'disabled':''}><span class="wallet-option-icon">◇</span><span><strong>Test wallet ${i===0?'A':'B'}</strong><small>${a}</small></span><span>→</span></button>`).join('');
  }
  function openWallet() {
    closeConfirmation();$('#nft-dialog').close();text('#wallet-title','Choose a local wallet.');
    text('#wallet-dialog .dialog-intro','Disposable Anvil accounts. This local service submits only to its own test chain.');
    text('#wallet-dialog > .small-note','No browser wallet or public funds are accessed.');$('#demo-wallet').hidden=true;
    renderWalletOptions();updateWallet();if(!$('#wallet-dialog').open)$('#wallet-dialog').showModal();
  }
  function renderPortfolio() {
    $('#portfolio-disconnected').hidden=Boolean(c.account);$('#portfolio-connected').hidden=!c.account;
    text('#portfolio-label',stale?(busy?'READING CONTRACTS':'STATE UNAVAILABLE'):c.account?'LOCAL CONTRACT PORTFOLIO':'CHOOSE A LOCAL WALLET');
    if(!c.account)return;
    const pendingText=busy?'Updating…':'Unavailable';
    if(c.state&&!stale){lastSnapshot=c.state;lastSnapshotSession=c.session.token;}
    const items=stale?(lastSnapshotSession===c.session?.token?lastSnapshot?.nfts.filter(n=>n.owner===c.account)||[]:[]):owned();text('#portfolio-address',`Local wallet · ${short(c.account)}`);
    text('#my-liquidity',stale?pendingText:usd(sum(items.map(lpValue))));
    text('#my-fees-all',stale?pendingText:usd(sum(items.map(n=>earned(n,'all_time')))));
    text('#my-fees-day',stale?pendingText:usd(sum(items.map(n=>earned(n,'last_24h')))));
    text('#my-claimable',stale?pendingText:balances(items.flatMap(claimRows)));
    text('#my-count',stale?(busy?'Updating confirmed positions…':'Refresh before making a transaction'):`${items.length} NFTs · ${items.filter(n=>n.position.activated).length} active`);
    const claimCount=items.filter(hasClaim).length;
    $('#claim-all').hidden=false;$('#claim-all').disabled=blocked()||!claimCount;
    text('#claim-all',claimCount>10?'Review claims · next 10 NFTs':'Review claim all ↗');
    withArtworkContinuity($('#owned-nfts'),()=>{
      $('#owned-nfts').setAttribute('aria-busy',String(stale&&busy));
      $('#owned-nfts').innerHTML=items.length?items.map(n=>`<article class="nft-card" data-local-position="${n.token_id}"><div class="nft-card-art">${buttonArt(n)}${stale&&n.token_id===updatingNFT?`<span class="local-art-status" role="status">${busy?'Updating · last confirmed artwork':'Last confirmed artwork · refresh required'}</span>`:''}</div><div class="nft-card-body"><div class="nft-card-title"><h3>PoPL #${n.mint_ordinal}</h3><span class="level-badge">${e(n.position.evolution||'Unavailable')}</span></div><div class="nft-card-traits">${traits(n)}</div>${positionRows(n,stale?pendingText:null)}${n.position.activated?'':`<div class="position-buttons"><button class="button" data-local-id="${n.token_id}" ${blocked()?'disabled':''}>Activate ↗</button></div>`}${n.position.activated?`<div class="local-position-actions"><button class="button" data-local-action="claim" data-local-token="${n.token_id}" ${blocked()||!hasClaim(n)?'disabled':''}>Claim</button><button class="button button-secondary" data-local-id="${n.token_id}" data-local-grow ${blocked()?'disabled':''}>Grow attached LP</button></div>`:''}</div><button class="nft-card-detail-link" data-local-id="${n.token_id}" ${stale?'disabled':''}><span>Position & reward breakdown</span><span>↗</span></button></article>`).join(''):stale?`<p class="local-empty" role="status">${busy?'Reading your confirmed positions…':'Confirmed state unavailable. Refresh balances to recover; do not repeat an already confirmed transaction.'}</p>`:'<p class="local-empty">No NFTs owned by this wallet. Mint one or transfer an NFT from the other local wallet.</p>';
      if(stale)$('#owned-nfts').querySelectorAll('.art-image-button').forEach(b=>b.disabled=true);
    });
  }
  function traits(n) {
    const art=artFor(n);return (art?`<span class="rarity-tag">${e(art.rarityLabel)}</span><span>${e(art.colorLabel)}</span><span>${e(art.patternLabel)}</span>`:'<span>Traits or current evolution unavailable</span>')+royaltyTrait(n);
  }
  function renderMetrics() {
    const s=c.state,values={};
    if(s&&!stale){
      values.liquidity=usd(sum(s.nfts.map(lpValue)));values.activeRatio=`${s.nfts.filter(n=>n.position.activated).length} / ${s.nfts.length}`;values.dormant=s.nfts.filter(n=>!n.position.activated).length;
      values.feesAllTime=usd(s.earnings.all_time_usd_at_current_price_18.lp_processed);values.fees24h=usd(s.earnings.last_24h_usd_at_current_price_18.lp_processed);
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
    if(stale){$('#positions-body').innerHTML=`<tr><td colspan="6">${busy?'Updating confirmed collection…':'Confirmed local collection unavailable. Refresh to inspect it.'}</td></tr>`;return;}
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
    $('#positions-body').innerHTML=items.slice((page-1)*8,page*8).map(n=>`<tr><td><div class="position-identity"><div class="position-art">${buttonArt(n)}</div><div><span class="nft-name">PoPL #${n.mint_ordinal}</span><span class="position-traits">${e(n.traits?.rarity||'Unrevealed')} · ${e(n.position.evolution||'Unavailable')}</span></div></div></td><td>TEST-1 / TEST-2</td><td>${usd(lpValue(n))}</td><td>${usd(earned(n,'all_time'))}</td><td>${usd(earned(n,'last_24h'))}</td><td><button class="position-view" data-local-id="${n.token_id}" aria-label="View PoPL #${n.mint_ordinal}">↗</button></td></tr>`).join('')||'<tr><td colspan="6">No matching local NFTs.</td></tr>';
    text('#result-count',`${items.length} local positions`);text('#page-info',`Page ${page} of ${pages}`);$('#page-prev').disabled=page===1;$('#page-next').disabled=page===pages;
  }
  function details(id) {
    if(stale)return;const n=c.state.nfts.find(n=>n.token_id===id);if(!n)return;selected=id;
    const mine=n.owner===c.account,active=n.position.activated;
    withArtworkContinuity($('#nft-dialog-content'),()=>{$('#nft-dialog-content').innerHTML=`<div class="nft-detail-art">${buttonArt(n)}</div><h2 id="nft-details-title">PoPL #${n.mint_ordinal}</h2><div class="nft-card-traits">${traits(n)}</div><p class="small-note">Owner ${e(n.owner)}<br>Full on-chain ID <span class="local-id">${n.token_id}</span></p>${positionFinancialDetails(n)}${mine?`<div class="local-actions">${active?`<button class="button" data-local-action="claim" data-local-token="${id}" ${blocked()||!hasClaim(n)?'disabled':''}>Claim LP fees + royalties</button>`:''}<button class="text-link" data-local-action="transfer" data-local-token="${id}" ${blocked()?'disabled':''}>Transfer to test wallet ${c.account===c.state.accounts[0]?'B':'A'} ↗</button></div><form class="liquidity-form" novalidate data-local-contribution="${id}" data-local-kind="${active?'increase':'activate'}"><h3>${active?'Grow attached LP':'Activate your NFT'}</h3><label class="input-label">TEST-1 AMOUNT · 100–99,999<input name="amount" type="text" inputmode="numeric" pattern="[1-9][0-9]{2,4}" value="100" required></label><p class="small-note">TEST-1 is a local $1 test token. At least 99% must become added LP; gas is separate. Approval does not activate the NFT.</p><label class="checkbox-label"><input name="consent" type="checkbox" required><span>The LP principal cannot be redeemed. Only funded fees can be claimed.</span></label><p class="local-form-feedback" data-local-feedback role="status" aria-live="polite"></p><button type="submit" class="button button-full" ${blocked()?'disabled':''}>Review ${active?'LP addition':'activation'} ↗</button></form>`:'<p class="small-note">Choose the wallet that owns this NFT to manage its position.</p>'}`;
    });
    const input=$('#nft-dialog [name="amount"]');if(input&&contributionAmounts.has(id))input.value=contributionAmounts.get(id);
    const consent=$('#nft-dialog [name="consent"]');
    if(consent&&sameContribution(approvedContribution,{session:c.session.token,account:c.account,id,amount:input.value})) {
      consent.checked=true;$('#nft-dialog [data-local-feedback]').textContent='Token approval confirmed. Review the LP transaction to finish.';
    }
    if(!$('#nft-dialog').open)$('#nft-dialog').showModal();
  }
  function render(){updateWallet();renderPortfolio();renderMetrics();renderCollection();$$('[data-local-refresh]').forEach(n=>n.disabled=busy);}
  async function refresh() {
    if(busy)return;busy=true;stale=true;closeConfirmation();$('#nft-dialog').close();status('Reading confirmed local contracts…');render();
    try{const recovered=await c.refresh();stale=false;updatingNFT=null;status(`${recovered?'Recovered '+recovered.status+' operation. ':''}Local block ${c.state.protocol.provenance.block_number} · ETH USD price unavailable · no public funds`);}
    catch(err){status(`${err.message}. Refresh to recover confirmed state.`,true);}
    finally{busy=false;render();}
  }
  async function prepare(action,extras={}) {
    if(blocked()){status(busy?'A local operation is already running. Please wait.':'Refresh confirmed balances before reviewing a transaction.',true);return;}if(!c.account)return openWallet();
    busy=true;const current=++sequence;render();contributionBusy(true);status('Preparing your transaction and estimating gas. Nothing has been sent…');
    try {
      const draft=await c.prepare(action,extras);if(sequence!==current)return;
      confirmDraft={...draft,contributionContext:['activate','increase'].includes(action)?{session:c.session.token,account:c.account,id:extras.id,amount:extras.amount}:null};$('#nft-dialog').close();
      const claims=draft.claims.map(a=>`${units(a.simulated_raw,a.decimals)} ${a.symbol} (${a.royalty?'royalties':'LP fees'})`).join(' + ');
      const recipient=draft.action==='transfer'?row('New NFT owner',c.state.accounts.find(a=>a!==draft.account)):'';
      dialog.innerHTML=`<div class="dialog-heading"><p class="eyebrow">LOCAL WALLET · ANVIL 31337</p><button class="icon-button" data-local-cancel aria-label="Cancel transaction">×</button></div><h2>${({approve:'Approve TEST-1',activate:'Activate your NFT',increase:'Add attached LP',mint:'Mint a dormant NFT',claim:'Claim funded fees',transfer:'Transfer your NFT'})[draft.action]}</h2><p class="small-note">${draft.action==='approve'?'Step 1: exact token allowance only. After confirmation, review the LP transaction separately.':draft.action==='transfer'?'Attached LP and all unclaimed rights follow the NFT to the other local wallet.':'Exact calldata simulated against the local deployment. Confirmation expires in 60 seconds.'}</p><div class="nft-detail-rewards">${row('Wallet',short(draft.account))}${row('To',draft.transaction.to)}${recipient}${row('Value',units(BigInt(draft.transaction.value).toString())+' test ETH')}${draft.contribution?row('Contribution',draft.contribution+' TEST-1'):''}${draft.action!=='approve'&&draft.minimum_lp_usd_18?row('Minimum LP added · 99%',usd(draft.minimum_lp_usd_18)):''}${claims?row('Simulated claim',claims):''}${row('Network gas · separate maximum',units(draft.network_gas.max_cost_wei,18,12)+' test ETH')}</div><details><summary>Transaction details</summary><code class="local-id">${e(draft.transaction.data)}</code></details><div class="local-actions"><button class="button button-secondary" data-local-cancel>Cancel</button><button class="button" data-local-confirm>Confirm local transaction</button></div>`;
      dialog.showModal();status('Review the confirmation. No transaction has been sent.');
    }catch(err){status(err.message,true);}
    finally{busy=false;render();contributionBusy(false);}
  }
  async function execute() {
    if(!confirmDraft||busy)return;const draft=confirmDraft;let outcome=null;closeConfirmation();busy=true;render();status('Submitting to the disposable local chain…');
    try {
      outcome=await c.execute(draft);
      if(outcome.status==='confirmed'&&draft.action==='approve')approvedContribution=draft.contributionContext;
      if(outcome.status==='confirmed'&&['activate','increase'].includes(draft.action)){approvedContribution=null;updatingNFT=draft.contributionContext?.id||null;}
      stale=true;render();
      status(outcome.status==='confirmed'?`Confirmed ${draft.action}. Reading updated balances…`:`Transaction failed: ${outcome.error}`,outcome.status!=='confirmed');
      await c.refresh();stale=false;
      const hashes=outcome.transactions.join(', ');
      status(`${outcome.status==='confirmed'?'Confirmed '+draft.action:outcome.error}${draft.action==='approve'?' · Approval only. Open the NFT and review its LP contribution next.':''} · ${hashes}`,outcome.status!=='confirmed');
      if(outcome.status==='confirmed'&&draft.action==='mint')location.hash='my-nfts';
      if(outcome.status==='confirmed'&&['approve','activate','increase','claim'].includes(draft.action)&&selected)details(selected);
    }catch(err){stale=true;status(outcome?.status==='confirmed'?`Confirmed ${draft.action}. Balance refresh failed: ${err.message}. Refresh balances only; do not repeat this transaction. · ${outcome.transactions.join(', ')}`:`${err.message}. Refresh to recover; do not submit a new action.`,true);}
    finally{busy=false;if(!stale)updatingNFT=null;render();if(!stale&&$('#nft-dialog').open&&selected)details(selected);}
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    const relevant=b.matches('[data-connect],[data-local-id],[data-local-account],[data-local-action],[data-local-refresh],[data-local-cancel],[data-local-confirm],#disconnect-wallet,#demo-wallet,#mint-submit,#claim-all,#reset-demo,#page-next,#page-prev');
    if(!relevant)return;event.stopImmediatePropagation();
    if(b.id==='mint-submit'&&c.account&&!blocked())return;event.preventDefault();
    if(b.matches('[data-local-refresh]'))return void refresh();
    if(b.matches('[data-local-cancel]'))return closeConfirmation();
    if(b.matches('[data-local-confirm]'))return void execute();
    if(b.matches('[data-connect]')||b.id==='mint-submit')return openWallet();
    if(b.dataset.localId){details(b.dataset.localId);if(b.hasAttribute('data-local-grow'))$('#nft-dialog [data-local-contribution]')?.scrollIntoView({block:'nearest'});return;}
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
      const message=contributionError(f.elements.amount.value,f.elements.consent.checked);
      if(message){status(message,true);f.reportValidity();return;}
    }else if(!f.reportValidity())return;
    if(f.id==='mint-form')void prepare('mint');else {contributionAmounts.set(f.dataset.localContribution,f.elements.amount.value);void prepare(f.dataset.localKind,{id:f.dataset.localContribution,amount:f.elements.amount.value});}
  },true);
  document.addEventListener('input',event=>{
    const f=event.target.closest('[data-local-contribution]');if(!f)return;
    approvedContribution=null;
    if(event.target.name==='amount')f.elements.consent.checked=false;
    const feedback=f.querySelector('[data-local-feedback]');feedback.textContent='';feedback.classList.remove('is-error');
  });
  c.onSession=()=>{updateWallet();renderPortfolio();};
  return {updateWallet,renderPortfolio,renderMetrics,renderCollection,openWallet,refresh,details,render};
}
