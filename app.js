import {localMode} from './local-client.js';
import {createLocalView} from './local-view.js';
import {ARTWORKS,PALETTES,COLORWAYS,PATTERNS,COLOR_STYLES,RARITIES,EVOLUTIONS,findArtwork,getRarity,getColorway,artworkForNft,royaltyWeight,paletteTrait,preloadEvolutions,confirmedUpgrade,armUpgradeSound,queueUpgrade,preloadUpgradeSounds} from './artworks.js';
import {DEMO_ADDRESS, STORAGE_KEY, LEVELS, getMintSupply, buildDemoCollection, replayEvents, getMetrics, getLevel, claimable, royaltyClaimable, rewardHistory, feeSplit, mintPreview, claimPreview, activatePreview, increasePreview, BASE_PROTOCOL_LIQUIDITY_USD, BASE_POOL_LIQUIDITY_USD, dollars} from './domain.js';
import {WalletConnection, walletError} from './wallet.js';
const {OperationTracker,preserveArtwork} = localMode(location) ? {} : await import('./ui-state.js');
const {PreviewStore,RESET_KEY,previewChange} = localMode(location) ? {} : await import('./preview-store.js');

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const currency = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const wholeCurrency = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const number = new Intl.NumberFormat('en-US');
const money = value => currency.format(dollars(value));
const wholeMoney = value => wholeCurrency.format(dollars(value));
const shortAddress = value => `${value.slice(0,6)}…${value.slice(-4)}`;
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const wait = duration => new Promise(resolve => setTimeout(resolve,duration));
const colorwayFor = nft => getColorway(nft.paletteId || nft.color);
const colorsFor = nft => colorwayFor(nft).colorIds || colorwayFor(nft).colors;
const paletteLabel = nft => colorwayFor(nft).label;
const styleLabel = id => COLOR_STYLES.find(style => style.id === id)?.label || 'Monochrome';
const patternLabel = id => PATTERNS.find(pattern => pattern.id === id)?.label || PATTERNS[0].label;
const visualTraits = nft => `<span>${styleLabel(colorwayFor(nft).colorStyle)}</span>${paletteTrait(colorsFor(nft))}`;
let collection = buildDemoCollection();
let page = 1, connecting = false, toastTimer, selectedNFT = null, selectedDetailMode = 'breakdown';
const providers = [];
const local = localMode(location) ? createLocalView() : null;
const store = local ? null : new PreviewStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},navigator.locks);
let storageProblem = null;
if (!local) try { collection = store.read().collection; } catch(error) { storageProblem = error.message; }
const wallet = new WalletConnection(() => {
  updateWallet(); renderPortfolio();
  if ($('#nft-dialog').open) $('#nft-dialog').close();
});
const operations = local ? null : new OperationTracker(() => wallet.revision);
const activity = [];
const nftKey = id => `nft:${id}`;
const nftOperation = id => operations.get(nftKey(id));
function recordActivity(message,error=false,key=null) {
  if(key){const index=activity.findIndex(item=>item.key===key);if(index>=0)activity.splice(index,1);}
  activity.unshift({message,error,key});activity.length=Math.min(activity.length,8);renderActivity();
}
function renderActivity() {
  if(local)return;
  let warning=$('[data-preview-warning]');
  if(!warning){warning=document.createElement('p');warning.dataset.previewWarning='';warning.className='container preview-activity is-error';warning.setAttribute('role','alert');document.querySelector('main').before(warning);}
  warning.hidden=!storageProblem;warning.textContent=storageProblem?`Saved preview unavailable. The displayed figures may be outdated. Actions are disabled until recovery or Reset demo. ${storageProblem}`:'';
  let panel=$('[data-preview-activity]');
  if(!panel){panel=document.createElement('div');panel.dataset.previewActivity='';panel.className='preview-activity';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');$('#owned-nfts').before(panel);}
  panel.hidden=!activity.length&&!storageProblem;
  panel.innerHTML=(storageProblem?`<p class="is-error">${escape(storageProblem)}</p>`:'')+activity.slice(0,4).map(item=>`<p class="${item.error?'is-error':''}">${escape(item.message)}</p>`).join('');
}
function refreshDataViews() {renderMetrics();renderCollection();renderPortfolio();updateWallet();}
function syncSavedPreview() {
  if(local)return;
  const previous=JSON.stringify(collection.find(n=>n.id===selectedNFT));
  try {collection=store.read().collection;storageProblem=null;}catch(error){storageProblem=error.message;}
  refreshDataViews();
  if($('#nft-dialog').open&&selectedNFT!=null&&!nftOperation(selectedNFT)&&previous!==JSON.stringify(collection.find(n=>n.id===selectedNFT)))refreshDetails(selectedNFT);
}
let storageRefresh=null;
window.addEventListener('storage',event=>{
  if(local||![STORAGE_KEY,RESET_KEY,null].includes(event.key))return;
  clearTimeout(storageRefresh);storageRefresh=setTimeout(syncSavedPreview,0);
});
// Returning to a background tab rechecks saved state; it does not resubmit actions.
window.addEventListener('pageshow',()=>{if(!local)syncSavedPreview();});
// A page restored from the back/forward cache must never finish an old intent.
// Merely switching tabs does not cancel independent ongoing actions.
window.addEventListener('pagehide',()=>{if(!local)operations.cancelAll();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!local)syncSavedPreview();});

