import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ARTWORKS,PALETTES,COLORWAYS,PATTERNS,RARITIES,EVOLUTIONS} from './artworks.js';
import {buildInventory,metadataAttributes,validateInventory} from './palette-system.js';

// This renderer reuses the existing approved egg illustrations. It changes no
// source pixels or material design: SVG color projection and circuit overlays
// provide reproducible visual traits around the original texture and lighting.
const hue={cyan:0,blue:36,violet:85,emerald:-33,amber:-145,crimson:158};
const sourceCache=new Map();
const hash=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const egg='M500 80 C375 80 241 302 213 535 C189 731 306 850 500 850 C694 850 811 731 787 535 C759 302 625 80 500 80Z';

function pathsFor(pattern){
  if(pattern==='arcs')return [
    'M250 414 C391 520 589 520 750 397',
    'M242 595 C395 677 608 681 767 568',
    'M378 164 C317 402 335 638 471 835',
  ];
  if(pattern==='panels')return [
    'M500 104 L500 338 L675 460 L743 384',
    'M500 338 L326 456 L256 386',
    'M326 456 L349 666 L500 771 L651 666 L675 460',
    'M349 666 L261 711 M651 666 L739 711 M500 771 L500 840',
  ];
  if(pattern==='orbits')return [
    'M271 319 C408 379 592 379 729 319',
    'M234 468 C402 550 598 550 766 468',
    'M228 628 C401 710 599 710 772 628',
    'M302 760 C413 809 587 809 698 760',
  ];
  if(pattern==='ribs')return twinCircuitGroups().flatMap(group=>group.map(trace=>trace.path));
  throw new Error('Unknown circuit pattern: '+pattern);
}
// The stable ribs slot (index 3) now renders the approved static twin routes.
// Keep this ID: stored NFT identities and on-chain image paths must not reshuffle.
function twinCircuitGroups(){
  const groups=[[],[]];
  for(let lane=0;lane<4;lane++){
    const dx=lane*17,dy=lane*8;
    groups[0].push({path:`M${456+dx} ${166+dy} V${223+dy} L${361+dx} ${318+dy} V${393+dy} L${278+dx} ${476+dy} V${539+dy} L${312+dx} ${573+dy} H${369+dx}`,start:[456+dx,166+dy],end:[369+dx,573+dy]});
    groups[1].push({path:`M${686-dx} ${402+dy} L${738-dx} ${454+dy} V${566+dy} L${689-dx} ${615+dy} V${665+dy} L${601-dx} ${753+dy} H${506-dx} L${474-dx} ${721+dy} V${687+dy}`,start:[686-dx,402+dy],end:[474-dx,687+dy]});
  }
  return groups;
}
function circuitHighlight(color,amount){
  return '#'+color.slice(1).match(/../g).map(channel=>Math.round(parseInt(channel,16)*(1-amount)+255*amount).toString(16).padStart(2,'0')).join('');
}
function twinCircuitMarkup(evolution){
  const stage=['dormant','activated','enhanced','singularity'].indexOf(evolution);
  const width=[2.6,3.4,4.3,4.8][stage],opacity=[.53,.73,.93,1][stage];
  const groups=twinCircuitGroups().map((group,index)=>{
    const paths=group.map(trace=>`<path d="${trace.path}"/>`).join('');
    const vias=group.flatMap(trace=>[trace.start,trace.end]).map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4.3"/>`).join('');
    return `<g data-pin-group="${index+1}"><g fill="none" stroke="#020b13" stroke-width="${width+4}" opacity=".85">${paths}</g><g fill="none" stroke="url(#circuitGlow)" stroke-width="${width*2.3}" opacity=".5" filter="url(#glow)">${paths}</g><g data-traces="true" fill="none" stroke="url(#circuitHighlight)" stroke-width="${width}">${paths}</g><g fill="#092532" stroke="url(#circuitVia)" stroke-width="2.3">${vias}</g></g>`;
  }).join('');
  return `<g clip-path="url(#egg)" opacity="${opacity}" stroke-linejoin="round" stroke-linecap="round">${groups}</g>`;
}
function filterFor(color,index,originalColor='cyan'){
  const adjustment=color===originalColor
    ? '<feColorMatrix type="hueRotate" values="0"/>'
    :color==='ivory'
    ? '<feColorMatrix type="saturate" values="0"/><feColorMatrix type="matrix" values="1 0 0 0 0 0 .966 0 0 0 0 0 .892 0 0 0 0 0 1 0"/>'
    :color==='onyx'
      ? '<feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope=".65"/><feFuncG type="linear" slope=".69"/><feFuncB type="linear" slope=".75"/></feComponentTransfer>'
      :`<feColorMatrix type="hueRotate" values="${hue[color]}"/>`;
  return `<filter id="color${index}" color-interpolation-filters="sRGB">${adjustment}</filter>`;
}
function maskFor(index,count){
  if(count===1)return '';
  const boundaries=count===2?[0,62,100]:[0,51,76,100];
  const left=boundaries[index],right=boundaries[index+1];
  const stops=[];
  if(index>0)stops.push(`<stop offset="0" stop-color="black"/><stop offset="${left-7}%" stop-color="black"/><stop offset="${left+7}%" stop-color="white"/>`);
  else stops.push('<stop offset="0" stop-color="white"/>');
  if(index<count-1)stops.push(`<stop offset="${right-7}%" stop-color="white"/><stop offset="${right+7}%" stop-color="black"/><stop offset="100%" stop-color="black"/>`);
  else stops.push('<stop offset="100%" stop-color="white"/>');
  return `<linearGradient id="maskGradient${index}" x1="0" x2="1" y1=".15" y2=".85">${stops.join('')}</linearGradient><mask id="region${index}"><rect width="1000" height="1000" fill="url(#maskGradient${index})"/></mask>`;
}
async function render(art){
  const originalColor=art.colors.length===1 && Object.hasOwn(hue,art.colors[0]) ? art.colors[0] : 'cyan';
  const sourceKey=`${originalColor}-${art.rarity}-${art.evolution}`;
  if(!sourceCache.has(sourceKey))sourceCache.set(sourceKey,(await readFile(new URL(`./assets/nfts/sources/${sourceKey}.webp`,import.meta.url))).toString('base64'));
  const colors=art.colors;
  // Pattern geometry must be readable even before activation. Evolution still
  // increases line intensity; the original egg texture and border stay intact.
  const light=art.evolution==='dormant'?.28:art.evolution==='activated'?.4:art.evolution==='enhanced'?.56:.72;
  const width=art.evolution==='dormant'?1.6:art.evolution==='activated'?2:art.evolution==='enhanced'?2.8:3.4;
  const patternPaths=pathsFor(art.pattern);
  // Neutral graphite highlights make an Onyx circuit readable; they are light,
  // not an extra assigned color. Ivory is the existing warm white trait.
  const lightingColors=colors.map(id=>id==='onyx'?'#788796':PALETTES.find(color=>color.id===id).accent);
  const gradient=lightingColors.map((value,index)=>`<stop offset="${colors.length===1?0:index/(colors.length-1)*100}%" stop-color="${value}"/>`).join('');
  const twinGradients=art.pattern==='ribs' ? [
    ['circuitGlow',0,'#1dd8ff'],['circuitHighlight',.65,'#b7f4ff'],['circuitVia',.8,'#c8f9ff'],
  ].map(([id,amount,cyan])=>`<linearGradient id="${id}">${lightingColors.map((color,index)=>`<stop offset="${colors.length===1?0:index/(colors.length-1)*100}%" stop-color="${colors[index]==='cyan'?cyan:circuitHighlight(color,amount)}"/>`).join('')}</linearGradient>`).join('') : '';
  const title=`${art.rarityLabel} · ${art.colorLabel} · ${art.patternLabel} · ${art.evolutionLabel}`;
  const layers=colors.map((color,index)=>`<use href="#original" filter="url(#color${index})"${colors.length>1?` mask="url(#region${index})"`:''}/>`).join('');
  // Arcs is the original circuit layout; keep its original seams untouched.
  const circuits=art.pattern==='arcs'?'':art.pattern==='ribs'?twinCircuitMarkup(art.evolution):`<g clip-path="url(#egg)" fill="none" stroke="url(#circuit)" stroke-linecap="round" stroke-linejoin="round" opacity="${light}"><g stroke-width="${width*3}" filter="url(#glow)">${patternPaths.map(path=>`<path d="${path}"/>`).join('')}</g><g stroke-width="${width}">${patternPaths.map(path=>`<path d="${path}"/>`).join('')}</g></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-labelledby="title desc"><title id="title">${escape(title)}</title><desc id="desc">Original metallic egg texture. ${escape(art.colorStyleLabel)} palette; immutable ${escape(art.patternLabel)} circuitry. Color and pattern have no effect on rewards. ${escape(EVOLUTIONS.find(stage=>stage.id===art.evolution).description)}</desc><defs><image id="original" width="1000" height="1000" href="data:image/webp;base64,${sourceCache.get(sourceKey)}"/>${colors.map((color,index)=>filterFor(color,index,originalColor)).join('')}${colors.map((_,index)=>maskFor(index,colors.length)).join('')}<clipPath id="egg"><path d="${egg}"/></clipPath><linearGradient id="circuit">${gradient}</linearGradient>${twinGradients}<filter id="glow"><feGaussianBlur stdDeviation="3"/></filter></defs><rect width="1000" height="1000" fill="#000"/>${layers}${circuits}</svg>\n`;
}

