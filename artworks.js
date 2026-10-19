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