function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; },6500);
}
function artButton(nft, className = '', openPosition = false) {
  const art = artworkForNft(nft);
  const action = openPosition ? `data-nft-id="${nft.id}"` : `data-artwork-id="${art.id}"`;
  const label = openPosition ? `View position and rewards for PoPL #${nft.id}` : `Enlarge ${art.colorLabel} ${art.rarityLabel} ${art.evolutionLabel} egg artwork`;
  return `<button type="button" class="art-image-button ${className}" data-art-owner="${nft.id ?? artworkForNft(nft).id}" style="--art-accent:${art.accent}" ${action} aria-label="${label}"><img class="nft-artwork" src="${art.src}" alt="${art.colorLabel} ${art.rarityLabel} egg · ${art.evolutionLabel}" width="1024" height="1024" loading="lazy" decoding="async"><span class="art-enlarge" aria-hidden="true">↗</span></button>`;
}
function rarityLabel(nft) {
  const rarity = getRarity(nft.rarity);
  return `<span class="rarity-tag" data-rarity="${rarity.id}">${rarity.label}</span>`;
}
function openArtwork(id) {
  const art = findArtwork(id);
  if (!art) return;
  $('#illustration-image').src = art.src;
  $('#illustration-image').alt = `${art.colorLabel} ${art.rarityLabel} egg NFT · ${art.evolutionLabel}`;
  $('#illustration-title').textContent = `${art.colorLabel} · ${art.rarityLabel} · ${art.evolutionLabel}`;
  $('#illustration-note').textContent = `${styleLabel(art.colorStyle)} · ${patternLabel(art.pattern)}. ${art.evolution === 'dormant' ? `Dormant: zero royalty weight. ${art.rarityLabel} becomes ×${art.royaltyMultiplier} after activation.` : `Royalty weight ×${art.royaltyWeight}.`} Colors and circuit patterns are visual traits only; LP fees are unchanged. Artwork and metadata preview.`;
  $('#illustration-metadata').href = art.metadata;
  $('#illustration-metadata').download = `${art.id}.json`;
  if (!$('#illustration-dialog').open) $('#illustration-dialog').showModal();
}
const explainerDialog = $('#explainer-dialog');
const explainerVideo = $('#explainer-video');
const explainerStatus = $('#explainer-status');
$('#open-explainer').addEventListener('click',() => {
  explainerStatus.hidden = true;
  explainerVideo.poster = explainerVideo.dataset.poster;
  if (!explainerDialog.open) explainerDialog.showModal();
  explainerVideo.currentTime = 0;
  explainerVideo.play().then(() => {
    // A quick close may happen while the media request is still pending.
    if (!explainerDialog.open) explainerVideo.pause();
  }).catch(() => {
    if (!explainerDialog.open) return;
    explainerStatus.textContent = 'Use the play control to start, or download the video below.';
    explainerStatus.hidden = false;
  });
});
explainerVideo.addEventListener('error',() => {
  explainerStatus.textContent = 'The video could not load. Please try again or use the download link below.';
  explainerStatus.hidden = false;
});
explainerDialog.addEventListener('close',() => {
  explainerVideo.pause();
  explainerVideo.currentTime = 0;
});

