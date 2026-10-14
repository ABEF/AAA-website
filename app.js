import {DEMO_ADDRESS, STORAGE_KEY, LEVELS, buildDemoCollection, replayEvents, getMetrics, getLevel, claimable, feeSplit, mintPreview, claimPreview, activatePreview, increasePreview, estimatePoolFees, BASE_PROTOCOL_LIQUIDITY_USD, BASE_POOL_LIQUIDITY_USD, dollars} from './domain.js';
import {WalletConnection, walletError} from './wallet.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const currency = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const wholeCurrency = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const number = new Intl.NumberFormat('en-US');
const money = value => currency.format(dollars(value));
const wholeMoney = value => wholeCurrency.format(dollars(value));
const poolName = nft => nft.pool ? nft.pool.replace('/', ' / ') : 'Not activated';
const shortAddress = value => `${value.slice(0,6)}…${value.slice(-4)}`;
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const wait = duration => new Promise(resolve => setTimeout(resolve,duration));
let events = [];
try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); if (Array.isArray(saved)) events = saved.slice(0,1000); } catch { /* Preview can run without browser storage. */ }
let collection = events.length ? replayEvents(events) : buildDemoCollection();
let page = 1, poolFilter = 'all', operationPending = false, connecting = false, toastTimer;
const providers = [];
const wallet = new WalletConnection(() => { updateWallet(); renderPortfolio(); });

function persist(event) {
  events.push(event);
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(events)); } catch { /* Changes remain usable for the current page session. */ }
}
function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; },6500);
}
function cube(lockedCents = 0) {
  const active = lockedCents > 0;
  const level = getLevel(lockedCents).toLowerCase();
  return `<svg viewBox="0 0 80 92" class="nft-cube ${active ? 'is-active' : 'is-dormant'} state-${level}" aria-hidden="true"><path class="cube-frame" d="M40 3 76 24v43L40 89 4 67V24Z" fill="none" stroke="currentColor" stroke-width="1" opacity=".4"/><path class="cube-edge" d="m40 16 25 15v30L40 76 15 61V31Zm-25 15 25 15 25-15M40 46v30" fill="none" stroke="currentColor" stroke-width="1.5"/><path class="cube-highlight" d="M40 12 69 29M11 29v34" fill="none" stroke="currentColor" opacity=".35"/></svg>`;
}

