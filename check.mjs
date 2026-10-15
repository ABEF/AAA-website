import {ARTWORKS,PALETTES,COLORWAYS,PATTERNS} from './artworks.js';
import {validateInventory,metadataAttributes} from './palette-system.js';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const html = await readFile(new URL('./index.html',import.meta.url),'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML element IDs.');
const localFiles = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(match => match[1]);
for (const path of new Set(localFiles)) await access(new URL(path,import.meta.url));
const js = await readFile(new URL('./app.js',import.meta.url),'utf8');
for (const match of js.matchAll(/\$\('#([a-z][a-z0-9-]*)'\)/g)) if (!ids.includes(match[1])) throw new Error(`Missing UI element: ${match[1]}`);
for (const route of ['overview','collection','artworks','mint','my-nfts']) if (!html.includes(`data-view="${route}"`)) throw new Error(`Missing page: ${route}`);
if (!html.includes('Minting and claims are simulated')) throw new Error('Missing demo disclosure.');
console.log(`Checked ${ids.length} unique element IDs, ${new Set(localFiles).size} local references, application selectors, and all five routes.`);

if (PALETTES.length!==8 || COLORWAYS.length!==58 || PATTERNS.length!==4 || ARTWORKS.length!==2784 || new Set(ARTWORKS.map(art=>art.id)).size!==2784) throw new Error('Artwork catalog must have 2,784 unique variants.');
const manifest=JSON.parse(await readFile(new URL('./assets/nfts/manifest.json',import.meta.url),'utf8'));
const variants=new Map(manifest.variants.map(art=>[art.id,art]));
const hashes=new Set();
for(const art of ARTWORKS){
  const svg=await readFile(new URL(art.src,import.meta.url),'utf8');
  if(!svg.startsWith('<svg ') || !svg.includes('data:image/webp;base64,') || /<script|onload=|<foreignObject|href="https?:/i.test(svg)) throw new Error('Invalid/self-contained SVG: '+art.id);
  const digest=createHash('sha256').update(svg).digest('hex'); hashes.add(digest);
  if(variants.get(art.id)?.image_sha256!==digest) throw new Error('Artwork hash mismatch: '+art.id);
  const metadata=JSON.parse(await readFile(new URL(art.metadata,import.meta.url),'utf8'));
  const expected=metadataAttributes({paletteId:art.paletteId,colorIds:art.colors,colorStyle:art.colorStyle,pattern:art.pattern,rarity:art.rarity},art.evolution);
  if(metadata.image!==`../${art.id}.svg` || JSON.stringify(metadata.attributes.slice(0,-1))!==JSON.stringify(expected) || metadata.attributes.at(-1)?.value!==art.royaltyWeight) throw new Error('Incorrect artwork metadata: '+art.id);
}
if(hashes.size!==ARTWORKS.length) throw new Error('Rendered artwork files must have unique content.');
const inventory=JSON.parse(await readFile(new URL('./assets/nfts/inventory.json',import.meta.url),'utf8'));
const validation=validateInventory(inventory.entries);
console.log(`Verified ${ARTWORKS.length} self-contained artwork/metadata pairs and image hashes; ${validation.supply} inventory entries, at most ${validation.maximumIdenticalArtwork} identical finished looks.`);