let artColor = 'cyan', artPage = 1, mintEvolution = 'dormant';
function renderRarityShowcase() {
  $('#rarity-showcase').innerHTML = RARITIES.map(rarity => {
    const nft = {color:'cyan',rarity:rarity.id,lockedCents:100000};
    return `<article>${artButton(nft)}<div class="rarity-copy"><div><h3>${rarity.label}</h3><span class="rarity-weight">×${rarity.royaltyMultiplier}</span></div><p>${rarity.description}</p><p class="royalty-caption">ROYALTIES SHARES · WHEN ACTIVATED</p></div></article>`;
  }).join('');
}
function renderArtGallery() {
  $('#art-color-filters').innerHTML = [{id:'all',label:'All colors',accent:'#8fa6be'},...PALETTES].map(color => `<button type="button" class="palette-button ${color.id === artColor ? 'is-active' : ''}" style="--swatch:${color.accent}" data-art-color="${color.id}" aria-pressed="${color.id === artColor}"><span class="swatch" aria-hidden="true"></span>${color.label}</button>`).join('');
  const rarity = $('#art-rarity-filter').value, evolution = $('#art-evolution-filter').value;
  const colorStyle = $('#art-style-filter').value, pattern = $('#art-pattern-filter').value;
  let matches = ARTWORKS.filter(art => (artColor === 'all' || colorsFor(art).includes(artColor)) && (colorStyle === 'all' || art.colorStyle === colorStyle) && (pattern === 'all' || art.pattern === pattern) && (rarity === 'all' || art.rarity === rarity) && (evolution === 'all' || art.evolution === evolution));
  if (colorStyle === 'all') {
    // Keep each design's four evolutions together when mixing color styles.
    const groups = COLOR_STYLES.map(style => {
      const families = new Map();
      for (const art of matches.filter(item => item.colorStyle === style.id)) {
        const key = `${art.paletteId}-${art.pattern}-${art.rarity}`;
        if (!families.has(key)) families.set(key,[]);
        families.get(key).push(art);
      }
      return [...families.values()];
    });
    matches = Array.from({length:Math.max(0,...groups.map(group => group.length))},(_,index) => groups.flatMap(group => group[index] || [])).flat();
  }
  const pages = Math.max(1,Math.ceil(matches.length / 12));
  artPage = Math.max(1,Math.min(pages,artPage));
  const shown = matches.slice((artPage-1)*12,artPage*12);
  $('#artwork-gallery').innerHTML = shown.length ? shown.map(art => `<article class="artwork-card" style="--art-accent:${art.accent}"><button type="button" class="art-image-button" data-artwork-id="${art.id}" aria-label="Enlarge ${art.colorLabel} ${patternLabel(art.pattern)} ${art.rarityLabel} ${art.evolutionLabel}"><img class="nft-artwork" src="${art.src}" alt="${art.colorLabel} ${art.rarityLabel} egg · ${patternLabel(art.pattern)} · ${art.evolutionLabel}" width="1024" height="1024" loading="lazy" decoding="async"><span class="art-enlarge" aria-hidden="true">↗</span></button><div class="artwork-card-copy"><h2>${art.evolutionLabel}</h2><div class="artwork-card-traits"><span class="rarity-tag" data-rarity="${art.rarity}">${art.rarityLabel}</span><span>${styleLabel(art.colorStyle)}</span>${paletteTrait(art.colors)}<span class="royalty-trait${art.evolution === 'dormant' ? ' is-dormant' : ''}"${art.evolution === 'dormant' ? ' title="Royalty eligibility begins after activation"' : ''}>Royalty weight ×${art.royaltyMultiplier}</span></div></div></article>`).join('') : '<p class="empty-artworks">No artwork matches these filters. Try another color, style or pattern.</p>';
  $('#art-variant-count').textContent = `${number.format(matches.length)} of ${number.format(ARTWORKS.length)} artwork states · ${local ? '1,000 total supply' : collection.length+' example NFTs'}`;
  $('#art-page-info').textContent = matches.length ? `${(artPage-1)*12+1}–${Math.min(artPage*12,matches.length)} of ${number.format(matches.length)} · Page ${artPage} of ${pages}` : '0 artwork states';
  $('#art-prev').disabled = artPage === 1;
  $('#art-next').disabled = artPage === pages;
}
function renderMintArt() {
  const selectedStyle = $('#mint-art-style').value;
  const selectedPalette = $('#mint-art-color').value;
  const choices = COLORWAYS.filter(palette => palette.colorStyle === selectedStyle);
  $('#mint-art-color').innerHTML = choices.map(palette => `<option value="${palette.id}">${palette.label}</option>`).join('');
  if (choices.some(palette => palette.id === selectedPalette)) $('#mint-art-color').value = selectedPalette;
  const art = findArtwork(`${$('#mint-art-color').value}-${$('#mint-art-pattern').value}-${$('#mint-art-rarity').value}-${mintEvolution}`);
  if (!art) return;
  const image = $('#mint-art-image');
  if (image.getAttribute('src') !== art.src) image.src = art.src;
  image.alt = `${art.colorLabel} ${art.rarityLabel} egg NFT · ${art.evolutionLabel}`;
  $('#mint-art-open').dataset.artworkId = art.id;
  $('#mint-art-open').style.setProperty('--art-accent',art.accent);
  $('#mint-art-caption').textContent = `${art.colorLabel} · ${patternLabel(art.pattern)} · ${art.rarityLabel} · ${art.evolutionLabel}`;
  $('#mint-evolution-controls').innerHTML = EVOLUTIONS.map(evolution => `<button type="button" data-mint-evolution="${evolution.id}" class="${evolution.id === mintEvolution ? 'is-active' : ''}" aria-pressed="${evolution.id === mintEvolution}">${evolution.label}</button>`).join('');
}