function renderMetrics() {
  const metrics = getMetrics(collection);
  const poolLiquidityUSD = BASE_POOL_LIQUIDITY_USD + dollars(metrics.liquidity) - BASE_PROTOCOL_LIQUIDITY_USD;
  const share = dollars(metrics.liquidity) / poolLiquidityUSD;
  const shareLabel = `${number.format(Math.round(share*10000)/100)}%`;
  const values = {compoundHistory:money(Math.round(metrics.feesAllTime/10)),share:shareLabel,poolLiquidity:wholeCurrency.format(poolLiquidityUSD),liquidity:wholeMoney(metrics.liquidity),feesAllTime:money(metrics.feesAllTime),fees24h:money(metrics.fees24h),activeRatio:`${metrics.active} / ${metrics.total}`,dormant:number.format(metrics.dormant)};
  $$('[data-metric]').forEach(element => { element.textContent = values[element.dataset.metric]; });
  $('#liquidity-share-fill').style.width = `${share*100}%`;
  $('.liquidity-share-bar').setAttribute('aria-label',`Collection permanently holds ${shareLabel} of total available example pool liquidity`);
  renderFeeModel();
  $('#level-distribution').innerHTML = LEVELS.map(level => {
    const count = collection.filter(nft => getLevel(nft.lockedCents) === level).length;
    return `<div class="level-row"><span>${level}</span><div class="level-bar"><span style="width:${count / metrics.total * 100}%"></span></div><b>${count}</b></div>`;
  }).join('');
  const valuesByDay = [0.69,0.86,0.73,1.08,0.91,1.21,1].map(ratio => metrics.fees24h * ratio);
  const max = Math.max(1,...valuesByDay) * 1.2;
  const points = valuesByDay.map((value,index) => [55 + index * 76,153 - value / max * 126]);
  const line = points.map(([x,y],index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const grid = [0,.5,1].map(ratio => `<line x1="52" y1="${153-ratio*126}" x2="525" y2="${153-ratio*126}" stroke="#1c2a3e"/><text x="42" y="${157-ratio*126}" text-anchor="end">${escape(wholeMoney(max*ratio))}</text>`).join('');
  $('#fee-chart').innerHTML = `<svg viewBox="0 0 550 185" role="img" aria-label="Illustrative trading fees for the last seven days, ending at ${escape(money(metrics.fees24h))} today"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3bd7eb" stop-opacity=".19"/><stop offset="1" stop-color="#3bd7eb" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${line} L511 153 L55 153Z" fill="url(#chart-fill)"/><path d="${line}" fill="none" stroke="#3bd7eb" stroke-width="2" stroke-linejoin="round"/><circle cx="511" cy="${points[6][1]}" r="3.5" fill="#3bd7eb"/>${points.map(([x],index) => `<text x="${x}" y="178" text-anchor="middle">${index === 6 ? 'Today' : `${6-index}d ago`}</text>`).join('')}</svg>`;
}

function renderFeeModel() {
  const protocolLiquidityUSD = dollars(getMetrics(collection).liquidity);
  const totalLiquidityUSD = BASE_POOL_LIQUIDITY_USD + protocolLiquidityUSD - BASE_PROTOCOL_LIQUIDITY_USD;
  try {
    const estimate = estimatePoolFees({protocolLiquidityUSD,totalLiquidityUSD,volumeUSD:Number($('#model-volume').value),feePercent:Number($('#model-fee').value)});
    $('#model-pool-fees').textContent = money(estimate.poolFeeCents);
    $('#model-collection-fees').textContent = money(estimate.collectionFeeCents);
    $('#model-error').textContent = '';
  } catch(error) { $('#model-pool-fees').textContent = '—'; $('#model-collection-fees').textContent = '—'; $('#model-error').textContent = error.message; }
}
$('#model-volume').addEventListener('input',renderFeeModel);
$('#model-fee').addEventListener('input',renderFeeModel);

function renderCollection() {
  const query = $('#nft-search').value.trim().replace(/^#/, '');
  const status = $('#status-filter').value;
  const sort = $('#sort-positions').value;
  let matches = collection.filter(nft => (!query || String(nft.id).includes(query)) && (poolFilter === 'all' || nft.pool === poolFilter) && (status === 'all' || (status === 'active' ? nft.lockedCents > 0 : nft.lockedCents === 0)));
  if (sort === 'liquidity') matches.sort((a,b) => b.lockedCents-a.lockedCents);
  if (sort === 'fees') matches.sort((a,b) => b.feesAllTimeCents-a.feesAllTimeCents);
  if (sort === 'newest') matches.sort((a,b) => b.createdOrder-a.createdOrder);
  const pageCount = Math.max(1,Math.ceil(matches.length / 8));
  page = Math.min(pageCount,Math.max(1,page));
  const shown = matches.slice((page-1)*8,page*8);
  $('#positions-body').innerHTML = shown.length ? shown.map(nft => `<tr><td><div class="position-identity"><span class="mini-cube">${cube(nft.lockedCents)}</span><div><span class="nft-name">PoPL #${nft.id}</span><span class="level-badge ${nft.lockedCents ? '' : 'dormant'}">${getLevel(nft.lockedCents)}</span></div></div></td><td class="position-pool">${poolName(nft)}</td><td>${money(nft.lockedCents)}</td><td class="position-fee">${money(nft.feesAllTimeCents)}</td><td class="position-fee">${money(nft.fees24hCents)}</td><td><button class="position-view" data-nft-id="${nft.id}" aria-label="View PoPL NFT ${nft.id}">↗</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-results">No positions match these filters. Try another NFT number or pool.</td></tr>';
  $('#result-count').textContent = `${matches.length} position${matches.length === 1 ? '' : 's'}`;
  $('#page-info').textContent = matches.length ? `${(page-1)*8+1}–${Math.min(page*8,matches.length)} of ${matches.length} · Page ${page} of ${pageCount}` : '0 positions';
  $('#page-prev').disabled = page === 1;
  $('#page-next').disabled = page === pageCount;
}

function renderPortfolio() {
  const connected = Boolean(wallet.state);
  $('#portfolio-disconnected').hidden = connected;
  $('#portfolio-connected').hidden = !connected;
  $('#portfolio-label').textContent = connected ? 'EXAMPLE WALLET PORTFOLIO' : 'WALLET NOT CONNECTED';
  if (!connected) return;
  const owned = collection.filter(nft => nft.exampleOwned);
  const metrics = getMetrics(owned);
  $('#portfolio-address').textContent = `${wallet.state.type === 'demo' ? 'Demo wallet' : wallet.state.name} · ${shortAddress(wallet.state.address)}`;
  $('#my-liquidity').textContent = money(metrics.liquidity);
  $('#my-fees-all').textContent = money(metrics.feesAllTime);
  $('#my-fees-day').textContent = money(metrics.fees24h);
  $('#my-claimable').textContent = money(metrics.claimable);
  $('#my-count').textContent = `${owned.length} NFTs · ${metrics.active} active · ${metrics.dormant} dormant`;
  $('#claim-all').disabled = operationPending || metrics.claimable === 0;
  $('#claim-all').textContent = operationPending ? 'Processing preview…' : metrics.claimable ? 'Preview claim all ↗' : 'All rewards claimed';
  $('#owned-nfts').innerHTML = owned.map(nft => `<article class="nft-card"><div class="nft-card-art ${nft.lockedCents ? 'is-active' : 'is-dormant'}"><span class="nft-art-label">PROOF OF PERMANENT LIQUIDITY</span>${cube(nft.lockedCents)}</div><div class="nft-card-body"><div class="nft-card-title"><h3>PoPL #${nft.id}</h3><span class="level-badge ${nft.lockedCents ? '' : 'dormant'}">${getLevel(nft.lockedCents)}</span></div><div class="nft-card-details"><div><span>Pool</span><b>${poolName(nft)}</b></div><div><span>Permanent LP</span><b>${money(nft.lockedCents)}</b></div><div><span>Fees generated · all time</span><b>${money(nft.feesAllTimeCents)}</b></div><div><span>Fees generated · 24h</span><b>${money(nft.fees24hCents)}</b></div></div><div class="nft-card-claim"><span>CLAIMABLE REWARDS<strong>${money(claimable(nft))}</strong></span>${nft.lockedCents ? `<button class="button claim-one" data-claim-id="${nft.id}" ${operationPending || !claimable(nft) ? 'disabled' : ''}>${claimable(nft) ? 'Preview claim' : nft.claimedCents ? 'Claimed' : 'No rewards yet'}</button>` : `<button class="button claim-one" data-nft-id="${nft.id}">Activate ↗</button>`}</div></div>${nft.lockedCents ? `<div class="nft-card-actions"><button class="text-link" data-manage-id="${nft.id}">Add permanent LP ↗</button></div>` : ''}<button class="nft-card-detail-link" data-nft-id="${nft.id}"><span>Position & reward breakdown</span><span aria-hidden="true">↗</span></button></article>`).join('');
}

function updateWallet() {
  $$('.wallet-button').forEach(button => { button.textContent = wallet.state ? `${wallet.state.type === 'demo' ? 'Demo · ' : ''}${shortAddress(wallet.state.address)}` : 'Connect wallet ↗'; });
  $('#wallet-connected-actions').hidden = !wallet.state;
  $('#connected-wallet-description').textContent = wallet.state ? `Connected: ${wallet.state.name} · ${wallet.state.address}` : '';
  $('#mint-submit').type = wallet.state ? 'submit' : 'button';
  $('#mint-submit').disabled = operationPending;
  $('#mint-submit').textContent = operationPending ? 'Creating example NFT…' : wallet.state ? 'Preview dormant mint ↗' : 'Connect wallet to preview mint ↗';
}

function renderMint() { updateWallet(); }

function renderAll() { renderMetrics(); renderCollection(); renderPortfolio(); renderMint(); renderAllocation(); }
function liquidityForm(nft, action) {
  const activation = action === 'activate';
  return `<form class="liquidity-form" data-liquidity-form data-nft-id="${nft.id}" data-action="${action}">${activation ? `<label class="input-label" for="liquidity-pool-${nft.id}">ACTIVATION POOL</label><select name="pool" id="liquidity-pool-${nft.id}"><option value="ZZZ/WETH">ZZZ / WETH</option><option value="ZZZ/USDC">ZZZ / USDC</option></select>` : ''}<label class="input-label" for="liquidity-amount-${nft.id}">${activation ? 'INITIAL PERMANENT LP · MINIMUM $500' : 'ADDITIONAL PERMANENT LP'}</label><div class="amount-input"><span>$</span><input name="amount" id="liquidity-amount-${nft.id}" type="number" min="${activation ? '500' : '0.01'}" max="1000000" step="0.01" value="${activation ? '500' : '1000'}" required inputmode="decimal"><span>USD</span></div><label class="checkbox-label"><input type="checkbox" name="consent" required><span>I understand this ${activation ? 'activation' : 'LP addition'} permanently locks the added capital. This preview is a simulation.</span></label><button type="submit" class="button button-full" ${operationPending ? 'disabled' : ''}>Preview ${activation ? 'activation' : 'LP addition'} ↗</button></form>`;
}

function renderDetails(id) {
  const nft = collection.find(item => item.id === id);
  if (!nft) return;
  const owner = nft.exampleOwned && wallet.state ? wallet.state.address : nft.owner;
  let controls = '<p class="small-note">This position belongs to another example owner. Explore your own example holdings in My NFTs.</p>';
  if (nft.exampleOwned) {
    if (!wallet.state) controls = '<button class="button button-full" data-connect>Connect to explore this example NFT ↗</button>';
    else if (nft.lockedCents) controls = `<button class="button button-full" data-claim-id="${id}" ${!claimable(nft) || operationPending ? 'disabled' : ''}>${claimable(nft) ? 'Preview reward claim ↗' : 'No rewards ready to claim'}</button><details class="manage-liquidity"><summary>Add permanent liquidity to this NFT</summary><p class="activate-intro">Add more ${poolName(nft)} LP to this same position. Both the NFT's LP and the collection total increase. The added capital stays locked forever.</p>${liquidityForm(nft,'increase')}</details>`;
    else controls = `<p class="activate-intro">This NFT is dormant. Activate it by adding at least $500 of permanently locked LP. Minting alone never adds liquidity.</p>${liquidityForm(nft,'activate')}`;
  }
  $('#nft-dialog-content').innerHTML = `<div class="nft-detail-art">${cube(nft.lockedCents)}</div><div class="nft-detail-heading"><h2 id="nft-details-title">PoPL #${nft.id}</h2><span class="level-badge ${nft.lockedCents ? '' : 'dormant'}">${getLevel(nft.lockedCents)} · ${poolName(nft)}</span></div><div class="nft-detail-stats"><div><span>PERMANENT LP</span><strong>${money(nft.lockedCents)}</strong></div><div><span>FEES · ALL TIME</span><strong>${money(nft.feesAllTimeCents)}</strong></div><div><span>FEES · LAST 24H</span><strong>${money(nft.fees24hCents)}</strong></div><div><span>EXAMPLE POWER</span><strong>${number.format(nft.power)}</strong></div></div><div class="nft-detail-rewards"><div><span>Individual position rewards</span><b>${money(nft.individualCents)}</b></div><div><span>Collective rewards</span><b>${money(nft.collectiveCents)}</b></div><div><span>Previously claimed in preview</span><b>${money(nft.claimedCents)}</b></div><div><span>Total claimable</span><b>${money(claimable(nft))}</b></div></div><p class="nft-detail-owner">Example owner: ${escape(owner)}</p>${controls}<p class="small-note">Illustrative dollar values. Principal cannot be claimed; only funded fee rewards carry claim rights. Activations, LP additions, and claims here are simulations.</p>`;
  if (!$('#nft-dialog').open) $('#nft-dialog').showModal();
}

function renderProviders() {
  const container = $('#wallet-providers');
  container.replaceChildren();
  if (!providers.length) {
    const unavailable = document.createElement('p'); unavailable.className = 'wallet-unavailable'; unavailable.textContent = 'No browser wallet detected. You can explore every feature with the demo wallet below.'; container.append(unavailable);
  }
  for (const [index,item] of providers.entries()) {
    const button = document.createElement('button'); button.className = 'wallet-option'; button.dataset.providerIndex = String(index); button.disabled = connecting;
    const icon = document.createElement('span'); icon.className = 'wallet-option-icon'; icon.textContent = '↗';
    const copy = document.createElement('span'); const title = document.createElement('strong'); title.textContent = item.name; const subtitle = document.createElement('small'); subtitle.textContent = 'Connect public address · demo data only'; copy.append(title,subtitle);
    const arrow = document.createElement('span'); arrow.textContent = '→'; arrow.setAttribute('aria-hidden','true'); button.append(icon,copy,arrow); container.append(button);
  }
}
function openWallet() {
  if ($('#nft-dialog').open) $('#nft-dialog').close();
  $('#wallet-message').textContent = ''; $('#wallet-message').classList.remove('is-error'); renderProviders(); updateWallet();
  if (!$('#wallet-dialog').open) $('#wallet-dialog').showModal();
}
function registerProvider(provider,name) {
  if (!provider || typeof provider.request !== 'function' || providers.some(item => item.provider === provider)) return;
  providers.push({provider,name:String(name || 'Browser wallet').slice(0,80)});
  if ($('#wallet-dialog').open) renderProviders();
}
window.addEventListener('eip6963:announceProvider',event => registerProvider(event.detail?.provider,event.detail?.info?.name));
window.dispatchEvent(new Event('eip6963:requestProvider'));
if (window.ethereum) {
  const list = Array.isArray(window.ethereum.providers) ? window.ethereum.providers : [window.ethereum];
  list.forEach(provider => registerProvider(provider,provider.isRabby ? 'Rabby' : provider.isMetaMask ? 'MetaMask' : 'Browser wallet'));
}

async function runClaim(ids) {
  if (!wallet.state) return openWallet();
  if (operationPending) return;
  const startingAddress = wallet.state.address;
  try {
    const preview = claimPreview(collection,ids);
    operationPending = true; renderPortfolio(); updateWallet();
    if ($('#nft-dialog').open) $('#nft-dialog').close();
    await wait(700);
    if (wallet.state?.address !== startingAddress) throw new Error('Wallet changed. Try the preview again.');
    collection = preview.collection; persist({type:'claim',ids});
    toast(`Preview complete: ${money(preview.amount)} claimed. No real assets moved.`);
  } catch(error) { toast(error.message); }
  finally { operationPending = false; renderAll(); }
}

async function runLiquidity(id,amount,pool,action) {
  if (!wallet.state) return openWallet();
  if (operationPending) return;
  const startingAddress = wallet.state.address;
  try {
    const preview = action === 'activate' ? activatePreview(collection,{id,amount,pool}) : increasePreview(collection,{id,amount});
    operationPending = true; renderPortfolio(); updateWallet(); $('#nft-dialog').close();
    await wait(700);
    if (wallet.state?.address !== startingAddress) throw new Error('Wallet changed. Try the preview again.');
    collection = preview.collection; persist({type:action,id,amount,pool});
    toast(`PoPL #${id}: ${currency.format(amount)} ${action === 'activate' ? 'activation' : 'permanent LP top-up'} completed in the preview. No real assets moved.`);
  } catch(error) { toast(error.message); }
  finally { operationPending = false; renderAll(); }
}

document.addEventListener('submit',event => {
  const form = event.target;
  if (!form.matches('[data-liquidity-form]')) return;
  event.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const pool = form.elements.namedItem('pool')?.value;
  runLiquidity(Number(form.dataset.nftId),Number(form.elements.namedItem('amount').value),pool,form.dataset.action);
});

document.addEventListener('click',async event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.matches('[data-connect]')) openWallet();
  if (target.matches('[data-close-dialog]')) target.closest('dialog').close();
  if (target.dataset.nftId) renderDetails(Number(target.dataset.nftId));
  if (target.dataset.manageId) { renderDetails(Number(target.dataset.manageId)); const details = $('#nft-dialog').querySelector('.manage-liquidity'); if (details) { details.open = true; details.scrollIntoView({block:'nearest'}); } }
  if (target.dataset.claimId) await runClaim([Number(target.dataset.claimId)]);
  if (target.dataset.illustration) {
    const key = 'nft';
    $('#illustration-image').src = `./assets/${key}.jpg`;
    $('#illustration-image').alt = 'PoPL NFT and proposed liquidity-based levels';
    $('#illustration-title').textContent = 'NFT RIGHTS & PROPOSED LEVELS';
    $('#illustration-dialog').showModal();
  }
  if (target.dataset.feePeriod) {
    const metrics = getMetrics(collection);
    $('#fee-example').value = dollars(target.dataset.feePeriod === 'lifetime' ? metrics.feesAllTime : metrics.fees24h).toFixed(2);
    $$('[data-fee-period]').forEach(button => { const active = button === target; button.classList.toggle('is-active',active); button.setAttribute('aria-pressed',String(active)); }); renderAllocation();
  }
  if (target.dataset.pool) {
    poolFilter = target.dataset.pool; page = 1;
    $$('[data-pool]').forEach(button => { const active = button.dataset.pool === poolFilter; button.classList.toggle('is-active',active); button.setAttribute('aria-pressed',String(active)); }); renderCollection();
  }
  if (target.dataset.providerIndex !== undefined && !connecting) {
    const item = providers[Number(target.dataset.providerIndex)]; if (!item) return;
    connecting = true; $('#demo-wallet').disabled = true; renderProviders(); $('#wallet-message').textContent = 'Confirm connection in your wallet…';
    try { await wallet.connect(item.provider,item.name); $('#wallet-dialog').close(); toast('Wallet connected. This portfolio contains example assets only.'); }
    catch(error) { $('#wallet-message').textContent = walletError(error); $('#wallet-message').classList.add('is-error'); }
    finally { connecting = false; $('#demo-wallet').disabled = false; renderProviders(); }
  }
});

$('#demo-wallet').addEventListener('click',() => { if (connecting) return; wallet.connectDemo(DEMO_ADDRESS); $('#wallet-dialog').close(); toast('Demo wallet connected. Explore your example NFTs in My NFTs.'); });
$('#disconnect-wallet').addEventListener('click',() => { wallet.disconnect(); $('#wallet-dialog').close(); toast('Disconnected from this site.'); });
$('#reset-demo').addEventListener('click',() => {
  if (operationPending || connecting) return;
  events = []; collection = buildDemoCollection();
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* An in-memory reset remains available without storage. */ }
  renderAll(); toast('Example collection restored: $425,000 LP and 20 dormant NFTs.');
});
$('#mint-submit').addEventListener('click',event => { if (!wallet.state) { event.preventDefault(); openWallet(); } });
$('#claim-all').addEventListener('click',() => runClaim(collection.filter(nft => nft.exampleOwned && claimable(nft) > 0).map(nft => nft.id)));
$('#mint-form').addEventListener('submit',async event => {
  event.preventDefault(); if (!wallet.state) return openWallet(); if (operationPending) return;
  const message = $('#mint-message'); const startingAddress = wallet.state.address;
  try {
    if (!$('#mint-consent').checked) throw new Error('Confirm that you understand permanent principal locking.');
    const preview = mintPreview(collection);
    operationPending = true; updateWallet(); renderPortfolio(); message.textContent = 'Creating your example position…'; message.classList.remove('is-error');
    await wait(850);
    if (wallet.state?.address !== startingAddress) throw new Error('Wallet changed. Try the preview again.');
    collection = preview.collection; persist({type:'mint'});
    $('#mint-consent').checked = false; message.textContent = ''; location.hash = 'my-nfts';
    toast(`PoPL #${preview.nft.id} minted in the preview. Dormant, with $0 LP. Activate it from My NFTs.`);
  } catch(error) { message.textContent = error.message; message.classList.add('is-error'); }
  finally { operationPending = false; renderAll(); }
});

for (const selector of ['#nft-search','#status-filter','#sort-positions']) $(selector).addEventListener(selector === '#nft-search' ? 'input' : 'change',() => { page = 1; renderCollection(); });
$('#page-prev').addEventListener('click',() => { page--; renderCollection(); });
$('#page-next').addEventListener('click',() => { page++; renderCollection(); });
function renderAllocation() {
  const input = $('#fee-example');
  try { const split = feeSplit(Number(input.value)); input.setCustomValidity(''); $$('[data-allocation]').forEach(element => { element.textContent = money(split[element.dataset.allocation]); }); }
  catch(error) { input.setCustomValidity(error.message); $$('[data-allocation]').forEach(element => { element.textContent = '—'; }); }
}
$('#fee-example').addEventListener('input',() => {
  $$('[data-fee-period]').forEach(button => { button.classList.remove('is-active'); button.setAttribute('aria-pressed','false'); }); renderAllocation();
});

const menu = $('.menu-toggle');
function closeMenu() { $('#mobile-nav').hidden = true; menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','Open navigation'); }
menu.addEventListener('click',() => { const open = $('#mobile-nav').hidden; $('#mobile-nav').hidden = !open; menu.setAttribute('aria-expanded',String(open)); menu.setAttribute('aria-label',open ? 'Close navigation' : 'Open navigation'); });
$('#mobile-nav').addEventListener('click',event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown',event => { if (event.key === 'Escape' && !$('#mobile-nav').hidden) { closeMenu(); menu.focus(); } });
$$('dialog').forEach(dialog => dialog.addEventListener('click',event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } }));

function route() {
  const hash = location.hash.slice(1);
  const selected = ['collection','mint','my-nfts'].includes(hash) ? hash : 'overview';
  $$('[data-view]').forEach(view => { view.hidden = view.dataset.view !== selected; });
  $$('[data-nav]').forEach(link => { if (link.dataset.nav === selected) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
  document.title = `${({'overview':'Proof of Permanent Liquidity','collection':'Collection','mint':'Mint','my-nfts':'My NFTs'})[selected]} — ZZZ PoPL`;
  closeMenu();
  if (hash === 'how-it-works') requestAnimationFrame(() => $('#how-it-works').scrollIntoView({behavior:'smooth'}));
  else window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route);
renderAll(); route();
