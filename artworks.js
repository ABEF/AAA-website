import {COLORS,PALETTES as COLORWAY_CATALOG,COLOR_STYLES,PATTERNS,RARITIES as RARITY_CATALOG,EVOLUTIONS as STAGES,buildInventory} from './palette-system.js';
export const PALETTES = COLORS;
export const COLORWAYS = COLORWAY_CATALOG.map(palette => ({...palette,colors:palette.colorIds}));
export {COLOR_STYLES,PATTERNS};
export const RARITIES = RARITY_CATALOG.map(rarity => ({...rarity,description:{commun:'Quiet graphite. A restrained technical finish.',rare:'Polished obsidian. Crystalline circuitry within.',legendary:'Brilliant mirrored platinum.'}[rarity.id]}));
export const EVOLUTIONS = STAGES.map(stage => ({...stage,
  threshold:{dormant:'$0 LP',activated:'$100+ LP',enhanced:'$1,000+ LP',singularity:'$10,000+ LP'}[stage.id],
  description:{dormant:'Unpowered lines. A quiet, dark border.',activated:'A fine luminous border. The circuitry awakens.',enhanced:'One bolder shining frame and brighter detail.',singularity:'A brilliant double frame and background light.'}[stage.id]}));
export const ARTWORKS = COLORWAYS.flatMap(palette => PATTERNS.flatMap(pattern => RARITIES.flatMap(rarity => EVOLUTIONS.map(evolution => {
  const id = `${palette.id}-${pattern.id}-${rarity.id}-${evolution.id}`;
  return {id,paletteId:palette.id,colors:palette.colorIds,color:palette.colorIds[0],colorLabel:palette.label,colorStyle:palette.colorStyle,
    colorStyleLabel:COLOR_STYLES.find(style => style.id === palette.colorStyle).label,accent:palette.accent,pattern:pattern.id,patternLabel:pattern.label,
    rarity:rarity.id,rarityLabel:rarity.label,evolution:evolution.id,evolutionLabel:evolution.label,threshold:evolution.threshold,
    royaltyMultiplier:rarity.royaltyMultiplier,royaltyWeight:evolution.id === 'dormant' ? 0 : rarity.royaltyMultiplier,
    src:`./assets/nfts/${id}.svg`,metadata:`./assets/nfts/metadata/${id}.json`};
}))));
const ARTWORK_BY_ID = new Map(ARTWORKS.map(art => [art.id,art]));
export const findArtwork = id => ARTWORK_BY_ID.get(id);
export const getRarity = id => RARITIES.find(rarity => rarity.id === id) || RARITIES[0];
export const getPalette = id => PALETTES.find(color => color.id === id) || PALETTES[0];
export const getColorway = id => COLORWAYS.find(palette => palette.id === id) || COLORWAYS[0];
export function getEvolution(lockedCents) {
  if (lockedCents >= 1000000) return EVOLUTIONS[3];
  if (lockedCents >= 100000) return EVOLUTIONS[2];
  if (lockedCents > 0) return EVOLUTIONS[1];
  return EVOLUTIONS[0];
}
const PREVIEW_INVENTORY = buildInventory();
export function traitsForPosition(index) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= PREVIEW_INVENTORY.length) throw new Error('Invalid example position index.');
  const entry=PREVIEW_INVENTORY[index];
  return {...entry,inventoryId:entry.tokenId,color:entry.colorIds[0],colors:[...entry.colorIds]};
}
export const royaltyWeight = nft => nft.lockedCents > 0 ? getRarity(nft.rarity).royaltyMultiplier : 0;
export function artworkForNft(nft) {
  const palette=getColorway(nft.paletteId || nft.color);
  const pattern=PATTERNS.some(item => item.id === nft.pattern) ? nft.pattern : PATTERNS[0].id;
  return findArtwork(`${palette.id}-${pattern}-${getRarity(nft.rarity).id}-${getEvolution(nft.lockedCents).id}`);
}

// Labels and CSS classes come only from the fixed artwork color catalogue.
// Never interpolate arbitrary metadata or inline styles into trait markup.
export function paletteTrait(colorIds) {
  const colors=Array.isArray(colorIds)?colorIds.map(id=>PALETTES.find(c=>c.id===id)):[];
  if(!colors.length||colors.length>3||colors.some(c=>!c))return '<span class="palette-trait">Unknown palette</span>';
  return '<span class="palette-trait">'+colors.map(c=>`<span class="trait-color trait-color-${c.id}">${c.label}</span>`).join(' / ')+'</span>';
}

// Only immutable palette/pattern/rarity identity is preloaded. Evolution selection
// still comes from confirmed LP state, never a submitted contribution amount.
export function evolutionArtworks(art) {
  if(!art||findArtwork(art.id)!==art)return [];
  return EVOLUTIONS.map(stage=>findArtwork(`${art.paletteId}-${art.pattern}-${art.rarity}-${stage.id}`));
}
const warmedEvolutionImages=new Map();
export function preloadEvolutions(art) {
  if(typeof Image==='undefined')return;
  for(const variant of evolutionArtworks(art)) {
    if(!variant||warmedEvolutionImages.has(variant.src)||warmedEvolutionImages.size>=128)continue;
    const image=new Image();image.decoding='async';image.fetchPriority='low';
    warmedEvolutionImages.set(variant.src,image);image.src=variant.src;
    if(image.decode)image.decode().catch(()=>{}); // A failed preload never changes artwork or rights.
  }
}