function renderMetrics() {
  if (local) return local.renderMetrics();
  const metrics = getMetrics(collection);
  const poolLiquidityUSD = BASE_POOL_LIQUIDITY_USD + dollars(metrics.liquidity) - BASE_PROTOCOL_LIQUIDITY_USD;
  const share = dollars(metrics.liquidity) / poolLiquidityUSD;
  const shareLabel = `${number.format(Math.round(share*10000)/100)}%`;
  const values = {compoundHistory:money(feeSplit(dollars(metrics.feesAllTime)).compound),share:shareLabel,poolLiquidity:wholeCurrency.format(poolLiquidityUSD),liquidity:wholeMoney(metrics.liquidity),feesAllTime:money(metrics.feesAllTime),fees24h:money(metrics.fees24h),activeRatio:`${metrics.active} / ${metrics.total}`,dormant:number.format(metrics.dormant)};
  $$('[data-metric]').forEach(element => { element.textContent = values[element.dataset.metric]; });
  const example = collection.find(nft => nft.id === 444);
  const exampleArt = artworkForNft(example);
  $('#overview-example-lp').textContent = money(example.lockedCents);
  $('#overview-example-state').textContent = `${exampleArt.evolutionLabel} · ${exampleArt.rarityLabel}`;
  $('#overview-example-art').dataset.nftId = String(example.id);
  const exampleImage = $('#overview-example-image');
  if (exampleImage.getAttribute('src') !== exampleArt.src) exampleImage.src = exampleArt.src;
  exampleImage.alt = `${exampleArt.colorLabel} ${exampleArt.rarityLabel} egg · ${exampleArt.evolutionLabel}`;
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

function renderCollection() {
  if (local) return local.renderCollection();
  const query = $('#nft-search').value.trim().replace(/^#/, '');
  const status = $('#status-filter').value;
  const sort = $('#sort-positions').value;
  let matches = collection.filter(nft => (!query || String(nft.id).includes(query)) && (status === 'all' || (status === 'active' ? nft.lockedCents > 0 : nft.lockedCents === 0)) && ($('#rarity-filter').value === 'all' || nft.rarity === $('#rarity-filter').value) && ($('#color-filter').value === 'all' || colorsFor(nft).includes($('#color-filter').value)) && ($('#color-style-filter').value === 'all' || colorwayFor(nft).colorStyle === $('#color-style-filter').value));
  if (sort === 'liquidity') matches.sort((a,b) => b.lockedCents-a.lockedCents);
  if (sort === 'fees') matches.sort((a,b) => b.feesAllTimeCents-a.feesAllTimeCents);
  if (sort === 'newest') matches.sort((a,b) => b.createdOrder-a.createdOrder);
  const pageCount = Math.max(1,Math.ceil(matches.length / 8));
  page = Math.min(pageCount,Math.max(1,page));
  const shown = matches.slice((page-1)*8,page*8);
  $('#positions-body').innerHTML = shown.length ? shown.map(nft => `<tr><td><div class="position-identity"><button type="button" class="position-art" style="--art-accent:${colorwayFor(nft).accent}" data-artwork-id="${artworkForNft(nft).id}" aria-label="Enlarge artwork for PoPL ${nft.id}"><img src="${artworkForNft(nft).src}" alt="" width="51" height="51" loading="lazy" decoding="async"></button><div><span class="nft-name">PoPL #${nft.id}</span><span class="position-traits">${getRarity(nft.rarity).label} · ${styleLabel(colorwayFor(nft).colorStyle)}<br>${paletteLabel(nft)}</span><span class="level-badge ${nft.lockedCents ? '' : 'dormant'}">${getLevel(nft.lockedCents)}</span></div></div></td><td>${money(nft.lockedCents)}</td><td class="position-fee">${money(nft.feesAllTimeCents)}</td><td class="position-fee">${money(nft.fees24hCents)}</td><td><button class="position-view" data-nft-id="${nft.id}" aria-label="View PoPL NFT ${nft.id}">↗</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-results">No positions match these filters. Try another NFT number or trait.</td></tr>';
  $('#result-count').textContent = `${matches.length} position${matches.length === 1 ? '' : 's'}`;
  $('#page-info').textContent = matches.length ? `${(page-1)*8+1}–${Math.min(page*8,matches.length)} of ${matches.length} · Page ${page} of ${pageCount}` : '0 positions';
  $('#page-prev').disabled = page === 1;
  $('#page-next').disabled = page === pageCount;
}

function renderPortfolio() {
  if (local) return local.renderPortfolio();
  const connected = Boolean(wallet.state);
  $('#portfolio-disconnected').hidden = connected;
  $('#portfolio-connected').hidden = !connected;
  $('#portfolio-label').textContent = connected ? 'EXAMPLE WALLET PORTFOLIO' : 'WALLET NOT CONNECTED';
  renderActivity();
  if (!connected) return;
  const owned = collection.filter(nft => nft.exampleOwned), metrics = getMetrics(owned);
  $('#portfolio-address').textContent = `${wallet.state.type === 'demo' ? 'Demo wallet' : wallet.state.name} · ${shortAddress(wallet.state.address)}`;
  $('#my-liquidity').textContent = storageProblem ? 'Unavailable' : money(metrics.liquidity);
  const histories=owned.map(rewardHistory);
  $('#my-fees-all').textContent = storageProblem ? 'Unavailable' : money(histories.reduce((total,h)=>total+h.allTime,0));
  $('#my-fees-day').textContent = storageProblem||histories.some(h=>h.last24h==null) ? 'Unavailable' : money(histories.reduce((total,h)=>total+h.last24h,0));
  $('#my-claimable').textContent = storageProblem ? 'Unavailable' : money(metrics.claimable);
  $('#my-count').textContent = `${owned.length} NFTs · ${metrics.active} active · ${metrics.dormant} dormant`;
  const claimTargets=owned.filter(nft=>claimable(nft)>0);
  $('#claim-all').disabled = Boolean(storageProblem) || !claimTargets.length || claimTargets.some(nft=>nftOperation(nft.id));
  $('#claim-all').textContent = metrics.claimable ? 'Preview claim all ↗' : 'No rewards to claim';
  preserveArtwork($('#owned-nfts'),()=>{
    $('#owned-nfts').innerHTML = owned.map(nft => {
      preloadEvolutions(artworkForNft(nft));
      const op=nftOperation(nft.id),busy=Boolean(op)||Boolean(storageProblem),active=Boolean(nft.lockedCents);
      const updating=op&&['activate','increase'].includes(op.kind);
      const financials=active?`${demoEarnings(nft)}<div class="position-reward-total"><span>Rewards to claim</span><strong>${storageProblem?'Unavailable':money(claimable(nft))}</strong></div>`:'';
      return `<article class="nft-card" data-position-id="${nft.id}" aria-busy="${Boolean(op)}"><div class="nft-card-art ${active?'is-active':'is-dormant'}">${artButton(nft,'',true)}${updating?'<span class="artwork-updating">Updating · last saved artwork</span>':''}</div><div class="nft-card-body"><div class="nft-card-title"><h3>PoPL #${nft.id}</h3><span class="level-badge ${active?'':'dormant'}">${getLevel(nft.lockedCents)}</span></div><div class="nft-card-traits">${rarityLabel(nft)}${visualTraits(nft)}${royaltyTrait(nft)}</div><div class="position-attached-lp"><span>LP attached</span><strong>${storageProblem?'Unavailable':money(nft.lockedCents)}</strong></div>${financials}${op?`<p class="position-progress" role="status">${op.kind==='claim'?'Claiming example fees…':'Updating this example position…'} Other NFTs remain available.</p>`:''}<div class="position-buttons">${active?`<button class="button" data-claim-id="${nft.id}" ${busy||!claimable(nft)?'disabled':''}>${op?.kind==='claim'?'Claiming…':'Claim'}</button><button class="button button-secondary" data-manage-id="${nft.id}" ${busy?'disabled':''}>Grow attached LP</button>`:`<button class="button" data-manage-id="${nft.id}" ${busy?'disabled':''}>${updating?'Activating…':'Activate ↗'}</button>`}</div></div><button class="nft-card-detail-link" data-nft-id="${nft.id}"><span>${active?'Position & reward breakdown':'Activation & NFT details'}</span><span aria-hidden="true">↗</span></button></article>`;
    }).join('');
  });
}