await mkdir(new URL('./assets/nfts/metadata/',import.meta.url),{recursive:true});
const variants=[];
for(const art of ARTWORKS){
  const svg=await render(art);
  const traits={paletteId:art.paletteId,colorIds:art.colors,colorStyle:art.colorStyle,pattern:art.pattern,rarity:art.rarity};
  const metadata={name:`PoPL artwork · ${art.colorLabel} · ${art.patternLabel} · ${art.rarityLabel} · ${art.evolutionLabel}`,
    description:'Example artwork metadata. Palette, color style and circuit pattern are immutable visual traits with no effect on LP rewards or royalty weight. Only rarity sets the separate NFT-sale royalty weight after activation. Evolution follows current attached LP value; activation and fee rights persist when market value falls.',
    image:`../${art.id}.svg`,attributes:[...metadataAttributes(traits,art.evolution),{trait_type:'Royalty Weight',value:art.royaltyWeight}],
    properties:{visual_only:['Color style','Palette','Colors','Circuit pattern'],palette_id:art.paletteId,color_ids:art.colors,pattern:art.pattern,evolution:art.evolution,
      royalty_multiplier:art.royaltyMultiplier,activation_required:true,example:true,source_artwork:`${art.colors.length===1&&Object.hasOwn(hue,art.colors[0])?art.colors[0]:'cyan'}-${art.rarity}-${art.evolution}.png`}};
  await writeFile(new URL(art.src,import.meta.url),svg);
  await writeFile(new URL(art.metadata,import.meta.url),JSON.stringify(metadata,null,2)+'\n');
  variants.push({...art,image_sha256:hash(svg)});
}
const inventory=buildInventory();
const validation=validateInventory(inventory);
await writeFile(new URL('./assets/nfts/inventory.json',import.meta.url),JSON.stringify({version:1,...validation,entries:inventory},null,2)+'\n');
await writeFile(new URL('./assets/nfts/manifest.json',import.meta.url),JSON.stringify({version:7,renderer:'original-egg-svg-palette-v2-twin-circuits',original_texture_preserved:true,
  source:'The original 72 PNGs remain unchanged. Original monochrome palettes retain their matching approved illustration. Mixed palettes, Ivory and Onyx use the approved cyan egg for the matching rarity/evolution; optimized WebP source data is embedded with deterministic palette projection and circuit layers. No replacement generated texture is used.',
  colors:PALETTES,palettes:COLORWAYS,patterns:PATTERNS,rarities:RARITIES,evolutions:EVOLUTIONS,inventory:validation,variants},null,2)+'\n');
console.log(`Generated ${variants.length} self-contained artwork SVGs and metadata pairs. ${validation.supply} finite inventory entries; at most ${validation.maximumIdenticalArtwork} identical finished looks.`);