// Shared confirmed-tier feedback; this file is served by existing local fixtures.
export function confirmedUpgrade({action,confirmed,before,after,previousLP,currentLP}) {
  const levels=['dormant','activated','enhanced','singularity'];
  const from=levels.indexOf(String(before).toLowerCase()),to=levels.indexOf(String(after).toLowerCase());
  if(!confirmed||!['activate','increase'].includes(action)||from<0||to<=from)return false;
  if(previousLP==null||currentLP==null)return false;
  try {return BigInt(currentLP)>BigInt(previousLP)&&BigInt(previousLP)>=0n;}catch{return false;}
}

const upgradeClips={activate:'./assets/audio/activation.mp4',increase:'./assets/audio/evolution.mp4'};
const encodedClips=new Map(),decodedClips=new Map(),decodingClips=new Map(),revealPlans=new Map();
let upgradeAudio=null,playingUpgrade=null;
export function preloadUpgradeSounds() {
  return Promise.all(Object.entries(upgradeClips).map(async([action,path])=>{
    if(!encodedClips.has(action))encodedClips.set(action,(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
      try {
        const response=await fetch(new URL(path,import.meta.url),{signal:controller.signal});
        if(!response.ok)throw new Error('Sound unavailable');
        const bytes=await response.arrayBuffer();
        if(!bytes.byteLength||bytes.byteLength>200000)throw new Error('Unexpected sound size');
        return bytes;
      }catch{encodedClips.delete(action);return null;}finally{clearTimeout(timer);}
    })());
    return encodedClips.get(action);
  }));
}
export function armUpgradeSound() {
  // Unlock only within a user gesture. Fetch/decode never emits sound.
  try {
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Audio)return Promise.resolve();
    upgradeAudio ||= new Audio();
    if(upgradeAudio.state==='suspended')void upgradeAudio.resume().catch(()=>{});
    void preloadUpgradeSounds();
    return Promise.all(Object.keys(upgradeClips).map(action=>{
      if(decodedClips.has(action))return Promise.resolve();
      if(!decodingClips.has(action))decodingClips.set(action,(async()=>{
        try {
          const bytes=await encodedClips.get(action);if(!bytes)return;
          const buffer=await upgradeAudio.decodeAudioData(bytes.slice(0));
          if(buffer.duration<=0||buffer.duration>(action==='activate'?4:1.5))return;
          decodedClips.set(action,buffer);
        }catch{/* Optional sound failure never rejects a financial operation. */}
        finally{decodingClips.delete(action);}
      })());
      return decodingClips.get(action);
    }));
  }catch{return Promise.resolve();}
}
export function queueUpgrade(id,action) {
  if(!Object.hasOwn(upgradeClips,action))return;
  const key=String(id),plan={action,started:false};
  revealPlans.set(key,plan);
  setTimeout(()=>{if(revealPlans.get(key)===plan)revealPlans.delete(key);},5000);
}
function playUpgrade(plan) {
  if(plan.started||document.hidden)return;
  plan.started=true;
  try {
    const buffer=decodedClips.get(plan.action);
    if(!buffer||upgradeAudio?.state!=='running')return;
    // One cue for this transition, even if the card and dialog both show it.
    if(playingUpgrade)playingUpgrade.stop();
    const source=upgradeAudio.createBufferSource(),gain=upgradeAudio.createGain();
    source.buffer=buffer;gain.gain.value=.6;source.connect(gain);gain.connect(upgradeAudio.destination);
    playingUpgrade=source;
    source.onended=()=>{source.disconnect();gain.disconnect();if(playingUpgrade===source)playingUpgrade=null;};
    source.start();
  }catch{/* Never delay a completed transaction for playback. */}
}
export function transitionArtwork(button,previous,next) {
  next.loading='eager';next.fetchPriority='high';
  const overlay=previous.cloneNode(false);overlay.className='nft-artwork artwork-previous';overlay.alt='';overlay.setAttribute('aria-hidden','true');button.append(overlay);
  const key=button.dataset.artOwner||button.dataset.localId,plan=revealPlans.get(String(key));
  const finish=async()=>{
    if(!next.naturalWidth){overlay.remove();return;}
    // Audio was prefetched and unlocked by the contribution gesture. Bound any
    // remaining decode wait; never play a late sound after revealing the image.
    if(plan&&decodingClips.has(plan.action))await Promise.race([decodingClips.get(plan.action),new Promise(resolve=>setTimeout(resolve,600))]);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!button.isConnected){overlay.remove();return;}
      // The crossfade and the selected clip start in the very same render frame.
      overlay.classList.add('is-revealed');
      if(plan&&revealPlans.get(String(key))===plan&&!document.hidden) {
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches){button.classList.add('nft-celebrating');setTimeout(()=>button.classList.remove('nft-celebrating'),1400);}
        playUpgrade(plan);
      }
      setTimeout(()=>overlay.remove(),320);
    }));
  };
  if(next.complete)void finish();else {next.addEventListener('load',finish,{once:true});next.addEventListener('error',()=>overlay.remove(),{once:true});}
}