function updateWallet() {
  if (local) return local.updateWallet();
  $$('.wallet-button').forEach(button => { button.textContent = wallet.state ? `${wallet.state.type === 'demo' ? 'Demo · ' : ''}${shortAddress(wallet.state.address)}` : 'Connect wallet ↗'; });
  $('#wallet-connected-actions').hidden = !wallet.state;
  $('#connected-wallet-description').textContent = wallet.state ? `Connected: ${wallet.state.name} · ${wallet.state.address}` : '';
  $('#mint-submit').type = wallet.state ? 'submit' : 'button';
  const supply = getMintSupply(collection);
  $('#mint-supply').textContent = `${number.format(supply.minted)} / ${number.format(supply.cap)}`;
  $('#mint-remaining').textContent = `${number.format(supply.remaining)} remaining · illustrative inventory draw, not live VRF.`;
  $('#mint-submit').disabled = Boolean(operations.get('mint')) || Boolean(storageProblem) || !supply.remaining;
  $('#mint-submit').textContent = operations.get('mint') ? 'Creating example NFT…' : !supply.remaining ? 'Collection fully minted' : wallet.state ? 'Preview dormant mint ↗' : 'Connect wallet to preview mint ↗';
}

function renderMint() { updateWallet(); renderMintArt(); }

function renderAll() { renderMetrics(); renderCollection(); renderPortfolio(); renderMint(); renderRarityShowcase(); renderArtGallery(); }
function liquidityForm(nft, action) {
  const activation = action === 'activate';
  return `<form class="liquidity-form" data-liquidity-form novalidate data-nft-id="${nft.id}" data-action="${action}"><label class="input-label" for="funding-asset-${nft.id}">${activation ? 'ACTIVATE WITH' : 'GROW YOUR POSITION WITH'}</label><select name="fundingAsset" id="funding-asset-${nft.id}"><option value="USDC">USDC</option><option value="ZZZ">ZZZ</option><option value="ETH">ETH</option><option value="USDG">USDG</option></select><label class="input-label" for="liquidity-amount-${nft.id}">${activation ? 'ACTIVATION VALUE · MINIMUM $100' : 'GROW ATTACHED LP · MINIMUM $5'}</label><div class="amount-input"><span>$</span><input name="amount" id="liquidity-amount-${nft.id}" type="number" min="${activation ? '100' : '5'}" max="1000000" step="0.01" value="${activation ? '100' : '1000'}" required inputmode="decimal"><span>USD VALUE</span></div><p class="small-note">Amounts are USD-equivalent examples. Token quantities depend on their prices; no live quote is provided. Activation starts at $100; LP top-ups start at $5 in value. At least 99% must become added LP; network gas is separate.</p><label class="checkbox-label"><input type="checkbox" name="consent" required><span>My contribution funds permanent LP attached to this NFT. Only funded rewards can be claimed; the LP principal cannot be redeemed. This preview moves no real assets.</span></label><button type="submit" class="button button-full" ${nftOperation(nft.id) || storageProblem ? 'disabled' : ''}>Preview ${activation ? 'activation' : 'LP addition'} ↗</button><p class="form-feedback" data-form-feedback role="status" aria-live="polite"></p></form>`;
}

function royaltyTrait(nft) {
  return `<span class="royalty-trait ${nft.lockedCents?'':'is-dormant'}" title="${nft.lockedCents?'Royalty share enabled':'Activate to enable this royalty share'}">Royalty weight ×${getRarity(nft.rarity).royaltyMultiplier}</span>`;
}

