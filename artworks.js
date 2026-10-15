export const PALETTES = [
  {id:'cyan',label:'Cyan',accent:'#27dff2'},
  {id:'blue',label:'Blue',accent:'#3e85ff'},
  {id:'violet',label:'Violet',accent:'#b178ff'},
  {id:'emerald',label:'Emerald',accent:'#35e6ac'},
  {id:'amber',label:'Amber',accent:'#ffbf59'},
  {id:'crimson',label:'Crimson',accent:'#ff5378'},
];
export const RARITIES = [
  {id:'commun',label:'Commun',royaltyMultiplier:1,description:'Quiet graphite. A restrained technical finish.'},
  {id:'rare',label:'Rare',royaltyMultiplier:2,description:'Polished obsidian. Crystalline circuitry within.'},
  {id:'legendary',label:'Legendary',royaltyMultiplier:3,description:'Brilliant mirrored platinum.'},
];
export const EVOLUTIONS = [
  {id:'dormant',label:'Dormant',minimumCents:0,threshold:'$0 LP',description:'Unpowered lines. A quiet, dark border.'},
  {id:'activated',label:'Activated',minimumCents:10000,threshold:'$100+ LP',description:'A fine luminous border. The circuitry awakens.'},
  {id:'enhanced',label:'Enhanced',minimumCents:100000,threshold:'$1,000+ LP',description:'A bolder shining frame and brighter detail.'},
  {id:'singularity',label:'Singularity',minimumCents:1000000,threshold:'$10,000+ LP',description:'Brilliant edges. Light emerges in the background.'},
];
export const ARTWORKS = PALETTES.flatMap(color => RARITIES.flatMap(rarity => EVOLUTIONS.map(evolution => {
  const id = `${color.id}-${rarity.id}-${evolution.id}`;
  return {id,color:color.id,colorLabel:color.label,accent:color.accent,rarity:rarity.id,rarityLabel:rarity.label,
    evolution:evolution.id,evolutionLabel:evolution.label,threshold:evolution.threshold,
    royaltyMultiplier:rarity.royaltyMultiplier,royaltyWeight:evolution.id === 'dormant' ? 0 : rarity.royaltyMultiplier,
    src:`./assets/nfts/${id}.png`,metadata:`./assets/nfts/metadata/${id}.json`};
})));
const ARTWORK_BY_ID = new Map(ARTWORKS.map(art => [art.id,art]));
export const findArtwork = id => ARTWORK_BY_ID.get(id);
export const getRarity = id => RARITIES.find(rarity => rarity.id === id) || RARITIES[0];
export const getPalette = id => PALETTES.find(color => color.id === id) || PALETTES[0];
export function getEvolution(lockedCents) {
  if (lockedCents >= 1000000) return EVOLUTIONS[3];
  if (lockedCents >= 100000) return EVOLUTIONS[2];
  if (lockedCents > 0) return EVOLUTIONS[1];
  return EVOLUTIONS[0];
}
export function traitsForPosition(index) {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid example position index.');
  return {color:PALETTES[Math.floor(index / RARITIES.length) % PALETTES.length].id,rarity:RARITIES[index % RARITIES.length].id};
}
export const royaltyWeight = nft => nft.lockedCents > 0 ? getRarity(nft.rarity).royaltyMultiplier : 0;
export function artworkForNft(nft) {
  return findArtwork(`${getPalette(nft.color).id}-${getRarity(nft.rarity).id}-${getEvolution(nft.lockedCents).id}`);
}
