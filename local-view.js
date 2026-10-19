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
const royaltyBadge=n=>{
  const multiplier=n.traits_ready?RARITIES.find(r=>r.label===n.traits.rarity)?.royaltyMultiplier:null;
  const active=n.position.activated;
  return `<span class="local-royalty-weight${active?'':' is-dormant'}" title="${active?'Rarity multiplier for NFT-sale royalties':'Activate this NFT to enable its royalty share'}">ROYALTY WEIGHT<strong>${multiplier?`×${multiplier}`:'Unrevealed'}</strong></span>`;
};

export function createLocalView() {
  const c=new LocalClient();let busy=false,stale=true,page=1,selected=null,confirmDraft=null,sequence=0;
  const contributionAmounts=new Map();
  const bar=document.createElement('div');bar.className='container local-status';bar.innerHTML='<span role="status">Connecting to local contracts…</span><button class="text-link" data-local-refresh>Refresh ↻</button>';document.querySelector('main').before(bar);
  const dialog=document.createElement('dialog');dialog.className='dialog local-confirm';dialog.setAttribute('aria-label','Confirm local transaction');document.body.append(dialog);
  const css=document.createElement('link');css.rel='stylesheet';css.href='./local-view.css';document.head.append(css);
  const status=(message,error=false)=>{bar.firstElementChild.textContent=message;bar.classList.toggle('is-error',error);};
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
    $('#wallet-providers').innerHTML=(c.state?.accounts||[]).map((a,i)=>`<button type="button" class="wallet-option" data-local-account="${a}" ${blocked()?'disabled':''}><span class="wallet-option-icon">◇</span><span><strong>${i===0?'Holder':'Buyer'} wallet</strong><small>${a}</small></span><span>→</span></button>`).join('');
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
    const items=owned();text('#portfolio-address',`Local wallet · ${short(c.account)}`);
    text('#my-liquidity',stale?'Unavailable':usd(sum(items.map(lpValue))));
    text('#my-fees-all',stale?'Unavailable':usd(sum(items.map(n=>earned(n,'all_time')))));
    text('#my-fees-day',stale?'Unavailable':usd(sum(items.map(n=>earned(n,'last_24h')))));
    text('#my-claimable',stale?'Unavailable':balances(items.flatMap(claimRows)));
    text('#my-count',stale?'Refresh before making a transaction':`${items.length} NFTs · ${items.filter(n=>n.position.activated).length} active`);
    const claimCount=items.filter(hasClaim).length;
    $('#claim-all').hidden=false;$('#claim-all').disabled=blocked()||!claimCount;
    text('#claim-all',claimCount>10?'Review claims · next 10 NFTs':'Review claim all ↗');
    $('#owned-nfts').innerHTML=stale?'<p class="local-empty">Confirmed state unavailable. Use Refresh to recover; no example holdings are substituted.</p>':items.length?items.map(n=>`<article class="nft-card"><div class="nft-card-art">${buttonArt(n)}</div><div class="nft-card-body"><div class="nft-card-title"><h3>PoPL #${n.mint_ordinal}</h3><span class="level-badge">${e(n.position.evolution||'Unavailable')}</span></div><div class="nft-card-traits">${traits(n)}</div><div class="nft-card-details">${row('LP attached',usd(lpValue(n)))}${row('LP fees earned · all time',usd(earned(n,'all_time')))}${row('LP fees earned · 24h',usd(earned(n,'last_24h')))}${row('LP fees to claim',balances(n.claimable.lp))}${row('Royalties to claim',balances(n.claimable.royalties))}${row('Previously claimed · all time',n.previously_claimed.available?balances(n.previously_claimed.assets,'total_raw'):'Unavailable')}</div><div class="nft-card-claim">${royaltyBadge(n)}<button class="button" data-local-id="${n.token_id}">${n.position.activated?'Manage ↗':'Activate ↗'}</button></div></div><button class="nft-card-detail-link" data-local-id="${n.token_id}"><span>Position & reward breakdown</span><span>↗</span></button></article>`).join(''):'<p class="local-empty">No NFTs owned by this wallet. Mint one or transfer an NFT from the other local wallet.</p>';
  }
  function traits(n) {
    const art=artFor(n);return art?`<span class="rarity-tag">${e(art.rarityLabel)}</span><span>${e(art.colorLabel)}</span><span>${e(art.patternLabel)}</span>`:'<span>Traits or current evolution unavailable</span>';
  }
  function renderMetrics() {
    const s=c.state,values={};
    if(s&&!stale){
      values.liquidity=usd(sum(s.nfts.map(lpValue)));values.activeRatio=`${s.nfts.filter(n=>n.position.activated).length} / ${s.nfts.length}`;values.dormant=s.nfts.filter(n=>!n.position.activated).length;
      values.feesAllTime=usd(s.earnings.all_time_usd_at_current_price_18.lp_processed);values.fees24h=usd(s.earnings.last_24h_usd_at_current_price_18.lp_processed);
    }
    $$('[data-metric]').forEach(n=>n.textContent=values[n.dataset.metric]??'Unavailable');
    const n=s?.nfts.find(n=>n.position.activated),art=n&&artFor(n);
    if(art&&!stale){
      text('.overview-position-card h2',`PoPL #${n.mint_ordinal}`);
      // Locate the title by its original content when the card class changes.
      const title=$$('h2').find(el=>/^PoPL #/.test(el.textContent));if(title)title.textContent=`PoPL #${n.mint_ordinal}`;
      text('#overview-example-lp',usd(lpValue(n)));text('#overview-example-state',`${art.evolutionLabel} · ${art.rarityLabel}`);
      $('#overview-example-image').src=art.src;$('#overview-example-image').alt=`${art.colorLabel} ${art.evolutionLabel}`;
      delete $('#overview-example-art').dataset.nftId;$('#overview-example-art').dataset.localId=n.token_id;
    }else{text('#overview-example-lp','Unavailable');$('#overview-example-art').disabled=true;}
    if(n&&!stale)$('#overview-example-art').disabled=false;
  }
  function renderCollection() {
    if(stale){$('#positions-body').innerHTML='<tr><td colspan="6">Confirmed local collection unavailable. Refresh to inspect it.</td></tr>';return;}
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
    const history=period=>n.earnings?.available?`<div class="nft-detail-rewards">${row('Individual LP fees',usd(n.earnings[period+'_usd_at_current_price_18'].lp_individual))}${row('Collective LP fees',usd(n.earnings[period+'_usd_at_current_price_18'].lp_collective))}${row('Royalties earned',balances(n.earnings[period],'royalties_raw'))}</div>`:'<p>History unavailable</p>';
    $('#nft-dialog-content').innerHTML=`<div class="nft-detail-art">${buttonArt(n)}</div><h2 id="nft-details-title">PoPL #${n.mint_ordinal}</h2><div class="nft-card-traits">${traits(n)}</div><p class="small-note">Owner ${e(n.owner)}<br>Full on-chain ID <span class="local-id">${n.token_id}</span></p><div class="nft-detail-stats"><div><span>LP ATTACHED</span><strong>${usd(lpValue(n))}</strong></div><div><span>LP FEES · ALL TIME</span><strong>${usd(earned(n,'all_time'))}</strong></div><div><span>LP FEES · 24H</span><strong>${usd(earned(n,'last_24h'))}</strong></div></div><div class="nft-detail-rewards">${row('LP fees to claim · individual + collective',balances(n.claimable.lp))}${row('Royalties to claim',balances(n.claimable.royalties))}${row('Previously claimed · all LP + royalties',n.previously_claimed.available?balances(n.previously_claimed.assets,'total_raw'):'Unavailable')}</div><details class="manage-liquidity"><summary>Earnings breakdown · today’s prices</summary><h3>All time</h3>${history('all_time')}<h3>Last 24 hours</h3>${history('last_24h')}<p class="small-note">ETH USD price unavailable. Claims, transfers and conversions are not new income. Claimable LP components are reported as an exact combined balance.</p></details>${mine?`<div class="local-actions">${active?`<button class="button" data-local-action="claim" data-local-token="${id}" ${blocked()||!hasClaim(n)?'disabled':''}>Claim LP fees + royalties</button>`:''}<button class="text-link" data-local-action="transfer" data-local-token="${id}" ${blocked()?'disabled':''}>Transfer to ${c.account===c.state.accounts[0]?'Buyer':'Holder'} ↗</button></div><form class="liquidity-form" data-local-contribution="${id}" data-local-kind="${active?'increase':'activate'}"><h3>${active?'Grow attached LP':'Activate your NFT'}</h3><label class="input-label">TEST-1 AMOUNT · 100–99,999<input name="amount" type="text" inputmode="numeric" pattern="[1-9][0-9]{2,4}" value="100" required></label><p class="small-note">TEST-1 is a local $1 test token. At least 99% must become added LP; gas is separate. Approval does not activate the NFT.</p><label class="checkbox-label"><input name="consent" type="checkbox" required><span>The LP principal cannot be redeemed. Only funded fees can be claimed.</span></label><button class="button button-full" ${blocked()?'disabled':''}>Review ${active?'LP addition':'activation'} ↗</button></form>`:'<p class="small-note">Choose the wallet that owns this NFT to manage its position.</p>'}`;
    const input=$('#nft-dialog [name="amount"]');if(input&&contributionAmounts.has(id))input.value=contributionAmounts.get(id);
    if(!$('#nft-dialog').open)$('#nft-dialog').showModal();
  }
  function render(){updateWallet();renderPortfolio();renderMetrics();renderCollection();}
  async function refresh() {
    if(busy)return;busy=true;stale=true;closeConfirmation();$('#nft-dialog').close();status('Reading confirmed local contracts…');render();
    try{const recovered=await c.refresh();stale=false;status(`${recovered?'Recovered '+recovered.status+' operation. ':''}Local block ${c.state.protocol.provenance.block_number} · ETH USD price unavailable · no public funds`);}
    catch(err){status(`${err.message}. Refresh to recover confirmed state.`,true);}
    finally{busy=false;render();}
  }
  async function prepare(action,extras={}) {
    if(blocked())return;if(!c.account)return openWallet();
    busy=true;const current=++sequence;render();status('Simulating the exact local transaction and estimating gas…');
    try {
      const draft=await c.prepare(action,extras);if(sequence!==current)return;
      confirmDraft=draft;$('#nft-dialog').close();
      const claims=draft.claims.map(a=>`${units(a.simulated_raw,a.decimals)} ${a.symbol} (${a.royalty?'royalties':'LP fees'})`).join(' + ');
      const recipient=draft.action==='transfer'?row('New NFT owner',c.state.accounts.find(a=>a!==draft.account)):'';
      dialog.innerHTML=`<div class="dialog-heading"><p class="eyebrow">LOCAL WALLET · ANVIL 31337</p><button class="icon-button" data-local-cancel aria-label="Cancel transaction">×</button></div><h2>${({approve:'Approve TEST-1',activate:'Activate your NFT',increase:'Add attached LP',mint:'Mint a dormant NFT',claim:'Claim funded fees',transfer:'Transfer your NFT'})[draft.action]}</h2><p class="small-note">${draft.action==='approve'?'Step 1: exact token allowance only. After confirmation, review the LP transaction separately.':draft.action==='transfer'?'Attached LP and all unclaimed rights follow the NFT to the other local wallet.':'Exact calldata simulated against the local deployment. Confirmation expires in 60 seconds.'}</p><div class="nft-detail-rewards">${row('Wallet',short(draft.account))}${row('To',draft.transaction.to)}${recipient}${row('Value',units(BigInt(draft.transaction.value).toString())+' test ETH')}${draft.contribution?row('Contribution',draft.contribution+' TEST-1'):''}${draft.action!=='approve'&&draft.minimum_lp_usd_18?row('Minimum LP added · 99%',usd(draft.minimum_lp_usd_18)):''}${claims?row('Simulated claim',claims):''}${row('Network gas · separate maximum',units(draft.network_gas.max_cost_wei,18,12)+' test ETH')}</div><details><summary>Transaction details</summary><code class="local-id">${e(draft.transaction.data)}</code></details><div class="local-actions"><button class="button button-secondary" data-local-cancel>Cancel</button><button class="button" data-local-confirm>Confirm local transaction</button></div>`;
      dialog.showModal();status('Review the confirmation. No transaction has been sent.');
    }catch(err){status(err.message,true);}
    finally{busy=false;render();}
  }
  async function execute() {
    if(!confirmDraft||busy)return;const draft=confirmDraft;closeConfirmation();busy=true;render();status('Submitting to the disposable local chain…');
    try {
      const outcome=await c.execute(draft);stale=true;render();
      status(outcome.status==='confirmed'?`Confirmed ${draft.action}. Reading updated balances…`:`Transaction failed: ${outcome.error}`,outcome.status!=='confirmed');
      await c.refresh();stale=false;
      const hashes=outcome.transactions.join(', ');
      status(`${outcome.status==='confirmed'?'Confirmed '+draft.action:outcome.error}${draft.action==='approve'?' · Approval only. Open the NFT and review its LP contribution next.':''} · ${hashes}`,outcome.status!=='confirmed');
      if(outcome.status==='confirmed'&&draft.action==='mint')location.hash='my-nfts';
      if(outcome.status==='confirmed'&&['approve','activate','increase','claim'].includes(draft.action)&&selected)details(selected);
    }catch(err){stale=true;status(`${err.message}. Refresh to recover; do not submit a new action.`,true);}
    finally{busy=false;render();if(!stale&&$('#nft-dialog').open&&selected)details(selected);}
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
    if(b.dataset.localId)return details(b.dataset.localId);
    if(b.dataset.localAccount){if(blocked())return;c.select(b.dataset.localAccount);$('#wallet-dialog').close();closeConfirmation();render();return;}
    if(b.id==='disconnect-wallet'){if(busy)return;c.select(null);$('#wallet-dialog').close();closeConfirmation();render();return;}
    if(b.id==='claim-all')return void prepare('claim_all');
    if(b.dataset.localAction)return void prepare(b.dataset.localAction,{id:b.dataset.localToken});
    if(b.id==='page-next'||b.id==='page-prev'){page+=b.id==='page-next'?1:-1;renderCollection();}
  },true);
  document.addEventListener('submit',event=>{
    const f=event.target;if(f.id!=='mint-form'&&!f.matches('[data-local-contribution]'))return;
    event.preventDefault();event.stopImmediatePropagation();if(!f.reportValidity())return;
    if(f.id==='mint-form')void prepare('mint');else {contributionAmounts.set(f.dataset.localContribution,f.elements.amount.value);void prepare(f.dataset.localKind,{id:f.dataset.localContribution,amount:f.elements.amount.value});}
  },true);
  return {updateWallet,renderPortfolio,renderMetrics,renderCollection,openWallet,refresh,details,render};
}