function demoEarnings(nft) {
  const history=rewardHistory(nft), value=n=>storageProblem||n==null?'Unavailable':money(n);
  return `<div class="position-earnings" aria-label="NFT earnings, LP rewards plus royalties"><div><span>Fees generated · 24h</span><span class="earnings-value">${value(history.last24h)}</span></div><div><span>Fees generated · all time</span><span class="earnings-value">${value(history.allTime)}</span></div></div>`;
}
function demoFinancialDetails(nft) {
  const value=amount=>storageProblem?'Unavailable':money(amount);
  const row=(label,amount)=>`<div><span>${label}</span><b>${value(amount)}</b></div>`;
  const position=`<section class="position-breakdown"><div class="position-attached-lp"><span>LP attached</span><strong>${value(nft.lockedCents)}</strong></div>${nft.lockedCents?demoEarnings(nft):''}</section>`;
  if(!nft.lockedCents)return position+'<p class="small-note">Activate to start earning LP fees and royalties.</p>';
  return `${position}<section class="position-breakdown claim-breakdown"><div class="position-reward-total"><span>Rewards to claim</span><strong>${value(claimable(nft))}</strong></div><div class="breakdown-rows">${row('LP rewards',nft.individualCents+nft.collectiveCents)}${row('Royalties',royaltyClaimable(nft))}</div></section>`;
}

function renderDetails(id,mode='breakdown') {
  if (local) return;
  const nft = collection.find(item => item.id === id);
  if (!nft) return;
  selectedNFT=id;selectedDetailMode=mode;
  const owner = nft.exampleOwned && wallet.state ? wallet.state.address : nft.owner;
  let controls = '<p class="small-note">This position belongs to another example owner. Explore your own example holdings in My NFTs.</p>';
  if (nft.exampleOwned) {
    if (!wallet.state) controls = '<button class="button button-full" data-connect>Connect to explore this example NFT ↗</button>';
    else if(mode==='contribute')controls=liquidityForm(nft,nft.lockedCents?'increase':'activate');
    else controls=`${nft.lockedCents?`<button class="button button-full" data-claim-id="${id}" ${!claimable(nft)||nftOperation(id)||storageProblem?'disabled':''}>${claimable(nft)?'Preview reward claim ↗':'No rewards ready to claim'}</button>`:''}<button class="button button-secondary" data-manage-id="${id}">${nft.lockedCents?'Grow attached LP':'Activate your NFT'}</button>`;
  }
  preserveArtwork($('#nft-dialog-content'),()=>{ $('#nft-dialog-content').innerHTML = `<div class="nft-detail-art">${artButton(nft)}</div><div class="nft-detail-heading"><h2 id="nft-details-title">PoPL #${nft.id}</h2><span class="level-badge ${nft.lockedCents ? '' : 'dormant'}">${getLevel(nft.lockedCents)}</span></div><div class="nft-detail-traits">${rarityLabel(nft)}${visualTraits(nft)}${royaltyTrait(nft)}</div>${mode==='contribute'?`<div class="position-attached-lp"><span>LP attached</span><strong>${money(nft.lockedCents)}</strong></div>`:demoFinancialDetails(nft)}<p class="nft-detail-owner">Example owner: ${escape(owner)}</p>${controls}<p class="small-note">Illustrative dollar values. Principal cannot be claimed; only funded LP rewards and royalties carry claim rights. Activations, LP additions, and claims here are simulations.</p>`; });
  const form=$('#nft-dialog [data-liquidity-form]'); if(form)form.querySelectorAll('input,select,button').forEach(n=>n.disabled=Boolean(nftOperation(id))||Boolean(storageProblem));
  if (!$('#nft-dialog').open) $('#nft-dialog').showModal();
}

function refreshDetails(id) {
  const form=$('#nft-dialog [data-liquidity-form]');
  const saved=form?{action:form.dataset.action,values:Object.fromEntries(new FormData(form)),open:form.closest('details')?.open}:null;
  renderDetails(id,selectedDetailMode);
  const next=$('#nft-dialog [data-liquidity-form]');
  if(saved&&next?.dataset.action===saved.action){
    for(const [key,value] of Object.entries(saved.values)){const field=next.elements.namedItem(key);if(field){if(field.type==='checkbox')field.checked=true;else field.value=value;}}
    if(saved.open&&next.closest('details'))next.closest('details').open=true;
  }
}
function formFeedback(form,message,error=false) {
  const feedback=form?.querySelector('[data-form-feedback]');if(!feedback)return;
  feedback.textContent=message;feedback.classList.toggle('is-error',error);
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
  if (local) return local.openWallet();
  if ($('#nft-dialog').open) $('#nft-dialog').close();
  $('#wallet-message').textContent = ''; $('#wallet-message').classList.remove('is-error'); renderProviders(); updateWallet();
  if (!$('#wallet-dialog').open) $('#wallet-dialog').showModal();
}
let restoreTimer;
function registerProvider(provider,name,id=name) {
  if (!provider || typeof provider.request !== 'function' || providers.some(item => item.provider === provider)) return;
  providers.push({provider,name:String(name || 'Browser wallet').slice(0,80),id:String(id || name || 'Browser wallet')});
  if(!local){clearTimeout(restoreTimer);restoreTimer=setTimeout(()=>void wallet.restore(providers),150);}
  if ($('#wallet-dialog').open) renderProviders();
}
window.addEventListener('eip6963:announceProvider',event => registerProvider(event.detail?.provider,event.detail?.info?.name,event.detail?.info?.rdns));
window.dispatchEvent(new Event('eip6963:requestProvider'));
if (window.ethereum) {
  const list = Array.isArray(window.ethereum.providers) ? window.ethereum.providers : [window.ethereum];
  list.forEach(provider => registerProvider(provider,provider.isRabby ? 'Rabby' : provider.isMetaMask ? 'MetaMask' : 'Browser wallet'));
}

async function performPreview(event,keys,onProgress=()=>{}) {
  let op;
  try {
    if(!wallet.state)throw new Error('Connect a wallet before continuing.');
    op=operations.begin(keys,event.type);
    const snapshot=store.read();previewChange(snapshot.collection,event);
    onProgress();refreshDataViews();
    const result=await store.withResources(keys,async()=>{
      // UI simulation only. Real integration must wait for a chain receipt.
      await wait(700);
      return store.commit(event,snapshot.epoch,()=>operations.assertCurrent(op));
    });
    const previous=snapshot.collection.find(n=>n.id===event.id),next=result.collection.find(n=>n.id===event.id);
    if(previous&&next&&confirmedUpgrade({action:event.type,confirmed:true,before:getLevel(previous.lockedCents),after:getLevel(next.lockedCents),previousLP:previous.lockedCents,currentLP:next.lockedCents}))queueUpgrade(event.id,event.type);
    collection=result.collection;storageProblem=null;return result;
  }finally {operations.finish(op);refreshDataViews();}
}
async function runClaim(ids) {
  if (!wallet.state) return openWallet();
  const activityKey=`claim:${[...ids].sort().join(',')}`;
  try {
    const result=await performPreview({type:'claim',ids,scope:'all'},ids.map(nftKey),()=>recordActivity(`Claim pending for ${ids.map(id=>`#${id}`).join(', ')}.`,false,activityKey));
    const message=`Preview complete: ${money(result.amount)} claimed for ${ids.map(id=>`#${id}`).join(', ')}. No real assets moved.`;
    recordActivity(message,false,activityKey);toast(message);
  }catch(error){recordActivity(error.message,true,activityKey);toast(error.message);}
  if($('#nft-dialog').open&&ids.includes(selectedNFT))refreshDetails(selectedNFT);
}
async function runLiquidity(form) {
  if (!wallet.state) return openWallet();
  const id=Number(form.dataset.nftId),action=form.dataset.action;
  const amount=Number(form.elements.namedItem('amount').value),pool='ZZZ/WETH',fundingAsset=form.elements.namedItem('fundingAsset').value;
  const activityKey=nftKey(id);
  let completed=false;
  void armUpgradeSound();
  try {
    await performPreview({type:action,id,amount,pool,fundingAsset},[nftKey(id)],()=>{
      formFeedback(form,'Updating this example NFT… You can close this window and use your other NFTs.');
      form.setAttribute('aria-busy','true');form.querySelectorAll('input,select,button').forEach(n=>n.disabled=true);
      recordActivity(`PoPL #${id}: ${action==='activate'?'activation':'LP addition'} pending.`,false,activityKey);
    });
    completed=true;
    const message=`PoPL #${id}: ${currency.format(amount)} ${action==='activate'?'activation':'LP addition'} saved. No real assets moved.`;
    recordActivity(message,false,activityKey);toast(message);
    if($('#nft-dialog').open&&selectedNFT===id){renderDetails(id);$('#nft-dialog').scrollTo({top:0,behavior:'instant'});formFeedback($('#nft-dialog [data-liquidity-form]'),message);}
  }catch(error){const current=$('#nft-dialog [data-liquidity-form]');formFeedback(current?.dataset.nftId===String(id)?current:form,error.message,true);recordActivity(`PoPL #${id}: ${error.message}`,true,activityKey);}
  finally {if(form.isConnected&&!completed){form.setAttribute('aria-busy','false');form.querySelectorAll('input,select,button').forEach(n=>n.disabled=Boolean(nftOperation(id)));}}
}

document.addEventListener('submit',event => {
  const form = event.target;
  if (local || !form.matches('[data-liquidity-form]')) return;
  event.preventDefault();
  if(nftOperation(Number(form.dataset.nftId)))return;
  if (!form.checkValidity()) {
    const invalid=[...form.elements].find(n=>n.willValidate&&!n.validity.valid);
    const message=invalid?.name==='consent'?'Tick the checkbox to confirm that the LP principal cannot be redeemed.':`Enter a value from ${form.dataset.action==='activate'?'$100':'$5'} to $1,000,000, with at most two decimal places.`;
    formFeedback(form,message,true);invalid?.focus();return;
  }
  void runLiquidity(form);
});

document.addEventListener('click',async event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.id === 'footer-x-link') toast('X link coming soon.');
  if (target.id === 'footer-telegram-link') toast('Telegram link coming soon.');
  if (target.matches('[data-connect]')) openWallet();
  if (target.matches('[data-close-dialog]')) target.closest('dialog').close();
  if (target.dataset.nftId) renderDetails(Number(target.dataset.nftId));
  if (target.dataset.artworkId) openArtwork(target.dataset.artworkId);
  if (target.dataset.artColor) { artColor = target.dataset.artColor; artPage = 1; renderArtGallery(); }
  if (target.dataset.mintEvolution && EVOLUTIONS.some(state => state.id === target.dataset.mintEvolution)) { mintEvolution = target.dataset.mintEvolution; renderMintArt(); }
  if (target.dataset.manageId) renderDetails(Number(target.dataset.manageId),'contribute');
  if (target.dataset.claimId) await runClaim([Number(target.dataset.claimId)]);

  if (target.dataset.providerIndex !== undefined && !connecting) {
    const item = providers[Number(target.dataset.providerIndex)]; if (!item) return;
    connecting = true; $('#demo-wallet').disabled = true; renderProviders(); $('#wallet-message').textContent = 'Confirm connection in your wallet…';
    try { await wallet.connect(item.provider,item.name,item.id); $('#wallet-dialog').close(); toast('Wallet connected. This portfolio contains example assets only.'); }
    catch(error) { $('#wallet-message').textContent = walletError(error); $('#wallet-message').classList.add('is-error'); }
    finally { connecting = false; $('#demo-wallet').disabled = false; renderProviders(); }
  }
});

$('#demo-wallet').addEventListener('click',() => { if (connecting) return; wallet.connectDemo(DEMO_ADDRESS); $('#wallet-dialog').close(); toast('Demo wallet connected. Explore your example NFTs in My NFTs.'); });
$('#disconnect-wallet').addEventListener('click',() => { wallet.disconnect(); $('#wallet-dialog').close(); toast('Disconnected from this site.'); });
$('#reset-demo').addEventListener('click',async () => {
  if(local||connecting)return;
  if(operations.pending.size)return toast('Wait for your pending previews before resetting.');
  try {collection=(await store.reset()).collection;storageProblem=null;activity.length=0;renderAll();toast('Example collection restored.');}
  catch(error){recordActivity(error.message,true);toast(error.message);}
});
$('#mint-submit').addEventListener('click',event => { if (!wallet.state) { event.preventDefault(); openWallet(); } });
$('#claim-all').addEventListener('click',() => {if(!local)void runClaim(collection.filter(nft => nft.exampleOwned && claimable(nft) > 0).map(nft => nft.id));});
$('#mint-form').addEventListener('submit',async event => {
  if(local)return;
  event.preventDefault(); if (!wallet.state) return openWallet();
  const message = $('#mint-message');
  try {
    if (!$('#mint-consent').checked) throw new Error('Confirm that you understand permanent principal locking.');
    const result=await performPreview({type:'mint'},['mint'],()=>{message.textContent='Creating your example position…';message.classList.remove('is-error');});
    $('#mint-consent').checked=false;message.textContent=`PoPL #${result.nft.id} saved. Find it in My NFTs.`;
    // Never navigate away from a form the user opened while the mint was pending.
    if(location.hash==='#mint')location.hash='my-nfts';
    const complete=`PoPL #${result.nft.id} minted in the preview, with $0 LP. No real assets moved.`;
    recordActivity(complete,false,'mint');toast(complete);
  }catch(error){message.textContent=error.message;message.classList.add('is-error');recordActivity(error.message,true,'mint');}
});

for (const selector of ['#nft-search','#status-filter','#sort-positions','#rarity-filter','#color-filter','#color-style-filter']) $(selector).addEventListener(selector === '#nft-search' ? 'input' : 'change',() => { page = 1; renderCollection(); });
$('#page-prev').addEventListener('click',() => { page--; renderCollection(); });
for (const selector of ['#art-rarity-filter','#art-evolution-filter','#art-style-filter','#art-pattern-filter']) $(selector).addEventListener('change',() => { artPage = 1; renderArtGallery(); });
for (const selector of ['#mint-art-color','#mint-art-rarity','#mint-art-style','#mint-art-pattern']) $(selector).addEventListener('change',renderMintArt);
$('#art-prev').addEventListener('click',() => { artPage--; renderArtGallery(); });
$('#art-next').addEventListener('click',() => { artPage++; renderArtGallery(); });

$('#page-next').addEventListener('click',() => { page++; renderCollection(); });
const menu = $('.menu-toggle');
function closeMenu() { $('#mobile-nav').hidden = true; menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','Open navigation'); }
menu.addEventListener('click',() => { const open = $('#mobile-nav').hidden; $('#mobile-nav').hidden = !open; menu.setAttribute('aria-expanded',String(open)); menu.setAttribute('aria-label',open ? 'Close navigation' : 'Open navigation'); });
$('#mobile-nav').addEventListener('click',event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown',event => { if (event.key === 'Escape' && !$('#mobile-nav').hidden) { closeMenu(); menu.focus(); } });
$$('dialog').forEach(dialog => dialog.addEventListener('click',event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } }));

function route() {
  if (explainerDialog.open) explainerDialog.close();
  if (!local && $('#nft-dialog').open) $('#nft-dialog').close();
  const hash = location.hash.slice(1);
  const selected = ['collection','artworks','mint','my-nfts'].includes(hash) ? hash : 'overview';
  $$('[data-view]').forEach(view => { view.hidden = view.dataset.view !== selected; });
  $$('[data-nav]').forEach(link => { if (link.dataset.nav === selected) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
  document.title = `${({'overview':'Proof of Permanent Liquidity','collection':'Collection','artworks':'Artwork library','mint':'Mint','my-nfts':'My NFTs'})[selected]} — ZZZ PoPL`;
  closeMenu();
  if (hash === 'how-it-works') requestAnimationFrame(() => $('#how-it-works').scrollIntoView({behavior:'smooth'}));
  else window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route);
renderAll(); route();
void preloadUpgradeSounds();
if (local) void local.refresh();

if (!local) {
  void wallet.restore(providers);
  // Add one sample receipt after saved actions, once across refreshes and tabs.
  void store.ensureRewardRound().then(()=>syncSavedPreview()).catch(error=>{storageProblem=error.message;refreshDataViews();});
}
